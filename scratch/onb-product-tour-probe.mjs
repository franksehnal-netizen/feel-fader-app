// Regression: first-run onboarding is a vertically stacked, manually paced
// product tour around the stationary controller. The wordmark sits above it,
// cardless copy below it, and only a green glow marks the active control.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, 'mobile-ux-output');
fs.mkdirSync(outputDir, { recursive: true });

const browser = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const errors = [];
const P = (label, ok, detail='') => console.log(`${ok?'PASS':'FAIL'}  ${label}${detail?'  — '+detail:''}`);

async function openTour(width, height) {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  await page.setViewport({ width, height });
  await page.evaluateOnNewDocument(() => localStorage.removeItem('ff-onboarded'));
  await page.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
  await page.evaluate(() => { localStorage.removeItem('ff-onboarded'); showWelcome(); onbStartWelcome(); });
  await new Promise(resolve => setTimeout(resolve, 650));
  return page;
}

const desktop = await openTour(1280, 900);
const desktopState = await desktop.evaluate(() => {
  const device = document.getElementById('device-img').getBoundingClientRect();
  const copy = document.getElementById('onb-beats').getBoundingClientRect();
  const wordmark = document.getElementById('welcome-wordmark').getBoundingClientRect();
  const overlay = getComputedStyle(document.getElementById('welcome-screen'), '::before');
  const next = document.getElementById('onb-next');
  const cta = document.getElementById('send-btn').getBoundingClientRect();
  const skip = document.querySelector('.welcome-skip');
  const skipRect = skip.getBoundingClientRect();
  const nextRect = next.getBoundingClientRect();
  const nextHit = document.elementFromPoint(nextRect.left + nextRect.width / 2, nextRect.top + nextRect.height / 2);
  return {
    deviceTop: device.top, deviceBottom: device.bottom, deviceLeft: device.left, deviceRight: device.right,
    deviceCenterX: device.left + device.width / 2,
    viewportCenterX: innerWidth / 2,
    copyTop: copy.top, copyCenterX: copy.left + copy.width / 2,
    ctaTop:cta.top, ctaBottom:cta.bottom,
    wordmarkBottom: wordmark.bottom,
    backdrop: overlay.backdropFilter || overlay.webkitBackdropFilter,
    deviceOpacity: getComputedStyle(document.getElementById('device-img')).opacity,
    tracksOpacity: getComputedStyle(document.getElementById('fader-tracks')).opacity,
    faderGlow: getComputedStyle(document.getElementById('thumb-l')).filter,
    headerVisibility: getComputedStyle(document.querySelector('.top-sticky')).visibility,
    panelsVisibility: getComputedStyle(document.getElementById('panels-row')).visibility,
    skipText: skip.textContent.trim(), skipVisibility: getComputedStyle(skip).display,
    skipBottomGap: innerHeight - skipRect.bottom,
    leftFaderAnimation: getComputedStyle(document.getElementById('thumb-l')).animationName,
    rightFaderAnimation: getComputedStyle(document.getElementById('thumb-r')).animationName,
    nextText: next.textContent.trim(), nextVisibility: getComputedStyle(next).visibility,
    nextHit: `${nextHit?.id || ''}.${nextHit?.className || ''}`,
    prevDisabled: document.getElementById('onb-prev').disabled,
    navCenterDelta: Math.abs(
      document.getElementById('onb-prev').getBoundingClientRect().top + document.getElementById('onb-prev').getBoundingClientRect().height / 2
      - (document.querySelector('.onb-dots').getBoundingClientRect().top + document.querySelector('.onb-dots').getBoundingClientRect().height / 2)
    ),
    timerIdle: _onbBeatTimer === null,
  };
});
P('desktop stacks wordmark, controller, Connect & load, then cardless copy', Math.abs(desktopState.deviceCenterX - desktopState.viewportCenterX) <= 5 && desktopState.wordmarkBottom <= desktopState.deviceTop - 8 && desktopState.ctaTop >= desktopState.deviceBottom + 16 && desktopState.copyTop >= desktopState.ctaBottom + 18 && Math.abs(desktopState.copyCenterX - desktopState.viewportCenterX) <= 5, JSON.stringify(desktopState));
P('tour removes global blur so the hardware stays legible', desktopState.backdrop === 'none', JSON.stringify(desktopState));
P('all controller elements remain fully visible', desktopState.deviceOpacity === '1' && desktopState.tracksOpacity === '1', JSON.stringify(desktopState));
P('active faders use a pronounced green glow', desktopState.faderGlow !== 'none' && desktopState.faderGlow.includes('52, 199, 89'), JSON.stringify(desktopState));
P('underlying app chrome and panels are hidden during onboarding', desktopState.headerVisibility === 'hidden' && desktopState.panelsVisibility === 'hidden', JSON.stringify(desktopState));
P('both onboarding faders stay still', desktopState.leftFaderAnimation === 'none' && desktopState.rightFaderAnimation === 'none', JSON.stringify(desktopState));
P('Back arrow is optically aligned with the slide dots', desktopState.navCenterDelta <= 3, JSON.stringify(desktopState));
P('Continue without device is visible at the bottom edge', desktopState.skipText === 'Continue without device' && desktopState.skipVisibility !== 'none' && desktopState.skipBottomGap >= 1 && desktopState.skipBottomGap <= 4, JSON.stringify(desktopState));
P('first slide exposes an explicit Next action and a disabled Back action', desktopState.nextText.includes('Next') && desktopState.nextVisibility !== 'hidden' && desktopState.prevDisabled, JSON.stringify(desktopState));
P('tour has no auto-advance timer', desktopState.timerIdle, String(desktopState.timerIdle));
await desktop.screenshot({ path:path.join(outputDir, 'onboarding-desktop-first.png') });

