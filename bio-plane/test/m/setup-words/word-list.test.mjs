/* The interface's word list at the module's interface (R3, R4, R10–R13, the design rows of R15; DEC-179, DEC-257; K3366). `WORD_ROWS` is read
   against `docs/development/ux-substrate/screens/words.json` as it stands in the tree, word by word, with R1's rule
   stated here independently of the generator. Nothing here pins a commit, a count or a key: the file is the contract. */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as words from "../../../src/setup-words/index.mjs";
import { WORD_ROWS, WORDS_COMMIT, word, hasWord, localize } from "../../../src/setup-words/index.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const SOURCE = join(ROOT, "bio-plane/src/setup-words/index.mjs");
const BUILD = join(ROOT, "bio-plane/src/setup-words/build.mjs");
const FILE = join(ROOT, "docs", "development", "ux-substrate", "screens", "words.json");
const bytes = readFileSync(FILE);

/**
 * @typedef {ReadonlyArray<string | boolean | null>} Row a row of WORD_ROWS: [key, en, note, means, protected, origin]
 * @typedef {{ key: string, en: string, note?: string | null, means?: string | null, protected?: boolean }} Word a word of words.json
 * @typedef {{ counts: { total: number, protected: number }, words: Word[] }} WordsFile words.json
 * @typedef {ReadonlyArray<unknown>} Unchecked a list read from JSON, its items not yet checked
 * @typedef {Array<string | boolean | null>} RowCopy a row copied to be changed
 */
/**
 * @param {unknown} v
 * @returns {v is Unchecked}
 */
const isList = (v) => Array.isArray(v);
/**
 * @param {unknown} w
 * @returns {w is Word}
 */
const isWord = (w) => typeof w === "object" && w !== null && "key" in w && typeof w.key === "string" && "en" in w && typeof w.en === "string";
/**
 * @param {unknown} v
 * @returns {v is WordsFile}
 */
function isWordsFile(v) {
  if (typeof v !== "object" || v === null || !("words" in v) || !("counts" in v)) return false;
  const words = v.words, counts = v.counts;
  if (!isList(words) || !words.every(isWord)) return false;
  if (typeof counts !== "object" || counts === null || !("total" in counts) || !("protected" in counts)) return false;
  const total = counts.total, prot = counts.protected;
  return typeof total === "number" && typeof prot === "number";
}
const parsed = JSON.parse(readFileSync(FILE, "utf8"));
if (!isWordsFile(parsed)) throw new Error("words.json is not a list of words with its counts");
const file = parsed;

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
 * @param {string} k
 * @returns {Row} the row of key `k`
 */
const at = (k) => {
  const r = WORD_ROWS.find((x) => x[0] === k);
  assert.ok(r, k);
  return r;
};
/**
 * An Error carrying `code` whose message holds each of `parts`.
 * @param {string} code
 * @param {...string} parts
 * @returns {(e: unknown) => boolean}
 */
const coded = (code, ...parts) => (e) => e instanceof Error && "code" in e && e.code === code && parts.every((p) => e.message.includes(p));

/* The sibling a word's meaning is read from: the nearest dotted prefix (at least two segments) holding a `.means` or
   `.does` entry other than the word itself; none for a `.means`/`.does` entry. */
/**
 * @param {string} key
 * @param {Map<string, Word>} byKey
 * @returns {string | null}
 */
function siblingOf(key, byKey) {
  const s = key.split(".");
  if (s.at(-1) === "means" || s.at(-1) === "does") return null;
  for (let n = s.length - 1; n >= 2; n--)
    for (const end of ["means", "does"]) {
      const k = `${s.slice(0, n).join(".")}.${end}`;
      const sibling = byKey.get(k);
      if (k !== key && sibling) return sibling.en;
    }
  return null;
}

/* R10's full check, as a list of failures, so a control can show it refusing a list that is wrong. */
/**
 * @param {ReadonlyArray<Row>} rows
 * @param {WordsFile} f
 * @returns {string[]}
 */
