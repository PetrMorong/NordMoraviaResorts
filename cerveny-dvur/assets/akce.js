(async () => {
  const {esc, em, img} = CD;
  const [N, K] = await CD.load('nastaveni', 'akce');
  const $ = id => document.getElementById(id), S = K.svatby, F = K.firmy;
  $('hero-bg').style.backgroundImage = `url("${img(S.fotky[0], 2000, 1200)}")`;
  $('s-title').innerHTML = em(S.nadpis); $('s-text').textContent = S.text;
  $('s-body').innerHTML = S.body.map(b => `<li>${esc(b)}</li>`).join('');
  $('s-pics').innerHTML = S.fotky.map((f, i) => `<img src="${img(f, i ? 500 : 800, i ? 400 : 900)}" alt="Svatba v Červeném dvoře" loading="lazy">`).join('');
  $('s-mail').href = `mailto:${N.kontakt.email_akce}?subject=${encodeURIComponent('Svatba – ověření termínu')}&body=${encodeURIComponent('Dobrý den,\n\nmáme zájem o svatbu v Červeném dvoře.\n\nTermín:\nPočet hostů:\nUbytování pro hosty (ano/ne):\nChceme se přijet podívat (ano/ne):\n')}`;
  $('f-title').innerHTML = em(F.nadpis); $('f-text').textContent = F.text;
  $('f-params').innerHTML = F.parametry.map(p => `<div><dt>${esc(p.k)}</dt><dd>${esc(p.v)}</dd></div>`).join('');
  $('f-foto').innerHTML = `<img src="${img(F.foto, 1000, 750)}" alt="Nádvoří Červeného dvora" loading="lazy">`;
  if ($('f-mail')) $('f-mail').href = `mailto:${N.kontakt.email_akce}?subject=${encodeURIComponent('Firemní akce – poptávka')}`;
  CD.footer(N); CD.header(); CD.reveal();
})();
