// Platba rezervace (všechny resorty) – kartou (ČSOB) nebo převodem (zálohový list), stejně jako formulář Previo.
//
// GET  /.netlify/functions/platba?resort=…            → { karta, prevod, zaloha_procent, test } – co web nabídne
// POST /.netlify/functions/platba  { resort, od, do, dospeli, deti, typ, sazba, balicek, doplnky, host, zpusob: 'karta'|'prevod' }
//      → karta:  { ok, obj, t, presmerovani }   (prohlížeč pak přejde na platební stránku ČSOB)
//      → převod: { ok, obj, t, zaloha, splatnost, vs, ucet }
// GET  /.netlify/functions/platba?obj=…&t=…          → stav objednávky (u čekající platby se zeptá brány)
// GET  /.netlify/functions/platba?obj=…&t=…&doklad=1 → zálohový list v PDF (jen s PREVIO_ZALOHOVY_LIST=1)
// POST /.netlify/functions/platba  { obj, t, znovu: true } → nový pokus o platbu kartou
//
// Cena se vždy počítá znovu na serveru (netlify/lib/cena.mjs). Nastavení v CMS: <resort>/data/rezervace.json → platba.
// Objednávka si pamatuje resort (o.resort) – podle něj se volá jeho Previo, Reservio a vrací se na jeho stránku.
import { resort } from '../lib/resorty.mjs';
import { spocitejCenu, Chyba } from '../lib/cena.mjs';
import { csobZapnuto, csobEnv, zalozPlatbu, platebniStranka, stavPlatby } from '../lib/csob.mjs';
import { previoLive, vytvorRezervaci, zalohovyList, previoRest, platebniPodminky, OPCE } from '../lib/previo.mjs';
import { nactiObjednavku, ulozObjednavku, noveCislo, cisloPlatby, token } from '../lib/objednavky.mjs';
import { vyrid, upozorni, overCasy, rezervujWellness, kolikZbyva, wellnessText } from '../lib/vyrizeni.mjs';
import { reservioZapnuto, reservioDemo } from '../lib/reservio.mjs';

const P = r => ({ karta: true, prevod: true, zaloha_procent: 100, prevod_splatnost_dni: 3, ucet: '', ...(r.R.platba || {}) });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const test = () => csobEnv() === 'test';
// karta: musí být klíče od ČSOB. Ostrou platbu bereme jen se zapnutým Previo (jinak by se platilo za nepotvrzenou dostupnost).
const kartaOk = r => P(r).karta && csobZapnuto() && (previoLive(r) || test());
const prevodOk = r => !!P(r).prevod;
const plus = (dny, h = 0) => new Date(Date.now() + dny * 864e5 + h * 36e5);
const dnes = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Prague' });
const denPred = (iso, n) => new Date(Date.parse(iso + 'T12:00Z') - n * 864e5).toISOString().slice(0, 10);
/**
 * Platební podmínky pro termín. Se zapnutým Previo z Previo (Hotel.getPaymentMethods: povolené způsoby, záloha, splatnost),
 * jinak z CMS (rezervace.json → platba). Texty, účet a vypnutí způsobu v CMS platí vždy.
 * → { karta, prevod, zaloha_karta, zaloha_prevod (%), zaloha_karta_kc, zaloha_prevod_kc (pevná záloha), prevod_splatnost_dni, zdroj }
 */
