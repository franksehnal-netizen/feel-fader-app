// Regression probe: the small physical BUTTON hotspot must have a practical
// mouse target and directly light the matching settings section.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' — '+x:''}`);
const p = await b.newPage();
await p.setViewport({ width:1280, height:900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await p.evaluate(() => skipWelcome());
const zone = await p.$('#zone-macro');
const rect = await zone.boundingBox();
// This point is deliberately outside the tiny rendered macro dot but inside
// its invisible 28px hotspot.
await p.mouse.move(rect.x + rect.width / 2, rect.y - 6);
await new Promise(resolve => setTimeout(resolve, 80));
const on = await p.evaluate(() => ({
  target: document.elementFromPoint(
    document.getElementById('zone-macro').getBoundingClientRect().left + 4,
    document.getElementById('zone-macro').getBoundingClientRect().top - 6
  )?.id,
  zoneLinked: document.getElementById('zone-macro').classList.contains('fader-linked'),
  sectionLinked: document.querySelector('.bank-section[data-fader="macro"]')?.classList.contains('fader-linked'),
}));
P('BUTTON hotspot catches a normal hover outside its tiny rendered dot', on.target === 'zone-macro' && on.zoneLinked && on.sectionLinked, JSON.stringify(on));
await p.mouse.move(20, 20);
await new Promise(resolve => setTimeout(resolve, 80));
const off = await p.evaluate(() => ({
  zoneLinked: document.getElementById('zone-macro').classList.contains('fader-linked'),
  sectionLinked: document.querySelector('.bank-section[data-fader="macro"]')?.classList.contains('fader-linked'),
}));
P('BUTTON hover link clears on mouse leave', !off.zoneLinked && !off.sectionLinked, JSON.stringify(off));
await p.close();
await b.close();
