// Regression probe: a remembered but silent DEV-console port must be forgotten
// after Connect & load times out, so the next click opens Chrome's port picker.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const browser = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(label,ok,detail='')=>console.log(`${ok?'PASS':'FAIL'}  ${label}${detail?' – '+detail:''}`);
const page = await browser.newPage();
await page.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });

const result = await page.evaluate(async () => {
  let closed = 0, forgotten = 0;
  _serialPort = {
    readable: {}, writable: {},
    close: async () => { closed++; },
    forget: async () => { forgotten++; },
  };
  const originalLoad = loadConfigFromDevice;
  loadConfigFromDevice = async () => { throw new Error('timeout'); };
  await doStart();
  loadConfigFromDevice = originalLoad;
  return {
    closed, forgotten, portCleared:_serialPort === null,
    button:document.getElementById('send-btn').textContent,
    message:document.getElementById('welcome-start-msg').textContent,
  };
});
P('failed remembered port is closed and forgotten', result.closed === 1 && result.forgotten === 1 && result.portCleared, JSON.stringify(result));
P('retry remains an explicit user action', result.button === 'Try again' && result.message === 'Connection failed', JSON.stringify(result));

// Port held by another tab (Chrome: NetworkError "Failed to open serial port.") –
// say so in the visible line, not only in the tooltip (Frank 2026-10-01).
const busy = await page.evaluate(async () => {
  showStartBtn();
  const originalLoad = loadConfigFromDevice;
  loadConfigFromDevice = async () => { const e = new Error('Failed to open serial port.'); e.name = 'NetworkError'; throw e; };
  await doStart();
  loadConfigFromDevice = originalLoad;
  const msg = document.getElementById('welcome-start-msg');
  return { message: msg.textContent, title: msg.title, clipped: msg.scrollWidth > msg.clientWidth + 1,
           button: document.getElementById('send-btn').textContent };
});
P('busy port names the cause in the visible line', busy.message === 'Port busy – close other Feel Fader tabs' && busy.button === 'Try again', JSON.stringify(busy));
P('busy message fits on one line', busy.clipped === false, JSON.stringify(busy));
P('busy tooltip keeps the full explanation', /Close Feel Fader in other tabs or apps/.test(busy.title), busy.title);
await page.close();
await browser.close();
