import { tryHandleAdminMenuRequest } from './telegram-admin-menu.js';
import { handleAdminTelegramFixed } from './telegram-admin-fixed.js';

export async function handleAdminTelegramRoute(request,env){
  const menuResponse=await tryHandleAdminMenuRequest(request,env);
  if(menuResponse)return menuResponse;
  return handleAdminTelegramFixed(request,env);
}
