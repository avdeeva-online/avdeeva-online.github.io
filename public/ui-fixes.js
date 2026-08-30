(()=>{
  const $=s=>document.querySelector(s);
  let activeBot=null;

  function ensureFileButtons(){
    const files=document.querySelector('.files-actions');
    const json=$('#downloadBot');
    if(!files||!json)return;
    let png=$('#downloadPng');
    if(!png){png=document.createElement('a');png.id='downloadPng';png.className='download-action';png.setAttribute('download','');png.textContent='PNG CARD ↓';files.insertBefore(png,json)}
    json.textContent='JSON CARD ↓';
  }

  function pngUrl(bot){
    if(bot?.downloadPng)return bot.downloadPng;
    const raw=String(bot?.download||'');
    if(!raw)return '';
    try{const u=new URL(raw,location.origin);u.pathname=u.pathname.replace(/\/card$/,'/card.png');return u.toString()}catch{return raw.replace(/\/card$/,'/card.png')}
  }

  function enhance(bot){
    if(!bot)return;activeBot=bot;ensureFileButtons();
    const png=$('#downloadPng'),json=$('#downloadBot'),author=$('#openAuthor'),lore=$('#downloadLore');
    if(png){const href=pngUrl(bot);if(href)png.href=href;else png.removeAttribute('href');png.classList.toggle('disabled',!href)}
    if(json){const href=String(bot.download||'').trim();if(href)json.href=href;else json.removeAttribute('href');json.classList.toggle('disabled',!href);json.textContent='JSON CARD ↓'}
    if(author){const href=String(bot.authorUrl||'').trim();if(href){author.href=href;author.classList.remove('disabled');author.removeAttribute('aria-disabled');author.textContent=`@${bot.author||'AUTHOR'} ↗`}else{author.removeAttribute('href');author.classList.add('disabled');author.setAttribute('aria-disabled','true');author.textContent='AUTHOR LINK — N/A'}}
    if(lore){const href=String(bot.lorebook||'').trim();if(href){lore.href=href;const n=Number(bot.lorebookCount||1);lore.textContent=`LOREBOOKS [${n}] ↓`;lore.title=`${n} attached lorebook${n===1?'':'s'} — choose files`;lore.classList.remove('disabled');lore.removeAttribute('aria-disabled')}else{lore.removeAttribute('href');lore.textContent='LOREBOOK — NOT AVAILABLE';lore.title='';lore.classList.add('disabled');lore.setAttribute('aria-disabled','true')}}
  }

  ensureFileButtons();
  const original=window.openModal;
  if(typeof original==='function')window.openModal=function(bot,...args){activeBot=bot;const out=original.call(this,bot,...args);enhance(bot);return out};

  window.addEventListener('archive:open-character',e=>{const bot=e.detail?.bot;if(!bot)return;activeBot=bot;if(typeof window.openModal==='function')window.openModal(bot);else enhance(bot)});
  window.addEventListener('archive:modal-public-ready',e=>{if(e.detail?.bot){activeBot=e.detail.bot;enhance(activeBot)}});

  const modal=$('#modal');
  if(modal){const mo=new MutationObserver(()=>{if(!modal.hidden&&activeBot)enhance(activeBot)});mo.observe(modal,{attributes:true,attributeFilter:['hidden']})}
})();