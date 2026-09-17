const checks=new Map();

export async function requireD1Schema(env,key,probeSql){
  if(checks.has(key))return checks.get(key);
  const pending=(async()=>{
    if(!env?.DB?.prepare)throw new Error('D1_BINDING_REQUIRED');
    try{await env.DB.prepare(probeSql).first()}
    catch(e){throw new Error(`D1_MIGRATION_REQUIRED:${key}:${String(e?.message||e)}`)}
  })();
  checks.set(key,pending);
  try{await pending}catch(e){checks.delete(key);throw e}
  return pending;
}
