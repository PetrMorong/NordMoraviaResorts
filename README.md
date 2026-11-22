# Nord Moravia Resorts – web

Statický web (HTML/CSS/JS) + Decap CMS + Netlify. Obsah je v JSON souborech a upravuje se na `/admin`.

```
/                        úvod sítě (index.html, assets/nmr.*, data/nmr/*.json)
/soutok-kouty/           web hotelu Soutok Kouty + rezervace (soutok-kouty/data/*.json)
/cerveny-dvur/           web Resortu Červený dvůr (cerveny-dvur/data/*.json) + restaurace.html, akce.html; rezervace = Previo (hotId 769376)
/vila-republika/         web Vily Republika (vila-republika/data/*.json), rezervace = Previo (hotId 758539), wellness = Reservio
/portal-vlastniku/       ukázka portálu vlastníků (prototyp, fiktivní data)
/admin/                  Decap CMS pro celý web
/netlify/functions/      dostupnost pro rezervace (místo pro napojení na Previo)
/images/                 fotky úvodu; /images/uploads = nahrávání z CMS
```

## Nasazení na Netlify
1. Repozitář připojit na Netlify – Publish directory `.`, bez build příkazu.
2. Formuláře (`rezervace`, `predregistrace`) se zapnou samy. E-mailové upozornění: Site configuration → Notifications →
   Form submission notifications → Email → info@resortcervenydvur.cz (pro oba formuláře).
3. Netlify Identity ani Git Gateway se **nezapínají** – přihlášení do CMS řeší Decap Turbo (níže).

## CMS – Decap Turbo (přihlášení a role)
1. Registrace na https://turbo.decapcms.org/signup (organizace Nord Moravia Resorts).
2. Připojit GitHub – nainstalovat Decap Turbo GitHub App na repozitář `PetrMorong/NordMoraviaResorts`.
3. Vytvořit web: repozitář, větev (`main`), admin URL `https://nordmoraviaresorts.cz/admin/`. Zkopírovat **Site ID**.
4. Site ID vložit do `admin/config.yml` místo `DOPLNIT-SITE-ID`, commit + push.
5. V dashboardu pozvat editory e-mailem. Editor nepotřebuje účet na GitHubu ani Netlify.

Kolekce v CMS (na ně se navazují role):

| Kolekce (`name`) | Co obsahuje |
|---|---|
| `nmr` | úvod NMR – texty, kontakt, resorty, tým |
| `investice` | sekce investice (právní formulace výnosu) |
| `web` | Soutok Kouty – nastavení, režim poptávka/rezervace, wellness, bistro, okolí, FAQ, galerie |
| `ubytovani` | Soutok Kouty – apartmány, ceny, cenové plány, doplňky |
| `vr_web` | Vila Republika – úvod, wellness, společenská místnost, okolí, kontakt, poukazy |
| `vr_apartmany` | Vila Republika – apartmány (přepínač „Zobrazit na webu“) |

Návrh rolí (vlastní role = placený doplněk Turbo Pro, nebo Enterprise):

| Role | nmr | investice | web | ubytovani |
|---|---|---|---|---|
| Admin (Petr) | upravuje | upravuje | upravuje | upravuje |
| Provozní Kouty | vidí | skryto | upravuje | upravuje |
| Recepce | skryto | skryto | upravuje | vidí |
| Marketing | upravuje | vidí | upravuje | vidí |

Lokálně: `npx serve .` – stránky čtou JSON přes fetch, dvojklikem z disku nefungují.

## Další kroky
- Doména resortcervenydvur.cz: po spuštění přesměrovat (301) na nordmoraviaresorts.cz/cerveny-dvur/ (podstránky: /cs/kavarna/ → /cerveny-dvur/restaurace.html, /cs/svatby/ a /cs/pro-firmy/ → /cerveny-dvur/akce.html).
- restaurace.resortcervenydvur.cz (Choice) zůstává jen jako digitální menu, rezervace stolu a rozvoz.
- Doména vila-republika.cz: po spuštění přesměrovat (301) na nordmoraviaresorts.cz/vila-republika/.
- Fotky na úvodu jsou z Cloudinary (`data/nmr/resorty.json`).
- Rezervace Soutok Kouty: napojit `netlify/functions/dostupnost.js` na Previo (přístupy do proměnných prostředí na Netlify).

