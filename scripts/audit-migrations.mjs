import fs from 'node:fs';
import { D1_EXPECTED_SCHEMA } from '../src/d1-schema-status.js';

const errors=[];
const read=p=>fs.readFileSync(p,'utf8');
const fail=(ok,msg)=>{if(!ok)errors.push(msg)};

const migrationFiles=[
  'migrations/0001_baseline.sql',
  'migrations/0002_universe_curation_seed.sql',
  'migrations/0003_hub_storage_normalize.sql',
  'migrations/0004_source_truth_marker.sql',
  'migrations/0009_manual_pov_marker.sql',
  'migrations/0010_suggestion_rate_limit.sql',
  'migrations/0011_public_text_overrides.sql'
];
for(const file of migrationFiles)fail(fs.existsSync(file),`${file}: required migration missing`);

const sql=migrationFiles.filter(fs.existsSync).map(read).join('\n');
const baseline=fs.existsSync(migrationFiles[0])?read(migrationFiles[0]):'';
const sourceTruth=read('src/source-truth.js');

function splitColumns(body){
  const out=[];let start=0,depth=0,quote='';
  for(let i=0;i<body.length;i++){
    const ch=body[i],prev=body[i-1];
    if(quote){if(ch===quote&&prev!=='\\')quote='';continue}
    if(ch==="'"||ch==='"'){quote=ch;continue}
    if(ch==='('){depth++;continue}
    if(ch===')'){depth=Math.max(0,depth-1);continue}
    if(ch===','&&depth===0){out.push(body.slice(start,i));start=i+1}
  }
  out.push(body.slice(start));
  return out;
}
function createdTables(fullSql){
  const tables=new Map();
  const re=/CREATE TABLE IF NOT EXISTS\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*?)\)\s*;/gi;
  let match;
  while((match=re.exec(fullSql))){
    const columns=[];
    for(const part of splitColumns(match[2])){
      const text=part.trim();
      if(!text||/^(?:PRIMARY|UNIQUE|FOREIGN|CHECK|CONSTRAINT)\b/i.test(text))continue;
      const column=text.match(/^["\[]?([A-Za-z_][A-Za-z0-9_]*)/);
      if(column)columns.push(column[1]);
    }
    tables.set(match[1],columns);
  }
  const alter=/ALTER TABLE\s+([A-Za-z_][A-Za-z0-9_]*)\s+ADD COLUMN\s+["\[]?([A-Za-z_][A-Za-z0-9_]*)/gi;
  while((match=alter.exec(fullSql))){if(tables.has(match[1]))tables.get(match[1]).push(match[2])}
  return tables;
}

const tables=createdTables(sql);
for(const [table,expected] of Object.entries(D1_EXPECTED_SCHEMA)){
  const actual=tables.get(table);
  fail(Boolean(actual),`migrations: expected table not created: ${table}`);
  if(!actual)continue;
  const missing=expected.filter(name=>!actual.includes(name));
  const extra=actual.filter(name=>!expected.includes(name));
  fail(!missing.length,`migrations: ${table} missing expected columns: ${missing.join(', ')}`);
  fail(!extra.length,`schema-status: ${table} missing migrated columns in D1_EXPECTED_SCHEMA: ${extra.join(', ')}`);
}

fail(/CREATE TABLE IF NOT EXISTS characters\s*\(\s*id INTEGER PRIMARY KEY AUTOINCREMENT,\s*janitor_uuid TEXT NOT NULL UNIQUE,/m.test(baseline),'0001_baseline.sql: characters must use autoincrement numeric id plus unique janitor_uuid');
fail(sourceTruth.includes("SELECT id,janitor_uuid FROM characters WHERE id>? ORDER BY id LIMIT ?"),'src/source-truth.js: reindex numeric character-id contract missing');
fail(sourceTruth.includes("SELECT COUNT(*) AS n FROM characters WHERE id>?"),'src/source-truth.js: reindex remaining-count numeric id contract missing');
fail(tables.has('archive_schema'),'0004_source_truth_marker.sql: archive_schema marker table missing from migration sequence');

if(errors.length){console.error('\nARCHIVE.EXE migration audit failed:\n- '+errors.join('\n- ')+'\n');process.exit(1)}
console.log(`ARCHIVE.EXE migration audit OK · ${Object.keys(D1_EXPECTED_SCHEMA).length} D1 table contracts + fresh character identity + reindex contract checked`);
