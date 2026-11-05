/* run-productions: the provider notice inquiry:360 (PR 360; inquiry R87–R90: setSubject, subjectHistory, the subject's
   private-person warning, a part's subject change). This module calls none of the new ops; it reaches inquiry through
   R25's `onMachinePassage` registration and, for R26, through inquiry's R64 refusal of a divided question, which
   basis-versions relays. PR 360 opened R64's door to one revision only: setSubject's own, decided on inquiry's private
   state. So a suggestion on a divided question is still refused DIVIDED_CANNOT_RESTRUCTURE (R26), including after the
   question's subject was changed, and a suggestion on an open question whose subject was set lands (R4) and leaves the
   subject as the member set it. Code confirmed unchanged. Driven on inquiry's real world with the real inquiry,
   basis-versions, promotion and entities (K4990); the run is the one stand-in, as this module's fixture holds it. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, V } from "../inquiry/fixture.mjs";
import { basisVersionsOf } from "../../../src/basis-versions/index.mjs";
import { runProductionsOf } from "../../../src/run-productions/index.mjs";

const AT = "2026-09-28T01:00:00Z";
const A = "INFO-2026-5401-a", B = "INFO-2026-5402-b";
const Q = "INQ-2026-5401-q", C1 = "INQ-2026-5402-a", C2 = "INQ-2026-5403-b";
const E1 = "ENT-2026-5401", E2 = "ENT-2026-5402";

function setup() {
  const w = world(); w.doc(A); w.doc(B);
  w.entity(E1, "Harbor Board"); w.entity(E2, "Paving Office");
  w.member("alice");
  w.inquiry(Q, { legs: [{ target: A }, { target: B }] });
  const bv = basisVersionsOf(w.host, { record: w.record, membership: w.membership, promotion: w.promotion, content: w.content });
  bv.migrate();
  const run = { run: "RUN-1", status: "running", mode: "check", context_type: "inquiry", context_id: Q, principal_plane: V("alice") };
  const aiRuns = { runFor: (r) => (r === "RUN-1" ? { ...run } : null), boundOf: () => null, consumeBound: () => ({ ok: true }) };
  const p = runProductionsOf(w.host, { record: w.record, membership: w.membership, content: w.content, connections: w.connections,
    extraction: w.extraction, basisVersions: bv, inquiry: w.k, aiRuns, now: () => Date.parse(AT) });
  p.migrate();
  const setSubject = (subject, reason) => w.k.setSubject({ target: Q, subject, reason, viewer: "admin", author: V("alice") });
  const suggest = (name) => p.suggest({ target: Q, kind: "basis-version", run: "RUN-1", name,
    description: "the board signed the approval", claim: "the board signed it", relationship: "and",
    legs: [{ target: A, role: "supports", ground: "paper" }],
    grounds: [{ ground: "paper", statement: "the paper trail of the approval" }],
    author: V("alice"), viewer: V("alice"), caller: V("alice") });
  return { w, setSubject, suggest };
}

test("notice inquiry:360 (run-productions R26): on a divided question whose subject a member has just changed, a suggestion is still refused DIVIDED_CANNOT_RESTRUCTURE and the document is byte-identical", () => {
  const { w, setSubject, suggest } = setup();
  const d = w.k.divide({ target: Q, reason: "two questions", viewer: "admin", author: V("alice"),
    children: [{ id: C1, question: "First half?", legs: [0] }, { id: C2, question: "Second half?", legs: [1] }] });
  assert.equal(d.ok, true, JSON.stringify(d).slice(0, 300));
  const s = setSubject(E2, "the parent is about the office");
  assert.equal(s.ok, true, "PR 360's premise: setSubject's own revision passes R64's door " + JSON.stringify(s).slice(0, 300));
  assert.equal(w.fm(Q).current_state, "divided");
  const text = w.text(Q);
  const r = suggest("after-subject");
  assert.deepEqual([r.ok, r.code, r.from, r.wrote], [false, "DIVIDED_CANNOT_RESTRUCTURE", "divided", false], JSON.stringify(r).slice(0, 300));
  assert.equal(w.text(Q), text, "the question's document is unchanged");
  assert.equal(w.fm(Q).subject_entity, E2);
});

test("notice inquiry:360 control (run-productions R4): on an open question whose subject a member set, a suggestion lands and leaves the subject and its history as the member left them", () => {
  const { w, setSubject, suggest } = setup();
  assert.equal(setSubject(E1, "the board signed it").ok, true);
  const before = w.k.subjectHistory({ id: Q, viewer: "admin" });
  const r = suggest("with-subject");
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
  assert.deepEqual([r.state, r.wrote], ["suggested", true]);
  assert.equal(w.k.subjectEntityOf(Q), E1);
  assert.deepEqual(w.k.subjectHistory({ id: Q, viewer: "admin" }).changes, before.changes, "a suggestion is no subject change");
});
