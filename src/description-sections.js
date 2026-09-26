// Splits a creator's public JanitorAI description (plain text, as stored in characters.description)
// into what the catalog shows where:
//   hook   → the short tagline (list card + first line of the modal)
//   about  → the main description: character, {{user}} role, world / backstory sections
//   intros → chapter / scenario notes, matched to the bot's intro messages by number
//   extra  → everything else (series info, warnings, links, credits, author notes) → CARD DATA
// Pure function: the stored text is never changed, so a wrong guess costs nothing and admin overrides stay possible.

const fold=s=>String(s||'').normalize('NFKC').replace(/[​-‍️]/g,'');
// Letters only, lower-case: "𝙰𝙱𝙾𝚄𝚃 𝙲𝙷𝙰𝚁" → "about char", "⟢ CHAPTERS" → "chapters".
const key=s=>fold(s).toLowerCase().replace(/[^\p{L}\p{N}{} ]+/gu,' ').replace(/\s+/g,' ').trim();
const letters=s=>(fold(s).match(/\p{L}/gu)||[]);

const EXTRA_HEADING=/^(from the author|a word from the author|tw|cw|tw cw|trigger warnings?|content warnings?|warnings?|credits?|author s note|authors note|creator s note|note|notes|fyi|links?|kofi|important( information)?|sepha update|update|inspiration|music|playlist|plot ideas|real pictures|the roster|gallery|interesting people.*|what i write.*|scenario guidance.*|lorebook.*|disclaimer|faq|extra|extras|collage.*)$/;
const INTRO_HEADING=/^(chapters?|scenarios?|scenario list|intros?|greetings?|first messages?|messages?|\d+ (messages?|scenarios?|intros?|greetings?))$/;
const INTRO_ITEM=/^(?:(?:chapter|scenario|message|intro|greeting|part|s)\s*)?(\d{1,2}|one|two|three|four|five|six)\s*[:.)\-–—]\s*(.*)$/i;
const WORDS={one:1,two:2,three:3,four:4,five:5,six:6};
// A line that is not about the story. Strong signals count anywhere; weak ones ("thank you", "block")
// also occur in story text, so they only count on short lines.
const EXTRA_STRONG=/(https?:\/\/|rentry\.|deepseek|jllm|proxy|\bkofi\b|ko-fi|patreon|telegram|discord|tiktok|instagram|english is not my first|not my first language|tested (for|on|with)|credits?:|inspiration:|^(tw|cw|tw\/cw)\b|trigger warning|content warning|first message is|initial message|bot cards?,|lorebook website|website here|click (here|this|below)|listened to|deeper dive|my channel|i (use|used) (midjourney|novelai)|do not allow anyone|i don.t take requests|have a nice game|^series\s*:|^setting\s*:|^character\s*:|^note\s*:|^fyi\b|pov.?s of my bots|respectful to each other)/i;
const EXTRA_WEAK=/(\bblock(ing|ed)?\b|thank(s| you)|i appreciate|feedback|check (her|him|them|me|it) out|check out|swipe|website|\bmusic\b|^series\b|link in)/i;
const EXTRA_LINE={test:t=>EXTRA_STRONG.test(t)||(t.length<220&&EXTRA_WEAK.test(t))};
// Service lines at the very top, never a tagline.
const STATUS_LINE=/^(new chapter( up| added)?!?|new alt!?|update[sd]?!?|\d+ (scenarios?|messages?|intros?|chapters?)|this is not a bot|.*swipe (right|left).*)$/i;
// Once one of these appears, the rest of the text is the creator's footer.
const FOOTER=/(what i write|don.t write|♡ ?be respectful|be respectful to each other|interesting people,? you might like|tested for deepseek|i do not allow anyone to use my photos|author.?s note|sepha update|my telegram chan|i recommend using (deepseek|a proxy)|i recommend using deepseek)/i;

