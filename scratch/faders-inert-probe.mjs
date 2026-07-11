import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://localhost:8100/feel-fader.html';

const out = (label, ok, extra='') => console.log(`${ok?'PASS':'FAIL'}  ${label}${extra?'  — '+extra:''}`);

const b = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, args:['--no-sandbox'] });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
await p.goto(URL, { waitUntil:'networkidle0' });

// skip welcome + render device UI
await p.evaluate(() => { try{ skipWelcome && skipWelcome(); }catch(e){}; try{ render && render(); }catch(e){}; });
await new Promise(r=>setTimeout(r,150));

// 1) window.drag / window.dragT gone
const g = await p.evaluate(() => ({ d: typeof window.drag, t: typeof window.dragT }));
out('window.drag undefined', g.d==='undefined', g.d);
out('window.dragT undefined', g.t==='undefined', g.t);

// 2) track attrs gone
const attrs = await p.evaluate(() => {
  const l=document.getElementById('track-l'), r=document.getElementById('track-r');
  return { l:l&&(l.getAttribute('onmousedown')||l.getAttribute('ontouchstart')),
           r:r&&(r.getAttribute('onmousedown')||r.getAttribute('ontouchstart')) };
});
out('track-l no drag attrs', !attrs.l, attrs.l||'clean');
out('track-r no drag attrs', !attrs.r, attrs.r||'clean');

// 3) mouse drag attempt does NOT move thumb + cfg unchanged
const mouse = await p.evaluate(() => {
  const th=document.getElementById('thumb-l');
  const before=th.style.transform;
  const cfgBefore=JSON.stringify(window.cfg);
  const tr=document.getElementById('track-l'), rect=tr.getBoundingClientRect();
  const fire=(type,y)=>tr.dispatchEvent(new MouseEvent(type,{bubbles:true,clientY:y,clientX:rect.left+5}));
  fire('mousedown',rect.top+5); fire('mousemove',rect.top+rect.height*0.5);
  document.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientY:rect.top+rect.height*0.5}));
  document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
  return { moved: th.style.transform!==before, cfgChanged: JSON.stringify(window.cfg)!==cfgBefore };
});
out('mouse drag does NOT move thumb', !mouse.moved);
out('cfg unchanged after mouse drag', !mouse.cfgChanged);

// 4) touch drag attempt does NOT move thumb
const touch = await p.evaluate(() => {
  const th=document.getElementById('thumb-l'); const before=th.style.transform;
  const tr=document.getElementById('track-l'), rect=tr.getBoundingClientRect();
  const mk=(type,y)=>{ const t={clientY:y,clientX:rect.left+5,identifier:1,target:tr};
    return new TouchEvent(type,{bubbles:true,cancelable:true,touches:[t],changedTouches:[t]}); };
  try{ tr.dispatchEvent(mk('touchstart',rect.top+5)); document.dispatchEvent(mk('touchmove',rect.top+rect.height*0.5)); }catch(e){}
  return th.style.transform!==before;
});
out('touch drag does NOT move thumb', !touch);

// 5) HW path still moves thumbs
const hw = await p.evaluate(() => {
  const th=document.getElementById('thumb-l'); const before=th.style.transform;
  applyInfoFaders({faders:[100,20]}); positionThumbs();
  return { after: th.style.transform, moved: th.style.transform!==before };
});
out('HW path (applyInfoFaders+positionThumbs) moves thumb', hw.moved, hw.after);

out('no page errors', errs.length===0, errs.join(' | '));
await b.close();
