// Regression probe (minimal hybrid, spec 2026-09-26 §7; Frank 2026-09-28): bank
// actions live in a collapsed "Bank actions" row at the top of the "Feel Fader"
// group, next to Device & Settings and Help & Guide, which still expand like before.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' – '+x:''}`);
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.setViewport({ width:1440, height:900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await p.evaluate(() => skipWelcome());
const wait = ms => new Promise(r => setTimeout(r, ms));

// Final review 1: .group-cap's negative bottom margin relies on the parent's
// 16px flex gap to net out to a small positive gap – true in .center-col but
// .panels-row has gap:0, so the "Bank" caption ends up pulled under the group.
const caps = await p.evaluate(() => {
  const info = {};
  document.querySelectorAll('.group-cap').forEach(capEl => {
    const label = capEl.textContent.trim();
    const group = capEl.nextElementSibling;
    if (group) info[label] = { capBottom: capEl.getBoundingClientRect().bottom, groupTop: group.getBoundingClientRect().top };
  });
  return info;
});
P('no separate Bank caption any more', !caps.Bank, JSON.stringify(caps));
P('Feel Fader caption is not clipped by the Feel Fader group', !!caps['Feel Fader'] && caps['Feel Fader'].capBottom <= caps['Feel Fader'].groupTop, JSON.stringify(caps['Feel Fader']));

const collapsed = await p.evaluate(() => {
  const btn = document.getElementById('bank-actions-toggle-btn');
  const ff = document.querySelector('.settings-group[data-group="feel-fader"]');
  return { firstRow: ff.querySelector('.group-row') === btn, hidden: document.getElementById('bank-actions-body').style.display === 'none',
    expanded: btn.getAttribute('aria-expanded'), summary: document.getElementById('bank-actions-summary').textContent.trim(), bankName: cfg.banks[activeBank].name || `Bank ${activeBank+1}` };
});
P('Bank actions is the first, collapsed row of the Feel Fader group', collapsed.firstRow && collapsed.hidden && collapsed.expanded === 'false', JSON.stringify(collapsed));
P('Bank actions row shows the edited bank name', collapsed.summary === collapsed.bankName, JSON.stringify(collapsed));

const one = await p.evaluate(() => {
  cfg.banks.splice(1); activeBank = 0; render();   // single bank, whatever the default config holds
  toggleBankActions();
  const g = document.getElementById('bank-actions-body');
  return {
    open: g.style.display !== 'none' && document.getElementById('bank-actions-toggle-btn').getAttribute('aria-expanded') === 'true',
    chev: getComputedStyle(document.querySelector('#bank-actions-toggle-btn .section-chevron')).transform,
    rows: [...g.querySelectorAll('[data-bank-action]')].map(el => el.dataset.bankAction),
    earlierDisabled: g.querySelector('[data-bank-action="left"]')?.disabled,
    laterDisabled: g.querySelector('[data-bank-action="right"]')?.disabled,
    position: g.querySelector('.bank-position-value')?.textContent.trim(),
    // Frank 2026-09-28: same row grammar and controls as Device & Settings
    labels: [...g.querySelectorAll('.info-row .info-lbl')].map(el => el.textContent.trim()),
    pillsLikeExport: ['save-setup', 'duplicate'].every(a => g.querySelector(`[data-bank-action="${a}"]`).matches('.ui-pill.ui-glass')),
    positionIsStepper: !!g.querySelector('.stepper [data-bank-action="left"].step-btn') && !!g.querySelector('.stepper [data-bank-action="right"].step-btn'),
  };
});
P('Bank actions expands and its chevron rotates', one.open && one.chev !== 'none', JSON.stringify(one));
P('single bank: no Delete row, Move disabled at both ends, position 1 of 1', !one.rows.includes('delete') && one.earlierDisabled && one.laterDisabled && one.position === '1 of 1', JSON.stringify(one));
P('Bank actions use Settings rows: label + Export-style pills + channel-style stepper', one.labels.join() === 'Setup,Copy,Position' && one.pillsLikeExport && one.positionIsStepper, JSON.stringify(one));

const dup = await p.evaluate(() => { document.querySelector('[data-bank-action="duplicate"]').click(); return { count: cfg.banks.length, active: activeBank }; });
P('Duplicate bank adds a copy', dup.count === 2, JSON.stringify(dup));

await p.evaluate(() => { activeBank = 1; render(); });
await p.focus('#bank-actions-body [data-bank-action="left"]');
await p.keyboard.press('Enter');
await wait(60);
const moved = await p.evaluate(() => ({ active: activeBank, focus: document.activeElement?.dataset?.bankAction, idx: document.activeElement?.dataset?.bankIndex }));
P('Move Earlier moves the bank and keeps focus on a Move button', moved.active === 0 && ['left', 'right'].includes(moved.focus) && moved.idx === '0', JSON.stringify(moved));

const del = await p.evaluate(() => {
  const row = document.querySelector('[data-bank-action="delete"]');
  const reset = getComputedStyle(document.querySelector('.backup-reset-btn'));
  const cs = getComputedStyle(row);
  const sameAsReset = cs.color === reset.color && cs.borderTopColor === reset.borderTopColor;
  row.click();
  const confirmOpen = !document.getElementById('confirm-overlay').hidden;
  closeConfirm(true);
  return { color: cs.color, sameAsReset, confirmOpen, count: cfg.banks.length };
});
P('Delete bank… looks like Reset and asks for confirmation', del.sameAsReset && del.confirmOpen && del.count === 1, JSON.stringify(del));

const save = await p.evaluate(() => { document.querySelector('[data-bank-action="save-setup"]').click(); const open = !document.getElementById('custom-preset-overlay').hidden; closeCustomPresetDialog(); return open; });
P('Save as setup… opens the custom setup dialog', save === true);

const ff = await p.evaluate(() => {
  const g = document.querySelector('.settings-group[data-group="feel-fader"]');
  const dev = document.getElementById('device-settings-toggle-btn');
  const help = document.getElementById('help-toggle-btn');
  dev.click();
  const devOpen = document.getElementById('device-settings-body').style.display !== 'none' && dev.getAttribute('aria-expanded') === 'true';
  const chev = getComputedStyle(dev.querySelector('.section-chevron')).transform;
  return {
    bothInGroup: !!g && g.contains(dev) && g.contains(help) && g.contains(document.getElementById('bank-actions-toggle-btn')),
    devOpen, chev, chevText: document.getElementById('device-settings-chevron')?.textContent.trim(),
    fwSummary: document.getElementById('di-firmware-summary')?.textContent.trim(),
  };
});
P('Bank actions, Device & Settings and Help & Guide are rows of one Feel Fader group', ff.bothInGroup, JSON.stringify(ff));
P('Device & Settings still expands, chevron rotates, no ▼/▲ text', ff.devOpen && ff.chev !== 'none' && ff.chevText === '', JSON.stringify(ff));
P('Device row shows the firmware version slot', ff.fwSummary === '–' || /^Firmware /.test(ff.fwSummary || ''), ff.fwSummary);
await p.evaluate(() => openHelpAt('help-roller'));
await wait(400);
P('Help deep link still opens Help & Guide', await p.evaluate(() => document.getElementById('help-body').style.display !== 'none'));
P('no page errors', errs.length === 0, errs.join(' | '));
await p.close();
await b.close();
