/* The contradiction inquiry (N345): the frozen vocabularies and the lines a resolution is written as (R46), the grammar's
   arm judged at every promotion of an inquiry (R47, R11, rows C-2.11–C-2.16), one candidate to one inquiry (R11, C-2.17),
   the link's projection and its reads (R12, R48), its table (R36) and its rows (R38). Driven through the real
   `promotion.promote`, which every door that writes an inquiry goes through. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, inquiryMd, V } from "./fixture.mjs";
import { contradictionFindings } from "../../../src/inquiry/contradiction.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { CONTRADICTION_COORDINATES, PLURALITY_DIFFERENCES, DISSOLVED_BY, NORM_CANONS, RESOLUTION_KINDS, resolutionFamily,
         resolutionLines, INQUIRY_CONTRADICTION_CHECKS, INQUIRY_TABLES, QUALIFIER_MAX, HYPOTHESIS_MAX }
  from "../../../src/inquiry/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const A = "INFO-2026-0001-a", B = "INFO-2026-0002-b";
const CAND = "a".repeat(64), CAND2 = "b".repeat(64);
const Q = "INQ-2026-0001-q";
const link = (c = CAND) => ["contradiction:", `  candidate: ${c}`];
/* a concluded document as `basis-versions`' conclude leaves it (the fields C-2.8 asks for), without a resolution */
const concluded = ['conclusion: "they differ in scope"', 'falsifier: "a document naming one scope for both"'];
const doc = (extra, opts = {}) => inquiryMd(Q, { legs: [{ target: A }, { target: B, role: "cuts_against" }], extra, ...opts });
function setup() { const w = world(); w.doc(A); w.doc(B); return w; }
const codes = (r) => (r.findings || []).map((f) => f.code);

test("R46 the frozen vocabularies, and each kind's family, null for anything else", () => {
  assert.deepEqual([...CONTRADICTION_COORDINATES], ["time_or_occasion", "scope", "meaning", "observer_or_method", "subject"]);
  assert.deepEqual([...PLURALITY_DIFFERENCES], ["scope", "time_or_occasion", "standard", "evidence_set", "weighing"]);
  assert.deepEqual([...DISSOLVED_BY].sort(), [...new Set([...CONTRADICTION_COORDINATES, ...PLURALITY_DIFFERENCES, "precision", "opinion"])].sort());
  assert.equal(DISSOLVED_BY.length, new Set(DISSOLVED_BY).size, "a union, each once");
  assert.deepEqual([...NORM_CANONS], ["higher_over_lower", "later_over_earlier", "specific_over_general", "harmonization", "unreconciled"]);
  const families = { dissolved: "DISSOLVED", misquote: "CORRECTED", transcription_or_reading_error: "CORRECTED",
    superseded_version: "CORRECTED", corrected: "CORRECTED", double_speak_or_reversal: "GENUINE",
    obligation_against_act: "GENUINE", conflict_of_norms: "GENUINE", irreconcilable: "GENUINE" };
  assert.deepEqual([...RESOLUTION_KINDS], Object.keys(families));
  for (const [k, f] of Object.entries(families)) assert.equal(resolutionFamily(k), f, k);
  for (const x of ["", "Dissolved", "genuine", null, undefined, 7, {}, "toString", "__proto__"]) assert.equal(resolutionFamily(x), null, String(x));
  for (const list of [CONTRADICTION_COORDINATES, PLURALITY_DIFFERENCES, DISSOLVED_BY, NORM_CANONS, RESOLUTION_KINDS]) {
    assert.ok(Object.isFrozen(list));
    assert.throws(() => { "use strict"; list.push("x"); });
  }
});

