import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { jannyCoverage } from '../src/janny-coverage.js';
import { guardAdminApi } from '../src/admin-auth.js';

// Read-only JannyAI coverage check for the admin: which catalog bots JannyAI's public API has, and what its file holds.
const db=new DatabaseSync(':memory:');
const stmt=(sql,args=[])=>({bind:(...a)=>stmt(sql,a),async first(){return db.prepare(sql).get(...args)??null},async all(){return{results:db.prepare(sql).all(...args)}},async run(){db.prepare(sql).run(...args);return{}}});
const env={DB:{prepare:sql=>stmt(sql)}};
db.exec(`CREATE TABLE characters(janitor_uuid TEXT PRIMARY KEY,name TEXT,author TEXT,image_url TEXT,status TEXT);CREATE TABLE character_lorebooks(character_uuid TEXT,lorebook_id TEXT,ordinal INTEGER);`);
const U=i=>`00000000-0000-0000-0000-${String(i).padStart(12,'0')}`;
for(let i=1;i<=18;i++)db.prepare('INSERT INTO characters VALUES(?,?,?,?,?)').run(U(i),`Bot ${i}`,'Alice','https://media.datacat.run/a.webp',i===18?'hidden':'published');
db.prepare('INSERT INTO character_lorebooks VALUES(?,?,?)').run(U(1),'lb',0);
const before=JSON.stringify(db.prepare('SELECT * FROM characters').all());

const u32=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255],chunk=(t,d)=>[...u32(d.length),...new TextEncoder().encode(t),...d,0,0,0,0];
const card={spec:'chara_card_v2',data:{name:'Bot 1',creator:'Alice',description:'Def',first_mes:'Hi',alternate_greetings:['Hey'],tags:['Romance'],character_book:{entries:[]}}};
const png=new Uint8Array([137,80,78,71,13,10,26,10,...chunk('IHDR',new Array(13).fill(0)),...chunk('tEXt',[...new TextEncoder().encode('chara\0'+Buffer.from(JSON.stringify(card)).toString('base64'))]),...chunk('IEND',[])]);
const calls=[],og=globalThis.fetch;
globalThis.fetch=async(url,init={})=>{const s=String(url);calls.push(s);
  if(s==='https://api.jannyai.com/api/v1/download'){const id=JSON.parse(init.body).characterId;return Number(id.slice(-2))%3===0?Response.json({error:'Character not found'},{status:404}):Response.json({downloadUrl:`https://files.jannyai.com/${id}.png`})}
  if(s.startsWith('https://files.jannyai.com/'))return new Response(png,{headers:{'content-type':'image/png'}});
  throw new Error('unexpected '+s)};
try{
  let r=await jannyCoverage(new Request('https://x/api/admin/janny-coverage?offset=0&limit=15&sample=1'),env),d=await r.json();
  assert.equal(d.ok,true);assert.equal(d.read_only,true);assert.equal(d.total,17,'hidden bots are not counted');assert.equal(d.results.length,15);assert.equal(d.next,15);
  const one=d.results.find(x=>x.uuid===U(1));assert.equal(one.found,true);assert.equal(one.downloadHost,'files.jannyai.com');assert.equal(one.ourLorebooks,1);assert.equal(one.ourAvatarHost,'media.datacat.run');
  assert.deepEqual({description:one.card.description,firstMes:one.card.firstMes,altGreetings:one.card.altGreetings,tags:one.card.tags,lorebookEntries:one.card.lorebookEntries,scenario:one.card.scenario},{description:true,firstMes:true,altGreetings:1,tags:1,lorebookEntries:0,scenario:false});
  const three=d.results.find(x=>x.uuid===U(3));assert.equal(three.found,false);assert.equal(three.error,'HTTP_404');assert.equal(three.detail,'Character not found');
  r=await jannyCoverage(new Request('https://x/api/admin/janny-coverage?offset=15&limit=15&sample=0'),env);d=await r.json();
  assert.equal(d.results.length,2);assert.equal(d.next,null);assert.ok(d.results.every(x=>!x.card),'no file download without sample');
  assert.ok(calls.every(c=>c.startsWith('https://api.jannyai.com/')||c.startsWith('https://files.jannyai.com/')),'only JannyAI is contacted — never DataCat');
  assert.equal(JSON.stringify(db.prepare('SELECT * FROM characters').all()),before,'nothing in the database changes');
}finally{globalThis.fetch=og}
// The route lives under /api/admin/, so the shared admin guard blocks it without a Cloudflare Access login.
{const url=new URL('https://archive.example/api/admin/janny-coverage');const blocked=await guardAdminApi(new Request(url),{},url);assert.ok(blocked&&blocked.status>=400,'admin only')}
console.log('JannyAI coverage OK · read-only admin check: found / not found per bot, card fields from the JannyAI file, never touches DataCat or the database');
