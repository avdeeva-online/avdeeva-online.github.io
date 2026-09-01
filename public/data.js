// The public catalog is now driven by D1 imports. Placeholder/demo records were removed.
window.BOTS = [];

// Stable modal geometry: keep the earlier compact footprint while preventing
// DESCRIPTION / SCENARIO / INTRO from resizing the outer card.
(()=>{
  const style=document.createElement('style');
  style.id='archiveModalStability';
  style.textContent=`
    @media (min-width: 761px){
      .modal-card{
        height:min(500px,calc(100vh - 72px)) !important;
        min-height:min(500px,calc(100vh - 72px)) !important;
        max-height:min(500px,calc(100vh - 72px)) !important;
        overflow:hidden !important;
      }
      .modal-cover,
      .modal-content{
        height:100% !important;
        min-height:0 !important;
      }
      .modal-cover{overflow:hidden !important;}
      .modal-cover>img{
        width:100% !important;
        height:100% !important;
        object-fit:cover !important;
      }
      .modal-content{
        display:flex !important;
        flex-direction:column !important;
        overflow:hidden !important;
      }
      .modal-heading-row,
      .modal-universe-row,
      .modal-author-row,
      .modal-tabs,
      .modal-tags,
      .modal-action-groups{
        flex:0 0 auto !important;
      }
      .modal-text-wrap{
        flex:1 1 auto !important;
        min-height:0 !important;
        overflow-y:auto !important;
        overflow-x:hidden !important;
      }
      .modal-intros,
      .intro-display{
        min-height:0 !important;
      }
    }
  `;
  document.head.appendChild(style);
})();
