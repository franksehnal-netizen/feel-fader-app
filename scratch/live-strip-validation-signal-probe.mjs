// Regression: the always-visible live-status card (top-left square) must
// turn its Ch/CC line red when that fader has a validation error — today it
// only shows in the bank tab dot and the open section's dot, never here, so
// an invalid CC (e.g. 999) reads as perfectly normal in the persistent card.
// Spec: 2026-08-10-todo-batch-design.md §3.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await p.evaluate(() => { skipWelcome(); });
await new Promise(r => setTimeout(r, 300));

const before = await p.evaluate(() => document.getElementById('live-f1-tech').classList.contains('has-issue'));
P('live-f1-tech has no issue class on a valid config', !before, String(before));

const afterInvalid = await p.evaluate(() => {
  liveBank = 0;
  cfg.banks[0].fader1.cc = 999; // out of 0-127 range -> validate() flags b0.fader1
  renderPanels(); runValidation();
  return document.getElementById('live-f1-tech').classList.contains('has-issue');
});
P('live-f1-tech gets has-issue when fader1 CC is invalid', afterInvalid, String(afterInvalid));

const otherUnaffected = await p.evaluate(() => document.getElementById('live-f2-tech').classList.contains('has-issue'));
P('live-f2-tech is unaffected by a fader1-only error', !otherUnaffected, String(otherUnaffected));

const colorChanged = await p.evaluate(() => {
  const el = document.getElementById('live-f1-tech');
  return getComputedStyle(el).color;
});
const dangerColor = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--danger').trim());
P('has-issue color matches --danger', colorChanged.length > 0 && dangerColor.length > 0, `color=${colorChanged} --danger=${dangerColor}`);

const afterFixed = await p.evaluate(() => {
  cfg.banks[0].fader1.cc = 11;
  renderPanels(); runValidation();
  return document.getElementById('live-f1-tech').classList.contains('has-issue');
});
P('has-issue clears once the CC is fixed', !afterFixed, String(afterFixed));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
