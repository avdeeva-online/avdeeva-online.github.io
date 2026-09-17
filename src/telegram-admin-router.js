import { tryHandleAdminMenuRequest } from './telegram-admin-menu.js';
import { tryHandleAdminStatsRequest } from './telegram-admin-stats.js';
import { handleAdminTelegramFixed } from './telegram-admin-fixed.js';

export async function handleAdminTelegramRoute(request,env){
  const menuResponse=await tryHandleAdminMenuRequest(request,env);
  if(menuResponse)return menuResponse;
  const statsResponse=await tryHandleAdminStatsRequest(request,env);
  if(statsResponse)return statsResponse;
  return handleAdminTelegramFixed(request,env);
}
