(()=>{
  'use strict';

  const SERVICE_LINE=/^\s*character\s*:\s*/i;

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

  function normalizeCardTags(root=document){
    root.querySelectorAll?.('.card-tags').forEach(row=>{
      if(row.dataset.auditNormalized==='1')return;
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
    });
  }

  function scrubRenderedServiceLines(root=document){
    root.querySelectorAll?.('#modalPublicBody p,.modal-dossier p,.modal-dossier li').forEach(node=>{
      if(SERVICE_LINE.test(node.textContent||''))node.remove();
    });
  }

  function annotateLorebookState(){
    const link=document.querySelector('#downloadLore');
    if(!link)return;
    const unavailable=link.matches('[aria-disabled="true"],.disabled,[disabled]')||/not available/i.test(link.textContent||'');
    if(unavailable)link.title='No lorebook is attached to this record.';
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

  function run(root=document){
    normalizeCardTags(root);
    scrubRenderedServiceLines(root);
    annotateLorebookState();
    ensureTerminalExit();
  }

  cleanBotData();
  run();

  const observer=new MutationObserver(mutations=>{
    for(const mutation of mutations){
      for(const node of mutation.addedNodes){
        if(node.nodeType===1)run(node);
      }
    }
    run(document);
  });
  observer.observe(document.body,{childList:true,subtree:true});
})();
