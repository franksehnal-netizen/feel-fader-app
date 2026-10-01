// Runs every committed regression probe in scratch/ against a throwaway
// static server, aggregates PASS/FAIL from each probe's stdout, and exits
// non-zero if any probe fails, errors, or crashes. See scratch/README.md
// for what belongs in this list (TC-1, structure audit 2026-07-20).
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, spawnSync } from 'child_process';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const PORT = 8100;
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
};

const PROBES = [
  'connstate-probe.mjs',
  'connstate-flow-probe.mjs',
  'connstate-reconnect-probe.mjs',
  'auto-reconnect-instant-probe.mjs',
  'validation-clamp-probe.mjs',
  'onb-product-tour-probe.mjs',
  'onb-wordmark-sync-probe.mjs',
  'onb-resize-shift-probe.mjs',
  'onb-wordmark-filter-teleport-probe.mjs',
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
  'connect-shows-device-bank-probe.mjs',
  'unsent-live-hint-probe.mjs',
  'button-longpress-glow-probe.mjs',
  'toast-flat-style-probe.mjs',
  'a3-nvm-degraded-notice-probe.mjs',
  'send-without-web-serial-probe.mjs',
  'footer-pinned-to-bottom-probe.mjs',
  'status-pill-polish-probe.mjs',
  'faders-inert-probe.mjs',
  'fader-live-latency-probe.mjs',
  'fader-response-probe.mjs',
  'sonuscore-lux-preset-probe.mjs',
  'help-trim-probe.mjs',
  'midi-backlog-guard-probe.mjs',
  'mobile-ux-probe.mjs',
  'unsupported-browser-welcome-probe.mjs',
  'onb-probe4.mjs',
  'welcome-no-box-probe.mjs',
  'status-hover-reveal-probe.mjs',
  'bank-live-dot-probe.mjs',
  'cursor-style-probe.mjs',
  'bank-card-header-probe.mjs',
  'bank-group-probe.mjs',
  'two-column-layout-probe.mjs',
  'theme-switch-uniform-probe.mjs',
  'button-zone-hover-probe.mjs',
  'hover-glow-timing-probe.mjs',
  'section-live-values-probe.mjs',
  'send-note-below-probe.mjs',
  'welcome-heading-gap-probe.mjs',
  'section-toggle-focus-ring-probe.mjs',
  'step-btn-active-color-probe.mjs',
  'bank-tab-blur-probe.mjs',
  'reconnect-info-retry-probe.mjs',
  'sections-independent-probe.mjs',
  'fader-name-input-width-probe.mjs',
  'validation-single-signal-probe.mjs',
  'per-bank-macro-probe.mjs',
  'serial-utf8-chunk-probe.mjs',
  'serial-port-retry-probe.mjs',
  'connect-reveal-sync-probe.mjs',
  'live-note-centered-probe.mjs',
  'hover-tip-probe.mjs',
  'onb-swipe-probe.mjs',
  'roller-mode-timing-sync-probe.mjs',
  'cc-relative-mode-selector-probe.mjs',
  'cc-relative-panel-content-probe.mjs',
  'cc-relative-diagnostics-probe.mjs',
  'is-feel-fader-probe.mjs',
  'sysex-info-faders-probe.mjs',
  'render-validate-once-probe.mjs',
  'cc-relative-whitelist-probe.mjs',
  'fader-response-menu-hide-probe.mjs',
  'fw-update-offer-probe.mjs',
  'fw-feature-min-probe.mjs',
  'fw-update-flow-probe.mjs',
  'roller-mode-browse-no-dirty-probe.mjs',
  'articulation-value-wording-probe.mjs',
  'send-undo-shortcuts-probe.mjs',
  'library-mechanism-label-probe.mjs',
  'uacc-v2-spec-probe.mjs',
  'library-names-bank-probe.mjs',
  'keyswitch-names-probe.mjs',
  'articulation-templates-unified-probe.mjs',
  'roller-order-list-probe.mjs',
  'hud-readable-summaries-probe.mjs',
  'design-consistency-probe.mjs',
  'k7-details-probe.mjs',
  'n1-new-bank-copies-active-probe.mjs',
  'n6-cc-conflict-both-controls-probe.mjs',
  'n5-review-values-probe.mjs',
  'n2-keyswitch-order-visible-probe.mjs',
  'n7-library-picker-groups-probe.mjs',
  'sprint-c-consistency-probe.mjs',
  'audit/p1-xss-config-import.mjs',
  'audit/p1-proto-pollution.mjs',
  'audit/p1-macro-nav-xss.mjs',
  'audit/p2-malformed-import.mjs',
  'audit/p2-storage-failure.mjs',
  'audit/p2-serial-robustness.mjs',
  'audit/p3-external-requests.mjs',
  'audit/p4-no-webserial-degradation.mjs',
  'audit/p5-heap-growth.mjs',
  'owner-name-probe.mjs',
  'connect-intro-motion-probe.mjs',
  'connect-glide-jump-probe.mjs',
  'skip-intro-probe.mjs',
];

