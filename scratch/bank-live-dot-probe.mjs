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

// Renamed from bank-glyph-neutral-probe.mjs: the old neutral controller-icon
// glyph (.bank-tab-device) was replaced by a small pulsing green dot
// (.bank-tab-live-dot, Frank 2026-08-18: "chtěl bych tam přidat něco víc") —
// this probe used to assert the glyph was deliberately NOT green; that
// constraint is now intentionally reversed, so this probe was rewritten (not
// just patched) to check the new marker instead of the old one.
const result = await p.evaluate(() => {
  _ffConnected = true; liveBank = 0; renderBankTabs();
  const dot = document.querySelector('.bank-tab-live-dot');
  if (!dot) return { found: false };
  const cs = getComputedStyle(dot);
  return {
    found: true,
    background: cs.backgroundColor,
    position: cs.position,
    animationName: cs.animationName,
    oldGlyphGone: !document.querySelector('.bank-tab-device'),
  };
});
P('Live dot renders when a bank is live-on-device', result.found, JSON.stringify(result));
P('Dot is solid --green (52,199,89), not the old neutral --t2 glyph', result.found && result.background.includes('52, 199, 89'), result.background);
P('Dot is absolutely positioned (floats in the tab corner, independent of .active)', result.found && result.position === 'absolute', result.position);
P('Dot has a pulse animation applied', result.found && result.animationName !== 'none', result.animationName);
P('Old .bank-tab-device glyph is gone (fully replaced, not just hidden)', result.oldGlyphGone);

// The two states (is-live vs active/selected-for-editing) must be able to
// land on DIFFERENT tabs without the dot disappearing or the .active tab
// gaining one — this was the whole point of the redesign (Frank: "tab může
// být aktivní v controlleru, ale nemusí být vybraný pro editaci").
const twoStates = await p.evaluate(() => {
  addBank(); addBank();
  liveBank = 0; activeBank = 2; renderBankTabs();
  const tabs = [...document.querySelectorAll('.bank-block-tab')];
  return {
    liveTabHasDot: !!tabs[0]?.querySelector('.bank-tab-live-dot'),
    liveTabIsNotActive: !tabs[0]?.classList.contains('active'),
    activeTabHasNoDot: !tabs[2]?.querySelector('.bank-tab-live-dot'),
    activeTabIsActive: !!tabs[2]?.classList.contains('active'),
  };
});
P('Live bank (not selected) still shows the dot', twoStates.liveTabHasDot, JSON.stringify(twoStates));
P('Live bank is correctly NOT flagged .active', twoStates.liveTabIsNotActive);
P('Selected/active bank (not live) shows no dot', twoStates.activeTabHasNoDot);
P('Selected bank is correctly flagged .active', twoStates.activeTabIsActive);

await p.close();
await b.close();
