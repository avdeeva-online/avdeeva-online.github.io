// Remove CSS declarations that can never win the cascade across stylesheets loaded in a fixed order:
// an earlier `selector { prop }` is dead when a later rule with the identical selector sets the same prop,
// with importance >= the earlier one, in the same @media context or at top level (which always applies).
// Only the dead declarations (and rules left empty) are cut; every other byte of each file is kept.
// usage: node css-dedupe.mjs <outDir> <file1.css> [file2.css ...]   (files in page load order)
import fs from 'node:fs';
import path from 'node:path';

const [outDir, ...files] = process.argv.slice(2);
// Whitespace is only insignificant around , > + ~ ( ) — a space before ":" is a descendant combinator ("div :hover").
const norm = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([,>+~(){}])\s*/g, '$1').trim();

function parseFile(src, fileIdx) {
  const decls = [], rules = [];
  const skipComment = i => src.indexOf('*/', i + 2) + 2;
  const skipString = i => { const q = src[i]; i++; while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; } return i + 1; };
  const matchBrace = i => { let depth = 0; for (; i < src.length; i++) { const c = src[i]; if (c === '/' && src[i + 1] === '*') { i = skipComment(i) - 1; continue; } if (c === '"' || c === "'") { i = skipString(i) - 1; continue; } if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) return i + 1; } } throw new Error('unbalanced'); };
  function parseDecls(from, to, ctx, sel, ruleId) {
    let start = from, paren = 0;
    const flush = end => { const clean = src.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, '').trim(); if (!clean) return; const colon = clean.indexOf(':'); if (colon <= 0) return; const value = clean.slice(colon + 1).replace(/;$/, ''); decls.push({ fileIdx, ctx, sel, prop: clean.slice(0, colon).trim().toLowerCase(), value, important: /!\s*important\s*$/i.test(value), start, end, ruleId }); };
    for (let i = from; i < to; i++) { const c = src[i]; if (c === '/' && src[i + 1] === '*') { i = skipComment(i) - 1; continue; } if (c === '"' || c === "'") { i = skipString(i) - 1; continue; } if (c === '(') paren++; else if (c === ')') paren--; else if (c === ';' && paren === 0) { flush(i + 1); start = i + 1; } }
    flush(to);
  }
  function parseBlock(from, to, ctx) {
    let i = from;
    while (i < to) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '/' && src[i + 1] === '*') { i = skipComment(i); continue; }
      let j = i;
      while (j < to && src[j] !== '{' && src[j] !== ';' && src[j] !== '}') { if (src[j] === '/' && src[j + 1] === '*') { j = skipComment(j); continue; } if (src[j] === '"' || src[j] === "'") { j = skipString(j); continue; } j++; }
      if (j >= to || src[j] === '}') break;
      if (src[j] === ';') { i = j + 1; continue; }
      const end = matchBrace(j), p = norm(src.slice(i, j));
      if (p.startsWith('@media')) parseBlock(j + 1, end - 1, [...ctx, p]);
      else if (!p.startsWith('@')) { const id = rules.length; rules.push({ id, start: i, end }); parseDecls(j + 1, end - 1, ctx.join(' && '), p, id); }
      i = end;
    }
  }
  parseBlock(0, src.length, []);
  return { decls, rules };
}

const parsed = files.map((f, idx) => ({ file: f, src: fs.readFileSync(f, 'utf8'), ...parseFile(fs.readFileSync(f, 'utf8'), idx) }));
const all = parsed.flatMap(p => p.decls); // already in load order: file order, then source order
const FALLBACK = /(^-webkit-|^-moz-|^-ms-)|dvh|svh|lvh|-webkit-|-moz-/i;
const dead = new Set(), later = new Map();
for (let n = all.length - 1; n >= 0; n--) {
  const d = all[n];
  if (FALLBACK.test(d.prop) || FALLBACK.test(d.value)) continue;
  const key = d.sel + '|' + d.prop, list = later.get(key) || [];
  if (list.some(l => (l.ctx === d.ctx || l.ctx === '') && (l.important || !d.important))) dead.add(d);
  list.push(d); later.set(key, list);
}
fs.mkdirSync(outDir, { recursive: true });
for (const p of parsed) {
  const live = new Map(); p.decls.forEach(d => { if (!dead.has(d)) live.set(d.ruleId, (live.get(d.ruleId) || 0) + 1); });
  const emptied = new Set(p.rules.filter(r => !live.get(r.id) && p.decls.some(d => d.ruleId === r.id && dead.has(d))).map(r => r.id));
  const cuts = [...p.rules.filter(r => emptied.has(r.id)).map(r => [r.start, r.end]), ...p.decls.filter(d => dead.has(d) && !emptied.has(d.ruleId)).map(d => [d.start, d.end])].sort((a, b) => b[0] - a[0]);
  let out = p.src; for (const [s, e] of cuts) out = out.slice(0, s) + out.slice(e);
  out = out.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n');
  fs.writeFileSync(path.join(outDir, path.basename(p.file)), out);
  console.log(`${path.basename(p.file)}: declarations ${p.decls.length} · dead ${p.decls.filter(d => dead.has(d)).length} · emptied rules ${emptied.size} · ${p.src.length} → ${out.length}`);
}
