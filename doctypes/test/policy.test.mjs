/* doctypes — requirement-named tests for the `policy` type (R25–R36, and its share of R1–R3, R7, R20), at the
 * module's interface: `doctypes/index.mjs` and the type's own `detect`, `parse` and `assess`. Read under
 * `jurisdictions`' test profile, Port Ellery, which is not the first profile (R20), and measured on the 50 captured
 * policies of R35 (./policies.mjs) against a member's reading of each, written before the reader existed. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DOCTYPES, policy } from "../index.mjs";
import { CONFIDENCE } from "../../site-profiles/index.mjs";
import { CONTRACT } from "../../docprofile/doctypes/index.mjs";
import { flattenText, makeLocator } from "../../docprofile/readtext.mjs";
import { EMPTY, HELD, PE, PE_POLICY } from "./fixtures.mjs";
import { CASES } from "./golden-cases.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";
import { readWith, registryOf } from "./read.mjs";
import { POLICIES, ANSWERS, SECTION_ANSWERS, FRESH, FRESH_ANSWERS, score, scoreSections, same } from "./policies.mjs";
/** @import { DoctypeContext } from "../../docprofile/doctypes/index.mjs" */
/** @import { View, PolicyHeaderField } from "../../jurisdictions/index.mjs" */
/** @import { EventHead } from "../../site-profiles/index.mjs" */
/** @import { PolicyReading } from "../policy.mjs" */
/** @import { HeaderFields, PolicyHeaderReading } from "../policy-header.mjs" */

/** `x`, which the test has made sure is there; a `TypeError` where it is not, as reading a member of it would have.
 *  @template T
 *  @param {T | null | undefined} x @param {string} what @returns {T} */
const must = (x, what) => {
  if (x === null || x === undefined) throw new TypeError(`no ${what}`);
  return x;
};
/** A text `assert.match` reads: a `TypeError` where it is none, as `assert.match` throws for a value that is not text.
 *  @param {string | null | undefined} x @returns {string} */
const str = (x) => {
  if (typeof x !== "string") throw new TypeError(`not text: ${String(x)}`);
  return x;
};
/** A list of whatever an event's detail holds. @typedef {ReadonlyArray<unknown>} DetailList */
/** Whether a value is a list (`Array.isArray`). @param {unknown} x @returns {x is DetailList} */
const isList = (x) => Array.isArray(x);
/* An event's detail follows its head (site-profiles states only the head, `EventHead`): each member this test reads, as
   the event holds it, or undefined where it holds none. */
/** @param {EventHead} e @returns {unknown} */
const keyOf = (e) => ("key" in e ? e.key : undefined);
/** @param {EventHead} e @returns {unknown} */
const wasOf = (e) => ("was" in e ? e.was : undefined);
/** @param {EventHead} e @returns {unknown} */
const nowOf = (e) => ("now" in e ? e.now : undefined);
/** An event's section path, joined with `sep`; a `TypeError` where it has none, as joining a missing path would have.
 *  @param {EventHead} e @param {string} sep @returns {string} */
const sectionOf = (e, sep) => {
  const s = "section" in e ? e.section : undefined;
  if (!isList(s)) throw new TypeError("an event with no section");
  return s.join(sep);
};
/** Whether an event's moved list names `what`; a `TypeError` where it has none, as reading a missing list would have.
 *  @param {EventHead} e @param {string} what @returns {boolean} */
const movedHas = (e, what) => {
  const m = "moved" in e ? e.moved : undefined;
  if (!isList(m)) throw new TypeError("an event with no moved list");
  return m.includes(what);
};
/** A passage's section path, joined with `sep`; a `TypeError` where it has none, as joining a missing path would have.
 *  @param {{ readonly section: ReadonlyArray<string> | null }} x @param {string} sep @returns {string} */
const pathOf = (x, sep) => must(x.section, "section").join(sep);
/** A field's `measured`, where the field's kind carries one. @param {object} v @returns {unknown} */
const measuredOf = (v) => ("measured" in v ? v.measured : undefined);
/** A reading's header, which the test has made sure was read. @param {PolicyReading} p @returns {PolicyHeaderReading} */
const headerOf = (p) => must(p.header, "header");

