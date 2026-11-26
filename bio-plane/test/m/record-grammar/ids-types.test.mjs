/* record-grammar at its interface: the id grammar and the type vocabulary (R1–R5), T33's one id table (R46–R48),
   T41's step and guide ids (R51, R53), T46's success record id (R59), and T48's carried outcome prefix (R63). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BUNDLE_ID_RE, ANN_ID_RE, FILENAME_RE, ISO_TS_RE, OBJECT_TYPES, LEGACY_TYPE_ALIASES, normalizeType, ID_TABLE,
  idPattern, isHypothesisId, isStepId, isGuideId, isSuccessRecordId, STATES, HEADINGS } from "../../../src/record-grammar/index.mjs";

/** A prefix's pattern, which the table holds. @param {string} p @returns {RegExp} */
const held = (p) => {
  const re = idPattern(p);
  assert.ok(re, p);
  return re;
};
/** A prefix's row, which the table holds. @param {string} p */
const rowOf = (p) => {
  const row = ID_TABLE.find((e) => e.prefix === p);
  assert.ok(row, p);
  return row;
};

const PREFIXES = ["INFO", "PROB", "FOCUS", "INQ", "PROJ", "ACTN", "BIAS", "STD", "CONF", "CONS", "ESC", "ASP", "GOAL", "PLN"];
const SLUGS_OK = ["a", "a1", "abc-def", "a-b-c", "0-9", "x2-y3-z4"];
const SLUGS_BAD = ["", "-a", "a-", "a--b", "A", "a_b", "a.b", "a b", "é"];
const ANN = ".ann-20260930T120000Z-note";

/* The counter is ID_TABLE's sequential form (R46): four or more digits, no ceiling. */
const COUNTERS_OK = ["0001", "9999", "10000", "00011", "123456789"];
const COUNTERS_BAD = ["", "1", "001", "999", "0a01", "１２３４"];

test("R1 BUNDLE_ID_RE: exactly <PREFIX>-<4 digits>-<4 or more digits>-<slug>, over the whole prefix set", () => {
  for (const p of PREFIXES) {
    for (const s of SLUGS_OK) assert.ok(BUNDLE_ID_RE.test(`${p}-2026-0001-${s}`), `${p} ${s}`);
    for (const s of SLUGS_BAD) assert.ok(!BUNDLE_ID_RE.test(`${p}-2026-0001-${s}`), `${p} bad slug '${s}'`);
    for (const c of COUNTERS_OK) assert.ok(BUNDLE_ID_RE.test(`${p}-2026-${c}-a`), `${p} counter ${c}`);
    for (const c of COUNTERS_BAD) assert.ok(!BUNDLE_ID_RE.test(`${p}-2026-${c}-a`), `${p} bad counter '${c}'`);
    /* The 10,000th id of a year is accepted (R46). */
    assert.ok(BUNDLE_ID_RE.test(`${p}-2026-10000-x`), `${p} 10,000th`);
    for (const bad of [`${p}-26-0001-a`, `${p}-2026-001-a`, `${p}-20266-0001-a`, `${p}-2026-0001`, `${p}-2026-10000`,
      `${p}-2026-0001-`, `${p.toLowerCase()}-2026-0001-a`, ` ${p}-2026-0001-a`, `${p}-2026-0001-a `, `${p}-2026-0001-a\n`,
      `${p}-2026-0001-a${ANN}`, `${p}-2026-abcdefghijklmnop-a`])
      assert.ok(!BUNDLE_ID_RE.test(bad), bad);
  }
  for (const p of ["ENT", "CASE", "PLAN", "PL", "INFOS", "XINFO", "RUN", "", "EVT", "HYP", "CALC", "STQ", "SUC"])
    assert.ok(!BUNDLE_ID_RE.test(`${p}-2026-0001-a`), p);
});

test("R1 ANN_ID_RE: exactly a bundle id and .ann-<8 digits>T<6 digits>Z-<slug>, with the same prefix set", () => {
  for (const p of PREFIXES) {
    for (const s of SLUGS_OK) assert.ok(ANN_ID_RE.test(`${p}-2026-0001-a.ann-20260930T120000Z-${s}`), `${p} ${s}`);
    for (const s of SLUGS_BAD) assert.ok(!ANN_ID_RE.test(`${p}-2026-0001-a.ann-20260930T120000Z-${s}`), `${p} '${s}'`);
    for (const bad of [`${p}-2026-0001-a`, `${p}-2026-0001-a.ann-2026093T120000Z-x`, `${p}-2026-0001-a.ann-20260930T12000Z-x`,
      `${p}-2026-0001-a.ann-20260930T120000-x`, `${p}-2026-0001-a.ann-20260930120000Z-x`, `${p}-2026-0001-a.note-20260930T120000Z-x`,
      `${p}-2026-0001-A${ANN}`, `${p}-2026-0001-a${ANN}\n`])
      assert.ok(!ANN_ID_RE.test(bad), bad);
  }
  for (const p of PREFIXES) for (const c of COUNTERS_OK) assert.ok(ANN_ID_RE.test(`${p}-2026-${c}-a${ANN}`), `${p} ${c}`);
  for (const p of PREFIXES) for (const c of COUNTERS_BAD) assert.ok(!ANN_ID_RE.test(`${p}-2026-${c}-a${ANN}`), `${p} '${c}'`);
  for (const p of ["ENT", "PLAN", "X", "EVT", "HYP", "SUC"]) assert.ok(!ANN_ID_RE.test(`${p}-2026-0001-a${ANN}`), p);
});