test("R46 resolutionLines: the resolution's lines in one fixed order, frontmatter-safe and idempotent, a blank field left out; never throws", () => {
  const r = { canon: "harmonization", reason: 'he said "no"\\\nthen yes ', wrong_side: "a", qualifiers: { b: "  in 2025 ", a: "in 2024" },
              coordinates: ["scope", "time_or_occasion"], kind: "dissolved" };
  const lines = resolutionLines(r);
  assert.deepEqual(lines, ["resolution:", '  kind: "dissolved"', "  coordinates: [scope, time_or_occasion]",
    '  qualifier_a: "in 2024"', '  qualifier_b: "in 2025"', '  wrong_side: "a"', `  reason: "he said 'no'' then yes"`,
    '  canon: "harmonization"']);
  /* the lines parse under the restricted grammar with no finding, and read back as written */
  const md = ["---", "id: x", ...lines, "---", ""].join("\n");
  const p = parseFrontmatter(md);
  assert.deepEqual(p.findings, []);
  assert.deepEqual(p.data.resolution, { kind: "dissolved", coordinates: ["scope", "time_or_occasion"], qualifier_a: "in 2024",
    qualifier_b: "in 2025", wrong_side: "a", reason: "he said 'no'' then yes", canon: "harmonization" });
  /* idempotent: writing what was read writes the same lines */
  const again = resolutionLines({ ...p.data.resolution, qualifiers: { a: p.data.resolution.qualifier_a, b: p.data.resolution.qualifier_b } });
  assert.deepEqual(again, lines);
  assert.deepEqual(resolutionLines({ kind: "irreconcilable", reason: "   ", canon: "", qualifiers: { a: "" }, coordinates: [] }),
    ["resolution:", '  kind: "irreconcilable"'], "blank fields are left out");
  assert.deepEqual(resolutionLines({ kind: "dissolved", coordinates: ["sc,o]pe", "[x"] }),
    ["resolution:", '  kind: "dissolved"', "  coordinates: [sc o pe, x]"], "a list item carries no list punctuation");
  for (const bad of [null, undefined, "dissolved", 7, [], {}]) assert.deepEqual(resolutionLines(bad), [], JSON.stringify(bad));
  const hostile = { get kind() { throw new Error("boom"); } };
  assert.deepEqual(resolutionLines(hostile), []);
});

test("R47 R11 the link: `contradiction: {candidate}` with a candidate id, anything else CONTRADICTION_LINK_MALFORMED (C-2.11)", () => {
  const w = setup();
  assert.equal(w.promote(Q, doc(link())).ok, true, "a well-formed link");
  for (const bad of [["contradiction:", "  candidate: abc"], ["contradiction:", `  candidate: ${"A".repeat(64)}`],
                     ["contradiction:", `  candidate: ${CAND}`, "  other: x"], ['contradiction: "x"'], ["contradiction: []"]]) {
    const r = w.promote("INQ-2026-0002-r", inquiryMd("INQ-2026-0002-r", { extra: bad }));
    assert.equal(r.ok, false, bad.join("|")); assert.equal(r.reason, "BASIS_REFUSED");
    const f = r.findings.find((x) => x.code === "CONTRADICTION_LINK_MALFORMED");
    assert.ok(f, JSON.stringify(r).slice(0, 300));
    assert.equal(f.check, "C-2.11"); assert.equal(f.translation, INQUIRY_CONTRADICTION_CHECKS.CONTRADICTION_LINK_MALFORMED.translation);
    assert.equal(w.record.head("INQ-2026-0002-r"), null, "nothing written");
  }
  /* negative control: a plain inquiry carries no link and no finding */
  assert.equal(w.promote("INQ-2026-0003-s", inquiryMd("INQ-2026-0003-s")).ok, true);
});

test("R47 R11 a resolution on a document that is not a contradiction inquiry is RESOLUTION_WITHOUT_CONTRADICTION (C-2.12), at any state", () => {
  const w = setup();
  for (const state of ["open", "concluded"]) {
    const r = w.promote(Q, doc([...resolutionLines({ kind: "irreconcilable" }), ...(state === "concluded" ? concluded : [])], { state }));
    assert.deepEqual([r.ok, r.reason], [false, "BASIS_REFUSED"], state);
    assert.deepEqual(codes(r), ["RESOLUTION_WITHOUT_CONTRADICTION"]); assert.equal(r.findings[0].check, "C-2.12");
  }
  assert.equal(w.promote(Q, doc([...link(), ...resolutionLines({ kind: "irreconcilable" })])).ok, true,
    "negative control: a contradiction inquiry may carry one");
});

