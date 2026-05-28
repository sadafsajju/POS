-- Adds image_url to categories so admins can attach a tile image to a category.
-- Already referenced by the TS types and the POS category-card landing — column
-- was just never created. Nullable additive change, no backfill required.

ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
