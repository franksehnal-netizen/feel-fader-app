// Regression probe: realtime fader movement is frame-coalesced but must not
// add CSS easing latency, and diagnostics must not allocate per fader CC.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' — '+x:''}`);
const p = await b.newPage();
await p.setViewport({ width:1280, height:900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await p.evaluate(() => skipWelcome());
const result = await p.evaluate(async () => {
  _ffConnected = true; _midiState = 'granted';
  const thumb = document.getElementById('thumb-l');
  const faderFill = document.getElementById('live-f1-item');
  const thumbStyle = getComputedStyle(thumb);
  const fillStyle = getComputedStyle(faderFill, '::before');
  const cc = cfg.banks[liveBank].fader1.cc;
  const ch = cfg.banks[liveBank].fader1.channel;
  const originalArrayFrom = Array.from;
  let diagnosticArrayCopies = 0;
  Array.from = function(value, ...args) {
    if (value instanceof Uint8Array) diagnosticArrayCopies++;
    return originalArrayFrom.call(this, value, ...args);
  };
  for (let value = 0; value < 40; value++) {
    onMidiMsg({ data:new Uint8Array([0xB0 | ch, cc, value]), timeStamp:performance.now() });
  }
  Array.from = originalArrayFrom;
  await new Promise(resolve => setTimeout(resolve, 40));
  return {
    thumbTransitionDuration: thumbStyle.transitionDuration,
    thumbTransitionProperty: thumbStyle.transitionProperty,
    fillTransitionProperty: fillStyle.transitionProperty,
    diagnosticArrayCopies,
    liveValue: liveValues.f1,
  };
});
P('live controller thumb has no CSS transform catch-up transition', result.thumbTransitionDuration === '0s' && result.thumbTransitionProperty === 'all', JSON.stringify(result));
P('Live HUD fader fill does not animate its transform', !result.fillTransitionProperty.includes('transform'), result.fillTransitionProperty);
P('high-rate fader diagnostics avoid per-message allocations', result.diagnosticArrayCopies <= 1, String(result.diagnosticArrayCopies));
P('coalesced fader messages still retain the latest live value', result.liveValue === 39, String(result.liveValue));
await p.close();
await b.close();
