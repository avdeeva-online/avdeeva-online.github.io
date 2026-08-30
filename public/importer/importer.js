
const $=s=>document.querySelector(s);
let raw=null, janitorUrl="", uuid="", intros=[];

function setBridge(ok){
  const b=$("#bridgeBadge");
  b.textContent=ok?"BRIDGE ONLINE":"BRIDGE OFFLINE";
  b.className="badge "+(ok?"good":"bad");
}
function resetLog(){ $("#status").textContent=""; }
function log(s){ $("#status").textContent += ($("#status").textContent?"\n":"")+s; }
function getUuid(v){ return (v.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)||[])[0]?.toLowerCase()||""; }
function stripHtml(v){
  if(!v)return "";
  const d=document.createElement("div"); d.innerHTML=String(v);
  d.querySelectorAll("br").forEach(x=>x.replaceWith("\n"));
  d.querySelectorAll("p,div,li,h1,h2,h3").forEach(x=>x.append("\n"));
  return (d.textContent||"").replace(/\n{3,}/g,"\n\n").replace(/[ \t]+\n/g,"\n").trim();
}
function walk(obj, fn, path=[]){
  if(!obj||typeof obj!=="object")return;
  fn(obj,path);
  for(const [k,v] of Object.entries(obj)) if(v&&typeof v==="object") walk(v,fn,path.concat(k));
}
function chooseCard(root){
  let best={score:-1,obj:root,path:[]};
  walk(root,(o,p)=>{
    let s=0; const keys=Object.keys(o).map(x=>x.toLowerCase());
    for(const k of ["name","description","personality","scenario","first_mes","first_message","mes_example","alternate_greetings","creator_notes","tags"]){
      if(keys.includes(k)) s += (k==="first_mes"||k==="scenario")?4:2;
    }
    if(keys.includes("data") && o.data && typeof o.data==="object") s+=2;
    if(s>best.score) best={score:s,obj:o,path:p};
  });
  if(best.obj?.data && typeof best.obj.data==="object"){
    const d=best.obj.data, keys=Object.keys(d).map(x=>x.toLowerCase());
    if(keys.some(k=>["description","scenario","first_mes","first_message"].includes(k))) return d;
  }
  return best.obj;
}
function findFirst(root,names){
  const wanted=new Set(names.map(x=>x.toLowerCase())); let out;
  walk(root,o=>{
    if(out!==undefined)return;
    for(const [k,v] of Object.entries(o)){
      if(wanted.has(k.toLowerCase()) && v!=null && String(v).trim()!==""){ out=v; return; }
    }
  });
  return out;
}
function arr(v){
  if(Array.isArray(v))return v;
  if(v==null||v==="")return [];
  return [v];
}
function text(v){
  if(v==null)return "";
  if(Array.isArray(v))return v.map(x=>typeof x==="object"?(x.name||x.label||JSON.stringify(x)):x).join(", ");
  return typeof v==="object" ? JSON.stringify(v) : String(v);
}
function pickImage(root){
  let candidate=findFirst(root,["avatar","avatar_url","avatarUrl","image","image_url","imageUrl","thumbnail","media_url","mediaUrl"]);
  if(typeof candidate==="object") candidate=candidate?.url||candidate?.src||candidate?.path;
  if(candidate && /^https?:/i.test(candidate))return candidate;
  // fallback: scan all strings for datacat media
  let found="";
  walk(root,o=>{
    if(found)return;
    for(const v of Object.values(o)){
      if(typeof v==="string" && /^https?:\/\/[^ ]+\.(png|jpe?g|webp)(\?|$)/i.test(v)){found=v;break}
    }
  });
  return found;
}
function detectLorebook(root){
  let yes=false;
  walk(root,o=>{
    const ks=Object.keys(o).map(k=>k.toLowerCase());
    if(ks.some(k=>["character_book","characterbook","lorebook","worldbook","world_info","worldinfo"].includes(k))){
      const v=Object.values(o)[ks.findIndex(k=>["character_book","characterbook","lorebook","worldbook","world_info","worldinfo"].includes(k))];
      if(v && ((Array.isArray(v)&&v.length)||typeof v==="object"))yes=true;
    }
  });
  return yes;
}
function fill(root){
  raw=root;
  const card=chooseCard(root);

  const name=card.name ?? findFirst(root,["character_name","characterName","name","title"]);
  const author=card.creator ?? card.author ?? findFirst(root,["creator_name","creatorName","author","username"]);
  const tags=card.tags ?? findFirst(root,["tags","tag_names","tagNames"]);
  const desc=card.description ?? card.personality ?? findFirst(root,["definition","description","personality"]);
  const scenario=card.scenario ?? findFirst(root,["scenario"]);
  const first=card.first_mes ?? card.first_message ?? findFirst(root,["first_mes","first_message","firstMessage","greeting","opening"]);
  const alt=card.alternate_greetings ?? card.alternateGreetings ?? findFirst(root,["alternate_greetings","alternateGreetings","alternative_greetings"]);

  $("#name").value=stripHtml(text(name));
  $("#author").value=stripHtml(text(author));
  $("#tags").value=text(tags);
  $("#description").value=stripHtml(text(desc));
  $("#scenario").value=stripHtml(text(scenario));

  intros=[first,...arr(alt)].filter(Boolean).map(x=>stripHtml(text(x)));
  $("#introSelect").innerHTML="";
  if(!intros.length) intros=[""];
  intros.forEach((x,i)=>{
    const op=document.createElement("option"); op.value=i; op.textContent=`INTRO ${String(i+1).padStart(2,"0")}`; $("#introSelect").append(op);
  });
  $("#intro").value=intros[0]||"";

  const image=pickImage(root);
  if(image){
    $("#previewImage").src=image; $("#previewImage").style.display="block"; $("#imageEmpty").style.display="none";
  } else {
    $("#previewImage").style.display="none"; $("#imageEmpty").style.display="";
  }
  $("#uuidOut").textContent=uuid||"—";
  $("#sourceOut").textContent="DATACAT / JANITOR";
  $("#loreOut").textContent=detectLorebook(root)?"FOUND":"NOT FOUND";
  $("#saveDraft").disabled=false; $("#showRaw").disabled=false;
}
$("#introSelect").addEventListener("change",()=>{
  const i=Number($("#introSelect").value); $("#intro").value=intros[i]||"";
});
$("#intro").addEventListener("input",()=>{ intros[Number($("#introSelect").value)||0]=$("#intro").value; });

