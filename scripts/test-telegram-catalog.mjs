import assert from 'node:assert/strict';
import { handlePublicTelegramFull } from '../src/telegram-public-bot.js';
import { resetCatalogMemo, valueHash } from '../src/telegram-catalog.js';

// The public bot browses the site's catalog: filters by author / universe / setting / POV / tag,
// and opens a bot as its avatar photo with the description and every action under it.
const U=i=>`00000000-0000-0000-0000-${String(i).padStart(12,'0')}`;
const bot=(i,o={})=>({janitorUuid:U(i),nameEn:`Bot ${i}`,author:'Alice',authorUrl:'https://janitorai.com/profiles/alice',universe:'Hale University',universes:['Hale University'],settings:['Modern'],pov:'FemPOV',tags:['Romance'],short:`Hook of bot ${i}`,image:'https://media.datacat.run/a.webp',url:`https://janitorai.com/characters/${U(i)}`,lorebookCount:0,...o});
const characters=[...Array.from({length:10},(_,i)=>bot(i+1)),bot(11,{author:'Bob',universe:'Marvel',universes:['Marvel','Avengers'],settings:['Fantasy','Modern'],pov:'AnyPOV',tags:['Action','Romance'],lorebookCount:2,short:'x'.repeat(2000)})];
const catalog=()=>Response.json({ok:true,characters});
const env={PUBLICnode00bot:'public-token',DB:{prepare:()=>({first:async()=>({n:0}),all:async()=>({results:[]}),bind:()=>({first:async()=>({description:'Full description of Bob\'s bot.',public_about:'',scenario:''}),all:async()=>({results:[]})})})}};

async function secret(token){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`public|${token}`));return[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,48)}
async function press(data,{photoFails=false,text=null,route=null,cbMessage=null}={}){
  const calls=[],originalFetch=globalThis.fetch;
  globalThis.fetch=async(url,init={})=>{const u=String(url);if(u.startsWith('https://api.telegram.org/')){const method=u.split('/').pop(),payload=init.body instanceof FormData?Object.fromEntries(init.body):JSON.parse(init.body);calls.push({method,payload});
      if(photoFails&&method==='sendPhoto')return Response.json({ok:false,description:'Bad Request: wrong file identifier/HTTP URL specified'},{status:400});
      return Response.json({ok:true,result:method==='getMe'?{username:'Node00Bot'}:true})}
    return new Response('',{status:404})};
  try{
    const update=text!=null?{message:{message_id:7,chat:{id:3},from:{id:1,username:'reader'},text}}:{callback_query:{id:'cb',data,from:{id:1,username:'reader'},message:cbMessage||{message_id:2,chat:{id:3}}}};
    const res=await handlePublicTelegramFull(new Request('https://archive.example/telegram/public',{method:'POST',headers:{'content-type':'application/json','x-telegram-bot-api-secret-token':await secret(env.PUBLICnode00bot)},body:JSON.stringify(update)}),env,{catalog,...(route?{route}:{})});
    assert.equal(res.status,200);
  }finally{globalThis.fetch=originalFetch}
  return calls;
}
const shown=calls=>calls.find(c=>c.method==='editMessageText')?.payload;
const buttons=p=>p.reply_markup.inline_keyboard.flat();
resetCatalogMemo();

// Home → catalog opens the filter menu.
{const p=shown(await press('p:fm'));const cbs=buttons(p).map(b=>b.callback_data);for(const k of ['p:chars:0','p:fl:a:0','p:fl:u:0','p:fl:s:0','p:fl:p:0','p:fl:t:0'])assert.ok(cbs.includes(k),k);assert.match(p.text,/11 ботов/)}

// Facet values with counts, most bots first; universes count every universe a bot belongs to.
{const p=shown(await press('p:fl:a:0'));assert.deepEqual(buttons(p).filter(b=>/^p:fv:/.test(b.callback_data)).map(b=>b.text),['Alice · 10','Bob · 1'])}
{const p=shown(await press('p:fl:u:0'));assert.deepEqual(buttons(p).filter(b=>/^p:fv:/.test(b.callback_data)).map(b=>b.text),['Hale University · 10','Avengers · 1','Marvel · 1'])}
{const p=shown(await press('p:fl:s:0'));assert.deepEqual(buttons(p).filter(b=>/^p:fv:/.test(b.callback_data)).map(b=>b.text),['Modern · 11','Fantasy · 1'])}

