// Regression: dragging/swiping horizontally over the welcome-screen tips
// carousel changes beats (in addition to the existing dot clicks, which
// must keep working). A swipe below the ~40px threshold is a no-op. Dots
// remain a working alternative input. Spec: 2026-08-10-todo-batch-design.md §9.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.setViewport({ width: 1280, height: 900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await p.evaluate(() => { localStorage.removeItem('ff-onboarded'); showWelcome(); });
await new Promise(r => setTimeout(r, 200));

const startBeat = await p.evaluate(() => _onbBeat);
P('onboarding starts at beat 0', startBeat === 0, String(startBeat));

// Swipe left (drag right-to-left) past the threshold -> advances to beat 1.
const beats = await p.$('#onb-beats');
const box = await beats.boundingBox();
const cy = box.y + box.height / 2;
await p.mouse.move(box.x + box.width - 20, cy);
await p.mouse.down();
await p.mouse.move(box.x + 20, cy, { steps: 10 });
await p.mouse.up();
await new Promise(r => setTimeout(r, 250));
const afterSwipe = await p.evaluate(() => _onbBeat);
P('swipe past threshold advances to the next beat', afterSwipe === 1, `beat=${afterSwipe}`);

// Small drag below threshold -> no change.
await p.mouse.move(box.x + box.width / 2, cy);
await p.mouse.down();
await p.mouse.move(box.x + box.width / 2 - 10, cy, { steps: 3 });
await p.mouse.up();
await new Promise(r => setTimeout(r, 100));
const afterSmallDrag = await p.evaluate(() => _onbBeat);
P('drag below the threshold does not change beat', afterSmallDrag === 1, `beat=${afterSmallDrag}`);

// Dots still work.
await p.evaluate(() => onbBeatGo(0));
await new Promise(r => setTimeout(r, 250));
const dot4 = await p.$('.onb-dot:nth-child(4)');
await dot4.click();
await new Promise(r => setTimeout(r, 250));
const afterDotClick = await p.evaluate(() => _onbBeat);
P('fourth dot navigates to the final beat', afterDotClick === 3, `beat=${afterDotClick}`);

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
