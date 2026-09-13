const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=v=>String(v??'').trim();
const arr=v=>Array.isArray(v)?v:[];
const safeJson=v=>{try{return JSON.stringify(v??[])}catch{return'[]'}};
const parseJson=(v,fallback=[])=>{try{const x=JSON.parse(v||'');return x??fallback}catch{return fallback}};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug=v=>clean(v).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'unknown';

let ready=null;
async function ensureSchema(env){
  if(ready)return ready;
  ready=(async()=>{
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS hub_resources (
      id TEXT PRIMARY KEY,
      source_url TEXT NOT NULL UNIQUE,
      source_type TEXT NOT NULL DEFAULT 'telegram',
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      creator_name TEXT NOT NULL DEFAULT '',
      creator_link TEXT NOT NULL DEFAULT '',
      description_short TEXT NOT NULL DEFAULT '',
      description_full TEXT NOT NULL DEFAULT '',
      models TEXT NOT NULL DEFAULT '[]',
      settings TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '[]',
      media TEXT NOT NULL DEFAULT '[]',
      confidence TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'published',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`).run();
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS hub_resource_files (
      id TEXT PRIMARY KEY,
      resource_id TEXT NOT NULL,
      name TEXT NOT NULL,
      mime TEXT NOT NULL DEFAULT 'application/octet-stream',
      size INTEGER NOT NULL DEFAULT 0,
      is_primary INTEGER NOT NULL DEFAULT 0,
      data BLOB,
      external_url TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS hub_resource_files_resource_idx ON hub_resource_files(resource_id)`).run();
  })();
  try{await ready}catch(e){ready=null;throw e}
  return ready;
}

function normalizeDraft(d){
  const source=d?.source||{};
  return {
    sourceUrl:clean(source.url),sourceType:clean(source.type)||'telegram',type:clean(d?.type).toLowerCase(),title:clean(d?.title),
    creatorName:clean(d?.creator?.name),creatorLink:clean(d?.creator?.link),
    short:clean(d?.description_short),full:clean(d?.description_full),models:arr(d?.models).map(clean).filter(Boolean),settings:arr(d?.settings).map(clean).filter(Boolean),tags:arr(d?.tags).map(clean).filter(Boolean),media:arr(d?.media),confidence:d?.confidence&&typeof d.confidence==='object'?d.confidence:{}
  };
}

async function parsePublishRequest(request){
  const ct=request.headers.get('content-type')||'';
  if(ct.includes('multipart/form-data')){
    const form=await request.formData();
    let draft={};try{draft=JSON.parse(String(form.get('resource')||'{}'))}catch{throw new Error('INVALID_RESOURCE_JSON')}
    const files=[];
    for(const [key,value] of form.entries()){
      if(key!=='files'||!(value instanceof File))continue;
      files.push(value);
    }
    return{draft,files};
  }
  let draft;try{draft=await request.json()}catch{throw new Error('INVALID_JSON')}
  return{draft,files:[]};
}

