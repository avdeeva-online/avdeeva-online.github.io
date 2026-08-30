(()=>{
  if(document.getElementById('archiveCardDataUxStyles'))return;
  const s=document.createElement('style');
  s.id='archiveCardDataUxStyles';
  s.textContent=`
  /* One fixed content viewport. ABOUT and CARD DATA are modes, never stacked. */
  .modal-public-summary,.card-data-shell{border:0!important;background:transparent!important;margin:0!important;padding:0!important;overflow:visible!important}
  .modal-public-summary{margin-top:8px!important;flex:0 0 auto!important}
  .modal-public-head{height:30px!important;min-height:30px!important;padding:0 7px!important;margin:0!important;border-top:1px solid rgba(82,94,78,.32)!important;border-bottom:1px solid rgba(82,94,78,.32)!important;background:rgba(108,123,94,.025)!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:center!important;gap:8px!important;cursor:default!important}
  .modal-public-label{font:700 7.5px/1 var(--mono)!important;letter-spacing:.09em!important;color:#aab4a1!important;white-space:nowrap!important}.modal-public-label:before{content:'//';margin-right:7px;color:#687462!important}
  .modal-public-controls{display:flex!important;align-items:center!important;gap:6px!important}.modal-drawer-icon{display:none!important}
  .modal-public-body{height:118px!important;min-height:118px!important;max-height:118px!important;padding:8px 8px 7px 7px!important;overflow-y:auto!important;overflow-x:hidden!important;border-bottom:1px solid rgba(82,94,78,.32)!important}
  .modal-public-summary.is-collapsed .modal-public-body{display:block!important}

  .card-data-shell{flex:0 0 auto!important}
  .card-data-toggle{height:31px!important;min-height:31px!important;margin:0!important;padding:0 8px!important;border:0!important;border-bottom:1px solid rgba(82,94,78,.32)!important;background:rgba(108,123,94,.018)!important;color:#aab4a1!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;cursor:pointer!important;text-align:left!important;font-family:var(--mono)!important;transform:none!important;transition:background .12s ease,color .12s ease!important}
  .card-data-toggle:hover{background:rgba(108,123,94,.06)!important;color:#d5ddcc!important}
  .card-data-toggle-copy{display:flex!important;align-items:center!important;gap:9px!important;min-width:0!important}.card-data-toggle-title{font:700 7.5px/1 var(--mono)!important;letter-spacing:.09em!important;white-space:nowrap!important}.card-data-toggle-title:before{content:'//';margin-right:7px;color:#687462!important}.card-data-toggle-hint{font:400 6.5px/1 var(--mono)!important;letter-spacing:.04em!important;color:#687264!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  .card-data-toggle-icon{display:inline-block!important;width:auto!important;height:auto!important;border:0!important;background:transparent!important;color:#9eaa96!important;font:12px/1 var(--mono)!important;transform:none!important;transition:none!important}

  /* Closed CARD DATA = switch row. Open CARD DATA replaces ABOUT body in the same 118px viewport. */
  .card-data-body{display:none!important;height:118px!important;min-height:118px!important;max-height:118px!important;overflow:hidden!important;border-bottom:1px solid rgba(82,94,78,.32)!important;background:rgba(8,11,8,.08)!important}
  .card-data-shell.open .card-data-body{display:block!important}
  .card-data-shell.open .card-data-toggle{border-top:1px solid rgba(82,94,78,.32)!important;background:rgba(108,123,94,.045)!important}
  .modal-content.card-data-mode .modal-public-body{display:none!important}
  .modal-content.card-data-mode .card-data-toggle-title{font-size:0!important}.modal-content.card-data-mode .card-data-toggle-title:before{content:'‹  BACK TO ABOUT';font:700 7.5px/1 var(--mono)!important;letter-spacing:.09em!important;color:#c3cbb9!important;margin:0!important}.modal-content.card-data-mode .card-data-toggle-hint{display:none!important}.modal-content.card-data-mode .card-data-toggle-icon{display:none!important}

  .card-data-body .modal-tabs{height:30px!important;min-height:30px!important;margin:0!important;padding:0 8px!important;gap:16px!important;align-items:flex-end!important;border-bottom:1px solid rgba(82,94,78,.24)!important}.card-data-body .modal-tab{padding:0 0 6px!important;font-size:7.5px!important;line-height:1!important}
  .card-data-body .modal-text-wrap{height:87px!important;min-height:87px!important;max-height:87px!important;overflow-y:auto!important;overflow-x:hidden!important;padding:4px 8px 6px!important}
  .card-data-body .dossier-section,.card-data-body .dossier-section.is-collapsed{padding:0 0 6px!important;margin:0 0 6px!important;border-bottom:1px solid rgba(72,81,70,.28)!important}.card-data-body .dossier-body,.card-data-body .dossier-section.is-collapsed .dossier-body{display:block!important}.card-data-body .dossier-title{pointer-events:none!important;cursor:default!important;margin:0 0 4px!important;min-height:15px!important;font-size:7.5px!important;line-height:15px!important}.card-data-body .dossier-arrow{display:none!important}.card-data-body .modal-dossier{padding:3px 0 5px!important;font-size:9.5px!important;line-height:1.42!important}.card-data-body .dossier-paragraph{font-size:9.5px!important;line-height:1.42!important;margin-bottom:5px!important}.card-data-body .intro-choice{padding:4px 6px!important;font-size:7.5px!important}.card-data-body .intro-display{font-size:9.5px!important;line-height:1.42!important;padding:5px 0!important}

  .modal-tags{min-height:0!important;height:auto!important;flex:0 0 auto!important;margin-top:5px!important;margin-bottom:0!important}.modal-hashtags{min-height:0!important;height:auto!important;margin-bottom:0!important;padding-bottom:0!important}
  @media(min-width:761px){.modal-action-groups{margin-top:14px!important;padding-top:6px!important}}
  @media(max-width:760px){.card-data-toggle-hint{display:none!important}.modal-public-body{height:150px!important;min-height:150px!important;max-height:150px!important}.card-data-body{height:150px!important;min-height:150px!important;max-height:150px!important}.card-data-body .modal-text-wrap{height:119px!important;min-height:119px!important;max-height:119px!important}}
  `;
  document.head.appendChild(s);

  function normalizeInternalSections(){document.querySelectorAll('#cardDataShell .dossier-section').forEach(sec=>{sec.classList.remove('is-collapsed');const title=sec.querySelector('.dossier-title');if(title)title.setAttribute('aria-expanded','true')})}

  function setup(){
    const content=document.querySelector('.modal-content'),about=document.getElementById('modalPublicSummary'),shell=document.getElementById('cardDataShell');if(!content||!about||!shell)return false;
    about.classList.remove('is-collapsed');
    const oldIcon=about.querySelector('.modal-drawer-icon');if(oldIcon)oldIcon.remove();
    const head=about.querySelector('.modal-public-head');if(head){head.removeAttribute('role');head.removeAttribute('tabindex');head.removeAttribute('aria-expanded');head.style.cursor='default'}
    const btn=shell.querySelector('.card-data-toggle');if(!btn)return false;
    btn.innerHTML='<span class="card-data-toggle-copy"><span class="card-data-toggle-title">CARD DATA</span><span class="card-data-toggle-hint">DESCRIPTION / SCENARIO / INTRO</span></span><span class="card-data-toggle-icon">›</span>';
    btn.setAttribute('aria-label','Switch between About this bot and character card data');
    if(btn.dataset.switchReady!=='1'){
      btn.dataset.switchReady='1';
      btn.addEventListener('click',()=>requestAnimationFrame(sync));
    }
    function sync(){const open=shell.classList.contains('open');content.classList.toggle('card-data-mode',open);btn.setAttribute('aria-expanded',open?'true':'false');if(open)normalizeInternalSections()}
    sync();
    if(shell.dataset.modeObserver!=='1'){shell.dataset.modeObserver='1';new MutationObserver(sync).observe(shell,{attributes:true,attributeFilter:['class']})}
    const panel=document.getElementById('modalPanel');if(panel&&panel.dataset.flatObserver!=='1'){panel.dataset.flatObserver='1';new MutationObserver(normalizeInternalSections).observe(panel,{childList:true,subtree:true})}
    return true;
  }

  function reset(){const content=document.querySelector('.modal-content'),shell=document.getElementById('cardDataShell');if(content)content.classList.remove('card-data-mode');if(shell)shell.classList.remove('open');setup()}
  function install(){if(!setup()){setTimeout(install,60);return}window.addEventListener('archive:modal-public-ready',reset)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();