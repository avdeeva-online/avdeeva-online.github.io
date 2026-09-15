(()=>{
  'use strict';
  const blobs=new Map();
  let resources=new Map();
  let currentId='';
  const isExtra=f=>Boolean(f?.extra)||String(f?.name||'').startsWith('__extra__');
  const isImage=f=>isExtra(f)||/^image\//i.test(String(f?.mime||''))||/\.(png|jpe?g|webp|gif)$/i.test(String(f?.name||''));
  const mediaUrl=r=>{const m=Array.isArray(r?.media)?r.media:[];const hit=m.find(x=>x&&x.cover&&(x.url||x.src))||m.find(x=>x&&(x.url||x.src));return hit?.url||hit?.src||''};
  const fileUrl=f=>String(f?.download_url||f?.external_url||'');
  const coverFile=r=>{const files=Array.isArray(r?.files)?r.files:[];const normal=files.filter(f=>isImage(f)&&!isExtra(f));return normal.find(f=>f.primary)||normal[0]||files.find(isExtra)||files.find(isImage)||null};
  const extras=r=>(Array.isArray(r?.files)?r.files:[]).filter(isExtra);
  async function objectUrl(url){
    if(!url)return'';
    if(/^data:|^blob:/i.test(url))return url;
    if(blobs.has(url))return blobs.get(url);
    try{
      const res=await fetch(url,{cache:'no-store'});
      if(!res.ok)throw new Error('HTTP_'+res.status);
      const buf=await res.arrayBuffer();
      if(!buf.byteLength)throw new Error('EMPTY');
      let type=res.headers.get('content-type')||'';
      if(!/^image\//i.test(type))type='image/webp';
      const out=URL.createObjectURL(new Blob([buf],{type}));
      blobs.set(url,out);return out;
    }catch(e){console.warn('HUB media recovery failed',url,e);return''}
  }
  async function resolvedCover(r){const direct=mediaUrl(r);if(direct){if(/^data:|^blob:/i.test(direct))return direct;const o=await objectUrl(direct);if(o)return o}const f=coverFile(r);return f?await objectUrl(fileUrl(f)):''}
  async function patchCard(r){const card=document.querySelector(`.resource-card[data-resource-id="${CSS.escape(String(r.id))}"]`);if(!card)return;const thumb=card.querySelector('.thumb');if(!thumb)return;const url=await resolvedCover(r);if(url){thumb.style.backgroundImage=`url("${url}")`;thumb.style.backgroundSize='cover';thumb.style.backgroundPosition='center';thumb.classList.remove('b')}}
  async function patchModal(r){
    const box=document.querySelector('#hubModalContent');if(!box||!r)return;
    const cover=await resolvedCover(r);
    let coverEl=box.querySelector('.hub-modal-cover');
    if(cover){if(!coverEl){coverEl=document.createElement('div');coverEl.className='hub-modal-cover';box.prepend(coverEl)}coverEl.style.backgroundImage=`url("${cover}")`}
    const pane=box.querySelector('[data-pane="extras"]');if(!pane)return;
    const list=extras(r);
    if(!list.length)return;
    pane.querySelector('.hub-empty-extra')?.remove();
    let gallery=pane.querySelector('.hub-extra-images');if(!gallery){gallery=document.createElement('div');gallery.className='hub-extra-images';pane.appendChild(gallery)}
    gallery.innerHTML='';
    for(const f of list){
      const src=await objectUrl(fileUrl(f));if(!src)continue;
      const wrap=document.createElement('div');wrap.className='hub-extra-image';wrap.dataset.extraState='ready';
      const img=document.createElement('img');img.src=src;img.alt=String(f.name||'Extra image').replace(/^__extra__/,'');img.loading='eager';img.style.cssText='display:block;width:100%;height:auto;object-fit:contain';wrap.appendChild(img);gallery.appendChild(wrap)
    }
  }
  async function load(){
    try{const r=await fetch('/api/hub-resources',{cache:'no-store'}),d=await r.json();if(!r.ok||!d?.ok)return;resources=new Map((d.resources||[]).map(x=>[String(x.id),x]));await Promise.all([...resources.values()].map(patchCard));if(currentId)patchModal(resources.get(currentId))}catch(e){console.warn('HUB media recovery index failed',e)}
  }
  document.addEventListener('click',e=>{const card=e.target.closest?.('.resource-card[data-resource-id]');if(!card)return;currentId=String(card.dataset.resourceId||'');setTimeout(()=>patchModal(resources.get(currentId)),30)},true);
  new MutationObserver(()=>{if(currentId&&document.querySelector('#hubResourceModal.open'))patchModal(resources.get(currentId))}).observe(document.body,{subtree:true,childList:true});
  (window.__hubResourcesReady||Promise.resolve()).finally(load);
  addEventListener('pagehide',()=>{for(const u of blobs.values())if(/^blob:/i.test(u))URL.revokeObjectURL(u)},{once:true});
})();
