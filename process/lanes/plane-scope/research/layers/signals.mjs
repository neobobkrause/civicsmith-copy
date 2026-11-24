#!/usr/bin/env node
/* signals.mjs: the mechanical signals behind ../10-layers.md, the rule that places each module in a layer, and the table
 * of what was read for each module.
 *
 *   S = node process/lanes/plane-scope/research/layers/signals.mjs
 *   S                      the signal table, one row per module
 *   S --patterns           each pattern whole, with its counts
 *   S --layers             the placement, one row per module, with the line read (and an ambiguous module's parts)
 *   S --table              the compact table of ../10-layers.md
 *   S --importers          for each module placed by its importers (rule P): the layers and modules that import it
 *   S --fanout [n]         the plane-held files that import from the most other modules
 *   S --facts              what crosses the layers: who imports the UI, words, HTML, env bindings, platform calls, shared programs
 *   S --sizes              lines of plane-held code by layer, and each ambiguous module's parts
 *   S --order              the layers in the current order, and every inversion, by the owner's stacking and by today's
 *   S --hits <module> [n]  each signal's first n hits in a module
 *   S --write              writes layers.json beside this file
 *   S --dump <path>        everything, as JSON (a .json file in this folder, or under a scratchpad folder of the temporary directory)
 *
 * It reads process/modules/order.txt, process/modules/<name>.json, `git ls-files`, and every owned code file. It parses
 * with the repository's own vendored acorn (bio-plane/src/setup-words/vendor/acorn.mjs, 8.18.0), so comments are blanked
 * before any pattern is counted: a comment is a lead, not evidence. String and template text is kept, because SQL and
 * HTML live in strings. It writes nothing but layers.json (--write) or the dump (--dump). */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../../..");
const args = process.argv.slice(2);

/** The only places this script writes: a .json file directly in this folder, or under a `scratchpad` folder of the
 *  system's temporary directory. Checked before any work, so a bare name or a path in the working tree is refused at once. */
function safeOut(p) {
  if (typeof p !== "string" || p === "") { console.error("signals.mjs: a path is needed"); process.exit(2); }
  const abs = path.resolve(p);
  const tmp = path.resolve(os.tmpdir());
  const inHere = path.dirname(abs) === HERE;
  const inScratch = abs.startsWith(tmp + path.sep) && abs.split(path.sep).includes("scratchpad");
  if (!abs.endsWith(".json") || !(inHere || inScratch)) {
    console.error(`signals.mjs: refused to write ${abs}: output goes to a .json file in ${HERE} or under a scratchpad folder of ${tmp}`);
    process.exit(2);
  }
  return abs;
}
const DUMP_TO = args[0] === "--dump" ? safeOut(args[1]) : null;
const WRITE_TO = args.includes("--write") ? safeOut(path.join(HERE, "layers.json")) : null;

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
const trackedSet = new Set(tracked);
const matches = (p, f) => (p.endsWith("/") ? f.startsWith(p) : f === p);
/** a file's owner: the module whose listed path matches it most specifically, across `files` and `tests` */
const ownerOf = new Map();
for (const f of tracked) {
  let best = null;
  for (const e of entries) if (matches(e.p, f) && (!best || e.p.length > best.p.length)) best = e;
  if (best) ownerOf.set(f, best);
}
const modOf = (f) => { const o = ownerOf.get(f); return o && o.kind === "files" ? o.mod : null; };

