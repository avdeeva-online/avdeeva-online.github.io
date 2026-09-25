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

  // Author profile links come from the catalog (Janitor profile per author); only absolute http(s) URLs are used.
  function externalUrl(raw){const s=String(raw||'').trim();if(!s)return'';try{const u=new URL(/^[a-z][a-z0-9+.-]*:/i.test(s)?s:`https://${s}`);return /^https?:$/.test(u.protocol)&&u.origin!==location.origin?u.href:''}catch{return''}}

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
    const profile=externalUrl(bot.authorUrl),badge=$('#modalAuthorBadge'),name=bot.author||'AUTHOR';
    if(author){if(profile){author.href=profile;author.target='_blank';author.rel='noopener noreferrer';author.classList.remove('disabled');author.removeAttribute('aria-disabled');author.textContent=`@${name} ↗`}else{author.removeAttribute('href');author.classList.add('disabled');author.setAttribute('aria-disabled','true');author.textContent='AUTHOR LINK — N/A'}}
    if(badge){if(profile){badge.dataset.authorUrl=profile;badge.title=`Open @${name} on JanitorAI`;badge.style.cursor='pointer';badge.setAttribute('aria-label',`Open @${name} profile`)}else{delete badge.dataset.authorUrl;badge.removeAttribute('title');badge.style.cursor='default';badge.setAttribute('aria-label',`Author @${name}`)}}
    if(lore){const href=String(bot.lorebook||'').trim();if(href){lore.href=href;const n=Number(bot.lorebookCount||1);lore.textContent=`LOREBOOKS [${n}] ↓`;lore.title=`${n} attached lorebook${n===1?'':'s'} — choose files`;lore.classList.remove('disabled');lore.removeAttribute('aria-disabled')}else{lore.removeAttribute('href');lore.textContent='LOREBOOK — NOT AVAILABLE';lore.title='No lorebook is attached to this record.';lore.classList.add('disabled');lore.setAttribute('aria-disabled','true')}}
  }

  ensureFileButtons();
  const original=window.openModal;
  if(typeof original==='function'&&!original.__archiveUiFixWrapped){
    const wrapped=function(bot,...args){activeBot=bot;const out=original.call(this,bot,...args);enhance(bot);return out};
    wrapped.__archiveUiFixWrapped=true;
    window.openModal=wrapped;
  }

  window.addEventListener('archive:open-character',e=>{const bot=e.detail?.bot;if(!bot)return;activeBot=bot;if(typeof window.openModal==='function')window.openModal(bot);else enhance(bot)});
  window.addEventListener('archive:modal-public-ready',e=>{if(e.detail?.bot&&e.detail.bot!==activeBot){activeBot=e.detail.bot;enhance(activeBot)}});
  // The author badge on the cover opens the author's profile; a disabled author button must not navigate.
  document.addEventListener('click',e=>{
    const link=e.target.closest('#openAuthor');if(link){if(!link.getAttribute('href'))e.preventDefault();return}
    const badge=e.target.closest('#modalAuthorBadge'),url=badge?.dataset.authorUrl;if(!url)return;
    e.preventDefault();e.stopPropagation();window.open(url,'_blank','noopener,noreferrer');
  },true);
})();