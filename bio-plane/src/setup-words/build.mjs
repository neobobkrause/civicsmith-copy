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
import { fileURLToPath } from "node:url";
import { parse } from "./vendor/acorn.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../..");
export const WORDS_PATH = join(ROOT, "docs/development/ux-substrate/screens/words.json");
export const ROWS_PATH = join(HERE, "rows.mjs");
export const PSEUDO_PATH = join(HERE, "rows.pseudo.mjs");
const WORDS_FROM_ROOT = "docs/development/ux-substrate/screens/words.json";
const ROWS_FROM_ROOT = "bio-plane/src/setup-words/rows.mjs";

/**
 * @typedef {{ readonly [field: string]: unknown }} Fields an object read from JSON or from the parser, its members not yet checked
 * @typedef {{ readonly type: string, readonly [field: string]: unknown }} AstNode one node of the parser's tree
 * @typedef {string | number | boolean | null | object} JsonValue a value JSON gives
 * @typedef {[string, string, JsonValue, string | null, boolean, "design"]} DesignRow a row of the file: [key, en, note, means, protected, origin]
 * @typedef {[string, string, null, null, false, "code"]} CodeRow a row written first in code: [id, en, null, null, false, origin]
 * @typedef {DesignRow | CodeRow} Row
 * @typedef {{ id: string, en: string, line: number }} Call one `localize(id, en)` call of a source text
 * @typedef {{ id: string, en: string, line: number, module: string, file: string }} Extracted one call of the product's source, with its place
 * @typedef {{ id: string, en: string, module: string, file: string, line: number }} Unreviewed one entry of the review list
 * @typedef {ReadonlyArray<unknown>} Unchecked a list read from JSON or from the parser, its items not yet checked
 */

/**
 * @param {unknown} v
 * @returns {v is Fields} a value that is an object (the parser's nodes, JSON's objects and lists)
 */
const isFields = (v) => typeof v === "object" && v !== null;
/**
 * @param {unknown} v
 * @returns {v is AstNode}
 */
const isNode = (v) => isFields(v) && typeof v.type === "string";
/**
 * @param {unknown} v
 * @returns {v is Unchecked}
 */
const isList = (v) => Array.isArray(v);
/**
 * @param {unknown} v
 * @returns {Unchecked} `v` when it is a list, else none
 */
const listOf = (v) => (isList(v) ? v : []);
/**
 * One member of a value, as the language reads it from an object; undefined from anything else.
 * @param {unknown} v
 * @param {string} name
 * @returns {unknown}
 */
const field = (v, name) => (isFields(v) ? v[name] : undefined);
/**
 * One member of a value read from JSON, read as the language reads it: a TypeError for null or undefined.
 * @param {unknown} v
 * @param {string} name
 * @returns {unknown}
 */
function memberOf(v, name) {
  if (v === null || v === undefined) throw new TypeError(`Cannot read properties of ${v} (reading '${name}')`);
  return field(v, name);
}
/**
 * @param {unknown} v a value JSON.parse gave, or a member it lacks (undefined)
 * @returns {v is JsonValue} every value JSON.parse gives is JSON
 */
const isJson = (v) => v !== undefined;
/**
 * The message of a caught Error; undefined for anything else thrown, as reading its `message` gave.
 * @param {unknown} e
 * @returns {string | undefined}
 */
function messageOf(e) {
  if (e instanceof Error) return e.message;
  return undefined;
}

/**
 * @param {string} message
 * @returns {Error}
 */
const fail = (message) => new Error(`setup-words build: ${message}`);

/* R14's id: dotted, at least two segments, each of letters, digits, `_` and `-`. */
export const ID_RE = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)+$/;
const PLACEHOLDER = /\{[A-Za-z0-9_]+\}/g;
/* R18: an ICU formatted argument, `{name, plural, …}`, `{name, select, …}` (an ICU argument type after the name); other
   braces with a comma, such as a shape written in a sentence, are text. */
const FORMATTED = /\{\s*[A-Za-z0-9_]+\s*,\s*(plural|select|selectordinal|number|date|time|spellout|ordinal|duration)\s*[,}]/;

