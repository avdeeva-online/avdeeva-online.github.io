(()=>{
  if(document.getElementById('archiveCardDataUxStyles'))return;
  const s=document.createElement('style');
  s.id='archiveCardDataUxStyles';
  s.textContent=`
  .card-data-shell{border-top:1px solid rgba(82,94,78,.28)!important;border-bottom:1px solid rgba(82,94,78,.34)!important}
  .card-data-toggle{
    min-height:30px!important;height:30px!important;
    padding:0 8px!important;margin:0!important;
    border:0!important;background:rgba(112,126,96,.035)!important;
    color:#a3ad98!important;cursor:pointer!important;
    display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;
    align-items:center!important;gap:8px!important;text-align:left!important;
    font-family:var(--mono)!important;
  }
  .card-data-toggle:hover{background:rgba(112,126,96,.075)!important;color:#d4dcc9!important}
  .card-data-toggle-copy{display:flex;align-items:center;gap:9px;min-width:0}
  .card-data-toggle-title{font-size:8px;font-weight:700;letter-spacing:.08em;white-space:nowrap}
  .card-data-toggle-hint{font-size:6.5px;font-weight:400;letter-spacing:.04em;color:#687265;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .card-data-toggle-icon{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border:1px solid #46503f;border-radius:4px;color:#a5af98;font:10px/1 var(--mono);transition:none!important;background:transparent!important;transform:none!important}
  .card-data-shell.open .card-data-toggle-icon{transform:none!important;background:rgba(112,126,96,.07)!important}
  .card-data-shell.open .card-data-toggle{background:rgba(112,126,96,.065)!important;color:#d5ddcc!important}

  /* One disclosure only. No accordion-inside-accordion. */
  .card-data-body{height:100px!important;max-height:100px!important;overflow:hidden!important;background:rgba(8,11,8,.14)}
  .card-data-body .modal-tabs{height:29px!important;margin:0!important;gap:14px!important;padding:0 8px!important;align-items:flex-end!important}
  .card-data-body .modal-tab{padding:0 0 6px!important;font-size:7.5px!important;line-height:1!important}
  .card-data-body .modal-text-wrap{height:71px!important;max-height:71px!important;min-height:71px!important;overflow-y:auto!important;overflow-x:hidden!important;padding:3px 8px 5px 8px!important}
  .card-data-body .modal-dossier{padding:2px 0 4px!important;font-size:9.5px!important;line-height:1.42!important}
  .card-data-body .dossier-section,.card-data-body .dossier-section.is-collapsed{padding-bottom:5px!important;margin-bottom:5px!important}
  .card-data-body .dossier-body,.card-data-body .dossier-section.is-collapsed .dossier-body{display:block!important}
  .card-data-body .dossier-title{font-size:7.5px!important;min-height:15px!important;line-height:15px!important;margin-bottom:3px!important;cursor:default!important;pointer-events:none!important}
  .card-data-body .dossier-arrow{display:none!important}
  .card-data-body .dossier-paragraph{font-size:9.5px!important;line-height:1.42!important;margin-bottom:5px!important}
  .card-data-body .intro-choices{margin-bottom:5px!important;gap:4px!important}
  .card-data-body .intro-choice{padding:4px 6px!important;font-size:7.5px!important}
  .card-data-body .intro-display{font-size:9.5px!important;line-height:1.42!important;padding:5px 0!important}

  /* Hashtags are metadata, not a giant empty section. */
  .modal-tags{min-height:0!important;height:auto!important;flex:0 0 auto!important;margin-bottom:0!important}
  .modal-hashtags{min-height:0!important;height:auto!important;margin-bottom:0!important;padding-bottom:0!important}
  .modal-action-groups{margin-top:10px!important}

  @media(max-width:760px){
    .card-data-toggle-hint{display:none}
    .card-data-body{height:auto!important;max-height:150px!important}
    .card-data-body .modal-text-wrap{height:auto!important;min-height:0!important;max-height:112px!important}
  }
  `;
  document.head.appendChild(s);

  function normalizeSections(){
    document.querySelectorAll('#cardDataShell .dossier-section').forEach(sec=>{
      sec.classList.remove('is-collapsed');
      const title=sec.querySelector('.dossier-title');
      if(title)title.setAttribute('aria-expanded','true');
    });
  }

  function syncButton(){
    const shell=document.getElementById('cardDataShell');
    if(!shell)return;
    const btn=shell.querySelector('.card-data-toggle');
    if(!btn)return;
    const open=shell.classList.contains('open');
    btn.dataset.uxReady='1';
    btn.setAttribute('aria-label',open?'Hide internal character card data':'Show internal character card data');
    btn.setAttribute('aria-expanded',open?'true':'false');
    btn.innerHTML=`<span class="card-data-toggle-copy"><span class="card-data-toggle-title">${open?'HIDE CARD DATA':'VIEW CARD DATA'}</span><span class="card-data-toggle-hint">DESCRIPTION / SCENARIO / INTRO</span></span><span class="card-data-toggle-icon">${open?'−':'+'}</span>`;
    if(open)normalizeSections();
  }

  function install(){
    const shell=document.getElementById('cardDataShell');
    if(!shell){setTimeout(install,60);return}
    syncButton();
    new MutationObserver(()=>{syncButton();normalizeSections()}).observe(shell,{attributes:true,childList:true,subtree:true,attributeFilter:['class']});
    const panel=document.getElementById('modalPanel');
    if(panel)new MutationObserver(normalizeSections).observe(panel,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();