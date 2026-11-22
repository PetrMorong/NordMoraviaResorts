/* Červený dvůr – vlastní rezervační portál
   Ceny a volné apartmány:
   - živě z Previo přes Netlify funkci /.netlify/functions/rezervace (když je na Netlify zapnuté PREVIO_LIVE),
   - jinak z ceníku v data/rezervace.json (CMS) a rezervace přijde recepci k potvrzení (Netlify formulář „rezervace“). */
(async () => {
  const {esc, img} = CD;
  const $ = id => document.getElementById(id);
  const [N, A, R, B] = await CD.load('nastaveni', 'apartmany', 'rezervace', 'balicky');
  const kc = n => Math.round(n).toLocaleString('cs-CZ') + ' Kč';
  const dLong = s => new Date(s + 'T12:00').toLocaleDateString('cs-CZ', {weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric'});
  const nights = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
  const iso = d => d.toISOString().slice(0, 10);
  const plus = (s, n) => { const d = new Date(s + 'T12:00'); d.setDate(d.getDate() + n); return iso(d); };
  const SL = (R.sleva_primo || 0) / 100;
  const push = (event, extra = {}) => { (window.dataLayer = window.dataLayer || []).push({event, resort: 'cerveny-dvur', ...extra}); };

  const q = new URLSearchParams(location.search);
  const S = {od: q.get('od') || '', do: q.get('do') || '', dospeli: +q.get('dospeli') || 2, deti: +q.get('deti') || 0,
    balicek: B.balicky.find(b => b.id === q.get('balicek') && b.aktivni) || null, room: null, rate: null, extra: {}, live: false, offer: null};

  // ---- krok 1: termín ----
  $('f-dosp').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8].map(n => `<option${n === S.dospeli ? ' selected' : ''}>${n}</option>`).join('');
  $('f-deti').innerHTML = [0, 1, 2, 3, 4, 5, 6].map(n => `<option${n === S.deti ? ' selected' : ''}>${n}</option>`).join('');
  const today = iso(new Date());
  $('f-od').min = today;
  if (!S.od) { S.od = plus(today, 7); }
  if (!S.do || S.do <= S.od) S.do = plus(S.od, S.balicek ? S.balicek.noci_min : (R.min_noci || 1));
  $('f-od').value = S.od; $('f-do').value = S.do;
  $('f-od').addEventListener('change', () => { const n = S.balicek ? S.balicek.noci_min : (R.min_noci || 1); if ($('f-do').value <= $('f-od').value) $('f-do').value = plus($('f-od').value, n); $('f-do').min = plus($('f-od').value, 1); });
  $('sum-tel').href = 'tel:' + N.kontakt.telefon.replace(/\s/g, ''); $('sum-tel').textContent = N.kontakt.telefon;
  $('cond-list').innerHTML = (R.podminky_text || [R.podminky]).map(t => `<li>${esc(t)}</li>`).join('');
  $('cond-open').onclick = e => { e.preventDefault(); $('podminky').hidden = !$('podminky').hidden; };

  const pkgFixed = b => b && /^\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/.test(b.termin) ? b.termin.split('/') : null;
  const renderPkg = () => {
    const b = S.balicek;
    if (!b) { $('bk-pkg').hidden = true; return; }
    $('bk-h1').innerHTML = `Balíček <em>${esc(b.nazev)}</em>`;
    $('bk-pkg').hidden = false;
    $('bk-pkg').innerHTML = `<img src="${img(b.foto, 300, 220)}" alt=""><div><small>Rezervujete balíček</small><b>${esc(b.nazev)}</b><span>${esc(b.obsahuje.slice(1, 4).join(' · '))}</span></div><a href="rezervace.html" id="pkg-off">Jen ubytování</a>`;
    $('pkg-off').onclick = e => { e.preventDefault(); S.balicek = null; history.replaceState(null, '', 'rezervace.html'); $('bk-h1').innerHTML = 'Rezervace <em>napřímo</em>'; renderPkg(); if (!$('s2').hidden) search(); };
    const f = pkgFixed(b);
    if (f) { $('f-od').value = f[0]; $('f-do').value = f[1]; $('f-od').readOnly = $('f-do').readOnly = true; }
  };
  renderPkg();

  // ---- ceny ----
  const typy = A.apartmany.map(a => ({...a, ...(R.typy.find(t => t.nazev === a.nazev) || {})})).filter(t => t.cena_noc);
  const localOffer = () => {
    const n = nights(S.od, S.do), os = S.dospeli + S.deti, b = S.balicek;
    return typy.filter(t => (t.max_osob || 2) >= os).map(t => {
      const base = t.cena_noc * n;
      const rates = b ? [{id: 'balicek', nazev: b.nazev, popis: b.obsahuje.slice(1, 4).join(' · '), cena: base + (b.priplatek || 0)}]
        : [{id: 'snidane', nazev: 'Se snídaní', popis: 'Bohatá snídaně každé ráno · storno zdarma do 1 dne', cena: base + (R.snidane_osoba_noc || 0) * S.dospeli * n},
           {id: 'bez', nazev: 'Bez snídaně', popis: 'Jen ubytování · storno zdarma do 1 dne', cena: base}];
      return {id: t.nazev, nazev: t.nazev, foto: t.foto, osoby: t.osoby, plocha: t.plocha, popis: t.popis, volno: null,
        sazby: rates.map(r => ({...r, portal: r.cena, cena: r.cena * (1 - SL)}))};
    });
  };
  const search = async () => {
    const n = nights(S.od, S.do), b = S.balicek;
    $('s1-err').hidden = true;
    if (n < 1) return err('s1-err', 'Odjezd musí být po příjezdu.');
    if (b && (n < b.noci_min || n > b.noci_max)) return err('s1-err', `Balíček ${b.nazev} je na ${b.noci_min === b.noci_max ? b.noci_min : b.noci_min + '–' + b.noci_max} nocí.`);
    if (!b && R.min_noci && n < R.min_noci) return err('s1-err', `Minimální délka pobytu je ${R.min_noci} noci.`);
    S.room = S.rate = null; S.extra = {};
    let offer = null;
    try {
      const p = new URLSearchParams({od: S.od, do: S.do, dospeli: S.dospeli, deti: S.deti, ...(b ? {balicek: b.previo_stay_id || b.id} : {})});
      const r = await fetch('/.netlify/functions/rezervace?' + p, {headers: {accept: 'application/json'}});
      const j = r.ok ? await r.json() : null;
      if (j && j.rezim === 'live') { offer = j.typy; S.live = true; }
    } catch (e) { /* lokálně nebo bez funkce – použije se ceník */ }
    if (!offer) { offer = localOffer(); S.live = false; }
    S.offer = offer;
    push('hledani_terminu', {od: S.od, do: S.do, hoste: S.dospeli + S.deti, balicek: b ? b.id : ''});
    renderRooms(); step(2);
  };
  const err = (id, t) => { $(id).textContent = t; $(id).hidden = false; };
  $('s1').addEventListener('submit', e => { e.preventDefault(); S.od = $('f-od').value; S.do = $('f-do').value; S.dospeli = +$('f-dosp').value; S.deti = +$('f-deti').value; search(); });

  // ---- krok 2: apartmány ----
  const renderRooms = () => {
    const n = nights(S.od, S.do);
    $('s2-note').textContent = S.live ? `${n} ${n < 5 ? 'noci' : 'nocí'} · ceny a volné apartmány v reálném čase`
      : `${n} ${n < 5 ? 'noci' : 'nocí'} · ${S.dospeli + S.deti} ${S.dospeli + S.deti < 5 ? 'osoby' : 'osob'} · dostupnost potvrdí recepce do 24 hodin`;
    if (!S.offer.length) { $('rooms').innerHTML = `<p class="bk-note">Pro ${S.dospeli + S.deti} osob v tomto termínu nemáme vhodný apartmán. Zkuste jiný termín nebo nám zavolejte – rádi najdeme řešení.</p>`; return; }
    $('rooms').innerHTML = S.offer.map((t, i) => `
      <article class="bk-room">
        <div class="bk-room-img"><img src="${img(t.foto, 560, 420)}" alt="${esc(t.nazev)}" loading="lazy">${t.volno != null && t.volno <= 2 ? `<span>${t.volno === 1 ? 'Poslední volný' : 'Zbývají 2'}</span>` : ''}</div>
        <div class="bk-room-body">
          <h3>${esc(t.nazev)}</h3>
          <p class="bk-room-meta">${esc(t.osoby || '')} ${t.osoby ? 'osoby' : ''}${t.plocha ? ' · ' + esc(t.plocha) : ''}</p>
          <p class="bk-room-txt">${esc(t.popis || '')}</p>
          ${t.sazby.map((r, k) => `<div class="bk-rate">
            <div><b>${esc(r.nazev)}</b><small>${esc(r.popis || '')}</small></div>
            <div class="bk-rate-p">${r.portal && r.portal > r.cena + 1 ? `<s>${kc(r.portal)}</s>` : ''}<b>${kc(r.cena)}</b><small>za ${n} ${n < 5 ? 'noci' : 'nocí'}</small></div>
            <button class="btn red" type="button" data-r="${i}" data-k="${k}">Vybrat</button>
          </div>`).join('')}
        </div>
      </article>`).join('');
    $('rooms').querySelectorAll('[data-r]').forEach(bt => bt.onclick = () => {
      S.room = S.offer[+bt.dataset.r]; S.rate = S.room.sazby[+bt.dataset.k];
      push('vyber_apartmanu', {apartman: S.room.nazev, sazba: S.rate.nazev, value: Math.round(S.rate.cena), currency: 'CZK'});
      renderExtras(); step(3);
    });
  };

  // ---- krok 3: doplňky ----
  const exPrice = x => { const n = nights(S.od, S.do); return x.jednotka === 'noc' ? x.cena * n : x.jednotka === 'osoba' ? x.cena * S.dospeli : x.cena; };
  const renderExtras = () => {
    // v balíčku už wellness, masáž i prosecco jsou – nenabízíme je znovu
    const X = R.doplnky.filter(x => !(S.balicek && /wellness|masaz|prosecco/.test(x.id)));
    $('extras').innerHTML = X.map(x => `<label class="bk-x"><input type="checkbox" value="${esc(x.id)}"${S.extra[x.id] ? ' checked' : ''}>
      <span><b>${esc(x.nazev)}</b><small>${esc(x.popis || '')}</small></span><em>+ ${kc(exPrice(x))}${x.jednotka === 'osoba' && S.dospeli > 1 ? ` <small>(${S.dospeli}×)</small>` : ''}</em></label>`).join('');
    $('extras').querySelectorAll('input').forEach(c => c.onchange = () => { const x = R.doplnky.find(d => d.id === c.value); if (c.checked) S.extra[x.id] = x; else delete S.extra[x.id]; sum(); });
    sum();
  };
  $('s3-next').onclick = () => { step(4); push('zacatek_rezervace', {value: Math.round(total()), currency: 'CZK'}); };

  // ---- souhrn ----
  const total = () => (S.rate ? S.rate.cena : 0) + Object.values(S.extra).reduce((a, x) => a + exPrice(x), 0);
  const sumText = () => {
    const n = nights(S.od, S.do);
    return [`${S.balicek ? 'Balíček: ' + S.balicek.nazev + '\n' : ''}Termín: ${S.od} – ${S.do} (${n} nocí)`, `Hosté: ${S.dospeli} dosp. + ${S.deti} dětí`,
      S.room ? `Apartmán: ${S.room.nazev} · ${S.rate.nazev} · ${kc(S.rate.cena)}` : '',
      ...Object.values(S.extra).map(x => `Doplněk: ${x.nazev} · ${kc(exPrice(x))}`), `Celkem: ${kc(total())}`, S.live ? 'Režim: Previo' : 'Režim: k potvrzení recepcí'].filter(Boolean).join('\n');
  };
  const sum = () => {
    const n = nights(S.od, S.do);
    const rows = [];
    if (S.balicek) rows.push(`<div class="bk-s-pkg">${esc(S.balicek.nazev)}</div>`);
    rows.push(`<div class="bk-s-row"><span>${dLong(S.od)} → ${dLong(S.do)}</span></div>`);
    rows.push(`<div class="bk-s-row"><span>${n} ${n < 5 ? 'noci' : 'nocí'} · ${S.dospeli} dosp.${S.deti ? ' + ' + S.deti + ' děti' : ''}</span></div>`);
    if (S.room) {
      rows.push(`<div class="bk-s-row strong"><span>${esc(S.room.nazev)}<small>${esc(S.rate.nazev)}</small></span><b>${kc(S.rate.cena)}</b></div>`);
      Object.values(S.extra).forEach(x => rows.push(`<div class="bk-s-row"><span>${esc(x.nazev)}</span><b>${kc(exPrice(x))}</b></div>`));
      const portal = S.rate.portal || S.rate.cena;
      rows.push(`<div class="bk-s-total"><span>Celkem</span><b>${kc(total())}</b></div>`);
      if (portal > S.rate.cena + 1) rows.push(`<p class="bk-s-save">Ušetříte ${kc(portal - S.rate.cena)} oproti portálům</p>`);
      rows.push(`<p class="bk-note">Poplatek obci a parkování v ceně. ${esc(R.podminky || '')}</p>`);
    }
    $('sum-body').innerHTML = rows.join('');
  };

  // ---- kroky ----
  const step = k => {
    ['s1', 's2', 's3', 's4'].forEach((id, i) => { $(id).hidden = i + 1 > k; $(id).classList.toggle('past', i + 1 < k); });
    $('bk-steps').querySelectorAll('li').forEach((li, i) => { li.className = i + 1 < k ? 'done' : i + 1 === k ? 'on' : ''; li.onclick = i + 1 < k ? () => step(i + 1) : null; });
    sum();
    const el = $(['s1', 's2', 's3', 's4'][k - 1]);
    if (k > 1) el.scrollIntoView({behavior: 'smooth', block: 'start'});
    if (k === 4) $('s4-note').textContent = S.live ? 'Rezervace se zapíše přímo do našeho systému a potvrzení dostanete e-mailem.' : 'Po odeslání vám do 24 hodin potvrdíme dostupnost a pošleme voucher s platebními údaji. Nic zatím neplatíte.';
  };

  // ---- krok 4: odeslání ----
  $('s4').addEventListener('submit', async e => {
    e.preventDefault();
    const f = $('s4'); $('s4-err').hidden = true;
    $('f-souhrn').value = sumText(); $('f-cena').value = Math.round(total());
    const btn = $('s4-btn'); btn.disabled = true; btn.textContent = 'Odesílám…';
    const data = Object.fromEntries(new FormData(f));
    let ok = false, cislo = '';
    try {
      if (S.live) {
        const r = await fetch('/.netlify/functions/rezervace', {method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({od: S.od, do: S.do, dospeli: S.dospeli, deti: S.deti, typ: S.room.id, sazba: S.rate.id, balicek: S.balicek && S.balicek.previo_stay_id,
            doplnky: Object.keys(S.extra), cena: Math.round(total()), host: data})});
        const j = await r.json().catch(() => ({})); ok = !!j.ok; cislo = j.cislo || '';
        if (!ok) S.live = false; // Previo neodpovědělo – rezervace půjde recepci k ručnímu potvrzení
      }
      // vždy uložíme i do Netlify formuláře – recepce dostane e-mail (a v poptávkovém režimu je to jediná cesta)
      const r2 = await fetch('/', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams(new FormData(f)).toString()});
      ok = ok || r2.ok;
    } catch (x) { ok = false; }
    btn.disabled = false; btn.textContent = 'Odeslat rezervaci';
    if (!ok) return err('s4-err', `Rezervaci se nepodařilo odeslat. Zkuste to prosím znovu, nebo zavolejte na ${N.kontakt.telefon}.`);
    push('rezervace_odeslana', {value: Math.round(total()), currency: 'CZK', apartman: S.room.nazev, balicek: S.balicek ? S.balicek.id : '', rezim: S.live ? 'previo' : 'poptavka'});
    ['s1', 's2', 's3', 's4'].forEach(id => $(id).hidden = true);
    $('bk-steps').querySelectorAll('li').forEach(li => { li.className = 'done'; li.onclick = null; });
    $('done').hidden = false;
    $('done').innerHTML = `<h2>Děkujeme, ${esc(data.jmeno)}!</h2>
      <p>${S.live ? `Rezervace${cislo ? ' č. <b>' + esc(cislo) + '</b>' : ''} je zapsaná. Potvrzení jsme poslali na <b>${esc(data.email)}</b>.` : `Rezervaci jsme přijali. Do 24 hodin vám na <b>${esc(data.email)}</b> potvrdíme dostupnost a pošleme voucher s platebními údaji.`}</p>
      <p>Mezitím: <a href="wellness.html">privátní wellness</a> · <a href="restaurace.html">restaurace</a> · <a href="index.html#okoli">tipy na výlety</a></p>`;
    $('done').scrollIntoView({behavior: 'smooth', block: 'start'});
  });

  CD.footer(N); CD.header(); CD.reveal();
  sum();
  if (q.get('od') || S.balicek) search();
})();
