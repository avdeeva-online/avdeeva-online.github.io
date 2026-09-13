(()=>{
  'use strict';
  const loadedUrls=new Set();
  const mimeFromName=name=>{const n=String(name||'').toLowerCase();if(n.endsWith('.png'))return'image/png';if(/\.jpe?g$/.test(n))return'image/jpeg';if(n.endsWith('.gif'))return'image/gif';return'image/webp'};
  const extractUrl=el=>{const bg=el.style.backgroundImage||getComputedStyle(el).backgroundImage||'';const m=bg.match(/^url\(["']?(.*?)["']?\)$/);return m?m[1]:''};
  const style=document.createElement('style');
  style.dataset.hubExtraFix='1';
  style.textContent=`
    .hub-extra-image{position:relative;display:flex!important;align-items:center;justify-content:center;overflow:hidden;background:#070b08!important}
    .hub-extra-image>img{display:block;width:100%;height:100%;object-fit:cover;object-position:center;border:0}
    .hub-extra-image[data-extra-state="loading"]:after{content:'LOADING IMAGE…';font:7px/1.3 var(--mono);letter-spacing:.07em;color:#6f796f}
    .hub-extra-image[data-extra-state="error"]:after{content:'IMAGE FAILED TO LOAD';font:7px/1.3 var(--mono);letter-spacing:.07em;color:#9d786d}
  `;
  document.head.appendChild(style);

  async function hydrate(el){
    if(!el||el.dataset.extraHydrated)return;
    const src=extractUrl(el);
    if(!src)return;
    el.dataset.extraHydrated='1';
    el.dataset.extraState='loading';
    el.style.backgroundImage='none';
    try{
      const res=await fetch(src,{cache:'no-store'});
      if(!res.ok)throw new Error(`HTTP_${res.status}`);
      const buf=await res.arrayBuffer();
      if(!buf.byteLength)throw new Error('EMPTY_IMAGE');
      const type=(res.headers.get('content-type')||'').startsWith('image/')?res.headers.get('content-type'):mimeFromName(el.title);
      const blob=new Blob([buf],{type});
      const objectUrl=URL.createObjectURL(blob);
      const img=document.createElement('img');
      img.alt=el.title||'Extra image';
      img.loading='eager';
      img.decoding='async';
      img.onload=()=>{el.dataset.extraState='ready'};
      img.onerror=()=>{URL.revokeObjectURL(objectUrl);el.dataset.extraState='error';console.warn('EXTRAS image decode failed',src,type,buf.byteLength)};
      img.src=objectUrl;
      el.replaceChildren(img);
      loadedUrls.add(objectUrl);
    }catch(err){
      el.dataset.extraState='error';
      console.warn('EXTRAS image load failed',src,err);
    }
  }

  function scan(root=document){root.querySelectorAll?.('.hub-extra-image').forEach(hydrate)}
  scan();
  new MutationObserver(mutations=>{for(const m of mutations){for(const n of m.addedNodes){if(n.nodeType!==1)continue;if(n.matches?.('.hub-extra-image'))hydrate(n);scan(n)}}}).observe(document.body,{subtree:true,childList:true});
  addEventListener('pagehide',()=>loadedUrls.forEach(URL.revokeObjectURL),{once:true});
})();
