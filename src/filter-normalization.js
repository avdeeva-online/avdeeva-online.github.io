const clean=value=>String(value??'').replace(/\s+/g,' ').trim();

// One spelling per hashtag, author and tag — applied on import, DataCat re-check, admin save and public output,
// so a re-import can never bring an old spelling back. Agreed with the admin 2026-09-28.
// Hashtags are always lower case; typos and same-meaning variants map to one word.
const HASHTAG_ALIASES=new Map(Object.entries({
  agegape:'agegap',agegaprelationship:'agegap',agegapromance:'agegap',
  postapocalpyse:'postapocalyptic',postapocalpytic:'postapocalyptic',
  zombieapacolypse:'zombieapocalypse',
  toxicrelashionship:'toxicrelationship',
  secretrelathionship:'secretrelationship',
  omegavers:'omegaverse',
  myheroacadamia:'myheroacademia',mha:'myheroacademia',
  olderbrothersbestfrie:'olderbrothersbestfriend',
  vincericcardosyndicat:'vincericcardosyndicate',
  naivebutagressive:'naivebutaggressive',
  kinktobe2024:'kinktober',
  '2000':'2000s',
  greekgods:'greekgod',
  hurtandcomfort:'hurtcomfort',
  darkromantic:'darkromance',
  afo:'allforone',
  draco:'dracomalfoy',
  oldercharxyoungeruser:'olderchar',youngercharxolderuser:'olderchar',
  olderuserxyoungerchar:'olderuser',
  studentxprofessor:'professorandstudent',
  japanese:'japan',
  bestfriendchar:'bestfriend'
}));
export function canonicalHashtag(value){const v=clean(value).replace(/^#+\s*/,'').toLocaleLowerCase();return HASHTAG_ALIASES.get(v)||v}

// Author names: same person, one spelling.
const AUTHOR_ALIASES=new Map(Object.entries({koisimm:'KOISIMM',sepha:'SEPHA'}));
export function canonicalAuthor(value){const v=clean(value);return AUTHOR_ALIASES.get(v.toLocaleLowerCase())||v}

export function normalizeHashtags(values){
  const list=Array.isArray(values)?values:[],seen=new Set(),out=[];
  for(const raw of list){
    const value=canonicalHashtag(raw);
    if(!value||seen.has(value))continue;
    seen.add(value);out.push(value);
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

export const hashtagKey=value=>canonicalHashtag(value);
// Tags that differ only by their emoji ("👨 Male" / "👨‍🦰 Male") are written one way.
const TAG_CANONICAL=new Map([['male','👨 Male']]);

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
    const key=semanticTagKey(raw);
    const value=TAG_CANONICAL.get(key)||clean(raw);
    if(!value||!key||seen.has(key))continue;
    seen.add(key);out.push(value);
  }
  return out;
}
