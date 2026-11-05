/* run-productions R28, R29 (T53; agent-steps R54, R56): a retried `suggest` of a run writes one version, and a
   suggestion keeps who produced it. Driven at the module's interface over the fixture's world.

   The labels are of `agent-model` R26's shape ({provider, host, model_version, effort, account_level, owner}, with
   `ai-runs` R104's display_name). agent-model publishes no fixture yet (its T53 entry is open), so the two labels below
   stand for what two conversations would answer; they are this op's input, not an answer of agent-model's this test
   asserts on. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SUGGEST_CHECKS, producedByOf } from "../../../src/run-productions/index.mjs";
import { world, Q, DOC, RUN, MACHINE } from "./fixture.mjs";

const LEG = { target: DOC, role: "supports", ground: "paper" };
const PART = [{ ground: "paper", statement: "the paper trail of the approval" }];
const LABEL_A = { provider: "prov-a", host: "host-a", model_version: "m-a-1", effort: "hi", account_level: "team", owner: "group", display_name: "AI A" };
const LABEL_B = { provider: "prov-b", host: "host-b", model_version: "m-b-2", effort: "lo", account_level: "member", owner: "member", display_name: "AI B" };

function base() {
  const w = world();
  w.inquiry(Q); w.doc(DOC); w.run(RUN);
  return w;
}
const writes = (w) => [...w.st.sql.exec(`SELECT * FROM suggest_writes ORDER BY version`)];
const versionCount = (w) => [...w.st.sql.exec(`SELECT COUNT(*) AS n FROM inquiry_basis_versions WHERE bundle_id=?`, Q)][0].n;

test("R28: a suggest carrying an idem, repeated, writes one version and one Session Log entry; the second answer is the first verbatim with repeated: true", () => {
  const w = base();
  const idem = `${RUN}:1:s1:1`;
  const call = { name: "r", legs: [LEG], grounds: PART, idem, author: MACHINE, produced_by: [LABEL_A] };
  const first = w.suggest(call);
  assert.equal(first.ok, true, JSON.stringify(first).slice(0, 300));
  assert.equal(first.repeated, false);
  const again = w.suggest(call);
  assert.equal(again.repeated, true);
  const { repeated, ...rest } = again;
  const { repeated: r0, ...firstRest } = first;
  assert.deepEqual(rest, firstRest, "the first call's answer, verbatim");
  assert.equal(w.basisVersions.appended.length, 1, "one appendVersion: one version, one Session Log entry");
  assert.equal(versionCount(w), 1, "one version");
  assert.equal(w.basisVersions.appended[0].log.match(/### Session /g).length, 1);
  assert.equal(again.state, "suggested");
  /* the repeat answers the first version's list (R29) */
  assert.deepEqual(again.produced_by, [LABEL_A]);
  /* a retry that changed the name but kept the idem is the same step re-run: still the first answer */
  const renamed = w.suggest({ ...call, name: "r2" });
  assert.equal(renamed.repeated, true);
  assert.equal(renamed.version, "r");
  assert.equal(w.basisVersions.appended.length, 1);
});

test("R28 control: a changed candidate with a new idem writes a second version; calls with no idem are as today; the idem is the run's", () => {
  const w = base();
  assert.equal(w.suggest({ name: "r", legs: [LEG], grounds: PART, idem: `${RUN}:1:s1:1` }).ok, true);
  const second = w.suggest({ name: "r2", description: "the ledger shows the transfer was approved three times", legs: [LEG], grounds: PART, idem: `${RUN}:1:s1:2` });
  assert.equal(second.ok, true, JSON.stringify(second).slice(0, 300));
  assert.equal(second.repeated, false);
  assert.equal(w.basisVersions.appended.length, 2, "a second version");
  /* no idem: the same name again is judged afresh (R1's name check), not answered from a memo */
  const noIdem = w.suggest({ name: "r", legs: [LEG], grounds: PART });
  assert.equal(noIdem.code, "SUGGEST_NAME_TAKEN");
  /* the same idem under another run of the question is that run's own, so it is judged afresh */
  w.run("RUN-2");
  const other = w.suggest({ run: "RUN-2", name: "r3", description: "the ledger shows a fourth approval of the transfer", legs: [LEG], grounds: PART, idem: `${RUN}:1:s1:1` });
  assert.equal(other.ok, true, JSON.stringify(other).slice(0, 300));
  assert.equal(other.repeated, false);
});

