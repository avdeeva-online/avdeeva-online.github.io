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
  a:{menu:'👤 АВТОРЫ',title:'АВТОР',values:c=>list(c.author)},
  u:{menu:'🌌 ВСЕЛЕННЫЕ',title:'ВСЕЛЕННАЯ',values:c=>list(c.universes?.length?c.universes:c.universe)},
  s:{menu:'🏙 СЕТТИНГИ',title:'СЕТТИНГ',values:c=>list(c.settings)},
  p:{menu:'👁 POV',title:'POV',values:c=>list(c.pov)},
  t:{menu:'🏷 ТЕГИ',title:'ТЕГ',values:c=>list(c.tags)}
};
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
const pager=(page,total,key)=>{const pages=Math.ceil(total/PAGE);return pages>1?[[...(page>0?[cb('‹ PREV',`${key}:${page-1}`)]:[]),cb(`${page+1}/${pages}`,'p:noop'),...(page+1<pages?[cb('NEXT ›',`${key}:${page+1}`)]:[])]]:[]};

export function filterMenu(items,origin){
  const rows=[[cb(`🤖 ВСЕ БОТЫ · ${items.length}`,'p:chars:0')],[cb(FACETS.a.menu,'p:fl:a:0'),cb(FACETS.u.menu,'p:fl:u:0')],[cb(FACETS.s.menu,'p:fl:s:0'),cb(FACETS.p.menu,'p:fl:p:0')],[cb(FACETS.t.menu,'p:fl:t:0'),cb('🔎 ПОИСК','p:search')],[url('OPEN BOT CATALOG ↗',origin+'/characters.html'),cb('HOME','p:home')]];
  return{text:`<b>BOT CATALOG</b>\n${items.length} BOTS\n\nВыбери, как искать: все боты подряд или по автору, вселенной, сеттингу, POV или тегу.`,keyboard:{inline_keyboard:rows}};
}
export function valuesPage(items,f,page){
  const facet=FACETS[f],values=facetValues(items,f),p=Math.max(0,Math.min(page,Math.max(0,Math.ceil(values.length/PAGE)-1))),slice=values.slice(p*PAGE,p*PAGE+PAGE);
  const rows=slice.map(v=>[cb(`${short(v.value,40)} · ${v.count}`,`p:fv:${f}:${v.h}:0`)]);
  return{text:`<b>${esc(facet.menu)}</b>\n${values.length} ВАРИАНТОВ\n\nВыбери, чтобы увидеть ботов.`,keyboard:{inline_keyboard:[...rows,...pager(p,values.length,`p:fl:${f}`),[cb('← ФИЛЬТРЫ','p:fm'),cb('HOME','p:home')]]}};
}
export function botsPage(items,{title,page,key,back}){
  const p=Math.max(0,Math.min(page,Math.max(0,Math.ceil(items.length/PAGE)-1))),slice=items.slice(p*PAGE,p*PAGE+PAGE);
  const body=slice.length?slice.map(c=>`• <b>${esc(short(c.name,46))}</b>${c.author?`\n  BY ${esc(c.author)}`:''}`).join('\n\n'):'Ботов не найдено.';
  const rows=slice.map(c=>[cb(short(c.name,42),`p:c:${c.uuid}`)]);
  return{text:`<b>${title}</b>\n${items.length} BOTS · PAGE ${p+1}\n\n${body}`,keyboard:{inline_keyboard:[...rows,...pager(p,items.length,key),[back||cb('← ФИЛЬТРЫ','p:fm'),cb('HOME','p:home')]]}};
}

