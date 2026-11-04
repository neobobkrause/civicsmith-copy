/* case-catalogue at its interface (`bio-plane/src/case-catalogue/checks.mjs`): the case-document catalogue C-41 with the
   case arms of C-2.8, C-3.1 and C-21.1 (R1, R3, R4) and C-2.8's case-member arm with the pure vocabulary around it (R2).
   Copied from ratification's pure arms with their fixtures (K1824; seam read §5), re-labelled to this module's ids: each
   check is driven with its negative control, a document that draws no finding, and the one mutation that makes each arm
   fire. The copy of `isCaseMemberBytes` record-grammar keeps for C-3.1 (N69) is asserted to answer alike;
   `SUBJECT_POSITIONS` and `caseEditionClaimed` are this module's alone (N211). */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as R from "../../../src/case-catalogue/checks.mjs";
import * as RG from "../../../src/record-grammar/index.mjs";
import { isNoticeReference, CASE_DOCUMENT_FORMAT, CASE_DOCUMENT_FORMAT_V6, CASE_DOCUMENT_FORMAT_V7, CASE_DOCUMENT_FORMAT_V8, CASE_DOCUMENT_FORMAT_V9, CASE_DOCUMENT_FORMATS_ACCEPTED,
         passagesLines, gradingFactsLines, ungradedPassagesLines, typedPassagesLines } from "../../../src/case-grammar/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { word, localize } from "../../../src/setup-words/index.mjs";


const PIN = "a".repeat(64);
const M1 = "INQ-2026-0001-first", M2 = "INQ-2026-0002-second";

/* A bio-case-document/5 (the format op=publish authors; T17's finding) that draws no finding: every field the catalogue asks of a case document, and each member's
   frozen blocks as rule 12 states them (the case-member arm of C-2.8 runs over those). */
function doc() {
  return {
    format: "bio-case-document/5",
    case_id: "CASE-2026-0001", case_edition: 2, case_project: "PROJ-2026-0001-watch",
    case_scope: "whether the permits were issued as the minutes say",
    bias_acknowledgement: "we set out expecting the permits were late",
    case_findings: [M1, M2],
    case_roles: [{ target: M1, role: "load_bearing", version_sha: PIN, edition: 1 },
                 { target: M2, role: "supporting", version_sha: "b".repeat(64), edition: 3 }],
    completeness: { statement: "the 2019 permits are not covered", author: "alice", at: "2026-09-28T00:00:00Z",
                    subject_position: "not_sought", subject_justification: "the office is closed until October",
                    acknowledged: 1, statement_by: "bob" },
    completeness_acknowledgements: [{ kind: "participant", by: "carol", at: "2026-09-27T00:00:00Z" }],
    completeness_excluded: [{ target: null, description: "the 2019 permits", reason: "not yet requested" }],
    searched: { subject_source: "case_basis", subjects: 2 }, searched_levels: [],
    required_strength: { declared: true, capture: "B", connection: null },
    bias_manifest: { in_force: false, stated: word("bias.manifest_force"), pins_proposed: 0,
                     pins_proposed_stated: "no adoption pinned a proposed revision" },
    bias_manifest_bundles: [], bias_manifest_pins_proposed: [],
    case_citations: [{ target: "INFO-2026-0001-minutes", version: "pinned", capture: "c".repeat(64) },
                     { target: "INFO-2026-0002-memo", version: "undetermined", capture: null }],
    case_strength: [M1, M2].flatMap((t) => [{ target: t, axis: "capture", state: "graded", grade: "B" },
                                            { target: t, axis: "connection", state: "unrated", grade: null }]),
    case_strength_grounds: [], case_tensions: [], case_tension_sentences: [], case_tensions_unread: [],
  };
}
const CTX = { caseId: "CASE-2026-0001", edition: 2 };
const BODY = "# Case\n\n## What This Excludes\n\nthe 2019 permits\n\n## What Changed in This Edition, and Why\n\nThe 2019 permits were added.\n";
const NO_WC = "# Case\n\n## What This Excludes\n\nthe 2019 permits\n";
const checks = (fm, ctx = CTX) => R.checkCaseDocument(fm, ctx).map((x) => x.check);
const fires = (mutate, check, ctx = CTX) => R.checkCaseDocument(mutate(doc()), ctx).some((x) => x.check === check);

/* The nineteen arms of C-41, each with the one mutation that fires it (casesign's list, extended to every arm). The
   format token no longer accepted is /11, since case-grammar PR 202 (R35) made /10 the format in force. */
