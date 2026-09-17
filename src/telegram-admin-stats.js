import { adminMenu, answerCb, button, clean, edit, esc, okResponse, send, webhookSecret } from './telegram-admin-shared.js';

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
