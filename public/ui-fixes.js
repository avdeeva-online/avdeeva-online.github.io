(()=>{
  const $=s=>document.querySelector(s);

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
    if(!bot)return;ensureFileButtons();
    const png=$('#downloadPng'),json=$('#downloadBot'),author=$('#openAuthor'),lore=$('#downloadLore');
    if(png){const href=pngUrl(bot);if(href)png.href=href;else png.removeAttribute('href');png.classList.toggle('disabled',!href)}
    if(json){json.href=bot.download||'';json.textContent='JSON CARD ↓'}
    if(author){const href=String(bot.authorUrl||'').trim();if(href){author.href=href;author.classList.remove('disabled');author.removeAttribute('aria-disabled');author.textContent=`@${bot.author||'AUTHOR'} ↗`}else{author.removeAttribute('href');author.classList.add('disabled');author.setAttribute('aria-disabled','true');author.textContent='AUTHOR LINK — N/A'}}
    if(lore&&bot.lorebook){const n=Number(bot.lorebookCount||1);lore.textContent=`LOREBOOKS [${n}] ↓`;lore.title=`${n} attached lorebook${n===1?'':'s'} — choose files`}
  }

  function findCurrentBot(){
    const title=$('#modalTitle')?.textContent?.trim();
    if(!title)return null;
    return (Array.isArray(window.BOTS)?window.BOTS:[]).find(b=>String(b.nameEn||'').trim()===title)||null;
  }

  ensureFileButtons();
  const original=window.openModal;
  if(typeof original==='function')window.openModal=function(bot,...args){const out=original.call(this,bot,...args);enhance(bot);return out};

  window.addEventListener('archive:open-character',e=>{const bot=e.detail?.bot;if(!bot)return;if(typeof window.openModal==='function')window.openModal(bot);else enhance(bot)});

  const modal=$('#modal');
  if(modal){const mo=new MutationObserver(()=>{if(!modal.hidden)enhance(findCurrentBot())});mo.observe(modal,{attributes:true,attributeFilter:['hidden']})}
})();
