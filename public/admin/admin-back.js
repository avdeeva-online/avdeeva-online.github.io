/* ARCHIVE.EXE admin shell (injected into every /admin/ page by the Worker).
   One navigation for the whole admin: three sections (Боты / TAVO HUB / Система), each with its own tabs.
   PAGES below says, per page, which tab is active, the Russian title, and which leftover blocks to hide —
   pages keep their own logic; this file only frames them. */
(()=>{
  if(document.querySelector('[data-admin-global-nav]'))return;
  // Pages are served both as /x.html and as the extensionless /x: compare against one canonical form.
  const raw=location.pathname,path=raw.endsWith('/')?raw:raw.replace(/\/index\.html$/,'/').replace(/^(.*\/[^/.]+)$/,'$1.html');
  const tool=new URLSearchParams(location.search).get('tool')||'';

  const SECTIONS=[
    {id:'bots',label:'Боты',tabs:[
      {id:'bot-cards',label:'Карточки',href:'/admin/import/edit.html'},
      {id:'bot-import',label:'Импорт',href:'/admin/import/'},
      {id:'bot-universes',label:'Вселенные',href:'/admin/import/?tool=universes'},
      {id:'bot-audit',label:'Проверка',href:'/admin/import/?tool=audit'}]},
    {id:'hub',label:'TAVO HUB',tabs:[
      {id:'hub-resources',label:'Ресурсы',href:'/admin/hub/edit.html'},
      {id:'hub-new',label:'Новый ресурс',href:'/admin/hub/'},
      {id:'hub-drafts',label:'Черновики',href:'/admin/drafts.html',count:'drafts'},
      {id:'hub-suggestions',label:'Предложения',href:'/admin/hub/suggestions.html',count:'suggestions'}]},
    {id:'system',label:'Система',tabs:[
      {id:'sys-maintenance',label:'Обслуживание',href:'/admin/storage.html'},
      {id:'sys-telegram',label:'Telegram-боты',href:'/admin/telegram.html'}]}
  ];

  // Per page: active tab, title + one-line explanation, and blocks that do not belong on it.
  const PAGES={
    '/admin/':{tab:'',title:'Админка',sub:'Что ждёт внимания и быстрые переходы.'},
    '/admin/import/edit.html':{tab:'bot-cards',title:'Карточки ботов',sub:'Редактирование опубликованных ботов: описание, теги, вселенные, сеттинги, POV, скрытие.',hide:['.tabs','.admin-local-nav']},
    '/admin/import/':tool==='universes'
      ?{tab:'bot-universes',title:'Вселенные',sub:'Кандидаты во вселенные и управление названиями. Система только предлагает — назначаешь ты.',hide:['#authorPanel','#linksPanel','#recordsPanel','#auditPanel','.tabs'],show:['#universePanel'],click:'[data-mode="universes"]'}
      :tool==='audit'
      ?{tab:'bot-audit',title:'Проверка архива',sub:'Перепроверка всех ботов по источнику: теги, сеттинги, вселенные, лорбуки.',hide:['#authorPanel','#linksPanel','#recordsPanel','#universePanel','.tabs'],show:['#auditPanel']}
      :{tab:'bot-import',title:'Импорт ботов',sub:'Все боты автора по ссылке на его профиль DataCat — или список ссылок JanitorAI.',hide:['#auditPanel','#universePanel','[data-mode="universes"]','[data-bot-editor-link]','.tabs a']},
    '/admin/hub/edit.html':{tab:'hub-resources',title:'Ресурсы HUB',sub:'Опубликованные ресурсы. «Изменить» открывает обычную форму и обновляет ресурс на месте.',hide:['.tabs']},
    '/admin/hub/':{tab:'hub-new',title:'Новый ресурс',sub:'Ссылка на пост в Telegram → черновик → проверка → публикация. Автоматически ничего не публикуется.',hide:['.tabs','#jsonPreview','.json-preview']},
    '/admin/drafts.html':{tab:'hub-drafts',title:'Черновики',sub:'Незаконченные ресурсы из Telegram-бота. Открой черновик в форме нового ресурса, допиши и опубликуй.',hide:['.system-note']},
    '/admin/hub/suggestions.html':{tab:'hub-suggestions',title:'Предложения',sub:'Ссылки, которые прислали посетители через «Suggest resource».'},
    '/admin/storage.html':{tab:'sys-maintenance',title:'Обслуживание',sub:'Починка картинок HUB и ссылок на авторов. Перенос файлов в R2 завершён — его кнопки свёрнуты ниже.',hide:['.top .back']},
    '/admin/telegram.html':{tab:'sys-telegram',title:'Telegram-боты',sub:'Состояние админ-бота и публичного бота.',hide:['.head .back']}
  };
  const page=PAGES[path]||{tab:'',title:'',sub:''};
  const activeSection=SECTIONS.find(s=>s.tabs.some(t=>t.id===page.tab));

  const style=document.createElement('style');
  style.textContent=`
    .adm-nav{width:min(1380px,calc(100% - 28px));margin:14px auto 0;font-family:var(--mono,Consolas,ui-monospace,monospace)}
    .adm-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .adm-brand{margin-right:10px;color:#d8dfcf;font:700 11px/1 var(--mono,Consolas,monospace);letter-spacing:.12em;text-decoration:none}
    .adm-sec{border:1px solid #2f382b;background:#0d110c;color:#9aa693;text-decoration:none;padding:9px 13px;font-size:11px;letter-spacing:.04em;border-radius:6px}
    .adm-sec:hover{border-color:#59684f;color:#e3e8da}
    .adm-sec.active{border-color:#8f8558;background:#1c2016;color:#efe4bd}
    .adm-site{margin-left:auto;color:#6f7a69;font-size:10px;text-decoration:none;letter-spacing:.06em}
    .adm-site:hover{color:#cbd4c2}
    .adm-tabs{display:flex;gap:4px;flex-wrap:wrap;margin:10px 0 0;padding:8px 0 0;border-top:1px solid #232a21}
    .adm-tab{color:#8f9b88;text-decoration:none;padding:7px 11px;font-size:10.5px;letter-spacing:.03em;border-radius:5px;border:1px solid transparent}
    .adm-tab:hover{color:#e0e6d7;background:#10140e}
    .adm-tab.active{color:#eadfbf;background:#171b12;border-color:#4c5540}
    .adm-count{display:inline-block;min-width:16px;margin-left:5px;padding:1px 5px;border-radius:9px;background:#3a3522;color:#efe4bd;font-size:9px;text-align:center}
    .adm-count:empty{display:none}
    .adm-hidden{display:none!important}
    .adm-sub{margin:6px 0 0;color:#8a9584;font:12px/1.5 var(--mono,Consolas,monospace);max-width:760px}
    .head .eyebrow,.head .badge,.topbar .eyebrow,.top .eyebrow{display:none!important}
    @media(max-width:720px){.adm-site{margin-left:0;width:100%}}
  `;
  document.head.appendChild(style);

  const nav=document.createElement('nav');nav.className='adm-nav';nav.dataset.adminGlobalNav='1';
  nav.innerHTML=`<div class="adm-row"><a class="adm-brand" href="/admin/">ARCHIVE ADMIN</a>${SECTIONS.map(s=>`<a class="adm-sec${s===activeSection?' active':''}" href="${s.tabs[0].href}">${s.label}</a>`).join('')}<a class="adm-site" href="/" target="_blank" rel="noopener">сайт ↗</a></div>${activeSection?`<div class="adm-tabs">${activeSection.tabs.map(t=>`<a class="adm-tab${t.id===page.tab?' active':''}" href="${t.href}">${t.label}${t.count?`<span class="adm-count" data-adm-count="${t.count}"></span>`:''}</a>`).join('')}</div>`:''}`;
  document.body.prepend(nav);

  // Page frame: Russian title + one-line explanation; hide leftovers of the old navigation.
  const h1=document.querySelector('main h1, h1');
  if(h1&&page.title){h1.textContent=page.title;if(page.sub&&!h1.parentElement.querySelector('.adm-sub')){const p=document.createElement('p');p.className='adm-sub';p.textContent=page.sub;h1.insertAdjacentElement('afterend',p)}}
  if(page.title)document.title=`${page.title} · ARCHIVE ADMIN`;
  const apply=()=>{(page.hide||[]).forEach(s=>document.querySelectorAll(s).forEach(e=>e.classList.add('adm-hidden')));(page.show||[]).forEach(s=>document.querySelectorAll(s).forEach(e=>{e.classList.remove('hidden','adm-hidden')}))};
  apply();
  if(page.click)document.querySelector(page.click)?.click();
  // Some pages render late (their own scripts rebuild parts of the DOM): apply once more after load.
  window.addEventListener('load',apply,{once:true});

  // The resource form opens Telegram drafts through draft-bridge.js (?draft=<id>).
  if(path==='/admin/hub/'&&!document.querySelector('script[data-draft-bridge-loader]')){const s=document.createElement('script');s.src='/admin/hub/draft-bridge.js?v=20260927-ru1';s.dataset.draftBridgeLoader='1';document.body.appendChild(s)}

  // Badges: drafts waiting / new suggestions, on every page.
  const setCount=(key,n)=>document.querySelectorAll(`[data-adm-count="${key}"]`).forEach(e=>e.textContent=n>0?String(n):'');
  const get=url=>fetch(url,{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
  if(activeSection?.id==='hub'||path==='/admin/'){
    get('/api/admin/telegram-drafts').then(d=>{const n=Array.isArray(d?.drafts)?d.drafts.length:0;setCount('drafts',n);window.dispatchEvent(new CustomEvent('adm:count',{detail:{key:'drafts',n}}))});
    get('/api/admin/hub-suggestions').then(d=>{const n=Array.isArray(d?.suggestions)?d.suggestions.filter(x=>String(x.status||'new')==='new').length:0;setCount('suggestions',n);window.dispatchEvent(new CustomEvent('adm:count',{detail:{key:'suggestions',n}}))});
  }
})();
