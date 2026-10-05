-- Where a style was taken from (the author's Telegram post etc.), shown as a "Post" link on the style card.
ALTER TABLE codex_styles ADD COLUMN source_url TEXT NOT NULL DEFAULT '';
