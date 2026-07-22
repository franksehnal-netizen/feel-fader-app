// Regression probe: the footer used to sit right after the main content
// with a large empty gap below it whenever page content was shorter than
// the viewport — reported by Frank from a screenshot (2026-07-20). He
// wanted the footer's last line flush with the actual bottom edge of the
// page instead.
//
// Root cause was two-deep: body wasn't a flex column, so <main> (a plain
// block child) never grew to fill remaining viewport height; and even
// after making <main> flex:1, its actual child holding the footer is
// .center-col (not main directly) — .center-col already was `display:flex;
// flex-direction:column` but had no `flex:1`, so IT never grew to fill
// <main> either, leaving its own 64px/48px bottom padding as the visible
// gap. Fixed with three changes: body{display:flex;flex-direction:column},
// main{flex:1}, .center-col{flex:1} (+ removed its now-redundant bottom
// padding, since .site-footer already has its own bottom padding).
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

async function gapAt(height) {
  await p.setViewport({ width: 1280, height });
  await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
  return p.evaluate(() => {
    skipWelcome();
    const bodyH = document.body.getBoundingClientRect().height;
    const footer = document.querySelector('.site-footer').getBoundingClientRect();
    return bodyH - footer.bottom;
  });
}

const shortContentGap = await gapAt(2000);  // viewport taller than content
P('footer sits flush at the bottom when content is shorter than the viewport', Math.abs(shortContentGap) < 1, String(shortContentGap));

const tallContentGap = await gapAt(900);  // viewport shorter than content (normal scroll case)
P('footer still sits flush at the true end of the page when content overflows', Math.abs(tallContentGap) < 1, String(tallContentGap));

const links = await p.evaluate(() => ({
  placeholders: [...document.querySelectorAll('.site-footer a')].filter(a => a.getAttribute('href') === '#').length,
  support: document.querySelector('.site-footer a[href^="mailto:"]')?.getAttribute('href'),
}));
P('footer contains no placeholder links', links.placeholders === 0, JSON.stringify(links));
P('footer exposes a direct support email link', links.support === 'mailto:support@acoustic-empire.cz', links.support || 'missing');

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
