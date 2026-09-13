const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

function parseTelegramUrl(raw){
  try{
    const u=new URL(String(raw||'').trim());
    if(!/(^|\.)t\.me$/.test(u.hostname))return null;
    const p=u.pathname.replace(/^\/s\//,'/').replace(/\/$/,'');
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

function firstMatch(html,re){const m=String(html).match(re);return m?m[1]:''}

function uniq(arr){return [...new Set(arr.filter(Boolean))]}

function extractBlock(html,channel,postId){
  const marker=`data-post="${channel}/${postId}"`;
  const idx=html.indexOf(marker);
  if(idx<0)return html;
  const start=Math.max(0,html.lastIndexOf('<div class="tgme_widget_message_wrap',idx));
  const next=html.indexOf('<div class="tgme_widget_message_wrap',idx+marker.length);
  return html.slice(start,next>idx?next:Math.min(html.length,idx+80000));
}

function infer(text){
  const t=String(text||'').toLowerCase();
  const has=(...xs)=>xs.some(x=>t.includes(x));
  let type='other';
  if(has('preset','пресет')) type='preset';
  else if(has('plugin','плагин')) type='plugin';
  else if(has('theme','тема')) type='theme';
  else if(has('гайд','guide','инструкция','tutorial')) type='guide';
  else if(has('tool','инструмент','генератор')) type='tool';
  else if(has('плашк','asset','overlay','banner')) type='asset';
  else if(has('ссылк','links','resource list')) type='link';

  const models=[];
  if(has('gemini'))models.push('gemini');
  if(has('claude'))models.push('claude');
  if(has('gpt','chatgpt'))models.push('gpt');
  if(has('deepseek'))models.push('deepseek');

  const settings=[];
  if(has('соврем','modern'))settings.push('modern');
  if(has('фэнтез','fantasy'))settings.push('fantasy');
  if(has('средневек','medieval'))settings.push('medieval');
  if(has('постапок','post-apoc','post apocalypse'))settings.push('post-apocalypse');
  if(has('sci-fi','science fiction','научн'))settings.push('sci-fi');
  if(has('historical','историч'))settings.push('historical');
  if(has('school','university','школ','универ'))settings.push('school-university');
  if(has('omegaverse','омегаверс'))settings.push('omegaverse');

  return {type,models,settings,confidence:{type:type==='other'?.35:.78,model:models.length?.82:.25,setting:settings.length?.76:.25}};
}

function makeTitle(text){
  const line=String(text||'').split('\n').map(x=>x.trim()).find(x=>x.length>3&&x.length<120);
  return (line||'UNTITLED RESOURCE').replace(/^[-–—•#\s]+/,'').trim();
}
function shortDesc(text){return String(text||'').replace(/https?:\/\/\S+/g,'').replace(/\s+/g,' ').trim().slice(0,180)}

export async function onRequestPost({request}){
  let body={};
  try{body=await request.json()}catch{return json({ok:false,error:'INVALID_JSON'},400)}
  const parsed=parseTelegramUrl(body.url);
  if(!parsed)return json({ok:false,error:'INVALID_TELEGRAM_POST_URL'},400);

  const urls=[
    `https://t.me/${parsed.channel}/${parsed.postId}?embed=1&mode=tme`,
    `https://t.me/s/${parsed.channel}/${parsed.postId}`
  ];
  let html='',sourceUrl='';
  for(const url of urls){
    try{
      const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (compatible; ARCHIVE.EXE/1.0)','accept-language':'en-US,en;q=0.9'}});
      if(r.ok){html=await r.text();sourceUrl=url;if(html)break}
    }catch{}
  }
  if(!html)return json({ok:false,error:'TELEGRAM_FETCH_FAILED'},502);

  const block=extractBlock(html,parsed.channel,parsed.postId);
  const textHtml=firstMatch(block,/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/i)
    || firstMatch(block,/<meta property="og:description" content="([\s\S]*?)"\s*\/?>/i);
  const rawText=htmlToText(textHtml);
  if(!rawText)return json({ok:false,error:'TELEGRAM_POST_TEXT_NOT_FOUND',sourceUrl},422);

  const authorHtml=firstMatch(block,/<div class="tgme_widget_message_author[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i)
    || firstMatch(block,/<meta property="og:title" content="([\s\S]*?)"\s*\/?>/i);
  const author=htmlToText(authorHtml).replace(/\s*–\s*Telegram$/i,'').trim();

  const media=[];
  for(const m of block.matchAll(/background-image:url\(['"]?([^'")]+)['"]?\)/gi))media.push(decodeHtml(m[1]));
  for(const m of block.matchAll(/<img[^>]+src=['"]([^'"]+)['"]/gi)){
    const u=decodeHtml(m[1]);
    if(/cdn|telegram|t\.me/i.test(u))media.push(u);
  }
  const mediaUrls=uniq(media).filter(u=>/^https?:\/\//i.test(u));

  const mention=rawText.match(/@([A-Za-z0-9_]{4,})/);
  const detected=infer(rawText);
  const draft={
    title:makeTitle(rawText),
    creator:mention?mention[1]:(author||parsed.channel),
    creatorLink:mention?`@${mention[1]}`:`https://t.me/${parsed.channel}`,
    type:detected.type,
    models:detected.models,
    settings:detected.settings,
    descriptionShort:shortDesc(rawText),
    descriptionFull:rawText,
    tags:[]
  };

  return json({
    ok:true,
    source:{type:'telegram',url:parsed.url,channel:parsed.channel,postId:parsed.postId,rawText,sourceFetch:sourceUrl},
    draft,
    media:mediaUrls.map((url,i)=>({url,cover:i===0})),
    coverIndex:0,
    confidence:detected.confidence
  });
}
