import assert from 'node:assert/strict';
import { fetchAvatarPng } from '../src/entry.js';

const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
const originalFetch=globalThis.fetch;
let fetched='',transformOptions=null,outputOptions=null;

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

console.log('ARCHIVE.EXE PNG source behavior OK · Images binding conversion + PNG signature + host allowlist checked');
