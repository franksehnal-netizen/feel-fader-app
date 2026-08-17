// Regression probe: growing the window's height while the onboarding
// overlay is in its scrollable (max-height:820px) layout must not shift the
// title/nav horizontally when the vertical scrollbar disappears (content
// now fits, onb-nav chips come fully into view without scrolling) or when
// the breakpoint itself hands off to the tall/fixed layout. Puppeteer hides
// scrollbars by default, which would mask this regression, so it's
// re-enabled here.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'], ignoreDefaultArgs:['--hide-scrollbars'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.setViewport({ width: 500, height: 700 });
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
await p.evaluate(() => { onbStartWelcome(); });
await new Promise(r => setTimeout(r, 200));

const heights = [700, 730, 760, 790, 820, 850, 880, 910, 940, 970, 1000];
const rows = [];
for (const h of heights) {
  await p.setViewport({ width: 500, height: h });
  await new Promise(r => setTimeout(r, 150));
  const titleCenterX = await p.evaluate(() => {
    const r = document.querySelector('.onb-beat-title').getBoundingClientRect();
    return r.left + r.width / 2;
  });
  rows.push({ h, titleCenterX });
}

let shiftFound = false;
for (let i = 1; i < rows.length; i++) {
  if (Math.abs(rows[i].titleCenterX - rows[i-1].titleCenterX) > 1) shiftFound = true;
}
P('onboarding title stays horizontally centered while growing the window (no scrollbar/breakpoint shift)',
  !shiftFound, JSON.stringify(rows));
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