// Filtered list: only matching bots, paged by 8, every callback within Telegram's 64 bytes.
{
  const p=shown(await press(`p:fv:a:${valueHash('Alice')}:0`)),b=buttons(p);
  assert.match(p.text,/👤 Alice/);assert.match(p.text,/10 ботов/);assert.ok(!/Bot 1\b/.test(p.text),'list is in the buttons, not repeated in the text');
  assert.equal(b.filter(x=>/^p:k:/.test(x.callback_data)).length,8);
  assert.ok(b.some(x=>x.callback_data===`p:fv:a:${valueHash('Alice')}:1`),'next page');
  const p2=shown(await press(`p:fv:a:${valueHash('Alice')}:1`));assert.equal(buttons(p2).filter(x=>/^p:k:/.test(x.callback_data)).length,2);
  for(const x of [...b,...buttons(p2)])if(x.callback_data)assert.ok(new TextEncoder().encode(x.callback_data).length<=64,x.callback_data);
}
{const p=shown(await press(`p:fv:u:${valueHash('Avengers')}:0`));assert.deepEqual(buttons(p).filter(x=>/^p:k:/.test(x.callback_data)).map(x=>x.text),['Bot 11 · Bob'])}
{const p=shown(await press(`p:fv:t:${valueHash('Romance')}:0`));assert.match(p.text,/11 ботов/)}
{const p=shown(await press(`p:fv:p:${valueHash('AnyPOV')}:0`));assert.match(p.text,/ 1 бот\n/)}

// A bot opens as its avatar photo with name, author, universe, setting, POV, tags and the hook; caption ≤ 1024.
{
  const calls=await press(`p:c:${U(11)}`),photo=calls.find(c=>c.method==='sendPhoto')?.payload;
  assert.ok(photo,'photo sent');assert.equal(photo.photo,'https://media.datacat.run/a.webp');
  for(const s of ['Bot 11','от <a href="https://janitorai.com/profiles/alice">Bob</a>','Marvel, Avengers','Fantasy, Modern','AnyPOV','Action  Romance','2 лорбука','<i>xxx'])assert.ok(photo.caption.includes(s),s);
  assert.ok(photo.caption.length<=1024,`caption ${photo.caption.length}`);
  const cbs=photo.reply_markup.inline_keyboard.flat().map(b=>b.callback_data||b.url);
  for(const k of [`p:cp:${U(11)}`,`p:cj:${U(11)}`,`p:lb:${U(11)}`,`p:d:${U(11)}`,`p:fv:a:${valueHash('Bob')}:0`,`p:fv:u:${valueHash('Marvel')}:0`,`https://janitorai.com/characters/${U(11)}`])assert.ok(cbs.includes(k),k);
  assert.ok(photo.reply_markup.inline_keyboard.length<=4,'card keeps to three rows of buttons plus ‹ ›');
  assert.deepEqual(photo.reply_markup.inline_keyboard.at(-1).map(b=>b.text),['‹','11 / 11','›'],'opened from search/link: arrows walk the whole catalog');
}
// Bots without lorebooks get no lorebook button.
{const photo=(await press(`p:c:${U(1)}`)).find(c=>c.method==='sendPhoto').payload;assert.ok(!photo.reply_markup.inline_keyboard.flat().some(b=>/^p:lb:/.test(b.callback_data||'')))}
// Telegram cannot take the image and it cannot be converted: the card still arrives, as text with the same buttons.
{const calls=await press(`p:c:${U(2)}`,{photoFails:true}),msg=calls.find(c=>c.method==='sendMessage')?.payload;assert.ok(msg);assert.match(msg.text,/Bot 2/);assert.ok(msg.reply_markup.inline_keyboard.flat().some(b=>b.callback_data===`p:cj:${U(2)}`))}
// Full description on request.
{const msg=(await press(`p:d:${U(11)}`)).find(c=>c.method==='sendMessage').payload;assert.match(msg.text,/Bot 11/);assert.match(msg.text,/Full description of Bob/)}
// Unknown bot: a clear message instead of an error.
{const msg=(await press(`p:c:${U(99)}`)).find(c=>c.method==='sendMessage').payload;assert.match(msg.text,/не найден/)}

