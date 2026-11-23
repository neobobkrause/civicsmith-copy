#!/usr/bin/env node
// The dependency extractor of the plane-scope lane's layer research (09-graph.md describes the method).
// Run from the repository's top folder:  node process/lanes/plane-scope/research/tools/graph.mjs
// It reads every file a module owns (process/modules/*.json), parses the JavaScript with TypeScript's parser
// (the copy the process tool installs), the Python and HTML with Python's own parsers, the JSON with JSON.parse,
// and writes graph/*.json beside this folder. It changes nothing else.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import v8 from 'node:v8';
import { builtinModules, createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../../..');
const OUT = path.resolve(HERE, '..', 'graph');
const ARGV = new Set(process.argv.slice(2));

// The parse of 74 MB of JavaScript needs about 5 GB of heap: start again with room if this process has less.
if (v8.getHeapStatistics().heap_size_limit < 9e9 && !process.env.GRAPH_CHILD) {
  const r = spawnSync(process.execPath, ['--max-old-space-size=11000', '--stack-size=3900', fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    { stdio: 'inherit', env: { ...process.env, GRAPH_CHILD: '1' } });
  process.exit(r.status ?? 1);
}

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'process.json'), 'utf8'));
const TS_PATH = path.join(os.homedir(), 'process4', cfg.process.commit, 'tool', 'node_modules', 'typescript');
const ts = createRequire(import.meta.url)(TS_PATH);
const log = (...a) => console.error(...a);
const T0 = Date.now();
const lap = (what) => log(`[${((Date.now() - T0) / 1000).toFixed(1)}s] ${what}`);

// ---------------------------------------------------------------------------------------------------------------
// 1. Modules, the file set, ownership
// ---------------------------------------------------------------------------------------------------------------
const ORDER = fs.readFileSync(path.join(ROOT, 'process/modules/order.txt'), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
const MODS = ORDER.map((name, index) => ({ files: [], tests: [], uses: [], ...JSON.parse(fs.readFileSync(path.join(ROOT, `process/modules/${name}.json`), 'utf8')), name, index }));
const MOD_INDEX = new Map(MODS.map((m) => [m.name, m.index]));
/** Every path a module lists, as { p, m, t }: path, module name, in `tests`. */
const CLAIMS = MODS.flatMap((m) => [...m.files.map((p) => ({ p, m: m.name, t: false })), ...m.tests.map((p) => ({ p, m: m.name, t: true }))]);
const CLAIMS_BY_TOP = new Map();
for (const c of CLAIMS) { const top = c.p.split('/')[0]; if (!CLAIMS_BY_TOP.has(top)) CLAIMS_BY_TOP.set(top, []); CLAIMS_BY_TOP.get(top).push(c); }
/** The process tool's own rule (tool/lib/util.mjs underPath): a path ending in "/" claims what starts with it; any other claims itself and what is under it. */
const underPath = (file, p) => (p.endsWith('/') ? file.startsWith(p) : file === p || file.startsWith(`${p}/`));
const ownerCache = new Map();
/** The owner of a path relative to the top: the longest claim that matches, over `files` and `tests` of every module.
 *  → { m, t, p, tie: [other claims of the same length by another module or the other list] } or null. */
function ownerOf(rel) {
  if (ownerCache.has(rel)) return ownerCache.get(rel);
  let best = null; let tie = [];
  for (const c of CLAIMS_BY_TOP.get(rel.split('/')[0]) ?? []) {
    if (!underPath(rel, c.p)) continue;
    if (!best || c.p.length > best.p.length) { best = c; tie = []; } else if (c.p.length === best.p.length && (c.m !== best.m || c.t !== best.t)) tie.push(c);
  }
  const r = best ? { m: best.m, t: best.t, p: best.p, tie } : null;
  ownerCache.set(rel, r);
  return r;
}

/** The file set: what git tracks, and what is in the working tree untracked and not ignored. */
const ALL_FILES = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 30 })
  .split('\0').filter(Boolean).filter((f) => fs.existsSync(path.join(ROOT, f))).sort();
const FILE_SET = new Set(ALL_FILES);
const DIR_SET = new Set();
for (const f of ALL_FILES) { let d = path.posix.dirname(f); while (d !== '.' && !DIR_SET.has(d)) { DIR_SET.add(d); d = path.posix.dirname(d); } }
const OWNED = ALL_FILES.filter((f) => ownerOf(f));
const JS_EXT = new Set(['.mjs', '.js', '.cjs', '.ts', '.mts', '.cts', '.jsx', '.tsx']);
const JS_FILES = OWNED.filter((f) => JS_EXT.has(path.extname(f)));
lap(`modules ${MODS.length}, files ${ALL_FILES.length}, owned ${OWNED.length}, JavaScript ${JS_FILES.length}`);

/** What an absolute path is, seen from the repository. */
function classify(abs) {
  if (abs.startsWith('<')) {
    if (abs.startsWith('<cwd>')) {
      const rest = abs.slice(5).replace(/^\/+/, '');
      return { kind: 'cwd', rest };
    }
    return { kind: 'outside', where: abs.split('/')[0] };
  }
  const rel0 = path.relative(ROOT, abs);
  if (rel0.startsWith('..') || path.isAbsolute(rel0)) return { kind: 'outside', where: abs };
  const rel = rel0.split(path.sep).join('/');
  if (rel === '') return { kind: 'dir', rel: '.', owner: null };
  if (FILE_SET.has(rel)) return { kind: 'file', rel, owner: ownerOf(rel) };
  if (DIR_SET.has(rel)) return { kind: 'dir', rel: `${rel}/`, owner: ownerOf(`${rel}/`) };
  if (rel.split('/').includes('node_modules')) return { kind: 'node_modules', rel };
  if (fs.existsSync(abs)) return { kind: 'untracked', rel, owner: ownerOf(rel) };
  return { kind: 'missing', rel, owner: ownerOf(rel) };
}

// ---------------------------------------------------------------------------------------------------------------
// 2. The program: every owned JavaScript file, parsed and bound, with no import followed by the parser
// ---------------------------------------------------------------------------------------------------------------
const absOf = (rel) => path.join(ROOT, rel);
const relOf = (abs) => path.relative(ROOT, abs).split(path.sep).join('/');
const host = ts.createCompilerHost({ allowJs: true }, true);
const program = ts.createProgram(JS_FILES.map(absOf), { allowJs: true, checkJs: false, noLib: true, noResolve: true, target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext, moduleDetection: ts.ModuleDetectionKind.Force, types: [], noEmit: true }, host);
lap('parsed');
const checker = program.getTypeChecker();
lap('bound');

