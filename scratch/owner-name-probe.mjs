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

// Connect & load (doStart) on the fader-glow clock, overlapping beats (Frank
// 2026-10-01): 0 s faders settle + greeting rises + welcome dissolves (gone by
// 0.43 s) → 0.43 s swap, controller glides 1.8 s on --ease-glide above the
// greeting → 2 s greeting fades out (1.3 s) → 3.3 s app chrome fades in (1.3 s).
const chrome = () => p.evaluate(() => ({
  header: +getComputedStyle(document.querySelector('header')).opacity,
  sections: +getComputedStyle(document.getElementById('settings-col')).opacity,
  footer: +getComputedStyle(document.querySelector('.site-footer')).opacity,
  pending: document.body.classList.contains('app-reveal-pending'),
  reveal: document.body.classList.contains('app-reveal'),
  stageTransition: document.getElementById('stage-collapse').style.transition,
  stageZ: getComputedStyle(document.getElementById('stage-collapse')).zIndex,
  greeting: !!document.getElementById('owner-greeting'),
}));
async function freshStart(owner) {
  await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
  return p.evaluate(async (owner) => {
    showWelcome(); await new Promise(requestAnimationFrame);
    window.loadConfigFromDevice = async () => { protocolVersion = 2; DEVICE_INFO.owner = owner; liveValues.f1 = 20; liveValues.f2 = 110; };
    await doStart();
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return { thumbTransition: document.getElementById('thumb-l').style.transition,
             greetingWithFaders: !!document.getElementById('owner-greeting'), again: takeOwnerGreeting() };
  }, owner);
}
// The connect choreography has a reduced-motion branch; pin the full-motion one.
await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
await p.setViewport({ width: 1512, height: 900 });   // desktop two-column layout – the controller glides left
const s1 = await freshStart('Frank');
P('faders settle with ramp-in + landing on the glow clock', /--ease-glide/.test(s1.thumbTransition) && /var\(--dur-link-in\)/.test(s1.thumbTransition), s1.thumbTransition);
P('greeting rises together with the faders', s1.greetingWithFaders === true, JSON.stringify(s1));
P('greeting consumed once per page', s1.again === '', JSON.stringify(s1));
await new Promise(r => setTimeout(r, 150));
const c1 = await chrome();   // ≈ 0.2 s: welcome dissolving, app underneath
P('app chrome held hidden while the welcome fades', c1.pending && c1.header === 0 && c1.sections === 0 && c1.footer === 0, JSON.stringify(c1));
await new Promise(r => setTimeout(r, 650));
const c2 = await chrome();   // ≈ 0.9 s: controller gliding (from 0.43 s), faders still landing
P('controller glides on --dur-link-out with ramp-in (--ease-glide)', /--dur-link-out/.test(c2.stageTransition) && /--ease-glide/.test(c2.stageTransition), c2.stageTransition);
P('gliding controller stays above the greeting', c2.greeting && Number(c2.stageZ) > 160, JSON.stringify(c2));
P('sections not over the gliding controller', c2.reveal && c2.sections < 0.05, JSON.stringify(c2));
await new Promise(r => setTimeout(r, 600));
const g1 = await readGreeting();   // ≈ 1.6 s
P('Connect & load → centered "Welcome back," + name', g1.present && g1.pre === 'Welcome back,' && g1.name === 'Frank' && g1.centered, JSON.stringify(g1));
P('no toast / welcome line for the greeting', g1.msg === '' && !g1.toasts.some(t => t.includes('Welcome back')), JSON.stringify(g1));
const look = await p.evaluate(() => {
  const nm = document.querySelector('.owner-greeting-name'), cs = getComputedStyle(nm);
  return { size: parseFloat(cs.fontSize), dur: cs.animationDuration, ease: cs.animationTimingFunction };
});
P('greeting is large and eases in like the fader glow', look.size >= 40 && look.dur === '1.3s' && look.ease === 'cubic-bezier(0.22, 0.61, 0.36, 1)', JSON.stringify(look));
const scrim = await p.evaluate(() => {
  const el = document.getElementById('owner-greeting'), cs = getComputedStyle(el);
  return { handoff: el.classList.contains('is-handoff'), bg: cs.backgroundColor, blur: cs.backdropFilter };
});
P('hand-off greeting has no scrim (it would veil the gliding controller)', scrim.handoff && scrim.bg === 'rgba(0, 0, 0, 0)' && scrim.blur === 'none', JSON.stringify(scrim));
P('sections still held while the greeting holds', (await chrome()).sections < 0.05);
const out = await p.evaluate(() => getComputedStyle(document.getElementById('owner-greeting')).animationDelay);
P('hand-off greeting is short: fade-out starts at 2 s', /,\s*2s$/.test(out), out);
await new Promise(r => setTimeout(r, 1000));   // ≈ 2.7 s: greeting fading out
const c3 = await chrome();
P('app waits while the greeting fades out (no cross-fade over it)', c3.greeting && c3.sections < 0.05, JSON.stringify(c3));
await new Promise(r => setTimeout(r, 1250));   // ≈ 3.95 s: greeting gone 3.3 s, chrome 3.3 → 4.6 s
const c3b = await chrome();
P('greeting gone, then the app fades in', !c3b.greeting && c3b.sections > 0.3 && c3b.sections < 1, JSON.stringify(c3b));
await new Promise(r => setTimeout(r, 1100));   // ≈ 5.05 s
P('overlay removed after it fades out', (await readGreeting()).present === false);
const c4 = await chrome();
P('app chrome fully in, reveal classes cleaned up', c4.header === 1 && c4.sections === 1 && c4.footer === 1 && !c4.pending && !c4.reveal, JSON.stringify(c4));

await freshStart('');
await new Promise(r => setTimeout(r, 850));   // ≈ 0.95 s: mid-glide, chrome not in yet (from 1.33 s)
P('no owner → chrome waits for mid-glide', (await chrome()).sections < 0.05);
await new Promise(r => setTimeout(r, 2100));   // ≈ 3.05 s: reveal 1.33 → 2.63 s
P('no owner → no overlay', (await readGreeting()).present === false);
P('no owner → chrome in once the glide has settled', (await chrome()).sections === 1);

await freshStart('<b>x</b>');
await new Promise(r => setTimeout(r, 2600));
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
const slScrim = await p.evaluate(() => { const cs = getComputedStyle(document.getElementById('owner-greeting')); return { bg: cs.backgroundColor, blur: cs.backdropFilter }; });
P('silent load greeting keeps its soft scrim over the visible app', slScrim.bg !== 'rgba(0, 0, 0, 0)' && /blur/.test(slScrim.blur), JSON.stringify(slScrim));
await new Promise(r => setTimeout(r, 5200));
await p.evaluate(() => onDeviceConnected());   // replug during work
P('later reconnect does not greet again', (await readGreeting()).present === false);

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
