/* publication — T41 (T41-36): the source of waiting editions (R77; N823, K2438), through which R21's waiting clause and
   R70's set-time signing instant read the editions `publish-schedule` holds (its R8, a later module: each test registers
   a stand-in answering exactly R77's three doors); and the published-work fact membership's handle guard asks (R76;
   DEC-186 (1), N799), registered at start with the real membership (its R125). Driven at the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planeWorld as world, caseDoc, V, SIG, KEY, NOW } from "./fixture.mjs";
import { memberTieLines } from "../../../src/case-grammar/index.mjs";
import * as PUB from "../../../src/publication/index.mjs";

const F = "INQ-2026-0001", CASE = "CASE-2026-0001", CASE2 = "CASE-2026-0002";
const docOf = (w, c = CASE, e = 1) => w.row(`SELECT doc_sha, text, sig_armored FROM case_documents WHERE case_id=? AND edition=?`, c, e);

function base() {
  const w = world();
  for (const m of ["olive", "bo", "cy", "dee", "eve", "fay", "gus"]) w.member(m);
  const proj = w.project("Parks", "olive");
  w.inquiry(F);
  const roles = [{ target: F, version_sha: w.head(F) }];
  const roster = roles.map((r) => ({ bundle_id: r.target, version_sha: r.version_sha }));
  return { w, proj, roles, roster };
}
/* publish-schedule R8's registration, played: `waiting` the case editions it holds waiting (`<case>#<edition>` → the
   instant signed), `signers` who signed and delivered each (`<case>#<edition>` → {signer, delivered_by}), every call
   kept with whether a transaction was open when it was made. */
function source(w, waiting = {}, signers = {}) {
  const calls = [];
  const open = () => w.st.db.isTransaction;
  const held = (c, e) => Object.hasOwn(waiting, `${c}#${e}`);
  return { calls, waiting, signers,
    isWaiting(c, e) { calls.push(["isWaiting", c, e, open()]); return held(c, e); },
    signedAtOf(c, e) { calls.push(["signedAtOf", c, e, open()]); return waiting[`${c}#${e}`] ?? null; },
    signerOf(c, e) { calls.push(["signerOf", c, e, open()]); return held(c, e) ? signers[`${c}#${e}`] ?? null : null; } };
}

/* ---------------------------------------------------------------- R77 */

test("R77 registerWaitingEditions takes the source (isWaiting, signedAtOf, signerOf; K2529) once at start: one missing a door PROVIDER_MALFORMED, a second PROVIDER_DECLARED naming the holder, each registering nothing; with none registered no edition waits and no signing instant is answered", () => {
  const { w, proj, roles, roster } = base();
  assert.deepEqual(w.p.waitingSource(), { registered: false, module: null });
  const doors = { isWaiting() {}, signedAtOf() {}, signerOf() {} };
  const without = (d) => Object.fromEntries(Object.entries(doors).filter(([k]) => k !== d));
  for (const bad of [null, {}, without("isWaiting"), without("signedAtOf"), without("signerOf"), { ...doors, isWaiting: 1 }, "x"])
    assert.equal(w.p.registerWaitingEditions("publish-schedule", bad).reason, "PROVIDER_MALFORMED", JSON.stringify(bad));
  assert.equal(w.p.registerWaitingEditions({ isWaiting() {} }).reason, "PROVIDER_MALFORMED", "the one-argument form");
  assert.deepEqual(w.p.waitingSource(), { registered: false, module: null }, "nothing registered");
  /* none registered: today's behaviour of a store holding no waiting edition */
  w.prepare(CASE, 1, { project: proj, roles });
  const again = w.p.storeCaseDocument({ case: CASE, edition: 1, text: docOf(w).text + "\nchanged", author: V("olive") });
  assert.equal(again.stored, true, "an unsigned preparation is replaced: none waits");
  assert.equal(w.signCase(CASE, 1, { project: proj, roster, at: "2026-09-28T03:00:00Z" }).ok, true);
  assert.deepEqual(w.row(`SELECT signed_at, published_at FROM published_cases WHERE case_id=?`, CASE),
                   { signed_at: "2026-09-28T03:00:00Z", published_at: "2026-09-28T03:00:00Z" }, "the commit's own instant");
  /* registered once, either form; a second refused, the first kept */
  const s = source(w);
  assert.deepEqual(w.p.registerWaitingEditions("publish-schedule", s), { ok: true, module: "publish-schedule" });
  const dup = w.p.registerWaitingEditions({ module: "other", isWaiting: () => true, signedAtOf: () => null, signerOf: () => null });
  assert.deepEqual([dup.ok, dup.reason, dup.module], [false, "PROVIDER_DECLARED", "publish-schedule"]);
  assert.deepEqual(w.p.waitingSource(), { registered: true, module: "publish-schedule" });
  const w2 = base().w;
  assert.deepEqual(w2.p.registerWaitingEditions({ module: "publish-schedule", ...source(w2) }), { ok: true, module: "publish-schedule" });
});

