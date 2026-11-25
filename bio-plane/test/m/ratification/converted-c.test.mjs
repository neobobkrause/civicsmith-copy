/* CONVERTED (T18, the ratification job): ratification's share of four old suites, as module tests at this module's
   interface. The old suites were not deleted by this job (K619):
     - test/casesign.test.mjs
     - test/d442-publish-writes-nothing.test.mjs
     - test/ratify-authority.test.mjs
     - test/ratify-envelope.test.mjs
   Only ratification's share is converted, as build/jobs/T17/legacy-tests.md's row for each names it ("ratification
   R…"); what those rows give case-authoring, publication, membership and promotion is theirs, not this file's.

   The old suites drove op=publish (case-authoring's) to author the /5 case document the case gate then ran over. This
   file may not import case-authoring, so it writes a document of the same shape BY HAND (`publishedCaseText`, below):
   the lines, keys and body sections `caseDocumentText` writes for a two-member case whose project declared no bar and
   whose basis legs name nothing the record can resolve (casesign's corpus), and parses it with record-grammar's
   `parseFrontmatter`, as the old suites parsed the text op=publish returned. Every other act is driven at the module's
   interface: the store half (`ratificationOf` through the fixture's `world()`), the Worker half (`caseRatifyOp`,
   `ratifyOp` with the fixture's `plane(w)`), and the pure `checkCaseDocument`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, plane, newKey, signBundle, signCase, cleanInfoMd, sha, V, SILENT, NOW } from "./fixture.mjs";
import { caseRatifyOp, ratifyOp } from "../../../src/ratification/ops.mjs";
import { methodBlockLines, materialBlockLines } from "../../../src/case-grammar/index.mjs";
import { checkCaseDocument, CASE_DOCUMENT_FAMILY, caseConclusionRowLines } from "../../../src/ratification/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { CASE_AUTHORITY_CHECKS, PROJECT_AUTHORITY_CHECKS } from "../../../src/membership/index.mjs";
import { word, localize } from "../../../src/setup-words/index.mjs";
import { recordReuseVerdicts } from "../capture/fixtures.mjs";

/* ================================================================ a /6 case document, in op=publish's shape */

const SCOPE = "Whether the FY2024 transfer was authorised and whether notice was given, on the documents in hand.";
const STMT = "This case covers the FY2024 transfer only, on the documents in hand at edition 1.";
const JUST = "We put the claims to the City Administrator on 2026-06-20 and printed what came back.";
const BACK = "This group holds a declared position that transfers should be adopted in public session, "
           + "and edition 1 reads the FY2024 record through it.";
const EXCL_D = "the FY2023 comparison memo", EXCL_R = "a records request for it is still outstanding with the City Clerk";
const LEFT = "INFO-2026-7700-left-out", MEMO = "INFO-2026-7700-memo";

/** The /6 text op=publish authors (case-authoring's `caseDocumentText`), written out line for line for `members`
 *  ([{id, pin, role}]) with `conclusions` rows ([[member, conclusion]], ratification's own row writer). Each member is
 *  frozen at its edition 1 with capture honestly unrated and connection graded D on testimony, no stronger than MEMO;
 *  the searched section reports three levels, each partial with the case's two unresolvable referents. */
