import { adminMenu, adminMenuText, answerCb, clean, edit, esc, okResponse, send, webhookSecret } from './telegram-admin-shared.js';

export async function tryHandleAdminMenuRequest(request,env){
  if(request.method!=='POST')return null;
  const token=clean(env.Node00admin);if(!token)return null;
  if(request.headers.get('x-telegram-bot-api-secret-token')!==await webhookSecret(token))return null;
  let update={};try{update=await request.clone().json()}catch{return null}
  const adminId=String(env.TELEGRAM_ADMIN_USER_ID||'');
  try{
    if(update.callback_query){
      const q=update.callback_query,data=clean(q.data),uid=String(q.from?.id||'');
      if(data!=='adm:home'&&data!=='noop')return null;
      if(uid!==adminId){await answerCb(token,q.id,'Access denied');return okResponse()}
      await answerCb(token,q.id);
      if(data==='noop')return okResponse();
      await edit(token,q.message?.chat?.id,q.message?.message_id,adminMenuText,adminMenu());
      return okResponse();
    }
    const message=update.message,text=clean(message?.text||message?.caption),uid=String(message?.from?.id||'');
    if(text!=='/start'&&text!=='/menu')return null;
    if(uid!==adminId)return okResponse();
    await send(token,message?.chat?.id,adminMenuText,adminMenu());
    return okResponse();
  }catch(e){
    console.error('admin telegram menu error',e);
    try{const chatId=update.message?.chat?.id||update.callback_query?.message?.chat?.id;if(chatId)await send(token,chatId,`<b>ADMIN BOT ERROR</b>\n${esc(e?.message||e)}`,adminMenu())}catch{}
    return okResponse();
  }
}
