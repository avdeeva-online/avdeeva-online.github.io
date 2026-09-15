import { handleAdminTelegram } from './telegram-bots.js';

const clean=v=>String(v??'').trim();

function forwardedMeta(message){
  const o=message?.forward_origin;
  if(o?.type==='channel'&&o.chat?.username&&o.message_id)return{channel:o.chat.username,postId:Number(o.message_id),url:`https://t.me/${o.chat.username}/${o.message_id}`};
  const legacy=message?.forward_from_chat;
  if(legacy?.username&&message?.forward_from_message_id)return{channel:legacy.username,postId:Number(message.forward_from_message_id),url:`https://t.me/${legacy.username}/${message.forward_from_message_id}`};
  const text=clean(message?.text||message?.caption);
  const m=text.match(/https?:\/\/t\.me\/(?:s\/)?([A-Za-z0-9_]+)\/(\d+)/i);
  return m?{channel:m[1],postId:Number(m[2]),url:`https://t.me/${m[1]}/${m[2]}`} : null;
}

function isAttachmentPost(message){
  return Boolean(message?.document?.file_id||message?.audio?.file_id||message?.video?.file_id);
}

async function ensureSessionSchema(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS telegram_admin_import_session(
    admin_user_id TEXT PRIMARY KEY,
    channel TEXT NOT NULL DEFAULT '',
    draft_id TEXT NOT NULL DEFAULT '',
    last_post_id INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

async function richDraft(env,id){
  if(!id)return false;
  const row=await env.DB.prepare("SELECT payload FROM telegram_admin_drafts WHERE id=? AND status='review' LIMIT 1").bind(id).first();
  if(!row?.payload)return false;
  try{
    const a=JSON.parse(row.payload),d=a?.draft||{};
    const text=clean(d.descriptionFull||d.descriptionShort||a?.source?.rawText);
    return text.length>=120||Boolean((a?.media||[]).length);
  }catch{return false}
}

async function prepareSmartMerge(update,env){
  const message=update?.message,uid=String(message?.from?.id||'');
  if(!message||uid!==String(env.TELEGRAM_ADMIN_USER_ID||''))return;
  const meta=forwardedMeta(message);
  if(!meta||!isAttachmentPost(message))return;
  try{
    await ensureSessionSchema(env);
    const session=await env.DB.prepare("SELECT * FROM telegram_admin_import_session WHERE admin_user_id=? AND updated_at>=datetime('now','-20 minutes') LIMIT 1").bind(uid).first();
    if(!session?.draft_id||clean(session.channel).toLowerCase()!==clean(meta.channel).toLowerCase())return;
    if(!(await richDraft(env,session.draft_id)))return;
    // The existing importer intentionally accepts nearby posts (delta <= 4).
    // For a file-only continuation from the same channel, make the active
    // description draft eligible even when the original channel post IDs are far apart.
    await env.DB.prepare("UPDATE telegram_admin_import_session SET last_post_id=?,updated_at=CURRENT_TIMESTAMP WHERE admin_user_id=?").bind(Math.max(0,Number(meta.postId)-1),uid).run();
  }catch(e){console.warn('telegram smart merge preflight failed',e)}
}

export async function handleAdminTelegramSmart(request,env){
  let update=null;
  try{update=await request.clone().json()}catch{}
  if(update)await prepareSmartMerge(update,env);
  return handleAdminTelegram(request,env);
}
