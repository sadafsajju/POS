-- =============================================
-- GDPR / UK DPA 2018 foundations
--
-- Adds engineering primitives for:
--   * Marketing consent capture on customers (opt-in, never pre-ticked)
--   * Right to erasure (Article 17) via anonymise_customer RPC.
--     Order/payment records are KEPT (UK tax retention requires 6 years)
--     but PII is wiped in-place.
--   * Right of access / portability (Articles 15 + 20) via
--     export_customer_data RPC returning JSONB.
--   * Audit trail of subject requests (Article 30) via
--     customer_data_requests table.
--   * Retention policy via apply_retention_policy RPC, triggered manually.
--
-- All fields are nullable / default-off. Existing customers and orgs
-- behave identically to the pre-migration code path.
-- =============================================

-- ---------------------------------------------
-- Customer fields
-- ---------------------------------------------
ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS marketing_consent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS marketing_consent_source VARCHAR(50),
    ADD COLUMN IF NOT EXISTS anonymised_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS anonymisation_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_marketing_consent
    ON customers(org_id, marketing_consent) WHERE marketing_consent = true;

-- ---------------------------------------------
-- Subject access request audit log (Article 30)
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS customer_data_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    request_type VARCHAR(20) NOT NULL
        CHECK (request_type IN ('access', 'erasure', 'rectification', 'portability', 'retention_policy')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fulfilled_at TIMESTAMPTZ,
    fulfilled_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    -- Snapshot key fields for the post-anonymisation period when customer_id may be NULL
    customer_phone_snapshot VARCHAR(20),
    customer_name_snapshot VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_cdr_org ON customer_data_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_cdr_customer ON customer_data_requests(customer_id);

ALTER TABLE customer_data_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY cdr_org_isolation ON customer_data_requests
    USING (org_id = public.get_my_org_id())
    WITH CHECK (org_id = public.get_my_org_id());

-- =============================================
-- anonymise_customer — Right to erasure (Article 17)
--
-- Wipes PII in customers + denormalised customer_name on orders.
-- Order/payment rows retained for UK tax compliance (6 years).
-- Phone is replaced with a unique placeholder so the (org_id, phone)
-- unique constraint still holds.
-- =============================================
CREATE OR REPLACE FUNCTION public.anonymise_customer(
    p_customer_id uuid,
    p_reason text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_org_id uuid;
    v_user_id uuid;
    v_customer record;
    v_placeholder text;
BEGIN
    v_org_id := public.get_my_org_id();
    v_user_id := public.get_my_user_id();

    IF v_org_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    SELECT * INTO v_customer
    FROM customers WHERE id = p_customer_id AND org_id = v_org_id;

    IF v_customer IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Customer not found');
    END IF;

    IF v_customer.anonymised_at IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Customer already anonymised');
    END IF;

    v_placeholder := '[deleted-' || replace(p_customer_id::text, '-', '') || ']';

    -- Wipe denormalised PII on orders first
    UPDATE orders
    SET customer_name = NULL
    WHERE customer_id = p_customer_id AND org_id = v_org_id;

    -- Wipe customer record (preserve aggregates so reports still work)
    UPDATE customers
    SET
        phone = v_placeholder,
        name = NULL,
        email = NULL,
        address = NULL,
        notes = NULL,
        marketing_consent = false,
        marketing_consent_at = NULL,
        marketing_consent_source = NULL,
        anonymised_at = CURRENT_TIMESTAMP,
        anonymisation_reason = p_reason
    WHERE id = p_customer_id;

    -- Audit row (Article 30)
    INSERT INTO customer_data_requests (
        org_id, customer_id, request_type,
        fulfilled_at, fulfilled_by, notes,
        customer_phone_snapshot, customer_name_snapshot
    ) VALUES (
        v_org_id, p_customer_id, 'erasure',
        CURRENT_TIMESTAMP, v_user_id, p_reason,
        v_customer.phone, v_customer.name
    );

    RETURN jsonb_build_object('success', true, 'message', 'Customer PII anonymised');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.anonymise_customer TO authenticated;

-- =============================================
-- export_customer_data — Articles 15 + 20
-- Returns full profile + orders + payments as JSONB.
-- =============================================
CREATE OR REPLACE FUNCTION public.export_customer_data(p_customer_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_org_id uuid;
    v_user_id uuid;
    v_customer record;
    v_orders jsonb;
    v_payments jsonb;
BEGIN
    v_org_id := public.get_my_org_id();
    v_user_id := public.get_my_user_id();

    IF v_org_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    SELECT * INTO v_customer
    FROM customers WHERE id = p_customer_id AND org_id = v_org_id;

    IF v_customer IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Customer not found');
    END IF;

    SELECT COALESCE(jsonb_agg(row_to_json(o)), '[]'::jsonb) INTO v_orders
    FROM (
        SELECT id, order_number, order_type, status, subtotal, tax_amount,
               discount_amount, total_amount, notes, created_at, paid_at,
               dining_mode, allergens_flagged_snapshot, allergens_confirmed_at
        FROM orders WHERE customer_id = p_customer_id AND org_id = v_org_id
        ORDER BY created_at DESC
    ) o;

    SELECT COALESCE(jsonb_agg(row_to_json(p)), '[]'::jsonb) INTO v_payments
    FROM (
        SELECT pay.id, pay.order_id, pay.payment_method, pay.amount,
               pay.cash_received, pay.change_amount, pay.reference_number,
               pay.status, pay.processed_at
        FROM payments pay
        JOIN orders o ON o.id = pay.order_id
        WHERE o.customer_id = p_customer_id AND o.org_id = v_org_id
        ORDER BY pay.processed_at DESC NULLS LAST
    ) p;

    -- Audit row
    INSERT INTO customer_data_requests (
        org_id, customer_id, request_type,
        fulfilled_at, fulfilled_by,
        customer_phone_snapshot, customer_name_snapshot
    ) VALUES (
        v_org_id, p_customer_id, 'access',
        CURRENT_TIMESTAMP, v_user_id,
        v_customer.phone, v_customer.name
    );

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'export_generated_at', CURRENT_TIMESTAMP,
            'customer', row_to_json(v_customer),
            'orders', v_orders,
            'payments', v_payments
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.export_customer_data TO authenticated;

-- =============================================
-- apply_retention_policy — bulk anonymise inactive customers
-- Triggered manually by admin, never on a schedule, so the team
-- always has explicit control over when records are wiped.
-- =============================================
CREATE OR REPLACE FUNCTION public.apply_retention_policy(p_dry_run boolean DEFAULT true)
RETURNS jsonb AS $$
DECLARE
    v_org_id uuid;
    v_user_id uuid;
    v_months integer;
    v_cutoff timestamptz;
    v_candidates jsonb;
    v_processed integer := 0;
    v_customer record;
BEGIN
    v_org_id := public.get_my_org_id();
    v_user_id := public.get_my_user_id();

    IF v_org_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    SELECT NULLIF(value, '')::integer INTO v_months
    FROM settings WHERE org_id = v_org_id AND key = 'customer_retention_months' LIMIT 1;

    IF v_months IS NULL OR v_months <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Customer retention policy not configured'
        );
    END IF;

    v_cutoff := CURRENT_TIMESTAMP - make_interval(months => v_months);

    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'phone', phone, 'last_order_at', last_order_at)), '[]'::jsonb)
    INTO v_candidates
    FROM customers
    WHERE org_id = v_org_id
    AND anonymised_at IS NULL
    AND COALESCE(last_order_at, created_at) < v_cutoff;

    IF p_dry_run THEN
        RETURN jsonb_build_object(
            'success', true,
            'dry_run', true,
            'cutoff', v_cutoff,
            'months', v_months,
            'candidates', v_candidates
        );
    END IF;

    FOR v_customer IN
        SELECT id FROM customers
        WHERE org_id = v_org_id
        AND anonymised_at IS NULL
        AND COALESCE(last_order_at, created_at) < v_cutoff
    LOOP
        PERFORM public.anonymise_customer(
            v_customer.id,
            'Automatic retention policy: inactive > ' || v_months || ' months'
        );
        v_processed := v_processed + 1;
    END LOOP;

    INSERT INTO customer_data_requests (
        org_id, request_type, fulfilled_at, fulfilled_by, notes
    ) VALUES (
        v_org_id, 'retention_policy', CURRENT_TIMESTAMP, v_user_id,
        format('Anonymised %s customers inactive > %s months', v_processed, v_months)
    );

    RETURN jsonb_build_object(
        'success', true,
        'dry_run', false,
        'processed', v_processed,
        'months', v_months
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.apply_retention_policy TO authenticated;
