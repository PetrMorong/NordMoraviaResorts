// Lokální server pro vývoj: statický web + Netlify funkce (/.netlify/functions/*) + proměnné z .env.
// Spuštění:  node scripts/dev.mjs   → http://localhost:8888/cerveny-dvur/rezervace.html
// Netlify formuláře se lokálně jen vypíšou do konzole, objednávky se ukládají do .data/objednavky.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const PORT = +process.env.PORT || 8888;

// .env → process.env (jednoduchý parser: KLIC=hodnota, víceřádkové hodnoty v uvozovkách)
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  const txt = fs.readFileSync(envFile, 'utf8');
  for (const m of txt.matchAll(/^[ \t]*([A-Z0-9_]+)[ \t]*=[ \t]*("(?:[^"\\]|\\.)*"|'[^']*'|[^\r\n]*)/gm)) { // [ \t] – prázdná hodnota nesmí sebrat další řádek
    let v = m[2].trim();
    if (/^["']/.test(v)) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}
process.chdir(ROOT);
// bez klíče Reservio ukáže wellness vymyšlené volné časy (nic se nezapisuje) – vypnout: RESERVIO_DEMO=0 v .env
if (!process.env.RESERVIO_TOKEN && !('RESERVIO_DEMO' in process.env)) process.env.RESERVIO_DEMO = '1';

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.yml': 'text/yaml' };
const body = req => new Promise(res => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => res(Buffer.concat(c))); });

async function fn(name, req, res) {
  const file = ['.mjs', '.js'].map(e => path.join(ROOT, 'netlify/functions', name + e)).find(f => fs.existsSync(f));
  if (!file) { res.writeHead(404).end('Funkce neexistuje'); return; }
  const mod = await import(pathToFileURL(file).href + '?v=' + fs.statSync(file).mtimeMs);
  const b = ['GET', 'HEAD'].includes(req.method) ? undefined : await body(req);
  const r = await mod.default(new Request(`http://localhost:${PORT}${req.url}`, { method: req.method, headers: req.headers, body: b }), {});
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  try {
    const m = u.pathname.match(/^\/\.netlify\/functions\/([\w-]+)/);
    if (m) return await fn(m[1], req, res);
    if (req.method === 'POST') { // Netlify Forms
      const f = Object.fromEntries(new URLSearchParams((await body(req)).toString()));
      console.log(`\n[formulář ${f['form-name']}]`, f);
      return res.writeHead(200).end('ok');
    }
    let p = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!p.startsWith(ROOT)) return res.writeHead(403).end();
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    if (!fs.existsSync(p) && fs.existsSync(p + '.html')) p += '.html';
    if (!fs.existsSync(p)) return res.writeHead(404).end('Nenalezeno');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  } catch (e) {
    console.error(e);
    res.writeHead(500).end(String(e));
  }
}).listen(PORT, () => {
  console.log(`Web: http://localhost:${PORT}/cerveny-dvur/rezervace.html`);
  console.log(`ČSOB: ${process.env.CSOB_MERCHANT_ID ? `${process.env.CSOB_MERCHANT_ID} (${process.env.CSOB_ENV || 'test'})` : 'není nastaveno – doplňte .env (viz .env.example)'} · Previo: ${process.env.PREVIO_LIVE === '1' ? (process.env.PREVIO_JEN_CIST === '1' ? 'živé ceny, rezervace se NEZAPISUJÍ' : 'živě – rezervace se zapisují!') : 'vypnuto (ceník z CMS)'} · Reservio: ${process.env.RESERVIO_TOKEN ? (process.env.RESERVIO_JEN_CIST === '1' ? 'živé časy, rezervace se NEZAPISUJÍ' : 'živě – rezervace se zapisují!') : process.env.RESERVIO_DEMO === '1' ? 'UKÁZKA (vymyšlené časy)' : 'vypnuto'}`);
});