test("R1 both patterns carry the same prefix set, each a sequential prefix of ID_TABLE, built from idPattern", () => {
  const form = new Map(ID_TABLE.map((e) => [e.prefix, e.form]));
  for (const p of PREFIXES) {
    assert.equal(form.get(p), "sequential", p);
    assert.ok(BUNDLE_ID_RE.source.includes(held(p).source.slice(1, -1)), p);
    assert.ok(ANN_ID_RE.source.includes(held(p).source.slice(1, -1)), p);
  }
  /* No prefix of the table outside R1's set reaches either pattern, in either form. */
  for (const { prefix, form: f } of ID_TABLE) {
    if (PREFIXES.includes(prefix)) continue;
    const core = f === "opaque" ? `${prefix}-2026-abcdefghij012345` : `${prefix}-2026-0001`;
    assert.ok(!BUNDLE_ID_RE.test(`${core}-a`) && !ANN_ID_RE.test(`${core}-a${ANN}`), prefix);
  }
});

test("R2 FILENAME_RE: a non-empty string of [A-Za-z0-9._-] only", () => {
  const allowed = new Set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-");
  for (let c = 0; c < 0x250; c++) {
    const ch = String.fromCharCode(c);
    assert.equal(FILENAME_RE.test(`a${ch}b`), allowed.has(ch), `char ${c}`);
    assert.equal(FILENAME_RE.test(ch), allowed.has(ch), `alone ${c}`);
  }
  assert.ok(!FILENAME_RE.test(""));
  assert.ok(FILENAME_RE.test("bundle.md") && FILENAME_RE.test("..") && FILENAME_RE.test("a_b-c.d"));
  assert.ok(!FILENAME_RE.test("a/b") && !FILENAME_RE.test("a\n") && !FILENAME_RE.test("a\nb"));
});

test("R2 ISO_TS_RE: exactly YYYY-MM-DDTHH:MM:SSZ, no fraction, no offset", () => {
  assert.ok(ISO_TS_RE.test("2026-09-30T12:00:00Z"));
  assert.ok(ISO_TS_RE.test("0000-00-00T00:00:00Z"));
  for (const bad of ["2026-09-30T12:00:00.000Z", "2026-09-30T12:00:00+00:00", "2026-09-30T12:00:00", "2026-09-30 12:00:00Z",
    "2026-09-30t12:00:00Z", "2026-09-30T12:00:00z", "26-09-30T12:00:00Z", "2026-9-30T12:00:00Z", "2026-09-30T12:00Z",
    " 2026-09-30T12:00:00Z", "2026-09-30T12:00:00Z ", "2026-09-30T12:00:00Z\n", "2026-09-30"])
    assert.ok(!ISO_TS_RE.test(bad), bad);
});

/** @type {{[prefix: string]: string}} */
const NEW_TYPES = { CALC: "calculation", EVT: "event", LIN: "line", MNY: "money_fact", MSR: "money_set", PFA: "person_fact",
  IDC: "identity_claim", MTI: "member_tie", CHK: "interest_check", HYP: "hypothesis", DUT: "duty", STQ: "standing_question" };

/* OBJECT_TYPES as R3 and R59 name it. */
/** @type {{[prefix: string]: string}} */
const TYPES = { INFO: "information", PROB: "inquiry", FOCUS: "inquiry", INQ: "inquiry", PROJ: "project",
  ACTN: "action", BIAS: "bias", STD: "standard", CONF: "determination", CONS: "consequence", ESC: "escalation",
  ASP: "aspiration", GOAL: "goal", PLN: "action_plan", CALC: "calculation", EVT: "event", LIN: "line", MNY: "money_fact",
  MSR: "money_set", PFA: "person_fact", IDC: "identity_claim", MTI: "member_tie", CHK: "interest_check", HYP: "hypothesis",
  DUT: "duty", STQ: "standing_question", SUC: "success_record" };

