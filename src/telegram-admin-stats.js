const clean=v=>String(v??'').trim();
const esc=s=>clean(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const okResponse=()=>new Response(JSON.stringify({ok:true}),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const button=(text,callback_data)=>({text,callback_data});

async function sha256Hex(value){
  const data=new TextEncoder().encode(value),hash=await crypto.subtle.digest('SHA-256',data);
  return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function webhookSecret(token){return (await sha256Hex(`admin|${token}`)).slice(0,48)}
async function tg(token,method,payload={}){
  const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const d=await r.json().catch(()=>({ok:false,description:`HTTP_${r.status}`}));
  if(!r.ok||!d.ok)throw new Error(d.description||`TELEGRAM_${method}_FAILED`);
  return d.result;
}
async function send(token,chatId,text,reply_markup){return tg(token,'sendMessage',{chat_id:chatId,text,parse_mode:'HTML',disable_web_page_preview:true,...(reply_markup?{reply_markup}:{})})}
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

async function adminStats(env){
  const one=async sql=>{try{return Number((await env.DB.prepare(sql).first())?.n||0)}catch{return 0}};
  const [resources,drafts,suggestions,characters,files]=await Promise.all([
    one("SELECT COUNT(*) n FROM hub_resources WHERE status='published'"),
    one("SELECT COUNT(*) n FROM telegram_admin_drafts WHERE status='review'"),
    one("SELECT COUNT(*) n FROM hub_suggestions WHERE status='new'"),
    one('SELECT COUNT(*) n FROM characters'),
    one('SELECT COUNT(*) n FROM hub_resource_files')
  ]);
  return `<b>ARCHIVE.EXE / STATS</b>\n\nHUB RESOURCES: ${resources}\nDRAFTS: ${drafts}\nNEW SUGGESTIONS: ${suggestions}\nBOT CARDS: ${characters}\nHUB FILES: ${files}`;
}

export async function tryHandleAdminStatsRequest(request,env){
  if(request.method!=='POST')return null;
  const token=clean(env.Node00admin);if(!token)return null;
  if(request.headers.get('x-telegram-bot-api-secret-token')!==await webhookSecret(token))return null;
  let update={};try{update=await request.clone().json()}catch{return null}
  const q=update.callback_query,data=clean(q?.data);
  if(!q||data!=='adm:stats')return null;
  if(String(q.from?.id||'')!==String(env.TELEGRAM_ADMIN_USER_ID||'')){await answerCb(token,q.id,'Access denied');return okResponse()}
  await answerCb(token,q.id);
  try{
    await edit(token,q.message?.chat?.id,q.message?.message_id,await adminStats(env),{inline_keyboard:[[button('HOME','adm:home')]]});
  }catch(e){
    console.error('admin telegram error',e);
    try{const chatId=q.message?.chat?.id;if(chatId)await send(token,chatId,`<b>ADMIN BOT ERROR</b>\n${esc(e.message||e)}`,adminMenu())}catch{}
  }
  return okResponse();
}
