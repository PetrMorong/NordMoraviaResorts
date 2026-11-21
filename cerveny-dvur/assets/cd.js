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
  },
  // jednoduchý lightbox: items [{src, alt}], kliknutí na [data-i] uvnitř root
  lightbox(items, root) {
    let d = document.getElementById('lb');
    if (!d) {
      document.body.insertAdjacentHTML('beforeend', `<dialog class="lb" id="lb" aria-label="Galerie"><button class="x" aria-label="Zavřít">×</button><button class="nav prev" aria-label="Předchozí">‹</button><img alt=""><button class="nav next" aria-label="Další">›</button><p></p></dialog>`);
      d = document.getElementById('lb');
    }
    const im = d.querySelector('img'), cap = d.querySelector('p'); let i = 0;
    const show = () => { im.src = CD.img(items[i].src, 1800); im.alt = items[i].alt; cap.textContent = `${items[i].alt} · ${i + 1} / ${items.length}`; };
    root.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { i = +b.dataset.i; show(); d.showModal(); });
    d.querySelector('.x').onclick = () => d.close();
    d.querySelector('.prev').onclick = () => { i = (i - 1 + items.length) % items.length; show(); };
    d.querySelector('.next').onclick = () => { i = (i + 1) % items.length; show(); };
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
    addEventListener('keydown', e => { if (!d.open) return; if (e.key === 'ArrowLeft') d.querySelector('.prev').click(); if (e.key === 'ArrowRight') d.querySelector('.next').click(); });
  },
  // propojí dva date inputy (odjezd vždy po příjezdu)
  dates(od, dd) {
    const t = new Date(); od.min = CD.iso(t);
    if (!od.value) od.value = CD.iso(CD.addDays(t, 14));
    const sync = () => { const m = CD.iso(CD.addDays(new Date(od.value), 1)); dd.min = m; if (!dd.value || dd.value < m) dd.value = CD.iso(CD.addDays(new Date(od.value), 2)); };
    od.addEventListener('change', sync); sync();
  }
};
