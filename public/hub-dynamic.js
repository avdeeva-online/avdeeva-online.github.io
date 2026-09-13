(()=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug=v=>String(v||'unknown').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'unknown';
  const plural=t=>t.endsWith('s')?t:`${t}s`;
  const humanSize=n=>{n=Number(n)||0;if(!n)return'';if(n<1024)return`${n} B`;if(n<1048576)return`${(n/1024).toFixed(1)} KB`;return`${(n/1048576).toFixed(1)} MB`};
  function cover(media){const list=Array.isArray(media)?media:[];const c=list.find(x=>x&&x.cover)||list[0];return c?.url||c?.src||''}
  function creatorHref(v){const s=String(v||'').trim();if(!s)return'';if(s.startsWith('@'))return`https://t.me/${s.slice(1)}`;if(/^https?:\/\//i.test(s))return s;return''}
  function fileLabel(f){const name=String(f?.name||'FILE');if(/\.zip$/i.test(name))return'DOWNLOAD PRESET';if(/regex/i.test(name)&&/\.json$/i.test(name))return'DOWNLOAD REGEX';return`DOWNLOAD ${name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').toUpperCase()}`}

  function ensureUi(){
    if(document.getElementById('hubResourceModal'))return;
    const style=document.createElement('style');
    style.textContent=`
      .resource-card[data-dynamic="1"]{cursor:pointer}
      .card-title-row{display:flex;align-items:baseline;gap:7px;min-width:0;margin:5px 0 5px}
      .card-title-row h3{margin:0;min-width:0}
      .card-by{flex:0 0 auto;font:6.5px/1 var(--mono);letter-spacing:.07em;color:#8e998e;white-space:nowrap;text-transform:uppercase}
      .card-by b{color:#b7aa82;font-weight:400}
      .hub-modal{position:fixed;inset:0;z-index:1000;display:none;align-items:center;justify-content:center;padding:22px;background:rgba(1,4,2,.78);backdrop-filter:blur(5px)}
      .hub-modal.open{display:flex}
      .hub-modal-panel{width:min(760px,100%);max-height:min(86vh,820px);overflow:auto;border:1px solid rgba(153,169,137,.35);border-radius:14px;background:linear-gradient(180deg,rgba(10,15,11,.985),rgba(5,8,6,.995));box-shadow:0 28px 90px rgba(0,0,0,.58);position:relative}
      .hub-modal-cover{height:220px;background:#111 center/cover no-repeat;border-bottom:1px solid rgba(132,148,117,.18);position:relative}
      .hub-modal-cover:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 50%,rgba(4,7,5,.72))}
      .hub-modal-close{position:absolute;right:12px;top:12px;z-index:3;width:32px;height:32px;border:1px solid rgba(171,181,151,.28);border-radius:8px;background:rgba(5,9,6,.75);color:#d9d6ca;cursor:pointer;font:16px/1 var(--mono)}
      .hub-modal-body{padding:18px 20px 20px}
      .hub-modal-type{font:7px/1 var(--mono);letter-spacing:.12em;color:#9aa599}
      .hub-modal-title{margin:7px 0 5px;font:700 28px/1.05 Georgia,"Times New Roman",serif;color:#f0e8d9}
      .hub-modal-author{font:8px/1.4 var(--mono);color:#899488}
      .hub-modal-author a{color:#c7b987;text-decoration:none}
      .hub-modal-tags{display:flex;gap:5px;flex-wrap:wrap;margin:12px 0 0}
      .hub-modal-tag{border:1px solid rgba(128,143,115,.16);border-radius:999px;padding:4px 7px;font:6.5px/1 var(--mono);color:#8e998d;background:rgba(8,12,9,.35)}
      .hub-modal-desc{margin:16px 0 0;padding-top:14px;border-top:1px solid rgba(126,140,113,.13);white-space:pre-wrap;font:9px/1.58 var(--mono);color:#b7beb4}
      .hub-modal-links{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
      .hub-modal-link,.hub-file-btn{display:inline-flex;align-items:center;justify-content:center;min-height:34px;border:1px solid rgba(151,162,129,.24);border-radius:8px;padding:0 11px;background:rgba(11,16,12,.72);color:#c9c9bb;font:7.5px/1 var(--mono);letter-spacing:.06em;text-decoration:none}
      .hub-modal-link:hover,.hub-file-btn:hover{border-color:rgba(191,181,119,.48);color:#eee2c1}
      .hub-files{margin-top:18px;padding-top:14px;border-top:1px solid rgba(126,140,113,.13)}
      .hub-files-title{font:7px/1 var(--mono);letter-spacing:.12em;color:#879286;margin-bottom:8px}
      .hub-file-list{display:grid;gap:7px}
      .hub-file-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 10px;border:1px solid rgba(126,140,113,.13);border-radius:9px;background:rgba(7,11,8,.34)}
      .hub-file-name{font:8px/1.25 var(--mono);color:#c5ccc0;word-break:break-word}
      .hub-file-meta{margin-top:3px;font:6.5px/1.2 var(--mono);color:#758075}
      .hub-file-btn.primary{border-color:rgba(192,179,113,.42);color:#eadfbd;background:rgba(139,128,75,.10)}
      body.hub-modal-lock{overflow:hidden}
      @media(max-width:600px){.hub-modal{padding:8px}.hub-modal-panel{max-height:94vh;border-radius:11px}.hub-modal-cover{height:170px}.hub-modal-body{padding:14px}.hub-modal-title{font-size:23px}.hub-file-row{grid-template-columns:1fr}.hub-file-btn{width:100%}.card-title-row{gap:5px}.card-by{font-size:6px}}
    `;
    document.head.appendChild(style);
    const modal=document.createElement('div');
    modal.id='hubResourceModal';modal.className='hub-modal';modal.setAttribute('aria-hidden','true');
    modal.innerHTML='<div class="hub-modal-panel" role="dialog" aria-modal="true"><button class="hub-modal-close" type="button" aria-label="Close">×</button><div id="hubModalContent"></div></div>';
    document.body.appendChild(modal);
    const close=()=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.classList.remove('hub-modal-lock')};
    modal.querySelector('.hub-modal-close').onclick=close;
    modal.addEventListener('click',e=>{if(e.target===modal)close()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))close()});
  }

  function openModal(r){
    ensureUi();
    const modal=document.getElementById('hubResourceModal'),box=document.getElementById('hubModalContent');
    const image=cover(r.media);
    const creator=String(r.creator?.name||'UNKNOWN');
    const cLink=creatorHref(r.creator?.link);
    const tags=[...(Array.isArray(r.models)?r.models:[]),...(Array.isArray(r.settings)?r.settings:[]),...(Array.isArray(r.tags)?r.tags:[])];
    const files=Array.isArray(r.files)?r.files:[];
    const coverHtml=image?`<div class="hub-modal-cover" style="background-image:url('${esc(image).replace(/'/g,'%27')}')"></div>`:'';
    const authorHtml=cLink?`BY: <a href="${esc(cLink)}" target="_blank" rel="noopener noreferrer">${esc(creator)}</a>`:`BY: ${esc(creator)}`;
    const links=[cLink?`<a class="hub-modal-link" href="${esc(cLink)}" target="_blank" rel="noopener noreferrer">AUTHOR ↗</a>`:'',r.source_url?`<a class="hub-modal-link" href="${esc(r.source_url)}" target="_blank" rel="noopener noreferrer">ORIGINAL POST ↗</a>`:''].filter(Boolean).join('');
    const fileRows=files.length?files.map(f=>`<div class="hub-file-row"><div><div class="hub-file-name">${esc(f.name||'FILE')}</div><div class="hub-file-meta">${esc(f.mime||'FILE')}${f.size?` · ${esc(humanSize(f.size))}`:''}${f.primary?' · PRIMARY':''}</div></div><a class="hub-file-btn ${f.primary?'primary':''}" href="${esc(f.download_url||f.external_url||'#')}">${esc(fileLabel(f))} ⇩</a></div>`).join(''):'<div class="hub-file-meta">NO DOWNLOADABLE FILES</div>';
    box.innerHTML=`${coverHtml}<div class="hub-modal-body"><div class="hub-modal-type">// ${esc(String(r.type||'RESOURCE').toUpperCase())}</div><h2 class="hub-modal-title">${esc(r.title||'UNTITLED RESOURCE')}</h2><div class="hub-modal-author">${authorHtml}</div>${tags.length?`<div class="hub-modal-tags">${tags.map(t=>`<span class="hub-modal-tag">${esc(String(t).replaceAll('-',' ').toUpperCase())}</span>`).join('')}</div>`:''}<div class="hub-modal-desc">${esc(r.description_full||r.description_short||'')}</div><div class="hub-modal-links">${links}</div><div class="hub-files"><div class="hub-files-title">DOWNLOAD FILES</div><div class="hub-file-list">${fileRows}</div></div></div>`;
    modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.classList.add('hub-modal-lock');
  }

  function card(r){
    const type=String(r.type||'other').toLowerCase();
    const creator=String(r.creator?.name||'UNKNOWN');
    const models=Array.isArray(r.models)?r.models:[];
    const settings=Array.isArray(r.settings)?r.settings:[];
    const tags=[...models,...settings,...(Array.isArray(r.tags)?r.tags:[])].slice(0,6);
    const image=cover(r.media);
    const thumb=image?`<div class="thumb" style="background-image:url('${esc(image).replace(/'/g,'%27')}');background-size:cover;background-position:center"></div>`:'<div class="thumb b"></div>';
    const tagHtml=tags.length?`<div class="card-tags">${tags.map(t=>`<span class="card-tag">${esc(String(t).replaceAll('-',' ').toUpperCase())}</span>`).join('')}</div>`:'';
    const action=r.primary_file_id?`<a class="action" href="/api/hub-resources/${encodeURIComponent(r.id)}/files/${encodeURIComponent(r.primary_file_id)}" title="Download">⇩</a>`:`<a class="action" href="${esc(r.source_url||'#')}" target="_blank" rel="noopener noreferrer" title="Open source">↗</a>`;
    return `<article class="resource-card" data-dynamic="1" data-resource-id="${esc(r.id)}" data-creator="${esc(slug(creator))}" data-creator-name="${esc(creator.toUpperCase())}" data-type="${esc(plural(type))}" data-model="${esc(models.join(' '))}" data-setting="${esc(settings.join(' '))}">${thumb}<div class="card-body"><div class="type">// ${esc(type.toUpperCase())}</div><div class="card-title-row"><h3>${esc(r.title||'UNTITLED RESOURCE')}</h3><span class="card-by">BY: <b>${esc(creator)}</b></span></div><p>${esc(r.description_short||r.description_full||'')}</p>${tagHtml}<div class="meta"><span>${Number(r.file_count||0)?`${Number(r.file_count)} FILE${Number(r.file_count)===1?'':'S'} | `:''}<span class="free">● FREE</span></span>${action}</div></div></article>`;
  }

  window.__hubResourcesReady=(async()=>{
    try{
      ensureUi();
      const r=await fetch('/api/hub-resources',{cache:'no-store'});
      const d=await r.json();
      if(!r.ok||!d?.ok||!Array.isArray(d.resources)||!d.resources.length)return;
      const grid=document.querySelector('.resource-grid');
      if(!grid)return;
      const map=new Map(d.resources.map(x=>[String(x.id),x]));
      grid.querySelectorAll('[data-dynamic="1"]').forEach(x=>x.remove());
      grid.insertAdjacentHTML('afterbegin',d.resources.map(card).join(''));
      grid.querySelectorAll('.resource-card[data-dynamic="1"]').forEach(el=>el.addEventListener('click',e=>{if(e.target.closest('a,button'))return;const item=map.get(String(el.dataset.resourceId));if(item)openModal(item)}));
      grid.querySelectorAll('.resource-card[data-dynamic="1"] .action').forEach(a=>a.addEventListener('click',e=>e.stopPropagation()));
    }catch(e){console.warn('TAVO HUB dynamic resources unavailable',e)}
  })();
})();
