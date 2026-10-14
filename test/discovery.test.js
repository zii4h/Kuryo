import test from 'node:test';
import assert from 'node:assert/strict';
import {createDiscovery,normalizeTopic,articleText,extractDetails} from '../src/discovery.js';
test('topic lookup is live, cached, and source linked without categories',async()=>{
 const calls=[];
 const fetcher=async url=>{calls.push(url);return Response.json(url.searchParams.get('list')==='search'?{query:{search:[{pageid:42}]}}:{query:{pages:[{pageid:42,ns:0,title:'Chess',lastrevid:123,extract:'<p>The first modern chess tournaments appeared in the nineteenth century and helped spread the game internationally.</p><p>Chess is played on a board with sixty-four squares arranged in eight rows and eight columns.</p>'}]}});};
 const app=createDiscovery({fetcher,random:()=>0});
 const result=await app.discover('tell me something interesting about chess');
 assert.equal(result.fact.title,'Chess');assert.ok(result.fact.source.url.includes('oldid=123'));assert.equal(calls[0].searchParams.get('srsearch'),'chess');
 await app.discover('chess');assert.equal(calls.length,2);
});
test('formatting preserves source meaning and excludes flattened powers and incomplete sentences',()=>{
 assert.equal(normalizeTopic('Tell me a fact about coffee'),'coffee');
 const text=articleText('<p>Mass is 10<sup>6</sup> units.</p><p>Coffee &amp; tea have long histories in many countries around the world.</p>');
 assert.ok(!text.includes('106'));assert.ok(text.includes('Coffee & tea'));
 assert.equal(extractDetails('This is an incomplete sentence that trails away without actually being finished...').length,0);
});
test('missing topics abstain, and random discovery asks the source for random articles',async()=>{
 const urls=[];const app=createDiscovery({fetcher:async url=>{urls.push(url);return Response.json({query:{search:[],random:[{id:9}],pages:[{pageid:9,ns:0,title:'A new subject',extract:'<p>The first recorded example of this unusual phenomenon was described many years before it became widely understood.</p>'}]}});}});
 assert.equal((await app.discover('missing')).fact,null);
 assert.equal((await app.discover('')).fact.title,'A new subject');assert.ok(urls.some(url=>url.searchParams.get('list')==='random'));
});
