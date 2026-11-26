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
import { jeNevratna } from './cena.mjs';

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
// PREVIO_JEN_CIST=1 – živé ceny a obsazenost, ale nic se do Previo nezapíše (rezervace, platby jen do logu).
// Na testování s ostrým hotelem – jinak by každá zkušební objednávka založila skutečnou rezervaci.
const jenCist = () => process.env.PREVIO_JEN_CIST === '1';
const ZAPIS_XML = /^Hotel\.(reservation|addPayment)$/;
let falesne = 0;

export async function previo(r, method, inner) {
  if (jenCist() && ZAPIS_XML.test(method)) {
    console.log(`[Previo jen čtení] ${r.id} ${method} se neodeslal:\n${inner.replace(/\s+/g, ' ').slice(0, 600)}`);
    const id = 'TEST-' + (++falesne);
    return `<response><resId>${id}</resId><comId>${id}</comId><voucher>${id}</voucher></response>`;
  }
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
export async function previoRest(r, path, { method = 'GET', body, headers = {} } = {}) {
  if (jenCist() && method !== 'GET') {
    console.log(`[Previo jen čtení] ${r.id} REST ${method} ${path} se neodeslal: ${JSON.stringify(body || {}).slice(0, 300)}`);
    return {};
  }
  const res = await fetch(BASE + 'rest/' + path, {
    method, headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Previo-Hotel-ID': String(HOTEL(r)), ...auth(r), ...headers },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(9000),
  });
  const t = await res.text();
  if (!res.ok) throw new Error(`Previo ${r.id} REST ${path}: ${res.status} ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : {};
}
// jednoduché čtení XML bez knihovny (odpovědi Previo jsou ploché)
export const tags = (xml, tag) => [...xml.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'g'))].map(m => m[1]);
export const val = (xml, tag) => { const m = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`)); return m ? m[1].trim() : ''; };

