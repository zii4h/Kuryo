import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const data = JSON.parse(await readFile(new URL('../content/facts.json',import.meta.url),'utf8'));
const tick = () => new Promise(resolve => setImmediate(resolve));
class Element {
  constructor() { this.hidden=false; this.disabled=false; this.value=''; this.children=[]; this.textContent=''; }
  append(node) { this.children.push(node); }
  replaceChildren(...nodes) { this.children=nodes; }
}
test('minimal client: empty launch, topical and random facts, source links, suggestions, and retry', async t => {
  const html = await readFile(new URL('../index.html',import.meta.url),'utf8');
  const nodes=new Map([...html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)].map(([markup,id]) => {
    const node=new Element(); node.hidden=/\bhidden\b/.test(markup); return [id,node];
  }));
  const $ = id => { assert.ok(nodes.has(id),`Missing client element ${id}`); return nodes.get(id); };
  const originals={document:globalThis.document,fetch:globalThis.fetch};
  globalThis.document={getElementById:$,createElement:()=>new Element()};
  let requests=0, fail=true;
  globalThis.fetch=async url => {
    requests++; assert.ok(url.pathname.endsWith('/content/facts.json'),'Only the published library is requested');
    if(fail) throw new Error('Offline');
    return Response.json(data);
  };
  t.after(()=>{globalThis.document=originals.document;globalThis.fetch=originals.fetch;});
  await import(`../src/app.js?trivia-client=${Date.now()}`); await tick();
  assert.equal($('result').hidden,true); assert.equal($('status').hidden,true,'No extra initial content');
  $('curiosity-form').onsubmit({preventDefault(){}}); await tick();
  assert.ok($('status').textContent.includes('couldn’t load')); assert.equal($('discover').disabled,false);
  fail=false; $('topic').value='octopuses'; $('curiosity-form').onsubmit({preventDefault(){}}); await tick();
  assert.equal($('result').hidden,false);
  assert.ok($('source').href.startsWith('https://ocean.si.edu/'));
  assert.ok($('fact-text').textContent.length);
  assert.ok($('status').textContent.includes('No live AI generation'));
  const firstTitle=$('fact-title').textContent;
  $('another').onclick(); await tick(); assert.notEqual($('fact-title').textContent,firstTitle);
  $('topic').value='unicorn banking'; $('curiosity-form').onsubmit({preventDefault(){}}); await tick();
  assert.equal($('result-footer').hidden,true); assert.equal($('suggestions').hidden,false);
  assert.equal($('suggestions').children.length,7);
  $('suggestions').children[0].onclick(); await tick();
  assert.equal($('topic').value,'Space'); assert.ok($('result-label').textContent.includes('Space'));
  $('surprise').onclick(); await tick(); assert.equal($('topic').value,''); assert.equal($('result-footer').hidden,false);
  const before=requests;
  for(let i=0;i<40;i++) {$('another').onclick(); await tick();}
  assert.equal(requests,before,'Repeated requests need no API or model calls');
});
