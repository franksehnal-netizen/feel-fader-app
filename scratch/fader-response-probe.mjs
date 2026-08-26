// Regression probe: Fader response is a persisted device setting, available
// only when CMD_INFO advertises firmware support.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const browser = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(label,ok,detail='')=>console.log(`${ok?'PASS':'FAIL'}  ${label}${detail?' — '+detail:''}`);
const page = await browser.newPage();
await page.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await page.evaluate(() => skipWelcome());

const result = await page.evaluate(() => {
  _ffConnected = true;
  DEVICE_INFO.fader_response_presets = true;
  cfg.fader_response = 'balanced';
  dirty = false;
  render();
  const trigger = document.getElementById('fader-response-trigger');
  const displayValue = () => document.getElementById('fader-response-value').textContent;
  const initial = {value:displayValue(), disabled:trigger.disabled};
  onFaderResponseChange('smooth');
  const changed = {value:displayValue(), cfg:cfg.fader_response, dirty, summary:configChangeItems().includes('Fader response')};
  DEVICE_INFO.fader_response_presets = false;
  updateDeviceInfo();
  return {initial, changed, unsupported:{disabled:trigger.disabled,note:document.getElementById('fader-response-note').textContent}};
});
P('compatible firmware enables the response selector', result.initial.value === 'Balanced' && !result.initial.disabled, JSON.stringify(result));
P('response selection is tracked as a pending device change', result.changed.value === 'Smooth' && result.changed.cfg === 'smooth' && result.changed.dirty && result.changed.summary, JSON.stringify(result));
P('unsupported firmware keeps the selector disabled', result.unsupported.disabled && result.unsupported.note.includes('compatible device'), JSON.stringify(result));
await page.close();
await browser.close();
