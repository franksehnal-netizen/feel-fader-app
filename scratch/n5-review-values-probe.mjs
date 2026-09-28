// Regression probe (UX audit 2026-09-28, N-5): the Review list before Send shows
// values before → after, reports a bank rename even when the bank count changes
// too, and a roller mode switch is one item (not Roller + articulations).
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

// The audit's scenario: CC change, roller mode switch, rename + add a bank.
const r = await p.evaluate(() => {
  const start = configChangeItems();
  cfg.banks[0].fader1.cc = 7; dirty = true;
  setRollerMode(0, 'keyswitch');
  addBank();
  onBankRename(1, 'Horns');
  updateChangeSummary();
  return { start, items: configChangeItems(), list: [...document.querySelectorAll('#change-list li')].map(li => li.textContent) };
});
const has = s => r.items.includes(s);
P('clean start has no items', r.start.length === 0, JSON.stringify(r.start));
P('bank count still reported', has('Banks: 3 → 4'), JSON.stringify(r.items));
P('fader mapping shows CC before → after', has('Bank 1: Expression CC11 → CC7'), JSON.stringify(r.items));
P('roller mode switch shows modes before → after', has('Bank 1: Roller Articulation → Keyswitch'), JSON.stringify(r.items));
P('roller mode switch is one item (auto-filled keyswitch range not listed separately)', !r.items.some(i => /^Bank 1: (articulations|keyswitches)/.test(i)), JSON.stringify(r.items));
P('rename is reported alongside the bank count change', has('Bank 2 renamed → Horns'), JSON.stringify(r.items));
P('added bank is reported', has('Bank 4: new bank'), JSON.stringify(r.items));
P('Review list renders the same items', r.list.join('|') === r.items.slice(0, 7).join('|'), JSON.stringify(r.list));

// Channel, fader name and list-length changes without any mode switch.
const c = await p.evaluate(() => {
  const base = cloneConfig(cfg);
  cfg.banks[2].fader2.channel = 5;
  cfg.banks[2].fader1.label = 'Strings';
  cfg.banks[2].uacc_values = cfg.banks[2].uacc_values.slice(0, 15);
  cfg.banks[2].encoder.cc = 40;
  return configChangeItems(base, cfg);
});
const hasC = s => c.includes(s);
P('channel change shows Ch before → after', hasC('Bank 3: Dynamics Ch 3 → Ch 6'), JSON.stringify(c));
P('fader rename shows old → new name', hasC('Bank 3: Expression renamed → Strings'), JSON.stringify(c));
P('articulation list shows count before → after', hasC('Bank 3: articulations 17 → 15'), JSON.stringify(c));
P('roller CC change shows CC before → after', hasC('Bank 3: Roller CC32 → CC40'), JSON.stringify(c));

// Reorder only (same names) stays a single "Bank order" item.
const o = await p.evaluate(() => {
  const base = cloneConfig(cfg), cur = cloneConfig(cfg);
  cur.banks.reverse();
  return configChangeItems(base, cur);
});
P('pure reorder is one "Bank order" item', o.length === 1 && o[0] === 'Bank order', JSON.stringify(o));

P('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
