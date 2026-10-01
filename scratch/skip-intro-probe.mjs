// "Continue without device" intro (Frank 2026-10-01):
// - the button plays the Connect & load intro (welcome dissolves, controller
//   glides, app chrome reveals) instead of an instant cut, greeted with a
//   nameless "Welcome";
// - a hover held through the intro (the cursor resting where the still-hidden
//   sections land) must not light the controller until the app is on screen,
//   and then it does.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  – '+x:''}`);
const wait = ms => new Promise(r => setTimeout(r, ms));
await p.emulateMediaFeatures([{ name:'prefers-reduced-motion', value:'no-preference' }]);
await p.setViewport({ width:1512, height:900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await wait(600);

const state = () => p.evaluate(() => {
  const ws = document.getElementById('welcome-screen');
  const g = document.getElementById('owner-greeting');
  const skip = document.querySelector('.welcome-skip');
  return {
    connecting: ws.classList.contains('connecting'), hidden: ws.classList.contains('hidden'),
    reveal: document.body.classList.contains('app-reveal') || document.body.classList.contains('app-reveal-pending'),
    greeting: g ? { text: g.textContent, pre: !!g.querySelector('.owner-greeting-pre') } : null,
    skipOpacity: skip ? +getComputedStyle(skip).opacity : null,
    linked: document.querySelectorAll('.fader-linked').length,
  };
});

await p.click('.welcome-skip');
// The sections slide in under a resting cursor mid-intro – same as a mouseenter.
await p.evaluate(() => { hoverFaderLink('fader1', true); skipWelcome({ intro:true }); });   // + a double click
await wait(350);
const s1 = await state();
P('the button starts the intro instead of an instant cut', s1.connecting && !s1.hidden && s1.reveal, JSON.stringify(s1));
P('greeted with a nameless "Welcome"', s1.greeting?.text === 'Welcome' && !s1.greeting.pre, JSON.stringify(s1.greeting));
P('"Continue without device" fades out with the welcome', s1.skipOpacity < 0.1, String(s1.skipOpacity));
P('no controller highlight from hover during the intro', s1.linked === 0, String(s1.linked));
await wait(1500);   // ≈ 1.85 s: mid-glide, chrome still held for the greeting
const s2 = await state();
P('still no highlight while the app chrome is held', s2.linked === 0 && s2.reveal, JSON.stringify(s2));
await wait(3600);   // ≈ 5.45 s: greeting gone (3.3 s) + chrome in (1.3 s)
const s3 = await state();
P('intro ends in the app', s3.hidden && !s3.reveal && !s3.greeting, JSON.stringify(s3));
P('the held hover lights the controller once the app is on screen', s3.linked > 0, String(s3.linked));
const out = await p.evaluate(() => { hoverFaderLink('fader1', false); return document.querySelectorAll('.fader-linked').length; });
P('leaving clears it as usual', out === 0, String(out));

P('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
