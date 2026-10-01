// Phone "Try without device" hand-off (Frank 2026-10-01: "dojde tam k malému škubnutí"):
// controller + greeting must move without a per-frame jump.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Users/Fanda Borec/.cache/puppeteer/chrome-headless-shell/win64-154.0.8037.59/chrome-headless-shell-win64/chrome-headless-shell.exe', headless:'shell', pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  – '+x:''}`);
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.setViewport({ width:390, height:664, isMobile:true, hasTouch:true });
await p.emulateMediaFeatures([{ name:'prefers-reduced-motion', value:'no-preference' }]);
await p.evaluateOnNewDocument(() => { try { delete Navigator.prototype.serial; } catch {} try { localStorage.setItem('ff-onboarded','1'); } catch {} });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await new Promise(r => setTimeout(r, 1200));
const r = await p.evaluate(async () => {
  const sel = { dev:'#device-img', tl:'#thumb-l', tr:'#thumb-r', btn:'#send-btn', wm:'.welcome-wordmark', note:'#welcome-browser-notice', greet:'#owner-greeting .owner-greeting-name', stage:'#stage-collapse' };
  const rows = []; let go = true, t0 = performance.now();
  const tick = () => {
    const row = { t: Math.round(performance.now() - t0) };
    for (const [k, q] of Object.entries(sel)) { const e = document.querySelector(q); if (e) { const r = e.getBoundingClientRect(); row[k] = [r.top, r.left, r.width, r.height]; } }
    rows.push(row);
    if (go) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  document.getElementById('send-btn').click();
  await new Promise(r => setTimeout(r, 3500)); go = false;
  const jumps = [];
  for (let i = 1; i < rows.length; i++) for (const k of Object.keys(sel)) {
    const a = rows[i-1][k], c = rows[i][k]; if (!a || !c) continue;
    const d = Math.max(...a.map((v, j) => Math.abs(v - c[j])));
    if (d > 1.2) jumps.push(`${rows[i].t}ms ${k} ${d.toFixed(1)}`);
  }
  let maxC = 0, at = 0, maxG = 0;
  for (let i = 1; i < rows.length; i++) {
    const d = Math.abs(rows[i].dev[0] - rows[i-1].dev[0]); if (d > maxC) { maxC = d; at = rows[i].t; }
    if (rows[i].greet && rows[i-1].greet) maxG = Math.max(maxG, Math.abs(rows[i].greet[0] - rows[i-1].greet[0]));
  }
  return { maxC: +maxC.toFixed(2), at, maxG: +maxG.toFixed(2), jumps: jumps.filter(j => / greet /.test(j)) };
});
console.log(JSON.stringify(r));
P('controller never jumps more than 4px in one frame', r.maxC <= 4, JSON.stringify({ maxC: r.maxC, at: r.at }));
P('greeting stays put (no per-frame jump, incl. size/left at the layout swap)', !r.jumps.length && r.maxG <= 1, JSON.stringify(r.jumps));
P('no page errors', !errs.length, errs.join(' | '));
await b.close();
