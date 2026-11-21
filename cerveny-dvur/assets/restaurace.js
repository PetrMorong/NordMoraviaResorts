(async () => {
  const {esc, em, img} = CD;
  const [N, R] = await CD.load('nastaveni', 'restaurace');
  const $ = id => document.getElementById(id);

  $('hero-bg').style.backgroundImage = `url("${img(R.hero_foto, 2000, 1200)}")`;
  if (R.hero_vizualizace) $('hero-bg').insertAdjacentHTML('afterend', '<i class="viz hero-viz">Vizualizace</i>');
  $('hero-title').innerHTML = em(R.hero_nadpis);
  $('hero-perex').textContent = R.hero_perex;
  $('b-menu').href = $('k-menu').href = R.menu_url;
  $('b-rez').href = R.rezervace_url;
  $('b-roz').href = R.rozvoz_url;
  // Restaurace má vlastní Google profil (oddělený od resortu)
  const g = R.google || {};
  $('rating').href = g.odkaz;
  $('rating').innerHTML = g.znamka
    ? `<b>${esc(g.znamka)} ★</b> ${esc(g.pocet)} recenzí na Googlu · ohodnoťte nás`
    : `<b>★</b> Restaurace na Googlu · ohodnoťte nás`;

  $('why').innerHTML = R.duvody.map(d => `<div><b>${esc(d.nadpis)}</b><span>${esc(d.text)}</span></div>`).join('');

  // akce – jen budoucí a probíhající (podle data "konec")
  const today = new Date().toISOString().slice(0, 10);
  const ev = R.akce.filter(a => !a.konec || a.konec >= today);
  if (!ev.length) $('akce-r').remove();
  else $('events').innerHTML = ev.map(a => `
    <article class="event rv">
      <div class="d">${esc(a.datum)}${a.cas ? `<small>${esc(a.cas)}</small>` : ''}</div>
      <div><h3>${esc(a.nazev)}</h3><p>${esc(a.text)}</p></div>
      ${a.rezervace ? `<a class="btn red" href="${esc(R.rezervace_url)}" target="_blank" rel="noopener">Rezervovat stůl</a>` : ''}
    </article>`).join('');

  $('k-title').innerHTML = em(R.kuchyne.nadpis);
  $('k-text').textContent = R.kuchyne.text;
  $('k-pics').innerHTML = R.kuchyne.fotky.map((f, i) => `<img src="${img(f, i ? 500 : 800, i ? 400 : 900)}" alt="Jídlo z Restaurace Červený dvůr" loading="lazy">`).join('');
  if (R.jidla) {
    const J = R.jidla.fotky;
    $('j-title').innerHTML = em(R.jidla.nadpis);
    $('j-gal').innerHTML = J.map((g, i) => `<button class="g${i === 0 ? ' big' : ''}" data-i="${i}" aria-label="Zvětšit: ${esc(g.popis)}"><img src="${img(g.foto, i ? 600 : 1000, i ? 600 : 1000)}" alt="${esc(g.popis)}" loading="lazy"><span class="cap"><b>${esc(g.popis)}</b>${g.text ? `<small>${esc(g.text)}</small>` : ''}</span></button>`).join('');
    CD.lightbox(J.map(g => ({src: g.foto, alt: g.text ? `${g.popis} – ${g.text}` : g.popis})), $('j-gal'));
  }

  // tým – karta bez doplněného jména se v náhledu zvýrazní čárkovaně
  $('team').innerHTML = R.tym.filter(t => t.zobrazit).map(t => {
    const todo = /doplnit/i.test(t.jmeno + t.text);
    const ini = t.jmeno.split(' ').map(w => w[0]).join('').slice(0, 2);
    return `<article class="person${todo ? ' todo' : ''}">
      <div class="ph">${t.foto ? `<img src="${img(t.foto, 400, 530)}" alt="${esc(t.jmeno)}" loading="lazy">` : esc(todo ? '?' : ini)}</div>
      <div><h3>${esc(t.jmeno)}</h3><p class="role">${esc(t.role)}</p><p>${esc(t.text)}</p></div>
    </article>`;
  }).join('');

  $('spaces').innerHTML = R.prostory.map(p => `<div class="space"><div class="sp-img"><img src="${img(p.foto, 700, 525)}" alt="${esc(p.nazev)}${p.vizualizace ? ' – vizualizace' : ''}" loading="lazy">${p.vizualizace ? '<em class="viz">Vizualizace</em>' : ''}</div><b>${esc(p.nazev)}</b><span>${esc(p.text)}</span></div>`).join('');
  $('hours').innerHTML = R.oteviraci_doba.map(h => `<div><span>${esc(h.dny)}</span><b>${esc(h.cas)}</b></div>`).join('');
  $('prakticke').innerHTML = R.prakticke.map(p => `<li>${esc(p)}</li>`).join('');

  $('pk-title').innerHTML = em(R.poukazy.nadpis);
  $('pk-text').textContent = R.poukazy.text;
  $('pk-cta').href = `mailto:${N.kontakt.email}?subject=${encodeURIComponent('Objednávka dárkového poukazu')}&body=${encodeURIComponent('Dobrý den,\n\nmám zájem o dárkový poukaz.\n\nNa co (restaurace / wellness / pobyt):\nHodnota:\nJméno a telefon:\nVyzvednutí na baru, nebo poslat poštou:\n')}`;
  $('f-title').innerHTML = em(R.firmy.nadpis);
  $('f-text').textContent = R.firmy.text;
  $('f-foto').innerHTML = `<img src="${img(R.firmy.foto, 1000, 1000)}" alt="Raut na firemní akci" loading="lazy" style="object-position:50% 60%">`;
  $('f-mail').href = `mailto:${N.kontakt.email_akce}?subject=${encodeURIComponent('Firemní akce / obědy')}`;

  CD.footer(N); CD.header(); CD.reveal();
})();
