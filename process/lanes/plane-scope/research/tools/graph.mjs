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
  module: ts.ModuleKind.ESNext, types: [], noEmit: true }, host);
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
      if (type === 'u' || acc.startsWith('file://')) return X(urlToPath(acc) ?? acc, 'text');
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
  if (!sym || !sym.declarations?.length) {
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
        return arr && arr.t === 'a' && arr.items.every((i) => i && !i.spread) ? multi(arr.items) : null;
      }
      if (!decl.initializer) return null;
      if (!isConstDecl(decl) && !neverReassigned(decl)) return null;
      return ev(decl.initializer, env, d);
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
const writtenNames = new Map();
/** A `let` or `var` whose name is written nowhere else in its file (by name: a second variable of the same name that
 *  is written counts against it, which only makes the reading more careful). */
function neverReassigned(decl) {
  const sf = decl.getSourceFile();
  let names = writtenNames.get(sf);
  if (!names) {
    names = new Set();
    const stack = [sf];
    const target = (n) => {
      if (ts.isIdentifier(n)) names.add(n.text);
      else if (ts.isArrayLiteralExpression(n)) n.elements.forEach(target);
      else if (ts.isObjectLiteralExpression(n)) n.properties.forEach((q) => { if (ts.isShorthandPropertyAssignment(q)) names.add(q.name.text); else if (ts.isPropertyAssignment(q)) target(q.initializer); else if (ts.isSpreadAssignment(q)) target(q.expression); });
      else if (ts.isSpreadElement(n) || ts.isParenthesizedExpression(n)) target(n.expression);
    };
    while (stack.length) {
      const n = stack.pop();
      if (ts.isBinaryExpression(n) && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment) target(n.left);
      else if ((ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) && (n.operator === ts.SyntaxKind.PlusPlusToken || n.operator === ts.SyntaxKind.MinusMinusToken)) target(n.operand);
      else if ((ts.isForInStatement(n) || ts.isForOfStatement(n)) && !ts.isVariableDeclarationList(n.initializer)) target(n.initializer);
      ts.forEachChild(n, (c) => { stack.push(c); });
    }
    writtenNames.set(sf, names);
  }
  return !names.has(decl.name.text);
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
    if (fn === 'mkdtempSync' || fn === 'mkdtemp') { const v = vals[0]; return v && (v.t === 'p' || v.t === 'x') ? X(v.v, 'mkdtemp') : null; }
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
      const o = evd(use(args[0]), env);
      if (!o || o.t !== 'o') { give({ k: 'worker', node: args[0] ?? node, note: 'Miniflare options the parser cannot read', byName: desc.byName }, null, lastDeps); return; }
      miniflareOptions(o, give, use, 0);
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
const MF_PERSIST = new Set(['d1Persist', 'kvPersist', 'r2Persist', 'durableObjectsPersist', 'cachePersist', 'defaultPersistRoot', 'workflowsPersist', 'analyticsEngineDatasetsPersist']);
function miniflareOptions(o, give, use, depth) {
  if (depth > 4) return;
  let sawScript = false;
  const walkObj = (obj) => {
    for (const p of obj.node.properties) {
      if (ts.isSpreadAssignment(p)) {
        const s = evd(p.expression, obj.env);
        if (s && s.t === 'o') walkObj(s); else give({ k: 'worker', node: p.expression, note: 'a spread inside Miniflare options that the parser cannot read' }, null, lastDeps);
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
    case ts.SyntaxKind.TemplateExpression: case ts.SyntaxKind.PropertyAccessExpression: pathExpr(node, rel); return;
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

if (ARGV.has('--stats')) {
  const by = {};
  for (const r of REFS) { const k = `${r.k}${r.c ? (r.c === 'x' ? ' [start known]' : ' [computed]') : ''}${r.byName ? ' (by name)' : ''}`; by[k] = (by[k] || 0) + 1; }
  console.log(Object.entries(by).sort().map(([k, v]) => `${String(v).padStart(7)} ${k}`).join('\n'));
  const tk = {};
  for (const r of REFS) if (!r.c) { const k = `${r.k} → ${r.tk}`; tk[k] = (tk[k] || 0) + 1; }
  console.log(Object.entries(tk).sort().map(([k, v]) => `${String(v).padStart(7)} ${k}`).join('\n'));
  console.log(STATS.anchors, 'anchors', STATS.stackErrors.length, 'stack errors', STATS.stackErrors.slice(0, 5));
  fs.writeFileSync('/tmp/claude-0/-home-user-civicsmith-copy/53b72b9b-955f-50e9-89b2-414bb3215ac9/scratchpad/refs.json', JSON.stringify({ REFS, TEXT_REFS, PARTIALS, VIA, UNBOUND }));
}
