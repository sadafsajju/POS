-- =============================================
-- RLS Policies for Supabase
-- Uses auth.jwt() claims instead of app.tenant_id session var
-- =============================================

-- Helper functions to extract claims from JWT
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS uuid AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
    (SELECT org_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    (SELECT role FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_my_location_id()
RETURNS uuid AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'location_id')::uuid,
    (SELECT location_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_my_user_id()
RETURNS uuid AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'user_id')::uuid,
    (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_option_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE variation_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE variation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variation_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_slot_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_combo_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_location_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ORGANIZATIONS: All authenticated users in same org
-- =============================================
CREATE POLICY "org_select" ON organizations
    FOR SELECT TO authenticated
    USING (id = public.get_my_org_id());

CREATE POLICY "org_update" ON organizations
    FOR UPDATE TO authenticated
    USING (id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'manager'));

-- =============================================
-- USERS: Admin/manager see all in org; others see self
-- =============================================
CREATE POLICY "users_select" ON users
    FOR SELECT TO authenticated
    USING (org_id = public.get_my_org_id());

CREATE POLICY "users_insert" ON users
    FOR INSERT TO authenticated
    WITH CHECK (org_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'manager'));

CREATE POLICY "users_update" ON users
    FOR UPDATE TO authenticated
    USING (org_id = public.get_my_org_id() AND (
        public.get_my_role() IN ('admin', 'manager') OR id = public.get_my_user_id()
    ));

CREATE POLICY "users_delete" ON users
    FOR DELETE TO authenticated
    USING (org_id = public.get_my_org_id() AND public.get_my_role() = 'admin');

-- =============================================
-- LOCATIONS: All authenticated in same org
-- =============================================
CREATE POLICY "locations_select" ON locations
    FOR SELECT TO authenticated
    USING (org_id = public.get_my_org_id());

CREATE POLICY "locations_insert" ON locations
    FOR INSERT TO authenticated
    WITH CHECK (org_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'manager'));

CREATE POLICY "locations_update" ON locations
    FOR UPDATE TO authenticated
    USING (org_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'manager'));

CREATE POLICY "locations_delete" ON locations
    FOR DELETE TO authenticated
    USING (org_id = public.get_my_org_id() AND public.get_my_role() = 'admin');

-- =============================================
-- CATEGORIES: All read, admin/manager write
-- =============================================
CREATE POLICY "categories_select" ON categories
    FOR SELECT TO authenticated
    USING (org_id = public.get_my_org_id());

CREATE POLICY "categories_insert" ON categories
    FOR INSERT TO authenticated
    WITH CHECK (org_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'manager'));

CREATE POLICY "categories_update" ON categories
    FOR UPDATE TO authenticated
    USING (org_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'manager'));

CREATE POLICY "categories_delete" ON categories
    FOR DELETE TO authenticated
    USING (org_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'manager'));

-- =============================================
-- PRODUCTS: All read, admin/manager write
-- =============================================
CREATE POLICY "products_select" ON products
    FOR SELECT TO authenticated
    USING (org_id = public.get_my_org_id());

CREATE POLICY "products_insert" ON products
    FOR INSERT TO authenticated
    WITH CHECK (org_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'manager'));

CREATE POLICY "products_update" ON products
    FOR UPDATE TO authenticated
    USING (org_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'manager'));

CREATE POLICY "products_delete" ON products
    FOR DELETE TO authenticated
    USING (org_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'manager'));

-- =============================================
-- PRODUCT OPTIONS: Inherit from product's org
-- =============================================
CREATE POLICY "option_groups_select" ON product_option_groups
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.org_id = public.get_my_org_id()));

CREATE POLICY "option_groups_insert" ON product_option_groups
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.org_id = public.get_my_org_id())
        AND public.get_my_role() IN ('admin', 'manager'));

CREATE POLICY "option_groups_update" ON product_option_groups
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.org_id = public.get_my_org_id())
        AND public.get_my_role() IN ('admin', 'manager'));

CREATE POLICY "option_groups_delete" ON product_option_groups
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.org_id = public.get_my_org_id())
        AND public.get_my_role() IN ('admin', 'manager'));

CREATE POLICY "option_items_select" ON product_option_items
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM product_option_groups g
        JOIN products p ON p.id = g.product_id
        WHERE g.id = option_group_id AND p.org_id = public.get_my_org_id()
    ));

CREATE POLICY "option_items_all" ON product_option_items
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM product_option_groups g
        JOIN products p ON p.id = g.product_id
        WHERE g.id = option_group_id AND p.org_id = public.get_my_org_id()
    ));

-- =============================================
-- VARIATIONS: Org-scoped
-- =============================================
CREATE POLICY "variation_groups_select" ON variation_groups
    FOR SELECT TO authenticated
    USING (org_id = public.get_my_org_id());

