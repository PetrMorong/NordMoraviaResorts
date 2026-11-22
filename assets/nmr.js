/* Úvod Nord Moravia Resorts – obsah z data/nmr/*.json (CMS) */
(async () => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const load = n => fetch(`data/nmr/${n}.json`, {cache: 'no-cache'}).then(r => { if (!r.ok) throw new Error(n); return r.json(); });

  const hdr = $('#hdr'), bg = $('#burger');
  bg.addEventListener('click', () => { const o = hdr.classList.toggle('open'); bg.setAttribute('aria-expanded', o); });
  document.querySelectorAll('#nav a').forEach(a => a.addEventListener('click', () => hdr.classList.remove('open')));

  let N, R, T, I, RV;
  try { [N, R, T, I, RV] = await Promise.all(['nastaveni', 'resorty', 'tym', 'investice', 'recenze'].map(load)); }
  catch (e) { document.body.insertAdjacentHTML('afterbegin', '<p style="background:#fde8e8;padding:12px 20px">Data se nenačetla – web je potřeba spustit přes server (Netlify nebo npx serve).</p>'); return; }
  const res = R.resorty;

  if ($('#h1')) {
  // hero
    $('#h1').innerHTML = `${esc(N.hero.nadpis1)}<br><em>${esc(N.hero.nadpis2)}</em>`;
    $('#perex').textContent = N.hero.perex;
    $('#windows').innerHTML = res.map(r => `<a class="win" href="#${r.id}"><img src="${r.foto}" alt="${esc(r.nazev)}"${r.foto_pozice ? ` style="object-position:${esc(r.foto_pozice)}"` : ''}><i class="bar" style="background:${r.barva === '#141117' ? '#EDE7DA' : r.barva}"></i>${r.stav === 'pripravujeme' ? '<span class="soon">Otevíráme 2028</span>' : ''}<span class="cap"><small>${esc(r.typ)} · ${esc(r.misto)}</small><b>${esc(r.nazev)}</b><span>${esc(r.cena_od)}</span></span></a>`).join('');
  
    // vyhledání – resort se vybere, termín se předá rezervaci daného resortu
    $('#kde').innerHTML = `<option value="">Vyberte resort</option>` + res.map(r => `<option value="${r.id}">${esc(r.nazev.replace('Wellness Hotel ', '').replace('Resort ', ''))}${r.stav === 'pripravujeme' ? ' (2028)' : ''}</option>`).join('');
    const pre = new URLSearchParams(location.search).get('resort') || (res.find(r => r.stav !== 'pripravujeme') || {}).id;
    if (pre) $('#kde').value = pre;
    const hv = N.cisla.find(c => /★/.test(c.cislo));
    $('#trust').innerHTML = [hv ? `<b>${esc(hv.cislo)}</b> ${esc(hv.popis)}` : '', '<b>−5 %</b> napřímo oproti portálům', '<b>sleva</b> na privátní wellness'].filter(Boolean).join('<i>·</i>');
    if (/odebirate=1/.test(location.search)) { const ok = $('#nl-ok'); if (ok) ok.hidden = false; }
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
        <div class="pics"><i class="accent" style="background:${r.barva}"></i><img class="a" src="${r.foto}" alt="${esc(r.nazev)}" loading="lazy"${r.foto_pozice ? ` style="object-position:${esc(r.foto_pozice)}"` : ''}><img class="b" src="${r.foto2}" alt="" loading="lazy"></div>
        <div class="rtext"><p class="meta"><i style="background:${r.barva}"></i>${esc(r.typ)} · ${esc(r.misto)}</p><h3>${esc(r.nazev)}</h3><p>${esc(r.popis)}</p>
          <div class="tags">${r.stitky.map(s => `<span>${esc(s)}</span>`).join('')}</div>
          <div class="ft"><span class="price">${esc(r.cena_od)}</span><a class="btn gold" href="${r.rezervace}">${r.stav === 'pripravujeme' ? 'Nezávazná poptávka' : 'Rezervovat napřímo'} →</a><a class="btn line" href="${r.web}"${ext ? ' target="_blank" rel="noopener"' : ''}>${r.stav === 'pripravujeme' ? 'Prohlédnout hotel' : 'Web resortu'}</a></div></div>
      </article>`;
    }).join('');
  
    // recenze – vlastní z CMS mají přednost; jinak mix: Google (Červený dvůr) + Reservio (Vila) a pruh hodnocení ze všech zdrojů
    let rv = (RV && RV.recenze) || [];
    const RS = await fetch('data/nmr/reservio.json', {cache: 'no-cache'}).then(x => x.ok ? x.json() : null).catch(() => null);
    const n1 = v => Number(v).toLocaleString('cs-CZ', {maximumFractionDigits: 1});
    const G = (RS && RS.google) || {}, V = RS && RS['vila-republika'], BK = (N && N.booking) || {};
    if (!rv.length && RS) {
      const gc = ((G['cerveny-dvur'] || {}).recenze || []).map(x => ({text: x.text, jmeno: x.jmeno, resort: 'Resort Červený dvůr', zdroj: 'Google ★★★★★'}));
      const vr = ((V && V.recenze) || []).filter(x => x.text.length > 50).map(x => ({text: x.text, jmeno: x.jmeno, resort: 'Vila Republika · wellness', zdroj: 'Reservio ★★★★★'}));
      for (let i = 0; i < 3; i++) { if (gc[i]) rv.push(gc[i]); if (vr[i]) rv.push(vr[i]); }
    }
    const badges = [];
    if (RS) {
      const g = k => G[k] && G[k].hodnoceni ? {z: 'Google', s: `★ ${n1(G[k].hodnoceni)}`, p: G[k].pocet, u: G[k].url} : null;
      const b = k => BK[k] && BK[k].skore ? {z: 'Booking', s: BK[k].skore, p: BK[k].pocet} : null;
      const ty = V && V.trustyou && V.trustyou.skore ? {z: 'TrustYou', s: `${V.trustyou.skore}/100`, p: V.trustyou.pocet} : null;
      const rs = V && V.hodnoceni ? {z: 'Reservio wellness', s: `★ ${n1(V.hodnoceni)}`, p: V.pocet, u: V.url} : null;
      [['Resort Červený dvůr', [g('cerveny-dvur'), b('cerveny-dvur')]], ['Vila Republika', [g('vila-republika'), b('vila-republika'), ty, rs]]].forEach(([r, xs]) => {
        xs = xs.filter(Boolean); if (xs.length) badges.push(`<div class="rb"><b>${esc(r)}</b><div>${xs.map(x => `<${x.u ? `a href="${esc(x.u)}" target="_blank" rel="noopener"` : 'span'}><strong>${esc(x.s)}</strong><small>${esc(x.z)} · ${x.p}</small></${x.u ? 'a' : 'span'}>`).join('')}</div></div>`);
      });
    }
    if (rv.length || badges.length) {
      $('#rev-badges').innerHTML = badges.join('');
      $('#rev').innerHTML = rv.slice(0, 6).map(x => `<figure${x.text.length > 160 ? ' class="long"' : ''}><blockquote>„${esc(x.text)}“</blockquote><figcaption><b>${esc(x.jmeno)}</b>${x.resort ? ` · ${esc(x.resort)}` : ''}${x.zdroj ? ` · ${esc(x.zdroj)}` : ''}</figcaption></figure>`).join('');
      $('#recenze').hidden = false;
    }
  }

  // o nás + tým
  const ini = n => n.split(' ').filter(w => /^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(w)).slice(0, 2).map(w => w[0]).join('');
  const face = p => p.foto
    ? `<img class="ph" src="${esc(p.foto)}" alt="${esc(p.jmeno)}" loading="lazy">`
    : `<div class="ph ph-empty" aria-hidden="true"><svg viewBox="0 0 80 80"><circle cx="40" cy="30" r="14"/><path d="M12 76c3-17 15-26 28-26s25 9 28 26"/></svg><span>${ini(p.jmeno)}</span></div>`;
  if ($('#about-h')) {
    $('#about-h').innerHTML = esc(N.o_nas.nadpis).replace(/ (je ta doma\.)$/, ' <em>$1</em>');
    $('#about-p').textContent = N.o_nas.text;
  }
  if ($('#hosts')) $('#hosts').innerHTML = T.lide.filter(p => p.na_uvodu).map(p => `<figure class="host">${face(p)}<figcaption><b>${esc(p.jmeno)}</b><small>${esc(p.uvod_role || p.role)}</small><p>${esc(p.uvod_text || p.bio)}</p></figcaption></figure>`).join('');
  if ($('#sub-p')) $('#sub-p').textContent = N.o_nas.text;
  if ($('#team')) $('#team').innerHTML = T.lide.map(p => `<div class="person">${p.foto ? `<img class="av" src="${esc(p.foto)}" alt="" loading="lazy">` : `<div class="ini">${ini(p.jmeno)}</div>`}<b>${esc(p.jmeno)}</b><small>${esc(p.role)}</small><p>${esc(p.bio)}</p></div>`).join('') + `<div class="person local"><b>Lokální tým přímo v Jeseníkách</b></div>`;

  if ($('#sale-h') && I.prodej) {
    const S = I.prodej, ext = u => /^https?:/.test(u) ? ' target="_blank" rel="noopener"' : '';
    $('#sale-h').innerHTML = esc(S.nadpis).replace(/\*(.+?)\*/g, '<em>$1</em>');
    $('#sale-p').textContent = S.text;
    $('#sale-proj').innerHTML = S.projekty.map(x => `<article class="proj"><img src="${esc(x.foto)}" alt="${esc(x.nazev)}" loading="lazy"><div><p class="kicker">${esc(x.misto)}</p><h3>${esc(x.nazev)}</h3><div class="price">${esc(x.cena)}</div><p>${esc(x.popis)}</p>${x.vynos ? `<small>${esc(x.vynos)}</small>` : ''}<a class="btn" href="${esc(x.odkaz)}"${ext(x.odkaz)}>${esc(x.tlacitko)} →</a></div></article>`).join('');
    $('#sale-units').innerHTML = (S.byty || []).length ? `<p class="kicker">Vybrané byty</p>` + S.byty.map(b => `<a class="unit" href="${esc(b.odkaz)}"${ext(b.odkaz)}><b>${esc(b.nazev)}</b><span>${esc(b.dispozice)} · ${esc(b.plocha)}</span><strong>${esc(b.cena)}</strong><i>Detail →</i></a>`).join('') : '';
  }
  if ($('#inv-h')) {
    $('#inv-h').innerHTML = esc(I.nadpis).replace(/ (s námi\.)$/, ' <em>$1</em>');
    $('#inv-p').textContent = I.text;
    $('#inv-opts').innerHTML = (I.moznosti || []).map(m => {
      const href = m.odkaz || 'mailto:' + N.kontakt.email + '?subject=' + encodeURIComponent(m.nazev);
      return `<article class="opt"><p class="kicker">${esc(m.nazev)}</p><div class="v">${esc(m.vynos)}</div><small>${esc(m.vynos_popis)}</small><p>${esc(m.text)}</p><ul>${(m.body || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul><a class="btn gold" href="${esc(href)}"${/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : ''}>${esc(m.tlacitko)} →</a></article>`;
    }).join('');
    $('#inv-list').innerHTML = I.body.map(b => `<li><b>${esc(b.nadpis)}</b><span>${esc(b.text)}</span></li>`).join('');
    $('#inv-note').textContent = I.upozorneni;
  }

  // patička
  $('#f-res').innerHTML = res.map(r => `<span class="dot" style="background:${r.barva === '#141117' ? '#EDE7DA' : r.barva}"></span><a href="${r.web}">${esc(r.nazev.replace('Wellness Hotel ', ''))}</a>`).join('<br>');
  const k = N.kontakt;
  $('#f-kontakt').innerHTML = `<a href="mailto:${esc(k.email)}">${esc(k.email)}</a><br>${esc(k.telefon)}<br>${esc(k.firma)} · IČO ${esc(k.ico)}`;
  $('#f-copy').textContent = `© ${new Date().getFullYear()} Nord Moravia Resorts · ${k.firma}`;

  // reveal
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), {rootMargin: '0px 0px -8% 0px'}) : null;
  document.querySelectorAll('.rv').forEach(el => io ? io.observe(el) : el.classList.add('in'));
})();
