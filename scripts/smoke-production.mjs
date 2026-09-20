import assert from 'node:assert/strict';

const base=new URL(process.env.SMOKE_BASE_URL||'https://archive-exe.node-00.workers.dev');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function request(path,{json=false,attempts=5}={}){
  let lastError;
  for(let attempt=1;attempt<=attempts;attempt++){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15_000);
    try{
      const response=await fetch(new URL(path,base),{headers:{accept:json?'application/json':'text/html,image/*;q=.8'},signal:controller.signal});
      const bytes=new Uint8Array(await response.arrayBuffer());
      if(!response.ok)throw new Error(`${path}: HTTP ${response.status}`);
      return{response,bytes,data:json?JSON.parse(new TextDecoder().decode(bytes)):null};
    }catch(error){lastError=error;if(attempt<attempts)await wait(attempt*1_000)}finally{clearTimeout(timer)}
  }
  throw lastError;
}

for(const path of ['/','/characters','/hub']){
  const {response,bytes}=await request(path);
  assert.match(response.headers.get('content-type')||'',/text\/html/i,`${path}: HTML content type missing`);
  assert.ok(bytes.byteLength>1_000,`${path}: response is unexpectedly small`);
}

const catalog=await request('/api/catalog?limit=1000',{json:true});
assert.equal(catalog.data?.ok,true,'catalog API did not return ok');
assert.ok(Array.isArray(catalog.data?.characters)&&catalog.data.characters.length>0,'catalog API returned no characters');

const hub=await request('/api/hub-resources?summary=1',{json:true});
assert.equal(hub.data?.ok,true,'HUB summary did not return ok');
assert.ok(Array.isArray(hub.data?.resources),'HUB summary resources missing');
assert.ok(hub.bytes.byteLength<64_000,`HUB summary payload regressed to ${hub.bytes.byteLength} bytes`);
assert.equal(new TextDecoder().decode(hub.bytes).includes('data:image/'),false,'embedded image data leaked into HUB summary');

if(hub.data.resources.length){
  const first=hub.data.resources[0],detail=await request(`/api/hub-resources/${encodeURIComponent(first.id)}`,{json:true});
  assert.equal(detail.data?.ok,true,'HUB detail did not return ok');
  assert.equal(detail.data?.resource?.id,first.id,'HUB detail returned the wrong resource');
}

const localCovers=hub.data.resources.filter(item=>String(item.cover_url||'').startsWith('/api/'));
for(const item of localCovers){
  const cover=await request(item.cover_url,{attempts:3});
  assert.match(cover.response.headers.get('content-type')||'',/^image\//i,`${item.title}: local cover is not an image`);
  assert.ok(cover.bytes.byteLength>0,`${item.title}: local cover is empty`);
}

console.log(`ARCHIVE.EXE production smoke OK · ${catalog.data.characters.length} cards + ${hub.data.resources.length} HUB resources + ${localCovers.length} local covers`);
