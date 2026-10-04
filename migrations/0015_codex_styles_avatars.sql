-- CODEX "Styles": image-generation style prompts (NovelAI v4.5 / v5, Nano Banana…) with a preview picture.
-- The picture lives in R2 (HUB_FILES, key codex/styles/<id>); the prompt is copied on the site with one tap.
CREATE TABLE IF NOT EXISTS codex_styles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  prompt TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  author_link TEXT NOT NULL DEFAULT '',
  image_key TEXT NOT NULL DEFAULT '',
  image_type TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Author / universe avatar for CODEX (R2 key codex/avatars/…); empty = initial letter on the site.
ALTER TABLE codex_profiles ADD COLUMN avatar_key TEXT NOT NULL DEFAULT '';