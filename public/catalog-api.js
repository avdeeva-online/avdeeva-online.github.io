(()=>{
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let baseBots=Array.isArray(window.BOTS)?[...window.BOTS]:[];
  let liveBots=[];

  function mergeBots(){
    const seen=new Set(),all=[];
    for(const b of [...liveBots,...baseBots]){
      const key=b.janitorUuid||b.id||`${b.author}:${b.nameEn}`;
      if(seen.has(key))continue;
      seen.add(key);all.push(b);
    }
    window.BOTS=all;
    if(typeof window.render==='function')window.render();
  }

  async function loadLive(){
    try{
      const r=await fetch('/api/characters?limit=1000',{cache:'no-store'}),data=await r.json();
      if(!r.ok||!data.ok)throw new Error(data.message||data.error||`HTTP ${r.status}`);
      liveBots=Array.isArray(data.characters)?data.characters:[];
      mergeBots();
      window.dispatchEvent(new CustomEvent('archive:catalog-updated',{detail:{characters:liveBots}}));
      return liveBots;
    }catch(e){console.warn('ARCHIVE live catalog unavailable',e);return[]}
  }

  function styles(){
    if($('#archiveImportStyles'))return;
    const s=document.createElement('style');s.id='archiveImportStyles';s.textContent=`
      .archive-import-trigger{border-color:#8c7850!important;color:#e7d9b9!important;background:linear-gradient(180deg,#292419,#171812)!important}
      .archive-import-trigger:hover{border-color:#c0a46d!important}
      .archive-import-modal[hidden]{display:none}.archive-import-modal{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:24px}
      .archive-import-backdrop{position:absolute;inset:0;background:rgba(4,7,4,.82);backdrop-filter:blur(4px)}
      .archive-import-card{position:relative;width:min(760px,calc(100vw - 32px));max-height:calc(100vh - 48px);overflow:auto;background:#10140f;border:1px solid #4b5640;box-shadow:0 24px 90px #000;padding:24px;color:#d8deca;font-family:Consolas,monospace}
      .archive-import-card h2{margin:0 0 5px;font-size:20px;letter-spacing:.05em}.archive-import-card>p{margin:0 0 18px;color:#84907c;font-size:12px}
      .archive-import-close{position:absolute;right:12px;top:10px;background:none;border:0;color:#9eaa95;font-size:28px;cursor:pointer}
      .archive-import-row{display:flex;gap:9px}.archive-import-row input{min-width:0;flex:1;background:#090c09;border:1px solid #4a5541;color:#e2e7da;padding:12px 13px;font:13px Consolas,monospace;outline:none}.archive-import-row input:focus{border-color:#82926f}
      .archive-import-go{background:#29351f;border:1px solid #71825f;color:#e3ead7;padding:0 18px;font:12px Consolas,monospace;cursor:pointer}.archive-import-go:disabled{opacity:.45;cursor:wait}
      .archive-import-state{margin:13px 0;color:#a9b89b;font-size:12px;min-height:17px}.archive-import-state.error{color:#d49784}.archive-import-state.ok{color:#b9cf8f}
      .archive-import-preview{display:grid;grid-template-columns:150px 1fr;gap:18px;margin-top:14px;padding-top:18px;border-top:1px solid #303a2c}.archive-import-preview[hidden]{display:none}
      .archive-import-preview img{width:150px;aspect-ratio:3/4;object-fit:cover;background:#080b08;border:1px solid #394333}.archive-import-preview h3{margin:2px 0 6px;font-size:19px}.archive-import-by{color:#96a58c;font-size:12px;margin-bottom:11px}.archive-import-desc{color:#c0c8b7;line-height:1.55;font:13px/1.55 system-ui,sans-serif;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}
      .archive-import-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:15px}.archive-import-actions a,.archive-import-actions button{border:1px solid #58664d;background:#171d14;color:#dce5cf;padding:9px 11px;text-decoration:none;font:11px Consolas,monospace;cursor:pointer}.archive-import-actions a.primary{background:#26331f;border-color:#71825f}
      @media(max-width:620px){.archive-import-row{flex-direction:column}.archive-import-go{padding:12px}.archive-import-preview{grid-template-columns:90px 1fr}.archive-import-preview img{width:90px}}
    `;document.head.appendChild(s);
  }

  function buildModal(){
    styles();
    if($('#archiveImportModal'))return;
    const box=document.createElement('div');box.id='archiveImportModal';box.className='archive-import-modal';box.hidden=true;box.innerHTML=`
      <div class="archive-import-backdrop" data-import-close></div>
      <section class="archive-import-card">
        <button class="archive-import-close" data-import-close>×</button>
        <h2>IMPORT CHARACTER / NODE_00</h2>
        <p>PASTE A PUBLIC JANITORAI CHARACTER LINK</p>
        <div class="archive-import-row"><input id="archiveImportUrl" placeholder="https://janitorai.com/characters/..." autocomplete="off"><button id="archiveImportGo" class="archive-import-go">IMPORT</button></div>
        <div id="archiveImportState" class="archive-import-state">READY.</div>
        <div id="archiveImportPreview" class="archive-import-preview" hidden><img id="archiveImportImage" alt=""><div><h3 id="archiveImportName"></h3><div id="archiveImportBy" class="archive-import-by"></div><div id="archiveImportDesc" class="archive-import-desc"></div><div id="archiveImportActions" class="archive-import-actions"></div></div></div>
      </section>`;
    document.body.appendChild(box);
    box.querySelectorAll('[data-import-close]').forEach(x=>x.onclick=()=>{box.hidden=true});
    $('#archiveImportGo').onclick=()=>runImport();
    $('#archiveImportUrl').addEventListener('keydown',e=>{if(e.key==='Enter')runImport()});
  }

  function bindTrigger(){
    const existing=$('#importOpen');
    if(existing){
      existing.classList.add('archive-import-trigger');
      existing.onclick=()=>{buildModal();$('#archiveImportModal').hidden=false;setTimeout(()=>$('#archiveImportUrl')?.focus(),0)};
      return;
    }
    const row=document.querySelector('.toolbar-row');if(!row||$('#archiveImportTrigger'))return;
    const btn=document.createElement('button');btn.id='archiveImportTrigger';btn.className='control archive-import-trigger';btn.innerHTML='<span>＋</span><span>IMPORT</span>';btn.onclick=()=>{buildModal();$('#archiveImportModal').hidden=false;setTimeout(()=>$('#archiveImportUrl')?.focus(),0)};
    const random=$('#randomBtn');if(random)row.insertBefore(btn,random);else row.appendChild(btn);
  }

  function setState(text,type=''){
    const el=$('#archiveImportState');if(!el)return;el.textContent=text;el.className='archive-import-state'+(type?' '+type:'');
  }
  function uuidFrom(v){return(String(v||'').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)||[])[0]?.toLowerCase()||''}

  async function waitFor(uuid){
    for(let i=0;i<24;i++){
      await new Promise(r=>setTimeout(r,5000));
      const r=await fetch(`/api/import/status?uuid=${encodeURIComponent(uuid)}`,{cache:'no-store'}),d=await r.json();
      if(r.ok&&d.ready)return d;
      if([401,403,410,500].includes(r.status))throw new Error(d.state||d.error||`HTTP ${r.status}`);
      setState(`RECOVERING CHARACTER DATA… ${Math.min((i+1)*5,120)}s`);
    }
    throw new Error('Retrieval is taking longer than expected. Try again in a minute.');
  }

  function preview(bot){
    const p=$('#archiveImportPreview');p.hidden=false;
    $('#archiveImportImage').src=bot.image||'';$('#archiveImportName').textContent=bot.nameEn||'Character';$('#archiveImportBy').textContent=`BY @${bot.author||'Unknown'}`;$('#archiveImportDesc').textContent=bot.short||bot.full||'';
    const uuid=bot.janitorUuid||uuidFrom(bot.url);const actions=$('#archiveImportActions');actions.innerHTML=`<a class="primary" href="/api/characters/${esc(uuid)}/card.png">PNG CARD ↓</a><a href="/api/characters/${esc(uuid)}/card">JSON CARD ↓</a>${bot.lorebook?`<a href="${esc(bot.lorebook)}">LOREBOOK ↓</a>`:''}<a href="${esc(bot.url)}" target="_blank" rel="noopener">JANITOR ↗</a><button id="archiveViewCatalog">VIEW IN CATALOG</button>`;
    $('#archiveViewCatalog').onclick=()=>{$('#archiveImportModal').hidden=true;const input=$('#searchInput');if(input){input.value=bot.nameEn||'';input.dispatchEvent(new Event('input',{bubbles:true}));window.scrollTo({top:document.querySelector('#grid')?.offsetTop||0,behavior:'smooth'})}};
  }

  async function runImport(){
    const input=$('#archiveImportUrl'),go=$('#archiveImportGo'),url=String(input?.value||'').trim();
    if(!uuidFrom(url)){setState('PASTE A VALID JANITORAI CHARACTER LINK.','error');return}
    go.disabled=true;$('#archiveImportPreview').hidden=true;setState('CHECKING ARCHIVE → DATACAT…');
    try{
      let r=await fetch('/api/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url})}),d=await r.json();
      if(r.status===202&&d.state==='RETRIEVAL_QUEUED'){setState('CHARACTER NOT CACHED YET — RECOVERING…');d=await waitFor(d.janitorUuid||uuidFrom(url));}
      else if(!r.ok)throw new Error(d.state||d.error||d.message||`HTTP ${r.status}`);
      await loadLive();
      const uuid=d.janitorUuid||uuidFrom(url),bot=liveBots.find(x=>x.janitorUuid===uuid)||window.BOTS.find(x=>x.janitorUuid===uuid);
      if(!bot)throw new Error('Imported, but catalog record could not be loaded.');
      setState('IMPORTED / CATALOG UPDATED.','ok');preview(bot);
    }catch(e){setState(String(e.message||e),'error')}
    finally{go.disabled=false}
  }

  function loadLorebookUi(){
    if(document.querySelector('script[data-archive-lorebooks]'))return;
    const s=document.createElement('script');s.src='lorebooks.js';s.dataset.archiveLorebooks='1';document.body.appendChild(s);
  }

  const start=()=>{baseBots=Array.isArray(window.BOTS)?[...window.BOTS]:baseBots;bindTrigger();buildModal();loadLorebookUi();loadLive()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
