// Regression probe: "Continue without device" (skipWelcome()) must leave
// #send-btn fully functional in the app, same as the real hardware-connect
// path. Before the 2026-07-20 fix, skipWelcome() never called
// handoffPrimaryActionToApp() (unlike connectTransitionWelcome()), so
// #send-btn stayed parented inside the now-hidden #welcome-screen — 0x0,
// invisible, while the neighboring "N unsaved changes" note (a different,
// correctly-relocated element) rendered fine. Reported by Frank via
// screenshot: text visible, button missing. The single-mount welcome/app
// redesign (2026-07-21) replaced handoffPrimaryActionToApp() with
// finalizeWelcomeExit(), which skipWelcome() now calls instead — #send-btn
// was always inside .send-callout immediately after skipWelcome() either
// way, so these assertions hold unchanged under the new architecture.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.setViewport({ width: 390, height: 844 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.evaluate(() => {
  localStorage.removeItem('ff-onboarded');
  skipWelcome();
  cfg.banks[0].fader1.cc = 55; cfg.banks[0].fader2.cc = 56; cfg.banks[0].encoder.cc = 57;
  dirty = true;
  reflectDirty();
  runValidation();
});
await new Promise(r => setTimeout(r, 400));

const state = await p.evaluate(() => {
  const btn = document.getElementById('send-btn');
  const rect = btn ? btn.getBoundingClientRect() : null;
  return {
    inSendCallout: !!btn?.closest('.send-callout'),
    inWelcomeScreen: !!btn?.closest('#welcome-screen'),
    hasWelcomeClasses: btn ? (btn.classList.contains('welcome-start') || btn.classList.contains('show')) : null,
    width: rect?.width, height: rect?.height,
    text: btn?.textContent,
  };
});
P('#send-btn moved out of the welcome screen into .send-callout', state.inSendCallout && !state.inWelcomeScreen, JSON.stringify(state));
P('#send-btn no longer carries welcome-start/show classes', state.hasWelcomeClasses === false, JSON.stringify(state));
P('#send-btn renders with non-zero size', state.width > 0 && state.height > 0, `${state.width}x${state.height}`);
P('#send-btn shows "Send to device" alongside the change count', state.text === 'Send to device', state.text);

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
