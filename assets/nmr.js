/* Úvod Nord Moravia Resorts – obsah z data/nmr/*.json (CMS) */
(async () => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const load = n => fetch(`data/nmr/${n}.json`, {cache: 'no-cache'}).then(r => { if (!r.ok) throw new Error(n); return r.json(); });

  const hdr = $('#hdr'), bg = $('#burger');
  bg.addEventListener('click', () => { const o = hdr.classList.toggle('open'); bg.setAttribute('aria-expanded', o); });
  document.querySelectorAll('#nav a').forEach(a => a.addEventListener('click', () => hdr.classList.remove('open')));

  let N, R, T, I;
  try { [N, R, T, I] = await Promise.all(['nastaveni', 'resorty', 'tym', 'investice'].map(load)); }
  catch (e) { document.body.insertAdjacentHTML('afterbegin', '<p style="background:#fde8e8;padding:12px 20px">Data se nenačetla – web je potřeba spustit přes server (Netlify nebo npx serve).</p>'); return; }
  const res = R.resorty;

  // hero
  $('#h1').innerHTML = `${esc(N.hero.nadpis1)}<br><em>${esc(N.hero.nadpis2)}</em>`;
  $('#perex').textContent = N.hero.perex;
  $('#windows').innerHTML = res.map(r => `<a class="win" href="#${r.id}"><img src="${r.foto}" alt="${esc(r.nazev)}"><i class="bar" style="background:${r.barva === '#141117' ? '#EDE7DA' : r.barva}"></i>${r.stav === 'pripravujeme' ? '<span class="soon">Otevíráme 2028</span>' : ''}<span class="cap"><small>${esc(r.typ)} · ${esc(r.misto)}</small><b>${esc(r.nazev)}</b><span>${esc(r.cena_od)}</span></span></a>`).join('');

  // vyhledání – resort se vybere, termín se předá rezervaci daného resortu
  $('#kde').innerHTML = `<option value="">Vyberte resort</option>` + res.map(r => `<option value="${r.id}">${esc(r.nazev.replace('Wellness Hotel ', '').replace('Resort ', ''))}${r.stav === 'pripravujeme' ? ' (2028)' : ''}</option>`).join('');
  const iso = d => d.toISOString().slice(0, 10), t = new Date(); const fri = new Date(t); fri.setDate(t.getDate() + ((5 - t.getDay() + 7) % 7 || 7));
  const sun = new Date(fri); sun.setDate(fri.getDate() + 2);
  Object.assign($('#od'), {value: iso(fri), min: iso(t)}); Object.assign($('#do'), {value: iso(sun), min: iso(t)});
  $('#od').addEventListener('change', e => { if ($('#do').value <= e.target.value) { const d = new Date(e.target.value); d.setDate(d.getDate() + 2); $('#do').value = iso(d); } });
  $('#bb').addEventListener('submit', e => {
    e.preventDefault(); const r = res.find(x => x.id === $('#kde').value);
    if (!r) { $('#hint').textContent = 'Vyberte prosím resort – každý má vlastní dostupnost.'; $('#kde').focus(); return; }
    const q = `?od=${$('#od').value}&do=${$('#do').value}&hoste=${$('#hoste').value}`;
    location.href = r.rezervace.startsWith('http') ? r.rezervace : r.rezervace + q;
  });

  // čísla
  $('#nums').innerHTML = N.cisla.map(c => `<div><b>${esc(c.cislo)}</b><span>${esc(c.popis)}</span></div>`).join('');

  // resorty
  $('#rows').innerHTML = res.map(r => {
    const ext = r.web.startsWith('http');
    return `<article class="rrow rv" id="${r.id}">
      <div class="pics"><i class="accent" style="background:${r.barva}"></i><img class="a" src="${r.foto}" alt="${esc(r.nazev)}" loading="lazy"><img class="b" src="${r.foto2}" alt="" loading="lazy"></div>
      <div class="rtext"><p class="meta"><i style="background:${r.barva}"></i>${esc(r.typ)} · ${esc(r.misto)}</p><h3>${esc(r.nazev)}</h3><p>${esc(r.popis)}</p>
        <div class="tags">${r.stitky.map(s => `<span>${esc(s)}</span>`).join('')}</div>
        <div class="ft"><span class="price">${esc(r.cena_od)}</span><a class="btn" href="${r.web}"${ext ? ' target="_blank" rel="noopener"' : ''}>${r.stav === 'pripravujeme' ? 'Prohlédnout hotel' : 'Web resortu'} →</a></div></div>
    </article>`;
  }).join('');

  // o nás + tým
  $('#about-h').innerHTML = esc(N.o_nas.nadpis).replace(/ (je ta doma\.)$/, ' <em>$1</em>');
  $('#about-p').textContent = N.o_nas.text;
  const ini = n => n.split(' ').filter(w => /^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(w)).slice(0, 2).map(w => w[0]).join('');
  $('#team').innerHTML = T.lide.map(p => `<div class="person"><div class="ini">${ini(p.jmeno)}</div><b>${esc(p.jmeno)}</b><small>${esc(p.role)}</small><p>${esc(p.bio)}</p></div>`).join('') + `<div class="person local"><b>Lokální tým přímo v Jeseníkách</b></div>`;

  // investice
  $('#inv-h').innerHTML = esc(I.nadpis).replace(/ (s námi\.)$/, ' <em>$1</em>');
  $('#inv-p').textContent = I.text; $('#inv-big').textContent = I.vynos; $('#inv-big-p').textContent = I.vynos_popis;
  $('#inv-list').innerHTML = I.body.map(b => `<li><b>${esc(b.nadpis)}</b><span>${esc(b.text)}</span></li>`).join('');
  $('#inv-note').textContent = I.upozorneni; $('#inv-cta').href = 'mailto:' + N.kontakt.email;

  // patička
  $('#f-res').innerHTML = res.map(r => `<span class="dot" style="background:${r.barva === '#141117' ? '#EDE7DA' : r.barva}"></span><a href="${r.web}">${esc(r.nazev.replace('Wellness Hotel ', ''))}</a>`).join('<br>');
  const k = N.kontakt;
  $('#f-kontakt').innerHTML = `<a href="mailto:${esc(k.email)}">${esc(k.email)}</a><br>${esc(k.telefon)}<br>${esc(k.firma)} · IČO ${esc(k.ico)}`;
  $('#f-copy').textContent = `© ${new Date().getFullYear()} Nord Moravia Resorts · ${k.firma}`;

  // reveal
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), {rootMargin: '0px 0px -8% 0px'}) : null;
  document.querySelectorAll('.rv').forEach(el => io ? io.observe(el) : el.classList.add('in'));
})();
