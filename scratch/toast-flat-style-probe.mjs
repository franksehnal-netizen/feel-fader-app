// Regression probe (Frank 2026-09-30): toasts follow the minimal hybrid surfaces
// (spec 2026-09-26 §1/§3) – a flat floating card like the HUD: --bg-card, hairline
// --border, --shadow-hud, radius --r, no blur/gradient/bevel; body text in --t1.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  – '+x:''}`);
await p.evaluate(() => skipWelcome());

for (const theme of ['light', 'dark']) {
  const r = await p.evaluate((theme) => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.getElementById('toasts').innerHTML = '';
    toast('i', 'Device is still on the last sent settings. A longer message wraps onto a second line here.', { label: 'Send to device', onClick(){} });
    const el = document.querySelector('#toasts .toast');
    el.style.animation = 'none';
    const cs = getComputedStyle(el), icon = getComputedStyle(el.querySelector('.toast-icon'));
    const msg = getComputedStyle(el.querySelector('.toast-message')), act = getComputedStyle(el.querySelector('.toast-action'));
    const tok = name => { const s = document.createElement('span'); s.style.cssText = `color:var(${name})`; document.body.appendChild(s); const v = getComputedStyle(s).color; s.remove(); return v; };
    const bgTok = name => { const s = document.createElement('span'); s.style.cssText = `background:var(${name})`; document.body.appendChild(s); const v = getComputedStyle(s).backgroundColor; s.remove(); return v; };
    const shTok = () => { const s = document.createElement('span'); s.style.cssText = 'box-shadow:var(--shadow-hud)'; document.body.appendChild(s); const v = getComputedStyle(s).boxShadow; s.remove(); return v; };
    return {
      bg: cs.backgroundColor, bgImage: cs.backgroundImage, card: bgTok('--bg-card'),
      backdrop: cs.backdropFilter, shadow: cs.boxShadow, hud: shTok(),
      radius: cs.borderRadius, border: cs.borderTopColor, borderTok: tok('--border'),
      msgColor: msg.color, t1: tok('--t1'), msgSize: msg.fontSize,
      iconBackdrop: icon.backdropFilter, iconBorder: icon.borderTopWidth, iconShadow: icon.boxShadow,
      actBg: act.backgroundColor, input: bgTok('--bg-input'), actBackdrop: act.backdropFilter,
    };
  }, theme);
  P(`${theme}: flat card surface (--bg-card, no gradient, no blur)`, r.bg === r.card && r.bgImage === 'none' && r.backdrop === 'none', JSON.stringify(r));
  P(`${theme}: HUD lift shadow and hairline border`, r.shadow === r.hud && r.border === r.borderTok, `${r.shadow} | ${r.border}`);
  P(`${theme}: radius --r (12px), not a pill`, r.radius === '12px', r.radius);
  P(`${theme}: message in --t1 at 13px`, r.msgColor === r.t1 && r.msgSize === '13px', `${r.msgColor} ${r.msgSize}`);
  P(`${theme}: icon without glass disc`, r.iconBackdrop === 'none' && r.iconBorder === '0px' && r.iconShadow === 'none', JSON.stringify(r));
  P(`${theme}: action is a flat --bg-input pill`, r.actBg === r.input && r.actBackdrop === 'none', r.actBg);
}
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
