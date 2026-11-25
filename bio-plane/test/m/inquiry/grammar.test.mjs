/* inquiry's grammar at its public face (`src/inquiry/grammar.mjs`): the machine, the entry requirements, the leg
   grammar with its earned, inherited and ground arms, supersession and the division disclosure, the title rule, and the
   rows the module's refusals carry. Pure functions, driven with documents and legs. */
import test from "node:test";
import assert from "node:assert/strict";
import { INQUIRY_MACHINE, BASIS_ROLES, checkInquiryBasis, checkInquiryEntry, checkLegExtentGrammar, leadLegFindings,
         supersedesEdgeFindings, divisionDisclosureFindings, deriveInquiryTitle, inquiryQuestionOf, INQUIRY_ROWS,
         GROUND_LABEL_RE } from "../../../src/inquiry/index.mjs";
import { inquiryMd } from "./fixture.mjs";

const errs = (fn) => { const f = []; fn(f); return f.filter((x) => x.severity === "error"); };
const basisErrs = (fm, pub = null, earned = null) => errs((f) => checkInquiryBasis(fm, f, pub, earned));
const INFO = "INFO-2026-0001-a", INFO2 = "INFO-2026-0002-b", INQ = "INQ-2026-0003-c";
const fmWith = (legs, extra = {}) => ({ id: "INQ-2026-0009-z", object_type: "inquiry",
  references: [...new Set(legs.map((l) => l.target))].map((t) => ({ target: t, rel: "cites", status: "confirmed" })),
  basis: legs, ...extra });

test("R1 the machine: open/surfaced to deferred, dismissed, concluded or divided; divided terminal; published never entered", () => {
  const E = INQUIRY_MACHINE.edges;
  for (const s of ["open", "surfaced"]) for (const t of ["deferred", "dismissed", "concluded", "divided"]) assert.ok(E[s].includes(t), `${s}->${t}`);
  for (const s of ["deferred", "dismissed"]) {
    for (const t of ["open", "surfaced"]) assert.ok(E[s].includes(t), `${s}->${t}`);
    assert.ok(E[s].includes(s === "deferred" ? "dismissed" : "deferred"));
    assert.ok(!E[s].includes(s), "a move to the state a document is in is not an edge");
    assert.ok(!E[s].includes("concluded") && !E[s].includes("divided"));
  }
  for (const t of ["open", "surfaced", "deferred", "dismissed", "divided"]) assert.ok(E.concluded.includes(t), `concluded->${t}`);
  assert.deepEqual(E.divided, [], "divided is terminal");
  for (const s of Object.keys(E)) assert.ok(!E[s].includes("published"), `published is never entered from ${s}`);
  assert.deepEqual(BASIS_ROLES, ["supports", "cuts_against"]);
});

test("R2 entry requirements: surfaced_by, a disposition's reason, a conclusion's leg and falsifier, the subject's shape", async () => {
  const bad = async (md, needle) => {
    const f = await checkInquiryEntry(md);
    assert.ok(f.some((x) => x.check === "C-2.8" && (!needle || x.message.includes(needle))),
              `expected a C-2.8 finding${needle ? ` naming ${needle}` : ""}: ${JSON.stringify(f.map((x) => x.message)).slice(0, 600)}`);
  };
  const ok = await checkInquiryEntry(inquiryMd("INQ-2026-0009-z"));
  assert.deepEqual(ok.filter((x) => x.check === "C-2.8"), [], "an open inquiry with its fields passes");
  await bad(inquiryMd("INQ-2026-0009-z").replace("surfaced_by: human", "surfaced_by: robot"), "surfaced_by");
  await bad(inquiryMd("INQ-2026-0009-z", { state: "deferred", disposition: '""' }), "disposition_reason");
  await bad(inquiryMd("INQ-2026-0009-z", { state: "dismissed", disposition: '""' }), "disposition_reason");
  const concluded = (extra) => inquiryMd("INQ-2026-0009-z", { state: "concluded", extra });
  await bad(concluded(['conclusion: ""', 'falsifier: "x"']), "conclusion");
  await bad(concluded(['conclusion: "it is"', 'falsifier: "x"']), "leg");
  await bad(inquiryMd("INQ-2026-0009-z", { state: "concluded", legs: [{ target: INFO }],
    extra: ['conclusion: "it is"', 'falsifier: ""'] }), "falsifier");
  /* REC-117: the absence of a falsifier recorded by both fields, never half */
  await bad(inquiryMd("INQ-2026-0009-z", { state: "concluded", legs: [{ target: INFO }],
    extra: ['conclusion: "it is"', 'falsifier: ""', 'falsifier_override_by: member:alice'] }), "override");
  const overridden = await checkInquiryEntry(inquiryMd("INQ-2026-0009-z", { state: "concluded", legs: [{ target: INFO }],
    extra: ['conclusion: "it is"', 'falsifier: ""', 'falsifier_override_by: member:alice', 'falsifier_override_at: "2026-09-27T00:00:00Z"'] }));
  assert.ok(!overridden.some((x) => /falsifier/.test(x.message)), "a recorded absence with both fields is accounted for");
  await bad(inquiryMd("INQ-2026-0009-z", { subject: "not-an-entity" }), "subject_entity");
});

