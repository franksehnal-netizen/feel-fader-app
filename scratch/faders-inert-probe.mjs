import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://localhost:8100/feel-fader.html';

const out = (label, ok, extra='') => console.log(`${ok?'PASS':'FAIL'}  ${label}${extra?'  — '+extra:''}`);

const b = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, args:['--no-sandbox'] });
const p = await b.newPage();
await p.emulateMediaFeatures([{ name:'prefers-reduced-motion', value:'no-preference' }]);
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
await p.goto(URL, { waitUntil:'networkidle0' });
await new Promise(resolve=>setTimeout(resolve,700));

const welcomeShadow = await p.evaluate(() => {
  const img=document.getElementById('device-img');
  const light=getComputedStyle(img).boxShadow;
  document.documentElement.classList.add('dark');
  const dark=getComputedStyle(img).boxShadow;
  document.documentElement.classList.remove('dark');
  return {light,dark};
});
const shadowIsInvisible = value => value === 'none' || [...value.matchAll(/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*([\d.]+)\s*\)/g)].every(match => Number(match[1]) === 0);
out('welcome device has no visible resting shadow in light mode', shadowIsInvisible(welcomeShadow.light), welcomeShadow.light);
out('welcome device has no visible resting shadow in dark mode', shadowIsInvisible(welcomeShadow.dark), welcomeShadow.dark);

// Welcome -> app transition settles on the device snapshot with the same mapping
// as the persistent stage, instead of moving both faders to a hardcoded midpoint.
const welcome = await p.evaluate(async () => {
  applyInfoFaders({faders:[110,15]});
  window.scrollTo(0, document.documentElement.scrollHeight);
  await new Promise(resolve=>requestAnimationFrame(resolve));
  const scrollBefore = window.scrollY;
  const deviceImg = document.getElementById('device-img');
  const welcomeRect = deviceImg.getBoundingClientRect();
  const sample = (thumbId, railId, value) => {
    const thumb=document.getElementById(thumbId), rail=document.getElementById(railId);
    const img=thumb.querySelector('img');
    // The product tour may render the shared controller at a visual scale;
    // connectTransitionWelcome settles it into the full-size app stage, so the
    // final target is based on the rail's local (untransformed) travel.
    const travel=rail.offsetHeight-img.offsetHeight;
    return { thumb, rail, expected:Math.round((1-value/127)*travel) };
  };
  const l=sample('thumb-l','track-l',110);
  const r=sample('thumb-r','track-r',15);
  const beforeL=l.thumb.getBoundingClientRect().top-l.rail.getBoundingClientRect().top;
  const beforeR=r.thumb.getBoundingClientRect().top-r.rail.getBoundingClientRect().top;
  connectTransitionWelcome();
  const alignedRect = document.getElementById('device-img').getBoundingClientRect();
  const scrollAfterStart = window.scrollY;
  const frozenL=l.thumb.getBoundingClientRect().top-l.rail.getBoundingClientRect().top;
  const frozenR=r.thumb.getBoundingClientRect().top-r.rail.getBoundingClientRect().top;
  await new Promise(resolve=>setTimeout(resolve,100));
  const welcomeDevice=document.getElementById('device-wrap');
  const successAnimationNames = [
    getComputedStyle(document.getElementById('device-img')).animationName,
    getComputedStyle(document.getElementById('welcome-flash')).animationName,
    getComputedStyle(welcomeDevice,'::after').animationName
  ];
  const glowAnimation = document.getElementById('device-img').getAnimations()
    .find(animation=>animation.animationName==='welcome-device-glow');
  const glowShadows = glowAnimation ? glowAnimation.effect.getKeyframes().map(frame=>frame.boxShadow||'') : [];
  await new Promise(resolve=>setTimeout(resolve,700));
  const settledLeft=l.thumb.getBoundingClientRect().top-l.rail.getBoundingClientRect().top;
  const settledRight=r.thumb.getBoundingClientRect().top-r.rail.getBoundingClientRect().top;
  await new Promise(resolve=>setTimeout(resolve,650));
  const finalRect = document.getElementById('device-img').getBoundingClientRect();
  const homeRect = document.getElementById('device-home').getBoundingClientRect();
  return {
    scrollBefore,scrollAfterStart,scrollFinal:window.scrollY,
    welcomeRect:{top:welcomeRect.top,left:welcomeRect.left,width:welcomeRect.width},
    alignedRect:{top:alignedRect.top,left:alignedRect.left,width:alignedRect.width},
    finalRect:{top:finalRect.top,left:finalRect.left,width:finalRect.width},
    homeRect:{top:homeRect.top,left:homeRect.left,width:homeRect.width},
    freezeDeltaLeft:Math.abs(frozenL-beforeL),
    freezeDeltaRight:Math.abs(frozenR-beforeR),
    left:settledLeft,
    leftExpected:l.expected,
    right:settledRight,
    rightExpected:r.expected,
    leftTransition:getComputedStyle(l.thumb).transitionProperty,
    rightTransition:getComputedStyle(r.thumb).transitionProperty,
    sameDeviceNode:deviceImg===document.getElementById('device-img'),
    successAnimationNames,
    glowShadows
  };
});
out('welcome animation freezes without a first-frame jump',
  welcome.freezeDeltaLeft<1 && welcome.freezeDeltaRight<1,
  `ΔL ${welcome.freezeDeltaLeft.toFixed(2)}px, ΔR ${welcome.freezeDeltaRight.toFixed(2)}px`);
