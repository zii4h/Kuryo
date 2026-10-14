import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
const assets = new Map([
  ['/', ['index.html','text/html']],
  ['/index.html', ['index.html','text/html']],
  ['/styles.css', ['styles.css','text/css']],
  ['/src/app.js', ['src/app.js','text/javascript']],
  ['/src/library.js', ['src/library.js','text/javascript']],
  ['/content/facts.json', ['content/facts.json','application/json']]
]);
export function createServer() {
  return http.createServer(async (request,response) => {
    response.setHeader('X-Content-Type-Options','nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405,{Allow:'GET, HEAD'}); response.end(); return; }
    const pathname = new URL(request.url,'http://localhost').pathname;
    const asset = assets.get(pathname);
    if (!asset) { response.writeHead(404); response.end('Not found'); return; }
    try {
      const body = await readFile(path.join(root,asset[0]));
      response.writeHead(200,{'Content-Type':`${asset[1]}; charset=utf-8`,'Cache-Control':'no-cache'});
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch { response.writeHead(500); response.end('Unable to load this file'); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port,'127.0.0.1',() => console.log(`Curiosity → http://127.0.0.1:${port}`));
}