function publishedCaseText({ caseId, edition = 1, project, members, conclusions = [], at = "2026-07-02T00:00:00Z" }) {
  const q = (s) => `"${s}"`;
  const fm = [
    "---", "format: bio-case-document/6", `case_id: ${caseId}`, `case_edition: ${edition}`, `case_project: ${project}`,
    /* K1321: op=publish writes /6 (publication R58), with its method and (here empty) materials blocks */
    ...methodBlockLines({ grading: "bio-grading/1", checks: "1.57.0" }), ...materialBlockLines({}),
    `case_scope: ${q(SCOPE)}`, `bias_acknowledgement: ${q(BACK)}`,
    "bias_manifest:", "  in_force: false", "  scope: project", `  scope_id: ${project}`, "  statements_sha: null",
    "  lock_violations: 0", `  stated: "no manifest was in force"`, "  pins_proposed: 0",
    `  pins_proposed_stated: "no adoption in this scope pinned a proposed revision when this case was signed"`,
    "bias_manifest_bundles:", "bias_manifest_pins_proposed:", "case_citations:",
    `case_findings: [${members.map((m) => m.id).join(", ")}]`,
    "case_roles:", ...members.flatMap((m) => [`  - target: ${m.id}`, `    role: ${m.role}`, `    version_sha: ${m.pin}`,
                                              "    edition: 1"]),
    "case_conclusions:", ...conclusions.flatMap(([m, c]) => caseConclusionRowLines(m, c)),
    "tensions_disclosed: 0", "tensions_highlighted: 0",
    `tensions_depth_stated: "Each conflict disclosed here is on something a finding of this case rests on, one level deep."`,
    "case_tensions_unread:", "case_tensions:", "case_tension_sentences:",
    "completeness:", `  statement: ${q(STMT)}`, "  subject_position: sought_and_answered",
    `  subject_justification: ${q(JUST)}`, "  author: alice", "  statement_by: alice", `  at: "${at}"`,
    "  statement_sha: null", "  acknowledged: 0", "completeness_acknowledgements:",
    "completeness_excluded:", `  - target: ${LEFT}`, `    description: ${q(EXCL_D)}`, `    reason: ${q(EXCL_R)}`,
    "searched:", `  computed_at: "${at}"`, "  subject_source: case_basis", "  subjects: 0", "  looked: 0",
    "  unidentified: 2", "  levels_reported: 3",
    "searched_levels:", ...["document", "source", "entity"].flatMap((level) => [
      `  - level: ${level}`, "    subject_kind: referent", "    outcome: partial", "    subjects: 0", "    looked: 0",
      "    never_looked: 0", "    undetermined: 0", "    unidentified: 2", "    evidence_one_sided: false",
      `    detail: "2 referent(s) could not be resolved to a subject"`]),
    "case_strength:", ...members.flatMap((m) => [
      `  - target: ${m.id}`, "    axis: capture", "    state: unrated", "    grade: null", "    weakest: null",
      "    load_bearing: 0", "    population: 0", `    detail: "no capture leg is registered"`,
      `  - target: ${m.id}`, "    axis: connection", "    state: graded", "    grade: D", `    weakest: ${MEMO}`,
      "    load_bearing: 1", "    population: 1", `    detail: "one testimony leg"`]),
    "case_strength_grounds:",
    "required_strength:", "  declared: false", "  source: project", `  project: ${project}`, "  capture: null",
    "  connection: null", `  detail: "the project declared no standard"`,
    "---", ""];
  const body = [
    `# Case ${caseId} — edition ${edition}`, "", "## Scope", "", SCOPE, "", "## Findings In This Case", "",
    ...members.map((m, i) => `${i + 1}. ${m.id} — ${m.role === "load_bearing" ? "LOAD-BEARING" : "supporting"}, frozen at version ${m.pin}`),
    "", word("case-authoring.body.load_bearing_finding"),
    word("case-authoring.body.supporting_finding_travels"), "",
    "## What This Excludes", "", STMT, "", `- ${LEFT} — ${EXCL_D}: ${EXCL_R}`, "",
    `Position on putting this case to its subject: sought_and_answered. ${JUST}`, "",
    "## What Was Searched", "", "- **document level** (referent): PARTIAL.", "",
    "## What Each Finding Reached, As Read For This Case", "",
    ...members.map((m) => `- **${m.id}** (its edition 1): capture UNRATED; connection grade D, no stronger than ${MEMO}.`), "",
    "## Bias Manifest", "", word("case-authoring.body.manifest_force_case", { scope_id: project }), "",
    "## Citations", "", word("case-authoring.body.case_project_cited"), "",
    "## Bias Acknowledgement", "", BACK, "",
    "## Standard Of Evidence", "", word("case-authoring.body.case_production_standard", { project, bar: "" }), "",
    "## Session Log", "", `### Session ${at} | Case published | alice`, localize("case-authoring.document.trigger_op_publish_case", "Trigger: op=publish, case {caseId} edition {edition}", { caseId: String(caseId), edition: String(edition) }), ""];
  return fm.join("\n") + body.join("\n");
}

const LEAD = "INQ-2026-7700-lead", SUPP = "INQ-2026-7700-supporting", CASE = "CASE-2026-7700";
const PROJECT = "PROJ-2026-7700-auditor";
const PINS = { [LEAD]: "a".repeat(64), [SUPP]: "b".repeat(64) };
const parsed = () => parseFrontmatter(publishedCaseText({ caseId: CASE, project: PROJECT, members: [
  { id: LEAD, pin: PINS[LEAD], role: "load_bearing" }, { id: SUPP, pin: PINS[SUPP], role: "supporting" }] }));
const errorsOf = (fs) => fs.filter((x) => x.severity === "error").map((x) => x.check);

/* ================================================================ casesign */

