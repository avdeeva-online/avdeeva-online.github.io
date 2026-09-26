/* Resource form: characteristic buttons (tone / style / color / motifs for themes, purpose for plugins).
   The form keeps saving tags from #extraTags only; a button just adds or removes its "group:value" token there,
   and the buttons re-read that field whenever the form fills it (analysis, draft, edit). */
(()=>{
  const F=window.HUB_FACETS,input=document.getElementById('extraTags'),typeBox=document.getElementById('typeChoices');
  if(!F||!input||!typeBox)return;
  const SINGLE=new Set(['tone']);
  const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const tokens=()=>input.value.split(',').map(x=>x.trim()).filter(Boolean);
  const has=(key,value)=>tokens().some(t=>{const p=F.parse(t);return p&&p.key===key&&p.value===value});
  const nativeValue=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
  const write=list=>{nativeValue.set.call(input,list.join(', '));input.dispatchEvent(new Event('input',{bubbles:true}))};

  const box=document.createElement('div');box.className='field facet-field';box.hidden=true;
  (document.getElementById('settingChoices')?.closest('.field')||typeBox.closest('.field')).insertAdjacentElement('afterend',box);
  const style=document.createElement('style');style.textContent=`.facet-field .facet-row{display:grid;grid-template-columns:110px minmax(0,1fr);gap:8px;align-items:start;margin:0 0 8px}.facet-field .facet-row>span{padding-top:7px;font-size:10px;color:#8f9a89;letter-spacing:.04em}.facet-field .facet-row .choice-group{display:flex;flex-wrap:wrap;gap:5px}.facet-field .hint{margin-top:4px}@media(max-width:620px){.facet-field .facet-row{grid-template-columns:1fr}}`;document.head.appendChild(style);

  const currentType=()=>typeBox.querySelector('.choice.active')?.dataset.v||'';
  function render(){
    const groups=F.groupsFor(currentType());box.hidden=!groups.length;
    if(!groups.length){box.innerHTML='';return}
    box.innerHTML=`<label>Характеристики</label>${groups.map(g=>`<div class="facet-row"><span>${esc(g.ru)}${SINGLE.has(g.key)?' (одно)':''}</span><div class="choice-group">${g.values.map(([id,ru])=>`<button type="button" class="choice${has(g.key,id)?' active':''}" data-facet="${esc(g.key)}" data-value="${esc(id)}">${esc(ru)}</button>`).join('')}</div></div>`).join('')}<div class="hint">По ним на сайте работают фильтры. Кнопки просто добавляют теги вида «tone:dark» в поле «Дополнительные теги».</div>`;
  }
  box.addEventListener('click',e=>{
    const b=e.target.closest('[data-facet]');if(!b)return;
    const key=b.dataset.facet,value=b.dataset.value,token=`${key}:${value}`,on=has(key,value);
    let list=tokens().filter(t=>{const p=F.parse(t);if(!p||p.key!==key)return true;return !(on&&p.value===value)&&!(SINGLE.has(key)&&!on)});
    if(!on)list.push(token);
    write(list);render();
  });
  // Re-sync when the form fills the tags field itself (analysis, draft, edit mode) or the type changes.
  Object.defineProperty(input,'value',{configurable:true,get(){return nativeValue.get.call(this)},set(v){nativeValue.set.call(this,v);render()}});
  input.addEventListener('input',render);
  new MutationObserver(render).observe(typeBox,{subtree:true,attributes:true,attributeFilter:['class'],childList:true});
  render();
})();