/* A registry holding every type, in R1's order (read.mjs's `registryOf`: `makeRegistry()`, each type registered). */
const REG = registryOf(DOCTYPES);
/** @param {string} text @param {View} [view] @param {DoctypeContext} [extra] @returns {PolicyReading} */
const parse = (text, view = PE, extra = {}) => policy.parse({ text, view, ...extra });
/** @param {string} text @param {{ readonly start: number, readonly end: number }} s @returns {string} */
const at = (text, s) => text.slice(s.start, s.end).replace(/\s+/g, " ").trim();
/** @param {string} text @param {string} line @returns {string} */
const without = (text, line) => text.split("\n").filter((l) => !l.startsWith(line)).join("\n");

/* -------------------------------------------------------------------- R1, R25 */

test("R1 R25 policy is registered after regulation, matches CERTAIN only on a header naming a series with its number, and is SUBSTANCE", () => {
  const order = DOCTYPES.map((t) => t.key);
  assert.equal(order.indexOf("policy"), order.indexOf("regulation") + 1);
  assert.equal(DOCTYPES.find((t) => t.key === "policy"), policy, "the type registered is the type tested here");
  assert.equal(policy.contract, CONTRACT.SUBSTANCE);
  const d = policy.detect({ text: PE_POLICY, view: PE });
  assert.equal(d.match, true);
  assert.equal(d.confidence, CONFIDENCE.CERTAIN);
  // the series' label with no number the series reads: never CERTAIN
  const noNumber = without(PE_POLICY, "Order No.");
  assert.notEqual(policy.detect({ text: noNumber, view: PE }).confidence, CONFIDENCE.CERTAIN);
  assert.match(str(policy.detect({ text: noNumber, view: PE }).why), /no number/);
  const badNumber = PE_POLICY.replace("Order No. 07/24", "Order No. 7-24");
  assert.notEqual(policy.detect({ text: badNumber, view: PE }).confidence, CONFIDENCE.CERTAIN);
  // a citation of a policy in prose is not a header
  const prose = "The Harbour Office explained that Harbour Standing Order 07/24 governs mooring, and the committee noted it.";
  assert.equal(policy.detect({ text: prose, view: PE }).match, false);
  // no series or no labels in the view: never CERTAIN, and it says the profiles supply none (R24)
  for (const v of [EMPTY, { ...PE, vocabulary: { ...PE.vocabulary, policy_headers: [] } }, { ...PE, standard_sources: [] }]) {
    const r = policy.detect({ text: PE_POLICY, view: v });
    assert.equal(r.confidence, CONFIDENCE.NONE);
    assert.equal(r.why, localize("doctypes.policy.no_series_supplied", "the active jurisdiction profiles supply no policy series or no policy header labels, so no document is read as a policy"));
  }
  // a standard's designation opening a line is never the series a header names (K1933): the test profile's MHSI standard
  const standard = PE_POLICY.replace("HARBOUR STANDING ORDER\nOrder No. 07/24", "MHSI Standard 101\nOrder No. 07/24");
  assert.equal(policy.detect({ text: standard, view: PE }).confidence, CONFIDENCE.NONE);
  const asPolicy = { ...PE, standard_sources: must(PE.standard_sources, "standard sources").map((x) => (x.kind === "standard" ? { ...x, kind: "policy" } : x)) };
  assert.equal(policy.detect({ text: standard, view: asPolicy }).confidence, CONFIDENCE.CERTAIN, "the same line, were it a policy series");
  // through the registry
  assert.equal(must(readWith(REG, PE_POLICY, { view: PE }).doctype.type, "type").key, "policy");
});

/* ------------------------------------------------------------------------ R26 */

