-- =============================================
-- Database Functions for Complex Business Logic
-- Called via supabase.rpc() from the frontend
-- Replaces Go handler business logic
-- =============================================

-- =============================================
-- GENERATE ORDER NUMBER
-- Format: ORG-YYYYMMDD-XXXX (sequential per day per org)
-- =============================================
CREATE OR REPLACE FUNCTION public.generate_order_number(p_org_id uuid, p_prefix text DEFAULT 'ORD')
RETURNS text AS $$
DECLARE
    v_date text;
    v_count integer;
    v_number text;
BEGIN
    v_date := to_char(CURRENT_DATE, 'YYYYMMDD');

    SELECT COUNT(*) + 1 INTO v_count
    FROM orders
    WHERE org_id = p_org_id
    AND created_at::date = CURRENT_DATE;

    v_number := p_prefix || v_date || lpad(v_count::text, 4, '0');
    RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- GENERATE TOKEN NUMBER
-- Daily sequential number per org+location (resets each day)
-- =============================================
CREATE OR REPLACE FUNCTION public.generate_token_number(p_org_id uuid, p_location_id uuid)
RETURNS integer AS $$
DECLARE
    v_token integer;
BEGIN
    SELECT COALESCE(MAX(token_number), 0) + 1 INTO v_token
    FROM orders
    WHERE org_id = p_org_id
    AND location_id = p_location_id
    AND created_at::date = CURRENT_DATE
    AND token_number IS NOT NULL;

    RETURN v_token;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- CREATE ORDER
