import { requireD1Schema } from './d1-schema.js';
import { button, clean, edit, esc } from './telegram-admin-shared.js';

const short=(s,n=420)=>{s=clean(s).replace(/\s+/g,' ');return s.length>n?s.slice(0,n-1)+'…':s};
const ensureSuggestionsSchema=env=>requireD1Schema(env,'telegram-suggestions',`SELECT COUNT(*) FROM hub_suggestions`);

export async function showAdminSuggestions(token,chatId,messageId,env){
  await ensureSuggestionsSchema(env);
  const rows=(await env.DB.prepare("SELECT id,url,note,created_at FROM hub_suggestions WHERE status='new' ORDER BY created_at DESC LIMIT 6").all()).results||[];
  if(!rows.length)return edit(token,chatId,messageId,'<b>COMMUNITY SUGGESTIONS</b>\n\nInbox is empty.',{inline_keyboard:[[button('HOME','adm:home')]]});
  const keys=rows.map(r=>[button('IMPORT #'+r.id,'sug:import:'+r.id),button('IGNORE','sug:ignore:'+r.id)]);
  keys.push([button('HOME','adm:home')]);
  const lines=rows.map(r=>`#${r.id} · ${esc(short(r.url,70))}${r.note?`\n${esc(short(r.note,80))}`:''}`).join('\n\n');
  return edit(token,chatId,messageId,`<b>COMMUNITY SUGGESTIONS</b>\n\n${lines}`,{inline_keyboard:keys});
}
