// Test celého toku platby proti simulované bráně ČSOB (bez internetu a bez skutečných klíčů).
// Spuštění: node scripts/test-platba.mjs
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const gen = () => crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs1', format: 'pem' } });
const merchant = gen(), gateway = gen();
const gsign = s => crypto.sign('RSA-SHA256', Buffer.from(s), gateway.privateKey).toString('base64');
const mverify = (s, sig) => crypto.verify('RSA-SHA256', Buffer.from(s), merchant.publicKey, Buffer.from(sig, 'base64'));

const pay = {}, forms = [], reservio = [], previoVolani = [];
const WCENA = 1850; // cena wellness v (simulovaném) Reservio – v CMS je jiná
let n = 0;
const server = http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString();
  const out = (j, s = 200) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)); };
  const signed = (payId, ps, authCode) => { const d = '20990101120000'; const j = { payId, dttm: d, resultCode: 0, resultMessage: 'OK', paymentStatus: ps, ...(authCode ? { authCode } : {}) }; j.signature = gsign([payId, d, 0, 'OK', ps, authCode].filter(x => x !== undefined).join('|')); return j; };
  if (req.url === '/' && req.method === 'POST') { forms.push(Object.fromEntries(new URLSearchParams(raw))); return res.end('ok'); }
  if (req.url === '/api/payment/init') {
    const b = JSON.parse(raw);
    const { initString } = await import('../netlify/lib/csob.mjs');
    if (!mverify(initString(b), b.signature)) return out({ resultCode: 110, resultMessage: 'Wrong signature' }, 401);
    assert.equal(b.totalAmount, b.cart.reduce((a, i) => a + i.amount, 0));
    const payId = 'p' + (++n) + '@MOCK';
    pay[payId] = { ps: 1, body: b };
    return out(signed(payId, 1));
  }
  const m = req.url.match(/^\/api\/payment\/status\/([^/]+)\/([^/]+)\/(\d+)\/(.+)$/);
  if (m) {
    const [mid, payId, d, sig] = m.slice(1).map(decodeURIComponent);
    if (!mverify([mid, payId, d].join('|'), sig)) return out({ resultCode: 110, resultMessage: 'Wrong signature' }, 401);
    const p = pay[payId]; if (!p) return out({ resultCode: 140, resultMessage: 'Payment not found' }, 200);
    return out(signed(payId, p.ps, p.ps >= 4 ? 'AUTH42' : undefined));
  }
  // --- simulované Reservio: každý den volno v 9:00, 14:00, 16:00, 18:00 a 20:00 (90 min) ---
  const biz = (req.url.match(/^\/v2\/businesses\/(B\d)\//) || [])[1]; // B1 = Červený dvůr, B2 = Vila Republika (každý svůj token)
  if (biz && req.url.includes('/availability/booking-slots')) {
    assert.equal(req.headers.authorization, biz === 'B1' ? 'Bearer RTOKEN' : 'Bearer RTOKEN_VR');
    const q = new URL(req.url, 'http://x').searchParams;
    const from = q.get('filter[from]').slice(0, 10), to = q.get('filter[to]').slice(0, 10), off = q.get('filter[from]').slice(19);
    const data = [];
    for (let d = from; d <= to; d = new Date(Date.parse(d + 'T12:00Z') + 864e5).toISOString().slice(0, 10))
      for (const h of ['09', '14', '16', '18', '20']) {
        const start = `${d}T${h}:00:00${off}`, end = `${d}T${String(+h + 1).padStart(2, '0')}:30:00${off}`;
        if (!reservio.some(b => b._biz === biz && +new Date(b.data.relationships.event.data.attributes.start) === +new Date(start))) data.push({ type: 'timeSlot', id: start, attributes: { start, end }, relationships: { resource: { data: { type: 'resource', id: 'R1' } } } });
      }
    return out({ data, links: { next: null } });
  }
  if (biz && req.url.includes('/services')) { // cena služby v Reservio (jiná než v CMS – web ji musí převzít)
    if (biz === 'B2') return out({ data: [{ type: 'service', id: 'bd326ccd-eb07-4b81-a8f4-7fad135a705f', attributes: { name: 'Standard pro ubytované', duration: 5400, cost: 1750, isVisible: true } }], links: { next: null } });
    return out({ data: [{ type: 'service', id: 'S90', attributes: { name: 'Pro ubytované - wellness 90', duration: 5400, cost: WCENA, isVisible: false } }], links: { next: null } });
  }
  if (biz && req.url.endsWith('/bookings') && req.method === 'POST') {
    const b = JSON.parse(raw); b._biz = biz; reservio.push(b);
    return out({ data: { type: 'booking', id: 'bk' + reservio.length, attributes: { state: 'confirmed' } } });
  }
  // --- simulované Previo (jen zápisy platby a stavu rezervace) ---
  if (req.url.startsWith('/x1/') || req.url.startsWith('/rest/')) {
    previoVolani.push({ url: req.url, body: raw });
    if (req.url.startsWith('/rest/invoice/addPayment')) return out({ invId: 991 });
    res.writeHead(200, { 'Content-Type': 'application/xml' });
    return res.end('<reservations><reservation><resId>R1</resId><voucher>V1</voucher></reservation></reservations>');
  }
  res.writeHead(404).end();
});
await new Promise(r => server.listen(0, r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nmr-platba-'));
Object.assign(process.env, { CSOB_ENV: 'test', CSOB_MERCHANT_ID: 'M1MIPSTEST', CSOB_PRIVATE_KEY: merchant.privateKey, CSOB_PUBLIC_KEY: gateway.publicKey, CSOB_URL: ORIGIN + '/api', OBJEDNAVKY_DIR: tmp, PREVIO_LIVE: '0', PREVIO_URL: ORIGIN + '/', RESERVIO_TOKEN: 'RTOKEN', RESERVIO_BUSINESS_ID: 'B1', RESERVIO_TOKEN_VR: 'RTOKEN_VR', RESERVIO_BUSINESS_ID_VR: 'B2', RESERVIO_URL: ORIGIN + '/v2' });
delete process.env.RESERVIO_JEN_CIST; delete process.env.RESERVIO_DEMO;
// wellness 90 min napojíme na simulovanou službu Reservio (jen v paměti, soubor se nemění)
const RJ = (await import('../cerveny-dvur/data/rezervace.json', { with: { type: 'json' } })).default;
RJ.doplnky.find(x => x.id === 'wellness').reservio_sluzba = 'S90';
delete process.env.NETLIFY_BLOBS_CONTEXT;
const platba = (await import('../netlify/functions/platba.mjs')).default;
const navrat = (await import('../netlify/functions/platba-navrat.mjs')).default;
const wellnessFn = (await import('../netlify/functions/wellness.mjs')).default;
const rezFn = (await import('../netlify/functions/rezervace.mjs')).default;
const { joinSig, initString, telefon } = await import('../netlify/lib/csob.mjs');
const R = JSON.parse(fs.readFileSync('cerveny-dvur/data/rezervace.json', 'utf8'));

const call = async (fnc, method, q = '', body, ct = 'application/json') => {
  const r = await fnc(new Request(ORIGIN + '/.netlify/functions/x' + q, { method, headers: { 'Content-Type': ct }, body }));
  return { status: r.status, headers: r.headers, json: r.headers.get('content-type')?.includes('json') ? await r.json() : null };
};
const plus = d => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const host = { jmeno: 'Jana', prijmeni: 'Testová', email: 'jana@example.com', telefon: '601 388 985', souhlas: 'on' };
const obj = (extra = {}) => JSON.stringify({ od: plus(30), do: plus(32), dospeli: 2, deti: 0, typ: 'Apartmán Komfort', sazba: 'snidane', doplnky: ['wellness', 'pes'], cena: 1, zpusob: 'karta', host, ...extra });
const ok = (name) => console.log('  ✓ ' + name);

console.log('Podpis podle wiki ČSOB');
const wiki = initString({ merchantId: 'M1MIPS0000', orderNo: '5547', dttm: '20220125131559', payOperation: 'payment', payMethod: 'card', totalAmount: 123400, currency: 'CZK', closePayment: true, returnUrl: 'https://shop.example.com/return', returnMethod: 'POST',
  cart: [{ name: 'Wireless headphones', quantity: 1, amount: 123400 }, { name: 'Shipping', quantity: 1, amount: 0, description: 'DPL' }],
  customer: { name: 'Jan Novák', email: 'jan.novak@example.com', homePhone: '+420.800300300' }, merchantData: 'some-base64-encoded-merchant-data', language: 'cs' });
assert.equal(wiki, 'M1MIPS0000|5547|20220125131559|payment|card|123400|CZK|true|https://shop.example.com/return|POST|Wireless headphones|1|123400|Shipping|1|0|DPL|Jan Novák|jan.novak@example.com|+420.800300300|some-base64-encoded-merchant-data|cs');
ok('řetězec pro payment/init odpovídá příkladu z wiki (pro použitá pole)');
assert.equal(telefon('601 388 985'), '+420.601388985'); assert.equal(telefon('+421 905 123 456'), '+421.905123456'); assert.equal(telefon('abc'), undefined);
ok('formát telefonu');

console.log('Nabídka plateb');
let r = await call(platba, 'GET');
assert.deepEqual([r.json.karta, r.json.prevod, r.json.test], [true, true, true]);
ok('karta i převod, testovací režim');

console.log('Platba kartou – úspěch');
r = await call(platba, 'POST', '', obj());
assert.ok(r.json.ok, JSON.stringify(r.json));
assert.match(r.json.presmerovani, new RegExp('^' + ORIGIN + '/api/payment/process/M1MIPSTEST/p1%40MOCK/\\d{14}/'));
const t = await import('../netlify/lib/cena.mjs');
const { resort } = await import('../netlify/lib/resorty.mjs');
const cena = (await t.spocitejCenu(resort('cerveny-dvur'), JSON.parse(obj()))).cena;
const komfort = R.typy.find(x => x.nazev === 'Apartmán Komfort');
const PES = R.doplnky.find(x => x.id === 'pes').cena * (R.doplnky.find(x => x.id === 'pes').jednotka === 'noc' ? 2 : 1);
const ocekavana = Math.round((komfort.cena_noc * 2 + R.snidane_osoba_noc * 2 * 2) * (1 - R.sleva_primo / 100)) + WCENA + PES; // pes: cena za pobyt z ceníku
assert.equal(cena, ocekavana);
assert.equal(pay['p1@MOCK'].body.totalAmount, cena * 100);
ok(`cena spočítaná na serveru (${cena} Kč), poslaná „cena: 1“ se ignoruje, wellness za cenu z Reservio`);
assert.equal(pay['p1@MOCK'].body.customer.mobilePhone, '+420.601388985');
assert.equal(Buffer.from(pay['p1@MOCK'].body.merchantData, 'base64').toString(), r.json.obj);
assert.ok(pay['p1@MOCK'].body.cart[0].name.length <= 20 && pay['p1@MOCK'].body.cart[0].description.length <= 40);
ok('data pro bránu (telefon, merchantData, limity délek)');
const o1 = r.json;
pay['p1@MOCK'].ps = 7;
const ret = { payId: 'p1@MOCK', dttm: '20990101120001', resultCode: '0', resultMessage: 'OK', paymentStatus: '7', authCode: 'AUTH42', merchantData: Buffer.from(o1.obj).toString('base64') };
ret.signature = gsign(joinSig([ret.payId, ret.dttm, ret.resultCode, ret.resultMessage, ret.paymentStatus, ret.authCode, ret.merchantData]));
r = await call(navrat, 'POST', '', new URLSearchParams(ret).toString(), 'application/x-www-form-urlencoded');
assert.equal(r.status, 303);
assert.equal(r.headers.get('location'), `/cerveny-dvur/rezervace.html?obj=${o1.obj}&t=${o1.t}`);
r = await call(platba, 'GET', `?obj=${o1.obj}&t=${o1.t}`);
assert.equal(r.json.stav, 'zaplaceno'); assert.equal(r.json.zaloha, cena);
ok('návrat z brány → zaplaceno, přesměrování na děkovnou stránku');
assert.equal(forms.at(-1)['form-name'], 'platba'); assert.equal(forms.at(-1).udalost, 'Platba kartou proběhla');
ok('upozornění recepci (Netlify formulář „platba“)');
r = await call(navrat, 'POST', '', new URLSearchParams(ret).toString(), 'application/x-www-form-urlencoded');
assert.equal(forms.filter(f => f.objednavka === o1.obj).length, 1);
ok('opakovaný návrat nic nezdvojí');
r = await call(platba, 'GET', `?obj=${o1.obj}&t=spatny`);
assert.equal(r.status, 404);
ok('bez správného tokenu stav objednávky nikdo nevidí');

console.log('Platba kartou – zamítnutá a nový pokus');
r = await call(platba, 'POST', '', obj({ typ: 'Apartmán pro dva', sazba: 'bez', doplnky: [] }));
const o2 = r.json;
pay['p2@MOCK'].ps = 6;
r = await call(navrat, 'POST', '', new URLSearchParams({ payId: 'p2@MOCK', merchantData: Buffer.from(o2.obj).toString('base64'), signature: 'x' }).toString(), 'application/x-www-form-urlencoded');
r = await call(platba, 'GET', `?obj=${o2.obj}&t=${o2.t}`);
assert.equal(r.json.stav, 'nezaplaceno');
ok('zamítnutá platba (i s podvrženým podpisem se stav bere z brány)');
r = await call(platba, 'POST', '', JSON.stringify({ obj: o2.obj, t: o2.t, znovu: true }));
assert.ok(r.json.presmerovani.includes('p3%40MOCK'));
assert.match(pay['p3@MOCK'].body.orderNo, /^9\d{9}$/);
ok('nový pokus = nové číslo platby');
pay['p3@MOCK'].ps = 8;
r = await call(platba, 'GET', `?obj=${o2.obj}&t=${o2.t}`);
assert.equal(r.json.stav, 'zaplaceno');
ok('host zavřel okno před návratem → stav se dotáhne z brány');

console.log('Převod');
r = await call(platba, 'POST', '', obj({ zpusob: 'prevod' }));
assert.equal(r.json.stav, 'ceka_na_prevod'); assert.equal(r.json.vs, r.json.obj); assert.equal(r.json.zaloha, cena);
assert.equal(r.json.splatnost, plus(R.platba.prevod_splatnost_dni));
assert.equal(forms.at(-1).zpusob, 'převodem');
ok('předběžná rezervace, záloha, VS a splatnost, upozornění recepci');

console.log('Kontroly');
for (const [name, body] of [['chybí souhlas', obj({ host: { ...host, souhlas: '' } })], ['termín v minulosti', obj({ od: plus(-3), do: plus(-1) })],
  ['neznámý apartmán', obj({ typ: 'Prezidentské apartmá' })], ['moc hostů', obj({ typ: 'Apartmán pro dva', dospeli: 4 })], ['krátký pobyt', obj({ do: plus(31) })], ['bez způsobu platby', obj({ zpusob: 'hotove' })],
  ['převod den před příjezdem', obj({ zpusob: 'prevod', od: plus(1), do: plus(3) })]]) {
  r = await call(platba, 'POST', '', body);
  assert.equal(r.status, 400, name); assert.ok(r.json.chyba);
}
ok('neplatné požadavky odmítne s chybou pro hosta');

console.log('Wellness k pobytu (Reservio)');
const [d1, d2, d3] = [plus(30), plus(31), plus(32)];
r = await call(wellnessFn, 'GET', `?doplnek=wellness&od=${d1}&do=${d3}`);
const casy = r.json.dny.flatMap(d => d.casy.map(c => d.den + ' ' + c.start.slice(11, 16)));
assert.ok(!casy.includes(d1 + ' 09:00') && casy.includes(d1 + ' 14:00'), 'den příjezdu až od check-inu');
assert.ok(casy.includes(d3 + ' 09:00') === false && !casy.some(c => c.startsWith(d3)), 'v den odjezdu nic (90 min od 9:00 končí po 10:00)');
assert.ok(casy.includes(d2 + ' 09:00'));
ok('volné časy jen v době pobytu (check-in 14:00, check-out 10:00)');
r = await call(platba, 'POST', '', obj({ doplnky: { wellness: 9 } }));
assert.equal(pay[r.json.presmerovani.match(/(p\d+)%40/)[1] + '@MOCK'].body.totalAmount / 100, cena - WCENA - PES + 4 * WCENA);
ok('počet vstupů se promítne do ceny (max. podle CMS: 9 → 4)');
const T = async (d, h) => `${d}T${h}:00:00${(await import('../netlify/lib/reservio.mjs')).prahaISO(d).slice(19)}`;
r = await call(platba, 'POST', '', obj({ doplnky: { wellness: 2 }, wellness: { wellness: [await T(d2, '18'), await T(d1, '09')] } }));
const o5 = r.json, p5 = r.json.presmerovani.match(/(p\d+)%40/)[1] + '@MOCK';
r = await call(platba, 'GET', `?obj=${o5.obj}&t=${o5.t}`);
assert.equal(r.json.wellness[0].casy.length, 1); assert.equal(r.json.wellness[0].casy[0].stav, 'vybrano'); assert.equal(reservio.length, 0);
ok('vybraný čas se uloží, neplatný (před příjezdem) zahodí, do Reservio zatím nic – čeká se na platbu');
pay[p5].ps = 7;
r = await call(platba, 'GET', `?obj=${o5.obj}&t=${o5.t}`);
assert.equal(r.json.stav, 'zaplaceno'); assert.equal(reservio.length, 1);
const b1 = reservio[0].data;
assert.equal(b1.attributes.cost, 0); assert.match(b1.attributes.note, /Uhrazeno v rámci pobytu/); assert.match(b1.attributes.note, new RegExp(o5.obj));
assert.equal(b1.relationships.event.data.relationships.service.data.id, 'S90'); assert.equal(b1.relationships.client.data.attributes.email, host.email);
assert.equal(r.json.wellness[0].casy[0].stav, 'rezervovano'); assert.equal(r.json.wellness[0].zbyva, 1); assert.equal(r.json.wellnessOnline, true);
ok('po zaplacení rezervace v Reservio zdarma s poznámkou „uhrazeno v rámci pobytu“ a číslem objednávky');
r = await call(platba, 'POST', '', JSON.stringify({ obj: o5.obj, t: o5.t, doplnek: 'wellness', wellnessCas: await T(d2, '18') }));
assert.equal(r.status, 400);
ok('obsazený čas znovu nezarezervuje');
r = await call(platba, 'POST', '', JSON.stringify({ obj: o5.obj, t: o5.t, doplnek: 'wellness', wellnessCas: await T(d2, '20') }));
assert.ok(r.json.ok); assert.equal(r.json.wellness[0].zbyva, 0); assert.equal(reservio.length, 2);
r = await call(platba, 'POST', '', JSON.stringify({ obj: o5.obj, t: o5.t, doplnek: 'wellness', wellnessCas: await T(d2, '14') }));
assert.equal(r.status, 400); assert.match(r.json.chyba, /Všechny zaplacené vstupy/); assert.equal(reservio.length, 2);
ok('dodatečný výběr času z děkovné stránky – jen do počtu zaplacených vstupů');
r = await call(platba, 'POST', '', obj({ zpusob: 'prevod', wellness: { wellness: [await T(d1, '16')] } }));
assert.equal(reservio.length, 3); assert.match(reservio[2].data.attributes.note, /Hradí se v rámci zálohy/);
assert.match(forms.at(-1).wellness, /✓/);
ok('převod: čas se podrží hned, recepce ho vidí v upozornění');

console.log('Vila Republika (stejná komponenta, jiný resort)');
const vr = (extra = {}) => JSON.stringify({ resort: 'vila-republika', od: plus(30), do: plus(32), dospeli: 4, deti: 0, typ: 'Lázeňský', sazba: 'nevratna', doplnky: { wellness: 1 }, zpusob: 'karta', host, ...extra });
r = await call(platba, 'GET', '?resort=vila-republika');
assert.equal(r.json.karta, true);
const VRJ = JSON.parse(fs.readFileSync('vila-republika/data/rezervace.json', 'utf8'));
const laz = VRJ.typy.find(x => x.nazev === 'Lázeňský'), c4 = laz.ceny_osoby.find(x => x.osob === 4).cena;
const vrUbyt = Math.round(c4 * 2 * 0.9 * (1 - VRJ.sleva_primo / 100));
r = await call(platba, 'POST', '', vr({ wellness: { wellness: [await T(plus(31), '16')] } }));
assert.ok(r.json.ok, JSON.stringify(r.json));
const pvr = r.json.presmerovani.match(/(p\d+)%40/)[1] + '@MOCK', ovr = r.json;
assert.equal(pay[pvr].body.totalAmount / 100, vrUbyt + 1750);
assert.match(pay[pvr].body.cart[0].name, /Vila Republika/);
ok(`cena podle počtu osob (4 os. = ${c4} Kč/noc), nevratná −10 %, wellness za cenu z Reservio Vily (${vrUbyt + 1750} Kč)`);
pay[pvr].ps = 7;
const nb = reservio.length;
r = await call(navrat, 'POST', '', new URLSearchParams({ payId: pvr, merchantData: Buffer.from(ovr.obj).toString('base64') }).toString(), 'application/x-www-form-urlencoded');
assert.equal(r.headers.get('location'), `/vila-republika/rezervace.html?obj=${ovr.obj}&t=${ovr.t}`);
assert.equal(reservio.length, nb + 1); assert.equal(reservio.at(-1)._biz, 'B2');
assert.equal(reservio.at(-1).data.relationships.event.data.relationships.service.data.id, 'bd326ccd-eb07-4b81-a8f4-7fad135a705f');
assert.equal(forms.at(-1)['form-name'], 'platba-vila-republika');
ok('po zaplacení návrat na stránku Vily, wellness do Reservio Vily (ne Červeného dvora), upozornění na recepci Vily');
r = await call(wellnessFn, 'GET', `?resort=vila-republika&doplnek=wellness&od=${plus(30)}&do=${plus(32)}`);
assert.ok(!r.json.dny[0].casy.some(c => c.start.slice(11, 16) < '15:00'), 'Vila má check-in až od 15:00');
ok('check-in Vily od 15:00 (časy wellness v den příjezdu až potom)');
r = await call(platba, 'POST', '', vr({ typ: 'Prvorepublikový' }));
assert.equal(r.status, 400);
r = await call(platba, 'POST', '', vr({ typ: 'Lázeňský', dospeli: 7 }));
assert.equal(r.status, 400);
ok('apartmán bez ceny ani přeplněný apartmán nejde objednat');

console.log('Skupiny a křížový prodej');
r = await call(rezFn, 'GET', `?resort=cerveny-dvur&od=${plus(30)}&do=${plus(32)}&dospeli=8&deti=0`);
const komb = r.json.typy.filter(x => x.kombinace);
assert.ok(komb.length && komb[0].pokoje.length === 2 && komb[0].pokoje.reduce((a, q) => a + q.dospeli + q.deti, 0) === 8);
const k0 = komb[0], s0 = k0.sazby[0];
r = await call(platba, 'POST', '', obj({ dospeli: 8, typ: k0.id, sazba: s0.id, doplnky: {}, zpusob: 'prevod' }));
assert.ok(r.json.ok, JSON.stringify(r.json)); assert.equal(r.json.apartman, k0.nazev); assert.equal(r.json.zaloha, Math.round(s0.cena));
ok(`8 osob: nabídka dvou apartmánů (${k0.nazev}, ${k0.osoby}) a objednávka za součet obou`);
r = await call(rezFn, 'GET', `?resort=cerveny-dvur&od=${plus(30)}&do=${plus(32)}&dospeli=12&deti=5`);
assert.equal(r.json.typy.length, 0); assert.equal(r.json.jine[0].resort, 'vila-republika');
assert.ok(!/^images\//.test(r.json.jine[0].typy[0].foto)); // fotka jiného webu nesmí mít relativní cestu
ok('17 osob se do Rapotína nevejde → nabídka Vily Republika na stejný termín (křížový prodej)');

console.log('Wellness v jiném resortu');
const vrW = (await import('../vila-republika/data/rezervace.json', { with: { type: 'json' } })).default;
vrW.doplnky.find(x => x.id === 'wellness').mimo_provoz = true;
r = await call(wellnessFn, 'GET', `?resort=vila-republika&doplnek=wellness&od=${plus(30)}&do=${plus(32)}`);
assert.equal(r.json.mimo_provoz, true); assert.equal(r.json.dny.length, 0);
r = await call(wellnessFn, 'GET', `?resort=cerveny-dvur&doplnek=wellness&od=${plus(30)}&do=${plus(32)}`);
assert.equal(r.json.doplnek.cena, WCENA); assert.equal(r.json.resort.id, 'cerveny-dvur');
ok('wellness ve Vile mimo provoz → nabídka wellness v Rapotíně s cenou z jeho Reservio');
const nb2 = reservio.length;
r = await call(platba, 'POST', '', vr({ zpusob: 'prevod', doplnky: { 'alt:cerveny-dvur:wellness': 1 }, wellness: { 'alt:cerveny-dvur:wellness': [await T(plus(31), '16')] } }));
assert.ok(r.json.ok, JSON.stringify(r.json));
assert.equal(r.json.zaloha, vrUbyt + WCENA);
assert.equal(reservio.length, nb2 + 1); assert.equal(reservio.at(-1)._biz, 'B1');
assert.match(reservio.at(-1).data.attributes.note, /host ubytovaný v Vila Republika/);
r = await call(platba, 'POST', '', vr({ zpusob: 'prevod', doplnky: { 'alt:cerveny-dvur:snidane-postel': 1 } }));
assert.equal(r.json.zaloha, vrUbyt);
ok('host Vily si přidá wellness v Rapotíně – rezervace v Reservio Rapotína, cizí doplňky bez alternativy server nepustí');
vrW.doplnky.find(x => x.id === 'wellness').mimo_provoz = false;

console.log('Zápis platby do Previo (záloha vs. celá cena)');
{
  const { vyrid } = await import('../netlify/lib/vyrizeni.mjs');
  Object.assign(process.env, { PREVIO_LIVE: '1', PREVIO_API_KEY: 'PKEY', PREVIO_URL: ORIGIN + '/' });
  const objednavka = (zaloha, cena) => ({ obj: 'T' + zaloha, t: 'x', resort: 'cerveny-dvur', stav: 'ceka_na_platbu', zpusob: 'karta', web: ORIGIN, zaloha,
    pobyt: { cena, od: plus(30), do: plus(32), noci: 2, apartman: 'Apartmán Komfort', sazbaNazev: 'Se snídaní', dospeli: 2, deti: 0, doplnky: [] },
    host, previo: { resId: 'R1', voucher: 'V1' }, platby: [{ payId: 'x' }], chyby: [] });
  // záloha 30 %: invoice/addPayment se NESMÍ zavolat (zaplatil by celou rezervaci) → poznámka + upozornění recepci
  previoVolani.length = 0;
  const o30 = await vyrid(objednavka(1500, 5000), 7);
  assert.deepEqual(o30.chyby, []);
  assert.equal(o30.previo.platba, 'poznamka');
  assert.ok(!previoVolani.some(v => v.url.startsWith('/rest/invoice/addPayment')), 'záloha nesmí volat invoice/addPayment');
  const gnote = previoVolani.find(v => v.body.includes('<gNote>'));
  assert.ok(gnote && /ZÁLOHA ZAPLACENA 1\u00a0500 Kč kartou online \(ČSOB\)/.test(gnote.body) && /Doplatek 3\u00a0500 Kč na místě/.test(gnote.body), gnote && gnote.body);
  assert.ok(previoVolani.some(v => v.url === '/x1/hotel/reservation' && v.body.includes('<gCosId>2</gCosId>')));
  assert.match(forms.at(-1).previo, /ZAÚČTOVAT ZÁLOHU 1\u00a0500 Kč/);
  ok('záloha 30 %: rezervace potvrzená, v Previo poznámka o záloze (ne platba celé ceny), recepce ví, co zaúčtovat');
  // celá cena: doklad přes invoice/addPayment s platbou online
  previoVolani.length = 0;
  const o100 = await vyrid(objednavka(5000, 5000), 7);
  assert.equal(o100.previo.platba, 'doklad'); assert.equal(o100.previo.invId, 991);
  const ap = previoVolani.find(v => v.url.startsWith('/rest/invoice/addPayment'));
  assert.ok(ap); assert.equal(JSON.parse(ap.body).payId, 10);
  assert.match(forms.at(-1).previo, /zaplaceno celé, doklad vystaven/);
  ok('celá cena: invoice/addPayment (online platba) vystaví doklad');
  // balíček: styId u pokoje (commission), ne u celé rezervace
  const { vytvorRezervaci } = await import('../netlify/lib/previo.mjs');
  previoVolani.length = 0;
  await vytvorRezervaci(resort('cerveny-dvur'), { od: plus(30), do: plus(32), dospeli: 2, deti: 0, typ: komfort.previo_id || '123', stayId: 108653, cena: 9000, host, obj: 'T1', zpusob: 'karta', brana: 'ČSOB' });
  const nr = previoVolani.find(v => v.url === '/x1/hotel/reservation').body.replace(/\s+/g, '');
  assert.match(nr, /<commission>.*<styId>108653<\/styId>.*<\/commission>/);
  assert.equal((nr.match(/<styId>/g) || []).length, 1);
  assert.match(nr, /Platbakartouonline\(ČSOB\)/);
  ok('balíček (styId) se zapíše k pokoji, poznámka uvádí bránu');
  Object.assign(process.env, { PREVIO_LIVE: '0' });
}

server.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log('\nVšechno prošlo.');
