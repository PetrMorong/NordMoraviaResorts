// Vypíše služby z Reservio resortu s jejich ID – ta se vkládají do CMS k doplňkům (Reservio ID služby).
// Spuštění: node scripts/reservio-sluzby.mjs [cerveny-dvur|vila-republika]
// Potřebuje v .env RESERVIO_TOKEN (Červený dvůr) / RESERVIO_TOKEN_VR (Vila). Bez ID podniku vypíše podniky, ke kterým token patří.
import fs from 'node:fs';
if (fs.existsSync('.env')) for (const m of fs.readFileSync('.env', 'utf8').matchAll(/^[ \t]*([A-Z0-9_]+)[ \t]*=[ \t]*"?([^"\r\n]*)"?/gm)) process.env[m[1]] ??= m[2];
const { resort, env } = await import('../netlify/lib/resorty.mjs');
const r = resort(process.argv[2] || 'cerveny-dvur');
const token = env(r, 'RESERVIO_TOKEN', false);
if (!token) { console.error(`Chybí RESERVIO_TOKEN${r.env} (.env)`); process.exit(1); }

const H = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.api+json' };
const base = (process.env.RESERVIO_URL || 'https://api.reservio.com/v2').replace(/\/$/, '');
if (!env(r, 'RESERVIO_BUSINESS_ID', false)) {
  const me = await fetch(base + '/users/me', { headers: H }).then(x => x.json());
  const acc = await fetch(`${base}/users/${me.data.id}/accesses?include=business`, { headers: H }).then(x => x.json());
  console.log(`Podniky (ID dejte do .env jako RESERVIO_BUSINESS_ID${r.env}):`);
  for (const b of acc.included || []) console.log(`  ${b.id}  ${b.attributes && b.attributes.name}`);
  process.exit(0);
}
const { sluzby } = await import('../netlify/lib/reservio.mjs');
console.log(`Služby – ${r.nazev}:`);
for (const s of await sluzby(r, true)) console.log(`  ${s.id}  ${s.nazev} (${s.delka} min, ${s.cena} Kč)`);
