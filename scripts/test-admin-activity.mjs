import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { isLoggedAdminWrite, logAdminWrite, adminActivity } from '../src/admin-activity.js';

const db=new DatabaseSync(':memory:');
for(const f of fs.readdirSync('migrations').sort())db.exec(fs.readFileSync(`migrations/${f}`,'utf8'));
const stmt=(sql,args=[])=>({bind:(...a)=>stmt(sql,a),async first(){return db.prepare(sql).get(...args)??null},async all(){return{results:db.prepare(sql).all(...args)}},async run(){db.prepare(sql).run(...args);return{}}});
const env={DB:{prepare:sql=>stmt(sql)}};
const req=(path,method,body,headers={})=>new Request(`https://x.test${path}`,{method,headers:{'content-type':'application/json',...headers},body:body?JSON.stringify(body):undefined});

// Only admin writes are logged; reads and the log endpoint itself are not.
assert.equal(isLoggedAdminWrite(req('/api/admin/codex-styles','GET'),new URL('https://x.test/api/admin/codex-styles')),false);
assert.equal(isLoggedAdminWrite(req('/api/admin/codex-styles','POST',{}),new URL('https://x.test/api/admin/codex-styles')),true);
assert.equal(isLoggedAdminWrite(req('/api/catalog','POST',{}),new URL('https://x.test/api/catalog')),false);

// A write: who, from where, what — without secrets or picture data.
const w=req('/api/admin/codex-styles','POST',{action:'set',title:'Dressy',apiKey:'SECRET-123',token:'t0k',image:'data:image/png;base64,AAAA',images:[{data:'data:image/png;base64,AAAA'}],source_url:'https://t.me/x/1'},{'cf-access-authenticated-user-email':'owner@example.com','cf-connecting-ip':'203.0.113.5','cf-ipcountry':'DE'});
await logAdminWrite(env,w,new Response('{}',{status:200}),new URL(w.url));
// A refused attempt without an Access login is recorded too.
const bad=req('/api/admin/characters/abc','DELETE',null);
await logAdminWrite(env,bad,new Response('{}',{status:403}),new URL(bad.url));

const row=db.prepare('SELECT * FROM admin_audit_log ORDER BY id').all();
assert.equal(row.length,2);
assert.equal(row[0].actor,'owner@example.com');assert.equal(row[0].country,'DE');assert.equal(row[0].status,200);
assert.match(row[0].detail,/action=set/);assert.match(row[0].detail,/title=Dressy/);assert.match(row[0].detail,/images=1/);
assert.ok(!/SECRET|t0k|base64/.test(row[0].detail),'no keys, tokens or picture data in the log: '+row[0].detail);
assert.equal(row[1].actor,'(no Access login)');assert.equal(row[1].status,403);assert.equal(row[1].method,'DELETE');

// The 24 h view: log, actors, data changes.
db.prepare("INSERT INTO hub_resources(id,source_url,type,title,status) VALUES('r1','https://t.me/x/2','preset','Fresh preset','published')").run();
const view=await (await adminActivity(new Request('https://x.test/api/admin/activity?hours=24'),env)).json();
assert.equal(view.ok,true);assert.equal(view.log.length,2);
assert.deepEqual(view.actors.map(a=>a.actor).sort(),['(no Access login)','owner@example.com']);
assert.equal(view.changes.hub[0].title,'Fresh preset');
console.log('ARCHIVE.EXE admin activity OK · writes logged with actor/country/status, refused attempts logged, no secrets or picture data, 24 h changes view');
