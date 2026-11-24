// Previo API – XML (https://xml.apidocs.previo.app/) a REST (https://rest.apidocs.previo.app/)
//
// Každý resort má vlastní hotel v Previo. Proměnné bez přípony = Červený dvůr, s příponou _VR = Vila Republika
// (API klíč, když chybí vlastní, se vezme společný PREVIO_API_KEY).
//   PREVIO_API_KEY(_VR)  – API klíč (hlavička Authorization: ApiKey …), u starších účtů PREVIO_LOGIN + PREVIO_PASSWORD
//   PREVIO_HOTEL_ID(_VR) – 769376 Červený dvůr, 758539 Vila Republika (výchozí hodnoty jsou v resorty.mjs)
//   PREVIO_LIVE(_VR)     – "1" zapne živý režim resortu (ceny, dostupnost a zápis rezervací do Previo)
//   PREVIO_ZALOHOVY_LIST – "1": u platby převodem vystaví zálohový list přes API (REST invoice/addPayment).
//                      Bez toho ho pošle recepce / automatický e-mail Previo („Předpis platby“). OVĚŘIT na testovacím hotelu.
import { env } from './resorty.mjs';
import { typStravy, jeNevratna } from './cena.mjs';

const BASE = (process.env.PREVIO_URL || 'https://api.previo.app/').replace(/\/?$/, '/');
const HOTEL = r => env(r, 'PREVIO_HOTEL_ID', false) || r.hotel;
const KEY = r => env(r, 'PREVIO_API_KEY');
const M = {
  // OVĚŘIT na testovacím hotelu – ceny (Hotel.getRates) a volná kapacita
  kapacita: process.env.PREVIO_M_KAPACITA || 'Booking.getFreeCapacity',
  ceny: process.env.PREVIO_M_CENY || 'Hotel.getRates',
  rezervace: 'Hotel.reservation',
};
export const previoLive = r => env(r, 'PREVIO_LIVE', false) === '1' && !!(KEY(r) || env(r, 'PREVIO_LOGIN'));

export const x = s => String(s ?? '').replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
const auth = r => (KEY(r) ? { Authorization: 'ApiKey ' + KEY(r) } : {});

// XML: název funkce „Hotel.getRates“ → URL …/x1/hotel/getRates, tělo je XML <request>…</request>
export async function previo(r, method, inner) {
  const [a, b] = method.split('.');
  const url = BASE + 'x1/' + a.charAt(0).toLowerCase() + a.slice(1) + '/' + b;
  const login = KEY(r) ? '' : `<login>${x(env(r, 'PREVIO_LOGIN'))}</login><password>${x(env(r, 'PREVIO_PASSWORD'))}</password>`;
  const body = `<?xml version="1.0" encoding="UTF-8"?><request>${login}<hotId>${x(HOTEL(r))}</hotId>${inner}</request>`;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/xml; charset=utf-8', ...auth(r) }, body, signal: AbortSignal.timeout(9000) });
  const t = await res.text();
  if (!res.ok || /<error/i.test(t)) throw new Error(`Previo ${r.id} ${method}: ${res.status} ${t.slice(0, 300)}`);
  return t;
}
// REST: JSON, stejný API klíč
export async function previoRest(r, path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + 'rest/' + path, {
    method, headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...auth(r) },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(9000),
  });
  const t = await res.text();
  if (!res.ok) throw new Error(`Previo ${r.id} REST ${path}: ${res.status} ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : {};
}
// jednoduché čtení XML bez knihovny (odpovědi Previo jsou ploché)
export const tags = (xml, tag) => [...xml.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'g'))].map(m => m[1]);
export const val = (xml, tag) => { const m = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`)); return m ? m[1].trim() : ''; };

/** Volné typy apartmánů a jejich sazby pro termín (živě z Previo). */
export async function nabidka(r, { od, doo, dospeli, deti, balicek }) {
  const term = `<term><from>${od}</from><to>${doo}</to></term><guests><adults>${dospeli}</adults><children>${deti}</children></guests>`;
  // OVĚŘIT: tvar požadavku a odpovědi Hotel.getRates podle manuálu
  const [kap, cen] = await Promise.all([previo(r, M.kapacita, term), previo(r, M.ceny, term + (balicek ? `<stayId>${x(balicek)}</stayId>` : ''))]);
  const volno = Object.fromEntries(tags(kap, 'objectKind').map(k => [val(k, 'obkId'), +val(k, 'freeCount') || tags(k, 'object').length || 0]));
  const sl = (r.R.sleva_primo || 0) / 100;
  return r.R.typy.filter(t => t.previo_id && volno[t.previo_id] > 0).map(t => {
    const a = r.A.find(p => p.nazev === t.nazev) || {};
    const sazby = tags(cen, 'rate').filter(q => val(q, 'obkId') === String(t.previo_id)).map(q => {
      const portal = +val(q, 'price');
      const sz = { id: val(q, 'prlId') || val(q, 'rateId'), nazev: val(q, 'name'), popis: val(q, 'description') };
      return { ...sz, portal, cena: portal * (1 - sl), strava: typStravy(sz), nevratna: jeNevratna(sz) };
    }).filter(s => s.portal > 0);
    return { id: t.previo_id, nazev: t.nazev, foto: a.foto || (a.fotky || [])[0], osoby: a.osoby, plocha: a.plocha, popis: a.popis, volno: volno[t.previo_id], sazby };
  }).filter(t => t.sazby.length);
}