await desktop.click('#onb-next');
await new Promise(resolve => setTimeout(resolve, 260));
const rollerState = await desktop.evaluate(() => ({
  beat: _onbBeat,
  feature: document.getElementById('device-wrap').dataset.onbFeature,
  rollerDisplay: getComputedStyle(document.getElementById('zone-roller')).display,
  deviceTop: document.getElementById('device-img').getBoundingClientRect().top,
  deviceLeft: document.getElementById('device-img').getBoundingClientRect().left,
  nextVisibility: getComputedStyle(document.getElementById('onb-next')).visibility,
  prevDisabled: document.getElementById('onb-prev').disabled,
  rollerWidth: document.getElementById('zone-roller').getBoundingClientRect().width,
  rollerHeight: document.getElementById('zone-roller').getBoundingClientRect().height,
  rollerRadius: getComputedStyle(document.getElementById('zone-roller')).borderRadius,
  rollerOutline: getComputedStyle(document.getElementById('zone-roller')).outlineStyle,
}));
P('Next highlights the roller without moving the controller', rollerState.beat === 1 && rollerState.feature === 'roller' && rollerState.rollerDisplay !== 'none' && Math.abs(rollerState.deviceTop - desktopState.deviceTop) <= .5 && Math.abs(rollerState.deviceLeft - desktopState.deviceLeft) <= .5, JSON.stringify(rollerState));
P('roller glow follows its compact rounded silhouette without an outline', rollerState.rollerWidth >= rollerState.rollerHeight * .85 && rollerState.rollerWidth <= rollerState.rollerHeight * 1.2 && rollerState.rollerRadius === '8px' && rollerState.rollerOutline === 'none', JSON.stringify(rollerState));
P('Back becomes available while Next remains visible on middle slides', !rollerState.prevDisabled && rollerState.nextVisibility !== 'hidden', JSON.stringify(rollerState));
await desktop.screenshot({ path:path.join(outputDir, 'onboarding-desktop-roller.png') });

await desktop.focus('#onb-next');
await desktop.keyboard.press('ArrowRight');
await new Promise(resolve => setTimeout(resolve, 260));
const keyboardBeat = await desktop.evaluate(() => _onbBeat);
P('keyboard arrows navigate the tour', keyboardBeat === 2, String(keyboardBeat));
const buttonGlow = await desktop.evaluate(() => {
  const zone = document.getElementById('zone-macro');
  const rect = zone.getBoundingClientRect();
  const style = getComputedStyle(zone);
  return { width:rect.width, height:rect.height, radius:style.borderRadius, background:style.backgroundColor, clipPath:style.clipPath, outline:style.outlineStyle };
});
P('button highlight is one solid circular light point', Math.abs(buttonGlow.width - buttonGlow.height) <= 1 && buttonGlow.width <= 12 && buttonGlow.radius === '50%' && buttonGlow.background.includes('0.96') && buttonGlow.clipPath === 'none' && buttonGlow.outline === 'none', JSON.stringify(buttonGlow));
await desktop.screenshot({ path:path.join(outputDir, 'onboarding-desktop-button.png') });

const skipWhenConnected = await desktop.evaluate(() => {
  _serialPort = {};
  updateWelcomeSkip();
  const display = getComputedStyle(document.querySelector('.welcome-skip')).display;
  _serialPort = null;
  updateWelcomeSkip();
  return display;
});
P('Continue without device remains available during onboarding even when hardware is detected', skipWhenConnected !== 'none', skipWhenConnected);

await desktop.evaluate(() => onbBeatGo(3, true));
// Next now fades out over .46s (matching the send button's own green
// "configure" glow transition, Frank 2026-08-17) instead of snapping to
// visibility:hidden instantly -- wait for that fade to finish before reading
// the final visibility state.
await new Promise(resolve => setTimeout(resolve, 520));
const finalState = await desktop.evaluate(() => ({
  beat: _onbBeat,
  nextVisibility: getComputedStyle(document.getElementById('onb-next')).visibility,
  connectVisible: getComputedStyle(document.getElementById('send-btn')).opacity,
}));
P('final slide hides Next and leaves Connect & load available', finalState.beat === 3 && finalState.nextVisibility === 'hidden' && +finalState.connectVisible > .9, JSON.stringify(finalState));
await desktop.screenshot({ path:path.join(outputDir, 'onboarding-desktop-final.png') });

