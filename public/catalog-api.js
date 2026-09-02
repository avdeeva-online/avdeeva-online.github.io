(()=>{
  const $=s=>document.querySelector(s);
  let baseBots=Array.isArray(window.BOTS)?[...window.BOTS]:[];
  let liveBots=[];

  const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
  const povKey=value=>clean(value).replace(/^[^\p{L}\p{N}#]+/u,'').toLocaleLowerCase().replace(/[^a-z]/g,'');
  function normalizePovTags(values){
    const tags=Array.isArray(values)?values.map(clean).filter(Boolean):[];
    const povTags=tags.filter(tag=>['anypov','fempov','femalepov','malepov'].includes(povKey(tag)));
    const key=povTags.length===1?povKey(povTags[0]):'anypov';
    const chosen=key==='fempov'||key==='femalepov'?'👩 FemPov':key==='malepov'?'👨 MalePov':'👤 AnyPOV';
    return [...tags.filter(tag=>!['anypov','fempov','femalepov','malepov'].includes(povKey(tag))),chosen];
  }
  function universesOf(bot){
    const source=Array.isArray(bot.universes)?bot.universes:[bot.universe];
    const seen=new Set(),out=[];
    for(const value of source.flatMap(v=>clean(v).split(/\s*\/\s*/))){const key=value.toLocaleLowerCase();if(value&&!seen.has(key)){seen.add(key);out.push(value)}}
    return out;
  }
  function canonicalDisplay(values){
    const groups=new Map();
    for(const raw of values){const v=clean(raw);if(!v)continue;const k=v.toLocaleLowerCase();if(!groups.has(k))groups.set(k,[]);groups.get(k).push(v)}
    const map=new Map();
    for(const [k,vals] of groups){
      const counts=new Map();vals.forEach(v=>counts.set(v,(counts.get(v)||0)+1));
      const best=[...counts].sort((a,b)=>b[1]-a[1]||Number(b[0]===b[0].toUpperCase())-Number(a[0]===a[0].toUpperCase())||a[0].localeCompare(b[0]))[0]?.[0]||vals[0];
      map.set(k,best);
    }
    return map;
  }
  function normalizeCatalog(list){
    const authors=canonicalDisplay(list.map(x=>x.author));
    return list.map(b=>{const universes=universesOf(b);return {...b,author:authors.get(clean(b.author).toLocaleLowerCase())||clean(b.author)||'Unknown',universe:universes[0]||'',universes,tags:normalizePovTags(b.tags),pov:b.pov||'AnyPOV',settingIds:Array.isArray(b.settingIds)?b.settingIds.flatMap(v=>clean(v).split(/\s*\/\s*/)).filter(Boolean):[],settings:Array.isArray(b.settings)?b.settings:[]}});
  }
  function mergeBots(){
    const seen=new Set(),all=[];
    for(const b of [...liveBots,...baseBots]){const key=b.janitorUuid||b.id||`${String(b.author).toLowerCase()}:${b.nameEn}`;if(seen.has(key))continue;seen.add(key);all.push(b)}
    window.BOTS=normalizeCatalog(all);
    if(typeof window.render==='function')window.render();
  }

  async function loadLive(){
    try{
      const r=await fetch('/api/catalog?limit=1000'),data=await r.json();
      if(!r.ok||!data.ok)throw new Error(data.message||data.error||`HTTP ${r.status}`);
      liveBots=normalizeCatalog(Array.isArray(data.characters)?data.characters:[]);
      mergeBots();
      window.dispatchEvent(new CustomEvent('archive:catalog-updated',{detail:{characters:liveBots}}));
      return liveBots;
    }catch(e){console.warn('ARCHIVE live catalog unavailable',e);return[]}
  }

  function styles(){
    if($('#archiveImportStyles'))return;
    const s=document.createElement('style');s.id='archiveImportStyles';s.textContent=`
      .archive-import-trigger{border-color:#8c7850!important;color:#e7d9b9!important;background:linear-gradient(180deg,#292419,#171812)!important}.archive-import-trigger:hover{border-color:#c0a46d!important}
      .archive-import-modal[hidden]{display:none}.archive-import-modal{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:24px}.archive-import-backdrop{position:absolute;inset:0;background:rgba(4,7,4,.82);backdrop-filter:blur(5px)}
      .archive-import-card{position:relative;width:min(650px,calc(100vw - 32px));background:linear-gradient(145deg,#121712,#0d110d);border:1px solid #46513f;border-radius:10px;box-shadow:0 28px 90px rgba(0,0,0,.72);padding:22px 22px 18px;color:#d8deca;font-family:Consolas,monospace}.archive-import-card:before{content:"";position:absolute;inset:5px;border:1px solid rgba(122,141,107,.08);border-radius:7px;pointer-events:none}
      .archive-import-card h2{margin:0 36px 4px 0;font-size:18px;letter-spacing:.05em}.archive-import-card>p{margin:0 0 16px;color:#7e8a76;font-size:10px;letter-spacing:.04em}.archive-import-close{position:absolute;right:13px;top:10px;width:30px;height:30px;border:1px solid transparent;border-radius:50%;background:none;color:#87937f;font-size:22px;cursor:pointer}.archive-import-close:hover{border-color:#46513f;color:#dce5d2}
      .archive-import-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}.archive-import-row input{min-width:0;background:#090c09;border:1px solid #404b39;border-radius:6px;color:#e2e7da;padding:12px 13px;font:12px Consolas,monospace;outline:none}.archive-import-row input:focus{border-color:#82926f;box-shadow:0 0 0 2px rgba(130,146,111,.08)}.archive-import-go{border:1px solid #647455;border-radius:6px;background:#27331f;color:#e3ead7;padding:0 17px;font:11px Consolas,monospace;cursor:pointer}.archive-import-go:disabled{opacity:.45;cursor:wait}.archive-import-state{margin:11px 1px 0;color:#9eae91;font-size:10px;min-height:14px}.archive-import-state.error{color:#d49784}.archive-import-state.ok{color:#b9cf8f}@media(max-width:620px){.archive-import-row{grid-template-columns:1fr}.archive-import-go{padding:11px}}
    `;document.head.appendChild(s);
  }
  function resetImport(){const input=$('#archiveImportUrl'),state=$('#archiveImportState'),go=$('#archiveImportGo');if(input)input.value='';if(state){state.textContent='READY.';state.className='archive-import-state'}if(go){go.disabled=false;go.textContent='IMPORT'}}
  function closeImport(){const box=$('#archiveImportModal');if(box)box.hidden=true;resetImport()}
  function openImport(){buildModal();resetImport();const box=$('#archiveImportModal');if(box)box.hidden=false;setTimeout(()=>$('#archiveImportUrl')?.focus(),0)}
  function buildModal(){styles();if($('#archiveImportModal'))return;const box=document.createElement('div');box.id='archiveImportModal';box.className='archive-import-modal';box.hidden=true;box.innerHTML=`<div class="archive-import-backdrop" data-import-close></div><section class="archive-import-card"><button class="archive-import-close" data-import-close aria-label="Close">×</button><h2>IMPORT CHARACTER / NODE_00</h2><p>PASTE A PUBLIC JANITORAI CHARACTER LINK</p><div class="archive-import-row"><input id="archiveImportUrl" placeholder="https://janitorai.com/characters/..." autocomplete="off"><button id="archiveImportGo" class="archive-import-go">IMPORT</button></div><div id="archiveImportState" class="archive-import-state">READY.</div></section>`;document.body.appendChild(box);box.querySelectorAll('[data-import-close]').forEach(x=>x.onclick=closeImport);$('#archiveImportGo').onclick=runImport;$('#archiveImportUrl').addEventListener('keydown',e=>{if(e.key==='Enter')runImport()})}
  function bindTrigger(){const existing=$('#importOpen');if(existing){existing.classList.add('archive-import-trigger');existing.onclick=openImport}}
  function setState(text,type=''){const el=$('#archiveImportState');if(!el)return;el.textContent=text;el.className='archive-import-state'+(type?' '+type:'')}
  function uuidFrom(v){return(String(v||'').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)||[])[0]?.toLowerCase()||''}
  async function waitFor(uuid){for(let i=0;i<24;i++){await new Promise(r=>setTimeout(r,5000));const r=await fetch(`/api/import/status?uuid=${encodeURIComponent(uuid)}`,{cache:'no-store'}),d=await r.json();if(r.ok&&d.ready)return d;if([401,403,410,500].includes(r.status))throw new Error(d.state||d.error||`HTTP ${r.status}`);setState(`RECOVERING CHARACTER DATA… ${Math.min((i+1)*5,120)}s`)}throw new Error('Retrieval is taking longer than expected. Try again in a minute.')}
  async function runImport(){const input=$('#archiveImportUrl'),go=$('#archiveImportGo'),url=String(input?.value||'').trim();if(!uuidFrom(url)){setState('PASTE A VALID JANITORAI CHARACTER LINK.','error');return}go.disabled=true;go.textContent='IMPORTING…';setState('CHECKING ARCHIVE → DATACAT…');try{let r=await fetch('/api/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url})}),d=await r.json();if(r.status===202&&d.state==='RETRIEVAL_QUEUED'){setState('CHARACTER NOT CACHED YET — RECOVERING…');d=await waitFor(d.janitorUuid||uuidFrom(url))}else if(!r.ok)throw new Error(d.state||d.error||d.message||`HTTP ${r.status}`);await loadLive();const uuid=d.janitorUuid||uuidFrom(url),bot=liveBots.find(x=>x.janitorUuid===uuid)||window.BOTS.find(x=>x.janitorUuid===uuid);if(!bot)throw new Error('Imported, but catalog record could not be loaded.');setState('IMPORTED. OPENING RECORD…','ok');setTimeout(()=>{closeImport();if(typeof window.openModal==='function')window.openModal(bot);else window.dispatchEvent(new CustomEvent('archive:open-character',{detail:{bot}}))},180)}catch(e){setState(String(e.message||e),'error');go.disabled=false;go.textContent='IMPORT'}}
  function loadAddon(src,key){if(document.querySelector(`script[data-${key}]`))return;const s=document.createElement('script');s.src=src;s.setAttribute(`data-${key}`,'1');document.body.appendChild(s)}
  const start=()=>{baseBots=Array.isArray(window.BOTS)?[...window.BOTS]:baseBots;bindTrigger();buildModal();loadAddon('lorebooks.js','archive-lorebooks');loadAddon('ui-fixes.js','archive-ui-fixes');loadLive()};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
