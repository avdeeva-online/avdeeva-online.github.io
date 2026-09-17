import fs from 'node:fs';

const errors=[];
const read=p=>fs.readFileSync(p,'utf8');
const fail=(ok,msg)=>{if(!ok)errors.push(msg)};

const baseline=read('migrations/0001_baseline.sql');
const sourceTruth=read('src/source-truth.js');

fail(/CREATE TABLE IF NOT EXISTS characters\s*\(\s*id INTEGER PRIMARY KEY AUTOINCREMENT,\s*janitor_uuid TEXT NOT NULL UNIQUE,/m.test(baseline),'0001_baseline.sql: characters must use autoincrement numeric id plus unique janitor_uuid');
fail(sourceTruth.includes("SELECT id,janitor_uuid FROM characters WHERE id>? ORDER BY id LIMIT ?"),'src/source-truth.js: reindex numeric character-id contract missing');
fail(sourceTruth.includes("SELECT COUNT(*) AS n FROM characters WHERE id>?"),'src/source-truth.js: reindex remaining-count numeric id contract missing');

for(const file of ['migrations/0001_baseline.sql','migrations/0002_universe_curation_seed.sql','migrations/0003_hub_storage_normalize.sql','migrations/0004_source_truth_marker.sql']){
  fail(fs.existsSync(file),`${file}: required migration missing`);
}

if(errors.length){console.error('\nARCHIVE.EXE migration audit failed:\n- '+errors.join('\n- ')+'\n');process.exit(1)}
console.log('ARCHIVE.EXE migration audit OK · fresh characters identity + reindex contract checked');
