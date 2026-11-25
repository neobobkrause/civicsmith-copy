/* inquiry's grammar where it meets the case (LEGACY-TESTS, T18): the inquiry shares of four old suites, converted.
   - publish.test.mjs block 7 (old 1144-1204): C-21.2 per axis, the four probes and the edge cases (no edition, an
     edition never published, a leg authoring its own grade on a published case, the inert ungraded leg, an unrated
     axis) — inquiry R7.
   - multifinding.test.mjs block 4 (old 1050-1089): C-21.2 per FINDING and per axis, two findings frozen differently
     — inquiry R7; and blocks 2b/3 (old 814-833, 1015-1033): a finding's bytes naming case keys, C-2.8 per key — inquiry
     R2 (and R38, C-2.8 as the grammar uses it).
   - caseproduction.test.mjs block 8 (old 1021-1076): the case_project, case_roles and all-eight-keys adversaries —
     inquiry R2's C-2.8 arm, each key named.
   - grounds.test.mjs blocks 3(a) and 4 (old 420-453, 488-559): the grounds gate — inquiry R8: the agent,
     token:member, class:member and TOKEN:member spellings, an undated, doubled, empty or ill-labelled ground, a
     grounds block over no basis, the half-labelled basis and the label with no grounds[] block.
   The old suites drove these through op=promote/op=ratify on the whole plane; here they are driven at inquiry's
   interface: the pure `checkInquiryEntry` / `checkInquiryBasis`, the instance's `checkEntry` and `ground`, and the
   write through `promotion.promote` (the fixture's `w.promote`), where inquiry's check (R11) judges the basis with
   the published registry the test controls (`world({ published })`). What the case gate does with these bytes at
   op=ratify is ratification's and is not asserted here. */
import test from "node:test";
import assert from "node:assert/strict";
import { checkInquiryEntry, checkInquiryBasis } from "../../../src/inquiry/index.mjs";
import { localize } from "../../../src/setup-words/index.mjs";
import { world, inquiryMd, V } from "./fixture.mjs";

const errs = (fn) => { const f = []; fn(f); return f.filter((x) => x.severity === "error"); };
const checksOf = (r) => (r.findings || []).map((f) => f.check).sort();
const detailsOf = (r) => (r.findings || []).map((f) => f.detail).join("\n");

/* ------------------------------------------------------------------ R2: a finding's bytes name no case (CASE-5b) */

const CASE_KEYS = ["case_id", "case_edition", "case_project", "case_scope", "case_findings", "case_roles",
                   "bias_acknowledgement", "required_strength"];
/* One frontmatter spelling per key, as the old adversaries wrote them into a member's bytes. */
const KEY_LINES = {
  case_id: ["case_id: CASE-2026-0001"],
  case_edition: ["case_edition: 1"],
  case_project: ["case_project: PROJ-2026-0001-a"],
  case_scope: ['case_scope: "a scope this member made up"'],
  case_findings: ["case_findings: [INQ-2026-4400-a, INQ-2026-4400-b]"],
  case_roles: ["case_roles:", "  - target: INQ-2026-4400-a", "    role: supporting",
               "  - target: INQ-2026-4400-b", "    role: load_bearing"],
  bias_acknowledgement: ['bias_acknowledgement: "a lens this member made up"'],
  required_strength: ["required_strength:", "  declared: false", "  source: none", "  project: PROJ-2026-0001-a",
                      "  capture: null", "  connection: null", '  detail: "none"'],
};
const F = "INQ-2026-4400-c";
const withKeys = (keys, extraLines = null) =>
  inquiryMd(F, { extra: extraLines ?? keys.flatMap((k) => KEY_LINES[k]) });
