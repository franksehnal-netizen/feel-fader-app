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
// 3. UPDATED 2026-07-22 (UX audit finding S-1): the "device connected"
//    text auto-collapse-after-3s feature added here on 2026-07-21 turned
//    out to leave desktop with only a bare 7px dot and no label — the
//    audit's own WEBAPP.md-described "clickable overview" fallback never
//    existed in code either. renderConnState() no longer starts any
//    collapse timer; the text stays visible on desktop for as long as the
//    device stays connected. (Mobile is unaffected either way — a
//    separate, unconditional CSS rule keeps #h-status-text visually
//    hidden there regardless of this JS.)
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
P('"device connected" text stays visible past 3s (no auto-collapse, per S-1)', liveSeq.after3s === false, JSON.stringify(liveSeq));

// No-regression: re-rendering while still live must not hide the text
const stability = await p.evaluate(async () => {
  const txt = document.getElementById('h-status-text');
  renderConnState(); renderConnState();   // still CONNECTED_LIVE, no transition
  return txt.classList.contains('hidden');
});
P('repeated renders while already live keep the text visible', stability === false, String(stability));

// Leaving live state keeps the text visible (nothing to un-hide anymore)
const disconnectSeq = await p.evaluate(async () => {
  _midiState = 'granted'; _ffConnected = false; _serialPort = null;
  renderConnState();
  return document.getElementById('h-status-text').classList.contains('hidden');
});
P('leaving the live state leaves the text visible', disconnectSeq === false, String(disconnectSeq));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
