// Regression probe: verified Sonuscore LUX Ensemble keyswitch preset.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const browser = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(label,ok,detail='')=>console.log(`${ok?'PASS':'FAIL'}  ${label}${detail?' — '+detail:''}`);
const page = await browser.newPage();
await page.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await page.evaluate(() => skipWelcome());

const result = await page.evaluate(() => {
  const name = 'Sonuscore LUX — Orchestral Strings';
  const preset = LIBRARY_PRESETS[name];
  cfg.banks[0].roller_mode = 'cc';
  cfg.banks[0].ks_notes = [];
  cfg.banks[0].ks_channel = 3;
  cfg.banks[0].ks_velocity = 20;
  activeBank = 0;
  applyLibraryPreset(name, 'all');
  const bank = cfg.banks[0];
  const preview = libraryPresetPreviewRows(name, preset);
  return {
    preset,
    mode: bank.roller_mode,
    notes: bank.ks_notes,
    channel: bank.ks_channel,
    velocity: bank.ks_velocity,
    preview
  };
});
P('preset contains the verified C0–D#0 MIDI notes', JSON.stringify(result.preset?.ks_notes) === JSON.stringify([24,25,26,27]), JSON.stringify(result));
P('full setup switches the roller to keyswitch mode', result.mode === 'keyswitch', JSON.stringify(result));
P('full setup applies the keyswitch channel and velocity', result.channel === 0 && result.velocity === 100, JSON.stringify(result));
P('preview describes a four-note keyswitch sequence on channel 1', result.preview.includes('4 keyswitch notes') && result.preview.includes('Ch 1'), result.preview);

const violins = await page.evaluate(() => {
  const name = 'Sonuscore LUX — Violins 1';
  const preset = LIBRARY_PRESETS[name];
  applyLibraryPreset(name, 'all');
  return { preset, notes:cfg.banks[0].ks_notes, mode:cfg.banks[0].roller_mode };
});
P('Violins 1 preset contains the verified C0–G0 keyswitch range', JSON.stringify(violins.preset?.ks_notes) === JSON.stringify([24,25,26,27,28,29,30,31]), JSON.stringify(violins));
P('Violins 1 setup applies all eight keyswitches', JSON.stringify(violins.notes) === JSON.stringify([24,25,26,27,28,29,30,31]) && violins.mode === 'keyswitch', JSON.stringify(violins));

const violas = await page.evaluate(() => {
  const name = 'Sonuscore LUX — Violas';
  const preset = LIBRARY_PRESETS[name];
  applyLibraryPreset(name, 'all');
  return { preset, notes:cfg.banks[0].ks_notes, mode:cfg.banks[0].roller_mode };
});
P('Violas preset keeps the verified C0–G0 keyswitch range', JSON.stringify(violas.preset?.ks_notes) === JSON.stringify([24,25,26,27,28,29,30,31]), JSON.stringify(violas));
P('Violas setup applies all eight keyswitches', JSON.stringify(violas.notes) === JSON.stringify([24,25,26,27,28,29,30,31]) && violas.mode === 'keyswitch', JSON.stringify(violas));

const celli = await page.evaluate(() => {
  const name = 'Sonuscore LUX — Celli';
  const preset = LIBRARY_PRESETS[name];
  applyLibraryPreset(name, 'all');
  return { preset, notes:cfg.banks[0].ks_notes, mode:cfg.banks[0].roller_mode };
});
P('Celli preset keeps the verified C0–G0 keyswitch range', JSON.stringify(celli.preset?.ks_notes) === JSON.stringify([24,25,26,27,28,29,30,31]), JSON.stringify(celli));
P('Celli setup applies all eight keyswitches', JSON.stringify(celli.notes) === JSON.stringify([24,25,26,27,28,29,30,31]) && celli.mode === 'keyswitch', JSON.stringify(celli));

const basses = await page.evaluate(() => {
  const name = 'Sonuscore LUX — Basses';
  const preset = LIBRARY_PRESETS[name];
  applyLibraryPreset(name, 'all');
  return { preset, notes:cfg.banks[0].ks_notes, mode:cfg.banks[0].roller_mode };
});
P('Basses preset keeps the verified C0–G0 keyswitch range', JSON.stringify(basses.preset?.ks_notes) === JSON.stringify([24,25,26,27,28,29,30,31]), JSON.stringify(basses));
P('Basses setup applies all eight keyswitches', JSON.stringify(basses.notes) === JSON.stringify([24,25,26,27,28,29,30,31]) && basses.mode === 'keyswitch', JSON.stringify(basses));

