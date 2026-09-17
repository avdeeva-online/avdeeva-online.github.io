-- ARCHIVE.EXE D1 baseline
-- Safe on the current production DB: tables/indexes are created only when missing.
-- New databases receive the complete schema expected by the current Worker.

CREATE TABLE IF NOT EXISTS characters (
  janitor_uuid TEXT PRIMARY KEY,
  slug TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  author_url TEXT NOT NULL DEFAULT '',
  universe TEXT NOT NULL DEFAULT '',
  pov TEXT NOT NULL DEFAULT 'AnyPOV',
  tags TEXT NOT NULL DEFAULT '[]',
  hashtags TEXT NOT NULL DEFAULT '[]',
  short_description TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  scenario TEXT NOT NULL DEFAULT '',
  intros TEXT NOT NULL DEFAULT '[]',
  image_url TEXT NOT NULL DEFAULT '',
  janitor_url TEXT NOT NULL DEFAULT '',
  datacat_url TEXT NOT NULL DEFAULT '',
  card_url TEXT NOT NULL DEFAULT '',
  lorebook_url TEXT NOT NULL DEFAULT '',
  lorebook_title TEXT,
  universe_source_field TEXT,
  universes TEXT NOT NULL DEFAULT '[]',
  setting_ids TEXT NOT NULL DEFAULT '[]',
  setting_source TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'janitor',
  status TEXT NOT NULL DEFAULT 'published',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_characters_status_updated ON characters(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_characters_author ON characters(author COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS lorebooks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  script TEXT NOT NULL DEFAULT '',
  author TEXT DEFAULT '',
  source TEXT DEFAULT 'datacat',
  content_hash TEXT,
  source_identity TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lorebooks_content_hash ON lorebooks(content_hash);

CREATE TABLE IF NOT EXISTS lorebook_blobs (
  content_hash TEXT PRIMARY KEY,
  script TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lorebook_sources (
  source_identity TEXT PRIMARY KEY,
  lorebook_id TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lorebook_sources_lorebook ON lorebook_sources(lorebook_id);

CREATE TABLE IF NOT EXISTS character_lorebooks (
  character_uuid TEXT NOT NULL,
  lorebook_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(character_uuid,lorebook_id)
);
CREATE INDEX IF NOT EXISTS idx_character_lorebooks_character ON character_lorebooks(character_uuid);
CREATE INDEX IF NOT EXISTS idx_character_lorebooks_lorebook ON character_lorebooks(lorebook_id);

CREATE TABLE IF NOT EXISTS hub_resources (
  id TEXT PRIMARY KEY,
  source_url TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL DEFAULT 'telegram',
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  creator_name TEXT NOT NULL DEFAULT '',
  creator_link TEXT NOT NULL DEFAULT '',
  description_short TEXT NOT NULL DEFAULT '',
  description_full TEXT NOT NULL DEFAULT '',
  additional_info TEXT NOT NULL DEFAULT '',
  models TEXT NOT NULL DEFAULT '[]',
  settings TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  media TEXT NOT NULL DEFAULT '[]',
  confidence TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'published',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hub_resource_files (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mime TEXT NOT NULL DEFAULT 'application/octet-stream',
  size INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0,
  data BLOB,
  external_url TEXT NOT NULL DEFAULT '',
  storage TEXT NOT NULL DEFAULT 'd1',
  r2_key TEXT NOT NULL DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS hub_resource_files_resource_idx ON hub_resource_files(resource_id);

CREATE TABLE IF NOT EXISTS hub_resource_file_chunks (
  file_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  data BLOB NOT NULL,
  PRIMARY KEY(file_id,chunk_index)
);
CREATE INDEX IF NOT EXISTS hub_resource_file_chunks_file_idx ON hub_resource_file_chunks(file_id);

CREATE TABLE IF NOT EXISTS hub_resource_publish_sessions (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  was_existing INTEGER NOT NULL DEFAULT 0,
  backup TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS hub_resource_publish_sessions_resource_idx ON hub_resource_publish_sessions(resource_id);

CREATE TABLE IF NOT EXISTS hub_resource_publish_files (
  session_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  replace_old_id TEXT NOT NULL DEFAULT '',
  is_primary INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(session_id,file_id)
);
CREATE INDEX IF NOT EXISTS hub_resource_publish_files_session_idx ON hub_resource_publish_files(session_id);

CREATE TABLE IF NOT EXISTS telegram_admin_drafts (
  id TEXT PRIMARY KEY,
  source_url TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'review',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_telegram_admin_drafts_status_updated ON telegram_admin_drafts(status,updated_at DESC);

CREATE TABLE IF NOT EXISTS telegram_admin_import_session (
  admin_user_id TEXT PRIMARY KEY,
  channel TEXT NOT NULL DEFAULT '',
  draft_id TEXT NOT NULL DEFAULT '',
  last_post_id INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hub_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_hub_suggestions_status_created ON hub_suggestions(status, created_at DESC);

CREATE TABLE IF NOT EXISTS universe_curation (
  source_key TEXT PRIMARY KEY,
  source_value TEXT NOT NULL,
  public_universes TEXT NOT NULL DEFAULT '[]',
  parent_universe TEXT NOT NULL DEFAULT '',
  subuniverse TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  note TEXT NOT NULL DEFAULT '',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_universe_review (
  review_key TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'ignored',
  note TEXT DEFAULT '',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
