(()=>{
  'use strict';
  if(!document.querySelector('link[data-archive-cross-nav]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='cross-nav.css?v=1';
    link.dataset.archiveCrossNav='1';
    document.head.appendChild(link);
  }
  const path=location.pathname.replace(/\/+$/,'')||'/';
  const isHub=path==='/hub'||path==='/hub.html';
  const isCatalog=path==='/characters'||path==='/characters.html';
  if(!isHub&&!isCatalog)return;
  if(document.querySelector('.archive-cross-nav'))return;

  const iconCatalog='<svg class="cross-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="2.2"/><circle cx="16" cy="8" r="2.2"/><path d="M4.5 17c.8-2.4 2-3.6 3.5-3.6S10.7 14.6 11.5 17M12.5 17c.8-2.4 2-3.6 3.5-3.6s2.7 1.2 3.5 3.6"/></svg>';
  const iconHub='<svg class="cross-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4.5" width="14" height="15" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>';
  const nav=document.createElement('nav');
  nav.className=`archive-cross-nav ${isHub?'hub-cross-nav':'catalog-cross-nav'}`;
  nav.setAttribute('aria-label','Archive sections');
  nav.innerHTML=`<a class="cross-nav-link ${isHub?'active':''}" href="hub.html" ${isHub?'aria-current="page"':''}>${iconHub}<span class="cross-nav-label">TAVO HUB</span></a><span class="cross-nav-swap" aria-hidden="true">↔</span><a class="cross-nav-link ${isCatalog?'active':''}" href="characters.html" ${isCatalog?'aria-current="page"':''}>${iconCatalog}<span class="cross-nav-label">BOT CATALOG</span></a>`;

  if(isHub){
    document.querySelector('.top-shell')?.appendChild(nav);
    Promise.resolve(window.__hubResourcesReady).catch(()=>{}).then(()=>setTimeout(setupHubControls,0));
  }else{
    document.querySelector('.hero')?.appendChild(nav);
  }

  function setupHubControls(){
    if(document.querySelector('.hub-control-line'))return;
    const content=document.querySelector('.content');
    const toolbar=document.querySelector('.toolbar');
    const toolbarRight=document.querySelector('.toolbar-right');
    const preset=document.querySelector('.preset-filters');
    const creatorPanel=document.querySelector('.creator-panel');
    const creatorHead=creatorPanel?.querySelector('.creator-head');
    const grid=document.querySelector('.resource-grid');
    const sideLinks=[...document.querySelectorAll('.side-link')];
    if(!content||!toolbar||!toolbarRight||!preset||!grid)return;

    const line=document.createElement('div');
    line.className='hub-control-line';
    const context=document.createElement('div');
    context.className='hub-section-context';
    context.innerHTML='<span class="hub-section-kicker">RESOURCE INDEX</span><span class="hub-section-copy">BROWSE ALL PUBLISHED RESOURCES</span>';
    content.insertBefore(line,toolbar);
    line.appendChild(context);
    line.appendChild(preset);
    if(creatorPanel)line.appendChild(creatorPanel);
    line.appendChild(toolbarRight);
    toolbar.remove();

    if(creatorHead)creatorHead.innerHTML='<span>CREATOR</span>';

    const sectionCopy={
      all:['RESOURCE INDEX','BROWSE ALL PUBLISHED RESOURCES'],
      plugins:['PLUGINS','EXTENSIONS & ADD-ONS'],
      themes:['THEMES','VISUAL & INTERFACE PACKS'],
      guides:['GUIDES','WORKFLOWS & REFERENCE NOTES'],
      links:['LINKS','CURATED EXTERNAL RESOURCES'],
      tools:['TOOLS','UTILITIES FOR CREATION']
    };
    const syncContext=(index=0)=>{
      const key=['all','presets','creators','plugins','themes','guides','links','tools'][index]||'all';
      const data=sectionCopy[key]||sectionCopy.all;
      context.hidden=key==='presets'||key==='creators';
      context.querySelector('.hub-section-kicker').textContent=data[0];
      context.querySelector('.hub-section-copy').textContent=data[1];
    };
    syncContext(Math.max(0,sideLinks.findIndex(x=>x.classList.contains('active'))));
    sideLinks.forEach((link,index)=>link.addEventListener('click',()=>setTimeout(()=>syncContext(index),0)));

    const oldSort=toolbarRight.querySelector('label');
    if(oldSort){
      const sort=document.createElement('div');
      sort.className='hub-sort-inline';
      sort.setAttribute('aria-label','Sort resources');
      sort.innerHTML='<span class="hub-sort-label">SORT:</span><button type="button" class="hub-sort-btn active" data-sort="recent">RECENT</button><button type="button" class="hub-sort-btn" data-sort="name">NAME</button>';
      oldSort.replaceWith(sort);

      [...grid.querySelectorAll('.resource-card')].forEach((card,i)=>card.dataset.hubOrder=String(i));
      sort.addEventListener('click',e=>{
        const btn=e.target.closest('.hub-sort-btn');
        if(!btn)return;
        sort.querySelectorAll('.hub-sort-btn').forEach(b=>b.classList.toggle('active',b===btn));
        const cards=[...grid.querySelectorAll('.resource-card')];
        cards.sort((a,b)=>{
          if(btn.dataset.sort==='name')return (a.querySelector('h3')?.textContent||'').localeCompare(b.querySelector('h3')?.textContent||'',undefined,{sensitivity:'base'});
          return Number(a.dataset.hubOrder||0)-Number(b.dataset.hubOrder||0);
        });
        cards.forEach(card=>grid.appendChild(card));
      });
    }

    const animateSwitch=()=>{
      content.classList.remove('hub-switching');
      void content.offsetWidth;
      content.classList.add('hub-switching');
      clearTimeout(content._hubSwitchTimer);
      content._hubSwitchTimer=setTimeout(()=>content.classList.remove('hub-switching'),180);
    };
    content.addEventListener('click',e=>{
      if(e.target.closest('.tag-filter,.creator-filter,.hub-sort-btn,.view-btn'))animateSwitch();
    },true);
    document.querySelector('.side-nav')?.addEventListener('click',e=>{
      if(e.target.closest('.side-link'))animateSwitch();
    },true);

    const style=document.createElement('style');
    style.dataset.hubControlLine='1';
    style.textContent=`
      .hub-control-line{display:flex;align-items:center;gap:12px;min-height:38px;margin:0 0 8px;padding:0 2px;border:0;background:transparent}
      .hub-section-context{display:flex;align-items:center;gap:9px;min-height:30px;min-width:0;color:#8f998f;animation:hubPanelIn .18s ease-out both}
      .hub-section-context[hidden]{display:none!important}
      .hub-section-kicker{position:relative;padding-left:11px;font:7.2px/1 var(--mono);letter-spacing:.10em;color:#c2b78f;white-space:nowrap}
      .hub-section-kicker:before{content:'';position:absolute;left:0;top:50%;width:5px;height:5px;margin-top:-2.5px;border:1px solid rgba(205,190,119,.65);transform:rotate(45deg);box-shadow:0 0 7px rgba(189,169,91,.08)}
      .hub-section-copy{font:6.6px/1 var(--mono);letter-spacing:.065em;color:#69746b;white-space:nowrap}
      .hub-section-copy:before{content:'//';margin-right:7px;color:#505a52}
      .hub-control-line .preset-filters{flex:1 1 auto;min-width:0;margin:0;padding:0;border:0;background:transparent;box-shadow:none;overflow:visible}
      .hub-control-line .preset-filters:before{display:none!important}
      .hub-control-line .preset-filters.show{display:flex;align-items:center;gap:15px;flex-wrap:nowrap;animation:hubPanelIn .18s ease-out both}
      .hub-control-line .filter-row,.hub-control-line .filter-row:first-of-type,.hub-control-line .filter-row+ .filter-row{display:flex;align-items:center;gap:6px;margin:0;padding:0;border:0;background:transparent;white-space:nowrap}
      .hub-control-line .filter-label{flex:0 0 auto;padding:0;margin-right:2px;font-size:6.9px!important;line-height:1;color:#818b81!important;font-weight:400!important;letter-spacing:.07em}
      .hub-control-line .filter-tags{display:flex;align-items:center;gap:4px;flex-wrap:nowrap;overflow:visible}
      .hub-control-line .tag-filter,.hub-control-line .filter-row:first-of-type .tag-filter,.hub-control-line .filter-row:nth-of-type(2) .tag-filter{min-height:25px;padding:5px 8px;border-radius:7px;font-size:6.8px;line-height:1;letter-spacing:.025em;background:rgba(8,13,9,.42);border-color:rgba(143,157,128,.16);color:#98a197;transition:color .16s,border-color .16s,background .16s,transform .16s,box-shadow .16s}
      .hub-control-line .tag-filter:hover{transform:translateY(-1px)}
      .hub-control-line .tag-filter.active,.hub-control-line .filter-row:first-of-type .tag-filter.active,.hub-control-line .filter-row:nth-of-type(2) .tag-filter.active{border-color:rgba(194,181,109,.50);background:rgba(135,126,71,.12);color:#eadfbd;box-shadow:0 0 12px rgba(184,164,86,.045)}
      .hub-control-line .toolbar-right{display:flex;align-items:center;gap:7px;flex:0 0 auto;margin-left:auto}
      .hub-sort-inline{display:flex;align-items:center;gap:3px;height:29px;padding:0 2px 0 7px;border-left:1px solid rgba(137,151,121,.15)}
      .hub-sort-label{margin-right:4px;color:#7f897f;font:6.8px/1 var(--mono);letter-spacing:.07em}
      .hub-sort-btn{appearance:none;border:0;background:transparent;color:#828d83;padding:6px 8px;border-radius:6px;font:7px/1 var(--mono);letter-spacing:.045em;cursor:pointer;transition:color .16s,background .16s,transform .16s,box-shadow .16s}
      .hub-sort-btn:hover{color:#c8cec3;background:rgba(126,143,112,.05);transform:translateY(-1px)}
      .hub-sort-btn.active{color:#eadfb9;background:rgba(154,143,82,.10);box-shadow:inset 0 -1px rgba(205,187,111,.45),0 0 10px rgba(181,161,87,.035)}
      .hub-control-line .view-toggle{display:flex;gap:5px}
      .hub-control-line .view-btn{width:28px;height:28px;transition:transform .16s,border-color .16s,background .16s,color .16s}
      .hub-control-line .view-btn:hover{transform:translateY(-1px)}

      .hub-control-line .creator-panel{flex:1 1 auto;min-width:0;border:0!important;background:transparent!important;box-shadow:none!important;border-radius:0!important;margin:0!important;padding:0!important;overflow:visible!important}
      .hub-control-line .creator-panel.show{display:flex!important;align-items:center;gap:10px;min-height:30px;animation:hubPanelIn .18s ease-out both}
      .creator-head{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:0!important;margin:0!important;flex:0 0 auto!important;color:#8d978d!important;font:6.9px/1 var(--mono)!important;letter-spacing:.08em!important}
      .creator-head:after{content:'';width:18px;height:1px;margin-left:8px;background:linear-gradient(90deg,rgba(185,170,105,.38),transparent)}
      .creator-tags{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
      .creator-filter{position:relative;min-height:26px;padding:5px 10px 5px 9px!important;border-radius:7px!important;background:rgba(8,13,9,.42)!important;border-color:rgba(143,157,128,.16)!important;color:#98a197!important;transition:color .16s,border-color .16s,background .16s,transform .16s,box-shadow .16s}
      .creator-filter:hover{transform:translateY(-1px);color:#cfd4ca!important;border-color:rgba(170,179,148,.28)!important}
      .creator-filter.active{padding-left:18px!important;border-color:rgba(194,181,109,.50)!important;background:rgba(135,126,71,.12)!important;color:#eadfbd!important;box-shadow:0 0 12px rgba(184,164,86,.045)!important}
      .creator-filter.active:before{content:'';position:absolute;left:8px;top:50%;width:4px;height:4px;margin-top:-2px;border-radius:50%;background:#d8c57f;box-shadow:0 0 8px rgba(216,197,127,.38)}

      .resource-grid{transition:opacity .18s ease,transform .18s ease,filter .18s ease}
      .content.hub-switching .resource-grid{opacity:.55;transform:translateY(4px);filter:saturate(.82)}
      .side-link{position:relative;overflow:hidden}
      .side-link:after{content:'';position:absolute;left:12%;right:12%;bottom:2px;height:1px;background:linear-gradient(90deg,transparent,rgba(208,191,116,.58),transparent);transform:scaleX(0);opacity:0;transition:transform .18s ease,opacity .18s ease}
      .side-link.active:after{transform:scaleX(1);opacity:.75}
      @keyframes hubPanelIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}

      @media(max-width:1260px){.hub-control-line{align-items:flex-start;flex-wrap:wrap}.hub-control-line .preset-filters.show{flex-wrap:wrap;row-gap:7px}.hub-control-line .toolbar-right{margin-left:auto}.hub-control-line .creator-panel.show{align-items:flex-start;flex-wrap:wrap}.hub-section-copy{display:none}}
      @media(max-width:900px){.hub-control-line{gap:8px}.hub-control-line .preset-filters.show{width:100%;flex-basis:100%;overflow-x:auto;scrollbar-width:none}.hub-control-line .preset-filters.show::-webkit-scrollbar{display:none}.hub-control-line .toolbar-right{width:auto;margin-left:auto;justify-content:flex-end}.hub-sort-inline{border-left:0}.hub-control-line .filter-tags{overflow:visible}.hub-control-line .creator-panel.show{display:flex!important;flex:1 1 100%;order:2}.creator-head:after{display:none}.creator-tags{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}.creator-tags::-webkit-scrollbar{display:none}.hub-section-context{flex:1 1 auto}}
    `;
    document.head.appendChild(style);
  }
})();