async function podminkyPlatby(r, od, doo) {
  const p = P(r), z = +p.zaloha_procent || 100;
  const cms = { ...p, zaloha_karta: z, zaloha_prevod: z, prevod_splatnost_dni: +p.prevod_splatnost_dni || 3, zdroj: 'cms' };
  if (!previoLive(r) || !od || !doo) return cms;
  try {
    const q = await platebniPodminky(r, od, doo);
    return { ...p, karta: !!p.karta && !!q.karta, prevod: !!p.prevod && !!q.prevod,
      zaloha_karta: q.karta ? q.karta.procent : 100, zaloha_karta_kc: q.karta && q.karta.castka, zaloha_prevod: q.prevod ? q.prevod.procent : 100, zaloha_prevod_kc: q.prevod && q.prevod.castka,
      prevod_splatnost_dni: (q.prevod && q.prevod.dni) || cms.prevod_splatnost_dni, zdroj: 'previo' };
  } catch (e) { console.error(`Platební podmínky z Previo (${r.id}):`, e.message); return cms; }
}
/** Záloha v Kč: nevratná sazba se platí celá, jinak % nebo pevná částka podle způsobu platby. */
const vyseZalohy = (pp, zpusob, cena, nevratna) => {
  if (nevratna) return cena;
  const kc = pp[`zaloha_${zpusob}_kc`], pct = pp[`zaloha_${zpusob}`];
  const z = kc > 0 ? kc : cena * Math.min(Math.max(pct == null ? 100 : +pct, 1), 100) / 100;
  return Math.max(1, Math.min(cena, Math.round(z)));
};
/** Splatnost zálohy převodem: za X dní (Previo / CMS), ale nejpozději den před příjezdem. null = na převod je pozdě (příjezd dnes/zítra). */
const splatnostPrevodu = (dni, od) => {
  const s = [plus(+dni || 3).toLocaleDateString('sv-SE', { timeZone: 'Europe/Prague' }), denPred(od, 1)].sort()[0];
  return s > dnes() ? s : null;
};

const verejne = o => { const r = resort(o.resort); return {
  resort: r.id, obj: o.obj, stav: o.stav, zpusob: o.zpusob, cena: o.pobyt.cena, zaloha: o.zaloha, apartman: o.pobyt.apartman, od: o.pobyt.od, do: o.pobyt.do,
  cislo: o.previo && (o.previo.voucher || o.previo.resId), splatnost: o.splatnost, vs: o.obj, ucet: P(r).ucet, doklad: !!(o.previo && o.previo.invId),
  wellnessTip: o.pobyt.doplnky.some(x => /wellness/.test(x.id)), late: o.pobyt.doplnky.some(x => x.id === 'late'),
  // wellness k pobytu: kolik vstupů je zaplaceno, jaké časy jsou zarezervované a kolik jich jde ještě vybrat na webu
  wellness: (o.wellness || []).map(w => ({ id: w.id, nazev: w.nazev, ks: w.ks, resort: w.resort || o.resort || 'cerveny-dvur', doplnek: w.doplnek || w.id, prani: w.prani, zbyva: kolikZbyva(w), casy: w.casy.filter(c => c.stav !== 'chyba').map(c => ({ start: c.start, end: c.end, stav: c.stav, test: c.test })) })),
  wellnessOnline: reservioZapnuto(r) && ['zaplaceno', 'ceka_na_prevod'].includes(o.stav), wellnessDemo: reservioDemo(r),
  jmeno: o.host.jmeno, email: o.host.email, test: o.test, // stav vidí jen ten, kdo má tajný token z odkazu
}; };

async function zaplatKartou(o) {
  const orderNo = cisloPlatby(o);
  const p = o.pobyt;
  const popis = `${p.apartman}, ${p.od.slice(8)}.${p.od.slice(5, 7)}.–${p.do.slice(8)}.${p.do.slice(5, 7)}.${p.do.slice(0, 4)}`;
  const { payId } = await zalozPlatbu({
    orderNo, castka: o.zaloha, returnUrl: o.web + '/.netlify/functions/platba-navrat',
    polozky: [{ nazev: o.zaloha < p.cena ? 'Záloha na pobyt' : 'Pobyt ' + resort(o.resort).nazev.replace(/^Resort /, ''), popis, castka: o.zaloha }],
    zakaznik: { jmeno: `${o.host.jmeno} ${o.host.prijmeni}`, email: o.host.email, telefon: o.host.telefon },
    merchantData: o.obj,
  });
  o.payId = payId; o.pokusy = (o.pokusy || 0) + 1; o.stav = 'ceka_na_platbu';
  o.platby.push({ orderNo, payId, zalozeno: new Date().toISOString() });
  await ulozObjednavku(o);
  return platebniStranka(payId);
}