/* R1's sibling rule: the nearest dotted prefix of at least two segments holding `<prefix>.means` or `<prefix>.does`
   other than the word itself; a word whose key ends in `.means` or `.does` has none. */
/**
 * @param {string} key
 * @param {Map<string, string>} byKey each word's en, by its key
 * @returns {string | null}
 */
function meaningOf(key, byKey) {
  const s = key.split(".");
  if (s.at(-1) === "means" || s.at(-1) === "does") return null;
  for (let n = s.length - 1; n >= 2; n--)
    for (const end of ["means", "does"]) {
      const k = `${s.slice(0, n).join(".")}.${end}`;
      if (k !== key && byKey.has(k)) return byKey.get(k) ?? null;
    }
  return null;
}

/* The design rows R1 describes, from the file's bytes, each with its origin "design" (R15). */
/**
 * @param {Uint8Array} bytes the bytes of `words.json`, a Buffer as `readFileSync` gives them
 * @returns {DesignRow[]}
 * @throws {Error} when the file holds no words list, a word lacks a string key and en, or a key is repeated
 */
export function rowsOf(bytes) {
  const file = JSON.parse(bytes.toString("utf8"));
  const words = memberOf(file, "words");
  if (!isList(words)) throw fail("the file holds no words list");
  /** @type {Array<[string, string]>} */
  const none = [];
  const byKey = new Map(none);
  /** @type {Array<{ key: string, en: string, note: JsonValue, protected: unknown }>} */
  const checked = [];
  for (const w of words) {
    const key = memberOf(w, "key"), en = memberOf(w, "en");
    if (typeof key !== "string" || typeof en !== "string") throw fail(`a word without a string key and en (${key})`);
    if (byKey.has(key)) throw fail(`key ${key} is not distinct`);
    byKey.set(key, en);
    const note = field(w, "note") ?? null;
    if (!isJson(note)) throw fail(`a word whose note is not JSON (${key})`);
    checked.push({ key, en, note, protected: field(w, "protected") });
  }
  /**
   * @param {{ key: string, en: string, note: JsonValue, protected: unknown }} w
   * @returns {DesignRow}
   */
  const rowOf = (w) => [w.key, w.en, w.note, meaningOf(w.key, byKey), w.protected === true, "design"];
  return checked.map(rowOf);
}

/**
 * @param {Uint8Array} bytes
 * @returns {string} the SHA-256 of the bytes, in hex
 */
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
/**
 * @param {string} root
 * @returns {Array<[string, string]>} [file, module] for each file the extraction reads
 */
function ownedFiles(root) {
  const modules = memberOf(JSON.parse(readFileSync(join(root, "build/modules.json"), "utf8")), "modules");
  /** @type {Array<[string, string]>} */
  const prefixes = [];
  /** @type {string[]} */
  const tests = [];
  for (const m of listOf(modules)) {
    for (const p of listOf(field(m, "paths") ?? [])) prefixes.push([String(p), String(field(m, "id"))]);
    for (const p of listOf(field(m, "tests") ?? [])) tests.push(String(p));
  }
  prefixes.sort((a, b) => b[0].length - a[0].length);
  /**
   * @param {string} file
   * @param {string} p
   * @returns {boolean}
   */
  const inPath = (file, p) => file === p || (p.endsWith("/") && file.startsWith(p)) || file.startsWith(`${p}/`);
  /** @type {string[]} */
  let tracked;
  try { tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 }).split("\0").filter(Boolean); }
  catch (e) { throw fail(`cannot list the tracked files of ${root}: ${messageOf(e)}`); }
  /** @type {Array<[string, string]>} */
  const out = [];
  for (const file of tracked.sort()) {
    if (!JS_EXT.test(file) || GENERATED_FILES.has(file) || SKIP_DIR.test(`/${file}`) || TEST_FILE.test(file) || tests.some((p) => inPath(file, p))) continue;
    const owner = prefixes.find(([p]) => inPath(file, p));
    if (owner) out.push([file, owner[1]]);
  }
  return out;
}

