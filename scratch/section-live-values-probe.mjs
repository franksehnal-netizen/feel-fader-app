// Regression probe: live values at the right of each section head (Frank
// 2026-09-30). Fader number on a level wash (HUD cell), roller articulation/keyswitch, button
// flash on a short press (bank switch). Nothing without a live device or when
// the card shows a bank other than the device's. Brightening (.is-moving) rides
// the glow timing and settles after the last value.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' – '+x:''}`);
const errs = [];
const p = await b.newPage();
p.on('pageerror', e => errs.push(String(e)));
await p.emulateMediaFeatures([{ name:'prefers-reduced-motion', value:'no-preference' }]);
await p.setViewport({ width:1280, height:900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await p.evaluate(() => skipWelcome());
await new Promise(r => setTimeout(r, 300));

const r = await p.evaluate(async () => {
  const wait = ms => new Promise(res => setTimeout(res, ms));
  const slot = k => document.getElementById(`section-live-${k}`);
  const state = k => { const el = slot(k); return el ? { on: el.classList.contains('is-on'), moving: el.classList.contains('is-moving'), text: el.textContent } : null; };
  const out = {};
  out.slots = ['fader1','fader2','roller','macro'].every(k => !!slot(k));
  out.offline = ['fader1','fader2','roller','macro'].map(state).every(s => !s.on);

  _ffConnected = true; _midiState = 'granted'; liveBank = 0; activeBank = 0; render(); renderConnState();
  const bank = cfg.banks[0];
  bank.roller_mode = 'cc'; render();
  const f1 = bank.fader1;
  onMidiMsg({ data:new Uint8Array([0xB0 | f1.channel, f1.cc, 87]), timeStamp:performance.now() });
  await wait(60);
  out.fader = state('fader1');
  out.frac = slot('fader1').style.getPropertyValue('--live-frac');
  out.fader2Idle = state('fader2');
  await wait(450);
  out.faderSettled = state('fader1');

  const val = bank.uacc_values[1];
  onMidiMsg({ data:new Uint8Array([0xB0 | bank.encoder.channel, bank.encoder.cc, val]), timeStamp:performance.now() });
  await wait(30);
  out.roller = state('roller');
  out.rollerExpected = uaccName(val);

  // Navigation (Keys): the HID key reaches the app as a keydown → show it, pulse like the faders.
  const key = (code, mods = {}) => document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles:true, ...mods }));
  bank.roller_mode = 'track_nav'; bank.nav_keys_cw = [0x52]; bank.nav_keys_ccw = [0xE0, 0x51]; render();
  out.navIdle = state('roller');
  key('KeyA'); await wait(30);
  out.navOther = state('roller');
  key('ArrowUp'); await wait(30);
  out.navUp = state('roller');
  out.navBox = slot('roller').classList.contains('section-live-keys');
  await wait(450);
  out.navUpSettled = state('roller');
  key('ArrowDown'); await wait(30);
  out.navDownNoCtrl = state('roller');
  key('ArrowDown', { ctrlKey:true }); await wait(30);
  out.navDown = state('roller');
  bank.roller_mode = 'cc'; render();
  onMidiMsg({ data:new Uint8Array([0xB0 | bank.encoder.channel, bank.encoder.cc, val]), timeStamp:performance.now() });

  // Card shows a different bank than the device → nothing.
  activeBank = 1; render();
  out.otherBank = ['fader1','roller'].map(state).every(s => !s.on);
  activeBank = 0; render();
  out.backOnDeviceBank = state('fader1').on && state('roller').on;

  // Short press → Program Change → button flash, then off.
  onMidiMsg({ data:new Uint8Array([0xC0, 0]), timeStamp:performance.now() });
  await wait(30);
  out.flash = state('macro');
  await wait(450);
  out.flashAfter = state('macro');

  // Disconnect → nothing.
  _ffConnected = false; renderConnState(); renderLiveState();
  out.disconnected = ['fader1','fader2','roller','macro'].map(state).every(s => !s.on);

  const cs = getComputedStyle(slot('fader1'));
  out.baseTransition = cs.transitionDuration;
  return out;
});

P('every section head has a live slot', r.slots);
P('no device: slots show nothing', r.offline);
P('fader value appears with the number and level wash, brightening while it moves',
  r.fader.on && r.fader.moving && r.fader.text === '87' && Math.abs(parseFloat(r.frac) - 87/127) < 1e-6, JSON.stringify({ ...r.fader, frac: r.frac }));
P('untouched fader stays empty', !r.fader2Idle.on, JSON.stringify(r.fader2Idle));
P('brightening settles after the last value, value stays', r.faderSettled.on && !r.faderSettled.moving, JSON.stringify(r.faderSettled));
P('roller shows the articulation name', r.roller.on && r.roller.text === r.rollerExpected, JSON.stringify(r.roller));
P('Keys: nothing before a roller key', !r.navIdle.on && !r.navOther.on, JSON.stringify({ idle: r.navIdle, other: r.navOther }));
P('Keys: roll-up key shows its glyph in the fader-number box, brightening', r.navUp.on && r.navUp.moving && r.navUp.text === '↑' && r.navBox, JSON.stringify(r.navUp));
P('Keys: brightening settles, glyph stays', r.navUpSettled.on && !r.navUpSettled.moving && r.navUpSettled.text === '↑', JSON.stringify(r.navUpSettled));
P('Keys: combo must match exactly (Ctrl+↓, not ↓)', r.navDownNoCtrl.text === '↑' && !r.navDownNoCtrl.moving && r.navDown.text === 'Ctrl+↓' && r.navDown.moving, JSON.stringify({ plain: r.navDownNoCtrl, ctrl: r.navDown }));
P('card on another bank than the device shows nothing', r.otherBank);
P('back on the device bank the values return', r.backOnDeviceBank);
P('short press flashes the button slot, then it fades', r.flash.on && r.flash.moving && !r.flashAfter.on, JSON.stringify({ flash: r.flash, after: r.flashAfter }));
P('disconnect clears every slot', r.disconnected);
P('fade/brighten ride --hover-out on the base state', r.baseTransition === '1.8s, 1.8s', r.baseTransition);
P('no page errors', errs.length === 0, errs.join(' | '));

// Optional visual check: FF_SHOT=<png path> saves the card in a live state.
if (process.env.FF_SHOT) {
  await p.evaluate(async () => {
    document.documentElement.classList.add('dark');
    _ffConnected = true; renderConnState(); render();
    const bank = cfg.banks[liveBank];
    onMidiMsg({ data:new Uint8Array([0xB0 | bank.fader1.channel, bank.fader1.cc, 87]), timeStamp:performance.now() });
    onMidiMsg({ data:new Uint8Array([0xB0 | bank.fader2.channel, bank.fader2.cc, 40]), timeStamp:performance.now() });
    onMidiMsg({ data:new Uint8Array([0xB0 | bank.encoder.channel, bank.encoder.cc, bank.uacc_values[1]]), timeStamp:performance.now() });
    document.querySelector('.bank-card').scrollIntoView({ block:'start' });
    await new Promise(res => setTimeout(res, 1500));
  });
  const card = await p.$('.bank-card');
  await card.screenshot({ path: process.env.FF_SHOT });
}
await p.close();
await b.close();
