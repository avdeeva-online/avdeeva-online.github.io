import assert from 'node:assert/strict';
import { sourceUniverse } from '../src/source-truth.js';

assert.deepEqual(sourceUniverse({series:'The Firm'}),{value:'The Firm',field:'series',kind:'explicit_field'});
assert.deepEqual(sourceUniverse({description:'SERIES: no series\nThis is a standalone bot.'}),{value:'',field:'',kind:''});
assert.deepEqual(sourceUniverse({description:'SERIES: no series. This is a fan OC in the io SUCC universe.'}),{value:'SUCC',field:'description:known-universe',kind:'verified_creator_text'});
assert.deepEqual(sourceUniverse({description:'This is a fan OC in the io SUCC universe.'}),{value:'SUCC',field:'description:known-universe',kind:'verified_creator_text'});
assert.deepEqual(sourceUniverse({description:'Parameters:\nSUVA (Superhuman Vocational Academy) is the only university where heroes and villains study together.'}),{value:'SUVA University',field:'description:known-universe',kind:'verified_creator_text'});
assert.deepEqual(sourceUniverse({description:'A university student plans for succession.'}),{value:'',field:'',kind:''});

console.log('ARCHIVE.EXE source Universe behavior OK · explicit labels + verified description signals + false-positive guards checked');
