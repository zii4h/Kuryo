import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createServer } from '../server.js';
import { createFactPicker, validateFacts, TOPICS } from '../src/library.js';
const {facts} = JSON.parse(await readFile(new URL('../content/facts.json',import.meta.url),'utf8'));

test('published entries have unique IDs, source links, review evidence, and all advertised topics', () => {
  validateFacts(facts);
  assert.ok(facts.length >= 30);
  assert.deepEqual([...new Set(facts.map(f => f.topic))].sort(), [...TOPICS].sort());
  for (const fact of facts) assert.ok(fact.text.length < 500, `${fact.id} should remain concise`);
});
test('random requests cover the whole library before cycling, without immediate cycle repeat', () => {
  const picker = createFactPicker(facts,{random:()=>0}); const ids = new Set();
  let last;
  for (let i=0;i<facts.length;i++) { const result = picker.pick('Tell me something random and interesting'); assert.equal(result.repeated,false); ids.add(result.fact.id); last=result.fact.id; }
  assert.equal(ids.size,facts.length);
  const cycle = picker.pick(''); assert.equal(cycle.repeated,true); assert.notEqual(cycle.fact.id,last);
  for (let i=0;i<200;i++) assert.ok(picker.pick('').fact,'No credit or generation quota');
});
test('broad categories offer every entry in that category, including natural phrasing and aliases', () => {
  for (const topic of TOPICS) {
    const picker = createFactPicker(facts,{random:()=>0}); const expected = facts.filter(f=>f.topic===topic); const seen=new Set();
    for(let i=0;i<expected.length;i++) { const result=picker.pick(`Tell me interesting facts about ${topic}`); assert.equal(result.fact.topic,topic); seen.add(result.fact.id); }
    assert.equal(seen.size,expected.length);
  }
  assert.equal(createFactPicker(facts).pick('astronomy').fact.topic,'Space');
});
test('specific subjects remain relevant and unsupported topics are not invented', () => {
  const picker = createFactPicker(facts);
  for(let i=0;i<10;i++) assert.ok(picker.pick('Tell me about octopuses').fact.tags.includes('octopus'));
  assert.equal(picker.pick('quantum zebracorns').fact,null);
  assert.equal(picker.pick('<script>alert(1)</script>').fact,null);
  assert.equal(picker.pick('bananas').fact.id,'banana-berry');
});
test('unsafe sources and duplicate IDs are rejected before display', () => {
  assert.throws(()=>validateFacts([facts[0],facts[0]]),/unique/);
  assert.throws(()=>validateFacts([{...facts[0],source:{...facts[0].source,url:'javascript:alert(1)'}}]),/Unsafe/);
});
test('static preview serves the complete app and exposes no inference or authoring endpoints', async t => {
  const server = createServer(); server.listen(0,'127.0.0.1'); await once(server,'listening'); t.after(()=>server.close());
  const base=`http://127.0.0.1:${server.address().port}`;
  for (const asset of ['/','/styles.css','/src/app.js','/src/library.js','/content/facts.json']) {
    const response=await fetch(base+asset); assert.equal(response.status,200,asset); assert.ok((await response.text()).length);
  }
  for(const privatePath of ['/api/chat','/api/tags','/server.js','/scripts/draft-fact.js','/README.md']) assert.equal((await fetch(base+privatePath)).status,404);
  assert.equal((await fetch(base,{method:'POST'})).status,405);
  assert.equal(await (await fetch(base,{method:'HEAD'})).text(),'');
});
