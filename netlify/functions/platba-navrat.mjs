// Návrat z platební brány ČSOB (returnUrl). Brána sem přesměruje prohlížeč hosta (POST formulář, případně GET).
// Parametrům z prohlížeče nevěříme: ověříme podpis a stav si stejně vyžádáme přímo z brány (payment/status).
// Pak host skončí na rezervační stránce svého resortu (?obj=…&t=…), kde stránka ukáže výsledek.
import { overOdpoved, stavPlatby } from '../lib/csob.mjs';
import { nactiObjednavku } from '../lib/objednavky.mjs';
import { vyrid } from '../lib/vyrizeni.mjs';
import { resort } from '../lib/resorty.mjs';

const zpet = (q = '', o = null) => new Response(null, { status: 303, headers: { Location: resort(o && o.resort).stranka + q, 'Cache-Control': 'no-store' } });

export default async (req) => {
  let p;
  if (req.method === 'POST') p = Object.fromEntries(new URLSearchParams(await req.text()));
  else p = Object.fromEntries(new URL(req.url).searchParams);
  const obj = (() => { try { return Buffer.from(p.merchantData || '', 'base64').toString('utf8'); } catch { return ''; } })();
  const o = await nactiObjednavku(obj);
  if (!o) return zpet('?platba=neznama');
  const q = `?obj=${o.obj}&t=${o.t}`;
  if (!p.payId || p.payId !== o.payId) return zpet(q, o); // starší pokus o platbu – stránka si stav načte sama
  if (!overOdpoved(p)) console.warn('Návrat z brány: podpis nesedí', o.obj, p.payId);
  try {
    const s = await stavPlatby(p.payId);
    await vyrid(o, s.paymentStatus, s.authCode);
  } catch (e) {
    console.error('Stav platby se nepodařilo ověřit', o.obj, e.message); // stránka se zeptá znovu přes GET /platba
  }
  return zpet(q, o);
};
