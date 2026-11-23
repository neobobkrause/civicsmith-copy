// The run-time recorder of the plane-scope lane's layer research (09-graph.md describes its use).
//
// As a preload:   NODE_OPTIONS="--import=<this file>" GRAPH_TRACE_OUT=<folder> GRAPH_TRACE_ROOT=<checkout> node …
//   records, for the process and every Node process it starts: each module resolved (who asked for it), each module
//   loaded, each path given to a file-system call, each file path given to a child process, with the place in the
//   checkout's own code that made the call (the nearest frame that is not Node's and not node_modules).
//   It writes one JSON file for each process into GRAPH_TRACE_OUT when the process ends.
// As a program:   node trace.mjs merge <folder> <out.json> [--root <checkout>] [--modules <repository with process/modules>]
//   joins those files into one: for each calling place, which modules' files it touched.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import module, { syncBuiltinESMExports } from 'node:module';
import childProcess from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const real = { writeFileSync: fs.writeFileSync, mkdirSync: fs.mkdirSync, readFileSync: fs.readFileSync, readdirSync: fs.readdirSync };

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  if (process.argv[2] === 'merge') merge(process.argv[3], process.argv[4]);
  else { console.error('usage: node trace.mjs merge <folder>[,<folder>…] <out.json> [--modules <repository>] [--only <graph/computed.json>]'); process.exit(2); }
} else if (process.env.GRAPH_TRACE_OUT) install();

