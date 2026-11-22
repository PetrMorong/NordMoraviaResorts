// Dostupnost apartmánů pro rezervační formulář Soutok Kouty.
// TODO napojení na Previo: dotaz na volné pokoje podle typu (previo_id z CMS) a termínu.
// Přístupové údaje k API patří do proměnných prostředí na Netlify (PREVIO_API_KEY, PREVIO_HOTEL_ID),
// nikdy do kódu ani do CMS. Do té doby funkce vrací ukázková data a příznak demo.
import apartmany from '../../soutok-kouty/data/apartmany.json' with { type: 'json' };

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  const u = new URL(req.url).searchParams;
  const od = u.get('od'), doo = u.get('do'), hoste = u.get('hoste') || '2';
  if (!od || !doo || doo <= od) return json({ chyba: 'Neplatný termín' }, 400);
  const seed = [...(od + doo)].reduce((a, c) => a + c.charCodeAt(0), 0);
  const volne = Object.fromEntries(apartmany.typy.map((t, i) => [t.id, Math.max(0, (t.pocet + seed + i * 3) % (t.pocet + 2) - 1)]));
  return json({ demo: true, hoste: +hoste, volne });
};
