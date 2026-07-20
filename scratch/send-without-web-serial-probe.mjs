// Regression probe: clicking Send in a browser without Web Serial support
// (navigator.serial undefined — e.g. Firefox/Safari) used to show a
// misleading "No device on MIDI" info toast and THEN crash inside
// _serialEnsureOpen() with a raw, user-facing JS error ("Send failed:
// undefined is not an object (evaluating 'navigator.serial.requestPort')"),
// reported live from the public demo 2026-07-20. Fixed by guarding both
// doSend() (single clean toast, no attempt) and _serialEnsureOpen() (throws
// a clean Error instead of crashing, protects the other caller
// loadConfigFromDevice() too).
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.evaluate(() => { skipWelcome(); });
await new Promise(r => setTimeout(r, 300));

const result = await p.evaluate(async () => {
  Object.defineProperty(navigator, 'serial', { value: undefined, configurable: true });
  document.getElementById('toasts').innerHTML = '';
  await doSend();
  const messages = [...document.querySelectorAll('#toasts .toast-message')].map(el => el.textContent);
  return { messages };
});

P('exactly one toast shown', result.messages.length === 1, JSON.stringify(result.messages));
P('toast is the clean "not supported" message, not a raw JS error', /Web Serial not supported/.test(result.messages[0] || ''), JSON.stringify(result.messages));
P('no raw TypeError text leaked to the user', !/is not an object|undefined is not/i.test(result.messages.join(' ')), JSON.stringify(result.messages));

const ensureOpenResult = await p.evaluate(async () => {
  try { await _serialEnsureOpen(); return { threw: false }; }
  catch(e) { return { threw: true, message: e.message }; }
});
P('_serialEnsureOpen() throws a clean Error instead of crashing', ensureOpenResult.threw && /Web Serial not supported/.test(ensureOpenResult.message), JSON.stringify(ensureOpenResult));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