## Měření a konverze (listopad 2026)

Všechny weby sítě (NMR, Červený dvůr, Vila Republika, Soutok Kouty) načítají `assets/nmr-common.js`:

- **Jedno měření pro celou síť** – ID Google Tag Manageru a Meta Pixelu se zadává v CMS: *Nord Moravia – úvodní stránka → Texty a kontakt → Měření*. Dokud je prázdné, nic se nenačítá a lišta cookies se nezobrazí.
- **Souhlas s cookies** – Google Consent Mode v2, výchozí stav „zamítnuto“, Meta Pixel se spustí až po „Přijmout vše“. Odkaz „Nastavení cookies“ je v patičce NMR.
- **Události v dataLayer** (v GTM z nich udělat konverze GA4 / Google Ads / Meta):
  `zacatek_rezervace`, `zobrazeni_rezervace`, `hledani_terminu`, `klik_telefon`, `klik_email`, `klik_wellness_rezervace`, `klik_rezervace_stolu`, `klik_menu_restaurace`, `odeslani_formulare` (poptávky, newsletter). Každá nese `resort`.
- **Dokončená rezervace** proběhne uvnitř Previo okna (jiná doména), web ji nevidí. V Previo nastavit měření rezervačního modulu (GA4 / GTM), případně děkovnou stránku – jinak GA uvidí jen začátek rezervace.
- **Výhody přímé rezervace** (−5 % + sleva na wellness) – texty v CMS *Výhody přímé rezervace*. **Slevu je nutné mít skutečně nastavenou v Previo** (cena pro přímý kanál o 5 % nižší, sleva na wellness v Reservio / na recepci).
- **Lepicí lišta na mobilu** – nastavuje se atributy `data-nmr-cta*` na `<body>` každé stránky.
- **Newsletter** – Netlify formulář `newsletter`; kontakty exportovat do e-mailového nástroje (Ecomail / Mailchimp).
- **Recenze** – CMS *Recenze hostů*, jen skutečné recenze; prázdný seznam = sekce se nezobrazí.

## Předgenerování obsahu (SEO a AI vyhledávače)

Stránky si obsah berou z `data/*.json` skriptem v prohlížeči. Aby obsah viděli i roboti, kteří JavaScript nespouští (ChatGPT, Perplexity, Claude, náhledy na Facebooku), Netlify při každém nasazení spustí `scripts/prerender.mjs` (nastaveno v `netlify.toml`):

- stránku „spustí“ v jsdomu nad aktuálními daty a výsledné HTML uloží do nasazené verze,
- v prohlížeči se obsah vykreslí znovu ze stejných dat – CMS funguje beze změny, úprava v CMS = nový build = nové HTML,
- lokální soubory v repozitáři se nemění (běží jen na Netlify),
- když se stránka nevykreslí, nechá se původní HTML a build nespadne.

Nové stránky je potřeba přidat do seznamu `PAGES` ve skriptu. Ruční test: `npm install` a `npm run build` (přepíše HTML – spouštět jen na kopii).

## SEO

- `sitemap.xml` a `robots.txt` v kořeni (admin a demo portálu se neindexují). Sitemap po spuštění odeslat v Google Search Console.
- Strukturovaná data (schema.org) v `<head>` každé stránky: Resort/LodgingBusiness/Hotel, Restaurant, DaySpa, EventVenue, FAQPage, BreadcrumbList.
- 301 přesměrování starých URL (resortcervenydvur.cz, vila-republika.cz) je v `netlify.toml`. Fungují, až budou obě domény (s www i bez) přidané v Netlify jako aliasy tohoto webu.
