import assert from 'node:assert/strict';
import { getHubEmbeddedMediaPublic, getHubResourcePublic, listHubResourcesSummaryPublic } from '../src/hub-public-media.js';

const id='resource-1',pixel=Buffer.from([82,73,70,70]),embedded=`data:image/webp;base64,${pixel.toString('base64')}`;
const row={id,type:'preset',title:'Embedded cover',creator_name:'Tester',creator_link:'',description_short:'Cover test',description_full:'',additional_info:'',models:'[]',settings:'[]',tags:'[]',media:JSON.stringify([{url:embedded,cover:true}]),source_url:'',updated_at:'2026-09-20'};
const db={prepare(sql){let args=[];return{bind(...values){args=values;return this},async first(){if(sql.includes('SELECT storage,r2_key'))return{storage:'r2',r2_key:'x'};if(sql.includes('SELECT media FROM hub_resources'))return args[0]===id?{media:row.media}:null;if(sql.includes('SELECT * FROM hub_resources'))return args[0]===id?row:null;return null},async all(){if(sql.includes('SELECT id,type,title'))return{results:[row]};return{results:[]}}}}};
const env={DB:db};

const summaryResponse=await listHubResourcesSummaryPublic(env),summary=await summaryResponse.json();
assert.equal(summaryResponse.status,200);
assert.equal(summary.resources[0].cover_url,`/api/hub-resources/${id}/media/0`);
assert.equal(JSON.stringify(summary).includes('data:image/'),false);

const detailResponse=await getHubResourcePublic(env,id),detail=await detailResponse.json();
assert.equal(detailResponse.status,200);
assert.equal(detail.resource.cover_url,`/api/hub-resources/${id}/media/0`);
assert.equal(JSON.stringify(detail).includes('data:image/'),false);

const mediaResponse=await getHubEmbeddedMediaPublic(env,id,0);
assert.equal(mediaResponse.status,200);
assert.equal(mediaResponse.headers.get('content-type'),'image/webp');
assert.deepEqual(Buffer.from(await mediaResponse.arrayBuffer()),pixel);

const missing=await getHubEmbeddedMediaPublic(env,id,1);
assert.equal(missing.status,404);
console.log('ARCHIVE.EXE HUB media behavior OK · embedded covers use short cacheable endpoints');