// ‹ › inside a card: opened from a list, the arrows walk that list and replace the same message.
{
  const h=valueHash('Alice'),list=shown(await press(`p:fv:a:${h}:0`)),first=buttons(list).find(b=>/^p:k:/.test(b.callback_data));
  assert.equal(first.callback_data,`p:k:a:${h}:0`);
  const open=(await press(first.callback_data)).find(c=>c.method==='sendPhoto').payload,nav=open.reply_markup.inline_keyboard.at(-1);
  assert.deepEqual(nav.map(b=>b.text),['‹','1 / 10','›']);
  assert.equal(nav[0].callback_data,`p:n:a:${h}:9`,'‹ on the first bot wraps to the last');assert.equal(nav[2].callback_data,`p:n:a:${h}:1`);
  const calls=await press(nav[2].callback_data),ed=calls.find(c=>c.method==='editMessageMedia')?.payload;
  assert.ok(ed,'the same message is edited');assert.equal(ed.message_id,2);assert.ok(!calls.some(c=>c.method==='sendPhoto'),'no new message');
  assert.equal(ed.media.type,'photo');assert.match(ed.media.caption,/Bot 2/);assert.deepEqual(ed.reply_markup.inline_keyboard.at(-1).map(b=>b.text),['‹','2 / 10','›']);
  for(const b of ed.reply_markup.inline_keyboard.flat())if(b.callback_data)assert.ok(new TextEncoder().encode(b.callback_data).length<=64);
}
// Next bot without a picture: the photo card can't turn into text, so it is replaced by a new text card.
{
  const saved=characters[2].image;characters[2].image='';resetCatalogMemo();
  try{const calls=await press(`p:n:-:-:2`);assert.ok(calls.some(c=>c.method==='deleteMessage'));const m=calls.find(c=>c.method==='sendMessage').payload;assert.match(m.text,/Bot 3/);assert.deepEqual(m.reply_markup.inline_keyboard.at(-1).map(b=>b.text),['‹','3 / 11','›'])}
  finally{characters[2].image=saved;resetCatalogMemo()}
}
// The list shrank since the card was opened: the index is clamped instead of failing.
{const ed=(await press(`p:n:a:${valueHash('Bob')}:5`)).find(c=>c.method==='editMessageMedia').payload;assert.match(ed.media.caption,/Bot 11/)}

// Typing in the chat searches the site's catalog: name, author, universe, tag.
const sent=calls=>calls.find(c=>c.method==='sendMessage')?.payload;
{const m=sent(await press(null,{text:'avengers'}));assert.match(m.text,/1 бот/);assert.deepEqual(buttons(m).filter(b=>/^p:c:/.test(b.callback_data)).map(b=>b.text),['🤖 Bot 11 · Bob'])}
{const m=sent(await press(null,{text:'alice'}));assert.match(m.text,/10 ботов/);assert.match(m.text,/первые 8/);assert.equal(buttons(m).filter(b=>/^p:c:/.test(b.callback_data)).length,8)}
// Nothing found: a hint and a way to the filters, not a dead end.
{const m=sent(await press(null,{text:'zzzz'}));assert.match(m.text,/Ничего не нашлось/);assert.ok(buttons(m).some(b=>b.callback_data==='p:fm'))}
// Commands from the bot's menu button.
{const m=sent(await press(null,{text:'/start'}));assert.match(m.text,/ARCHIVE\.EXE/);assert.ok(buttons(m).some(b=>b.text==='🤖 Боты · 11'))}
{const m=sent(await press(null,{text:'/bots'}));assert.ok(buttons(m).some(b=>b.callback_data==='p:fl:a:0'))}
{const m=sent(await press(null,{text:'/search Marvel'}));assert.match(m.text,/«Marvel»/);assert.match(m.text,/1 бот/)}
{const calls=await press(null,{text:'/random'});assert.ok(calls.some(c=>c.method==='sendPhoto'),'random bot card')}
{const m=sent(await press(null,{text:'/nope'}));assert.match(m.text,/Не знаю такой команды/)}
// Commands added for Node_00: site, suggest/import, help, new, plugins.
{const m=sent(await press(null,{text:'/site'})),u=buttons(m).map(b=>b.url).filter(Boolean);assert.match(m.text,/ARCHIVE\.EXE/);for(const x of ['/characters.html','/hub.html','/codex.html'])assert.ok(u.some(v=>v.endsWith(x)),x)}

