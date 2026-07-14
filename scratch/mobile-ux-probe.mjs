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
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    localStorage.removeItem('ff-onboarded');
    _ffConnected = false;
    _serialPort = null;
    _midiState = 'unsupported';
    _onbConfigStarted = false;
    _onbDone = false;
    showWelcome();
    onbStartWelcome();
    window.scrollTo(0, 0);
  });
  await settle(page, 250);

  const welcomeBefore = await page.evaluate(() => {
    const cta = document.getElementById('welcome-start').getBoundingClientRect();
    const stage = document.querySelector('.welcome-copy-stage').getBoundingClientRect();
    const device = document.getElementById('device-img').getBoundingClientRect();
    return { ctaTop: cta.top, stageHeight: stage.height, deviceTop: device.top };
  });
  await settle(page, 700);
  const welcomeDeviceTopAfter = await page.evaluate(() =>
    document.getElementById('device-img').getBoundingClientRect().top);
  await page.screenshot({ path: path.join(outputDir, `${profile.name}-welcome.png`) });
  const introNavPositions = [];
  for (let slide = 0; slide < 3; slide += 1) {
    await page.evaluate(index => onbBeatGo(index), slide);
    await settle(page, 250);
    introNavPositions.push(await page.evaluate(() => ({
      dotsTop: document.querySelector('.onb-dots').getBoundingClientRect().top,
      ctaTop: document.getElementById('welcome-start').getBoundingClientRect().top,
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
    Math.abs(welcomeDeviceTopAfter - welcomeBefore.deviceTop) <= 0.25,
    `${welcomeBefore.deviceTop.toFixed(2)} → ${welcomeDeviceTopAfter.toFixed(2)} px`);

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
        button: document.getElementById('welcome-start').textContent,
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
    _onbConfigStarted = false;
    _onbDone = false;
    cfg.banks[0].name = 'Bang go b';
    skipWelcome();
    onbMaybeStartConfig();
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
    const introCard = document.getElementById('onb-intro-card')?.getBoundingClientRect();
    const badge = document.getElementById('onb-demo-badge');
    const bankTabContainer = document.getElementById('bank-tabs')?.getBoundingClientRect();
    const bankTabs = [...document.querySelectorAll('#bank-tabs .bank-block-tab')].slice(0, 3).map(tab => {
      const rect = tab.getBoundingClientRect();
      return { text: tab.textContent.trim(), left: rect.left, right: rect.right };
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
      introCard: introCard ? { top: introCard.top, bottom: introCard.bottom } : null,
      controllerTop: controller?.top ?? null,
      controllerBottom: controller?.bottom ?? null,
      bankTabs,
      bankTabContainer: bankTabContainer ? { left: bankTabContainer.left, right: bankTabContainer.right } : null,
      midiHelpAbsent: !document.getElementById('midi-help-banner'),
      headerStatus: document.getElementById('h-status-text')?.textContent || '',
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
  addCheck(checks, 'Onboarding card does not overlap the controller',
    appState.introCard && appState.controllerTop !== null && appState.controllerBottom !== null
      && (appState.introCard.bottom <= appState.controllerTop || appState.introCard.top >= appState.controllerBottom),
    appState.introCard && appState.controllerTop !== null && appState.controllerBottom !== null
      ? `card ${appState.introCard.top.toFixed(1)}–${appState.introCard.bottom.toFixed(1)} / controller ${appState.controllerTop.toFixed(1)}–${appState.controllerBottom.toFixed(1)} px`
      : 'missing');
  const threeDefaultBanksVisible = appState.bankTabs.length === 3 && appState.bankTabContainer
    && appState.bankTabs.every(tab => tab.left >= appState.bankTabContainer.left - 1 && tab.right <= appState.bankTabContainer.right + 1);
  addCheck(checks, 'Mobile header shows default banks B1, B2 and B3', threeDefaultBanksVisible,
    appState.bankTabs.map(tab => tab.text).join(' / ') || 'missing');
  addCheck(checks, 'Continue without device ignores stale browser configuration',
    JSON.stringify(appState.bankNames) === JSON.stringify(['Bank 1', 'Bank 2', 'Bank 3']),
    appState.bankNames.join(' / '));
  addCheck(checks, 'MIDI status has no duplicate content banner',
    appState.midiHelpAbsent && /^MIDI (unavailable|blocked)$/.test(appState.headerStatus),
    `${appState.headerStatus} / banner ${appState.midiHelpAbsent ? 'absent' : 'present'}`);
  addCheck(checks, 'App opens at the top', appState.scrollY <= 1, `${appState.scrollY} px`);

  const transitionStart = await page.evaluate(() => {
    liveValues = { f1:23, f2:108 };
    liveSeen = { f1:true, f2:true };
    positionThumbs();
    showWelcome();
    const controller = document.getElementById('device-wrap');
    const rect = document.getElementById('device-img').getBoundingClientRect();
    window.__sharedControllerRef = controller;
    connectTransitionWelcome();
    return {
      controllerCount: document.querySelectorAll('#device-wrap').length,
      imageCount: document.querySelectorAll('#device-img').length,
      faderCount: document.querySelectorAll('#thumb-l,#thumb-r').length,
      parentId: controller.parentElement?.id || '',
      top: rect.top,
      width: rect.width,
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
    return {
      sameNode: window.__sharedControllerRef === document.getElementById('device-wrap'),
      parentId: document.getElementById('device-wrap').parentElement?.id || '',
      welcomeHidden: document.getElementById('welcome-screen').classList.contains('hidden'),
      top: rect.top,
      width: rect.width,
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
  addCheck(checks, 'The same controller is handed to the app without moving',
    transitionEnd.sameNode && transitionEnd.parentId === 'device-home' && transitionEnd.welcomeHidden
      && transitionEnd.topGap <= 1 && transitionWidthGap <= 1,
    `same ${transitionEnd.sameNode} / top ${transitionEnd.topGap.toFixed(2)} px / width ${transitionWidthGap.toFixed(2)} px`);
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
  const results = [];
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
