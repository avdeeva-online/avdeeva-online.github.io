import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { handlePublicTelegramFull } from '../src/telegram-public-bot.js';

// The public bot uploads lorebooks as files (multipart sendDocument), never as a link for Telegram to fetch.
const db=new DatabaseSync(':memory:');
const stmt=(sql,args=[])=>({bind:(...a)=>stmt(sql,a),async first(){return db.prepare(sql).get(...args)??null},async all(){return{results:db.prepare(sql).all(...args)}},async run(){db.prepare(sql).run(...args);return{}}});
const env={PUBLICnode00bot:'public-token',DB:{prepare:sql=>stmt(sql)}};
db.exec(`CREATE TABLE lorebooks(id TEXT PRIMARY KEY,title TEXT,script TEXT,content_hash TEXT);
CREATE TABLE lorebook_blobs(content_hash TEXT PRIMARY KEY,script TEXT);
CREATE TABLE character_lorebooks(character_uuid TEXT,lorebook_id TEXT,ordinal INTEGER);
CREATE TABLE characters(janitor_uuid TEXT PRIMARY KEY,name TEXT,author TEXT,author_url TEXT,janitor_url TEXT,lorebook_url TEXT,short_description TEXT,universe TEXT,status TEXT,pov TEXT,image_url TEXT,description TEXT,public_about TEXT,scenario TEXT,service INTEGER NOT NULL DEFAULT 0,updated_at TEXT);`);
const uuid='11111111-2222-3333-4444-555555555555';
db.prepare("INSERT INTO characters(janitor_uuid,name,author,author_url,janitor_url,lorebook_url,short_description,universe,status) VALUES(?,?,?,?,?,?,?,?,?)").run(uuid,'Vance','Author','','https://janitorai.com/characters/'+uuid,'https://x/api/characters/'+uuid+'/lorebooks','Short','','published');
db.prepare("INSERT INTO lorebooks VALUES(?,?,?,?)").run('a'.repeat(32),'Hale University','', 'h1');
db.prepare("INSERT INTO lorebook_blobs VALUES(?,?)").run('h1',JSON.stringify({entries:{'0':{uid:0,key:['campus'],keysecondary:[],content:'Campus.'}}}));
db.prepare("INSERT INTO lorebooks VALUES(?,?,?,?)").run('b'.repeat(32),'Hale University',JSON.stringify({entries:[{keys:['dean'],secondary_keys:[],content:'The dean.',enabled:true}]}),'h2');
db.prepare("INSERT INTO character_lorebooks VALUES(?,?,?)").run(uuid,'a'.repeat(32),0);
db.prepare("INSERT INTO character_lorebooks VALUES(?,?,?)").run(uuid,'b'.repeat(32),1);

async function secret(token){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`public|${token}`));return[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,48)}
async function press(data,fetchMock){
  const calls=[],originalFetch=globalThis.fetch;
  globalThis.fetch=async(url,init={})=>{const u=String(url);
    if(u.startsWith('https://api.telegram.org/')){const method=u.split('/').pop();
      if(init.body instanceof FormData){const doc=init.body.get('document');const bytes=new Uint8Array(await doc.arrayBuffer());calls.push({method,filename:doc.name,type:doc.type,bytes,text:new TextDecoder().decode(bytes),caption:init.body.get('caption')})}
      else calls.push({method,payload:JSON.parse(init.body)});
      return new Response(JSON.stringify({ok:true,result:true}),{headers:{'content-type':'application/json'}})}
    return fetchMock?fetchMock(u,init):new Response('not found',{status:404})};
  try{
    const update={callback_query:{id:'cb',data,from:{id:1},message:{message_id:2,chat:{id:3}}}};
    const res=await handlePublicTelegramFull(new Request('https://archive.example/telegram/public',{method:'POST',headers:{'content-type':'application/json','x-telegram-bot-api-secret-token':await secret(env.PUBLICnode00bot)},body:JSON.stringify(update)}),env);
    assert.equal(res.status,200);
  }finally{globalThis.fetch=originalFetch}
  return calls;
}

// The character page offers lorebooks as a bot button, not a link to the JSON API.
{
  const calls=await press(`p:c:${uuid}`),kb=calls.find(c=>c.method==='sendMessage').payload.reply_markup.inline_keyboard.flat();
  assert.ok(kb.some(b=>b.callback_data===`p:lb:${uuid}`),'lorebook button sends files');
  assert.ok(!kb.some(b=>/\/lorebooks/.test(b.url||'')),'no link to the lorebook API');
}

// Lorebooks: one World Info .json per lorebook, duplicate titles numbered.
{
  const calls=await press(`p:lb:${uuid}`),docs=calls.filter(c=>c.method==='sendDocument');
  assert.deepEqual(docs.map(d=>d.filename),['Hale University.json','Hale University (2).json']);
  for(const d of docs){assert.equal(d.type,'application/json');const book=JSON.parse(d.text);assert.ok(book.entries&&!Array.isArray(book.entries));for(const e of Object.values(book.entries))assert.ok(Array.isArray(e.key)&&typeof e.content==='string')}
  assert.deepEqual(Object.values(JSON.parse(docs[1].text).entries)[0].key,['dean']);
  assert.ok(!calls.some(c=>c.method==='sendDocument'&&typeof c.payload?.document==='string'),'never a URL document');
}

// Card files are taken on DataCat: the card has a link button to the bot's DataCat page, and old ⬇ PNG / ⬇ JSON
// buttons answer with that link. The bot never builds a card file or asks DataCat for one.
{
  const card=await press(`p:c:${uuid}`),kb=card.find(c=>c.method==='sendMessage').payload.reply_markup.inline_keyboard.flat();
  assert.ok(kb.some(b=>b.url===`https://datacat.run/characters/recent/janitor/${uuid}`),'card file button opens DataCat');
  assert.ok(!kb.some(b=>/^p:c[pj]:/.test(b.callback_data||'')),'no PNG / JSON file buttons');
  for(const k of ['cp','cj']){
    const asked=[],calls=await press(`p:${k}:${uuid}`,u=>{asked.push(u);return new Response('',{status:404})});
    assert.ok(!calls.some(c=>c.method==='sendDocument'),'no card file is built');assert.deepEqual(asked,[],'nothing is fetched from DataCat');
    const msg=calls.find(c=>c.method==='sendMessage');assert.equal(msg.payload.reply_markup.inline_keyboard[0][0].url,`https://datacat.run/characters/recent/janitor/${uuid}`);
  }
}

console.log('Telegram files OK · public bot uploads lorebooks as World Info .json files (one per lorebook) card files are opened on DataCat');
