const isPng=bytes=>bytes?.length>8&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10;
const u32=(bytes,offset)=>((bytes[offset]<<24)|(bytes[offset+1]<<16)|(bytes[offset+2]<<8)|bytes[offset+3])>>>0;
const text=bytes=>new TextDecoder().decode(bytes);

function decodeCardPayload(value){
  const raw=String(value||'').trim();
  if(!raw)return null;
  let jsonText=raw;
  if(!raw.startsWith('{')){
    try{const binary=atob(raw);const bytes=Uint8Array.from(binary,ch=>ch.charCodeAt(0));jsonText=text(bytes)}catch{return null}
  }
  try{const card=JSON.parse(jsonText);return card&&typeof card==='object'&&card.data&&typeof card.data==='object'?card:null}catch{return null}
}

export function extractEmbeddedCard(input){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input||0);
  if(!isPng(bytes))return null;
  let offset=8;
  while(offset+12<=bytes.length){
    const length=u32(bytes,offset),dataStart=offset+8,end=dataStart+length;
    if(length>16*1024*1024||end+4>bytes.length)return null;
    const type=text(bytes.subarray(offset+4,offset+8));
    if(type==='tEXt'){
      const data=bytes.subarray(dataStart,end),zero=data.indexOf(0);
      if(zero>0&&text(data.subarray(0,zero))==='chara')return decodeCardPayload(text(data.subarray(zero+1)));
    }
    if(type==='iTXt'){
      const data=bytes.subarray(dataStart,end),keywordEnd=data.indexOf(0);
      if(keywordEnd>0&&text(data.subarray(0,keywordEnd))==='chara'){
        let cursor=keywordEnd+3;
        for(let field=0;field<2;field++){const next=data.indexOf(0,cursor);if(next<0){cursor=-1;break}cursor=next+1}
        if(cursor>=0&&data[keywordEnd+1]===0)return decodeCardPayload(text(data.subarray(cursor)));
      }
    }
    offset=end+4;
    if(type==='IEND')break;
  }
  return null;
}

const field=(data,...names)=>{for(const name of names){const value=data?.[name];if(typeof value==='string'&&value.trim())return value.trim()}return''};
export function definitionFromEmbeddedCard(card){
  const data=card?.data||card||{},alternate=data.alternate_greetings||data.alternateGreetings||data.alt_greetings||[];
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:null;
  return{
    name:field(data,'name'),
    description:field(data,'description','char_persona'),
    personality:field(data,'personality'),
    firstMes:field(data,'first_mes','first_message','greeting','char_greeting'),
    scenario:field(data,'scenario','world_scenario'),
    mesExample:field(data,'mes_example','example_dialogue'),
    creatorNotes:field(data,'creator_notes','creatorNotes'),
    systemPrompt:field(data,'system_prompt','systemPrompt'),
    postHistoryInstructions:field(data,'post_history_instructions','postHistoryInstructions'),
    alternateGreetings:Array.isArray(alternate)?alternate.filter(value=>typeof value==='string'&&value.trim()).map(value=>value.trim()):[],
    tags:Array.isArray(data.tags)?data.tags.filter(value=>typeof value==='string'&&value.trim()).map(value=>value.trim()):[],
    creator:field(data,'creator'),
    characterVersion:field(data,'character_version','characterVersion'),
    characterBook:object(data.character_book||data.characterBook),
    extensions:object(data.extensions)||{}
  };
}

export async function fetchJannySource(uuid){
  try{
    const response=await fetch('https://api.jannyai.com/api/v1/download',{method:'POST',headers:{'content-type':'application/json','accept':'application/json','user-agent':'ARCHIVE.EXE/2.0'},body:JSON.stringify({characterId:uuid}),redirect:'follow'});
    if(!response.ok)return{ok:false,state:`JANNY_HTTP_${response.status}`};
    const data=await response.json(),downloadUrl=data?.downloadUrl||data?.download_url;
    if(!downloadUrl)return{ok:false,state:'JANNY_NO_DOWNLOAD_URL'};
    const file=await fetch(downloadUrl,{redirect:'follow'});
    if(!file.ok)return{ok:false,state:`JANNY_FILE_HTTP_${file.status}`};
    const bytes=new Uint8Array(await file.arrayBuffer());
    return isPng(bytes)?{ok:true,bytes,card:extractEmbeddedCard(bytes)}:{ok:false,state:'JANNY_FILE_NOT_PNG'};
  }catch(e){return{ok:false,state:'JANNY_FETCH_ERROR',detail:String(e?.message||e)}}
}
