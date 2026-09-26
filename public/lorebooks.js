(()=>{
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
  const key=s=>clean(s).toLocaleLowerCase();

  let lorebooks=[],loreMode=false,hashtagMode=false,selectedAuthor='',selectedUniverse='';
  let authorList=[],booksByAuthor=new Map(),worldsByAuthor=new Map(),hashtagList=[],hashtagCounts=new Map();
  let loadPromise=null;

  function styles(){if($('#archiveLorebookStyles'))return;const s=document.createElement('style');s.id='archiveLorebookStyles';s.textContent=`.drawer-tabs{grid-template-columns:repeat(5,minmax(0,1fr))!important}.drawer-submodes{display:flex;gap:4px;padding:8px 10px 5px;border-bottom:1px solid rgba(118,135,105,.16)}.drawer-submodes[hidden]{display:none}.drawer-submodes button{flex:1;border:0;background:transparent;color:#667261;padding:7px 4px;font:9px var(--font-mono);cursor:pointer;border-bottom:1px solid transparent}.drawer-submodes button.active{color:#d3dcc9;border-bottom-color:#9bac80;background:rgba(108,126,91,.07)}#drawerList[data-layout="lorebook"],#drawerList[data-layout="hashtag"]{display:block;padding:7px 10px 20px}.lore-crumbs{display:flex;align-items:center;gap:5px;padding:5px 2px 10px;color:#667261;font:9px var(--font-mono);white-space:nowrap;overflow:hidden}.lore-crumbs button,.lore-back{border:0;background:none;color:#9eac93;font:9px var(--font-mono);cursor:pointer}.lore-crumbs b{color:#cbd5c2;overflow:hidden;text-overflow:ellipsis}.lore-back{width:100%;text-align:left;padding:7px 3px;margin-bottom:5px}.lore-index-row,.hashtag-index-row{width:100%;display:grid;grid-template-columns:32px minmax(0,1fr) auto;align-items:center;gap:9px;min-height:47px;padding:7px 9px;border:0;border-bottom:1px solid rgba(118,135,105,.2);background:transparent;color:#cbd4c2;text-align:left;cursor:pointer;font-family:var(--font-mono)}.lore-index-row:first-child,.hashtag-index-row:first-child{border-top:1px solid rgba(118,135,105,.2)}.lore-index-row:hover,.hashtag-index-row:hover{background:rgba(91,108,78,.11)}.lore-index-no{color:#53604f;font-size:9px}.lore-index-copy{min-width:0}.lore-index-copy b{display:block;font-size:11px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lore-index-copy small{display:block;margin-top:3px;color:#687564;font-size:8px}.lore-index-arrow{color:#77866d;font-size:15px}.lore-section-title{display:flex;justify-content:space-between;gap:10px;padding:8px 9px 10px;border-bottom:1px solid rgba(118,135,105,.25);color:#dbe3d2;font:700 12px var(--font-mono)}.lore-section-title small{color:#687564;font:8px var(--font-mono);font-weight:400}.lore-file{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:9px;border-bottom:1px solid rgba(118,135,105,.17)}.lore-file-copy{min-width:0}.lore-file-copy strong{display:block;color:#cbd4c2;font:10px var(--font-mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lore-file-copy small{display:block;margin-top:3px;color:#667261;font:8px var(--font-mono)}.lore-file a{border:0;border-left:1px solid #4b5942;background:transparent;color:#aebb9f;text-decoration:none;padding:6px 2px 6px 10px;font:9px var(--font-mono);white-space:nowrap}.hashtag-index-row.selected{background:rgba(104,125,86,.15);color:#e0e8d6}.hashtag-index-row .hash-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}.lore-empty{padding:28px 12px;text-align:center;color:#74806f;font:10px var(--font-mono)}`;document.head.appendChild(s)}

  function normalizeBooks(list){
    const authorNames=new Map(),universeNames=new Map();
    for(const x of list){
      const a=clean(x.author),u=clean(x.universe)||'OTHER LOREBOOKS';
      if(a&&!authorNames.has(key(a)))authorNames.set(key(a),a);
      if(!universeNames.has(key(u)))universeNames.set(key(u),u);
    }
    const botList=Array.isArray(window.BOTS)?window.BOTS:[];
    for(const x of botList){
      const a=clean(x.author),universes=Array.isArray(x.universes)&&x.universes.length?x.universes:[x.universe];
      if(a)authorNames.set(key(a),a);
      for(const raw of universes){const u=clean(raw);if(u)universeNames.set(key(u),u)}
    }
    return list.map(x=>{
      const u=clean(x.universe)||'OTHER LOREBOOKS';
      return {...x,author:authorNames.get(key(x.author))||clean(x.author)||'Unknown',universe:universeNames.get(key(u))||u};
    });
  }

  function rebuildIndexes(){
    booksByAuthor=new Map();
    worldsByAuthor=new Map();
    const authorNames=new Map();
    for(const book of lorebooks){
      const ak=key(book.author);if(!ak)continue;
      if(!authorNames.has(ak))authorNames.set(ak,book.author);
      if(!booksByAuthor.has(ak))booksByAuthor.set(ak,[]);
      booksByAuthor.get(ak).push(book);
      if(!worldsByAuthor.has(ak))worldsByAuthor.set(ak,new Map());
      const u=book.universe||'OTHER LOREBOOKS',uk=key(u),worlds=worldsByAuthor.get(ak);
      const entry=worlds.get(uk)||{name:u,count:0};entry.count++;worlds.set(uk,entry);
    }
    authorList=[...authorNames.entries()].map(([k,name])=>({k,name,count:booksByAuthor.get(k)?.length||0})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
    for(const worlds of worldsByAuthor.values()){
      worlds.sorted=[...worlds.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
    }
    rebuildHashtags();
  }

  function rebuildHashtags(){
    hashtagCounts=new Map();
    const names=new Map(),botList=Array.isArray(window.BOTS)?window.BOTS:[];
    for(const bot of botList){
      const seen=new Set();
      for(const raw of bot.hashtags||[]){
        const name=clean(raw),k=key(name);if(!k||seen.has(k))continue;seen.add(k);
        if(!names.has(k))names.set(k,name);
        hashtagCounts.set(k,(hashtagCounts.get(k)||0)+1);
      }
    }
    hashtagList=[...names.entries()].map(([k,name])=>({k,name,count:hashtagCounts.get(k)||0})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
  }

  const authors=()=>authorList.map(x=>x.name);
  const authorBooks=author=>booksByAuthor.get(key(author))||[];
  const worldsFor=author=>worldsByAuthor.get(key(author))?.sorted||[];
  const query=()=>String($('#drawerSearch')?.value||'').trim().toLowerCase();
  const matches=(x,q)=>!q||[x.author,x.universe,x.characterName,x.title].join(' ').toLowerCase().includes(q);

  async function loadLorebooks(){
    if(loadPromise)return loadPromise;
    loadPromise=(async()=>{
      try{
        const r=await fetch('/api/lorebooks',{cache:'no-store'}),d=await r.json();
        if(!r.ok||!d.ok)throw new Error(d.error||`HTTP ${r.status}`);
        lorebooks=normalizeBooks(Array.isArray(d.lorebooks)?d.lorebooks:[]);
      }catch(e){console.warn('Lorebook catalog unavailable',e);lorebooks=[]}
      rebuildIndexes();
      if(loreMode)renderLorebooks();
    })().finally(()=>{loadPromise=null});
    return loadPromise;
  }

  function ensureSubmodes(){
    let box=$('#drawerSubmodes');if(box)return box;
    box=document.createElement('div');box.id='drawerSubmodes';box.className='drawer-submodes';box.hidden=true;
    box.innerHTML='<button data-tag-mode="main" class="active">MAIN TAGS</button><button data-tag-mode="hashtags"># HASHTAGS</button>';
    const row=$('.drawer-query-row');row?.parentNode.insertBefore(box,row.nextSibling);
    box.addEventListener('click',e=>{const b=e.target.closest('[data-tag-mode]');if(!b)return;hashtagMode=b.dataset.tagMode==='hashtags';box.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));if($('#drawerSearch'))$('#drawerSearch').value='';if(hashtagMode)renderHashtags();else window.render?.()});
    return box;
  }
  function showSubmodes(show){const b=ensureSubmodes();b.hidden=!show;if(show)b.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x.dataset.tagMode===(hashtagMode?'hashtags':'main')))}

  function renderHashtags(){
    if(!hashtagMode||loreMode)return;
    const list=$('#drawerList');if(!list)return;
    const q=query(),vals=hashtagList.filter(h=>!q||h.k.includes(q));
    list.dataset.layout='hashtag';
    list.innerHTML=vals.map((h,i)=>`<button class="hashtag-index-row" data-deep-hashtag="${esc(h.name)}"><span class="lore-index-no">${String(i+1).padStart(2,'0')}</span><span class="hash-name">#${esc(h.name)}</span><small>${String(h.count).padStart(2,'0')}</small></button>`).join('')||'<div class="lore-empty">NO HASHTAGS FOUND</div>';
    $('#drawerTotal').textContent=`${String(vals.length).padStart(3,'0')} HASHTAGS`;
    $('#drawerFootStatus').textContent=q?`${String(vals.length).padStart(2,'0')} MATCHES`:'HASHTAG INDEX';
  }

  function renderLorebooks(){
    if(!loreMode)return;
    const list=$('#drawerList');if(!list)return;
    showSubmodes(false);const q=query();list.dataset.layout='lorebook';
    if(selectedAuthor&&!booksByAuthor.has(key(selectedAuthor))){selectedAuthor='';selectedUniverse=''}
    const currentWorlds=selectedAuthor?worldsFor(selectedAuthor):[];
    if(selectedUniverse&&!currentWorlds.some(x=>key(x.name)===key(selectedUniverse)))selectedUniverse='';
    let html='';
    if(!selectedAuthor){
      const vals=authorList.filter(a=>!q||authorBooks(a.name).some(x=>matches(x,q)));
      html=vals.map((a,i)=>{const books=q?authorBooks(a.name).filter(x=>matches(x,q)):authorBooks(a.name),worlds=new Set(books.map(x=>key(x.universe||'OTHER LOREBOOKS'))).size;return `<button class="lore-index-row" data-lore-author="${esc(a.name)}"><span class="lore-index-no">${String(i+1).padStart(2,'0')}</span><span class="lore-index-copy"><b>@${esc(a.name)}</b><small>${worlds} UNIVERSE${worlds===1?'':'S'} · ${books.length} LOREBOOK${books.length===1?'':'S'}</small></span><span class="lore-index-arrow">›</span></button>`}).join('');
      $('#drawerFootStatus').textContent='AUTHORS';
    }else if(!selectedUniverse){
      const books=authorBooks(selectedAuthor),vals=currentWorlds.filter(u=>!q||books.some(x=>key(x.universe||'OTHER LOREBOOKS')===key(u.name)&&matches(x,q)));
      html=`<button class="lore-back" data-lore-back="authors">‹ ALL AUTHORS</button><div class="lore-crumbs"><button data-lore-back="authors">LOREBOOKS</button><span>/</span><b>@${esc(selectedAuthor)}</b></div>`+vals.map((u,i)=>`<button class="lore-index-row" data-lore-universe="${esc(u.name)}"><span class="lore-index-no">${String(i+1).padStart(2,'0')}</span><span class="lore-index-copy"><b>${esc(u.name)}</b><small>${u.count} LOREBOOK${u.count===1?'':'S'}</small></span><span class="lore-index-arrow">›</span></button>`).join('');
      $('#drawerFootStatus').textContent='UNIVERSES';
    }else{
      const books=authorBooks(selectedAuthor).filter(x=>key(x.universe||'OTHER LOREBOOKS')===key(selectedUniverse)&&matches(x,q)).sort((a,b)=>String(a.title).localeCompare(String(b.title))||String(a.characterName).localeCompare(String(b.characterName)));
      html=`<button class="lore-back" data-lore-back="universes">‹ @${esc(selectedAuthor)} / UNIVERSES</button><div class="lore-crumbs"><button data-lore-back="authors">LOREBOOKS</button><span>/</span><button data-lore-back="universes">@${esc(selectedAuthor)}</button><span>/</span><b>${esc(selectedUniverse)}</b></div><div class="lore-section-title"><span>${esc(selectedUniverse)}</span><small>${books.length} FILE${books.length===1?'':'S'}</small></div>`+books.map(x=>`<div class="lore-file"><div class="lore-file-copy"><strong>${esc(x.title||'NO SOURCE TITLE')}</strong><small>${esc(x.characterName||'CHARACTER')} · @${esc(x.author)}</small></div><a href="${esc(x.download)}" download>DOWNLOAD ↓</a></div>`).join('');
      $('#drawerFootStatus').textContent='FILES';
    }
    list.innerHTML=html||'<div class="lore-empty">NO LOREBOOKS FOUND</div>';
    $('#drawerTotal').textContent=`${String(lorebooks.length).padStart(3,'0')} LOREBOOKS`;
  }

  function leaveLoreMode(tab){loreMode=false;selectedAuthor='';selectedUniverse='';const isTag=tab==='tag';if(!isTag)hashtagMode=false;showSubmodes(isTag)}
  function activateLore(btn){loreMode=true;hashtagMode=false;selectedAuthor='';selectedUniverse='';showSubmodes(false);document.querySelectorAll('.drawer-tab').forEach(x=>x.classList.toggle('active',x===btn));if($('#drawerSearch'))$('#drawerSearch').value='';renderLorebooks()}

  function install(){
    styles();ensureSubmodes();const tabs=$('.drawer-tabs');if(!tabs)return;
    let loreBtn=tabs.querySelector('[data-drawer-tab="lorebook"]');
    if(!loreBtn){loreBtn=document.createElement('button');loreBtn.className='drawer-tab';loreBtn.dataset.drawerTab='lorebook';loreBtn.innerHTML='<em>05</em><span>LOREBOOKS</span>';tabs.appendChild(loreBtn)}
    tabs.addEventListener('click',e=>{const btn=e.target.closest('.drawer-tab');if(!btn)return;if(btn.dataset.drawerTab==='lorebook'){e.preventDefault();e.stopPropagation();activateLore(btn);return}leaveLoreMode(btn.dataset.drawerTab);queueMicrotask(()=>{if(btn.dataset.drawerTab==='tag'&&hashtagMode)renderHashtags()})},true);
    $('#drawerSearch')?.addEventListener('input',()=>{if(loreMode)renderLorebooks();else if(hashtagMode)renderHashtags()});
    $('#drawerList')?.addEventListener('click',e=>{const a=e.target.closest('[data-lore-author]'),u=e.target.closest('[data-lore-universe]'),back=e.target.closest('[data-lore-back]'),h=e.target.closest('[data-deep-hashtag]');if(h){e.preventDefault();e.stopPropagation();document.querySelector('.filter-trigger[data-filter="hashtag"]')?.click();setTimeout(()=>[...document.querySelectorAll('#popoverList [data-option]')].find(x=>x.dataset.option===h.dataset.deepHashtag)?.click(),0);return}if(!a&&!u&&!back)return;e.preventDefault();e.stopPropagation();if(a){selectedAuthor=a.dataset.loreAuthor;selectedUniverse=''}else if(u)selectedUniverse=u.dataset.loreUniverse;else if(back.dataset.loreBack==='authors'){selectedAuthor='';selectedUniverse=''}else selectedUniverse='';if($('#drawerSearch'))$('#drawerSearch').value='';renderLorebooks()});
    const drawerList=$('#drawerList');
    if(drawerList){new MutationObserver(()=>{if(loreMode&&drawerList.dataset.layout!=='lorebook')queueMicrotask(renderLorebooks);else if(hashtagMode&&!loreMode&&drawerList.dataset.layout!=='hashtag')queueMicrotask(renderHashtags)}).observe(drawerList,{childList:true,attributes:true,attributeFilter:['data-layout']})}
    rebuildHashtags();loadLorebooks();
    window.addEventListener('archive:catalog-updated',()=>{rebuildHashtags();loadLorebooks();if(hashtagMode)renderHashtags()});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