export async function publishHubResource(request,env){
  await ensureSchema(env);
  let parsed;try{parsed=await parsePublishRequest(request)}catch(e){return json({ok:false,error:String(e.message||e)},400)}
  const d=normalizeDraft(parsed.draft);
  if(!d.sourceUrl||!d.type||!d.title)return json({ok:false,error:'SOURCE_URL_TYPE_TITLE_REQUIRED'},400);
  const total=parsed.files.reduce((n,f)=>n+Number(f.size||0),0);
  if(parsed.files.some(f=>f.size>10*1024*1024)||total>25*1024*1024)return json({ok:false,error:'FILES_TOO_LARGE',limit:'10 MB per file / 25 MB total'},413);

  const old=await env.DB.prepare('SELECT id FROM hub_resources WHERE source_url=? LIMIT 1').bind(d.sourceUrl).first();
  const id=old?.id||crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO hub_resources(id,source_url,source_type,type,title,creator_name,creator_link,description_short,description_full,models,settings,tags,media,confidence,status,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'published',CURRENT_TIMESTAMP)
    ON CONFLICT(source_url) DO UPDATE SET source_type=excluded.source_type,type=excluded.type,title=excluded.title,creator_name=excluded.creator_name,creator_link=excluded.creator_link,description_short=excluded.description_short,description_full=excluded.description_full,models=excluded.models,settings=excluded.settings,tags=excluded.tags,media=excluded.media,confidence=excluded.confidence,status='published',updated_at=CURRENT_TIMESTAMP`)
    .bind(id,d.sourceUrl,d.sourceType,d.type,d.title,d.creatorName,d.creatorLink,d.short,d.full,safeJson(d.models),safeJson(d.settings),safeJson(d.tags),safeJson(d.media),JSON.stringify(d.confidence||{})).run();

  if(parsed.files.length){
    await env.DB.prepare('DELETE FROM hub_resource_files WHERE resource_id=? AND data IS NOT NULL').bind(id).run();
    const primaryIndex=Math.max(0,Number(parsed.draft?.primary_file_index||0));
    for(let i=0;i<parsed.files.length;i++){
      const f=parsed.files[i],buf=await f.arrayBuffer();
      await env.DB.prepare(`INSERT INTO hub_resource_files(id,resource_id,name,mime,size,is_primary,data,external_url) VALUES(?,?,?,?,?,?,?,'')`)
        .bind(crypto.randomUUID(),id,clean(f.name)||`file-${i+1}`,clean(f.type)||'application/octet-stream',f.size,i===primaryIndex?1:0,buf).run();
    }
  }
  return json({ok:true,id,updated:Boolean(old),files:parsed.files.length});
}

export async function listHubResources(env){
  await ensureSchema(env);
  const res=await env.DB.prepare(`SELECT r.*, (SELECT id FROM hub_resource_files f WHERE f.resource_id=r.id ORDER BY is_primary DESC,created_at ASC LIMIT 1) primary_file_id,
    (SELECT COUNT(*) FROM hub_resource_files f WHERE f.resource_id=r.id) file_count
    FROM hub_resources r WHERE status='published' ORDER BY updated_at DESC`).all();
  const items=(res.results||[]).map(r=>({id:r.id,source_url:r.source_url,type:r.type,title:r.title,creator:{name:r.creator_name,link:r.creator_link},description_short:r.description_short,description_full:r.description_full,models:parseJson(r.models),settings:parseJson(r.settings),tags:parseJson(r.tags),media:parseJson(r.media),primary_file_id:r.primary_file_id||null,file_count:Number(r.file_count||0),updated_at:r.updated_at}));
  return json({ok:true,resources:items,count:items.length});
}

export async function downloadHubFile(env,resourceId,fileId){
  await ensureSchema(env);
  const row=await env.DB.prepare('SELECT name,mime,size,data,external_url FROM hub_resource_files WHERE id=? AND resource_id=? LIMIT 1').bind(fileId,resourceId).first();
  if(!row)return json({ok:false,error:'FILE_NOT_FOUND'},404);
  if(row.external_url)return Response.redirect(row.external_url,302);
  if(row.data==null)return json({ok:false,error:'FILE_DATA_MISSING'},404);
  const headers=new Headers({'content-type':row.mime||'application/octet-stream','cache-control':'public, max-age=3600'});
  headers.set('content-disposition',`attachment; filename*=UTF-8''${encodeURIComponent(row.name||'download')}`);
  return new Response(row.data,{status:200,headers});
}

function coverUrl(media){
  const list=arr(media);const c=list.find(x=>x&&x.cover)||list[0];return clean(c?.url||c?.src);
}
function dynamicCard(r){
  const type=clean(r.type)||'other',plural=type.endsWith('s')?type:`${type}s`,creator=clean(r.creator_name)||'UNKNOWN',models=parseJson(r.models),settings=parseJson(r.settings),tags=[...models,...settings,...parseJson(r.tags)].slice(0,6),cover=coverUrl(parseJson(r.media));
  const thumb=cover?`<div class="thumb" style="background-image:url('${esc(cover).replace(/'/g,'%27')}');background-size:cover;background-position:center"></div>`:`<div class="thumb b"></div>`;
  const tagHtml=tags.length?`<div class="card-tags">${tags.map(t=>`<span class="card-tag">${esc(String(t).replaceAll('-',' ').toUpperCase())}</span>`).join('')}</div>`:'';
  const download=r.primary_file_id?`<a class="action" href="/api/hub-resources/${encodeURIComponent(r.id)}/files/${encodeURIComponent(r.primary_file_id)}" title="Download">⇩</a>`:`<a class="action" href="${esc(r.source_url)}" target="_blank" rel="noopener noreferrer" title="Open source">↗</a>`;
  return `<article class="resource-card" data-dynamic="1" data-creator="${esc(slug(creator))}" data-creator-name="${esc(creator.toUpperCase())}" data-type="${esc(plural)}" data-model="${esc(models.join(' '))}" data-setting="${esc(settings.join(' '))}">${thumb}<div class="card-body"><div class="type">// ${esc(type.toUpperCase())}</div><h3>${esc(r.title)}</h3><p>${esc(r.description_short||r.description_full||'')}</p>${tagHtml}<div class="meta"><span>${Number(r.file_count||0)?`${Number(r.file_count)} FILE${Number(r.file_count)===1?'':'S'} | `:''}<span class="free">● FREE</span></span>${download}</div></div></article>`;
}

export async function injectHubResources(response,env){
  if(!response.ok)return response;
  await ensureSchema(env);
  const res=await env.DB.prepare(`SELECT r.*, (SELECT id FROM hub_resource_files f WHERE f.resource_id=r.id ORDER BY is_primary DESC,created_at ASC LIMIT 1) primary_file_id,
    (SELECT COUNT(*) FROM hub_resource_files f WHERE f.resource_id=r.id) file_count FROM hub_resources r WHERE status='published' ORDER BY updated_at DESC`).all();
  if(!(res.results||[]).length)return response;
  const html=await response.text();
  const cards=(res.results||[]).map(dynamicCard).join('\n');
  const marker='</div></div></div>\n<footer class="statusbar">';
  if(!html.includes(marker))return new Response(html,{status:response.status,headers:response.headers});
  const out=html.replace(marker,`${cards}\n</div></div></div>\n<footer class="statusbar">`);
  const headers=new Headers(response.headers);headers.delete('content-length');headers.set('cache-control','no-store');
  return new Response(out,{status:response.status,statusText:response.statusText,headers});
}
