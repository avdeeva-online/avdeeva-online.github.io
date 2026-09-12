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

  function mobile(){return window.matchMedia?.('(max-width:760px)').matches}
  function findBot(id){return (Array.isArray(window.BOTS)?window.BOTS:[]).find(bot=>String(bot?.id)===String(id))}
  function settingCount(bot){
    return new Set((bot?.settingIds||[])
      .flatMap(value=>String(value||'').split(/\s*\/\s*/))
      .map(value=>value.trim())
      .filter(Boolean)).size;
  }

  function decorateCard(card){
    if(!card||!mobile())return;
    const body=card.querySelector('.card-body');
    const title=card.querySelector('.card-title');
    const meta=card.querySelector('.card-meta');
    if(!body||!title||!meta)return;

    let slot=body.querySelector(':scope > .card-universe-slot');
    if(!slot){
      slot=document.createElement('div');
      slot.className='card-universe-slot';
      title.insertAdjacentElement('afterend',slot);
    }

    const universe=meta.querySelector('.card-universe-token');
    if(universe){
      universe.classList.add('card-universe-inline');
      slot.appendChild(universe);
    }
    meta.querySelectorAll('.card-universe-token').forEach(node=>node.remove());

    meta.querySelector('.card-setting-more')?.remove();
    const bot=findBot(card.dataset.id);
    const total=settingCount(bot);
    const visible=meta.querySelectorAll('.card-setting-token').length;
    const hidden=Math.max(0,total-visible);
    if(hidden>0){
      const more=document.createElement('span');
      more.className='card-setting-more';
      more.textContent=`+${hidden}`;
      more.title=`${hidden} more setting${hidden===1?'':'s'}`;
      meta.appendChild(more);
    }
  }

  function decorateCards(root=document){
    if(!mobile())return;
    if(root?.matches?.('.card'))decorateCard(root);
    root?.querySelectorAll?.('.card').forEach(decorateCard);
  }

  function decorateModal(){
    if(!mobile())return;
    const setting=document.querySelector('#modalSetting');
    const universe=document.querySelector('#modalUniverse');
    const universeRow=document.querySelector('.modal-universe-row');
    if(setting){
      const buttons=[...setting.querySelectorAll('button')];
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
      }else if(more){
        more.remove();
      }
    }
    if(universe)universe.classList.add('modal-universe-quiet');
    if(universeRow)universeRow.classList.add('modal-universe-quiet-row');
  }

  function ensurePresentationStyles(){
    if(document.getElementById('archiveFacetPresentation'))return;
    const style=document.createElement('style');
    style.id='archiveFacetPresentation';
    style.textContent=`
      @media(max-width:760px){
        .card-universe-slot{
          box-sizing:border-box;
          display:flex;
          align-items:center;
          width:100%;
          height:13px;
          min-height:13px;
          margin:1px 0 2px;
          overflow:hidden;
        }
        .card-universe-inline{
          display:inline-flex!important;
          align-items:center!important;
          gap:3px!important;
          max-width:100%!important;
          height:13px!important;
          min-height:13px!important;
          margin:0!important;
          padding:0!important;
          border:0!important;
          border-radius:0!important;
          background:transparent!important;
          box-shadow:none!important;
          color:#687168!important;
          opacity:.82!important;
          font:6.6px/13px var(--mono)!important;
          letter-spacing:.025em!important;
          white-space:nowrap!important;
          overflow:hidden!important;
          text-overflow:ellipsis!important;
        }
        .card-universe-inline .ui-icon{width:8px!important;height:8px!important;min-width:8px!important;opacity:.72!important}
        .card-universe-inline span{display:block!important;min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
        .card-meta{align-items:center!important}
        .card-setting-more{
          display:inline-flex!important;
          align-items:center!important;
          justify-content:center!important;
          height:22px!important;
          min-width:22px!important;
          padding:0 5px!important;
          border:1px solid rgba(82,94,78,.46)!important;
          border-radius:5px!important;
          color:#7f897d!important;
          background:rgba(18,22,18,.38)!important;
          font:6.5px/1 var(--mono)!important;
        }

        .modal-setting-row{
          display:flex!important;
          align-items:center!important;
          gap:7px!important;
          min-height:0!important;
          margin:3px 0 2px!important;
          padding:0!important;
          border:0!important;
          background:transparent!important;
          box-shadow:none!important;
        }
        .modal-setting-heading{flex:0 0 auto!important;font-size:6.8px!important;color:#8d9889!important}
        #modalSetting{display:flex!important;align-items:center!important;gap:5px!important;min-width:0!important;flex-wrap:nowrap!important;overflow:hidden!important}
        #modalSetting button{
          min-height:0!important;
          height:auto!important;
          padding:0!important;
          border:0!important;
          background:transparent!important;
          box-shadow:none!important;
          color:#c1cbbd!important;
          font:700 7.6px/1.25 var(--mono)!important;
          white-space:nowrap!important;
        }
        #modalSetting button+button:before{content:'·';margin-right:5px;color:#566054}
        #modalSetting .modal-setting-extra{display:none!important}
        .modal-setting-more{color:#7e887b!important;font:700 7px/1 var(--mono)!important;white-space:nowrap!important}

        .modal-universe-quiet-row{
          display:flex!important;
          align-items:center!important;
          min-height:13px!important;
          margin:0 0 5px!important;
          padding:0!important;
          border:0!important;
          background:transparent!important;
          box-shadow:none!important;
        }
        .modal-universe-quiet-row[hidden]{display:none!important}
        #modalUniverse.modal-universe-quiet{
          display:inline-flex!important;
          align-items:center!important;
          gap:4px!important;
          min-height:0!important;
          padding:0!important;
          border:0!important;
          background:transparent!important;
          box-shadow:none!important;
          color:#6f796e!important;
          opacity:.78!important;
          font:6.8px/1.25 var(--mono)!important;
        }
        #modalUniverse.modal-universe-quiet .ui-icon{width:8px!important;height:8px!important;opacity:.7!important}
        #modalUniverse.modal-universe-quiet:hover{color:#9aa495!important;opacity:1!important}
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
  window.addEventListener('archive:modal-public-ready',decorateModal);

  const modal=document.querySelector('#modal');
  if(modal)new MutationObserver(()=>decorateModal()).observe(modal,{childList:true,subtree:true});
})();