const requestedProbes = process.argv.slice(2);
const probesToRun = requestedProbes.length ? requestedProbes : PROBES;
const unknownProbes = probesToRun.filter((name) => !PROBES.includes(name));
if (unknownProbes.length) {
  console.error(`Unknown probe(s): ${unknownProbes.join(', ')}`);
  console.error('Use a path exactly as listed in scratch/run-all-probes.mjs.');
  process.exit(2);
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const reqPath = req.url === '/' ? '/feel-fader.html' : req.url.split('?')[0];
      fs.readFile(path.join(root, decodeURIComponent(reqPath)), (err, data) => {
        if (err) { res.writeHead(404); res.end(); return; }
        const type = CONTENT_TYPES[path.extname(reqPath).toLowerCase()] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type });
        res.end(data);
      });
    });
    server.listen(PORT, () => resolve(server));
  });
}

const nodeOptions = [process.env.NODE_OPTIONS, '--require=./scratch/shared-browser-hook.cjs']
  .filter(Boolean).join(' ');

function runProbe(name, browserWSEndpoint) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, name)], {
      cwd: root,
      env: {
        ...process.env,
        FF_SHARED_BROWSER_WS: browserWSEndpoint,
        NODE_OPTIONS: nodeOptions,
      },
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('error', (error) => resolve({ name, code: -1, out: `${out}\n${error.stack || error}` }));
    child.on('close', (code) => resolve({ name, code, out }));
  });
}

// chrome-headless-shell, not full Chrome: full Chrome started on a fresh
// profile (what puppeteer launches) checks "is the Windows password blank?" by
// calling LogonUser with an empty password, which Windows counts as a failed
// logon (Security 4625); 10 in 10 minutes lock the account
// (AE-FB-20261001-01). The shell has no password manager: 0 failed logons
// measured for the full suite. No fallback to full Chrome on purpose.
function findHeadlessShell() {
  const cache = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome-headless-shell');
  const builds = fs.existsSync(cache) ? fs.readdirSync(cache).filter((d) => d.startsWith('win64-')) : [];
  builds.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  for (const build of builds.reverse()) {
    const exe = path.join(cache, build, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
    if (fs.existsSync(exe)) return exe;
  }
  console.error('chrome-headless-shell not found. Install it with:\n'
    + '  npx @puppeteer/browsers install chrome-headless-shell@stable --path "%USERPROFILE%\\.cache\\puppeteer"');
  process.exit(2);
}

// The hook once failed silently and every probe started its own full Chrome.
// Refuse to run unless probes really get the shared-browser launch().
const hookCheck = spawnSync(process.execPath,
  ['-e', "process.stdout.write(require('puppeteer-core').launch.name)"],
  { cwd: root, encoding: 'utf8', env: { ...process.env, FF_SHARED_BROWSER_WS: 'ws://hook-check', NODE_OPTIONS: nodeOptions } });
if (hookCheck.stdout !== 'connectToSharedBrowser') {
  console.error(`shared-browser-hook.cjs does not redirect puppeteer.launch (got "${hookCheck.stdout}"): `
    + 'probes would each start their own Chrome. Aborting.');
  console.error(hookCheck.stderr);
  process.exit(2);
}

const headlessShell = findHeadlessShell();
const server = await startServer();
const sharedBrowser = await puppeteer.launch({
  executablePath: headlessShell,
  headless: 'shell',
  // The shell reports prefers-reduced-motion: reduce by default; the motion
  // probes need full Chrome's no-preference (probes can still emulate reduce).
  args: ['--no-sandbox', '--js-flags=--expose-gc', '--force-prefers-no-reduced-motion'],
  ignoreDefaultArgs: ['--hide-scrollbars'],
});
let totalPass = 0, totalFail = 0, crashed = [];

const probeConcurrency = Math.min(
  probesToRun.length,
  Math.max(1, Number.parseInt(process.env.FF_PROBE_CONCURRENCY || '4', 10) || 4),
);
let nextProbeIndex = 0;
async function runProbeWorker() {
  while (true) {
    const probeIndex = nextProbeIndex++;
    if (probeIndex >= probesToRun.length) return;
    const probe = probesToRun[probeIndex];
    const { code, out } = await runProbe(probe, sharedBrowser.wsEndpoint());
    const pass = (out.match(/^\s*PASS /gm) || []).length;
    const fail = (out.match(/^\s*FAIL /gm) || []).length;
    totalPass += pass; totalFail += fail;
    if (pass === 0 && fail === 0) {
      crashed.push(probe);
      console.log(`CRASH ${probe} (exit ${code}) – no PASS/FAIL lines found`);
      console.log(out.split('\n').slice(0, 6).join('\n'));
    } else if (code !== 0 && fail === 0) {
      // Died after printing some PASS lines: the remaining checks never ran
      // (a probe once hid a stale function name this way).
      crashed.push(probe);
      console.log(`CRASH ${probe} (exit ${code}) – stopped after ${pass} pass`);
      console.log(out.trim().split('\n').slice(-6).join('\n'));
    } else {
      console.log(`${fail === 0 ? 'ok  ' : 'FAIL'} ${probe} – ${pass} pass, ${fail} fail`);
      if (fail > 0) console.log(out.trim());
    }
  }
}
try {
  await Promise.all(Array.from({ length: probeConcurrency }, () => runProbeWorker()));
} finally {
  await sharedBrowser.close();
  server.close();
}
const probeLabel = probesToRun.length === 1 ? 'probe' : 'probes';
console.log(`\n${totalPass} passed, ${totalFail} failed, ${crashed.length} crashed (${probesToRun.length} ${probeLabel})`);
process.exit(totalFail > 0 || crashed.length > 0 ? 1 : 0);
