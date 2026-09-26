// Regression probe (UX audit 2026-09-25, K-7 details): a default-named bank
// tab doesn't repeat its number ("1 Bank 1"), the header controller switch is
// labelled, the bank × looks the same in both themes, and "Reset range" is
// the same pill as "Choose range…" next to it.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' — '+x:''}`);
const errs = [];

async function open(width) {
  const p = await b.newPage(); p.on('pageerror', e => errs.push(String(e)));
  await p.setViewport({ width, height: 900 });
  await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
  await p.evaluate(() => skipWelcome());
  return p;
}
// Visible text only: collapsed names (max-width:0) and hidden fallbacks don't count.
const tabTexts = () => [...document.querySelectorAll('.bank-block-tab')].map(el => [...el.children].filter(c => c.getBoundingClientRect().width > 1).map(c => c.textContent.trim()).join(' '));

let p = await open(1440);
const d = await p.evaluate(async (tabTextsSrc) => {
  const tabTexts = eval(tabTextsSrc);
  const out = {};
  cfg.banks.forEach((bk, i) => { bk.name = 'Bank ' + (i + 1); bk.icon = ''; });
  cfg.banks[1].name = 'Strings';
  activeBank = 0; render();
  out.tabs = tabTexts();
  const wrap = document.querySelector('.controller-toggle-wrap');
  out.switchLabel = wrap?.innerText.trim();
  const x = document.querySelector('.btn-remove-bank');
  out.xLight = x && getComputedStyle(x).color;
  document.documentElement.classList.add('dark');
  await new Promise(r => setTimeout(r, 400));   // ui-control colour transition
  const probe = document.createElement('span'); probe.style.color = 'var(--t3)'; document.body.appendChild(probe);
  out.t3Dark = getComputedStyle(probe).color; probe.remove();
  out.xDark = x && getComputedStyle(x).color;
  document.documentElement.classList.remove('dark');
  _openSections.clear(); _openSections.add('roller');
  setRollerMode(0, 'keyswitch'); await new Promise(r => setTimeout(r, 400)); render();
  const choose = document.getElementById('ks-preset-trigger-0');
  const reset = [...document.querySelectorAll('#section-body-0-roller button')].find(el => el.textContent.trim() === 'Reset range');
  const sig = el => { const cs = getComputedStyle(el); return [cs.fontSize, cs.borderTopLeftRadius, Math.round(el.getBoundingClientRect().height)].join('/'); };
  out.choose = choose && sig(choose); out.reset = reset && sig(reset);
  out.resetInline = reset?.hasAttribute('style');
  return out;
}, tabTexts.toString());
await p.close();

p = await open(390);
const m = await p.evaluate((tabTextsSrc) => {
  const tabTexts = eval(tabTextsSrc);
  cfg.banks.forEach((bk, i) => { bk.name = 'Bank ' + (i + 1); bk.icon = ''; });
  activeBank = 0; render();
  return tabTexts();
}, tabTexts.toString());
await p.close();

// Welcome "Connect & load" is the red primary, not the .idle glass pill (#send-btn
// is .idle there because nothing is dirty yet); in-app the glass resumes.
p = await b.newPage(); p.on('pageerror', e => errs.push(String(e)));
await p.setViewport({ width: 1280, height: 800 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await new Promise(r => setTimeout(r, 1500));
const w = await p.evaluate(async () => {
  const btn = document.getElementById('send-btn');
  const red = (() => { const s = document.createElement('span'); s.style.color = 'var(--red)'; document.body.appendChild(s); const c = getComputedStyle(s).color; s.remove(); return c; })();
  const out = { red, cls: btn.className, light: getComputedStyle(btn).backgroundColor };
  document.documentElement.classList.add('dark');
  out.dark = getComputedStyle(btn).backgroundColor;
  document.documentElement.classList.remove('dark');
  skipWelcome(); await new Promise(r => setTimeout(r, 2500));
  out.inApp = getComputedStyle(btn).backgroundColor;
  return out;
});
await p.close();

P('welcome Connect & load is red primary in both themes', /welcome-start/.test(w.cls) && /\bidle\b/.test(w.cls) && w.light === w.red && w.dark === w.red, JSON.stringify(w));
P('in-app send button returns to idle glass after welcome', w.inApp !== w.red, w.inApp);
P('default-named tab shows its name once', d.tabs[0] === 'Bank 1', JSON.stringify(d.tabs));
P('custom-named tab keeps its number', d.tabs[1] === '2 Strings', JSON.stringify(d.tabs));
P('mobile: inactive default tabs are just numbers, active shows the name', m[0] === 'Bank 1' && m[1] === '2', JSON.stringify(m));
P('header controller switch has a visible label', /Controller/.test(d.switchLabel || ''), d.switchLabel);
P('bank × is neutral in dark mode too (danger only on hover)', d.xDark === d.t3Dark, `${d.xDark} vs ${d.t3Dark}`);
P('Reset range matches the Choose range pill', !!d.reset && d.reset === d.choose && !d.resetInline, `${d.reset} vs ${d.choose}`);
P('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
