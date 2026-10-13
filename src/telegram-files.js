// Files the public Telegram bot hands out: lorebooks (character card files are taken on DataCat, see datacat-link.js).
// The bot builds each file itself and uploads it to the chat with its real name: handing Telegram a link instead
// lost the .json extension.
import { toWorldInfo } from './lorebook-format.js';

const clean=v=>String(v??'').trim();
const esc=s=>clean(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const safeFilename=(v,f)=>String(v||f).replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim().slice(0,120)||f;

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
