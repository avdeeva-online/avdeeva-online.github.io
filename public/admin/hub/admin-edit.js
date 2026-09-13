(()=>{
  localStorage.setItem('archiveHubAdmin','1');
  const $=s=>document.querySelector(s);
  const allowedSettings=new Set(['modern','fantasy','medieval','post-apocalypse','sci-fi','omegaverse','rusreal']);
  const normalizeSettings=arr=>[...new Set((Array.isArray(arr)?arr:[]).map(x=>{x=String(x).toLowerCase();if(x==='historical')return'medieval';if(x==='magic')return'fantasy';return x}).filter(x=>allowedSettings.has(x)))];
  let editResource=null;
  const oldFetch=window.fetch.bind(window);

  function setStatus(text,kind=''){const e=$('#analyzeStatus');if(!e)return;e.textContent=text;e.className='status '+kind}
  function syncSettingChoices(){
    const box=$('#settingChoices');if(!box)return;
    ['historical','magic'].forEach(v=>{const b=box.querySelector(`.choice[data-v="${v}"]`);if(b){if(b.classList.contains('active'))b.click();b.remove()}});
    if(!box.querySelector('.choice[data-v="rusreal"]')){const b=document.createElement('button');b.type='button';b.className='choice';b.dataset.v='rusreal';b.textContent='RUSREAL';box.appendChild(b)}
  }
  syncSettingChoices();
  new MutationObserver(syncSettingChoices).observe(document.body,{subtree:true,childList:true});

  const full=$('#fullDesc');
  if(full&&!$('#additionalInfo')){const wrap=document.createElement('div');wrap.className='field';wrap.innerHTML='<label>ADDITIONAL INFO / AUTHOR NOTES</label><textarea id="additionalInfo" placeholder="Дополнительные настройки, пояснения автора, заметки, ссылки и другая информация для вкладки EXTRAS."></textarea>';full.closest('.field').insertAdjacentElement('afterend',wrap)}
  const fileField=$('#fileDrop')?.closest('.field');
  if(fileField&&!$('#existingFiles')){const box=document.createElement('div');box.id='existingFiles';box.style.marginTop='10px';fileField.appendChild(box)}

  function choose(boxSelector,values,multi=true){const box=$(boxSelector);if(!box)return;const normalized=boxSelector==='#settingChoices'?normalizeSettings(values):(Array.isArray(values)?values:[values]);const wanted=new Set(normalized);box.querySelectorAll('.choice').forEach(b=>{const should=wanted.has(b.dataset.v),active=b.classList.contains('active');if(should!==active)b.click()})}
  function selected(boxSelector){return[...document.querySelectorAll(`${boxSelector} .choice.active`)].map(b=>b.dataset.v)}
  function snapshotManual(){return{title:$('#title')?.value||'',creator:$('#creator')?.value||'',creatorLink:$('#creatorLink')?.value||'',short:$('#shortDesc')?.value||'',full:$('#fullDesc')?.value||'',extra:$('#extraTags')?.value||'',additional:$('#additionalInfo')?.value||'',type:selected('#typeChoices')[0]||'other',models:selected('#modelChoices'),settings:normalizeSettings(selected('#settingChoices'))}}
  function restoreManual(s){if(!s)return;$('#title').value=s.title;$('#creator').value=s.creator;$('#creatorLink').value=s.creatorLink;$('#shortDesc').value=s.short;$('#fullDesc').value=s.full;$('#extraTags').value=s.extra;if($('#additionalInfo'))$('#additionalInfo').value=s.additional;choose('#typeChoices',s.type,false);choose('#modelChoices',s.models);choose('#settingChoices',s.settings);['#title','#creator','#creatorLink','#shortDesc','#fullDesc','#additionalInfo','#extraTags'].forEach(sel=>$(sel)?.dispatchEvent(new Event('input',{bubbles:true})))}

  window.fetch=async(input,init={})=>{
    const url=typeof input==='string'?input:input?.url||'';
    if(url.includes('/api/admin/hub-resource')&&init.method==='POST'){
      try{
        const patchDraft=d=>{d=d&&typeof d==='object'?d:{};d.settings=normalizeSettings(d.settings);d.additional_info=$('#additionalInfo')?.value?.trim()||'';if(editResource){d.editing_id=editResource.id;d.source=d.source||{};d.source.url=editResource.source_url;if(!Array.isArray(d.media)||!d.media.length)d.media=Array.isArray(editResource.media)?editResource.media:[]}return d};
        if(init.body instanceof FormData){const fd=init.body,part=fd.get('resource');let raw='{}';if(part instanceof File||part instanceof Blob)raw=await part.text();else if(part!=null)raw=String(part);const d=patchDraft(JSON.parse(raw||'{}'));fd.set('resource',new Blob([JSON.stringify(d)],{type:'application/json'}),'resource.json')}
        else if(typeof init.body==='string')init={...init,body:JSON.stringify(patchDraft(JSON.parse(init.body||'{}')))};
      }catch(e){console.warn('Admin publish patch failed',e)}
    }
    return oldFetch(input,init);
  };

  function renderExistingFiles(){const box=$('#existingFiles');if(!box)return;const files=Array.isArray(editResource?.files)?editResource.files:[];if(!files.length){box.innerHTML=editResource?'<div class="file-summary">NO EXISTING FILES</div>':'';return}box.innerHTML='<div class="file-summary" style="margin-bottom:6px">EXISTING FILES</div>'+files.map(f=>`<div class="file-row" data-existing-id="${String(f.id)}"><div><div class="file-name">${String(f.name||'FILE').replace(/[<>&]/g,'')}</div><div class="file-meta">${String(f.mime||'FILE')} · ${Math.max(0,Number(f.size)||0)} B${f.primary?' · PRIMARY':''}</div></div><a class="file-action" href="${f.download_url}" target="_blank">OPEN</a><button class="file-action remove" type="button" data-delete-file="${String(f.id)}">REMOVE</button></div>`).join('');box.querySelectorAll('[data-delete-file]').forEach(btn=>btn.onclick=async()=>{if(!confirm('Remove this file from the resource?'))return;btn.disabled=true;const id=btn.dataset.deleteFile;try{const r=await oldFetch(`/api/admin/hub-resource/${encodeURIComponent(editResource.id)}/files/${encodeURIComponent(id)}`,{method:'DELETE'}),d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(d.error||`HTTP_${r.status}`);editResource.files=editResource.files.filter(f=>String(f.id)!==String(id));renderExistingFiles();setStatus('FILE REMOVED.','ok')}catch(e){setStatus('FILE REMOVE FAILED: '+e.message,'bad');btn.disabled=false}})}

  function fillResource(r){editResource=r;$('#postUrl').value=r.source_url||'';$('#rawText').value=r.description_full||'';$('#sourceLink').textContent=r.source_url||'';$('#title').value=r.title||'';$('#creator').value=r.creator?.name||'';$('#creatorLink').value=r.creator?.link||'';$('#shortDesc').value=r.description_short||'';$('#fullDesc').value=r.description_full||'';$('#additionalInfo').value=r.additional_info||'';$('#extraTags').value=(r.tags||[]).join(', ');choose('#typeChoices',r.type,false);choose('#modelChoices',r.models||[]);choose('#settingChoices',normalizeSettings(r.settings||[]));const pub=$('#publish');if(pub)pub.textContent='UPDATE RESOURCE';renderExistingFiles();document.querySelector('h1').textContent='EDIT TAVO HUB RESOURCE';setStatus('EDIT MODE · '+(r.title||r.id),'ok');['#title','#creator','#creatorLink','#shortDesc','#fullDesc','#additionalInfo','#extraTags','#postUrl'].forEach(sel=>$(sel)?.dispatchEvent(new Event('input',{bubbles:true})))}

  async function initEdit(){const id=new URLSearchParams(location.search).get('edit');if(!id)return;setStatus('LOADING RESOURCE...');try{const r=await oldFetch('/api/hub-resources',{cache:'no-store'}),d=await r.json();if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP_${r.status}`);const item=(d.resources||[]).find(x=>String(x.id)===String(id));if(!item)throw new Error('RESOURCE_NOT_FOUND');fillResource(item)}catch(e){setStatus('EDIT LOAD FAILED: '+e.message,'bad')}}

  const originalReanalyze=$('#reanalyze')?.onclick;
  if(originalReanalyze)$('#reanalyze').onclick=async e=>{const s=snapshotManual();await originalReanalyze.call($('#reanalyze'),e);restoreManual(s);setStatus('RE-ANALYZED · MANUAL EDITS PRESERVED.','ok')};

  const urlInput=$('#postUrl');
  urlInput?.addEventListener('change',()=>{const key='archiveHubDraft:'+urlInput.value.trim();const raw=localStorage.getItem(key);if(!raw||new URLSearchParams(location.search).get('edit'))return;try{const d=JSON.parse(raw);if(confirm('Saved draft found for this Telegram post. Restore it?')){restoreManual({title:d.title||'',creator:d.creator?.name||'',creatorLink:d.creator?.link||'',short:d.description_short||'',full:d.description_full||'',extra:(d.tags||[]).join(', '),additional:d.additional_info||'',type:d.type||'other',models:d.models||[],settings:normalizeSettings(d.settings||[])});setStatus('SAVED DRAFT RESTORED.','ok')}}catch{}});

  initEdit();
})();