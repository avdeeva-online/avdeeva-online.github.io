import assert from 'node:assert/strict';
import { inferKnownUniverseTitles } from '../src/discovery.js';
import { sourceUniverse } from '../src/source-truth.js';

assert.deepEqual(sourceUniverse({series:'The Firm'}),{value:'The Firm',field:'series',kind:'explicit_field'});
assert.deepEqual(sourceUniverse({description:'SERIES: no series\nThis is a standalone bot.'}),{value:'',field:'',kind:''});
assert.deepEqual(sourceUniverse({description:'SERIES: no series. This is a fan OC in the io SUCC universe.'}),{value:'SUCC',field:'description:known-universe',kind:'verified_creator_text'});
assert.deepEqual(sourceUniverse({description:'This is a fan OC in the io SUCC universe.'}),{value:'SUCC',field:'description:known-universe',kind:'verified_creator_text'});
assert.deepEqual(sourceUniverse({description:'Parameters:\nSUVA (Superhuman Vocational Academy) is the only university where heroes and villains study together.'}),{value:'SUVA University',field:'description:known-universe',kind:'verified_creator_text'});
assert.deepEqual(sourceUniverse({description:'A university student plans for succession.'}),{value:'',field:'',kind:''});
assert.deepEqual(sourceUniverse({name:'LARS ALT | VOODOO BOYS'}),{value:['Voodoo Boys'],field:'name:known-universe',kind:'verified_title'});
assert.deepEqual(sourceUniverse({name:'AVERY (WLW) | BAYOU CREW NEXT GEN / HALE U'}),{value:['Bayou Crew','Bayou Crew Next Gen','Hale University'],field:'name:known-universe',kind:'verified_title'});
assert.deepEqual(sourceUniverse({name:'MARCELO | VALENTINO / THE FIRM'}),{value:['The Firm','The Valentinos'],field:'name:known-universe',kind:'verified_title'});
assert.deepEqual(sourceUniverse({name:'ROMAN | SUCC',series:'The Vault'}),{value:'The Vault',field:'series',kind:'explicit_field'},'explicit source fields must win over title inference');
assert.deepEqual(inferKnownUniverseTitles('A university student plans for succession.'),[],'substrings such as succession must not become SUCC');
assert.deepEqual(inferKnownUniverseTitles('THE ARENA OF PUBLIC DEBATE'),[],'a known word without a title label separator is not sufficient evidence');

console.log('ARCHIVE.EXE source Universe behavior OK · explicit labels + verified description/title signals + parent expansion + false-positive guards checked');
