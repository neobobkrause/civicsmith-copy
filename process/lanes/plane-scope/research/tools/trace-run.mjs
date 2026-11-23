// Runs test files under the run-time recorder (trace.mjs), in a scratch checkout, a few at a time.
//   node trace-run.mjs <checkout> <list.json> <trace folder> [--jobs 3] [--timeout 300]
// <list.json> is a JSON list of test files, as paths relative to the checkout. Each is run as the process's test
// command runs it (process.json test_command), with a bare environment: no credential the session holds is passed on,
// and HOME is an empty folder, so no test can reach an account. Results go to <trace folder>/runs.json.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [checkout, listFile, outDir] = process.argv.slice(2);
const opt = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? Number(process.argv[i + 1]) : fallback; };
const JOBS = opt('--jobs', 3); const TIMEOUT = opt('--timeout', 300) * 1000;
const TRACE = fileURLToPath(new URL('./trace.mjs', import.meta.url));
const root = path.resolve(checkout);
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'process.json'), 'utf8'));
const command = cfg.test_command.split(/\s+/); // node --import ./bio-plane/test/platform-sqlite.mjs --test
const files = JSON.parse(fs.readFileSync(listFile, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });
const home = path.join(outDir, 'home'); fs.mkdirSync(home, { recursive: true });
const tmp = path.join(outDir, 'tmp'); fs.mkdirSync(tmp, { recursive: true });
const env = { PATH: process.env.PATH, HOME: home, TMPDIR: tmp, LANG: 'C.UTF-8', NODE_OPTIONS: `--import=${TRACE}`, GRAPH_TRACE_OUT: path.join(outDir, 'raw'), GRAPH_TRACE_ROOT: root, CI: 'true' };
const runs = []; let next = 0; let running = 0;
const started = Date.now();
await new Promise((done) => {
  const pump = () => {
    while (running < JOBS && next < files.length) {
      const file = files[next++]; running++;
      const t0 = Date.now(); let out = '';
      const child = spawn(process.execPath, [...command.slice(1), file], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
      const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ } }, TIMEOUT);
      child.stdout.on('data', (d) => { out = (out + d).slice(-4000); }); child.stderr.on('data', (d) => { out = (out + d).slice(-4000); });
      child.on('close', (code, signal) => {
        clearTimeout(timer); running--;
        const pass = /^# pass (\d+)/m.exec(out)?.[1]; const fail = /^# fail (\d+)/m.exec(out)?.[1];
        runs.push({ file, code, signal, seconds: Math.round((Date.now() - t0) / 1000), pass: pass === undefined ? null : Number(pass), fail: fail === undefined ? null : Number(fail) });
        console.log(`${runs.length}/${files.length} ${code === 0 ? 'ok  ' : signal ? 'KILL' : 'FAIL'} ${Math.round((Date.now() - t0) / 1000)}s ${file}`);
        fs.writeFileSync(path.join(outDir, 'runs.json'), JSON.stringify(runs, null, 1));
        if (next >= files.length && running === 0) done(); else pump();
      });
    }
  };
  pump();
});
console.log(`done: ${runs.filter((r) => r.code === 0).length} passed, ${runs.filter((r) => r.code !== 0).length} not, in ${Math.round((Date.now() - started) / 1000)} s`);
