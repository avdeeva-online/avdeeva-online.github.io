const __wait = ms => new Promise(r => setTimeout(r, ms));
const __btn = text => [...document.querySelectorAll('button')].find(b => b.offsetWidth > 0 && b.textContent.trim().replace(/\s+/g, '').includes(text));
window.__actions = {
  none: async () => {},
  modal: async () => { document.querySelector('[aria-label="Open Anthony"]').click(); await __wait(900); },
  drawer: async () => { document.getElementById('catalogOpen').click(); await __wait(700); },
  drawerAuthors: async () => { document.getElementById('catalogOpen').click(); await __wait(600); __btn('03AUTHORS').click(); await __wait(500); },
  author: async () => { __btn('AUTHOR').click(); await __wait(500); },
  hashtags: async () => { __btn('#HASHTAGS').click(); await __wait(500); },
  hubModal: async () => { document.querySelector('.resource-card[data-dynamic="1"]').click(); await __wait(1200); },
};
window.__shot = async (name, action = 'none') => { await window.__actions[action](); return window.__snap(name); };

// Computed-style snapshot of every rendered element, keyed by a stable DOM path.
// Animations/transitions are frozen and randomly-glitched/decorative FX nodes are skipped so runs are comparable.
window.__snap = async function (name) {
  if (!document.getElementById('__freeze')) {
    const s = document.createElement('style'); s.id = '__freeze';
    s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';
    document.head.appendChild(s);
  }
  await new Promise(r => setTimeout(r, 300));
  const PROPS = ['display','position','top','left','right','bottom','width','height','margin','padding','font-family','font-size','font-weight','line-height','letter-spacing','text-transform','text-align','color','background-color','background-image','background-size','border','border-radius','box-shadow','opacity','visibility','z-index','overflow','gap','grid-template-columns','flex-direction','align-items','justify-content','white-space','transform','filter','text-shadow','object-fit','aspect-ratio','-webkit-line-clamp','max-width','max-height','min-height','cursor'];
  const SKIP = /glitch|dust|flare|crt|scan|signal|tear|particle|anomal|corrupt/i;
  const out = {};
  const pathOf = el => { const parts = []; for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const p = e.parentElement; const i = p ? [...p.children].filter(c => c.tagName === e.tagName).indexOf(e) : 0; parts.unshift(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + ':' + i); } return parts.join('>'); };
  for (const el of document.querySelectorAll('body *')) {
    if (el.id === '__freeze' || /^(SCRIPT|STYLE|LINK|META|NOSCRIPT)$/.test(el.tagName)) continue;
    const cls = String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || '');
    if (SKIP.test(cls) || SKIP.test(el.id)) continue;
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    const rec = { rect: [Math.round(r.x), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height)], cls };
    for (const p of PROPS) rec[p] = cs.getPropertyValue(p);
    for (const pseudo of ['::before', '::after']) { const ps = getComputedStyle(el, pseudo); if (ps.content && ps.content !== 'none' && ps.content !== 'normal') rec[pseudo] = PROPS.map(p => ps.getPropertyValue(p)).join('|') + '|' + ps.content; }
    out[pathOf(el)] = rec;
  }
  const body = JSON.stringify({ url: location.href, vw: innerWidth, vh: innerHeight, count: Object.keys(out).length, els: out });
  const res = await fetch('/__snap?name=' + encodeURIComponent(name), { method: 'POST', body });
  return (await res.text()) + ' · ' + Object.keys(out).length + ' elements';
};
