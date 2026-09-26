/* Public "+ IMPORT": paste a JanitorAI link → the Worker builds the same record as any catalog bot
   (card PNG/JSON + lorebook) and publishes it → the catalog reloads and the new record opens. */
(()=>{
  const $=s=>document.querySelector(s);
  const UUID=/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const POLL_MS=5000,POLL_TRIES=24;
  const MESSAGES={
    INVALID_JANITOR_URL:'PASTE A VALID JANITORAI CHARACTER LINK.',
    NOT_AVAILABLE:'THIS CHARACTER IS NOT AVAILABLE IN THE ARCHIVE.',
    UNAVAILABLE:'THIS CHARACTER IS PRIVATE OR WAS DELETED ON JANITORAI.',
    RETRIEVAL_TIMEOUT:'RECOVERY IS TAKING LONGER THAN USUAL. TRY AGAIN IN A MINUTE.'
  };
  let busy=false;

  const uuidFrom=v=>(String(v||'').match(UUID)||[])[0]?.toLowerCase()||'';
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function setState(text,type=''){const el=$('#archiveImportState');if(!el)return;el.textContent=text;el.className='archive-import-state'+(type?' '+type:'')}
  function setBusy(on){busy=on;const go=$('#archiveImportGo'),input=$('#archiveImportUrl');if(go){go.disabled=on;go.textContent=on?'IMPORTING…':'IMPORT'}if(input)input.disabled=on}

  function styles(){
    if($('#archiveImportStyles'))return;
    const s=document.createElement('style');s.id='archiveImportStyles';s.textContent=`
      .archive-import-modal[hidden]{display:none}.archive-import-modal{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:24px}.archive-import-backdrop{position:absolute;inset:0;background:rgba(4,7,4,.82);backdrop-filter:blur(5px)}
      .archive-import-card{position:relative;width:min(650px,calc(100vw - 32px));background:linear-gradient(145deg,#121712,#0d110d);border:1px solid #46513f;border-radius:10px;box-shadow:0 28px 90px rgba(0,0,0,.72);padding:22px 22px 18px;color:#d8deca;font-family:Consolas,monospace}.archive-import-card:before{content:"";position:absolute;inset:5px;border:1px solid rgba(122,141,107,.08);border-radius:7px;pointer-events:none}
      .archive-import-card h2{margin:0 36px 4px 0;font-size:18px;letter-spacing:.05em}.archive-import-card>p{margin:0 0 16px;color:#7e8a76;font-size:10px;letter-spacing:.04em;line-height:1.5}.archive-import-close{position:absolute;right:13px;top:10px;width:30px;height:30px;border:1px solid transparent;border-radius:50%;background:none;color:#87937f;font-size:22px;cursor:pointer}.archive-import-close:hover{border-color:#46513f;color:#dce5d2}
      .archive-import-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}.archive-import-row input{min-width:0;background:#090c09;border:1px solid #404b39;border-radius:6px;color:#e2e7da;padding:12px 13px;font:12px Consolas,monospace;outline:none}.archive-import-row input:focus{border-color:#82926f;box-shadow:0 0 0 2px rgba(130,146,111,.08)}.archive-import-go{border:1px solid #647455;border-radius:6px;background:#27331f;color:#e3ead7;padding:0 17px;font:11px Consolas,monospace;cursor:pointer}.archive-import-go:disabled{opacity:.45;cursor:wait}.archive-import-state{margin:11px 1px 0;color:#9eae91;font-size:10px;min-height:14px}.archive-import-state.error{color:#d49784}.archive-import-state.ok{color:#b9cf8f}@media(max-width:620px){.archive-import-row{grid-template-columns:1fr}.archive-import-go{padding:11px}}
    `;document.head.appendChild(s);
  }
  function buildModal(){
    styles();if($('#archiveImportModal'))return;
    const box=document.createElement('div');box.id='archiveImportModal';box.className='archive-import-modal';box.hidden=true;
    box.innerHTML=`<div class="archive-import-backdrop" data-import-close></div><section class="archive-import-card" role="dialog" aria-modal="true" aria-labelledby="archiveImportTitle"><button class="archive-import-close" data-import-close aria-label="Close">×</button><h2 id="archiveImportTitle">IMPORT CHARACTER / NODE_00</h2><p>PASTE A PUBLIC JANITORAI CHARACTER LINK. THE RECORD IS ADDED TO THE CATALOG WITH ITS CARD AND LOREBOOK.</p><div class="archive-import-row"><input id="archiveImportUrl" placeholder="https://janitorai.com/characters/..." autocomplete="off" spellcheck="false" aria-label="JanitorAI character link"><button id="archiveImportGo" class="archive-import-go" type="button">IMPORT</button></div><div id="archiveImportState" class="archive-import-state" aria-live="polite">READY.</div></section>`;
    document.body.appendChild(box);
    box.querySelectorAll('[data-import-close]').forEach(x=>x.addEventListener('click',closeImport));
    $('#archiveImportGo').addEventListener('click',runImport);
    $('#archiveImportUrl').addEventListener('keydown',e=>{if(e.key==='Enter')runImport()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!box.hidden)closeImport()});
  }
  function openImport(){
    buildModal();const box=$('#archiveImportModal');box.hidden=false;
    if(!busy){$('#archiveImportUrl').value='';setState('READY.');setTimeout(()=>$('#archiveImportUrl')?.focus(),0)}
  }
  // Closing never cancels a running import: it finishes in the background and the record still opens.
  function closeImport(){const box=$('#archiveImportModal');if(box)box.hidden=true}

  async function request(url,init){
    const r=await fetch(url,{cache:'no-store',...init});let d={};try{d=await r.json()}catch{}
    return{r,d};
  }
  const failure=d=>new Error(MESSAGES[d?.error]||MESSAGES[d?.state]||d?.message||d?.error||d?.state||'IMPORT FAILED. TRY AGAIN.');
  async function waitFor(uuid){
    for(let i=1;i<=POLL_TRIES;i++){
      await sleep(POLL_MS);
      const{r,d}=await request(`/api/import/status?uuid=${encodeURIComponent(uuid)}`);
      if(r.ok&&d.ready)return d;
      if(r.status!==202)throw failure(d);
      setState(`RECOVERING CHARACTER DATA… ${i*POLL_MS/1000}s`);
    }
    throw failure({error:'RETRIEVAL_TIMEOUT'});
  }
  async function openRecord(uuid){
    const list=typeof window.archiveReloadCatalog==='function'?await window.archiveReloadCatalog():window.BOTS||[];
    const bot=(list||[]).find(x=>x.janitorUuid===uuid)||(window.BOTS||[]).find(x=>x.janitorUuid===uuid);
    if(!bot)throw new Error('IMPORTED, BUT THE RECORD COULD NOT BE LOADED. REFRESH THE PAGE.');
    closeImport();
    if(typeof window.openModal==='function')window.openModal(bot);
  }
  async function runImport(){
    if(busy)return;
    const url=String($('#archiveImportUrl')?.value||'').trim(),uuid=uuidFrom(url);
    if(!uuid){setState(MESSAGES.INVALID_JANITOR_URL,'error');return}
    setBusy(true);setState('CHECKING ARCHIVE…');
    try{
      let{r,d}=await request('/api/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url})});
      if(r.status===202){setState('NOT CACHED YET — RECOVERING CHARACTER DATA…');d=await waitFor(d.janitorUuid||uuid)}
      else if(!r.ok||!d.ok)throw failure(d);
      setState(d.state==='ALREADY_IN_ARCHIVE'?'ALREADY IN THE ARCHIVE. OPENING RECORD…':'IMPORTED. OPENING RECORD…','ok');
      await openRecord(d.janitorUuid||uuid);
    }catch(e){
      setState(String(e?.message||e),'error');
      const box=$('#archiveImportModal');if(box)box.hidden=false;
    }finally{setBusy(false)}
  }

  const start=()=>{const btn=$('#importOpen');if(btn)btn.addEventListener('click',openImport)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
