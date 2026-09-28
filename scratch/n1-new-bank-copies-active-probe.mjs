// Regression probe (UX audit 2026-09-28, N-1): "+" creates the next bank as a
// copy of the bank being edited – same mapping and channel, labels that match
// what the faders send – appends it as "Bank N" and switches to it. Library
// setup is curated by Acoustic Empire, so "+" does not open it (Frank 2026-09-28).
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P = (l, ok, x='') => console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' – '+x:''}`);
const wait = ms => new Promise(r => setTimeout(r, ms));
const errs = [];

const p = await b.newPage();
p.on('pageerror', e => errs.push(String(e)));
p.on('dialog', d => d.accept());
await p.setViewport({ width:1440, height:900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil:'networkidle0' });
await p.evaluate(() => skipWelcome()); await wait(1200);

const r = await p.evaluate(() => {
  cfg.banks.splice(3);
  const src = cfg.banks[1];
  src.roller_mode = 'keyswitch'; src.ks_notes = [24, 25, 26]; src.ks_channel = 1;
  selectBank(1);
  document.querySelector('.bank-block-tab-add').click();
  const added = cfg.banks[cfg.banks.length - 1];
  const pick = bank => JSON.stringify({ f1: [bank.fader1.cc, bank.fader1.channel], f2: [bank.fader2.cc, bank.fader2.channel], enc: [bank.encoder.cc, bank.encoder.channel], mode: bank.roller_mode, ks: bank.ks_notes, ksCh: bank.ks_channel });
  const copied = pick(added) === pick(src);
  added.ks_notes.push(27);
  return {
    count: cfg.banks.length, activeBank, name: added.name, copied,
    independent: src.ks_notes.length === 3,
    activeTab: document.querySelector('.bank-block-tab.active')?.textContent.replace(/\s+/g, ' ').trim(),
    titleValue: document.querySelector('.bank-title-input')?.value,
    libraryOpen: !!document.querySelector('.library-popover:not([hidden])'),
    src: pick(src), added: pick(added),
  };
});
P('"+" appends the new bank and switches to it', r.count === 4 && r.activeBank === 3 && r.titleValue === 'Bank 4', JSON.stringify(r));
P('new bank is named "Bank 4"', r.name === 'Bank 4', r.name);
P('new bank copies the mapping and channel of the bank being edited', r.copied, `${r.src} vs ${r.added}`);
P('the copy is independent of its source', r.independent);
P('"+" does not open Library setup', !r.libraryOpen);

// From the default Bank 1 (Expression = CC11, Dynamics = CC1): labels in the new
// bank match what the faders actually send.
const d = await p.evaluate(() => {
  selectBank(0);
  addBank();
  const bank = cfg.banks[cfg.banks.length - 1];
  return { f1: [bank.fader1.cc, faderDisplayName(bank.fader1, 'fader1')], f2: [bank.fader2.cc, faderDisplayName(bank.fader2, 'fader2')], ch: bank.fader1.channel };
});
P('copy of Bank 1 keeps Expression on CC11, Dynamics on CC1 and Ch 1', d.f1.join() === '11,Expression' && d.f2.join() === '1,Dynamics' && d.ch === 0, JSON.stringify(d));

// The name follows the new bank's position; a freed "Bank 2" (renamed) is not
// reused for the 4th bank. A taken number moves on to the next free one.
const n = await p.evaluate(() => {
  cfg.banks.splice(3); cfg.banks[1].name = 'Horns'; selectBank(0);
  addBank();
  const fourth = cfg.banks[3].name;
  cfg.banks.splice(3); cfg.banks[2].name = 'Bank 4'; selectBank(0);
  addBank();
  return { fourth, taken: cfg.banks[3].name };
});
P('new bank is named by its position, not a freed lower number', n.fourth === 'Bank 4', JSON.stringify(n));
P('a taken position number moves on to the next free one', n.taken === 'Bank 5', JSON.stringify(n));

P('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
