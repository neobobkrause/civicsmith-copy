/* inquiry-grammar R1–R5, R7–R10 at the module's interface: the entry arm, the division block, the recheck coverage,
   the leg grammar with its grounds, testimony, earned and inherited arms and its part, supersession and the division
   disclosure, the lead checker, and the rows. Every finding is compared with what the check catalogue answered for the
   same input before the move (`golden.json`; K585 (2), K640): the same in check, severity, message, repairs and code,
   and in order. Negative controls state each arm's findings by hand. Pure functions, driven with documents and legs. */
import test from "node:test";
import assert from "node:assert/strict";
import * as IG from "../../../src/inquiry-grammar/index.mjs";
import { LEAD_CHECKS as OBSERVATION_LEAD_CHECKS, LEAD_ID_RE } from "../../../src/observation-log/index.mjs";
import { BUNDLE_CASES, LEG_CASES, REGISTRY_VARIANTS, GROUND_CASES, SUPERSEDE_CASES, LEAD_LEG_CASES, legFm,
         INFO, INFO2, INFO3, SELF, PUBLISHED, EARNED, IMPORTED_BUNDLE_CASES } from "./corpus.mjs";
import { GOLDEN, run, plain, judge } from "./fixture.mjs";
import { word, localize } from "../../../src/setup-words/index.mjs";

const { checkInquiryExtension, checkRecheckCoverage, checkInquiryBasis, checkLegExtentGrammar, supersedesEdgeFindings,
        divisionDisclosureFindings, leadLegFindings, checkSupersession, INQUIRY_GRAMMARS, LEAD_CHECKS,
        INQUIRY_GRAMMAR_CHECKS, GROUND_LABEL_RE, EARNED_SOURCE_AXIS } = IG;
const VARIANTS = Object.keys(REGISTRY_VARIANTS);
const ctxOf = (fm, pub = null, earned = null) => ({ fm, publishedRegistry: pub, earnedRegistry: earned });
const sync = (fn) => { const r = run(fn); assert.equal(r.answer, undefined, "answers nothing"); return plain(r.findings); };
/* The catalogue's findings for a bundle with the version findings taken out: what this module's arms alone answer. */
const withoutVersions = (id, variant) => {
  const v = GOLDEN.bundles[id].versions.map((x) => JSON.stringify(x));
  return GOLDEN.bundles[id][variant].filter((x) => !v.includes(JSON.stringify(x)));
};
const inquiries = Object.keys(BUNDLE_CASES).filter((id) => /^(INQ|PROB)-/.test(id));

test("R1, R2, R3, R4 (C-2.8, C-15.1, C-6.1): record-grammar's checkBundle given INQUIRY_GRAMMARS answers, for every bundle of the corpus under every registry variant, the catalogue's findings in content and order (the version findings aside, R6's sub-slot)", async () => {
  assert.deepEqual(INQUIRY_GRAMMARS.map((g) => [g.module, [...g.ids]]),
                   [["inquiry-grammar", ["C-6.1"]], ["inquiry-grammar", ["C-15.1"]], ["inquiry-grammar", ["C-2.8"]]]);
  for (const id of Object.keys(BUNDLE_CASES)) for (const v of VARIANTS)
    assert.deepEqual(await judge(id, v, INQUIRY_GRAMMARS), withoutVersions(id, v), `${id} (${v})`);
});

