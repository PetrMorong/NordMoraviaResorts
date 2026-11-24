/* Rezervační komponenta Nord Moravia Resorts – vlastní rezervace s platbou (ČSOB / převod) a wellness z Reservio.
   Stejná pro všechny resorty (Červený dvůr, Vila Republika, později Soutok Kouty).

   Použití na stránce resortu:
     <link rel="stylesheet" href="../assets/booking/booking.css">
     <div id="nmr-booking" data-resort="vila-republika"></div>
     <script src="../assets/datepicker.js"></script>
     <script src="../assets/booking/booking.js"></script>
   + skryté Netlify formuláře (viz README → Rezervační komponenta), aby Netlify posílalo e-maily recepci.

   Data: <resort>/data/nastaveni.json (kontakt, reservio_url), rezervace.json (ceník, doplňky, platba, podmínky),
   volitelně balicky.json. Ceny a volné apartmány počítá server: /.netlify/functions/rezervace?resort=…
   Barvy a písma bere komponenta z CSS proměnných webu (--navy, --red, --paper, --line, --disp…) a tlačítka z .btn. */
window.NMRBooking = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const img = (src, w, h) => !src ? '' : /^(https?:|\/|images\/)/.test(src) ? src
    : `https://res.cloudinary.com/morireality/image/upload/f_auto,q_auto,c_fill,g_auto,w_${w}${h ? ',h_' + h : ''}/${src}`;
  const kc = n => Math.round(n).toLocaleString('cs-CZ') + ' Kč';
  const iso = d => d.toISOString().slice(0, 10);
  const plus = (s, n) => { const d = new Date(s + 'T12:00'); d.setDate(d.getDate() + n); return iso(d); };
  const nights = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
  const dLong = s => new Date(s + 'T12:00').toLocaleDateString('cs-CZ', {weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric'});
  const dShort = s => new Date(s + 'T12:00').toLocaleDateString('cs-CZ');
  const hm = i => new Date(i).toLocaleTimeString('cs-CZ', {timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit'});
  const dayL = d => new Date(d + 'T12:00').toLocaleDateString('cs-CZ', {weekday: 'short', day: 'numeric', month: 'numeric'});
  const casL = i => `${dayL(new Date(i).toLocaleDateString('sv-SE', {timeZone: 'Europe/Prague'}))} ${hm(i)}`;
  const nocí = n => `${n} ${n === 1 ? 'noc' : n < 5 ? 'noci' : 'nocí'}`;
  const getJSON = (u, o) => fetch(u, {headers: {accept: 'application/json'}, ...o}).then(r => r.json());
  // Netlify formuláře: Červený dvůr má historické názvy, ostatní resorty s příponou
  const formName = (resort, n) => resort === 'cerveny-dvur' ? n : `${n}-${resort}`;

  // ---------- okno s obchodními a storno podmínkami (z Previo, jinak z CMS) ----------
  const _podm = {};
  async function podminkyData(resort, R) {
    if (_podm[resort]) return _podm[resort];
    const f = await getJSON(`/.netlify/functions/podminky?resort=${resort}`).catch(() => null);
    return (_podm[resort] = f && f.html ? f : {storno: [], html: (R.podminky_text || [R.podminky]).filter(Boolean).map(t => `<p>${esc(t)}</p>`).join(''), ochrana: R.ochrana_udaju || []});
  }
  async function podminky(resort, R, co = 'podminky') {
    const P = await podminkyData(resort, R);
    let d = document.getElementById('bk-modal');
    if (!d) {
      d = document.createElement('dialog'); d.id = 'bk-modal'; d.className = 'bk-modal';
      d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
      document.body.append(d);
    }
    const o = co === 'ochrana';
    d.innerHTML = `<div class="bk-modal-box" role="document"><header><h2>${o ? 'Zpracování osobních údajů' : 'Obchodní a storno podmínky'}</h2><button type="button" data-close aria-label="Zavřít">×</button></header>
      <div class="bk-modal-body">${o ? P.ochrana.map(t => `<p>${esc(t)}</p>`).join('')
        : `${P.storno.length ? `<h3>Storno podmínky</h3><ul>${P.storno.map(t => `<li>${esc(t)}</li>`).join('')}</ul><h3>Doplňující obchodní podmínky</h3>` : ''}${P.html}`}</div>
      <footer><button type="button" class="btn red" data-close>Zavřít</button></footer></div>`;
    d.showModal();
  }

  // ---------- markup ----------
  const markup = (resort, nadpis) => `
  <section class="bk-head"><div class="wrap">
    <ol class="bk-steps" data-el="steps"><li class="on">Termín</li><li>Apartmán</li><li>Doplňky</li><li>Údaje</li></ol>
    <h1 class="title" data-el="h1">${nadpis}</h1>
    <p class="bk-perks" data-el="perks"></p>
  </div></section>
  <section class="bk"><div class="wrap bk-grid">
    <div class="bk-main">
      <div class="bk-pkg" data-el="pkg" hidden></div>
      <form class="bk-card" data-el="s1">
        <h2>1 · Termín a hosté</h2>
        <div class="bk-fields">
          <label>Příjezd<input type="date" name="od" data-el="od" required></label>
          <label>Odjezd<input type="date" name="do" data-el="do" required></label>
          <label>Dospělí<select name="dospeli" data-el="dosp"></select></label>
          <label>Děti<select name="deti" data-el="deti"></select></label>
        </div>
        <p class="bk-err" data-el="s1err" hidden></p>
        <button class="btn red arrow" type="submit">Zobrazit volné apartmány</button>
      </form>
      <div class="bk-card" data-el="s2" hidden><h2>2 · Vyberte apartmán</h2><p class="bk-note" data-el="s2note"></p><div class="bk-rooms" data-el="rooms"></div></div>
      <div class="bk-card" data-el="s3" hidden><h2>3 · Doplňky k pobytu</h2><div class="bk-extras" data-el="extras"></div><button class="btn red arrow" type="button" data-el="s3next">Pokračovat k údajům</button></div>
      <form class="bk-card" data-el="s4" name="${formName(resort, 'rezervace')}" method="POST" hidden>
        <h2>4 · Vaše údaje</h2>
        <input type="hidden" name="form-name" value="${formName(resort, 'rezervace')}">
        <p hidden><label>Nevyplňujte<input name="bot"></label></p>
        <input type="hidden" name="souhrn" data-el="fsouhrn"><input type="hidden" name="cena" data-el="fcena"><input type="hidden" name="objednavka" data-el="fobj">
        <div class="bk-fields two">
          <label>Jméno<input name="jmeno" autocomplete="given-name" required></label>
          <label>Příjmení<input name="prijmeni" autocomplete="family-name" required></label>
          <label>E-mail<input type="email" name="email" autocomplete="email" required></label>
          <label>Telefon<input type="tel" name="telefon" autocomplete="tel" required></label>
        </div>
        <label class="bk-wide">Poznámka<textarea name="poznamka" rows="3" placeholder="Čas příjezdu, přání k pobytu…"></textarea></label>
        <details class="bk-firm"><summary>Fakturovat na firmu</summary><div class="bk-fields two"><label>Firma<input name="firma"></label><label>IČO<input name="ico" inputmode="numeric"></label></div></details>
        <fieldset class="bk-pay" data-el="pay" hidden>
          <legend>Způsob platby</legend>
          <label class="bk-x" data-el="paykarta"><input type="radio" name="zpusob" value="karta"><span><b>Online platba kartou</b><small data-el="paykartatxt"></small></span><em></em></label>
          <label class="bk-x" data-el="payprevod"><input type="radio" name="zpusob" value="prevod"><span><b>Bankovní převod</b><small data-el="payprevodtxt"></small></span><em></em></label>
          <p class="bk-note" data-el="paynote"></p>
          <p class="bk-test" data-el="paytest" hidden>Testovací režim: platba kartou neprobíhá doopravdy. Použijte kartu <b>4000 0070 0001 0006</b>, libovolnou budoucí platnost a CVC (např. 123).</p>
        </fieldset>
        <label class="bk-check"><input type="checkbox" name="souhlas" required> <span>Souhlasím s <a href="#" data-el="cond">obchodními a storno podmínkami</a> a se zpracováním osobních údajů pro účely rezervace.</span></label>
        <label class="bk-check"><input type="checkbox" name="newsletter" value="ano"> <span>Chci občas dostat tip na akci nebo nový balíček (max. 1× měsíčně).</span></label>
        <p class="bk-err" data-el="s4err" hidden></p>
        <button class="btn red arrow" type="submit" data-el="s4btn">Odeslat rezervaci</button>
        <p class="bk-note" data-el="s4note"></p>
      </form>
      <div class="bk-card bk-done" data-el="done" hidden></div>
    </div>
    <aside class="bk-sum" data-el="sum"><h3>Váš pobyt</h3><div data-el="sumbody"><p class="bk-note">Vyberte termín a počet hostů.</p></div><div class="bk-help">Potřebujete poradit? <a data-el="tel"></a></div></aside>
  </div></section>`;

  // ---------- komponenta ----------
  async function mount(root, opts = {}) {
    const resort = opts.resort || root.dataset.resort || 'cerveny-dvur';
    const data = opts.data || root.dataset.data || 'data/';
    const stranka = location.pathname.split('/').pop() || 'rezervace.html';
    const load = n => fetch(data + n + '.json', {cache: 'no-cache'}).then(r => r.ok ? r.json() : null).catch(() => null);
    const [N, R, B0] = await Promise.all([load('nastaveni'), load('rezervace'), load('balicky')]);
    const B = B0 && B0.balicky ? B0.balicky : [];
    const K = N.kontakt || {}, telefon = K.telefon || '', tel = telefon.replace(/\s/g, '');
    const push = (event, extra = {}) => { (window.dataLayer = window.dataLayer || []).push({event, resort, ...extra}); };
    const api = (fn, q = '') => `/.netlify/functions/${fn}?resort=${resort}${q ? '&' + q : ''}`;

    root.innerHTML = markup(resort, opts.nadpis || 'Rezervace <em>napřímo</em>');
    const $ = k => root.querySelector(`[data-el="${k}"]`);
    $('perks').textContent = opts.perks || R.perks || `O ${R.sleva_primo || 5} % levněji než na portálech · zvýhodněné wellness · bez poplatků`;
    $('tel').href = 'tel:' + tel; $('tel').textContent = telefon || K.email || '';
    if (!telefon && K.email) $('tel').href = 'mailto:' + K.email;
    const kontakt = telefon || K.email || 'recepci';

    const q = new URLSearchParams(location.search);
    let PAY = null;
    const payReady = getJSON(api('platba')).then(j => { if (j && (j.karta || j.prevod)) PAY = j; }).catch(() => {});
    // ceny wellness podle Reservio (stejné počítá i server) – bez napojení zůstane cena z CMS
    const cenyReady = getJSON(api('wellness', 'ceny=1')).then(j => { if (j && j.ceny) (R.doplnky || []).forEach(x => { if (j.ceny[x.id]) x.cena = j.ceny[x.id]; }); }).catch(() => {});
    // „hoste“ posílá vyhledávání na úvodu NMR (celkový počet) – bereme jako dospělé
    // až dvojnásobek největšího apartmánu – větší skupině nabídneme dva apartmány
    const maxOs = Math.max(8, 2 * Math.max(0, ...(R.typy || []).map(t => +t.max_osob || 0)));
    const S = {od: q.get('od') || '', do: q.get('do') || '', dospeli: Math.min(+q.get('dospeli') || +q.get('hoste') || 2, maxOs), deti: +q.get('deti') || 0,
      balicek: B.find(b => b.id === q.get('balicek') && b.aktivni) || null, room: null, rate: null, extra: {}, ks: {}, wcas: {}, wpref: {}, live: false, offer: null};
    const err = (k, t) => { $(k).textContent = t; $(k).hidden = false; };

    // ---- krok 1: termín ----
    $('dosp').innerHTML = Array.from({length: maxOs}, (_, i) => i + 1).map(n => `<option${n === S.dospeli ? ' selected' : ''}>${n}</option>`).join('');
    $('deti').innerHTML = [0, 1, 2, 3, 4, 5, 6].map(n => `<option${n === S.deti ? ' selected' : ''}>${n}</option>`).join('');
    const today = iso(new Date());
    const minNoci = () => S.balicek ? S.balicek.noci_min : (R.min_noci || 1);
    $('od').min = today;
    if (!S.od) S.od = plus(today, 7);
    if (!S.do || S.do <= S.od) S.do = plus(S.od, minNoci());
    $('od').value = S.od; $('do').value = S.do;
    $('od').addEventListener('change', () => { if ($('do').value <= $('od').value) $('do').value = plus($('od').value, minNoci()); $('do').min = plus($('od').value, 1); });
    $('cond').onclick = e => { e.preventDefault(); podminky(resort, R); };
    // storno pravidla z Previo (stejná jako na voucheru) i do souhrnu
    podminkyData(resort, R).then(P => { if (P.storno && P.storno.length) { R.podminky = P.storno.join('. ') + '.'; sum(); } }).catch(() => {});

    const pkgFixed = b => b && /^\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/.test(b.termin) ? b.termin.split('/') : null;
    let DP = Promise.resolve({refresh() {}});
    const renderPkg = () => {
      const b = S.balicek;
      if (!b) { $('pkg').hidden = true; return; }
      $('h1').innerHTML = `Balíček <em>${esc(b.nazev)}</em>`;
      $('pkg').hidden = false;
      $('pkg').innerHTML = `<img src="${img(b.foto, 300, 220)}" alt=""><div><small>Rezervujete balíček</small><b>${esc(b.nazev)}</b><span>${esc((b.obsahuje || []).slice(1, 4).join(' · '))}</span></div><a href="${stranka}" data-el="pkgoff">Jen ubytování</a>`;
      $('pkgoff').onclick = e => { e.preventDefault(); S.balicek = null; history.replaceState(null, '', stranka); $('h1').innerHTML = opts.nadpis || 'Rezervace <em>napřímo</em>'; $('od').readOnly = $('do').readOnly = false; renderPkg(); DP.then(d => d.refresh()); if (!$('s2').hidden) search(); };
      const f = pkgFixed(b);
      if (f) { $('od').value = f[0]; $('do').value = f[1]; $('od').readOnly = $('do').readOnly = true; }
    };
    renderPkg();
    // kalendář (easepick) – celé pole, rozsah příjezd–odjezd, min. počet nocí; bez knihovny zůstane kalendář prohlížeče
    if (window.NMRDate) DP = NMRDate.range($('od'), $('do'), {minNoci: minNoci()});

    // ---- krok 2: nabídka (ceny počítá server – živě z Previo, nebo z ceníku v CMS) ----
    const search = async () => {
      // na ceny wellness z Reservio čekáme nejvýš 2,5 s (pomalé Reservio nesmí zablokovat rezervaci – cenu stejně přepočítá server)
      await Promise.race([cenyReady, new Promise(r => setTimeout(r, 2500))]); await payReady;
      const n = nights(S.od, S.do), b = S.balicek;
      $('s1err').hidden = true;
      if (n < 1) return err('s1err', 'Odjezd musí být po příjezdu.');
      if (b && (n < b.noci_min || n > b.noci_max)) return err('s1err', `Balíček ${b.nazev} je na ${b.noci_min === b.noci_max ? b.noci_min : b.noci_min + '–' + b.noci_max} nocí.`);
      if (!b && R.min_noci && n < R.min_noci) return err('s1err', `Minimální délka pobytu je ${nocí(R.min_noci)}.`);
      S.room = S.rate = null; S.extra = {}; S.ks = {}; S.wcas = {}; S.wpref = {};
      const p = new URLSearchParams({od: S.od, do: S.do, dospeli: S.dospeli, deti: S.deti, ...(b ? {balicek: b.id} : {})});
      const j = await getJSON(api('rezervace', p)).catch(() => null);
      if (!j || !j.typy) return err('s1err', (j && j.chyba) || `Nabídku se teď nepodařilo načíst. Zkuste to prosím za chvíli, nebo nám napište či zavolejte (${kontakt}).`);
      S.offer = j.typy; S.live = j.rezim === 'live'; S.jine = j.jine || [];
      push('hledani_terminu', {od: S.od, do: S.do, hoste: S.dospeli + S.deti, balicek: b ? b.id : ''});
      renderRooms(); step(2);
    };
    $('s1').addEventListener('submit', e => { e.preventDefault(); S.od = $('od').value; S.do = $('do').value; S.dospeli = +$('dosp').value; S.deti = +$('deti').value; search(); });

    // ikonky (čárové, barva podle webu) – strava a storno místo dlouhých textů
    const ICO = {
      bez: '<path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 14h18M3 18v2M21 18v2M7 10V7.5A1.5 1.5 0 0 1 8.5 6h2A1.5 1.5 0 0 1 12 7.5V10"/>',
      snidane: '<path d="M4 9h12v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9zM16 10.5h1.5a2.5 2.5 0 0 1 0 5H15.6M8 3.5c-.6.8-.6 1.7 0 2.5M12 3.5c-.6.8-.6 1.7 0 2.5M3 21h14"/>',
      polopenze: '<path d="M7 3v18M4.5 3v5a2.5 2.5 0 0 0 5 0V3M17 21V3c-2.2 1.4-3.3 4-3.3 7.2 0 2 1 2.8 3.3 2.8"/>',
      balicek: '<path d="M4 11h16v10H4zM3 7h18v4H3zM12 7v14M12 7S10.5 3 8 3a2 2 0 0 0 0 4h4zm0 0s1.5-4 4-4a2 2 0 0 1 0 4h-4z"/>',
      flex: '<path d="M12 3l7 3v5.5c0 4.3-3 7.7-7 9.5-4-1.8-7-5.2-7-9.5V6l7-3z"/><path d="M8.8 12l2.2 2.2 4.2-4.4"/>',
      nevratna: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',
    };
    const ico = k => `<svg class="bk-ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICO[k] || ICO.bez}</svg>`;
    const STRAVA = {bez: 'Bez stravy', snidane: 'Se snídaní', polopenze: 'S polopenzí'};
    // doporučená strava (výrazné tlačítko + štítek) – CMS: doporucena_strava, výchozí snídaně
    const dopor = R.doporucena_strava === '' ? null : (R.doporucena_strava || 'snidane');
    // nevratná sazba se nabízí jen s platbou předem (karta nebo převod se splatností)
    const nevratnaLze = () => !!(PAY && (PAY.karta || PAY.prevod));
    const renderRooms = () => {
      const n = nights(S.od, S.do), os = S.dospeli + S.deti;
      $('s2note').textContent = S.live ? `${nocí(n)} · ceny a volné apartmány v reálném čase` : `${nocí(n)} · ${os} ${os < 5 ? 'osoby' : 'osob'} · dostupnost potvrdí recepce do 24 hodin`;
      if (!S.offer.length) {
        // křížový prodej: u nás plno → stejný termín v ostatních resortech sítě
        const q2 = new URLSearchParams({od: S.od, do: S.do, dospeli: S.dospeli, deti: S.deti});
        $('rooms').innerHTML = `<p class="bk-note">Pro ${os} ${os < 5 ? 'osoby' : 'osob'} v tomto termínu u nás nemáme volný apartmán.${S.jine.length ? ' Ale v našem dalším resortu ano:' : ` Zkuste jiný termín nebo nás kontaktujte (${esc(kontakt)}) – rádi najdeme řešení.`}</p>
          ${S.jine.map(x => `<div class="bk-cross"><div class="bk-cross-h"><b>${esc(x.nazev)}</b><small>${esc(x.misto || '')} · od ${kc(x.od)} za ${nocí(n)}</small></div>
            <div class="bk-cross-list">${x.typy.map(t => `<a class="bk-cross-apt" href="${esc(x.stranka)}?${q2}&apt=${encodeURIComponent(t.nazev)}" data-cross="${esc(x.resort)}">
              <img src="${img(t.foto, 320, 220)}" alt="" loading="lazy"><span><b>${esc(t.nazev)}</b><small>${t.osoby ? esc(t.osoby) + ' osob · ' : ''}od ${kc(t.cena)}</small></span></a>`).join('')}</div>
            <a class="btn red arrow" href="${esc(x.stranka)}?${q2}" data-cross="${esc(x.resort)}">Zobrazit volno – ${esc(x.nazev)}</a></div>`).join('')}`;
        if (S.jine.length) push('cross_sell_zobrazeno', {cil: S.jine.map(x => x.resort).join(',')});
        $('rooms').querySelectorAll('[data-cross]').forEach(a => a.addEventListener('click', () => push('cross_sell_klik', {cil: a.dataset.cross})));
        return;
      }
      // sazby jako tabulka podle Previa: vlevo podmínky zrušení (jedna buňka pro skupinu), vpravo řádky cena · strava · tlačítko
      const skupina = (t, i, nevr) => {
        const rows = t.sazby.map((r, k) => ({r, k})).filter(({r}) => !!r.nevratna === nevr && (!nevr || nevratnaLze()))
          .sort((x, y) => ['bez', 'snidane', 'polopenze'].indexOf(x.r.strava) - ['bez', 'snidane', 'polopenze'].indexOf(y.r.strava));
        if (!rows.length) return '';
        const bal = rows[0].r.strava === 'balicek';
        const sleva = nevr && Math.max(...rows.map(({r}) => r.sleva || 0));
        const pol = bal ? `${ico('balicek')}<span><b>${esc(rows[0].r.nazev)}</b><small>${esc(rows[0].r.popis || '')}</small></span>`
          : nevr ? `${ico('nevratna')}<span><b>Nejnižší cena${sleva ? ` · −${sleva} %` : ''}</b><small>Bez možnosti storna</small></span>`
          : `${ico('flex')}<span><b>Flexibilní</b><small>${esc(R.storno_kratce || 'Zrušení zdarma podle storno podmínek')}</small></span>`;
        return `<div class="bk-rgroup${nevr ? ' nevr' : ''}"><div class="bk-rpol">${pol}</div><div class="bk-rrows">
          ${rows.map(({r, k}) => `<div class="bk-rate">
            <div class="bk-rate-p"><b>${kc(r.cena)}</b></div>
            <div class="bk-rate-l${r.strava === 'snidane' || r.strava === 'polopenze' ? ' jidlo' : ''}">${bal ? '' : ico(r.strava) + `<span>${STRAVA[r.strava] || esc(r.nazev)}</span>` + (r.strava === dopor ? '<em class="bk-tag">Nejoblíbenější</em>' : '')}</div>
            <button class="btn ${bal || r.strava === dopor ? 'red' : 'bk-btn2'}" type="button" data-r="${i}" data-k="${k}">Vybrat</button>
          </div>`).join('')}</div></div>`;
      };
      const tabulka = (t, i) => `<div class="bk-rtable"><div class="bk-rth"><span>Podmínky zrušení</span><span>Cena za ${nocí(n)}</span><span>Strava</span><span></span></div>
        ${skupina(t, i, true)}${skupina(t, i, false)}</div>`;
      const prvniKomb = S.offer.findIndex(t => t.kombinace);
      $('rooms').innerHTML = S.offer.map((t, i) => {
        const r0 = t.sazby[0], primo = r0 && r0.portal > r0.cena + 1 ? Math.round((1 - r0.cena / r0.portal) * 100) : 0;
        // větší skupina: nabídka dvou apartmánů (např. 4 + 4) pod jednotlivými apartmány
        const nadpis = i === prvniKomb ? `<h3 class="bk-komb-h">${prvniKomb ? 'Nebo ve dvou apartmánech' : 'Ve dvou apartmánech'}<small>Pro větší skupiny – každý má své soukromí, platíte jednou rezervací.</small></h3>` : '';
        return `${nadpis}<article class="bk-room${t.kombinace ? ' komb' : ''}">
          <div class="bk-room-img"><img src="${img(t.foto, 560, 420)}" alt="${esc(t.nazev)}" loading="lazy">${t.kombinace && t.foto2 ? `<img class="bk-img2" src="${img(t.foto2, 280, 210)}" alt="" loading="lazy">` : ''}${t.kombinace ? '<span class="bk-2apt">2 apartmány</span>' : ''}${t.volno != null && t.volno <= 2 ? `<span>${t.volno === 1 ? 'Poslední volný' : 'Zbývají 2'}</span>` : ''}</div>
          <div class="bk-room-body">
            <h3>${esc(t.nazev)}${primo ? ` <em class="bk-chip" title="Oproti cenám na portálech">−${primo} % napřímo</em>` : ''}</h3>
            <p class="bk-room-meta">${t.osoby ? esc(t.osoby) + ' osob' + (/^\d$/.test(t.osoby) && +t.osoby < 5 ? 'y' : '') : ''}${t.plocha ? ' · ' + esc(t.plocha) : ''}</p>
            <p class="bk-room-txt">${esc(t.popis || '')}</p>
          </div>
          ${tabulka(t, i)}
        </article>`;
      }).join('');
      $('rooms').querySelectorAll('[data-r]').forEach(bt => bt.onclick = () => {
        S.room = S.offer[+bt.dataset.r]; S.rate = S.room.sazby[+bt.dataset.k];
        push('vyber_apartmanu', {apartman: S.room.nazev, sazba: S.rate.nazev, value: Math.round(S.rate.cena), currency: 'CZK'});
        renderExtras(); step(3);
      });
      // příchod z karty apartmánu na úvodu (?apt=…) – apartmán zvýrazníme a sjedeme na něj (jen poprvé)
      const apt = q.get('apt');
      if (apt && !S.aptShown) {
        S.aptShown = true;
        const el = $('rooms').children[S.offer.findIndex(t => t.nazev === apt)];
        if (el) { el.classList.add('hl'); setTimeout(() => el.scrollIntoView({behavior: 'smooth', block: 'center'}), 900); }
        else $('s2note').textContent += ` · ${apt} v tomto termínu není volný – vyberte prosím jiný apartmán nebo termín`;
      }
    };

    // ---- krok 3: doplňky (wellness z Reservio: počet vstupů + výběr času v době pobytu) ----
    const D = R.doplnky || [];
    const exOne = x => { const n = nights(S.od, S.do); return x.jednotka === 'noc' ? x.cena * n : x.jednotka === 'osoba' ? x.cena * S.dospeli : x.cena; };
    const ks = x => Math.min(S.ks[x.id] || 1, x.max_ks || 1);
    const exPrice = x => exOne(x) * ks(x);
    const WC = {};
    // rs = resort, ve kterém je wellness (u křížového prodeje jiný než resort pobytu)
    const loadCasy = (id, od = S.od, doo = S.do, late = !!S.extra.late, rs = resort) => {
      const k = [rs, id, od, doo, late].join('|');
      return WC[k] || (WC[k] = getJSON(`/.netlify/functions/wellness?resort=${rs}&` + `doplnek=${encodeURIComponent(id)}&od=${od}&do=${doo}${late ? '&late=1' : ''}`).catch(() => ({zapnuto: false})));
    };
    // výběr času: nejdřív den, pak čas (Reservio nabízí časy po 15 minutách – jeden dlouhý seznam by byl nepřehledný)
    const casOpts = (d, val, taken) => `<option value="">Vyberte čas</option>` + d.casy.map(c =>
      `<option value="${esc(c.start)}"${c.start === val ? ' selected' : ''}${taken.has(c.start) && c.start !== val ? ' disabled' : ''}>${hm(c.start)}–${hm(c.end)}</option>`).join('');
    const casPicker = (dny, val, taken, first) => {
      const vd = val && dny.find(d => d.casy.some(c => c.start === val));
      return `<span class="bk-wpk"><select class="bk-wden" aria-label="Den"><option value="">${first}</option>${dny.map(d =>
        `<option value="${d.den}"${vd && vd.den === d.den ? ' selected' : ''}>${esc(dayL(d.den))} · ${d.casy.length} ${d.casy.length < 5 ? 'volné' : 'volných'}</option>`).join('')}</select>
        <select class="bk-wtime" aria-label="Čas"${vd ? '' : ' hidden'}>${vd ? casOpts(vd, val, taken) : ''}</select></span>`;
    };
    const bindPicker = (el, dny, taken, onChange) => {
      const [sd, st] = el.querySelectorAll('select');
      sd.onchange = () => { const d = dny.find(x => x.den === sd.value); st.hidden = !d; st.innerHTML = d ? casOpts(d, '', taken) : ''; onChange('', false); };
      st.onchange = () => onChange(st.value, true);
      return () => st.value;
    };
    const reservioX = x => x.reservio_sluzba || /wellness/.test(x.id); // server odpoví zapnuto:false, když není klíč ani ukázka
    const renderWellness = async x => {
      const box = $('extras').querySelector(`[data-w="${x.id}"]`);
      if (!box || !S.extra[x.id] || !reservioX(x)) { if (box) box.innerHTML = ''; return; }
      box.innerHTML = '<p class="bk-note">Načítám volné časy wellness…</p>';
      const j = await loadCasy(x._doplnek || x.id, S.od, S.do, !!S.extra.late, x._resort || resort);
      if (!S.extra[x.id]) return;
      if (!j.zapnuto || (j.chyba && !(j.dny || []).length)) {
        // bez napojení na Reservio: host napíše, kdy by chtěl jít – recepce to uvidí v souhrnu a čas potvrdí
        box.innerHTML = `<label class="bk-wpref">Kdy byste chtěli do wellness? <input type="text" maxlength="200" placeholder="${ks(x) > 1 ? 'Např. pátek večer a sobota ráno' : 'Např. sobota kolem 18:00'}" value="${esc(S.wpref[x.id] || '')}"></label>
          <p class="bk-note">Čas vám potvrdí recepce. O víkendu bývá plno – čím dřív víme, tím líp.</p>`;
        box.querySelector('input').oninput = e => { S.wpref[x.id] = e.target.value.trim(); };
        return;
      }
      if (!j.dny || !j.dny.length) {
        const proc = j.mimo_provoz ? 'je wellness teď mimo provoz' : 'je wellness v době vašeho pobytu bohužel plně obsazené';
        box.innerHTML = `<p class="bk-err">${x._resort ? 'I tady ' + proc.replace('je ', 'je ') : 'U nás ' + proc}.</p>`;
        delete S.extra[x.id]; const c = $('extras').querySelector(`input[value="${x.id}"]`); c.checked = false; c.disabled = true; sum();
        // křížový prodej wellness: alternativa v jiném resortu (CMS: doplněk → alternativa „resort:doplněk“)
        if (x.alternativa && !x._resort) {
          const [rid, did] = x.alternativa.split(':');
          const j2 = await loadCasy(did, S.od, S.do, !!S.extra.late, rid);
          if (j2 && j2.dny && j2.dny.length && j2.doplnek) {
            const alt = {id: `alt:${rid}:${did}`, nazev: `${j2.doplnek.nazev} – ${j2.resort.nazev}`, popis: j2.resort.misto || '', cena: j2.doplnek.cena, jednotka: j2.doplnek.jednotka || 'pobyt',
              max_ks: j2.doplnek.max_ks, ks_label: j2.doplnek.ks_label, reservio_sluzba: 'jiny-resort', _resort: rid, _doplnek: did};
            box.innerHTML += `<div class="bk-alt"><span><b>${esc(j2.resort.nazev)} – wellness má volno</b><small>${esc(j2.resort.misto || '')} · ${esc(j2.doplnek.nazev)} · ${kc(j2.doplnek.cena)}</small></span>
              <button class="btn red" type="button">Přidat wellness – ${esc(j2.resort.nazev)}</button></div>`;
            push('cross_sell_wellness_zobrazeno', {cil: rid});
            box.querySelector('.bk-alt button').onclick = () => {
              if (!D.some(d => d.id === alt.id)) D.splice(D.indexOf(x) + 1, 0, alt);
              S.extra[alt.id] = D.find(d => d.id === alt.id); push('cross_sell_wellness_klik', {cil: rid});
              renderExtras();
            };
          }
        }
        return;
      }
      const n = ks(x);
      const val = S.wcas[x.id] = (S.wcas[x.id] || []).slice(0, n);
      const taken = new Set(Object.values(S.wcas).flat().filter(Boolean));
      box.innerHTML = `<p class="bk-note">${n > 1 ? 'Vyberte čas pro každý vstup' : 'Vyberte si čas'} – o víkendu bývá plno, doporučujeme vybrat hned. Čas jde vybrat i později na stránce s potvrzením rezervace.</p>
        ${j.demo ? '<p class="bk-test">Ukázka: časy jsou vymyšlené a do Reservio se nic nezapisuje (zatím není klíč k Reservio API).</p>' : ''}
        <div class="bk-wcas">${Array.from({length: n}, (_, i) => `<div class="bk-wslot"><b>${n > 1 ? `${i + 1}. vstup` : 'Čas wellness'}</b>${casPicker(j.dny, val[i] || '', taken, 'Vyberu později')}</div>`).join('')}</div>`;
      // po výběru času překreslíme ostatní výběry (stejný čas nejde vybrat dvakrát); po změně dne jen vynulujeme čas
      box.querySelectorAll('.bk-wpk').forEach((el, i) => bindPicker(el, j.dny, taken, (v, cas) => { S.wcas[x.id][i] = v; if (cas) renderAllWellness(); sum(); }));
    };
    const renderAllWellness = () => D.filter(x => reservioX(x) && S.extra[x.id]).forEach(renderWellness);
    const bezVBalicku = new RegExp(R.balicek_bez_doplnku || 'wellness|masaz|prosecco');
    const renderExtras = () => {
      const X = D.filter(x => !(S.balicek && bezVBalicku.test(x.id))); // co je v balíčku, nenabízíme znovu
      if (!X.length) { $('extras').innerHTML = '<p class="bk-note">K tomuto pobytu nenabízíme žádné doplňky.</p>'; sum(); return; }
      const price = x => `+ ${kc(exPrice(x))}${x.jednotka === 'osoba' && S.dospeli > 1 ? ` <small>(${S.dospeli}×)</small>` : ''}`;
      $('extras').innerHTML = X.map(x => `<div class="bk-xw"><label class="bk-x"><input type="checkbox" value="${esc(x.id)}"${S.extra[x.id] ? ' checked' : ''}>
        <span><b>${esc(x.nazev)}</b><small>${esc(x.popis || '')}</small></span><em data-p="${esc(x.id)}">${price(x)}</em></label>
        <div class="bk-xmore"${S.extra[x.id] ? '' : ' hidden'} data-more="${esc(x.id)}">${(x.max_ks || 1) > 1 ? `<label class="bk-ks">${esc(x.ks_label || 'Počet')} <select data-ks="${esc(x.id)}">${Array.from({length: x.max_ks}, (_, i) => `<option${i + 1 === ks(x) ? ' selected' : ''}>${i + 1}</option>`).join('')}</select></label>` : ''}<div data-w="${esc(x.id)}"></div></div></div>`).join('');
      $('extras').querySelectorAll('input[type=checkbox]').forEach(c => c.onchange = () => {
        const x = D.find(d => d.id === c.value);
        if (c.checked) S.extra[x.id] = x; else delete S.extra[x.id];
        $('extras').querySelector(`[data-more="${x.id}"]`).hidden = !c.checked;
        if (x.id === 'late') renderAllWellness(); else renderWellness(x); // pozdní check-out prodlouží časy v den odjezdu
        sum();
      });
      $('extras').querySelectorAll('[data-ks]').forEach(s => s.onchange = () => {
        const x = D.find(d => d.id === s.dataset.ks);
        S.ks[x.id] = +s.value; $('extras').querySelector(`[data-p="${x.id}"]`).innerHTML = price(x);
        renderWellness(x); sum();
      });
      renderAllWellness();
      sum();
    };
    $('s3next').onclick = () => { step(4); push('zacatek_rezervace', {value: Math.round(total()), currency: 'CZK'}); };

    // ---- souhrn ----
    const total = () => (S.rate ? S.rate.cena : 0) + Object.values(S.extra).reduce((a, x) => a + exPrice(x), 0);
    const sumText = () => [`${S.balicek ? 'Balíček: ' + S.balicek.nazev + '\n' : ''}Termín: ${S.od} – ${S.do} (${nocí(nights(S.od, S.do))})`, `Hosté: ${S.dospeli} dosp. + ${S.deti} dětí`,
      S.room ? `Apartmán: ${S.room.nazev} · ${S.rate.nazev} · ${kc(S.rate.cena)}` : '',
      ...Object.values(S.extra).map(x => `Doplněk: ${x.nazev}${ks(x) > 1 ? ' ×' + ks(x) : ''} · ${kc(exPrice(x))}${(S.wcas[x.id] || []).filter(Boolean).length ? ' · čas: ' + S.wcas[x.id].filter(Boolean).map(casL).join(', ') : ''}${S.wpref[x.id] ? ' · přání času: ' + S.wpref[x.id] : ''}`),
      `Celkem: ${kc(total())}`, S.live ? 'Režim: Previo' : 'Režim: k potvrzení recepcí'].filter(Boolean).join('\n');
    const sum = () => {
      const n = nights(S.od, S.do), rows = [];
      if (S.balicek) rows.push(`<div class="bk-s-pkg">${esc(S.balicek.nazev)}</div>`);
      rows.push(`<div class="bk-s-row"><span>${dLong(S.od)} → ${dLong(S.do)}</span></div>`);
      rows.push(`<div class="bk-s-row"><span>${nocí(n)} · ${S.dospeli} dosp.${S.deti ? ' + ' + S.deti + ' děti' : ''}</span></div>`);
      if (S.room) {
        rows.push(`<div class="bk-s-row strong"><span>${esc(S.room.nazev)}<small>${esc(S.rate.nazev)}</small></span><b>${kc(S.rate.cena)}</b></div>`);
        Object.values(S.extra).forEach(x => { const t = (S.wcas[x.id] || []).filter(Boolean); rows.push(`<div class="bk-s-row"><span>${esc(x.nazev)}${ks(x) > 1 ? ' ×' + ks(x) : ''}${t.length ? `<small>${t.map(casL).join(', ')}</small>` : ''}</span><b>${kc(exPrice(x))}</b></div>`); });
        const portal = S.rate.portal || S.rate.cena;
        rows.push(`<div class="bk-s-total"><span>Celkem</span><b>${kc(total())}</b></div>`);
        if (portal > S.rate.cena + 1) rows.push(`<p class="bk-s-save">Ušetříte ${kc(portal - S.rate.cena)} oproti portálům</p>`);
        rows.push(`<p class="bk-note">${esc(R.souhrn_poznamka || '')} ${esc(R.podminky || '')}</p>`);
      }
      $('sumbody').innerHTML = rows.join('');
    };

    // ---- kroky ----
    const KROKY = ['s1', 's2', 's3', 's4'];
    const step = k => {
      KROKY.forEach((id, i) => { $(id).hidden = i + 1 > k; $(id).classList.toggle('past', i + 1 < k); });
      $('steps').querySelectorAll('li').forEach((li, i) => { li.className = i + 1 < k ? 'done' : i + 1 === k ? 'on' : ''; li.onclick = i + 1 < k ? () => step(i + 1) : null; });
      sum();
      if (k > 1) $(KROKY[k - 1]).scrollIntoView({behavior: 'smooth', block: 'start'});
      if (k === 4) { $('s4note').textContent = PAY ? '' : 'Po odeslání vám do 24 hodin potvrdíme dostupnost a pošleme voucher s platebními údaji. Nic zatím neplatíte.'; payInit(); }
    };

    // ---- způsob platby ----
    const zaloha = () => Math.round(total() * (PAY ? PAY.zaloha_procent : 100) / 100);
    const zpusob = () => { const c = $('s4').querySelector('input[name=zpusob]:checked'); return c ? c.value : ''; };
    const payInit = () => {
      if (!PAY) return;
      $('pay').hidden = false;
      // převod jen s časem na úhradu (splatnost nejpozději den před příjezdem) – při příjezdu dnes/zítra jen kartou
      const prevodLze = PAY.prevod && S.od >= plus(today, PAY.prevod_min_dni || 2);
      $('paykarta').hidden = !PAY.karta; $('payprevod').hidden = !prevodLze;
      const pr = $('s4').querySelector('input[value=prevod]'); pr.disabled = !prevodLze; if (!prevodLze) pr.checked = false;
      if (!PAY.karta && !prevodLze) { $('pay').hidden = true; PAY = null; $('s4note').textContent = `Na tak brzký příjezd nás prosím kontaktujte (${kontakt}) – rezervaci rádi dokončíme. Můžete ji i odeslat a ozveme se vám.`; return; }
      $('paykartatxt').textContent = PAY.text_karta || 'Okamžitá rezervace – platba kartou přes zabezpečenou platební bránu ČSOB.';
      $('payprevodtxt').textContent = PAY.text_prevod || 'Předběžná rezervace – pošleme vám zálohový list.';
      $('s4').querySelectorAll('input[name=zpusob]').forEach(r => { r.onchange = payNote; });
      if (!zpusob()) $('s4').querySelector(`input[value=${PAY.karta ? 'karta' : 'prevod'}]`).checked = true;
      $('s4').querySelectorAll('input[name=zpusob]').forEach(r => { r.required = !r.disabled && !$(r.value === 'karta' ? 'paykarta' : 'payprevod').hidden; });
      payNote();
    };
    // splatnost převodu: za X dní (CMS), ale nejpozději den před příjezdem – stejně jako na serveru
    const splatnostText = () => { const d = [plus(today, PAY.prevod_splatnost_dni || 3), plus(S.od, -1)].sort()[0]; const n = Math.round((new Date(d + 'T12:00') - new Date(today + 'T12:00')) / 864e5); return `${n} ${n === 1 ? 'dne' : 'dnů'} (${dShort(d)})`; };
    const payNote = () => {
      const z = zpusob(), a = kc(zaloha()), part = PAY.zaloha_procent < 100;
      $('paynote').textContent = (z === 'karta'
        ? `Po odeslání přejdete na zabezpečenou platební stránku ČSOB. Pro potvrzení rezervace je třeba uhradit ${part ? 'zálohu ' : ''}${a}. Po úspěšné platbě je rezervace potvrzená a potvrzení dostanete e-mailem.`
        : `Po odeslání vám pošleme zálohový list. Výše zálohy za pobyt činí ${a}. Jakmile ji uhradíte, bude vaše rezervace potvrzena. Zálohu je potřeba uhradit do ${splatnostText()} – pokud do té doby nebude uhrazena, rezervace se automaticky zruší.`);
      $('s4btn').textContent = z === 'karta' ? `Zaplatit ${a}` : 'Dokončit rezervaci';
      $('paytest').hidden = !PAY.test || z !== 'karta';
    };

    // ---- výsledek objednávky (po převodu hned, po kartě po návratu z platební brány) ----
    const telA = telefon ? `<a href="tel:${tel}">${esc(telefon)}</a>` : esc(kontakt);
    // odkazy pod poděkováním – stránka je může dát do <template id="nmr-booking-mezitim">
    const tpl = document.getElementById('nmr-booking-mezitim');
    const mezitim = tpl ? `<p>${tpl.innerHTML.trim()}</p>` : '';
    const wellnessTip = (maWellness, prani = '') => maWellness ? `<div class="bk-tip"><b>Wellness máte v rezervaci</b><p>${prani ? `Váš požadovaný čas: <b>${esc(prani)}</b>. ` : ''}Čas wellness vám potvrdí recepce spolu s rezervací.</p></div>`
      : !R.wellness_tip || !N.reservio_url ? '' : `<div class="bk-tip"><b>Tip: privátní wellness</b><p>${esc(R.wellness_tip)}</p><a class="btn red arrow" href="${esc(N.reservio_url)}" target="_blank" rel="noopener">Rezervovat wellness</a></div>`;
    const wellnessBlok = o => (o.wellnessDemo ? '<p class="bk-test">Ukázka wellness: časy jsou vymyšlené a do Reservio se nic nezapisuje.</p>' : '') + o.wellness.map(w => `<div class="bk-tip"><b>${esc(w.nazev)} – ${w.ks}× ${o.stav === 'zaplaceno' ? 'zaplaceno v rámci pobytu' : 'v rezervaci pobytu'}</b>
      ${w.casy.length ? `<ul class="bk-wlist">${w.casy.map(c => `<li>${esc(casL(c.start))}–${hm(c.end)} <span${c.test ? ' class="bk-wtest"' : ''}>${c.stav === 'rezervovano' ? (c.test ? '✓ test – do Reservio se nezapsalo' : '✓ zarezervováno') : 'čas zaznamenán, potvrdí recepce'}</span></li>`).join('')}</ul>` : ''}
      ${w.zbyva > 0 ? (o.wellnessOnline
        ? `<p>${w.casy.length ? `Zbývá vybrat čas pro ${w.zbyva} ${w.zbyva === 1 ? 'vstup' : 'vstupy'}.` : 'Vyberte si čas.'} ${esc(R.wellness_tip || '')}</p><div class="bk-wpick" data-id="${esc(w.id)}"><p class="bk-note">Načítám volné časy…</p></div>`
        : `<p>${w.prani ? `Váš požadovaný čas: <b>${esc(w.prani)}</b>. Recepce vám ho potvrdí. Kdybyste chtěli něco změnit, kontaktujte nás:` : 'Čas wellness vám domluví recepce:'} ${telA}.</p>`) : ''}</div>`).join('');
    const bindWellnessPick = (o, t) => $('done').querySelectorAll('.bk-wpick').forEach(async box => {
      const w = o.wellness.find(x => x.id === box.dataset.id);
      const j = await loadCasy(w.doplnek || w.id, o.od, o.do, o.late, w.resort || resort);
      if (!j.dny || !j.dny.length) { box.innerHTML = `<p class="bk-err">${j.chyba ? esc(j.chyba) : 'V době vašeho pobytu už není volný žádný čas.'} Kontaktujte prosím recepci, rádi to vyřešíme.</p>`; return; }
      const taken = new Set(o.wellness.flatMap(x => x.casy.map(c => c.start)));
      box.innerHTML = `<div class="bk-wcas">${casPicker(j.dny, '', taken, 'Vyberte den')}<button class="btn red" type="button">Zarezervovat čas</button></div><p class="bk-err" hidden></p>`;
      const [btn, e] = [box.querySelector('button'), box.querySelector('.bk-err')];
      const vybrano = bindPicker(box.querySelector('.bk-wpk'), j.dny, taken, () => { e.hidden = true; });
      btn.onclick = async () => {
        if (!vybrano()) { e.textContent = 'Vyberte prosím čas.'; e.hidden = false; return; }
        btn.disabled = true; btn.textContent = 'Rezervuji…';
        const r = await getJSON('/.netlify/functions/platba', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({obj: o.obj, t, doplnek: w.id, wellnessCas: vybrano()})}).catch(() => ({}));
        delete WC[[w.resort || resort, w.doplnek || w.id, o.od, o.do, !!o.late].join('|')];
        if (r.ok) { push('wellness_cas_vybran', {doplnek: w.id}); return showResult(r, t); }
        btn.disabled = false; btn.textContent = 'Zarezervovat čas'; e.textContent = r.chyba || 'Nepodařilo se zarezervovat. Zkuste to prosím znovu.'; e.hidden = false;
      };
    });
    const showResult = (o, t, pokus = 0) => {
      KROKY.forEach(id => $(id).hidden = true);
      $('sum').hidden = true; // údaje o pobytu jsou přímo ve výsledku
      $('steps').querySelectorAll('li').forEach(li => { li.className = 'done'; li.onclick = null; });
      const info = rows => `<dl class="bk-pay-info">${rows.filter(r => r[1]).map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl>`;
      const pobyt = [['Objednávka', esc(o.obj)], o.cislo ? ['Rezervace', esc(o.cislo)] : null, ['Termín', `${dShort(o.od)} – ${dShort(o.do)}`], ['Apartmán', esc(o.apartman)]].filter(Boolean);
      const test = o.test ? '<p class="bk-test">Testovací platba – žádné peníze se nestrhly.</p>' : '';
      let h;
      if (o.stav === 'zaplaceno') {
        h = `<h2>Děkujeme, ${esc(o.jmeno)}!</h2><p>Platba proběhla v pořádku a vaše rezervace je potvrzená. Potvrzení pošleme na <b>${esc(o.email)}</b>.</p>${info([...pobyt, ['Zaplaceno', kc(o.zaloha)]])}${test}`;
        push('platba_dokoncena', {value: o.zaloha, currency: 'CZK', transaction_id: o.obj, zpusob: 'karta'});
      } else if (o.stav === 'ceka_na_prevod') {
        h = `<h2>Děkujeme, ${esc(o.jmeno)}!</h2><p>Rezervace je předběžná. Zálohový list vám pošleme na <b>${esc(o.email)}</b>. Jakmile zálohu uhradíte, rezervaci potvrdíme.</p>
          ${o.splatnost ? `<p class="bk-warn"><b>Zálohu uhraďte do ${dShort(o.splatnost)}.</b> Pokud do té doby nebude uhrazena, rezervace se automaticky zruší.</p>` : ''}
          ${info([...pobyt, ['Záloha', kc(o.zaloha)], ['Splatnost', o.splatnost && dShort(o.splatnost)], ['Variabilní symbol', esc(o.vs)], ['Číslo účtu', o.ucet && esc(o.ucet)]])}
          ${o.doklad ? `<div class="btns"><a class="btn red" href="/.netlify/functions/platba?obj=${o.obj}&t=${t}&doklad=1" target="_blank" rel="noopener">Stáhnout zálohový list (PDF)</a></div>` : ''}`;
      } else if (o.stav === 'ceka_na_platbu' && pokus < 5) {
        h = '<h2>Ověřujeme platbu…</h2><p>Chvilku strpení, čekáme na potvrzení od banky.</p>';
        setTimeout(() => loadResult(o.obj, t, pokus + 1), 3000);
      } else {
        h = `<h2>Platba neproběhla</h2><p>${o.stav === 'ceka_na_platbu' ? 'Platbu zatím od banky nevidíme.' : 'Platbu kartou se nepodařilo dokončit, peníze se nestrhly.'} Rezervaci zatím držíme – můžete to zkusit znovu, nebo nás kontaktujte: ${telA}.</p>
          ${info(pobyt)}<div class="btns"><button class="btn red arrow" type="button" data-el="again">Zkusit zaplatit znovu</button></div><p class="bk-err" data-el="againerr" hidden></p>${test}`;
      }
      if (o.stav === 'zaplaceno' || o.stav === 'ceka_na_prevod') h += o.wellness && o.wellness.length ? wellnessBlok(o) : wellnessTip(o.wellnessTip);
      $('done').hidden = false;
      $('done').innerHTML = h + mezitim;
      if (o.wellness && o.wellnessOnline) bindWellnessPick(o, t);
      const again = $('again');
      if (again) again.onclick = async () => {
        again.disabled = true;
        const r = await getJSON('/.netlify/functions/platba', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({obj: o.obj, t, znovu: true})}).catch(() => ({}));
        if (r.presmerovani) { location.href = r.presmerovani; return; }
        again.disabled = false; err('againerr', r.chyba || 'Nepodařilo se spojit s platební bránou. Zkuste to prosím za chvíli.');
      };
    };
    const loadResult = async (obj, t, pokus = 0) => {
      const o = await fetch(`/.netlify/functions/platba?obj=${encodeURIComponent(obj)}&t=${encodeURIComponent(t)}`).then(r => r.ok ? r.json() : null).catch(() => null);
      if (!o) { $('done').hidden = false; KROKY.forEach(id => $(id).hidden = true); $('done').innerHTML = `<h2>Objednávku jsme nenašli</h2><p>Kontaktujte nás prosím (${telA}), rádi to dořešíme.</p>`; return; }
      showResult(o, t, pokus);
    };

    // ---- krok 4: odeslání ----
    const postForm = f => fetch('/', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams(new FormData(f)).toString()});
    $('s4').addEventListener('submit', async e => {
      e.preventDefault();
      const f = $('s4'); $('s4err').hidden = true;
      $('fsouhrn').value = sumText(); $('fcena').value = Math.round(total());
      const btn = $('s4btn'); btn.disabled = true; btn.textContent = 'Odesílám…';
      const data = Object.fromEntries(new FormData(f));
      if (PAY) {
        // rezervace s platbou – cenu spočítá server, Previo dostane rezervaci jako opci
        const z = data.zpusob;
        const j = await getJSON('/.netlify/functions/platba', {method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({resort, od: S.od, do: S.do, dospeli: S.dospeli, deti: S.deti, typ: S.room.id, sazba: S.rate.id, balicek: S.balicek && S.balicek.id,
            doplnky: Object.fromEntries(Object.values(S.extra).map(x => [x.id, ks(x)])),
            wellness: Object.fromEntries(Object.entries(S.wcas).filter(([id]) => S.extra[id]).map(([id, a]) => [id, a.filter(Boolean)])),
            wellnessPrani: Object.fromEntries(Object.entries(S.wpref).filter(([id, v]) => S.extra[id] && v)), zpusob: z, host: {...data, souhlas: !!data.souhlas}})}).catch(() => ({}));
        if (!j.ok) { btn.disabled = false; payNote(); return err('s4err', `${j.chyba || 'Rezervaci se nepodařilo dokončit.'} Případně nás kontaktujte: ${kontakt}.`); }
        $('fobj').value = j.obj;
        $('fsouhrn').value = sumText() + `\nObjednávka: ${j.obj} · platba ${z === 'karta' ? 'kartou online' : 'převodem (zálohový list)'}`;
        await postForm(f).catch(() => {}); // kopie recepci do Netlify formuláře (e-mail); výsledek platby kartou přijde zvlášť
        push('rezervace_odeslana', {value: Math.round(total()), currency: 'CZK', apartman: S.room.nazev, balicek: S.balicek ? S.balicek.id : '', rezim: S.live ? 'previo' : 'poptavka', zpusob: z});
        if (j.presmerovani) { btn.textContent = 'Přesměrovávám na platební bránu…'; location.href = j.presmerovani; return; }
        btn.disabled = false; showResult(j, j.t);
        $('done').scrollIntoView({behavior: 'smooth', block: 'start'});
        return;
      }
      // bez platby (funkce platba nedostupná) – nezávazná poptávka přes Netlify formulář
      const ok = await postForm(f).then(r => r.ok).catch(() => false);
      btn.disabled = false; btn.textContent = 'Odeslat rezervaci';
      if (!ok) return err('s4err', `Rezervaci se nepodařilo odeslat. Zkuste to prosím znovu, nebo nás kontaktujte: ${kontakt}.`);
      push('rezervace_odeslana', {value: Math.round(total()), currency: 'CZK', apartman: S.room.nazev, balicek: S.balicek ? S.balicek.id : '', rezim: 'poptavka'});
      KROKY.forEach(id => $(id).hidden = true);
      $('steps').querySelectorAll('li').forEach(li => { li.className = 'done'; li.onclick = null; });
      $('done').hidden = false;
      $('done').innerHTML = `<h2>Děkujeme, ${esc(data.jmeno)}!</h2><p>Rezervaci jsme přijali. Do 24 hodin vám na <b>${esc(data.email)}</b> potvrdíme dostupnost a pošleme voucher s platebními údaji.</p>
        ${wellnessTip(Object.keys(S.extra).some(k => /wellness/.test(k)), Object.keys(S.extra).map(k => S.wpref[k]).filter(Boolean).join(', '))}${mezitim}`;
      $('done').scrollIntoView({behavior: 'smooth', block: 'start'});
    });

    // odkaz na podmínky v patičce (Červený dvůr si ho přidává sám v cd.js na všech stránkách)
    const nav = document.querySelector('.ftr nav');
    if (nav && !window.CD && !nav.querySelector('[data-podminky]')) {
      const a = document.createElement('a'); a.href = '#'; a.dataset.podminky = '1'; a.textContent = 'Obchodní a storno podmínky';
      a.onclick = e => { e.preventDefault(); podminky(resort, R); }; nav.append(a);
    }

    sum();
    await payReady;
    if (q.get('obj') && q.get('t')) return loadResult(q.get('obj'), q.get('t')); // návrat z platební brány
    if (q.get('od') || S.balicek) search();
  }

  // automaticky na <div id="nmr-booking" data-resort="…">
  const auto = () => { const el = document.getElementById('nmr-booking'); if (el && !el.dataset.mounted) { el.dataset.mounted = '1'; mount(el); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
  return {mount, podminky};
})();