test("R26 the header block: each field by the view's labels, as written, with its extent; type with its series, number with its normal", () => {
  const p = parse(PE_POLICY);
  const h = headerOf(p);
  assert.equal(must(h.type, "type").key, "harbour-master.hso");
  assert.equal(must(h.type, "type").series, "hso");
  assert.equal(must(h.number, "number").text, "07/24");
  assert.equal(must(h.number, "number").normal, "HSO-7/24", "the series' normal over the number's groups (jurisdictions R63)");
  /** @type {ReadonlyArray<readonly [PolicyHeaderField, string]>} */
  const want = [["title", "Mooring in the Inner Basin"], ["supersedes", "HSO 4/19"], ["reference", "Harbour Act s. 12"],
                ["coordinator", "Deputy Harbour Master"], ["revision_cycle", "1 year"]];
  for (const [f, t] of want) {
    const v = h[f];
    if (v === undefined) throw new TypeError(`no ${f}`);
    assert.equal(v.text, t, f);
    assert.equal(at(PE_POLICY, v), t, `${f}'s extent is its text`);
  }
  assert.equal(must(h.effective, "effective").text, "3 March 2025");
  assert.equal(must(h.effective, "effective").date, "2025-03-03");
  assert.equal(at(PE_POLICY, must(h.effective, "effective")), "3 March 2025");
  // a placeholder is kept as written, never completed or guessed
  assert.equal(must(h.review_due, "review_due").text, "XX March 26");
  assert.equal(must(h.review_due, "review_due").date, null);
  assert.match(str(must(h.review_due, "review_due").why), /placeholder/);
  assert.deepEqual(h.missing, []);
  // a field not read is absent and named in missing, with why
  const p2 = parse(without(PE_POLICY, "Authority:"));
  assert.equal(headerOf(p2).reference, undefined);
  assert.ok(headerOf(p2).missing.includes("reference"));
  assert.match(str(headerOf(p2).missing_why.reference), /no label/);
  // labels come from the view, never from code: the same header under the first profile's labels reads no field
  const held = policy.parse({ text: PE_POLICY, view: HELD });
  const heldHeader = held.header;
  assert.ok(!heldHeader || heldHeader.title === undefined);
  // two-digit years, other date shapes, and an impossible date
  /** @param {string} d */
  const dated = (d) => headerOf(parse(PE_POLICY.replace("3 March 2025", d))).effective;
  assert.equal(must(dated("14 AUG 24"), "effective").date, "2024-08-14");
  assert.equal(must(dated("18 Sep 81"), "effective").date, "1981-09-18");
  assert.equal(must(dated("March 9, 2020"), "effective").date, "2020-03-09");
  assert.equal(must(dated("10/13/2017"), "effective").date, "2017-10-13");
  assert.equal(dated("31 Feb 2020"), undefined, "no whole calendar date, nothing completed");
  // where it is: R7's source, from ctx.locate, for the offset read
  const flat = flattenText(PE_POLICY);
  const locate = makeLocator(flat.segments);
  const located = policy.parse({ text: flat.text, view: PE, locate });
  assert.deepEqual(must(headerOf(located).title, "title").source, locate(must(headerOf(located).title, "title").start));
  assert.equal(must(headerOf(parse(PE_POLICY)).title, "title").source, null, "no locator, no composed source");
});

/* ------------------------------------------------------------------- R27, R33 */

test("R27 R33 sections: outline headings in document order with paths and extents, or none and why", () => {
  const p = parse(PE_POLICY);
  assert.deepEqual(p.sections.map((s) => s.number), ["I", "II", "III", "III.A", "III.B", "IV", "V", "V.A"]);
  assert.deepEqual(must(p.sections.find((s) => s.number === "III.B"), "III.B").path, ["III", "B"]);
  for (const s of p.sections) {
    assert.ok(s.end > s.start, s.number);
    assert.equal(must(PE_POLICY.slice(s.start).split("\n")[0], "line").startsWith(s.number.split(".").pop() + "."), true, s.number);
  }
  const iii = must(p.sections.find((s) => s.number === "III"), "III");
  assert.equal(iii.end, must(p.sections.find((s) => s.number === "IV"), "IV").start, "a section runs to the next at its level");
  assert.equal(p.sections_why, null);
  assert.equal(p.counts.sections, p.sections.length);
  // a line of prose opening with a number is not a section; a numbered list is one level
  const prose = PE_POLICY.replace("I. PURPOSE\n", "I. PURPOSE\n3. vessels were counted in 2024.\n");
  assert.ok(!parse(prose).sections.some((s) => s.number === "I.3"));
  // no heading: no sections, and why
  const flat = parse(PE_POLICY.split("Page 1 of 2")[0] + "Page 1 of 2\nThis order has no parts.");
  assert.deepEqual(flat.sections, []);
  assert.match(str(flat.sections_why), /no outline heading/);
});

/* ------------------------------------------------------------------- R28, R33 */

