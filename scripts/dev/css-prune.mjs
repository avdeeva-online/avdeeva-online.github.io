// Drop selectors matching a regex from every selector list (a rule is removed only when no selector survives),
// then drop @keyframes no longer referenced by any CSS in <cssFiles> or by any JS in <jsDir>.
// usage: node css-prune.mjs <file.css> <selectorRegex> <jsDir> <otherCss...>
import fs from 'node:fs';
import path from 'node:path';

const [file, pattern, jsDir, ...otherCss] = process.argv.slice(2);
const DEAD = new RegExp(pattern);
let src = fs.readFileSync(file, 'utf8');

function splitTop(sel) { const out = []; let depth = 0, start = 0; for (let i = 0; i < sel.length; i++) { const c = sel[i]; if (c === '(' || c === '[') depth++; else if (c === ')' || c === ']') depth--; else if (c === ',' && depth === 0) { out.push(sel.slice(start, i)); start = i + 1; } } out.push(sel.slice(start)); return out; }

function walk(text, visit) { // visit(kind, preludeStart, braceIdx, endIdx, prelude)
  const skipComment = i => text.indexOf('*/', i + 2) + 2;
  const skipString = i => { const q = text[i]; i++; while (i < text.length && text[i] !== q) { if (text[i] === '\\') i++; i++; } return i + 1; };
  const matchBrace = i => { let d = 0; for (; i < text.length; i++) { const c = text[i]; if (c === '/' && text[i + 1] === '*') { i = skipComment(i) - 1; continue; } if (c === '"' || c === "'") { i = skipString(i) - 1; continue; } if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return i + 1; } } throw new Error('unbalanced'); };
  (function block(from, to) {
    let i = from;
    while (i < to) {
      if (/\s/.test(text[i])) { i++; continue; }
      if (text[i] === '/' && text[i + 1] === '*') { i = skipComment(i); continue; }
      let j = i; while (j < to && text[j] !== '{' && text[j] !== ';' && text[j] !== '}') { if (text[j] === '/' && text[j + 1] === '*') { j = skipComment(j); continue; } j++; }
      if (j >= to || text[j] === '}') break;
      if (text[j] === ';') { i = j + 1; continue; }
      const end = matchBrace(j), prelude = text.slice(i, j);
      const p = prelude.replace(/\/\*[\s\S]*?\*\//g, '').trim();
      if (p.startsWith('@media') || p.startsWith('@supports')) block(j + 1, end - 1);
      else visit(p.startsWith('@') ? 'at' : 'rule', i, j, end, prelude);
      i = end;
    }
  })(0, text.length);
}

// 1. selectors
const edits = []; let removedRules = 0, trimmedRules = 0;
walk(src, (kind, start, brace, end, prelude) => {
  if (kind !== 'rule') return;
  const lead = prelude.match(/^(\s*(?:\/\*[\s\S]*?\*\/\s*)*)/)[1];
  const parts = splitTop(prelude.slice(lead.length));
  const keep = parts.filter(s => !DEAD.test(s));
  if (keep.length === parts.length) return;
  if (!keep.length) { edits.push([start + lead.length, end, '']); removedRules++; }
  else { edits.push([start + lead.length, brace, keep.map(s => s.trim()).join(',\n')]); trimmedRules++; }
});
for (const [s, e, r] of edits.sort((a, b) => b[0] - a[0])) src = src.slice(0, s) + r + src.slice(e);

// 2. keyframes nobody references any more
const jsText = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(jsDir, f), 'utf8')).join('\n');
const others = otherCss.map(f => fs.readFileSync(f, 'utf8')).join('\n');
const frames = [];
walk(src, (kind, start, brace, end, prelude) => { const m = prelude.trim().match(/^@(?:-webkit-)?keyframes\s+([\w-]+)/); if (kind === 'at' && m) frames.push({ name: m[1], start, end }); });
const bodyWithout = f => src.slice(0, f.start) + src.slice(f.end);
const dropFrames = frames.filter(f => { const re = new RegExp(`(^|[^\\w-])${f.name}([^\\w-]|$)`); return !re.test(bodyWithout(f).replace(/@(?:-webkit-)?keyframes\s+[\w-]+/g, '')) && !re.test(others) && !re.test(jsText); });
for (const f of dropFrames.sort((a, b) => b.start - a.start)) src = src.slice(0, f.start) + src.slice(f.end);
src = src.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n');
fs.writeFileSync(file, src);
console.log(`rules removed ${removedRules} · selector lists trimmed ${trimmedRules} · unused @keyframes removed ${dropFrames.length} (${dropFrames.map(f => f.name).join(', ')})`);
