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
      let pageItems=[],chosen=null;
      for(const [label,ua] of agents){
        const res=await fetchVariant(target.toString(),ua);
        const items=res.ok?parseCharacters(res.body,creatorId):[];
        const range=strip(res.body).match(/(\d+)\s*[-–]\s*(\d+)\s+of\s+(\d+)/i);
        if(range)totalHint=Number(range[3]);
        diagnostics.push({page,variant:label,status:res.status,bytes:res.bytes,characters:items.length,hasCreatorCharacters:/Creator characters/i.test(res.body)});
        if(items.length>pageItems.length){pageItems=items;chosen=label}
      }
      pagesScanned=page;
      let added=0;for(const x of pageItems){if(!found.has(x.id)){found.set(x.id,x);added++}}
      if(totalHint&&found.size>=totalHint)break;
      if(!added){
        // If page 1 has no bot links in any representation, further pages will not help.
        if(page===1)break;
        break;
      }
      if(pageItems.length<24&&!totalHint)break;
    }
    return json({ok:true,creatorId,count:found.size,pagesScanned,totalHint,characters:[...found.values()],diagnostics});
  }catch(e){return json({ok:false,error:'DATACAT_CREATOR_SCAN_ERROR',message:String(e?.message||e),pagesScanned,diagnostics},502)}
}

export default{async fetch(request,env,ctx){const u=new URL(request.url);if(request.method==='GET'&&u.pathname==='/api/admin/creator-scan')return scan(request);return app.fetch(request,env,ctx)}};
