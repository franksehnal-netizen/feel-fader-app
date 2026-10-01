// Phone / unsupported browser (Frank 2026-10-01): one CTA "Try without device",
// no "Continue without device" link, wordmark centred above the controller.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const errs=[]; const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  – '+x:''}`);
async function open(onboarded, unsupported=true){
  const p = await b.newPage(); p.on('pageerror',e=>errs.push(String(e)));
  await p.setViewport({ width:390, height:760, isMobile:true, hasTouch:true });
  await p.evaluateOnNewDocument((o,u) => { if(u){ try { delete Navigator.prototype.serial; } catch {} } try { o?localStorage.setItem('ff-onboarded','1'):localStorage.removeItem('ff-onboarded'); } catch {} }, onboarded, unsupported);
  await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
  await new Promise(r => setTimeout(r, 1500));
  return p;
}
const p = await open(true);
await p.screenshot({ path: 'scratch/mobile-single-cta.png' });
const s = await p.evaluate(() => {
  const btn = document.getElementById('send-btn'), skip = document.querySelector('.welcome-skip');
  const wm = document.querySelector('.welcome-wordmark').getBoundingClientRect(), dev = document.getElementById('device-img').getBoundingClientRect();
  return { label: btn.textContent.trim(), skipShown: getComputedStyle(skip).display !== 'none',
    notice: document.getElementById('welcome-browser-notice').textContent,
    above: Math.round(wm.top), below: Math.round(dev.top - wm.bottom) };
});
const geo = await p.evaluate(() => {
  const btn = document.getElementById('send-btn'), r = btn.getBoundingClientRect();
  const range = document.createRange(); range.selectNodeContents(btn); const t = range.getBoundingClientRect();
  const n = document.getElementById('welcome-browser-notice').getBoundingClientRect();
  return { textOff: Math.round(((t.left + t.right) / 2) - ((r.left + r.right) / 2)), fits: t.width <= r.width, noticeBottomGap: Math.round(innerHeight - n.bottom) };
});
P('CTA label centred in the button', Math.abs(geo.textOff) <= 1 && geo.fits, JSON.stringify(geo));
P('notice sits at the bottom edge', geo.noticeBottomGap <= 20, JSON.stringify(geo));
P('CTA reads "Try without device"', s.label === 'Try without device', s.label);
P('"Continue without device" link hidden', !s.skipShown);
P('notice no longer repeats the explore hint', !/explore/.test(s.notice), s.notice);
P('wordmark centred in the gap above the controller', Math.abs(s.above - s.below) <= 2, JSON.stringify(s));
await p.evaluate(() => document.getElementById('send-btn').click());
await new Promise(r => setTimeout(r, 3500));
const after = await p.evaluate(() => ({ hidden: document.getElementById('welcome-screen').classList.contains('hidden'), label: document.getElementById('send-btn').textContent.trim() }));
P('CTA enters the app without a device (no port picker)', after.hidden, JSON.stringify(after));
const o = await open(false);
await new Promise(r => setTimeout(r, 6000));
const ol = await o.evaluate(() => ({ label: document.getElementById('send-btn').textContent.trim(),
  skips: [...document.querySelectorAll('.welcome-skip')].filter(e => { const t = e.querySelector('span'); return getComputedStyle(e).display !== 'none' && t && getComputedStyle(t).visibility !== 'hidden'; }).length }));
P('phone onboarding: CTA reads "Try without device", no skip link', ol.label === 'Try without device' && !ol.skips, JSON.stringify(ol));
await o.screenshot({ path: 'scratch/mobile-single-cta-onb.png' });
const d = await open(true, false);
const dl = await d.evaluate(() => ({ label: document.getElementById('send-btn').textContent.trim(), skip: getComputedStyle(document.querySelector('.welcome-skip')).display }));
P('supported browser keeps Connect & load + skip link', dl.label === 'Connect & load' && dl.skip !== 'none', JSON.stringify(dl));
P('no page errors', !errs.length, errs.join(' | '));
await b.close();
