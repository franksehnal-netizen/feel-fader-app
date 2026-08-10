// Regression: clicking a section header's expand/collapse control with the
// mouse must not steal focus onto the freshly re-rendered toggle button —
// toggleSection() re-focuses it unconditionally on every call today, which
// moves focus to the button after ANY click, mouse or keyboard alike
// (confirmed empirically 2026-08-10: document.activeElement becomes the
// toggle button after a plain Puppeteer .click() on unmodified code). The
// fix only re-focuses on keyboard-driven activation — a click event with
// detail === 0 (verified empirically: a real Puppeteer mouse click reports
// event.detail === 1; a keyboard Enter press on a focused button reports
// event.detail === 0). This probe checks document.activeElement directly
// rather than the :focus-visible CSS pseudo-class: :focus-visible did not
// reliably distinguish mouse vs. keyboard focus for CDP-dispatched clicks
// in headless Chrome during manual verification (it read false in both
// cases, before AND after the fix), so it can't discriminate this bug —
// activeElement identity is the concrete, deterministic thing the fix
// actually changes.
// Spec: 2026-08-10-todo-batch-design.md §2.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await p.evaluate(() => { skipWelcome(); });
await new Promise(r => setTimeout(r, 300));

// Real mouse click on the macro section's expand button. Nothing should be
// focused beforehand, so a positive result can't be a leftover from setup.
await p.evaluate(() => document.activeElement?.blur());
const macroToggle = await p.$('#section-toggle-0-macro');
await macroToggle.click();
await new Promise(r => setTimeout(r, 100));
const afterMouseClick = await p.evaluate(() => document.activeElement?.id || null);
P('mouse click does not move focus onto the section toggle', afterMouseClick !== 'section-toggle-0-macro', `activeElement=${afterMouseClick}`);

// Keyboard activation must still move focus there (no regression). Focus
// the button via JS first (simulating arrival by Tab), then press Enter —
// a real Enter-on-a-focused-button click, which reports event.detail === 0.
await p.evaluate(() => { document.activeElement?.blur(); document.getElementById('section-toggle-0-macro').focus(); });
await p.keyboard.press('Enter');
await new Promise(r => setTimeout(r, 100));
const afterEnter = await p.evaluate(() => document.activeElement?.id || null);
P('keyboard Enter still moves focus onto the section toggle', afterEnter === 'section-toggle-0-macro', `activeElement=${afterEnter}`);

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
