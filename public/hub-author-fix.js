(()=>{
  const cleanAuthor=v=>{
    let s=String(v||'').trim();
    if(!s)return'UNKNOWN';
    try{
      const u=new URL(s);
      if(/(^|\.)t\.me$/i.test(u.hostname)){
        const p=u.pathname.replace(/^\/+|\/+$/g,'').split('/').filter(Boolean);
        if(p[0]==='s')p.shift();
        if(p.length)return p[0].replace(/^@/,'');
      }
    }catch{}
    return s.replace(/^@/,'');
  };

  const normalizeCardAuthors=()=>{
    document.querySelectorAll('.resource-card[data-dynamic="1"]').forEach(card=>{
      const by=card.querySelector('.card-by b');
      if(by)by.textContent=cleanAuthor(by.textContent);
      if(card.dataset.creatorName)card.dataset.creatorName=cleanAuthor(card.dataset.creatorName).toUpperCase();
    });
  };

  const previous=window.__hubResourcesReady||Promise.resolve();
  window.__hubResourcesReady=(async()=>{
    await previous;
    normalizeCardAuthors();

    const modal=document.getElementById('hubResourceModal');
    if(modal){
      const observer=new MutationObserver(()=>{
        const author=modal.querySelector('.hub-modal-author');
        if(!author)return;
        const link=author.querySelector('a');
        if(link){link.textContent=cleanAuthor(link.textContent);return;}
        const m=author.textContent.match(/^\s*BY:\s*(.*)$/i);
        if(m)author.textContent='BY: '+cleanAuthor(m[1]);
      });
      observer.observe(modal,{subtree:true,childList:true,characterData:true});
    }
  })();
})();
