import { requireD1Schema } from './d1-schema.js';

const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const key=v=>clean(v).toLocaleLowerCase();
const uniq=values=>{const out=[],seen=new Set();for(const raw of values||[]){const v=clean(raw),k=key(v);if(!v||seen.has(k))continue;seen.add(k);out.push(v)}return out};
const parseJsonArray=v=>{try{const x=JSON.parse(v||'[]');return Array.isArray(x)?x:[]}catch{return[]}};
const json=(data,status=200)=>new Response(JSON.stringify(data,null,2),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const ensureSchema=env=>requireD1Schema(env,'universe-curation','SELECT source_key,source_value,public_universes,parent_universe,subuniverse,active,note,updated_at FROM universe_curation LIMIT 1');
const REGISTRY_CACHE_MS=60000;
let registryCache=null,registryCachedAt=0;
const invalidateRegistry=()=>{registryCache=null;registryCachedAt=0};

async function loadRegistry(env,{fresh=false}={}){
  await ensureSchema(env);
  if(!fresh&&registryCache&&Date.now()-registryCachedAt<REGISTRY_CACHE_MS)return registryCache;
  const res=await env.DB.prepare(`SELECT source_key,source_value,public_universes,parent_universe,subuniverse,active,note,updated_at FROM universe_curation ORDER BY source_value COLLATE NOCASE`).all();
  const rows=Array.isArray(res?.results)?res.results:[];
  const rules=new Map(),canonicalCase=new Map();
  for(const row of rows){
    const publics=uniq(parseJsonArray(row.public_universes));
    const parsed={...row,publics,parent:clean(row.parent_universe),sub:clean(row.subuniverse),active:Number(row.active)!==0};
    rules.set(String(row.source_key),parsed);
    for(const value of publics)canonicalCase.set(key(value),value);
    if(parsed.parent)canonicalCase.set(key(parsed.parent),parsed.parent);
    if(parsed.sub)canonicalCase.set(key(parsed.sub),parsed.sub);
  }
  registryCache={rows,rules,canonicalCase};registryCachedAt=Date.now();return registryCache;
}

function curateValues(values,registry,{manual=false}={}){
  const out=[];
  for(const raw of uniq(values)){
    const k=key(raw);
    if(manual){out.push(registry.canonicalCase.get(k)||raw);continue}
    const rule=registry.rules.get(k);
    // An active rule with an empty public list deliberately suppresses a
    // source label that is metadata rather than a real shared universe.
    if(rule?.active){if(rule.publics.length)out.push(...rule.publics)}
    else out.push(registry.canonicalCase.get(k)||raw);
  }
  return uniq(out);
}

function curateCharacter(character,registry){
  if(!character||typeof character!=='object')return character;
  const manual=clean(character.universeSourceField)==='admin:manual';
  const raw=Array.isArray(character.universes)&&character.universes.length?character.universes:[character.universe];
  const universes=curateValues(raw,registry,{manual});
  const hierarchy=[];
  if(!manual){
    for(const value of uniq(raw)){
      const rule=registry.rules.get(key(value));
      if(rule?.active&&(rule.parent||rule.sub))hierarchy.push({source:value,parent:rule.parent||'',subuniverse:rule.sub||''});
    }
  }
  return{...character,universe:universes[0]||'',universes,universeHierarchy:hierarchy};
}

function curateLorebooks(items,registry){
  const out=[],seen=new Set();
  for(const item of Array.isArray(items)?items:[]){
    const values=curateValues([item?.universe],registry);
    const finals=values.length?values:[''];
    for(const universe of finals){
      const id=`${item?.id||item?.janitorUuid||''}\u0000${key(universe)}`;
      if(seen.has(id))continue;
      seen.add(id);
      out.push({...item,universe});
    }
  }
  return out;
}

export async function transformUniversePublicResponse(request,response,env){
  if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))return response;
  const path=new URL(request.url).pathname;
  const isCatalog=path==='/api/catalog'||path==='/api/characters';
  const isDetail=/^\/api\/characters\/[0-9a-f-]{36}$/i.test(path);
  const isLorebooks=path==='/api/lorebooks';
  if(!isCatalog&&!isDetail&&!isLorebooks)return response;
  let data;try{data=await response.clone().json()}catch{return response}
  const registry=await loadRegistry(env);
  if(isCatalog&&Array.isArray(data.characters))data.characters=data.characters.map(c=>curateCharacter(c,registry));
  if(isDetail&&data.character)data.character=curateCharacter(data.character,registry);
  if(isLorebooks&&Array.isArray(data.lorebooks)){
    data.lorebooks=curateLorebooks(data.lorebooks,registry);
    data.viewCount=data.lorebooks.length;
  }
  const headers=new Headers(response.headers);headers.delete('content-length');
  return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers});
}