test("R77 (N823, K2438) publishing at a set time is publish-schedule's: this module serves none of its services, re-exports none of its names and creates no table of its; R21 and R70 work with no such table, reading only through the source", () => {
  const { w, proj, roles, roster } = base();
  for (const m of ["registerScheduledPublisher", "scheduledPublisher", "onPublishScheduled", "publishListeners", "scheduleEdition",
                   "publishWake", "publishDue", "publishAtMove", "publishAtCancel", "scheduledEditions", "groupZone", "waitingEditionOf"])
    assert.equal(m in w.p, false, `${m} is publish-schedule's`);
  for (const x of ["SCHEDULED_EDITIONS_MAX", "SCHEDULE_STATES", "SCHEDULED_CHECK_UNAVAILABLE", "publishScheduleOf"])
    assert.equal(x in PUB, false, `${x} is not re-exported`);
  assert.equal(w.row(`SELECT name FROM sqlite_master WHERE name='scheduled_editions'`), null, "no table of publish-schedule's");
  /* with no such table, R21 stores and replaces and R70's commit answers its own instant */
  w.prepare(CASE, 1, { project: proj, roles });
  assert.equal(w.p.storeCaseDocument({ case: CASE, edition: 1, text: docOf(w).text + "\nchanged", author: V("olive") }).stored, true);
  assert.equal(w.signCase(CASE, 1, { project: proj, roster }).ok, true);
  assert.deepEqual(w.row(`SELECT signed_at, published_at FROM published_cases WHERE case_id=?`, CASE), { signed_at: NOW, published_at: NOW });
  /* the control: the seam itself is this module's */
  assert.equal(typeof w.p.registerWaitingEditions, "function");
});

/* ---------------------------------------------------------------- R21's waiting clause, through R77 */

test("R21 R77 a document the source answers waiting counts as signed: neither storeCaseDocument nor reauthorSection replaces or re-authors it, the source asked inside the caller's transaction before anything is written; an edition it does not hold, or once it no longer waits, is an unsigned preparation", () => {
  const { w, proj, roles } = base();
  w.prepare(CASE, 1, { project: proj, roles });
  w.prepare(CASE2, 1, { project: proj, roles });
  const s = source(w, { [`${CASE}#1`]: NOW });
  w.p.registerWaitingEditions("publish-schedule", s);
  const held = docOf(w), before = w.snapshot();
  const st = w.record.transact(() => w.p.storeCaseDocument({ case: CASE, edition: 1, text: held.text + "\nchanged", author: V("olive") }));
  assert.deepEqual([st.ok, st.stored, st.doc_sha], [true, false, held.doc_sha], "answers what the store holds");
  const a = w.record.transact(() => w.p.reauthorSection({ case: CASE, edition: 1, docSha: held.doc_sha, section: "acknowledgements",
                                                         lines: { frontmatter: [], body: [] } }));
  assert.deepEqual([a.ok, a.reauthored, a.doc_sha], [true, false, held.doc_sha]);
  assert.match(a.why, /waits to be published/);
  assert.deepEqual(w.snapshot(), before, "nothing written");
  assert.ok(s.calls.length >= 2 && s.calls.every(([door, c, e, open]) => door === "isWaiting" && c === CASE && e === 1 && open),
            "asked of this case edition, synchronously, inside the caller's transaction");
  /* negative controls: another edition, which the source does not hold, is replaced; and this one once it no longer waits
     (publish-schedule R3's cancel) */
  assert.equal(w.p.storeCaseDocument({ case: CASE2, edition: 1, text: docOf(w, CASE2).text + "\nchanged", author: V("olive") }).stored, true);
  delete s.waiting[`${CASE}#1`];
  assert.equal(w.p.storeCaseDocument({ case: CASE, edition: 1, text: held.text + "\nchanged", author: V("olive") }).stored, true,
               "a preparation again");
  assert.equal(docOf(w).sig_armored, null);
});

