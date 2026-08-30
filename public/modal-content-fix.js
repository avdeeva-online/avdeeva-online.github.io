(()=>{
  // Modal content must use the full database fields. `short` is only for catalog cards.
  // Scenario and intros are stored separately and are not character-limited here.
  renderModalPanel=function(){
    const panel=document.querySelector('#modalPanel');
    if(!panel)return;
    if(!current){panel.innerHTML='';return}

    if(modalTab==='description'){
      const text=String(current.full||current.short||'').trim();
      panel.innerHTML=`<p class="modal-copy">${esc(text||'No description available.')}</p>`;
      panel.scrollTop=0;
      return;
    }

    if(modalTab==='scenario'){
      const text=String(current.scenario||'').trim();
      panel.innerHTML=`<p class="modal-copy">${esc(text||'No scenario available.')}</p>`;
      panel.scrollTop=0;
      return;
    }

    const intros=(Array.isArray(current.intros)?current.intros:[])
      .map(x=>String(x||'').trim())
      .filter(Boolean);

    if(!intros.length){
      panel.innerHTML='<div class="modal-intros"><div class="intro-display intro-empty">NO INTRO MESSAGE AVAILABLE</div></div>';
      panel.scrollTop=0;
      return;
    }

    if(openIntro<0||openIntro>=intros.length)openIntro=0;
    const buttons=intros.map((_,i)=>`<button class="intro-choice ${openIntro===i?'active':''}" data-intro-index="${i}">INTRO ${String(i+1).padStart(2,'0')}</button>`).join('');
    const body=`<div class="intro-display show">${esc(intros[openIntro])}</div>`;
    panel.innerHTML=`<div class="modal-intros"><div class="intro-choices">${buttons}</div>${body}</div>`;
    panel.scrollTop=0;
  };
})();
