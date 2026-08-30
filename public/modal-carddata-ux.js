(()=>{
  if(document.getElementById('archiveCardDataUxStyles'))return;
  const s=document.createElement('style');
  s.id='archiveCardDataUxStyles';
  s.textContent=`
  /* =========================================================
     ARCHIVE.EXE — CHARACTER MODAL MASTER LAYOUT
     This file intentionally owns the entire desktop modal visual system.
     ABOUT and CARD DATA share one fixed content viewport.
     ========================================================= */
  @media(min-width:761px){
    .modal-card{
      width:min(720px,88vw)!important;
      height:min(446px,84vh)!important;
      max-height:min(446px,84vh)!important;
      grid-template-columns:258px minmax(0,1fr)!important;
      border-color:#3a4338!important;
      border-radius:9px!important;
      background:#141814!important;
      box-shadow:0 28px 78px rgba(0,0,0,.58)!important;
    }
    .modal-cover{height:100%!important;min-height:0!important;background:#0d100d!important}
    .modal-cover img{filter:brightness(.89)!important}
    .modal-content{
      height:100%!important;
      max-height:none!important;
      min-width:0!important;
      overflow:hidden!important;
      display:flex!important;
      flex-direction:column!important;
      padding:17px 20px 16px!important;
      color:#d8d7cf!important;
    }

    /* Top identity block */
    .modal-heading-row{display:block!important;margin:0!important;padding:0!important}
    .modal-content h2{
      margin:0 34px 10px 0!important;
      max-width:100%!important;
      overflow:visible!important;
      font:800 21px/1.05 Arial,sans-serif!important;
      letter-spacing:-.022em!important;
      color:#f0ede4!important;
    }
    .modal-universe-row{
      min-height:22px!important;
      margin:0 0 7px!important;
      gap:8px!important;
      align-items:center!important;
    }
    .modal-universe-under-title{
      margin:0!important;
      color:#7d8877!important;
      font:7.8px/1 var(--mono)!important;
      letter-spacing:.035em!important;
    }
    .modal-lore-flag{
      width:24px!important;height:24px!important;min-height:24px!important;
      border:1px solid #3b4538!important;border-radius:5px!important;
      color:#8b987d!important;background:rgba(20,25,19,.45)!important;opacity:.9!important;
    }
    .modal-author-row{
      margin:0 0 10px!important;
      color:#717a70!important;
      font:8px/1.35 var(--mono)!important;
      letter-spacing:.025em!important;
    }
    .modal-author-row button{font-size:8.5px!important;color:#bec6ae!important}
    .pov-label{margin-left:8px!important;font-size:8.5px!important;color:#99a38e!important}

    /* ABOUT — main readable surface */
    .modal-public-summary,.card-data-shell{
      flex:0 0 auto!important;
      margin:0!important;padding:0!important;
      border:0!important;background:transparent!important;overflow:visible!important;
    }
    .modal-public-summary{margin-top:1px!important}
    .modal-public-head{
      height:29px!important;min-height:29px!important;
      display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:center!important;gap:8px!important;
      margin:0!important;padding:0 8px!important;
      border-top:1px solid rgba(83,95,80,.34)!important;
      border-bottom:1px solid rgba(83,95,80,.34)!important;
      background:rgba(126,143,108,.018)!important;
      cursor:default!important;
    }
    .modal-public-label{
      color:#aab4a2!important;
      font:700 7.3px/1 var(--mono)!important;
      letter-spacing:.09em!important;
      white-space:nowrap!important;
    }
    .modal-public-label:before{content:'//';margin-right:8px;color:#5f6a5b!important}
    .modal-public-controls{display:flex!important;align-items:center!important;gap:6px!important}
    .modal-drawer-icon{display:none!important}
    .modal-public-body{
      height:139px!important;min-height:139px!important;max-height:139px!important;
      overflow-y:auto!important;overflow-x:hidden!important;
      padding:10px 12px 9px 8px!important;
      border-bottom:1px solid rgba(83,95,80,.34)!important;
      color:#b7bbb2!important;
      font:10.7px/1.48 Arial,sans-serif!important;
      scrollbar-width:thin!important;
      scrollbar-color:rgba(75,84,72,.38) transparent!important;
    }
    .modal-public-summary.is-collapsed .modal-public-body{display:block!important}
    .modal-public-body::-webkit-scrollbar{width:4px!important}
    .modal-public-body::-webkit-scrollbar-track{background:transparent!important}
    .modal-public-body::-webkit-scrollbar-thumb{background:rgba(71,80,68,.34)!important;border-radius:8px!important}
    .modal-public-body:hover::-webkit-scrollbar-thumb{background:rgba(89,99,84,.50)!important}
    .modal-public-body p{margin:0 0 8px!important;font:inherit!important;color:inherit!important}
    .modal-public-body strong{color:#e3e0d6!important;font-weight:700!important}

    /* CARD DATA is a mode switch, not another box below ABOUT. */
    .card-data-shell{margin:0 0 11px!important}
    .card-data-toggle{
      width:100%!important;height:31px!important;min-height:31px!important;
      margin:0!important;padding:0 9px!important;
      border:0!important;border-bottom:1px solid rgba(83,95,80,.34)!important;
      background:rgba(111,126,96,.018)!important;
      color:#a7b19f!important;
      display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;
      cursor:pointer!important;text-align:left!important;
      font-family:var(--mono)!important;
      transform:none!important;transition:background .12s ease,color .12s ease!important;
    }
    .card-data-toggle:hover{background:rgba(111,126,96,.055)!important;color:#d4dacd!important}
    .card-data-toggle-copy{display:flex!important;align-items:center!important;gap:10px!important;min-width:0!important}
    .card-data-toggle-title{font:700 7.2px/1 var(--mono)!important;letter-spacing:.09em!important;white-space:nowrap!important}
    .card-data-toggle-title:before{content:'//';margin-right:8px;color:#5f6a5b!important}
    .card-data-toggle-hint{font:400 6.4px/1 var(--mono)!important;letter-spacing:.035em!important;color:#657064!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    .card-data-toggle-icon{border:0!important;background:transparent!important;color:#879281!important;font:11px/1 Arial,sans-serif!important;transform:none!important;transition:none!important}

    .card-data-body{
      display:none!important;
      height:139px!important;min-height:139px!important;max-height:139px!important;
      overflow:hidden!important;
      border-bottom:1px solid rgba(83,95,80,.34)!important;
      background:rgba(8,11,8,.06)!important;
    }
    .card-data-shell.open .card-data-body{display:block!important}
    .modal-content.card-data-mode .modal-public-body{display:none!important}
    .modal-content.card-data-mode .card-data-toggle{border-top:1px solid rgba(83,95,80,.34)!important;background:rgba(111,126,96,.042)!important}
    .modal-content.card-data-mode .card-data-toggle-title{font-size:0!important}
    .modal-content.card-data-mode .card-data-toggle-title:before{content:'‹  BACK TO ABOUT';font:700 7.2px/1 var(--mono)!important;letter-spacing:.09em!important;color:#c7cdbc!important;margin:0!important}
    .modal-content.card-data-mode .card-data-toggle-hint,.modal-content.card-data-mode .card-data-toggle-icon{display:none!important}

    .card-data-body .modal-tabs{
      height:31px!important;min-height:31px!important;margin:0!important;padding:0 9px!important;
      display:flex!important;align-items:flex-end!important;gap:17px!important;
      border-bottom:1px solid rgba(83,95,80,.24)!important;
    }
    .card-data-body .modal-tab{padding:0 0 7px!important;font:700 7.3px/1 var(--mono)!important;letter-spacing:.045em!important}
    .card-data-body .modal-text-wrap{
      height:107px!important;min-height:107px!important;max-height:107px!important;
      overflow-y:auto!important;overflow-x:hidden!important;
      padding:6px 10px 7px!important;
      scrollbar-width:thin!important;scrollbar-color:rgba(75,84,72,.36) transparent!important;
    }
    .card-data-body .modal-text-wrap::-webkit-scrollbar{width:4px!important}
    .card-data-body .modal-text-wrap::-webkit-scrollbar-track{background:transparent!important}
    .card-data-body .modal-text-wrap::-webkit-scrollbar-thumb{background:rgba(71,80,68,.32)!important;border-radius:8px!important}
    .card-data-body .modal-text-wrap:hover::-webkit-scrollbar-thumb{background:rgba(89,99,84,.48)!important}
    .card-data-body .dossier-section,.card-data-body .dossier-section.is-collapsed{padding:0 0 6px!important;margin:0 0 6px!important;border-bottom:1px solid rgba(72,81,70,.24)!important}
    .card-data-body .dossier-body,.card-data-body .dossier-section.is-collapsed .dossier-body{display:block!important}
    .card-data-body .dossier-title{pointer-events:none!important;cursor:default!important;margin:0 0 4px!important;min-height:15px!important;font:700 7.4px/15px var(--mono)!important;color:#b4bdab!important}
    .card-data-body .dossier-arrow{display:none!important}
    .card-data-body .modal-dossier,.card-data-body .dossier-paragraph{font:10px/1.44 Arial,sans-serif!important;color:#aeb4aa!important}
    .card-data-body .dossier-paragraph{margin-bottom:6px!important}
    .card-data-body .intro-choice{padding:5px 7px!important;font-size:7.5px!important}
    .card-data-body .intro-display{padding:6px 0!important;font:10px/1.45 Arial,sans-serif!important}

    /* Tags are metadata; they should not dominate the modal. */
    .modal-tags{
      display:block!important;
      flex:0 0 auto!important;
      min-height:0!important;height:auto!important;
      margin:0 0 0!important;padding:0!important;
    }
    .modal-primary-tags{display:flex!important;gap:6px!important;flex-wrap:wrap!important}
    .modal-primary-tags button{
      padding:4px 7px!important;
      border-radius:5px!important;
      font:500 8.6px/1.15 Arial,sans-serif!important;
      color:#d0aa94!important;
      background:#1d1916!important;
      border:1px solid #3a332d!important;
    }
    .modal-hashtags{
      display:flex!important;gap:8px!important;flex-wrap:wrap!important;
      width:100%!important;min-height:0!important;height:auto!important;
      margin:8px 0 0!important;padding:7px 0 0!important;
      border-top:1px solid #292f29!important;
    }
    .modal-hashtags button{padding:0!important;border:0!important;background:none!important;color:#687269!important;font:8.5px/1.2 Arial,sans-serif!important}
    .modal-hashtags button:hover{color:#a1aaa0!important;text-decoration:underline!important;text-underline-offset:2px!important}

    /* Bottom action zone — deliberately uses the lower third instead of bunching up. */
    .modal-action-groups{
      flex:0 0 auto!important;
      display:grid!important;grid-template-columns:1fr!important;
      gap:11px!important;
      margin:19px 0 0!important;
      padding:12px 0 0!important;
      border-top:1px solid #2c332c!important;
    }
    .modal-action-group{
      display:grid!important;grid-template-columns:57px minmax(0,1fr)!important;
      align-items:center!important;gap:11px!important;
    }
    .modal-action-group>small{
      margin:0!important;align-self:center!important;
      color:#69736a!important;
      font:700 7px/1 var(--mono)!important;
      letter-spacing:.12em!important;
    }
    .modal-actions{display:flex!important;gap:8px!important;flex-wrap:wrap!important;margin:0!important;padding:0!important}
    .modal-actions a{
      height:30px!important;min-height:30px!important;
      padding:0 11px!important;border-radius:5px!important;
      display:inline-flex!important;align-items:center!important;justify-content:center!important;
      font:600 8px/1 Arial,sans-serif!important;letter-spacing:.005em!important;
      flex:0 0 auto!important;
    }
    .files-actions .download-action{background:#303829!important;color:#eee8d7!important;border-color:#79846a!important}
    .files-actions .download-action:hover{background:#3a4531!important;border-color:#9da982!important}
    .source-actions .open-platform,.source-actions .author-action{background:transparent!important;color:#a0a89d!important;border-color:#3b4439!important;font-weight:500!important}
    .source-actions .open-platform:hover,.source-actions .author-action:hover{background:#181d18!important;color:#ddd7c7!important;border-color:#5c6755!important}

    /* Quiet close control */
    .modal-close{
      width:25px!important;height:25px!important;top:11px!important;right:11px!important;
      border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;
      color:#7f8a7d!important;font:400 19px/1 Arial,sans-serif!important;padding:0!important;
      opacity:.78!important;transform:none!important;transition:color .12s ease,opacity .12s ease!important;
    }
    .modal-close:hover{background:transparent!important;color:#e1e5db!important;opacity:1!important;transform:none!important}

    .modal-prev{left:calc(50% - 405px)!important}
    .modal-next{right:calc(50% - 405px)!important}
  }

  @media(max-width:760px){
    .card-data-toggle-hint{display:none!important}
    .modal-public-body{height:150px!important;min-height:150px!important;max-height:150px!important}
    .card-data-body{height:150px!important;min-height:150px!important;max-height:150px!important}
    .card-data-body .modal-text-wrap{height:119px!important;min-height:119px!important;max-height:119px!important}
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

  function setup(){
    const content=document.querySelector('.modal-content');
    const about=document.getElementById('modalPublicSummary');
    const shell=document.getElementById('cardDataShell');
    if(!content||!about||!shell)return false;

    about.classList.remove('is-collapsed');
    const oldIcon=about.querySelector('.modal-drawer-icon');
    if(oldIcon)oldIcon.remove();
    const head=about.querySelector('.modal-public-head');
    if(head){
      head.removeAttribute('role');
      head.removeAttribute('tabindex');
      head.removeAttribute('aria-expanded');
      head.style.cursor='default';
    }

    const btn=shell.querySelector('.card-data-toggle');
    if(!btn)return false;
    btn.innerHTML='<span class="card-data-toggle-copy"><span class="card-data-toggle-title">CARD DATA</span><span class="card-data-toggle-hint">DESCRIPTION / SCENARIO / INTRO</span></span><span class="card-data-toggle-icon">›</span>';
    btn.setAttribute('aria-label','Switch between About this bot and character card data');

    if(btn.dataset.switchReady!=='1'){
      btn.dataset.switchReady='1';
      btn.addEventListener('click',()=>requestAnimationFrame(sync));
    }

    function sync(){
      const open=shell.classList.contains('open');
      content.classList.toggle('card-data-mode',open);
      btn.setAttribute('aria-expanded',open?'true':'false');
      if(open)normalizeInternalSections();
    }
    sync();

    if(shell.dataset.modeObserver!=='1'){
      shell.dataset.modeObserver='1';
      new MutationObserver(sync).observe(shell,{attributes:true,attributeFilter:['class']});
    }
    const panel=document.getElementById('modalPanel');
    if(panel&&panel.dataset.flatObserver!=='1'){
      panel.dataset.flatObserver='1';
      new MutationObserver(normalizeInternalSections).observe(panel,{childList:true,subtree:true});
    }
    return true;
  }

  function reset(){
    const content=document.querySelector('.modal-content');
    const shell=document.getElementById('cardDataShell');
    if(content)content.classList.remove('card-data-mode');
    if(shell)shell.classList.remove('open');
    setup();
  }
  function install(){
    if(!setup()){setTimeout(install,60);return}
    window.addEventListener('archive:modal-public-ready',reset);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();