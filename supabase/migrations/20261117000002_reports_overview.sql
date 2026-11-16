-- =============================================
-- get_reports_overview — one read-only call for the admin Reports page
--
-- The older report RPCs (get_sales_report / get_income_report /
-- get_orders_report) only know 'today' | 'week' | 'month', count unpaid
-- orders as revenue, have no previous-period comparison and say nothing
-- about products, hours, payment methods or channels. This function takes
-- an explicit business-date range and returns everything the page needs in
-- one round trip, plus the same figures for the equal-length period just
-- before it so the UI can show deltas.
--
-- Business days follow the org timezone (get_org_timezone) and the
-- configurable rollover (business_day_start, via get_business_day_start),
-- so a 00:40 sale in a venue that closes at 01:00 lands on the night it
-- belongs to. Hour-of-day buckets use the real local clock hour.
--
-- Like-for-like: when the range contains the business day in progress, the
-- previous period is cut at the same elapsed point (Today at 14:05 is
-- compared with yesterday up to 14:05, not all of yesterday).
-- range.partial / range.compare_until tell the UI when that applies.
--
-- "Sold" = a bill (parent_order_id IS NULL) that is not cancelled and has
-- been paid (paid_at set, or status paid/completed). Unpaid open bills and
-- cancellations are reported separately, never as revenue.
--
-- Dine-in bills carry no items themselves: their lines live on KOT child
-- orders (parent_order_id = bill id). Item/category figures therefore read
-- lines from the bill and its non-cancelled KOTs.
--
-- Admin/manager only. A caller pinned to a location (JWT location_id) only
-- ever sees that location; otherwise p_location_id narrows, NULL = all.
-- =============================================

