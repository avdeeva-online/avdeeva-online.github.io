// Single definition of the edge-cached public catalog key, shared by the catalog itself and every
// admin write that must invalidate it (they previously drifted apart: v7 cached, v6 cleared).
const CATALOG_CACHE_PATH='/__archive_cache/catalog-v9';

export function catalogCacheKey(request,limit,offset=0){const u=new URL(request.url);u.pathname=CATALOG_CACHE_PATH;u.search=offset?`?limit=${limit}&offset=${offset}`:`?limit=${limit}`;return new Request(u.toString(),{method:'GET'})}
// The site reads pages of CATALOG_PAGE (public/catalog-api.js uses the same size) up to 10000 bots.
export const CATALOG_PAGE=300;

export async function clearCatalogCache(request,ctx){const cache=globalThis.caches?.default;if(!cache)return;const keys=[500,1000,10000].map(limit=>catalogCacheKey(request,limit));for(let offset=0;offset<10000;offset+=CATALOG_PAGE)keys.push(catalogCacheKey(request,CATALOG_PAGE,offset));const work=Promise.all(keys.map(k=>cache.delete(k)));ctx?.waitUntil?.(work);return work}
