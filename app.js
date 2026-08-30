let B = [];
function syncBots(){
  const source = window.BOTS;
  if(Array.isArray(source)) B = source;
  return B;
}
syncBots();
const TAG_META = window.TAG_META || {};
const TAG_ORDER = window.TAG_ORDER || Object.keys(TAG_META);
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const state = { q:"", authors:new Set(), universes:new Set(), tags:new Set(), hashtags:new Set(), povs:new Set(), lorebook:false, sort:"newest" };
let activeFilter = null, drawerTab = "tag", drawerSort = "az", current = null, modalTab = "description", tagsExpanded = false, openIntro = 0;

const bookSvg = `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 5.5c3.2-.9 5.7-.6 8.5 1.1v12c-2.8-1.7-5.3-2-8.5-1.1zM20.5 5.5c-3.2-.9-5.7-.6-8.5 1.1v12c2.8-1.7 5.3-2 8.5-1.1z"/></svg>`;
const globeSvg = `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.8 12h16.4M12 3.5c2.2 2.4 3.4 5.2 3.4 8.5S14.2 18.1 12 20.5M12 3.5C9.8 5.9 8.6 8.7 8.6 12s1.2 6.1 3.4 8.5"/></svg>`;
const eyeSvg = `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.3-5.5 9.5-5.5S21.5 12 21.5 12 18.2 17.5 12 17.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>`;

