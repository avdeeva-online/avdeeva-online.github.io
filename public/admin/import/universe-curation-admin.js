(()=>{
  'use strict';
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let data={rules:[],canonicalUniverses:[]},loading=false,loaded=false;

  function ensureEditorLink(){const tabs=document.querySelector('.tabs');if(!tabs||tabs.querySelector('[data-bot-editor-link]'))return;const a=document.createElement('a');a.className='btn';a.href='edit.html';a.dataset.botEditorLink='1';a.textContent='BOT CARDS';tabs.insertBefore(a,tabs.querySelector('a[href="../hub/"]')||null)}

  function ensureUi(){
    const panel=$('#universePanel');
    if(!panel||$('#curationRegistryBlock'))return;
    const block=document.createElement('div');
    block.id='curationRegistryBlock';
    block.innerHTML=`
      <div class="section-title" style="margin-top:22px"><b>CURATION REGISTRY</b><span>SOURCE → PUBLIC UNIVERSE</span></div>
      <div class="hint">Исходное значение импорта не меняется. Здесь задаётся только то, что увидит публичный каталог. Ручные значения персонажа (admin:manual) имеют приоритет.</div>
      <div id="curationStatus" class="status">NOT LOADED YET. OPEN UNIVERSE REVIEW TO LOAD.</div>
      <div class="panel" style="margin-top:10px;padding:10px">
        <div style="display:grid;grid-template-columns:minmax(180px,1.4fr) minmax(180px,1fr);gap:7px">
          <input id="curationSource" placeholder="Imported/source Universe exactly">
          <input id="curationPublic" list="curationCanonicalNames" placeholder="Public Universe(s), comma separated">
          <input id="curationParent" list="curationCanonicalNames" placeholder="Parent Universe (optional)">
          <input id="curationSub" list="curationCanonicalNames" placeholder="Subuniverse (optional)">
        </div>
        <div class="toolbar" style="margin:8px 0 0"><button class="btn primary" id="curationSave" type="button">SAVE RULE</button><button class="btn" id="curationClear" type="button">CLEAR FORM</button><span class="count" id="curationCount">000 RULES</span></div>
      </div>
      <datalist id="curationCanonicalNames"></datalist>
      <div id="curationList" class="universe-list"><div class="empty">CURATION REGISTRY NOT LOADED</div></div>`;
    panel.appendChild(block);
    $('#curationSave').addEventListener('click',saveRule);
    $('#curationClear').addEventListener('click',clearForm);
    $('#curationList').addEventListener('click',listAction);
  }

  function clearForm(){for(const id of ['curationSource','curationPublic','curationParent','curationSub']){const el=$('#'+id);if(el)el.value=''}}
  function fillForm(rule){$('#curationSource').value=rule.source||'';$('#curationPublic').value=(rule.publicUniverses||[]).join(', ');$('#curationParent').value=rule.parentUniverse||'';$('#curationSub').value=rule.subuniverse||'';$('#curationSource').focus()}

  function render(){
    ensureUi();
    const list=$('#curationList'),count=$('#curationCount'),dl=$('#curationCanonicalNames');
    if(count)count.textContent=`${String(data.rules.length).padStart(3,'0')} RULES`;
    if(dl)dl.innerHTML=(data.canonicalUniverses||[]).map(x=>`<option value="${esc(x)}"></option>`).join('');
    if(!list)return;
    list.innerHTML=data.rules.length?data.rules.map(rule=>{
      const publicText=(rule.publicUniverses||[]).join(' + ')||'—';
      const hierarchy=[rule.parentUniverse?`MAIN: ${rule.parentUniverse}`:'',rule.subuniverse?`SUB: ${rule.subuniverse}`:''].filter(Boolean).join(' · ');
      return `<div class="universe-row ${rule.active?'':'flagged'}" data-curation-source="${esc(rule.source)}">
        <div class="universe-copy"><b>${esc(rule.source)}</b><small>PUBLIC → ${esc(publicText)}</small>${hierarchy?`<div class="review-note">${esc(hierarchy)}</div>`:''}</div>
        <div class="universe-edit"><button class="btn" data-curation-edit type="button">EDIT</button><button class="btn ${rule.active?'':'warn'}" data-curation-toggle type="button">${rule.active?'DISABLE':'ENABLE'}</button></div>
      </div>`;
    }).join(''):'<div class="empty">NO CURATION RULES</div>';
  }

  async function load(force=false){
    ensureUi();if(loading||(!force&&loaded))return;loading=true;
    const status=$('#curationStatus');if(status)status.textContent='LOADING CURATION REGISTRY...';
    try{const r=await fetch('/api/admin/universe-curation',{cache:'no-store'}),d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(d.error||d.message||`HTTP_${r.status}`);data=d;loaded=true;render();if(status)status.textContent=`READY. ${d.count||0} CURATION RULES. IMPORT SOURCE VALUES ARE UNCHANGED.`}catch(e){if(status)status.textContent=`CURATION LOAD FAILED: ${e.message}`}finally{loading=false}
  }

  async function post(payload){const r=await fetch('/api/admin/universe-curation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}),d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(d.error||d.message||`HTTP_${r.status}`);return d}

  async function saveRule(){
    const source=$('#curationSource')?.value.trim()||'',publicUniverses=($('#curationPublic')?.value||'').split(',').map(x=>x.trim()).filter(Boolean),parentUniverse=$('#curationParent')?.value.trim()||'',subuniverse=$('#curationSub')?.value.trim()||'',status=$('#curationStatus'),btn=$('#curationSave');
    if(!source||!publicUniverses.length){status.textContent='SOURCE AND AT LEAST ONE PUBLIC UNIVERSE ARE REQUIRED.';return}
    btn.disabled=true;try{await post({action:'set',source,publicUniverses,parentUniverse,subuniverse});status.textContent=`SAVED: ${source} → ${publicUniverses.join(' + ')}`;clearForm();await load(true)}catch(e){status.textContent=`SAVE FAILED: ${e.message}`}finally{btn.disabled=false}
  }

  async function listAction(event){
    const row=event.target.closest('[data-curation-source]');if(!row)return;const source=row.dataset.curationSource,rule=data.rules.find(x=>x.source===source),status=$('#curationStatus'),button=event.target.closest('button');if(!button||button.disabled)return;
    if(button.matches('[data-curation-edit]')){if(rule)fillForm(rule);return}
    if(!button.matches('[data-curation-toggle]'))return;
    button.disabled=true;
    try{await post({action:'toggle',source});await load(true)}catch(e){status.textContent=`CURATION ACTION FAILED: ${e.message}`}finally{if(button.isConnected)button.disabled=false}
  }

  function init(){ensureEditorLink();ensureUi();document.querySelector('[data-mode="universes"]')?.addEventListener('click',()=>load())}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
