// Automated mobile UI regression probe for the standalone Feel Fader web app.
// Run: npm run test:mobile
import { createRequire } from 'module';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const htmlPath = path.join(root, 'feel-fader.html');
const outputDir = path.join(here, 'mobile-ux-output');
const html = fs.readFileSync(htmlPath);
const remoteUrl = process.env.MOBILE_TEST_URL || '';

const profiles = [
  {
    name: 'iphone-messenger',
    viewport: { width: 393, height: 659, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  },
  {
    name: 'iphone-tall',
    viewport: { width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  },
];

const iphoneUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    `${process.env.LOCALAPPDATA || ''}/Google/Chrome/Application/chrome.exe`,
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ].filter(Boolean);
  const found = candidates.find(candidate => fs.existsSync(candidate));
  if (!found) throw new Error('Chrome/Edge nebyl nalezen. Nastavte promennou CHROME_PATH.');
  return found;
}

function startServer() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    if (url.pathname === '/favicon.ico') {
      response.writeHead(204);
      response.end();
      return;
    }
    if (url.pathname !== '/' && url.pathname !== '/feel-fader.html') {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    response.end(html);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function serverUrl(server) {
  const address = server.address();
  return `http://127.0.0.1:${address.port}/feel-fader.html`;
}

function addCheck(checks, name, pass, details) {
  checks.push({ name, pass: Boolean(pass), details });
}

async function settle(page, milliseconds = 0) {
  if (milliseconds) await new Promise(resolve => setTimeout(resolve, milliseconds));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function runDesktopFlow(browser, url) {
  const page = await browser.newPage();
  const checks = [];
  const errors = [];
  const profile = { name: 'desktop-flow', viewport: { width: 1200, height: 900 } };
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
      errors.push(`console.error: ${message.text()}`);
    }
  });
  await page.setViewport(profile.viewport);
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('ff-onboarded', '1');
    localStorage.setItem('ff-library-setup-cue-seen', '1');
  });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
  await page.evaluate(() => {
    loadDefaultDemoConfig();
    handoffPrimaryActionToApp();
    mountControllerInApp();
    document.getElementById('welcome-screen').classList.add('hidden');
    render();
    window.scrollTo(0, 0);
  });
  await settle(page, 120);
  const initial = await page.evaluate(() => {
    const stage = document.querySelector('.stage');
    const controller = document.getElementById('device-img').getBoundingClientRect();
    const send = document.getElementById('send-btn').getBoundingClientRect();
    const panels = document.getElementById('panels-row').getBoundingClientRect();
    const style = getComputedStyle(stage);
    return {
      stageTop: stage.getBoundingClientRect().top,
      stagePosition: style.position,
      stageAnimation: style.animationName,
      controllerBottom: controller.bottom,
      sendTop: send.top,
      sendBottom: send.bottom,
      panelsTop: panels.top,
    };
  });
  await page.screenshot({ path: path.join(outputDir, 'desktop-flow-initial.png') });
  await page.evaluate(() => {
    _midiState = 'granted';
    _ffConnected = true;
    liveValues = { f1: 32, f2: 96 };
    liveSeen = { f1: true, f2: true };
    encLiveVal = 32;
    renderConnState();
  });
  await settle(page, 80);
  const hudAtController = await page.evaluate(() => {
    const hud = document.getElementById('live-strip');
    const rect = hud.getBoundingClientRect();
    return {
      visible: hud.classList.contains('is-contextual-visible'),
      compact: hud.classList.contains('is-compact'),
      ariaHidden: hud.getAttribute('aria-hidden'),
      width: rect.width,
      height: rect.height,
    };
  });
  const targetScroll = await page.evaluate(() => {
    localStorage.removeItem('ff-library-setup-cue-seen');
    armLibrarySetupCue();
    const quick = document.querySelector('.bank-quick-setup').getBoundingClientRect();
    return Math.max(0, quick.top + window.scrollY - 120);
  });
  await page.evaluate(scrollTop => window.scrollTo(0, scrollTop), targetScroll);
  await settle(page, 460);
  const scrolled = await page.evaluate(() => {
    const stage = document.querySelector('.stage').getBoundingClientRect();
    const controller = document.getElementById('device-img').getBoundingClientRect();
    const send = document.getElementById('send-btn').getBoundingClientRect();
    const quick = document.querySelector('.bank-quick-setup').getBoundingClientRect();
    const hud = document.getElementById('live-strip');
    const hudRect = hud.getBoundingClientRect();
    const overlap = !(send.right <= quick.left || send.left >= quick.right || send.bottom <= quick.top || send.top >= quick.bottom);
    return {
      scrollY: window.scrollY,
      stageTop: stage.top,
      controllerBottom: controller.bottom,
      sendTop: send.top,
      sendBottom: send.bottom,
      quickTop: quick.top,
      quickBottom: quick.bottom,
      overlap,
      hudVisible: hud.classList.contains('is-contextual-visible'),
      hudCompact: hud.classList.contains('is-compact'),
      hudWidth: hudRect.width,
      hudHeight: hudRect.height,
      hudTech: ['live-f1-tech','live-f2-tech','live-roller-tech'].map(id => document.getElementById(id)?.textContent || ''),
      hudTopGap: hudRect.top - document.querySelector('.top-sticky').getBoundingClientRect().bottom,
      hudLeftGap: hudRect.left,
      cueActive: document.querySelector('.bank-quick-setup').classList.contains('is-first-run-highlight'),
      cueSeen: localStorage.getItem('ff-library-setup-cue-seen') === '1',
    };
  });
  await settle(page, 1400);
  const cueEnded = await page.evaluate(() => !document.querySelector('.bank-quick-setup').classList.contains('is-first-run-highlight'));
  addCheck(checks, 'Desktop controller stays in normal page flow',
    initial.stagePosition === 'relative' && initial.stageAnimation === 'none'
      && Math.abs((initial.stageTop - scrolled.stageTop) - scrolled.scrollY) <= 2,
    `${initial.stagePosition} / ${initial.stageAnimation} / moved ${(initial.stageTop - scrolled.stageTop).toFixed(1)} of ${scrolled.scrollY.toFixed(1)} px`);
  addCheck(checks, 'Desktop stage reserves the complete Send to device tail',
    initial.sendBottom <= initial.panelsTop + 1,
    `button ${initial.sendBottom.toFixed(1)} / panels ${initial.panelsTop.toFixed(1)} px`);
  addCheck(checks, 'First Library setup cue is subtle, automatic and one-time',
    scrolled.cueActive && scrolled.cueSeen && cueEnded,
    `active ${scrolled.cueActive} / stored ${scrolled.cueSeen} / ended ${cueEnded}`);
  const gapAbove = initial.sendTop - initial.controllerBottom;
  const gapBelow = initial.panelsTop - initial.sendBottom;
  addCheck(checks, 'Send to device is centered between controller and bank section',
    Math.abs(gapAbove - gapBelow) <= 1,
    `${gapAbove.toFixed(1)} px above / ${gapBelow.toFixed(1)} px below`);
  addCheck(checks, 'Scrolled Send to device never covers Library setup',
    !scrolled.overlap && scrolled.sendBottom <= scrolled.quickTop,
    `button ${scrolled.sendTop.toFixed(1)}–${scrolled.sendBottom.toFixed(1)} / setup ${scrolled.quickTop.toFixed(1)}–${scrolled.quickBottom.toFixed(1)} px`);
  addCheck(checks, 'Desktop controller may scroll fully above the viewport',
    scrolled.controllerBottom < 0,
    `${scrolled.controllerBottom.toFixed(1)} px`);
  addCheck(checks, 'Hardware monitor stays visible with or without the controller in view',
    hudAtController.visible && hudAtController.ariaHidden === 'false' && scrolled.hudVisible,
    `at controller ${hudAtController.visible} / after scroll ${scrolled.hudVisible}`);
  addCheck(checks, 'Desktop monitor morphs from the hardware square into a compact capsule',
    !hudAtController.compact && Math.abs(hudAtController.width - 112) <= 1 && Math.abs(hudAtController.height - 112) <= 1
      && scrolled.hudCompact && Math.abs(scrolled.hudWidth - 202) <= 1 && Math.abs(scrolled.hudHeight - 46) <= 1,
    `${hudAtController.width.toFixed(1)} × ${hudAtController.height.toFixed(1)} → ${scrolled.hudWidth.toFixed(1)} × ${scrolled.hudHeight.toFixed(1)} px`);
  addCheck(checks, 'Hardware monitor centralizes the active bank technical mapping',
    scrolled.hudTech.join(',') === 'Ch1·CC11,Ch1·CC1,Ch1·CC32',
    scrolled.hudTech.join(' / '));
  addCheck(checks, 'Desktop hardware monitor aligns below the left side of the header',
    Math.abs(scrolled.hudTopGap - 12) <= 1 && Math.abs(scrolled.hudLeftGap - 28) <= 1,
    `${scrolled.hudLeftGap.toFixed(1)} px left / ${scrolled.hudTopGap.toFixed(1)} px below header`);
  await page.evaluate(() => { _midiState = 'denied'; _ffConnected = false; renderConnState(); });
  await settle(page, 380);
  const hudOffline = await page.evaluate(() => {
    const hud = document.getElementById('live-strip');
    return { visible: hud.classList.contains('is-contextual-visible'), opacity: getComputedStyle(hud).opacity };
  });
  addCheck(checks, 'Hardware monitor remains visible but subdued without live feedback',
    hudOffline.visible && Math.abs(Number.parseFloat(hudOffline.opacity) - .68) <= .01,
    `${hudOffline.visible} / opacity ${hudOffline.opacity}`);
  addCheck(checks, 'No desktop page or console errors', errors.length === 0, errors.join(' | ') || 'none');
  await page.screenshot({ path: path.join(outputDir, 'desktop-flow.png') });
  await page.close();
  return { profile, checks, errors };
}

