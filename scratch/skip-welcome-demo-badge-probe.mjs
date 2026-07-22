// Regression probe: continuing without hardware opens the normal app state
// without the obsolete demo badge or a stale stage offset.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.setViewport({ width: 390, height: 700 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.evaluate(() => { localStorage.removeItem('ff-onboarded'); });
await p.reload({ waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 400));
await p.click('.welcome-skip');
await new Promise(r => setTimeout(r, 800));

const state = await p.evaluate(() => {
  const stage = document.querySelector('.stage');
  return {
    stageMarginTop: parseFloat(getComputedStyle(stage).marginTop),
    badgeAbsent: document.getElementById('onb-demo-badge') === null,
    statusText: document.getElementById('h-status-text')?.textContent.trim(),
  };
});
P('.stage has no top-margin offset (static CSS default, nothing to reset)', state.stageMarginTop === 0, `${state.stageMarginTop}px`);
P('obsolete demo badge is absent', state.badgeAbsent, state.badgeAbsent);
P('normal connection status remains available', Boolean(state.statusText), state.statusText);

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
