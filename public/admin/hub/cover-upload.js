(()=>{
  const mediaGrid=document.querySelector('#mediaGrid');
  if(!mediaGrid||document.querySelector('[data-cover-upload]'))return;
  let manualCover='';
  const style=document.createElement('style');
  style.textContent=`
  .cover-upload{margin-top:10px;border:1px dashed #465440;background:#0a0e0a;padding:10px;display:grid;grid-template-columns:120px minmax(0,1fr);gap:10px;align-items:center}
  .cover-preview{width:120px;aspect-ratio:16/10;border:1px solid #34402f;background:#080b08 center/cover no-repeat;display:grid;place-items:center;color:#657060;font:7px var(--mono);overflow:hidden}
  .cover-tools{display:grid;gap:7px}.cover-title{font:8px/1 var(--mono);letter-spacing:.08em;color:#98a391}.cover-copy{font:7.5px/1.45 var(--mono);color:#687364}.cover-actions{display:flex;gap:6px;flex-wrap:wrap}.cover-btn{border:1px solid #3d4938;background:#10150f;color:#aeb9a5;padding:7px 9px;font:8px var(--mono);cursor:pointer}.cover-btn.primary{border-color:#7c744e;color:#eadfbf}.cover-btn.remove{border-color:#594139;color:#b98f82}.cover-status{font:7px/1.35 var(--mono);color:#7b8777}
  @media(max-width:620px){.cover-upload{grid-template-columns:1fr}.cover-preview{width:100%;max-width:260px}}
  `;
  document.head.appendChild(style);
  const box=document.createElement('div');box.className='cover-upload';box.dataset.coverUpload='1';
  box.innerHTML=`<div class="cover-preview">Ручной обложки нет</div><div class="cover-tools"><div class="cover-title">Обложка вручную</div><div class="cover-copy">Только если Telegram не отдал нужную картинку. Она станет обложкой карточки ресурса.</div><div class="cover-actions"><input id="manualCoverInput" type="file" accept="image/png,image/jpeg,image/webp" hidden><button class="cover-btn primary" id="manualCoverPick" type="button">Выбрать обложку</button><button class="cover-btn remove" id="manualCoverRemove" type="button">Убрать</button></div><div class="cover-status">JPG / PNG / WEBP · сжимается автоматически</div></div>`;
  mediaGrid.insertAdjacentElement('afterend',box);
  const preview=box.querySelector('.cover-preview'),input=box.querySelector('#manualCoverInput'),status=box.querySelector('.cover-status');
  const setPreview=url=>{preview.style.backgroundImage=url?`url("${url.replace(/"/g,'%22')}")`:'';preview.textContent=url?'':'NO MANUAL COVER'};
  async function optimize(file){let bitmap;try{bitmap=await createImageBitmap(file)}catch{throw new Error('IMAGE COULD NOT BE READ')}const maxSide=1500,scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height)),w=Math.max(1,Math.round(bitmap.width*scale)),h=Math.max(1,Math.round(bitmap.height*scale)),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d',{alpha:false}).drawImage(bitmap,0,0,w,h);bitmap.close?.();let quality=.84,blob=null;for(let i=0;i<6;i++){blob=await new Promise(r=>canvas.toBlob(r,'image/webp',quality));if(blob&&blob.size<=180*1024)break;quality-=.08}if(!blob)throw new Error('IMAGE OPTIMIZATION FAILED');if(blob.size>240*1024)throw new Error('IMAGE IS STILL TOO LARGE');return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(String(fr.result||''));fr.onerror=()=>reject(new Error('IMAGE READ FAILED'));fr.readAsDataURL(blob)})}
  window.archiveHubGetManualCover=()=>manualCover;
  window.archiveHubSetManualCover=url=>{manualCover=String(url||'');setPreview(manualCover);status.textContent=manualCover?'Обложка готова':'Ручной обложки нет'};
  box.querySelector('#manualCoverPick').onclick=()=>input.click();
  box.querySelector('#manualCoverRemove').onclick=()=>{manualCover='';input.value='';setPreview('');status.textContent='Обложка убрана';window.dispatchEvent(new CustomEvent('archive:hub-cover-change'))};
  input.onchange=async()=>{const file=input.files?.[0];if(!file)return;status.textContent='Сжимаю обложку…';try{manualCover=await optimize(file);setPreview(manualCover);status.textContent=`READY · ${Math.round(manualCover.length*0.75/1024)} KB APPROX.`;window.dispatchEvent(new CustomEvent('archive:hub-cover-change'))}catch(e){manualCover='';setPreview('');status.textContent='FAILED: '+e.message}};
})();
