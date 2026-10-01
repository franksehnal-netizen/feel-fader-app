// Without an explicit cc_relative branch, diagnosticRollerMapping falls
// through to the generic "Articulation" wording — technically the same CC/channel numbers, but a misleading label.
// Spec §4.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  – '+x:''}`);
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });

const r = await p.evaluate(() => {
  skipWelcome();
  cfg.banks[0].roller_mode = 'cc_relative';
  cfg.banks[0].encoder = { cc: 40, channel: 2 };
  const diag = diagnosticRollerMapping(cfg.banks[0]);
  return { diag };
});
P('diagnosticRollerMapping reports "Relative CC · Ch3 · CC40"', r.diag === 'Relative CC · Ch 3 · CC40', r.diag);
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
