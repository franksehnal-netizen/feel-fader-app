// Regression probe: F-01 (functional audit 2026-07-20) — contextual "?" links
// from panels into the Help & Guide accordion, which previously had anchor
// IDs (help-faders, help-hid, ...) that nothing in the app linked to.
// The fader-section and Device & Settings "Keyboard (HID)" "?" buttons were
// removed in TODO #4 (2026-08-10, replaced by hover tooltips) — only the
// hidEnableNotice() "What's this?" link (Navigation roller mode + Button
// Macro panels) still opens the Help panel directly; this probe now covers
// just that surviving call site. openHelpAt() itself is unchanged.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.evaluate(() => { skipWelcome(); });
await new Promise(r => setTimeout(r, 300));

async function checkOpensAt(label, clickFn, anchorId) {
  await p.evaluate(() => { document.getElementById('help-body').style.display = 'none'; document.getElementById('help-chevron').textContent = '▼'; });
  await p.evaluate(clickFn);
  await new Promise(r => setTimeout(r, 250));
  const r = await p.evaluate((anchorId) => {
    const body = document.getElementById('help-body');
    const target = document.getElementById(anchorId);
    const rect = target ? target.getBoundingClientRect() : null;
    return {
      helpOpen: body.style.display !== 'none',
      focused: document.activeElement === target,
      inViewport: rect ? (rect.top >= 0 && rect.top < window.innerHeight) : false,
    };
  }, anchorId);
  P(`${label} opens Help panel and focuses/scrolls to #${anchorId}`, r.helpOpen && r.focused && r.inViewport, JSON.stringify(r));
}

await checkOpensAt(
  '"What\'s this?" link in hidEnableNotice (Navigation mode)',
  () => {
    DEVICE_INFO.hid_enabled = false;
    cfg.banks[activeBank].roller_mode = 'track_nav';
    render();
    document.querySelector('.hid-inline-help').click();
  },
  'help-hid'
);

const noQuestionMarks = await p.evaluate(() => {
  const hidHelp = document.querySelector('.info-row-action button[onclick*="openHelpAt"]');
  const sectionHelp = document.querySelector('.section-head button[onclick*="openHelpAt"]');
  return { hidHelp: !!hidHelp, sectionHelp: !!sectionHelp };
});
P('HID row "?" button is gone (removed by TODO #4)', !noQuestionMarks.hidHelp, String(noQuestionMarks.hidHelp));
P('fader section "?" button is gone (removed by TODO #4)', !noQuestionMarks.sectionHelp, String(noQuestionMarks.sectionHelp));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
