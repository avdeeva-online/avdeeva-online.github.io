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

### v1.0 final9 bundle
- Modal previous/next animation shortened to a single 145ms directional entrance; removed the duplicate/repeated new-card animation.
- Arrow keys now browse in the correct direction.
- Hero solar flare and terminal glitch use deterministic JS-triggered moments to avoid old CSS override conflicts. First flare appears ~2.2s after load; first terminal glitch ~4.7s after load.
- LOST DIRECTORY now types its lines, remembers repeat visits, runs a recovery progress sequence, has multiple outcomes and a rare NE AVDEEVA result.
- Footer now includes `CURATED BY NE AVDEEVA ↗`.
- Telegram credit currently points to `https://t.me/ne_avdeeva`.

### v1.0 final10 small
- Catalog top bar now shows FOUND, SHOW and TOTAL.
- SHOW selector supports 10 / 30 / 50 / 100 records per page.
- Added page navigation under the grid when needed.
- LOST DIRECTORY footer trigger now aggressively glitches and cycles warning strings on hover.

### v1.0 final11 cleanup
- Removed the decorative footer leaves/branch.
- Fixed the blank-on-first-load catalog bug caused by missing `pageSize` / `currentPage` declarations.
- Catalog now paints immediately when `window.BOTS` is already available.
- Moved FOUND / SHOW / TOTAL / RESET into the top toolbar, after the filter controls.

### v1.0 final11b
- Reduced the visual weight of FOUND / SHOW / TOTAL.
- Removed the heavy right-side separation and made the stats read as passive archive metadata beside RANDOM.

### v1.0 final11c
- Reordered catalog meta: SHOW first, TOTAL second.
- Moved FOUND onto its own small result line below the toolbar so it has a separate visual anchor.
- Increased meta readability.
- Re-anchored the SHOW dropdown directly under/right-aligned to its button instead of letting it float into the card area.

### v1.0 final12 UI + FX
- SHOW/TOTAL finalized in the top-right with no internal square frame.
- SHOW dropdown is nested directly under SHOW and no longer uses viewport coordinate math.
- RECORDS FOUND moved to the far-right of the TAGS row.
- Old sun/glitch layers retired; dust remains untouched.
- Added completely new independent HERO FX V2:
  - visible solar flare starts ~1.6s after load and repeats ~14.5s;
  - visible terminal CRT tear starts ~3.4s after load and repeats ~8.8s.

### v1.0 final13 filter + FX polish
- SHOW menu now visually matches the other dropdown filters.
- All floating filters close on selection, outside click, or when another filter/control is opened.
- Solar flare reduced from 145px to 64px, moved left toward the real light opening, slowed to 4.4s, and simplified to one soft glow for smoother rendering.
- CRT glitch moved to match the actual monitor glass and reduced to restrained signal tears rather than a broad overlay.

### v1.0 final14 modal + terminal polish
- SHOW dropdown reduced to a compact 86px menu.
- LOST DIRECTORY typing now animates character-by-character with slower line pauses and a slower recovery progress sequence.
- Terminal close button pinned correctly to the top-right and vertically centered.
- Removed duplicated Russian name from modal.
- Modal hierarchy is now: NAME → UNIVERSE → AUTHOR / POV.
- Name receives stronger weight/contrast without increasing its font size.
- Reduced spacing in the modal header.
- Description area can use substantially more vertical space.
- Tags/hashtags compressed and moved down toward the action area; removed the large empty spacer before FILES/SOURCE.

### v1.0 final15 final candidate
Includes all final14 modal/terminal fixes plus:
- RESET FILTERS moved beside `N RECORDS FOUND` in the TAGS row.
- RESET is visible only when filters/search/non-default sorting are active, using the existing filter-state logic.
- Added rare autonomous interface glitches across filters/tags/controls, approximately every 18–34 seconds.
- Hover glitches remain but are visually calmer so the UI does not feel constantly noisy.

### v1.0 final15b glitch balance
- Autonomous UI glitches remain active without hover, now at irregular ~9–22 second intervals.
- Autonomous glitches skip whichever control/tag is currently under the pointer.
- Repetitive glitch-on-every-hover behavior removed.
- Hover glitch now has only ~18% chance per pointer entry plus a 6.5s cooldown per element, so selecting several tags stays comfortable.

### v1.0 final15c final glitch behavior
- Glitch logic now covers filters, tags, hashtags, modal tags, drawer controls, page-size controls and other archive UI elements.
- Autonomous glitches stay visibly broken and noticeable, but always skip the element currently under the pointer.
- Hover glitch chance reduced to ~8% per pointer entry with a 9s per-element cooldown.
- Hover glitches no longer move/jump the element at all; they use only optical brightness/contrast/text-shadow distortion.
- Result: the site still feels unstable, but rapidly selecting multiple tags/hashtags remains comfortable.

### v1.0 final15d main-page glitch fix
- Catalog/drawer list entries are excluded from the new glitch interaction logic and keep their previous behavior.
- Main page buttons, filters, tags, hashtags, SHOW/page-size controls, modal tags and other small interactive controls keep the improved behavior: visible autonomous glitches, but rare optical-only hover glitches with no jumping.
