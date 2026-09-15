(()=>{
  const tabs=document.querySelector('.tabs');
  if(tabs&&!tabs.querySelector('[data-admin-home]')){
    const a=document.createElement('a');
    a.href='/admin/';
    a.dataset.adminHome='1';
    a.className='btn';
    a.textContent='← BACK';
    a.setAttribute('aria-label','Back to admin home');
    tabs.prepend(a);
  }

  if(!/\/admin\/hub\/drafts\.html$/.test(location.pathname))return;
  const editor=document.querySelector('#editor'),fields=editor?.querySelector('.fields'),status=document.querySelector('#status');
  if(!editor||!fields||document.querySelector('[data-draft-merge]'))return;

  const block=document.createElement('div');
  block.className='field';
  block.dataset.draftMerge='1';
  block.innerHTML=`<label>MERGE ANOTHER DRAFT</label><div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px"><select id="mergeDraftSelect"><option value="">SELECT DRAFT…</option></select><button class="btn" type="button" id="mergeDraftBtn">MERGE</button></div><div style="margin-top:5px;font-size:7px;color:#6f7a69;line-height:1.45">Use this when distant Telegram posts belong to one resource. The selected draft is absorbed into the open draft; posts, media and files are combined.</div>`;
  const sourceField=[...fields.children].find(x=>x.querySelector?.('label')?.textContent?.trim()==='SOURCE POSTS');
  fields.insertBefore(block,sourceField||fields.lastElementChild);
  const select=block.querySelector('#mergeDraftSelect'),btn=block.querySelector('#mergeDraftBtn');

  const currentId=()=>document.querySelector('#list .draft.active')?.dataset.id||'';
  async function refresh(){
    const id=currentId();
    if(!id){select.innerHTML='<option value="">SELECT DRAFT…</option>';return}
    try{
      const r=await fetch('/api/admin/telegram-drafts',{cache:'no-store'}),d=await r.json();
      const rows=(d.drafts||[]).filter(x=>x.id!==id);
      select.innerHTML='<option value="">SELECT DRAFT…</option>'+rows.map(x=>`<option value="${x.id}">${String(x.title||'UNTITLED').replace(/[<>&"]/g,'')} · ${String(x.source_url||'').split('/').pop()}</option>`).join('');
    }catch{}
  }
  btn.onclick=async()=>{
    const target=currentId(),source=select.value;
    if(!target||!source)return;
    const label=select.options[select.selectedIndex]?.textContent||'selected draft';
    if(!confirm(`Merge ${label} into the open draft?\n\nThe selected draft will be removed after its posts/files are transferred.`))return;
    btn.disabled=true;if(status){status.className='status';status.textContent='MERGING DRAFTS…'}
    try{
      const r=await fetch('/api/admin/telegram-drafts/'+encodeURIComponent(target),{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({mergeDraftId:source})}),d=await r.json();
      if(!r.ok||!d.ok)throw new Error(d.detail||d.error||'MERGE FAILED');
      if(status){status.className='status ok';status.textContent='DRAFTS MERGED ✓'}
      setTimeout(()=>location.reload(),450);
    }catch(e){if(status){status.className='status bad';status.textContent='MERGE FAILED: '+e.message}btn.disabled=false}
  };
  const obs=new MutationObserver(()=>{if(!editor.hidden)refresh()});
  obs.observe(document.querySelector('#list'),{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  document.querySelector('#list')?.addEventListener('click',()=>setTimeout(refresh,250));
})();
