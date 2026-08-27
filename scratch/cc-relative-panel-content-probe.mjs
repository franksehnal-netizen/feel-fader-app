// cc_relative's panel must show only channel/CC controls (like the left
// half of the Articulation panel) — no articulation list, no keyswitch
// note editor. Spec §4.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });

const r = await p.evaluate(() => {
  skipWelcome();
  activeBank = 0;
  cfg.banks[0].roller_mode = 'cc_relative';
  cfg.banks[0].encoder = { cc: 40, channel: 2 };
  render();
  const content = document.getElementById('roller-mode-content-0');
  return {
    hasUaccGrid: !!content.querySelector('#uacc-grid'),
    hasKsInput: !!content.querySelector('[id^="ks-note-input-"]'),
    chValue: document.getElementById('b0-encoder-ch')?.value,
    ccValue: document.getElementById('b0-encoder-cc')?.value,
    mentionsStepper: /Keyswitch Stepper/.test(content.textContent),
  };
});
P('cc_relative panel has no articulation list', r.hasUaccGrid === false, JSON.stringify(r));
P('cc_relative panel has no keyswitch note input', r.hasKsInput === false, JSON.stringify(r));
P('cc_relative panel shows the configured channel (2 -> displayed 3)', r.chValue === '3', JSON.stringify(r));
P('cc_relative panel shows the configured CC (40)', r.ccValue === '40', JSON.stringify(r));
P('cc_relative panel explains where the note list lives', r.mentionsStepper === true, JSON.stringify(r));
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
