import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { updateAdminCharacter } from '../src/character-admin.js';
import sourceTruth from '../src/source-truth.js';

// Real SQL on an in-memory SQLite built from the migrations, behind a minimal D1 shim.
const db=new DatabaseSync(':memory:');
for(const f of fs.readdirSync('migrations').sort())db.exec(fs.readFileSync(`migrations/${f}`,'utf8'));
const norm=v=>v===undefined?null:v;
const stmt=(sql,args=[])=>({bind:(...a)=>stmt(sql,a),async first(){return db.prepare(sql).get(...args.map(norm))??null},async all(){return{results:db.prepare(sql).all(...args.map(norm))}},async run(){const r=db.prepare(sql).run(...args.map(norm));return{meta:{last_row_id:Number(r.lastInsertRowid),changes:r.changes}}},exec(){return db.prepare(sql).run(...args.map(norm))}});
const env={DB:{prepare:sql=>stmt(sql),async batch(list){db.exec('BEGIN');try{for(const s of list)s.exec();db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}return[]}}};

// saveCharacter is internal to worker.js; evaluate its exact source so the real upsert SQL is exercised.
const workerSrc=fs.readFileSync('src/worker.js','utf8'),start=workerSrc.indexOf('const povKeyW='),end=workerSrc.indexOf('\n',workerSrc.indexOf('async function saveCharacter('));
assert.ok(start>=0,'worker.js: manual POV helpers missing');
const saveCharacter=new Function(`${workerSrc.slice(start,end)}\nreturn saveCharacter;`)();

const UUID='11111111-2222-3333-4444-555555555555',row=(u=UUID)=>db.prepare('SELECT * FROM characters WHERE janitor_uuid=?').get(u),list=v=>JSON.parse(v||'[]');
const card=over=>({janitor_uuid:UUID,slug:'x',name:'Test Bot',author:'Auth',author_url:'',universe:'Source Universe',pov:'FemPOV',tags:['😂 Comedy','👩 FemPov'],hashtags:[],short_description:'s',description:'d',scenario:'',intros:[],image_url:'i',janitor_url:'j',datacat_url:'dc',card_url:'',lorebook_url:'',source:'janitor',status:'published',...over});
const backfill=()=>sourceTruth.fetch(new Request('https://x.test/api/admin/discovery-backfill'),env,{waitUntil(){}});

await saveCharacter(env,card());
assert.equal(row().status,'published');

const edit=await updateAdminCharacter(new Request(`https://x.test/api/admin/characters/${UUID}`,{method:'PATCH',body:JSON.stringify({name:'Test Bot',author:'Auth',tags:['😂 Comedy'],hashtags:[],universes:['Manual World'],setting_ids:['fantasy'],pov:'MalePOV',status:'hidden'})}),env,UUID);
assert.equal(edit.status,200);
assert.deepEqual([row().setting_source,row().pov_source,row().universe_source_field],['admin:manual','admin:manual','admin:manual'],'admin edit must mark Setting/POV/Universe as manual');

await saveCharacter(env,card({description:'fresh source description'}));
let r=row();
assert.equal(r.status,'hidden','re-import must not republish a hidden character');
assert.equal(r.pov,'MalePOV','re-import must keep manual POV');
assert.ok(list(r.tags).some(t=>/MalePov/.test(t))&&!list(r.tags).some(t=>/FemPov/.test(t)),'re-import must keep manual POV tag');
assert.equal(r.universe,'Manual World','re-import must keep manual universe');
assert.deepEqual(list(r.setting_ids),['fantasy'],'re-import must keep manual settings');
assert.equal(r.description,'fresh source description','re-import still refreshes source text');

assert.equal((await backfill()).status,200);
r=row();
assert.deepEqual([list(r.setting_ids),r.setting_source,r.pov,list(r.universes)[0]],[['fantasy'],'admin:manual','MalePOV','Manual World'],'backfill must keep manual classification');

const U2='99999999-2222-3333-4444-555555555555';
await saveCharacter(env,card({janitor_uuid:U2,name:'Fantasy magic kingdom bot',description:'a magic kingdom with dragons'}));
await backfill();
assert.equal(row(U2).setting_source,'rules:v6','untouched records stay automatically classified');

console.log('ARCHIVE.EXE manual override behavior OK · hidden status + manual Setting/POV/Universe survive re-import and backfill, source text still refreshes');
