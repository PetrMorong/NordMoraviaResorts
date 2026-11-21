// Dostupnost apartmánů pro rezervační formulář.
// TODO napojení na Previo: dotaz na volné pokoje podle typu (previo_id z CMS) a termínu.
// Přístupové údaje k API patří do proměnných prostředí na Netlify (PREVIO_LOGIN, PREVIO_PASSWORD, PREVIO_HOTEL_ID),
// nikdy do kódu ani do CMS. Do té doby funkce vrací ukázková data a příznak demo.
const apartmany = require('../../soutok-kouty/data/apartmany.json');

exports.handler = async (event) => {
  const { od, do: doo, hoste = '2' } = event.queryStringParameters || {};
  if (!od || !doo || doo <= od) return { statusCode: 400, body: JSON.stringify({ chyba: 'Neplatný termín' }) };

  // if (process.env.PREVIO_LOGIN) { ... zavolat Previo API a vrátit { volne: { typId: pocet } } ... }

  const seed = [...(od + doo)].reduce((a, c) => a + c.charCodeAt(0), 0);
  const volne = Object.fromEntries(apartmany.typy.map((t, i) => [t.id, Math.max(0, (t.pocet + seed + i * 3) % (t.pocet + 2) - 1)]));
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ demo: true, hoste: +hoste, volne }) };
};