const ARMS = [
  ["FORMAT", "C-41.1", (d) => { d.format = "bio-case-document/11"; return d; }],
  ["IDENTITY", "C-41.2", (d) => { d.case_id = "CASE-2026-9999"; return d; }],
  ["EDITION", "C-41.3", (d) => { d.case_edition = 7; return d; }],
  ["PROJECT", "C-41.4", (d) => { d.case_project = "null"; return d; }],
  ["SCOPE", "C-41.5", (d) => { d.case_scope = " "; return d; }],
  ["BIAS", "C-41.6", (d) => { d.bias_acknowledgement = ""; return d; }],
  ["ROSTER", "C-41.7", (d) => { d.case_findings = []; return d; }, ["C-41.8"]],   /* the roles now name non-members */
  ["ROLES", "C-41.8", (d) => { d.case_roles = d.case_roles.map((r) => ({ ...r, role: "supporting" })); return d; }],
  ["PINS", "C-41.9", (d) => { d.case_roles[0].version_sha = "short"; return d; }],
  ["COMPLETENESS", "C-41.10", (d) => { d.searched.subject_source = "observation_log"; return d; }],
  ["EXCLUDED", "C-41.11", (d) => { delete d.completeness_excluded; return d; }, ["C-2.8"]],   /* and each member's copy of it */
  ["BAR", "C-41.12", (d) => { d.required_strength = { declared: true, capture: null, connection: null }; return d; }],
  ["DISCLOSURES", "C-41.13", (d) => { delete d.completeness.statement_by; return d; }],
  ["PENDING", "C-41.14", (d) => { d.bias_manifest.pins_proposed = 1; return d; }],
  ["CITATIONS", "C-41.15", (d) => { d.case_citations[0].capture = null; return d; }],
  /* asked only over a body: edition 2 with no "What changed" section */
  ["WHAT_CHANGED", "C-41.16", (d) => d, [], { ...CTX, body: NO_WC }],
  ["WORKING_ON", "C-41.17", (d) => { d.working_on = "not a notice"; return d; }],
  /* R7: a format before /10 carrying the key states what no reader would read */
  ["UNGRADED_PASSAGES_MISMATCH", "C-41.18", (d) => { d.ungraded_passages = []; return d; }],
  /* R8: a /10 document whose typed_passages block is a scalar */
  ["TYPED_PASSAGES_MISMATCH", "C-41.19", (d) => { d.format = CASE_DOCUMENT_FORMAT; d.typed_passages = '"x"'; return d; }],
];
/* The two arms whose question depends on the format the document declares (R7, R8): driven over their own formats. */
const FORMAT_BOUND = ["C-41.18", "C-41.19"];

test("R1: the baseline /5 case document draws no finding, with its body, member basis and a fresh prior edition; a /4 one, read as written, neither but C-41.16 (its format carries no What-changed statement)", () => {
  assert.deepEqual(checks(doc(), { ...CTX, body: BODY, memberBasis: { [M1]: [], [M2]: [] },
                                   priorCase: { edition: 1, statement: "older", bias_acknowledgement: "older" } }), []);
  const v4 = doc(); v4.format = "bio-case-document/4";
  for (const k of ["case_tensions", "case_tension_sentences", "case_tensions_unread"]) delete v4[k];
  assert.deepEqual(checks(v4, { ...CTX, body: BODY }), ["C-41.16"], "case-grammar reads no statement in a /4 edition 2");
  assert.deepEqual(checks({ ...v4, case_edition: 1 }, { ...CTX, edition: 1, body: BODY }), [], "edition 1 is not asked");
});

test("R1, R3, R4, R7, R8: each of C-41.1–C-41.19 is declared in CASE_DOCUMENT_FAMILY and fires on its own mutation, and the arms cover the family exactly", () => {
  for (const [key, num, mutate, also = [], ctx = CTX] of ARMS) {
    assert.equal(R.CASE_DOCUMENT_FAMILY[key].check, num);
    assert.equal(fires(mutate, num, ctx), true, `${num} fires`);
    assert.deepEqual(R.checkCaseDocument(mutate(doc()), ctx).filter((x) => x.check !== num && !also.includes(x.check)), [],
      `${num}'s mutation draws no other finding`);
  }
  assert.deepEqual(ARMS.map(([k]) => k).sort(), Object.keys(R.CASE_DOCUMENT_FAMILY).sort());
  assert.deepEqual(Object.values(R.CASE_DOCUMENT_FAMILY).map((v) => v.check),
    Array.from({ length: 19 }, (_, i) => `C-41.${i + 1}`));
});

test("R1: the case arms of C-2.8 (each member's frozen blocks, as the document states them), C-3.1 (the section) and C-21.1 (a statement or acknowledgement reprinted from the previous edition)", () => {
  const noPair = doc(); noPair.case_strength = noPair.case_strength.filter((r) => !(r.target === M2 && r.axis === "capture"));
  const c28 = R.checkCaseDocument(noPair, CTX).filter((x) => x.check === "C-2.8");
  assert.equal(c28.length, 1);
  assert.match(c28[0].message, new RegExp(`^case document, member ${M2}: `), "prefixed with the member it is about");
  assert.ok(checks((() => { const d = doc(); delete d.case_strength; return d; })()).includes("C-2.8"), "the field itself");
  assert.ok(checks((() => { const d = doc(); d.case_roles[1].edition = 0; return d; })()).includes("C-2.8"), "a member's edition");
  assert.deepEqual(checks(doc(), { ...CTX, body: "# Case\n\nno section\n\n## What Changed in This Edition, and Why\n\nx\n" }), ["C-3.1"]);
  assert.deepEqual(checks(doc(), { ...CTX, body: null }), [], "C-3.1 is asked only when the body is supplied");
  assert.deepEqual(checks(doc(), { ...CTX, priorCase: { edition: 1, statement: doc().completeness.statement,
                                                        bias_acknowledgement: doc().bias_acknowledgement } }),
    ["C-21.1", "C-21.1"]);
  const legacy = doc(); legacy.format = "bio-case-document/1"; delete legacy.case_strength;
  delete legacy.bias_manifest; delete legacy.case_citations; delete legacy.bias_manifest_pins_proposed;
  assert.deepEqual(checks(legacy, { ...CTX, body: "no section" }), ["C-41.16"],
    "a /1 document states no member blocks and is not asked them; as an edition 2 it states no change either");
});

