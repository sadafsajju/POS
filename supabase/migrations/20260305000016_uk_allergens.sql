-- =============================================
-- UK allergen compliance — Natasha's Law / FIC Regs
--
-- Replaces free-text food_allergens with a typed array of the 14
-- statutory allergens, adds cross-contamination ("may contain")
-- disclosure, ingredient statement for PPDS items, and an audit
-- trail on orders for staff allergen confirmation.
--
-- Existing orgs default to settings.show_allergens=false and behave
-- identically to the pre-migration code path. UK orgs flip the flag
-- and the create_order RPC enforces the interlock.
-- =============================================

-- ---------------------------------------------
-- Step 1: Add new typed columns alongside the legacy text column
-- (we rename later once data is migrated)
-- ---------------------------------------------
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS food_allergens_arr TEXT[] DEFAULT '{}'::TEXT[],
    ADD COLUMN IF NOT EXISTS may_contain_allergens TEXT[] DEFAULT '{}'::TEXT[],
    ADD COLUMN IF NOT EXISTS ingredients TEXT,
    ADD COLUMN IF NOT EXISTS is_ppds BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------
-- Step 2: Migrate existing comma-string allergens into the array
-- Normalises common synonyms ('shellfish' → 'crustaceans', 'soy' → 'soya',
-- 'dairy' → 'milk', 'tree nuts' → 'nuts').
-- ---------------------------------------------
UPDATE products
SET food_allergens_arr = (
    SELECT COALESCE(
        array_agg(DISTINCT
            CASE lower(trim(token))
                WHEN 'shellfish' THEN 'crustaceans'
                WHEN 'soy' THEN 'soya'
                WHEN 'dairy' THEN 'milk'
                WHEN 'tree nuts' THEN 'nuts'
                WHEN 'tree-nuts' THEN 'nuts'
                ELSE lower(trim(token))
            END
        ) FILTER (WHERE trim(token) <> ''),
        '{}'::TEXT[]
    )
    FROM unnest(string_to_array(COALESCE(food_allergens, ''), ',')) AS token
)
WHERE food_allergens IS NOT NULL AND food_allergens <> '';

-- ---------------------------------------------
-- Step 3: Drop the old text column and rename
-- ---------------------------------------------
ALTER TABLE products DROP COLUMN IF EXISTS food_allergens;
ALTER TABLE products RENAME COLUMN food_allergens_arr TO food_allergens;

