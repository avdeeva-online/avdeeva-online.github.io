(()=>{
  const cache=new Map();

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

  async function loadDefinition(bot){
    const uuid=bot?.janitorUuid;
    if(!uuid)return null;
    if(cache.has(uuid))return cache.get(uuid);

    const promise=(async()=>{
      const r=await fetch(`/api/characters/${encodeURIComponent(uuid)}/card`,{cache:'no-store'});
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
    if(data.description)bot.full=data.description;
    bot.scenario=data.scenario||'';
    bot.intros=data.intros||[];
  }

  const original=window.openModal;
  if(typeof original!=='function')return;

  window.openModal=function(bot,...args){
    const out=original.call(this,bot,...args);
    if(!bot?.janitorUuid)return out;

    loadDefinition(bot).then(data=>{
      apply(bot,data);
      // Repaint only if the user is still looking at this exact record.
      const title=document.querySelector('#modalTitle')?.textContent?.trim();
      if(title!==String(bot.nameEn||'').trim())return;
      if(typeof window.renderModalPanel==='function')window.renderModalPanel();
    }).catch(err=>console.warn('Modal definition unavailable',err));

    return out;
  };
})();