test("R47 R11 concluding: no resolution is RESOLUTION_MISSING (C-2.13), through any door; an unknown kind RESOLUTION_KIND_UNKNOWN (C-2.14)", () => {
  const w = setup();
  assert.equal(w.promote(Q, doc(link())).ok, true);
  /* "another door": a conclusion written without a resolution, as basis-versions' conclude writes one, is refused at the
     promotion that every door goes through */
  const miss = w.promote(Q, doc([...link(), ...concluded], { state: "concluded", prior: "open" }));
  assert.deepEqual([miss.ok, miss.reason, codes(miss)], [false, "BASIS_REFUSED", ["RESOLUTION_MISSING"]]);
  assert.equal(miss.findings[0].check, "C-2.13"); assert.equal(miss.findings[0].field, "kind");
  assert.equal(w.fm(Q).current_state, "open", "nothing written");
  for (const r of [['resolution: ""'], ["resolution:", '  reason: "no kind"']]) {
    assert.deepEqual(codes(w.promote(Q, doc([...link(), ...concluded, ...r], { state: "concluded" }))), ["RESOLUTION_MISSING"], r.join("|"));
  }
  const unk = w.promote(Q, doc([...link(), ...concluded, ...resolutionLines({ kind: "vanished" })], { state: "concluded" }));
  assert.deepEqual(codes(unk), ["RESOLUTION_KIND_UNKNOWN"]); assert.equal(unk.findings[0].check, "C-2.14");
  const ok = w.promote(Q, doc([...link(), ...concluded, ...resolutionLines({ kind: "irreconcilable" })], { state: "concluded" }));
  assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 400));
});

test("R47 R11 what each kind requires, each missing or ill-formed field RESOLUTION_INCOMPLETE (C-2.15) naming it", () => {
  const w = setup();
  const judge = (res, raw = null) => w.promote(Q, doc([...link(), ...concluded, ...(raw || resolutionLines(res))], { state: "concluded" }));
  const incomplete = (res, fields, raw) => {
    const r = judge(res, raw);
    assert.equal(r.ok, false, JSON.stringify(res || raw));
    assert.ok(r.findings.every((f) => f.code === "RESOLUTION_INCOMPLETE" && f.check === "C-2.15"), JSON.stringify(r.findings));
    assert.deepEqual(r.findings.map((f) => f.field).sort(), [...fields].sort(), JSON.stringify(res || raw));
  };
  const well = (res) => { const r = judge(res); assert.equal(r.ok, true, `${JSON.stringify(res)} ${JSON.stringify(r).slice(0, 300)}`); };
  /* dissolved: one or more distinct coordinates from DISSOLVED_BY */
  incomplete({ kind: "dissolved" }, ["coordinates"]);
  incomplete({ kind: "dissolved", coordinates: ["nowhere"] }, ["coordinates"]);
  incomplete({ kind: "dissolved", coordinates: ["scope", "scope"] }, ["coordinates"]);
  for (const c of DISSOLVED_BY) well({ kind: "dissolved", coordinates: [c] });
  well({ kind: "dissolved", coordinates: ["scope", "precision", "opinion"] });
  /* a CORRECTED kind: wrong_side a or b, and a non-empty reason */
  for (const kind of RESOLUTION_KINDS.filter((k) => resolutionFamily(k) === "CORRECTED")) {
    incomplete({ kind }, ["wrong_side", "reason"]);
    incomplete({ kind, wrong_side: "c", reason: "misread" }, ["wrong_side"]);
    incomplete({ kind, wrong_side: "b" }, ["reason"]);
    well({ kind, wrong_side: "b", reason: "the page was misread" });
  }
  /* conflict_of_norms: a canon from NORM_CANONS */
  incomplete({ kind: "conflict_of_norms" }, ["canon"]);
  incomplete({ kind: "conflict_of_norms", canon: "might_makes_right" }, ["canon"]);
  for (const canon of NORM_CANONS) well({ kind: "conflict_of_norms", canon });
  /* qualifiers, when present, {a?, b?}, each at most 200 characters */
  well({ kind: "irreconcilable", qualifiers: { a: "x".repeat(QUALIFIER_MAX), b: "only in 2025" } });
  incomplete({ kind: "irreconcilable", qualifiers: { a: "x".repeat(QUALIFIER_MAX + 1) } }, ["qualifiers.a"]);
  incomplete(null, ["qualifiers"], ["resolution:", '  kind: "irreconcilable"', '  qualifiers: "a and b"']);
  incomplete(null, ["colour"], ["resolution:", '  kind: "irreconcilable"', '  colour: "red"']);
  /* a resolution written as a single value is not in the form its kind needs: C-2.15, naming `resolution` (N369) */
  incomplete(null, ["resolution"], ['resolution: "irreconcilable"']);
  incomplete(null, ["resolution"], ["resolution: [irreconcilable]"]);
  /* a field another kind needs is still judged when present, never ignored */
  incomplete({ kind: "irreconcilable", canon: "nope" }, ["canon"]);
  for (const kind of ["double_speak_or_reversal", "obligation_against_act", "irreconcilable"]) well({ kind });
});

