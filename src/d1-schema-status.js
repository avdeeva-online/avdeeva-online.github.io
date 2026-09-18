export const D1_EXPECTED_SCHEMA={
  characters:['id','janitor_uuid','slug','name','author','author_url','universe','pov','tags','hashtags','short_description','description','scenario','intros','image_url','janitor_url','datacat_url','card_url','lorebook_url','lorebook_title','universe_source_field','universes','setting_ids','setting_source','source','status','created_at','updated_at'],
  lorebooks:['id','title','script','author','source','content_hash','source_identity','created_at','updated_at'],
  lorebook_blobs:['content_hash','script','created_at','updated_at'],
  lorebook_sources:['source_identity','lorebook_id','updated_at'],
  character_lorebooks:['character_uuid','lorebook_id','ordinal'],
  hub_resources:['id','source_url','source_type','type','title','creator_name','creator_link','description_short','description_full','additional_info','models','settings','tags','media','confidence','status','created_at','updated_at'],
  hub_resource_files:['id','resource_id','name','mime','size','is_primary','data','external_url','storage','r2_key','created_at'],
  hub_resource_file_chunks:['file_id','chunk_index','data'],
  hub_resource_publish_sessions:['id','resource_id','was_existing','backup','created_at','updated_at'],
  hub_resource_publish_files:['session_id','file_id','replace_old_id','is_primary'],
  telegram_admin_drafts:['id','source_url','payload','status','created_at','updated_at'],
  telegram_admin_import_session:['admin_user_id','channel','draft_id','last_post_id','updated_at'],
  hub_suggestions:['id','url','note','status','created_at','updated_at'],
  universe_curation:['source_key','source_value','public_universes','parent_universe','subuniverse','active','note','updated_at'],
  admin_universe_review:['review_key','status','note','updated_at'],
  archive_schema:['version','applied_at']
};

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const rows=result=>Array.isArray(result?.results)?result.results:[];
const quoteIdentifier=value=>'"'+String(value).replace(/"/g,'""')+'"';

async function tableInfo(env,table){return rows(await env.DB.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all())}
async function characterIdentity(env,columns){
  const id=columns.find(c=>c.name==='id'),uuid=columns.find(c=>c.name==='janitor_uuid');
  const indexes=rows(await env.DB.prepare('PRAGMA index_list("characters")').all());
  let uuidUnique=false;
  for(const index of indexes.filter(x=>Number(x.unique)===1)){
    const name=String(index.name||'');if(!name)continue;
    const info=rows(await env.DB.prepare(`PRAGMA index_info(${quoteIdentifier(name)})`).all());
    const names=info.map(x=>String(x.name||''));
    if(names.length===1&&names[0]==='janitor_uuid'){uuidUnique=true;break}
  }
  return{
    id_present:Boolean(id),
    id_integer:String(id?.type||'').toUpperCase()==='INTEGER',
    id_primary_key:Number(id?.pk||0)===1,
    janitor_uuid_present:Boolean(uuid),
    janitor_uuid_unique:uuidUnique,
    ok:Boolean(id)&&String(id?.type||'').toUpperCase()==='INTEGER'&&Number(id?.pk||0)===1&&Boolean(uuid)&&uuidUnique
  };
}

export async function d1SchemaStatus(env){
  if(!env.DB)return json({ok:false,error:'D1_BINDING_MISSING'},503);
  const tables={};let missingTotal=0;
  for(const [table,expected] of Object.entries(D1_EXPECTED_SCHEMA)){
    try{
      const info=await tableInfo(env,table),present=info.map(x=>String(x.name||'')),missing=expected.filter(name=>!present.includes(name));
      missingTotal+=missing.length;
      tables[table]={exists:info.length>0,columns:present,missing};
    }catch(e){
      missingTotal+=expected.length;
      tables[table]={exists:false,columns:[],missing:expected,error:String(e?.message||e)};
    }
  }
  let identity={ok:false,error:'characters table unavailable'};
  try{identity=await characterIdentity(env,await tableInfo(env,'characters'))}catch(e){identity={ok:false,error:String(e?.message||e)}}
  return json({ok:missingTotal===0&&identity.ok,read_only:true,missing_columns:missingTotal,characters_identity:identity,tables});
}
