// Lorebook downloads are served as SillyTavern World Info ({entries:{"0":{uid,key,keysecondary,comment,content,…}}}),
// the format DataCat hands out and the one SillyTavern, Tavo and our LoreKey translator import.
// The source script from Janitor/DataCat can arrive as World Info already (kept untouched), as a card's
// character_book (entries[] with keys / secondary_keys), as a bare entries array, or JSON-encoded twice.

const isObj=v=>v&&typeof v==='object'&&!Array.isArray(v);
const text=v=>typeof v==='string'?v:v==null?'':String(v);
const num=(v,f)=>{const n=Number(v);return Number.isFinite(n)?n:f};
const bool=(v,f)=>typeof v==='boolean'?v:f;
function keyList(v){if(Array.isArray(v))return v.map(x=>text(x).trim()).filter(Boolean);if(typeof v==='string')return v.split(',').map(x=>x.trim()).filter(Boolean);return[]}
function pick(o,names){for(const n of names)if(o[n]!==undefined&&o[n]!==null)return o[n];return undefined}

function decode(raw){let v=raw;for(let i=0;i<3&&typeof v==='string';i++){try{v=JSON.parse(v)}catch{return v}}return v}

// Where the entries live: the root, a card / character_book wrapper, or a bare array.
function entriesOf(v){
  if(Array.isArray(v))return v;
  if(!isObj(v))return null;
  for(const box of [v,v.data?.character_book,v.character_book,v.data,v.lorebook,v.book,v.world_info,v.worldInfo]){
    if(!isObj(box))continue;
    for(const k of ['entries','items','lore','lorebook_entries'])if(Array.isArray(box[k])||isObj(box[k]))return box[k];
  }
  return null;
}
const isWorldInfo=v=>isObj(v)&&isObj(v.entries)&&Object.values(v.entries).every(e=>isObj(e)&&Array.isArray(e.key));

const POSITIONS={before_char:0,after_char:1,an_top:2,an_bottom:3,at_depth:4,em_top:5,em_bottom:6};
function worldEntry(src,uid){
  const e=isObj(src)?src:{content:text(src)},ext=isObj(e.extensions)?e.extensions:{};
  const secondary=keyList(pick(e,['keysecondary','secondary_keys','secondaryKeys','secondary_key','secondary']));
  const rawPos=pick(ext,['position'])??pick(e,['position']);
  const position=typeof rawPos==='string'?(POSITIONS[rawPos]??0):num(rawPos,0);
  const disabled=typeof e.disable==='boolean'?e.disable:typeof e.enabled==='boolean'?!e.enabled:false;
  return{
    uid,
    key:keyList(pick(e,['key','keys','keywords','triggers','trigger_words','activation_keys'])),
    keysecondary:secondary,
    comment:text(pick(e,['comment','name','title','memo'])),
    content:text(pick(e,['content','text','entry','value','description'])),
    constant:bool(pick(e,['constant','always_active','alwaysActive']),false),
    vectorized:bool(ext.vectorized,false),
    selective:bool(e.selective,true),
    selectiveLogic:num(pick(ext,['selectiveLogic'])??e.selectiveLogic,0),
    addMemo:true,
    order:num(pick(e,['order','insertion_order','insertionOrder','priority']),100),
    position,
    disable:disabled,
    excludeRecursion:bool(pick(ext,['exclude_recursion'])??e.excludeRecursion,false),
    preventRecursion:bool(pick(ext,['prevent_recursion'])??e.preventRecursion,false),
    delayUntilRecursion:bool(pick(ext,['delay_until_recursion'])??e.delayUntilRecursion,false),
    probability:num(pick(ext,['probability'])??e.probability,100),
    useProbability:bool(pick(ext,['useProbability'])??e.useProbability,true),
    depth:num(pick(ext,['depth'])??e.depth,4),
    group:text(pick(ext,['group'])??e.group),
    groupOverride:bool(pick(ext,['group_override'])??e.groupOverride,false),
    groupWeight:num(pick(ext,['group_weight'])??e.groupWeight,100),
    scanDepth:pick(ext,['scan_depth'])??e.scanDepth??null,
    caseSensitive:pick(ext,['case_sensitive'])??e.case_sensitive??e.caseSensitive??null,
    matchWholeWords:pick(ext,['match_whole_words'])??e.matchWholeWords??null,
    useGroupScoring:pick(ext,['use_group_scoring'])??e.useGroupScoring??null,
    automationId:text(pick(ext,['automation_id'])??e.automationId),
    role:pick(ext,['role'])??e.role??null,
    sticky:num(pick(ext,['sticky'])??e.sticky,0),
    cooldown:num(pick(ext,['cooldown'])??e.cooldown,0),
    delay:num(pick(ext,['delay'])??e.delay,0),
    displayIndex:uid
  };
}

// Returns {ok:true, book} in World Info format, or {ok:false, value} with the decoded source when no entries exist.
export function toWorldInfo(raw,title=''){
  const value=decode(raw);
  if(isWorldInfo(value))return{ok:true,book:value};
  const found=entriesOf(value);
  if(!found)return{ok:false,value};
  const list=Array.isArray(found)?found:Object.values(found),entries={};
  list.forEach((e,i)=>{entries[String(i)]=worldEntry(e,i)});
  const name=text((isObj(value)&&(value.name||value.data?.character_book?.name||value.character_book?.name))||title);
  return{ok:true,book:{...(name?{name}:{}),entries}};
}