test("R3 R59 OBJECT_TYPES: every prefix of R1, of T33's new objects and T46's SUC to its type, and its keys exactly those", () => {
  assert.deepEqual({ ...OBJECT_TYPES }, TYPES);
  assert.deepEqual(Object.keys(OBJECT_TYPES).sort(), [...PREFIXES, ...Object.keys(NEW_TYPES), "SUC"].sort());
  /* R1's keys are exactly the prefixes both patterns carry. */
  for (const k of PREFIXES) {
    assert.ok(BUNDLE_ID_RE.test(`${k}-2026-0001-a`), k);
    assert.ok(ANN_ID_RE.test(`${k}-2026-0001-a${ANN}`), k);
  }
  /* The new objects' prefixes are all ID_TABLE's, and none is a bundle prefix. */
  const table = new Set(ID_TABLE.map((e) => e.prefix));
  for (const k of Object.keys(NEW_TYPES)) {
    assert.ok(table.has(k), k);
    assert.ok(!BUNDLE_ID_RE.test(`${k}-2026-0001-a`), k);
  }
});

test("R4 LEGACY_TYPE_ALIASES: {problem, focus} -> inquiry, flat", () => {
  assert.deepEqual(LEGACY_TYPE_ALIASES, { problem: "inquiry", focus: "inquiry" });
  for (const v of [LEGACY_TYPE_ALIASES.problem, LEGACY_TYPE_ALIASES.focus]) assert.ok(!Object.hasOwn(LEGACY_TYPE_ALIASES, v), `${v} is an alias`);
});

test("R5 normalizeType: an own alias key to its target, anything else unchanged, never throws", () => {
  assert.equal(normalizeType("problem"), "inquiry");
  assert.equal(normalizeType("focus"), "inquiry");
  assert.deepEqual({ ...OBJECT_TYPES }, TYPES);
  for (const t of [...new Set(Object.values(TYPES)), "Problem", "FOCUS", "", " problem", "unknown"])
    assert.equal(normalizeType(t), t);
  for (const t of Object.getOwnPropertyNames(Object.prototype)) assert.equal(normalizeType(t), t, t);
  /** @type {unknown[]} */
  const odd = [undefined, null, 0, 1, NaN, true, false, Symbol("s"), [], ["problem"], {}, { __proto__: null },
    { toString() { throw new Error("x"); } }, () => "problem", 10n];
  for (const t of odd) assert.ok(Object.is(normalizeType(t), t), String(typeof t));
});

/* ID_TABLE as T33 holds it (R46): the census of every prefix minted or validated at T33's opening, with T33's new objects
   and the reserved prefixes, and each row added since. Pinned whole; T48 (R63) re-pinned it: WCD's owner case-inputs, OUTC
   last. */
/** @type {[string, string, string?, string?][]} */
const ROWS = [
  ["INFO", "capture"], ["PROB", "inquiry"], ["FOCUS", "inquiry"], ["INQ", "inquiry"], ["PROJ", "promotion"],
  ["ACTN", "actions"], ["BIAS", "bias"], ["STD", "standards"], ["CONF", "conformance"], ["CONS", "consequences"],
  ["ESC", "escalation"], ["ASP", "intent"], ["GOAL", "intent"], ["PLN", "action-plans"],
  ["ENT", "entities"], ["REL", "entities"], ["STDP", "standards"], ["ACT", "conformance"], ["CMP", "conformance"],
  ["FIL", "filings"], ["CPK", "filings"], ["THY", "filings"], ["GATH", "monitoring"], ["THEME", "connections"],
  ["LEAD", "observation-log"], ["TASK", "tasks"],
  ["CASE", "case-authoring"], ["WCD", "case-inputs"], ["DRAFT", "review"], ["RVG", "review"], ["SRC", "sources"],
  ["NOTE", "network-notices"], ["DKT", "docket"], ["TPL", "filing-templates"], ["TPP", "filing-templates"],
  ["TRG", "filing-templates"], ["WIZ", "wizard-scripts"], ["WZP", "wizard-scripts"], ["WEG", "wizard-scripts"],
  ["EVT", "events", "opaque"], ["LIN", "lines", "opaque"], ["MNY", "money", "opaque"], ["PFA", "people", "opaque"],
  ["IDC", "people", "opaque"],
  ["MTI", "people"], ["CHK", "people"], ["MSR", "money"], ["HYP", "hypotheses"], ["DUT", "duties"],
  ["CALC", "calculations", "opaque", "sequential"], ["STQ", "answers"],
  ["STP", "steps", "opaque"], ["GUD", "reading-guides", "opaque"], ["ACD", "case-account", "opaque", "sequential"],
  ["SUC", "consequences"], ["OUTC", "case-inputs"],
];
/** @type {{prefix: string, owner: string, form: string, legacy?: string}[]} */
const TABLE = ROWS.map(([prefix, owner, form = "sequential", legacy]) => (legacy ? { prefix, owner, form, legacy } : { prefix, owner, form }));
const SEQUENTIAL = TABLE.filter((e) => e.form === "sequential").map((e) => e.prefix);
const OPAQUE = TABLE.filter((e) => e.form === "opaque").map((e) => e.prefix);
const TAIL = "a1b2c3d4e5f6g7h8";

