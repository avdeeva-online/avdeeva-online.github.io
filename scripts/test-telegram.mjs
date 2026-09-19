import assert from 'node:assert/strict';
import { handleAdminTelegramRoute } from '../src/telegram-admin-router.js';
import { telegramDraftsAdmin } from '../src/telegram-drafts-admin.js';
import { handlePublicTelegramFull } from '../src/telegram-public-bot.js';
import { setupTelegramWebhooks } from '../src/telegram-webhooks.js';

async function secret(kind,token){
  const bytes=new TextEncoder().encode(`${kind}|${token}`),hash=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,48);
}

{
  const response=await handleAdminTelegramRoute(new Request('https://archive.example/telegram/admin',{method:'POST'}),{Node00admin:'token'});
  assert.equal(response.status,503);
  assert.equal((await response.json()).error,'ADMIN_USER_ID_MISSING');
}

{
  const response=await handleAdminTelegramRoute(new Request('https://archive.example/telegram/admin',{method:'POST',headers:{'x-telegram-bot-api-secret-token':'wrong'}}),{Node00admin:'token',TELEGRAM_ADMIN_USER_ID:'123'});
  assert.equal(response.status,403);
  assert.equal((await response.json()).error,'INVALID_WEBHOOK_SECRET');
}

{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({ok:false,description:'setWebhook failed'}),{status:502,headers:{'content-type':'application/json'}});
  try{
    const response=await setupTelegramWebhooks(new Request('https://archive.example/api/admin/telegram/setup',{method:'POST'}),{Node00admin:'token',TELEGRAM_ADMIN_USER_ID:'123'});
    assert.equal(response.status,502);
    assert.equal((await response.json()).ok,false);
  }finally{globalThis.fetch=originalFetch}
}

{
  const calls=[],originalFetch=globalThis.fetch;
  globalThis.fetch=async(url,init)=>{calls.push({method:String(url).split('/').pop(),payload:JSON.parse(init.body)});return new Response(JSON.stringify({ok:true,result:true}),{headers:{'content-type':'application/json'}})};
  try{
    const response=await setupTelegramWebhooks(new Request('https://archive.example/api/admin/telegram/setup',{method:'POST'}),{Node00admin:'token',TELEGRAM_ADMIN_USER_ID:'123'});
    assert.equal(response.status,200);
    assert.equal(calls.find(x=>x.method==='setWebhook')?.payload.max_connections,1);
  }finally{globalThis.fetch=originalFetch}
}

{
  const calls=[],originalFetch=globalThis.fetch,token='public-token';
  globalThis.fetch=async(url,init)=>{
    const method=String(url).split('/').pop(),payload=JSON.parse(init.body);
    calls.push({method,payload});
    if(method==='editMessageText')return new Response(JSON.stringify({ok:false,description:'Bad Request: message is not modified'}),{status:400,headers:{'content-type':'application/json'}});
    return new Response(JSON.stringify({ok:true,result:true}),{headers:{'content-type':'application/json'}});
  };
  try{
    const update={callback_query:{id:'callback',data:'p:home',from:{id:1},message:{message_id:2,chat:{id:3}}}};
    const response=await handlePublicTelegramFull(new Request('https://archive.example/telegram/public',{method:'POST',headers:{'content-type':'application/json','x-telegram-bot-api-secret-token':await secret('public',token)},body:JSON.stringify(update)}),{PUBLICnode00bot:token});
    assert.equal(response.status,200);
    assert.deepEqual(calls.map(x=>x.method),['answerCallbackQuery','editMessageText']);
  }finally{globalThis.fetch=originalFetch}
}

{
  const row={id:'published-draft',source_url:'https://t.me/example/1',payload:'{}',status:'published',created_at:'',updated_at:''};
  let deleted=false;
  const DB={prepare(sql){return{bind(){return this},async first(){return sql.includes('SELECT * FROM telegram_admin_drafts')?row:{n:1}},async run(){if(sql.startsWith('DELETE FROM telegram_admin_drafts'))deleted=true;return{meta:{changes:1}}}}}};
  const response=await telegramDraftsAdmin(new Request('https://archive.example/api/admin/telegram-drafts/published-draft',{method:'DELETE'}),{DB},row.id);
  assert.equal(response.status,409);
  assert.equal((await response.json()).error,'DRAFT_NOT_REVIEWABLE');
  assert.equal(deleted,false);
}

console.log('ARCHIVE.EXE Telegram behavior OK · fail-closed admin webhook + truthful setup status + quiet public edits + immutable published drafts checked');
