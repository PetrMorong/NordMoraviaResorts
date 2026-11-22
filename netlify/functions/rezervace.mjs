// Rezervační portál Červený dvůr ↔ Previo (XML API, https://api.previo.app/x1/)
//
// GET  /.netlify/functions/rezervace?od=2027-01-15&do=2027-01-17&dospeli=2&deti=0[&balicek=<Previo stayId>]
//      → { rezim: 'live', typy: [{ id, nazev, foto, osoby, plocha, popis, volno, sazby: [{ id, nazev, popis, cena, portal }] }] }
// POST /.netlify/functions/rezervace  { od, do, dospeli, deti, typ, sazba, balicek, doplnky, cena, host: {...} }
//      → { ok: true, cislo }
//
// Bezpečnost: přístup k API je jen tady na serveru. Klíč patří do proměnných prostředí na Netlify, nikdy do kódu ani do CMS:
//   PREVIO_API_KEY   – API klíč (nebo PREVIO_LOGIN + PREVIO_PASSWORD u starších účtů)
//   PREVIO_HOTEL_ID  – 769376 (Resort Červený dvůr)
//   PREVIO_LIVE      – "1" zapne živý režim; bez něj vrací { rezim: 'poptavka' } a web počítá z ceníku v CMS
//
// Stav: kostra připravená k dokončení. Názvy metod a tvar XML je potřeba ověřit v manuálu https://xml.apidocs.previo.app/
// (dají se přepsat proměnnými PREVIO_M_*), a otestovat na testovacím hotelu od Previo. Do té doby nechte PREVIO_LIVE vypnuté.
import R from '../../cerveny-dvur/data/rezervace.json' with { type: 'json' };
import A from '../../cerveny-dvur/data/apartmany.json' with { type: 'json' };

const BASE = process.env.PREVIO_URL || 'https://api.previo.app/x1/';
const HOTEL = process.env.PREVIO_HOTEL_ID || '769376';
const M = {
  // OVĚŘIT v manuálu – názvy funkcí Previo XML
  kapacita: process.env.PREVIO_M_KAPACITA || 'Hotel.searchFreeCapacity',
  ceny: process.env.PREVIO_M_CENY || 'Hotel.getRates',
  rezervace: process.env.PREVIO_M_REZERVACE || 'Hotel.makeReservation',
};
const live = () => process.env.PREVIO_LIVE === '1' && (process.env.PREVIO_API_KEY || process.env.PREVIO_LOGIN);
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const x = s => String(s ?? '').replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
const date = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s : null;

