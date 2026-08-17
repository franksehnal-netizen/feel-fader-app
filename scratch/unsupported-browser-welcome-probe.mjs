// Regression: welcome screen for a genuinely unsupported browser (no Web
// Serial / Web MIDI — e.g. Messenger's in-app iOS browser), first-run
// onboarding active. No existing probe ever exercised this combination: the
// suite always runs in real Chrome, which supports both APIs, so
// #welcome-browser-notice never showed in any prior test.
//
// Frank, real-device screenshot 2026-08-17 (iPhone, Messenger in-app
// browser): the notice visually overlapped "Connect & load", and a parallel
// CSS block (feel-fader.html ~1401-1420) turned out to pin the onboarding
// controller/button position to hardcoded per-width-breakpoint pixel
// constants via !important — never reacting to viewport HEIGHT at all, so
// the beats carousel and button sat at the identical screen position
// regardless of device height, colliding with the notice on taller phones
// and rendering fully below the fold on short ones.
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
    const overlaps = (a, c) => !(a.bottom <= c.top || a.top >= c.bottom || a.right <= c.left || a.left >= c.right);
    return {
      noticeShown: notice.classList.contains('show'),
      btnNoticeOverlap: overlaps(btn, noticeR),
      beatsOnScreen: beats.top >= 0 && beats.bottom <= window.innerHeight,
      btnOnScreen: btn.top >= 0 && btn.bottom <= window.innerHeight,
    };
  });
  await page.close();
  return { ...m, errs };
}

// Primary reported case — must stay fully clean.
const promax = await measure({ w: 430, h: 932 });
P('unsupported-browser notice shows on first run', promax.noticeShown, 'iPhone Pro Max 430x932');
P('onboarding button never overlaps the browser-unsupported notice (iPhone Pro Max)', !promax.btnNoticeOverlap);
P('onboarding beats carousel stays fully on-screen (iPhone Pro Max)', promax.beatsOnScreen);
P('onboarding button stays fully on-screen (iPhone Pro Max)', promax.btnOnScreen);
P('no page errors (iPhone Pro Max)', promax.errs.length === 0, promax.errs.join(' | '));

// Short viewport — the beats-carousel-entirely-offscreen half of the original bug.
const short = await measure({ w: 393, h: 659 });
P('onboarding beats carousel stays fully on-screen (short 393x659)', short.beatsOnScreen);
P('onboarding button stays fully on-screen (short 393x659)', short.btnOnScreen);
P('no page errors (short 393x659)', short.errs.length === 0, short.errs.join(' | '));

// Mid-height viewport (~852px, e.g. standard non-Pro iPhones) — genuinely too little
// vertical room exists to clear the notice AND stay on-screen simultaneously (notice +
// button + gap + beats needs more space than the viewport has); the viewport-bottom
// bound wins by design (off-screen content is strictly worse than a close-but-visible
// overlap), so only the on-screen invariant is asserted here, not full notice-clearance.
const mid = await measure({ w: 393, h: 852 });
P('onboarding beats carousel stays fully on-screen (mid 393x852)', mid.beatsOnScreen);
P('onboarding button stays fully on-screen (mid 393x852)', mid.btnOnScreen);
P('no page errors (mid 393x852)', mid.errs.length === 0, mid.errs.join(' | '));

await b.close();
