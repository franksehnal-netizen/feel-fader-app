// Regression probe (UX audit 2026-09-25, F-3): an articulation is a VALUE
// (0–127) sent on the roller's CC, not a CC number. The add field, chip
// accessible names and the unnamed-value fallback must say "value", never "CC".
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' – '+x:''}`);
const p = await b.newPage();
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await p.evaluate(() => skipWelcome());

const r = await p.evaluate(() => {
  const unnamed = [...Array(128).keys()].find(v => !UACC_NAMES[v]);
  cfg.banks[0].uacc_values = [1, unnamed];
  _openSections.clear(); _openSections.add('roller'); render();
  const input = document.getElementById('uacc-input');
  const chips = [...document.querySelectorAll('#uacc-grid [aria-label]')].map(el => el.getAttribute('aria-label')).filter(l => /position/.test(l));
  const labels = [...document.querySelectorAll('#uacc-grid .uacc-label')].map(el => el.textContent);
  const cs = getComputedStyle(input), ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `${cs.fontSize} ${cs.fontFamily}`;
  const fit = { inner: input.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), text: ctx.measureText(input.placeholder).width };
  return { unnamed, fallback: uaccName(unnamed), placeholder: input?.placeholder, aria: input?.getAttribute('aria-label'), chips, labels, fit };
});
P('add field placeholder says Value, not CC', /^Value 0–127$/.test(r.placeholder || ''), r.placeholder);
P('placeholder is not clipped by the field width', r.fit.text <= r.fit.inner, JSON.stringify(r.fit));
P('add field accessible name says articulation value', /articulation value/i.test(r.aria || '') && !/\bCC\b/.test(r.aria || ''), r.aria);
P('unnamed articulation falls back to "Value N"', r.fallback === `Value ${r.unnamed}` && r.labels.includes(`Value ${r.unnamed}`), JSON.stringify(r));
P('chip accessible names describe a value, not a CC', r.chips.length === 2 && r.chips.every(l => /value \d+/.test(l) && !/\bCC \d/.test(l)), JSON.stringify(r.chips));
await p.close();
await b.close();
