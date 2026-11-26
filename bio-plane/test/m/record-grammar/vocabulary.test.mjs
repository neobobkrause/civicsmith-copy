/* record-grammar at its interface: canonical JSON (R12), actor identity (R13–R15), the grade vocabulary (R16–R18). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalJson, NON_MEMBER_AUTHORS, ACTOR_CLASSES, MACHINE_AUTHOR_PREFIX, MACHINE_CLASS_PREFIX,
  MACHINE_STAMP_PREFIXES, isMachineStamp, isMachineIdentity, BASIS_ROLES, BASIS_GRADES, GRADE_AXES, TESTIMONY_GRADE,
  GRADE_SOURCES, EARNED_GRADE_SOURCES, EARNED_CAPTURE_CEILING, UNREACHABLE_CAPTURE_GRADE }
  from "../../../src/record-grammar/index.mjs";

/** A value the generator makes: a scalar, undefined, a list or an object of them.
 * @typedef {null | boolean | number | string | undefined | ValueList | ValueMap} Value */
/** @typedef {Array<Value>} ValueList */
/** @typedef {{[key: string]: Value}} ValueMap */

/* The reference: key-sorted, recursively, then JSON.stringify's own spelling of every scalar and omission. */
/** @param {Value} v @returns {Value} */
const sortDeep = (v) => (Array.isArray(v) ? v.map(sortDeep)
  : v !== null && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortDeep(v[k])])) : v);

test("R12 canonicalJson: compact, keys sorted recursively, arrays in order, scalars as JSON.stringify, always JSON", () => {
  assert.equal(canonicalJson({ b: 1, a: [3, { d: null, c: "x" }], "": true }), '{"":true,"a":[3,{"c":"x","d":null}],"b":1}');
  assert.equal(canonicalJson({ a: undefined }), "{}");
  assert.equal(canonicalJson({ a: undefined, b: 1, c: () => 1, d: Symbol("s") }), '{"b":1}');
  assert.equal(canonicalJson([undefined, () => 1, Symbol("s"), 1]), "[null,null,null,1]");
  assert.equal(canonicalJson({ z: { y: undefined } }), '{"z":{}}');
  for (const s of [0, -0, 1.5, -2, NaN, Infinity, "", "é \"\\", true, false, null, 1e21])
    assert.equal(canonicalJson(s), JSON.stringify(s), String(s));
  /* Keys sort in default string order (UTF-16 code units), not locale order. */
  assert.equal(canonicalJson({ b: 0, B: 0, a: 0, "10": 0, "9": 0, "é": 0, "Z": 0 }), '{"10":0,"9":0,"B":0,"Z":0,"a":0,"b":0,"é":0}');
  /* Equal values, built in any key order, give byte-identical strings; every answer parses back to the value. */
  let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  /** @param {number} d @returns {null | boolean | number | string | undefined | ValueList | ValueMap} */
  const gen = (d) => {
    const r = rnd();
    if (d > 3 || r < 0.3) return [null, true, false, 0, -1, 2.5, "s", "", "é", undefined][Math.floor(rnd() * 10)];
    if (r < 0.6) {
      /** @type {ValueList} */
      const list = [];
      for (let n = Math.floor(rnd() * 4); n > 0; n--) list.push(gen(d + 1));
      return list;
    }
    /** @type {ValueMap} */
    const o = {}; for (let i = Math.floor(rnd() * 5); i > 0; i--) o["k" + Math.floor(rnd() * 20)] = gen(d + 1); return o;
  };
  /** @param {Value} v @returns {Value} */
  const shuffle = (v) => (Array.isArray(v) ? v.map(shuffle) : v !== null && typeof v === "object"
    ? Object.fromEntries(Object.keys(v).reverse().map((k) => [k, shuffle(v[k])])) : v);
  for (let i = 0; i < 500; i++) {
    const v = gen(0);
    if (v === undefined) continue;
    const c = canonicalJson(v);
    assert.equal(c, JSON.stringify(sortDeep(v)));
    assert.equal(canonicalJson(shuffle(v)), c);
    assert.equal(canonicalJson(JSON.parse(c)), c);
  }
});

