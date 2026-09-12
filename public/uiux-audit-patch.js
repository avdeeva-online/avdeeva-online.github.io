(()=>{
  'use strict';

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

  function ensureMobileCompactStyles(){
    if(document.getElementById('archiveMobileCompactCardStyles'))return;
    const style=document.createElement('style');
    style.id='archiveMobileCompactCardStyles';
    style.textContent=`
      .modal-files-links-toggle{display:none}
      @media(max-width:760px){
        /* Catalog cards: preserve 3 readable description lines and quiet secondary metadata. */
        .card-body{padding-top:6px!important}
        .card-meta{margin-top:3px!important;gap:2px!important}
        .card-meta .meta-token,.card-setting-token{min-height:18px!important;height:18px!important;padding:2px 4px!important;border-radius:4px!important;font-size:5.8px!important;line-height:1!important}
        .card-meta .setting-mark{font-size:8px!important;line-height:1!important}
        .card-short{display:-webkit-box!important;min-height:38px!important;max-height:38px!important;margin-top:4px!important;-webkit-line-clamp:3!important;line-clamp:3!important;-webkit-box-orient:vertical!important;overflow:hidden!important;font-size:9.1px!important;line-height:1.38!important}
        .card-tags{min-height:18px!important;max-height:18px!important;margin-top:4px!important;gap:3px!important}
        .card-tags button,.card-tags span{height:18px!important;min-height:18px!important;max-width:42%!important;padding:0 5px!important;border-radius:4px!important;font-size:7.1px!important;line-height:1!important}
        .card-hashtags{display:flex!important;min-height:11px!important;max-height:11px!important;margin-top:2px!important;gap:5px!important;overflow:hidden!important;white-space:nowrap!important}
        .card-hashtags button,.card-hashtags span{flex:0 1 auto!important;min-width:0!important;padding:0!important;font-size:6.8px!important;line-height:1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}

        /* Mobile modal hierarchy: name/Universe/description first, quiet metadata second. */
        .modal-content{position:relative!important;padding:9px!important}
        .modal-heading-row h2{margin-bottom:4px!important;padding-right:42%!important}
        .modal-author-row{position:absolute!important;top:12px!important;right:10px!important;z-index:4!important;max-width:40%!important;margin:0!important;padding:0!important;font-size:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;text-align:right!important}
        .modal-author-row:before{content:'BY ';color:#657064!important;font:700 6px/1 var(--mono)!important;letter-spacing:.08em!important}
        .modal-author-row #modalAuthor{max-width:calc(100% - 18px)!important;margin:0 0 0 3px!important;padding:0!important;border:0!important;background:none!important;color:#aeb8a8!important;font:700 7.2px/1 var(--mono)!important;text-decoration:underline!important;text-underline-offset:2px!important;overflow:hidden!important;text-overflow:ellipsis!important;vertical-align:middle!important}
        .modal-author-row #modalPov{display:none!important}

        .modal-setting-row{gap:4px!important;margin:0 0 3px!important}
        .modal-setting-heading{min-height:19px!important;line-height:19px!important;font-size:6px!important;color:#748073!important;letter-spacing:.07em!important}
        .modal-setting-heading i{height:19px!important;line-height:19px!important;font-size:9px!important}
        .modal-setting-row>div,#modalSetting{gap:3px!important}
        .modal-setting-row button{min-height:19px!important;padding:3px 5px!important;border-radius:4px!important;font-size:7px!important;line-height:1!important}
        .modal-universe-row{margin-bottom:3px!important}
        #modalUniverse,.modal-universe-under-title{font-size:6.8px!important;line-height:1.25!important}

        .modal-tags{margin-top:2px!important;margin-bottom:2px!important}
        .modal-primary-tags{gap:3px!important}
        .modal-primary-tags button{padding:3px 5px!important;border-radius:4px!important;font-size:7.2px!important;line-height:1.05!important;color:#c99f89!important;background:#1d1917!important;border-color:#3a302a!important}
        .modal-hashtags{gap:6px!important;margin-top:4px!important;padding-top:4px!important}
        .modal-hashtags button{font-size:6.8px!important;line-height:1.1!important;color:#717d72!important}

        /* One collapsed entry point for files and external links. */
        .modal-files-links-toggle{display:flex!important;align-items:center!important;justify-content:space-between!important;width:100%!important;min-height:30px!important;margin:4px 0 0!important;padding:0 9px!important;border:1px solid rgba(91,103,84,.46)!important;border-radius:5px!important;background:rgba(18,22,18,.62)!important;color:#a7b09f!important;font:700 7px/1 var(--mono)!important;letter-spacing:.09em!important;cursor:pointer!important}
        .modal-files-links-toggle i{font:400 13px/1 Arial,sans-serif!important;color:#758170!important;transition:transform .14s ease!important}
        .modal-files-links-toggle.open i{transform:rotate(180deg)!important}
        .modal-action-groups{display:none!important;margin-top:4px!important;padding-top:4px!important;gap:4px!important;border-top:0!important}
        .modal-action-groups.mobile-actions-open{display:grid!important}
        .modal-action-group{padding:5px!important;border-radius:4px!important}
        .modal-action-group>small{font-size:6px!important}
        .mobile-action-toggle{display:none!important}
        .modal-actions{gap:4px!important}
        .modal-actions a{min-height:27px!important;height:27px!important;padding:0 7px!important;font-size:6.8px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureMobileFilesLinks(reset=false){
    const groups=document.querySelector('#modal .modal-action-groups');
    if(!groups)return;
    let toggle=document.getElementById('modalFilesLinksToggle');
    if(!toggle){
      toggle=document.createElement('button');
      toggle.id='modalFilesLinksToggle';
      toggle.className='modal-files-links-toggle';
      toggle.type='button';
      toggle.setAttribute('aria-expanded','false');
      toggle.innerHTML='<span>FILES / LINKS</span><i aria-hidden="true">⌄</i>';
      groups.insertAdjacentElement('beforebegin',toggle);
      toggle.addEventListener('click',()=>{
        const open=groups.classList.toggle('mobile-actions-open');
        toggle.classList.toggle('open',open);
        toggle.setAttribute('aria-expanded',open?'true':'false');
      });
    }
    if(reset||window.innerWidth>760){
      groups.classList.remove('mobile-actions-open');
      toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded','false');
    }
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
      ensureMobileFilesLinks(true);
    });
    scheduleArrowPosition();
  }

  cleanBotData();
  normalizeAuditLabels();
  ensureCatalogToggle();
  ensurePersistentTagDrawer();
  ensureTerminalExit();
  ensureMobileCompactStyles();
  ensureMobileFilesLinks();
  ensureBackToTop();
  refreshModalRuntime();

  window.addEventListener('archive:catalog-updated',()=>{
    cleanBotData(window.BOTS);
    normalizeAuditLabels();
  });
  window.addEventListener('archive:modal-public-ready',refreshModalRuntime);
  window.addEventListener('archive:modal-definition-ready',()=>requestAnimationFrame(()=>{scrubModalText();showFullModalFacets()}));
  window.addEventListener('resize',()=>{scheduleArrowPosition();ensureMobileFilesLinks(false)},{passive:true});
})();