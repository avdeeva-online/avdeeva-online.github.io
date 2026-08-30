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

### final2 cleanup
- POV and lorebook indicators reduced to compact 25×25 status icons.
- Removed COUNT threshold control from Catalog; it duplicated the MOST/LEAST sorting use case.
- Catalog now keeps a cleaner SEARCH + SORT layout.

### final3 dust fix
- Dust is noticeably more visible.
- Particles now drift mostly sideways and downward instead of floating upward.
- Slightly larger particles, stronger glow, and a denser but still sparse spawn pattern.

### final4 hero visibility pass
- Warm glare is stronger and visibly breathes.
- Added a slow diagonal light sweep over the header.
- Terminal glitch is stronger, larger and triggers more often.
- Added faint moving scanlines over the hero.
- Dust changes from final3 are preserved.

### final5 polish
- Main records status dot is hidden by default and appears only when search/filter/sort state differs from default.
- RESET FILTERS moved next to the record counter, styled more clearly, and is hidden when there is nothing to reset.
- Modal author / POV metadata enlarged for readability.
- Card POV + lorebook are now small inline system glyphs instead of detached square buttons.
- Light animation changed from frequent broad sweep to a rarer circular sun/lens flare.
- Terminal glitch is slower, stronger, and remains visible longer.

### final6
- Catalog button status dot now appears only while filters/search/non-default sort are active.
- Terminal glitch completely redesigned: no oversized green screen overlay.
- New glitch is constrained to the terminal glass and uses short CRT signal tears/fragments.
- Glitch is less aggressive and lasts long enough to read as an intentional screen malfunction.

### final7 FX calibration
- Solar lens flare now has a clearly visible peak and appears roughly every 16 seconds.
- Terminal CRT event now occurs roughly every 9 seconds and remains visible for ~1.5–2 seconds.
- Both effects remain separate overlays; header.png is unchanged.

### final8 modal paging
- Left/right modal arrows now browse the previous/next record in the current filtered catalog instead of picking a random bot.
- Switching records has a subtle directional slide + fade.
- Cover image gets a very small independent drift/fade on entry.
- Random button still chooses a random record.
