-- =============================================
-- Employment (Allocation of Tips) Act 2023 — UK
--
-- Adds:
--   * orders.tip_amount + tip_method            (per-order tip capture)
--   * tip_allocations + tip_allocation_lines    (audit of fair allocation)
--   * record_tip / get_tip_pool / allocate_tips RPCs
--
-- Card payments happen on a separate PED so card tips never touch the POS
-- automatically. Staff records tips after the fact via record_tip().
--
-- All gated behind settings.tipping_enabled. Indian customers default to
-- disabled and see no UI change.
-- =============================================

-- ---------------------------------------------
-- Per-order tip
-- ---------------------------------------------
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS tip_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tip_method VARCHAR(20)
        CHECK (tip_method IN ('cash', 'card', 'other'));

-- ---------------------------------------------
-- Allocation pool — one row per period per location
-- locked_at preserves the record once finalised (Tipping Act audit requirement)
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS tip_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_tips DECIMAL(12,2) NOT NULL DEFAULT 0,
    allocation_method VARCHAR(20) NOT NULL
        CHECK (allocation_method IN ('equal', 'hours_weighted', 'manual')),
    allocated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    allocated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (org_id, location_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_tip_allocations_org
    ON tip_allocations(org_id, period_start, period_end);

ALTER TABLE tip_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tip_allocations_org_isolation ON tip_allocations
    USING (org_id = public.get_my_org_id())
    WITH CHECK (org_id = public.get_my_org_id());

-- ---------------------------------------------
-- Per-staff allocation lines
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS tip_allocation_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allocation_id UUID NOT NULL REFERENCES tip_allocations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    share_percent DECIMAL(5,2),
    hours_worked DECIMAL(6,2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (allocation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tip_lines_user ON tip_allocation_lines(user_id);

ALTER TABLE tip_allocation_lines ENABLE ROW LEVEL SECURITY;

-- Staff can read their own lines (Tipping Act: workers may request their record)
-- Admin/manager can read everything in their org via the alloc parent
CREATE POLICY tip_lines_self_read ON tip_allocation_lines
    FOR SELECT
    USING (
        user_id = public.get_my_user_id()
        OR EXISTS (
            SELECT 1 FROM tip_allocations a
            WHERE a.id = tip_allocation_lines.allocation_id
              AND a.org_id = public.get_my_org_id()
        )
    );

CREATE POLICY tip_lines_write ON tip_allocation_lines
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM tip_allocations a
            WHERE a.id = tip_allocation_lines.allocation_id
              AND a.org_id = public.get_my_org_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM tip_allocations a
            WHERE a.id = tip_allocation_lines.allocation_id
              AND a.org_id = public.get_my_org_id()
        )
    );

-- =============================================
-- record_tip — attach a tip to an existing order after the fact
-- (e.g. customer left cash on the table; PED card tip needs to be logged)
-- =============================================
CREATE OR REPLACE FUNCTION public.record_tip(
    p_order_id uuid,
    p_amount numeric,
    p_method text DEFAULT 'cash'
)
RETURNS jsonb AS $$
DECLARE
    v_org_id uuid;
    v_order record;
BEGIN
    v_org_id := public.get_my_org_id();
    IF v_org_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    IF p_amount IS NULL OR p_amount < 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Tip amount must be >= 0');
    END IF;

    IF p_method NOT IN ('cash', 'card', 'other') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid tip method');
    END IF;

    SELECT id, status INTO v_order
    FROM orders WHERE id = p_order_id AND org_id = v_org_id;

    IF v_order IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    UPDATE orders
    SET tip_amount = p_amount,
        tip_method = CASE WHEN p_amount > 0 THEN p_method ELSE NULL END
    WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.record_tip TO authenticated;

-- =============================================
-- get_tip_pool — total tips for a period, per method, plus existing allocation
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

    SELECT COALESCE(SUM(tip_amount), 0) INTO v_total
    FROM orders
    WHERE org_id = v_org_id
      AND (v_location_id IS NULL OR location_id = v_location_id)
      AND created_at::date BETWEEN p_period_start AND p_period_end
      AND tip_amount > 0;

    SELECT COALESCE(jsonb_agg(row_to_json(m) ORDER BY m.tip_method), '[]'::jsonb) INTO v_by_method
    FROM (
        SELECT tip_method, COUNT(*) AS count, COALESCE(SUM(tip_amount), 0) AS amount
        FROM orders
        WHERE org_id = v_org_id
          AND (v_location_id IS NULL OR location_id = v_location_id)
          AND created_at::date BETWEEN p_period_start AND p_period_end
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
-- allocate_tips — record (and lock) a tip allocation for a period
-- p_allocations: jsonb array of {user_id, amount, hours_worked?, notes?}
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

    -- Look up or create the allocation row
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

    -- Compute pool total at time of allocation (snapshot)
    SELECT COALESCE(SUM(tip_amount), 0) INTO v_pool_total
    FROM orders
    WHERE org_id = v_org_id
      AND (v_location_id IS NULL OR location_id = v_location_id)
      AND created_at::date BETWEEN p_period_start AND p_period_end
      AND tip_amount > 0;

    -- Validate: sum of line amounts == pool total (within 1p tolerance)
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
            total_tips = v_pool_total,
            allocation_method = p_method,
            allocated_by = v_user_id,
            allocated_at = CURRENT_TIMESTAMP,
            notes = p_notes
        WHERE id = v_alloc_id;

        DELETE FROM tip_allocation_lines WHERE allocation_id = v_alloc_id;
    END IF;

    -- Insert lines
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

    -- Lock it
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