test("R3 divided: a division block (reason, a named apportioner, an ISO at, two children) and every leg homed", async () => {
  const legs = [{ target: INFO }, { target: INFO2, role: "cuts_against" }];
  const div = (division, rows) => inquiryMd("INQ-2026-0009-z", { state: "divided", legs, extra: [...division, ...rows] });
  const good = ["division:", '  reason: "two questions"', "  apportioned_by: member:alice", '  at: "2026-09-27T00:00:00Z"',
                "  into: [INQ-2026-0010-a, INQ-2026-0011-b]"];
  const rows = ["division_apportionment:", "  - ord: 0", `    target: ${INFO}`, "    role: supports", "    to: INQ-2026-0010-a",
                "  - ord: 1", `    target: ${INFO2}`, "    role: cuts_against", "    to: INQ-2026-0011-b"];
  const f0 = await checkInquiryEntry(div(good, rows));
  assert.deepEqual(f0.filter((x) => /divi|apportion/i.test(x.message)), [], JSON.stringify(f0.map((x) => x.message)));
  const has = async (md, re) => { const f = await checkInquiryEntry(md); assert.ok(f.some((x) => re.test(x.message)), `${re}: ${JSON.stringify(f.map((x) => x.message)).slice(0, 500)}`); };
  await has(inquiryMd("INQ-2026-0009-z", { state: "divided", legs }), /division/);
  await has(div(good.map((l) => l.replace("member:alice", "class:daemon")), rows), /apportioned_by|machine/);
  await has(div(good.map((l) => l.replace("[INQ-2026-0010-a, INQ-2026-0011-b]", "[INQ-2026-0010-a]")), rows), /two|children|at least/);
  await has(div(good, rows.slice(0, 5)), /apportion|home|leg/);
  await has(div(good, rows.map((l) => l.replace(`target: ${INFO2}`, `target: ${INFO}`))), /target|apportion/);
});

test("R4 a leg: canonical target in references, vocabularies, graded legs name axis and source, hunch, testimony D; a lead or a theme refused by name first", () => {
  assert.equal(basisErrs(fmWith([{ target: INFO, role: "supports" }])).length, 0);
  assert.ok(basisErrs(fmWith([{ target: "not-an-id", role: "supports" }])).some((x) => /canonical/.test(x.message)));
  const notReferenced = { ...fmWith([{ target: INFO, role: "supports" }]), references: [] };
  assert.ok(basisErrs(notReferenced).some((x) => x.check === "C-6.3" || /references/.test(x.message)), "C-6.3");
  assert.ok(basisErrs(fmWith([{ target: INFO, role: "maybe" }])).length);
  assert.ok(basisErrs(fmWith([{ target: INFO, role: "supports", grade: "E", grade_axis: "connection", grade_source: "hunch", author: "member:a", date: "2026-09-27" }])).length);
  assert.ok(basisErrs(fmWith([{ target: INFO, role: "supports", grade: "C" }])).length, "a graded leg names its axis and source");
  assert.ok(basisErrs(fmWith([{ target: INFO, role: "supports", grade_axis: "connection", grade_source: "hunch" }])).length, "a source with no grade is refused");
  assert.ok(basisErrs(fmWith([{ target: INQ, role: "supports", grade: "B", grade_axis: "capture", grade_source: "capture" }])).length, "a capture grade on an inquiry leg");
  assert.ok(basisErrs(fmWith([{ target: INFO, role: "supports", grade: "C", grade_axis: "connection", grade_source: "hunch" }])).length, "a hunch names its author and date");
  assert.equal(basisErrs(fmWith([{ target: INFO, role: "supports", grade: "C", grade_axis: "connection", grade_source: "hunch", author: "member:a", date: "2026-09-27" }])).length, 0);
  assert.ok(basisErrs(fmWith([{ target: INFO, role: "supports", grade: "C", grade_axis: "testimony", grade_source: "testimony" }]), null,
    { earned: { connection: {}, capture: {}, testimony: { [INFO]: { grade: "D", mode: "value" } } } }).length, "testimony is D and no other");
  const lead = errs((f) => checkInquiryBasis(fmWith([{ target: "LEAD-2026-0001-abc", role: "supports" }]), f, null, null));
  assert.equal(lead[0].check, "C-54.1", "a lead is refused by name before any other complaint");
  assert.equal(lead.length, 1);
  const theme = errs((f) => checkInquiryBasis(fmWith([{ target: "THEME-2026-0927-abcd", role: "supports" }]), f, null, null));
  assert.equal(theme[0].check, "C-81.1", "a theme is refused by name first");
});

