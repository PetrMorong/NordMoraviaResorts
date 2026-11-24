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

## Platba rezervace – ČSOB karta a převod (Červený dvůr)

Rezervační formulář `cerveny-dvur/rezervace.html` nabízí v kroku 4 stejné platby jako formulář Previo:

| Způsob | Co se stane |
|---|---|
| **Online platba kartou** | Okamžitá rezervace. Host zaplatí na platební stránce ČSOB, vrátí se na `rezervace.html?obj=…` a vidí potvrzení. V Previo se rezervace založí jako opce a po zaplacení se potvrdí a zapíše se platba. |
| **Bankovní převod** | Předběžná rezervace (opce v Previo). Host vidí zálohu, splatnost a variabilní symbol (= číslo objednávky). Zálohový list posílá Previo / recepce, nebo ho vystaví API (`PREVIO_ZALOHOVY_LIST=1`). |

- Cenu vždy počítá server (`netlify/lib/cena.mjs`), cena z prohlížeče se ignoruje.
- Recepce dostává e-maily z Netlify formulářů `rezervace` (nová rezervace) a `platba` (zaplaceno / nezaplaceno / převod). Upozornění pro formulář `platba` je potřeba v Netlify zapnout stejně jako u `rezervace`.
- Objednávky a stav plateb jsou v Netlify Blobs (úložiště `objednavky`).
- Nastavení v CMS: *Rezervace – ceník, doplňky a podmínky → Platba* (zapnout/vypnout způsoby, záloha v %, splatnost, číslo účtu, texty).
- Bez zapnutého Previo (`PREVIO_LIVE`) je platba kartou povolená jen v testovacím režimu brány. Ostře se nebude platit za nepotvrzenou dostupnost.

**Proměnné prostředí na Netlify** (Site configuration → Environment variables). Do kódu ani do CMS je nedávejte:

| Proměnná | Hodnota |
|---|---|
| `CSOB_MERCHANT_ID` | ID obchodníka od ČSOB |
| `CSOB_PRIVATE_KEY` | celý obsah souboru s privátním klíčem (`-----BEGIN … KEY-----` …) |
| `CSOB_ENV` | `test` (integrační iBrána, žádné skutečné peníze), na ostrém provozu `prod` |
| `PREVIO_LIVE`, `PREVIO_API_KEY`, `PREVIO_HOTEL_ID` | napojení na Previo, viz `netlify/lib/previo.mjs` |
| `PREVIO_ZALOHOVY_LIST` | `1` = zálohový list k převodu vystaví API (nejdřív ověřit na testovacím hotelu Previo) |
| `PREVIO_JEN_CIST` | `1` = živé ceny a obsazenost z Previo, ale rezervace a platby se do Previo nezapisují (jen do logu). Na testování proti ostrému hotelu |

**Živé ceny z Previo** (`PREVIO_LIVE=1`, ověřeno na Červeném dvoře 11/2026)
- Z Previo se bere cena ubytování podle obsazenosti (`Hotel.getRates`, základní sazba), příplatky za stravu (snídaně je v ceně, bez snídaně −100 Kč, polopenze +350 Kč za osobu a noc), minimální délka pobytu a zákazy příjezdu/odjezdu, volné apartmány (`calendar/availability`).
- Z CMS zůstávají sazby (flexibilní/nevratná a jejich sleva), sleva za přímou rezervaci, doplňky a fotky. Typ apartmánu se páruje přes pole „Previo ID“ (obkId) v ceníku.
- Děti se počítají jako kategorie 3–17 let (formulář věk nezjišťuje).
- **Platba** (`Hotel.getPaymentMethods`, podle sezóny příjezdu): povolené způsoby (převod / online), výše zálohy a splatnost. U ČD je to 30 % kartou i převodem, splatnost 3 dny; zbytek se doplácí na místě. Nevratná sazba se platí vždy celá. V CMS zůstávají texty, číslo účtu a možnost způsob platby vypnout.
- **Doplňky** (`Hotel.getPackages`): doplněk s vyplněným „Previo ID služby“ bere cenu i jednotku z Previo (např. pes 290 Kč za noc). Pořadí: Previo → Reservio → CMS.
- **Hotel** (`Hotel.get`): čas příjezdu a odjezdu (zápis rezervace, časy wellness) a uzávěrka online rezervací s příjezdem na dnešek (u ČD 18:00).
- Přehled ID a nastavení z Previo: `node scripts/previo-info.mjs [resort] [od] [do]`.

