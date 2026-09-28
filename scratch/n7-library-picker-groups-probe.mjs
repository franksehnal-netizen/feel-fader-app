// Regression probe (UX audit 2026-09-28, N-7): the Library setup picker groups
// built-in libraries by maker in a curated order (ensemble, then Violins 1 →
// Basses), shows all 14 on a 900 px screen, and fades its bottom edge while
// more options sit below the fold.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P = (l, ok, x='') => console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' – '+x:''}`);
const wait = ms => new Promise(r => setTimeout(r, ms));
const errs = [];

async function open(W, H, recent = []) {
  const p = await b.newPage();
  p.on('pageerror', e => errs.push(String(e)));
  p.on('dialog', d => d.accept());
  await p.setViewport({ width: W, height: H });
  await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil:'networkidle0' });
  await p.evaluate(names => { skipWelcome(); recentQuickSetups = names; }, recent); await wait(1200);
  await p.evaluate(() => toggleLibraryPopover(0, true)); await wait(400);
  return p;
}
const menuState = p => p.evaluate(() => {
  const m = document.getElementById('quick-setup-menu-0'), r = m.getBoundingClientRect();
  const groups = [...m.querySelectorAll('.quick-setup-group')].map(g => ({
    label: g.querySelector('.quick-setup-group-label').textContent,
    names: [...g.querySelectorAll('.quick-setup-option-name')].map(n => n.textContent),
  }));
  const opts = [...m.querySelectorAll('.quick-setup-option')];
  return { groups, n: opts.length, visible: opts.filter(o => o.getBoundingClientRect().bottom <= r.bottom + 1).length, hasMore: m.classList.contains('has-more') };
});

{
  const p = await open(1440, 900);
  const s = await menuState(p);
  P('built-in libraries are grouped by maker', s.groups.map(g => g.label).join() === 'Spitfire,Sonuscore', JSON.stringify(s.groups.map(g => g.label)));
  const sso = (s.groups.find(g => g.label === 'Spitfire')?.names || []).filter(n => n.startsWith('Spitfire Symphony Orchestra'));
  P('SSO presets run ensemble, Violins 1, Violas, Celli, Basses', sso.map(n => n.match(/– (\w+(?: 1)?)/)[1]).join() === 'Ensembles,Violins 1,Violas,Celli,Basses', JSON.stringify(sso));
  P('all 14 libraries are visible at 1440×900 without scrolling', s.n === 14 && s.visible === 14, JSON.stringify({ n: s.n, visible: s.visible }));
  P('no fade when nothing is below the fold', !s.hasMore);
  await p.evaluate(() => { const i = document.getElementById('quick-setup-input-0'); i.value = 'violas'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await wait(200);
  const q = await menuState(p);
  P('search still filters across makers', q.n === 2 && q.groups.map(g => g.label).join() === 'Spitfire,Sonuscore', JSON.stringify(q.groups));
  await p.close();
}

{
  const p = await open(1440, 700, ['Sonuscore LUX – Celli', 'Spitfire Chamber Strings', 'Spitfire UACC – Brass']);
  const s = await menuState(p);
  P('overflowing list shows the bottom fade', s.visible < s.n && s.hasMore, JSON.stringify({ n: s.n, visible: s.visible, hasMore: s.hasMore }));
  await p.evaluate(() => { const m = document.getElementById('quick-setup-menu-0'); m.scrollTop = m.scrollHeight; m.dispatchEvent(new Event('scroll')); });
  await wait(200);
  P('fade disappears at the end of the list', !(await menuState(p)).hasMore);
  await p.close();
}

P('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
