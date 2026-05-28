-- =============================================
-- TIMEZONE-AWARE BUSINESS DAY
--
-- Postgres' CURRENT_DATE casts in the DB session TZ (UTC), so an order
-- placed at 00:30 BST is attributed to "yesterday" by every aggregation
-- (order numbering, dashboard, EOD, tip pool, reports). For UK customers
-- this is wrong every summer night; for any non-UTC org it's wrong all
-- year. Fix: derive a per-org timezone from settings and apply it to
-- every business-day boundary.
--
-- A new `timezone` setting (IANA name, e.g. 'Europe/London') drives
-- get_org_timezone(p_org_id) which returns the configured TZ or
-- 'Europe/London' as a safe default. Indian customers will set this
-- to 'Asia/Kolkata' (covered by the same migration via settings UI).
-- =============================================

-- Helper: resolve a tenant's IANA timezone, defaulting to Europe/London.
-- SECURITY DEFINER so SECURITY DEFINER callers can read across RLS, and
-- because settings RLS is org-scoped — this function only returns a
-- timezone string, no PII.
CREATE OR REPLACE FUNCTION public.get_org_timezone(p_org_id uuid)
RETURNS text AS $$
DECLARE
    v_tz text;
BEGIN
    IF p_org_id IS NULL THEN
        RETURN 'Europe/London';
    END IF;

    SELECT value INTO v_tz
    FROM settings
    WHERE org_id = p_org_id
      AND key = 'timezone'
      AND value IS NOT NULL
      AND value <> ''
    LIMIT 1;

    -- Validate it's a real TZ — Postgres rejects bad names lazily, so
    -- catch here and fall back rather than crash a downstream RPC.
    BEGIN
        PERFORM (now() AT TIME ZONE COALESCE(v_tz, 'Europe/London'));
    EXCEPTION WHEN OTHERS THEN
        v_tz := NULL;
    END;

    RETURN COALESCE(v_tz, 'Europe/London');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_org_timezone TO authenticated;

-- Default to Europe/London for orgs that have a UK VAT regime but no
-- timezone yet. Indian orgs (taxRegime = 'flat' is the default) skip —
-- the UI will surface the picker and they can opt in. We only seed
-- where the row is missing entirely; never overwrite a user choice.
INSERT INTO settings (org_id, key, value, description)
SELECT DISTINCT s.org_id, 'timezone', 'Europe/London', 'IANA timezone name for business-day calculations'
FROM settings s
WHERE s.key = 'tax_regime'
  AND s.value = 'uk_vat'
  AND NOT EXISTS (
      SELECT 1 FROM settings t
      WHERE t.org_id = s.org_id
        AND t.location_id IS NULL
        AND t.key = 'timezone'
  )
ON CONFLICT (org_id, location_id, key) DO NOTHING;

-- =============================================
-- generate_order_number — TZ-aware day boundary
-- =============================================
CREATE OR REPLACE FUNCTION public.generate_order_number(p_org_id uuid, p_prefix text DEFAULT 'ORD')
RETURNS text AS $$
DECLARE
    v_tz text;
    v_today date;
    v_count integer;
