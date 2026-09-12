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

  function cleanBotData(){
    const bots=Array.isArray(window.BOTS)?window.BOTS:[];
    for(const bot of bots){
      if(!bot||typeof bot!=='object')continue;
      for(const key of ['publicDescription','short','full','scenario']){
        if(typeof bot[key]==='string')bot[key]=cleanServiceLine(bot[key]);
      }
      if(Array.isArray(bot.intros))bot.intros=bot.intros.map(cleanServiceLine);
    }
  }

  function normalizeAuditLabels(){
    const reset=document.querySelector('#resetBtn');
    if(reset)reset.textContent='CLEAR FILTERS';
    const drawerSearch=document.querySelector('#drawerSearch');
    if(drawerSearch)drawerSearch.placeholder='SEARCH...';
  }

  function normalizeCardRow(row){
    if(!row||row.dataset.auditNormalized==='1')return;
    const more=row.querySelector('.tag-more');
    const tagNodes=[...row.children].filter(node=>!node.classList.contains('tag-more'));
    if(tagNodes.length<=3){row.dataset.auditNormalized='1';return;}

    const hiddenCount=tagNodes.length-3;
    tagNodes.slice(3).forEach(node=>node.remove());
    const existingMore=more?Number(String(more.textContent||'').replace(/\D/g,''))||0:0;
    const totalMore=existingMore+hiddenCount;
    const counter=more||document.createElement('span');
    counter.className='tag-more';
    counter.textContent=`+${totalMore}`;
    counter.title=`${totalMore} more tag${totalMore===1?'':'s'}`;
    if(!more)row.append(counter);
    row.dataset.auditNormalized='1';
  }

  function syncMobileUniversePlacement(root=document){
    const cards=[];
    if(root?.matches?.('.card'))cards.push(root);
    root?.querySelectorAll?.('.card').forEach(card=>cards.push(card));
    const mobile=window.innerWidth<=760;

    for(const card of cards){
      const body=card.querySelector('.card-body');
      const title=card.querySelector('.card-title');
      const meta=card.querySelector('.card-meta');
      if(!body||!title||!meta)continue;

      const moved=body.querySelector(':scope > .card-mobile-universe');
      if(mobile){
        if(!moved){
          const universe=meta.querySelector('.card-universe-token');
          if(universe){
            universe.classList.add('card-mobile-universe');
            title.insertAdjacentElement('afterend',universe);
          }
        }
      }else if(moved){
        moved.classList.remove('card-mobile-universe');
        const firstUniverse=meta.querySelector('.card-universe-token');
        if(firstUniverse)meta.insertBefore(moved,firstUniverse);
        else meta.appendChild(moved);
      }
    }
  }

  function scrubTextNode(node){
    if(node&&SERVICE_LINE.test(node.textContent||''))node.remove();
  }

  function scan(root){
    if(!root||root.nodeType!==1)return;
    if(root.matches?.('.card-tags'))normalizeCardRow(root);
    root.querySelectorAll?.('.card-tags').forEach(normalizeCardRow);
    syncMobileUniversePlacement(root);

    if(root.matches?.(TEXT_SELECTOR))scrubTextNode(root);
    root.querySelectorAll?.(TEXT_SELECTOR).forEach(scrubTextNode);
  }

  function annotateLorebookState(){
    const link=document.querySelector('#downloadLore');
    if(!link)return;
    const unavailable=link.matches('[aria-disabled="true"],.disabled,[disabled]')||/not available/i.test(link.textContent||'');
    link.title=unavailable?'No lorebook is attached to this record.':'';
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

  function ensureModalGeometryGuard(){
    if(document.getElementById('archiveModalGeometryGuard'))return;
    const style=document.createElement('style');
    style.id='archiveModalGeometryGuard';
    style.textContent=`
      @media(min-width:761px){
        .modal-card{
          height:auto!important;
          min-height:0!important;
          max-height:min(560px,calc(100dvh - 40px))!important;
          align-items:stretch!important;
          overflow:hidden!important;
        }
        .modal-cover{
          height:auto!important;
          min-height:420px!important;
          align-self:stretch!important;
        }
        .modal-cover img{
          height:100%!important;
          object-fit:cover!important;
        }
        .modal-content{
          height:auto!important;
          min-height:0!important;
          max-height:min(560px,calc(100dvh - 40px))!important;
          overflow-y:auto!important;
          overflow-x:hidden!important;
          scrollbar-gutter:stable;
        }
        .modal-action-groups{
          margin-top:12px!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureMobileAuditStyles(){
    if(document.getElementById('archiveMobileAuditStyles'))return;
    const style=document.createElement('style');
    style.id='archiveMobileAuditStyles';
    style.textContent=`
      @media(max-width:760px){
        /* HERO: keep it compact, remove the line that was visibly clipped. */
        .hero-line{display:none!important}
        .hero-copy{bottom:7px!important}
        .hero-fade{
          background:linear-gradient(180deg,rgba(10,12,10,.04) 18%,rgba(10,12,10,.24) 58%,rgba(13,15,13,.88) 100%)!important;
        }

        /* TOOLBAR: larger real tap areas without visually inflating the whole shell. */
        .primary-group>.control,
        .secondary-group>.control,
        #povCycle,#loreToggle,#sortTrigger{
          min-height:42px!important;
          height:42px!important;
          padding-top:3px!important;
          padding-bottom:3px!important;
          border-radius:6px!important;
        }
        .toolbar-row{row-gap:6px!important}
        #importOpen{
          background:rgba(18,21,17,.56)!important;
          border-color:rgba(92,83,65,.58)!important;
          color:#a89a80!important;
          box-shadow:none!important;
          font-weight:400!important;
        }
        #importOpen:hover,#importOpen:focus-visible{
          background:rgba(25,27,21,.72)!important;
          border-color:rgba(125,107,78,.7)!important;
          color:#c7b99c!important;
        }

        /* GRID: every two-column row uses the same text/tag geometry. */
        .grid{align-items:stretch!important}
        .card{height:100%!important;display:flex!important;flex-direction:column!important;min-width:0!important}
        .card-media{
          width:100%!important;
          aspect-ratio:3/4!important;
          flex:0 0 auto!important;
        }
        .card-media img{width:100%!important;height:100%!important;object-fit:cover!important}
        .card-body{flex:1 1 auto!important;display:flex!important;flex-direction:column!important}
        .card-title{
          box-sizing:border-box!important;
          height:34px!important;
          min-height:34px!important;
          max-height:34px!important;
          margin:0!important;
          overflow:hidden!important;
          line-height:1.15!important;
        }
        .card-title span{
          display:block!important;
          margin-top:2px!important;
          white-space:nowrap!important;
          overflow:hidden!important;
          text-overflow:ellipsis!important;
        }
        .card-short{
          height:29px!important;
          min-height:29px!important;
          max-height:29px!important;
          overflow:hidden!important;
        }
        .card-tags{
          box-sizing:border-box!important;
          height:24px!important;
          min-height:24px!important;
          max-height:24px!important;
          flex-wrap:nowrap!important;
          overflow:hidden!important;
        }
        .card-tags button,.card-tags span{
          min-width:0!important;
          max-width:42%!important;
          height:24px!important;
          flex:0 1 auto!important;
          white-space:nowrap!important;
          overflow:hidden!important;
          text-overflow:ellipsis!important;
        }
        .card-tags .tag-more{flex:0 0 auto!important;max-width:none!important}
        .card-hashtags{
          height:13px!important;
          min-height:13px!important;
          max-height:13px!important;
          overflow:hidden!important;
          white-space:nowrap!important;
        }

        /* PAGINATION: no tiny number targets on phones. */
        .pagination{
          display:flex!important;
          align-items:center!important;
          justify-content:center!important;
          gap:10px!important;
          min-height:56px!important;
          padding:9px 4px!important;
        }
        .pagination[hidden]{display:none!important}
        .pagination button[data-page]:not([aria-label]){display:none!important}
        .pagination .pagination-gap{display:none!important}
        .pagination button[aria-label="Previous page"],
        .pagination button[aria-label="Next page"]{
          display:inline-flex!important;
          align-items:center!important;
          justify-content:center!important;
          width:44px!important;
          min-width:44px!important;
          height:44px!important;
          min-height:44px!important;
          padding:0!important;
          border-radius:7px!important;
          font-size:20px!important;
        }
        .mobile-page-state{
          min-width:92px;
          text-align:center;
          color:#899286;
          font:700 8px/1 var(--mono);
          letter-spacing:.08em;
        }

        /* FOOTER: stack instead of squeezing desktop metadata into one line. */
        .site-footer{
          display:flex!important;
          flex-direction:column!important;
          align-items:stretch!important;
          gap:8px!important;
          padding:14px 10px 18px!important;
        }
        .footer-left,.footer-right{
          display:flex!important;
          align-items:center!important;
          justify-content:center!important;
          flex-wrap:wrap!important;
          gap:6px 10px!important;
          width:100%!important;
          text-align:center!important;
        }
        .site-footer,.site-footer button,.site-footer a{
          font-size:7.5px!important;
          line-height:1.45!important;
        }
        .lost-file{min-height:30px!important;padding:5px 8px!important}
        .archive-credit{padding:5px 2px!important}

        /* MODAL: disabled lorebook gets room; external links reads as interactive. */
        .files-actions{flex-wrap:wrap!important}
        #downloadLore[aria-disabled="true"],
        #downloadLore.disabled,
        #downloadLore[disabled]{
          flex:1 0 100%!important;
          width:100%!important;
          max-width:none!important;
        }
        .mobile-action-toggle{
          min-height:34px!important;
          color:#aab4a5!important;
        }
        .mobile-action-toggle i{
          color:#c9d2c3!important;
          font-size:16px!important;
          line-height:1!important;
          opacity:1!important;
        }

        /* DRAWER: align variable emoji/text footprints to one row rhythm. */
        .drawer-item,.drawer-tag-item,.drawer-author-item,.drawer-world-item,.drawer-setting-item{
          align-items:center!important;
        }
        .drawer-item-name,.drawer-author-copy,.drawer-world-copy{
          min-width:0!important;
          line-height:1.25!important;
        }
        .drawer-item-name{display:block!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
        .drawer-list button{font-variant-emoji:text!important}
      }

      @media(max-width:370px){
        .primary-group>.control,
        .secondary-group>.control,
        #povCycle,#loreToggle,#sortTrigger{min-height:40px!important;height:40px!important}
        .pagination{gap:8px!important}
        .mobile-page-state{min-width:80px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeMobilePagination(){
    const nav=document.querySelector('#pagination');
    if(!nav)return;
    const old=nav.querySelector('.mobile-page-state');
    if(window.innerWidth>760||nav.hidden){
      old?.remove();
      return;
    }
    const active=nav.querySelector('button[aria-current="page"]');
    const numbered=[...nav.querySelectorAll('button[data-page]:not([aria-label])')]
      .map(btn=>Number(btn.dataset.page)||0)
      .filter(Boolean);
    const next=nav.querySelector('button[aria-label="Next page"]');
    const prev=nav.querySelector('button[aria-label="Previous page"]');
    const current=Number(active?.dataset.page)||Number(prev?.dataset.page)+1||1;
    const lastVisible=Math.max(0,...numbered);
    const nextPage=Number(next?.dataset.page)||current;
    const total=Math.max(current,nextPage,lastVisible);
    if(!old){
      const state=document.createElement('span');
      state.className='mobile-page-state';
      state.setAttribute('aria-live','polite');
      if(next)nav.insertBefore(state,next);else nav.appendChild(state);
    }
    const state=nav.querySelector('.mobile-page-state');
    if(state)state.textContent=`PAGE ${current} / ${total}`;
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

  function scheduleArrowPosition(){
    requestAnimationFrame(()=>requestAnimationFrame(positionModalArrows));
  }

  cleanBotData();
  normalizeAuditLabels();
  scan(document.body);
  annotateLorebookState();
  ensureTerminalExit();
  ensureModalGeometryGuard();
  ensureMobileAuditStyles();
  normalizeMobilePagination();
  scheduleArrowPosition();

  window.addEventListener('resize',()=>{
    scheduleArrowPosition();
    normalizeMobilePagination();
    syncMobileUniversePlacement(document.body);
  },{passive:true});
  window.addEventListener('archive:modal-public-ready',()=>{
    annotateLorebookState();
    scheduleArrowPosition();
  });

  /* Only new DOM nodes are scanned globally. Attribute watching is scoped below. */
  const childObserver=new MutationObserver(mutations=>{
    let labelsMayHaveChanged=false;
    let paginationMayHaveChanged=false;
    for(const mutation of mutations){
      for(const node of mutation.addedNodes){
        if(node.nodeType!==1)continue;
        scan(node);
        if(node.id==='resetBtn'||node.id==='drawerSearch'||node.querySelector?.('#resetBtn,#drawerSearch'))labelsMayHaveChanged=true;
        if(node.id==='pagination'||node.matches?.('#pagination *')||node.querySelector?.('#pagination'))paginationMayHaveChanged=true;
      }
      if(mutation.target?.id==='pagination')paginationMayHaveChanged=true;
    }
    if(labelsMayHaveChanged)normalizeAuditLabels();
    if(paginationMayHaveChanged)requestAnimationFrame(normalizeMobilePagination);
  });
  childObserver.observe(document.body,{childList:true,subtree:true});

  const pagination=document.querySelector('#pagination');
  if(pagination){
    new MutationObserver(()=>requestAnimationFrame(normalizeMobilePagination)).observe(pagination,{childList:true});
  }

  const modal=document.querySelector('#modal');
  if(modal){
    new MutationObserver(scheduleArrowPosition).observe(modal,{attributes:true,attributeFilter:['hidden','class']});
  }

  const lore=document.querySelector('#downloadLore');
  if(lore){
    new MutationObserver(annotateLorebookState).observe(lore,{attributes:true,attributeFilter:['class','aria-disabled','href'],childList:true,subtree:true});
  }
})();