/* investigation R24: a project closes at its owner's choice, quiet or not; R25: the module's DECLARED_OPS (`projectclose`),
   held true by calling the op as the door does (test-support R15). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { declaredOpHolds } from "../../declared-ops.mjs";
import { world, projectMd, ANN, BOB, DAN, AI, Q1 } from "./fixture.mjs";
import { investigationOps, DECLARED_OPS } from "../../../src/investigation/ops.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { CLOSED_REASONS } from "../../../src/intent/index.mjs";

/* a world with a project the record holds as a document (a close is a revision through promotion), Ann its owner, Bob
   joined, its work NOT quiet (a step still open) and one gap open */
function openWorld() {
  const w = world();
  const made = w.promotion.promote({ base: null, snapKey: "k-p", author: ANN, meta: { object_type: "project" },
    files: [{ path: "bundle.md", text: projectMd(null, "The Closing Project").split("\n").filter((l) => !l.startsWith("id:")).join("\n") }] });
  assert.equal(made.ok, true, JSON.stringify(made));
  const P = made.bundleId;
  w.st.sql.exec(`INSERT OR REPLACE INTO project_sight (project_id, setting) VALUES (?, 'discoverable')`, P);
  w.participant(P, "ann", { owner: true }); w.participant(P, "bob");
  w.drawn.set(P, [{ inquiry: Q1 }]);
  w.gapsOf.set(P, [{ key: "intent::g9", basis: { says: "the vote record is to be requested" } }]);
  w.step({ work: "still open", place: { project: P } });
  assert.equal(w.inv.quietState({ project: P, viewer: ANN }).quiet, false);
  w.P = P;
  /* what `project-stage` R2 rule 1 reads, and all it reads, of a project: its own document's recorded close (project-stage is
     a later layer's module, so its own R2 tests hold that this document reads as `closed` with the reason) */
  w.stage = () => {
    const fm = parseFrontmatter(w.record.readFile(P, "bundle.md").text).data || {};
    const closed = fm.current_state === "closed" && CLOSED_REASONS.includes(fm.closed_reason);
    return { stage: closed ? "closed" : "open", closed_reason: closed ? fm.closed_reason : null };
  };
  return w;
}

test("R24: an owner closes a project that is not quiet with each of the three reasons; the project's document then records closed with the reason, which is all `project-stage` R2 reads (the owner's recorded act), the gaps read at the act kept beside it", () => {
  for (const reason of ["resolved", "superseded", "abandoned"]) {
    const w = openWorld(); const P = w.P;
    assert.notEqual(w.stage().stage, "closed");
    const r = w.inv.projectClose({ project: P, reason, note: "Chosen, not waited for.", by: ANN });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual([r.project, r.closed_reason, r.gaps.map((g) => g.key)], [P, reason, ["intent::g9"]]);
    const head = w.record.head(P);
    assert.deepEqual([head.currentState, head.priorState], ["closed", "forming"]);
    assert.match(w.record.readFile(P, "bundle.md").text, new RegExp(`closed_reason: ${reason}`));
    const s = w.stage();
    assert.deepEqual([s.stage, s.closed_reason], ["closed", reason], "the document records the close as project-stage R2 reads it");
    const act = w.rows(`SELECT * FROM inv_quiet_acts WHERE project_id = ? AND act = 'close'`, P)[0];
    assert.deepEqual([act.closed_reason, act.by_actor, JSON.parse(act.gaps_json).gaps.map((g) => g.key)], [reason, ANN, ["intent::g9"]]);
  }
});

test("R24: a member who is not an owner is refused, whichever of the three reasons, and nothing is written (control: the owner's close, and the quiet path still refuses a project that is not quiet)", () => {
  const w = openWorld(); const P = w.P;
  const before = w.snapshot();
  for (const reason of ["resolved", "superseded", "abandoned"]) {
    const r = w.inv.projectClose({ project: P, reason, by: BOB });
    assert.deepEqual([r.ok, r.code], [false, "PROJECT_ACT_NOT_THE_OWNER"], reason);
  }
  assert.equal(w.snapshot(), before);
  assert.equal(w.record.head(P).currentState, "forming");
  assert.notEqual(w.stage().stage, "closed");
  /* the quiet path is unchanged: still gated on quiet, still any joined participant's door */
  assert.equal(w.inv.projectCloseWithGaps({ project: P, reason: "resolved", by: ANN }).code, "QUIET_NOT_QUIET");
  assert.equal(w.inv.projectClose({ project: P, reason: "resolved", by: ANN }).ok, true);
});

