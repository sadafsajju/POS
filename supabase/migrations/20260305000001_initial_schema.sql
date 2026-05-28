-- =============================================
-- POS System: Consolidated Schema for Supabase
-- Combines all 25+ migrations into a single baseline
-- =============================================

-- gen_random_uuid() is built-in on Supabase (pgcrypto), no extension needed

-- =============================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TENANTS (Multi-Tenant SaaS)
-- =============================================
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name VARCHAR(200) NOT NULL,
    subdomain VARCHAR(50) UNIQUE NOT NULL,
    domain VARCHAR(200),
    plan VARCHAR(20) NOT NULL CHECK (plan IN ('trial', 'basic', 'pro', 'enterprise')) DEFAULT 'trial',
    subscription_status VARCHAR(20) NOT NULL CHECK (subscription_status IN ('active', 'suspended', 'cancelled', 'expired')) DEFAULT 'active',
    trial_ends_at TIMESTAMPTZ,
    billing_email VARCHAR(100) NOT NULL,
    max_locations INTEGER DEFAULT 1,
    max_users INTEGER DEFAULT 5,
    max_products INTEGER DEFAULT 100,
    contact_name VARCHAR(100),
    contact_phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    postal_code VARCHAR(20),
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    swiggy_enabled BOOLEAN DEFAULT false,
    zomato_enabled BOOLEAN DEFAULT false,
    settings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    onboarding_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_tenants_subdomain ON tenants(subdomain) WHERE deleted_at IS NULL;
CREATE INDEX idx_tenants_domain ON tenants(domain) WHERE domain IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_tenants_status ON tenants(subscription_status) WHERE is_active = true;

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ORGANIZATIONS
-- =============================================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    logo_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- LOCATIONS
-- =============================================
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    phone VARCHAR(20),
    email VARCHAR(100),
    operating_hours JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, code)
);

CREATE INDEX idx_locations_org ON locations(org_id);
CREATE INDEX idx_locations_tenant ON locations(tenant_id) WHERE is_active = true;

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- USERS
-- =============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE, -- Links to Supabase auth.users
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255), -- Kept for offline/PIN auth fallback
    pin_hash VARCHAR(255),
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'manager', 'server', 'counter', 'kitchen')),
    is_active BOOLEAN DEFAULT true,
    org_id UUID NOT NULL REFERENCES organizations(id),
    location_id UUID REFERENCES locations(id),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    auth_provider VARCHAR(20) DEFAULT 'supabase' CHECK (auth_provider IN ('internal', 'supabase')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, username),
    UNIQUE(org_id, email)
);

CREATE INDEX idx_users_org_location ON users(org_id, location_id);
CREATE INDEX idx_users_auth_user_id ON users(auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX idx_users_tenant ON users(tenant_id);

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- USER-LOCATION ASSIGNMENTS (Multi-Location)
-- =============================================
CREATE TABLE user_location_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, location_id)
);

CREATE INDEX idx_user_locations_user ON user_location_assignments(user_id);
CREATE INDEX idx_user_locations_location ON user_location_assignments(location_id);

-- =============================================
-- CATEGORIES
-- =============================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_categories_org ON categories(org_id);
CREATE INDEX idx_categories_tenant ON categories(tenant_id);

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- PRODUCTS
-- =============================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image_url VARCHAR(500),
    barcode VARCHAR(50),
    sku VARCHAR(50),
    is_available BOOLEAN DEFAULT true,
    preparation_time INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    dietary_type VARCHAR(20) CHECK (dietary_type IN ('veg', 'non-veg', 'egg', 'vegan')),
    calorie_count INTEGER,
    food_allergens TEXT,
    product_type VARCHAR(20) DEFAULT 'simple' CHECK (product_type IN ('simple', 'configurable', 'combo')),
    has_option_groups BOOLEAN DEFAULT false,
    min_variation_price DECIMAL(10,2),
    max_variation_price DECIMAL(10,2),
    location_ids UUID[], -- NULL = all locations, array = specific locations
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, sku)
);