/**
 * @param {unknown} node
 * @returns {string | null} the string a literal, or a template with no expressions, writes out
 */
const literalOf = (node) => {
  if (field(node, "type") === "Literal") { const value = field(node, "value"); if (typeof value === "string") return value; }
  if (field(node, "type") === "TemplateLiteral" && listOf(field(node, "expressions")).length === 0) {
    const cooked = field(field(listOf(field(node, "quasis"))[0], "value"), "cooked");
    return typeof cooked === "string" ? cooked : null;
  }
  return null;
};

/* The names a binding pattern declares. */
/**
 * @param {unknown} p
 * @param {Set<unknown>} into
 * @returns {void}
 */
function namesIn(p, into) {
  if (!isFields(p)) return;
  if (p.type === "Identifier") into.add(p.name);
  else if (p.type === "ObjectPattern") listOf(p.properties).forEach((q) => namesIn(field(q, "type") === "RestElement" ? field(q, "argument") : field(q, "value"), into));
  else if (p.type === "ArrayPattern") listOf(p.elements).forEach((q) => namesIn(q, into));
  else if (p.type === "AssignmentPattern") namesIn(p.left, into);
  else if (p.type === "RestElement") namesIn(p.argument, into);
}

/* The names a scope-making node declares for its own body: its parameters and function name, `var`s anywhere inside it
   (not inside a nested function), and the lets, consts, classes and functions of its statement lists. Import bindings
   are left out: `localize` imported is the call the build reads. */
/**
 * @param {AstNode} node
 * @returns {Set<unknown>}
 */
function declared(node) {
  /** @type {Set<unknown>} */
  const into = new Set();
  /**
   * @param {unknown} n
   * @param {boolean} top
   * @returns {void}
   */
  const hoist = (n, top) => {
    if (!isNode(n)) return;
    if (n.type === "VariableDeclaration") for (const d of listOf(n.declarations)) { if (n.kind === "var" || top) namesIn(field(d, "id"), into); }
    else if ((n.type === "FunctionDeclaration" || n.type === "ClassDeclaration") && n.id) { if (top) into.add(field(n.id, "name")); return; }
    if (/Function/.test(n.type) || n.type === "ClassBody") return;
    for (const k of Object.keys(n)) {
      const v = n[k];
      if (isList(v)) v.forEach((c) => hoist(c, false));
      else if (isNode(v)) hoist(v, false);
    }
  };
  if (/Function/.test(node.type)) {
    listOf(node.params).forEach((q) => namesIn(q, into));
    if (node.type === "FunctionExpression" && node.id) into.add(field(node.id, "name"));
    hoist(node.body, false);
    const body = node.body;
    if (field(body, "type") === "BlockStatement") listOf(field(body, "body")).forEach((st) => hoist(st, true));
  } else if (node.type === "Program" || node.type === "BlockStatement" || node.type === "StaticBlock") {
    listOf(node.body).forEach((st) => hoist(st, true));
    listOf(node.body).forEach((st) => hoist(st, false));
  } else if (node.type === "SwitchStatement") listOf(node.cases).forEach((c) => listOf(field(c, "consequent")).forEach((st) => hoist(st, true)));
  else if (node.type === "CatchClause") namesIn(node.param, into);
  else if (/^For(In|Of)?Statement$/.test(node.type)) { const i = node.init ?? node.left; if (field(i, "type") === "VariableDeclaration") hoist(i, true); }
  return into;
}

/* Every call `localize(<id>, <en>, …)` of one source text, in source order: { id, en, line }. A `localize` the file declares itself
   (a parameter, a local function or constant) is not the call. */
/**
 * @param {string} source
 * @param {string} where the source's file, for the errors
 * @returns {Call[]}
 * @throws {Error} when the source cannot be parsed, or a call's id or sentence is not a string literal or the id not a word id
 */