{const m=sent(await press(null,{text:'/help'}));for(const c of ['/bots','/new','/random','/hub','/plugins','/search','/suggest','/site','/lorekey'])assert.ok(m.text.includes(c),c)}
{const m=sent(await press(null,{text:'/new'}));assert.match(m.text,/Новые боты/);assert.equal(buttons(m).filter(b=>/^p:k:-:-:/.test(b.callback_data)).length,8)}
{const m=sent(await press(null,{text:'/plugins'}));assert.match(m.text,/Плагины/)}
{const p=shown(await press('p:home'));assert.match(p.text,/NODE_00/);const cbs=buttons(p).map(b=>b.callback_data);for(const k of ['p:fm','p:hubm','p:new:0','p:random','p:search','p:sg','p:site','p:help'])assert.ok(cbs.includes(k),k)}
// 🔗 in a card gives a t.me link that opens this bot directly; /start b_<id> opens it.
{
  const photo=(await press(`p:c:${U(11)}`)).find(c=>c.method==='sendPhoto').payload;assert.ok(photo.reply_markup.inline_keyboard.flat().some(b=>b.callback_data===`p:s:${U(11)}`));
  const m=sent(await press(`p:s:${U(11)}`)),link=`https://t.me/Node00Bot?start=b_${U(11).replace(/-/g,'')}`;
  assert.ok(m.text.includes(link));assert.ok(buttons(m)[0].url.startsWith('https://t.me/share/url?url='+encodeURIComponent(link)));
  const opened=(await press(null,{text:`/start b_${U(11).replace(/-/g,'')}`})).find(c=>c.method==='sendPhoto')?.payload;assert.ok(opened,'deep link opens the card');assert.match(opened.caption,/Bot 11/);
}
// Webhook setup renames the bot to Node_00 and installs the Russian command menu.
{
  const { setupTelegramWebhooks, PUBLIC_COMMANDS } = await import('../src/telegram-webhooks.js');
  const calls=[],og=globalThis.fetch;globalThis.fetch=async(u,i)=>{calls.push({method:String(u).split('/').pop(),payload:JSON.parse(i.body)});return Response.json({ok:true,result:true})};
  try{await setupTelegramWebhooks(new Request('https://archive.example/api/admin/telegram/setup',{method:'POST'}),{Node00admin:'a',TELEGRAM_ADMIN_USER_ID:'1',PUBLICnode00bot:'p'})}finally{globalThis.fetch=og}
  assert.equal(calls.find(c=>c.method==='setMyName')?.payload.name,'Node_00');
  assert.ok(calls.some(c=>c.method==='setMyDescription')&&calls.some(c=>c.method==='setMyShortDescription'));
  const cmds=calls.filter(c=>c.method==='setMyCommands').at(-1).payload.commands.map(c=>c.command);
  for(const c of ['menu','site','bots','new','random','hub','plugins','suggest','lorekey','search','help'])assert.ok(cmds.includes(c),c);
  assert.ok(!cmds.includes('start'),'the site is /site, not /start');assert.equal(PUBLIC_COMMANDS.find(c=>c.command==='site').description,'Сайт ARCHIVE.EXE');
}

// /lorekey links to the translator tab; menus are compact (up to 3 buttons per row, few rows).
{const m=sent(await press(null,{text:'/lorekey'}));assert.ok(buttons(m).some(b=>b.url==='https://archive.example/codex#tab=lorekey'))}
{const p=shown(await press('p:lk'));assert.match(p.text,/LoreKey/)}
{const p=shown(await press('p:home'));assert.ok(buttons(p).some(b=>b.callback_data==='p:lk'));assert.ok(p.reply_markup.inline_keyboard.length<=3,'home in three rows')}
{const p=shown(await press('p:fm'));assert.ok(p.reply_markup.inline_keyboard.length<=4)}
{const p=shown(await press('p:fl:a:0'));assert.ok(p.reply_markup.inline_keyboard.some(r=>r.length===2),'values two per row')}

