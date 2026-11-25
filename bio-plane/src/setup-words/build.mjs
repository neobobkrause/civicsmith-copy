/* setup-words' generator (R10, R15–R18): `docs/development/ux-substrate/screens/words.json` as it stands in the product
   tree, plus every `localize(id, en)` call in the product's source, becomes `bio-plane/src/setup-words/rows.mjs` and the
   design's review list `words-unreviewed.json`. Run from the repository root:
     node bio-plane/src/setup-words/build.mjs            write rows.mjs and words-unreviewed.json
     node bio-plane/src/setup-words/build.mjs --check    exit 1, naming the first difference, when either is stale
     node bio-plane/src/setup-words/build.mjs --pseudo   write the pseudo-locale rows (R17), never committed
   `--words <file>`, `--out <file>`, `--unreviewed <file>` and `--root <dir>` name other paths (the tests' fixtures);
   the review list is written beside `--out` unless named. Never imported by the module (R4), so never bundled. The
   parser is the vendored acorn (vendor/). */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse } from "./vendor/acorn.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../..");
export const WORDS_PATH = join(ROOT, "docs/development/ux-substrate/screens/words.json");
export const ROWS_PATH = join(HERE, "rows.mjs");
export const PSEUDO_PATH = join(HERE, "rows.pseudo.mjs");
const WORDS_FROM_ROOT = "docs/development/ux-substrate/screens/words.json";
const ROWS_FROM_ROOT = "bio-plane/src/setup-words/rows.mjs";

const fail = (message) => new Error(`setup-words build: ${message}`);

/* R14's id: dotted, at least two segments, each of letters, digits, `_` and `-`. */
export const ID_RE = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)+$/;
const PLACEHOLDER = /\{[A-Za-z0-9_]+\}/g;
/* R18: an ICU formatted argument, `{name, plural, …}`, `{name, select, …}` (an ICU argument type after the name); other
   braces with a comma, such as a shape written in a sentence, are text. */
const FORMATTED = /\{\s*[A-Za-z0-9_]+\s*,\s*(plural|select|selectordinal|number|date|time|spellout|ordinal|duration)\s*[,}]/;

/* R1's sibling rule: the nearest dotted prefix of at least two segments holding `<prefix>.means` or `<prefix>.does`
   other than the word itself; a word whose key ends in `.means` or `.does` has none. */
function meaningOf(key, byKey) {
  const s = key.split(".");
  if (s.at(-1) === "means" || s.at(-1) === "does") return null;
  for (let n = s.length - 1; n >= 2; n--)
    for (const end of ["means", "does"]) {
      const k = `${s.slice(0, n).join(".")}.${end}`;
      if (k !== key && byKey.has(k)) return byKey.get(k).en;
    }
  return null;
}

/* The design rows R1 describes, from the file's bytes, each with its origin "design" (R15). */
export function rowsOf(bytes) {
  const file = JSON.parse(bytes.toString("utf8"));
  if (!Array.isArray(file.words)) throw fail("the file holds no words list");
  const byKey = new Map();
  for (const w of file.words) {
    if (typeof w.key !== "string" || typeof w.en !== "string") throw fail(`a word without a string key and en (${w.key})`);
    if (byKey.has(w.key)) throw fail(`key ${w.key} is not distinct`);
    byKey.set(w.key, w);
  }
  return file.words.map((w) => [w.key, w.en, w.note ?? null, meaningOf(w.key, byKey), w.protected === true, "design"]);
}

export const versionOf = (bytes) => createHash("sha256").update(bytes).digest("hex");

/* ---- R15: the extraction ------------------------------------------------------------------------------------- */

/* Generated artifacts (the manifest's table) and the shapes of file the extraction never reads. */
const GENERATED_FILES = new Set([
  "bio-plane/src/setup-words/rows.mjs",
  "bio-plane/src/case-checker/program.mjs",
  "site/src/pages.mjs",
  "court-citations/court-data.mjs",
  "bio-plane/src/member-roster/order.mjs",
  "bio-plane/src/wizard-scripts/screen-registry.mjs",
  "bio-plane/src/wizard-scripts/front-doors.mjs",
  "bio-plane/src/wizard-scripts/civicsmith-library.mjs",
]);
const SKIP_DIR = /(^|\/)(node_modules|dist|vendor|vendored|fixtures?|testdata|generated|coverage|\.git)\//;
/* a test file is not product source: a module's `tests` paths, a `test` or `tests` directory, a `*.test.*` file */
const TEST_FILE = /(^|\/)(tests?\/|[^/]*\.test\.)/;
const JS_EXT = /\.(mjs|js|cjs)$/;