const BUILTIN = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`), 'node:sqlite', 'node:test', 'node:sea', 'node:test/reporters']);
const normLib = (name) => name.replace(/^node:/, '');
/** A specifier as Node reads it from a file: { kind: 'file', abs } | { kind: 'builtin'|'package'|'scheme', name }. */
function resolveSpec(fromAbs, spec) {
  if (/^(\.\.?(\/|$)|\/)/.test(spec)) return { kind: 'file', abs: path.resolve(path.dirname(fromAbs), spec.replace(/[?#].*$/, '')) };
  if (spec.startsWith('file:')) { try { return { kind: 'file', abs: fileURLToPath(spec) }; } catch { return { kind: 'scheme', name: spec }; } }
  if (BUILTIN.has(spec)) return { kind: 'builtin', name: normLib(spec) };
  if (/^[a-z][a-z0-9+.-]*:/i.test(spec)) return { kind: 'scheme', name: spec.split(':')[0] === 'cloudflare' ? spec : `${spec.split(':')[0]}:` };
  if (spec.startsWith('#')) return { kind: 'package', name: spec };
  const parts = spec.split('/');
  return { kind: 'package', name: spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0], sub: spec };
}

// ---------------------------------------------------------------------------------------------------------------
// 3. The evaluator: what an expression's value is, where the code alone settles it
//    Values: {t:'s',v} text · {t:'p',v} a file path · {t:'u',v} a file: address · {t:'x',v} a path of which only the
//    start v is known · {t:'m',alts} one of several · {t:'a',items} a list · {t:'o',node,env} an object written out ·
//    {t:'f',node,env} a function · {t:'lib',mod,path} a name of a built-in or a package · {t:'mod',file} a product
//    file's exports · {t:'req',file} a require function · {t:'g',name} a global name.
// ---------------------------------------------------------------------------------------------------------------
const S = (v) => ({ t: 's', v }); const P = (v) => ({ t: 'p', v }); const U = (v) => ({ t: 'u', v }); const X = (v, why) => ({ t: 'x', v, why });
const isPathy = (v) => !!v && (v.t === 'p' || v.t === 'u' || v.t === 'x' || (v.t === 'm' && v.alts.some(isPathy)));
const isAbs = (s) => s.startsWith('/') || s.startsWith('<');
const pjoin = (...parts) => path.posix.normalize(parts.join('/'));
const urlToPath = (href) => { try { return fileURLToPath(href); } catch { return null; } };
const MULTI_CAP = 400;
/** Applies fn to every combination of the alternatives of the values given. */
function lift(vals, fn) {
  if (!vals.some((v) => v && v.t === 'm')) return fn(vals);
  let combos = [[]];
  for (const v of vals) {
    const alts = v && v.t === 'm' ? v.alts : [v];
    const next = [];
    for (const c of combos) for (const a of alts) { next.push([...c, a]); if (next.length > MULTI_CAP) return null; }
    combos = next;
  }
  return multi(combos.map(fn));
}
function multi(vals) {
  const flat = [];
  for (const v of vals) { if (!v) return null; if (v.t === 'm') flat.push(...v.alts); else flat.push(v); }
  const seen = new Map();
  for (const v of flat) { if (!['s', 'p', 'u', 'x'].includes(v.t)) return null; const k = `${v.t}:${v.v}`; if (!seen.has(k)) seen.set(k, v); }
  const alts = [...seen.values()];
  if (alts.length === 0 || alts.length > MULTI_CAP) return null;
  return alts.length === 1 ? alts[0] : { t: 'm', alts };
}
const isText = (v) => !!v && (v.t === 's' || v.t === 'p' || v.t === 'u');
/** Text put together from parts, left to right. Once a path has begun, a part that is not known ends it as {t:'x'}:
 *  a path of which only the start is known. */
function concat(parts) {
  return lift(parts, (all) => {
    const ps = all.slice();
    while (ps.length > 1 && ps[0] && ps[0].t === 's' && ps[0].v === '') ps.shift();
    const first = ps[0];
    if (!first) return null;
    if (first.t === 'x') return X(first.v, 'text');
    if (!isText(first)) return null;
    let acc = first.v; const type = first.t;
    for (let i = 1; i < ps.length; i++) {
      const v = ps[i];
      if (isText(v)) { acc += v.v; continue; }
      if (type === 'p') return X(acc, 'text');
      if (type === 'u' || acc.startsWith('file://')) return /[?#]/.test(acc) ? { t: 'u', v: acc.replace(/[?#].*$/, ''), note: 'the part after "?" is not known' } : X(urlToPath(acc) ?? acc, 'text');
      if (/^\.\.?\//.test(acc) && /[?#]/.test(acc)) return { t: 's', v: acc.replace(/[?#].*$/, ''), note: 'the part after "?" is not known' };
      if (acc.startsWith('data:')) return S('data:');
      return null;
    }
    return { t: type === 's' && acc.startsWith('file://') ? 'u' : type, v: acc };
  });
}
/** path.join (resolve false) or path.resolve (resolve true) of values. */
function joinVals(vals, resolve) {
  return lift(vals, (vs) => {
    let start = 0;
    if (resolve) {
      start = -1;
      for (let i = vs.length - 1; i >= 0; i--) { const v = vs[i]; if (v && (v.t === 'p' || v.t === 'x' || (v.t === 's' && isAbs(v.v)))) { start = i; break; } }
      if (start < 0) return vs.length && vs.every((v) => v && v.t === 's') ? P(pjoin('<cwd>', ...vs.map((v) => v.v))) : null;
    }
    const first = vs[start];
    if (!first) return null;
    if (first.t === 'x') return X(first.v, 'join');
    if (first.t !== 'p' && first.t !== 's') return null;
    let acc = first.v; const typed = first.t === 'p' || isAbs(first.v);
    for (let i = start + 1; i < vs.length; i++) {
      const v = vs[i];
      if (v && (v.t === 's' || (v.t === 'p' && !resolve))) { acc = pjoin(acc, v.v); continue; }
      return typed ? X(`${acc.replace(/\/$/, '')}/`, 'join') : null;
    }
    return typed ? P(acc) : S(acc);
  });
}
function newUrl(a, b, hasB) {
  return lift([a, b], ([x, base]) => {
    if (x && x.t === 'u') return x;
    if (x && x.t === 's' && x.v.startsWith('file://')) return U(x.v);
    if (!hasB) return x && x.t === 'x' ? x : null;
    if (!base) return null;
    if (base.t === 'x') return X(base.v, 'url');
    if (base.t !== 'u') return null;
    if (!x) { const p = urlToPath(base.v); return p ? X(base.v.endsWith('/') ? p : `${path.posix.dirname(p)}/`, 'url') : null; }
    if (x.t === 'x') return X(x.v, 'url');
    if (x.t !== 's' && x.t !== 'p') return null;
    try { const u = new URL(x.v, base.v); return u.protocol === 'file:' ? U(u.href) : S(u.href); } catch { return null; }
  });
}
const toPath = (v) => lift([v], ([x]) => {
  if (!x) return null;
  if (x.t === 'u') { const p = urlToPath(x.v); return p ? P(p.length > 1 && x.v.endsWith('/') && !p.endsWith('/') ? `${p}/` : p) : null; }
  if (x.t === 's' && x.v.startsWith('file://')) { const p = urlToPath(x.v); return p ? P(p) : null; }
  if (x.t === 'x' || x.t === 'p') return x;
  return null;
});
const toUrl = (v) => lift([v], ([x]) => {
  if (!x) return null;
  if (x.t === 'p' && x.v.startsWith('/')) return U(pathToFileURL(x.v).href);
  if (x.t === 'x' || x.t === 'u' || x.t === 'p') return x;
  return null;
});

const fileOfNode = (node) => node.getSourceFile().fileName;
const isConstDecl = (decl) => (ts.getCombinedNodeFlags(decl) & ts.NodeFlags.Const) !== 0;
const skipOuter = (n) => { while (n && (ts.isParenthesizedExpression(n) || ts.isAwaitExpression(n) || ts.isNonNullExpression(n) || ts.isAsExpression(n) || ts.isSatisfiesExpression?.(n))) n = n.expression; return n; };
const LIST_METHODS = new Set(['map', 'forEach', 'filter', 'flatMap', 'some', 'every', 'find', 'findIndex']);

const evalCache = new Map();
const STATS_GLOBALS = new Map(); const STATS_GLOBAL_DECL = new Map();
/** The parameters a failed evaluation ran into (declaration nodes), kept for the reading that is under way. */
let paramDeps = null;
/** Where a parameter was looked for and not found, in a reading that carries arguments. */
const missEnv = new Map();
let steps = 0;
const STEP_CAP = 4000;
function ev(node, env = null, depth = 0) {
  if (!node || depth > 24 || ++steps > STEP_CAP) return null;
  if (!env) {
    if (evalCache.has(node)) { const c = evalCache.get(node); if (c && c.deps && paramDeps) for (const d of c.deps) paramDeps.add(d); return c ? c.val : null; }
    evalCache.set(node, null); // a name that leads back to itself is not known
    const saved = paramDeps; paramDeps = new Set();
    let val = null;
    try { val = ev0(node, null, depth); } catch (e) { if (!(e instanceof RangeError)) throw e; }
    const deps = paramDeps; paramDeps = saved;
    if (saved) for (const d of deps) saved.add(d);
    evalCache.set(node, { val, deps: deps.size ? deps : null });
    return val;
  }
  return ev0(node, env, depth);
}
function ev0(node, env, depth) {
  const d = depth + 1;
  switch (node.kind) {
    case ts.SyntaxKind.StringLiteral: case ts.SyntaxKind.NoSubstitutionTemplateLiteral: return S(node.text);
    case ts.SyntaxKind.NumericLiteral: return S(node.text);
    case ts.SyntaxKind.TemplateExpression: {
      const parts = [S(node.head.text)];
      for (const span of node.templateSpans) { parts.push(ev(span.expression, env, d)); parts.push(S(span.literal.text)); }
      return concat(parts);
    }
    case ts.SyntaxKind.BinaryExpression: {
      const op = node.operatorToken.kind;
      if (op === ts.SyntaxKind.PlusToken) return concat([ev(node.left, env, d), ev(node.right, env, d)]);
      if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
        const l = ev(node.left, env, d);
        if (l) return l;
        const r = ev(node.right, env, d);
        return r && ['s', 'p', 'u', 'x', 'm'].includes(r.t) ? { ...r, note: `the value after "${node.operatorToken.getText()}" is taken: ${node.left.getText().slice(0, 60)} is not known` } : r;
      }
      return null;
    }
    case ts.SyntaxKind.ConditionalExpression: {
      const a = ev(node.whenTrue, env, d); const b = ev(node.whenFalse, env, d);
      if (!a || !b) return null;
      return multi([a, b]);
    }
    case ts.SyntaxKind.ParenthesizedExpression: case ts.SyntaxKind.AwaitExpression: case ts.SyntaxKind.NonNullExpression:
    case ts.SyntaxKind.AsExpression: case ts.SyntaxKind.SatisfiesExpression:
      return ev(node.expression, env, d);
    case ts.SyntaxKind.Identifier: return evIdent(node, env, d);
    case ts.SyntaxKind.PropertyAccessExpression: return evProp(node, env, d);
    case ts.SyntaxKind.ElementAccessExpression: {
      const base = ev(node.expression, env, d); const arg = node.argumentExpression;
      if (!base || !arg) return null;
      if (base.t === 'g' && base.name === 'process.argv') return X('<argv>/', 'argv');
      if (base.t === 'a' && ts.isNumericLiteral(arg)) { const it = base.items[Number(arg.text)]; return it && !it.spread ? it : null; }
      if (ts.isStringLiteral(arg)) return member(base, arg.text, d);
      return null;
    }
    case ts.SyntaxKind.ArrayLiteralExpression:
      return { t: 'a', items: node.elements.map((e) => (ts.isSpreadElement(e) ? { spread: ev(e.expression, env, d) } : ev(e, env, d))) };
    case ts.SyntaxKind.ObjectLiteralExpression: return { t: 'o', node, env };
    case ts.SyntaxKind.ArrowFunction: case ts.SyntaxKind.FunctionExpression: return { t: 'f', node, env };
    case ts.SyntaxKind.CallExpression: return evCall(node, env, d);
    case ts.SyntaxKind.NewExpression: {
      const c = skipOuter(node.expression);
      const cv = ts.isIdentifier(c) || ts.isPropertyAccessExpression(c) ? ev(c, env, d) : null;
      const isUrl = cv && ((cv.t === 'g' && cv.name === 'URL') || (cv.t === 'lib' && cv.mod === 'url' && cv.path.join('.') === 'URL'));
      if (isUrl) { const a = node.arguments ?? []; return newUrl(ev(a[0], env, d), a[1] ? ev(a[1], env, d) : null, a.length > 1); }
      return null;
    }
    default: return null;
  }
}
/** A member of a value by name. */
function member(base, name, d) {
  if (!base) return null;
  if (base.t === 'm') return multi(base.alts.map((a) => member(a, name, d)));
  if (base.t === 'lib' && base.mod === 'process' && base.path.length === 0) return member({ t: 'g', name: 'process' }, name, d);
  if (base.t === 'lib') {
    if (base.mod === 'fs' && base.path.length === 0 && name === 'promises') return { t: 'lib', mod: 'fs/promises', path: [] };
    if (base.mod === 'path' && base.path.length === 0 && (name === 'posix' || name === 'win32')) return base;
    if (base.path.length === 0 && name === 'default') return base;
    if (base.mod === 'path' && name === 'sep') return S('/');
    return { t: 'lib', mod: base.mod, path: [...base.path, name] };
  }
  if (base.t === 'mod') return exportOf(base.file, name, d);
  if (base.t === 'o') return objProp(base, name, d);
  if (base.t === 'u') { if (name === 'pathname') return toPath(base); if (name === 'href') return base; return null; }
  if (base.t === 'x' && (name === 'pathname' || name === 'href')) return base;
  if (base.t === 'g' && base.name === 'process' && name === 'execPath') return { t: 's', v: 'node', exec: true };
  if (base.t === 'g' && base.name === 'process') return { t: 'g', name: `process.${name}` };
  if (base.t === 'g' && base.name === 'process.argv') return /^\d+$/.test(name) ? X('<argv>/', 'argv') : null;
  if (base.t === 'g' && base.name === 'process.env') return ['TMPDIR', 'TMP', 'TEMP', 'RUNNER_TEMP'].includes(name) ? P('<tmp>') : null;
  if (base.t === 'g' && base.name === 'import.meta') {
    return null;
  }
  return null;
}
function objProp(o, name, d) {
  const props = o.node.properties;
  for (let i = props.length - 1; i >= 0; i--) {
    const p = props[i];
    if (ts.isSpreadAssignment(p)) { const s = ev(p.expression, o.env, d); if (s && s.t === 'o') { const r = objProp(s, name, d); if (r) return r; continue; } return null; }
    const key = p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : null;
    if (key !== name) continue;
    if (ts.isPropertyAssignment(p)) return ev(p.initializer, o.env, d);
    if (ts.isShorthandPropertyAssignment(p)) { const sym = checker.getShorthandAssignmentValueSymbol(p); return sym ? evSymbol(sym, o.env, d) : null; }
    if (ts.isMethodDeclaration(p)) return { t: 'f', node: p, env: o.env };
    return null;
  }
  return null;
}
function evProp(node, env, d) {
  const name = node.name.text;
  if (node.expression.kind === ts.SyntaxKind.MetaProperty) {
    const file = fileOfNode(node);
    if (name === 'url') return U(pathToFileURL(file).href);
    if (name === 'dirname') return P(path.dirname(file));
    if (name === 'filename') return P(file);
    if (name === 'resolve') return { t: 'g', name: 'import.meta.resolve' };
    return null;
  }
  return member(ev(node.expression, env, d), name, d);
}
function evIdent(id, env, d) {
  if (id.text === 'undefined') return null;
  const parent = id.parent;
  const sym = parent && ts.isShorthandPropertyAssignment(parent) && parent.name === id ? checker.getShorthandAssignmentValueSymbol(parent) : checker.getSymbolAtLocation(id);
  // a name declared in another file reaches this one only as a global (a file's own names never leave it): not a binding here
  const foreign = !!sym && !!sym.declarations?.length && sym.declarations.every((x) => x.getSourceFile() !== id.getSourceFile());
  if (foreign) { STATS_GLOBALS.set(id.text, (STATS_GLOBALS.get(id.text) ?? 0) + 1); if (!STATS_GLOBAL_DECL.has(id.text)) STATS_GLOBAL_DECL.set(id.text, `${relOf(sym.declarations[0].getSourceFile().fileName)}:${lineOf(sym.declarations[0])}`); }
  if (!sym || !sym.declarations?.length || foreign) {
    const file = fileOfNode(id);
    if (id.text === '__dirname') return P(path.dirname(file));
    if (id.text === '__filename') return P(file);
    if (id.text === 'require') return { t: 'req', file };
    if (['URL', 'String', 'process', 'Worker', 'Function', 'eval', 'WebAssembly', 'fetch', 'Bun', 'Deno'].includes(id.text)) return { t: 'g', name: id.text };
    return null;
  }
  return evSymbol(sym, env, d);
}
function evSymbol(sym, env, d) {
  const decl = sym.valueDeclaration ?? sym.declarations?.[0];
  return decl ? evDecl(decl, env, d) : null;
}
function importOf(decl) {
  let n = decl; while (n && !ts.isImportDeclaration(n)) n = n.parent;
  return n && ts.isStringLiteralLike(n.moduleSpecifier) ? n.moduleSpecifier.text : null;
}
function moduleValue(fromAbs, spec) {
  const r = resolveSpec(fromAbs, spec);
  if (r.kind === 'file') return { t: 'mod', file: r.abs };
  if (r.kind === 'builtin' || r.kind === 'package') return { t: 'lib', mod: r.name, path: [] };
  return null;
}
function evDecl(decl, env, d) {
  switch (decl.kind) {
    case ts.SyntaxKind.VariableDeclaration: {
      if (!ts.isIdentifier(decl.name)) return null;
      const list = decl.parent;
      if (list && list.parent && (ts.isForOfStatement(list.parent)) && list.parent.initializer === list) {
        const arr = ev(list.parent.expression, env, d);
        if (arr && arr.t === 'g' && arr.name === 'process.argv') return X('<argv>/', 'argv');
        return arr && arr.t === 'a' && arr.items.every((i) => i && !i.spread) ? multi(arr.items) : null;
      }
      if (!isConstDecl(decl)) return evLet(decl, env, d);
      return decl.initializer ? ev(decl.initializer, env, d) : null;
    }
    case ts.SyntaxKind.BindingElement: {
      const pattern = decl.parent; const host = pattern.parent;
      if (decl.dotDotDotToken) return null;
      let base = null;
      if (ts.isVariableDeclaration(host) && host.initializer) base = ev(host.initializer, env, d);
      else if (ts.isParameter(host)) base = evParam(host, env, d);
      else if (ts.isBindingElement(host)) base = evDecl(host, env, d);
      if (!base) return null;
      if (ts.isObjectBindingPattern(pattern)) {
        const key = decl.propertyName ?? decl.name;
        return ts.isIdentifier(key) || ts.isStringLiteral(key) ? member(base, key.text, d) : null;
      }
      if (base.t === 'a') { const it = base.items[pattern.elements.indexOf(decl)]; return it && !it.spread ? it : null; }
      if (base.t === 'g' && base.name === 'process.argv') return X('<argv>/', 'argv');
      return null;
    }
    case ts.SyntaxKind.Parameter: return ts.isIdentifier(decl.name) ? evParam(decl, env, d) : null;
    case ts.SyntaxKind.ImportSpecifier: {
      const spec = importOf(decl); if (spec === null) return null;
      return member(moduleValue(fileOfNode(decl), spec), (decl.propertyName ?? decl.name).text, d);
    }
    case ts.SyntaxKind.ImportClause: {
      const spec = importOf(decl); if (spec === null) return null;
      return member(moduleValue(fileOfNode(decl), spec), 'default', d);
    }
    case ts.SyntaxKind.NamespaceImport: { const spec = importOf(decl); return spec === null ? null : moduleValue(fileOfNode(decl), spec); }
    case ts.SyntaxKind.FunctionDeclaration: return { t: 'f', node: decl, env: null };
    case ts.SyntaxKind.ExportSpecifier: {
      const ed = decl.parent.parent;
      if (ed.moduleSpecifier && ts.isStringLiteralLike(ed.moduleSpecifier)) return member(moduleValue(fileOfNode(decl), ed.moduleSpecifier.text), (decl.propertyName ?? decl.name).text, d);
      const target = checker.getExportSpecifierLocalTargetSymbol(decl);
      return target ? evSymbol(target, env, d) : null;
    }
    case ts.SyntaxKind.ExportAssignment: return ev(decl.expression, env, d);
    default: return null;
  }
}
const writesByFile = new Map();
/** The places a file writes a name after declaring it: name → [the value written, or null where it is not a plain "="]. */
function writesOf(sf) {
  let names = writesByFile.get(sf);
  if (names) return names;
  names = new Map();
  const add = (id, value) => { if (!names.has(id.text)) names.set(id.text, []); names.get(id.text).push({ id, value }); };
  const target = (n) => {
    if (ts.isIdentifier(n)) add(n, null);
    else if (ts.isArrayLiteralExpression(n)) n.elements.forEach(target);
    else if (ts.isObjectLiteralExpression(n)) n.properties.forEach((q) => { if (ts.isShorthandPropertyAssignment(q)) add(q.name, null); else if (ts.isPropertyAssignment(q)) target(q.initializer); else if (ts.isSpreadAssignment(q)) target(q.expression); });
    else if (ts.isSpreadElement(n) || ts.isParenthesizedExpression(n)) target(n.expression);
  };
  const stack = [sf];
  while (stack.length) {
    const n = stack.pop();
    if (ts.isBinaryExpression(n) && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
      if (ts.isIdentifier(n.left)) add(n.left, n.operatorToken.kind === ts.SyntaxKind.EqualsToken ? n.right : null); else target(n.left);
    } else if ((ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) && (n.operator === ts.SyntaxKind.PlusPlusToken || n.operator === ts.SyntaxKind.MinusMinusToken)) target(n.operand);
    else if ((ts.isForInStatement(n) || ts.isForOfStatement(n)) && !ts.isVariableDeclarationList(n.initializer)) target(n.initializer);
    ts.forEachChild(n, (c) => { stack.push(c); });
  }
  writesByFile.set(sf, names);
  return names;
}
/** A `let` or `var`: what it is given where it is declared and at each later "=", when there are few and all are known. */
function evLet(decl, env, d) {
  const sym = checker.getSymbolAtLocation(decl.name);
  const writes = (writesOf(decl.getSourceFile()).get(decl.name.text) ?? []).filter((w) => checker.getSymbolAtLocation(w.id) === sym);
  if (writes.length > 4 || writes.some((w) => !w.value)) return null;
  const vals = [];
  if (decl.initializer && decl.initializer.kind !== ts.SyntaxKind.NullKeyword && !(ts.isIdentifier(decl.initializer) && decl.initializer.text === 'undefined')) vals.push(ev(decl.initializer, env, d));
  for (const w of writes) vals.push(ev(w.value, env, d));
  if (!vals.length || vals.some((v) => !v)) return null;
  return vals.length === 1 ? vals[0] : multi(vals);
}
function evParam(decl, env, d) {
  if (env && env.has(decl)) {
    const thunk = env.get(decl);
    if (thunk.val !== undefined) return thunk.val;
    if (thunk.node) return ev(thunk.node, thunk.env, d);
    return decl.initializer ? ev(decl.initializer, env, d) : null;
  }
  // the first parameter of a function given to map, forEach and their kin: one of the list's items
  const fn = decl.parent;
  if (fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && fn.parameters[0] === decl && fn.parent && ts.isCallExpression(fn.parent) && fn.parent.arguments[0] === fn) {
    const callee = fn.parent.expression;
    if (ts.isPropertyAccessExpression(callee) && LIST_METHODS.has(callee.name.text)) {
      const arr = ev(callee.expression, env, d);
      if (arr && arr.t === 'a' && arr.items.length && arr.items.every((i) => i && !i.spread)) return multi(arr.items);
    }
  }
  if (paramDeps) paramDeps.add(decl);
  if (env) missEnv.set(decl, env);
  return null;
}
/** A name a product file exports. */
function exportOf(file, name, d) {
  const sf = program.getSourceFile(file);
  if (!sf || !sf.symbol || d > 24) return null;
  const exp = sf.symbol.exports?.get(name);
  if (exp) return evSymbol(exp, null, d + 1);
  const star = sf.symbol.exports?.get('__export');
  for (const decl of star?.declarations ?? []) {
    if (!ts.isExportDeclaration(decl) || !decl.moduleSpecifier || !ts.isStringLiteralLike(decl.moduleSpecifier)) continue;
    const r = member(moduleValue(file, decl.moduleSpecifier.text), name, d + 1);
    if (r) return r;
  }
  return null;
}
function bindParams(fnNode, args, callerEnv, outerEnv) {
  const env = new Map(outerEnv ?? []);
  fnNode.parameters.forEach((p, i) => { if (!p.dotDotDotToken) env.set(p, { node: args[i] ?? null, env: callerEnv }); });
  return env;
}
function returnOf(fnNode) {
  if (!fnNode.body) return null;
  if (!ts.isBlock(fnNode.body)) return fnNode.body;
  const returns = [];
  const stack = [...fnNode.body.statements];
  while (stack.length) {
    const n = stack.pop();
    if (ts.isFunctionLike(n)) continue;
    if (ts.isReturnStatement(n)) { returns.push(n); continue; }
    ts.forEachChild(n, (c) => { stack.push(c); });
  }
  return returns.length === 1 ? returns[0].expression ?? null : null;
}
function evCall(node, env, d) {
  const calleeNode = skipOuter(node.expression);
  if (calleeNode.kind === ts.SyntaxKind.ImportKeyword) {
    const a = ev(node.arguments[0], env, d);
    if (a && a.t === 's') return moduleValue(fileOfNode(node), a.v);
    if (a && a.t === 'u') { const p = urlToPath(a.v); return p ? { t: 'mod', file: p } : null; }
    return null;
  }
  // process.argv.slice(n) is still the command line
  if (ts.isPropertyAccessExpression(calleeNode) && calleeNode.name.text === 'slice') { const b = ev(calleeNode.expression, env, d); if (b && b.t === 'g' && b.name === 'process.argv') return b; }
  // text methods that leave a path a path
  if (ts.isPropertyAccessExpression(calleeNode) && ['toString', 'valueOf'].includes(calleeNode.name.text) && node.arguments.length === 0) {
    const b = ev(calleeNode.expression, env, d);
    if (b && ['s', 'p', 'u', 'x', 'm'].includes(b.t)) return b;
  }
  const cv = ev(calleeNode, env, d);
  if (!cv) return null;
  const args = node.arguments;
  if (cv.t === 'g') {
    if (cv.name === 'String') return ev(args[0], env, d);
    if (cv.name === 'process.cwd') return P('<cwd>');
    if (cv.name === 'import.meta.resolve') { const a = ev(args[0], env, d); if (a && a.t === 's') { const r = resolveSpec(fileOfNode(node), a.v); return r.kind === 'file' ? U(pathToFileURL(r.abs).href) : null; } return null; }
    return null;
  }
  if (cv.t === 'req') { const a = ev(args[0], env, d); return a && a.t === 's' ? moduleValue(cv.file, a.v) : null; }
  if (cv.t === 'lib') return LIB_VALUES.has(cv.mod) ? libCall(cv, args.map((a) => (ts.isSpreadElement(a) ? null : ev(a, env, d))), node) : null;
  if (cv.t === 'f') {
    const ret = returnOf(cv.node);
    if (!ret) return null;
    if (!cv.env) {
      // what the function gives back with no argument known: if that does not wait on a parameter, the arguments change nothing
      const saved = paramDeps; paramDeps = new Set();
      const plain = ev(ret, null, d);
      const waits = paramDeps.size > 0; paramDeps = saved;
      if (!waits) return plain;
    }
    return ev(ret, bindParams(cv.node, args, env, cv.env), d);
  }
  return null;
}
const LIB_VALUES = new Set(['path', 'url', 'os', 'fs', 'fs/promises', 'module', 'util']);
function libCall(cv, vals, node) {
  const fn = cv.path.join('.');
  if (cv.mod === 'util' && fn === 'promisify') return vals[0] && (vals[0].t === 'lib' || vals[0].t === 'f') ? vals[0] : null;
  if (cv.mod === 'path') {
    if (fn === 'join') return joinVals(vals, false);
    if (fn === 'resolve') return joinVals(vals, true);
    if (fn === 'normalize' || fn === 'toNamespacedPath') return vals[0] && ['p', 'x', 'm'].includes(vals[0].t) ? vals[0] : null;
    if (fn === 'dirname') return lift([vals[0]], ([v]) => (!v ? null : v.t === 'p' ? P(path.posix.dirname(v.v)) : v.t === 'x' ? X(v.v, 'dirname') : v.t === 's' ? S(path.posix.dirname(v.v)) : null));
    if (fn === 'basename') return lift([vals[0]], ([v]) => (v && (v.t === 'p' || v.t === 's') ? S(path.posix.basename(v.v)) : null));
    return null;
  }
  if (cv.mod === 'url') {
    if (fn === 'fileURLToPath') return toPath(vals[0]);
    if (fn === 'pathToFileURL') return toUrl(vals[0]);
    return null;
  }
  if (cv.mod === 'os') { if (fn === 'tmpdir') return P('<tmp>'); if (fn === 'homedir') return P('<home>'); return null; }
  if (cv.mod === 'fs' || cv.mod === 'fs/promises') {
    // a folder made new at run time: inside the folder its argument names when that is known, else in a temporary place
    if (fn === 'mkdtempSync' || fn === 'mkdtemp') { const v = vals[0]; return v && (v.t === 'p' || v.t === 'x') ? X(v.v, 'mkdtemp') : X('<tmp>/', 'mkdtemp'); }
    if (fn === 'realpathSync' || fn === 'realpath' || fn === 'realpathSync.native') return vals[0] && ['p', 'x', 'm'].includes(vals[0].t) ? vals[0] : null;
    return null;
  }
  if (cv.mod === 'module' && fn === 'createRequire') { const v = vals[0]; const p = v && v.t === 'u' ? urlToPath(v.v) : v && v.t === 'p' ? v.v : null; return { t: 'req', file: p ?? fileOfNode(node) }; }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// 4. Points of use: the calls that load, read, list or start a file
// ---------------------------------------------------------------------------------------------------------------
const FS_KIND = new Map();
for (const n of ['readFileSync', 'readFile', 'createReadStream', 'openAsBlob', 'readlinkSync', 'readlink', 'openSync', 'open']) FS_KIND.set(n, ['fs-read']);
for (const n of ['readdirSync', 'readdir', 'opendirSync', 'opendir', 'globSync', 'glob', 'watch', 'watchFile']) FS_KIND.set(n, ['fs-list']);
for (const n of ['statSync', 'stat', 'lstatSync', 'lstat', 'existsSync', 'exists', 'accessSync', 'access', 'realpathSync', 'realpath', 'statfsSync', 'statfs']) FS_KIND.set(n, ['fs-stat']);
for (const n of ['writeFileSync', 'writeFile', 'appendFileSync', 'appendFile', 'mkdirSync', 'mkdir', 'rmSync', 'rm', 'rmdirSync', 'rmdir', 'unlinkSync', 'unlink', 'createWriteStream',
  'chmodSync', 'chmod', 'chownSync', 'chown', 'utimesSync', 'utimes', 'truncateSync', 'truncate', 'mkdtempSync', 'mkdtemp']) FS_KIND.set(n, ['fs-write']);
for (const n of ['copyFileSync', 'copyFile', 'cpSync', 'cp', 'symlinkSync', 'symlink', 'linkSync', 'link']) FS_KIND.set(n, ['fs-read', 'fs-write']);
for (const n of ['renameSync', 'rename']) FS_KIND.set(n, ['fs-write', 'fs-write']);
/** Names that are read as a file-system call even where the parser cannot tell what the name is bound to. */
const FS_BY_NAME = new Set(['readFileSync', 'readdirSync', 'statSync', 'lstatSync', 'existsSync', 'writeFileSync', 'mkdirSync', 'rmSync', 'createReadStream', 'createWriteStream',
  'copyFileSync', 'cpSync', 'renameSync', 'unlinkSync', 'appendFileSync', 'mkdtempSync', 'accessSync', 'realpathSync', 'opendirSync']);
const PROC_FNS = new Set(['spawn', 'spawnSync', 'execFile', 'execFileSync', 'exec', 'execSync', 'fork']);
const PROC_BY_NAME = new Set(['spawnSync', 'execFileSync', 'execSync']);
/** Names Node's file system and process modules share with ordinary methods: a call by such a name that the parser
 *  cannot tie to Node is listed apart (UNBOUND), by what it is called on, and is not counted as a reference. */
const GENERIC_NAMES = new Set(['readFile', 'readdir', 'writeFile', 'appendFile', 'stat', 'lstat', 'access', 'mkdir', 'rm', 'unlink', 'rename', 'copyFile', 'cp', 'opendir', 'open',
  'spawn', 'execFile', 'fork']);
const UNBOUND = [];

const sinkCache = new Map();
/** What kind of point of use a call or a `new` is, or null. */
function sinkOf(node) {
  if (sinkCache.has(node)) return sinkCache.get(node);
  const r = sinkOf0(node);
  sinkCache.set(node, r);
  return r;
}
function sinkOf0(node) {
  const callee = skipOuter(node.expression);
  if (ts.isCallExpression(node) && callee.kind === ts.SyntaxKind.ImportKeyword) return { type: 'import' };
  if (!ts.isIdentifier(callee) && !ts.isPropertyAccessExpression(callee)) return null;
  steps = 0;
  const cv = ev(callee);
  const name = ts.isIdentifier(callee) ? callee.text : callee.name.text;
  if (ts.isCallExpression(node)) {
    if (cv && cv.t === 'req') return { type: 'require' };
    if (cv && cv.t === 'g' && cv.name === 'import.meta.resolve') return { type: 'resolve' };
    if (cv && cv.t === 'g' && cv.name === 'process.chdir') return { type: 'fs', fn: 'chdir', kinds: ['chdir'] };
    if (ts.isPropertyAccessExpression(callee) && name === 'resolve') { const b = ev(callee.expression); if (b && b.t === 'req') return { type: 'require', resolveOnly: true, file: b.file }; }
    if (cv && cv.t === 'lib') {
      const fn = cv.path.join('.');
      if ((cv.mod === 'fs' || cv.mod === 'fs/promises') && FS_KIND.has(fn)) return { type: 'fs', fn, kinds: FS_KIND.get(fn) };
      if (cv.mod === 'child_process' && PROC_FNS.has(fn)) return { type: 'proc', fn };
      if (cv.mod === 'esbuild' && ['build', 'buildSync', 'context'].includes(fn)) return { type: 'esbuild', fn };
      if (cv.mod === 'module' && fn === 'register') return { type: 'register' };
      if (cv.mod === 'module' && fn === 'registerHooks') return { type: 'hooks' };
      if (cv.mod === 'process' && fn === 'chdir') return { type: 'fs', fn: 'chdir', kinds: ['chdir'] };
      return null;
    }
    if (cv && cv.t === 'f') { if (!CALLS.has(cv.node)) CALLS.set(cv.node, []); CALLS.get(cv.node).push(node); return null; }
    if (!cv) {
      if (FS_BY_NAME.has(name)) return { type: 'fs', fn: name, kinds: FS_KIND.get(name), byName: true };
      if (PROC_BY_NAME.has(name)) return { type: 'proc', fn: name, byName: true };
      if (GENERIC_NAMES.has(name)) UNBOUND.push({ f: relOf(fileOfNode(node)), l: lineOf(node), name, on: ts.isPropertyAccessExpression(callee) ? textOf(callee.expression, 50) : '(a bare name)' });
    }
    return null;
  }
  // new X(...)
  if (cv && cv.t === 'lib') {
    const fn = cv.path.join('.');
    if (cv.mod === 'worker_threads' && fn === 'Worker') return { type: 'worker' };
    if (cv.mod === 'miniflare' && fn === 'Miniflare') return { type: 'miniflare' };
    if (cv.mod === 'sqlite' && fn === 'DatabaseSync') return { type: 'sqlite' };
    return null;
  }
  if (cv && cv.t === 'g' && cv.name === 'Worker') return { type: 'worker', global: true };
  if (!cv && name === 'Miniflare') return { type: 'miniflare', byName: true };
  if (!cv && name === 'DatabaseSync') return { type: 'sqlite', byName: true };
  return null;
}

const CALLS = new Map();
const consumed = new Set();
let lastDeps = null;
/** A value, and in lastDeps the parameters its reading ran into. */
function evd(node, env) {
  if (!node) { lastDeps = new Set(); return null; }
  const saved = paramDeps; paramDeps = new Set(); steps = 0;
  let val = null;
  try { val = ev(node, env); } catch (e) { if (!(e instanceof RangeError)) throw e; }
  lastDeps = paramDeps; paramDeps = saved;
  return val;
}
const CODE_EXT = /\.(mjs|cjs|js|ts|json|jsonc|py|sh|html|txt|md|toml|wasm|sql|pdf|png|csv|yml|yaml)$/i;
/** Runs a point of use: give(spec, val, deps) is called once for each argument that names a file. */
function runSink(desc, node, env, give) {
  const args = node.arguments ?? [];
  const use = (n) => { if (n) consumed.add(skipOuter(n)); return n; };
  const one = (k, n, extra = {}) => { use(n); const val = evd(n, env); give({ k, node: n, ...extra }, val, lastDeps); };
  switch (desc.type) {
    case 'import': one('dynamic-import', args[0], { asSpec: true }); return;
    case 'require': one(desc.resolveOnly ? 'require-resolve' : 'require', args[0], { asSpec: true }); return;
    case 'resolve': one('resolve', args[0], { asSpec: true }); return;
    case 'register': one('loader', args[0], { asSpec: true }); return;
    case 'hooks': give({ k: 'loader-hooks', node, note: 'module.registerHooks: the hooks decide what each import loads' }, null, new Set()); return;
    case 'fs': desc.kinds.forEach((k, i) => { if (args[i]) one(k, args[i], { fn: desc.fn, byName: desc.byName, asCwd: true }); }); return;
    case 'sqlite': if (args[0]) { const v = evd(use(args[0]), env); if (!(v && v.t === 's' && (v.v === ':memory:' || v.v === ''))) give({ k: 'sqlite-open', node: args[0], asCwd: true, byName: desc.byName }, v, lastDeps); } return;
    case 'worker': one('worker', args[0], { asCwd: true, global: desc.global }); return;
    case 'proc': runProc(desc, node, env, give, use); return;
    case 'miniflare': {
      use(args[0]);
      const alts = args[0] ? objAlts(args[0], env) : { objs: [], unknown: true };
      if (alts.unknown) give({ k: 'worker', node: args[0] ?? node, note: 'Miniflare options the parser cannot read', byName: desc.byName }, null, lastDeps);
      for (const o of alts.objs) miniflareOptions(o, give, use, 0);
      return;
    }
    case 'esbuild': {
      const o = evd(use(args[0]), env);
      if (!o || o.t !== 'o') { give({ k: 'bundle', node: args[0] ?? node, note: 'esbuild options the parser cannot read' }, null, lastDeps); return; }
      const wd = objProp(o, 'absWorkingDir', 0);
      const ep = propNode(o, 'entryPoints');
      if (ep) {
        const v = evd(ep.node, ep.env);
        if (v && v.t === 'a') v.items.forEach((it) => give({ k: 'bundle', node: ep.node, asCwd: true, cwdBase: wd }, it && !it.spread ? it : null, lastDeps));
        else give({ k: 'bundle', node: ep.node, asCwd: true, cwdBase: wd }, v && v.t !== 'o' ? v : null, lastDeps);
      }
      for (const key of ['outfile', 'outdir']) { const p = propNode(o, key); if (p) give({ k: 'fs-write', node: p.node, asCwd: true, cwdBase: wd, fn: `esbuild ${key}` }, evd(p.node, p.env), lastDeps); }
      return;
    }
    default:
  }
}
/** The node that gives an object's property its value, with the scope to read it in: { node, env } or null. */
function propNode(o, name) {
  const props = o.node.properties;
  for (let i = props.length - 1; i >= 0; i--) {
    const p = props[i];
    if (ts.isSpreadAssignment(p)) { const s = ev(p.expression, o.env); if (s && s.t === 'o') { const r = propNode(s, name); if (r) return r; } continue; }
    const key = p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : null;
    if (key !== name) continue;
    if (ts.isPropertyAssignment(p)) return { node: p.initializer, env: o.env };
    if (ts.isShorthandPropertyAssignment(p)) return { node: p.name, env: o.env };
    return null;
  }
  return null;
}
/** The objects an expression may be: both sides of a condition, the right of "&&". → { objs, unknown }. */
function objAlts(node, env, depth = 0) {
  const n = skipOuter(node);
  if (depth > 6 || !n) return { objs: [], unknown: true };
  if (ts.isConditionalExpression(n)) { const a = objAlts(n.whenTrue, env, depth + 1); const b = objAlts(n.whenFalse, env, depth + 1); return { objs: [...a.objs, ...b.objs], unknown: a.unknown || b.unknown }; }
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return objAlts(n.right, env, depth + 1);
  if (ts.isBinaryExpression(n) && (n.operatorToken.kind === ts.SyntaxKind.BarBarToken || n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) {
    const a = objAlts(n.left, env, depth + 1); const b = objAlts(n.right, env, depth + 1); return { objs: [...a.objs, ...b.objs], unknown: a.unknown && b.unknown };
  }
  if (n.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(n) && n.text === 'undefined')) return { objs: [], unknown: false };
  const v = evd(n, env);
  if (v && v.t === 'o') {
    const inner = skipOuter(v.node);
    return { objs: [v], unknown: false, inner };
  }
  return { objs: [], unknown: true };
}
const MF_PERSIST = new Set(['d1Persist', 'kvPersist', 'r2Persist', 'durableObjectsPersist', 'cachePersist', 'defaultPersistRoot', 'workflowsPersist', 'analyticsEngineDatasetsPersist']);
function miniflareOptions(o, give, use, depth) {
  if (depth > 4) return;
  let sawScript = false;
  const walkObj = (obj) => {
    for (const p of obj.node.properties) {
      if (ts.isSpreadAssignment(p)) {
        const alts = objAlts(p.expression, obj.env);
        for (const s of alts.objs) walkObj(s);
        if (alts.unknown) give({ k: 'worker', node: p.expression, note: 'a spread inside Miniflare options that the parser cannot read' }, null, lastDeps);
        continue;
      }
      const key = p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : null;
      if (!key) continue;
      const valNode = ts.isPropertyAssignment(p) ? p.initializer : ts.isShorthandPropertyAssignment(p) ? p.name : null;
      if (!valNode) continue;
      if (key === 'scriptPath') { sawScript = true; use(valNode); give({ k: 'worker', node: valNode, asCwd: true }, evd(valNode, obj.env), lastDeps); }
      else if (key === 'modulesRoot' || key === 'rootPath') { use(valNode); give({ k: 'worker-root', node: valNode, asCwd: true }, evd(valNode, obj.env), lastDeps); }
      else if (MF_PERSIST.has(key)) { const v = evd(valNode, obj.env); if (v && ['p', 'u', 'x', 'm', 's'].includes(v.t)) { use(valNode); give({ k: 'fs-write', node: valNode, asCwd: true, fn: `Miniflare ${key}` }, v, lastDeps); } }
      else if (key === 'modules') {
        if (valNode.kind === ts.SyntaxKind.TrueKeyword || valNode.kind === ts.SyntaxKind.FalseKeyword) continue;
        const v = evd(valNode, obj.env);
        if (v && v.t === 'a') {
          sawScript = true;
          for (const it of v.items) {
            if (it && it.t === 'o') {
              const pn = propNode(it, 'path'); const hasText = !!propNode(it, 'contents');
              if (pn) give({ k: 'worker-module', node: pn.node, asCwd: true, note: hasText ? 'the module\'s text is given beside this name' : undefined }, evd(pn.node, pn.env), lastDeps);
            } else give({ k: 'worker-module', node: valNode, note: 'an entry of Miniflare `modules` the parser cannot read' }, null, lastDeps);
          }
        } else give({ k: 'worker-module', node: valNode, note: 'Miniflare `modules` the parser cannot read' }, null, lastDeps);
      } else if (key === 'workers') {
        const v = evd(valNode, obj.env);
        if (v && v.t === 'a') for (const it of v.items) { if (it && it.t === 'o') miniflareOptions(it, give, use, depth + 1); else give({ k: 'worker', node: valNode, note: 'an entry of Miniflare `workers` the parser cannot read' }, null, lastDeps); }
        else give({ k: 'worker', node: valNode, note: 'Miniflare `workers` the parser cannot read' }, null, lastDeps);
      } else if (key === 'script') sawScript = true;
    }
  };
  walkObj(o);
  return sawScript;
}
function runProc(desc, node, env, give, use) {
  const a = node.arguments ?? [];
  let optsVal = null;
  for (let i = 1; i < a.length; i++) { const v = evd(a[i], env); if (v && v.t === 'o') { optsVal = v; break; } }
  const cwdP = optsVal ? propNode(optsVal, 'cwd') : null;
  const cwdVal = cwdP ? evd(cwdP.node, cwdP.env) : null;
  const cwdDeps = lastDeps;
  const extra = { fn: desc.fn, byName: desc.byName, cwdBase: cwdVal && cwdVal.t === 'p' ? cwdVal : null, word: true };
  const tokens = [];
  const cmd = evd(use(a[0]), env); const cmdDeps = lastDeps;
  const shell = desc.fn === 'exec' || desc.fn === 'execSync';
  if (shell && cmd && cmd.t === 's') for (const w of cmd.v.split(/\s+/).filter(Boolean)) tokens.push({ node: a[0], val: S(w), deps: cmdDeps });
  else tokens.push({ node: a[0], val: cmd, deps: cmdDeps, isCmd: true });
  if (!shell && a[1]) {
    const lit = skipOuter(a[1]);
    const av = evd(use(a[1]), env); const avDeps = lastDeps;
    if (av && av.t === 'a') {
      av.items.forEach((it, i) => {
        const el = ts.isArrayLiteralExpression(lit) ? lit.elements[i] : a[1];
        if (it && it.spread) { if (it.spread && it.spread.t === 'a') it.spread.items.forEach((x) => tokens.push({ node: el, val: x && !x.spread ? x : null, deps: avDeps })); else tokens.push({ node: el, val: null, deps: avDeps }); }
        else tokens.push({ node: el, val: it, deps: avDeps });
      });
    } else if (!(av && av.t === 'o')) tokens.push({ node: a[1], val: null, deps: avDeps, isArgs: true });
  }
  for (const t of tokens) {
    const v = t.val;
    if (v && v.t === 's') {
      if (v.exec) continue;
      const words = v.v.includes('=') && v.v.startsWith('-') ? [v.v.slice(v.v.indexOf('=') + 1)] : [v.v];
      for (const w of words) if (w.includes('/') || CODE_EXT.test(w)) give({ k: 'proc', node: t.node, asCwd: true, ...extra, onlyIfExists: true }, S(w), t.deps);
      continue;
    }
    give({ k: 'proc', node: t.node, asCwd: true, ...extra, note: !v ? (t.isCmd ? 'the command' : t.isArgs ? 'the arguments' : 'an argument') : undefined }, v, t.deps);
  }
  if (cwdVal && ['p', 'u', 'x', 'm'].includes(cwdVal.t)) give({ k: 'proc-cwd', node: cwdP.node, fn: desc.fn }, cwdVal, cwdDeps);
}

// ---------------------------------------------------------------------------------------------------------------
// 5. The reading of every file
// ---------------------------------------------------------------------------------------------------------------
const REFS = [];
const PARTIALS = [];
const PENDING = [];
const STATS = { anchors: 0, parseErrors: [], stackErrors: [] };
const lineOf = (node) => { const sf = node.getSourceFile(); return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1; };
const textOf = (node, n = 160) => { const t = node.getText().replace(/\s+/g, ' '); return t.length > n ? `${t.slice(0, n)}…` : t; };
function fnNameOf(node) {
  let n = node.parent;
  while (n && !ts.isFunctionLike(n)) n = n.parent;
  if (!n) return null;
  if (n.name && ts.isIdentifier(n.name)) return n.name.text;
  const p = n.parent;
  if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
  if (p && ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) return p.name.text;
  return '(a function without a name)';
}
const pkgDirCache = new Map();
function pkgDirOf(rel) {
  let d = path.posix.dirname(rel);
  const start = d;
  if (pkgDirCache.has(start)) return pkgDirCache.get(start);
  let found = null;
  while (d !== '.') { if (FILE_SET.has(`${d}/package.json`)) { found = d; break; } d = path.posix.dirname(d); }
  pkgDirCache.set(start, found);
  return found;
}
const REAL = new Set(['file', 'dir', 'untracked', 'node_modules']);
/** Where a path leads, for a reference from the file `fromRel`. */
function targetOf(abs, fromRel, cwdBase) {
  let c = classify(abs);
  if (c.kind !== 'cwd') return c;
  if (cwdBase) return { ...classify(pjoin(cwdBase, c.rest)), cwd: relOf(cwdBase) || '.' };
  const top = classify(path.join(ROOT, c.rest));
  if (REAL.has(top.kind)) return { ...top, cwd: '.' };
  const pkg = pkgDirOf(fromRel);
  if (pkg) { const inPkg = classify(path.join(ROOT, pkg, c.rest)); if (REAL.has(inPkg.kind)) return { ...inPkg, cwd: pkg }; }
  return { kind: 'cwd-missing', rel: c.rest };
}
/** Writes the references one value gives. → true if every one is known. */
function record(base, spec, val, out) {
  const b = { ...base, k: spec.k };
  if (spec.fn) b.fn = spec.fn;
  if (spec.byName) b.byName = 1;
  if (spec.note) b.note = spec.note;
  if (val && val.note) b.note = b.note ? `${b.note}; ${val.note}` : val.note;
  if (!val || !['s', 'p', 'u', 'x', 'm'].includes(val.t)) { if (spec.onlyIfExists) return true; out.push({ ...b, c: 1 }); return false; }
  if (val.t === 'm') { let ok = true; for (const alt of val.alts) ok = record({ ...base, multi: val.alts.length }, spec, alt, out) && ok; return ok; }
  if (val.t === 'x') { out.push({ ...b, c: 'x', px: val.v }); return false; }
  let abs = null;
  if (val.t === 'u') abs = urlToPath(val.v);
  else if (val.t === 'p') abs = val.v;
  else if (spec.asSpec) {
    const r = resolveSpec(absOf(base.f), val.v);
    if (r.kind !== 'file') { out.push({ ...b, tk: r.kind, to: r.name }); return true; }
    abs = r.abs;
  } else if (spec.asCwd) abs = val.v.startsWith('file://') ? urlToPath(val.v) : isAbs(val.v) ? val.v : pjoin(spec.cwdBase ? spec.cwdBase.v : '<cwd>', val.v);
  else return true;
  if (!abs) { out.push({ ...b, c: 1 }); return false; }
  const t = targetOf(abs, base.f, spec.cwdBase && spec.cwdBase.v.startsWith('/') && val.t === 's' ? null : null);
  if (spec.onlyIfExists && !REAL.has(t.kind)) return true;
  const r = { ...b, tk: t.kind };
  if (t.rel !== undefined) r.to = t.rel; else if (t.where) r.to = t.where;
  if (t.cwd) r.cwd = t.cwd;
  if (t.owner) r.own = t.owner.m;
  out.push(r);
  return true;
}
function isAnchor(ref) {
  if (ref.tk !== 'dir' && ref.tk !== 'file') return false;
  if (ref.to === ref.f) return true;
  return ref.tk === 'dir' && (ref.to === '.' || ref.f.startsWith(ref.to));
}

function readFile(rel) {
  const sf = program.getSourceFile(absOf(rel));
  if (!sf) return;
  const base0 = { f: rel };
  const stack = [sf];
  while (stack.length) {
    const node = stack.pop();
    try { visit(node, base0, sf); } catch (e) { if (e instanceof RangeError) { STATS.stackErrors.push(`${rel}:${lineOf(node)}`); continue; } throw e; }
    if (node.jsDoc) for (const j of node.jsDoc) stack.push(j);
    ts.forEachChild(node, (c) => { stack.push(c); });
  }
}
function staticSpec(node, k, sf, rel) {
  const spec = node.moduleSpecifier;
  if (!spec || !ts.isStringLiteralLike(spec)) return;
  record({ f: rel, l: lineOf(node), s: spec.text }, { k, asSpec: true }, S(spec.text), REFS);
}
function visit(node, base0, sf) {
  const rel = base0.f;
  switch (node.kind) {
    case ts.SyntaxKind.ImportDeclaration: staticSpec(node, 'import', sf, rel); return;
    case ts.SyntaxKind.ExportDeclaration: staticSpec(node, 'export-from', sf, rel); return;
    case ts.SyntaxKind.ImportType: {
      const a = node.argument;
      if (a && ts.isLiteralTypeNode(a) && ts.isStringLiteralLike(a.literal)) record({ f: rel, l: lineOf(node), s: a.literal.text }, { k: 'jsdoc-import', asSpec: true }, S(a.literal.text), REFS);
      return;
    }
    case ts.SyntaxKind.JSDocImportTag: staticSpec(node, 'jsdoc-import', sf, rel); return;
    case ts.SyntaxKind.CallExpression: case ts.SyntaxKind.NewExpression: {
      const desc = sinkOf(node);
      if (desc) {
        const got = []; let waits = null;
        runSink(desc, node, null, (spec, val, deps) => {
          const n = spec.node ?? node;
          const ok = record({ f: rel, l: lineOf(n), s: textOf(n), in: fnNameOf(node) ?? undefined }, spec, val, got);
          if (!ok && deps && deps.size) { waits ??= new Set(); for (const d of deps) waits.add(d); }
        });
        for (const r of got) { if (r.c && waits) r.params = [...waits].map((d) => (ts.isIdentifier(d.name) ? d.name.text : '{…}')); if (r.byName) r.callee = textOf(node.expression, 60); REFS.push(r); }
        if (waits) PENDING.push({ node, desc, deps: waits, rel, refs: got.filter((r) => r.c) });
        return;
      }
      pathExpr(node, rel);
      return;
    }
    case ts.SyntaxKind.TemplateExpression: pathExpr(node, rel); embeddedPaths(node, rel); return;
    case ts.SyntaxKind.PropertyAccessExpression: pathExpr(node, rel); return;
    case ts.SyntaxKind.BinaryExpression: if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) pathExpr(node, rel); return;
    case ts.SyntaxKind.StringLiteral: case ts.SyntaxKind.NoSubstitutionTemplateLiteral: pathText(node, rel); return;
    default:
  }
}
const PATH_KINDS = new Set([ts.SyntaxKind.CallExpression, ts.SyntaxKind.NewExpression, ts.SyntaxKind.TemplateExpression, ts.SyntaxKind.PropertyAccessExpression, ts.SyntaxKind.BinaryExpression]);
/** A path the code builds and holds, where no point of use reads it directly: the outermost expression that is one. */
function pathExpr(node, rel) {
  if (consumed.has(node)) return;
  if (node.kind === ts.SyntaxKind.PropertyAccessExpression && !['pathname', 'href'].includes(node.name.text)) return;
  steps = 0;
  const v = ev(node);
  if (!isPathy(v)) return;
  let p = node.parent;
  while (p && (ts.isParenthesizedExpression(p) || ts.isAwaitExpression(p) || ts.isNonNullExpression(p))) { if (consumed.has(p)) return; p = p.parent; }
  if (p && PATH_KINDS.has(p.kind) && !sinkOf2(p) && isPathy(ev(p))) return;
  if (p && ts.isPropertyAccessExpression(p) && ['toString', 'valueOf'].includes(p.name.text)) return pathHeld(p.parent, v, rel, node);
  pathHeld(node, v, rel, node);
}
const sinkOf2 = (p) => (ts.isCallExpression(p) || ts.isNewExpression(p)) && !!sinkOf(p);
function pathHeld(at, v, rel, node) {
  if (v.t === 'x' || (v.t === 'm' && v.alts.some((a) => a.t === 'x'))) { PARTIALS.push({ f: rel, l: lineOf(node), s: textOf(node), px: v.t === 'x' ? v.v : v.alts.find((a) => a.t === 'x').v }); return; }
  const got = [];
  record({ f: rel, l: lineOf(node), s: textOf(node) }, { k: 'path' }, v, got);
  for (const r of got) { if (isAnchor(r)) STATS.anchors++; else REFS.push(r); }
}
/** A path written into a longer text (a program held as text, a command line): the path a part of the text builds,
 *  with the plain characters that follow it. */
function embeddedPaths(node, rel) {
  steps = 0;
  if (isPathy(ev(node))) return;
  for (const span of node.templateSpans) {
    const tail = /^[\w@.+\-/]*/.exec(span.literal.text)[0].replace(/\.+$/, '');
    if (!tail || tail === '/') continue;
    steps = 0;
    const v = ev(span.expression);
    if (!v || (v.t !== 'p' && v.t !== 'u')) continue;
    const base = v.t === 'u' ? urlToPath(v.v) : v.v;
    if (!base) continue;
    const got = [];
    record({ f: rel, l: lineOf(span.expression), s: textOf(span.expression, 80) + tail }, { k: 'path', note: 'written into a longer text' }, P(base + tail), got);
    for (const r of got) if (REAL.has(r.tk) && !isAnchor(r)) REFS.push(r);
  }
}
const PATH_TEXT = /^[\w@.+\-/]{3,200}$/;
const TEXT_REFS = [];
/** Text that names a file or folder of the repository: a lead, not a use. */
function pathText(node, rel) {
  const t = node.text;
  if (!PATH_TEXT.test(t) || !/[a-z]/i.test(t)) return;
  const p = node.parent;
  if (p && (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isLiteralTypeNode(p))) return;
  const hasSlash = t.includes('/'); const hasExt = /\.[a-z0-9]{1,6}$/i.test(t);
  if (!hasSlash && !hasExt) return;
  const clean = t.replace(/\/+$/, '');
  const tries = [];
  if (/^\.\.?\//.test(t)) tries.push(pjoin(path.posix.dirname(rel), clean));
  else if (t.startsWith('/')) return;
  else { tries.push(pjoin(clean)); const pkg = pkgDirOf(rel); if (pkg) tries.push(pjoin(pkg, clean)); tries.push(pjoin(path.posix.dirname(rel), clean)); }
  for (const cand of tries) {
    if (cand.startsWith('..')) continue;
    const isFile = FILE_SET.has(cand); const isDir = !isFile && DIR_SET.has(cand);
    if (!isFile && !isDir) continue;
    const to = isDir ? `${cand}/` : cand;
    const o = ownerOf(to);
    TEXT_REFS.push({ f: rel, l: lineOf(node), k: 'path-text', s: t, tk: isFile ? 'file' : 'dir', to, own: o ? o.m : undefined });
    return;
  }
}

for (const rel of JS_FILES) { const t = Date.now(); readFile(rel); if (Date.now() - t > 3000) log(`  slow: ${rel} ${Date.now() - t} ms`); }
lap(`read: ${REFS.length} references, ${TEXT_REFS.length} texts that name a path, ${PENDING.length} points of use that wait on a parameter, ${PARTIALS.length} partial paths`);

// ---------------------------------------------------------------------------------------------------------------
// 6. Points of use that wait on a parameter: read again at every call the parser can tie to the function
// ---------------------------------------------------------------------------------------------------------------
const fnOfParam = (decl) => { let n = decl.parent; while (n && !ts.isFunctionLike(n)) n = n.parent; return n; };
const VIA = [];
let budget = 0;
function expand(evalAll, depth, trail, results) {
  missEnv.clear();
  const { got, waits } = evalAll();
  if (!waits) { results.push({ got, trail, open: false }); return; }
  const dep = depth < 4 ? [...waits].find((x) => missEnv.get(x) && fnOfParam(x)) : null;
  if (!dep) { results.push({ got, trail, open: true }); return; }
  const fn = fnOfParam(dep); const envToFill = missEnv.get(dep);
  const sites = CALLS.get(fn) ?? [];
  if (!sites.length) { results.push({ got, trail, open: true, noCaller: true }); return; }
  for (const cs of sites) {
    if (--budget < 0) { results.push({ got, trail, open: true, cut: true }); return; }
    const csEnv = new Map(); const before = new Map(envToFill);
    fn.parameters.forEach((p, i) => { if (!p.dotDotDotToken) envToFill.set(p, { node: cs.arguments[i] ?? null, env: csEnv }); });
    expand(evalAll, depth + 1, [...trail, cs], results);
    envToFill.clear(); for (const [k, v] of before) envToFill.set(k, v);
  }
}
for (const pend of PENDING) {
  const env0 = new Map(); const rel = pend.rel; const node = pend.node;
  const evalAll = () => {
    const got = []; let waits = null;
    runSink(pend.desc, node, env0, (spec, val, deps) => {
      const n = spec.node ?? node;
      const ok = record({ f: rel, l: lineOf(n), s: textOf(n), in: fnNameOf(node) ?? undefined }, spec, val, got);
      if (!ok && deps && deps.size) { waits ??= new Set(); for (const d of deps) waits.add(d); }
    });
    return { got, waits };
  };
  const results = []; budget = 4000;
  expand(evalAll, 0, [], results);
  let sites = 0; let open = 0; let noCaller = false; let cut = false;
  const seen = new Map();
  for (const r of results) {
    if (!r.trail.length) { noCaller = noCaller || !!r.noCaller; continue; }
    sites++;
    if (r.open) open++;
    if (r.noCaller) noCaller = true;
    if (r.cut) cut = true;
    const cs = r.trail[r.trail.length - 1]; const via = `${relOf(fileOfNode(cs))}:${lineOf(cs)}`;
    for (const g of r.got) {
      if (g.c && g.c !== 'x') continue;
      const key = `${g.l}|${g.k}|${g.c ?? ''}|${g.tk ?? ''}|${g.to ?? g.px}`;
      if (!seen.has(key)) { const v = { ...g, via: [via], viaCount: 1 }; seen.set(key, v); VIA.push(v); } else { const v = seen.get(key); v.viaCount++; if (v.via.length < 3 && !v.via.includes(via)) v.via.push(via); }
    }
  }
  for (const r of pend.refs) r.inst = { sites, open, ...(noCaller ? { noCaller: 1 } : {}), ...(cut ? { cut: 1 } : {}) };
}
lap(`callers read: ${VIA.length} references through ${PENDING.length} points of use`);


// ---------------------------------------------------------------------------------------------------------------
// 7. Other files that hold code or name files: Python, HTML, package and Worker configuration, programs kept as text
// ---------------------------------------------------------------------------------------------------------------
/** Files whose contents are never read here (the repository's rule: never print a secret). */
const NEVER_READ = /(^|\/)(SECRETS[^/]*|\.dev\.vars[^/]*|\.env[^/]*)$/;
const EXCLUDED = (() => {
  const globs = (cfg.language_reader?.exclude ?? []).map((g) => {
    let re = '';
    for (let i = 0; i < g.length; i++) {
      const c = g[i];
      if (c === '*' && g[i + 1] === '*') { i++; if (g[i + 1] === '/') { i++; re += '(?:.*/)?'; } else re += '.*'; } else if (c === '*') re += '[^/]*'; else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp(`^${re}$`);
  });
  return (rel) => globs.some((r) => r.test(rel));
})();
const OTHER = { python: 0, html: 0, htmlInlineScripts: 0, config: 0, text: 0, byHand: [] };
const PY_CODE = String.raw`
import ast, json, sys, html.parser
out = {}
class H(html.parser.HTMLParser):
    def __init__(s):
        super().__init__(convert_charrefs=True); s.refs = []; s.scripts = []; s.on = False; s.buf = []; s.at = 0
    def handle_starttag(s, tag, attrs):
        a = dict(attrs)
        if tag == 'script':
            if a.get('src'): s.refs.append([s.getpos()[0], 'script', a['src']])
            else: s.on = True; s.buf = []; s.at = s.getpos()[0]
        elif tag == 'link' and a.get('href'): s.refs.append([s.getpos()[0], 'link', a['href']])
        elif tag in ('img', 'iframe', 'source', 'audio', 'video', 'embed', 'object') and (a.get('src') or a.get('data')): s.refs.append([s.getpos()[0], tag, a.get('src') or a.get('data')])
    def handle_data(s, d):
        if s.on: s.buf.append(d)
    def handle_endtag(s, tag):
        if tag == 'script' and s.on: s.on = False; s.scripts.append([s.at, ''.join(s.buf)])
