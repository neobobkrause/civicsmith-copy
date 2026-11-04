/* publication — T47 (T47-27; N952, N908): R53's answer names the fields R62, R70 and R72 attribute to it (`timeline`,
   `criteria` and `document`'s `signed_at` and `published_at`), and R23's dead answer with no review provider is the one
   `case-inputs` reads (its R1's grant doors). `standards` and `entities` are stand-ins answering the shapes of
   `standards.standardRead` (its R5), `standards.bindsAt` (its R43) and `entities.readEntity` (its R5), as `t35.test.mjs`
   gives them. Driven at the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planeWorld as world, infoMd, V, NOW, sha, absentStandard } from "./fixture.mjs";

const CASE = "CASE-2026-0001", STD = "STD-2026-0001-policy", CLERK = "ENT-2026-0001", C1 = "a1".repeat(32);
const TIMELINE = [
  { lane: "we_did", ord: 1, when: "2026-09-02", label: "We asked for the minutes.", ref: "ACT-2026-0001", source: "docket:1" },
  { lane: "they_did", ord: 1, when: "2026-09-03", label: "The body met.", ref: "EVT-aaaaaaaaaaaaaaaa", source: sha("cap-1") },
];
/* R53's answer, as its T47 clause lists it. */
const R53_KEYS = ["caseId", "edition", "group", "project", "bar", "scope", "document", "bias_acknowledgement", "completeness",
                  "timeline", "opened", "ratified_at", "manifest_sha", "criteria", "complete", "awaiting", "findings", "detail",
                  /* R81, R82 (T53; amends R53): the two passage statements frozen at the commit */
                  "ungraded_passages", "typed_passages"];

const standardsOf = () => ({
  standardRead: ({ id }) => (id === STD
    ? { ok: true, id, cite: "AI 4.12 §3", designation: "AI 4.12", edition: "2024", access: "free",
        owner: { label: "Public Works" }, requires: [C1], texts: [{ content_id: C1 }],
        requires_quoted: [{ content_id: C1, text: "Each request is logged." }] }
    : absentStandard(id)),
  bindsAt: ({ standard, body }) => ({ ok: true, state: standard === STD && body === CLERK ? "binds" : "undetermined" }),
});
const entitiesOf = () => ({ readEntity: ({ entityId }) => ({ ok: true, found: true, entity: { label: "City Clerk", entity_id: entityId } }) });

/* A case edition signed at NOW whose document states a timeline and whose one member targets a standard. */
function signed() {
  const w = world({ standards: standardsOf(), entities: entitiesOf() });
  w.member("olive");
  const proj = w.project("Parks", "olive");
  const id = "INFO-2026-0101-first";
  const r = w.promote(id, infoMd(id).replace("references: []", [`subject_entity: ${CLERK}`, "basis:", `  - target: ${STD}`,
    "    role: supports", `    content_id: ${C1}`, "references: []"].join("\n")), "information");
  assert.equal(r.ok, true, JSON.stringify(r));
  const roles = [{ target: id, version_sha: r.bundleSha }];
  w.prepare(CASE, 1, { project: proj, roles, timeline: TIMELINE });
  const c = w.signCase(CASE, 1, { project: proj, roster: roles.map((x) => ({ bundle_id: x.target, version_sha: x.version_sha })) });
  assert.equal(c.ok, true, JSON.stringify(c));
  return w;
}

test("R53 (T47) caseEditionState answers exactly the fields its T47 clause lists: document carries signed_at and published_at (R70), timeline is the signed document's timeline block, the lanes apart (R62's editionTimeline, R63), criteria R72's rows as frozen", () => {
  const w = signed();
  const s = w.p.caseEditionState(CASE, 1);
  assert.deepEqual(Object.keys(s).sort(), [...R53_KEYS].sort(), "no field but those R53 names; criteria_detail only before T35");
  assert.deepEqual([s.document.signed_at, s.document.published_at], [NOW, NOW], "R70: signed and published at the commit");
  const t = w.p.editionTimeline({ case: CASE, edition: 1 });
  assert.equal(t.ok, true);
  assert.deepEqual(s.timeline, { they_did: t.they_did, we_did: t.we_did }, "R62's editionTimeline, the lanes apart");
  assert.deepEqual([s.timeline.we_did.length, s.timeline.they_did.length], [1, 1], "each lane holds its row");
  assert.deepEqual(s.criteria, JSON.parse(w.row(`SELECT criteria FROM published_cases WHERE case_id=? AND edition=1`, CASE).criteria),
                   "R72's rows as frozen on the edition's row");
  assert.deepEqual(s.criteria.map((x) => [x.standard, x.binds, x.label]), [[STD, true, "Standard · binds City Clerk"]]);
});

