// Regression: hovering a data-tip element for 2s shows a tooltip with its
// text; hovering less than 2s shows nothing; moving away cancels the pending
// timer. The old "?" help-icon buttons (HID row, fader section headers) are
// gone from the DOM. Spec: 2026-08-10-todo-batch-design.md §8.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await p.evaluate(() => { skipWelcome(); toggleDeviceSettings(); });
await new Promise(r => setTimeout(r, 200));

const noQuestionMarks = await p.evaluate(() => {
  const hidHelp = document.querySelector('.info-row-action button[onclick*="openHelpAt"]');
  const sectionHelp = document.querySelector('.section-head button[onclick*="openHelpAt"]');
  return { hidHelp: !!hidHelp, sectionHelp: !!sectionHelp };
});
P('HID row "?" button is gone', !noQuestionMarks.hidHelp, String(noQuestionMarks.hidHelp));
P('fader section "?" button is gone', !noQuestionMarks.sectionHelp, String(noQuestionMarks.sectionHelp));

const hidRow = await p.evaluate(() => !!document.querySelector('.info-row-action[data-tip]'));
P('HID row carries a data-tip attribute', hidRow, String(hidRow));

// Hover for 2.1s -> tooltip should show with the row's own text.
const target = await p.$('.info-row-action[data-tip]');
await target.scrollIntoView(); // row sits below the fold at the default 800x600 viewport
const box = await target.boundingBox();
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await new Promise(r => setTimeout(r, 2100));
const shown = await p.evaluate(() => {
  const tip = document.getElementById('hover-tip');
  return { hidden: tip.hidden, text: tip.textContent, hasShowClass: tip.classList.contains('show') };
});
P('tooltip appears after 2s hover with non-empty text', !shown.hidden && shown.hasShowClass && shown.text.length > 0, JSON.stringify(shown));

// Move away -> tooltip hides.
await p.mouse.move(10, 10);
await new Promise(r => setTimeout(r, 100));
const hiddenAfterLeave = await p.evaluate(() => document.getElementById('hover-tip').hidden);
P('tooltip hides on mouseleave', hiddenAfterLeave, String(hiddenAfterLeave));

// Hover for less than 2s -> tooltip never shows.
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await new Promise(r => setTimeout(r, 500));
await p.mouse.move(10, 10);
await new Promise(r => setTimeout(r, 100));
const neverShown = await p.evaluate(() => document.getElementById('hover-tip').hidden);
P('tooltip does not appear before 2s of hover', neverShown, String(neverShown));

// Regression: tooltip near the bottom of the viewport must flip above the
// trigger instead of rendering fully offscreen below it.
await p.setViewport({ width: 1280, height: 400 });
await target.evaluate(el => el.scrollIntoView({ block: 'end' }));
await new Promise(r => setTimeout(r, 100));
const box2 = await target.boundingBox();
await p.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
await new Promise(r => setTimeout(r, 2100));
const inViewport = await p.evaluate(() => {
  const tip = document.getElementById('hover-tip');
  const r = tip.getBoundingClientRect();
  return { hidden: tip.hidden, top: r.top, bottom: r.bottom, innerHeight: window.innerHeight, within: r.bottom <= window.innerHeight && r.top >= 0 };
});
P('tooltip near viewport bottom stays within the viewport', !inViewport.hidden && inViewport.within, JSON.stringify(inViewport));
await p.mouse.move(10, 10);
await new Promise(r => setTimeout(r, 100));
await p.setViewport({ width: 800, height: 600 });

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
