import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { registerHooks } from 'node:module';

// Admin JWT checks are not exercised here; stub 'jose' so the test runs without node_modules.
registerHooks({resolve:(spec,ctx,next)=>spec==='jose'?{url:'data:text/javascript,export const createRemoteJWKSet=()=>null;export const jwtVerify=async()=>{throw new Error(\'stub\')};',shortCircuit:true}:next(spec,ctx)});
const {default:entry}=await import('../src/cloudflare-entry-v2.js');
const {makeCard}=await import('../src/worker.js');

// Public "+ IMPORT" gate: real SQL on an in-memory SQLite built from the migrations, behind a minimal D1 shim.
const db=new DatabaseSync(':memory:');
for(const f of fs.readdirSync('migrations').sort())db.exec(fs.readFileSync(`migrations/${f}`,'utf8'));
const stmt=(sql,args=[])=>({bind:(...a)=>stmt(sql,a),async first(){return db.prepare(sql).get(...args)??null},async all(){return{results:db.prepare(sql).all(...args)}},async run(){db.prepare(sql).run(...args);return{meta:{}}}});
const env={DB:{prepare:sql=>stmt(sql)}},ctx={waitUntil(){}};
const PUBLISHED='11111111-2222-3333-4444-555555555555',HIDDEN='66666666-7777-8888-9999-000000000000';
const insert=db.prepare("INSERT INTO characters (janitor_uuid,slug,name,author,status) VALUES (?,?,?,?,?)");
insert.run(PUBLISHED,'pub','Published Bot','A','published');
insert.run(HIDDEN,'hid','Hidden Bot','A','hidden');

const call=async(path,init)=>{const r=await entry.fetch(new Request(`https://x.test${path}`,init),env,ctx);return{status:r.status,body:await r.json(),csp:r.headers.get('content-security-policy')}};
const post=url=>call('/api/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url})});

let r=await post('https://janitorai.com/characters/not-a-bot');
assert.equal(r.status,400);assert.equal(r.body.error,'INVALID_JANITOR_URL');
assert.ok(r.csp,'public import responses keep the security headers');

r=await call('/api/import',{method:'POST',body:'{broken'});
assert.equal(r.status,400);assert.equal(r.body.error,'INVALID_JSON');

r=await post(`https://janitorai.com/characters/${PUBLISHED.toUpperCase()}_character-published-bot`);
assert.equal(r.status,200);assert.equal(r.body.state,'ALREADY_IN_ARCHIVE','a bot already in the archive is opened, not re-fetched or overwritten');
assert.equal(r.body.janitorUuid,PUBLISHED);

r=await post(`https://janitorai.com/characters/${HIDDEN}`);
assert.equal(r.status,404,'a bot the admin hid must not come back through public import');
assert.equal(db.prepare('SELECT status FROM characters WHERE janitor_uuid=?').get(HIDDEN).status,'hidden');

r=await call(`/api/import/status?uuid=${HIDDEN}`);
assert.equal(r.status,404,'status polling must not expose a hidden bot either');

assert.equal((await call('/api/import')).status,405);
assert.equal((await call(`/api/import/status?uuid=${PUBLISHED}`,{method:'POST'})).status,405);

// Imported cards: the first greeting must not come back as an alternate (whitespace-only difference), junk greetings are dropped.
const greetings=makeCard({name:'X'},{description:'d',firstMes:'Hello feet. \n\nBye',alternateGreetings:['Hello feet.\n\nBye','.','Second']},PUBLISHED).data.alternate_greetings;
assert.deepEqual(greetings,['Second']);

console.log('Public import gate OK · no duplicate or junk greetings');