/* The C-2.8 findings naming a case, by the key each names. */
const caseKeyFindings = (found) => found.filter((x) => x.check === "C-2.8" && /a finding's bytes name a case/.test(x.message));
const namedKeys = (found) => caseKeyFindings(found).map((x) => /name a case \((\w+)\)/.exec(x.message)?.[1]).sort();

test("R2 R38 a finding's bytes naming the case are refused C-2.8, every key named rather than the first (checkInquiryEntry and checkEntry)", async () => {
  const w = world();
  for (const judge of [(md) => checkInquiryEntry(md), (md) => w.k.checkEntry(md)]) {
    /* the negative control: the same document with no case key draws no such finding */
    assert.deepEqual(caseKeyFindings(await judge(inquiryMd(F))), [], "a finding naming no case is not refused on this arm");
    /* all eight at once: the class, named whole (caseproduction adversary 3) */
    assert.deepEqual(namedKeys(await judge(withKeys(CASE_KEYS))), [...CASE_KEYS].sort());
    /* the multifinding roster lie (block 2b): another case's id, edition, scope, acknowledgement and roster */
    assert.deepEqual(namedKeys(await judge(withKeys(["case_id", "case_edition", "case_scope", "bias_acknowledgement", "case_findings"]))),
      ["bias_acknowledgement", "case_edition", "case_findings", "case_id", "case_scope"]);
    /* each key alone is refused by its own name, and only by it (caseproduction adversaries 1 and 2, multifinding's
       isolated acknowledgement) */
    for (const k of CASE_KEYS) assert.deepEqual(namedKeys(await judge(withKeys([k]))), [k], `${k} alone`);
  }
});

test("R2 the refusal says where the case's facts live and how to repair it; an empty or null key names nothing", async () => {
  const found = caseKeyFindings(await checkInquiryEntry(withKeys(["case_project", "bias_acknowledgement"])));
  assert.equal(found.length, 2);
  for (const x of found) {
    assert.equal(x.severity, "error");
    assert.match(x.message, /CASE DOCUMENT a member reviews and ratifies/, "multifinding (a2): it says where those facts live now");
    assert.match(x.message, /signed ONCE, in the CASE DOCUMENT/, "multifinding REC-47 isolated: signed once, not N times");
    const k = /name a case \((\w+)\)/.exec(x.message)[1];
    assert.deepEqual(x.repairs, [localize("inquiry-grammar.grammar.remove_k_from_this_documents", "remove {k} from this document's frontmatter", { k }),
                                 localize("inquiry-grammar.grammar.the_case_states_these_facts", "the case states these facts once, in its own signed document")]);
  }
  /* edge: a key present but empty, null or the word null states nothing, so it names no case */
  for (const v of ['""', "null", "''"]) {
    assert.deepEqual(namedKeys(await checkInquiryEntry(withKeys([], [`case_id: ${v}`, `case_scope: ${v}`]))), [], `value ${v}`);
  }
});

/* ------------------------------------------------------------------ R7: C-21.2, per axis and per finding */

const INFO = "INFO-2026-1400-capture-b";
const CASE = "INQ-2026-1400-case";           /* publish's case: frozen (capture B, connection C) */
const THIN = "INQ-2026-1400-thin";           /* publish's thin case: both axes UNRATED */
const FIND_A = "INQ-2026-4400-authorisation"; /* multifinding's FIND_A: (capture B, connection C) */
const FIND_B = "INQ-2026-4400-signature";     /* multifinding's FIND_B: (capture UNRATED, connection D) */
const axis = (state, grade = null) => ({ state, grade });
const PUBLISHED = {
  [CASE]: { object_type: "inquiry", editions: { 1: { capture: axis("graded", "B"), connection: axis("graded", "C") } } },
  [THIN]: { object_type: "inquiry", editions: { 1: { capture: axis("unrated"), connection: axis("unrated") } } },
  [FIND_A]: { object_type: "inquiry", editions: { 1: { capture: axis("graded", "B"), connection: axis("graded", "C") } } },
  [FIND_B]: { object_type: "inquiry", editions: { 1: { capture: axis("unrated"), connection: axis("graded", "D") } } },
};

/* A leg on a published finding, beside an ungraded document leg (publish's `legOn`); `target_edition` is written after
   the leg's role, since the fixture's document writes no edition. */
const legsOn = (target, extra) => [{ target: INFO }, { target, ...extra }];
const mdWith = (id, legs) => {
  let md = inquiryMd(id, { question: "Does the pattern hold city-wide?", legs });
  for (const l of legs) if (l.target_edition !== undefined)
    md = md.replace(`  - target: ${l.target}\n    role: ${l.role || "supports"}\n`,
                    `  - target: ${l.target}\n    role: ${l.role || "supports"}\n    target_edition: ${l.target_edition}\n`);
  return md;
};
function pubWorld() {
  const w = world({ published: PUBLISHED });
  w.doc(INFO);
  for (const id of [CASE, THIN, FIND_A, FIND_B]) w.inquiry(id);
  let n = 0;
  /* a FRESH bundle per probe (publish's reason: one probe's answer must not depend on whether the last one landed) */
  w.probe = (legs) => { const id = `INQ-2026-2000-p${++n}`; const r = w.promote(id, mdWith(id, legs)); r.id = id; return r; };
  return w;
}
/* `target_edition` null writes no edition at all. */
const inh = (grade, grade_axis, target_edition = 1) =>
  ({ grade, grade_axis, grade_source: "inherited", ...(target_edition === null ? {} : { target_edition }) });
/* The pure arm over the same legs, with the same registry. */
const pureErrs = (legs, pub = PUBLISHED) => errs((f) => checkInquiryBasis({ id: "INQ-2026-2000-z", object_type: "inquiry",
  references: [...new Set(legs.map((l) => l.target))].map((t) => ({ target: t, rel: "cites", status: "confirmed" })),
  basis: legs.map((l) => ({ role: "supports", ...l })) }, f, pub, null));

test("R7 C-21.2 per axis, the four probes: capture A over B and connection B over C refused; each axis's own frozen grade accepted", () => {
  const w = pubWorld();
  const refused = (legs, re) => {
    const r = w.probe(legs);
    assert.deepEqual([r.ok, r.reason, checksOf(r)], [false, "BASIS_REFUSED", ["C-21.2"]], JSON.stringify(r).slice(0, 400));
    assert.match(detailsOf(r), re);
    assert.equal(w.record.head(r.id), null, "a refused write lands nothing");
  };
  /* PROBE 1 and 2: refused, each on its own axis */
  refused(legsOn(CASE, inh("A", "capture")),
    /basis\[1\] inherits capture grade A from INQ-2026-1400-case edition 1, whose frozen capture strength is B: .*PER AXIS/);
  refused(legsOn(CASE, inh("B", "connection")),
    /basis\[1\] inherits connection grade B from INQ-2026-1400-case edition 1, whose frozen connection strength is C/);
  /* PROBE 3 and 4: the legal legs at each axis's frozen grade — a comparison composed to the weakest letter refuses
     the first, one composed to the strongest accepts probe 2 */
  for (const e of [inh("B", "capture"), inh("C", "connection"), inh("C", "capture"), inh("D", "connection")]) {
    const r = w.probe(legsOn(CASE, e));
    assert.equal(r.ok, true, `${e.grade_axis} ${e.grade}: ${JSON.stringify(r).slice(0, 300)}`);
  }
  /* the pure arm answers the same per axis */
  assert.deepEqual(pureErrs(legsOn(CASE, inh("A", "capture"))).map((x) => x.check), ["C-21.2"]);
  assert.deepEqual(pureErrs(legsOn(CASE, inh("B", "connection"))).map((x) => x.check), ["C-21.2"]);
  assert.deepEqual(pureErrs(legsOn(CASE, inh("B", "capture"))), []);
  assert.deepEqual(pureErrs(legsOn(CASE, inh("C", "connection"))), []);
});

test("R7 C-21.2 edge cases: no edition, an edition never published, an own grade on a published case, the inert leg, an unrated axis", () => {
  const w = pubWorld();
  const one = (legs) => { const r = w.probe(legs); return [r.ok, checksOf(r), detailsOf(r)]; };
  let [ok, checks, d] = one(legsOn(CASE, inh("B", "capture", null)));
  assert.deepEqual([ok, checks], [false, ["C-21.2"]], "an unnamed edition fixes nothing to compare");
  assert.match(d, /basis\[1\] inherits from INQ-2026-1400-case without naming an edition/);
  [ok, checks, d] = one(legsOn(CASE, inh("B", "capture", 9)));
  assert.deepEqual([ok, checks], [false, ["C-21.2"]], "an edition never published");
  assert.match(d, /basis\[1\] names edition 9 of INQ-2026-1400-case, which is not in the published record \(published editions: 1\)/);
  /* a leg AUTHORING its grade on a published case is refused twice, by both items' gates: C-21.2 (it must inherit)
     and C-2.8 (an authored capture grade on an inquiry leg has no referent, DEC-21) */
  [ok, checks, d] = one(legsOn(CASE, { grade: "B", grade_axis: "capture", grade_source: "resolution", target_edition: 1 }));
  assert.deepEqual([ok, checks], [false, ["C-2.8", "C-21.2"]]);
  assert.match(d, /basis\[1\] carries a grade of its own on a PUBLISHED case \(INQ-2026-1400-case\)/);
  assert.match(d, /basis\[1\] states a capture-axis grade on an inquiry leg/);
  /* an UNGRADED leg on a published case is legal: undetermined, stated (DEC-18) */
  assert.equal(w.probe(legsOn(CASE, {})).ok, true);
  /* but claiming inheritance with no grade is not inheritance */
  [ok, checks, d] = one(legsOn(CASE, { grade_source: "inherited", target_edition: 1 }));
  assert.deepEqual([ok, checks], [false, ["C-2.8"]]);
  assert.match(d, /basis\[1\] claims 'inherited' with no grade/);
  /* inheriting ANY grade from an UNRATED axis: nothing was established there to inherit */
  for (const e of [inh("C", "capture"), inh("D", "connection")]) {
    [ok, checks, d] = one(legsOn(THIN, e));
    assert.deepEqual([ok, checks], [false, ["C-21.2"]], `${e.grade_axis} from unrated`);
    assert.match(d, new RegExp(`inherits ${e.grade_axis} grade ${e.grade} from INQ-2026-1400-thin edition 1, whose ${e.grade_axis} axis is UNRATED: nothing on that axis was ever established there`));
  }
  /* 'inherited' on a target that is not a published case (a document) is refused C-2.8 */
  [ok, checks, d] = one([{ target: INFO, grade: "B", grade_axis: "capture", grade_source: "inherited", target_edition: 1 }]);
  assert.deepEqual([ok, checks], [false, ["C-2.8"]]);
  assert.match(d, /basis\[0\] states grade_source 'inherited' but its target is not a published case/);
});

test("R7 C-21.2 edge cases at the pure arm: an undetermined or absent axis admits no grade; no registry refuses inheritance; a published document is not a case", () => {
  const undet = { [CASE]: { object_type: "inquiry", editions: { 1: { capture: axis("undetermined"), connection: axis("graded", "C") } } } };
  const u = pureErrs(legsOn(CASE, inh("B", "capture")), undet);
  assert.deepEqual(u.map((x) => x.check), ["C-21.2"]);
  assert.match(u[0].message, /whose capture axis is UNDETERMINED: what lies beneath is unknown rather than absent/);
  const absent = { [CASE]: { object_type: "inquiry", editions: { 1: { connection: axis("graded", "C") } } } };
  assert.match(pureErrs(legsOn(CASE, inh("B", "capture")), absent)[0].message, /whose capture axis is ABSENT/);
  /* an entry with no object_type is held to the inquiry rule (undetermined is not evidence, D-598) */
  const untyped = { [CASE]: { editions: PUBLISHED[CASE].editions } };
  assert.deepEqual(pureErrs(legsOn(CASE, inh("A", "capture")), untyped).map((x) => x.check), ["C-21.2"]);
  assert.deepEqual(pureErrs(legsOn(CASE, inh("B", "capture")), untyped), []);
  /* a registry that cannot be read never passes an inherited leg */
  const none = pureErrs(legsOn(CASE, inh("B", "capture")), null);
  assert.deepEqual(none.map((x) => x.check), ["C-2.8"]);
  assert.match(none[0].message, /cannot be checked against the published record here/);
  /* a document published as a case's evidence froze no strength: it is not a published case to inherit from */
  const evidence = { [CASE]: { object_type: "information", editions: PUBLISHED[CASE].editions } };
  assert.match(pureErrs(legsOn(CASE, inh("B", "capture")), evidence)[0].message, /is not a published case/);
});

test("R7 C-21.2 is checked PER FINDING: two findings frozen differently each meet the rule at their own pair", () => {
  const w = pubWorld();
  const one = (leg) => w.probe([leg]);
  const refused = (r) => assert.deepEqual([r.ok, r.reason, checksOf(r)], [false, "BASIS_REFUSED", ["C-21.2"]], JSON.stringify(r).slice(0, 300));
  refused(one({ target: FIND_A, ...inh("A", "capture") }));
  assert.equal(one({ target: FIND_A, ...inh("B", "capture") }).ok, true, "FIND_A's frozen capture grade");
  assert.equal(one({ target: FIND_A, ...inh("C", "connection") }).ok, true, "and its connection, independently");
  assert.equal(one({ target: FIND_B, ...inh("D", "connection") }).ok, true, "FIND_B's own frozen connection D");
  /* C is legal beneath FIND_A and not beneath FIND_B: a case-level comparison would have to pick one pair */
  const cFromB = one({ target: FIND_B, ...inh("C", "connection") });
  refused(cFromB);
  assert.match(detailsOf(cFromB), /inherits connection grade C from INQ-2026-4400-signature edition 1, whose frozen connection strength is D/);
  const capFromB = one({ target: FIND_B, ...inh("D", "capture") });
  assert.deepEqual([capFromB.ok, checksOf(capFromB)], [false, ["C-21.2"]], "FIND_B's capture axis is UNRATED");
  assert.match(detailsOf(capFromB), /whose capture axis is UNRATED/);
  /* a leg naming the CASE rather than a finding resolves to nothing: legs rest on findings, never on cases */
  const onCase = one({ target: "CASE-2026-0001", ...inh("B", "capture") });
  assert.equal(onCase.ok, false);
  assert.match(detailsOf(onCase), /basis\[0\]\.target 'CASE-2026-0001' is not a canonical record id/);
  /* the pure arm, per finding */
  assert.deepEqual(pureErrs([{ target: FIND_A, ...inh("C", "connection") }]), []);
  assert.deepEqual(pureErrs([{ target: FIND_B, ...inh("C", "connection") }]).map((x) => x.check), ["C-21.2"]);
});

/* ------------------------------------------------------------------ R8: the grounds gate */

const DA = "INFO-2026-1000-charter-cap", DB = "INFO-2026-1000-code-cap";
const AT = "2026-08-05T09:00:00Z";
const LEGS = [{ target: DA, ground: "charter" }, { target: DB, ground: "code" }];
const row = (ground, extra = {}) => ({ ground, asserted_by: "member:carol", at: AT, ...extra });
const ROWS = [row("charter"), row("code")];
const fmWith = (legs, grounds) => ({ id: "INQ-2026-1005-z", object_type: "inquiry",
  references: [...new Set(legs.map((l) => l.target))].map((t) => ({ target: t, rel: "cites", status: "confirmed" })),
  basis: legs.map((l) => ({ role: "supports", ...l })), ...(grounds === undefined ? {} : { grounds }) });
/* The fixture's document writes `asserted_by` and `at` from each row; `statement` goes in by hand. */
const groundsMd = (id, legs, rows) => {
  let md = inquiryMd(id, { legs, grounds: rows });
  for (const r of rows || []) if (r.statement !== undefined)
    md = md.replace(`  - ground: ${r.ground}\n    asserted_by: ${r.asserted_by}\n    at: "${r.at}"\n`,
                    `  - ground: ${r.ground}\n    asserted_by: ${r.asserted_by}\n    at: "${r.at}"\n    statement: "${r.statement}"\n`);
  return md;
};
function groundsWorld() {
  const w = world(); w.doc(DA); w.doc(DB);
  let n = 0;
  w.try = (legs, rows) => { const id = `INQ-2026-1005-g${++n}`; const r = w.promote(id, groundsMd(id, legs, rows)); r.id = id; return r; };
  return w;
}

test("R8 the grounds gate: a machine's spelling of asserted_by is refused C-2.8 — agent, token:member, class:member, TOKEN:member — the same finding for each", () => {
  const w = groundsWorld();
  const seen = [];
  for (const spelling of ["agent", "token:member", "class:member", "TOKEN:member"]) {
    const rows = [row("charter", { asserted_by: spelling }), row("code")];
    const r = w.try(LEGS, rows);
    assert.deepEqual([r.ok, r.reason, checksOf(r)], [false, "BASIS_REFUSED", ["C-2.8"]], spelling);
    const want = localize("inquiry-grammar.grammar.grounds_i_asserted_by_asserted", 'grounds[{i}].asserted_by \'{asserted_by}\' is not a named member: "these legs are enough on their own" is an authored judgment that makes the finding STRONGER, so it carries the name of the member making it — never a machine\'s', { i: "0", asserted_by: spelling });
    assert.equal(r.findings[0].detail, want);
    assert.deepEqual(r.findings[0].repairs, [localize("inquiry-grammar.grammar.name_the_member_asserting_that", "name the member asserting that this ground is independently sufficient")]);
    assert.equal(w.record.head(r.id), null, "the refused write landed nothing");
    const pure = errs((f) => checkInquiryBasis(fmWith(LEGS, rows), f, null, null));
    assert.deepEqual(pure.map((x) => [x.check, x.message]), [["C-2.8", want]], "the pure arm is the same finding");
    seen.push(r.findings[0].detail.replace(spelling, "<S>"));
  }
  assert.equal(new Set(seen).size, 1, "a reader cannot tell from the answer which spelling was tried");
  /* the negative control: a named member asserts, and the basis lands */
  assert.equal(w.try(LEGS, ROWS).ok, true);
});

test("R8 the grounds gate: an undated, doubled, empty or ill-labelled ground is refused; a statement is legal and gates nothing", () => {
  const w = groundsWorld();
  const refused = (legs, rows, re) => {
    const r = w.try(legs, rows);
    assert.deepEqual([r.ok, r.reason], [false, "BASIS_REFUSED"], JSON.stringify(r).slice(0, 300));
    assert.ok(r.findings.every((f) => f.check === "C-2.8"));
    assert.match(detailsOf(r), re);
  };
  refused(LEGS, [row("charter", { at: "yesterday" }), row("code")],
    /grounds\[0\] requires 'at' as an ISO timestamp \(got 'yesterday'\)/);
  refused(LEGS, [row("charter"), row("charter"), row("code")],
    /grounds\[1\] declares 'charter' a second time: one ground, one assertion, one member answering for it/);
  refused(LEGS, [...ROWS, row("practice")],
    /grounds\[2\] declares 'practice', which no basis leg belongs to: a ground is a partition OF THE LEGS/);
  refused([{ target: DA, ground: 'char"ter' }, { target: DB, ground: "code" }], [row('char"ter'), row("code")],
    /is not a ground label/);
  /* an optional per-ground statement is a plain-words label for the reader, gating nothing */
  const ok = w.try(LEGS, [row("charter", { statement: "The charter grants the authority outright." }),
                          row("code", { statement: "The code does not forbid it." })]);
  assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 300));
  assert.deepEqual(errs((f) => checkInquiryBasis(fmWith(LEGS, [row("charter", { statement: 7 }), row("code")]), f, null, null))
    .map((x) => x.message), ["grounds[0].statement is not a string"]);
});

