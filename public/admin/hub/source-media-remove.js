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

  function syncCover(){
    const items=[...grid.querySelectorAll('.media')];
    if(!items.length){grid.innerHTML='<div class="empty">NO MEDIA LOADED · use MANUAL COVER if needed</div>';return}
    let cover=items.find(x=>x.classList.contains('cover'));
    if(!cover){cover=items[0];cover.classList.add('cover')}
    items.forEach(item=>{
      const b=item.querySelector('[data-admin-cover]');
      if(b)b.textContent=item===cover?'COVER':'SET COVER';
    });
  }

  function decorate(){
    [...grid.querySelectorAll('.media')].forEach(item=>{
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
        if(wasCover)grid.querySelector('.media')?.classList.add('cover');
        syncCover();
        document.querySelector('#rawText')?.dispatchEvent(new Event('input',{bubbles:true}));
        const status=document.querySelector('#analyzeStatus');
        if(status){status.textContent='SOURCE IMAGE REMOVED · publish/update to save changes.';status.className='status ok'}
      });
      item.appendChild(btn);
    });
    syncCover();
  }

  decorate();
  new MutationObserver(decorate).observe(grid,{childList:true,subtree:false});
})();
