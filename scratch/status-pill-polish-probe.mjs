// Regression probe: status indicator polish requests from Frank
// (2026-07-21, revised same day after a follow-up look).
// 1. #h-status was first made a translucent frosted pill (matching the
//    header) — then Frank asked for it to go the OTHER way: just a plain
//    dot + text, not styled or behaving like a button at all, and NOT
//    clickable (its old click-to-open popover duplicated info already in
//    Device & Settings > MIDI diagnostics, so the popover was removed
//    entirely). #h-status is now a bare <span>, no background, no
//    backdrop-filter, no onclick, no #connection-popover in the DOM.
// 2. The error-state dot (.h-status-dot.err) used var(--danger), a dark
//    brick red in light mode (#b42318) that looked "too dark" next to
//    the vivid fader red (#e45745) — switched to var(--red) so it always
//    matches the fader color in both themes (--red has no dark override).
// 3. The "device connected" text auto-collapse-after-3s feature
//    (documented in the project history as already shipped 2026-07-13)
//    had no actual trigger in the code — CSS supported .hidden but
//    nothing ever added the class. renderConnState() now starts a 3s
//    timer on the DISCONNECTED->LIVE transition only (not on every
//    re-render while already live), and clears it on any other
//    transition so a stale timeout can't hide an unrelated later state.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await p.evaluate(() => skipWelcome());
await new Promise(r => setTimeout(r, 200));

const status = await p.evaluate(() => {
  const el = document.getElementById('h-status');
  const cs = getComputedStyle(el);
  return {
    tag: el.tagName,
    cursor: cs.cursor,
    backdropFilter: cs.backdropFilter || cs.webkitBackdropFilter,
    hasBackgroundImage: cs.backgroundImage !== 'none',
    hasOnclick: !!el.onclick,
    popoverExists: !!document.getElementById('connection-popover'),
  };
});
P('#h-status is a plain span, not a button', status.tag === 'SPAN', JSON.stringify(status));
P('#h-status has no click handler', status.hasOnclick === false, JSON.stringify(status));
P('#h-status has no pointer cursor (not clickable-looking)', status.cursor !== 'pointer', JSON.stringify(status));
P('#h-status has no pill background/backdrop-filter (plain dot+text, not a chip)', !/blur/.test(status.backdropFilter) && !status.hasBackgroundImage, JSON.stringify(status));
P('the connection popover no longer exists in the DOM', status.popoverExists === false, JSON.stringify(status));

const dotAndRed = await p.evaluate(() => {
  _midiState = 'denied'; _ffConnected = false; _serialPort = null;
  renderConnState();
  const dotColor = getComputedStyle(document.getElementById('h-status-dot')).backgroundColor;
  const redVar = getComputedStyle(document.body).getPropertyValue('--red').trim();
  return { dotColor, redVar };
});
P('error-state dot matches the fader red exactly', dotAndRed.dotColor === 'rgb(228, 87, 69)', JSON.stringify(dotAndRed));

const liveSeq = await p.evaluate(async () => {
  _midiState = 'granted'; _ffConnected = true; _serialPort = {};
  renderConnState();
  const txt = document.getElementById('h-status-text');
  const immediately = txt.classList.contains('hidden');
  await new Promise(r => setTimeout(r, 3200));
  const after3s = txt.classList.contains('hidden');
  return { immediately, after3s };
});
P('"device connected" text is visible right when it becomes live', liveSeq.immediately === false, JSON.stringify(liveSeq));
P('"device connected" text auto-collapses after ~3s', liveSeq.after3s === true, JSON.stringify(liveSeq));

// No-regression: re-rendering while still live must not keep resetting/re-triggering the timer weirdly
const stability = await p.evaluate(async () => {
  const txt = document.getElementById('h-status-text');
  renderConnState(); renderConnState();   // still CONNECTED_LIVE, no transition
  return txt.classList.contains('hidden');
});
P('repeated renders while already live keep the text collapsed (no re-open)', stability === true, String(stability));

// Leaving live state clears any pending timer and un-hides immediately
const disconnectSeq = await p.evaluate(async () => {
  _midiState = 'granted'; _ffConnected = false; _serialPort = null;
  renderConnState();
  return document.getElementById('h-status-text').classList.contains('hidden');
});
P('leaving the live state immediately un-hides the text', disconnectSeq === false, String(disconnectSeq));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
