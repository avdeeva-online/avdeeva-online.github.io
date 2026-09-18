import { jsonArray, normalizeUniverses, resolveUniverseRows } from './discovery.js';

const clean=v=>String(v??'').trim();
const isManual=row=>clean(row?.universe_source_field)==='admin:manual';
const isLorebookDerived=row=>/^lorebook:/i.test(clean(row?.universe_source_field));
const placeholders=n=>Array.from({length:n},()=>'?').join(',');

async function rowsForUuids(env,uuids){
  const ids=[...new Set((uuids||[]).map(clean).filter(Boolean))];
  if(!ids.length)return[];
  const sql=`SELECT c.*,GROUP_CONCAT(DISTINCT COALESCE(NULLIF(l.content_hash,''),l.id)) AS lorebook_keys
    FROM characters c
    LEFT JOIN character_lorebooks cl ON cl.character_uuid=c.janitor_uuid
    LEFT JOIN lorebooks l ON l.id=cl.lorebook_id
    WHERE c.janitor_uuid IN (${placeholders(ids.length)})
    GROUP BY c.janitor_uuid`;
  const out=await env.DB.prepare(sql).bind(...ids).all();
  return Array.isArray(out?.results)?out.results:[];
}

async function linkedValues(env,column,filterColumn,values){
  const ids=[...new Set((values||[]).map(clean).filter(Boolean))];
  if(!ids.length)return[];
  const sql=`SELECT DISTINCT ${column} AS value FROM character_lorebooks WHERE ${filterColumn} IN (${placeholders(ids.length)})`;
  const out=await env.DB.prepare(sql).bind(...ids).all();
  return (out?.results||[]).map(x=>clean(x.value)).filter(Boolean);
}

function sanitizeEvidence(rows){
  return rows.map(row=>{
    const copy={...row,_archive_previous_source:clean(row.universe_source_field),_archive_previous_universes:normalizeUniverses(jsonArray(row.universes).length?row.universes:row.universe)};
    if(isLorebookDerived(row)){
      copy.universe='';
      copy.universes='[]';
      copy.universe_source_field='';
    }
    return copy;
  });
}

function collectRepairChanges(resolved,targetUuids){
  const targets=new Set(targetUuids),changes=[];let inferred=0,cleared=0;
  for(const row of resolved){
    if(!targets.has(clean(row.janitor_uuid))||isManual(row))continue;
    const previousSource=clean(row._archive_previous_source);
    const previousUniverses=Array.isArray(row._archive_previous_universes)?row._archive_previous_universes:[];
    const stored=normalizeUniverses(jsonArray(row.universes).length?row.universes:row.universe);
    const wasLorebook=/^lorebook:/i.test(previousSource);
    if(stored.length&&!wasLorebook)continue;
    const next=normalizeUniverses(row.resolved_universes||row.resolved_universe);
    if(next.length){
      const source=clean(row.resolved_universe_source)||'lorebook:1';
      const same=previousUniverses.length===next.length&&previousUniverses.every((v,i)=>v.toLocaleLowerCase()===next[i].toLocaleLowerCase())&&previousSource===source;
      if(same)continue;
      changes.push({uuid:clean(row.janitor_uuid),universe:next[0]||'',universes:next,source,clear:false});
      inferred++;
    }else if(wasLorebook&&(previousUniverses.length||previousSource)){
      changes.push({uuid:clean(row.janitor_uuid),universe:'',universes:[],source:'',clear:true});
      cleared++;
    }
  }
  return{changes,updated:changes.length,inferred,cleared};
}

function planRepairRows(evidenceRows,targetUuids){
  const sanitized=sanitizeEvidence(evidenceRows);
  const resolved=resolveUniverseRows(sanitized);
  return collectRepairChanges(resolved,new Set(targetUuids));
}

export function lorebookUniverseChangeStatements(env,changes){
  return (changes||[]).map(change=>env.DB.prepare(
    'UPDATE characters SET universe=?,universes=?,universe_source_field=?,updated_at=CURRENT_TIMESTAMP WHERE janitor_uuid=?'
  ).bind(clean(change.universe),JSON.stringify(Array.isArray(change.universes)?change.universes:[]),clean(change.source),clean(change.uuid)));
}

export async function planAffectedLorebookUniverseChanges(env,seedUuid,lorebookIds=[],excludeUuids=[]){
  const excluded=new Set((excludeUuids||[]).map(clean).filter(Boolean)),seed=clean(seedUuid),changedBooks=[...new Set((lorebookIds||[]).map(clean).filter(Boolean))];
  const directlyAffected=new Set();
  if(seed&&!excluded.has(seed))directlyAffected.add(seed);
  for(const uuid of await linkedValues(env,'character_uuid','lorebook_id',changedBooks)){if(!excluded.has(uuid))directlyAffected.add(uuid)}
  const targets=[...directlyAffected];
  if(!targets.length)return{changes:[],updated:0,inferred:0,cleared:0,targets:0,evidence:0};

  const targetBooks=await linkedValues(env,'lorebook_id','character_uuid',targets);
  const evidenceUuids=new Set(targets);
  for(const uuid of await linkedValues(env,'character_uuid','lorebook_id',targetBooks)){if(!excluded.has(uuid))evidenceUuids.add(uuid)}
  const evidence=await rowsForUuids(env,[...evidenceUuids]);
  const result=planRepairRows(evidence,targets);
  return{...result,targets:targets.length,evidence:evidence.length};
}

export async function repairAffectedLorebookUniverses(env,seedUuid,lorebookIds=[]){
  const plan=await planAffectedLorebookUniverseChanges(env,seedUuid,lorebookIds);
  const updates=lorebookUniverseChangeStatements(env,plan.changes);
  if(updates.length)await env.DB.batch(updates);
  const {changes,...result}=plan;
  return result;
}

export async function repairAllLorebookUniverses(env){
  const out=await env.DB.prepare(`SELECT c.*,GROUP_CONCAT(DISTINCT COALESCE(NULLIF(l.content_hash,''),l.id)) AS lorebook_keys
    FROM characters c
    LEFT JOIN character_lorebooks cl ON cl.character_uuid=c.janitor_uuid
    LEFT JOIN lorebooks l ON l.id=cl.lorebook_id
    GROUP BY c.janitor_uuid`).all();
  const rows=Array.isArray(out?.results)?out.results:[];
  const targets=rows.map(x=>clean(x.janitor_uuid)).filter(Boolean);
  const plan=planRepairRows(rows,targets),updates=lorebookUniverseChangeStatements(env,plan.changes);
  if(updates.length)await env.DB.batch(updates);
  const {changes,...result}=plan;
  return{...result,targets:targets.length,evidence:rows.length};
}