test("R28 R33 definitions: the entries of a section headed as definitions and the definitional voice, a term given twice twice", () => {
  const p = parse(PE_POLICY);
  assert.deepEqual(p.definitions.map((d) => [d.term, pathOf(d, ".")]), [["Inner Basin", "III.A"], ["Master", "III.B"]]);
  for (const d of p.definitions) assert.ok(d.end > d.start);
  const voice = PE_POLICY.replace("V. RECORDS", "\"Berth\" means a place to moor.\n\"Berth\" means also a dock.\nV. RECORDS");
  const v = parse(voice);
  assert.equal(v.definitions.filter((d) => d.term === "Berth").length, 2);
  assert.equal(v.counts.definitions, v.definitions.length);
  // one before any section is listed with section null and why, never dropped
  const early = parse(PE_POLICY.replace("Page 1 of 2\n", "Page 1 of 2\n\"Basin\" means the harbour's water.\n"));
  const u = must(early.definitions.find((d) => d.term === "Basin"), "Basin");
  assert.equal(u.section, null);
  assert.match(str(u.why), /before the first heading/);
  assert.equal(early.counts.definitions_unplaced, 1);
});

/* ------------------------------------------------------------------------ R29 */

test("R29 applicability: a section headed so and the applying voice, each an extent, never resolved to an office or a person", () => {
  const p = parse(PE_POLICY);
  assert.equal(p.applicability.length, 1);
  const a = must(p.applicability[0], "applicability");
  assert.deepEqual(a.section, ["II"]);
  assert.match(at(PE_POLICY, a), /^II\. APPLICABILITY This order applies to all vessels over 12 metres/);
  assert.deepEqual(Object.keys(a).sort(), ["end", "section", "source", "start"]);
  const voice = parse(PE_POLICY.replace("This order sets out", "This order applies to pilots and tug crews. It sets out"));
  const s = must(voice.applicability.find((x) => pathOf(x, ",") === "I"), "applicability of I");
  assert.equal(at(PE_POLICY.replace("This order sets out", "This order applies to pilots and tug crews. It sets out"), s),
    "This order applies to pilots and tug crews.");
});

/* ------------------------------------------------------------------------ R30 */

test("R30 responsibilities: each row of a responsible-party and action table in order; a table that cannot be told apart is unread", () => {
  const p = parse(PE_POLICY);
  assert.deepEqual(p.responsibilities.map((r) => [r.party, r.step, r.action]), [
    ["Master", "1", "Request a berth no later than 24 hours before arrival."],
    ["Master", "2", "Report any damage within three (3) business days."],
    ["Harbour Office", "1", "Confirm the berth."],
    ["Harbour Office", "2", "Inspect moorings annually."],
  ]);
  for (const r of p.responsibilities) assert.deepEqual(r.section, ["IV"]);
  assert.deepEqual(p.responsibilities_unread, []);
  // a party printed above its first action, over two lines
  const above = parse(PE_POLICY.replace("Harbour Office 1. Confirm the berth.", "Harbour Office and\nDeputy Master\n1. Confirm the berth."));
  assert.equal(must(above.responsibilities[2], "responsibility").party, "Harbour Office and Deputy Master");
  // an action that does not end before the next party's numbering: never split by guess
  const blurred = parse(PE_POLICY.replace("within three (3) business days.", "within three (3) business days and").replace(
    "Harbour Office 1. Confirm the berth.", "Harbour Office\n1. Confirm the berth."));
  assert.equal(blurred.responsibilities.length, 0);
  assert.equal(blurred.responsibilities_unread.length, 1);
  assert.match(must(blurred.responsibilities_unread[0], "unread table").why, /can(not)? be told/);
  assert.equal(blurred.counts.responsibilities_unread, 1);
});

/* ------------------------------------------------------------------------ R31 */

test("R31 timeframes: each period or limit, amount and units only where stated plainly, and never a deadline", () => {
  const p = parse(PE_POLICY);
  assert.deepEqual(p.timeframes.map((t) => [t.text, t.amount, t.units, pathOf(t, ".")]), [
    ["no later than 24 hours", 24, "hours", "IV"],
    ["within three (3) business days", 3, "business_days", "IV"],
    ["annually", undefined, undefined, "IV"],
    ["two years", 2, "years", "V.A"],
  ]);
  for (const t of p.timeframes) {
    assert.ok(!("deadline" in t) && !("due" in t) && !("counted" in t), "a reading, never a deadline");
    assert.equal(at(PE_POLICY, t), t.text);
  }
});

/* ------------------------------------------------------------------------ R32 */

