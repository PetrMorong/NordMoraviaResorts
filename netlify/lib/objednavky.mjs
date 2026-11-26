// Úložiště objednávek (stav platby). Na Netlify Netlify Blobs, lokálně složka .data/ (je v .gitignore).
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

let _store;
async function store() {
  if (_store) return _store;
  try {
    const { getStore } = await import('@netlify/blobs');
    const s = getStore({ name: 'objednavky', consistency: 'strong' });
    await s.get('__test__'); // bez prostředí Netlify vyhodí chybu → lokální soubory
    return (_store = { get: k => s.get(k, { type: 'json' }), set: (k, v) => s.setJSON(k, v) });
  } catch {
    const dir = path.resolve(process.env.OBJEDNAVKY_DIR || '.data/objednavky');
    await fs.mkdir(dir, { recursive: true });
    const f = k => path.join(dir, k.replace(/[^\w-]/g, '_') + '.json');
    return (_store = {
      get: async k => { try { return JSON.parse(await fs.readFile(f(k), 'utf8')); } catch { return null; } },
      set: (k, v) => fs.writeFile(f(k), JSON.stringify(v, null, 1)),
    });
  }
}

export const nactiObjednavku = async obj => (/^\d{6,10}$/.test(obj || '') ? (await store()).get('o-' + obj) : null);
export const ulozObjednavku = async o => { o.zmeneno = new Date().toISOString(); await (await store()).set('o-' + o.obj, o); return o; };

/** Nové číslo objednávky: RRMMDD + 4 náhodné číslice (max. 10 číslic – slouží i jako variabilní symbol). */
export async function noveCislo() {
  const d = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Prague' }).replace(/-/g, '').slice(2);
  for (let i = 0; i < 20; i++) {
    const c = d + String(crypto.randomInt(0, 10000)).padStart(4, '0');
    if (!(await nactiObjednavku(c))) return c;
  }
  throw new Error('Nepodařilo se přidělit číslo objednávky');
}
/** Číslo platby pro bránu (orderNo) – při opakované platbě musí být nové. */
export const cisloPlatby = o => (o.pokusy ? '9' + String(crypto.randomInt(0, 1e9)).padStart(9, '0') : o.obj);
export const token = () => crypto.randomBytes(12).toString('base64url');
