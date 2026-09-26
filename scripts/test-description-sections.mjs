import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describeSections } from '../src/description-sections.js';
import sourceTruth from '../src/source-truth.js';

// Creator descriptions are split into tagline / main description / intro notes / creator extras.
const text=[
  'you are the new queen. stolen as a child, raised for the throne.',
  '',
  'SERIES: TEST SERIES BY Someone : a sci-fi series',
  'website here',
  '',
  'THE KINGDOM',
  '',
  'Kael is the incoming king. He was chosen at seven and trained for the crown.',
  'Publicly composed, privately volatile.',
  '',
  '𝙰𝙱𝙾𝚄𝚃 𝚄𝚂𝙴𝚁You were taken from your home world and raised by the Coven.',
  '',
  'CHAPTERS',
  '',
  'CHAPTER 1: A FIRST GLIMPSE',
  'before you are introduced, he talks to you',
  'CHAPTER 2: THE MEETING',
  'the formal unveiling',
  '',
  'tw: you were taken as a child.',
  'I RECOMMEND USING DEEPSEEK WITH MY BOTS',
  '!!WHAT I WRITE / DON\'T WRITE + BLOCKING!!',
  'i block liberally.'
].join('\n');
const s=describeSections(text,{introCount:2});
assert.equal(s.hook,'you are the new queen. stolen as a child, raised for the throne.','hook is the first story line');
assert.deepEqual(s.about.map(x=>x.title),['THE KINGDOM','ABOUT USER'],'story sections keep their headings, decorative math letters are read as text');
assert.match(s.about[0].text,/Kael is the incoming king[\s\S]*privately volatile/);
assert.match(s.about[1].text,/^You were taken/,'a heading glued to its text is split off');
assert.deepEqual(s.intros.map(x=>x&&x.title),['A FIRST GLIMPSE','THE MEETING'],'chapters become intro titles, matched by number');
assert.equal(s.intros[0].text,'before you are introduced, he talks to you');
const extra=s.extra.map(x=>x.text).join('\n');
for(const line of ['SERIES: TEST SERIES','website here','tw: you were taken','DEEPSEEK','i block liberally'])assert.ok(extra.includes(line),`"${line}" goes to creator notes`);
assert.ok(!s.about.some(x=>/DEEPSEEK|block|website/i.test(x.text)),'creator notes never leak into the main description');

// Service banners at the top are never the tagline; a short tagline borrows the next line.
const banner=describeSections('⸸ KAEL VANE: THE HEIR ⸸\n"Control is everything."\nHe smiles for the cameras and breaks behind closed doors.\nMore about him here.',{introCount:1});
assert.equal(banner.hook,'"Control is everything."\nHe smiles for the cameras and breaks behind closed doors.');
assert.ok(banner.extra.some(x=>x.text.includes('KAEL VANE')));
// Story text using "appreciate"/"thank you" is not mistaken for a creator note.
const story=describeSections('Hook line.\nSecond tagline line.\nWhat irritates him is how Riven never appreciates you, and he never says thank you for anything you do for him, not once in all these years together. He watches it happen at every party, every dinner, every anniversary, and says nothing because it is not his place.',{introCount:1});
assert.equal(story.about.length,1);
// An earlier numbered intro list is not overwritten by a later numbered fact list.
const lists=describeSections('Hook.\nNow you are their roommate.\n1: Welcome to the apartment, they help you move in.\n2: You come home late and they wait at the door.\nWhat you need to know:\n1. You have never done this before, not once.',{introCount:2});
assert.match(lists.intros[0].text,/^Welcome to the apartment/);

