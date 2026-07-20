// Regression probe: "Continue without device" must never silently destroy a
// returning user's saved config (S10, functional-audit finding 2026-07-20).
// skipWelcome() used to unconditionally call loadDefaultDemoConfig(), which
// overwrote both in-memory cfg and its localStorage backup with DEFAULT_CFG
// on every click — confirmed end-to-end: save a bank name, reload, click
// "Continue without device", name gone from memory AND localStorage within
// ~700ms, no undo. Fixed by only resetting to demo defaults when there is no
// saved config at all (_savedCfg null at module load). A genuinely fresh
// browser must still get the predictable demo defaults (Scenario B) — this
// was a deliberate, tested behavior (see the updated check in
// mobile-ux-probe.mjs, "Continue without device preserves an existing saved
// configuration", formerly asserting the opposite) for the public demo's
// "always the same clean first impression" use case; Frank confirmed 2026-07-20
// that saved-work preservation wins when the two conflict.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

// --- Scenario A: returning user with saved config must NOT lose it ---
{
  const p = await b.newPage();
  p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
  await p.evaluate(() => {
    localStorage.clear();
    localStorage.removeItem('ff-onboarded');
  });
  await p.reload({ waitUntil: 'networkidle0' });
  await p.evaluate(() => { skipWelcome(); });
  await new Promise(r => setTimeout(r, 200));
  await p.evaluate(() => {
    cfg.banks[0].name = 'IRREPLACEABLE SETUP';
    dirty = true; render();
  });
  await new Promise(r => setTimeout(r, 600)); // let autosave (400ms debounce) commit
  const savedName = await p.evaluate(() => JSON.parse(localStorage.getItem('ff-cfg')).banks[0].name);
  console.log('saved to localStorage before reload:', savedName);

  await p.reload({ waitUntil: 'load', timeout: 10000 });
  const nameAfterReload = await p.evaluate(() => cfg.banks[0].name);
  console.log('cfg.banks[0].name after reload (before clicking skip):', nameAfterReload);

  await p.evaluate(() => { skipWelcome(); });
  await new Promise(r => setTimeout(r, 700));
  const state = await p.evaluate(() => ({
    nameInMemory: cfg.banks[0].name,
    nameInStorage: JSON.parse(localStorage.getItem('ff-cfg')).banks[0].name,
  }));
  console.log('AFTER clicking "Continue without device":', JSON.stringify(state));
  P('saved bank name survives "Continue without device" (in-memory)', state.nameInMemory === 'IRREPLACEABLE SETUP', state.nameInMemory);
  P('saved bank name survives "Continue without device" (localStorage)', state.nameInStorage === 'IRREPLACEABLE SETUP', state.nameInStorage);
  await p.close();
}

// --- Scenario B: genuinely fresh browser still gets predictable demo defaults ---
{
  const p = await b.newPage();
  p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
  await p.evaluate(() => { localStorage.clear(); });
  await p.reload({ waitUntil: 'load', timeout: 10000 });
  await p.evaluate(() => { skipWelcome(); });
  await new Promise(r => setTimeout(r, 300));
  const state = await p.evaluate(() => ({ name: cfg.banks[0].name, loaded, dirty }));
  console.log('fresh browser after skip:', JSON.stringify(state));
  P('fresh browser (no saved config) still gets predictable DEFAULT_CFG', state.name === 'Bank 1' && state.dirty === false, JSON.stringify(state));
  await p.close();
}

await b.close();