function install() {
  const OUT = process.env.GRAPH_TRACE_OUT;
  const ROOT = path.resolve(process.env.GRAPH_TRACE_ROOT || process.cwd());
  const inRoot = (p) => p === ROOT || p.startsWith(ROOT + path.sep);
  const records = new Map(); // "kind|site|path" → count
  const note = (kind, site, p) => { const k = `${kind}|${site}|${p}`; records.set(k, (records.get(k) ?? 0) + 1); };
  /** A path as the checkout names it, or a word for where else it is. */
  const where = (p) => {
    if (!inRoot(p)) return /^(\/tmp\/|\/var\/tmp\/|\/dev\/shm\/)/.test(p + '/') || (process.env.TMPDIR && p.startsWith(process.env.TMPDIR)) ? '<tmp>' : '<outside>';
    const rel = path.relative(ROOT, p).split(path.sep).join('/');
    if (rel.split('/').includes('node_modules')) return '<node_modules>';
    if (rel.startsWith('.git/') || rel === '.git') return '<git>';
    return rel === '' ? '.' : rel;
  };
  const asPath = (x) => {
    try {
      if (typeof x === 'string') return path.resolve(x.startsWith('file://') ? fileURLToPath(x) : x);
      if (x instanceof URL) return x.protocol === 'file:' ? fileURLToPath(x) : null;
      if (Buffer.isBuffer(x)) return path.resolve(x.toString());
    } catch { /* not a path */ }
    return null;
  };
  /** The nearest frame of the checkout's own code: "file:line", or "(none)". */
  function site() {
    const limit = Error.stackTraceLimit; Error.stackTraceLimit = 60;
    const holder = {}; Error.captureStackTrace(holder, site); Error.stackTraceLimit = limit;
    for (const line of String(holder.stack).split('\n').slice(1)) {
      const m = /\(?((?:file:\/\/)?\/[^():]+):(\d+):\d+\)?$/.exec(line.trim());
      if (!m) continue;
      let file = m[1];
      if (file.startsWith('file://')) { try { file = fileURLToPath(file); } catch { continue; } }
      if (file === SELF || !inRoot(file) || file.includes(`${path.sep}node_modules${path.sep}`)) continue;
      return `${path.relative(ROOT, file).split(path.sep).join('/')}:${m[2]}`;
    }
    return '(none)';
  }
  const seenPath = (kind, arg) => { const p = asPath(arg); if (p) note(kind, site(), where(p)); };
  const KIND = {
    'fs-read': ['readFileSync', 'readFile', 'createReadStream', 'openSync', 'open', 'openAsBlob', 'readlinkSync'],
    'fs-list': ['readdirSync', 'readdir', 'opendirSync', 'opendir', 'globSync', 'glob'],
    'fs-stat': ['statSync', 'stat', 'lstatSync', 'lstat', 'existsSync', 'exists', 'accessSync', 'access', 'realpathSync', 'realpath'],
    'fs-write': ['writeFileSync', 'writeFile', 'appendFileSync', 'appendFile', 'mkdirSync', 'mkdir', 'rmSync', 'rm', 'rmdirSync', 'rmdir', 'unlinkSync', 'unlink', 'createWriteStream', 'mkdtempSync', 'mkdtemp'],
  };
  const TWO = { copyFileSync: ['fs-read', 'fs-write'], copyFile: ['fs-read', 'fs-write'], cpSync: ['fs-read', 'fs-write'], cp: ['fs-read', 'fs-write'], renameSync: ['fs-write', 'fs-write'], rename: ['fs-write', 'fs-write'],
    symlinkSync: ['fs-read', 'fs-write'], symlink: ['fs-read', 'fs-write'] };
  const wrap = (obj, name, kinds) => {
    const orig = obj[name];
    if (typeof orig !== 'function' || orig.__traced) return;
    const w = function (...args) { try { kinds.forEach((k, i) => { if (k) seenPath(k, args[i]); }); } catch { /* recording never breaks the call */ } return Reflect.apply(orig, this, args); };
    Object.defineProperty(w, 'name', { value: name }); w.__traced = true;
    for (const key of Object.getOwnPropertyNames(orig)) { if (!(key in w)) { try { Object.defineProperty(w, key, Object.getOwnPropertyDescriptor(orig, key)); } catch { /* fixed property */ } } }
    try { obj[name] = w; } catch { /* a name that cannot be set */ }
  };
  for (const [kind, names] of Object.entries(KIND)) for (const n of names) { wrap(fs, n, [kind]); wrap(fsp, n, [kind]); }
  for (const [n, kinds] of Object.entries(TWO)) { wrap(fs, n, kinds); wrap(fsp, n, kinds); }
  // child processes: the command and every argument that is a path inside the checkout
  for (const n of ['spawn', 'spawnSync', 'execFile', 'execFileSync', 'fork', 'exec', 'execSync']) {
    const orig = childProcess[n];
    if (typeof orig !== 'function') continue;
    const w = function (...args) {
      try {
        const at = site();
        const opts = args.find((a, i) => i > 0 && a && typeof a === 'object' && !Array.isArray(a));
        const cwd = opts && opts.cwd ? asPath(opts.cwd) : process.cwd();
        const words = n === 'exec' || n === 'execSync' ? String(args[0]).split(/\s+/) : [args[0], ...(Array.isArray(args[1]) ? args[1] : [])];
        note('proc-run', at, `${n} ${path.basename(String(words[0]))}`);
        if (opts && opts.cwd && cwd) note('proc-cwd', at, where(cwd));
        for (const w0 of words) {
          if (typeof w0 !== 'string') continue;
          const word = w0.startsWith('-') && w0.includes('=') ? w0.slice(w0.indexOf('=') + 1) : w0;
          if (!word || word.startsWith('-')) continue;
          const p = word.startsWith('file://') ? asPath(word) : path.isAbsolute(word) ? word : (word.includes('/') || /\.[a-z0-9]{1,6}$/i.test(word)) && cwd ? path.resolve(cwd, word) : null;
          if (p && inRoot(p) && fs.existsSync(p)) note('proc', at, where(p));
        }
      } catch { /* recording never breaks the call */ }
      return Reflect.apply(orig, this, args);
    };
    Object.defineProperty(w, 'name', { value: n });
    for (const key of Object.getOwnPropertyNames(orig)) { if (!(key in w)) { try { Object.defineProperty(w, key, Object.getOwnPropertyDescriptor(orig, key)); } catch { /* fixed property */ } } }
    childProcess[n] = w;
  }
  syncBuiltinESMExports();
  // modules: who asked for which file, and which files were loaded
  if (typeof module.registerHooks === 'function') {
    module.registerHooks({
      resolve(specifier, context, nextResolve) {
        // only when asked: a stand-in for the Workers runtime's own module, so that a file that names it can be loaded in Node
        if (process.env.GRAPH_TRACE_STUB_CF && specifier === 'cloudflare:workers') {
          return { url: 'data:text/javascript,export class DurableObject{constructor(c,e){this.ctx=c;this.env=e}};export class WorkerEntrypoint{constructor(c,e){this.ctx=c;this.env=e}};export class RpcTarget{};export const env={};', shortCircuit: true };
        }
        const r = nextResolve(specifier, context);
        try {
          if (r && typeof r.url === 'string' && r.url.startsWith('file:')) {
            const to = fileURLToPath(r.url);
            let from = '(entry)';
            if (context.parentURL && context.parentURL.startsWith('file:')) { const p = fileURLToPath(context.parentURL); from = p === SELF ? '(preload)' : where(p); }
            note('import', from, where(to));
          }
        } catch { /* recording never breaks the load */ }
        return r;
      },
      load(url, context, nextLoad) {
        try { if (url.startsWith('file:')) note('load', '', where(fileURLToPath(url))); } catch { /* recording never breaks the load */ }
        return nextLoad(url, context);
      },
    });
  }
  let written = false;
  const flush = () => {
    if (written) return; written = true;
    try {
      real.mkdirSync(OUT, { recursive: true });
      real.writeFileSync(path.join(OUT, `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`),
        JSON.stringify({ argv: process.argv.slice(1).map((a) => (inRoot(path.resolve(a)) ? where(path.resolve(a)) : a)).slice(0, 12), cwd: where(process.cwd()), records: [...records].map(([k, n]) => [...k.split('|'), n]) }));
    } catch { /* nothing to do */ }
  };
  process.on('exit', flush);
}