function failures(rows, f) {
  /** @type {string[]} */
  const out = [];
  /** @type {Array<[string, Word]>} */
  const entries = f.words.map((w) => [w.key, w]);
  const byKey = new Map(entries);
  const designRows = rows.filter((r) => r[5] === "design");
  if (designRows.length !== f.words.length) out.push(`design rows ${designRows.length}, file ${f.words.length}`);
  if (rows.slice(0, f.words.length).some((r) => r[5] !== "design")) out.push("the file's rows do not come first");
  if (new Set(rows.map((r) => r[0])).size !== rows.length) out.push("keys not distinct");
  f.words.forEach((w, i) => {
    const want = [w.key, w.en, w.note ?? null, siblingOf(w.key, byKey), w.protected === true, "design"];
    try { assert.deepEqual(rows[i], want); } catch { out.push(`row ${i} (${w.key})`); }
  });
  return out;
}

/**
 * The generator run as a program: its exit code and what it wrote.
 * @param {...string} args
 * @returns {{ code: unknown, out: string }}
 */
const run = (...args) => {
  try { return { code: 0, out: execFileSync("node", [BUILD, ...args], { cwd: ROOT, encoding: "utf8", stdio: "pipe" }) }; }
  catch (e) { return e instanceof Error ? { code: "status" in e ? e.status : undefined, out: `${"stdout" in e ? e.stdout : undefined}${"stderr" in e ? e.stderr : undefined}` } : { code: undefined, out: "undefinedundefined" }; }
};

test("R10 WORD_ROWS equals words.json in the tree word by word: one row per word of the file, in its order, keys distinct, each [key, en, note, means, protected] with key, en, protected and note (or null) as the file gives them and means the en of its sibling .means or .does entry, or null", () => {
  assert.ok(file.words.length > 0);
  assert.deepEqual(failures(WORD_ROWS, file), []);
  const design = WORD_ROWS.filter((r) => r[5] === "design");
  assert.equal(design.length, file.counts.total);
  assert.equal(design.filter((r) => r[4]).length, file.counts.protected);
  WORD_ROWS.forEach((r) => {
    assert.equal(r.length, 6);
    assert.equal(typeof r[0], "string");
    assert.equal(typeof r[1], "string");
    assert.ok(r[2] === null || typeof r[2] === "string");
    assert.ok(r[3] === null || typeof r[3] === "string");
    assert.equal(typeof r[4], "boolean");
    assert.ok(r[5] === "design" || r[5] === "code");
  });
  /* the sibling rule by example */
  assert.equal(at("weight.reversible.name")[3], at("weight.reversible.means")[1]);
  assert.equal(at("act.publish.label.ceremony")[3], at("act.publish.does")[1]);
  assert.equal(at("weight.reversible.means")[3], null);
  assert.equal(at("act.publish.does")[3], null);
  assert.equal(at("state.undetermined")[2], "the reason always follows");
  assert.equal(at("state.empty")[2], null);
});

test("R10 WORDS_COMMIT is the first 10 hex digits of the SHA-256 of the file's bytes, the list's version; the generator's --check passes on the tree", () => {
  assert.equal(WORDS_COMMIT, createHash("sha256").update(bytes).digest("hex").slice(0, 10));
  assert.match(WORDS_COMMIT, /^[0-9a-f]{10}$/);
  const r = run("--check");
  assert.equal(r.code, 0, r.out);
});

