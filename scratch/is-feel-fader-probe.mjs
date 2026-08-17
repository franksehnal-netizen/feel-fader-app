// SEC-003 (final review 2026-08-17): isFeelFader() used to also match any
// MIDI port named "CircuitPython Audio" — a fallback for old firmware
// builds without a custom USB MIDI name. Frank: product hasn't shipped yet,
// so there's no installed base needing that compatibility fallback, and it
// would accidentally match ANY unrelated CircuitPython device's default
// port name too. Fix: match only "feel fader".
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

const r = await p.evaluate(() => ({
  exact: isFeelFader('Feel Fader'),
  upper: isFeelFader('FEEL FADER'),
  mixedWithModel: isFeelFader('Feel Fader FF'),
  genericCircuitPython: isFeelFader('CircuitPython Audio'),
  unrelated: isFeelFader('USB MIDI Device'),
}));
P('exact "Feel Fader" name still matches', r.exact === true, JSON.stringify(r));
P('uppercase "FEEL FADER" (older set_interface_name fallback) still matches', r.upper === true, JSON.stringify(r));
P('"Feel Fader FF" (product + model id) still matches', r.mixedWithModel === true, JSON.stringify(r));
P('generic "CircuitPython Audio" no longer matches (SEC-003 — unshipped product, no legacy-firmware installed base to support)', r.genericCircuitPython === false, JSON.stringify(r));
P('unrelated MIDI device name does not match', r.unrelated === false, JSON.stringify(r));
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