-- Range scans by org + created_at on bills only (the page's main filter).
CREATE INDEX IF NOT EXISTS idx_orders_org_created_bills
    ON orders (org_id, created_at)
    WHERE parent_order_id IS NULL;

CREATE OR REPLACE FUNCTION public.get_reports_overview(
    p_start date,
    p_end date,
    p_location_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_org_id uuid;
    v_location_id uuid;
    v_tz text;
    v_cutoff interval;
    v_days integer;
    v_prev_start date;
    v_prev_end date;
    v_from timestamptz;
    v_to timestamptz;
    v_prev_from timestamptz;
    v_prev_to timestamptz;
    v_partial boolean;
    v_data jsonb;
BEGIN
    v_org_id := public.get_my_org_id();
    IF v_org_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    IF COALESCE(public.get_my_role(), '') NOT IN ('admin', 'manager') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reports are available to admins and managers only');
    END IF;

    IF p_start IS NULL OR p_end IS NULL OR p_end < p_start THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid date range');
    END IF;

    v_days := (p_end - p_start) + 1;
    IF v_days > 366 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Date range is limited to 366 days');
    END IF;

    v_location_id := COALESCE(public.get_my_location_id(), p_location_id);
    v_tz := public.get_org_timezone(v_org_id);
    -- Rollover time of day, read back from the shared helper so the
    -- 'HH:MM' parsing rules live in one place.
    v_cutoff := (public.get_business_day_start(v_org_id, now()) AT TIME ZONE v_tz)::time::interval;

    v_prev_end := p_start - 1;
    v_prev_start := p_start - v_days;

    v_from      := (p_start + v_cutoff) AT TIME ZONE v_tz;
    v_to        := ((p_end + 1) + v_cutoff) AT TIME ZONE v_tz;
    v_prev_from := (v_prev_start + v_cutoff) AT TIME ZONE v_tz;

    v_partial := now() > v_from AND now() < v_to;
    -- Same local wall-clock time, v_days earlier (DST-safe: a period that
    -- spans a clock change still cuts at 14:05, not 13:05).
    v_prev_to := CASE
        WHEN v_partial THEN ((now() AT TIME ZONE v_tz) - make_interval(days => v_days)) AT TIME ZONE v_tz
        ELSE v_from
    END;

    WITH bills AS (
        SELECT
            o.id,
            o.status,
            o.order_type,
            o.order_source,
            o.subtotal,
            o.tax_amount,
            o.discount_amount,
            o.discount_name,
            o.total_amount,
            COALESCE(o.tip_amount, 0) AS tip_amount,
            o.created_at >= v_from AS is_current,
            ((o.created_at AT TIME ZONE v_tz) - v_cutoff)::date AS bday,
            EXTRACT(HOUR FROM (o.created_at AT TIME ZONE v_tz))::int AS hr,
            (o.status <> 'cancelled'
                AND (o.paid_at IS NOT NULL OR o.status IN ('paid', 'completed'))) AS is_sold
        FROM orders o
        WHERE o.org_id = v_org_id
          AND (v_location_id IS NULL OR o.location_id = v_location_id)
          AND o.parent_order_id IS NULL
          AND o.created_at >= v_prev_from
          AND o.created_at < v_to
          AND (o.created_at >= v_from OR o.created_at < v_prev_to)
    ),
    sold AS (
        SELECT * FROM bills WHERE is_sold
    ),
    cur AS (
        SELECT * FROM sold WHERE is_current
    ),
    -- Orders that hold item lines for each sold bill: the bill itself
    -- (counter/takeaway) plus its live KOTs (dine-in).
    line_orders AS (
        SELECT s.id AS order_id, s.is_current FROM sold s
        UNION ALL
        SELECT k.id, s.is_current
        FROM sold s
        JOIN orders k ON k.parent_order_id = s.id
        WHERE k.org_id = v_org_id
          AND k.status <> 'cancelled'
    ),
    lines AS (
        SELECT lo.is_current, oi.product_id, oi.quantity, oi.total_price
        FROM line_orders lo
        JOIN order_items oi ON oi.order_id = lo.order_id
    ),
    cur_lines AS (
        SELECT * FROM lines WHERE is_current
    ),
    product_sales AS (
        SELECT
            cl.product_id,
            SUM(cl.quantity)::int AS quantity,
            SUM(cl.total_price) AS revenue
        FROM cur_lines cl
        GROUP BY cl.product_id
    )
    SELECT jsonb_build_object(
        'range', jsonb_build_object(
            'start', p_start,
            'end', p_end,
            'days', v_days,
            'prev_start', v_prev_start,
            'prev_end', v_prev_end,
            'timezone', v_tz,
            'business_day_start', to_char(v_cutoff, 'HH24:MI'),
            'partial', v_partial,
            'compare_until', v_prev_to
        ),

        'summary', (
            SELECT jsonb_build_object(
                'orders',            COUNT(*),
                'revenue',           COALESCE(SUM(total_amount), 0),
                'subtotal',          COALESCE(SUM(subtotal), 0),
                'tax',               COALESCE(SUM(tax_amount), 0),
                'net',               COALESCE(SUM(total_amount - tax_amount), 0),
                'discounts',         COALESCE(SUM(discount_amount), 0),
                'discounted_orders', COUNT(*) FILTER (WHERE discount_amount > 0),
                'tips',              COALESCE(SUM(tip_amount), 0),
                'tipped_orders',     COUNT(*) FILTER (WHERE tip_amount > 0),
                'avg_order_value',   CASE WHEN COUNT(*) > 0
                                          THEN ROUND(SUM(total_amount) / COUNT(*), 2)
                                          ELSE 0 END,
                'items_sold',        (SELECT COALESCE(SUM(quantity), 0) FROM cur_lines),
                'cancelled_orders',  (SELECT COUNT(*) FROM bills WHERE is_current AND status = 'cancelled'),
                'cancelled_value',   (SELECT COALESCE(SUM(total_amount), 0) FROM bills WHERE is_current AND status = 'cancelled'),
                'open_orders',       (SELECT COUNT(*) FROM bills WHERE is_current AND NOT is_sold AND status <> 'cancelled'),
                'open_value',        (SELECT COALESCE(SUM(total_amount), 0) FROM bills WHERE is_current AND NOT is_sold AND status <> 'cancelled'),
                'refunds',           (
                    SELECT COALESCE(SUM(p.amount), 0)
                    FROM payments p
                    JOIN cur c ON c.id = p.order_id
                    WHERE p.status = 'refunded'
                )
            )
            FROM cur
        ),

        'previous', (
            SELECT jsonb_build_object(
                'orders',          COUNT(*),
                'revenue',         COALESCE(SUM(total_amount), 0),
                'net',             COALESCE(SUM(total_amount - tax_amount), 0),
                'discounts',       COALESCE(SUM(discount_amount), 0),
                'tips',            COALESCE(SUM(tip_amount), 0),
                'avg_order_value', CASE WHEN COUNT(*) > 0
                                        THEN ROUND(SUM(total_amount) / COUNT(*), 2)
                                        ELSE 0 END,
                'items_sold',      (SELECT COALESCE(SUM(quantity), 0) FROM lines WHERE NOT is_current)
            )
            FROM sold
            WHERE NOT is_current
        ),

        -- One row per business date in range (zeros included) so the chart
        -- has no gaps; previous_daily is index-aligned with daily.
        'daily', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'date', g.day,
                'revenue', COALESCE(x.revenue, 0),
                'orders', COALESCE(x.orders, 0)
            ) ORDER BY g.day), '[]'::jsonb)
            FROM (
                SELECT gs::date AS day
                FROM generate_series(p_start, p_end, interval '1 day') AS gs
            ) g
            LEFT JOIN LATERAL (
                SELECT SUM(c.total_amount) AS revenue, COUNT(*) AS orders
                FROM cur c WHERE c.bday = g.day
            ) x ON true
        ),

        'previous_daily', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'date', g.day,
                'revenue', COALESCE(x.revenue, 0),
                'orders', COALESCE(x.orders, 0)
            ) ORDER BY g.day), '[]'::jsonb)
            FROM (
                SELECT gs::date AS day
                FROM generate_series(v_prev_start, v_prev_end, interval '1 day') AS gs
            ) g
            LEFT JOIN LATERAL (
                SELECT SUM(s.total_amount) AS revenue, COUNT(*) AS orders
                FROM sold s WHERE NOT s.is_current AND s.bday = g.day
            ) x ON true
        ),

        'hourly', (
            SELECT jsonb_agg(jsonb_build_object(
                'hour', h.hr,
                'revenue', COALESCE(x.revenue, 0),
                'orders', COALESCE(x.orders, 0),
                'prev_revenue', COALESCE(x.prev_revenue, 0),
                'prev_orders', COALESCE(x.prev_orders, 0)
            ) ORDER BY h.hr)
            FROM generate_series(0, 23) AS h(hr)
            LEFT JOIN LATERAL (
                SELECT
                    SUM(s.total_amount) FILTER (WHERE s.is_current) AS revenue,
                    COUNT(*) FILTER (WHERE s.is_current) AS orders,
                    SUM(s.total_amount) FILTER (WHERE NOT s.is_current) AS prev_revenue,
                    COUNT(*) FILTER (WHERE NOT s.is_current) AS prev_orders
                FROM sold s WHERE s.hr = h.hr
            ) x ON true
        ),

        -- ISO weekday (1 = Monday). `days` = how many of that weekday fall
        -- in the range, so the UI can show a per-day average.
        'weekday', (
            SELECT jsonb_agg(jsonb_build_object(
                'dow', w.dow,
                'days', (
                    SELECT COUNT(*)
                    FROM generate_series(p_start, p_end, interval '1 day') AS g(ts)
                    WHERE EXTRACT(ISODOW FROM g.ts)::int = w.dow
                ),
                'revenue', COALESCE(x.revenue, 0),
                'orders', COALESCE(x.orders, 0)
            ) ORDER BY w.dow)
            FROM generate_series(1, 7) AS w(dow)
            LEFT JOIN LATERAL (
                SELECT SUM(c.total_amount) AS revenue, COUNT(*) AS orders
                FROM cur c WHERE EXTRACT(ISODOW FROM c.bday)::int = w.dow
            ) x ON true
        ),

        -- Line totals are pre-discount and as charged per line.
        'products', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'product_id', ps.product_id,
                'name', COALESCE(p.name, 'Deleted product'),
                'category', COALESCE(c.name, 'Uncategorised'),
                'quantity', ps.quantity,
                'revenue', ps.revenue
            ) ORDER BY ps.revenue DESC, ps.quantity DESC), '[]'::jsonb)
            FROM product_sales ps
            LEFT JOIN products p ON p.id = ps.product_id
            LEFT JOIN categories c ON c.id = p.category_id
        ),

        -- Available menu items with no sales at all in the range.
        'unsold_products', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'product_id', u.id,
                'name', u.name,
                'category', u.category
            ) ORDER BY u.category, u.name), '[]'::jsonb)
            FROM (
                SELECT p.id, p.name, COALESCE(c.name, 'Uncategorised') AS category
                FROM products p
                LEFT JOIN categories c ON c.id = p.category_id
                WHERE p.org_id = v_org_id
                  AND p.is_available = true
                  AND (v_location_id IS NULL OR p.location_ids IS NULL OR v_location_id = ANY (p.location_ids))
                  AND NOT EXISTS (SELECT 1 FROM product_sales ps WHERE ps.product_id = p.id)
                ORDER BY COALESCE(c.name, 'Uncategorised'), p.name
                LIMIT 100
            ) u
        ),

        'categories', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'category_id', t.category_id,
                'name', t.name,
                'color', t.color,
                'quantity', t.quantity,
                'revenue', t.revenue
            ) ORDER BY t.revenue DESC), '[]'::jsonb)
            FROM (
                SELECT
                    c.id AS category_id,
                    COALESCE(c.name, 'Uncategorised') AS name,
                    c.color,
                    SUM(ps.quantity)::int AS quantity,
                    SUM(ps.revenue) AS revenue
                FROM product_sales ps
                LEFT JOIN products p ON p.id = ps.product_id
                LEFT JOIN categories c ON c.id = p.category_id
                GROUP BY c.id, c.name, c.color
            ) t
        ),

        'payment_methods', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'method', m.payment_method,
                'count', m.cnt,
                'amount', m.amount
            ) ORDER BY m.amount DESC), '[]'::jsonb)
            FROM (
                SELECT p.payment_method, COUNT(*) AS cnt, SUM(p.amount) AS amount
                FROM payments p
                JOIN cur c ON c.id = p.order_id
                WHERE p.status = 'completed'
                GROUP BY p.payment_method
            ) m
        ),

        -- Channel = the aggregator for marketplace orders, otherwise the
        -- order type (dine_in / takeout / delivery).
        'channels', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'channel', ch.channel,
                'orders', ch.orders,
                'revenue', ch.revenue
            ) ORDER BY ch.revenue DESC), '[]'::jsonb)
            FROM (
                SELECT
                    CASE WHEN c.order_source IN ('pos', 'kiosk', 'customer_app') OR c.order_source IS NULL
                         THEN c.order_type
                         ELSE c.order_source END AS channel,
                    COUNT(*) AS orders,
                    SUM(c.total_amount) AS revenue
                FROM cur c
                GROUP BY 1
            ) ch
        ),

        'sources', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'source', sr.source,
                'orders', sr.orders,
                'revenue', sr.revenue
            ) ORDER BY sr.revenue DESC), '[]'::jsonb)
            FROM (
                SELECT COALESCE(c.order_source, 'pos') AS source, COUNT(*) AS orders, SUM(c.total_amount) AS revenue
                FROM cur c
                GROUP BY 1
            ) sr
        ),

        'discounts', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'name', dd.name,
                'count', dd.cnt,
                'amount', dd.amount
            ) ORDER BY dd.amount DESC), '[]'::jsonb)
            FROM (
                SELECT COALESCE(NULLIF(c.discount_name, ''), 'Manual discount') AS name,
                       COUNT(*) AS cnt,
                       SUM(c.discount_amount) AS amount
                FROM cur c
                WHERE c.discount_amount > 0
                GROUP BY 1
            ) dd
        )
    ) INTO v_data;

    RETURN jsonb_build_object('success', true, 'data', v_data);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_reports_overview(date, date, uuid) TO authenticated;
