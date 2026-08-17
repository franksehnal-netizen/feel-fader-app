// Regression probe: a page load with an already-granted serial port (a
// returning user refreshing with their device still plugged in) must
// transition straight from welcome into the app with no ceremony — no
// connectTransitionWelcome() animation, no lingering "Continue without
// device" skip link, no #welcome-screen.connecting window. That celebratory
// ~1100ms reveal is reserved for a deliberate "Connect & load" click
// (doStart() -> hideWelcome()), which this probe does NOT exercise.
// Frank 2026-08-16: "problikne Continue without device" between "Connect &
// load" and "Send to device" on refresh.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

const r = await p.evaluate(async () => {
  showWelcome();   // matches real bootstrap: shown before MIDI/serial detection resolves
  await new Promise(requestAnimationFrame);
  const skipVisibleBefore = getComputedStyle(document.querySelector('.welcome-skip')).display !== 'none';

  navigator.serial.getPorts = async () => [{}];
  window.serialReadInfo = async () => { protocolVersion = 2; DEVICE_INFO.config_source = 'nvm'; return {}; };
  window.loadConfigFromDevice = async () => {};
  dirty = false;
  localStorage.removeItem('ff-config-hash');

  const ws = document.getElementById('welcome-screen');
  const timers1100 = [];
  const origSetTimeout = window.setTimeout;
  window.setTimeout = function(fn, delay, ...args) {
    if (delay === 1100 || delay === 720) timers1100.push(delay);
    return origSetTimeout.call(window, fn, delay, ...args);
  };

  await onDeviceConnected();

  window.setTimeout = origSetTimeout;

  const btn = document.getElementById('send-btn');
  return {
    skipVisibleBefore,
    wsHiddenImmediately: ws.classList.contains('hidden'),
    everWentConnecting: ws.classList.contains('connecting'),
    celebrationTimersScheduled: timers1100,
    btnText: btn.textContent.trim(),
  };
});

// getComputedStyle(#send-btn).opacity reads stale if checked in the same
// task as the mutations above (headless-only :has()-invalidation timing
// artifact — confirmed it settles correctly once checked after a real
// wait). #send-btn also inherits skipWelcome()'s existing (pre-existing,
// unchanged) quick .28s opacity transition on the 0->1 hop inside
// finalizeWelcomeExit()/finishWelcomeInstant() — nowhere near the 1100ms
// celebration, but not instant either. Wait past both before asserting.
await new Promise(res => setTimeout(res, 400));
const btnOpacity = await p.evaluate(() => getComputedStyle(document.getElementById('send-btn')).opacity);

P('skip link was visible in the pre-detection paint (expected/unavoidable, sets up the regression check below)', r.skipVisibleBefore === true, JSON.stringify(r));
P('welcome screen is hidden the instant onDeviceConnected() resolves — no animated wait', r.wsHiddenImmediately === true, JSON.stringify(r));
P('welcome screen never enters .connecting (no celebratory reveal for a silent reconnect)', r.everWentConnecting === false, JSON.stringify(r));
P('no 1100ms/720ms celebration timers were scheduled', r.celebrationTimersScheduled.length === 0, JSON.stringify(r.celebrationTimersScheduled));
P('send button reflects final app state ("Send to device") immediately, not still "Connect & load"', r.btnText === 'Send to device', r.btnText);
P('send button reaches full opacity well within its .28s transition (no 1100ms wait)', btnOpacity === '1', btnOpacity);

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
