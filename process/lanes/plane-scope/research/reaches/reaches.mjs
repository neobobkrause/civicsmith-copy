#!/usr/bin/env node
// Reaches by path to a LATER module under the plan's new order (plane-scope research 24).
//
//   node process/lanes/plane-scope/research/reaches/reaches.mjs <scratch-folder> [--order old] [--no-run] [--write <file>]
//
// Run from the repository's top folder. It changes nothing in the checkout. In <scratch-folder> it:
//  1. writes a module set: a copy of every process/modules/<name>.json, a NEW order.txt (modules 1..175 as today, then
//     control-plane, plane, the 19 UI modules, then a new module "top" owning bio-plane/src/plane/index.mjs and
//     bio-plane/src/plane/ui.mjs (ui.mjs does not exist yet), then release and the rest as today) and top.json. With
//     --order old: today's order, no top. Every module keeps today's files and tests; top has no tests.
//  2. copies research/tools/graph.mjs with four lines changed (ROOT, OUT and the two module-file reads point at the
//     checkout, the scratch output folder and the scratch module set), copies hand-resolutions.json, and copies
//     runtime-sites.json with every module index re-numbered to the new order (the runs saw "plane" as one module:
//     a file of top read in a run is still counted as plane's; see 24-reaches-by-path.md).
//  3. runs the copy (about 90 s, about 5 GB), which writes <scratch-folder>/graph-<order>/*.json,
//  4. reads upward.json from it and writes <scratch-folder>/places-<order>.json: every place (file:line) with a
//     reference to a later module that is not an import, export-from, literal import(), comment import or require,
//     and not a text lead; per place the referring module, code or test, the kinds, the later modules reached, how
//     known, and for each module reached whether the pair is upward today (today's order, top counted as plane).
//     --write <file> writes it there instead (research/reaches/places.json was written so). --no-run reuses step 3's output.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const SCR = path.resolve(process.argv[2] ?? '');
if (!process.argv[2]) { console.error('usage: reaches.mjs <scratch-folder> [--order old]'); process.exit(2); }
const OLD = process.argv.includes('--order') && process.argv[process.argv.indexOf('--order') + 1] === 'old';
const TAG = OLD ? 'old' : 'new';
const TOOLS = path.join(ROOT, 'process/lanes/plane-scope/research/tools');
const MODSRC = path.join(ROOT, 'process/modules');

// 1. the module set
const today = fs.readFileSync(path.join(MODSRC, 'order.txt'), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
const ix = (n) => { const i = today.indexOf(n); if (i < 0) throw new Error(`no module ${n}`); return i; };
const UI = today.slice(ix('interface-assets'), ix('screens-action') + 1);
if (UI.length !== 19 || ix('store-request') !== 174 || ix('control-plane') !== 194 || ix('plane') !== 195 || ix('release') !== 196) throw new Error('the order is not the one the plan describes');
const neworder = OLD ? today : [...today.slice(0, ix('store-request') + 1), 'control-plane', 'plane', ...UI, 'top', ...today.slice(ix('release'))];
const MODS = path.join(SCR, `modules-${TAG}`);
fs.mkdirSync(MODS, { recursive: true });
for (const n of today) fs.copyFileSync(path.join(MODSRC, `${n}.json`), path.join(MODS, `${n}.json`));
if (!OLD) fs.writeFileSync(path.join(MODS, 'top.json'), `${JSON.stringify({ files: ['bio-plane/src/plane/index.mjs', 'bio-plane/src/plane/ui.mjs'], tests: [], uses: [] }, null, 2)}\n`);
fs.writeFileSync(path.join(MODS, 'order.txt'), `${neworder.join('\n')}\n`);

// 2. the extractor's copy
const T = path.join(SCR, `tools-${TAG}`);
fs.mkdirSync(T, { recursive: true });
let src = fs.readFileSync(path.join(TOOLS, 'graph.mjs'), 'utf8');
const swap = (a, b) => { if (!src.includes(a)) throw new Error(`graph.mjs changed: ${a}`); src = src.replace(a, b); };
swap("const ROOT = path.resolve(HERE, '../../../../..');", 'const ROOT = process.env.REACH_ROOT;');
swap("const OUT = path.resolve(HERE, '..', 'graph');", 'const OUT = process.env.REACH_OUT;');
swap("path.join(ROOT, 'process/modules/order.txt')", "path.join(process.env.REACH_MODS, 'order.txt')");
swap('path.join(ROOT, `process/modules/${name}.json`)', 'path.join(process.env.REACH_MODS, `${name}.json`)');
fs.writeFileSync(path.join(T, 'graph.mjs'), src);
fs.copyFileSync(path.join(TOOLS, 'hand-resolutions.json'), path.join(T, 'hand-resolutions.json'));
const rt = JSON.parse(fs.readFileSync(path.join(TOOLS, 'runtime-sites.json'), 'utf8'));
const re = (i) => neworder.indexOf(today[i]);
for (const site of Object.values(rt.sites)) for (const k of Object.values(site)) if (Array.isArray(k.mods)) k.mods = k.mods.map(re).sort((a, b) => a - b);
for (const f of Object.keys(rt.importsOf ?? {})) rt.importsOf[f] = rt.importsOf[f].map(re).sort((a, b) => a - b);
fs.writeFileSync(path.join(T, 'runtime-sites.json'), JSON.stringify(rt));

// 3. run it
const OUT = path.join(SCR, `graph-${TAG}`);
if (!process.argv.includes('--no-run')) {
  const r = spawnSync(process.execPath, [path.join(T, 'graph.mjs')], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, REACH_ROOT: ROOT, REACH_OUT: OUT, REACH_MODS: MODS } });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

