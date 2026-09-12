(()=>{
  'use strict';

  function ensureUniversePlacementStyles(){
    if(document.getElementById('archiveUniversePlacementStyles'))return;
    const style=document.createElement('style');
    style.id='archiveUniversePlacementStyles';
    style.textContent=`
      @media(max-width:760px){
        .card-body{position:relative!important}
        .card-mobile-universe{
          position:absolute!important;
          top:22px!important;
          left:0!important;
          right:0!important;
          z-index:1!important;
          display:flex!important;
          align-items:center!important;
          justify-content:flex-start!important;
          width:max-content!important;
          max-width:100%!important;
          height:11px!important;
          min-height:11px!important;
          margin:0!important;
          padding:0!important;
          border:0!important;
          border-radius:0!important;
          background:transparent!important;
          box-shadow:none!important;
          color:#687168!important;
          opacity:.8!important;
          font:6.6px/11px var(--mono)!important;
          letter-spacing:.025em!important;
          gap:3px!important;
          overflow:hidden!important;
          white-space:nowrap!important;
          text-overflow:ellipsis!important;
          pointer-events:none!important;
        }
        .card-mobile-universe .ui-icon{
          width:8px!important;
          min-width:8px!important;
          height:8px!important;
          opacity:.7!important;
        }
        .card-title .card-mobile-universe span,
        .card-mobile-universe span{
          display:inline!important;
          margin:0!important;
          min-width:0!important;
          overflow:hidden!important;
          text-overflow:ellipsis!important;
          white-space:nowrap!important;
          font:inherit!important;
        }
      }

      #modalUniverse.modal-universe-inline{
        display:flex!important;
        align-items:center!important;
        flex-wrap:wrap!important;
        gap:5px!important;
        width:auto!important;
        min-height:0!important;
        margin:1px 0 7px!important;
        padding:0!important;
        border:0!important;
        background:transparent!important;
        box-shadow:none!important;
      }
      #modalUniverse.modal-universe-inline[hidden]{display:none!important}
      #modalUniverse.modal-universe-inline .universe-link{
        display:inline-flex!important;
        align-items:center!important;
        gap:4px!important;
        min-height:0!important;
        margin:0!important;
        padding:0!important;
        border:0!important;
        background:transparent!important;
        box-shadow:none!important;
        color:#727d70!important;
        opacity:.82!important;
        font:8px/1.3 var(--mono)!important;
        letter-spacing:.025em!important;
      }
      #modalUniverse.modal-universe-inline .universe-link .ui-icon{
        width:9px!important;
        height:9px!important;
        opacity:.72!important;
      }
      .modal-universe-row.archive-universe-row-empty{display:none!important}

      @media(max-width:760px){
        #modalUniverse.modal-universe-inline{
          margin:0 0 7px!important;
        }
        #modalUniverse.modal-universe-inline .universe-link{
          font-size:7px!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function placeModalUniverse(){
    const heading=document.querySelector('.modal-heading-row');
    const universe=document.querySelector('#modalUniverse');
    const oldRow=document.querySelector('.modal-universe-row');
    if(!heading||!universe)return;

    universe.classList.add('modal-universe-inline');
    if(universe.previousElementSibling!==heading){
      heading.insertAdjacentElement('afterend',universe);
    }
    if(oldRow)oldRow.classList.add('archive-universe-row-empty');
  }

  ensureUniversePlacementStyles();
  placeModalUniverse();

  const modal=document.querySelector('#modal');
  if(modal){
    new MutationObserver(()=>placeModalUniverse()).observe(modal,{childList:true,subtree:true});
  }
})();