test("R5 a leg's part: a content id of 64 lowercase hex, never both a content id and an extent", () => {
  const e = (leg) => errs((f) => checkLegExtentGrammar(leg, "basis[0]", "C-2.8", f));
  assert.equal(e({ target: INFO, content_id: "a".repeat(64) }).length, 0);
  assert.ok(e({ target: INFO, content_id: "A".repeat(64) }).length);
  assert.ok(e({ target: INFO, content_id: "abc" }).length);
  assert.ok(e({ target: INFO, content_id: "a".repeat(64), extent_kind: "pdf-page", extent_page: 0 }).length);
  assert.ok(e({ target: INFO, extent_kind: "dom" }).length, "judged by the content extent grammar");
});

test("R6 earned arms: testimony only where the registry holds an authored observation; resolution and capture never above earned; an unreadable registry refuses", () => {
  const leg = (grade, axis, source, extra = {}) => fmWith([{ target: INFO, role: "supports", grade, grade_axis: axis, grade_source: source, ...extra }], { subject_entity: "ENT-2026-0001" });
  const reg = { subject_entity: "ENT-2026-0001", earned: { connection: { [INFO]: { grade: "B", mode: "value" } },
                                                         capture: { [INFO]: { grade: "B", mode: "ceiling" } } } };
  assert.equal(basisErrs(leg("B", "connection", "resolution"), null, reg).length, 0);
  assert.ok(basisErrs(leg("A", "connection", "resolution"), null, reg).length, "a resolution grade above what is earned");
  assert.ok(basisErrs(leg("C", "connection", "resolution"), null, reg).length, "a resolution grade states the earned letter and no other");
  assert.equal(basisErrs(leg("C", "capture", "capture"), null, reg).length, 0, "a capture grade under the ceiling stands");
  assert.ok(basisErrs(leg("A", "capture", "capture"), null, reg).length, "above the ceiling is refused");
  const undetermined = { ...reg, earned: { ...reg.earned, capture: { [INFO]: { grade: null, mode: "ceiling" } } } };
  assert.ok(basisErrs(leg("C", "capture", "capture"), null, undetermined).length, "an undetermined ceiling refuses any capture grade");
  assert.ok(basisErrs(leg("D", "testimony", "testimony"), null, reg).length, "testimony on a target the registry holds as no observation");
  assert.ok(basisErrs(leg("B", "connection", "resolution"), null, null).length, "a registry that cannot be read refuses the earned leg");
  const noSubject = fmWith([{ target: INFO, role: "supports", grade: "B", grade_axis: "connection", grade_source: "resolution" }]);
  assert.ok(basisErrs(noSubject, null, { subject_entity: null, earned: { connection: {}, capture: {} } }).length,
            "a resolution needs a subject_entity");
  assert.ok(basisErrs(fmWith([{ target: INQ, role: "supports", grade: "B", grade_axis: "connection", grade_source: "resolution" }],
    { subject_entity: "ENT-2026-0001" }), null, reg).length, "a resolution never sits on an inquiry leg");
});

test("R7 an inherited leg rests on a published case at an edition the registry holds, no stronger than its frozen strength", () => {
  /* the published registry as the check reads it: each edition's axes, each {state, grade} */
  const pub = { [INQ]: { object_type: "inquiry", editions: { 1: { capture: { state: "graded", grade: "C" },
                                                                 connection: { state: "graded", grade: "C" } } } } };
  const fm = (extra) => fmWith([{ target: INQ, role: "supports", grade_source: "inherited", target_edition: 1, ...extra }]);
  assert.deepEqual(basisErrs(fm({ grade: "C", grade_axis: "connection" }), pub), [], "the frozen grade itself is inherited");
  assert.deepEqual(basisErrs(fm({ grade: "D", grade_axis: "capture" }), pub), [], "a weaker one too");
  const over = basisErrs(fm({ grade: "A", grade_axis: "connection" }), pub);
  assert.deepEqual(over.map((x) => x.check), ["C-21.2"]);
  assert.match(over[0].message, /whose frozen connection strength is C/);
  assert.ok(basisErrs(fm({ target_edition: 9 }), pub).length, "an edition the registry does not hold");
  assert.ok(basisErrs(fmWith([{ target: INFO, role: "supports", grade_source: "inherited" }]), pub).length, "inherited rests on a published case");
});

