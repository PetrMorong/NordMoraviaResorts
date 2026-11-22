/* Červený dvůr – Pobytové balíčky (data/balicky.json, upravuje se v CMS) */
(async () => {
  const {esc, em, img} = CD;
  const [N, B, R] = await CD.load('nastaveni', 'balicky', 'rezervace');
  const minNoc = Math.min(...R.typy.filter(t => t.max_osob >= 2).map(t => t.cena_noc));
  const kc = n => Math.round(n).toLocaleString('cs-CZ') + ' Kč';
  const cenaOd = b => (minNoc * b.noci_min + (b.priplatek || 0)) * (1 - (R.sleva_primo || 0) / 100);
  const $ = id => document.getElementById(id);
  const P = B.balicky.filter(b => b.aktivni);
  $('hero-bg').style.backgroundImage = `url("${img(B.hero_foto || N.hero_foto, 2000, 1200)}")`;
  $('b-title').innerHTML = em(B.nadpis);
  $('b-perex').textContent = B.perex;
  $('b-pozn').textContent = B.poznamka;
  const noci = b => b.noci_min === b.noci_max ? `${b.noci_min} ${b.noci_min < 5 ? 'noci' : 'nocí'}` : `${b.noci_min}–${b.noci_max} nocí`;
  const terminy = b => /^\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/.test(b.termin) ? b.termin.split('/') : null;
  $('b-list').innerHTML = P.map((b, i) => {
    const t = terminy(b);
    const href = `rezervace.html?balicek=${encodeURIComponent(b.id)}` + (t ? `&od=${t[0]}&do=${t[1]}` : '');
    return `<article class="pk rv${i % 2 ? ' rev' : ''}" id="${esc(b.id)}">
      <div class="pk-img"><img src="${img(b.foto, 900, 700)}" alt="${esc(b.nazev)}" loading="lazy">${b.stitek ? `<span class="pk-tag">${esc(b.stitek)}</span>` : ''}</div>
      <div class="pk-body">
        <p class="pk-meta">${noci(b)} · pro ${b.osoby} osoby · snídaně v ceně</p>
        <h3>${esc(b.nazev)}</h3>
        <p class="pk-sub">${esc(b.podnadpis)}</p>
        <p class="pk-txt">${esc(b.perex)}</p>
        <ul class="ticks">${b.obsahuje.map(o => `<li>${esc(o)}</li>`).join('')}</ul>
        <div class="pk-foot"><p class="pk-price"><small>${b.noci_min === b.noci_max ? 'celkem za pobyt' : `od · ${b.noci_min} noci pro dva`}</small><b>od ${kc(cenaOd(b))}</b></p><a class="btn red arrow" href="${href}" data-ev="zacatek_rezervace">Vybrat termín</a></div>
      </div>
    </article>`;
  }).join('');
  CD.footer(N); CD.header(); CD.reveal();
})();