test("R47 R1 at any other state a resolution is kept and never read, so reopening needs no edit; contradictionLink answers resolution: null", () => {
  const w = setup();
  const res = resolutionLines({ kind: "misquote", wrong_side: "a", reason: "the quote was cut" });
  assert.equal(w.promote(Q, doc([...link(), ...concluded, ...res], { state: "concluded" })).ok, true);
  assert.deepEqual(w.k.contradictionLink(Q), { candidate: CAND, explores: null,
    resolution: { kind: "misquote", wrong_side: "a", reason: "the quote was cut" } });
  /* moved back to open (R1's concluded -> open edge) with the bytes otherwise unchanged: the resolution stays, unread,
     and the read answers null */
  const re = w.promote(Q, w.text(Q).replace("current_state: concluded", "current_state: open")
                                   .replace("prior_state: null", "prior_state: concluded"));
  assert.equal(re.ok, true, JSON.stringify(re).slice(0, 300));
  assert.equal(w.fm(Q).current_state, "open");
  assert.equal(w.fm(Q).resolution.kind, "misquote", "kept");
  assert.deepEqual(w.k.contradictionLink(Q), { candidate: CAND, resolution: null, explores: null });
  /* a malformed resolution at a state where it is not read is not refused */
  assert.equal(w.promote(Q, doc([...link(), ...resolutionLines({ kind: "vanished" })])).ok, true);
  /* concluding again reads it, and the kind is judged */
  assert.deepEqual(codes(w.promote(Q, doc([...link(), ...concluded, ...resolutionLines({ kind: "vanished" })], { state: "concluded" }))),
    ["RESOLUTION_KIND_UNKNOWN"]);
});

test("R47 R11 sub-inquiries: `explores` names exactly one coordinate, canon or hypothesis, anything else EXPLORES_MALFORMED (C-2.16)", () => {
  const w = setup();
  const S = "INQ-2026-0005-e";
  const ex = (lines) => w.promote(S, inquiryMd(S, { extra: ["explores:", ...lines] }));
  for (const c of DISSOLVED_BY) assert.equal(ex([`  coordinate: ${c}`]).ok, true, c);
  for (const c of NORM_CANONS) assert.equal(ex([`  canon: ${c}`]).ok, true, c);
  assert.equal(ex([`  hypothesis: "${"h".repeat(HYPOTHESIS_MAX)}"`]).ok, true);
  for (const bad of [[], ["  coordinate: nowhere"], ["  canon: nope"], ['  hypothesis: ""'], [`  hypothesis: "${"h".repeat(HYPOTHESIS_MAX + 1)}"`],
                     ["  coordinate: scope", "  canon: harmonization"], ["  other: x"]]) {
    const r = ex(bad);
    assert.deepEqual([r.ok, codes(r)], [false, ["EXPLORES_MALFORMED"]], bad.join("|"));
    assert.equal(r.findings[0].check, "C-2.16");
  }
  assert.deepEqual(codes(w.promote(S, inquiryMd(S, { extra: ['explores: "scope"'] }))), ["EXPLORES_MALFORMED"]);
  assert.deepEqual(w.k.contradictionLink(S), { candidate: null, resolution: null, explores: { hypothesis: "h".repeat(HYPOTHESIS_MAX) } },
    "a sub-inquiry's explores is recorded; it names no candidate");
});

test("R47 a replay is exempt from the arm, as from every shape arm (the record's history is holdable verbatim)", () => {
  const w = setup();
  const r = w.promote(Q, doc([...link("xyz"), ...resolutionLines({ kind: "vanished" })], { state: "concluded" }), null, { replay: true });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
});