/**
 * Storno a obchodní podmínky hotelu (Hotel.getConditions).
 * → { storno: [{ hodin, castka, jednotka: 'procent'|'noci', od, do }], text } – text = doplňující obchodní podmínky z Previo
 */
export async function podminky(r) {
  const t = await previo(r, 'Hotel.getConditions', '<lanId>1</lanId>');
  const storno = tags(t, 'condition').map(c => ({
    hodin: +val(c, 'length'), castka: +val(c, 'amount'), jednotka: val(c, 'unit') === '2' ? 'noci' : 'procent',
    od: val(c, 'from') || null, do: val(c, 'to') || null, poradi: +val(c, 'order') || 0,
  })).filter(c => c.hodin > 0 || c.castka > 0);
  const raw = val(t, 'additional').replace(/^<!\[CDATA\[|\]\]>$/g, '');
  const text = raw.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&amp;/g, '&');
  return { storno, text: val(t, 'additionalType') === '0' ? '' : text };
}

// stavy rezervace (cosId / gCosId)
export const OPCE = 1, POTVRZENO = 2, ZRUSENO = 7;
const pragueTime = d => new Date(d).toLocaleString('sv-SE', { timeZone: 'Europe/Prague' }).replace(' ', 'T');

/**
 * Zápis rezervace do Previo (Hotel.reservation → newReservation).
 * d = { od, do, dospeli, deti, typ (obkId), sazba (prlId), stayId, cena, doplnky: [názvy], host: {...}, obj, zpusob }
 */
export async function vytvorRezervaci(r, d, { stav = OPCE, opceDo } = {}) {
  const h = d.host || {};
  const note = [`Web – rezervace napřímo (−${r.R.sleva_primo || 0} %), objednávka ${d.obj || ''}`,
    d.zpusob === 'karta' ? 'Platba kartou online (ČSOB)' : d.zpusob === 'prevod' ? 'Platba převodem – zálohový list' : '',
    (d.doplnky || []).length ? 'Doplňky: ' + d.doplnky.join(', ') : '', h.poznamka].filter(Boolean).join(' | ');
  const inner = `<newReservation>
    <commissions>${(d.pokoje && d.pokoje.length ? d.pokoje : [{ typ: d.typ, dospeli: d.dospeli, deti: d.deti }]).map((p, i) => `<commission>
      <guests><numGuest>${(+p.dospeli || 1) + (+p.deti || 0)}</numGuest>
        ${i === 0 ? `<guest><firstName>${x(h.jmeno)}</firstName><lastName>${x(h.prijmeni)}</lastName><email>${x(h.email)}</email><phone>${x(h.telefon)}</phone></guest>` : ''}
      </guests>
      <obkId>${x(p.typ)}</obkId>${d.sazba && /^\d+$/.test(d.sazba) ? `<prlId>${x(d.sazba)}</prlId>` : ''}<cmsId>3</cmsId>
      <note>${x(d.pokoje && d.pokoje.length > 1 ? `Skupina – apartmán ${i + 1}/${d.pokoje.length}. ${note}` : note)}</note>
    </commission>`).join('')}</commissions>
    ${d.stayId ? `<styId>${x(d.stayId)}</styId>` : ''}
    <gCosId>${stav}</gCosId>${stav === OPCE && opceDo ? `<optionExpiration>${pragueTime(opceDo)}</optionExpiration>` : ''}
    <lanId>1</lanId>
    <term><from>${d.od} ${r.checkin}:00</from><to>${d.do} ${r.checkout}:00</to></term>
    ${h.firma ? `<company><name>${x(h.firma)}</name>${h.ico ? `<idNum>${x(h.ico)}</idNum>` : ''}</company>` : ''}
    <contactPerson><name>${x(`${h.jmeno || ''} ${h.prijmeni || ''}`.trim())}</name><email>${x(h.email)}</email><phone>${x(h.telefon)}</phone></contactPerson>
    <price><total>${Math.round(+d.cena || 0)}</total><curId>1</curId></price>
  </newReservation>`;
  const t = await previo(r, M.rezervace, inner);
  return { resId: val(t, 'resId'), comId: val(t, 'comId'), voucher: val(t, 'voucher') };
}
/** Změna stavu celé rezervace (potvrdit po zaplacení / zrušit). */
export const zmenStav = (r, resId, stav) => previo(r, M.rezervace, `<newReservation><resId>${x(resId)}</resId><gCosId>${stav}</gCosId></newReservation>`);

// způsoby platby a typy dokladů v REST invoice/addPayment
const PAY = { prevod: 2, online: 10 }, DOKLAD = { faktura: 1, uctenka: 2, proforma: 3, zalohovy: 4 };
/** Zapíše do účtu rezervace přijatou online platbu (vystaví doklad o přijaté platbě). */
export const zapisPlatbu = (r, resId) => previoRest(r, 'invoice/addPayment?pdf=false', {
  method: 'POST', body: { intId: +(process.env.PREVIO_DOKLAD_KARTA || DOKLAD.zalohovy), resId: +resId, comId: null, gueId: null, payId: PAY.online },
});
/** Vystaví zálohový list (proformu) pro platbu převodem. Vrací { invId, pdf (base64) }. */
export const zalohovyList = (r, resId) => previoRest(r, 'invoice/addPayment?pdf=true', {
  method: 'POST', body: { intId: DOKLAD.proforma, resId: +resId, comId: null, gueId: null, payId: PAY.prevod },
});