test("R32 the readings are never force: no provision is labelled required, recommended, allowed or discretionary", () => {
  const p = parse(PE_POLICY.replace("Confirm the berth.", "Confirm the berth, which it shall do and may refuse at its discretion."));
  /** @type {Set<string>} */
  const keys = new Set();
  /** Whether a value is an object (a list among them), whose members the walk lists.
   *  @param {unknown} x @returns {x is { readonly [k: string]: unknown }} */
  const isObject = (x) => typeof x === "object" && x !== null;
  /** @param {unknown} x @returns {void} */
  const walk = (x) => { if (isObject(x)) for (const [k, v] of Object.entries(x)) { keys.add(k); walk(v); } };
  walk(p);
  for (const k of ["force", "required", "recommended", "allowed", "discretionary", "discretion", "holder", "criteria",
                   "standard", "duty", "defines", "relation"]) assert.ok(!keys.has(k), k);
});

/* ------------------------------------------------------------------------ R34 */

test("R34 assess: a header field or a section that moved, or one read on one side only, each instrument_changed naming it", () => {
  const a = parse(PE_POLICY);
  /* `assess` reads no context; its stated type takes one, so an empty one is handed. */
  const same = policy.assess(a, parse(PE_POLICY), {});
  assert.deepEqual(same.events, []);
  assert.equal(same.meaningful, false);
  const b = parse(PE_POLICY.replace("In force from: 3 March 2025", "In force from: 4 March 2025")
    .replace("Request a berth no later than 24 hours", "Request a berth no later than 48 hours")
    .replace("V. RECORDS\nA. The Harbour Office keeps each request for two years.", ""));
  const r = policy.assess(a, b, {});
  assert.ok(r.events.length && r.events.every((e) => e.type === "instrument_changed"));
  /** @param {string} k @returns {EventHead[]} */
  const by = (k) => r.events.filter((e) => keyOf(e) === k);
  assert.equal(wasOf(must(by("header.effective")[0], "event")), "2025-03-03");
  assert.equal(nowOf(must(by("header.effective")[0], "event")), "2025-03-04");
  const iv = must(by("section").find((e) => sectionOf(e, ",") === "IV"), "event of IV");
  assert.ok(movedHas(iv, "text") && movedHas(iv, "responsibilities") && movedHas(iv, "timeframes"));
  assert.ok(by("section").some((e) => sectionOf(e, ",") === "V" && nowOf(e) === null), "a section read on one side only");
  assert.equal(r.meaningful, true);
  // nothing read on either side: nothing claimed, and why
  const none = parse("a letter about nothing", PE);
  const r2 = policy.assess(none, none, {});
  assert.equal(r2.meaningful, null);
  assert.deepEqual(r2.events, []);
  assert.equal(r2.header_why, localize("doctypes.policy.header_neither", "neither reading gave a header, so nothing is said about the header"));
  assert.equal(r2.sections_why, localize("doctypes.policy.sections_neither", "neither reading gave sections, so nothing is said about sections: {why}", { why: must(none.sections_why, "why") }));
});

/* ------------------------------------------------------------------- R35, R3 */