test("R1, R4: C-41.16 — an edition above 1 with no \"What changed\" statement, a blank one, or one its block's hash disowns is refused with R1's translation word for word; edition 1 without one, and edition 2 with one, pass", () => {
  const msg = localize("case-catalogue.checks.a_new_edition_of_a", "A new edition of a case says what changed in it, and why, before it is signed. This one does not. Write the statement, then sign. Nothing was signed.");
  const wc = (body) => R.checkCaseDocument(doc(), { ...CTX, body }).filter((x) => x.check === "C-41.16");
  for (const body of [NO_WC, `${NO_WC}\n## What Changed in This Edition, and Why\n\n   \n`]) {
    const got = wc(body);
    assert.equal(got.length, 1);
    assert.deepEqual([got[0].severity, got[0].message], ["error", msg]);
  }
  const block = doc(); block.what_changed = { statement_sha: "0".repeat(64), began_as: "member", draft: null, adopted_as_drafted: null };
  assert.equal(R.checkCaseDocument(block, { ...CTX, body: BODY }).filter((x) => x.check === "C-41.16").length, 1,
    "a statement its block's hash disowns is no statement (case-grammar R8)");
  assert.deepEqual(wc(BODY), [], "edition 2 with a statement passes");
  const first = doc(); first.case_edition = 1;
  assert.deepEqual(R.checkCaseDocument(first, { ...CTX, edition: 1, body: NO_WC }).map((x) => x.check), [], "edition 1 is not asked");
  assert.deepEqual(wc(null), [], "asked only when the body is supplied");
});

test("R1: an absent member basis leaves the basis arms unasked; a present one asks them (the testimony row)", () => {
  const leg = [{ target: "INFO-2026-0003-said", role: "supports", grade: "D", grade_axis: "testimony", grade_source: "testimony" }];
  assert.deepEqual(checks(doc(), { ...CTX, memberBasis: null }), []);
  assert.deepEqual(checks(doc(), { ...CTX, memberBasis: { [M2]: [] } }), [], "a member absent from the map is not asked");
  const asked = R.checkCaseDocument(doc(), { ...CTX, memberBasis: { [M1]: leg } });
  assert.deepEqual(asked.map((x) => [x.check, x.code]), [["C-2.8", "testimony-axis-unfrozen"]]);
});

test("R1: pure over any input, never throws, and each finding names its check", () => {
  for (const fm of [null, undefined, 3, "x", [], {}, { case_roles: "x", case_findings: {}, completeness: 7 },
                    { format: "bio-case-document/4", completeness_acknowledgements: [null, 4], bias_manifest: [] }]) {
    const out = R.checkCaseDocument(fm, { memberBasis: { [M1]: "not a list" } });
    assert.ok(Array.isArray(out) && out.length > 0);
    for (const x of out) assert.match(x.check, /^C-(41\.\d+|2\.8|3\.1|21\.1)$/);
  }
  assert.doesNotThrow(() => R.checkCaseDocument(doc()));
  const d = doc(); const before = JSON.stringify(d); R.checkCaseDocument(d, CTX); assert.equal(JSON.stringify(d), before);
});

test("R1: CASE_CITATION_VERSIONS and SEARCHED_SUBJECT_SOURCES are exported; C-41.10 refuses any source but case_basis", () => {
  assert.deepEqual(R.CASE_CITATION_VERSIONS, ["pinned", "only_capture", "undetermined", "no_capture", "no_bytes"]);
  assert.deepEqual(Object.keys(R.SEARCHED_SUBJECT_SOURCES), ["case_basis"]);
  for (const v of R.CASE_CITATION_VERSIONS) {
    const d = doc(); d.case_citations = [{ target: "INFO-2026-0001-x", version: v,
                                           capture: v === "pinned" || v === "only_capture" ? PIN : null }];
    assert.deepEqual(checks(d), [], `${v} with the capture exactly where it names one`);
  }
  for (const src of ["observation_log", "", undefined]) {
    const d = doc(); d.searched.subject_source = src;
    assert.deepEqual(checks(d), ["C-41.10"]);
  }
});

test("R3: C-41.17 refuses a present working_on that is not a notice id by case-grammar R10's rule, null and empty included, before any write; a notice id and an absent field pass", () => {
  const with_ = (v) => { const d = doc(); d.working_on = v; return d; };
  for (const v of ["NOTICE-2026-0001", "NOTE-2026-0042-permits-late", "WO-2026-0003-a-b"])
    assert.deepEqual(checks(with_(v), { ...CTX, body: BODY }), [], `${v} is a notice id`);
  assert.deepEqual(checks(doc(), { ...CTX, body: BODY }), [], "absent: the case names no notice");
  for (const v of [null, "null", undefined, "", " ", "notice-2026-0001", "NOTICE-26-1", "NOTICE-2026-0001-", "NOTICE-2026-0001-Upper", "PROJ 2026 0001",
                   "https://example.org/notice", 7, true, ["NOTICE-2026-0001"], { id: "NOTICE-2026-0001" }]) {
    const got = R.checkCaseDocument(with_(v), CTX);
    assert.deepEqual(got.map((x) => [x.check, x.severity]), [["C-41.17", "error"]], JSON.stringify(v));
    assert.match(got[0].message, /is not a notice id/);
  }
  /* the arm and case-grammar's predicate agree over every value asked above */
  for (const v of ["NOTICE-2026-0001", "x", 3]) assert.equal(fires((d) => { d.working_on = v; return d; }, "C-41.17"), !isNoticeReference(v));
});

/* N211 (T18): the catalogue's copies of `SUBJECT_POSITIONS` and `caseEditionClaimed` were deleted, every importer reading
   this module's, their owner (Decided 4, 6); the shared grammar below this module, record-grammar, holds neither and
   keeps `isCaseMemberBytes` for C-3.1's heading rule (N69). */
