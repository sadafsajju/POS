-- =============================================
-- Trial System: Wire up tenants table + JWT claims
-- =============================================

-- 1. Override initial_setup to create a tenant record with 14-day trial
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
    v_tenant_id UUID;
    v_slug TEXT;
    v_pin_hash TEXT;
    v_existing_user_id UUID;
    v_trial_ends_at TIMESTAMPTZ;
BEGIN
    -- Guard: prevent duplicate setup for the same auth user
    SELECT id INTO v_existing_user_id FROM users WHERE auth_user_id = p_auth_user_id LIMIT 1;
    IF v_existing_user_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'This account has already been set up.');
    END IF;

    -- Generate a URL-safe slug from the store name
    v_slug := lower(regexp_replace(p_store_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug := trim(both '-' from v_slug);
    v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 8);

    -- Trial ends 14 days from now
    v_trial_ends_at := NOW() + INTERVAL '14 days';

    -- 1. Create organization
    INSERT INTO organizations (name, slug)
    VALUES (p_store_name, v_slug)
    RETURNING id INTO v_org_id;

    -- 2. Create tenant with trial
    INSERT INTO tenants (
        business_name, subdomain, billing_email, contact_name,
        plan, subscription_status, trial_ends_at,
        is_active, onboarding_completed
    )
    VALUES (
        p_store_name, v_slug, p_email, p_first_name || ' ' || p_last_name,
        'trial', 'active', v_trial_ends_at,
        true, true
    )
    RETURNING id INTO v_tenant_id;

    -- 3. Create location linked to org and tenant
    INSERT INTO locations (org_id, name, code)
    VALUES (v_org_id, p_location_name, p_location_code)
    RETURNING id INTO v_location_id;

    -- 4. Hash PIN if provided
    IF p_pin IS NOT NULL AND p_pin != '' THEN
        v_pin_hash := crypt(p_pin, gen_salt('bf'));
    END IF;

    -- 5. Create admin user linked to org and tenant
    INSERT INTO users (auth_user_id, username, email, first_name, last_name, role, org_id, location_id, tenant_id, pin_hash, auth_provider, is_active)
    VALUES (p_auth_user_id, p_username, p_email, p_first_name, p_last_name, 'admin', v_org_id, v_location_id, v_tenant_id, v_pin_hash, 'supabase', true)
    RETURNING id INTO v_user_id;

    -- 6. Auto-confirm email + update app_metadata with tenant_id
    UPDATE auth.users SET
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) ||
            jsonb_build_object(
                'org_id', v_org_id,
                'role', 'admin',
                'location_id', v_location_id,
                'user_id', v_user_id,
                'tenant_id', v_tenant_id
            )
    WHERE id = p_auth_user_id;

    -- 7. Insert default settings
    INSERT INTO settings (org_id, key, value, description) VALUES
        (v_org_id, 'currency', p_currency, 'Default currency code'),
        (v_org_id, 'currency_symbol', p_currency_symbol, 'Currency symbol for display'),
        (v_org_id, 'tax_rate', p_tax_rate, 'Default tax rate percentage'),
        (v_org_id, 'restaurant_name', p_store_name, 'Business name'),
        (v_org_id, 'store_name', p_store_name, 'Business name (legacy)'),
        (v_org_id, 'theme', 'light', 'UI theme'),
        (v_org_id, 'touch_mode', 'false', 'Touch screen mode');

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'org_id', v_org_id,
            'location_id', v_location_id,
            'user_id', v_user_id,
            'tenant_id', v_tenant_id,
            'trial_ends_at', v_trial_ends_at::text
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.initial_setup TO anon, authenticated;


-- 2. Override auth hook to inject trial claims into JWT
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb AS $$
DECLARE
    claims jsonb;
    user_org_id uuid;
    user_role text;
    user_location_id uuid;
    user_id_from_users uuid;
    user_tenant_id uuid;
    v_plan text;
    v_subscription_status text;
    v_trial_ends_at timestamptz;
BEGIN
    SELECT id, org_id, role, location_id, tenant_id
    INTO user_id_from_users, user_org_id, user_role, user_location_id, user_tenant_id
    FROM public.users
    WHERE auth_user_id = (event->>'user_id')::uuid
    AND is_active = true
    LIMIT 1;

    claims := event->'claims';

    IF user_org_id IS NOT NULL THEN
        IF claims->'app_metadata' IS NULL THEN
            claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb);
        END IF;

        claims := jsonb_set(claims, '{app_metadata,org_id}', to_jsonb(user_org_id::text));
        claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(user_role));
        claims := jsonb_set(claims, '{app_metadata,user_id}', to_jsonb(user_id_from_users::text));

        IF user_location_id IS NOT NULL THEN
            claims := jsonb_set(claims, '{app_metadata,location_id}', to_jsonb(user_location_id::text));
        END IF;

        IF user_tenant_id IS NOT NULL THEN
            claims := jsonb_set(claims, '{app_metadata,tenant_id}', to_jsonb(user_tenant_id::text));

            -- Look up tenant trial info
            SELECT plan, subscription_status, trial_ends_at
            INTO v_plan, v_subscription_status, v_trial_ends_at
            FROM public.tenants
            WHERE id = user_tenant_id;

            IF v_plan IS NOT NULL THEN
                claims := jsonb_set(claims, '{app_metadata,plan}', to_jsonb(v_plan));
                claims := jsonb_set(claims, '{app_metadata,subscription_status}', to_jsonb(v_subscription_status));
                IF v_trial_ends_at IS NOT NULL THEN
                    claims := jsonb_set(claims, '{app_metadata,trial_ends_at}', to_jsonb(v_trial_ends_at::text));
                END IF;
            END IF;
        END IF;
    END IF;

    event := jsonb_set(event, '{claims}', claims);
    RETURN event;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM public;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM anon;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated;

-- Allow auth hook to read tenants table
GRANT SELECT ON public.tenants TO supabase_auth_admin;


-- 3. RPC to check trial status (auto-expires if needed)
CREATE OR REPLACE FUNCTION public.check_trial_status()
RETURNS jsonb AS $$
DECLARE
    v_tenant_id uuid;
    v_plan text;
    v_status text;
    v_trial_ends timestamptz;
    v_is_expired boolean;
BEGIN
    SELECT tenant_id INTO v_tenant_id
    FROM public.users
    WHERE auth_user_id = auth.uid()
    AND is_active = true
    LIMIT 1;

    IF v_tenant_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'data', jsonb_build_object(
                'plan', 'none',
                'subscription_status', 'active',
                'trial_ends_at', null,
                'is_trial_expired', false,
                'days_remaining', 0
            )
        );
    END IF;

    SELECT plan, subscription_status, trial_ends_at
    INTO v_plan, v_status, v_trial_ends
    FROM public.tenants
    WHERE id = v_tenant_id;

    v_is_expired := (v_plan = 'trial' AND v_trial_ends IS NOT NULL AND v_trial_ends < NOW());

    -- Auto-expire
    IF v_is_expired AND v_status = 'active' THEN
        UPDATE public.tenants
        SET subscription_status = 'expired'
        WHERE id = v_tenant_id;
        v_status := 'expired';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'tenant_id', v_tenant_id,
            'plan', v_plan,
            'subscription_status', v_status,
            'trial_ends_at', v_trial_ends::text,
            'is_trial_expired', v_is_expired,
            'days_remaining', GREATEST(0, EXTRACT(DAY FROM v_trial_ends - NOW())::integer)
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.check_trial_status TO authenticated;
