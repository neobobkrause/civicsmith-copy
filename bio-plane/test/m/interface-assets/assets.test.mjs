/* interface-assets at its interface (R1–R11; DEC-138; N897 (1); N559; N1039; K3254): `ASSET_FILES` read against the
   design stream's docs/development/ux-substrate/visual-language/ and screens/page.src.html at ASSETS_COMMIT, read from
   git so the working copy never moves it.
   Each check is a function returning its failures, so a negative control shows it refusing a wrong map. */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import * as assets from "../../../src/interface-assets/index.mjs";
import { ASSET_FILES, ASSETS_COMMIT } from "../../../src/interface-assets/index.mjs";
import { pageStyle, shellCss } from "../../../src/interface-assets/generate.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const MODULE = join(ROOT, "bio-plane/src/interface-assets/index.mjs");
const DIR = "docs/development/ux-substrate/visual-language";
const PAGE = "docs/development/ux-substrate/screens/page.src.html";
const COMMIT = "1b6f2bc383"; // R10 (T51): the design commit the START names (tranche head holding PR 191, DEC-412); 2a64c5ae77 before it, R9 named 7be06eb4cb and R8 f498560a37 before it
const R9_COMMIT = "7be06eb4cb";
const R10_COMMIT = "2a64c5ae77"; // the commit R10 was met at, before PR 191
const git = (args) => execFileSync("git", args, { cwd: ROOT, maxBuffer: 1 << 26 });
const atCommit = (path) => git(["show", `${ASSETS_COMMIT}:${DIR}/${path}`]);
const bytesOf = (e) => (e.encoding === "base64" ? Buffer.from(e.body, "base64") : Buffer.from(e.body, "utf8"));

/* What R1 says the map holds, stated from git independently of the generator. */
function expected() {
  const faces = git(["ls-tree", "--name-only", ASSETS_COMMIT, `${DIR}/fonts/`]).toString("utf8").split("\n")
    .filter((p) => p.endsWith(".woff2")).map((p) => p.slice(DIR.length + 1));
  const faceCss = atCommit("faces.css").toString("utf8");
  const rewritten = faceCss.split('url("fonts/').join('url("/app/assets/fonts/');
  const want = new Map([
    ["civicsmith.css", { type: "text/css", bytes: Buffer.concat([atCommit("civicsmith.css"), Buffer.from(rewritten, "utf8")]) }],
    ["shell.css", { type: "text/css", bytes: Buffer.from(shellCss(git(["show", `${ASSETS_COMMIT}:${PAGE}`]).toString("utf8")), "utf8") }],
    ["icons.svg", { type: "image/svg+xml", bytes: atCommit("icons.svg") }],
  ]);
  for (const f of faces) want.set(f, { type: "font/woff2", base64: true, bytes: atCommit(f) });
  for (const n of ["source-serif-4", "source-sans-3", "source-code-pro"])
    want.set(`fonts/OFL-${n}.txt`, { type: "text/plain", bytes: atCommit(`fonts/OFL-${n}.txt`) });
  return { want, faces, faceCss };
}

function r1Failures(files, commit) {
  const out = [];
  const { want } = expected();
  if (commit !== COMMIT) out.push(`ASSETS_COMMIT ${commit}, not ${COMMIT}`);
  const names = Object.keys(files);
  for (const n of names) if (!want.has(n)) out.push(`${n}: not a name R1 gives`);
  for (const [n, w] of want) {
    const e = files[n];
    if (!e) { out.push(`${n}: missing`); continue; }
    const keys = Object.keys(e).sort().join(",");
    if (keys !== (w.base64 ? "body,encoding,type" : "body,type")) out.push(`${n}: fields ${keys}`);
    if (e.type !== w.type) out.push(`${n}: type ${e.type}`);
    if (typeof e.body !== "string") { out.push(`${n}: body not a string`); continue; }
    if (w.base64 && e.encoding !== "base64") out.push(`${n}: encoding ${e.encoding}`);
    if (w.base64 && Buffer.from(e.body, "base64").toString("base64") !== e.body) out.push(`${n}: not canonical base64`);
    if (!bytesOf(e).equals(w.bytes)) out.push(`${n}: bytes differ from git at the commit`);
  }
  return out;
}

/* Every resource a file names, in url(), @import, href or src; R2 allows only /app/assets/… on the page's origin, and
   a fragment of the same file (#id). An XML namespace declaration (xmlns) names no resource. */
const REFS = [
  /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/gi,
  /@import\s+(?:url\(\s*)?(?:"([^"]*)"|'([^']*)'|([^\s;)'"]+))/gi,
  /(?<![\w-])(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
  /(?<![\w-])src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
];
function r2Failures(files) {
  const out = [];
  for (const [n, e] of Object.entries(files)) {
    const text = e.encoding === "base64" ? Buffer.from(e.body, "base64").toString("latin1") : e.body;
    for (const re of REFS)
      for (const m of text.matchAll(re)) {
        const ref = (m[1] ?? m[2] ?? m[3] ?? "").trim();
        const ok = (ref.startsWith("/app/assets/") && !ref.includes("..")) || /^#[\w-]+$/.test(ref);
        if (!ok) out.push(`${n}: names ${JSON.stringify(ref)}`);
      }
  }
  return out;
}

function r3Failures(files) {
  const out = [];
  if (!Object.isFrozen(files)) out.push("the map is not frozen");
  for (const [n, e] of Object.entries(files)) if (!Object.isFrozen(e)) out.push(`${n}: not frozen`);
  const tryWrite = (label, fn) => { try { fn(); out.push(`${label}: write accepted`); } catch (err) { if (!(err instanceof TypeError)) out.push(`${label}: ${err}`); } };
  tryWrite("add", () => { files["evil.css"] = { type: "text/css", body: "" }; });
  tryWrite("delete", () => { delete files["civicsmith.css"]; });
  for (const [n, e] of Object.entries(files)) {
    tryWrite(`${n} body`, () => { e.body = "x"; });
    tryWrite(`${n} type`, () => { e.type = "text/html"; });
    tryWrite(`${n} new field`, () => { e.extra = 1; });
  }
  return out;
}

