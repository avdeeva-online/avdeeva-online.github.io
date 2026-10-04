// Import and suggestions from inside the public bot (Node_00), through the same routes the site uses:
// a JanitorAI link imports the bot into the catalog (POST /api/import, polled like the site's import window),
// any other link can be suggested to TAVO HUB (POST /api/hub-suggestions, the site's suggest form).
// No chat state is kept: the "suggest this link?" question is sent as a reply to the user's message, and the
// button reads the link back from that message.
const clean=v=>String(v??'').trim();
const esc=s=>clean(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const JANITOR=/https?:\/\/(?:www\.)?janitorai\.com\/characters\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
const LINK=/https?:\/\/[^\s<>"']+/i;
export const janitorUuid=text=>(clean(text).match(JANITOR)||[])[1]?.toLowerCase()||'';
export const firstLink=text=>(clean(text).match(LINK)||[])[0]?.replace(/[).,!?»]+$/,'')||'';

async function tg(token,method,payload){const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}),d=await r.json().catch(()=>({ok:false,description:`HTTP_${r.status}`}));if(!r.ok||!d.ok)throw new Error(d.description||`TELEGRAM_${method}_FAILED`);return d.result}
const say=(token,chatId,text,reply_markup,extra={})=>tg(token,'sendMessage',{chat_id:chatId,text,parse_mode:'HTML',disable_web_page_preview:true,...(reply_markup?{reply_markup}:{}),...extra});
const cb=(text,callback_data)=>({text,callback_data});
async function callRoute(route,origin,path,init){const r=await route(new Request(origin+path,init));let d={};try{d=await r.json()}catch{}return{status:r.status,ok:r.ok,data:d}}

const IMPORT_ERRORS={INVALID_JANITOR_URL:'Это не похоже на ссылку на бота JanitorAI.',NOT_AVAILABLE:'Этот бот скрыт из каталога.',RETRIEVAL_TIMEOUT:'Источник долго не отвечает — попробуй позже.'};
const importError=d=>IMPORT_ERRORS[clean(d?.error||d?.state)]||`Не получилось импортировать (${esc(d?.error||d?.state||d?.detail||'ошибка')}). Попробуй позже.`;

// A JanitorAI link in the chat: import it right away and answer with the bot's card.
// While the source is still being fetched (202), the bot checks the status itself in the background (like the
// site's window does) and sends the card when it is ready; a "check" button covers the case it isn't yet.
export async function importFromChat(token,chatId,{origin,route,waitUntil,uuid,url,openCard}){
  if(!route)return say(token,chatId,'Импорт сейчас недоступен — попробуй на сайте.');
  await tg(token,'sendChatAction',{chat_id:chatId,action:'typing'}).catch(()=>{});
  const res=await callRoute(route,origin,'/api/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url})});
  if(res.ok&&res.status!==202&&res.data.ok!==false){
    await say(token,chatId,res.data.state==='ALREADY_IN_ARCHIVE'?'✅ Этот бот уже есть в каталоге:':'✅ Бот добавлен в каталог!');
    return openCard(uuid);
  }
  if(res.status!==202)return say(token,chatId,`❌ ${importError(res.data)}`);
  const msg=await say(token,chatId,'⏳ Достаю данные бота из источника… Карточка придёт сама, обычно это 10–30 секунд.',{inline_keyboard:[[cb('🔄 Проверить',`p:is:${uuid}`)]]});
  // Background check only where the Worker can keep running after the reply (ctx.waitUntil).
  if(waitUntil)waitUntil((async()=>{for(let i=0;i<6;i++){await new Promise(r=>setTimeout(r,5000));if(await importReady(token,chatId,{origin,route,uuid,openCard,messageId:msg?.message_id,quiet:true}))return}})().catch(()=>{}));
}
// 🔄 / background check of a running import. Returns true once the card was sent.
export async function importReady(token,chatId,{origin,route,uuid,openCard,messageId,quiet=false}){
  const res=await callRoute(route,origin,`/api/import/status?uuid=${encodeURIComponent(uuid)}`,{method:'GET'});
  if(res.ok&&res.data.ready){
    if(messageId)await tg(token,'editMessageText',{chat_id:chatId,message_id:messageId,text:'✅ Бот добавлен в каталог!'}).catch(()=>{});
    await openCard(uuid);return true;
  }
  if(res.status===202){if(!quiet)await say(token,chatId,'⏳ Ещё достаю данные — нажми «Проверить» чуть позже.',{inline_keyboard:[[cb('🔄 Проверить',`p:is:${uuid}`)]]});return false}
  if(!quiet||res.status>=400){if(messageId)await tg(token,'editMessageText',{chat_id:chatId,message_id:messageId,text:`❌ ${importError(res.data)}`,parse_mode:'HTML'}).catch(()=>{});else await say(token,chatId,`❌ ${importError(res.data)}`)}
  return true;
}

// Any other link: ask first (as a reply to that message), so a pasted link is never sent by accident.
export function askSuggest(token,chatId,messageId,link){
  return say(token,chatId,`Предложить эту ссылку в <b>TAVO HUB</b>?\n${esc(link)}\n\nПосле проверки ресурс появится на сайте и в боте.`,{inline_keyboard:[[cb('📚 Да, предложить','p:sgy'),cb('Нет','p:sgn')]]},{reply_parameters:{message_id:messageId,allow_sending_without_reply:true}});
}
// "Да": the link is read back from the user's message this question replied to.
export async function confirmSuggest(token,chatId,q,{origin,route}){
  const asked=q.message,link=firstLink(asked?.reply_to_message?.text||asked?.reply_to_message?.caption||'');
  const done=text=>tg(token,'editMessageText',{chat_id:chatId,message_id:asked?.message_id,text,parse_mode:'HTML',disable_web_page_preview:true}).catch(()=>say(token,chatId,text));
  if(!link)return done('Не нашёл ссылку — пришли её ещё раз.');
  if(!route)return done('Предложка сейчас недоступна — попробуй на сайте.');
  const who=clean(q.from?.username)?`@${clean(q.from.username)}`:clean(q.from?.first_name);
  const res=await callRoute(route,origin,'/api/hub-suggestions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:link,note:`Из Telegram-бота Node_00${who?` · ${who}`:''}`})});
  if(!res.ok||res.data.ok===false)return done(res.data.error==='VALID_URL_REQUIRED'?'❌ Это не похоже на ссылку на ресурс.':'❌ Не получилось отправить — попробуй позже.');
  return done(res.data.duplicate?`📚 Эту ссылку уже предлагали — она ждёт проверки.\n${esc(link)}`:`📚 Спасибо! Ссылка отправлена на проверку в TAVO HUB.\n${esc(link)}`);
}