test("R1, R2, R3, R6 negative control: without this module's grammar no slot it takes runs, and the findings that go are exactly the C-2.8, C-15.1 and C-6.1 slots' (with what they relay: C-6.3, C-21.2, C-54.1, C-81.1)", async () => {
  const slotChecks = new Set(["C-2.8", "C-15.1", "C-6.1", "C-6.3", "C-21.2", "C-54.1", "C-81.1"]);
  for (const id of Object.keys(BUNDLE_CASES)) for (const v of VARIANTS) {
    const bare = await judge(id, v, []);
    assert.deepEqual(bare, GOLDEN.bundles[id][`${v}-none`], `${id} (${v}): the catalogue with no grammar for these slots`);
    const mine = withoutVersions(id, v);
    assert.deepEqual(mine.filter((x) => !slotChecks.has(x.check)), bare.filter((x) => !slotChecks.has(x.check)), `${id} (${v})`);
  }
  const all = Object.keys(BUNDLE_CASES).flatMap((id) => withoutVersions(id, "both")).map((x) => x.check);
  for (const c of ["C-2.8", "C-15.1", "C-6.1", "C-6.3", "C-21.2", "C-54.1", "C-81.1"]) assert.ok(all.includes(c), `the corpus raises ${c}`);
});

test("R1 (C-2.8) entry requirements, by hand: surfaced_by, a disposition's reason, a conclusion, its leg, its falsifier accounted for (REC-117, never both and never half), the subject entity's shape, no case named (CASE-5b); a non-inquiry gets nothing", () => {
  const msgs = (fm) => sync((f) => checkInquiryExtension(ctxOf({ object_type: "inquiry", surfaced_by: "human", ...fm }), f)).map((x) => x.message);
  const has = (fm, re) => assert.ok(msgs(fm).some((m) => re.test(m)), `${re}: ${JSON.stringify(msgs(fm))}`);
  assert.deepEqual(msgs({}), []);
  has({ surfaced_by: "robot" }, /^who surfaced this inquiry is 'robot', which is not one of: agent, human$/);
  has({ current_state: "deferred" }, /^the deferred state requires a non-empty reason$/);
  has({ current_state: "dismissed", disposition_reason: " " }, /^the dismissed state requires a non-empty reason$/);
  const concluded = (o) => ({ current_state: "concluded", conclusion: "it is", falsifier: "x", basis: [{ target: INFO, role: "supports" }], ...o });
  assert.deepEqual(msgs({ ...concluded({}), references: [{ target: INFO, rel: "cites" }] }), []);
  has(concluded({ conclusion: "" }), /^concluded state requires a non-empty conclusion$/);
  has(concluded({ falsifier: "" }), /requires a non-empty falsifier/);
  has(concluded({ falsifier: "", falsifier_override_by: "member:a" }), /HALF-RECORDED override: an override missing its date/);
  has(concluded({ falsifier: "", falsifier_override_at: "2026-07-01T00:00:00Z" }), /HALF-RECORDED override: an override missing its member/);
  has(concluded({ falsifier_override_by: "member:a", falsifier_override_at: "2026-07-01T00:00:00Z" }), /BOTH an authored falsifier/);
  assert.ok(!msgs(concluded({ falsifier: "", falsifier_override_by: "member:a", falsifier_override_at: "x" })).some((m) => /falsifier/.test(m)));
  has(concluded({ basis: [] }), /requires at least one basis leg/);
  has({ subject_entity: "ENT-1" }, /^the subject entity 'ENT-1' is not an entry in the subject registry/);
  assert.ok(!msgs({ subject_entity: "ENT-2026-0001" }).length);
  for (const k of ["case_id", "case_edition", "case_project", "case_scope", "case_findings", "case_roles", "bias_acknowledgement", "required_strength"])
    has({ [k]: "x" }, new RegExp("case facts of its own"));
  assert.ok(!msgs({ case_id: "null", case_edition: "" }).length, "an absent case field is not named");
  for (const t of ["information", "project", undefined]) assert.deepEqual(sync((f) => checkInquiryExtension(ctxOf({ object_type: t, surfaced_by: "x" }), f)), []);
  assert.ok(sync((f) => checkInquiryExtension(ctxOf({ object_type: "problem", surfaced_by: "x" }), f)).length, "a legacy type alias is an inquiry");
});

