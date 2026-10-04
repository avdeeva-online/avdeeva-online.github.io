// Bot catalog for the public Telegram bot: the same list, names and facets as the site's catalog
// (/api/catalog after universe curation), so a filter in the bot finds exactly what the site finds.
// Telegram callback data is limited to 64 bytes, so a filter value travels as a short hash of itself.
import { fetchAvatarPng } from './entry.js';

const clean=v=>String(v??'').trim();
const esc=s=>clean(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const short=(s,n)=>{s=clean(s).replace(/\s+/g,' ');return s.length>n?s.slice(0,n-1)+'…':s};
const list=v=>(Array.isArray(v)?v:[v]).map(clean).filter(Boolean);
export const PAGE=8;

export const FACETS={
  a:{menu:'👤 Авторы',title:'👤',values:c=>list(c.author)},
  u:{menu:'🌌 Вселенные',title:'🌌',values:c=>list(c.universes?.length?c.universes:c.universe)},
  s:{menu:'🏙 Сеттинги',title:'🏙',values:c=>list(c.settings)},
  p:{menu:'👁 POV',title:'👁',values:c=>list(c.pov)},
  t:{menu:'🏷 Теги',title:'🏷',values:c=>list(c.tags)}
};
export const plural=(n,[one,few,many])=>{const a=Math.abs(n)%100,b=a%10;return`${n} ${a>10&&a<20?many:b===1?one:b>=2&&b<=4?few:many}`};
export const bots=n=>plural(n,['бот','бота','ботов']);
export function valueHash(v){let h=0x811c9dc5;for(const ch of clean(v).toLowerCase()){h^=ch.codePointAt(0);h=Math.imul(h,0x01000193)>>>0}return h.toString(36)}

// The parsed catalog is kept for a minute per Worker isolate: one bot conversation is many button presses.
let memo=null;
export function resetCatalogMemo(){memo=null}
export async function loadCatalog(loader){
  if(memo&&Date.now()-memo.at<60_000)return memo.items;
  const res=await loader(),data=await res.json().catch(()=>({}));
  if(!res.ok||!Array.isArray(data.characters))throw new Error(`CATALOG_${res.status}`);
  const items=data.characters.filter(c=>clean(c.janitorUuid)).map(c=>({uuid:clean(c.janitorUuid).toLowerCase(),name:clean(c.nameEn)||'Character',author:clean(c.author),authorUrl:clean(c.authorUrl),universe:clean(c.universe),universes:list(c.universes),settings:list(c.settings),pov:clean(c.pov),tags:list(c.tags),hook:clean(c.short),image:clean(c.image),url:clean(c.url),lorebookCount:Number(c.lorebookCount||0)}));
  memo={at:Date.now(),items};return items;
}

export function facetValues(items,f){
  const facet=FACETS[f];if(!facet)return[];const counts=new Map();
  for(const c of items)for(const v of new Set(facet.values(c))){const k=v.toLowerCase();const x=counts.get(k)||{value:v,count:0};x.count++;counts.set(k,x)}
  return[...counts.values()].sort((a,b)=>b.count-a.count||a.value.localeCompare(b.value,'ru')).map(x=>({...x,h:valueHash(x.value)}));
}
export function filterItems(items,f,h){
  const facet=FACETS[f];if(!facet)return{value:'',items:[]};let value='';
  const found=items.filter(c=>facet.values(c).some(v=>{if(valueHash(v)!==h)return false;value=value||v;return true}));
  return{value,items:found};
}

const cb=(text,callback_data)=>({text,callback_data}),url=(text,u)=>({text,url:u});
const MENU=cb('← Меню','p:home');
// ‹ 2/5 › — the middle button only shows where you are.
const pager=(page,total,key)=>{const pages=Math.ceil(total/PAGE);return pages>1?[[cb(page>0?'‹':'·',page>0?`${key}:${page-1}`:'p:noop'),cb(`${page+1} / ${pages}`,'p:noop'),cb(page+1<pages?'›':'·',page+1<pages?`${key}:${page+1}`:'p:noop')]]:[]};
const clampPage=(page,total)=>Math.max(0,Math.min(page,Math.max(0,Math.ceil(total/PAGE)-1)));

export function filterMenu(items){
  const rows=[[cb(`Все боты · ${items.length}`,'p:chars:0'),cb('🆕 Новые','p:new:0')],[cb(FACETS.a.menu,'p:fl:a:0'),cb(FACETS.u.menu,'p:fl:u:0'),cb(FACETS.s.menu,'p:fl:s:0')],[cb(FACETS.p.menu,'p:fl:p:0'),cb(FACETS.t.menu,'p:fl:t:0'),cb('🔎 Поиск','p:search')],[MENU]];
  return{text:`<b>🤖 Боты</b> · ${bots(items.length)}\n\nКак искать? Можно листать всех подряд или выбрать автора, вселенную, сеттинг, POV или тег.`,keyboard:{inline_keyboard:rows}};
}
export function valuesPage(items,f,page){
  const facet=FACETS[f],values=facetValues(items,f),p=clampPage(page,values.length),slice=values.slice(p*PAGE,p*PAGE+PAGE);
  const buttons=slice.map(v=>cb(`${short(v.value,20)} · ${v.count}`,`p:fv:${f}:${v.h}:0`)),rows=[];for(let i=0;i<buttons.length;i+=2)rows.push(buttons.slice(i,i+2));
  return{text:`<b>${esc(facet.menu)}</b> · ${plural(values.length,['вариант','варианта','вариантов'])}\n\nЧисло рядом — сколько ботов.`,keyboard:{inline_keyboard:[...rows,...pager(p,values.length,`p:fl:${f}`),[cb('← Фильтры','p:fm'),MENU]]}};
}
// The list lives in the buttons only (no second copy in the text); the author is added unless it is the filter itself.
// A list is addressed as f:h — '-:-' for all bots, otherwise a facet and the hash of its value. Cards opened from a
// list remember it, so ‹ › inside the card walk through the same bots.
export function listContext(items,f,h){if(f==='-')return{items,value:''};if(!FACETS[f])return{items:[],value:''};return filterItems(items,f,h)}
export function botsPage(items,{title,page,key,back,hideAuthor=false,ctx=['-','-']}){
  const p=clampPage(page,items.length),slice=items.slice(p*PAGE,p*PAGE+PAGE);
  const rows=slice.map((c,i)=>[cb(hideAuthor||!c.author?short(c.name,48):`${short(c.name,32)} · ${short(c.author,16)}`,`p:k:${ctx[0]}:${ctx[1]}:${p*PAGE+i}`)]);
  const text=`<b>${title}</b> · ${bots(items.length)}\n\n${items.length?'Нажми на бота — пришлю карточку с картинкой и файлами.':'Здесь пока пусто.'}`;
  return{text,keyboard:{inline_keyboard:[...rows,...pager(p,items.length,key),[back||cb('← Фильтры','p:fm'),MENU]]}};
}

// Bots whose name, author, universe or tag contains the query (the site's catalog, so hidden bots never show up).
export function searchItems(items,q){
  const needle=clean(q).toLowerCase();if(needle.length<2)return[];
  const score=c=>c.name.toLowerCase().startsWith(needle)?0:c.name.toLowerCase().includes(needle)?1:c.author.toLowerCase().includes(needle)?2:[...c.universes,...c.tags].some(v=>v.toLowerCase().includes(needle))?3:9;
  return items.map(c=>[score(c),c]).filter(([s])=>s<9).sort((a,b)=>a[0]-b[0]).map(([,c])=>c);
}

// Card message: avatar + caption (Telegram allows 1024 characters). The name links to the bot, the author to the profile.
const link=(text,href)=>/^https?:\/\//i.test(href||'')?`<a href="${esc(href)}">${esc(text)}</a>`:esc(text);
const isPovTag=t=>/pov/i.test(t);
export function cardCaption(c){
  const facts=[c.universes.length?`🌌 ${c.universes.map(esc).join(', ')}`:'',c.settings.length?`🏙 ${c.settings.map(esc).join(', ')}`:'',c.pov?`👁 ${esc(c.pov)}`:''].filter(Boolean);
  const tags=c.tags.filter(t=>!isPovTag(t)).slice(0,6).map(esc).join('  ');
  const head=`<b>${link(c.name,c.url)}</b>${c.author?`\nот ${link(c.author,c.authorUrl)}`:''}${facts.length?`\n\n${facts.join('\n')}`:''}${c.lorebookCount?`\n📖 ${plural(c.lorebookCount,['лорбук','лорбука','лорбуков'])}`:''}${tags?`\n${tags}`:''}`;
  const room=1000-head.length-12;
  return room>60&&c.hook?`${head}\n\n<i>${esc(short(c.hook,Math.max(60,room)))}</i>`:head;
}
// ‹ 3 / 25 › under the card; the ends wrap around, so the arrows never dead-end.
function navRow(nav){if(!nav||nav.total<2)return null;const at=i=>`p:n:${nav.f}:${nav.h}:${(i+nav.total)%nav.total}`;return[cb('‹',at(nav.i-1)),cb(`${nav.i+1} / ${nav.total}`,'p:noop'),cb('›',at(nav.i+1))]}
export function cardKeyboard(c,nav=null){
  const files=[cb('⬇ PNG',`p:cp:${c.uuid}`),cb('⬇ JSON',`p:cj:${c.uuid}`)];if(c.lorebookCount)files.push(cb('📖 Лорбук',`p:lb:${c.uuid}`));
  const rows=[files,[cb('📄 Описание',`p:d:${c.uuid}`),...(c.url?[url('JanitorAI ↗',c.url)]:[]),cb('🔗',`p:s:${c.uuid}`)]];
  const more=[];if(c.author)more.push(cb(`👤 Ещё от ${short(c.author,18)}`,`p:fv:a:${valueHash(c.author)}:0`));if(c.universes[0])more.push(cb(`🌌 ${short(c.universes[0],20)}`,`p:fv:u:${valueHash(c.universes[0])}:0`));if(more.length)rows.push(more);
  const n=navRow(nav);if(n)rows.push(n);
  return{inline_keyboard:rows};
}

async function tg(token,method,init){const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,init),d=await r.json().catch(()=>({ok:false,description:`HTTP_${r.status}`}));if(!r.ok||!d.ok)throw new Error(d.description||`TELEGRAM_${method}_FAILED`);return d.result}
const jsonInit=payload=>({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
// Photo first by link; if Telegram cannot take the image (format, size), the Worker converts it to PNG and uploads it;
// without any picture the card still arrives as text.
const avatarForm=async(env,c,fields)=>{const png=await fetchAvatarPng(c.image,env.IMAGES);if(!png.ok)throw new Error(png.state||'AVATAR');const form=new FormData();for(const[k,v]of Object.entries(fields))form.append(k,typeof v==='string'?v:JSON.stringify(v));form.append('photo',new Blob([png.bytes],{type:'image/png'}),'avatar.png');return form};
export async function sendCard(token,chatId,env,origin,c,nav=null){
  const caption=cardCaption(c),reply_markup=cardKeyboard(c,nav);
  if(c.image){
    try{return await tg(token,'sendPhoto',jsonInit({chat_id:chatId,photo:c.image,caption,parse_mode:'HTML',reply_markup}))}catch{}
    try{return await tg(token,'sendPhoto',{method:'POST',body:await avatarForm(env,c,{chat_id:String(chatId),caption,parse_mode:'HTML',reply_markup})})}catch{}
  }
  return tg(token,'sendMessage',jsonInit({chat_id:chatId,text:caption,parse_mode:'HTML',disable_web_page_preview:true,reply_markup}));
}
// ‹ › in a card: the same message turns into the next bot (photo and caption replaced in place).
// A photo can't become text or the other way round, so then the old card is removed and the new one sent.
export async function editCard(token,chatId,messageId,env,origin,c,nav){
  const caption=cardCaption(c),reply_markup=cardKeyboard(c,nav);
  if(c.image&&messageId){
    try{return await tg(token,'editMessageMedia',jsonInit({chat_id:chatId,message_id:messageId,media:{type:'photo',media:c.image,caption,parse_mode:'HTML'},reply_markup}))}catch(e){if(/message is not modified/i.test(String(e?.message||e)))return null}
    try{const form=await avatarForm(env,c,{chat_id:String(chatId),message_id:String(messageId),reply_markup});form.append('media',JSON.stringify({type:'photo',media:'attach://photo',caption,parse_mode:'HTML'}));return await tg(token,'editMessageMedia',{method:'POST',body:form})}catch{}
  }
  if(messageId)await tg(token,'deleteMessage',jsonInit({chat_id:chatId,message_id:messageId})).catch(()=>{});
  return sendCard(token,chatId,env,origin,c,nav);
}

// Full public description, split into Telegram-sized messages.
export async function sendDescription(token,chatId,env,c){
  const row=await env.DB.prepare("SELECT description,public_about,scenario FROM characters WHERE janitor_uuid=? AND status='published' LIMIT 1").bind(c.uuid).first().catch(()=>null);
  const text=clean(row?.public_about)||clean(row?.description)||c.hook||'У этого бота нет описания.';
  const parts=[];let rest=text;while(rest.length&&parts.length<4){let cut=rest.length<=3800?rest.length:rest.lastIndexOf('\n',3800);if(cut<1500)cut=3800;parts.push(rest.slice(0,cut));rest=rest.slice(cut).trimStart()}
  for(let i=0;i<parts.length;i++)await tg(token,'sendMessage',jsonInit({chat_id:chatId,text:`${i===0?`<b>📄 ${esc(c.name)}</b>\n\n`:''}${esc(parts[i])}${i===parts.length-1&&rest.length?'\n\n… дальше — на сайте.':''}`,parse_mode:'HTML',disable_web_page_preview:true}));
}
