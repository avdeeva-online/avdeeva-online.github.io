-- Admin activity log: every write in the admin (POST / PATCH / PUT / DELETE on /api/admin/*) — who (Cloudflare Access
-- email), from where (country, IP), what (path + a short summary of the request), result (HTTP status). Reads are not logged.
-- Shown in Admin → Система → Журнал; rows older than 90 days are pruned.
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  method TEXT NOT NULL DEFAULT '',
  path TEXT NOT NULL DEFAULT '',
  status INTEGER NOT NULL DEFAULT 0,
  detail TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS admin_audit_log_at ON admin_audit_log(at);