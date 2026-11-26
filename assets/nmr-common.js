/* Nord Moravia Resorts – společný skript pro všechny weby sítě (NMR, Červený dvůr, Vila Republika, Soutok Kouty).
   1) souhlas s cookies (Google Consent Mode v2) + načtení GTM / Meta Pixelu až podle souhlasu
   2) měření konverzí do dataLayer (rezervace, telefon, e-mail, wellness, restaurace, formuláře)
   3) blok „výhody přímé rezervace“ – prvky s atributem data-nmr-vyhody
   4) lepicí rezervační lišta na mobilu – podle <body data-nmr-resort data-nmr-cta>
   5) odkazy mezi doménami sítě – Červený dvůr a Vila běží na vlastních doménách (viz netlify.toml a scripts/domeny.mjs)
   Nastavení: data/nmr/nastaveni.json (mereni) a data/nmr/vyhody.json, oboje v CMS. */
(() => {
  const ROOT = new URL('..', document.currentScript.src).href;          // kořen webu (o úroveň výš než /assets/)
  const load = n => fetch(ROOT + 'data/nmr/' + n + '.json', {cache: 'no-cache'}).then(r => r.ok ? r.json() : null).catch(() => null);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const body = document.body, resort = body.dataset.nmrResort || 'nmr';

  // ---------- 1) souhlas + měřicí kódy ----------
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  const KEY = 'nmr-souhlas';
  const saved = (() => { try { return localStorage.getItem(KEY); } catch (e) { return null; } })();
  const granted = v => ({ad_storage: v, ad_user_data: v, ad_personalization: v, analytics_storage: v});
  gtag('consent', 'default', {...granted(saved === 'vse' ? 'granted' : 'denied'), functionality_storage: 'granted', security_storage: 'granted', wait_for_update: 500});
  dataLayer.push({event: 'nmr_init', resort, stranka: location.pathname});

  const track = (event, data = {}) => dataLayer.push({event, resort, ...data});
  window.NMR = {track};

  // ---------- 5) domény sítě ----------
  // Zdrojové stránky odkazují relativně (../vila-republika/, ../soutok-kouty/, /), jako by vše leželo na nordmoraviaresorts.cz.
  // Na doméně resortu (resortcervenydvur.cz, vila-republika.cz) i na NMR po přepnutí domén (<meta name="nmr-domeny">)
  // se odkazy převedou na správnou doménu. Na náhledech Netlify a lokálně zůstávají relativní.
  const NMR_HOST = 'nordmoraviaresorts.cz';
  const DOMENY = {'cerveny-dvur': 'resortcervenydvur.cz', 'vila-republika': 'vila-republika.cz'};
  const host = location.hostname.replace(/^www\./, '');
  const slozka = Object.keys(DOMENY).find(k => DOMENY[k] === host);
  const domenyOn = !!slozka || (host === NMR_HOST && !!document.querySelector('meta[name="nmr-domeny"]'));
  // adresa na produkci → „logická“ adresa, jako by vše leželo na nordmoraviaresorts.cz (/cerveny-dvur/…)
  const logicka = u => {
    const k = Object.keys(DOMENY).find(x => DOMENY[x] === u.hostname.replace(/^www\./, ''));
    return k ? new URL('/' + k + u.pathname + u.search + u.hash, 'https://' + NMR_HOST) : u;
  };
  // logická adresa → skutečná adresa na produkční doméně (vždy absolutní, ať je to jednoznačné)
  const produkcni = u => {
    if (u.hostname.replace(/^www\./, '') !== NMR_HOST) return u.href;
    const m = u.pathname.match(/^\/(cerveny-dvur|vila-republika)(\/.*|$)/);
    return (m ? new URL((m[2] || '/') + u.search + u.hash, 'https://' + DOMENY[m[1]]) : new URL(u.pathname + u.search + u.hash, 'https://' + NMR_HOST)).href;
  };
  const stranka = logicka(new URL(location.href)); // tato stránka na „logické“ adrese
  const prevod = a => {
    const raw = a.getAttribute('href');
    if (!raw || /^(#|mailto:|tel:|javascript:|data:)/i.test(raw)) return;
    let u; try { u = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? logicka(new URL(raw)) : new URL(raw, stranka); } catch (e) { return; }
    if (!/^https?:$/.test(u.protocol) || u.hostname.replace(/^www\./, '') !== NMR_HOST) return;
    const nove = produkcni(u);
    if (nove !== raw) a.setAttribute('href', nove);
  };
  if (domenyOn) {
    const vse = () => document.querySelectorAll('a[href]').forEach(prevod);
    vse(); document.addEventListener('DOMContentLoaded', vse); addEventListener('load', vse);
    // odkazy vykreslené skripty později – převést těsně před kliknutím
    ['click', 'auxclick', 'pointerdown'].forEach(t => document.addEventListener(t, e => { const a = e.target.closest && e.target.closest('a[href]'); if (a) prevod(a); }, true));
  }

  let metaId = '';
  const startMeta = () => {
    if (!metaId || window.fbq) return;
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', metaId); fbq('track', 'PageView');
  };
  const fb = (name, data) => { if (window.fbq) fbq('trackCustom', name, data); };

  const banner = () => {
    if (saved || document.getElementById('nmr-cc')) return;
    body.insertAdjacentHTML('beforeend', `<div class="nmr-cc" id="nmr-cc" role="dialog" aria-live="polite" aria-label="Souhlas s cookies">
      <p>Používáme cookies, abychom věděli, co na webu funguje, a mohli vám ukázat relevantní nabídky. Nezbytné cookies běží vždy.</p>
      <div><button type="button" data-cc="nutne">Jen nezbytné</button><button type="button" data-cc="vse" class="ok">Přijmout vše</button></div></div>`);
    document.getElementById('nmr-cc').addEventListener('click', e => {
      const v = e.target.dataset.cc; if (!v) return;
      try { localStorage.setItem(KEY, v); } catch (err) {}
      gtag('consent', 'update', granted(v === 'vse' ? 'granted' : 'denied'));
      if (v === 'vse') startMeta();
      document.getElementById('nmr-cc').remove();
    });
  };
  window.NMR.cookies = () => { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); };

  // ---------- 2) měření událostí ----------
  const kind = a => {
    const h = a.href || '';
    if (h.startsWith('tel:')) return ['klik_telefon', 'Contact'];
    if (h.startsWith('mailto:')) return ['klik_email', 'Contact'];
    if (/reservio\.com/.test(h)) return ['klik_wellness_rezervace', 'Schedule'];
    if (/restaurace\.resortcervenydvur\.cz\/booking/.test(h)) return ['klik_rezervace_stolu', 'Schedule'];
    if (/restaurace\.resortcervenydvur\.cz/.test(h)) return ['klik_menu_restaurace', null];
    if (/booking\.previo\.(cz|app)|\/rezervace\.html/.test(h)) return ['zacatek_rezervace', 'InitiateCheckout'];
    if (/booking\.com|airbnb\./.test(h)) return ['klik_portal', null];
    return null;
  };
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]'); if (!a) return;
    const k = kind(a); if (!k) return;
    track(k[0], {odkaz: a.href, text: (a.textContent || '').trim().slice(0, 60)});
    if (k[1] && window.fbq) fbq('track', k[1]);
  }, true);
  document.addEventListener('submit', e => {
    const f = e.target, name = f.getAttribute('name') || f.id || 'formular';
    if (f.id === 'quick' || f.id === 'bb' || f.id === 'dates') { track('hledani_terminu', {formular: name}); return; }
    track('odeslani_formulare', {formular: name});
    if (window.fbq) fbq('track', 'Lead', {content_name: name});
  }, true);
  // rezervační stránka s Previo: zobrazení rezervačního okna = začátek rezervace
  if (!document.getElementById('nmr-booking') && document.querySelector('iframe[src*="previo"], iframe#previo, .page-book iframe')) track('zobrazeni_rezervace'); // rezervační komponenta měří sama

  // ---------- 3) + 4) výhody a lepicí lišta ----------
  Promise.all([load('nastaveni'), load('vyhody'), load('resorty')]).then(([N, V, R]) => {
    const m = (N && N.mereni) || {};
    metaId = m.meta_pixel_id || '';
    // Google tag (GA4 / Ads) přímo, bez GTM – události z dataLayer se posílají i do Google tagu
    if (m.google_tag_id && !m.gtm_id && !window.__nmrGtag) {
      window.__nmrGtag = true;
      const s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(m.google_tag_id);
      document.head.appendChild(s);
      gtag('js', new Date()); gtag('config', m.google_tag_id);
      const fwd = o => { if (o && typeof o === 'object' && !('length' in o) && o.event && !/^gtm\./.test(o.event) && o.event !== 'nmr_init') { const {event, ...rest} = o; gtag('event', event, rest); } };
      dataLayer.filter(o => o && o.event && o.event !== 'nmr_init').forEach(fwd);
      const push0 = dataLayer.push.bind(dataLayer);
      dataLayer.push = (...a) => { const r = push0(...a); a.forEach(fwd); return r; };
    }
    if (m.gtm_id && !window.google_tag_manager) {
      dataLayer.push({'gtm.start': Date.now(), event: 'gtm.js'});
      const s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(m.gtm_id);
      document.head.appendChild(s);
    }
    if (saved === 'vse') startMeta();
    if (m.gtm_id || m.google_tag_id || m.meta_pixel_id) banner();

    const res = R && R.resorty ? R.resorty.find(r => r.id === resort) : null;
    const vyhodyOn = V && V.aktivni && (!res || res.stav !== 'pripravujeme');

    if (vyhodyOn) document.querySelectorAll('[data-nmr-vyhody]').forEach(el => {
      const typ = el.dataset.nmrVyhody || 'blok';
      if (typ === 'pruh') {
        el.innerHTML = `<div class="nmr-vy-pruh"><b>${esc(V.pruh_nadpis)}</b>${V.body.map(b => `<span>✓ ${esc(b.nadpis)}</span>`).join('')}</div>`;
      } else {
        el.innerHTML = `<div class="wrap"><div class="nmr-vy"><div class="nmr-vy-h"><small>${esc(V.kicker)}</small><h2>${esc(V.nadpis)}</h2><p>${esc(V.text)}</p></div>
          <ul>${V.body.map(b => `<li><b>${esc(b.nadpis)}</b><span>${esc(b.text)}</span></li>`).join('')}</ul></div></div>`;
      }
      el.hidden = false;
    });

    // blok „součást sítě“ – prvky s atributem data-nmr-sit (ostatní resorty sítě, odkazy přes domény sítě)
    if (R && R.resorty) document.querySelectorAll('[data-nmr-sit]').forEach(el => {
      const jine = R.resorty.filter(r => r.id !== resort);
      el.innerHTML = `<div class="wrap"><div class="nmr-sit"><div class="nmr-sit-h"><small>Nord Moravia Resorts</small>
        <h2>${esc(el.dataset.nmrSitNadpis || 'Patříme do rodiny resortů v Jeseníkách')}</h2>
        <p>${esc(el.dataset.nmrSitText || 'Tři místa, jedna recepce a stejná péče o hosty. Vyberte si další pobyt v okolí.')}</p>
        <a class="nmr-sit-all" href="/">Celá síť Nord Moravia Resorts →</a></div>
        <ul>${jine.map(r => `<li><a href="/${esc(r.web)}"><i style="background:${esc(r.barva)}"></i><span><b>${esc(r.nazev)}</b><small>${esc(r.typ)} · ${esc(r.misto)}${r.stav === 'pripravujeme' ? ' · ' + esc(r.cena_od) : ''}</small></span><em>→</em></a></li>`).join('')}</ul></div></div>`;
      el.hidden = false;
      if (domenyOn) el.querySelectorAll('a[href]').forEach(prevod);
    });

    const cta = body.dataset.nmrCta;
    if (cta && !document.querySelector('.page-book')) {
      const title = body.dataset.nmrCtaTitle || (res && res.stav !== 'pripravujeme' ? res.cena_od : '');
      const sub = body.dataset.nmrCtaSub || (vyhodyOn ? V.lista : '');
      const ext = /^https?:/.test(cta) ? ' target="_blank" rel="noopener"' : '';
      body.insertAdjacentHTML('beforeend', `<div class="nmr-sticky" id="nmr-sticky"><div><b>${esc(title)}</b><small>${esc(sub)}</small></div><a href="${esc(cta)}"${ext}>${esc(body.dataset.nmrCtaLabel || 'Rezervovat')}</a></div>`);
      const st = document.getElementById('nmr-sticky');
      const toggle = () => st.classList.toggle('on', scrollY > innerHeight * .6 && innerHeight + scrollY < document.body.scrollHeight - 160);
      addEventListener('scroll', toggle, {passive: true}); toggle();
    }
  });

  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = ROOT + 'assets/nmr-common.css';
  document.head.appendChild(css);
})();
