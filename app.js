const state={q:"",author:null,universe:null,tag:null,lore:"all",sort:"newest"};let currentId=null;let sideTab="author";
const $=s=>document.querySelector(s),grid=$("#grid"),menu=$("#menu"),modal=$("#modal");
$("#totalMeta").textContent=`${String(BOTS.length).padStart(3,"0")} RECORDS`;
const uniq=k=>[...new Set(BOTS.map(b=>b[k]))].sort((a,b)=>a.localeCompare(b));
const tagValues=()=>[...new Set(BOTS.flatMap(b=>b.tags))].sort((a,b)=>a.localeCompare(b));
const esc=s=>String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
function filtered(){let a=BOTS.filter(b=>{const hay=[b.nameRu,b.nameEn,b.author,b.universe,b.short,b.full,...b.tags].join(" ").toLowerCase();return(!state.q||hay.includes(state.q.toLowerCase()))&&(!state.author||b.author===state.author)&&(!state.universe||b.universe===state.universe)&&(!state.tag||b.tags.includes(state.tag))&&(state.lore!=="yes"||!!b.lorebook)});if(state.sort==="az")a.sort((x,y)=>x.nameEn.localeCompare(y.nameEn));if(state.sort==="author")a.sort((x,y)=>x.author.localeCompare(y.author));if(state.sort==="newest")a.sort((x,y)=>Number(y.isNew)-Number(x.isNew));return a}

function sidebarValues(){
  if(sideTab==="author") return uniq("author");
  if(sideTab==="universe") return uniq("universe");
  return tagValues();
}
function renderSidebar(){
  const q=($("#sidebarSearch")?.value||"").toLowerCase();
  const list=sidebarValues().filter(v=>v.toLowerCase().includes(q));
  const counts=v=>{
    if(sideTab==="author") return BOTS.filter(b=>b.author===v).length;
    if(sideTab==="universe") return BOTS.filter(b=>b.universe===v).length;
    return BOTS.filter(b=>b.tags.includes(v)).length;
  };
  const active=v=>sideTab==="author"?state.author===v:sideTab==="universe"?state.universe===v:state.tag===v;
  $("#sidebarList").innerHTML=`<button class="sidebar-item ${!state[sideTab==="genre"?"tag":sideTab]?"active":""}" data-side-value="__ALL__"><span>ALL</span><span class="sidebar-count">${BOTS.length}</span></button>`+
    list.map(v=>`<button class="sidebar-item ${active(v)?"active":""}" data-side-value="${esc(v)}"><span>${sideTab==="genre"?"#":""}${esc(v)}</span><span class="sidebar-count">${counts(v)}</span></button>`).join("");
}