test("R46 ID_TABLE: frozen, one {prefix, owner, form} per prefix, no prefix twice, holding exactly T33's census with T34's CALC opaque and its legacy sequential form, T41's STP and GUD, T42's ACD, T46's SUC, and T48's OUTC", () => {
  assert.ok(Object.isFrozen(ID_TABLE));
  for (const e of ID_TABLE) {
    assert.ok(Object.isFrozen(e), e.prefix);
    /* `legacy` only on a row read in an earlier form (K1728): CALC, and since T42 ACD (R55), never the row's own form. */
    assert.deepEqual(Object.keys(e).sort(), ["CALC", "ACD"].includes(e.prefix) ? ["form", "legacy", "owner", "prefix"] : ["form", "owner", "prefix"], e.prefix);
    const legacy = e.legacy;
    if (legacy !== undefined) assert.ok(["sequential", "opaque"].includes(legacy) && legacy !== e.form, e.prefix);
    assert.match(e.prefix, /^[A-Z]+$/);
    assert.ok(typeof e.owner === "string" && /^[a-z][a-z-]*$/.test(e.owner), e.prefix);
    assert.ok(["sequential", "opaque"].includes(e.form), e.prefix);
  }
  assert.equal(new Set(ID_TABLE.map((e) => e.prefix)).size, ID_TABLE.length);
  assert.deepEqual(ID_TABLE.map((e) => ({ ...e })), TABLE);
  /* R1's prefixes sequential; ENT widened; the five new objects opaque, and since T34 CALC (N570); the other reserved six
     sequential, with STQ answers'. */
  for (const p of PREFIXES) assert.equal(rowOf(p).form, "sequential", p);
  assert.deepEqual(OPAQUE, ["EVT", "LIN", "MNY", "PFA", "IDC", "CALC", "STP", "GUD", "ACD"]);
  for (const p of ["MTI", "CHK", "MSR", "HYP", "DUT", "STQ", "ENT", "SUC", "OUTC"]) assert.ok(SEQUENTIAL.includes(p), p);
  assert.deepEqual({ ...rowOf("CALC") },
    { prefix: "CALC", owner: "calculations", form: "opaque", legacy: "sequential" });
});

test("R46 every id valid before T33 stays valid; the 10,000th id of every sequential prefix is accepted; the controls refused", () => {
  for (const p of SEQUENTIAL) {
    const re = held(p);
    /* Before T33 every validator read <P>-<4 digits>-<4 digits>: all of those stay valid. */
    for (const n of ["0000", "0001", "0420", "9999"]) assert.ok(re.test(`${p}-2026-${n}`), `${p} ${n}`);
    for (let n = 1; n <= 10000; n += 1111) assert.ok(re.test(`${p}-2026-${String(n).padStart(4, "0")}`), `${p} ${n}`);
    assert.ok(re.test(`${p}-2026-10000`), `${p} 10,000th`);
    assert.ok(re.test(`${p}-1999-123456`), p);
    for (const bad of [`${p}-2026-999`, `${p}-2026-`, `${p}-26-0001`, `${p}-20266-0001`, `${p}-2026-0001-a`, `${p}-2026-${TAIL}`,
      `${p.toLowerCase()}-2026-0001`, ` ${p}-2026-0001`, `${p}-2026-0001\n`])
      assert.ok(!re.test(bad), bad);
  }
  assert.ok(!held("ENT").test("ENT-2026-999"));
  assert.ok(held("ENT").test("ENT-2026-10000"));
  /* T34 (N570, K1728): CALC is minted opaque, and a CALC- id minted sequentially before T34 (as a copy on 0.80.0 holds)
     stays valid wherever it is read: idPattern('CALC') matches both cores and refuses the controls of each. */
  const calc = held("CALC");
  for (const ok of [`CALC-2026-${TAIL}`, "CALC-2026-0001", "CALC-2026-9999", "CALC-2026-10000", "CALC-2026-0000000000000000"])
    assert.ok(calc.test(ok), ok);
  for (const bad of ["CALC-2026-999", `CALC-2026-${TAIL.slice(1)}`, `CALC-2026-${TAIL}x`, "CALC-2026-A1b2c3d4e5f6g7h8",
    "CALC-2026-0001-a", `CALC-2026-${TAIL}-a`, "CALC-26-0001", `calc-2026-${TAIL}`, "CALC-2026-12345abc"])
    assert.ok(!calc.test(bad), bad);
  for (const p of OPAQUE) {
    const re = held(p);
    const legacySequential = TABLE.find((e) => e.prefix === p)?.legacy === "sequential";
    assert.ok(re.test(`${p}-2026-${TAIL}`) && re.test(`${p}-2026-0000000000000000`) && re.test(`${p}-2026-zzzzzzzzzzzzzzzz`), p);
    for (const bad of [`${p}-2026-${TAIL.slice(1)}`, `${p}-2026-${TAIL}x`, `${p}-2026-A1b2c3d4e5f6g7h8`, `${p}-2026-a1b2c3d4e5f6g7H8`,
      `${p}-2026-a1b2c3d4e5f6g7_8`, `${p}-26-${TAIL}`, `${p}-2026-${TAIL}-a`])
      assert.ok(!re.test(bad), bad);
    /* A sequential core is refused for an opaque prefix, unless its row reads that form as legacy (CALC). */
    for (const seq of [`${p}-2026-0001`, `${p}-2026-10000`]) assert.equal(re.test(seq), legacySequential, seq);
  }
});