const tagLabel = t => `${TAG_META[t] || ""} ${t}`.trim();
const povLabel = p => p === "AnyPOV" ? "◌ AnyPOV" : p === "FemPOV" ? "♀ FemPOV" : p === "MalePOV" ? "♂ MalePOV" : p;
const uniq = key => [...new Set(B.map(x => x[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
const allTags = () => TAG_ORDER.filter(t => TAG_META[t]);
const allHashtags = () => [...new Set(B.flatMap(b => b.hashtags || []))].sort((a,b)=>a.localeCompare(b));

function selectionCoversAll(set, values){
  return values.length > 0 && values.every(v => set.has(v));
}

function count(kind, val){
  if(kind === "tag") return B.filter(b => (b.tags||[]).includes(val)).length;
  if(kind === "author") return B.filter(b => b.author === val).length;
  if(kind === "universe") return B.filter(b => b.universe === val).length;
  if(kind === "pov") return B.filter(b => b.pov === val).length;
  if(kind === "hashtag") return B.filter(b => (b.hashtags||[]).includes(val)).length;
  return 0;
}

function applyFilters(){
  syncBots();
  const q = state.q.trim().toLowerCase();
  let list = B.filter(b => {
    const hay = [b.nameRu,b.nameEn,b.author,b.universe,b.pov,b.short,b.full,...(b.tags||[]),...(b.hashtags||[])].join(" ").toLowerCase();
    if(q && !hay.includes(q)) return false;
    const allAuthorsSelected = selectionCoversAll(state.authors, uniq("author"));
    const allUniversesSelected = selectionCoversAll(state.universes, uniq("universe"));
    if(state.authors.size && !allAuthorsSelected && !state.authors.has(b.author)) return false;
    if(state.universes.size && !allUniversesSelected && !state.universes.has(b.universe)) return false;
    if(state.povs.size && !state.povs.has(b.pov)) return false;
    if(state.lorebook && !b.lorebook) return false;
    if([...state.tags].some(t => !(b.tags||[]).includes(t))) return false; // AND logic
    if([...state.hashtags].some(h => !(b.hashtags||[]).includes(h))) return false; // hashtag AND logic
    return true;
  });
  if(state.sort === "az") list.sort((a,b)=>a.nameEn.localeCompare(b.nameEn));
  if(state.sort === "za") list.sort((a,b)=>b.nameEn.localeCompare(a.nameEn));
  if(state.sort === "author") list.sort((a,b)=>a.author.localeCompare(b.author)||a.nameEn.localeCompare(b.nameEn));
  if(state.sort === "newest") list.sort((a,b)=>Number(b.isNew)-Number(a.isNew));
  return list;
}

function hasActiveFilters(){
  return !!(
    state.q.trim() ||
    state.authors.size ||
    state.universes.size ||
    state.tags.size ||
    state.hashtags.size ||
    state.povs.size ||
    state.lorebook ||
    state.sort !== "newest"
  );
}

function render(){
  syncBots();
  const list = applyFilters();
  const filtered = hasActiveFilters();
  $("#resultCount").textContent = list.length;
  const meta = $("#catalogMeta");
  const reset = $("#resetBtn");
  const catalogOpen = $("#catalogOpen");
  if(meta) meta.classList.toggle("has-filters", filtered);
  if(catalogOpen) catalogOpen.classList.toggle("has-filters", filtered);
  if(reset) reset.hidden = !filtered;
  $("#totalMeta").textContent = `${String(B.length).padStart(3,"0")} RECORDS`;
  $("#empty").hidden = !!list.length;
  $("#grid").innerHTML = list.map((b,i)=>cardHtml(b,i)).join("");
  renderQuickTags();
  renderActiveFilters();
  renderCounts();
  renderDrawer();

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
      <div class="card-meta card-system-line">
        <button class="meta-token" data-quick-universe="${esc(b.universe)}">${globeSvg}<span>${esc(b.universe)}</span></button>
        <span class="card-status-icon card-pov-icon pov-${esc((b.pov||'AnyPOV').toLowerCase())}" title="${esc(b.pov||'AnyPOV')}" aria-label="POV: ${esc(b.pov||'AnyPOV')}">
          <span aria-hidden="true">${b.pov==='FemPOV'?'♀':b.pov==='MalePOV'?'♂':'◎'}</span>
        </span>
        ${b.lorebook?`<span class="card-status-icon card-lore-icon" title="Lorebook available" aria-label="Lorebook available">${bookSvg}</span>`:''}
      </div>
      <p class="card-short">${esc(b.short)}</p>
      <div class="card-tags">${shown.map(t=>`<button data-tag="${esc(t)}">${esc(tagLabel(t))}</button>`).join("")}${more>0?`<span class="tag-more">+${more}</span>`:''}</div>
      ${(b.hashtags||[]).length?`<div class="card-hashtags">${(b.hashtags||[]).slice(0,3).map(h=>`<button data-hashtag="${esc(h)}">#${esc(h)}</button>`).join("")}${(b.hashtags||[]).length>3?`<span>+${(b.hashtags||[]).length-3}</span>`:''}</div>`:''}
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
  // Direct toggles (tags / POV / lorebook) already show their state on the controls themselves.
  // Keep this row only for filters that otherwise have no persistent visible state.
  const chips = [];
  state.authors.forEach(v=>chips.push(["author",v,`@ ${v}`]));
  state.universes.forEach(v=>chips.push(["universe",v,`UNIVERSE / ${v}`]));
  state.hashtags.forEach(v=>chips.push(["hashtag",v,`#${v}`]));
  const box = $("#activeFilters");
  box.classList.toggle("has", chips.length>0);
  box.innerHTML = chips.map(([type,value,label])=>`<button class="filter-chip" data-remove="${type}" data-value="${esc(value)}">${esc(label)} ×</button>`).join("");
}

function renderCounts(){
  setCount("#authorCount", state.authors.size);
  setCount("#hashtagCount", state.hashtags.size);
  setCount("#universeCount", state.universes.size);
  $$('.filter-trigger[data-filter="author"]').forEach(b=>b.classList.toggle("active",state.authors.size>0));
  $("#loreToggle").classList.toggle("active",state.lorebook);
  $("#loreToggle").setAttribute("aria-pressed",state.lorebook?"true":"false");
  const ht=$(".hashtag-trigger"); if(ht) ht.classList.toggle("active",state.hashtags.size>0);
  const ut=$(".universe-trigger"); if(ut) ut.classList.toggle("active",state.universes.size>0);
  renderPovCycle();
}
function setCount(sel,n){const e=$(sel);if(!e)return;e.textContent=n||"";e.classList.toggle("has-count",!!n)}

function toggle(kind,val){
  const map={tag:"tags",author:"authors",universe:"universes",pov:"povs",hashtag:"hashtags"};
  const set=state[map[kind]]; if(!set)return;
  set.has(val)?set.delete(val):set.add(val);
}

function valuesForFilter(kind){
  if(kind === "tag") return allTags();
  if(kind === "author") return uniq("author");
  if(kind === "universe") return uniq("universe");
  if(kind === "pov") return ["AnyPOV","FemPOV","MalePOV"];
  if(kind === "hashtag") return allHashtags();
  return [];
}

function closeFloatingMenus(except=""){
  if(except!=="popover") $("#popover").hidden=true;
  if(except!=="sort") $("#sortMenu").hidden=true;
}

function openPopover(btn,kind){
  closeFloatingMenus("popover");
  activeFilter=kind;
  const pop=$("#popover");
  const r=btn.getBoundingClientRect();
  pop.hidden=false;
  pop.style.left=Math.max(8,Math.min(r.left + scrollX,scrollX+innerWidth-270))+"px";
  pop.style.top=(r.bottom + scrollY + 7)+"px";
  $("#popoverSearch").value="";
  renderPopover();
}
function renderPopover(){
  const q=($("#popoverSearch").value||"").toLowerCase();
  const vals=valuesForFilter(activeFilter).filter(v=>v.toLowerCase().includes(q));
  const selected = activeFilter==="tag"?state.tags:activeFilter==="author"?state.authors:activeFilter==="universe"?state.universes:activeFilter==="hashtag"?state.hashtags:state.povs;
  $("#popoverList").innerHTML=vals.map(v=>`<button class="${selected.has(v)?'active':''}" data-option="${esc(v)}"><span>${esc(activeFilter==="tag"?tagLabel(v):activeFilter==="pov"?povLabel(v):activeFilter==="author"?'@ '+v:activeFilter==="hashtag"?'#'+v:v)}</span><small>${count(activeFilter,v)}</small></button>`).join("");
}

$$('.filter-trigger').forEach(b=>b.onclick=e=>{e.stopPropagation();openPopover(b,b.dataset.filter)});
$("#popoverSearch").oninput=renderPopover;
$("#popoverList").onclick=e=>{
  const b=e.target.closest("[data-option]"); if(!b)return; toggle(activeFilter,b.dataset.option);render();renderPopover();
};
$("#popoverDone").onclick=()=>$("#popover").hidden=true;
$("#popoverReset").onclick=()=>{
  if(activeFilter==="tag")state.tags.clear();
  if(activeFilter==="author")state.authors.clear();
  if(activeFilter==="universe")state.universes.clear();
  if(activeFilter==="pov")state.povs.clear();
  if(activeFilter==="hashtag")state.hashtags.clear();
  render();renderPopover();
};

$("#loreToggle").addEventListener("click",e=>{
  e.preventDefault();
  e.stopPropagation();
  state.lorebook=!state.lorebook;
  render();
});

// POV is a compact cycle: Any -> Male -> Fem -> Any. It layers with every other filter.
const POV_CYCLE=["AnyPOV","MalePOV","FemPOV"];
function currentPov(){ return state.povs.size ? [...state.povs][0] : "AnyPOV"; }
function renderPovCycle(){
  const btn=$("#povCycle"); if(!btn)return;
  const pov=currentPov();
  const label=pov==="MalePOV"?"MALE POV":pov==="FemPOV"?"FEM POV":"ANY POV";
  btn.dataset.pov=pov; btn.querySelector(".pov-cycle-label").textContent=label;
  btn.title=`POV: ${pov}`; btn.setAttribute("aria-label",`POV filter: ${pov}`);
  btn.classList.toggle("active",pov!=="AnyPOV");
}
$("#povCycle").onclick=e=>{
  e.preventDefault(); e.stopPropagation();
  const cur=currentPov(), next=POV_CYCLE[(POV_CYCLE.indexOf(cur)+1)%POV_CYCLE.length];
  state.povs.clear(); if(next!=="AnyPOV")state.povs.add(next); render();
};

// Sort
$("#sortTrigger").onclick=e=>{
  e.stopPropagation();
  closeFloatingMenus("sort");
  const r=e.currentTarget.getBoundingClientRect(),m=$("#sortMenu");
  m.hidden=!m.hidden;
  m.style.left=Math.max(8,Math.min(r.left+scrollX,scrollX+innerWidth-178))+"px";
  m.style.top=(r.bottom+scrollY+7)+"px";
};
$("#sortMenu").onclick=e=>{const b=e.target.closest("[data-sort]");if(!b)return;state.sort=b.dataset.sort;$("#sortLabel").textContent={newest:"NEWEST",az:"A → Z",za:"Z → A",author:"AUTHOR"}[state.sort];$("#sortMenu").hidden=true;render()};

// Drawer
function openDrawer(){$("#catalogDrawer").classList.add("open");$("#catalogDrawer").setAttribute("aria-hidden","false");$("#drawerShade").hidden=false}
function closeDrawer(){$("#catalogDrawer").classList.remove("open");$("#catalogDrawer").setAttribute("aria-hidden","true");$("#drawerShade").hidden=true}
$("#catalogOpen").onclick=openDrawer;$("#catalogClose").onclick=closeDrawer;$("#drawerShade").onclick=closeDrawer;
$$('.drawer-tab').forEach(b=>b.onclick=()=>{drawerTab=b.dataset.drawerTab;$$('.drawer-tab').forEach(x=>x.classList.toggle('active',x===b));$("#drawerSearch").value="";renderDrawer()});
$("#drawerSearch").oninput=renderDrawer;
$("#drawerSortCycle").onclick=()=>{
  const order=["az","za","most","least"];
  drawerSort=order[(order.indexOf(drawerSort)+1)%order.length];
  renderDrawer();
};
function drawerSelectionCount(){
  if(drawerTab==="tag") return state.tags.size;
  if(drawerTab==="author") return state.authors.size;
  if(drawerTab==="universe") return state.universes.size;
  return 0;
}
function drawerActiveCount(vals){
  return vals.filter(v=>count(drawerTab,v)>0).length;
}
function renderDrawer(){
  const q=($("#drawerSearch").value||"").trim().toLowerCase();
  const allVals=(drawerTab==="tag"?allTags():drawerTab==="author"?uniq("author"):uniq("universe"));
  let vals=allVals.filter(v=>v.toLowerCase().includes(q));

  vals.sort((a,b)=>{
    if(drawerSort==="za") return b.localeCompare(a,undefined,{sensitivity:"base"});
    if(drawerSort==="most") return count(drawerTab,b)-count(drawerTab,a) || a.localeCompare(b,undefined,{sensitivity:"base"});
    if(drawerSort==="least") return count(drawerTab,a)-count(drawerTab,b) || a.localeCompare(b,undefined,{sensitivity:"base"});
    return a.localeCompare(b,undefined,{sensitivity:"base"});
  });

  const list=$("#drawerList");
  if(!list) return;
  list.dataset.layout=drawerTab;
  $("#drawerTotal").textContent=`${String(B.length).padStart(3,"0")} RECORDS`;
  $("#drawerFootStatus").textContent=q?`${String(vals.length).padStart(2,"0")} MATCHES`:"STABLE";

  const sortBtn=$("#drawerSortCycle");
  if(sortBtn) sortBtn.querySelector("b").textContent=({az:"A→Z",za:"Z→A",most:"MOST",least:"LEAST"})[drawerSort];

  if(drawerTab==="tag"){
    list.innerHTML=vals.map(v=>`<button class="drawer-item drawer-tag-item ${state.tags.has(v)?'selected':''}" data-drawer-value="${esc(v)}"><span class="drawer-item-name">${esc(tagLabel(v))}</span><small>${String(count("tag",v)).padStart(2,"0")}</small></button>`).join("");
    return;
  }
  if(drawerTab==="author"){
    list.innerHTML=vals.map(v=>`<button class="drawer-item drawer-author-item ${state.authors.has(v)?'selected':''}" data-drawer-value="${esc(v)}"><span class="drawer-author-copy"><b>@${esc(v)}</b><small>${String(count("author",v)).padStart(2,"0")} RECORDS</small></span><i>→</i></button>`).join("");
    return;
  }
  list.innerHTML=vals.map((v,i)=>`<button class="drawer-item drawer-world-item ${state.universes.has(v)?'selected':''}" data-drawer-value="${esc(v)}"><span class="drawer-world-id">WORLD_${String(i+1).padStart(2,"0")}</span><span class="drawer-world-copy"><b>${esc(v)}</b><small>${String(count("universe",v)).padStart(2,"0")} RECORDS</small></span><i>→</i></button>`).join("");
}
$("#drawerList").onclick=e=>{
  const b=e.target.closest("[data-drawer-value]"); if(!b)return;
  e.stopPropagation();
  const v=b.dataset.drawerValue;
  if(drawerTab==="author") toggle("author",v);
  if(drawerTab==="universe") toggle("universe",v);
  if(drawerTab==="tag") toggle("tag",v);
  render();
};

// Tag rail scroll + expansion
$("#toggleAllTags").onclick=()=>{tagsExpanded=!tagsExpanded;renderQuickTags()};
$("#clearQuickTags").onclick=()=>{state.tags.clear();render()};
const tagRail=$("#tagQuick");
tagRail.addEventListener("wheel",e=>{if(tagsExpanded)return;if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){e.preventDefault();tagRail.scrollLeft+=e.deltaY}}, {passive:false});
let drag=false,startX=0,startScroll=0;
tagRail.addEventListener("pointerdown",e=>{
  if(tagsExpanded || e.target.closest("button")) return;
  drag=true;startX=e.clientX;startScroll=tagRail.scrollLeft;tagRail.setPointerCapture(e.pointerId);
});
tagRail.addEventListener("pointermove",e=>{if(!drag||tagsExpanded)return;tagRail.scrollLeft=startScroll-(e.clientX-startX)});
tagRail.addEventListener("pointerup",()=>drag=false);tagRail.addEventListener("pointercancel",()=>drag=false);
// Handle quick tags directly on the rail so drag scrolling can never swallow button clicks.
tagRail.addEventListener("click",e=>{
  const btn=e.target.closest("[data-quick-tag]");
  if(!btn)return;
  e.stopPropagation();
  toggle("tag",btn.dataset.quickTag);
  render();
});

$("#searchInput").oninput=e=>{state.q=e.target.value;render()};
$("#resetBtn").onclick=resetAll;
function resetAll(){state.q="";state.authors.clear();state.universes.clear();state.tags.clear();state.hashtags.clear();state.povs.clear();state.lorebook=false;state.sort="newest";$("#searchInput").value="";$("#sortLabel").textContent="NEWEST";render()}

document.addEventListener("click",e=>{
  if(!e.target.closest("#popover")&&!e.target.closest(".filter-trigger"))$("#popover").hidden=true;
  if(!e.target.closest("#sortMenu")&&!e.target.closest("#sortTrigger"))$("#sortMenu").hidden=true;
  if(e.target.closest("[data-stop]")){e.stopPropagation();return}
  const rem=e.target.closest("[data-remove]");if(rem){const m={author:"authors",universe:"universes",tag:"tags",pov:"povs",hashtag:"hashtags"};m[rem.dataset.remove]?state[m[rem.dataset.remove]].delete(rem.dataset.value):state.lorebook=false;render();return}
  const au=e.target.closest("[data-author]");if(au){e.stopPropagation();state.authors.clear();state.authors.add(au.dataset.author);closeModal();render();return}
  const tg=e.target.closest("[data-tag]");if(tg){e.stopPropagation();toggle("tag",tg.dataset.tag);closeModal();render();return}
  const hs=e.target.closest("[data-hashtag]");if(hs){e.stopPropagation();toggle("hashtag",hs.dataset.hashtag);closeModal();render();return}
  const qu=e.target.closest("[data-quick-universe]");if(qu){toggle("universe",qu.dataset.quickUniverse);closeModal();render();return}
  const card=e.target.closest(".card");if(card)openModal(B.find(b=>b.id===card.dataset.id));
  if(e.target.matches("[data-close]"))closeModal();
});

// Random + modal
const randomWhispers=["RECOVERING LOST RECORD...","UNINDEXED TRACE DETECTED","ARCHIVE ROUTE SHIFTED","FOUND BETWEEN DIRECTORIES","SIGNAL FROM NODE_??"];
function archiveWhisper(text,rare=false){const box=$("#archiveWhisper");$("#whisperText").textContent=text;box.classList.toggle("rare",rare);box.hidden=false;requestAnimationFrame(()=>box.classList.add("show"));clearTimeout(archiveWhisper.timer);archiveWhisper.timer=setTimeout(()=>{box.classList.remove("show");setTimeout(()=>box.hidden=true,220)},2600)}
$("#randomBtn").onclick=()=>{
  const btn=$("#randomBtn");
  btn.classList.add("active");
  btn.querySelector("span:last-child").textContent="SEARCHING...";
  const unknownHit=Math.random()<.01;
  if(unknownHit){
    setTimeout(()=>showUnknownRecord(()=>{btn.classList.remove("active");btn.querySelector("span:last-child").textContent="RANDOM";randomModal()}),180);
    return;
  }
  if(Math.random()<.12)archiveWhisper(randomWhispers[Math.floor(Math.random()*randomWhispers.length)],true);
  setTimeout(()=>{btn.classList.remove("active");btn.querySelector("span:last-child").textContent="RANDOM";randomModal()},240);
};
$("#prevBot").onclick=()=>browseModal(-1);
$("#nextBot").onclick=()=>browseModal(1);

function browseModal(direction){
  const pool=applyFilters().length?applyFilters():B;
  if(!pool.length) return;
  let index=current?pool.findIndex(b=>b.id===current.id):-1;
  if(index<0) index=0;
  index=(index+direction+pool.length)%pool.length;
  switchModalRecord(pool[index],direction);
}

function randomModal(){
  let pool=applyFilters().filter(b=>!current||b.id!==current.id);
  if(!pool.length) pool=B.filter(b=>!current||b.id!==current.id);
  if(pool.length) switchModalRecord(pool[Math.floor(Math.random()*pool.length)], Math.random()<.5?-1:1);
}

let modalSwitching=false;
function switchModalRecord(b,direction=1){
  const modal=$("#modal");
  const card=document.querySelector(".modal-card");
  if(!b) return;

  if(modal.hidden || !current || !card){
    openModal(b);
    return;
  }
  if(modalSwitching) return;
  modalSwitching=true;

  // Render once, then give the new record one very short directional nudge.
  // No outgoing clone, no second image animation, no delayed duplicate state.
  openModal(b,true);

  if(card.getAnimations){
    card.getAnimations().forEach(a=>{
      if(a.animationName!=="modalIn") a.cancel();
    });
  }

  const fromX=direction>0?10:-10;
  const anim=card.animate(
    [
      {opacity:.48, transform:`translate3d(${fromX}px,0,0) scale(.997)`},
      {opacity:1, transform:"translate3d(0,0,0) scale(1)"}
    ],
    {
      duration:145,
      easing:"cubic-bezier(.2,.75,.25,1)",
      fill:"both"
    }
  );
  anim.onfinish=()=>{modalSwitching=false; anim.cancel()};
  anim.oncancel=()=>{modalSwitching=false};
}

function openModal(b,keepOpen=false){
  current=b;
  modalTab="description";
  openIntro=0;
  $("#modalImage").src=b.image;
  $("#modalTitle").innerHTML=`${esc(b.nameEn)}<span>${esc(b.nameRu)}</span>`;
  $("#modalAuthor").textContent=`@${b.author}`;
  $("#modalAuthor").dataset.author=b.author;
  $("#modalAuthorBadge").textContent=`@${b.author}`;
  $("#modalAuthorBadge").dataset.author=b.author;
  $("#modalUniverse").innerHTML=`${globeSvg}<span>UNIVERSE / ${esc(b.universe)}</span>`;
  $("#modalUniverse").dataset.quickUniverse=b.universe;
  $("#modalLoreFlag").innerHTML=b.lorebook?bookSvg:"";
  $("#modalLoreFlag").title=b.lorebook?"Lorebook available":"";
  $("#modalPov").textContent=povLabel(b.pov);
  $("#modalTags").innerHTML=`<div class="modal-primary-tags">${(b.tags||[]).map(t=>`<button data-tag="${esc(t)}">${esc(tagLabel(t))}</button>`).join("")}</div>${(b.hashtags||[]).length?`<div class="modal-hashtags">${(b.hashtags||[]).map(h=>`<button data-hashtag="${esc(h)}">#${esc(h)}</button>`).join("")}</div>`:''}`;
  $("#openBot").href=b.url;
  $("#openBot").textContent=`OPEN ON ${b.platform} ↗`;
  $("#openAuthor").href=b.authorUrl||b.url;
  $("#openAuthor").textContent=`@${b.author} ↗`;
  $("#downloadBot").href=b.download;
  const l=$("#downloadLore");
  if(b.lorebook){
    l.href=b.lorebook;
    l.classList.remove("disabled");
    l.textContent="DOWNLOAD LOREBOOK ↓";
  }else{
    l.removeAttribute("href");
    l.classList.add("disabled");
    l.textContent="LOREBOOK — NOT AVAILABLE";
  }
  $("#downloadBot").textContent="DOWNLOAD BOT CARD ↓";
  $$('.modal-tab').forEach(t=>t.classList.toggle('active',t.dataset.modalTab==='description'));
  renderModalPanel();
  if(!keepOpen){
    $("#modal").hidden=false;
    document.body.style.overflow="hidden";
  }
}
function closeModal(){$("#modal").hidden=true;document.body.style.overflow=""}
function renderModalPanel(){
  const panel=$("#modalPanel");
  if(!current){panel.innerHTML="";return}
  if(modalTab==="description"){
    panel.innerHTML=`<p class="modal-copy">${esc(current.short)}</p>`;
    return;
  }
  if(modalTab==="scenario"){
    panel.innerHTML=`<p class="modal-copy">${esc(current.full)}</p>`;
    return;
  }
  const intros=(current.intros&&current.intros.length?current.intros:["No intro message added."]);
  const buttons=intros.map((_,i)=>`<button class="intro-choice ${openIntro===i?'active':''}" data-intro-index="${i}">INTRO ${String(i+1).padStart(2,'0')}</button>`).join("");
  const body=openIntro>=0?`<div class="intro-display show">${esc(intros[openIntro])}</div>`:`<div class="intro-display intro-empty">SELECT AN INTRO</div>`;
  panel.innerHTML=`<div class="modal-intros"><div class="intro-choices">${buttons}</div>${body}</div>`;
}
$("#modalPanel").addEventListener("click",e=>{
  const b=e.target.closest("[data-intro-index]");
  if(!b)return;
  const i=Number(b.dataset.introIndex);
  openIntro=openIntro===i?-1:i;
  renderModalPanel();
});
$$('.modal-tab').forEach(t=>t.onclick=()=>{
  if(!current)return;
  modalTab=t.dataset.modalTab;
  if(modalTab==="intro" && openIntro<0) openIntro=0;
  $$('.modal-tab').forEach(x=>x.classList.toggle('active',x===t));
  renderModalPanel();
});

// Small archive anomalies: decorative only, never block interaction.
const anomalyTargets=["#catalogOpen",".hashtag-trigger",".universe-trigger","#sortTrigger","#loreToggle","#povCycle","#randomBtn"];
anomalyTargets.forEach(sel=>{const el=$(sel);if(!el)return;el.addEventListener("mouseenter",()=>{if(Math.random()<.045){el.classList.add("archive-flicker");setTimeout(()=>el.classList.remove("archive-flicker"),620)}})});

// Easter egg — LOST DIRECTORY
let terminalTypingToken=0;
let terminalBusy=false;

function terminalSeenCount(){
  try{return Number(localStorage.getItem("archiveLostDirectorySeen")||0)}catch(_){return 0}
}
function bumpTerminalSeen(){
  const n=terminalSeenCount()+1;
  try{localStorage.setItem("archiveLostDirectorySeen",String(n))}catch(_){}
  return n;
}
function terminalIntroFor(seen){
  if(seen>=5) return [
    ["ACCESSING LOST DIRECTORY...","normal"],
    ["You again?","warn"],
    ["FILE_001 refuses recovery.","warn"],
    ["FILE_002 detected.","ok"],
    ["INDEX ACCESS: DENIED","warn"]
  ];
  if(seen===3 || seen===4) return [
    ["ACCESSING LOST DIRECTORY...","normal"],
    ["SESSION SIGNATURE RECOGNIZED","ok"],
    ["You have been here before.","warn"],
    ["RECOVERY STATUS: 17%","ok"],
    ["Do not trust the percentage.","normal"]
  ];
  return [
    ["ACCESSING LOST DIRECTORY...","normal"],
    ["FILE_001: CORRUPTED","warn"],
    ["RECOVERY STATUS: 17%","ok"],
    ["Someone left a record here.","normal"],
    ["It does not belong to any known universe.","normal"]
  ];
}
function setTerminalSignal(text,hot=false){
  const signal=$("#terminalSignal");
  if(!signal)return;
  signal.textContent=text;
  signal.classList.toggle("hot",hot);
}
function wait(ms){return new Promise(r=>setTimeout(r,ms))}
async function typeTerminalLines(lines,{clear=true,speed=17}={}){
  const token=++terminalTypingToken;
  const box=$("#terminalLines");
  if(clear) box.innerHTML="";
  terminalBusy=true;
  $("#terminalRetry").disabled=true;

  for(const [text,kind="normal"] of lines){
    if(token!==terminalTypingToken)return;
    const row=document.createElement("div");
    row.className=kind;
    row.innerHTML='<span class="terminal-prompt">&gt;</span> <span></span>';
    box.appendChild(row);
    const target=row.querySelector("span:last-child");
    for(let i=0;i<text.length;i++){
      if(token!==terminalTypingToken)return;
      target.textContent+=text[i];
      if(i%3===0) await wait(speed);
    }
    await wait(95);
  }
  terminalBusy=false;
  $("#terminalRetry").disabled=false;
}
async function showTerminal(){
  $("#lostTerminal").hidden=false;
  const seen=bumpTerminalSeen();
  setTerminalSignal("SIGNAL: UNSTABLE",false);
  $(".terminal-card")?.classList.remove("terminal-hit","terminal-recovered");
  await wait(120);
  typeTerminalLines(terminalIntroFor(seen));
}
function hideTerminal(){
  terminalTypingToken++;
  terminalBusy=false;
  $("#lostTerminal").hidden=true;
}
async function recoveryAttempt(){
  if(terminalBusy)return;
  const btn=$("#terminalRetry");
  btn.disabled=true;
  setTerminalSignal("RECOVERY: ACTIVE",true);

  const box=$("#terminalLines");
  box.innerHTML="";
  const progress=document.createElement("div");
  progress.className="terminal-progress-wrap ok";
  progress.innerHTML='<span class="terminal-prompt">&gt;</span> RECOVERING FILE_001... <span id="terminalPct">0%</span><div class="terminal-progress"><i></i></div>';
  box.appendChild(progress);
  const bar=progress.querySelector("i");
  const pct=progress.querySelector("#terminalPct");

  const steps=[8,17,29,43,58,71,69,82,94];
  for(const n of steps){
    pct.textContent=n+"%";
    bar.style.width=n+"%";
    await wait(85+Math.random()*80);
  }

  const roll=Math.random();
  let result;
  const card=$(".terminal-card");

  if(roll<.05){
    result=[
      ["RECOVERY COMPLETE.","ok"],
      ["FILE_001","normal"],
      ["OWNER: NE AVDEEVA","warn"],
      ["You were not supposed to find this.","warn"]
    ];
    card?.classList.add("terminal-hit");
  }else if(roll<.32){
    const today=new Date().toLocaleDateString(undefined,{year:"numeric",month:"2-digit",day:"2-digit"});
    result=[
      ["RECOVERY COMPLETE.","ok"],
      ["OWNER: UNKNOWN","normal"],
      ["UNIVERSE: NULL","normal"],
      ["CREATED: 00.00.0000","normal"],
      ["LAST ACCESS: "+today,"warn"]
    ];
    card?.classList.add("terminal-recovered");
  }else{
    result=[
      ["ERROR: CHECKSUM MISMATCH","warn"],
      ["RECORD DOES NOT EXIST.","warn"],
      ["Wait.","normal"],
      ["Then who created it?","ok"]
    ];
    card?.classList.add("terminal-hit");
  }

  await wait(180);
  await typeTerminalLines(result,{clear:true,speed:20});
  setTerminalSignal("SIGNAL: LOST",false);
  btn.disabled=false;
}
$("#lostFileBtn").onclick=showTerminal;
let logoClicks=0,logoTimer;
$(".hero-title").addEventListener("click",()=>{
  logoClicks++;
  clearTimeout(logoTimer);
  logoTimer=setTimeout(()=>logoClicks=0,1800);
  if(logoClicks===5){logoClicks=0;archiveWhisper("NODE_00 REMEMBERS YOU.",true)}
});
$("#terminalRetry").onclick=recoveryAttempt;
$$('[data-terminal-close]').forEach(x=>x.onclick=hideTerminal);

document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){
    closeModal();closeDrawer();$("#popover").hidden=true;$("#sortMenu").hidden=true;hideTerminal();
  }
  if(!$("#modal").hidden&&e.key==="ArrowRight") browseModal(1);
  if(!$("#modal").hidden&&e.key==="ArrowLeft") browseModal(-1);
});

// v0.9.14 — dedicated anomaly / easter-egg pass.
// Decorative only: no anomaly blocks a real click, changes a filter, or fakes a browser/network error.
const heroTitle=$('.hero-title');
function pulseHeroGlitch(){
  if(!heroTitle || heroTitle.classList.contains('hero-glitch-now')) return;
  heroTitle.classList.add('hero-glitch-now');
  setTimeout(()=>heroTitle.classList.remove('hero-glitch-now'),1250);
}
if(heroTitle){
  heroTitle.addEventListener('mouseenter',()=>{ if(Math.random()<.34) pulseHeroGlitch(); });
  // Noticeable during normal browsing without becoming a constant animation.
  setInterval(()=>{ if(document.visibilityState==='visible' && Math.random()<.72) pulseHeroGlitch(); },14500);
}

// UNKNOWN RECORD: extremely rare RANDOM anomaly. It cannot be opened or found in the catalog.
function ensureUnknownRecord(){
  let el=$('#unknownRecord');
  if(el) return el;
  el=document.createElement('div');
  el.id='unknownRecord';
  el.className='unknown-record';
  el.hidden=true;
  el.innerHTML=`<div class="unknown-record-card">
    <div class="unknown-record-noise"></div>
    <div class="unknown-record-code">ARCHIVE.EXE / RECORD_000</div>
    <div class="unknown-record-id">UNKNOWN</div>
    <div class="unknown-record-meta">SOURCE: UNINDEXED<br>AUTHOR: @██████<br>CHECKSUM: MISMATCH</div>
    <div class="unknown-record-status">RECORD LOST</div>
  </div>`;
  document.body.appendChild(el);
  return el;
}
function showUnknownRecord(done){
  const el=ensureUnknownRecord();
  el.hidden=false;
  requestAnimationFrame(()=>el.classList.add('show'));
  pulseHeroGlitch();
  setTimeout(()=>el.classList.add('dropping'),1450);
  setTimeout(()=>{
    el.classList.remove('show','dropping');
    el.hidden=true;
    archiveWhisper('RECORD_000 // INDEX LOST',true);
    if(done) setTimeout(done,260);
  },2050);
}

// A tiny distinction: "signal glitch" is RGB/slice noise; "corruption" is a brief red ? state.
const CORRUPT_SELECTORS=['#catalogOpen','.filter-trigger','.hashtag-trigger','.universe-trigger','#sortTrigger','#loreToggle','#povCycle','#randomBtn','.drawer-tab','.drawer-item','.quick-list button'];
const GLITCH_SELECTORS=['.control','.quick-list button','.drawer-tab','.drawer-item','.card-tags button','.card-hashtags button'];

function transientCorruption(el){
  if(!el || el.dataset.corrupting==='1') return;
  el.dataset.corrupting='1';
  const target=el.querySelector('.ui-icon,.hamb,.at,.hash-mark,.universe-mark,.sort-mark,.random-mark,.pov-cycle-label') || el.querySelector('span') || el;
  const old=target.innerHTML;
  target.dataset.corruptOld=old;
  target.textContent='?';
  el.classList.add('archive-corrupt');
  setTimeout(()=>{
    target.innerHTML=target.dataset.corruptOld ?? old;
    delete target.dataset.corruptOld;
    el.classList.remove('archive-corrupt');
    delete el.dataset.corrupting;
  },360);
}
function transientSignalGlitch(el){
  if(!el || el.classList.contains('archive-signal-glitch')) return;
  el.classList.add('archive-signal-glitch');
  setTimeout(()=>el.classList.remove('archive-signal-glitch'),430);
}
function wireInteractiveAnomalies(root=document){
  CORRUPT_SELECTORS.forEach(sel=>root.querySelectorAll(sel).forEach(el=>{
    if(el.dataset.corruptionWired) return;
    el.dataset.corruptionWired='1';
    el.addEventListener('mouseenter',()=>{ if(Math.random()<.065) transientCorruption(el); });
  }));
  GLITCH_SELECTORS.forEach(sel=>root.querySelectorAll(sel).forEach(el=>{
    if(el.dataset.signalWired) return;
    el.dataset.signalWired='1';
    el.addEventListener('mouseenter',()=>{ if(Math.random()<.035) transientSignalGlitch(el); });
  }));
}

// Card glitches are intentionally rarer than before.
function wireCardGlitches(){
  $$('#grid .card').forEach(card=>{
    if(card.dataset.glitchWired) return;
    card.dataset.glitchWired='1';
    card.addEventListener('mouseenter',()=>{
      if(Math.random()<.045 && !card.classList.contains('archive-card-glitch')){
        card.classList.add('archive-card-glitch');
        setTimeout(()=>card.classList.remove('archive-card-glitch'),430);
      }
      // RECORD_000 occasionally overlays a normal archive id without changing the actual bot.
      if(Math.random()<.018){
        const title=card.querySelector('.card-title');
        if(title && !card.classList.contains('record-zero-flash')){
          card.classList.add('record-zero-flash');
          card.dataset.recordGhost='RECORD_000';
          setTimeout(()=>{card.classList.remove('record-zero-flash');delete card.dataset.recordGhost},520);
        }
      }
    });
  });
}

// Catalog-only anomalies: labels can briefly be "forgotten", and an impossible author can flash in the list.
function catalogLabelAnomaly(){
  const tabs=$$('.drawer-tab');
  if(!tabs.length) return;
  if(Math.random()<.22){
    const tab=tabs[Math.floor(Math.random()*tabs.length)];
    const label=tab.querySelector('span');
    if(label){
      const old=label.textContent;
      tab.classList.add('archive-corrupt-label');
      label.textContent=Math.random()<.5?'???????':'[MISSING]';
      setTimeout(()=>{label.textContent=old;tab.classList.remove('archive-corrupt-label')},520);
    }
  }
  if(drawerTab==='author' && Math.random()<.16){
    const list=$('#drawerList');
    const ghost=document.createElement('button');
    ghost.type='button';ghost.className='drawer-item drawer-author-item drawer-ghost';ghost.innerHTML='<span class="drawer-author-copy"><b>@██████</b><small>?? RECORDS</small></span><i>?</i>';
    list.prepend(ghost);
    setTimeout(()=>ghost.classList.add('vanish'),520);
    setTimeout(()=>ghost.remove(),820);
  }
  if(Math.random()<.09){
    const stat=$('#drawerStatPrimary');
    if(stat){
      const old=stat.textContent;
      stat.classList.add('archive-corrupt-label');
      const n=parseInt(old,10);
      if(Number.isFinite(n)) stat.textContent=old.replace(/^\d+/,String(n+1).padStart(2,'0'))+' ?';
      setTimeout(()=>{stat.textContent=old;stat.classList.remove('archive-corrupt-label')},430);
    }
  }
}
$('#catalogOpen')?.addEventListener('click',()=>setTimeout(catalogLabelAnomaly,120));
$$('.drawer-tab').forEach(t=>t.addEventListener('click',()=>setTimeout(catalogLabelAnomaly,90)));

// Small count anomaly: the archive occasionally counts one record that is not actually returned.
let countGhostTimer;
function maybeGhostRecordCount(){
  if(Math.random()>=.035 || document.visibilityState!=='visible') return;
  const el=$('#resultCount'); if(!el) return;
  const real=el.textContent;
  const n=Number(real);
  if(!Number.isFinite(n)) return;
  el.classList.add('count-anomaly');
  el.textContent=String(n+1);
  clearTimeout(countGhostTimer);
  countGhostTimer=setTimeout(()=>{el.textContent=real;el.classList.remove('count-anomaly')},760);
}
setInterval(maybeGhostRecordCount,18000);

// Hashtag ghosts: visual only; their actual filter value never changes.
function wireHashtagGhosts(){
  $$('[data-hashtag]').forEach(el=>{
    if(el.dataset.hashtagGhostWired) return;
    el.dataset.hashtagGhostWired='1';
    el.addEventListener('mouseenter',()=>{
      if(Math.random()>=.025 || el.dataset.ghosting==='1') return;
      el.dataset.ghosting='1';
      const old=el.textContent;
      const pool=['#unknown','#missing','#do-not-index','#still-here','#record-000'];
      el.textContent=pool[Math.floor(Math.random()*pool.length)];
      el.classList.add('hashtag-ghost');
      setTimeout(()=>{el.textContent=old;el.classList.remove('hashtag-ghost');delete el.dataset.ghosting},650);
    });
  });
}

// Owner-known search easter eggs. Normal search still behaves normally.
const searchEggs={
  '404':'RECORD 404 // NOT INDEXED',
  '???':'QUERY RETURNED AN UNCOUNTED RECORD',
  'lost':'LOST DIRECTORY // SIGNAL RECEIVED',
  'node_00':'NODE_00 // ACTIVE',
  'archive':'INDEX IS WATCHING',
  'archive.exe':'YOU ARE ALREADY INSIDE THE ARCHIVE',
  'record_000':'NO SUCH RECORD'
};
let lastSearchEgg='';
$('#searchInput')?.addEventListener('input',e=>{
  const q=e.target.value.trim().toLowerCase();
  if(searchEggs[q] && q!==lastSearchEgg){
    lastSearchEgg=q;
    setTimeout(()=>archiveWhisper(searchEggs[q],['404','record_000'].includes(q)),180);
    if(['archive.exe','record_000','???'].includes(q)) pulseHeroGlitch();
  } else if(!searchEggs[q]) lastSearchEgg='';
});

// Existing hidden logo sequence remains, plus the cursor sequence.
let randomArchiveClicks=0;
const randomButton=$('#randomBtn');
if(randomButton){
  randomButton.addEventListener('click',()=>{
    randomArchiveClicks++;
    if(randomArchiveClicks%13===0){
      setTimeout(()=>{pulseHeroGlitch();archiveWhisper('RECORD 13 // CLASSIFICATION WITHHELD',true)},320);
    }
  });
}
const heroCursor=heroTitle?.querySelector('span');
let cursorClicks=0,cursorTimer;
heroCursor?.addEventListener('click',e=>{
  e.stopPropagation();cursorClicks++;clearTimeout(cursorTimer);cursorTimer=setTimeout(()=>cursorClicks=0,1500);
  if(cursorClicks===3){
    cursorClicks=0;pulseHeroGlitch();
    const kicker=$('.hero-kicker');
    if(kicker){const old=kicker.textContent;kicker.textContent='SIGNAL LOCKED / NODE_13';kicker.classList.add('kicker-secret');setTimeout(()=>{kicker.textContent=old;kicker.classList.remove('kicker-secret')},2800)}
  }
});

// Rewire dynamic content after every render without changing filtering logic.
const _renderV0914=render;
render=function(){
  _renderV0914();
  wireCardGlitches();
  wireInteractiveAnomalies();
  wireHashtagGhosts();
};
wireCardGlitches();
wireInteractiveAnomalies();
wireHashtagGhosts();

/* v0.9.17 — persistent catalog multi-select
   Catalog stays open while toggling filters. Clicking a selected entry again removes it.
   It closes only by X, Escape, or a click outside the drawer. */
(function(){
  const drawer = document.querySelector('#catalogDrawer');
  const list = document.querySelector('#drawerList');
  const shade = document.querySelector('#drawerShade');
  if(!drawer || !list) return;

  function drawerIsOpen(){ return drawer.classList.contains('open'); }

  // Replace the inherited delegated handler with a capture-phase handler so no
  // older click behavior can close the drawer after a selection.
  list.addEventListener('click', function(e){
    const item = e.target.closest('[data-drawer-value]');
    if(!item || !list.contains(item)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const value = item.dataset.drawerValue;
    if(drawerTab === 'author') toggle('author', value);
    else if(drawerTab === 'universe') toggle('universe', value);
    else if(drawerTab === 'tag') toggle('tag', value);

    // Update the main catalog and all counters, then explicitly preserve drawer state.
    const wasOpen = drawerIsOpen();
    render();
    if(wasOpen){
      drawer.classList.add('open');
      drawer.setAttribute('aria-hidden','false');
      if(shade) shade.hidden = false;
    }
  }, true);

  // Clicking anywhere outside the drawer closes it. Clicks inside never do.
  document.addEventListener('pointerdown', function(e){
    if(!drawerIsOpen()) return;
    if(drawer.contains(e.target)) return;
    if(e.target.closest('#catalogOpen')) return;
    closeDrawer();
  });

  // Make selected rows explicitly toggle-like for accessibility and visual state.
  const oldRenderDrawer = renderDrawer;
  renderDrawer = function(){
    oldRenderDrawer();
    document.querySelectorAll('#drawerList [data-drawer-value]').forEach(btn=>{
      btn.setAttribute('aria-pressed', btn.classList.contains('selected') ? 'true' : 'false');
      btn.title = btn.classList.contains('selected') ? 'Click again to remove filter' : 'Click to add filter';
    });
  };
  renderDrawer();
})();


/* v0.9.19 — robust boot/data sync.
   Never snapshot an empty window.BOTS forever. Re-read the data source on every render
   and retry boot briefly in case the browser serves scripts in an odd cached order. */
(function bootArchive(){
  let attempts = 0;
  function paint(){
    syncBots();
    render();
    attempts++;
    if(B.length===0 && attempts<12) setTimeout(paint, 80);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint, {once:true});
  else paint();
  window.addEventListener('load', ()=>{ syncBots(); render(); }, {once:true});
})();


/* =========================================================
   ARCHIVE.EXE v1.0 — live hero atmosphere
   Non-destructive overlays: the source header image is never modified.
   ========================================================= */
(function initHeroAtmosphere(){
  const hero = document.querySelector('.hero');
  const dust = document.getElementById('heroDust');
  if(!hero || !dust) return;

  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(reduced) return;

  let activeDust = 0;
  const MAX_DUST = 28;

  function spawnDust(){
    if(document.hidden || activeDust >= MAX_DUST) return;

    const p = document.createElement('i');
    p.className = 'hero-dust-particle';

    // More particles around the illuminated center, but a few can drift anywhere.
    const clustered = Math.random() < .72;
    const x = clustered ? (24 + Math.random()*58) : (4 + Math.random()*92);
    const y = 18 + Math.random()*67;
    const size = 1.35 + Math.random()*2.65;
    const drift = -36 + Math.random()*72;
    const fall = 18 + Math.random()*42;
    const dur = 6.5 + Math.random()*7.5;
    const delay = Math.random()*1.4;
    const peak = .30 + Math.random()*.34;

    p.style.setProperty('--x', x + '%');
    p.style.setProperty('--y', y + '%');
    p.style.setProperty('--s', size + 'px');
    p.style.setProperty('--dx', drift + 'px');
    p.style.setProperty('--dy', fall + 'px');
    p.style.setProperty('--dur', dur + 's');
    p.style.setProperty('--delay', delay + 's');
    p.style.setProperty('--peak', peak.toFixed(2));

    activeDust++;
    p.addEventListener('animationend', ()=>{
      p.remove();
      activeDust = Math.max(0, activeDust - 1);
    }, {once:true});
    dust.appendChild(p);
  }

  // Quiet, irregular flow rather than "snow".
  const timer = setInterval(()=>{
    if(Math.random() < .92) spawnDust();
    if(Math.random() < .28) setTimeout(spawnDust, 160 + Math.random()*420);
  }, 620);

  // A visible but still sparse initial field.
  for(let i=0;i<11;i++) setTimeout(spawnDust, i*150);

  window.addEventListener('pagehide', ()=>clearInterval(timer), {once:true});
})();


// v1.0 final9 — deterministic hero moments.
// These class pulses avoid the historical stack of animation overrides.
// First events happen quickly after page load so the effect is actually visible.
(function initGuaranteedHeroMoments(){
  const flare=document.querySelector(".hero-light-sweep");
  const terminal=document.querySelector(".hero-terminal-glitch");
  if(!flare || !terminal) return;

  function pulse(el,cls,duration){
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(()=>el.classList.remove(cls),duration);
  }
  function flareNow(){ if(document.visibilityState==="visible") pulse(flare,"fx-flare-now",2200) }
  function terminalNow(){ if(document.visibilityState==="visible") pulse(terminal,"fx-terminal-now",1500) }

  setTimeout(flareNow,2200);
  setTimeout(terminalNow,4700);
  setInterval(flareNow,14500);
  setInterval(terminalNow,10500);
})();
