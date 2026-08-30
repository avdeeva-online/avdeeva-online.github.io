(()=>{
  const enc=new TextEncoder();
  const safeName=v=>String(v||"Character").replace(/[\\/:*?"<>|]+/g,"-").replace(/\s+/g," ").trim().slice(0,100)||"Character";
  const crc32=a=>{let c=0xffffffff;for(const b of a){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0};
  const u32=n=>new Uint8Array([(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]);
  const cat=ps=>{let n=ps.reduce((s,p)=>s+p.length,0),o=new Uint8Array(n),i=0;for(const p of ps){o.set(p,i);i+=p.length}return o};
  const chunk=(t,d)=>{const x=enc.encode(t);return cat([u32(d.length),x,d,u32(crc32(cat([x,d])))])};
  const b64=s=>{const a=enc.encode(s);let x="";for(let i=0;i<a.length;i+=32768)x+=String.fromCharCode(...a.subarray(i,i+32768));return btoa(x)};
  const embed=(buf,card)=>{const p=new Uint8Array(buf),parts=[p.slice(0,8)],data=enc.encode("chara\0"+b64(JSON.stringify(card)));let o=8,done=false;while(o+12<=p.length){const l=((p[o]<<24)|(p[o+1]<<16)|(p[o+2]<<8)|p[o+3])>>>0,e=o+12+l,t=String.fromCharCode(...p.slice(o+4,o+8));if(t==="IEND"&&!done){parts.push(chunk("tEXt",data));done=true}parts.push(p.slice(o,e));o=e}if(!done)throw new Error("PNG_IEND_MISSING");return cat(parts)};
  const toast=msg=>{let el=document.getElementById("pngDownloadToast");if(!el){el=document.createElement("div");el.id="pngDownloadToast";Object.assign(el.style,{position:"fixed",right:"18px",bottom:"18px",zIndex:"99999",padding:"10px 14px",background:"#101510",border:"1px solid #59664f",color:"#dfe7d4",font:"12px Consolas,monospace",boxShadow:"0 8px 30px rgba(0,0,0,.35)"});document.body.appendChild(el)}el.textContent=msg;el.hidden=false;clearTimeout(el._t);el._t=setTimeout(()=>el.hidden=true,2200)};
  async function downloadPng(url,trigger){
    const m=String(url).match(/\/api\/characters\/([0-9a-f-]{36})\/card\.png/i);if(!m)return false;
    const uuid=m[1].toLowerCase();
    const old=trigger?.textContent;
    try{
      if(trigger){trigger.dataset.pngBusy="1";trigger.textContent="BUILDING PNG…"}
      toast("BUILDING PNG CARD…");
      const cardRes=await fetch(`/api/characters/${uuid}/card`,{cache:"no-store"});
      if(!cardRes.ok)throw new Error(`CARD_HTTP_${cardRes.status}`);
      const card=await cardRes.json();
      const avatar=card?.data?.extensions?.archive_exe?.avatar_url;
      if(!avatar)throw new Error("NO_AVATAR");
      const imgRes=await fetch(`/api/image-proxy?url=${encodeURIComponent(avatar)}`,{cache:"no-store"});
      if(!imgRes.ok)throw new Error(`IMAGE_HTTP_${imgRes.status}`);
      const blob=await imgRes.blob();
      const bitmap=await createImageBitmap(blob);
      const canvas=document.createElement("canvas");canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext("2d").drawImage(bitmap,0,0);bitmap.close?.();
      const pngBlob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("PNG_ENCODE_FAILED")),"image/png"));
      const bytes=embed(await pngBlob.arrayBuffer(),card);
      const name=String(card?.data?.name||"Character").trim(),creator=String(card?.data?.creator||"").trim();
      const filename=safeName(creator?`${name}_${creator}`:name)+".png";
      const out=new Blob([bytes],{type:"image/png"}),a=document.createElement("a");
      a.href=URL.createObjectURL(out);a.download=filename;a.style.display="none";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
      toast("PNG CARD DOWNLOADED ✓");
      return true;
    }catch(err){console.error("PNG download failed",err);toast("PNG DOWNLOAD FAILED");return false}
    finally{if(trigger){delete trigger.dataset.pngBusy;if(old!=null)trigger.textContent=old}}
  }
  document.addEventListener("click",e=>{
    const a=e.target.closest?.('a[href*="/card.png"]');
    if(!a||a.dataset.pngBusy)return;
    e.preventDefault();e.stopPropagation();downloadPng(a.href,a);
  },true);
  window.ARCHIVE_DOWNLOAD_PNG=downloadPng;
})();
