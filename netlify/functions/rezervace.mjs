// Nabídka volných apartmánů a cen pro rezervační komponentu (všechny resorty)
//
// GET /.netlify/functions/rezervace?resort=…&od=2027-01-15&do=2027-01-17&dospeli=2&deti=0[&balicek=<id balíčku>]
//     → { rezim: 'live'|'cenik', typy: [{ id, nazev, foto, osoby, plocha, popis, volno, sazby: [{ id, nazev, popis, cena, portal }] }] }
//     typy obsahují i kombinace dvou apartmánů pro větší skupiny (id 'combo:A+B', pokoje = rozdělení hostů)
//     obsazeno = typy, které v termínu nejsou volné (jen živě z Previo) – [{ nazev, foto, osoby, plocha }]
//     jine = křížový prodej – když v resortu nic není nebo zbývá málo (malo: true), nabídka ostatních resortů na stejný termín
//     live = ceny a volné apartmány z Previo (PREVIO_LIVE resortu), cenik = z ceníku v CMS (dostupnost potvrdí recepce)
//
// Rezervace s platbou jde přes /.netlify/functions/platba. Cenu počítá vždy server (netlify/lib/cena.mjs).
import { resort, Chyba, vsechnyResorty } from '../lib/resorty.mjs';
import { nabidkaTerminu, jineResorty, cenyDoplnku } from '../lib/cena.mjs';

const MALO_VOLNA = +(process.env.MALO_VOLNA || 2); // kolik volných apartmánů a méně = ukázat i ostatní resorty
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export default async (req) => {
  if (req.method !== 'GET') return json({ chyba: 'Metoda není podporovaná' }, 405);
  const u = new URL(req.url).searchParams;
  try {
    const r = resort(u.get('resort'));
    const d = { od: u.get('od'), do: u.get('do'), dospeli: u.get('dospeli'), deti: u.get('deti'), balicek: u.get('balicek') || undefined };
    const { live, typy, t } = await nabidkaTerminu(r, d);
    const volne = typy.filter(x => !x.kombinace);
    // obsazené typy (jen živě z Previo) – formulář je ukáže zkráceně „Obsazeno“, ať host vidí, že je plno, ne že apartmán neexistuje.
    // Jen typy, do kterých se skupina vejde (max_osob z ceníku).
    const osob = t.dospeli + t.deti;
    const obsazeno = live && !t.bal ? (r.R.typy || []).filter(q => q.previo_id && (q.max_osob || 2) >= osob && !volne.some(v => v.nazev === q.nazev)).map(q => {
      const a = r.A.find(p => p.nazev === q.nazev) || {};
      return { nazev: q.nazev, foto: a.foto || (a.fotky || [])[0], osoby: String(a.osoby || ''), plocha: a.plocha };
    }) : [];
    // křížový prodej: nic volného, nebo zbývá málo (živě: ≤ MALO_VOLNA apartmánů) → ostatní resorty na stejný termín
    const malo = live && volne.reduce((s, x) => s + (+x.volno || 0), 0) <= MALO_VOLNA;
    const jine = !typy.length || malo ? await jineResorty(r, d, vsechnyResorty()) : [];
    // ceny doplňků pro tento termín (Previo → Reservio → CMS) – formulář jimi přepíše ceny z CMS
    const doplnky = await cenyDoplnku(r, t.od, t.doo);
    return json({ rezim: live ? 'live' : 'cenik', typy, obsazeno, jine, malo: !!typy.length && malo, doplnky });
  } catch (e) {
    if (e instanceof Chyba) return json({ chyba: e.message }, 400);
    console.error(e);
    return json({ chyba: 'Nabídku se teď nepodařilo načíst.' }, 502);
  }
};
