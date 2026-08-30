# ARCHIVE.EXE v1.0

First 1.0 patch.

### New
- POV is now visible directly on every bot card:
  - `♀` FemPOV
  - `♂` MalePOV
  - `◎` AnyPOV
- The POV badge lives beside the lorebook icon and has a hover tooltip.
- Header artwork remains the exact same `assets/header.png`.
- Added separate live overlay effects over the header:
  - slow warm light glare/reflection;
  - rare terminal-screen glitch;
  - drifting dust particles that fade out and are removed automatically.
- Header effects are intentionally subtle and respect `prefers-reduced-motion`.
- Terminal glitch overlay is hidden on narrower screens where the background is cropped, preventing misalignment.

Existing catalog, filters, random, modal, downloads, lorebooks, easter eggs and data structure remain unchanged.

### Final catalog pass
- CATALOG button is more visible with an olive archive accent and status light.
- Drawer search is more compact.
- Added drawer sort cycle: A→Z → Z→A → MOST → LEAST.
- Added bot-count threshold cycle: ALL → 2+ → 5+ → 10+.
- Sorting/count threshold work separately for TAGS, AUTHORS and UNIVERSES and can be combined with search.