CREATE INDEX idx_products_org ON products(org_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_available ON products(is_available);
CREATE INDEX idx_products_tenant ON products(tenant_id);
CREATE INDEX idx_products_location_ids ON products USING GIN (location_ids);

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- PRODUCT OPTION GROUPS & ITEMS
-- =============================================
CREATE TABLE product_option_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    selection_type VARCHAR(10) NOT NULL CHECK (selection_type IN ('single', 'multiple')),
    is_required BOOLEAN DEFAULT false,
    min_selections INTEGER DEFAULT 0,
    max_selections INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_option_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    option_group_id UUID NOT NULL REFERENCES product_option_groups(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price_adjustment DECIMAL(10,2) DEFAULT 0,
    is_default BOOLEAN DEFAULT false,
    is_available BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_option_groups_product ON product_option_groups(product_id);
CREATE INDEX idx_option_items_group ON product_option_items(option_group_id);

CREATE TRIGGER update_product_option_groups_updated_at BEFORE UPDATE ON product_option_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_option_items_updated_at BEFORE UPDATE ON product_option_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- GLOBAL VARIATION GROUPS
-- =============================================
CREATE TABLE variation_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    selection_type VARCHAR(10) NOT NULL CHECK (selection_type IN ('single', 'multiple')),
    is_required BOOLEAN DEFAULT false,
    min_selections INTEGER DEFAULT 0,
    max_selections INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE variation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variation_group_id UUID NOT NULL REFERENCES variation_groups(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price_adjustment DECIMAL(10,2) DEFAULT 0,
    is_default BOOLEAN DEFAULT false,
    is_available BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_variations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variation_group_id UUID NOT NULL REFERENCES variation_groups(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, variation_group_id)
);

CREATE TABLE product_variation_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variation_item_id UUID NOT NULL REFERENCES variation_items(id) ON DELETE CASCADE,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, variation_item_id)
);

CREATE INDEX idx_variation_groups_org ON variation_groups(org_id);
CREATE INDEX idx_variation_items_group ON variation_items(variation_group_id);
CREATE INDEX idx_product_variations_product ON product_variations(product_id);
CREATE INDEX idx_product_variations_group ON product_variations(variation_group_id);

CREATE TRIGGER update_variation_groups_updated_at BEFORE UPDATE ON variation_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_variation_items_updated_at BEFORE UPDATE ON variation_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- COMBO PRODUCTS
-- =============================================
CREATE TABLE combo_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_required BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE combo_slot_choices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    combo_slot_id UUID NOT NULL REFERENCES combo_slots(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variation_item_id UUID REFERENCES variation_items(id) ON DELETE SET NULL,
    price_override DECIMAL(10,2),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_combo_slots_product ON combo_slots(product_id);
CREATE INDEX idx_combo_slot_choices_slot ON combo_slot_choices(combo_slot_id);

CREATE TRIGGER update_combo_slots_updated_at BEFORE UPDATE ON combo_slots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_combo_slot_choices_updated_at BEFORE UPDATE ON combo_slot_choices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- DINING TABLES
-- =============================================
CREATE TABLE dining_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id),
    table_number VARCHAR(20) NOT NULL,
    seating_capacity INTEGER DEFAULT 4,
    location VARCHAR(50), -- area name (e.g., 'patio')
    floor VARCHAR(50),
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'maintenance')),
    is_occupied BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(location_id, table_number)
);

CREATE INDEX idx_dining_tables_org_location ON dining_tables(org_id, location_id);
CREATE INDEX idx_dining_tables_tenant ON dining_tables(tenant_id);

CREATE TRIGGER update_dining_tables_updated_at BEFORE UPDATE ON dining_tables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- CUSTOMERS
-- =============================================
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    name VARCHAR(100),
    email VARCHAR(100),
    address TEXT,
    notes TEXT,
    total_orders INTEGER DEFAULT 0,
    total_spent DECIMAL(12,2) DEFAULT 0,
    last_order_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, phone)
);

