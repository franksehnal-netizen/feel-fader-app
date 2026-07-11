# Evidence dump — connection-state kód @ main (pro Codex review connection-state-model)

Vše z `git show main:feel-fader.html`. Číslování = řádky na main. Extrahoval controller (Codex sandbox blokuje git pipeline). Ověř logiku nad tímto výpisem; když chybí region, řekni symbol/řádek.

## REFERENČNÍ TABULKA (symbol → řádky)
```
### setBanner
2444:  if(!navigator.requestMIDIAccess){setBanner('error','');return;}
2445:  setBanner('searching','');
2461:  },()=>setBanner('error',t('midi.denied')));
2491:    setBanner('connected',names.join(', '));
2512:      setBanner('searching', t('midi.not_feel_fader'));
2514:      setBanner('searching', t('midi.none'));
2573:function setBanner(type, m){
2605:  try { await loadConfigFromDevice(); setBanner('connected', t('midi.synced')); toast('s', t('toast.config_loaded')); }
2664:      setBanner('connected',t('midi.synced'));
2669:      setBanner('connected', '');
2849:    setBanner('connected', t('midi.synced'));
2875:          showSyncBanner('defaults'); setBanner('searching', '');
2878:          showSyncBanner('differs'); setBanner('searching', '');
2881:          setBanner('connected', t('midi.synced')); toast('s', t('toast.config_loaded'));
2885:        setBanner('searching', '');

### updateStatus
1475:  // NOTE: updateStatus() intentionally NOT called here.
1478:  // updateStatus() is called only from: connectInputs() and handleSysEx().
2492:    // NOTE: do NOT call updateStatus() here — when loaded=false it overwrites the
2516:    updateStatus();
2665:      updateStatus();
2827:  updateStatus();
3002:function updateStatus(){

### _ffConnected
1460:let _ffConnected = false;   // true once Feel Fader input is live
1488:    const liveDot = (i === liveBank && _ffConnected) ? '<span class="bank-tab-live" title="Active on device"></span>' : '';
1506:    if(idx===liveBank && _ffConnected && !btn.querySelector('.bank-tab-live')){
1612:      <span class="section-live-val${_ffConnected ? '' : ' live-placeholder'}" id="${valId}-val">${lv}</span>
1829:      ${badge ? `<span class="section-live-val${_ffConnected ? '' : ' live-placeholder'}" id="enc-artic-badge">${badge}</span>` : ''}
1919:  if(el){ el.checked = !!DEVICE_INFO.hid_enabled; el.disabled = !(_ffConnected || DEVICE_INFO.hid_available); }
2454:      const isChurn = _ffConnected && p && p.state === 'connected';
2494:    if (!_ffConnected) {
2495:      _ffConnected = true;
2504:    _ffConnected = false;   // reset so the next physical connect triggers a fresh CMD_R
2898:  if (!_ffConnected && !_serialPort) toast('i', "No device on MIDI — choose your Feel Fader's USB serial port to continue.");

### _serialPort
1946:    if (!errReason && e.message !== 'timeout' && e.name !== 'AbortError' && _serialPort) { try { await _serialPort.close(); } catch(_){} _serialPort=null; 
2614:let _serialPort   = null;  // Web Serial port (cached for session)
2700:  if (_serialPort && _serialPort.readable) return;
2701:  _serialPort = null;
2712:        if (p.readable) { _serialPort = p; return; }
2714:        _serialPort = p; return;
2721:  _serialPort = port;
2730:    const port = _serialPort;
2798:  try { localStorage.setItem(LS_SERIAL_PID_KEY, _serialPort.getInfo().usbProductId); } catch(e) {}
2821:  try { localStorage.setItem(LS_SERIAL_PID_KEY, _serialPort.getInfo().usbProductId); } catch(e) {}
2853:    if (e.name !== 'AbortError' && _serialPort) { try { await _serialPort.close(); } catch(_) {} _serialPort = null; }
2898:  if (!_ffConnected && !_serialPort) toast('i', "No device on MIDI — choose your Feel Fader's USB serial port to continue.");
2919:    if (!errReason && e.message !== 'timeout' && e.name !== 'AbortError' && _serialPort) {
2920:      try { await _serialPort.close(); } catch(_) {} _serialPort = null;

### \bloaded\b
887:.loaded .section-live-val{
1061:html.dark.loaded .section-live-val{color:var(--t2);}
1454:let loaded     = !!_savedCfg;
1476:  // It depends on `loaded`, so calling it on every render() would flash
2492:    // NOTE: do NOT call updateStatus() here — when loaded=false it overwrites the
2505:    // Don't tear down UI if config is already loaded — device may reconnect shortly
2506:    if (!loaded) {
2662:      cfg=p;loaded=true;dirty=false;activeBank=0;
2819:  cfg = p; loaded = true; dirty = false; activeBank = 0;
2943:      cfg=p;loaded=true;dirty=false;activeBank=0;cfgSave();render();toast('s',t('toast.preset_imported'));
2950:  activeBank=0;liveBank=0;liveValues={f1:64,f2:64};encIndex=0;loaded=false;dirty=false;
3006:  if (loaded) {
3009:    document.body.classList.add('loaded');
3015:    document.body.classList.remove('loaded');
3101:    'toast.config_loaded': 'Configuration loaded from device',
3458:  toast('s', `"${name}" loaded — ${preset.uacc_values.length} articulations`);

### live-placeholder
872:.live-placeholder{opacity:.45;}   /* audit S8 — default hodnoty bez zařízení nejsou live stav */
1612:      <span class="section-live-val${_ffConnected ? '' : ' live-placeholder'}" id="${valId}-val">${lv}</span>
1829:      ${badge ? `<span class="section-live-val${_ffConnected ? '' : ' live-placeholder'}" id="enc-artic-badge">${badge}</span>` : ''}
3019:function liveOn(id){const e=document.getElementById(id);if(e)e.classList.remove('live-placeholder');}   // audit S8 — reálná data ze zařízení = pln�

### liveAllowed

### _midiState

### requestMIDIAccess
2444:  if(!navigator.requestMIDIAccess){setBanner('error','');return;}
2446:  navigator.requestMIDIAccess({sysex:true}).then(acc=>{

### showSyncBanner
2593:function showSyncBanner(kind) {
2875:          showSyncBanner('defaults'); setBanner('searching', '');
2878:          showSyncBanner('differs'); setBanner('searching', '');

### renderConnState

### connState

```

