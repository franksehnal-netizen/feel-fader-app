// Regression probe: pointer hover on buttons/rows rides the same rise/fade as the
// controller glow (--dur-link-in / --dur-link-out / --ease-link), via the
// --hover-in / --hover-out aliases. Press and selection states stay quick.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' – '+x:''}`);
const wait = ms => new Promise(r => setTimeout(r, ms));
const p = await b.newPage();
await p.emulateMediaFeatures([{ name:'prefers-reduced-motion', value:'no-preference' }]);
await p.setViewport({ width:1280, height:900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await p.evaluate(() => skipWelcome());
await wait(300);

const tokens = await p.evaluate(() => {
  const cs = getComputedStyle(document.documentElement);
  const v = n => cs.getPropertyValue(n).trim();
  return { in: v('--hover-in'), out: v('--hover-out'), linkIn: v('--dur-link-in'), linkOut: v('--dur-link-out'), ease: v('--ease-link') };
});
P('--hover-in is --dur-link-in + --ease-link', tokens.in === `${tokens.linkIn} ${tokens.ease}`, JSON.stringify(tokens));
P('--hover-out is --dur-link-out + --ease-link', tokens.out === `${tokens.linkOut} ${tokens.ease}`);
const inMs = parseFloat(tokens.linkIn) * 1000, outMs = parseFloat(tokens.linkOut) * 1000;

// Duration of the live CSS transition running on `prop` for element `sel`.
const running = (sel, prop) => p.evaluate((sel, prop) => {
  const el = document.querySelector(sel);
  const t = el && el.getAnimations().find(a => a.transitionProperty === prop);
  return t ? { dur: t.effect.getTiming().duration, ease: t.effect.getTiming().easing } : null;
}, sel, prop);

async function hoverCase(label, rawSel, prop) {
  // First *rendered* match (collapsed sections hide some controls).
  const found = await p.evaluate(s => {
    const el = [...document.querySelectorAll(s)].find(e => e.getClientRects().length);
    if (el) el.setAttribute('data-hover-probe', s);
    return !!el;
  }, rawSel);
  if (!found) return P(label, false, `no rendered ${rawSel}`);
  const sel = `[data-hover-probe="${rawSel}"]`;
  const el = await p.$(sel);
  await el.evaluate(e => e.scrollIntoView({ block:'center' }));
  await p.mouse.move(2, 2); await wait(2200);
  const box = await el.boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await wait(60);
  const rise = await running(sel, prop);
  // Let the rise finish: leaving mid-rise would (per spec) shorten the reverse.
  await wait(inMs + 200);
  await p.mouse.move(2, 2);
  await wait(60);
  const fade = await running(sel, prop);
  P(`${label}: hover rises over --dur-link-in, leaves over --dur-link-out`,
    rise?.dur === inMs && fade?.dur === outMs && rise.ease === fade.ease && rise.ease.startsWith('cubic-bezier(0.22'),
    JSON.stringify({ rise, fade }));
}
await hoverCase('bank tab', '.bank-block-tab:not(.active)', 'background-color');
await hoverCase('add bank', '.bank-block-tab-add', 'background-color');
await hoverCase('dark toggle (.ui-control)', '.dark-toggle', 'color');
// Steppers live inside the settings sections: open them until one renders.
await p.evaluate(async () => {
  const rendered = () => [...document.querySelectorAll('.step-btn.active')].some(e => e.getClientRects().length);
  for (const t of document.querySelectorAll('.bank-section:not(.is-open) .section-toggle')) {
    if (rendered()) break;
    t.click(); await new Promise(r => setTimeout(r, 400));
  }
});
await hoverCase('stepper button', '.step-btn:not(.active):not(:disabled)', 'background-color');
await hoverCase('settings row', '.group-row', 'background-color');

// Lit bank section = full-bleed square row; the inset dividers around it fade out
// with it and come back after (Frank 2026-09-29, variant "A").
{
  await p.mouse.move(2, 2); await wait(2200);
  const sec = await p.$('.bank-section[data-fader="fader2"]');
  await sec.evaluate(e => e.scrollIntoView({ block:'center' }));
  const box = await sec.boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + 20);
  await wait(inMs + 300);
  const lit = await p.evaluate(() => {
    const s = document.querySelector('.bank-section[data-fader="fader2"]');
    const card = s.closest('.bank-card');
    return { linked: s.classList.contains('fader-linked'), radius: getComputedStyle(s).borderTopLeftRadius,
      flushLeft: Math.abs(s.getBoundingClientRect().left - card.getBoundingClientRect().left) < 0.5,
      above: getComputedStyle(s.previousElementSibling).opacity, below: getComputedStyle(s.nextElementSibling).opacity };
  });
  P('lit section is a square full-bleed row with both neighbouring dividers hidden',
    lit.linked && lit.radius === '0px' && lit.flushLeft && lit.above === '0' && lit.below === '0', JSON.stringify(lit));
  await p.mouse.move(2, 2); await wait(outMs + 300);
  const back = await p.evaluate(() => {
    const s = document.querySelector('.bank-section[data-fader="fader2"]');
    return [getComputedStyle(s.previousElementSibling).opacity, getComputedStyle(s.nextElementSibling).opacity];
  });
  P('dividers return after the section fades out', back.every(o => o === '1'), JSON.stringify(back));
}

// Selection and press stay quick (rules without hover timing).
const quick = await p.evaluate(() => {
  const d = sel => { const el = document.querySelector(sel); return el ? getComputedStyle(el).transitionDuration : null; };
  // Not every layout renders an .active stepper — check the rule on a borrowed one.
  const step = [...document.querySelectorAll('.step-btn')].find(e => e.getClientRects().length);
  const had = step.classList.contains('active');
  step.classList.add('active');
  const stepActive = getComputedStyle(step).transitionDuration;
  if (!had) step.classList.remove('active');
  return { stepActive, tabActive: d('.bank-block-tabs .bank-block-tab.active') };
});
P('active stepper / active bank tab keep quick selection timing',
  quick.stepActive?.split(', ').every(s => parseFloat(s) <= 0.18) && quick.tabActive === '0.15s', JSON.stringify(quick));
const press = await p.evaluate(() => {
  const el = document.querySelector('.dark-toggle');
  const cs = getComputedStyle(el);
  const props = cs.transitionProperty.split(', '), durs = cs.transitionDuration.split(', ');
  return durs[props.indexOf('transform')];
});
P('press (transform) stays on --dur-press', press === '0.1s', press);

await p.close();
await b.close();
