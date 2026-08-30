# FINAL22 — DATACAT LOOKUP

Flow:
1. Janitor URL -> UUID
2. Check D1
3. If absent, query DataCat public character endpoint
4. If DataCat already has the record, parse and save into D1 automatically
5. If DataCat does not have it yet, return NEEDS_DATACAT_RETRIEVAL

Important:
DataCat's retrieval-v2 endpoint is session-protected. Public visitors should NOT need browser extensions.
The next step is to add a server-side DataCat session as Cloudflare secrets so the Worker can queue retrieval itself.
