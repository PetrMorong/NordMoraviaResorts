// Platební brána ČSOB – eAPI v1.9 (https://github.com/csob/platebnibrana/wiki)
//
// Proměnné prostředí (Netlify → Site configuration → Environment variables, NIKDY do kódu ani do CMS):
//   CSOB_MERCHANT_ID       – ID obchodníka (např. M1MIPS0000)
//   CSOB_PRIVATE_KEY       – soukromý klíč obchodníka v PEM (celý obsah souboru .key, řádky lze nahradit \n)
//   CSOB_PRIVATE_KEY_FILE  – lokálně místo CSOB_PRIVATE_KEY: cesta k souboru s klíčem
//   CSOB_ENV               – "test" (výchozí, integrační iBrána – žádné skutečné peníze) nebo "prod"
//   CSOB_URL, CSOB_PUBLIC_KEY – jen pro testy (jiná adresa brány / jiný veřejný klíč brány)
//
// Podpis: hodnoty polí ve stanoveném pořadí spojené znakem „|“ (chybějící volitelná pole se vynechají i se
// oddělovačem), SHA-256 s RSA (PKCS#1 v1.5), Base64. Odpovědi brány se ověřují jejím veřejným klíčem.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { TEST, PROD } from './csob-keys.mjs';

const BASE = { test: 'https://iapi.iplatebnibrana.csob.cz/api/v1.9', prod: 'https://api.platebnibrana.csob.cz/api/v1.9' };

export const csobEnv = () => (process.env.CSOB_ENV === 'prod' ? 'prod' : 'test');
const base = () => (process.env.CSOB_URL || BASE[csobEnv()]).replace(/\/$/, '');
const mid = () => process.env.CSOB_MERCHANT_ID || '';
let _key;
const privKey = () => {
  if (_key) return _key;
  let pem = process.env.CSOB_PRIVATE_KEY || '';
  if (!pem && process.env.CSOB_PRIVATE_KEY_FILE) pem = fs.readFileSync(process.env.CSOB_PRIVATE_KEY_FILE, 'utf8');
  if (!pem) return null;
  return (_key = crypto.createPrivateKey(pem.replace(/\\n/g, '\n')));
};
const pubKey = () => crypto.createPublicKey((process.env.CSOB_PUBLIC_KEY || (csobEnv() === 'prod' ? PROD : TEST)).replace(/\\n/g, '\n'));

export const csobZapnuto = () => !!(mid() && (process.env.CSOB_PRIVATE_KEY || process.env.CSOB_PRIVATE_KEY_FILE));

// čas ve formátu YYYYMMDDHHMMSS (brána chce středoevropský čas a toleruje jen pár minut odchylky)
export const dttm = (d = new Date()) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).map(x => [x.type, x.value]));
  return `${p.year}${p.month}${p.day}${p.hour}${p.minute}${p.second}`;
};

const present = v => v !== undefined && v !== null && v !== '';
export const joinSig = vals => vals.filter(present).map(String).join('|');
export const sign = str => crypto.sign('RSA-SHA256', Buffer.from(str, 'utf8'), privKey()).toString('base64');
const verifyStr = (str, sig) => { try { return crypto.verify('RSA-SHA256', Buffer.from(str, 'utf8'), pubKey(), Buffer.from(sig || '', 'base64')); } catch { return false; } };

// Ověření podpisu odpovědi / návratu. Pořadí: payId|dttm|resultCode|resultMessage|paymentStatus|authCode|merchantData.
// U statusDetail / customerCode wiki pořadí výslovně neuvádí – zkusíme varianty bez nich i s nimi.
export const overOdpoved = r => {
  const head = [r.payId, r.dttm, r.resultCode, r.resultMessage, r.paymentStatus];
  const tails = [[r.authCode, r.merchantData], [r.authCode, r.merchantData, r.statusDetail], [r.authCode, r.statusDetail, r.merchantData], [r.customerCode, r.statusDetail], [r.statusDetail, r.authCode, r.merchantData]];
  if (head[0] === undefined && r.dttm) tails.unshift([]); // echo apod.
  return tails.some(t => verifyStr(joinSig([...head, ...t]), r.signature));
};

// Telefon pro bránu ve tvaru „+420.601388985“ – když ho nejde bezpečně převést, vynecháme ho.
export const telefon = s => {
  const t = String(s || '').replace(/[\s()-]/g, '');
  let m = t.match(/^(?:\+|00)(\d{1,3})(\d{6,12})$/);
  if (m) return `+${m[1]}.${m[2]}`;
  m = t.match(/^(\d{9})$/);
  return m ? `+420.${m[1]}` : undefined;
};
const cut = (s, n) => (s == null ? undefined : String(s).trim().slice(0, n).trim() || undefined);

