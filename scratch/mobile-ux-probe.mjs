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
    return { ctaTop: cta.top, stageHeight: stage.height };
  });
  await page.screenshot({ path: path.join(outputDir, `${profile.name}-welcome.png`) });
  const introNavPositions = [];
  for (let slide = 0; slide < 3; slide += 1) {
    await page.evaluate(index => onbBeatGo(index), slide);
    await settle(page, 250);
    introNavPositions.push(await page.evaluate(() => ({
      dotsTop: document.querySelector('.onb-dots').getBoundingClientRect().top,
      skipTop: document.querySelector('.onb-skip').getBoundingClientRect().top,
      skipBottom: document.querySelector('.onb-skip').getBoundingClientRect().bottom,
      ctaTop: document.getElementById('welcome-start').getBoundingClientRect().top,
      subHeight: document.querySelector('.onb-beat-sub').getBoundingClientRect().height,
    })));
    if (slide === 1) {
      await page.screenshot({ path: path.join(outputDir, `${profile.name}-welcome-step2.png`) });
    }
  }
  const dotsShift = Math.max(...introNavPositions.map(item => item.dotsTop))
    - Math.min(...introNavPositions.map(item => item.dotsTop));
  const skipShift = Math.max(...introNavPositions.map(item => item.skipTop))
    - Math.min(...introNavPositions.map(item => item.skipTop));
  const introClearance = Math.min(...introNavPositions.map(item => item.ctaTop - item.skipBottom));
  addCheck(checks, 'Intro dots stay fixed across all three slides', dotsShift <= 1, `${dotsShift.toFixed(2)} px`);
  addCheck(checks, 'Skip intro stays fixed across all three slides', skipShift <= 1, `${skipShift.toFixed(2)} px`);
  addCheck(checks, 'Skip intro stays clear of the primary CTA', introClearance >= 4, `${introClearance.toFixed(2)} px`);
  await page.click('.onb-skip');
  await settle(page, 250);
  const welcomeAfter = await page.evaluate(() => {
    const cta = document.getElementById('welcome-start').getBoundingClientRect();
    return { ctaTop: cta.top };
  });
  const ctaShift = Math.abs(welcomeAfter.ctaTop - welcomeBefore.ctaTop);
  addCheck(checks, 'Skip intro keeps the primary CTA fixed', ctaShift <= 1, `${ctaShift.toFixed(2)} px`);
  addCheck(checks, 'Welcome copy uses a stable mobile slot', Math.abs(welcomeBefore.stageHeight - 164) <= 1, `${welcomeBefore.stageHeight.toFixed(2)} px`);

  await page.evaluate(() => {
    _ffConnected = false;
    _serialPort = null;
    _midiState = 'unsupported';
    _onbConfigStarted = false;
    _onbDone = false;
    skipWelcome();
    render();
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
    return {
      faders: {
        left: document.getElementById('thumb-l')?.style.transform || '',
        right: document.getElementById('thumb-r')?.style.transform || '',
      },
      demoBadgeVisible: Boolean(badge && getComputedStyle(badge).display !== 'none'),
      viewportWidth: window.innerWidth,
      rootScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      controller: controller ? { left: controller.left, right: controller.right } : null,
      introCard: introCard ? { top: introCard.top, bottom: introCard.bottom } : null,
      controllerTop: controller?.top ?? null,
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
    appState.introCard && appState.controllerTop !== null && appState.introCard.bottom <= appState.controllerTop,
    appState.introCard && appState.controllerTop !== null
      ? `card bottom ${appState.introCard.bottom.toFixed(1)} / controller top ${appState.controllerTop.toFixed(1)} px`
      : 'missing');
  addCheck(checks, 'App opens at the top', appState.scrollY <= 1, `${appState.scrollY} px`);
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
