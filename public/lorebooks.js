(()=>{
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let lorebooks=[], loreMode=false, hashtagMode=false, selectedAuthor='', selectedUniverse='';

  function styles(){
    if($('#archiveLorebookStyles'))return;
    const s=document.createElement('style');s.id='archiveLorebookStyles';s.textContent=`
      .drawer-tabs{grid-template-columns:repeat(4,minmax(0,1fr))!important}
      .drawer-tab[data-drawer-tab="lorebook"] span{letter-spacing:.04em}
      .drawer-submodes{display:flex;gap:4px;padding:8px 10px 5px;border-bottom:1px solid rgba(118,135,105,.16)}
      .drawer-submodes[hidden]{display:none}.drawer-submodes button{flex:1;border:0;background:transparent;color:#667261;padding:7px 4px;font:9px Consolas,monospace;letter-spacing:.04em;cursor:pointer;border-bottom:1px solid transparent}.drawer-submodes button.active{color:#d3dcc9;border-bottom-color:#9bac80;background:rgba(108,126,91,.07)}
      #drawerList[data-layout="lorebook"],#drawerList[data-layout="hashtag"]{display:block;padding:7px 10px 20px}
      .lore-crumbs{display:flex;align-items:center;gap:5px;padding:5px 2px 10px;color:#667261;font:9px Consolas,monospace;white-space:nowrap;overflow:hidden}.lore-crumbs button{border:0;background:none;padding:0;color:#9eac93;font:9px Consolas,monospace;cursor:pointer}.lore-crumbs button:hover{color:#dce5d2}.lore-crumbs b{color:#cbd5c2;overflow:hidden;text-overflow:ellipsis}
      .lore-index-row,.hashtag-index-row{width:100%;display:grid;grid-template-columns:32px minmax(0,1fr) auto;align-items:center;gap:9px;min-height:47px;padding:7px 9px;border:0;border-bottom:1px solid rgba(118,135,105,.2);background:transparent;color:#cbd4c2;text-align:left;cursor:pointer;font-family:Consolas,monospace}.lore-index-row:first-child,.hashtag-index-row:first-child{border-top:1px solid rgba(118,135,105,.2)}.lore-index-row:hover,.hashtag-index-row:hover{background:rgba(91,108,78,.11)}
      .lore-index-no{color:#53604f;font-size:9px}.lore-index-copy{min-width:0}.lore-index-copy b{display:block;font-size:11px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lore-index-copy small{display:block;margin-top:3px;color:#687564;font-size:8px;letter-spacing:.04em}.lore-index-arrow{color:#77866d;font-size:15px}
      .lore-back{width:100%;display:flex;align-items:center;gap:8px;margin:0 0 8px;padding:7px 3px;border:0;background:none;color:#84917d;font:9px Consolas,monospace;cursor:pointer;text-align:left}.lore-back:hover{color:#d7e0ce}
      .lore-section-title{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:8px 9px 10px;border-bottom:1px solid rgba(118,135,105,.25);color:#dbe3d2;font:700 12px Consolas,monospace}.lore-section-title small{color:#687564;font:8px Consolas,monospace;font-weight:400}
      .lore-file{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:9px;border-bottom:1px solid rgba(118,135,105,.17)}.lore-file-copy{min-width:0}.lore-file-copy strong{display:block;color:#cbd4c2;font:10px Consolas,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lore-file-copy small{display:block;margin-top:3px;color:#667261;font:8px Consolas,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lore-file a{border:0;border-left:1px solid #4b5942;background:transparent;color:#aebb9f;text-decoration:none;padding:6px 2px 6px 10px;font:9px Consolas,monospace;white-space:nowrap}.lore-file a:hover{color:#e2ead8}
      .hashtag-index-row.selected{background:rgba(104,125,86,.15);color:#e0e8d6}.hashtag-index-row .hash-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}.hashtag-index-row small{color:#667261;font-size:8px}.lore-empty{padding:28px 12px;text-align:center;color:#74806f;font:10px Consolas,monospace}
      @media(max-width:620px){.drawer-tabs{grid-template-columns:repeat(2,1fr)!important}.lore-file{grid-template-columns:1fr}.lore-file a{border-left:0;border-top:1px solid #3d4937;padding:7px 0;text-align:left}}
    `;document.head.appendChild(s);
  }

  async function loadLorebooks(){try{const r=await fetch('/api/lorebooks',{cache:'no-store'}),d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||`HTTP ${r.status}`);lorebooks=Array.isArray(d.lorebooks)?d.lorebooks:[];if(loreMode)renderLorebooks()}catch(e){console.warn('Lorebook catalog unavailable',e);lorebooks=[];if(loreMode)renderLorebooks()}}
  const authors=()=>[...new Set(lorebooks.map(x=>x.author).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const worldsFor=a=>[...new Set(lorebooks.filter(x=>x.author===a).map(x=>x.universe||'UNCLASSIFIED'))].sort((a,b)=>a.localeCompare(b));
  const query=()=>String($('#drawerSearch')?.value||'').trim().toLowerCase();
  const matches=(x,q)=>!q||[x.author,x.universe,x.characterName,x.title].join(' ').toLowerCase().includes(q);
  const bots=()=>Array.isArray(window.BOTS)?window.BOTS:[];
  const hashtags=()=>[...new Set(bots().flatMap(x=>x.hashtags||[]).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const hashCount=h=>bots().filter(x=>(x.hashtags||[]).includes(h)).length;

  function ensureSubmodes(){
    let box=$('#drawerSubmodes');if(box)return box;
    box=document.createElement('div');box.id='drawerSubmodes';box.className='drawer-submodes';box.hidden=true;box.innerHTML='<button data-tag-mode="main" class="active">MAIN TAGS</button><button data-tag-mode="hashtags"># HASHTAGS</button>';
    const row=$('.drawer-query-row');row?.parentNode.insertBefore(box,row.nextSibling);
    box.onclick=e=>{const b=e.target.closest('[data-tag-mode]');if(!b)return;hashtagMode=b.dataset.tagMode==='hashtags';box.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));if($('#drawerSearch'))$('#drawerSearch').value='';if(hashtagMode)renderHashtags();else window.render?.()};
    return box;
  }
  function showTagSubmodes(show){const box=ensureSubmodes();box.hidden=!show;if(show){box.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x.dataset.tagMode===(hashtagMode?'hashtags':'main')))}}
  function renderHashtags(){
    if(!hashtagMode||loreMode)return;const list=$('#drawerList');if(!list)return;const q=query();let vals=hashtags().filter(h=>h.toLowerCase().includes(q));
    list.dataset.layout='hashtag';list.innerHTML=vals.map((h,i)=>`<button class="hashtag-index-row ${window.__archiveHashtagSelected?.(h)?'selected':''}" data-deep-hashtag="${esc(h)}"><span class="lore-index-no">${String(i+1).padStart(2,'0')}</span><span class="hash-name">#${esc(h)}</span><small>${String(hashCount(h)).padStart(2,'0')}</small></button>`).join('')||'<div class="lore-empty">NO HASHTAGS FOUND</div>';
    $('#drawerTotal').textContent=`${String(vals.length).padStart(3,'0')} HASHTAGS`;$('#drawerFootStatus').textContent=q?`${String(vals.length).padStart(2,'0')} MATCHES`:'HASHTAG INDEX';
  }

  function authorRows(q){return authors().filter(a=>!q||lorebooks.some(x=>x.author===a&&matches(x,q))).map((a,i)=>{const books=lorebooks.filter(x=>x.author===a&&matches(x,q));const worlds=new Set(books.map(x=>x.universe||'UNCLASSIFIED')).size;return `<button class="lore-index-row" data-lore-author="${esc(a)}"><span class="lore-index-no">${String(i+1).padStart(2,'0')}</span><span class="lore-index-copy"><b>@${esc(a)}</b><small>${worlds} UNIVERSE${worlds===1?'':'S'} · ${books.length} LOREBOOK${books.length===1?'':'S'}</small></span><span class="lore-index-arrow">›</span></button>`}).join('')}
  function universeRows(q){const worlds=worldsFor(selectedAuthor).filter(u=>!q||lorebooks.some(x=>x.author===selectedAuthor&&(x.universe||'UNCLASSIFIED')===u&&matches(x,q)));return `<button class="lore-back" data-lore-back="authors">‹ ALL AUTHORS</button><div class="lore-crumbs"><button data-lore-back="authors">LOREBOOKS</button><span>/</span><b>@${esc(selectedAuthor)}</b></div>${worlds.map((u,i)=>{const n=lorebooks.filter(x=>x.author===selectedAuthor&&(x.universe||'UNCLASSIFIED')===u&&matches(x,q)).length;return `<button class="lore-index-row" data-lore-universe="${esc(u)}"><span class="lore-index-no">${String(i+1).padStart(2,'0')}</span><span class="lore-index-copy"><b>${esc(u)}</b><small>${n} LOREBOOK${n===1?'':'S'}</small></span><span class="lore-index-arrow">›</span></button>`}).join('')}`}
  function fileRows(q){const books=lorebooks.filter(x=>x.author===selectedAuthor&&(x.universe||'UNCLASSIFIED')===selectedUniverse&&matches(x,q));return `<button class="lore-back" data-lore-back="universes">‹ @${esc(selectedAuthor)} / UNIVERSES</button><div class="lore-crumbs"><button data-lore-back="authors">LOREBOOKS</button><span>/</span><button data-lore-back="universes">@${esc(selectedAuthor)}</button><span>/</span><b>${esc(selectedUniverse)}</b></div><div class="lore-section-title"><span>${esc(selectedUniverse)}</span><small>${books.length} FILE${books.length===1?'':'S'}</small></div>${books.map(x=>`<div class="lore-file"><div class="lore-file-copy"><strong>${esc(x.title||`${selectedUniverse} LOREBOOK`)}</strong><small>${esc(x.characterName||'CHARACTER')} · @${esc(x.author)}</small></div><a href="${esc(x.download)}" download>DOWNLOAD ↓</a></div>`).join('')}`}
  function renderLorebooks(){const list=$('#drawerList');if(!list)return;showTagSubmodes(false);const q=query();list.dataset.layout='lorebook';if(selectedAuthor&&!authors().includes(selectedAuthor)){selectedAuthor='';selectedUniverse=''}if(selectedUniverse&&!worldsFor(selectedAuthor).includes(selectedUniverse))selectedUniverse='';let html='',count=0,status='AUTHORS';if(!selectedAuthor){html=authorRows(q);count=authors().filter(a=>!q||lorebooks.some(x=>x.author===a&&matches(x,q))).length}else if(!selectedUniverse){html=universeRows(q);count=worldsFor(selectedAuthor).length;status='UNIVERSES'}else{html=fileRows(q);count=lorebooks.filter(x=>x.author===selectedAuthor&&(x.universe||'UNCLASSIFIED')===selectedUniverse&&matches(x,q)).length;status='FILES'}list.innerHTML=html||'<div class="lore-empty">NO LOREBOOKS FOUND</div>';$('#drawerTotal').textContent=`${String(lorebooks.length).padStart(3,'0')} LOREBOOKS`;$('#drawerFootStatus').textContent=q?`${String(count).padStart(2,'0')} MATCHES`:status}

  function activateLoreMode(btn){loreMode=true;hashtagMode=false;selectedAuthor='';selectedUniverse='';showTagSubmodes(false);document.querySelectorAll('.drawer-tab').forEach(x=>x.classList.toggle('active',x===btn));if($('#drawerSearch'))$('#drawerSearch').value='';renderLorebooks()}
  function leaveDeepModes(btn){loreMode=false;selectedAuthor='';selectedUniverse='';const isTag=btn?.dataset.drawerTab==='tag';if(!isTag)hashtagMode=false;showTagSubmodes(isTag);if(isTag&&hashtagMode)queueMicrotask(renderHashtags)}

  function install(){
    styles();ensureSubmodes();const tabs=$('.drawer-tabs');if(!tabs)return;
    if(!tabs.querySelector('[data-drawer-tab="lorebook"]')){const btn=document.createElement('button');btn.className='drawer-tab';btn.dataset.drawerTab='lorebook';btn.innerHTML='<em>04</em><span>LOREBOOKS</span>';tabs.appendChild(btn);btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();activateLoreMode(btn)})}
    tabs.querySelectorAll('.drawer-tab:not([data-drawer-tab="lorebook"])').forEach(btn=>btn.addEventListener('click',()=>leaveDeepModes(btn)));
    $('#drawerSearch')?.addEventListener('input',()=>{if(loreMode)setTimeout(renderLorebooks,0);else if(hashtagMode)setTimeout(renderHashtags,0)});
    $('#drawerList')?.addEventListener('click',e=>{
      const a=e.target.closest('[data-lore-author]'),u=e.target.closest('[data-lore-universe]'),back=e.target.closest('[data-lore-back]'),h=e.target.closest('[data-deep-hashtag]');
      if(h){e.preventDefault();e.stopPropagation();const tag=h.dataset.deepHashtag;const trigger=document.querySelector('.filter-trigger[data-filter="hashtag"]');if(trigger){trigger.click();setTimeout(()=>{const opt=[...document.querySelectorAll('#popoverList [data-option]')].find(x=>x.dataset.option===tag);opt?.click()},0)}return}
      if(!a&&!u&&!back)return;e.preventDefault();e.stopPropagation();if(a){selectedAuthor=a.dataset.loreAuthor;selectedUniverse=''}else if(u)selectedUniverse=u.dataset.loreUniverse;else if(back.dataset.loreBack==='authors'){selectedAuthor='';selectedUniverse=''}else selectedUniverse='';if($('#drawerSearch'))$('#drawerSearch').value='';renderLorebooks();
    });
    const mo=new MutationObserver(()=>{if(loreMode&&$('#drawerList')?.dataset.layout!=='lorebook')queueMicrotask(renderLorebooks);if(hashtagMode&&!loreMode&&$('#drawerList')?.dataset.layout!=='hashtag')queueMicrotask(renderHashtags)});if($('#drawerList'))mo.observe($('#drawerList'),{childList:true,attributes:true,attributeFilter:['data-layout']});
    loadLorebooks();window.addEventListener('archive:catalog-updated',()=>{loadLorebooks();if(hashtagMode)renderHashtags()});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
