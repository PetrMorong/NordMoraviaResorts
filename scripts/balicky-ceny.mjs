// Ceny „od“ pobytových balíčků z Previo → <resort>/data/balicky-ceny.json
// Spouští se při nasazení (před předgenerováním stránek). Pro každý aktivní balíček projde několik termínů
// v období prodeje (2 dospělí, nejkratší délka balíčku) a uloží nejnižší cenu včetně slevy za přímou rezervaci.
// Úvod a stránka Balíčky pak ukazují skutečnou cenu z Previo; když Previo není zapnuté nebo neodpoví,
// zůstane poslední uložený soubor a web spadne zpět na orientační cenu z ceníku v CMS.
// Spuštění ručně: node scripts/balicky-ceny.mjs   (s --cenik spočítá z ceníku v CMS – jen pro kontrolu)
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resort, vsechnyResorty } from '../netlify/lib/resorty.mjs';
import { nabidkaTerminu } from '../netlify/lib/cena.mjs';
import { previoLive } from '../netlify/lib/previo.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CENIK = process.argv.includes('--cenik');
const TERMINU = +(process.env.BALICKY_TERMINU || 10);        // kolik příjezdů vyzkoušet na balíček
const iso = d => d.toISOString().slice(0, 10);
const plus = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };

/** Příjezdy rozložené v období prodeje (max. 9 měsíců dopředu), vždy pátek a k tomu jeden všední den. */
function prijezdy(b) {
  const dnes = iso(new Date()), zitra = plus(dnes, 1);
  const pevny = /^\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/.test(b.termin || '') ? b.termin.split('/') : null;
  if (pevny) return pevny[0] >= zitra ? [pevny[0]] : [];
  const od = [zitra, String(b.platnost_od || '').slice(0, 10)].filter(Boolean).sort().at(-1);
  const doo = [plus(dnes, 270), String(b.platnost_do || '').slice(0, 10) || plus(dnes, 270)].sort()[0];
  if (doo < od) return [];
  const rozsah = (new Date(doo) - new Date(od)) / 864e5, krok = Math.max(1, rozsah / TERMINU), out = new Set();
  for (let i = 0; i < TERMINU; i++) {
    const d = new Date(plus(od, Math.round(i * krok)) + 'T12:00:00Z');
    const patek = new Date(d); patek.setUTCDate(d.getUTCDate() + ((5 - d.getUTCDay() + 7) % 7));
    const p = iso(patek) <= doo ? iso(patek) : iso(d);
    out.add(i % 3 === 2 ? plus(p, -3) >= od ? plus(p, -3) : p : p);   // každý třetí termín v úterý (levnější všední dny)
  }
  return [...out].filter(x => x >= od && x <= doo);
}

async function cenyResortu(key) {
  const r = resort(key);
  const B = (r.B || []).filter(b => b.aktivni);
  if (!B.length) return null;
  if (!CENIK && !previoLive(r)) { console.log(`  · ${key}: Previo není zapnuté – nechávám uložené ceny`); return null; }
  const ceny = {};
  for (const b of B) {
    let best = null;
    for (const od of prijezdy(b)) {
      try {
        const doo = /^\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/.test(b.termin || '') ? b.termin.split('/')[1] : plus(od, b.noci_min);
        const { typy } = await nabidkaTerminu(r, { od, do: doo, dospeli: 2, deti: 0, balicek: b.id });
        for (const t of typy.filter(x => !x.kombinace)) for (const s of t.sazby) {
          if (s.cena > 0 && (!best || s.cena < best.cena)) best = { cena: Math.round(s.cena), portal: Math.round(s.portal || s.cena), od, do: doo, apartman: t.nazev };
        }
      } catch (e) { console.log(`    ! ${b.id} ${od}: ${e.message}`); }
    }
    if (best) { ceny[b.id] = { ...best, noci: b.noci_min, osob: 2 }; console.log(`  ✓ ${key} / ${b.id}: od ${best.cena} Kč (${best.od}, ${best.apartman})`); }
    else console.log(`  · ${key} / ${b.id}: žádný volný termín v nabídce – bez ceny`);
  }
  return { aktualizovano: new Date().toISOString(), zdroj: CENIK ? 'cenik' : 'previo', ceny };
}

console.log('Ceny pobytových balíčků:');
for (const { id: key } of vsechnyResorty()) {
  try {
    const out = await cenyResortu(key);
    if (out && Object.keys(out.ceny).length) await writeFile(path.join(ROOT, key, 'data/balicky-ceny.json'), JSON.stringify(out, null, 2) + '\n');
  } catch (e) { console.log(`  ! ${key}: ${e.message} – nechávám uložené ceny`); }
}
