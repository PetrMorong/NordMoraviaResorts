// Obchodní a storno podmínky resortu – pro okno „Obchodní a storno podmínky“ na webu.
//
// GET /.netlify/functions/podminky?resort=… → { zdroj: 'previo'|'cms', storno: ['Zrušení zdarma …', …], html, ochrana: [odstavce] }
//
// Storno pravidla a doplňující text se berou z Previo (Hotel.getConditions), aby web říkal totéž co voucher.
// Když Previo není zapnuté nebo neodpoví, použije se text z CMS (<resort>/data/rezervace.json → podminky_text).
import { resort } from '../lib/resorty.mjs';
import { previoLive, podminky } from '../lib/previo.mjs';

const json = body => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600' } });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// „24 hodin“ → „1 den“, „72“ → „3 dny“, „12“ → „12 hodin“
const doba = h => {
  if (h % 24) return `${h} ${h === 1 ? 'hodinu' : h < 5 ? 'hodiny' : 'hodin'}`;
  const d = h / 24;
  return `${d} ${d === 1 ? 'den' : d < 5 ? 'dny' : 'dní'}`;
};
const datum = s => s ? new Date(s + 'T12:00').toLocaleDateString('cs-CZ') : '';
/** Pravidla z Previo jako věty pro hosta (od nejdelší lhůty po nejkratší). */
export function stornoVety(storno) {
  const s = [...storno].sort((a, b) => b.hodin - a.hodin || a.poradi - b.poradi);
  if (!s.length) return [];
  const platnost = c => (c.od || c.do ? ` (pro pobyty ${c.od ? 'od ' + datum(c.od) : ''}${c.do ? ' do ' + datum(c.do) : ''})` : '');
  const poplatek = c => (c.jednotka === 'noci' ? `${c.castka} ${c.castka === 1 ? 'noc' : c.castka < 5 ? 'noci' : 'nocí'}` : `${c.castka} % z ceny rezervace`);
  return [`Zrušení zdarma nejpozději ${doba(s[0].hodin)} před příjezdem`,
    ...s.map(c => `${poplatek(c)} při zrušení méně než ${doba(c.hodin)} před příjezdem${platnost(c)}`)];
}

// Text z Previo může obsahovat HTML – pustíme jen bezpečné formátovací značky
const ALLOWED = /^(b|strong|i|em|u|br|p|ul|ol|li|h[1-6])$/i;
export const sanitize = html => {
  const s = /<[a-z]/i.test(html) ? html : esc(html).replace(/\r?\n/g, '<br>');
  return s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?([a-z0-9]+)[^>]*>/gi, (m, tag) => (ALLOWED.test(tag) ? (m.startsWith('</') ? `</${tag.toLowerCase()}>` : `<${tag.toLowerCase()}>`) : ''));
};

const cache = {};
export default async (req) => {
  let r;
  try { r = resort(new URL(req.url).searchParams.get('resort')); } catch { return new Response('Neznámý resort', { status: 404 }); }
  const R = r.R;
  const cms = { zdroj: 'cms', storno: [], html: (R.podminky_text || [R.podminky]).filter(Boolean).map(t => `<p>${esc(t)}</p>`).join(''), ochrana: R.ochrana_udaju || [] };
  if (!previoLive(r)) return json(cms);
  const c = cache[r.id];
  if (c && c.t > Date.now() - 36e5) return json(c.data);
  try {
    const p = await podminky(r);
    const storno = stornoVety(p.storno);
    if (!storno.length && !p.text) return json(cms);
    const data = { zdroj: 'previo', storno, html: p.text ? sanitize(p.text) : cms.html, ochrana: cms.ochrana };
    cache[r.id] = { t: Date.now(), data };
    return json(data);
  } catch (e) {
    console.error(e);
    return json(cms);
  }
};
