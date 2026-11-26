// Poslední krok nasazení na Netlify (po prerender.mjs).
//
// 1) Měření: když jsou na Netlify proměnné GOOGLE_TAG_ID (GTM-… nebo G-…/AW-…) a META_PIXEL_ID,
//    zapíšou se do data/nmr/nastaveni.json (mereni) – mají přednost před hodnotami v CMS.
//
// 2) Domény resortů – jen když je na Netlify DOMENY_RESORTU=1 (zapnout až budou domény přidané v Netlify):
//    - odkazy mezi weby v HTML: ../vila-republika/ → https://vila-republika.cz/, „Celá síť“ (/) → https://nordmoraviaresorts.cz/ …
//    - canonical, og:url, JSON-LD a sitemapy: https://nordmoraviaresorts.cz/cerveny-dvur/… → https://resortcervenydvur.cz/…
//    - robots.txt a sitemap.xml pro každou doménu resortu (Netlify je čte ze složky resortu)
//    - _redirects: stránky /cerveny-dvur/… a /vila-republika/… na nordmoraviaresorts.cz → 301 na doménu resortu
//    Bez proměnné (náhledy, lokálně) zůstává vše relativní a web funguje na jedné doméně jako dosud.
//
// Lokálně: DOMENY_RESORTU=1 node scripts/domeny.mjs  (přepisuje soubory! jen v kopii / na Netlify)
import {readFile, writeFile, readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NMR = 'nordmoraviaresorts.cz';
const DOMENY = {'cerveny-dvur': 'resortcervenydvur.cz', 'vila-republika': 'vila-republika.cz'};
const zapnuto = /^(1|true|ano|yes)$/i.test(process.env.DOMENY_RESORTU || '');

// ---------- 1) měření ----------
{
  const gt = (process.env.GOOGLE_TAG_ID || '').trim(), px = (process.env.META_PIXEL_ID || '').trim();
  if (gt || px) {
    const f = path.join(ROOT, 'data/nmr/nastaveni.json');
    const raw = await readFile(f, 'utf8');
    const N = JSON.parse(raw);
    N.mereni = N.mereni || {};
    if (gt) { if (/^GTM-/i.test(gt)) N.mereni.gtm_id = gt; else { N.mereni.google_tag_id = gt; N.mereni.gtm_id = ''; } }
    if (px) N.mereni.meta_pixel_id = px;
    await writeFile(f, JSON.stringify(N, null, 2));
    console.log(`Měření z proměnných: ${gt ? 'Google ' + gt : ''}${gt && px ? ', ' : ''}${px ? 'Meta Pixel ' + px : ''}`);
  }
}

if (!zapnuto) {
  console.log('Domény resortů: vypnuto (DOMENY_RESORTU není 1) – odkazy zůstávají relativní.');
  // Soft release: dokud resorty neběží na vlastních doménách, jsou jejich kopie na NMR pro Google „noindex“
  // (obsah je stejný jako na starých webech resortcervenydvur.cz a vila-republika.cz – nechceme duplicitu).
  // Jen při nasazení na Netlify, lokálně se nic nepřepisuje. Po DOMENY_RESORTU=1 se to samo zruší.
  if (process.env.NETLIFY === 'true') {
    const slozky = Object.keys(DOMENY);
    await writeFile(path.join(ROOT, '_headers'), slozky.map(k => `/${k}/*\n  X-Robots-Tag: noindex, follow\n/${k}\n  X-Robots-Tag: noindex, follow`).join('\n') + '\n');
    const smF = path.join(ROOT, 'sitemap.xml');
    if (existsSync(smF)) {
      const sm = await readFile(smF, 'utf8');
      const ven = new RegExp(`\\s*<url>\\s*<loc>https://(?:www\\.)?${NMR.replace('.', '\\.')}/(?:${slozky.join('|')})[/<][\\s\\S]*?</url>`, 'g');
      await writeFile(smF, sm.replace(ven, ''));
    }
    console.log('Soft release: /cerveny-dvur/ a /vila-republika/ mají noindex a nejsou v sitemapě.');
  }
  process.exit(0);
}

// ---------- 2) domény ----------
const strom = async (dir, out = []) => {
  for (const e of await readdir(dir, {withFileTypes: true})) {
    if (['node_modules', '.git', '.netlify', 'admin', 'netlify'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await strom(p, out); else out.push(p);
  }
  return out;
};
const soubory = await strom(ROOT);
const rel = f => path.relative(ROOT, f).split(path.sep).join('/');

// logická adresa (vše na NMR) → produkční adresa
const produkcni = u => {
  const m = u.pathname.match(/^\/(cerveny-dvur|vila-republika)(\/.*|$)/);
  return (m ? new URL((m[2] || '/') + u.search + u.hash, 'https://' + DOMENY[m[1]]) : new URL(u.pathname + u.search + u.hash, 'https://' + NMR)).href;
};
const absolutni = s => s.replace(/https:\/\/(?:www\.)?nordmoraviaresorts\.cz\/(cerveny-dvur|vila-republika)(?:\/|(?=["'<\s)]|$))/g, (_, k) => `https://${DOMENY[k]}/`);

let n = 0;
for (const f of soubory.filter(f => f.endsWith('.html'))) {
  const r = rel(f);
  const stranka = new URL('https://' + NMR + '/' + r);
  const vlastni = Object.keys(DOMENY).find(k => r.startsWith(k + '/'));
  let html = await readFile(f, 'utf8');
  const puvodni = html;
  // odkazy <a href> – jen ty, které vedou na jinou doménu sítě; na vlastní doméně zůstávají relativní
  html = html.replace(/(<a\b[^>]*?\shref=)(["'])([^"']*)\2/gi, (all, pre, q, href) => {
    if (!href || /^(#|mailto:|tel:|javascript:|data:)/i.test(href)) return all;
    let u; try { u = new URL(href, stranka); } catch (e) { return all; }
    if (u.hostname !== NMR) return all;
    const cil = new URL(produkcni(u));
    const doma = vlastni ? DOMENY[vlastni] : NMR;
    if (cil.hostname === doma && !/^\//.test(href) && !href.startsWith('http')) return all; // relativní odkaz ve stejném webu
    return pre + q + cil.href + q;
  });
  html = absolutni(html);
  if (!/name="nmr-domeny"/.test(html)) html = html.replace(/<head>/i, '<head>\n<meta name="nmr-domeny" content="1">');
  if (html !== puvodni) { await writeFile(f, html); n++; }
}
console.log(`Domény resortů: upraveno ${n} stránek`);

// sitemapy: hlavní pro NMR, vlastní pro každou doménu resortu
const smF = path.join(ROOT, 'sitemap.xml');
if (existsSync(smF)) {
  const sm = absolutni(await readFile(smF, 'utf8'));
  const urls = [...sm.matchAll(/<url>[\s\S]*?<\/url>/g)].map(m => m[0]);
  const obal = list => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${list.join('\n')}\n</urlset>\n`;
  const doma = u => (u.match(/<loc>https:\/\/([^/<]+)/) || [])[1];
  await writeFile(smF, obal(urls.filter(u => doma(u) === NMR)));
  for (const [k, d] of Object.entries(DOMENY)) {
    await writeFile(path.join(ROOT, k, 'sitemap.xml'), obal(urls.filter(u => doma(u) === d)));
    await writeFile(path.join(ROOT, k, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: https://${d}/sitemap.xml\n`);
  }
}

// _redirects (má přednost před netlify.toml): stránky resortů na NMR → 301 na jejich doménu
const radky = ['# vygenerováno scripts/domeny.mjs – stránky resortů z nordmoraviaresorts.cz na jejich domény'];
for (const [k, d] of Object.entries(DOMENY)) {
  radky.push(`https://${NMR}/${k}  https://${d}/  301!`, `https://${NMR}/${k}/  https://${d}/  301!`, `https://www.${NMR}/${k}/  https://${d}/  301!`);
  for (const f of soubory.filter(f => rel(f).startsWith(k + '/') && f.endsWith('.html'))) {
    const p = rel(f).slice(k.length);
    for (const h of [NMR, 'www.' + NMR]) radky.push(`https://${h}/${k}${p}  https://${d}${p === '/index.html' ? '/' : p}  301!`);
  }
}
await writeFile(path.join(ROOT, '_redirects'), radky.join('\n') + '\n');
console.log(`_redirects: ${radky.length - 1} pravidel`);