test("R2 (C-2.8) divided, by hand: a division block (reason, a named non-machine apportioner, an ISO at, two distinct canonical children) and an apportionment homing every leg, each child given one, each row's target the leg's", () => {
  const legs = [{ target: INFO, role: "supports" }, { target: INFO2, role: "cuts_against" }];
  const division = { reason: "two", apportioned_by: "member:a", at: "2026-07-01T00:00:00Z", into: ["INQ-2026-0010-a", "INQ-2026-0011-b"] };
  const rows = [{ ord: 0, to: "INQ-2026-0010-a", target: INFO }, { ord: 1, to: "INQ-2026-0011-b" }];
  const msgs = (o) => sync((f) => checkInquiryExtension(ctxOf({ object_type: "inquiry", surfaced_by: "human", current_state: "divided",
    basis: legs, references: [{ target: INFO }, { target: INFO2 }], division, division_apportionment: rows, ...o }), f)).map((x) => x.message);
  assert.deepEqual(msgs({}), []);
  const has = (o, re) => assert.ok(msgs(o).some((m) => re.test(m)), `${re}: ${JSON.stringify(msgs(o))}`);
  has({ division: undefined }, /^divided state requires a division block/);
  has({ division: { ...division, into: ["INQ-2026-0010-a"] } }, /names 1 child: a division produces at least two inquiries/);
  has({ division: { ...division, into: ["INQ-2026-0010-a", "INQ-2026-0010-a"] } }, /names the same child twice/);
  has({ division: { ...division, into: ["INQ-2026-0010-a", "nope"] } }, /the division names 'nope', which is not a valid record reference/);
  has({ division: { ...division, reason: "" } }, /division requires a non-empty reason/);
  for (const who of ["", "class:daemon", "token:x"]) has({ division: { ...division, apportioned_by: who } }, /is not a named member/);
  has({ division: { ...division, at: "2026-07-01" } }, /division requires 'at' as an ISO timestamp/);
  has({ division_apportionment: undefined }, /a divided inquiry must say where every leg went/);
  has({ division_apportionment: [rows[0]] }, /^basis leg 1 has no home in the apportionment \(including 1 that cuts AGAINST/);
  has({ division_apportionment: [rows[0], { ord: 1, to: "INQ-2026-0010-a" }] }, /include INQ-2026-0011-b, which received no leg/);
  has({ division_apportionment: [{ ...rows[0], target: INFO2 }, rows[1]] }, /names 'INFO-2026-0002-b' for leg 0, where the basis carries/);
  has({ division_apportionment: [rows[0], { ord: 2, to: "INQ-2026-0011-b" }] }, /names leg 2, which is not a leg of this inquiry's basis/);
  has({ division_apportionment: [rows[0], { ord: 1, to: "INQ-2026-0099-z" }] }, /which is not one of the children named in the division/);
  has({ division_apportionment: [rows[0], 5] }, /apportionment row 1 is not an object/);
  assert.ok(!msgs({ current_state: "open" }).length, "the block is judged in the divided state only");
});

test("R3 (C-15.1) the recheck coverage, by hand: absent, not a list or empty is one error; each malformed trigger one error naming its index; a malformed date one naming the value; every state, dismissed included; any other document nothing", () => {
  const c = (fm) => sync((f) => checkRecheckCoverage({ fm }, f));
  const inq = (t, s = "dismissed") => ({ object_type: "inquiry", current_state: s, recheck_triggers: t });
  for (const t of [undefined, null, "soon", {}, []]) {
    const r = c(inq(t));
    assert.equal(r.length, 1); assert.equal(r[0].check, "C-15.1"); assert.equal(r[0].severity, "error");
    assert.match(r[0].message, /carries at least one recheck trigger/);
  }
  const r = c(inq([{ text: "x", description: "y" }, "s", { text: "x" }, { description: "y" }, { text: "x", description: "y", date: "July" },
                   { text: "x", description: "y", date: "2026-07-01" }, null]));
  assert.deepEqual(r.map((x) => [x.check, x.message]), [
    ["C-15.1", "recheck trigger 1 lacks its text or its description: every trigger has both"],
    ["C-15.1", "recheck trigger 2 lacks its text or its description: every trigger has both"],
    ["C-15.1", "recheck trigger 3 lacks its text or its description: every trigger has both"],
    ["C-15.1", "recheck trigger 4 has the date 'July', which is not in the form YYYY-MM-DD"],
    ["C-15.1", "recheck trigger 6 lacks its text or its description: every trigger has both"]]);
  for (const s of ["open", "surfaced", "deferred", "concluded", "divided"]) assert.equal(c(inq(undefined, s)).length, 1, s);
  for (const t of ["information", "project", "action"]) assert.deepEqual(c({ object_type: t }), []);
  assert.deepEqual(c(null), []);
  assert.equal(c({ object_type: "focus" }).length, 1, "a legacy type alias is an inquiry");
});

test("R4 the leg grammar: checkInquiryBasis answers, for every leg case under every registry variant, the catalogue's findings in content and order, and never the version block (basis-versions' R43)", () => {
  for (const [name, legs] of Object.entries(LEG_CASES)) for (const v of VARIANTS) {
    const [pub, earned] = REGISTRY_VARIANTS[v];
    assert.deepEqual(sync((f) => checkInquiryBasis(legFm(name, legs), f, pub, earned)), GOLDEN.legs[name][v], `${name} (${v})`);
  }
  for (const [name, over] of Object.entries(GROUND_CASES)) {
    const fm = { id: SELF, object_type: "inquiry", references: [{ target: INFO, rel: "cites" }, { target: INFO2, rel: "cites" }], ...over };
    assert.deepEqual(sync((f) => checkInquiryBasis(fm, f, PUBLISHED, EARNED)), GOLDEN.grounds[name], `grounds: ${name}`);
  }
  const versioned = { ...legFm("clean", LEG_CASES.clean), basis_versions: [{ name: "", relationship: "xor" }],
                      basis_version_legs: [{ version: "zz", target: "LEAD-2026-0101-abc" }] };
  assert.deepEqual(sync((f) => checkInquiryBasis(versioned, f, null, null)), [], "a malformed version block is not this function's");
  for (const fm of [undefined, null, {}, { basis: null }]) assert.deepEqual(sync((f) => checkInquiryBasis(fm, f)), []);
});

test("R4 negative controls by hand: a lead or a theme is refused by name before the target complaint; C-6.3 when the target is not referenced; a capture grade on an inquiry leg; C-21.2 on a published case; a grounds label with no row", () => {
  const legs = (l, extra = {}) => sync((f) => checkInquiryBasis({ object_type: "inquiry", references: [{ target: INFO }], basis: l, ...extra }, f, PUBLISHED, EARNED));
  assert.deepEqual(legs([{ target: "LEAD-2026-0101-abc", role: "supports" }]).map((x) => [x.check, x.code]), [["C-54.1", "LEAD_NOT_EVIDENCE"]]);
  assert.deepEqual(legs([{ target: "THEME-2026-0101-abc", role: "supports" }]).map((x) => x.check), ["C-81.1"]);
  assert.deepEqual(legs([{ target: INFO2, role: "supports" }]).map((x) => [x.check, x.repairs]),
                   [["C-6.3", [localize("inquiry-grammar.grammar.add_a_references_entry_for_p", "add a reference for '{t}'", { t: INFO2 }),
                              localize("inquiry-grammar.grammar.remove_the_basis_leg", "remove the basis leg")]]]);
  assert.match(legs([{ target: "INQ-2026-0003-c", role: "supports", grade: "B", grade_axis: "capture", grade_source: "hunch", author: "a", date: "2026-07-01" }],
                    { references: [{ target: "INQ-2026-0003-c" }] })[0].message, /capture-axis grade on an inquiry leg/);
  assert.deepEqual(legs([{ target: "INQ-2026-0004-pub", role: "supports", grade: "C", grade_axis: "connection", grade_source: "inherited" }],
                        { references: [{ target: "INQ-2026-0004-pub" }] }).map((x) => x.check), ["C-21.2"]);
  assert.match(legs([{ target: INFO, role: "supports", ground: "a" }])[0].message, /names a ground, but there is no grounds section/);
  assert.deepEqual(legs([{ target: INFO, role: "supports" }]), []);
});

test("R4 a connection grade on a leg citing a member's authored observation is graded as any leg's: neither refused by name (no testimony code) nor exempt (the earned rule applies)", () => {
  const judgeOn = (target, leg) => sync((f) => checkInquiryBasis({ object_type: "inquiry", references: [{ target }],
    basis: [{ target, role: "supports", ...leg }] }, f, PUBLISHED, EARNED));
  const legs = [{ grade: "C", grade_axis: "connection", grade_source: "hunch", author: "member:a", date: "2026-07-01" },
                { grade: "B", grade_axis: "connection", grade_source: "resolution" },
                { grade: "D", grade_axis: "connection", grade_source: "testimony" }];
  assert.ok(EARNED.earned.testimony[INFO3], "the target is a member's authored observation");
  for (const leg of legs) {
    const onObservation = judgeOn(INFO3, leg), onDocument = judgeOn(INFO2, leg);
    assert.ok(!onObservation.some((x) => /^testimony-/.test(x.code || "")), JSON.stringify(onObservation));
    assert.deepEqual(JSON.parse(JSON.stringify(onObservation).replaceAll(INFO3, INFO2)), onDocument,
                     `${leg.grade_source}: the same findings as on a captured document`);
  }
  assert.deepEqual(judgeOn(INFO3, legs[0]), [], "an authored connection grade on an observation stands");
  assert.match(judgeOn(INFO3, legs[1])[0].message, /holds no A\/B\/C resolution of that document/, "an earned one is still earned");
});

test("R4 checkLegExtentGrammar: for every leg of the corpus, under C-2.8 and C-25.10, the catalogue's findings; the extent's code travels and the C-number is the caller's", () => {
  for (const [name, legs] of Object.entries(LEG_CASES)) legs.forEach((leg, i) => {
    assert.deepEqual(sync((f) => checkLegExtentGrammar(leg, "basis leg 0", "C-2.8", f)), GOLDEN.extent[name][i].c28, `${name}[${i}] C-2.8`);
    assert.deepEqual(sync((f) => checkLegExtentGrammar(leg, "basis_version_legs[0]", "C-25.10", f)), GOLDEN.extent[name][i].c2510, `${name}[${i}] C-25.10`);
  });
  const dom = sync((f) => checkLegExtentGrammar({ extent_kind: "dom" }, "basis leg 2", "C-25.10", f));
  assert.deepEqual(dom.map((x) => [x.check, x.code]), [["C-25.10", "CONTENT_EXTENT_NO_PRODUCER"]]);
  assert.match(dom[0].repairs[0], /name the part as one of these — a cell of this spreadsheet; .*a paragraph of this document/);
  assert.doesNotMatch(dom[0].repairs[0], /doc-para|pdf-page|sheet-range/);
  assert.deepEqual(sync((f) => checkLegExtentGrammar({ target: INFO }, "basis leg 0", "C-2.8", f)), [], "no extent is the whole document");
});

test("R4 (C-6.1) supersedesEdgeFindings and divisionDisclosureFindings, and the slot's arm (edges then disclosure): the catalogue's findings for every case", () => {
  for (const [name, fm] of Object.entries(SUPERSEDE_CASES)) {
    const edges = sync((f) => supersedesEdgeFindings(fm, f)), disclosure = sync((f) => divisionDisclosureFindings(fm, f));
    assert.deepEqual(edges, GOLDEN.supersede[name].edges, `${name}: edges`);
    assert.deepEqual(disclosure, GOLDEN.supersede[name].disclosure, `${name}: disclosure`);
    assert.deepEqual(sync((f) => checkSupersession({ fm }, f)), [...edges, ...disclosure], `${name}: the slot's arm`);
  }
  assert.match(GOLDEN.supersede["no-siblings"].disclosure[0].message, /so a child of one always has at least one sibling to name/);
});

test("R4 GROUND_LABEL_RE and EARNED_SOURCE_AXIS are the catalogue's", () => {
  assert.equal(String(GROUND_LABEL_RE), GOLDEN.GROUND_LABEL_RE);
  assert.deepEqual(EARNED_SOURCE_AXIS, GOLDEN.EARNED_SOURCE_AXIS);
  for (const ok of ["a", "Ground 1", "a-b_c", "x".repeat(48)]) assert.ok(GROUND_LABEL_RE.test(ok), ok);
  for (const no of ["", " a", "a:b", "x".repeat(49), "-a"]) assert.ok(!GROUND_LABEL_RE.test(no), no);
});

test("R5 (C-54.1) leadLegFindings: a lead id at a leg's target or content_id, trimmed, is one C-54.1 error LEAD_NOT_EVIDENCE naming label, field and value, the first field only, answered true; otherwise nothing and false; the catalogue's findings for every case", () => {
  for (const [name, leg] of Object.entries(LEAD_LEG_CASES)) {
    const r = run((f) => leadLegFindings("basis leg 3", leg, f));
    assert.deepEqual(plain(r.findings), GOLDEN.lead[name].findings, name);
    assert.equal(r.answer, GOLDEN.lead[name].answer, name);
  }
  const L = "LEAD-2026-0101-abc123";
  const r = run((f) => leadLegFindings("basis leg 0", { target: L }, f));
  assert.equal(r.answer, true);
  assert.equal(r.findings.length, 1);
  assert.deepEqual([r.findings[0].check, r.findings[0].severity, r.findings[0].code], ["C-54.1", "error", "LEAD_NOT_EVIDENCE"]);
  assert.match(r.findings[0].message, new RegExp(`^the target on basis leg 0 \\('${L}'\\) is a LEAD`));
  const both = run((f) => leadLegFindings("x", { target: ` ${L}`, content_id: L }, f));
  assert.equal(both.findings.length, 1, "the first such field only");
  assert.match(both.findings[0].message, /^the target on x \('LEAD-/);
  assert.ok(LEAD_ID_RE.test(L), "the shape is observation-log's");
});

test("R5 the row: this module's LEAD_CHECKS is exactly {LEAD_NOT_EVIDENCE: C-54.1}, its translation unchanged, and the lead's own family (C-54.2–C-54.10) stays observation-log's", () => {
  assert.deepEqual(Object.keys(LEAD_CHECKS), ["LEAD_NOT_EVIDENCE"]);
  const row = LEAD_CHECKS.LEAD_NOT_EVIDENCE;
  assert.deepEqual(Object.keys(row), ["check", "where", "translation"]);
  assert.equal(row.check, "C-54.1");
  assert.equal(row.translation, GOLDEN.LEAD_CHECKS.LEAD_NOT_EVIDENCE.translation);
  assert.ok(!("LEAD_NOT_EVIDENCE" in OBSERVATION_LEAD_CHECKS));
  for (const r of Object.values(OBSERVATION_LEAD_CHECKS)) assert.notEqual(r.check, "C-54.1");
});

test("R7 R16 R18 INQUIRY_GRAMMAR_CHECKS: the thirteen rows, each {check, where, translation}, number and translation unchanged; the five inquiry mints keep their `where`; LEAD_NOT_EVIDENCE's names the site that raises it now (stamped by 1.50.0); IMPORTED_LEG_MALFORMED (C-21.3) is new, its translation BOB's draft; the three T33 leg rows, T34's derived-connection row and T41's bias-application row (C-2.8) follow (R16, R18; t33, t34 and t41 tests); the table has one name", async () => {
  assert.ok(Object.isFrozen(INQUIRY_GRAMMAR_CHECKS));
  const numbers = { LEAD_NOT_EVIDENCE: "C-54.1", NOT_INQUIRIES: "C-33.13", SELF_BASIS: "C-33.22", BASIS_CYCLE: "C-33.23",
                    MACHINE_CANNOT_DIVIDE: "C-32.7", MACHINE_CANNOT_GROUND: "C-32.8", IMPORTED_LEG_MALFORMED: "C-21.3",
                    STANDARD_LEG_AXIS: "C-2.8", CALCULATION_LEG_MALFORMED: "C-2.8", OCCURRENCE_LEG_MALFORMED: "C-2.8",
                    DERIVED_LEG_MALFORMED: "C-2.8", CUTTING_LEG_IN_GROUND: "C-2.8", BIAS_APPLICATION_MALFORMED: "C-2.8" };
  assert.deepEqual(Object.keys(INQUIRY_GRAMMAR_CHECKS), Object.keys(numbers), "the thirteen rows, in R7's order");
  const imported = INQUIRY_GRAMMAR_CHECKS.IMPORTED_LEG_MALFORMED;
  assert.deepEqual(Object.keys(imported), ["check", "where", "translation"]);
  assert.equal(imported.check, "C-21.3");
  assert.equal(imported.translation, word("refusal.IMPORTED_LEG_MALFORMED"));
  assert.equal(imported.where, "src/inquiry-grammar/grammar.mjs importedRefusal > is-imported-leg-form");
  for (const [k, row] of Object.entries(INQUIRY_GRAMMAR_CHECKS)) {
    assert.deepEqual(Object.keys(row), ["check", "where", "translation"], k);
    assert.equal(row.check, numbers[k], k);
    if (!(k in GOLDEN.rows) && !(k in GOLDEN.LEAD_CHECKS)) continue;   // new since the move: R11's above, R16's in t33 and t34, R18's in t41
    const was = k === "LEAD_NOT_EVIDENCE" ? GOLDEN.LEAD_CHECKS[k] : GOLDEN.rows[k];
    assert.equal(row.translation, was.translation, k);
    if (k !== "LEAD_NOT_EVIDENCE") assert.equal(row.where, was.where, k);
  }
  assert.equal(INQUIRY_GRAMMAR_CHECKS.LEAD_NOT_EVIDENCE, LEAD_CHECKS.LEAD_NOT_EVIDENCE, "one row, not a copy");
  /* the table goes by its `_CHECKS` name alone: the old name `INQUIRY_GRAMMAR_ROWS` is retired from both faces (N452),
     and DEC-49 composition finds the module's families by the suffix */
  const CHECKS = await import("../../../src/inquiry-grammar/checks.mjs");
  for (const face of [IG, CHECKS]) assert.ok(!("INQUIRY_GRAMMAR_ROWS" in face), "the old name is retired");
  assert.deepEqual(Object.keys(CHECKS).filter((k) => /_CHECKS$/.test(k)).sort(), ["INQUIRY_GRAMMAR_CHECKS", "LEAD_CHECKS"]);
  assert.equal(LEAD_CHECKS.LEAD_NOT_EVIDENCE.where, "src/inquiry-grammar/grammar.mjs leadLegFindings > is-lead-not-evidence");
  /* the finding carries its row: the code is the row's key, the check its number */
  const r = run((f) => leadLegFindings("basis leg 0", { content_id: "LEAD-2026-0101-abc" }, f)).findings[0];
  assert.equal(r.check, INQUIRY_GRAMMAR_CHECKS[r.code].check);
  const i = run((f) => IG.importedLegFindings("basis leg 0", { target: IG.importedFindingRef("c".repeat(64), INFO) }, f)).findings[0];
  assert.equal(i.check, INQUIRY_GRAMMAR_CHECKS[i.code].check);
});

test("R8 the invariants: each check the module holds is raised through its interface (C-2.8, C-21.2, C-6.1, C-6.3, C-15.1, C-54.1, C-21.3) and each row it holds is present (C-33.13, C-33.22, C-33.23, C-32.7, C-32.8, C-21.3)", async () => {
  const raised = new Set();
  for (const id of [...Object.keys(BUNDLE_CASES), ...Object.keys(IMPORTED_BUNDLE_CASES)]) for (const v of VARIANTS)
    for (const x of await judge(id, v, INQUIRY_GRAMMARS)) raised.add(x.check);
  for (const c of ["C-2.8", "C-21.2", "C-6.1", "C-6.3", "C-15.1", "C-54.1", "C-21.3"]) assert.ok(raised.has(c), c);
  const rows = new Set(Object.values(INQUIRY_GRAMMAR_CHECKS).map((r) => r.check));
  for (const c of ["C-33.13", "C-33.22", "C-33.23", "C-32.7", "C-32.8", "C-54.1", "C-21.3"]) assert.ok(rows.has(c), c);
});

test("R9 pure: the same inputs give the same findings, nothing handed in is changed, and no clock or network is read", async () => {
  const realNow = Date.now, realFetch = globalThis.fetch;
  Date.now = () => { throw new Error("the clock was read"); };
  globalThis.fetch = () => { throw new Error("the network was used"); };
  try {
    const freeze = (o) => { if (o && typeof o === "object") { Object.values(o).forEach(freeze); Object.freeze(o); } return o; };
    for (const [name, legs] of Object.entries(LEG_CASES)) {
      const fm = freeze(structuredClone(legFm(name, legs)));
      const pub = freeze(structuredClone(PUBLISHED)), earned = freeze(structuredClone(EARNED));
      const once = sync((f) => checkInquiryBasis(fm, f, pub, earned)), twice = sync((f) => checkInquiryBasis(fm, f, pub, earned));
      assert.deepEqual(once, twice, name);
      assert.deepEqual(fm, legFm(name, legs), name);
      const ctx = freeze({ fm, publishedRegistry: pub, earnedRegistry: earned });
      assert.deepEqual(sync((f) => checkInquiryExtension(ctx, f)), sync((f) => checkInquiryExtension(ctx, f)));
      assert.deepEqual(sync((f) => checkRecheckCoverage(ctx, f)), sync((f) => checkRecheckCoverage(ctx, f)));
      assert.deepEqual(sync((f) => checkSupersession(ctx, f)), sync((f) => checkSupersession(ctx, f)));
    }
  } finally { Date.now = realNow; globalThis.fetch = realFetch; }
});

test("R10 no place: no finding the corpus raises, and no row's translation, names a place", async () => {
  const PLACES = /\b(oakland|alameda|berkeley|california|san francisco|bay area|sacramento|los angeles|new york|port of)\b/i;
  const texts = Object.values(INQUIRY_GRAMMAR_CHECKS).map((r) => r.translation);
  for (const id of Object.keys(BUNDLE_CASES)) for (const v of VARIANTS)
    for (const x of await judge(id, v, INQUIRY_GRAMMARS)) texts.push(x.message, ...(x.repairs || []));
  for (const [name, legs] of Object.entries(LEG_CASES))
    for (const x of sync((f) => checkInquiryBasis(legFm(name, legs), f, PUBLISHED, EARNED))) texts.push(x.message, ...(x.repairs || []));
  assert.ok(texts.length > 200);
  for (const t of texts) assert.ok(!PLACES.test(t), t);
});

test("R1 is every inquiry of the corpus judged (the corpus covers each state)", () => {
  const states = new Set(inquiries.map((id) => (typeof BUNDLE_CASES[id] === "object" ? BUNDLE_CASES[id].current_state : null) || "open"));
  for (const s of ["open", "deferred", "dismissed", "concluded", "divided", "surfaced"]) assert.ok(states.has(s), s);
});
