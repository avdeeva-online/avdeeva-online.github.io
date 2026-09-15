import { analyzeTelegramPost } from './hub-telegram.js';
import { publishHubResource } from './hub-resources.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=v=>String(v??'').trim();
const esc=s=>clean(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const short=(s,n=420)=>{s=clean(s).replace(/\s+/g,' ');return s.length>n?s.slice(0,n-1)+'…':s};

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
async function send(token,chatId,text,reply_markup){
  return tg(token,'sendMessage',{chat_id:chatId,text,parse_mode:'HTML',disable_web_page_preview:true,...(reply_markup?{reply_markup}:{})});
}
async function edit(token,chatId,messageId,text,reply_markup){
  try{return await tg(token,'editMessageText',{chat_id:chatId,message_id:messageId,text,parse_mode:'HTML',disable_web_page_preview:true,...(reply_markup?{reply_markup}:{})})}
  catch{return send(token,chatId,text,reply_markup)}
}
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

async function ensureDraftSchema(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS telegram_admin_drafts(
    id TEXT PRIMARY KEY,
    source_url TEXT NOT NULL UNIQUE,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'review',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_telegram_admin_drafts_status_updated ON telegram_admin_drafts(status,updated_at DESC)').run();
}
async function analyzeUrl(url){
  const req=new Request('https://internal/api/admin/hub-telegram-analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url})});
  const r=await analyzeTelegramPost(req),d=await r.json();
  if(!r.ok||!d.ok)throw new Error(d.message||d.error||'ANALYZE_FAILED');
  return d;
}
async function saveDraft(env,analysis){
  await ensureDraftSchema(env);
  const id=crypto.randomUUID(),source=clean(analysis?.source?.url);
  if(!source)throw new Error('SOURCE_URL_MISSING');
  const existing=await env.DB.prepare('SELECT id FROM telegram_admin_drafts WHERE source_url=? LIMIT 1').bind(source).first();
  if(existing?.id){
    await env.DB.prepare("UPDATE telegram_admin_drafts SET payload=?,status='review',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(analysis),existing.id).run();
    return existing.id;
  }
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
function draftText(row){
  const a=row.analysis||{},d=a.draft||{};
  return `<b>DRAFT RESOURCE</b>\n\n<b>${esc(d.title||'UNTITLED')}</b>\nTYPE: ${esc(d.type||'other')}\nAUTHOR: ${esc(d.creator||a.source?.author||'—')}\nMEDIA: ${(a.media||[]).length} · FILES: ${(a.files||[]).length}\nSOURCE: ${esc(a.source?.url||row.source_url)}\n\n${esc(short(d.descriptionShort||d.descriptionFull||'',260))}`;
}
function draftButtons(id,source){return{inline_keyboard:[
  [button('PUBLISH','draft:publish:'+id),button('RE-ANALYZE','draft:reanalyze:'+id)],
  [source?urlButton('ORIGINAL POST ↗',source):button('SOURCE','noop'),button('DELETE','draft:delete:'+id)],
  [button('← DRAFTS','adm:drafts'),button('HOME','adm:home')]
]}}
async function publishDraft(env,row){
  const a=row.analysis||{},d=a.draft||{};
  const payload={
    source:{type:'telegram',url:a.source?.url||row.source_url},
    type:clean(d.type)||'other',
    title:clean(d.title)||'UNTITLED RESOURCE',
    creator:{name:clean(d.creator||a.source?.author),link:clean(d.creatorLink)||clean(a.source?.channel?`https://t.me/${a.source.channel}`:'')},
    description_short:clean(d.descriptionShort),
    description_full:clean(d.descriptionFull||a.source?.rawText),
    additional_info:'',
    models:Array.isArray(d.models)?d.models:[],
    settings:Array.isArray(d.settings)?d.settings:[],
    tags:Array.isArray(d.tags)?d.tags:[],
    media:Array.isArray(a.media)?a.media:[],
    confidence:a.confidence||{},
    files:(Array.isArray(a.files)?a.files:[]).map(f=>({...f,source:'telegram'}))
  };
  const req=new Request('https://internal/api/admin/hub-resource',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const r=await publishHubResource(req,env),out=await r.json();
  if(!r.ok||!out.ok)throw new Error(out.detail||out.error||'PUBLISH_FAILED');
  await env.DB.prepare("UPDATE telegram_admin_drafts SET status='published',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.id).run();
  return out;
}

function forwardedTelegramUrl(message){
  const o=message?.forward_origin;
  if(o?.type==='channel'&&o.chat?.username&&o.message_id)return `https://t.me/${o.chat.username}/${o.message_id}`;
  const legacy=message?.forward_from_chat;
  if(legacy?.username&&message?.forward_from_message_id)return `https://t.me/${legacy.username}/${message.forward_from_message_id}`;
  return '';
}
function extractTelegramUrl(text){return clean(text).match(/https?:\/\/t\.me\/(?:s\/)?[A-Za-z0-9_]+\/\d+/i)?.[0]||''}

async function adminStats(env){
  const one=async(sql)=>{try{return Number((await env.DB.prepare(sql).first())?.n||0)}catch{return 0}};
  const [resources,drafts,suggestions,characters,files]=await Promise.all([
    one("SELECT COUNT(*) n FROM hub_resources WHERE status='published'"),
    one("SELECT COUNT(*) n FROM telegram_admin_drafts WHERE status='review'"),
    one("SELECT COUNT(*) n FROM hub_suggestions WHERE status='new'"),
    one('SELECT COUNT(*) n FROM characters'),
    one('SELECT COUNT(*) n FROM hub_resource_files')
  ]);
  return `<b>ARCHIVE.EXE / STATS</b>\n\nHUB RESOURCES: ${resources}\nDRAFTS: ${drafts}\nNEW SUGGESTIONS: ${suggestions}\nBOT CARDS: ${characters}\nHUB FILES: ${files}`;
}
async function adminDrafts(env){
  await ensureDraftSchema(env);
  return (await env.DB.prepare("SELECT id,source_url,payload,status,updated_at FROM telegram_admin_drafts WHERE status='review' ORDER BY updated_at DESC LIMIT 8").all()).results||[];
}
async function showDraftList(token,chatId,messageId,env){
  const rows=await adminDrafts(env);
  if(!rows.length)return edit(token,chatId,messageId,'<b>DRAFTS</b>\n\nNo drafts waiting for review.',{inline_keyboard:[[button('＋ IMPORT','adm:import'),button('HOME','adm:home')]]});
  const keys=[];for(const r of rows){let title='UNTITLED';try{title=JSON.parse(r.payload||'{}')?.draft?.title||title}catch{}keys.push([button(short(title,36),'draft:view:'+r.id)])}
  keys.push([button('＋ IMPORT','adm:import'),button('HOME','adm:home')]);
  return edit(token,chatId,messageId,`<b>DRAFTS</b>\n\n${rows.length} most recent drafts waiting for review.`,{inline_keyboard:keys});
}
async function showSuggestions(token,chatId,messageId,env){
  try{await env.DB.prepare(`CREATE TABLE IF NOT EXISTS hub_suggestions (id INTEGER PRIMARY KEY AUTOINCREMENT,url TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'new',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run()}catch{}
  const rows=(await env.DB.prepare("SELECT id,url,note,created_at FROM hub_suggestions WHERE status='new' ORDER BY created_at DESC LIMIT 6").all()).results||[];
  if(!rows.length)return edit(token,chatId,messageId,'<b>COMMUNITY SUGGESTIONS</b>\n\nInbox is empty.',{inline_keyboard:[[button('HOME','adm:home')]]});
  const keys=rows.map(r=>[button('IMPORT #'+r.id,'sug:import:'+r.id),button('IGNORE','sug:ignore:'+r.id)]);keys.push([button('HOME','adm:home')]);
  const lines=rows.map(r=>`#${r.id} · ${esc(short(r.url,70))}${r.note?`\n${esc(short(r.note,80))}`:''}`).join('\n\n');
  return edit(token,chatId,messageId,`<b>COMMUNITY SUGGESTIONS</b>\n\n${lines}`,{inline_keyboard:keys});
}
async function showHub(token,chatId,messageId,env,origin){
  const rows=(await env.DB.prepare("SELECT id,title,type,creator_name FROM hub_resources WHERE status='published' ORDER BY updated_at DESC LIMIT 8").all()).results||[];
  const text=rows.length?rows.map(r=>`• <b>${esc(short(r.title,42))}</b> · ${esc(r.type)}${r.creator_name?` · ${esc(r.creator_name)}`:''}`).join('\n'):'No resources yet.';
  return edit(token,chatId,messageId,`<b>TAVO HUB / LATEST</b>\n\n${text}`,{inline_keyboard:[[urlButton('OPEN HUB ↗',origin+'/hub.html')],[button('HOME','adm:home')]]});
}
async function showAuthors(token,chatId,messageId,env){
  const rows=(await env.DB.prepare("SELECT creator_name,COUNT(*) n FROM hub_resources WHERE status='published' AND creator_name!='' GROUP BY creator_name ORDER BY n DESC,creator_name LIMIT 12").all()).results||[];
  const text=rows.length?rows.map(r=>`${r.n} · ${esc(r.creator_name)}`).join('\n'):'No creator data yet.';
  return edit(token,chatId,messageId,`<b>AUTHORS</b>\n\n${text}`,{inline_keyboard:[[button('HOME','adm:home')]]});
}
async function showIssues(token,chatId,messageId,env){
  const one=async(sql)=>Number((await env.DB.prepare(sql).first())?.n||0);
  const [noCreator,noFiles,noMedia,other]=await Promise.all([
    one("SELECT COUNT(*) n FROM hub_resources WHERE status='published' AND trim(creator_name)=''"),
    one("SELECT COUNT(*) n FROM hub_resources r WHERE status='published' AND NOT EXISTS(SELECT 1 FROM hub_resource_files f WHERE f.resource_id=r.id AND f.name NOT LIKE '__extra__%')"),
    one("SELECT COUNT(*) n FROM hub_resources WHERE status='published' AND (media='[]' OR media='' OR media IS NULL)"),
    one("SELECT COUNT(*) n FROM hub_resources WHERE status='published' AND type='other'")
  ]);
  return edit(token,chatId,messageId,`<b>HUB ISSUES</b>\n\nNO CREATOR: ${noCreator}\nNO DOWNLOAD FILE: ${noFiles}\nNO MEDIA: ${noMedia}\nTYPE OTHER: ${other}`,{inline_keyboard:[[button('HOME','adm:home')]]});
}

async function handleAdminMessage(token,message,env,origin){
  const chatId=message.chat?.id,text=clean(message.text||message.caption),uid=String(message.from?.id||'');
  if(uid!==String(env.TELEGRAM_ADMIN_USER_ID||''))return;
  if(text==='/start'||text==='/menu')return send(token,chatId,'<b>ARCHIVE.EXE ADMIN</b>\n\nPrivate control console connected to the site database.',adminMenu());
  const source=forwardedTelegramUrl(message)||extractTelegramUrl(text);
  if(source){
    await send(token,chatId,'ANALYZING TELEGRAM POST…');
    try{const a=await analyzeUrl(source),id=await saveDraft(env,a),row=await getDraft(env,id);return send(token,chatId,draftText(row),draftButtons(id,source))}
    catch(e){return send(token,chatId,`<b>IMPORT FAILED</b>\n\n${esc(e.message||e)}`,{inline_keyboard:[[button('TRY ANOTHER','adm:import'),button('HOME','adm:home')]]})}
  }
  if(text)return send(token,chatId,'Send me a public <b>t.me/channel/post</b> link or forward a post from a public Telegram channel.\n\nFor navigation use the menu below.',adminMenu());
}

async function handleAdminCallback(token,q,env,origin){
  const uid=String(q.from?.id||''),chatId=q.message?.chat?.id,messageId=q.message?.message_id,data=clean(q.data);
  if(uid!==String(env.TELEGRAM_ADMIN_USER_ID||'')){await answerCb(token,q.id,'Access denied');return}
  await answerCb(token,q.id);
  if(data==='noop')return;
  if(data==='adm:home')return edit(token,chatId,messageId,'<b>ARCHIVE.EXE ADMIN</b>\n\nPrivate control console connected to the site database.',adminMenu());
  if(data==='adm:import')return edit(token,chatId,messageId,'<b>IMPORT RESOURCE</b>\n\nSend a public Telegram post link or simply forward a post from a public channel. It will be analyzed and saved as a draft. Nothing is published automatically.',{inline_keyboard:[[button('HOME','adm:home')]]});
  if(data==='adm:drafts')return showDraftList(token,chatId,messageId,env);
  if(data==='adm:suggestions')return showSuggestions(token,chatId,messageId,env);
  if(data==='adm:hub')return showHub(token,chatId,messageId,env,origin);
  if(data==='adm:authors')return showAuthors(token,chatId,messageId,env);
  if(data==='adm:issues')return showIssues(token,chatId,messageId,env);
  if(data==='adm:stats')return edit(token,chatId,messageId,await adminStats(env),{inline_keyboard:[[button('HOME','adm:home')]]});
  if(data.startsWith('draft:view:')){const id=data.slice(11),row=await getDraft(env,id);if(!row)return edit(token,chatId,messageId,'Draft not found.',{inline_keyboard:[[button('DRAFTS','adm:drafts')]]});return edit(token,chatId,messageId,draftText(row),draftButtons(id,row.source_url))}
  if(data.startsWith('draft:reanalyze:')){const id=data.slice(16),row=await getDraft(env,id);if(!row)return;try{const a=await analyzeUrl(row.source_url);await env.DB.prepare("UPDATE telegram_admin_drafts SET payload=?,status='review',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(a),id).run();const fresh=await getDraft(env,id);return edit(token,chatId,messageId,draftText(fresh),draftButtons(id,fresh.source_url))}catch(e){return edit(token,chatId,messageId,`<b>RE-ANALYZE FAILED</b>\n${esc(e.message||e)}`,draftButtons(id,row.source_url))}}
  if(data.startsWith('draft:publish:')){const id=data.slice(14),row=await getDraft(env,id);if(!row)return;try{const out=await publishDraft(env,row);return edit(token,chatId,messageId,`<b>PUBLISHED ✓</b>\n\n${esc(row.analysis?.draft?.title||'Resource')}\nID: ${esc(out.id||'')}`,{inline_keyboard:[[urlButton('OPEN HUB ↗',origin+'/hub.html')],[button('DRAFTS','adm:drafts'),button('HOME','adm:home')]]})}catch(e){return edit(token,chatId,messageId,`<b>PUBLISH FAILED</b>\n\n${esc(e.message||e)}`,draftButtons(id,row.source_url))}}
  if(data.startsWith('draft:delete:')){const id=data.slice(13);await ensureDraftSchema(env);await env.DB.prepare('DELETE FROM telegram_admin_drafts WHERE id=?').bind(id).run();return showDraftList(token,chatId,messageId,env)}
  if(data.startsWith('sug:ignore:')){const id=Number(data.slice(11));await env.DB.prepare("UPDATE hub_suggestions SET status='ignored',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();return showSuggestions(token,chatId,messageId,env)}
  if(data.startsWith('sug:import:')){const sid=Number(data.slice(11)),s=await env.DB.prepare('SELECT id,url FROM hub_suggestions WHERE id=? LIMIT 1').bind(sid).first();if(!s)return showSuggestions(token,chatId,messageId,env);try{const a=await analyzeUrl(s.url),id=await saveDraft(env,a);await env.DB.prepare("UPDATE hub_suggestions SET status='reviewing',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(sid).run();const row=await getDraft(env,id);return edit(token,chatId,messageId,draftText(row),draftButtons(id,row.source_url))}catch(e){return edit(token,chatId,messageId,`<b>SUGGESTION IMPORT FAILED</b>\n\n${esc(e.message||e)}`,{inline_keyboard:[[button('← SUGGESTIONS','adm:suggestions')]]})}}
}

async function publicSearch(env,q,limit=7){
  q='%'+clean(q).replace(/[%_]/g,'')+'%';
  return (await env.DB.prepare("SELECT id,title,type,creator_name,description_short FROM hub_resources WHERE status='published' AND (title LIKE ? OR creator_name LIKE ? OR description_short LIKE ?) ORDER BY updated_at DESC LIMIT ?").bind(q,q,q,limit).all()).results||[];
}
function publicResultsText(rows,title='RESULTS'){
  if(!rows.length)return `<b>${title}</b>\n\nNothing found.`;
  return `<b>${title}</b>\n\n`+rows.map(r=>`• <b>${esc(short(r.title,48))}</b>\n  ${esc(r.type)}${r.creator_name?` · ${esc(r.creator_name)}`:''}`).join('\n\n');
}
function publicResultButtons(rows,origin){
  const keys=rows.slice(0,6).map(r=>[button(short(r.title,42),'pub:res:'+r.id)]);keys.push([urlButton('OPEN TAVO HUB ↗',origin+'/hub.html'),button('HOME','pub:home')]);return{inline_keyboard:keys};
}
async function publicResource(token,chatId,messageId,env,id,origin){
  const r=await env.DB.prepare("SELECT id,title,type,creator_name,creator_link,description_short,source_url FROM hub_resources WHERE id=? AND status='published' LIMIT 1").bind(id).first();
  if(!r)return edit(token,chatId,messageId,'Resource not found.',publicMenu());
  const keys=[];if(r.source_url)keys.push([urlButton('ORIGINAL POST ↗',r.source_url)]);if(r.creator_link)keys.push([urlButton('AUTHOR ↗',r.creator_link)]);keys.push([urlButton('OPEN HUB ↗',origin+'/hub.html'),button('HOME','pub:home')]);
  return edit(token,chatId,messageId,`<b>${esc(r.title)}</b>\n${esc(r.type)}${r.creator_name?` · ${esc(r.creator_name)}`:''}\n\n${esc(short(r.description_short,500))}`,{inline_keyboard:keys});
}
async function handlePublicMessage(token,message,env,origin){
  const chatId=message.chat?.id,text=clean(message.text);
  if(text==='/start'||text==='/menu')return send(token,chatId,'<b>ARCHIVE.EXE</b>\n\nTAVO resources and bot archive.',publicMenu());
  if(text){const rows=await publicSearch(env,text);return send(token,chatId,publicResultsText(rows,`SEARCH: ${esc(short(text,35))}`),publicResultButtons(rows,origin))}
}
async function handlePublicCallback(token,q,env,origin){
  const chatId=q.message?.chat?.id,messageId=q.message?.message_id,data=clean(q.data);await answerCb(token,q.id);
  if(data==='pub:home')return edit(token,chatId,messageId,'<b>ARCHIVE.EXE</b>\n\nTAVO resources and bot archive.',publicMenu());
  if(data==='pub:search')return edit(token,chatId,messageId,'<b>SEARCH</b>\n\nSend the resource name, creator or a keyword.',{inline_keyboard:[[button('HOME','pub:home')]]});
  if(data==='pub:hub')return edit(token,chatId,messageId,'<b>TAVO HUB</b>\n\nOpen the full resource catalog on the site.',{inline_keyboard:[[urlButton('OPEN HUB ↗',origin+'/hub.html')],[button('HOME','pub:home')]]});
  if(data==='pub:latest'){const rows=(await env.DB.prepare("SELECT id,title,type,creator_name,description_short FROM hub_resources WHERE status='published' ORDER BY updated_at DESC LIMIT 7").all()).results||[];return edit(token,chatId,messageId,publicResultsText(rows,'LATEST'),publicResultButtons(rows,origin))}
  if(data==='pub:random'){const r=await env.DB.prepare("SELECT id FROM hub_resources WHERE status='published' ORDER BY RANDOM() LIMIT 1").first();return r?publicResource(token,chatId,messageId,env,r.id,origin):edit(token,chatId,messageId,'No resources yet.',publicMenu())}
  if(data.startsWith('pub:type:')){const type=data.slice(9),rows=(await env.DB.prepare("SELECT id,title,type,creator_name,description_short FROM hub_resources WHERE status='published' AND type=? ORDER BY updated_at DESC LIMIT 7").bind(type).all()).results||[];return edit(token,chatId,messageId,publicResultsText(rows,type.toUpperCase()),publicResultButtons(rows,origin))}
  if(data.startsWith('pub:res:'))return publicResource(token,chatId,messageId,env,data.slice(8),origin);
}

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
  try{
    const secret=await webhookSecret(admin,'admin');
    results.admin=await tg(admin,'setWebhook',{url:origin+'/telegram/admin',secret_token:secret,allowed_updates:['message','callback_query'],drop_pending_updates:false});
    await tg(admin,'setMyCommands',{commands:[{command:'start',description:'Open ARCHIVE.EXE admin menu'},{command:'menu',description:'Open admin menu'}]});
  }catch(e){results.admin_error=e.message||String(e)}
  if(pub){try{
    const secret=await webhookSecret(pub,'public');
    results.public=await tg(pub,'setWebhook',{url:origin+'/telegram/public',secret_token:secret,allowed_updates:['message','callback_query'],drop_pending_updates:false});
    await tg(pub,'setMyCommands',{commands:[{command:'start',description:'Open ARCHIVE.EXE'},{command:'menu',description:'Open main menu'}]});
  }catch(e){results.public_error=e.message||String(e)}}
  return json({ok:!results.admin_error&&!results.public_error,origin,results});
}
export async function telegramWebhookStatus(request,env){
  if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  const out={};
  try{if(env.Node00admin)out.admin=await tg(clean(env.Node00admin),'getWebhookInfo')}catch(e){out.admin_error=e.message||String(e)}
  try{if(env.PUBLICnode00bot)out.public=await tg(clean(env.PUBLICnode00bot),'getWebhookInfo')}catch(e){out.public_error=e.message||String(e)}
  return json({ok:true,webhooks:out});
}
