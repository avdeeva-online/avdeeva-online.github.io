# ARCHIVE.EXE v0.9.20 — Catalog Clean / Legibility

- Removed the decorative catalog statistics row (`TAGS / BOTS / SELECTED`).
- Narrowed the desktop catalog drawer to ~292 px.
- Increased readable text sizes for tabs, search, tags, authors and universes.
- Main entry names now use the readable site sans font; small archive metadata remains monospace.
- Existing multi-select, toggle-off behavior, boot fix, filters and anomaly system are preserved.

# ARCHIVE.EXE v0.9.19 — Boot Fix + Compact Catalog

Changes:
- Fixed the refresh bug where the archive could start at `0 RECORDS` until RESET FILTERS was clicked.
- The app no longer permanently snapshots an empty `window.BOTS`; it synchronizes the dataset before every render.
- Added a short guarded boot retry plus a final load repaint for browser/cache timing edge cases.
- Catalog drawer reduced to ~312 px on desktop and ~320 px max on mobile.
- Catalog text contrast/readability increased while overall panel footprint is smaller.
- Existing multi-select/toggle behavior and anomaly/easter-egg logic preserved.


## v0.9.21 — Toolbar consistency
- Removed decorative symbols from AUTHOR and UNIVERSE.
- POV is now a text cycle: ANY POV → MALE POV → FEM POV.
- Kept the lorebook as the icon-only book button and # for HASHTAGS.
- Replaced RANDOM star with a small monochrome SVG dice.
- No filter logic, catalog behavior, boot logic, or anomaly behavior changed.
