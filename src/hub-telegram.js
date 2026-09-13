const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

function parseTelegramUrl(raw){
  try{
    const u=new URL(String(raw||'').trim());
    if(!/(^|\.)t\.me$/.test(u.hostname))return null;
    let p=u.pathname.replace(/^\/s\//,'/').replace(/\/$/,'');
    const m=p.match(/^\/([^/]+)\/(\d+)$/);
    if(!m)return null;
    return {channel:m[1],postId:m[2],url:`https://t.me/${m[1]}/${m[2]}`};
  }catch{return null}
}

function decodeHtml(s=''){
  const map={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
  return String(s)
    .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g,(_,n)=>map[n]||_);
}

function htmlToText(html=''){
  return decodeHtml(String(html)
    .replace(/<br\s*\/?>/gi,'\n')
    .replace(/<\/p\s*>/gi,'\n')
    .replace(/<\/div\s*>/gi,'\n')
    .replace(/<[^>]+>/g,''))
    .replace(/\u00a0/g,' ')
    .replace(/[ \t]+\n/g,'\n')
    .replace(/\n{3,}/g,'\n\n')
    .trim();
}

function attr(html,name){
  const re1=new RegExp(`<meta[^>]+(?:property|name)=["']${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}["'][^>]+content=["']([^"']*)["'][^>]*>`,'i');
  const re2=new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}["'][^>]*>`,'i');
  const m=String(html).match(re1)||String(html).match(re2);return m?decodeHtml(m[1]):'';
}
function uniq(arr){return [...new Set((arr||[]).filter(Boolean))]}

function extractBlock(html,channel,postId){
  const escaped=String(channel).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const markerRe=new RegExp(`data-post=["']${escaped}/${postId}["']`,'i');
  const m=markerRe.exec(html);if(!m)return html;
  const idx=m.index;
  const startCandidates=[html.lastIndexOf('<div class="tgme_widget_message_wrap',idx),html.lastIndexOf("<div class='tgme_widget_message_wrap",idx)].filter(x=>x>=0);
  const start=startCandidates.length?Math.max(...startCandidates):Math.max(0,idx-6000);
  const nextDouble=html.indexOf('<div class="tgme_widget_message_wrap',idx+m[0].length);
  const nextSingle=html.indexOf("<div class='tgme_widget_message_wrap",idx+m[0].length);
  const next=[nextDouble,nextSingle].filter(x=>x>idx).sort((a,b)=>a-b)[0];
  return html.slice(start,next||Math.min(html.length,idx+120000));
}

function extractMessageText(block,fullHtml){
  const start=block.search(/<div class=["'][^"']*tgme_widget_message_text[^"']*["'][^>]*>/i);
  if(start>=0){
    const openEnd=block.indexOf('>',start);
    const endMarkers=[
      '<div class="tgme_widget_message_footer',"<div class='tgme_widget_message_footer",
      '<div class="tgme_widget_message_info',"<div class='tgme_widget_message_info",
      '<a class="tgme_widget_message_date',"<a class='tgme_widget_message_date"
    ];
    let end=block.length;
    for(const marker of endMarkers){const i=block.indexOf(marker,openEnd+1);if(i>=0&&i<end)end=i}
    const text=htmlToText(block.slice(openEnd+1,end));
    if(text)return text;
  }
  return htmlToText(attr(fullHtml,'og:description')||attr(fullHtml,'twitter:description'));
}

function extractAuthor(block,fullHtml,parsed){
  const m=block.match(/<div class=["'][^"']*tgme_widget_message_author[^"']*["'][^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i);
  const fromBlock=htmlToText(m?.[1]||'');
  if(fromBlock)return fromBlock;
  const title=(attr(fullHtml,'og:title')||attr(fullHtml,'twitter:title')).replace(/\s*[–—-]\s*Telegram\s*$/i,'').trim();
  return title||parsed.channel;
}

function extractMedia(block,fullHtml){
  const out=[];
  for(const m of block.matchAll(/background-image\s*:\s*url\((?:&quot;|['"])?([^)'"&]+|https?:[^)]+?)(?:&quot;|['"])?\)/gi))out.push(decodeHtml(m[1]).trim());
  for(const m of block.matchAll(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/gi))out.push(decodeHtml(m[1]).trim());
  for(const m of block.matchAll(/(?:href|data-href)=["'](https?:\/\/[^"']+\.(?:jpe?g|png|webp)(?:\?[^"']*)?)["']/gi))out.push(decodeHtml(m[1]).trim());
  out.push(attr(fullHtml,'og:image'),attr(fullHtml,'twitter:image'));
  return uniq(out.map(x=>x.replace(/&amp;/g,'&')).filter(x=>/^https?:\/\//i.test(x)&&!/emoji|favicon|telegram-logo/i.test(x)));
}

function infer(text){
  const t=String(text||'').toLowerCase();
  const has=(...xs)=>xs.some(x=>t.includes(x));
  let type='other';
  if(has('preset','пресет'))type='preset';
  else if(has('plugin','плагин'))type='plugin';
  else if(has('theme','тема'))type='theme';
  else if(has('гайд','guide','инструкция','tutorial'))type='guide';
  else if(has('tool','инструмент','генератор'))type='tool';
  else if(has('плашк','asset','overlay','banner'))type='asset';
  else if(has('ссылк','links','resource list'))type='link';
  const models=[];
  if(has('gemini'))models.push('gemini');
  if(has('claude'))models.push('claude');
  if(has('gpt','chatgpt'))models.push('gpt');
  if(has('deepseek'))models.push('deepseek');
  const settings=[];
  if(has('соврем','modern'))settings.push('modern');
  if(has('фэнтез','fantasy'))settings.push('fantasy');
  if(has('средневек','medieval'))settings.push('medieval');
  if(has('постапок','post-apoc','post apocalypse','post-apocalypse'))settings.push('post-apocalypse');
  if(has('sci-fi','science fiction','научн'))settings.push('sci-fi');
  if(has('historical','историч'))settings.push('historical');
  if(has('school','university','школ','универ'))settings.push('school-university');
  if(has('omegaverse','омегаверс'))settings.push('omegaverse');
  return {type,models,settings,confidence:{type:type==='other'?.35:.8,model:models.length?.84:.25,setting:settings.length?.78:.25}};
}

function makeTitle(text){const line=String(text||'').split('\n').map(x=>x.trim()).find(x=>x.length>3&&x.length<120);return(line||'UNTITLED RESOURCE').replace(/^[-–—•#\s]+/,'').trim()}
function shortDesc(text){return String(text||'').replace(/https?:\/\/\S+/g,'').replace(/\s+/g,' ').trim().slice(0,180)}

async function fetchTelegram(url){
  try{
    const r=await fetch(url,{redirect:'follow',headers:{'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36','accept':'text/html,application/xhtml+xml','accept-language':'ru,en;q=0.8','cache-control':'no-cache'}});
    const text=await r.text();return {ok:r.ok,status:r.status,text,contentType:r.headers.get('content-type')||'',url:r.url||url};
  }catch(e){return {ok:false,status:0,text:'',error:String(e?.message||e),url}}
}

export async function analyzeTelegramPost(request){
  let body={};
  try{body=await request.json()}catch{return json({ok:false,error:'INVALID_JSON'},400)}
  const parsed=parseTelegramUrl(body.url);
  if(!parsed)return json({ok:false,error:'INVALID_TELEGRAM_POST_URL'},400);

  const candidates=[
    `https://t.me/${parsed.channel}/${parsed.postId}?embed=1&mode=tme`,
    `https://t.me/s/${parsed.channel}/${parsed.postId}?before=${Number(parsed.postId)+1}`,
    `https://t.me/s/${parsed.channel}/${parsed.postId}`,
    parsed.url
  ];
  const diagnostics=[];let selected=null;
  for(const url of candidates){
    const res=await fetchTelegram(url);diagnostics.push({url,status:res.status,bytes:res.text.length,contentType:res.contentType,error:res.error||null});
    if(!res.ok||!res.text)continue;
    const block=extractBlock(res.text,parsed.channel,parsed.postId);
    const rawText=extractMessageText(block,res.text);
    const media=extractMedia(block,res.text);
    if(rawText||media.length){selected={...res,block,rawText,media};break}
  }
  if(!selected)return json({ok:false,error:'TELEGRAM_POST_NOT_READABLE',message:'Telegram returned no readable public post content. The post may be private, deleted, age-restricted, or temporarily blocked.',diagnostics},502);

  const rawText=selected.rawText||'';
  if(!rawText)return json({ok:false,error:'TELEGRAM_POST_TEXT_NOT_FOUND',message:'The post was reachable, but no text was found. Media-only posts can still require manual description.',media:selected.media.map((url,i)=>({url,cover:i===0})),diagnostics},422);

  const author=extractAuthor(selected.block,selected.text,parsed);
  const mention=rawText.match(/@([A-Za-z0-9_]{4,})/);
  const detected=infer(rawText);
  return json({
    ok:true,
    source:{type:'telegram',url:parsed.url,channel:parsed.channel,postId:parsed.postId,rawText,author,sourceFetch:selected.url},
    draft:{
      title:makeTitle(rawText),
      creator:mention?mention[1]:(author||parsed.channel),
      creatorLink:mention?`@${mention[1]}`:`https://t.me/${parsed.channel}`,
      type:detected.type,
      models:detected.models,
      settings:detected.settings,
      descriptionShort:shortDesc(rawText),
      descriptionFull:rawText,
      tags:[]
    },
    media:selected.media.map((url,i)=>({url,cover:i===0})),
    coverIndex:0,
    confidence:detected.confidence,
    diagnostics:{fetchedFrom:selected.url,attempts:diagnostics.length,textChars:rawText.length,mediaCount:selected.media.length}
  });
}