test("R2, N211: SUBJECT_POSITIONS and caseEditionClaimed are this module's alone; the shared grammar does not export them", () => {
  assert.equal(RG.SUBJECT_POSITIONS, undefined);
  assert.equal(RG.caseEditionClaimed, undefined);
  assert.equal(typeof RG.isCaseMemberBytes, "function", "negative control: the copy C-3.1 reads is found there");
  assert.deepEqual(R.SUBJECT_POSITIONS, ["sought_and_answered", "sought_no_answer", "not_sought"]);
});

/* A legacy (/1) case member's own bytes: the frozen blocks C-2.8's case-member arm requires. */
function member() {
  return { id: M1, object_type: "inquiry", edition: 1,
           completeness: { statement: "s", author: "alice", at: "2026-09-28T00:00:00Z", subject_position: "sought_no_answer",
                           subject_justification: "asked twice" },
           completeness_excluded: [],
           published_strength: [{ axis: "capture", state: "graded", grade: "C" }, { axis: "connection", state: "undetermined", grade: null }] };
}
const armOf = (fm) => R.caseMemberFindings(fm).map((x) => x.check);

test("R2: checkPublishedExtension is C-2.8's case-member arm: a well-formed member draws nothing, and each block it requires is refused when missing or malformed", () => {
  assert.deepEqual(armOf(member()), []);
  const bad = [
    (m) => { m.edition = 0; }, (m) => { delete m.completeness; }, (m) => { m.completeness.statement = ""; },
    (m) => { m.completeness.author = ""; }, (m) => { m.completeness.at = "yesterday"; },
    (m) => { m.completeness.subject_position = "contacted"; }, (m) => { m.completeness.subject_justification = " "; },
    (m) => { delete m.completeness_excluded; }, (m) => { m.completeness_excluded = [{ reason: "x" }]; },
    (m) => { m.completeness_excluded = [{ description: "x" }]; },
    (m) => { m.published_strength.push({ axis: "capture", state: "unrated", grade: null }); },
    (m) => { m.published_strength[0].state = "strong"; }, (m) => { m.published_strength[0].grade = null; },
    (m) => { m.published_strength[1].grade = "A"; },
    (m) => { m.basis = [{ target: "INFO-2026-0001-x", role: "supports", grade: "A", grade_axis: "capture", ground: "g1" }]; },
    (m) => { m.basis = [{ target: "INFO-2026-0001-x", role: "supports", grade: "D", grade_axis: "testimony" }]; },
  ];
  for (const mutate of bad) {
    const m = member(); mutate(m);
    assert.ok(armOf(m).length >= 1 && armOf(m).every((c) => c === "C-2.8"), mutate.toString());
  }
  const out = []; R.checkPublishedExtension(member(), out); assert.deepEqual(out, [], "exported, and it appends to the list it is given");
});

test("R2: the arm is asked only of bytes isCaseMemberBytes answers true for, over a gate image and an audit image alike", () => {
  const unframed = member(); unframed.published_strength = []; unframed.edition = 0;
  assert.deepEqual(armOf(unframed), [], "a stray empty frozen block does not drag a working document into the ceremony");
  const md = (fm) => `---\nid: ${M1}\nobject_type: inquiry\nedition: ${fm.edition}\npublished_strength:\n`
    + fm.published_strength.map((a) => `  - axis: ${a.axis}\n    state: ${a.state}\n    grade: ${a.grade ?? "null"}\n`).join("")
    + "---\n\n# x\n";
  const parse = RG.parseFrontmatter;
  assert.deepEqual(R.caseMemberImageFindings({ "bundle.md": md(member()) }, parse).map((x) => x.check),
    ["C-2.8", "C-2.8"], "the completeness block and the exclusion field are missing from these bytes");
  assert.deepEqual(R.caseMemberImageFindings({ files: new Map([["bundle.md", md(member())]]) }, parse).length, 2);
  assert.deepEqual(R.caseMemberImageFindings({ "bundle.md": { blobSha: PIN } }, parse), [], "a blob is not read");
  const gate = { gateVersion: "g", ok: true, findings: [], warnings: 0 };
  const joined = R.withCaseMemberChecks({ "bundle.md": md(member()) }, gate, parse);
  assert.deepEqual([joined.ok, joined.findings.map((x) => x.check), joined.gateVersion], [false, ["C-2.8", "C-2.8"], "g"]);
  assert.equal(R.withCaseMemberChecks({ "bundle.md": "---\nid: x\n---\n" }, gate, parse), gate, "nothing to join: the gate's own answer");
});

test("R2: caseEditionClaimed, isCaseMemberBytes, completenessFields, biasAcknowledgementOf, CASE_MEMBER_ROLES and SUBJECT_POSITIONS are exported and pure", () => {
  assert.deepEqual(R.CASE_MEMBER_ROLES, ["load_bearing", "supporting"]);
  assert.deepEqual(R.SUBJECT_POSITIONS, ["sought_and_answered", "sought_no_answer", "not_sought"]);
  for (const [v, want] of [[undefined, false], [null, false], ["", false], ["null", false], [1, true], ["2", true]])
    assert.equal(R.caseEditionClaimed({ case_edition: v }), want, JSON.stringify(v));
  assert.equal(R.caseEditionClaimed(null), false);
  assert.equal(R.isCaseMemberBytes(member()), true);
  for (const s of [[], [{ axis: "capture" }], [{ axis: "capture" }, null], [{ axis: 1 }, { axis: "connection" }], "x", undefined])
    assert.equal(R.isCaseMemberBytes({ published_strength: s }), false, JSON.stringify(s));
  const three = [{ axis: "capture" }, { axis: "connection" }, { axis: "testimony" }];
  assert.equal(R.isCaseMemberBytes({ published_strength: three }), true, "a testimony axis keeps it a member (MK-2)");
  assert.deepEqual(R.completenessFields({ completeness: { statement: "s", subject_justification: "j", author: "a", at: "t" },
                                          completeness_excluded: [{ target: "INFO-2026-0001-x", description: "d", reason: "r" }, null] }),
    { statement: "s", subject_justification: "j", excluded: JSON.stringify([["INFO-2026-0001-x", "d", "r"], [null, "", ""]]) });
  assert.deepEqual(R.completenessFields(undefined), { statement: null, subject_justification: null, excluded: "[]" });
  assert.equal(R.biasAcknowledgementOf({ bias_acknowledgement: "b" }), "b");
  for (const v of [null, "null", 3, undefined]) assert.equal(R.biasAcknowledgementOf({ bias_acknowledgement: v }), null);
});

