/* Červený dvůr – sdílené funkce (data z /cerveny-dvur/data/*.json, upravuje se v CMS) */
const CD = {
  async load(...names) {
    const out = await Promise.all(names.map(n => fetch('data/' + n + '.json', {cache: 'no-cache'}).then(r => r.json())));
    return out.length === 1 ? out[0] : out;
  },
  esc: s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c])),
  // *text* → <em>text</em> (zvýraznění v nadpisech z CMS)
  em: s => CD.esc(s).replace(/\*(.+?)\*/g, '<em>$1</em>'),
  // Cloudinary public_id → URL s ořezem; cesty (images/…) a plné URL nechá být
  img(src, w, h) {
    if (!src) return '';
    if (/^(https?:|\/|images\/)/.test(src)) return src;
    return `https://res.cloudinary.com/morireality/image/upload/f_auto,q_auto,c_fill,g_auto,w_${w}${h ? ',h_' + h : ''}/${src}`;
  },
  iso: d => d.toISOString().slice(0, 10),
  addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; },
  reveal() {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), {rootMargin: '0px 0px -8% 0px'});
    document.querySelectorAll('.rv').forEach(el => io.observe(el));
    CD.anchor();
  },
  // Obsah se načítá z JSON až po otevření stránky, takže prohlížeč skočí na #kotvu dřív,
  // než sekce nad ní mají výšku. Po vykreslení (a dokud se dorovnává layout) na kotvu znovu dojedeme.
  anchor() {
    const go = () => { const t = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1))); if (t) t.scrollIntoView({block: 'start'}); };
    if (!location.hash) return;
    go();
    let user = false; const stop = () => { user = true; };
    ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(e => addEventListener(e, stop, {once: true, passive: true}));
    const ro = new ResizeObserver(() => { if (!user) go(); });
    ro.observe(document.body);
    addEventListener('load', () => { if (!user) go(); });
    setTimeout(() => ro.disconnect(), 3000);
  },
  header() {
    const h = document.getElementById('hdr');
    if (!h.classList.contains('always')) {
      const f = () => h.classList.toggle('solid', scrollY > 40);
      addEventListener('scroll', f, {passive: true}); f();
    }
    const b = document.getElementById('burger'), nav = document.getElementById('nav');
    if (b) b.onclick = () => { const o = nav.classList.toggle('open'); b.setAttribute('aria-expanded', o); };
    if (nav) nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));
  },
  // Obchodní a storno podmínky + zpracování osobních údajů – okno nad stránkou.
  // Podmínky jdou z Previo (funkce podminky), bez ní (lokálně, výpadek) z CMS (data/rezervace.json).
  _podm: null,
  async podminkyData() {
    if (CD._podm) return CD._podm;
    const f = await fetch('/.netlify/functions/podminky').then(r => r.ok ? r.json() : null).catch(() => null);
    if (f && f.html) return (CD._podm = f);
    const R = await CD.load('rezervace');
    return (CD._podm = {zdroj: 'cms', storno: [], html: (R.podminky_text || [R.podminky]).filter(Boolean).map(t => `<p>${CD.esc(t)}</p>`).join(''), ochrana: R.ochrana_udaju || []});
  },
  async podminky(co = 'podminky') {
    const P = await CD.podminkyData();
    let d = document.getElementById('cd-modal');
    if (!d) {
      d = document.createElement('dialog'); d.id = 'cd-modal'; d.className = 'cd-modal';
      d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
      document.body.append(d);
    }
    const ochrana = co === 'ochrana';
    d.innerHTML = `<div class="cd-modal-box" role="document"><header><h2>${ochrana ? 'Zpracování osobních údajů' : 'Obchodní a storno podmínky'}</h2><button type="button" data-close aria-label="Zavřít">×</button></header>
      <div class="cd-modal-body">${ochrana ? P.ochrana.map(t => `<p>${CD.esc(t)}</p>`).join('')
        : `${P.storno.length ? `<h3>Storno podmínky</h3><ul>${P.storno.map(t => `<li>${CD.esc(t)}</li>`).join('')}</ul><h3>Doplňující obchodní podmínky</h3>` : ''}${P.html}`}</div>
      <footer><button type="button" class="btn red" data-close>Zavřít</button></footer></div>`;
    d.showModal();
  },
  async legalLinks() {
    const nav = document.querySelector('.ftr nav');
    if (!nav || nav.querySelector('[data-podminky]')) return;
    const P = await CD.podminkyData().catch(() => null);
    const a = (co, t) => { const x = document.createElement('a'); x.href = '#'; x.dataset.podminky = co; x.textContent = t; x.onclick = e => { e.preventDefault(); CD.podminky(co); }; nav.append(x); };
    a('podminky', 'Obchodní a storno podmínky');
    if (P && P.ochrana && P.ochrana.length) a('ochrana', 'Zpracování osobních údajů');
  },
  // kontakt v patičce (společný pro všechny stránky)
  footer(N) {
    const K = N.kontakt, e = CD.esc, $ = id => document.getElementById(id);
    if ($('contact')) $('contact').innerHTML = `
      <div><dt>Recepce</dt><dd><a href="tel:${e(K.telefon.replace(/\s/g, ''))}">${e(K.telefon)}</a><br><a href="mailto:${e(K.email)}">${e(K.email)}</a></dd></div>
      ${(K.lide || []).map(l => `<div><dt>${e(l.role)}</dt><dd>${e(l.jmeno)}${l.telefon ? `<br><a href="tel:${e(l.telefon.replace(/\s/g, ''))}">${e(l.telefon)}</a>` : ''}${l.email ? `<br><a href="mailto:${e(l.email)}">${e(l.email)}</a>` : ''}</dd></div>`).join('')}
      <div><dt>Svatby a akce</dt><dd><a href="mailto:${e(K.email_akce)}">${e(K.email_akce)}</a></dd></div>
      <div><dt>Adresa</dt><dd>${e(K.adresa)}<br><a href="${e(K.mapa)}" target="_blank" rel="noopener">Zobrazit na mapě →</a></dd></div>
      <div><dt>Parkování</dt><dd>Zdarma přímo v areálu</dd></div>
      <div><dt>Provozovatel</dt><dd>${e(K.provozovatel)}</dd></div>`;
    if ($('k-tel')) $('k-tel').href = 'tel:' + K.telefon.replace(/\s/g, '');
    if ($('ftr-fb')) $('ftr-fb').href = K.facebook;
    if ($('ftr-ig')) $('ftr-ig').href = K.instagram;
    CD.legalLinks();
  },
  // jednoduchý lightbox: items [{src, alt}], kliknutí na [data-i] uvnitř root
  // Okno je jedno pro celou stránku; šipky listují galerií, ze které se fotka otevřela (stránka může mít víc galerií).
  lightbox(items, root) {
    let d = document.getElementById('lb');
    if (!d) {
      document.body.insertAdjacentHTML('beforeend', `<dialog class="lb" id="lb" aria-label="Galerie"><button class="x" aria-label="Zavřít">×</button><button class="nav prev" aria-label="Předchozí">‹</button><img alt=""><button class="nav next" aria-label="Další">›</button><p></p></dialog>`);
      d = document.getElementById('lb');
      const im = d.querySelector('img'), cap = d.querySelector('p');
      d._show = () => { const {items: it, i} = d._g; im.src = CD.img(it[i].src, 1800); im.alt = it[i].alt; cap.textContent = `${it[i].alt} · ${i + 1} / ${it.length}`; };
      const go = k => { const g = d._g; g.i = (g.i + k + g.items.length) % g.items.length; d._show(); };
      d.querySelector('.x').onclick = () => d.close();
      d.querySelector('.prev').onclick = () => go(-1);
      d.querySelector('.next').onclick = () => go(1);
      d.addEventListener('click', e => { if (e.target === d) d.close(); });
      addEventListener('keydown', e => { if (!d.open) return; if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); });
    }
    root.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { d._g = {items, i: +b.dataset.i}; d._show(); d.showModal(); });
  },
  // propojí dva date inputy (odjezd vždy po příjezdu)
  dates(od, dd) {
    const t = new Date(); od.min = CD.iso(t);
    if (!od.value) od.value = CD.iso(CD.addDays(t, 14));
    const sync = () => { const m = CD.iso(CD.addDays(new Date(od.value), 1)); dd.min = m; if (!dd.value || dd.value < m) dd.value = CD.iso(CD.addDays(new Date(od.value), 2)); };
    od.addEventListener('change', sync); sync();
  }
};

