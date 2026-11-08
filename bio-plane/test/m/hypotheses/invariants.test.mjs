/* hypotheses: the ops map (R7) and the invariants (R8–R10), at the interface. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, ANN, OUTSIDER, INQ, E1, E2, E3 } from "./fixture.mjs";
import { hypothesesOps, HYPOTHESES_CHECKS, HYPOTHESES_TABLES } from "../../../src/hypotheses/index.mjs";

const url = (op, q = {}) => { const u = new URL(`https://plane.example/?op=${op}`); for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v); return u; };

test("R7 hypothesesOps answers route arms for hypothesishold, hypothesisrevise, hypothesiswithdraw and hypotheses (and the notes' notewrite, noterevise, notes, noteturn, notedelete; since T41 hypothesistakeup, hypothesissetaside, noteshare, noteunshare, shares; since layer 12, F1, hypothesisrivals, explorenext, rivals); a read's viewer comes from the query, never the body", () => {
  const w = world();
  w.bundle(INQ);
  const hidden = w.fenced("INQ-2026-0009-hidden");
  const arms = hypothesesOps(w.h, url("x"), {});
  assert.deepEqual(Object.keys(arms).sort(), ["explorenext", "hypotheses", "hypothesishold", "hypothesisrevise", "hypothesisrivals", "hypothesissetaside", "hypothesistakeup", "hypothesiswithdraw", "notedelete", "noterevise", "notes", "noteshare", "noteturn", "noteunshare", "notewrite", "rivals", "shares"]);
  const held = hypothesesOps(w.h, url("hypothesishold"), { inquiry: INQ, kind: "identity", statement: "Same person.", about: { from: E1, to: E2 }, by: ANN }).hypothesishold();
  assert.equal(held.ok, true);
  const id = held.hypothesis_id;
  assert.equal(hypothesesOps(w.h, url("hypothesisrevise"), { hypothesisId: id, statement: "Same person, surely.", reason: "a photo", by: ANN }).hypothesisrevise().ok, true);
  const one = hypothesesOps(w.h, url("hypotheses", { id, viewer: ANN }), {}).hypotheses();
  assert.deepEqual([one.ok, one.hypothesis.statement, one.hypothesis.history.length], [true, "Same person, surely.", 2]);
  const list = hypothesesOps(w.h, url("hypotheses", { inquiry: INQ, viewer: ANN }), {}).hypotheses();
  assert.deepEqual(list.hypotheses.map((x) => x.hypothesis_id), [id]);
  /* a body's viewer is ignored: the outsider stays outside */
  w.hold({ inquiry: hidden });
  assert.equal(hypothesesOps(w.h, url("hypotheses", { inquiry: hidden, viewer: OUTSIDER }), { viewer: ANN }).hypotheses().reason, "NO_SUCH_BUNDLE");
  assert.equal(hypothesesOps(w.h, url("hypotheses", { inquiry: hidden }), { viewer: ANN }).hypotheses().reason, "NO_SUCH_BUNDLE");
  assert.equal(hypothesesOps(w.h, url("hypothesiswithdraw"), { hypothesisId: id, reason: "a twin", by: ANN }).hypothesiswithdraw().ok, true);
  assert.equal(hypothesesOps(w.h, url("hypothesishold"), null).hypothesishold().reason, "NO_SUCH_BUNDLE", "an empty body is refused, never thrown");
});

test("R8 R9 never a fact: holding, revising, withdrawing and reading hypotheses (a cause among them) write nothing to any other module's table, record no event relation, and no leg may rest on one", () => {
  const w = world();
  w.bundle(INQ);
  const id0 = w.hold();               /* the first id allocation creates record-core's counter row */
  const before = w.others();
  const cause = w.hold({ kind: "cause", about: { from: "EVT-2026-abcdefgh12345678", to: "EVT-2026-zyxwvuts87654321" }, statement: "The grant caused the vote." });
  w.h.revise({ hypothesisId: cause, statement: "The grant may have caused the vote.", reason: "softer", by: ANN });
  w.h.withdraw({ hypothesisId: id0, reason: "no", by: ANN });
  w.h.read({ hypothesisId: cause, viewer: ANN });
  w.h.hypothesesOf({ inquiry: INQ, viewer: ANN });
  w.h.neighbours({ node: E1, viewer: ANN, scope: INQ });
  assert.deepEqual(w.others(), before, "no other module's table changed (record-core's id counter aside, its own write)");
  const tables = w.rows(`SELECT name FROM sqlite_master WHERE type='table'`).map((r) => r.name);
  assert.ok(!tables.some((t) => /^event/.test(t)), "no event table is made or written");
  const got = w.h.read({ hypothesisId: cause, viewer: ANN }).hypothesis;
  assert.deepEqual([got.label, got.fact, got.grade, got.kind], ["hypothesis", false, null, "cause"]);
  assert.ok(!("stated_cause" in got) && !("relation" in got));
  /* nor a leg: the promotion is refused and nothing of the inquiry moves */
  assert.equal(w.promote("INQ-2026-0002-q", [{ target: cause }]).reason, "BASIS_REFUSED");
  assert.equal(w.record.head("INQ-2026-0002-q"), null);
});

test("R10 hypotheses and their revisions are declared with record-core, keyed by the inquiry's bundle_id, purged with it, sight the inquiry's, export yes; no place is named in outward text", () => {
  const w = world();
  w.bundle(INQ);
  const other = w.bundle("INQ-2026-0002-other");
  const a = w.hold();
  w.h.revise({ hypothesisId: a, statement: "s2", reason: "r", by: ANN });
  const b = w.hold({ inquiry: other });
  const mine = w.record.declaredTables().filter((d) => d.module === "hypotheses" && HYPOTHESES_TABLES.includes(d.name));
  assert.deepEqual(mine.map((d) => d.name), ["hypotheses", "hypothesis_revisions"]);
  for (const d of mine)
    assert.deepEqual([d.keys, d.purge, d.expunge, d.export, d.sight, d.derive, d.version_chain],
      [["bundle_id"], "clear", "none", "yes", "bundle", "stored", false], d.name);
  const p = w.record.purge({ bundleId: INQ });
  assert.equal(p.removed.hypotheses, 1);
  assert.equal(p.removed.hypothesis_revisions, 2);
  assert.equal(w.h.read({ hypothesisId: a, viewer: ANN }).reason, "NO_SUCH_HYPOTHESIS");
  assert.equal(w.h.read({ hypothesisId: b, viewer: ANN }).ok, true, "another inquiry's stay");
  /* outward text: every row's translation and every answer's words name no place */
  const PLACES = /oakland|california|alameda|berkeley|san francisco|los angeles|county|city of/i;
  const texts = Object.values(HYPOTHESES_CHECKS).map((r) => r.translation);
  const answers = [w.h.hold({ inquiry: "INQ-2026-0404-x", by: ANN }), w.h.hold({ inquiry: other, kind: "z", by: ANN }),
    w.h.hold({ inquiry: other, kind: "relation", statement: "s", about: null, by: ANN }), w.h.read({ hypothesisId: a, viewer: ANN }),
    w.h.read({ hypothesisId: b, viewer: ANN }), w.h.neighbours({ node: E3, viewer: ANN, scope: other }),
    w.h.legRefusals({ legs: [{ target: b }, { target: "d".repeat(64) }], viewer: ANN })];
  for (const t of [...texts, ...answers.map((x) => JSON.stringify(x))]) assert.ok(!PLACES.test(t), t.slice(0, 200));
});
