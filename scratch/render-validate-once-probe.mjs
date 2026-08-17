// A-2 (final review 2026-08-17): validate() used to be called independently
// up to 9x within a single render() pass (faderSectionContent x2,
// encoderPanel, ccEncoderBody, runValidation, markSectionIssues x2 via
// sectionIssueKeys+banksWithIssues...). render() now computes it once and
// threads it through explicit `errs` parameters (default `= validate()` so
// every other independent caller — doSend, handleDirtyAction,
// focusValidationError, setActiveTab's markSectionIssues() — still gets a
// correct fresh value). This proves the count dropped, and that validate()
// itself still returns fresh, correct results (no caching involved at all).
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

const r = await p.evaluate(() => {
  skipWelcome();
  // Open all sections on the active bank so faderSectionContent/encoderPanel
  // actually render their full body (not just a collapsed header) — matches
  // the real worst-case render() cost this fix targets.
  ['fader1','fader2','roller','macro'].forEach(k => _openSections.add(k));

  const origValidate = validate;
  let calls = 0;
  window.validate = function(...args) { calls++; return origValidate.apply(this, args); };
  render();
  window.validate = origValidate;
  const callsPerRender = calls;

  // Correctness check: an invalid bank must still surface through render()'s
  // downstream consumers (not just validate() itself) after the refactor.
  const savedCfg = cfg;
  cfg = { banks: [{ name:'X', roller_mode:'cc', uacc_values:[1],
    fader1:{cc:NaN, channel:0}, fader2:{cc:1, channel:0}, encoder:{cc:32, channel:0} }] };
  activeBank = 0;
  render();
  const err = document.getElementById('err-b0-fader1')?.textContent || '';
  cfg = savedCfg; activeBank = 0; render();

  return { callsPerRender, invalidBankErrText: err };
});

P('validate() called at most once per render() (was up to 9x)', r.callsPerRender <= 1, `callsPerRender=${r.callsPerRender}`);
P('render() still surfaces a real validation error to the DOM after the refactor', r.invalidBankErrText.length > 0, JSON.stringify(r));
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