test("R8 a grounds[] block over NO basis is refused at the write and by the pure arm, and the act answers NO_BASIS", () => {
  const w = groundsWorld();
  const r = w.try([], ROWS);
  assert.deepEqual([r.ok, r.reason, checksOf(r)], [false, "BASIS_REFUSED", ["C-2.8", "C-2.8"]]);
  assert.match(r.findings[0].detail, /^grounds\[0\] declares 'charter', which no basis leg belongs to/);
  assert.match(r.findings[1].detail, /^grounds\[1\] declares 'code', which no basis leg belongs to/);
  assert.equal(w.record.head(r.id), null);
  const pure = errs((f) => checkInquiryBasis({ id: "INQ-2026-1009-z", object_type: "inquiry", references: [], grounds: ROWS }, f, null, null));
  assert.deepEqual(pure.map((x) => x.check), ["C-2.8", "C-2.8"]);
  /* the negative control: an open inquiry with no basis and no grounds is legal (a standing objective) */
  assert.equal(w.try([], null).ok, true);
  /* and the act: grounding a question that rests on nothing is NO_BASIS (C-33.40), never a grounds block */
  w.inquiry("INQ-2026-1009-e");
  const before = w.text("INQ-2026-1009-e");
  const g = w.k.ground({ target: "INQ-2026-1009-e", grounds: [{ ground: "charter", legs: [0] }], viewer: "admin", author: V("carol") });
  assert.deepEqual([g.ok, g.reason, g.check], [false, "NO_BASIS", "C-33.40"]);
  assert.equal(w.text("INQ-2026-1009-e"), before);
});

