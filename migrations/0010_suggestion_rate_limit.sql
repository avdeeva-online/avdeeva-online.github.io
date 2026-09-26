-- Public HUB suggestions are rate-limited per visitor. Only a salted hash of the client IP is stored.
ALTER TABLE hub_suggestions ADD COLUMN client_hash TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_hub_suggestions_client_created ON hub_suggestions(client_hash, created_at DESC);
