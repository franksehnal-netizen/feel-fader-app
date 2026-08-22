// Regression probe: separate the selected editing bank (.active glass pill)
// from the bank active on the physical device (.is-live green inset rail).
// A connection update must paint the rail immediately, without a tab click.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' — '+x:''}`);
const p = await b.newPage();
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await p.evaluate(() => skipWelcome());

const result = await p.evaluate(() => {
  addBank(); addBank();
  activeBank = 2;
  liveBank = 0;
  _ffConnected = false;
  renderBankTabs();
  const before = [...document.querySelectorAll('.bank-block-tab')].map(tab => tab.classList.contains('is-live'));

  // Simulates the post-CMD_INFO connection state: no selectBank() call.
  _ffConnected = true;
  renderConnState();
  const tabs = [...document.querySelectorAll('.bank-block-tab')];
  return {
    before,
    liveTabHasRail: tabs[0]?.classList.contains('is-live'),
    liveTabIsNotActive: !tabs[0]?.classList.contains('active'),
    activeTabHasNoRail: !tabs[2]?.classList.contains('is-live'),
    activeTabIsActive: !!tabs[2]?.classList.contains('active'),
    railColor: getComputedStyle(tabs[0].querySelector('.bank-tab-live-rail')).backgroundColor,
    oldDotGone: !document.querySelector('.bank-tab-live-dot'),
  };
});
P('live device rail appears immediately on connection, with no tab click', result.before.every(v => v === false) && result.liveTabHasRail, JSON.stringify(result));
P('live rail uses the green inset accent', result.railColor.includes('52, 199, 89'), result.railColor);
P('live bank is correctly not flagged as the edit target', result.liveTabIsNotActive);
P('selected bank stays active but has no live rail', result.activeTabHasNoRail && result.activeTabIsActive, JSON.stringify(result));
P('old pulsing live dot is fully gone', result.oldDotGone);
await p.close();
await b.close();
