// Regression probe: desktop bank utility actions should be compact and live
// at the far edge of the bank card, without changing the touch layout.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' — '+x:''}`);
const p = await b.newPage();
await p.setViewport({ width:1280, height:900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await p.evaluate(() => skipWelcome());
const result = await p.evaluate(() => {
  const card = document.querySelector('.bank-card');
  const title = document.querySelector('.bank-block-name-top');
  const actions = document.querySelector('.bank-actions');
  const firstAction = actions.querySelector('button');
  const cardRect = card.getBoundingClientRect();
  const actionsRect = actions.getBoundingClientRect();
  const actionStyle = getComputedStyle(firstAction);
  return {
    actionsRightGap: Math.round(cardRect.right - actionsRect.right),
    titleWidth: Math.round(title.getBoundingClientRect().width),
    actionWidth: actionStyle.width,
    actionHeight: actionStyle.height,
  };
});
P('desktop bank actions sit at the card’s right edge', result.actionsRightGap >= 12 && result.actionsRightGap <= 16 && result.titleWidth > 300, JSON.stringify(result));
P('desktop bank actions use a compact 24px hit area', result.actionWidth === '24px' && result.actionHeight === '24px', JSON.stringify(result));
await p.close();
await b.close();
