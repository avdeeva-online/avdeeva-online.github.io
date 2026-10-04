/* CODEX: universes (with their shared lorebooks and bots) and authors, built from the public catalog
   (/api/catalog — curated universe names) and /api/lorebooks. No covers yet; text-first cards. */
(()=>{
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key=s=>String(s||'').trim().toLocaleLowerCase();
  const plural=(n,one,many)=>`${n} ${n===1?one:many}`;
  const catalogUrl=params=>`characters.html?${new URLSearchParams(params)}`;
  let universes=[],authors=[],styles=[],profiles=new Map(),modelFilter='all',tab='authors',authorFilter='all',sizeFilter='all',kindFilter='all',query='';
  // Filter by how many bots a universe / author has.
  const SIZES=[['all','All'],['big','10+'],['mid','3–9'],['small','1–2']];
  const inSize=n=>sizeFilter==='all'||(sizeFilter==='big'?n>=10:sizeFilter==='mid'?n>=3&&n<10:n<3);
  // Small stacked portraits of the bots — a quick look at who lives there, instead of a cover.
  const faces=(images,max=5)=>images.length?`<div class="codex-faces" aria-hidden="true">${images.slice(0,max).map(src=>`<img src="${esc(src)}" alt="" loading="lazy" decoding="async">`).join('')}${images.length>max?`<span>+${images.length-max}</span>`:''}</div>`:'';
  const botGrid=bots=>`<div class="codex-bots">${bots.map(b=>`<a class="codex-bot" href="${esc(catalogUrl({bot:b.id}))}"><img src="${esc(b.image)}" alt="" loading="lazy" decoding="async"><span>${esc(shortName(b))}</span></a>`).join('')}</div>`;
  const uniqueBots=list=>[...new Map(list.map(b=>[b.id,b])).values()];
  const cardBots=u=>u.other?uniqueBots(u.lorebooks.flatMap(l=>l.bots||[])):u.bots;

  // ---- data ----
  function build(bots,lorebooks,resources){
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
      // Only bots whose MAIN (first) universe is this one — crossovers stay with their home universe.
      // A universe that is never first (the "Next Gen" ones always come after their parent) keeps all its bots.
      const all=[...new Map(u.bots.map(b=>[b.id,b])).values()],main=all.filter(b=>key((b.universes||[])[0])===key(u.name));
      return{...u,author,settings:[...settings].sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]),bots:main.length?main:all};
    }).sort((a,b)=>Number(a.other)-Number(b.other)||b.bots.length-a.bots.length||a.name.localeCompare(b.name));
    // Authors = bot authors + TAVO HUB resource creators; one person = one name (case and "@" ignored).
    const au=new Map();
    const author=name=>{const n=authorName(name),k=key(n);if(!n)return null;if(!au.has(k))au.set(k,{name:n,url:'',bots:0,list:[],universes:new Set(),lorebooks:0,resources:[]});return au.get(k)};
    for(const b of bots){const a=author(b.author);if(!a)continue;a.bots++;a.list.push(b);if(!a.url&&b.authorUrl)a.url=b.authorUrl;(b.universes||[]).forEach(n=>a.universes.add(n))}
    for(const l of lorebooks){const a=au.get(key(authorName(l.author)));if(a)a.lorebooks++}
    for(const r of resources){const a=author(r.creator?.name);if(a)a.resources.push(r)}
    authors=[...au.values()].sort((a,b)=>works(b)-works(a)||a.name.localeCompare(b.name));
  }
  const authorName=v=>String(v||'').trim().replace(/^@+/,'').trim();
  const works=a=>a.bots+a.resources.length;

  // ---- list ----
  const matchesQuery=text=>!query||key(text).includes(query);
  // Counts without zeros: "0 lorebooks" is noise.
  const counts=parts=>parts.filter(([n])=>n>0).map(([n,one,many])=>plural(n,one,many)).join(' · ');
  // Avatar from the admin (CODEX → Описания и ссылки) or the first letter of the name.
  const avatarHtml=(kind,name,cls='')=>{const url=profileOf(kind,name).avatar_url;return url?`<img class="codex-ava ${cls}" src="${esc(url)}" alt="" loading="lazy" decoding="async">`:`<span class="codex-ava codex-ava-letter ${cls}" aria-hidden="true">${esc(String(name||'?').replace(/^@+/,'').charAt(0).toUpperCase())}</span>`};
  // Universe card: a strip of its bots' portraits on top instead of a wall of text.
  const cover=list=>list.length?`<div class="codex-cover" aria-hidden="true">${list.slice(0,4).map(b=>`<img src="${esc(b.image)}" alt="" loading="lazy" decoding="async">`).join('')}</div>`:'';
  function universeCard(u){
    return `<article class="codex-card codex-universe" tabindex="0" role="button" data-universe="${esc(u.name)}">${cover(cardBots(u))}
      <div class="codex-kicker">// ${u.other?'lorebooks':'universe'}</div>
      <h3>${esc(u.other?'Other lorebooks':u.name)}</h3>
      <div class="codex-by">by <b>@${esc(u.author)}</b></div>
      <div class="codex-counts">${counts([[u.other?0:u.bots.length,'bot','bots'],[lorebookGroups(u.lorebooks).length,'lorebook','lorebooks']])}</div>
      ${u.settings.length?`<div class="codex-chips">${u.settings.map(s=>`<span>${esc(s)}</span>`).join('')}</div>`:''}
    </article>`;
  }
  function authorCard(a){
    return `<article class="codex-card codex-author" tabindex="0" role="button" data-author="${esc(a.name)}">
      <div class="codex-person">${avatarHtml('author',a.name)}<div class="codex-person-text"><div class="codex-kicker">// author</div><h3>@${esc(a.name)}</h3></div></div>
      <div class="codex-counts">${counts([[a.bots,'bot','bots'],[a.resources.length,'resource','resources'],[a.universes.size,'universe','universes'],[a.lorebooks,'lorebook','lorebooks']])}</div>
      ${a.url?`<div class="codex-links"><a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer" data-stop>JanitorAI ↗</a></div>`:''}
      ${faces(authorImages(a))}
    </article>`;
  }
  const authorImages=a=>[...a.list.map(b=>b.image),...a.resources.map(r=>r.cover_url)].filter(Boolean);
  // Authors tab: who makes what — bots (catalog), resources (TAVO HUB) or both.
  const KINDS=[['all','All'],['bots','Bots'],['resources','TAVO HUB']];
  const inKind=a=>kindFilter==='all'||(kindFilter==='bots'?a.bots>0:a.resources.length>0);
  function renderFilters(){
    const box=$('#codexFilters');const names=[...new Set(universes.map(u=>u.author))].filter(Boolean);
    const row=(label,items,attr,current)=>`<div class="codex-frow"><span>${label}</span>${items.map(([v,t])=>`<button type="button" ${attr}="${esc(v)}" class="${v===current?'active':''}">${esc(t)}</button>`).join('')}</div>`;
    box.hidden=false;
    if(tab==='styles'){const models=[...new Set(styles.map(s=>s.model).filter(Boolean))];box.hidden=models.length<2;box.innerHTML=box.hidden?'':row('Model',[['all','All'],...models.map(m=>[m,m])],'data-model-filter',modelFilter);return}
    box.innerHTML=tab==='universes'
      ?row('Bots',SIZES,'data-size-filter',sizeFilter)+(names.length>1?row('Author',[['all','All'],...names.map(n=>[n,'@'+n])],'data-author-filter',authorFilter):'')
      :row('Makes',KINDS,'data-kind-filter',kindFilter)+row('Works',SIZES,'data-size-filter',sizeFilter);
  }
  const nothing='<div class="codex-state">Nothing found.</div>';
  // Style: picture on top, title + model, and the prompt — one tap copies it.
  const styleCard=s=>`<article class="codex-style">${s.image_url?`<img class="codex-style-img" src="${esc(s.image_url)}" alt="${esc(s.title)}" loading="lazy" decoding="async">`:''}<div class="codex-style-body"><h3>${esc(s.title)}</h3><div class="codex-style-meta">${[s.model?`<span>${esc(s.model)}</span>`:'',s.author?(s.author_link?`<a href="${esc(s.author_link)}" target="_blank" rel="noopener noreferrer">@${esc(s.author)}</a>`:`<span>@${esc(s.author)}</span>`):''].filter(Boolean).join('')}</div><button type="button" class="codex-prompt" data-copy="${esc(s.id)}" title="Tap to copy">${esc(s.prompt)}</button></div></article>`;
  async function copyText(text){try{await navigator.clipboard.writeText(text);return true}catch{const ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;opacity:0';document.body.appendChild(ta);ta.select();let ok=false;try{ok=document.execCommand('copy')}catch{}ta.remove();return ok}}
  function render(){
    document.querySelectorAll('.codex-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab));
    // LoreKey: a tool, not a list — hide the grid, filters and search; load the translator on first open.
    const lk=tab==='lorekey',panel=$('#lorekeyPanel');$('#codexGrid').hidden=lk;$('.codex-search').style.visibility=lk?'hidden':'';if(panel)panel.hidden=!lk;
    if(lk){$('#codexFilters').hidden=true;if(!document.querySelector('script[data-lorekey]')){const s=document.createElement('script');s.src='lorekey.js?v=20261004-lk6';s.dataset.lorekey='1';document.body.appendChild(s)}return}
    renderFilters();
    const grid=$('#codexGrid');grid.classList.toggle('codex-styles-grid',tab==='styles');
    if(tab==='styles'){const list=styles.filter(s=>(modelFilter==='all'||s.model===modelFilter)&&matchesQuery([s.title,s.model,s.author,s.prompt].join(' ')));grid.innerHTML=list.length?list.map(styleCard).join(''):(styles.length?nothing:'<div class="codex-state">Styles are coming soon.</div>');return}
    if(tab==='universes'){
      const list=universes.filter(u=>(authorFilter==='all'||u.author===authorFilter)&&inSize(cardBots(u).length)&&matchesQuery([u.name,u.author,...u.settings,...u.bots.map(b=>b.nameEn),...u.lorebooks.map(l=>l.title)].join(' ')));
      grid.innerHTML=list.length?list.map(universeCard).join(''):nothing;
    }else{
      const list=authors.filter(a=>inKind(a)&&inSize(works(a))&&matchesQuery([a.name,...a.universes,...a.list.map(b=>b.nameEn),...a.resources.map(r=>r.title)].join(' ')));
      // Authors with 1–2 works go into one compact line below instead of near-empty cards (unless the user filters for them).
      const minor=sizeFilter==='all'&&!query?list.filter(a=>works(a)<3):[];
      const major=list.filter(a=>!minor.includes(a));
      const what=a=>counts([[a.bots,'bot','bots'],[a.resources.length,'resource','resources']]);
      grid.innerHTML=list.length?major.map(authorCard).join('')+(minor.length?`<div class="codex-minor"><h3 class="codex-section">More authors · ${minor.length}</h3><div class="codex-botlist">${minor.map(a=>`<button type="button" data-open-author="${esc(a.name)}">@${esc(a.name)} <small>${what(a)}</small></button>`).join('')}</div></div>`:''):nothing;
    }
  }

  // ---- open card ----
  const botLinks=bots=>{const shown=bots.slice(0,4);return bots.length?`for ${plural(bots.length,'bot','bots')}: ${shown.map(b=>`<a href="${esc(catalogUrl({bot:b.id}))}">${esc(shortName(b))}</a>`).join(', ')}${bots.length>shown.length?` <button type="button" class="codex-more" data-more>+${bots.length-shown.length}</button><span class="codex-rest" hidden>, ${bots.slice(4).map(b=>`<a href="${esc(catalogUrl({bot:b.id}))}">${esc(shortName(b))}</a>`).join(', ')}</span>`:''}`:''};
  // Same title by the same author = versions of one lorebook (each bot carries its own copy). One row per title;
  // the versions are listed inside it, each with its own bots and download — none of them is a duplicate file.
  function lorebookGroups(list){const m=new Map();for(const l of list){const k=`${key(l.author)}|${key(l.title)}`;if(!m.has(k))m.set(k,[]);m.get(k).push(l)}return[...m.values()].map(v=>v.sort((a,b)=>(b.bots||[]).length-(a.bots||[]).length))}
  function lorebookRow(versions){
    const l=versions[0];
    if(versions.length===1)return `<li class="codex-lore">
      <div class="codex-lore-main"><b>${esc(l.title||'Lorebook')}</b>
        <span class="codex-lore-for">${botLinks(l.bots||[])}</span></div>
      <a class="codex-download" href="${esc(l.download)}" download>↓ Download</a>
    </li>`;
    return `<li class="codex-lore codex-lore-multi">
      <div class="codex-lore-main"><b>${esc(l.title||'Lorebook')} <em class="codex-versions">${versions.length} versions</em></b>
        <ol class="codex-lore-versions">${versions.map((v,i)=>`<li><span class="codex-lore-for"><i>v${i+1}</i> ${botLinks(v.bots||[])}</span><a class="codex-download" href="${esc(v.download)}" download>↓ Download</a></li>`).join('')}</ol></div>
    </li>`;
  }
  // "ALDEN | 🏀 HALE UNIVERSITY" → "ALDEN": the universe is already the context here.
  const shortName=b=>String(b.nameEn||'').split('|')[0].trim()||b.nameEn;
  const byName=list=>list.slice().sort((a,b)=>shortName(a).localeCompare(shortName(b)));
  // A section that opens on tap: long lists (157 bots, 23 lorebooks) stay folded until needed.
  const fold=(title,count,body,open=false)=>count?`<details class="codex-fold"${open?' open':''}><summary><span>${title}</span><em>${count}</em></summary><div class="codex-fold-body">${body}</div></details>`:'';
  // Admin-written description, links and hashtags (/admin/codex.html). Nothing is shown while they are empty.
  const profileOf=(kind,name)=>profiles.get(`${kind}\u0000${key(name)}`)||{};
  const paragraphs=text=>String(text||'').split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean).map(p=>`<p>${esc(p).replace(/\n/g,'<br>')}</p>`).join('');
  const aboutBlock=p=>p.description?`<div class="codex-about">${paragraphs(p.description)}</div>`:'';
  const linksBlock=links=>links.length?`<div class="codex-weblinks">${links.map(l=>`<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} ↗</a>`).join('')}</div>`:'';
  function openUniverse(name){
    const u=universes.find(x=>x.name===name);if(!u)return;
    const bots=byName(u.bots),p=profileOf('universe',u.name),tags=[...u.settings.map(esc),...(p.hashtags||[]).map(h=>`#${esc(h)}`)];
    show(`<div class="codex-kicker">// ${u.other?'lorebooks':'universe'}</div>
      <h2 id="codexModalTitle">${esc(u.other?'Other lorebooks':u.name)}</h2>
      <div class="codex-by">by <button type="button" class="codex-link" data-open-author="${esc(u.author)}">@${esc(u.author)}</button></div>
      ${tags.length?`<div class="codex-chips">${tags.map(t=>`<span>${t}</span>`).join('')}</div>`:''}
      ${aboutBlock(p)}${linksBlock(p.links||[])}
      ${u.other?'':`<div class="codex-actions"><a class="codex-btn" href="${esc(catalogUrl({universe:u.name}))}">Open in the catalog →</a></div>`}
      <div class="codex-folds">
        ${u.other?'':fold('Bots',bots.length,botGrid(bots),true)}
        ${fold('Lorebooks',lorebookGroups(u.lorebooks).length,`<ul class="codex-lores">${lorebookGroups(u.lorebooks).map(lorebookRow).join('')}</ul>`,u.other)}
      </div>`);
    setHash({universe:u.name});
  }
  // Author's TAVO HUB resources: cover, title, type; opens that resource in the HUB.
  const TYPE_ORDER=['preset','theme','plugin','guide','tool','link'];
  const resourceList=list=>`<ul class="codex-res">${list.slice().sort((x,y)=>(TYPE_ORDER.indexOf(x.type)+1||99)-(TYPE_ORDER.indexOf(y.type)+1||99)||String(x.title).localeCompare(String(y.title))).map(r=>`<li><a href="hub.html#resource=${encodeURIComponent(r.id)}">${r.cover_url?`<img src="${esc(r.cover_url)}" alt="" loading="lazy" decoding="async">`:'<i></i>'}<span><b>${esc(r.title||'Untitled')}</b><em>${esc(r.type||'resource')}</em></span></a></li>`).join('')}</ul>`;
  function openAuthor(name){
    const a=authors.find(x=>x.name===name);if(!a)return;
    const own=universes.filter(u=>u.author===a.name&&!u.other),p=profileOf('author',a.name);
    // Their links from the admin, plus the JanitorAI profile if it isn't already among them.
    const links=[...(p.links||[])];if(a.url&&!links.some(l=>l.url.replace(/\/$/,'')===a.url.replace(/\/$/,'')))links.unshift({label:'JanitorAI',url:a.url});
    // Bots grouped by universe (largest first), each group under its own strip; bots without a universe last.
    const groups=new Map();
    for(const b of a.list){const home=(b.universes||[])[0]||'';if(!groups.has(home))groups.set(home,[]);groups.get(home).push(b)}
    const order=[...groups].sort((x,y)=>Number(!x[0])-Number(!y[0])||y[1].length-x[1].length||x[0].localeCompare(y[0]));
    const botsBody=order.map(([u,list])=>`<div class="codex-group"><div class="codex-strip">${u?`<button type="button" data-open-universe="${esc(u)}">${esc(u)}</button>`:'<span>No universe</span>'}<em>${plural(list.length,'bot','bots')}</em></div>${botGrid(byName(list))}</div>`).join('');
    const lores=[...new Map(universes.filter(u=>u.author===a.name).flatMap(u=>u.lorebooks).map(l=>[l.contentHash||l.id,l])).values()];
    show(`<div class="codex-person codex-person-lg">${avatarHtml('author',a.name,'codex-ava-lg')}<div class="codex-person-text"><div class="codex-kicker">// author</div>
      <h2 id="codexModalTitle">@${esc(a.name)}</h2></div></div>
      <div class="codex-counts">${counts([[a.bots,'bot','bots'],[a.resources.length,'resource','resources'],[own.length,'universe','universes'],[lorebookGroups(lores).length,'lorebook','lorebooks']])}</div>
      ${aboutBlock(p)}${linksBlock(links)}
      ${a.bots?`<div class="codex-actions"><a class="codex-btn" href="${esc(catalogUrl({author:a.name}))}">All bots in the catalog →</a></div>`:''}
      <div class="codex-folds">
        ${fold('Universes',own.length,`<ul class="codex-unis">${own.map(u=>`<li><button type="button" data-open-universe="${esc(u.name)}"><span>${esc(u.name)}</span><em>${plural(u.bots.length,'bot','bots')}${u.lorebooks.length?` · ${plural(lorebookGroups(u.lorebooks).length,'lorebook','lorebooks')}`:''}</em></button></li>`).join('')}</ul>`)}
        ${fold('Bots',a.bots,botsBody)}
        ${fold('Lorebooks',lorebookGroups(lores).length,`<ul class="codex-lores">${lorebookGroups(lores).map(lorebookRow).join('')}</ul>`)}
        ${fold('TAVO HUB resources',a.resources.length,resourceList(a.resources),!a.bots)}
      </div>`);
    setHash({author:a.name});
  }
  let lastFocus=null;
  function show(html){const m=$('#codexModal');if(m.hidden)lastFocus=document.activeElement;$('#codexModalBody').innerHTML=html;m.hidden=false;document.body.classList.add('codex-lock');m.querySelector('.codex-modal-card').scrollTop=0;m.scrollTop=0;requestAnimationFrame(()=>m.querySelector('.codex-close')?.focus())}
  function close(){const m=$('#codexModal');if(m.hidden)return;m.hidden=true;document.body.classList.remove('codex-lock');setHash({tab});lastFocus?.focus?.()}
  function setHash(params){history.replaceState(null,'',`${location.pathname}${location.search}#${new URLSearchParams(params)}`)}

  // ---- events ----
  // A universe / author card or name has its own link (codex.html#universe=… / #author=…):
  // middle click or Ctrl / Cmd / Shift + click opens it in a new tab; a plain click opens it here.
  const ownLink=el=>{const u=el?.dataset.universe||el?.dataset.openUniverse,a=el?.dataset.author||el?.dataset.openAuthor;return u?`${location.pathname}#${new URLSearchParams({universe:u})}`:a?`${location.pathname}#${new URLSearchParams({author:a})}`:''};
  const linkTarget=e=>e.target.closest('a')?null:e.target.closest('.codex-card,[data-open-universe],[data-open-author]');
  document.addEventListener('mousedown',e=>{if(e.button===1&&linkTarget(e))e.preventDefault()});
  document.addEventListener('auxclick',e=>{const t=e.button===1&&linkTarget(e);if(!t)return;e.preventDefault();window.open(ownLink(t),'_blank','noopener')});
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-stop]'))return;
    const lt=(e.ctrlKey||e.metaKey||e.shiftKey)&&linkTarget(e);if(lt&&ownLink(lt)){window.open(ownLink(lt),'_blank','noopener');return}
    const t=e.target.closest('.codex-tab');if(t){tab=t.dataset.tab;setHash({tab});render();return}
    const f=e.target.closest('[data-author-filter]');if(f){authorFilter=f.dataset.authorFilter;render();return}
    const sf=e.target.closest('[data-size-filter]');if(sf){sizeFilter=sf.dataset.sizeFilter;render();return}
    const mf=e.target.closest('[data-model-filter]');if(mf){modelFilter=mf.dataset.modelFilter;render();return}
    const cp=e.target.closest('[data-copy]');if(cp){const s=styles.find(x=>x.id===cp.dataset.copy);if(s)copyText(s.prompt).then(ok=>{cp.dataset.copied=ok?'Copied ✓':'Copy failed';cp.classList.add('copied');clearTimeout(cp._t);cp._t=setTimeout(()=>cp.classList.remove('copied'),1400)});return}
    const kf=e.target.closest('[data-kind-filter]');if(kf){kindFilter=kf.dataset.kindFilter;render();return}
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
      // Profiles are optional: without them the page still works, just without descriptions and links.
      const [cat,lb,pr,hub,st]=await Promise.all([get('/api/catalog?limit=10000'),get('/api/lorebooks'),get('/api/codex-profiles').catch(()=>({})),get('/api/hub-resources?summary=1').catch(()=>({})),get('/api/codex-styles').catch(()=>({}))]);styles=Array.isArray(st.styles)?st.styles:[];
      for(const p of Array.isArray(pr.profiles)?pr.profiles:[])profiles.set(`${p.kind}\u0000${key(p.name)}`,p);
      build(Array.isArray(cat.characters)?cat.characters:[],Array.isArray(lb.lorebooks)?lb.lorebooks:[],Array.isArray(hub.resources)?hub.resources:[]);
      $('#countUniverses').textContent=universes.filter(u=>!u.other).length;$('#countAuthors').textContent=authors.length;const cs=$('#countStyles');if(cs)cs.textContent=styles.length||'';
      const h=new URLSearchParams(location.hash.slice(1));
      /* Authors is the default tab; a universe link or #tab=universes opens the universes list. */if(h.get('tab')==='universes'||h.get('universe'))tab='universes';if(h.get('tab')==='styles')tab='styles'; if(h.get('tab')==='lorekey')tab='lorekey';
      render();
      if(h.get('universe'))openUniverse(h.get('universe'));else if(h.get('author'))openAuthor(h.get('author'));
    }catch(err){$('#codexGrid').innerHTML=`<div class="codex-state">The codex is temporarily unavailable. ${esc(err.message)}</div>`}
  })();
})();
