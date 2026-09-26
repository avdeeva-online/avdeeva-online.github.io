// Single definition of the edge-cached public catalog key, shared by the catalog itself and every
// admin write that must invalidate it (they previously drifted apart: v7 cached, v6 cleared).
const CATALOG_CACHE_PATH='/__archive_cache/catalog-v9';

export function catalogCacheKey(request,limit){const u=new URL(request.url);u.pathname=CATALOG_CACHE_PATH;u.search=`?limit=${limit}`;return new Request(u.toString(),{method:'GET'})}

export async function clearCatalogCache(request,ctx){const cache=globalThis.caches?.default;if(!cache)return;const work=Promise.all([500,1000].map(limit=>cache.delete(catalogCacheKey(request,limit))));ctx?.waitUntil?.(work);return work}
