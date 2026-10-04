import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { handleCodexProfilesRoute } from '../src/codex-profiles.js';

// Real SQL on an in-memory SQLite built from the migrations, behind a minimal D1 shim; R2 is a Map.
const db=new DatabaseSync(':memory:');
for(const f of fs.readdirSync('migrations').sort())db.exec(fs.readFileSync(`migrations/${f}`,'utf8'));
const stmt=(sql,args=[])=>({bind:(...a)=>stmt(sql,a),async first(){return db.prepare(sql).get(...args)??null},async all(){return{results:db.prepare(sql).all(...args)}},async run(){db.prepare(sql).run(...args);return{}},exec(){return db.prepare(sql).run(...args)}});
const r2=new Map();
const env={DB:{prepare:sql=>stmt(sql),async batch(list){for(const s of list)s.exec();return[]}},HUB_FILES:{async put(k,v,o){r2.set(k,{bytes:new Uint8Array(v),type:o?.httpMetadata?.contentType})},async get(k){const x=r2.get(k);return x?{body:x.bytes,httpMetadata:{contentType:x.type}}:null},async delete(k){r2.delete(k)}}};
const call=async(path,body)=>{const res=await handleCodexProfilesRoute(new Request(`https://x.test${path}`,body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{}),env);return{status:res.status,data:await res.json().catch(()=>null),res}};
const png=`data:image/png;base64,${Buffer.from([137,80,78,71,1,2,3]).toString('base64')}`;

// Styles: create with a picture, list in order, prompt kept as written.
const a=await call('/api/admin/codex-styles',{action:'set',title:'Dressy Shorts',prompt:'clothes: tailored pinstripe bermuda shorts,\npearl drop earrings',model:'NovelAI v4.5',author:'@SATURIC',image:png});
assert.equal(a.status,200,JSON.stringify(a.data));
const b=await call('/api/admin/codex-styles',{action:'set',title:'Soft light',prompt:'soft rim light',model:'Nano Banana'});
let list=(await call('/api/codex-styles')).data.styles;
assert.deepEqual(list.map(s=>s.title),['Dressy Shorts','Soft light']);
assert.equal(list[0].prompt,'clothes: tailored pinstripe bermuda shorts,\npearl drop earrings','line breaks in the prompt are kept');
assert.equal(list[0].author,'SATURIC');assert.ok(list[0].image_url.startsWith('/api/codex-image?'));assert.equal(list[1].image_url,'');
const img=await call(list[0].image_url.replace('https://x.test',''));assert.equal(img.res.status,200);assert.equal(img.res.headers.get('content-type'),'image/png');

// Reorder, replace the picture (old object removed), refuse non-images and empty prompts.
await call('/api/admin/codex-styles',{action:'move',id:b.data.id,dir:-1});
assert.deepEqual((await call('/api/codex-styles')).data.styles.map(s=>s.title),['Soft light','Dressy Shorts']);
const png2=`data:image/png;base64,${Buffer.from([137,80,78,71,9,9]).toString('base64')}`;
await call('/api/admin/codex-styles',{action:'set',id:a.data.id,title:'Dressy Shorts',prompt:'x',image:png2});
assert.equal([...r2.keys()].filter(k=>k.startsWith('codex/styles/')).length,1,'replacing the picture leaves one object');
assert.equal((await call('/api/admin/codex-styles',{action:'set',title:'Bad',prompt:'x',image:'data:text/html;base64,PGI+'})).status,400);
assert.equal((await call('/api/admin/codex-styles',{action:'set',title:'No prompt',prompt:''})).status,400);
assert.equal((await call('/api/codex-image?key=../secret')).status,400,'only codex/ keys are served');

// Delete removes the row and its picture.
await call('/api/admin/codex-styles',{action:'delete',id:a.data.id});
assert.deepEqual((await call('/api/codex-styles')).data.styles.map(s=>s.title),['Soft light']);
assert.equal([...r2.keys()].filter(k=>k.startsWith('codex/styles/')).length,0);

// Author avatar: set, kept when omitted on a later save, removed with ''.
await call('/api/admin/codex-profiles',{action:'set',kind:'author',name:'floryhibi',description:'Hi',avatar:png});
let p=(await call('/api/codex-profiles')).data.profiles.find(x=>x.name==='floryhibi');assert.ok(p.avatar_url);
await call('/api/admin/codex-profiles',{action:'set',kind:'author',name:'floryhibi',description:'Hi again'});
p=(await call('/api/codex-profiles')).data.profiles.find(x=>x.name==='floryhibi');assert.ok(p.avatar_url,'avatar kept when not sent');assert.equal(p.description,'Hi again');
await call('/api/admin/codex-profiles',{action:'set',kind:'author',name:'floryhibi',description:'Hi again',avatar:''});
p=(await call('/api/codex-profiles')).data.profiles.find(x=>x.name==='floryhibi');assert.equal(p.avatar_url,'');
assert.equal([...r2.keys()].filter(k=>k.startsWith('codex/avatars/')).length,0);

console.log('ARCHIVE.EXE CODEX OK · styles (order, picture replace/delete, prompt kept, images only) + author avatars (set / keep / remove)');