CREATE INDEX idx_customers_org ON customers(org_id);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_tenant ON customers(tenant_id);

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ORDERS
-- =============================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id),
    order_number VARCHAR(20) UNIQUE NOT NULL,
    table_id UUID REFERENCES dining_tables(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(100),
    order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('dine_in', 'takeout', 'delivery')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'served', 'paid', 'completed', 'cancelled')),
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    notes TEXT,
    -- KOT support
    parent_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    is_kot BOOLEAN DEFAULT false,
    kot_number VARCHAR(20),
    token_number INTEGER,
    -- Aggregator fields
    order_source VARCHAR(20) DEFAULT 'pos'
        CHECK (order_source IN ('pos', 'swiggy', 'zomato', 'kiosk', 'customer_app')),
    external_order_id VARCHAR(100),
    external_data JSONB,
    delivery_partner_name VARCHAR(100),
    delivery_partner_phone VARCHAR(20),
    aggregator_confirmed_at TIMESTAMPTZ,
    accept_deadline TIMESTAMPTZ,
    -- Customer session
    session_id UUID,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    served_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    preparing_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    cleared_at TIMESTAMPTZ
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_table_id ON orders(table_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_org_location ON orders(org_id, location_id);
CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_orders_external_order_id ON orders(external_order_id) WHERE external_order_id IS NOT NULL;
CREATE INDEX idx_orders_order_source ON orders(order_source) WHERE order_source != 'pos';
CREATE INDEX idx_orders_parent ON orders(parent_order_id) WHERE parent_order_id IS NOT NULL;

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ORDER ITEMS
-- =============================================
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    special_instructions TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'preparing', 'ready', 'served')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

CREATE TRIGGER update_order_items_updated_at BEFORE UPDATE ON order_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Order Item Options (denormalized snapshot)
CREATE TABLE order_item_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    option_group_name VARCHAR(100) NOT NULL,
    option_item_name VARCHAR(100) NOT NULL,
    price_adjustment DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_item_options_item ON order_item_options(order_item_id);

-- Order Item Combo Choices (denormalized snapshot)
CREATE TABLE order_item_combo_choices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    slot_name VARCHAR(100) NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(100) NOT NULL,
    price_adjustment DECIMAL(10,2) DEFAULT 0,
    selected_options JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_combo_choices_item ON order_item_combo_choices(order_item_id);

-- =============================================
-- PAYMENTS
-- =============================================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    payment_method VARCHAR(20) NOT NULL
        CHECK (payment_method IN ('cash', 'credit_card', 'debit_card', 'digital_wallet')),
    amount DECIMAL(10,2) NOT NULL,
    cash_received DECIMAL(10,2),
    change_amount DECIMAL(10,2),
    reference_number VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_tenant ON payments(tenant_id);

-- =============================================
-- INVENTORY
-- =============================================
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id),
    current_stock INTEGER NOT NULL DEFAULT 0,
    minimum_stock INTEGER DEFAULT 0,
    maximum_stock INTEGER DEFAULT 0,
    unit_cost DECIMAL(10,2),
    last_restocked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_inventory_product ON inventory(product_id);
CREATE INDEX idx_inventory_location ON inventory(location_id);

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ORDER STATUS HISTORY
-- =============================================
CREATE TABLE order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    previous_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- SETTINGS (Key-Value)
-- =============================================
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id),
    key VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, location_id, key)
);

CREATE INDEX idx_settings_org_location ON settings(org_id, location_id);
CREATE INDEX idx_settings_tenant ON settings(tenant_id);

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- PLATFORM CONFIGS (Swiggy/Zomato)
-- =============================================
CREATE TABLE platform_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id),
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('swiggy', 'zomato')),
    is_enabled BOOLEAN DEFAULT false,
    api_key VARCHAR(500),
    api_secret VARCHAR(500),
    webhook_secret VARCHAR(500),
    restaurant_id VARCHAR(100),
    config_data JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(location_id, platform)
);

CREATE INDEX idx_platform_configs_org_location ON platform_configs(org_id, location_id);
CREATE INDEX idx_platform_configs_tenant ON platform_configs(tenant_id);

CREATE TRIGGER update_platform_configs_updated_at BEFORE UPDATE ON platform_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- LOCATION PRODUCTS (Per-Location Overrides)
-- =============================================
CREATE TABLE location_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    price_override DECIMAL(10,2),
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(location_id, product_id)
);

CREATE INDEX idx_location_products_location ON location_products(location_id, product_id);