**Testování**
- `npm run test:platba`: celý tok proti simulované bráně (bez internetu a bez klíčů).
- `npm run dev`: lokální web s funkcemi na http://localhost:8888/cerveny-dvur/rezervace.html. Klíče se berou z `.env` (vzor v `.env.example`).
- Testovací karta iBrány: `4000 0070 0001 0006` (bez 3DS hesla), libovolná budoucí platnost. CVC 200 = zamítnuto, 300 = nedostatek prostředků, jiné CVC = úspěch. Karta `4000 0070 0003 0004` chce 3DS heslo `1234`.
- Klíče ČSOB: pár klíčů se generuje na https://iplatebnibrana.csob.cz/keygen (test) / https://platebnibrana.csob.cz/keygen (ostrý provoz). Veřejné klíče brány jsou v `netlify/lib/csob-keys.mjs`.

**Před ostrým provozem ověřit na testovacím hotelu Previo:** tvar odpovědi `Hotel.getRates` (ceny), zápis platby `invoice/addPayment` (typ dokladu `PREVIO_DOKLAD_KARTA`, výchozí 4 = zálohový doklad) a vystavení zálohového listu.

## Wellness k pobytu – Reservio

Privátní wellness koupené v rezervaci pobytu (doplněk) se rezervuje v Reservio přímo z našeho webu:

- Host si v kroku *Doplňky* zvolí **počet vstupů** (max. podle CMS, pole *Max. počet kusů*) a rovnou může vybrat čas z volných termínů Reservio. Nabízí se jen časy v době pobytu: v den příjezdu od 14:00, v den odjezdu do 10:00 (s pozdním check-outem do 12:00). Když je v době pobytu wellness plné, doplněk nejde přidat.
- Rezervace v Reservio se založí **zdarma** (wellness je zaplacené v pobytu). V poznámce je „Uhrazeno v rámci pobytu“, číslo rezervace z Previo a číslo objednávky webu. Při platbě kartou se rezervace založí po zaplacení, u převodu hned (s poznámkou „Hradí se v rámci zálohy na pobyt“).
- Časy, které host nevybral, si vybere později na stránce s potvrzením rezervace. Jde to jen do počtu zaplacených vstupů (2 vstupy = 2 rezervace).
- Samostatné wellness bez pobytu se dál prodává přes Reservio (platba kartou přes jejich bránu).
- Reservio neumí zrušit rezervaci přes API. Při zrušení pobytu je potřeba zrušit wellness ručně v Reservio.

**Ukázkový režim (bez klíče):** `npm run dev` ho zapne sám, když v `.env` není `RESERVIO_TOKEN`. Wellness pak ukáže vymyšlené volné časy (pá a so odpoledne „obsazeno“) a do Reservio se nic nezapisuje. Na náhledu Netlify ho zapne proměnná `RESERVIO_DEMO=1`. Na produkci ji nenastavujte.

**Testování s ostrým tokenem:** `RESERVIO_JEN_CIST=1` (v `.env` je zapnuté) načítá živé volné časy, ale rezervace se do Reservio nezapisují, jen se vypíšou do konzole. Na produkci tuhle proměnnou nenastavujte.

**Nastavení**
1. Na Netlify: `RESERVIO_TOKEN` (token od podpory Reservio, tarif Pro) a `RESERVIO_BUSINESS_ID`.
2. Lokálně s tokenem v `.env` vypíše `node scripts/reservio-sluzby.mjs` ID podniku a ID služeb.
3. V CMS u doplňku (např. *Privátní wellness 90 min*) vyplnit **Reservio ID služby**. *Privátní wellness 90 min* je napojené na službu „Pro ubytované - Privátní wellness 90 minut“. Bez něj doplněk funguje jako dřív (čas domluví recepce).

**Ověřit s ostrým tokenem:** že Reservio přijme cenu 0 (`cost`), a formát filtru data u `availability/booking-slots`.

## Obchodní a storno podmínky

V patičce všech stránek Červeného dvora je odkaz **Obchodní a storno podmínky**. Otevře se z něj okno, stejně jako odkaz u souhlasu v rezervaci.

- Se zapnutým Previo (`PREVIO_LIVE=1`) se storno pravidla i doplňující text berou z Previo (`Hotel.getConditions`, funkce `netlify/functions/podminky.mjs`). Web pak říká totéž co voucher a storno věta jde i do souhrnu rezervace.
- Bez Previo, nebo když neodpoví, se použije text z CMS: *Rezervace → Obchodní a storno podmínky*.
- **Zpracování osobních údajů**: text se vyplňuje v CMS (*Rezervace → Zpracování osobních údajů*). Dokud je prázdný, odkaz se nezobrazí.

## Rezervační komponenta (všechny resorty)

