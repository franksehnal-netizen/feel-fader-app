// Regression probe: the live-hud L/R fader value numbers ("127", "86")
// sat with almost no gap under their vertical meter bars on desktop —
// reported by Frank from a screenshot (2026-07-20). Root cause:
// .live-hud-item's nested grid gives the meter's row `minmax(0,1fr)` —
// a flexible track sized from LEFTOVER space in the fixed-size (112x112
// desktop) widget, NOT from the meter's own explicit height. The bar's
// CSS height (32px) was larger than that leftover track (~20.75px), so
// the bar overflowed straight into the value row below it (measured gap
// was actually NEGATIVE, -0.6px — the number overlapped the bar).
// Fixed by shrinking the bar's explicit height (32px -> 16px) to fit
// within its actual available desktop track, which also happens to
// exactly satisfy mobile-ux-probe.mjs's pre-existing "meter must be at
// least 4x taller than wide" aspect-ratio check (16 = 4x4).
//
// The mobile (<=980px) breakpoint's meter height is left at its
// original 17px: its track is even smaller there (~14.75px), so
// shrinking the bar enough to add real slack would drop it below that
// 4x aspect-ratio floor and fail mobile-ux-probe.mjs. Desktop was the
// reported case (Frank's screenshot); mobile is unchanged, not "fixed".
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.setViewport({ width: 1280, height: 900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const r = await p.evaluate(() => {
  skipWelcome();
  _ffConnected = true; _midiState = 'granted';
  liveValues.f1 = 127; liveSeen.f1 = true;
  liveValues.f2 = 86; liveSeen.f2 = true;
  renderLiveStrip();
  const meter = document.getElementById('live-f1-meter').closest('.live-hud-meter');
  const value = document.getElementById('live-f1-value');
  const mr = meter.getBoundingClientRect();
  return { gap: value.getBoundingClientRect().top - mr.bottom, meterHeight: mr.height, meterWidth: mr.width };
});

P('desktop: meter-to-value gap is a real, visible gap (>= 3px, was -0.6px)', r.gap >= 3, String(r.gap));
P('desktop: meter bar keeps its tall/thin identity (height >= 4x width)', r.meterHeight >= r.meterWidth * 4, `${r.meterHeight} / ${r.meterWidth}`);
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
