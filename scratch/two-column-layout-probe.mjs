// Regression probe (Frank 2026-09-28): from 900 px (UX audit N-4, was 1100) the controller + Send stay
// sticky in a left column and the editor scrolls on the right; the welcome keeps
// the centered single column. The live HUD and its reserved slot left of the
// controller are gone (Frank 2026-10-01): the column is just controller + shadow room.
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
  const dev = await rect(p, '#device-home'), col = await rect(p, '#stage-collapse'), set = await rect(p, '#settings-col');
  P(`${W}: controller column left of the editor`, col.r <= set.l && Math.abs(dev.t - (set.t + 32)) <= 1, JSON.stringify({ col, set, dev }));
  P(`${W}: room for the device shadow inside the clipping column`, col.r - dev.r >= 40, String(col.r - dev.r));
  P(`${W}: no empty HUD slot – controller centered in its column`, Math.abs((dev.l - col.l) - (col.r - dev.r)) <= 2, JSON.stringify({ col, dev }));
  P(`${W}: no live HUD and no Live monitor switch`, await p.evaluate(() => !document.getElementById('live-strip') && !document.getElementById('live-hud-switch')));

  await p.evaluate(() => duplicateBank(activeBank)); await wait(500);
  const note = await p.evaluate(() => { const n = document.getElementById('send-change-note'), s = document.querySelector('.stage').getBoundingClientRect(); return { vis: n.classList.contains('is-visible'), nb: Math.round(n.getBoundingClientRect().bottom), sb: Math.round(s.bottom) }; });
  P(`${W}: change note under Send is not clipped`, note.vis && note.nb <= note.sb, JSON.stringify(note));

  await p.evaluate(() => { const r = document.querySelector('.bank-section[data-fader="roller"]'); if (!r.classList.contains('is-open')) r.querySelector('[onclick]').click(); });
  await wait(600);
  await p.evaluate(() => window.scrollTo(0, 900)); await wait(400);
  const scrolled = { y: await p.evaluate(() => scrollY), dev: await rect(p, '#device-home') };
  P(`${W}: controller stays in place while the editor scrolls`, scrolled.y > 300 && scrolled.dev.t === dev.t, JSON.stringify(scrolled));
  await p.close();
}

{
  const p = await open(880, 800);
  const one = await p.evaluate(() => ({ grid: getComputedStyle(document.querySelector('.center-col')).display }));
  P('below 900 px: single column', one.grid !== 'grid', JSON.stringify(one));
  // UX audit 2026-09-28 N-10; the Controller switch was removed (Frank
  // 2026-09-29), the Live monitor switch with the HUD (Frank 2026-10-01).
  const app = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-group="feel-fader"] > .group-row')].map(r => r.id);
    return { rows, liveSwitch: !!document.getElementById('live-hud-switch'), controllerSwitch: !!document.getElementById('controller-toggle-input') };
  });
  P('Feel Fader group has no Application settings row', app.rows[0] === 'bank-actions-toggle-btn' && !app.rows.includes('app-settings-toggle-btn'), JSON.stringify(app));
  P('header has no Live monitor and no Controller switch', !app.liveSwitch && !app.controllerSwitch, JSON.stringify(app));
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