/* ---------------------------------------------------------------- R70, through R77 */

test("R70 R77 at the commit signed_at is the source's signedAtOf for an edition published at a set time, published_at the commit's instant; when it answers null, both are the commit's instant; held on the row and answered in R53's document and R1's answer", () => {
  const { w, proj, roles, roster } = base();
  for (const c of [CASE, CASE2]) w.prepare(c, 1, { project: proj, roles });
  const s = source(w, { [`${CASE2}#1`]: "2026-09-28T01:30:00Z" });
  w.p.registerWaitingEditions("publish-schedule", s);
  /* publish-schedule's publisher commits a due edition while it still waits (its R2) */
  assert.equal(w.signCase(CASE2, 1, { project: proj, roster, at: "2026-10-01T12:00:05Z" }).ok, true);
  assert.ok(s.calls.some(([door, c, e, open]) => door === "signedAtOf" && c === CASE2 && e === 1 && open), "asked inside the commit");
  const d2 = w.p.caseEditionState(CASE2, 1).document;
  assert.deepEqual([d2.signed_at, d2.published_at], ["2026-09-28T01:30:00Z", "2026-10-01T12:00:05Z"]);
  const r2 = w.p.caseDocument(CASE2, 1, null);
  assert.deepEqual([r2.signed_at, r2.published_at], ["2026-09-28T01:30:00Z", "2026-10-01T12:00:05Z"]);
  /* negative control: an edition published at signing, which the source answers null for: one instant */
  assert.equal(w.signCase(CASE, 1, { project: proj, roster, at: "2026-09-28T02:00:00Z" }).ok, true);
  assert.deepEqual(w.rows(`SELECT case_id, signed_at, published_at FROM published_cases ORDER BY case_id`),
                   [{ case_id: CASE, signed_at: "2026-09-28T02:00:00Z", published_at: "2026-09-28T02:00:00Z" },
                    { case_id: CASE2, signed_at: "2026-09-28T01:30:00Z", published_at: "2026-10-01T12:00:05Z" }]);
});

/* ---------------------------------------------------------------- R76 */

/* A case document with the rows that carry a handle: `attest` a member's `material_attestations:` row ({by, level}),
   `ties` `member_ties:` rows ({shown, level}), `attributions` `observation_attributions:` rows ({shown, level}). */
function docWith(caseId, edition, proj, roles, { attest = [], ties = [], attributions = null } = {}) {
  const text = caseDoc(caseId, edition, { project: proj, roles,
    attestations: attest.map((a) => ({ ref: "INFO-2026-0009-x", by_kind: "member", by: a.by, level: a.level, at: NOW, signature: SIG(5), recorded_in: null })),
    ...(attributions ? { attributions: attributions.map((a) => ({ observation: "OBS-2026-0001", chosen_at_edition: 1, ...a })) } : {}) });
  if (!ties.length) return text;
  const lines = memberTieLines(ties.map((t) => ({ row: "tie", signer: null, at: null, entity: "ENT-2026-0001", kind: "employer", ...t })));
  const i = text.indexOf("\n---\n", 4);
  return `${text.slice(0, i)}\n${lines.join("\n")}${text.slice(i)}`;
}
const store = (w, caseId, edition, text, author = "olive") =>
  assert.equal(w.p.storeCaseDocument({ case: caseId, edition, text, author: V(author), at: NOW }).ok, true);
