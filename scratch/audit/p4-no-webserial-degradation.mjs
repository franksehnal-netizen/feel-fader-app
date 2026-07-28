// Regression probe: first-impression graceful degradation for Safari/Firefox
// visitors (no navigator.serial, no navigator.requestMIDIAccess — deleted
// BEFORE the page loads via evaluateOnNewDocument, simulating a non-Chromium
// browser). The app is Chrome/Edge-only (Web Serial + Web MIDI). This checks
// what the user sees on the WELCOME SCREEN — the first thing rendered on
// load, before any Send — NOT the doSend() path, which is already covered by
// scratch/send-without-web-serial-probe.mjs.
//
// Feature-detect grep of feel-fader.html found:
//  - `if(!navigator.requestMIDIAccess){ _midiState='unsupported'; ... }` (~4097)
//    — MIDI-only, drives the header connection-status pill, not the welcome screen.
//  - `if (!navigator.serial) throw new Error('Web Serial not supported...')` (~4365)
//    and `toast('e','Web Serial not supported...')` (~4589) — both fire only
//    from doSend()/loadConfigFromDevice(), i.e. AFTER the user already acted.
//  - `data-i18n="footer.compat"` → "Works with Chrome & Edge · Web Serial &
//    Web MIDI required" (~1953) — static text, always in the DOM, but it
//    lives in <footer> inside <main>, BEHIND the fixed, full-viewport
//    #welcome-screen overlay (z-index 200, position:fixed inset:0) shown on
//    load. It is never rendered inside #welcome-screen itself.
//  - #welcome-screen's own markup (wordmark, onboarding beats, "Continue
//    without device" skip button, #welcome-start-msg status line) has no
//    browser-support conditional anywhere.
//
// So the "readable message" assertion below is scoped to #welcome-screen's
// own innerText (the actual first impression), not document.body as a whole.
// Checking body.innerText would trivially PASS on the footer's hidden
// "Chrome & Edge" string even though a visitor cannot see it until they
// dismiss/pass the overlay — that would mask the real finding.

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.evaluateOnNewDocument(()=>{
  try { Object.defineProperty(navigator,'serial',{value:undefined,configurable:true}); } catch(e){}
  try { navigator.requestMIDIAccess = undefined; } catch(e){}
});
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
await new Promise(r=>setTimeout(r,500));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

const res = await p.evaluate(() => {
  const ws = document.getElementById('welcome-screen');
  const wsVisible = !!ws && !ws.classList.contains('hidden');
  const wsText = ws ? ws.innerText : '';
  const bodyText = document.body.innerText;
  const re = /chrome|edge|not supported|unsupported|nepodporov/i;
  return {
    uiAlive: !!document.querySelector('main, #welcome-screen, header'),
    wsVisible,
    wsText,
    mentionsBrowserInWelcome: re.test(wsText),
    mentionsBrowserAnywhereOnPage: re.test(bodyText),
  };
});

P('UI žije i bez Web Serial/MIDI (žádná mrtvá stránka)', res.uiAlive === true, JSON.stringify({ uiAlive: res.uiAlive, wsVisible: res.wsVisible }));
P('welcome screen (první dojem) je zobrazený', res.wsVisible === true, JSON.stringify({ wsVisible: res.wsVisible }));
P('uživatel dostane NA WELCOME SCREENU čitelnou hlášku o prohlížeči', res.mentionsBrowserInWelcome === true,
  `welcome text: ${JSON.stringify(res.wsText)} | (info) match anywhere on page incl. hidden footer: ${res.mentionsBrowserAnywhereOnPage}`);
P('žádná neodchycená page error', errs.length === 0, errs.join(' | '));

await b.close();
