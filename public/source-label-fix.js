(()=>{
  const clean=s=>String(s||'').replace(/\r/g,'').replace(/\*+/g,'').replace(/\s+/g,' ').trim();
  const missing=s=>!clean(s)||clean(s).toUpperCase()==='UNCLASSIFIED';
  const compactKey=s=>clean(s).replace(/^#+\s*/,'').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');

  function hasStoredUniverse(bot){
    return !missing(bot?.universe)||(Array.isArray(bot?.universes)&&bot.universes.some(v=>!missing(v)));
  }

  function titleHashtagUniverse(bot){
    if(!bot||hasStoredUniverse(bot))return null;
    const title=clean(bot.nameEn||bot.name||'');
    if(!title.includes('|'))return null;
    const hashtagKeys=new Set((Array.isArray(bot.hashtags)?bot.hashtags:[]).map(compactKey).filter(Boolean));
    if(!hashtagKeys.size)return null;

    for(const raw of title.split('|').slice(1)){
      const value=clean(raw).replace(/^[^\p{L}\p{N}]+/u,'').trim();
      const key=compactKey(value);
      if(value.length>=2&&value.length<=80&&key&&hashtagKeys.has(key)){
        return{value,label:'TITLE_HASHTAG'};
      }
    }
    return null;
  }

  function explicitUniverse(bot){
    if(!bot||hasStoredUniverse(bot))return null;
    const source=String(bot.publicDescription||bot.full||bot.short||'').replace(/\r/g,'');
    for(const label of ['UNIVERSE','WORLD','FRANCHISE','SERIES']){
      const rx=new RegExp(`(?:^|\\n)\\s*\\*{0,3}${label}\\*{0,3}(?:\\s*[:：-]\\s*|\\s+)([^\\n]+)`,'i');
      const m=source.match(rx);
      const value=clean(m?.[1]||'').replace(/^[:：-]\s*/,'').trim();
      if(value)return{value,label};
    }
    return titleHashtagUniverse(bot);
  }

  function patch(list){
    let changed=false;
    if(!Array.isArray(list))return changed;
    for(const bot of list){
      const found=explicitUniverse(bot);
      if(!found)continue;
      bot.universe=found.value;
      if(!Array.isArray(bot.universes)||!bot.universes.length)bot.universes=[found.value];
      if(!bot.universeSourceField){
        bot.universeSourceField=found.label==='TITLE_HASHTAG'?'title-hashtag-match':`source-description:${found.label}`;
      }
      changed=true;
    }
    return changed;
  }

  const originalRender=window.render;
  if(typeof originalRender==='function'&&!originalRender.__archiveUniversePatched){
    const wrapped=function(...args){
      patch(window.BOTS);
      return originalRender.apply(this,args);
    };
    wrapped.__archiveUniversePatched=true;
    window.render=wrapped;
  }

  patch(window.BOTS);
  window.addEventListener('archive:catalog-updated',e=>{
    patch(e.detail?.characters);
    patch(window.BOTS);
  });
})();
