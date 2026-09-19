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

const tagText=value=>clean(value).replace(/^[^\p{L}\p{N}#]+/u,'').trim();
const TAG_ALIASES=new Map([
  ['enemy to lovers','enemies to lovers']
]);

export function semanticTagKey(value){
  const raw=tagText(value).toLocaleLowerCase();
  return TAG_ALIASES.get(raw)||raw;
}

export function normalizeTags(values){
  const list=Array.isArray(values)?values:[],seen=new Set(),out=[];
  for(const raw of list){
    const value=clean(raw);
    const key=semanticTagKey(value);
    if(!value||!key||seen.has(key))continue;
    seen.add(key);out.push(value);
  }
  return out;
}
