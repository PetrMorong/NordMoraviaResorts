/* Červený dvůr – stránka pro firmy (data/firmy.json + parametry sálu z data/akce.json) */
(async () => {
  const {esc, em, img} = CD;
  const [N, F, E] = await CD.load('nastaveni', 'firmy', 'akce');
  const $ = id => document.getElementById(id);
  $('hero-bg').style.backgroundImage = `url("${img(F.hero_foto, 2000, 1200)}")`;
  $('f-title').innerHTML = em(F.nadpis);
  $('f-perex').textContent = F.perex;
  $('f-sluzby').innerHTML = F.sluzby.map(s => `<article><img src="${img(s.foto, 640, 480)}" alt="${esc(s.nazev)}" loading="lazy"><h3>${esc(s.nazev)}</h3><p>${esc(s.text)}</p></article>`).join('');
  $('f-params').innerHTML = ((E.firmy && E.firmy.parametry) || []).map(p => `<div><dt>${esc(p.k)}</dt><dd>${esc(p.v)}</dd></div>`).join('');
  $('f-prog').innerHTML = F.program.map(p => `<li><b>${esc(p.cas)}</b><span>${esc(p.text)}</span></li>`).join('');
  $('f-vyhody').innerHTML = F.vyhody.map((v, i) => `<div><small>0${i + 1}</small><b>${esc(v.nadpis)}</b><span>${esc(v.text)}</span></div>`).join('');
  $('f-faq').innerHTML = F.faq.map(f => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('');
  $('f-osoba').textContent = [F.kontakt_osoba, F.kontakt_role && F.kontakt_role.toLowerCase()].filter(Boolean).join(', ');
  const f = $('f-form');
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const b = f.querySelector('button'); b.disabled = true; b.textContent = 'Odesílám…'; $('f-err').hidden = true;
    let ok = false;
    try { ok = (await fetch('/', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams(new FormData(f)).toString()})).ok; } catch (x) {}
    b.disabled = false; b.textContent = 'Odeslat poptávku';
    if (!ok) { $('f-err').textContent = `Odeslání se nepovedlo. Napište prosím na ${N.kontakt.email_akce} nebo volejte ${N.kontakt.telefon}.`; $('f-err').hidden = false; return; }
    (window.dataLayer = window.dataLayer || []).push({event: 'odeslani_formulare', formular: 'firmy', resort: 'cerveny-dvur'});
    f.innerHTML = `<h2 style="font-family:var(--disp);font-weight:400;font-size:30px">Děkujeme!</h2><p style="margin-top:10px">Poptávku máme. Nabídku vám pošleme do jednoho pracovního dne.</p>`;
  });
  CD.footer(N); CD.header(); CD.reveal();
})();