const ssoCelli = await page.evaluate(() => {
  const name = 'Spitfire Symphonic Orchestra — Celli (All techniques)';
  const preset = LIBRARY_PRESETS[name];
  applyLibraryPreset(name, 'all');
  return { preset, notes:cfg.banks[0].ks_notes, mode:cfg.banks[0].roller_mode };
});
P('SSO Celli preset contains the verified C-1–A#-1 range', ssoCelli.preset?.ks_notes?.length === 11 && ssoCelli.preset.ks_notes[0] === 12 && ssoCelli.preset.ks_notes.at(-1) === 22, JSON.stringify(ssoCelli));
P('SSO Celli setup applies its complete keyswitch range', ssoCelli.notes.length === 11 && ssoCelli.notes[0] === 12 && ssoCelli.notes.at(-1) === 22 && ssoCelli.mode === 'keyswitch', JSON.stringify(ssoCelli));

const ssoBasses = await page.evaluate(() => {
  const name = 'Spitfire Symphonic Orchestra — Basses (All techniques)';
  const preset = LIBRARY_PRESETS[name];
  applyLibraryPreset(name, 'all');
  return { preset, notes:cfg.banks[0].ks_notes, mode:cfg.banks[0].roller_mode };
});
P('SSO Basses preset contains the verified C-1–A#-1 range', ssoBasses.preset?.ks_notes?.length === 11 && ssoBasses.preset.ks_notes[0] === 12 && ssoBasses.preset.ks_notes.at(-1) === 22, JSON.stringify(ssoBasses));
P('SSO Basses setup applies its complete keyswitch range', ssoBasses.notes.length === 11 && ssoBasses.notes[0] === 12 && ssoBasses.notes.at(-1) === 22 && ssoBasses.mode === 'keyswitch', JSON.stringify(ssoBasses));

const ssoEnsembles = await page.evaluate(() => {
  const name = 'Spitfire Symphonic Orchestra — Ensembles (All techniques)';
  const preset = LIBRARY_PRESETS[name];
  applyLibraryPreset(name, 'all');
  return { preset, notes:cfg.banks[0].ks_notes, mode:cfg.banks[0].roller_mode };
});
P('SSO Ensembles preset matches the verified C-1–A#-1 range', ssoEnsembles.preset?.ks_notes?.length === 11 && ssoEnsembles.preset.ks_notes[0] === 12 && ssoEnsembles.preset.ks_notes.at(-1) === 22, JSON.stringify(ssoEnsembles));
P('SSO Ensembles setup applies its complete keyswitch range', ssoEnsembles.notes.length === 11 && ssoEnsembles.notes[0] === 12 && ssoEnsembles.notes.at(-1) === 22 && ssoEnsembles.mode === 'keyswitch', JSON.stringify(ssoEnsembles));

const ssoViolas = await page.evaluate(() => {
  const name = 'Spitfire Symphonic Orchestra — Violas (All techniques)';
  const preset = LIBRARY_PRESETS[name];
  applyLibraryPreset(name, 'all');
  return { preset, notes:cfg.banks[0].ks_notes, mode:cfg.banks[0].roller_mode };
});
P('SSO Violas preset contains the verified C-1–B-1 range', ssoViolas.preset?.ks_notes?.length === 12 && ssoViolas.preset.ks_notes[0] === 12 && ssoViolas.preset.ks_notes.at(-1) === 23, JSON.stringify(ssoViolas));
P('SSO Violas setup applies its complete keyswitch range', ssoViolas.notes.length === 12 && ssoViolas.notes[0] === 12 && ssoViolas.notes.at(-1) === 23 && ssoViolas.mode === 'keyswitch', JSON.stringify(ssoViolas));

const ssoViolins1 = await page.evaluate(() => {
  const name = 'Spitfire Symphonic Orchestra — Violins 1 (All techniques)';
  const preset = LIBRARY_PRESETS[name];
  applyLibraryPreset(name, 'all');
  return { preset, notes:cfg.banks[0].ks_notes, mode:cfg.banks[0].roller_mode };
});
P('SSO Violins 1 preset contains the verified C-2–G0 range', ssoViolins1.preset?.ks_notes?.length === 32 && ssoViolins1.preset.ks_notes[0] === 0 && ssoViolins1.preset.ks_notes.at(-1) === 31, JSON.stringify(ssoViolins1));
P('SSO Violins 1 setup applies its complete keyswitch range', ssoViolins1.notes.length === 32 && ssoViolins1.notes[0] === 0 && ssoViolins1.notes.at(-1) === 31 && ssoViolins1.mode === 'keyswitch', JSON.stringify(ssoViolins1));
await page.close();
await browser.close();
