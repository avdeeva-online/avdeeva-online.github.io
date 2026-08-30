import app from './main.js';

function json(data,status=200){return new Response(JSON.stringify(data,null,2),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
function arr(v){try{const x=JSON.parse(v||'[]');return Array.isArray(x)?x:[]}catch{return[]}}
function clean(v){return typeof v==='string'?v.trim():''}
function sourceUniverse(c){
  const fields=['universe','universe_name','universeName','series','series_name','seriesName','franchise','franchise_name','franchiseName','world','world_name','worldName'];
  for(const field of fields){const value=clean(c?.[field]);if(value)return{value,field}}
  return{value:'',field:''};
}
function lorebook(c){return(Array.isArray(c?.scripts)?c.scripts:[]).find(s=>s&&String(s.type||'').toLowerCase()==='lorebook'&&s.is_public!==false&&s.is_code_public!==false&&typeof s.script==='string'&&s.script.trim())||null}
function dcHeaders(env){return{'accept':'application/json','x-device-token':env.DATACAT_DEVICE_TOKEN||'','x-session-token':env.DATACAT_SESSION_TOKEN||'','user-agent':'ARCHIVE.EXE/source-truth-1.1'}}
async function dcModal(env,uuid){
  const r=await fetch(`https://datacat.run/api/characters/recent-public/${encodeURIComponent(uuid)}?view=modal&sourceKind=janitor`,{headers:dcHeaders(env),redirect:'follow'});
  const text=await r.text();let data=null;try{data=JSON.parse(text)}catch{}
  if(!r.ok)return{ok:false,status:r.status,error:text.slice(0,300)};
  const c=data?.character;return c&&typeof c==='object'?{ok:true,c}:{ok:false,status:502,error:'NO_CHARACTER_OBJECT'};
}
async function ensureSchema(env){
  for(const sql of['ALTER TABLE characters ADD COLUMN lorebook_title TEXT','ALTER TABLE characters ADD COLUMN universe_source_field TEXT']){
    try{await env.DB.prepare(sql).run()}catch(e){if(!/duplicate column|already exists/i.test(String(e?.message||e)))throw e}
  }
}
function canonicalAuthors(rows){
  const groups=new Map();
  for(const r of rows){const v=clean(r.author);if(!v)continue;const k=v.toLocaleLowerCase();if(!groups.has(k))groups.set(k,new Map());groups.get(k).set(v,(groups.get(k).get(v)||0)+1)}
  const out=new Map();
  for(const [k,variants] of groups){const winner=[...variants.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]||'';out.set(k,winner)}
  return out;
}
function canonAuthor(v,map){const raw=clean(v);return raw?(map.get(raw.toLocaleLowerCase())||raw):'Unknown'}
function normalizeRow(r,origin,authors){
  const uuid=r.janitor_uuid,universe=clean(r.universe)||'UNCLASSIFIED',author=canonAuthor(r.author,authors),loreTitle=clean(r.lorebook_title);
  return{id:r.slug||uuid,nameRu:'',nameEn:r.name||'Character',author,authorUrl:r.author_url||'',universe,pov:r.pov||'AnyPOV',tags:arr(r.tags),hashtags:arr(r.hashtags),short:r.short_description||'',full:r.description||'',scenario:r.scenario||'',image:r.image_url||'',platform:'JANITOR',url:r.janitor_url||`https://janitorai.com/characters/${uuid}`,download:`${origin}/api/characters/${uuid}/card`,downloadPng:`${origin}/api/characters/${uuid}/card.png`,lorebook:r.lorebook_url||'',lorebookTitle:loreTitle,intros:arr(r.intros),isNew:false,janitorUuid:uuid,datacatUrl:r.datacat_url||'',source:r.source||'janitor',sourceLabel:'JanitorAI',universeSourceField:r.universe_source_field||''};
}
async function refreshOne(env,uuid){
  await ensureSchema(env);const row=await env.DB.prepare('SELECT id,name,author FROM characters WHERE janitor_uuid=? LIMIT 1').bind(uuid).first();if(!row)return{ok:false,error:'DB_RECORD_NOT_FOUND'};
  const dc=await dcModal(env,uuid);if(!dc.ok)return dc;
  const c=dc.c,book=lorebook(c),uni=sourceUniverse(c),name=clean(c.name||c.chat_name||c.chatName),author=clean(c.creator_name||c.creatorName),bookTitle=clean(book?.title);
  await env.DB.prepare('UPDATE characters SET name=?,author=?,universe=?,universe_source_field=?,lorebook_title=?,updated_at=CURRENT_TIMESTAMP WHERE janitor_uuid=?')
    .bind(name||row.name,author||row.author,uni.value,uni.field,bookTitle,uuid).run();
  return{ok:true,uuid,name:name||row.name,author:author||row.author,universe:uni.value||null,universeSourceField:uni.field||null,lorebookTitle:bookTitle||null,hasLorebook:Boolean(book)};
}
async function characters(request,env){
  await ensureSchema(env);const u=new URL(request.url),limit=Math.min(Math.max(Number(u.searchParams.get('limit')||500),1),1000);
  const res=await env.DB.prepare("SELECT * FROM characters WHERE status='published' ORDER BY updated_at DESC LIMIT ?").bind(limit).all(),rows=Array.isArray(res?.results)?res.results:[],authors=canonicalAuthors(rows);
  return json({ok:true,count:rows.length,characters:rows.map(r=>normalizeRow(r,u.origin,authors)),namingPolicy:'source-truth'});
}
async function lorebooks(request,env){
  await ensureSchema(env);const u=new URL(request.url);
  const res=await env.DB.prepare("SELECT janitor_uuid,name,author,universe,universe_source_field,lorebook_url,lorebook_title,status FROM characters WHERE status='published' AND lorebook_url IS NOT NULL AND lorebook_url!='' ORDER BY author,name").all(),rows=Array.isArray(res?.results)?res.results:[],authors=canonicalAuthors(rows);
  const items=rows.map(r=>({id:`${r.janitor_uuid}:lorebook`,janitorUuid:r.janitor_uuid,characterName:r.name||'Character',author:canonAuthor(r.author,authors),universe:clean(r.universe)||'UNCLASSIFIED',universeSourceField:r.universe_source_field||'',title:clean(r.lorebook_title),download:r.lorebook_url||`${u.origin}/api/characters/${r.janitor_uuid}/lorebook`,source:'janitor'}));
  return json({ok:true,count:items.length,lorebooks:items,namingPolicy:'source-truth'});
}
async function reindex(request,env){
  await ensureSchema(env);const u=new URL(request.url),after=Math.max(0,Number(u.searchParams.get('after')||0)),limit=Math.min(Math.max(Number(u.searchParams.get('limit')||8),1),12);
  const res=await env.DB.prepare('SELECT id,janitor_uuid FROM characters WHERE id>? ORDER BY id LIMIT ?').bind(after,limit).all(),rows=Array.isArray(res?.results)?res.results:[],results=[];
  for(const row of rows){const r=await refreshOne(env,row.janitor_uuid);results.push({id:row.id,...r})}
  const next=rows.length?rows[rows.length-1].id:after,totalRow=await env.DB.prepare('SELECT COUNT(*) AS n FROM characters').first(),remaining=await env.DB.prepare('SELECT COUNT(*) AS n FROM characters WHERE id>?').bind(next).first();
  return json({ok:true,processed:rows.length,after,next,total:Number(totalRow?.n||0),remaining:Number(remaining?.n||0),done:rows.length===0||Number(remaining?.n||0)===0,results});
}
async function passWithRefresh(request,env,ctx){
  const response=await app.fetch(request,env,ctx);const u=new URL(request.url);
  if((u.pathname==='/api/import'||u.pathname==='/api/import/status')&&response.headers.get('content-type')?.includes('application/json')){
    try{const d=await response.clone().json(),uuid=clean(d?.janitorUuid||d?.janitor_uuid);if(uuid&&response.ok&&response.status!==202)ctx?.waitUntil?.(refreshOne(env,uuid).catch(()=>{}))}catch{}
  }
  return response;
}
export default{async fetch(request,env,ctx){const u=new URL(request.url);if(request.method==='GET'&&u.pathname==='/api/characters')return characters(request,env);if(request.method==='GET'&&u.pathname==='/api/lorebooks')return lorebooks(request,env);if(request.method==='GET'&&u.pathname==='/api/admin/reindex-source-truth')return reindex(request,env);return passWithRefresh(request,env,ctx)}};
