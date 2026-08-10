// Regression: "Live positions unavailable — MIDI not connected" must sit
// vertically centered in the gap between the header and the controller, not
// flush against the controller with all the whitespace above it. Measured
// 2026-08-10: note was flush against #device-home (0px gap below), leaving
// the full 38px gap above it.
// Spec: 2026-08-10-todo-batch-design.md §6.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.setViewport({ width: 1280, height: 900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });

const r = await p.evaluate(async () => {
  skipWelcome();
  await new Promise(res => setTimeout(res, 200));
  // Force CONNECTED_BLIND-equivalent visibility the same way renderConnState() would.
  const note = document.getElementById('live-note');
  note.hidden = false;
  positionLiveNote();
  await new Promise(res => setTimeout(res, 50));
  const header = document.querySelector('header').getBoundingClientRect();
  const deviceHome = document.getElementById('device-home').getBoundingClientRect();
  const n = note.getBoundingClientRect();
  const gapAbove = n.top - header.bottom;
  const gapBelow = deviceHome.top - n.bottom;
  return { gapAbove, gapBelow };
});

P('roughly equal whitespace above and below the note', Math.abs(r.gapAbove - r.gapBelow) < 3,
  `above=${r.gapAbove.toFixed(1)} below=${r.gapBelow.toFixed(1)}`);

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
