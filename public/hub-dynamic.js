(()=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug=v=>String(v||'unknown').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'unknown';
  const plural=t=>t.endsWith('s')?t:`${t}s`;
  const cleanAuthor=v=>{let s=String(v||'').trim();if(!s)return'UNKNOWN';try{const u=new URL(s);if(/(^|\.)t\.me$/i.test(u.hostname)){let p=u.pathname.replace(/^\/+|\/+$/g,'').split('/').filter(Boolean);if(p[0]==='s')p.shift();if(p.length)return p[0].replace(/^@/,'')}}catch{}return s.replace(/^@/,'')};
  const creatorHref=(v,fallback='')=>{const s=String(v||'').trim();if(s.startsWith('@'))return`https://t.me/${s.slice(1)}`;if(/^https?:\/\//i.test(s))return s;const f=String(fallback||'').trim();if(/^https?:\/\//i.test(f))return f;if(f.startsWith('@'))return`https://t.me/${f.slice(1)}`;return''};
  const cover=media=>{const list=Array.isArray(media)?media:[];const c=list.find(x=>x&&x.cover)||list[0];return c?.url||c?.src||''};
  const label=v=>String(v||'').replaceAll('-',' ').toUpperCase();
  const downloadLabel=f=>{const n=String(f?.name||'FILE').trim();const base=n.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').trim();if(/regex/i.test(n)&&/\.json$/i.test(n))return'DOWNLOAD REGEX';return`DOWNLOAD ${base.toUpperCase()||'FILE'}`};

  let resources=[];
  let currentIndex=-1;

  function closeModal(){
    const modal=document.getElementById('hubResourceModal');
    if(!modal)return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('hub-modal-lock');
  }

  function filteredNeighbors(item){
    const type=String(item?.type||'').toLowerCase();
    return resources.filter(r=>String(r?.type||'').toLowerCase()===type);
  }

  function navigate(delta){
    if(currentIndex<0||!resources[currentIndex])return;
    const current=resources[currentIndex];
    const same=filteredNeighbors(current);
    if(same.length<2)return;
    const i=same.findIndex(x=>String(x.id)===String(current.id));
    const next=same[(i+delta+same.length)%same.length];
    const real=resources.findIndex(x=>String(x.id)===String(next.id));
    if(real>=0){currentIndex=real;renderModal(next)}
  }

  function applyCatalogFilter(group,value,item){
    closeModal();
    const side=[...document.querySelectorAll('.side-link')];
    const categories=['all','presets','creators','plugins','themes','guides','links','tools'];
    const type=plural(String(item?.type||'').toLowerCase());
    const sideIndex=categories.indexOf(type);
    if(sideIndex>=0&&side[sideIndex])side[sideIndex].click();
    if(group==='model'||group==='setting'){
      if(type!=='presets'&&side[1])side[1].click();
      setTimeout(()=>{
        const selector=`.filter-tags[data-group="${group}"] .tag-filter[data-value="${CSS.escape(String(value))}"]`;
        const btn=document.querySelector(selector);
        if(btn&&!btn.classList.contains('active'))btn.click();
        document.querySelector('.directory')?.scrollIntoView({behavior:'smooth',block:'start'});
      },30);
    }
  }

  function ensureUi(){
    if(document.getElementById('hubResourceModal'))return;
    const style=document.createElement('style');
    style.textContent=`
      .resource-card[data-dynamic="1"]{cursor:pointer}
      .card-title-row{display:flex;align-items:baseline;gap:7px;min-width:0;margin:5px 0 5px}
      .card-title-row h3{margin:0;min-width:0}
      .card-by{flex:0 0 auto;font:6.5px/1 var(--mono);letter-spacing:.07em;color:#8e998e;white-space:nowrap;text-transform:uppercase}
      .card-by b{color:#b7aa82;font-weight:400}
      .hub-modal{position:fixed;inset:0;z-index:1000;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(1,4,2,.80);backdrop-filter:blur(5px)}
      .hub-modal.open{display:flex}
      .hub-modal-panel{width:min(690px,100%);max-height:min(82vh,720px);overflow:auto;scrollbar-width:none;border:1px solid rgba(153,169,137,.31);border-radius:13px;background:linear-gradient(180deg,rgba(10,15,11,.99),rgba(5,8,6,.995));box-shadow:0 26px 80px rgba(0,0,0,.55);position:relative}
      .hub-modal-panel::-webkit-scrollbar{display:none}
      .hub-modal-cover{height:158px;background:#111 center/cover no-repeat;border-bottom:1px solid rgba(132,148,117,.16);position:relative}
      .hub-modal-cover:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 55%,rgba(4,7,5,.58))}
      .hub-modal-close{position:absolute;right:10px;top:10px;z-index:5;width:30px;height:30px;border:1px solid rgba(171,181,151,.26);border-radius:8px;background:rgba(5,9,6,.78);color:#d9d6ca;cursor:pointer;font:15px/1 var(--mono)}
      .hub-modal-nav{position:fixed;top:50%;z-index:1002;width:38px;height:54px;transform:translateY(-50%);border:1px solid rgba(157,170,139,.24);border-radius:9px;background:rgba(5,9,6,.78);color:#d8c995;font:24px/1 var(--mono);cursor:pointer;display:none;align-items:center;justify-content:center}
      .hub-modal.open .hub-modal-nav{display:flex}.hub-modal-prev{left:max(12px,calc(50% - 390px))}.hub-modal-next{right:max(12px,calc(50% - 390px))}
      .hub-modal-body{padding:14px 18px 16px}
      .hub-modal-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:start}
      .hub-modal-type{font:7px/1 var(--mono);letter-spacing:.12em;color:#9aa599}
      .hub-modal-title{margin:6px 0 4px;font:700 24px/1.04 Georgia,"Times New Roman",serif;color:#f0e8d9}
      .hub-modal-author{font:7.5px/1.35 var(--mono);color:#8d978c;text-transform:uppercase}
      .hub-modal-author b{color:#c5b98e;font-weight:400}
      .hub-modal-links{display:flex;justify-content:flex-end;gap:6px;flex-wrap:wrap;max-width:230px}
      .hub-modal-link,.hub-file-btn{display:inline-flex;align-items:center;justify-content:center;min-height:29px;border:1px solid rgba(151,162,129,.20);border-radius:8px;padding:0 10px;background:rgba(11,16,12,.66);color:#c7c7bb;font:7px/1 var(--mono);letter-spacing:.055em;text-decoration:none}
      .hub-modal-link:hover,.hub-file-btn:hover{border-color:rgba(191,181,119,.46);color:#eee2c1;background:rgba(128,119,72,.08)}
      .hub-modal-tags{display:flex;gap:5px;flex-wrap:wrap;margin:10px 0 0}
      .hub-modal-tag{appearance:none;border:1px solid rgba(128,143,115,.18);border-radius:999px;padding:5px 8px;font:6.7px/1 var(--mono);color:#9aa498;background:rgba(8,12,9,.38);cursor:pointer}
      .hub-modal-tag:hover{border-color:rgba(188,178,119,.42);color:#e4d9b7;background:rgba(137,128,78,.08)}
      .hub-modal-desc{margin:12px 0 0;padding-top:11px;border-top:1px solid rgba(126,140,113,.12);white-space:pre-wrap;font:10.3px/1.55 var(--mono);color:#c6ccc2;letter-spacing:.005em}
      .hub-files{margin-top:13px;padding-top:11px;border-top:1px solid rgba(126,140,113,.12)}
      .hub-files-title{font:6.7px/1 var(--mono);letter-spacing:.12em;color:#7f8b80;margin-bottom:7px}
      .hub-file-list{display:flex;gap:7px;flex-wrap:wrap}
      .hub-file-btn{min-height:32px;padding:0 12px;border-color:rgba(188,176,108,.34);color:#e4d9b7;background:rgba(128,117,67,.07)}
      .hub-file-btn:after{content:' ⇩';margin-left:6px;color:#cfb96e}
      body.hub-modal-lock{overflow:hidden}
      @media(max-width:780px){.hub-modal-nav{width:34px;height:46px}.hub-modal-prev{left:7px}.hub-modal-next{right:7px}}
      @media(max-width:600px){.hub-modal{padding:7px}.hub-modal-panel{max-height:93vh;border-radius:10px}.hub-modal-cover{height:128px}.hub-modal-body{padding:12px}.hub-modal-head{grid-template-columns:1fr}.hub-modal-links{justify-content:flex-start;max-width:none}.hub-modal-title{font-size:21px}.hub-modal-desc{font-size:9.5px;line-height:1.52}.hub-modal-nav{top:auto;bottom:12px;transform:none;width:34px;height:34px;border-radius:50%}.hub-modal-prev{left:14px}.hub-modal-next{right:14px}.card-title-row{gap:5px}.card-by{font-size:6px}}
    `;
    document.head.appendChild(style);
    const modal=document.createElement('div');
    modal.id='hubResourceModal';modal.className='hub-modal';modal.setAttribute('aria-hidden','true');
    modal.innerHTML='<button class="hub-modal-nav hub-modal-prev" type="button" aria-label="Previous">‹</button><div class="hub-modal-panel" role="dialog" aria-modal="true"><button class="hub-modal-close" type="button" aria-label="Close">×</button><div id="hubModalContent"></div></div><button class="hub-modal-nav hub-modal-next" type="button" aria-label="Next">›</button>';
    document.body.appendChild(modal);
    modal.querySelector('.hub-modal-close').onclick=closeModal;
    modal.querySelector('.hub-modal-prev').onclick=()=>navigate(-1);
    modal.querySelector('.hub-modal-next').onclick=()=>navigate(1);
    modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});
    document.addEventListener('keydown',e=>{
      if(!modal.classList.contains('open'))return;
      if(e.key==='Escape')closeModal();
      else if(e.key==='ArrowLeft')navigate(-1);
      else if(e.key==='ArrowRight')navigate(1);
    });
  }

  function renderModal(r){
    ensureUi();
    const modal=document.getElementById('hubResourceModal'),box=document.getElementById('hubModalContent');
    const image=cover(r.media);
    const rawCreator=String(r.creator?.name||'UNKNOWN');
    const creator=cleanAuthor(rawCreator);
    const cLink=creatorHref(r.creator?.link,rawCreator);
    const models=Array.isArray(r.models)?r.models:[];
    const settings=Array.isArray(r.settings)?r.settings:[];
    const extra=Array.isArray(r.tags)?r.tags:[];
    const files=Array.isArray(r.files)?r.files:[];
    const coverHtml=image?`<div class="hub-modal-cover" style="background-image:url('${esc(image).replace(/'/g,'%27')}')"></div>`:'';
    const links=[cLink?`<a class="hub-modal-link" href="${esc(cLink)}" target="_blank" rel="noopener noreferrer">AUTHOR ↗</a>`:'',r.source_url?`<a class="hub-modal-link" href="${esc(r.source_url)}" target="_blank" rel="noopener noreferrer">ORIGINAL POST ↗</a>`:''].filter(Boolean).join('');
    const chips=[...models.map(v=>({g:'model',v})),...settings.map(v=>({g:'setting',v})),...extra.map(v=>({g:'tag',v}))];
    const chipHtml=chips.map(x=>`<button class="hub-modal-tag" type="button" data-filter-group="${esc(x.g)}" data-filter-value="${esc(x.v)}">${esc(label(x.v))}</button>`).join('');
    const fileButtons=files.length?files.map(f=>`<a class="hub-file-btn" href="${esc(f.download_url||f.external_url||'#')}">${esc(downloadLabel(f))}</a>`).join(''):'<span class="hub-modal-author">NO DOWNLOADABLE FILES</span>';
    box.innerHTML=`${coverHtml}<div class="hub-modal-body"><div class="hub-modal-head"><div><div class="hub-modal-type">// ${esc(String(r.type||'RESOURCE').toUpperCase())}</div><h2 class="hub-modal-title">${esc(r.title||'UNTITLED RESOURCE')}</h2><div class="hub-modal-author">BY: <b>${esc(creator)}</b></div></div><div class="hub-modal-links">${links}</div></div>${chipHtml?`<div class="hub-modal-tags">${chipHtml}</div>`:''}<div class="hub-modal-desc">${esc(r.description_full||r.description_short||'')}</div><div class="hub-files"><div class="hub-files-title">DOWNLOADS</div><div class="hub-file-list">${fileButtons}</div></div></div>`;
    box.querySelectorAll('[data-filter-group]').forEach(btn=>btn.onclick=()=>applyCatalogFilter(btn.dataset.filterGroup,btn.dataset.filterValue,r));
    const same=filteredNeighbors(r),showNav=same.length>1;
    modal.querySelectorAll('.hub-modal-nav').forEach(b=>b.style.visibility=showNav?'visible':'hidden');
  }

  function openModal(r){
    currentIndex=resources.findIndex(x=>String(x.id)===String(r.id));
    renderModal(r);
    const modal=document.getElementById('hubResourceModal');
    modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.classList.add('hub-modal-lock');
  }

  function card(r){
    const type=String(r.type||'other').toLowerCase();
    const rawCreator=String(r.creator?.name||'UNKNOWN');
    const creator=cleanAuthor(rawCreator);
    const models=Array.isArray(r.models)?r.models:[];
    const settings=Array.isArray(r.settings)?r.settings:[];
    const tags=[...models,...settings,...(Array.isArray(r.tags)?r.tags:[])].slice(0,6);
    const image=cover(r.media);
    const thumb=image?`<div class="thumb" style="background-image:url('${esc(image).replace(/'/g,'%27')}');background-size:cover;background-position:center"></div>`:'<div class="thumb b"></div>';
    const tagHtml=tags.length?`<div class="card-tags">${tags.map(t=>`<span class="card-tag">${esc(label(t))}</span>`).join('')}</div>`:'';
    const action=r.primary_file_id?`<a class="action" href="/api/hub-resources/${encodeURIComponent(r.id)}/files/${encodeURIComponent(r.primary_file_id)}" title="Download">⇩</a>`:`<a class="action" href="${esc(r.source_url||'#')}" target="_blank" rel="noopener noreferrer" title="Open source">↗</a>`;
    return `<article class="resource-card" data-dynamic="1" data-resource-id="${esc(r.id)}" data-creator="${esc(slug(creator))}" data-creator-name="${esc(creator.toUpperCase())}" data-type="${esc(plural(type))}" data-model="${esc(models.join(' '))}" data-setting="${esc(settings.join(' '))}">${thumb}<div class="card-body"><div class="type">// ${esc(type.toUpperCase())}</div><div class="card-title-row"><h3>${esc(r.title||'UNTITLED RESOURCE')}</h3><span class="card-by">BY: <b>${esc(creator)}</b></span></div><p>${esc(r.description_short||r.description_full||'')}</p>${tagHtml}<div class="meta"><span>${Number(r.file_count||0)?`${Number(r.file_count)} FILE${Number(r.file_count)===1?'':'S'} | `:''}<span class="free">● FREE</span></span>${action}</div></div></article>`;
  }

  window.__hubResourcesReady=(async()=>{
    try{
      ensureUi();
      const res=await fetch('/api/hub-resources',{cache:'no-store'});
      const d=await res.json();
      if(!res.ok||!d?.ok||!Array.isArray(d.resources)||!d.resources.length)return;
      resources=d.resources;
      const grid=document.querySelector('.resource-grid');
      if(!grid)return;
      const map=new Map(resources.map(x=>[String(x.id),x]));
      grid.querySelectorAll('[data-dynamic="1"]').forEach(x=>x.remove());
      grid.insertAdjacentHTML('afterbegin',resources.map(card).join(''));
      grid.querySelectorAll('.resource-card[data-dynamic="1"]').forEach(el=>el.addEventListener('click',e=>{if(e.target.closest('a,button'))return;const item=map.get(String(el.dataset.resourceId));if(item)openModal(item)}));
      grid.querySelectorAll('.resource-card[data-dynamic="1"] .action').forEach(a=>a.addEventListener('click',e=>e.stopPropagation()));
    }catch(e){console.warn('TAVO HUB dynamic resources unavailable',e)}
  })();
})();