async function runProfile(browser, url, profile) {
  const page = await browser.newPage();
  const errors = [];
  const checks = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('response', response => {
    if (response.status() < 400 || new URL(response.url()).pathname.endsWith('/favicon.ico')) return;
    errors.push(`http ${response.status()}: ${response.url()}`);
  });
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
      errors.push(`console.error: ${message.text()}`);
    }
  });
  await page.setUserAgent(iphoneUserAgent);
  await page.setViewport(profile.viewport);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.evaluateOnNewDocument(() => {
    localStorage.removeItem('ff-onboarded');
    window.__coldWordmarkStarts = [];
    document.addEventListener('animationstart', event => {
      if (event.animationName.startsWith('welcome-wordmark-')) window.__coldWordmarkStarts.push(event.animationName);
    });
  });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
  const coldWordmark = await page.evaluate(() => ({
    starts: [...new Set(window.__coldWordmarkStarts || [])],
    armed: document.getElementById('welcome-wordmark')?.classList.contains('is-arming') || false,
    playing: document.getElementById('welcome-wordmark')?.classList.contains('is-playing') || false,
  }));
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    localStorage.removeItem('ff-onboarded');
    localStorage.removeItem('ff-library-setup-cue-seen');
    _ffConnected = false;
    _serialPort = null;
    _midiState = 'unsupported';
    showWelcome();
    onbStartWelcome();
    window.scrollTo(0, 0);
  });
  await settle(page, 250);

  const welcomeBefore = await page.evaluate(() => {
    const cta = document.getElementById('send-btn').getBoundingClientRect();
    const stage = document.querySelector('.welcome-copy-stage').getBoundingClientRect();
    const device = document.getElementById('device-img').getBoundingClientRect();
    const wordmark = document.getElementById('welcome-wordmark');
    const wordmarkRect = wordmark.getBoundingClientRect();
    return {
      ctaTop: cta.top,
      stageHeight: stage.height,
      stageTop: stage.top,
      stageBottom: stage.bottom,
      deviceTop: device.top,
      wordmarkTop: wordmarkRect.top,
      wordmarkBottom: wordmarkRect.bottom,
      wordmarkLabel: wordmark.getAttribute('aria-label'),
      wordmarkAnimating: wordmark.getAnimations({ subtree: true }).length >= 2,
    };
  });
  await settle(page, 950);
  const welcomeAfter = await page.evaluate(() => ({
    deviceTop: document.getElementById('device-img').getBoundingClientRect().top,
    wordmarkOpacity: Number.parseFloat(getComputedStyle(document.querySelector('.welcome-wordmark-text')).opacity),
    wordmarkFilter: getComputedStyle(document.querySelector('.welcome-wordmark-text')).filter,
  }));
  await page.screenshot({ path: path.join(outputDir, `${profile.name}-welcome.png`) });
  const introNavPositions = [];
  for (let slide = 0; slide < 3; slide += 1) {
    await page.evaluate(index => onbBeatGo(index), slide);
    await settle(page, 250);
    introNavPositions.push(await page.evaluate(() => ({
      dotsTop: document.querySelector('.onb-dots').getBoundingClientRect().top,
      ctaTop: document.getElementById('send-btn').getBoundingClientRect().top,
      subHeight: document.querySelector('.onb-beat-sub').getBoundingClientRect().height,
    })));
    if (slide === 1) {
      await page.screenshot({ path: path.join(outputDir, `${profile.name}-welcome-step2.png`) });
    }
  }
  const dotsShift = Math.max(...introNavPositions.map(item => item.dotsTop))
    - Math.min(...introNavPositions.map(item => item.dotsTop));
  const introCtaShift = Math.max(...introNavPositions.map(item => item.ctaTop))
    - Math.min(...introNavPositions.map(item => item.ctaTop));
  addCheck(checks, 'Intro dots stay fixed across all three slides', dotsShift <= 1, `${dotsShift.toFixed(2)} px`);
  addCheck(checks, 'Primary CTA stays fixed across all three slides', introCtaShift <= 1, `${introCtaShift.toFixed(2)} px`);
  addCheck(checks, 'Redundant Skip intro action is absent',
    await page.$('.onb-skip') === null, 'absent');
  addCheck(checks, 'Welcome copy uses a stable mobile slot', Math.abs(welcomeBefore.stageHeight - 142) <= 1, `${welcomeBefore.stageHeight.toFixed(2)} px`);
  addCheck(checks, 'Welcome controller stays still',
    Math.abs(welcomeAfter.deviceTop - welcomeBefore.deviceTop) <= 0.25,
    `${welcomeBefore.deviceTop.toFixed(2)} → ${welcomeAfter.deviceTop.toFixed(2)} px`);
  addCheck(checks, 'Cold-load Feel Fader animation starts after welcome is mounted',
    coldWordmark.starts.includes('welcome-wordmark-focus')
      && coldWordmark.starts.includes('welcome-wordmark-glass')
      && coldWordmark.starts.includes('welcome-wordmark-scan')
      && !coldWordmark.armed && coldWordmark.playing,
    `${coldWordmark.starts.join(', ') || 'no animation'} / armed ${coldWordmark.armed} / playing ${coldWordmark.playing}`);
  addCheck(checks, 'Feel Fader wordmark animates once inside its reserved slot',
    welcomeBefore.wordmarkAnimating && welcomeBefore.wordmarkLabel === 'Feel Fader'
      && welcomeBefore.wordmarkTop >= welcomeBefore.stageTop - 1
      && welcomeBefore.wordmarkBottom <= welcomeBefore.stageBottom + 1
      && welcomeAfter.wordmarkOpacity >= .99 && welcomeAfter.wordmarkFilter === 'blur(0px)',
    `${welcomeBefore.wordmarkLabel || 'missing'} / ${welcomeBefore.wordmarkAnimating ? 'animated' : 'static'} / ${welcomeAfter.wordmarkFilter}`);

  await page.evaluate(() => {
    document.getElementById('welcome-text-block').classList.remove('welcome-onboarding');
    document.getElementById('onb-beats').style.display = 'none';
    showStartBtn();
  });
  await settle(page, 100);
  const compactWelcome = await page.evaluate(() => {
    const stage = document.querySelector('.welcome-copy-stage').getBoundingClientRect();
    const action = document.getElementById('send-btn').getBoundingClientRect();
    const controller = document.getElementById('device-img').getBoundingClientRect();
    const visibleText = [document.getElementById('welcome-wordmark'), document.getElementById('send-btn'), document.querySelector('#welcome-text-block .welcome-skip')]
      .filter(element => element.getClientRects().length > 0)
      .map(element => element.textContent.trim());
    return {
      stageHeight: stage.height,
      actionGap: action.top - controller.bottom,
      visibleText,
      continueBottomGap: window.innerHeight - document.querySelector('.welcome-skip').getBoundingClientRect().bottom,
      redundantStatusAbsent: !document.getElementById('welcome-status-row'),
      redundantSubtitleAbsent: !document.querySelector('#welcome-screen .welcome-sub'),
    };
  });
  addCheck(checks, 'Normal welcome uses the compact copy slot', Math.abs(compactWelcome.stageHeight - 50) <= 1,
    `${compactWelcome.stageHeight.toFixed(2)} px`);
  addCheck(checks, 'Normal welcome contains only the brand and essential actions',
    compactWelcome.redundantStatusAbsent && compactWelcome.redundantSubtitleAbsent
      && JSON.stringify(compactWelcome.visibleText) === JSON.stringify(['Feel Fader', 'Connect & load', 'Continue without device']),
    compactWelcome.visibleText.join(' / '));
  addCheck(checks, 'Animated wordmark keeps the primary action in place',
    Math.abs(compactWelcome.actionGap - 70) <= 1,
    `${compactWelcome.actionGap.toFixed(2)} px below controller`);
  addCheck(checks, 'Continue without device hugs the browser safe edge',
    compactWelcome.continueBottomGap >= 7 && compactWelcome.continueBottomGap <= 9,
    `${compactWelcome.continueBottomGap.toFixed(2)} px`);

  const feedbackState = await page.evaluate(async () => {
    const originalLoad = window.loadConfigFromDevice;
    const continueButton = document.querySelector('#welcome-text-block .welcome-skip');
    const continueTop = () => continueButton.getBoundingClientRect().top;
    const runFailure = async (name, message) => {
      window.loadConfigFromDevice = async () => {
        const error = new Error(message);
        error.name = name;
        throw error;
      };
      await doStart();
      return {
        continueTop: continueTop(),
        message: document.getElementById('welcome-start-msg').textContent,
        button: document.getElementById('send-btn').textContent,
      };
    };
    const before = continueTop();
    const cancelled = await runFailure('NotFoundError', 'No port selected by the user.');
    showStartBtn();
    const failed = await runFailure('NetworkError', 'Could not read from the device.');
    window.loadConfigFromDevice = originalLoad;
    const continueRect = continueButton.getBoundingClientRect();
    return {
      before,
      cancelled,
      failed,
      continueVisible: getComputedStyle(continueButton).display !== 'none' && continueRect.bottom <= window.innerHeight,
      continueBottom: continueRect.bottom,
      viewportHeight: window.innerHeight,
    };
  });
  addCheck(checks, 'Cancelling the port picker stays silent',
    feedbackState.cancelled.message === '' && feedbackState.cancelled.button === 'Connect & load',
    `${feedbackState.cancelled.button} / ${feedbackState.cancelled.message || 'no message'}`);
  addCheck(checks, 'A real connection failure uses compact feedback',
    feedbackState.failed.message === 'Connection failed' && feedbackState.failed.button === 'Try again',
    `${feedbackState.failed.button} / ${feedbackState.failed.message}`);
  const feedbackShift = Math.max(
    Math.abs(feedbackState.cancelled.continueTop - feedbackState.before),
    Math.abs(feedbackState.failed.continueTop - feedbackState.before),
  );
  addCheck(checks, 'Connection feedback keeps Continue without device fixed', feedbackShift <= 1, `${feedbackShift.toFixed(2)} px`);
  addCheck(checks, 'Continue without device remains visible after an error', feedbackState.continueVisible,
    `${feedbackState.continueBottom.toFixed(1)} / ${feedbackState.viewportHeight} px`);
  await page.screenshot({ path: path.join(outputDir, `${profile.name}-welcome-error.png`) });
  await page.evaluate(() => showStartBtn());

  await page.evaluate(() => {
    _ffConnected = false;
    _serialPort = null;
    _midiState = 'unsupported';
    cfg.banks[0].name = 'Bang go b';
    skipWelcome();
    positionThumbs();
    window.scrollTo(0, 0);
  });
  await settle(page, 250);
  const fadersBefore = await page.evaluate(() => ({
    left: document.getElementById('thumb-l')?.style.transform || '',
    right: document.getElementById('thumb-r')?.style.transform || '',
  }));
  await settle(page, 1650);
  const appState = await page.evaluate(() => {
    const controller = document.getElementById('device-img')?.getBoundingClientRect();
    const badge = document.getElementById('onb-demo-badge');
    const bankTabContainer = document.getElementById('bank-tabs')?.getBoundingClientRect();
    const bankTabs = [...document.querySelectorAll('#bank-tabs .bank-block-tab')].slice(0, 3).map(tab => {
      const rect = tab.getBoundingClientRect();
      const fallback = tab.querySelector('.bank-tab-fallback');
      const fallbackStyle = fallback ? getComputedStyle(fallback) : null;
      return {
        text: tab.textContent.trim(),
        fallback: fallback?.textContent.trim() || '',
        fallbackOpacity: fallbackStyle ? Number.parseFloat(fallbackStyle.opacity) : null,
        fallbackFontSize: fallbackStyle ? Number.parseFloat(fallbackStyle.fontSize) : null,
        active: tab.classList.contains('active'),
        left: rect.left,
        right: rect.right,
      };
    });
    return {
      faders: {
        left: document.getElementById('thumb-l')?.style.transform || '',
        right: document.getElementById('thumb-r')?.style.transform || '',
      },
      demoBadgeVisible: Boolean(badge && getComputedStyle(badge).display !== 'none'),
      bankNames: cfg.banks.map(bank => bank.name),
      viewportWidth: window.innerWidth,
      rootScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      controller: controller ? { left: controller.left, right: controller.right } : null,
      introCardAbsent: !document.getElementById('onb-intro-card'),
      controllerTop: controller?.top ?? null,
      controllerBottom: controller?.bottom ?? null,
      bankTabs,
      bankTabContainer: bankTabContainer ? { left: bankTabContainer.left, right: bankTabContainer.right } : null,
      midiHelpAbsent: !document.getElementById('midi-help-banner'),
      rollerSummaryAbsent: !document.getElementById('section-summary-0-roller'),
      faderSummariesAbsent: !document.getElementById('section-summary-0-fader1') && !document.getElementById('section-summary-0-fader2'),
      contextHelpCount: document.querySelectorAll('.context-help').length,
      headerStatus: document.getElementById('h-status-text')?.textContent || '',
      headerStatusAria: document.getElementById('h-status')?.getAttribute('aria-label') || '',
      headerStatusText: (() => {
        const element = document.getElementById('h-status-text');
        const rect = element?.getBoundingClientRect();
        return element && rect ? { width: rect.width, height: rect.height, position: getComputedStyle(element).position } : null;
      })(),
      scrollY: window.scrollY,
    };
  });
  addCheck(checks, 'No-device faders remain stable for 1.65 s',
    fadersBefore.left === appState.faders.left && fadersBefore.right === appState.faders.right,
    `${fadersBefore.left} / ${fadersBefore.right}`);
  addCheck(checks, 'No-device state is identified as a demo', appState.demoBadgeVisible, String(appState.demoBadgeVisible));
  addCheck(checks, 'Layout has no horizontal overflow',
    Math.max(appState.rootScrollWidth, appState.bodyScrollWidth) <= appState.viewportWidth + 1,
    `${Math.max(appState.rootScrollWidth, appState.bodyScrollWidth)} / ${appState.viewportWidth} px`);
  addCheck(checks, 'Controller remains inside the viewport',
    appState.controller && appState.controller.left >= -1 && appState.controller.right <= appState.viewportWidth + 1,
    appState.controller ? `${appState.controller.left.toFixed(1)}–${appState.controller.right.toFixed(1)} px` : 'missing');
  addCheck(checks, 'App entry has no second onboarding card', appState.introCardAbsent, String(appState.introCardAbsent));
  const threeDefaultBanksVisible = appState.bankTabs.length === 3 && appState.bankTabContainer
    && appState.bankTabs.every(tab => tab.left >= appState.bankTabContainer.left - 1 && tab.right <= appState.bankTabContainer.right + 1);
  const minimalistBankIndices = appState.bankTabs.map(tab => tab.fallback).join(',') === '1,2,3'
    && appState.bankTabs.every(tab => tab.fallbackFontSize <= 10
      && (tab.active || tab.fallbackOpacity <= .7));
  addCheck(checks, 'Mobile header shows minimalist bank indices 1, 2 and 3',
    threeDefaultBanksVisible && minimalistBankIndices,
    appState.bankTabs.map(tab => tab.text).join(' / ') || 'missing');
  // Was "...ignores stale browser configuration" (asserted skip always resets
  // to DEFAULT_CFG). Reversed 2026-07-20 (S10, functional-audit finding):
  // that behavior silently destroyed a returning user's saved config on
  // every "Continue without device" click — confirmed as real, irreversible
  // data loss. skipWelcome() now only resets to demo defaults when there is
  // no saved config at all (_savedCfg null at module load); a genuinely
  // fresh browser still gets the predictable demo defaults. Frank confirmed
  // 2026-07-20 that saved-work preservation wins when the two conflict.
  // See scratch/skip-welcome-preserves-saved-config-probe.mjs for dedicated
  // fresh-vs-returning-user coverage.
  addCheck(checks, 'Continue without device preserves an existing saved configuration',
    appState.bankNames[0] === 'Bang go b',
    appState.bankNames.join(' / '));
  addCheck(checks, 'MIDI status has no duplicate content banner',
    appState.midiHelpAbsent && /^MIDI (unavailable|blocked)$/.test(appState.headerStatus),
    `${appState.headerStatus} / banner ${appState.midiHelpAbsent ? 'absent' : 'present'}`);
  addCheck(checks, 'Roller header does not duplicate the selected mode on the right',
    appState.rollerSummaryAbsent,
    appState.rollerSummaryAbsent ? 'right-side summary absent' : 'duplicate summary present');
  addCheck(checks, 'Fader headers leave channel and CC metadata to the hardware monitor',
    appState.faderSummariesAbsent,
    appState.faderSummariesAbsent ? 'right-side summaries absent' : 'duplicate summaries present');
  addCheck(checks, 'Inline question-mark links do not duplicate the Help & Guide panel',
    appState.contextHelpCount === 0,
    `${appState.contextHelpCount} inline help buttons`);
  addCheck(checks, 'Mobile header renders MIDI status as an accessible dot',
    appState.headerStatusText && appState.headerStatusText.width <= 1.1 && appState.headerStatusText.height <= 1.1
      && appState.headerStatusText.position === 'absolute' && appState.headerStatusAria === appState.headerStatus,
    `${appState.headerStatusText?.width ?? 'missing'}x${appState.headerStatusText?.height ?? 'missing'} / ${appState.headerStatusAria || 'no label'}`);
  addCheck(checks, 'App opens at the top', appState.scrollY <= 1, `${appState.scrollY} px`);

  await page.evaluate(() => toast('s', 'Setup saved'));
  await settle(page, 120);
  const toastState = await page.evaluate(() => {
    const item = document.querySelector('#toasts .toast');
    const close = item?.querySelector('.tx');
    if (!item || !close) return null;
    const rect = item.getBoundingClientRect();
    const closeRect = close.getBoundingClientRect();
    const hit = document.elementFromPoint(closeRect.left + closeRect.width / 2, closeRect.top + closeRect.height / 2);
    const style = getComputedStyle(item);
    return {
      height: rect.height,
      centerGap: Math.abs((rect.left + rect.width / 2) - window.innerWidth / 2),
      radius: Number.parseFloat(style.borderRadius),
      backdrop: style.backdropFilter || style.webkitBackdropFilter,
      closeHit: hit === close || close.contains(hit),
    };
  });
  await page.click('#toasts .toast .tx');
  await settle(page, 340);
  const toastDismissed = await page.evaluate(() => !document.querySelector('#toasts .toast'));
  addCheck(checks, 'Global notifications use a compact centered liquid-glass pill',
    toastState && toastState.height <= 44 && toastState.centerGap <= 1 && toastState.radius >= toastState.height / 2
      && toastState.backdrop !== 'none' && toastState.closeHit && toastDismissed,
    toastState ? `${toastState.height.toFixed(1)} px / center ${toastState.centerGap.toFixed(1)} px / ${toastState.backdrop} / dismissed ${toastDismissed}` : 'missing');

  const transitionStart = await page.evaluate(() => {
    liveValues = { f1:23, f2:108 };
    liveSeen = { f1:true, f2:true };
    positionThumbs();
    showWelcome();
    const controller = document.getElementById('device-wrap');
    const rect = document.getElementById('device-img').getBoundingClientRect();
    const primaryAction = document.getElementById('send-btn');
    const ctaRect = primaryAction.getBoundingClientRect();
    window.__sharedControllerRef = controller;
    window.__sharedActionRef = primaryAction;
    connectTransitionWelcome();
    return {
      controllerCount: document.querySelectorAll('#device-wrap').length,
      imageCount: document.querySelectorAll('#device-img').length,
      faderCount: document.querySelectorAll('#thumb-l,#thumb-r').length,
      actionCount: document.querySelectorAll('#send-btn').length,
      parentId: controller.parentElement?.id || '',
      top: rect.top,
      width: rect.width,
      cta: { top: ctaRect.top, width: ctaRect.width, height: ctaRect.height },
    };
  });
  await settle(page, 800);
  const transitionSettled = await page.evaluate(() => {
    const trackL = document.getElementById('track-l').getBoundingClientRect();
    const trackR = document.getElementById('track-r').getBoundingClientRect();
    const thumbL = document.getElementById('thumb-l').getBoundingClientRect();
    const thumbR = document.getElementById('thumb-r').getBoundingClientRect();
    const expected = (track,thumb,value) => track.top + Math.round((1-value/127)*(track.height-thumb.height));
    return {
      leftGap: Math.abs(thumbL.top - expected(trackL,thumbL,23)),
      rightGap: Math.abs(thumbR.top - expected(trackR,thumbR,108)),
    };
  });
  await page.screenshot({ path: path.join(outputDir, `${profile.name}-transition.png`) });
  await settle(page, 350);
  const transitionEnd = await page.evaluate(() => {
    const rect = document.getElementById('device-img').getBoundingClientRect();
    const sendRect = document.getElementById('send-btn').getBoundingClientRect();
    return {
      sameNode: window.__sharedControllerRef === document.getElementById('device-wrap'),
      sameActionNode: window.__sharedActionRef === document.getElementById('send-btn'),
      parentId: document.getElementById('device-wrap').parentElement?.id || '',
      welcomeHidden: document.getElementById('welcome-screen').classList.contains('hidden'),
      top: rect.top,
      width: rect.width,
      send: { top: sendRect.top, width: sendRect.width, height: sendRect.height },
      introCardAbsent: !document.getElementById('onb-intro-card'),
    };
  });
  transitionEnd.topGap = Math.abs(transitionEnd.top - transitionStart.top);
  const transitionWidthGap = Math.abs(transitionEnd.width - transitionStart.width);
  addCheck(checks, 'Welcome uses one shared controller and fader pair',
    transitionStart.controllerCount === 1 && transitionStart.imageCount === 1 && transitionStart.faderCount === 2
      && transitionStart.parentId === 'welcome-controller-slot',
    `${transitionStart.controllerCount} controller / ${transitionStart.imageCount} image / ${transitionStart.faderCount} faders`);
  addCheck(checks, 'Welcome faders settle onto the hardware snapshot before dissolve',
    transitionSettled.leftGap <= 1.5 && transitionSettled.rightGap <= 1.5,
    `left ${transitionSettled.leftGap.toFixed(2)} px / right ${transitionSettled.rightGap.toFixed(2)} px`);
  addCheck(checks, 'Welcome and app use one shared primary action',
    transitionStart.actionCount === 1 && transitionEnd.sameActionNode,
    `${transitionStart.actionCount} button / same ${transitionEnd.sameActionNode}`);
  addCheck(checks, 'The same controller is handed to the app without moving',
    transitionEnd.sameNode && transitionEnd.parentId === 'device-home' && transitionEnd.welcomeHidden
      && transitionEnd.topGap <= 1 && transitionWidthGap <= 1,
    `same ${transitionEnd.sameNode} / top ${transitionEnd.topGap.toFixed(2)} px / width ${transitionWidthGap.toFixed(2)} px`);
  addCheck(checks, 'Send to device replaces Connect & load on the same pixels',
    Math.abs(transitionEnd.send.top - transitionStart.cta.top) <= 1
      && Math.abs(transitionEnd.send.width - transitionStart.cta.width) <= 1
      && Math.abs(transitionEnd.send.height - transitionStart.cta.height) <= 1,
    `top ${Math.abs(transitionEnd.send.top - transitionStart.cta.top).toFixed(2)} px / width ${Math.abs(transitionEnd.send.width - transitionStart.cta.width).toFixed(2)} px / height ${Math.abs(transitionEnd.send.height - transitionStart.cta.height).toFixed(2)} px`);
  addCheck(checks, 'Shared action handoff adds no second onboarding card',
    transitionEnd.introCardAbsent,
    String(transitionEnd.introCardAbsent));
  await page.evaluate(() => {
    _midiState = 'granted';
    _ffConnected = true;
    liveValues = { f1: 23, f2: 108 };
    liveSeen = { f1: true, f2: true };
    encLiveVal = 32;
    dirty = false;
    renderConnState();
    window.scrollTo(0, document.getElementById('panels-row').offsetTop + 180);
  });
  await settle(page, 420);
  const mobileStrip = await page.evaluate(() => {
    const hud = document.getElementById('live-strip');
    const rect = hud.getBoundingClientRect();
    const controller = document.getElementById('device-img').getBoundingClientRect();
    return {
      visible: hud.classList.contains('is-contextual-visible'),
      compact: hud.classList.contains('is-compact'),
      opacity: getComputedStyle(hud).opacity,
      topGap: rect.top - document.querySelector('.top-sticky').getBoundingClientRect().bottom,
      leftGap: rect.left,
      width: rect.width,
      height: rect.height,
      controllerBottom: controller.bottom,
      values: ['live-f1-value','live-f2-value','live-roller-value'].map(id => document.getElementById(id).textContent),
      tech: ['live-f1-tech','live-f2-tech','live-roller-tech'].map(id => document.getElementById(id).textContent),
      valuesUnclipped: ['live-f1-value','live-f2-value','live-roller-value'].every(id => {
        const value = document.getElementById(id);
        return value.scrollWidth <= value.clientWidth + 1;
      }),
      techUnclipped: ['live-f1-tech','live-f2-tech','live-roller-tech'].every(id => {
        const value = document.getElementById(id);
        return value.scrollWidth <= value.clientWidth + 1;
      }),
      labels: ['live-f1-label-short','live-f2-label-short','live-roller-label-short'].map(id => document.getElementById(id).textContent),
      metersVisible: [...hud.querySelectorAll('.live-hud-meter')].every(meter => getComputedStyle(meter).display !== 'none'),
      meterRects: [...hud.querySelectorAll('.live-hud-meter')].map(meter => {
        const meterRect = meter.getBoundingClientRect();
        return { width: meterRect.width, height: meterRect.height };
      }),
      itemRects: [...hud.querySelectorAll('.live-hud-item')].map(item => {
        const itemRect = item.getBoundingClientRect();
        return { top: itemRect.top, right: itemRect.right, bottom: itemRect.bottom, left: itemRect.left };
      }),
    };
  });
  addCheck(checks, 'Mobile hardware monitor remains visible while the controller scrolls away',
    mobileStrip.visible && mobileStrip.opacity === '1' && mobileStrip.controllerBottom < 0,
    `controller ${mobileStrip.controllerBottom.toFixed(1)} px / visible ${mobileStrip.visible} / opacity ${mobileStrip.opacity}`);
  addCheck(checks, 'Scrolled mobile monitor becomes a compact L, R and ART capsule',
    mobileStrip.compact && Math.abs(mobileStrip.width - 190) <= 1 && Math.abs(mobileStrip.height - 44) <= 1
      && mobileStrip.valuesUnclipped && mobileStrip.techUnclipped
      && mobileStrip.meterRects.every(rect => rect.width === 0 && rect.height === 0)
      && mobileStrip.labels.join(',') === 'L,R,ART' && mobileStrip.values.join(',') === '23,108,Harmonics'
      && mobileStrip.tech.join(',') === 'Ch1·CC11,Ch1·CC1,Ch1·CC32',
    `${mobileStrip.width.toFixed(1)} × ${mobileStrip.height.toFixed(1)} px / ${mobileStrip.labels.join(' ')} / ${mobileStrip.values.join(' ')} / ${mobileStrip.tech.join(' | ')}`);
  addCheck(checks, 'Mobile hardware monitor aligns below the left side of the header',
    Math.abs(mobileStrip.topGap - 12) <= 1 && Math.abs(mobileStrip.leftGap - 16) <= 1,
    `${mobileStrip.leftGap.toFixed(1)} px left / ${mobileStrip.topGap.toFixed(1)} px below header`);
  await page.screenshot({ path: path.join(outputDir, `${profile.name}-performance-strip.png`) });
  await page.evaluate(() => { dirty = true; reflectDirty(); });
  await settle(page, 460);
  const dockedStrip = await page.evaluate(() => {
    const hud = document.getElementById('live-strip').getBoundingClientRect();
    const send = document.querySelector('.send-callout').getBoundingClientRect();
    const overlap = !(hud.right <= send.left || hud.left >= send.right || hud.bottom <= send.top || hud.top >= send.bottom);
    return {
      docked: document.body.classList.contains('mobile-send-docked'),
      hudTop: hud.top,
      sendBottomGap: window.innerHeight - send.bottom,
      overlap,
    };
  });
  addCheck(checks, 'Top-left hardware monitor stays clear of the dirty Send dock',
    dockedStrip.docked && !dockedStrip.overlap && Math.abs(dockedStrip.sendBottomGap - 12) <= 1,
    `docked ${dockedStrip.docked} / overlap ${dockedStrip.overlap} / HUD top ${dockedStrip.hudTop.toFixed(1)} px / Send ${dockedStrip.sendBottomGap.toFixed(1)} px`);
  await page.screenshot({ path: path.join(outputDir, `${profile.name}-performance-strip-docked.png`) });
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page, 420);
  const stripBackAtController = await page.evaluate(() => {
    const hud = document.getElementById('live-strip');
    const rect = hud.getBoundingClientRect();
    const meters = [...hud.querySelectorAll('.live-hud-meter')].map(meter => {
      const meterRect = meter.getBoundingClientRect();
      return { width: meterRect.width, height: meterRect.height };
    });
    return {
      visible: hud.classList.contains('is-contextual-visible'),
      compact: hud.classList.contains('is-compact'),
      opacity: getComputedStyle(hud).opacity,
      width: rect.width,
      height: rect.height,
      meters,
    };
  });
  addCheck(checks, 'Hardware monitor expands back into the symmetric square with the controller',
    stripBackAtController.visible && !stripBackAtController.compact && stripBackAtController.opacity === '1'
      && Math.abs(stripBackAtController.width - 96) <= 1 && Math.abs(stripBackAtController.height - 96) <= 1
      && stripBackAtController.meters[0].height >= stripBackAtController.meters[0].width * 4
      && stripBackAtController.meters[1].height >= stripBackAtController.meters[1].width * 4,
    `${stripBackAtController.width.toFixed(1)} × ${stripBackAtController.height.toFixed(1)} px / compact ${stripBackAtController.compact} / opacity ${stripBackAtController.opacity}`);
  addCheck(checks, 'No page or console errors', errors.length === 0, errors.join(' | ') || 'none');
  await page.screenshot({ path: path.join(outputDir, `${profile.name}-app.png`) });
  await page.close();
  return { profile, checks, errors };
}

fs.mkdirSync(outputDir, { recursive: true });
let browser;
let server;
let exitCode = 0;
try {
  if (!remoteUrl) server = await startServer();
  const testUrl = remoteUrl || serverUrl(server);
  browser = await puppeteer.launch({
    headless: 'new',
    executablePath: findChrome(),
    pipe: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const results = [await runDesktopFlow(browser, testUrl)];
  for (const profile of profiles) results.push(await runProfile(browser, testUrl, profile));
  const report = { generatedAt: new Date().toISOString(), url: testUrl, results };
  fs.writeFileSync(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);

  for (const result of results) {
    console.log(`\n${result.profile.name} (${result.profile.viewport.width}x${result.profile.viewport.height})`);
    for (const check of result.checks) {
      console.log(`  ${check.pass ? 'PASS' : 'FAIL'}  ${check.name} — ${check.details}`);
      if (!check.pass) exitCode = 1;
    }
  }
  console.log(`\nReport and screenshots: ${outputDir}`);
} catch (error) {
  exitCode = 1;
  console.error(error.stack || error.message);
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
process.exitCode = exitCode;