// Import right in the chat: a JanitorAI link goes to the site's /api/import and the card comes back.
{
  const seen=[],route=async req=>{seen.push(`${req.method} ${new URL(req.url).pathname}${new URL(req.url).search}`);if(new URL(req.url).pathname==='/api/import'){const b=await req.json();seen.push(b.url);return Response.json({ok:true,state:'IMPORTED_FROM_DATACAT',janitorUuid:U(3)})}return Response.json({ok:false},{status:404})};
  const calls=await press(null,{text:`глянь https://janitorai.com/characters/${U(3)}_vance-hale`,route});
  assert.equal(seen[0],'POST /api/import');assert.ok(seen[1].includes(U(3)));
  assert.match(calls.find(c=>c.method==='sendMessage').payload.text,/добавлен в каталог/);
  assert.match(calls.find(c=>c.method==='sendPhoto').payload.caption,/Bot 3/);
}
{const route=async()=>Response.json({ok:true,state:'ALREADY_IN_ARCHIVE',janitorUuid:U(4)});const calls=await press(null,{text:`https://janitorai.com/characters/${U(4)}`,route});assert.match(calls.find(c=>c.method==='sendMessage').payload.text,/уже есть/);assert.ok(calls.some(c=>c.method==='sendPhoto'))}
{const route=async()=>Response.json({ok:false,error:'NOT_AVAILABLE'},{status:404});const calls=await press(null,{text:`https://janitorai.com/characters/${U(4)}`,route});assert.match(calls.find(c=>c.method==='sendMessage').payload.text,/скрыт/);assert.ok(!calls.some(c=>c.method==='sendPhoto'))}
// Still being fetched: a ⏳ message with a check button; the check sends the card once ready.
{
  let ready=false;const route=async req=>new URL(req.url).pathname==='/api/import'?Response.json({ok:true,state:'RETRIEVAL_QUEUED'},{status:202}):ready?Response.json({ok:true,ready:true}):Response.json({ok:true,state:'RETRIEVAL_QUEUED'},{status:202});
  const calls=await press(null,{text:`https://janitorai.com/characters/${U(5)}`,route}),wait=calls.find(c=>c.method==='sendMessage').payload;
  assert.match(wait.text,/Достаю данные/);assert.equal(wait.reply_markup.inline_keyboard[0][0].callback_data,`p:is:${U(5)}`);
  let again=await press(`p:is:${U(5)}`,{route});assert.match(again.find(c=>c.method==='sendMessage').payload.text,/Ещё достаю/);
  ready=true;again=await press(`p:is:${U(5)}`,{route});assert.match(again.find(c=>c.method==='sendPhoto').payload.caption,/Bot 5/);
}
// Any other link: asked first, as a reply to that message; "Да" sends it to the site's HUB suggestions.
{
  const ask=(await press(null,{text:'вот пресет https://t.me/saturic/123'})).find(c=>c.method==='sendMessage').payload;
  assert.match(ask.text,/Предложить эту ссылку/);assert.equal(ask.reply_parameters.message_id,7);assert.deepEqual(ask.reply_markup.inline_keyboard[0].map(b=>b.callback_data),['p:sgy','p:sgn']);
  const sent=[],route=async req=>{sent.push(await req.json());return Response.json({ok:true,id:1},{status:201})};
  const calls=await press('p:sgy',{route,cbMessage:{message_id:9,chat:{id:3},reply_to_message:{message_id:7,text:'вот пресет https://t.me/saturic/123'}}});
  assert.equal(sent[0].url,'https://t.me/saturic/123');assert.match(sent[0].note,/@reader/);
  const done=calls.find(c=>c.method==='editMessageText').payload;assert.equal(done.message_id,9);assert.match(done.text,/отправлена на проверку/);
  const dup=await press('p:sgy',{route:async()=>Response.json({ok:true,duplicate:true}),cbMessage:{message_id:9,chat:{id:3},reply_to_message:{text:'https://t.me/saturic/123'}}});
  assert.match(dup.find(c=>c.method==='editMessageText').payload.text,/уже предлагали/);
}
// /suggest offers both inside the bot (no links to the website).
{const m=sent(await press(null,{text:'/suggest'}));assert.deepEqual(buttons(m).filter(b=>b.callback_data!=='p:home').map(b=>b.callback_data),['p:imp','p:sug']);assert.ok(!buttons(m).some(b=>b.url))}

// Everything a person reads is Russian sentence case: no leftover English caps labels.
{
  const all=[];for(const d of ['p:fm','p:fl:a:0','p:chars:0',`p:fv:u:${valueHash('Marvel')}:0`,`p:c:${U(11)}`])for(const c of await press(d))all.push(c.payload);
  for(const t of ['/start','zzzz','alice'])for(const c of await press(null,{text:t}))all.push(c.payload);
  const strings=all.flatMap(p=>[p.text,p.caption,...(p.reply_markup?.inline_keyboard||[]).flat().map(b=>b.text)]).filter(Boolean).join('\n');
  for(const bad of ['BOT CATALOG','HOME','BOTS','PAGE','OPEN BOT','LOREBOOK','ФИЛЬТРЫ','ВСЕ БОТЫ','ПОЛНОЕ ОПИСАНИЕ'])assert.ok(!strings.includes(bad),`leftover label: ${bad}`);
}

console.log('Telegram catalog OK · Russian menus, filters like the site, pages of 8, photo cards with ‹ › through the opened list (same message), catalog search, menu commands');
