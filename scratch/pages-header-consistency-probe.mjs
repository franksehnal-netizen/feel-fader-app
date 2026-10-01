// Regression probe: pages/*.html (opened from the app footer: Contact, Our
// story, Privacy, Terms, Impressum, Documentation) had their own top bar
// capped to the 760px reading column, so it read narrower than the app's own
// <header> (edge-to-edge); and "FEEL FADER" used its own one-off color/size
// instead of matching the app's wordmark (.h-title in feel-fader.html)
// (Frank 2026-10-01: "stejně široká jako hlavní aplikaci" + "stejná barva a
// velikost"). Follow-up same day: width/brand matched but the bar was still
// taller (18px vertical padding vs. the app header's 5px) – now also checks
// height.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  – '+x:''}`);

await p.setViewport({ width: 1400, height: 900 });

// Reference: the app's own wordmark styling.
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const ref = await p.evaluate(() => {
  const cs = getComputedStyle(document.querySelector('.h-title'));
  return {
    color: cs.color, fontSize: cs.fontSize, fontWeight: cs.fontWeight, letterSpacing: cs.letterSpacing, textTransform: cs.textTransform,
    headerHeight: document.querySelector('header').getBoundingClientRect().height,
  };
});
P('reference captured from the app .h-title', !!ref.color, JSON.stringify(ref));

const pages = ['contact', 'our-story', 'privacy', 'terms', 'impressum', 'documentation'];
for (const name of pages) {
  await p.goto(`http://localhost:8100/pages/${name}.html`, { waitUntil: 'networkidle0' });
  const r = await p.evaluate(() => {
    const top = document.querySelector('.legal-top').getBoundingClientRect();
    const inner = document.querySelector('.legal-top-inner').getBoundingClientRect();
    const brand = document.querySelector('.legal-brand');
    const cs = getComputedStyle(brand);
    return {
      // documentElement.clientWidth excludes the scrollbar gutter, unlike
      // window.innerWidth – comparing against it avoids a false negative from
      // the scrollbar alone.
      pageWidth: document.documentElement.clientWidth,
      topWidth: top.width,
      innerWidth: inner.width,
      topHeight: top.height,
      brand: { color: cs.color, fontSize: cs.fontSize, fontWeight: cs.fontWeight, letterSpacing: cs.letterSpacing, textTransform: cs.textTransform },
    };
  });
  P(`${name}.html: top bar spans the full app width (not capped to the reading column)`,
    r.topWidth >= r.pageWidth - 1 && r.innerWidth >= r.pageWidth - 1,
    JSON.stringify({ topWidth: r.topWidth, innerWidth: r.innerWidth, pageWidth: r.pageWidth }));
  // 1px tolerance: .legal-top has its own 1px bottom border as a divider
  // (the app's header has no border, just a box-shadow) – that hairline is
  // a deliberate, separate chrome choice, not the height gap Frank flagged.
  P(`${name}.html: top bar is the same height as the app header`,
    Math.abs(r.topHeight - ref.headerHeight) <= 1,
    JSON.stringify({ topHeight: r.topHeight, appHeaderHeight: ref.headerHeight }));
  P(`${name}.html: "FEEL FADER" matches the app wordmark's color + size`,
    r.brand.color === ref.color && r.brand.fontSize === ref.fontSize && r.brand.fontWeight === ref.fontWeight
      && r.brand.letterSpacing === ref.letterSpacing && r.brand.textTransform === ref.textTransform,
    JSON.stringify({ page: r.brand, ref }));
}

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
