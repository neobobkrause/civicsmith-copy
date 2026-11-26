/* `localize`, the extraction, the review list, the pseudo-locale rows and the refusal of formatted arguments (R13–R18; K3930).
   The generator runs over fixture trees (a git repository in a temporary directory holding a module list, a
   words.json and some source), never over the real tree except for the invariants of the real list. The fixtures'
   sentences are test data, not the product's words. */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { WORD_ROWS, hasWord, localize, word } from "../../../src/setup-words/index.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const BUILD = join(ROOT, "bio-plane/src/setup-words/build.mjs");
const UNREVIEWED = join(ROOT, "bio-plane/src/setup-words/words-unreviewed.json");
/**
 * @typedef {ReadonlyArray<string | boolean | null>} Row a row of a generated list: [key, en, note, means, protected, origin]
 * @typedef {ReadonlyArray<unknown>} Unchecked a list read from JSON or a generated file, its items not yet checked
 * @typedef {{ key: string, en: string, note?: string, protected?: boolean }} FixtureWord a word of a fixture's words.json
 * @typedef {{ id: string, en: string, module: string, file: string, line: number }} Unreviewed an entry of the review list
 */
/**
 * @param {string} en
 * @returns {string[]} the names of its placeholders, in order
 */
const placeholders = (en) => [...en.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => String(m[1]));
/**
 * @param {unknown} v
 * @returns {v is Unchecked}
 */
const isList = (v) => Array.isArray(v);
/**
 * @param {unknown} x
 * @returns {boolean} whether `x` is a row's field: a string, a boolean or null
 */
function isField(x) {
  return typeof x === "string" || typeof x === "boolean" || x === null;
}
/**
 * @param {unknown} v
 * @returns {v is Row}
 */
const isRow = (v) => isList(v) && v.every(isField);
/**
 * @param {unknown} v
 * @returns {v is Unreviewed}
 */
function isUnreviewed(v) {
  if (typeof v !== "object" || v === null || !("id" in v) || !("en" in v) || !("module" in v) || !("file" in v) || !("line" in v)) return false;
  const id = v.id, en = v.en, module = v.module, file = v.file, line = v.line;
  return typeof id === "string" && typeof en === "string" && typeof module === "string" && typeof file === "string" && typeof line === "number";
}
/**
 * The review list a generator wrote: its one member, `unreviewed`.
 * @param {string} path
 * @returns {{ keys: string[], unreviewed: Unreviewed[] }}
 */
function reviewAt(path) {
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (typeof parsed !== "object" || parsed === null || !("unreviewed" in parsed)) throw new Error(`${path} holds no review list`);
  const list = parsed.unreviewed;
  if (!isList(list) || !list.every(isUnreviewed)) throw new Error(`${path} holds a review list of another shape`);
  return { keys: Object.keys(parsed), unreviewed: [...list] };
}
/**
 * @param {Row | undefined} r
 * @returns {string} the row's key
 */
const keyOf = (r) => String(r?.[0]);
/**
 * @param {Row | undefined} r
 * @returns {string} the row's English
 */
const enOf = (r) => String(r?.[1]);
/**
 * An Error carrying `code` whose message holds each of `parts`.
 * @param {string} code
 * @param {...string} parts
 * @returns {(e: unknown) => boolean}
 */
const coded = (code, ...parts) => (e) => e instanceof Error && "code" in e && e.code === code && parts.every((p) => e.message.includes(p));

/* a fixture tree: files by path; returns its root */
/**
 * @param {Readonly<Record<string, string>>} files
 * @param {ReadonlyArray<FixtureWord>} wordsList
 * @returns {string}
 */
