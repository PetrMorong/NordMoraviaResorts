(async () => {
  const {esc, em, img} = VR;
  const [N, A, S, O] = await VR.load('nastaveni', 'apartmany', 'sluzby', 'okoli');
  const $ = id => document.getElementById(id);

  // hero + rychlá rezervace
  $('hero-bg').style.backgroundImage = `url("${img(N.hero_foto, 2000, 1250)}")`;
  $('hero-title').innerHTML = em(N.hero_nadpis);
  $('hero-perex').textContent = N.hero_perex;
  VR.dates($('q-od'), $('q-do'));

  $('facts').innerHTML = N.fakta.map(f => `<div><b>${esc(f.cislo)}</b><span>${esc(f.text)}</span></div>`).join('');

  // úvod
  $('intro-title').innerHTML = em(N.intro_nadpis);
  $('intro-text').textContent = N.intro_text;
  $('intro-foto').innerHTML = `<img src="${img(N.intro_foto, 900, 1100)}" alt="Vila Republika – exteriér" loading="lazy">`;
  $('vybaveni').innerHTML = A.vybaveni.map(v => `<li>${esc(v)}</li>`).join('');

  // apartmány (jen aktivní – ty, které jdou rezervovat v Previu)
  const apts = A.apartmany.filter(a => a.aktivni);
  $('apt-grid').innerHTML = apts.map((a, i) => `
    <article class="apt rv">
      <button class="apt-img" data-g="${i}" aria-label="Fotogalerie – ${esc(a.nazev)}">
        <img src="${img(a.fotky[0], 900, 640)}" alt="${esc(a.nazev)} apartmán" loading="lazy">
        <span class="cnt">${a.fotky.length} fotek</span>
      </button>
      <div class="apt-body">
        <h3>${esc(a.nazev)}</h3>
        <p class="sub">${esc(a.podtitul)}</p>
        <p class="meta"><span>${esc(a.osoby)} osob</span>${a.plocha ? `<span>${esc(a.plocha)}</span>` : ''}</p>
        <p class="txt">${esc(a.popis)}</p>
        <a class="link" href="rezervace.html">Ověřit termín →</a>
      </div>
    </article>`).join('');

  // lightbox
  const lb = $('lb'); let G = [], gi = 0, gName = '';
  $('lb-img').onload = () => $('lb-img').style.opacity = 1;
  const show = () => { $('lb-img').style.opacity = 0; $('lb-img').src = img(G[gi], 1800); $('lb-img').alt = gName; $('lb-cap').textContent = `${gName} · ${gi + 1} / ${G.length}`; };
  document.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { const a = apts[+b.dataset.g]; G = a.fotky; gi = 0; gName = a.nazev; show(); lb.showModal(); });
  $('lb-x').onclick = () => lb.close();
  $('lb-prev').onclick = () => { gi = (gi - 1 + G.length) % G.length; show(); };
  $('lb-next').onclick = () => { gi = (gi + 1) % G.length; show(); };
  lb.addEventListener('click', e => { if (e.target === lb) lb.close(); });
  addEventListener('keydown', e => { if (!lb.open) return; if (e.key === 'ArrowLeft') $('lb-prev').click(); if (e.key === 'ArrowRight') $('lb-next').click(); });

  // wellness
  const W = S.wellness;
  $('well-title').innerHTML = em(W.nadpis);
  $('well-text').textContent = W.text;
  $('well-items').innerHTML = W.vybaveni.map(v => `<li>${esc(v)}</li>`).join('');
  if ($('well-price')) $('well-price').textContent = W.cena;
  if (W.cenik && W.cenik.length && $('well-price-box')) $('well-price-box').outerHTML = `<dl class="well-cenik"><div class="h"><dt></dt><dd>Veřejnost</dd><dd>Ubytovaní</dd></div>${W.cenik.map(c => `<div><dt>${esc(c.nazev)}</dt><dd>${esc(c.cena)}</dd><dd><b>${esc(c.cena_ubytovani)}</b></dd></div>`).join('')}</dl>`;
  $('well-cta').href = N.reservio_url;
  $('well-pics').innerHTML = W.fotky.map((f, i) => `<img src="${img(f, i ? 600 : 900, i ? 700 : 1100)}" alt="Privátní wellness" loading="lazy">`).join('');

  // společenská místnost + další vybavení
  $('spol-title').innerHTML = em(S.spolecenska.nadpis);
  $('spol-text').textContent = S.spolecenska.text;
  $('spol-pics').innerHTML = S.spolecenska.fotky.map((f, i) => `<img src="${img(f, i ? 600 : 900, i ? 700 : 1100)}" alt="Společenská místnost" loading="lazy">`).join('');
  $('extras').innerHTML = S.dalsi.map(d => `<div><b>${esc(d.nazev)}</b><span>${esc(d.text)}</span></div>`).join('');

  // okolí
  $('okoli-text').textContent = O.text;
  $('okoli-foto').innerHTML = `<img src="${img(O.foto, 1400, 900)}" alt="Velké Losiny z výšky" loading="lazy">`;
  $('places').innerHTML = O.mista.map(m => `<li><div><b>${esc(m.nazev)}</b><span>${esc(m.text)}</span></div><em>${esc(m.vzdalenost)}</em></li>`).join('');

  // recenze
  const r = N.recenze[0];
  if (r) $('quote').innerHTML = `<blockquote>„${esc(r.text)}“</blockquote><p>— ${esc(r.autor)}</p>`;

  // hodnocení wellness z Reservio (data/nmr/reservio.json se obnovuje při každém nasazení)
  const RS = await fetch('../data/nmr/reservio.json', {cache: 'no-cache'}).then(x => x.ok ? x.json() : null).catch(() => null);
  const rv = RS && RS['vila-republika'];
  document.querySelectorAll('.well-rating, #quote .rs, #quote .ty').forEach(e => e.remove()); // po předgenerování nevkládat podruhé
  if (rv && rv.pocet) {
    const zn = rv.hodnoceni.toLocaleString('cs-CZ', {maximumFractionDigits: 1});
    $('well-cta').insertAdjacentHTML('afterend', `<a class="well-rating" href="${rv.url}" target="_blank" rel="noopener"><b>★ ${zn}</b> z 5 · ${rv.pocet} hodnocení na Reservio</a>`);
    $('quote').insertAdjacentHTML('beforeend', `<div class="rs"><p class="rs-h"><b>★ ${zn} / 5</b> · ${rv.pocet} hodnocení wellness na <a href="${rv.url}" target="_blank" rel="noopener">Reservio</a></p><div class="rs-list">${rv.recenze.slice(0, 3).map(x => `<figure><blockquote>„${esc(x.text)}“</blockquote><figcaption>${esc(x.jmeno)} · ★★★★★</figcaption></figure>`).join('')}</div></div>`);
  } else if (!r) $('recenze').remove();
  // TrustYou – skutečné recenze ze všech portálů (widget jako na starém webu)
  const ty = rv && rv.trustyou;
  // hodnocení i v úvodu: TrustYou (všechny portály) + Google + Reservio wellness
  const GV = RS && RS.google && RS.google['vila-republika'];
  const fmt = n => n.toLocaleString('cs-CZ', {maximumFractionDigits: 1});
  const NM = await fetch('../data/nmr/nastaveni.json', {cache: 'no-cache'}).then(x => x.ok ? x.json() : null).catch(() => null);
  const BK = NM && NM.booking && NM.booking['vila-republika'];
  const hr = [
    ty ? `<a href="#recenze"><b>${ty.skore}/100</b> ${esc(ty.popis)} · ${ty.pocet} recenzí</a>` : '',
    GV && GV.pocet ? `<a href="${esc(GV.url)}" target="_blank" rel="noopener"><b>${fmt(GV.hodnoceni)} ★</b> Google</a>` : '',
    rv && rv.pocet ? `<a href="${rv.url}" target="_blank" rel="noopener"><b>${fmt(rv.hodnoceni)} ★</b> wellness</a>` : '',
    BK && BK.skore ? `<span><b>${esc(BK.skore)}</b> ${esc(BK.popis)} na Bookingu · ${BK.pocet} hodnocení</span>` : '',
  ].filter(Boolean);
  if (hr.length) { $('hero-rating').innerHTML = hr.join('<i>·</i>'); $('hero-rating').hidden = false; }
  if (ty) {
    $('quote').insertAdjacentHTML('beforeend', `<div class="ty"><p class="rs-h"><b>${esc(ty.popis)} ${ty.skore}/100</b> · ${ty.pocet} recenzí z ${ty.zdroju} portálů (TrustYou)</p><iframe src="${esc(ty.widget)}" title="Recenze hostů Vila Republika" loading="lazy" id="ty-frame"></iframe></div>`);
    const s = document.getElementById('ty-js') || document.createElement('script'); s.id = 'ty-js'; s.src = 'https://cdn.trustyou.com/v2/hotel/widget-ui/shared/iframeResizer/4.3.2/iframeResizer.min.js';
    s.onload = () => window.iFrameResize && iFrameResize({checkOrigin: false}, '#ty-frame'); document.body.appendChild(s);
  }

  // poukazy
  const P = N.poukazy; let val = P.hodnoty[2] || P.hodnoty[0];
  $('pk-title').innerHTML = em(P.nadpis);
  $('pk-text').textContent = P.text;
  const drawPk = () => {
    $('pk-values').innerHTML = P.hodnoty.map(h => `<button type="button" role="radio" aria-checked="${h === val}" class="${h === val ? 'on' : ''}">${esc(h)}</button>`).join('');
    $('pk-values').querySelectorAll('button').forEach(b => b.onclick = () => { val = b.textContent; drawPk(); });
    $('pk-cta').href = `mailto:${N.kontakt.email}?subject=${encodeURIComponent('Objednávka dárkového poukazu ' + val)}&body=${encodeURIComponent('Dobrý den,\n\nmám zájem o dárkový poukaz v hodnotě ' + val + '.\n\nJméno:\nTelefon:\nDoručení (e-mailem / poštou):\n')}`;
  };
  drawPk();

  // kontakt + patička
  const K = N.kontakt;
  $('contact').innerHTML = `
    <div><dt>E-mail</dt><dd><a href="mailto:${esc(K.email)}">${esc(K.email)}</a></dd></div>
    ${K.telefon ? `<div><dt>Telefon</dt><dd><a href="tel:${esc(K.telefon.replace(/\s/g, ''))}">${esc(K.telefon)}</a></dd></div>` : ''}
    <div><dt>Adresa</dt><dd>${esc(K.adresa)}<br><a href="${esc(K.mapa)}" target="_blank" rel="noopener">Zobrazit na mapě →</a></dd></div>
    <div><dt>Příjezd / odjezd</dt><dd>${esc(N.check_in)} / ${esc(N.check_out)}</dd></div>
    <div><dt>Provozovatel</dt><dd>${esc(K.provozovatel)}</dd></div>`;
  $('ftr-fb').href = K.facebook; $('ftr-ig').href = K.instagram;
  // galerie + lightbox
  const GAL = N.galerie || [];
  if (GAL.length) {
    $('gal').innerHTML = GAL.map((g, i) => `<button class="g${i % 7 === 0 ? ' big' : ''}" data-i="${i}" aria-label="Zvětšit: ${esc(g.popis)}"><img src="${img(g.foto, i % 7 === 0 ? 1000 : 600, i % 7 === 0 ? 1000 : 600)}" alt="${esc(g.popis)}" loading="lazy"><span>${esc(g.popis)}</span></button>`).join('');
    VR.lightbox(GAL.map(g => ({src: g.foto, alt: g.popis})), $('gal'));
  } else $('galerie').hidden = true;


  VR.header(); VR.reveal();
})();