// Pobytové balíčky – společné pro úvod a stránku Balíčky (data/balicky.json + ceník z data/rezervace.json)
CD.balicky = {
  kc: n => Math.round(n).toLocaleString('cs-CZ') + ' Kč',
  dnes: () => new Date().toISOString().slice(0, 10),
  /** aktivní a ještě platné, hlavní balíček první, sezónní poslední */
  aktivni: B => (B.balicky || []).filter(b => b.aktivni && (!b.platnost_do || String(b.platnost_do).slice(0, 10) >= CD.balicky.dnes()))
    .sort((a, b) => (b.hlavni ? 1 : 0) - (a.hlavni ? 1 : 0) || (a.sezonni ? 1 : 0) - (b.sezonni ? 1 : 0)),
  noci: b => b.noci_min === b.noci_max ? `${b.noci_min} ${b.noci_min < 5 ? 'noci' : 'nocí'}` : `${b.noci_min}–${b.noci_max} nocí`,
  strava: b => ({polopenze: 'polopenze', snidane: 'snídaně v ceně', bez: 'bez stravy'})[b.strava || 'snidane'],
  meta: b => `${CD.balicky.noci(b)} · pro ${b.osoby} osoby · ${CD.balicky.strava(b)}`,
  /** ceny „od“ z Previo, které stáhne build (scripts/balicky-ceny.mjs); když nejsou, null */
  ceny: () => fetch('data/balicky-ceny.json', {cache: 'no-cache'}).then(r => r.ok ? r.json() : null).catch(() => null),
  /** cena „od“ pro 2 osoby: z Previo (C = balicky-ceny.json), jinak orientačně z ceníku v CMS */
  cenaOd(b, R, C) {
    const p = C && C.zdroj === 'previo' && C.ceny && C.ceny[b.id];
    if (p && p.cena > 0) return p.cena;
    const noc = (R.typy || []).filter(t => (t.max_osob || 2) >= 2).map(t => +t.cena_noc || Math.min(...(t.ceny_osoby || []).map(c => +c.cena).filter(Boolean))).filter(c => c > 0);
    if (!noc.length) return null;
    const typ = b.strava || 'snidane';
    const s = (R.sazby || []).find(x => !x.nevratna && (x.strava || '') === typ);
    const strava = typ === 'bez' ? 0 : s ? (+s.strava_osoba_noc || (s.snidane ? +R.snidane_osoba_noc || 0 : 0)) : typ === 'snidane' ? +R.snidane_osoba_noc || 0 : 0;
    return (Math.min(...noc) * b.noci_min + strava * 2 * b.noci_min + (+b.priplatek || 0)) * (1 - (+R.sleva_primo || 0) / 100);
  },
  odkaz(b) {
    const t = /^\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/.test(b.termin || '') ? b.termin.split('/') : null;
    return `rezervace.html?balicek=${encodeURIComponent(b.id)}` + (t ? `&od=${t[0]}&do=${t[1]}` : '');
  },
  platnost(b) {
    const f = d => new Date(String(d).slice(0, 10) + 'T12:00').toLocaleDateString('cs-CZ', {day: 'numeric', month: 'numeric', year: 'numeric'});
    const od = b.platnost_od && String(b.platnost_od).slice(0, 10) > CD.balicky.dnes() ? `od ${f(b.platnost_od)} ` : '';
    return b.platnost_do ? `Příjezd ${od}do ${f(b.platnost_do)}` : od ? `Příjezd ${od}` : '';
  },
};
