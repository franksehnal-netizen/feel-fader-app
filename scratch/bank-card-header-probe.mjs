// Regression probe (minimal hybrid, spec 2026-09-26 §4): the bank card opens
// with "Bank N of M", a large editable name and a grey "Library setup ·
// Browse…" line; the searchable picker lives in a popover anchored to Browse….
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' – '+x:''}`);
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.setViewport({ width:1440, height:900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await p.evaluate(() => skipWelcome());

const head = await p.evaluate(() => {
  // Start from exactly 3 banks regardless of the default config.
  cfg.banks.splice(1); addBank(); addBank(); activeBank = 1; cfg.banks[1].name = 'Bank 2'; render();
  const card = document.querySelector('.bank-card');
  const name = card.querySelector('.bank-title-input');
  const cs = name && getComputedStyle(name);
  return {
    eyebrow: card.querySelector('.bank-eyebrow')?.textContent.replace(/\s+/g, ' ').trim(),
    deviceHidden: document.getElementById('bank-eyebrow-device')?.hidden,
    nameValue: name?.value, nameSize: cs && parseFloat(cs.fontSize), nameWeight: cs?.fontWeight, maxLength: name?.maxLength,
    iconBtn: !!card.querySelector('.icon-picker-trigger'),
    // label + link only – the hidden popover holds the whole option list
    sub: [...card.querySelectorAll('.bank-quick-setup-label, .library-browse-link')].map(el => el.textContent.trim()).join(' '),
    oldActions: card.querySelectorAll('.bank-actions, .bank-action-btn, .btn-remove-bank').length,
    saveSetupInCard: [...card.querySelectorAll('button')].some(el => el.textContent.trim() === 'Save setup'),
    inputVisible: (() => { const i = document.getElementById('quick-setup-input-1'); return !!i && i.getClientRects().length > 0; })(),
  };
});
P('eyebrow reads "Bank N of M"', /^Bank 2 of 3/.test(head.eyebrow || ''), head.eyebrow);
P('device suffix hidden when not connected', head.deviceHidden === true, String(head.deviceHidden));
P('bank name is the editable display title (20 px since 2026-09-28, 700, 24 chars)', head.nameValue === 'Bank 2' && head.nameSize === 20 && head.nameWeight === '700' && head.maxLength === 24, JSON.stringify(head));
P('bank icon picker stays next to the title', head.iconBtn);
P('subtitle is "Library setup Browse…"', head.sub === 'Library setup Browse…', head.sub);
P('no ‹ › ⧉ × or Save setup above the controls', head.oldActions === 0 && !head.saveSetupInCard, JSON.stringify(head));
P('search field is hidden until Browse…', head.inputVisible === false);

// Keyboard path: Browse… → input focused + menu open → Escape closes menu+popover → focus back on Browse….
await p.focus('#library-browse-1');
await p.keyboard.press('Enter');
await new Promise(r => setTimeout(r, 80));
const opened = await p.evaluate(() => ({
  popover: !document.getElementById('library-popover-1').hidden,
  expanded: document.getElementById('library-browse-1').getAttribute('aria-expanded'),
  focus: document.activeElement?.id,
  menu: !document.getElementById('quick-setup-menu-1').hidden,
  options: document.querySelectorAll('#quick-setup-menu-1 .quick-setup-option').length,
  cardLayer: document.querySelector('.bank-card').classList.contains('quick-menu-open'),
}));
P('Browse… opens the popover with the search focused and the list open', opened.popover && opened.expanded === 'true' && opened.focus === 'quick-setup-input-1' && opened.menu && opened.options > 0 && opened.cardLayer, JSON.stringify(opened));
await p.keyboard.press('Escape');
await new Promise(r => setTimeout(r, 50));
const closed = await p.evaluate(() => ({
  popover: !document.getElementById('library-popover-1').hidden,
  expanded: document.getElementById('library-browse-1').getAttribute('aria-expanded'),
  focus: document.activeElement?.id,
  cardLayer: document.querySelector('.bank-card').classList.contains('quick-menu-open'),
}));
P('Escape closes the popover and returns focus to Browse…', !closed.popover && closed.expanded === 'false' && closed.focus === 'library-browse-1' && !closed.cardLayer, JSON.stringify(closed));

// Keyboard path from an option: Browse… → Enter → ArrowDown (focus on the
// first option) → Escape closes only the list, popover stays open, focus
// returns to the search input → a second Escape (now in the input) closes
// the popover and returns focus to Browse… (controller ruling: keep the
// two-step behaviour, do not collapse it into one Escape).
await p.focus('#library-browse-1');
await p.keyboard.press('Enter');
await new Promise(r => setTimeout(r, 80));
await p.keyboard.press('ArrowDown');
await new Promise(r => setTimeout(r, 50));
const onOption = await p.evaluate(() => document.activeElement?.classList.contains('quick-setup-option'));
await p.keyboard.press('Escape');
await new Promise(r => setTimeout(r, 50));
const afterFirstEscape = await p.evaluate(() => ({
  menu: !document.getElementById('quick-setup-menu-1').hidden,
  popover: !document.getElementById('library-popover-1').hidden,
  focus: document.activeElement?.id,
}));
P('ArrowDown from the search field focuses the first option', onOption === true);
// closeQuickSetupMenu(bi,true) hides the list then calls input.focus(); moving
// focus FROM the option TO the input re-triggers the input's own onfocus
// (openQuickSetupMenu), so the list re-opens in the same tick – an existing
// quirk of closeQuickSetupMenu, not something quickSetupOptionKey controls
// (left unchanged per the controller ruling). Net effect: focus lands back on
// the search input and the popover stays open, same as before this Escape.
P('first Escape returns focus from the option to the search input, popover stays open', afterFirstEscape.popover && afterFirstEscape.menu && afterFirstEscape.focus === 'quick-setup-input-1', JSON.stringify(afterFirstEscape));
await p.keyboard.press('Escape');
await new Promise(r => setTimeout(r, 50));
const afterSecondEscape = await p.evaluate(() => ({
  popover: !document.getElementById('library-popover-1').hidden,
  expanded: document.getElementById('library-browse-1').getAttribute('aria-expanded'),
  focus: document.activeElement?.id,
  cardLayer: document.querySelector('.bank-card').classList.contains('quick-menu-open'),
}));
P('second Escape closes the popover and returns focus to Browse…', !afterSecondEscape.popover && afterSecondEscape.expanded === 'false' && afterSecondEscape.focus === 'library-browse-1' && !afterSecondEscape.cardLayer, JSON.stringify(afterSecondEscape));

// Choosing a setup: preview dialog opens, popover closes, Cancel returns focus to Browse….
await p.click('#library-browse-1');
await new Promise(r => setTimeout(r, 80));
await p.evaluate(() => document.querySelector('#quick-setup-menu-1 .quick-setup-option')?.click());
await new Promise(r => setTimeout(r, 80));
const preview = await p.evaluate(() => ({
  overlay: !document.getElementById('library-preview-overlay').hidden,
  popover: !document.getElementById('library-popover-1').hidden,
}));
P('choosing a setup opens the preview dialog and closes the popover', preview.overlay && !preview.popover, JSON.stringify(preview));
await p.evaluate(() => closeLibraryPreview());
await new Promise(r => setTimeout(r, 50));
P('Cancel returns focus to Browse…', await p.evaluate(() => document.activeElement?.id === 'library-browse-1'));

// Outside click closes the popover.
await p.click('#library-browse-1');
await new Promise(r => setTimeout(r, 80));
await p.mouse.click(5, 450);
await new Promise(r => setTimeout(r, 50));
P('clicking outside closes the popover', await p.evaluate(() => document.getElementById('library-popover-1').hidden));

// Final review 3: tabbing out of the popover (either direction) must close it
// instead of leaving it open over the fader sections with focus elsewhere.
await p.click('#library-browse-1');
await new Promise(r => setTimeout(r, 80));
// Keep tabbing until focus actually leaves the popover DOM (list may have several options).
let insidePopover = true, guard = 0;
while (insidePopover && guard < 20) {
  await p.keyboard.press('Tab');
  await new Promise(r => setTimeout(r, 30));
  insidePopover = await p.evaluate(() => document.getElementById('library-popover-1').contains(document.activeElement));
  guard++;
}
await new Promise(r => setTimeout(r, 50));
const afterTabOut = await p.evaluate(() => !document.getElementById('library-popover-1').hidden);
P('tabbing focus out of the popover closes it', insidePopover === false && afterTabOut === false, JSON.stringify({ insidePopover, afterTabOut, guard }));

await p.click('#library-browse-1');
await new Promise(r => setTimeout(r, 80));
const shiftTabbed = await p.evaluate(() => document.activeElement?.id === 'quick-setup-input-1');
await p.keyboard.down('Shift'); await p.keyboard.press('Tab'); await p.keyboard.up('Shift');
await new Promise(r => setTimeout(r, 50));
const afterShiftTab = await p.evaluate(() => ({ popover: !document.getElementById('library-popover-1').hidden, focus: document.activeElement?.id }));
P('search field was focused before Shift+Tab (sanity check)', shiftTabbed === true);
P('Shift+Tab from the search field to Browse… closes the popover and leaves focus on Browse…', afterShiftTab.popover === false && afterShiftTab.focus === 'library-browse-1', JSON.stringify(afterShiftTab));

// Rename still works through the big title.
const renamed = await p.evaluate(() => {
  const el = document.querySelector('.bank-title-input');
  el.value = 'Strings'; el.dispatchEvent(new Event('change'));
  return { cfg: cfg.banks[activeBank].name, tab: document.querySelectorAll('.bank-block-tab')[activeBank]?.textContent.trim() };
});
P('renaming via the title updates cfg and the tab', renamed.cfg === 'Strings' && /Strings/.test(renamed.tab), JSON.stringify(renamed));
P('no page errors', errs.length === 0, errs.join(' | '));
await p.close();
await b.close();
