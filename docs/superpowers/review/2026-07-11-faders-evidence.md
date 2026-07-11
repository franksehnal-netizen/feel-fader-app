# Evidence dump — feel-fader.html @ main (pro Codex review, faders-display-only)

Vše z `git show main:feel-fader.html`. Číslování řádků = řádky na main. Extrahoval Claude, protože Codexův sandbox blokuje git-show pipeline. Ověř logiku nad tímto výpisem.

## REFERENČNÍ TABULKA (symbol → řádky)
```
### \bmF\b
2429:function onDrag(e){if(dragging)mF(dragging,e.clientY);}
2430:function onDragT(e){e.preventDefault();if(dragging)mF(dragging,e.touches[0].clientY);}
2432:function mF(k,cy){

### \bdrag\b
1106:        <div class="fader-track" id="track-l" data-fader="fader1" onmouseenter="hoverFaderLink('fader1',true)" onmouseleave="hoverFaderLink('fader1',false)" onmousedown="drag(event,'l')" ontouchs
1109:        <div class="fader-track" id="track-r" data-fader="fader2" onmouseenter="hoverFaderLink('fader2',true)" onmouseleave="hoverFaderLink('fader2',false)" onmousedown="drag(event,'r')" ontouchs
2257:// Light slider refresh during drag (without full render — smooth)
2427:function drag(e,k){e.preventDefault();dragging=k;document.addEventListener('mousemove',onDrag);document.addEventListener('mouseup',stopDrag);}
2438:  if(jsonOpen)refreshJson();   // drag = jen vizualizace, nemění config (audit I5)
3489:window.drag              = drag;

### \bdragT\b
1106:        <div class="fader-track" id="track-l" data-fader="fader1" onmouseenter="hoverFaderLink('fader1',true)" onmouseleave="hoverFaderLink('fader1',false)" onmousedown="drag(event,'l')" ontouchs
1109:        <div class="fader-track" id="track-r" data-fader="fader2" onmouseenter="hoverFaderLink('fader2',true)" onmouseleave="hoverFaderLink('fader2',false)" onmousedown="drag(event,'r')" ontouchs
2428:function dragT(e,k){dragging=k;document.addEventListener('touchmove',onDragT,{passive:false});document.addEventListener('touchend',stopDrag);}
3490:window.dragT             = dragT;

### onDrag\b
2427:function drag(e,k){e.preventDefault();dragging=k;document.addEventListener('mousemove',onDrag);document.addEventListener('mouseup',stopDrag);}
2429:function onDrag(e){if(dragging)mF(dragging,e.clientY);}
2431:function stopDrag(){dragging=null;document.removeEventListener('mousemove',onDrag);document.removeEventListener('mouseup',stopDrag);document.removeEventListener('touchmove',onDragT);document.remo

### onDragT\b
2428:function dragT(e,k){dragging=k;document.addEventListener('touchmove',onDragT,{passive:false});document.addEventListener('touchend',stopDrag);}
2430:function onDragT(e){e.preventDefault();if(dragging)mF(dragging,e.touches[0].clientY);}
2431:function stopDrag(){dragging=null;document.removeEventListener('mousemove',onDrag);document.removeEventListener('mouseup',stopDrag);document.removeEventListener('touchmove',onDragT);document.remo

### stopDrag
2427:function drag(e,k){e.preventDefault();dragging=k;document.addEventListener('mousemove',onDrag);document.addEventListener('mouseup',stopDrag);}
2428:function dragT(e,k){dragging=k;document.addEventListener('touchmove',onDragT,{passive:false});document.addEventListener('touchend',stopDrag);}
2431:function stopDrag(){dragging=null;document.removeEventListener('mousemove',onDrag);document.removeEventListener('mouseup',stopDrag);document.removeEventListener('touchmove',onDragT);document.remo

### \bdragging\b
1448:let dragging   = null;
2427:function drag(e,k){e.preventDefault();dragging=k;document.addEventListener('mousemove',onDrag);document.addEventListener('mouseup',stopDrag);}
2428:function dragT(e,k){dragging=k;document.addEventListener('touchmove',onDragT,{passive:false});document.addEventListener('touchend',stopDrag);}
2429:function onDrag(e){if(dragging)mF(dragging,e.clientY);}
2430:function onDragT(e){e.preventDefault();if(dragging)mF(dragging,e.touches[0].clientY);}
2431:function stopDrag(){dragging=null;document.removeEventListener('mousemove',onDrag);document.removeEventListener('mouseup',stopDrag);document.removeEventListener('touchmove',onDragT);document.remo

### \bpF\b
2392:function positionThumbs(){pF('track-l','thumb-l',liveValues.f1);pF('track-r','thumb-r',liveValues.f2);}
2410:  if(_faderDirty.l){ _faderDirty.l=false; pF('track-l','thumb-l',liveValues.f1); setTxt('f1-val',liveValues.f1); liveOn('f1-val'); }
2411:  if(_faderDirty.r){ _faderDirty.r=false; pF('track-r','thumb-r',liveValues.f2); setTxt('f2-val',liveValues.f2); liveOn('f2-val'); }
2413:function pF(tid,thid,v){
2436:  if(k==='l'){liveValues.f1=v;pF('track-l','thumb-l',v);setTxt('f1-val',v);setBar('f1-bar',v);}
2437:  else{liveValues.f2=v;pF('track-r','thumb-r',v);setTxt('f2-val',v);setBar('f2-bar',v);}

### applyInfoFaders
2395:function applyInfoFaders(info){
2805:  const _faders = applyInfoFaders(info);   // set liveValues BEFORE render (render recreates value spans)

### flushFaderFrame
2406:  requestAnimationFrame(flushFaderFrame);
2408:function flushFaderFrame(){

### positionThumbs
2375:function onImgLoad(){layoutFaders();document.getElementById('fader-tracks').style.display='block';positionThumbs();}
2392:function positionThumbs(){pF('track-l','thumb-l',liveValues.f1);pF('track-r','thumb-r',liveValues.f2);}
2809:    positionThumbs();                       // thumbs live in the (persistent) stage, not rebuilt by render
2812:    requestAnimationFrame(positionThumbs);  // best-effort follow-up if geometry wasn't ready yet
2957:  render();positionThumbs();toast('i',t('toast.reset'));
3526:  setTimeout(positionThumbs, 80);
3530:window.addEventListener('resize',()=>{layoutFaders();positionThumbs();});</script>

### refreshJson
1475:  if (jsonOpen) refreshJson();
1983:  if (jsonOpen) refreshJson();
2054:function selectBank(i){ activeBank=i; renderPanels(); renderUacc(); runValidation(); setActiveTab(i); if(jsonOpen)refreshJson(); }
2438:  if(jsonOpen)refreshJson();   // drag = jen vizualizace, nemění config (audit I5)
2971:  if(jsonOpen)refreshJson();
2997:function refreshJson(){document.getElementById('json-pre').textContent=JSON.stringify(cfg,null,2);}

### _faderDirty
1443:let _faderDirty    = { l:false, r:false };
2410:  if(_faderDirty.l){ _faderDirty.l=false; pF('track-l','thumb-l',liveValues.f1); setTxt('f1-val',liveValues.f1); liveOn('f1-val'); }
2411:  if(_faderDirty.r){ _faderDirty.r=false; pF('track-r','thumb-r',liveValues.f2); setTxt('f2-val',liveValues.f2); liveOn('f2-val'); }
2538:      liveValues.f1=val;_faderDirty.l=true;scheduleFaderFrame();
2541:      liveValues.f2=val;_faderDirty.r=true;scheduleFaderFrame();

```

