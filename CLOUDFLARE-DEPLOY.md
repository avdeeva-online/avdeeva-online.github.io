# FINAL21 — IMPORT CHECK

Adds:
- POST /api/import
- Extracts Janitor UUID from submitted URL
- Checks D1 table `characters`
- Returns FOUND if record exists
- Returns MISSING if record is not in database
- No DataCat retrieval yet
- Test page: /import-test/

Test with:
https://archive-exe.node-00.workers.dev/import-test/