-- Replaces orders.go CreateOrder (~400 lines Go)
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
    p_initial_status text DEFAULT NULL
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
    v_parent_order_id uuid;
    v_bill_id uuid;
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

    -- Handle KOT mode for dine-in
    IF p_order_type = 'dine_in' AND p_create_as_kot THEN
        IF p_parent_order_id IS NOT NULL THEN
            -- Adding KOT to existing bill
            v_bill_id := p_parent_order_id;
            v_is_kot := true;

            -- Generate KOT number
            SELECT 'KOT' || lpad((COUNT(*) + 1)::text, 3, '0') INTO v_kot_number
            FROM orders WHERE parent_order_id = v_bill_id;
        ELSE
            -- Create new bill first, then KOT
            v_order_number := public.generate_order_number(v_org_id, 'ORD');
            v_token_number := public.generate_token_number(v_org_id, v_location_id);

            INSERT INTO orders (org_id, location_id, order_number, table_id, user_id,
                customer_id, customer_name, order_type, status, token_number,
                order_source, notes, is_kot, subtotal, tax_amount, total_amount)
            VALUES (v_org_id, v_location_id, v_order_number, p_table_id, v_user_id,
                p_customer_id, p_customer_name, p_order_type, 'confirmed', v_token_number,
                p_order_source, p_notes, false, 0, 0, 0)
            RETURNING id INTO v_bill_id;

            -- Mark table as occupied
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

    -- Get tax rate from settings
    SELECT COALESCE(value::numeric, 0) INTO v_tax_rate
    FROM settings
    WHERE org_id = v_org_id AND key = 'tax_rate'
    LIMIT 1;

    -- Create the order
    INSERT INTO orders (
        org_id, location_id, order_number, table_id, user_id,
        customer_id, customer_name, order_type, status,
        token_number, order_source, notes,
        parent_order_id, is_kot, kot_number,
        subtotal, tax_amount, discount_amount, total_amount
    ) VALUES (
        v_org_id, v_location_id, v_order_number, p_table_id, v_user_id,
        p_customer_id, p_customer_name, p_order_type, v_status,
        v_token_number, p_order_source, p_notes,
        CASE WHEN v_is_kot THEN v_bill_id ELSE NULL END,
        v_is_kot, v_kot_number,
        0, 0, 0, 0
    ) RETURNING id INTO v_order_id;

    -- Mark table as occupied (if not KOT, which already handled it above)
    IF p_table_id IS NOT NULL AND NOT v_is_kot THEN
        UPDATE dining_tables SET is_occupied = true, status = 'occupied' WHERE id = p_table_id;
    END IF;

    -- Insert order items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        -- Get product details
        SELECT id, name, price INTO v_product
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

        -- Insert selected options
        IF v_item->'selected_options' IS NOT NULL THEN
            FOR v_option IN SELECT * FROM jsonb_array_elements(v_item->'selected_options') LOOP
                INSERT INTO order_item_options (order_item_id, option_group_name, option_item_name, price_adjustment)
                VALUES (v_item_id, v_option->>'option_group_name', v_option->>'option_item_name',
                    COALESCE((v_option->>'price_adjustment')::numeric, 0));
                v_item_total := v_item_total + COALESCE((v_option->>'price_adjustment')::numeric, 0) * (v_item->>'quantity')::integer;
            END LOOP;
            -- Update item total with options
            UPDATE order_items SET total_price = v_item_total WHERE id = v_item_id;
        END IF;

        -- Insert combo choices
        IF v_item->'combo_choices' IS NOT NULL THEN
            FOR v_combo IN SELECT * FROM jsonb_array_elements(v_item->'combo_choices') LOOP
                INSERT INTO order_item_combo_choices (order_item_id, slot_name, product_id, product_name, price_adjustment, selected_options)
                VALUES (v_item_id, v_combo->>'slot_name', (v_combo->>'product_id')::uuid,
                    v_combo->>'product_name', COALESCE((v_combo->>'price_adjustment')::numeric, 0),
                    COALESCE(v_combo->'selected_options', '[]'::jsonb));
                v_item_total := v_item_total + COALESCE((v_combo->>'price_adjustment')::numeric, 0);
            END LOOP;
            UPDATE order_items SET total_price = v_item_total WHERE id = v_item_id;
        END IF;

        v_subtotal := v_subtotal + v_item_total;
    END LOOP;

    -- Calculate totals
    v_tax_amount := ROUND(v_subtotal * v_tax_rate / 100, 2);
    v_total_amount := v_subtotal + v_tax_amount;

    -- Update order with calculated totals
    UPDATE orders SET
        subtotal = v_subtotal,
        tax_amount = v_tax_amount,
        total_amount = v_total_amount
    WHERE id = v_order_id;

    -- If KOT, update parent bill totals
    IF v_is_kot AND v_bill_id IS NOT NULL THEN
        UPDATE orders SET
            subtotal = (SELECT COALESCE(SUM(subtotal), 0) FROM orders WHERE parent_order_id = v_bill_id),
            tax_amount = (SELECT COALESCE(SUM(tax_amount), 0) FROM orders WHERE parent_order_id = v_bill_id),
            total_amount = (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE parent_order_id = v_bill_id)
        WHERE id = v_bill_id;
    END IF;

    -- Return the created order
    RETURN jsonb_build_object(
        'success', true,
        'data', (
            SELECT row_to_json(o) FROM (
                SELECT o.*, json_agg(
                    json_build_object(
                        'id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity,
                        'unit_price', oi.unit_price, 'total_price', oi.total_price,
                        'special_instructions', oi.special_instructions, 'status', oi.status
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

-- =============================================
-- PROCESS PAYMENT
-- Replaces payments.go ProcessPayment
-- =============================================
CREATE OR REPLACE FUNCTION public.process_payment(
    p_order_id uuid,
    p_payment_method text,
    p_amount numeric,
    p_reference_number text DEFAULT NULL,
    p_cash_received numeric DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_org_id uuid;
    v_user_id uuid;
    v_order record;
    v_total_paid numeric;
    v_payment_id uuid;
    v_change_amount numeric;
BEGIN
    v_org_id := public.get_my_org_id();
    v_user_id := public.get_my_user_id();

    -- Get order and validate
    SELECT * INTO v_order FROM orders WHERE id = p_order_id AND org_id = v_org_id;

    IF v_order IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    IF v_order.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot pay for cancelled order');
    END IF;

    -- Check total already paid
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM payments WHERE order_id = p_order_id AND status = 'completed';

    IF v_total_paid >= v_order.total_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order already fully paid');
    END IF;

    -- Calculate change for cash payments
    v_change_amount := CASE
        WHEN p_payment_method = 'cash' AND p_cash_received IS NOT NULL
        THEN GREATEST(p_cash_received - p_amount, 0)
        ELSE NULL
    END;

    -- Insert payment
    INSERT INTO payments (org_id, order_id, payment_method, amount, cash_received, change_amount,
        reference_number, status, processed_by, processed_at)
    VALUES (v_org_id, p_order_id, p_payment_method, p_amount, p_cash_received, v_change_amount,
        p_reference_number, 'completed', v_user_id, CURRENT_TIMESTAMP)
    RETURNING id INTO v_payment_id;

    -- Check if fully paid
    v_total_paid := v_total_paid + p_amount;
    IF v_total_paid >= v_order.total_amount THEN
        UPDATE orders SET paid_at = CURRENT_TIMESTAMP, status = 'paid' WHERE id = p_order_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'data', (SELECT row_to_json(p) FROM payments p WHERE p.id = v_payment_id),
        'is_fully_paid', v_total_paid >= v_order.total_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- UPDATE ORDER STATUS
-- With status transition validation + timestamp updates
-- =============================================
CREATE OR REPLACE FUNCTION public.update_order_status(
    p_order_id uuid,
    p_new_status text,
    p_notes text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_org_id uuid;
    v_user_id uuid;
    v_order record;
BEGIN
    v_org_id := public.get_my_org_id();
    v_user_id := public.get_my_user_id();

    SELECT * INTO v_order FROM orders WHERE id = p_order_id AND org_id = v_org_id;

    IF v_order IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    -- Record status history
    INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by, notes)
    VALUES (p_order_id, v_order.status, p_new_status, v_user_id, p_notes);

    -- Update order with status-specific timestamps
    UPDATE orders SET
        status = p_new_status,
        confirmed_at = CASE WHEN p_new_status = 'confirmed' THEN CURRENT_TIMESTAMP ELSE confirmed_at END,
        preparing_at = CASE WHEN p_new_status = 'preparing' THEN CURRENT_TIMESTAMP ELSE preparing_at END,
        ready_at = CASE WHEN p_new_status = 'ready' THEN CURRENT_TIMESTAMP ELSE ready_at END,
        served_at = CASE WHEN p_new_status = 'served' THEN CURRENT_TIMESTAMP ELSE served_at END,
        paid_at = CASE WHEN p_new_status = 'paid' THEN CURRENT_TIMESTAMP ELSE paid_at END,
        completed_at = CASE WHEN p_new_status = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
        cleared_at = CASE WHEN p_new_status = 'completed' THEN CURRENT_TIMESTAMP ELSE cleared_at END,
        notes = CASE WHEN p_notes IS NOT NULL THEN p_notes ELSE notes END
    WHERE id = p_order_id;

    -- If completed/cancelled and dine-in, check if table should be freed
    IF p_new_status IN ('completed', 'cancelled') AND v_order.table_id IS NOT NULL THEN
        -- Only free table if no other active orders
        IF NOT EXISTS (
            SELECT 1 FROM orders
            WHERE table_id = v_order.table_id
            AND id != p_order_id
            AND status NOT IN ('completed', 'cancelled', 'paid')
            AND parent_order_id IS NULL
        ) THEN
            UPDATE dining_tables SET is_occupied = false, status = 'available'
            WHERE id = v_order.table_id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'data', (SELECT row_to_json(o) FROM orders o WHERE o.id = p_order_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- GET BILL SUMMARY (KOT Support)
-- Aggregates parent bill + child KOTs
-- =============================================
CREATE OR REPLACE FUNCTION public.get_bill_summary(p_order_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_org_id uuid;
    v_bill record;
    v_kots jsonb;
    v_paid_amount numeric;
BEGIN
    v_org_id := public.get_my_org_id();

    SELECT * INTO v_bill FROM orders WHERE id = p_order_id AND org_id = v_org_id;

    IF v_bill IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    -- Get KOTs
    SELECT COALESCE(jsonb_agg(row_to_json(k)), '[]'::jsonb) INTO v_kots
    FROM (
        SELECT o.*, (
            SELECT COALESCE(json_agg(json_build_object(
                'id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity,
                'unit_price', oi.unit_price, 'total_price', oi.total_price,
                'special_instructions', oi.special_instructions, 'status', oi.status,
                'product', json_build_object('id', p.id, 'name', p.name)
            )), '[]'::json) as items
            FROM order_items oi
            LEFT JOIN products p ON p.id = oi.product_id
            WHERE oi.order_id = o.id
        )
        FROM orders o
        WHERE o.parent_order_id = p_order_id
        ORDER BY o.created_at
    ) k;

    -- Get total paid
    SELECT COALESCE(SUM(amount), 0) INTO v_paid_amount
    FROM payments WHERE order_id = p_order_id AND status = 'completed';

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'bill', row_to_json(v_bill),
            'kots', v_kots,
            'total_items', (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi
                JOIN orders o ON o.id = oi.order_id
                WHERE o.parent_order_id = p_order_id OR o.id = p_order_id),
            'aggregated_subtotal', (SELECT COALESCE(SUM(subtotal), 0) FROM orders WHERE parent_order_id = p_order_id),
            'aggregated_tax', (SELECT COALESCE(SUM(tax_amount), 0) FROM orders WHERE parent_order_id = p_order_id),
            'aggregated_total', (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE parent_order_id = p_order_id),
            'paid_amount', v_paid_amount,
            'is_bill_closed', v_bill.status IN ('paid', 'completed')
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- GET DASHBOARD STATS
-- =============================================
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS jsonb AS $$
DECLARE
    v_org_id uuid;
    v_location_id uuid;
BEGIN
    v_org_id := public.get_my_org_id();
    v_location_id := public.get_my_location_id();

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'today_orders', (
                SELECT COUNT(*) FROM orders
                WHERE org_id = v_org_id
                AND (v_location_id IS NULL OR location_id = v_location_id)
                AND created_at::date = CURRENT_DATE
                AND parent_order_id IS NULL
                AND status != 'cancelled'
            ),
            'today_revenue', (
                SELECT COALESCE(SUM(total_amount), 0) FROM orders
                WHERE org_id = v_org_id
                AND (v_location_id IS NULL OR location_id = v_location_id)
                AND created_at::date = CURRENT_DATE
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
-- GET SALES REPORT
-- =============================================
CREATE OR REPLACE FUNCTION public.get_sales_report(p_period text DEFAULT 'today')
RETURNS jsonb AS $$
DECLARE
    v_org_id uuid;
    v_location_id uuid;
    v_start_date date;
BEGIN
    v_org_id := public.get_my_org_id();
    v_location_id := public.get_my_location_id();

    v_start_date := CASE p_period
        WHEN 'today' THEN CURRENT_DATE
        WHEN 'week' THEN CURRENT_DATE - interval '7 days'
        WHEN 'month' THEN CURRENT_DATE - interval '30 days'
        ELSE CURRENT_DATE
    END;

    RETURN jsonb_build_object(
        'success', true,
        'data', (
            SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
            FROM (
                SELECT
                    created_at::date as date,
                    COUNT(*) as order_count,
                    SUM(total_amount) as revenue
                FROM orders
                WHERE org_id = v_org_id
                AND (v_location_id IS NULL OR location_id = v_location_id)
                AND created_at::date >= v_start_date
                AND parent_order_id IS NULL
                AND status NOT IN ('cancelled')
                GROUP BY created_at::date
                ORDER BY created_at::date
            ) r
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- GET INCOME REPORT
-- =============================================
CREATE OR REPLACE FUNCTION public.get_income_report(p_period text DEFAULT 'month')
RETURNS jsonb AS $$
DECLARE
    v_org_id uuid;
    v_location_id uuid;
    v_start_date date;
BEGIN
    v_org_id := public.get_my_org_id();
    v_location_id := public.get_my_location_id();

    v_start_date := CASE p_period
        WHEN 'today' THEN CURRENT_DATE
        WHEN 'week' THEN CURRENT_DATE - interval '7 days'
        WHEN 'month' THEN CURRENT_DATE - interval '30 days'
        ELSE CURRENT_DATE - interval '30 days'
    END;

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'summary', (
                SELECT row_to_json(s) FROM (
                    SELECT
                        COUNT(*) as total_orders,
                        COALESCE(SUM(total_amount), 0) as gross_income,
                        COALESCE(SUM(tax_amount), 0) as tax_collected,
                        COALESCE(SUM(total_amount - tax_amount), 0) as net_income
                    FROM orders
                    WHERE org_id = v_org_id
                    AND (v_location_id IS NULL OR location_id = v_location_id)
                    AND created_at::date >= v_start_date
                    AND parent_order_id IS NULL
                    AND status NOT IN ('cancelled')
                ) s
            ),
            'breakdown', (
                SELECT COALESCE(jsonb_agg(row_to_json(b)), '[]'::jsonb)
                FROM (
                    SELECT
                        created_at::date as period,
                        COUNT(*) as orders,
                        COALESCE(SUM(total_amount), 0) as gross,
                        COALESCE(SUM(tax_amount), 0) as tax,
                        COALESCE(SUM(total_amount - tax_amount), 0) as net
                    FROM orders
                    WHERE org_id = v_org_id
                    AND (v_location_id IS NULL OR location_id = v_location_id)
                    AND created_at::date >= v_start_date
                    AND parent_order_id IS NULL
                    AND status NOT IN ('cancelled')
                    GROUP BY created_at::date
                    ORDER BY created_at::date
                ) b
            ),
            'period', p_period
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- GET ORDERS REPORT
-- =============================================
CREATE OR REPLACE FUNCTION public.get_orders_report()
RETURNS jsonb AS $$
DECLARE
    v_org_id uuid;
    v_location_id uuid;
BEGIN
    v_org_id := public.get_my_org_id();
    v_location_id := public.get_my_location_id();

    RETURN jsonb_build_object(
        'success', true,
        'data', (
            SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
            FROM (
                SELECT
                    status,
                    COUNT(*) as count,
                    ROUND(AVG(total_amount), 2) as avg_amount
                FROM orders
                WHERE org_id = v_org_id
                AND (v_location_id IS NULL OR location_id = v_location_id)
                AND parent_order_id IS NULL
                GROUP BY status
                ORDER BY count DESC
            ) r
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- CLEAR TABLE
-- =============================================
CREATE OR REPLACE FUNCTION public.clear_table(p_table_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_org_id uuid;
BEGIN
    v_org_id := public.get_my_org_id();

    -- Mark all active orders on this table as completed
    UPDATE orders SET status = 'completed', completed_at = CURRENT_TIMESTAMP, cleared_at = CURRENT_TIMESTAMP
    WHERE table_id = p_table_id AND org_id = v_org_id
    AND status NOT IN ('completed', 'cancelled')
    AND parent_order_id IS NULL;

    -- Free the table
    UPDATE dining_tables SET is_occupied = false, status = 'available'
    WHERE id = p_table_id AND org_id = v_org_id;

    RETURN jsonb_build_object('success', true, 'message', 'Table cleared');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TRANSFER TABLE
-- =============================================
CREATE OR REPLACE FUNCTION public.transfer_table(p_from_table_id uuid, p_to_table_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_org_id uuid;
BEGIN
    v_org_id := public.get_my_org_id();

    -- Move active orders to new table
    UPDATE orders SET table_id = p_to_table_id
    WHERE table_id = p_from_table_id AND org_id = v_org_id
    AND status NOT IN ('completed', 'cancelled')
    AND parent_order_id IS NULL;

    -- Update table statuses
    UPDATE dining_tables SET is_occupied = false, status = 'available'
    WHERE id = p_from_table_id AND org_id = v_org_id;

    UPDATE dining_tables SET is_occupied = true, status = 'occupied'
    WHERE id = p_to_table_id AND org_id = v_org_id;

    RETURN jsonb_build_object('success', true, 'message', 'Orders transferred');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- SETUP: CHECK STATUS
-- =============================================
CREATE OR REPLACE FUNCTION public.check_setup_status()
RETURNS jsonb AS $$
BEGIN
    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'needs_setup', (SELECT COUNT(*) = 0 FROM users WHERE role = 'admin'),
            'has_admin', (SELECT COUNT(*) > 0 FROM users WHERE role = 'admin'),
            'total_users', (SELECT COUNT(*) FROM users)
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- GRANT EXECUTE TO AUTHENTICATED USERS
-- =============================================
GRANT EXECUTE ON FUNCTION public.create_order TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_payment TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_bill_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sales_report TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_income_report TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_orders_report TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_table TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_table TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_setup_status TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_order_number TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_token_number TO authenticated;
