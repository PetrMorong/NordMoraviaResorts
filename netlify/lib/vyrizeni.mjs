// Co se stane, když se změní stav platby: zápis do Previo + upozornění recepci (Netlify formulář „platba“).
import { ZAPLACENO, NEZDARENO, VRACENO } from './csob.mjs';
import { previoLive, zmenStav, zapisPlatbu, POTVRZENO } from './previo.mjs';
import { ulozObjednavku } from './objednavky.mjs';
import { resort } from './resorty.mjs';

import { reservioZapnuto, jeVolno, rezervuj } from './reservio.mjs';
import { casyPobytu, den, cas } from './wellness.mjs';

// ---- wellness k pobytu (Reservio) ----
// o.wellness = [{ id, nazev, serviceId, ks, casy: [{ start, end, stav: 'vybrano'|'rezervovano'|'chyba', reservioId, chyba }] }]
export const kolikZbyva = w => w.ks - w.casy.filter(c => c.stav !== 'chyba').length;
const casText = c => `${new Date(c.start).toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague', weekday: 'short', day: 'numeric', month: 'numeric' })} ${cas(c.start)}`;
export const wellnessText = o => (o.wellness || []).map(w => `${w.nazev} ×${w.ks}: ${w.casy.filter(c => c.stav !== 'chyba').map(c => casText(c) + (c.stav === 'rezervovano' ? ' ✓' : ' (čeká)')).join(', ') || (w.prani ? 'přání hosta: ' + w.prani : 'čas zatím nevybrán')}${kolikZbyva(w) > 0 && w.casy.length ? `, zbývá vybrat ${kolikZbyva(w)}` : ''}`).join(' | ');

/** Ověří, že vybrané časy patří do pobytu a jsou volné. Vrací jen platné (nejvýš tolik, kolik je zaplacených vstupů). */
export async function overCasy(o, w, starty) {
  const late = o.pobyt.doplnky.some(x => x.id === 'late');
  // wellness může být i v jiném resortu (w.resort / w.doplnek – křížový prodej)
  const dny = (await casyPobytu(resort(w.resort || o.resort), w.doplnek || w.id, o.pobyt.od, o.pobyt.do, late)) || [];
  const volne = dny.flatMap(d => d.casy);
  const obsazene = new Set(w.casy.filter(c => c.stav !== 'chyba').map(c => +new Date(c.start)));
  const out = [];
  for (const s of starty) {
    const slot = volne.find(v => +new Date(v.start) === +new Date(s));
    if (slot && !obsazene.has(+new Date(s)) && out.length < kolikZbyva(w)) { out.push({ start: slot.start, end: slot.end, stav: 'vybrano' }); obsazene.add(+new Date(s)); }
  }
  return out;
}

/** Zarezervuje v Reservio vybrané časy – zdarma, s poznámkou, že je wellness uhrazené v rámci pobytu. */
export async function rezervujWellness(o) {
  if (!o.wellness) return;
  const ubyt = resort(o.resort);
  const cislo = o.previo && (o.previo.voucher || o.previo.resId);
  for (const w of o.wellness) for (const c of w.casy.filter(c => c.stav === 'vybrano')) {
    // wellness v jiném resortu (křížový prodej) se rezervuje v Reservio toho resortu
    const r = resort(w.resort || o.resort);
    if (!reservioZapnuto(r)) continue;
    const poznamka = [o.zpusob === 'prevod' && o.stav !== 'zaplaceno' ? 'Hradí se v rámci zálohy na pobyt (převodem)' : 'Uhrazeno v rámci pobytu',
      r.id !== ubyt.id ? `host ubytovaný v ${ubyt.nazev}` : '', cislo ? `rezervace Previo č. ${cislo}` : '', `objednávka web ${o.obj}`, `pobyt ${o.pobyt.od} – ${o.pobyt.do}, ${o.pobyt.apartman}`].filter(Boolean).join(' · ');
    try {
      if (!(await jeVolno(r, w.serviceId, c.start))) throw new Error('čas už je obsazený');
      const b = await rezervuj(r, { serviceId: w.serviceId, start: c.start, end: c.end, jmeno: `${o.host.jmeno} ${o.host.prijmeni}`, email: o.host.email, telefon: o.host.telefon, poznamka, cena: 0 });
      Object.assign(c, { stav: 'rezervovano', reservioId: b.id, test: b.stav === 'demo' || undefined }); // test = do Reservio se nezapsalo (ukázka / RESERVIO_JEN_CIST)
    } catch (e) {
      Object.assign(c, { stav: 'chyba', chyba: e.message });
      (o.chyby ||= []).push(`Wellness ${casText(c)}: ${e.message}`);
    }
  }
  await ulozObjednavku(o);
}

