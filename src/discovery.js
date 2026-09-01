const clean = value => String(value ?? '').replace(/\s+/g,' ').trim();
const fold = value => clean(value).toLocaleLowerCase();

export const SETTING_DEFINITIONS = [
  {id:'omegaverse',label:'Omegaverse',aliases:['abo','a/b/o','alpha beta omega'],any:[/\bomegaverse\b/i,/\ba\/?b\/?o\b/i,/alpha\s*[\/·,]\s*beta\s*[\/·,]\s*omega/i,/secondary genders?/i,/\bgo(?:es|ing)? into (?:rut|heat)\b/i,/\b(?:rut|heat) cycle\b/i,/\bmate mark(?:s|ing|ed)?\b/i,/\bbreeder\b/i]},
  {id:'post-apocalypse',label:'Post-apocalypse',aliases:['post apocalypse','postapocalypse','апокалипсис','постапокалипсис'],any:[/post[- ]?apocal/i,/постапокалип/i,/after (?:the )?(?:collapse|fall|apocalypse)/i,/nuclear fallout/i,/\bwasteland\b/i]},
  {id:'zombie-apocalypse',label:'Zombie apocalypse',parent:'post-apocalypse',aliases:['zombie apocalypse','зомби апокалипсис'],any:[/zombie.?apocal/i,/зомби.?апокалип/i,/\bzombies?\b/i,/\bundead\b/i,/\bhorde\b/i]},
  {id:'rusreal',label:'Rusreal',aliases:['русреал','russian realism','modern russia','современная россия'],any:[/\bрусреал\b/i,/\brusreal\b/i,/russian realism/i,/\b(?:russia|moscow)\b/i,/\b(?:росси[яи]|москв[аеыу])\b/i]},
  {id:'rusreal-2000s',label:'2000s Rusreal',parent:'rusreal',aliases:['нулевые','2000s russia','россия нулевых'],all:[/(?:\b200\d\b|\b2000s\b|нулев(?:ые|ых))/i,/(?:rusreal|русреал|russia|росси|moscow|москв)/i]},
  {id:'china',label:'China',aliases:['китай','chinese setting'],any:[/\bchina\b/i,/\bchinese\b/i,/\bкита[йяе]\b/i,/\b(?:wuxia|xianxia)\b/i,/\bcultivation\b/i]},
  {id:'ancient-china',label:'Ancient China',parent:'china',aliases:['древний китай','imperial china','historical china'],all:[/(?:ancient|imperial|historical|dynasty|древн|импер|династ)/i,/(?:china|chinese|кита|wuxia|xianxia|cultivation)/i]},
  {id:'egypt',label:'Egypt',aliases:['египет','egyptian setting'],any:[/\begypt\b/i,/\begyptian\b/i,/\bегип/i]},
  {id:'ancient-egypt',label:'Ancient Egypt',parent:'egypt',aliases:['древний египет'],all:[/(?:ancient|pharaoh|древн|фараон)/i,/(?:egypt|egyptian|егип)/i]},
  {id:'medieval',label:'Medieval',aliases:['middle ages','средневековье'],any:[/\bmedieval\b/i,/middle ages/i,/средневек/i]},
  {id:'regency',label:'Regency',aliases:['regency era'],any:[/\bregency\b/i,/бриджертон/i,/\bbridgerton\b/i]},
  {id:'victorian',label:'Victorian',aliases:['victorian era'],any:[/\bvictorian\b/i,/викториан/i]},
  {id:'historical',label:'Historical',aliases:['historical setting','исторический сеттинг'],any:[/historical (?:au|setting|romance)/i,/историческ(?:ий|ая|ое) (?:сеттинг|роман)/i]},
  {id:'fantasy',label:'Fantasy',aliases:['фэнтези'],any:[/\bfantasy\b/i,/\bфэнтези\b/i,/\bmagic kingdom\b/i]},
  {id:'sci-fi',label:'Sci-Fi',aliases:['science fiction','научная фантастика'],any:[/\bsci[- ]?fi\b/i,/science fiction/i,/научн(?:ая|ой) фантаст/i,/\bintergalactic\b/i]},
  {id:'cyberpunk',label:'Cyberpunk',aliases:['киберпанк'],any:[/\bcyberpunk\b/i,/\bкиберпанк\b/i,/neon dystopia/i]},
  {id:'supernatural',label:'Supernatural',aliases:['urban fantasy','сверхъестественное'],any:[/\bsupernatural\b/i,/urban fantasy/i,/сверхъестествен/i]},
  {id:'college',label:'College / University',aliases:['college','university','университет','колледж'],any:[/\b(?:college|university) (?:students?|roommates?|roomies|professors?|teachers?|classmates?|campus|courses?|lectures?|classes?|life|housing|dorms?|parties|setting|au)\b/i,/\b(?:students?|roommates?|roomies|professors?|teachers?|classmates?) (?:at|in|from) (?:a |the )?(?:college|university)\b/i,/\b(?:campus|dormitory|dorm room|fraternity|sorority)\b/i,/\bhale university\b/i,/\b[A-Z][A-Z' -]{2,30} UNIVERSITY\b/,/университетск|студент.{0,18}университет|колледж.{0,18}(?:студент|общежит|сосед)/i]},
  {id:'high-school',label:'High school',aliases:['school setting','старшая школа'],any:[/\bhigh school\b/i,/\bschool setting\b/i,/старш(?:ая|ей) школ/i]},
  {id:'mafia',label:'Mafia / Crime',aliases:['mafia','organized crime','криминал'],any:[/\bmafia\b/i,/organized crime/i,/crime family/i,/\bsyndicate\b/i,/\bgang(?:ster)?\b/i,/\bмафи/i,/криминальн/i]}
];

const definitionById = new Map(SETTING_DEFINITIONS.map(x=>[x.id,x]));
function isDescendant(childId,parentId){let current=definitionById.get(childId);while(current?.parent){if(current.parent===parentId)return true;current=definitionById.get(current.parent)}return false}
const descendants = id => SETTING_DEFINITIONS.filter(x=>isDescendant(x.id,id));

export function inferSettingIds(source,row={}){
  const scripts=Array.isArray(source?.scripts)?source.scripts:[];
  // Full imported descriptions frequently end with promotional lists for other
  // bots. Restrict automatic classification to fields that describe this
  // record directly, otherwise a promo for a university/mafia bot pollutes it.
  const parts=[source?.name,source?.chat_name,source?.scenario,row?.name,row?.short_description,row?.scenario,row?.universe,...jsonArray(row?.tags),...jsonArray(row?.hashtags),...jsonArray(row?.intros),...scripts.map(x=>x?.title)];
  const text=parts.filter(Boolean).join('\n');
  const matched=SETTING_DEFINITIONS.filter(def=>{
    if(def.all?.length && def.all.every(re=>re.test(text)))return true;
    return Boolean(def.any?.some(re=>re.test(text)));
  }).map(x=>x.id);
  const set=new Set(matched);
  return matched.filter(id=>!descendants(id).some(child=>set.has(child.id)));
}

export function settingLabels(ids){return jsonArray(ids).map(id=>definitionById.get(id)?.label).filter(Boolean)}

export function cleanUniverse(value){
  const universe=clean(value);
  if(!universe || /^(?:unclassified|unknown|none|null|n\/?a|setting|universe|world)\s*:?$/i.test(universe) || universe.length>80)return'';
  return universe;
}

export function universeKey(value){return fold(cleanUniverse(value))}

export function resolveUniverseRows(rows){
  const linked=new Map();
  for(const row of rows){
    row._lorebookKeys=clean(row.lorebook_keys).split(',').map(clean).filter(Boolean);
    for(const key of row._lorebookKeys){if(!linked.has(key))linked.set(key,[]);linked.get(key).push(row)}
  }
  for(const row of rows){
    const explicit=cleanUniverse(row.universe);
    if(explicit){row.resolved_universe=explicit;row.resolved_universe_source=row.universe_source_field||'source';continue}
    const candidates=new Map();
    for(const loreKey of row._lorebookKeys){
      const values=new Map();
      for(const peer of linked.get(loreKey)||[]){if(fold(row.author)&&fold(peer.author)!==fold(row.author))continue;const value=cleanUniverse(peer.universe),key=universeKey(value);if(key)values.set(key,value)}
      if(values.size!==1)continue;
      const [key,value]=values.entries().next().value,current=candidates.get(key)||{value,votes:0};
      current.votes++;candidates.set(key,current);
    }
    if(candidates.size===1){const winner=candidates.values().next().value;row.resolved_universe=winner.value;row.resolved_universe_source=`lorebook:${winner.votes}`}
    else{row.resolved_universe='';row.resolved_universe_source=''}
  }
  return rows;
}

export function jsonArray(value){
  if(Array.isArray(value))return value;
  try{const parsed=JSON.parse(value||'[]');return Array.isArray(parsed)?parsed:[]}catch{return[]}
}
