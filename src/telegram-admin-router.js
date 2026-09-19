import { tryHandleAdminMenuRequest } from './telegram-admin-menu.js';
import { tryHandleAdminStatsRequest } from './telegram-admin-stats.js';
import { tryHandleAdminReadonlyRequest } from './telegram-admin-readonly.js';
import { handleAdminTelegramFixed } from './telegram-admin-fixed.js';
import { clean, webhookSecret } from './telegram-admin-shared.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

export async function handleAdminTelegramRoute(request,env){
  if(request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  const token=clean(env.Node00admin);if(!token)return json({ok:false,error:'ADMIN_BOT_TOKEN_MISSING'},503);
  if(!clean(env.TELEGRAM_ADMIN_USER_ID))return json({ok:false,error:'ADMIN_USER_ID_MISSING'},503);
  if(request.headers.get('x-telegram-bot-api-secret-token')!==await webhookSecret(token))return json({ok:false,error:'INVALID_WEBHOOK_SECRET'},403);
  const menuResponse=await tryHandleAdminMenuRequest(request,env);
  if(menuResponse)return menuResponse;
  const statsResponse=await tryHandleAdminStatsRequest(request,env);
  if(statsResponse)return statsResponse;
  const readonlyResponse=await tryHandleAdminReadonlyRequest(request,env);
  if(readonlyResponse)return readonlyResponse;
  return handleAdminTelegramFixed(request,env);
}
