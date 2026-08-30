(()=>{
  const cache=new Map();
  const TIMEOUT_MS=12000;

  function cleanList(first,alts){
    const out=[];
    const push=v=>{
      const s=String(v||'').trim();
      if(!s||/^[\s.·•…_-]+$/.test(s)||out.includes(s))return;
      out.push(s);
    };
    push(first);
    (Array.isArray(alts)?alts:[]).forEach(push);
    return out;
  }

  async function fetchWithTimeout(url){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
    try{return await fetch(url,{cache:'no-store',signal:controller.signal})}
    finally{clearTimeout(timer)}
  }

  async function loadDefinition(bot){
    const uuid=bot?.janitorUuid;
    if(!uuid)return null;
    if(cache.has(uuid))return cache.get(uuid);

    const promise=(async()=>{
      const r=await fetchWithTimeout(`/api/characters/${encodeURIComponent(uuid)}/card`);
      if(!r.ok)throw new Error(`CARD_HTTP_${r.status}`);
      const card=await r.json();
      const d=card?.data||{};
      return {
        description:String(d.description||d.personality||'').trim(),
        scenario:String(d.scenario||'').trim(),
        intros:cleanList(d.first_mes,d.alternate_greetings)
      };
    })();

    cache.set(uuid,promise);
    try{return await promise}catch(e){cache.delete(uuid);throw e}
  }

  function apply(bot,data){
    if(!bot||!data)return;
    bot.full=data.description||'';
    bot.scenario=data.scenario||'';
    bot.intros=data.intros||[];
    bot._definitionReady=true;
    bot._definitionLoading=false;
    bot._definitionError='';
  }

  function modalStillShows(bot){
    const modal=document.querySelector('#modal');
    if(!modal||modal.hidden)return false;
    const title=document.querySelector('#modalTitle')?.textContent?.trim()||'';
    return title===String(bot?.nameEn||'').trim();
  }

  function repaint(bot){
    if(!modalStillShows(bot))return;
    const paint=()=>{
      if(!modalStillShows(bot))return;
      if(typeof window.renderModalPanel==='function')window.renderModalPanel();
    };
    paint();
    requestAnimationFrame(paint);
  }

  const original=window.openModal;
  if(typeof original!=='function')return;

  window.openModal=function(bot,...args){
    if(!bot?.janitorUuid)return original.call(this,bot,...args);

    if(!bot._definitionReady){
      bot._definitionLoading=true;
      bot._definitionError='';
      bot.full='';
      bot.scenario='';
      bot.intros=[];
    }

    const out=original.call(this,bot,...args);
    if(bot._definitionReady)return out;

    loadDefinition(bot).then(data=>{
      apply(bot,data);
      repaint(bot);
    }).catch(err=>{
      bot._definitionLoading=false;
      bot._definitionError=err?.name==='AbortError'?'TIMEOUT':String(err?.message||err||'LOAD_FAILED');
      console.warn('Modal definition unavailable',err);
      repaint(bot);
    });

    return out;
  };
})();
