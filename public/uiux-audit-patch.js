(()=>{
  'use strict';

  if(!document.querySelector('script[data-archive-cross-nav]')){
    const navScript=document.createElement('script');
    navScript.src='cross-nav.js?v=1';
    navScript.dataset.archiveCrossNav='1';
    document.head.appendChild(navScript);
  }

  const SERVICE_LINE=/^\s*character\s*:\s*/i;
  const TEXT_SELECTOR='#modalPublicBody p,.modal-dossier p,.modal-dossier li';

  function cleanServiceLine(value){
    if(typeof value!=='string'||!value)return value;
    return value
      .replace(/\r/g,'')
      .split('\n')
      .filter(line=>!SERVICE_LINE.test(line))
      .join('\n')
      .replace(/\n{3,}/g,'\n\n')
      .trim();
  }

  function cleanBotData(list=window.BOTS){
    if(!Array.isArray(list))return;
    for(const bot of list){
      if(!bot||typeof bot!=='object')continue;
      for(const key of ['publicDescription','short','full','scenario']){
        if(typeof bot[key]==='string')bot[key]=cleanServiceLine(bot[key]);
      }
      if(Array.isArray(bot.intros))bot.intros=bot.intros.map(cleanServiceLine);
    }
  }

  function scrubModalText(){
    document.querySelectorAll(TEXT_SELECTOR).forEach(node=>{
      if(SERVICE_LINE.test(node.textContent||''))node.remove();
    });
  }

  function showFullModalFacets(){
    const modal=document.querySelector('#modal');
    if(!modal||modal.hidden)return;
    modal.querySelectorAll('.facet-extra,.modal-setting-extra').forEach(node=>node.classList.remove('facet-extra','modal-setting-extra'));
    modal.querySelectorAll('.modal-setting-more,.modal-universe-more,.modal-tag-more,.modal-hashtag-more').forEach(node=>node.remove());
  }

  function normalizeAuditLabels(){
    const drawerSearch=document.querySelector('#drawerSearch');
    if(drawerSearch)drawerSearch.placeholder='SEARCH...';
  }

  function ensureCatalogToggle(){
    const button=document.querySelector('#catalogOpen');
    const drawer=document.querySelector('#catalogDrawer');
    const shade=document.querySelector('#drawerShade');
    if(!button||!drawer||button.dataset.auditToggle==='1')return;
    button.dataset.auditToggle='1';
    let wasOpen=false;
    button.addEventListener('click',()=>{wasOpen=drawer.classList.contains('open')},{capture:true});
    button.addEventListener('click',()=>{
      if(!wasOpen)return;
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden','true');
      if(shade)shade.hidden=true;
      document.body.classList.remove('drawer-open');
    });
  }

  function ensurePersistentTagDrawer(){
    const list=document.querySelector('#drawerList');
    const drawer=document.querySelector('#catalogDrawer');
    const shade=document.querySelector('#drawerShade');
    if(!list||!drawer||list.dataset.auditPersistentTags==='1')return;
    list.dataset.auditPersistentTags='1';
    list.addEventListener('click',event=>{
      if(window.innerWidth>760||!event.target.closest('[data-drawer-value]'))return;
      const active=document.querySelector('.drawer-tab.active')?.dataset.drawerTab;
      if(active!=='tag')return;
      queueMicrotask(()=>{
        drawer.classList.add('open');
        drawer.setAttribute('aria-hidden','false');
        if(shade)shade.hidden=false;
        document.body.classList.add('drawer-open');
      });
    });
  }

  function ensureTerminalExit(){
    const retry=document.querySelector('#terminalRetry');
    if(!retry||document.querySelector('.terminal-back-home'))return;
    const back=document.createElement('button');
    back.type='button';
    back.className='terminal-back-home';
    back.textContent='BACK TO CATALOG';
    back.addEventListener('click',()=>{
      const terminal=document.querySelector('#lostTerminal');
      if(terminal)terminal.hidden=true;
      document.body.classList.remove('modal-open','terminal-open');
    });
    retry.insertAdjacentElement('afterend',back);
  }

  function ensureBackToTop(){
    if(document.getElementById('archiveBackToTop'))return;
    if(!document.getElementById('archiveBackToTopStyles')){
      const style=document.createElement('style');
      style.id='archiveBackToTopStyles';
      style.textContent=`
        #archiveBackToTop{position:fixed;right:20px;bottom:20px;z-index:72;width:46px;height:46px;border:1px solid #554b3d;border-radius:7px;background:#171512;color:#b7a58b;font:800 20px/1 var(--mono);display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;visibility:hidden;transform:translateY(7px);transition:opacity .16s,transform .16s,visibility .16s,border-color .16s,color .16s,background .16s,box-shadow .16s;box-shadow:0 10px 28px rgba(0,0,0,.34)}
        #archiveBackToTop.visible{opacity:.94;visibility:visible;transform:none}
        #archiveBackToTop:hover{opacity:1;color:#e1c8a6;border-color:#80694f;background:#211b16;box-shadow:0 12px 30px rgba(0,0,0,.42)}
        body.modal-open #archiveBackToTop,body.drawer-open #archiveBackToTop,body.terminal-open #archiveBackToTop{opacity:0!important;visibility:hidden!important;pointer-events:none!important}
        @media(max-width:760px){#archiveBackToTop{right:13px;bottom:13px;width:40px;height:40px;border-radius:6px;font-size:18px}}
      `;
      document.head.appendChild(style);
    }
    const button=document.createElement('button');
    button.id='archiveBackToTop';
    button.type='button';
    button.setAttribute('aria-label','Back to top');
    button.title='Back to top';
    button.textContent='↑';
    const sync=()=>button.classList.toggle('visible',window.scrollY>650);
    button.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
    window.addEventListener('scroll',sync,{passive:true});
    document.body.appendChild(button);
    sync();
  }

  function positionModalArrows(){
    const modal=document.querySelector('#modal');
    const card=modal?.querySelector('.modal-card');
    const prev=document.querySelector('#prevBot');
    const next=document.querySelector('#nextBot');
    if(!modal||!card||!prev||!next)return;

    if(window.innerWidth<=760||modal.hidden){
      prev.style.removeProperty('left');
      prev.style.removeProperty('right');
      next.style.removeProperty('left');
      next.style.removeProperty('right');
      return;
    }

    const rect=card.getBoundingClientRect();
    const gap=44;
    const edge=12;
    const prevWidth=prev.getBoundingClientRect().width||35;
    const nextWidth=next.getBoundingClientRect().width||35;
    const prevLeft=Math.max(edge,rect.left-gap-prevWidth);
    const nextLeft=Math.min(window.innerWidth-edge-nextWidth,rect.right+gap);

    prev.style.setProperty('left',`${Math.round(prevLeft)}px`,'important');
    prev.style.setProperty('right','auto','important');
    next.style.setProperty('left',`${Math.round(nextLeft)}px`,'important');
    next.style.setProperty('right','auto','important');
  }

  let arrowFrame=0;
  function scheduleArrowPosition(){
    if(arrowFrame)cancelAnimationFrame(arrowFrame);
    arrowFrame=requestAnimationFrame(()=>{arrowFrame=0;positionModalArrows()});
  }

  function refreshModalRuntime(){
    requestAnimationFrame(()=>{
      scrubModalText();
      showFullModalFacets();
    });
    scheduleArrowPosition();
  }

  cleanBotData();
  normalizeAuditLabels();
  ensureCatalogToggle();
  ensurePersistentTagDrawer();
  ensureTerminalExit();
  ensureBackToTop();
  refreshModalRuntime();

  window.addEventListener('archive:catalog-updated',()=>{
    cleanBotData(window.BOTS);
    normalizeAuditLabels();
  });
  window.addEventListener('archive:modal-public-ready',refreshModalRuntime);
  window.addEventListener('archive:modal-definition-ready',refreshModalRuntime);
  window.addEventListener('resize',scheduleArrowPosition,{passive:true});
})();