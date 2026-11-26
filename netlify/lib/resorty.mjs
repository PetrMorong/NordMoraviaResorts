// Resorty se společným rezervačním systémem (komponenta assets/booking/). Každý má svá data v CMS a svá napojení.
//
// Proměnné prostředí: Červený dvůr bez přípony, ostatní s příponou resortu – např. RESERVIO_TOKEN (Červený dvůr)
// a RESERVIO_TOKEN_VR (Vila Republika). Co resort nemá vlastní, bere ze společné proměnné (ČSOB je společná –
// obě provozuje Mori Reality s.r.o.).
//
// Nový resort (např. Soutok Kouty): přidat data <resort>/data/rezervace.json + apartmany.json, záznam sem
// a stránku s komponentou (viz README → Rezervační komponenta).
import CD_R from '../../cerveny-dvur/data/rezervace.json' with { type: 'json' };
import CD_A from '../../cerveny-dvur/data/apartmany.json' with { type: 'json' };
import CD_B from '../../cerveny-dvur/data/balicky.json' with { type: 'json' };
import VR_R from '../../vila-republika/data/rezervace.json' with { type: 'json' };
import VR_A from '../../vila-republika/data/apartmany.json' with { type: 'json' };

export class Chyba extends Error {} // chyba pro hosta (zobrazí se na webu)

const RESORTY = {
  'cerveny-dvur': {
    id: 'cerveny-dvur', nazev: 'Resort Červený dvůr', misto: 'Rapotín u Šumperka', env: '', hotel: '769376',
    R: CD_R, A: CD_A.apartmany, B: CD_B.balicky, stranka: '/cerveny-dvur/rezervace.html', checkin: '14:00', checkout: '10:00',
  },
  'vila-republika': {
    id: 'vila-republika', nazev: 'Vila Republika', misto: 'Velké Losiny · 15 min od Rapotína', env: '_VR', hotel: '758539',
    R: VR_R, A: VR_A.apartmany.filter(a => a.aktivni !== false), B: [], stranka: '/vila-republika/rezervace.html', checkin: '15:00', checkout: '10:00',
  },
};

/** Resort podle id (výchozí Červený dvůr – kvůli starším odkazům). */
export function resort(id) {
  const r = RESORTY[id || 'cerveny-dvur'];
  if (!r) throw new Chyba('Neznámý resort');
  return r;
}
export const resortyIds = Object.keys(RESORTY);
export const vsechnyResorty = () => Object.values(RESORTY);

/** Proměnná prostředí pro resort: nejdřív s příponou resortu (RESERVIO_TOKEN_VR), jinak společná. */
export const env = (r, k, spolecna = true) => {
  const vlastni = process.env[k + r.env];
  if (vlastni !== undefined && vlastni !== '') return vlastni;
  return spolecna || !r.env ? process.env[k] : undefined;
};
