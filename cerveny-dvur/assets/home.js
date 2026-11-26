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
  let datumZmeneno = false;
  ['q-od', 'q-do'].forEach(id => $(id).addEventListener('change', () => { datumZmeneno = true; }));
  if (window.NMRDate) CD.load('rezervace').then(R => NMRDate.range($('q-od'), $('q-do'), {minNoci: R.min_noci || 1})).catch(() => {});
  // odkazy do rezervace přenesou termín z vyhledávání (u karty apartmánu vždy, jinde jen když ho host změnil)
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href="rezervace.html"]');
    if (!a || !$('q-od').value || !$('q-do').value || (!a.dataset.apt && !datumZmeneno)) return;
    e.preventDefault();
    location.href = 'rezervace.html?' + new URLSearchParams({od: $('q-od').value, do: $('q-do').value, ...(a.dataset.apt ? {apt: a.dataset.apt} : {})});
  });
  $('facts').innerHTML = N.fakta.map(f => `<div><b>${esc(f.cislo)}</b><span>${esc(f.text)}</span></div>`).join('');

  // pobytové balíčky – hlavní (polopenze) zvýrazněný, max. 3
  Promise.all([CD.load('balicky'), CD.load('rezervace'), CD.balicky.ceny()]).then(([B, RZ, C]) => {
    const P = CD.balicky.aktivni(B).slice(0, 3);
    if (!P.length) return;
    $('pk-cards').innerHTML = P.map(b => {
      const od = CD.balicky.cenaOd(b, RZ, C);
      return `<article class="pkc${b.hlavni ? ' main' : ''}">
        <a class="pkc-img" href="balicky.html#${esc(b.id)}"><img src="${img(b.foto, b.hlavni ? 900 : 640, b.hlavni ? 640 : 460)}" alt="${esc(b.nazev)}" loading="lazy">${b.stitek ? `<span class="pk-tag">${esc(b.stitek)}</span>` : ''}</a>
        <div class="pkc-body">
          <p class="pk-meta">${CD.balicky.meta(b)}</p>
          <h3>${esc(b.nazev)}</h3>
          <p class="pkc-sub">${esc(b.podnadpis)}</p>
          <ul class="ticks">${b.obsahuje.slice(b.hlavni ? 0 : 1, b.hlavni ? 4 : 4).map(o => `<li>${esc(o)}</li>`).join('')}</ul>
          <div class="pkc-foot">${od ? `<p class="pk-price"><small>${b.noci_min} noci pro dva</small><b>od ${CD.balicky.kc(od)}</b></p>` : ''}<a class="btn ${b.hlavni ? 'red' : 'line'} arrow" href="${CD.balicky.odkaz(b)}" data-ev="zacatek_rezervace">${b.hlavni ? 'Rezervovat' : 'Vybrat termín'}</a></div>
        </div>
      </article>`;
    }).join('');
    $('balicky').hidden = false;
    CD.reveal();
  }).catch(() => {});

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
        <a class="link" href="rezervace.html" data-apt="${esc(a.nazev)}">Ceny a dostupnost →</a>
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

  // hodnocení a recenze z Google profilu resortu (data/nmr/reservio.json, obnovuje se při nasazení)
  const RS = await fetch('../data/nmr/reservio.json', {cache: 'no-cache'}).then(x => x.ok ? x.json() : null).catch(() => null);
  const GG = RS && RS.google && RS.google['cerveny-dvur'];
  const r = N.recenze[0], g = GG ? {znamka: GG.hodnoceni.toLocaleString('cs-CZ', {maximumFractionDigits: 1}), pocet: GG.pocet, odkaz: GG.url} : N.google_hodnoceni;
  const gr = (GG && GG.recenze) || [];
  // hodnocení i v úvodu: resort + restaurace na Googlu (+ wellness z Reservio, až tam budou hodnocení)
  const fmt = n => n.toLocaleString('cs-CZ', {maximumFractionDigits: 1});
  const GRs = RS && RS.google && RS.google['cerveny-dvur-restaurace'], RW = RS && RS['cerveny-dvur'];
  const NM = await fetch('../data/nmr/nastaveni.json', {cache: 'no-cache'}).then(x => x.ok ? x.json() : null).catch(() => null);
  const BK = NM && NM.booking && NM.booking['cerveny-dvur'];
  const hr = [
    GG && GG.pocet ? `<a href="${esc(GG.url)}" target="_blank" rel="noopener"><b>${fmt(GG.hodnoceni)} ★</b> resort · ${GG.pocet} recenzí na Googlu</a>` : '',
    GRs && GRs.pocet ? `<a href="restaurace.html"><b>${fmt(GRs.hodnoceni)} ★</b> restaurace</a>` : '',
    RW && RW.pocet ? `<a href="wellness.html"><b>${fmt(RW.hodnoceni)} ★</b> wellness</a>` : '',
    BK && BK.skore ? `<span><b>${esc(BK.skore)}</b> ${esc(BK.popis)} na Bookingu · ${BK.pocet} hodnocení</span>` : '',
  ].filter(Boolean);
  if (hr.length) { $('hero-rating').innerHTML = hr.join('<i>·</i>'); $('hero-rating').hidden = false; }
  $('quote').innerHTML = (gr.length
      ? `<p class="kicker">Recenze z Googlu</p><div class="g-rev">${gr.map(x => `<figure><blockquote>„${esc(x.text)}“</blockquote><figcaption>${x.profil ? `<a href="${esc(x.profil)}" target="_blank" rel="noopener">${esc(x.jmeno)}</a>` : esc(x.jmeno)} · ★★★★★${x.kdy ? ` · ${esc(x.kdy)}` : ''}</figcaption></figure>`).join('')}</div>`
      : (r ? `<blockquote>„${esc(r.text)}“</blockquote><p>— ${esc(r.autor)}</p>` : '')) +
    `<p style="margin-top:22px"><a class="btn line" href="${esc(g.odkaz)}" target="_blank" rel="noopener">${esc(g.znamka)} ★ · ${esc(g.pocet)} recenzí na Googlu</a></p>`;

  CD.footer(N); CD.header(); CD.reveal();
})();