const shortDesktop = await openTour(1120, 720);
const shortBefore = await shortDesktop.evaluate(() => {
  const ws = document.getElementById('welcome-screen');
  const cta = document.getElementById('send-btn');
  const skip = document.querySelector('.welcome-skip');
  return {
    scrollable:ws.scrollHeight > ws.clientHeight,
    overflowY:getComputedStyle(ws).overflowY,
    wordmarkTop:document.getElementById('welcome-wordmark').getBoundingClientRect().top,
    deviceTop:document.getElementById('device-img').getBoundingClientRect().top,
    deviceBottom:document.getElementById('device-img').getBoundingClientRect().bottom,
    beatsTop:document.getElementById('onb-beats').getBoundingClientRect().top,
    skipTop:skip.getBoundingClientRect().top,
    ctaTop:cta.getBoundingClientRect().top,
    ctaBottom:cta.getBoundingClientRect().bottom,
    ctaOpacity:getComputedStyle(cta).opacity,
    ctaPointerEvents:getComputedStyle(cta).pointerEvents,
    windowScrollY:scrollY,
    fadeBackground:getComputedStyle(document.body, '::after').backgroundImage,
    fadeOpacity:getComputedStyle(document.body, '::after').opacity,
    fadeZ:+getComputedStyle(document.body, '::after').zIndex,
    skipZ:+getComputedStyle(skip).zIndex,
  };
});
await shortDesktop.evaluate(() => {
  const ws = document.getElementById('welcome-screen');
  ws.scrollTop = ws.scrollHeight;
});
await new Promise(resolve => setTimeout(resolve, 100));
const shortAfter = await shortDesktop.evaluate(() => ({
  scrollTop:document.getElementById('welcome-screen').scrollTop,
  wordmarkTop:document.getElementById('welcome-wordmark').getBoundingClientRect().top,
  deviceTop:document.getElementById('device-img').getBoundingClientRect().top,
  beatsTop:document.getElementById('onb-beats').getBoundingClientRect().top,
  skipTop:document.querySelector('.welcome-skip').getBoundingClientRect().top,
  ctaTop:document.getElementById('send-btn').getBoundingClientRect().top,
  ctaBottom:document.getElementById('send-btn').getBoundingClientRect().bottom,
  windowScrollY:scrollY,
}));
const wordmarkShift = shortBefore.wordmarkTop - shortAfter.wordmarkTop;
const deviceShift = shortBefore.deviceTop - shortAfter.deviceTop;
const beatsShift = shortBefore.beatsTop - shortAfter.beatsTop;
const ctaShift = shortBefore.ctaTop - shortAfter.ctaTop;
P('short windows scroll the complete controller, CTA and copy stack beneath a fixed fade and fallback link',
  shortBefore.overflowY === 'auto' && shortBefore.scrollable && shortBefore.ctaTop >= shortBefore.deviceBottom + 16 && shortBefore.beatsTop >= shortBefore.ctaBottom + 18
    && +shortBefore.ctaOpacity > .9 && shortBefore.ctaPointerEvents !== 'none' && shortBefore.fadeBackground.includes('linear-gradient')
    && +shortBefore.fadeOpacity > .9 && shortBefore.skipZ > shortBefore.fadeZ
    && shortAfter.scrollTop > 0 && Math.abs(wordmarkShift - shortAfter.scrollTop) <= 1 && Math.abs(deviceShift - shortAfter.scrollTop) <= 1 && Math.abs(beatsShift - shortAfter.scrollTop) <= 1
    && Math.abs(ctaShift - shortAfter.scrollTop) <= 1 && Math.abs(shortBefore.skipTop - shortAfter.skipTop) <= 1,
  JSON.stringify({shortBefore,shortAfter,wordmarkShift,deviceShift,beatsShift,ctaShift}));
await shortDesktop.screenshot({ path:path.join(outputDir, 'onboarding-short-scroll.png') });

const mobile = await openTour(393, 659);
const mobileState = await mobile.evaluate(() => {
  const device = document.getElementById('device-img').getBoundingClientRect();
  const wordmark = document.getElementById('welcome-wordmark').getBoundingClientRect();
  const beats = document.getElementById('onb-beats').getBoundingClientRect();
  const cta = document.getElementById('send-btn').getBoundingClientRect();
  return {
    deviceTop:device.top, deviceBottom:device.bottom,
    wordmarkTop:wordmark.top, wordmarkBottom:wordmark.bottom,
    beatsTop:beats.top, beatsBottom:beats.bottom,
    ctaTop:cta.top, ctaBottom:cta.bottom,
    viewportWidth:innerWidth,
    overflow:document.documentElement.scrollWidth - innerWidth,
  };
});
P('narrow windows keep the wordmark above the controller and copy below it',
  mobileState.wordmarkBottom < mobileState.deviceTop && mobileState.beatsTop >= mobileState.ctaBottom + 18,
  JSON.stringify(mobileState));
P('mobile product tour has no horizontal overflow', mobileState.overflow <= 0, JSON.stringify(mobileState));
await mobile.screenshot({ path:path.join(outputDir, 'onboarding-mobile-first.png') });

P('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
