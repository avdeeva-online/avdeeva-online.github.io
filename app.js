const B=window.BOTS||[];
const state={q:"",authors:new Set(),universes:new Set(),tags:new Set(),lorebook:false,sort:"newest"};
let current=null,activeFilter=null,drawerTab="author",modalTab="description";

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const uniq=k=>[...new Set(B.map(b=>b[k]).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
const allTags=()=>[...new Set(B.flatMap(b=>b.tags||[]))].sort((a,b)=>a.localeCompare(b));

$("#totalMeta").textContent=`${String(B.length).padStart(3,"0")} RECORDS`;

function applyFilters(){
  let list=B.filter(b=>{
    const hay=[b.nameRu,b.nameEn,b.author,b.universe,b.short,b.full,...(b.tags||[])].join(" ").toLowerCase();
    if(state.q && !hay.includes(state.q.toLowerCase())) return false;
    if(state.authors.size && !state.authors.has(b.author)) return false;
    if(state.universes.size && !state.universes.has(b.universe)) return false;
    if(state.tags.size && ![...state.tags].every(t=>(b.tags||[]).includes(t))) return false;
    if(state.lorebook && !b.lorebook) return false;
    return true;
  });
  if(state.sort==="newest") list.sort((a,b)=>Number(b.isNew)-Number(a.isNew));
  if(state.sort==="az") list.sort((a,b)=>a.nameEn.localeCompare(b.nameEn));
  if(state.sort==="za") list.sort((a,b)=>b.nameEn.localeCompare(a.nameEn));
  if(state.sort==="author") list.sort((a,b)=>a.author.localeCompare(b.author)||a.nameEn.localeCompare(b.nameEn));
  return list;
}

function render(){
  const list=applyFilters();
  $("#resultCount").textContent=list.length;
  $("#empty").hidden=!!list.length;
  $("#grid").innerHTML=list.map(b=>`
    <article class="card" data-id="${b.id}">
      <div class="card-media">
        <img src="${b.image}" alt="${esc(b.nameEn)}">
        ${b.isNew?'<span class="new-badge">NEW</span>':''}
        ${b.lorebook?'<span class="lore-badge" title="Lorebook available">▤</span>':''}
        <a href="${b.download}" class="card-download" download data-stop>DOWNLOAD CARD ↓</a>
      </div>
      <div class="card-body">
        <h2 class="card-title">${esc(b.nameEn)}<span class="card-ru">${esc(b.nameRu)}</span></h2>
        <div class="card-meta">BY <button data-author="${esc(b.author)}">${esc(b.author)}</button></div>
        <p class="card-desc">${esc(b.short)}</p>
        <div class="card-tags">
          ${(b.tags||[]).slice(0,2).map(t=>`<button data-tag="${esc(t)}">#${esc(t)}</button>`).join("")}
          ${(b.tags||[]).length>2?`<span class="more-tag">+${b.tags.length-2}</span>`:""}
        </div>
      </div>
    </article>`).join("");
  renderActive();
  renderDrawer();
  renderUniverseQuick();
}

function renderActive(){
  const chips=[];
  state.authors.forEach(v=>chips.push(["author",v,`◎ ${v}`]));
  state.universes.forEach(v=>chips.push(["universe",v,`⌁ ${v}`]));
  state.tags.forEach(v=>chips.push(["tag",v,`#${v}`]));
  if(state.lorebook) chips.push(["lorebook","1","▤ LOREBOOK"]);
  const w=$("#activeFilters");
  w.innerHTML=chips.map(([type,val,label])=>`<button class="filter-chip" data-remove="${type}" data-value="${esc(val)}">${esc(label)} ×</button>`).join("");
  w.classList.toggle("has",chips.length>0);
  setCount("tagCount",state.tags.size);setCount("authorCount",state.authors.size);setCount("universeCount",state.universes.size);setCount("loreCount",state.lorebook?1:0);
}
function setCount(id,n){const el=$("#"+id);el.textContent=n||"";el.classList.toggle("has-count",!!n)}

function renderUniverseQuick(){
  $("#universeQuick").innerHTML=uniq("universe").slice(0,16).map(u=>`<button data-quick-universe="${esc(u)}" class="${state.universes.has(u)?"active":""}">${esc(u)}</button>`).join("");
}

function valuesForFilter(type){
  if(type==="tag") return allTags();
  if(type==="author") return uniq("author");
  if(type==="universe") return uniq("universe");
  return ["WITH LOREBOOK"];
}
function selectedForFilter(type,val){
  if(type==="tag") return state.tags.has(val);
  if(type==="author") return state.authors.has(val);
  if(type==="universe") return state.universes.has(val);
  return state.lorebook;
}
function toggleFilter(type,val){
  if(type==="tag"){state.tags.has(val)?state.tags.delete(val):state.tags.add(val)}
  if(type==="author"){state.authors.has(val)?state.authors.delete(val):state.authors.add(val)}
  if(type==="universe"){state.universes.has(val)?state.universes.delete(val):state.universes.add(val)}
  if(type==="lorebook") state.lorebook=!state.lorebook;
}
function optionCount(type,val){
  if(type==="tag") return B.filter(b=>(b.tags||[]).includes(val)).length;
  if(type==="author") return B.filter(b=>b.author===val).length;
  if(type==="universe") return B.filter(b=>b.universe===val).length;
  return B.filter(b=>b.lorebook).length;
}

function openPopover(btn,type){
  activeFilter=type;
  const p=$("#popover");
  const r=btn.getBoundingClientRect();
  p.style.left=`${Math.min(r.left,innerWidth-300)}px`;
  p.style.top=`${r.bottom+7}px`;
  p.hidden=false;
  $("#sortMenu").hidden=true;
  $("#popoverSearch").value="";
  renderPopover();
  $("#popoverSearch").focus();
}
function renderPopover(){
  const q=$("#popoverSearch").value.toLowerCase();
  const vals=valuesForFilter(activeFilter).filter(v=>v.toLowerCase().includes(q));
  $("#popoverList").innerHTML=vals.map(v=>`
    <button class="option-row ${selectedForFilter(activeFilter,v)?"checked":""}" data-option="${esc(v)}">
      <span class="fake-check">✓</span>
      <span>${activeFilter==="tag"?"#":""}${esc(v)}</span>
      <small>${optionCount(activeFilter,v)}</small>
    </button>`).join("");
}
$$(".filter-trigger").forEach(btn=>btn.onclick=e=>openPopover(e.currentTarget,e.currentTarget.dataset.filter));
$("#popoverSearch").oninput=renderPopover;
$("#popoverList").onclick=e=>{const o=e.target.closest("[data-option]");if(!o)return;toggleFilter(activeFilter,o.dataset.option);renderPopover();render()};
$("#popoverReset").onclick=()=>{if(activeFilter==="tag")state.tags.clear();if(activeFilter==="author")state.authors.clear();if(activeFilter==="universe")state.universes.clear();if(activeFilter==="lorebook")state.lorebook=false;renderPopover();render()};
$("#popoverDone").onclick=()=>$("#popover").hidden=true;

$("#sortTrigger").onclick=e=>{
  const m=$("#sortMenu"),r=e.currentTarget.getBoundingClientRect();
  m.style.left=`${Math.min(r.left,innerWidth-205)}px`;m.style.top=`${r.bottom+7}px`;
  m.hidden=!m.hidden;$("#popover").hidden=true;
  $$("#sortMenu button").forEach(b=>b.classList.toggle("active",b.dataset.sort===state.sort));
};
$("#sortMenu").onclick=e=>{const b=e.target.closest("[data-sort]");if(!b)return;state.sort=b.dataset.sort;$("#sortLabel").textContent={newest:"NEWEST",az:"A→Z",za:"Z→A",author:"AUTHOR"}[state.sort];$("#sortMenu").hidden=true;render()};

function openDrawer(){
  $("#catalogDrawer").classList.add("open");$("#catalogDrawer").setAttribute("aria-hidden","false");$("#drawerShade").hidden=false;renderDrawer();
}
function closeDrawer(){
  $("#catalogDrawer").classList.remove("open");$("#catalogDrawer").setAttribute("aria-hidden","true");$("#drawerShade").hidden=true;
}
$("#catalogOpen").onclick=openDrawer;$("#catalogClose").onclick=closeDrawer;$("#drawerShade").onclick=closeDrawer;
$$(".drawer-tab").forEach(b=>b.onclick=()=>{drawerTab=b.dataset.drawerTab;$$(".drawer-tab").forEach(x=>x.classList.toggle("active",x===b));$("#drawerSearch").value="";renderDrawer()});
$("#drawerSearch").oninput=renderDrawer;

function drawerValues(){return drawerTab==="author"?uniq("author"):drawerTab==="universe"?uniq("universe"):allTags()}
function drawerSelected(v){return drawerTab==="author"?state.authors.has(v):drawerTab==="universe"?state.universes.has(v):state.tags.has(v)}
function drawerCount(v){return optionCount(drawerTab==="genre"?"tag":drawerTab,v)}
function renderDrawer(){
  const q=($("#drawerSearch").value||"").toLowerCase();
  const vals=drawerValues().filter(v=>v.toLowerCase().includes(q));
  $("#drawerList").innerHTML=vals.map(v=>`<button class="drawer-item ${drawerSelected(v)?"active":""}" data-drawer-value="${esc(v)}"><span>${drawerTab==="genre"?"#":""}${esc(v)}</span><small>${drawerCount(v)}</small></button>`).join("");
}
$("#drawerList").onclick=e=>{
  const b=e.target.closest("[data-drawer-value]");if(!b)return;
  const v=b.dataset.drawerValue;
  if(drawerTab==="author"){state.authors.clear();state.authors.add(v)}
  if(drawerTab==="universe"){state.universes.clear();state.universes.add(v)}
  if(drawerTab==="genre"){state.tags.clear();state.tags.add(v)}
  render();closeDrawer();
};

$("#searchInput").oninput=e=>{state.q=e.target.value;render()};
$("#resetBtn").onclick=resetAll;
function resetAll(){state.q="";state.authors.clear();state.universes.clear();state.tags.clear();state.lorebook=false;state.sort="newest";$("#searchInput").value="";$("#sortLabel").textContent="NEWEST";render()}

document.addEventListener("click",e=>{
  if(!e.target.closest("#popover")&&!e.target.closest(".filter-trigger"))$("#popover").hidden=true;
  if(!e.target.closest("#sortMenu")&&!e.target.closest("#sortTrigger"))$("#sortMenu").hidden=true;
  if(e.target.closest("[data-stop]")){e.stopPropagation();return}
  const rem=e.target.closest("[data-remove]");if(rem){const t=rem.dataset.remove,v=rem.dataset.value;if(t==="author")state.authors.delete(v);if(t==="universe")state.universes.delete(v);if(t==="tag")state.tags.delete(v);if(t==="lorebook")state.lorebook=false;render();return}
  const au=e.target.closest("[data-author]");if(au){e.stopPropagation();state.authors.clear();state.authors.add(au.dataset.author);closeModal();render();return}
  const tg=e.target.closest("[data-tag]");if(tg){e.stopPropagation();state.tags.clear();state.tags.add(tg.dataset.tag);closeModal();render();return}
  const qu=e.target.closest("[data-quick-universe]");if(qu){const v=qu.dataset.quickUniverse;state.universes.has(v)?state.universes.delete(v):(state.universes.clear(),state.universes.add(v));render();return}
  const card=e.target.closest(".card");if(card)openModal(B.find(b=>b.id===card.dataset.id));
  if(e.target.matches("[data-close]"))closeModal();
});

$("#randomBtn").onclick=randomModal;$("#prevBot").onclick=randomModal;$("#nextBot").onclick=randomModal;
function randomModal(){let pool=applyFilters().filter(b=>!current||b.id!==current.id);if(!pool.length)pool=B.filter(b=>!current||b.id!==current.id);if(pool.length)openModal(pool[Math.floor(Math.random()*pool.length)])}

function openModal(b){
  current=b;modalTab="description";
  $("#modalImage").src=b.image;$("#modalImage").alt=b.nameEn;
  $("#modalTitle").innerHTML=`${esc(b.nameEn)}<span>${esc(b.nameRu)}</span>`;
  $("#modalAuthor").textContent=`@${b.author}`;$("#modalAuthor").dataset.author=b.author;
  $("#modalAuthorBadge").textContent=`@${b.author}`;$("#modalAuthorBadge").dataset.author=b.author;
  $("#modalUniverse").textContent=`UNIVERSE / ${b.universe}`;$("#modalUniverse").dataset.quickUniverse=b.universe;
  $("#modalLoreFlag").textContent=b.lorebook?"▤ LOREBOOK AVAILABLE":"";
  $("#modalText").textContent=b.short;
  $("#modalTags").innerHTML=(b.tags||[]).map(t=>`<button data-tag="${esc(t)}">#${esc(t)}</button>`).join("");
  $("#openBot").href=b.url;$("#openBot").textContent=`OPEN ON ${b.platform} →`;
  $("#downloadBot").href=b.download;
  const lore=$("#downloadLore");if(b.lorebook){lore.href=b.lorebook;lore.classList.remove("disabled");lore.textContent="LOREBOOK ↓"}else{lore.removeAttribute("href");lore.classList.add("disabled");lore.textContent="NO LOREBOOK"}
  $$(".modal-tab").forEach(t=>t.classList.toggle("active",t.dataset.modalTab==="description"));
  $("#modal").hidden=false;document.body.style.overflow="hidden";
}
function closeModal(){$("#modal").hidden=true;document.body.style.overflow=""}
$$(".modal-tab").forEach(t=>t.onclick=()=>{if(!current)return;modalTab=t.dataset.modalTab;$$(".modal-tab").forEach(x=>x.classList.toggle("active",x===t));$("#modalText").textContent=modalTab==="description"?current.short:current.full});

document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeModal();closeDrawer();$("#popover").hidden=true;$("#sortMenu").hidden=true}if(!$("#modal").hidden&&e.key==="ArrowRight")randomModal();if(!$("#modal").hidden&&e.key==="ArrowLeft")randomModal()});

render();
