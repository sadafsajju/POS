-- Function to verify a user's PIN
-- Called by authenticated users to verify their own PIN
CREATE OR REPLACE FUNCTION public.verify_pin(p_pin TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_pin_hash TEXT;
    v_auth_user_id UUID;
BEGIN
    -- Get the authenticated user's auth ID
    v_auth_user_id := auth.uid();
    IF v_auth_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- Look up the user's pin_hash from the users table
    SELECT pin_hash INTO v_pin_hash
    FROM users
    WHERE auth_user_id = v_auth_user_id;

    IF v_pin_hash IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'No PIN set for this user');
    END IF;

    -- Verify the PIN using pgcrypto crypt
    IF v_pin_hash = extensions.crypt(p_pin, v_pin_hash) THEN
        RETURN json_build_object('success', true, 'message', 'PIN verified');
    ELSE
        RETURN json_build_object('success', false, 'message', 'Invalid PIN');
    END IF;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.verify_pin(TEXT) TO authenticated;
