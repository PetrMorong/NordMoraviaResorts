/* Rezervační proces: výběr apartmánu a ceny → doplňky a údaje → potvrzení.
   Ceny, typy, plány a doplňky jsou z CMS. Dostupnost se ptá serverless funkce (napojení na Previo);
   když funkce neběží (náhled), počítá se ukázková dostupnost lokálně. */
(async () => {
  const {load, kc, esc, iso, addDays, nights, fmtDate, nightsWord, submitForm} = SK;
  const app = document.getElementById('app');
  let N, A, P, D;
  try { [N, A, P, D] = await Promise.all(['nastaveni', 'apartmany', 'cenove-plany', 'doplnky'].map(load)); }
  catch (e) { app.innerHTML = `<div class="wrap done"><h1>Data se nenačetla</h1><p class="lead">${esc(e.message)} – spusťte web přes server (Netlify nebo <code>npx serve</code>).</p></div>`; return; }

  // rezim "poptavka" = nezávazná poptávka (bez platby, potvrzujeme ručně); "rezervace" = ostrá rezervace přes Previo
  const Q = N.rezim !== 'rezervace';
  const q = new URLSearchParams(location.search);
  const today = iso(new Date());
  const minDate = N.prvni_termin && N.prvni_termin > today ? N.prvni_termin : today;
  const S = {
    od: q.get('od') && q.get('od') >= minDate ? q.get('od') : minDate,
    do: null, hoste: +(q.get('hoste') || 2), typ: q.get('typ') || null,
    sel: null, extras: {}, guest: {}, step: 'vyber', avail: null, demo: false
  };
  S.do = q.get('do') && q.get('do') > S.od ? q.get('do') : addDays(S.od, 2);

  const steps = i => `<div class="steps">${['Termín', 'Apartmán', 'Doplňky a údaje', Q ? 'Odesláno' : 'Potvrzení'].map((s, j) => `<span class="${j < i ? 'done' : j === i ? 'on' : ''}">0${j + 1} ${s}${j < i ? ' ✓' : ''}</span>`).join('')}</div>`;
  const n = () => nights(S.od, S.do);
  const price = (t, plan) => Math.round(t.cena_noc * n() * plan.koeficient / 10) * 10;
  const extraPrice = x => x.jednotka === 'noc' ? x.cena * n() : x.jednotka === 'osoba' ? x.cena * S.hoste : x.cena;
  const fee = () => (N.mistni_poplatek || 0) * n() * S.hoste;

  async function availability() {
    try {
      const r = await fetch(`/.netlify/functions/dostupnost?od=${S.od}&do=${S.do}&hoste=${S.hoste}`);
      if (!r.ok) throw 0; const j = await r.json(); S.demo = !!j.demo; return j.volne; // {typId: pocet}
    } catch (e) {
      S.demo = true; const seed = [...(S.od + S.do)].reduce((a, c) => a + c.charCodeAt(0), 0);
      return Object.fromEntries(A.typy.map((t, i) => [t.id, Math.max(0, (t.pocet + seed + i * 3) % (t.pocet + 2) - 1)]));
    }
  }

  function summary(btn) {
    const s = S.sel; let body;
    if (!s) body = `<p class="empty">Vyberte apartmán a cenu. Souhrn se objeví tady.</p>`;
    else {
      const t = A.typy.find(x => x.id === s.typ), pl = P.plany.find(x => x.id === s.plan);
      const ex = D.doplnky.filter(x => S.extras[x.id]);
      const total = price(t, pl) + ex.reduce((a, x) => a + extraPrice(x), 0) + fee();
      body = `<div class="row"><span>Apartmán</span>${esc(t.nazev)}</div><div class="row"><span>Cena</span>${esc(pl.nazev)}</div>
        <div class="row"><span>Termín</span>${fmtDate(S.od)} – ${fmtDate(S.do)}</div><div class="row"><span>Hosté</span>${S.hoste}</div>
        <div class="row"><span>Ubytování · ${n()} ${nightsWord(n())}</span>${kc(price(t, pl))}</div>
        ${ex.map(x => `<div class="row"><span>${esc(x.nazev)}</span>${x.cena ? kc(extraPrice(x)) : 'na místě'}</div>`).join('')}
        <div class="row"><span>Místní poplatek</span>${kc(fee())}</div>
        <div class="tot"><span>${Q ? 'Orientační cena' : 'Celkem'}</span><b>${kc(total)}</b></div><p class="demo">vč. DPH · ${Q ? 'konečnou cenu potvrdíme v nabídce' : esc(pl.storno)}</p>
        ${btn ? `<button class="btn arrow" id="next">${btn}</button>` : ''}`;
    }
    return `<aside class="sum"><div class="in"><h3>Váš pobyt</h3>${body}<div class="trust">${Q ? '✓ Nezávazná poptávka<br>✓ Odpovíme do 24 hodin<br>✓ Nic neplatíte předem' : '✓ Nejlepší cena napřímo<br>✓ Potvrzení ihned e-mailem<br>✓ Klíč od apartmánu přijde SMS'}</div></div></aside>`;
  }

  async function vyber() {
    S.avail = S.avail || await availability();
    const list = A.typy.slice().sort((a, b) => (b.id === S.typ) - (a.id === S.typ));
    app.innerHTML = `<section class="bk-head"><div class="wrap">${steps(1)}<h1>Vyberte si <em>apartmán</em></h1>
      <form class="bk-search" id="srch"><label>Příjezd<input type="date" id="s-od" value="${S.od}" min="${minDate}" required></label><label>Odjezd<input type="date" id="s-do" value="${S.do}" min="${addDays(S.od, 1)}" required></label>
      <label>Hosté<select id="s-h">${[1, 2, 3, 4, 5, 6].map(h => `<option value="${h}" ${h === S.hoste ? 'selected' : ''}>${h} ${h === 1 ? 'host' : h < 5 ? 'hosté' : 'hostů'}</option>`).join('')}</select></label><button>Hledat</button></form></div></section>
      <div class="wrap bk-body"><div>
      ${S.demo ? `<p class="demo" style="margin-bottom:14px">Ukázková dostupnost – v ostrém provozu přijde z Previa.</p>` : ''}
      ${list.map(t => {
        const free = S.avail[t.id] ?? 0, fits = t.osoby >= S.hoste;
        if (!fits || !free) return `<article class="room na"><div class="top"><img src="${t.fotky[0]}" alt="" loading="lazy"><div><span class="badge">${esc(t.foto_typ)}</span><h3>${esc(t.nazev)}</h3><div class="meta"><span>${esc(t.plocha)}</span><span>až ${t.osoby} osoby</span></div></div></div><p class="note">${fits ? 'V tomto termínu obsazeno – zkuste jiný termín.' : `Pro ${S.hoste} hosty se nevejde (max. ${t.osoby}).`}</p></article>`;
        return `<article class="room"><div class="top"><img src="${t.fotky[0]}" alt="${esc(t.nazev)}" loading="lazy"><div>
          <span class="badge ${t.foto_typ === 'Skutečné foto' ? 'dark' : ''}">${esc(t.foto_typ)}</span><h3>${esc(t.nazev)}</h3>
          <div class="meta"><span>${esc(t.plocha)}</span><span>až ${t.osoby} ${t.osoby < 5 ? 'osoby' : 'osob'}</span><span>${esc(t.luzka)}</span></div>
          <p class="why">${esc(t.perex)}</p></div></div>
          ${P.plany.filter(pl => !Q || pl.id !== 'nevratna').map(pl => { const on = S.sel && S.sel.typ === t.id && S.sel.plan === pl.id; const pr = price(t, pl);
            return `<button class="rate ${on ? 'on' : ''}" data-pick="${t.id}|${pl.id}"><span><b>${esc(pl.nazev)}</b><small>${esc(pl.popis)}</small><small class="${pl.koeficient < 1 ? '' : 'g'}">${esc(pl.storno)}</small></span>
              <span class="p">${pl.doporuceno ? `<s>${kc(Math.round(pr * 1.12 / 10) * 10)} na portálech</s>` : ''}<strong>${kc(pr)}</strong><small>${n()} ${nightsWord(n())}</small></span><span class="pick">${on ? 'Vybráno ✓' : 'Vybrat'}</span></button>`; }).join('')}
          ${free <= 2 ? `<p class="last">Zbývá ${free === 1 ? 'poslední volný' : 'poslední 2 volné'}</p>` : '<div style="height:12px"></div>'}</article>`;
      }).join('')}</div>${summary('Pokračovat')}</div>`;
    document.getElementById('srch').addEventListener('submit', e => { e.preventDefault(); const od = e.target.querySelector('#s-od').value, dd = e.target.querySelector('#s-do').value;
      if (!od || !dd || dd <= od) return; S.od = od; S.do = dd; S.hoste = +e.target.querySelector('#s-h').value; S.avail = null; S.sel = null; vyber(); });
    app.querySelector('#s-od').addEventListener('change', e => { const d = app.querySelector('#s-do'); d.min = addDays(e.target.value, 1); if (d.value <= e.target.value) d.value = addDays(e.target.value, 2); });
    app.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => { const [typ, plan] = b.dataset.pick.split('|'); S.sel = {typ, plan}; const y = scrollY; vyber().then(() => scrollTo(0, y)); }));
    app.querySelector('#next')?.addEventListener('click', () => { S.step = 'udaje'; udaje(); scrollTo(0, 0); });
  }

  function udaje() {
    const g = S.guest;
    app.innerHTML = `<section class="bk-head"><div class="wrap">${steps(2)}<h1>Doplňky a <em>vaše údaje</em></h1><p style="opacity:.7;margin:10px 0 34px">${Q ? 'Doplňky zahrneme do nabídky. Přidat je můžete i později.' : 'Doplňky se zapíšou rovnou k rezervaci. Přidat je můžete i později.'}</p></div></section>
    <div class="wrap bk-body"><form id="df" novalidate>
      <div class="panel"><h3>Doplňky k pobytu</h3><p class="sub">Vyberte, co se vám hodí.</p>
        ${D.doplnky.map(x => `<div class="extra"><div><b>${esc(x.nazev)}</b><small>${esc(x.popis)}</small></div><span class="p">${x.cena ? `${kc(x.cena)}<small> / ${x.jednotka}</small>` : '<small>dle ceníku</small>'}</span><button type="button" class="tog ${S.extras[x.id] ? 'on' : ''}" data-ex="${x.id}" aria-pressed="${!!S.extras[x.id]}">${S.extras[x.id] ? 'Přidáno ✓' : 'Přidat'}</button></div>`).join('')}</div>
      <div class="panel"><h3>Kontaktní údaje</h3><p class="sub">${Q ? 'Na e-mail vám pošleme nabídku s potvrzením termínu a konečnou cenou.' : 'Na e-mail pošleme potvrzení, na telefon den před příjezdem kód ke dveřím.'}</p>
        <div class="form">
          <label>Jméno *<input id="jmeno" autocomplete="given-name" value="${esc(g.jmeno)}" required></label>
          <label>Příjmení *<input id="prijmeni" autocomplete="family-name" value="${esc(g.prijmeni)}" required></label>
          <label>E-mail *<input id="email" type="email" autocomplete="email" value="${esc(g.email)}" required></label>
          <label>Telefon *<input id="telefon" type="tel" autocomplete="tel" value="${esc(g.telefon)}" required></label>
          <label>Předpokládaný příjezd<select id="prijezd"><option>15:00 – 17:00</option><option selected>17:00 – 19:00</option><option>po 19:00</option></select></label>
          <label>IČO (při nákupu na firmu)<input id="ico" inputmode="numeric" value="${esc(g.ico)}"></label>
          <label class="full">Poznámka pro recepci<textarea id="poznamka" rows="3" placeholder="Např. slavíme výročí, přijedeme s kočárkem">${esc(g.poznamka)}</textarea></label>
        </div></div>
      <div class="panel">${Q ? `<h3>Nezávazná poptávka</h3><p class="sub">Teď nic neplatíte. Ověříme dostupnost a do 24 hodin vám pošleme nabídku. Rezervace platí až po vašem potvrzení.</p>` : `<h3>Platba</h3><p class="sub">Zabezpečená platební brána.</p>
        <div class="pays">${[['karta', 'Kartou online', 'Visa, Mastercard, Apple Pay'], ['prevod', 'Bankovní převod', 'QR platba do 3 dnů'], ['zaloha', 'Záloha 30 %', 'zbytek na místě']].map(([v, a, b], i) => `<label><input type="radio" name="platba" value="${a}" ${i ? '' : 'checked'}><b>${a}</b><small>${b}</small></label>`).join('')}</div>`}
        <label class="check"><input type="checkbox" id="souhlas"> ${Q ? 'Souhlasím se zpracováním osobních údajů pro vyřízení poptávky *' : 'Souhlasím s obchodními a storno podmínkami a se zpracováním osobních údajů *'}</label>
        <p class="err" id="err" role="alert"></p>
        <div style="display:flex;gap:12px;flex-wrap:wrap"><button type="button" class="btn line" id="back">← Zpět</button><button class="btn arrow" type="submit">${Q ? 'Odeslat nezávaznou poptávku' : 'Odeslat rezervaci'}</button></div>
      </div></form>${summary(null)}</div>`;
    app.querySelectorAll('[data-ex]').forEach(b => b.addEventListener('click', () => { S.extras[b.dataset.ex] = !S.extras[b.dataset.ex]; save(); const y = scrollY; udaje(); scrollTo(0, y); }));
    const save = () => ['jmeno', 'prijmeni', 'email', 'telefon', 'ico', 'poznamka'].forEach(id => { const el = app.querySelector('#' + id); if (el) S.guest[id] = el.value; });
    app.querySelectorAll('#df input, #df textarea').forEach(i => i.addEventListener('input', save));
    app.querySelector('#back').addEventListener('click', () => { save(); vyber(); scrollTo(0, 0); });
    app.querySelector('#df').addEventListener('submit', async e => {
      e.preventDefault(); save();
      const miss = ['jmeno', 'prijmeni', 'email', 'telefon'].filter(id => !S.guest[id]?.trim());
      const err = app.querySelector('#err');
      if (miss.length) { err.textContent = 'Vyplňte prosím jméno, příjmení, e-mail a telefon.'; app.querySelector('#' + miss[0]).focus(); return; }
      if (!/^\S+@\S+\.\S+$/.test(S.guest.email)) { err.textContent = 'Zkontrolujte prosím e-mail.'; app.querySelector('#email').focus(); return; }
      if (!app.querySelector('#souhlas').checked) { err.textContent = 'Potvrďte prosím souhlas s podmínkami.'; return; }
      const t = A.typy.find(x => x.id === S.sel.typ), pl = P.plany.find(x => x.id === S.sel.plan);
      const ex = D.doplnky.filter(x => S.extras[x.id]);
      const total = price(t, pl) + ex.reduce((a, x) => a + extraPrice(x), 0) + fee();
      const f = document.createElement('form');
      const data = {'form-name': 'rezervace', apartman: t.nazev, plan: pl.nazev, od: S.od, do: S.do, hoste: S.hoste, doplnky: ex.map(x => x.nazev).join(', '), cena: total, ...S.guest, prijezd: app.querySelector('#prijezd').value, platba: Q ? '' : app.querySelector('[name=platba]:checked').value, typ: Q ? 'nezávazná poptávka' : 'rezervace'};
      Object.entries(data).forEach(([k, v]) => { const i = document.createElement('input'); i.name = k; i.value = v ?? ''; f.appendChild(i); });
      S.sent = await submitForm(f);
      S.no = (Q ? 'P-' : 'SK-') + S.od.replace(/-/g, '').slice(2) + '-' + String(Math.floor(Math.random() * 900) + 100);
      hotovo(); scrollTo(0, 0);
    });
  }

  function hotovo() {
    const t = A.typy.find(x => x.id === S.sel.typ);
    app.innerHTML = `<section class="bk-head" style="padding-bottom:30px"><div class="wrap">${steps(4)}</div></section><div class="wrap"><div class="done" style="padding-top:60px">
      ${Q ? `<p class="kicker">Poptávka odeslána</p><h1>Děkujeme za poptávku.<br><em>Ozveme se do 24 hodin.</em></h1>
      <p class="lead">Nabídku s potvrzením termínu a konečnou cenou pošleme na ${esc(S.guest.email)}. Poptávka je nezávazná. ${S.sent ? '' : '<span class="demo">(náhled – formulář se odešle až na Netlify)</span>'}</p>
      <div class="resno"><span>Číslo poptávky</span><b>${S.no}</b></div>` : `<p class="kicker">Rezervace přijata</p><h1>Děkujeme za rezervaci.<br><em>Těšíme se na vás.</em></h1>
      <p class="lead">Potvrzení posíláme na ${esc(S.guest.email)}. ${S.sent ? '' : '<span class="demo">(náhled – formulář se odešle až na Netlify)</span>'}</p>
      <div class="resno"><span>Číslo rezervace</span><b>${S.no}</b></div>`}
      <div class="specs"><div><span>Apartmán</span>${esc(t.nazev)}</div><div><span>Hosté</span>${S.hoste}</div><div><span>Příjezd</span>${fmtDate(S.od)} ${esc(N.check_in)}</div><div><span>Odjezd</span>${fmtDate(S.do)} ${esc(N.check_out)}</div></div>
      <div class="next"><h3 class="disp" style="font-size:28px;margin-bottom:8px">Jak to bude dál</h3><ol>${Q ? '<li>Ověříme dostupnost a pošleme vám nabídku s konečnou cenou.</li><li>Rezervaci potvrdíte odpovědí na e-mail – teprve pak platíte zálohu.</li><li>Dotazy vám rádi zodpovíme na ' + esc(N.kontakt.email) + '.</li>' : '<li>Den před příjezdem vám pošleme SMS s kódem ke dveřím.</li><li>Čas privátního wellness si vyberete přes odkaz v e-mailu.</li><li>Parkování je zdarma přímo u domu.</li>'}</ol></div>
      <div style="display:flex;gap:12px;flex-wrap:wrap"><a class="btn" href="index.html">Zpět na úvod</a><a class="btn line" href="${esc(N.kontakt.mapa_url)}">Navigovat do hotelu</a></div></div></div>`;
  }

  vyber();
})();
