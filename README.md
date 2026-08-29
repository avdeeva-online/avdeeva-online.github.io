# ARCHIVE.EXE v0.9.19 — Boot Fix + Compact Catalog

Changes:
- Fixed the refresh bug where the archive could start at `0 RECORDS` until RESET FILTERS was clicked.
- The app no longer permanently snapshots an empty `window.BOTS`; it synchronizes the dataset before every render.
- Added a short guarded boot retry plus a final load repaint for browser/cache timing edge cases.
- Catalog drawer reduced to ~312 px on desktop and ~320 px max on mobile.
- Catalog text contrast/readability increased while overall panel footprint is smaller.
- Existing multi-select/toggle behavior and anomaly/easter-egg logic preserved.
