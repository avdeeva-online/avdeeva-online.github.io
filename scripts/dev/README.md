# Dev tools: safe CSS/JS cleanup with visual regression checks

Not part of `npm run check`. Used to prove a cleanup changes nothing on screen.

1. `node scripts/dev/serve.mjs public 8787 <snapDir>` — serves `public/` locally, proxies `/api/*` GETs to production, accepts snapshots.
2. Open `http://localhost:8787/characters.html`, inject `/__snap.js`, run `__shot('base_d_catalog')` (actions: `modal`, `drawer`, `drawerAuthors`, `author`, `hashtags`, `hubModal`). Take baselines at 1280×900 and 375×812.
3. Change CSS/JS, take the same shots with a new prefix, then `node scripts/dev/diff.mjs <snapDir> base_x new_x`.

To test the production CSP locally, start the server with `PREVIEW_CSP="<policy from cloudflare-entry-v2.js>"` and watch the console for `Content Security Policy` violations (absolute production URLs in API data are cross-origin locally — not real violations).

Gotchas: the browser tab must be **visible** — hidden tabs skip `requestAnimationFrame` and lazy images, which looks like a regression. Easter-egg anomalies and the modal prev/next arrows (±3px) vary run to run; compare two baseline runs to see the noise floor.

- `css-dedupe.mjs <outDir> <css...>` — removes declarations that can never win the cascade (same selector + property later, same or broader media, importance ≥). Files in page load order.
- `css-prune.mjs <file.css> <selectorRegex> <jsDir> <otherFiles...>` — drops selectors of removed markup from selector lists, then `@keyframes` nothing references.
