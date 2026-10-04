import assert from 'node:assert/strict';
import { toWorldInfo } from '../src/lorebook-format.js';

// Same acceptance rule LoreKey (public/lorekey.js) applies to an uploaded file.
const bookOf=json=>json?.entries?json:json?.data?.character_book?.entries?json.data.character_book:json?.character_book?.entries?json.character_book:null;
const loreKeyAccepts=book=>{const e=bookOf(book)?.entries;return Array.isArray(e)?e.length>0:e&&typeof e==='object'?Object.keys(e).length>0:false};
const isWorld=book=>book&&typeof book.entries==='object'&&!Array.isArray(book.entries)&&Object.values(book.entries).every(e=>Array.isArray(e.key)&&Array.isArray(e.keysecondary)&&typeof e.content==='string'&&Number.isInteger(e.uid));

// World Info already: served untouched.
const world={name:'W',entries:{'0':{uid:0,key:['castle'],keysecondary:[],comment:'Castle',content:'Old castle.',custom:'kept'}}};
let out=toWorldInfo(JSON.stringify(world));
assert.ok(out.ok);assert.deepEqual(out.book,world);

// Card character_book (V2/V3): entries[] with keys / secondary_keys / enabled / extensions.
const book={name:'Kingdom',entries:[{id:1,keys:['king','crown'],secondary_keys:['throne'],content:'The king rules.',enabled:true,insertion_order:50,name:'King',constant:false,selective:true,position:'after_char',extensions:{depth:2,probability:80}},{keys:'sword, blade',content:'A sword.',enabled:false}]};
out=toWorldInfo(JSON.stringify({spec:'chara_card_v2',data:{character_book:book}}));
assert.ok(out.ok&&isWorld(out.book)&&loreKeyAccepts(out.book));
assert.equal(out.book.name,'Kingdom');
assert.deepEqual(out.book.entries['0'].key,['king','crown']);
assert.deepEqual(out.book.entries['0'].keysecondary,['throne']);
assert.equal(out.book.entries['0'].comment,'King');
assert.equal(out.book.entries['0'].order,50);
assert.equal(out.book.entries['0'].position,1);
assert.equal(out.book.entries['0'].depth,2);
assert.equal(out.book.entries['0'].probability,80);
assert.equal(out.book.entries['0'].disable,false);
assert.deepEqual(out.book.entries['1'].key,['sword','blade']);
assert.equal(out.book.entries['1'].disable,true);
out=toWorldInfo(JSON.stringify(book));
assert.ok(out.ok&&isWorld(out.book));

// Bare entries array, JSON-encoded twice, title taken from the lorebook row.
out=toWorldInfo(JSON.stringify(JSON.stringify([{keywords:['elf'],text:'Elves live long.',title:'Elves'}])),'Races');
assert.ok(out.ok&&isWorld(out.book)&&loreKeyAccepts(out.book));
assert.equal(out.book.name,'Races');
assert.deepEqual(out.book.entries['0'].key,['elf']);
assert.equal(out.book.entries['0'].content,'Elves live long.');
assert.equal(out.book.entries['0'].comment,'Elves');

// Nothing lorebook-like: the decoded source is passed through for the caller.
out=toWorldInfo('{"foo":1}');
assert.equal(out.ok,false);assert.deepEqual(out.value,{foo:1});
assert.equal(toWorldInfo('not json').value,'not json');

// The site picker saves every lorebook as its own .json — no zip.
import fs from 'node:fs';
const picker=fs.readFileSync(new URL('../public/lorebook-picker.js',import.meta.url),'utf8');
assert.ok(!/makeZip|application\/zip|\.zip\b/.test(picker),'lorebook picker must not zip lorebooks');

console.log('Lorebook downloads OK · World Info format (as DataCat) from World Info / character_book / bare arrays, LoreKey accepts them, one .json per lorebook');
