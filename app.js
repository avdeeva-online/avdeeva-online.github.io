const B = window.BOTS || [];
const TAG_META = window.TAG_META || {};
const TAG_ORDER = window.TAG_ORDER || Object.keys(TAG_META);
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const state = { q:"", authors:new Set(), universes:new Set(), tags:new Set(), povs:new Set(), lorebook:false, sort:"newest" };
let activeFilter = null, drawerTab = "tag", current = null, modalTab = "description", tagsExpanded = false;

const bookSvg = `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 5.5c3.2-.9 5.7-.6 8.5 1.1v12c-2.8-1.7-5.3-2-8.5-1.1zM20.5 5.5c-3.2-.9-5.7-.6-8.5 1.1v12c2.8-1.7 5.3-2 8.5-1.1z"/></svg>`;
const globeSvg = `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.8 12h16.4M12 3.5c2.2 2.4 3.4 5.2 3.4 8.5S14.2 18.1 12 20.5M12 3.5C9.8 5.9 8.6 8.7 8.6 12s1.2 6.1 3.4 8.5"/></svg>`;
const eyeSvg = `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.3-5.5 9.5-5.5S21.5 12 21.5 12 18.2 17.5 12 17.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>`;

const tagLabel = t => `${TAG_META[t] || ""} ${t}`.trim();
const povLabel = p => p === "AnyPOV" ? "◌ AnyPOV" : p === "FemPOV" ? "♀ FemPOV" : p === "MalePOV" ? "♂ MalePOV" : p;
const uniq = key => [...new Set(B.map(x => x[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
const allTags = () => TAG_ORDER.filter(t => TAG_META[t]);

function count(kind, val){
  if(kind === "tag") return B.filter(b => (b.tags||[]).includes(val)).length;
  if(kind === "author") return B.filter(b => b.author === val).length;
  if(kind === "universe") return B.filter(b => b.universe === val).length;
  if(kind === "pov") return B.filter(b => b.pov === val).length;
  return 0;
}

function applyFilters(){
  const q = state.q.trim().toLowerCase();
  let list = B.filter(b => {
    const hay = [b.nameRu,b.nameEn,b.author,b.universe,b.pov,b.short,b.full,...(b.tags||[])].join(" ").toLowerCase();
    if(q && !hay.includes(q)) return false;
    if(state.authors.size && !state.authors.has(b.author)) return false;
    if(state.universes.size && !state.universes.has(b.universe)) return false;
    if(state.povs.size && !state.povs.has(b.pov)) return false;
    if(state.lorebook && !b.lorebook) return false;
    if([...state.tags].some(t => !(b.tags||[]).includes(t))) return false; // AND logic
    return true;
  });
  if(state.sort === "az") list.sort((a,b)=>a.nameEn.localeCompare(b.nameEn));
  if(state.sort === "za") list.sort((a,b)=>b.nameEn.localeCompare(a.nameEn));
  if(state.sort === "author") list.sort((a,b)=>a.author.localeCompare(b.author)||a.nameEn.localeCompare(b.nameEn));
  if(state.sort === "newest") list.sort((a,b)=>Number(b.isNew)-Number(a.isNew));
  return list;
}

function render(){
  const list = applyFilters();
  $("#resultCount").textContent = list.length;
  $("#totalMeta").textContent = `${String(B.length).padStart(3,"0")} RECORDS`;
  $("#empty").hidden = !!list.length;
  $("#grid").innerHTML = list.map((b,i)=>cardHtml(b,i)).join("");
  renderQuickTags();
  renderActiveFilters();
  renderCounts();
  renderDrawer();
  renderMoreMenu();
}

function cardHtml(b,i){
  const tags = b.tags || [];
  const shown = tags.slice(0,4);
  const more = tags.length - shown.length;
  return `<article class="card" data-id="${esc(b.id)}" style="animation-delay:${Math.min(i,12)*18}ms">
    <div class="card-media"><img src="${esc(b.image)}" alt="${esc(b.nameEn)}">${b.isNew?'<span class="new-badge">NEW</span>':''}<a class="download-hover" href="${esc(b.download)}" download data-stop>BOT CARD ↓</a></div>
    <div class="card-body">
      <h3 class="card-title">${esc(b.nameEn)}<span>${esc(b.nameRu)}</span></h3>
      <div class="card-author">BY <button data-author="${esc(b.author)}">@${esc(b.author)}</button></div>
      <div class="card-meta">
        <button class="meta-token" data-quick-universe="${esc(b.universe)}">${globeSvg}<span>${esc(b.universe)}</span></button>
        ${b.lorebook?`<span class="meta-token lore-token">${bookSvg}<span>LORE</span></span>`:''}
      </div>
      <p class="card-short">${esc(b.short)}</p>
      <div class="card-tags">${shown.map(t=>`<button data-tag="${esc(t)}">${esc(tagLabel(t))}</button>`).join("")}${more>0?`<span class="tag-more">+${more}</span>`:''}</div>
    </div>
  </article>`;
}

function renderQuickTags(){
  const el = $("#tagQuick");
  el.classList.toggle("quick-expanded", tagsExpanded);
  el.classList.toggle("quick-collapsed", !tagsExpanded);
  el.innerHTML = allTags().map(t=>`<button class="${state.tags.has(t)?'active':''}" data-quick-tag="${esc(t)}">${esc(tagLabel(t))}</button>`).join("");
  $("#clearQuickTags").hidden = state.tags.size === 0;
  $("#toggleAllTags").textContent = tagsExpanded ? "COLLAPSE −" : "ALL TAGS +";
}

function renderActiveFilters(){
  const chips = [];
  state.authors.forEach(v=>chips.push(["author",v,`@ ${v}`]));
  state.universes.forEach(v=>chips.push(["universe",v,`UNIVERSE / ${v}`]));
  state.tags.forEach(v=>chips.push(["tag",v,tagLabel(v)]));
  state.povs.forEach(v=>chips.push(["pov",v,povLabel(v)]));
  if(state.lorebook) chips.push(["lorebook","1","LOREBOOK"]);
  const box = $("#activeFilters");
  box.classList.toggle("has", chips.length>0);
  box.innerHTML = chips.map(([type,value,label])=>`<button class="filter-chip" data-remove="${type}" data-value="${esc(value)}">${esc(label)} ×</button>`).join("");
}

function renderCounts(){
  setCount("#authorCount", state.authors.size);
  setCount("#loreCount", state.lorebook?1:0);
  setCount("#moreCount", state.universes.size + state.povs.size);
  $$('.filter-trigger[data-filter="author"]').forEach(b=>b.classList.toggle("active",state.authors.size>0));
  $$('.filter-trigger[data-filter="lorebook"]').forEach(b=>b.classList.toggle("active",state.lorebook));
  $("#moreTrigger").classList.toggle("active", state.universes.size+state.povs.size>0);
}
function setCount(sel,n){const e=$(sel);if(!e)return;e.textContent=n||"";e.classList.toggle("has-count",!!n)}

function toggle(kind,val){
  const map={tag:"tags",author:"authors",universe:"universes",pov:"povs"};
  const set=state[map[kind]]; if(!set)return;
  set.has(val)?set.delete(val):set.add(val);
}

function valuesForFilter(kind){
  if(kind === "tag") return allTags();
  if(kind === "author") return uniq("author");
  if(kind === "universe") return uniq("universe");
  if(kind === "pov") return ["AnyPOV","FemPOV","MalePOV"];
  return [];
}

function openPopover(btn,kind){
  activeFilter=kind;
  const pop=$("#popover");
  const r=btn.getBoundingClientRect();
  pop.hidden=false;
  pop.style.left=Math.max(8,Math.min(r.left,innerWidth-270))+"px";
  pop.style.top=(r.bottom+7)+"px";
  $("#popoverSearch").value="";
  renderPopover();
}
function renderPopover(){
  if(activeFilter === "lorebook"){
    $("#popoverList").innerHTML=`<button data-lore-option class="${state.lorebook?'active':''}"><span>${bookSvg} LOREBOOK AVAILABLE</span><small>${B.filter(b=>b.lorebook).length}</small></button>`;
    return;
  }
  const q=($("#popoverSearch").value||"").toLowerCase();
  const vals=valuesForFilter(activeFilter).filter(v=>v.toLowerCase().includes(q));
  const selected = activeFilter==="tag"?state.tags:activeFilter==="author"?state.authors:activeFilter==="universe"?state.universes:state.povs;
  $("#popoverList").innerHTML=vals.map(v=>`<button class="${selected.has(v)?'active':''}" data-option="${esc(v)}"><span>${esc(activeFilter==="tag"?tagLabel(v):activeFilter==="pov"?povLabel(v):activeFilter==="author"?'@ '+v:v)}</span><small>${count(activeFilter,v)}</small></button>`).join("");
}

$$('.filter-trigger').forEach(b=>b.onclick=e=>{e.stopPropagation();openPopover(b,b.dataset.filter)});
$("#popoverSearch").oninput=renderPopover;
$("#popoverList").onclick=e=>{
  const lore=e.target.closest("[data-lore-option]"); if(lore){state.lorebook=!state.lorebook;render();renderPopover();return;}
  const b=e.target.closest("[data-option]"); if(!b)return; toggle(activeFilter,b.dataset.option);render();renderPopover();
};
$("#popoverDone").onclick=()=>$("#popover").hidden=true;
$("#popoverReset").onclick=()=>{
  if(activeFilter==="tag")state.tags.clear();
  if(activeFilter==="author")state.authors.clear();
  if(activeFilter==="universe")state.universes.clear();
  if(activeFilter==="pov")state.povs.clear();
  if(activeFilter==="lorebook")state.lorebook=false;
  render();renderPopover();
};

// Secondary filters: POV + Universe
$("#moreTrigger").onclick=e=>{e.stopPropagation();const m=$("#moreMenu"),r=e.currentTarget.getBoundingClientRect();m.hidden=!m.hidden;m.style.left=Math.max(8,Math.min(r.left,innerWidth-340))+"px";m.style.top=(r.bottom+7)+"px";renderMoreMenu()};
function renderMoreMenu(){
  $("#morePov").innerHTML=["AnyPOV","FemPOV","MalePOV"].map(v=>`<button class="${state.povs.has(v)?'active':''}" data-more-pov="${v}"><span>${esc(povLabel(v))}</span></button>`).join("");
  const q=($("#moreUniverseSearch")?.value||"").toLowerCase();
  $("#moreUniverse").innerHTML=uniq("universe").filter(v=>v.toLowerCase().includes(q)).map(v=>`<button class="${state.universes.has(v)?'active':''}" data-more-universe="${esc(v)}"><span>${esc(v)}</span><small>${count('universe',v)}</small></button>`).join("");
}
$("#morePov").onclick=e=>{const b=e.target.closest("[data-more-pov]");if(!b)return;toggle("pov",b.dataset.morePov);render()};
$("#moreUniverse").onclick=e=>{const b=e.target.closest("[data-more-universe]");if(!b)return;toggle("universe",b.dataset.moreUniverse);render()};
$("#moreUniverseSearch").oninput=renderMoreMenu;
$("#moreReset").onclick=()=>{state.povs.clear();state.universes.clear();render()};
$("#moreDone").onclick=()=>$("#moreMenu").hidden=true;

// Sort
$("#sortTrigger").onclick=e=>{e.stopPropagation();const r=e.currentTarget.getBoundingClientRect(),m=$("#sortMenu");m.hidden=!m.hidden;m.style.left=Math.max(8,Math.min(r.left,innerWidth-178))+"px";m.style.top=(r.bottom+7)+"px"};
$("#sortMenu").onclick=e=>{const b=e.target.closest("[data-sort]");if(!b)return;state.sort=b.dataset.sort;$("#sortLabel").textContent={newest:"NEWEST",az:"A → Z",za:"Z → A",author:"AUTHOR"}[state.sort];$("#sortMenu").hidden=true;render()};

// Drawer
function openDrawer(){$("#catalogDrawer").classList.add("open");$("#catalogDrawer").setAttribute("aria-hidden","false");$("#drawerShade").hidden=false}
function closeDrawer(){$("#catalogDrawer").classList.remove("open");$("#catalogDrawer").setAttribute("aria-hidden","true");$("#drawerShade").hidden=true}
$("#catalogOpen").onclick=openDrawer;$("#catalogClose").onclick=closeDrawer;$("#drawerShade").onclick=closeDrawer;
$$('.drawer-tab').forEach(b=>b.onclick=()=>{drawerTab=b.dataset.drawerTab;$$('.drawer-tab').forEach(x=>x.classList.toggle('active',x===b));$("#drawerSearch").value="";renderDrawer()});
$("#drawerSearch").oninput=renderDrawer;
function renderDrawer(){
  const q=($("#drawerSearch").value||"").toLowerCase();
  const vals=(drawerTab==="tag"?allTags():drawerTab==="author"?uniq("author"):uniq("universe")).filter(v=>v.toLowerCase().includes(q));
  $("#drawerList").innerHTML=vals.map(v=>`<button class="drawer-item" data-drawer-value="${esc(v)}"><span>${esc(drawerTab==="tag"?tagLabel(v):drawerTab==="author"?'@'+v:v)}</span><small>${count(drawerTab,v)}</small></button>`).join("");
}
$("#drawerList").onclick=e=>{const b=e.target.closest("[data-drawer-value]");if(!b)return;const v=b.dataset.drawerValue;if(drawerTab==="author")state.authors.add(v);if(drawerTab==="universe")state.universes.add(v);if(drawerTab==="tag")state.tags.add(v);render();closeDrawer()};

// Tag rail scroll + expansion
$("#toggleAllTags").onclick=()=>{tagsExpanded=!tagsExpanded;renderQuickTags()};
$("#clearQuickTags").onclick=()=>{state.tags.clear();render()};
const tagRail=$("#tagQuick");
tagRail.addEventListener("wheel",e=>{if(tagsExpanded)return;if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){e.preventDefault();tagRail.scrollLeft+=e.deltaY}}, {passive:false});
let drag=false,startX=0,startScroll=0;
tagRail.addEventListener("pointerdown",e=>{if(tagsExpanded)return;drag=true;startX=e.clientX;startScroll=tagRail.scrollLeft;tagRail.setPointerCapture(e.pointerId)});
tagRail.addEventListener("pointermove",e=>{if(!drag||tagsExpanded)return;tagRail.scrollLeft=startScroll-(e.clientX-startX)});
tagRail.addEventListener("pointerup",()=>drag=false);tagRail.addEventListener("pointercancel",()=>drag=false);

$("#searchInput").oninput=e=>{state.q=e.target.value;render()};
$("#resetBtn").onclick=resetAll;
function resetAll(){state.q="";state.authors.clear();state.universes.clear();state.tags.clear();state.povs.clear();state.lorebook=false;state.sort="newest";$("#searchInput").value="";$("#sortLabel").textContent="NEWEST";render()}

document.addEventListener("click",e=>{
  if(!e.target.closest("#popover")&&!e.target.closest(".filter-trigger"))$("#popover").hidden=true;
  if(!e.target.closest("#sortMenu")&&!e.target.closest("#sortTrigger"))$("#sortMenu").hidden=true;
  if(!e.target.closest("#moreMenu")&&!e.target.closest("#moreTrigger"))$("#moreMenu").hidden=true;
  if(e.target.closest("[data-stop]")){e.stopPropagation();return}
  const rem=e.target.closest("[data-remove]");if(rem){const m={author:"authors",universe:"universes",tag:"tags",pov:"povs"};m[rem.dataset.remove]?state[m[rem.dataset.remove]].delete(rem.dataset.value):state.lorebook=false;render();return}
  const au=e.target.closest("[data-author]");if(au){e.stopPropagation();state.authors.clear();state.authors.add(au.dataset.author);closeModal();render();return}
  const tg=e.target.closest("[data-tag]");if(tg){e.stopPropagation();toggle("tag",tg.dataset.tag);closeModal();render();return}
  const qt=e.target.closest("[data-quick-tag]");if(qt){toggle("tag",qt.dataset.quickTag);render();return}
  const qu=e.target.closest("[data-quick-universe]");if(qu){toggle("universe",qu.dataset.quickUniverse);closeModal();render();return}
  const card=e.target.closest(".card");if(card)openModal(B.find(b=>b.id===card.dataset.id));
  if(e.target.matches("[data-close]"))closeModal();
});

// Random + modal
$("#randomBtn").onclick=()=>{const btn=$("#randomBtn");btn.classList.add("active");btn.querySelector("span:last-child").textContent="SEARCHING...";setTimeout(()=>{btn.classList.remove("active");btn.querySelector("span:last-child").textContent="RANDOM";randomModal()},240)};
$("#prevBot").onclick=randomModal;$("#nextBot").onclick=randomModal;
function randomModal(){let pool=applyFilters().filter(b=>!current||b.id!==current.id);if(!pool.length)pool=B.filter(b=>!current||b.id!==current.id);if(pool.length)openModal(pool[Math.floor(Math.random()*pool.length)])}
function openModal(b){
  current=b;modalTab="description";$("#modalImage").src=b.image;$("#modalTitle").innerHTML=`${esc(b.nameEn)}<span>${esc(b.nameRu)}</span>`;
  $("#modalAuthor").textContent=`@${b.author}`;$("#modalAuthor").dataset.author=b.author;$("#modalAuthorBadge").textContent=`@${b.author}`;$("#modalAuthorBadge").dataset.author=b.author;
  $("#modalUniverse").innerHTML=`${globeSvg}<span>UNIVERSE / ${esc(b.universe)}</span>`;$("#modalUniverse").dataset.quickUniverse=b.universe;
  $("#modalLoreFlag").innerHTML=b.lorebook?`${bookSvg} LOREBOOK AVAILABLE`:"";$("#modalPov").textContent=povLabel(b.pov);$("#modalText").textContent=b.short;
  $("#modalTags").innerHTML=(b.tags||[]).map(t=>`<button data-tag="${esc(t)}">${esc(tagLabel(t))}</button>`).join("");$("#openBot").href=b.url;$("#openBot").textContent=`OPEN ON ${b.platform} →`;$("#downloadBot").href=b.download;
  const l=$("#downloadLore");if(b.lorebook){l.href=b.lorebook;l.classList.remove("disabled");l.textContent="LOREBOOK ↓"}else{l.removeAttribute("href");l.classList.add("disabled");l.textContent="NO LOREBOOK"}
  $$('.modal-tab').forEach(t=>t.classList.toggle('active',t.dataset.modalTab==='description'));$("#modal").hidden=false;document.body.style.overflow="hidden";
}
function closeModal(){$("#modal").hidden=true;document.body.style.overflow=""}
$$('.modal-tab').forEach(t=>t.onclick=()=>{if(!current)return;modalTab=t.dataset.modalTab;$$('.modal-tab').forEach(x=>x.classList.toggle('active',x===t));$("#modalText").textContent=modalTab==="description"?current.short:current.full});

// Easter egg
const terminalScripts=[
  ["ACCESSING LOST DIRECTORY...","FILE_001: CORRUPTED","RECOVERY STATUS: 17%","Someone left a record here. It does not belong to any known universe."],
  ["SCANNING UNUSED INDEX...","SIGNAL DETECTED","SOURCE: UNKNOWN","The archive insists there are only " + B.length + " records. The archive is lying."],
  ["RECOVERY ATTEMPT #07...","CHECKSUM MISMATCH","FRAGMENT: /stories/???","Come back when the directory remembers its own name."]
];
let terminalIndex=0;
function showTerminal(){renderTerminal();$("#lostTerminal").hidden=false}
function hideTerminal(){$("#lostTerminal").hidden=true}
function renderTerminal(){const lines=terminalScripts[terminalIndex%terminalScripts.length];$("#terminalLines").innerHTML=lines.map((x,i)=>`<div class="${i===1?'warn':i===2?'ok':''}">&gt; ${esc(x)}</div>`).join("")}
$("#lostFileBtn").onclick=showTerminal;$("#terminalRetry").onclick=()=>{terminalIndex++;renderTerminal()};$$('[data-terminal-close]').forEach(x=>x.onclick=hideTerminal);

document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeModal();closeDrawer();$("#popover").hidden=true;$("#sortMenu").hidden=true;$("#moreMenu").hidden=true;hideTerminal()}if(!$("#modal").hidden&&["ArrowRight","ArrowLeft"].includes(e.key))randomModal()});

render();
