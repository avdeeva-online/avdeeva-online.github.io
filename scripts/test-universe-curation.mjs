import assert from 'node:assert/strict';
import { transformUniversePublicResponse } from '../src/universe-curation.js';

const rules=[
  {source_key:'collab',source_value:'Collab',public_universes:'[]',parent_universe:'',subuniverse:'',active:1,note:'test',updated_at:''},
  {source_key:'and plot',source_value:'AND PLOT',public_universes:'[]',parent_universe:'',subuniverse:'',active:1,note:'test',updated_at:''},
  {source_key:'birthday bot',source_value:'birthday bot',public_universes:'[]',parent_universe:'',subuniverse:'',active:1,note:'test',updated_at:''},
  {source_key:'212 kings',source_value:'212 kings',public_universes:'["212 KINGS"]',parent_universe:'',subuniverse:'',active:1,note:'test',updated_at:''},
  {source_key:'succ - a universe created by io on janitorai',source_value:'succ - a universe created by io on janitorai',public_universes:'["SUCC"]',parent_universe:'',subuniverse:'',active:1,note:'test',updated_at:''},
  {source_key:'suvauniversity',source_value:'SUVAUNIVERSITY',public_universes:'["SUVA University"]',parent_universe:'',subuniverse:'',active:1,note:'test',updated_at:''}
];
const env={DB:{prepare(){return{async first(){return{}},async all(){return{results:rules}}}}}};
const input={ok:true,characters:[
  {id:'curated',universe:'Collab',universes:['Collab','AND PLOT','birthday bot','212 kings'],universeSourceField:'description:SERIES'},
  {id:'succ',universe:'succ - a universe created by io on janitorai',universes:['succ - a universe created by io on janitorai'],universeSourceField:'description:SERIES'},
  {id:'suva',universe:'SUVAUNIVERSITY',universes:['SUVAUNIVERSITY'],universeSourceField:'description:SERIES'},
  {id:'ambiguous',universe:'byc next gen',universes:['Hale University','byc next gen'],universeSourceField:'description:SERIES'},
  {id:'manual',universe:'Collab',universes:['Collab'],universeSourceField:'admin:manual'}
]};
const response=await transformUniversePublicResponse(new Request('https://archive.test/api/catalog'),new Response(JSON.stringify(input),{headers:{'content-type':'application/json'}}),env);
const output=await response.json();
assert.deepEqual(output.characters[0].universes,['212 KINGS']);
assert.equal(output.characters[0].universe,'212 KINGS');
assert.deepEqual(output.characters[1].universes,['SUCC']);
assert.deepEqual(output.characters[2].universes,['SUVA University']);
assert.deepEqual(output.characters[3].universes,['Hale University','byc next gen'],'unverified labels must remain untouched');
assert.deepEqual(output.characters[4].universes,['Collab'],'manual override must remain untouched');
console.log('ARCHIVE.EXE universe curation behavior OK · suppressions + verified labels + ambiguous source + manual override checked');
