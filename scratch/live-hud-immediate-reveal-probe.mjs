// Regression: the live HUD must appear the moment the welcome screen closes —
// not only after the first scroll — and land in the top-left corner (12px under
// the header) even when the controller view is hidden and the Send button is
// docked into #send-sticky-row. Two bugs fixed together 2026-07-27:
//   1. updateContextualLiveStrip() was never re-run after welcome closed, so the
//      HUD stayed opacity:0 until a scroll event fired it (Frank: "zobrazí se až
//      po posunutí dolů").
//   2. Its default top keyed off .top-sticky (which includes the docked send
//      row), pushing the HUD ~80px down over the card. Now it keys off <header>.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/Fanda Borec/Documents/feel-fader-app/node_modules/puppeteer-core');

const URL = 'http://localhost:8100/feel-fader.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const P = (l, ok, x='') => console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

async function scenario(width, height, controllerHidden, label) {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width, height });
  await p.evaluateOnNewDocument((hidden) => {
    localStorage.setItem('ff-controller-hidden', hidden ? '1' : '0');
  }, controllerHidden);
  await p.goto(URL, { waitUntil: 'networkidle0' });
  // Close welcome the real way; crucially do NOT scroll afterwards.
  await p.evaluate(() => { try { skipWelcome && skipWelcome(); } catch (e) {} });
  await new Promise(r => setTimeout(r, 900)); // dock + reveal transitions settle

  const m = await p.evaluate(() => {
    const strip = document.getElementById('live-strip');
    const header = document.querySelector('header');
    const sBtn = document.getElementById('send-btn');
    const sr = strip.getBoundingClientRect();
    const br = sBtn ? sBtn.getBoundingClientRect() : null;
    return {
      scrollY: Math.round(window.scrollY),
      visible: strip.classList.contains('is-contextual-visible'),
      opacity: getComputedStyle(strip).opacity,
      gapVsHeader: Math.round(sr.top - header.getBoundingClientRect().bottom),
      clearOfSendBtn: br ? (sr.right < br.left - 2 || sr.left > br.right + 2) : true,
    };
  });

  console.log(`\n--- ${label} (${width}px, controllerHidden=${controllerHidden}) ---`);
  P('page was never scrolled', m.scrollY === 0, `scrollY=${m.scrollY}`);
  P('HUD is revealed immediately (is-contextual-visible + opacity 1)', m.visible && m.opacity === '1', `opacity=${m.opacity}`);
  P('HUD sits in the top-left corner, 12px under the header', m.gapVsHeader === 12, `gap=${m.gapVsHeader}px`);
  P('HUD stays clear of the (possibly docked) Send button', m.clearOfSendBtn === true);

  await p.close();
  await b.close();
}

await scenario(636, 600, true,  'controller hidden at load (send row docked)');
await scenario(636, 600, false, 'controller visible at load');
await scenario(1200, 800, false, 'desktop, controller visible');
