-- Admin-managed discount presets.
--
-- Replaces the ad-hoc cashier-typed discount (which never actually plumbed
-- through to the order record — the existing create_order ignored it). Now:
--   1. Managers configure a list of named presets (Staff 20%, NHS 10%, …) in
--      More -> Discounts.
--   2. Cashier picks one chip at the Discount step of the payment overlay.
--   3. The order is recorded with discount_id (FK, nullable) + discount_name
--      (denormalised, survives the preset being renamed/deleted later) +
--      discount_amount (the cash value of the discount on this order).
--
-- VAT treatment: the discount is applied as a flat reduction to the order
-- total (i.e. the net is discounted; per-line VAT in order_items stays on the
-- original consideration). This matches the simplest HMRC-defensible
-- "unconditional point-of-sale discount" approach and avoids re-scaling
-- per-line VAT, which would lose audit detail. If the user needs full HMRC
-- VAT-on-gross treatment later, that's a per-line update + a new
-- discount_vat_amount column.

CREATE TABLE IF NOT EXISTS discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    percent DECIMAL(5,2) NOT NULL CHECK (percent >= 0 AND percent <= 100),
    is_active BOOLEAN DEFAULT true,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_discounts_active
    ON discounts(org_id, is_active, display_order);

-- updated_at trigger
CREATE TRIGGER update_discounts_updated_at
    BEFORE UPDATE ON discounts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- RLS — tenant-scoped, same shape as the other org tables.
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read discounts"
    ON discounts FOR SELECT
    USING (org_id = public.get_my_org_id());

CREATE POLICY "Admins and managers can write discounts"
    ON discounts FOR ALL
    USING (org_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'manager'))
    WITH CHECK (org_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'manager'));

-- Order-side audit trail. Denormalising the name + percent at insert time
-- means reports and historical receipts stay correct even if the preset is
-- later renamed or deleted.
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS discount_id UUID REFERENCES discounts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS discount_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2);

CREATE INDEX IF NOT EXISTS idx_orders_discount ON orders(discount_id)
    WHERE discount_id IS NOT NULL;

