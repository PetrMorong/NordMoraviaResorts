// Nabídka a cena pobytu – počítá se jen tady na serveru (cenu z prohlížeče nikdy nebereme).
// Živě z Previo (PREVIO_LIVE), jinak z ceníku v CMS: <resort>/data/rezervace.json.
//
// Ceník v CMS:
//   typy[]   – { nazev (= název v apartmany.json), previo_id, cena_noc, ceny_osoby?: [{ osob, cena }], max_osob }
//              ceny_osoby = cena za noc podle obsazenosti („do N osob“), jinak platí cena_noc
//   sazby[]  – { id, nazev, popis, sleva (%), strava_osoba_noc (Kč za dospělého a noc), snidane (bool – starší zápis = snidane_osoba_noc) }
//              např. Flexibilní bez stravy / se snídaní / s polopenzí, Nevratná −10 % (sleva jen z ubytování, strava se platí celá).
//              Sazba s vyplněným, ale nulovým/prázdným strava_osoba_noc se nenabízí (např. polopenze, dokud nemá cenu).
//   sleva_primo – % sleva za přímou rezervaci (cena v ceníku = cena na portálech)
import { Chyba, resort } from './resorty.mjs';
import { previoLive, nabidka } from './previo.mjs';
import { sluzbaId, cenyZReservio } from './wellness.mjs';

export { Chyba };
const date = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s : null;
const noci = (a, b) => Math.round((new Date(b + 'T12:00Z') - new Date(a + 'T12:00Z')) / 864e5);
const dnes = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Prague' });

// sazby, když je CMS nemá (Červený dvůr před zavedením pole „sazby“)
const VYCHOZI_SAZBY = [
  { id: 'snidane', nazev: 'Se snídaní', popis: 'Bohatá snídaně každé ráno · storno zdarma do 1 dne', snidane: true },
  { id: 'bez', nazev: 'Bez snídaně', popis: 'Jen ubytování · storno zdarma do 1 dne' },
];
/** Sazby resortu, které jde pro pobyt od data `od` nabídnout (sazba se stravou bez ceny se vynechá;
 *  plati_od / plati_do = jen pro pobyty s příjezdem v tom období, např. polopenze až od 1. 12.). */
export const sazbyResortu = (r, od) => (r.R.sazby && r.R.sazby.length ? r.R.sazby : VYCHOZI_SAZBY)
  .filter(s => !('strava_osoba_noc' in s) || s.strava_osoba_noc === 0 || +s.strava_osoba_noc > 0)
  .filter(s => !od || ((!s.plati_od || od >= String(s.plati_od).slice(0, 10)) && (!s.plati_do || od <= String(s.plati_do).slice(0, 10))));
/** Strava za dospělého a noc pro sazbu (Kč). */
export const stravaSazby = (r, s) => (+s.strava_osoba_noc > 0 ? +s.strava_osoba_noc : s.snidane ? (r.R.snidane_osoba_noc || 0) : 0);

/** Typ stravy sazby pro ikonku: 'bez' | 'snidane' | 'polopenze' (pole strava v CMS, jinak podle názvu a ceny stravy). */
export const typStravy = (s, kc = 0) => s.strava || (/polopenz|half.?board/i.test(s.id + ' ' + s.nazev) ? 'polopenze' : kc > 0 || s.snidane || /sn[ií]dan|breakfast/i.test(s.nazev) && !/bez sn/i.test(s.nazev) ? 'snidane' : 'bez');
/** Nevratná sazba (bez možnosti storna) – platí se jen kartou. */
export const jeNevratna = s => !!s.nevratna || /nevratn|non.?refund|bez mo[zž]nosti storna/i.test(s.id + ' ' + s.nazev + ' ' + (s.popis || ''));

