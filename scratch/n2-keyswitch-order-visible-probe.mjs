// Regression probe (UX audit 2026-09-28, N-2): in Keyswitch mode the note →
// articulation list (ROLLER ORDER) is main content like in Articulation mode,
// not hidden under "Advanced"; Advanced keeps only Velocity and Note naming,
// and the list tells how to name a keyswitch.
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
  const bank = cfg.banks[0];
  bank.roller_mode = 'keyswitch'; bank.ks_notes = [24, 25, 26]; bank.ks_names = { 24: 'Legato', 25: 'Staccato' };
  _openRollerAdvanced.clear(); _openSections.clear(); _openSections.add('roller'); render();
  const list = document.getElementById('ks-tags-0');
  const details = document.querySelector('.bank-section[data-fader="roller"] details.roller-advanced');
  const rows = [...(list?.querySelectorAll('.seq-row') || [])];
  return {
    listOutsideAdvanced: !!list && !details?.contains(list),
    rowsVisible: rows.length === 3 && rows.every(row => row.checkVisibility({ contentVisibilityAuto: true })),
    names: rows.map(row => row.querySelector('.ks-note-name')?.textContent),
    addOutside: !details?.contains(document.getElementById('ks-note-input-0')),
    advancedOpen: details?.open,
    summary: details?.querySelector('.roller-advanced-summary')?.textContent,
    velocityInside: !!details?.contains(document.getElementById('b0-ks-vel')),
    namingInside: !!details?.querySelector('.ks-convention-stepper'),
    hint: list?.previousElementSibling?.textContent || '',
  };
});
P('keyswitch list sits outside Advanced', r.listOutsideAdvanced, JSON.stringify(r));
P('keyswitch rows with names are visible while Advanced is closed', r.rowsVisible && r.advancedOpen === false && r.names.join() === 'Legato,Staccato,' + r.names[2], JSON.stringify(r.names));
P('"Add note" sits with the list, outside Advanced', r.addOutside);
P('Advanced keeps Velocity and Note naming', r.velocityInside && r.namingInside, JSON.stringify(r));
P('Advanced summary reads "Velocity · note naming"', r.summary === 'Velocity · note naming', r.summary);
P('list header tells how to name a keyswitch', /double-click to name/i.test(r.hint), r.hint);

P('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