export const stavZBrany = ps => (ZAPLACENO.includes(ps) ? 'zaplaceno' : NEZDARENO.includes(ps) ? 'nezaplaceno' : VRACENO.includes(ps) ? 'vraceno' : 'ceka_na_platbu');
const kc = n => Math.round(n).toLocaleString('cs-CZ') + ' Kč';

/** Upozornění recepci – jde do Netlify Forms (e-mail podle nastavení v Netlify), lokálně jen do konzole. */
export async function upozorni(o, udalost) {
  const p = o.pobyt, h = o.host;
  const fields = {
    // Netlify formulář pro upozornění: Červený dvůr „platba“, ostatní „platba-<resort>“ (každý resort jiná recepce)
    'form-name': !o.resort || o.resort === 'cerveny-dvur' ? 'platba' : `platba-${o.resort}`, objednavka: o.obj, resort: resort(o.resort).nazev, udalost, stav: o.stav, zpusob: o.zpusob === 'karta' ? 'kartou online' : 'převodem',
    castka: kc(o.zaloha), host: `${h.jmeno} ${h.prijmeni}`, email: h.email, telefon: h.telefon,
    pobyt: `${p.od} – ${p.do} (${p.noci} nocí) · ${p.apartman} · ${p.sazbaNazev} · ${p.dospeli} dosp. + ${p.deti} dětí · celkem ${kc(p.cena)}`,
    previo: o.previo ? `rezervace ${o.previo.voucher || o.previo.resId}` : 'nezapsáno – zapsat ručně',
    wellness: wellnessText(o),
    chyby: (o.chyby || []).slice(-3).join(' | '), test: o.test ? 'TESTOVACÍ PLATBA' : '',
  };
  try {
    const res = await fetch(o.web + '/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString(), signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
  } catch (e) { console.error('Upozornění recepci se nepovedlo', o.obj, e.message); }
}

/** Promítne stav platby z brány do objednávky (idempotentní – opakované volání nic nezdvojí). */
export async function vyrid(o, paymentStatus, authCode) {
  const novy = stavZBrany(paymentStatus);
  const posledni = o.platby[o.platby.length - 1];
  if (posledni) { posledni.paymentStatus = paymentStatus; if (authCode) posledni.authCode = authCode; }
  if (o.stav === novy || o.stav === 'zaplaceno') return ulozObjednavku(o);
  o.stav = novy;
  if (novy === 'zaplaceno') {
    o.zaplaceno = new Date().toISOString();
    const r = resort(o.resort);
    if (o.previo && previoLive(r)) {
      try { await zmenStav(r, o.previo.resId, POTVRZENO); o.previo.potvrzeno = true; } catch (e) { (o.chyby ||= []).push('Previo potvrzení: ' + e.message); }
      try { await zapisPlatbu(r, o.previo.resId); o.previo.platba = true; } catch (e) { (o.chyby ||= []).push('Previo platba: ' + e.message); }
    }
    await rezervujWellness(o); // vybrané časy wellness až po zaplacení
  }
  await ulozObjednavku(o);
  if (novy === 'zaplaceno' || novy === 'nezaplaceno') await upozorni(o, novy === 'zaplaceno' ? 'Platba kartou proběhla' : 'Platba kartou neproběhla – kontaktovat hosta');
  return o;
}
