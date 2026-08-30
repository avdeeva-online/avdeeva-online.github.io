(()=>{
  if(document.getElementById('archiveModalSizeTune'))return;
  const s=document.createElement('style');
  s.id='archiveModalSizeTune';
  s.textContent=`
  @media(min-width:761px){
    /* Keep the compact old-school frame. */
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

    .modal-content h2{
      font-size:20px!important;
      line-height:1.04!important;
      margin:6px 0 8px!important;
      max-width:100%;
      overflow:hidden;
    }
    .modal-universe-row{margin-top:1px!important;margin-bottom:7px!important}
    .modal-author-row{margin-top:0!important;margin-bottom:4px!important}

    /* Main content viewport. Height stays fixed; content scrolls inside it. */
    .modal-public-summary{
      flex:0 0 auto!important;
      margin-top:9px!important;
      padding:0!important;
    }
    .modal-public-body{
      height:116px!important;
      min-height:116px!important;
      max-height:116px!important;
      font-size:10.5px!important;
      line-height:1.48!important;
      padding-right:7px!important;
    }
    .modal-public-body p{margin-bottom:6px!important}

    /* Mode switch is visually separate from tags. */
    .card-data-shell{margin-top:0!important;margin-bottom:7px!important}
    .card-data-toggle{height:30px!important;min-height:30px!important;font-size:7px!important}
    .card-data-body{height:116px!important;max-height:116px!important}
    .card-data-body .modal-text-wrap{height:85px!important;max-height:85px!important}

    .modal-tags{margin-top:0!important;margin-bottom:0!important}
    .modal-primary-tags{gap:5px!important}
    .modal-primary-tags button{padding:4px 6px!important;font-size:8.5px!important}
    .modal-hashtags{margin-top:6px!important;padding-top:5px!important;margin-bottom:0!important}
    .modal-hashtags button{font-size:8.5px!important}

    /* Footer follows metadata naturally. Never pin it to the bottom. */
    .modal-action-groups{
      margin-top:12px!important;
      padding-top:7px!important;
      gap:6px!important;
      flex:0 0 auto!important;
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