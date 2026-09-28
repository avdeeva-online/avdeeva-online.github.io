/* CODEX: universes (with their shared lorebooks and bots) and authors, built from the public catalog
   (/api/catalog — curated universe names) and /api/lorebooks. No covers yet; text-first cards. */
(()=>{
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key=s=>String(s||'').trim().toLocaleLowerCase();
  const plural=(n,one,many)=>`${n} ${n===1?one:many}`;
  const catalogUrl=params=>`characters.html?${new URLSearchParams(params)}`;
  let universes=[],authors=[],tab='universes',authorFilter='all',query='';

  // ---- data ----
  function build(bots,lorebooks){
    const botByUuid=new Map(bots.map(b=>[b.janitorUuid,b]));
    const uni=new Map();const ensure=(name,author)=>{const k=key(name);if(!uni.has(k))uni.set(k,{name,authors:new Map(),bots:[],lorebooks:[],other:false});const u=uni.get(k);if(author)u.authors.set(author,(u.authors.get(author)||0)+1);return u};
    for(const b of bots)for(const name of b.universes||[])ensure(name,b.author).bots.push(b);
    const curated=new Map([...uni.values()].map(u=>[key(u.name),u]));
    // /api/lorebooks lists one entry per (file, group of bots): the same file can appear several times.
    // One card row per file (content hash), with all bots that use it.
    const files=new Map();
    for(const l of lorebooks){const k=l.contentHash||l.id;if(!files.has(k)){files.set(k,{...l,characterUuids:[...(l.characterUuids||[])],universes:[...(l.universes||[])]});continue}const f=files.get(k);f.characterUuids=[...new Set([...f.characterUuids,...(l.characterUuids||[])])];f.universes=[...new Set([...f.universes,...(l.universes||[])])]}
    lorebooks=[...files.values()];
    // Longest catalog universe name contained in the lorebook title ("HALE UNIVERSITY LOREBOOK v1" → Hale University).
    const byTitle=title=>{const t=key(title);return [...curated.values()].filter(u=>t.includes(key(u.name))).sort((a,b)=>b.name.length-a.name.length)[0]};
    for(const l of lorebooks){
      const linked=(l.characterUuids||[]).map(id=>botByUuid.get(id)).filter(Boolean);
      l.bots=linked;
      // 1) universe named in the lorebook title; 2) its own universe label matching a catalog universe; 3) the universe most of its bots share.
      let home=byTitle(l.title)||(l.universes||[]).map(n=>curated.get(key(n))).find(Boolean);
      if(!home){const votes=new Map();linked.forEach(b=>(b.universes||[]).forEach(n=>votes.set(key(n),(votes.get(key(n))||0)+1)));const best=[...votes].sort((a,b)=>b[1]-a[1])[0];if(best)home=curated.get(best[0])}
      // 3) otherwise: "Other lorebooks" of that author.
      if(!home){const author=l.author||linked[0]?.author||'Unknown';home=ensure(`Other lorebooks · @${author}`,author);home.other=true;home.otherAuthor=author}
      home.lorebooks.push(l);
    }
    universes=[...uni.values()].map(u=>{
      const author=[...u.authors].sort((a,b)=>b[1]-a[1])[0]?.[0]||u.otherAuthor||'';
      const settings=new Map();u.bots.forEach(b=>(b.settings||[]).forEach(s=>settings.set(s,(settings.get(s)||0)+1)));
      return{...u,author,settings:[...settings].sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]),bots:[...new Map(u.bots.map(b=>[b.id,b])).values()]};
    }).sort((a,b)=>Number(a.other)-Number(b.other)||b.bots.length-a.bots.length||a.name.localeCompare(b.name));
    const au=new Map();
    for(const b of bots){if(!au.has(b.author))au.set(b.author,{name:b.author,url:b.authorUrl||'',bots:0,universes:new Set(),lorebooks:0});const a=au.get(b.author);a.bots++;if(!a.url&&b.authorUrl)a.url=b.authorUrl;(b.universes||[]).forEach(n=>a.universes.add(n))}
    for(const l of lorebooks){const a=au.get(l.author);if(a)a.lorebooks++}
    authors=[...au.values()].sort((a,b)=>b.bots-a.bots||a.name.localeCompare(b.name));
  }

  // ---- list ----
  const matchesQuery=text=>!query||key(text).includes(query);
  function universeCard(u){
    const lb=u.lorebooks.length;
    return `<article class="codex-card" tabindex="0" role="button" data-universe="${esc(u.name)}">
      <div class="codex-kicker">// ${u.other?'lorebooks':'universe'}</div>
      <h3>${esc(u.other?'Other lorebooks':u.name)}</h3>
      <div class="codex-by">by <b>@${esc(u.author)}</b></div>
      <div class="codex-counts">${[u.other?'':plural(u.bots.length,'bot','bots'),lb?plural(lb,'lorebook','lorebooks'):''].filter(Boolean).join(' · ')}</div>
      <div class="codex-chips">${u.settings.map(s=>`<span>${esc(s)}</span>`).join('')}</div>
    </article>`;
  }
  function authorCard(a){
    return `<article class="codex-card codex-author" tabindex="0" role="button" data-author="${esc(a.name)}">
      <div class="codex-kicker">// author</div>
      <h3>@${esc(a.name)}</h3>
      <div class="codex-counts">${plural(a.bots,'bot','bots')} · ${plural(a.universes.size,'universe','universes')} · ${plural(a.lorebooks,'lorebook','lorebooks')}</div>
      <div class="codex-links">${a.url?`<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer" data-stop>JanitorAI ↗</a>`:''}</div>
    </article>`;
  }
  function renderFilters(){
    const box=$('#codexFilters');const names=[...new Set(universes.map(u=>u.author))].filter(Boolean);
    box.hidden=tab!=='universes'||names.length<2;
    if(box.hidden){box.innerHTML='';return}
    box.innerHTML=`<span>AUTHOR</span>${['all',...names].map(n=>`<button type="button" data-author-filter="${esc(n)}" class="${n===authorFilter?'active':''}">${n==='all'?'ALL':'@'+esc(n)}</button>`).join('')}`;
  }
  function render(){
    document.querySelectorAll('.codex-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab));
    renderFilters();
    const grid=$('#codexGrid');
    if(tab==='universes'){
      const list=universes.filter(u=>(authorFilter==='all'||u.author===authorFilter)&&matchesQuery([u.name,u.author,...u.settings,...u.bots.map(b=>b.nameEn),...u.lorebooks.map(l=>l.title)].join(' ')));
      grid.innerHTML=list.length?list.map(universeCard).join(''):'<div class="codex-state">Nothing found.</div>';
    }else{
      const list=authors.filter(a=>matchesQuery([a.name,...a.universes].join(' ')));
      grid.innerHTML=list.length?list.map(authorCard).join(''):'<div class="codex-state">Nothing found.</div>';
    }
  }

  // ---- open card ----
  function lorebookRow(l){
    const bots=l.bots||[];const shown=bots.slice(0,4);
    return `<li class="codex-lore">
      <div class="codex-lore-main"><b>${esc(l.title||'Lorebook')}</b>
        <span class="codex-lore-for">${bots.length?`for ${plural(bots.length,'bot','bots')}: ${shown.map(b=>`<a href="${esc(catalogUrl({bot:b.id}))}">${esc(shortName(b))}</a>`).join(', ')}${bots.length>shown.length?` <button type="button" class="codex-more" data-more>+${bots.length-shown.length}</button><span class="codex-rest" hidden>, ${bots.slice(4).map(b=>`<a href="${esc(catalogUrl({bot:b.id}))}">${esc(shortName(b))}</a>`).join(', ')}</span>`:''}`:''}</span></div>
      <a class="codex-download" href="${esc(l.download)}" download>↓ Download</a>
    </li>`;
  }
  // "ALDEN | 🏀 HALE UNIVERSITY" → "ALDEN": the universe is already the context here.
  const shortName=b=>String(b.nameEn||'').split('|')[0].trim()||b.nameEn;
  function openUniverse(name){
    const u=universes.find(x=>x.name===name);if(!u)return;
    const bots=u.bots.slice().sort((a,b)=>shortName(a).localeCompare(shortName(b)));
    show(`<div class="codex-kicker">// ${u.other?'lorebooks':'universe'}</div>
      <h2 id="codexModalTitle">${esc(u.other?'Other lorebooks':u.name)}</h2>
      <div class="codex-by">by <button type="button" class="codex-link" data-open-author="${esc(u.author)}">@${esc(u.author)}</button></div>
      ${u.settings.length?`<div class="codex-chips">${u.settings.map(s=>`<span>${esc(s)}</span>`).join('')}</div>`:''}
      ${u.other?'':`<div class="codex-actions"><a class="codex-btn" href="${esc(catalogUrl({universe:u.name}))}">Open ${plural(bots.length,'bot','bots')} in the catalog →</a></div>`}
      ${u.lorebooks.length?`<h3 class="codex-section">Lorebooks · ${u.lorebooks.length}</h3><ul class="codex-lores">${u.lorebooks.map(lorebookRow).join('')}</ul>`:''}
      ${bots.length&&!u.other?`<h3 class="codex-section">Bots · ${bots.length}</h3><div class="codex-botlist">${bots.map(b=>`<a href="${esc(catalogUrl({bot:b.id}))}">${esc(shortName(b))}</a>`).join('')}</div>`:''}`);
    setHash({universe:u.name});
  }
  function openAuthor(name){
    const a=authors.find(x=>x.name===name);if(!a)return;
    const own=universes.filter(u=>u.author===a.name);
    show(`<div class="codex-kicker">// author</div>
      <h2 id="codexModalTitle">@${esc(a.name)}</h2>
      <div class="codex-counts">${plural(a.bots,'bot','bots')} · ${plural(a.universes.size,'universe','universes')} · ${plural(a.lorebooks,'lorebook','lorebooks')}</div>
      <div class="codex-actions">${a.url?`<a class="codex-btn ghost" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">JanitorAI ↗</a>`:''}<a class="codex-btn" href="${esc(catalogUrl({author:a.name}))}">All bots in the catalog →</a></div>
      ${own.length?`<h3 class="codex-section">Universes · ${own.filter(u=>!u.other).length}</h3><div class="codex-botlist">${own.map(u=>`<button type="button" data-open-universe="${esc(u.name)}">${esc(u.other?'Other lorebooks':u.name)} <small>${u.other?plural(u.lorebooks.length,'lorebook','lorebooks'):u.bots.length}</small></button>`).join('')}</div>`:''}`);
    setHash({author:a.name});
  }
  let lastFocus=null;
  function show(html){const m=$('#codexModal');if(m.hidden)lastFocus=document.activeElement;$('#codexModalBody').innerHTML=html;m.hidden=false;document.body.classList.add('codex-lock');m.querySelector('.codex-modal-card').scrollTop=0;m.scrollTop=0;requestAnimationFrame(()=>m.querySelector('.codex-close')?.focus())}
  function close(){const m=$('#codexModal');if(m.hidden)return;m.hidden=true;document.body.classList.remove('codex-lock');setHash({tab});lastFocus?.focus?.()}
  function setHash(params){history.replaceState(null,'',`${location.pathname}${location.search}#${new URLSearchParams(params)}`)}

  // ---- events ----
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-stop]'))return;
    const t=e.target.closest('.codex-tab');if(t){tab=t.dataset.tab;setHash({tab});render();return}
    const f=e.target.closest('[data-author-filter]');if(f){authorFilter=f.dataset.authorFilter;render();return}
    const more=e.target.closest('[data-more]');if(more){more.nextElementSibling.hidden=false;more.remove();return}
    const ou=e.target.closest('[data-open-universe]');if(ou){openUniverse(ou.dataset.openUniverse);return}
    const oa=e.target.closest('[data-open-author]');if(oa){openAuthor(oa.dataset.openAuthor);return}
    if(e.target.closest('[data-close]')){close();return}
    const card=e.target.closest('.codex-card');if(card){card.dataset.universe?openUniverse(card.dataset.universe):openAuthor(card.dataset.author)}
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape')close();
    if((e.key==='Enter'||e.key===' ')&&e.target.matches?.('.codex-card')){e.preventDefault();e.target.click()}
  });
  $('#codexSearch').addEventListener('input',e=>{query=key(e.target.value);render()});

  // ---- load ----
  (async()=>{
    try{
      const get=u=>fetch(u).then(r=>r.ok?r.json():Promise.reject(new Error(`HTTP ${r.status}`)));
      const [cat,lb]=await Promise.all([get('/api/catalog?limit=1000'),get('/api/lorebooks')]);
      build(Array.isArray(cat.characters)?cat.characters:[],Array.isArray(lb.lorebooks)?lb.lorebooks:[]);
      $('#countUniverses').textContent=universes.filter(u=>!u.other).length;$('#countAuthors').textContent=authors.length;
      const h=new URLSearchParams(location.hash.slice(1));
      if(h.get('tab')==='authors'||h.get('author'))tab='authors';
      render();
      if(h.get('universe'))openUniverse(h.get('universe'));else if(h.get('author'))openAuthor(h.get('author'));
    }catch(err){$('#codexGrid').innerHTML=`<div class="codex-state">The codex is temporarily unavailable. ${esc(err.message)}</div>`}
  })();
})();
