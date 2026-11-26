// Reservio API v2 (https://reservioapiv2.docs.apiary.io/) – privátní wellness (každý resort má vlastní Reservio)
//
//   RESERVIO_TOKEN(_VR)        – API token (Bearer), vydává podpora Reservio k tarifu Pro
//   RESERVIO_BUSINESS_ID(_VR)  – ID podniku v Reservio (vypíše node scripts/reservio-sluzby.mjs)
//   RESERVIO_URL               – jen pro testy (jiná adresa API)
//   RESERVIO_JEN_CIST=1        – s ostrým tokenem jen čte volné časy, rezervace se do Reservio nezapisují (testování)
//   RESERVIO_DEMO=1            – ukázkový režim bez klíče: vymyšlené volné časy, do Reservio se nic nezapisuje
//                                (lokálně ho zapíná npm run dev samo, na náhledu Netlify ho nastavte ručně)
//
// Reservio neumí webhooky ani zrušení rezervace přes API – zrušení dělá recepce v Reservio.
// Token a podnik se NEBEROU ze společné proměnné – každý resort má jiné Reservio.
import { env } from './resorty.mjs';

const base = () => (process.env.RESERVIO_URL || 'https://api.reservio.com/v2').replace(/\/$/, '');
const tok = r => env(r, 'RESERVIO_TOKEN', false) || '';
const biz = r => env(r, 'RESERVIO_BUSINESS_ID', false) || '';
const klic = r => !!(tok(r) && biz(r));
export const reservioDemo = r => !klic(r) && process.env.RESERVIO_DEMO === '1';
export const reservioZapnuto = r => klic(r) || reservioDemo(r);
const jenCist = r => reservioDemo(r) || process.env.RESERVIO_JEN_CIST === '1';

// Časy v Reservio jsou s posunem pásma; filtry posíláme v místním čase Prahy.
const offset = d => {
  const h = +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', hour: '2-digit', hourCycle: 'h23' }).format(new Date(d + 'T12:00:00Z'));
  return `+${String(h - 12).padStart(2, '0')}:00`;
};
export const prahaISO = (d, cas = '00:00') => `${d}T${cas}:00${offset(d)}`;