/* casesign §7's arms, each with the mutation it drove (they differ from checks.test.mjs's). */
const CASESIGN_ARMS = [
  ["FORMAT", "C-41.1", (d) => { d.format = "nope"; return d; }],
  ["IDENTITY", "C-41.2", (d) => { d.case_id = "CASE-2026-9999"; return d; }],
  ["EDITION", "C-41.3", (d) => { d.case_edition = 7; return d; }],
  ["PROJECT", "C-41.4", (d) => { d.case_project = null; return d; }],
  ["SCOPE", "C-41.5", (d) => { d.case_scope = ""; return d; }],
  ["BIAS", "C-41.6", (d) => { d.bias_acknowledgement = ""; return d; }],
  ["ROSTER", "C-41.7", (d) => { d.case_findings = []; return d; }],
  ["ROLES", "C-41.8", (d) => { d.case_roles = d.case_roles.map((r) => ({ ...r, role: "supporting" })); return d; }],
  ["PINS", "C-41.9", (d) => { d.case_roles = d.case_roles.map((r) => ({ ...r, version_sha: null })); return d; }],
  ["COMPLETENESS", "C-41.10", (d) => { d.completeness = { ...d.completeness, statement: "" }; return d; }],
  ["EXCLUDED", "C-41.11", (d) => { delete d.completeness_excluded; return d; }],
  ["BAR", "C-41.12", (d) => { delete d.required_strength; return d; }],
  ["DISCLOSURES", "C-41.13", (d) => { delete d.bias_manifest; return d; }],
  ["PENDING", "C-41.14", (d) => { delete d.bias_manifest_pins_proposed; return d; }],
  ["CITATIONS", "C-41.15", (d) => { delete d.case_citations; return d; }],
  ["WHAT_CHANGED", "C-41.16", (d) => { d.case_edition = 2; return d; }],   /* over the body, which states no change */
  ["WORKING_ON", "C-41.17", (d) => { d.working_on = "PROJ 2026"; return d; }],   /* case-catalogue R3 (once R38 here) */
];

test("R8 (casesign §7): the case gate draws no finding over a /6 document in op=publish's shape, and each of C-41.1–C-41.17 is what CASE_DOCUMENT_FAMILY declares and fires on its own mutation; the arms cover the family exactly", () => {
  const { data: fm, body } = parsed();
  const ctx = { caseId: CASE, edition: 1 };
  assert.equal(fm.format, "bio-case-document/6");
  assert.deepEqual(fm.case_findings, [LEAD, SUPP], "the flow-list roster op=publish writes parses as the roster");
  assert.deepEqual(checkCaseDocument(fm, ctx), [], "the baseline: without it every arm below proves only that the gate fires");
  assert.deepEqual(checkCaseDocument(fm, { ...ctx, body }), [], "and with its body");
  for (const [key, num, mutate] of CASESIGN_ARMS) {
    assert.equal(CASE_DOCUMENT_FAMILY[key].check, num, key);
    assert.ok(checkCaseDocument(mutate({ ...fm }), { ...ctx, body }).some((x) => x.check === num), `${num} fires on ${CASE_DOCUMENT_FAMILY[key].what}`);
  }
  assert.deepEqual(CASESIGN_ARMS.map(([k]) => k).sort(), Object.keys(CASE_DOCUMENT_FAMILY).sort());
});

test("R8 (casesign §7): C-21.1 at case altitude over that document — an edition reprinting the previous edition's statement and acknowledgement draws two findings, freshly authored ones none", () => {
  const { data: fm } = parsed();
  const ctx = { caseId: CASE, edition: 1 };
  const c21 = (priorCase) => checkCaseDocument(fm, { ...ctx, priorCase }).filter((x) => x.check === "C-21.1").length;
  assert.equal(c21({ edition: 0, statement: STMT, bias_acknowledgement: BACK }), 2);
  assert.equal(c21({ edition: 0, statement: "different", bias_acknowledgement: "also different" }), 0);
});

/* The Worker half over that document: a project alice owns, the two members promoted and pinned, and publication's
   facts for the case answering the stored text (as op=publish's R21 store would leave it). */
async function caseCeremony() {
  const w = world();
  const key = await newKey();
  w.member("alice", { signer: key });
  const P = w.project("Auditor", "alice");
  const conc = {};
  for (const id of [LEAD, SUPP]) {
    w.inquiry(id);
    w.bv.conc.set(w.key(P, id), { version: "first", claim: `the claim of ${id}`, falsifier: "f", falsifier_override: null,
                                  by: "member:alice", at: "2026-09-27T10:00:00Z" });
    conc[id] = w.r.caseConclusionFor(P, id, V("alice"), "open");
  }
  const members = [{ id: LEAD, pin: w.sha(LEAD), role: "load_bearing" }, { id: SUPP, pin: w.sha(SUPP), role: "supporting" }];
  const store = (text) => {
    const docSha = w.caseDoc(CASE, 1, text);
    w.pub.facts.set(`${CASE}#1`, { ok: true, doc: { case_id: CASE, edition: 1, doc_sha: docSha, text },
                                   attribution: { reached: [], legacy: [], stated: [], current: [] },
                                   signers: w.credentials.attestingKeys(), memberBasis: { [LEAD]: [], [SUPP]: [] }, priorCase: null });
    return docSha;
  };
  const text = publishedCaseText({ caseId: CASE, project: P, members, conclusions: [[LEAD, conc[LEAD]], [SUPP, conc[SUPP]]] });
  const run = async (docSha) => {
    const p = plane(w);
    return caseRatifyOp(p.request({ caseId: CASE, edition: 1, expectedSha: docSha, sig: await signCase(key, CASE, 1, docSha) }),
                        p.stub, p.ctx);
  };
  return { w, P, text, store, run };
}

