const state={q:"",author:null,universe:null,tag:null,sort:"newest"};
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const grid=$("#grid"), menu=$("#menu"), modal=$("#modal");
$("#totalMeta").textContent=`${String(BOTS.length).padStart(3,"0")} records`;

function uniq(key){return [...new Set(BOTS.map(b=>b[key]))].sort((a,b)=>a.localeCompare(b));}
function tagValues(){return [...new Set(BOTS.flatMap(b=>b.tags))].sort((a,b)=>a.localeCompare(b));}
function filtered(){
  let a=BOTS.filter(b=>{
    const hay=[b.nameRu,b.nameEn,b.author,b.universe,b.short,b.full,...b.tags].join(" ").toLowerCase();
    return (!state.q||hay.includes(state.q.toLowerCase()))&&(!state.author||b.author===state.author)&&(!state.universe||b.universe===state.universe)&&(!state.tag||b.tags.includes(state.tag));
  });
  if(state.sort==="az") a.sort((x,y)=>x.nameEn.localeCompare(y.nameEn));
  if(state.sort==="author") a.sort((x,y)=>x.author.localeCompare(y.author));
  if(state.sort==="newest") a.sort((x,y)=>Number(y.isNew)-Number(x.isNew));
  return a;
}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function render(){
  const list=filtered();
  $("#resultCount").textContent=list.length;
  $("#empty").hidden=list.length>0;
  grid.innerHTML=list.map(b=>`
    <article class="card" data-id="${b.id}">
      <div class="media">
        <img src="${b.image}" alt="${esc(b.nameRu)}">
        ${b.isNew?'<span class="badge">NEW</span>':''}
        <a class="download-mini" href="${b.download}" download data-stop>DOWNLOAD ↓</a>
      </div>
      <div class="card-content">
        <div class="title-row"><h2 class="title">${esc(b.nameRu)}<span class="title-en">${esc(b.nameEn)}</span></h2></div>
        <div class="meta-line">by <button class="author" data-author="${esc(b.author)}">${esc(b.author)}</button><span>/</span><button class="universe" data-universe="${esc(b.universe)}">${esc(b.universe)}</button></div>
        <p class="desc">${esc(b.short)}</p>
        <div class="tags">${b.tags.slice(0,3).map(t=>`<button class="tag" data-tag="${esc(t)}">#${esc(t)}</button>`).join("")}${b.tags.length>3?`<span class="tag">+${b.tags.length-3}</span>`:""}</div>
      </div>
    </article>`).join("");
  renderChips();
}
function renderChips(){
  const wrap=$("#activeFilters"); const items=[];
  if(state.author)items.push(["author",`AUTHOR: ${state.author}`]);
  if(state.universe)items.push(["universe",`UNIVERSE: ${state.universe}`]);
  if(state.tag)items.push(["tag",`TAG: #${state.tag}`]);
  wrap.innerHTML=items.map(([k,v])=>`<button class="filter-chip" data-clear="${k}">${esc(v)} ×</button>`).join("");
  $("#authorBtn span").textContent=state.author||"ALL"; $("#universeBtn span").textContent=state.universe||"ALL"; $("#tagBtn span").textContent=state.tag?`#${state.tag}`:"ALL";
  $("#sortBtn span").textContent=state.sort==="newest"?"NEWEST":state.sort==="az"?"A–Z":"AUTHOR";
}
function openMenu(anchor,items,onPick){
  menu.innerHTML=items.map(v=>`<button data-value="${esc(v)}">${esc(v)}</button>`).join("");
  const r=anchor.getBoundingClientRect(); menu.style.left=`${Math.min(r.left,innerWidth-250)}px`;menu.style.top=`${r.bottom+6}px`;menu.hidden=false;
  menu.onclick=e=>{const b=e.target.closest("button");if(!b)return;onPick(b.dataset.value);menu.hidden=true;render();}
}
document.addEventListener("click",e=>{
  if(!e.target.closest(".menu")&&!e.target.closest(".select-like"))menu.hidden=true;
  const stop=e.target.closest("[data-stop]"); if(stop){e.stopPropagation();return;}
  const a=e.target.closest("[data-author]"); if(a){e.stopPropagation();state.author=a.dataset.author;closeModal();render();return;}
  const u=e.target.closest("[data-universe]"); if(u){e.stopPropagation();state.universe=u.dataset.universe;closeModal();render();return;}
  const t=e.target.closest("[data-tag]"); if(t){e.stopPropagation();state.tag=t.dataset.tag;closeModal();render();return;}
  const chip=e.target.closest("[data-clear]"); if(chip){state[chip.dataset.clear]=null;render();return;}
  const card=e.target.closest(".card"); if(card)openModal(BOTS.find(b=>b.id===card.dataset.id));
  if(e.target.matches("[data-close]"))closeModal();
});
$("#searchInput").addEventListener("input",e=>{state.q=e.target.value;render();});
$("#authorBtn").onclick=e=>openMenu(e.currentTarget,["ALL",...uniq("author")],v=>state.author=v==="ALL"?null:v);
$("#universeBtn").onclick=e=>openMenu(e.currentTarget,["ALL",...uniq("universe")],v=>state.universe=v==="ALL"?null:v);
$("#tagBtn").onclick=e=>openMenu(e.currentTarget,["ALL",...tagValues().map(t=>"#"+t)],v=>state.tag=v==="ALL"?null:v.slice(1));
$("#sortBtn").onclick=e=>openMenu(e.currentTarget,["NEWEST","A–Z","AUTHOR"],v=>state.sort=v==="NEWEST"?"newest":v==="A–Z"?"az":"author");
$("#clearBtn").onclick=()=>{Object.assign(state,{q:"",author:null,universe:null,tag:null,sort:"newest"});$("#searchInput").value="";render();};
$("#randomBtn").onclick=()=>{const list=filtered(); if(list.length)openModal(list[Math.floor(Math.random()*list.length)]);};
$("[data-reset]").onclick=e=>{e.preventDefault();$("#clearBtn").click();scrollTo({top:0,behavior:"smooth"});};

function openModal(b){
  if(!b)return; $("#modalImage").src=b.image;$("#modalImage").alt=b.nameRu;
  $("#modalTitle").innerHTML=`${esc(b.nameRu)}<span class="title-en">${esc(b.nameEn)}</span>`;
  $("#modalAuthor").textContent=`by ${b.author}`;$("#modalAuthor").dataset.author=b.author;
  $("#modalUniverse").textContent=`UNIVERSE_ / ${b.universe}`;$("#modalUniverse").dataset.universe=b.universe;
  $("#modalShort").textContent=b.short;$("#modalFull").textContent=b.full;
  $("#modalTags").innerHTML=b.tags.map(t=>`<button class="tag" data-tag="${esc(t)}">#${esc(t)}</button>`).join("");
  $("#openBot").href=b.url;$("#openBot").textContent=`OPEN ON ${b.platform} ↗`;$("#downloadBot").href=b.download;
  modal.hidden=false;document.body.style.overflow="hidden";
}
function closeModal(){modal.hidden=true;document.body.style.overflow="";}
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal();});
render();
