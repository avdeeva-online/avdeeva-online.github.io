(()=>{
  const grid=document.querySelector('#mediaGrid');
  if(!grid||grid.dataset.sourceRemoveBound)return;
  grid.dataset.sourceRemoveBound='1';

  const style=document.createElement('style');
  style.textContent=`
    #mediaGrid .media [data-remove-source-media]{left:5px;right:auto;bottom:5px;border-color:#694941;color:#c49a8d;background:#15100e}
    #mediaGrid .media [data-remove-source-media]:hover{border-color:#936458;color:#e2b4a6}
  `;
  document.head.appendChild(style);

  let decorating=false;

  function syncCover(){
    const items=[...grid.querySelectorAll(':scope > .media')];
    if(!items.length)return;
    let cover=items.find(x=>x.classList.contains('cover'));
    if(!cover){cover=items[0];cover.classList.add('cover')}
    items.forEach(item=>{
      const b=item.querySelector('[data-admin-cover],[data-cover]');
      if(b)b.textContent=item===cover?'COVER':'SET COVER';
    });
  }

  function decorate(){
    if(decorating)return;
    decorating=true;
    try{
      const items=[...grid.querySelectorAll(':scope > .media')];
      if(!items.length)return;
      items.forEach(item=>{
        if(item.querySelector('[data-remove-source-media]'))return;
        const btn=document.createElement('button');
        btn.type='button';
        btn.dataset.removeSourceMedia='1';
        btn.textContent='REMOVE';
        btn.title='Remove this source image from the resource';
        btn.addEventListener('click',e=>{
          e.preventDefault();e.stopPropagation();
          const wasCover=item.classList.contains('cover');
          item.remove();
          if(wasCover)grid.querySelector(':scope > .media')?.classList.add('cover');
          syncCover();
          const status=document.querySelector('#analyzeStatus');
          if(status){status.textContent='SOURCE IMAGE REMOVED · publish/update to save changes.';status.className='status ok'}
          window.dispatchEvent(new CustomEvent('archive:hub-source-media-change'));
        });
        item.appendChild(btn);
      });
      syncCover();
    } finally {
      decorating=false;
    }
  }

  decorate();
  const observer=new MutationObserver(()=>queueMicrotask(decorate));
  observer.observe(grid,{childList:true,subtree:false});
})();
