/* LoreKey — the CODEX tab that translates lorebook trigger keys EN → RU (SillyTavern World Info / Tavo, and the
   character_book inside a card). Runs entirely in the visitor's browser with THEIR OWN AI key and provider:
   the lorebook is never uploaded to ARCHIVE.EXE; only trigger keys, the entry title and a short piece of its content
   go straight from the browser to the chosen AI (Gemini or any OpenAI-compatible API). Ported from the local LoreKey app. */
(()=>{
  const root=document.getElementById('lorekeyPanel');
  if(!root||root.dataset.ready)return;root.dataset.ready='1';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const STORE='lorekey-settings',MAX_FILES=5;

  root.innerHTML=`
  <div class="lk-intro">
    <span class="lk-badge">EN → RU</span>
    <p>Загрузи World Info / Lorebook из SillyTavern или Tavo. LoreKey переведёт триггер-ключи (а по желанию — и текст записей), сохранит все настройки и даст проверить результат перед скачиванием.</p>
    <button type="button" class="lk-ghost" data-lk="settings" aria-expanded="false">⚙ Ключ ИИ</button>
  </div>

  <section class="lk-settings" hidden>
    <div class="lk-row2">
      <label class="lk-field"><span>Провайдер</span><select data-lk="provider"><option value="gemini">Google Gemini</option><option value="openai">OpenAI-совместимый (OpenAI, OpenRouter, DeepSeek…)</option></select></label>
      <label class="lk-field"><span>Модель</span><input data-lk="model" value="gemini-2.5-flash" autocomplete="off" spellcheck="false"></label>
    </div>
    <label class="lk-field" data-lk="baseUrlField" hidden><span>Base URL</span><input data-lk="baseUrl" list="lkBaseUrls" value="https://api.openai.com/v1" autocomplete="off" spellcheck="false">
      <datalist id="lkBaseUrls"><option value="https://api.openai.com/v1"><option value="https://openrouter.ai/api/v1"><option value="https://api.deepseek.com/v1"></datalist></label>
    <label class="lk-field"><span>API key</span><input data-lk="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="Вставь свой API key"></label>
    <label class="lk-check"><input type="checkbox" data-lk="remember"> <span>Запомнить ключ только в этом браузере</span></label>
    <p class="lk-note">Ключ твой и хранится только у тебя в браузере — на сайт ARCHIVE.EXE он не отправляется. Лорбук тоже никуда не загружается: ИИ получает только ключи, название записи и короткий кусочек её текста.</p>
    <p class="lk-note">Бесплатный ключ Gemini: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">aistudio.google.com/apikey</a> → «Create API key» → скопируй и вставь сюда.</p>
  </section>

  <section class="lk-step">
    <div class="lk-head"><span class="lk-num">01</span><div><h3>Открыть lorebook</h3><p>JSON из SillyTavern / Tavo или карточка бота с лорбуком · до ${MAX_FILES} файлов за раз</p></div><span class="lk-status" data-lk="fileStatus">Ждёт файл</span></div>
    <label class="lk-drop" data-lk="drop"><input type="file" accept=".json,application/json" multiple hidden data-lk="file"><span class="lk-plus">＋</span><b>Выбрать lorebook JSON</b><small>или перетащи файлы сюда · до ${MAX_FILES} штук</small></label>
    <div class="lk-file" data-lk="fileBox" hidden><div class="lk-files" data-lk="fileList"></div><div class="lk-file-actions"><button type="button" class="lk-ghost" data-lk="replace">＋ Добавить ещё</button><button type="button" class="lk-ghost" data-lk="clear">Убрать все</button></div><div class="lk-badges" data-lk="badges"></div></div>
  </section>

  <section class="lk-step">
    <div class="lk-head"><span class="lk-num">02</span><div><h3>Параметры</h3><p>Как сохранить русские ключи</p></div></div>
    <div class="lk-label">Результат</div>
    <div class="lk-seg"><label><input type="radio" name="lkOutput" value="ru"><span>Только RU</span></label><label><input type="radio" name="lkOutput" value="both" checked><span>EN + RU</span></label></div>
    <div class="lk-label">Перевод</div>
    <div class="lk-modes">
      <label><input type="radio" name="lkMode" value="exact"><span><b>Точный</b><small>Только основной перевод</small></span></label>
      <label><input type="radio" name="lkMode" value="normal" checked><span><b>Нормальный</b><small>Перевод + полезные формы</small></span><em>по умолчанию</em></label>
      <label><input type="radio" name="lkMode" value="extended"><span><b>Расширенный</b><small>Формы + умеренные синонимы</small></span></label>
    </div>
    <div class="lk-label">Окончания</div>
    <div class="lk-modes">
      <label><input type="radio" name="lkForms" value="auto" checked><span><b>Как в режиме</b><small>Формы, которые подберёт ИИ</small></span><em>по умолчанию</em></label>
      <label><input type="radio" name="lkForms" value="cases"><span><b>Все падежи</b><small>Каждое слово во всех 6 падежах, ед. и мн. число</small></span></label>
      <label><input type="radio" name="lkForms" value="stem"><span><b>Основа</b><small>«деньг» вместо «деньги», «деньгам»… — ловит любые окончания</small></span></label>
    </div>
    <details class="lk-adv"><summary>Дополнительно</summary>
      <label class="lk-check"><input type="checkbox" data-lk="primary" checked><span>Переводить основные ключи (<code>key</code> / <code>keys</code>)</span></label>
      <label class="lk-check"><input type="checkbox" data-lk="secondary" checked><span>Переводить дополнительные ключи (<code>keysecondary</code> / <code>secondary_keys</code>)</span></label>
      <label class="lk-check"><input type="checkbox" data-lk="content"><span>Переводить и текст записей (<code>content</code>) <b class="lk-warn">дольше и тратит больше лимита ключа</b></span></label>
    </details>
    <button type="button" class="lk-main" data-lk="translate" disabled>Перевести ключи</button>
    <p class="lk-hint" data-lk="hint">Сначала выбери JSON-файл</p>
  </section>

  <section class="lk-step" data-lk="progressBox" hidden>
    <div class="lk-head"><span class="lk-num lk-pulse">••</span><div><h3>Перевожу</h3><p data-lk="progressText">Подготовка…</p></div><b class="lk-pct" data-lk="pct">0%</b></div>
    <div class="lk-track"><div data-lk="fill"></div></div>
    <button type="button" class="lk-ghost lk-stop" data-lk="stop">Остановить</button>
  </section>

  <section class="lk-step" data-lk="results" hidden>
    <div class="lk-head"><span class="lk-num lk-ok">03</span><div><h3>Готово</h3><p>Проверь изменения и скачай готовые lorebook</p></div></div>
    <div class="lk-summary" data-lk="summary"></div>
    <div class="lk-toolbar"><div><b>Изменённые ключи</b><small>Перевод можно поправить вручную — через запятую</small></div><button type="button" class="lk-ghost" data-lk="collapse">Свернуть всё</button></div>
    <div class="lk-entries" data-lk="entries"></div>
    <div class="lk-download"><button type="button" class="lk-ghost" data-lk="reset">Другие файлы</button><button type="button" class="lk-main" data-lk="download">Скачать JSON</button></div>
  </section>`;

  const el=name=>root.querySelector(`[data-lk="${name}"]`);
  const els=Object.fromEntries(['settings','provider','model','baseUrlField','baseUrl','apiKey','remember','fileStatus','drop','file','fileBox','fileList','replace','clear','badges','primary','secondary','content','translate','hint','progressBox','progressText','pct','fill','stop','results','summary','collapse','entries','download','reset'].map(n=>[n,el(n)]));
  const settingsBox=root.querySelector('.lk-settings');
  /* Up to MAX_FILES lorebooks; each keeps its own original, output and review rows, and downloads as its own file. */
  // cache: keys and texts already translated in this tab, so pressing «Перевести» again after a stop or a dropped
  // connection continues where it stopped instead of starting over (and spending the key's limit twice).
  const state={books:[],stopped:false,cache:new Map()};
  const newBook=(filename,size,original,stats)=>({filename,size,original,stats,output:null,rows:[],translated:0,skippedRegex:0,contentDone:0});
  const doneBooks=()=>state.books.filter(b=>b.output);
  const lorebooks=n=>`${n} ${n%10===1&&n%100!==11?'лорбук':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'лорбука':'лорбуков'}`;

  // ---- settings (kept only in this browser) ----
  function restore(){let s={};try{s=JSON.parse(localStorage.getItem(STORE)||'{}')}catch{}if(s.provider)els.provider.value=s.provider;if(s.baseUrl)els.baseUrl.value=s.baseUrl;if(s.model)els.model.value=s.model;if(s.apiKey){els.apiKey.value=s.apiKey;els.remember.checked=true}syncProvider()}
  function persist(){const s={provider:els.provider.value,baseUrl:els.baseUrl.value.trim(),model:els.model.value.trim()};if(els.remember.checked&&els.apiKey.value.trim())s.apiKey=els.apiKey.value.trim();try{localStorage.setItem(STORE,JSON.stringify(s))}catch{}}
  function syncProvider(){els.baseUrlField.hidden=els.provider.value==='gemini'}
  function toggleSettings(force){const show=typeof force==='boolean'?force:settingsBox.hidden;settingsBox.hidden=!show;els.settings.setAttribute('aria-expanded',String(show));if(show)settingsBox.scrollIntoView({behavior:'smooth',block:'nearest'})}

  // ---- lorebook format: SillyTavern / Tavo World Info (entries{} with key / keysecondary) or a card's character_book (entries[] with keys / secondary_keys) ----
  const bookOf=json=>json?.entries?json:json?.data?.character_book?.entries?json.data.character_book:json?.character_book?.entries?json.character_book:null;
  function getEntries(json){const e=bookOf(json)?.entries;if(Array.isArray(e))return e.map((value,i)=>({id:String(i),value}));if(e&&typeof e==='object')return Object.entries(e).map(([id,value])=>({id,value}));return[]}
  const fieldName=(entry,kind)=>kind==='primary'?('keys' in (entry||{})&&!('key' in (entry||{}))?'keys':'key'):('secondary_keys' in (entry||{})&&!('keysecondary' in (entry||{}))?'secondary_keys':'keysecondary');
  const keysOf=v=>Array.isArray(v)?v.map(x=>String(x).trim()).filter(Boolean):typeof v==='string'?v.split(',').map(x=>x.trim()).filter(Boolean):[];
  const writeKeys=(entry,field,values)=>{entry[field]=typeof entry[field]==='string'?values.join(', '):values};
  const isRegex=v=>/^\/(?:[^/\\]|\\.)+\/[a-z]*$/i.test(String(v).trim());
  const norm=v=>String(v).trim().replace(/\s+/g,' ').toLocaleLowerCase('ru');
  const unique=list=>{const seen=new Set();return list.filter(v=>{const n=norm(v);if(!n||seen.has(n))return false;seen.add(n);return true})};
  const outputMode=()=>root.querySelector('input[name="lkOutput"]:checked')?.value||'both';
  const transMode=()=>root.querySelector('input[name="lkMode"]:checked')?.value||'normal';
  const formMode=()=>root.querySelector('input[name="lkForms"]:checked')?.value||'auto';
  const kinds=()=>[...(els.primary.checked?['primary']:[]),...(els.secondary.checked?['secondary']:[])];

  function badge(text,good){const b=document.createElement('span');b.className='lk-mini'+(good?' good':'');b.textContent=text;els.badges.appendChild(b)}
  async function readBook(file){
    if(file.size>15*1024*1024)throw new Error('файл больше 15 МБ');
    const json=JSON.parse(await file.text()),entries=getEntries(json);
    if(!entries.length)throw new Error('не найдены записи lorebook (entries)');
    let p=0,s=0,rx=0;for(const {value} of entries){const a=keysOf(value?.[fieldName(value,'primary')]),b=keysOf(value?.[fieldName(value,'secondary')]);p+=a.length;s+=b.length;rx+=[...a,...b].filter(isRegex).length}
    return newBook(file.name,file.size,json,{entries:entries.length,primary:p,secondary:s,regex:rx,fromCard:bookOf(json)!==json});
  }
  async function loadFiles(list){
    const files=[...(list||[])].filter(Boolean);if(!files.length)return;
    const errors=[],free=MAX_FILES-state.books.length;
    if(free<=0){alert(`Можно добавить не больше ${MAX_FILES} лорбуков за раз.`);return}
    if(files.length>free)errors.push(`добавлены только первые ${free} — лимит ${MAX_FILES} лорбуков за раз`);
    for(const file of files.slice(0,free)){
      if(state.books.some(b=>b.filename===file.name&&b.size===file.size)){errors.push(`${file.name}: уже добавлен`);continue}
      try{state.books.push(await readBook(file))}catch(err){errors.push(`${file.name}: ${err.message}`)}
    }
    for(const b of state.books){b.output=null;b.rows=[];b.translated=0;b.skippedRegex=0;b.contentDone=0}
    els.file.value='';renderFiles();
    if(errors.length)alert(`Не удалось открыть часть файлов:\n${errors.join('\n')}`);
  }
  function renderFiles(){
    const books=state.books,has=books.length>0;
    els.fileList.innerHTML=books.map((b,i)=>`<div class="lk-file-main"><span class="lk-file-ico">JSON</span><div><b>${esc(b.filename)}</b><small>${b.stats.entries} записей · ${(b.size/1024).toFixed(1)} КБ${b.stats.fromCard?' · из карточки':''}</small></div><button type="button" class="lk-ghost lk-x" data-remove="${i}" aria-label="Убрать ${esc(b.filename)}">×</button></div>`).join('');
    const sum=k=>books.reduce((n,b)=>n+b.stats[k],0);
    els.badges.innerHTML='';if(has){if(books.length>1)badge(lorebooks(books.length),true);badge(`${sum('entries')} записей`,true);badge(`${sum('primary')} основных ключей`);badge(`${sum('secondary')} дополнительных`);if(sum('regex'))badge(`${sum('regex')} regex`)}
    els.drop.hidden=has;els.fileBox.hidden=!has;els.replace.hidden=books.length>=MAX_FILES;
    els.fileStatus.textContent=has?`${books.length} из ${MAX_FILES}`:'Ждёт файл';els.fileStatus.classList.toggle('ok',has);
    els.translate.disabled=!has;els.translate.textContent=books.length>1?`Перевести ключи · ${lorebooks(books.length)}`:'Перевести ключи';
    els.hint.textContent=has?'Готово к переводу':'Сначала выбери JSON-файл';els.results.hidden=true;els.progressBox.hidden=true;
  }

  function buildTasks(book){
    const tasks=[];book.skippedRegex=0;
    for(const item of getEntries(book.original)){
      const e=item.value||{},title=e.comment||e.name||`Entry ${item.id}`,context=String(e.content||'').replace(/\s+/g,' ').slice(0,500);
      for(const kind of kinds()){const field=fieldName(e,kind);for(const key of keysOf(e[field])){if(isRegex(key)){book.skippedRegex++;continue}/* regex keys stay as they are */tasks.push({entryId:item.id,field,key,title,context,regex:isRegex(key)})}}
    }
    return tasks;
  }
  // One request carries many entries: an entry's context goes once (not once per key), and a batch holds up to
  // 60 keys (15 when every key comes back in ~12 case forms, so each answer stays short) and ~14k characters. Earlier a 850-character context was
  // repeated for every key, so a batch held one entry and a lorebook took a request per entry or so.
  function batches(tasks){const groups=[],byEntry=new Map();for(const t of tasks){if(!byEntry.has(t.entryId))byEntry.set(t.entryId,[]);byEntry.get(t.entryId).push(t)}const maxKeys=formMode()==='auto'?60:15;let batch=[],chars=0;for(const g of byEntry.values()){for(let i=0;i<g.length;i+=maxKeys){const part=g.slice(i,i+maxKeys),cost=g[0].context.length+g[0].title.length+60+part.reduce((n,t)=>n+t.key.length+40,0);if(batch.length&&(chars+cost>14000||batch.length+part.length>maxKeys)){groups.push(batch);batch=[];chars=0}batch.push(...part);chars+=cost}}if(batch.length)groups.push(batch);return groups}
  const taskId=t=>`${t.entryId}::${t.field}::${t.key}`;

  async function translateAll(){
    if(!state.books.length)return;
    if(!els.apiKey.value.trim()){toggleSettings(true);els.apiKey.focus();alert('Нужен твой API key. Вставь его в «⚙ Ключ ИИ» — он хранится только в твоём браузере.');return}
    if(els.provider.value==='openai'&&!/^https:\/\//i.test(els.baseUrl.value.trim())){toggleSettings(true);alert('Base URL должен начинаться с https://');return}
    const books=state.books,withContent=els.content.checked,plans=books.map(book=>{book.output=null;book.rows=[];book.translated=0;book.contentDone=0;return{book,tasks:buildTasks(book)}});
    if(!withContent&&!plans.some(p=>p.tasks.length)){alert('В выбранных полях нет ключей для перевода.');return}
    persist();state.stopped=false;els.translate.disabled=true;els.progressBox.hidden=false;els.results.hidden=true;progress(0,state.cache.size?'Продолжаю с места остановки…':'Собираю ключи…');
    const lock=await keepAwake();
    // Overall progress: every lorebook gets an equal slice of 0–100%.
    const slice=100/books.length;
    try{
      for(let n=0;n<plans.length;n++){
        const {book,tasks}=plans[n],base=n*slice,label=books.length>1?`Лорбук ${n+1} из ${books.length} · `:'';
        const output=structuredClone(book.original),map=new Map(),ck=t=>`${transMode()}|${formMode()}|${book.filename}|${book.size}|${taskId(t)}`;
        for(const t of tasks)if(state.cache.has(ck(t)))map.set(taskId(t),state.cache.get(ck(t)));
        const groups=batches(tasks.filter(t=>!map.has(taskId(t)))),keysShare=withContent?40:92;
        for(let i=0;i<groups.length;i++){
          if(state.stopped)throw new Error('остановлено');
          progress(Math.round(base+i/groups.length*keysShare*slice/100),`${label}Ключи: пакет ${i+1} из ${groups.length}…`);
          const byId=new Map(groups[i].map(t=>[taskId(t),t]));
          for(const item of await translateBatch(groups[i])){const tr=Array.isArray(item.translations)?item.translations:[];map.set(item.id,tr);const t=byId.get(item.id);if(t)state.cache.set(ck(t),tr)}
        }
        apply(book,output,tasks,map);
        if(withContent)await translateContent(book,output,keysShare,base,slice,label);
        book.output=output;
      }
      progress(100,'Готово');renderResults();els.translate.textContent=books.length>1?`Перевести ключи · ${lorebooks(books.length)}`:'Перевести ключи';
      setTimeout(()=>els.results.scrollIntoView({behavior:'smooth',block:'start'}),80);
    }catch(err){
      console.error(err);const resume=state.cache.size?'\n\nУже переведённое сохранено — нажми «Перевести» ещё раз, и я продолжу с места остановки.':'';
      if(err.message!=='остановлено')alert(err.network?`Связь с ИИ оборвалась.${resume}\n\nНа телефоне не блокируй экран и не сворачивай браузер, пока идёт перевод.`:`Перевод остановлен: ${err.message}${resume}`);
      progress(0,err.message==='остановлено'?'Остановлено':'Ошибка перевода');if(state.cache.size)els.translate.textContent='Продолжить перевод';
      if(doneBooks().length)renderResults();/* lorebooks finished before the stop stay downloadable */
    }
    finally{els.translate.disabled=false;lock?.release?.().catch(()=>{})}
  }

  // ---- «Основа»: stems computed here from the full case forms the AI returns, so every ending is covered ----
  // One stem when only endings differ (рыцарь… → «рыцар»), several when the stem itself changes (деньги / денег,
  // друг / друзья). A stem is at least 4 letters unless it is a whole word; otherwise the full forms are kept.
  const lowerRu=v=>String(v).trim().toLocaleLowerCase('ru');
  const commonPrefix=ws=>{let p=ws[0]||'';for(const w of ws)while(!w.startsWith(p))p=p.slice(0,-1);return p};
  function stemsOf(forms){
    const ws=[...new Set(forms.map(lowerRu).filter(Boolean))];if(ws.length<2)return ws;
    const p=commonPrefix(ws),min=Math.min(...ws.map(w=>w.length));
    if((p.length>=3&&ws.includes(p))||(p.length>=4&&p.length>=min-3))return[p];
    const groups=new Map();for(const w of ws){const k=w.length>p.length?w[p.length]:'';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(w)}
    if(groups.size===1)return ws;
    return[...groups.values()].flatMap(g=>g.length===1?g:stemsOf(g));
  }
  const withYo=list=>list.flatMap(v=>/ё/.test(v)?[v,v.replaceAll('ё','е')]:[v]);
  const reEsc=v=>v.replace(/[.*+?^${}()|[\]\\/]/g,'\\$&');
  // One word → plain stems («деньг»). A phrase → a regex key, because «чёрн рыцар» never appears as such in text:
  // /(?:чёрн|черн)[а-яё]*\s+рыцар[а-яё]*/i
  function stemKeys(group){
    const forms=group.map(f=>String(f).trim().replace(/\s+/g,' ')).filter(Boolean);if(!forms.length)return[];
    const words=forms.map(f=>f.split(' ')),n=words[0].length;
    if(n===1)return withYo(stemsOf(forms));
    if(words.some(w=>w.length!==n))return forms;
    const parts=[];for(let i=0;i<n;i++){const st=withYo(stemsOf(words.map(w=>w[i])));parts.push(`${st.length>1?`(?:${st.map(reEsc).join('|')})`:reEsc(st[0])}[а-яёa-z]*`)}
    return[`/${parts.join('\\s+')}/i`];
  }
  const groupsOf=item=>Array.isArray(item?.groups)?item.groups.map(g=>(Array.isArray(g)?g:[g]).map(String).filter(Boolean)).filter(g=>g.length):[];

  async function translateBatch(tasks){
    const mode=transMode();
    const modeInstruction=mode==='exact'?'Return only the most natural Russian equivalent for each plaintext trigger. Do not generate declensions or synonyms.'
      :mode==='extended'?'Return the natural Russian translation plus useful Russian grammatical forms and a small number of high-value synonyms/aliases likely to literally appear in roleplay text. Avoid broad/noisy triggers.'
      :'Return the natural Russian translation plus useful grammatical forms likely to literally appear in Russian roleplay text. Add aliases only when clearly necessary. Avoid generic noisy triggers.';
    const byEntry=new Map();for(const t of tasks){if(!byEntry.has(t.entryId))byEntry.set(t.entryId,{entry_title:t.title,context:t.context,keys:[]});byEntry.get(t.entryId).keys.push({id:taskId(t),key:t.key,regex:t.regex})}
    const payload=[...byEntry.values()];
    const forms=formMode(),grouped=forms!=='auto';
    const formsInstruction=grouped?`\n\nCASE FORMS (required): for EVERY Russian word or phrase you return, list ALL its case forms — nominative, genitive, dative, accusative, instrumental, prepositional — in singular and plural (skip forms that do not exist, e.g. plural of a personal name; keep ё where Russian spelling has it). For a phrase, inflect the whole phrase in agreement (\"чёрный рыцарь\", \"чёрного рыцаря\", …). Output {"items":[{"id":"...","groups":[["form",...],...]}]} — one group per Russian word or phrase, nominative singular first. Do not return "translations".`:'';
    const prompt=`You translate SillyTavern Lorebook trigger keys from English to Russian.\n\n${modeInstruction}${formsInstruction}\n\nRules:\n- Output STRICT JSON only: {"items":[{"id":"...","translations":["..."]}]}\n- Never translate or alter template macros such as {{char}}, {{user}}, <START>, variables, code-like tokens, IDs. Preserve them exactly inside phrases.\n- Proper names: transliterate/adapt into readable Russian Cyrillic when appropriate; do not semantically translate surnames unless context clearly shows they are titles/common nouns.\n- Key translations are literal trigger strings, never explanations.\n- For Russian inflection forms, include only natural forms useful as literal triggers. Do not invent impossible forms.\n- Do not duplicate forms differing only by letter case.\n- Preserve meaningful punctuation.\n- If regex=true, preserve valid JavaScript regex syntax and translate only literal English text inside it. If unsafe or ambiguous, return the original regex unchanged.\n- INPUT is a list of lorebook entries; each has entry_title, context (the start of its text) and keys. Use the context only to disambiguate the keys. Never rewrite the lore content. Return one item per key id.\n\nINPUT:\n${JSON.stringify(payload)}`;
    const raw=await withRetry(()=>els.provider.value==='gemini'?callGemini(prompt):callOpenAI(prompt));
    const parsed=parseJson(raw);if(!Array.isArray(parsed.items))throw new Error('ИИ вернул ответ без списка items');
    if(!grouped)return parsed.items;
    return parsed.items.map(item=>{const gs=groupsOf(item),flat=gs.length?gs.flat():(Array.isArray(item.translations)?item.translations:[]);
      return{id:item.id,translations:forms==='stem'&&gs.length?gs.flatMap(stemKeys):flat}});
  }
  // Optional second pass: the lore text itself (entry content) EN → RU. Names follow the keys just translated
  // (a small glossary goes with every batch), macros and formatting are kept. Long entries go one per request.
  async function translateContent(book,output,startPct,base=0,slice=100,label=''){
    const glossary=[];const seen=new Set();
    for(const r of state.books.flatMap(b=>b.rows)){const ru=r.values.find(v=>/[а-яё]/i.test(v));if(ru&&!seen.has(r.oldKey)){seen.add(r.oldKey);glossary.push(`${r.oldKey} → ${ru}`)}if(glossary.length>=150)break}
    const ck=it=>`content|${book.filename}|${book.size}|${it.id}|${it.text.length}|${it.text.slice(0,80)}`,byIdAll=new Map(getEntries(output).map(x=>[x.id,x.value]));
    const all=getEntries(output).filter(x=>typeof x.value?.content==='string'&&/[a-z]/i.test(x.value.content)).map(x=>({id:x.id,text:x.value.content}));
    for(const it of all)if(state.cache.has(ck(it))){byIdAll.get(it.id).content=state.cache.get(ck(it));book.contentDone++}
    const items=all.filter(it=>!state.cache.has(ck(it))),source=new Map(items.map(it=>[it.id,it]));
    const groups=[];let batch=[],chars=0;
    for(const it of items){const cost=it.text.length;if(batch.length&&chars+cost>4000){groups.push(batch);batch=[];chars=0}batch.push(it);chars+=cost}
    if(batch.length)groups.push(batch);
    const byId=new Map(getEntries(output).map(x=>[x.id,x.value]));
    for(let i=0;i<groups.length;i++){
      if(state.stopped)throw new Error('остановлено');
      progress(Math.round(base+(startPct+i/groups.length*(95-startPct))*slice/100),`${label}Текст записей: пакет ${i+1} из ${groups.length}…`);
      const prompt=`You translate SillyTavern / Tavo lorebook entry texts from English to Russian for Russian-language roleplay.\n\nRules:\n- Output STRICT JSON only: {"items":[{"id":"...","text":"..."}]} — one item per input id.\n- Translate the whole text faithfully and naturally; do not summarize, shorten, add or explain anything.\n- Never translate or alter template macros and tokens: {{char}}, {{user}}, <START>, {{random::…}}, variables, code, URLs, IDs. Keep them exactly.\n- Keep the formatting exactly: line breaks, lists, brackets, quotes, markdown, W++ / PList / JSON-like structure (translate only the human-language values inside it).\n- Proper names: use the Russian forms from the glossary when given; otherwise transliterate into readable Russian Cyrillic.\n\nGLOSSARY (English key → Russian):\n${glossary.join('\n')||'(none)'}\n\nINPUT:\n${JSON.stringify(groups[i])}`;
      const raw=await withRetry(()=>els.provider.value==='gemini'?callGemini(prompt):callOpenAI(prompt));
      const parsed=parseJson(raw);
      for(const it of Array.isArray(parsed.items)?parsed.items:[]){const entry=byId.get(String(it.id)),src=source.get(String(it.id));if(entry&&typeof it.text==='string'&&it.text.trim()){entry.content=it.text;book.contentDone++;if(src)state.cache.set(ck(src),it.text)}}
    }
  }
  // "Too many requests" / temporary server errors: wait and retry (free Gemini keys hit per-minute limits).
  // Retries: "too many requests" (waits as long as the AI asks, when it says), server errors and dropped connections
  // («Load failed» on a phone) — five tries with growing pauses before giving up.
  async function withRetry(fn){let last;for(let i=0;i<5;i++){if(state.stopped)throw new Error('остановлено');try{return await fn()}catch(e){last=e;if(!e.retry||i===4)throw e;const wait=Math.min(90,Math.max(e.waitSec||0,[10,20,30,45,60][i]));for(let s=wait;s>0;s--){if(state.stopped)throw new Error('остановлено');progress(null,`${e.network?'Связь с ИИ оборвалась':'ИИ просит подождать'}… повтор через ${s} сек`);await new Promise(r=>setTimeout(r,1000))}}}throw last}
  async function failure(name,res){const body=(await res.text().catch(()=>'')).slice(0,600);const e=new Error(`${name}: ${res.status}${res.status===400||res.status===401||res.status===403?' — проверь ключ и модель':res.status===429?' — лимит запросов ключа ИИ':''} ${body.slice(0,300)}`);e.retry=res.status===408||res.status===429||res.status>=500;const sec=Number((body.match(/"retryDelay"\s*:\s*"(\d+)/)||[])[1]||res.headers.get('retry-after')||0);if(sec)e.waitSec=sec;return e}
  // fetch itself throws (TypeError) when the connection drops: that is worth retrying, unlike a refused key.
  // A request that hangs for 90 s is dropped and retried (on a phone a stalled connection otherwise waits forever).
  async function request(url,init){const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),90000);try{return await fetch(url,{...init,signal:ctl.signal})}catch(err){const e=new Error('связь с ИИ оборвалась');e.retry=true;e.network=true;throw e}finally{clearTimeout(timer)}}
  // Keeps the phone screen on during a translation where the browser allows it (a locked screen drops requests).
  async function keepAwake(){try{return await navigator.wakeLock?.request('screen')}catch{return null}}
  async function callGemini(prompt){
    // Key in a header, not in the URL, so it does not end up in address-bar style logs.
    const res=await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(els.model.value.trim()||'gemini-2.5-flash')}:generateContent`,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':els.apiKey.value.trim()},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:.15,responseMimeType:'application/json'}})});
    if(!res.ok)throw await failure('Gemini',res);
    const data=await res.json();return data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
  }
  async function callOpenAI(prompt){
    const base=els.baseUrl.value.trim().replace(/\/$/,'');
    const res=await request(`${base}/chat/completions`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${els.apiKey.value.trim()}`},body:JSON.stringify({model:els.model.value.trim(),temperature:.15,response_format:{type:'json_object'},messages:[{role:'system',content:'Return strict JSON only.'},{role:'user',content:prompt}]})});
    if(!res.ok)throw await failure('API',res);
    const data=await res.json();return data?.choices?.[0]?.message?.content||'';
  }
  function parseJson(raw){const s=String(raw).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');try{return JSON.parse(s)}catch{const a=s.indexOf('{'),b=s.lastIndexOf('}');if(a>=0&&b>a)return JSON.parse(s.slice(a,b+1));throw new Error('ИИ вернул невалидный JSON')}}

  // «деньг» must match inside «деньгами»: switch off "match whole words" for the entry (World Info / character_book).
  function wholeWordsOff(e){if(!e||typeof e!=='object')return;if('keys' in e&&!('key' in e)){e.extensions={...(e.extensions&&typeof e.extensions==='object'?e.extensions:{}),match_whole_words:false}}else e.matchWholeWords=false}
  function apply(book,output,tasks,map){
    const keepEnglish=outputMode()==='both',outEntries=getEntries(output);
    const byKey=new Map(tasks.map(t=>[taskId(t),t]));
    for(const item of getEntries(book.original)){
      const out=outEntries.find(x=>x.id===item.id);if(!out)continue;let stemmed=false;
      for(const kind of kinds()){
        const field=fieldName(item.value,kind),merged=[];
        for(const oldKey of keysOf(item.value?.[field])){
          const t=byKey.get(`${item.id}::${field}::${oldKey}`);if(!t){merged.push(oldKey);continue}
          const ru=unique(map.get(taskId(t))||[]),values=unique(keepEnglish?[oldKey,...ru]:ru),safe=values.length?values:[oldKey];
          merged.push(...safe);book.rows.push({entryId:item.id,field,oldKey,values:safe});if(ru.length){book.translated++;stemmed=true}
        }
        if(field in (item.value||{}))writeKeys(out.value,field,unique(merged));
      }
      if(stemmed&&formMode()==='stem')wholeWordsOff(out.value);
    }
  }

  function renderResults(){
    const books=doneBooks(),many=state.books.length>1;
    els.entries.innerHTML=books.map(book=>{
      const bi=state.books.indexOf(book),grouped=new Map();for(const r of book.rows){if(!grouped.has(r.entryId))grouped.set(r.entryId,[]);grouped.get(r.entryId).push(r)}
      const originals=new Map(getEntries(book.original).map(x=>[x.id,x.value||{}]));
      const cards=[...grouped].map(([id,rows])=>{const e=originals.get(id)||{};const list=f=>rows.filter(r=>f(r.field)).map(r=>`<div class="lk-key"><div class="lk-old">${esc(r.oldKey)}</div><div class="lk-arrow">→</div><textarea rows="2" data-book="${bi}" data-entry="${esc(id)}" data-field="${esc(r.field)}" data-old="${esc(r.oldKey)}">${esc(r.values.join(', '))}</textarea></div>`).join('');
        const prim=list(f=>f==='key'||f==='keys'),sec=list(f=>f==='keysecondary'||f==='secondary_keys');
        return `<article class="lk-entry"><button type="button" class="lk-entry-head"><span>#${esc(id)}</span><b>${esc(e.comment||e.name||`Entry ${id}`)}</b><small>${rows.length} ключ.</small><i>⌃</i></button><div class="lk-entry-body">${prim?`<div class="lk-sec">ОСНОВНЫЕ</div>${prim}`:''}${sec?`<div class="lk-sec">ДОПОЛНИТЕЛЬНЫЕ</div>${sec}`:''}</div></article>`}).join('');
      return many?`<div class="lk-book-head"><b>${esc(book.filename)}</b><small>${book.translated} ключей переведено</small><button type="button" class="lk-ghost" data-download="${bi}">Скачать</button></div>${cards}`:cards;
    }).join('');
    const sum=k=>books.reduce((n,b)=>n+(k==='entries'?b.stats.entries:b[k]),0),rows=books.reduce((n,b)=>n+b.rows.length,0);
    els.summary.innerHTML=[...(many?[[`${books.length}/${state.books.length}`,'лорбуков готово']]:[]),[sum('entries'),'записей'],[sum('translated'),'ключей переведено'],[rows,'ключей проверено'],[sum('skippedRegex'),'regex оставлено как есть'],...(sum('contentDone')?[[sum('contentDone'),'текстов переведено']]:[])].map(([v,l])=>`<div><b>${v}</b><span>${l}</span></div>`).join('');
    els.download.textContent=books.length>1?`Скачать все · ${books.length} JSON`:'Скачать JSON';
    els.results.hidden=false;
  }
  // Manual fix of one key: rebuild that field of the entry from all rows.
  function manualEdit(ta){
    const book=state.books[Number(ta.dataset.book)];if(!book?.output)return;
    const row=book.rows.find(r=>r.entryId===ta.dataset.entry&&r.field===ta.dataset.field&&r.oldKey===ta.dataset.old);if(!row)return;
    row.values=unique(ta.value.split(',').map(s=>s.trim()).filter(Boolean));
    const out=getEntries(book.output).find(x=>x.id===row.entryId)?.value,orig=getEntries(book.original).find(x=>x.id===row.entryId)?.value;if(!out||!orig)return;
    const related=book.rows.filter(r=>r.entryId===row.entryId&&r.field===row.field),merged=[];
    for(const k of keysOf(orig[row.field])){const r=related.find(x=>x.oldKey===k);merged.push(...(r?r.values:[k]))}
    writeKeys(out,row.field,unique(merged));
  }
  function progress(pct,text){if(pct!==null){els.pct.textContent=`${pct}%`;els.fill.style.width=`${pct}%`}els.progressText.textContent=text}
  // Each lorebook is saved as its own file (never zipped); a short pause lets the browser accept several downloads.
  function saveBook(book){
    const url=URL.createObjectURL(new Blob([JSON.stringify(book.output,null,2)],{type:'application/json;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=`${(book.filename||'lorebook.json').replace(/\.json$/i,'')}${outputMode()==='both'?'.ru-en-keys.json':'.ru-keys.json'}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function download(){
    const books=doneBooks();
    for(let i=0;i<books.length;i++){saveBook(books[i]);if(i<books.length-1)await new Promise(r=>setTimeout(r,350))}
  }
  function reset(){
    state.books=[];els.file.value='';els.entries.innerHTML='';renderFiles();
    root.scrollIntoView({behavior:'smooth',block:'start'});
  }

  // ---- events ----
  els.settings.addEventListener('click',()=>toggleSettings());
  els.provider.addEventListener('change',()=>{if(els.provider.value==='gemini'&&(!els.model.value||/^gpt|\//.test(els.model.value)))els.model.value='gemini-2.5-flash';if(els.provider.value==='openai'&&els.model.value.startsWith('gemini'))els.model.value='gpt-5-mini';syncProvider();persist()});
  [els.baseUrl,els.model,els.apiKey,els.remember].forEach(x=>x.addEventListener('change',persist));
  els.remember.addEventListener('change',()=>{if(!els.remember.checked)persist()});
  ['dragenter','dragover'].forEach(ev=>els.drop.addEventListener(ev,e=>{e.preventDefault();els.drop.classList.add('drag')}));
  ['dragleave','drop'].forEach(ev=>els.drop.addEventListener(ev,e=>{e.preventDefault();els.drop.classList.remove('drag')}));
  els.drop.addEventListener('drop',e=>loadFiles(e.dataTransfer.files));
  els.file.addEventListener('change',e=>loadFiles(e.target.files));
  els.replace.addEventListener('click',()=>els.file.click());
  els.clear.addEventListener('click',reset);
  els.fileList.addEventListener('click',e=>{const b=e.target.closest('[data-remove]');if(!b)return;state.books.splice(Number(b.dataset.remove),1);renderFiles()});
  // Dropping more files onto the list adds them too.
  ['dragenter','dragover'].forEach(ev=>els.fileBox.addEventListener(ev,e=>e.preventDefault()));
  els.fileBox.addEventListener('drop',e=>{e.preventDefault();loadFiles(e.dataTransfer.files)});
  els.translate.addEventListener('click',translateAll);
  els.stop.addEventListener('click',()=>{state.stopped=true;progress(null,'Останавливаю…')});
  els.download.addEventListener('click',download);
  els.reset.addEventListener('click',reset);
  els.collapse.addEventListener('click',()=>{const cards=[...root.querySelectorAll('.lk-entry')],collapse=cards.some(c=>!c.classList.contains('collapsed'));cards.forEach(c=>c.classList.toggle('collapsed',collapse));els.collapse.textContent=collapse?'Развернуть всё':'Свернуть всё'});
  els.entries.addEventListener('click',e=>{const d=e.target.closest('[data-download]');if(d){const book=state.books[Number(d.dataset.download)];if(book?.output)saveBook(book);return}const h=e.target.closest('.lk-entry-head');if(h)h.parentElement.classList.toggle('collapsed')});
  els.entries.addEventListener('change',e=>{if(e.target.matches('textarea'))manualEdit(e.target)});
  restore();
})();
