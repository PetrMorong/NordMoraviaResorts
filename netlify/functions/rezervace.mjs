// Nabídka volných apartmánů a cen pro rezervační komponentu (všechny resorty)
//
// GET /.netlify/functions/rezervace?resort=…&od=2027-01-15&do=2027-01-17&dospeli=2&deti=0[&balicek=<id balíčku>]
//     → { rezim: 'live'|'cenik', typy: [{ id, nazev, foto, osoby, plocha, popis, volno, sazby: [{ id, nazev, popis, cena, portal }] }] }
//     typy obsahují i kombinace dvou apartmánů pro větší skupiny (id 'combo:A+B', pokoje = rozdělení hostů)
//     jine = křížový prodej – když v resortu nic není, nabídka ostatních resortů na stejný termín
//     live = ceny a volné apartmány z Previo (PREVIO_LIVE resortu), cenik = z ceníku v CMS (dostupnost potvrdí recepce)
//
// Rezervace s platbou jde přes /.netlify/functions/platba. Cenu počítá vždy server (netlify/lib/cena.mjs).
import { resort, Chyba, vsechnyResorty } from '../lib/resorty.mjs';
import { nabidkaTerminu, jineResorty } from '../lib/cena.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export default async (req) => {
  if (req.method !== 'GET') return json({ chyba: 'Metoda není podporovaná' }, 405);
  const u = new URL(req.url).searchParams;
  try {
    const r = resort(u.get('resort'));
    const d = { od: u.get('od'), do: u.get('do'), dospeli: u.get('dospeli'), deti: u.get('deti'), balicek: u.get('balicek') || undefined };
    const { live, typy } = await nabidkaTerminu(r, d);
    // nic volného (ani dva apartmány) → nabídneme ostatní resorty na stejný termín
    const jine = typy.length ? [] : await jineResorty(r, d, vsechnyResorty());
    return json({ rezim: live ? 'live' : 'cenik', typy, jine });
  } catch (e) {
    if (e instanceof Chyba) return json({ chyba: e.message }, 400);
    console.error(e);
    return json({ chyba: 'Nabídku se teď nepodařilo načíst.' }, 502);
  }
};
