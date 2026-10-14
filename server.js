import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
const root = path.dirname(fileURLToPath(import.meta.url));
const assets = new Map([['/', ['index.html','text/html']], ['/index.html',['index.html','text/html']], ['/styles.css',['styles.css','text/css']], ...['app','core','config'].map(n => [`/src/${n}.js`, [`src/${n}.js`,'text/javascript']])]);
export function createServer({ ollama = 'http://127.0.0.1:11434' } = {}) {
  return http.createServer(async (req,res) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    const host = req.headers.host || '';
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) { res.writeHead(403); res.end('Local access only'); return; }
    if (req.headers.origin && ![`http://${host}`].includes(req.headers.origin)) { res.writeHead(403); res.end('Origin rejected'); return; }
    const pathname = new URL(req.url,'http://localhost').pathname;
    try {
      if (pathname === '/api/tags' || pathname === '/api/chat') {
        if (req.method !== (pathname === '/api/chat' ? 'POST' : 'GET')) { res.writeHead(405); res.end(); return; }
        const abort = new AbortController(); res.on('close', () => { if (!res.writableEnded) abort.abort(); });
        let body;
        if (req.method === 'POST') {
          let size = 0; const chunks = [];
          for await (const chunk of req) { size += chunk.length; if (size > 262144) { res.writeHead(413); res.end(JSON.stringify({error:'Prompt too large'})); return; } chunks.push(chunk); }
          const input = JSON.parse(Buffer.concat(chunks).toString());
          if (!input || typeof input.model !== 'string' || !input.model.trim() || !Array.isArray(input.messages) || !input.messages.length || input.messages.length > 20 || input.messages.some(m => !m || !['system','user','assistant'].includes(m.role) || typeof m.content !== 'string')) { res.writeHead(400); res.end(JSON.stringify({error:'Invalid chat request'})); return; }
          body = JSON.stringify({ model:input.model, messages:input.messages, stream:true, options:{ temperature:Math.min(1,Math.max(0,Number(input.options?.temperature) || 0)), num_predict:Math.min(2048,Math.max(1,Number(input.options?.num_predict) || 768)) } });
        }
        const response = await fetch(`${ollama}${pathname}`, { method:req.method, headers:{'Content-Type':'application/json'}, body, signal:AbortSignal.any([abort.signal,AbortSignal.timeout(pathname === '/api/tags' ? 4000 : 300000)]) });
        res.writeHead(response.status, {'Content-Type':response.headers.get('content-type') || 'application/json', 'Cache-Control':'no-store'});
        if (response.body) await pipeline(Readable.fromWeb(response.body), res); else res.end(); return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
      const asset = assets.get(pathname); if (!asset) { res.writeHead(404); res.end('Not found'); return; }
      const content = await readFile(path.join(root,asset[0])); res.writeHead(200, {'Content-Type':`${asset[1]}; charset=utf-8`, 'Cache-Control':'no-cache'}); res.end(req.method === 'HEAD' ? undefined : content);
    } catch(error) {
      if (res.headersSent) { res.destroy(); return; }
      res.writeHead(error instanceof SyntaxError ? 400 : 502, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:error instanceof SyntaxError ? 'Invalid JSON request' : 'Cannot reach local Ollama. Start Ollama and reconnect.'}));
    }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port,'127.0.0.1',() => console.log(`LlamaBot Local Lab → http://127.0.0.1:${port}`));
}
