/* Vila Republika – sdílené funkce (data z /vila-republika/data/*.json, upravuje se v CMS) */
const VR = {
  async load(...names) {
    const out = await Promise.all(names.map(n => fetch('data/' + n + '.json', {cache: 'no-cache'}).then(r => r.json())));
    return out.length === 1 ? out[0] : out;
  },
  esc: s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c])),
  // *text* → <em>text</em> (zvýraznění v nadpisech z CMS)
  em: s => VR.esc(s).replace(/\*(.+?)\*/g, '<em>$1</em>'),
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
  // propojí dva date inputy (odjezd vždy po příjezdu)
  dates(od, dd) {
    const t = new Date(); od.min = VR.iso(t);
    if (!od.value) od.value = VR.iso(VR.addDays(t, 14));
    const sync = () => { const m = VR.iso(VR.addDays(new Date(od.value), 1)); dd.min = m; if (!dd.value || dd.value < m) dd.value = VR.iso(VR.addDays(new Date(od.value), 2)); };
    od.addEventListener('change', sync); sync();
  }
};