test("R28 control: the refusals of R1 write nothing whether or not an idem is carried, and a refused idem is judged afresh", () => {
  const w = base();
  const before = w.snapshot();
  for (const idem of [undefined, `${RUN}:1:s1:1`]) {
    assert.equal(w.suggest({ target: "", idem }).code, "SUGGEST_NO_TARGET");
    assert.equal(w.suggest({ run: "RUN-NONE", idem }).code, "SUGGEST_NO_RUN");
    assert.equal(w.suggest({ kind: "level-empty", legs: [], idem }).code, "SUGGEST_EMPTY_LEVEL_UNSTATED");
  }
  assert.deepEqual(w.snapshot(), before, "nothing written");
  const ok = w.suggest({ name: "r", legs: [LEG], grounds: PART, idem: `${RUN}:1:s1:1` });
  assert.equal(ok.ok, true, "the idem a refusal carried is judged afresh once the call is right");
  assert.equal(ok.repeated, false);
});

test("R29: a candidate written in the segment after a hop names the new label and one written before it the old; each read back as stored", () => {
  const w = base();
  const before = w.suggest({ name: "before hop", author: MACHINE, legs: [LEG], grounds: PART, produced_by: [LABEL_A, LABEL_A] });
  const after = w.suggest({ name: "after hop", author: MACHINE, description: "the ledger shows the transfer was approved three times",
                            legs: [LEG], grounds: PART, produced_by: [LABEL_A, LABEL_B, LABEL_A] });
  assert.equal(before.ok, true, JSON.stringify(before).slice(0, 300));
  assert.equal(after.ok, true, JSON.stringify(after).slice(0, 300));
  assert.deepEqual(before.produced_by, [LABEL_A], "deduplicated");
  assert.deepEqual(after.produced_by, [LABEL_A, LABEL_B], "deduplicated, in order, the new label after the old");
  assert.equal(before.fields_of.produced_by, "record");
  /* written with the version and on its Session Log entry */
  assert.deepEqual(writes(w).map((r) => [r.version, JSON.parse(r.produced_by)]),
                   [["after hop", [LABEL_A, LABEL_B]], ["before hop", [LABEL_A]]]);
  const log = w.basisVersions.appended.at(-1).log;
  assert.match(log, /^Produced by: /m);
  assert.ok(log.includes(JSON.stringify(LABEL_B.display_name)), "the entry names the new label");
});

test("R29 control: a script-made candidate (level-empty) names no AI; a malformed list is SUGGEST_PRODUCED_BY_MALFORMED and writes no version", () => {
  const w = base();
  const script = w.suggest({ kind: "level-empty", name: "nothing at documents", legs: [], level: "documents", observed_at: "log:1" });
  assert.equal(script.ok, true, JSON.stringify(script).slice(0, 300));
  assert.equal(script.produced_by, null);
  assert.equal(w.basisVersions.appended.at(-1).log.includes("Produced by"), false);
  const before = w.snapshot();
  const { display_name, ...noName } = LABEL_A;
  const { owner, ...noOwner } = LABEL_A;
  for (const bad of ["AI A", [], [null], ["AI A"], [noOwner], [{ ...LABEL_A, account: "acct-1" }], [{ ...LABEL_A, effort: 3 }],
                     [{ ...LABEL_A, display_name: "" }], Array.from({ length: 33 }, () => noName)]) {
    const r = w.suggest({ name: "bad", legs: [LEG], grounds: PART, produced_by: bad });
    assert.equal(r.code, "SUGGEST_PRODUCED_BY_MALFORMED", JSON.stringify(bad).slice(0, 80));
    assert.equal(r.check, SUGGEST_CHECKS.SUGGEST_PRODUCED_BY_MALFORMED.check);
    assert.equal(r.translation, SUGGEST_CHECKS.SUGGEST_PRODUCED_BY_MALFORMED.translation);
    assert.match(r.detail, /\bproduced_by\b/);
  }
  assert.deepEqual(w.snapshot(), before, "no version, no memo, nothing written");
  /* a label without display_name is well formed (agent-model R26's six fields) */
  assert.deepEqual(producedByOf([noName]), { list: [noName] });
  assert.equal(w.suggest({ name: "good", legs: [LEG], grounds: PART, produced_by: [noName] }).ok, true);
});