/* The module owning each tracked JavaScript file under a module's `paths`: the longest path prefix wins. */
function ownedFiles(root) {
  const modules = JSON.parse(readFileSync(join(root, "build/modules.json"), "utf8")).modules;
  const prefixes = [];
  const tests = [];
  for (const m of modules) {
    for (const p of m.paths ?? []) prefixes.push([p, m.id]);
    for (const p of m.tests ?? []) tests.push(p);
  }
  prefixes.sort((a, b) => b[0].length - a[0].length);
  const inPath = (file, p) => file === p || (p.endsWith("/") && file.startsWith(p)) || file.startsWith(`${p}/`);
  let tracked;
  try { tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 }).split("\0").filter(Boolean); }
  catch (e) { throw fail(`cannot list the tracked files of ${root}: ${e.message}`); }
  const out = [];
  for (const file of tracked.sort()) {
    if (!JS_EXT.test(file) || GENERATED_FILES.has(file) || SKIP_DIR.test(`/${file}`) || TEST_FILE.test(file) || tests.some((p) => inPath(file, p))) continue;
    const owner = prefixes.find(([p]) => inPath(file, p));
    if (owner) out.push([file, owner[1]]);
  }
  return out;
}

const literalOf = (node) => {
  if (node?.type === "Literal" && typeof node.value === "string") return node.value;
  if (node?.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return null;
};

/* The names a binding pattern declares. */
function namesIn(p, into) {
  if (!p) return;
  if (p.type === "Identifier") into.add(p.name);
  else if (p.type === "ObjectPattern") p.properties.forEach((q) => namesIn(q.type === "RestElement" ? q.argument : q.value, into));
  else if (p.type === "ArrayPattern") p.elements.forEach((q) => namesIn(q, into));
  else if (p.type === "AssignmentPattern") namesIn(p.left, into);
  else if (p.type === "RestElement") namesIn(p.argument, into);
}

/* The names a scope-making node declares for its own body: its parameters and function name, `var`s anywhere inside it
   (not inside a nested function), and the lets, consts, classes and functions of its statement lists. Import bindings
   are left out: `localize` imported is the call the build reads. */
function declared(node) {
  const into = new Set();
  const hoist = (n, top) => {
    if (!n || typeof n.type !== "string") return;
    if (n.type === "VariableDeclaration") for (const d of n.declarations) { if (n.kind === "var" || top) namesIn(d.id, into); }
    else if ((n.type === "FunctionDeclaration" || n.type === "ClassDeclaration") && n.id) { if (top) into.add(n.id.name); return; }
    if (/Function/.test(n.type) || n.type === "ClassBody") return;
    for (const k of Object.keys(n)) {
      const v = n[k];
      if (Array.isArray(v)) v.forEach((c) => hoist(c, false));
      else if (v && typeof v.type === "string") hoist(v, false);
    }
  };
  if (/Function/.test(node.type)) {
    node.params.forEach((q) => namesIn(q, into));
    if (node.type === "FunctionExpression" && node.id) into.add(node.id.name);
    hoist(node.body, false);
    if (node.body.type === "BlockStatement") node.body.body.forEach((st) => hoist(st, true));
  } else if (node.type === "Program" || node.type === "BlockStatement" || node.type === "StaticBlock") {
    (node.body).forEach((st) => hoist(st, true));
    node.body.forEach((st) => hoist(st, false));
  } else if (node.type === "SwitchStatement") node.cases.forEach((c) => c.consequent.forEach((st) => hoist(st, true)));
  else if (node.type === "CatchClause") namesIn(node.param, into);
  else if (/^For(In|Of)?Statement$/.test(node.type)) { const i = node.init ?? node.left; if (i?.type === "VariableDeclaration") hoist(i, true); }
  return into;
}

/* Every call `localize(<id>, <en>, …)` of one source text, in source order: { id, en, line }. A `localize` the file declares itself
   (a parameter, a local function or constant) is not the call. */
export function callsOf(source, where) {
  let ast;
  const options = { ecmaVersion: "latest", locations: true, allowHashBang: true, allowReturnOutsideFunction: true };
  try { ast = parse(source, { ...options, sourceType: "module" }); }
  catch { try { ast = parse(source, { ...options, sourceType: "script" }); } catch (e) { throw fail(`${where} cannot be parsed: ${e.message}`); } }
  const calls = [];
  const SCOPES = /^(Program|BlockStatement|StaticBlock|SwitchStatement|CatchClause|ForStatement|ForInStatement|ForOfStatement|FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/;
  const visit = (node, shadowed) => {
    if (!node || typeof node.type !== "string") return;
    if (!shadowed && SCOPES.test(node.type) && declared(node).has("localize")) shadowed = true;
    if (!shadowed && node.type === "CallExpression" && node.callee.type === "Identifier" && node.callee.name === "localize") {
      const [a, b] = node.arguments;
      const id = literalOf(a), en = literalOf(b);
      const line = node.loc.start.line;
      if (id === null) throw fail(`${where}:${line}: localize's id is not a string literal`);
      if (en === null) throw fail(`${where}:${line}: localize's sentence for ${id} is not a string literal`);
      if (!ID_RE.test(id)) throw fail(`${where}:${line}: ${JSON.stringify(id)} is not a word id`);
      calls.push({ id, en, line });
    }
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (Array.isArray(v)) v.forEach((c) => visit(c, shadowed));
      else if (v && typeof v.type === "string") visit(v, shadowed);
    }
  };
  visit(ast, false);
  return calls;
}

/* The `localize` calls of the product's source: [{ id, en, module, file, line }], two different `en` for one id refused. */
export function extract(root) {
  const first = new Map();
  for (const [file, module] of ownedFiles(root)) {
    for (const c of callsOf(readFileSync(join(root, file), "utf8"), file)) {
      const have = first.get(c.id);
      if (!have) first.set(c.id, { ...c, module, file });
      else if (have.en !== c.en)
        throw fail(`id ${c.id} has two sentences: ${have.file}:${have.line} ${JSON.stringify(have.en)} and ${file}:${c.line} ${JSON.stringify(c.en)}`);
    }
  }
  return [...first.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/* ---- the rows, the review list, the files ------------------------------------------------------------------- */

/* R15: the design's rows in the file's order, then one "code" row per extracted id the file lacks, in id order; R18
   refuses a formatted argument in any of them. Returns { rows, unreviewed }. */
export function combine(designRows, calls) {
  const held = new Set(designRows.map((r) => r[0]));
  const added = calls.filter((c) => !held.has(c.id));
  const rows = [...designRows, ...added.map((c) => [c.id, c.en, null, null, false, "code"])];
  for (const r of rows) if (FORMATTED.test(r[1])) throw fail(`${r[0]} holds a formatted argument ({name, …}); word and localize do not render these yet (R18)`);
  const unreviewed = added.map(({ id, en, module, file, line }) => ({ id, en, module, file, line }));
  return { rows, unreviewed };
}

export const unreviewedText = (unreviewed) => `${JSON.stringify({ unreviewed }, null, 2)}\n`;

/* The text of rows.mjs. */
export function render(rows, sha) {
  const protectedCount = rows.filter((r) => r[4]).length;
  const codeCount = rows.filter((r) => r[5] === "code").length;
  const body = rows.map((r) => `  ${JSON.stringify(r)},`).join("\n");
  return `/* GENERATED: do not edit by hand. setup-words R10, R15 (R1's rule; DEC-179, DEC-257; K3366, K3930): the interface's word
   list, docs/development/ux-substrate/screens/words.json (${rows.length - codeCount} design words, ${protectedCount} protected; SHA-256
   ${sha}) followed by ${codeCount} sentences written first in code, each [key, en, note, means, protected, origin]: key,
   en, note (or null) and protected as the file gives them, means the en of the word's sibling .means or .does entry
   (the nearest dotted prefix of at least two segments holding one), or null, origin "design" (a row of the file) or
   "code" (a localize(id, en) call whose id the file lacks). WORDS_COMMIT is the first 10 hex digits of that SHA-256. The list
   and each row are frozen (R3). Written by \`node bio-plane/src/setup-words/build.mjs\` from the repository root
   (\`--check\` finds it stale); bio-plane/test/m/setup-words/ checks it. */
export const WORDS_COMMIT = ${JSON.stringify(sha.slice(0, 10))};
export const WORD_ROWS = Object.freeze([
${body}
].map((row) => Object.freeze(row)));
`;
}

/* R17: every Latin letter an accented form, the sentence lengthened by about a third and bracketed, placeholders kept. */
const PSEUDO_LOWER = "åƀçðéƒĝĥïĵķļɱñöþǫŕšţüṽŵẋýž";
const PSEUDO_UPPER = "ÅƁÇÐÉƑĜĤÏĴĶĻṀÑÖÞǪŔŠŢÜṼŴẌÝŽ";
export function pseudo(en) {
  const accent = (s) => s.replace(/[a-z]/g, (c) => PSEUDO_LOWER[c.charCodeAt(0) - 97]).replace(/[A-Z]/g, (c) => PSEUDO_UPPER[c.charCodeAt(0) - 65]);
  const body = en.split(/(\{[A-Za-z0-9_]+\})/).map((p, i) => (i % 2 ? p : accent(p))).join("");
  const pad = Math.ceil(en.replace(PLACEHOLDER, "").length / 3);
  return `[${body}${pad ? ` ${"ƥáđ".repeat(Math.ceil(pad / 3)).slice(0, pad - 1)}` : ""}]`;
}

export function renderPseudo(rows, sha) {
  const out = rows.map((r) => [r[0], pseudo(r[1]), ...r.slice(2)]);
  return `/* GENERATED PSEUDO-LOCALE ROWS (setup-words R17): never commit, never import from the module. Every en of the list at
   SHA-256 ${sha} transformed for a pseudo-locale walk. */
export const WORDS_COMMIT = ${JSON.stringify(sha.slice(0, 10))};
export const WORD_ROWS = Object.freeze([
${out.map((r) => `  ${JSON.stringify(r)},`).join("\n")}
].map((row) => Object.freeze(row)));
`;
}

/* The first difference between the file on disk and what the generator writes, or null: a word first (by its key, in
   the list's order), then the rest of the text. */
export function firstDifference(have, want) {
  if (have === want) return null;
  const a = have.split("\n"), b = want.split("\n");
  const rowsOnly = (lines) => lines.filter((l) => l.startsWith("  [\""));
  const ra = rowsOnly(a), rb = rowsOnly(b);
  for (let i = 0; i < Math.max(ra.length, rb.length); i++)
    if (ra[i] !== rb[i]) {
      const key = (rb[i] ?? ra[i]).match(/^ {2}\["((?:[^"\\]|\\.)*)"/)?.[1];
      return `word ${i + 1} (${key}): have ${JSON.stringify(ra[i] ?? null)}, the file gives ${JSON.stringify(rb[i] ?? null)}`;
    }
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    if (a[i] !== b[i]) return `line ${i + 1}: have ${JSON.stringify(a[i] ?? null)}, the file gives ${JSON.stringify(b[i] ?? null)}`;
  return "differs";
}

/* Everything the generator writes for a tree: { rows, sha, text, review }. */
export function build({ root = ROOT, wordsPath = join(root, WORDS_FROM_ROOT) } = {}) {
  const bytes = readFileSync(wordsPath);
  const { rows, unreviewed } = combine(rowsOf(bytes), extract(root));
  const sha = versionOf(bytes);
  return { rows, sha, text: render(rows, sha), review: unreviewedText(unreviewed) };
}

function main(argv) {
  const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : dflt; };
  const root = opt("--root", ROOT);
  const out = opt("--out", argv.includes("--pseudo") ? (opt("--root", null) ? join(root, ROWS_FROM_ROOT.replace("rows.mjs", "rows.pseudo.mjs")) : PSEUDO_PATH) : join(root, ROWS_FROM_ROOT));
  const review = opt("--unreviewed", join(dirname(out), "words-unreviewed.json"));
  let made;
  try { made = build({ root, wordsPath: opt("--words", join(root, WORDS_FROM_ROOT)) }); }
  catch (e) { process.stderr.write(`${e.message}\n`); return 1; }
  if (argv.includes("--pseudo")) {
    writeFileSync(out, renderPseudo(made.rows, made.sha));
    process.stdout.write(`setup-words: wrote ${out}\n`);
    return 0;
  }
  if (argv.includes("--check")) {
    const read = (p) => { try { return readFileSync(p, "utf8"); } catch { return null; } };
    const haveRows = read(out), haveReview = read(review);
    const d = haveRows === null ? "the generated list is absent" : firstDifference(haveRows, made.text);
    if (d) { process.stderr.write(`setup-words: ${out} is stale: ${d}\n`); return 1; }
    if (haveReview !== made.review) { process.stderr.write(`setup-words: ${review} is stale or absent\n`); return 1; }
    process.stdout.write("setup-words: rows.mjs and words-unreviewed.json match words.json and the source\n");
    return 0;
  }
  writeFileSync(out, made.text);
  writeFileSync(review, made.review);
  process.stdout.write(`setup-words: wrote ${out} and ${review}\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv.slice(2));
