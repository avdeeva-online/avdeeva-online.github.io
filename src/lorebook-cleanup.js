const uniq=v=>[...new Set((Array.isArray(v)?v:[]).map(x=>String(x||'').trim()).filter(Boolean))];

export async function linkedLorebooksForCharacter(env,uuid){
  const rows=(await env.DB.prepare(`SELECT l.id,l.content_hash FROM character_lorebooks cl JOIN lorebooks l ON l.id=cl.lorebook_id WHERE cl.character_uuid=?`).bind(uuid).all()).results||[];
  return rows.map(row=>({id:String(row.id||''),contentHash:String(row.content_hash||'')})).filter(row=>row.id);
}

export async function cleanupDetachedLorebooks(env,candidates){
  const ids=uniq((candidates||[]).map(x=>x?.id)),hashes=uniq((candidates||[]).map(x=>x?.contentHash));
  let entities=0,sources=0,blobs=0;
  for(const id of ids){
    const linked=await env.DB.prepare('SELECT 1 AS linked FROM character_lorebooks WHERE lorebook_id=? LIMIT 1').bind(id).first();
    if(linked)continue;
    const row=await env.DB.prepare('SELECT content_hash FROM lorebooks WHERE id=? LIMIT 1').bind(id).first();
    await env.DB.prepare('DELETE FROM lorebook_sources WHERE lorebook_id=?').bind(id).run();sources++;
    await env.DB.prepare('DELETE FROM lorebooks WHERE id=?').bind(id).run();entities++;
    const hash=String(row?.content_hash||'').trim();if(hash&&!hashes.includes(hash))hashes.push(hash);
  }
  for(const hash of hashes){
    const used=await env.DB.prepare("SELECT 1 AS used FROM lorebooks WHERE content_hash=? AND content_hash!='' LIMIT 1").bind(hash).first();
    if(used)continue;
    await env.DB.prepare('DELETE FROM lorebook_blobs WHERE content_hash=?').bind(hash).run();blobs++;
  }
  return{entities,sources,blobs};
}