test("R8 the default is AND: a label with no grounds[] block is refused at the write, and an unlabelled supporting leg beside a ground is a necessary leg", () => {
  const w = groundsWorld();
  const noBlock = w.try(LEGS, null);
  assert.deepEqual([noBlock.ok, noBlock.reason, checksOf(noBlock)], [false, "BASIS_REFUSED", ["C-2.8"]]);
  assert.match(noBlock.findings[0].detail, /^basis legs 0, 1 name a ground with no grounds\[\] block: .*affirmative, attributed act/);
  assert.equal(w.record.head(noBlock.id), null, "the refused write landed nothing");
  /* a supporting leg without a label beside a labelled ground is a necessary leg (inquiry-grammar R68), no finding */
  const half = w.try([{ target: DA, ground: "charter" }, { target: DB }], [row("charter")]);
  assert.equal(half.ok, true, JSON.stringify(half).slice(0, 300));
  /* control: a leg that cuts against never names a ground */
  const cut = w.try([{ target: DA, ground: "charter" }, { target: DB, role: "cuts_against", ground: "charter" }], [row("charter")]);
  assert.deepEqual([cut.ok, cut.reason], [false, "BASIS_REFUSED"]);
  /* the pure arm names the same document */
  assert.ok(errs((f) => checkInquiryBasis(fmWith(LEGS), f, null, null)).some((x) => /no grounds\[\] block/.test(x.message)));
});

