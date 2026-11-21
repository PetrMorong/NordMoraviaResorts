/* Společné funkce – načtení dat z CMS (JSON v /data), formátování, hlavička */
window.SK = (() => {
  const cache = {};
  const load = name => cache[name] ||= fetch(`data/${name}.json`, {cache: 'no-cache'}).then(r => {
    if (!r.ok) throw new Error(`Nelze načíst data/${name}.json`);
    return r.json();
  });
  const kc = n => Math.round(n).toLocaleString('cs-CZ').replace(/ /g, ' ') + ' Kč';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const iso = d => d.toISOString().slice(0, 10);
  const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
  const nights = (a, b) => Math.max(0, Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5));
  const fmtDate = s => { const d = new Date(s + 'T12:00:00'); return d.toLocaleDateString('cs-CZ', {weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric'}); };
  const nightsWord = n => n === 1 ? 'noc' : n < 5 ? 'noci' : 'nocí';

  // hlavička: průhledná nad hero, tmavá po scrollu; mobilní menu
  function header() {
    const h = document.getElementById('hdr'); if (!h) return;
    const set = () => h.classList.toggle('solid', window.scrollY > 40);
    if (!h.classList.contains('always')) { set(); window.addEventListener('scroll', set, {passive: true}); }
    const b = document.getElementById('burger');
    b?.addEventListener('click', () => { const o = h.classList.toggle('menu-open'); b.setAttribute('aria-expanded', o); h.classList.add('solid'); });
    document.querySelectorAll('#nav a').forEach(a => a.addEventListener('click', () => h.classList.remove('menu-open')));
    document.addEventListener('click', e => { document.querySelectorAll('details.net[open]').forEach(d => { if (!d.contains(e.target)) d.open = false; }); });
  }
  function reveal() {
    const els = document.querySelectorAll('.rv:not(.in)');
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), {rootMargin: '0px 0px -8% 0px'});
    els.forEach(e => io.observe(e));
  }
  // Netlify Forms – na Netlify se odešle, jinde (náhled) jen potvrdí
  async function submitForm(form) {
    const body = new URLSearchParams(new FormData(form)).toString();
    try { const r = await fetch('/', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body}); return r.ok; }
    catch (e) { return false; }
  }
  document.addEventListener('DOMContentLoaded', header);
  return {load, kc, esc, iso, addDays, nights, fmtDate, nightsWord, reveal, submitForm};
})();
