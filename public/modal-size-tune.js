(()=>{
  if(document.getElementById('archiveModalSizeTune'))return;
  const s=document.createElement('style');
  s.id='archiveModalSizeTune';
  s.textContent=`
  @media(min-width:761px){
    /* Keep the compact old-school frame. Only rebalance the inside. */
    .modal-card{
      width:min(690px,88vw)!important;
      height:min(440px,82vh)!important;
      max-height:min(440px,82vh)!important;
      grid-template-columns:250px minmax(0,1fr)!important;
    }
    .modal-cover{height:100%!important;min-height:0!important}
    .modal-content{
      padding:16px 18px 11px!important;
      height:100%!important;
      overflow:hidden!important;
      display:flex!important;
      flex-direction:column!important;
    }

    /* Header gets breathing room again. */
    .modal-content h2{
      font-size:20px!important;
      line-height:1.04!important;
      margin:6px 0 7px!important;
      max-width:100%;
      overflow:hidden;
    }
    .modal-universe-row{margin-top:1px!important;margin-bottom:6px!important}
    .modal-author-row{margin-top:0!important;margin-bottom:2px!important}

    /* Main public description is useful, but not dominant. */
    .modal-public-summary{
      flex:0 0 auto!important;
      margin-top:8px!important;
      padding:7px 0 7px!important;
    }
    .modal-public-head{margin-bottom:5px!important}
    .modal-public-body{
      height:116px!important;
      min-height:116px!important;
      max-height:116px!important;
      font-size:10.5px!important;
      line-height:1.48!important;
      padding-right:7px!important;
    }
    .modal-public-body p{margin-bottom:6px!important}

    /* Internal card data is a secondary compact drawer. */
    .card-data-shell{margin-top:4px!important}
    .card-data-toggle{height:25px!important;font-size:7px!important}
    .card-data-body{height:110px!important;max-height:110px!important}
    .card-data-body .modal-text-wrap{height:78px!important;max-height:78px!important}

    /* Restore readable tag/button scale instead of micro-UI. */
    .modal-tags{margin-top:7px!important}
    .modal-primary-tags{gap:5px!important}
    .modal-primary-tags button{padding:4px 6px!important;font-size:8.5px!important}
    .modal-hashtags{margin-top:5px!important;padding-top:5px!important}
    .modal-hashtags button{font-size:8.5px!important}

    /* Footer stays pinned to the bottom, but no giant dead zone. */
    .modal-action-groups{
      margin-top:auto!important;
      padding-top:7px!important;
      gap:6px!important;
    }
    .modal-action-group{grid-template-columns:64px minmax(0,1fr)!important;gap:6px!important}
    .modal-action-group>small{margin:6px 0 0!important;font-size:7px!important}
    .modal-actions{gap:6px!important}
    .modal-actions a{height:27px!important;min-height:27px!important;padding:0 8px!important;font-size:7.8px!important}

    .modal-prev{left:calc(50% - 390px)!important}
    .modal-next{right:calc(50% - 390px)!important}
  }
  `;
  document.head.appendChild(s);
})();