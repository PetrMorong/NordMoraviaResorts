(async () => {
  const {esc, em, img} = CD;
  const [N, W] = await CD.load('nastaveni', 'wellness');
  const $ = id => document.getElementById(id);
  $('hero-bg').style.backgroundImage = `url("${img(W.hero_foto, 2000, 1200)}")`;
  $('w-title').innerHTML = em(W.nadpis);
  $('w-perex').textContent = W.perex;
  $('w-cena').innerHTML = `<b>${esc(W.cena)}</b> privátní wellness`;
  $('w-cta').href = $('m-cta').href = N.reservio_url;
  $('m-tel').href = 'tel:' + N.kontakt.telefon.replace(/\s/g, '');
  $('w-vyb').innerHTML = W.vybaveni.map(v => `<div class="space"><img src="${img(v.foto, 700, 525)}" alt="${esc(v.nazev)}" loading="lazy"><b>${esc(v.nazev)}</b></div>`).join('');
  $('w-kroky').innerHTML = W.kroky.map((k, i) => `<div><small>0${i + 1}</small><b>${esc(k.nadpis)}</b><span>${esc(k.text)}</span></div>`).join('');
  $('w-masaze').innerHTML = W.masaze.map(m => `<div><dt><b>${esc(m.nazev)}</b><span>${esc(m.text)}</span></dt><dd>${esc(m.cena)}</dd></div>`).join('');
  $('w-faq').innerHTML = W.faq.map(f => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('');
  CD.footer(N); CD.header(); CD.reveal();
})();
