// Regression probe (UX audit 2026-09-25, C-3): the articulation template
// dropdown and the library picker are one mechanism. A library list opens the
// same preview dialog (nothing changes until Apply), "Clear all" asks first,
// and template toasts use the label the composer clicked.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' — '+x:''}`);
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await p.evaluate(() => skipWelcome());

const r = await p.evaluate(async () => {
  const out = {};
  activeBank = 0; setRollerMode(0, 'cc');
  cfg.banks[0].uacc_values = [1, 20];
  _openSections.clear(); _openSections.add('roller'); render();
  const click = label => [...document.querySelectorAll('#uacc-preset-dropdown button')].find(el => el.textContent.includes(label))?.click();

  click('Spitfire Chamber Strings');
  const overlay = document.getElementById('library-preview-overlay');
  out.previewOpen = !overlay.hidden;
  out.previewTitle = document.getElementById('library-preview-title')?.textContent;
  out.valuesWhilePreview = cfg.banks[0].uacc_values.join();
  closeLibraryPreview(false);

  click('Clear all');
  const confirm = document.getElementById('confirm-overlay');
  out.confirmOpen = !confirm.hidden;
  out.valuesWhileConfirm = cfg.banks[0].uacc_values.join();
  closeConfirm(true);
  out.valuesAfterConfirm = cfg.banks[0].uacc_values.length;

  document.querySelectorAll('.toast, #toast-container > *').forEach(el => el.remove());
  click('Legato family');
  await new Promise(res => setTimeout(res, 50));
  out.toast = [...document.querySelectorAll('.toast, [class*="toast"]')].map(el => el.textContent).join(' | ');
  return out;
});

P('library list opens the library preview dialog', r.previewOpen === true && r.previewTitle === 'Spitfire Chamber Strings', `${r.previewOpen} / ${r.previewTitle}`);
P('nothing changes while the preview is open', r.valuesWhilePreview === '1,20', r.valuesWhilePreview);
P('Clear all asks for confirmation first', r.confirmOpen === true && r.valuesWhileConfirm === '1,20', `${r.confirmOpen} / ${r.valuesWhileConfirm}`);
P('confirming clears the list', r.valuesAfterConfirm === 0, String(r.valuesAfterConfirm));
P('template toast names the template as shown in the menu', /Legato family/.test(r.toast) && !/"legato"/.test(r.toast), r.toast);
P('no page errors', errs.length === 0, errs.join(' | '));
await p.close();
await b.close();