def dotted(n):
    if isinstance(n, ast.Name): return n.id
    if isinstance(n, ast.Attribute):
        b = dotted(n.value); return (b + '.' + n.attr) if b else None
    if isinstance(n, ast.Call): return dotted(n.func)
    return None
for f in json.load(sys.stdin):
    try: text = open(f, encoding='utf8', errors='replace').read()
    except Exception as e: out[f] = {'error': str(e)}; continue
    if f.endswith('.py'):
        try: tree = ast.parse(text)
        except Exception as e: out[f] = {'error': str(e)}; continue
        imports = []; strings = []; calls = []
        for n in ast.walk(tree):
            if isinstance(n, ast.Import):
                for a in n.names: imports.append([n.lineno, a.name, 0])
            elif isinstance(n, ast.ImportFrom): imports.append([n.lineno, n.module or '', n.level])
            elif isinstance(n, ast.Constant) and isinstance(n.value, str) and 2 < len(n.value) < 200: strings.append([n.lineno, n.value])
            elif isinstance(n, ast.Call):
                name = dotted(n.func)
                if name: 
                    a0 = n.args[0] if n.args else None
                    lit = a0.value if isinstance(a0, ast.Constant) and isinstance(a0.value, str) else None
                    calls.append([n.lineno, name, lit, ast.unparse(a0)[:120] if a0 is not None else None])
        out[f] = {'imports': imports, 'strings': strings, 'calls': calls}
    else:
        h = H()
        try: h.feed(text)
        except Exception as e: out[f] = {'error': str(e)}; continue
        out[f] = {'refs': h.refs, 'scripts': h.scripts}
