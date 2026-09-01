(()=>{
  window.archiveDefinitionLoaderActive=true;
  const cache=new Map();
  const TIMEOUT_MS=12000;
  let activeUuid='';

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
      const r=await fetchWithTimeout(`/api/characters/${encodeURIComponent(uuid)}`);
      if(!r.ok)throw new Error(`DETAIL_HTTP_${r.status}`);
      const payload=await r.json(),d=payload?.character||{};
      return {description:String(d.full||'').trim(),scenario:String(d.scenario||'').trim(),intros:cleanList(d.intros?.[0],d.intros?.slice(1))};
    })();
    cache.set(uuid,promise);
    try{return await promise}catch(e){cache.delete(uuid);throw e}
  }

  function preservePublicDescription(bot){
    if(!bot||bot.publicDescription)return;
    const source=String(bot.full||bot.short||'').trim();
    if(source)bot.publicDescription=source;
  }

  function apply(bot,data){
    if(!bot||!data)return;
    preservePublicDescription(bot);
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
    const uuid=String(bot?.janitorUuid||'').toLowerCase();
    return !!uuid&&uuid===activeUuid;
  }

  function repaint(bot){
    if(!modalStillShows(bot))return;
    const paint=()=>{
      if(!modalStillShows(bot))return;
      if(typeof window.renderModalPanel==='function')window.renderModalPanel();
      window.dispatchEvent(new CustomEvent('archive:modal-definition-ready',{detail:{bot}}));
    };
    paint();
    requestAnimationFrame(paint);
  }

  const original=window.openModal;
  if(typeof original!=='function')return;

  window.openModal=function(bot,...args){
    activeUuid=String(bot?.janitorUuid||'').toLowerCase();
    if(!activeUuid)return original.call(this,bot,...args);
    preservePublicDescription(bot);
    if(!bot._definitionReady){bot._definitionLoading=true;bot._definitionError='';bot.full='';bot.scenario='';bot.intros=[]}
    const out=original.call(this,bot,...args);
    window.dispatchEvent(new CustomEvent('archive:modal-public-ready',{detail:{bot}}));
    if(bot._definitionReady)return out;
    loadDefinition(bot).then(data=>{apply(bot,data);repaint(bot)}).catch(err=>{bot._definitionLoading=false;bot._definitionError=err?.name==='AbortError'?'TIMEOUT':String(err?.message||err||'LOAD_FAILED');console.warn('Modal definition unavailable',err);repaint(bot)});
    return out;
  };
})();
