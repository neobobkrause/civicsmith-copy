#!/usr/bin/env node
/* signals.mjs: the mechanical signals behind 10-layers.md, and the rule that places each module in a layer.
 *
 * Run from anywhere:   node process/lanes/plane-scope/research/layers/signals.mjs            (prints the table)
 *                      node process/lanes/plane-scope/research/layers/signals.mjs --write    (also writes layers.json beside it)
 *                      node process/lanes/plane-scope/research/layers/signals.mjs --hits <module>   (every signal's first hits)
 *
 * It reads: process/modules/order.txt, process/modules/<name>.json, `git ls-files`, and every owned code file.
 * It parses with the repository's own vendored acorn (bio-plane/src/setup-words/vendor/acorn.mjs, 8.18.0) so that
 * comments are blanked before any pattern is counted: a comment is a lead, not evidence (evidence rule 3).
 * String and template text is kept, because SQL and HTML live in strings.
 * It writes nothing unless --write is given, and then only layers.json beside this file. */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../../..");
const { parse } = await import(path.join(ROOT, "bio-plane/src/setup-words/vendor/acorn.mjs"));

/* ---------- 1. modules and ownership ---------- */
const order = fs.readFileSync(path.join(ROOT, "process/modules/order.txt"), "utf8").trim().split("\n");
const MODS = order.map((name, i) => ({ name, pos: i + 1, ...JSON.parse(fs.readFileSync(path.join(ROOT, "process/modules", name + ".json"), "utf8")) }));
const entries = [];
for (const m of MODS) {
  for (const p of m.files || []) entries.push({ p, mod: m.name, kind: "files" });
  for (const p of m.tests || []) entries.push({ p, mod: m.name, kind: "tests" });
}
const tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, maxBuffer: 1 << 28 }).toString().trim().split("\n");
const matches = (p, f) => (p.endsWith("/") ? f.startsWith(p) : f === p);
/** a file's owner: the module whose listed path matches it most specifically, across `files` and `tests` */
const ownerOf = new Map();
for (const f of tracked) {
  let best = null;
  for (const e of entries) if (matches(e.p, f) && (!best || e.p.length > best.p.length)) best = e;
  if (best) ownerOf.set(f, best);
}

/* generated or vendored code is not scanned: the repository's own language reader leaves the same paths out (process.json) */
const NOT_SCANNED = [/(^|\/)vendor\//, /(^|\/)dist\//, /^release\//, /^newgroup\/src\/release\.mjs$/, /^bio-plane\/src\/case-checker\/program\.mjs$/, /(^|\/)node_modules\//];
const isCode = (f) => /\.(mjs|js|cjs)$/.test(f);
const scanned = (f) => isCode(f) && !NOT_SCANNED.some((re) => re.test(f));

/* ---------- 2. parse: comments blanked, imports read from the tree ---------- */
const FILE = new Map();   /* path -> { text (comments blanked), lines, imports: [{spec, dynamic, line}], parsed } */
function load(f) {
  if (FILE.has(f)) return FILE.get(f);
  let src;
  try { src = fs.readFileSync(path.join(ROOT, f), "utf8"); } catch { FILE.set(f, null); return null; }
  const comments = [];
  let ast = null, parsed = "module";
  const opts = { ecmaVersion: "latest", allowHashBang: true, locations: true, allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true, onComment: (b, t, s, e) => comments.push([s, e]) };
  try { ast = parse(src, { ...opts, sourceType: "module" }); }
  catch { comments.length = 0; try { ast = parse(src, { ...opts, sourceType: "script" }); parsed = "script"; } catch { ast = null; parsed = "no"; comments.length = 0; } }
  let text = src;
  if (comments.length) {
    const a = src.split("");
    for (const [s, e] of comments) for (let i = s; i < e; i++) if (a[i] !== "\n") a[i] = " ";
    text = a.join("");
  }
  const imports = [];
  if (ast) {
    const walk = (n) => {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) { for (const x of n) walk(x); return; }
      if (typeof n.type === "string") {
        if ((n.type === "ImportDeclaration" || n.type === "ExportNamedDeclaration" || n.type === "ExportAllDeclaration") && n.source && typeof n.source.value === "string")
          imports.push({ spec: n.source.value, dynamic: false, line: n.loc.start.line });
        if (n.type === "ImportExpression") imports.push({ spec: n.source && n.source.type === "Literal" ? String(n.source.value) : null, dynamic: true, line: n.loc.start.line });
      }
      for (const k in n) if (k !== "loc" && k !== "start" && k !== "end") { const v = n[k]; if (v && typeof v === "object") walk(v); }
    };
    walk(ast);
  }
  const rec = { text, lines: src.split("\n").length, imports, parsed, shebang: src.startsWith("#!") };
  FILE.set(f, rec);
  return rec;
}
const trackedSet = new Set(tracked);
function resolveImport(from, spec) {
  if (!spec || !(spec.startsWith("./") || spec.startsWith("../"))) return null;
  const p = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  if (trackedSet.has(p)) return p;
  for (const ext of [".mjs", ".js", "/index.mjs"]) if (trackedSet.has(p + ext)) return p + ext;
  return p;   /* a path that is not tracked (a build output, an upload part) */
}

