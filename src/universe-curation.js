const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
export const universeKey=v=>clean(v).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');

function uniq(values){
  const out=[],seen=new Set();
  for(const raw of values||[]){const value=clean(raw),key=universeKey(value);if(!value||!key||seen.has(key))continue;seen.add(key);out.push(value)}
  return out;
}

function replacementsFor(value,row={}){
  const raw=clean(value),key=universeKey(raw),nameKey=universeKey(row?.name||'');

  // Confirmed manual curation only. These rules normalize already-existing
  // universe labels; they never infer a universe from a title or hashtag.
  if(key.startsWith('thewild')&&key.includes('aka'))return['The Wild'];
  if(key.includes('demigods')&&key.includes('greekgod'))return['Demi Gods'];
  if(key==='helluniversityxvdb')return['Hell University'];
  if(key.includes('thewild')&&key.includes('miniseries'))return['Hell University','HellU Titans'];
  if(key==='endplot')return['The Wild'];
  if(key==='birthdaybot')return['Kingtober'];
  if(key==='bayucrewandvoodooboys'||key==='bayucrewxvoodooboys')return['Bayu Crew','Voodoo Boys'];
  if(key==='voodooboysxbayoucrew'||key==='voodooboysandbayoucrew')return['Voodoo Boys','Bayu Crew'];
  if(key==='thefirmxthevalentinos'||key==='valentinosxthefirm')return['The Firm','Valentinos'];
  if(key.startsWith('intergalacticbydavyandcepha'))return['Intergalactic','Collabs'];
  if(key==='crownrecordsrappercollab')return['Collabs'];
  if(key==='fourhorsemencollab')return['Collabs'];
  if(key==='footballfightboyscollab')return['Collabs'];
  if(key==='ledgercollab')return['Collabs'];
  if(key==='bridgertoninspiredcollab')return['Bridgerton','Collabs'];
  if(key==='bridgertoninspiredau')return['Bridgerton'];
  if(key==='hellu'){
    if(nameKey.includes('ashton')&&nameKey.includes('dewald'))return['Hell University','DeWald'];
    return['Hell University'];
  }
  if(key==='helluuniversityoutcasts')return['Hell University'];
  if(key.includes('hellvalkyries')&&key.includes('woman'))return['Hell University'];
  if(key.startsWith('dewaldbotsmadeespeciallyfor'))return['DeWald'];
  if(key==='waltbotsmadeforme')return['DeWald'];
  if(key==='aualt'&&nameKey.includes('emilio')&&nameKey.includes('royal'))return['Bayu Crew Next Gen'];
  return[raw];
}

export function curateUniverses(row,values){
  const expanded=[];
  for(const value of values||[])expanded.push(...replacementsFor(value,row));
  return uniq(expanded);
}

export const UNIVERSE_REVIEW_FLAGS=[
  ['B-Y-C Next Gen','Needs review: appears attached to Hell University records.'],
  ['Janitor Cup','Needs review: likely a collaboration grouping.'],
  ['SAC Universe Noncanon','Leave as-is until reviewed.'],
  ['SAC Noncanon','Leave as-is until reviewed.'],
  ['SUVA University','Leave as-is until reviewed.'],
  ['The Group Chat','Leave as-is until reviewed.'],
  ["Vince Ricardo's Syndicate",'Leave as-is; different author / unresolved structure.']
];
