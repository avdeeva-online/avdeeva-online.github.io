import assert from 'node:assert/strict';
import fs from 'node:fs';
import { embedCard, navigationFailure } from '../src/entry.js';
import { extractEmbeddedCard } from '../src/janny-card.js';

// PNG: our card replaces both the old V2 "chara" and V3 "ccv3" text chunks, so SillyTavern reads the card we serve.
const enc=new TextEncoder(),u32=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255];
const chunk=(type,data)=>[...u32(data.length),...enc.encode(type),...data,0,0,0,0];
const text=(key,obj)=>chunk('tEXt',enc.encode(`${key}\0${Buffer.from(JSON.stringify(obj)).toString('base64')}`));
const stale={spec:'chara_card_v3',data:{name:'Stale'}},fresh={spec:'chara_card_v2',spec_version:'2.0',data:{name:'Fresh — имя',description:'Full definition',first_mes:'Hi'}};
const source=new Uint8Array([137,80,78,71,13,10,26,10,...chunk('IHDR',new Uint8Array(13)),...text('ccv3',stale),...text('chara',stale),...chunk('IEND',new Uint8Array(0))]);
const out=embedCard(source,fresh),body=new TextDecoder('latin1').decode(out);
assert.equal((body.match(/tEXtchara\0/g)||[]).length,1,'exactly one chara chunk');
assert.ok(!body.includes('tEXtccv3\0'),'stale ccv3 chunk removed');
assert.deepEqual(extractEmbeddedCard(out),fresh);
assert.ok(body.indexOf('tEXtchara')<body.indexOf('IEND'),'card chunk sits before IEND');

// Phone downloads open the link directly: a finished file passes through untouched, a failure becomes a readable page.
const nav=new Request('https://x/api/characters/u/card.png',{headers:{'sec-fetch-mode':'navigate',accept:'text/html'}});
const fetchReq=new Request('https://x/api/characters/u/card',{headers:{accept:'*/*'}});
const ok=new Response('png',{status:200,headers:{'content-type':'image/png'}});
assert.equal(await navigationFailure(nav,ok),ok);
const queued=()=>new Response(JSON.stringify({ok:true,state:'RETRIEVAL_QUEUED'}),{status:202,headers:{'content-type':'application/json'}});
let page=await navigationFailure(nav,queued());
assert.equal(page.status,202);assert.match(page.headers.get('content-type'),/text\/html/);
const html=await page.text();assert.match(html,/http-equiv="refresh"/);assert.match(html,/готовится/);
page=await navigationFailure(nav,new Response(JSON.stringify({ok:false,state:'PNG_SOURCE_NOT_AVAILABLE<x>'}),{status:502}));
assert.match(page.headers.get('content-type'),/text\/html/);const err=await page.text();assert.match(err,/PNG_SOURCE_NOT_AVAILABLE&lt;x&gt;/);assert.ok(!/refresh/.test(err));
const api=queued();assert.equal(await navigationFailure(fetchReq,api),api,'site scripts still get JSON');

// Site: on phones the card links are not intercepted, they go straight to the server.
const js=fs.readFileSync(new URL('../public/png-download.js',import.meta.url),'utf8');
assert.match(js,/pointer:coarse/);assert.match(js,/removeAttribute\("download"\)/);

console.log('Card downloads OK · PNG carries only the served card (stale chara/ccv3 removed), phones download straight from the server, failures show a page instead of a saved JSON');