test("R2, N69: isCaseMemberBytes and the copy record-grammar keeps for C-3.1's heading rule answer alike over the case-member fixtures", () => {
  const cases = [member(), {}, null, { published_strength: [] }, { published_strength: [{ axis: "capture" }, { axis: "connection" }] },
                 { published_strength: [{ axis: "capture" }, { axis: 2 }] }, { published_strength: [null, null] },
                 { published_strength: [{ axis: "capture" }, { axis: "connection" }, { axis: "testimony" }] }];
  for (const fm of cases) assert.equal(R.isCaseMemberBytes(fm), RG.isCaseMemberBytes(fm), JSON.stringify(fm));
});



/* N538 (DEC-124; K1365 (1), K1367): `bio-case-document/7` is `/6` in every field (case-grammar R1), and the catalogue reads
   it as `/6`: the same findings by the same arms, each message naming the format the document declares. A `/6`
   document's messages are byte for byte those before T31, which named the then-current `/6` (the deployed copy may hold
   one). `bio-case-document/8` (T51-136) states what `/7` states, `/9` what `/8` states, and `/10` (the format in force,
   case-grammar PR 202, R35) what `/9` states with two blocks beside, so each is read as `/7` the same way (case-grammar
   R1). Every arm of the family but the two bound to the format (C-41.18, C-41.19; their own tests below) is driven over
   `/6` and every newer format, pinned by name, with the one mutation that fires it. */
test("R1, R4 (N538): a /7 case document is read as /6 and a /8, /9 or /10 one as /7: each draws no finding, each of C-41.1–C-41.17 fires on it as on the /6 twin, and every message names the format the document declares, a /6 one's unchanged", () => {
  const as = (fmt, d = doc()) => ({ ...d, format: fmt });
  const run = (d, ctx) => R.checkCaseDocument(d, ctx);
  const NEWER = [CASE_DOCUMENT_FORMAT_V7, CASE_DOCUMENT_FORMAT_V8, CASE_DOCUMENT_FORMAT_V9, CASE_DOCUMENT_FORMAT];
  for (const fmt of [CASE_DOCUMENT_FORMAT_V6, ...NEWER])
    assert.deepEqual(checks(as(fmt), { ...CTX, body: BODY, memberBasis: { [M1]: [], [M2]: [] } }), [], `${fmt}: the baseline`);
  for (const [key, num, mutate, also = [], ctx = { ...CTX, body: BODY }] of ARMS) {
    if (key === "FORMAT" || FORMAT_BOUND.includes(num)) continue;
    const six = run(mutate(as(CASE_DOCUMENT_FORMAT_V6)), ctx);
    assert.deepEqual([...new Set(six.map((x) => x.check))].sort(), [num, ...also].sort(), `${num} (and only what it drags) on the /6 document`);
    for (const fmt of NEWER) {
      assert.deepEqual(run(mutate(as(fmt)), ctx), six.map((x) => ({ ...x, message: x.message.replaceAll(CASE_DOCUMENT_FORMAT_V6, fmt) })),
        `${num}: the ${fmt} document draws the /6 document's findings, the token aside`);
    }
    for (const fmt of NEWER) assert.ok(!six.some((x) => x.message.includes(fmt)), `${num}: a /6 document is never told ${fmt}`);
  }
  /* byte identity for /6 with the messages as written before T31 (`a ${CASE_DOCUMENT_FORMAT} case document …`, /6 then) */
  const before = {
    "C-41.13": "a bio-case-document/6 case document requires completeness.statement_by, the member who WROTE its exclusion statement",
    "C-41.14": "a bio-case-document/6 case document's bias_manifest.pins_proposed says 1 and its bias_manifest_pins_proposed lists 0",
    "C-41.15": "a bio-case-document/6 case document's case_citations has 1 row(s) that do not state a target and a version",
  };
  for (const [key, num, mutate] of ARMS.filter(([, n]) => before[n])) {
    const [m] = run(mutate(as("bio-case-document/6")), CTX).filter((x) => x.check === num).map((x) => x.message);
    assert.ok(m.startsWith(before[num]), `${key}: ${m.slice(0, 120)}`);
  }
  /* an earlier format is named as itself, never as the current one: the sentence for the declared format, whole */
  for (const fmt of ["bio-case-document/3", "bio-case-document/4", "bio-case-document/5"]) {
    const [m] = run({ ...as(fmt), completeness: { ...doc().completeness, statement_by: undefined } }, CTX)
      .filter((x) => x.check === "C-41.13").map((x) => x.message);
    assert.equal(m, localize("case-catalogue.checks.a_declared_case_document_requires_5",
      "a {declared} case document requires completeness.statement_by, the member who WROTE its exclusion statement — a different act, and a different name, from completeness.author, who prepared and published the case (BIO_Publication §3 rule 13). NULL is a statement (the plane could not establish who wrote the sentence) and is legal; an ABSENT key is silence, and a reader holding only the publisher's name reads two acts as one (got {v1}{v2})",
      { declared: fmt, v1: "null", v2: "" }));
  }
  /* C-41.1 names the current format (CASE_DOCUMENT_FORMAT, in force) and every format accepted as written */
  const [bad] = run(as("bio-case-document/11"), CTX).filter((x) => x.check === "C-41.1");
  for (const fmt of ["/10", "/9", "/8", "/7", "/6", "/5", "/4", "/3", "/2", "/1"]) assert.ok(bad.message.includes(`'bio-case-document${fmt}'`), fmt);
  assert.equal(bad.message, localize("case-catalogue.checks.a_case_document_declares_format",
    "a case document declares format '{CASE_DOCUMENT_FORMAT}', or one of the earlier formats accepted as written ({map}) (got '{format}'): the format token is what lets a stranger holding these bytes know what they are reading and what rules they were made under, which is the same reason the container manifest carries one",
    { CASE_DOCUMENT_FORMAT, map: CASE_DOCUMENT_FORMATS_ACCEPTED.filter((x) => x !== CASE_DOCUMENT_FORMAT).map((x) => `'${x}'`).join(", "), format: "bio-case-document/11" }));
});