test("R11 a candidate another inquiry already names is CANDIDATE_ALREADY_TAKEN_UP (C-2.17), naming that inquiry; one candidate, one inquiry", () => {
  const w = setup();
  assert.equal(w.promote(Q, doc(link())).ok, true);
  const R = "INQ-2026-0002-r";
  const second = w.promote(R, inquiryMd(R, { extra: link() }));
  assert.deepEqual([second.ok, second.reason, second.code, second.check, second.inquiry, second.candidate],
    [false, "CANDIDATE_ALREADY_TAKEN_UP", "CANDIDATE_ALREADY_TAKEN_UP", "C-2.17", Q, CAND]);
  assert.equal(second.translation, INQUIRY_CONTRADICTION_CHECKS.CANDIDATE_ALREADY_TAKEN_UP.translation);
  assert.equal(w.record.head(R), null, "nothing written");
  /* negative controls: the holder's own revision, and a different candidate, are admitted */
  assert.equal(w.promote(Q, doc([...link(), ...resolutionLines({ kind: "irreconcilable" })])).ok, true);
  assert.equal(w.promote(R, inquiryMd(R, { extra: link(CAND2) })).ok, true);
  /* a holder that drops its link frees the candidate */
  assert.equal(w.promote(Q, doc([])).ok, true);
  assert.equal(w.k.inquiryOfCandidate(CAND), null);
  assert.equal(w.promote("INQ-2026-0003-s", inquiryMd("INQ-2026-0003-s", { extra: link() })).ok, true);
});

test("R12 R48 the projection records the link, the resolution while concluded, and explores; contradictionLink and inquiryOfCandidate read it", () => {
  const w = setup();
  assert.equal(w.k.contradictionLink(Q), null, "absent");
  assert.equal(w.promote(Q, doc([])).ok, true);
  assert.equal(w.k.contradictionLink(Q), null, "a plain inquiry");
  assert.equal(w.count("inquiry_contradiction_links"), 0, "no row for a plain inquiry");
  assert.equal(w.promote(Q, doc([...link(), "explores:", "  canon: harmonization"])).ok, true);
  assert.deepEqual(w.k.contradictionLink(Q), { candidate: CAND, resolution: null, explores: { canon: "harmonization" } });
  assert.equal(w.k.inquiryOfCandidate(CAND), Q);
  const res = { kind: "dissolved", coordinates: ["scope", "standard"], qualifiers: { a: "in the city's budget", b: "in the county's" } };
  assert.equal(w.promote(Q, doc([...link(), ...concluded, ...resolutionLines(res)], { state: "concluded" })).ok, true);
  assert.deepEqual(w.k.contradictionLink(Q), { candidate: CAND, resolution: res, explores: null },
    "the latest promotion's projection, whole: explores dropped by the revision is dropped here");
  for (const bad of [null, undefined, "", "abc", CAND.toUpperCase(), 7, {}]) assert.equal(w.k.inquiryOfCandidate(bad), null, String(bad));
  assert.equal(w.k.inquiryOfCandidate(CAND2), null);
  for (const bad of [null, "", 7, {}, "INQ-2026-0099-x"]) assert.equal(w.k.contradictionLink(bad), null, String(bad));
  /* neither read throws, even over a store that cannot answer */
  const real = w.st.sql.exec;
  w.st.sql.exec = () => { throw new Error("gone"); };
  assert.equal(w.k.contradictionLink(Q), null); assert.equal(w.k.inquiryOfCandidate(CAND), null);
  w.st.sql.exec = real;
});

test("R36 R48's table is keyed by bundle_id and declared to purge; purging the inquiry clears its link", () => {
  const w = setup();
  assert.ok(INQUIRY_TABLES.includes("inquiry_contradiction_links"));
  const cols = w.rows(`PRAGMA table_info(inquiry_contradiction_links)`);
  assert.deepEqual(cols.filter((c) => c.pk).map((c) => c.name), ["bundle_id"]);
  assert.equal(w.promote(Q, doc(link())).ok, true);
  assert.equal(w.count("inquiry_contradiction_links"), 1);
  w.record.purge({ bundleId: Q });
  assert.equal(w.count("inquiry_contradiction_links"), 0);
  assert.equal(w.k.inquiryOfCandidate(CAND), null);
});

