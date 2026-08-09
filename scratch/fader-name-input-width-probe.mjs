// Regression probe: the inline fader-name input is sized to its own text, so
// the empty space to the right of the name belongs to the section header
// (= expands the section) instead of starting a rename. Frank, HW test
// 2026-08-08 — spec 2026-08-08-ui-backlog-design.md §B.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.setViewport({ width: 1280, height: 900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.evaluate(() => { skipWelcome(); });
await new Promise(r => setTimeout(r, 300));

const m = await p.evaluate(() => {
  const inp = document.getElementById('section-title-0-fader1');
  const cs  = getComputedStyle(inp);
  const span = document.createElement('span');
  span.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${cs.font}`;
  span.textContent = inp.value;
  document.body.appendChild(span);
  const textW = span.getBoundingClientRect().width;
  span.remove();
  const r = inp.getBoundingClientRect();
  const head = inp.closest('.section-head').getBoundingClientRect();
  return { value: inp.value, inputW: r.width, textW, right: r.right, midY: r.top + r.height/2, headRight: head.right };
});

P('input is sized to its text (<= text + 24px)', m.inputW <= m.textW + 24,
  `"${m.value}" input ${m.inputW.toFixed(1)}px vs text ${m.textW.toFixed(1)}px`);
P('input leaves free header space to its right', m.headRight - m.right > 40,
  `${(m.headRight - m.right).toFixed(1)}px free`);

const hitRight = await p.evaluate(([x,y]) => {
  const el = document.elementFromPoint(x,y);
  return { tag: el?.tagName, isInput: el?.id === 'section-title-0-fader1' };
}, [m.right + 30, m.midY]);
P('clicking right of the name does not hit the input', !hitRight.isInput, hitRight.tag);

await p.evaluate(([x,y]) => { document.elementFromPoint(x,y).click(); }, [m.right + 30, m.midY]);
await new Promise(r => setTimeout(r, 200));
const opened = await p.evaluate(() => isSectionOpen('fader1'));
P('clicking right of the name expands the section', opened, String(opened));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