const commit = (w, proj, roster, caseId, { signer = "olive", deliveredBy = V(signer), at = NOW } = {}) =>
  w.record.transact(() => w.p.commitCaseEdition({ case: caseId, edition: 1, project: proj, scope: "The question.", roster,
    sigArmored: SIG(1), attestorKey: KEY, attestorMember: signer, gateVersion: "plane-gate/test", deliveredBy, at }));

test("R76 publishedWorkOf names the earliest ratified case edition whose signer, deliverer or preparer is the member, or whose document names the member's handle in a row that carries one (an attestation, a tie, an attribution, at cover or name); null otherwise; it writes nothing", () => {
  const { w, proj, roles, roster } = base();
  /* CASE: signed by olive, delivered by bo, prepared by cy; it names dee's handle in an attestation at name, eve's in a
     tie at name and fay's in an attribution at cover; and gus's only where a row carries no handle (an attribution at
     project, an attestation at group) and in prose */
  store(w, CASE, 1, docWith(CASE, 1, proj, roles, {
    attest: [{ by: "h_dee", level: "name" }, { by: "h_gus", level: "group" }],
    ties: [{ shown: "h_eve", level: "name" }],
    attributions: [{ shown: "h_fay", level: "cover" }, { shown: "h_gus", level: "project" }] }).replace("Everything.", "Everything h_gus said."), "cy");
  assert.equal(commit(w, proj, roster, CASE, { signer: "olive", deliveredBy: V("bo"), at: "2026-09-28T05:00:00Z" }).ok, true);
  const before = w.snapshot();
  for (const m of ["olive", "bo", "cy", "dee", "eve", "fay"])
    assert.deepEqual(w.p.publishedWorkOf({ memberId: m }), { case: CASE, edition: 1 }, m);
  assert.equal(w.p.publishedWorkOf({ memberId: "gus" }), null, "a handle where no row carries one (group, project, prose) names nobody");
  assert.equal(w.p.publishedWorkOf({ memberId: "nobody" }), null);
  for (const bad of [undefined, {}, { memberId: "" }, { memberId: 7 }]) assert.equal(w.p.publishedWorkOf(bad), null, JSON.stringify(bad));
  assert.deepEqual(w.snapshot(), before, "writes nothing");
  /* an earlier-signed edition is the one named */
  store(w, CASE2, 1, docWith(CASE2, 1, proj, roles), "dee");
  assert.equal(commit(w, proj, roster, CASE2, { signer: "eve", at: "2026-09-28T04:00:00Z" }).ok, true);
  assert.deepEqual(w.p.publishedWorkOf({ memberId: "dee" }), { case: CASE2, edition: 1 }, "the earliest by signed_at");
  assert.deepEqual(w.p.publishedWorkOf({ memberId: "eve" }), { case: CASE2, edition: 1 });
  assert.deepEqual(w.p.publishedWorkOf({ memberId: "fay" }), { case: CASE, edition: 1 });
});

test("R76 an unsigned preparation is no published work; one R77's source answers waiting is (its signer and deliverer through signerOf, K2529; its preparer; its handle rows), named by the source's signing instant; with no source registered none waits", () => {
  const { w, proj, roles } = base();
  store(w, CASE, 1, docWith(CASE, 1, proj, roles, { ties: [{ shown: "h_eve", level: "cover" }] }), "cy");
  for (const m of ["cy", "eve", "bo", "dee"]) assert.equal(w.p.publishedWorkOf({ memberId: m }), null, `${m}: a preparation, not signed`);
  const s = source(w, { [`${CASE}#1`]: "2026-09-29T00:00:00Z" }, { [`${CASE}#1`]: { signer: "bo", delivered_by: V("dee") } });
  w.p.registerWaitingEditions("publish-schedule", s);
  for (const m of ["cy", "eve", "bo", "dee"])
    assert.deepEqual(w.p.publishedWorkOf({ memberId: m }), { case: CASE, edition: 1 }, `${m}: waiting, signed, its bytes fixed`);
  assert.equal(w.p.publishedWorkOf({ memberId: "gus" }), null, "the negative control: a member it does not name");
  /* the earliest by signed_at: a waiting edition signed before a ratified one is named first */
  store(w, CASE2, 1, docWith(CASE2, 1, proj, roles), "cy");
  assert.equal(commit(w, proj, roles.map((r) => ({ bundle_id: r.target, version_sha: r.version_sha })), CASE2,
                      { signer: "olive", at: "2026-09-30T00:00:00Z" }).ok, true);
  assert.deepEqual(w.p.publishedWorkOf({ memberId: "cy" }), { case: CASE, edition: 1 });
  s.waiting[`${CASE}#1`] = "2026-10-01T00:00:00Z";
  assert.deepEqual(w.p.publishedWorkOf({ memberId: "cy" }), { case: CASE2, edition: 1 });
  /* no longer waiting (cancelled): no work there, its signer's included */
  delete s.waiting[`${CASE}#1`];
  for (const m of ["eve", "bo", "dee"]) assert.equal(w.p.publishedWorkOf({ memberId: m }), null, m);
});