test("R24 R47 a division's children do not carry the parent's contradiction link or its resolution; the parent keeps both", () => {
  const w = setup();
  assert.equal(w.promote(Q, doc([...link(), ...resolutionLines({ kind: "irreconcilable" })])).ok, true);
  const r = w.k.divide({ target: Q, reason: "two questions", viewer: "admin", author: V("alice"),
    children: [{ id: "INQ-2026-0008-a", question: "A?", legs: [0] }, { id: "INQ-2026-0009-b", question: "B?", legs: [1] }] });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
  for (const c of ["INQ-2026-0008-a", "INQ-2026-0009-b"]) {
    assert.equal(w.fm(c).contradiction, undefined); assert.equal(w.fm(c).resolution, undefined);
    assert.equal(w.k.contradictionLink(c), null);
  }
  assert.equal(w.fm(Q).contradiction.candidate, CAND);
  assert.equal(w.k.inquiryOfCandidate(CAND), Q, "the divided parent still holds its candidate");
});

test("R38 C-2.11–C-2.18 are held in this module's own table, each with its code and translation as the requirement words it", () => {
  const T = {
    "C-2.11": ["CONTRADICTION_LINK_MALFORMED", word("refusal.CONTRADICTION_LINK_MALFORMED")],
    "C-2.12": ["RESOLUTION_WITHOUT_CONTRADICTION", word("refusal.RESOLUTION_WITHOUT_CONTRADICTION")],
    "C-2.13": ["RESOLUTION_MISSING", word("refusal.RESOLUTION_MISSING")],
    "C-2.14": ["RESOLUTION_KIND_UNKNOWN", word("refusal.RESOLUTION_KIND_UNKNOWN")],
    "C-2.15": ["RESOLUTION_INCOMPLETE", word("refusal.RESOLUTION_INCOMPLETE")],
    "C-2.16": ["EXPLORES_MALFORMED", word("refusal.EXPLORES_MALFORMED")],
    "C-2.17": ["CANDIDATE_ALREADY_TAKEN_UP", word("refusal.CANDIDATE_ALREADY_TAKEN_UP")],
    "C-2.18": ["CONTRADICTION_ARM_FAILED", word("refusal.CONTRADICTION_ARM_FAILED")],
  };
  const held = Object.entries(INQUIRY_CONTRADICTION_CHECKS).map(([code, r]) => [r.check, code, r.translation]);
  assert.deepEqual(held, Object.entries(T).map(([check, [code, tr]]) => [check, code, tr]));
  for (const r of Object.values(INQUIRY_CONTRADICTION_CHECKS)) assert.match(r.where, /^src\/inquiry\/(contradiction|index)\.mjs \w+ > is-[a-z-]+$/);
});

test("R47 R38 an arm that cannot judge: a check that stops with an error refuses the document under its own row, CONTRADICTION_ARM_FAILED (C-2.18), never as a malformed link (N369, K543)", () => {
  const row = INQUIRY_CONTRADICTION_CHECKS.CONTRADICTION_ARM_FAILED;
  /* a document whose fields cannot be read: every block the arm reads throws */
  for (const key of ["contradiction", "resolution", "explores"]) {
    const fm = { current_state: "open", contradiction: { candidate: CAND } };
    Object.defineProperty(fm, key, { enumerable: true, get() { throw new Error(`no ${key}`); } });
    const f = contradictionFindings(fm);
    assert.equal(f.length, 1, key);
    assert.deepEqual([f[0].check, f[0].code, f[0].translation], [row.check, "CONTRADICTION_ARM_FAILED", row.translation], key);
    assert.match(f[0].detail, new RegExp(`no ${key}`));
    assert.ok(!f.some((x) => x.code === "CONTRADICTION_LINK_MALFORMED"), "C-2.11 is not true of it");
  }
  /* negative controls: a well-formed contradiction inquiry, and a plain one, answer no finding; nothing here throws */
  assert.deepEqual(contradictionFindings({ current_state: "open", contradiction: { candidate: CAND } }), []);
  assert.deepEqual(contradictionFindings({ current_state: "open" }), []);
  for (const x of [null, undefined, 7, "s", []]) assert.deepEqual(contradictionFindings(x), [], String(x));
  assert.equal(row.where, "src/inquiry/contradiction.mjs contradictionFindings > is-contradiction-arm-judged");
});
