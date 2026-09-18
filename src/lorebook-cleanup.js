const uniq=v=>[...new Set((Array.isArray(v)?v:[]).map(x=>String(x||'').trim()).filter(Boolean))];

export async function linkedLorebooksForCharacter(env,uuid){
  const rows=(await env.DB.prepare(`SELECT l.id,l.content_hash FROM character_lorebooks cl JOIN lorebooks l ON l.id=cl.lorebook_id WHERE cl.character_uuid=?`).bind(uuid).all()).results||[];
  return rows.map(row=>({id:String(row.id||''),contentHash:String(row.content_hash||'')})).filter(row=>row.id);
}

export async function planDetachedLorebookCleanup(env,candidates,{excludingCharacterUuid=''}={}){
  const ids=uniq((candidates||[]).map(x=>x?.id)),candidateHashes=uniq((candidates||[]).map(x=>x?.contentHash)),entityIds=[],hashes=[...candidateHashes],excluded=String(excludingCharacterUuid||'').trim();
  for(const id of ids){
    const linked=excluded
      ?await env.DB.prepare(`SELECT 1 AS linked FROM character_lorebooks cl JOIN characters c ON c.janitor_uuid=cl.character_uuid WHERE cl.lorebook_id=? AND c.janitor_uuid!=? LIMIT 1`).bind(id,excluded).first()
      :await env.DB.prepare(`SELECT 1 AS linked FROM character_lorebooks cl JOIN characters c ON c.janitor_uuid=cl.character_uuid WHERE cl.lorebook_id=? LIMIT 1`).bind(id).first();
    if(linked)continue;
    const row=await env.DB.prepare('SELECT content_hash FROM lorebooks WHERE id=? LIMIT 1').bind(id).first();
    entityIds.push(id);
    const hash=String(row?.content_hash||'').trim();if(hash&&!hashes.includes(hash))hashes.push(hash);
  }
  const entitySet=new Set(entityIds),blobHashes=[];
  for(const hash of hashes){
    const rows=(await env.DB.prepare("SELECT id FROM lorebooks WHERE content_hash=? AND content_hash!=''").bind(hash).all()).results||[];
    const usedByRemaining=rows.some(row=>!entitySet.has(String(row.id||'')));
    if(!usedByRemaining)blobHashes.push(hash);
  }
  return{entityIds,blobHashes};
}

export function detachedLorebookCleanupStatements(env,plan){
  const entityIds=uniq(plan?.entityIds),blobHashes=uniq(plan?.blobHashes),statements=[];
  for(const id of entityIds){
    statements.push(env.DB.prepare(`DELETE FROM character_lorebooks WHERE lorebook_id=? AND NOT EXISTS(SELECT 1 FROM characters c WHERE c.janitor_uuid=character_lorebooks.character_uuid)`).bind(id));
    statements.push(env.DB.prepare(`DELETE FROM lorebook_sources WHERE lorebook_id=? AND NOT EXISTS(SELECT 1 FROM character_lorebooks cl JOIN characters c ON c.janitor_uuid=cl.character_uuid WHERE cl.lorebook_id=lorebook_sources.lorebook_id)`).bind(id));
    statements.push(env.DB.prepare(`DELETE FROM lorebooks WHERE id=? AND NOT EXISTS(SELECT 1 FROM character_lorebooks cl JOIN characters c ON c.janitor_uuid=cl.character_uuid WHERE cl.lorebook_id=lorebooks.id)`).bind(id));
  }
  for(const hash of blobHashes)statements.push(env.DB.prepare(`DELETE FROM lorebook_blobs WHERE content_hash=? AND NOT EXISTS(SELECT 1 FROM lorebooks WHERE content_hash=?)`).bind(hash,hash));
  return statements;
}

export async function cleanupDetachedLorebooks(env,candidates){
  const plan=await planDetachedLorebookCleanup(env,candidates);
  const statements=detachedLorebookCleanupStatements(env,plan);
  if(statements.length)await env.DB.batch(statements);
  return{entities:plan.entityIds.length,sources:plan.entityIds.length,blobs:plan.blobHashes.length};
}