CREATE POLICY "variation_groups_all" ON variation_groups
    FOR ALL TO authenticated
    USING (org_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'manager'));

CREATE POLICY "variation_items_select" ON variation_items
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM variation_groups g WHERE g.id = variation_group_id AND g.org_id = public.get_my_org_id()));

CREATE POLICY "variation_items_all" ON variation_items
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM variation_groups g WHERE g.id = variation_group_id AND g.org_id = public.get_my_org_id()));

CREATE POLICY "product_variations_select" ON product_variations
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.org_id = public.get_my_org_id()));

CREATE POLICY "product_variations_all" ON product_variations
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.org_id = public.get_my_org_id()));

CREATE POLICY "product_variation_prices_select" ON product_variation_prices
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.org_id = public.get_my_org_id()));

CREATE POLICY "product_variation_prices_all" ON product_variation_prices
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.org_id = public.get_my_org_id()));

-- =============================================
-- COMBOS: Inherit from product's org
-- =============================================
CREATE POLICY "combo_slots_select" ON combo_slots
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.org_id = public.get_my_org_id()));

CREATE POLICY "combo_slots_all" ON combo_slots
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.org_id = public.get_my_org_id()));

CREATE POLICY "combo_slot_choices_select" ON combo_slot_choices
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM combo_slots s JOIN products p ON p.id = s.product_id
        WHERE s.id = combo_slot_id AND p.org_id = public.get_my_org_id()
    ));

CREATE POLICY "combo_slot_choices_all" ON combo_slot_choices
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM combo_slots s JOIN products p ON p.id = s.product_id
        WHERE s.id = combo_slot_id AND p.org_id = public.get_my_org_id()
    ));

-- =============================================
-- DINING TABLES: All read in org, admin/manager write
-- =============================================
CREATE POLICY "tables_select" ON dining_tables
    FOR SELECT TO authenticated
    USING (org_id = public.get_my_org_id());

CREATE POLICY "tables_insert" ON dining_tables
    FOR INSERT TO authenticated
    WITH CHECK (org_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'manager'));

CREATE POLICY "tables_update" ON dining_tables
    FOR UPDATE TO authenticated
    USING (org_id = public.get_my_org_id());

CREATE POLICY "tables_delete" ON dining_tables
    FOR DELETE TO authenticated
    USING (org_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'manager'));

-- =============================================
-- CUSTOMERS: All in org can CRUD
-- =============================================
CREATE POLICY "customers_select" ON customers
    FOR SELECT TO authenticated
    USING (org_id = public.get_my_org_id());

CREATE POLICY "customers_insert" ON customers
    FOR INSERT TO authenticated
    WITH CHECK (org_id = public.get_my_org_id());

CREATE POLICY "customers_update" ON customers
    FOR UPDATE TO authenticated
    USING (org_id = public.get_my_org_id());

CREATE POLICY "customers_delete" ON customers
    FOR DELETE TO authenticated
    USING (org_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'manager'));

-- =============================================
-- ORDERS: All in org can read, role-based write
-- =============================================
CREATE POLICY "orders_select" ON orders
    FOR SELECT TO authenticated
    USING (org_id = public.get_my_org_id());

CREATE POLICY "orders_insert" ON orders
    FOR INSERT TO authenticated
    WITH CHECK (org_id = public.get_my_org_id());

CREATE POLICY "orders_update" ON orders
    FOR UPDATE TO authenticated
    USING (org_id = public.get_my_org_id());

CREATE POLICY "orders_delete" ON orders
    FOR DELETE TO authenticated
    USING (org_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'manager'));

-- ORDER ITEMS: Inherit from order's org
CREATE POLICY "order_items_select" ON order_items
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.org_id = public.get_my_org_id()));

CREATE POLICY "order_items_all" ON order_items
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.org_id = public.get_my_org_id()));

CREATE POLICY "order_item_options_select" ON order_item_options
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE oi.id = order_item_id AND o.org_id = public.get_my_org_id()
    ));

CREATE POLICY "order_item_options_all" ON order_item_options
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE oi.id = order_item_id AND o.org_id = public.get_my_org_id()
    ));

CREATE POLICY "order_combo_choices_select" ON order_item_combo_choices
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE oi.id = order_item_id AND o.org_id = public.get_my_org_id()
    ));

CREATE POLICY "order_combo_choices_all" ON order_item_combo_choices
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE oi.id = order_item_id AND o.org_id = public.get_my_org_id()
    ));

-- =============================================
-- PAYMENTS: Counter/admin/manager
-- =============================================
CREATE POLICY "payments_select" ON payments
    FOR SELECT TO authenticated
    USING (org_id = public.get_my_org_id());

