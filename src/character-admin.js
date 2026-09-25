import { detachedLorebookCleanupStatements, linkedLorebooksForCharacter, planDetachedLorebookCleanup } from './lorebook-cleanup.js';
import { lorebookUniverseChangeStatements, planAffectedLorebookUniverseChanges } from './lorebook-universe-repair.js';
import { normalizeSettingIds, normalizeUniverses, settingDefinitions } from './discovery.js';
import { normalizeHashtags, normalizeTags } from './filter-normalization.js';
import { clearCatalogCache } from './catalog-cache.js';
import { buildCharacterBundle } from './worker.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=v=>String(v??'').trim();
const arr=v=>Array.isArray(v)?v:[];
const uniq=v=>[...new Set(arr(v).map(clean).filter(Boolean))];
const parse=v=>{try{const x=JSON.parse(v||'[]');return Array.isArray(x)?x:[]}catch{return[]}};
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const povKey=v=>String(v||'').replace(/^[^\p{L}\p{N}#]+/u,'').toLocaleLowerCase().replace(/[^a-z]/g,'');
const isPovTag=v=>['fempov','femalepov','malepov','anypov'].includes(povKey(v));
const normKey=v=>clean(v).toLocaleLowerCase();
const sameStringSet=(a,b)=>{const aa=uniq(a).map(normKey).sort(),bb=uniq(b).map(normKey).sort();return aa.length===bb.length&&aa.every((v,i)=>v===bb[i])};


function normalizeRow(r){
  return{
    uuid:r.janitor_uuid,
    name:r.name||'',author:r.author||'',author_url:r.author_url||'',
    short_description:r.short_description||'',description:r.description||'',scenario:r.scenario||'',
    tags:normalizeTags(parse(r.tags)),hashtags:normalizeHashtags(parse(r.hashtags)),
    universe:r.universe||'',universes:parse(r.universes),universe_source_field:r.universe_source_field||'',
    setting_ids:parse(r.setting_ids),pov:r.pov||'',
    image_url:r.image_url||'',janitor_url:r.janitor_url||'',datacat_url:r.datacat_url||'',
    status:r.status||'',updated_at:r.updated_at||null
  };
}

export async function listAdminCharacters(request,env){
  const u=new URL(request.url),q=clean(u.searchParams.get('q')).toLocaleLowerCase(),limit=Math.min(Math.max(Number(u.searchParams.get('limit')||500),1),1000);
  const res=await env.DB.prepare(`SELECT janitor_uuid,name,author,author_url,short_description,description,scenario,tags,hashtags,universe,universes,universe_source_field,setting_ids,pov,image_url,janitor_url,datacat_url,status,updated_at FROM characters ORDER BY author COLLATE NOCASE,name COLLATE NOCASE LIMIT ?`).bind(limit).all();
  let rows=(res.results||[]).map(normalizeRow);
  if(q)rows=rows.filter(r=>[r.name,r.author,r.uuid,...r.tags,...r.hashtags,...r.universes,...r.setting_ids].join(' ').toLocaleLowerCase().includes(q));
  return json({ok:true,count:rows.length,characters:rows,settingDefinitions:settingDefinitions()});
}

export async function updateAdminCharacter(request,env,uuid){
  if(!UUID_RE.test(uuid))return json({ok:false,error:'INVALID_UUID'},400);
  let b;try{b=await request.json()}catch{return json({ok:false,error:'INVALID_JSON'},400)}
  const current=await env.DB.prepare('SELECT janitor_uuid,universe,universes,universe_source_field,setting_ids,setting_source,pov,pov_source FROM characters WHERE janitor_uuid=? LIMIT 1').bind(uuid).first();
  if(!current)return json({ok:false,error:'CHARACTER_NOT_FOUND'},404);
  const universes=normalizeUniverses(b.universes),hashtags=normalizeHashtags(b.hashtags),settingIds=normalizeSettingIds(b.setting_ids);
  const currentUniverses=normalizeUniverses(parse(current.universes).length?parse(current.universes):[current.universe]);
  const universesChanged=!sameStringSet(universes,currentUniverses);
  const universeSource=universesChanged?'admin:manual':clean(current.universe_source_field);
  const settingsChanged=!sameStringSet(settingIds,normalizeSettingIds(parse(current.setting_ids)));
  const settingSource=settingsChanged||clean(current.setting_source)==='admin:manual'?'admin:manual':'rules:v6';
  const pov=['FemPOV','MalePOV','AnyPOV'].includes(clean(b.pov))?clean(b.pov):'AnyPOV';
  const povSource=pov!==clean(current.pov)?'admin:manual':clean(current.pov_source);
  const povTag=pov==='FemPOV'?'👩 FemPov':pov==='MalePOV'?'👨 MalePov':'👤 AnyPOV';
  const tags=normalizeTags([...arr(b.tags).filter(x=>!isPovTag(x)),povTag]);
  const status=['published','hidden'].includes(clean(b.status))?clean(b.status):'published';
  await env.DB.prepare(`UPDATE characters SET name=?,author=?,author_url=?,short_description=?,description=?,scenario=?,tags=?,hashtags=?,universe=?,universes=?,universe_source_field=?,setting_ids=?,setting_source=?,pov=?,pov_source=?,image_url=?,janitor_url=?,datacat_url=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE janitor_uuid=?`).bind(
    clean(b.name)||'UNKNOWN CHARACTER',clean(b.author)||'Unknown',clean(b.author_url),clean(b.short_description),String(b.description??'').trim(),String(b.scenario??'').trim(),JSON.stringify(tags),JSON.stringify(hashtags),universes[0]||'',JSON.stringify(universes),universeSource,JSON.stringify(settingIds),settingSource,pov,povSource,clean(b.image_url),clean(b.janitor_url),clean(b.datacat_url),status,uuid
  ).run();
  await clearCatalogCache(request);
  return json({ok:true,uuid,universeOverrideChanged:universesChanged,universeSourceField:universeSource||null,settingSource,povSource:povSource||null});
}

// One-off: fill empty author profile links. All records of one author share a Janitor profile, so each author is
// resolved from two of their records (both must agree) — one author per POST keeps DataCat subrequests bounded.
// GET = plan (no network). POST {author} = resolve + fill that author's empty links. Scheme-less links get https://.
export async function backfillAuthorLinks(request,env){
  const origin=new URL(request.url).origin;
  if(request.method==='GET'){
    const rows=(await env.DB.prepare("SELECT author,COUNT(*) AS total,SUM(CASE WHEN author_url='' THEN 1 ELSE 0 END) AS missing,SUM(CASE WHEN author_url<>'' AND author_url NOT LIKE 'http%' THEN 1 ELSE 0 END) AS schemeless FROM characters GROUP BY author ORDER BY total DESC").all()).results||[];
    return json({ok:true,mode:'plan',authors:rows.map(r=>({author:r.author,total:Number(r.total),missing:Number(r.missing),schemeless:Number(r.schemeless)}))});
  }
  let b;try{b=await request.json()}catch{return json({ok:false,error:'INVALID_JSON'},400)}
  const author=clean(b.author);if(!author)return json({ok:false,error:'AUTHOR_REQUIRED'},400);
  const fixed=await env.DB.prepare("UPDATE characters SET author_url='https://'||author_url WHERE author=? AND author_url<>'' AND author_url NOT LIKE 'http%'").bind(author).run();
  const samples=(await env.DB.prepare("SELECT janitor_uuid FROM characters WHERE author=? AND author_url='' ORDER BY updated_at DESC LIMIT 2").bind(author).all()).results||[];
  const found=[];
  for(const s of samples){try{const bundle=await buildCharacterBundle(env,s.janitor_uuid,`https://janitorai.com/characters/${s.janitor_uuid}`,origin);found.push(clean(bundle?.character?.author_url))}catch(e){found.push('')}}
  const urls=[...new Set(found.filter(Boolean))];
  const schemeFixed=Number(fixed?.meta?.changes||0);
  if(!samples.length){await clearCatalogCache(request);return json({ok:true,author,result:'NOTHING_MISSING',schemeFixed})}
  if(urls.length!==1){
    if(schemeFixed)await clearCatalogCache(request);
    return json({ok:true,author,result:urls.length>1?'SKIPPED_PROFILES_DISAGREE':'SKIPPED_NO_PROFILE_IN_SOURCE',found,schemeFixed});
  }
  const updated=await env.DB.prepare("UPDATE characters SET author_url=? WHERE author=? AND author_url=''").bind(urls[0],author).run();
  await clearCatalogCache(request);
  return json({ok:true,author,result:'FILLED',profile:urls[0],filled:Number(updated?.meta?.changes||0),schemeFixed});
}

export async function deleteAdminCharacter(request,env,uuid){
  if(!UUID_RE.test(uuid))return json({ok:false,error:'INVALID_UUID'},400);
  const row=await env.DB.prepare('SELECT janitor_uuid FROM characters WHERE janitor_uuid=? LIMIT 1').bind(uuid).first();
  if(!row)return json({ok:false,error:'CHARACTER_NOT_FOUND'},404);
  const oldLorebooks=await linkedLorebooksForCharacter(env,uuid),oldLorebookIds=oldLorebooks.map(x=>x.id);
  const universePlan=await planAffectedLorebookUniverseChanges(env,uuid,oldLorebookIds,[uuid]);
  const cleanupPlan=await planDetachedLorebookCleanup(env,oldLorebooks,{excludingCharacterUuid:uuid});
  const statements=[
    env.DB.prepare('DELETE FROM character_lorebooks WHERE character_uuid=?').bind(uuid),
    env.DB.prepare('DELETE FROM admin_universe_review WHERE review_key=?').bind(`candidate:${uuid}`),
    ...lorebookUniverseChangeStatements(env,universePlan.changes),
    ...detachedLorebookCleanupStatements(env,cleanupPlan),
    env.DB.prepare('DELETE FROM characters WHERE janitor_uuid=?').bind(uuid)
  ];
  await env.DB.batch(statements);
  await clearCatalogCache(request);
  return json({ok:true,uuid,deleted:true,lorebookCleanup:{entities:cleanupPlan.entityIds.length,sources:cleanupPlan.entityIds.length,blobs:cleanupPlan.blobHashes.length},universeRepair:{updated:universePlan.updated,inferred:universePlan.inferred,cleared:universePlan.cleared,targets:universePlan.targets}});
}
