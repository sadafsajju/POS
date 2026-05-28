-- Add enable_kds setting for all existing organizations
-- Default to true so existing restaurants keep their kitchen workflow
INSERT INTO settings (org_id, location_id, key, value)
SELECT id, NULL, 'enable_kds', 'true'
FROM organizations
ON CONFLICT (org_id, location_id, key) DO NOTHING;
