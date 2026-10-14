import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// A small DOM adapter exercises the shipped client module without a browser
// dependency. It checks application state and requests, not visual layout.
class Node {
  constructor(tag = 'div') {
    this.tag = tag; this.children = []; this.dataset = {}; this.hidden = false;
    this.disabled = false; this.className = ''; this._text = ''; this._value = '';
    this.classList = { toggle: (name, active) => {
      const classes = new Set(this.className.split(' ').filter(Boolean));
      active ? classes.add(name) : classes.delete(name);
      this.className = [...classes].join(' ');
    } };
  }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  set value(value) { this._value = value; }
  get value() { return this.tag === 'select' ? this._value || this.children[0]?.value || '' : this._value; }
  set selectedIndex(index) { this._value = this.children[index]?.value || ''; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; this._text = ''; this._value = ''; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const found = [];
    for (const child of this.children) {
      if (selector.startsWith('.') ? child.className.split(' ').includes(selector.slice(1)) : child.tag === selector) found.push(child);
      found.push(...child.querySelectorAll(selector));
    }
    return found;
  }
  focus() {}
  click() { return this.onclick?.(); }
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('workbench client: grounded evidence, comparison fairness, history, errors, cancellation, export', async t => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const nodes = new Map([...html.matchAll(/<([a-z]+)[^>]*\bid="([^"]+)"/g)].map(([,tag,id]) => [id,new Node(tag)]));
  const nav = ['grounded','compare','chat'].map(mode => { const n = new Node('button'); n.dataset.mode = mode; return n; });
  const document = {
    getElementById: id => { assert.ok(nodes.has(id), `Client references missing element ${id}`); return nodes.get(id); },
    createElement: tag => new Node(tag), createTextNode: text => { const n = new Node('#text'); n.textContent = text; return n; },
    querySelectorAll: selector => { assert.equal(selector,'[data-mode]'); return nav; }
  };
  const $ = id => document.getElementById(id);
  $('temperature').value = '0.2';
  const originals = { document:globalThis.document, fetch:globalThis.fetch };
  globalThis.document = document;
  t.after(() => { globalThis.document = originals.document; globalThis.fetch = originals.fetch; });
  const requests = []; let active = 0, maxActive = 0, responseMode = 'normal';
  globalThis.fetch = async (url, options = {}) => {
    if (url === '/api/tags') return Response.json({ models:[{name:'model-a'},{name:'model-b'}] });
    assert.equal(url,'/api/chat');
    requests.push(JSON.parse(options.body)); active++; maxActive = Math.max(maxActive,active);
    if (responseMode === 'error') { active--; return Response.json({error:'Model unavailable'},{status:500}); }
    if (responseMode === 'wait') return new Promise((resolve,reject) => options.signal.addEventListener('abort',() => { active--; reject(new DOMException('Aborted','AbortError')); },{once:true}));
    const records = [{message:{content:'Maya, Rafael, and Bea [S1]. <script>unsafe()</script>'}},{done:true,eval_count:20,eval_duration:2e9,total_duration:3e9}];
    const bytes = new TextEncoder().encode(records.map(r => JSON.stringify(r)).join('\n'));
    return new Response(new ReadableStream({start(controller) {
      // Split records deliberately, including the final record without a newline.
      controller.enqueue(bytes.slice(0,17)); controller.enqueue(bytes.slice(17)); controller.close(); active--;
    }}));
  };
  await import(`../src/app.js?client-test=${Date.now()}`); await tick();
  assert.equal($('send').disabled,false); assert.equal($('model-b').value,'model-b');
  const submit = async prompt => { $('prompt').value = prompt; await $('composer').onsubmit({preventDefault(){}}); };

  await submit('launch blockers');
  assert.equal(requests.length,0,'Document mode requires sources');
  $('messages').querySelector('.primary').click();
  assert.equal($('source-count').textContent,'1');
  await submit('zebracorn'); assert.equal(requests.length,0,'No matches must abstain before inference');
  await submit('launch blockers'); assert.equal(requests.length,1);
  const firstAnswer = $('messages').querySelector('.assistant');
  assert.ok(firstAnswer.querySelector('.answer-evidence').textContent.includes('Northstar'));
  assert.ok(firstAnswer.querySelector('.body').textContent.includes('<script>'),'Output is literal text');
  assert.equal($('speed').textContent,'10.00');
  await submit('budget');
  assert.equal(requests[1].messages.length,2,'Document questions do not reuse stale citation context');
  assert.ok(firstAnswer.querySelector('.answer-evidence').textContent.includes('Launch blockers'),'Earlier evidence survives new retrieval');

  nav[1].click(); assert.equal($('second-model-wrap').hidden,false);
  $('model-b').value = 'model-a'; await submit('launch blockers'); assert.equal(requests.length,2,'Same model is rejected');
  $('model-b').value = 'model-b'; await submit('launch blockers');
  assert.equal(requests.length,4); assert.deepEqual(requests[2].messages,requests[3].messages);
  assert.deepEqual(requests[2].options,requests[3].options); assert.equal(maxActive,1,'Arena is sequential');
  assert.equal($('messages').querySelector('.arena-grid').querySelectorAll('.assistant').length,2);

  nav[2].click(); await submit('Hello'); await submit('Follow up');
  assert.equal(requests.at(-1).messages.length,4,'Chat retains complete conversation turns');
  assert.ok(!requests.at(-1).messages[0].content.includes('SOURCE EXCERPTS'),'Open chat excludes documents');
  $('model').value = 'model-b'; $('model').onchange(); await submit('Fresh model');
  assert.equal(requests.at(-1).messages.length,2,'Model change clears history');
  responseMode = 'error'; await submit('Failed turn');
  assert.ok($('messages').textContent.includes('Model unavailable')); assert.equal($('send').disabled,false);
  responseMode = 'normal'; await submit('After failure');
  assert.ok(!requests.at(-1).messages.some(m => m.content === 'Failed turn'),'Failed turns are not retained');

  responseMode = 'wait'; $('prompt').value = 'Stop this';
  const pending = $('composer').onsubmit({preventDefault(){}}); await tick();
  assert.equal($('stop').hidden,false); assert.equal($('refresh').disabled,true);
  $('stop').click(); await pending;
  assert.equal($('stop').hidden,true); assert.equal($('send').disabled,false);
  assert.ok($('messages').textContent.includes('Stopped by you'));

  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  let report;
  URL.createObjectURL = blob => { report = blob; return 'blob:test'; }; URL.revokeObjectURL = () => {};
  t.after(() => { URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; });
  $('export').click(); const exported = JSON.parse(await report.text());
  assert.ok(exported.runs.some(r => r.status === 'stopped'));
  assert.ok(exported.runs.some(r => r.status === 'error'));
  $('clear').click(); assert.ok($('messages').querySelector('.empty-state'));
  assert.equal($('speed').textContent,'—');
});
