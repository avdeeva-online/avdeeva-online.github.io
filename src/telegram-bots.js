import { analyzeTelegramPost } from './hub-telegram.js';
import { publishHubResource } from './hub-resources.js';
import { requireD1Schema } from './d1-schema.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=v=>String(v??'').trim();
const esc=s=>clean(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const short=(s,n=420)=>{s=clean(s).replace(/\s+/g,' ');return s.length>n?s.slice(0,n-1)+'…':s};
const uniqBy=(arr,key)=>{const seen=new Set();return (arr||[]).filter(x=>{const k=key(x);if(!k||seen.has(k))return false;seen.add(k);return true})};

async function sha256Hex(value){
  const data=new TextEncoder().encode(value),hash=await crypto.subtle.digest('SHA-256',data);
  return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function webhookSecret(token,kind){return (await sha256Hex(`${kind}|${token}`)).slice(0,48)}
async function tg(token,method,payload={}){
  if(!token)throw new Error('BOT_TOKEN_MISSING');
  const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const d=await r.json().catch(()=>({ok:false,description:`HTTP_${r.status}`}));
  if(!r.ok||!d.ok)throw new Error(d.description||`TELEGRAM_${method}_FAILED`);
  return d.result;
}
const button=(text,callback_data)=>({text,callback_data});
const urlButton=(text,url)=>({text,url});
async function send(token,chatId,text,reply_markup){return tg(token,'sendMessage',{chat_id:chatId,text,parse_mode:'HTML',disable_web_page_preview:true,...(reply_markup?{reply_markup}:{})})}
async function edit(token,chatId,messageId,text,reply_markup){try{return await tg(token,'editMessageText',{chat_id:chatId,message_id:messageId,text,parse_mode:'HTML',disable_web_page_preview:true,...(reply_markup?{reply_markup}:{})})}catch{return send(token,chatId,text,reply_markup)}}
async function answerCb(token,id,text=''){try{await tg(token,'answerCallbackQuery',{callback_query_id:id,...(text?{text}:{})})}catch{}}

function adminMenu(){return{inline_keyboard:[
  [button('＋ IMPORT','adm:import'),button('DRAFTS','adm:drafts')],
  [button('SUGGESTIONS','adm:suggestions'),button('HUB','adm:hub')],
  [button('AUTHORS','adm:authors'),button('ISSUES','adm:issues')],
  [button('STATS','adm:stats')]
]}}
function publicMenu(){return{inline_keyboard:[
  [button('SEARCH','pub:search'),button('LATEST','pub:latest')],
  [button('PRESETS','pub:type:preset'),button('THEMES','pub:type:theme')],
  [button('PLUGINS','pub:type:plugin'),button('GUIDES','pub:type:guide')],
  [button('RANDOM','pub:random'),button('TAVO HUB','pub:hub')]
]}}

const ensureDraftSchema=env=>requireD1Schema(env,'telegram-legacy',`SELECT
  (SELECT COUNT(*) FROM telegram_admin_drafts) AS drafts,
  (SELECT COUNT(*) FROM telegram_admin_import_session WHERE last_post_id IS NOT NULL OR 1=1) AS sessions,
  (SELECT COUNT(*) FROM hub_suggestions) AS suggestions`);
async function analyzeUrl(url){
  const req=new Request('https://internal/api/admin/hub-telegram-analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url})});
  const r=await analyzeTelegramPost(req),d=await r.json();
  if(!r.ok||!d.ok)throw new Error(d.message||d.error||'ANALYZE_FAILED');
  return d;
}
function forwardedMeta(message){
  const o=message?.forward_origin;
  if(o?.type==='channel'&&o.chat?.username&&o.message_id)return{channel:o.chat.username,postId:Number(o.message_id),url:`https://t.me/${o.chat.username}/${o.message_id}`};
  const legacy=message?.forward_from_chat;
  if(legacy?.username&&message?.forward_from_message_id)return{channel:legacy.username,postId:Number(message.forward_from_message_id),url:`https://t.me/${legacy.username}/${message.forward_from_message_id}`};
  return null;
}
function extractTelegramUrl(text){return clean(text).match(/https?:\/\/t\.me\/(?:s\/)?[A-Za-z0-9_]+\/\d+/i)?.[0]||''}
function parseSourceUrl(url){try{const u=new URL(url),m=u.pathname.replace(/^\/s\//,'/').match(/^\/([^/]+)\/(\d+)/);return m?{channel:m[1],postId:Number(m[2]),url:`https://t.me/${m[1]}/${m[2]}`} : null}catch{return null}}
function directFiles(message,sourceUrl){
  const out=[];
  if(message?.document?.file_id)out.push({telegram_file_id:message.document.file_id,telegram_file_unique_id:message.document.file_unique_id||'',name:message.document.file_name||`telegram-file-${message.message_id}`,size:Number(message.document.file_size||0),type:message.document.mime_type||'application/octet-stream',source:'telegram-bot',source_post:sourceUrl});
  if(message?.audio?.file_id)out.push({telegram_file_id:message.audio.file_id,telegram_file_unique_id:message.audio.file_unique_id||'',name:message.audio.file_name||`audio-${message.message_id}.mp3`,size:Number(message.audio.file_size||0),type:message.audio.mime_type||'audio/mpeg',source:'telegram-bot',source_post:sourceUrl});
  if(message?.video?.file_id)out.push({telegram_file_id:message.video.file_id,telegram_file_unique_id:message.video.file_unique_id||'',name:message.video.file_name||`video-${message.message_id}.mp4`,size:Number(message.video.file_size||0),type:message.video.mime_type||'video/mp4',source:'telegram-bot',source_post:sourceUrl});
  return out;
}
function directMedia(message,sourceUrl){
  const photos=Array.isArray(message?.photo)?message.photo:[];
  if(!photos.length)return[];
  const p=photos[photos.length-1];
  return[{telegram_file_id:p.file_id,telegram_file_unique_id:p.file_unique_id||'',size:Number(p.file_size||0),width:p.width||0,height:p.height||0,source:'telegram-bot-photo',source_post:sourceUrl}];
}
function applyChannelIdentity(analysis,channel){
  if(!analysis||!channel)return analysis;
  analysis.source=analysis.source||{};
  analysis.source.channel=channel;
  analysis.source.author=channel;
  analysis.draft=analysis.draft||{};
  analysis.draft.creator=channel;
  analysis.draft.creatorLink=`https://t.me/${channel}`;
  return analysis;
}
async function saveDraft(env,analysis){
  await ensureDraftSchema(env);
  const id=crypto.randomUUID(),source=clean(analysis?.source?.url);
  if(!source)throw new Error('SOURCE_URL_MISSING');
  const existing=await env.DB.prepare('SELECT id FROM telegram_admin_drafts WHERE source_url=? LIMIT 1').bind(source).first();
  if(existing?.id){await env.DB.prepare("UPDATE telegram_admin_drafts SET payload=?,status='review',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(analysis),existing.id).run();return existing.id}
  await env.DB.prepare("INSERT INTO telegram_admin_drafts(id,source_url,payload,status) VALUES(?,?,?,'review')").bind(id,source,JSON.stringify(analysis)).run();
  return id;
}
async function getDraft(env,id){
  await ensureDraftSchema(env);
  const row=await env.DB.prepare('SELECT * FROM telegram_admin_drafts WHERE id=? LIMIT 1').bind(id).first();
  if(!row)return null;
  try{row.analysis=JSON.parse(row.payload||'{}')}catch{row.analysis={}}
  return row;
}
async function setSession(env,userId,channel,draftId,postId){
  await ensureDraftSchema(env);
  await env.DB.prepare(`INSERT INTO telegram_admin_import_session(admin_user_id,channel,draft_id,last_post_id,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(admin_user_id) DO UPDATE SET channel=excluded.channel,draft_id=excluded.draft_id,last_post_id=excluded.last_post_id,updated_at=CURRENT_TIMESTAMP`).bind(String(userId),channel||'',draftId||'',Number(postId||0)).run();
}
async function getSession(env,userId){await ensureDraftSchema(env);return env.DB.prepare("SELECT * FROM telegram_admin_import_session WHERE admin_user_id=? AND updated_at>=datetime('now','-20 minutes') LIMIT 1").bind(String(userId)).first()}
function shouldMerge(session,meta,message){
  if(!session||!meta||session.channel!==meta.channel||!session.draft_id)return false;
  const delta=Math.abs(Number(meta.postId)-Number(session.last_post_id||0));
  if(delta>4)return false;
  const hasAttachment=Boolean(message?.document||message?.audio||message?.video||message?.photo?.length);
  const body=clean(message?.text||message?.caption);
  return hasAttachment||body.length<100;
}
async function mergeDraft(env,row,incoming,message,meta){
  const base=row.analysis||{},inc=incoming||{};
  base.source=base.source||{};base.draft=base.draft||{};
  const channel=meta?.channel||inc.source?.channel||base.source?.channel||'';
  applyChannelIdentity(base,channel);
  const primary=clean(base.source.url||row.source_url||meta?.url);
  base.source.url=primary;
  base.sourcePosts=uniqBy([...(base.sourcePosts||[]),primary,meta?.url,inc.source?.url].filter(Boolean).map(url=>({url})),x=>x.url);
  const incText=clean(inc.source?.rawText);
  const baseText=clean(base.source?.rawText);
  if(incText&&(!baseText||baseText.length<80)&&incText.length>baseText.length){
    base.source.rawText=incText;
    base.draft.title=inc.draft?.title||base.draft.title;
    base.draft.descriptionShort=inc.draft?.descriptionShort||base.draft.descriptionShort;
    base.draft.descriptionFull=inc.draft?.descriptionFull||incText;
    base.draft.type=inc.draft?.type||base.draft.type;
    base.draft.models=inc.draft?.models||base.draft.models;
    base.draft.settings=inc.draft?.settings||base.draft.settings;
  }
  base.media=uniqBy([...(base.media||[]),...(inc.media||[]),...directMedia(message,meta?.url)],x=>x.url||x.telegram_file_unique_id||x.telegram_file_id);
  base.files=uniqBy([...(base.files||[]),...(inc.files||[]),...directFiles(message,meta?.url)],x=>x.telegram_file_unique_id||x.telegram_file_id||x.url||`${x.name}:${x.size}`);
  base.diagnostics={...(base.diagnostics||{}),sourcePosts:base.sourcePosts.length,directFiles:base.files.filter(x=>x.telegram_file_id).length};
  await env.DB.prepare("UPDATE telegram_admin_drafts SET payload=?,status='review',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(base),row.id).run();
  return getDraft(env,row.id);
}
function draftText(row){
  const a=row.analysis||{},d=a.draft||{},posts=(a.sourcePosts||[]).length||1;
  return `<b>DRAFT RESOURCE</b>\n\n<b>${esc(d.title||'UNTITLED')}</b>\nTYPE: ${esc(d.type||'other')}\nAUTHOR: ${esc(d.creator||a.source?.channel||'—')}\nSOURCE POSTS: ${posts}\nMEDIA: ${(a.media||[]).length} · FILES: ${(a.files||[]).length}\nSOURCE: ${esc(a.source?.url||row.source_url)}\n\n${esc(short(d.descriptionShort||d.descriptionFull||'',260))}`;
}
function draftButtons(id,source){return{inline_keyboard:[
  [button('PUBLISH','draft:publish:'+id),button('RE-ANALYZE','draft:reanalyze:'+id)],
  [source?urlButton('ORIGINAL POST ↗',source):button('SOURCE','noop'),button('DELETE','draft:delete:'+id)],
  [button('← DRAFTS','adm:drafts'),button('HOME','adm:home')]
]}}
async function downloadTelegramFile(token,file){
  const info=await tg(token,'getFile',{file_id:file.telegram_file_id});
  if(!info?.file_path)throw new Error('TELEGRAM_FILE_PATH_MISSING');
  const r=await fetch(`https://api.telegram.org/file/bot${token}/${info.file_path}`);
  if(!r.ok)throw new Error(`TELEGRAM_FILE_DOWNLOAD_${r.status}`);
  return new File([await r.arrayBuffer()],file.name||info.file_path.split('/').pop()||'telegram-file',{type:file.type||r.headers.get('content-type')||'application/octet-stream'});
}
async function publishDraft(token,env,row){
  const a=row.analysis||{},d=a.draft||{},channel=clean(a.source?.channel);
  const allFiles=Array.isArray(a.files)?a.files:[],botFiles=allFiles.filter(f=>f.telegram_file_id),remoteFiles=allFiles.filter(f=>f.url&&!f.telegram_file_id);
  const payload={source:{type:'telegram',url:a.source?.url||row.source_url},type:clean(d.type)||'other',title:clean(d.title)||'UNTITLED RESOURCE',creator:{name:channel||clean(d.creator||a.source?.author),link:channel?`https://t.me/${channel}`:clean(d.creatorLink)},description_short:clean(d.descriptionShort),description_full:clean(d.descriptionFull||a.source?.rawText),additional_info:'',models:Array.isArray(d.models)?d.models:[],settings:Array.isArray(d.settings)?d.settings:[],tags:Array.isArray(d.tags)?d.tags:[],media:Array.isArray(a.media)?a.media.filter(x=>x.url):[],confidence:a.confidence||{}};
  let req;
  if(botFiles.length){
    const form=new FormData();form.append('resource',new Blob([JSON.stringify(payload)],{type:'application/json'}),'resource.json');
    for(const f of botFiles)form.append('files',await downloadTelegramFile(token,f),f.name||'telegram-file');
    for(const f of remoteFiles)form.append('remoteFiles',JSON.stringify({...f,source:'telegram'}));
    req=new Request('https://internal/api/admin/hub-resource',{method:'POST',body:form});
  }else{
    payload.files=remoteFiles.map(f=>({...f,source:'telegram'}));
    req=new Request('https://internal/api/admin/hub-resource',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  }
  const r=await publishHubResource(req,env),out=await r.json();
  if(!r.ok||!out.ok)throw new Error(out.detail||out.error||'PUBLISH_FAILED');
  await env.DB.prepare("UPDATE telegram_admin_drafts SET status='published',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.id).run();
  return out;
}

async function adminStats(env){
  const one=async(sql)=>{try{return Number((await env.DB.prepare(sql).first())?.n||0)}catch{return 0}};
  const [resources,drafts,suggestions,characters,files]=await Promise.all([one("SELECT COUNT(*) n FROM hub_resources WHERE status='published'"),one("SELECT COUNT(*) n FROM telegram_admin_drafts WHERE status='review'"),one("SELECT COUNT(*) n FROM hub_suggestions WHERE status='new'"),one('SELECT COUNT(*) n FROM characters'),one('SELECT COUNT(*) n FROM hub_resource_files')]);
  return `<b>ARCHIVE.EXE / STATS</b>\n\nHUB RESOURCES: ${resources}\nDRAFTS: ${drafts}\nNEW SUGGESTIONS: ${suggestions}\nBOT CARDS: ${characters}\nHUB FILES: ${files}`;
}
async function adminDrafts(env){await ensureDraftSchema(env);return (await env.DB.prepare("SELECT id,source_url,payload,status,updated_at FROM telegram_admin_drafts WHERE status='review' ORDER BY updated_at DESC LIMIT 8").all()).results||[]}
async function showDraftList(token,chatId,messageId,env){
  const rows=await adminDrafts(env);
  if(!rows.length)return edit(token,chatId,messageId,'<b>DRAFTS</b>\n\nNo drafts waiting for review.',{inline_keyboard:[[button('＋ IMPORT','adm:import'),button('HOME','adm:home')]]});
  const keys=[];for(const r of rows){let title='UNTITLED';try{title=JSON.parse(r.payload||'{}')?.draft?.title||title}catch{}keys.push([button(short(title,36),'draft:view:'+r.id)])}
  keys.push([button('＋ IMPORT','adm:import'),button('HOME','adm:home')]);
  return edit(token,chatId,messageId,`<b>DRAFTS</b>\n\n${rows.length} most recent drafts waiting for review.`,{inline_keyboard:keys});
}
async function showSuggestions(token,chatId,messageId,env){
  await ensureDraftSchema(env);
  const rows=(await env.DB.prepare("SELECT id,url,note,created_at FROM hub_suggestions WHERE status='new' ORDER BY created_at DESC LIMIT 6").all()).results||[];
  if(!rows.length)return edit(token,chatId,messageId,'<b>COMMUNITY SUGGESTIONS</b>\n\nInbox is empty.',{inline_keyboard:[[button('HOME','adm:home')]]});
  const keys=rows.map(r=>[button('IMPORT #'+r.id,'sug:import:'+r.id),button('IGNORE','sug:ignore:'+r.id)]);keys.push([button('HOME','adm:home')]);
  const lines=rows.map(r=>`#${r.id} · ${esc(short(r.url,70))}${r.note?`\n${esc(short(r.note,80))}`:''}`).join('\n\n');
  return edit(token,chatId,messageId,`<b>COMMUNITY SUGGESTIONS</b>\n\n${lines}`,{inline_keyboard:keys});
}
async function showHub(token,chatId,messageId,env,origin){const rows=(await env.DB.prepare("SELECT id,title,type,creator_name FROM hub_resources WHERE status='published' ORDER BY updated_at DESC LIMIT 8").all()).results||[];const text=rows.length?rows.map(r=>`• <b>${esc(short(r.title,42))}</b> · ${esc(r.type)}${r.creator_name?` · ${esc(r.creator_name)}`:''}`).join('\n'):'No resources yet.';return edit(token,chatId,messageId,`<b>TAVO HUB / LATEST</b>\n\n${text}`,{inline_keyboard:[[urlButton('OPEN HUB ↗',origin+'/hub.html')],[button('HOME','adm:home')]]})}
async function showAuthors(token,chatId,messageId,env){const rows=(await env.DB.prepare("SELECT creator_name,COUNT(*) n FROM hub_resources WHERE status='published' AND creator_name!='' GROUP BY creator_name ORDER BY n DESC,creator_name LIMIT 12").all()).results||[];const text=rows.length?rows.map(r=>`${r.n} · ${esc(r.creator_name)}`).join('\n'):'No creator data yet.';return edit(token,chatId,messageId,`<b>AUTHORS</b>\n\n${text}`,{inline_keyboard:[[button('HOME','adm:home')]]})}
async function showIssues(token,chatId,messageId,env){const one=async(sql)=>Number((await env.DB.prepare(sql).first())?.n||0);const [noCreator,noFiles,noMedia,other]=await Promise.all([one("SELECT COUNT(*) n FROM hub_resources WHERE status='published' AND trim(creator_name)=''"),one("SELECT COUNT(*) n FROM hub_resources r WHERE status='published' AND NOT EXISTS(SELECT 1 FROM hub_resource_files f WHERE f.resource_id=r.id AND f.name NOT LIKE '__extra__%')"),one("SELECT COUNT(*) n FROM hub_resources WHERE status='published' AND (media='[]' OR media='' OR media IS NULL)"),one("SELECT COUNT(*) n FROM hub_resources WHERE status='published' AND type='other'")]);return edit(token,chatId,messageId,`<b>HUB ISSUES</b>\n\nNO CREATOR: ${noCreator}\nNO DOWNLOAD FILE: ${noFiles}\nNO MEDIA: ${noMedia}\nTYPE OTHER: ${other}`,{inline_keyboard:[[button('HOME','adm:home')]]})}

async function handleAdminMessage(token,message,env,origin){
  const chatId=message.chat?.id,text=clean(message.text||message.caption),uid=String(message.from?.id||'');
  if(uid!==String(env.TELEGRAM_ADMIN_USER_ID||''))return;
  if(text==='/start'||text==='/menu')return send(token,chatId,'<b>ARCHIVE.EXE ADMIN</b>\n\nPrivate control console connected to the site database.',adminMenu());
  const meta=forwardedMeta(message)||parseSourceUrl(extractTelegramUrl(text));
  if(meta){
    await send(token,chatId,'ANALYZING TELEGRAM POST…');
    try{
      let analysis=null;try{analysis=await analyzeUrl(meta.url)}catch{}
      if(!analysis)analysis={ok:true,source:{type:'telegram',url:meta.url,channel:meta.channel,postId:String(meta.postId),rawText:text,author:meta.channel},draft:{title:text&&text.length<120?text:'ATTACHMENTS',creator:meta.channel,creatorLink:`https://t.me/${meta.channel}`,type:'other',models:[],settings:[],descriptionShort:text,descriptionFull:text,tags:[]},media:[],files:[],confidence:{}};
      applyChannelIdentity(analysis,meta.channel);
      analysis.sourcePosts=[{url:meta.url}];
      analysis.files=uniqBy([...(analysis.files||[]),...directFiles(message,meta.url)],x=>x.telegram_file_unique_id||x.telegram_file_id||x.url||`${x.name}:${x.size}`);
      analysis.media=uniqBy([...(analysis.media||[]),...directMedia(message,meta.url)],x=>x.url||x.telegram_file_unique_id||x.telegram_file_id);
      const session=await getSession(env,uid);
      if(shouldMerge(session,meta,message)){
        const target=await getDraft(env,session.draft_id);
        if(target){const merged=await mergeDraft(env,target,analysis,message,meta);await setSession(env,uid,meta.channel,merged.id,meta.postId);return send(token,chatId,`<b>ATTACHED TO EXISTING DRAFT ✓</b>\n\n${draftText(merged)}`,draftButtons(merged.id,merged.source_url))}
      }
      const id=await saveDraft(env,analysis),row=await getDraft(env,id);await setSession(env,uid,meta.channel,id,meta.postId);return send(token,chatId,draftText(row),draftButtons(id,row.source_url));
    }catch(e){return send(token,chatId,`<b>IMPORT FAILED</b>\n\n${esc(e.message||e)}`,{inline_keyboard:[[button('TRY ANOTHER','adm:import'),button('HOME','adm:home')]]})}
  }
  if(text)return send(token,chatId,'Send me a public <b>t.me/channel/post</b> link or forward a post from a public channel. Consecutive attachment posts from the same channel are merged into the active draft automatically.',adminMenu());
}

async function handleAdminCallback(token,q,env,origin){
  const uid=String(q.from?.id||''),chatId=q.message?.chat?.id,messageId=q.message?.message_id,data=clean(q.data);
  if(uid!==String(env.TELEGRAM_ADMIN_USER_ID||'')){await answerCb(token,q.id,'Access denied');return}
  await answerCb(token,q.id);if(data==='noop')return;
  if(data==='adm:home')return edit(token,chatId,messageId,'<b>ARCHIVE.EXE ADMIN</b>\n\nPrivate control console connected to the site database.',adminMenu());
  if(data==='adm:import')return edit(token,chatId,messageId,'<b>IMPORT RESOURCE</b>\n\nForward the description post first, then any adjacent posts with files. If they come from the same channel and are close together, they will be merged into one draft automatically.',{inline_keyboard:[[button('HOME','adm:home')]]});
  if(data==='adm:drafts')return showDraftList(token,chatId,messageId,env);
  if(data==='adm:suggestions')return showSuggestions(token,chatId,messageId,env);
  if(data==='adm:hub')return showHub(token,chatId,messageId,env,origin);
  if(data==='adm:authors')return showAuthors(token,chatId,messageId,env);
  if(data==='adm:issues')return showIssues(token,chatId,messageId,env);
  if(data==='adm:stats')return edit(token,chatId,messageId,await adminStats(env),{inline_keyboard:[[button('HOME','adm:home')]]});
  if(data.startsWith('draft:view:')){const id=data.slice(11),row=await getDraft(env,id);if(!row)return edit(token,chatId,messageId,'Draft not found.',{inline_keyboard:[[button('DRAFTS','adm:drafts')]]});return edit(token,chatId,messageId,draftText(row),draftButtons(id,row.source_url))}
  if(data.startsWith('draft:reanalyze:')){const id=data.slice(16),row=await getDraft(env,id);if(!row)return;try{const a=await analyzeUrl(row.source_url),old=row.analysis||{};applyChannelIdentity(a,old.source?.channel||a.source?.channel);a.sourcePosts=old.sourcePosts||[{url:row.source_url}];a.files=uniqBy([...(a.files||[]),...(old.files||[]).filter(x=>x.telegram_file_id)],x=>x.telegram_file_unique_id||x.telegram_file_id||x.url||`${x.name}:${x.size}`);await env.DB.prepare("UPDATE telegram_admin_drafts SET payload=?,status='review',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(a),id).run();const fresh=await getDraft(env,id);return edit(token,chatId,messageId,draftText(fresh),draftButtons(id,fresh.source_url))}catch(e){return edit(token,chatId,messageId,`<b>RE-ANALYZE FAILED</b>\n${esc(e.message||e)}`,draftButtons(id,row.source_url))}}
  if(data.startsWith('draft:publish:')){const id=data.slice(14),row=await getDraft(env,id);if(!row)return;try{const out=await publishDraft(token,env,row);return edit(token,chatId,messageId,`<b>PUBLISHED ✓</b>\n\n${esc(row.analysis?.draft?.title||'Resource')}\nID: ${esc(out.id||'')}`,{inline_keyboard:[[urlButton('OPEN HUB ↗',origin+'/hub.html')],[button('DRAFTS','adm:drafts'),button('HOME','adm:home')]]})}catch(e){return edit(token,chatId,messageId,`<b>PUBLISH FAILED</b>\n\n${esc(e.message||e)}`,draftButtons(id,row.source_url))}}
  if(data.startsWith('draft:delete:')){const id=data.slice(13);await ensureDraftSchema(env);await env.DB.prepare('DELETE FROM telegram_admin_drafts WHERE id=?').bind(id).run();await env.DB.prepare('DELETE FROM telegram_admin_import_session WHERE draft_id=?').bind(id).run();return showDraftList(token,chatId,messageId,env)}
  if(data.startsWith('sug:ignore:')){const id=Number(data.slice(11));await env.DB.prepare("UPDATE hub_suggestions SET status='ignored',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();return showSuggestions(token,chatId,messageId,env)}
  if(data.startsWith('sug:import:')){const sid=Number(data.slice(11)),s=await env.DB.prepare('SELECT id,url FROM hub_suggestions WHERE id=? LIMIT 1').bind(sid).first();if(!s)return showSuggestions(token,chatId,messageId,env);try{const a=await analyzeUrl(s.url),meta=parseSourceUrl(s.url);if(meta)applyChannelIdentity(a,meta.channel);const id=await saveDraft(env,a);await env.DB.prepare("UPDATE hub_suggestions SET status='reviewing',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(sid).run();const row=await getDraft(env,id);return edit(token,chatId,messageId,draftText(row),draftButtons(id,row.source_url))}catch(e){return edit(token,chatId,messageId,`<b>SUGGESTION IMPORT FAILED</b>\n\n${esc(e.message||e)}`,{inline_keyboard:[[button('← SUGGESTIONS','adm:suggestions')]]})}}
}

async function publicSearch(env,q,limit=7){q='%'+clean(q).replace(/[%_]/g,'')+'%';return (await env.DB.prepare("SELECT id,title,type,creator_name,description_short FROM hub_resources WHERE status='published' AND (title LIKE ? OR creator_name LIKE ? OR description_short LIKE ?) ORDER BY updated_at DESC LIMIT ?").bind(q,q,q,limit).all()).results||[]}
function publicResultsText(rows,title='RESULTS'){if(!rows.length)return `<b>${title}</b>\n\nNothing found.`;return `<b>${title}</b>\n\n`+rows.map(r=>`• <b>${esc(short(r.title,48))}</b>\n  ${esc(r.type)}${r.creator_name?` · ${esc(r.creator_name)}`:''}`).join('\n\n')}
function publicResultButtons(rows,origin){const keys=rows.slice(0,6).map(r=>[button(short(r.title,42),'pub:res:'+r.id)]);keys.push([urlButton('OPEN TAVO HUB ↗',origin+'/hub.html'),button('HOME','pub:home')]);return{inline_keyboard:keys}}
async function publicResource(token,chatId,messageId,env,id,origin){const r=await env.DB.prepare("SELECT id,title,type,creator_name,creator_link,description_short,source_url FROM hub_resources WHERE id=? AND status='published' LIMIT 1").bind(id).first();if(!r)return edit(token,chatId,messageId,'Resource not found.',publicMenu());const keys=[];if(r.source_url)keys.push([urlButton('ORIGINAL POST ↗',r.source_url)]);if(r.creator_link)keys.push([urlButton('AUTHOR ↗',r.creator_link)]);keys.push([urlButton('OPEN HUB ↗',origin+'/hub.html'),button('HOME','pub:home')]);return edit(token,chatId,messageId,`<b>${esc(r.title)}</b>\n${esc(r.type)}${r.creator_name?` · ${esc(r.creator_name)}`:''}\n\n${esc(short(r.description_short,500))}`,{inline_keyboard:keys})}
async function handlePublicMessage(token,message,env,origin){const chatId=message.chat?.id,text=clean(message.text);if(text==='/start'||text==='/menu')return send(token,chatId,'<b>ARCHIVE.EXE</b>\n\nTAVO resources and bot archive.',publicMenu());if(text){const rows=await publicSearch(env,text);return send(token,chatId,publicResultsText(rows,`SEARCH: ${esc(short(text,35))}`),publicResultButtons(rows,origin))}}
async function handlePublicCallback(token,q,env,origin){const chatId=q.message?.chat?.id,messageId=q.message?.message_id,data=clean(q.data);await answerCb(token,q.id);if(data==='pub:home')return edit(token,chatId,messageId,'<b>ARCHIVE.EXE</b>\n\nTAVO resources and bot archive.',publicMenu());if(data==='pub:search')return edit(token,chatId,messageId,'<b>SEARCH</b>\n\nSend the resource name, creator or a keyword.',{inline_keyboard:[[button('HOME','pub:home')]]});if(data==='pub:hub')return edit(token,chatId,messageId,'<b>TAVO HUB</b>\n\nOpen the full resource catalog on the site.',{inline_keyboard:[[urlButton('OPEN HUB ↗',origin+'/hub.html')],[button('HOME','pub:home')]]});if(data==='pub:latest'){const rows=(await env.DB.prepare("SELECT id,title,type,creator_name,description_short FROM hub_resources WHERE status='published' ORDER BY updated_at DESC LIMIT 7").all()).results||[];return edit(token,chatId,messageId,publicResultsText(rows,'LATEST'),publicResultButtons(rows,origin))}if(data==='pub:random'){const r=await env.DB.prepare("SELECT id FROM hub_resources WHERE status='published' ORDER BY RANDOM() LIMIT 1").first();return r?publicResource(token,chatId,messageId,env,r.id,origin):edit(token,chatId,messageId,'No resources yet.',publicMenu())}if(data.startsWith('pub:type:')){const type=data.slice(9),rows=(await env.DB.prepare("SELECT id,title,type,creator_name,description_short FROM hub_resources WHERE status='published' AND type=? ORDER BY updated_at DESC LIMIT 7").bind(type).all()).results||[];return edit(token,chatId,messageId,publicResultsText(rows,type.toUpperCase()),publicResultButtons(rows,origin))}if(data.startsWith('pub:res:'))return publicResource(token,chatId,messageId,env,data.slice(8),origin)}

export async function handleAdminTelegram(request,env){
  if(request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  const token=clean(env.Node00admin);if(!token)return json({ok:false,error:'ADMIN_BOT_TOKEN_MISSING'},503);
  const expected=await webhookSecret(token,'admin');if(request.headers.get('x-telegram-bot-api-secret-token')!==expected)return json({ok:false,error:'INVALID_WEBHOOK_SECRET'},403);
  let u={};try{u=await request.json()}catch{return json({ok:false,error:'INVALID_JSON'},400)}
  const origin=new URL(request.url).origin;
  try{if(u.callback_query)await handleAdminCallback(token,u.callback_query,env,origin);else if(u.message)await handleAdminMessage(token,u.message,env,origin)}catch(e){console.error('admin telegram error',e);try{const chatId=u.message?.chat?.id||u.callback_query?.message?.chat?.id;if(chatId)await send(token,chatId,`<b>ADMIN BOT ERROR</b>\n${esc(e.message||e)}`,adminMenu())}catch{}}
  return json({ok:true});
}
export async function handlePublicTelegram(request,env){
  if(request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  const token=clean(env.PUBLICnode00bot);if(!token)return json({ok:false,error:'PUBLIC_BOT_TOKEN_MISSING'},503);
  const expected=await webhookSecret(token,'public');if(request.headers.get('x-telegram-bot-api-secret-token')!==expected)return json({ok:false,error:'INVALID_WEBHOOK_SECRET'},403);
  let u={};try{u=await request.json()}catch{return json({ok:false,error:'INVALID_JSON'},400)}
  const origin=new URL(request.url).origin;
  try{if(u.callback_query)await handlePublicCallback(token,u.callback_query,env,origin);else if(u.message)await handlePublicMessage(token,u.message,env,origin)}catch(e){console.error('public telegram error',e)}
  return json({ok:true});
}
export async function setupTelegramWebhooks(request,env){
  if(request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  const origin=new URL(request.url).origin,admin=clean(env.Node00admin),pub=clean(env.PUBLICnode00bot),results={};
  if(!admin||!clean(env.TELEGRAM_ADMIN_USER_ID))return json({ok:false,error:'ADMIN_TELEGRAM_SECRETS_MISSING'},503);
  try{const secret=await webhookSecret(admin,'admin');results.admin=await tg(admin,'setWebhook',{url:origin+'/telegram/admin',secret_token:secret,allowed_updates:['message','callback_query'],drop_pending_updates:false});await tg(admin,'setMyCommands',{commands:[{command:'start',description:'Open ARCHIVE.EXE admin menu'},{command:'menu',description:'Open admin menu'}]})}catch(e){results.admin_error=e.message||String(e)}
  if(pub){try{const secret=await webhookSecret(pub,'public');results.public=await tg(pub,'setWebhook',{url:origin+'/telegram/public',secret_token:secret,allowed_updates:['message','callback_query'],drop_pending_updates:false});await tg(pub,'setMyCommands',{commands:[{command:'start',description:'Open ARCHIVE.EXE'},{command:'menu',description:'Open main menu'}]})}catch(e){results.public_error=e.message||String(e)}}
  return json({ok:!results.admin_error&&!results.public_error,origin,results});
}
export async function telegramWebhookStatus(request,env){
  if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  const out={};try{if(env.Node00admin)out.admin=await tg(clean(env.Node00admin),'getWebhookInfo')}catch(e){out.admin_error=e.message||String(e)}try{if(env.PUBLICnode00bot)out.public=await tg(clean(env.PUBLICnode00bot),'getWebhookInfo')}catch(e){out.public_error=e.message||String(e)}return json({ok:true,webhooks:out});
}