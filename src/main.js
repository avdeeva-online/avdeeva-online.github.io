import app from './entry.js';

function json(data,status=200){return new Response(JSON.stringify(data,null,2),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
function strip(v){return String(v||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim()}
function parseCharacters(html,creatorId){
  const out=new Map(); let m;
  const text=String(html||'').replace(/\\\//g,'/');
  const link=/href=["']([^"']*\/characters\/recent\/janitor\/([0-9a-f-]{36})[^"']*)["'][^>]*>([\s\S]{0,1600}?)<\/a>/ig;
  while((m=link.exec(text))){const id=m[2].toLowerCase();if(id===creatorId)continue;const name=strip(m[3])||id;if(!out.has(id))out.set(id,{id,name})}
  const loose=/\/characters\/recent\/janitor\/([0-9a-f-]{36})/ig;
  while((m=loose.exec(text))){const id=m[1].toLowerCase();if(id!==creatorId&&!out.has(id))out.set(id,{id,name:id})}
  return [...out.values()];
}
async function fetchVariant(url,ua){
  const r=await fetch(url,{redirect:'follow',headers:{'accept':'text/html,application/xhtml+xml','user-agent':ua,'accept-language':'en-US,en;q=0.9'}});
  const body=await r.text();
  return{status:r.status,ok:r.ok,body,bytes:body.length,contentType:r.headers.get('content-type')||''};
}
async function scan(request){
  const u=new URL(request.url),raw=u.searchParams.get('url');
  if(!raw)return json({ok:false,error:'MISSING_CREATOR_URL'},400);
  let base;try{base=new URL(raw)}catch{return json({ok:false,error:'INVALID_CREATOR_URL'},400)}
  const mm=base.pathname.match(/^\/creators\/janitor\/([0-9a-f-]{36})\/?$/i);
  if(base.protocol!=='https:'||base.hostname!=='datacat.run'||!mm)return json({ok:false,error:'DATACAT_CREATOR_URL_REQUIRED'},400);
  const creatorId=mm[1].toLowerCase(),found=new Map(),diagnostics=[];
  const agents=[
    ['googlebot','Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
    ['bingbot','Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'],
    ['browser','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36']
  ];
  let pagesScanned=0,totalHint=null;
  try{
    for(let page=1;page<=50;page++){
      const target=new URL(base.toString());target.searchParams.set('page',String(page));
      let pageItems=[];
      for(const [label,ua] of agents){
        const res=await fetchVariant(target.toString(),ua);
        const items=res.ok?parseCharacters(res.body,creatorId):[];
        const range=strip(res.body).match(/(\d+)\s*[-–]\s*(\d+)\s+of\s+(\d+)/i);
        if(range)totalHint=Number(range[3]);
        diagnostics.push({page,variant:label,status:res.status,bytes:res.bytes,characters:items.length,hasCreatorCharacters:/Creator characters/i.test(res.body)});
        if(items.length>pageItems.length)pageItems=items;
      }
      pagesScanned=page;
      let added=0;for(const x of pageItems){if(!found.has(x.id)){found.set(x.id,x);added++}}
      if(totalHint&&found.size>=totalHint)break;
      if(!added){if(page===1)break;break}
      if(pageItems.length<24&&!totalHint)break;
    }
    return json({ok:true,creatorId,count:found.size,pagesScanned,totalHint,characters:[...found.values()],diagnostics});
  }catch(e){return json({ok:false,error:'DATACAT_CREATOR_SCAN_ERROR',message:String(e?.message||e),pagesScanned,diagnostics},502)}
}

function arr(v){try{const x=JSON.parse(v||'[]');return Array.isArray(x)?x:[]}catch{return[]}}
function clean(v){return String(v||'').replace(/\s+/g,' ').trim()}
function universeList(row){const raw=arr(row?.universes);const source=raw.length?raw:[row?.universe];const seen=new Set(),out=[];for(const v of source){const s=clean(v);const k=universeKey(s);if(!s||!k||seen.has(k))continue;seen.add(k);out.push(s)}return out}
function universeKey(v){return clean(v).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,'')}
function hashtagLabel(v){return clean(v).replace(/^#+/,'').trim()}
function candidateLabelFromName(name,hash){const key=universeKey(hash);if(!key)return'';const parts=clean(name).split(/\s*(?:\||\/|—|–|•|:)\s*/).map(clean).filter(Boolean);const exact=parts.find(p=>universeKey(p)===key);if(exact)return exact;const contained=parts.filter(p=>universeKey(p).includes(key)).sort((a,b)=>a.length-b.length)[0];return contained||hashtagLabel(hash)}
const GENERIC_REVIEW_TAGS=new Set(['male','female','oc','anypov','fempov','femalepov','malepov','dominant','submissive','switch','angst','fluff','smut','nsfw','sfw','alt','au']);
async function ensureUniverseReviewSchema(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS admin_universe_review (
    review_key TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'ignored',
    note TEXT DEFAULT '',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();
}
async function clearCatalogCache(request){
  const cache=globalThis.caches?.default;if(!cache)return;
  const u=new URL(request.url);
  await Promise.all([500,1000].map(limit=>{const key=new URL(u.origin);key.pathname='/__archive_cache/catalog-v6';key.search=`?limit=${limit}`;return cache.delete(new Request(key.toString(),{method:'GET'}))}));
}
async function universeReview(request,env){
  await ensureUniverseReviewSchema(env);
  const res=await env.DB.prepare(`SELECT janitor_uuid,name,author,hashtags,universe,universes FROM characters WHERE status='published' ORDER BY author,name`).all();
  const rows=Array.isArray(res?.results)?res.results:[];
  const existing=new Map(),authorExisting=new Map();
  for(const row of rows){for(const u of universeList(row)){const key=universeKey(u);if(!existing.has(key))existing.set(key,u);const ak=clean(row.author).toLocaleLowerCase();if(!authorExisting.has(ak))authorExisting.set(ak,new Map());authorExisting.get(ak).set(key,existing.get(key)||u)}}
  const decisions=(await env.DB.prepare(`SELECT review_key,status,note FROM admin_universe_review`).all())?.results||[];
  const ignored=new Set(decisions.filter(x=>x.status==='ignored').map(x=>x.review_key));
  const flags=new Map(decisions.filter(x=>x.status==='flagged').map(x=>[x.review_key,x.note||'']));
  const candidates=[];
  for(const row of rows){
    const current=universeList(row),currentKeys=new Set(current.map(universeKey)),authorKey=clean(row.author).toLocaleLowerCase();
    const tags=arr(row.hashtags).map(hashtagLabel).filter(Boolean);
    const titleKey=universeKey(row.name);
    for(const tag of tags){
      const hk=universeKey(tag);if(!hk||hk.length<4||GENERIC_REVIEW_TAGS.has(hk)||currentKeys.has(hk))continue;
      const sameAuthor=authorExisting.get(authorKey)?.get(hk)||'';
      const global=existing.get(hk)||'';
      const inTitle=titleKey.includes(hk);
      if(!inTitle&&!sameAuthor&&!global)continue;
      const proposed=global||sameAuthor||candidateLabelFromName(row.name,tag);
      const reviewKey=`candidate:${row.janitor_uuid}:${universeKey(proposed)}`;
      if(ignored.has(reviewKey))continue;
      const confidence=inTitle?'HIGH':sameAuthor?'MEDIUM':'LOW';
      const reasons=[];if(inTitle)reasons.push('TITLE + HASHTAG');if(sameAuthor)reasons.push('HASHTAG = EXISTING UNIVERSE / SAME AUTHOR');else if(global)reasons.push('HASHTAG = EXISTING UNIVERSE');
      candidates.push({reviewKey,uuid:row.janitor_uuid,name:row.name,author:row.author,currentUniverses:current,hashtag:`#${tag}`,proposedUniverse:proposed,confidence,reasons});
    }
  }
  const confidenceRank={HIGH:0,MEDIUM:1,LOW:2};
  candidates.sort((a,b)=>(confidenceRank[a.confidence]??99)-(confidenceRank[b.confidence]??99)||a.author.localeCompare(b.author)||a.proposedUniverse.localeCompare(b.proposedUniverse)||a.name.localeCompare(b.name));
  const groups=new Map();
  for(const row of rows){for(const u of universeList(row)){const key=universeKey(u);if(!groups.has(key))groups.set(key,{name:existing.get(key)||u,count:0,authors:new Set(),bots:[]});const g=groups.get(key);g.count++;g.authors.add(row.author);if(g.bots.length<8)g.bots.push({uuid:row.janitor_uuid,name:row.name,author:row.author})}}
  const universes=[...groups.entries()].map(([key,g])=>({name:g.name,count:g.count,authors:[...g.authors].sort(),bots:g.bots,flagged:flags.has(`flag:${key}`),note:flags.get(`flag:${key}`)||''})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
  return json({ok:true,candidates,universes,counts:{candidates:candidates.length,universes:universes.length}});
}
async function updateCharacterUniverses(env,uuid,values){
  const cleaned=[],seen=new Set();for(const v of values||[]){const s=clean(v);const k=universeKey(s);if(!s||!k||seen.has(k))continue;seen.add(k);cleaned.push(s)}
  const row=await env.DB.prepare('SELECT janitor_uuid FROM characters WHERE janitor_uuid=? LIMIT 1').bind(uuid).first();if(!row)return false;
  await env.DB.prepare(`UPDATE characters SET universe=?,universes=?,universe_source_field='admin:manual',updated_at=CURRENT_TIMESTAMP WHERE janitor_uuid=?`).bind(cleaned[0]||'',JSON.stringify(cleaned),uuid).run();return true;
}
async function applyUniverseReview(request,env){
  await ensureUniverseReviewSchema(env);
  let body=null;try{body=await request.json()}catch{return json({ok:false,error:'INVALID_JSON'},400)}
  const action=clean(body?.action);
  if(action==='confirm'){
    const uuid=clean(body.uuid),value=clean(body.universe);if(!uuid||!value)return json({ok:false,error:'UUID_AND_UNIVERSE_REQUIRED'},400);
    const row=await env.DB.prepare('SELECT universe,universes FROM characters WHERE janitor_uuid=? LIMIT 1').bind(uuid).first();if(!row)return json({ok:false,error:'CHARACTER_NOT_FOUND'},404);
    const list=universeList(row);if(!list.some(x=>universeKey(x)===universeKey(value)))list.push(value);
    await updateCharacterUniverses(env,uuid,list);
    const key=`candidate:${uuid}:${universeKey(value)}`;await env.DB.prepare(`DELETE FROM admin_universe_review WHERE review_key=?`).bind(key).run();await clearCatalogCache(request);
    return json({ok:true,action,uuid,universes:list});
  }
  if(action==='ignore'){
    const key=clean(body.reviewKey);if(!key)return json({ok:false,error:'REVIEW_KEY_REQUIRED'},400);
    await env.DB.prepare(`INSERT INTO admin_universe_review(review_key,status,note,updated_at) VALUES(?,'ignored','',CURRENT_TIMESTAMP) ON CONFLICT(review_key) DO UPDATE SET status='ignored',updated_at=CURRENT_TIMESTAMP`).bind(key).run();
    return json({ok:true,action,reviewKey:key});
  }
  if(action==='flag'||action==='unflag'){
    const name=clean(body.universe),key=`flag:${universeKey(name)}`;if(!name)return json({ok:false,error:'UNIVERSE_REQUIRED'},400);
    if(action==='unflag')await env.DB.prepare('DELETE FROM admin_universe_review WHERE review_key=?').bind(key).run();else await env.DB.prepare(`INSERT INTO admin_universe_review(review_key,status,note,updated_at) VALUES(?,'flagged',?,CURRENT_TIMESTAMP) ON CONFLICT(review_key) DO UPDATE SET status='flagged',note=excluded.note,updated_at=CURRENT_TIMESTAMP`).bind(key,clean(body.note)).run();
    return json({ok:true,action,universe:name});
  }
  if(action==='replace'){
    const from=clean(body.from),targets=Array.isArray(body.to)?body.to:String(body.to||'').split(',').map(clean).filter(Boolean);if(!from||!targets.length)return json({ok:false,error:'FROM_AND_TO_REQUIRED'},400);
    const res=await env.DB.prepare(`SELECT janitor_uuid,universe,universes FROM characters WHERE status='published'`).all(),rows=Array.isArray(res?.results)?res.results:[],updates=[];let changed=0;
    for(const row of rows){const list=universeList(row);if(!list.some(v=>universeKey(v)===universeKey(from)))continue;const next=[];for(const v of list){if(universeKey(v)===universeKey(from))next.push(...targets);else next.push(v)}updates.push(updateCharacterUniverses(env,row.janitor_uuid,next));changed++}
    await Promise.all(updates);await clearCatalogCache(request);return json({ok:true,action,from,to:targets,changed});
  }
  if(action==='set'){
    const uuid=clean(body.uuid),values=Array.isArray(body.universes)?body.universes:String(body.universes||'').split(',').map(clean).filter(Boolean);if(!uuid)return json({ok:false,error:'UUID_REQUIRED'},400);const ok=await updateCharacterUniverses(env,uuid,values);if(!ok)return json({ok:false,error:'CHARACTER_NOT_FOUND'},404);await clearCatalogCache(request);return json({ok:true,action,uuid,universes:values});
  }
  return json({ok:false,error:'UNKNOWN_ACTION'},400);
}

export default{async fetch(request,env,ctx){
  const u=new URL(request.url);
  if(request.method==='GET'&&u.pathname==='/api/admin/creator-scan')return scan(request);
  if(request.method==='GET'&&u.pathname==='/api/admin/universe-review')return universeReview(request,env);
  if(request.method==='POST'&&u.pathname==='/api/admin/universe-review')return applyUniverseReview(request,env);
  return app.fetch(request,env,ctx)
}};
