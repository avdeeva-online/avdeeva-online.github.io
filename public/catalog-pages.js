// The public catalog in pages of 300: the whole list in one request goes over the server's CPU limit
// ("Worker exceeded resource limits", HTTP 503) once the archive has ~1700 bots. The first page tells the total,
// the rest load in parallel; each page is cached on the server. fresh (right after an import) skips that cache.
// Returns {ok:true,total,characters} like the old /api/catalog?limit=10000.
(()=>{
  const PAGE=300;
  async function page(offset,fresh){
    const r=await fetch(`/api/catalog?limit=${PAGE}&offset=${offset}${fresh?'&fresh=1':''}`,{cache:fresh?'no-store':'no-cache'});
    let data={};try{data=await r.json()}catch{}
    if(!r.ok||!data.ok)throw new Error(data.message||data.error||`HTTP ${r.status}`);
    return data;
  }
  window.archiveCatalogPages=async({fresh=false}={})=>{
    const first=await page(0,fresh),total=Number(first.total)||0,rest=[];
    for(let offset=PAGE;offset<total;offset+=PAGE)rest.push(page(offset,fresh));
    const seen=new Set(),characters=[];
    for(const p of [first,...await Promise.all(rest)])for(const c of Array.isArray(p.characters)?p.characters:[]){const k=c.janitorUuid||c.id;if(seen.has(k))continue;seen.add(k);characters.push(c)}
    return{ok:true,total,characters};
  };
})();