// The public API serves the split: short = tagline, detail = sections.
const db=new DatabaseSync(':memory:');
for(const f of fs.readdirSync('migrations').sort())db.exec(fs.readFileSync(`migrations/${f}`,'utf8'));
const stmt=(sql,args=[])=>({bind:(...a)=>stmt(sql,a),async first(){return db.prepare(sql).get(...args)??null},async all(){return{results:db.prepare(sql).all(...args)}},async run(){db.prepare(sql).run(...args);return{meta:{}}}});
const env={DB:{prepare:sql=>stmt(sql),async batch(list){for(const s of list)await s.run();return[]}}},ctx={waitUntil(){}};
const UUID='12345678-1234-1234-1234-123456789abc';
db.prepare("INSERT INTO characters (janitor_uuid,slug,name,author,status,short_description,description,intros) VALUES (?,?,?,?,?,?,?,?)").run(UUID,'queen','Queen','A','published',text.slice(0,300),text,JSON.stringify(['intro one','intro two']));
const detail=await (await sourceTruth.fetch(new Request(`https://x.test/api/characters/${UUID}`),env,ctx)).json();
assert.equal(detail.character.short,s.hook,'detail short is the tagline');
assert.deepEqual(detail.character.sections.about.map(x=>x.title),['THE KINGDOM','ABOUT USER']);
assert.equal(detail.character.sections.introNotes[1].title,'THE MEETING');
assert.ok(detail.character.full.includes('WHAT I WRITE'),'the original text is still served in full');

// Admin-written tagline / description win over the automatic split, survive re-import, and "" goes back to automatic.
const { updateAdminCharacter } = await import('../src/character-admin.js');
const { manualSections, sectionsToText } = await import('../src/description-sections.js');
assert.deepEqual(manualSections(sectionsToText(s.about)),s.about,'the editor round-trips the automatic description');
const row=()=>db.prepare('SELECT * FROM characters WHERE janitor_uuid=?').get(UUID);
const patch=body=>updateAdminCharacter(new Request(`https://x.test/api/admin/characters/${UUID}`,{method:'PATCH',body:JSON.stringify({name:'Queen',author:'A',tags:[],hashtags:[],universes:[],setting_ids:[],pov:'AnyPOV',status:'published',description:row().description,...body})}),env,UUID);
assert.equal((await patch({public_hook:'Admin tagline.',public_about:'Intro by admin.\n\n## WHO SHE IS\nThe new queen.'})).status,200);
let d2=(await (await sourceTruth.fetch(new Request(`https://x.test/api/characters/${UUID}`),env,ctx)).json()).character;
assert.equal(d2.short,'Admin tagline.');
assert.deepEqual(d2.sections.about,[{title:'',text:'Intro by admin.'},{title:'WHO SHE IS',text:'The new queen.'}]);
assert.equal(d2.sections.introNotes[1].title,'THE MEETING','intro notes stay automatic');
const catalogRow=(await (await sourceTruth.fetch(new Request('https://x.test/api/catalog?limit=10'),env,ctx)).json()).characters.find(c=>c.janitorUuid===UUID);
assert.equal(catalogRow.short,'Admin tagline.','the list card shows the admin tagline');
assert.equal((await patch({public_hook:undefined,public_about:undefined})).status,200);
assert.equal(row().public_hook,'Admin tagline.','fields omitted from a save are kept');
const workerSrc=fs.readFileSync('src/worker.js','utf8'),upsert=workerSrc.slice(workerSrc.indexOf('async function saveCharacter('),workerSrc.indexOf('\n',workerSrc.indexOf('async function saveCharacter(')));
assert.ok(upsert.includes('ON CONFLICT')&&!upsert.includes('public_hook')&&!upsert.includes('public_about'),'re-import never writes the admin text');
assert.equal((await patch({public_hook:'',public_about:''})).status,200);
d2=(await (await sourceTruth.fetch(new Request(`https://x.test/api/characters/${UUID}`),env,ctx)).json()).character;
assert.equal(d2.short,s.hook,'empty admin text = automatic again');
assert.deepEqual(d2.sections.about.map(x=>x.title),['THE KINGDOM','ABOUT USER']);

console.log('ARCHIVE.EXE description sections OK · tagline + main description + intro titles + creator notes, served by the detail API; admin tagline/description override, kept on re-import');
