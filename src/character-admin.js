const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=v=>String(v??'').trim();
const arr=v=>Array.isArray(v)?v:[];
const uniq=v=>[...new Set(arr(v).map(clean).filter(Boolean))];
const parse=v=>{try{const x=JSON.parse(v||'[]');return Array.isArray(x)?x:[]}catch{return[]}};
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const povKey=v=>String(v||'').replace(/^[^\p{L}\p{N}#]+/u,'').toLocaleLowerCase().replace(/[^a-z]/g,'');
const isPovTag=v=>['fempov','femalepov','malepov','anypov'].includes(povKey(v));

async function clearCatalogCache(request){
  const cache=globalThis.caches?.default;if(!cache)return;
  const u=new URL(request.url);
  await Promise.all([500,1000].map(limit=>{const key=new URL(u.origin);key.pathname='/__archive_cache/catalog-v6';key.search=`?limit=${limit}`;return cache.delete(new Request(key.toString(),{method:'GET'}))}));
}

function normalizeRow(r){
  return{
    uuid:r.janitor_uuid,
    name:r.name||'',author:r.author||'',author_url:r.author_url||'',
    short_description:r.short_description||'',description:r.description||'',scenario:r.scenario||'',
    tags:parse(r.tags),hashtags:parse(r.hashtags),
    universe:r.universe||'',universes:parse(r.universes),
    setting_ids:parse(r.setting_ids),pov:r.pov||'',
    image_url:r.image_url||'',janitor_url:r.janitor_url||'',datacat_url:r.datacat_url||'',
    status:r.status||'',updated_at:r.updated_at||null
  };
}

export async function listAdminCharacters(request,env){
  const u=new URL(request.url),q=clean(u.searchParams.get('q')).toLocaleLowerCase(),limit=Math.min(Math.max(Number(u.searchParams.get('limit')||500),1),1000);
  const res=await env.DB.prepare(`SELECT janitor_uuid,name,author,author_url,short_description,description,scenario,tags,hashtags,universe,universes,setting_ids,pov,image_url,janitor_url,datacat_url,status,updated_at FROM characters ORDER BY author COLLATE NOCASE,name COLLATE NOCASE LIMIT ?`).bind(limit).all();
  let rows=(res.results||[]).map(normalizeRow);
  if(q)rows=rows.filter(r=>[r.name,r.author,r.uuid,...r.tags,...r.hashtags,...r.universes,...r.setting_ids].join(' ').toLocaleLowerCase().includes(q));
  return json({ok:true,count:rows.length,characters:rows});
}

export async function updateAdminCharacter(request,env,uuid){
  if(!UUID_RE.test(uuid))return json({ok:false,error:'INVALID_UUID'},400);
  let b;try{b=await request.json()}catch{return json({ok:false,error:'INVALID_JSON'},400)}
  const current=await env.DB.prepare('SELECT janitor_uuid FROM characters WHERE janitor_uuid=? LIMIT 1').bind(uuid).first();
  if(!current)return json({ok:false,error:'CHARACTER_NOT_FOUND'},404);
  const universes=uniq(b.universes),hashtags=uniq(b.hashtags),settingIds=uniq(b.setting_ids);
  const pov=['FemPOV','MalePOV','AnyPOV'].includes(clean(b.pov))?clean(b.pov):'AnyPOV';
  const povTag=pov==='FemPOV'?'👩 FemPov':pov==='MalePOV'?'👨 MalePov':'👤 AnyPOV';
  const tags=[...uniq(b.tags).filter(x=>!isPovTag(x)),povTag];
  const status=['published','hidden'].includes(clean(b.status))?clean(b.status):'published';
  await env.DB.prepare(`UPDATE characters SET name=?,author=?,author_url=?,short_description=?,description=?,scenario=?,tags=?,hashtags=?,universe=?,universes=?,universe_source_field='admin:manual',setting_ids=?,setting_source='rules:v6',pov=?,image_url=?,janitor_url=?,datacat_url=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE janitor_uuid=?`).bind(
    clean(b.name)||'UNKNOWN CHARACTER',clean(b.author)||'Unknown',clean(b.author_url),clean(b.short_description),String(b.description??'').trim(),String(b.scenario??'').trim(),JSON.stringify(tags),JSON.stringify(hashtags),universes[0]||'',JSON.stringify(universes),JSON.stringify(settingIds),pov,clean(b.image_url),clean(b.janitor_url),clean(b.datacat_url),status,uuid
  ).run();
  await clearCatalogCache(request);
  return json({ok:true,uuid});
}

export async function deleteAdminCharacter(request,env,uuid){
  if(!UUID_RE.test(uuid))return json({ok:false,error:'INVALID_UUID'},400);
  const row=await env.DB.prepare('SELECT janitor_uuid FROM characters WHERE janitor_uuid=? LIMIT 1').bind(uuid).first();
  if(!row)return json({ok:false,error:'CHARACTER_NOT_FOUND'},404);
  try{await env.DB.prepare('DELETE FROM character_lorebooks WHERE character_uuid=?').bind(uuid).run()}catch{}
  try{await env.DB.prepare('DELETE FROM admin_universe_review WHERE review_key=?').bind(`candidate:${uuid}`).run()}catch{}
  await env.DB.prepare('DELETE FROM characters WHERE janitor_uuid=?').bind(uuid).run();
  await clearCatalogCache(request);
  return json({ok:true,uuid,deleted:true});
}