test("R8 grounds: a supporting leg may name a ground or be necessary beside them; each label declared once by a named member at an ISO instant; none empty", () => {
  const legs = [{ target: INFO, role: "supports", ground: "g1" }, { target: INFO2, role: "supports", ground: "g2" }];
  const g = [{ ground: "g1", asserted_by: "member:alice", at: "2026-09-27T00:00:00Z" }, { ground: "g2", asserted_by: "member:alice", at: "2026-09-27T00:00:00Z" }];
  assert.equal(basisErrs(fmWith(legs, { grounds: g })).length, 0);
  assert.equal(basisErrs(fmWith([legs[0], { target: INFO2, role: "supports" }], { grounds: [g[0]] })).length, 0,
    "an unlabelled supporting leg beside a labelled ground is a necessary leg (inquiry-grammar R68)");
  assert.ok(basisErrs(fmWith([legs[0], { target: INFO2, role: "cuts_against", ground: "g1" }], { grounds: [g[0]] })).length,
    "control: a leg that cuts against never names a ground");
  assert.ok(basisErrs(fmWith(legs, { grounds: [g[0]] })).length, "an undeclared label");
  assert.ok(basisErrs(fmWith(legs, { grounds: [g[0], g[1], g[1]] })).length, "a label declared twice");
  assert.ok(basisErrs(fmWith(legs, { grounds: [g[0], { ...g[1], asserted_by: "class:daemon" }] })).length, "a machine asserter");
  assert.ok(basisErrs(fmWith(legs, { grounds: [g[0], { ...g[1], at: "yesterday" }] })).length, "an undated assertion");
  assert.ok(basisErrs(fmWith(legs, { grounds: [...g, { ground: "g3", asserted_by: "member:alice", at: "2026-09-27T00:00:00Z" }] })).length, "an empty ground");
  assert.ok(basisErrs(fmWith(legs, { grounds: [g[0], { ...g[1], statement: 7 }] })).length, "a statement is a string");
  assert.ok(GROUND_LABEL_RE.test("g1") && !GROUND_LABEL_RE.test('a"b'));
});

test("R9 supersedes names a canonical target and a reason; a child names its parent and at least one sibling, never the parent or itself", () => {
  assert.equal(errs((f) => supersedesEdgeFindings({ references: [{ target: INQ, rel: "supersedes", reason: "split" }] }, f)).length, 0);
  assert.ok(errs((f) => supersedesEdgeFindings({ references: [{ target: INQ, rel: "supersedes" }] }, f)).length, "no reason");
  assert.ok(errs((f) => supersedesEdgeFindings({ references: [{ target: "nope", rel: "supersedes", reason: "r" }] }, f)).length, "not canonical");
  const child = (extra) => ({ id: "INQ-2026-0010-a", object_type: "inquiry", references: [{ target: INQ, rel: "supersedes", reason: "r" }], ...extra });
  assert.equal(errs((f) => divisionDisclosureFindings(child({ division_parent: INQ, division_siblings: ["INQ-2026-0011-b"] }), f)).length, 0);
  assert.ok(errs((f) => divisionDisclosureFindings(child({}), f)).length, "no division_parent");
  assert.ok(errs((f) => divisionDisclosureFindings(child({ division_parent: INQ, division_siblings: [] }), f)).length, "no sibling");
  assert.ok(errs((f) => divisionDisclosureFindings(child({ division_parent: INQ, division_siblings: [INQ] }), f)).length, "the parent as a sibling");
  assert.ok(errs((f) => divisionDisclosureFindings(child({ division_parent: INQ, division_siblings: ["INQ-2026-0010-a"] }), f)).length, "itself");
  assert.ok(errs((f) => divisionDisclosureFindings(child({ division_parent: "INQ-2026-0012-x", division_siblings: ["INQ-2026-0011-b"] }), f)).length, "a parent without that edge");
});