test("R35 measured on the 50 captured policies under the held first profile: the header block read wholly right for at least 90%, each field as recorded", () => {
  assert.equal(POLICIES.documents.length, 50);
  /** @type {{ [family: string]: number }} */
  const families = {};
  for (const d of POLICIES.documents) {
    families[d.family] = (families[d.family] || 0) + 1;
    assert.match(d.source, /^https:\/\//);
    assert.match(d.sha256, /^[0-9a-f]{64}$/);
    assert.ok([1, 2, 3].includes(d.tier), d.id);
  }
  assert.deepEqual(families, { so: 10, ai: 6, dgo: 34 });
  let whole = 0;
  /** @type {{ [field: string]: [number, number] }} */
  const per = {};
  for (const d of POLICIES.documents) {
    const p = policy.parse({ text: d.text.document, view: HELD });
    const s = score(p.header, must(ANSWERS[d.id], `answer to ${d.id}`));
    if (s.ok) whole++;
    for (const [f, x] of Object.entries(s.fields)) { const pf = per[f] ?? (per[f] = [0, 0]); pf[1]++; if (x.ok) pf[0]++; }
  }
  assert.ok(whole >= 45, `${whole} of 50 headers read wholly right; the target is 45 (90%)`);
  assert.equal(whole, 46, "the measurement recorded in the job record (K1924, K1933)");
  assert.deepEqual(per, { type: [48, 50], number: [49, 50], title: [49, 50], effective: [47, 49], supersedes: [6, 6],
                          reference: [18, 18], coordinator: [16, 17], review_due: [8, 9], revision_cycle: [8, 9] });
});

test("R35 R27 section boundaries on the 50, against a member's reading of each one's top-level sections", () => {
  let right = 0;
  for (const d of POLICIES.documents) {
    const p = policy.parse({ text: d.text.document, view: HELD });
    if (scoreSections(p.sections, must(SECTION_ANSWERS[d.id], `sections of ${d.id}`)).ok) right++;
  }
  assert.equal(right, 45, "the measurement recorded in the job record");
});

/* R35's out-of-sample measure as taken on 2026-10-07 (T36-4), before the four causes it found were fixed (K2079): the
   reader then read 20 of the 24 headers wholly right. Recorded in the job record `build/jobs/T36/doctypes.md`; it stays
   the measure. */
/** @type {{ date: string, whole: number, of: number, fields: { [field: string]: [number, number] } }} */
const FRESH_MEASURE = { date: "2026-10-07", whole: 20, of: 24,
  fields: { type: [24, 24], number: [24, 24], title: [22, 24], effective: [24, 24], supersedes: [1, 1], reference: [11, 11],
            coordinator: [9, 11], review_due: [4, 6], revision_cycle: [4, 5] } };
/** @returns {{ whole: number, per: { [field: string]: [number, number] } }} */
const readFresh = () => {
  let whole = 0;
  /** @type {{ [field: string]: [number, number] }} */
  const per = {};
  for (const d of FRESH.documents) {
    const s = score(policy.parse({ text: d.text.document, view: HELD }).header, must(FRESH_ANSWERS[d.id], `answer to ${d.id}`));
    if (s.ok) whole++;
    for (const [f, x] of Object.entries(s.fields)) { const pf = per[f] ?? (per[f] = [0, 0]); pf[1]++; if (x.ok) pf[0]++; }
  }
  return { whole, per };
};

test("R35 measured out of sample: 24 fresh policies of the same issuers and series, none among the 50, per header field under the held first profile", () => {
  assert.ok(FRESH.documents.length >= 20);
  const shas = new Set(POLICIES.documents.map((d) => d.sha256)), ids = new Set(POLICIES.documents.map((d) => d.id));
  const families = new Set(POLICIES.documents.map((d) => d.family));
  for (const d of FRESH.documents) {
    assert.ok(!shas.has(d.sha256) && !ids.has(d.id), `${d.id} is among the 50`);
    assert.ok(families.has(d.family), `${d.id}: a series the 50 measured`);
    assert.match(d.source, /^https:\/\//);
    assert.match(d.sha256, /^[0-9a-f]{64}$/);
    assert.ok([1, 2, 3].includes(d.tier), d.id);
    assert.ok(FRESH_ANSWERS[d.id], `a member's reading of ${d.id}`);
    assert.equal(policy.detect({ text: d.text.document, view: HELD }).confidence, CONFIDENCE.CERTAIN, d.id);
    assert.equal(must(readWith(REG, d.text, { view: HELD }).doctype.type, "type").key, "policy", `${d.id} through the registry`);
  }
  /* The recorded measure: its counts are the 24's, and the fields under 90% are named (R35). */
  assert.equal(FRESH_MEASURE.of, FRESH.documents.length);
  /** @type {{ [field: string]: number }} */
  const printed = {};
  for (const a of Object.values(FRESH_ANSWERS)) for (const f of Object.keys(a)) printed[f] = (printed[f] || 0) + 1;
  for (const [f, [, n]] of Object.entries(FRESH_MEASURE.fields)) assert.equal(n, printed[f], f);
  const below = Object.entries(FRESH_MEASURE.fields).filter(([, [ok, n]]) => ok / n < 0.9).map(([f]) => f);
  assert.deepEqual(below, ["coordinator", "review_due", "revision_cycle"]);
  /* The reader today reads each field at least as the measure recorded (after K2079's fixes: in sample, all 24). */
  const now = readFresh();
  assert.ok(now.whole >= FRESH_MEASURE.whole);
  for (const [f, [ok]] of Object.entries(FRESH_MEASURE.fields)) assert.ok(must(now.per[f], f)[0] >= ok, f);
  assert.equal(now.whole, 24, "in sample, after the fixes: the figure recorded in the job record");
});

test("R26 the fields below R35's target carry measured below_target, under any profile; the others do not", () => {
  /** @type {ReadonlyArray<PolicyHeaderField>} */
  const below = ["coordinator", "review_due", "revision_cycle"];
  /** @type {ReadonlyArray<PolicyHeaderField>} */
  const others = ["type", "number", "title", "effective"];
  /** @type {ReadonlyArray<readonly [string, View]>} */
  const read = [[PE_POLICY, PE], [must(FRESH.documents.find((d) => d.id === "37"), "37").text.document, HELD]];
  for (const [text, view] of read) {
    /** @type {HeaderFields} */
    const h = headerOf(policy.parse({ text, view }));
    for (const f of below) { const v = h[f]; if (v === undefined) throw new TypeError(`no ${f}`); assert.equal(measuredOf(v), "below_target", f); }
    for (const f of others) { const v = h[f]; if (v === undefined) throw new TypeError(`no ${f}`); assert.equal(measuredOf(v), undefined, f); }
  }
});

/** @param {string} id */
const freshHeader = (id) => {
  const d = must(FRESH.documents.find((x) => x.id === id), id);
  return { d, h: policy.parse({ text: d.text.document, view: HELD }).header };
};

test("R26 a revision memorandum's running header naming the order does not anchor the header: the order's own block is read (DGO D-4)", () => {
  const { d, h } = freshHeader("96");
  for (const [f, x] of Object.entries(score(h, must(FRESH_ANSWERS["96"], "answer to 96")).fields)) assert.ok(x.ok, `${f}: ${x.got}`);
  const running = d.text.document.indexOf("DEPARTMENTAL GENERAL ORDER D-4 Effective Date:");
  assert.ok(running > 0 && must(must(h, "header").type, "type").start > running, "the series anchored is the order's own, after the memorandum's running header");
  /* the same order anchored twice with the same fields (a header printed before and after its contents): the first */
  const { d: d2, h: h2 } = freshHeader("200");
  assert.ok(must(h2, "header").start < d2.text.document.indexOf("TABLE OF CONTENT"));
});

test("R26 a placeholder date in any blank form ('DD MMM YY') is kept as written with date null and why, never dropped (DGO B-01)", () => {
  const h = must(freshHeader("23").h, "header");
  assert.equal(must(h.review_due, "review_due").text, "DD MMM YY");
  assert.equal(must(h.review_due, "review_due").date, null);
  assert.match(str(must(h.review_due, "review_due").why), /placeholder/);
  assert.ok(!h.missing.includes("review_due"));
});

test("R26 a field's value stops at its line where the order's name follows in capitals, never running into the body (DGO K-6)", () => {
  const { d, h } = freshHeader("419");
  const coordinator = must(must(h, "header").coordinator, "coordinator");
  assert.equal(coordinator.text, "Patrol Rifle Program Instructor Staff");
  assert.equal(d.text.document.slice(coordinator.start, coordinator.end), "Patrol Rifle Program Instructor Staff");
});

test("R26 the title is read from the header block, never from a contents page's heading (DGO H-10)", () => {
  const title = must(must(freshHeader("200").h, "header").title, "title");
  assert.ok(same(title.text, "Property Clearance and Disposal"), title.text);
  assert.doesNotMatch(title.text, /contents?/i);
});

test("R3 R20 policy takes its series and labels from ctx.view, and with no view from every non-test held profile", () => {
  const k03 = must(POLICIES.documents.find((d) => d.id === "415"), "415");
  const viewless = policy.detect({ text: k03.text.document });
  const held = policy.detect({ text: k03.text.document, view: HELD });
  assert.deepEqual(viewless, held);
  assert.equal(held.confidence, CONFIDENCE.CERTAIN);
  assert.equal(policy.detect({ text: k03.text.document, view: PE }).confidence, CONFIDENCE.NONE,
    "the first profile's series are not recognised under a view that does not supply them");
  assert.equal(policy.detect({ text: PE_POLICY, view: PE }).confidence, CONFIDENCE.CERTAIN, "read under a profile that is not the first");
});

/* ------------------------------------------------------------------------ R36 */

test("R36 adding policy changes no other type's verdict: no existing fixture is read as a policy", () => {
  for (const c of CASES) {
    const r = readWith(REG, c.supplied, c.ctx);
    assert.notEqual(must(r.doctype.type, "type").key, "policy", c.id);
    assert.notEqual(policy.detect({ ...c.ctx, text: r.text }).confidence, CONFIDENCE.CERTAIN, c.id);
  }
});
