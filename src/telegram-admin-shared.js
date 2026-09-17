export const clean=v=>String(v??'').trim();
export const esc=s=>clean(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
export const okResponse=()=>new Response(JSON.stringify({ok:true}),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export const button=(text,callback_data)=>({text,callback_data});

async function sha256Hex(value){
  const data=new TextEncoder().encode(value),hash=await crypto.subtle.digest('SHA-256',data);
  return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function webhookSecret(token){return (await sha256Hex(`admin|${token}`)).slice(0,48)}
export async function tg(token,method,payload={}){
  const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const d=await r.json().catch(()=>({ok:false,description:`HTTP_${r.status}`}));
  if(!r.ok||!d.ok)throw new Error(d.description||`TELEGRAM_${method}_FAILED`);
  return d.result;
}
export async function send(token,chatId,text,reply_markup){return tg(token,'sendMessage',{chat_id:chatId,text,parse_mode:'HTML',disable_web_page_preview:true,...(reply_markup?{reply_markup}:{})})}
export async function edit(token,chatId,messageId,text,reply_markup){
  try{return await tg(token,'editMessageText',{chat_id:chatId,message_id:messageId,text,parse_mode:'HTML',disable_web_page_preview:true,...(reply_markup?{reply_markup}:{})})}
  catch{return send(token,chatId,text,reply_markup)}
}
export async function answerCb(token,id,text=''){try{await tg(token,'answerCallbackQuery',{callback_query_id:id,...(text?{text}:{})})}catch{}}

export function adminMenu(){return{inline_keyboard:[
  [button('＋ IMPORT','adm:import'),button('DRAFTS','adm:drafts')],
  [button('SUGGESTIONS','adm:suggestions'),button('HUB','adm:hub')],
  [button('AUTHORS','adm:authors'),button('ISSUES','adm:issues')],
  [button('STATS','adm:stats')]
]}}

export const adminMenuText='<b>ARCHIVE.EXE ADMIN</b>\n\nPrivate control console connected to the site database.';