test("R10 control: a fixture file with one en changed makes --check fail, naming the first difference; so does one with a key dropped, one with a protected mark flipped, and one with a repeated key; the check refuses a list that differs in one word, its order, a count, a note, a means or a protected mark", () => {
  const dir = mkdtempSync(join(tmpdir(), "setup-words-"));
  try {
    /**
     * @param {string} name
     * @param {(f: WordsFile) => void} edit
     * @returns {string} the fixture's path
     */
    const variant = (name, edit) => {
      const f = structuredClone(file);
      edit(f);
      const p = join(dir, name);
      writeFileSync(p, JSON.stringify(f));
      return p;
    };
    const rows = join(ROOT, "bio-plane/src/setup-words/rows.mjs");
    const changed = variant("en.json", (f) => { const w = f.words[3]; assert.ok(w); w.en += "!"; });
    const r = run("--check", "--words", changed, "--out", rows);
    assert.notEqual(r.code, 0);
    assert.match(r.out, /stale: word \d+/);
    assert.match(r.out, new RegExp(String(file.words[3]?.key).replace(/\./g, "\\.")), "names the word that differs");
    assert.notEqual(run("--check", "--words", variant("drop.json", (f) => { f.words.pop(); }), "--out", rows).code, 0);
    assert.notEqual(run("--check", "--words", variant("prot.json", (f) => { const w = f.words[0]; assert.ok(w); w.protected = !w.protected; }), "--out", rows).code, 0);
    const dup = run("--check", "--words", variant("dup.json", (f) => { const [w0, w1] = f.words; assert.ok(w0 && w1); w1.key = w0.key; }), "--out", rows);
    assert.notEqual(dup.code, 0);
    assert.match(dup.out, /not distinct/);
    assert.notEqual(run("--check", "--words", changed, "--out", join(dir, "absent.mjs")).code, 0);
    /* the writing form, over the fixture, agrees with the check */
    const out = join(dir, "rows.mjs");
    assert.equal(run("--words", changed, "--out", out).code, 0);
    assert.equal(run("--check", "--words", changed, "--out", out).code, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
  /**
   * @param {(c: RowCopy[]) => void} f
   * @returns {RowCopy[]} a copy of the list with `f`'s change
   */
  const swap = (f) => { const c = WORD_ROWS.map((r) => [...r]); f(c); return c; };
  /**
   * @param {RowCopy[]} c
   * @param {number} i
   * @returns {RowCopy}
   */
  const rowIn = (c, i) => { const r = c[i]; assert.ok(r, String(i)); return r; };
  assert.notDeepEqual(failures(swap((c) => { const r = rowIn(c, 3); r[1] = `${r[1]}!`; }), file), []);
  assert.notDeepEqual(failures(swap((c) => { const r0 = rowIn(c, 0), r1 = rowIn(c, 1); [c[0], c[1]] = [r1, r0]; }), file), []);
  assert.notDeepEqual(failures(swap((c) => { c.splice(file.words.length - 1, 1); }), file), []);
  assert.notDeepEqual(failures(swap((c) => { c.push([...rowIn(c, 0)]); }), file), []);
  const noted = WORD_ROWS.findIndex((r) => r[2] !== null);
  assert.notDeepEqual(failures(swap((c) => { rowIn(c, noted)[2] = null; }), file), []);
  const meant = WORD_ROWS.findIndex((r) => r[3] !== null);
  assert.notDeepEqual(failures(swap((c) => { rowIn(c, meant)[3] = null; }), file), []);
  assert.notDeepEqual(failures(swap((c) => { const r = rowIn(c, 0); r[4] = !r[4]; }), file), []);
});

test("R3 WORD_ROWS and each of its rows are frozen: no write changes the list, a row or a field", () => {
  "use strict";
  assert.ok(Object.isFrozen(WORD_ROWS));
  WORD_ROWS.forEach((r) => assert.ok(Object.isFrozen(r), keyOf(r)));
  const first = JSON.stringify(WORD_ROWS[0]);
  const n = WORD_ROWS.length;
  assert.throws(() => { WORD_ROWS.push(["x", "x", null, null, false]); }, TypeError);
  assert.throws(() => { WORD_ROWS[0] = ["x", "x", null, null, false]; }, TypeError);
  assert.throws(() => { WORD_ROWS.length = 0; }, TypeError);
  assert.throws(() => { WORD_ROWS.sort(); }, TypeError);
  assert.throws(() => { WORD_ROWS[0][1] = "changed"; }, TypeError);
  assert.throws(() => { WORD_ROWS[0][4] = !WORD_ROWS[0][4]; }, TypeError);
  assert.throws(() => { WORD_ROWS[0].push("extra"); }, TypeError);
  assert.throws(() => { WORD_ROWS.at(-1).length = 0; }, TypeError);
  assert.equal(WORD_ROWS.length, n);
  assert.equal(JSON.stringify(WORD_ROWS[0]), first);
});

test("R4 the module does nothing when loaded beyond defining its exports and imports only its own generated list: its exports are exactly WORDS_COMMIT, WORD_ROWS, hasWord, localize and word; its code never imports the generator or any other module; every load answers the same", async () => {
  const code = readFileSync(SOURCE, "utf8")
    .replace(/\/\*[^]*?\*\//g, " ")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
  const imports = [...code.matchAll(/\bimport\b[^;]*;/g)].map((m) => m[0]);
  assert.equal(imports.length, 1);
  assert.match(readFileSync(SOURCE, "utf8"), /import \{ WORD_ROWS, WORDS_COMMIT \} from "\.\/rows\.mjs";/);
  assert.doesNotMatch(code, /\brequire\b|build\.mjs|\bprocess\b|\bDate\b|\bMath\b|\bfetch\b|\bsetTimeout\b/);
  assert.deepEqual(Object.keys(words).sort(), ["WORDS_COMMIT", "WORD_ROWS", "hasWord", "localize", "word"]);
  const again = await import("../../../src/setup-words/index.mjs?again");
  assert.equal(again.WORDS_COMMIT, WORDS_COMMIT);
  assert.deepEqual(again.WORD_ROWS, WORD_ROWS);
  assert.equal(again.word("weight.reversible.name"), word("weight.reversible.name"));
});

/* a placeholder's name is not spelling: the "labelled" checks read the English with each {name} removed (test-only) */
/**
 * @param {string} en
 * @returns {string}
 */
const unplaced = (en) => en.replace(/\{[A-Za-z0-9_]+\}/g, "");

/* two placeholders, one placeholder, and none, read from the file itself, not from a hand list */
/**
 * @param {string} en
 * @returns {string[]} the names of its placeholders, each once
 */
const placeholders = (en) => [...new Set([...en.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => String(m[1])))];
const two = WORD_ROWS.find((r) => placeholders(enOf(r)).length >= 2);
const one = WORD_ROWS.find((r) => placeholders(enOf(r)).length === 1);
const none = WORD_ROWS.find((r) => placeholders(enOf(r)).length === 0);

test("R11 word(key, vars) returns the English of key with each {name} placeholder filled by vars[name], a string or a number as String gives it; a word with two placeholders is filled, a word with none is returned as the list holds it", () => {
  assert.ok(two && one && none, "the file holds words of each kind");
  const [a, b] = placeholders(enOf(two));
  const filled = word(keyOf(two), { [String(a)]: "Ada", [String(b)]: 42 });
  assert.equal(filled, enOf(two).split(`{${a}}`).join("Ada").split(`{${b}}`).join("42"));
  assert.doesNotMatch(filled, /\{[A-Za-z0-9_]+\}/);
  assert.equal(word(keyOf(one), { [String(placeholders(enOf(one))[0])]: 0 }), enOf(one).split(`{${placeholders(enOf(one))[0]}}`).join("0"));
  assert.equal(word(keyOf(none)), enOf(none));
  assert.equal(word(keyOf(none), {}), enOf(none));
  /* a name the English does not hold is ignored; a value is written as String gives it, braces in it left alone */
  assert.equal(word(keyOf(none), { extra: "x" }), enOf(none));
  const [n] = placeholders(enOf(one));
  assert.equal(word(keyOf(one), { [String(n)]: "{other}", extra: 1 }), enOf(one).split(`{${n}}`).join("{other}"));
  /* a placeholder repeated in one sentence is filled everywhere */
  const rep = WORD_ROWS.find((r) => [...enOf(r).matchAll(/\{([A-Za-z0-9_]+)\}/g)].length > placeholders(enOf(r)).length);
  if (rep) assert.doesNotMatch(word(keyOf(rep), Object.fromEntries(placeholders(enOf(rep)).map((p) => [p, "v"]))), /\{[A-Za-z0-9_]+\}/);
  /* every word of the list is returned whole when its placeholders are given */
  for (const r of WORD_ROWS) {
    const vars = Object.fromEntries(placeholders(enOf(r)).map((p) => [p, `<${p}>`]));
    assert.equal(word(keyOf(r), vars), enOf(r).replace(/\{([A-Za-z0-9_]+)\}/g, (/** @type {string} */ _, /** @type {string} */ p) => `<${p}>`), keyOf(r));
  }
});

test("R11 control: an unknown key throws UNKNOWN_WORD naming the key; a missing placeholder throws WORD_VAR_MISSING naming the key and the placeholder; neither falls back to the key, another word or an empty string", () => {
  assert.throws(() => word("no.such.word"), coded("UNKNOWN_WORD", "no.such.word"));
  assert.throws(() => word(""), coded("UNKNOWN_WORD"));
  assert.throws(() => word(undefined), coded("UNKNOWN_WORD"));
  assert.throws(() => word("constructor"), coded("UNKNOWN_WORD"));
  assert.throws(() => word("__proto__"), coded("UNKNOWN_WORD"));
  const [a, b] = placeholders(enOf(two)).map(String);
  for (const vars of [undefined, {}, { [String(b)]: "x" }, { [String(a)]: undefined, [String(b)]: "x" }, { [String(a)]: null, [String(b)]: "x" }]) {
    assert.throws(() => word(keyOf(two), vars), coded("WORD_VAR_MISSING", keyOf(two), `{${a}}`), JSON.stringify(vars));
  }
  assert.throws(() => word(keyOf(two), { [String(a)]: "x" }), coded("WORD_VAR_MISSING", `{${b}}`));
  /* an inherited property is not a value */
  assert.throws(() => word(keyOf(two), Object.create({ [String(a)]: "x", [String(b)]: "y" })), coded("WORD_VAR_MISSING"));
  assert.throws(() => word(keyOf(one), { toString: "x" }), coded("WORD_VAR_MISSING"));
});

test("R19 a value of vars that is a reason {key, vars} fills its placeholder with that reason's words, made the same way to any depth, never as String of the object: lines.why.stated_current_through with civil-time.why.business_count_roll whose why is civil-time.why.reader_failed draws the three sentences, two levels deep; localize fills the same way", () => {
  /**
   * @param {string} k
   * @returns {string}
   */
  const en = (k) => enOf(at(k));
  const inner = { key: "civil-time.why.business_count_roll", vars: { why: { key: "civil-time.why.reader_failed" } } };
  const got = word("lines.why.stated_current_through", { why: inner, day: "Monday" });
  const want = en("civil-time.why.business_count_roll")
    .replace("{why}", en("civil-time.why.reader_failed"));
  assert.equal(got, en("lines.why.stated_current_through").replace("{why}", want).replace("{day}", "Monday"));
  assert.doesNotMatch(got, /object|\{[A-Za-z0-9_]+\}/);
  assert.equal(localize("lines.why.stated_current_through", "unused", { why: inner, day: "Monday" }), got);
  /* a reason with its own placeholder takes its own vars */
  const dated = word("lines.why.stated_current_through", { why: { key: "lines.why.stated_current_through", vars: { why: "a", day: "b" } }, day: "c" });
  assert.equal(dated, en("lines.why.stated_current_through").replace("{why}", en("lines.why.stated_current_through").replace("{why}", "a").replace("{day}", "b")).replace("{day}", "c"));
});

test("R19 control: an inner reason whose key the list lacks throws UNKNOWN_WORD naming it; a reason missing its own placeholder throws WORD_VAR_MISSING", () => {
  const bad = { key: "no.such.inner", vars: {} };
  assert.throws(() => word("lines.why.stated_current_through", { why: { key: "civil-time.why.business_count_roll", vars: { why: bad } }, day: "x" }), coded("UNKNOWN_WORD", "no.such.inner"));
  assert.throws(() => localize("lines.why.stated_current_through", "unused", { why: bad, day: "x" }), coded("UNKNOWN_WORD"));
  assert.throws(() => word("lines.why.stated_current_through", { why: { key: "civil-time.why.business_count_roll" }, day: "x" }), coded("WORD_VAR_MISSING", "civil-time.why.business_count_roll"));
});

test("R12 hasWord(key) is true exactly when the list holds key: every key of the list, and none that is not", () => {
  for (const r of WORD_ROWS) assert.equal(hasWord(r[0]), true, keyOf(r));
  for (const k of ["no.such.word", "", "weight.reversible", "WEIGHT.REVERSIBLE.NAME", "constructor", "__proto__", "toString", undefined, null, 7])
    assert.equal(hasWord(k), false, String(k));
  assert.equal(hasWord(WORD_ROWS[0]?.[0]), true);
  assert.equal(hasWord(`${keyOf(WORD_ROWS[0])} `), false);
});

test("R13 the keys-only rule at this module's interface: a sentence is read through word from the list and only from it, so every key of the list answers its English filled, an unknown key never answers a sentence, and the list holds no key whose English is empty, so a module holding keys alone has a sentence to show", () => {
  for (const r of WORD_ROWS) {
    assert.ok(enOf(r).length > 0, keyOf(r));
    assert.ok(hasWord(r[0]));
    assert.notEqual(r[1], r[0], `${keyOf(r)}: the English is not the key`);
  }
  for (const k of ["not.a.key", "weight.reversible.nam"]) {
    assert.equal(hasWord(k), false);
    assert.throws(() => word(k), coded("UNKNOWN_WORD"));
  }
  /* placeholders are {name} with name of letters, digits and _; per R18 braces holding anything else are text and survive word() as written, and only an ICU formatted argument ({name, plural, …}) is refused, which no row of the list holds */
  const formatted = /\{\s*[A-Za-z0-9_]+\s*,\s*(plural|select|selectordinal|number|date|time|spellout|ordinal|duration)\s*[,}]/;
  for (const r of WORD_ROWS.filter((x) => x[5] === "design")) {
    assert.doesNotMatch(enOf(r), formatted, keyOf(r));
    const vars = Object.fromEntries([...enOf(r).matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => [String(m[1]), "x"]));
    /**
     * @param {string} t
     * @returns {number}
     */
    const braces = (t) => (t.replace(/\{[A-Za-z0-9_]+\}/g, "").match(/[{}]/g) ?? []).length;
    assert.equal(braces(word(keyOf(r), vars)), braces(enOf(r)), `${keyOf(r)}: other braces are text`);
  }
  /* DEC-221 (N1068): the file's English spells "labeled" */
  assert.deepEqual(WORD_ROWS.filter((r) => r[5] === "design" && /labelled/i.test(unplaced(enOf(r)))).map((r) => r[0]), []);
  assert.equal(hasWord("signin.founderhint"), WORD_ROWS.some((r) => r[0] === "signin.founderhint"));
});

test("R2 R5 R6 R7 R8 (their pinned commits and counts retired by R10): WORDS_COMMIT is no earlier pinned commit but the version of the file in the tree, and WORD_ROWS moves with the file, so no earlier list or count is kept; control: no row's en holds \"labelled\" (R8) and a list with one en re-spelled refuses", () => {
  for (const pinned of ["3660c18803", "e08cd35ecb", "3f40899950", "a0fab7abf0", "6f0d88d8d5", "4664e8efd4", "f498560a37"])
    assert.notEqual(WORDS_COMMIT, pinned);
  assert.equal(WORDS_COMMIT, createHash("sha256").update(bytes).digest("hex").slice(0, 10));
  assert.equal(WORD_ROWS.filter((r) => r[5] === "design").length, file.words.length);
  assert.deepEqual(WORD_ROWS.filter((r) => r[5] === "design" && /labelled/i.test(unplaced(enOf(r)))).map((r) => r[0]), []);
  const i = WORD_ROWS.findIndex((r) => /labeled/.test(enOf(r)));
  if (i >= 0) {
    const old = WORD_ROWS.map((r, j) => (j === i ? [keyOf(r), enOf(r).replace("labeled", "labelled"), ...r.slice(2)] : r));
    assert.notDeepEqual(failures(old, file), []);
  }
});