## KÓDOVÉ BLOKY

### stav (1440-1450)
```js
let liveBank   = 0;
let liveValues = { f1:64, f2:64 };
let _faderTravel   = 0;                 // T4: cachovaná dráha thumbu (px) = trackH - thumbH
let _faderDirty    = { l:false, r:false };
let _faderRafPending = false;
let encIndex   = 0;
let encLiveVal = null; // null = not yet received from device
let ksLiveNote = null; // poslední NoteOn z ks_channel (S7b)
let dragging   = null;
let loaded     = !!_savedCfg;
let dirty      = false;
```
### track HTML (1106, 1109)
```html
        <div class="fader-track" id="track-l" data-fader="fader1" onmouseenter="hoverFaderLink('fader1',true)" onmouseleave="hoverFaderLink('fader1',false)" onmousedown="drag(event,'l')" ontouchstart="dragT(event,'l')">
        <div class="fader-track" id="track-r" data-fader="fader2" onmouseenter="hoverFaderLink('fader2',true)" onmouseleave="hoverFaderLink('fader2',false)" onmousedown="drag(event,'r')" ontouchstart="dragT(event,'r')">
```
### positionThumbs / applyInfoFaders / scheduleFaderFrame / flushFaderFrame / pF (2392-2425)
```js
function positionThumbs(){pF('track-l','thumb-l',liveValues.f1);pF('track-r','thumb-r',liveValues.f2);}
// Sync-on-connect (A1): apply fader positions reported by firmware in CMD_INFO (info.faders=[v1,v2], 0-127).
// Sets liveValues only (state) — caller positions DOM after render(). Defensive: absent/invalid -> no-op, returns false.
function applyInfoFaders(info){
  if(!info || !Array.isArray(info.faders) || info.faders.length < 2) return false;
  const a = Number(info.faders[0]), b = Number(info.faders[1]);
  if(!isFinite(a) || !isFinite(b)) return false;
  const clamp7 = v => Math.max(0, Math.min(127, Math.round(v)));
  liveValues.f1 = clamp7(a); liveValues.f2 = clamp7(b);
  return true;
}
function scheduleFaderFrame(){
  if(_faderRafPending)return;
  _faderRafPending=true;
  requestAnimationFrame(flushFaderFrame);
}
function flushFaderFrame(){
  _faderRafPending=false;
  if(_faderDirty.l){ _faderDirty.l=false; pF('track-l','thumb-l',liveValues.f1); setTxt('f1-val',liveValues.f1); liveOn('f1-val'); }
  if(_faderDirty.r){ _faderDirty.r=false; pF('track-r','thumb-r',liveValues.f2); setTxt('f2-val',liveValues.f2); liveOn('f2-val'); }
}
function pF(tid,thid,v){
  const th=document.getElementById(thid);
  if(!th)return;
  // T4: použij cachovanou dráhu; fallback na měření jen když ještě nebyl layout
  let travel=_faderTravel;
  if(travel<=0){
    const tr=document.getElementById(tid);
    if(!tr)return;
    travel=tr.offsetHeight-(th.offsetHeight||24);
  }
  // move via transform (own compositor layer) not top: iOS WebKit smears the img's
  // drop-shadow into ghost trails when a filtered element is animated via top (non-composited)
  th.style.transform='translate3d(-50%,'+Math.round((1-v/127)*travel)+'px,0)';
```
### drag/dragT/onDrag/onDragT/stopDrag/mF (2427-2439)
```js
function drag(e,k){e.preventDefault();dragging=k;document.addEventListener('mousemove',onDrag);document.addEventListener('mouseup',stopDrag);}
function dragT(e,k){dragging=k;document.addEventListener('touchmove',onDragT,{passive:false});document.addEventListener('touchend',stopDrag);}
function onDrag(e){if(dragging)mF(dragging,e.clientY);}
function onDragT(e){e.preventDefault();if(dragging)mF(dragging,e.touches[0].clientY);}
function stopDrag(){dragging=null;document.removeEventListener('mousemove',onDrag);document.removeEventListener('mouseup',stopDrag);document.removeEventListener('touchmove',onDragT);document.removeEventListener('touchend',stopDrag);}
function mF(k,cy){
  const tid=k==='l'?'track-l':'track-r',tr=document.getElementById(tid),rect=tr.getBoundingClientRect();
  const thH=document.getElementById(k==='l'?'thumb-l':'thumb-r').offsetHeight||24;
  const v=Math.round((1-Math.max(0,Math.min(1,(cy-rect.top-thH/2)/(rect.height-thH))))*127);
  if(k==='l'){liveValues.f1=v;pF('track-l','thumb-l',v);setTxt('f1-val',v);setBar('f1-bar',v);}
  else{liveValues.f2=v;pF('track-r','thumb-r',v);setTxt('f2-val',v);setBar('f2-bar',v);}
  if(jsonOpen)refreshJson();   // drag = jen vizualizace, nemění config (audit I5)
}
```
### MIDI-in CC → _faderDirty (2535,2542)
```js
  if(type===0xB0){
    const cc=data[1],val=data[2];
    if(cc===bank.fader1.cc && ch===bank.fader1.channel){
      liveValues.f1=val;_faderDirty.l=true;scheduleFaderFrame();
    }
    if(cc===bank.fader2.cc && ch===bank.fader2.channel){
      liveValues.f2=val;_faderDirty.r=true;scheduleFaderFrame();
    }
```
### serial INFO apply (2804,2813)
```js
  try { localStorage.setItem(LS_SERIAL_PID_KEY, _serialPort.getInfo().usbProductId); } catch(e) {}
  const _faders = applyInfoFaders(info);   // set liveValues BEFORE render (render recreates value spans)
  updateDeviceInfo(); updateHidToggle();
  render();   // re-render roller selector — track_nav gating depends on hid_enabled
  if (_faders) {
    positionThumbs();                       // thumbs live in the (persistent) stage, not rebuilt by render
    setTxt('f1-val', liveValues.f1); setTxt('f2-val', liveValues.f2);
    liveOn('f1-val'); liveOn('f2-val');
    requestAnimationFrame(positionThumbs);  // best-effort follow-up if geometry wasn't ready yet
  }
```
### window global exporty (3488,3491)
```js
window.copyJson          = copyJson;
window.drag              = drag;
window.dragT             = dragT;
window.onTagKeydown      = onTagKeydown;
```
### refreshJson (2997)
```js
function refreshJson(){document.getElementById('json-pre').textContent=JSON.stringify(cfg,null,2);}
```
