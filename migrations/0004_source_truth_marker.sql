-- Keep an explicit record of the source-truth schema level without runtime DDL.
CREATE TABLE IF NOT EXISTS archive_schema (
  version TEXT PRIMARY KEY,
  applied_at TEXT DEFAULT CURRENT_TIMESTAMP
);
INSERT OR REPLACE INTO archive_schema(version,applied_at)
VALUES('source-truth-v5',CURRENT_TIMESTAMP);