BEGIN
    v_tz := public.get_org_timezone(p_org_id);
    v_today := (now() AT TIME ZONE v_tz)::date;

    SELECT COUNT(*) + 1 INTO v_count
    FROM orders
    WHERE org_id = p_org_id
      AND (created_at AT TIME ZONE v_tz)::date = v_today;

    RETURN p_prefix || to_char(v_today, 'YYYYMMDD') || lpad(v_count::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- generate_token_number — TZ-aware day boundary
-- =============================================
CREATE OR REPLACE FUNCTION public.generate_token_number(p_org_id uuid, p_location_id uuid)
RETURNS integer AS $$
DECLARE
    v_tz text;
    v_today date;
    v_token integer;
BEGIN
    v_tz := public.get_org_timezone(p_org_id);
    v_today := (now() AT TIME ZONE v_tz)::date;

    SELECT COALESCE(MAX(token_number), 0) + 1 INTO v_token
    FROM orders
    WHERE org_id = p_org_id
      AND location_id = p_location_id
      AND (created_at AT TIME ZONE v_tz)::date = v_today
      AND token_number IS NOT NULL;

    RETURN v_token;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- get_dashboard_stats — TZ-aware "today"
-- =============================================
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS jsonb AS $$
DECLARE
    v_org_id uuid;
    v_location_id uuid;
    v_tz text;
    v_today date;
BEGIN
    v_org_id := public.get_my_org_id();
    v_location_id := public.get_my_location_id();
    v_tz := public.get_org_timezone(v_org_id);
    v_today := (now() AT TIME ZONE v_tz)::date;

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'today_orders', (
                SELECT COUNT(*) FROM orders
                WHERE org_id = v_org_id
                  AND (v_location_id IS NULL OR location_id = v_location_id)
                  AND (created_at AT TIME ZONE v_tz)::date = v_today
                  AND parent_order_id IS NULL
                  AND status != 'cancelled'
            ),
            'today_revenue', (
                SELECT COALESCE(SUM(total_amount), 0) FROM orders
                WHERE org_id = v_org_id
                  AND (v_location_id IS NULL OR location_id = v_location_id)
                  AND (created_at AT TIME ZONE v_tz)::date = v_today
                  AND parent_order_id IS NULL
                  AND status NOT IN ('cancelled', 'pending')
            ),
            'active_orders', (
                SELECT COUNT(*) FROM orders
                WHERE org_id = v_org_id
                  AND (v_location_id IS NULL OR location_id = v_location_id)
                  AND status IN ('pending', 'confirmed', 'preparing', 'ready')
                  AND parent_order_id IS NULL
            ),
            'occupied_tables', (
                SELECT COUNT(*) FROM dining_tables
                WHERE org_id = v_org_id
                  AND (v_location_id IS NULL OR location_id = v_location_id)
                  AND is_occupied = true
            )
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- get_sales_report — TZ-aware period start
-- =============================================
CREATE OR REPLACE FUNCTION public.get_sales_report(p_period text DEFAULT 'today')
RETURNS jsonb AS $$
DECLARE
    v_org_id uuid;
    v_location_id uuid;
    v_tz text;
    v_today date;
    v_start_date date;
BEGIN
    v_org_id := public.get_my_org_id();
    v_location_id := public.get_my_location_id();
    v_tz := public.get_org_timezone(v_org_id);
    v_today := (now() AT TIME ZONE v_tz)::date;

    v_start_date := CASE p_period
        WHEN 'today' THEN v_today
        WHEN 'week'  THEN v_today - interval '7 days'
        WHEN 'month' THEN v_today - interval '30 days'
        ELSE v_today
    END;

    RETURN jsonb_build_object(
        'success', true,
        'data', (
            SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
            FROM (
                SELECT
                    (created_at AT TIME ZONE v_tz)::date AS date,
                    COUNT(*) AS order_count,
                    SUM(total_amount) AS revenue
                FROM orders
                WHERE org_id = v_org_id
                  AND (v_location_id IS NULL OR location_id = v_location_id)
                  AND (created_at AT TIME ZONE v_tz)::date >= v_start_date
                  AND parent_order_id IS NULL
                  AND status NOT IN ('cancelled')
                GROUP BY (created_at AT TIME ZONE v_tz)::date
                ORDER BY (created_at AT TIME ZONE v_tz)::date
            ) r
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- get_income_report — TZ-aware breakdown
-- =============================================
CREATE OR REPLACE FUNCTION public.get_income_report(p_period text DEFAULT 'month')
RETURNS jsonb AS $$
DECLARE
    v_org_id uuid;
    v_location_id uuid;
    v_tz text;
    v_today date;
    v_start_date date;
BEGIN
    v_org_id := public.get_my_org_id();
    v_location_id := public.get_my_location_id();
    v_tz := public.get_org_timezone(v_org_id);
    v_today := (now() AT TIME ZONE v_tz)::date;

    v_start_date := CASE p_period
        WHEN 'today' THEN v_today
        WHEN 'week'  THEN v_today - interval '7 days'
        WHEN 'month' THEN v_today - interval '30 days'
        ELSE v_today - interval '30 days'
    END;

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'summary', (
                SELECT row_to_json(s) FROM (
                    SELECT
                        COUNT(*) AS total_orders,
                        COALESCE(SUM(total_amount), 0) AS gross_income,
                        COALESCE(SUM(tax_amount), 0) AS tax_collected,
                        COALESCE(SUM(total_amount - tax_amount), 0) AS net_income
                    FROM orders
                    WHERE org_id = v_org_id
                      AND (v_location_id IS NULL OR location_id = v_location_id)
                      AND (created_at AT TIME ZONE v_tz)::date >= v_start_date
                      AND parent_order_id IS NULL
                      AND status NOT IN ('cancelled')
                ) s
            ),
            'breakdown', (
                SELECT COALESCE(jsonb_agg(row_to_json(b)), '[]'::jsonb)
                FROM (
                    SELECT
                        (created_at AT TIME ZONE v_tz)::date AS period,
                        COUNT(*) AS orders,
                        COALESCE(SUM(total_amount), 0) AS gross,
                        COALESCE(SUM(tax_amount), 0) AS tax,
                        COALESCE(SUM(total_amount - tax_amount), 0) AS net
                    FROM orders
                    WHERE org_id = v_org_id
                      AND (v_location_id IS NULL OR location_id = v_location_id)
                      AND (created_at AT TIME ZONE v_tz)::date >= v_start_date
                      AND parent_order_id IS NULL
                      AND status NOT IN ('cancelled')
                    GROUP BY (created_at AT TIME ZONE v_tz)::date
                    ORDER BY (created_at AT TIME ZONE v_tz)::date
                ) b
            ),
            'period', p_period
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- get_eod_reconciliation — TZ-aware business day
-- (Replaces the version from 20260305000019 with TZ-aware date casts.)
-- =============================================
CREATE OR REPLACE FUNCTION public.get_eod_reconciliation(
    p_date date DEFAULT NULL,
    p_location_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_org_id uuid;
    v_location_id uuid;
    v_tz text;
    v_target_date date;
    v_summary jsonb;
    v_payment_methods jsonb;
    v_order_sources jsonb;
    v_voids jsonb;
    v_refunds jsonb;
    v_recorded jsonb;
BEGIN
    v_org_id := public.get_my_org_id();
    IF v_org_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    v_location_id := COALESCE(p_location_id, public.get_my_location_id());
    v_tz := public.get_org_timezone(v_org_id);
    v_target_date := COALESCE(p_date, (now() AT TIME ZONE v_tz)::date);

    SELECT jsonb_build_object(
        'orders_count',   COALESCE(COUNT(*), 0),
        'subtotal',       COALESCE(SUM(subtotal), 0),
        'tax_total',      COALESCE(SUM(tax_amount), 0),
        'discount_total', COALESCE(SUM(discount_amount), 0),
        'revenue',        COALESCE(SUM(total_amount), 0)
    ) INTO v_summary
    FROM orders
    WHERE org_id = v_org_id
      AND (v_location_id IS NULL OR location_id = v_location_id)
      AND (created_at AT TIME ZONE v_tz)::date = v_target_date
      AND parent_order_id IS NULL
      AND status IN ('paid', 'completed');

    SELECT COALESCE(jsonb_agg(row_to_json(m) ORDER BY m.payment_method), '[]'::jsonb) INTO v_payment_methods
    FROM (
        SELECT
            p.payment_method,
            COUNT(*) AS count,
            COALESCE(SUM(p.amount), 0) AS amount,
            COALESCE(SUM(p.cash_received), 0) AS cash_received,
            COALESCE(SUM(p.change_amount), 0) AS change_given
        FROM payments p
        WHERE p.org_id = v_org_id
          AND (p.processed_at AT TIME ZONE v_tz)::date = v_target_date
          AND p.status = 'completed'
        GROUP BY p.payment_method
    ) m;

    SELECT COALESCE(jsonb_agg(row_to_json(s) ORDER BY s.order_source), '[]'::jsonb) INTO v_order_sources
    FROM (
        SELECT
            order_source,
            COUNT(*) AS count,
            COALESCE(SUM(total_amount), 0) AS amount
        FROM orders
        WHERE org_id = v_org_id
          AND (v_location_id IS NULL OR location_id = v_location_id)
          AND (created_at AT TIME ZONE v_tz)::date = v_target_date
          AND parent_order_id IS NULL
          AND status IN ('paid', 'completed')
        GROUP BY order_source
    ) s;

    SELECT COALESCE(jsonb_agg(row_to_json(v) ORDER BY v.created_at), '[]'::jsonb) INTO v_voids
    FROM (
        SELECT id, order_number, total_amount, customer_name, notes, created_at
        FROM orders
        WHERE org_id = v_org_id
          AND (v_location_id IS NULL OR location_id = v_location_id)
          AND (created_at AT TIME ZONE v_tz)::date = v_target_date
          AND parent_order_id IS NULL
          AND status = 'cancelled'
        ORDER BY created_at
    ) v;

    SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.processed_at), '[]'::jsonb) INTO v_refunds
    FROM (
        SELECT p.id, p.order_id, o.order_number, p.payment_method, p.amount, p.processed_at
        FROM payments p
        JOIN orders o ON o.id = p.order_id
        WHERE p.org_id = v_org_id
          AND (p.processed_at AT TIME ZONE v_tz)::date = v_target_date
          AND p.status = 'refunded'
    ) r;

    SELECT row_to_json(r) INTO v_recorded
    FROM eod_reconciliations r
    WHERE r.org_id = v_org_id
      AND (v_location_id IS NULL OR r.location_id = v_location_id)
      AND r.business_date = v_target_date
    LIMIT 1;

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'business_date',   v_target_date,
            'location_id',     v_location_id,
            'timezone',        v_tz,
            'summary',         v_summary,
            'payment_methods', v_payment_methods,
            'order_sources',   v_order_sources,
            'voids',           v_voids,
            'refunds',         v_refunds,
            'recorded',        v_recorded
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_eod_reconciliation TO authenticated;

-- =============================================
-- record_eod_reconciliation — TZ-aware POS snapshot
-- =============================================
CREATE OR REPLACE FUNCTION public.record_eod_reconciliation(
    p_business_date date,
    p_ped_settlement_total numeric DEFAULT NULL,
    p_cash_drawer_counted numeric DEFAULT NULL,
    p_opening_float numeric DEFAULT NULL,
    p_notes text DEFAULT NULL,
    p_location_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_org_id uuid;
    v_user_id uuid;
    v_location_id uuid;
    v_tz text;
    v_pos_card_total numeric;
    v_pos_cash_total numeric;
    v_card_variance numeric;
    v_cash_variance numeric;
    v_id uuid;
BEGIN
    v_org_id := public.get_my_org_id();
    v_user_id := public.get_my_user_id();

    IF v_org_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    v_location_id := COALESCE(p_location_id, public.get_my_location_id());
    IF v_location_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Location required');
    END IF;

    v_tz := public.get_org_timezone(v_org_id);

    SELECT COALESCE(SUM(amount), 0) INTO v_pos_card_total
    FROM payments
    WHERE org_id = v_org_id
      AND (processed_at AT TIME ZONE v_tz)::date = p_business_date
      AND status = 'completed'
      AND payment_method IN ('credit_card', 'debit_card');

    SELECT COALESCE(SUM(amount), 0) INTO v_pos_cash_total
    FROM payments
    WHERE org_id = v_org_id
      AND (processed_at AT TIME ZONE v_tz)::date = p_business_date
      AND status = 'completed'
      AND payment_method = 'cash';

    v_card_variance := CASE
        WHEN p_ped_settlement_total IS NULL THEN NULL
        ELSE p_ped_settlement_total - v_pos_card_total
    END;

    v_cash_variance := CASE
        WHEN p_cash_drawer_counted IS NULL THEN NULL
        ELSE p_cash_drawer_counted - (COALESCE(p_opening_float, 0) + v_pos_cash_total)
    END;

    INSERT INTO eod_reconciliations (
        org_id, location_id, business_date, recorded_by,
        ped_settlement_total, cash_drawer_counted, opening_float,
        pos_card_total, pos_cash_total, card_variance, cash_variance,
        notes
    ) VALUES (
        v_org_id, v_location_id, p_business_date, v_user_id,
        p_ped_settlement_total, p_cash_drawer_counted, p_opening_float,
        v_pos_card_total, v_pos_cash_total, v_card_variance, v_cash_variance,
        p_notes
    )
    ON CONFLICT (org_id, location_id, business_date)
    DO UPDATE SET
        recorded_by          = v_user_id,
        ped_settlement_total = EXCLUDED.ped_settlement_total,
        cash_drawer_counted  = EXCLUDED.cash_drawer_counted,
        opening_float        = EXCLUDED.opening_float,
        pos_card_total       = EXCLUDED.pos_card_total,
        pos_cash_total       = EXCLUDED.pos_cash_total,
        card_variance        = EXCLUDED.card_variance,
        cash_variance        = EXCLUDED.cash_variance,
        notes                = EXCLUDED.notes,
        updated_at           = CURRENT_TIMESTAMP
    RETURNING id INTO v_id;

    RETURN jsonb_build_object(
        'success', true,
        'data', (SELECT row_to_json(r) FROM eod_reconciliations r WHERE r.id = v_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.record_eod_reconciliation TO authenticated;

-- =============================================
-- get_tip_pool — TZ-aware period boundary
-- =============================================
CREATE OR REPLACE FUNCTION public.get_tip_pool(
    p_period_start date,
    p_period_end date,
    p_location_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_org_id uuid;
    v_location_id uuid;
    v_tz text;
    v_total numeric;
    v_by_method jsonb;
    v_allocation jsonb;
    v_lines jsonb;
BEGIN
    v_org_id := public.get_my_org_id();
    IF v_org_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    v_location_id := COALESCE(p_location_id, public.get_my_location_id());
    v_tz := public.get_org_timezone(v_org_id);

    SELECT COALESCE(SUM(tip_amount), 0) INTO v_total
    FROM orders
    WHERE org_id = v_org_id
      AND (v_location_id IS NULL OR location_id = v_location_id)
      AND (created_at AT TIME ZONE v_tz)::date BETWEEN p_period_start AND p_period_end
      AND tip_amount > 0;

    SELECT COALESCE(jsonb_agg(row_to_json(m) ORDER BY m.tip_method), '[]'::jsonb) INTO v_by_method
    FROM (
        SELECT tip_method, COUNT(*) AS count, COALESCE(SUM(tip_amount), 0) AS amount
        FROM orders
        WHERE org_id = v_org_id
          AND (v_location_id IS NULL OR location_id = v_location_id)
          AND (created_at AT TIME ZONE v_tz)::date BETWEEN p_period_start AND p_period_end
          AND tip_amount > 0
        GROUP BY tip_method
    ) m;

    SELECT row_to_json(a) INTO v_allocation
    FROM tip_allocations a
    WHERE a.org_id = v_org_id
      AND (v_location_id IS NULL OR a.location_id = v_location_id)
      AND a.period_start = p_period_start
      AND a.period_end = p_period_end
    LIMIT 1;

    IF v_allocation IS NOT NULL THEN
        SELECT COALESCE(jsonb_agg(row_to_json(l)), '[]'::jsonb) INTO v_lines
        FROM (
            SELECT tl.user_id, tl.amount, tl.share_percent, tl.hours_worked, tl.notes,
                   u.first_name, u.last_name, u.username, u.role
            FROM tip_allocation_lines tl
            JOIN users u ON u.id = tl.user_id
            WHERE tl.allocation_id = (v_allocation->>'id')::uuid
        ) l;
    ELSE
        v_lines := '[]'::jsonb;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'period_start', p_period_start,
            'period_end',   p_period_end,
            'timezone',     v_tz,
            'total_tips',   v_total,
            'by_method',    v_by_method,
            'allocation',   v_allocation,
            'lines',        v_lines
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_tip_pool TO authenticated;

-- =============================================
-- allocate_tips — TZ-aware pool snapshot
-- =============================================
CREATE OR REPLACE FUNCTION public.allocate_tips(
    p_period_start date,
    p_period_end date,
    p_method text,
    p_allocations jsonb,
    p_location_id uuid DEFAULT NULL,
    p_notes text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_org_id uuid;
    v_user_id uuid;
    v_location_id uuid;
    v_tz text;
    v_pool_total numeric;
    v_alloc_total numeric := 0;
    v_alloc_id uuid;
    v_existing_id uuid;
    v_existing_locked timestamptz;
    v_line jsonb;
    v_user_amount numeric;
    v_share_pct numeric;
BEGIN
    v_org_id := public.get_my_org_id();
    v_user_id := public.get_my_user_id();

    IF v_org_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    IF p_method NOT IN ('equal', 'hours_weighted', 'manual') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid allocation method');
    END IF;

    v_location_id := COALESCE(p_location_id, public.get_my_location_id());
    v_tz := public.get_org_timezone(v_org_id);

    SELECT id, locked_at INTO v_existing_id, v_existing_locked
    FROM tip_allocations
    WHERE org_id = v_org_id
      AND COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid) =
          COALESCE(v_location_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND period_start = p_period_start
      AND period_end = p_period_end;

    IF v_existing_locked IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Allocation for this period is locked and cannot be edited'
        );
    END IF;

    SELECT COALESCE(SUM(tip_amount), 0) INTO v_pool_total
    FROM orders
    WHERE org_id = v_org_id
      AND (v_location_id IS NULL OR location_id = v_location_id)
      AND (created_at AT TIME ZONE v_tz)::date BETWEEN p_period_start AND p_period_end
      AND tip_amount > 0;

    SELECT COALESCE(SUM((value->>'amount')::numeric), 0) INTO v_alloc_total
    FROM jsonb_array_elements(p_allocations);

    IF ABS(v_alloc_total - v_pool_total) > 0.01 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('Allocation total (%s) does not match pool total (%s)', v_alloc_total, v_pool_total)
        );
    END IF;

    IF v_existing_id IS NULL THEN
        INSERT INTO tip_allocations (
            org_id, location_id, period_start, period_end, total_tips,
            allocation_method, allocated_by, notes
        ) VALUES (
            v_org_id, v_location_id, p_period_start, p_period_end, v_pool_total,
            p_method, v_user_id, p_notes
        ) RETURNING id INTO v_alloc_id;
    ELSE
        v_alloc_id := v_existing_id;
        UPDATE tip_allocations SET
            total_tips        = v_pool_total,
            allocation_method = p_method,
            allocated_by      = v_user_id,
            allocated_at      = CURRENT_TIMESTAMP,
            notes             = p_notes
        WHERE id = v_alloc_id;

        DELETE FROM tip_allocation_lines WHERE allocation_id = v_alloc_id;
    END IF;

    FOR v_line IN SELECT * FROM jsonb_array_elements(p_allocations) LOOP
        v_user_amount := COALESCE((v_line->>'amount')::numeric, 0);
        v_share_pct := CASE
            WHEN v_pool_total > 0 THEN ROUND(v_user_amount * 100 / v_pool_total, 2)
            ELSE 0
        END;
        INSERT INTO tip_allocation_lines (
            allocation_id, user_id, amount, share_percent, hours_worked, notes
        ) VALUES (
            v_alloc_id,
            (v_line->>'user_id')::uuid,
            v_user_amount,
            v_share_pct,
            NULLIF(v_line->>'hours_worked', '')::numeric,
            v_line->>'notes'
        );
    END LOOP;

    UPDATE tip_allocations SET locked_at = CURRENT_TIMESTAMP WHERE id = v_alloc_id;

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'allocation_id', v_alloc_id,
            'total_tips',    v_pool_total,
            'lines_count',   jsonb_array_length(p_allocations)
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.allocate_tips TO authenticated;
