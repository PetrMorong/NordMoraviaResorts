(async () => {
  const {esc, em, img} = CD;
  const [N, A, R, K] = await CD.load('nastaveni', 'apartmany', 'restaurace', 'akce');
  const $ = id => document.getElementById(id);

  if (N.pruh && N.pruh.text) $('strip').innerHTML = `<a href="${esc(N.pruh.odkaz)}">${esc(N.pruh.text)} →</a>`;
  else { $('strip').remove(); document.body.classList.remove('has-strip'); }

  // hero – prolínání více fotek (hero_fotky), jinak jedna hero_foto
  const HF = (N.hero_fotky && N.hero_fotky.length) ? N.hero_fotky : [N.hero_foto];
  const hb = $('hero-bg');
  hb.innerHTML = HF.map((f, i) => `<i class="slide${i ? '' : ' on'}" style="background-image:url('${img(f, 2000, 1250)}')"></i>`).join('');
  if (HF.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let k = 0; const sl = hb.querySelectorAll('.slide');
    setInterval(() => { sl[k].classList.remove('on'); k = (k + 1) % sl.length; sl[k].classList.add('on'); }, 6000);
  }
  $('hero-title').innerHTML = em(N.hero_nadpis);
  $('hero-perex').textContent = N.hero_perex;
  CD.dates($('q-od'), $('q-do'));
  $('facts').innerHTML = N.fakta.map(f => `<div><b>${esc(f.cislo)}</b><span>${esc(f.text)}</span></div>`).join('');

  $('intro-title').innerHTML = em(N.intro_nadpis);
  $('intro-text').textContent = N.intro_text;
  $('intro-foto').innerHTML = `<img src="${img(N.intro_foto, 1400, 788)}" alt="Nádvoří Červeného dvora v létě" loading="lazy">`;
  $('vybaveni').innerHTML = A.vybaveni.map(v => `<li>${esc(v)}</li>`).join('');

  $('apt-grid').innerHTML = A.apartmany.map(a => `
    <article class="apt rv">
      <div class="apt-img"><img src="${img(a.foto, 800, 600)}" alt="${esc(a.nazev)}" loading="lazy"></div>
      <div class="apt-body">
        <h3>${esc(a.nazev)}</h3>
        <p class="meta"><span>${esc(a.osoby)} ${/^\d$/.test(a.osoby) ? 'osoby' : 'osob'}</span><span>${esc(a.plocha)}</span></p>
        <p class="txt">${esc(a.popis)}</p>
        <a class="link" href="rezervace.html">Ceny a dostupnost →</a>
      </div>
    </article>`).join('');

  // restaurace – upoutávka
  $('r-pics').innerHTML = [R.hero_foto, ...R.kuchyne.fotky.slice(0, 2)].map((f, i) => `<img src="${img(f, i ? 500 : 800, i ? 400 : 900)}" alt="Restaurace Červený dvůr" loading="lazy">`).join('');
  $('r-text').textContent = R.hero_perex;
  $('r-hours').innerHTML = R.oteviraci_doba.map(h => `<div><span>${esc(h.dny)}</span><b>${esc(h.cas)}</b></div>`).join('');
  $('r-menu').href = R.menu_url;

  $('well-pics').innerHTML = ['Rapotin/DSC07020_1_xym9hm', 'Rapotin/web/sauna'].map((f, i) => `<img src="${img(f, i ? 600 : 900, i ? 700 : 1100)}" alt="Privátní wellness" loading="lazy">`).join('');
  $('well-cta').href = N.reservio_url;
  $('akce-pics').innerHTML = K.svatby.fotky.slice(0, 2).map((f, i) => `<img src="${img(f, i ? 600 : 900, i ? 700 : 1100)}" alt="Svatba v Červeném dvoře" loading="lazy">`).join('');

  // galerie + lightbox
  const G = N.galerie || [];
  $('gal').innerHTML = G.map((g, i) => `<button class="g${i % 7 === 0 ? ' big' : ''}" data-i="${i}" aria-label="Zvětšit: ${esc(g.popis)}"><img src="${img(g.foto, i % 7 === 0 ? 1000 : 600, i % 7 === 0 ? 1000 : 600)}" alt="${esc(g.popis)}" loading="lazy"><span>${esc(g.popis)}</span></button>`).join('');
  CD.lightbox(G.map(g => ({src: g.foto, alt: g.popis})), $('gal'));

  // zábava v areálu
  if (N.zabava) {
    $('zab-title').innerHTML = em(N.zabava.nadpis);
    $('zab-text').textContent = N.zabava.text;
    $('zab-list').innerHTML = N.zabava.polozky.map(z => `<li>${esc(z)}</li>`).join('');
    const ZF = N.zabava.fotky || [N.zabava.foto];
    $('zab-foto').innerHTML = ZF.slice(0, 3).map((f, i) => `<img src="${img(f, i ? 600 : 900, i ? 450 : 1000)}" alt="${['Poker room', 'Herna s ping-pongem a šipkami', 'Stolní fotbal'][i] || 'Zábava v areálu'}" loading="lazy">`).join('');
  } else $('zabava').remove();

  $('hist-title').innerHTML = em(N.historie.nadpis);
  $('hist-text').textContent = N.historie.text;
  $('hist-foto').innerHTML = `<img src="${img(N.historie.foto, 1100, 760)}" alt="Historická fotografie Červeného dvora" loading="lazy">`;

  const r = N.recenze[0], g = N.google_hodnoceni;
  $('quote').innerHTML = (r ? `<blockquote>„${esc(r.text)}“</blockquote><p>— ${esc(r.autor)}</p>` : '') +
    `<p style="margin-top:22px"><a class="btn line" href="${esc(g.odkaz)}" target="_blank" rel="noopener">${esc(g.znamka)} ★ · ${esc(g.pocet)} recenzí na Googlu</a></p>`;

  CD.footer(N); CD.header(); CD.reveal();
})();
