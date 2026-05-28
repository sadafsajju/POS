-- =============================================
-- End-of-day reconciliation
--
-- Card payments are taken on a standalone PED (separate device), so the POS
-- has no PSP transaction ID. Manager must manually compare POS card total vs
-- the PED's settlement report — same for the cash drawer. This adds:
--
--   * get_eod_reconciliation()   — read-only daily totals breakdown
--   * eod_reconciliations table  — audit trail of manager cash-ups
--   * record_eod_reconciliation()— upsert one row per day per location
--
-- All three are no-op for orgs that don't use them. Indian customers are
-- unaffected.
-- =============================================

-- ---------------------------------------------
-- Audit table
-- One row per location per date — manager's recorded cash-up
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS eod_reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    location_id UUID NOT NULL REFERENCES locations(id),
    business_date DATE NOT NULL,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    -- Manager-entered values
    ped_settlement_total DECIMAL(12,2),
    cash_drawer_counted DECIMAL(12,2),
    opening_float DECIMAL(12,2),
    -- Computed variances at time of save (snapshot)
    pos_card_total DECIMAL(12,2),
    pos_cash_total DECIMAL(12,2),
    card_variance DECIMAL(12,2),
    cash_variance DECIMAL(12,2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (org_id, location_id, business_date)
);

CREATE INDEX IF NOT EXISTS idx_eod_org_date ON eod_reconciliations(org_id, business_date);

ALTER TABLE eod_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY eod_org_isolation ON eod_reconciliations
    USING (org_id = public.get_my_org_id())
    WITH CHECK (org_id = public.get_my_org_id());

CREATE TRIGGER update_eod_reconciliations_updated_at BEFORE UPDATE ON eod_reconciliations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- get_eod_reconciliation
-- Returns the breakdown for a given date (defaults to today).
-- =============================================
CREATE OR REPLACE FUNCTION public.get_eod_reconciliation(
    p_date date DEFAULT NULL,
    p_location_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_org_id uuid;
    v_location_id uuid;
    v_target_date date;
    v_payment_methods jsonb;
    v_order_sources jsonb;
    v_summary jsonb;
    v_voids jsonb;
    v_refunds jsonb;
    v_recorded jsonb;
BEGIN
    v_org_id := public.get_my_org_id();
    IF v_org_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Restrict to caller's location unless overridden
    v_location_id := COALESCE(p_location_id, public.get_my_location_id());
    v_target_date := COALESCE(p_date, CURRENT_DATE);

    -- Headline totals (only completed/paid orders count toward revenue)
    SELECT jsonb_build_object(
        'orders_count',         COALESCE(COUNT(*), 0),
        'subtotal',             COALESCE(SUM(subtotal), 0),
        'tax_total',            COALESCE(SUM(tax_amount), 0),
        'discount_total',       COALESCE(SUM(discount_amount), 0),
        'revenue',              COALESCE(SUM(total_amount), 0)
    ) INTO v_summary
    FROM orders
    WHERE org_id = v_org_id
      AND (v_location_id IS NULL OR location_id = v_location_id)
      AND created_at::date = v_target_date
      AND parent_order_id IS NULL
      AND status IN ('paid', 'completed');

    -- Per payment method (only completed payments count)
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
          AND p.processed_at::date = v_target_date
          AND p.status = 'completed'
        GROUP BY p.payment_method
    ) m;

    -- Per order source
    SELECT COALESCE(jsonb_agg(row_to_json(s) ORDER BY s.order_source), '[]'::jsonb) INTO v_order_sources
    FROM (
        SELECT
            order_source,
            COUNT(*) AS count,
            COALESCE(SUM(total_amount), 0) AS amount
        FROM orders
        WHERE org_id = v_org_id
          AND (v_location_id IS NULL OR location_id = v_location_id)
          AND created_at::date = v_target_date
          AND parent_order_id IS NULL
          AND status IN ('paid', 'completed')
        GROUP BY order_source
    ) s;

    -- Cancellations / voids on the day
    SELECT COALESCE(jsonb_agg(row_to_json(v) ORDER BY v.created_at), '[]'::jsonb) INTO v_voids
    FROM (
        SELECT id, order_number, total_amount, customer_name, notes, created_at
        FROM orders
        WHERE org_id = v_org_id
          AND (v_location_id IS NULL OR location_id = v_location_id)
          AND created_at::date = v_target_date
          AND parent_order_id IS NULL
          AND status = 'cancelled'
        ORDER BY created_at
    ) v;

    -- Refunds (settlement-style)
    SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.processed_at), '[]'::jsonb) INTO v_refunds
    FROM (
        SELECT p.id, p.order_id, o.order_number, p.payment_method, p.amount, p.processed_at
        FROM payments p
        JOIN orders o ON o.id = p.order_id
        WHERE p.org_id = v_org_id
          AND p.processed_at::date = v_target_date
          AND p.status = 'refunded'
    ) r;

    -- Existing manager-recorded reconciliation for the day, if any
    SELECT row_to_json(r) INTO v_recorded
    FROM eod_reconciliations r
    WHERE r.org_id = v_org_id
      AND (v_location_id IS NULL OR r.location_id = v_location_id)
      AND r.business_date = v_target_date
    LIMIT 1;

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'business_date', v_target_date,
            'location_id', v_location_id,
            'summary', v_summary,
            'payment_methods', v_payment_methods,
            'order_sources', v_order_sources,
            'voids', v_voids,
            'refunds', v_refunds,
            'recorded', v_recorded
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_eod_reconciliation TO authenticated;

-- =============================================
-- record_eod_reconciliation
-- Upserts a single row per (org, location, date). Captures variance snapshot.
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

    -- Snapshot POS totals at moment of save
    SELECT COALESCE(SUM(amount), 0) INTO v_pos_card_total
    FROM payments
    WHERE org_id = v_org_id
      AND processed_at::date = p_business_date
      AND status = 'completed'
      AND payment_method IN ('credit_card', 'debit_card');

    SELECT COALESCE(SUM(amount), 0) INTO v_pos_cash_total
    FROM payments
    WHERE org_id = v_org_id
      AND processed_at::date = p_business_date
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
        recorded_by = v_user_id,
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
