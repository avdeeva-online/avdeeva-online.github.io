(()=>{
  const style=document.createElement('style');
  style.textContent=`
    .modal-public-body{font-family:Arial,sans-serif!important}
    .public-summary{display:grid;gap:8px}
    .public-summary-hook{font-size:12px;line-height:1.45;color:#d8ddcf;font-weight:700}
    .public-summary-lead{font-size:10.5px;line-height:1.5;color:#bec5b8}
    .public-summary-meta{display:grid;grid-template-columns:max-content 1fr;gap:3px 8px;padding:6px 0;border-top:1px solid rgba(100,112,94,.24);border-bottom:1px solid rgba(100,112,94,.24)}
    .public-summary-meta b,.public-summary-section h4{font:700 7.5px/1.4 var(--mono);letter-spacing:.08em;color:#8e9a84}
    .public-summary-meta span{font:10px/1.45 Arial,sans-serif;color:#c0c6ba}
    .public-summary-section{display:grid;gap:3px}
    .public-summary-section h4{margin:0;text-transform:uppercase}
    .public-summary-section p{margin:0!important;font:10.5px/1.5 Arial,sans-serif!important;color:#b8beb3!important}
    .public-summary-chapters{display:grid;gap:5px}
    .public-summary-chapter{padding-left:8px;border-left:1px solid rgba(125,139,111,.38)}
    .public-summary-chapter b{display:block;font:700 8px/1.4 var(--mono);color:#aeb8a3;margin-bottom:2px}
    .public-summary-note{color:#858f80!important;font-size:9.5px!important}
  `;
  document.head.appendChild(style);

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=s=>String(s||'').replace(/\*\*\*|\*\*|\*/g,'').replace(/\|\s*$/,'').trim();
  const creatorStop=/^(?:!{0,2}\s*)?(?:WHAT I WRITE|WHAT I DON'T WRITE|WHAT I WRITE\s*\/\s*DON'T WRITE|DON'T WRITE|BLOCKING|RULES|BOT RULES|CREATOR NOTES?|AUTHOR NOTES?|REQUESTS?|FAQ)\b/i;
  const promoStop=/^(?:SOCIALS?|MY SOCIALS?|OTHER BOTS?|MORE BOTS?|UPCOMING BOTS?)\b/i;
  const sectionRx=/^(WHO ARE YOU|WHO IS HE|WHO ARE THEY|WHO ARE WE|PLOT|PREMISE|SCENARIO|BACKGROUND|CONTEXT)\s*:\s*(.*)$/i;
  const metaRx=/^(CHARACTER|SETTING|SERIES)\s*:?[ \t]+(.+)$/i;
  const chapterRx=/^CHAPTER\s+(\d+)(?:\s*:\s*(.*))?$/i;

  function parse(raw){
    let lines=String(raw||'').replace(/\r/g,'').split('\n').map(clean);
    const stop=lines.findIndex(x=>creatorStop.test(x)||promoStop.test(x));
    if(stop>=0)lines=lines.slice(0,stop);
    while(lines.length&&!lines[lines.length-1])lines.pop();
    const out={hook:'',lead:'',meta:[],sections:[],chapters:[],notes:[]};
    let i=0;
    while(i<lines.length&&!lines[i])i++;
    if(i<lines.length && /^['"“].+['"”]$/.test(lines[i])) out.hook=lines[i++];
    while(i<lines.length&&!lines[i])i++;
    if(i<lines.length && !metaRx.test(lines[i]) && !sectionRx.test(lines[i]) && !/^CHAPTERS?$/i.test(lines[i])) out.lead=lines[i++];
    let current=null;
    for(;i<lines.length;i++){
      const line=lines[i]; if(!line)continue;
      if(creatorStop.test(line)||promoStop.test(line))break;
      let m=line.match(metaRx); if(m){out.meta.push([m[1].toUpperCase(),m[2]]);current=null;continue}
      m=line.match(sectionRx); if(m){current={title:m[1].toUpperCase(),text:m[2]||''};out.sections.push(current);continue}
      if(/^CHAPTERS?$/i.test(line)){current={kind:'chapters'};continue}
      m=line.match(chapterRx); if(m){current={kind:'chapter',title:`CHAPTER ${m[1]}${m[2]?`: ${m[2]}`:''}`,text:''};out.chapters.push(current);continue}
      if(/^(HIS|HER|THEIR) FAMILY$/i.test(line)){current=null;continue}
      if(/(?:VIDEO LINK|MADE BY|check it below|next is \d+ new bots?)/i.test(line)){out.notes.push(line);current=null;continue}
      if(current?.kind==='chapter'){current.text+=(current.text?' ':'')+line;continue}
      if(current && !current.kind){current.text+=(current.text?' ':'')+line;continue}
      if(!out.lead)out.lead=line; else out.notes.push(line);
    }
    return out;
  }
  function markup(raw){
    const d=parse(raw); let html='<div class="public-summary">';
    if(d.hook)html+=`<div class="public-summary-hook">${esc(d.hook)}</div>`;
    if(d.lead)html+=`<div class="public-summary-lead">${esc(d.lead)}</div>`;
    if(d.meta.length)html+=`<div class="public-summary-meta">${d.meta.map(([k,v])=>`<b>${esc(k)}</b><span>${esc(v)}</span>`).join('')}</div>`;
    html+=d.sections.filter(x=>x.text).map(x=>`<section class="public-summary-section"><h4>${esc(x.title)}</h4><p>${esc(x.text)}</p></section>`).join('');
    if(d.chapters.length)html+=`<section class="public-summary-section"><h4>CHAPTERS</h4><div class="public-summary-chapters">${d.chapters.map(x=>`<div class="public-summary-chapter"><b>${esc(x.title)}</b>${x.text?`<p>${esc(x.text)}</p>`:''}</div>`).join('')}</div></section>`;
    if(d.notes.length)html+=`<section class="public-summary-section"><h4>NOTES</h4>${d.notes.slice(0,2).map(x=>`<p class="public-summary-note">${esc(x)}</p>`).join('')}</section>`;
    return html+'</div>';
  }
  function render(bot){const body=document.querySelector('#modalPublicBody');if(!body||!bot)return;body.innerHTML=markup(bot.publicDescription||bot.short||'');body.scrollTop=0}
  window.addEventListener('archive:modal-public-ready',e=>setTimeout(()=>render(e.detail?.bot),0));
  window.addEventListener('archive:modal-definition-ready',e=>setTimeout(()=>render(e.detail?.bot),0));
})();