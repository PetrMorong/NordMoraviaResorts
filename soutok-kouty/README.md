# Soutok Kouty – ubytovací web (hotel)

Statický web v HTML/CSS/JS. Veškerý obsah (texty, apartmány, ceny, cenové plány, doplňky, wellness, bistro, okolí, FAQ, galerie)
je v JSON souborech ve složce `data/` a edituje se přes **Decap CMS** na `/admin` – stejně jako u prodejního webu.

## Struktura
```
index.html            úvodní stránka (vše se vykresluje z data/*.json)
rezervace.html        rezervační proces: apartmán + cena → doplňky a údaje → potvrzení
assets/style.css      design (brand Soutok: písková #EDE7DA, antracit #141117)
assets/common.js      načítání dat, formátování, hlavička
assets/home.js        úvodní stránka
assets/booking.js     rezervace
data/*.json           obsah spravovaný v CMS
admin/                Decap CMS (config.yml = co jde v CMS upravit)
netlify/functions/dostupnost.js   dostupnost – místo pro napojení na Previo (zatím ukázková data)
images/               fotky a vizualizace (z repozitáře soutok-kouty)
```

## Nasazení (Netlify)
1. Nahrát do Git repozitáře a připojit na Netlify (Publish directory `.`, bez build příkazu).
2. Site settings → Identity → Enable, Services → Git Gateway → Enable, Registration → Invite only, pozvat editory.
3. Forms se zapnou samy (`rezervace`, `predregistrace`). Notifikace: Forms → Form notifications → Email.
4. CMS: `https://<web>/admin`.

Lokálně: `npx serve .` (stránka čte JSON přes fetch, z disku dvojklikem nefunguje).

## Co je zatím ukázkové
- Ceny za noc, počty volných apartmánů, otevírací doba bistra, kontakty (telefon) – upravit v CMS.
- Dostupnost: `netlify/functions/dostupnost.js` vrací ukázková data. Napojení na Previo: doplnit volání API
  (přístupy do proměnných prostředí na Netlify, ne do kódu) a ke každému typu apartmánu v CMS vyplnit `Previo – ID typu pokoje`.
- Odeslaná rezervace teď jde jako Netlify formulář (poptávka). Po napojení na Previo + platební bránu se zapíše rovnou do Previa.
