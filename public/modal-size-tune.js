(()=>{
  if(document.getElementById('archiveModalSizeTune'))return;
  const s=document.createElement('style');
  s.id='archiveModalSizeTune';
  s.textContent=`
  @media(min-width:761px){
    .modal-card{
      width:min(620px,88vw)!important;
      height:min(470px,82vh)!important;
      max-height:min(470px,82vh)!important;
      grid-template-columns:220px minmax(0,1fr)!important;
    }
    .modal-cover{height:100%!important;min-height:0!important}
    .modal-content{padding:13px 15px 10px!important;height:100%!important;overflow:hidden!important}
    .modal-content h2{font-size:20px!important;line-height:1!important;margin:5px 0 5px!important;max-width:100%;overflow:hidden}
    .modal-universe-row{margin-top:0!important}
    .modal-author-row{margin-top:4px!important}

    .modal-public-summary{
      flex:0 0 auto!important;
      margin-top:7px!important;
      padding:6px 0 5px!important;
    }
    .modal-public-head{margin-bottom:4px!important}
    .modal-public-body{
      height:88px!important;
      min-height:88px!important;
      max-height:88px!important;
      font-size:10px!important;
      line-height:1.42!important;
      padding-right:6px!important;
    }
    .modal-public-body p{margin-bottom:5px!important}

    .card-data-shell{margin-top:1px!important}
    .card-data-toggle{height:23px!important;font-size:6.7px!important}
    .card-data-body{height:105px!important;max-height:105px!important}
    .card-data-body .modal-text-wrap{height:76px!important;max-height:76px!important}

    .modal-tags{margin-top:3px!important}
    .modal-primary-tags button{padding:3px 5px!important;font-size:7.5px!important}
    .modal-hashtags{margin-top:3px!important;padding-top:3px!important}
    .modal-hashtags button{font-size:7.5px!important}

    .modal-action-groups{padding-top:5px!important;gap:4px!important}
    .modal-action-group{grid-template-columns:58px minmax(0,1fr)!important;gap:4px!important}
    .modal-action-group>small{margin:5px 0 0!important;font-size:6.5px!important}
    .modal-actions{gap:4px!important}
    .modal-actions a{height:24px!important;min-height:24px!important;padding:0 6px!important;font-size:7px!important}

    .modal-prev{left:calc(50% - 355px)!important}
    .modal-next{right:calc(50% - 355px)!important}
  }
  `;
  document.head.appendChild(s);
})();