/** Cena za noc podle počtu osob (ceny_osoby = „do N osob“), jinak cena_noc. */
export function cenaNoc(t, osob) {
  const tab = (t.ceny_osoby || []).filter(c => +c.osob > 0 && +c.cena > 0).sort((a, b) => a.osob - b.osob);
  const c = tab.find(x => osob <= +x.osob);
  return c ? +c.cena : tab.length && osob > tab[tab.length - 1].osob ? +tab[tab.length - 1].cena : +t.cena_noc || 0;
}
const osobyText = a => String(a.osoby || '');

/** Kontrola termínu a balíčku. */
function termin(r, d) {
  const od = date(d.od), doo = date(d.do);
  const dospeli = Math.min(Math.max(+d.dospeli || 1, 1), 12), deti = Math.min(Math.max(+d.deti || 0, 0), 10);
  if (!od || !doo || doo <= od) throw new Chyba('Neplatný termín');
  if (od < dnes()) throw new Chyba('Termín je v minulosti');
  const n = noci(od, doo);
  const bal = d.balicek ? (r.B || []).find(b => b.id === d.balicek && b.aktivni) : null;
  if (d.balicek && !bal) throw new Chyba('Balíček není dostupný');
  if (bal && (n < bal.noci_min || n > bal.noci_max)) throw new Chyba('Délka pobytu neodpovídá balíčku');
  if (!bal && r.R.min_noci && n < r.R.min_noci) throw new Chyba(`Minimální délka pobytu je ${r.R.min_noci} ${r.R.min_noci < 5 ? 'noci' : 'nocí'}`);
  return { od, doo, dospeli, deti, n, bal };
}

/** Nabídka z ceníku v CMS (stejný tvar jako živá nabídka z Previo). */
export function nabidkaCenik(r, { od, doo, dospeli, deti, n, bal }) {
  const SL = (r.R.sleva_primo || 0) / 100, osob = dospeli + deti;
  return r.R.typy.filter(t => (t.cena_noc || (t.ceny_osoby || []).length) && (t.max_osob || 2) >= osob).map(t => {
    const a = r.A.find(x => x.nazev === t.nazev);
    if (!a) return null;
    const base = cenaNoc(t, osob) * n;
    const rates = bal ? [{ id: 'balicek', nazev: bal.nazev, popis: (bal.obsahuje || []).slice(1, 4).join(' · '), cena: base + (bal.priplatek || 0), strava: 'balicek', nevratna: false }]
      : sazbyResortu(r, od).map(s => ({ id: s.id, nazev: s.nazev, popis: s.popis || '', cena: base * (1 - (+s.sleva || 0) / 100) + stravaSazby(r, s) * dospeli * n,
        strava: typStravy(s, stravaSazby(r, s)), nevratna: jeNevratna(s), sleva: +s.sleva || 0 }));
    return { id: t.nazev, nazev: t.nazev, foto: a.foto || (a.fotky || [])[0], osoby: osobyText(a), plocha: a.plocha, popis: a.popis, volno: null,
      sazby: rates.map(x => ({ ...x, portal: x.cena, cena: x.cena * (1 - SL) })) };
  }).filter(Boolean);
}

/** Nabídka jednotlivých apartmánů pro daný počet hostů (živě z Previo, jinak z ceníku). */
async function nabidkaPro(r, t) {
  if (previoLive(r)) return nabidka(r, { od: t.od, doo: t.doo, dospeli: t.dospeli, deti: t.deti, balicek: t.bal && t.bal.previo_stay_id });
  return nabidkaCenik(r, t);
}
const KOMBINACE_OD = 5; // od kolika hostů nabízet i dva apartmány (menší skupiny jen tehdy, když se nevejdou do jednoho)
const kusu = (r, live, typ) => (live ? +typ.volno || 0 : +((r.R.typy || []).find(x => x.nazev === typ.id) || {}).pocet || 1);

/**
 * Dva apartmány pro větší skupinu (např. 8 osob = 4 + 4). Vrací „typy“ se stejným tvarem jako apartmán,
 * id = 'combo:<typA>+<typB>', cena = součet obou, pokoje = rozdělení hostů. Nejvýš 3 nejlevnější kombinace.
 */
