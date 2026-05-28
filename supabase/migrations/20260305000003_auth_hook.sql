-- =============================================
-- Custom Access Token Hook
-- Injects org_id, role, location_id, user_id into JWT app_metadata
-- Enable in: Supabase Dashboard > Auth > Hooks > Custom Access Token
-- =============================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb AS $$
DECLARE
    claims jsonb;
    user_org_id uuid;
    user_role text;
    user_location_id uuid;
    user_id_from_users uuid;
    user_tenant_id uuid;
BEGIN
    -- Look up the POS user record linked to this auth user
    SELECT id, org_id, role, location_id, tenant_id
    INTO user_id_from_users, user_org_id, user_role, user_location_id, user_tenant_id
    FROM public.users
    WHERE auth_user_id = (event->>'user_id')::uuid
    AND is_active = true
    LIMIT 1;

    claims := event->'claims';

    -- Only inject claims if we found a linked user
    IF user_org_id IS NOT NULL THEN
        -- Ensure app_metadata exists
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
        END IF;
    END IF;

    event := jsonb_set(event, '{claims}', claims);
    RETURN event;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute to supabase_auth_admin (required for auth hooks)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Revoke from public for security
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM public;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM anon;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated;
