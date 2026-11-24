// Co o hotelu vrací Previo (jen čtení) – ID typů apartmánů a služeb pro CMS, platební podmínky, časy příjezdu/odjezdu.
// Použití: node scripts/previo-info.mjs [cerveny-dvur|vila-republika] [od YYYY-MM-DD] [do YYYY-MM-DD]
// Klíč se bere z .env (PREVIO_API_KEY, u Vily PREVIO_API_KEY_VR).
import fs from 'node:fs';
for (const l of (fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=[ \t]*(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
process.env.PREVIO_LIVE = process.env.PREVIO_LIVE_VR = '1';
const { resort } = await import('../netlify/lib/resorty.mjs');
const { previo, tags, val, hotelInfo, platebniPodminky, sluzbyHotelu } = await import('../netlify/lib/previo.mjs');

const r = resort(process.argv[2] || 'cerveny-dvur');
const den = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const od = process.argv[3] || den(14), doo = process.argv[4] || den(16);

console.log(`\n${r.nazev} – hotel`, await hotelInfo(r));
const ok = await previo(r, 'Hotel.getObjectKinds', '');
console.log('\nTypy apartmánů (Previo ID → pole „Previo ID“ v ceníku CMS):');
for (const k of tags(ok, 'objectKind')) console.log(`  ${val(k, 'obkId').padEnd(9)} ${val(k, 'name')}  (${tags(k, 'object').length} ks)`);
console.log(`\nPlatební podmínky pro ${od} – ${doo}:`, await platebniPodminky(r, od, doo));
console.log('\nSlužby (Previo ID → pole „Previo ID služby“ u doplňků v CMS), * = zobrazené na webu Previo:');
for (const [id, s] of Object.entries(await sluzbyHotelu(r, od, doo))) console.log(`  ${s.web ? '*' : ' '} ${id.padEnd(9)} ${s.nazev} – ${s.cena} Kč / ${s.jednotka}`);
const cms = r.R.doplnky || [];
console.log('\nDoplňky v CMS:', cms.map(x => `${x.id}=${x.previo_sluzba || '—'}`).join(', '));
