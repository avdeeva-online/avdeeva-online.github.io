let B = [];
let pageSize = 30;
let currentPage = 1;
function syncBots(){
  const source = window.BOTS;
  if(Array.isArray(source)) B = source;
  return B;
}
syncBots();
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const state = { q:"", settings:new Set(), authors:new Set(), universes:new Set(), tags:new Set(), hashtags:new Set(), povs:new Set(), lorebook:false, sort:"newest" };
let activeFilter = null, drawerTab = "setting", drawerSort = "az", current = null, modalTab = "description", tagsExpanded = false, openIntro = 0;

const bookSvg = `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 5.5c3.2-.9 5.7-.6 8.5 1.1v12c-2.8-1.7-5.3-2-8.5-1.1zM20.5 5.5c-3.2-.9-5.7-.6-8.5 1.1v12c2.8-1.7 5.3-2 8.5-1.1z"/></svg>`;
const globeSvg = `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.8 12h16.4M12 3.5c2.2 2.4 3.4 5.2 3.4 8.5S14.2 18.1 12 20.5M12 3.5C9.8 5.9 8.6 8.7 8.6 12s1.2 6.1 3.4 8.5"/></svg>`;
const eyeSvg = `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.3-5.5 9.5-5.5S21.5 12 21.5 12 18.2 17.5 12 17.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>`;

