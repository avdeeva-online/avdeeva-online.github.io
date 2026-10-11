import assert from 'node:assert/strict';
import { withAvatar } from '../src/entry.js';

// The JSON download carries the avatar inside (Character Card V3 "icon" asset): JPEG from the Images binding,
// else the source bytes, else the https link; a card without an avatar is left as it is.
const webp=new Uint8Array([82,73,70,70,0,0,0,0,87,69,66,80,1,2,3]),jpeg=new Uint8Array([0xff,0xd8,0xff,0xe0,9,9]);
const card=()=>({spec:'chara_card_v2',spec_version:'2.0',data:{name:'Vuk',first_mes:'hi',extensions:{archive_exe:{avatar_url:'https://media.datacat.run/a/card.webp'}}}});
globalThis.fetch=async()=>new Response(webp,{headers:{'content-type':'image/webp'}});
const images={input:()=>({transform:()=>({output:async()=>({response:()=>new Response(jpeg)})})})};
let c=await withAvatar(card(),{IMAGES:images});
assert.equal(c.spec,'chara_card_v3');assert.equal(c.spec_version,'3.0');assert.equal(c.data.first_mes,'hi','V2 fields kept');assert.deepEqual(c.data.group_only_greetings,[]);
assert.equal(c.data.assets[0].type,'icon');assert.equal(c.data.assets[0].name,'main');assert.ok(c.data.assets[0].uri.startsWith('data:image/jpeg;base64,/9j/'));
c=await withAvatar(card(),{});assert.ok(c.data.assets[0].uri.startsWith('data:image/webp;base64,UklGR'),'no Images binding: source bytes');
globalThis.fetch=async()=>new Response('x',{status:404});c=await withAvatar(card(),{});assert.equal(c.data.assets[0].uri,'https://media.datacat.run/a/card.webp','unreadable picture: its link');
const plain={spec:'chara_card_v2',data:{name:'X',extensions:{}}};assert.equal(await withAvatar(plain,{}),plain,'no avatar: unchanged');
console.log('ARCHIVE.EXE JSON avatar OK · V3 icon asset embedded (JPEG / source bytes / link fallback), V2 fields kept');
