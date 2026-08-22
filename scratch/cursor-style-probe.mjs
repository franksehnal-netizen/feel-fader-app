import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage();
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
await p.evaluate(() => skipWelcome());
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' — '+x:''}`);

const result = await p.evaluate(async () => {
  const source = await fetch('/feel-fader.html').then(r => r.text());
  const interactive = [...document.querySelectorAll('button,summary,.section-head.section-toggle,label.uacc-note')];
  const customCursor = interactive
    .map(el => ({tag:el.tagName,className:el.className,cursor:getComputedStyle(el).cursor}))
    .filter(item => item.cursor.includes('url(') || item.cursor.includes('data:image'));
  return {
    sourceHasFaderCursor: source.includes('--cursor-fader'),
    customCursor,
    sendCursor: getComputedStyle(document.getElementById('send-btn')).cursor,
    sectionCursor: getComputedStyle(document.querySelector('.section-head.section-toggle')).cursor,
  };
});
P('Fader-cap cursor token is removed from the source', !result.sourceHasFaderCursor);
P('Interactive controls no longer receive a data-URL cursor', result.customCursor.length===0, JSON.stringify(result.customCursor));
P('Send button uses the system pointer cursor', result.sendCursor==='pointer', result.sendCursor);
P('Section toggle uses the system pointer cursor', result.sectionCursor==='pointer', result.sectionCursor);

await b.close();
