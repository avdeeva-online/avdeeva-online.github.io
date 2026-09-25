-- Marks a POV chosen by the admin so re-import / reindex keep it
-- ('admin:manual'), mirroring universe_source_field and setting_source.
ALTER TABLE characters ADD COLUMN pov_source TEXT NOT NULL DEFAULT '';