export function callsOf(source, where) {
  /** @type {unknown} */
  let ast;
  const options = { ecmaVersion: "latest", locations: true, allowHashBang: true, allowReturnOutsideFunction: true };
  try { ast = parse(source, { ...options, sourceType: "module" }); }
  catch { try { ast = parse(source, { ...options, sourceType: "script" }); } catch (e) { throw fail(`${where} cannot be parsed: ${messageOf(e)}`); } }
  /** @type {Call[]} */
  const calls = [];
  const SCOPES = /^(Program|BlockStatement|StaticBlock|SwitchStatement|CatchClause|ForStatement|ForInStatement|ForOfStatement|FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/;
  /**
   * @param {unknown} node
   * @param {boolean} shadowed
   * @returns {void}
   */
  const visit = (node, shadowed) => {
    if (!isNode(node)) return;
    if (!shadowed && SCOPES.test(node.type) && declared(node).has("localize")) shadowed = true;
    if (!shadowed && node.type === "CallExpression" && field(node.callee, "type") === "Identifier" && field(node.callee, "name") === "localize") {
      const args = listOf(node.arguments);
      const a = args[0], b = args[1];
      const id = literalOf(a), en = literalOf(b);
      const line = Number(field(field(node.loc, "start"), "line"));
      if (id === null) throw fail(`${where}:${line}: localize's id is not a string literal`);
      if (en === null) throw fail(`${where}:${line}: localize's sentence for ${id} is not a string literal`);
      if (!ID_RE.test(id)) throw fail(`${where}:${line}: ${JSON.stringify(id)} is not a word id`);
      calls.push({ id, en, line });
    }
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (isList(v)) v.forEach((c) => visit(c, shadowed));
      else if (isNode(v)) visit(v, shadowed);
    }
  };
  visit(ast, false);
  return calls;
}

/* The `localize` calls of the product's source: [{ id, en, module, file, line }], two different `en` for one id refused. */
/**
 * @param {string} root the product tree
 * @returns {Extracted[]} in id order
 * @throws {Error} when one id has two sentences, or a call cannot be read (callsOf)
 */
