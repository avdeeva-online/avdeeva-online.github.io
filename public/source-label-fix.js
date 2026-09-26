(()=>{
  // List cards are rendered once by app.js cardHtml (1 universe + 1 setting, fixed zones); this file only adjusts the modal and the drawer.
  function showAllModalGroup(container,selector,moreClass){
    if(!container)return;
    container.querySelector(`.${moreClass}`)?.remove();
    container.querySelectorAll(selector).forEach(item=>item.classList.remove('facet-extra','modal-setting-extra'));
  }

  function decorateModalFacets(){
    showAllModalGroup(document.querySelector('#modalSetting'),'button[data-quick-setting]','modal-setting-more');
    showAllModalGroup(document.querySelector('#modalUniverse'),'button[data-quick-universe]','modal-universe-more');
    showAllModalGroup(document.querySelector('#modalTags .modal-primary-tags'),'button[data-tag]','modal-tag-more');
    showAllModalGroup(document.querySelector('#modalTags .modal-hashtags'),'button[data-hashtag]','modal-hashtag-more');
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
      .card-author{order:3!important}.card-meta{order:4!important}.card-short{order:5!important;display:-webkit-box!important;-webkit-line-clamp:3!important;-webkit-box-orient:vertical!important;overflow:hidden!important;min-height:4.35em!important}.card-tags{order:6!important}.card-hashtags{order:7!important}
      /* One line of facets per card (1 universe + 1 setting, or 2 settings): long names truncate instead of wrapping, so every card keeps the same height. */
      .card-meta{display:flex!important;align-items:center!important;flex-wrap:nowrap!important;gap:5px!important;overflow:hidden!important;min-width:0!important}
      .card-meta .card-universe-token,.card-meta .card-setting-token{flex:0 1 auto!important;min-width:0!important;max-width:100%!important;overflow:hidden!important}.card-meta .card-universe-token span,.card-meta .card-setting-token span:last-child{min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}.card-meta .card-universe-token .ui-icon,.card-meta .setting-mark,.card-meta .card-pov-icon{flex:0 0 auto!important}
      .card-hashtags{min-height:15px!important}.card-hashtags:empty{visibility:hidden!important}
      .card-tags button,.card-tags span{font-family:var(--font-text),"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif!important}
      .card-hashtags button,.card-hashtags span{font-family:var(--font-text),"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif!important}
      .facet-extra{display:none!important}.modal-setting-more,.modal-universe-more,.modal-tag-more,.modal-hashtag-more{display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 auto!important;color:#6f796e!important;font:7px/1 var(--mono)!important}
      @media(min-width:761px){
        .modal-card{height:min(446px,84vh)!important;min-height:min(446px,84vh)!important;max-height:min(446px,84vh)!important}
        .modal-cover{height:100%!important;min-height:0!important}
        .modal-content{position:relative!important;height:100%!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important}
        .modal-author-row{position:absolute!important;top:50px!important;right:20px!important;z-index:3!important;margin:0!important;padding:0!important;font-size:0!important;color:#788276!important;white-space:nowrap!important}
        .modal-author-row:before{content:'BY ';font:700 7px/1 var(--mono)!important;letter-spacing:.09em!important;color:#667164!important}
        .modal-author-row #modalAuthor{margin:0 0 0 4px!important;padding:0!important;border:0!important;background:none!important;color:#b9c2b2!important;font:700 8.5px/1 var(--mono)!important;text-decoration:underline!important;text-underline-offset:2px!important;cursor:pointer!important}
        .modal-author-row #modalPov{display:none!important}
        .modal-setting-row{padding-right:118px!important}
        .modal-universe-row{padding:0 118px 0 10px!important;margin-top:1px!important}
        #modalUniverse{display:flex!important;align-items:center!important;flex-wrap:wrap!important;gap:5px 8px!important;min-width:0!important}
        #modalUniverse:before{content:'UNIVERSE:';flex:0 0 auto!important;color:#667164!important;font:700 7px/1 var(--mono)!important;letter-spacing:.09em!important}
        #modalTags{margin-bottom:4px!important}
        #modalTags .modal-hashtags{position:static!important;display:flex!important;align-items:center!important;flex-wrap:wrap!important;gap:9px!important;width:100%!important;min-height:15px!important;height:auto!important;margin:7px 0 0!important;padding:6px 0 0!important;border-top:1px solid rgba(83,95,80,.38)!important;border-bottom:0!important;background:transparent!important}
        #modalTags .modal-hashtags button{font-size:8px!important}.modal-hashtag-more{margin-left:2px!important}
        .card-data-shell{margin-bottom:0!important}
        .modal-action-groups{margin-top:4px!important;padding-top:7px!important;gap:6px!important}
        .modal-action-group{grid-template-columns:76px minmax(0,1fr)!important;gap:9px!important}
        .modal-actions{gap:7px!important;min-width:0!important}
        .modal-actions a{min-width:0!important;padding-inline:10px!important}
      }
      @media(max-width:760px){
        .drawer-query-row{gap:3px!important}.drawer-search{height:29px!important;min-height:29px!important;margin:3px 0!important;padding-inline:6px!important}.drawer-tool-btn{min-width:45px!important;height:29px!important;min-height:29px!important;padding:2px 4px!important}
        .card-meta{flex-wrap:nowrap!important;gap:4px!important;overflow:hidden!important}.card-setting-token,.card-universe-token{flex:0 1 auto!important;min-width:0!important;max-width:100%!important}.card-setting-token span:last-child{min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
        .modal-universe-row{display:flex!important;align-items:center!important;min-height:13px!important;margin:0 0 5px!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important}.modal-universe-row[hidden],#modalUniverse[hidden]{display:none!important}#modalUniverse{display:flex!important;align-items:center!important;flex-wrap:wrap!important;gap:5px 8px!important;min-width:0!important}#modalUniverse:before{content:'UNIVERSE:';color:#667164!important;font:700 6.5px/1 var(--mono)!important;letter-spacing:.08em!important}#modalUniverse .universe-link{display:inline-flex!important;align-items:center!important;gap:4px!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;color:#6b756b!important;opacity:.76!important;font:6.8px/1.25 var(--mono)!important}#modalUniverse .universe-link .ui-icon{width:8px!important;height:8px!important;opacity:.66!important}
      }
    `;document.head.appendChild(style);
  }

  ensurePresentationStyles();ensureDrawerReset();
  const originalRender=window.render;
  if(typeof originalRender==='function'&&!originalRender.__facetPresentationWrapped){const wrapped=function(...args){const result=originalRender.apply(this,args);ensureDrawerReset();return result};wrapped.__facetPresentationWrapped=true;window.render=wrapped}
  window.addEventListener('archive:modal-public-ready',decorateModalFacets);
})();
