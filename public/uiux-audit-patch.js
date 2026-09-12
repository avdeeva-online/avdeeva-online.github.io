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

  function cleanBotData(list=window.BOTS){
    if(!Array.isArray(list))return;
    for(const bot of list){
      if(!bot||typeof bot!=='object')continue;
      for(const key of ['publicDescription','short','full','scenario']){
        if(typeof bot[key]==='string')bot[key]=cleanServiceLine(bot[key]);
      }
      if(Array.isArray(bot.intros))bot.intros=bot.intros.map(cleanServiceLine);
    }
  }

  function scrubModalText(){
    document.querySelectorAll(TEXT_SELECTOR).forEach(node=>{
      if(SERVICE_LINE.test(node.textContent||''))node.remove();
    });
  }

  function normalizeAuditLabels(){
    const drawerSearch=document.querySelector('#drawerSearch');
    if(drawerSearch)drawerSearch.placeholder='SEARCH...';
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

  let arrowFrame=0;
  function scheduleArrowPosition(){
    if(arrowFrame)cancelAnimationFrame(arrowFrame);
    arrowFrame=requestAnimationFrame(()=>{arrowFrame=0;positionModalArrows()});
  }

  function refreshModalRuntime(){
    requestAnimationFrame(scrubModalText);
    scheduleArrowPosition();
  }

  cleanBotData();
  normalizeAuditLabels();
  ensureTerminalExit();
  refreshModalRuntime();

  window.addEventListener('archive:catalog-updated',()=>{
    cleanBotData(window.BOTS);
    normalizeAuditLabels();
  });
  window.addEventListener('archive:modal-public-ready',refreshModalRuntime);
  window.addEventListener('archive:modal-definition-ready',refreshModalRuntime);
  window.addEventListener('resize',scheduleArrowPosition,{passive:true});
})();