// Lines without letters or digits (⟡, ───) are decorative dividers and are skipped.
// Lines are the real paragraphs (stored text keeps one "\n" per HTML <p>); a blank line marks a bigger break.
// Decorative headings written in math letters are glued to the next text ("𝙰𝙱𝙾𝚄𝚃 𝚄𝚂𝙴𝚁BACKGROUND…"): split them first.
function units(text){
  const out=[];
  const raw=String(text||'').replace(/\r/g,'').replace(/([\u{1D400}-\u{1D7FF}](?:[\u{1D400}-\u{1D7FF}\s'’:]*[\u{1D400}-\u{1D7FF}])?)(?=[^\u{1D400}-\u{1D7FF}\s'’:])/gu,'$1\n');
  for(const par of raw.split(/\n{2,}/)){let first=true;for(const line of par.split('\n')){const t=fold(line).replace(/[ \t]+/g,' ').trim();if(!/[\p{L}\p{N}]/u.test(t))continue;out.push({text:t,newPar:first});first=false}}
  return out;
}
function isHeadingLine(line){
  const k=key(line),l=letters(line);
  if(!k||k.length>48||l.length<3)return false;
  if(EXTRA_HEADING.test(k)||INTRO_HEADING.test(k))return true;
  if(/^(about|who is|who are)\b/.test(k)&&k.split(' ').length<=4)return true;
  const upper=l.filter(c=>c!==c.toLowerCase()).length/l.length;
  const words=k.split(' ').length;
  if(upper>=0.85&&words<=6&&!/[.!?,]$/.test(fold(line).trim()))return true; // THE ALARIAN ACCORD, SCENARIO
  if(/:\s*$/.test(fold(line))&&words<=4)return true;                       // About {{user}}:
  return false;
}
function kindOfHeading(line){
  const k=key(line);
  if(INTRO_HEADING.test(k))return'intros';
  if(EXTRA_HEADING.test(k))return'extra';
  return'about';
}
const cleanTitle=line=>fold(line).replace(/^[^\p{L}\p{N}{]+|[^\p{L}\p{N})}]+$/gu,'').replace(/\s+/g,' ').trim();