function merge(folder, outFile) {
  const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
  const repo = path.resolve(arg('--modules', process.cwd()));
  const order = real.readFileSync(path.join(repo, 'process/modules/order.txt'), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  const claims = order.flatMap((name) => { const e = JSON.parse(real.readFileSync(path.join(repo, `process/modules/${name}.json`), 'utf8')); return [...(e.files ?? []), ...(e.tests ?? [])].map((p) => ({ p, m: name })); });
  const under = (file, p) => (p.endsWith('/') ? file.startsWith(p) : file === p || file.startsWith(`${p}/`));
  const cache = new Map();
  const ownerOf = (rel) => { if (cache.has(rel)) return cache.get(rel); let best = null; for (const c of claims) if (under(rel, c.p) && (!best || c.p.length > best.p.length)) best = c; cache.set(rel, best ? best.m : null); return cache.get(rel); };
  const sites = {}; const imports = new Map(); const loads = new Set(); let processes = 0;
  // several folders may be given, with commas between them
  for (const [dir, name] of folder.split(',').flatMap((dir) => real.readdirSync(dir).map((name) => [dir, name]))) {
    if (!name.endsWith('.json')) continue;
    let d; try { d = JSON.parse(real.readFileSync(path.join(dir, name), 'utf8')); } catch { continue; }
    processes++;
    for (const [kind, at, p, n] of d.records) {
      if (kind === 'load') { loads.add(p); continue; }
      if (kind === 'import') { const k = `${at}|${p}`; imports.set(k, (imports.get(k) ?? 0) + n); continue; }
      // by calling place, then by kind of call: how many calls, and which paths
      const s = ((sites[at] ??= {})[kind] ??= { n: 0, owners: {}, other: {}, paths: new Map() });
      s.n += n;
      if (kind === 'proc-run') { s.other[p] = (s.other[p] ?? 0) + n; continue; }
      if (p.startsWith('<')) { s.other[p] = (s.other[p] ?? 0) + 1; continue; }
      if (!s.paths.has(p)) {
        const isDir = fs.existsSync(path.join(repo, p)) && fs.statSync(path.join(repo, p)).isDirectory();
        s.paths.set(p, ownerOf(isDir && p !== '.' ? `${p}/` : p) ?? (isDir ? '(a folder no module claims)' : '(no owner)'));
      }
    }
  }
  for (const byKind of Object.values(sites)) for (const s of Object.values(byKind)) {
    for (const o of s.paths.values()) s.owners[o] = (s.owners[o] ?? 0) + 1;
    s.distinct = s.paths.size; s.ex = [...s.paths.keys()].slice(0, 3); delete s.paths;
    if (!s.ex.length) delete s.ex;
    if (!Object.keys(s.other).length) delete s.other;
  }
  // --only <json>: keep the calling places a list names (a JSON list of "file:line"), and leave the import edges and loads out
  const only = arg('--only', null);
  if (only) {
    const list = JSON.parse(real.readFileSync(only, 'utf8'));
    // graph/computed.json itself may be given: its places are file → rows with a line `l`
    const keep = new Set(Array.isArray(list) ? list : [...Object.entries(list.computed ?? {}), ...Object.entries(list.via ?? {})].flatMap(([f, rows]) => rows.map((r) => `${f}:${Array.isArray(r) ? r[0] : r.l}`)));
    // compact: the owners as places on the order file (0 first), without the count of paths for each
    const place = new Map(order.map((n, i) => [n, i]));
    const kept = Object.fromEntries(Object.entries(sites).filter(([k]) => keep.has(k)).sort().map(([k, byKind]) => [k, Object.fromEntries(Object.entries(byKind).map(([kind, v]) => [kind, {
      n: v.n, distinct: v.distinct, mods: Object.keys(v.owners).filter((o) => place.has(o)).map((o) => place.get(o)).sort((a, b) => a - b),
      ...(v.owners['(no owner)'] ? { unowned: v.owners['(no owner)'] } : {}), ...(v.owners['(a folder no module claims)'] ? { noClaim: v.owners['(a folder no module claims)'] } : {}),
      ...(v.other ? { other: v.other } : {}), ...(v.ex ? { ex: v.ex.slice(0, 1) } : {}) }]))]));
    real.writeFileSync(outFile, `${JSON.stringify({ made: 'by tools/trace.mjs merge, from traced runs of test files (tools/trace-run.mjs)', format: 'sites: "file:line" → kind of call → { n calls, distinct paths, mods: the modules that own those paths as places on process/modules/order.txt (0 first), unowned and noClaim: paths no module owns and folders no module claims, other: paths outside the checkout by where, ex: one of the paths }', processes, callingPlacesSeen: Object.keys(sites).length, sites: kept })}\n`);
    console.log(`${processes} processes, ${Object.keys(sites).length} calling places, ${Object.keys(kept).length} kept → ${outFile}`);
    return;
  }
  real.writeFileSync(outFile, JSON.stringify({ processes, sites, imports: [...imports.keys()].sort(), loads: [...loads].sort() }));
  console.log(`${processes} processes, ${Object.keys(sites).length} calling places, ${imports.size} import edges, ${loads.size} files loaded → ${outFile}`);
}
