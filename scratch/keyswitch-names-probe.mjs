// Regression probe (UX audit 2026-09-25, C-1): keyswitches carry musical names
// like UACC values do. Names live only in the app (ks_names, keyed by MIDI
// note) – never in the CMD_W payload (firmware serial frame is 8 KB) – and a
// device load keeps them only when the note sequence is unchanged, so a name
// can never label a different articulation.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' — '+x:''}`);
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await p.evaluate(() => skipWelcome());

const r = await p.evaluate(async () => {
  const out = {};
  activeBank = 0;
  _openSections.clear(); _openSections.add('roller'); _openRollerAdvanced.add(0);
  applyLibraryPreset('Sonuscore LUX — Violins 1');
  out.names = { ...(cfg.banks[0].ks_names || {}) };
  const chip = note => document.querySelector(`#ks-tags-0 [data-ksnote="${note}"]`);
  out.chipPrimary = chip(24)?.querySelector('.ks-note-name')?.textContent;
  out.chipText = chip(24)?.textContent.replace(/\s+/g, ' ');
  out.chipAria = chip(24)?.getAttribute('aria-label');

  _ffConnected = true; _midiState = 'granted';
  ksLiveNote = 31; renderLiveStrip();
  out.hud = document.getElementById('live-roller-value')?.textContent;
  out.hudTitle = document.getElementById('live-roller-value')?.title;
  ksLiveNote = null;

  // Rename through the chip: double-click opens an inline field.
  chip(25).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  const input = document.querySelector('#ks-tags-0 .ks-name-input');
  out.editorOpened = !!input;
  if (input) {
    input.value = 'Long';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }
  out.renamed = cfg.banks[0].ks_names?.[25];
  out.renamedChip = chip(25)?.querySelector('.ks-note-name')?.textContent;

  chip(26).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  const esc = document.querySelector('#ks-tags-0 .ks-name-input');
  if (esc) { esc.value = 'Nope'; esc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); }
  out.afterEscape = cfg.banks[0].ks_names?.[26];

  chip(27).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  const clr = document.querySelector('#ks-tags-0 .ks-name-input');
  if (clr) { clr.value = '   '; clr.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }
  out.clearedHasKey = Object.prototype.hasOwnProperty.call(cfg.banks[0].ks_names || {}, '27');
  out.clearedChip = chip(27)?.querySelector('.ks-note-name')?.textContent;
  out.noteName27 = noteName(27);

  // CMD_W payload must not carry ks_names.
  let payload = null;
  const realRequest = window.serialRequest;
  window.serialRequest = async (cmd, body) => { if (cmd === 'CMD_W') payload = body; return ''; };
  _serialPort = {};
  dirty = true;
  await doSend();
  window.serialRequest = realRequest; _serialPort = null;
  out.payloadHasNames = payload === null ? 'no payload' : /ks_names/.test(payload);
  out.payloadHasNotes = payload !== null && /"ks_notes":\[24,25,26/.test(payload);

  // Device load: same sequence keeps names, changed sequence drops them.
  const deviceBank = notes => ({ fader_cc:[11,1], fader_ch:[0,0], encoder:32, encoder_ch:0, roller_mode:'keyswitch', ks_notes:notes, ks_channel:0, ks_velocity:100, m:{ n:'LUX Violins 1' } });
  out.loadSame = normalizeFwConfig({ banks:[deviceBank([24,25,26,27,28,29,30,31])] }).banks[0].ks_names?.['24'];
  out.loadChanged = normalizeFwConfig({ banks:[deviceBank([24,26,25])] }).banks[0].ks_names;

  // Hostile import: names are clamped and escaped.
  const imported = normalizeFwConfig({ banks:[{ name:'X', fader1:{cc:1,channel:0}, fader2:{cc:2,channel:0}, encoder:{cc:32,channel:0}, roller_mode:'keyswitch', ks_notes:[0,1],
    ks_names:{ '0':'<img src=x onerror="window.__ksx=1">', '1':'A'.repeat(40), '999':'bad', '__proto__':'p', 'x':'bad' } }] }).banks[0].ks_names;
  out.importKeys = Object.keys(imported || {});
  out.importLong = (imported || {})['1']?.length;
  cfg = normalizeFwConfig({ banks:[{ name:'X', fader1:{cc:1,channel:0}, fader2:{cc:2,channel:0}, encoder:{cc:32,channel:0}, roller_mode:'keyswitch', ks_notes:[0,1], ks_names: imported }] });
  activeBank = 0; render();
  out.xss = !!window.__ksx || !!document.querySelector('#ks-tags-0 img');

  // A library without names clears stale ones (no C0 = "Legato" left behind).
  cfg.banks[0].ks_names = { '12':'Legato' };
  applyLibraryPreset('Spitfire Symphony Orchestra — Celli (All techniques)');
  out.afterSso = cfg.banks[0].ks_names;
  return out;
});

const LUX = ['Legato','Sustain','Marcato','Staccato','Spiccato','Pizzicato','Tremolo','Portamento'];
P('LUX Violins 1 preset names its keyswitches', LUX.every((n, i) => r.names[24 + i] === n), JSON.stringify(r.names));
P('chip leads with the articulation name', r.chipPrimary === 'Legato' && /C0/.test(r.chipText), `${r.chipPrimary} / ${r.chipText}`);
P('chip accessible name includes the articulation', /^Legato, C0, MIDI 24/.test(r.chipAria || ''), r.chipAria);
P('Live HUD shows the keyswitch name', r.hud === 'Portamento' && /G0/.test(r.hudTitle || ''), `${r.hud} / ${r.hudTitle}`);
P('double-click opens an inline name field', r.editorOpened === true);
P('Enter saves the new name', r.renamed === 'Long' && r.renamedChip === 'Long', `${r.renamed} / ${r.renamedChip}`);
P('Escape cancels the edit', r.afterEscape === 'Marcato', r.afterEscape);
P('an empty name removes it and the note name returns', r.clearedHasKey === false && r.clearedChip === r.noteName27, `${r.clearedHasKey} / ${r.clearedChip}`);
P('CMD_W payload carries notes but no names', r.payloadHasNames === false && r.payloadHasNotes === true, `${r.payloadHasNames} / ${r.payloadHasNotes}`);
P('device load keeps names when the sequence is unchanged', r.loadSame === 'Legato', r.loadSame);
P('device load drops names when the sequence changed', !r.loadChanged || Object.keys(r.loadChanged).length === 0, JSON.stringify(r.loadChanged));
P('import keeps only notes 0–127 and caps names at 24 chars', r.importKeys.join() === '0,1' && r.importLong === 24, `${r.importKeys} / ${r.importLong}`);
P('imported names cannot inject markup', r.xss === false);
P('a library without names clears stale ones', !r.afterSso || Object.keys(r.afterSso).length === 0, JSON.stringify(r.afterSso));
P('no page errors', errs.length === 0, errs.join(' | '));
await p.close();
await b.close();