/* An independent reading of R47's two forms, against which every prefix's pattern is driven over a grid of candidates. */
/** @param {string} prefix @param {string} form @param {string} s @param {string} [legacy] @returns {boolean} */
const reference = (prefix, form, s, legacy) => {
  if (legacy && reference(prefix, legacy, s)) return true;
  const head = `${prefix}-`;
  if (!s.startsWith(head)) return false;
  const rest = s.slice(head.length);
  const year = rest.slice(0, 4), dash = rest[4], tail = rest.slice(5);
  if (!/^[0-9]{4}$/.test(year) || dash !== "-") return false;
  return form === "opaque" ? tail.length === 16 && [...tail].every((c) => "abcdefghijklmnopqrstuvwxyz0123456789".includes(c))
    : tail.length >= 4 && [...tail].every((c) => "0123456789".includes(c));
};

test("R47 idPattern: the anchored RegExp of exactly that prefix's id core in its ID_TABLE form, and in its legacy form for a row with legacy; null for any other prefix; never throws", () => {
  const tails = ["0001", "9999", "10000", "999", "", TAIL, TAIL.slice(1), TAIL + "0", TAIL.toUpperCase(), "0000000000000000",
    "00000000000000000", "a", "1234a", "x".repeat(16), "-0001", "0001-a"];
  const years = ["2026", "0000", "202", "20260", "abcd"];
  for (const { prefix, form, legacy } of ID_TABLE) {
    const re = held(prefix);
    assert.ok(re instanceof RegExp, prefix);
    assert.equal(re.flags, "", prefix);
    assert.ok(re.source.startsWith(`^${prefix}-`) && re.source.endsWith("$"), prefix);
    assert.notEqual(held(prefix), re, "a new RegExp each call");
    for (const other of ID_TABLE.map((e) => e.prefix).concat(["", prefix.toLowerCase(), `X${prefix}`, `${prefix}X`]))
      for (const y of years) for (const t of tails) {
        const s = `${other}-${y}-${t}`;
        assert.equal(re.test(s), other === prefix && reference(prefix, form, s, legacy), `${prefix} on '${s}'`);
      }
    /* A validator whose ids carry a slug composes it after the core, keeping its own slug rule. */
    const withSlug = new RegExp(`^${re.source.slice(1, -1)}-[a-z0-9]+(-[a-z0-9]+)*$`);
    const core = form === "opaque" ? `${prefix}-2026-${TAIL}` : `${prefix}-2026-10000`;
    assert.ok(withSlug.test(`${core}-a-b`) && !withSlug.test(core) && !withSlug.test(`${core}-A`), prefix);
    /* A row with legacy: its pattern composes inside a larger alternation without adding a capturing group. */
    assert.equal(new RegExp(`(${re.source.slice(1, -1)})`).exec(core)?.length, 2, prefix);
    if (legacy) assert.ok(withSlug.test(`${prefix}-2026-${legacy === "sequential" ? "0001" : TAIL}-a`), prefix);
  }
  /** @type {unknown[]} */
  const odd = [undefined, null, 0, 1, NaN, true, {}, [], ["HYP"], "", "hyp", "HYP ", " HYP", "HYP-", "X", "constructor", "__proto__",
    "toString", "hasOwnProperty", Symbol("HYP"), 10n, () => "HYP", { toString() { throw new Error("x"); } }, new String("HYP")];
  for (const v of odd) assert.equal(idPattern(v), null, String(typeof v));
});

test("R48 isHypothesisId: true exactly for a string matching idPattern('HYP'); never throws", () => {
  const re = held("HYP");
  const cands = ["HYP-2026-0001", "HYP-2026-10000", "HYP-2026-999", "HYP-2026-0001-a", "HYP-2026-" + TAIL, "hyp-2026-0001",
    " HYP-2026-0001", "HYP-2026-0001\n", "INQ-2026-0001", "INQ-2026-0001-hyp", "HYP-26-0001", ""];
  for (const { prefix } of ID_TABLE) cands.push(`${prefix}-2026-0001`, `${prefix}-2026-${TAIL}`);
  for (const c of cands) assert.equal(isHypothesisId(c), re.test(c), c);
  assert.equal(isHypothesisId("HYP-2026-0001"), true);
  assert.equal(isHypothesisId("HYP-2026-10000"), true);
  for (const v of [undefined, null, 0, 20260001, NaN, true, {}, [], ["HYP-2026-0001"], Symbol("HYP-2026-0001"), 10n,
    () => "HYP-2026-0001", { toString() { throw new Error("x"); } }, new String("HYP-2026-0001"), { __proto__: null }])
    assert.equal(isHypothesisId(v), false, String(typeof v));
});