-- ---------------------------------------------
-- Step 4: Validation — array values must be one of the 14 statutory UK allergens
-- ('nuts' covers tree nuts; peanuts are listed separately as legumes per FIC)
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_allergen_codes(codes TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
    RETURN codes IS NULL OR codes <@ ARRAY[
        'celery','crustaceans','eggs','fish','gluten','lupin','milk',
        'molluscs','mustard','nuts','peanuts','sesame','soya','sulphites'
    ]::TEXT[];
END;
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER TABLE products
    ADD CONSTRAINT products_food_allergens_valid
        CHECK (public.validate_allergen_codes(food_allergens)),
    ADD CONSTRAINT products_may_contain_valid
        CHECK (public.validate_allergen_codes(may_contain_allergens));

CREATE INDEX IF NOT EXISTS idx_products_food_allergens
    ON products USING GIN (food_allergens);

-- ---------------------------------------------
-- Step 5: Audit columns on orders for staff confirmation interlock
-- ---------------------------------------------
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS allergens_confirmed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS allergens_confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS allergens_flagged_snapshot TEXT[];

-- =============================================
-- create_order — allergen interlock enforcement
--
-- Adds two parameters:
--   p_allergens_confirmed   boolean — staff confirmed with customer
--   p_allergens_acknowledged_codes text[] — snapshot of allergens shown to staff
--
-- Enforcement rule:
--   * settings.show_allergens != 'true'  → no interlock (default; Indian orgs untouched)
--   * order_source != 'pos'              → no interlock (aggregator menu shows allergens; 1a)
--   * cart contains products with allergens AND parent KOT did not already
--     confirm those exact allergens → require p_allergens_confirmed = true (2a)
--
-- The function still records the snapshot for aggregator orders so the
-- audit trail is complete.
-- =============================================
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
    p_allergens_acknowledged_codes text[] DEFAULT NULL
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
    v_kot_number text;
    v_item jsonb;
    v_item_id uuid;
    v_product record;
    v_item_total numeric;
    v_option jsonb;
    v_combo jsonb;
    v_bill_id uuid;
    v_tax_regime text;
    v_vat_rates jsonb;
    v_vat_category text;
    v_is_hot boolean;
    v_applied_rate numeric;
    v_line_vat numeric;
    v_show_allergens boolean := false;
    v_cart_allergens text[] := '{}';
    v_already_confirmed text[] := '{}';
    v_new_allergens text[];
BEGIN
    v_org_id := public.get_my_org_id();
    v_location_id := public.get_my_location_id();
    v_user_id := public.get_my_user_id();

    IF v_org_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    v_status := COALESCE(p_initial_status, 'pending');

    -- Read tax + allergen settings
    SELECT COALESCE(value, 'flat') INTO v_tax_regime
    FROM settings WHERE org_id = v_org_id AND key = 'tax_regime' LIMIT 1;
    v_tax_regime := COALESCE(v_tax_regime, 'flat');

    SELECT COALESCE(value::numeric, 0) INTO v_tax_rate
    FROM settings WHERE org_id = v_org_id AND key = 'tax_rate' LIMIT 1;
    v_tax_rate := COALESCE(v_tax_rate, 0);

    IF v_tax_regime = 'uk_vat' THEN
        SELECT value::jsonb INTO v_vat_rates
        FROM settings WHERE org_id = v_org_id AND key = 'vat_rates' LIMIT 1;
        v_vat_rates := COALESCE(v_vat_rates, '{"standard":20,"reduced":5,"zero":0}'::jsonb);
    END IF;

    SELECT (COALESCE(value, 'false') = 'true') INTO v_show_allergens
    FROM settings WHERE org_id = v_org_id AND key = 'show_allergens' LIMIT 1;
    v_show_allergens := COALESCE(v_show_allergens, false);

    -- Aggregate distinct allergens across this order's items (used by interlock + snapshot)
    SELECT COALESCE(
        array_agg(DISTINCT a),
        '{}'::TEXT[]
    ) INTO v_cart_allergens
    FROM jsonb_array_elements(p_items) AS i
    JOIN products p ON p.id = (i->>'product_id')::uuid AND p.org_id = v_org_id
    CROSS JOIN LATERAL unnest(p.food_allergens) AS a;

    -- Allergen interlock: required only when show_allergens=true AND order_source='pos'
    -- AND the cart actually contains allergens. KOT delta rule: if this is a follow-on
    -- KOT, only require confirmation for allergens NOT already confirmed on the parent bill.
    IF v_show_allergens
       AND p_order_source = 'pos'
       AND array_length(v_cart_allergens, 1) > 0 THEN

        IF p_parent_order_id IS NOT NULL THEN
            -- Pull allergens previously confirmed on the parent bill or any of its KOTs
            SELECT COALESCE(array_agg(DISTINCT a), '{}'::TEXT[]) INTO v_already_confirmed
            FROM (
                SELECT unnest(allergens_flagged_snapshot) AS a
                FROM orders
                WHERE (id = p_parent_order_id OR parent_order_id = p_parent_order_id)
                AND allergens_confirmed_at IS NOT NULL
            ) sub;
        END IF;

        -- Allergens introduced by THIS submission that haven't been confirmed before
        SELECT COALESCE(array_agg(a), '{}'::TEXT[]) INTO v_new_allergens
        FROM unnest(v_cart_allergens) AS a
        WHERE NOT (a = ANY(v_already_confirmed));

        IF array_length(v_new_allergens, 1) > 0 AND NOT p_allergens_confirmed THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Allergen confirmation required',
                'error_code', 'ALLERGEN_CONFIRMATION_REQUIRED',
                'allergens_requiring_confirmation', v_new_allergens
            );
        END IF;
    END IF;

    -- KOT bill setup (unchanged from VAT migration)
    IF p_order_type = 'dine_in' AND p_create_as_kot THEN
        IF p_parent_order_id IS NOT NULL THEN
            v_bill_id := p_parent_order_id;
            v_is_kot := true;
            SELECT 'KOT' || lpad((COUNT(*) + 1)::text, 3, '0') INTO v_kot_number
            FROM orders WHERE parent_order_id = v_bill_id;
        ELSE
            v_order_number := public.generate_order_number(v_org_id, 'ORD');
            v_token_number := public.generate_token_number(v_org_id, v_location_id);

            INSERT INTO orders (org_id, location_id, order_number, table_id, user_id,
                customer_id, customer_name, order_type, status, token_number,
                order_source, notes, is_kot, subtotal, tax_amount, total_amount, dining_mode)
            VALUES (v_org_id, v_location_id, v_order_number, p_table_id, v_user_id,
                p_customer_id, p_customer_name, p_order_type, 'confirmed', v_token_number,
                p_order_source, p_notes, false, 0, 0, 0, p_dining_mode)
            RETURNING id INTO v_bill_id;

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

    -- Allergen audit columns: stamp confirmation if provided, always snapshot
    INSERT INTO orders (
        org_id, location_id, order_number, table_id, user_id,
        customer_id, customer_name, order_type, status,
        token_number, order_source, notes,
        parent_order_id, is_kot, kot_number,
        subtotal, tax_amount, discount_amount, total_amount, dining_mode,
        allergens_confirmed_at, allergens_confirmed_by, allergens_flagged_snapshot
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
        END
    ) RETURNING id INTO v_order_id;

    IF p_table_id IS NOT NULL AND NOT v_is_kot THEN
        UPDATE dining_tables SET is_occupied = true, status = 'occupied' WHERE id = p_table_id;
    END IF;

    -- Insert order items (with regime-aware VAT, unchanged from migration 15)
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

    v_total_amount := v_subtotal + v_tax_amount;

    UPDATE orders SET
        subtotal = v_subtotal,
        tax_amount = v_tax_amount,
        total_amount = v_total_amount
    WHERE id = v_order_id;

    IF v_is_kot AND v_bill_id IS NOT NULL THEN
        UPDATE orders SET
            subtotal = (SELECT COALESCE(SUM(subtotal), 0) FROM orders WHERE parent_order_id = v_bill_id),
            tax_amount = (SELECT COALESCE(SUM(tax_amount), 0) FROM orders WHERE parent_order_id = v_bill_id),
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
