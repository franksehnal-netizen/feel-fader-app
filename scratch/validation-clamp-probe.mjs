// Regression probe for SEC-001/SEC-002 (structure audit 2026-07-20): proves
// clampCc/clampChannel/clampCcList reject malicious/non-numeric input, and
// that validate() catches NaN cc/channel instead of silently letting it
// through (NaN<0 and NaN>127 both evaluate false in plain relational checks).
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

// --- clamp helpers reject malicious/out-of-range/non-numeric input ---
let r = await p.evaluate(() => ({
  xss: clampCc('<img src=x onerror=alert(1)>', 0),
  nan: clampCc(NaN, 5),
  over: clampCc(999, 0),
  under: clampChannel(-3, 2),
  frac: clampCc(64.9, 0),
  list: clampCcList(['3', '<x>', 200, 50]),
}));
P('clampCc rejects HTML/script payload', r.xss === 0, JSON.stringify(r.xss));
P('clampCc falls back to default on NaN', r.nan === 5, JSON.stringify(r.nan));
P('clampCc clamps above range to 127', r.over === 127, JSON.stringify(r.over));
P('clampChannel clamps below range to 0', r.under === 0, JSON.stringify(r.under));
P('clampCc truncates fractional values', r.frac === 64, JSON.stringify(r.frac));
P('clampCcList coerces/clamps every element', JSON.stringify(r.list) === '[3,0,127,50]', JSON.stringify(r.list));

// --- validate() catches NaN cc/channel (old code let NaN silently pass) ---
r = await p.evaluate(() => {
  const savedCfg = cfg;
  cfg = { banks: [{ name:'X', roller_mode:'cc', uacc_values:[1,2],
    fader1:{cc:NaN, channel:0}, fader2:{cc:1, channel:0}, encoder:{cc:32, channel:0} }] };
  const errsNaN = validate();
  cfg = { banks: [{ name:'X', roller_mode:'cc', uacc_values:[1,2],
    fader1:{cc:64, channel:0}, fader2:{cc:1, channel:0}, encoder:{cc:32, channel:0} }] };
  const errsValid = validate();
  cfg = savedCfg;
  return { nanErrorCount: errsNaN.length, validErrorCount: errsValid.length };
});
P('validate() flags NaN cc as an error', r.nanErrorCount > 0, JSON.stringify(r));
P('validate() has no false positive on a valid bank', r.validErrorCount === 0, JSON.stringify(r));

// --- normalizeFwConfig() end-to-end clamps a hostile device payload ---
r = await p.evaluate(() => {
  const hostile = { banks: [{
    fader_cc: ['<img src=x onerror=alert(1)>', 200],
    fader_ch: [-5, 99],
    encoder: 'nope', encoder_ch: 999,
    uacc_values: ['<x>', 300, 12],
    ks_notes: [-1, '</script>', 64],
    m: { n: 'Bank', i: '', l: ['A','B'] },
  }] };
  const out = normalizeFwConfig(hostile);
  const bank = out.banks[0];
  return {
    f1cc: bank.fader1.cc, f1ch: bank.fader1.channel,
    f2cc: bank.fader2.cc, f2ch: bank.fader2.channel,
    encc: bank.encoder.cc, ench: bank.encoder.channel,
    uacc: bank.uacc_values, ks: bank.ks_notes,
  };
});
const allNumeric = (v) => Number.isFinite(v);
const allInRange = (arr, lo, hi) => arr.every(v => Number.isFinite(v) && v >= lo && v <= hi);
P('normalizeFwConfig clamps fader1 cc/channel', allNumeric(r.f1cc) && r.f1cc>=0 && r.f1cc<=127 && allNumeric(r.f1ch) && r.f1ch>=0 && r.f1ch<=15, JSON.stringify(r));
P('normalizeFwConfig clamps fader2 cc/channel', allNumeric(r.f2cc) && r.f2cc>=0 && r.f2cc<=127 && allNumeric(r.f2ch) && r.f2ch>=0 && r.f2ch<=15, JSON.stringify(r));
P('normalizeFwConfig clamps encoder cc/channel', allNumeric(r.encc) && r.encc>=0 && r.encc<=127 && allNumeric(r.ench) && r.ench>=0 && r.ench<=15, JSON.stringify(r));
P('normalizeFwConfig clamps uacc_values elements', allInRange(r.uacc, 0, 127), JSON.stringify(r.uacc));
P('normalizeFwConfig clamps ks_notes elements', allInRange(r.ks, 0, 127), JSON.stringify(r.ks));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