/* T41 (R51, R53): each new id explicitly, with its negative controls (K874): the other prefix's id, a sequential core, a
   tail one short or long or upper-cased, a slug after the core, and every non-string. */
/** @param {string} name @param {(v: unknown) => boolean} fn @param {string} prefix @param {string} owner */
const opaqueIdTest = (name, fn, prefix, owner) => {
  const row = ID_TABLE.find((e) => e.prefix === prefix);
  assert.deepEqual({ ...row }, { prefix, owner, form: "opaque" }, name);
  const re = held(prefix);
  const cands = [`${prefix}-2026-${TAIL}`, `${prefix}-2026-0000000000000000`, `${prefix}-1999-zzzzzzzzzzzzzzzz`,
    `${prefix}-2026-0001`, `${prefix}-2026-10000`, `${prefix}-2026-${TAIL.slice(1)}`, `${prefix}-2026-${TAIL}0`,
    `${prefix}-2026-${TAIL.toUpperCase()}`, `${prefix}-2026-${TAIL}-a`, `${prefix.toLowerCase()}-2026-${TAIL}`,
    ` ${prefix}-2026-${TAIL}`, `${prefix}-2026-${TAIL}\n`, `${prefix}-26-${TAIL}`, ""];
  for (const { prefix: p } of ID_TABLE) cands.push(`${p}-2026-0001`, `${p}-2026-${TAIL}`);
  for (const c of cands) assert.equal(fn(c), re.test(c), `${name} on '${c}'`);
  for (const ok of [`${prefix}-2026-${TAIL}`, `${prefix}-2026-0000000000000000`, `${prefix}-1999-zzzzzzzzzzzzzzzz`])
    assert.equal(fn(ok), true, ok);
  for (const bad of [`${prefix}-2026-0001`, `${prefix}-2026-10000`, `${prefix}-2026-${TAIL.slice(1)}`, `${prefix}-2026-${TAIL}0`,
    `${prefix}-2026-${TAIL.toUpperCase()}`, `${prefix}-2026-${TAIL}-a`, `${prefix.toLowerCase()}-2026-${TAIL}`, `HYP-2026-${TAIL}`,
    `${prefix === "STP" ? "GUD" : "STP"}-2026-${TAIL}`, `EVT-2026-${TAIL}`])
    assert.equal(fn(bad), false, bad);
  for (const v of [undefined, null, 0, NaN, true, {}, [], [`${prefix}-2026-${TAIL}`], Symbol(prefix), 10n,
    () => `${prefix}-2026-${TAIL}`, { toString() { throw new Error("x"); } }, new String(`${prefix}-2026-${TAIL}`), { __proto__: null }])
    assert.equal(fn(v), false, `${name} ${String(typeof v)}`);
  /* Neither is a bundle id (R1, R3: rows of their owners' tables, not documents). */
  assert.ok(!BUNDLE_ID_RE.test(`${prefix}-2026-${TAIL}-a`) && !Object.hasOwn(OBJECT_TYPES, prefix), prefix);
};

test("R51 ID_TABLE gains STP (owner steps, opaque); isStepId is true exactly for a string matching idPattern('STP'); never throws", () => {
  opaqueIdTest("isStepId", isStepId, "STP", "steps");
});

test("R53 ID_TABLE gains GUD (owner reading-guides, opaque); isGuideId is true exactly for a string matching idPattern('GUD'); never throws", () => {
  opaqueIdTest("isGuideId", isGuideId, "GUD", "reading-guides");
});

/* T42 (R55; N839, K2608): the account draft's prefix, `case-account`'s, opaque, its four-digit ids minted since T41 read
   as its legacy sequential form (K1728's pattern); with its negative controls (K874): an ACD id of the wrong form. */
test("R55 ID_TABLE gains ACD (owner case-account, form opaque, legacy sequential): idPattern('ACD') matches an opaque core and the four-or-more-digit core minted since T41, and refuses every other form", () => {
  assert.deepEqual({ ...rowOf("ACD") },
    { prefix: "ACD", owner: "case-account", form: "opaque", legacy: "sequential" });
  assert.equal(ID_TABLE.filter((e) => e.prefix === "ACD").length, 1);
  const at = ID_TABLE.findIndex((e) => e.prefix === "ACD");
  assert.deepEqual(ID_TABLE.slice(at - 2, at + 1).map((e) => e.prefix), ["STP", "GUD", "ACD"], "after T41's rows");
  const re = held("ACD");
  for (const ok of [`ACD-2026-${TAIL}`, "ACD-2026-0000000000000000", "ACD-1999-zzzzzzzzzzzzzzzz",
    "ACD-2026-0417", "ACD-2026-9999", "ACD-2026-0000", "ACD-2026-10000"]) assert.ok(re.test(ok), ok);
  /* Negative controls: the wrong form, the wrong prefix, a slug, an upper case, a short year, padding. */
  for (const bad of ["ACD-2026-041", `ACD-2026-${TAIL.slice(1)}`, `ACD-2026-${TAIL}0`, `ACD-2026-${TAIL.toUpperCase()}`,
    "ACD-2026-a1b2c3d4e5f6g7H8", "ACD-2026-0417-a", `ACD-2026-${TAIL}-a`, "ACD-2026-12345abc", "ACD-26-0417", `ACD-26-${TAIL}`,
    "acd-2026-0417", `acd-2026-${TAIL}`, " ACD-2026-0417", "ACD-2026-0417\n", "ACD-2026-", "ACD", `STP-2026-${TAIL}`, "CASE-2026-0417",
    `ACDX-2026-${TAIL}`, `XACD-2026-${TAIL}`]) assert.ok(!re.test(bad), bad);
  /* An account draft is a row of its owner's table, never a bundle (R1, R3). */
  assert.ok(!BUNDLE_ID_RE.test(`ACD-2026-${TAIL}-a`) && !BUNDLE_ID_RE.test("ACD-2026-0417-a") && !Object.hasOwn(OBJECT_TYPES, "ACD"));
});