test("R2, R8 (casesign §3, §7): op=caseratify runs the registered case gate over a /6 document in op=publish's shape and commits it; the same document with its scope emptied is GATE_REFUSED C-41.5 and commits nothing", async () => {
  const bad = await caseCeremony();
  const refused = await bad.run(bad.store(bad.text.replace(`case_scope: "${SCOPE}"`, `case_scope: ""`)));
  assert.deepEqual([refused.status, refused.body.reason, refused.body.findings.map((x) => x.check)], [409, "GATE_REFUSED", ["C-41.5"]]);
  assert.equal(bad.w.pub.committed.length, 0);
  const good = await caseCeremony();
  const r = await good.run(good.store(good.text));
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 600));
  assert.deepEqual([r.body.ok, r.body.caseId, r.body.edition, r.body.project, r.body.roster, [...r.body.awaiting].sort(), r.body.attestor.member],
    [true, CASE, 1, good.P, [LEAD, SUPP], [LEAD, SUPP].sort(), "alice"]);
  assert.deepEqual(good.w.pub.committed[0].roster.map((m) => [m.bundle_id, m.role, m.version_sha]),
    [[LEAD, "load_bearing", good.w.sha(LEAD)], [SUPP, "supporting", good.w.sha(SUPP)]], "roles and pins out of the signed bytes");
});

/* A finding and the evidence it rests on, for op=ratify at the Worker half: alice owns P, bo joined it; ruth is an
   administrator in no project; eve is a member in no project. Each holds a registered key. */
async function ratifyWorld({ refs = [] } = {}) {
  const w = world();
  const keys = {};
  for (const [m, role] of [["alice", "member"], ["bo", "member"], ["ruth", "admin"], ["eve", "member"]]) {
    keys[m] = await newKey();
    w.member(m, { role, signer: keys[m] });
  }
  const P = w.project("Team", "alice", { joined: ["bo"] });
  return { w, P, keys };
}
const session = (who) => (who === "founder" ? { session: { role: "admin" }, viewer: "member:admin" }
                                            : { session: { role: `member:${who}` }, viewer: V(who) });
async function ratifyAs(w, keys, { signer, deliverer, id, image = null }) {
  const p = plane(w, session(deliverer));
  if (image) w.ops.image = image;
  const s = w.sha(id);
  const res = await ratifyOp(p.request({ bundleId: id, expectedSha: s, sig: await signBundle(keys[signer], id, s) }), p.stub, p.ctx);
  return { ...res, p };
}
/** An inquiry the catalogue owes nothing at ratification, citing `refs`. */
function findingMd(id, refs = []) {
  return ["---", `id: ${id}`, "object_type: inquiry", "schema: inquiry@1", `title: "Was the transfer authorised?"`,
          "current_state: open", "prior_state: null", `created: "2026-07-01T00:00:00Z"`, `last_updated: "2026-07-01T00:00:00Z"`,
          "produced_by:", "  mode: human", "  capability_tier: none", "surfaced_by: human", "group: test-group",
          ...(refs.length ? ["references:", ...refs.flatMap((t) => [`  - target: ${t}`, "    rel: cites", "    status: confirmed"])]
                          : ["references: []"]),
          "state_history: []", "annotations_open: 0", "reeval_pending: false", "visuals: []",
          "recheck_triggers:", "  - text: Revisit after the next budget cycle",
          "    description: The adopted budget may restate the transfer basis.",
          "---", "", "## Question", "", "Was the transfer authorised?", "", word("conformance.rests"), "", "## Conclusion", "",
          word("conformance.falsify"), "", "## Session Log", "", "## Review Notes", ""].join("\n");
}
function pinned(w, P, id, caseId = "CASE-2026-0001") {
  w.st.sql.exec(`INSERT OR IGNORE INTO cases (case_id, project_id, opened) VALUES (?, ?, ?)`, caseId, P, NOW);
  w.pub.pins.set(`${id}@${w.sha(id)}`, [{ case_id: caseId, edition: 1, role: "load_bearing" }]);
}

