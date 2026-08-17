// P1 Security — XSS via config import (launch audit 2026-07-28, Task 3).
// Asserts SAFE behavior: importing a device-backup JSON whose bank name/icon/
// fader label carry an XSS payload must NOT execute script and must NOT land
// in the DOM as a live element — render() must escape via escHtml().
//
// Real render path used (verified by static grep of feel-fader.html):
//   onImport(e) [line ~4629]:
//     p = JSON.parse(text); if(!p.banks) throw; p = normalizeFwConfig(p);
//     cfg = p; loaded = true; dirty = true; activeBank = 0; cfgSave(); render();
// This probe replicates those exact statements (skipping only the FileReader
// plumbing, which is unrelated to the sink) so payload flows through the
// app's real normalizeFwConfig -> render -> escHtml chain, not a bypass.
//
// Payload shape: banks[0].fader1 is present, so normalizeFwConfig takes the
// "already-normalized" branch (line ~4288) which leaves bank.name/bank.icon
// untouched (this is the reimport-an-edited-export path — the shape a user
// gets from exportP() and could hand-edit before reimporting). fader1.label
// passes through faderDisplayName(), which trims but does not sanitize.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; const alerts=[];
p.on('pageerror',e=>errs.push(String(e)));
p.on('dialog', async d=>{ alerts.push(d.message()); await d.dismiss(); }); // alert() from XSS would land here
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
await p.evaluate(()=>{ skipWelcome(); });
await new Promise(r=>setTimeout(r,300));
const res = await p.evaluate(async ()=>{
  window.__xss = false;
  const payload = '<img src=x onerror="window.__xss=true">';
  const evil = { banks:[{ name:payload, icon:payload, fader1:{cc:1,channel:0,label:payload}, fader2:{cc:2,channel:0,label:'x'}, encoder:{cc:32,channel:0}, uacc_values:[1] }] };
  // Same statements as onImport(e)'s FileReader.onload body, verbatim order:
  let parsed = evil; // stand-in for JSON.parse(ev.target.result) — payload is already an object here
  if (!parsed.banks) throw new Error('Invalid device backup');
  parsed = normalizeFwConfig(parsed);
  cfg = parsed; loaded = true; dirty = true; activeBank = 0;
  cfgSave(); render();
  await new Promise(r=>setTimeout(r,100));
  return {
    xss: window.__xss,
    bodyHasRawImg: /<img[^>]+onerror/i.test(document.body.innerHTML),
    nameEscaped: document.body.innerHTML.includes('&lt;img'),
    cfgName: cfg.banks[0].name,
    cfgLabel: cfg.banks[0].fader1.label,
  };
});
P('onerror payload se nespustil (window.__xss=false)', res.xss===false, JSON.stringify(res));
P('žádný alert()/dialog z injektovaného skriptu', alerts.length===0, alerts.join(' | '));
P('payload není v DOM jako živý <img onerror>', res.bodyHasRawImg===false, JSON.stringify(res));
P('bank name/icon/label je v DOM jen jako escapovaný text', res.nameEscaped===true, JSON.stringify(res));

// SEC-004 (final review 2026-08-17): roller_mode/ks_channel/ks_velocity go
// through the same "already-normalized" branch of normalizeFwConfig as
// name/icon/label above, but weren't clamped — roller_mode reaches
// `data-mode="${rmode}"` unescaped (encoderPanel), an attribute-breakout
// vector distinct from the innerHTML-text vector proven above.
const res2 = await p.evaluate(async ()=>{
  window.__xss2 = false;
  const breakout = '"><img src=x onerror="window.__xss2=true"><div data-x="';
  const evil = { banks:[{ name:'X', icon:'', fader1:{cc:1,channel:0,label:'A'}, fader2:{cc:2,channel:0,label:'B'}, encoder:{cc:32,channel:0}, uacc_values:[1],
    roller_mode: breakout, ks_notes:[1], ks_channel: breakout, ks_velocity: breakout }] };
  let parsed = evil;
  if (!parsed.banks) throw new Error('Invalid device backup');
  parsed = normalizeFwConfig(parsed);
  cfg = parsed; loaded = true; dirty = true; activeBank = 0;
  cfgSave(); render();
  await new Promise(r=>setTimeout(r,100));
  return {
    xss2: window.__xss2,
    bodyHasRawImg: /<img[^>]+onerror/i.test(document.body.innerHTML),
    rollerMode: cfg.banks[0].roller_mode,
    ksChannel: cfg.banks[0].ks_channel,
    ksVelocity: cfg.banks[0].ks_velocity,
  };
});
const validRollerModes = ['cc','keyswitch','track_nav'];
P('roller_mode je omezen na známé hodnoty (SEC-004)', validRollerModes.includes(res2.rollerMode), JSON.stringify(res2));
P('ks_channel je clampnuté číslo (SEC-004)', Number.isFinite(res2.ksChannel), JSON.stringify(res2));
P('ks_velocity je clampnuté číslo (SEC-004)', Number.isFinite(res2.ksVelocity), JSON.stringify(res2));
P('roller_mode/ks_channel/ks_velocity breakout payload se nespustil (window.__xss2=false)', res2.xss2===false, JSON.stringify(res2));
P('payload není v DOM jako živý <img onerror> (SEC-004)', res2.bodyHasRawImg===false, JSON.stringify(res2));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