function render(){const list=filtered();$("#resultCount").textContent=list.length;$("#empty").hidden=!!list.length;grid.innerHTML=list.map(b=>`<article class="card" data-id="${b.id}"><div class="media"><img src="${b.image}" alt="${esc(b.nameEn)}">${b.isNew?'<span class="badge">NEW</span>':''}<a class="download-mini" href="${b.download}" download data-stop>CARD ↓</a></div><div class="card-content"><h2 class="title">${esc(b.nameEn)}<span class="title-en">${esc(b.nameRu)}</span></h2><div class="meta-line">BY <button class="author" data-author="${esc(b.author)}">${esc(b.author)}</button><span>/</span><button class="universe" data-universe="${esc(b.universe)}">${esc(b.universe)}</button>${b.lorebook?'<span>/ LOREBOOK</span>':''}</div><p class="desc">${esc(b.short)}</p><div class="tags">${b.tags.slice(0,3).map(t=>`<button class="tag" data-tag="${esc(t)}">#${esc(t)}</button>`).join("")}${b.tags.length>3?`<span class="tag">+${b.tags.length-3}</span>`:""}</div></div></article>`).join("");renderChips();renderSidebar()}
function renderChips(){const w=$("#activeFilters"),x=[];if(state.author)x.push(["author",`AUTHOR: ${state.author}`]);if(state.universe)x.push(["universe",`UNIVERSE: ${state.universe}`]);if(state.tag)x.push(["tag",`TAG: #${state.tag}`]);if(state.lore==="yes")x.push(["lore","LOREBOOK: YES"]);w.innerHTML=x.map(([k,v])=>`<button class="filter-chip" data-clear="${k}">${esc(v)} ×</button>`).join("");$("#authorBtn span").textContent=state.author||"ALL";$("#universeBtn span").textContent=state.universe||"ALL";$("#tagBtn span").textContent=state.tag?`#${state.tag}`:"ALL";$("#loreBtn span").textContent=state.lore==="yes"?"YES":"ALL";$("#sortBtn span").textContent=state.sort==="newest"?"NEWEST":state.sort==="az"?"A–Z":"AUTHOR"}
function openMenu(anchor,items,pick){menu.innerHTML=items.map(v=>`<button data-value="${esc(v)}">${esc(v)}</button>`).join("");const r=anchor.getBoundingClientRect();menu.style.left=`${Math.min(r.left,innerWidth-250)}px`;menu.style.top=`${r.bottom+6}px`;menu.hidden=false;menu.onclick=e=>{const b=e.target.closest("button");if(!b)return;pick(b.dataset.value);menu.hidden=true;render()}}
document.addEventListener("click",e=>{if(!e.target.closest(".menu")&&!e.target.closest(".select-like"))menu.hidden=true;if(e.target.closest("[data-stop]")){e.stopPropagation();return}const a=e.target.closest("[data-author]");if(a){e.stopPropagation();state.author=a.dataset.author;closeModal();render();return}const u=e.target.closest("[data-universe]");if(u){e.stopPropagation();state.universe=u.dataset.universe;closeModal();render();return}const t=e.target.closest("[data-tag]");if(t){e.stopPropagation();state.tag=t.dataset.tag;closeModal();render();return}const c=e.target.closest("[data-clear]");if(c){state[c.dataset.clear]=c.dataset.clear==="lore"?"all":null;render();return}const card=e.target.closest(".card");if(card)openModal(BOTS.find(b=>b.id===card.dataset.id));if(e.target.matches("[data-close]"))closeModal()});
$("#searchInput").oninput=e=>{state.q=e.target.value;render()};$("#authorBtn").onclick=e=>openMenu(e.currentTarget,["ALL",...uniq("author")],v=>state.author=v==="ALL"?null:v);$("#universeBtn").onclick=e=>openMenu(e.currentTarget,["ALL",...uniq("universe")],v=>state.universe=v==="ALL"?null:v);$("#tagBtn").onclick=e=>openMenu(e.currentTarget,["ALL",...tagValues().map(t=>"#"+t)],v=>state.tag=v==="ALL"?null:v.slice(1));$("#loreBtn").onclick=e=>openMenu(e.currentTarget,["ALL","WITH LOREBOOK"],v=>state.lore=v==="WITH LOREBOOK"?"yes":"all");$("#sortBtn").onclick=e=>openMenu(e.currentTarget,["NEWEST","A–Z","AUTHOR"],v=>state.sort=v==="NEWEST"?"newest":v==="A–Z"?"az":"author");$("#clearBtn").onclick=()=>{Object.assign(state,{q:"",author:null,universe:null,tag:null,lore:"all",sort:"newest"});$("#searchInput").value="";render()};$("#randomBtn").onclick=()=>randomModal();$("[data-reset]").onclick=e=>{e.preventDefault();$("#clearBtn").click();scrollTo({top:0,behavior:"smooth"})};
function randomModal(){let list=filtered().filter(b=>b.id!==currentId);if(!list.length)list=filtered();if(list.length)openModal(list[Math.floor(Math.random()*list.length)])}
$("#prevBot").onclick=randomModal;$("#nextBot").onclick=randomModal;
function openModal(b){if(!b)return;currentId=b.id;$("#modalImage").src=b.image;$("#modalTitle").innerHTML=`${esc(b.nameEn)}<span class="title-en">${esc(b.nameRu)}</span>`;$("#modalAuthor").textContent=`BY ${b.author}`;$("#modalAuthor").dataset.author=b.author;$("#modalUniverse").textContent=`UNIVERSE_ / ${b.universe}`;$("#modalUniverse").dataset.universe=b.universe;$("#modalShort").textContent=b.short;$("#modalFull").textContent=b.full;$("#modalTags").innerHTML=b.tags.map(t=>`<button class="tag" data-tag="${esc(t)}">#${esc(t)}</button>`).join("");$("#openBot").href=b.url;$("#openBot").textContent=`OPEN ON ${b.platform} ↗`;$("#downloadBot").href=b.download;const lore=$("#downloadLore");if(b.lorebook){lore.href=b.lorebook;lore.classList.remove("disabled");lore.textContent="LOREBOOK ↓"}else{lore.removeAttribute("href");lore.classList.add("disabled");lore.textContent="NO LOREBOOK"}modal.hidden=false;document.body.style.overflow="hidden"}

document.querySelectorAll(".sidebar-tab").forEach(btn=>btn.onclick=()=>{
  sideTab=btn.dataset.sideTab;
  document.querySelectorAll(".sidebar-tab").forEach(x=>x.classList.toggle("active",x===btn));
  $("#sidebarSearch").value="";
  renderSidebar();
});
$("#sidebarSearch").oninput=renderSidebar;
$("#sidebarList").onclick=e=>{
  const b=e.target.closest("[data-side-value]"); if(!b)return;
  const v=b.dataset.sideValue==="__ALL__"?null:b.dataset.sideValue;
  if(sideTab==="author") state.author=v;
  else if(sideTab==="universe") state.universe=v;
  else state.tag=v;
  render();
  $("#catalogSidebar").classList.remove("open");
};
$("#sidebarOpen").onclick=()=>$("#catalogSidebar").classList.add("open");
$("#sidebarClose").onclick=()=>$("#catalogSidebar").classList.remove("open");

function closeModal(){modal.hidden=true;document.body.style.overflow=""}document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal();if(!modal.hidden&&e.key==="ArrowRight")randomModal();if(!modal.hidden&&e.key==="ArrowLeft")randomModal()});render();