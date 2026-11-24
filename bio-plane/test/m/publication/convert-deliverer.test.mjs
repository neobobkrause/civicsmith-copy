/* publication — converted from `bio-plane/test/deliverer.test.mjs` (layer 8, publication's share): R1 the founder's
   standing on an unsigned case document (since T41, D54: a discoverable project's, never a hidden one's) (block 1b of the old suite, with vera, a member of no project, as its
   stranger); R28 a legacy case document with no deliverer reads undetermined, stated, beside its named signer (block
   6); and R14/R27 where they are this module's: the case document's deliverer is read from the stored column alone,
   never from the signer (block 7's table, at the case document). The old suite, kept by K619, was deleted in T20; its op=ratify,
   container and public-read arms are ratification's and public-read's shares. Driven at the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planeWorld as world, V, SIG, KEY, NOW } from "./fixture.mjs";
import { DELIVERER_UNDETERMINED_DETAIL } from "../../../src/deliverer.mjs";

const CASE = "CASE-2026-9128";
const LEAD = "INQ-2026-9128-lead", INFO = "INFO-2026-9128-memo";
const FOUNDER_IS = { kind: "founder", member: null };
const UNDETERMINED = { kind: "undetermined", member: null, detail: DELIVERER_UNDETERMINED_DETAIL };

/* iris owns the project and authors the case; gus is a joined participant; vera an ordinary member of no project. */
function authored(caseId = CASE) {
  const w = world();
  w.member("iris"); w.member("gus"); w.member("vera");
  const proj = w.project("Deliver", "iris");
  assert.equal(w.membership.projectInvite({ projectId: proj, handle: "h_gus", by: "iris", viewer: V("iris") }).ok, true);
  assert.equal(w.membership.projectJoin({ projectId: proj, by: "gus", viewer: V("gus") }).ok, true);
  w.doc(INFO);
  w.inquiry(LEAD, { legs: [{ target: INFO }] });
  const pin = w.head(LEAD);
  const d = w.prepare(caseId, 1, { project: proj, roles: [{ target: LEAD, version_sha: pin }], author: "iris" });
  return { w, proj, pin, d };
}
/* The case committer as ratification calls it, with the deliverer exactly as handed (or absent, as a plane before
   REC-128 called it). The signer is always iris. */
function commit(w, proj, pin, caseId, deliverer) {
  return w.record.transact(() => w.p.commitCaseEdition({ case: caseId, edition: 1, project: proj, scope: "The question.",
    roster: [{ bundle_id: LEAD, version_sha: pin, role: "load_bearing" }], sigArmored: SIG(1), attestorKey: KEY,
    attestorMember: "iris", gateVersion: "legacy", at: NOW, ...(deliverer === undefined ? {} : { deliveredBy: deliverer }) }));
}

