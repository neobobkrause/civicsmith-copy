/* contradiction K5 (N345, DEC-84 item 3): one question, two projects' conclusions — R5, R8, R10, R11, R14 for the fifth
   key, R3's rendering of a stance, the gate's K5 arm (measured: gate-k5.mjs), and, K5 shown, R24, R27, R33, R34 and R36's
   K5 arms. */
import test from "node:test";
import assert from "node:assert/strict";
import { word } from "../../../src/setup-words/index.mjs";
import { world, sha, MACHINE, MEMBER, OUTSIDER } from "./fixture.mjs";
import { judgementSide, renderJudgementInput, JUDGEMENT_PROMPT, JUDGEMENT_PROMPT_SHA256, K5_GATE_MEASURED,
         K5_INQUIRIES_EXAMINED, CONTRADICTION_KEYS } from "../../../src/contradiction/index.mjs";
import { seeded, cand, M1 } from "./seed.mjs";
import { measure, gate, pairId } from "./gate-measure.mjs";
import { K5, RUNS as K5_RUNS, PROMPT_SHA256 as K5_PROMPT_SHA256, recordedJudgeK5 } from "./gate-k5.mjs";

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

/* A K5 candidate over k5World's first pair, under the given label. */
function k5Candidate(w, label = "record") {
  const p = w.c.pairs({ key: "K5", viewer: MEMBER }).pairs[0];
  const r = w.c.propose({ run: RUN, proposedBy: "class:ai/t", viewer: MEMBER, caller: "member:m1",
                          proposals: [{ key: "K5", a: p.a, b: p.b, label, reason: "two conclusions" }] });
  assert.equal(r.ok, true, JSON.stringify(r));
  return { id: r.candidates[0].candidate, p };
}
const shownOne = (w, id) => w.c.candidatesFor({ on: { candidate: id }, viewer: MEMBER });
const marksOn = (w, side) => w.c.tensionsOn({ referents: [{ ref: `${side.inquiry}|${side.project}|${side.version}`, version: sha(side.claim) }],
                                              viewer: MEMBER }).referents[0].marks;

test("Satisfies (K5's judgement), R57's K5 arm: the corpus is formed by K5 alone; each recorded run, under R2's prompt unchanged, passes the gate with no false conflict, every pair answered, and its recall is stated", () => {
  assert.equal(K5_GATE_MEASURED, true);
  assert.equal(K5_PROMPT_SHA256, JUDGEMENT_PROMPT_SHA256);
  assert.ok(K5.length >= 6 && K5.some((e) => e.label === "record") && K5.some((e) => e.label === "precision" || e.label === "unrelated"));
  const w = world();
  w.project("PROJ-2026-0501-a", ["m1"]); w.project("PROJ-2026-0502-b", ["m1"]);
  const gold = new Map();
  for (const e of K5) {
    const inq = `INQ-2026-0500-${e.id}`; w.inquiry(inq);
    w.stance("PROJ-2026-0501-a", inq, e.a, "v1"); w.stance("PROJ-2026-0502-b", inq, e.b, "v1");
    gold.set(pairId("K5", `${inq}|PROJ-2026-0501-a|v1`, `${inq}|PROJ-2026-0502-b|v1`), { id: e.id, shape: e.shape, label: e.label });
  }
  const read = w.c.pairs({ viewer: MACHINE });
  assert.deepEqual([read.pairs.length, read.pairs.every((p) => p.key === "K5")], [K5.length, true]);
  /* the input a run reads carries every formed pair and no gold label or fixture id */
  const rendered = renderJudgementInput(read.pairs.map((p) => ({ key: p.key, a: p.a, b: p.b })));
  assert.ok(rendered.startsWith(JUDGEMENT_PROMPT));
  assert.equal(K5.some((e) => rendered.includes(e.id) || rendered.includes(e.shape)), false);
  const sideOf = (s) => judgementSide(s);
  assert.deepEqual(K5_RUNS.map((r) => r.id), ["R1", "R2", "R3"]);
  for (const r of K5_RUNS) {
    const m = measure({ read, gold, sideOf, judge: recordedJudgeK5(r.id), keys: ["K5"] });
    assert.deepEqual(gate(m), { pass: true, fails: [] }, r.id);
    assert.deepEqual([m.all.compared, m.all.negatives, m.all.false_conflicts, m.all.positives], [7, 5, 0, 2], r.id);
    assert.equal(typeof m.all.recall, "number", r.id);
  }
  /* the arm can fail: an always-record judgement is a false conflict on every negative; a silent one is absent */
  const always = measure({ read, gold, sideOf, judge: () => ({ label: "record", reason: "x" }), keys: ["K5"] });
  assert.deepEqual(gate(always).fails, ["FALSE_CONFLICT:K5", "FALSE_CONFLICT:ALL"]);
  assert.ok(gate(measure({ read, gold, sideOf, judge: () => undefined, keys: ["K5"] })).fails.includes("JUDGEMENT_ABSENT:K5"));
});

test("R24 (K5): any shown label on K5 is plurality, reaching both projects; precision and unrelated are not shown; no_difference makes it duty", () => {
  for (const label of ["record", "world", "undetermined"]) {
    const w = k5World();
    const { id } = k5Candidate(w, label);
    const c = shownOne(w, id).candidates[0];
    assert.deepEqual([c.weight, c.state, c.reach.projects], ["plurality", "open", ["PROJ-2026-0001-a", "PROJ-2026-0002-b"]], label);
  }
  for (const label of ["precision", "unrelated"]) {
    const w = k5World();
    const r = shownOne(w, k5Candidate(w, label).id);
    assert.deepEqual([r.candidates, r.empty.level], [[], "none_shown"], label);
  }
  const w = k5World();
  const { id } = k5Candidate(w);
  w.c.clarify({ candidate: id, choice: "no_difference", viewer: MEMBER, author: MEMBER });
  assert.equal(shownOne(w, id).candidates[0].weight, "duty");
});