test("R13 the identity vocabulary", () => {
  assert.deepEqual(NON_MEMBER_AUTHORS, ["claude", "pwa-client", "daemon", "sweep", "session", "accelerator", "apps-script",
    "system", "agent", "ai"]);
  assert.deepEqual(ACTOR_CLASSES, ["daemon", "session", "member"]);
  assert.equal(MACHINE_AUTHOR_PREFIX, "token:");
  assert.equal(MACHINE_CLASS_PREFIX, "class:");
  assert.deepEqual(MACHINE_STAMP_PREFIXES, [MACHINE_AUTHOR_PREFIX, MACHINE_CLASS_PREFIX]);
});

/** @param {unknown} w @returns {string} */
const fold = (w) => { try { return String(w ?? "").trim().toLowerCase(); } catch { return ""; } };
/** @type {unknown[]} */
const ODD = [undefined, null, "", "   ", "\n\t", 0, 1, true, false, NaN, [], ["token:x"], {}, { __proto__: null },
  { toString() { throw new Error("x"); } }, { toString() { return " Token:Member "; } }, Symbol("s"), 10n];
const NAMES = ["alice", "Bob Smith", "admin", "tokenx", "token", "token :x", "class", "x token:y", "members", "claudette",
  "ai-member", " sweeper", "ctoken:", "ｔoken:x"];
/** @returns {unknown[]} */
const all = () => [...ODD, ...NAMES, ...NON_MEMBER_AUTHORS, ...ACTOR_CLASSES,
  ...[...NON_MEMBER_AUTHORS, ...ACTOR_CLASSES].flatMap((w) => [w.toUpperCase(), ` ${w} `, `\t${(w[0] ?? "").toUpperCase()}${w.slice(1)}\n`]),
  ...MACHINE_STAMP_PREFIXES.flatMap((p) => [p, p + "member", p.toUpperCase() + "daemon", `  ${p}x  `, p + " ", "x" + p])];

test("R14 isMachineStamp: the folded value is non-empty and begins with a stamp prefix; never throws", () => {
  for (const w of all()) {
    const s = fold(w);
    assert.equal(isMachineStamp(w), s !== "" && MACHINE_STAMP_PREFIXES.some((p) => s.startsWith(p)), String(fold(w)));
  }
  assert.equal(isMachineStamp("Token:member"), true);
  assert.equal(isMachineStamp(" class:session "), true);
  assert.equal(isMachineStamp("daemon"), false);
});

test("R15 isMachineIdentity: a stamp, an actor class or a non-member author; absent or blank is false; never throws", () => {
  for (const w of all()) {
    const s = fold(w);
    const want = s !== "" && (MACHINE_STAMP_PREFIXES.some((p) => s.startsWith(p)) || ACTOR_CLASSES.includes(s)
      || NON_MEMBER_AUTHORS.includes(s));
    assert.equal(isMachineIdentity(w), want, s);
  }
  for (const w of [undefined, null, "", "  "]) assert.equal(isMachineIdentity(w), false);
  for (const w of ["member", "AI", " Claude ", "token:member", "CLASS:x"]) assert.equal(isMachineIdentity(w), true, w);
  for (const w of ["alice", "admin"]) assert.equal(isMachineIdentity(w), false, w);
});

test("R16 R17 R18 the grade vocabulary; the unreachable letter derived one rank above the ceiling", () => {
  assert.deepEqual(BASIS_ROLES, ["supports", "cuts_against"]);
  assert.deepEqual(BASIS_GRADES, ["A", "B", "C", "D"]);
  assert.deepEqual(GRADE_AXES, ["capture", "connection", "testimony"]);
  assert.equal(TESTIMONY_GRADE, "D");
  assert.ok(BASIS_GRADES.includes(TESTIMONY_GRADE));
  assert.deepEqual(GRADE_SOURCES, ["resolution", "testimony", "hunch", "inherited", "capture"]);
  assert.deepEqual(EARNED_GRADE_SOURCES, ["resolution", "capture"]);
  for (const s of EARNED_GRADE_SOURCES) assert.ok(GRADE_SOURCES.includes(s), s);
  assert.equal(EARNED_CAPTURE_CEILING, "B");
  const i = BASIS_GRADES.indexOf(EARNED_CAPTURE_CEILING);
  assert.ok(i >= 0);
  assert.equal(UNREACHABLE_CAPTURE_GRADE, i === 0 ? null : BASIS_GRADES[i - 1]);
  assert.equal(UNREACHABLE_CAPTURE_GRADE, "A");
});
