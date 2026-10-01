// Connect & load from a scrolled first-run (onboarding) welcome must glide the
// controller from where it is, not snap it back first (Frank 2026-10-01:
// "po kliknutí to odskočí dolu, není to seamless"). finalizeWelcomeExit()
// moves the controller out of the scrolled onboarding before the FLIP glide,
// so the glide has to take its "from" rect before that call.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  – '+x:''}`);
const errs = [];

async function run(W, H, scroll) {
  const p = await b.newPage(); p.on('pageerror', e => errs.push(String(e)));
  await p.emulateMediaFeatures([{ name:'prefers-reduced-motion', value:'no-preference' }]);
  await p.setViewport({ width:W, height:H });
  await p.evaluateOnNewDocument(() => { try { localStorage.removeItem('ff-onboarded'); } catch {} });
  await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
  await new Promise(r => setTimeout(r, 1200));
  if (scroll) {
    await p.mouse.move(W / 2, H / 2);
    for (let i = 0; i < scroll; i += 100) { await p.mouse.wheel({ deltaY:100 }); await new Promise(r => setTimeout(r, 60)); }
    await new Promise(r => setTimeout(r, 800));
  }
  const res = await p.evaluate(async () => {
    const onb = document.getElementById('welcome-text-block').classList.contains('welcome-onboarding');
    const wsScroll = document.getElementById('welcome-screen').scrollTop;
    const vis = document.getElementById('device-visual');
    const deviceCfg = JSON.stringify(cfg);
    window._serialEnsureOpen = async () => {};
    window.serialRequest = async cmd => cmd === 'CMD_INFO'
      ? JSON.stringify({ schema_version:2, config_hash:'h', firmware:'1.4.0', faders:[100,20] }) : '';
    window.serialReadConfig = async () => deviceCfg;
    window.normalizeFwConfig = x => x;
    window.fetchFirmwareManifest = () => {};
    _serialPort = { getInfo: () => ({ usbProductId:1 }) };
    const tops = []; let go = true;
    const tick = () => { tops.push(vis.getBoundingClientRect().top); if (go) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    doStart();
    await new Promise(r => setTimeout(r, 3000)); go = false;
    let maxStep = 0;
    for (let i = 1; i < tops.length; i++) maxStep = Math.max(maxStep, Math.abs(tops[i] - tops[i - 1]));
    return { onb, wsScroll, maxStep: Math.round(maxStep), from: Math.round(tops[0]), to: Math.round(tops.at(-1)) };
  });
  await p.close();
  return res;
}

const scrolled = await run(1280, 720, 300);
P('scrolled onboarding welcome is actually scrolled (precondition)', scrolled.onb && scrolled.wsScroll > 100, JSON.stringify(scrolled));
P('controller glides from its scrolled spot – no snap at the layout swap (≤ 20 px/frame)', scrolled.maxStep <= 20, JSON.stringify(scrolled));
const top = await run(1512, 900, 0);
P('unscrolled welcome glides without a snap too', top.onb && top.maxStep <= 20, JSON.stringify(top));
P('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
