// Files the public Telegram bot hands out: character cards (PNG / JSON) and lorebooks.
// The bot builds each file itself, checks it is whole and uploads it to the chat with its real name.
// Handing Telegram a link instead lost the .json extension, let Telegram re-process the PNG (dropping the
// embedded card) and could save a "card is being prepared" reply as the card.
import { handleEntryRoute } from './entry.js';
import { extractEmbeddedCard } from './janny-card.js';
import { toWorldInfo } from './lorebook-format.js';

const clean=v=>String(v??'').trim();
const esc=s=>clean(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const safeFilename=(v,f)=>String(v||f).replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim().slice(0,120)||f;
function filenameFrom(disposition,fallback){const raw=String(disposition||''),star=raw.match(/filename\*=UTF-8''([^;]+)/i);if(star){try{return decodeURIComponent(star[1].trim())}catch{}}const plain=raw.match(/filename="?([^";]+)"?/i);return plain?.[1]?.trim()||fallback}

async function tgJson(token,method,payload){const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}),d=await r.json().catch(()=>({ok:false,description:`HTTP_${r.status}`}));if(!r.ok||!d.ok)throw new Error(d.description||`TELEGRAM_${method}_FAILED`);return d.result}
// sendDocument with the file itself (multipart upload), so Telegram keeps the bytes and the name as they are.
export async function uploadDocument(token,chatId,{bytes,filename,type,caption='',reply_markup}){
  const form=new FormData();form.append('chat_id',String(chatId));form.append('document',new Blob([bytes],{type}),filename);
  if(caption){form.append('caption',caption);form.append('parse_mode','HTML')}
  form.append('disable_content_type_detection','true');
  if(reply_markup)form.append('reply_markup',JSON.stringify(reply_markup));
  const r=await fetch(`https://api.telegram.org/bot${token}/sendDocument`,{method:'POST',body:form}),d=await r.json().catch(()=>({ok:false,description:`HTTP_${r.status}`}));
  if(!r.ok||!d.ok)throw new Error(d.description||'TELEGRAM_sendDocument_FAILED');return d.result;
}
const typing=(token,chatId)=>tgJson(token,'sendChatAction',{chat_id:chatId,action:'upload_document'}).catch(()=>{});
const isPng=b=>b.length>8&&b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71;

// Builds the card through the same route the site uses and returns {ok,bytes,filename,name} or {ok:false,state,waiting}.
export async function buildCardFile(env,origin,uuid,kind){
  const path=kind==='png'?'card.png':'card';
  let res;try{res=await handleEntryRoute(new Request(`${origin}/api/characters/${encodeURIComponent(uuid)}/${path}`,{headers:{accept:kind==='png'?'image/png':'application/json'}}),env,undefined)}catch(e){return{ok:false,state:String(e?.message||e)}}
  if(!res)return{ok:false,state:'NO_ROUTE'};
  if(res.status!==200){let d={};try{d=await res.json()}catch{}return{ok:false,waiting:res.status===202,state:clean(d.state||d.error)||`HTTP_${res.status}`}}
  const bytes=new Uint8Array(await res.arrayBuffer());
  let card=null;
  if(kind==='png'){if(!isPng(bytes))return{ok:false,state:'NOT_A_PNG'};card=extractEmbeddedCard(bytes)}
  else{try{card=JSON.parse(new TextDecoder().decode(bytes))}catch{return{ok:false,state:'INVALID_CARD_JSON'}}}
  if(!card?.data||!/^chara_card_v[23]$/.test(clean(card.spec)))return{ok:false,state:kind==='png'?'PNG_WITHOUT_CARD':'INVALID_CARD_JSON'};
  const name=clean(card.data.name)||'Character',fallback=`${safeFilename(name,'Character')}.${kind==='png'?'png':'json'}`;
  const partial=card.data.extensions?.archive_exe?.export_quality==='partial';
  return{ok:true,bytes,name,partial,filename:filenameFrom(res.headers.get('content-disposition'),fallback),type:kind==='png'?'image/png':'application/json'};
}

export async function sendCardFile(token,chatId,env,origin,uuid,kind,retryMarkup){
  await typing(token,chatId);
  const f=await buildCardFile(env,origin,uuid,kind),label=kind==='png'?'PNG':'JSON';
  if(!f.ok){
    const text=f.waiting?`⏳ Карточка ещё готовится — нажми кнопку ниже секунд через 10.`:`Не получилось собрать ${label}-карточку (${esc(f.state)}). Попробуй позже или скачай на сайте.`;
    return tgJson(token,'sendMessage',{chat_id:chatId,text,parse_mode:'HTML',disable_web_page_preview:true,...(retryMarkup?{reply_markup:retryMarkup}:{})});
  }
  const caption=`<b>${esc(f.name)}</b> · карточка ${label}${f.partial?'\n⚠ Неполная: у источника нет описания персонажа.':''}`;
  return uploadDocument(token,chatId,{bytes:f.bytes,filename:f.filename,type:f.type,caption});
}

// Every lorebook linked to the character, each as its own SillyTavern World Info .json (the site's download format).
export async function lorebookFiles(env,uuid){
  const rows=(await env.DB.prepare(`SELECT l.id,l.title,COALESCE(b.script,l.script) AS script FROM character_lorebooks cl JOIN lorebooks l ON l.id=cl.lorebook_id LEFT JOIN lorebook_blobs b ON b.content_hash=l.content_hash WHERE cl.character_uuid=? ORDER BY cl.ordinal,l.title`).bind(uuid).all()).results||[];
  const used=new Set();
  return rows.filter(r=>clean(r.script)).map(r=>{
    const converted=toWorldInfo(r.script,clean(r.title)),data=converted.ok?converted.book:converted.value,base=safeFilename(clean(r.title)||'Lorebook','Lorebook');
    let filename=`${base}.json`;for(let n=2;used.has(filename.toLowerCase());n++)filename=`${base} (${n}).json`;used.add(filename.toLowerCase());
    return{title:clean(r.title)||'Lorebook',filename,bytes:new TextEncoder().encode(JSON.stringify(data,null,2))};
  });
}

export async function sendLorebookFiles(token,chatId,env,uuid){
  await typing(token,chatId);
  const files=await lorebookFiles(env,uuid);
  if(!files.length)return tgJson(token,'sendMessage',{chat_id:chatId,text:'У этого бота нет лорбуков.'});
  const failed=[];
  for(const f of files){try{await uploadDocument(token,chatId,{bytes:f.bytes,filename:f.filename,type:'application/json',caption:`📖 <b>${esc(f.title)}</b> · лорбук`})}catch(e){failed.push(`${f.title}: ${clean(e?.message||e)}`)}}
  if(failed.length)await tgJson(token,'sendMessage',{chat_id:chatId,text:`Не получилось отправить:\n${failed.join('\n')}`}).catch(()=>{});
}
