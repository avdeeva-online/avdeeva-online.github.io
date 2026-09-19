const clean=value=>String(value??'').replace(/\s+/g,' ').trim();

export function normalizeHashtags(values){
  const list=Array.isArray(values)?values:[],seen=new Set(),out=[];
  for(const raw of list){
    const value=clean(raw).replace(/^#+\s*/,'');
    const key=value.toLocaleLowerCase();
    if(!value||seen.has(key))continue;
    seen.add(key);out.push(value);
  }
  return out;
}