test("R34: no_difference on K5 records that the member found no named difference; the candidate stays open and becomes a duty for both projects", () => {
  const w = k5World();
  const { id } = k5Candidate(w);
  const r = w.c.clarify({ candidate: id, choice: "no_difference", explanation: " the same question, answered two ways ", viewer: MEMBER, author: MEMBER });
  assert.deepEqual([r.ok, r.candidate, r.choice, r.state, r.weight], [true, id, "no_difference", "open", "duty"]);
  assert.deepEqual([r.act.act, r.act.choice, r.act.author, r.act.explanation], ["clarify", "no_difference", MEMBER, "the same question, answered two ways"]);
  const c = shownOne(w, id).candidates[0];
  assert.deepEqual([c.weight, c.state, c.reach.projects], ["duty", "open", ["PROJ-2026-0001-a", "PROJ-2026-0002-b"]]);
  /* a duty for each project: each one's candidates answer it */
  for (const project of ["PROJ-2026-0001-a", "PROJ-2026-0002-b"])
    assert.deepEqual(w.c.candidatesFor({ on: { project }, viewer: MEMBER }).candidates.map((x) => [x.candidate, x.weight]), [[id, "duty"]], project);
  /* a duty leaves only by resolution (R43) */
  assert.equal(w.c.dismiss({ candidate: id, reason: "not_same_matter", viewer: MEMBER, author: MEMBER }).code, "RECORD_CANNOT_BE_DISMISSED");
  /* a machine never records it (R30, R46) */
  const w2 = k5World();
  const id2 = k5Candidate(w2).id;
  assert.equal(w2.c.clarify({ candidate: id2, choice: "no_difference", viewer: MEMBER, author: MACHINE }).code, "MACHINE_CANNOT_ACT_ON_CANDIDATE");
  assert.equal(shownOne(w2, id2).candidates[0].weight, "plurality");
});

test("R34, R32: no_difference is K5's alone; on K1–K4 it is CLARIFY_CHOICE_UNKNOWN, naming the other two choices, and K5 names all three", () => {
  const s = seeded();
  const k2 = cand(s, "K2", "record");
  const r = s.c.clarify({ candidate: k2, choice: "no_difference", viewer: M1, author: M1 });
  assert.deepEqual([r.code, r.choices], ["CLARIFY_CHOICE_UNKNOWN", ["differs", "one_wrong"]]);
  const w = k5World();
  const k5 = w.c.clarify({ candidate: k5Candidate(w).id, choice: "same", viewer: MEMBER, author: MEMBER });
  assert.deepEqual([k5.code, k5.choices], ["CLARIFY_CHOICE_UNKNOWN", ["differs", "one_wrong", "no_difference"]]);
});

test("R27 (K5): an open K5 candidate marks both stances plurality before no_difference, and in_tension after", () => {
  const w = k5World();
  const { id, p } = k5Candidate(w);
  for (const side of [p.a, p.b]) assert.deepEqual(marksOn(w, side).map((m) => [m.mark, m.candidate]), [["plurality", id]]);
  w.c.clarify({ candidate: id, choice: "no_difference", viewer: MEMBER, author: MEMBER });
  for (const side of [p.a, p.b]) assert.deepEqual(marksOn(w, side).map((m) => [m.mark, m.candidate]), [["in_tension", id]]);
});

test("R33, R36 (K5): two projects' conclusions have no wrong side — one_wrong, and a CORRECTED or double_speak_or_reversal resolution, are PLURALITY_HAS_NO_WRONG_SIDE", () => {
  const w = k5World();
  const { id } = k5Candidate(w);
  assert.equal(w.c.clarify({ candidate: id, choice: "one_wrong", wrongSide: "a", reason: "misread", viewer: MEMBER, author: MEMBER }).code,
               "PLURALITY_HAS_NO_WRONG_SIDE");
  const up = w.c.takeUp({ candidate: id, question: "Did the fee rise or fall?", frame: "a", viewer: MEMBER, author: MEMBER });
  assert.equal(up.ok, true, JSON.stringify(up));
  for (const resolution of [{ kind: "misquote", wrong_side: "a", reason: "r" }, { kind: "double_speak_or_reversal" }])
    assert.equal(w.c.resolve({ inquiry: up.inquiry, resolution, conclusion: "the fee rose in one project's reading", viewer: MEMBER, author: MEMBER }).code,
                 "PLURALITY_HAS_NO_WRONG_SIDE", resolution.kind);
});

test("R3 (K5): a stance side is rendered to the judgement as its claim text, under R2's pinned prompt unchanged", () => {
  const side = { kind: "stance", inquiry: "INQ-2026-0001-fee", project: "PROJ-2026-0001-a", version: "v1", claim: "the fee rose" };
  assert.deepEqual(judgementSide(side), { text: "the fee rose" });
  assert.deepEqual(judgementSide({ ...side, claim: null }), {});
  assert.deepEqual(judgementSide({ kind: "claim", claim: "x" }), {});             /* R3 unchanged for every other side */
  const out = renderJudgementInput([{ key: "K5", a: side, b: { ...side, claim: "the fee fell" } }]);
  assert.ok(out.startsWith(JUDGEMENT_PROMPT));
  assert.match(out, /PAIR 1 · key K5\n  A: \{"text":"the fee rose"\}\n  B: \{"text":"the fee fell"\}/);
});
