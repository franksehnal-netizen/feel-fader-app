// Regression: welcome screen for a genuinely unsupported browser (no Web
// Serial / Web MIDI — e.g. Messenger's in-app iOS browser), first-run
// onboarding active. No existing probe ever exercised this combination: the
// suite always runs in real Chrome, which supports both APIs, so
// #welcome-browser-notice never showed in any prior test.
//
// Frank, real-device screenshots 2026-08-17 (iPhone, Messenger in-app
// browser), two rounds:
// 1. The notice visually overlapped "Connect & load" — a parallel CSS block
//    pinned the onboarding controller/button position to hardcoded
//    per-width-breakpoint pixel constants via !important, never reacting to
//    viewport HEIGHT at all.
// 2. After fixing #1: the button stopped tracking scroll (a static inline
//    !important `top` broke the CSS formula's own scroll-offset term), and
//    on viewports where content is genuinely too tall to fit, forcing it
//    into the first paint pushed it into the controller graphic itself
//    ("Connect & load" overlapping the physical button control, the notice
//    overlapping the onboarding title). Fix: only clamp to the viewport
//    bottom when there's no scroll escape hatch; otherwise let it overflow
//    and rely on #welcome-screen's scrollable fallback (extended to engage
//    dynamically — via measurement, not just the static max-height:820px
//    breakpoint — for any device where the clamped content still doesn't fit).
//
// So the on-screen bar differs by whether a given viewport needs the
// scrollable fallback: content that fits natively must stay fully on-screen;
// content that doesn't must still never overlap the notice or the controller
// graphic, and must be reachable by scrolling.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, pipe: true, args: ['--no-sandbox'] });
const P = (l, ok, x = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${l}${x ? '  — ' + x : ''}`);

async function settle(page, ms = 0) {
  if (ms) await new Promise(r => setTimeout(r, ms));
  await page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res))));
}

async function measure(viewport) {
  const page = await b.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1');
  await page.setViewport({ width: viewport.w, height: viewport.h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => {
    localStorage.removeItem('ff-onboarded');
    // Real feature absence, not just an internal state flag — checkBrowserSupport()
    // reads `navigator.requestMIDIAccess`/`'serial' in navigator` directly.
    Object.defineProperty(navigator, 'requestMIDIAccess', { value: undefined, configurable: true });
  });
  await page.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
  await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });
  await settle(page, 1600); // past onboarding's CTA reveal timers (~1100ms, see onbStartWelcome comments)

  const m = await page.evaluate(() => {
    const rect = id => document.getElementById(id)?.getBoundingClientRect();
    const btn = rect('send-btn');
    const notice = document.getElementById('welcome-browser-notice');
    const noticeR = notice.getBoundingClientRect();
    const beats = rect('onb-beats');
    const controller = rect('device-img');
    const title = document.querySelector('.onb-beat-title')?.getBoundingClientRect();
    const ws = document.getElementById('welcome-screen');
    const overlaps = (a, c) => a && c && !(a.bottom <= c.top || a.top >= c.bottom || a.right <= c.left || a.left >= c.right);
    return {
      noticeShown: notice.classList.contains('show'),
      scrollable: getComputedStyle(ws).overflowY === 'auto',
      btnNoticeOverlap: overlaps(btn, noticeR),
      btnControllerOverlap: overlaps(btn, controller),
      noticeTitleOverlap: overlaps(noticeR, title),
      beatsOnScreen: beats.top >= 0 && beats.bottom <= window.innerHeight,
      btnOnScreen: btn.top >= 0 && btn.bottom <= window.innerHeight,
      beatsReachableByScroll: beats.top >= 0 || ws.scrollHeight > ws.clientHeight,
    };
  });
  await page.close();
  return { ...m, errs };
}

function assertNeverOverlaps(r, label) {
  P(`onboarding button never overlaps the browser-unsupported notice (${label})`, !r.btnNoticeOverlap);
  P(`onboarding button never overlaps the controller graphic (${label})`, !r.btnControllerOverlap);
  P(`browser-unsupported notice never overlaps the onboarding title (${label})`, !r.noticeTitleOverlap);
  P(`no page errors (${label})`, r.errs.length === 0, r.errs.join(' | '));
}

// Primary reported case — content fits natively, must stay fully on-screen with no
// scrolling needed.
const promax = await measure({ w: 430, h: 932 });
P('unsupported-browser notice shows on first run', promax.noticeShown, 'iPhone Pro Max 430x932');
assertNeverOverlaps(promax, 'iPhone Pro Max');
P('onboarding beats carousel stays fully on-screen (iPhone Pro Max)', promax.beatsOnScreen);
P('onboarding button stays fully on-screen (iPhone Pro Max)', promax.btnOnScreen);
P("#welcome-screen doesn't need to scroll (iPhone Pro Max)", !promax.scrollable);

// Short viewport (393x659, below the static max-height:820px breakpoint) — content
// doesn't fit, #welcome-screen must fall back to scrollable rather than forcing an
// overlap into the first paint.
const short = await measure({ w: 393, h: 659 });
assertNeverOverlaps(short, 'short 393x659');
P('#welcome-screen falls back to scrollable (short 393x659)', short.scrollable);
P('beats carousel is reachable by scrolling (short 393x659)', short.beatsReachableByScroll);

// Mid-height viewport (~852px, e.g. standard non-Pro iPhones) — just above the static
// 820px breakpoint, so the scrollable fallback must engage dynamically (measured
// overflow, not the fixed media query) for this to stay clean.
const mid = await measure({ w: 393, h: 852 });
assertNeverOverlaps(mid, 'mid 393x852');
P('#welcome-screen falls back to scrollable (mid 393x852)', mid.scrollable);
P('beats carousel is reachable by scrolling (mid 393x852)', mid.beatsReachableByScroll);

await b.close();
