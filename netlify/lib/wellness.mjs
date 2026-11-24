// Wellness k pobytu: volné časy z Reservio jen v době pobytu (od check-inu do check-outu), ceny podle Reservio.
import { reservioZapnuto, reservioDemo, volneCasy, sluzby } from './reservio.mjs';

/** ID služby v Reservio pro doplněk. V ukázkovém režimu (bez klíče) se wellness napojí na vymyšlenou službu. */
export const sluzbaId = (r, x) => x.reservio_sluzba || (reservioDemo(r) && /wellness/.test(x.id) ? 'DEMO-' + ((String(x.nazev).match(/(\d+)\s*min/) || [0, 90])[1]) : '');

export const den = iso => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Prague' });
export const cas = iso => new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export const CHECKOUT_LATE = '12:00';

const _ceny = {};
/**
 * Ceny napojených doplňků podle Reservio (cena služby) – web a Reservio pak mají vždy stejnou cenu.
 * → { idDoplnku: Kč }. Bez Reservio / při chybě {} – platí cena z CMS.
 */
export async function cenyZReservio(r) {
  if (!reservioZapnuto(r) || reservioDemo(r)) return {};
  const c = _ceny[r.id];
  if (c && c.t > Date.now() - 36e5) return c.v; // hodinu v paměti (ceny se mění zřídka, Reservio občas odpovídá pomalu)
  try {
    const S = await sluzby(r, true, 5000);
    const v = {};
    for (const d of r.R.doplnky || []) { const s = d.reservio_sluzba && S.find(x => x.id === d.reservio_sluzba); if (s && +s.cena > 0) v[d.id] = Math.round(+s.cena); }
    _ceny[r.id] = { t: Date.now(), v };
    return v;
  } catch (e) {
    console.error(`Ceny z Reservio (${r.id}):`, e.message);
    return c ? c.v : {};
  }
}

/** Volné časy doplňku během pobytu, seskupené po dnech. null = doplněk není napojený na Reservio. */
export async function casyPobytu(r, doplnek, od, doo, late = false) {
  const x = (r.R.doplnky || []).find(d => d.id === doplnek && sluzbaId(r, d));
  if (!x || !reservioZapnuto(r)) return null;
  const konec = late ? CHECKOUT_LATE : r.checkout;
  const casy = (await volneCasy(r, sluzbaId(r, x), od, doo)).filter(s => {
    const d = den(s.start);
    if (d === od && cas(s.start) < r.checkin) return false;                   // před příjezdem
    if (d === doo && (den(s.end) !== d || cas(s.end) > konec)) return false; // po odjezdu
    return true;
  });
  const dny = [];
  for (const s of casy) {
    const d = den(s.start);
    let g = dny.find(q => q.den === d);
    if (!g) dny.push(g = { den: d, casy: [] });
    if (!g.casy.some(c => c.start === s.start)) g.casy.push({ start: s.start, end: s.end });
  }
  return dny;
}