/* T46 (R59; N911, K2845): the success record's prefix, `consequences`', sequential, every `SUC-<year>-<4 digits>` id it has
   minted in its own rows since T45 still valid; with its type, its one-state machine and its own test, and the negative
   controls (K874): a counter too short, an opaque tail, a slug, another prefix, every non-string. */
test("R59 ID_TABLE gains SUC (owner consequences, form sequential), after ACD; OBJECT_TYPES maps it to success_record; STATES holds success_record: legal recorded, no edge; it is no bundle prefix and has no headings", () => {
  assert.deepEqual({ ...rowOf("SUC") }, { prefix: "SUC", owner: "consequences", form: "sequential" });
  assert.equal(ID_TABLE.filter((e) => e.prefix === "SUC").length, 1);
  const at = ID_TABLE.findIndex((e) => e.prefix === "SUC");
  assert.equal(ID_TABLE[at - 1]?.prefix, "ACD", "after T42's ACD");
  assert.equal(OBJECT_TYPES.SUC, "success_record");
  assert.deepEqual(STATES.success_record, { legal: ["recorded"], edges: { recorded: [] } });
  /* A row object promoted with history: a type and a machine, and nothing a bundle has (R3, R59). */
  assert.ok(!PREFIXES.includes("SUC") && !Object.hasOwn(HEADINGS, "success_record"));
  assert.ok(!BUNDLE_ID_RE.test("SUC-2026-0001-a") && !ANN_ID_RE.test(`SUC-2026-0001-a${ANN}`));
  /* Every id consequences minted since T45 (`SUC-<year>-<4 digits>`) stays valid, and the 10,000th is accepted. */
  const re = held("SUC");
  for (const ok of ["SUC-2026-0001", "SUC-2026-0000", "SUC-2026-9999", "SUC-2026-10000", "SUC-1999-123456"]) assert.ok(re.test(ok), ok);
  for (const bad of ["SUC-2026-999", `SUC-2026-${TAIL}`, "SUC-2026-0001-a", "SUC-26-0001", "suc-2026-0001", " SUC-2026-0001",
    "SUC-2026-0001\n", "SUC-2026-", "XSUC-2026-0001", "SUCC-2026-0001", "SU-2026-0001"]) assert.ok(!re.test(bad), bad);
});

test("R59 isSuccessRecordId is true exactly for a string matching idPattern('SUC'); never throws", () => {
  const re = held("SUC");
  const cands = ["SUC-2026-0001", "SUC-2026-10000", "SUC-2026-999", "SUC-2026-0001-a", `SUC-2026-${TAIL}`, "suc-2026-0001",
    " SUC-2026-0001", "SUC-2026-0001\n", "SUC-26-0001", "CONS-2026-0001", "CONS-2026-0001-suc", ""];
  for (const { prefix } of ID_TABLE) cands.push(`${prefix}-2026-0001`, `${prefix}-2026-${TAIL}`);
  for (const c of cands) assert.equal(isSuccessRecordId(c), re.test(c), c);
  assert.equal(isSuccessRecordId("SUC-2026-0001"), true);
  assert.equal(isSuccessRecordId("SUC-2026-10000"), true);
  /* Negative controls: the nearest other ids are not success records. */
  for (const bad of ["CONS-2026-0001", "HYP-2026-0001", "SUC-2026-999", `SUC-2026-${TAIL}`, "SUC-2026-0001-a"])
    assert.equal(isSuccessRecordId(bad), false, bad);
  for (const v of [undefined, null, 0, 20260001, NaN, true, {}, [], ["SUC-2026-0001"], Symbol("SUC-2026-0001"), 10n,
    () => "SUC-2026-0001", { toString() { throw new Error("x"); } }, new String("SUC-2026-0001"), { __proto__: null }])
    assert.equal(isSuccessRecordId(v), false, String(typeof v));
});