// ---- ukázkový režim: každý den 9:00–21:00, v pátek a sobotu odpoledne „obsazeno“ ----
const demoBooked = new Set();
function demoCasy(serviceId, od, doo) {
  const min = +(String(serviceId).match(/\d+/) || [90])[0];
  const out = [];
  for (let d = od; d <= doo; d = new Date(Date.parse(d + 'T12:00Z') + 864e5).toISOString().slice(0, 10)) {
    const dow = new Date(d + 'T12:00Z').getUTCDay(), plno = dow === 5 || dow === 6 ? [14, 16, 18] : [];
    for (const h of [9, 11, 14, 16, 18, 20]) {
      if (plno.includes(h)) continue;
      const start = prahaISO(d, `${String(h).padStart(2, '0')}:00`);
      const end = new Date(Date.parse(start) + min * 6e4);
      const endISO = prahaISO(end.toLocaleDateString('sv-SE', { timeZone: 'Europe/Prague' }), end.toLocaleTimeString('en-GB', { timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
      if (!demoBooked.has(serviceId + start)) out.push({ start, end: endISO, resource: 'demo' });
    }
  }
  return out.filter(s => new Date(s.start) > new Date());
}

async function api(r, path, { method = 'GET', body, timeout = 10000 } = {}) {
  const url = /^https?:/.test(path) ? path : `${base()}/businesses/${encodeURIComponent(biz(r))}${path}`;
  const res = await fetch(url, {
    method, signal: AbortSignal.timeout(timeout),
    headers: { Authorization: 'Bearer ' + tok(r), Accept: 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await res.text();
  if (!res.ok) throw new Error(`Reservio ${method} ${path.split('?')[0]}: ${res.status} ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : {};
}
// stránkovaná kolekce (JSON:API – links.next)
async function vse(r, path, opts) {
  const out = [];
  let j = await api(r, path, opts);
  for (let i = 0; i < 20; i++) {
    out.push(...(j.data || []));
    if (!j.links || !j.links.next) break;
    // Reservio v odkazu „next“ nechává „+01:00“ nezakódované – „+“ by se přečetlo jako mezera (404)
    j = await api(r, j.links.next.replace(/\+/g, '%2B'), opts);
  }
  return out;
}

/** Služby (výchozí: jen viditelné na rezervační stránce; vsechny = i skryté). → [{ id, nazev, popis, delka (min), cena }] */
export async function sluzby(r, vsechny = false, timeout) {
  return (await vse(r, '/services?page[limit]=100', timeout ? { timeout } : undefined)).filter(s => vsechny || s.attributes.isVisible !== false).sort((a, b) => (a.attributes.position || 0) - (b.attributes.position || 0))
    .map(s => ({ id: s.id, nazev: s.attributes.name, popis: s.attributes.description || '', delka: Math.round((s.attributes.duration || 0) / 60), cena: s.attributes.cost }));
}

/** Volné časy služby v rozmezí dní (od včetně, do včetně, RRRR-MM-DD). → [{ start, end, resource }] */
export async function volneCasy(r, serviceId, od, doo) {
  if (reservioDemo(r)) return demoCasy(serviceId, od, doo);
  const q = new URLSearchParams({ 'page[limit]': '200', 'filter[from]': prahaISO(od), 'filter[to]': prahaISO(doo, '23:59'), 'filter[serviceId]': serviceId });
  const data = await vse(r, `/availability/booking-slots?${q}`);
  return data.map(s => ({ start: s.attributes.start, end: s.attributes.end, resource: s.relationships && s.relationships.resource && s.relationships.resource.data && s.relationships.resource.data.id }))
    .filter(s => s.start && new Date(s.start) > new Date() && !demoBooked.has(serviceId + s.start))
    .filter((s, i, a) => a.findIndex(x => +new Date(x.start) === +new Date(s.start)) === i) // stejný čas na víc prostorech = jedna nabídka
    .sort((a, b) => new Date(a.start) - new Date(b.start));
}

/** Je čas pořád volný? (těsně před rezervací – mezitím ho mohl obsadit někdo jiný) */
export async function jeVolno(r, serviceId, start) {
  const den = new Date(start).toLocaleDateString('sv-SE', { timeZone: 'Europe/Prague' });
  const casy = await volneCasy(r, serviceId, den, den);
  return casy.find(s => +new Date(s.start) === +new Date(start)) || null;
}

/** Vytvoří rezervaci (appointment) na vybraný čas. cena: 0 = zdarma (zaplaceno jinde). → { id, stav } */
export async function rezervuj(r, { serviceId, start, end, jmeno, email, telefon, poznamka = '', cena }) {
  if (jenCist(r)) { demoBooked.add(serviceId + start); console.log(`[Reservio ${r.id} – NEZAPSÁNO]`, start, jmeno, '|', poznamka); return { id: 'demo-' + Date.now(), stav: 'demo' }; }
  const zdarma = cena === 0 ? { cost: 0 } : {}; // OVĚŘIT na účtu Reservio, že API cenu 0 přijme (jinak zůstane cena služby a platí poznámka)
  const j = await api(r, '/bookings', {
    method: 'POST', body: {
      data: {
        type: 'booking', attributes: { bookedClientName: jmeno, note: poznamka.slice(0, 1000), ...zdarma },
        relationships: {
          event: { data: { type: 'event', attributes: { start, end, name: jmeno, eventType: 'appointment', ...zdarma }, relationships: { service: { data: { type: 'service', id: serviceId } } } } },
          client: { data: { type: 'client', attributes: { name: jmeno, email, phone: telefon } } },
        },
      },
    },
  });
  return { id: j.data && j.data.id, stav: j.data && j.data.attributes && j.data.attributes.state };
}