out('welcome left settles on device snapshot', Math.abs(welcome.left-welcome.leftExpected)<1.5,
  `${welcome.left.toFixed(1)}px / ${welcome.leftExpected}px`);
out('welcome right settles on device snapshot', Math.abs(welcome.right-welcome.rightExpected)<1.5,
  `${welcome.right.toFixed(1)}px / ${welcome.rightExpected}px`);
out('welcome settle stays on transform compositor path',
  welcome.leftTransition.startsWith('transform') && welcome.rightTransition.startsWith('transform'));
out('connect confirmation uses the restrained halo, outline and shimmer treatment',
  ['welcome-device-glow','welcome-device-halo','welcome-device-shimmer'].every(name=>welcome.successAnimationNames.includes(name)) &&
  welcome.glowShadows.every(shadow=>!shadow.includes('160px')&&!shadow.includes('90px')),
  welcome.successAnimationNames.join(', '));
out('welcome transition always resets a previously scrolled app to top',
  welcome.scrollBefore>0 && welcome.scrollAfterStart===0 && welcome.scrollFinal===0,
  `${welcome.scrollBefore} → ${welcome.scrollAfterStart} → ${welcome.scrollFinal}`);
out('single controller persists while the app resets to its canonical top position',
  welcome.sameDeviceNode && Math.abs(welcome.homeRect.left-welcome.finalRect.left)<1 &&
  Math.abs(welcome.homeRect.width-welcome.finalRect.width)<1 && Math.abs(welcome.homeRect.top-welcome.finalRect.top)<1,
  JSON.stringify({welcome:welcome.welcomeRect,aligned:welcome.alignedRect,final:welcome.finalRect,home:welcome.homeRect}));

const linkPage = await b.newPage();
await linkPage.goto(URL,{waitUntil:'networkidle0'});
const linkedHighlight = await linkPage.evaluate(async () => {
  skipWelcome();
  render();
  const read = async () => {
    hoverFaderLink('fader1',true);
    hoverFaderLink('roller',true);
    const sectionEl=document.querySelector('.bank-section[data-fader="fader1"]');
    const sectionClassOn=sectionEl.className;
    await new Promise(resolve=>setTimeout(resolve,400));
    const sectionStyle=getComputedStyle(sectionEl);
    const section=sectionStyle.backgroundColor;
    const track=getComputedStyle(document.getElementById('track-l'),'::before').backgroundColor;
    const zoneStyle=getComputedStyle(document.getElementById('zone-roller'));
    const zone=zoneStyle.backgroundColor;
    const zoneOutline=zoneStyle.outlineColor;
    hoverFaderLink('fader1',false);
    hoverFaderLink('roller',false);
    return {section,track,zone,zoneOutline,sectionClassOn,sectionClass:sectionEl.className,sectionFill:sectionStyle.getPropertyValue('--highlight-section-fill')};
  };
  const light=await read();
  document.documentElement.classList.add('dark');
  const dark=await read();
  document.documentElement.classList.remove('dark');
  return {light,dark};
});
await linkPage.close();
const linkedHighlightOk = theme => {
  const rgba = value => (value.match(/[\d.]+/g)||[]).map(Number);
  const section=rgba(theme.section),track=rgba(theme.track),zone=rgba(theme.zone),outline=rgba(theme.zoneOutline);
  return section.slice(0,3).join(',')===track.slice(0,3).join(',') &&
    track.slice(0,3).join(',')===outline.slice(0,3).join(',') &&
    track[3]>section[3] && zone[3]===0 && outline[3]>.4;
};
out('roller highlight keeps its surface untinted while sharing the linked hue',
  linkedHighlightOk(linkedHighlight.light) && linkedHighlightOk(linkedHighlight.dark),
  JSON.stringify(linkedHighlight));

for (const viewport of [{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844}]) {
  const vp = await b.newPage();
  await vp.setViewport({width:viewport.width,height:viewport.height});
  await vp.goto(URL,{waitUntil:'networkidle0'});
  const rects = await vp.evaluate(async () => {
    window.scrollTo(0,document.documentElement.scrollHeight);
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const device=document.getElementById('device-img');
    const welcome=device.getBoundingClientRect();
    connectTransitionWelcome();
    await new Promise(resolve=>setTimeout(resolve,1450));
    const app=document.getElementById('device-img').getBoundingClientRect();
    return {
      scrollY:window.scrollY,
      sameNode:device===document.getElementById('device-img'),
      welcome:{top:welcome.top,left:welcome.left,width:welcome.width},
      app:{top:app.top,left:app.left,width:app.width}
    };
  });
  const identical = rects.sameNode && rects.app.top>=0 &&
    Math.abs(rects.app.left-rects.welcome.left)<1 &&
    Math.abs(rects.app.width-rects.welcome.width)<1;
  out(`${viewport.name} transition resets to top without replacing the controller`,
    rects.scrollY===0 && identical,JSON.stringify(rects));
  await vp.close();
}

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
  const cfgBefore=JSON.stringify(cfg);
  const tr=document.getElementById('track-l'), rect=tr.getBoundingClientRect();
  const fire=(type,y)=>tr.dispatchEvent(new MouseEvent(type,{bubbles:true,clientY:y,clientX:rect.left+5}));
  fire('mousedown',rect.top+5); fire('mousemove',rect.top+rect.height*0.5);
  document.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientY:rect.top+rect.height*0.5}));
  document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
  return { moved: th.style.transform!==before, cfgChanged: JSON.stringify(cfg)!==cfgBefore };
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
