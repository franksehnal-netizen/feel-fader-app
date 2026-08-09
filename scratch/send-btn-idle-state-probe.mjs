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

// --- Issue 1 (2026-08-09): clicking Send while nothing changed must not
// celebrate with green "✓ Sent" — the button stays clickable (Frank
// 2026-07-20: "muted, not disabled"), but a no-op send gets a sober inline
// confirmation ("Already in sync") instead of the success color. A real,
// dirty send must still go green — that's the normal path and must not
// regress. Uses the same fake-serial-port poke pattern as
// scratch/audit/p2-serial-robustness.mjs; protocolVersion stays at its
// page-load default of 1 (legacy), so serialRequest('CMD_W', …) resolves
// immediately after write() without needing a fake reply frame.
async function pokeFakeSerialPort() {
  return p.evaluate(() => {
    class FakePort {
      get readable() { return { getReader() { return { read() { return new Promise(() => {}); }, releaseLock() {} }; } }; }
      get writable() { return { getWriter() { return { write() { return Promise.resolve(); }, releaseLock() {} }; } }; }
    }
    protocolVersion = 1;
    _serialPort = new FakePort();
  });
}

await pokeFakeSerialPort();
let sendRes = await p.evaluate(async () => {
  cfg.banks[0].fader1.cc = 55; dirty = true; _sendConfirmed = false; render();
  await doSend();
  const btn = document.getElementById('send-btn');
  const note = document.getElementById('send-change-note');
  return { sent: btn.classList.contains('sent'), idle: btn.classList.contains('idle'), text: btn.textContent, disabled: btn.disabled, noteText: note.textContent };
});
P('sending a genuinely dirty config still turns green "✓ Sent" (normal path unaffected)',
  sendRes.sent && !sendRes.idle && sendRes.text === '✓ Sent' && sendRes.disabled, JSON.stringify(sendRes));

// Return to a synced (nothing-to-send) state the same way the earlier
// "reverted back to matching the synced snapshot" step does, then send again.
await p.evaluate(() => { dirty = false; _sendConfirmed = false; render(); });
s = await readBtn();
const startedIdle = s.idle && !s.disabled;
await pokeFakeSerialPort();
await p.evaluate(async () => { await doSend(); });
// setSendChangeNoteText() swaps an already-visible note's text via a short
// (SEND_NOTE_SWAP_MS = 180ms) fade-out/in rather than an instant textContent
// write, so the readback must happen after that settles, not in the same
// tick doSend() resolves.
await new Promise(r => setTimeout(r, 300));
let noopRes = await p.evaluate(() => {
  const btn = document.getElementById('send-btn');
  const note = document.getElementById('send-change-note');
  return {
    sent: btn.classList.contains('sent'), idle: btn.classList.contains('idle'),
    text: btn.textContent, disabled: btn.disabled,
    noteText: note.textContent, noteVisible: note.classList.contains('is-visible'),
    noteFeedback: note.classList.contains('is-feedback'),
  };
});
P('no-op send starts from the idle (nothing-to-send) state', startedIdle, JSON.stringify(s));
P('no-op send does NOT produce the green "✓ Sent" state', !noopRes.sent && noopRes.text !== '✓ Sent', JSON.stringify(noopRes));
P('no-op send surfaces a quiet "Already in sync" inline confirmation instead',
  noopRes.noteVisible && noopRes.noteFeedback && /already in sync/i.test(noopRes.noteText), JSON.stringify(noopRes));

// --- Issue 2 (2026-08-09): .blocked's hover must read the same as .idle's —
// only the resting-state border stays as the quiet differentiator. Parsed
// against the live stylesheet (not string-matched, not forced via :hover)
// so this fails honestly if either rule's selector or color ever drifts.
const hoverAndBorder = await p.evaluate(() => {
  const rules = [...document.styleSheets].flatMap(sheet => {
    try { return [...sheet.cssRules]; } catch (_) { return []; }
  });
  const find = (selectorText) => rules.find(r => r.selectorText === selectorText);
  const idleHover = find('.send-btn.idle:hover');
  const blockedHover = find('.send-btn.blocked:hover');
  const idleRest = find('.send-btn.idle');
  const blockedRest = find('.send-btn.blocked');
  return {
    idleHoverColor: idleHover ? idleHover.style.color : null,
    blockedHoverColor: blockedHover ? blockedHover.style.color : null,
    idleRestBorder: idleRest ? idleRest.style.border : '',
    blockedRestBorder: blockedRest ? blockedRest.style.border : '',
  };
});
P('.send-btn.blocked:hover color matches .send-btn.idle:hover color',
  !!hoverAndBorder.blockedHoverColor && hoverAndBorder.blockedHoverColor === hoverAndBorder.idleHoverColor,
  JSON.stringify(hoverAndBorder));
P('.send-btn.blocked resting border is still present and distinct from .idle (quiet differentiator survives)',
  !!hoverAndBorder.blockedRestBorder && hoverAndBorder.blockedRestBorder !== hoverAndBorder.idleRestBorder,
  JSON.stringify(hoverAndBorder));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