test("R10 the title is the question's first non-empty line, folded, cut at a word under 120 with an ellipsis; the question section", () => {
  assert.equal(deriveInquiryTitle("\n\n  Who   paid\tfor it?  \nmore"), "Who paid for it?");
  assert.equal(deriveInquiryTitle("   \n "), null);
  const long = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ");
  const t = deriveInquiryTitle(long);
  assert.ok(t.length <= 120 && t.endsWith("…") && long.startsWith(t.slice(0, -1).trimEnd()), t);
  assert.equal(inquiryQuestionOf(inquiryMd("INQ-2026-0009-z", { question: "What changed?" })).trim(), "What changed?");
  assert.equal(inquiryQuestionOf("---\nid: x\n---\n\n## Other\n\nno\n"), "");
});

test("R38 R4 the rows the module mints are inquiry-grammar's, read with their ids: C-54.1, C-33.13, C-33.22, C-33.23, C-32.7, C-32.8, C-21.3 for a leg on an imported finding (N522), and the four C-2.8 rows of the new leg kinds, the derived connection's among them (inquiry-grammar R16; K1608; T34-28), and R18's bias application (T41; K2491)", () => {
  assert.deepEqual(Object.fromEntries(Object.entries(INQUIRY_ROWS).map(([k, r]) => [k, r.check])), {
    LEAD_NOT_EVIDENCE: "C-54.1", NOT_INQUIRIES: "C-33.13", SELF_BASIS: "C-33.22", BASIS_CYCLE: "C-33.23",
    MACHINE_CANNOT_DIVIDE: "C-32.7", MACHINE_CANNOT_GROUND: "C-32.8", IMPORTED_LEG_MALFORMED: "C-21.3",
    STANDARD_LEG_AXIS: "C-2.8", CALCULATION_LEG_MALFORMED: "C-2.8", OCCURRENCE_LEG_MALFORMED: "C-2.8",
    DERIVED_LEG_MALFORMED: "C-2.8", BIAS_APPLICATION_MALFORMED: "C-2.8" });
  for (const r of Object.values(INQUIRY_ROWS)) assert.ok(typeof r.translation === "string" && r.translation.length > 20);
  const f = []; assert.equal(leadLegFindings("basis[0]", { target: "LEAD-2026-0001-abc" }, f), true);
  assert.equal(f[0].check, "C-54.1");
});

/* R31 (MK-5) is NOT YET MET, deferred by K181: no module defines an opinion element or its id yet, so there is
   nothing a refusal could name. Its test arrives with the element (case-authoring or publication). */
test.todo("R31 a leg naming an opinion case element is refused by name (not yet met: MK-5; no module defines an opinion element or its id yet, K181)");

test("R4 R5 R8 R9 R38 the grammar face re-exports inquiry-grammar's and record-grammar's names as the same bindings, and reads inquiry-grammar's rows, never a copy", async () => {
  const face = await import("../../../src/inquiry/index.mjs");
  const IG = await import("../../../src/inquiry-grammar/index.mjs");
  const RG = await import("../../../src/record-grammar/index.mjs");
  for (const n of ["checkInquiryBasis", "checkLegExtentGrammar", "leadLegFindings", "supersedesEdgeFindings",
                   "divisionDisclosureFindings", "GROUND_LABEL_RE", "checkInquiryExtension"])
    assert.equal(face[n], IG[n], n);
  for (const n of ["BASIS_ROLES", "INQUIRY_TITLE_MAX", "deriveInquiryTitle", "inquiryQuestionOf"]) assert.equal(face[n], RG[n], n);
  assert.equal(face.INQUIRY_MACHINE, RG.STATES.inquiry);
  assert.equal(INQUIRY_ROWS, IG.INQUIRY_GRAMMAR_CHECKS, "R38: inquiry-grammar's rows, read");
  for (const code of ["NOT_INQUIRIES", "SELF_BASIS", "BASIS_CYCLE", "MACHINE_CANNOT_DIVIDE", "MACHINE_CANNOT_GROUND", "LEAD_NOT_EVIDENCE"])
    assert.ok(INQUIRY_ROWS[code] && INQUIRY_ROWS[code].check && INQUIRY_ROWS[code].translation, code);
  /* R17: with no grammars named, the face judges with inquiry-grammar's own arms */
  const bad = inquiryMd("INQ-2026-0009-z").replace("surfaced_by: human", "surfaced_by: robot");
  assert.deepEqual(await checkInquiryEntry(bad), await checkInquiryEntry(bad, { grammars: IG.INQUIRY_GRAMMARS }));
  assert.ok((await checkInquiryEntry(bad)).some((x) => x.check === "C-2.8"));
  assert.ok(!(await checkInquiryEntry(bad, { grammars: [] })).some((x) => ["C-2.8", "C-6.1", "C-15.1"].includes(x.check)),
    "an empty list judges nothing of the inquiry's: it is the caller's list");
});
