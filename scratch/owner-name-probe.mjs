// Owner name (spec feel-fader-firmware docs/superpowers/specs/2026-09-30-owner-name-design.md):
// Device → "Your name" row shows only for a connected device whose firmware
// reports supports_owner, saves over CMD_OWNER on Enter/blur, never on a
// no-op blur, and reverts on errors.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  – '+x:''}`);

await p.evaluate(() => { skipWelcome(); });
await new Promise(r => setTimeout(r, 300));

const hidden = await p.evaluate(() => {
  const row = document.getElementById('owner-row');
  const out = { disconnected: row.hidden };
  _serialPort = {}; protocolVersion = 2;
  DEVICE_INFO.supports_owner = false; renderConnState();
  out.oldFw = row.hidden;
  DEVICE_INFO.supports_owner = true; DEVICE_INFO.owner = 'Frank'; renderConnState();
  out.supported = row.hidden;
  out.value = document.getElementById('owner-input').value;
  toggleDeviceSettings();   // the row lives in the collapsed Device section – open it like a user
  return out;
});
P('row hidden while disconnected', hidden.disconnected === true, JSON.stringify(hidden));
P('row hidden for firmware without supports_owner', hidden.oldFw === true);
P('row visible for connected supporting firmware', hidden.supported === false);
P('input shows the device owner', hidden.value === 'Frank', hidden.value);

const save = await p.evaluate(async () => {
  const sent = [];
  window.serialRequest = async (cmd, body) => { sent.push([cmd, body]); return ''; };
  window.serialReadInfo = async () => ({});
  const input = document.getElementById('owner-input');
  input.focus(); input.value = 'Frank'; input.blur();          // no-op
  await new Promise(r => setTimeout(r, 50));
  const noop = sent.length;
  input.focus(); input.value = '  Ivan  ';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await new Promise(r => setTimeout(r, 50));
  const toastTxt = [...document.querySelectorAll('#toasts .toast-message')].map(e => e.textContent);
  input.focus(); input.value = 'Zzz';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await new Promise(r => setTimeout(r, 50));
  return { noop, sent, owner: DEVICE_INFO.owner, value: input.value, toastTxt };
});
P('no-op blur sends nothing', save.noop === 0, String(save.noop));
const ownerSends = save.sent.filter(c => c[0] === 'CMD_OWNER');   // + one CMD_INFO read-back
P('Enter sends CMD_OWNER with trimmed name', ownerSends.length === 1
  && ownerSends[0][1] === JSON.stringify({ owner: 'Ivan' }), JSON.stringify(save.sent));
P('owner state updated + toast', save.owner === 'Ivan' && save.toastTxt.includes('Name saved'), JSON.stringify(save));
P('Escape reverts without sending', save.value === 'Ivan' && ownerSends.length === 1, JSON.stringify(save));

const errSpace = await p.evaluate(async () => {
  window.serialRequest = async () => { throw new Error('ERR:space'); };
  const input = document.getElementById('owner-input');
  input.focus(); input.value = 'Frank'; input.blur();
  await new Promise(r => setTimeout(r, 50));
  const toastTxt = [...document.querySelectorAll('#toasts .toast-message')].map(e => e.textContent);
  return { value: input.value, owner: DEVICE_INFO.owner, toastTxt };
});
P('ERR:space → memory toast, input reverted', errSpace.value === 'Ivan' && errSpace.owner === 'Ivan'
  && errSpace.toastTxt.includes('Not enough device memory – send your settings once, then try again.'), JSON.stringify(errSpace));

const errOther = await p.evaluate(async () => {
  window.serialRequest = async () => { throw new Error('timeout'); };
  const input = document.getElementById('owner-input');
  input.focus(); input.value = ''; input.blur();
  await new Promise(r => setTimeout(r, 50));
  const toastTxt = [...document.querySelectorAll('#toasts .toast-message')].map(e => e.textContent);
  return { value: input.value, toastTxt };
});
P('other error → generic toast, input reverted', errOther.value === 'Ivan'
  && errOther.toastTxt.includes("Couldn't save name"), JSON.stringify(errOther));

