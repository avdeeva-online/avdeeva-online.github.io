import assert from 'node:assert/strict';
import { fetchAvatarPng } from '../src/entry.js';
import { definitionFromEmbeddedCard, extractEmbeddedCard } from '../src/janny-card.js';
import { extractDefinitionFromViews, makeCard } from '../src/worker.js';

const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
const originalFetch=globalThis.fetch;
let fetched='',transformOptions=null,outputOptions=null;

const sourceCard={spec:'chara_card_v2',spec_version:'2.0',data:{name:'Recovered',description:'Full private definition',personality:'Separate personality',first_mes:'Hello',scenario:'Recovered scenario',mes_example:'Example dialogue',creator_notes:'Original creator notes',system_prompt:'Original system prompt',post_history_instructions:'Original post-history instructions',alternate_greetings:['Alt one'],tags:['Source tag'],creator:'Source creator',character_version:'7',character_book:{name:'Embedded lore',entries:[{keys:['archive'],content:'Lore entry',enabled:true}]},extensions:{source_tool:{keep:true}}}};
const encoded=Buffer.from(JSON.stringify(sourceCard),'utf8').toString('base64'),payload=new TextEncoder().encode(`chara\0${encoded}`),type=new TextEncoder().encode('tEXt');
const size=new Uint8Array([payload.length>>>24,(payload.length>>>16)&255,(payload.length>>>8)&255,payload.length&255]),fakePng=new Uint8Array(8+4+4+payload.length+4+12);
fakePng.set([137,80,78,71,13,10,26,10],0);fakePng.set(size,8);fakePng.set(type,12);fakePng.set(payload,16);fakePng.set([0,0,0,0],16+payload.length);fakePng.set([0,0,0,0,73,69,78,68,0,0,0,0],20+payload.length);
assert.deepEqual(extractEmbeddedCard(fakePng),sourceCard);
const completeDefinition={name:'Recovered',description:'Full private definition',personality:'Separate personality',firstMes:'Hello',scenario:'Recovered scenario',mesExample:'Example dialogue',creatorNotes:'Original creator notes',systemPrompt:'Original system prompt',postHistoryInstructions:'Original post-history instructions',alternateGreetings:['Alt one'],tags:['Source tag'],creator:'Source creator',characterVersion:'7',characterBook:sourceCard.data.character_book,extensions:sourceCard.data.extensions};
assert.deepEqual(definitionFromEmbeddedCard(sourceCard),completeDefinition);
const datacatViews={personality:{state:'NOT_AVAILABLE',status:204},greeting:{state:'FOUND',status:200,data:{character:{chara_card_v2_json:sourceCard}}},scenario:{state:'NOT_AVAILABLE',status:204},alt_greetings:{state:'NOT_AVAILABLE',status:204}};
assert.deepEqual(extractDefinitionFromViews(datacatViews),completeDefinition);
const exported=makeCard({name:'Modal name',creator_name:'Modal creator',description:'Public summary',scripts:[{type:'lorebook',is_public:true,is_code_public:true,script:'{}'}]},completeDefinition,'00000000-0000-0000-0000-000000000000');
for(const [key,value] of Object.entries(sourceCard.data))if(!['extensions','tags'].includes(key))assert.deepEqual(exported.data[key],value,`lossless V2 field mismatch: ${key}`);
assert.ok(exported.data.tags.includes('Source tag'));
assert.equal(exported.data.extensions.source_tool.keep,true);
assert.equal(exported.data.extensions.archive_exe.definition_available,true);
assert.equal(exported.data.extensions.archive_exe.export_quality,'complete');
assert.equal(exported.data.extensions.archive_exe.lorebook_separate,true);

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

console.log('ARCHIVE.EXE card source behavior OK · lossless V2 DataCat/PNG recovery + Images binding conversion + PNG signature + host allowlist checked');
