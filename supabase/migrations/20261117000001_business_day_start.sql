-- =============================================
-- Configurable business-day rollover
--
-- Token numbers reset at local midnight, which hands out token #1 in the
-- middle of service for any venue trading past 12 AM. A new org setting
-- `business_day_start` ('HH:MM', org-local, default '00:00') moves the
-- rollover; the kitchen display uses the same cutoff client-side
-- (businessDayStartUtc in apps/desktop/src/lib/utils.ts) to start each
-- day with a clean board. Keep the two in step.
--
-- With the default '00:00' behaviour is identical to before. Order
-- numbers, dashboard, EOD and reports still use the calendar day.
-- =============================================

-- Start (as an absolute instant) of the business day that p_at falls in.
-- SECURITY DEFINER for the same reason as get_org_timezone: callers like
-- create_order need it across settings RLS, and it only returns a timestamp.
CREATE OR REPLACE FUNCTION public.get_business_day_start(
    p_org_id uuid,
    p_at timestamptz DEFAULT now()
)
RETURNS timestamptz AS $$
DECLARE
    v_tz text;
    v_raw text;
    v_cutoff interval := interval '0';
    v_local timestamp;
    v_bday date;
BEGIN
    v_tz := public.get_org_timezone(p_org_id);

    IF p_org_id IS NOT NULL THEN
        SELECT value INTO v_raw
        FROM settings
        WHERE org_id = p_org_id
          AND key = 'business_day_start'
        ORDER BY (location_id IS NULL) DESC
        LIMIT 1;
    END IF;

    -- Accept 'H:MM' / 'HH:MM' within a day; anything else means midnight.
    IF v_raw ~ '^\s*([01]?[0-9]|2[0-3]):[0-5][0-9]\s*$' THEN
        v_cutoff := btrim(v_raw)::interval;
    END IF;

    v_local := p_at AT TIME ZONE v_tz;
    v_bday := (v_local - v_cutoff)::date;

    -- Wall-clock (date + cutoff) in the org zone, back to an absolute instant.
    RETURN (v_bday + v_cutoff) AT TIME ZONE v_tz;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_business_day_start(uuid, timestamptz) TO authenticated;

-- Same contract as before (serialized per org/location/day), but "day" is
-- now the business day and the scan is a created_at range, which can use
-- an index instead of casting every row.
CREATE OR REPLACE FUNCTION public.generate_token_number(p_org_id uuid, p_location_id uuid)
RETURNS integer AS $$
DECLARE
    v_start timestamptz;
    v_end timestamptz;
    v_tz text;
    v_token integer;
BEGIN
    v_tz := public.get_org_timezone(p_org_id);
    v_start := public.get_business_day_start(p_org_id, now());
    -- Next rollover, computed in local wall-clock so a DST change mid-day
    -- doesn't shift it by an hour.
    v_end := ((v_start AT TIME ZONE v_tz) + interval '1 day') AT TIME ZONE v_tz;

    PERFORM pg_advisory_xact_lock(hashtext('token_num:' || p_org_id::text || ':' || p_location_id::text || ':' || v_start::text));

    SELECT COALESCE(MAX(token_number), 0) + 1 INTO v_token
    FROM orders
    WHERE org_id = p_org_id
      AND location_id = p_location_id
      AND created_at >= v_start
      AND created_at < v_end
      AND token_number IS NOT NULL;

    RETURN v_token;
END;
$$ LANGUAGE plpgsql;
