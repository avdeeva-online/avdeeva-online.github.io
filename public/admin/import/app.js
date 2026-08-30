const $ = (s) => document.querySelector(s);
let records = [];
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/ig;

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function uuidOf(s) {
  const m = String(s || '').match(UUID_RE);
  UUID_RE.lastIndex = 0;
  return m ? m[0].toLowerCase() : '';
}
function janitorUrl(id) { return `https://janitorai.com/characters/${id}`; }
function setRecords(list) {
  const seen = new Set();
  records = list.filter((x) => x.id && !seen.has(x.id) && (seen.add(x.id), true)).map((x) => ({...x, selected:true, state:'READY'}));
  render();
}
function render() {
  $('#count').textContent = `${String(records.length).padStart(3,'0')} FOUND`;
  if (!records.length) {
    $('#list').innerHTML = '<div class="empty">NO RECORDS LOADED</div>';
    return;
  }
  $('#list').innerHTML = records.map((r,i) => `<label class="item"><input type="checkbox" data-i="${i}" ${r.selected?'checked':''}><span><b>${esc(r.name||r.id)}</b><small>${esc(r.id)}</small></span><span class="state ${r.state==='IMPORTED'?'ok':r.state==='FAILED'?'bad':r.state==='IMPORTING'?'work':''}">${esc(r.state)}</span></label>`).join('');
}
async function scanAuthor() {
  const raw = $('#authorInput').value.trim();
  const creator = uuidOf(raw);
  if (!creator) {
    $('#authorStatus').textContent = 'ERROR: creator UUID not found in this URL.';
    return;
  }
  let base;
  try {
    base = new URL(raw);
    if (!/datacat\.run$/i.test(base.hostname)) throw new Error('NOT_DATACAT');
  } catch {
    $('#authorStatus').textContent = 'ERROR: вставь полную ссылку профиля автора DataCat.';
    return;
  }

  $('#scanAuthor').disabled = true;
  $('#authorStatus').textContent = 'SCANNING DATACAT CREATOR...';
  try {
    const r = await fetch(`/api/admin/creator-scan?url=${encodeURIComponent(base.toString())}`, {cache:'no-store'});
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) throw new Error(d.error || d.message || `HTTP_${r.status}`);
    setRecords(Array.isArray(d.characters) ? d.characters : []);
    $('#authorStatus').textContent = d.count
      ? `DONE. ${d.count} PUBLIC CHARACTERS FOUND · ${d.pagesScanned || 1} PAGE(S) SCANNED.`
      : `NO CHARACTERS FOUND. Worker fetched DataCat directly, but no character UUIDs were present in the returned HTML.`;
  } catch (e) {
    $('#authorStatus').textContent = `SCAN FAILED: ${e.message}`;
  } finally {
    $('#scanAuthor').disabled = false;
  }
}
function parsePasted() {
  const text = $('#linksInput').value;
  const ids = [...new Set((text.match(UUID_RE) || []).map((x) => x.toLowerCase()))];
  UUID_RE.lastIndex = 0;
  setRecords(ids.map((id) => ({id, name:id})));
}
async function poll(uuid, max=24) {
  for (let i=0; i<max; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const resp = await fetch(`/api/import/status?uuid=${uuid}`, {cache:'no-store'});
    const d = await resp.json().catch(() => ({}));
    if (resp.ok && d.ready) return {ok:true};
    if (resp.status >= 400 && resp.status !== 202) return {ok:false, error:d.state || `HTTP_${resp.status}`};
  }
  return {ok:false, error:'TIMEOUT'};
}
async function importOne(r) {
  r.state='IMPORTING'; render();
  try {
    const resp = await fetch('/api/import', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({url:janitorUrl(r.id)})});
    const d = await resp.json().catch(() => ({}));
    if (resp.status === 202 || d.state === 'RETRIEVAL_QUEUED') {
      r.state='QUEUED'; render();
      const p = await poll(r.id);
      if (!p.ok) throw new Error(p.error);
    } else if (!resp.ok || d.ok === false) {
      throw new Error(d.state || d.error || `HTTP_${resp.status}`);
    }
    r.state='IMPORTED';
  } catch (e) {
    r.state='FAILED';
    r.error=e.message;
  }
  render();
}
async function runBulk() {
  const queue = records.filter((x) => x.selected);
  if (!queue.length) return;
  $('#importSelected').disabled=true;
  let pos=0;
  async function workerLoop() {
    while (pos < queue.length) {
      const r = queue[pos++];
      await importOne(r);
    }
  }
  await Promise.all([workerLoop(), workerLoop()]);
  $('#importSelected').disabled=false;
  const ok = records.filter((x)=>x.state==='IMPORTED').length;
  const bad = records.filter((x)=>x.state==='FAILED').length;
  $('#summary').innerHTML = `<span><b>${ok}</b> imported</span><span><b>${bad}</b> failed</span><span><b>${records.length-ok-bad}</b> untouched/queued</span>`;
}

function init() {
  $('#authorStatus').textContent = 'READY. SCRIPT ONLINE.';
  document.querySelectorAll('[data-mode]').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('active', x===b));
      $('#authorPanel').classList.toggle('hidden', b.dataset.mode !== 'author');
      $('#linksPanel').classList.toggle('hidden', b.dataset.mode !== 'links');
    });
  });
  $('#scanAuthor').addEventListener('click', scanAuthor);
  $('#parseLinks').addEventListener('click', parsePasted);
  $('#selectAll').addEventListener('click', () => {records.forEach((x)=>x.selected=true);render();});
  $('#selectNone').addEventListener('click', () => {records.forEach((x)=>x.selected=false);render();});
  $('#importSelected').addEventListener('click', runBulk);
  $('#list').addEventListener('change', (e) => {
    const i = Number(e.target.dataset.i);
    if (Number.isInteger(i) && records[i]) records[i].selected = e.target.checked;
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();