json.dump(out, sys.stdout)
`;
function runPython(files) {
  if (!files.length) return {};
  const r = spawnSync('python3', ['-I', '-c', PY_CODE], { cwd: ROOT, input: JSON.stringify(files), encoding: 'utf8', maxBuffer: 1 << 30 });
  if (r.status !== 0) { log(`python3 could not be run (${(r.stderr || r.error || '').toString().slice(0, 200)}): Python and HTML files are not read`); return null; }
  return JSON.parse(r.stdout);
}
const PY_FS = new Map([['open', 'fs-read'], ['os.listdir', 'fs-list'], ['os.walk', 'fs-list'], ['os.scandir', 'fs-list'], ['glob.glob', 'fs-list'], ['os.path.exists', 'fs-stat'], ['os.path.isfile', 'fs-stat'],
  ['os.path.isdir', 'fs-stat'], ['subprocess.run', 'proc'], ['subprocess.Popen', 'proc'], ['subprocess.check_output', 'proc'], ['subprocess.check_call', 'proc'], ['subprocess.call', 'proc'], ['os.system', 'proc'],
  ['shutil.copy', 'fs-read'], ['shutil.copyfile', 'fs-read'], ['shutil.copytree', 'fs-read'], ['Path', 'path'], ['pathlib.Path', 'path'], ['Image.open', 'fs-read'], ['json.load', null]]);
/** A text that may name a path, tried against the file's folder, the top and the file's package folder. */
function existing(text, rel, { relOnly = false } = {}) {
  const clean = text.replace(/[?#].*$/, '').replace(/\/+$/, '');
  if (!clean || /^[a-z][a-z0-9+.-]*:/i.test(clean) || clean.startsWith('//')) return null;
  const tries = [];
  if (clean.startsWith('/')) return null;
  tries.push(pjoin(path.posix.dirname(rel), clean));
  if (!relOnly && !/^\.\.?\//.test(clean)) { tries.push(pjoin(clean)); const pkg = pkgDirOf(rel); if (pkg) tries.push(pjoin(pkg, clean)); }
  for (const cand of tries) {
    if (cand.startsWith('..')) continue;
    if (FILE_SET.has(cand)) return { tk: 'file', to: cand };
    if (DIR_SET.has(cand)) return { tk: 'dir', to: `${cand}/` };
  }
  return null;
}
const withOwner = (r) => { const o = r.to && (r.tk === 'file' || r.tk === 'dir' || r.tk === 'missing') ? ownerOf(r.to) : null; if (o) r.own = o.m; return r; };
{
  const pyFiles = OWNED.filter((f) => f.endsWith('.py'));
  const htmlFiles = OWNED.filter((f) => /\.html?$/.test(f));
  const parsed = runPython([...pyFiles, ...htmlFiles]);
  if (parsed) {
    for (const f of pyFiles) {
      const d = parsed[f]; if (!d || d.error) { OTHER.byHand.push({ f, why: `Python's parser refused it: ${d?.error}` }); continue; }
      OTHER.python++;
      for (const [l, mod, level] of d.imports) {
        const base = path.posix.dirname(f); const name = mod.split('.').join('/');
        const cands = level ? [pjoin(base, '../'.repeat(level - 1), `${name}.py`)] : [pjoin(base, `${name}.py`), pjoin(base, name, '__init__.py')];
        const hit = cands.find((c) => FILE_SET.has(c));
        if (hit) REFS.push(withOwner({ f, l, k: 'import', s: mod, tk: 'file', to: hit, lang: 'py' }));
        else REFS.push({ f, l, k: 'import', s: mod, tk: 'package', to: mod.split('.')[0], lang: 'py' });
      }
      const seen = new Set();
      for (const [l, name, lit, expr] of d.calls) {
        if (!PY_FS.has(name) || !PY_FS.get(name)) continue;
        const k = PY_FS.get(name);
        if (lit !== null) { const hit = existing(lit, f); if (hit) { REFS.push(withOwner({ f, l, k, s: lit, ...hit, fn: `py ${name}`, lang: 'py' })); seen.add(`${l}|${lit}`); } else if (k !== 'path' && k !== 'proc') REFS.push({ f, l, k, s: lit, tk: 'cwd-missing', to: lit, fn: `py ${name}`, lang: 'py' }); }
        else if (expr !== null && k !== 'path') REFS.push({ f, l, k, s: expr, c: 1, fn: `py ${name}`, lang: 'py' });
      }
      for (const [l, text] of d.strings) {
        if (!PATH_TEXT.test(text) || (!text.includes('/') && !/\.[a-z0-9]{1,6}$/i.test(text)) || seen.has(`${l}|${text}`)) continue;
        const hit = existing(text, f); if (hit) TEXT_REFS.push(withOwner({ f, l, k: 'path-text', s: text, ...hit, lang: 'py' }));
      }
    }
    for (const f of htmlFiles) {
      const d = parsed[f]; if (!d || d.error) { OTHER.byHand.push({ f, why: `the HTML parser refused it: ${d?.error}` }); continue; }
      OTHER.html++;
      for (const [l, tag, v] of d.refs) { const hit = existing(v, f, { relOnly: true }); if (hit) REFS.push(withOwner({ f, l, k: 'html-ref', s: v, ...hit, fn: tag })); }
      for (const [l0, text] of d.scripts) {
        if (!text.trim()) continue;
        OTHER.htmlInlineScripts++;
        const sf = ts.createSourceFile(`${f}.inline.js`, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
        const stack = [sf];
        while (stack.length) {
          const n = stack.pop();
          let spec = null; let k = null;
          if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteralLike(n.moduleSpecifier)) { spec = n.moduleSpecifier.text; k = 'import'; }
          else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword) { k = 'dynamic-import'; const a0 = n.arguments[0]; spec = a0 && ts.isStringLiteralLike(a0) ? a0.text : null; if (spec === null) REFS.push({ f, l: l0 + sf.getLineAndCharacterOfPosition(n.getStart(sf)).line, k, s: (a0?.getText() ?? '').slice(0, 120), c: 1, lang: 'html' }); }
          if (spec !== null) record({ f, l: l0 + sf.getLineAndCharacterOfPosition(n.getStart(sf)).line, s: spec, lang: 'html' }, { k, asSpec: true }, S(spec), REFS);
          ts.forEachChild(n, (c) => { stack.push(c); });
        }
      }
    }
  } else OTHER.byHand.push(...[...pyFiles, ...htmlFiles].map((f) => ({ f, why: 'python3 was not there to parse it' })));

  // package.json and wrangler.jsonc
  const readJsonc = (rel) => { const r = ts.parseConfigFileTextToJson(rel, fs.readFileSync(absOf(rel), 'utf8')); return r.error ? null : r.config; };
  const lineIn = (rel, needle) => { const i = fs.readFileSync(absOf(rel), 'utf8').split('\n').findIndex((l) => l.includes(needle)); return i < 0 ? 1 : i + 1; };
  const wranglers = OWNED.filter((f) => /(^|\/)wrangler\.jsonc?$/.test(f));
  const workerByName = new Map();
  for (const f of wranglers) { const j = readJsonc(f); if (j?.name) workerByName.set(j.name, f); }
  for (const f of wranglers) {
    const j = readJsonc(f); if (!j) { OTHER.byHand.push({ f, why: 'not read as JSON with comments' }); continue; }
    OTHER.config++;
    const dir = path.posix.dirname(f);
    const fileRef = (k, v, fn) => { if (typeof v !== 'string') return; const to = pjoin(dir, v); const c = classify(absOf(to)); REFS.push(withOwner({ f, l: lineIn(f, v), k, s: v, tk: c.kind, to: c.rel ?? to, fn, lang: 'config' })); };
    fileRef('worker', j.main, 'wrangler main');
    if (j.assets?.directory) fileRef('path', j.assets.directory, 'wrangler assets');
    for (const r of j.rules ?? []) for (const g of r.globs ?? []) REFS.push({ f, l: lineIn(f, g), k: 'worker-module', s: g, c: 1, note: 'a pattern of files wrangler adds to the Worker', lang: 'config' });
    const names = [...(j.services ?? []).map((x) => x.service), ...(j.durable_objects?.bindings ?? []).map((x) => x.script_name).filter(Boolean), ...(j.tail_consumers ?? []).map((x) => x.service)];
    for (const n of names) {
      if (n === j.name) continue;
      const target = workerByName.get(n);
      if (target) REFS.push(withOwner({ f, l: lineIn(f, `"${n}"`), k: 'service-binding', s: n, tk: 'file', to: target, lang: 'config' }));
      else REFS.push({ f, l: lineIn(f, `"${n}"`), k: 'service-binding', s: n, tk: 'outside', to: `a Worker named ${n} with no wrangler file here`, lang: 'config' });
    }
    if (j.build?.command) for (const w of String(j.build.command).split(/\s+/)) { const hit = existing(w, f, { relOnly: true }); if (hit) REFS.push(withOwner({ f, l: lineIn(f, w), k: 'proc', s: w, ...hit, fn: 'wrangler build.command', lang: 'config' })); }
  }
  for (const f of OWNED.filter((x) => /(^|\/)package\.json$/.test(x))) {
    let j; try { j = JSON.parse(fs.readFileSync(absOf(f), 'utf8')); } catch { OTHER.byHand.push({ f, why: 'not JSON' }); continue; }
    OTHER.config++;
    for (const key of ['main', 'module', 'browser']) if (typeof j[key] === 'string') { const hit = existing(j[key], f, { relOnly: true }); if (hit) REFS.push(withOwner({ f, l: lineIn(f, j[key]), k: 'path', s: j[key], ...hit, fn: `package ${key}`, lang: 'config' })); }
    for (const [name, cmd] of Object.entries(j.scripts ?? {})) {
      for (const w0 of String(cmd).split(/[\s"']+/)) {
        const w = w0.includes('=') && w0.startsWith('-') ? w0.slice(w0.indexOf('=') + 1) : w0;
        if (!w || w.startsWith('-') || (!w.includes('/') && !CODE_EXT.test(w))) continue;
        if (w.includes('*')) { const pre = w.slice(0, w.indexOf('*')).replace(/[^/]*$/, ''); const hit = pre ? existing(pre, f, { relOnly: true }) : null; REFS.push({ f, l: lineIn(f, w), k: 'proc', s: w, c: 'x', px: absOf(pjoin(path.posix.dirname(f), pre)), fn: `package script ${name}`, note: 'a pattern of files the command runs', lang: 'config', ...(hit ? {} : {}) }); continue; }
        const hit = existing(w, f, { relOnly: true });
        if (hit) REFS.push(withOwner({ f, l: lineIn(f, w), k: 'proc', s: w, ...hit, fn: `package script ${name}`, lang: 'config' }));
      }
    }
    for (const dep of Object.keys({ ...j.dependencies, ...j.devDependencies, ...j.optionalDependencies })) REFS.push({ f, l: lineIn(f, `"${dep}"`), k: 'import', s: dep, tk: 'package', to: dep, fn: 'package dependency', lang: 'config' });
  }
  // programs kept as text: a .txt file that parses as a module with imports
  for (const f of OWNED.filter((x) => x.endsWith('.txt') && !NEVER_READ.test(x) && !x.startsWith('build/') && !x.includes('/vendor/'))) {
    const text = fs.readFileSync(absOf(f), 'utf8');
    if (!/^\s*(import|export)\s/m.test(text)) continue;
    const sf = ts.createSourceFile(`${f}.js`, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
    const imports = sf.statements.filter((n) => (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteralLike(n.moduleSpecifier));
    if (!imports.length || sf.parseDiagnostics.length) continue;
    OTHER.text++;
    for (const n of imports) record({ f, l: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, s: n.moduleSpecifier.text, lang: 'text' }, { k: ts.isImportDeclaration(n) ? 'import' : 'export-from', asSpec: true }, S(n.moduleSpecifier.text), REFS);
  }
  // what is left that holds code and no parser here reads: named, for the reading by hand
  for (const f of OWNED) {
    if (/\.(sh|ya?ml|rs|toml|graphql|css)$/.test(f) || /(^|\/)Dockerfile[^/]*$/.test(f) || /(^|\/)\.dockerignore$/.test(f)) OTHER.byHand.push({ f, why: 'no parser here reads this kind of file' });
  }
}
lap(`other files: ${OTHER.python} Python, ${OTHER.html} HTML (${OTHER.htmlInlineScripts} scripts inside), ${OTHER.config} configuration, ${OTHER.text} programs kept as text, ${OTHER.byHand.length} left to the reading by hand`);

// ---------------------------------------------------------------------------------------------------------------
// 8. What each computed reference reaches: by the start of its path, by its callers, by the reading by hand, by a run
// ---------------------------------------------------------------------------------------------------------------
const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };
/** The lane's readings by hand (tools/hand-resolutions.json) and what traced runs saw at each place (tools/runtime-sites.json). */
const HAND = readJson(path.join(HERE, 'hand-resolutions.json'), { rules: [], files: [] });
const RUNTIME = readJson(path.join(HERE, 'runtime-sites.json'), { sites: {} });
const HAND_RULES = (HAND.rules ?? []).map((r) => ({ ...r, fileRe: r.file ? new RegExp(r.file) : null, exprRe: r.expr ? new RegExp(r.expr) : null, kindRe: r.kind ? new RegExp(r.kind) : null, used: 0 }));
function handRule(r) {
  for (const h of HAND_RULES) {
    if (h.fileRe && !h.fileRe.test(r.f)) continue;
    if (h.lines && !h.lines.includes(r.l)) continue;
    if (h.kindRe && !h.kindRe.test(r.k)) continue;
    if (h.exprRe && !h.exprRe.test(r.s ?? '')) continue;
    h.used++;
    return h;
  }
  return null;
}
const OUTSIDE_START = /^(<tmp>|<home>|<cwd-up>|\/tmp\/|\/var\/|\/proc\/|\/dev\/|\/usr\/|\/etc\/|\/opt\/|\/workerd\/)/;
/** The modules that own a file whose path begins with the text given: Map module → number of files. */
function ownersUnder(prefixRel) {
  let lo = 0; let hi = ALL_FILES.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (ALL_FILES[mid] < prefixRel) lo = mid + 1; else hi = mid; }
  const out = new Map(); let unowned = 0;
  for (let i = lo; i < ALL_FILES.length && ALL_FILES[i].startsWith(prefixRel); i++) { const o = ownerOf(ALL_FILES[i]); if (o) out.set(o.m, (out.get(o.m) ?? 0) + 1); else unowned++; }
  return { owners: out, unowned };
}
function resolveComputed(r) {
  const hand = handRule(r);
  const seen = RUNTIME.sites?.[`${r.f}:${r.l}`] ?? null;
  const res = {};
  if (r.c === 'x' && r.px.startsWith('<argv>')) { res.by = 'argv'; res.how = 'the path is given on the command line (process.argv): it reaches what the one who starts the program names'; res.startedBy = STARTS.get(r.f) ?? []; }
  else if (r.c === 'x') {
    if (OUTSIDE_START.test(r.px)) { res.by = 'outside'; res.reach = []; res.how = 'its path starts in a folder outside the repository (a temporary folder made at run time, or a system path)'; }
    else {
      const rel0 = relOf(r.px); const pre = r.px.endsWith('/') && !rel0.endsWith('/') && rel0 !== '' ? `${rel0}/` : rel0;
      if (rel0.startsWith('..')) { res.by = 'outside'; res.reach = []; res.how = `its path starts outside the repository (${r.px})`; }
      else {
        const { owners, unowned } = ownersUnder(pre);
        res.px = pre || '.';
        if (owners.size === 1 && !unowned) { res.by = 'start'; res.reach = [...owners.keys()]; res.how = `every file whose path starts with ${pre} is owned by this one module`; }
        else if (owners.size === 0 && !unowned) { res.by = 'start'; res.reach = []; const o = ownerOf(pre); res.how = `no file in the repository has a path that starts with ${pre}: a path made at run time${o ? `, in a folder ${o.m} claims` : ''}`; if (o) res.claim = o.m; }
        else { res.by = 'open'; res.among = [...owners.keys()].sort((a, b) => MOD_INDEX.get(a) - MOD_INDEX.get(b)); res.how = `files of ${owners.size} modules${unowned ? ' and files no module owns' : ''} have paths that start with ${pre || 'the top folder'}`; }
      }
    }
  } else if (r.inst && r.inst.sites > 0 && r.inst.open === 0) { res.by = 'callers'; res.how = `its argument comes from a parameter; every one of the ${r.inst.sites} calls the parser ties to the function was read (the references are listed with "via")`; }
  else if (/\bprocess\.env\b/.test(r.s ?? '')) { res.by = 'env'; res.how = 'the path is read from an environment variable: it reaches what the one who starts the program sets'; res.startedBy = STARTS.get(r.f) ?? []; }
  else res.by = 'open';
  if (r.inst) res.inst = r.inst;
  if (hand) { res.hand = { rule: hand.id, reach: hand.reach ?? [], how: hand.how, tag: hand.tag, ...(hand.outside ? { outside: 1 } : {}) }; if (res.by === 'open') res.by = 'hand'; }
  if (seen) { res.seen = seen; if (res.by === 'open') res.by = 'run'; }
  return res;
}
/** The places that start a file as a program (a child process, a Worker, a package script): file → ["file:line", …]. */
const STARTS = new Map();
for (const r of [...REFS, ...VIA]) if (!r.c && r.tk === 'file' && /^(proc|worker)$/.test(r.k)) { if (!STARTS.has(r.to)) STARTS.set(r.to, []); const at = `${r.f}:${r.l}`; if (STARTS.get(r.to).length < 6 && !STARTS.get(r.to).includes(at)) STARTS.get(r.to).push(at); }
const COMPUTED = REFS.filter((r) => r.c);
for (const r of COMPUTED) r.res = resolveComputed(r);
for (const v of VIA) if (v.c) v.res = resolveComputed(v);

// ---------------------------------------------------------------------------------------------------------------
// 9. Module edges, findings, data files
// ---------------------------------------------------------------------------------------------------------------
const KINDS = [];
const kindIdx = (k) => { let i = KINDS.indexOf(k); if (i < 0) { i = KINDS.length; KINDS.push(k); } return i; };
const EDGES = new Map(); // "from>to" → { counts: Map kind → [code, test], ex: [[file, line, kind]] }
const TOTALS = { byKind: new Map(), files: new Set(), intra: 0, cross: 0, noOwner: 0 };
function addEdge(fromFile, toModule, kind, line) {
  const o = ownerOf(fromFile);
  if (!o || !toModule) return;
  if (o.m === toModule) { TOTALS.intra++; return; }
  TOTALS.cross++;
  const key = `${o.m}>${toModule}`;
  let e = EDGES.get(key);
  if (!e) { e = { from: o.m, to: toModule, counts: new Map(), ex: [] }; EDGES.set(key, e); }
  if (!e.counts.has(kind)) e.counts.set(kind, [0, 0]);
  e.counts.get(kind)[o.t ? 1 : 0]++;
  if (e.ex.length < 5 || !e.ex.some((x) => x[2] === kind)) { if (e.ex.length >= 5) { const i = e.ex.findIndex((x, j) => e.ex.findIndex((y) => y[2] === x[2]) !== j); if (i >= 0) e.ex.splice(i, 1); else return; } e.ex.push([fromFile, line, kind]); }
}
const directOwners = new Map();
/** The modules that own a file directly inside a folder, or claim a folder directly inside it: what a listing of the folder names. */
function childOwners(dirRel) {
  if (directOwners.has(dirRel)) return directOwners.get(dirRel);
  const set = new Set(); const subs = new Set();
  const pre = dirRel === '.' ? '' : dirRel;
  for (const f of ALL_FILES) {
    if (!f.startsWith(pre)) continue;
    const rest = f.slice(pre.length); const cut = rest.indexOf('/');
    if (cut < 0) { const o = ownerOf(f); if (o) set.add(o.m); } else subs.add(`${pre}${rest.slice(0, cut + 1)}`);
  }
  for (const d of subs) { const o = ownerOf(d); if (o) set.add(o.m); }
  directOwners.set(dirRel, set);
  return set;
}
const isExcluded = (f) => EXCLUDED(f);
const countKind = (k) => TOTALS.byKind.set(k, (TOTALS.byKind.get(k) ?? 0) + 1);
const HAS_TARGET = new Set(['file', 'dir', 'missing', 'untracked']);
for (const r of REFS) {
  TOTALS.files.add(r.f);
  if (r.c) { countKind(`${r.k} [computed]`); continue; }
  countKind(r.k);
  if (!HAS_TARGET.has(r.tk)) continue;
  const kind = r.tk === 'missing' ? `${r.k} (no such file)` : r.k;
  if (r.own) addEdge(r.f, r.own, kind, r.l); else TOTALS.noOwner++;
  if (r.k === 'fs-list' && r.tk === 'dir') for (const m of childOwners(r.to)) if (m !== r.own) addEdge(r.f, m, 'fs-list (a file or folder inside the folder listed)', r.l);
}
for (const v of VIA) {
  if (v.c) continue;
  countKind(`${v.k} (path given by a caller)`);
  if (HAS_TARGET.has(v.tk) && v.own) addEdge(v.f, v.own, `${v.k} (path given by a caller)`, v.l);
  if (v.k === 'fs-list' && v.tk === 'dir') for (const m of childOwners(v.to)) if (m !== v.own) addEdge(v.f, m, 'fs-list (a file or folder inside the folder listed)', v.l);
}
for (const r of [...COMPUTED, ...VIA.filter((v) => v.c)]) {
  const res = r.res;
  if (res.by === 'start') for (const m of res.reach) addEdge(r.f, m, `${r.k} (start of the path known)`, r.l);
  if (res.hand) for (const m of res.hand.reach) addEdge(r.f, m, `${r.k} (read by hand)`, r.l);
  if (res.seen) for (const m of Object.keys(res.seen.owners ?? {})) addEdge(r.f, m, `${r.k} (seen in a run)`, r.l);
}
const realPairs = new Set(REFS.filter((r) => r.to).map((r) => `${r.f}|${r.to}`));
const LEADS = TEXT_REFS.filter((r) => !realPairs.has(`${r.f}|${r.to}`) && r.to !== r.f && !isExcluded(r.f));
for (const r of LEADS) { countKind('path-text (a lead)'); if (r.own) addEdge(r.f, r.own, 'path-text (a lead)', r.l); }

// --- findings ---------------------------------------------------------------------------------------------------
const edgeList = [...EDGES.values()].sort((a, b) => MOD_INDEX.get(a.from) - MOD_INDEX.get(b.from) || MOD_INDEX.get(a.to) - MOD_INDEX.get(b.to));
const isUp = (e) => MOD_INDEX.get(e.to) > MOD_INDEX.get(e.from);
/** Every single reference that goes to a later module, with its place. */
const UP = [];
function upRef(r, kind) {
  const o = ownerOf(r.f); const to = r.own;
  if (!o || !to || MOD_INDEX.get(to) <= MOD_INDEX.get(o.m)) return;
  UP.push({ from: o.m, to, side: o.t ? 'test' : 'code', at: `${r.f}:${r.l}`, kind, what: r.to ?? r.s });
}
for (const r of REFS) if (!r.c && HAS_TARGET.has(r.tk) && r.own) upRef(r, r.tk === 'missing' ? `${r.k} (no such file)` : r.k);
for (const v of VIA) if (!v.c && HAS_TARGET.has(v.tk) && v.own) upRef(v, `${v.k} (path given by a caller)`);
for (const r of LEADS) if (r.own) upRef(r, 'path-text (a lead)');
const upExtra = (r, m, kind) => { const o = ownerOf(r.f); if (o && MOD_INDEX.get(m) > MOD_INDEX.get(o.m)) UP.push({ from: o.m, to: m, side: o.t ? 'test' : 'code', at: `${r.f}:${r.l}`, kind, what: r.s }); };
for (const r of REFS) if (!r.c && r.k === 'fs-list' && r.tk === 'dir') for (const m of childOwners(r.to)) if (m !== r.own) upExtra({ ...r, s: r.to }, m, 'fs-list (a file or folder inside the folder listed)');
for (const v of VIA) if (!v.c && v.k === 'fs-list' && v.tk === 'dir') for (const m of childOwners(v.to)) if (m !== v.own) upExtra({ ...v, s: v.to }, m, 'fs-list (a file or folder inside the folder listed)');
for (const r of [...COMPUTED, ...VIA.filter((v) => v.c)]) {
  if (r.res.by === 'start') for (const m of r.res.reach) upExtra(r, m, `${r.k} (start of the path known)`);
  if (r.res.hand) for (const m of r.res.hand.reach) upExtra(r, m, `${r.k} (read by hand)`);
  if (r.res.seen) for (const m of Object.keys(r.res.seen.owners ?? {})) upExtra(r, m, `${r.k} (seen in a run)`);
}

/** Declared uses against the graph, module by module. */
const IMPORT_KINDS = new Set(['import', 'export-from', 'dynamic-import', 'jsdoc-import', 'require']);
const USES = MODS.map((m) => {
  const found = new Map(); // to → Set of kinds
  for (const e of edgeList) if (e.from === m.name) found.set(e.to, new Set(e.counts.keys()));
  const declared = new Set(m.uses);
  const declaredNotFound = m.uses.filter((u) => !found.has(u));
  const declaredOnlyLead = m.uses.filter((u) => found.has(u) && [...found.get(u)].every((k) => k.startsWith('path-text')));
  const declaredNoImport = m.uses.filter((u) => found.has(u) && ![...found.get(u)].some((k) => IMPORT_KINDS.has(k)));
  const foundNotDeclared = [...found.keys()].filter((t) => !declared.has(t)).map((t) => ({ to: t, kinds: [...found.get(t)], later: MOD_INDEX.get(t) > m.index }));
  const declaredLater = m.uses.filter((u) => !MOD_INDEX.has(u) || MOD_INDEX.get(u) >= m.index);
  return { module: m.name, index: m.index + 1, declared: m.uses.length, found: found.size, declaredNotFound, declaredNoImport, declaredOnlyLead, foundNotDeclared, declaredLater };
});

/** Files no module owns; files two claims of the same length both match; files more than one module's claims match. */
const UNOWNED = ALL_FILES.filter((f) => !ownerOf(f));
const TIED = OWNED.filter((f) => ownerOf(f).tie.length).map((f) => ({ file: f, owner: ownerOf(f).m, also: ownerOf(f).tie.map((c) => `${c.m}${c.t ? ' (tests)' : ''}`) }));
const OVERLAP = [];
for (const f of OWNED) {
  const o = ownerOf(f); const others = new Set();
  for (const c of CLAIMS_BY_TOP.get(f.split('/')[0]) ?? []) if (underPath(f, c.p) && c.m !== o.m) others.add(c.m);
  if (others.size) OVERLAP.push([f, o.m, [...others]]);
}
const overlapByPair = new Map();
for (const [, m, others] of OVERLAP) for (const x of others) { const k = `${m} (owner, the longer path) inside ${x}`; overlapByPair.set(k, (overlapByPair.get(k) ?? 0) + 1); }

// --- writing ----------------------------------------------------------------------------------------------------
fs.mkdirSync(OUT, { recursive: true });
const write = (name, obj) => { const text = JSON.stringify(obj); fs.writeFileSync(path.join(OUT, name), `${text}\n`); return text.length + 1; };
const sizes = {};

// module-edges.json
{
  const exFiles = []; const exIdx = new Map();
  const fi = (f) => { if (!exIdx.has(f)) { exIdx.set(f, exFiles.length); exFiles.push(f); } return exIdx.get(f); };
  const kinds = []; const ki = (k) => { let i = kinds.indexOf(k); if (i < 0) { i = kinds.length; kinds.push(k); } return i; };
  const edges = edgeList.map((e) => [MOD_INDEX.get(e.from), MOD_INDEX.get(e.to),
    [...e.counts].sort((a, b) => a[0].localeCompare(b[0])).flatMap(([k, [c, t]]) => [ki(k), c, t]),
    e.ex.flatMap(([f, l, k]) => [fi(f), l, ki(k)])]);
  sizes['module-edges.json'] = write('module-edges.json', {
    format: 'edges: [from, to, counts, examples]. from and to index `modules` (the order of process/modules/order.txt, 0 first). counts is a flat list of triples kind, n-from-code, n-from-tests (kind indexes `kinds`; code = the referring file is under the from-module\'s `files`, tests = under its `tests`). examples is a flat list of triples file, line, kind (file indexes `files`), at most 5 for a pair, one for each kind first. A pair is listed when at least one reference goes from a file the first module owns to a file or folder the second owns.',
    modules: ORDER, kinds, files: exFiles, edges });
}
// files.json
{
  const paths = []; const pidx = new Map();
  const pi = (f) => { if (!pidx.has(f)) { pidx.set(f, paths.length); paths.push(f); } return pidx.get(f); };
  const kinds = []; const ki = (k) => { let i = kinds.indexOf(k); if (i < 0) { i = kinds.length; kinds.push(k); } return i; };
  const byFile = new Map();
  const entry = (f) => { if (!byFile.has(f)) byFile.set(f, { same: new Map(), out: [] }); return byFile.get(f); };
  const put = (r, kind, own) => {
    const o = ownerOf(r.f); if (!o) return;
    const e = entry(r.f);
    if (own && own !== o.m) e.out.push([r.l, ki(kind), pi(r.to)]);
    else { const key = own ? `${kind} → same module` : r.c ? `${kind} [computed]` : `${kind} → ${r.tk ?? 'not known'}`; e.same.set(key, (e.same.get(key) ?? 0) + 1); }
  };
  for (const r of REFS) put(r, r.tk === 'missing' ? `${r.k} (no such file)` : r.k, r.c || !HAS_TARGET.has(r.tk) ? null : r.own);
  for (const v of VIA) if (!v.c) put(v, `${v.k} (path given by a caller)`, HAS_TARGET.has(v.tk) ? v.own : null);
  for (const r of LEADS) put(r, 'path-text (a lead)', r.own);
  const codeFiles = new Set([...JS_FILES, ...byFile.keys()]);
  const files = [...codeFiles].sort().map((f) => { const o = ownerOf(f); const e = byFile.get(f) ?? { same: new Map(), out: [] };
    return [pi(f), MOD_INDEX.get(o.m), o.t ? 1 : 0, [...e.same].sort().flatMap(([k, n]) => [ki(k), n]), e.out.sort((a, b) => a[0] - b[0]).flat()]; });
  // every other owned file, as runs: a folder whose files (not counting the code files above) all have one owner and one side
  const runs = new Map();
  for (const f of OWNED) { if (codeFiles.has(f)) continue; const o = ownerOf(f); const d = path.posix.dirname(f); const k = `${d}/|${o.m}|${o.t ? 1 : 0}`; runs.set(k, (runs.get(k) ?? 0) + 1); }
  const folders = [...runs].map(([k, n]) => { const [d, m, t] = k.split('|'); return [d, MOD_INDEX.get(m), Number(t), n]; });
  sizes['files.json'] = write('files.json', {
    format: 'files: [path, owner, side, counts, out] for every owned file that holds code or has a reference. path indexes `paths`; owner indexes `modules`; side 0 = under the owner\'s `files` (code), 1 = under its `tests`. counts is a flat list of pairs kind, n for the references that stay inside the module or leave the product (kind indexes `kinds`; the name says where they go). out is a flat list of triples line, kind, target for every reference to a file or folder another module owns (target indexes `paths`). folders: [folder, owner, side, n] counts the other owned files (documents, pictures, fixtures), which hold no code this script reads. The references that stay inside a module are counted here and not listed: run the script with --full <file> for every reference.',
    modules: ORDER, kinds, paths, files, folders });
}
// computed.json
{
  const byFile = new Map();
  const row = (r) => {
    const res = r.res; const out = { l: r.l, k: r.k, e: (r.s ?? '').slice(0, 110), by: res.by };
    if (r.in) out.in = r.in;
    if (r.params) out.params = r.params;
    if (r.via) out.via = r.via;
    if (r.note) out.note = r.note;
    if (r.byName) out.byName = 1;
    if (res.px !== undefined) out.px = res.px;
    if (res.reach) out.reach = res.reach;
    if (res.among) out.among = res.among.length > 12 ? `${res.among.length} modules: ${res.among.slice(0, 4).join(', ')} … ${res.among.slice(-2).join(', ')}` : res.among;
    if (res.inst) out.callers = res.inst;
    if (res.startedBy) out.startedBy = res.startedBy;
    if (res.hand) out.hand = res.hand;
    if (res.seen) out.seen = res.seen;
    return out;
  };
  for (const r of COMPUTED) { if (!byFile.has(r.f)) byFile.set(r.f, []); byFile.get(r.f).push(row(r)); }
  const viaByFile = new Map();
  for (const v of VIA) { if (!viaByFile.has(v.f)) viaByFile.set(v.f, []); viaByFile.get(v.f).push(v.c ? { ...row(v), n: v.viaCount } : { l: v.l, k: v.k, to: v.to, tk: v.tk, own: v.own, via: v.via, n: v.viaCount }); }
  const classes = {};
  for (const r of COMPUTED) classes[r.res.by] = (classes[r.res.by] ?? 0) + 1;
  sizes['computed.json'] = write('computed.json', {
    format: 'computed: file → every point of use in it whose argument the parser could not settle: l line, k kind, e the expression, in the function it is in, params the parameters it waits on, by how it was resolved (outside: starts outside the repository; start: the start of the path is known and one module owns everything under it; callers: read at every call the parser ties to its function, see via; hand: read by hand, see hand; run: seen in a traced run, see seen; open: not resolved), reach the modules it reaches, among the modules whose files lie under a known start when there are several, hand {rule, reach, how, tag}, seen what traced runs saw at the place. via: file → references made at a point of use with a path given by a caller, n the number of calls that gave it. rules: the readings by hand. unbound: calls by a name Node also uses (readFile, spawn, …) that the parser could not tie to Node, by what they are called on.',
    classes, computed: Object.fromEntries([...byFile].sort()), via: Object.fromEntries([...viaByFile].sort()),
    rules: HAND_RULES.map((h) => ({ id: h.id, file: h.file, lines: h.lines, kind: h.kind, expr: h.expr, reach: h.reach ?? [], how: h.how, tag: h.tag, used: h.used })),
    byHandFiles: HAND.files ?? [], notParsed: OTHER.byHand,
    unbound: (() => { const g = new Map(); for (const u of UNBOUND) { const on = u.on.replace(/^[\w$]+(\.[\w$#]+)*\.(record|#record|core|world\.record)$/, '….$2'); const k = `${u.name} on ${on}`; if (!g.has(k)) g.set(k, { n: 0, ex: [] }); const x = g.get(k); x.n++; if (x.ex.length < 2) x.ex.push(`${u.f}:${u.l}`); } return Object.fromEntries([...g].sort((a, b) => b[1].n - a[1].n)); })(),
    partialPaths: PARTIALS.length });
}
// findings
sizes['upward.json'] = write('upward.json', {
  format: 'Every reference found from a file one module owns to a file or folder a LATER module (in process/modules/order.txt) owns. rows: [from, to, side, at, kind, what]; from and to index `modules`; side 0 = the referring file is code (under `files`), 1 = a test (under `tests`).',
  modules: ORDER, rows: UP.sort((a, b) => MOD_INDEX.get(a.from) - MOD_INDEX.get(b.from) || a.at.localeCompare(b.at)).map((u) => [MOD_INDEX.get(u.from), MOD_INDEX.get(u.to), u.side === 'test' ? 1 : 0, u.at, u.kind, u.what]) });
sizes['uses-diff.json'] = write('uses-diff.json', {
  format: 'For each module: declared = the number of `uses` its entry declares; found = the number of other modules its files refer to in this graph; declaredNotFound = declared with no reference of any kind; declaredNoImport = declared, referred to, but by no import; declaredOnlyLead = declared and found only as a text that names a path; foundNotDeclared = referred to and not declared, with the kinds and whether the module is later in the order; declaredLater = declared uses that are not earlier in the order.',
  modules: USES });
sizes['ownership.json'] = write('ownership.json', {
  format: 'unowned: files no module\'s `files` or `tests` matches. tied: files two claims of the same length match. nested: counts of files matched by more than one module\'s claims, where the longer path wins.',
  unowned: UNOWNED, tied: TIED, nested: Object.fromEntries([...overlapByPair].sort((a, b) => b[1] - a[1])), nestedFiles: OVERLAP.length });

// summary.json: the numbers 09-graph.md quotes
const sum = (pred) => edgeList.filter(pred).length;
const upPairs = new Set(UP.map((u) => `${u.from}>${u.to}`));
const SUMMARY = {
  made: 'by tools/graph.mjs', base: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  typescript: ts.version, modules: MODS.length, filesInTree: ALL_FILES.length, owned: OWNED.length, unowned: UNOWNED.length, tied: TIED.length, nestedFiles: OVERLAP.length,
  ownedByExtension: (() => { const m = {}; for (const f of OWNED) { const e = path.extname(f) || '(none)'; m[e] = (m[e] ?? 0) + 1; } return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1])); })(),
  javascriptFiles: JS_FILES.length, javascriptFilesExcludedFromTheProcessReader: JS_FILES.filter(isExcluded).length,
  codeFilesBySide: (() => { let c = 0; let t = 0; for (const f of JS_FILES) { if (ownerOf(f).t) t++; else c++; } return { code: c, tests: t }; })(),
  other: { python: OTHER.python, html: OTHER.html, htmlInlineScripts: OTHER.htmlInlineScripts, configuration: OTHER.config, programsKeptAsText: OTHER.text, leftToHand: OTHER.byHand.length },
  references: REFS.length, referencesByKind: Object.fromEntries([...TOTALS.byKind].sort()),
  targets: (() => { const m = {}; for (const r of REFS) if (!r.c) { const k = `${r.k} → ${r.tk}`; m[k] = (m[k] ?? 0) + 1; } return Object.fromEntries(Object.entries(m).sort()); })(),
  viaCallers: VIA.length, leads: LEADS.length, anchors: STATS.anchors, partialPaths: PARTIALS.length, unbound: UNBOUND.length,
  computed: COMPUTED.length, computedByClass: (() => { const m = {}; for (const r of COMPUTED) { const k = `${r.res.by}`; m[k] = (m[k] ?? 0) + 1; } return m; })(),
  computedByKindAndClass: (() => { const m = {}; for (const r of COMPUTED) { const k = `${r.k} | ${r.res.by}`; m[k] = (m[k] ?? 0) + 1; } return Object.fromEntries(Object.entries(m).sort()); })(),
  referencesInsideAModule: TOTALS.intra, referencesAcrossModules: TOTALS.cross, referencesToAnUnownedTarget: TOTALS.noOwner,
  modulePairs: edgeList.length, modulePairsDownward: sum((e) => !isUp(e)), modulePairsUpward: sum(isUp),
  upward: { references: UP.length, fromCode: UP.filter((u) => u.side === 'code').length, fromTests: UP.filter((u) => u.side === 'test').length, pairs: upPairs.size,
    byKind: (() => { const m = {}; for (const u of UP) { const k = `${u.side} | ${u.kind}`; m[k] = (m[k] ?? 0) + 1; } return Object.fromEntries(Object.entries(m).sort()); })() },
  uses: { declared: USES.reduce((n, u) => n + u.declared, 0), declaredNotFound: USES.reduce((n, u) => n + u.declaredNotFound.length, 0), declaredNoImport: USES.reduce((n, u) => n + u.declaredNoImport.length, 0),
    foundNotDeclared: USES.reduce((n, u) => n + u.foundNotDeclared.length, 0), modulesWithDeclaredNotFound: USES.filter((u) => u.declaredNotFound.length).length,
    modulesWithFoundNotDeclared: USES.filter((u) => u.foundNotDeclared.length).length, declaredLater: USES.reduce((n, u) => n + u.declaredLater.length, 0) },
  stackErrors: STATS.stackErrors, sizes,
};
sizes['summary.json'] = write('summary.json', SUMMARY);
lap(`written: ${Object.entries(sizes).map(([k, v]) => `${k} ${(v / 1024).toFixed(0)} KB`).join(', ')}; total ${(Object.values(sizes).reduce((a, b) => a + b, 0) / 1024).toFixed(0)} KB`);
if (ARGV.has('--full')) { const to = process.argv[process.argv.indexOf('--full') + 1]; fs.writeFileSync(to, JSON.stringify({ REFS, VIA, LEADS, PARTIALS, UNBOUND })); lap(`every reference written to ${to}`); }
