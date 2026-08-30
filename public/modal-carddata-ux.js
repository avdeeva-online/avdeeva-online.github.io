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
  .card-data-toggle-icon{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border:1px solid #46503f;border-radius:4px;color:#a5af98;font:12px/1 var(--mono);transition:transform .16s ease,background .16s ease}
  .card-data-shell.open .card-data-toggle-icon{transform:rotate(180deg);background:#1d241b}
  .card-data-shell.open .card-data-toggle{background:rgba(112,126,96,.065)!important;color:#d5ddcc!important}

  .card-data-body{height:96px!important;max-height:96px!important;overflow:hidden!important;background:rgba(8,11,8,.14)}
  .card-data-body .modal-tabs{height:30px!important;margin:0!important;gap:14px!important;padding:0 8px!important;align-items:flex-end!important}
  .card-data-body .modal-tab{padding:0 0 6px!important;font-size:7.5px!important;line-height:1!important}
  .card-data-body .modal-text-wrap{height:66px!important;max-height:66px!important;min-height:66px!important;overflow-y:auto!important;overflow-x:hidden!important;padding:2px 8px 4px 8px!important}
  .card-data-body .modal-dossier{padding:3px 0 5px!important;font-size:10px!important;line-height:1.45!important}
  .card-data-body .dossier-section{padding-bottom:5px!important;margin-bottom:5px!important}
  .card-data-body .dossier-title{font-size:7.5px!important;min-height:15px!important;line-height:15px!important;margin-bottom:3px!important}
  .card-data-body .dossier-arrow{height:15px!important;line-height:15px!important;font-size:10px!important}
  .card-data-body .dossier-paragraph{font-size:10px!important;line-height:1.45!important;margin-bottom:5px!important}
  .card-data-body .intro-choices{margin-bottom:5px!important;gap:4px!important}
  .card-data-body .intro-choice{padding:4px 6px!important;font-size:7.5px!important}
  .card-data-body .intro-display{font-size:10px!important;line-height:1.45!important;padding:5px 0!important}
  @media(max-width:760px){
    .card-data-toggle-hint{display:none}
    .card-data-body{height:auto!important;max-height:150px!important}
    .card-data-body .modal-text-wrap{height:auto!important;min-height:0!important;max-height:112px!important}
  }
  `;
  document.head.appendChild(s);

  function upgrade(){
    const shell=document.getElementById('cardDataShell');
    if(!shell)return;
    const btn=shell.querySelector('.card-data-toggle');
    if(!btn||btn.dataset.uxReady==='1')return;
    btn.dataset.uxReady='1';
    btn.setAttribute('aria-label','Show or hide internal character card data');
    btn.innerHTML=`<span class="card-data-toggle-copy"><span class="card-data-toggle-title">VIEW CARD DATA</span><span class="card-data-toggle-hint">DESCRIPTION / SCENARIO / INTRO</span></span><span class="card-data-toggle-icon">⌄</span>`;
  }

  upgrade();
  const mo=new MutationObserver(upgrade);
  mo.observe(document.documentElement,{childList:true,subtree:true});
})();