CREATE TRIGGER update_location_products_updated_at BEFORE UPDATE ON location_products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- PROMOS
-- =============================================
CREATE TABLE promos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(200),
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('image', 'video')) DEFAULT 'image',
    file_url VARCHAR(500) NOT NULL,
    display_order INT DEFAULT 0,
    duration_seconds INT DEFAULT 5,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_promos_active ON promos(org_id, is_active, display_order);

CREATE TRIGGER update_promos_updated_at BEFORE UPDATE ON promos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- MEDIA LIBRARY
-- =============================================
CREATE TABLE media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id),
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255),
    file_url VARCHAR(500) NOT NULL,
    file_size BIGINT DEFAULT 0,
    mime_type VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_media_org ON media(org_id, created_at DESC);

-- =============================================
-- CUSTOMER SESSIONS (QR Code Ordering)
-- =============================================
CREATE TABLE customer_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id),
    table_id UUID NOT NULL REFERENCES dining_tables(id) ON DELETE CASCADE,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT true,
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add FK from orders.session_id now that customer_sessions exists
ALTER TABLE orders ADD CONSTRAINT orders_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES customer_sessions(id) ON DELETE SET NULL;
CREATE INDEX idx_orders_session_id ON orders(session_id) WHERE session_id IS NOT NULL;

CREATE INDEX idx_customer_sessions_table ON customer_sessions(table_id);
CREATE INDEX idx_customer_sessions_token ON customer_sessions(session_token);
CREATE INDEX idx_customer_sessions_active ON customer_sessions(is_active, expires_at);

CREATE TRIGGER update_customer_sessions_updated_at BEFORE UPDATE ON customer_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- TABLE QR CODES
-- =============================================
CREATE TABLE table_qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id),
    table_id UUID NOT NULL REFERENCES dining_tables(id) ON DELETE CASCADE,
    qr_token VARCHAR(255) NOT NULL UNIQUE,
    qr_data TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_scanned_at TIMESTAMPTZ,
    scan_count INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_table_qr_codes_table ON table_qr_codes(table_id);
CREATE INDEX idx_table_qr_codes_token ON table_qr_codes(qr_token);
CREATE INDEX idx_table_qr_codes_active ON table_qr_codes(is_active);
CREATE UNIQUE INDEX unique_active_qr_per_table ON table_qr_codes(table_id) WHERE is_active = true;

CREATE TRIGGER update_table_qr_codes_updated_at BEFORE UPDATE ON table_qr_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Cleanup expired customer sessions
CREATE OR REPLACE FUNCTION cleanup_expired_customer_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    UPDATE customer_sessions
    SET is_active = false
    WHERE is_active = true AND expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Generate session token
CREATE OR REPLACE FUNCTION generate_session_token()
RETURNS VARCHAR(255) AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Get tenant by subdomain
CREATE OR REPLACE FUNCTION get_tenant_by_subdomain(p_subdomain VARCHAR)
RETURNS TABLE (
    tenant_id UUID,
    business_name VARCHAR,
    plan VARCHAR,
    subscription_status VARCHAR,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.business_name, t.plan, t.subscription_status, t.is_active
    FROM tenants t
    WHERE t.subdomain = p_subdomain AND t.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Check tenant limits
CREATE OR REPLACE FUNCTION check_tenant_limits(
    p_tenant_id UUID,
    p_check_type VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    v_max_allowed INTEGER;
    v_current_count INTEGER;
BEGIN
    SELECT
        CASE p_check_type
            WHEN 'users' THEN max_users
            WHEN 'locations' THEN max_locations
            WHEN 'products' THEN max_products
        END INTO v_max_allowed
    FROM tenants WHERE id = p_tenant_id;

    v_current_count := CASE p_check_type
        WHEN 'users' THEN (SELECT COUNT(*) FROM users WHERE tenant_id = p_tenant_id AND is_active = true)
        WHEN 'locations' THEN (SELECT COUNT(*) FROM locations WHERE tenant_id = p_tenant_id AND is_active = true)
        WHEN 'products' THEN (SELECT COUNT(*) FROM products WHERE tenant_id = p_tenant_id AND is_available = true)
    END;

    RETURN v_current_count < v_max_allowed;
END;
$$ LANGUAGE plpgsql STABLE;
