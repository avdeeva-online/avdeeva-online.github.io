(()=>{
  if(document.getElementById('archiveModalUxCleanup'))return;
  const s=document.createElement('style');
  s.id='archiveModalUxCleanup';
  s.textContent=`
  @media(min-width:761px){
    /* The gap below hashtags was not useful content. Keep footer visually attached to metadata. */
    .modal-action-groups{margin-top:10px!important}
    .modal-tags{margin-bottom:0!important;min-height:0!important;height:auto!important;flex:0 0 auto!important}
    .modal-hashtags{min-height:0!important;margin-bottom:0!important}

    /* Card-data drawer: one disclosure only. */
    .card-data-toggle{
      height:29px!important;
      padding:0 7px!important;
      margin:3px 0!important;
      border:1px solid rgba(103,117,92,.28)!important;
      border-radius:3px!important;
      background:rgba(105,122,91,.035)!important;
      color:#aab5a1!important;
      cursor:pointer!important;
    }
    .card-data-toggle:hover{background:rgba(105,122,91,.08)!important;color:#d2d9ca!important}
    .card-data-toggle span:last-child{transition:none!important;transform:none!important}
    .card-data-shell.open .card-data-toggle span:last-child{transform:none!important}
    .card-data-body{height:112px!important;max-height:112px!important}
    .card-data-body .modal-tabs{height:27px!important;min-height:27px!important;gap:16px!important;padding:0 5px!important}
    .card-data-body .modal-tab{font-size:7.5px!important;padding:0!important}
    .card-data-body .modal-text-wrap{height:82px!important;max-height:82px!important}

    /* No accordion-inside-accordion. Internal sections are just readable rows. */
    .card-data-body .dossier-section,
    .card-data-body .dossier-section.is-collapsed{padding:0 0 6px!important;margin:0 0 6px!important}
    .card-data-body .dossier-body,
    .card-data-body .dossier-section.is-collapsed .dossier-body{display:block!important}
    .card-data-body .dossier-title{
      cursor:default!important;
      pointer-events:none!important;
      margin:0 0 4px!important;
      min-height:15px!important;
      font-size:7.5px!important;
    }
    .card-data-body .dossier-arrow{display:none!important}
  }
  `;
  document.head.appendChild(s);

  function normalizeSections(){
    document.querySelectorAll('#cardDataShell .dossier-section').forEach(sec=>{
      sec.classList.remove('is-collapsed');
      const btn=sec.querySelector('.dossier-title');
      if(btn)btn.setAttribute('aria-expanded','true');
    });
  }

  function syncToggle(){
    const shell=document.querySelector('#cardDataShell');
    if(!shell)return;
    const btn=shell.querySelector('.card-data-toggle');
    if(!btn)return;
    const open=shell.classList.contains('open');
    btn.innerHTML=open
      ? '<span>−&nbsp;&nbsp;HIDE CARD DATA</span><span>DESCRIPTION · SCENARIO · INTRO</span>'
      : '<span>＋&nbsp;&nbsp;VIEW CARD DATA</span><span>DESCRIPTION · SCENARIO · INTRO</span>';
    btn.setAttribute('aria-expanded',open?'true':'false');
    if(open)normalizeSections();
  }

  function install(){
    const shell=document.querySelector('#cardDataShell');
    if(!shell){setTimeout(install,60);return}
    syncToggle();
    new MutationObserver(()=>{syncToggle();normalizeSections()}).observe(shell,{attributes:true,subtree:true,childList:true,attributeFilter:['class']});
    const panel=document.querySelector('#modalPanel');
    if(panel)new MutationObserver(normalizeSections).observe(panel,{childList:true,subtree:true});
    document.addEventListener('click',e=>{
      if(e.target.closest('#cardDataShell .modal-tab'))setTimeout(normalizeSections,0);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();