// Volání Previo: název funkce „Hotel.getRates“ → URL …/x1/hotel/getRates, tělo je XML <request>…</request>
async function previo(method, inner) {
  const [a, b] = method.split('.');
  const url = BASE + a.charAt(0).toLowerCase() + a.slice(1) + '/' + b;
  const auth = process.env.PREVIO_API_KEY ? '' : `<login>${x(process.env.PREVIO_LOGIN)}</login><password>${x(process.env.PREVIO_PASSWORD)}</password>`;
  const body = `<?xml version="1.0" encoding="UTF-8"?><request>${auth}<hotId>${x(HOTEL)}</hotId>${inner}</request>`;
  const headers = { 'Content-Type': 'text/xml; charset=utf-8' };
  if (process.env.PREVIO_API_KEY) headers.Authorization = 'ApiKey ' + process.env.PREVIO_API_KEY;
  const r = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(9000) });
  const t = await r.text();
  if (!r.ok || /<error/i.test(t)) throw new Error(`Previo ${method}: ${r.status} ${t.slice(0, 300)}`);
  return t;
}
// jednoduché čtení XML bez knihovny (odpovědi Previo jsou ploché)
const tags = (xml, tag) => [...xml.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'g'))].map(m => m[1]);
const val = (xml, tag) => { const m = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`)); return m ? m[1].trim() : ''; };

async function nabidka({ od, doo, dospeli, deti, balicek }) {
  const term = `<term><from>${od}</from><to>${doo}</to></term><guests><adults>${dospeli}</adults><children>${deti}</children></guests>`;
  // OVĚŘIT: tvar požadavku a odpovědi podle manuálu
  const [kap, cen] = await Promise.all([previo(M.kapacita, term), previo(M.ceny, term + (balicek ? `<stayId>${x(balicek)}</stayId>` : ''))]);
  const volno = Object.fromEntries(tags(kap, 'objectKind').map(k => [val(k, 'obkId'), +val(k, 'freeCount') || 0]));
  const sl = (R.sleva_primo || 0) / 100;
  return R.typy.filter(t => t.previo_id && volno[t.previo_id] > 0).map(t => {
    const a = A.apartmany.find(p => p.nazev === t.nazev) || {};
    const sazby = tags(cen, 'rate').filter(r => val(r, 'obkId') === String(t.previo_id)).map(r => {
      const portal = +val(r, 'price');
      return { id: val(r, 'prlId') || val(r, 'rateId'), nazev: val(r, 'name'), popis: val(r, 'description'), portal, cena: portal * (1 - sl) };
    }).filter(s => s.portal > 0);
    return { id: t.previo_id, nazev: t.nazev, foto: a.foto, osoby: a.osoby, plocha: a.plocha, popis: a.popis, volno: volno[t.previo_id], sazby };
  }).filter(t => t.sazby.length);
}

async function vytvor(d) {
  const h = d.host || {};
  const inner = `<reservation><term><from>${d.od}</from><to>${d.do}</to></term>
    <objectKind><obkId>${x(d.typ)}</obkId><prlId>${x(d.sazba)}</prlId>${d.balicek ? `<stayId>${x(d.balicek)}</stayId>` : ''}<adults>${+d.dospeli || 1}</adults><children>${+d.deti || 0}</children></objectKind>
    <guest><firstName>${x(h.jmeno)}</firstName><lastName>${x(h.prijmeni)}</lastName><email>${x(h.email)}</email><phone>${x(h.telefon)}</phone>
      ${h.firma ? `<company>${x(h.firma)}</company><ic>${x(h.ico)}</ic>` : ''}</guest>
    <price>${Math.round(+d.cena || 0)}</price>
    <note>${x(['Web – rezervace napřímo (−' + (R.sleva_primo || 0) + ' %)', (d.doplnky || []).length ? 'Doplňky: ' + d.doplnky.join(', ') : '', h.poznamka].filter(Boolean).join(' | '))}</note>
  </reservation>`;
  const t = await previo(M.rezervace, inner); // OVĚŘIT
  return val(t, 'resId') || val(t, 'reservationId') || '';
}

export default async (req) => {
  if (!live()) return json({ rezim: 'poptavka' });
  try {
    if (req.method === 'GET') {
      const u = new URL(req.url).searchParams;
      const od = date(u.get('od')), doo = date(u.get('do'));
      if (!od || !doo || doo <= od) return json({ chyba: 'Neplatný termín' }, 400);
      const typy = await nabidka({ od, doo, dospeli: Math.min(+u.get('dospeli') || 2, 12), deti: Math.min(+u.get('deti') || 0, 10), balicek: u.get('balicek') });
      return json({ rezim: 'live', typy });
    }
    if (req.method === 'POST') {
      const d = await req.json();
      if (!date(d.od) || !date(d.do) || !d.typ || !d.host || !/@/.test(d.host.email || '')) return json({ ok: false, chyba: 'Chybí údaje' }, 400);
      const cislo = await vytvor(d);
      return json({ ok: true, cislo });
    }
    return json({ chyba: 'Metoda není podporovaná' }, 405);
  } catch (e) {
    console.error(e);
    // když Previo neodpoví, web přepne na poptávkový režim – host rezervaci nedokončí naslepo
    return json({ rezim: 'poptavka', ok: false, chyba: 'previo' }, 200);
  }
};
