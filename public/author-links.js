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
      const u=verifiedUrl(b.author,b.authorUrl);
      b.authorUrl=u;
    }
  }

  function patchModal(){
    const a=document.getElementById('openAuthor');
    const author=document.getElementById('modalAuthor');
    if(!a||!author)return;
    const u=verifiedUrl(author.textContent,a.getAttribute('href'));
    if(u){
      a.href=u;
      a.textContent=`@${clean(author.textContent).replace(/^@/,'')} ↗`;
      a.classList.remove('disabled');
      a.removeAttribute('aria-disabled');
      a.target='_blank';
      a.rel='noopener noreferrer';
    }else{
      a.removeAttribute('href');
      a.textContent='AUTHOR LINK — N/A';
      a.classList.add('disabled');
      a.setAttribute('aria-disabled','true');
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
    if(!a)return;
    patchModal();
    if(!a.getAttribute('href'))e.preventDefault();
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