// 4. the places
const up = JSON.parse(fs.readFileSync(path.join(OUT, 'upward.json'), 'utf8'));
if (up.modules.join() !== neworder.join()) throw new Error('upward.json is not on the order written');
const LITERAL_IMPORT = /\bimport\(\s*("[^"]*"|'[^']*'|`[^`$]*`)\s*[,)]/;
const IMPORTISH = /^(import|export-from|dynamic-import|jsdoc-import|require)( \(no such file\))?$/;
const oldIndex = (n) => today.indexOf(n === 'top' ? 'plane' : n);
const howOf = (k) => (/\(seen in a run\)$/.test(k) ? 'run' : /\(read by hand\)$/.test(k) ? 'hand' : /\(a pattern of files\)$/.test(k) ? 'pattern'
  : /\(a file or folder inside the folder listed\)$/.test(k) ? 'listing' : /\(path given by a caller\)$/.test(k) ? 'callers' : /\(start of the path known\)$/.test(k) ? 'start' : 'settled');
const places = new Map();
const excluded = { import: [], lead: 0 };
for (const [from, side, at, ki, to, what] of up.rows) {
  const kind = up.kinds[ki];
  if (kind.startsWith('path-text')) { excluded.lead++; continue; }
  // An import() whose argument is not one literal text is a computed import() even where the graph settled it (a
  // template over a list of names, a name bound to a path): it stays in the list. Every other import kind is left out.
  let computedImport = false;
  if (IMPORTISH.test(kind)) {
    if (kind.startsWith('dynamic-import')) {
      const [file, line] = [at.replace(/:\d+$/, ''), Number(at.match(/:(\d+)$/)[1])];
      const text = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n')[line - 1] ?? '';
      computedImport = !LITERAL_IMPORT.test(text);
    }
    if (!computedImport) { excluded.import.push({ at, kind, from: neworder[from], to: to.map((i) => neworder[i]) }); continue; }
  }
  const f = neworder[from];
  if (!places.has(at)) places.set(at, { at, file: at.replace(/:\d+$/, ''), line: Number(at.match(/:(\d+)$/)[1]), from: f, fromIndex: from + 1, side: side ? 'test' : 'code', kinds: [], how: [], what: [], to: new Map() });
  const p = places.get(at);
  const kindShown = computedImport ? `${kind} (computed, settled by the graph)` : kind;
  if (!p.kinds.includes(kindShown)) p.kinds.push(kindShown);
  const h = howOf(kind); if (!p.how.includes(h)) p.how.push(h);
  if (what && !p.what.includes(what)) p.what.push(what);
  for (const t of to) {
    const tn = neworder[t];
    if (!p.to.has(tn)) p.to.set(tn, { module: tn, index: t + 1, todayUpward: oldIndex(tn) > oldIndex(f), how: [] });
    if (!p.to.get(tn).how.includes(h)) p.to.get(tn).how.push(h);
  }
}
const list = [...places.values()].map((p) => {
  const to = [...p.to.values()].sort((a, b) => a.index - b.index);
  return { ...p, to, reached: to.length, todayUpward: to.filter((t) => t.todayUpward).length, madeUpward: to.filter((t) => !t.todayUpward).length,
    runSawPlane: p.how.includes('run') && to.some((t) => t.module === 'plane' && t.how.includes('run')) };
}).sort((a, b) => a.fromIndex - b.fromIndex || a.file.localeCompare(b.file) || a.line - b.line);
// 5. Annotations: the group each place belongs to (24-reaches-by-path.md gives each group's options), a one-line
//    purpose read from the code for code places and for tests of control-plane, plane, top and the UI modules, whether
//    a place the runs saw reach plane also reaches top's file by the code's reading, and what research 22a-22c
//    (classify/*.json) say of the test file holding the place.
const GROUPS = [
  ['a-entry-config', /^bio-plane\/wrangler\.jsonc$/, 'deployment config: wrangler `main` names the Worker entry (`wrangler dev`, the dev script)'],
  ['b-setup-words-extract', /^bio-plane\/src\/setup-words\/build\.mjs$/, 'generator: extract(root) reads the source of every module of build/modules.json for localize() calls, to write rows.mjs and words-unreviewed.json'],
  ['c-bundler', /^bio-plane\/scripts\/fleet-bundle\.mjs$/, 'build tool library: discovers fleet members, builds, hashes and verifies a member handed to it by a caller'],
  ['design-words-builder', /^docs\/development\/ux-substrate\/screens\/(build_words\.mjs|words-modules\.src\.py)$/, 'design generator: reads the mockup scripts (journey-check) and writes or reads words.json (setup-words)'],
  ['test-runner', /^(\.github\/scripts\/module-tests\.mjs|bio-plane\/package\.json|pdf-worker\/package\.json|agent-worker\/package\.json)$/, 'package script or test runner'],
  ['declared-ops-collector', /^bio-plane\/test\/declared-ops\.mjs$/, 'test helper (code of test-support): walks modules\' files, reads each, imports those that export DECLARED_OPS'],
  ['service-binding', /^agent-worker\/wrangler\.jsonc$/, 'deployment config: service binding PLANE -> the Worker named bio-plane'],
  ['installer-words', /^newgroup\/scripts\/build\.mjs$/, 'build tool: reads journey-check\'s words-reads.json to cut the installer\'s word rows'],
  ['computed-import', /./, 'test imports each module of a list by a path it builds (import(`../../../src/${m}/index.mjs`), import(ENTRY)): a computed import()', (p) => p.kinds.some((k) => k.includes('(computed, settled by the graph)'))],
  ['words-reads-table', /./, 'test reads journey-check\'s words-reads.json or a mockup file (keys the module reads, by design)', (p) => p.what.some((w) => /ux-substrate\/screens\/(words-reads\.json|mock-[a-z]+\.js)/.test(w)) && p.reached === 1],
  ['boots-entry', /./, 'test or test helper starts a Worker (Miniflare) from the entry src/plane/index.mjs, or holds that path for one', (p) => p.to.every((t) => t.module === 'top' || t.module === 'plane') && p.to.some((t) => t.module === 'top') && !/sa-assembly/.test(p.file)],
  ['census', /^(bio-plane\/test\/m\/(member-roster\/module-order|money\/refusal-census|plane\/g83-census|lines\/invariants|store-assembly\/sa-assembly)\.test\.mjs|agent-worker\/test\/t35\.test\.mjs|stewards\/test\/requirements\.test\.mjs|pdf-worker\/test\/test-script\.test\.mjs)$/, 'census test: walks a whole folder (all of src/, the repository, a test folder) and reads or imports what it finds'],
  ['census', /^bio-plane\/test\/m\/plane\/worker\.test\.mjs$/, 'census test: R8 scans every file under src/, test/ and scripts/ for imports of three removed files', (p) => p.line > 100],
  ['plane-world-copy', /plane-world\.mjs$/, 'test helper: makes a scratch copy of the repository (a link to every top folder, a copy of bio-plane/src) to run the plane from'],
  ['child-fixture', /sa-parity\.test\.mjs$/, 'test starts a child process that imports plane\'s test fixture by a path it builds'],
  ['worker-program-text', /page-contention\.probe\.mjs$/, 'probe writes a Worker program whose text imports interface-shell and nine screens modules by path'],
  ['test-cache', /c25-seam\.test\.mjs$/, 'test downloads a pinned PDF into screens-daily\'s test folder .cache/ and reads it'],
  ['fixture-maker', /make-(dct|jbig2|jpx)-fixtures\.py$/, 'fixture maker (Python) writes or reads a PDF fixture in a folder pdf-pixels owns'],
  ['single-file-check', /(run-rules\/deployment|wizard-scripts\/source\/registry)\.test\.mjs$/, 'test checks one named file of a later module exists or holds its folder path'],
];
const TOP_BY_READING = {
  'bio-plane/test/declared-ops.mjs:80': [true, 'READ declared-ops.mjs:78-89 filesOf walks every `files` path (listedModules: build/modules.json lists bio-plane/src/plane/), so it stats src/plane/index.mjs'],
  'bio-plane/test/declared-ops.mjs:135': [true, 'READ declared-ops.mjs:131-135 reads every file filesOf found, src/plane/index.mjs among them'],
  'bio-plane/scripts/fleet-bundle.mjs:1133': [false, 'READ fleet-bundle.mjs:1133 reads <member>/wrangler.jsonc: bio-plane/wrangler.jsonc stays plane\'s'],
  'bio-plane/test/m/member-roster/module-order.test.mjs:76': [false, 'READ module-order.test.mjs:76 stats each path of build/modules.json; plane\'s path is the folder bio-plane/src/plane/, which plane keeps'],
  'bio-plane/test/m/money/refusal-census.test.mjs:13': [true, 'READ refusal-census.test.mjs:13-23 walks every folder under src/ and reads every .mjs, src/plane/index.mjs among them'],
  'bio-plane/test/m/money/refusal-census.test.mjs:15': [true, 'READ as :13'],
  'bio-plane/test/m/money/refusal-census.test.mjs:21': [false, 'READ :21 lists bio-plane/src/ itself: it names the folder plane/, plane\'s'],
  'bio-plane/test/m/money/refusal-census.test.mjs:23': [true, 'READ as :13'],
  'agent-worker/test/t35.test.mjs:607': [true, 'READ t35.test.mjs:606-613 walks the whole repository but five names and reads every .mjs and .js'],
  'agent-worker/test/t35.test.mjs:608': [true, 'READ as :607'],
  'agent-worker/test/t35.test.mjs:613': [true, 'READ as :607'],
  'bio-plane/test/m/lines/invariants.test.mjs:34': [true, 'READ invariants.test.mjs:34 keeps each folder of src/ holding an index.mjs, src/plane/ among them (an existsSync of src/plane/index.mjs)'],
  'bio-plane/test/m/lines/invariants.test.mjs:39': [true, 'READ invariants.test.mjs:39 imports join(SRC, d.name, "index.mjs") for each, so it imports src/plane/index.mjs'],
  'bio-plane/test/m/plane/g83-census.test.mjs:46': [true, 'READ g83-census.test.mjs:45-48, :66 walk every folder under src/ and read every .mjs, src/plane/index.mjs among them'],
  'bio-plane/test/m/plane/g83-census.test.mjs:48': [true, 'READ as :46'],
  'bio-plane/test/m/plane/g83-census.test.mjs:66': [true, 'READ as :46'],
  'bio-plane/test/m/plane/worker.test.mjs:145': [true, 'READ worker.test.mjs:145, :160-171: files(SRC) reads every .js and .mjs under src/, src/plane/index.mjs among them'],
  'bio-plane/test/m/plane/worker.test.mjs:166': [true, 'READ as :145'],
  'bio-plane/test/m/plane/worker.test.mjs:169': [true, 'READ as :145'],
  'agent-worker/test/plane-world.mjs:47': [true, 'READ plane-world.mjs:47-58: copies the whole of bio-plane/src (src/plane/index.mjs among it) into a temporary folder and writes an entry there that imports the copy of ./index.mjs; the copy is outside the repository, so the graph does not count it'],
  'bio-plane/test/m/capture-requests/plane-world.mjs:48': [true, 'READ plane-world.mjs:48-60: as agent-worker/test/plane-world.mjs:47'],
  'bio-plane/test/m/store-assembly/sa-parity.test.mjs:15': [false, 'READ sa-parity.test.mjs:15 and plane/fixture.mjs:18: the child imports src/plane/store.mjs, not the entry'],
};
const readJ = (f) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch { return null; } };
const CLASSIFIED = new Map();
const addC = (file, text) => { if (!CLASSIFIED.has(file)) CLASSIFIED.set(file, new Set()); CLASSIFIED.get(file).add(text); };
for (const r of readJ('process/lanes/plane-scope/research/classify/22a.json')?.rows ?? []) addC(r.file, `22a class ${r.class}, owner ${String(r.owner).split(';')[0].slice(0, 60)}`);
for (const r of Object.values(readJ('process/lanes/plane-scope/research/classify/22b.json') ?? {})) addC(r.file, `22b class ${r.cls} (a door test: control-plane, or top when it asserts screens)`);
for (const r of readJ('process/lanes/plane-scope/research/classify/22c.json')?.rows ?? []) addC(r.file, `22c class ${r.class}, owner ${String(r.owner).slice(0, 60)}${r.where ? `, ${String(r.where).slice(0, 60)}` : ''}`);
for (const p of list) {
  const g = GROUPS.find(([, re, , pred]) => re.test(p.file) && (!pred || pred(p)));
  p.group = g ? g[0] : 'other';
  if (g && (p.side === 'code' || ['control-plane', 'plane', 'top', ...UI].includes(p.from))) p.purpose = g[2];
  if (TOP_BY_READING[p.at]) p.topByReading = TOP_BY_READING[p.at];
  if (CLASSIFIED.has(p.file)) p.classified = [...CLASSIFIED.get(p.file)];
}
const out = {
  format: 'places: one entry for each file:line with at least one reference to a module LATER in the order written (order), other than an import, export-from, literal import(), comment import or require, and other than a text lead. from: the module owning the referring file (fromIndex: its place, 1 first); side: code (under `files`) or test (under `tests`); kinds: the graph\'s kinds at the place; how: settled (by the parser), callers (path given by a caller), start (start of the path known), listing (what lies directly inside a folder listed), pattern (a pattern of files in a package script), run (seen in a traced run), hand (read by hand); to: each later module reached as [module, its place (1 first), whether the pair is upward in today\'s order too (top counted as plane), how known]. runSawPlane: a traced run saw plane\'s files here; the run data name modules, not files, so whether top\'s file was among them is not in the data (topByReading: [reaches top, the reading]). group: the group 24-reaches-by-path.md gives options for; purpose: what the code at the place is for (code places, and tests of control-plane, plane, top and the UI modules); classified: what research 22a-22c say of the test file. excludedImports: rows of upward.json that are imports of the kinds above, listed apart.',
  order: neworder, made: `node process/lanes/plane-scope/research/reaches/reaches.mjs <scratch>${OLD ? ' --order old' : ''}`,
  totals: {
    places: list.length, code: list.filter((p) => p.side === 'code').length, test: list.filter((p) => p.side === 'test').length,
    references: list.reduce((a, p) => a + p.reached, 0),
    placesWithTodayUpward: list.filter((p) => p.todayUpward).length, placesOnlyMadeUpward: list.filter((p) => !p.todayUpward).length,
    referencesTodayUpward: list.reduce((a, p) => a + p.todayUpward, 0), referencesMadeUpward: list.reduce((a, p) => a + p.madeUpward, 0),
    leadRowsLeftOut: excluded.lead, importRowsLeftOut: excluded.import.length,
    byGroup: Object.fromEntries([...new Set(list.map((p) => p.group))].map((g) => [g, { places: list.filter((p) => p.group === g).length, code: list.filter((p) => p.group === g && p.side === 'code').length }])),
    referencesBySide: { code: { today: list.filter((p) => p.side === 'code').reduce((a, p) => a + p.todayUpward, 0), made: list.filter((p) => p.side === 'code').reduce((a, p) => a + p.madeUpward, 0) }, test: { today: list.filter((p) => p.side === 'test').reduce((a, p) => a + p.todayUpward, 0), made: list.filter((p) => p.side === 'test').reduce((a, p) => a + p.madeUpward, 0) } },
    placesBySide: Object.fromEntries(['code', 'test'].map((s) => [s, { onlyToday: list.filter((p) => p.side === s && p.todayUpward && !p.madeUpward).length, onlyMade: list.filter((p) => p.side === s && !p.todayUpward).length, both: list.filter((p) => p.side === s && p.todayUpward && p.madeUpward).length }])),
  },
  places: list, excludedImports: excluded.import,
};
out.totals.placesWhereTheReadingAddsTop = list.filter((p) => p.topByReading?.[0] && !p.to.some((t) => t.module === 'top')).length;
const compact = (o) => JSON.stringify(o);
const WRITE = process.argv.includes('--write') ? path.resolve(process.argv[process.argv.indexOf('--write') + 1]) : null;
fs.writeFileSync(WRITE ?? path.join(SCR, `places-${TAG}.json`), `{"format":${compact(out.format)},\n"order":${compact(out.order)},\n"made":${compact(out.made)},\n"totals":${JSON.stringify(out.totals, null, 1)},\n"places":[\n${out.places.map((p) => compact({ ...p, to: p.to.map((t) => [t.module, t.index, t.todayUpward, t.how.join('+')]) })).join(',\n')}\n],\n"excludedImports":[\n${out.excludedImports.map(compact).join(',\n')}\n]}\n`);
console.log(JSON.stringify(out.totals));