async function kombinace(r, t, live) {
  const osob = t.dospeli + t.deti;
  if (osob < 2 || t.bal) return [];
  const a = Math.ceil(osob / 2), b = osob - a;
  const da = Math.ceil(t.dospeli / 2), db = t.dospeli - da;                 // dospělí do obou apartmánů (strava se počítá za dospělé)
  const tA = { ...t, dospeli: Math.max(da, 1), deti: a - Math.max(da, 1) }, tB = { ...t, dospeli: Math.max(db, b ? 1 : 0), deti: b - Math.max(db, b ? 1 : 0) };
  if (tA.deti < 0 || tB.deti < 0 || tB.dospeli + tB.deti < 1) return [];
  const [A, B] = await Promise.all([nabidkaPro(r, tA), a === b && tA.dospeli === tB.dospeli ? null : nabidkaPro(r, tB)]);
  const BB = B || A;
  const out = [];
  A.forEach((x, i) => BB.forEach((y, j) => {
    if (B ? false : j < i) return;                                       // stejné obsazení: A+B = B+A
    if (x.id === y.id && kusu(r, live, x) < 2) return;                    // dva stejné apartmány musí být volné dvakrát
    const sazby = x.sazby.map(s => { const s2 = y.sazby.find(q => q.id === s.id); return s2 && { ...s, cena: s.cena + s2.cena, portal: (s.portal || s.cena) + (s2.portal || s2.cena) }; }).filter(Boolean);
    if (!sazby.length) return;
    out.push({ id: `combo:${x.id}+${y.id}`, nazev: x.id === y.id ? `2× ${x.nazev}` : `${x.nazev} + ${y.nazev}`, foto: x.foto, foto2: y.foto,
      osoby: `${a} + ${b}`, popis: `Pro ${osob} osob ve dvou apartmánech – ${a} a ${b} ${b < 5 ? 'osoby' : 'osob'}.`, volno: null, kombinace: true, sazby,
      pokoje: [{ typ: x.id, nazev: x.nazev, dospeli: tA.dospeli, deti: tA.deti }, { typ: y.id, nazev: y.nazev, dospeli: tB.dospeli, deti: tB.deti }] });
  }));
  return out.sort((p, q) => Math.min(...p.sazby.map(s => s.cena)) - Math.min(...q.sazby.map(s => s.cena))).slice(0, 3);
}

/** Nabídka pro termín – jednotlivé apartmány + pro větší skupiny dva apartmány. → { live, typy } */
export async function nabidkaTerminu(r, d) {
  const t = termin(r, d), live = previoLive(r);
  const typy = await nabidkaPro(r, t);
  const osob = t.dospeli + t.deti;
  if (osob >= KOMBINACE_OD || (!typy.length && osob >= 2)) typy.push(...await kombinace(r, t, live));
  return { live, typy, t };
}

