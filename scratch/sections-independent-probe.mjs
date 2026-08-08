// Regression probe: control sections toggle independently (no accordion) and
// their open/closed state is shared across banks, not stored per bank
// (Frank, HW test 2026-08-08 — spec 2026-08-08-ui-backlog-design.md §A).
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.evaluate(() => { skipWelcome(); });
await new Promise(r => setTimeout(r, 300));

const initial = await p.evaluate(() => ['fader1','fader2','roller','macro'].filter(k => isSectionOpen(k)));
P('all sections closed on first load', initial.length === 0, initial.join(',') || '(none)');

await p.evaluate(() => { toggleSection('fader1'); toggleSection('fader2'); });
const both = await p.evaluate(() => ['fader1','fader2'].every(k => isSectionOpen(k)));
P('opening a second section does not close the first', both, String(both));

await p.evaluate(() => { selectBank(1); });
await new Promise(r => setTimeout(r, 200));
const afterSwitch = await p.evaluate(() => ({
  state: ['fader1','fader2'].every(k => isSectionOpen(k)),
  dom:   !document.getElementById('section-body-1-fader2')?.hasAttribute('hidden'),
}));
P('open state survives a bank switch (state)', afterSwitch.state, String(afterSwitch.state));
P('open state survives a bank switch (DOM)',   afterSwitch.dom,   String(afterSwitch.dom));

await p.evaluate(() => { toggleSection('fader1'); });
const closedOne = await p.evaluate(() => !isSectionOpen('fader1') && isSectionOpen('fader2'));
P('clicking an open section closes only itself', closedOne, String(closedOne));

const noLegacy = await p.evaluate(() => typeof window.isBankSectionOpen === 'undefined' && typeof window.toggleBankSection === 'undefined');
P('legacy per-bank helpers are gone', noLegacy, String(noLegacy));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
