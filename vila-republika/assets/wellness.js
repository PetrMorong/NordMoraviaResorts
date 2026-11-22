/* Vila Republika – stránka Wellness (data/wellness.json + ceník ze sluzby.json + hodnocení z ../data/nmr/reservio.json) */
(async () => {
  const $ = id => document.getElementById(id);
  const {esc, em, img} = VR;
  const [W, S, N] = await VR.load('wellness', 'sluzby', 'nastaveni');
  const R = N.reservio_url || 'https://vila-republika.reservio.com';

  $('hero-bg').style.backgroundImage = `url("${img(W.hero_foto, 1920, 1200)}")`;
  $('w-title').innerHTML = em(W.nadpis);
  $('w-perex').textContent = W.perex;
  ['w-cta', 'w-cta2'].forEach(id => { $(id).href = R; $(id).dataset.ev = 'klik_wellness_rezervace'; });
  document.body.dataset.nmrCta = R;

  $('w-vyb').innerHTML = (W.vybaveni || []).map(v => `<figure><img src="${img(v.foto, 800, 600)}" alt="${esc(v.nazev)}" loading="lazy"><figcaption><b>${esc(v.nazev)}</b><span>${esc(v.text)}</span></figcaption></figure>`).join('');

  const C = (S.wellness && S.wellness.cenik) || [];
  $('w-cenik').innerHTML = C.length ? `<dl class="well-cenik"><div class="h"><dt></dt><dd>Veřejnost</dd><dd>Ubytovaní</dd></div>${C.map(c => `<div><dt>${esc(c.nazev)}</dt><dd>${esc(c.cena)}</dd><dd><b>${esc(c.cena_ubytovani)}</b></dd></div>`).join('')}</dl>` : '';

  $('w-kroky').innerHTML = (W.kroky || []).map((k, i) => `<div><span>${String(i + 1).padStart(2, '0')}</span><b>${esc(k.nadpis)}</b><p>${esc(k.text)}</p></div>`).join('');

  $('w-faq').innerHTML = (W.faq || []).map(f => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('');

  const G = W.galerie || [];
  $('gal').innerHTML = G.map((g, i) => `<button class="g${i === 0 ? ' big' : ''}" data-i="${i}" aria-label="Zvětšit: ${esc(g.popis)}"><img src="${img(g.foto, i === 0 ? 1000 : 600, i === 0 ? 1000 : 600)}" alt="${esc(g.popis)}" loading="lazy"><span>${esc(g.popis)}</span></button>`).join('');
  if (G.length) VR.lightbox(G.map(g => ({src: g.foto, alt: g.popis})), $('gal'));

  // hodnocení wellness z Reservio
  const RS = await fetch('../data/nmr/reservio.json', {cache: 'no-cache'}).then(x => x.ok ? x.json() : null).catch(() => null);
  const rv = RS && RS['vila-republika'];
  $('quote').innerHTML = '';
  if (rv && rv.hodnoceni) {
    const zn = rv.hodnoceni.toLocaleString('cs-CZ', {maximumFractionDigits: 1});
    $('hero-rating').innerHTML = `<span>★ ${zn} / 5</span><a href="${esc(rv.url)}" target="_blank" rel="noopener">${rv.pocet} hodnocení na Reservio</a>`;
    $('hero-rating').hidden = false;
    $('quote').innerHTML = `<div class="rs"><p class="rs-h"><b>★ ${zn} / 5</b> · ${rv.pocet} hodnocení wellness na <a href="${esc(rv.url)}" target="_blank" rel="noopener">Reservio</a></p><div class="rs-list">${(rv.recenze || []).slice(0, 3).map(x => `<figure><blockquote>„${esc(x.text)}“</blockquote><figcaption>${esc(x.jmeno)} · ★★★★★</figcaption></figure>`).join('')}</div></div>`;
  } else $('recenze').hidden = true;

  VR.header(); VR.reveal();
})();