test("R1 R29 (D54) the founder's session (bare `admin` or `member:admin`) reads an unsigned case document of a discoverable project whole, and of a hidden one as a stranger does; a member of no project gets the not-found a stranger gets, byte for byte", () => {
  const { w, proj, d } = authored();
  /* the ground: iris's document awaits its signature */
  const own = w.p.caseDocument(CASE, 1, V("iris"));
  assert.deepEqual([own.ok, own.ratified, own.delivered_by, own.authored_by], [true, false, null, V("iris")]);
  /* D54 (K2408): the founder is in no project, so a hidden project's working material answers it as a case never
     authored, byte for byte, and its standing is none */
  assert.equal(w.membership.visibilityOf(proj), "hidden", "(fixture) hidden until its owner says otherwise");
  for (const founder of ["admin", "member:admin"]) {
    const fr = w.p.caseDocument(CASE, 1, founder);
    assert.equal(fr.reason, "NO_CASE_DOCUMENT", `${founder} at a hidden project`);
    assert.equal(JSON.stringify(fr), JSON.stringify(world().p.caseDocument(CASE, 1, founder)), `${founder}: as never authored`);
    assert.equal(JSON.stringify(w.p.caseDocumentFacts(CASE, 1, founder)), JSON.stringify(world().p.caseDocumentFacts(CASE, 1, founder)));
    assert.equal(w.p.hasCaseStanding(w.row(`SELECT * FROM case_documents`), founder), false);
  }
  /* the negative control: the same project set discoverable is read whole */
  assert.equal(w.membership.projectVisibilitySet({ projectId: proj, setting: "discoverable", by: "iris", viewer: V("iris") }).ok, true);
  for (const founder of ["admin", "member:admin"]) {
    const fr = w.p.caseDocument(CASE, 1, founder);
    assert.deepEqual([fr.ok, fr.ratified, fr.doc_sha], [true, false, d.doc_sha], `${founder}: whole, unratified, the sha to sign`);
    assert.equal(JSON.stringify(fr), JSON.stringify(own), `${founder} reads what the owner reads`);
    assert.equal(JSON.stringify(w.op("casedocument", { case: CASE, edition: 1, viewer: founder })), JSON.stringify(own));
    assert.equal(w.p.caseDocumentFacts(CASE, 1, founder).ok, true, `${founder}: the facts the signing act reads`);
    assert.equal(w.p.hasCaseStanding(w.row(`SELECT * FROM case_documents`), founder), true);
  }
  /* vera: an active ordinary member of this instance participating in no project */
  const anon = w.p.caseDocument(CASE, 1, null);
  const fresh = world();
  const vr = w.p.caseDocument(CASE, 1, V("vera"));
  assert.equal(vr.reason, "NO_CASE_DOCUMENT");
  assert.equal(JSON.stringify(vr), JSON.stringify(anon), "vera is answered exactly as anonymous");
  assert.equal(JSON.stringify(vr), JSON.stringify(fresh.p.caseDocument(CASE, 1, V("vera"))), "and as a case never authored");
  assert.equal(JSON.stringify(w.op("casedocument", { case: CASE, edition: 1, viewer: V("vera") })),
               JSON.stringify(fresh.op("casedocument", { case: CASE, edition: 1, viewer: V("vera") })));
  /* the signing act's facts read (ratification's fence against a member of no project delivering) is the same answer */
  assert.equal(JSON.stringify(w.p.caseDocumentFacts(CASE, 1, V("vera"))),
               JSON.stringify(fresh.p.caseDocumentFacts(CASE, 1, V("vera"))));
  assert.equal(w.p.hasCaseStanding(w.row(`SELECT * FROM case_documents`), V("vera")), false);
  assert.equal(w.p.caseDocument(CASE, 1, V("vera")).ratified, undefined, "nothing of the document leaks");
});

test("R28 R27 a legacy case document committed with no deliverer reads undetermined, stated, with its signer still named and never copied into it", () => {
  const { w, proj, pin } = authored();
  const c = commit(w, proj, pin, CASE, undefined);
  assert.equal(c.ok, true, JSON.stringify(c));
  assert.equal(w.row(`SELECT delivered_by FROM case_documents`).delivered_by, null, "nothing was back-filled into the column");
  for (const viewer of [null, V("vera"), V("iris"), "admin"]) {
    const cd = w.p.caseDocument(CASE, 1, viewer);
    assert.deepEqual([cd.ok, cd.ratified, cd.attestor_member], [true, true, "iris"], "a signed document answers anybody");
    assert.deepEqual(cd.delivered_by, UNDETERMINED, "undetermined, stated with its reason — not iris");
    assert.match(cd.delivered_by.detail, /not inferred from the signer/);
  }
  assert.deepEqual(w.op("casedocument", { case: CASE, edition: 1 }).delivered_by, UNDETERMINED);
  /* R28 is stated, never filled: the case edition's own document says the same */
  assert.deepEqual(w.p.caseEditionState(CASE, 1).document.delivered_by, UNDETERMINED);
});

test("R14 R27 a case document's deliverer is read from its stored column alone: founder, a member other than the signer, or undetermined for anything else, never the signer", () => {
  /* one case per stored value, each signed by iris */
  const table = [["founder", FOUNDER_IS], [V("gus"), { kind: "member", member: "gus" }], [null, UNDETERMINED],
                 ["admin", UNDETERMINED], ["member:", UNDETERMINED], ["iris", UNDETERMINED], [undefined, UNDETERMINED]];
  const rows = [];
  table.forEach(([stored, want], i) => {
    const caseId = `CASE-2026-91${String(i).padStart(2, "0")}`;
    const { w, proj, pin } = authored(caseId);
    assert.equal(commit(w, proj, pin, caseId, stored).ok, true);
    assert.equal(w.row(`SELECT delivered_by FROM case_documents`).delivered_by, stored ?? null, "written as handed");
    const cd = w.p.caseDocument(caseId, 1, null);
    assert.equal(cd.attestor_member, "iris");
    assert.deepEqual(cd.delivered_by, want, `stored ${JSON.stringify(stored)}`);
    rows.push([caseId, cd.attestor_member, cd.delivered_by]);
  });
  /* the old suite's table: no determined deliverer equals its signer, so a deliverer copied from the signer cannot pass */
  assert.deepEqual(rows.filter(([, a, d]) => d.kind === "member" && d.member === a), []);
  assert.equal(rows.filter(([, , d]) => d.kind !== "undetermined").length, 2);
});
