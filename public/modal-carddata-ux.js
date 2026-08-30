(()=>{
  if(document.getElementById('archiveCardDataUxStyles'))return;
  const s=document.createElement('style');
  s.id='archiveCardDataUxStyles';
  s.textContent=`
  /* Two equal-level drawers: ABOUT THIS BOT and CARD DATA. No rotating/flipping controls. */
  .modal-public-summary,.card-data-shell{border-top:1px solid rgba(82,94,78,.32)!important;border-bottom:1px solid rgba(82,94,78,.32)!important;background:transparent!important}

  .modal-public-head,.card-data-toggle{
    min-height:30px!important;height:30px!important;
    padding:0 7px!important;margin:0!important;
    display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;
    align-items:center!important;gap:8px!important;
    border:0!important;background:rgba(108,123,94,.025)!important;
    color:#aab4a1!important;font-family:var(--mono)!important;
    cursor:pointer!important;text-align:left!important;
  }
  .modal-public-head:hover,.card-data-toggle:hover{background:rgba(108,123,94,.065)!important;color:#d3dacb!important}

  .modal-public-label,.card-data-toggle-title{font:700 7.5px/1 var(--mono)!important;letter-spacing:.09em!important;color:inherit!important;white-space:nowrap!important}
  .modal-public-label:before{content:'//';margin-right:7px;color:#687462!important}
  .card-data-toggle-title:before{content:'//';margin-right:7px;color:#687462!important}

  .modal-public-controls{display:flex;align-items:center;gap:6px}
  .modal-drawer-icon,.card-data-toggle-icon{
    display:inline-flex!important;align-items:center!important;justify-content:center!important;
    width:18px!important;height:18px!important;border:1px solid #46513f!important;border-radius:3px!important;
    color:#a6b09b!important;background:transparent!important;font:9px/1 var(--mono)!important;
    transform:none!important;transition:none!important;
  }
  .modal-public-summary.is-collapsed .modal-drawer-icon,.card-data-shell:not(.open) .card-data-toggle-icon{transform:none!important}

  .modal-public-summary{margin-top:8px!important;padding:0!important;overflow:hidden!important}
  .modal-public-summary .modal-public-body{height:118px!important;min-height:118px!important;max-height:118px!important;padding:8px 8px 7px 7px!important}
  .modal-public-summary.is-collapsed .modal-public-body{display:none!important}
  .modal-public-summary.is-collapsed{padding:0!important}

  .card-data-shell{margin:5px 0 0!important;padding:0!important;overflow:hidden!important}
  .card-data-toggle-copy{display:flex!important;align-items:center!important;gap:10px!important;min-width:0!important}
  .card-data-toggle-hint{font:400 6.5px/1 var(--mono)!important;letter-spacing:.04em!important;color:#687264!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  .card-data-body{display:none!important;height:112px!important;max-height:112px!important;overflow:hidden!important;background:rgba(8,11,8,.10)!important}
  .card-data-shell.open .card-data-body{display:block!important}
  .card-data-shell.open .card-data-toggle{background:rgba(108,123,94,.055)!important}

  .card-data-body .modal-tabs{height:30px!important;min-height:30px!important;margin:0!important;padding:0 8px!important;gap:15px!important;align-items:flex-end!important}
  .card-data-body .modal-tab{padding:0 0 6px!important;font-size:7.5px!important;line-height:1!important}
  .card-data-body .modal-text-wrap{height:80px!important;min-height:80px!important;max-height:80px!important;overflow-y:auto!important;overflow-x:hidden!important;padding:3px 8px 6px!important}

  /* Internal description itself is NOT another accordion. */
  .card-data-body .dossier-section,.card-data-body .dossier-section.is-collapsed{padding:0 0 6px!important;margin:0 0 6px!important;border-bottom:1px solid rgba(72,81,70,.28)!important}
  .card-data-body .dossier-body,.card-data-body .dossier-section.is-collapsed .dossier-body{display:block!important}
  .card-data-body .dossier-title{pointer-events:none!important;cursor:default!important;margin:0 0 4px!important;min-height:15px!important;font-size:7.5px!important;line-height:15px!important}
  .card-data-body .dossier-arrow{display:none!important}
  .card-data-body .modal-dossier{padding:3px 0 5px!important;font-size:9.5px!important;line-height:1.42!important}
  .card-data-body .dossier-paragraph{font-size:9.5px!important;line-height:1.42!important;margin-bottom:5px!important}
  .card-data-body .intro-choice{padding:4px 6px!important;font-size:7.5px!important}
  .card-data-body .intro-display{font-size:9.5px!important;line-height:1.42!important;padding:5px 0!important}

  /* Tags stay metadata-sized, not a large empty block. */
  .modal-tags{min-height:0!important;height:auto!important;flex:0 0 auto!important;margin-top:5px!important;margin-bottom:0!important}
  .modal-hashtags{min-height:0!important;height:auto!important;margin-bottom:0!important;padding-bottom:0!important}

  @media(max-width:760px){
    .card-data-toggle-hint{display:none!important}
    .modal-public-summary .modal-public-body{height:auto!important;min-height:0!important;max-height:180px!important}
    .card-data-body{height:auto!important;max-height:150px!important}
    .card-data-body .modal-text-wrap{height:auto!important;min-height:0!important;max-height:112px!important}
  }
  `;
  document.head.appendChild(s);

  function normalizeInternalSections(){
    document.querySelectorAll('#cardDataShell .dossier-section').forEach(sec=>{
      sec.classList.remove('is-collapsed');
      const title=sec.querySelector('.dossier-title');
      if(title)title.setAttribute('aria-expanded','true');
    });
  }

  function setupAbout(){
    const box=document.getElementById('modalPublicSummary');
    if(!box||box.dataset.drawerReady==='1')return;
    box.dataset.drawerReady='1';
    box.classList.remove('is-collapsed');
    const head=box.querySelector('.modal-public-head');
    const langs=head?.querySelector('.modal-lang');
    if(!head)return;
    let controls=head.querySelector('.modal-public-controls');
    if(!controls){
      controls=document.createElement('span');
      controls.className='modal-public-controls';
      if(langs)controls.appendChild(langs);
      const icon=document.createElement('span');
      icon.className='modal-drawer-icon';
      icon.textContent='⌃';
      controls.appendChild(icon);
      head.appendChild(controls);
    }
    head.setAttribute('role','button');
    head.setAttribute('tabindex','0');
    const toggle=()=>{
      const collapsed=box.classList.toggle('is-collapsed');
      const icon=head.querySelector('.modal-drawer-icon');
      if(icon)icon.textContent=collapsed?'⌄':'⌃';
      head.setAttribute('aria-expanded',collapsed?'false':'true');
    };
    head.addEventListener('click',e=>{if(e.target.closest('.modal-lang'))return;toggle()});
    head.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('.modal-lang')){e.preventDefault();toggle()}});
    head.setAttribute('aria-expanded','true');
  }

  function setupCardData(){
    const shell=document.getElementById('cardDataShell');
    if(!shell)return;
    const btn=shell.querySelector('.card-data-toggle');
    if(!btn)return;
    btn.innerHTML='<span class="card-data-toggle-copy"><span class="card-data-toggle-title">CARD DATA</span><span class="card-data-toggle-hint">DESCRIPTION / SCENARIO / INTRO</span></span><span class="card-data-toggle-icon">⌄</span>';
    btn.setAttribute('aria-label','Show or hide character card data');
    btn.setAttribute('aria-expanded',shell.classList.contains('open')?'true':'false');
    const sync=()=>{
      const open=shell.classList.contains('open');
      const icon=btn.querySelector('.card-data-toggle-icon');
      if(icon)icon.textContent=open?'⌃':'⌄';
      btn.setAttribute('aria-expanded',open?'true':'false');
      if(open)normalizeInternalSections();
    };
    sync();
    new MutationObserver(sync).observe(shell,{attributes:true,attributeFilter:['class']});
    const panel=document.getElementById('modalPanel');
    if(panel)new MutationObserver(normalizeInternalSections).observe(panel,{childList:true,subtree:true});
  }

  function resetForOpenedBot(){
    const about=document.getElementById('modalPublicSummary');
    if(about){about.classList.remove('is-collapsed');const i=about.querySelector('.modal-drawer-icon');if(i)i.textContent='⌃';const h=about.querySelector('.modal-public-head');if(h)h.setAttribute('aria-expanded','true')}
    const card=document.getElementById('cardDataShell');
    if(card){card.classList.remove('open');const i=card.querySelector('.card-data-toggle-icon');if(i)i.textContent='⌄';const b=card.querySelector('.card-data-toggle');if(b)b.setAttribute('aria-expanded','false')}
  }

  function install(){
    setupAbout();setupCardData();
    if(!document.getElementById('modalPublicSummary')||!document.getElementById('cardDataShell')){setTimeout(install,60);return}
    window.addEventListener('archive:modal-public-ready',()=>{resetForOpenedBot();setupAbout();setupCardData()});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();