(()=>{
  if(document.getElementById('archiveModalSizeTune'))return;
  const s=document.createElement('style');
  s.id='archiveModalSizeTune';
  s.textContent=`
  @media(min-width:761px){
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

    .card-data-shell{margin-top:0!important;margin-bottom:10px!important}
    .card-data-toggle{height:30px!important;min-height:30px!important;font-size:7px!important}
    .card-data-body{height:132px!important;min-height:132px!important;max-height:132px!important}
    .card-data-body .modal-text-wrap{height:101px!important;min-height:101px!important;max-height:101px!important}

    .modal-tags{margin-top:2px!important;margin-bottom:0!important}
    .modal-primary-tags{gap:5px!important}
    .modal-primary-tags button{padding:4px 6px!important;font-size:8.5px!important}
    .modal-hashtags{margin-top:8px!important;padding-top:6px!important;margin-bottom:0!important}
    .modal-hashtags button{font-size:8.5px!important}

    /* Give the lower area a real rhythm instead of stacking FILES and SOURCE. */
    .modal-action-groups{
      margin-top:14px!important;
      padding-top:10px!important;
      gap:10px!important;
      flex:0 0 auto!important;
    }
    .modal-action-group{
      grid-template-columns:64px minmax(0,1fr)!important;
      gap:10px!important;
      align-items:center!important;
    }
    .modal-action-group>small{margin:0!important;font-size:7px!important;align-self:center!important}
    .modal-actions{gap:8px!important}
    .modal-actions a{height:28px!important;min-height:28px!important;padding:0 9px!important;font-size:7.8px!important}

    /* Close control: quiet icon, no circle competing with the content. */
    .modal-close{
      width:26px!important;
      height:26px!important;
      top:10px!important;
      right:10px!important;
      border:0!important;
      border-radius:0!important;
      background:transparent!important;
      box-shadow:none!important;
      color:#8d9788!important;
      font-size:20px!important;
      line-height:1!important;
      padding:0!important;
      opacity:.82!important;
      transform:none!important;
      transition:color .12s ease,opacity .12s ease!important;
    }
    .modal-close:hover{
      background:transparent!important;
      color:#e0e5d8!important;
      opacity:1!important;
      transform:none!important;
    }

    .modal-prev{left:calc(50% - 390px)!important}
    .modal-next{right:calc(50% - 390px)!important}
  }
  `;
  document.head.appendChild(s);
})();