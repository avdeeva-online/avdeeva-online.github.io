import { handleAdminTelegramIngest } from './telegram-admin-ingest.js';

const clean=v=>String(v??'').trim();
const short=(s,n=420)=>{s=clean(s).replace(/\s+/g,' ');return s.length>n?s.slice(0,n-1)+'…':s};
const esc=s=>clean(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const uniqBy=(items,key)=>{const seen=new Set();return(items||[]).filter(x=>{const k=key(x);if(!k||seen.has(k))return false;seen.add(k);return true})};

async function sha256Hex(value){const bytes=new TextEncoder().encode(value),hash=await crypto.subtle.digest('SHA-256',bytes);return[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function webhookSecret(token){return(await sha256Hex(`admin|${token}`)).slice(0,48)}
async function tg(token,method,payload={}){const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}),d=await r.json().catch(()=>({ok:false,description:`HTTP_${r.status}`}));if(!r.ok||!d.ok)throw new Error(d.description||`TELEGRAM_${method}_FAILED`);return d.result}
const button=(text,callback_data)=>({text,callback_data});
const urlButton=(text,url)=>({text,url});
async function send(token,chatId,text,reply_markup){return tg(token,'sendMessage',{chat_id:chatId,text,parse_mode:'HTML',disable_web_page_preview:true,...(reply_markup?{reply_markup}:{})})}

function buttons(id,source){return{inline_keyboard:[
  [button('✓ FINISH RESOURCE','session:finish'),button('＋ NEW RESOURCE','session:new')],
  [button('RE-ANALYZE','draft:reanalyze:'+id),button('DELETE','draft:delete:'+id)],
  [source?urlButton('ORIGINAL POST ↗',source):button('SOURCE','noop'),button('DRAFTS','adm:drafts')],
  [button('HOME','adm:home')]
]}}
function forwardedMeta(message){const o=message?.forward_origin;if(o?.type==='channel'&&o.chat?.username&&o.message_id)return{channel:o.chat.username,postId:Number(o.message_id),url:`https://t.me/${o.chat.username}/${o.message_id}`};const l=message?.forward_from_chat;if(l?.username&&message?.forward_from_message_id)return{channel:l.username,postId:Number(message.forward_from_message_id),url:`https://t.me/${l.username}/${message.forward_from_message_id}`};return null}
function directFiles(message,sourceUrl=''){const out=[];if(message?.document?.file_id)out.push({telegram_file_id:message.document.file_id,telegram_file_unique_id:message.document.file_unique_id||'',name:message.document.file_name||`telegram-file-${message.message_id}`,size:Number(message.document.file_size||0),type:message.document.mime_type||'application/octet-stream',source:'telegram-bot',source_post:sourceUrl});if(message?.audio?.file_id)out.push({telegram_file_id:message.audio.file_id,telegram_file_unique_id:message.audio.file_unique_id||'',name:message.audio.file_name||`audio-${message.message_id}.mp3`,size:Number(message.audio.file_size||0),type:message.audio.mime_type||'audio/mpeg',source:'telegram-bot',source_post:sourceUrl});if(message?.video?.file_id)out.push({telegram_file_id:message.video.file_id,telegram_file_unique_id:message.video.file_unique_id||'',name:message.video.file_name||`video-${message.message_id}.mp4`,size:Number(message.video.file_size||0),type:message.video.mime_type||'video/mp4',source:'telegram-bot',source_post:sourceUrl});return out}
function directMedia(message,sourceUrl=''){const photos=Array.isArray(message?.photo)?message.photo:[];if(!photos.length)return[];const p=photos[photos.length-1];return[{telegram_file_id:p.file_id,telegram_file_unique_id:p.file_unique_id||'',size:Number(p.file_size||0),width:Number(p.width||0),height:Number(p.height||0),source:'telegram-bot-photo',source_post:sourceUrl}]}
function titleFromText(text){const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);for(const line of lines){const s=line.replace(/^[-–—•*#\s]+/,'').trim();if(s&&s.length>=4&&s.length<=140)return s}return''}
function inferType(text,current='other'){const t=String(text||'').toLowerCase();if(/(?:preset|пресет|regex|регекс|регулярк|system prompt|системн(?:ый|ого) промпт)/.test(t))return'preset';if(/(?:theme|тема|оформлени)/.test(t))return'theme';if(/plugin|плагин/.test(t))return'plugin';if(/guide|гайд|инструкц/.test(t))return'guide';return current||'other'}
function weakContent(a){const d=a?.draft||{},title=clean(d.title).toUpperCase(),text=clean(d.descriptionFull||d.descriptionShort||a?.source?.rawText);return !text||text.length<120||['ATTACHMENTS','UNTITLED','UNTITLED RESOURCE'].includes(title)}
function draftText(row){const a=row.analysis||{},d=a.draft||{},posts=Math.max(1,(a.sourcePosts||[]).length);return `<b>ACTIVE RESOURCE · SEND MORE POSTS/FILES</b>\n\n<b>DRAFT RESOURCE</b>\n\n<b>${esc(d.title||'UNTITLED')}</b>\nTYPE: ${esc(d.type||'other')}\nAUTHOR: ${esc(d.creator||a.source?.channel||'—')}\nSOURCE POSTS: ${posts}\nMEDIA: ${(a.media||[]).length} · FILES: ${(a.files||[]).length}\nSOURCE: ${esc(a.source?.url||row.source_url)}\n\n${esc(short(d.descriptionShort||d.descriptionFull||'',260))}`}
async function getActive(env,uid){const s=await env.DB.prepare('SELECT * FROM telegram_admin_import_session WHERE admin_user_id=? LIMIT 1').bind(uid).first();if(!s?.draft_id)return null;const row=await env.DB.prepare("SELECT * FROM telegram_admin_drafts WHERE id=? AND status='review' LIMIT 1").bind(s.draft_id).first();if(!row)return null;try{row.analysis=JSON.parse(row.payload||'{}')}catch{row.analysis={}}return{session:s,row}}
function addLogicalSource(a,meta,message){a.sourcePosts=Array.isArray(a.sourcePosts)?a.sourcePosts:[];a.diagnostics=a.diagnostics||{};a.diagnostics.mediaGroups=a.diagnostics.mediaGroups||{};const gid=clean(message?.media_group_id);if(gid){if(a.diagnostics.mediaGroups[gid])return false;a.diagnostics.mediaGroups[gid]=meta?.url||''}const url=meta?.url||'';if(url&&!a.sourcePosts.some(x=>(typeof x==='string'?x:x?.url)===url)){a.sourcePosts.push({url});return true}return false}

async function persist(env,row,a){await env.DB.prepare("UPDATE telegram_admin_drafts SET payload=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(a),row.id).run();row.analysis=a;return row}
async function attachFileOnly(env,active,message){const {row}=active,a=row.analysis||{};a.source=a.source||{};a.draft=a.draft||{};const meta=forwardedMeta(message),source=meta?.url||'';const gid=clean(message?.media_group_id),repeatedGroup=Boolean(gid&&a.diagnostics?.mediaGroups?.[gid]);addLogicalSource(a,meta,message);a.files=uniqBy([...(a.files||[]),...directFiles(message,source)],x=>x.telegram_file_unique_id||x.telegram_file_id||x.url||`${x.name}:${x.size}`);a.diagnostics={...(a.diagnostics||{}),attachmentOnly:true,directFiles:a.files.filter(x=>x.telegram_file_id).length};return{row:await persist(env,row,a),repeatedGroup}}
async function attachRichMessage(env,active,message){const {row}=active,a=row.analysis||{};a.source=a.source||{};a.draft=a.draft||{};const meta=forwardedMeta(message),source=meta?.url||'',text=clean(message?.text||message?.caption);addLogicalSource(a,meta,message);if(meta?.channel){a.source.channel=a.source.channel||meta.channel;a.source.author=a.source.author||meta.channel;a.draft.creator=a.draft.creator||meta.channel;a.draft.creatorLink=a.draft.creatorLink||`https://t.me/${meta.channel}`}if(!a.source.url&&source)a.source.url=source;a.media=uniqBy([...(a.media||[]),...directMedia(message,source)],x=>x.telegram_file_unique_id||x.telegram_file_id||x.url);if(text){const current=clean(a.draft.descriptionFull||a.source.rawText),shouldAdopt=weakContent(a)||text.length>current.length;if(shouldAdopt){a.source.rawText=text;a.draft.descriptionFull=text;a.draft.descriptionShort=short(text,520);const t=titleFromText(text);if(t)a.draft.title=t;a.draft.type=inferType(text,a.draft.type)}else{a.diagnostics.extraTexts=uniqBy([...(a.diagnostics.extraTexts||[]),text],x=>x)}}a.diagnostics={...(a.diagnostics||{}),richForward:true,sourcePosts:Math.max(1,(a.sourcePosts||[]).length),directMedia:(a.media||[]).filter(x=>x.telegram_file_id).length};return persist(env,row,a)}
async function attachTextOnly(env,active,message){return attachRichMessage(env,active,message)}

export async function handleAdminTelegramFixed(request,env){
  if(request.method!=='POST')return handleAdminTelegramIngest(request,env);
  const token=clean(env.Node00admin);if(!token)return handleAdminTelegramIngest(request,env);
  if(request.headers.get('x-telegram-bot-api-secret-token')!==await webhookSecret(token))return handleAdminTelegramIngest(request,env);
  let u={};try{u=await request.clone().json()}catch{return handleAdminTelegramIngest(request,env)}
  const message=u.message,uid=String(message?.from?.id||'');if(!message||uid!==String(env.TELEGRAM_ADMIN_USER_ID||''))return handleAdminTelegramIngest(request,env);
  const text=clean(message.text||message.caption);if(text.startsWith('/'))return handleAdminTelegramIngest(request,env);
  try{
    const active=await getActive(env,uid);if(!active)return handleAdminTelegramIngest(request,env);
    const fileOnly=Boolean(message?.document?.file_id||message?.audio?.file_id||message?.video?.file_id);
    if(fileOnly){const {row,repeatedGroup}=await attachFileOnly(env,active,message);if(!repeatedGroup)await send(token,message.chat.id,`<b>FILES ADDED TO ACTIVE RESOURCE ✓</b>\n\n${draftText(row)}`,buttons(row.id,row.source_url));return new Response(JSON.stringify({ok:true}),{headers:{'content-type':'application/json'}})}
    const meta=forwardedMeta(message),hasPhoto=Boolean(message?.photo?.length);
    if(text||hasPhoto||meta){const row=await attachRichMessage(env,active,message);await send(token,message.chat.id,`<b>RESOURCE CONTENT UPDATED ✓</b>\n\n${draftText(row)}`,buttons(row.id,row.source_url));return new Response(JSON.stringify({ok:true}),{headers:{'content-type':'application/json'}})}
  }catch(e){console.warn('telegram fixed ingest preflight failed',e)}
  return handleAdminTelegramIngest(request,env);
}
