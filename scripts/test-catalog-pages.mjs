import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import sourceTruth from '../src/source-truth.js';
import { CATALOG_PAGE } from '../src/catalog-cache.js';

// The catalog is read in pages (one 10000-bot request went over the Worker CPU limit): pages must add up to the
// whole list with no bot twice or missing, even when many bots share the same updated_at; service cards stay out.
const db=new DatabaseSync(':memory:');
for(const f of fs.readdirSync('migrations').sort())db.exec(fs.readFileSync(`migrations/${f}`,'utf8'));
const norm=v=>v===undefined?null:v;
const stmt=(sql,args=[])=>({bind:(...a)=>stmt(sql,a),async first(){return db.prepare(sql).get(...args.map(norm))??null},async all(){return{results:db.prepare(sql).all(...args.map(norm))}},async run(){db.prepare(sql).run(...args.map(norm));return{meta:{}}},exec(){return db.prepare(sql).run(...args.map(norm))}});
const env={DB:{prepare:sql=>stmt(sql),async batch(list){for(const s of list)s.exec();return[]}}};

const N=2*CATALOG_PAGE+57,ins=db.prepare("INSERT INTO characters(janitor_uuid,slug,name,author,status,service,tags,hashtags,updated_at) VALUES(?,?,?,?,?,?,'[]','[]','2026-10-11 10:00:00')");
const uuid=i=>`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
for(let i=0;i<N;i++)ins.run(uuid(i),`bot-${i}`,`Bot ${i}`,'Auth','published',0);
ins.run(uuid(N),'svc','Announcement','Auth','published',1);
ins.run(uuid(N+1),'hidden','Hidden','Auth','hidden',0);

const get=async q=>(await sourceTruth.fetch(new Request(`https://x.test/api/catalog?${q}`),env,{waitUntil(){}})).json();
const first=await get(`limit=${CATALOG_PAGE}&offset=0`);
assert.equal(first.total,N,'total counts published, non-service bots');
const seen=new Set();
for(let offset=0;offset<first.total;offset+=CATALOG_PAGE){
  const page=offset?await get(`limit=${CATALOG_PAGE}&offset=${offset}`):first;
  assert.ok(page.characters.length<=CATALOG_PAGE);
  for(const c of page.characters){assert.ok(!seen.has(c.janitorUuid),`bot ${c.janitorUuid} on two pages`);seen.add(c.janitorUuid)}
}
assert.equal(seen.size,N,'every bot on exactly one page');
assert.ok(!seen.has(uuid(N)),'service card hidden from the catalog');
assert.ok(!seen.has(uuid(N+1)),'hidden bot stays hidden');

console.log(`ARCHIVE.EXE catalog pages OK · ${N} bots in pages of ${CATALOG_PAGE}, none twice or missing, service cards and hidden bots left out`);
