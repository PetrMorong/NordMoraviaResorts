/* Červený dvůr – Pobytové balíčky (data/balicky.json, upravuje se v CMS) */
(async () => {
  const {esc, em, img} = CD;
  const [N, B, R] = await CD.load('nastaveni', 'balicky', 'rezervace');
  const C = await CD.balicky.ceny();
  const $ = id => document.getElementById(id);
  const P = CD.balicky.aktivni(B);
  $('hero-bg').style.backgroundImage = `url("${img(B.hero_foto || N.hero_foto, 2000, 1200)}")`;
  $('b-title').innerHTML = em(B.nadpis);
  $('b-perex').textContent = B.perex;
  $('b-pozn').textContent = B.poznamka;
  $('b-list').innerHTML = P.map((b, i) => {
    const od = CD.balicky.cenaOd(b, R, C);
    return `<article class="pk rv${i % 2 ? ' rev' : ''}${b.hlavni ? ' main' : ''}" id="${esc(b.id)}">
      <div class="pk-img"><img src="${img(b.foto, 900, 700)}" alt="${esc(b.nazev)}" loading="lazy">${b.stitek ? `<span class="pk-tag">${esc(b.stitek)}</span>` : ''}</div>
      <div class="pk-body">
        <p class="pk-meta">${CD.balicky.meta(b)}</p>
        <h3>${esc(b.nazev)}</h3>
        <p class="pk-sub">${esc(b.podnadpis)}</p>
        <p class="pk-txt">${esc(b.perex)}</p>
        <ul class="ticks">${b.obsahuje.map(o => `<li>${esc(o)}</li>`).join('')}</ul>
        <div class="pk-foot">${od ? `<p class="pk-price"><small>${b.noci_min === b.noci_max ? 'celkem za pobyt pro dva' : `${b.noci_min} noci pro dva`}</small><b>od ${CD.balicky.kc(od)}</b></p>` : ''}<a class="btn red arrow" href="${CD.balicky.odkaz(b)}" data-ev="zacatek_rezervace">Vybrat termín</a></div>
        ${CD.balicky.platnost(b) ? `<p class="pk-valid">${CD.balicky.platnost(b)}</p>` : ''}
      </div>
    </article>`;
  }).join('');
  CD.footer(N); CD.header(); CD.reveal();
})();
