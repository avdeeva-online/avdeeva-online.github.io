(()=>{
  const clean=s=>String(s||'').replace(/\r/g,'').replace(/\*+/g,'').trim();
  const missing=s=>!clean(s)||clean(s).toUpperCase()==='UNCLASSIFIED';
  function explicitUniverse(bot){
    if(!bot||!missing(bot.universe))return null;
    const source=String(bot.publicDescription||bot.full||bot.short||'').replace(/\r/g,'');
    for(const label of ['UNIVERSE','WORLD','FRANCHISE','SERIES']){
      const rx=new RegExp(`(?:^|\\n)\\s*\\*{0,3}${label}\\*{0,3}(?:\\s*[:：-]\\s*|\\s+)([^\\n]+)`,'i');
      const m=source.match(rx);
      const value=clean(m?.[1]||'').replace(/^[:：-]\s*/,'').trim();
      if(value)return{value,label};
    }
    return null;
  }
  function patch(list){
    let changed=false;
    if(!Array.isArray(list))return changed;
    for(const bot of list){
      const found=explicitUniverse(bot);
      if(!found)continue;
      bot.universe=found.value;
      if(!bot.universeSourceField)bot.universeSourceField=`source-description:${found.label}`;
      changed=true;
    }
    return changed;
  }

  const mobile=()=>window.matchMedia?.('(max-width:760px)').matches;
  const findBot=id=>(Array.isArray(window.BOTS)?window.BOTS:[]).find(bot=>String(bot?.id)===String(id));
  const settingCount=bot=>new Set((bot?.settingIds||[])
    .flatMap(value=>String(value||'').split(/\s*\/\s*/))
    .map(value=>value.trim())
    .filter(Boolean)).size;

  function decorateCard(card){
    if(!card||!mobile())return;
    const meta=card.querySelector('.card-meta');
    if(!meta)return;

    let more=meta.querySelector('.card-setting-more');
    const bot=findBot(card.dataset.id);
    const visible=meta.querySelectorAll('.card-setting-token').length;
    const hidden=Math.max(0,settingCount(bot)-visible);
    if(hidden>0){
      if(!more){
        more=document.createElement('span');
        more.className='card-setting-more';
        const firstUniverse=meta.querySelector('.card-universe-token');
        if(firstUniverse)meta.insertBefore(more,firstUniverse);else meta.appendChild(more);
      }
      more.textContent=`+${hidden}`;
      more.title=`${hidden} more setting${hidden===1?'':'s'}`;
    }else more?.remove();
  }

  function decorateCards(root=document){
    if(!mobile())return;
    if(root?.matches?.('.card'))decorateCard(root);
    root?.querySelectorAll?.('.card').forEach(decorateCard);
  }

  function decorateModalSettings(){
    if(!mobile())return;
    const setting=document.querySelector('#modalSetting');
    if(!setting)return;
    const buttons=[...setting.querySelectorAll('button[data-quick-setting]')];
    buttons.forEach((button,index)=>button.classList.toggle('modal-setting-extra',index>=2));
    const hidden=Math.max(0,buttons.length-2);
    let more=setting.querySelector('.modal-setting-more');
    if(hidden>0){
      if(!more){
        more=document.createElement('span');
        more.className='modal-setting-more';
        setting.appendChild(more);
      }
      more.textContent=`+${hidden}`;
      more.title=buttons.slice(2).map(button=>button.textContent.trim()).join(', ');
    }else more?.remove();
  }

  function ensurePresentationStyles(){
    if(document.getElementById('archiveFacetPresentation'))return;
    const style=document.createElement('style');
    style.id='archiveFacetPresentation';
    style.textContent=`
      @media(max-width:760px){
        .card-body{position:relative!important}

        /* Universe stays in the existing metadata DOM, but visually uses the spare line under the name. */
        .card-universe-token{
          position:absolute!important;
          z-index:2!important;
          left:2px!important;
          top:32px!important;
          display:inline-flex!important;
          align-items:center!important;
          gap:3px!important;
          width:auto!important;
          max-width:calc(100% - 4px)!important;
          height:10px!important;
          min-height:10px!important;
          margin:0!important;
          padding:0!important;
          border:0!important;
          border-radius:0!important;
          background:transparent!important;
          box-shadow:none!important;
          color:#697269!important;
          opacity:.78!important;
          font:6.4px/10px var(--mono)!important;
          letter-spacing:.025em!important;
          overflow:hidden!important;
          white-space:nowrap!important;
          text-overflow:ellipsis!important;
        }
        .card-universe-token .ui-icon{width:7px!important;height:7px!important;min-width:7px!important;opacity:.68!important}
        .card-universe-token span{min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
        .card-universe-token ~ .card-universe-token{display:none!important}

        /* Settings remain the primary metadata row; only overflow is collapsed to +N. */
        .card-meta{align-items:center!important;flex-wrap:nowrap!important;overflow:hidden!important}
        .card-setting-token{max-width:43%!important;overflow:hidden!important}
        .card-setting-token span:last-child{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
        .card-setting-more{
          display:inline-flex!important;
          align-items:center!important;
          justify-content:center!important;
          flex:0 0 auto!important;
          height:22px!important;
          min-width:22px!important;
          padding:0 5px!important;
          border:1px solid rgba(82,94,78,.46)!important;
          border-radius:5px!important;
          background:rgba(18,22,18,.38)!important;
          color:#7f897d!important;
          font:6.5px/1 var(--mono)!important;
        }

        /* In the detail card Setting is primary; Universe is supporting metadata. */
        .modal-setting-row{
          margin:0 0 4px!important;
          padding:4px 6px!important;
          border:0!important;
          background:transparent!important;
          box-shadow:none!important;
        }
        #modalSetting{display:flex!important;align-items:center!important;gap:5px!important;min-width:0!important;flex-wrap:nowrap!important;overflow:hidden!important}
        #modalSetting .modal-setting-extra{display:none!important}
        .modal-setting-more{
          display:inline-flex!important;
          align-items:center!important;
          justify-content:center!important;
          flex:0 0 auto!important;
          min-width:22px!important;
          height:20px!important;
          padding:0 5px!important;
          border:1px solid rgba(82,94,78,.42)!important;
          border-radius:999px!important;
          background:rgba(91,107,77,.08)!important;
          color:#84907f!important;
          font:6.6px/1 var(--mono)!important;
        }

        .modal-universe-row{
          min-height:12px!important;
          margin:0 0 5px!important;
          padding:0 6px!important;
          border:0!important;
          background:transparent!important;
          box-shadow:none!important;
        }
        #modalUniverse,
        #modalUniverse .universe-link{
          border:0!important;
          border-radius:0!important;
          background:transparent!important;
          box-shadow:none!important;
          padding:0!important;
          color:#6f796e!important;
          opacity:.78!important;
          font:6.8px/1.25 var(--mono)!important;
        }
        #modalUniverse .universe-link{
          display:inline-flex!important;
          align-items:center!important;
          gap:4px!important;
          margin-right:7px!important;
        }
        #modalUniverse .universe-link .ui-icon{width:8px!important;height:8px!important;opacity:.68!important}
      }
    `;
    document.head.appendChild(style);
  }

  ensurePresentationStyles();

  const originalRender=window.render;
  if(typeof originalRender==='function'&&!originalRender.__facetPresentationWrapped){
    const wrapped=function(...args){
      const result=originalRender.apply(this,args);
      decorateCards(document.querySelector('#grid')||document);
      return result;
    };
    wrapped.__facetPresentationWrapped=true;
    window.render=wrapped;
  }

  function refresh(list){
    const a=patch(list),b=patch(window.BOTS);
    if((a||b)&&typeof window.render==='function')window.render();
    else decorateCards(document.querySelector('#grid')||document);
  }

  refresh(window.BOTS);
  window.addEventListener('archive:catalog-updated',e=>refresh(e.detail?.characters));
  window.addEventListener('archive:modal-public-ready',decorateModalSettings);

  const modalSetting=document.querySelector('#modalSetting');
  if(modalSetting)new MutationObserver(decorateModalSettings).observe(modalSetting,{childList:true});
})();