test("R4: the family is declared gate findings, not refusal rows: no export is named *_CHECKS, no row carries a where or a code, and each row names its check and what it asks", () => {
  assert.deepEqual(Object.keys(R).filter((k) => /_CHECKS$/.test(k)), []);
  for (const [k, row] of Object.entries(R.CASE_DOCUMENT_FAMILY)) {
    assert.deepEqual(Object.keys(row).sort(), ["check", "what"], k);
    assert.ok(typeof row.what === "string" && row.what.length > 5, k);
  }
  for (const x of R.checkCaseDocument({}, {})) assert.ok(!("where" in x) && !("translation" in x), x.check);
});

test("R5: no place is named in this module's vocabularies or findings", () => {
  const said = JSON.stringify([
    R.CASE_DOCUMENT_FAMILY, R.SEARCHED_SUBJECT_SOURCES, R.CASE_CITATION_VERSIONS, R.CASE_MEMBER_ROLES, R.SUBJECT_POSITIONS,
    ...ARMS.map(([, , m, , ctx = CTX]) => R.checkCaseDocument(m(doc()), ctx)), R.checkCaseDocument({}, {}),
    R.checkCaseDocument(doc(), { ...CTX, body: "x", memberBasis: { [M1]: [{ grade_axis: "testimony", grade: "D" }] },
                                 priorCase: { edition: 1, statement: doc().completeness.statement, bias_acknowledgement: doc().bias_acknowledgement } }),
    R.caseMemberFindings({ published_strength: [{ axis: "a" }, { axis: "b" }] }),
    ...[(m) => { delete m.completeness; }, (m) => { m.completeness_excluded = [{}]; }].map((mut) => { const m = member(); mut(m); return R.caseMemberFindings(m); }),
  ]);
  assert.ok(said.length > 2000, "negative control: the findings were drawn");
  assert.doesNotMatch(said, /oakland|alameda|california|berkeley/i);
});

test("R2, R31: C-2.8's grounds arm counts only live legs, as strength does: a ground whose every leg is severed has no row to ask for", () => {
  const leg = (target, ground) => ({ target, role: "supports", grade: "B", grade_axis: "capture", ground });
  const grounded = (refs, rows) => {
    const m = member();
    m.basis = [leg("INFO-2026-0001-a", "part 1"), leg("INFO-2026-0002-b", "part 2")];
    m.references = refs;
    m.published_strength_grounds = rows.map((g) => ({ ground: g, axis: "capture", state: "graded", grade: "B" }));
    return m;
  };
  const cite = (target, status) => ({ target, rel: "cites", status });
  const live = [cite("INFO-2026-0001-a", "confirmed"), cite("INFO-2026-0002-b", "confirmed")];
  const severed = [cite("INFO-2026-0001-a", "confirmed"), cite("INFO-2026-0002-b", "severed")];
  assert.deepEqual(armOf(grounded(severed, ["part 1"])), [], "part 2's only leg is severed: no row for it, no finding");
  assert.deepEqual(armOf(grounded(live, ["part 1"])), ["C-2.8"], "control: the same leg live and its row absent is still the finding");
  assert.deepEqual(armOf(grounded(live, ["part 1", "part 2"])), [], "control: every live ground has its row");
  const oneLeg = grounded(severed, ["part 1"]);
  oneLeg.basis.push(leg("INFO-2026-0001-a", "part 2"));
  assert.deepEqual(armOf(oneLeg), ["C-2.8"], "a ground with a live leg left is asked for");
});

