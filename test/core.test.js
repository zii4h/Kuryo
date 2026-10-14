import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { consumeNDJSON, retrieve, metrics } from '../src/core.js';
import { SAMPLE } from '../src/config.js';
import { createServer } from '../server.js';
test('NDJSON preserves split JSON, unicode, and unterminated final records', async () => {
  const bytes = new TextEncoder().encode('{"message":{"content":"café 👋"}}\n{"done":true}');
  const records = []; const stream = new ReadableStream({start(c){for (const b of bytes) c.enqueue(Uint8Array.of(b)); c.close();}});
  await consumeNDJSON(stream,r => records.push(r)); assert.equal(records[0].message.content,'café 👋'); assert.equal(records[1].done,true);
});
test('malformed stream fails instead of silently discarding output', async () => {
  const stream = new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('broken\n'));c.close();}});
  await assert.rejects(consumeNDJSON(stream,()=>{}),SyntaxError);
});
test('retrieval finds source evidence and abstains on absent terms', () => {
  const sources = [{...SAMPLE,id:'sample'}]; const found = retrieve('launch blockers security',sources);
  assert.ok(found.length); assert.ok(found.some(s => s.text.includes('Rafael'))); assert.equal(found[0].citation,'S1'); assert.deepEqual(retrieve('zebracorn',sources),[]);
});
test('telemetry uses runtime nanoseconds and does not invent missing metrics', () => {
  assert.deepEqual(metrics({eval_count:20,eval_duration:2e9,total_duration:3e9},.5),{speed:10,tokens:20,duration:3,firstToken:.5}); assert.equal(metrics({},null).speed,null);
});
test('retrieval offsets preserve leading whitespace in original sources', () => {
  const text = '\n\n  launch budget is 200';
  const [passage] = retrieve('budget', [{id:'offset',name:'brief.txt',text}]);
  assert.equal(text.slice(passage.offset,passage.offset + passage.text.length),passage.text);
  assert.equal(passage.offset,0);
});
test('consumer failure cancels the underlying stream', async () => {
  let cancelled = false;
  const stream = new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{"error":"failure"}\n'));},cancel(){cancelled=true;}});
  await assert.rejects(consumeNDJSON(stream,() => {throw new Error('failure');}),/failure/);
  assert.equal(cancelled,true);
});
test('local proxy serves assets, restricts access, and streams Ollama records', async t => {
  const upstream = http.createServer((req,res) => { res.setHeader('Content-Type','application/json'); if(req.url === '/api/tags') res.end('{"models":[{"name":"test"}]}'); else {res.write('{"message":{"content":"ok"}}\n'); res.end('{"done":true}\n');} });
  upstream.listen(0,'127.0.0.1'); await once(upstream,'listening');
  const server = createServer({ollama:`http://127.0.0.1:${upstream.address().port}`}); server.listen(0,'127.0.0.1'); await once(server,'listening'); t.after(()=>{server.close();upstream.close();});
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base)).status,200); assert.equal((await fetch(`${base}/server.js`)).status,404);
  assert.equal((await fetch(`${base}/api/tags`,{headers:{Origin:'http://evil.example'}})).status,403);
  const rejectedHost = await new Promise(resolve => { http.get(base + '/api/tags', { headers: { Host: 'evil.example' } }, response => { response.resume(); resolve(response.statusCode); }); }); assert.equal(rejectedHost,403);
  assert.equal((await (await fetch(`${base}/api/tags`)).json()).models[0].name,'test');
  const result = await fetch(`${base}/api/chat`,{method:'POST',body:JSON.stringify({model:'test',messages:[{role:'user',content:'hello'}]})}); const records=[]; await consumeNDJSON(result.body,r=>records.push(r)); assert.equal(records[0].message.content,'ok'); assert.equal(records[1].done,true);
  assert.equal((await fetch(`${base}/api/chat`,{method:'POST',body:'broken'})).status,400);
  for (const body of [null, {model:'test',messages:[null]}, {model:'',messages:[]}]) {
    assert.equal((await fetch(`${base}/api/chat`,{method:'POST',body:JSON.stringify(body)})).status,400);
  }
});