// ── Živá nabídka ──────────────────────────────────────────────────────────────
// Ověřeno na hotelu Červený dvůr (11/2026):
//   Hotel.getRates → <ratePlan> základní sazby (Base rate) → <season from to(exkluzivně)> → <objectKind><obkId>
//     <rate><occupancy>N</occupancy><price>Kč za noc</price></rate>, v sezóně i <meal><meaId><guaId><rate><price>
//     (příplatek/sleva stravy za osobu a noc vůči výchozí stravě), <minStay>, <closeToArrival>, <closeToDeparture>
//   REST calendar/availability?filterFrom&filterTo → [{ ratePlanId, availability: [{ date, roomKinds: [{ id, availability }] }] }]
//   REST guest-categories (hlavička X-Previo-Language-ID) → kategorie hostů (dospělý / dítě 0–2 / dítě 3–17)
// Strava v Previo: meaId 1 = bez stravy, 2 = snídaně (u ČD výchozí, v ceně), 5 = polopenze.
// Sazby (flexibilní / nevratná, sleva) zůstávají v CMS – z Previo se bere cena ubytování, strava a volná kapacita.
const MEA = { bez: 1, snidane: 2, polopenze: 5 };
const cache = new Map();
const memo = (k, ms, fn) => {
  const c = cache.get(k);
  if (c && c.do > Date.now()) return c.p;
  const p = fn().catch(e => { cache.delete(k); throw e; });
  cache.set(k, { p, do: Date.now() + ms });
  return p;
};
const plusDen = (d, n = 1) => { const t = new Date(d + 'T12:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

/** Kategorie hostů → { dospely: guaId, dite: guaId (3–17 let) } */
const kategorie = r => memo('gua:' + r.id, 36e5, async () => {
  const j = await previoRest(r, 'guest-categories', { headers: { 'X-Previo-Language-ID': '1' } });
  const c = j.categories || [];
  const dite = c.filter(q => q.guestCategoryTypeId !== 3 && !q.isWithoutBed).sort((a, b) => b.ageTo - a.ageTo)[0];
  return { dospely: String(j.defaultCategoryId || (c.find(q => q.guestCategoryTypeId === 3) || {}).guestCategoryId), dite: dite ? String(dite.guestCategoryId) : null };
});

const hm = s => String(s || '').slice(0, 5);
const praha = () => new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Prague' }); // „2026-11-24 15:30:00“

/** Nastavení hotelu (Hotel.get): čas příjezdu a odjezdu, uzávěrka online rezervací s příjezdem na dnešek. */
export const hotelInfo = r => memo('hotel:' + r.id, 36e5, async () => {
  const t = await previo(r, 'Hotel.get', '');
  return { checkin: hm(val(t, 'arrival')) || r.checkin, checkout: hm(val(t, 'departure')) || r.checkout, uzaverka: hm(val(t, 'maxOnlineBookTime')) };
});
/** Čas příjezdu a odjezdu resortu – živě z Previo, jinak z resorty.mjs. */
export const casyHotelu = async r => (previoLive(r) ? hotelInfo(r).catch(() => r) : r);

/**
 * Platební podmínky pro termín (Hotel.getPaymentMethods, sezóna podle data příjezdu).
 * → { prevod: { procent, castka, dni } | null, karta: { procent, castka, dni, sleva } | null }
 *   procent / castka = záloha (procenta z ceny, nebo pevná částka), dni = splatnost zálohy, sleva = sleva za platbu online (%)
 *   null = způsob platby není v Previo pro tento termín povolený
 */
const PAY_ID = { prevod: '2', karta: '10' };
export const platebniPodminky = (r, od, doo) => memo(`pay:${r.id}:${od}:${doo}`, 6e5, async () => {
  const t = await previo(r, 'Hotel.getPaymentMethods', `<term><from>${od}</from><to>${doo}</to></term>`);
  const metody = tags(t, 'paymentMethod');
  const out = {};
  for (const [k, id] of Object.entries(PAY_ID)) {
    const m = metody.find(q => val(q, 'payId') === id);
    if (!m) { out[k] = null; continue; }
    const sez = tags(m, 'paymentSeason'), s = sez.find(q => val(q, 'from') <= od && od < val(q, 'to')) || sez[0] || '';
    const adv = val(s, 'advance'), typ = val(adv, 'type'), v = +val(adv, 'value') || 0;
    out[k] = { procent: !adv ? 100 : typ === 'per' ? v : null, castka: adv && typ !== 'per' ? v : null, dni: +val(adv, 'expiration') || null, sleva: +val(s, 'discount') || 0 };
  }
  return out;
});

/**
 * Doplňkové služby hotelu (Hotel.getPackages) → { pckId: { nazev, cena, jednotka, web } }
 * jednotka jako v CMS: 'pobyt' (za kus) | 'noc' | 'osoba' | 'osoba_noc'; web = služba je v Previo zobrazená v rezervačním formuláři.
 */
const PCU = { 1: 'pobyt', 12: 'pobyt', 13: 'pobyt', 2: 'noc', 3: 'osoba_noc', 4: 'osoba' };
export const sluzbyHotelu = (r, od, doo) => memo(`pck:${r.id}:${od}:${doo}`, 36e5, async () => {
  const t = await previo(r, 'Hotel.getPackages', `<term><from>${od}</from><to>${doo}</to></term><lanId>1</lanId>`);
  return Object.fromEntries(tags(t, 'package').map(p => {
    const s = val(p, 'season'), cena = +(val(s, 'price').match(/<price>([\d.]+)/) || [])[1];
    return [val(p, 'pckId'), { nazev: val(p, 'name'), cena: cena >= 0 ? cena : null, jednotka: PCU[val(val(p, 'unit'), 'pcuId')] || 'pobyt', web: val(s, 'display') === 'true' }];
  }));
});

/** Ceny a obsazenost z Previo pro termín (sdílené pro různé počty hostů – kombinace apartmánů). */
const previoTermin = (r, od, doo) => memo(`t:${r.id}:${od}:${doo}`, 60e3, async () => {
  const [xml, kal, kat, info] = await Promise.all([
    previo(r, M.ceny, `<term><from>${od}</from><to>${doo}</to></term>`),
    previoRest(r, `calendar/availability?filterFrom=${od}&filterTo=${plusDen(doo, -1)}`),
    kategorie(r).catch(() => ({})),
    hotelInfo(r).catch(() => ({})),
  ]);
  const plan = tags(xml, 'ratePlan')[0] || '';
  const sezony = tags(plan, 'season').map(s => ({
    od: val(s, 'from'), do: val(s, 'to'),
    minStay: +val(s, 'minStay') || 0, cta: val(s, 'closeToArrival') === 'true', ctd: val(s, 'closeToDeparture') === 'true',
    typy: Object.fromEntries(tags(s, 'objectKind').map(k => [val(k, 'obkId'),
      Object.fromEntries(tags(k, 'rate').map(q => [+val(q, 'occupancy'), +val(q, 'price')]))])),
    strava: tags(s, 'meal').reduce((o, m) => { const id = val(m, 'meaId'); (o[id] = o[id] || {})[val(m, 'guaId')] = +val(m, 'price'); return o; }, {}),
  }));
  const plan0 = (Array.isArray(kal) ? kal : []).find(p => p.ratePlanId === +val(plan, 'prlId')) || (Array.isArray(kal) ? kal[0] : null);
  const volno = {};
  for (const den of (plan0 && plan0.availability) || []) {
    if (den.date < od || den.date >= doo) continue;
    for (const k of den.roomKinds || []) volno[k.id] = Math.min(volno[k.id] ?? Infinity, +k.availability || 0);
  }
  return { sezony, volno, kat, info };
});

/** Volné typy apartmánů a jejich sazby pro termín (živě z Previo). Stejný tvar jako nabidkaCenik v cena.mjs. */
export async function nabidka(r, { od, doo, dospeli, deti, bal, sazby: sazbyCms, strava: stravaCms }) {
  const { sezony, volno, kat, info } = await previoTermin(r, od, doo);
  // příjezd dnes až do uzávěrky online rezervací (Previo „maxOnlineBookTime“, u ČD 18:00)
  const ted = praha();
  if (info.uzaverka && od === ted.slice(0, 10) && ted.slice(11, 16) >= info.uzaverka) return [];
  const noci = [];
  for (let d = od; d < doo; d = plusDen(d)) noci.push(sezony.find(s => s.od <= d && d < s.do));
  if (!noci.length || noci.some(s => !s)) return [];
  // omezení z Previo: minimální délka pobytu (podle sezóny příjezdu), zákaz příjezdu / odjezdu
  if (noci.length < noci[0].minStay || noci[0].cta) return [];
  const odjezd = sezony.find(s => s.od <= doo && doo < s.do);
  if (odjezd && odjezd.ctd) return [];

  const osob = dospeli + deti, SL = (r.R.sleva_primo || 0) / 100;
  const ad = kat.dospely, ch = kat.dite;
  // příplatek stravy za noc pro celou skupinu (vůči výchozí stravě hotelu); null = strava v té noci není
  const strava = (s, mea) => {
    const m = s.strava[mea];
    if (!m) return null;
    const pr = g => (g && g in m ? m[g] : Object.values(m)[0] || 0);
    return pr(ad) * dospeli + (ch ? pr(ch) : pr(ad)) * deti;
  };
  return r.R.typy.filter(t => t.previo_id && (volno[t.previo_id] || 0) > 0).map(t => {
    const a = r.A.find(p => p.nazev === t.nazev);
    if (!a) return null;
    const obk = String(t.previo_id);
    // ubytování bez stravy (cena za obsazenost + sleva za „bez stravy“) a strava zvlášť – sleva sazby se počítá jen z ubytování
    let ubyt = 0;
    for (const s of noci) {
      const c = (s.typy[obk] || {})[osob];
      if (!(c > 0)) return null;                         // pro tolik hostů typ nemá cenu = nevejdou se
      ubyt += c + (strava(s, MEA.bez) ?? 0);
    }
    const stravaZa = typ => { let k = 0; for (const s of noci) { const p = strava(s, MEA[typ]), b = strava(s, MEA.bez); if (p == null) return null; k += p - (b ?? 0); } return k; };
    // balíček: ubytování + strava balíčku (polopenze / snídaně, výchozí snídaně) z Previo + příplatek za služby z CMS
    const balStrava = bal ? (bal.strava || 'snidane') : null, balK = bal ? (balStrava === 'bez' ? 0 : stravaZa(balStrava)) : null;
    const rates = bal
      ? (balK == null ? [] : [{ id: 'balicek', nazev: bal.nazev, popis: (bal.obsahuje || []).slice(1, 4).join(' · '), cena: ubyt + balK + (bal.priplatek || 0), strava: 'balicek', nevratna: false, meaId: MEA[balStrava] }])
      : sazbyCms.map(s => {
        const typ = stravaCms(s), k = typ === 'bez' ? 0 : stravaZa(typ);
        if (k == null) return null;                         // strava v termínu není (např. polopenze až od 1. 12.)
        return { id: s.id, nazev: s.nazev, popis: s.popis || '', cena: ubyt * (1 - (+s.sleva || 0) / 100) + k, strava: typ, nevratna: jeNevratna(s), sleva: +s.sleva || 0, meaId: MEA[typ] };
      }).filter(Boolean);
    return { id: t.nazev, previo: obk, nazev: t.nazev, foto: a.foto || (a.fotky || [])[0], osoby: String(a.osoby || ''), plocha: a.plocha, popis: a.popis, volno: volno[obk],
      sazby: rates.map(q => ({ ...q, portal: q.cena, cena: q.cena * (1 - SL) })) };
  }).filter(t => t && t.sazby.length);
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
  const { checkin, checkout } = await casyHotelu(r);
  // typ apartmánu = název z CMS (nebo rovnou obkId) → obkId z Previo
  const obk = v => (r.R.typy.find(t => t.nazev === v || String(t.previo_id) === String(v)) || {}).previo_id || v;
  const note = [`Web – rezervace napřímo (−${r.R.sleva_primo || 0} %), objednávka ${d.obj || ''}`,
    d.zpusob === 'karta' ? `Platba kartou online${d.brana ? ` (${d.brana})` : ''}` : d.zpusob === 'prevod' ? 'Platba převodem – zálohový list' : '',
    (d.doplnky || []).length ? 'Doplňky: ' + d.doplnky.join(', ') : '', h.poznamka].filter(Boolean).join(' | ');
  const inner = `<newReservation>
    <commissions>${(d.pokoje && d.pokoje.length ? d.pokoje : [{ typ: d.typ, dospeli: d.dospeli, deti: d.deti }]).map((p, i) => `<commission>
      <guests><numGuest>${(+p.dospeli || 1) + (+p.deti || 0)}</numGuest>
        ${i === 0 ? `<guest><firstName>${x(h.jmeno)}</firstName><lastName>${x(h.prijmeni)}</lastName><email>${x(h.email)}</email><phone>${x(h.telefon)}</phone></guest>` : ''}
      </guests>
      <obkId>${x(obk(p.typ))}</obkId>${d.sazba && /^\d+$/.test(d.sazba) ? `<prlId>${x(d.sazba)}</prlId>` : ''}${d.meaId ? `<meaId>${x(d.meaId)}</meaId>` : ''}${d.stayId ? `<styId>${x(d.stayId)}</styId>` : ''}<cmsId>3</cmsId>
      <note>${x(d.pokoje && d.pokoje.length > 1 ? `Skupina – apartmán ${i + 1}/${d.pokoje.length}. ${note}` : note)}</note>
    </commission>`).join('')}</commissions>
    <gCosId>${stav}</gCosId>${stav === OPCE && opceDo ? `<optionExpiration>${pragueTime(opceDo)}</optionExpiration>` : ''}
    <lanId>1</lanId>
    <term><from>${d.od} ${checkin}:00</from><to>${d.do} ${checkout}:00</to></term>
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
const kc = n => Math.round(n).toLocaleString('cs-CZ') + ' Kč';
/**
 * Zápis přijaté online platby (kartou přes platební bránu) do Previo.
 *
 * REST invoice/addPayment nepřijímá částku – zaplatí VŠECHNY neuhrazené položky rezervace a vystaví k nim doklad.
 * Proto ho voláme jen tehdy, když host zaplatil celou cenu (záloha 100 %, nevratná sazba).
 * Při záloze (např. 30 %) by Previo ukázalo zaplacenou celou rezervaci a doklad na celou cenu. Místo toho se do rezervace
 * zapíše poznámka o přijaté záloze (gNote) a recepce zálohu zaúčtuje v Previo (dostane upozornění s částkou).
 *
 * p = { resId, castka (zaplaceno, Kč), cena (celkem, Kč), obj (číslo objednávky webu), brana (název brány) }
 * → { zpusob: 'doklad', invId } | { zpusob: 'poznamka' }
 */
export async function zapisPlatbu(r, { resId, castka, cena, obj, brana }) {
  if (+castka >= +cena - 1) {
    const j = await previoRest(r, 'invoice/addPayment?pdf=false', {
      method: 'POST', body: { intId: +(process.env.PREVIO_DOKLAD_KARTA || DOKLAD.zalohovy), resId: +resId, comId: null, gueId: null, payId: PAY.online },
    });
    return { zpusob: 'doklad', invId: (j && j.invId) || null };
  }
  const kdy = new Date().toLocaleString('cs-CZ', { timeZone: 'Europe/Prague', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const text = `ZÁLOHA ZAPLACENA ${kc(castka)} kartou online${brana ? ` (${brana})` : ''} ${kdy}, objednávka web ${obj || ''}. ` +
    `Doplatek ${kc(cena - castka)} na místě. Zálohu zaúčtovat v účtu rezervace.`;
  await previo(r, M.rezervace, `<newReservation><resId>${x(resId)}</resId><gNote>${x(text)}</gNote></newReservation>`);
  return { zpusob: 'poznamka' };
}
/**
 * Vystaví zálohový list (proformu) pro platbu převodem. Vrací { invId, pdf (base64) }.
 * Stejná funkce jako u karty (invoice/addPayment) – bere všechny neuhrazené položky, takže jen pro platbu celé ceny.
 * Volá se jen s PREVIO_ZALOHOVY_LIST=1. OVĚŘIT na testovacím hotelu, že proforma rezervaci neoznačí jako zaplacenou.
 */
export const zalohovyList = (r, resId) => previoRest(r, 'invoice/addPayment?pdf=true', {
  method: 'POST', body: { intId: DOKLAD.proforma, resId: +resId, comId: null, gueId: null, payId: PAY.prevod },
});