/* T48 (R63; N1017, K3112): a carried outcome's prefix, `case-inputs`', sequential, every `OUTC-<year>-<4 digits>` id it has
   minted since T47 (record-core's mintOpaqueId: four random digits, an empty tail) still valid; and WCD's owner moved to
   case-inputs, the module that has minted it since T47. Its negative controls (K874): another prefix's id, a counter too
   short, an opaque tail, a slug, every non-string; WCD's old owner gone; no other row changed. */
test("R63 ID_TABLE gains OUTC (owner case-inputs, form sequential), last: idPattern('OUTC') matches an id of the form case-inputs mints and refuses a control of another prefix; WCD's owner is case-inputs; OUTC is no bundle prefix and has no type, headings or machine", () => {
  assert.deepEqual({ ...rowOf("OUTC") }, { prefix: "OUTC", owner: "case-inputs", form: "sequential" });
  assert.equal(ID_TABLE.filter((e) => e.prefix === "OUTC").length, 1);
  assert.equal(ID_TABLE.at(-1)?.prefix, "OUTC", "after T46's SUC");
  /* The form case-inputs mints: record-core's mintOpaqueId(prefix, year, "", ...), `<prefix>-<year>-DDDD`, four random
     digits from 0000 to 9999 (record-core R6); the 10,000th and later accepted too (R46). */
  const re = held("OUTC");
  /** @param {string} year @param {number} n */
  const minted = (year, n) => `OUTC-${year}-${String(n).padStart(4, "0")}`;
  for (const n of [0, 1, 417, 5000, 9999]) assert.ok(re.test(minted("2026", n)), minted("2026", n));
  for (const ok of ["OUTC-2047-0001", "OUTC-2026-10000", "OUTC-1999-123456"]) assert.ok(re.test(ok), ok);
  /* Negative controls: the same core under another prefix, its near spellings, and every other form. */
  for (const bad of ["WCD-2026-0417", "CASE-2026-0417", "SUC-2026-0417", "OUT-2026-0417", "OUTCX-2026-0417", "XOUTC-2026-0417",
    "outc-2026-0417", "OUTC-2026-041", `OUTC-2026-${TAIL}`, "OUTC-2026-0417-a", "OUTC-26-0417", " OUTC-2026-0417",
    "OUTC-2026-0417\n", "OUTC-2026-", "OUTC"]) assert.ok(!re.test(bad), bad);
  for (const { prefix } of ID_TABLE) if (prefix !== "OUTC") assert.ok(!re.test(`${prefix}-2026-0417`), prefix);
  /* A row of its owner's table, never a document (R1, R3): no bundle id, no annotation, no type, no heading set, no machine. */
  assert.ok(!PREFIXES.includes("OUTC") && !BUNDLE_ID_RE.test("OUTC-2026-0417-a") && !ANN_ID_RE.test(`OUTC-2026-0417-a${ANN}`));
  assert.ok(!Object.hasOwn(OBJECT_TYPES, "OUTC"));
  assert.deepEqual({ ...OBJECT_TYPES }, TYPES);
  assert.ok(!Object.values(TYPES).some((t) => /outcome/.test(t)) && !Object.keys(HEADINGS).some((t) => /outcome/.test(t))
    && !Object.keys(STATES).some((t) => /outcome/.test(t)));
});

test("R63 WCD's row names case-inputs as owner in place of case-authoring; its form and place unchanged; no other row changes", () => {
  assert.deepEqual({ ...rowOf("WCD") }, { prefix: "WCD", owner: "case-inputs", form: "sequential" });
  assert.equal(ID_TABLE.filter((e) => e.prefix === "WCD").length, 1);
  /* Negative control: the old owner no longer holds it, and still holds CASE. */
  assert.notEqual(rowOf("WCD").owner, "case-authoring");
  assert.equal(rowOf("CASE").owner, "case-authoring");
  /* Its place: beside CASE among the prefixes record-core draws at random. */
  const at = ID_TABLE.findIndex((e) => e.prefix === "WCD");
  assert.deepEqual(ID_TABLE.slice(at - 1, at + 2).map((e) => e.prefix), ["CASE", "WCD", "DRAFT"]);
  /* Every WCD id case-inputs has minted stays valid. */
  for (const ok of ["WCD-2026-0000", "WCD-2026-0417", "WCD-2026-9999"]) assert.ok(held("WCD").test(ok), ok);
  /* No other row changes: the table as T47 held it is the table now, less OUTC, with WCD's old owner. */
  const T47 = TABLE.filter((e) => e.prefix !== "OUTC").map((e) => (e.prefix === "WCD" ? { ...e, owner: "case-authoring" } : e));
  assert.equal(T47.length, ID_TABLE.length - 1);
  const was = ID_TABLE.filter((e) => e.prefix !== "OUTC").map((e) => ({ ...e }));
  const changed = was.filter((e, i) => JSON.stringify(e) !== JSON.stringify(T47[i])).map((e) => e.prefix);
  assert.deepEqual(changed, ["WCD"]);
});
