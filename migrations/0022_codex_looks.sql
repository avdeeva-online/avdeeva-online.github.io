-- CODEX "Looks" tab: the same cards as styles (pictures + text copied in one tap), kept in the same table.
-- kind: 'style' (Styles tab) or 'look' (Looks tab). Existing rows are styles.
ALTER TABLE codex_styles ADD COLUMN kind TEXT NOT NULL DEFAULT 'style';
