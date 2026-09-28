-- CODEX: admin-written description, links and hashtags for a universe or an author.
-- kind = 'universe' | 'author'; name_key = lower-case name as shown in the catalog.
-- links = JSON [{"label":"Site","url":"https://…"}], hashtags = JSON ["…"].
CREATE TABLE IF NOT EXISTS codex_profiles (
  kind TEXT NOT NULL,
  name_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  links TEXT NOT NULL DEFAULT '[]',
  hashtags TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (kind, name_key)
);
