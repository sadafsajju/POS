-- Function to update a user's PIN
-- Requires current PIN verification (if one is set) before allowing change
CREATE OR REPLACE FUNCTION public.update_pin(p_current_pin TEXT, p_new_pin TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_auth_user_id UUID;
    v_pin_hash TEXT;
    v_new_hash TEXT;
BEGIN
    v_auth_user_id := auth.uid();
    IF v_auth_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- Get current pin_hash
    SELECT pin_hash INTO v_pin_hash
    FROM users
    WHERE auth_user_id = v_auth_user_id;

    -- If user has a PIN set, verify the current one
    IF v_pin_hash IS NOT NULL THEN
        IF p_current_pin IS NULL OR v_pin_hash != extensions.crypt(p_current_pin, v_pin_hash) THEN
            RETURN json_build_object('success', false, 'message', 'Current PIN is incorrect');
        END IF;
    END IF;

    -- Validate new PIN
    IF p_new_pin IS NULL OR length(p_new_pin) != 4 OR p_new_pin !~ '^\d{4}$' THEN
        RETURN json_build_object('success', false, 'message', 'New PIN must be exactly 4 digits');
    END IF;

    -- Hash and update
    v_new_hash := extensions.crypt(p_new_pin, extensions.gen_salt('bf'));

    UPDATE users
    SET pin_hash = v_new_hash, updated_at = now()
    WHERE auth_user_id = v_auth_user_id;

    RETURN json_build_object('success', true, 'message', 'PIN updated successfully');
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_pin(TEXT, TEXT) TO authenticated;
