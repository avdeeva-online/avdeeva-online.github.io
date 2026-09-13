(()=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug=v=>String(v||'unknown').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'unknown';
  const plural=t=>t.endsWith('s')?t:`${t}s`;
  function cover(media){const list=Array.isArray(media)?media:[];const c=list.find(x=>x&&x.cover)||list[0];return c?.url||c?.src||''}
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
    return `<article class="resource-card" data-dynamic="1" data-creator="${esc(slug(creator))}" data-creator-name="${esc(creator.toUpperCase())}" data-type="${esc(plural(type))}" data-model="${esc(models.join(' '))}" data-setting="${esc(settings.join(' '))}">${thumb}<div class="card-body"><div class="type">// ${esc(type.toUpperCase())}</div><h3>${esc(r.title||'UNTITLED RESOURCE')}</h3><p>${esc(r.description_short||r.description_full||'')}</p>${tagHtml}<div class="meta"><span>${Number(r.file_count||0)?`${Number(r.file_count)} FILE${Number(r.file_count)===1?'':'S'} | `:''}<span class="free">● FREE</span></span>${action}</div></div></article>`;
  }
  window.__hubResourcesReady=(async()=>{
    try{
      const r=await fetch('/api/hub-resources',{cache:'no-store'});
      const d=await r.json();
      if(!r.ok||!d?.ok||!Array.isArray(d.resources)||!d.resources.length)return;
      const grid=document.querySelector('.resource-grid');
      if(!grid)return;
      grid.querySelectorAll('[data-dynamic="1"]').forEach(x=>x.remove());
      grid.insertAdjacentHTML('afterbegin',d.resources.map(card).join(''));
    }catch(e){console.warn('TAVO HUB dynamic resources unavailable',e)}
  })();
})();
