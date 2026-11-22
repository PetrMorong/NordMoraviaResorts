// Stáhne hodnocení a vybrané recenze z Reservio (veřejné API) a souhrnné skóre z TrustYou do data/nmr/reservio.json.
// Spouští se při nasazení na Netlify před předgenerováním stránek. Prohlížeč na API Reservio
// přímo nedosáhne (CORS), proto se data berou při buildu. Když se stažení nepovede,
// zůstane poslední uložený soubor (statická záloha v repozitáři).
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data/nmr/reservio.json');
const API = 'https://api.reservio.com/v2/businesses/';
const BUSINESSES = {
  'vila-republika': {id: '89b43bc7-3262-4446-89fc-eda62a80fa7c', url: 'https://vila-republika.reservio.com'},
  'cerveny-dvur': {id: '6f34c69b-c2d9-4252-ab7d-605f97e97fb8', url: 'https://resort-cerveny-dvur.reservio.com'},
};
// do výběru jen jednoznačně pochvalné recenze (bez „ale“, „jen“, výtek)
const VYTKA = /\b(ale|jen|jediné|mínus|škoda|chyb|bohužel|ocenil)/i;
const get = async u => { const r = await fetch(u, {headers: {accept: 'application/vnd.api+json'}}); if (!r.ok) throw new Error(r.status + ' ' + u); return r.json(); };

async function one(key, {id, url}) {
  const b = (await get(API + id)).data.attributes;
  const out = {nazev: b.name, hodnoceni: b.rating, pocet: b.reviewCount, url, recenze: []};
  if (!b.reviewCount) return out;
  let all = [], users = {};
  for (let o = 0; o < Math.min(b.reviewCount, 300); o += 100) {
    const d = await get(`${API}${id}/reviews?page[limit]=100&page[offset]=${o}&include=user`);
    all = all.concat(d.data);
    (d.included || []).filter(x => x.type === 'user').forEach(u => users[u.id] = (u.attributes.name || '').trim().split(' ')[0]);
  }
  out.recenze = all
    .filter(r => r.attributes.rating === 5 && !r.attributes.blockedAt)
    .map(r => ({jmeno: users[r.relationships.user.data?.id] || 'Host', text: (r.attributes.text || '').replace(/\s+/g, ' ').trim(), datum: r.attributes.createdAt.slice(0, 10)}))
    .filter(r => r.text.length >= 40 && r.text.length <= 180 && !VYTKA.test(r.text))
    .slice(0, 6);
  return out;
}

let data = {};
try { data = JSON.parse(await readFile(FILE, 'utf8')); } catch {}
for (const [k, v] of Object.entries(BUSINESSES)) {
  try { data[k] = await one(k, v); console.log(`  ✓ Reservio ${k}: ${data[k].hodnoceni ?? '–'} (${data[k].pocet}), ${data[k].recenze.length} recenzí`); }
  catch (e) { console.warn(`  ! Reservio ${k}: ${e.message} – ponechávám uložená data`); }
}
// TrustYou – souhrnné skóre ze všech portálů (Booking, Google…), stejný widget jako na starém webu Vily
const TY = {'vila-republika': {id: 'cae0a877-7792-4ef2-b2d8-8e1b919e273c', key: '6d715e36-4335-4bd1-9d8a-c856cbc21cff'}};
for (const [k, t] of Object.entries(TY)) {
  try {
    const r = (await get(`https://api.trustyou.com/hotels/${t.id}/seal.json?key=${t.key}`)).response;
    data[k] = data[k] || {};
    data[k].trustyou = {skore: +r.score, popis: r.score_description, pocet: r.reviews_count, zdroju: r.sources_count, widget: `https://api.trustyou.com/hotels/${t.id}/reviews.html?key=${t.key}&scale=5&pageSize=5`};
    console.log(`  ✓ TrustYou ${k}: ${r.score}/100 (${r.reviews_count})`);
  } catch (e) { console.warn(`  ! TrustYou ${k}: ${e.message} – ponechávám uložená data`); }
}
// Google – hodnocení a recenze z profilů na Mapách (Places API). Potřebuje klíč GOOGLE_PLACES_KEY
// v Netlify → Site configuration → Environment variables. Bez klíče zůstanou uložená čísla.
const GP = {'cerveny-dvur': 'ChIJTZJefFcbEkcRYG9pEcuXA0Y', 'cerveny-dvur-restaurace': 'ChIJYdfcg8EbEkcR0bztZi6l2kY', 'vila-republika': 'ChIJg1ZF6nsdEkcRUUA0Pq_STjI'};
const GKEY = process.env.GOOGLE_PLACES_KEY;
data.google = data.google || {};
for (const [k, id] of Object.entries(GP)) {
  if (!GKEY) break;
  try {
    const r = await fetch(`https://places.googleapis.com/v1/places/${id}?languageCode=cs`, {headers: {'X-Goog-Api-Key': GKEY, 'X-Goog-FieldMask': 'rating,userRatingCount,googleMapsUri,reviews'}});
    if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 120));
    const g = await r.json();
    data.google[k] = {
      hodnoceni: g.rating, pocet: g.userRatingCount, url: g.googleMapsUri,
      recenze: (g.reviews || []).filter(x => x.rating === 5 && (x.originalText || x.text)?.text?.length >= 40)
        .map(x => ({jmeno: x.authorAttribution?.displayName || 'Host', profil: x.authorAttribution?.uri || '', text: (x.originalText || x.text).text.replace(/\s+/g, ' ').trim(), kdy: x.relativePublishTimeDescription || ''}))
        .filter(x => x.text.length <= 320).slice(0, 3),
    };
    console.log(`  ✓ Google ${k}: ${g.rating} (${g.userRatingCount}), ${data.google[k].recenze.length} recenzí`);
  } catch (e) { console.warn(`  ! Google ${k}: ${e.message} – ponechávám uložená data`); }
}
if (!GKEY) console.log('  · Google: bez GOOGLE_PLACES_KEY, používám uložená čísla');
data.aktualizovano = new Date().toISOString().slice(0, 10);
await writeFile(FILE, JSON.stringify(data, null, 2) + '\n');
