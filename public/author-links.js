(()=>{
  const VERIFIED_AUTHOR_URLS=new Map([
    ['sepha','https://janitorai.com/ru/profiles/7687620e-17a6-4fe1-9b72-36bd6f564330_profile-of-sepha']
  ]);
  const clean=s=>String(s||'').trim();
  const key=s=>clean(s).replace(/^@/,'').toLocaleLowerCase();

  function verifiedUrl(author,current){
    const explicit=clean(current);
    if(explicit){
      try{
        const u=new URL(explicit,location.origin);
        if(/^https?:$/.test(u.protocol) && u.origin!==location.origin) return u.href;
      }catch{}
    }
    return VERIFIED_AUTHOR_URLS.get(key(author))||'';
  }

  function patchBots(list){
    if(!Array.isArray(list))return;
    for(const b of list){
      if(!b)continue;
      b.authorUrl=verifiedUrl(b.author,b.authorUrl);
    }
  }

  function currentAuthor(){
    return clean(document.getElementById('modalAuthor')?.textContent).replace(/^@/,'');
  }

  function patchModal(){
    const a=document.getElementById('openAuthor');
    const badge=document.getElementById('modalAuthorBadge');
    const author=currentAuthor();
    if(!a||!author)return;
    const u=verifiedUrl(author,a.getAttribute('href'));
    if(u){
      a.href=u;
      a.textContent=`@${author} ↗`;
      a.classList.remove('disabled');
      a.removeAttribute('aria-disabled');
      a.target='_blank';
      a.rel='noopener noreferrer';
      if(badge){badge.dataset.authorUrl=u;badge.title=`Open @${author} on JanitorAI`;badge.style.cursor='pointer';badge.setAttribute('aria-label',`Open @${author} profile`)}
    }else{
      a.removeAttribute('href');
      a.textContent='AUTHOR LINK — N/A';
      a.classList.add('disabled');
      a.setAttribute('aria-disabled','true');
      if(badge){delete badge.dataset.authorUrl;badge.removeAttribute('title');badge.style.cursor='default';badge.setAttribute('aria-label',`Author @${author}`)}
    }
  }

  patchBots(window.BOTS);
  window.addEventListener('archive:catalog-updated',e=>{
    patchBots(e.detail?.characters);
    patchBots(window.BOTS);
    queueMicrotask(patchModal);
  });
  window.addEventListener('archive:modal-public-ready',()=>queueMicrotask(patchModal));

  document.addEventListener('click',e=>{
    const a=e.target.closest('#openAuthor');
    if(a){patchModal();if(!a.getAttribute('href'))e.preventDefault();return}
    const badge=e.target.closest('#modalAuthorBadge');
    if(!badge)return;
    patchModal();
    const u=badge.dataset.authorUrl;
    if(!u)return;
    e.preventDefault();
    e.stopPropagation();
    window.open(u,'_blank','noopener,noreferrer');
  },true);

  const observer=new MutationObserver(()=>patchModal());
  const start=()=>{
    const modal=document.getElementById('modal');
    const author=document.getElementById('modalAuthor');
    if(modal)observer.observe(modal,{attributes:true,attributeFilter:['hidden']});
    if(author)observer.observe(author,{childList:true,characterData:true,subtree:true});
    patchModal();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();