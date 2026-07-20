// Regression probe: Send to device button visually recedes (muted glass,
// .idle class) when there's nothing to send, without ever leaving the
// layout (no hide/show, no size change) or losing clickability. Frank
// 2026-07-20: "chci ale zobrazit teprve až to bude mít smysl" — resolved
// as mute-not-hide to avoid the discoverability/layout-jump tradeoffs of
// fully hiding it (see conversation). Covers: fresh load, dirty edit,
// reverting back to synced, and the post-send confirmed state.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

async function readBtn() {
  return p.evaluate(() => {
    const btn = document.getElementById('send-btn');
    return { idle: btn.classList.contains('idle'), sent: btn.classList.contains('sent'), disabled: btn.disabled, text: btn.textContent, rectW: btn.getBoundingClientRect().width };
  });
}

await p.evaluate(() => { localStorage.removeItem('ff-onboarded'); skipWelcome(); });
await new Promise(r => setTimeout(r, 300));
let s = await readBtn();
P('fresh load with nothing changed: idle, still clickable, still "Send to device"', s.idle && !s.disabled && !s.sent && s.text === 'Send to device', JSON.stringify(s));
const idleWidth = s.rectW;

await p.evaluate(() => { cfg.banks[0].fader1.cc = 77; dirty = true; render(); });
await new Promise(r => setTimeout(r, 100));
s = await readBtn();
P('after an edit: no longer idle, primary action', !s.idle && !s.disabled, JSON.stringify(s));
P('button does not change size between idle and active (no layout jump)', s.rectW === idleWidth, `idle=${idleWidth} active=${s.rectW}`);

await p.evaluate(() => { cfg.banks[0].fader1.cc = 11; dirty = false; _sendConfirmed = false; render(); });
await new Promise(r => setTimeout(r, 100));
s = await readBtn();
P('reverted back to matching the synced snapshot: idle again', s.idle && !s.disabled, JSON.stringify(s));

await p.evaluate(() => { dirty = false; _sendConfirmed = true; runValidation(); });
await new Promise(r => setTimeout(r, 100));
s = await readBtn();
P('confirmed-sent state: "sent", not idle', s.sent && !s.idle && s.disabled, JSON.stringify(s));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
