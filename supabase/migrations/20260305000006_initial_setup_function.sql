-- =============================================
-- INITIAL SETUP FUNCTION
-- Creates org, location, user, and default settings
-- Called after Supabase Auth signUp succeeds
-- =============================================
CREATE OR REPLACE FUNCTION public.initial_setup(
    p_auth_user_id UUID,
    p_username TEXT,
    p_email TEXT,
    p_first_name TEXT,
    p_last_name TEXT,
    p_pin TEXT DEFAULT NULL,
    p_store_name TEXT DEFAULT 'My Store',
    p_location_name TEXT DEFAULT 'Main Branch',
    p_location_code TEXT DEFAULT 'MAIN',
    p_currency TEXT DEFAULT 'USD',
    p_currency_symbol TEXT DEFAULT '$',
    p_tax_rate TEXT DEFAULT '10'
)
RETURNS jsonb AS $$
DECLARE
    v_org_id UUID;
    v_location_id UUID;
    v_user_id UUID;
    v_slug TEXT;
    v_pin_hash TEXT;
BEGIN
    -- Generate a URL-safe slug from the store name
    v_slug := lower(regexp_replace(p_store_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug := trim(both '-' from v_slug);
    -- Ensure uniqueness by appending random chars
    v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 8);

    -- 1. Create organization
    INSERT INTO organizations (name, slug)
    VALUES (p_store_name, v_slug)
    RETURNING id INTO v_org_id;

    -- 2. Create location
    INSERT INTO locations (org_id, name, code)
    VALUES (v_org_id, p_location_name, p_location_code)
    RETURNING id INTO v_location_id;

    -- 3. Hash PIN if provided (using pgcrypto crypt)
    IF p_pin IS NOT NULL AND p_pin != '' THEN
        v_pin_hash := crypt(p_pin, gen_salt('bf'));
    END IF;

    -- 4. Create admin user linked to Supabase auth
    INSERT INTO users (auth_user_id, username, email, first_name, last_name, role, org_id, location_id, pin_hash, auth_provider, is_active)
    VALUES (p_auth_user_id, p_username, p_email, p_first_name, p_last_name, 'admin', v_org_id, v_location_id, v_pin_hash, 'supabase', true)
    RETURNING id INTO v_user_id;

    -- 5. Update auth.users app_metadata so the JWT hook can inject claims
    UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data ||
        jsonb_build_object(
            'org_id', v_org_id,
            'role', 'admin',
            'location_id', v_location_id,
            'user_id', v_user_id,
            'tenant_id', NULL
        )
    WHERE id = p_auth_user_id;

    -- 6. Insert default settings
    INSERT INTO settings (org_id, key, value, description) VALUES
        (v_org_id, 'currency', p_currency, 'Default currency code'),
        (v_org_id, 'currency_symbol', p_currency_symbol, 'Currency symbol for display'),
        (v_org_id, 'tax_rate', p_tax_rate, 'Default tax rate percentage'),
        (v_org_id, 'store_name', p_store_name, 'Business name'),
        (v_org_id, 'theme', 'light', 'UI theme'),
        (v_org_id, 'touch_mode', 'false', 'Touch screen mode');

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'org_id', v_org_id,
            'location_id', v_location_id,
            'user_id', v_user_id
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant to authenticated users (must be signed in via Supabase Auth to call)
GRANT EXECUTE ON FUNCTION public.initial_setup TO authenticated;
