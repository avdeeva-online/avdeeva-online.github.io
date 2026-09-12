(()=>{
  const mobile=()=>window.matchMedia?.('(max-width:760px)').matches;
  const KNOWN_SETTINGS=new Set([
    'omegaverse','post-apocalypse','zombie-apocalypse','rusreal','rusreal-2000s','china','ancient-china',
    'egypt','ancient-egypt','medieval','regency','victorian','historical','fantasy','sci-fi','dystopia',
    'cyberpunk','supernatural','folklore','college','slice-of-life','mafia','crime'
  ]);
  const SETTING_LABELS=new Map([
    ['omegaverse','Omegaverse'],['post-apocalypse','Post-apocalypse'],['zombie-apocalypse','Zombie apocalypse'],
    ['rusreal','Rusreal'],['rusreal-2000s','2000s Rusreal'],['china','China'],['ancient-china','Ancient China'],
    ['egypt','Egypt'],['ancient-egypt','Ancient Egypt'],['medieval','Medieval'],['regency','Regency'],
    ['victorian','Victorian'],['historical','Historical'],['fantasy','Fantasy'],['sci-fi','Sci-Fi'],
    ['dystopia','Dystopia'],['cyberpunk','Cyberpunk'],['supernatural','Supernatural'],['folklore','Folklore'],
    ['college','School & University'],['slice-of-life','Everyday'],['mafia','Mafia'],['crime','Crime']
  ]);
  const normalizeSetting=id=>id==='high-school'?'college':String(id||'').trim();
  const unique=(values,key=value=>String(value||'').toLocaleLowerCase())=>{const out=[],seen=new Set();for(const value of values||[]){const k=key(value);if(!value||seen.has(k))continue;seen.add(k);out.push(value)}return out};
  let botIndexSource=null,botIndex=new Map();
  function getBotIndex(){
    const source=Array.isArray(window.BOTS)?window.BOTS:[];
    if(source!==botIndexSource){botIndexSource=source;botIndex=new Map(source.map(bot=>[String(bot?.id),bot]))}
    return botIndex;
  }
  const findBot=id=>getBotIndex().get(String(id));

  function settingIds(bot){
    return unique((bot?.settingIds||[])
      .flatMap(value=>String(value||'').split(/\s*\/\s*/))
      .map(normalizeSetting)
      .filter(value=>KNOWN_SETTINGS.has(value)));
  }
  function universes(bot){
    const source=Array.isArray(bot?.universes)&&bot.universes.length?bot.universes:[bot?.universe];
    return unique(source.flatMap(value=>String(value||'').split(/\s*\/\s*/)).map(value=>value.trim()).filter(Boolean));
  }
  function tags(bot){return unique((bot?.tags||[]).map(value=>String(value||'').trim()).filter(Boolean),value=>value.replace(/^[^\p{L}\p{N}#]+/u,'').trim().toLocaleLowerCase())}
  function hashtags(bot){return unique((bot?.hashtags||[]).map(value=>String(value||'').replace(/^#+\s*/,'').trim()).filter(Boolean))}
  function makeMore(className,count,title){if(count<=0)return null;const more=document.createElement('span');more.className=className;more.textContent=`+${count}`;if(title)more.title=title;return more}

  function rebuildUniverseRow(card,bot,title){
    card.querySelector('.card-mobile-universe-row')?.remove();
    const values=universes(bot),shown=values.slice(0,3),hidden=values.length-shown.length;
    const row=document.createElement('div');row.className='card-mobile-universe-row card-universe-text-row';
    const label=document.createElement('span');label.className='card-universe-label';label.textContent='UNIVERSE:';row.appendChild(label);
    if(!shown.length){const none=document.createElement('span');none.className='card-universe-none';none.textContent='NONE';row.appendChild(none)}
    shown.forEach((value,index)=>{
      if(index){const sep=document.createElement('span');sep.className='card-universe-separator';sep.textContent='·';row.appendChild(sep)}
      const button=document.createElement('button');button.type='button';button.className='card-universe-text';button.dataset.quickUniverse=value;button.textContent=value;button.title=`Show universe: ${value}`;row.appendChild(button)
    });
    const more=makeMore('card-universe-more',hidden,values.slice(3).join(', '));if(more)row.appendChild(more);
    title.insertAdjacentElement('afterend',row);return row;
  }

  function rebuildSettings(meta,bot){
    meta.innerHTML='';
    const values=settingIds(bot),shown=values.slice(0,2),hidden=values.length-shown.length;
    shown.forEach(id=>{const button=document.createElement('button');button.type='button';button.className='meta-token card-setting-token';button.dataset.quickSetting=id;const mark=document.createElement('span');mark.className='setting-mark';mark.textContent='⌖';const label=document.createElement('span');label.textContent=SETTING_LABELS.get(id)||id;button.append(mark,label);meta.appendChild(button)});
    const more=makeMore('card-setting-more',hidden,values.slice(2).map(id=>SETTING_LABELS.get(id)||id).join(', '));if(more)meta.appendChild(more);
    meta.hidden=!values.length;
  }

  function rebuildTags(container,bot){
    if(!container)return;
    container.innerHTML='';
    const values=tags(bot),shown=values.slice(0,3),hidden=values.length-shown.length;
    shown.forEach(value=>{const el=mobile()?document.createElement('span'):document.createElement('button');if(el.tagName==='BUTTON'){el.type='button';el.dataset.tag=value}el.textContent=value;container.appendChild(el)});
    const more=makeMore('tag-more',hidden,values.slice(3).join(', '));if(more)container.appendChild(more);
    container.hidden=!values.length;
  }

  function rebuildHashtags(container,bot){
    const values=hashtags(bot);
    if(!values.length){container?.remove();return null}
    if(!container){container=document.createElement('div');container.className='card-hashtags'}
    container.innerHTML='';
    const shown=values.slice(0,3),hidden=values.length-shown.length;
    shown.forEach(value=>{const el=mobile()?document.createElement('span'):document.createElement('button');if(el.tagName==='BUTTON'){el.type='button';el.dataset.hashtag=value}el.textContent=`#${value}`;container.appendChild(el)});
    const more=makeMore('card-hashtag-more',hidden,values.slice(3).map(value=>`#${value}`).join(', '));if(more)container.appendChild(more);
    return container;
  }

  function decorateCard(card){
    if(!card)return;
    const bot=findBot(card.dataset.id),title=card.querySelector('.card-title'),author=card.querySelector('.card-author'),meta=card.querySelector('.card-meta'),short=card.querySelector('.card-short'),tagBox=card.querySelector('.card-tags');
    if(!bot||!title||!meta||!tagBox)return;
    const universeRow=rebuildUniverseRow(card,bot,title);
    rebuildSettings(meta,bot);
    rebuildTags(tagBox,bot);
    const hashtagBox=rebuildHashtags(card.querySelector('.card-hashtags'),bot);
    const body=card.querySelector('.card-body');
    if(body){
      body.appendChild(title);
      body.appendChild(universeRow);
      if(author)body.appendChild(author);
      body.appendChild(meta);
      if(short)body.appendChild(short);
      body.appendChild(tagBox);
      if(hashtagBox)body.appendChild(hashtagBox);
    }
  }

  function decorateCards(root=document){
    getBotIndex();
    if(root?.matches?.('.card'))decorateCard(root);
    root?.querySelectorAll?.('.card').forEach(decorateCard);
  }

  function capModalGroup(container,selector,moreClass){
    if(!container)return;
    container.querySelector(`.${moreClass}`)?.remove();
    const items=[...container.querySelectorAll(selector)];
    items.forEach((item,index)=>item.classList.toggle('facet-extra',index>=3));
    const hidden=Math.max(0,items.length-3);
    if(hidden>0){const more=makeMore(moreClass,hidden,items.slice(3).map(item=>item.textContent.trim()).join(', '));container.appendChild(more)}
  }

  function showAllModalSettings(){
    const setting=document.querySelector('#modalSetting');
    if(!setting)return;
    setting.querySelector('.modal-setting-more')?.remove();
    setting.querySelectorAll('button[data-quick-setting]').forEach(button=>button.classList.remove('facet-extra','modal-setting-extra'));
  }

  function decorateModalFacets(){
    showAllModalSettings();
    capModalGroup(document.querySelector('#modalUniverse'),'button[data-quick-universe]','modal-universe-more');
    capModalGroup(document.querySelector('#modalTags .modal-primary-tags'),'button[data-tag]','modal-tag-more');
    capModalGroup(document.querySelector('#modalTags .modal-hashtags'),'button[data-hashtag]','modal-hashtag-more');
  }

  function ensureDrawerReset(){
    const drawer=document.querySelector('#catalogDrawer'),foot=drawer?.querySelector('.drawer-foot');if(!drawer||!foot||drawer.querySelector('#drawerResetFilters'))return;
    const button=document.createElement('button');button.id='drawerResetFilters';button.type='button';button.textContent='RESET FILTERS';button.style.cssText='margin-left:auto;border:1px solid rgba(133,103,81,.48);border-radius:4px;background:rgba(58,38,29,.30);color:#c9ad94;padding:5px 7px;font:700 6.5px/1 var(--mono);letter-spacing:.07em;cursor:pointer';
    button.addEventListener('click',()=>{const publicReset=document.querySelector('#resetBtn');if(publicReset&&!publicReset.hidden){publicReset.click();return}if(typeof window.resetAll==='function')window.resetAll()});foot.appendChild(button);
  }

  function ensurePresentationStyles(){
    if(document.getElementById('archiveFacetPresentation'))return;
    const style=document.createElement('style');style.id='archiveFacetPresentation';style.textContent=`
      .card-body{display:flex!important;flex-direction:column!important}
      .card-title{order:1!important;min-height:2.4em!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important}
      .card-universe-text-row{order:2!important;display:flex!important;align-items:center!important;flex-wrap:nowrap!important;gap:4px!important;width:100%!important;min-width:0!important;margin:3px 0 0!important;overflow:hidden!important;color:#737c72!important;font:7px/1.25 var(--mono)!important}
      .card-universe-label{flex:0 0 auto!important;color:#515a51!important;letter-spacing:.06em!important}.card-universe-none{color:#565f56!important}
      .card-universe-text{min-width:0!important;max-width:100%!important;padding:0!important;border:0!important;background:none!important;color:#737c72!important;font:inherit!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;cursor:pointer!important;text-align:left!important}
      .card-universe-text:hover{color:#aeb8a8!important;text-decoration:underline!important;text-underline-offset:2px!important}
      .card-universe-separator{flex:0 0 auto!important;color:#485047!important}.card-universe-more{flex:0 0 auto!important;color:#697268!important;font:inherit!important}
      .card-author{order:3!important}.card-meta{order:4!important}.card-short{order:5!important;display:-webkit-box!important;-webkit-line-clamp:3!important;-webkit-box-orient:vertical!important;overflow:hidden!important;min-height:4.35em!important}.card-tags{order:6!important}.card-hashtags{order:7!important}
      .card-meta{display:flex!important;align-items:center!important;flex-wrap:wrap!important;gap:5px!important;overflow:visible!important}
      .card-setting-more,.card-hashtag-more{display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 auto!important;color:#697067!important;font-size:7px!important}
      .card-tags button,.card-tags span{font-family:Arial,"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif!important}
      .card-hashtags button,.card-hashtags span{font-family:Arial,"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif!important}
      .facet-extra{display:none!important}.modal-setting-more,.modal-universe-more,.modal-tag-more,.modal-hashtag-more{display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 auto!important;color:#6f796e!important;font:7px/1 var(--mono)!important}
      @media(min-width:761px){
        .modal-content{position:relative!important}
        .modal-author-row{position:absolute!important;top:50px!important;right:20px!important;z-index:3!important;margin:0!important;padding:0!important;font-size:0!important;color:#788276!important;white-space:nowrap!important}
        .modal-author-row:before{content:'BY ';font:700 7px/1 var(--mono)!important;letter-spacing:.09em!important;color:#667164!important}
        .modal-author-row #modalAuthor{margin:0 0 0 4px!important;padding:0!important;border:0!important;background:none!important;color:#b9c2b2!important;font:700 8.5px/1 var(--mono)!important;text-decoration:underline!important;text-underline-offset:2px!important;cursor:pointer!important}
        .modal-author-row #modalPov{display:none!important}.modal-setting-row,.modal-universe-row{padding-right:118px!important}
        #modalTags{margin-bottom:8px!important}
        #modalTags .modal-hashtags{position:static!important;display:flex!important;align-items:center!important;flex-wrap:wrap!important;gap:9px!important;width:100%!important;min-height:15px!important;height:auto!important;margin:8px 0 0!important;padding:7px 0 0!important;border-top:1px solid rgba(83,95,80,.38)!important;border-bottom:0!important;background:transparent!important}
        #modalTags .modal-hashtags button{font-size:8px!important}.modal-hashtag-more{margin-left:2px!important}
      }
      @media(max-width:760px){
        .drawer-query-row{gap:3px!important}.drawer-search{height:29px!important;min-height:29px!important;margin:3px 0!important;padding-inline:6px!important}.drawer-tool-btn{min-width:45px!important;height:29px!important;min-height:29px!important;padding:2px 4px!important}
        .card-universe-text-row{height:13px!important;min-height:13px!important;margin:1px 0 2px!important;font:6.6px/13px var(--mono)!important}
        .card-meta{flex-wrap:nowrap!important;gap:4px!important;overflow:hidden!important}.card-setting-token{flex:1 1 0!important;min-width:0!important;max-width:none!important}.card-setting-token span:last-child{min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}.card-setting-more{height:22px!important;min-width:24px!important;padding:0 5px!important;border:0!important;background:none!important}
        .modal-setting-more{min-width:24px!important;min-height:22px!important;padding:4px 7px!important;border:1px solid #4a5542!important;border-radius:999px!important;background:rgba(91,107,77,.08)!important;color:#899582!important}
        .modal-universe-row{display:flex!important;align-items:center!important;min-height:13px!important;margin:0 0 5px!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important}.modal-universe-row[hidden],#modalUniverse[hidden]{display:none!important}#modalUniverse{display:flex!important;align-items:center!important;flex-wrap:wrap!important;gap:5px 8px!important;min-width:0!important}#modalUniverse .universe-link{display:inline-flex!important;align-items:center!important;gap:4px!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;color:#6b756b!important;opacity:.76!important;font:6.8px/1.25 var(--mono)!important}#modalUniverse .universe-link .ui-icon{width:8px!important;height:8px!important;opacity:.66!important}
      }
    `;document.head.appendChild(style);
  }

  ensurePresentationStyles();ensureDrawerReset();
  const originalRender=window.render;
  if(typeof originalRender==='function'&&!originalRender.__facetPresentationWrapped){const wrapped=function(...args){const result=originalRender.apply(this,args);decorateCards(document.querySelector('#grid')||document);ensureDrawerReset();return result};wrapped.__facetPresentationWrapped=true;window.render=wrapped}
  decorateCards(document.querySelector('#grid')||document);ensureDrawerReset();window.addEventListener('archive:modal-public-ready',decorateModalFacets);
})();