test("R76 when its tables or the source cannot be read it answers {unreadable: true}, never a throw", () => {
  const { w, proj, roles } = base();
  store(w, CASE, 1, docWith(CASE, 1, proj, roles), "cy");
  w.p.registerWaitingEditions("publish-schedule", { isWaiting() { throw new Error("down"); }, signedAtOf: () => null, signerOf: () => null });
  assert.deepEqual(w.p.publishedWorkOf({ memberId: "cy" }), { unreadable: true }, "the source throws");
  const w2 = base().w;
  assert.equal(w2.p.publishedWorkOf({ memberId: "cy" }), null, "the control: readable, none");
  w2.st.db.exec(`ALTER TABLE case_documents RENAME TO gone`);
  assert.deepEqual(w2.p.publishedWorkOf({ memberId: "cy" }), { unreadable: true });
});

/* T46 (K2928; membership R129, DEC-197): no handle is ever changed, so membership's `op=handlechange` refuses every call
   HANDLE_FIXED before reading anything, naming no case; the guard slot (its R125) and this module's registration stand,
   so reopening a change is one requirement. */
test("R76 at start it is registered once with membership.registerHandleGuard (its R125), the slot this module's; while no handle is changed (membership R129) every change is refused HANDLE_FIXED naming no case, whether or not the member's work is in a published case, and nothing is written", () => {
  const { w, proj, roles, roster } = base();
  assert.deepEqual(w.p.handleGuard, { ok: true, module: "publication" }, "registered at start");
  const dup = w.membership.registerHandleGuard("other", () => null);
  assert.deepEqual([dup.ok, dup.reason, dup.module], [false, "LISTENER_DECLARED", "publication"], "the slot is this module's");
  store(w, CASE, 1, docWith(CASE, 1, proj, roles), "cy");
  assert.equal(commit(w, proj, roster, CASE, { signer: "olive" }).ok, true);
  /* the control: the fact the guard answers stands, olive's work in a published case and gus's in none */
  assert.deepEqual(w.p.publishedWorkOf({ memberId: "olive" }), { case: CASE, edition: 1 });
  assert.equal(w.p.publishedWorkOf({ memberId: "gus" }), null);
  const before = w.snapshot();
  const fixed = w.membership.handleChange({ handle: "olive-new", by: "olive" });
  const none = w.membership.handleChange({ handle: "gus-new", by: "gus" });
  for (const [who, a] of [["olive", fixed], ["gus", none]]) {
    assert.deepEqual([a.ok, a.reason, a.code], [false, "HANDLE_FIXED", "HANDLE_FIXED"], who);
    assert.equal("case" in a || "edition" in a, false, `${who}: no case is named`);
  }
  assert.deepEqual(fixed, none, "one answer, so the published-work fact decides nothing");
  assert.deepEqual(w.snapshot(), before, "nothing written: no handle changes");
  assert.deepEqual(w.rows(`SELECT member_id, handle FROM members WHERE member_id IN ('olive','gus') ORDER BY member_id`),
                   [{ member_id: "gus", handle: "h_gus" }, { member_id: "olive", handle: "h_olive" }]);
});
