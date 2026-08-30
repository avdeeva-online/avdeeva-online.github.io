# CLOUDFLARE DEPLOY — Worker + D1

This version converts ARCHIVE.EXE from a static-assets-only Worker
into a real Worker with static assets plus a D1 binding.

Bindings:
- ASSETS -> ./public
- DB -> archive-characters

Health check after deploy:
https://archive-exe.node-00.workers.dev/api/health

Expected JSON:
{"ok":true,"worker":"archive-exe","database":true,"databaseError":null}
