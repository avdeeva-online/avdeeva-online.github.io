(()=>{
  if(document.getElementById('archiveModalSizeTune'))return;
  const s=document.createElement('style');
  s.id='archiveModalSizeTune';
  s.textContent=`
  @media(min-width:761px){
    /* Back to the old modal proportions: wider, noticeably shorter, closer to the original screenshot. */
    .modal-card{
      width:min(690px,88vw)!important;
      height:min(440px,82vh)!important;
      max-height:min(440px,82vh)!important;
      grid-template-columns:250px minmax(0,1fr)!important;
    }
    .modal-cover{height:100%!important;min-height:0!important}
    .modal-content{padding:14px 17px 10px!important;height:100%!important;overflow:hidden!important}
    .modal-content h2{font-size:21px!important;line-height:1!important;margin:5px 0 5px!important;max-width:100%;overflow:hidden}
    .modal-universe-row{margin-top:0!important}
    .modal-author-row{margin-top:4px!important}

    /* Description is intentionally a small viewport, not the thing that determines modal size. */
    .modal-public-summary{flex:0 0 auto!important;margin-top:6px!important;padding:5px 0 4px!important}
    .modal-public-head{margin-bottom:3px!important}
    .modal-public-body{
      height:68px!important;
      min-height:68px!important;
      max-height:68px!important;
      font-size:9.8px!important;
      line-height:1.38!important;
      padding-right:6px!important;
    }
    .modal-public-body p{margin-bottom:4px!important}

    .card-data-shell{margin-top:0!important}
    .card-data-toggle{height:21px!important;font-size:6.6px!important}
    .card-data-body{height:95px!important;max-height:95px!important}
    .card-data-body .modal-text-wrap{height:67px!important;max-height:67px!important}

    .modal-tags{margin-top:2px!important}
    .modal-primary-tags button{padding:3px 5px!important;font-size:7.7px!important}
    .modal-hashtags{margin-top:3px!important;padding-top:3px!important}
    .modal-hashtags button{font-size:7.7px!important}

    .modal-action-groups{padding-top:4px!important;gap:4px!important}
    .modal-action-group{grid-template-columns:58px minmax(0,1fr)!important;gap:5px!important}
    .modal-action-group>small{margin:5px 0 0!important;font-size:6.5px!important}
    .modal-actions{gap:5px!important}
    .modal-actions a{height:25px!important;min-height:25px!important;padding:0 7px!important;font-size:7.2px!important}

    .modal-prev{left:calc(50% - 390px)!important}
    .modal-next{right:calc(50% - 390px)!important}
  }
  `;
  document.head.appendChild(s);
})();