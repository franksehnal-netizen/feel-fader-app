// Regression: clicking a bank tab with the mouse must not leave it holding
// focus — Frank's real-HW HW test (2026-08-10) found the same class of bug
// as section-toggle-focus-ring-probe.mjs, this time on the Bank tab itself:
// click Bank 3, then scroll the mouse wheel, and the blue focus ring appears
// around the whole tab even though nothing re-renders it. selectBank(i,
// event) now blurs the tab after a real click (event.detail!==0), same
// keyboard-vs-mouse test as toggleSection's fix; keyboard activation
// (detail===0, e.g. Enter/Space on a Tab-focused tab) must still keep focus.
// Spec: docs/TODO.md #8 (2026-08-10 addendum).
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await p.evaluate(() => { skipWelcome(); addBank(); addBank(); });

// Real mouse click (Puppeteer dispatches a genuine click, detail=1) ->
// must blur.
const secondTab = (await p.$$('.bank-block-tab'))[1];
await secondTab.click();
const afterMouseClick = await p.evaluate(() => ({
  activeBank,
  isTabFocused: document.activeElement?.classList.contains('bank-block-tab'),
}));
P('mouse click on a bank tab switches the bank', afterMouseClick.activeBank === 1, `activeBank=${afterMouseClick.activeBank}`);
P('mouse click on a bank tab does not leave it focused', !afterMouseClick.isTabFocused, String(afterMouseClick.isTabFocused));

// Keyboard-style activation (detail=0, matching a real Enter/Space click on
// a focused button) must keep focus — this is the accessible path.
const afterKeyClick = await p.evaluate(() => {
  const tab = document.querySelectorAll('.bank-block-tab')[2];
  tab.focus();
  tab.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
  return { activeBank, isTabFocused: document.activeElement === tab };
});
P('keyboard activation (detail=0) switches the bank', afterKeyClick.activeBank === 2, `activeBank=${afterKeyClick.activeBank}`);
P('keyboard activation (detail=0) keeps the tab focused', afterKeyClick.isTabFocused, String(afterKeyClick.isTabFocused));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
