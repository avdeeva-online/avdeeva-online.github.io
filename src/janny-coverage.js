// Read-only measurement for the admin: how much of the catalog JannyAI could serve without a DataCat session.
// For a page of published bots it asks JannyAI's public download API (no key) whether each bot exists there and,
// with ?sample=1, downloads the card file and reports which fields it carries (description, greetings, tags,
// lorebook…), next to what our catalog has (lorebooks, avatar). Nothing is written anywhere.
import { extractEmbeddedCard } from './janny-card.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=v=>String(v??'').trim();
const isPng=b=>b.length>8&&b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71;
const BROWSER={'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36','origin':'https://jannyai.com','referer':'https://jannyai.com/','accept-language':'en-US,en;q=0.9'};
const has=v=>Array.isArray(v)?v.length>0:typeof v==='string'?v.trim().length>0:v!=null&&v!==false;

async function probe(uuid,{sample}){
  const out={uuid,found:false,status:0};
  const ask=headers=>fetch('https://api.jannyai.com/api/v1/download',{method:'POST',headers:{'content-type':'application/json','accept':'application/json',...headers},body:JSON.stringify({characterId:uuid}),redirect:'follow'});
  let res;
  try{
    res=await ask({'user-agent':'ARCHIVE.EXE/2.0'});
    // Refused: ask once more the way the jannyai.com page itself does, to tell "blocks servers" from "blocks this client".
    if(res.status===403){const again=await ask(BROWSER);out.browserStatus=again.status;if(again.ok){res=again;out.viaBrowserHeaders=true}}
  }catch(e){out.error=`FETCH_ERROR: ${clean(e?.message||e).slice(0,120)}`;return out}
  out.status=res.status;
  // Who refused and how: a bot-protection page (Cloudflare challenge) looks different from an API "not found".
  const text=await res.text().catch(()=>'');let data=null;try{data=JSON.parse(text)}catch{}
  if(!res.ok)out.refusal={server:clean(res.headers.get('server')),cfMitigated:clean(res.headers.get('cf-mitigated')),contentType:clean(res.headers.get('content-type')).split(';')[0],snippet:clean(text.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ')).slice(0,140)};
  out.responseKeys=data&&typeof data==='object'?Object.keys(data).slice(0,20):[];
  const url=clean(data?.downloadUrl||data?.download_url);
  if(!res.ok||!url){out.error=res.ok?'NO_DOWNLOAD_URL':`HTTP_${res.status}`;if(data?.error||data?.message)out.detail=clean(data.error||data.message).slice(0,160);return out}
  out.found=true;out.downloadHost=(()=>{try{return new URL(url).host}catch{return''}})();
  if(!sample)return out;
  try{
    const file=await fetch(url,{redirect:'follow'});out.fileStatus=file.status;
    const bytes=new Uint8Array(await file.arrayBuffer());out.fileBytes=bytes.length;
    if(!file.ok||!isPng(bytes)){out.fileError=file.ok?'NOT_PNG':`HTTP_${file.status}`;return out}
    const card=extractEmbeddedCard(bytes),d=card?.data||{};
    out.card={spec:clean(card?.spec),name:has(d.name),creator:has(d.creator),description:has(d.description),personality:has(d.personality),scenario:has(d.scenario),firstMes:has(d.first_mes),altGreetings:Array.isArray(d.alternate_greetings)?d.alternate_greetings.length:0,exampleDialogs:has(d.mes_example),creatorNotes:has(d.creator_notes),tags:Array.isArray(d.tags)?d.tags.length:0,lorebookEntries:Array.isArray(d.character_book?.entries)?d.character_book.entries.length:0,avatarInFile:true};
  }catch(e){out.fileError=`FETCH_ERROR: ${clean(e?.message||e).slice(0,120)}`}
  return out;
}

// GET /api/admin/janny-coverage?offset=0&limit=15&sample=1
export async function jannyCoverage(request,env){
  if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  const u=new URL(request.url),offset=Math.max(0,Number(u.searchParams.get('offset'))||0),limit=Math.min(15,Math.max(1,Number(u.searchParams.get('limit'))||15)),sample=u.searchParams.get('sample')==='1';
  const total=Number((await env.DB.prepare("SELECT COUNT(*) n FROM characters WHERE status='published'").first())?.n||0);
  const rows=(await env.DB.prepare("SELECT c.janitor_uuid,c.name,c.author,c.image_url,(SELECT COUNT(*) FROM character_lorebooks cl WHERE cl.character_uuid=c.janitor_uuid) AS lorebooks FROM characters c WHERE c.status='published' ORDER BY c.janitor_uuid LIMIT ? OFFSET ?").bind(limit,offset).all()).results||[];
  const results=[];
  for(let i=0;i<rows.length;i+=5){
    const part=rows.slice(i,i+5);
    results.push(...await Promise.all(part.map(async r=>({...await probe(r.janitor_uuid,{sample}),name:clean(r.name),author:clean(r.author),ourLorebooks:Number(r.lorebooks||0),ourAvatarHost:(()=>{try{return new URL(r.image_url).host}catch{return''}})()}))));
  }
  return json({ok:true,read_only:true,total,offset,limit,next:offset+rows.length<total?offset+rows.length:null,results});
}
