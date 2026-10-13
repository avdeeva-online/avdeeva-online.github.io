// Read-only admin check: what DataCat says about a bot's lorebooks (scripts), without their text.
// Used to learn which field holds the JanitorAI script id (janitorai.com/scripts/<id>) and how a lorebook that is
// closed on JanitorAI is marked, before lorebook buttons are switched to links. Nothing is written anywhere.
import { fetchDatacatPublic } from './worker.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=v=>String(v??'').trim();
const UUID=/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// Every field of a script except its text; long values cut, nested objects summarised.
function describe(s){
  const out={};
  for(const[k,v]of Object.entries(s||{})){
    if(k==='script'){out.scriptLength=typeof v==='string'?v.length:0;continue}
    out[k]=v==null||typeof v==='boolean'||typeof v==='number'?v:typeof v==='string'?v.slice(0,120):Array.isArray(v)?`[${v.length}]`:`{${Object.keys(v).slice(0,12).join(',')}}`;
  }
  return out;
}

async function botReport(env,uuid){
  const stored=(await env.DB.prepare(`SELECT l.title,l.source_identity FROM character_lorebooks cl JOIN lorebooks l ON l.id=cl.lorebook_id WHERE cl.character_uuid=? ORDER BY cl.ordinal`).bind(uuid).all()).results||[];
  const row=await env.DB.prepare('SELECT name FROM characters WHERE janitor_uuid=? LIMIT 1').bind(uuid).first();
  const modal=await fetchDatacatPublic(env,uuid);
  if(modal.state!=='FOUND')return{uuid,name:clean(row?.name),datacat:modal.state,status:modal.status||null,stored};
  const c=modal.data?.character||modal.data||{},scripts=Array.isArray(c.scripts)?c.scripts:[];
  return{uuid,name:clean(row?.name||c.name),datacat:'FOUND',characterKeys:Object.keys(c).filter(k=>/script|lore|public|code/i.test(k)),scripts:scripts.map(describe),stored};
}

// GET /api/admin/lorebook-source?q=<JanitorAI bot link | JanitorAI script link | uuid>
export async function lorebookSourceCheck(request,env){
  if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  const q=clean(new URL(request.url).searchParams.get('q')),id=(q.match(UUID)||[])[0]?.toLowerCase();
  if(!id)return json({ok:false,error:'LINK_OR_UUID_REQUIRED'},400);
  const summary=(await env.DB.prepare(`SELECT COUNT(*) total,SUM(CASE WHEN COALESCE(source_identity,'')<>'' THEN 1 ELSE 0 END) with_identity FROM lorebooks`).first())||{};
  const prefixes=(await env.DB.prepare(`SELECT substr(source_identity,1,instr(source_identity,':')-1) k,COUNT(*) n FROM lorebooks WHERE instr(COALESCE(source_identity,''),':')>0 GROUP BY k ORDER BY n DESC`).all()).results||[];
  let bots=[id],matchedScript=null;
  if(/\/scripts\//i.test(q)){
    const rows=(await env.DB.prepare(`SELECT l.title,l.source_identity,cl.character_uuid FROM lorebooks l LEFT JOIN character_lorebooks cl ON cl.lorebook_id=l.id WHERE lower(l.source_identity) LIKE ? LIMIT 3`).bind(`%${id}`).all()).results||[];
    matchedScript={scriptId:id,inOurDatabase:rows.length>0,title:clean(rows[0]?.title),sourceIdentity:clean(rows[0]?.source_identity)};
    bots=[...new Set(rows.map(r=>clean(r.character_uuid)).filter(Boolean))];
  }
  const reports=[];for(const b of bots.slice(0,3))reports.push(await botReport(env,b));
  return json({ok:true,read_only:true,query:q,lorebooksInDatabase:{total:Number(summary.total||0),withSourceId:Number(summary.with_identity||0),idFields:prefixes},matchedScript,bots:reports});
}
