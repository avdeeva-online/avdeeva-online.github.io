(()=>{
  'use strict';
  const COLORS=[
    ['dark',['dark','charcoal','тёмн','темн']],
    ['black',['black','jet black','черн']],
    ['light',['light','white','cream','светл','бел']],
    ['green',['green','olive','emerald','зелён','зелен','олив']],
    ['blue',['blue','navy','cyan','голуб','син']],
    ['red',['red','burgundy','crimson','красн','бордо']],
    ['pink',['pink','rose','розов']],
    ['purple',['purple','violet','lavender','фиолет','лаванд']],
    ['brown',['brown','coffee','chocolate','корич','кофе']],
    ['beige',['beige','sand','tan','беж','песоч']],
    ['grey',['grey','gray','silver','сер','серебр']]
  ];
  const SECTION_INDEX={all:0,presets:1,creators:2,plugins:3,themes:4,guides:5,links:6,tools:7};
  const sideLinks=()=>[...document.querySelectorAll('.side-link')];
  const grid=()=>document.querySelector('.resource-grid');
  const cards=()=>[...document.querySelectorAll('.resource-card[data-dynamic="1"]')];
  const activeKey=()=>{
    const i=sideLinks().findIndex(x=>x.classList.contains('active'));
    return Object.keys(SECTION_INDEX).find(k=>SECTION_INDEX[k]===i)||'all';
  };
  const text=v=>String(v||'').trim().toLowerCase();
  const cardTags=card=>[...card.querySelectorAll('.card-tag')].map(x=>text(x.textContent)).filter(Boolean);
  const cardText=card=>text(`${card.dataset.title||''} ${card.textContent||''}`);
  const normalizeToken=v=>text(v).replace(/^#/, '').replace(/\s+/g,'-');
  const detectColors=card=>{
    const hay=cardText(card);
    const tags=cardTags(card);
    const explicit=tags.filter(t=>t.startsWith('color:')).map(t=>normalizeToken(t.slice(6)));
    if(explicit.length)return [...new Set(explicit)];
    return COLORS.filter(([,keys])=>keys.some(k=>hay.includes(k))).map(([id])=>id);
  };
  const human=v=>String(v||'').replace(/^color:/i,'').replace(/[-_]+/g,' ').toUpperCase();
  let selected='all';

  function ensurePanel(){
    const line=document.querySelector('.hub-control-line');
    if(!line)return null;
    let panel=document.querySelector('.hub-category-filters');
    if(panel)return panel;
    panel=document.createElement('div');
    panel.className='hub-category-filters';
    panel.hidden=true;
    const toolbarRight=line.querySelector('.toolbar-right');
    line.insertBefore(panel,toolbarRight||null);
    return panel;
  }

  function availableTagValues(type){
    const set=new Set();
    cards().filter(c=>c.dataset.type===type).forEach(c=>{
      cardTags(c).forEach(t=>{
        if(!t||t.startsWith('color:'))return;
        if(['gemini','claude','gpt','deepseek','other','modern','fantasy','medieval','post-apoc','post apocalypse','post-apocalypse','sci-fi','omegaverse','rusreal'].includes(t))return;
        set.add(t);
      });
    });
    return [...set].slice(0,10);
  }

  function themeColorsPresent(){
    const set=new Set();
    cards().filter(c=>c.dataset.type==='themes').forEach(c=>detectColors(c).forEach(v=>set.add(v)));
    const stable=['dark','black','light','green','blue','red','pink','purple','brown','beige'];
    return COLORS.map(([id])=>id).filter(id=>set.has(id)||stable.includes(id));
  }

  function configFor(key){
    if(key==='themes')return {label:'COLOR',values:themeColorsPresent(),mode:'color'};
    if(key==='plugins')return {label:'PURPOSE',values:availableTagValues('plugins'),mode:'tag'};
    if(key==='guides')return {label:'TOPIC',values:availableTagValues('guides'),mode:'tag'};
    if(key==='links')return {label:'TOPIC',values:availableTagValues('links'),mode:'tag'};
    if(key==='tools')return {label:'PURPOSE',values:availableTagValues('tools'),mode:'tag'};
    return null;
  }

  function matches(card,cfg,value){
    if(value==='all')return true;
    if(cfg.mode==='color')return detectColors(card).includes(value);
    return cardTags(card).map(normalizeToken).includes(normalizeToken(value));
  }

  function applyCategoryFilter(){
    const key=activeKey(),cfg=configFor(key);
    cards().forEach(card=>{
      const relevant=card.dataset.type===key;
      const hide=cfg&&relevant&&!matches(card,cfg,selected);
      card.classList.toggle('category-filter-hidden',Boolean(hide));
    });
  }

  function syncThemeLayout(){
    const g=grid();if(!g)return;
    g.classList.toggle('hub-theme-grid',activeKey()==='themes');
  }

  function render(){
    const panel=ensurePanel();if(!panel)return;
    const key=activeKey(),cfg=configFor(key);
    selected='all';
    syncThemeLayout();
    cards().forEach(c=>c.classList.remove('category-filter-hidden'));
    if(!cfg){panel.hidden=true;panel.innerHTML='';return}
    panel.hidden=false;
    const values=cfg.values||[];
    panel.innerHTML=`<span class="hub-category-label">${cfg.label}</span><div class="hub-category-tags"><button type="button" class="hub-category-filter active" data-value="all">ALL</button>${values.map(v=>`<button type="button" class="hub-category-filter" data-value="${v}">${human(v)}</button>`).join('')}</div>`;
    if(!values.length){panel.innerHTML=`<span class="hub-category-label">${cfg.label}</span><span class="hub-category-empty">NO FILTER TAGS YET</span>`}
  }

  function bind(){
    if(document.documentElement.dataset.hubCategoryBound==='1')return;
    const panel=ensurePanel();if(!panel)return;
    document.documentElement.dataset.hubCategoryBound='1';
    panel.addEventListener('click',e=>{
      const b=e.target.closest('.hub-category-filter');if(!b)return;
      selected=b.dataset.value||'all';
      panel.querySelectorAll('.hub-category-filter').forEach(x=>x.classList.toggle('active',x===b));
      applyCategoryFilter();
    });
    sideLinks().forEach(link=>link.addEventListener('click',()=>setTimeout(render,0)));
    document.querySelector('.search input')?.addEventListener('input',()=>setTimeout(applyCategoryFilter,0));
    render();
  }

  function addStyles(){
    if(document.querySelector('style[data-hub-category-filters]'))return;
    const s=document.createElement('style');s.dataset.hubCategoryFilters='1';s.textContent=`
      .hub-category-filters{display:flex;align-items:center;gap:7px;min-width:0;flex:1 1 auto;animation:hubPanelIn .18s ease-out both}
      .hub-category-filters[hidden]{display:none!important}
      .hub-category-label{flex:0 0 auto;font:6.9px/1 var(--mono);letter-spacing:.08em;color:#818b81}
      .hub-category-tags{display:flex;align-items:center;gap:4px;min-width:0;flex-wrap:wrap}
      .hub-category-filter{appearance:none;min-height:25px;padding:5px 8px;border:1px solid rgba(143,157,128,.16);border-radius:7px;background:rgba(8,13,9,.42);color:#98a197;font:6.8px/1 var(--mono);letter-spacing:.025em;cursor:pointer;transition:color .16s,border-color .16s,background .16s,transform .16s,box-shadow .16s}
      .hub-category-filter:hover{transform:translateY(-1px);color:#cfd4ca;border-color:rgba(170,179,148,.28)}
      .hub-category-filter.active{border-color:rgba(194,181,109,.50);background:rgba(135,126,71,.12);color:#eadfbd;box-shadow:0 0 12px rgba(184,164,86,.045)}
      .hub-category-empty{font:6.6px/1 var(--mono);letter-spacing:.06em;color:#69746b}
      .resource-card.category-filter-hidden{display:none!important}

      /* Themes: compact width with a slightly taller portrait preview. */
      .resource-grid.hub-theme-grid{grid-template-columns:repeat(auto-fill,minmax(230px,290px));gap:10px;justify-content:start}
      .resource-grid.hub-theme-grid .resource-card{min-height:0;width:100%;max-width:290px}
      .resource-grid.hub-theme-grid .thumb{height:225px!important;flex:0 0 225px!important;aspect-ratio:auto!important;background-size:cover!important;background-position:center top!important;border-radius:10px 10px 5px 5px}
      .resource-grid.hub-theme-grid .card-body{padding:8px 9px 7px}
      .resource-grid.hub-theme-grid .resource-card h3{font-size:14.2px;line-height:1.06}
      .resource-grid.hub-theme-grid .resource-card p{min-height:0;max-height:2.7em;font-size:8px}
      .resource-grid.hub-theme-grid .card-tags{margin-top:4px}
      @media(max-width:900px){.resource-grid.hub-theme-grid{grid-template-columns:repeat(2,minmax(0,1fr));justify-content:stretch}.resource-grid.hub-theme-grid .resource-card{max-width:none}.resource-grid.hub-theme-grid .thumb{height:200px!important;flex-basis:200px!important}}
      @media(max-width:700px){.hub-category-filters{flex:1 1 100%;order:2;overflow-x:auto;scrollbar-width:none}.hub-category-filters::-webkit-scrollbar{display:none}.hub-category-tags{flex-wrap:nowrap}.hub-category-filter{flex:0 0 auto}.resource-grid.hub-theme-grid .thumb{height:190px!important;flex-basis:190px!important}}
      @media(max-width:500px){.resource-grid.hub-theme-grid{grid-template-columns:1fr}.resource-grid.hub-theme-grid .thumb{height:205px!important;flex-basis:205px!important}}
    `;document.head.appendChild(s);
  }

  function waitForHub(tries=0){
    if(document.querySelector('.hub-control-line')&&document.querySelector('.resource-grid')&&(cards().length||tries>50)){bind();return}
    if(tries<80)setTimeout(()=>waitForHub(tries+1),50);
  }

  addStyles();
  waitForHub();
})();