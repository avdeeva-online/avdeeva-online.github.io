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

export const hashtagKey=value=>clean(value).replace(/^#+\s*/,'').toLocaleLowerCase();

// Different cards spell the same tag/hashtag differently ("Mafia"/"mafia", "👨 Male"/"👨‍🦰 Male"), which shows
// up as duplicate filter chips. Rewrite every card to the most common spelling of each key across the list.
export function unifyFacetSpelling(items,field,keyOf){
  const counts=new Map();
  for(const item of items)for(const v of Array.isArray(item?.[field])?item[field]:[]){const k=keyOf(v);if(!k)continue;const forms=counts.get(k)||new Map();forms.set(v,(forms.get(v)||0)+1);counts.set(k,forms)}
  const best=new Map([...counts].map(([k,forms])=>[k,[...forms].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0][0]]));
  return items.map(item=>Array.isArray(item?.[field])?{...item,[field]:[...new Set(item[field].map(v=>best.get(keyOf(v))||v))]}:item);
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