async function call(method, path, body) {
  const r = await fetch(base() + path, {
    method, headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.resultCode !== 0) {
    const hint = r.headers.get('REQUEST_TEXT_TO_SIGN'); // integrační brána vrací řetězec, který si sama sestavila
    throw new Error(`ČSOB ${path.split('/').slice(0, 3).join('/')}: HTTP ${r.status} resultCode ${j.resultCode} ${j.resultMessage || ''}${hint ? ` | brána podepisuje: ${hint}` : ''}`);
  }
  if (!overOdpoved(j)) throw new Error(`ČSOB ${path}: neplatný podpis odpovědi`);
  return j;
}

// Sestavení podpisového řetězce pro payment/init (pořadí podle specifikace eAPI 1.9).
export const initString = b => joinSig([
  b.merchantId, b.orderNo, b.dttm, b.payOperation, b.payMethod, b.totalAmount, b.currency, b.closePayment, b.returnUrl, b.returnMethod,
  ...b.cart.flatMap(i => [i.name, i.quantity, i.amount, i.description]),
  ...(b.customer ? [b.customer.name, b.customer.email, b.customer.homePhone, b.customer.workPhone, b.customer.mobilePhone] : []),
  b.merchantData, b.customerId, b.language, b.ttlSec,
]);

/** Založí platbu. Vrací { payId, paymentStatus }. Částky v Kč (převedeme na haléře). */
export async function zalozPlatbu({ orderNo, castka, returnUrl, polozky, zakaznik = {}, merchantData, closePayment = true, ttlSec = 1800 }) {
  const cart = polozky.slice(0, 2).map(p => ({ name: cut(p.nazev, 20), quantity: 1, amount: Math.round(p.castka * 100), description: cut(p.popis, 40) }));
  const total = cart.reduce((a, i) => a + i.amount, 0);
  if (total !== Math.round(castka * 100)) throw new Error('Součet položek nesedí s částkou');
  const customer = zakaznik.jmeno || zakaznik.email ? { name: cut(zakaznik.jmeno, 45), email: cut(zakaznik.email, 100), mobilePhone: telefon(zakaznik.telefon) } : undefined;
  const b = {
    merchantId: mid(), orderNo: String(orderNo), dttm: dttm(), payOperation: 'payment', payMethod: 'card', totalAmount: total, currency: 'CZK',
    closePayment, returnUrl, returnMethod: 'POST', cart, customer,
    merchantData: merchantData ? Buffer.from(String(merchantData)).toString('base64') : undefined, language: 'cs', ttlSec,
  };
  // prázdná pole do JSONu neposíláme (a v podpisu se také vynechávají)
  const clean = o => JSON.parse(JSON.stringify(o, (k, v) => (v === '' ? undefined : v)));
  const body = clean(b);
  body.signature = sign(initString(b));
  const j = await call('POST', '/payment/init', body);
  if (j.paymentStatus !== 1) throw new Error(`ČSOB payment/init: platba ve stavu ${j.paymentStatus}`);
  return { payId: j.payId, paymentStatus: j.paymentStatus };
}

const getPath = (op, payId) => {
  const t = dttm();
  return `/payment/${op}/${encodeURIComponent(mid())}/${encodeURIComponent(payId)}/${t}/${encodeURIComponent(sign(joinSig([mid(), payId, t])))}`;
};
/** Adresa, na kterou se přesměruje prohlížeč hosta (platební stránka brány). */
export const platebniStranka = payId => base() + getPath('process', payId);
/** Stav platby přímo z brány (spolehlivější než návrat prohlížeče). */
export async function stavPlatby(payId) {
  const j = await call('GET', getPath('status', payId));
  return { paymentStatus: j.paymentStatus, authCode: j.authCode, statusDetail: j.statusDetail };
}
const putOp = (op, payId, extra = {}) => {
  const b = { merchantId: mid(), payId, dttm: dttm(), ...extra };
  b.signature = sign(joinSig([b.merchantId, b.payId, b.dttm, extra.totalAmount ?? extra.amount]));
  return call('PUT', `/payment/${op}`, b);
};
/** Zrušení platby, která ještě není zúčtovaná. */
export const zrusPlatbu = payId => putOp('reverse', payId);
/** Vrácení peněz (celé nebo částečné – částka v Kč). */
export const vratPlatbu = (payId, castka) => putOp('refund', payId, castka ? { amount: Math.round(castka * 100) } : {});

// stavy platby (paymentStatus)
export const NAZEV_BRANY = 'ČSOB'; // do poznámky v Previo a upozornění recepci (při přechodu na jinou bránu se mění jen tento soubor)
export const ZAPLACENO = [4, 7, 8];  // potvrzena / čeká na zúčtování / zúčtována
export const NEZDARENO = [3, 5, 6];  // zrušena hostem / odvolána / zamítnuta nebo vypršela
export const VRACENO = [9, 10];
