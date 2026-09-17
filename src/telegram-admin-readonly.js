import { adminMenu, answerCb, button, clean, edit, esc, okResponse, send, webhookSecret } from './telegram-admin-shared.js';

const short=(s,n=420)=>{s=clean(s).replace(/\s+/g,' ');return s.length>n?s.slice(0,n-1)+'…':s};
const urlButton=(text,url)=>({text,url});

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
  const one=async sql=>Number((await env.DB.prepare(sql).first())?.n||0);
  const [noCreator,noFiles,noMedia,other]=await Promise.all([
    one("SELECT COUNT(*) n FROM hub_resources WHERE status='published' AND trim(creator_name)=''"),
    one(`SELECT COUNT(*) n FROM hub_resources r WHERE r.status='published' AND NOT EXISTS(
      SELECT 1 FROM hub_resource_files f
      WHERE f.resource_id=r.id
        AND f.name NOT LIKE '__extra__%'
        AND NOT EXISTS(SELECT 1 FROM hub_resource_publish_files sf WHERE sf.file_id=f.id)
    )`),
    one("SELECT COUNT(*) n FROM hub_resources WHERE status='published' AND (media='[]' OR media='' OR media IS NULL)"),
    one("SELECT COUNT(*) n FROM hub_resources WHERE status='published' AND type='other'")
  ]);
  return edit(token,chatId,messageId,`<b>HUB ISSUES</b>\n\nNO CREATOR: ${noCreator}\nNO DOWNLOAD FILE: ${noFiles}\nNO MEDIA: ${noMedia}\nTYPE OTHER: ${other}`,{inline_keyboard:[[button('HOME','adm:home')]]});
}

export async function tryHandleAdminReadonlyRequest(request,env){
  if(request.method!=='POST')return null;
  const token=clean(env.Node00admin);if(!token)return null;
  if(request.headers.get('x-telegram-bot-api-secret-token')!==await webhookSecret(token))return null;
  let update={};try{update=await request.clone().json()}catch{return null}
  const q=update.callback_query,data=clean(q?.data);
  if(!q||!['adm:hub','adm:authors','adm:issues'].includes(data))return null;
  if(String(q.from?.id||'')!==String(env.TELEGRAM_ADMIN_USER_ID||'')){await answerCb(token,q.id,'Access denied');return okResponse()}
  await answerCb(token,q.id);
  try{
    if(data==='adm:hub')await showHub(token,q.message?.chat?.id,q.message?.message_id,env,new URL(request.url).origin);
    else if(data==='adm:authors')await showAuthors(token,q.message?.chat?.id,q.message?.message_id,env);
    else await showIssues(token,q.message?.chat?.id,q.message?.message_id,env);
  }catch(e){
    console.error('admin telegram error',e);
    try{const chatId=q.message?.chat?.id;if(chatId)await send(token,chatId,`<b>ADMIN BOT ERROR</b>\n${esc(e.message||e)}`,adminMenu())}catch{}
  }
  return okResponse();
}
