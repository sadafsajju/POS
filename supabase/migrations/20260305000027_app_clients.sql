-- Per-device version telemetry.
--
-- Lets the vendor see which app version each customer terminal is running (and
-- spot stale installs — e.g. a customer-display stuck on an old build). Every
-- client calls record_app_client() on startup and ~hourly. The function stamps
-- org/location/user from the *verified* JWT, so a client can't forge another
-- tenant's rows, and the client only sends its own device id, version, platform.
--
-- The vendor queries across all orgs from the dashboard (service role bypasses
-- RLS); in-app reads are org-scoped for a possible per-org "Devices" view.

CREATE TABLE IF NOT EXISTS app_clients (
    device_id     TEXT PRIMARY KEY,                                  -- stable per-install UUID from the client
    org_id        UUID REFERENCES organizations(id) ON DELETE CASCADE,
    location_id   UUID REFERENCES locations(id) ON DELETE SET NULL,
    user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    app_version   TEXT NOT NULL,
    platform      TEXT,                                              -- 'windows' | 'macos' | 'linux' | 'web'
    first_seen_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_seen_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_app_clients_org ON app_clients(org_id);
CREATE INDEX IF NOT EXISTS idx_app_clients_version ON app_clients(app_version);
CREATE INDEX IF NOT EXISTS idx_app_clients_last_seen ON app_clients(last_seen_at DESC);

ALTER TABLE app_clients ENABLE ROW LEVEL SECURITY;

-- In-app reads are org-scoped. The vendor reads across all orgs via the service
-- role (dashboard), which bypasses RLS.
DROP POLICY IF EXISTS app_clients_select_own_org ON app_clients;
CREATE POLICY app_clients_select_own_org ON app_clients
    FOR SELECT TO authenticated
    USING (org_id = public.get_my_org_id());

-- All writes go through record_app_client() (SECURITY DEFINER). No direct
-- INSERT/UPDATE policy is granted, so the tenant columns can't be spoofed.
CREATE OR REPLACE FUNCTION public.record_app_client(
    p_device_id   TEXT,
    p_app_version TEXT,
    p_platform    TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'not authenticated';
    END IF;

    INSERT INTO public.app_clients AS ac (
        device_id, org_id, location_id, user_id, app_version, platform, first_seen_at, last_seen_at
    )
    VALUES (
        p_device_id,
        public.get_my_org_id(),
        public.get_my_location_id(),
        public.get_my_user_id(),
        p_app_version,
        p_platform,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (device_id) DO UPDATE SET
        org_id       = public.get_my_org_id(),
        location_id  = public.get_my_location_id(),
        user_id      = public.get_my_user_id(),
        app_version  = EXCLUDED.app_version,
        platform     = EXCLUDED.platform,
        last_seen_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.record_app_client(TEXT, TEXT, TEXT) TO authenticated;
