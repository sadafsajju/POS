-- =============================================
-- Serialize order/token number generation per org/day
--
-- The previous generate_order_number used `SELECT COUNT(*) + 1` without
-- a lock. Two concurrent create_order RPC calls (e.g. a rapid double-click
-- on the Pay button) both computed the same count and tried to INSERT the
-- same order_number, hitting the orders_order_number_key UNIQUE constraint
-- (HTTP 409 from PostgREST).
--
-- Fix: take a transaction-scoped advisory lock keyed on (org_id, day) before
-- computing the count. Concurrent transactions for the same org/day serialize;
-- different orgs / different days do not block each other. Lock is released
-- automatically at COMMIT/ROLLBACK and is reentrant within the same backend,
-- so the second call inside create_order (bill + KOT) is fine.
--
-- generate_token_number has the same race; same fix applied.
-- =============================================

CREATE OR REPLACE FUNCTION public.generate_order_number(p_org_id uuid, p_prefix text DEFAULT 'ORD')
RETURNS text AS $$
DECLARE
    v_tz text;
    v_today date;
    v_count integer;
BEGIN
    v_tz := public.get_org_timezone(p_org_id);
    v_today := (now() AT TIME ZONE v_tz)::date;

    PERFORM pg_advisory_xact_lock(hashtext('order_num:' || p_org_id::text || ':' || v_today::text));

    SELECT COUNT(*) + 1 INTO v_count
    FROM orders
    WHERE org_id = p_org_id
      AND (created_at AT TIME ZONE v_tz)::date = v_today;

    RETURN p_prefix || to_char(v_today, 'YYYYMMDD') || lpad(v_count::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.generate_token_number(p_org_id uuid, p_location_id uuid)
RETURNS integer AS $$
DECLARE
    v_tz text;
    v_today date;
    v_token integer;
BEGIN
    v_tz := public.get_org_timezone(p_org_id);
    v_today := (now() AT TIME ZONE v_tz)::date;

    PERFORM pg_advisory_xact_lock(hashtext('token_num:' || p_org_id::text || ':' || p_location_id::text || ':' || v_today::text));

    SELECT COALESCE(MAX(token_number), 0) + 1 INTO v_token
    FROM orders
    WHERE org_id = p_org_id
      AND location_id = p_location_id
      AND (created_at AT TIME ZONE v_tz)::date = v_today
      AND token_number IS NOT NULL;

    RETURN v_token;
END;
$$ LANGUAGE plpgsql;
