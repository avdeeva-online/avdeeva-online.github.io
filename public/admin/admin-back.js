(()=>{
  if(document.querySelector('[data-admin-global-nav]'))return;
  const path=location.pathname, qs=new URLSearchParams(location.search);
  const style=document.createElement('style');
  style.textContent=`
  .admin-global-nav{width:min(1380px,calc(100% - 28px));margin:14px auto 0;display:flex;align-items:center;gap:5px;flex-wrap:wrap;font-family:Consolas,ui-monospace,monospace}.admin-global-nav a{border:1px solid #2f382b;background:#0d110c;color:#8f9b88;text-decoration:none;padding:8px 11px;font-size:8px;letter-spacing:.05em}.admin-global-nav a:hover,.admin-global-nav a.active{border-color:#6c6f4c;background:#171b12;color:#eadfbf}.admin-global-nav a.home{margin-right:5px;color:#c7d0bf}.admin-global-nav a.system{margin-left:auto;padding:6px 9px;font-size:7px;color:#687364;border-color:#293026}.admin-local-nav{display:flex;gap:5px;flex-wrap:wrap;margin:0 0 12px}.admin-local-nav button,.admin-local-nav a{border:1px solid #2f382b;background:#10140e;color:#aeb9a5;padding:9px 12px;font:9px Consolas,ui-monospace,monospace;cursor:pointer;text-decoration:none}.admin-local-nav .active{background:#20281c;color:#e0e6d7;border-color:#59684f}.admin-empty-drafts{border:1px dashed #303a2c;background:#0c100b;padding:34px 14px;text-align:center;color:#687364;font:9px/1.6 Consolas,ui-monospace,monospace}.admin-empty-drafts b{display:block;color:#b8c2b1;margin-bottom:5px}@media(max-width:720px){.admin-global-nav a.system{margin-left:0}}
  `;
  document.head.appendChild(style);
  const nav=document.createElement('nav');nav.className='admin-global-nav';nav.dataset.adminGlobalNav='1';
  nav.innerHTML=`<a class="home" href="/admin/">← ADMIN</a><a href="/admin/imports.html" data-sec="import">IMPORT</a><a href="/admin/editors.html" data-sec="editor">EDIT</a><a href="/admin/drafts.html" data-sec="drafts">DRAFTS</a><a href="/admin/hub/suggestions.html" data-sec="suggestions">SUGGESTIONS</a><a class="system" href="/admin/telegram.html" data-sec="system">SYSTEM</a>`;
  const active=path.endsWith('/imports.html')||path==='/admin/import/'||path==='/admin/hub/'?'import':path.endsWith('/editors.html')||path.endsWith('/import/edit.html')||path.endsWith('/hub/edit.html')?'editor':path.endsWith('/drafts.html')?'drafts':path.endsWith('/hub/suggestions.html')?'suggestions':path.endsWith('/telegram.html')?'system':'';
  nav.querySelector(`[data-sec="${active}"]`)?.classList.add('active');document.body.prepend(nav);
  const oldTabs=document.querySelector('.tabs');
  if(path==='/admin/import/'||path==='/admin/import/index.html'){
    oldTabs?.querySelectorAll('a').forEach(a=>a.remove());const universeBtn=oldTabs?.querySelector('[data-mode="universes"]'),audit=document.querySelector('#auditPanel'),tool=qs.get('tool')||'';
    if(tool==='universes'){universeBtn?.classList.remove('hidden');universeBtn?.click();oldTabs?.querySelectorAll('[data-mode]').forEach(b=>{if(b!==universeBtn)b.style.display='none'});audit?.classList.add('hidden');document.querySelector('h1')&&(document.querySelector('h1').textContent='BOT EDITOR / UNIVERSES')}
    else if(tool==='audit'){if(oldTabs)oldTabs.style.display='none';['#authorPanel','#linksPanel','#recordsPanel','#universePanel'].forEach(s=>document.querySelector(s)?.classList.add('hidden'));audit?.classList.remove('hidden');document.querySelector('h1')&&(document.querySelector('h1').textContent='BOT EDITOR / AUDIT')}
    else{universeBtn&&(universeBtn.style.display='none');audit?.classList.add('hidden');document.querySelector('h1')&&(document.querySelector('h1').textContent='BOT IMPORT')}
  }else if(path.endsWith('/admin/import/edit.html')){
    if(oldTabs)oldTabs.style.display='none';const head=document.querySelector('.head'),local=document.createElement('div');local.className='admin-local-nav';local.innerHTML=`<button class="active" type="button" data-bot-pane="published">PUBLISHED</button><a href="/admin/drafts.html">DRAFTS</a><a href="./?tool=universes">UNIVERSES</a><a href="./?tool=audit">AUDIT</a>`;head?.insertAdjacentElement('afterend',local)
  }else if(path==='/admin/hub/'||path==='/admin/hub/index.html'){
    if(oldTabs)oldTabs.style.display='none';document.querySelector('h1')&&(document.querySelector('h1').textContent='RESOURCE IMPORT');
    if(!document.querySelector('script[data-draft-bridge-loader]')){const s=document.createElement('script');s.src='/admin/hub/draft-bridge.js?v=20260916-3';s.dataset.draftBridgeLoader='1';document.body.appendChild(s)}
  }else if(path.endsWith('/admin/hub/edit.html')){
    if(oldTabs)oldTabs.style.display='none';
  }else if(path.endsWith('/admin/hub/suggestions.html')){
    if(oldTabs)oldTabs.style.display='none';
  }
})();