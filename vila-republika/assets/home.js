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
  const show = () => { $('lb-img').src = img(G[gi], 1800); $('lb-img').alt = gName; $('lb-cap').textContent = `${gName} · ${gi + 1} / ${G.length}`; };
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
  $('well-price').textContent = W.cena;
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
  if (r) $('quote').innerHTML = `<blockquote>„${esc(r.text)}“</blockquote><p>— ${esc(r.autor)}</p>`; else $('recenze').remove();

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

  VR.header(); VR.reveal();
})();
