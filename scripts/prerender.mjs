// Předgenerování obsahu do HTML při nasazení na Netlify.
// Stránky si obsah načítají z data/*.json skriptem až v prohlížeči. Vyhledávače s AI (ChatGPT, Perplexity, Claude)
// a náhledy na sociálních sítích skripty nespouští – viděly by prázdnou stránku. Tento skript stránku při buildu
// „spustí“ v jsdomu, nechá skripty vyplnit obsah z JSON a výsledné HTML uloží zpět. V prohlížeči pak skripty
// běží znovu nad stejnými daty (CMS dál funguje beze změny), návštěvník nic nepozná.
// Spouští se jen na Netlify (příkaz v netlify.toml), lokální soubory zůstávají beze změny.
import {JSDOM, ResourceLoader, VirtualConsole} from 'jsdom';
import {readFile, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://nordmoraviaresorts.cz';
const PAGES = [
  'index.html', 'o-nas.html', 'investori.html',
  'cerveny-dvur/index.html', 'cerveny-dvur/restaurace.html', 'cerveny-dvur/wellness.html', 'cerveny-dvur/balicky.html', 'cerveny-dvur/firmy.html', 'cerveny-dvur/akce.html',
  'vila-republika/index.html', 'vila-republika/wellness.html',
  'soutok-kouty/index.html',
];
// skripty, které nepřidávají obsah (měření, cookies, lepicí lišta) nebo potřebují externí služby
const SKIP = [/nmr-common\.js$/, /datepicker\.js$/, /booking\/booking\.js$/, /booking\.previo\.cz/, /googletagmanager/, /connect\.facebook/];

const toFile = url => {
  const u = new URL(url);
  if (u.origin !== ORIGIN) return null;
  let p = decodeURIComponent(u.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  return f.startsWith(ROOT) && existsSync(f) ? f : null;
};

class Loader extends ResourceLoader {
  fetch(url, opts) {
    if (opts.element?.localName !== 'script' || SKIP.some(r => r.test(url))) return null;
    const f = toFile(url);
    return f ? readFile(f) : null;
  }
}

async function render(page) {
  const file = path.join(ROOT, page);
  const src = await readFile(file, 'utf8');
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(e.message));
  let pending = 0;

  const dom = new JSDOM(src, {
    url: `${ORIGIN}/${page}`,
    runScripts: 'dangerously',
    resources: new Loader(),
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(w) {
      // fetch pro data/*.json čte rovnou ze souborů
      w.fetch = async (input) => {
        const f = toFile(new URL(String(input), w.location.href).href);
        pending++;
        try {
          if (!f) return {ok: false, status: 404, json: async () => { throw new Error('404 ' + input); }, text: async () => ''};
          const body = await readFile(f, 'utf8');
          return {ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body};
        } finally { setTimeout(() => pending--, 0); }
      };
      w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
      w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
      w.matchMedia = () => ({matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}});
      w.scrollTo = () => {};
      w.Element.prototype.scrollIntoView = () => {};
      if (w.HTMLDialogElement) { w.HTMLDialogElement.prototype.showModal = function () {}; w.HTMLDialogElement.prototype.close = function () {}; }
      w.localStorage.clear();
    },
  });

  await new Promise(r => dom.window.addEventListener('load', r));
  // počkat, až doběhnou všechny fetch + vykreslení
  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 40));
    if (pending === 0 && i > 5) break;
  }

  const doc = dom.window.document;
  doc.documentElement.setAttribute('data-prerendered', '');
  // bez JavaScriptu nechat obsah viditelný (animace .rv by ho jinak skryly)
  if (!doc.getElementById('pr-noscript')) doc.head.insertAdjacentHTML('beforeend', '<noscript id="pr-noscript"><style>.rv{opacity:1!important;transform:none!important}</style></noscript>');
  // stav po skriptu, který nemá zůstat v HTML (otevřené menu, posun animací)
  doc.querySelectorAll('.rv.in').forEach(el => el.classList.remove('in'));
  const html = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  dom.window.close();

  const txt = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').length;
  const filled = txt(html) - txt(src);
  if (errors.length) console.warn(`  ! ${page}: ${errors.slice(0, 3).join(' | ')}`);
  if (filled < 100) { console.warn(`  ! ${page}: skript nic nevykreslil, ponechávám původní HTML`); return false; }
  await writeFile(file, html);
  console.log(`  ✓ ${page} (+${filled} znaků obsahu)`);
  return true;
}

console.log('Předgenerování stránek:');
let ok = 0;
for (const p of PAGES) {
  try { if (await render(p)) ok++; }
  catch (e) { console.warn(`  ! ${p}: ${e.message} – ponechávám původní HTML`); }
}
console.log(`Hotovo: ${ok}/${PAGES.length}`);
