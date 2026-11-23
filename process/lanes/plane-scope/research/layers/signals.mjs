#!/usr/bin/env node
/* signals.mjs: the mechanical signals behind ../10-layers.md, the rule that places each module in a layer, and the table
 * of what was read for each module.
 *
 *   node process/lanes/plane-scope/research/layers/signals.mjs                 the signal table, one row per module
 *   node process/lanes/plane-scope/research/layers/signals.mjs --layers        the placement, one row per module
 *   node process/lanes/plane-scope/research/layers/signals.mjs --order         the layers in the current order, and every inversion
 *   node process/lanes/plane-scope/research/layers/signals.mjs --hits <module> [n]   each signal's first n hits in a module
 *   node process/lanes/plane-scope/research/layers/signals.mjs --write         writes layers.json beside this file
 *   node process/lanes/plane-scope/research/layers/signals.mjs --dump <path>   everything, as JSON (a .json file in this folder,
 *                                                                              or under a scratchpad folder of the temporary directory)
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
const READ = {};   /* filled below by READ_ROWS (kept at the end of the file, it is long) */

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
export { OUT, BY, MODS, claims, firstHit, hitsOf, row, load, lineOf, lineText, fileSignals, CLOSURE, inPlane, modOf, ownerOf, READ, ROOT, HERE, P, KEYS, WANTED, TODAY, FLEET, WRITE_TO, args, sum };