async function nova(req, d) {
  const r = resort(d.resort);
  const zpusob = d.zpusob === 'karta' ? 'karta' : d.zpusob === 'prevod' ? 'prevod' : null;
  const datum = s => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s : null);
  const pp = await podminkyPlatby(r, datum(d.od), datum(d.do));
  if (!zpusob || (zpusob === 'karta' && !(kartaOk(r) && pp.karta)) || (zpusob === 'prevod' && !(prevodOk(r) && pp.prevod))) throw new Chyba('Tento způsob platby není dostupný');
  if (zpusob === 'prevod' && datum(d.od) && !splatnostPrevodu(pp.prevod_splatnost_dni, d.od)) throw new Chyba('Do příjezdu je málo času na bankovní převod. Zaplaťte prosím kartou, nebo nám zavolejte.');
  const h = d.host || {};
  const host = Object.fromEntries(['jmeno', 'prijmeni', 'email', 'telefon', 'poznamka', 'firma', 'ico'].map(k => [k, String(h[k] || '').trim().slice(0, k === 'poznamka' ? 1000 : 120)]));
  if (!host.jmeno || !host.prijmeni || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(host.email) || !host.telefon) throw new Chyba('Vyplňte prosím jméno, příjmení, e-mail a telefon');
  if (!h.souhlas) throw new Chyba('Je potřeba souhlas s obchodními a storno podmínkami');

  const pobyt = await spocitejCenu(r, d);
  const zaloha = vyseZalohy(pp, zpusob, pobyt.cena, pobyt.nevratna);
  const o = {
    obj: await noveCislo(), t: token(), resort: r.id, stav: 'nova', zpusob, web: new URL(req.url).origin, vytvoreno: new Date().toISOString(),
    pobyt, zaloha, host, previo: null, platby: [], chyby: [], test: zpusob === 'karta' && test(),
    splatnost: zpusob === 'prevod' ? splatnostPrevodu(pp.prevod_splatnost_dni, pobyt.od) : undefined,
  };
  // wellness napojené na Reservio: zaplacené vstupy + časy, které host vybral už v kroku Doplňky
  const wd = pobyt.doplnky.filter(x => x.reservio || /wellness/.test(x.id)); // wellness evidujeme i bez Reservio (kvůli přání času)
  if (wd.length) {
    // „prani“ = co host napsal do „Kdy byste chtěli do wellness?“ (když výběr z Reservio není k dispozici)
    // resort/doplnek = wellness v jiném resortu (křížový prodej)
    o.wellness = wd.map(x => ({ id: x.id, nazev: x.nazev, serviceId: x.reservio, ks: x.ks, resort: x.resort, doplnek: x.doplnek, casy: [], prani: String((d.wellnessPrani || {})[x.id] || '').trim().slice(0, 200) || undefined }));
    for (const w of o.wellness) if (reservioZapnuto(resort(w.resort || r.id))) {
      const starty = [].concat((d.wellness && d.wellness[w.id]) || []).filter(Boolean).slice(0, w.ks);
      if (starty.length) try { w.casy = await overCasy(o, w, starty); } catch (e) { o.chyby.push('Wellness časy: ' + e.message); }
    }
  }
  // zápis do Previo jako opce – potvrdí se po zaplacení (karta) / po přijetí zálohy (převod, ručně nebo automaticky v Previo)
  if (previoLive(r)) {
    o.previo = await vytvorRezervaci(r, { ...pobyt, doplnky: pobyt.doplnky.map(x => x.nazev + (x.ks > 1 ? ` ×${x.ks}` : '')).concat(o.wellness ? ['Wellness: ' + wellnessText(o)] : []), host, obj: o.obj, zpusob },
      { stav: OPCE, opceDo: zpusob === 'karta' ? plus(1) : new Date(o.splatnost + 'T23:59:00') });
  }
  await ulozObjednavku(o);

  if (zpusob === 'karta') return json({ ok: true, obj: o.obj, t: o.t, presmerovani: await zaplatKartou(o) });

  o.stav = 'ceka_na_prevod';
  if (o.previo && process.env.PREVIO_ZALOHOVY_LIST === '1') {
    try { const z = await zalohovyList(r, o.previo.resId); o.previo.invId = z.invId; } catch (e) { o.chyby.push('Zálohový list: ' + e.message); }
  }
  await ulozObjednavku(o);
  await rezervujWellness(o); // u převodu časy podržíme hned (hradí se v rámci zálohy)
  await upozorni(o, 'Nová rezervace – platba převodem, poslat / zkontrolovat zálohový list');
  return json({ ok: true, ...verejne(o), t: o.t });
}

