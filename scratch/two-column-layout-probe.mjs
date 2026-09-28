// Regression probe (Frank 2026-09-28): from 900 px (UX audit N-4, was 1100) the controller + Send stay
// sticky in a left column and the editor scrolls on the right; the default live
// HUD docks in a slot left of the controller and can be switched off (per
// browser); the welcome keeps the centered single column.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P = (l, ok, x='') => console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' – '+x:''}`);
const wait = ms => new Promise(r => setTimeout(r, ms));
const errs = [];

async function open(w, h, skip = true) {
  const p = await b.newPage();
  p.on('pageerror', e => errs.push(String(e)));
  p.on('dialog', d => d.accept());   // beforeunload after edits
  await p.emulateMediaFeatures([{ name:'prefers-reduced-motion', value:'no-preference' }]);
  await p.setViewport({ width: w, height: h });
  await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil:'networkidle0' });
  if (skip) { await p.evaluate(() => skipWelcome()); await wait(1500); }
  return p;
}
const rect = (p, sel) => p.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { l:Math.round(r.left), t:Math.round(r.top), w:Math.round(r.width), r:Math.round(r.right), b:Math.round(r.bottom) }; }, sel);

// Welcome stays single-column: the sticky column would trap the shared controller under the overlay.
{
  const p = await open(1280, 900, false);
  await wait(1500);
  const w = await p.evaluate(() => { const d = document.getElementById('device-home').getBoundingClientRect(), s = document.getElementById('send-btn').getBoundingClientRect(); return { dev: d.left + d.width / 2, btn: s.left + s.width / 2, vc: innerWidth / 2, grid: getComputedStyle(document.querySelector('.center-col')).display }; });
  P('welcome: controller and Connect & load stay centered (no two-column yet)', w.grid !== 'grid' && Math.abs(w.dev - w.vc) <= 8 && Math.abs(w.btn - w.vc) <= 8, JSON.stringify(w));
  await p.close();
}

for (const [W, H] of [[1440, 900], [1100, 760], [1080, 800], [960, 800], [900, 760]]) {
  const p = await open(W, H);
  let dev = await rect(p, '#device-home'), col = await rect(p, '#stage-collapse'), hud = await rect(p, '#live-strip'), set = await rect(p, '#settings-col');
  P(`${W}: controller column left of the editor`, col.r <= set.l && Math.abs(dev.t - (set.t + 32)) <= 1, JSON.stringify({ col, set, dev }));
  P(`${W}: default HUD docked left of the controller, not covering it`, hud.l === col.l && hud.r <= dev.l && hud.t === dev.t, JSON.stringify({ hud, dev }));
  P(`${W}: room for the device shadow inside the clipping column`, col.r - dev.r >= 40, String(col.r - dev.r));

  await p.evaluate(() => duplicateBank(activeBank)); await wait(500);
  const note = await p.evaluate(() => { const n = document.getElementById('send-change-note'), s = document.querySelector('.stage').getBoundingClientRect(); return { vis: n.classList.contains('is-visible'), nb: Math.round(n.getBoundingClientRect().bottom), sb: Math.round(s.bottom) }; });
  P(`${W}: change note under Send is not clipped`, note.vis && note.nb <= note.sb, JSON.stringify(note));

  await p.evaluate(() => { const r = document.querySelector('.bank-section[data-fader="roller"]'); if (!r.classList.contains('is-open')) r.querySelector('[onclick]').click(); });
  await wait(600);
  await p.evaluate(() => window.scrollTo(0, 900)); await wait(400);
  const scrolled = { y: await p.evaluate(() => scrollY), dev: await rect(p, '#device-home'), hud: await rect(p, '#live-strip') };
  P(`${W}: controller and HUD stay in place while the editor scrolls`, scrolled.y > 300 && scrolled.dev.t === dev.t && scrolled.hud.t === dev.t, JSON.stringify(scrolled));
  await p.evaluate(() => window.scrollTo(0, 0)); await wait(300);

  const devOn = await rect(p, '#device-home');
  await p.evaluate(() => setLiveHudEnabled(false)); await wait(400);
  dev = await rect(p, '#device-home');
  const off = await p.evaluate(() => ({ vis: document.getElementById('live-strip').classList.contains('is-contextual-visible'), docked: document.body.classList.contains('hud-docked'), sw: document.getElementById('live-hud-switch').checked, stored: localStorage.getItem('ff_live_hud_enabled') }));
  P(`${W}: Live monitor off hides the HUD and persists`, !off.vis && !off.docked && !off.sw && off.stored === '0', JSON.stringify(off));
  P(`${W}: controller does not move when the HUD is switched off`, dev.l === devOn.l && dev.t === devOn.t, JSON.stringify({ devOn, dev }));
  await p.reload({ waitUntil:'networkidle0' }); await p.evaluate(() => skipWelcome()); await wait(1200);
  P(`${W}: Live monitor off survives a reload`, await p.evaluate(() => !document.getElementById('live-strip').classList.contains('is-contextual-visible') && !document.getElementById('live-hud-switch').checked));
  await p.evaluate(() => setLiveHudEnabled(true)); await wait(400);
  P(`${W}: controller does not move when the HUD appears`, (await rect(p, '#device-home')).l === devOn.l);
  await p.evaluate(() => { _liveHudState.x = 700; _liveHudState.y = 300; applyLiveHudState(true); }); await wait(400);
  P(`${W}: controller does not move when the HUD is dragged away`, (await rect(p, '#device-home')).l === devOn.l);
  // Double-click (and Home) send the HUD to the top-left corner, not back to
  // the docked slot (Frank 2026-09-29).
  await p.evaluate(() => document.getElementById('live-strip').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))); await wait(500);
  const corner = await p.evaluate(() => {
    const s = document.getElementById('live-strip').getBoundingClientRect();
    return { l: Math.round(s.left), gap: Math.round(s.top - document.querySelector('header').getBoundingClientRect().bottom),
      docked: document.body.classList.contains('hud-docked'), large: _liveHudState.large };
  });
  P(`${W}: double-click sends the HUD to the top-left corner (12 px margins, 1x)`, corner.l === 12 && corner.gap === 12 && !corner.docked && !corner.large, JSON.stringify(corner));
  P(`${W}: controller does not move when the HUD goes to the corner`, (await rect(p, '#device-home')).l === devOn.l);
  const home = await p.evaluate(async () => {
    _liveHudState.x = 700; _liveHudState.y = 300; applyLiveHudState(true);
    const strip = document.getElementById('live-strip');
    strip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 450));
    return { x: _liveHudState.x, left: Math.round(strip.getBoundingClientRect().left) };
  });
  P(`${W}: Home also sends the HUD to the corner`, home.x === 12 && home.left === 12, JSON.stringify(home));
  await p.close();
}

