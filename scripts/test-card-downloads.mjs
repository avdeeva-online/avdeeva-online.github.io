import assert from 'node:assert/strict';
import fs from 'node:fs';
import { embedCard, navigationFailure, handleEntryRoute } from '../src/entry.js';
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

// Card files are taken on DataCat: the old /card and /card.png links send the visitor to the bot's DataCat page,
// without asking DataCat for anything ourselves.
{const og=globalThis.fetch,asked=[];globalThis.fetch=async u=>{asked.push(String(u));return new Response('',{status:500})};
try{for(const p of ['card','card.png']){const r=await handleEntryRoute(new Request(`https://x/api/characters/AAAAAAAA-0000-0000-0000-000000000001/${p}`),{},undefined);
  assert.equal(r.status,302);assert.equal(r.headers.get('location'),'https://datacat.run/characters/recent/janitor/aaaaaaaa-0000-0000-0000-000000000001')}
  assert.deepEqual(asked,[],'no request to DataCat')}finally{globalThis.fetch=og}}
{const { jannyPage } = await import('../src/datacat-link.js');
  assert.equal(jannyPage('https://janitorai.com/characters/e97c69cd-46e7-4c17-b1f0-019dcd389867_character-lars-anderson-beast','x'),'https://jannyai.com/characters/e97c69cd-46e7-4c17-b1f0-019dcd389867_character-lars-anderson-beast','JanitorAI link → JannyAI, slug kept');
  assert.equal(jannyPage('https://www.janitorai.com/characters/e97c69cd-46e7-4c17-b1f0-019dcd389867?ref=1','x'),'https://jannyai.com/characters/e97c69cd-46e7-4c17-b1f0-019dcd389867');
  assert.equal(jannyPage('','E97C69CD-46E7-4C17-B1F0-019DCD389867'),'https://jannyai.com/characters/e97c69cd-46e7-4c17-b1f0-019dcd389867','no JanitorAI link: built from the id');
  assert.equal(jannyPage('https://evil.example/characters/x',''),'')}
const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
assert.match(app,/id="downloadDatacat"[^`]*target="_blank"/);assert.match(app,/id="openJanny"[^`]*target="_blank"/);assert.ok(!/id="downloadPng"|id="downloadBot"/.test(app),'no PNG / JSON buttons built by us');

console.log('Card downloads OK · PNG carries only the served card (stale chara/ccv3 removed), phones download straight from the server, failures show a page instead of a saved JSON; card links now open the bot on DataCat');