window.addEventListener("message",e=>{
  if(e.source!==window || !e.data || e.data.channel!=="ARCHIVE_IMPORTER_BRIDGE")return;
  if(e.data.type==="BRIDGE_READY"){setBridge(true);return}
  if(e.data.type==="STATUS"){log(e.data.text);return}
  if(e.data.type==="RESULT"){
    log("DATACAT RECORD .......... READY");
    fill(e.data.data);
    log("REVIEW DATA ............. PARSED");
    return;
  }
  if(e.data.type==="ERROR"){log("ERROR ................... "+e.data.message);}
});
window.postMessage({channel:"ARCHIVE_IMPORTER_PAGE",type:"PING"},"*");

$("#resolveBtn").addEventListener("click",()=>{
  resetLog();
  janitorUrl=$("#janitorUrl").value.trim(); uuid=getUuid(janitorUrl);
  if(!uuid){log("ERROR ................... JANITOR UUID NOT FOUND");return}
  $("#uuidOut").textContent=uuid;
  log("JANITOR UUID ............ "+uuid);
  if($("#bridgeBadge").textContent!=="BRIDGE ONLINE"){
    log("BRIDGE .................. OFFLINE");
    log("Установи/включи ARCHIVE IMPORTER BRIDGE и обнови страницу.");
    return;
  }
  window.postMessage({channel:"ARCHIVE_IMPORTER_PAGE",type:"RESOLVE",janitorUrl,uuid},"*");
});
$("#showRaw").addEventListener("click",()=>{
  $("#rawJson").textContent=JSON.stringify(raw,null,2);
  $("#rawJson").classList.toggle("hidden");
  $("#showRaw").textContent=$("#rawJson").classList.contains("hidden")?"SHOW RAW JSON":"HIDE RAW JSON";
});
$("#clearBtn").addEventListener("click",()=>{
  for(const s of ["#name","#author","#pov","#tags","#universe","#short","#description","#scenario","#intro","#hashtags"])$(s).value="";
  $("#janitorUrl").value=""; $("#status").textContent="READY."; raw=null; intros=[]; $("#saveDraft").disabled=true;$("#showRaw").disabled=true;
});
$("#saveDraft").addEventListener("click",()=>{
  const draft={
    janitorId:uuid, janitorUrl,
    nameEn:$("#name").value, nameRu:"",
    author:$("#author").value, authorUrl:"",
    universe:$("#universe").value,
    pov:$("#pov").value,
    tags:$("#tags").value.split(",").map(s=>s.trim()).filter(Boolean),
    short:$("#short").value,
    full:$("#description").value,
    scenario:$("#scenario").value,
    intros:intros.filter(Boolean),
    hashtags:$("#hashtags").value.split(",").map(s=>s.trim().replace(/^#/,"")).filter(Boolean),
    platform:"JANITOR",
    lorebook:$("#loreOut").textContent==="FOUND",
    reviewRequired:true
  };
  const blob=new Blob([JSON.stringify(draft,null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download=`archive-draft-${uuid||"character"}.json`; a.click(); URL.revokeObjectURL(a.href);
});