{
  const p = await open(880, 800);
  const one = await p.evaluate(() => ({ grid: getComputedStyle(document.querySelector('.center-col')).display, docked: document.body.classList.contains('hud-docked') }));
  P('below 900 px: single column, HUD not docked', one.grid !== 'grid' && !one.docked, JSON.stringify(one));
  // UX audit 2026-09-28 N-10: Live monitor sits in the header; the Controller
  // switch next to it was removed (Frank 2026-09-29).
  const app = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-group="feel-fader"] > .group-row')].map(r => r.id);
    const sw = document.getElementById('live-hud-switch');
    const inHeader = document.querySelector('header').contains(sw);
    const controllerSwitch = !!document.getElementById('controller-toggle-input');
    sw.click();
    return { rows, inHeader, controllerSwitch, hudOff: !document.getElementById('live-strip').classList.contains('is-contextual-visible') && localStorage.getItem('ff_live_hud_enabled') === '0' };
  });
  P('Feel Fader group has no Application settings row; Live monitor switch sits in the header', app.rows[0] === 'bank-actions-toggle-btn' && !app.rows.includes('app-settings-toggle-btn') && app.inHeader, JSON.stringify(app));
  P('Live monitor switch in the header turns the HUD off', app.hudOff, JSON.stringify(app));
  P('header has no Controller show/hide switch', !app.controllerSwitch, JSON.stringify(app));
  await p.close();
}

// UX audit 2026-09-28 N-3: the single-column .stage clipped "N changes · Review".
for (const [W, H] of [[880, 800], [700, 800]]) {
  const p = await open(W, H);
  await p.evaluate(() => duplicateBank(activeBank)); await wait(500);
  const note = await p.evaluate(() => {
    const n = document.getElementById('send-change-note'), st = document.querySelector('.stage'), cs = getComputedStyle(st);
    const margin = cs.overflow === 'clip' ? parseFloat(cs.overflowClipMargin) || 0 : 0;
    return { vis: n.classList.contains('is-visible'), nb: Math.round(n.getBoundingClientRect().bottom), clip: Math.round(st.getBoundingClientRect().bottom + margin), card: Math.round(document.querySelector('.bank-card').getBoundingClientRect().top) };
  });
  P(`${W} (single column): change note under Send is not clipped`, note.vis && note.nb <= note.clip, JSON.stringify(note));
  P(`${W} (single column): change note stays above the bank card`, note.nb <= note.card, JSON.stringify(note));
  await p.close();
}

P('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
