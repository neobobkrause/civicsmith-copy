// The run-time cross-check of the graph: loads a module's main code file in Node under the recorder (trace.mjs) and
// compares the files Node loaded with the files the graph says its static imports reach.
//   node crosscheck.mjs <checkout> <full.json from graph.mjs --full> <out.json> <module> [<module> …]
// A module's main file is index.mjs in the first folder its entry's `files` names, unless given as module=path.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (process.argv[2] === 'edges') { compareEdges(process.argv[3], process.argv[4], process.argv[5]); process.exit(0); }
if (process.argv[2] === 'settled') { compareSettled(process.argv[3], process.argv[4], process.argv[5]); process.exit(0); }
const [checkout, fullFile, outFile, ...wanted] = process.argv.slice(2);
const root = path.resolve(checkout);
const TRACE = fileURLToPath(new URL('./trace.mjs', import.meta.url));
const { REFS } = JSON.parse(fs.readFileSync(fullFile, 'utf8'));
const edges = (kinds) => { const m = new Map(); for (const r of REFS) if (!r.c && kinds.includes(r.k) && r.tk === 'file') { if (!m.has(r.f)) m.set(r.f, new Set()); m.get(r.f).add(r.to); } return m; };
const STATIC = edges(['import', 'export-from']); const WITH_DYNAMIC = edges(['import', 'export-from', 'dynamic-import']);
const closure = (start, g) => { const seen = new Set([start]); const q = [start]; while (q.length) { const f = q.pop(); for (const t of g.get(f) ?? []) if (!seen.has(t)) { seen.add(t); q.push(t); } } return seen; };
const fsRefs = new Map(); for (const r of REFS) if (/^(fs-|proc|worker|sqlite)/.test(r.k)) { if (!fsRefs.has(r.f)) fsRefs.set(r.f, []); fsRefs.get(r.f).push(r); }
const work = fs.mkdtempSync(path.join(path.dirname(path.resolve(outFile)), 'crosscheck-'));
const results = [];
for (const w of wanted) {
  const [mod, given] = w.split('=');
  const entry = JSON.parse(fs.readFileSync(path.join(root, `process/modules/${mod}.json`), 'utf8'));
  const main = given ?? `${entry.files[0].replace(/\/?$/, '/')}index.mjs`;
  const raw = path.join(work, mod); fs.mkdirSync(raw, { recursive: true });
  const env = { PATH: process.env.PATH, HOME: work, TMPDIR: work, LANG: 'C.UTF-8', NODE_OPTIONS: `--import=${TRACE}`, GRAPH_TRACE_OUT: raw, GRAPH_TRACE_ROOT: root, GRAPH_TRACE_STUB_CF: '1' };
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(path.join(root, main)).href)});`], { cwd: root, env, encoding: 'utf8', timeout: 120000 });
  const loaded = new Set(); const imports = new Set(); const fsSeen = [];
  for (const name of fs.readdirSync(raw)) {
    const d = JSON.parse(fs.readFileSync(path.join(raw, name), 'utf8'));
    for (const [kind, at, p] of d.records) {
      // "[eval1]" is this script's own one-line program that imports the main file; "(none)" is Node itself, with no frame of the checkout
      if (kind === 'load') { if (!p.startsWith('<')) loaded.add(p); } else if (kind === 'import') { if (!p.startsWith('<') && !at.startsWith('(') && !at.startsWith('[eval')) imports.add(`${at} → ${p}`); } else fsSeen.push([kind, at, p]);
    }
  }
  const predicted = closure(main, STATIC); const withDynamic = closure(main, WITH_DYNAMIC);
  const loadedNotPredicted = [...loaded].filter((f) => !predicted.has(f)).sort();
  const predictedNotLoaded = [...predicted].filter((f) => !loaded.has(f)).sort();
  // every import Node resolved, file to file, against the graph's own edges
  const edgeMissing = [...imports].filter((e) => { const [a, b] = e.split(' → '); return !(WITH_DYNAMIC.get(a)?.has(b)); }).sort();
  const staticEdgesInLoaded = []; for (const f of loaded) for (const t of STATIC.get(f) ?? []) staticEdgesInLoaded.push(`${f} → ${t}`);
  const edgeNotSeen = staticEdgesInLoaded.filter((e) => !imports.has(e)).sort();
  const predictedFs = [...loaded].flatMap((f) => (fsRefs.get(f) ?? []).map((x) => `${x.k} ${f}:${x.l}`));
  results.push({ module: mod, main, exit: r.status, error: r.status === 0 ? undefined : (r.stderr || '').split('\n').filter(Boolean).slice(-3).join(' | ').slice(0, 300),
    loaded: loaded.size, predicted: predicted.size, predictedWithLiteralDynamicImports: withDynamic.size, loadedNotPredicted, loadedNotPredictedButInDynamic: loadedNotPredicted.filter((f) => withDynamic.has(f)).length,
    predictedNotLoaded, importsResolved: imports.size, importsNotInGraph: edgeMissing, graphStaticEdgesAmongLoaded: staticEdgesInLoaded.length, graphEdgesNotSeenAtRunTime: edgeNotSeen,
    fileSystemCallsByNodeLoadingTheFiles: fsSeen.filter(([, at, p]) => (at === '(none)' || at.startsWith('[eval')) && (loaded.has(p) || p.startsWith('<'))).length,
    fileSystemCallsFromTheCheckoutsCode: [...new Set(fsSeen.filter(([, at]) => at !== '(none)' && !at.startsWith('[eval')).map((x) => x.join(' ')))].slice(0, 40),
    fileSystemCallsOther: [...new Set(fsSeen.filter(([, at, p]) => (at === '(none)' || at.startsWith('[eval')) && !(loaded.has(p) || p.startsWith('<'))).map((x) => x.join(' ')))].slice(0, 40),
    fileSystemReferencesTheGraphHasInTheLoadedFiles: predictedFs.length });
  const last = results[results.length - 1];
  console.log(`${mod}: exit ${last.exit}; loaded ${last.loaded}, predicted ${last.predicted}; loaded-not-predicted ${loadedNotPredicted.length}; predicted-not-loaded ${predictedNotLoaded.length}; imports resolved ${imports.size}, not in graph ${edgeMissing.length}; graph edges not seen ${edgeNotSeen.length}; fs calls by Node's loader ${last.fileSystemCallsByNodeLoadingTheFiles}, from the checkout's code ${last.fileSystemCallsFromTheCheckoutsCode.length}, other ${last.fileSystemCallsOther.length}`);
}
fs.rmSync(work, { recursive: true, force: true });
fs.writeFileSync(outFile, `${JSON.stringify({ format: 'One row for each module whose main code file was loaded in Node under tools/trace.mjs. loaded = repository files Node loaded; predicted = the files the graph reaches from the main file by import and export-from. The four lists are the mismatches, each way, by file and by edge.', results }, null, 1)}\n`);

/** node crosscheck.mjs edges <merged.json from trace.mjs merge> <full.json> <out.json>: every import Node resolved in the
 *  traced runs, file to file, against the graph's import edges. */
function compareEdges(mergedFile, fullFile, outFile) {
  const { imports, loads, processes } = JSON.parse(fs.readFileSync(mergedFile, 'utf8'));
  const { REFS, VIA } = JSON.parse(fs.readFileSync(fullFile, 'utf8'));
  const known = new Set(); const computedIn = new Set();
  for (const r of [...REFS, ...VIA]) {
    if (!['import', 'export-from', 'dynamic-import', 'require', 'loader', 'resolve', 'require-resolve'].includes(r.k)) continue;
    if (r.c) computedIn.add(r.f); else if (r.tk === 'file') known.add(`${r.f}|${r.to}`);
  }
  let matched = 0; let entry = 0; let outside = 0; const viaComputed = []; const missing = [];
  for (const e of imports) {
    const [from, to] = e.split('|');
    if (from.startsWith('(') || from.startsWith('[') || from === '.') { entry++; continue; }
    if (from.startsWith('<') || to.startsWith('<')) { outside++; continue; }
    if (known.has(e)) matched++; else if (computedIn.has(from)) viaComputed.push(e); else missing.push(e);
  }
  const out = { format: 'Every import Node resolved in the traced test runs, as "file|file", against the graph. matched = the graph has the same edge as an import, export-from, a literal import() or require; fromAFileWithAComputedImport = the graph has no such edge and the importing file has a computed import() (listed in computed.json); missing = neither.',
    processes, filesLoaded: loads.filter((l) => !l.startsWith('<')).length, edgesResolved: imports.length, entryOrPreload: entry, toOrFromOutsideTheCheckout: outside, matched, fromAFileWithAComputedImport: viaComputed, missing };
  fs.writeFileSync(outFile, `${JSON.stringify(out, null, 1)}\n`);
  console.log(`edges ${imports.length}: matched ${matched}, entry or preload ${entry}, outside ${outside}, from a file with a computed import ${viaComputed.length}, missing ${missing.length}`);
}

/** node crosscheck.mjs settled <raw folder>[,<raw folder>…] <full.json> <out.json>: every reference the extractor settled at a
 *  file-system call or an import(), against what the traced runs saw at that line. */
function compareSettled(rawFolders, fullFile, outFile) {
  const { REFS } = JSON.parse(fs.readFileSync(fullFile, 'utf8'));
  const seen = new Map(); const imports = new Set(); const importers = new Set();
  for (const dir of rawFolders.split(',')) for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    const d = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    for (const [kind, at, p] of d.records) {
      if (kind === 'import') { imports.add(`${at}|${p}`); importers.add(at); continue; }
      if (kind === 'load') continue;
      const k = `${at}|${kind}`; if (!seen.has(k)) seen.set(k, new Set()); seen.get(k).add(p);
    }
  }
  const literal = /^(['"`][^$]*['"`]|new URL\(\s*['"`][^$]*['"`]\s*,\s*import\.meta\.url\s*\))$/;
  const counts = {}; const differing = [];
  const bump = (g, k) => { (counts[g] ??= {})[k] = (counts[g][k] ?? 0) + 1; };
  for (const r of REFS) {
    if (r.c || r.lang || !['fs-read', 'fs-list', 'fs-stat', 'fs-write', 'dynamic-import'].includes(r.k) || !['file', 'dir'].includes(r.tk)) continue;
    const g = `${literal.test(r.s ?? '') ? 'literal' : 'followed'} ${r.k === 'dynamic-import' ? 'import()' : 'file system'}`;
    const target = r.to.replace(/\/$/, '');
    if (r.k === 'dynamic-import') { bump(g, !importers.has(r.f) ? 'file not run' : imports.has(`${r.f}|${target}`) ? 'seen as written' : 'file run, this import not seen'); continue; }
    const set = seen.get(`${r.f}:${r.l}|${r.k}`);
    if (!set) { bump(g, 'line not reached in the runs'); continue; }
    if (set.has(target) || set.has(r.to)) bump(g, 'seen as written');
    else { bump(g, 'line reached, other paths seen'); differing.push(`${r.f}:${r.l} [${r.k}] ${(r.s ?? '').slice(0, 60)} -> graph: ${r.to}${r.multi ? ` (one of ${r.multi})` : ''} | run: ${[...set].slice(0, 2).join(', ')}`); }
  }
  fs.writeFileSync(outFile, `${JSON.stringify({ counts, differing }, null, 1)}\n`);
  console.log(JSON.stringify(counts), differing.length ? `\n${differing.join('\n')}` : '');
}
