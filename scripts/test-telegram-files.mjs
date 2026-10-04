import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { handlePublicTelegramFull } from '../src/telegram-public-bot.js';

// The public bot uploads lorebooks and cards as files (multipart sendDocument), never as a link for Telegram to fetch.
const db=new DatabaseSync(':memory:');
const stmt=(sql,args=[])=>({bind:(...a)=>stmt(sql,a),async first(){return db.prepare(sql).get(...args)??null},async all(){return{results:db.prepare(sql).all(...args)}},async run(){db.prepare(sql).run(...args);return{}}});
const env={PUBLICnode00bot:'public-token',DB:{prepare:sql=>stmt(sql)}};
db.exec(`CREATE TABLE lorebooks(id TEXT PRIMARY KEY,title TEXT,script TEXT,content_hash TEXT);
CREATE TABLE lorebook_blobs(content_hash TEXT PRIMARY KEY,script TEXT);
CREATE TABLE character_lorebooks(character_uuid TEXT,lorebook_id TEXT,ordinal INTEGER);
CREATE TABLE characters(janitor_uuid TEXT PRIMARY KEY,name TEXT,author TEXT,author_url TEXT,janitor_url TEXT,lorebook_url TEXT,short_description TEXT,universe TEXT,status TEXT);`);
const uuid='11111111-2222-3333-4444-555555555555';
db.prepare("INSERT INTO characters VALUES(?,?,?,?,?,?,?,?,?)").run(uuid,'Vance','Author','','https://janitorai.com/characters/'+uuid,'https://x/api/characters/'+uuid+'/lorebooks','Short','','published');
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
  const calls=await press(`p:c:${uuid}`),kb=calls.find(c=>c.method==='editMessageText').payload.reply_markup.inline_keyboard.flat();
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

// Card the source cannot provide: a clear message with a retry button, not a broken file or a raw link.
{
  const calls=await press(`p:cp:${uuid}`);
  assert.ok(!calls.some(c=>c.method==='sendDocument'),'no file when the card could not be built');
  const msg=calls.find(c=>c.method==='sendMessage');assert.ok(msg,'explains the failure');
  assert.match(msg.payload.text,/PNG/);assert.ok(!/https?:\/\//.test(msg.payload.text),'no raw API link');
  assert.equal(msg.payload.reply_markup.inline_keyboard[0][0].callback_data,`p:cp:${uuid}`);
}

// Card built from the source: uploaded as a checked file with the real name — PNG with the card inside, JSON parsed.
{
  const u32=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255],chunk=(t,d)=>[...u32(d.length),...new TextEncoder().encode(t),...d,0,0,0,0];
  const avatar=new Uint8Array([137,80,78,71,13,10,26,10,...chunk('IHDR',new Array(13).fill(0)),...chunk('IEND',[])]);
  const views={modal:{character:{name:'Vance',creator_name:'Author',description:'About',avatar:'https://media.datacat.run/a.png',tab_availability:{scenario:false,alt_greetings:false}}},personality:{personality:'Full definition'},greeting:{first_mes:'Hello there'}};
  const source=u=>{if(u.startsWith('https://datacat.run/api/')){const v=new URL(u).searchParams.get('view');return views[v]?Response.json(views[v]):new Response('',{status:404})}if(u.startsWith('https://media.datacat.run/'))return new Response(avatar,{headers:{'content-type':'image/png'}});return new Response('',{status:404})};
  env.DATACAT_DEVICE_TOKEN='d';env.DATACAT_SESSION_TOKEN='s';
  try{
    const { extractEmbeddedCard } = await import('../src/janny-card.js');
    let calls=await press(`p:cj:${uuid}`,source),doc=calls.find(c=>c.method==='sendDocument');
    assert.ok(doc,'JSON card uploaded');assert.match(doc.filename,/^Vance.*\.json$/);assert.equal(doc.type,'application/json');
    const card=JSON.parse(doc.text);assert.equal(card.spec,'chara_card_v2');assert.equal(card.data.description,'Full definition');assert.equal(card.data.first_mes,'Hello there');
    calls=await press(`p:cp:${uuid}`,source);doc=calls.find(c=>c.method==='sendDocument');
    assert.ok(doc,'PNG card uploaded');assert.match(doc.filename,/^Vance.*\.png$/);assert.equal(doc.type,'image/png');
    const embedded=extractEmbeddedCard(doc.bytes);assert.equal(embedded?.data?.name,'Vance');assert.equal(embedded.data.description,'Full definition');
    assert.ok(doc.caption.includes('PNG'));
  }finally{delete env.DATACAT_DEVICE_TOKEN;delete env.DATACAT_SESSION_TOKEN}
}

console.log('Telegram files OK · public bot uploads lorebooks as World Info .json files (one per lorebook) and cards as checked files, never as links');