## KÓDOVÉ BLOKY

### raw signály — deklarace
```js
1447:let liveValues = { f1:64, f2:64 };
1454:let loaded     = !!_savedCfg;
1455:let dirty      = false;
1460:let _ffConnected = false;   // true once Feel Fader input is live
2614:let _serialPort   = null;  // Web Serial port (cached for session)
```
### initMidi (2439-2461)
```js
  // Start with pulse — searching for device
  const dot = document.getElementById('h-status-dot');
  const txt = document.getElementById('h-status-text');
  if (dot) dot.className = 'h-status-dot pulse';
  if (txt) txt.textContent = t('status.disconnected');
  if(!navigator.requestMIDIAccess){setBanner('error','');return;}
  setBanner('searching','');
  navigator.requestMIDIAccess({sysex:true}).then(acc=>{
    midiAccess=acc;
    let _reconnectTimer=null;
    midiAccess.onstatechange=(e)=>{
      const p = e?.port;
      // Ignore port open/close churn (e.g. fader CC auto-opening input port at 30 Hz).
      // Only wake connectInputs when: (a) we don't have a device yet, or
      //                               (b) a device physically disconnected/reconnected.
      const isChurn = _ffConnected && p && p.state === 'connected';
      if (!isChurn) {
        clearTimeout(_reconnectTimer);
        _reconnectTimer = setTimeout(connectInputs, 400);
      }
    };
    connectInputs();
  },()=>setBanner('error',t('midi.denied')));
```
### connectInputs (2471-2520)
```js
function connectInputs(){
  let found=false; const names=[];

  midiAccess.inputs.forEach(inp => {
    if (isFeelFader(inp.name)) {
      inp.open().catch(()=>{});   // pre-open: prevents onstatechange firing on first received message
      inp.onmidimessage = onMidiMsg;
      found = true;
      names.push(inp.name);
    } else {
      // Detach handler from non-Feel-Fader devices
      inp.onmidimessage = null;
    }
  });

  if(found){
    const dot = document.querySelector('.welcome-status-dot');
    if (dot) { dot.style.background = 'var(--green)'; dot.style.animation = 'none'; }
    const statusTxt = document.querySelector('.welcome-status span');
    if (statusTxt) statusTxt.textContent = t('welcome.found');
    setBanner('connected',names.join(', '));
    // NOTE: do NOT call updateStatus() here — when loaded=false it overwrites the
    // 'connected' banner with 'status.disconnected', making it look like no device.
    if (!_ffConnected) {
      _ffConnected = true;
      // Pre-open output port to avoid onstatechange → connectInputs() loop on first CC send.
      midiAccess.outputs.forEach(out => { if(isFeelFader(out.name)) out.open().catch(()=>{}); });
      // _requestDeviceInfoSysex() ODSTRANĚN (HW test 2026-07-07): SysEx write přes
      // Chrome/Windows MIDI Services zasekává MIDI endpoint zařízení až do replug
      // (nativní WinMM SysEx problém nemá). Info se stejně čte serialem (CMD_INFO).
      onDeviceConnected();  // decide: auto-enter (port granted) vs show Start (gesture needed)
    }
  } else {
    _ffConnected = false;   // reset so the next physical connect triggers a fresh CMD_R
    // Don't tear down UI if config is already loaded — device may reconnect shortly
    if (!loaded) {
      showWelcome();
    }
    let anyMidi = false;
    midiAccess.inputs.forEach(() => { anyMidi = true; });
    if (anyMidi) {
      setBanner('searching', t('midi.not_feel_fader'));
    } else {
      setBanner('searching', t('midi.none'));
    }
    updateStatus();
  }
}


```
### setBanner + showSyncBanner (2573-2611)
```js
function setBanner(type, m){
  const dot  = document.getElementById('h-status-dot');
  const txt  = document.getElementById('h-status-text');
  if (!dot) return;
  if (type === 'connected') {
    dot.className = 'h-status-dot on';
    txt.classList.remove('hidden');
    txt.textContent = t('status.connected');
    setTimeout(() => { txt.classList.add('hidden'); }, 3000);
  } else if (type === 'searching') {
    dot.className = 'h-status-dot pulse';
    txt.classList.remove('hidden');
    txt.textContent = m || t('status.disconnected');
  } else if (type === 'error') {
    dot.className = 'h-status-dot err';
    txt.classList.remove('hidden');
    txt.textContent = m || t('midi.unavailable');   // denied ≠ unsupported (debugging 2026-07-03)
  }
}

function showSyncBanner(kind) {
  const el = document.getElementById('sync-banner');
  const tx = document.getElementById('sync-banner-text');
  if (!el) return;
  tx.textContent = kind === 'defaults'
    ? 'Device reset to factory settings (stored config was unreadable).'
    : 'Device config differs from this browser’s last sync.';
  el.hidden = false;
}
function hideSyncBanner() { const el = document.getElementById('sync-banner'); if (el) el.hidden = true; }
async function syncLoadFromDevice() {
  hideSyncBanner();
  try { await loadConfigFromDevice(); setBanner('connected', t('midi.synced')); toast('s', t('toast.config_loaded')); }
  catch(e) { toast('e', "Couldn't sync with device — showing local config"); }
}
async function syncSendMine() { hideSyncBanner(); doSend(); }

// ═══════════════════════════════════════════════════════════
// SYSEX
```
### updateStatus (3002-3018)
```js
function updateStatus(){
  const dot  = document.getElementById('h-status-dot');
  const text = document.getElementById('h-status-text');
  if (!dot) return;
  if (loaded) {
    dot.className  = 'h-status-dot on';
    text.textContent = t('status.connected');
    document.body.classList.add('loaded');
    setTimeout(() => { text.classList.add('hidden'); }, 3000);
  } else {
    dot.className  = 'h-status-dot';
    text.classList.remove('hidden');
    text.textContent = t('status.disconnected');
    document.body.classList.remove('loaded');
  }
}
function setTxt(id,v){const e=document.getElementById(id);if(e)e.textContent=v;}
```
### live-placeholder CSS + render užití (872 + spany)
```
.live-placeholder{opacity:.45;}   /* audit S8 — default hodnoty bez zařízení nejsou live stav */
872:.live-placeholder{opacity:.45;}   /* audit S8 — default hodnoty bez zařízení nejsou live stav */
873:.section-live-val{
887:.loaded .section-live-val{
1060:html.dark .section-live-val{color:var(--t3);}
1061:html.dark.loaded .section-live-val{color:var(--t2);}
1612:      <span class="section-live-val${_ffConnected ? '' : ' live-placeholder'}" id="${valId}-val">${lv}</span>
1829:      ${badge ? `<span class="section-live-val${_ffConnected ? '' : ' live-placeholder'}" id="enc-artic-badge">${badge}</span>` : ''}
3019:function liveOn(id){const e=document.getElementById(id);if(e)e.classList.remove('live-placeholder');}   // audit S8 — reálná data ze zařízení = pln�
```
### header status HTML (1078-1081)
```html
    <div class="h-status" id="h-status">
      <div class="h-status-dot" id="h-status-dot"></div>
      <span class="h-status-text" id="h-status-text">t('status.disconnected')</span>
    </div>
```
### setBanner call sites — kontext (řádek + co dělá)
```js
1475:  // NOTE: updateStatus() intentionally NOT called here.
1478:  // updateStatus() is called only from: connectInputs() and handleSysEx().
2444:  if(!navigator.requestMIDIAccess){setBanner('error','');return;}
2445:  setBanner('searching','');
2461:  },()=>setBanner('error',t('midi.denied')));
2491:    setBanner('connected',names.join(', '));
2492:    // NOTE: do NOT call updateStatus() here — when loaded=false it overwrites the
2512:      setBanner('searching', t('midi.not_feel_fader'));
2514:      setBanner('searching', t('midi.none'));
2516:    updateStatus();
2573:function setBanner(type, m){
2605:  try { await loadConfigFromDevice(); setBanner('connected', t('midi.synced')); toast('s', t('toast.config_loaded')); }
2664:      setBanner('connected',t('midi.synced'));
2665:      updateStatus();
2669:      setBanner('connected', '');
2827:  updateStatus();
2849:    setBanner('connected', t('midi.synced'));
2875:          showSyncBanner('defaults'); setBanner('searching', '');
2878:          showSyncBanner('differs'); setBanner('searching', '');
2881:          setBanner('connected', t('midi.synced')); toast('s', t('toast.config_loaded'));
2885:        setBanner('searching', '');
3002:function updateStatus(){
```
### relevantní i18n klíče (status.* / midi.*)
```js
1080:      <span class="h-status-text" id="h-status-text">t('status.disconnected')</span>
2443:  if (txt) txt.textContent = t('status.disconnected');
2461:  },()=>setBanner('error',t('midi.denied')));
2493:    // 'connected' banner with 'status.disconnected', making it look like no device.
2512:      setBanner('searching', t('midi.not_feel_fader'));
2514:      setBanner('searching', t('midi.none'));
2580:    txt.textContent = t('status.connected');
2585:    txt.textContent = m || t('status.disconnected');
2589:    txt.textContent = m || t('midi.unavailable');   // denied ≠ unsupported (debugging 2026-07-03)
2605:  try { await loadConfigFromDevice(); setBanner('connected', t('midi.synced')); toast('s', t('toast.config_loaded')); }
2664:      setBanner('connected',t('midi.synced'));
2849:    setBanner('connected', t('midi.synced'));
2881:          setBanner('connected', t('midi.synced')); toast('s', t('toast.config_loaded'));
3008:    text.textContent = t('status.connected');
3014:    text.textContent = t('status.disconnected');
3036:    'midi.searching': 'Looking for Feel Fader...',
3037:    'midi.connected': 'Connected',
3038:    'midi.loading': 'Loading configuration...',
3039:    'midi.synced': 'Connected and synchronized',
3040:    'midi.not_feel_fader': 'MIDI device found, but not Feel Fader. Please connect Feel Fader.',
3041:    'midi.none': 'No MIDI device found. Connect Feel Fader.',
3042:    'midi.unavailable': 'Web MIDI not available — use Chrome or Edge.',
3044:    'status.connected': 'device connected',
3045:    'status.disconnected': 'device disconnected',
3123:    'midi.denied': 'MIDI access is blocked for this site — click the icon by the address bar → Site settings → MIDI devices → Allow, then reload.',
```
