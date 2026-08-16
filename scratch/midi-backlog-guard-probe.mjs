// Regression: high-rate fader MIDI must use a small rAF fast path, throttle
// diagnostic DOM work, and warn once when the browser delivers a sustained
// stale-event backlog (for example with another MIDI monitor open).
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage();
const errors=[]; p.on('pageerror',e=>errors.push(String(e)));
const P=(label,ok,detail='')=>console.log(`${ok?'PASS':'FAIL'}  ${label}${detail?'  — '+detail:''}`);

await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
const result = await p.evaluate(async () => {
  skipWelcome();
  _midiState='granted'; _ffConnected=true; _serialPort={};
  liveBank=0; activeBank=0; liveSeen.f1=false; liveValues.f1=0;
  renderConnState(); renderLiveStrip();

  let diagnosticRenders=0;
  const originalDiagnosticRender=renderMidiDiagnostics;
  renderMidiDiagnostics=(...args)=>{ diagnosticRenders++; return originalDiagnosticRender(...args); };
  let fullHudRenders=0;
  const originalFullHudRender=renderLiveStrip;
  renderLiveStrip=(...args)=>{ fullHudRenders++; return originalFullHudRender(...args); };

  const now=performance.now();
  for(let i=0;i<100;i++) onMidiMsg({data:new Uint8Array([0xB0,11,i%128]),receivedTime:now});
  await new Promise(r=>setTimeout(r,320));
  const valueAfterBurst=document.getElementById('live-f1-value').textContent;

  document.getElementById('toasts').replaceChildren();
  const stale=performance.now()-500;
  for(let i=0;i<3;i++) onMidiMsg({data:new Uint8Array([0xB0,11,100+i]),receivedTime:stale});
  await new Promise(r=>setTimeout(r,30));
  const warningText=document.getElementById('toasts').textContent;
  for(let i=0;i<3;i++) onMidiMsg({data:new Uint8Array([0xB0,11,110+i]),receivedTime:stale});
  await new Promise(r=>setTimeout(r,30));
  const warningCount=[...document.querySelectorAll('#toasts .toast')].filter(el=>el.textContent.includes('MIDI is delayed')).length;

  renderMidiDiagnostics=originalDiagnosticRender;
  renderLiveStrip=originalFullHudRender;
  return {diagnosticRenders,fullHudRenders,valueAfterBurst,warningText,warningCount};
});

P('100 fader CC events coalesce to at most two diagnostic DOM renders', result.diagnosticRenders <= 2, String(result.diagnosticRenders));
P('fader burst avoids the full live-HUD render path', result.fullHudRenders === 0, String(result.fullHudRenders));
P('latest fader value reaches the HUD after the burst', result.valueAfterBurst === '99', result.valueAfterBurst);
P('sustained stale MIDI events show actionable guidance', result.warningText.includes('close other MIDI monitor tabs or apps'), result.warningText);
P('backlog warning is cooldown-limited to one toast', result.warningCount === 1, String(result.warningCount));
P('no page errors', errors.length===0, errors.join(' | '));
await b.close();
