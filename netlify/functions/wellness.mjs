// Volné časy privátního wellness (Reservio) v době pobytu – pro krok „Doplňky“ a děkovnou stránku rezervace.
//
// Všechny dotazy berou ?resort=cerveny-dvur|vila-republika (výchozí Červený dvůr).
// GET /.netlify/functions/wellness?ceny=1 → { ceny: { idDoplnku: Kč } } – ceny napojených doplňků podle Reservio
// GET /.netlify/functions/wellness?doplnek=wellness&od=2026-12-12&do=2026-12-14[&late=1]
//     → { zapnuto, dny: [{ den, casy: [{ start, end }] }] }  (od check-inu 14:00 do check-outu 10:00 / s pozdním 12:00)
//
// Doplněk je napojený na Reservio, když má v CMS vyplněné „Reservio ID služby“ (data/rezervace.json → doplnky[].reservio_sluzba).
// Samotnou rezervaci času (zdarma – wellness je zaplacené v rámci pobytu) dělá netlify/functions/platba.mjs.
// Samostatné wellness bez pobytu se dál prodává přes Reservio (platba kartou přes jejich bránu).
import { reservioZapnuto, reservioDemo } from '../lib/reservio.mjs';
import { casyPobytu, cenyZReservio } from '../lib/wellness.mjs';
import { resort } from '../lib/resorty.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const date = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s : null;

export default async (req) => {
  try {
    const u = new URL(req.url).searchParams;
    const r = resort(u.get('resort'));
    if (!reservioZapnuto(r)) return json({ zapnuto: false });
    if (u.get('ceny')) return json({ ceny: await cenyZReservio(r) }); // ceny doplňků podle Reservio pro formulář
    const od = date(u.get('od')), doo = date(u.get('do'));
    if (!u.get('doplnek') || !od || !doo || doo < od) return json({ chyba: 'Neplatný dotaz' }, 400);
    const x = (r.R.doplnky || []).find(q => q.id === u.get('doplnek'));
    // „mimo provoz“ (CMS) = jako by bylo plno → formulář nabídne wellness v jiném resortu
    if (x && x.mimo_provoz) return json({ zapnuto: true, dny: [], mimo_provoz: true });
    const dny = await casyPobytu(r, u.get('doplnek'), od, doo, u.get('late') === '1');
    if (!dny) return json({ zapnuto: false });
    // informace o doplňku a resortu – pro nabídku wellness v jiném resortu (křížový prodej)
    const cena = (await cenyZReservio(r))[x.id] ?? x.cena;
    return json({ zapnuto: true, dny, demo: reservioDemo(r),
      doplnek: { id: x.id, nazev: x.nazev, popis: x.popis, cena, jednotka: x.jednotka, max_ks: x.max_ks, ks_label: x.ks_label }, resort: { id: r.id, nazev: r.nazev, misto: r.misto } });
  } catch (e) {
    console.error(e);
    return json({ zapnuto: true, chyba: 'Rezervační systém wellness teď neodpovídá.', dny: [] }, 502);
  }
};
