(()=>{
  if(document.getElementById('archiveModalSizeTune'))return;
  const s=document.createElement('style');
  s.id='archiveModalSizeTune';
  s.textContent=`
  @media(min-width:761px){
    /* Compact frame, but no dead lower third. */
    .modal-card{
      width:min(690px,88vw)!important;
      height:min(420px,82vh)!important;
      max-height:min(420px,82vh)!important;
      grid-template-columns:250px minmax(0,1fr)!important;
    }
    .modal-cover{height:100%!important;min-height:0!important}
    .modal-content{
      padding:15px 18px 10px!important;
      height:100%!important;
      overflow:hidden!important;
      display:flex!important;
      flex-direction:column!important;
    }

    .modal-content h2{
      font-size:20px!important;
      line-height:1.04!important;
      margin:5px 0 9px!important;
      max-width:100%;
      overflow:hidden;
    }
    .modal-universe-row{margin-top:1px!important;margin-bottom:8px!important}
    .modal-author-row{margin-top:0!important;margin-bottom:7px!important}

    /* Give the useful summary the space instead of leaving it empty at the bottom. */
    .modal-public-summary{
      flex:0 0 auto!important;
      margin-top:10px!important;
      padding:0!important;
    }
    .modal-public-body{
      height:132px!important;
      min-height:132px!important;
      max-height:132px!important;
      font-size:10.5px!important;
      line-height:1.5!important;
      padding-right:7px!important;
    }
    .modal-public-body p{margin-bottom:7px!important}

    .card-data-shell{margin-top:0!important;margin-bottom:9px!important}
    .card-data-toggle{height:30px!important;min-height:30px!important;font-size:7px!important}
    .card-data-body{height:132px!important;min-height:132px!important;max-height:132px!important}
    .card-data-body .modal-text-wrap{height:101px!important;min-height:101px!important;max-height:101px!important}

    .modal-tags{margin-top:1px!important;margin-bottom:0!important}
    .modal-primary-tags{gap:5px!important}
    .modal-primary-tags button{padding:4px 6px!important;font-size:8.5px!important}
    .modal-hashtags{margin-top:7px!important;padding-top:6px!important;margin-bottom:0!important}
    .modal-hashtags button{font-size:8.5px!important}

    .modal-action-groups{
      margin-top:10px!important;
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