async function getAdminRegistry(env){
  const registry=await loadRegistry(env);
  const rules=registry.rows.map(row=>({
    source:row.source_value,
    publicUniverses:uniq(parseJsonArray(row.public_universes)),
    parentUniverse:clean(row.parent_universe),
    subuniverse:clean(row.subuniverse),
    active:Number(row.active)!==0,
    note:row.note||'',
    updatedAt:row.updated_at||null
  }));
  const canonicalUniverses=uniq(rules.filter(r=>r.active).flatMap(r=>r.publicUniverses));
  return json({ok:true,rules,canonicalUniverses,count:rules.length});
}

async function mutateAdminRegistry(request,env){
  await ensureSchema(env);
  let body;try{body=await request.json()}catch{return json({ok:false,error:'INVALID_JSON'},400)}
  const action=clean(body?.action);
  if(action==='set'){
    const source=clean(body?.source),publicUniverses=uniq(Array.isArray(body?.publicUniverses)?body.publicUniverses:String(body?.publicUniverses||'').split(',')),parent=clean(body?.parentUniverse),sub=clean(body?.subuniverse),note=clean(body?.note);
    if(!source||!publicUniverses.length)return json({ok:false,error:'SOURCE_AND_PUBLIC_UNIVERSE_REQUIRED'},400);
    await env.DB.prepare(`INSERT INTO universe_curation(source_key,source_value,public_universes,parent_universe,subuniverse,active,note,updated_at)
      VALUES(?,?,?,?,?,1,?,CURRENT_TIMESTAMP)
      ON CONFLICT(source_key) DO UPDATE SET source_value=excluded.source_value,public_universes=excluded.public_universes,parent_universe=excluded.parent_universe,subuniverse=excluded.subuniverse,active=1,note=excluded.note,updated_at=CURRENT_TIMESTAMP`)
      .bind(key(source),source,JSON.stringify(publicUniverses),parent,sub,note).run();
    invalidateRegistry();return json({ok:true,action,source,publicUniverses,parentUniverse:parent,subuniverse:sub});
  }
  if(action==='toggle'){
    const source=clean(body?.source);if(!source)return json({ok:false,error:'SOURCE_REQUIRED'},400);
    await env.DB.prepare(`UPDATE universe_curation SET active=CASE WHEN active=1 THEN 0 ELSE 1 END,updated_at=CURRENT_TIMESTAMP WHERE source_key=?`).bind(key(source)).run();
    invalidateRegistry();return json({ok:true,action,source});
  }
  if(action==='delete'){
    const source=clean(body?.source);if(!source)return json({ok:false,error:'SOURCE_REQUIRED'},400);
    await env.DB.prepare('DELETE FROM universe_curation WHERE source_key=?').bind(key(source)).run();
    invalidateRegistry();return json({ok:true,action,source});
  }
  return json({ok:false,error:'UNKNOWN_ACTION'},400);
}

export async function handleUniverseCurationRoute(request,env){
  const url=new URL(request.url);
  if(url.pathname!=='/api/admin/universe-curation')return null;
  if(request.method==='GET')return getAdminRegistry(env);
  if(request.method==='POST')return mutateAdminRegistry(request,env);
  return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
}
