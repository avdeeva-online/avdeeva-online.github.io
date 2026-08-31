(()=>{
  const clean=s=>String(s||'').replace(/\r/g,'').replace(/\*+/g,'').trim();
  const missing=s=>!clean(s)||clean(s).toUpperCase()==='UNCLASSIFIED';
  function explicitUniverse(bot){
    if(!bot||!missing(bot.universe))return null;
    const source=String(bot.publicDescription||bot.full||bot.short||'').replace(/\r/g,'');
    for(const label of ['UNIVERSE','WORLD','FRANCHISE','SERIES']){
      const rx=new RegExp(`(?:^|\\n)\\s*\\*{0,3}${label}\\*{0,3}(?:\\s*[:：-]\\s*|\\s+)([^\\n]+)`,'i');
      const m=source.match(rx);
      const value=clean(m?.[1]||'').replace(/^[:：-]\s*/,'').trim();
      if(value)return{value,label};
    }
    return null;
  }
  function patch(list){
    let changed=false;
    if(!Array.isArray(list))return changed;
    for(const bot of list){
      const found=explicitUniverse(bot);
      if(!found)continue;
      bot.universe=found.value;
      if(!bot.universeSourceField)bot.universeSourceField=`source-description:${found.label}`;
      changed=true;
    }
    return changed;
  }
  function refresh(list){
    const a=patch(list),b=patch(window.BOTS);
    if((a||b)&&typeof window.render==='function')window.render();
  }
  refresh(window.BOTS);
  window.addEventListener('archive:catalog-updated',e=>refresh(e.detail?.characters));
})();