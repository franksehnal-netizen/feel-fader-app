// Regression: the live HUD must appear the moment the welcome screen closes —
// not only after the first scroll — and land 12px under the header. Two bugs
// fixed together 2026-07-27 (the hidden-controller mode is gone since 2026-09-29):
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
const P = (l, ok, x='') => console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  – '+x:''}`);

async function scenario(width, height, label, docked = false) {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width, height });
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
      topVsDevice: Math.round(sr.top - document.getElementById('device-home').getBoundingClientRect().top),
      docked: document.body.classList.contains('hud-docked'),
      clearOfSendBtn: br ? (sr.right < br.left - 2 || sr.left > br.right + 2) : true,
    };
  });

  console.log(`\n--- ${label} (${width}px) ---`);
  P('page was never scrolled', m.scrollY === 0, `scrollY=${m.scrollY}`);
  P('HUD is revealed immediately (is-contextual-visible + opacity 1)', m.visible && m.opacity === '1', `opacity=${m.opacity}`);
  if (docked) P('from 900 px the HUD docks level with the controller top', m.docked && m.topVsDevice === 0, JSON.stringify(m));
  else P('HUD sits in the top-left corner, 12px under the header', m.gapVsHeader === 12, `gap=${m.gapVsHeader}px`);
  P('HUD stays clear of the Send button', m.clearOfSendBtn === true);

  await p.close();
  await b.close();
}

await scenario(636, 600, 'narrow');
await scenario(1200, 800, 'desktop', true);
