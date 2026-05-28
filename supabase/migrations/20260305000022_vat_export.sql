-- =============================================
-- MTD-COMPATIBLE VAT EXPORT
--
-- HMRC's Making Tax Digital (MTD) for VAT requires VAT-registered businesses
-- to keep digital records and submit returns via MTD-compatible software. We
-- aren't a recognised MTD bridge — instead we emit a digital export the
-- client's accountant can plug into bridging tools (Tax Optimiser, VitalTax,
-- ANNA, etc.).
--
-- The export is two-part:
--   1. `lines`   — one row per (order × VAT rate) with net/VAT/gross
--   2. `summary` — Box 1 (output VAT due) + Box 6 (total sales ex VAT)
--      Box 7 (purchases) is out of scope; this POS only sees sales.
--
-- Cancelled and refunded orders are excluded (they shouldn't appear on the
-- VAT return). Period dates are inclusive and interpreted in the org's
-- configured timezone (BST/GMT correctness from migration 21).
-- =============================================
CREATE OR REPLACE FUNCTION public.get_vat_export(
    p_period_start date,
    p_period_end date,
    p_location_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_org_id uuid;
    v_location_id uuid;
    v_tz text;
    v_lines jsonb;
    v_summary jsonb;
    v_by_rate jsonb;
BEGIN
    v_org_id := public.get_my_org_id();
    IF v_org_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    IF p_period_start IS NULL OR p_period_end IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Period start and end required');
    END IF;

    IF p_period_end < p_period_start THEN
        RETURN jsonb_build_object('success', false, 'error', 'Period end must be on or after start');
    END IF;

    v_location_id := COALESCE(p_location_id, public.get_my_location_id());
    v_tz := public.get_org_timezone(v_org_id);

    -- One line per (order, VAT rate). When an order has items at multiple
    -- VAT rates, that order produces multiple lines — this is what HMRC
    -- expects for a digital VAT account.
    SELECT COALESCE(jsonb_agg(row_to_json(l) ORDER BY l.business_date, l.order_number, l.vat_rate DESC), '[]'::jsonb)
    INTO v_lines
    FROM (
        SELECT
            (o.created_at AT TIME ZONE v_tz)::date          AS business_date,
            o.id                                            AS order_id,
            o.order_number,
            o.order_type,
            o.dining_mode,
            o.customer_name,
            o.payment_method,
            o.order_source,
            COALESCE(oi.vat_rate_applied, 0)                AS vat_rate,
            ROUND(SUM(oi.unit_price * oi.quantity)::numeric, 2)              AS net_amount,
            ROUND(SUM(COALESCE(oi.vat_amount, 0))::numeric, 2)               AS vat_amount,
            ROUND(SUM(oi.unit_price * oi.quantity + COALESCE(oi.vat_amount, 0))::numeric, 2) AS gross_amount,
            COUNT(*)                                        AS item_count
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.org_id = v_org_id
          AND (v_location_id IS NULL OR o.location_id = v_location_id)
          AND (o.created_at AT TIME ZONE v_tz)::date BETWEEN p_period_start AND p_period_end
          AND o.parent_order_id IS NULL
          AND o.status IN ('paid', 'completed')
        GROUP BY
            (o.created_at AT TIME ZONE v_tz)::date,
            o.id, o.order_number, o.order_type, o.dining_mode,
            o.customer_name, o.payment_method, o.order_source,
            COALESCE(oi.vat_rate_applied, 0)
    ) l;

    -- Per-rate roll-up — what an MTD bridge typically needs as the
    -- minimum input for Box 1 (output VAT) split by rate.
    SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.vat_rate DESC), '[]'::jsonb)
    INTO v_by_rate
    FROM (
        SELECT
            COALESCE(oi.vat_rate_applied, 0)                AS vat_rate,
            ROUND(SUM(oi.unit_price * oi.quantity)::numeric, 2)              AS net_total,
            ROUND(SUM(COALESCE(oi.vat_amount, 0))::numeric, 2)               AS vat_total,
            ROUND(SUM(oi.unit_price * oi.quantity + COALESCE(oi.vat_amount, 0))::numeric, 2) AS gross_total,
            COUNT(DISTINCT o.id)                            AS order_count
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.org_id = v_org_id
          AND (v_location_id IS NULL OR o.location_id = v_location_id)
          AND (o.created_at AT TIME ZONE v_tz)::date BETWEEN p_period_start AND p_period_end
          AND o.parent_order_id IS NULL
          AND o.status IN ('paid', 'completed')
        GROUP BY COALESCE(oi.vat_rate_applied, 0)
    ) r;

    -- Box 1 (VAT due on sales) = sum of all VAT charged.
    -- Box 6 (total value of sales ex VAT) = sum of all net amounts, rounded
    -- to the whole pound per HMRC convention (FLOOR per the VAT Notice 700/22).
    SELECT jsonb_build_object(
        'box_1_vat_due_sales', ROUND(COALESCE(SUM(COALESCE(oi.vat_amount, 0))::numeric, 0), 2),
        'box_6_total_sales_ex_vat', FLOOR(COALESCE(SUM(oi.unit_price * oi.quantity)::numeric, 0)),
        'gross_total', ROUND(COALESCE(SUM(oi.unit_price * oi.quantity + COALESCE(oi.vat_amount, 0))::numeric, 0), 2),
        'order_count', COUNT(DISTINCT o.id),
        'item_count', COUNT(*)
    ) INTO v_summary
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.org_id = v_org_id
      AND (v_location_id IS NULL OR o.location_id = v_location_id)
      AND (o.created_at AT TIME ZONE v_tz)::date BETWEEN p_period_start AND p_period_end
      AND o.parent_order_id IS NULL
      AND o.status IN ('paid', 'completed');

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'period_start', p_period_start,
            'period_end',   p_period_end,
            'timezone',     v_tz,
            'location_id',  v_location_id,
            'summary',      v_summary,
            'by_rate',      v_by_rate,
            'lines',        v_lines
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_vat_export TO authenticated;
