import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/Fanda Borec/Documents/feel-fader-app/node_modules/puppeteer-core');

const URL = 'http://localhost:8100/feel-fader.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const P = (l, ok, x='') => console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

const b = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle0' });
await p.evaluate(() => { try{skipWelcome && skipWelcome()}catch(e){} });

// Open bank 0's keyswitch section (switch encoder mode to keyswitch first).
await p.evaluate(() => { cfg.banks[0].roller_mode = 'keyswitch'; render(); });

const opened = await p.evaluate(() => {
  document.getElementById('ks-preset-trigger-0')?.click();
  const menu = document.getElementById('ks-preset-menu-0');
  return { hidden: menu?.hidden, optionCount: menu?.querySelectorAll('.quick-setup-option').length };
});
P('Trigger opens the listbox with both presets', opened.hidden === false && opened.optionCount === 2, JSON.stringify(opened));

const before = await p.evaluate(() => cfg.banks[0].ks_notes.slice());
await p.evaluate(() => document.querySelector('#ks-preset-menu-0 .quick-setup-option[data-idx="1"]').click());
const after = await p.evaluate(() => ({ notes: cfg.banks[0].ks_notes.slice(), menuHidden: document.getElementById('ks-preset-menu-0').hidden, triggerLabel: document.querySelector('#ks-preset-trigger-0 span').textContent }));
P('Choosing "From C-1" applies MIDI 12-23 and closes the menu', after.notes[0] === 12 && after.notes[after.notes.length-1] === 23 && after.menuHidden === true, JSON.stringify(after));
P('Trigger label stays "Choose range…" after applying (one-shot action, not a persisted selection)', after.triggerLabel === 'Choose range…', after.triggerLabel);

// Outside click closes an open menu.
await p.evaluate(() => document.getElementById('ks-preset-trigger-0').click());
await p.evaluate(() => document.body.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true})));
const closedByOutsideClick = await p.evaluate(() => document.getElementById('ks-preset-menu-0').hidden);
P('Outside click closes the menu', closedByOutsideClick === true, closedByOutsideClick);

// Regression: saving/deleting a custom Library preset (persistCustomPresets -> refreshLibraryPresetOptions)
// must not corrupt the RANGE PRESET listbox, which shares the .quick-setup-menu class.
await p.evaluate(() => { cfg.banks[0].roller_mode = 'keyswitch'; render(); });
const afterPersist = await p.evaluate(() => {
  persistCustomPresets();
  const menu = document.getElementById('ks-preset-menu-0');
  const options = [...menu.querySelectorAll('.quick-setup-option[role="option"]')];
  return { count: options.length, idxs: options.map(o => o.dataset.idx) };
});
P('persistCustomPresets() does not overwrite the RANGE PRESET listbox', afterPersist.count === 2 && afterPersist.idxs[0] === '0' && afterPersist.idxs[1] === '1', JSON.stringify(afterPersist));

await p.close();
await b.close();
