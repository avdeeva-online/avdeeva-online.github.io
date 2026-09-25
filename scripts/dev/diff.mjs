// Compare two computed-style snapshots: node diff.mjs <dir> <a> <b> [maxLines]
import fs from 'node:fs';
import path from 'node:path';
const [dir, a, b, max = '40'] = process.argv.slice(2);
const load = n => JSON.parse(fs.readFileSync(path.join(dir, n + '.json'), 'utf8'));
const A = load(a), B = load(b);
const onlyA = Object.keys(A.els).filter(k => !(k in B.els)), onlyB = Object.keys(B.els).filter(k => !(k in A.els));
const changes = [];
for (const k of Object.keys(A.els)) {
  if (!(k in B.els)) continue;
  const x = A.els[k], y = B.els[k];
  for (const p of Object.keys(x)) {
    const vx = JSON.stringify(x[p]), vy = JSON.stringify(y[p]);
    if (p !== 'cls' && vx !== vy) changes.push({ k, p, from: x[p], to: y[p], cls: x.cls });
  }
}
console.log(`${a} (${A.count}) vs ${b} (${B.count}) · removed ${onlyA.length} · added ${onlyB.length} · changed props ${changes.length} on ${new Set(changes.map(c => c.k)).size} elements`);
const short = k => k.split('>').slice(-3).join('>');
for (const k of onlyA.slice(0, 8)) console.log('  - REMOVED', short(k), A.els[k].cls);
for (const k of onlyB.slice(0, 8)) console.log('  + ADDED  ', short(k), B.els[k].cls);
for (const c of changes.slice(0, Number(max))) console.log(`  ~ ${short(c.k)} [${String(c.cls).slice(0, 40)}] ${c.p}: ${JSON.stringify(c.from).slice(0, 70)} -> ${JSON.stringify(c.to).slice(0, 70)}`);
