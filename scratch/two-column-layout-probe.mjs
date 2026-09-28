// Regression probe (Frank 2026-09-28): from 1100 px the controller + Send stay
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

for (const [W, H] of [[1440, 900], [1100, 760]]) {
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
  await p.evaluate(() => resetLiveHud()); await wait(500);
  P(`${W}: reset (dblclick/Home) returns the HUD to its slot`, (await rect(p, '#live-strip')).l === (await rect(p, '#stage-collapse')).l);

  await p.evaluate(() => toggleControllerVisibility(false)); await wait(1500);
  set = await rect(p, '#settings-col');
  P(`${W}: hidden controller – editor re-centers, HUD undocked`, Math.abs((set.l + set.w / 2) - W / 2) < 12 && !(await p.evaluate(() => document.body.classList.contains('hud-docked'))), JSON.stringify(set));
  // HUD re-docks after the 1.1 s column animation (1.3 s timer) + its .36 s glide.
  await p.evaluate(() => toggleControllerVisibility(true)); await wait(2200);
  hud = await rect(p, '#live-strip'); col = await rect(p, '#stage-collapse');
  P(`${W}: controller shown again – HUD re-docks`, hud.l === col.l, JSON.stringify({ hud, col }));
  await p.close();
}

{
  const p = await open(1000, 800);
  const one = await p.evaluate(() => ({ grid: getComputedStyle(document.querySelector('.center-col')).display, docked: document.body.classList.contains('hud-docked') }));
  P('below 1100 px: single column, HUD not docked', one.grid !== 'grid' && !one.docked, JSON.stringify(one));
  const app = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-group="feel-fader"] > .group-row')].map(r => r.id);
    toggleAppSettings();
    const sw = document.getElementById('live-hud-switch');
    const inApp = document.getElementById('app-settings-body').contains(sw) && !document.getElementById('device-settings-body').contains(sw);
    const open = document.getElementById('app-settings-body').style.display !== 'none';
    sw.click();
    return { rows, inApp, open, hudOff: !document.getElementById('live-strip').classList.contains('is-contextual-visible') && localStorage.getItem('ff_live_hud_enabled') === '0' };
  });
  P('Application settings row sits under Bank actions and holds the Live monitor switch', app.rows[0] === 'bank-actions-toggle-btn' && app.rows[1] === 'app-settings-toggle-btn' && app.inApp && app.open, JSON.stringify(app));
  P('Live monitor switch in Application settings turns the HUD off', app.hudOff, JSON.stringify(app));
  await p.close();
}

P('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