test("R6: the case document's member arm reads a member's references beside its basis: a severed leg is dropped there as on the member's own arm", () => {
  const leg = (target, ground) => ({ target, role: "supports", grade: "B", grade_axis: "capture", ground });
  const basis = [leg("INFO-2026-0001-a", "part 1"), leg("INFO-2026-0002-b", "part 2")];
  const cite = (target, status) => ({ target, rel: "cites", status });
  const live = [cite("INFO-2026-0001-a", "confirmed"), cite("INFO-2026-0002-b", "confirmed")];
  const severed = [cite("INFO-2026-0001-a", "confirmed"), cite("INFO-2026-0002-b", "severed")];
  const withGrounds = (grounds) => {
    const d = doc();
    d.case_strength_grounds = grounds.map((g) => ({ target: M2, ground: g, axis: "capture", state: "graded", grade: "B" }));
    return d;
  };
  const asked = (grounds, entry) => R.checkCaseDocument(withGrounds(grounds), { ...CTX, memberBasis: { [M2]: entry } });
  const codes = (out) => out.map((x) => x.check);
  assert.deepEqual(codes(asked(["part 1"], { basis, references: severed })), [], "part 2's only leg is severed: no row for it, no finding");
  assert.deepEqual(codes(asked(["part 1"], { basis, references: live })), ["C-2.8"], "control: the same leg live and its row absent is still the finding");
  assert.deepEqual(codes(asked(["part 1", "part 2"], { basis, references: live })), [], "control: every live ground has its row");
  assert.deepEqual(codes(asked(["part 1"], { basis })), ["C-2.8"], "an entry with no references drops no leg");
  assert.deepEqual(codes(asked(["part 1"], basis)), ["C-2.8"], "control: the array form is unchanged, no leg dropped");
  assert.deepEqual(codes(asked(["part 1", "part 2"], basis)), [], "control: the array form with every row is clean");
  const first = asked(["part 1"], { basis, references: [cite("INFO-2026-0002-b", "confirmed"), cite("INFO-2026-0002-b", "severed")] });
  assert.deepEqual(codes(first), ["C-2.8"], "the first entry for a target decides, as strength reads it");
  assert.deepEqual(codes(R.checkCaseDocument(doc(), { ...CTX, memberBasis: { [M2]: { references: severed } } })), [], "an entry with no basis asks the basis arms of nothing");
});

/* ===== R7, R8 (T53): C-41.18 and C-41.19 over a /10 document's passage blocks =====
   Each block is written by case-grammar's own writers (its R17, R36, R37) and read back by the grammar's parser, as
   op=publish would sign it; only the malformed rows a writer would never produce are written out by hand. */
const V10 = CASE_DOCUMENT_FORMAT;
const TYPING = [{ step: "typed", member: "m2" }];
const blocks = (lines) => {
  const p = parseFrontmatter(["---", ...lines, "---", ""].join("\n"));
  assert.deepEqual(p.findings, [], "the grammar reads every line");
  return p.data;
};
const P1 = { finding: M1, ord: 1, content_id: "c".repeat(64), capture_sha: "d".repeat(64), extent: null, chain: null, quoted: null };
const P2 = { ...P1, ord: 2, content_id: "e".repeat(64) };
const keyOf = (p) => ({ finding: p.finding, ord: p.ord, content_id: p.content_id });
/* A /10 document stating `passages`, their grading facts and the given extra lines. */
const doc10 = (passages, facts, lines = [], format = V10) =>
  ({ ...doc(), format, ...blocks([...passagesLines(passages), ...gradingFactsLines(facts), ...lines]) });
const only = (d, check) => checks(d).filter((c) => c === check);

test("R7: C-41.18 — one ungraded passage with its row passes; without the row, a row for a graded passage, a duplicate, a row naming no passage, and a scalar block each give the finding with R7's translation", () => {
  const facts = [{ finding: M1, ord: 1, grade: null }, { finding: M1, ord: 2, grade: "B" }];
  assert.deepEqual(checks(doc10([P1, P2], facts, ungradedPassagesLines([keyOf(P1)]))), [], "the one ungraded passage, listed");
  const bad = {
    "no row": [],
    "a graded passage listed": ungradedPassagesLines([keyOf(P1), keyOf(P2)]),
    "a duplicate": ungradedPassagesLines([keyOf(P1), keyOf(P1)]),
    "a row naming no passage": ungradedPassagesLines([keyOf(P1), { finding: M2, ord: 9, content_id: "f".repeat(64) }]),
    "a scalar block": ["ungraded_passages: 3"],
  };
  for (const [what, lines] of Object.entries(bad)) {
    const found = R.checkCaseDocument(doc10([P1, P2], facts, lines), CTX);
    assert.deepEqual(found.map((x) => x.check), ["C-41.18"], what);
    assert.equal(found[0].message, localize("case-catalogue.checks.the_list_of_passages_this",
      "The list of passages this case was published without a grade for does not match the passages that have none. Prepare the case again, and sign it. Nothing was signed."), what);
  }
});

test("R7 controls: all graded with no block passes; a /9 document without the key is not asked, with it is found; a typed leg graded by the record and not listed passes", () => {
  assert.deepEqual(checks(doc10([P1, P2], [{ finding: M1, ord: 1, grade: "C" }, { finding: M1, ord: 2, grade: "B" }])), []);
  const ungradedFacts = [{ finding: M1, ord: 1, grade: null }];
  assert.deepEqual(checks(doc10([P1], ungradedFacts, [], CASE_DOCUMENT_FORMAT_V9)), [], "a /9 document is not asked");
  assert.deepEqual(only(doc10([P1], ungradedFacts, ungradedPassagesLines([keyOf(P1)]), CASE_DOCUMENT_FORMAT_V9), "C-41.18"),
    ["C-41.18"], "a /9 document carrying the key states what no reader would read");
  /* a typed passage: its grading-facts row says typed (strength R47) and the record grades it (leg-earning R19) */
  const T = { ...P1, chain: TYPING };
  assert.equal(R.legUngraded({ finding: M1, ord: 1, grade: null, typed: { checked: false } }), false);
  assert.equal(R.legUngraded({ finding: M1, ord: 1, grade: null }), true);
  assert.deepEqual(checks(doc10([T], [{ finding: M1, ord: 1, grade: null, typed: { checked: false } }],
    typedPassagesLines([{ ...keyOf(T), typed_at: "2026-10-02T10:00:00Z", typist_level: "group", checkers: [] }]))), []);
});