/* generated or vendored code is not scanned: the repository's own language reader leaves the same paths out (process.json) */
const NOT_SCANNED = [/(^|\/)vendor\//, /(^|\/)dist\//, /^release\//, /^newgroup\/src\/release\.mjs$/, /^bio-plane\/src\/case-checker\/program\.mjs$/, /(^|\/)node_modules\//];
const isCode = (f) => /\.(mjs|js|cjs)$/.test(f);
const scanned = (f) => isCode(f) && !NOT_SCANNED.some((re) => re.test(f));

/* ---------- 2. parse: comments blanked, imports read from the tree ---------- */
const FILE = new Map();   /* path -> { text (comments blanked), lines, imports: [{spec, dynamic, line, names}], parsed } */
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
          imports.push({ spec: n.source.value, dynamic: false, line: n.loc.start.line,
            names: (n.specifiers || []).map((s) => (s.imported && s.imported.name) || (s.local && s.local.name) || "*") });
        if (n.type === "ImportExpression") imports.push({ spec: n.source && n.source.type === "Literal" ? String(n.source.value) : null, dynamic: true, line: n.loc.start.line, names: [] });
      }
      for (const k in n) if (k !== "loc" && k !== "start" && k !== "end") { const v = n[k]; if (v && typeof v === "object") walk(v); }
    };
    walk(ast);
  }
  const rec = { text, src, lines: src.split("\n").length, imports, parsed, shebang: src.startsWith("#!") };
  FILE.set(f, rec);
  return rec;
}
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
  sql_exec: /sql\.exec\(|\bdb\.exec\(|\btransactionSync\(/g,                 /* SQL run on the object's storage */
  sql_write_text: /\bINSERT\s+(?:OR\s+\w+\s+)?INTO\b|\bDELETE\s+FROM\b|\bUPDATE\s+\w+\s+SET\b/g,
  /* answers requests */
  declared_ops: /\bexport\s+const\s+DECLARED_OPS\b/g,
  ops_map: /\bexport\s+(?:async\s+)?function\s+(?!\w*Declared)\w+Ops\s*\(|\bexport\s+const\s+(?!\w*Declared)\w+Ops\s*=/g,   /* `<module>Ops(instance, url, body)`: the module's own op handlers, by name */
  /* requests and responses */
  new_response: /\bnew\s+Response\(|\bResponse\.(?:json|redirect)\(/g,
  new_request: /\bnew\s+Request\(/g,
  pathname: /\.pathname\b/g,
  headers: /\bheaders\.(?:get|set|append|has|delete)\(|\bnew\s+Headers\(/g,
  cookie: /cookie/gi,
  search_params: /\bsearchParams\b/g,
  do_call: /https?:\/\/(?:do|x)\//g,                                         /* a request addressed to the object: "http://do/<op>", "http://x/<op>" */
  do_answer: /(?<![\w$])doAnswer\(/g,                                        /* reads the object's answer with answer-envelope's `doAnswer`: a handler that runs at the door, outside the object */
  fleet_call: /https?:\/\/(?:agent-worker|sheet-worker|pdf-worker|ocr-worker|file-scanner|renderer|self)\//g,   /* a request addressed to a fleet member, or to the Worker itself */
  fetch_out: /(?<![.\w#$])(?<!async\s)(?<!function\s)fetch\((?!\s*(?:req|request)\w*\s*[,)])(?!\s*\))/g,   /* a call of the global fetch: the network */
  fetch_stub: /\.fetch\(/g,                                                  /* a call of a binding's or a stub's fetch */
  fetch_handler: /\basync\s+fetch\s*\(\s*(?:req|request)\w*|\bexport\s+default\s*\{/g,   /* a fetch handler, or a Worker's default export */
  /* what a member sees */
  screens_export: /\bexport\s+const\s+SCREENS\b/g,
  html_tags: /<(?:!doctype|html|head|body|div|span|p|a|ul|ol|li|section|article|nav|header|footer|main|button|input|select|textarea|form|label|table|tr|td|th|h[1-6]|svg|script|style|link|meta|details|summary|img)(?=[\s>])/gi,
  dom: /\b(?:document|doc)\.(?:getElementById|querySelector|createElement|body|documentElement|cookie|title|activeElement|addEventListener)\b|\bquerySelector(?:All)?\(|\baddEventListener\(|\b(?:local|session)Storage\b|\binnerHTML\b|\bwin(?:dow)?\.(?:document|location|history|addEventListener|setTimeout|fetch)\b/g,
  asset_bodies: /type:\s*"(?:text\/css|font\/woff2|image\/svg\+xml)"/g,       /* a stylesheet, font or icon body held to be served */
  html_type: /text\/html/g,
  /* words */
  word_calls: /(?<![.\w#$])(?:word|localize|hasWord)\(/g,
  /* the hosting platform */
  cf_import: /["']cloudflare:[a-z]+["']/g,
  platform_class: /\bextends\s+(?:DurableObject|WorkerEntrypoint|Container)\b/g,
  block_start: /\bblockConcurrencyWhile\(/g,                                  /* work handed to the platform's start gate, run before any request */
  alarm_set: /\bsetAlarm\(/g,                                                /* sets the object's alarm */
  alarm_any: /\b(?:setAlarm|getAlarm|deleteAlarm)\(/g,
  wait_until: /\bwaitUntil\(/g,
  id_from: /\b(?:idFromName|idFromString|newUniqueId)\(/g,
  storage_handle: /\bctx\.storage\b|\bstorage\.sql\b/g,
  /* tooling */
  process_cli: /\bprocess\.(?:argv|exit|cwd|stdout|stderr|stdin)\b/g,
  /* for a citation where nothing else decides */
  first_export: /^export\s+(?:default\s+)?(?:async\s+)?(?:const|let|function|class|\{)/gm,
};
const ENV_NAME = /\benv\??\.([A-Z][A-Z0-9_]{2,})\b/g;
const KEYS = Object.keys(P);
const zero = () => Object.fromEntries(KEYS.map((k) => [k, 0]));

function lineOf(text, index) { let n = 1; for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) n++; return n; }
function lineText(f, n) { const r = load(f); return ((r ? r.src : "").split("\n")[n - 1] || "").trim(); }

/* ---------- 4. per-file signals and import edges ---------- */
const FSIG = new Map();    /* file -> { sig, hits: {k: [index]}, env: Map(name -> index), edges: [{to, toMod, line, names, dynamic}], node, cf, pkgs, dynamicNonLiteral } */
function fileSignals(f) {
  if (FSIG.has(f)) return FSIG.get(f);
  const r = load(f);
  const rec = { sig: zero(), hits: {}, env: new Map(), edges: [], node: [], cf: [], pkgs: [], dynamicNonLiteral: 0, lines: r ? r.lines : 0, shebang: !!(r && r.shebang), parsed: r ? r.parsed : "no" };
  if (r) {
    for (const k of KEYS) {
      const re = P[k]; re.lastIndex = 0; let mm; const hs = [];
      while ((mm = re.exec(r.text))) { hs.push(mm.index); if (mm[0] === "") re.lastIndex++; }
      rec.sig[k] = hs.length; rec.hits[k] = hs;
    }
    ENV_NAME.lastIndex = 0; let e;
    while ((e = ENV_NAME.exec(r.text))) if (!rec.env.has(e[1])) rec.env.set(e[1], e.index);
    for (const im of r.imports) {
      if (im.spec === null) { rec.dynamicNonLiteral++; continue; }
      if (/^node:/.test(im.spec)) { rec.node.push(im.spec); continue; }
      if (/^cloudflare:/.test(im.spec)) { rec.cf.push(im.spec); continue; }
      const to = resolveImport(f, im.spec);
      if (!to) { rec.pkgs.push(im.spec); continue; }
      rec.edges.push({ to, toMod: modOf(to), line: im.line, names: im.names, dynamic: im.dynamic });
    }
  }
  FSIG.set(f, rec);
  return rec;
}

/* ---------- 5. which deployable's program holds each file (static and literal dynamic imports, from each entry) ---------- */
const ENTRIES = {
  "plane": ["bio-plane/src/plane/index.mjs"],                       /* bio-plane/wrangler.jsonc "main" */
  "pdf-worker": ["pdf-worker/src/index.mjs"],                       /* each fleet-member.json "entry" / bundle "entry" */
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
    for (const e of fileSignals(f).edges) stack.push(e.to);
  }
  CLOSURE[name] = seen;
}
const inPlane = (f) => CLOSURE.plane.has(f);

/* ---------- 6. per-module signals ---------- */
const OUT = [];
for (const m of MODS) {
  const owned = tracked.filter((f) => ownerOf.get(f)?.mod === m.name && ownerOf.get(f).kind === "files");
  const allCode = owned.filter(isCode);
  const code = owned.filter(scanned);
  const o = { name: m.name, pos: m.pos, owned: owned.length, allCode: allCode.length, code, skipped: allCode.filter((f) => !scanned(f)),
    planeFiles: code.filter(inPlane), restFiles: code.filter((f) => !inPlane(f)), held: {}, ext: {},
    sp: zero(), sr: zero(), env: new Map(), node: new Set(), cf: new Set(), pkgs: new Set(), linesPlane: 0, linesRest: 0, shebangs: 0, unparsed: [], dynamicNonLiteral: 0,
    imp: { ops: new Set(), declared: new Set(), screens: new Set(), doorOps: new Set(), mods: new Map() }, importedBy: new Set(),
    wrangler: owned.filter((f) => /(^|\/)wrangler\.(jsonc|toml)$/.test(f)), dockerfiles: owned.filter((f) => /(^|\/)Dockerfile/.test(f)),
    wordFiles: owned.filter((f) => /(^|\/)(words|rows)\.mjs$|(^|\/)words[^/]*\.json$/.test(f)),
    assetFiles: owned.filter((f) => /\.(html|css|svg|woff2|png|jpg|ico)$/i.test(f)).length };
  for (const f of owned) { const e = (f.match(/\.[A-Za-z0-9]+$/) || ["(none)"])[0].toLowerCase(); o.ext[e] = (o.ext[e] || 0) + 1; }
  for (const [name, set] of Object.entries(CLOSURE)) { const n = allCode.filter((f) => set.has(f)).length; if (n) o.held[name] = n; }
  for (const f of code) {
    const s = fileSignals(f); const plane = inPlane(f);
    const into = plane ? o.sp : o.sr;
    for (const k of KEYS) into[k] += s.sig[k];
    if (plane) o.linesPlane += s.lines; else o.linesRest += s.lines;
    if (s.shebang) o.shebangs++; if (s.parsed === "no") o.unparsed.push(f); o.dynamicNonLiteral += s.dynamicNonLiteral;
    for (const [k, i] of s.env) if (!o.env.has(k)) o.env.set(k, { file: f, index: i, plane });
    for (const n of s.node) o.node.add(n); for (const n of s.cf) o.cf.add(n); for (const n of s.pkgs) o.pkgs.add(n);
    for (const e of s.edges) {
      if (!e.toMod || e.toMod === m.name) continue;
      if (!o.imp.mods.has(e.toMod)) o.imp.mods.set(e.toMod, { file: f, line: e.line, to: e.to });
      if (!plane) continue;
      for (const n of e.names) {
        if (/Ops$/.test(n) && !/Declared/.test(n)) o.imp.ops.add(e.toMod);
        if (n === "DECLARED_OPS") o.imp.declared.add(e.toMod);
        if (n === "SCREENS") o.imp.screens.add(e.toMod);
        if (/Op(?:Response)?$/.test(n)) o.imp.doorOps.add(e.toMod);
      }
    }
  }
  OUT.push(o);
}
const BY = new Map(OUT.map((o) => [o.name, o]));
for (const o of OUT) for (const tm of o.imp.mods.keys()) if (BY.has(tm)) BY.get(tm).importedBy.add(o.name);
const sum = (o, k) => o.sp[k] + o.sr[k];

/* ---------- 7. the layer rule (stated in ../10-layers.md, "The five layers as rules over the signals") ---------- */
const WANTED = ["model", "middleware", "control-plane", "launcher", "ui"];   /* the owner's stacking, lowest first */
const TODAY = ["model", "middleware", "ui", "control-plane", "launcher"];    /* today's stacking, lowest first */
/* The services bio-plane/wrangler.jsonc binds, and agent-runner, which agent-worker/wrangler.jsonc binds by script_name. */
const FLEET = new Set(["pdf-worker", "agent-worker", "ocr-worker", "sheet-worker", "file-scanner", "agent-runner"]);

/** The layers a module's own code claims, by rule, with the signals that make each claim. Signals are those of the
 *  files the plane's program holds; a module the plane's program holds none of is outside the five. */
function claims(o) {
  const s = o.sp; const c = [];
  if (!o.planeFiles.length) return [{ layer: "outside", why: [`plane's program holds 0 of ${o.allCode} code files`] }];
  if (o.wrangler.length && o.name !== "plane") return [{ layer: "outside", why: [`owns ${o.wrangler[0]}`, `plane's program also holds ${o.planeFiles.length} of its ${o.allCode} code files`] }];
  if (s.screens_export || s.html_tags >= 50 || s.asset_bodies)
    c.push({ layer: "ui", why: [s.screens_export && `screens_export=${s.screens_export}`, s.html_tags >= 50 && `html_tags=${s.html_tags}`, s.dom && `dom=${s.dom}`, s.asset_bodies && `asset_bodies=${s.asset_bodies}`].filter(Boolean) });
  if (s.cf_import || s.platform_class || s.block_start)
    c.push({ layer: "launcher", why: [s.cf_import && `cf_import=${s.cf_import}`, s.platform_class && `platform_class=${s.platform_class}`, s.block_start && `block_start=${s.block_start}`].filter(Boolean) });
  if (o.imp.screens.size)
    c.push({ layer: "control-plane", why: [`imports SCREENS of ${o.imp.screens.size} modules`, `pathname=${s.pathname}`, `new_response=${s.new_response}`] });
  if (o.imp.ops.size >= 2 || o.imp.declared.size >= 2 || o.imp.doorOps.size >= 2 || s.do_answer || s.alarm_set)
    c.push({ layer: "middleware", why: [o.imp.ops.size >= 2 && `imports the ops maps of ${o.imp.ops.size} other modules`, o.imp.declared.size >= 2 && `imports DECLARED_OPS of ${o.imp.declared.size} other modules`,
      o.imp.doorOps.size >= 2 && `imports the door handlers (…Op) of ${o.imp.doorOps.size} other modules`, s.do_answer && `do_answer=${s.do_answer}`, s.alarm_set && `alarm_set=${s.alarm_set}`].filter(Boolean) });
  if (s.create_table + s.alter_table || s.sql_exec || s.ops_map)
    c.push({ layer: "model", why: [(s.create_table + s.alter_table) && `create/alter_table=${s.create_table + s.alter_table}`, s.sql_exec && `sql_exec=${s.sql_exec}`, s.ops_map && `ops_map=${s.ops_map}`].filter(Boolean) });
  return c;
}

/* ---------- 8. what was read: one row per module ---------- */
/* READ[name] = { cite: "file:line", layer?, sub?, parts?: [[layer, [file...], "file:line"]], note?, override?: "why the rule's claim is set aside" }
   `layer` is given only where reading sets a rule's claim aside (override) or settles a module the rule leaves to its importers. */
const READ = readRows();   /* the table is at the end of the file (a hoisted function): it is long */

/* ---------- 9. output helpers ---------- */
const firstHit = (o, k, planeOnly = true) => {
  for (const f of (planeOnly && o.planeFiles.length ? o.planeFiles : o.code)) { const s = fileSignals(f); if (s.sig[k]) { const n = lineOf(load(f).text, s.hits[k][0]); return { file: f, line: n, text: lineText(f, n) }; } }
  return null;
};
function hitsOf(o, k, max) {
  const out = [];
  for (const f of o.code) { const s = fileSignals(f); for (const i of s.hits[k] || []) { if (out.length >= max) return out; const n = lineOf(load(f).text, i); out.push(`${f}:${n}: ${lineText(f, n).slice(0, 230)}`); } }
  return out;
}
const SHOWN = KEYS.filter((k) => k !== "first_export");
function row(o) {
  return { pos: o.pos, module: o.name, owned: o.owned, code: o.code.length, in_plane: o.planeFiles.length, lines_plane: o.linesPlane, lines_rest: o.linesRest, held: o.held,
    ...Object.fromEntries(SHOWN.map((k) => [k, o.sp[k] + (o.sr[k] ? "+" + o.sr[k] : "")])), env: [...o.env.keys()], node: [...o.node].sort(),
    imports_ops_maps: o.imp.ops.size, imports_declared_ops: o.imp.declared.size, imports_screens: o.imp.screens.size, imports_door_ops: o.imp.doorOps.size,
    imports_modules: o.imp.mods.size, imported_by: o.importedBy.size, word_files: o.wordFiles.length, wrangler: o.wrangler.length, not_scanned: o.skipped.length };
}

if (args[0] === "--hits") {
  const o = BY.get(args[1]); if (!o) { console.error("no such module"); process.exit(1); }
  const max = Number(args[2] || 5);
  console.log(`# ${o.pos} ${o.name}: owned ${o.owned}; code ${o.code.length} scanned (${o.planeFiles.length} held by the plane's program, ${o.linesPlane} lines; ${o.restFiles.length} not, ${o.linesRest} lines); held ${JSON.stringify(o.held)}`);
  for (const k of SHOWN) { if (!sum(o, k)) continue; console.log(`## ${k}: ${o.sp[k]} in plane-held files, ${o.sr[k]} in the rest`); for (const h of hitsOf(o, k, max)) console.log("   " + h); }
  console.log("env:", [...o.env.keys()].join(" "), "| node:", [...o.node].join(" "), "| cloudflare:", [...o.cf].join(" "), "| packages:", [...o.pkgs].join(" "));
  console.log("imports ops maps of:", [...o.imp.ops].join(" "), "| DECLARED_OPS of:", o.imp.declared.size, "| SCREENS of:", [...o.imp.screens].join(" "), "| door handlers of:", [...o.imp.doorOps].join(" "));
  console.log("not held by the plane's program:", o.restFiles.join(" "), "| not scanned:", o.skipped.join(" "));
  console.log("imports:", [...o.imp.mods.keys()].join(" "));
  console.log("imported by:", [...o.importedBy].join(" "));
  console.log("claims by rule:", JSON.stringify(claims(o)));
  process.exit(0);
}
if (DUMP_TO) {
  fs.writeFileSync(DUMP_TO, JSON.stringify(OUT.map((o) => ({ ...row(o), claims: claims(o), planeFiles: o.planeFiles, restFiles: o.restFiles, skipped: o.skipped, imports: [...o.imp.mods.keys()], importedBy: [...o.importedBy],
    imp: { ops: [...o.imp.ops], declared: [...o.imp.declared], screens: [...o.imp.screens], doorOps: [...o.imp.doorOps] },
    perFile: Object.fromEntries(o.code.map((f) => [f, { plane: inPlane(f), lines: fileSignals(f).lines, ...Object.fromEntries(Object.entries(fileSignals(f).sig).filter(([k, v]) => v && k !== "first_export")) }])),
    hits: Object.fromEntries(KEYS.map((k) => [k, hitsOf(o, k, 8)])) }))));
  process.exit(0);
}
if (!args.length) {
  console.log("pos module | in_plane/code | create+alter sql_exec ops_map declared_ops | new_response new_request do_answer do_call fleet_call fetch_out | screens html dom assets | words | cf class block alarm_set | env# | X:ops X:declared X:screens X:doorOps");
  for (const o of OUT) { const s = o.sp, t = (k) => s[k] + (o.sr[k] ? "+" + o.sr[k] : "");
    console.log([o.pos, o.name, "|", `${o.planeFiles.length}/${o.code.length}`, "|", s.create_table + s.alter_table + (o.sr.create_table + o.sr.alter_table ? "+" + (o.sr.create_table + o.sr.alter_table) : ""), t("sql_exec"), t("ops_map"), t("declared_ops"), "|",
      t("new_response"), t("new_request"), t("do_answer"), t("do_call"), t("fleet_call"), t("fetch_out"), "|", t("screens_export"), t("html_tags"), t("dom"), t("asset_bodies"), "|", t("word_calls"), "|",
      t("cf_import"), t("platform_class"), t("block_start"), t("alarm_set"), "|", o.env.size, "|", o.imp.ops.size, o.imp.declared.size, o.imp.screens.size, o.imp.doorOps.size].join(" ")); }
  process.exit(0);
}

/* ---------- 10. placement ---------- */
const PLACED = new Map();
const partOfFile = (pl, f) => { if (!pl.parts) return pl.layer; for (const p of pl.parts) if (p.files.includes(f)) return p.layer; return pl.parts[0].layer; };
/* first pass: every module whose own code claims a layer, and every module outside the plane's program */
for (const o of OUT) {
  const c = claims(o); const rd = READ[o.name] || {};
  let layers = c.map((x) => x.layer);
  let rule = "signals";
  if (rd.layers) { layers = rd.layers; rule = "read (override of the rule's claim): " + rd.override; }
  if (!layers.length) continue;   /* left to its importers, below */
  const pl = { layers, rule, claims: c };
  if (layers.length === 1) pl.layer = layers[0];
  else {
    /* the parts of a module that claims two layers: the files named in READ, the rest to the first part */
    const named = rd.parts || {};
    const rest = layers.find((l) => !named[l] || named[l].rest) || layers[layers.length - 1];
    pl.parts = layers.map((l) => ({ layer: l, files: [], cite: named[l] && named[l].cite, what: named[l] && named[l].what }));
    for (const f of o.planeFiles) {
      let l = rest;
      for (const [k, v] of Object.entries(named)) if ((v.files || []).some((x) => f === x || f.endsWith("/" + x))) l = k;
      pl.parts.find((p) => p.layer === l).files.push(f);
    }
    for (const p of pl.parts) p.lines = p.files.reduce((n, f) => n + fileSignals(f).lines, 0);
  }
  PLACED.set(o.name, pl);
}
/* The assembly files: the plane-held files that import from 80 or more other modules (`--fanout` lists them: three, the next
   file imports from 32). They import to assemble or to list, not to use, so they do not count as users in rule P. */
const ASSEMBLY_FILES = new Set();
for (const o of OUT) for (const f of o.planeFiles) if (new Set(fileSignals(f).edges.map((e) => e.toMod).filter((m) => m && m !== o.name)).size >= 80) ASSEMBLY_FILES.add(f);
/* second pass (rule P): a module whose own code claims no layer is placed by the plane-held files that import it, later modules first */
const idx = (l) => WANTED.indexOf(l);
for (const o of [...OUT].reverse()) {
  if (PLACED.has(o.name)) continue;
  const set = new Set(); const inherited = new Set(); const via = [];
  const mine = new Set(o.planeFiles);
  for (const u of OUT) {
    if (u.name === o.name) continue;
    for (const f of u.planeFiles) {
      if (ASSEMBLY_FILES.has(f)) continue;
      if (!fileSignals(f).edges.some((e) => mine.has(e.to))) continue;
      const pu = PLACED.get(u.name); if (!pu) continue;
      /* a user placed by its own importers counts as the layer it was placed in; a shared foundation has none, and hands on its
         own users' layers only when the module has no other user */
      if (pu.rule.startsWith("importers") && pu.sub === "shared-foundation") { for (const l of pu.importerLayers) inherited.add(l); via.push(u.name + ":(shared)"); continue; }
      const l = pu.layers.length > 1 ? partOfFile(pu, f) : pu.layer;
      if (idx(l) >= 0) set.add(l);
      via.push(u.name + ":" + l);
    }
  }
  const layers = [...(set.size ? set : inherited)].sort((a, b) => idx(a) - idx(b));
  const rd = READ[o.name] || {};
  const pl = { rule: "importers", importerLayers: layers, importers: [...new Set(via)], claims: [] };
  if (!layers.length) { pl.layer = "unplaced"; pl.layers = ["unplaced"]; }
  else if (layers.includes("model") && layers.length >= 3) { pl.layer = "outside"; pl.sub = "shared-foundation"; pl.layers = ["outside"]; }
  else { pl.layer = layers[0]; pl.layers = [layers[0]]; }
  if (rd.layers) { pl.layers = rd.layers; pl.layer = rd.layers.length === 1 ? rd.layers[0] : undefined; pl.rule = "read (override): " + rd.override; if (rd.sub) pl.sub = rd.sub; }
  PLACED.set(o.name, pl);
}
/* sublayers */
for (const o of OUT) {
  const pl = PLACED.get(o.name); const s = o.sp; const rd = READ[o.name] || {};
  const io = s.new_response + s.new_request + s.fetch_out + s.fleet_call + s.fetch_stub + [...o.env.values()].filter((e) => e.plane).length > 0;
  if (rd.sub) pl.sub = rd.sub;
  if (pl.sub) continue;
  if (pl.layers.length > 1) { pl.sub = pl.layers.join(" + "); continue; }
  if (pl.rule === "importers") { pl.sub = io ? "no table, no op: reaches outside" : "pure"; continue; }
  if (pl.layer === "model") pl.sub = s.create_table + s.alter_table ? "tables" : s.sql_exec ? "rows of other modules' tables" : "ops only";
  else if (pl.layer === "ui") pl.sub = s.screens_export ? "screens" : s.asset_bodies ? "assets" : s.dom >= 50 ? "shell" : "screen parts";
  else if (pl.layer === "middleware") pl.sub = o.imp.ops.size >= 2 ? "dispatch" : s.alarm_set ? "alarm" : "request and answer";
  else if (pl.layer === "outside") {
    const holders = Object.keys(o.held);
    pl.sub = o.wrangler.length ? (FLEET.has(o.name) ? "fleet-member" : "other-deployable")
      : holders.length ? (holders.every((h) => FLEET.has(h)) ? "fleet-library" : "other-deployable") : "tooling";
  } else pl.sub = pl.layer;
}

/* ---------- 11. the citation ---------- */
function citeOf(spec) { if (!spec) return null; const m = /^(.*):(\d+)$/.exec(spec); if (!m) return null; return { file: m[1], line: Number(m[2]), text: lineText(m[1], Number(m[2])), chosen: "by hand" }; }
function autoCite(o, layer) {
  const tryKeys = (ks, planeOnly = true) => { for (const k of ks) { const h = firstHit(o, k, planeOnly); if (h) return { ...h, chosen: "first hit of " + k }; } return null; };
  if (layer === "model") return tryKeys(["create_table", "alter_table", "sql_exec", "ops_map"]);
  if (layer === "middleware") return tryKeys(["do_answer", "alarm_set", "new_request", "new_response"]);
  if (layer === "ui") return tryKeys(["screens_export", "asset_bodies", "html_tags"]);
  if (layer === "launcher") return tryKeys(["platform_class", "block_start", "cf_import"]);
  if (layer === "control-plane") return tryKeys(["pathname"]);
  return null;
}
const exportCite = (o) => { for (const planeOnly of [true, false]) { const h = firstHit(o, "first_export", planeOnly); if (h) return { ...h, chosen: "first export" }; } return null; };
const RESULT = OUT.map((o) => {
  const pl = PLACED.get(o.name); const rd = READ[o.name] || {};
  const ambiguous = pl.layers.length > 1;
  const cite = citeOf(rd.cite) || (ambiguous ? null : (pl.rule === "signals" ? autoCite(o, pl.layer) : null) || exportCite(o));
  const parts = pl.parts ? pl.parts.map((p) => ({ layer: p.layer, what: p.what || null, files: p.files, lines: p.lines, citation: citeOf(p.cite) || autoCite({ ...o, planeFiles: p.files.length ? p.files : o.planeFiles }, p.layer) })) : null;
  return { module: o.name, position: o.pos, layer: ambiguous ? "AMBIGUOUS" : pl.layer, sublayer: pl.sub, ambiguous, candidates: pl.layers, placed_by: pl.rule,
    deciding_signals: pl.claims.length ? Object.fromEntries(pl.claims.map((c) => [c.layer, c.why])) : { importer_layers: pl.importerLayers || [], imported_by_plane_held_code_of: pl.importers || [] },
    citation: cite, parts, plane_held_code_files: o.planeFiles.length, plane_held_lines: o.linesPlane,
    files_outside_the_planes_program: o.restFiles.concat(o.skipped), held_by_programs: o.held, note: rd.note || null, signals: row(o) };
});
const R = new Map(RESULT.map((r) => [r.module, r]));
/* a citation is a line of the module's own code: refuse one from a file the module does not own */
for (const r of RESULT) for (const c of [r.citation, ...(r.parts || []).map((p) => p.citation)]) {
  if (c && modOf(c.file) !== r.module) { console.error(`signals.mjs: ${r.module} is cited from ${c.file}, which ${modOf(c.file) || "no module"} owns`); process.exit(3); }
  if (c && !c.text) { console.error(`signals.mjs: ${r.module}'s citation ${c.file}:${c.line} is an empty line`); process.exit(3); }
}

/* ---------- 12. the layers in the current order ---------- */
function orderReport(stack) {
  const at = (l) => stack.indexOf(l);
  const strict = RESULT.filter((r) => !r.ambiguous && at(r.layer) >= 0);
  const spans = {};
  for (const l of stack) {
    const own = strict.filter((r) => r.layer === l).map((r) => r.position);
    const any = RESULT.filter((r) => r.candidates.includes(l)).map((r) => r.position);
    spans[l] = { modules: own.length, lowest: own.length ? Math.min(...own) : null, highest: own.length ? Math.max(...own) : null,
      with_ambiguous: { modules: any.length, lowest: any.length ? Math.min(...any) : null, highest: any.length ? Math.max(...any) : null } };
  }
  /* an inversion: a module of a lower layer that sits after a module of a higher layer */
  const inversions = [];
  for (const a of strict) {
    const above = strict.filter((b) => b.position < a.position && at(b.layer) > at(a.layer));
    if (!above.length) continue;
    const by = {};
    for (const b of above) (by[b.layer] ??= []).push(b);
    inversions.push({ module: a.module, position: a.position, layer: a.layer,
      after: Object.fromEntries(Object.entries(by).map(([l, bs]) => [l, { count: bs.length, first: `${bs[0].module} (${bs[0].position})`, last: `${bs[bs.length - 1].module} (${bs[bs.length - 1].position})` }])) });
  }
  const ambiguousInv = [];
  for (const a of RESULT.filter((r) => r.ambiguous)) {
    for (const l of a.candidates) {
      if (at(l) < 0) continue;
      const above = strict.filter((b) => b.position < a.position && at(b.layer) > at(l));
      if (above.length) ambiguousInv.push({ module: a.module, position: a.position, as: l, after_higher: above.length, first: `${above[0].module} (${above[0].position}, ${above[0].layer})` });
    }
  }
  return { stack, spans, inversions, ambiguous_inversions: ambiguousInv };
}

/** For each pair of layers (lower, higher) of a stacking: how many modules of the lower layer sit after at least one module
 *  of the higher layer. `strict` counts single-layer modules on both sides; `with_parts` counts every module that has a part
 *  in the layer (an ambiguous module on each side it has a part in; a module is not set against itself). */
function pairMatrix(stack) {
  const out = [];
  for (let i = 0; i < stack.length; i++) for (let j = i + 1; j < stack.length; j++) {
    const lo = stack[i], hi = stack[j];
    const one = (strict) => {
      const lows = RESULT.filter((r) => (strict ? !r.ambiguous && r.layer === lo : r.candidates.includes(lo)));
      const highs = RESULT.filter((r) => (strict ? !r.ambiguous && r.layer === hi : r.candidates.includes(hi)));
      const firstHigh = highs.length ? highs.reduce((a, b) => (a.position < b.position ? a : b)) : null;
      const after = lows.filter((a) => highs.some((b) => b.position < a.position && b.module !== a.module));
      return { lower_modules: lows.length, higher_modules: highs.length, lower_after_a_higher: after.length, first_higher: firstHigh ? `${firstHigh.module} (${firstHigh.position})` : null,
        which: after.length <= 24 ? after.map((a) => `${a.module} (${a.position})`) : [`${after[0].module} (${after[0].position})`, "...", `${after[after.length - 1].module} (${after[after.length - 1].position})`] };
    };
    out.push({ lower: lo, higher: hi, strict: one(true), with_parts: one(false) });
  }
  return out;
}

/* ---------- 13. output ---------- */
const COUNTS = {};
for (const r of RESULT) { const k = r.ambiguous ? "AMBIGUOUS" : r.layer; COUNTS[k] = (COUNTS[k] || 0) + 1; }
const SUBCOUNTS = {};
for (const r of RESULT) { const k = (r.ambiguous ? "AMBIGUOUS" : r.layer) + " / " + r.sublayer; SUBCOUNTS[k] = (SUBCOUNTS[k] || 0) + 1; }
if (args[0] === "--fanout") {
  /* plane-held files by the number of other modules they import from */
  const rows = [];
  for (const o of OUT) for (const f of o.planeFiles) { const n = new Set(fileSignals(f).edges.map((e) => e.toMod).filter((m) => m && m !== o.name)).size; rows.push([n, f, o.name]); }
  rows.sort((a, b) => b[0] - a[0]);
  for (const r of rows.slice(0, Number(args[1] || 25))) console.log(r.join(" "));
  process.exit(0);
}
if (args[0] === "--importers") {
  /* for each module placed by its importers: the plane-held files of other modules that import it, by module and layer */
  for (const o of OUT) {
    const pl = PLACED.get(o.name); if (!pl.importers) continue;
    console.log(`${String(o.pos).padStart(3)} ${o.name.padEnd(22)} -> ${pl.layers.join("+")}/${pl.sub} | importer layers: ${pl.importerLayers.join(", ") || "(none)"} | ${pl.importers.join(" ")}`);
  }
  process.exit(0);
}
if (args[0] === "--facts") {
  const lay = (n) => { const r = R.get(n); return r.ambiguous ? "AMBIGUOUS" : r.layer === "outside" ? "outside/" + r.sublayer : r.layer; };
  const by = (pred) => { const g = {}; for (const o of OUT) if (pred(o)) (g[lay(o.name)] ??= []).push(o.name); return g; };
  const show = (title, g, list = true) => { console.log("\n" + title); for (const [k, v] of Object.entries(g)) console.log(`  ${k}: ${v.length}` + (list ? ` (${v.join(", ")})` : "")); };
  console.log("control-plane's imports of UI modules:");
  for (const [m, at] of BY.get("control-plane").imp.mods) if (R.get(m).layer === "ui") console.log(`  ${m} (${R.get(m).position}) at ${at.file}:${at.line}: ${lineText(at.file, at.line).slice(0, 120)}`);
  console.log("UI modules' imports of modules that are not UI:");
  for (const o of OUT) if (R.get(o.name).layer === "ui") for (const [m, at] of o.imp.mods) if (R.get(m).layer !== "ui") console.log(`  ${o.name} (${o.pos}) imports ${m} (${R.get(m).position}, ${lay(m)}) at ${at.file}:${at.line}`);
  console.log("modules that import a UI module:"); for (const o of OUT) { const u = [...o.imp.mods.keys()].filter((m) => R.get(m).layer === "ui"); if (u.length && R.get(o.name).layer !== "ui") console.log(`  ${o.name} (${o.pos}, ${lay(o.name)}): ${u.join(", ")}`); }
  show("modules whose plane-held code calls word()/localize()/hasWord(), by layer:", by((o) => o.sp.word_calls > 0), false);
  console.log("  word_calls in plane-held code, by layer:", JSON.stringify(Object.fromEntries(Object.entries(by((o) => o.sp.word_calls > 0)).map(([k, v]) => [k, v.reduce((n, m) => n + BY.get(m).sp.word_calls, 0)]))));
  show("plane-held modules outside the UI layer with HTML tags in their code:", by((o) => o.planeFiles.length && o.sp.html_tags > 0 && R.get(o.name).layer !== "ui"));
  for (const o of OUT) if (o.planeFiles.length && o.sp.html_tags > 0 && R.get(o.name).layer !== "ui") console.log(`    ${o.name}: ${o.sp.html_tags}; first ${hitsOf({ ...o, code: o.planeFiles }, "html_tags", 1)[0].slice(0, 170)}`);
  show("plane-held modules that name an env binding (env.NAME), by layer:", by((o) => [...o.env.values()].some((e) => e.plane)), false);
  for (const o of OUT) { const e = [...o.env].filter(([, v]) => v.plane).map(([k]) => k); if (e.length) console.log(`    ${o.pos} ${o.name} (${lay(o.name)}): ${e.join(" ")}`); }
  show("plane-held code with cf_import, platform_class, block_start or an alarm call:", by((o) => o.sp.cf_import + o.sp.platform_class + o.sp.block_start + o.sp.alarm_any > 0));
  show("single-layer model modules that build a Response or a Request:", by((o) => R.get(o.name).layer === "model" && o.sp.new_response + o.sp.new_request > 0));
  show("plane-held modules that call the network (global fetch) or a fleet member:", by((o) => o.sp.fetch_out + o.sp.fleet_call > 0));
  console.log("\nfiles of plane-layer modules held by other deployables' programs:");
  for (const d of Object.keys(CLOSURE)) { if (d === "plane") continue; let files = 0; const mods = new Set(); for (const o of OUT) { if (!o.planeFiles.length || (o.wrangler.length && o.name !== "plane")) continue; const n = o.planeFiles.filter((f) => CLOSURE[d].has(f)).length; if (n) { files += n; mods.add(o.name); } } console.log(`  ${d}: ${files} files of ${mods.size} modules`); }
  let later = 0; for (const o of OUT) for (const m of o.imp.mods.keys()) if (BY.has(m) && BY.get(m).pos > o.pos) { later++; console.log("  LATER: " + o.name + " imports " + m); }
  console.log("\nimports of a later module by owned code (static and literal dynamic): " + later);
  console.log("assembly files (import from 80 or more other modules): " + [...ASSEMBLY_FILES].join(", "));
  /* cross-check: the committed bundle manifest's first-party inputs against the files this script finds the plane's program to hold */
  try {
    const man = JSON.parse(fs.readFileSync(path.join(ROOT, "bio-plane/dist/bio-plane.bundle.json"), "utf8"));
    const ins = new Set((man.inputs || []).map((x) => path.posix.normalize(path.posix.join("bio-plane", typeof x === "string" ? x : x.path))));
    const mine = new Set([...CLOSURE.plane]);
    const onlyMan = [...ins].filter((f) => !mine.has(f)), onlyMine = [...mine].filter((f) => !ins.has(f));
    console.log(`bundle manifest (bio-plane/dist/bio-plane.bundle.json): ${ins.size} first-party inputs; this script's closure: ${mine.size} files; in the manifest only: ${onlyMan.length} ${onlyMan.slice(0, 6).join(" ")}; in the closure only: ${onlyMine.length} ${onlyMine.slice(0, 6).join(" ")}`);
  } catch (e) { console.log("bundle manifest not read: " + e.message); }
  console.log("dynamic imports with a computed address in plane-held files: " + OUT.reduce((n, o) => n + o.planeFiles.reduce((k, f) => k + fileSignals(f).dynamicNonLiteral, 0), 0));
  console.log("plane-held code files: " + OUT.reduce((n, o) => n + o.planeFiles.length, 0) + " of " + OUT.reduce((n, o) => n + o.code.length, 0) + " scanned; not scanned: " + OUT.reduce((n, o) => n + o.skipped.length, 0) + "; unparsed: " + OUT.flatMap((o) => o.unparsed).join(", "));
  process.exit(0);
}
if (args[0] === "--layers") {
  console.log(JSON.stringify(COUNTS)); console.log(JSON.stringify(SUBCOUNTS, null, 1));
  for (const r of RESULT) {
    console.log(`${String(r.position).padStart(3)} ${r.module.padEnd(22)} ${(r.ambiguous ? "AMBIGUOUS: " + r.candidates.join(" + ") : r.layer + " / " + r.sublayer).padEnd(46)} ${r.citation && r.citation.chosen === "by hand" ? "h" : "a"} ${r.citation ? r.citation.file.replace("bio-plane/src/", "") + ":" + r.citation.line + ": " + r.citation.text.slice(0, 110) : ""}`);
    if (r.parts) for (const p of r.parts) console.log(`      ${p.layer.padEnd(14)} ${String(p.lines).padStart(5)} lines in ${p.files.length} files; ${p.citation ? p.citation.file.replace("bio-plane/src/", "") + ":" + p.citation.line + ": " + p.citation.text.slice(0, 120) : "NO CITE"}`);
    if (r.placed_by === "importers") console.log(`      by importers: ${r.deciding_signals.importer_layers.join(", ") || "(none)"}`);
  }
  process.exit(0);
}
if (args[0] === "--sizes") {
  /* lines of plane-held code by layer: single-layer modules whole, an ambiguous module's files by the part they are in */
  const lines = {}, files = {};
  for (const r of RESULT) {
    const o = BY.get(r.module);
    if (r.parts) for (const p of r.parts) { lines[p.layer] = (lines[p.layer] || 0) + p.lines; files[p.layer] = (files[p.layer] || 0) + p.files.length; }
    else { const k = r.layer === "outside" ? "outside/" + r.sublayer : r.layer; lines[k] = (lines[k] || 0) + o.linesPlane; files[k] = (files[k] || 0) + o.planeFiles.length; }
  }
  for (const k of Object.keys(lines)) console.log(`${k}: ${lines[k]} lines in ${files[k]} plane-held files`);
  console.log("ambiguous modules, by part:");
  for (const r of RESULT) if (r.parts) console.log(`  ${r.position} ${r.module}: ` + r.parts.map((p) => `${p.layer} ${p.lines} lines in ${p.files.length} files`).join("; "));
  process.exit(0);
}
if (args[0] === "--patterns") {
  /* each pattern with its counts: hits in plane-held files, modules with a hit there, hits in the other scanned files, modules with a hit there */
  for (const k of SHOWN) {
    const inP = OUT.reduce((n, o) => n + o.sp[k], 0), modsP = OUT.filter((o) => o.sp[k]).length, inR = OUT.reduce((n, o) => n + o.sr[k], 0), modsR = OUT.filter((o) => o.sr[k]).length;
    console.log(`${k} | ${P[k].source.length > 150 ? P[k].source.slice(0, 150) + "…" : P[k].source} | ${inP} in ${modsP} | ${inR} in ${modsR}`);
  }
  console.log(`env names | ${ENV_NAME.source} | ${OUT.filter((o) => [...o.env.values()].some((e) => e.plane)).length} modules with one in plane-held code`);
  console.log(`imports other modules' op maps (name ends Ops) | from the parse tree | ${OUT.filter((o) => o.imp.ops.size).map((o) => o.name + " " + o.imp.ops.size).join(", ")}`);
  console.log(`imports other modules' DECLARED_OPS | from the parse tree | ${OUT.filter((o) => o.imp.declared.size).map((o) => o.name + " " + o.imp.declared.size).join(", ")}`);
  console.log(`imports other modules' SCREENS | from the parse tree | ${OUT.filter((o) => o.imp.screens.size).map((o) => o.name + " " + o.imp.screens.size).join(", ")}`);
  console.log(`imports other modules' door handlers (name ends Op or OpResponse) | from the parse tree | ${OUT.filter((o) => o.imp.doorOps.size).map((o) => o.name + " " + o.imp.doorOps.size).join(", ")}`);
  process.exit(0);
}
if (args[0] === "--table") {
  /* the compact table of 10-layers.md: position, module, layer/sublayer, the signals above zero in plane-held code, the citation */
  const code = { T: (s) => s.create_table + s.alter_table, R: (s) => s.sql_exec, O: (s) => s.ops_map, A: (s) => s.do_answer, Q: (s) => s.new_response + s.new_request,
    F: (s) => s.fetch_out + s.fleet_call, S: (s) => s.screens_export, H: (s) => s.html_tags, B: (s) => s.dom, W: (s) => s.word_calls, K: (s) => s.cf_import + s.platform_class + s.block_start + s.alarm_set };
  const short = (f) => f.replace("bio-plane/src/", "");
  for (const r of RESULT) {
    const o = BY.get(r.module);
    const sig = Object.entries(code).map(([k, f]) => [k, f(o.sp)]).filter(([, v]) => v).map(([k, v]) => k + v).join(" ");
    const x = o.imp.ops.size + o.imp.declared.size + o.imp.doorOps.size + o.imp.screens.size;
    const e = [...o.env.values()].filter((v) => v.plane).length;
    const subs = { "shared-foundation": "shared", "fleet-member": "fleet", "fleet-library": "fleet-lib", "other-deployable": "own-worker" };
    const lay = r.ambiguous ? "AMBIGUOUS " + r.candidates.map((c) => c === "control-plane" ? "door" : c.slice(0, 3)).join("+")
      : r.layer === "outside" ? "out/" + (subs[r.sublayer] || r.sublayer)
      : r.placed_by === "signals" ? r.layer : r.layer + (r.sublayer === "pure" ? "/pure" : "/reach");
    const c = r.citation || (r.parts && r.parts[0].citation);
    const held = o.planeFiles.length === o.code.length ? String(o.code.length) : `${o.planeFiles.length}/${o.code.length}`;
    const where = c ? (short(c.file).startsWith(r.module + "/") ? "~" + short(c.file).slice(r.module.length) : short(c.file)) + ":" + c.line : "";
    console.log(`${r.position} ${r.module}|${lay}|${held}${sig ? " " + sig : ""}${x ? " X" + x : ""}${e ? " E" + e : ""}|${where}`);
  }
  process.exit(0);
}
if (args[0] === "--order") {
  for (const stack of [WANTED, TODAY]) {
    const rep = orderReport(stack);
    console.log("\n== stacking, lowest first: " + stack.join(" < "));
    for (const l of stack) { const s = rep.spans[l]; console.log(`  ${l.padEnd(14)} ${String(s.modules).padStart(3)} modules, positions ${s.lowest}..${s.highest}   (counting ambiguous modules too: ${s.with_ambiguous.modules}, ${s.with_ambiguous.lowest}..${s.with_ambiguous.highest})`); }
    for (const m of pairMatrix(stack)) console.log(`  ${m.lower} after ${m.higher}: strict ${m.strict.lower_after_a_higher} of ${m.strict.lower_modules} (first ${m.higher}: ${m.strict.first_higher}); with parts ${m.with_parts.lower_after_a_higher} of ${m.with_parts.lower_modules} (first ${m.higher} part: ${m.with_parts.first_higher})` + (m.strict.which.length ? `\n      strict: ${m.strict.which.join(", ")}` : "") + (m.with_parts.which.length ? `\n      with parts: ${m.with_parts.which.join(", ")}` : ""));
    console.log(`  inversions (a single-layer module after a single-layer module of a higher layer): ${rep.inversions.length}`);
    for (const v of rep.inversions) console.log(`    ${v.position} ${v.module} (${v.layer}) sits after ` + Object.entries(v.after).map(([l, x]) => `${x.count} ${l} module(s), first ${x.first}`).join("; "));
    console.log(`  ambiguous modules, taken as each candidate layer, that would sit after a higher layer's module: ${rep.ambiguous_inversions.length}`);
    for (const v of rep.ambiguous_inversions) console.log(`    ${v.position} ${v.module} as ${v.as}: after ${v.after_higher}, first ${v.first}`);
  }
  process.exit(0);
}
if (WRITE_TO) {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT }).toString().trim();
  const base = execFileSync("git", ["merge-base", "HEAD", "origin/p4-tranche"], { cwd: ROOT }).toString().trim();
  fs.writeFileSync(WRITE_TO, JSON.stringify({
    about: "Each of the 204 modules placed in a layer by what its code does. Written by signals.mjs --write; the rules, the reading and what was not checked are in ../10-layers.md.",
    how_to_read: {
      layer: "model | middleware | control-plane | launcher | ui | outside | AMBIGUOUS (its code claims the layers in `candidates`; `parts` says which files and gives a line for each)",
      placed_by: "signals (the rule over the module's own plane-held code) | importers (rule P: its own code claims no layer; the lowest layer among the plane-held files that import it, or outside/shared-foundation when three or more layers including the model import it) | read (override ...): the rule's claim set aside after reading, with the reason",
      citation: "one line of the module's own code, read; `chosen` says whether it is the first hit of the deciding pattern or was picked by hand; `text` is the line as it stands in the file",
      signals: "counts over the module's owned, scanned code files; `a+b` is a in the files the plane's program holds and b in its other files",
    },
    base: { head, merge_base_with_origin_p4_tranche: base }, modules: RESULT.length, counts: COUNTS, counts_by_sublayer: SUBCOUNTS,
    layers_wanted_lowest_first: WANTED, layers_today_lowest_first: TODAY,
    order: { wanted: { ...orderReport(WANTED), pairs: pairMatrix(WANTED) }, today: { ...orderReport(TODAY), pairs: pairMatrix(TODAY) } },
    placements: RESULT }, null, 1) + "\n");
  console.log("wrote " + WRITE_TO);
  process.exit(0);
}
export { OUT, BY, MODS, claims, RESULT, R, PLACED, orderReport, COUNTS, SUBCOUNTS, READ, ROOT, HERE, P, KEYS, WANTED, TODAY };

/* ---------- 14. what was read (hoisted: function declarations run before the code above) ---------- */
function readRows() {
  const B = "bio-plane/src/";
  return {
    /* --- modules whose code claims two layers: the files of each part (`rest` takes every file not named), and a line read for each --- */
    "host-governor": { parts: { model: { rest: true, what: "the class HostGovernor (index.mjs:62) and its table (schema.mjs)" },
      middleware: { files: [], cite: B + "host-governor/index.mjs:429", what: "governorOverStub (index.mjs:300), governorOp (395) and governorOpResponse (429) reach the object through a stub; the same file as the class" } } },
    "provenance": { parts: { model: { rest: true, what: "index.mjs, and provenanceOps in ops.mjs:24" },
      middleware: { files: [], cite: B + "provenance/ops.mjs:80", what: "registerAuditOp (ops.mjs:73), in the same file as the op map" } } },
    "attestation": { parts: { model: { rest: true, }, middleware: { files: ["attestation/ops.mjs"], cite: B + "attestation/ops.mjs:36", what: "attestOp" } } },
    "capture": { parts: { model: { rest: true, }, middleware: { files: ["capture/ops.mjs"], cite: B + "capture/ops.mjs:230", what: "captureOp, acquireOp, linksOp, archiveLookupOp, captureObjectOp" } } },
    "doorbell": { parts: { model: { rest: true, }, middleware: { files: ["doorbell/door.mjs"], cite: B + "doorbell/door.mjs:124", what: "knockOp, doorbellPublicOp" } } },
    "extraction": { parts: { model: { rest: true, }, middleware: { files: ["extraction/ops.mjs"], cite: B + "extraction/ops.mjs:32", what: "pdfStructureOp, pageTranscribeOp, extractionOp, acquireReadingOp" } } },
    "connections": { parts: { model: { rest: true, }, middleware: { files: ["connections/ops.mjs"], cite: B + "connections/ops.mjs:27", what: "linkProjectOp, connectionsOp" } } },
    "publication": { parts: { model: { rest: true, cite: B + "publication/schema.mjs:82" }, middleware: { files: ["publication/door.mjs"], cite: B + "publication/door.mjs:58", what: "publicationDoorOp" } } },
    "public-read": { parts: { model: { rest: true }, middleware: { files: ["public-read/door.mjs", "publication/worker.mjs"], cite: B + "public-read/door.mjs:75", what: "publicReadDoorOp and the published routes (publication/worker.mjs: publishedRoutes, assembleCaseContainer)" } } },
    "ratification": { parts: { model: { rest: true, }, middleware: { files: ["ratification/ops.mjs", "ratification/finding.mjs", "ratification/casefile.mjs"], cite: B + "ratification/ops.mjs:115", what: "the ratify, case and publish ceremonies run against a stub of the object" } } },
    "monitoring": { parts: { model: { rest: true, }, middleware: { files: [], cite: B + "monitoring/index.mjs:3904", what: "monitorOp (index.mjs:3904), in the same file as the class" } } },
    "affordances": { parts: { model: { rest: true, cite: B + "affordances/facts.mjs:96" }, middleware: { files: ["affordances/door.mjs"], cite: B + "affordances/door.mjs:102", what: "affordancesOp" } } },
    "queue": { parts: { model: { rest: true, }, middleware: { files: ["queue/door.mjs"], cite: B + "queue/door.mjs:43", what: "queueFeedOp, queueOp" } } },
    "instance-setup": { parts: { model: { rest: true, what: "the class InstanceSetup (setup.mjs:1003), its tables (533) and op map (3081), and setup-fleet.mjs" },
      middleware: { files: ["livefire.mjs"], cite: B + "setup.mjs:3220", what: "livefire.mjs, and in setup.mjs the handlers that reach the object through a stub, among them partsReport (232), publicInstanceGroup (3220), bootstrapReport (3281), instanceSetupOp (3538) and bootstrapOp (3583); the same file as the class" } } },
    "admission": { parts: { middleware: { rest: true, cite: B + "admission/index.mjs:1336", what: "the gates the door calls (index.mjs, checks.mjs)" }, model: { files: ["admission/window.mjs"], cite: B + "admission/window.mjs:53", what: "the door-window and session-window counters, their two tables and admissionOps" } } },
    "signin-door": { layers: ["middleware", "model"], override: "the rule sees only the op map (ops_map=1); index.mjs holds no doAnswer call but is a handler the door calls with its own store function (control-plane/index.mjs:1464) and that sends each step to agent-worker",
      parts: { middleware: { rest: true, cite: B + "signin-door/index.mjs:128", what: "subscriptionSignin, subscriptionDisconnect, signintrace (index.mjs)" }, model: { files: ["signin-door/ops.mjs"], cite: B + "signin-door/ops.mjs:43", what: "five store-internal routes on credentials' instance; no table" } } },
    "store-services": { parts: { middleware: { rest: true, cite: B + "store-assembly/declarations.mjs:191", what: "the owners' declarations assembled (declarations.mjs, declared.mjs, register.mjs, owner-ops.mjs); the ask and the drafts carried to agent-worker (ask.mjs); transcribe.mjs, unpack.mjs, casesweep.mjs" },
      model: { files: ["store-assembly/pending.mjs", "store-assembly/acquire-timings.mjs"], cite: B + "store-assembly/pending.mjs:73", what: "the ledger of owed work and the stage timings: five tables and two op maps" } } },
    "store-assembly": { parts: { launcher: { files: [], cite: B + "store-assembly/assemble.mjs:584", what: "the start in assembleStore (assemble.mjs:220): each module built with the bindings, then the migrations and the scheduler's start handed to the platform's start gate (584, 585, 645)" },
      middleware: { rest: true, cite: B + "store-assembly/assemble.mjs:777", what: "the one route map (assemble.mjs:777 on) and the dispatch through store-door, in the same function as the start; wiring.mjs, wizards.mjs, owners.mjs" },
      model: { files: ["store-assembly/stats.mjs"], cite: B + "store-assembly/assemble.mjs:680", what: "SQL of its own: a column added to another module's table (assemble.mjs:680), rows of other modules' tables read (wiring.mjs:61, stats.mjs:90)" } } },
    "control-plane": { parts: { "control-plane": { rest: true, cite: B + "control-plane/index.mjs:957", what: "the router (index.mjs), the pages and assets (app.mjs), phase-clock.mjs, words-cache.mjs" },
      middleware: { files: ["control-plane/archive.mjs", "control-plane/draft.mjs", "control-plane/jobs.mjs", "control-plane/job-state.mjs", "control-plane/reading-gate.mjs"], cite: B + "control-plane/archive.mjs:102", what: "handling of particular ops beside the router: an archive's documents filed, a draft asked, a reading deferred; and, inside index.mjs, deliverOwedRender (index.mjs:743), which runs in the object on its alarm" } } },
    "screens-capture": { note: "its promoteDocument (screens-intake/capture.mjs:144) writes a bundle's text and sends allocid and promote; control-plane runs the same function inside the object (control-plane/index.mjs:797)" },
    /* --- placed by their importers (rule P): the line read, and what reading adds --- */
    "setup-words": { cite: B + "setup-words/index.mjs:57", note: "holds the member-facing words (rows.mjs, 27,078 lines) and the function every layer reads them through; build.mjs and vendor/ are its build tool" },
    "record-grammar": { cite: B + "record-grammar/frontmatter.mjs:83" },
    "jurisdiction-profiles": { cite: "jurisdictions/profiles/oakland-alameda.mjs:65" },
    "jurisdictions": { cite: "jurisdictions/index.mjs:277" },
    "civil-time": { cite: B + "civil-time/days.mjs:16" },
    "calc-grammar": { cite: B + "calc-grammar/decimal.mjs:24" },
    "connection-grammar": { cite: B + "connection-grammar/index.mjs:16" },
    "runtime-limits": { cite: B + "cpu.mjs:63", note: "one of its five files touches the platform: store-place.mjs takes the object's stub from env.STORE (id_from=1)" },
    "signatures": { cite: B + "sshsig.mjs:119", note: "bio-plane/scripts/sign-sshsig.mjs is a command-line tool, outside the plane's program" },
    "court-citations": { cite: "court-citations/index.mjs:57", note: "build.mjs and translate.mjs are its build tools" },
    "id-spaces": { cite: B + "idspaces.mjs:164" },
    "subresources": { cite: B + "subresources.mjs:446" },
    "ooxml": { cite: B + "ooxml.mjs:123" },
    "csv-reader": { cite: B + "csv-reader/index.mjs:145" },
    "office-readers": { cite: B + "docx.mjs:418", sub: "pure", note: "new_response=1 is `await new Response(out).text()` (formats-xlsx.mjs:739), a stream read, not an answer" },
    "odf-reader": { cite: B + "odf.mjs:2826" },
    "pdf-reader": { cite: B + "pdfstructure.mjs:1506" },
    "format-registry": { cite: B + "formats.mjs:69" },
    "text-chain": { cite: B + "textchain.mjs:591" },
    "site-profiles": { cite: "site-profiles/index.mjs:99" },
    "docprofile": { cite: "docprofile/doctypes/index.mjs:177" },
    "doctypes": { cite: "doctypes/index.mjs:42" },
    "legistar-reader": { cite: "legistar-reader/index.mjs:66" },
    "roster-reader": { cite: "roster-reader/index.mjs:30", layers: ["model"], sub: "pure", override: "its one importer in the plane's program is store-assembly/wiring.mjs:25-32, which registers it in docprofile's registry; the code reads a held document into typed rows, as doctypes does" },
    "court-doctypes": { cite: "court-doctypes/index.mjs:23", layers: ["model"], sub: "pure", override: "its one importer in the plane's program is store-assembly/wiring.mjs:25-32, which registers it in docprofile's registry; the code reads a held document into typed rows, as doctypes does" },
    "budget-doctypes": { cite: "budget-doctypes/index.mjs:272", layers: ["model"], sub: "pure", override: "its one importer in the plane's program is store-assembly/wiring.mjs:25-32, which registers it in docprofile's registry; the code reads a held document into typed rows, as doctypes does" },
    "image-codecs": { cite: "pdf-worker/src/mq.mjs:61", note: "its files lie under pdf-worker/src/; the plane's program holds all six" },
    "pdf-pixels": { cite: "pdf-worker/src/pagepixels.mjs:357", note: "its files lie under pdf-worker/src/; the plane's program holds three of four (pagepixels-worker.mjs is not held)" },
    "image-cover": { cite: B + "image-cover/index.mjs:72" },
    "doc-clean": { cite: B + "doc-clean/index.mjs:44" },
    "op-grade-tranches": { cite: B + "op-grades/t33.mjs:22" },
    "op-grades": { cite: B + "op-grades/index.mjs:105", note: "a table keyed by op name: how much each act weighs; read by affordances (model), store-assembly (middleware) and interface-shell (UI)" },
    "reading-pipeline": { cite: B + "reading-pipeline/index.mjs:152", note: "no table and no op; it calls the pdf-worker and ocr-worker fleet members through env bindings" },
    "query-language": { cite: B + "query.mjs:52" },
    "inquiry-grammar": { cite: B + "inquiry-grammar/index.mjs:19" },
    "accepted-work": { cite: B + "accepted-work/index.mjs:232" },
    "contradiction-words": { cite: B + "contradiction.mjs:33" },
    "skills": { cite: B + "skillpack.mjs:374" },
    "case-grammar": { cite: B + "case-grammar/index.mjs:91", note: "complete.mjs:226 returns one HTML file, the published case's complete edition (html_tags=22): a document, not a screen" },
    "case-checker": { cite: B + "case-checker/index.mjs:93", note: "build-program.mjs is its build tool; program.mjs (6.8 MB, generated) is not scanned" },
    "case-document": { cite: B + "case-authoring/document.mjs:72" },
    "filing-texts": { cite: B + "filings/outward.mjs:20" },
    "wizard-library": { cite: B + "wizard-scripts/screen-registry.mjs:11", note: "generated data: the design's screen registry (each screen's id, name, purpose and acts) and wizard library; its one importer is wizard-scripts, which hands SCREEN_REGISTRY on to interface-shell" },
    "act-help": { cite: B + "affordances/act-help.mjs:289", note: "a table keyed by op name of what each act does, each sentence read from setup-words by key" },
    "queue-words": { cite: B + "queue-producers/words.mjs:10" },
    "queue-catalogue": { cite: B + "queuestate.mjs:69" },
    "op-capabilities": { cite: B + "op-capabilities/index.mjs:32" },
    "op-declarations": { cite: B + "op-declarations/index.mjs:2927", note: "the table of every op (class, grade, fields), filled by the owners' declarations at the start; read by admission, store-request, the control plane, the launcher's door hooks and the UI; no model file imports it" },
    /* --- single-layer modules whose line was chosen by hand --- */
    "scheduler": { cite: B + "scheduler/index.mjs:741", note: "no table, no op: it holds the object's one alarm and runs the consumers that 24 other modules register" },
    "answer-envelope": { cite: B + "answer-envelope/index.mjs:152", note: "families.mjs imports the check tables of 87 other modules" },
    "store-door": { cite: B + "store-door/dispatch.mjs:413", note: "pull.mjs files a doorbell knock as a bundle and step.mjs is a promotion step: handling of its own beside the dispatch" },
    "store-request": { cite: B + "store-request/index.mjs:132" },
    "interface-assets": { cite: B + "interface-assets/index.mjs:11", note: "generate.mjs is its build tool, outside the plane's program" },
    "interface-shell": { cite: B + "interface-shell/index.mjs:590" },
    "translations": { note: "seven tables of a team's translated words and an op map: the record of translations, kept as the model keeps anything" },
    "wizard-scripts": { note: "twelve tables of wizard scripts and an op map; it also hands the design's screen registry on (wizard-library's SCREEN_REGISTRY)" },
    "promotion": { note: "no SQL of its own: it reaches rows through record-core" },
    "file-safety": { note: "do_call=2 is a Request built for capture's own function (index.mjs:948), not a call to the object; it answers bytes itself (new_response=4)" },
    "ai-runs": { note: "do_call=1 is one object asking another (index.mjs:2320); it calls agent-worker from inside the object (index.mjs:2394)" },
    /* --- outside the five --- */
    "documents": { cite: "docs/development/ux-substrate/screens/build_words.mjs:17", sub: "documents", note: "4,894 owned files, 4,731 of them .md; its code is scripts kept beside the documents" },
    "test-support": { cite: "bio-plane/test/platform-sqlite.mjs:28", sub: "tooling" },
    "bundler": { cite: "bio-plane/scripts/fleet-bundle.mjs:1542", sub: "tooling" },
    "release": { cite: "bio-plane/scripts/deploy.mjs:190", sub: "tooling" },
    "journey-check": { cite: B + "journey-check/run.mjs:45", sub: "tooling", note: "its folder is under bio-plane/src/ but the plane's program holds none of it" },
    "pdf-worker": { cite: "pdf-worker/src/index.mjs:362" },
    "ocr-worker": { cite: "ocr-worker/src/index.mjs:71" },
    "sheet-worker": { cite: "sheet-worker/src/index.mjs:22", note: "the plane's program holds one of its files" },
    "file-scanner": { cite: "file-scanner/src/worker.mjs:21", note: "the plane's program holds four of its files" },
    "agent-runner": { cite: "agent-runner/src/worker.mjs:90" },
    "agent-worker": { cite: "agent-worker/src/index.mjs:798" },
    "agent-harness": { cite: "agent-harness/src/harness.mjs:563" },
    "agent-model": { cite: "agent-model/src/apikey.mjs:14" },
    "agent-steps": { cite: "agent-steps/src/index.mjs:4" },
    "agent-worker-routes": { cite: "agent-worker/src/ask.mjs:73" },
    "installer-account": { cite: "newgroup/src/steps/account.mjs:28", sub: "installer" },
    "installer-steps": { sub: "installer" },
    "installer-pages": { cite: "newgroup/src/ui.mjs:270", sub: "installer" },
    "installer": { cite: "newgroup/src/index.mjs:1443", sub: "installer" },
    "site": { cite: "site/src/index.mjs:123", sub: "site" },
    "stewards": { cite: "stewards/src/index.mjs:281", sub: "other-deployable", note: "a Worker of its own with its own Durable Object, run apart from every team's plane" },
    "plane": { parts: { launcher: { rest: true, cite: B + "plane/store.mjs:27", what: "the Worker's default export and the Durable Object class (index.mjs, store.mjs, watchdog.mjs, arrival.mjs), with bio-plane/wrangler.jsonc" },
      middleware: { files: ["plane/door.mjs"], cite: B + "plane/door.mjs:89", what: "which owner's handler answers which op, and the stamps each is handed (publicOp, gatedOp)" } } },
  };
}
