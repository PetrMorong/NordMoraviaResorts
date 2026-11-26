/* Úvodní stránka – vše se vykresluje z JSON dat spravovaných v CMS */
(async () => {
  const {load, kc, esc, iso, addDays, reveal, submitForm} = SK;
  const $ = s => document.querySelector(s);
  let N, A, W, B, O, F, G;
  try {
    [N, A, W, B, O, F, G] = await Promise.all(['nastaveni', 'apartmany', 'wellness', 'bistro', 'okoli', 'faq', 'galerie'].map(load));
  } catch (e) {
    document.body.insertAdjacentHTML('afterbegin', `<p style="background:#fde8e8;padding:12px 20px;position:relative;z-index:100">Data se nenačetla (${esc(e.message)}). Web je potřeba spustit přes server – např. Netlify nebo <code>npx serve</code>.</p>`);
    return;
  }

  // hero
  $('#hero-bg').style.backgroundImage = `url(${N.hero.foto})`;
  $('#hero-title').innerHTML = `${esc(N.hero.radek1)}<br><em>${esc(N.hero.radek2)}</em>`;
  $('#hero-perex').textContent = N.hero.perex;
  const pill = $('#hero-pill'); if (N.oznameni) pill.textContent = N.oznameni; else pill.remove();

  // rychlé vyhledání – výchozí termín: první víkend od otevření / od dneška
  const today = iso(new Date());
  const start = N.prvni_termin && N.prvni_termin > today ? N.prvni_termin : today;
  const d0 = new Date(start + 'T12:00:00'); const toFri = (5 - d0.getDay() + 7) % 7;
  const od = addDays(start, toFri), doo = addDays(od, 2);
  Object.assign($('#q-od'), {value: od, min: start}); Object.assign($('#q-do'), {value: doo, min: addDays(start, 1)});
  $('#q-od').addEventListener('change', e => { const v = e.target.value; $('#q-do').min = addDays(v, 1); if ($('#q-do').value <= v) $('#q-do').value = addDays(v, 2); });

  // úvod
  $('#intro-title').textContent = N.uvod.nadpis;
  $('#intro-text').textContent = N.uvod.text;
  $('#facts').innerHTML = N.uvod.fakta.map(f => `<div><b>${esc(f.cislo)}</b><span>${esc(f.popis)}</span></div>`).join('');

  // apartmány
  const types = A.typy;
  $('#apt-list').innerHTML = types.map((t, i) => `
    <article class="apt rv" tabindex="0" data-apt="${i}" aria-label="${esc(t.nazev)} – detail">
      <div class="ph"><img src="${t.fotky[0]}" alt="${esc(t.nazev)}" loading="lazy"><span class="badge ${t.foto_typ === 'Skutečné foto' ? 'dark' : ''}">${esc(t.foto_typ)}</span></div>
      <div class="bd">
        <h3>${esc(t.nazev)}</h3>
        <div class="meta"><span>${esc(t.plocha)}</span><span>až ${t.osoby} ${t.osoby < 5 ? 'osoby' : 'osob'}</span><span>${t.pocet}× v domě</span></div>
        <p>${esc(t.perex)}</p>
        <div class="ft"><span class="price">od <b>${kc(t.cena_noc)}</b> / noc</span><span class="more-link">Detail a fotky</span></div>
      </div>
    </article>`).join('');

  // detail apartmánu (šuplík)
  const dr = $('#drawer'); let cur = 0, ph = 0;
  function openApt(i) {
    cur = i; ph = 0; const t = types[i];
    $('#d-body').innerHTML = `
      <div class="gal"><img id="g-img" src="${t.fotky[0]}" alt="${esc(t.nazev)}"><span class="count" id="g-count">1 / ${t.fotky.length} · ${esc(t.foto_typ)}</span>
        <div class="nav"><button data-g="-1" aria-label="Předchozí foto">←</button><button data-g="1" aria-label="Další foto">→</button></div></div>
      <div class="thumbs">${t.fotky.map((f, j) => `<button data-t="${j}" class="${j ? '' : 'on'}" aria-label="Foto ${j + 1}"><img src="${f}" alt=""></button>`).join('')}</div>
      <div class="body">
        <p class="kicker">${t.pocet} ${t.pocet === 1 ? 'apartmán' : t.pocet < 5 ? 'apartmány' : 'apartmánů'} tohoto typu</p>
        <h3 id="d-title">${esc(t.nazev)}</h3>
        <p class="lead">${esc(t.perex)}</p>
        <div class="specs"><div><span>Plocha</span>${esc(t.plocha)}</div><div><span>Kapacita</span>až ${t.osoby} ${t.osoby < 5 ? 'osoby' : 'osob'}</div><div><span>Spaní</span>${esc(t.luzka)}</div><div><span>Cena</span>od ${kc(t.cena_noc)} / noc se snídaní</div></div>
        <ul class="ticks">${t.vybaveni.map(v => `<li>${esc(v)}</li>`).join('')}</ul>
        <a class="btn arrow" href="rezervace.html?typ=${t.id}&od=${$('#q-od').value}&do=${$('#q-do').value}&hoste=${Math.min(2, t.osoby)}">Ověřit volné termíny</a>
      </div>`;
    dr.classList.add('open'); dr.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
    dr.querySelector('.close').focus();
  }
  function showPh(j) { const t = types[cur]; ph = (j + t.fotky.length) % t.fotky.length; $('#g-img').src = t.fotky[ph]; $('#g-count').textContent = `${ph + 1} / ${t.fotky.length} · ${t.foto_typ}`; dr.querySelectorAll('[data-t]').forEach((b, k) => b.classList.toggle('on', k === ph)); }
  function closeApt() { dr.classList.remove('open'); dr.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; }
  $('#apt-list').addEventListener('click', e => { const a = e.target.closest('[data-apt]'); if (a) openApt(+a.dataset.apt); });
  $('#apt-list').addEventListener('keydown', e => { const a = e.target.closest('[data-apt]'); if (a && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openApt(+a.dataset.apt); } });
  dr.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeApt(); const g = e.target.closest('[data-g]'); if (g) showPh(ph + +g.dataset.g); const th = e.target.closest('[data-t]'); if (th) showPh(+th.dataset.t); });

  // wellness
  $('#well-title').innerHTML = esc(W.nadpis).replace(/ (\S+)$/, ' <em>$1</em>');
  $('#well-text').textContent = W.text;
  $('#well-items').innerHTML = W.polozky.map(p => `<div><b>${esc(p.nazev)}</b><span>${esc(p.popis)}</span></div>`).join('');
  $('#well-cta').textContent = `Privátní wellness ${W.cena}`;
  $('#well-pics').innerHTML = W.fotky.map((f, i) => `<img src="${f}" alt="Wellness ${i + 1}" loading="lazy">`).join('');

  // bistro
  $('#bistro-title').innerHTML = esc(B.nadpis).replace(/, (.+)$/, ',<br><em>$1</em>');
  $('#bistro-text').textContent = B.text;
  $('#bistro-hours').innerHTML = B.oteviraci_doba.map(h => `<div><span>${esc(h.co)}</span><span>${esc(h.kdy)}</span></div>`).join('');
  $('#bistro-pics').innerHTML = B.fotky.map((f, i) => `<img src="${f}" alt="Bistro ${i + 1}" loading="lazy">`).join('');

  // okolí se sezónním přepínačem
  const renderPlaces = s => { $('#places').innerHTML = O.mista.filter(m => m.sezona === s || m.sezona === 'celorocne').map(m => `<div class="place"><b>${esc(m.nazev)}</b><em>${esc(m.vzdalenost)}</em><span>${esc(m.popis)}</span></div>`).join(''); };
  const m = new Date().getMonth(); let season = (m >= 4 && m <= 9) ? 'leto' : 'zima';
  document.querySelectorAll('[data-season]').forEach(b => { const on = b.dataset.season === season; b.classList.toggle('on', on); b.setAttribute('aria-selected', on);
    b.addEventListener('click', () => { document.querySelectorAll('[data-season]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); }); renderPlaces(b.dataset.season); }); });
  renderPlaces(season);
  $('#transit').innerHTML = O.doprava.map(d => `<div><b>${esc(d.odkud)}</b>${esc(d.kolik)}</div>`).join('');

  // galerie + lightbox
  const pics = G.fotky; let li = 0; const lb = $('#lb');
  $('#gal-grid').innerHTML = pics.map((p, i) => `<button data-lbi="${i}" aria-label="Zvětšit: ${esc(p.popis)}"><img src="${p.src}" alt="${esc(p.popis)}" loading="lazy"></button>`).join('');
  const showLb = i => { li = (i + pics.length) % pics.length; $('#lb-img').src = pics[li].src; $('#lb-img').alt = pics[li].popis; $('#lb-cap').textContent = `${pics[li].popis} · ${li + 1} / ${pics.length}`; };
  $('#gal-grid').addEventListener('click', e => { const b = e.target.closest('[data-lbi]'); if (b) { showLb(+b.dataset.lbi); lb.classList.add('open'); lb.querySelector('.lb-x').focus(); } });
  lb.addEventListener('click', e => { const b = e.target.closest('[data-lb]'); if (b) b.dataset.lb === 'x' ? lb.classList.remove('open') : showLb(li + +b.dataset.lb); else if (e.target === lb) lb.classList.remove('open'); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { lb.classList.remove('open'); if (dr.classList.contains('open')) closeApt(); }
    if (lb.classList.contains('open') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) showLb(li + (e.key === 'ArrowRight' ? 1 : -1));
    if (dr.classList.contains('open') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) showPh(ph + (e.key === 'ArrowRight' ? 1 : -1));
  });

  // FAQ + kontakty
  $('#faq-list').innerHTML = F.otazky.map((q, i) => `<details ${i ? '' : 'open'}><summary>${esc(q.otazka)}</summary><p>${esc(q.odpoved)}</p></details>`).join('');
  const k = N.kontakt;
  $('#faq-mail').textContent = k.email; $('#faq-mail').href = 'mailto:' + k.email;
  $('#f-adresa').textContent = k.adresa; $('#f-tel').textContent = k.telefon; $('#f-mail').textContent = k.email;

  // předregistrace
  $('#pre-form').addEventListener('submit', async e => { e.preventDefault(); await submitForm(e.target); $('#pre-ok').textContent = 'Děkujeme, ozveme se s prvními termíny.'; e.target.reset(); });

  reveal();
})();
