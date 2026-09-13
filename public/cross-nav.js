(()=>{
  'use strict';
  const path=location.pathname.replace(/\/+$/,'')||'/';
  const isHub=path==='/hub'||path==='/hub.html';
  const isCatalog=path==='/characters'||path==='/characters.html';
  if(!isHub&&!isCatalog)return;

  const iconCatalog='<svg class="cross-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="2.2"/><circle cx="16" cy="8" r="2.2"/><path d="M4.5 17c.8-2.4 2-3.6 3.5-3.6S10.7 14.6 11.5 17M12.5 17c.8-2.4 2-3.6 3.5-3.6s2.7 1.2 3.5 3.6"/></svg>';
  const iconHub='<svg class="cross-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4.5" width="14" height="15" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>';
  const nav=document.createElement('nav');
  nav.className=`archive-cross-nav ${isHub?'hub-cross-nav':'catalog-cross-nav'}`;
  nav.setAttribute('aria-label','Archive sections');
  nav.innerHTML=`<a class="cross-nav-link ${isHub?'active':''}" href="hub.html" ${isHub?'aria-current="page"':''}>${iconHub}<span class="cross-nav-label">TAVO HUB</span></a><span class="cross-nav-swap" aria-hidden="true">↔</span><a class="cross-nav-link ${isCatalog?'active':''}" href="characters.html" ${isCatalog?'aria-current="page"':''}>${iconCatalog}<span class="cross-nav-label">BOT CATALOG</span></a>`;

  if(isHub){document.querySelector('.top-shell')?.appendChild(nav)}
  else{document.querySelector('.hero')?.appendChild(nav)}
})();