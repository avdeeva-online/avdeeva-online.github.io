(()=>{
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let lorebooks=[];
  let selectedAuthor='';
  let loreMode=false;

  function styles(){
    if($('#archiveLorebookStyles'))return;
    const s=document.createElement('style');s.id='archiveLorebookStyles';s.textContent=`
      .drawer-tabs{grid-template-columns:repeat(4,minmax(0,1fr))!important}
      .drawer-tab[data-drawer-tab="lorebook"] span{letter-spacing:.04em}
      #drawerList[data-layout="lorebook"]{display:block;padding:12px 10px 20px}
      .lore-author-tabs{display:flex;gap:7px;overflow-x:auto;padding:0 0 12px;margin-bottom:12px;border-bottom:1px solid rgba(128,145,112,.22);scrollbar-width:thin}
      .lore-author-tabs button{flex:0 0 auto;border:1px solid #46513f;background:#121712;color:#9faa96;padding:7px 9px;font:10px Consolas,monospace;cursor:pointer}
      .lore-author-tabs button.active{border-color:#83946f;background:#26301f;color:#e1e8d6}
      .lore-world{padding:12px 0 15px;border-bottom:1px solid rgba(128,145,112,.18)}
      .lore-world:last-child{border-bottom:0}.lore-world-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:9px}
      .lore-world-head b{font:700 13px Consolas,monospace;color:#e1e6d8}.lore-world-head small{font:9px Consolas,monospace;color:#71806c}
      .lore-entry{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 10px;margin:6px 0;border:1px solid #343e31;background:#0d120d}
      .lore-entry-copy{min-width:0}.lore-entry-copy strong{display:block;color:#cdd6c4;font:11px Consolas,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lore-entry-copy small{display:block;margin-top:3px;color:#778373;font:9px Consolas,monospace}
      .lore-entry a{border:1px solid #5b694f;background:#20291b;color:#dce5d0;text-decoration:none;padding:8px 9px;font:10px Consolas,monospace;white-space:nowrap}
      .lore-empty{padding:28px 12px;text-align:center;color:#74806f;font:11px Consolas,monospace}
      @media(max-width:620px){.drawer-tabs{grid-template-columns:repeat(2,1fr)!important}.lore-entry{grid-template-columns:1fr}.lore-entry a{text-align:center}}
    `;document.head.appendChild(s);
  }

  async function loadLorebooks(){
    try{
      const r=await fetch('/api/lorebooks',{cache:'no-store'}),d=await r.json();
      if(!r.ok||!d.ok)throw new Error(d.error||`HTTP ${r.status}`);
      lorebooks=Array.isArray(d.lorebooks)?d.lorebooks:[];
      if(loreMode)renderLorebooks();
    }catch(e){console.warn('Lorebook catalog unavailable',e);lorebooks=[];if(loreMode)renderLorebooks()}
  }

  function authors(){return [...new Set(lorebooks.map(x=>x.author).filter(Boolean))].sort((a,b)=>a.localeCompare(b))}

  function renderLorebooks(){
    const list=$('#drawerList');if(!list)return;
    const q=String($('#drawerSearch')?.value||'').trim().toLowerCase();
    const allAuthors=authors();
    if(selectedAuthor&&!allAuthors.includes(selectedAuthor))selectedAuthor='';
    const pool=lorebooks.filter(x=>(!selectedAuthor||x.author===selectedAuthor)&&(!q||[x.author,x.universe,x.characterName,x.title].join(' ').toLowerCase().includes(q)));
    const grouped=new Map();
    for(const item of pool){const key=item.universe||'UNCLASSIFIED';if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(item)}
    list.dataset.layout='lorebook';
    const tabs=`<div class="lore-author-tabs"><button class="${selectedAuthor?'':'active'}" data-lore-author="">ALL AUTHORS</button>${allAuthors.map(a=>`<button class="${selectedAuthor===a?'active':''}" data-lore-author="${esc(a)}">@${esc(a)}</button>`).join('')}</div>`;
    const worlds=[...grouped.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([universe,items])=>`<section class="lore-world"><div class="lore-world-head"><b>${esc(universe)}</b><small>${items.length} FILE${items.length===1?'':'S'}</small></div>${items.map(item=>`<div class="lore-entry"><div class="lore-entry-copy"><strong>${esc(item.title||`${universe} LOREBOOK`)}</strong><small>@${esc(item.author)} · ${esc(item.characterName)}</small></div><a href="${esc(item.download)}" download>DOWNLOAD ↓</a></div>`).join('')}</section>`).join('');
    list.innerHTML=tabs+(worlds||'<div class="lore-empty">NO LOREBOOKS FOUND</div>');
    $('#drawerTotal').textContent=`${String(lorebooks.length).padStart(3,'0')} LOREBOOKS`;
    $('#drawerFootStatus').textContent=q?`${String(pool.length).padStart(2,'0')} MATCHES`:'LOREBOOK INDEX';
  }

  function activateLoreMode(btn){
    loreMode=true;
    document.querySelectorAll('.drawer-tab').forEach(x=>x.classList.toggle('active',x===btn));
    if($('#drawerSearch'))$('#drawerSearch').value='';
    renderLorebooks();
  }

  function install(){
    styles();
    const tabs=$('.drawer-tabs');if(!tabs)return;
    if(!tabs.querySelector('[data-drawer-tab="lorebook"]')){
      const btn=document.createElement('button');btn.className='drawer-tab';btn.dataset.drawerTab='lorebook';btn.innerHTML='<em>04</em><span>LOREBOOKS</span>';
      tabs.appendChild(btn);
      btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();activateLoreMode(btn)});
    }
    tabs.querySelectorAll('.drawer-tab:not([data-drawer-tab="lorebook"])').forEach(btn=>btn.addEventListener('click',()=>{loreMode=false}));
    $('#drawerSearch')?.addEventListener('input',()=>{if(loreMode)setTimeout(renderLorebooks,0)});
    $('#drawerSortCycle')?.addEventListener('click',()=>{if(loreMode)setTimeout(renderLorebooks,0)});
    $('#drawerList')?.addEventListener('click',e=>{const b=e.target.closest('[data-lore-author]');if(!b)return;e.preventDefault();e.stopPropagation();selectedAuthor=b.dataset.loreAuthor||'';renderLorebooks()});
    const mo=new MutationObserver(()=>{if(loreMode&&$('#drawerList')?.dataset.layout!=='lorebook')queueMicrotask(renderLorebooks)});if($('#drawerList'))mo.observe($('#drawerList'),{childList:true});
    loadLorebooks();
    window.addEventListener('archive:catalog-updated',loadLorebooks);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