test("R4, R9 (casesign §4): a finding whose own bytes name a case is GATE_REFUSED at op=ratify with C-2.8's case-key arm, and nothing crosses; the same bytes without the key cross", async () => {
  const { w, P, keys } = await ratifyWorld();
  const Q = "INQ-2026-7700-lead";
  w.promote(Q, findingMd(Q));
  pinned(w, P, Q);
  const lie = (url) => {
    const img = w.record.readImage(url.searchParams.get("id"));
    img["bundle.md"] = img["bundle.md"].replace(/^(---\n)/, `$1case_id: ${CASE}\n`);
    return img;
  };
  const refused = await ratifyAs(w, keys, { signer: "alice", deliverer: "alice", id: Q, image: lie });
  assert.deepEqual([refused.status, refused.body.reason], [409, "GATE_REFUSED"]);
  assert.ok(refused.body.findings.some((x) => x.check === "C-2.8" && /a finding's bytes name a case \(case_id\)/.test(x.detail)),
    JSON.stringify(refused.body.findings).slice(0, 600));
  assert.equal(w.count("published_bundles"), 0, "nothing crossed");
  delete w.ops.image;
  const honest = await ratifyAs(w, keys, { signer: "alice", deliverer: "alice", id: Q });
  assert.equal(honest.status, 200, JSON.stringify(honest.body).slice(0, 600));
  assert.equal(w.count("published_bundles"), 1);
});

/* ================================================================ d442-publish-writes-nothing */

test("R8 (d442 §5): over a /6 document in op=publish's shape, with its body and each member's basis, the case gate draws no error; each moved block removed fires by name — a member's capture row or edition C-2.8 naming the member, the section C-3.1 alone, a testimony-graded leg at the pin C-2.8; a /1 document is still read, and an unknown format is C-41.1", () => {
  const { data: fm, body } = parsed();
  const ctx = { caseId: CASE, edition: 1, body, memberBasis: { [LEAD]: [], [SUPP]: [] } };
  assert.deepEqual(errorsOf(checkCaseDocument(fm, ctx)), [], "the non-empty guard for the arms below");
  const noPair = checkCaseDocument({ ...fm, case_strength: fm.case_strength.filter((r) => !(r.target === LEAD && r.axis === "capture")) }, ctx)
    .filter((x) => x.severity === "error");
  assert.ok(noPair.some((x) => x.check === "C-2.8" && x.message.startsWith(`case document, member ${LEAD}: `)), JSON.stringify(noPair).slice(0, 400));
  assert.ok(errorsOf(checkCaseDocument({ ...fm, case_roles: fm.case_roles.map((r) => ({ ...r, edition: null })) }, ctx)).includes("C-2.8"));
  assert.deepEqual(errorsOf(checkCaseDocument(fm, { ...ctx, body: body.replace(/^## What This Excludes$/m, "## Elsewhere") })), ["C-3.1"]);
  const legs = [{ target: MEMO, role: "supports", grade: "B", grade_axis: "testimony" }];
  assert.ok(errorsOf(checkCaseDocument(fm, { ...ctx, memberBasis: { [LEAD]: legs } })).includes("C-2.8"), "the arm reads memberBasis");
  assert.deepEqual(errorsOf(checkCaseDocument({ ...fm, format: "bio-case-document/1", case_strength: undefined,
                                                case_strength_grounds: undefined }, ctx)), [],
    "rule 12 (e): a legacy /1 document's format is accepted and the member arms are not asked of it");
  assert.ok(errorsOf(checkCaseDocument({ ...fm, format: "bio-case-document/10" }, ctx)).includes("C-41.1"));
});

/* ================================================================ ratify-authority */

test("R5 (ratify-authority §2, §3): at op=ratify a pinned finding signed by a joined non-owner, or an administrator's signature the founder carries, is 409 CASE_SIGNER_NOT_AN_OWNER with C-57.1's row, signer and project; an owner's signature carried by an administrator in no role is 409 PROJECT_ACT_NOT_A_PARTICIPANT with C-56.1's row, act ratify and project; nothing crosses", async () => {
  const { w, P, keys } = await ratifyWorld();
  const Q = "INQ-2026-9401-lead";
  w.promote(Q, findingMd(Q));
  pinned(w, P, Q);
  const gus = await ratifyAs(w, keys, { signer: "bo", deliverer: "bo", id: Q });
  assert.deepEqual([gus.status, gus.body.ok, gus.body.reason, gus.body.check, gus.body.signer, gus.body.project],
    [409, false, "CASE_SIGNER_NOT_AN_OWNER", "C-57.1", "bo", P]);
  assert.equal(gus.body.translation, CASE_AUTHORITY_CHECKS.CASE_SIGNER_NOT_AN_OWNER.translation);
  const viaFounder = await ratifyAs(w, keys, { signer: "ruth", deliverer: "founder", id: Q });
  assert.deepEqual([viaFounder.status, viaFounder.body.reason, viaFounder.body.signer], [409, "CASE_SIGNER_NOT_AN_OWNER", "ruth"],
    "the founder's route is carriage, never authority");
  const ruth = await ratifyAs(w, keys, { signer: "alice", deliverer: "ruth", id: Q });
  assert.deepEqual([ruth.status, ruth.body.reason, ruth.body.check, ruth.body.act, ruth.body.project],
    [409, "PROJECT_ACT_NOT_A_PARTICIPANT", "C-56.1", "ratify", P]);
  assert.equal(ruth.body.translation, PROJECT_AUTHORITY_CHECKS.PROJECT_ACT_NOT_A_PARTICIPANT.translation);
  assert.equal(w.count("published_bundles"), 0, "nothing crossed");
});

test("R5, R12 (ratify-authority §4): an owner's signature crosses whoever of a joined member, the founder or the owner delivers it, and the answer names the signer and the deliverer apart", async () => {
  const { w, P, keys } = await ratifyWorld();
  const seen = [];
  for (const [n, deliverer, want] of [["1", "bo", { kind: "member", member: "bo" }], ["2", "founder", { kind: "founder", member: null }],
                                       ["3", "alice", { kind: "member", member: "alice" }]]) {
    const Q = `INQ-2026-940${n}-lead`;
    w.promote(Q, findingMd(Q));
    pinned(w, P, Q, `CASE-2026-000${n}`);
    const r = await ratifyAs(w, keys, { signer: "alice", deliverer, id: Q });
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 600));
    assert.deepEqual([r.body.ok, r.body.attestor, r.body.deliveredBy], [true, "alice", want], deliverer);
    seen.push(w.row(`SELECT attestor_member, delivered_by FROM published_bundles WHERE bundle_id=?`, Q));
  }
  assert.deepEqual(seen, [{ attestor_member: "alice", delivered_by: V("bo") }, { attestor_member: "alice", delivered_by: "founder" },
                          { attestor_member: "alice", delivered_by: V("alice") }]);
});

test("R5, R10 (ratify-authority §5): an outside administrator re-sending a valid owner signature over a finding already published is refused C-56.1, never `existed: true`; the joined member's same act is the ordinary retry, and the chain holds one edition", async () => {
  const { w, P, keys } = await ratifyWorld();
  const Q = "INQ-2026-9401-lead";
  w.promote(Q, findingMd(Q));
  pinned(w, P, Q);
  assert.equal((await ratifyAs(w, keys, { signer: "alice", deliverer: "bo", id: Q })).status, 200);
  const ruth = await ratifyAs(w, keys, { signer: "alice", deliverer: "ruth", id: Q });
  assert.deepEqual([ruth.status, ruth.body.ok, ruth.body.reason, ruth.body.existed === true], [409, false, "PROJECT_ACT_NOT_A_PARTICIPANT", false]);
  const bo = await ratifyAs(w, keys, { signer: "alice", deliverer: "bo", id: Q });
  assert.deepEqual([bo.status, bo.body.ok, bo.body.existed], [200, true, true]);
  assert.equal(w.count("published_bundles"), 1);
});

test("R4, R5, R16 (ratify-authority §8): a finding citing four bundles, one already published, answers `graph` as the commit left it — one served, three held privately, none name-only or dropped; once one held target crosses its reference is served and the unpublished two stay unnamed", async () => {
  const { w, P, keys } = await ratifyWorld();
  const [G2a, G2b, G3, INFO] = ["INFO-2026-9470-signer", "INFO-2026-9470-deliverer", "INFO-2026-9470-served", "INFO-2026-9470-memo"];
  for (const d of [G2a, G2b, G3, INFO]) w.promote(d, cleanInfoMd(d), "information");
  const Q = "INQ-2026-9470-lead";
  w.promote(Q, findingMd(Q, [INFO, G2a, G2b, G3]));
  pinned(w, P, Q);
  for (const d of [G3, INFO]) w.pub.resting.set(d, [{ case_id: "CASE-2026-0001", finding: Q, project: P }]);
  const ev = await ratifyAs(w, keys, { signer: "alice", deliverer: "bo", id: G3 });
  assert.equal(ev.status, 200, JSON.stringify(ev.body).slice(0, 600));
  const fin = await ratifyAs(w, keys, { signer: "alice", deliverer: "alice", id: Q });
  assert.equal(fin.status, 200, JSON.stringify(fin.body).slice(0, 600));
  assert.deepEqual(fin.body.graph, { serve: 1, name: 0, held: 3, dropped: 0 });
  const served = () => w.st.sql.exec(`SELECT to_bundle FROM published_edges WHERE from_bundle=? AND disclosure='serve' ORDER BY to_bundle`, Q)
    .map((r) => r.to_bundle);
  assert.deepEqual(served(), [G3]);
  assert.equal((await ratifyAs(w, keys, { signer: "alice", deliverer: "founder", id: INFO })).status, 200);
  assert.deepEqual(served(), [G3, INFO].sort());
  assert.doesNotMatch(JSON.stringify(w.st.sql.exec(`SELECT * FROM published_edges`)), new RegExp(`${G2a}|${G2b}`));
});

test("R5, R7 (ratify-authority §8c): a bundle no ratified case rests on answers the caller byte for byte the same C-58.3 whether or not a project the caller cannot see has prepared a case over it", async () => {
  const { w, keys } = await ratifyWorld();
  const X = "INFO-2026-9472-unseen";
  w.promote(X, cleanInfoMd(X), "information");
  const ask = async () => { const r = await ratifyAs(w, keys, { signer: "eve", deliverer: "eve", id: X }); return [r.status, JSON.stringify(r.body)]; };
  const before = await ask();
  assert.equal(before[0], 409);
  assert.equal(JSON.parse(before[1]).check, "C-58.3");
  const H = w.project("Hidden", "alice");
  const lead = "INQ-2026-9472-lead";
  w.promote(lead, findingMd(lead, [X]));
  w.caseDoc("CASE-2026-9472", 1, publishedCaseText({ caseId: "CASE-2026-9472", project: H,
    members: [{ id: lead, pin: w.sha(lead), role: "load_bearing" }] }), { owner: H });
  assert.equal(w.membership.inSight(H, V("eve")), false, "the preparing project is hidden from the caller");
  const after = await ask();
  assert.deepEqual(after, before);
  assert.doesNotMatch(after[1], new RegExp(H));
  assert.equal(w.count("published_bundles"), 0);
});

/* ================================================================ ratify-envelope */

const HOST = "assets.example.org";
const BODIES = new Map([["/one.css", "body{color:#111}"], ["/two.css", ".a{margin:0}"]]);
const PARTS = [...BODIES].map(([path, text], i) => ({ address: `https://${HOST}${path}`, primary_sha: String(i).repeat(64),
                                                        host: HOST, address_norm: `${HOST}${path}`, reused_sha: sha(text) }));

const REUSE_DOC = "INFO-2026-7301-envelope";

/** An information bundle a ratified case's finding rests on, ratified by its owner at the Worker half, with the
 *  outbound GET the re-fetch makes answered from BODIES (and counted). */
async function reuseRun({ ops = {}, env = {} } = {}) {
  const w = world();
  const key = await newKey();
  w.member("alice", { signer: key });
  const P = w.project("Team", "alice");
  const DOC = REUSE_DOC;
  w.promote(DOC, cleanInfoMd(DOC), "information");
  w.pub.resting.set(DOC, [{ case_id: "CASE-2026-0001", finding: "INQ-2026-0001-finding", project: P }]);
  Object.assign(w.ops, ops);
  const p = plane(w);
  Object.assign(p.ctx.env, env);
  const fetched = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (u) => {
    const url = new URL(String(u instanceof Request ? u.url : u));
    fetched.push(url.href);
    const b = url.hostname === HOST ? BODIES.get(url.pathname) : undefined;
    return b === undefined ? new Response("gone", { status: 404 }) : new Response(b, { headers: { "content-type": "text/css" } });
  };
  try {
    const res = await ratifyOp(p.request({ bundleId: DOC, expectedSha: w.sha(DOC), sig: await signBundle(key, DOC, w.sha(DOC)) }), p.stub, p.ctx);
    return { ...res, w, DOC, fetched };
  } finally { globalThis.fetch = real; }
}
const BUDGET_ONE = { RATIFY_REFETCH_BUDGET: "1", RATIFY_REFETCH_MARGIN: "0" };
const notAttempted = (r) => (r.body.reuse?.outcomes ?? []).find((o) => o.verdict === "not_attempted")?.basis ?? "";

test("R6 (ratify-envelope site 2): a bundle that genuinely reused nothing carries no reuse key; a reusedparts silence still ratifies and states the undetermined in its own words, with no tally, outcomes or count", async () => {
  const plain = await reuseRun();
  assert.deepEqual([plain.status, plain.body.ok, "reuse" in plain.body], [200, true, false]);
  const silent = await reuseRun({ ops: { reusedparts: () => SILENT } });
  assert.deepEqual([silent.status, silent.body.ok, silent.body.reuse.ok, silent.body.reuse.reason, silent.body.reuse.op],
    [200, true, false, "STORE_SILENT", "ratify/reusedparts"]);
  assert.match(silent.body.reuse.note, /NOT the same as no part having been reused/);
  assert.match(silent.body.reuse.note, /Re-ratifying converges it/);
  for (const k of ["reused_parts", "outcomes", "confirmed", "not_attempted", "budget"]) assert.equal(k in silent.body.reuse, false, k);
  assert.equal(silent.w.count("published_bundles"), 1, "the commit landed");
});

test("R6 (ratify-envelope site 2): a budget-bounded report — two reused parts under a budget of one: one re-fetched with a plain GET and confirmed by our own hash, one not_attempted with a basis naming the ceiling; the answered ceiling is stated and every outcome is handed to the record", async () => {
  /* capture's own reused parts and its own recorder (its `fixtures.mjs`, made by its real code), read back from its record */
  const rv = recordReuseVerdicts({ bundleId: REUSE_DOC, host: HOST, parts: [...BODIES].map(([path, text]) => ({ address: `https://${HOST}${path}`, text })) });
  const r = await reuseRun({ env: BUDGET_ONE, ops: rv.ops });
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 400));
  assert.deepEqual([r.body.reuse.reused_parts, r.body.reuse.budget, r.body.reuse.confirmed, r.body.reuse.changed,
                    r.body.reuse.unavailable, r.body.reuse.not_attempted], [2, 1, 1, 0, 0, 1]);
  assert.deepEqual(r.fetched, [rv.parts[0].address], "one GET, the budget's one");
  assert.deepEqual(r.body.reuse.outcomes.map((o) => [o.address_norm, o.verdict, o.observed_sha]),
    [[rv.parts[0].address_norm, "confirmed", rv.parts[0].reused_sha], [rv.parts[1].address_norm, "not_attempted", null]]);
  assert.match(notAttempted(r), /none observed/);
  assert.deepEqual(["ceiling" in r.body.reuse, r.body.reuse.ceiling, "ceiling_unread" in r.body.reuse, "recorded" in r.body.reuse],
    [true, null, false, false]);
  assert.deepEqual(rv.recorded().map((v) => v.verdict).sort(), ["confirmed", "not_attempted"], "capture's record holds the two verdicts");
});

test("R6 (ratify-envelope site 7): a capturelimit silence does not write `none observed` — the not_attempted basis says the ceiling was UNREAD and the budget our own appetite; `ceiling` gives way to `ceiling_unread`; it still ratifies", async () => {
  const r = await reuseRun({ env: BUDGET_ONE, ops: { reusedparts: () => ({ parts: PARTS }), capturelimit: () => SILENT } });
  assert.deepEqual([r.status, r.body.ok], [200, true]);
  const basis = notAttempted(r);
  assert.doesNotMatch(basis, /none observed/);
  assert.match(basis, /UNREAD/);
  assert.match(basis, /not a calibrated ceiling/);
  assert.equal("ceiling" in r.body.reuse, false);
  assert.deepEqual([r.body.reuse.ceiling_unread.reason, r.body.reuse.ceiling_unread.op], ["STORE_SILENT", "ratify/capturelimit"]);
});

test("R6 (ratify-envelope site 8): a recordreuseverdicts silence hands the outcomes over and says whether they reached the record — `recorded` names the silence and that their absence is not evidence they were never checked; nothing reached the store", async () => {
  const recorded = [];
  const r = await reuseRun({ env: BUDGET_ONE, ops: { reusedparts: () => ({ parts: PARTS }),
                                                     recordreuseverdicts: (url, body) => { recorded.push(body); return SILENT; } } });
  assert.deepEqual([r.status, r.body.ok, r.body.reuse.outcomes.length], [200, true, 2]);
  assert.deepEqual([r.body.reuse.recorded.ok, r.body.reuse.recorded.reason, r.body.reuse.recorded.op],
    [false, "STORE_SILENT", "ratify/recordreuseverdicts"]);
  assert.match(r.body.reuse.recorded.note, /do not read their absence/);
  assert.equal(r.w.count("published_bundles"), 1, "the commit landed");
});

test("R4 (ratify-envelope site 1): a reference the store genuinely does not hold is GATE_REFUSED C-6.2 in the catalogue's words; a reference that resolves crosses; a list silence is never that finding", async () => {
  const w = world();
  const key = await newKey();
  w.member("alice", { signer: key });
  const P = w.project("Team", "alice");
  const [TARGET, CITER, DANGLER] = ["INFO-2026-7301-target", "INFO-2026-7302-citer", "INFO-2026-7303-dangler"];
  const citing = (id, ref) => cleanInfoMd(id).replace("references: []",
    `references:\n  - rel: cites\n    target: ${ref}\n    status: confirmed\n    note: ""`);
  w.promote(TARGET, cleanInfoMd(TARGET), "information");
  w.promote(CITER, citing(CITER, TARGET), "information");
  w.promote(DANGLER, citing(DANGLER, "INFO-2026-9999-never-existed"), "information");
  for (const d of [CITER, DANGLER]) w.pub.resting.set(d, [{ case_id: "CASE-2026-0001", finding: "INQ-2026-0001-finding", project: P }]);
  const run = async (id) => {
    const p = plane(w);
    return ratifyOp(p.request({ bundleId: id, expectedSha: w.sha(id), sig: await signBundle(key, id, w.sha(id)) }), p.stub, p.ctx);
  };
  const dangling = await run(DANGLER);
  assert.deepEqual([dangling.status, dangling.body.reason, dangling.body.findings.map((x) => x.check)], [409, "GATE_REFUSED", ["C-6.2"]]);
  assert.ok(dangling.body.findings.some((x) => x.detail.includes(localize("record-grammar.bundle.references_i_target_t_does_2",
    "references[{i}].target '{t}' does not resolve in the store", { i: "0", t: "INFO-2026-9999-never-existed" }))));
  w.ops.list = () => SILENT;
  const silent = await run(CITER);
  assert.deepEqual([silent.status, silent.body.op, "findings" in silent.body], [502, "ratify/list", false]);
  assert.doesNotMatch(JSON.stringify(silent.body), /does not resolve in the store/);
  delete w.ops.list;
  const good = await run(CITER);
  assert.deepEqual([good.status, good.body.ok], [200, true]);
});