Rezervace s platbou a wellness je jedna sdílená komponenta: `assets/booking/booking.js` a `assets/booking/booking.css`. Používá ji **Červený dvůr** i **Vila Republika** (místo okna Previa) a stejně ji později dostane **Soutok Kouty**.

**Co komponenta dělá:** termín (kalendář) → apartmány a sazby → doplňky (wellness s počtem vstupů a výběrem času z Reservia) → údaje a platba (karta ČSOB / převod) → výsledek. Ceny a volné apartmány počítá vždy server (`/.netlify/functions/rezervace?resort=…`): živě z Previa, jinak z ceníku v CMS.

**Vzhled** bere z webu, na kterém je: CSS proměnné `--navy --navy-2 --paper --red --red-2 --ink --muted --line --disp --body` a tlačítka `.btn` / `.btn.red`. Oba weby je mají, takže komponenta vypadá v každém resortu „jeho“ barvami a písmem.

**Data resortu (CMS):**
- `<resort>/data/rezervace.json` obsahuje ceník (`typy`, volitelně `ceny_osoby` = cena podle počtu osob), `sazby` (Se snídaní / Bez snídaně, Flexibilní / Nevratná −10 %), doplňky (wellness s `reservio_sluzba` a `max_ks`), platbu a podmínky.
- `<resort>/data/apartmany.json` obsahuje fotky, popisy a počet osob. Ceník páruje apartmány podle **názvu**.
- `nastaveni.json` obsahuje kontakt a odkaz na Reservio. Volitelně `balicky.json`.

**Proměnné prostředí** podle resortu. Bez přípony = Červený dvůr, přípona `_VR` = Vila Republika:
`PREVIO_LIVE_VR`, `PREVIO_API_KEY_VR` (jinak společný), `PREVIO_HOTEL_ID_VR` (výchozí 758539), `RESERVIO_TOKEN_VR`, `RESERVIO_BUSINESS_ID_VR`. ČSOB je společná (oba resorty provozuje Mori Reality s.r.o.).

**Netlify formuláře** (e-maily recepci): Červený dvůr `rezervace` a `platba`, Vila `rezervace-vila-republika` a `platba-vila-republika`. Upozornění zapněte v Netlify pro každý zvlášť, aby šla na správnou recepci.

**Nový resort (např. Soutok Kouty):**
1. Do `netlify/lib/resorty.mjs` přidat záznam (id, název, přípona proměnných, Previo hotel, check-in/out, stránka rezervace) a import jeho dat.
2. Vytvořit `<resort>/data/rezervace.json` (vzor: Vila) a sekci v CMS.
3. Na stránku rezervace dát `<link … booking.css>`, `<div id="nmr-booking" data-resort="<id>"></div>`, skripty `datepicker.js` + `booking.js` a skryté Netlify formuláře `rezervace-<id>` a `platba-<id>` (vzor: `vila-republika/rezervace.html`).
4. Ověřit: `npm run test:platba`.

**Vila Republika – co doplnit:**
- Cenu apartmánu **Prvorepublikový** (v den převzetí z Previa byl obsazený, dokud nemá cenu, rezervace ho nenabízí).
- Telefon recepce v CMS (bez něj komponenta ukazuje e-mail).
- Ověřit `sleva_primo` (5 %): ceník je převzatý z Previa jako cena „na portálech“.

## Větší skupiny a křížový prodej

- **Dva apartmány:** od 5 hostů (nebo když se skupina nevejde do jednoho apartmánu) nabídne rezervace i kombinace dvou apartmánů, třeba 2× Komfort pro 4 + 4 osoby. Cena je součet obou, v Previu se založí jedna skupinová rezervace se dvěma pokoji. Dva stejné apartmány se nabídnou jen tehdy, když jsou volné dvakrát (v ceníku pole *Počet apartmánů*).
- **Křížový prodej pobytu:** když v resortu nic nevyjde (ani dva apartmány), ukáže se nabídka ostatních resortů na stejný termín s odkazem na jejich rezervaci. Opravdové „plno“ pozná web až s napojeným Previem. Do té doby se křížový prodej ukáže hlavně u velkých skupin.
- **Křížový prodej wellness:** doplněk wellness má v CMS pole *Alternativa v jiném resortu* a *Mimo provoz*. Když je wellness v době pobytu plné nebo mimo provoz (např. nejde vířivka), nabídne se wellness ve druhém resortu. Host si ho přidá k pobytu (cena podle Reservia toho resortu) a čas se zarezervuje v Reserviu druhého resortu s poznámkou, kde host bydlí.
- Měření v dataLayer: `cross_sell_zobrazeno`, `cross_sell_klik`, `cross_sell_wellness_zobrazeno`, `cross_sell_wellness_klik`.
