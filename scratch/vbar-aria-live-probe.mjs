// Regression probe: the validation error banner (#vbar) is announced to
// screen readers (A9, functional-audit finding 2026-07-20). Every other
// dynamic status area in the app (#toasts, header status, send-change-note,
// welcome-start-msg) has aria-live; #vbar was the one exception — a
// duplicate-CC or empty-articulation-list error would only be discovered
// by a screen reader user who happened to Tab onto the banner.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.evaluate(() => { skipWelcome(); });
await new Promise(r => setTimeout(r, 300));

const before = await p.evaluate(() => {
  const vbar = document.getElementById('vbar');
  return { role: vbar.getAttribute('role'), ariaLive: vbar.getAttribute('aria-live') };
});
P('#vbar has role="alert"', before.role === 'alert', before.role);
P('#vbar has aria-live="assertive"', before.ariaLive === 'assertive', before.ariaLive);

await p.evaluate(() => {
  cfg.banks[0].fader2.cc = cfg.banks[0].fader1.cc;
  cfg.banks[0].fader2.channel = cfg.banks[0].fader1.channel;
  runValidation();
});
const after = await p.evaluate(() => document.getElementById('vbar').textContent.trim().length > 0);
P('#vbar content updates when a validation error occurs', after, String(after));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