test("R53 (T47) an edition committed before T35 answers criteria null with criteria_detail stating them not recorded, its only other field; control: a frozen [] answers no criteria_detail", () => {
  const w = signed();
  w.p.sql.exec(`UPDATE published_cases SET criteria=NULL WHERE case_id=? AND edition=1`, CASE);
  const s = w.p.caseEditionState(CASE, 1);
  assert.deepEqual(Object.keys(s).sort(), [...R53_KEYS, "criteria_detail"].sort());
  assert.equal(s.criteria, null);
  assert.match(s.criteria_detail, /not recorded/);
  w.p.sql.exec(`UPDATE published_cases SET criteria='[]' WHERE case_id=? AND edition=1`, CASE);
  const c = w.p.caseEditionState(CASE, 1);
  assert.deepEqual([c.criteria, "criteria_detail" in c], [[], false]);
});

test("R53 (T47) timeline and document are null until the edition is ratified (its document signed); control: the signed edition answers both", () => {
  const w = signed();
  const OTHER = "CASE-2026-0009";
  /* a published_cases row whose document is not signed: the edition exists and is not ratified */
  w.p.sql.exec(`INSERT INTO published_cases (case_id,edition,opened,criteria) VALUES (?,1,?,'[]')`, OTHER, NOW);
  const u = w.p.caseEditionState(OTHER, 1);
  assert.deepEqual([u.document, u.timeline], [null, null]);
  const s = w.p.caseEditionState(CASE, 1);
  assert.ok(s.document && s.timeline, "the signed edition states its document and timeline");
});

test("R23 (T47) with no review provider, every grant door case-inputs reads through reviewProvider() answers dead: no grant admits, no live grant, the dead answer NO_REVIEW_COPY, and an unsigned document stays unreadable to a stranger with a secret; control: a registered provider's grant admits", () => {
  const w = world();
  w.member("olive");
  const proj = w.project("Parks", "olive");
  w.doc("INFO-2026-0001-minutes");
  w.inquiry("INQ-2026-0001", { legs: [{ target: "INFO-2026-0001-minutes" }] });
  w.prepare(CASE, 1, { project: proj, roles: [{ target: "INQ-2026-0001", version_sha: w.head("INQ-2026-0001") }] });
  const secret = "b".repeat(64);
  const none = w.p.reviewProvider();
  assert.equal(none.registered, false);
  assert.equal(none.grantAdmitsCaseEdition(secret, CASE, 1), false);
  assert.equal(none.liveGrant(secret), null);
  assert.deepEqual(none.deadAnswer(), { ok: false, reason: "NO_REVIEW_COPY", code: "NO_REVIEW_COPY" });
  assert.equal(w.p.caseDocument(CASE, 1, null, secret).reason, "NO_CASE_DOCUMENT", "no grant admits");
  const reg = w.p.registerReviewProvider("review", {
    draftForMember: () => null, draftIdentity: () => null, caseIdentitySentence: () => null, statedEdition: () => null,
    liveGrant: (s) => (s === secret ? { live: true } : null),
    grantAdmitsCaseEdition: (s, c, e) => s === secret && c === CASE && Number(e) === 1,
    deadAnswer: () => ({ ok: false, reason: "NO_REVIEW_COPY" }) });
  assert.equal(reg.ok, true);
  assert.equal(w.p.reviewProvider().grantAdmitsCaseEdition(secret, CASE, 1), true);
  assert.equal(w.p.caseDocument(CASE, 1, null, secret).ok, true, "the live grant admits exactly this edition");
  assert.equal(w.p.caseDocument(CASE, 1, V("nobody"), "c".repeat(64)).reason, "NO_CASE_DOCUMENT");
});
