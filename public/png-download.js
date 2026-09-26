(()=>{
  const enc=new TextEncoder();
  const safeName=v=>String(v||"Character").replace(/[\\/:*?"<>|]+/g,"-").replace(/\s+/g," ").trim().slice(0,100)||"Character";
  const crc32=a=>{let c=0xffffffff;for(const b of a){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0};
  const u32=n=>new Uint8Array([(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]);
  const cat=ps=>{let n=ps.reduce((s,p)=>s+p.length,0),o=new Uint8Array(n),i=0;for(const p of ps){o.set(p,i);i+=p.length}return o};
  const chunk=(t,d)=>{const x=enc.encode(t);return cat([u32(d.length),x,d,u32(crc32(cat([x,d])))])};
  const b64=s=>{const a=enc.encode(s);let x="";for(let i=0;i<a.length;i+=32768)x+=String.fromCharCode(...a.subarray(i,i+32768));return btoa(x)};
  const embed=(buf,card)=>{const p=new Uint8Array(buf),parts=[p.slice(0,8)],data=enc.encode("chara\0"+b64(JSON.stringify(card)));let o=8,done=false;while(o+12<=p.length){const l=((p[o]<<24)|(p[o+1]<<16)|(p[o+2]<<8)|p[o+3])>>>0,e=o+12+l,t=String.fromCharCode(...p.slice(o+4,o+8));if(t==="IEND"&&!done){parts.push(chunk("tEXt",data));done=true}parts.push(p.slice(o,e));o=e}if(!done)throw new Error("PNG_IEND_MISSING");return cat(parts)};
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const toast=msg=>{let el=document.getElementById("cardDownloadToast");if(!el){el=document.createElement("div");el.id="cardDownloadToast";Object.assign(el.style,{position:"fixed",right:"18px",bottom:"18px",zIndex:"99999",padding:"10px 14px",background:"#101510",border:"1px solid #59664f",color:"#dfe7d4",font:"12px var(--font-mono)",boxShadow:"0 8px 30px rgba(0,0,0,.35)"});document.body.appendChild(el)}el.textContent=msg;el.hidden=false;clearTimeout(el._t);el._t=setTimeout(()=>el.hidden=true,2600)};
  function filenameFromDisposition(value,fallback){
    const raw=String(value||"");
    const star=raw.match(/filename\*=UTF-8''([^;]+)/i);
    if(star){try{return decodeURIComponent(star[1].trim())}catch{}}
    const plain=raw.match(/filename="?([^";]+)"?/i);
    return plain?.[1]?.trim()||fallback;
  }
  function cardFilename(card,ext){
    const name=String(card?.data?.name||"Character").trim(),creator=String(card?.data?.creator||"").trim();
    return safeName(creator?`${name}_${creator}`:name)+ext;
  }
  const partialCard=card=>card?.data?.extensions?.archive_exe?.export_quality==="partial"||card?.data?.extensions?.archive_exe?.definition_available===false;
  function saveBlob(blob,filename){
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.style.display="none";
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  }
  async function fetchReadyCard(uuid,onWait){
    let lastState=null;
    for(let attempt=0;attempt<12;attempt++){
      const res=await fetch(`/api/characters/${uuid}/card`,{cache:"no-store"});
      if(res.status===200){
        const card=await res.json().catch(()=>null);
        if(!card?.data)throw new Error("INVALID_CARD_JSON");
        return{card,response:res};
      }
      const data=await res.json().catch(()=>({}));
      if(res.status!==202)throw new Error(data.state||data.error||`CARD_HTTP_${res.status}`);
      lastState=data;
      if(attempt===11){const err=new Error("CARD_STILL_PROCESSING");err.state=lastState;throw err}
      onWait?.(data,attempt+1);
      const retry=Math.min(Math.max(Number(data.retryAfterSeconds||res.headers.get("retry-after")||5),1),10);
      await sleep(retry*1000);
    }
    const err=new Error("CARD_STILL_PROCESSING");err.state=lastState;throw err;
  }
  async function downloadJson(url,trigger){
    const m=String(url).match(/\/api\/characters\/([0-9a-f-]{36})\/card(?:[?#]|$)/i);if(!m)return false;
    const uuid=m[1].toLowerCase(),old=trigger?.textContent;
    try{
      if(trigger){trigger.dataset.downloadBusy="1";trigger.textContent="PREPARING JSON…"}
      toast("PREPARING JSON CARD…");
      const {card,response}=await fetchReadyCard(uuid,()=>{if(trigger)trigger.textContent="WAITING FOR CARD…";toast("CARD IS PROCESSING…")});
      const fallback=cardFilename(card,".json"),filename=filenameFromDisposition(response.headers.get("content-disposition"),fallback);
      saveBlob(new Blob([JSON.stringify(card,null,2)],{type:"application/json"}),filename);
      toast(partialCard(card)?"PARTIAL CARD — DEFINITION UNAVAILABLE":"JSON CARD DOWNLOADED ✓");return true;
    }catch(err){
      console.error("JSON download failed",err);
      toast(err?.message==="CARD_STILL_PROCESSING"?"CARD STILL PROCESSING — TRY AGAIN":"JSON DOWNLOAD FAILED");
      return false;
    }finally{if(trigger){delete trigger.dataset.downloadBusy;if(old!=null)trigger.textContent=old}}
  }
  async function downloadPng(url,trigger){
    const m=String(url).match(/\/api\/characters\/([0-9a-f-]{36})\/card\.png(?:[?#]|$)/i);if(!m)return false;
    const uuid=m[1].toLowerCase(),old=trigger?.textContent;
    try{
      if(trigger){trigger.dataset.downloadBusy="1";trigger.textContent="BUILDING PNG…"}
      toast("BUILDING PNG CARD…");
      const {card}=await fetchReadyCard(uuid,()=>{if(trigger)trigger.textContent="WAITING FOR CARD…";toast("CARD IS PROCESSING…")});
      const avatar=card?.data?.extensions?.archive_exe?.avatar_url;
      if(!avatar)throw new Error("NO_AVATAR");
      const imgRes=await fetch(`/api/image-proxy?url=${encodeURIComponent(avatar)}`,{cache:"no-store"});
      if(!imgRes.ok)throw new Error(`IMAGE_HTTP_${imgRes.status}`);
      const blob=await imgRes.blob(),bitmap=await createImageBitmap(blob);
      const canvas=document.createElement("canvas");canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext("2d").drawImage(bitmap,0,0);bitmap.close?.();
      const pngBlob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("PNG_ENCODE_FAILED")),"image/png"));
      const bytes=embed(await pngBlob.arrayBuffer(),card);
      saveBlob(new Blob([bytes],{type:"image/png"}),cardFilename(card,".png"));
      toast(partialCard(card)?"PARTIAL CARD — DEFINITION UNAVAILABLE":"PNG CARD DOWNLOADED ✓");return true;
    }catch(err){
      console.error("PNG download failed",err);
      toast(err?.message==="CARD_STILL_PROCESSING"?"CARD STILL PROCESSING — TRY AGAIN":"PNG DOWNLOAD FAILED");
      return false;
    }finally{if(trigger){delete trigger.dataset.downloadBusy;if(old!=null)trigger.textContent=old}}
  }
  document.addEventListener("click",e=>{
    const a=e.target.closest?.('a[href*="/api/characters/"]');if(!a||a.dataset.downloadBusy)return;
    const href=String(a.href||"");
    if(/\/card\.png(?:[?#]|$)/i.test(href)){e.preventDefault();e.stopPropagation();downloadPng(href,a);return}
    if(/\/card(?:[?#]|$)/i.test(href)){e.preventDefault();e.stopPropagation();downloadJson(href,a)}
  },true);
  window.ARCHIVE_DOWNLOAD_PNG=downloadPng;
  window.ARCHIVE_DOWNLOAD_JSON=downloadJson;
})();