/** Křížový prodej: když v resortu není nic volného, nabídka ostatních resortů na stejný termín. */
export async function jineResorty(r, d, vsechny) {
  const out = [];
  for (const r2 of vsechny.filter(x => x.id !== r.id)) {
    try {
      const { typy } = await nabidkaTerminu(r2, { ...d, balicek: undefined });
      if (!typy.length) continue;
      const cena = x => Math.min(...x.sazby.map(s => s.cena));
      const top = [...typy].sort((p, q) => cena(p) - cena(q)).slice(0, 2);
      const abs = f => (f && /^images\//.test(f) ? `/${r2.id}/${f}` : f); // fotky z jiného webu – cesta od kořene
      out.push({ resort: r2.id, nazev: r2.nazev, misto: r2.misto, stranka: r2.stranka, od: Math.round(cena(top[0])),
        typy: top.map(x => ({ id: x.id, nazev: x.nazev, foto: abs(x.foto), osoby: x.osoby, cena: Math.round(cena(x)), kombinace: !!x.kombinace })) });
    } catch (e) { /* jiný resort má jiné podmínky (min. počet nocí…) – vynecháme */ }
  }
  return out;
}

/**
 * Cena konkrétní objednávky. d = { od, do, dospeli, deti, typ, sazba, balicek (id), doplnky: [id] | { id: kusů } }
 * → { cena, ubytovani, doplnky: [{id, nazev, ks, cena, reservio}], apartman, sazbaNazev, typ, sazba, stayId, noci, live, ... }
 */
export async function spocitejCenu(r, d) {
  const { live, typy, t } = await nabidkaTerminu(r, d);
  const typ = typy.find(x => String(x.id) === String(d.typ));
  const rate = typ && typ.sazby.find(s => String(s.id) === String(d.sazba));
  if (!typ || !rate) throw new Chyba(live ? 'Vybraný apartmán už v tomto termínu není volný' : 'Neznámý apartmán nebo sazba');
  const ceny = await cenyZReservio(r); // wellness napojené na Reservio: cena podle Reservio, jinak z CMS
  const ex = x => { const c = ceny[x.id] ?? x.cena; return x.jednotka === 'noc' ? c * t.n : x.jednotka === 'osoba' ? c * t.dospeli : c; };
  // doplňky: ['id', …] nebo { id: počet kusů } – víc kusů jen u doplňků s „max_ks“ (např. 2 vstupy do wellness)
  const ks = Array.isArray(d.doplnky) ? Object.fromEntries(d.doplnky.map(id => [id, 1])) : (d.doplnky && typeof d.doplnky === 'object' ? d.doplnky : {});
  const bezVBalicku = new RegExp(r.R.balicek_bez_doplnku || 'wellness|masaz|prosecco');
  const doplnky = (r.R.doplnky || []).filter(x => +ks[x.id] > 0 && !(t.bal && bezVBalicku.test(x.id))).map(x => {
    const n = Math.min(Math.max(Math.floor(+ks[x.id]), 1), Math.max(+x.max_ks || 1, 1));
    return { id: x.id, nazev: x.nazev, ks: n, cena: ex(x) * n, reservio: sluzbaId(r, x) || undefined };
  });
  // wellness v jiném resortu (křížový prodej, když je vlastní plné / mimo provoz): id „alt:<resort>:<doplněk>“,
  // jen pokud ho vlastní doplněk má v CMS jako alternativu. Cena a Reservio podle druhého resortu.
  for (const key of Object.keys(ks).filter(k => /^alt:/.test(k) && +ks[k] > 0)) {
    const [, rid, did] = key.split(':');
    if (!(r.R.doplnky || []).some(x => x.alternativa === `${rid}:${did}`) || t.bal) continue;
    const r2 = resort(rid), x2 = (r2.R.doplnky || []).find(x => x.id === did);
    if (!x2) continue;
    const c2 = (await cenyZReservio(r2))[did] ?? x2.cena;
    const n = Math.min(Math.max(Math.floor(+ks[key]), 1), Math.max(+x2.max_ks || 1, 1));
    doplnky.push({ id: key, nazev: `${x2.nazev} – ${r2.nazev}`, ks: n, cena: c2 * n, reservio: sluzbaId(r2, x2) || undefined, resort: rid, doplnek: did });
  }
  const ubytovani = Math.round(rate.cena);
  const nevratna = rate.nevratna ?? jeNevratna(rate);
  const cena = ubytovani + Math.round(doplnky.reduce((a, x) => a + x.cena, 0));
  return { cena, ubytovani, doplnky, apartman: typ.nazev, sazbaNazev: rate.nazev, nevratna, pokoje: typ.pokoje, typ: typ.id, sazba: rate.id, stayId: t.bal && t.bal.previo_stay_id, balicek: t.bal && t.bal.nazev,
    od: t.od, do: t.doo, dospeli: t.dospeli, deti: t.deti, noci: t.n, live };
}
