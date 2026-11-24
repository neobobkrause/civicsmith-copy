/* contradiction K5 (N345, DEC-84 item 3): one question, two projects' conclusions — R5, R8, R10, R11, R14 for the fifth
   key, R3's rendering of a stance, and the gate that keeps a K5 candidate unshown until its arm is measured (K488). */
import test from "node:test";
import assert from "node:assert/strict";
import { word } from "../../../src/setup-words/index.mjs";
import { world, sha, MACHINE, MEMBER, OUTSIDER } from "./fixture.mjs";
import { judgementSide, renderJudgementInput, JUDGEMENT_PROMPT, K5_GATE_MEASURED, K5_INQUIRIES_EXAMINED,
         CONTRADICTION_KEYS } from "../../../src/contradiction/index.mjs";

const RUN = "RUN-2026-0001";

function k5World() {
  const w = world();
  w.runs.set(RUN, { status: "running", principal: "member:m1" });
  w.inquiry("INQ-2026-0001-fee");
  w.project("PROJ-2026-0001-a", ["m1"]); w.project("PROJ-2026-0002-b", ["m1"]); w.project("PROJ-2026-0003-c", ["m1"]);
  w.stance("PROJ-2026-0001-a", "INQ-2026-0001-fee", "the fee rose", "v1");
  w.stance("PROJ-2026-0002-b", "INQ-2026-0001-fee", "the fee fell", "v2");
  return w;
}

test("R8 (K5): two projects whose stances on one inquiry are both concluded, adopting claims whose text differs, form one pair of stance sides, counted once", () => {
  const w = k5World();
  w.stance("PROJ-2026-0003-c", "INQ-2026-0001-fee", "the fee rose", "v1");       /* agrees with a: no pair between them */
  const r = w.c.pairs({ key: "K5", viewer: MEMBER });
  assert.equal(r.pairs.length, 2);
  const [p, q] = r.pairs;
  assert.deepEqual([p.key, p.inquiry], ["K5", "INQ-2026-0001-fee"]);
  assert.deepEqual(p.a, { kind: "stance", inquiry: "INQ-2026-0001-fee", project: "PROJ-2026-0001-a", version: "v1", claim: "the fee rose" });
  assert.deepEqual(p.b, { kind: "stance", inquiry: "INQ-2026-0001-fee", project: "PROJ-2026-0002-b", version: "v2", claim: "the fee fell" });
  assert.deepEqual([q.a.project, q.b.project], ["PROJ-2026-0002-b", "PROJ-2026-0003-c"]);
  assert.equal(p.why, word("contradiction.why.two_projects_concluded"));
  assert.equal(CONTRADICTION_KEYS.K5.name, word("contradiction.name.question_two_projects"));
  /* a stance that is not concluded (withdrawn, never) is no side */
  const n = world(); n.inquiry("INQ-2026-0001-fee"); n.project("PROJ-2026-0001-a", ["m1"]); n.project("PROJ-2026-0002-b", ["m1"]);
  n.stance("PROJ-2026-0001-a", "INQ-2026-0001-fee", "the fee rose"); n.draws("INQ-2026-0001-fee", "PROJ-2026-0002-b");
  assert.equal(n.c.pairs({ key: "K5", viewer: MEMBER }).pairs.length, 0);
});

test("R10 (K5): both projects must be ones the viewer may see; a project the viewer takes no part in hides the pair", () => {
  const w = world();
  w.inquiry("INQ-2026-0001-fee");
  w.project("PROJ-2026-0001-a", ["m1", "outsider"]); w.project("PROJ-2026-0002-b", ["m1"]);
  w.stance("PROJ-2026-0001-a", "INQ-2026-0001-fee", "the fee rose");
  w.stance("PROJ-2026-0002-b", "INQ-2026-0001-fee", "the fee fell");
  assert.equal(w.c.pairs({ key: "K5", viewer: MEMBER }).pairs_formed, 1);
  assert.equal(w.c.pairs({ key: "K5", viewer: OUTSIDER }).pairs_formed, 0);
  assert.equal(w.c.pairs({ key: "K5", viewer: MACHINE }).pairs_formed, 1);
  assert.equal(w.c.pairs({ key: "K5", viewer: null }).keys.find((k) => k.key === "K5").absence.level, "viewer");
});

