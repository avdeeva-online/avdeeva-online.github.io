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
    bot.full=data.description||'';
    bot.scenario=data.scenario||'';
    bot.intros=data.intros||[];
    bot._definitionReady=true;
    bot._definitionLoading=false;
  }

  const original=window.openModal;
  if(typeof original!=='function')return;

  window.openModal=function(bot,...args){
    if(!bot?.janitorUuid)return original.call(this,bot,...args);

    const uuid=bot.janitorUuid;
    const cached=cache.get(uuid);
    if(!bot._definitionReady){
      bot._definitionLoading=true;
      bot.full='';
      bot.scenario='';
      bot.intros=[];
    }

    const out=original.call(this,bot,...args);
    if(bot._definitionReady)return out;

    Promise.resolve(cached||loadDefinition(bot)).then(data=>{
      apply(bot,data);
      const title=document.querySelector('#modalTitle')?.textContent?.trim();
      if(title!==String(bot.nameEn||'').trim())return;
      if(typeof window.renderModalPanel==='function')window.renderModalPanel();
    }).catch(err=>{
      bot._definitionLoading=false;
      console.warn('Modal definition unavailable',err);
      const title=document.querySelector('#modalTitle')?.textContent?.trim();
      if(title===String(bot.nameEn||'').trim()&&typeof window.renderModalPanel==='function')window.renderModalPanel();
    });

    return out;
  };
})();
