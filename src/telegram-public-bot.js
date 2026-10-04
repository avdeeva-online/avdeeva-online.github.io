const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
import { sendCardFile, sendLorebookFiles } from './telegram-files.js';
import { FACETS, bots, botsPage, editCard, filterItems, filterMenu, listContext, loadCatalog, plural, searchItems, sendCard, sendDescription, valuesPage } from './telegram-catalog.js';
import { getHubResourcePublic } from './hub-public-media.js';
const clean=v=>String(v??'').trim();
const esc=s=>clean(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const short=(s,n=320)=>{s=clean(s).replace(/\s+/g,' ');return s.length>n?s.slice(0,n-1)+'…':s};
async function sha256Hex(value){const data=new TextEncoder().encode(value),hash=await crypto.subtle.digest('SHA-256',data);return[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function webhookSecret(token){return(await sha256Hex(`public|${token}`)).slice(0,48)}
async function tg(token,method,payload={}){const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}),d=await r.json().catch(()=>({ok:false,description:`HTTP_${r.status}`}));if(!r.ok||!d.ok)throw new Error(d.description||`TELEGRAM_${method}_FAILED`);return d.result}
const cb=(text,callback_data)=>({text,callback_data});
const url=(text,u)=>({text,url:u});
const keyboard=rows=>({inline_keyboard:rows.filter(r=>r?.length)});
async function send(token,chatId,text,reply_markup){return tg(token,'sendMessage',{chat_id:chatId,text,parse_mode:'HTML',disable_web_page_preview:true,...(reply_markup?{reply_markup}:{})})}
async function edit(token,chatId,messageId,text,reply_markup){try{return await tg(token,'editMessageText',{chat_id:chatId,message_id:messageId,text,parse_mode:'HTML',disable_web_page_preview:true,...(reply_markup?{reply_markup}:{})})}catch(e){if(/message is not modified/i.test(String(e?.message||e)))return null;return send(token,chatId,text,reply_markup)}}
async function answer(token,id,text=''){try{await tg(token,'answerCallbackQuery',{callback_query_id:id,...(text?{text}:{})})}catch{}}

// ---- home ----
// Counts are a nice-to-have: if the catalog or HUB cannot be read, the menu still opens.
async function homeView(env,origin,catalog){
  const [items,hub]=await Promise.all([loadCatalog(catalog).catch(()=>null),resourceCount(env).catch(()=>null)]);
  const text=`<b>ARCHIVE.EXE</b>\n\nКаталог ботов для SillyTavern и Tavo — карточки PNG/JSON и лорбуки — и ресурсы TAVO HUB.\n\nВыбери раздел или просто напиши в чат имя бота, автора или вселенную.`;
  return{text,keyboard:keyboard([[cb(`🤖 Боты${items?` · ${items.length}`:''}`,'p:fm'),cb(`📚 TAVO HUB${hub!=null?` · ${hub}`:''}`,'p:hubm')],[cb('🎲 Случайный бот','p:random'),cb('🔎 Поиск','p:search')],[url('🌐 Открыть сайт ↗',origin+'/')]])};
}
const MENU=cb('← Меню','p:home');

// ---- TAVO HUB ----
const TYPE_LABELS={preset:'Пресеты',theme:'Темы',plugin:'Плагины',guide:'Гайды',tool:'Инструменты',link:'Ссылки',script:'Скрипты',extension:'Расширения'};
const TYPE_ONE={preset:'пресет',theme:'тема',plugin:'плагин',guide:'гайд',tool:'инструмент',link:'ссылка',script:'скрипт',extension:'расширение'};
const typeLabel=t=>TYPE_LABELS[clean(t).toLowerCase()]||(clean(t)?clean(t)[0].toUpperCase()+clean(t).slice(1):'Другое');
const typeOne=t=>TYPE_ONE[clean(t).toLowerCase()]||clean(t).toLowerCase()||'ресурс';
const resources=n=>plural(n,['ресурс','ресурса','ресурсов']);
async function resourceCount(env,type=''){const q=type?"SELECT COUNT(*) n FROM hub_resources WHERE status='published' AND type=?":"SELECT COUNT(*) n FROM hub_resources WHERE status='published'";return Number((await(type?env.DB.prepare(q).bind(type).first():env.DB.prepare(q).first()))?.n||0)}
async function resourceRows(env,{type='',page=0,limit=8}={}){const offset=Math.max(0,page)*limit;if(type)return(await env.DB.prepare("SELECT id,title,type,creator_name,description_short,updated_at FROM hub_resources WHERE status='published' AND type=? ORDER BY updated_at DESC LIMIT ? OFFSET ?").bind(type,limit,offset).all()).results||[];return(await env.DB.prepare("SELECT id,title,type,creator_name,description_short,updated_at FROM hub_resources WHERE status='published' ORDER BY updated_at DESC LIMIT ? OFFSET ?").bind(limit,offset).all()).results||[]}
async function hubMenu(token,chatId,messageId,env){
  const [total,types]=await Promise.all([resourceCount(env),env.DB.prepare("SELECT type,COUNT(*) n FROM hub_resources WHERE status='published' GROUP BY type ORDER BY n DESC").all().then(r=>r.results||[]).catch(()=>[])]);
  const typeButtons=types.filter(t=>clean(t.type)).map(t=>cb(`${typeLabel(t.type)} · ${t.n}`,`p:type:${clean(t.type).slice(0,40)}:0`)),rows=[[cb(`Все ресурсы · ${total}`,'p:hub:0'),cb('🆕 Новое','p:latest:0')]];
  for(let i=0;i<typeButtons.length;i+=2)rows.push(typeButtons.slice(i,i+2));
  rows.push([MENU]);
  return edit(token,chatId,messageId,`<b>📚 TAVO HUB</b> · ${resources(total)}\n\nПресеты, темы, плагины и гайды для SillyTavern и Tavo. Выбери раздел.`,keyboard(rows));
}
async function showResources(token,chatId,messageId,env,origin,{type='',page=0,title='📚 Все ресурсы',key='p:hub'}={}){
  const total=await resourceCount(env,type),pages=Math.max(1,Math.ceil(total/8)),p=Math.max(0,Math.min(page,pages-1)),rows=await resourceRows(env,{type,page:p});
  const kb=rows.map(r=>[cb(type?short(r.title,48):`${short(r.title,34)} · ${typeOne(r.type)}`,`p:r:${r.id}`)]);
  if(pages>1)kb.push([cb(p>0?'‹':'·',p>0?`${key}:${p-1}`:'p:noop'),cb(`${p+1} / ${pages}`,'p:noop'),cb(p+1<pages?'›':'·',p+1<pages?`${key}:${p+1}`:'p:noop')]);
  kb.push([cb('← HUB','p:hubm'),MENU]);
  return edit(token,chatId,messageId,`<b>${esc(title)}</b> · ${resources(total)}\n\n${total?'Нажми на ресурс — пришлю карточку со ссылками.':'Здесь пока пусто.'}`,keyboard(kb));
}
async function getResource(env,id){return env.DB.prepare("SELECT * FROM hub_resources WHERE id=? AND status='published' LIMIT 1").bind(id).first()}
async function getResourceFiles(env,id){return(await env.DB.prepare("SELECT id,resource_id,name,mime,size,is_primary FROM hub_resource_files WHERE resource_id=? ORDER BY is_primary DESC,created_at ASC").bind(id).all()).results||[]}
// Cover candidates exactly as the HUB page picks them (selected cover first), made absolute for Telegram.
async function resourceCovers(env,id,origin){try{const d=await(await getHubResourcePublic(env,id)).json();const r=d?.resource||{};return[r.cover_url,...(Array.isArray(r.cover_fallback_urls)?r.cover_fallback_urls:[])].map(clean).filter(Boolean).slice(0,3).map(u=>u.startsWith('/')?origin+u:u).filter(u=>/^https:\/\//i.test(u))}catch{return[]}}
async function showResource(token,chatId,messageId,env,id,origin){
  const r=await getResource(env,id);if(!r)return send(token,chatId,'Ресурс не найден — возможно, его убрали из HUB.',keyboard([[cb('← HUB','p:hubm'),MENU]]));
  const files=await getResourceFiles(env,id),extras=files.filter(f=>clean(f.name).startsWith('__extra__')),rows=[];
  if(r.source_url)rows.push([url('📥 Взять у автора ↗',r.source_url)]);
  let extraLinks=[];try{extraLinks=JSON.parse(r.extra_links||'[]')}catch{}
  const links=(Array.isArray(extraLinks)?extraLinks:[]).filter(x=>/^https?:\/\//i.test(x?.url||'')).slice(0,4).map(x=>url(short(String(x.label||'Ссылка'),24)+' ↗',x.url));
  for(const f of extras.slice(0,4))links.push(url('🖼 '+short(clean(f.name).replace(/^__extra__/,''),22),`${origin}/api/hub-resources/${encodeURIComponent(id)}/files/${encodeURIComponent(f.id)}?view=1`));
  for(let i=0;i<links.length;i+=2)rows.push(links.slice(i,i+2));
  rows.push([url('🌐 Открыть в HUB ↗',origin+'/hub.html'),cb('← HUB','p:hubm')]);
  const author=r.creator_name?` · от ${/^https?:\/\//i.test(r.creator_link||'')?`<a href="${esc(r.creator_link)}">${esc(r.creator_name)}</a>`:esc(r.creator_name)}`:'';
  const head=`<b>${esc(r.title||'Без названия')}</b>\n${esc(typeOne(r.type))}${author}`,room=1000-head.length;
  const caption=`${head}${clean(r.description_short||r.description_full)?`\n\n<i>${esc(short(r.description_short||r.description_full,Math.max(60,room-20)))}</i>`:''}`,markup=keyboard(rows);
  for(const photo of await resourceCovers(env,id,origin)){try{return await tg(token,'sendPhoto',{chat_id:chatId,photo,caption,parse_mode:'HTML',reply_markup:markup})}catch{}}
  return send(token,chatId,caption,markup);
}

async function sendResourceFile(token,chatId,env,fileId,origin){const f=await env.DB.prepare("SELECT f.id,f.resource_id,f.name,r.source_url FROM hub_resource_files f LEFT JOIN hub_resources r ON r.id=f.resource_id WHERE f.id=? LIMIT 1").bind(fileId).first();if(!f)return send(token,chatId,'Файл не найден.');/* Old buttons in chats: downloads now live in the author's post. */if(!clean(f.name).startsWith('__extra__'))return send(token,chatId,f.source_url?`Файлы теперь берутся из поста автора:\n${esc(f.source_url)}`:'Файл больше не раздаётся — смотри пост автора.');const doc=`${origin}/api/hub-resources/${encodeURIComponent(f.resource_id)}/files/${encodeURIComponent(f.id)}`;try{return await tg(token,'sendDocument',{chat_id:chatId,document:doc,caption:short(clean(f.name).replace(/^__extra__/,''),900)})}catch{return send(token,chatId,`Не получилось отправить файл напрямую.\n${esc(doc)}`)}}
/* Cards are built, checked and uploaded by the bot itself (telegram-files.js). */
async function sendCharacterFile(token,chatId,env,uuid,kind,origin){return sendCardFile(token,chatId,env,origin,uuid,kind,keyboard([[cb(kind==='png'?'↻ Ещё раз PNG':'↻ Ещё раз JSON',`p:${kind==='png'?'cp':'cj'}:${uuid}`)]]))}

// ---- search: bots from the site's catalog (name, author, universe, tag) + HUB resources ----
const SEARCH_HINT='Напиши в чат имя бота, автора, вселенную или тег — например, <i>Marvel</i> или <i>Vance</i>.';
async function showSearch(token,chatId,env,origin,q,catalog){
  q=short(q,60);
  const items=await loadCatalog(catalog).catch(()=>[]),found=searchItems(items,q),like='%'+clean(q).replace(/[%_]/g,'')+'%';
  let res=[];if(clean(q).length>=2)try{res=(await env.DB.prepare("SELECT id,title,type FROM hub_resources WHERE status='published' AND (title LIKE ? OR creator_name LIKE ? OR description_short LIKE ?) ORDER BY updated_at DESC LIMIT 5").bind(like,like,like).all()).results||[]}catch{}
  if(!found.length&&!res.length)return send(token,chatId,`<b>🔎 «${esc(q)}»</b>\n\nНичего не нашлось. ${SEARCH_HINT}\n\nИли открой фильтры — там все авторы и вселенные списком.`,keyboard([[cb('🤖 Фильтры','p:fm'),MENU]]));
  const rows=[...found.slice(0,8).map(c=>[cb(`🤖 ${short(c.name,30)}${c.author?` · ${short(c.author,14)}`:''}`,`p:c:${c.uuid}`)]),...res.map(r=>[cb(`📚 ${short(r.title,30)} · ${typeOne(r.type)}`,`p:r:${r.id}`)])];
  rows.push([cb('🤖 Фильтры','p:fm'),MENU]);
  const more=found.length>8?`\nПоказаны первые 8 — уточни запрос или открой фильтры.`:'';
  return send(token,chatId,`<b>🔎 «${esc(q)}»</b>\n\nНашлось: ${[found.length?bots(found.length):'',res.length?resources(res.length):''].filter(Boolean).join(' · ')}.${more}`,keyboard(rows));
}

async function sendRandom(token,chatId,env,origin,catalog){const items=await loadCatalog(catalog);if(!items.length)return send(token,chatId,'Каталог пока пуст.',keyboard([[MENU]]));const i=Math.floor(Math.random()*items.length);return sendCard(token,chatId,env,origin,items[i],{f:'-',h:'-',i,total:items.length})}

// Commands work both from the menu button (/bots …) and typed; any other text is a search.
async function handleMessage(token,message,env,origin,catalog){
  const chatId=message.chat?.id,text=clean(message.text);if(!chatId||!text)return;
  const cmd=text.match(/^\/([a-z]+)(?:@[A-Za-z0-9_]+)?(?:\s+([\s\S]*))?$/i),name=cmd?.[1]?.toLowerCase(),arg=clean(cmd?.[2]);
  if(name==='start'||name==='menu'){const v=await homeView(env,origin,catalog);return send(token,chatId,v.text,v.keyboard)}
  if(name==='bots'){const v=filterMenu(await loadCatalog(catalog));return send(token,chatId,v.text,v.keyboard)}
  if(name==='hub')return hubMenu(token,chatId,null,env);
  if(name==='random')return sendRandom(token,chatId,env,origin,catalog);
  if(name==='search')return arg?showSearch(token,chatId,env,origin,arg,catalog):send(token,chatId,`<b>🔎 Поиск</b>\n\n${SEARCH_HINT}`,keyboard([[MENU]]));
  if(cmd)return send(token,chatId,'Не знаю такой команды. Вот меню:',(await homeView(env,origin,catalog)).keyboard);
  return showSearch(token,chatId,env,origin,text,catalog);
}
/* Without the site pipeline (tests, old callers) the catalog falls back to the published rows. */
function dbCatalog(env){return async()=>{const rows=(await env.DB.prepare("SELECT c.janitor_uuid,c.name,c.author,c.author_url,c.universe,c.pov,c.short_description,c.image_url,c.janitor_url,(SELECT COUNT(*) FROM character_lorebooks cl WHERE cl.character_uuid=c.janitor_uuid) AS lorebook_count FROM characters c WHERE c.status='published' ORDER BY c.updated_at DESC").all()).results||[];return Response.json({ok:true,characters:rows.map(r=>({janitorUuid:r.janitor_uuid,nameEn:r.name,author:r.author,authorUrl:r.author_url,universe:r.universe,universes:r.universe?[r.universe]:[],settings:[],pov:r.pov,tags:[],short:r.short_description,image:r.image_url,url:r.janitor_url,lorebookCount:r.lorebook_count}))})}}
async function handleCatalogCallback(token,chatId,messageId,env,origin,data,catalog){
  const items=await loadCatalog(catalog),show=v=>edit(token,chatId,messageId,v.text,v.keyboard);
  if(data==='p:fm')return show(filterMenu(items));
  let m=data.match(/^p:chars:(\d+)$/);if(m)return show(botsPage(items,{title:'🤖 Все боты',page:Number(m[1]),key:'p:chars'}));
  m=data.match(/^p:fl:([a-z]):(\d+)$/);if(m&&FACETS[m[1]])return show(valuesPage(items,m[1],Number(m[2])));
  m=data.match(/^p:fv:([a-z]):([0-9a-z]+):(\d+)$/);if(m&&FACETS[m[1]]){const f=m[1],x=filterItems(items,f,m[2]);return show(botsPage(x.items,{title:`${FACETS[f].title} ${esc(short(x.value||'—',40))}`,page:Number(m[3]),key:`p:fv:${f}:${m[2]}`,hideAuthor:f==='a',ctx:[f,m[2]],back:cb('← '+FACETS[f].menu.replace(/^\S+\s/,''),`p:fl:${f}:0`)}))}
  const gone=()=>send(token,chatId,'Бот не найден — возможно, его убрали из каталога.',keyboard([[cb('🤖 Фильтры','p:fm'),MENU]]));
  // p:k — open a card from a list (new message); p:n — ‹ › inside a card (the same message is replaced).
  m=data.match(/^p:([kn]):([a-z-]):([0-9a-z-]+):(\d+)$/);if(m){const list=listContext(items,m[2],m[3]).items;if(!list.length)return gone();const i=Math.min(Number(m[4]),list.length-1),nav={f:m[2],h:m[3],i,total:list.length};return m[1]==='k'?sendCard(token,chatId,env,origin,list[i],nav):editCard(token,chatId,messageId,env,origin,list[i],nav)}
  m=data.match(/^p:(c|d):([0-9a-f-]{36})$/i);if(m){const i=items.findIndex(x=>x.uuid===m[2].toLowerCase());if(i<0)return gone();return m[1]==='c'?sendCard(token,chatId,env,origin,items[i],{f:'-',h:'-',i,total:items.length}):sendDescription(token,chatId,env,items[i])}
  return null;
}
async function handleCallback(token,q,env,origin,catalog=dbCatalog(env)){
  const chatId=q.message?.chat?.id,messageId=q.message?.message_id,data=clean(q.data);await answer(token,q.id);if(!chatId||data==='p:noop')return;
  if(/^p:(fm|chars:|fl:|fv:|c:|d:|k:|n:)/.test(data))return handleCatalogCallback(token,chatId,messageId,env,origin,data,catalog);
  if(data==='p:home'){const v=await homeView(env,origin,catalog);return edit(token,chatId,messageId,v.text,v.keyboard)}
  if(data==='p:search')return edit(token,chatId,messageId,`<b>🔎 Поиск</b>\n\n${SEARCH_HINT}`,keyboard([[cb('🤖 Фильтры','p:fm'),MENU]]));
  if(data==='p:random')return sendRandom(token,chatId,env,origin,catalog);
  if(data==='p:hubm')return hubMenu(token,chatId,messageId,env);
  let m=data.match(/^p:hub:(\d+)$/);if(m)return showResources(token,chatId,messageId,env,origin,{page:Number(m[1]),title:'📚 Все ресурсы',key:'p:hub'});
  m=data.match(/^p:latest:(\d+)$/);if(m)return showResources(token,chatId,messageId,env,origin,{page:Number(m[1]),title:'🆕 Новое в HUB',key:'p:latest'});
  m=data.match(/^p:type:([^:]+):(\d+)$/);if(m)return showResources(token,chatId,messageId,env,origin,{type:m[1],page:Number(m[2]),title:`📚 ${typeLabel(m[1])}`,key:`p:type:${m[1]}`});
  if(data.startsWith('p:r:'))return showResource(token,chatId,messageId,env,data.slice(4),origin);
  if(data.startsWith('p:f:'))return sendResourceFile(token,chatId,env,data.slice(4),origin);
  if(data.startsWith('p:cp:'))return sendCharacterFile(token,chatId,env,data.slice(5),'png',origin);
  if(data.startsWith('p:cj:'))return sendCharacterFile(token,chatId,env,data.slice(5),'json',origin);
  if(/^p:lb:[0-9a-f-]{36}$/i.test(data))return sendLorebookFiles(token,chatId,env,data.slice(5).toLowerCase());
}

export async function handlePublicTelegramFull(request,env,options={}){if(request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);const token=clean(env.PUBLICnode00bot);if(!token)return json({ok:false,error:'PUBLIC_BOT_TOKEN_MISSING'},503);const expected=await webhookSecret(token);if(request.headers.get('x-telegram-bot-api-secret-token')!==expected)return json({ok:false,error:'INVALID_WEBHOOK_SECRET'},403);let update={};try{update=await request.json()}catch{return json({ok:false,error:'INVALID_JSON'},400)}const origin=new URL(request.url).origin;try{if(update.callback_query)await handleCallback(token,update.callback_query,env,origin,options.catalog||dbCatalog(env));else if(update.message)await handleMessage(token,update.message,env,origin,options.catalog||dbCatalog(env))}catch(e){console.error('public telegram full bot error',e);try{const chatId=update.message?.chat?.id||update.callback_query?.message?.chat?.id;if(chatId)await send(token,chatId,'Что-то пошло не так — попробуй ещё раз через минуту.',keyboard([[MENU]]))}catch{}}return json({ok:true})}
