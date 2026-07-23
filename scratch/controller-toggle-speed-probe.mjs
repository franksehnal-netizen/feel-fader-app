import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/Fanda Borec/Documents/feel-fader-app/node_modules/puppeteer-core');

const URL = 'http://localhost:8100/feel-fader.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const P = (l, ok, x='') => console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

const b = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, args: ['--no-sandbox'] });
const p = await b.newPage();
// Explicitly set prefers-reduced-motion to no-preference for the first two tests
await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
await p.goto(URL, { waitUntil: 'networkidle0' });
await p.evaluate(() => { try{skipWelcome && skipWelcome()}catch(e){} });

const durations = await p.evaluate(() => {
  const wrap = getComputedStyle(document.getElementById('stage-collapse'));
  const inner = getComputedStyle(document.querySelector('#stage-collapse > .stage'));
  return { wrapTransition: wrap.transitionDuration, innerTransition: inner.transitionDuration };
});
P('Container transition is 0.9s', durations.wrapTransition === '0.9s', durations.wrapTransition);
P('Inner .stage transition is 0.9s for both properties', durations.innerTransition === '0.9s, 0.9s', durations.innerTransition);

// prefers-reduced-motion still collapses to `none`.
const reduced = await p.evaluate(async () => {
  const style = document.createElement('style');
  style.textContent = '@media(prefers-reduced-motion:no-preference){}'; // no-op, real check is emulated by Puppeteer below
  return true;
});
await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
const reducedDuration = await p.evaluate(() => getComputedStyle(document.getElementById('stage-collapse')).transitionDuration);
P('prefers-reduced-motion still disables the transition', reducedDuration === '0s', reducedDuration);

await p.close();
await b.close();
