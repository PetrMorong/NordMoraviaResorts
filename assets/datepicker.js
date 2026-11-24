/* Výběr termínu pobytu (příjezd–odjezd) pro všechny weby sítě.
   Knihovna easepick (https://easepick.com, MIT): česky, dva měsíce vedle sebe, výběr rozsahu s počtem nocí,
   otevře se klikem kamkoli do pole. Původní <input type="date"> zůstanou jako skrytá pole s hodnotou RRRR-MM-DD,
   takže formuláře i ostatní skripty fungují beze změny. Když se knihovna nenačte, zůstane obyčejný kalendář prohlížeče.

   NMRDate.range(inputOd, inputDo, { minNoci, theme }) → Promise<{ refresh() }>
   refresh() zavolejte, když skript změní hodnotu inputů sám (např. pevný termín balíčku). */
window.NMRDate = (() => {
  const CDN = 'https://cdn.jsdelivr.net/npm/@easepick/bundle@1.2.1/dist/';
  let lib;
  const load = () => lib || (lib = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = CDN + 'index.umd.min.js'; s.async = true;
    s.onload = () => (window.easepick ? res(window.easepick) : rej(new Error('easepick'))); s.onerror = rej;
    document.head.append(s);
  }));
  const isoOf = d => d.format('YYYY-MM-DD');
  const label = inp => (inp.closest('label') && inp.closest('label').firstChild && inp.closest('label').firstChild.textContent.trim()) || 'Datum';

  async function range(od, doo, { minNoci = 1, theme = '/assets/datepicker.css' } = {}) {
    const noop = { refresh() {} };
    if (!od || !doo || od.dataset.dp) return noop;
    // celé pole otevře kalendář i bez knihovny (prohlížeče s showPicker)
    [od, doo].forEach(i => i.addEventListener('click', () => { try { i.showPicker && i.showPicker(); } catch (e) { /* nepodporováno */ } }));
    let ep;
    try { ep = await load(); } catch (e) { return noop; }
    od.dataset.dp = '1';
    const show = inp => {
      const s = document.createElement('input');
      s.type = 'text'; s.readOnly = true; s.className = 'dp-show'; s.placeholder = 'Vyberte datum';
      s.setAttribute('aria-label', label(inp)); s.setAttribute('inputmode', 'none');
      inp.after(s); inp.type = 'hidden';
      return s;
    };
    const a = show(od), b = show(doo);
    const picker = new ep.create({
      element: a, css: [CDN + 'index.css', theme], lang: 'cs-CZ', format: 'D. M. YYYY', firstDay: 1,
      grid: 2, calendars: window.innerWidth < 700 ? 1 : 2, zIndex: 60, autoApply: true,
      plugins: [ep.RangePlugin, ep.LockPlugin],
      RangePlugin: { elementEnd: b, tooltipNumber: n => n - 1, locale: { one: 'noc', few: 'noci', many: 'nocí', other: 'nocí' } },
      LockPlugin: { minDate: new Date(), minDays: minNoci + 1, selectForward: true },
      setup(p) {
        p.on('select', e => {
          od.value = isoOf(e.detail.start); doo.value = isoOf(e.detail.end);
          [od, doo].forEach(i => i.dispatchEvent(new Event('change', { bubbles: true })));
        });
      },
    });
    b.addEventListener('click', () => picker.show({ target: b }));
    // kalendář vyneseme do <body>, aby ho neořízl rodič s overflow:hidden (např. úvodní fotka); pozici počítá relativně k poli
    const w = picker.ui && picker.ui.wrapper;
    if (w) { document.body.append(w); Object.assign(w.style, { position: 'absolute', top: '0', left: '0', zIndex: '60' }); }
    const d = iso => new Date(iso + 'T12:00:00');
    const refresh = () => {
      if (od.value && doo.value) picker.setDateRange(d(od.value), d(doo.value));
      const fixed = od.readOnly || doo.readOnly; // pevný termín (balíček) – kalendář nenabízet
      a.disabled = b.disabled = fixed;
    };
    refresh();
    return { refresh, picker };
  }
  return { range };
})();
