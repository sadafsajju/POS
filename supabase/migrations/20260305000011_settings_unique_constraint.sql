-- Add unique index for org-level settings (where location_id is NULL)
-- This allows upsert with onConflict: 'org_id,key' to work correctly
CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_org_key ON settings(org_id, key) WHERE location_id IS NULL;