test("R8: C-41.19 — a typed passage with no row, checked true with no checker, checked false with one, a name shown at group, a blank one at cover and a level outside R2's each give the finding with R8's translation", () => {
  const T = { ...P1, chain: TYPING };
  const facts = [{ finding: M1, ord: 1, grade: "D", typed: { checked: false } }];
  const good = typedPassagesLines([{ ...keyOf(T), typed_at: "2026-10-02T10:00:00Z", typist_level: "group", checkers: [] }]);
  const checkedOne = typedPassagesLines([{ ...keyOf(T), typed_at: "2026-10-02T10:00:00Z", typist_level: "cover", typist_shown: "Heron",
    checkers: [{ level: "name", shown: "Birch Ames", at: "2026-10-03T09:00:00Z" }] }]);
  assert.deepEqual(checks(doc10([T], facts, good)), [], "listed correctly");
  assert.deepEqual(checks(doc10([T], [{ ...facts[0], grade: "C", typed: { checked: true } }], checkedOne)), [], "checked, credits within levels");
  const swap = (lines, from, to) => { const i = lines.findIndex((l) => l.trim() === from || l.trim().endsWith(from));
    assert.ok(i >= 0, from); return lines.map((l, j) => (j === i ? l.replace(from, to) : l)); };
  const bad = {
    "no row": [],
    "checked true with no checker": swap(good, "checked: false", "checked: true"),
    "checked false with a checker": swap(checkedOne, "checked: true", "checked: false"),
    "a name shown at group": swap(good, "typist_shown: null", `typist_shown: '"Alder Quill"'`),
    "a blank name at cover": swap(checkedOne, `typist_shown: '"Heron"'`, `typist_shown: '" "'`),
    "a level outside R2's": swap(good, `typist_level: '"group"'`, `typist_level: '"boss"'`),
    "a checker at project showing a name": swap(checkedOne, `'[{"at":"2026-10-03T09:00:00Z","level":"name","shown":"Birch Ames"}]'`,
      `'[{"at":"2026-10-03T09:00:00Z","level":"project","shown":"Birch Ames"}]'`),
  };
  for (const [what, lines] of Object.entries(bad)) {
    const found = R.checkCaseDocument(doc10([T], facts, lines), CTX);
    assert.deepEqual(found.map((x) => x.check), ["C-41.19"], what);
    assert.equal(found[0].message, localize("case-catalogue.checks.a_page_a_member_typed",
      "A page a member typed is not listed, or is listed with a credit the member's choice does not allow. Prepare the case again. Nothing was signed."), what);
  }
});

test("R8 controls: a document without typed passages and without the block passes; a /9 document with a typed passage and no block is not asked", () => {
  assert.deepEqual(checks(doc10([P1, P2], [{ finding: M1, ord: 1, grade: "B" }, { finding: M1, ord: 2, grade: "B" }])), []);
  assert.deepEqual(checks(doc10([{ ...P1, chain: TYPING }], [{ finding: M1, ord: 1, grade: "D", typed: { checked: false } }], [], CASE_DOCUMENT_FORMAT_V9)), []);
  for (const odd of [{ format: V10, passages: 7, typed_passages: [null, 3], ungraded_passages: [{}] },
                     { format: V10, get typed_passages() { throw new Error("boom"); } }])
    assert.doesNotThrow(() => R.checkCaseDocument(odd, CTX));
});

/* ===== provider notices ===== */

test("notice strength:176 (R46, R47): a grading-facts row stating typed, as strength now writes it for a leg on a typed passage, is graded by the record and never ungraded, whatever its grade; a row without typed and no grade is ungraded", () => {
  const fm = doc10([{ ...P1, chain: TYPING }, P2],
    [{ finding: M1, ord: 1, grade: null, typed: { checked: true } }, { finding: M1, ord: 2, grade: null }],
    [...ungradedPassagesLines([keyOf(P2)]),
     ...typedPassagesLines([{ ...keyOf(P1), typed_at: "2026-10-02T10:00:00Z", typist_level: "name", typist_shown: "Ivy",
                              checkers: [{ level: "group", shown: null, at: "2026-10-03T00:00:00Z" }] }])]);
  assert.deepEqual(checks(fm), [], "the typed leg is not listed as ungraded; the untyped one is");
  for (const typed of [{ checked: false }, { checked: true }]) assert.equal(R.legUngraded({ grade: null, typed }), false);
  assert.equal(R.legUngraded({ grade: "D", typed: { checked: false } }), false);
  assert.equal(R.legUngraded({ grade: null, typed: null }), true, "typed null is a row stating none (case-grammar R17)");
  for (const odd of [null, undefined, 7, "x", { get grade() { throw new Error("boom"); } }]) assert.equal(R.legUngraded(odd), false);
});

test("notice case-grammar:202 (R1, R35-R37): /10 is accepted as written and asked C-41.18 and C-41.19; /11 is not a format and C-41.1 alone answers it", () => {
  assert.ok(CASE_DOCUMENT_FORMATS_ACCEPTED.includes(V10));
  assert.deepEqual(checks({ ...doc(), format: V10 }, { ...CTX, body: BODY, memberBasis: { [M1]: [], [M2]: [] } }), []);
  assert.deepEqual(checks({ ...doc(), format: V10, typed_passages: '"x"', ungraded_passages: 3 }), ["C-41.18", "C-41.19"]);
  assert.deepEqual(checks({ ...doc(), format: "bio-case-document/11", typed_passages: '"x"', ungraded_passages: 3 }), ["C-41.1"]);
});
