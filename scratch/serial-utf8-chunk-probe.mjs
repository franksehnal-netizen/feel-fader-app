// Regression probe: _readReply() must not corrupt multi-byte UTF-8 sequences
// that straddle a Web Serial chunk boundary. TextDecoder.decode() without
// { stream: true } treats every chunk as a self-contained unit and flushes
// at its end, replacing any incomplete trailing sequence (and the orphaned
// continuation bytes that follow) with U+FFFD. Web Serial commonly delivers
// 64-byte USB packets, so a boundary can land mid-character in practice —
// reproduced on real hardware 2026-08-08 with a bank icon set to the violin
// emoji (U+1F3BB): it came back as four U+FFFD characters instead.
//
// This probe drives the real _readReply() (not a reimplementation) with a
// fake `port` whose reader hands back a JSON line split into two chunks,
// with the split deliberately placed inside a multi-byte UTF-8 sequence.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

// Two cases: the emoji actually seen on hardware, and Czech diacritics,
// which is what the owner will hit day to day (bank/fader names).
const cases = [
  { label: 'emoji icon (U+1F3BB violin)', text: '🎻 Bank 1' },
  { label: 'Czech diacritics', text: 'Žestě dechy' },
];

const results = await p.evaluate(async (cases) => {
  const out = [];
  for (const { label, text } of cases) {
    // Build a v2-framed CFG reply line the way the firmware would send it:
    // "CFG:<rid>:<json>\n" — payload round-trips through JSON.stringify so
    // the split can land inside the JSON string's UTF-8 bytes.
    const rid = '7';
    const payload = JSON.stringify({ name: text });
    const line = `CFG:${rid}:${payload}\n`;
    const bytes = new TextEncoder().encode(line);

    // Find a split point that lands strictly inside a multi-byte sequence
    // (i.e. splits between the lead byte and its continuation bytes, or
    // between two continuation bytes) — never on a character boundary.
    let splitAt = -1;
    for (let i = 1; i < bytes.length; i++) {
      const b0 = bytes[i];
      const isContinuation = (b0 & 0xC0) === 0x80;
      const prevIsContinuationOrLead = true;
      if (isContinuation) { splitAt = i; break; }
    }
    if (splitAt === -1) { out.push({ label, error: 'no multi-byte sequence found to split — fixture bug' }); continue; }

    const chunk1 = bytes.slice(0, splitAt);
    const chunk2 = bytes.slice(splitAt);

    let call = 0;
    const fakeReader = {
      read: async () => {
        call++;
        if (call === 1) return { value: chunk1, done: false };
        if (call === 2) return { value: chunk2, done: false };
        return { value: undefined, done: true };
      },
      releaseLock: () => {},
    };
    const fakePort = { readable: { getReader: () => fakeReader } };

    try {
      const pl = await _readReply(fakePort, true, 'CFG', rid, 2000);
      const roundTrip = JSON.parse(pl).name;
      out.push({
        label,
        payload: pl,
        roundTrip,
        matches: roundTrip === text,
        hasReplacementChar: pl.includes('\uFFFD'),
      });
    } catch (e) {
      out.push({ label, error: String(e && e.message || e) });
    }
  }
  return out;
}, cases);

for (const r of results) {
  if (r.error) {
    P(`${r.label}: _readReply resolved without error`, false, r.error);
    continue;
  }
  P(`${r.label}: round-trips exactly`, r.matches, `got ${JSON.stringify(r.roundTrip)} want ${JSON.stringify(cases.find(c=>c.label===r.label).text)}`);
  P(`${r.label}: no U+FFFD in payload`, !r.hasReplacementChar, r.payload);
}
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