test("R24: another word is CLOSE_BAD_REASON; a machine, a non-participant and a bad note are refused as R18's are; nothing is written", () => {
  const w = openWorld(); const P = w.P;
  const before = w.snapshot();
  assert.equal(w.inv.projectClose({ project: P, reason: "done", by: ANN }).code, "CLOSE_BAD_REASON");
  assert.equal(w.inv.projectClose({ project: P, by: ANN }).code, "CLOSE_BAD_REASON");
  assert.equal(w.inv.projectClose({ project: P, reason: "resolved", note: "  ", by: ANN }).code, "INVESTIGATION_NO_REASON");
  assert.equal(w.inv.projectClose({ project: P, reason: "resolved", by: AI }).code, "INVESTIGATION_MEMBER_ONLY");
  assert.equal(w.inv.projectClose({ project: P, reason: "resolved", by: DAN }).code, "PROJECT_SEEN_NOT_A_PARTICIPANT");
  assert.equal(w.inv.projectClose({ project: "PROJ-2099-0001", reason: "resolved", by: ANN }).code, "NO_SUCH_PROJECT");
  assert.equal(w.inv.projectClose({ project: P, reason: "resolved" }).code, "NO_SUCH_PROJECT");
  assert.equal(w.snapshot(), before);
  assert.equal(w.record.head(P).currentState, "forming");
  assert.equal(w.inv.projectClose({ project: P, reason: "resolved", by: ANN }).ok, true, "control: the same call with a good reason closes it");
});

test("R25: the ops map serves projectclose and answers it as projectClose does", () => {
  const w = openWorld(); const P = w.P;
  const call = (query, body) => investigationOps(w.inv, new URL(`https://plane.invalid/?op=projectclose&${new URLSearchParams(query)}`), body).projectclose();
  assert.deepEqual(Object.keys(investigationOps(w.inv, new URL("https://plane.invalid/?op=projectclose"), {})), ["projectclose"]);
  assert.equal(call({ by: BOB, viewer: BOB }, { project: P, reason: "resolved" }).code, "PROJECT_ACT_NOT_THE_OWNER");
  assert.equal(call({ by: ANN, viewer: ANN }, { project: P, reason: "done" }).code, "CLOSE_BAD_REASON");
  /* the stamp is the query's: a body's copy of `by` never wins */
  assert.equal(call({ by: BOB, viewer: BOB }, { project: P, reason: "resolved", by: ANN }).code, "PROJECT_ACT_NOT_THE_OWNER");
  const r = call({ by: ANN, viewer: ANN, project: P, reason: "superseded" }, {});
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual([w.stage().stage, w.stage().closed_reason], ["closed", "superseded"]);
});

/* the call as the door runs it: the stamps and every field in the address, the fields as the body, a fresh world per call */
const sameCode = (x, y) => x && y && x.ok === y.ok && (x.code ?? x.reason) === (y.code ?? y.reason);
const named = (codes) => (answer, field) => !!answer && typeof answer === "object"
  && (codes[field] || []).some((c) => answer.code === c || answer.reason === c);
const door = async (fields) => {
  const w = openWorld();
  const given = { ...fields, ...(fields.project === "sample-project" ? { project: w.P } : {}) };
  const q = new URLSearchParams({ op: "projectclose", by: ANN, viewer: ANN, ...Object.fromEntries(Object.entries(given).map(([k, v]) => [k, String(v)])) });
  return investigationOps(w.inv, new URL(`https://plane.invalid/?${q}`), given).projectclose();
};

test("R25: investigation declares projectclose: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  assert.deepEqual(Object.keys(DECLARED_OPS), ["projectclose"]);
  await declaredOpHolds({ op: "projectclose", declaration: DECLARED_OPS.projectclose, call: door,
    refusedNaming: named({ project: ["NO_SUCH_PROJECT"], reason: ["CLOSE_BAD_REASON"] }),
    values: { project: "sample-project", reason: "resolved" }, same: sameCode });
});

test("R25: the declaration states what the screen sends and what the arm reads: project, reason and an optional note, the reason a refusal when missing", () => {
  const d = DECLARED_OPS.projectclose;
  assert.deepEqual([d.mutating, d.weight, d.fields.requires, [...d.fields.accepts].sort()], [true, "reasoned", ["project", "reason"], ["note", "project", "reason"]]);
  assert.equal(d.refusal, "CLOSE_BAD_REASON");
  assert.deepEqual(d.classes, ["admin", "member"]);
  assert.deepEqual(d.machineClasses, []);
  assert.equal(d.needs, "contribute");
});
