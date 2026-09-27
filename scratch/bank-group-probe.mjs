// Regression probe (minimal hybrid, spec 2026-09-26 §7): bank actions live in a
// "Bank" group under the controls; Device & Settings and Help & Guide are rows
// of one "Feel Fader" group and still expand like before.
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

const one = await p.evaluate(() => {
  cfg.banks.splice(1); activeBank = 0; render();   // single bank, whatever the default config holds
  const g = document.querySelector('.settings-group[data-group="bank"]');
  const card = document.querySelector('.bank-card');
  return {
    below: !!g && g.getBoundingClientRect().top > card.getBoundingClientRect().bottom,
    rows: [...g.querySelectorAll('.group-row')].map(el => el.dataset.bankAction),
    earlierDisabled: g.querySelector('[data-bank-action="left"]')?.disabled,
    laterDisabled: g.querySelector('[data-bank-action="right"]')?.disabled,
    rowHeight: Math.round(g.querySelector('[data-bank-action="duplicate"]').getBoundingClientRect().height),
  };
});
P('Bank group sits under the controls card', one.below, JSON.stringify(one));
P('single bank: no Delete row, Move disabled at both ends', !one.rows.includes('delete') && one.earlierDisabled && one.laterDisabled, JSON.stringify(one));
P('Bank rows are 50 px', one.rowHeight === 50, String(one.rowHeight));

const dup = await p.evaluate(() => { document.querySelector('[data-bank-action="duplicate"]').click(); return { count: cfg.banks.length, active: activeBank }; });
P('Duplicate bank adds a copy', dup.count === 2, JSON.stringify(dup));

await p.evaluate(() => { activeBank = 1; render(); });
await p.focus('.group-row-inline[data-bank-action="left"]');
await p.keyboard.press('Enter');
await wait(60);
const moved = await p.evaluate(() => ({ active: activeBank, focus: document.activeElement?.dataset?.bankAction, idx: document.activeElement?.dataset?.bankIndex }));
P('Move Earlier moves the bank and keeps focus on a Move button', moved.active === 0 && ['left', 'right'].includes(moved.focus) && moved.idx === '0', JSON.stringify(moved));

const del = await p.evaluate(() => {
  const row = document.querySelector('[data-bank-action="delete"]');
  const probe = document.createElement('span'); probe.style.color = 'var(--danger)'; document.body.appendChild(probe);
  const danger = getComputedStyle(probe).color; probe.remove();
  const color = getComputedStyle(row).color;
  row.click();
  const confirmOpen = !document.getElementById('confirm-overlay').hidden;
  closeConfirm(true);
  return { color, danger, confirmOpen, count: cfg.banks.length };
});
P('Delete bank… is --danger and asks for confirmation', del.color === del.danger && del.confirmOpen && del.count === 1, JSON.stringify(del));

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
    bothInGroup: !!g && g.contains(dev) && g.contains(help),
    devOpen, chev, chevText: document.getElementById('device-settings-chevron')?.textContent.trim(),
    fwSummary: document.getElementById('di-firmware-summary')?.textContent.trim(),
  };
});
P('Device & Settings and Help & Guide are rows of one Feel Fader group', ff.bothInGroup, JSON.stringify(ff));
P('Device & Settings still expands, chevron rotates, no ▼/▲ text', ff.devOpen && ff.chev !== 'none' && ff.chevText === '', JSON.stringify(ff));
P('Device row shows the firmware version slot', ff.fwSummary === '–' || /^Firmware /.test(ff.fwSummary || ''), ff.fwSummary);
await p.evaluate(() => openHelpAt('help-roller'));
await wait(400);
P('Help deep link still opens Help & Guide', await p.evaluate(() => document.getElementById('help-body').style.display !== 'none'));
P('no page errors', errs.length === 0, errs.join(' | '));
await p.close();
await b.close();
