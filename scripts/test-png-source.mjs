import assert from 'node:assert/strict';
import { fetchAvatarPng } from '../src/entry.js';
import { definitionFromEmbeddedCard, extractEmbeddedCard } from '../src/janny-card.js';

const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
const originalFetch=globalThis.fetch;
let fetched='',transformOptions=null,outputOptions=null;

const sourceCard={spec:'chara_card_v2',spec_version:'2.0',data:{name:'Recovered',description:'Full private definition',first_mes:'Hello',scenario:'Recovered scenario',alternate_greetings:['Alt one']}};
const encoded=Buffer.from(JSON.stringify(sourceCard),'utf8').toString('base64'),payload=new TextEncoder().encode(`chara\0${encoded}`),type=new TextEncoder().encode('tEXt');
const size=new Uint8Array([payload.length>>>24,(payload.length>>>16)&255,(payload.length>>>8)&255,payload.length&255]),fakePng=new Uint8Array(8+4+4+payload.length+4+12);
fakePng.set([137,80,78,71,13,10,26,10],0);fakePng.set(size,8);fakePng.set(type,12);fakePng.set(payload,16);fakePng.set([0,0,0,0],16+payload.length);fakePng.set([0,0,0,0,73,69,78,68,0,0,0,0],20+payload.length);
assert.deepEqual(extractEmbeddedCard(fakePng),sourceCard);
assert.deepEqual(definitionFromEmbeddedCard(sourceCard),{personality:'Full private definition',firstMes:'Hello',scenario:'Recovered scenario',mesExample:'',alternateGreetings:['Alt one']});

try{
  globalThis.fetch=async url=>{fetched=String(url);return new Response(new Uint8Array([82,73,70,70,0,0,0,0,87,69,66,80]),{status:200,headers:{'content-type':'image/webp'}})};
  const handle={
    transform(options){transformOptions=options;return this},
    async output(options){outputOptions=options;return{response:()=>new Response(png,{status:200,headers:{'content-type':'image/png'}})}}
  };
  const images={input(stream){assert.ok(stream instanceof ReadableStream);return handle}};
  const result=await fetchAvatarPng('https://media.datacat.run/media/avatar.webp',images);
  assert.equal(result.ok,true);
  assert.equal(fetched,'https://media.datacat.run/media/avatar.webp');
  assert.deepEqual(transformOptions,{fit:'scale-down',width:1600,height:2400});
  assert.deepEqual(outputOptions,{format:'image/png',anim:false});
  assert.deepEqual([...result.bytes.slice(0,8)],[137,80,78,71,13,10,26,10]);

  fetched='';
  const blocked=await fetchAvatarPng('https://example.com/avatar.webp',images);
  assert.deepEqual(blocked,{ok:false,state:'AVATAR_HOST_NOT_ALLOWED'});
  assert.equal(fetched,'','blocked image hosts must not be fetched');
}finally{globalThis.fetch=originalFetch}

console.log('ARCHIVE.EXE PNG source behavior OK · embedded card recovery + Images binding conversion + PNG signature + host allowlist checked');