export function extract(root) {
  /** @type {Array<[string, Extracted]>} */
  const none = [];
  const first = new Map(none);
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
/**
 * @param {ReadonlyArray<DesignRow>} designRows
 * @param {ReadonlyArray<Extracted>} calls
 * @returns {{ rows: Row[], unreviewed: Unreviewed[] }}
 * @throws {Error} when a row's en holds a formatted argument (R18)
 */
export function combine(designRows, calls) {
  const held = new Set(designRows.map((r) => r[0]));
  const added = calls.filter((c) => !held.has(c.id));
  /**
   * @param {Extracted} c
   * @returns {CodeRow}
   */
  const codeRow = (c) => [c.id, c.en, null, null, false, "code"];
  /** @type {Row[]} */
  const rows = [...designRows, ...added.map(codeRow)];
  for (const r of rows) if (FORMATTED.test(r[1])) throw fail(`${r[0]} holds a formatted argument ({name, …}); word and localize do not render these yet (R18)`);
  const unreviewed = added.map(({ id, en, module, file, line }) => ({ id, en, module, file, line }));
  return { rows, unreviewed };
}

/**
 * @param {ReadonlyArray<Unreviewed>} unreviewed
 * @returns {string} the text of words-unreviewed.json
 */
export const unreviewedText = (unreviewed) => `${JSON.stringify({ unreviewed }, null, 2)}\n`;

/* The text of rows.mjs. */
/**
 * @param {ReadonlyArray<Row>} rows
 * @param {string} sha the SHA-256 of words.json, in hex
 * @returns {string}
 */
export function render(rows, sha) {
  const protectedCount = rows.filter((r) => r[4]).length;
  /**
   * @param {Row} r
   * @returns {boolean}
   */
  const fromCode = (r) => r[5] === "code";
  const codeCount = rows.filter(fromCode).length;
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
/**
 * @param {string} en
 * @returns {string}
 */
export function pseudo(en) {
  /**
   * @param {string} s
   * @returns {string}
   */
  const accent = (s) => s.replace(/[a-z]/g, (c) => PSEUDO_LOWER.charAt(c.charCodeAt(0) - 97)).replace(/[A-Z]/g, (c) => PSEUDO_UPPER.charAt(c.charCodeAt(0) - 65));
  const body = en.split(/(\{[A-Za-z0-9_]+\})/).map((p, i) => (i % 2 ? p : accent(p))).join("");
  const pad = Math.ceil(en.replace(PLACEHOLDER, "").length / 3);
  return `[${body}${pad ? ` ${"ƥáđ".repeat(Math.ceil(pad / 3)).slice(0, pad - 1)}` : ""}]`;
}

/**
 * @param {ReadonlyArray<Row>} rows
 * @param {string} sha the SHA-256 of words.json, in hex
 * @returns {string} the text of the pseudo-locale rows
 */
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
/**
 * @param {string} have
 * @param {string} want
 * @returns {string | null}
 */
export function firstDifference(have, want) {
  if (have === want) return null;
  const a = have.split("\n"), b = want.split("\n");
  /**
   * @param {string[]} lines
   * @returns {string[]}
   */
  const rowsOnly = (lines) => lines.filter((l) => l.startsWith("  [\""));
  const ra = rowsOnly(a), rb = rowsOnly(b);
  for (let i = 0; i < Math.max(ra.length, rb.length); i++)
    if (ra[i] !== rb[i]) {
      const key = String(rb[i] ?? ra[i]).match(/^ {2}\["((?:[^"\\]|\\.)*)"/)?.[1];
      return `word ${i + 1} (${key}): have ${JSON.stringify(ra[i] ?? null)}, the file gives ${JSON.stringify(rb[i] ?? null)}`;
    }
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    if (a[i] !== b[i]) return `line ${i + 1}: have ${JSON.stringify(a[i] ?? null)}, the file gives ${JSON.stringify(b[i] ?? null)}`;
  return "differs";
}

/* Everything the generator writes for a tree: { rows, sha, text, review }. */
/**
 * @param {{ root?: string | undefined, wordsPath?: string | undefined }} [paths] the tree, and the words file (the tree's by default)
 * @returns {{ rows: Row[], sha: string, text: string, review: string }}
 * @throws {Error} as rowsOf, extract and combine
 */
export function build({ root = ROOT, wordsPath = join(root, WORDS_FROM_ROOT) } = {}) {
  const bytes = readFileSync(wordsPath);
  const { rows, unreviewed } = combine(rowsOf(bytes), extract(root));
  const sha = versionOf(bytes);
  return { rows, sha, text: render(rows, sha), review: unreviewedText(unreviewed) };
}

/**
 * @param {string[]} argv
 * @returns {number} the exit code
 */
function main(argv) {
  /**
   * @param {string} name
   * @param {string} dflt
   * @returns {string | undefined} the value after `name`, or `dflt` when `name` is not given
   */
  const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : dflt; };
  const root = opt("--root", ROOT);
  const out = opt("--out", argv.includes("--pseudo") ? (opt("--root", "") ? join(root, ROWS_FROM_ROOT.replace("rows.mjs", "rows.pseudo.mjs")) : PSEUDO_PATH) : join(root, ROWS_FROM_ROOT));
  const review = opt("--unreviewed", join(dirname(out), "words-unreviewed.json"));
  /** @type {{ rows: Row[], sha: string, text: string, review: string }} */
  let made;
  try { made = build({ root, wordsPath: opt("--words", join(root, WORDS_FROM_ROOT)) }); }
  catch (e) { process.stderr.write(`${messageOf(e)}\n`); return 1; }
  if (argv.includes("--pseudo")) {
    writeFileSync(out, renderPseudo(made.rows, made.sha));
    process.stdout.write(`setup-words: wrote ${out}\n`);
    return 0;
  }
  if (argv.includes("--check")) {
    /**
     * @param {string | undefined} p
     * @returns {string | null} the file's text, or null where it cannot be read (none named among them)
     */
    const read = (p) => { if (p === undefined) return null; try { return readFileSync(p, "utf8"); } catch { return null; } };
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

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main(process.argv.slice(2));