const cleanTag = value => String(value ?? "").trim().replace(/\s+/g," ");
// Imported tags keep their own emoji for display. Emoji are ignored only when
// deciding whether two tags belong to the same automatic filter.
const tagText = value => cleanTag(value).replace(/^[^\p{L}\p{N}#]+/u,"").trim();
const rawTagKey = value => tagText(value).toLocaleLowerCase();
const TAG_ALIASES = new Map([
  ["enemy to lovers","enemies to lovers"]
]);
const tagKey = value => TAG_ALIASES.get(rawTagKey(value)) || rawTagKey(value);
const displayTag = value => cleanTag(value);
const tagLabel = value => displayTag(value);
const povLabel = p => p === "AnyPOV" ? "◌ AnyPOV" : p === "FemPOV" ? "♀ FemPOV" : p === "MalePOV" ? "♂ MalePOV" : p;
const isCompactMobile = () => Boolean(window.matchMedia?.("(max-width:760px)").matches);
const SETTING_DEFS = [
  ["omegaverse","Omegaverse","","abo a/b/o alpha beta omega"],
  ["post-apocalypse","Post-apocalypse","","post apocalypse postapocalypse апокалипсис постапокалипсис"],
  ["zombie-apocalypse","Zombie apocalypse","post-apocalypse","zombie apocalypse зомби апокалипсис"],
  ["rusreal","Rusreal","","русреал russian realism modern russia современная россия"],
  ["rusreal-2000s","2000s Rusreal","rusreal","нулевые 2000s russia россия нулевых"],
  ["china","China","","китай chinese setting"],
  ["ancient-china","Ancient China","china","древний китай imperial china historical china"],
  ["egypt","Egypt","","египет egyptian setting"],
  ["ancient-egypt","Ancient Egypt","egypt","древний египет"],
  ["medieval","Medieval","","middle ages средневековье"],
  ["regency","Regency","","regency era"],
  ["victorian","Victorian","","victorian era"],
  ["historical","Historical","","historical setting исторический сеттинг"],
  ["fantasy","Fantasy","","фэнтези"],
  ["sci-fi","Sci-Fi","","science fiction научная фантастика"],
  ["cyberpunk","Cyberpunk","","киберпанк"],
  ["supernatural","Supernatural","","urban fantasy сверхъестественное"],
  ["college","College / University","","college university университет колледж"],
  ["high-school","High school","","school setting старшая школа"],
  ["mafia","Mafia / Crime","","mafia organized crime криминал"]
].map(([id,label,parent,aliases])=>({id,label,parent,aliases}));
const SETTING_BY_ID = new Map(SETTING_DEFS.map(x=>[x.id,x]));
const settingLabel = id => SETTING_BY_ID.get(id)?.label || id;
const settingSearchText = id => {const x=SETTING_BY_ID.get(id);return x?`${x.label} ${x.aliases}`.toLocaleLowerCase():String(id).toLocaleLowerCase()};
const settingDisplayLabel = id => `${SETTING_BY_ID.get(id)?.parent?'↳ ':''}${settingLabel(id)}`;
const settingDescendsFrom = (id,parent) => {let x=SETTING_BY_ID.get(id);while(x?.parent){if(x.parent===parent)return true;x=SETTING_BY_ID.get(x.parent)}return false};
const botHasSetting = (bot,id) => (bot.settingIds||[]).some(botId=>botId===id||settingDescendsFrom(botId,id));
const allSettings = () => SETTING_DEFS.filter(def=>B.some(bot=>botHasSetting(bot,def.id))).map(def=>def.id).sort((a,b)=>count("setting",b)-count("setting",a)||settingLabel(a).localeCompare(settingLabel(b),undefined,{sensitivity:"base"}));
const cleanUniverse = value => {
  const universe=cleanTag(value);
  if(!universe || /^(unclassified|unknown|none|null|n\/?a|setting|universe|world)\s*:?$/i.test(universe) || universe.length>80) return "";
  return universe;
};
const universeKey = value => cleanUniverse(value).toLocaleLowerCase();
const allUniverses = () => {
  syncBots();
  const universes=new Map();
  B.forEach(bot=>{
    const universe=cleanUniverse(bot.universe),key=universeKey(universe);
    if(key && !universes.has(key)) universes.set(key,universe);
  });
  return [...universes.values()].sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:"base"}));
};
const canonicalUniverse = value => allUniverses().find(universe=>universeKey(universe)===universeKey(value)) || cleanUniverse(value);
const botHasUniverse = (bot,value) => universeKey(bot.universe)===universeKey(value);
const selectedUniverse = value => [...state.universes].find(universe=>universeKey(universe)===universeKey(value));
const uniq = key => key==="universe" ? allUniverses() : [...new Set(B.map(x => x[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
const allTags = () => {
  syncBots();
  const tags=new Map();
  B.flatMap(bot=>bot.tags||[]).forEach(tag=>{
    const key=tagKey(tag);
    // B is newest-first, so one real tag is kept per meaning and the newest
    // imported spelling/emoji becomes its visible label.
    if(key && !tags.has(key)){
      tags.set(key,displayTag(tag));
    }
  });
  return [...tags.values()].sort((a,b)=>tagText(a).localeCompare(tagText(b),undefined,{sensitivity:"base"}));
};
const canonicalTag = value => {
  const key=tagKey(value);
  return allTags().find(tag=>tagKey(tag)===key) || displayTag(value);
};
const botHasTag = (bot,value) => (bot.tags||[]).some(tag=>tagKey(tag)===tagKey(value));
const selectedTag = value => [...state.tags].find(tag=>tagKey(tag)===tagKey(value));
const hasSelectedTag = value => Boolean(selectedTag(value));
const cleanHashtag = value => cleanTag(value).replace(/^#+\s*/,"");
const hashtagKey = value => cleanHashtag(value).toLocaleLowerCase();
const allHashtags = () => {
  syncBots();
  const hashtags=new Map();
  B.flatMap(bot=>bot.hashtags||[]).forEach(hashtag=>{
    const key=hashtagKey(hashtag);
    if(key && !hashtags.has(key)) hashtags.set(key,cleanHashtag(hashtag));
  });
  return [...hashtags.values()].sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:"base"}));
};
const canonicalHashtag = value => {
  const key=hashtagKey(value);
  return allHashtags().find(hashtag=>hashtagKey(hashtag)===key) || cleanHashtag(value);
};
const botHasHashtag = (bot,value) => (bot.hashtags||[]).some(hashtag=>hashtagKey(hashtag)===hashtagKey(value));
const selectedHashtag = value => [...state.hashtags].find(hashtag=>hashtagKey(hashtag)===hashtagKey(value));
const hasSelectedHashtag = value => Boolean(selectedHashtag(value));

function selectionCoversAll(set, values){
  return values.length > 0 && values.every(v => set.has(v));
}

function count(kind, val){
  if(kind === "setting") return B.filter(b => botHasSetting(b,val)).length;
  if(kind === "tag") return B.filter(b => botHasTag(b,val)).length;
  if(kind === "author") return B.filter(b => b.author === val).length;
  if(kind === "universe") return B.filter(b => botHasUniverse(b,val)).length;
  if(kind === "pov") return B.filter(b => b.pov === val).length;
  if(kind === "hashtag") return B.filter(b => botHasHashtag(b,val)).length;
  return 0;
}

function applyFilters(){
  syncBots();
  const q = state.q.trim().toLowerCase();
  let list = B.filter(b => {
    const hay = [b.nameRu,b.nameEn,b.author,b.universe,b.pov,b.short,b.full,b.scenario,...(b.intros||[]),...(b.settingIds||[]).flatMap(id=>[settingLabel(id),settingSearchText(id)]),...(b.tags||[]),...(b.hashtags||[])].join(" ").toLowerCase();
    if(q && !hay.includes(q)) return false;
    const allAuthorsSelected = selectionCoversAll(state.authors, uniq("author"));
    const allUniversesSelected = selectionCoversAll(state.universes, uniq("universe"));
    if(state.authors.size && !allAuthorsSelected && !state.authors.has(b.author)) return false;
    if(state.settings.size && [...state.settings].some(setting=>!botHasSetting(b,setting))) return false;
    if(state.universes.size && !allUniversesSelected && ![...state.universes].some(universe=>botHasUniverse(b,universe))) return false;
    if(state.povs.size && !state.povs.has(b.pov)) return false;
    if(state.lorebook && !b.lorebook) return false;
    if([...state.tags].some(t => !botHasTag(b,t))) return false; // AND logic
    if([...state.hashtags].some(h => !botHasHashtag(b,h))) return false; // hashtag AND logic
    return true;
  });
  const sortName = bot => isCompactMobile() ? cleanTag(bot.nameEn).replace(/^[^\p{L}\p{N}]+/u,"") : bot.nameEn;
  if(state.sort === "az") list.sort((a,b)=>sortName(a).localeCompare(sortName(b),undefined,{sensitivity:"base",numeric:true}));
  if(state.sort === "za") list.sort((a,b)=>sortName(b).localeCompare(sortName(a),undefined,{sensitivity:"base",numeric:true}));
  if(state.sort === "author") list.sort((a,b)=>a.author.localeCompare(b.author)||sortName(a).localeCompare(sortName(b)));
  if(state.sort === "newest") list.sort((a,b)=>Number(b.isNew)-Number(a.isNew));
  return list;
}

function hasActiveFilters(){
  return !!(
    state.q.trim() ||
    state.settings.size ||
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
  const pages = Math.max(1, Math.ceil(list.length / pageSize));
  if(currentPage > pages) currentPage = pages;
  const start = (currentPage - 1) * pageSize;
  const visible = list.slice(start, start + pageSize);

  $("#resultCount").textContent = list.length;
  const totalCount = $("#totalCount");
  if(totalCount) totalCount.textContent = `TOTAL ${String(B.length).padStart(3,"0")}`;

  const meta = $("#catalogMeta");
  const reset = $("#resetBtn");
  const catalogOpen = $("#catalogOpen");
  if(meta) meta.classList.toggle("has-filters", filtered);
  if(catalogOpen) catalogOpen.classList.toggle("has-filters", filtered);
  if(reset) reset.hidden = !filtered;
  $("#totalMeta").textContent = filtered && isCompactMobile() ? `${String(list.length).padStart(3,"0")} / ${String(B.length).padStart(3,"0")} RECORDS` : `${String(B.length).padStart(3,"0")} RECORDS`;
  $("#empty").hidden = !!list.length;
  $("#grid").innerHTML = visible.map((b,i)=>cardHtml(b,i)).join("");

  renderPagination(list.length);
  renderQuickTags();
  renderActiveFilters();
  renderCounts();
  renderDrawer();
}


function renderPagination(totalItems){
  const nav=$("#pagination");
  if(!nav) return;
  const pages=Math.max(1,Math.ceil(totalItems/pageSize));

  if(totalItems<=pageSize){
    nav.hidden=true;
    nav.innerHTML="";
    return;
  }

  nav.hidden=false;
  const pieces=[];
  pieces.push(`<button type="button" data-page="${Math.max(1,currentPage-1)}" ${currentPage===1?"disabled":""} aria-label="Previous page">‹</button>`);

  let start=Math.max(1,currentPage-2);
  let end=Math.min(pages,start+4);
  start=Math.max(1,end-4);

  if(start>1){
    pieces.push(`<button type="button" data-page="1">1</button>`);
    if(start>2) pieces.push(`<span class="pagination-gap">…</span>`);
  }
  for(let p=start;p<=end;p++){
    pieces.push(`<button type="button" data-page="${p}" class="${p===currentPage?"active":""}" ${p===currentPage?'aria-current="page"':""}>${p}</button>`);
  }
  if(end<pages){
    if(end<pages-1) pieces.push(`<span class="pagination-gap">…</span>`);
    pieces.push(`<button type="button" data-page="${pages}">${pages}</button>`);
  }

  pieces.push(`<button type="button" data-page="${Math.min(pages,currentPage+1)}" ${currentPage===pages?"disabled":""} aria-label="Next page">›</button>`);
  nav.innerHTML=pieces.join("");

  nav.querySelectorAll("button[data-page]").forEach(btn=>{
    btn.onclick=()=>{
      if(btn.disabled) return;
      currentPage=Number(btn.dataset.page)||1;
      render();
      $(isCompactMobile()?"#grid":"#catalogMeta")?.scrollIntoView({behavior:"smooth",block:"start"});
    };
  });
}

const pageSizeBtn=$("#pageSizeBtn");
const pageSizeMenu=$("#pageSizeMenu");
if(pageSizeBtn && pageSizeMenu){
  pageSizeBtn.onclick=e=>{
    e.stopPropagation();
    const willOpen=pageSizeMenu.hidden;
    closeFloatingMenus("pageSize");
    pageSizeMenu.hidden=!willOpen;
    if(willOpen) pageSizeMenu.hidden=false;
  };

  pageSizeMenu.querySelectorAll("[data-page-size]").forEach(btn=>{
    btn.onclick=()=>{
      pageSize=Number(btn.dataset.pageSize)||30;
      currentPage=1;
      pageSizeBtn.textContent=`SHOW ${pageSize}⌄`;
      closeFloatingMenus();
      render();
    };
  });

  document.addEventListener("click",e=>{
    if(!pageSizeMenu.hidden && !pageSizeMenu.contains(e.target) && e.target!==pageSizeBtn){
      pageSizeMenu.hidden=true;
    }
  });
}

function cardHtml(b,i){
  const tags = b.tags || [];
  const shown = tags.slice(0,4);
  const more = tags.length - shown.length;
  const passiveMobile = isCompactMobile();
  const tagChip = tag => passiveMobile ? `<span>${esc(tagLabel(tag))}</span>` : `<button data-tag="${esc(tag)}">${esc(tagLabel(tag))}</button>`;
  const hashtagChip = hashtag => passiveMobile ? `<span>#${esc(cleanHashtag(hashtag))}</span>` : `<button data-hashtag="${esc(hashtag)}">#${esc(cleanHashtag(hashtag))}</button>`;
  const universe=canonicalUniverse(b.universe);
  const setting=(b.settingIds||[])[0]||"";
  return `<article class="card" data-id="${esc(b.id)}" style="animation-delay:${Math.min(i,12)*18}ms">
    <div class="card-media"><img src="${esc(b.image)}" alt="${esc(b.nameEn)}" loading="${i<4?'eager':'lazy'}" decoding="async"${i<2?' fetchpriority="high"':''}>${b.isNew?'<span class="new-badge">NEW</span>':''}<a class="download-hover" href="${esc(b.download)}" download data-stop>BOT CARD ↓</a></div>
    <div class="card-body">
      <h3 class="card-title">${esc(b.nameEn)}<span>${esc(b.nameRu)}</span></h3>
      <div class="card-author">BY <button data-author="${esc(b.author)}">@${esc(b.author)}</button></div>
      <div class="card-meta card-system-line">
        ${setting?`<button class="meta-token card-setting-token" data-quick-setting="${esc(setting)}"><span class="setting-mark">⌖</span><span>${esc(settingLabel(setting))}</span></button>`:""}
        ${universe?`<button class="meta-token card-universe-token" data-quick-universe="${esc(universe)}">${globeSvg}<span>${esc(universe)}</span></button>`:""}
        <span class="card-status-icon card-pov-icon pov-${esc((b.pov||'AnyPOV').toLowerCase())}" title="${esc(b.pov||'AnyPOV')}" aria-label="POV: ${esc(b.pov||'AnyPOV')}">
          <span aria-hidden="true">${b.pov==='FemPOV'?'♀':b.pov==='MalePOV'?'♂':'◎'}</span>
        </span>
        ${b.lorebook?`<span class="card-status-icon card-lore-icon" title="Lorebook available" aria-label="Lorebook available">${bookSvg}</span>`:''}
      </div>
      <p class="card-short">${esc(b.short)}</p>
      <div class="card-tags">${shown.map(tagChip).join("")}${more>0?`<span class="tag-more">+${more}</span>`:''}</div>
      ${(b.hashtags||[]).length?`<div class="card-hashtags">${(b.hashtags||[]).slice(0,3).map(hashtagChip).join("")}${(b.hashtags||[]).length>3?`<span>+${(b.hashtags||[]).length-3}</span>`:''}</div>`:''}
    </div>
  </article>`;
}

function renderQuickTags(){
  const el = $("#tagQuick");
  const compactMobile = window.matchMedia && window.matchMedia("(max-width:760px)").matches;
  const everyTag = allTags();
  // Mobile uses one continuous swipe rail: selected tags stay first, but every
  // tag remains reachable without opening the catalog or expanding the page.
  const mobileTags = [...new Map([...state.tags, ...everyTag].map(tag=>[tagKey(tag),tag])).values()];
  const visibleTags = compactMobile ? mobileTags : everyTag;
  el.classList.toggle("quick-expanded", tagsExpanded);
  el.classList.toggle("quick-collapsed", !tagsExpanded);
  el.classList.toggle("quick-mobile-shortlist", compactMobile);
  el.innerHTML = visibleTags.map(t=>`<button class="${hasSelectedTag(t)?'active':''}" data-quick-tag="${esc(t)}">${esc(tagLabel(t))}</button>`).join("");
  $("#clearQuickTags").hidden = state.tags.size === 0;
  $("#toggleAllTags").textContent = tagsExpanded ? "LESS −" : "ALL TAGS +";
}

function renderActiveFilters(){
  // Direct toggles (tags / POV / lorebook) already show their state on the controls themselves.
  // Keep this row only for filters that otherwise have no persistent visible state.
  const chips = [];
  state.settings.forEach(v=>chips.push(["setting",v,`SETTING / ${settingLabel(v)}`]));
  state.authors.forEach(v=>chips.push(["author",v,`@ ${v}`]));
  state.universes.forEach(v=>chips.push(["universe",v,`UNIVERSE / ${v}`]));
  state.hashtags.forEach(v=>chips.push(["hashtag",v,`#${cleanHashtag(v)}`]));
  const box = $("#activeFilters");
  box.classList.toggle("has", chips.length>0);
  box.innerHTML = chips.map(([type,value,label])=>`<button class="filter-chip" data-remove="${type}" data-value="${esc(value)}">${esc(label)} ×</button>`).join("");
}

function renderCounts(){
  setCount("#settingCount", state.settings.size);
  setCount("#authorCount", state.authors.size);
  setCount("#hashtagCount", state.hashtags.size);
  setCount("#universeCount", state.universes.size);
  $$('.filter-trigger[data-filter="author"]').forEach(b=>b.classList.toggle("active",state.authors.size>0));
  $("#loreToggle").classList.toggle("active",state.lorebook);
  $("#loreToggle").setAttribute("aria-pressed",state.lorebook?"true":"false");
  const ht=$(".hashtag-trigger"); if(ht) ht.classList.toggle("active",state.hashtags.size>0);
  const set=$(".setting-trigger"); if(set) set.classList.toggle("active",state.settings.size>0);
  const ut=$(".universe-trigger"); if(ut) ut.classList.toggle("active",state.universes.size>0);
  const st=$("#sortTrigger"); if(st) st.classList.toggle("active",state.sort!=="newest");
  renderPovCycle();
}
function setCount(sel,n){const e=$(sel);if(!e)return;e.textContent=n||"";e.classList.toggle("has-count",!!n)}

function toggle(kind,val){
  const map={setting:"settings",tag:"tags",author:"authors",universe:"universes",pov:"povs",hashtag:"hashtags"};
  if(kind==="tag"){
    const existing=selectedTag(val);
    if(existing){state.tags.delete(existing);currentPage=1;return}
    val=canonicalTag(val);
  }
  if(kind==="hashtag"){
    const existing=selectedHashtag(val);
    if(existing){state.hashtags.delete(existing);currentPage=1;return}
    val=canonicalHashtag(val);
  }
  if(kind==="universe"){
    const existing=selectedUniverse(val);
    if(existing){state.universes.delete(existing);currentPage=1;return}
    val=canonicalUniverse(val);
  }
  const set=state[map[kind]]; if(!set)return;
  set.has(val)?set.delete(val):set.add(val);
  currentPage=1;
}

function valuesForFilter(kind){
  if(kind === "setting") return allSettings();
  if(kind === "tag") return allTags();
  if(kind === "author") return uniq("author");
  if(kind === "universe") return uniq("universe");
  if(kind === "pov") return ["AnyPOV","FemPOV","MalePOV"];
  if(kind === "hashtag") return allHashtags();
  return [];
}

function closeFloatingMenus(except=""){
  if(except!=="popover"){
    $("#popover").hidden=true;
    $$('.filter-trigger').forEach(b=>b.setAttribute("aria-expanded","false"));
  }
  if(except!=="sort"){
    $("#sortMenu").hidden=true;
    $("#sortTrigger").setAttribute("aria-expanded","false");
  }
  if(except!=="pageSize" && $("#pageSizeMenu")) $("#pageSizeMenu").hidden=true;
}

function openPopover(btn,kind){
  const pop=$("#popover");
  const sameFilterIsOpen=!pop.hidden && activeFilter===kind;
  closeFloatingMenus();
  if(sameFilterIsOpen){
    activeFilter=null;
    return;
  }
  activeFilter=kind;
  const r=btn.getBoundingClientRect();
  btn.setAttribute("aria-expanded","true");
  if(isCompactMobile()){
    const top=Math.max(8,Math.min(r.bottom+5,innerHeight-150));
    pop.style.setProperty("--popover-mobile-top",`${top}px`);
    pop.style.setProperty("left","8px","important");
    pop.style.setProperty("top",`${top}px`,"important");
    pop.style.setProperty("right","8px","important");
    pop.style.setProperty("bottom","auto","important");
  }else{
    pop.style.setProperty("left",Math.max(8,Math.min(r.left+scrollX,scrollX+innerWidth-270))+"px","important");
    pop.style.setProperty("top",(r.bottom+scrollY+5)+"px","important");
    pop.style.setProperty("right","auto","important");
    pop.style.setProperty("bottom","auto","important");
  }
  $("#popoverSearch").value="";
  $("#popoverSearch").placeholder=({setting:"Find setting...",author:"Find author...",hashtag:"Find tag...",universe:"Find universe...",tag:"Find tag..."})[kind]||"Find...";
  renderPopover();
  pop.hidden=false;
}
function renderPopover(){
  const q=($("#popoverSearch").value||"").toLowerCase();
  const vals=valuesForFilter(activeFilter).filter(v=>(activeFilter==="setting"?settingSearchText(v):v.toLowerCase()).includes(q));
  const selected = activeFilter==="setting"?state.settings:activeFilter==="tag"?state.tags:activeFilter==="author"?state.authors:activeFilter==="universe"?state.universes:activeFilter==="hashtag"?state.hashtags:state.povs;
  $("#popoverList").innerHTML=vals.map(v=>`<button class="${activeFilter==="tag"?(hasSelectedTag(v)?'active':''):activeFilter==="hashtag"?(hasSelectedHashtag(v)?'active':''):(selected.has(v)?'active':'')}" data-option="${esc(v)}"><span>${esc(activeFilter==="setting"?settingDisplayLabel(v):activeFilter==="tag"?tagLabel(v):activeFilter==="pov"?povLabel(v):activeFilter==="author"?'@ '+v:activeFilter==="hashtag"?'#'+cleanHashtag(v):v)}</span><small>${count(activeFilter,v)}</small></button>`).join("");
}

$$('.filter-trigger').forEach(b=>b.onclick=e=>{e.stopPropagation();openPopover(b,b.dataset.filter)});
$("#popoverSearch").oninput=renderPopover;
$("#popoverList").onclick=e=>{
  const b=e.target.closest("[data-option]");
  if(!b)return;
  toggle(activeFilter,b.dataset.option);
  render();
  closeFloatingMenus();
};
$("#popoverDone").onclick=()=>closeFloatingMenus();
$("#popoverReset").onclick=()=>{
  if(activeFilter==="setting")state.settings.clear();
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
  closeFloatingMenus();
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
  closeFloatingMenus();
  const cur=currentPov(), next=POV_CYCLE[(POV_CYCLE.indexOf(cur)+1)%POV_CYCLE.length];
  state.povs.clear(); if(next!=="AnyPOV")state.povs.add(next); render();
};

// Sort
$("#sortTrigger").onclick=e=>{
  e.stopPropagation();
  const m=$("#sortMenu"), wasOpen=!m.hidden;
  closeFloatingMenus();
  if(wasOpen)return;
  const r=e.currentTarget.getBoundingClientRect();
  m.hidden=false;
  e.currentTarget.setAttribute("aria-expanded","true");
  m.style.setProperty("left",Math.max(8,Math.min(r.left+scrollX,scrollX+innerWidth-178))+"px","important");
  m.style.setProperty("top",(r.bottom+scrollY+5)+"px","important");
  m.style.setProperty("right","auto","important");
  m.style.setProperty("bottom","auto","important");
};
$("#sortMenu").onclick=e=>{const b=e.target.closest("[data-sort]");if(!b)return;state.sort=b.dataset.sort;$("#sortLabel").textContent={newest:"NEWEST",az:"A → Z",za:"Z → A",author:"AUTHOR"}[state.sort];closeFloatingMenus();render()};

// Drawer
function openDrawer(){$("#catalogDrawer").classList.add("open");$("#catalogDrawer").setAttribute("aria-hidden","false");$("#drawerShade").hidden=false;if(isCompactMobile())document.body.classList.add("drawer-open")}
function closeDrawer(){$("#catalogDrawer").classList.remove("open");$("#catalogDrawer").setAttribute("aria-hidden","true");$("#drawerShade").hidden=true;document.body.classList.remove("drawer-open")}
$("#catalogOpen").onclick=openDrawer;$("#catalogClose").onclick=closeDrawer;$("#drawerShade").onclick=closeDrawer;
$$('.drawer-tab').forEach(b=>b.onclick=()=>{drawerTab=b.dataset.drawerTab;$$('.drawer-tab').forEach(x=>x.classList.toggle('active',x===b));$("#drawerSearch").value="";renderDrawer()});
$("#drawerSearch").oninput=renderDrawer;
$("#drawerSortCycle").onclick=()=>{
  const order=["az","za","most","least"];
  drawerSort=order[(order.indexOf(drawerSort)+1)%order.length];
  renderDrawer();
};
function drawerSelectionCount(){
  if(drawerTab==="setting") return state.settings.size;
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
  const allVals=(drawerTab==="setting"?allSettings():drawerTab==="tag"?allTags():drawerTab==="author"?uniq("author"):uniq("universe"));
  let vals=allVals.filter(v=>(drawerTab==="setting"?settingSearchText(v):v.toLowerCase()).includes(q));

  vals.sort((a,b)=>{
    if(drawerTab==="setting") return count("setting",b)-count("setting",a) || settingLabel(a).localeCompare(settingLabel(b),undefined,{sensitivity:"base"});
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
  if(sortBtn) sortBtn.querySelector("b").textContent=drawerTab==="setting"?"MOST":({az:"A→Z",za:"Z→A",most:"MOST",least:"LEAST"})[drawerSort];

  if(drawerTab==="tag"){
    list.innerHTML=vals.map(v=>`<button class="drawer-item drawer-tag-item ${hasSelectedTag(v)?'selected':''}" data-drawer-value="${esc(v)}"><span class="drawer-item-name">${esc(tagLabel(v))}</span><small>${String(count("tag",v)).padStart(2,"0")}</small></button>`).join("");
    return;
  }
  if(drawerTab==="setting"){
    list.innerHTML=vals.map(v=>`<button class="drawer-item drawer-setting-item ${state.settings.has(v)?'selected':''}" data-drawer-value="${esc(v)}"><span class="drawer-world-copy"><b>${esc(settingDisplayLabel(v))}</b><small>${String(count("setting",v)).padStart(2,"0")} RECORDS</small></span><i>→</i></button>`).join("");
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
  if(drawerTab==="setting") toggle("setting",v);
  if(drawerTab==="author") toggle("author",v);
  if(drawerTab==="universe") toggle("universe",v);
  if(drawerTab==="tag"){
    toggle("tag",v);
    if(window.matchMedia?.("(max-width:760px)").matches) closeDrawer();
  }
  render();
};

// Tag rail scroll + expansion
$("#toggleAllTags").onclick=()=>{
  const compactMobile = window.matchMedia && window.matchMedia("(max-width:760px)").matches;
  if(compactMobile){
    // The mobile tag rail is always complete and scrolls horizontally.
    tagRail.scrollTo({left:0,behavior:"smooth"});
    return;
  }
  tagsExpanded=!tagsExpanded;
  renderQuickTags();
};
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
function resetAll(){state.q="";state.settings.clear();state.authors.clear();state.universes.clear();state.tags.clear();state.hashtags.clear();state.povs.clear();state.lorebook=false;state.sort="newest";$("#searchInput").value="";$("#sortLabel").textContent="NEWEST";render()}

document.addEventListener("click",e=>{
  if(!e.target.closest("#popover")&&!e.target.closest(".filter-trigger"))$("#popover").hidden=true;
  if(!e.target.closest("#sortMenu")&&!e.target.closest("#sortTrigger"))$("#sortMenu").hidden=true;
  if(!e.target.closest("#pageSizeMenu")&&!e.target.closest("#pageSizeBtn"))$("#pageSizeMenu").hidden=true;
  if(e.target.closest("[data-stop]")){e.stopPropagation();return}
  const rem=e.target.closest("[data-remove]");if(rem){const m={setting:"settings",author:"authors",universe:"universes",tag:"tags",pov:"povs",hashtag:"hashtags"};m[rem.dataset.remove]?state[m[rem.dataset.remove]].delete(rem.dataset.value):state.lorebook=false;render();return}
  const au=e.target.closest("[data-author]");if(au){e.stopPropagation();state.authors.clear();state.authors.add(au.dataset.author);closeModal();render();return}
  const passiveCardTags=e.target.closest(".card .card-tags, .card .card-hashtags");
  if(passiveCardTags && window.matchMedia?.("(max-width:760px)").matches){e.stopPropagation();return}
  const tg=e.target.closest("[data-tag]");if(tg){e.stopPropagation();toggle("tag",tg.dataset.tag);closeModal();render();return}
  const hs=e.target.closest("[data-hashtag]");if(hs){e.stopPropagation();toggle("hashtag",hs.dataset.hashtag);closeModal();render();return}
  const qs=e.target.closest("[data-quick-setting]");if(qs){e.stopPropagation();toggle("setting",qs.dataset.quickSetting);closeModal();render();return}
  const qu=e.target.closest("[data-quick-universe]");if(qu){toggle("universe",qu.dataset.quickUniverse);closeModal();render();return}
  const actionToggle=e.target.closest(".mobile-action-toggle");
  if(actionToggle){
    e.stopPropagation();
    const group=actionToggle.closest(".modal-action-group");
    const willOpen=!group.classList.contains("mobile-open");
    $$(".modal-action-group.mobile-open").forEach(x=>x.classList.remove("mobile-open"));
    group.classList.toggle("mobile-open",willOpen);
    actionToggle.setAttribute("aria-expanded",willOpen?"true":"false");
    return;
  }
  const card=e.target.closest(".card");if(card)openModal(B.find(b=>b.id===card.dataset.id));
  if(e.target.matches("[data-close]"))closeModal();
});

// Random + modal
const randomWhispers=["RECOVERING LOST RECORD...","UNINDEXED TRACE DETECTED","ARCHIVE ROUTE SHIFTED","FOUND BETWEEN DIRECTORIES","SIGNAL FROM NODE_??"];
function archiveWhisper(text,rare=false){const box=$("#archiveWhisper");$("#whisperText").textContent=text;box.classList.toggle("rare",rare);box.hidden=false;requestAnimationFrame(()=>box.classList.add("show"));clearTimeout(archiveWhisper.timer);archiveWhisper.timer=setTimeout(()=>{box.classList.remove("show");setTimeout(()=>box.hidden=true,220)},2600)}
$("#randomBtn").onclick=()=>{
  const btn=$("#randomBtn");
  if(isCompactMobile() && hasActiveFilters() && !applyFilters().length){
    archiveWhisper("NO MATCHING RECORDS — RESET FILTERS",true);
    return;
  }
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
  const filteredPool=applyFilters();
  const pool=filteredPool.length || !hasActiveFilters() || !isCompactMobile() ? (filteredPool.length?filteredPool:B) : [];
  if(!pool.length) return;
  let index=current?pool.findIndex(b=>b.id===current.id):-1;
  if(index<0) index=0;
  index=(index+direction+pool.length)%pool.length;
  switchModalRecord(pool[index],direction);
}

function randomModal(){
  let pool=applyFilters().filter(b=>!current||b.id!==current.id);
  if(!pool.length && (!hasActiveFilters() || !isCompactMobile())) pool=B.filter(b=>!current||b.id!==current.id);
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
  $(".modal-cover").style.setProperty("--record-cover-image",`url(${JSON.stringify(b.image)})`);
  $("#modalTitle").textContent=b.nameEn;
  $("#modalTitle").classList.toggle("is-long-title",b.nameEn.length>32);
  $("#modalTitle").classList.toggle("is-very-long-title",b.nameEn.length>64);
  $("#modalAuthor").textContent=`@${b.author}`;
  $("#modalAuthor").dataset.author=b.author;
  $("#modalAuthor").title=`Show all bots by @${b.author}`;
  $("#modalAuthor").setAttribute("aria-label",`Show all bots by @${b.author}`);
  $("#modalAuthorBadge").textContent=`@${b.author}`;
  $("#modalAuthorBadge").dataset.author=b.author;
  const settings=b.settingIds||[];
  $("#modalSettingRow").hidden=false;
  $("#modalSettingRow").classList.toggle("is-empty",!settings.length);
  $("#modalSetting").innerHTML=settings.length?settings.map(id=>`<button data-quick-setting="${esc(id)}">${esc(settingLabel(id))}</button>`).join(""):`<span class="modal-setting-empty">NOT YET CLASSIFIED</span>`;
  const universe=canonicalUniverse(b.universe);
  $(".modal-universe-row").hidden=!universe&&!b.lorebook;
  $("#modalUniverse").hidden=!universe;
  $("#modalUniverse").innerHTML=universe?`${globeSvg}<span>UNIVERSE / ${esc(universe)}</span>`:"";
  $("#modalUniverse").dataset.quickUniverse=universe;
  $("#modalUniverse").title=universe?`Show universe: ${universe}`:"";
  $("#modalLoreFlag").innerHTML=b.lorebook?bookSvg:"";
  $("#modalLoreFlag").title=b.lorebook?"Lorebook available":"";
  $("#modalPov").textContent=povLabel(b.pov);
  $("#modalTags").innerHTML=`<div class="modal-primary-tags">${(b.tags||[]).map(t=>`<button data-tag="${esc(t)}">${esc(tagLabel(t))}</button>`).join("")}</div>${(b.hashtags||[]).length?`<div class="modal-hashtags">${(b.hashtags||[]).map(h=>`<button data-hashtag="${esc(h)}">#${esc(cleanHashtag(h))}</button>`).join("")}</div>`:''}`;
  $("#openBot").href=b.url;
  $("#openBot").textContent=`OPEN ON ${b.platform} ↗`;
  $("#openBot").dataset.mobileLabel=`${b.platform} PAGE ↗`;
  $("#openAuthor").href=b.authorUrl||b.url;
  $("#openAuthor").textContent=`@${b.author} ↗`;
  $("#openAuthor").dataset.mobileLabel="AUTHOR PROFILE ↗";
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
  $$(".modal-action-group.mobile-open").forEach(x=>x.classList.remove("mobile-open"));
  $$(".mobile-action-toggle").forEach(x=>x.setAttribute("aria-expanded","false"));
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
  panel.dataset.panel=modalTab;
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
const anomalyTargets=["#catalogOpen",".hashtag-trigger",".setting-trigger","#sortTrigger","#loreToggle","#povCycle","#randomBtn"];
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
async function typeTerminalLines(lines,{clear=true,speed=18,linePause=125}={}){
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

    // True terminal typing: every character gets time instead of batching 3 chars at once.
    for(let i=0;i<text.length;i++){
      if(token!==terminalTypingToken)return;
      target.textContent+=text[i];
      const punctuation=/[.:!?]/.test(text[i]) ? 45 : 0;
      await wait(speed + Math.random()*7 + (punctuation?24:0));
    }
    await wait(linePause + Math.random()*45);
  }

  terminalBusy=false;
  $("#terminalRetry").disabled=false;
}
async function showTerminal(){
  $("#lostTerminal").hidden=false;
  const seen=bumpTerminalSeen();
  setTerminalSignal("SIGNAL: UNSTABLE",false);
  $(".terminal-card")?.classList.remove("terminal-hit","terminal-recovered");
  await wait(180);
  typeTerminalLines(terminalIntroFor(seen),{speed:18,linePause:125});
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
    await wait(110+Math.random()*75);
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
    setTimeout(()=>card?.classList.remove("terminal-hit"),560);
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
    setTimeout(()=>card?.classList.remove("terminal-hit"),560);
  }

  await wait(240);
  await typeTerminalLines(result,{clear:true,speed:17,linePause:120});
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
// Main-page hover corruption is disabled: it interfered with rapid filtering.
// Drawer/catalog keeps its original anomaly behavior untouched.
const CORRUPT_SELECTORS=['.drawer-tab','.drawer-item'];
const GLITCH_SELECTORS=['.drawer-tab','.drawer-item'];

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
    // Intentionally no hover anomaly here: hashtags are often selected rapidly.
    // Ambient anomalies are handled globally away from the pointer.
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
    attempts++;
    if(B.length){
      render();
      return;
    }
    if(attempts < 20) setTimeout(paint, 60);
    else render();
  }

  // data.js is loaded before app.js, so in the normal path we paint immediately.
  if(Array.isArray(window.BOTS) && window.BOTS.length){
    syncBots();
    render();
  }else if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", paint, {once:true});
  }else{
    paint();
  }

  window.addEventListener("load", ()=>{
    syncBots();
    render();
  }, {once:true});
})();


/* =========================================================
   ARCHIVE.EXE v1.0 — live hero atmosphere
   Non-destructive overlays: the source header image is never modified.
   ========================================================= */
(function initHeroAtmosphere(){
  const hero = document.querySelector('.hero');
  const dust = document.getElementById('heroDust');
  if(!hero || !dust || window.matchMedia?.('(max-width:760px)').matches) return;

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
  if(!flare || !terminal || window.matchMedia?.('(max-width:760px)').matches) return;

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


(function initLostDirectoryTriggerGlitch(){
  const btn=$("#lostFileBtn");
  if(!btn) return;

  const base="ARCHIVE STATUS: ONLINE  •  UNKNOWN FILES: 01";
  const warnings=[
    "ACCESS DENIED  •  DO NOT OPEN",
    "NODE_00 WARNING  •  FILE_001 ACTIVE",
    "ARCHIVE STATUS: ERROR  •  UNKNOWN FILES: ??",
    "UNKNOWN DIRECTORY  •  SIGNAL CORRUPTED"
  ];

  let timer=null;
  btn.addEventListener("mouseenter",()=>{
    btn.classList.add("danger-glitch");
    let i=0;
    btn.textContent=warnings[0];
    timer=setInterval(()=>{
      btn.textContent=warnings[++i%warnings.length];
    },105);
  });

  btn.addEventListener("mouseleave",()=>{
    clearInterval(timer);
    timer=null;
    btn.classList.remove("danger-glitch");
    btn.textContent=base;
  });
})();


// HERO FX V2 — completely independent from all legacy hero animation classes.
(function initHeroFxV2(){
  const flare=document.querySelector(".hero-solar-flare-v2");
  const crt=document.querySelector(".hero-terminal-crt-v2");
  if(!flare || !crt || window.matchMedia?.('(max-width:760px)').matches) return;

  function pulse(el,cls,duration){
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    window.setTimeout(()=>el.classList.remove(cls),duration);
  }

  function fireFlare(){
    if(document.visibilityState==="visible") pulse(flare,"is-active",2700);
  }
  function fireCrt(){
    if(document.visibilityState==="visible") pulse(crt,"is-active",1800);
  }

  // Early first run so the effects are easy to verify after Ctrl+F5.
  window.setTimeout(fireFlare,1600);
  window.setTimeout(fireCrt,3400);

  // Then occasional atmospheric events.
  window.setInterval(fireFlare,14500);
  window.setInterval(fireCrt,8800);
})();


// ============================================================
// ARCHIVE.EXE ambient interface anomalies — autonomous, never under pointer.
// Main-page controls glitch on their own; direct hover stays stable.
// Catalog/drawer is intentionally excluded and keeps its legacy behavior.
// ============================================================
(function initAmbientUiGlitches(){
  if(window.matchMedia?.('(max-width:760px)').matches) return;
  const selectors=[
    "#catalogOpen",
    ".toolbar .control",
    ".filter-trigger",
    ".quick-list button",
    ".card-tags button",
    ".card-hashtags button",
    ".active-filters button",
    ".modal-primary-tags button",
    ".modal-hashtags button",
    ".page-size-btn",
    ".page-size-menu button",
    "#toggleAllTags",
    "#clearQuickTags",
    "#resetBtn",
    ".universe-link"
  ];

  let last=null;

  function candidates(){
    return [...new Set(selectors.flatMap(sel=>Array.from(document.querySelectorAll(sel))))]
      .filter(el =>
        !el.closest("[hidden]") &&
        el.offsetParent!==null &&
        !el.matches(":hover") &&
        !el.closest(":hover") &&
        !el.closest("#catalogDrawer")
      );
  }

  function glitchOne(){
    if(document.visibilityState!=="visible") return;
    let pool=candidates();
    if(!pool.length) return;
    if(pool.length>1 && last) pool=pool.filter(el=>el!==last);
    const el=pool[Math.floor(Math.random()*pool.length)];
    last=el;
    el.classList.remove("ambient-glitch");
    void el.offsetWidth;
    el.classList.add("ambient-glitch");
    setTimeout(()=>el.classList.remove("ambient-glitch"),560);
  }

  function schedule(){
    // Frequent enough to be part of the site's atmosphere, but one element at a time.
    const delay=3200 + Math.random()*4200;
    setTimeout(()=>{
      glitchOne();
      schedule();
    },delay);
  }

  setTimeout(()=>{
    glitchOne();
    schedule();
  },1800);
})();


// Main-page hover glitches intentionally disabled in final16.