function tree(files, wordsList) {
  const dir = mkdtempSync(join(tmpdir(), "setup-words-ext-"));
  /**
   * @param {string} p
   * @param {string} text
   * @returns {void}
   */
  const put = (p, text) => { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), text); };
  put("build/modules.json", JSON.stringify({ modules: [
    { id: "mod-one", layer: 1, paths: ["src/one/"], tests: ["test/one/"], uses: [] },
    { id: "mod-two", layer: 1, paths: ["src/two/"], tests: ["test/two/"], uses: [] },
  ] }));
  put(join("docs", "development", "ux-substrate", "screens", "words.json"), JSON.stringify({ counts: { total: wordsList.length }, words: wordsList }));
  for (const [p, text] of Object.entries(files)) put(p, text);
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["add", "-A"], { cwd: dir });
  return dir;
}
/**
 * The generator run as a program over a tree: its exit code and what it wrote.
 * @param {string} root
 * @param {...string} args
 * @returns {{ code: unknown, out: string }}
 */
const run = (root, ...args) => {
  try { return { code: 0, out: execFileSync("node", [BUILD, "--root", root, ...args], { cwd: ROOT, encoding: "utf8", stdio: "pipe" }) }; }
  catch (e) { return e instanceof Error ? { code: "status" in e ? e.status : undefined, out: `${"stdout" in e ? e.stdout : undefined}${"stderr" in e ? e.stderr : undefined}` } : { code: undefined, out: "undefinedundefined" }; }
};
/**
 * The rows of a generated list, loaded afresh.
 * @param {string} path
 * @returns {Promise<ReadonlyArray<Row>>}
 */
const rowsOf = async (path) => {
  /** @type {unknown} */
  const rows = (await import(`${pathToFileURL(path).href}?${Math.random()}`)).WORD_ROWS;
  if (!isList(rows) || !rows.every(isRow)) throw new Error(`${path} holds no list of rows`);
  return rows;
};
const DESIGN = [
  { key: "fix.held.row", en: "Held {n} times", note: "a note", protected: true },
  { key: "fix.held.plain", en: "Plain", protected: false },
];
const SOURCE = [
  'import { localize } from "../setup-words/index.mjs";',
  'localize("fix.held.row", "Another draft of {n}", { n: 1 });',
  'localize("one.area.newid", "A new {name}", { name: "x" });',
  "localize(`one.area.template`, `Template sentence`);",
  'localize("one.area.newid", "A new {name}");',
  'function local(localize) { return localize(someId, someText); }',
  "const f = () => { const localize = (a) => a; return localize(1); };",
].join("\n");