test("R7 (K5): the key is run once, bounded, truncated observed past the bound; its scan of questions is bounded and says so", () => {
  const w = world();
  w.inquiry("INQ-2026-0001-fee");
  for (let i = 0; i < 4; i++) { const p = `PROJ-2026-000${i}-p`; w.project(p, ["m1"]); w.stance(p, "INQ-2026-0001-fee", `claim ${i}`); }
  const r = w.c.pairs({ key: "K5", limit: 5, viewer: MEMBER });           /* 4 stances: 6 pairs */
  const k = r.keys.find((x) => x.key === "K5");
  assert.deepEqual([k.formed, k.truncated, r.pairs.length], [5, true, 5]);
  assert.deepEqual([w.c.pairs({ key: "K5", limit: 6, viewer: MEMBER }).keys.find((x) => x.key === "K5").truncated], [false]);
  assert.equal(K5_INQUIRIES_EXAMINED, 1000);
});

test("R14 (K5): a stance is inquiry|project|version, versioned by the SHA-256 of the adopted claim; a changed claim is a different referent", () => {
  const w = k5World();
  const p = w.c.pairs({ key: "K5", viewer: MEMBER }).pairs[0];
  const r = w.c.propose({ run: RUN, proposedBy: "class:ai/t", viewer: MEMBER, caller: "member:m1",
                          proposals: [{ key: "K5", a: p.a, b: p.b, label: "record", reason: "different words" }] });
  assert.equal(r.ok, true, JSON.stringify(r));
  const c = r.candidates[0];
  assert.deepEqual([[c.a_kind, c.a_ref, c.a_version, c.a_bundle_id], [c.b_kind, c.b_ref, c.b_version, c.b_bundle_id]], [
    ["stance", "INQ-2026-0001-fee|PROJ-2026-0001-a|v1", sha("the fee rose"), "PROJ-2026-0001-a"],
    ["stance", "INQ-2026-0001-fee|PROJ-2026-0002-b|v2", sha("the fee fell"), "PROJ-2026-0002-b"]]);
  w.stance("PROJ-2026-0002-b", "INQ-2026-0001-fee", "the fee fell sharply", "v2");
  const stale = w.c.propose({ run: RUN, proposedBy: "class:ai/t", viewer: MEMBER, caller: "member:m1",
                              proposals: [{ key: "K5", a: p.a, b: p.b, label: "record", reason: "r" }] });
  assert.equal(stale.code, "CANDIDATE_PAIR_NOT_FORMED");
});

test("R24, R25 (K5 gate): while the gate arm is unmeasured every K5 candidate is withheld, not_shown, counted as unmeasured, and puts no mark", () => {
  const w = k5World();
  assert.equal(K5_GATE_MEASURED, false);
  const p = w.c.pairs({ key: "K5", viewer: MEMBER }).pairs[0];
  const id = w.c.propose({ run: RUN, proposedBy: "class:ai/t", viewer: MEMBER, caller: "member:m1",
                           proposals: [{ key: "K5", a: p.a, b: p.b, label: "record", reason: "r" }] }).candidates[0].candidate;
  const r = w.c.candidatesFor({ on: { candidate: id }, viewer: MEMBER });
  assert.deepEqual([r.candidates, r.empty.level, r.empty.unmeasured, r.unmeasured_why], [[], "none_shown", 1, "k5_gate_unmeasured"]);
  assert.deepEqual(r.empty.not_shown, { precision: 0, unrelated: 0 });
  const marks = w.c.tensionsOn({ referents: [{ ref: "INQ-2026-0001-fee|PROJ-2026-0001-a|v1", version: sha("the fee rose") }], viewer: MEMBER });
  assert.deepEqual(marks.referents[0].marks, []);
  assert.equal(w.c.clarify({ candidate: id, choice: "no_difference", viewer: MEMBER, author: MEMBER }).code, "NO_SUCH_CANDIDATE");
});

test("K5's gate arm: two stances with an agreeing pair and a differing wording of one claim, measured and passing, before any K5 candidate is shown", { todo: "no model is reachable from this job to run the gate's K5 arm; K5 candidates stay unshown (K488; draft-T15 point 5)" }, () => {});

test("R3 (K5): a stance side is rendered to the judgement as its claim text, under R2's pinned prompt unchanged", () => {
  const side = { kind: "stance", inquiry: "INQ-2026-0001-fee", project: "PROJ-2026-0001-a", version: "v1", claim: "the fee rose" };
  assert.deepEqual(judgementSide(side), { text: "the fee rose" });
  assert.deepEqual(judgementSide({ ...side, claim: null }), {});
  assert.deepEqual(judgementSide({ kind: "claim", claim: "x" }), {});             /* R3 unchanged for every other side */
  const out = renderJudgementInput([{ key: "K5", a: side, b: { ...side, claim: "the fee fell" } }]);
  assert.ok(out.startsWith(JUDGEMENT_PROMPT));
  assert.match(out, /PAIR 1 · key K5\n  A: \{"text":"the fee rose"\}\n  B: \{"text":"the fee fell"\}/);
});