// ── Read-back after save must stay on protocol v2 (final review I1): serialReadInfo()'s
// legacy bootstrap would flip protocolVersion to 1 under a Send queued right after blur.
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await p.evaluate(() => { skipWelcome(); });
await new Promise(r => setTimeout(r, 300));
const rb = await p.evaluate(async () => {
  _serialPort = { getInfo: () => ({ usbProductId: 1 }) }; protocolVersion = 2;
  DEVICE_INFO.supports_owner = true; DEVICE_INFO.owner = ''; renderConnState(); toggleDeviceSettings();
  const calls = [];
  window.serialRequest = async (cmd) => {
    calls.push([cmd, protocolVersion]);
    return cmd === 'CMD_INFO' ? JSON.stringify({ schema_version: 3, config_hash: 'deadbeef', supports_owner: true, owner: 'Ivan' }) : '';
  };
  const input = document.getElementById('owner-input');
  input.focus(); input.value = ' Ivan'; input.blur();
  await new Promise(r => setTimeout(r, 50));
  return { calls, pv: protocolVersion, owner: DEVICE_INFO.owner };
});
P('save + read-back never drop to legacy protocol', rb.pv === 2 && rb.calls.every(c => c[1] === 2)
  && rb.calls.some(c => c[0] === 'CMD_INFO'), JSON.stringify(rb));
P('read-back owner applied', rb.owner === 'Ivan', JSON.stringify(rb));

// ── Greeting: centered overlay, not a toast / welcome line (Frank 2026-10-01) ──
const readGreeting = () => p.evaluate(() => {
  const el = document.getElementById('owner-greeting');
  return {
    present: !!el,
    pre: el?.querySelector('.owner-greeting-pre')?.textContent ?? null,
    name: el?.querySelector('.owner-greeting-name')?.textContent ?? null,
    bold: !!el?.querySelector('b'),
    centered: el ? (() => { const r = el.querySelector('.owner-greeting-name').getBoundingClientRect();
      return Math.abs((r.left + r.width / 2) - innerWidth / 2) < 4 && Math.abs((r.top + r.height / 2) - innerHeight / 2) < innerHeight * 0.15; })() : false,
    msg: document.getElementById('welcome-start-msg').textContent,
    toasts: [...document.querySelectorAll('#toasts .toast-message')].map(e => e.textContent),
  };
});

// Connect & load (doStart): overlay only after the ~1.1s connect transition.
async function freshStart(owner) {
  await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
  return p.evaluate(async (owner) => {
    showWelcome(); await new Promise(requestAnimationFrame);
    window.loadConfigFromDevice = async () => { protocolVersion = 2; DEVICE_INFO.owner = owner; };
    await doStart();
    return { duringTransition: !!document.getElementById('owner-greeting'), again: takeOwnerGreeting() };
  }, owner);
}
const s1 = await freshStart('Frank');
P('no overlay during the connect transition', s1.duringTransition === false, JSON.stringify(s1));
P('greeting consumed once per page', s1.again === '', JSON.stringify(s1));
await new Promise(r => setTimeout(r, 1500));
const g1 = await readGreeting();
P('Connect & load → centered "Welcome back," + name', g1.present && g1.pre === 'Welcome back,' && g1.name === 'Frank' && g1.centered, JSON.stringify(g1));
P('no toast / welcome line for the greeting', g1.msg === '' && !g1.toasts.some(t => t.includes('Welcome back')), JSON.stringify(g1));
await new Promise(r => setTimeout(r, 2800));   // overlay age ≈ 3.2 s: past the 2.6 s fade-out
P('overlay removed after it fades out', (await readGreeting()).present === false);

await freshStart('');
await new Promise(r => setTimeout(r, 1500));
P('no owner → no overlay', (await readGreeting()).present === false);

await freshStart('<b>x</b>');
await new Promise(r => setTimeout(r, 1500));
const g3 = await readGreeting();
P('owner rendered literally (escape)', g3.name === '<b>x</b>' && !g3.bold, JSON.stringify(g3));

// Silent load of a known device: overlay right away, never again on reconnect.
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await p.evaluate(async () => {
  showWelcome(); await new Promise(requestAnimationFrame);
  navigator.serial.getPorts = async () => [{}];
  window.serialReadInfo = async () => { protocolVersion = 2; DEVICE_INFO.config_source = 'nvm'; DEVICE_INFO.owner = 'Frank'; return {}; };
  window.loadConfigFromDevice = async () => {};
  dirty = false;
  localStorage.removeItem('ff-config-hash');
  await onDeviceConnected();
});
const sl = await readGreeting();
P('silent load → overlay with the name, no toast', sl.present && sl.name === 'Frank' && !sl.toasts.some(t => t.includes('Welcome back')), JSON.stringify(sl));
await new Promise(r => setTimeout(r, 3300));
await p.evaluate(() => onDeviceConnected());   // replug during work
P('later reconnect does not greet again', (await readGreeting()).present === false);

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
