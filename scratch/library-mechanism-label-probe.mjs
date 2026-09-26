// Regression probe (UX audit 2026-09-25, F-2/K-6): every built-in library row
// used to carry the same "Starting point" tag. Each row now says HOW the
// setup switches articulations, so a composer can tell UACC from keyswitch
// before applying it.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' – '+x:''}`);
const p = await b.newPage();
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await p.evaluate(() => skipWelcome());

const r = await p.evaluate(() => {
  openQuickSetupMenu(activeBank);
  const rows = Object.fromEntries([...document.querySelectorAll(`#quick-setup-menu-${activeBank} .quick-setup-option`)]
    .map(el => [el.dataset.name, el.querySelector('.quick-setup-option-kind')?.textContent || '']));
  return { rows, count: Object.keys(LIBRARY_PRESETS).length };
});
const kinds = Object.values(r.rows);
P('menu lists every built-in library', Object.keys(r.rows).length === r.count, `${Object.keys(r.rows).length}/${r.count}`);
P('no row says the uninformative "Starting point"', !kinds.includes('Starting point'), JSON.stringify(kinds));
P('UACC library shows its mechanism and CC', r.rows['Spitfire BBC Symphony Orchestra'] === 'UACC · CC32', r.rows['Spitfire BBC Symphony Orchestra']);
P('keyswitch library shows its note range', r.rows['Sonuscore LUX – Violins 1'] === 'Keyswitch C0–G0', r.rows['Sonuscore LUX – Violins 1']);
await p.close();
await b.close();
