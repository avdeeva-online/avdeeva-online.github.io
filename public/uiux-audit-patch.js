(()=>{
  'use strict';

  const SERVICE_LINE=/^\s*character\s*:\s*/i;
  const TEXT_SELECTOR='#modalPublicBody p,.modal-dossier p,.modal-dossier li';

  function cleanServiceLine(value){
    if(typeof value!=='string'||!value)return value;
    return value
      .replace(/\r/g,'')
      .split('\n')
      .filter(line=>!SERVICE_LINE.test(line))
      .join('\n')
      .replace(/\n{3,}/g,'\n\n')
      .trim();
  }

  function cleanBotData(){
    const bots=Array.isArray(window.BOTS)?window.BOTS:[];
    for(const bot of bots){
      if(!bot||typeof bot!=='object')continue;
      for(const key of ['publicDescription','short','full','scenario']){
        if(typeof bot[key]==='string')bot[key]=cleanServiceLine(bot[key]);
      }
      if(Array.isArray(bot.intros))bot.intros=bot.intros.map(cleanServiceLine);
    }
  }

  function normalizeCardRow(row){
    if(!row||row.dataset.auditNormalized==='1')return;
    const more=row.querySelector('.tag-more');
    const tagNodes=[...row.children].filter(node=>!node.classList.contains('tag-more'));
    if(tagNodes.length<=3){row.dataset.auditNormalized='1';return;}

    const hiddenCount=tagNodes.length-3;
    tagNodes.slice(3).forEach(node=>node.remove());
    const existingMore=more?Number(String(more.textContent||'').replace(/\D/g,''))||0:0;
    const totalMore=existingMore+hiddenCount;
    const counter=more||document.createElement('span');
    counter.className='tag-more';
    counter.textContent=`+${totalMore}`;
    counter.title=`${totalMore} more tag${totalMore===1?'':'s'}`;
    if(!more)row.append(counter);
    row.dataset.auditNormalized='1';
  }

  function scrubTextNode(node){
    if(node&&SERVICE_LINE.test(node.textContent||''))node.remove();
  }

  function scan(root){
    if(!root||root.nodeType!==1)return;
    if(root.matches?.('.card-tags'))normalizeCardRow(root);
    root.querySelectorAll?.('.card-tags').forEach(normalizeCardRow);

    if(root.matches?.(TEXT_SELECTOR))scrubTextNode(root);
    root.querySelectorAll?.(TEXT_SELECTOR).forEach(scrubTextNode);
  }

  function annotateLorebookState(){
    const link=document.querySelector('#downloadLore');
    if(!link)return;
    const unavailable=link.matches('[aria-disabled="true"],.disabled,[disabled]')||/not available/i.test(link.textContent||'');
    link.title=unavailable?'No lorebook is attached to this record.':'';
  }

  function ensureTerminalExit(){
    const retry=document.querySelector('#terminalRetry');
    if(!retry||document.querySelector('.terminal-back-home'))return;
    const back=document.createElement('button');
    back.type='button';
    back.className='terminal-back-home';
    back.textContent='BACK TO CATALOG';
    back.addEventListener('click',()=>{
      const terminal=document.querySelector('#lostTerminal');
      if(terminal)terminal.hidden=true;
      document.body.classList.remove('modal-open','terminal-open');
    });
    retry.insertAdjacentElement('afterend',back);
  }

  function ensureModalGeometryGuard(){
    if(document.getElementById('archiveModalGeometryGuard'))return;
    const style=document.createElement('style');
    style.id='archiveModalGeometryGuard';
    style.textContent=`
      @media(min-width:761px){
        .modal-card{
          height:auto!important;
          min-height:0!important;
          max-height:min(560px,calc(100dvh - 40px))!important;
          align-items:stretch!important;
          overflow:hidden!important;
        }
        .modal-cover{
          height:auto!important;
          min-height:420px!important;
          align-self:stretch!important;
        }
        .modal-cover img{
          height:100%!important;
          object-fit:cover!important;
        }
        .modal-content{
          height:auto!important;
          min-height:0!important;
          max-height:min(560px,calc(100dvh - 40px))!important;
          overflow-y:auto!important;
          overflow-x:hidden!important;
          scrollbar-gutter:stable;
        }
        .modal-action-groups{
          margin-top:12px!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function positionModalArrows(){
    const modal=document.querySelector('#modal');
    const card=modal?.querySelector('.modal-card');
    const prev=document.querySelector('#prevBot');
    const next=document.querySelector('#nextBot');
    if(!modal||!card||!prev||!next)return;

    if(window.innerWidth<=760||modal.hidden){
      prev.style.removeProperty('left');
      prev.style.removeProperty('right');
      next.style.removeProperty('left');
      next.style.removeProperty('right');
      return;
    }

    const rect=card.getBoundingClientRect();
    const gap=44;
    const edge=12;
    const prevWidth=prev.getBoundingClientRect().width||35;
    const nextWidth=next.getBoundingClientRect().width||35;
    const prevLeft=Math.max(edge,rect.left-gap-prevWidth);
    const nextLeft=Math.min(window.innerWidth-edge-nextWidth,rect.right+gap);

    prev.style.setProperty('left',`${Math.round(prevLeft)}px`,'important');
    prev.style.setProperty('right','auto','important');
    next.style.setProperty('left',`${Math.round(nextLeft)}px`,'important');
    next.style.setProperty('right','auto','important');
  }

  function scheduleArrowPosition(){
    requestAnimationFrame(()=>requestAnimationFrame(positionModalArrows));
  }

  cleanBotData();
  scan(document.body);
  annotateLorebookState();
  ensureTerminalExit();
  ensureModalGeometryGuard();
  scheduleArrowPosition();

  window.addEventListener('resize',scheduleArrowPosition,{passive:true});

  const observer=new MutationObserver(mutations=>{
    let lorebookMayHaveChanged=false;
    let modalMayHaveChanged=false;
    for(const mutation of mutations){
      if(mutation.target?.id==='downloadLore')lorebookMayHaveChanged=true;
      if(mutation.target?.id==='modal'||mutation.target?.classList?.contains('modal-card'))modalMayHaveChanged=true;
      for(const node of mutation.addedNodes){
        if(node.nodeType===1){
          scan(node);
          if(node.id==='downloadLore'||node.querySelector?.('#downloadLore'))lorebookMayHaveChanged=true;
          if(node.id==='modal'||node.matches?.('.modal-card')||node.querySelector?.('#modal,.modal-card'))modalMayHaveChanged=true;
        }
      }
    }
    if(lorebookMayHaveChanged)annotateLorebookState();
    if(modalMayHaveChanged)scheduleArrowPosition();
  });
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-disabled','href','hidden']});
})();