// Card message: avatar + caption (Telegram allows 1024 characters) + every action for this bot.
export function cardCaption(c){
  const facts=[c.universes.length?`🌌 ${c.universes.map(esc).join(', ')}`:'',c.settings.length?`🏙 ${c.settings.map(esc).join(', ')}`:'',c.pov?`👁 ${esc(c.pov)}`:'',c.lorebookCount?`📖 ${c.lorebookCount} LOREBOOK${c.lorebookCount===1?'':'S'}`:''].filter(Boolean);
  const tags=c.tags.slice(0,8).map(t=>esc(t)).join(' · ');
  const head=`<b>${esc(c.name)}</b>${c.author?`\nBY ${esc(c.author)}`:''}${facts.length?`\n\n${facts.join('\n')}`:''}${tags?`\n🏷 ${tags}`:''}`;
  const room=1000-head.length-2;
  return room>40&&c.hook?`${head}\n\n${esc(short(c.hook,Math.max(40,room-20)))}`:head;
}
export function cardKeyboard(c,origin){
  const rows=[[cb('⬇ CARD PNG',`p:cp:${c.uuid}`),cb('⬇ CARD JSON',`p:cj:${c.uuid}`)]];
  if(c.lorebookCount)rows.push([cb('📖 LOREBOOK .JSON',`p:lb:${c.uuid}`)]);
  rows.push([cb('📄 ПОЛНОЕ ОПИСАНИЕ',`p:d:${c.uuid}`)]);
  const more=[];if(c.author)more.push(cb('👤 ЕЩЁ ОТ АВТОРА',`p:fv:a:${valueHash(c.author)}:0`));if(c.universes[0])more.push(cb(`🌌 ${short(c.universes[0],24)}`,`p:fv:u:${valueHash(c.universes[0])}:0`));if(more.length)rows.push(more);
  const links=[];if(c.url)links.push(url('OPEN BOT ↗',c.url));if(/^https?:\/\//i.test(c.authorUrl))links.push(url('AUTHOR ↗',c.authorUrl));if(links.length)rows.push(links);
  rows.push([cb('🔎 ФИЛЬТРЫ','p:fm'),url('CATALOG ↗',origin+'/characters.html')]);
  return{inline_keyboard:rows};
}

async function tg(token,method,init){const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,init),d=await r.json().catch(()=>({ok:false,description:`HTTP_${r.status}`}));if(!r.ok||!d.ok)throw new Error(d.description||`TELEGRAM_${method}_FAILED`);return d.result}
const jsonInit=payload=>({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
// Photo first by link; if Telegram cannot take the image (format, size), the Worker converts it to PNG and uploads it;
// without any picture the card still arrives as text.
export async function sendCard(token,chatId,env,origin,c){
  const caption=cardCaption(c),reply_markup=cardKeyboard(c,origin);
  if(c.image){
    try{return await tg(token,'sendPhoto',jsonInit({chat_id:chatId,photo:c.image,caption,parse_mode:'HTML',reply_markup}))}catch{}
    try{const png=await fetchAvatarPng(c.image,env.IMAGES);if(png.ok){const form=new FormData();form.append('chat_id',String(chatId));form.append('photo',new Blob([png.bytes],{type:'image/png'}),'avatar.png');form.append('caption',caption);form.append('parse_mode','HTML');form.append('reply_markup',JSON.stringify(reply_markup));return await tg(token,'sendPhoto',{method:'POST',body:form})}}catch{}
  }
  return tg(token,'sendMessage',jsonInit({chat_id:chatId,text:caption,parse_mode:'HTML',disable_web_page_preview:true,reply_markup}));
}

// Full public description, split into Telegram-sized messages.
export async function sendDescription(token,chatId,env,c){
  const row=await env.DB.prepare("SELECT description,public_about,scenario FROM characters WHERE janitor_uuid=? AND status='published' LIMIT 1").bind(c.uuid).first().catch(()=>null);
  const text=clean(row?.public_about)||clean(row?.description)||c.hook||'Описания нет.';
  const parts=[];let rest=text;while(rest.length&&parts.length<4){let cut=rest.length<=3800?rest.length:rest.lastIndexOf('\n',3800);if(cut<1500)cut=3800;parts.push(rest.slice(0,cut));rest=rest.slice(cut).trimStart()}
  for(let i=0;i<parts.length;i++)await tg(token,'sendMessage',jsonInit({chat_id:chatId,text:`${i===0?`<b>${esc(c.name)}</b> · ОПИСАНИЕ\n\n`:''}${esc(parts[i])}${i===parts.length-1&&rest.length?'\n\n… полностью — на сайте.':''}`,parse_mode:'HTML',disable_web_page_preview:true}));
}
