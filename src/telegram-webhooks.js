const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=v=>String(v??'').trim();

async function sha256Hex(value){
  const data=new TextEncoder().encode(value),hash=await crypto.subtle.digest('SHA-256',data);
  return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function webhookSecret(token,kind){return (await sha256Hex(`${kind}|${token}`)).slice(0,48)}
async function tg(token,method,payload={}){
  if(!token)throw new Error('BOT_TOKEN_MISSING');
  const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const d=await r.json().catch(()=>({ok:false,description:`HTTP_${r.status}`}));
  if(!r.ok||!d.ok)throw new Error(d.description||`TELEGRAM_${method}_FAILED`);
  return d.result;
}

// The command menu of the public bot (Node_00). /start stays a hidden entry point that Telegram itself sends.
export const PUBLIC_COMMANDS=[
  {command:'menu',description:'Главное меню'},
  {command:'site',description:'Сайт ARCHIVE.EXE'},
  {command:'bots',description:'Боты: фильтры по автору, вселенной, сеттингу'},
  {command:'new',description:'Новые боты'},
  {command:'random',description:'Случайный бот'},
  {command:'hub',description:'TAVO HUB: пресеты, темы, гайды'},
  {command:'plugins',description:'Плагины'},
  {command:'suggest',description:'Предложить ресурс или импортировать бота'},
  {command:'search',description:'Поиск: /search Marvel'},
  {command:'help',description:'Что умеет бот'}
];
export async function setupTelegramWebhooks(request,env){
  if(request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  const origin=new URL(request.url).origin,admin=clean(env.Node00admin),pub=clean(env.PUBLICnode00bot),results={};
  if(!admin||!clean(env.TELEGRAM_ADMIN_USER_ID))return json({ok:false,error:'ADMIN_TELEGRAM_SECRETS_MISSING'},503);
  try{const secret=await webhookSecret(admin,'admin');results.admin=await tg(admin,'setWebhook',{url:origin+'/telegram/admin',secret_token:secret,max_connections:1,allowed_updates:['message','callback_query'],drop_pending_updates:false});await tg(admin,'setMyCommands',{commands:[{command:'start',description:'Open ARCHIVE.EXE admin menu'},{command:'menu',description:'Open admin menu'}]})}catch(e){results.admin_error=e.message||String(e)}
  if(pub){try{const secret=await webhookSecret(pub,'public');results.public=await tg(pub,'setWebhook',{url:origin+'/telegram/public',secret_token:secret,allowed_updates:['message','callback_query'],drop_pending_updates:false});await tg(pub,'setMyCommands',{commands:PUBLIC_COMMANDS});
    /* Name and description shown in Telegram; failures here never block the webhook itself. */
    for(const [method,payload] of [['setMyName',{name:'Node_00'}],['setMyShortDescription',{short_description:'Боты для SillyTavern и Tavo: карточки PNG/JSON, лорбуки и ресурсы TAVO HUB.'}],['setMyDescription',{description:'Node_00 — бот сайта ARCHIVE.EXE.\n\n🤖 Каталог ботов с фильтрами по автору, вселенной и сеттингу\n⬇ Карточки PNG/JSON и лорбуки файлами\n📚 TAVO HUB: пресеты, темы, плагины, гайды\n📥 Предложить ресурс или импортировать бота\n\nНажми «Старт» или просто напиши имя бота.'}]])try{await tg(pub,method,payload)}catch(e){results[`public_${method}_error`]=e.message||String(e)}}catch(e){results.public_error=e.message||String(e)}}
  const ok=!results.admin_error&&!results.public_error;
  return json({ok,origin,results},ok?200:502);
}

export async function telegramWebhookStatus(request,env){
  if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  const out={},admin=clean(env.Node00admin),pub=clean(env.PUBLICnode00bot);if(!admin)out.admin_error='ADMIN_BOT_TOKEN_MISSING';else try{out.admin=await tg(admin,'getWebhookInfo')}catch(e){out.admin_error=e.message||String(e)}try{if(pub)out.public=await tg(pub,'getWebhookInfo')}catch(e){out.public_error=e.message||String(e)}const ok=!out.admin_error&&!out.public_error;return json({ok,webhooks:out},ok?200:502);
}
