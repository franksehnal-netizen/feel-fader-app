// P3 Privacy/GDPR — network trace: collect every request host reachable while
// walking the welcome flow + skipWelcome(), assert no unexpected external hosts.
// Report-first: line 2 asserts the ideal (zero external hosts) and is EXPECTED
// to FAIL today because the app loads Google Fonts — that FAIL is the
// confirmed privacy finding (GDPR consent trigger), not a probe bug. Kept as
// a regression lock: once fonts are self-hosted, line 2 should flip to PASS.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage();
const external = new Set();
const pageErrors = [];
p.on('pageerror', err => pageErrors.push(String(err)));
p.on('request', req => { try { const h = new URL(req.url()).host; if (!/^localhost(:\d+)?$/.test(h) && !req.url().startsWith('data:')) external.add(h); } catch(e){} });
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
await p.evaluate(()=>{ skipWelcome(); });
await new Promise(r=>setTimeout(r,500));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
const hosts=[...external];
console.log('EXTERNAL HOSTS: '+JSON.stringify(hosts));
P('žádné neočekávané externí hosty (jen fonts.* pokud vůbec)', hosts.every(h=>/fonts\.(googleapis|gstatic)\.com$/.test(h)), JSON.stringify(hosts));
P('zcela bez externích requestů (ideál po self-hostu fontů)', hosts.length===0, JSON.stringify(hosts));
P('žádná neodchycená page error', pageErrors.length===0, JSON.stringify(pageErrors));
await b.close();
