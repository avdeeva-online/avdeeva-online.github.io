(()=>{
  const style=document.createElement('style');
  style.id='archiveModalDossierStyles';
  style.textContent=`
    .modal-dossier{padding:7px 2px 10px;color:#aab0a6;font:12px/1.58 Arial,sans-serif}
    .dossier-loading,.dossier-error{padding:14px 2px;color:#6f796b;font:9px var(--mono);letter-spacing:.09em}
    .dossier-error{color:#9b806e}.dossier-error b{display:block;margin-bottom:6px;color:#c2a58e;font-weight:600}.dossier-error small{color:#697267;font:8px var(--mono)}
    .dossier-section{padding:0 0 11px;margin:0 0 10px;border-bottom:1px solid rgba(72,81,70,.38)}
    .dossier-section:last-child{border-bottom:0;margin-bottom:0}
    .dossier-title{display:flex;align-items:center;gap:7px;width:100%;min-height:18px;padding:0;margin:0 0 7px;border:0;background:transparent;color:#c9cfba;font:700 9px/18px var(--mono);letter-spacing:.08em;text-transform:uppercase;text-align:left;cursor:pointer}
    .dossier-title:hover{color:#e0e5d2}
    .dossier-arrow{display:flex;align-items:center;justify-content:center;flex:0 0 10px;width:10px;height:18px;color:#899673;font:700 12px/18px var(--mono);transform:rotate(0deg);transform-origin:center;transition:transform .16s ease}
    .dossier-section.is-collapsed .dossier-arrow{transform:rotate(-90deg)}
    .dossier-body{display:block}.dossier-section.is-collapsed .dossier-body{display:none}
    .dossier-section.is-collapsed{padding-bottom:7px;margin-bottom:7px}.dossier-section.is-collapsed .dossier-title{margin-bottom:0}
    .dossier-list{display:grid;gap:5px;margin:0;padding:0;list-style:none}.dossier-list li{position:relative;padding-left:12px;color:#a6aca2}.dossier-list li:before{content:'·';position:absolute;left:1px;top:0;color:#78836c;font-weight:700}.dossier-list strong{color:#c5cab9;font-weight:600}
    .dossier-paragraph{margin:0 0 7px;color:#a8aea4;white-space:pre-wrap}.dossier-paragraph:last-child{margin-bottom:0}.modal-intros .intro-display{white-space:pre-wrap}
  `;
  document.head.appendChild(style);
  function inlineFormat(text){const safe=esc(String(text||''));const i=safe.indexOf(':');if(i>0&&i<42){const head=safe.slice(0,i).trim(),rest=safe.slice(i+1).trim();if(head&&rest)return `<strong>${head}:</strong> ${rest}`}return safe}
  function splitHeader(line){const raw=line.replace(/^>\s*/,'').trim(),i=raw.indexOf(':');if(i>0&&i<48){const title=raw.slice(0,i).trim(),rest=raw.slice(i+1).trim();if(title&&rest)return{title,rest}}return{title:raw,rest:''}}
  function structuredText(raw){
    const text=String(raw||'').replace(/\r/g,'').trim();if(!text)return '';
    const normalized=text.replace(/\s+(?=>[A-Z][A-Z /&-]{2,}(?:\s|$))/g,'\n').replace(/\s+(?=>[A-Z][A-Za-z /&-]{2,}:?\s*-)/g,'\n');
    const lines=normalized.split('\n').map(x=>x.trim()).filter(Boolean),sections=[];let current={title:'',items:[],paras:[]};
    const push=()=>{if(current.title||current.items.length||current.paras.length)sections.push(current);current={title:'',items:[],paras:[]}};
    for(const line of lines){if(/^>\s*/.test(line)){push();const h=splitHeader(line);current.title=h.title;if(h.rest)current.paras.push(h.rest)}else if(/^[-•]\s+/.test(line)){current.items.push(line.replace(/^[-•]\s+/,''))}else{const parts=line.split(/\s+-\s+(?=[A-Z][A-Za-z /()'-]{1,35}:)/g);if(parts.length>1){if(parts[0].trim())current.paras.push(parts[0].trim());current.items.push(...parts.slice(1).map(x=>x.trim()).filter(Boolean))}else current.paras.push(line)}}push();
    if(!sections.length)return `<div class="modal-dossier"><p class="dossier-paragraph">${esc(text)}</p></div>`;
    return `<div class="modal-dossier">${sections.map((s,i)=>{const body=`${s.paras.map(p=>`<p class="dossier-paragraph">${esc(p)}</p>`).join('')}${s.items.length?`<ul class="dossier-list">${s.items.map(item=>`<li>${inlineFormat(item)}</li>`).join('')}</ul>`:''}`;if(!s.title)return `<section class="dossier-section"><div class="dossier-body">${body}</div></section>`;return `<section class="dossier-section is-collapsed" data-dossier-section="${i}"><button type="button" class="dossier-title" aria-expanded="false"><span class="dossier-arrow">⌄</span><span>${esc(s.title)}</span></button><div class="dossier-body">${body}</div></section>`}).join('')}</div>`;
  }
  function bindDossierToggles(panel){panel.querySelectorAll('.dossier-title').forEach(button=>button.addEventListener('click',()=>{const section=button.closest('.dossier-section');if(!section)return;const collapsed=section.classList.toggle('is-collapsed');button.setAttribute('aria-expanded',collapsed?'false':'true')}))}
  renderModalPanel=function(){
    const panel=document.querySelector('#modalPanel');if(!panel)return;if(!current){panel.innerHTML='';return}
    if(current._definitionLoading){panel.innerHTML='<div class="dossier-loading">LOADING RECORD...</div>';panel.scrollTop=0;return}
    if(current._definitionError){panel.innerHTML=`<div class="dossier-error"><b>RECORD COULD NOT BE LOADED.</b><small>${esc(current._definitionError)}</small></div>`;panel.scrollTop=0;return}
    if(modalTab==='description'){const text=String(current.full||'').trim();panel.innerHTML=text?structuredText(text):'<div class="modal-dossier"><p class="dossier-paragraph">No description available.</p></div>';bindDossierToggles(panel);panel.scrollTop=0;return}
    if(modalTab==='scenario'){const text=String(current.scenario||'').trim();panel.innerHTML=text?structuredText(text):'<div class="modal-dossier"><p class="dossier-paragraph">No scenario available.</p></div>';bindDossierToggles(panel);panel.scrollTop=0;return}
    const intros=(Array.isArray(current.intros)?current.intros:[]).map(x=>String(x||'').trim()).filter(Boolean);
    if(!intros.length){panel.innerHTML='<div class="modal-intros"><div class="intro-display intro-empty">NO INTRO MESSAGE AVAILABLE</div></div>';panel.scrollTop=0;return}
    if(openIntro<0||openIntro>=intros.length)openIntro=0;const buttons=intros.map((_,i)=>`<button class="intro-choice ${openIntro===i?'active':''}" data-intro-index="${i}">INTRO ${String(i+1).padStart(2,'0')}</button>`).join('');panel.innerHTML=`<div class="modal-intros"><div class="intro-choices">${buttons}</div><div class="intro-display show">${esc(intros[openIntro])}</div></div>`;panel.scrollTop=0;
  };
})();
