// Runs audit probes (scratch/audit/) against a throwaway :8100 static server.
// Separate from run-all-probes.mjs on purpose: report-first audit probes assert
// SAFE behavior, so a probe FAILs where a finding is present — that must NOT
// break the green regression suite (npm test). Migrate a probe into
// run-all-probes.mjs only after its finding is fixed.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const PORT = 8100;

const AUDIT_PROBES = [
  'p1-xss-config-import.mjs',
  'p1-proto-pollution.mjs',
  'p2-malformed-import.mjs',
  'p2-storage-failure.mjs',
  'p2-serial-robustness.mjs',
  'p3-external-requests.mjs',
  'p4-no-webserial-degradation.mjs',
  'p5-heap-growth.mjs',
  /* filled by Task 8 */
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

for (const probe of AUDIT_PROBES) {
  const { code, out } = await runProbe(probe);
  const pass = (out.match(/^\s*PASS /gm) || []).length;
  const fail = (out.match(/^\s*FAIL /gm) || []).length;
  totalPass += pass; totalFail += fail;
  if (pass === 0 && fail === 0) {
    crashed.push(probe);
    console.log(`CRASH ${probe} (exit ${code})`);
    console.log(out.split('\n').slice(0, 8).join('\n'));
  } else {
    console.log(`${fail === 0 ? 'ok  ' : 'FAIL'} ${probe} — ${pass} pass, ${fail} fail`);
  }
}

server.close();
console.log(`\n${totalPass} passed, ${totalFail} failed, ${crashed.length} crashed (${AUDIT_PROBES.length} probes)`);