test("R15 the extraction reads localize(id, en) calls of the product source with a parser: the file's rows come first with origin design (a call on a held id changes nothing: the row wins), then one code row per new id in id order with note and means null and protected false; a template literal without ${} counts as a literal, a localize the file declares itself is not the call, and tests, bundles, vendored code and fixtures are not read", async () => {
  const root = tree({
    "src/one/a.mjs": SOURCE,
    "src/two/b.mjs": 'localize("two.area.second", "Second");\nlocalize("one.area.alpha", "Alpha");',
    "src/two/dist/bundle.mjs": 'localize("two.dist.dup", "Never read");',
    "src/two/vendor/v.mjs": 'localize("two.vendor.dup", "Never read");',
    "src/two/fixtures/f.mjs": 'localize("two.fixture.dup", "Never read");',
    "src/two/x.test.mjs": 'localize("two.test.dup", "Never read");',
    "test/one/c.mjs": 'localize("one.tests.dup", "Never read");',
    "elsewhere/z.mjs": 'localize("none.owned.dup", "Never read");',
  }, DESIGN);
  try {
    const out = join(root, "out/rows.mjs");
    mkdirSync(join(root, "out"));
    const r = run(root, "--out", out);
    assert.equal(r.code, 0, r.out);
    const rows = await rowsOf(out);
    assert.deepEqual(rows.map((x) => x[0]), ["fix.held.row", "fix.held.plain", "one.area.alpha", "one.area.newid", "one.area.template", "two.area.second"]);
    assert.deepEqual(rows[0], ["fix.held.row", "Held {n} times", "a note", null, true, "design"]);
    assert.equal(rows[1]?.[5], "design");
    assert.deepEqual(rows[3], ["one.area.newid", "A new {name}", null, null, false, "code"]);
    assert.equal(rows[4]?.[1], "Template sentence");
    assert.ok(rows.slice(2).every((x) => x[5] === "code" && x[2] === null && x[3] === null && x[4] === false));
    assert.ok(Object.isFrozen(rows) && rows.every((x) => Object.isFrozen(x)));
    assert.equal(run(root, "--check", "--out", out).code, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R15 control: one id extracted with two different en fails naming both places, so does a non-literal en, a non-literal id, and an id that is not dotted; --check covers the extracted rows, failing when a sentence in the source changes", () => {
  /** @type {Array<[string, [Record<string, string>, RegExp]]>} */
  const cases = Object.entries({
    "two en": [{ "src/one/a.mjs": 'localize("one.area.same", "First");', "src/two/b.mjs": 'localize("one.area.same", "Second");' }, /one\.area\.same[^]*src\/one\/a\.mjs:1[^]*src\/two\/b\.mjs:1/],
    "variable en": [{ "src/one/a.mjs": 'const s = "x";\nlocalize("one.area.v", s);' }, /src\/one\/a\.mjs:2/],
    "template en": [{ "src/one/a.mjs": "localize(\"one.area.v\", `a ${b}`);" }, /src\/one\/a\.mjs:1/],
    "variable id": [{ "src/one/a.mjs": "localize(id, \"x\");" }, /src\/one\/a\.mjs:1/],
    "one argument": [{ "src/one/a.mjs": 'localize("one.area.v");' }, /src\/one\/a\.mjs:1/],
    "bad id": [{ "src/one/a.mjs": 'localize("single", "x");' }, /single/],
  });
  for (const [name, [files, pattern]] of cases) {
    const root = tree(files, DESIGN);
    try {
      const r = run(root, "--out", join(root, "rows.mjs"));
      assert.notEqual(r.code, 0, name);
      assert.match(r.out, pattern, name);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
  const root = tree({ "src/one/a.mjs": 'localize("one.area.new", "Draft");' }, DESIGN);
  try {
    const out = join(root, "rows.mjs");
    assert.equal(run(root, "--out", out).code, 0);
    assert.equal(run(root, "--check", "--out", out).code, 0);
    writeFileSync(join(root, "src/one/a.mjs"), 'localize("one.area.new", "Changed draft");');
    const stale = run(root, "--check", "--out", out);
    assert.notEqual(stale.code, 0);
    assert.match(stale.out, /one\.area\.new/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R16 the generator writes words-unreviewed.json beside the list: one entry per code-origin row in id order with its id, en, module, file and line; the id the file holds is not listed; --check covers it", () => {
  const root = tree({ "src/one/a.mjs": SOURCE, "src/two/b.mjs": '\n\nlocalize("one.area.alpha", "Alpha");' }, DESIGN);
  try {
    const out = join(root, "rows.mjs");
    assert.equal(run(root, "--out", out).code, 0);
    const review = join(root, "words-unreviewed.json");
    const list = reviewAt(review);
    assert.deepEqual(list.keys, ["unreviewed"]);
    assert.deepEqual(list.unreviewed.map((e) => e.id), ["one.area.alpha", "one.area.newid", "one.area.template"]);
    assert.deepEqual(list.unreviewed[0], { id: "one.area.alpha", en: "Alpha", module: "mod-two", file: "src/two/b.mjs", line: 3 });
    assert.deepEqual(list.unreviewed[1], { id: "one.area.newid", en: "A new {name}", module: "mod-one", file: "src/one/a.mjs", line: 3 });
    assert.ok(!list.unreviewed.some((e) => e.id === "fix.held.row"));
    assert.equal(run(root, "--check", "--out", out).code, 0);
    writeFileSync(review, JSON.stringify({ unreviewed: [] }));
    const stale = run(root, "--check", "--out", out);
    assert.notEqual(stale.code, 0);
    assert.match(stale.out, /words-unreviewed\.json/);
    rmSync(review);
    assert.notEqual(run(root, "--check", "--out", out).code, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R16 the real tree's review list is exactly its code-origin rows in id order, each placed in a file of the tree", () => {
  const list = reviewAt(UNREVIEWED).unreviewed;
  const code = WORD_ROWS.filter((r) => r[5] === "code");
  assert.deepEqual(list.map((e) => e.id), code.map((r) => r[0]));
  assert.deepEqual(list.map((e) => e.id), [...list.map((e) => e.id)].sort());
  for (const e of list) {
    assert.deepEqual(Object.keys(e), ["id", "en", "module", "file", "line"]);
    assert.equal(e.en, code.find((r) => r[0] === e.id)?.[1]);
    assert.ok(Number.isInteger(e.line) && e.line > 0);
  }
  assert.equal(run(ROOT, "--check").code, 0);
});

test("R17 --pseudo writes the rows with every en transformed: bracketed, lengthened by about a third, each {name} placeholder unchanged and in place, no ASCII letter left outside the placeholders; the module never imports the pseudo rows, and nothing else of a row changes", async () => {
  const root = tree({ "src/one/a.mjs": 'localize("one.area.new", "Pay {amount} to {who}, now");' }, [...DESIGN, { key: "fix.held.two", en: "{a} and {b}: {a}" }, { key: "fix.held.digits", en: "No. 7: 100%" }]);
  try {
    const out = join(root, "pseudo.mjs");
    const r = run(root, "--pseudo", "--out", out);
    assert.equal(r.code, 0, r.out);
    const base = join(root, "rows.mjs");
    assert.equal(run(root, "--out", base).code, 0);
    const plain = await rowsOf(base), rows = await rowsOf(out);
    assert.equal(rows.length, plain.length);
    rows.forEach((row, i) => {
      const was = plain[i];
      assert.equal(row[0], was?.[0]);
      assert.deepEqual(row.slice(2), was?.slice(2));
      assert.deepEqual(placeholders(enOf(row)), placeholders(enOf(was)), keyOf(row));
      assert.match(enOf(row), /^\[.*\]$/s);
      assert.doesNotMatch(enOf(row).replace(/\{[A-Za-z0-9_]+\}/g, ""), /[A-Za-z]/, keyOf(row));
      assert.notEqual(row[1], was?.[1]);
      const own = enOf(was).replace(/\{[A-Za-z0-9_]+\}/g, "").length;
      assert.ok(enOf(row).length - 2 - enOf(was).length >= Math.floor(own / 4), keyOf(row));
    });
    assert.ok(enOf(rows.find((x) => x[0] === "fix.held.digits")).includes("7"));
    assert.equal(enOf(rows.find((x) => x[0] === "fix.held.two")).startsWith("[{a}"), true);
    assert.ok(!readFileSync(join(ROOT, "bio-plane/src/setup-words/index.mjs"), "utf8").includes("pseudo"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R17 over the whole real list: every sentence is transformed, every placeholder survives, no ASCII letter is left outside a placeholder", async () => {
  const dir = mkdtempSync(join(tmpdir(), "setup-words-pseudo-"));
  try {
    const out = join(dir, "rows.pseudo.mjs");
    assert.equal(run(ROOT, "--pseudo", "--out", out).code, 0);
    const rows = await rowsOf(out);
    assert.equal(rows.length, WORD_ROWS.length);
    rows.forEach((row, i) => {
      assert.deepEqual(placeholders(enOf(row)), placeholders(enOf(WORD_ROWS[i])), keyOf(row));
      assert.doesNotMatch(enOf(row).replace(/\{[A-Za-z0-9_]+\}/g, ""), /[A-Za-z]/, keyOf(row));
    });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("R18 a row whose en holds a plural, select or other formatted argument fails the generator, naming the id; so does a code row; a plain {name} placeholder does not, nor braces with a comma that name no ICU argument type", () => {
  const forms = ["{n, plural, one {a thing} other {things}}", "{who, select, a {x} other {y}}", "{ n , number}", "{d, date, short}"];
  for (const form of forms) {
    const root = tree({}, [...DESIGN, { key: "fix.held.formatted", en: `Has ${form}` }]);
    try {
      const r = run(root, "--out", join(root, "rows.mjs"));
      assert.notEqual(r.code, 0, form);
      assert.match(r.out, /fix\.held\.formatted/, form);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
  const root = tree({ "src/one/a.mjs": 'localize("one.area.formatted", "{n, plural, one {x} other {y}}");' }, DESIGN);
  try {
    const r = run(root, "--out", join(root, "rows.mjs"));
    assert.notEqual(r.code, 0);
    assert.match(r.out, /one\.area\.formatted/);
  } finally { rmSync(root, { recursive: true, force: true }); }
  /* braces with a comma that name no ICU argument type are text */
  const ok = tree({ "src/one/a.mjs": 'localize("one.area.plain", "{n} and {m}: a shape {amount, units}");' }, DESIGN);
  try { assert.equal(run(ok, "--out", join(ok, "rows.mjs")).code, 0); } finally { rmSync(ok, { recursive: true, force: true }); }
});

test("R14 R13 localize(id, en, vars) answers the list's row for id when it holds one, not en, and en when it does not, each {name} filled as word fills it; word and localize read one list", () => {
  const withVars = WORD_ROWS.find((r) => placeholders(enOf(r)).length >= 2);
  const none = WORD_ROWS.find((r) => placeholders(enOf(r)).length === 0);
  assert.equal(localize(keyOf(none), "a different draft"), enOf(none));
  assert.equal(localize(keyOf(none), "a different draft", { unused: 1 }), enOf(none));
  const vars = Object.fromEntries(placeholders(enOf(withVars)).map((p, i) => [p, i === 0 ? "Ada" : 42]));
  assert.equal(localize(keyOf(withVars), "draft {x}", vars), word(keyOf(withVars), vars));
  assert.equal(localize("test.fixture.absent", "Hello {who}, {n}", { who: "Ada", n: 7 }), "Hello Ada, 7");
  assert.equal(localize("test.fixture.absent", "Hello {who}", { who: "{other}", extra: 1 }), "Hello {other}");
  assert.equal(localize("Test.Fixture-A_b.absent", "Plain"), "Plain");
  assert.equal(hasWord("test.fixture.absent"), false, "localize does not add to the list");
  /* a key of the file outside R14's id shape (it holds a `/`) is read by word only */
  for (const r of WORD_ROWS.filter((x) => /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)+$/.test(keyOf(x)))) {
    const v = Object.fromEntries(placeholders(enOf(r)).map((p) => [p, `<${p}>`]));
    assert.equal(localize(keyOf(r), "draft", v), word(keyOf(r), v), keyOf(r));
  }
});

test("R14 control: a missing placeholder throws WORD_VAR_MISSING naming the id and the placeholder (for a held id and for en); a malformed id throws BAD_WORD_ID; an id with no row and no sentence throws; neither falls back to the id", () => {
  const withVars = WORD_ROWS.find((r) => placeholders(enOf(r)).length >= 1);
  const p = String(placeholders(enOf(withVars))[0]);
  assert.throws(() => localize(keyOf(withVars), "draft"), coded("WORD_VAR_MISSING", keyOf(withVars), `{${p}}`));
  for (const vars of [undefined, {}, { [p]: undefined }, { [p]: null }, Object.create({ [p]: "x" })])
    assert.throws(() => localize(keyOf(withVars), "draft", vars), coded("WORD_VAR_MISSING"));
  assert.throws(() => localize("test.fixture.absent", "Hello {who}"), coded("WORD_VAR_MISSING", "test.fixture.absent", "{who}"));
  assert.throws(() => localize("test.fixture.absent", "Hello {who}", { other: 1 }), coded("WORD_VAR_MISSING"));
  for (const id of ["single", "", "a..b", ".a.b", "a.b.", "a b.c", "a.b!", "a.b c", undefined, null, 7, {}])
    assert.throws(() => localize(id, "x"), coded("BAD_WORD_ID"), String(id));
  assert.throws(() => localize("test.fixture.absent"), coded("BAD_WORD_EN"));
  assert.throws(() => localize("test.fixture.absent", 5), coded("BAD_WORD_EN"));
});
