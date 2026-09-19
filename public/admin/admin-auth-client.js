(()=>{
  'use strict';
  const nativeFetch=window.fetch.bind(window),storageKey='archiveAdminToken';
  const token=()=>sessionStorage.getItem(storageKey)||'';
  const isAdminApi=request=>{try{const url=new URL(request.url,location.href);return url.origin===location.origin&&url.pathname.startsWith('/api/admin/')}catch{return false}};
  const authorized=(request,value)=>{const headers=new Headers(request.headers);if(value)headers.set('x-archive-admin-token',value);return new Request(request,{headers})};
  window.fetch=async(input,init)=>{
    const original=new Request(input,init);
    if(!isAdminApi(original))return nativeFetch(original);
    const attemptedToken=token();
    let response=await nativeFetch(authorized(original.clone(),attemptedToken));
    if(response.status!==401)return response;
    const body=await response.clone().json().catch(()=>null);
    if(body?.error!=='ADMIN_AUTH_REQUIRED')return response;
    if(token()&&token()!==attemptedToken)return nativeFetch(authorized(original,token()));
    const supplied=String(window.prompt('ARCHIVE ADMIN TOKEN')||'').trim();
    if(!supplied)return response;
    sessionStorage.setItem(storageKey,supplied);
    response=await nativeFetch(authorized(original,supplied));
    if(response.status===401)sessionStorage.removeItem(storageKey);
    return response;
  };
})();