test("R8 R27 R30 through the act: every machine spelling is refused MACHINE_CANNOT_GROUND, and a caller's asserted_by is never what lands", () => {
  const w = world(); w.doc(DA); w.doc(DB);
  const Q = "INQ-2026-1011-q";
  w.inquiry(Q, { legs: [{ target: DA }, { target: DB }] });
  const act = (author, grounds = [{ ground: "charter", legs: [0] }, { ground: "code", legs: [1] }]) =>
    w.k.ground({ target: Q, grounds, viewer: "admin", author });
  const before = w.text(Q);
  for (const spelling of ["agent", "token:member", "class:member", "TOKEN:member"]) {
    const r = act(spelling);
    assert.deepEqual([r.ok, r.reason, r.check], [false, "MACHINE_CANNOT_GROUND", "C-32.8"], spelling);
    assert.ok(r.translation);
  }
  assert.equal(w.text(Q), before, "nothing was written");
  /* a member grounds; a machine spelling offered as the rows' asserted_by is not read */
  const ok = act(V("carol"), [{ ground: "charter", legs: [0], asserted_by: "token:member", at: "1999-01-01T00:00:00Z" },
                              { ground: "code", legs: [1], asserted_by: "class:member" }]);
  assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 300));
  assert.deepEqual(w.fm(Q).grounds.map((r) => [r.ground, r.asserted_by]), [["charter", V("carol")], ["code", V("carol")]]);
});
