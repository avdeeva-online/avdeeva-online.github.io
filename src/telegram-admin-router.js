import { handleAdminTelegramFixed } from './telegram-admin-fixed.js';

export function handleAdminTelegramRoute(request,env){
  return handleAdminTelegramFixed(request,env);
}