-- Replace create_order to honour the discount fields. Same signature as
-- migration 16 with two new tail params: p_discount_id and p_discount_name
-- (defaults preserve backwards compatibility for any callers that don't pass
-- discount info).
CREATE OR REPLACE FUNCTION public.create_order(
    p_table_id uuid DEFAULT NULL,
    p_customer_id uuid DEFAULT NULL,
    p_customer_name text DEFAULT NULL,
    p_order_type text DEFAULT 'takeout',
    p_items jsonb DEFAULT '[]'::jsonb,
    p_notes text DEFAULT NULL,
    p_parent_order_id uuid DEFAULT NULL,
    p_create_as_kot boolean DEFAULT false,
    p_order_source text DEFAULT 'pos',
    p_initial_status text DEFAULT NULL,
    p_dining_mode text DEFAULT NULL,
    p_allergens_confirmed boolean DEFAULT false,
    p_allergens_acknowledged_codes text[] DEFAULT NULL,
    p_discount_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_org_id uuid;
    v_location_id uuid;
    v_user_id uuid;
    v_order_id uuid;
    v_order_number text;
    v_token_number integer;
    v_subtotal numeric := 0;
    v_tax_rate numeric := 0;
    v_tax_amount numeric := 0;
    v_total_amount numeric := 0;
    v_status text;
    v_is_kot boolean := false;
    v_bill_id uuid;
    v_kot_number text;
    v_item jsonb;
    v_product RECORD;
    v_item_id uuid;
    v_option jsonb;
    v_combo jsonb;
    v_item_total numeric;
    v_tax_regime text;
    v_vat_rates jsonb;
    v_vat_category text;
    v_applied_rate numeric;
    v_is_hot boolean;
    v_line_vat numeric;
    v_cart_allergens text[] := ARRAY[]::text[];
    v_item_allergens text[];
    v_a text;
    -- Discount-related locals
    v_discount RECORD;
    v_discount_name text := NULL;
    v_discount_percent numeric := NULL;
    v_discount_amount numeric := 0;
BEGIN
    v_org_id := public.get_my_org_id();
    v_location_id := public.get_my_location_id();
    v_user_id := (auth.jwt() -> 'app_metadata' ->> 'user_id')::uuid;

    SELECT COALESCE(s.value, 'flat') INTO v_tax_regime
    FROM settings s WHERE s.org_id = v_org_id AND s.key = 'tax_regime' LIMIT 1;
    v_tax_regime := COALESCE(v_tax_regime, 'flat');

    IF v_tax_regime = 'flat' THEN
        SELECT COALESCE((s.value)::numeric, 0) INTO v_tax_rate
        FROM settings s WHERE s.org_id = v_org_id AND s.key = 'tax_rate' LIMIT 1;
    ELSE
        SELECT COALESCE(s.value::jsonb, '{"standard":20,"reduced":5,"zero":0}'::jsonb)
        INTO v_vat_rates
        FROM settings s WHERE s.org_id = v_org_id AND s.key = 'vat_rates' LIMIT 1;
    END IF;

    -- Look up discount preset (if any). We snapshot the name + percent so
    -- the order row stays correct even after the preset is renamed/deleted.
    IF p_discount_id IS NOT NULL THEN
        SELECT id, name, percent, is_active INTO v_discount
        FROM discounts WHERE id = p_discount_id AND org_id = v_org_id;
        IF v_discount.id IS NULL OR NOT v_discount.is_active THEN
            -- Silently ignore deleted or disabled discounts so a stale UI
            -- doesn't fail the whole sale.
            p_discount_id := NULL;
        ELSE
            v_discount_name := v_discount.name;
            v_discount_percent := v_discount.percent;
        END IF;
    END IF;

    -- Snapshot the allergens flagged on items in this cart so the audit row
    -- captures what the customer was warned about.
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        SELECT food_allergens INTO v_item_allergens FROM products
            WHERE id = (v_item->>'product_id')::uuid AND org_id = v_org_id;
        IF v_item_allergens IS NOT NULL THEN
            FOREACH v_a IN ARRAY v_item_allergens LOOP
                IF NOT (v_a = ANY(v_cart_allergens)) THEN
                    v_cart_allergens := array_append(v_cart_allergens, v_a);
                END IF;
            END LOOP;
        END IF;
    END LOOP;

    v_status := COALESCE(p_initial_status, 'pending');

    -- KOT / parent-bill resolution (unchanged from migration 16)
    IF p_parent_order_id IS NOT NULL THEN
        v_bill_id := p_parent_order_id;
        v_is_kot := true;
        v_kot_number := 'KOT' || LPAD((COALESCE(
            (SELECT MAX(SUBSTRING(kot_number FROM 4)::int) FROM orders WHERE parent_order_id = v_bill_id), 0
        ) + 1)::text, 3, '0');
    ELSIF p_create_as_kot AND p_table_id IS NOT NULL AND p_order_type = 'dine_in' THEN
        SELECT id INTO v_bill_id FROM orders
            WHERE table_id = p_table_id AND status NOT IN ('paid', 'cancelled')
              AND parent_order_id IS NULL AND org_id = v_org_id
            ORDER BY created_at DESC LIMIT 1;

        IF v_bill_id IS NOT NULL THEN
            v_is_kot := true;
            v_kot_number := 'KOT' || LPAD((COALESCE(
                (SELECT MAX(SUBSTRING(kot_number FROM 4)::int) FROM orders WHERE parent_order_id = v_bill_id), 0
            ) + 1)::text, 3, '0');
        ELSE
            INSERT INTO orders (
                org_id, location_id, order_number, table_id, user_id,
                customer_id, customer_name, order_type, status,
                order_source, notes, is_kot,
                subtotal, tax_amount, discount_amount, total_amount,
                dining_mode
            ) VALUES (
                v_org_id, v_location_id,
                public.generate_order_number(v_org_id, 'ORD'),
                p_table_id, v_user_id,
                p_customer_id, p_customer_name, p_order_type, v_status,
                p_order_source, p_notes, false,
                0, 0, 0, 0, p_dining_mode
            ) RETURNING id INTO v_bill_id;

            IF p_table_id IS NOT NULL THEN
                UPDATE dining_tables SET is_occupied = true, status = 'occupied' WHERE id = p_table_id;
            END IF;

            v_is_kot := true;
            v_kot_number := 'KOT001';
        END IF;
    END IF;

    v_order_number := public.generate_order_number(v_org_id,
        CASE WHEN v_is_kot THEN 'KOT' ELSE 'ORD' END);
    v_token_number := CASE WHEN v_is_kot THEN NULL
        ELSE public.generate_token_number(v_org_id, v_location_id) END;

    INSERT INTO orders (
        org_id, location_id, order_number, table_id, user_id,
        customer_id, customer_name, order_type, status,
        token_number, order_source, notes,
        parent_order_id, is_kot, kot_number,
        subtotal, tax_amount, discount_amount, total_amount, dining_mode,
        allergens_confirmed_at, allergens_confirmed_by, allergens_flagged_snapshot,
        discount_id, discount_name, discount_percent
    ) VALUES (
        v_org_id, v_location_id, v_order_number, p_table_id, v_user_id,
        p_customer_id, p_customer_name, p_order_type, v_status,
        v_token_number, p_order_source, p_notes,
        CASE WHEN v_is_kot THEN v_bill_id ELSE NULL END,
        v_is_kot, v_kot_number,
        0, 0, 0, 0, p_dining_mode,
        CASE WHEN p_allergens_confirmed THEN CURRENT_TIMESTAMP ELSE NULL END,
        CASE WHEN p_allergens_confirmed THEN v_user_id ELSE NULL END,
        CASE
            WHEN array_length(v_cart_allergens, 1) > 0 THEN v_cart_allergens
            ELSE NULL
        END,
        p_discount_id, v_discount_name, v_discount_percent
    ) RETURNING id INTO v_order_id;

    IF p_table_id IS NOT NULL AND NOT v_is_kot THEN
        UPDATE dining_tables SET is_occupied = true, status = 'occupied' WHERE id = p_table_id;
    END IF;

    -- Insert order items (regime-aware VAT, unchanged)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        SELECT id, name, price, vat_category, is_hot
        INTO v_product
        FROM products
        WHERE id = (v_item->>'product_id')::uuid AND org_id = v_org_id;

        IF v_product.id IS NULL THEN
            CONTINUE;
        END IF;

        v_item_total := v_product.price * (v_item->>'quantity')::integer;

        INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, special_instructions)
        VALUES (v_order_id, v_product.id, (v_item->>'quantity')::integer, v_product.price, v_item_total,
            v_item->>'special_instructions')
        RETURNING id INTO v_item_id;

        IF v_item->'selected_options' IS NOT NULL THEN
            FOR v_option IN SELECT * FROM jsonb_array_elements(v_item->'selected_options') LOOP
                INSERT INTO order_item_options (order_item_id, option_group_name, option_item_name, price_adjustment)
                VALUES (v_item_id, v_option->>'option_group_name', v_option->>'option_item_name',
                    COALESCE((v_option->>'price_adjustment')::numeric, 0));
                v_item_total := v_item_total + COALESCE((v_option->>'price_adjustment')::numeric, 0) * (v_item->>'quantity')::integer;
            END LOOP;
        END IF;

        IF v_item->'combo_choices' IS NOT NULL THEN
            FOR v_combo IN SELECT * FROM jsonb_array_elements(v_item->'combo_choices') LOOP
                INSERT INTO order_item_combo_choices (order_item_id, slot_name, product_id, product_name, price_adjustment, selected_options)
                VALUES (v_item_id, v_combo->>'slot_name', (v_combo->>'product_id')::uuid,
                    v_combo->>'product_name', COALESCE((v_combo->>'price_adjustment')::numeric, 0),
                    COALESCE(v_combo->'selected_options', '[]'::jsonb));
                v_item_total := v_item_total + COALESCE((v_combo->>'price_adjustment')::numeric, 0);
            END LOOP;
        END IF;

        IF v_tax_regime = 'uk_vat' THEN
            v_vat_category := COALESCE(v_product.vat_category, 'standard');
            v_is_hot := COALESCE(v_product.is_hot, false);

            IF v_vat_category = 'exempt' THEN
                v_applied_rate := 0;
            ELSIF v_is_hot THEN
                v_applied_rate := COALESCE((v_vat_rates->>'standard')::numeric, 20);
            ELSIF p_dining_mode = 'eat_in' THEN
                v_applied_rate := COALESCE((v_vat_rates->>'standard')::numeric, 20);
            ELSE
                v_applied_rate := CASE v_vat_category
                    WHEN 'standard' THEN COALESCE((v_vat_rates->>'standard')::numeric, 20)
                    WHEN 'reduced' THEN COALESCE((v_vat_rates->>'reduced')::numeric, 5)
                    WHEN 'zero'    THEN COALESCE((v_vat_rates->>'zero')::numeric, 0)
                    ELSE 0
                END;
            END IF;

            v_line_vat := ROUND(v_item_total * v_applied_rate / 100, 2);

            UPDATE order_items
            SET total_price = v_item_total,
                vat_amount = v_line_vat,
                vat_rate_applied = v_applied_rate
            WHERE id = v_item_id;

            v_tax_amount := v_tax_amount + v_line_vat;
        ELSE
            UPDATE order_items SET total_price = v_item_total WHERE id = v_item_id;
        END IF;

        v_subtotal := v_subtotal + v_item_total;
    END LOOP;

    IF v_tax_regime <> 'uk_vat' THEN
        v_tax_amount := ROUND(v_subtotal * v_tax_rate / 100, 2);
    END IF;

    -- Apply discount AFTER subtotal + tax are computed. Math:
    --   discount_amount = subtotal × percent / 100   (net-side reduction)
    --   total           = subtotal + tax − discount_amount
    -- See header for VAT-treatment notes.
    IF v_discount_percent IS NOT NULL AND v_discount_percent > 0 THEN
        v_discount_amount := ROUND(v_subtotal * v_discount_percent / 100, 2);
    END IF;

    v_total_amount := v_subtotal + v_tax_amount - v_discount_amount;

    UPDATE orders SET
        subtotal = v_subtotal,
        tax_amount = v_tax_amount,
        discount_amount = v_discount_amount,
        total_amount = v_total_amount
    WHERE id = v_order_id;

    -- If this insertion was a KOT under an existing bill, roll the bill's
    -- aggregated totals + discount up too. (Each KOT carries its own
    -- discount, so the bill's discount_amount is the sum of children.)
    IF v_is_kot AND v_bill_id IS NOT NULL THEN
        UPDATE orders SET
            subtotal = (SELECT COALESCE(SUM(subtotal), 0) FROM orders WHERE parent_order_id = v_bill_id),
            tax_amount = (SELECT COALESCE(SUM(tax_amount), 0) FROM orders WHERE parent_order_id = v_bill_id),
            discount_amount = (SELECT COALESCE(SUM(discount_amount), 0) FROM orders WHERE parent_order_id = v_bill_id),
            total_amount = (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE parent_order_id = v_bill_id)
        WHERE id = v_bill_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'data', (
            SELECT row_to_json(o) FROM (
                SELECT o.*, json_agg(
                    json_build_object(
                        'id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity,
                        'unit_price', oi.unit_price, 'total_price', oi.total_price,
                        'special_instructions', oi.special_instructions, 'status', oi.status,
                        'vat_amount', oi.vat_amount, 'vat_rate_applied', oi.vat_rate_applied
                    )
                ) as items
                FROM orders o
                LEFT JOIN order_items oi ON oi.order_id = o.id
                WHERE o.id = v_order_id
                GROUP BY o.id
            ) o
        ),
        'bill_id', CASE WHEN v_is_kot THEN v_bill_id ELSE NULL END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_order TO authenticated;
