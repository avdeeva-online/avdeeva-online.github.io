# ARCHIVE.EXE — v0.9.15 Catalog Index

Catalog-only redesign based on v0.9.14 Anomaly Pass.

## Changed
- Narrower, lighter archive-database drawer instead of a generic long sidebar.
- New database status line and compact index statistics.
- Tabs are now `[01] TAGS / [02] AUTHORS / [03] UNIVERSES` style archive sections.
- TAGS use a dense two-column index so far more entries fit on screen.
- AUTHORS use their own record layout with author name + record count.
- UNIVERSES use a WORLD_XX file-index layout with record count.
- Search field restyled as an index search rather than a generic input.
- Much thinner, quieter drawer scrollbar.
- Existing filtering behavior is preserved.
- Existing anomaly system is preserved and adapted to the new Catalog markup.
- Catalog anomaly can also briefly miscount the index total by +1.

No changes to bot data, modal behavior, search logic, or the main catalog grid.