export default async (req) => {
  try {
    if (req.method === 'GET') {
      const u = new URL(req.url).searchParams;
      if (!u.get('obj')) {
        // ?od=&do= → podmínky pro konkrétní termín (z Previo), bez termínu obecné z CMS
        const r = resort(u.get('resort')), d = s => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s : null);
        const p = await podminkyPlatby(r, d(u.get('od')), d(u.get('do')));
        const karta = kartaOk(r) && !!p.karta;
        return json({ karta, prevod: prevodOk(r) && !!p.prevod, prevod_min_dni: 2, prevod_splatnost_dni: p.prevod_splatnost_dni,
          zaloha_karta: p.zaloha_karta, zaloha_karta_kc: p.zaloha_karta_kc || null, zaloha_prevod: p.zaloha_prevod, zaloha_prevod_kc: p.zaloha_prevod_kc || null,
          zaloha_procent: p.zaloha_prevod, zdroj: p.zdroj, test: test() && karta, text_karta: p.text_karta, text_prevod: p.text_prevod });
      }
      const o = await nactiObjednavku(u.get('obj'));
      if (!o || o.t !== u.get('t')) return json({ chyba: 'Objednávka nenalezena' }, 404);
      if (u.get('doklad')) {
        if (!o.previo || !o.previo.invId) return json({ chyba: 'Doklad není k dispozici' }, 404);
        const { pdf } = await previoRest(resort(o.resort), `billing/documents/print?invId=${encodeURIComponent(o.previo.invId)}`);
        return new Response(Buffer.from(pdf, 'base64'), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="zalohovy-list-${o.obj}.pdf"` } });
      }
      // host zavřel okno brány dřív, než se vrátil – stav zjistíme přímo z brány
      if (o.stav === 'ceka_na_platbu' && o.payId) {
        try { const s = await stavPlatby(o.payId); await vyrid(o, s.paymentStatus, s.authCode); } catch (e) { console.error(e); }
      }
      return json(verejne(o));
    }
    if (req.method === 'POST') {
      const d = await req.json().catch(() => ({}));
      if (d.wellnessCas) {
        // dodatečný výběr času wellness z děkovné stránky – jen do počtu zaplacených vstupů
        const o = await nactiObjednavku(d.obj);
        if (!o || o.t !== d.t) return json({ ok: false, chyba: 'Objednávka nenalezena' }, 404);
        const w = (o.wellness || []).find(x => x.id === d.doplnek);
        if (!w || !reservioZapnuto(resort(w.resort || o.resort)) || !['zaplaceno', 'ceka_na_prevod'].includes(o.stav)) throw new Chyba('Čas wellness teď nejde vybrat online. Zavolejte prosím na recepci.');
        if (kolikZbyva(w) < 1) throw new Chyba('Všechny zaplacené vstupy do wellness už máte zarezervované.');
        const nove = await overCasy(o, w, [d.wellnessCas]);
        if (!nove.length) throw new Chyba('Tento čas už není volný. Vyberte prosím jiný.');
        w.casy.push(...nove);
        await rezervujWellness(o);
        if (nove[0].stav === 'chyba') throw new Chyba('Tento čas už mezitím někdo obsadil. Vyberte prosím jiný.');
        return json({ ok: true, ...verejne(o) });
      }
      if (d.znovu) {
        const o = await nactiObjednavku(d.obj);
        if (!o || o.t !== d.t || o.zpusob !== 'karta') return json({ ok: false, chyba: 'Objednávka nenalezena' }, 404);
        if (o.stav === 'zaplaceno') return json({ ok: true, ...verejne(o) });
        if (!kartaOk(resort(o.resort))) throw new Chyba('Platba kartou teď není dostupná');
        return json({ ok: true, obj: o.obj, t: o.t, presmerovani: await zaplatKartou(o) });
      }
      return await nova(req, d);
    }
    return json({ chyba: 'Metoda není podporovaná' }, 405);
  } catch (e) {
    if (e instanceof Chyba) return json({ ok: false, chyba: e.message }, 400);
    console.error(e);
    return json({ ok: false, chyba: 'Rezervaci se teď nepodařilo dokončit.' }, 502);
  }
};
