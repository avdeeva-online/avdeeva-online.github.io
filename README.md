# ARCHIVE.EXE v0.9.16 — Catalog Multiselect

Changes in this patch:
- Catalog drawer is narrower and denser, while text is larger and higher-contrast for readability.
- Catalog selections no longer close the drawer. Pick as many tags/authors/universes as needed, then close with X, Esc, or by clicking outside.
- Drawer items now toggle on/off instead of only adding.
- Selecting every author (or every universe) is treated as an unrestricted dimension, so all matching bots remain visible.
- Existing anomaly/glitch behavior is preserved.

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

## v0.9.17 — Catalog Toggle
- Catalog stays open while selecting/deselecting tags, authors and universes.
- Clicking the same selected item again removes that filter.
- Drawer closes only with X, Escape, or clicking outside.
- Selected state is clearer and includes aria-pressed.


## v0.9.18 — Catalog scale + initial render fix
- Fixed the refresh bug where the page started at 0 bots until RESET FILTERS was pressed.
- Catalog drawer reduced to 340px desktop width and tightened vertically.
- Kept item text readable while reducing decorative microcopy and spacing.
- Replaced confusing `ACTIVE` stat with explicit `BOTS`. Stats now read like `24 TAGS / 06 BOTS / 00 SELECTED`.
- Multi-select/toggle behavior from v0.9.17 is preserved.
