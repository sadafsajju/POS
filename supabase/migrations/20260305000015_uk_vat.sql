-- =============================================
-- UK VAT support — multi-rate VAT with regime dispatch
--
-- Existing orgs default to tax_regime='flat' and behave identically
-- to the pre-migration code path (single tax_rate setting).
-- UK orgs set tax_regime='uk_vat' to opt into per-product VAT
-- categories, eat-in/takeaway rules, and per-line VAT snapshots.
-- =============================================

-- ---------------------------------------------
-- Products: per-product VAT category + hot/cold flag (UK rule trigger)
-- ---------------------------------------------
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS vat_category VARCHAR(20)
        CHECK (vat_category IN ('standard', 'reduced', 'zero', 'exempt')),
    ADD COLUMN IF NOT EXISTS is_hot BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------
-- Orders: dining_mode separates VAT trigger from order_type workflow
-- (a 'takeout' order_type can still be eat_in if customer changes mind, etc.)
-- ---------------------------------------------
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS dining_mode VARCHAR(20)
        CHECK (dining_mode IN ('eat_in', 'takeaway'));

-- ---------------------------------------------
-- Order items: VAT snapshot per line (rates change, history shouldn't)
-- ---------------------------------------------
ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS vat_rate_applied DECIMAL(5,2);

-- =============================================
-- create_order — regime-aware
--
-- Dispatch on settings.tax_regime:
--   'flat'   → existing behaviour: single tax_rate setting applied to subtotal
--   'uk_vat' → per-line VAT using product.vat_category, product.is_hot,
--              order.dining_mode against settings.vat_rates JSON
--
-- UK rule (HMRC VAT Notice 709/1):
--   - Hot food/drink → standard rate regardless of dining_mode
--   - Cold food/drink + eat_in → standard rate
--   - Cold food/drink + takeaway → use product.vat_category as-is
--                                  (zero-rated cold takeaway, etc.)
--   - vat_category 'exempt' → 0% always, not included in VAT-able total
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
    p_dining_mode text DEFAULT NULL
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
BEGIN
    -- Get current user context from JWT
    v_org_id := public.get_my_org_id();
    v_location_id := public.get_my_location_id();
    v_user_id := public.get_my_user_id();

    IF v_org_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Determine status
    v_status := COALESCE(p_initial_status, 'pending');

    -- Read tax regime (default 'flat' if not set)
    SELECT COALESCE(value, 'flat') INTO v_tax_regime
    FROM settings WHERE org_id = v_org_id AND key = 'tax_regime' LIMIT 1;
    v_tax_regime := COALESCE(v_tax_regime, 'flat');

    -- Read flat tax rate (used by 'flat' regime, also fallback)
    SELECT COALESCE(value::numeric, 0) INTO v_tax_rate
    FROM settings WHERE org_id = v_org_id AND key = 'tax_rate' LIMIT 1;
    v_tax_rate := COALESCE(v_tax_rate, 0);

    -- Read VAT rates JSON (used by 'uk_vat' regime)
    IF v_tax_regime = 'uk_vat' THEN
        SELECT value::jsonb INTO v_vat_rates
        FROM settings WHERE org_id = v_org_id AND key = 'vat_rates' LIMIT 1;
        v_vat_rates := COALESCE(v_vat_rates, '{"standard":20,"reduced":5,"zero":0}'::jsonb);
    END IF;

    -- Handle KOT mode for dine-in (parent bill creation)
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

    -- Generate order number for the actual order (or KOT)
    v_order_number := public.generate_order_number(v_org_id,
        CASE WHEN v_is_kot THEN 'KOT' ELSE 'ORD' END);
    v_token_number := CASE WHEN v_is_kot THEN NULL
        ELSE public.generate_token_number(v_org_id, v_location_id) END;

    -- Create the order
    INSERT INTO orders (
        org_id, location_id, order_number, table_id, user_id,
        customer_id, customer_name, order_type, status,
        token_number, order_source, notes,
        parent_order_id, is_kot, kot_number,
        subtotal, tax_amount, discount_amount, total_amount, dining_mode
    ) VALUES (
        v_org_id, v_location_id, v_order_number, p_table_id, v_user_id,
        p_customer_id, p_customer_name, p_order_type, v_status,
        v_token_number, p_order_source, p_notes,
        CASE WHEN v_is_kot THEN v_bill_id ELSE NULL END,
        v_is_kot, v_kot_number,
        0, 0, 0, 0, p_dining_mode
    ) RETURNING id INTO v_order_id;

    IF p_table_id IS NOT NULL AND NOT v_is_kot THEN
        UPDATE dining_tables SET is_occupied = true, status = 'occupied' WHERE id = p_table_id;
    END IF;

    -- Insert order items (with regime-aware VAT)
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

        -- Selected options
        IF v_item->'selected_options' IS NOT NULL THEN
            FOR v_option IN SELECT * FROM jsonb_array_elements(v_item->'selected_options') LOOP
                INSERT INTO order_item_options (order_item_id, option_group_name, option_item_name, price_adjustment)
                VALUES (v_item_id, v_option->>'option_group_name', v_option->>'option_item_name',
                    COALESCE((v_option->>'price_adjustment')::numeric, 0));
                v_item_total := v_item_total + COALESCE((v_option->>'price_adjustment')::numeric, 0) * (v_item->>'quantity')::integer;
            END LOOP;
        END IF;

        -- Combo choices
        IF v_item->'combo_choices' IS NOT NULL THEN
            FOR v_combo IN SELECT * FROM jsonb_array_elements(v_item->'combo_choices') LOOP
                INSERT INTO order_item_combo_choices (order_item_id, slot_name, product_id, product_name, price_adjustment, selected_options)
                VALUES (v_item_id, v_combo->>'slot_name', (v_combo->>'product_id')::uuid,
                    v_combo->>'product_name', COALESCE((v_combo->>'price_adjustment')::numeric, 0),
                    COALESCE(v_combo->'selected_options', '[]'::jsonb));
                v_item_total := v_item_total + COALESCE((v_combo->>'price_adjustment')::numeric, 0);
            END LOOP;
        END IF;

        -- Per-line VAT under uk_vat regime; flat regime leaves vat_* NULL
        IF v_tax_regime = 'uk_vat' THEN
            v_vat_category := COALESCE(v_product.vat_category, 'standard');
            v_is_hot := COALESCE(v_product.is_hot, false);

            -- Determine applied rate per UK rule
            IF v_vat_category = 'exempt' THEN
                v_applied_rate := 0;
            ELSIF v_is_hot THEN
                v_applied_rate := COALESCE((v_vat_rates->>'standard')::numeric, 20);
            ELSIF p_dining_mode = 'eat_in' THEN
                v_applied_rate := COALESCE((v_vat_rates->>'standard')::numeric, 20);
            ELSE
                -- Cold takeaway: honour product's category
                v_applied_rate := CASE v_vat_category
                    WHEN 'standard' THEN COALESCE((v_vat_rates->>'standard')::numeric, 20)
                    WHEN 'reduced' THEN COALESCE((v_vat_rates->>'reduced')::numeric, 5)
                    WHEN 'zero'    THEN COALESCE((v_vat_rates->>'zero')::numeric, 0)
                    ELSE 0
                END;
            END IF;

            -- VAT-inclusive math is unusual in UK POS — we treat prices as net,
            -- VAT added on top. If the client decides VAT-inclusive later,
            -- this is the single place to flip the formula.
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

    -- Flat regime: tax_amount = subtotal * tax_rate
    -- UK regime: tax_amount already accumulated per line
    IF v_tax_regime <> 'uk_vat' THEN
        v_tax_amount := ROUND(v_subtotal * v_tax_rate / 100, 2);
    END IF;

    v_total_amount := v_subtotal + v_tax_amount;

    UPDATE orders SET
        subtotal = v_subtotal,
        tax_amount = v_tax_amount,
        total_amount = v_total_amount
    WHERE id = v_order_id;

    -- Roll up to parent bill if this is a KOT
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
