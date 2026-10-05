-- Several pictures per style (shown as a hover / swipe gallery on the site). JSON array of R2 keys, first = cover.
-- image_key stays the first one for older code; existing styles start with their single picture.
ALTER TABLE codex_styles ADD COLUMN image_keys TEXT NOT NULL DEFAULT '[]';
UPDATE codex_styles SET image_keys=json_array(image_key) WHERE image_key<>'';