/* R4: load a module in a fresh process whose every import, I/O, timer, clock and randomness source is watched. */
const WATCH = `
import { register } from "node:module";
import fs from "node:fs";
const seen = [];
globalThis.__seen = seen;
const { port1, port2 } = new MessageChannel();
port1.on("message", (m) => seen.push("import " + m)); port1.unref();
register("data:text/javascript," + encodeURIComponent(\`
  let port; export function initialize(d) { port = d.port; }
  export async function resolve(s, c, next) { if (c.parentURL && c.parentURL === process.env.WATCHED) port.postMessage(s); return next(s, c); }\`),
  import.meta.url, { data: { port: port2 }, transferList: [port2] });
const trap = (o, k, label) => { const f = o[k]; o[k] = function (...a) { if (globalThis.__on) seen.push(label); return f.apply(this, a); }; };
for (const k of Object.keys(fs)) if (typeof fs[k] === "function" && /^[a-z]/.test(k)) trap(fs, k, "fs." + k);
for (const k of Object.keys(fs.promises)) if (typeof fs.promises[k] === "function") trap(fs.promises, k, "fs.promises." + k);
trap(Date, "now", "Date.now"); trap(Math, "random", "Math.random"); trap(globalThis, "fetch", "fetch");
trap(globalThis, "setTimeout", "setTimeout"); trap(globalThis, "setInterval", "setInterval"); trap(globalThis, "queueMicrotask", "queueMicrotask");
trap(crypto, "getRandomValues", "crypto.getRandomValues"); trap(crypto, "randomUUID", "crypto.randomUUID");
trap(performance, "now", "performance.now");
const RealDate = Date;
globalThis.Date = new Proxy(RealDate, { construct(t, a) { if (globalThis.__on && a.length === 0) seen.push("new Date()"); return new t(...a); } });
`;
function loadWatched(path) {
  const dir = mkdtempSync(join(tmpdir(), "interface-assets-"));
  try {
    const hook = join(dir, "watch.mjs");
    writeFileSync(hook, WATCH);
    const url = pathToFileURL(path).href;
    const main = `globalThis.__on = true; const m = await import(${JSON.stringify(url)}); globalThis.__on = false;
      await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));
      process.stdout.write(JSON.stringify({ seen: globalThis.__seen, exports: Object.keys(m).sort() }));`;
    const r = spawnSync(process.execPath, ["--import", pathToFileURL(hook).href, "--input-type=module", "-e", main],
      { encoding: "utf8", env: { ...process.env, WATCHED: url }, maxBuffer: 1 << 26 });
    if (r.status !== 0) throw new Error(r.stderr);
    return JSON.parse(r.stdout);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
/* R4: index.mjs imports only its own face modules (./faces-<n>.mjs, R6's carriers), and a face module imports nothing. */
const FACE_MODULE = /^\.\/faces-\d+\.mjs$/;
function r4Failures(loaded) {
  const out = loaded.seen.filter((s) => !FACE_MODULE.test(s.replace(/^import /, ""))).map((s) => `does ${s} when loaded`);
  if (loaded.exports.join(",") !== "ASSETS_COMMIT,ASSET_FILES") out.push(`exports ${loaded.exports.join(",")}`);
  return out;
}
const HERE_SRC = dirname(MODULE);
const faceModules = () => readdirSync(HERE_SRC).filter((f) => FACE_MODULE.test(`./${f}`)).sort();
function faceModuleFailures(path) {
  const loaded = loadWatched(path);
  const out = loaded.seen.map((s) => `${path}: does ${s} when loaded`);
  if (!loaded.exports.every((e) => /^f\d+$/.test(e))) out.push(`${path}: exports ${loaded.exports.join(",")}`);
  return out;
}

test("R1, R5, R8, R9, R10: ASSETS_COMMIT is 1b6f2bc383 and ASSET_FILES holds exactly R1's 20 files and R7's shell.css, each equal byte for byte to git at the commit", () => {
  const { faces } = expected();
  assert.equal(faces.length, 15);
  assert.equal(Object.keys(ASSET_FILES).length, 21);
  assert.deepEqual(r1Failures(ASSET_FILES, ASSETS_COMMIT), []);
  // The stylesheet's stated rewriting: every face named at /app/assets/fonts/, no relative fonts/ url left.
  const css = ASSET_FILES["civicsmith.css"].body;
  assert.equal(css.split('url("/app/assets/fonts/').length - 1, 15);
  assert.ok(!css.includes('url("fonts/'));
});

test("R1 control: a wrong commit, a changed byte, a lost face, an extra name, a wrong type or a missing encoding is refused", () => {
  const copy = () => Object.fromEntries(Object.entries(ASSET_FILES).map(([n, e]) => [n, { ...e }]));
  assert.ok(r1Failures(ASSET_FILES, "8e5f57fad0").length > 0);
  assert.ok(r1Failures(ASSET_FILES, "3f40899950").length > 0, "R5: T45's commit no longer holds");
  let c = copy(); c["icons.svg"].body = c["icons.svg"].body.replace("svg", "SVG"); assert.ok(r1Failures(c, ASSETS_COMMIT).length > 0);
  c = copy(); c["civicsmith.css"].body = c["civicsmith.css"].body.split("/app/assets/fonts/").join("fonts/"); assert.ok(r1Failures(c, ASSETS_COMMIT).length > 0);
  c = copy(); const face = Object.keys(c).find((n) => n.endsWith(".woff2"));
  const b = Buffer.from(c[face].body, "base64"); b[b.length - 1] ^= 1; c[face].body = b.toString("base64"); assert.ok(r1Failures(c, ASSETS_COMMIT).length > 0);
  c = copy(); delete c[face]; assert.ok(r1Failures(c, ASSETS_COMMIT).length > 0);
  c = copy(); c["page.src.html"] = { type: "text/html", body: "" }; assert.ok(r1Failures(c, ASSETS_COMMIT).length > 0);
  c = copy(); c["icons.svg"].type = "text/xml"; assert.ok(r1Failures(c, ASSETS_COMMIT).length > 0);
  assert.ok(r1Failures(ASSET_FILES, "f498560a37").length > 0, "R9: the commit before R9 is refused");
  assert.ok(r1Failures(ASSET_FILES, R9_COMMIT).length > 0, "R10: R9's commit is refused");
  c = copy(); delete c[face].encoding; assert.ok(r1Failures(c, ASSETS_COMMIT).length > 0);
  c = copy(); c["fonts/OFL-source-sans-3.txt"].encoding = "base64"; assert.ok(r1Failures(c, ASSETS_COMMIT).length > 0);
});

test("R2, R7: no file of ASSET_FILES, shell.css among them, names a resource outside /app/assets/ on the page's own origin", () => {
  assert.ok("shell.css" in ASSET_FILES);
  assert.deepEqual(r2Failures(ASSET_FILES), []);
  // The scan sees the stylesheet's 15 face urls, so it is not reading nothing.
  assert.equal([...ASSET_FILES["civicsmith.css"].body.matchAll(REFS[0])].length, 15);
});

test("R2 control: another origin, a scheme-relative or relative url, an @import, an href or a src is refused", () => {
  for (const bad of [
    'a{background:url("https://fonts.example/x.woff2")}', "a{background:url(//cdn.example/x.png)}",
    "a{background:url('fonts/x.woff2')}", '@import "https://fonts.example/css";', "@import url(/elsewhere.css);",
    '<svg><use href="https://x.example/i.svg#a"/></svg>', '<svg><image xlink:href="data:image/png;base64,AA"/></svg>',
    '<img src="/other/x.png">', 'a{background:url("/app/assets/../secret")}',
  ]) assert.ok(r2Failures({ "x.css": { type: "text/css", body: bad } }).length > 0, bad);
  assert.deepEqual(r2Failures({ "x.svg": { type: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg"><use href="#a"/></svg>' } }), []);
});

test("R3: ASSET_FILES and each entry are frozen; no write changes the map, an entry or a field", () => {
  const before = JSON.stringify(ASSET_FILES);
  assert.deepEqual(r3Failures(ASSET_FILES), []);
  assert.equal(JSON.stringify(ASSET_FILES), before);
});

test("R3 control: an unfrozen map or entry is refused", () => {
  const open = { "a.css": Object.freeze({ type: "text/css", body: "" }) };
  assert.ok(r3Failures(open).length > 0);
  assert.ok(r3Failures(Object.freeze({ "a.css": { type: "text/css", body: "" } })).length > 0);
});

test("R4: loading the module imports nothing, does no I/O, timing or randomness, and defines only its two exports; every read answers the same", async () => {
  const loaded = loadWatched(MODULE);
  assert.deepEqual(r4Failures(loaded), []);
  assert.ok(faceModules().length > 0, "the faces live in face modules");
  assert.deepEqual(loaded.seen.map((s) => s.replace(/^import /, "")).sort(), faceModules().map((f) => `./${f}`), "imports exactly its face modules");
  for (const f of faceModules()) assert.deepEqual(faceModuleFailures(join(HERE_SRC, f)), []);
  assert.deepEqual(Object.keys(assets).sort(), ["ASSETS_COMMIT", "ASSET_FILES"]);
  const again = await import(`${pathToFileURL(MODULE).href}?again`);
  assert.equal(again.ASSETS_COMMIT, ASSETS_COMMIT);
  assert.deepEqual(again.ASSET_FILES, ASSET_FILES);
  assert.equal(JSON.stringify(ASSET_FILES), JSON.stringify(ASSET_FILES));
});

test("R4 control: a module that imports, reads a file, reads the clock or draws randomness when loaded is refused", () => {
  const dir = mkdtempSync(join(tmpdir(), "interface-assets-ctl-"));
  try {
    const cases = {
      "imports.mjs": 'import "./dep.mjs"; export const ASSET_FILES = {}, ASSETS_COMMIT = "";',
      "io.mjs": 'import fs from "node:fs"; fs.existsSync("/"); export const ASSET_FILES = {}, ASSETS_COMMIT = "";',
      "clock.mjs": "export const ASSET_FILES = { t: Date.now() }, ASSETS_COMMIT = String(new Date());",
      "random.mjs": "export const ASSET_FILES = { r: Math.random() }, ASSETS_COMMIT = \"\";",
      "extra.mjs": 'export const ASSET_FILES = {}, ASSETS_COMMIT = "", more = 1;',
    };
    writeFileSync(join(dir, "dep.mjs"), "export {};");
    for (const [f, body] of Object.entries(cases)) {
      writeFileSync(join(dir, f), body);
      assert.ok(r4Failures(loadWatched(join(dir, f))).length > 0, f);
    }
    // A face module that imports or reads the clock is refused; one that only defines its faces passes.
    writeFileSync(join(dir, "faces-1.mjs"), 'import "./dep.mjs"; export const f0 = () => "";');
    assert.ok(faceModuleFailures(join(dir, "faces-1.mjs")).length > 0, "a face module that imports");
    writeFileSync(join(dir, "faces-2.mjs"), 'export const f0 = () => String(Date.now());\nexport const t = Date.now();');
    assert.ok(faceModuleFailures(join(dir, "faces-2.mjs")).length > 0, "a face module that reads the clock");
    writeFileSync(join(dir, "faces-3.mjs"), 'export const f0 = () => "AA==";');
    assert.deepEqual(faceModuleFailures(join(dir, "faces-3.mjs")), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

/* R5: the stylesheet's rules, comments removed, as {media, sel, body}; a rule inside an @media block carries its query. */
function rules(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  let media = null, depth = 0, i = 0, start = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "{") {
      const pre = text.slice(start, i).trim();
      if (pre.startsWith("@")) { media = pre; depth++; start = i + 1; i++; continue; }
      const end = text.indexOf("}", i);
      out.push({ media: depth ? media : null, sel: pre, body: text.slice(i + 1, end) });
      i = end + 1; start = i; continue;
    }
    if (c === "}") { depth--; if (!depth) media = null; start = i + 1; }
    i++;
  }
  return out;
}
/* A selector list split at its top-level commas only (never inside parentheses or brackets, as :is([type="a"],[type="b"])). */
const sels = (r) => {
  const out = []; let depth = 0, cur = "";
  for (const c of r.sel) {
    if (c === "(" || c === "[") depth++; else if (c === ")" || c === "]") depth--;
    if (c === "," && !depth) { out.push(cur.trim()); cur = ""; } else cur += c;
  }
  out.push(cur.trim());
  return out;
};
const KINDS = ["--c-kind-money", "--c-kind-part", "--c-kind-mention"];
function r5Failures(css) {
  const out = [];
  if (/cursor\s*:\s*help/i.test(css)) out.push("cursor: help");
  const all = rules(css);
  for (const r of all) if (sels(r).some((s) => /^\.cs-card(?![\w-])\S*$/.test(s)) && /(^|[;\s])cursor\s*:/.test(r.body)) out.push(`${r.sel}: a cursor`);
  for (const k of KINDS) {
    const at = all.filter((r) => new RegExp(`${k}\\s*:`).test(r.body));
    if (!at.some((r) => !r.media)) out.push(`${k}: not in light`);
    if (!at.some((r) => /prefers-color-scheme:\s*dark/.test(r.media ?? "") || /data-theme="dark"/.test(r.sel))) out.push(`${k}: not in dark`);
  }
  return out;
}

test("R5, R8, R9, R10: civicsmith.css at 1b6f2bc383 holds no cursor: help, no cursor in .cs-card, and the three kind tokens light and dark", () => {
  assert.equal(ASSETS_COMMIT, COMMIT);
  const css = ASSET_FILES["civicsmith.css"].body;
  assert.deepEqual(r5Failures(css), []);
  // Control: the cursor stays over a control, so the scan reads real rules.
  assert.ok(rules(css).some((r) => sels(r).includes(".cs-btn") && /cursor\s*:\s*pointer/.test(r.body)), ".cs-btn keeps cursor: pointer");
  assert.ok(rules(css).some((r) => sels(r).includes(".cs-card")), "the scan finds .cs-card");
});

test("R5 control: a help cursor, a cursor on .cs-card or a missing light or dark kind token is refused", () => {
  const css = ASSET_FILES["civicsmith.css"].body;
  assert.ok(r5Failures(css + "\n.cs-mark { cursor: help; }").length > 0);
  assert.ok(r5Failures(css + "\n.cs-card { cursor: pointer; }").length > 0);
  assert.ok(r5Failures(css + "\n.cs-card:hover { cursor: default }").length > 0);
  assert.ok(r5Failures(css.split("--c-kind-part").join("--c-kind-x")).length > 0);
  const lightOnly = rules(css).filter((r) => !r.media && !/data-theme="dark"/.test(r.sel)).map((r) => `${r.sel} {${r.body}}`).join("\n");
  assert.ok(r5Failures(lightOnly).some((f) => f.endsWith("not in dark")));
});

/* R6: a fresh process imports the module, measuring its heap and time (bundler R31's fresh import), then reads every
   face; a face's text is built only on its read. */
function faceHeap(path) {
  const script = `
    gc(); const h0 = process.memoryUsage().heapUsed; const t0 = performance.now();
    const m = await import(${JSON.stringify(pathToFileURL(path).href)});
    const importMs = performance.now() - t0; gc(); const h1 = process.memoryUsage().heapUsed;
    const faces = Object.entries(m.ASSET_FILES).filter(([n]) => n.endsWith(".woff2"));
    let chars = 0; for (const [, e] of faces) chars += e.body.length;
    gc(); const h2 = process.memoryUsage().heapUsed;
    process.stdout.write(JSON.stringify({ importMs, atImport: h1 - h0, onRead: h2 - h1, chars, faces: faces.length }));`;
  const r = spawnSync(process.execPath, ["--expose-gc", "--input-type=module", "-e", script], { encoding: "utf8", maxBuffer: 1 << 26 });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

test("R6: a fresh import evaluates no face; each face's base64 is built on its first read, byte-identical to R1's", () => {
  const m = faceHeap(MODULE);
  console.log(`interface-assets R6: import ${m.importMs.toFixed(1)} ms (bundler R31 budget 500 ms), heap at import ${(m.atImport / 1024) | 0} KB, on reading the faces ${(m.onRead / 1024) | 0} KB of ${(m.chars / 1024) | 0} KB base64`);
  assert.equal(m.faces, 15);
  /* Node keeps a module's source text on the heap when it is under about 1 MiB (each face module is, by the size rule),
     and off it above; that text is not a face built. So the import holds the face modules' source and under half the
     faces beyond it; an eager module builds every face's string at import (the control below). */
  const source = faceModules().reduce((a, f) => a + statSync(join(HERE_SRC, f)).size, 0);
  assert.ok(m.atImport - source < m.chars / 2, `the import holds ${m.atImport} bytes, ${m.atImport - source} beyond the face modules' ${source}, not under half the faces' ${m.chars}`);
  assert.ok(m.onRead > m.chars * 0.75, `reading the faces built ${m.onRead} bytes of their ${m.chars}`);
  // Every read answers the same text, equal to R1's bytes (R1's test checks each against git).
  for (const [n, e] of Object.entries(ASSET_FILES)) if (n.endsWith(".woff2")) assert.equal(e.body, ASSET_FILES[n].body);
  assert.deepEqual(r1Failures(ASSET_FILES, ASSETS_COMMIT), []);
});

test("R6 control: a module holding its faces as base64 literals in the global scope is refused, also when split under 1 MiB", () => {
  const dir = mkdtempSync(join(tmpdir(), "interface-assets-r6-"));
  try {
    const eager = join(dir, "eager.mjs");
    const faces = Object.entries(ASSET_FILES).filter(([n]) => n.endsWith(".woff2"))
      .map(([n, e]) => `  ${JSON.stringify(n)}: Object.freeze({ type: "font/woff2", encoding: "base64", body: ${JSON.stringify(e.body)} }),`);
    writeFileSync(eager, `export const ASSETS_COMMIT = "x";\nexport const ASSET_FILES = Object.freeze({\n${faces.join("\n")}\n});\n`);
    const m = faceHeap(eager);
    assert.ok(!(m.atImport < m.chars / 2), `an eager module held only ${m.atImport} bytes at import`);
    // Split eager: the faces as top-level strings in two face modules; beyond their source the import still holds every face.
    const entries = Object.entries(ASSET_FILES).filter(([n]) => n.endsWith(".woff2"));
    const half = Math.ceil(entries.length / 2);
    const parts = [entries.slice(0, half), entries.slice(half)];
    parts.forEach((p, k) => writeFileSync(join(dir, `faces-${k + 1}.mjs`), p.map(([, e], i) => `export const f${k * half + i} = ${JSON.stringify(e.body)}.split("").join("");\n`).join("")));
    writeFileSync(join(dir, "split.mjs"), `import * as a from "./faces-1.mjs"; import * as b from "./faces-2.mjs";\nconst all = { ...a, ...b };\nexport const ASSETS_COMMIT = "x";\nexport const ASSET_FILES = Object.freeze(Object.fromEntries(Object.keys(all).map((k) => ["fonts/" + k + ".woff2", Object.freeze({ type: "font/woff2", encoding: "base64", body: all[k] })])));\n`);
    const sm = faceHeap(join(dir, "split.mjs"));
    const src = [1, 2].reduce((a, k) => a + statSync(join(dir, `faces-${k}.mjs`)).size, 0);
    assert.ok(!(sm.atImport - src < sm.chars / 2), `a split eager module held only ${sm.atImport - src} bytes beyond its source`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

/* R7: shell.css is the generator's transform of the page's <style> at ASSETS_COMMIT. */
const PHONE_QUERY = "@media (max-width: 760px)";
const PHONE_WEIGHT = ":root:root "; // K3295: the design's phone prefix keeps its weight
/* K3295: the unprefixed product classes R7 carries by name: .e, .e-*, .gchip, .cell, .st (with its .st-a…), .row, .tw. */
const PRODUCT = /\.(e|e-[\w-]+|gchip|cell|st|st-[a-z]|row|tw)(?![\w-])/;
/* The selectors the page's own @media (max-width: 760px) block holds at the commit, as R7 carries them: those rules are
   not phone rules, so they keep their own query and need no prefix's weight. */
function sourceQuerySels() {
  const page = git(["show", `${ASSETS_COMMIT}:${PAGE}`]).toString("utf8");
  return new Set(rules(pageStyle(page)).filter((r) => r.media === PHONE_QUERY).flatMap(sels)
    .map((s) => s.replace(/\.mk-page(?![\w-])/g, ".cs-frame")));
}
function r7Failures(css, sourceQuery = new Set()) {
  const out = [];
  for (const r of rules(css)) for (const s of sels(r)) {
    if (/\.(mk-device|mk-scaler|mk-mockctl|mk-osprompt|anat|asfig|viewer|vlist|mk-page)(?![\w-])/.test(s)) out.push(`${s}: names a mock-only or page class`);
    if (!/\.(mk|cs)-[\w-]/.test(s) && !PRODUCT.test(s)) out.push(`${s}: names no cs- or mk- class nor one R7 lists`);
    if (r.media === PHONE_QUERY && !s.startsWith(PHONE_WEIGHT) && !sourceQuery.has(s)) out.push(`${s}: a phone rule without the prefix's weight`);
  }
  return out;
}

test("R7: shell.css equals the generator's transform of page.src.html's <style> at ASSETS_COMMIT, with the product rules and the phone rules under the 760 px query", () => {
  const e = ASSET_FILES["shell.css"];
  assert.equal(e.type, "text/css");
  assert.equal(e.body, shellCss(git(["show", `${ASSETS_COMMIT}:${PAGE}`]).toString("utf8")));
  const all = rules(e.body);
  for (const c of [".mk-door", ".mk-acts", ".mk-frontgrid", ".mk-avatar"])
    assert.ok(all.some((r) => !r.media && sels(r).includes(c)), `${c} carried`);
  assert.ok(all.some((r) => r.media === PHONE_QUERY && sels(r).includes(PHONE_WEIGHT + ".cs-tabs")), ".cs-tabs inside the 760 px query, weighted");
  // K3295: the named product classes the carried components draw, each carried.
  for (const c of [".e", ".e-pos", ".e-part", ".e-money", ".e-money-in", ".e-ment", ".e-lead", ".e-same", ".gchip rect", ".gchip.subject text", ".cell", ".cell h4", ".cell ul", ".st", ".cs-frame .row", ".tw"])
    assert.ok(all.some((r) => !r.media && sels(r).includes(c)), `${c} carried`);
  assert.ok(all.some((r) => !r.media && sels(r).includes("main[data-st=\"b\"] .st-b")), ".st's states carried");
  // The weight keeps the design's cascade: the phone tab bar beats the frame's desktop hiding of it.
  assert.ok(all.some((r) => !r.media && sels(r).includes(".cs-frame .cs-tabs")));
  assert.ok(all.some((r) => sels(r).some((s) => s.startsWith(".cs-frame"))), ".mk-page carried as .cs-frame");
  assert.deepEqual(r7Failures(e.body, sourceQuerySels()), []);
});

test("R7 control: the transform drops mock-only, page and unlisted unprefixed rules, weights the phone prefix as :root:root and rewrites .mk-page; the scan refuses a stray rule", () => {
  const src = `<style>\n{{FACES}}\n{{CSS}}\n/* a comment { } */
.doc { margin: 0; }
.mk-door { cursor: pointer; } .mk-door b { font-size: 1px; }
.mk-device { padding: 10px; } .mk-scaler { transform: none; } .mk-mockctl, .mk-acts { gap: 1px; }
.asfig .mk-device { padding: 6px; } .anat .mk-x { gap: 0; } .vlist .cs-x { gap: 0; }
.mk-page .cs-tabs { display: none; } .mk-page.cs-shell { display: grid; }
.mk-tl::before { content: ", ;"; }
@media (max-width: 900px) { .viewer { gap: 0; } }
@media (max-width: 560px) { .mk-facts { grid-template-columns: 1fr; } .anat { gap: 0; } }
.mk-device[data-device="phone"] .cs-tabs { display: grid; }
.mk-device[data-device="phone"] .mk-page.cs-shell { grid-template-rows: auto; }
.mk-device[data-device="phone"] { border-radius: 28px; }
</style>`;
  const out = shellCss(src);
  const all = rules(out);
  const at = (media) => all.filter((r) => r.media === media).map((r) => `${r.sel} {${r.body.trim() ? ` ${r.body.trim()} ` : ""}}`);
  assert.deepEqual(at(null), [".mk-door { cursor: pointer; }", ".mk-door b { font-size: 1px; }", ".cs-frame .cs-tabs { display: none; }",
    ".cs-frame.cs-shell { display: grid; }", '.mk-tl::before { content: ", ;"; }']);
  assert.deepEqual(at("@media (max-width: 560px)"), [".mk-facts { grid-template-columns: 1fr; }"]);
  assert.deepEqual(at(PHONE_QUERY), [":root:root .cs-tabs { display: grid; }", ":root:root .cs-frame.cs-shell { grid-template-rows: auto; }"]);
  // K3295: a listed product class is carried, an unlisted unprefixed one is not.
  assert.equal(rules(shellCss("<style>.e-money { stroke: red; } .cell h4 { margin: 0; } .seg { gap: 0; } .cellar { gap: 0; }</style>")).map((r) => r.sel).join("|"), ".e-money|.cell h4");
  assert.deepEqual(r7Failures(out), []);
  // A brace or comma inside a string never splits a rule or a selector list.
  assert.equal(shellCss('<style>.mk-q::after { content: "} {"; } .mk-q[title="a, b"] { gap: 0; }</style>').split("\n").slice(2).join("\n"),
    '.mk-q::after { content: "} {"; }\n.mk-q[title="a, b"] { gap: 0; }\n');
  assert.ok(r7Failures(".mk-device .mk-x { gap: 0; }").length > 0);
  assert.ok(r7Failures(".mk-scaler { gap: 0; }").length > 0);
  assert.ok(r7Failures(".anat .mk-x { gap: 0; }").length > 0);
  assert.ok(r7Failures(".seg { gap: 0; }").length > 0);
  assert.ok(r7Failures(`${PHONE_QUERY} { .cs-tabs { display: grid; } }`).length > 0, "a phone rule that lost its weight");
});

/* R8: the classes DEC-236 and DEC-241 added to shell.css, and the test band in civicsmith.css, each named by a rule. */
const R8_SHELL = [".mk-menuwrap", ".mk-menu", ".mk-actwrap", ".mk-slot", ".mk-rowname", ".mk-scrim", ".mk-image", ".mk-imgareas",
  ".mk-imgarea", "button.mk-avatar", ".mk-grp", ".e-step_source", ".mk-morerows", ".mk-morerow"];
const R8_BAND = '.cs-band[data-band="test"]';
/* A selector names a class when the class is one of its tokens: `.mk-slot:empty` names `.mk-slot`, `.mk-morerows` not `.mk-morerow`. */
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const namedBy = (list, name) => list.some((s) => new RegExp(`(^|[\\s>+~,])${escapeRe(name)}(?![\\w-])`).test(s));
function r8Failures(shell, civicsmith) {
  const out = [];
  const shellSels = rules(shell).flatMap(sels);
  for (const c of R8_SHELL) if (!namedBy(shellSels, c)) out.push(`shell.css: no rule for ${c}`);
  if (!namedBy(rules(civicsmith).flatMap(sels), R8_BAND)) out.push(`civicsmith.css: no rule for ${R8_BAND}`);
  return out;
}

test("R8: shell.css carries DEC-236's classes, .e-step_source and DEC-241's .mk-morerows and .mk-morerow; civicsmith.css carries .cs-band[data-band=\"test\"]", () => {
  assert.deepEqual(r8Failures(ASSET_FILES["shell.css"].body, ASSET_FILES["civicsmith.css"].body), []);
  // Each named rule is in the page's source at the commit, so the carried rules are not invented here.
  const page = git(["show", `${ASSETS_COMMIT}:${PAGE}`]).toString("utf8");
  for (const c of R8_SHELL) assert.ok(page.includes(c), `${c} in page.src.html at the commit`);
  assert.ok(atCommit("civicsmith.css").toString("utf8").includes(R8_BAND));
  // R8 is met by the R1 bytes too: the carried stylesheet is the generator's transform of the page at the commit.
  assert.deepEqual(r1Failures(ASSET_FILES, ASSETS_COMMIT), []);
  assert.deepEqual(r7Failures(ASSET_FILES["shell.css"].body, sourceQuerySels()), []);
});

test("R8 control: a shell.css without one named class, a civicsmith.css without the band, and a shell rule naming mk-device or mk-scaler are refused", () => {
  const shell = ASSET_FILES["shell.css"].body;
  const civ = ASSET_FILES["civicsmith.css"].body;
  assert.ok(r8Failures(shell.split(".mk-morerow").join(".mk-morerowx"), civ).some((f) => f.includes(".mk-morerow")));
  assert.ok(r8Failures(shell.split(".e-step_source").join(".e-stepx"), civ).some((f) => f.includes(".e-step_source")));
  assert.ok(r8Failures(shell, civ.split(R8_BAND).join('.cs-band[data-band="x"]')).some((f) => f.includes("cs-band")));
  assert.ok(r7Failures(shell + "\n.mk-device .mk-menu { gap: 0; }").length > 0);
  assert.ok(r7Failures(shell + "\n.mk-scaler .mk-grp { gap: 0; }").length > 0);
});

/* R9: the classes DEC-280 (.cs-btn's pressed, working and done states), DEC-249 (the test band) and DEC-279 (.cs-part and
   .cs-choice) added to civicsmith.css at the design commit the START names. `[aria-busy="true"]` is the stylesheet's own
   spelling of the working state. */
const R9_CLASSES = [".cs-btn:active", '.cs-btn[aria-busy="true"]', ".cs-btn[data-done]", ".cs-testband", ".cs-part", ".cs-choice"];
function r9Failures(civicsmith) {
  const named = rules(civicsmith).flatMap(sels);
  return R9_CLASSES.filter((c) => !namedBy(named, c)).map((c) => `civicsmith.css: no rule for ${c}`);
}

test("R9, R10: ASSETS_COMMIT is 1b6f2bc383, the design commit the START names; civicsmith.css names each class DEC-280, DEC-249 and DEC-279 added; each served file is R1's bytes and R7's transform", () => {
  assert.equal(ASSETS_COMMIT, COMMIT);
  const civ = ASSET_FILES["civicsmith.css"].body;
  assert.deepEqual(r9Failures(civ), []);
  assert.ok(civ.includes(R8_BAND), "R8's band is kept");
  assert.deepEqual(r1Failures(ASSET_FILES, ASSETS_COMMIT), []);
  assert.equal(ASSET_FILES["shell.css"].body, shellCss(git(["show", `${ASSETS_COMMIT}:${PAGE}`]).toString("utf8")));
  assert.deepEqual(r7Failures(ASSET_FILES["shell.css"].body, sourceQuerySels()), []);
});

test("R9 control: another commit, a hand edit of a served file, and a stylesheet missing one named class are refused", () => {
  const civ = ASSET_FILES["civicsmith.css"].body;
  assert.ok(r1Failures(ASSET_FILES, "f498560a37").length > 0, "R9: the commit before R9 is refused");
  for (const c of R9_CLASSES) assert.ok(r9Failures(civ.split(c).join(c.replace(/\.cs-/, ".cs-x"))).some((f) => f.includes(c)), c);
  const copy = Object.fromEntries(Object.entries(ASSET_FILES).map(([n, e]) => [n, { ...e }]));
  copy["civicsmith.css"].body = civ + "\n/* a hand edit */";
  assert.ok(r1Failures(copy, ASSETS_COMMIT).some((f) => f.startsWith("civicsmith.css")), "a hand edit of a served file fails the equality");
});

/* R10: the design as merged into tranche/T51 at ASSETS_COMMIT, and no style a screen carries of its own. The drawings'
   class literals are read from git at the commit; a class they write that neither served stylesheet defines is a failure,
   except the markers and mock-only classes R10 lists. */
const SCREENS = "docs/development/ux-substrate/screens/";
const DRAWINGS = ["mock-screens.js", "mock-shell.js", "mock-kit.js", "mock-acts.js", "mock-refs.js"];
/* Found at 1b6f2bc383 by R10's scan (its control's purpose): drawn, in neither stylesheet and not in R10's marker list.
   mk-det (mock-screens.js cdPart's <div>) and mk-widen (a hook mock-screens.js's querySelector toggles with hidden).
   Whether each is a marker or owes a style is UX-DESIGN's, reported to BOB; the scan stays exact, so any other new class fails. */
const R10_FOUND = ["mk-det", "mk-widen"];
const R10_NO_STYLE = ["mk-data", "mk-codes", "mk-cv", "mk-unpick", "mk-updband", "mk-lvlbtn", "mk-front", "mk-held", "mk-used", "mk-page", "mk-mockctl", "mk-osprompt"];
const classesIn = (css) => new Set([...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]));
function drawnClasses(readDrawing) {
  const used = new Set();
  for (const f of DRAWINGS)
    for (const m of readDrawing(f).matchAll(/class\s*=\s*\\?["']([^"'\\]*)\\?["']|class\s*:\s*["']([^"']*)["']|["']class["']\s*:\s*["']([^"']*)["']|className\s*=\s*["']([^"']*)["']/g))
      for (const c of (m[1] ?? m[2] ?? m[3] ?? m[4]).split(/\s+/)) if (/^(mk|cs)-[\w-]+$/.test(c)) used.add(c);
  return used;
}
function r10Undefined(files, readDrawing) {
  const defined = classesIn(files["civicsmith.css"].body + files["shell.css"].body);
  return [...drawnClasses(readDrawing)].filter((c) => !defined.has(c) && !R10_NO_STYLE.includes(c)).sort();
}
const drawing = (f) => git(["show", `${ASSETS_COMMIT}:${SCREENS}${f}`]).toString("utf8");

test("R10: ASSETS_COMMIT is the START's design commit; the visual files are R9's, shell.css holds the 32 px sort buttons and the further st- states, icons.svg holds the three icons, and every class the drawings write is defined", () => {
  assert.equal(ASSETS_COMMIT, COMMIT);
  assert.deepEqual(r1Failures(ASSET_FILES, ASSETS_COMMIT), []);
  // At R10's own commit, civicsmith.css was byte-identical to R9's (read from git); the served one is R1's bytes at the
  // pin (above), which since PR 191 (DEC-412) also carries .cs-btn's var(--tap). The 15 faces and three licences are R9's.
  const at9 = (p) => git(["show", `${R9_COMMIT}:${DIR}/${p}`]);
  const at10 = (p) => git(["show", `${R10_COMMIT}:${DIR}/${p}`]);
  assert.ok(at10("civicsmith.css").equals(at9("civicsmith.css")) && at10("faces.css").equals(at9("faces.css")), "civicsmith.css at R10's commit is R9's");
  for (const n of Object.keys(ASSET_FILES).filter((k) => k.startsWith("fonts/")))
    assert.ok(bytesOf(ASSET_FILES[n]).equals(at9(n)), `${n} is R9's`);
  // DEC-330: the sort buttons are 32 px tall; the state-switching rule carries .st-j, .st-k and .st-l.
  const all = rules(ASSET_FILES["shell.css"].body);
  const sort = all.find((r) => !r.media && sels(r).includes(".mk-sort"));
  assert.ok(sort, ".mk-sort carried");
  for (const d of ["display: inline-block", "padding: 7px 0", "min-height: 32px", "box-sizing: border-box"]) assert.ok(sort.body.includes(d), `.mk-sort: ${d}`);
  const states = all.filter((r) => !r.media).flatMap(sels);
  for (const s of ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"]) assert.ok(states.includes(`main[data-st="${s}"] .st-${s}`), `.st-${s} switched`);
  // The three icons the drawings reference (DEC-335 (4)), and the group icon, are symbols of icons.svg.
  const icons = ASSET_FILES["icons.svg"].body;
  for (const id of ["i-group", "i-document", "i-due", "i-sever"]) assert.ok(new RegExp(`<symbol id="${id}"`).test(icons), id);
  // No class the drawings write is left without a style, and the scan reads real class attributes.
  assert.ok(drawnClasses(drawing).size > 100, "the scan finds the drawings' classes");
  assert.deepEqual(r10Undefined(ASSET_FILES, drawing), R10_FOUND);
  // No print rule is written by hand: every @media print rule of shell.css is the transform's (R7's equality above).
  assert.equal(ASSET_FILES["shell.css"].body, shellCss(git(["show", `${ASSETS_COMMIT}:${PAGE}`]).toString("utf8")));
});

test.todo("R10 at 1b6f2bc383: mk-det and mk-widen, drawn since 2a64c5ae77, are styled or named markers (UX-DESIGN, reported to BOB)");

test("R10 control: a drawn class with no style fails the scan, so a later design commit's new class is found; a hand edit of a served file or R9's commit is refused", () => {
  const files = ASSET_FILES;
  assert.deepEqual(r10Undefined(files, (f) => drawing(f) + '\n<div class="mk-newthing cs-another">'), ["cs-another", ...R10_FOUND, "mk-newthing"].sort());
  for (const c of R10_NO_STYLE) assert.deepEqual(r10Undefined(files, (f) => drawing(f) + `\n<i class="${c}">`), R10_FOUND, `${c} is a marker`);
  assert.ok(r10Undefined({ "civicsmith.css": { body: "" }, "shell.css": { body: "" } }, drawing).length > 0);
  assert.ok(r1Failures(ASSET_FILES, R9_COMMIT).length > 0, "R9's commit is refused");
  const copy = Object.fromEntries(Object.entries(ASSET_FILES).map(([n, e]) => [n, { ...e }]));
  copy["shell.css"].body += "\n.mk-sort { min-height: 20px; }";
  assert.ok(r1Failures(copy, ASSETS_COMMIT).some((f) => f.startsWith("shell.css")));
});

/* R11: the team name's classes, in the masthead (.cs-mast .grp) and the public frame's header (.cs-pubhead .grp), and
   their containers, carry no rule that cuts or hides overflow; the name wraps. */
const CUTS = /text-overflow\s*:|white-space\s*:\s*nowrap|overflow(-x)?\s*:\s*(hidden|clip)/i;
function r11Failures(files) {
  const out = [];
  const all = [...rules(files["civicsmith.css"].body), ...rules(files["shell.css"].body)];
  const names = /(^|[\s>+~])(\.cs-mast|\.cs-pubhead|\.grp|\.mk-grp)(?![\w-])/;
  for (const r of all) if (sels(r).some((s) => names.test(s) && !/(\.cs-rail|\.mk-usermenu)/.test(s)) && CUTS.test(r.body)) out.push(`${r.sel}: cuts or hides overflow`);
  if (!all.some((r) => sels(r).includes(".mk-grp") && /overflow-wrap\s*:\s*(anywhere|break-word)/.test(r.body))) out.push(".mk-grp: does not wrap a long name");
  for (const s of [".cs-mast .grp", ".cs-pubhead .grp"]) if (!all.some((r) => sels(r).includes(s))) out.push(`${s}: no rule, the scan reads nothing`);
  return out;
}

test("R11: the masthead's and the public header's team name are cut by no rule of the two stylesheets, and .mk-grp wraps a long name", () => {
  assert.deepEqual(r11Failures(ASSET_FILES), []);
});

test("R11 control: an ellipsis, a nowrap or a hidden overflow on the name or its container, or a .mk-grp that cannot wrap, is refused", () => {
  const withCss = (extra) => ({ ...ASSET_FILES, "shell.css": { ...ASSET_FILES["shell.css"], body: ASSET_FILES["shell.css"].body + extra } });
  for (const extra of ["\n.cs-mast .grp { text-overflow: ellipsis; }", "\n.cs-pubhead .grp { white-space: nowrap; }", "\n.cs-mast { overflow: hidden; }", "\n.mk-grp { overflow: hidden; }"])
    assert.ok(r11Failures(withCss(extra)).length > 0, extra);
  const noWrap = { ...ASSET_FILES, "shell.css": { ...ASSET_FILES["shell.css"], body: ASSET_FILES["shell.css"].body.split("overflow-wrap: anywhere").join("overflow-wrap: normal") } };
  assert.ok(r11Failures(noWrap).some((f) => f.includes("wrap")));
});

/* DEC-412 (PR 191; site R18): .cs-btn is min-height var(--tap), 44 px at every width, not 40 px with only the phone
   query raising it. Read from the served stylesheet, so a pin before PR 191 fails here. */
function tapFailures(css) {
  const out = [];
  const all = rules(css);
  const btn = all.filter((r) => !r.media && sels(r).includes(".cs-btn") && /min-height\s*:/.test(r.body));
  if (btn.length === 0) out.push(".cs-btn: no min-height outside a media query");
  for (const r of btn) { const m = /min-height\s*:\s*([^;]+)/.exec(r.body)[1].trim(); if (m !== "var(--tap)") out.push(`.cs-btn: min-height ${m}`); }
  const tap = all.filter((r) => !r.media && /--tap\s*:/.test(r.body)).map((r) => /--tap\s*:\s*([^;]+)/.exec(r.body)[1].trim());
  if (!tap.includes("44px")) out.push(`--tap: ${tap.join(",") || "undefined"}, not 44px`);
  return out;
}

test("DEC-412 (site R18): .cs-btn's min-height is var(--tap), and --tap is 44px, at every width", () => {
  assert.deepEqual(tapFailures(ASSET_FILES["civicsmith.css"].body), []);
});

test("DEC-412 control: a .cs-btn at 40px, or a --tap other than 44px, is refused", () => {
  const css = ASSET_FILES["civicsmith.css"].body;
  assert.ok(tapFailures(css.replace(/(\.cs-btn \{[^}]*?)min-height: var\(--tap\)/, "$1min-height: 40px")).some((f) => f.includes("40px")));
  assert.ok(tapFailures(css.split("--tap: 44px").join("--tap: 40px")).some((f) => f.startsWith("--tap")));
});

/* R6 (F1): the import's heap margin does not rest on the machine. index.mjs is ASCII, so Node holds its source as a
   one-byte string (a single character above U+00FF doubles it), and every body, text or face, is a getter built on its
   first read, so a fresh import holds no file's text beyond the modules' source. */
function eagerFailures(source, map) {
  const out = [];
  const wide = [...source].filter((c) => c.charCodeAt(0) > 0x7f);
  if (wide.length) out.push(`index.mjs holds ${wide.length} non-ASCII characters (${[...new Set(wide)].join(" ")})`);
  for (const [n, e] of Object.entries(map)) if (!Object.getOwnPropertyDescriptor(e, "body")?.get) out.push(`${n}: body built at import`);
  return out;
}

test("R6 (F1): index.mjs is ASCII and every body of ASSET_FILES is built on its first read", () => {
  assert.deepEqual(eagerFailures(readFileSync(MODULE, "utf8"), ASSET_FILES), []);
});

test("R6 (F1) control: a non-ASCII character in index.mjs, or a body held as a value at import, is refused", () => {
  assert.ok(eagerFailures(readFileSync(MODULE, "utf8") + "/* R1\u2013R10 */", ASSET_FILES).some((f) => f.includes("non-ASCII")));
  const held = { ...ASSET_FILES, "icons.svg": Object.freeze({ type: "image/svg+xml", body: ASSET_FILES["icons.svg"].body }) };
  assert.deepEqual(eagerFailures(readFileSync(MODULE, "utf8"), held), ["icons.svg: body built at import"]);
});

/* R4, R6 (BOB #45): every file the generator writes is under the process's max_file_bytes, so it can be committed. */
const MAX_FILE_BYTES = 1048576;
const generatedFiles = () => ["index.mjs", ...faceModules()].map((f) => join(HERE_SRC, f));
const oversize = (paths, size = (p) => statSync(p).size) => paths.filter((p) => size(p) > MAX_FILE_BYTES).map((p) => `${p}: ${size(p)} bytes`);

test("R4, R6: index.mjs and each face module are under 1,048,576 bytes, and together carry all 15 faces", () => {
  assert.deepEqual(oversize(generatedFiles()), []);
  const exported = faceModules().map((f) => readFileSync(join(HERE_SRC, f), "utf8").match(/^export const f\d+ = /gm).length).reduce((a, b) => a + b, 0);
  assert.equal(exported, 15);
});

test("R4, R6 control: a file over the cap is refused", () => {
  assert.equal(oversize([MODULE], () => MAX_FILE_BYTES + 1).length, 1);
  assert.deepEqual(oversize([MODULE], () => MAX_FILE_BYTES), []);
});
