// Runs every committed regression probe in scratch/ against a throwaway
// static server, aggregates PASS/FAIL from each probe's stdout, and exits
// non-zero if any probe fails, errors, or crashes. See scratch/README.md
// for what belongs in this list (TC-1, structure audit 2026-07-20).
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const PORT = 8100;

const PROBES = [
  'connstate-probe.mjs',
  'connstate-flow-probe.mjs',
  'connstate-reconnect-probe.mjs',
  'validation-clamp-probe.mjs',
  'onb-wordmark-sync-probe.mjs',
  'skip-welcome-send-btn-probe.mjs',
  'skip-welcome-send-entry-gap-probe.mjs',
  'send-btn-idle-state-probe.mjs',
  'skip-welcome-demo-badge-probe.mjs',
  'skip-welcome-preserves-saved-config-probe.mjs',
  'welcome-blur-overlay-probe.mjs',
  'serial-disconnect-clears-stale-port-probe.mjs',
  'bank-fader-name-limits-match-firmware-probe.mjs',
  'touch-target-stepper-specificity-probe.mjs',
  'vbar-aria-live-probe.mjs',
  'safe-batch-2026-07-20-probe.mjs',
  'help-deep-links-probe.mjs',
  'c10-bank-switch-preserves-edit-probe.mjs',
  'c11-connect-with-dirty-edits-probe.mjs',
  'a3-nvm-degraded-notice-probe.mjs',
  'send-without-web-serial-probe.mjs',
  'live-hud-meter-value-gap-probe.mjs',
  'footer-pinned-to-bottom-probe.mjs',
  'hide-controller-toggle-probe.mjs',
  'status-pill-polish-probe.mjs',
  'faders-inert-probe.mjs',
  'help-trim-probe.mjs',
  'livecolor-probe.mjs',
  'mobile-ux-probe.mjs',
  'onb-probe4.mjs',
  'welcome-no-box-probe.mjs',
  'status-hover-reveal-probe.mjs',
  'bank-glyph-neutral-probe.mjs',
  'live-hud-square-probe.mjs',
  'live-hud-free-manipulation-probe.mjs',
  'send-dock-gap-symmetry-probe.mjs',
  'controller-toggle-speed-probe.mjs',
];

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const reqPath = req.url === '/' ? '/feel-fader.html' : req.url.split('?')[0];
      fs.readFile(path.join(root, decodeURIComponent(reqPath)), (err, data) => {
        if (err) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': reqPath.endsWith('.html') ? 'text/html' : 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(PORT, () => resolve(server));
  });
}

function runProbe(name) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, name)], { cwd: root });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => resolve({ name, code, out }));
  });
}

const server = await startServer();
let totalPass = 0, totalFail = 0, crashed = [];

for (const probe of PROBES) {
  const { code, out } = await runProbe(probe);
  const pass = (out.match(/^\s*PASS /gm) || []).length;
  const fail = (out.match(/^\s*FAIL /gm) || []).length;
  totalPass += pass; totalFail += fail;
  if (pass === 0 && fail === 0) {
    crashed.push(probe);
    console.log(`CRASH ${probe} (exit ${code}) — no PASS/FAIL lines found`);
    console.log(out.split('\n').slice(0, 6).join('\n'));
  } else {
    console.log(`${fail === 0 ? 'ok  ' : 'FAIL'} ${probe} — ${pass} pass, ${fail} fail`);
  }
}

server.close();
console.log(`\n${totalPass} passed, ${totalFail} failed, ${crashed.length} crashed (${PROBES.length} probes)`);
process.exit(totalFail > 0 || crashed.length > 0 ? 1 : 0);
