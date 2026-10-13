import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { lorebookSourceCheck } from '../src/lorebook-source-check.js';
import { guardAdminApi } from '../src/admin-auth.js';

// Read-only admin check of where a bot's lorebooks come from: DataCat's script fields (never the text) and our rows.
const db=new DatabaseSync(':memory:');
const stmt=(sql,args=[])=>({bind:(...a)=>stmt(sql,a),async first(){return db.prepare(sql).get(...args)??null},async all(){return{results:db.prepare(sql).all(...args)}},async run(){db.prepare(sql).run(...args);return{}}});
const env={DB:{prepare:sql=>stmt(sql)},DATACAT_DEVICE_TOKEN:'d',DATACAT_SESSION_TOKEN:'s'};
db.exec(`CREATE TABLE characters(janitor_uuid TEXT PRIMARY KEY,name TEXT);CREATE TABLE lorebooks(id TEXT PRIMARY KEY,title TEXT,source_identity TEXT);CREATE TABLE character_lorebooks(character_uuid TEXT,lorebook_id TEXT,ordinal INTEGER);`);
const BOT='e97c69cd-46e7-4c17-b1f0-019dcd389867',SCRIPT='a0c4abad-86fb-4ff7-961a-e83e5ffcb4b0';
db.prepare('INSERT INTO characters VALUES(?,?)').run(BOT,'Lars');
db.prepare('INSERT INTO lorebooks VALUES(?,?,?)').run('a'.repeat(32),'Hale',`id:${SCRIPT}`);
db.prepare('INSERT INTO character_lorebooks VALUES(?,?,?)').run(BOT,'a'.repeat(32),0);
const before=db.prepare('SELECT * FROM lorebooks').all();
const asked=[],og=globalThis.fetch;
globalThis.fetch=async u=>{asked.push(String(u));return Response.json({character:{name:'Lars',scripts:[{id:SCRIPT,type:'lorebook',title:'Hale',is_public:true,script:'SECRET TEXT'},{id:'x',type:'lorebook',is_code_public:false,script:'HIDDEN'}]}})};
const run=async q=>(await lorebookSourceCheck(new Request(`https://x/api/admin/lorebook-source?q=${encodeURIComponent(q)}`),env)).json();
try{
  let d=await run(`https://janitorai.com/characters/${BOT}_character-lars`);
  assert.equal(d.ok,true);assert.equal(d.read_only,true);assert.equal(d.bots[0].datacat,'FOUND');
  assert.deepEqual(d.bots[0].scripts[0],{id:SCRIPT,type:'lorebook',title:'Hale',is_public:true,scriptLength:11});
  assert.equal(d.bots[0].scripts[1].is_code_public,false);
  assert.ok(!JSON.stringify(d).includes('SECRET')&&!JSON.stringify(d).includes('HIDDEN'),'lorebook text is never shown');
  assert.deepEqual(d.lorebooksInDatabase,{total:1,withSourceId:1,idFields:[{k:'id',n:1}]});
  d=await run(`https://janitorai.com/scripts/${SCRIPT}`);
  assert.equal(d.matchedScript.inOurDatabase,true);assert.equal(d.bots[0].uuid,BOT,'script link finds the bot it belongs to');
  d=await run('nothing');assert.equal(d.error,'LINK_OR_UUID_REQUIRED');
  assert.ok(asked.every(u=>u.startsWith('https://datacat.run/api/characters/recent-public/')),'only the DataCat bot view is read');
  assert.deepEqual(db.prepare('SELECT * FROM lorebooks').all(),before,'nothing changes');
}finally{globalThis.fetch=og}
{const url=new URL('https://archive.example/api/admin/lorebook-source');const blocked=await guardAdminApi(new Request(url),{},url);assert.ok(blocked&&blocked.status>=400,'admin only')}
console.log('Lorebook source OK · read-only admin check: DataCat script fields without text, our stored lorebooks, script link → its bot');