/* ---------- 3. the patterns ---------- */
/* Each is counted over the comment-blanked text of a module's owned, scanned code files (its `files` paths, never its tests). */
const P = {
  /* the record */
  create_table: /\bCREATE\s+(?:VIRTUAL\s+)?TABLE\b/g,
  alter_table: /\bALTER\s+TABLE\b/g,
  migrate_def: /\bfunction\s+migrate\w*\s*\(|^\s*(?:async\s+)?migrate\w*\s*\([^)\n]*\)\s*\{/gm,
  sql_exec: /sql\.exec\(|\bdb\.exec\(|\btransactionSync\(/g,
  sql_write_text: /\bINSERT\s+(?:OR\s+\w+\s+)?INTO\b|\bDELETE\s+FROM\b|\bUPDATE\s+\w+\s+SET\b/g,
  /* answers requests */
  declared_ops: /\bexport\s+const\s+DECLARED_OPS\b/g,
  ops_map: /\bexport\s+(?:async\s+)?function\s+\w+Ops\s*\(|\bexport\s+const\s+\w+Ops\s*=/g,
  /* requests and responses */
  new_response: /\bnew\s+Response\(|\bResponse\.(?:json|redirect)\(/g,
  new_request: /\bnew\s+Request\(/g,
  pathname: /\.pathname\b/g,
  headers: /\bheaders\.(?:get|set|append|has|delete)\(|\bnew\s+Headers\(/g,
  cookie: /cookie/gi,
  search_params: /\bsearchParams\b/g,
  fetch_out: /(?<![.\w#$])fetch\(\s*(?!req\b|request\b|\))/g,          /* a call of the global fetch: the network */
  fetch_stub: /\.fetch\(/g,                                            /* a call of a binding's or a stub's fetch */
  fetch_handler: /\basync\s+fetch\s*\(\s*(?:req|request)\w*|\bexport\s+default\s*\{/g,   /* a fetch handler, or a Worker's default export */
  /* what a member sees */
  screens_export: /\bexport\s+const\s+SCREENS\b/g,
  html_tags: /<(?:!doctype|html|head|body|div|span|p|a|ul|ol|li|section|article|nav|header|footer|main|button|input|select|textarea|form|label|table|tr|td|th|h[1-6]|svg|script|style|link|meta|details|summary|img)(?=[\s>])/gi,
  dom: /\bdocument\.|\bquerySelector(?:All)?\(|\baddEventListener\(|\b(?:local|session)Storage\b|\binnerHTML\b|\bgetElementById\(/g,
  css: /text\/css|<style\b/g,
  html_type: /text\/html/g,
  /* words */
  word_calls: /(?<![.\w#$])(?:word|localize|hasWord)\(/g,
  /* the hosting platform */
  cf_import: /["']cloudflare:[a-z]+["']/g,
  platform_class: /\bextends\s+(?:DurableObject|WorkerEntrypoint|Container)\b/g,
  alarm: /\b(?:setAlarm|getAlarm|deleteAlarm)\(/g,
  wait_until: /\bwaitUntil\(/g,
  id_from: /\b(?:idFromName|idFromString|newUniqueId)\(/g,
  storage_handle: /\bctx\.storage\b|\bstorage\.sql\b/g,
  /* tooling */
  process_cli: /\bprocess\.(?:argv|exit|cwd|stdout|stderr|stdin)\b/g,
};
const ENV_NAME = /\benv\??\.([A-Z][A-Z0-9_]{2,})\b/g;
const NODE_IMPORT = /^node:/;

function lineOf(text, index) { let n = 1; for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) n++; return n; }
function lineText(f, n) { return (fs.readFileSync(path.join(ROOT, f), "utf8").split("\n")[n - 1] || "").trim(); }

/* ---------- 4. per-module signals ---------- */
const OUT = [];
const fileSignals = new Map();
for (const m of MODS) {
  const owned = tracked.filter((f) => ownerOf.get(f)?.mod === m.name && ownerOf.get(f).kind === "files");
  const code = owned.filter(scanned);
  const skipped = owned.filter((f) => isCode(f) && !scanned(f));
  const ext = {};
  for (const f of owned) { const e = (f.match(/\.[A-Za-z0-9]+$/) || ["(none)"])[0].toLowerCase(); ext[e] = (ext[e] || 0) + 1; }
  const sig = {}; const hits = {};
  for (const k of Object.keys(P)) { sig[k] = 0; hits[k] = []; }
  const env = new Map(); const node = new Set(); const pkgs = new Set(); const cf = new Set();
  const importsMods = new Map(); let lines = 0; let dynamicNonLiteral = 0; let shebangs = 0; let unparsed = [];
  for (const f of code) {
    const r = load(f); if (!r) continue;
    lines += r.lines; if (r.shebang) shebangs++; if (r.parsed === "no") unparsed.push(f);
    const per = {};
    for (const [k, re] of Object.entries(P)) {
      re.lastIndex = 0; let mm; let c = 0;
      while ((mm = re.exec(r.text))) { c++; if (hits[k].length < 400) hits[k].push({ file: f, index: mm.index }); if (mm[0] === "") re.lastIndex++; }
      sig[k] += c; per[k] = c;
    }
    fileSignals.set(f, per);
    ENV_NAME.lastIndex = 0; let e;
    while ((e = ENV_NAME.exec(r.text))) { if (!env.has(e[1])) env.set(e[1], { file: f, index: e.index }); }
    for (const im of r.imports) {
      if (im.spec === null) { dynamicNonLiteral++; continue; }
      if (NODE_IMPORT.test(im.spec)) { node.add(im.spec); continue; }
      if (/^cloudflare:/.test(im.spec)) { cf.add(im.spec); continue; }
      const to = resolveImport(f, im.spec);
      if (!to) { pkgs.add(im.spec); continue; }
      const o = ownerOf.get(to);
      const tm = o ? o.mod : "(unowned:" + to + ")";
      if (tm !== m.name && !importsMods.has(tm)) importsMods.set(tm, { file: f, line: im.line, to, dynamic: im.dynamic });
    }
  }
  OUT.push({ name: m.name, pos: m.pos, owned: owned.length, code: code.length, lines, skipped, ext, sig, hits, env, node: [...node].sort(), pkgs: [...pkgs].sort(), cf: [...cf].sort(),
    importsMods, dynamicNonLiteral, shebangs, unparsed, codeFiles: code,
    wrangler: owned.filter((f) => /(^|\/)wrangler\.(jsonc|toml)$/.test(f)), dockerfiles: owned.filter((f) => /(^|\/)Dockerfile/.test(f)),
    wordFiles: owned.filter((f) => /(^|\/)(words|rows)[^/]*\.(mjs|json)$/.test(f)),
    assets: owned.filter((f) => /\.(html|css|svg|woff2|png|jpg|ico)$/i.test(f)).length });
}
const BY = new Map(OUT.map((o) => [o.name, o]));

/* ---------- 5. which deployable's program holds each file (static and literal dynamic imports, from each entry) ---------- */
const ENTRIES = {
  "plane": ["bio-plane/src/plane/index.mjs"],
  "pdf-worker": ["pdf-worker/src/index.mjs"],
  "ocr-worker": ["ocr-worker/src/index.mjs"],
  "sheet-worker": ["sheet-worker/src/index.mjs"],
  "file-scanner": ["file-scanner/src/worker.mjs", "file-scanner/container/scanner.mjs", "file-scanner/container/renderer.mjs"],
  "agent-worker": ["agent-worker/src/index.mjs"],
  "agent-runner": ["agent-runner/src/worker.mjs", "agent-runner/src/entry.mjs"],
  "newgroup": ["newgroup/src/index.mjs"],
  "site": ["site/src/index.mjs"],
  "stewards": ["stewards/src/index.mjs"],
};
const CLOSURE = {};
for (const [name, starts] of Object.entries(ENTRIES)) {
  const seen = new Set(); const stack = [...starts];
  while (stack.length) {
    const f = stack.pop(); if (seen.has(f) || !trackedSet.has(f) || !isCode(f)) continue;
    seen.add(f);
    if (!scanned(f)) continue;   /* a generated file is held, and not walked through */
    const r = load(f); if (!r) continue;
    for (const im of r.imports) { const to = resolveImport(f, im.spec); if (to) stack.push(to); }
  }
  CLOSURE[name] = seen;
}
for (const o of OUT) {
  o.held = {};
  const all = tracked.filter((f) => ownerOf.get(f)?.mod === o.name && ownerOf.get(f).kind === "files" && isCode(f));
  for (const [name, set] of Object.entries(CLOSURE)) { const n = all.filter((f) => set.has(f)).length; if (n) o.held[name] = n; }
  o.allCode = all.length;
  o.heldFiles = (which) => all.filter((f) => CLOSURE[which].has(f));
  o.notHeldFiles = (which) => all.filter((f) => !CLOSURE[which].has(f));
}
/* importers: the modules whose owned code imports this module's files */
for (const o of OUT) o.importedBy = [];
for (const o of OUT) for (const tm of o.importsMods.keys()) if (BY.has(tm)) BY.get(tm).importedBy.push(o.name);

/* ---------- 6. the layer rule (stated in 10-layers.md, "The layers as rules") ---------- */
/* Group signals. A count is a signal when it is above zero, except where a floor is stated. */
function groups(o) {
  const s = o.sig;
  const g = {};
  g.inPlane = o.held.plane || 0;                                   /* code files the plane's program holds */
  g.inOther = Object.keys(o.held).filter((k) => k !== "plane");    /* other deployables whose program holds some of it */
  g.ownDeployable = o.wrangler.length > 0 || o.dockerfiles.length > 0;
  g.tables = s.create_table + s.alter_table;
  g.rows = s.sql_exec;
  g.ops = s.declared_ops + s.ops_map;
  g.http = s.new_response + s.new_request;
  g.route = s.pathname;
  g.screens = s.screens_export;
  g.html = s.html_tags;
  g.dom = s.dom;
  g.words = s.word_calls;
  g.platformClass = s.platform_class + s.cf_import;
  g.alarm = s.alarm;
  g.env = [...o.env.keys()];
  g.node = o.node;
  g.cli = s.process_cli + o.shebangs;
  g.fetchOut = s.fetch_out;
  g.fetchStub = s.fetch_stub;
  return g;
}

/* The placement itself is a table kept here, one row per module, written after reading each module's code; the rule in
   10-layers.md says which signals decide each layer, and `check()` below refuses a row that the signals contradict. */
const PLACE = {};

/* ---------- 7. output ---------- */
const args = process.argv.slice(2);
const first = (o, k) => { const h = o.hits[k][0]; if (!h) return null; const r = load(h.file); const n = lineOf(r.text, h.index); return { file: h.file, line: n, text: lineText(h.file, n) }; };
if (args[0] === "--hits") {
  const o = BY.get(args[1]); if (!o) { console.error("no such module"); process.exit(1); }
  const max = Number(args[2] || 6);
  for (const k of Object.keys(P)) {
    if (!o.sig[k]) continue;
    console.log(`\n## ${k}: ${o.sig[k]}`);
    for (const h of o.hits[k].slice(0, max)) { const r = load(h.file); const n = lineOf(r.text, h.index); console.log(`  ${h.file}:${n}: ${lineText(h.file, n).slice(0, 220)}`); }
  }
  console.log("\nenv:", [...o.env.keys()].join(" "));
  console.log("node:", o.node.join(" "), "| cloudflare:", o.cf.join(" "), "| packages:", o.pkgs.join(" "));
  console.log("held by:", JSON.stringify(o.held), "of", o.allCode, "code files; not scanned:", o.skipped.join(" "));
  console.log("imports modules:", [...o.importsMods.keys()].join(" "));
  console.log("imported by:", o.importedBy.join(" "));
  process.exit(0);
}
const rows = OUT.map((o) => {
  const g = groups(o);
  return { pos: o.pos, module: o.name, owned: o.owned, code: o.code, lines: o.lines, in_plane: g.inPlane, all_code: o.allCode, held_by_other: g.inOther,
    own_deployable: g.ownDeployable, create_table: o.sig.create_table, alter_table: o.sig.alter_table, migrate_def: o.sig.migrate_def, sql_exec: o.sig.sql_exec, sql_write_text: o.sig.sql_write_text,
    declared_ops: o.sig.declared_ops, ops_map: o.sig.ops_map, new_response: o.sig.new_response, new_request: o.sig.new_request, pathname: o.sig.pathname, headers: o.sig.headers,
    cookie: o.sig.cookie, search_params: o.sig.search_params, fetch_out: o.sig.fetch_out, fetch_stub: o.sig.fetch_stub, fetch_handler: o.sig.fetch_handler,
    screens_export: o.sig.screens_export, html_tags: o.sig.html_tags, dom: o.sig.dom, css: o.sig.css, html_type: o.sig.html_type, asset_files: o.assets,
    word_calls: o.sig.word_calls, word_files: o.wordFiles.length, cf_import: o.sig.cf_import, platform_class: o.sig.platform_class, alarm: o.sig.alarm, wait_until: o.sig.wait_until,
    id_from: o.sig.id_from, storage_handle: o.sig.storage_handle, env: g.env, node: o.node, process_cli: o.sig.process_cli, shebangs: o.shebangs,
    imports_modules: o.importsMods.size, imported_by: o.importedBy.length, not_scanned: o.skipped.length, unparsed: o.unparsed.length };
});
if (args.includes("--signals-json")) { console.log(JSON.stringify(rows)); process.exit(0); }
if (args[0] === "--dump") {
  /* everything, with each signal's first hits as file:line:text, for querying without parsing again */
  const dump = OUT.map((o) => ({ name: o.name, pos: o.pos, owned: o.owned, code: o.code, allCode: o.allCode, lines: o.lines, sig: o.sig, held: o.held, env: [...o.env.keys()],
    envAt: Object.fromEntries([...o.env].map(([k, h]) => { const r = load(h.file); const n = lineOf(r.text, h.index); return [k, `${h.file}:${n}`]; })),
    node: o.node, cf: o.cf, pkgs: o.pkgs, wrangler: o.wrangler, dockerfiles: o.dockerfiles, wordFiles: o.wordFiles, assets: o.assets, shebangs: o.shebangs, skipped: o.skipped, unparsed: o.unparsed,
    notInPlane: o.notHeldFiles("plane"), ext: o.ext,
    imports: Object.fromEntries([...o.importsMods].map(([k, v]) => [k, `${v.file}:${v.line}${v.dynamic ? " (dynamic)" : ""}`])), importedBy: o.importedBy, dynamicNonLiteral: o.dynamicNonLiteral,
    hits: Object.fromEntries(Object.keys(P).map((k) => [k, o.hits[k].slice(0, 12).map((h) => { const r = load(h.file); const n = lineOf(r.text, h.index); return `${h.file}:${n}: ${lineText(h.file, n).slice(0, 240)}`; })])) }));
  fs.writeFileSync(args[1], JSON.stringify(dump));
  process.exit(0);
}
console.log("pos module in_plane/all tables rows ops http route screens html dom words platform alarm env# node# cli fetchOut fetchStub");
for (const o of OUT) {
  const g = groups(o);
  console.log([o.pos, o.name, `${g.inPlane}/${o.allCode}`, g.tables, g.rows, g.ops, g.http, g.route, g.screens, g.html, g.dom, g.words, g.platformClass, g.alarm, g.env.length, g.node.length, g.cli, g.fetchOut, g.fetchStub].join(" "));
}
export { OUT, BY, MODS, groups, first, load, lineOf, lineText, CLOSURE, ownerOf, PLACE, ROOT, P };