// "CHAPTER 1: A GLIMPSE OF YOU before you are formally introduced…" → {index:0,title:'A GLIMPSE OF YOU',text:'before you…'}
function introItem(par){
  const m=fold(par).replace(/\n/g,' ').trim().match(INTRO_ITEM);if(!m)return null;
  const n=WORDS[m[1].toLowerCase()]||Number(m[1]);if(!n||n>20)return null;
  let rest=m[2].trim(),title='';
  const colon=rest.match(/^([^:.!?]{2,60}):\s*(.+)$/);                       // "First meeting: He notices…"
  const caps=rest.match(/^((?:[\p{Lu}\d'’&-]+\s+){0,7}[\p{Lu}\d'’&-]{2,})\s+(.+)$/u); // "A GLIMPSE OF YOU before you…"
  if(colon){title=colon[1].trim();rest=colon[2].trim()}else if(caps&&/\p{Ll}/u.test(caps[2][0]||'')){title=caps[1].trim();rest=caps[2].trim()}
  return{index:n-1,title,text:rest};
}

export function describeSections(description,{introCount=0}={}){
  const list=units(description);
  const out={hook:'',about:[],intros:[],extra:[]};
  if(!list.length)return out;
  // Hook: the first story line. Leading banners ("⸸ NAME: SUBTITLE ⸸", "2 SCENARIOS") and status lines
  // ("new chapter up!") are skipped; a short hook borrows the next line ("God blessed you for me" + "Rome, Vatican City…").
  let start=0;const skipped=[];
  const banner=t=>{const plain=fold(t).replace(/\{\{\w+\}\}/g,''),l=letters(plain),upper=l.length?l.filter(c=>c!==c.toLowerCase()).length/l.length:0;return STATUS_LINE.test(t)||(t.length<=90&&upper>=0.8&&!/\p{Ll}{3}/u.test(plain))};
  while(start<list.length-1&&banner(list[start].text)){skipped.push(list[start].text);start++}
  out.hook=list[start].text.replace(/^(update|new|season \d+|s\d+)\s*:\s*/i,'');start++;
  const next=list[start];
  if(next&&out.hook.length<140&&!isHeadingLine(next.text)&&!EXTRA_LINE.test(next.text)&&!STATUS_LINE.test(next.text)&&out.hook.length+next.text.length<=280&&!/^[\p{Lu}\s]{3,}\(\d+\)/u.test(next.text)&&!introItem(next.text)){out.hook+=`\n${next.text}`;start++}
  if(skipped.length)out.extra.push({title:'',text:skipped.join('\n')});
  // A whole description written as one block: keep its first sentences, the rest is the description.
  if(out.hook.length>420){
    const sentences=out.hook.replace(/\n/g,' ').match(/[^.!?]+[.!?]+["”»']?\s*/g)||[out.hook];
    let hook='';for(const s of sentences){if((hook+s).length>260&&hook)break;hook+=s}
    const rest=out.hook.replace(/\n/g,' ').slice(hook.length).trim();out.hook=hook.trim();
    if(rest)list.splice(start,0,{text:rest,newPar:true});
  }
  let section={kind:'about',title:'',parts:[]},footer=false,lastExtra=null,prev='';
  const add=(target,unit)=>{if(!unit.newPar&&target.parts.length)target.parts[target.parts.length-1]+=`\n${unit.text}`;else target.parts.push(unit.text)};
  const flush=()=>{if(!section.parts.length)return;const item={title:section.title,text:section.parts.join('\n\n')};(section.kind==='about'?out.about:out.extra).push(item)};
  const open=(kind,title)=>{flush();section={kind,title,parts:[]};lastExtra=null};
  const toExtra=unit=>{if(!lastExtra){lastExtra={title:'',parts:[]};out.extra.push(lastExtra)}add(lastExtra,unit)};
  for(let i=start;i<list.length;i++){
    const unit=list[i],text=unit.text,after=prev;prev='';
    if(!footer&&FOOTER.test(text)){footer=true;open('extra','')}
    if(footer){add(section,unit);continue}
    const item=introItem(text);
    // "1: Welcome to…" lines count as intro notes only for bots with several intros, numbered in order.
    const numbered=item&&introCount>1&&/^\d{1,2}\s*[:.)]/.test(text)&&item.text.length>=20&&(item.index===0||out.intros[item.index-1]);
    // The first note found for an intro wins: a later numbered list ("1. You've never…") is plain text.
    const chapterLike=item&&!out.intros[item.index]&&(/^(chapter|scenario|message|intro|greeting)\b/i.test(text)||section.kind==='intros'||numbered);
    if(chapterLike&&(!introCount||item.index<introCount)){
      // "CHAPTER 1: TITLE" alone on its line: the next line is its description.
      if(!item.text&&list[i+1]&&!introItem(list[i+1].text)&&!isHeadingLine(list[i+1].text)){item.text=list[i+1].text;i++}
      if(!item.title&&item.text.length<=60&&list[i+1]&&!introItem(list[i+1].text)&&!isHeadingLine(list[i+1].text)&&(!list[i+1].newPar||!/\p{Ll}/u.test(item.text))){item.title=item.text;item.text=list[i+1].text;i++}
      out.intros[item.index]={title:item.title,text:item.text};
      if(section.kind!=='intros')open('intros','');
      prev='intro';continue;
    }
    if(isHeadingLine(text)){
      const kind=kindOfHeading(text);
      // A second heading right after an empty one refines it ("CONTENT WARNINGS" + "This bot contains:").
      if(after==='heading'&&section.title&&section.kind!=='about'){prev='heading';section.title+=` · ${cleanTitle(text)}`;continue}
      open(kind,cleanTitle(text));prev='heading';continue;
    }
    // Short lines right under an off-topic line belong to it (a playlist under "music i listened to").
    if(after==='extra'&&!unit.newPar&&text.length<80){toExtra(unit);prev='extra';continue}
    if(section.kind==='intros'&&EXTRA_LINE.test(text)){toExtra(unit);prev='extra';continue}
    if(section.kind==='intros'){
      // Text under a chapter item continues its description.
      const last=out.intros.length-1;
      if(after==='intro'&&last>=0&&out.intros[last]&&!unit.newPar){prev='intro';out.intros[last].text+=`\n${text}`;continue}
      open('about','');
    }
    if(section.kind==='about'&&EXTRA_LINE.test(text)){toExtra(unit);prev='extra';continue}
    lastExtra=null;add(section,unit);
  }
  flush();
  out.extra=out.extra.map(x=>x.parts?{title:x.title,text:x.parts.join('\n\n')}:x).filter(x=>x.text);
  out.intros=Array.from({length:out.intros.length},(_,i)=>out.intros[i]||null);
  return out;
}