CREATE POLICY "payments_insert" ON payments
    FOR INSERT TO authenticated
    WITH CHECK (org_id = public.get_my_org_id()
        AND public.get_my_role() IN ('admin', 'manager', 'counter'));

CREATE POLICY "payments_update" ON payments
    FOR UPDATE TO authenticated
    USING (org_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'manager'));

-- =============================================
-- SETTINGS: All read, admin/manager write
-- =============================================
CREATE POLICY "settings_select" ON settings
    FOR SELECT TO authenticated
    USING (org_id = public.get_my_org_id());

CREATE POLICY "settings_insert" ON settings
    FOR INSERT TO authenticated
    WITH CHECK (org_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'manager'));

CREATE POLICY "settings_update" ON settings
    FOR UPDATE TO authenticated
    USING (org_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'manager'));

CREATE POLICY "settings_delete" ON settings
    FOR DELETE TO authenticated
    USING (org_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'manager'));

-- =============================================
-- PLATFORM CONFIGS: Admin/manager only
-- =============================================
CREATE POLICY "platform_configs_select" ON platform_configs
    FOR SELECT TO authenticated
    USING (org_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'manager'));

CREATE POLICY "platform_configs_all" ON platform_configs
    FOR ALL TO authenticated
    USING (org_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'manager'));

-- =============================================
-- LOCATION PRODUCTS: All read, admin/manager write
-- =============================================
CREATE POLICY "location_products_select" ON location_products
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM locations l WHERE l.id = location_id AND l.org_id = public.get_my_org_id()));

CREATE POLICY "location_products_all" ON location_products
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM locations l WHERE l.id = location_id AND l.org_id = public.get_my_org_id())
        AND public.get_my_role() IN ('admin', 'manager'));

-- =============================================
-- PROMOS: All read, admin/manager write
-- =============================================
CREATE POLICY "promos_select" ON promos
    FOR SELECT TO authenticated
    USING (org_id = public.get_my_org_id());

CREATE POLICY "promos_all" ON promos
    FOR ALL TO authenticated
    USING (org_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'manager'));

-- =============================================
-- MEDIA: All read, admin/manager write
-- =============================================
CREATE POLICY "media_select" ON media
    FOR SELECT TO authenticated
    USING (org_id = public.get_my_org_id());

CREATE POLICY "media_all" ON media
    FOR ALL TO authenticated
    USING (org_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'manager'));

-- =============================================
-- CUSTOMER SESSIONS & QR CODES
-- =============================================
CREATE POLICY "sessions_select" ON customer_sessions
    FOR SELECT TO authenticated
    USING (org_id = public.get_my_org_id());

CREATE POLICY "sessions_all" ON customer_sessions
    FOR ALL TO authenticated
    USING (org_id = public.get_my_org_id());

CREATE POLICY "qr_codes_select" ON table_qr_codes
    FOR SELECT TO authenticated
    USING (org_id = public.get_my_org_id());

CREATE POLICY "qr_codes_all" ON table_qr_codes
    FOR ALL TO authenticated
    USING (org_id = public.get_my_org_id());

-- =============================================
-- INVENTORY
-- =============================================
CREATE POLICY "inventory_select" ON inventory
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.org_id = public.get_my_org_id()));

CREATE POLICY "inventory_all" ON inventory
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.org_id = public.get_my_org_id()));

-- =============================================
-- ORDER STATUS HISTORY
-- =============================================
CREATE POLICY "status_history_select" ON order_status_history
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.org_id = public.get_my_org_id()));

CREATE POLICY "status_history_insert" ON order_status_history
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.org_id = public.get_my_org_id()));

-- =============================================
-- USER LOCATION ASSIGNMENTS
-- =============================================
CREATE POLICY "user_locations_select" ON user_location_assignments
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM users u WHERE u.id = user_id AND u.org_id = public.get_my_org_id()));

CREATE POLICY "user_locations_all" ON user_location_assignments
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM users u WHERE u.id = user_id AND u.org_id = public.get_my_org_id())
        AND public.get_my_role() IN ('admin', 'manager'));

-- =============================================
-- TENANTS: Only own tenant visible
-- =============================================
CREATE POLICY "tenants_select" ON tenants
    FOR SELECT TO authenticated
    USING (id = (
        SELECT t.tenant_id FROM users t WHERE t.auth_user_id = auth.uid() LIMIT 1
    ));

-- =============================================
-- GRANT ACCESS TO SUPABASE AUTH ADMIN
-- (Required for auth hook to query users table)
-- =============================================
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT SELECT ON public.users TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.get_my_org_id TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_location_id TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_user_id TO authenticated;
