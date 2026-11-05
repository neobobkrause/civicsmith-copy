/* ai-runs R75 as restated (coordinator ruling 5 Nov 03:50): `ai-gate` builds the Gate 1 record (its R37 `gateRecord`) and the
   test-bar record; `ai-runs` writes them, and `partAdmitted` (R78) reads the Gate 1 records written here per (entry, part).
   F3 (op-grades R57's ai-runs part): the ops of R57 this module serves are declared with R57's grades. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, INQ, ENTRIES, T0 } from "./world.mjs";
import { DECLARED_OPS, aiRunsOps } from "../../../src/ai-runs/index.mjs";

const T1 = "2026-07-02T00:00:00Z";

test("R75: ai-runs writes the Gate 1 record ai-gate built, as given, and partAdmitted reads it for that entry and part; an unfit record is refused AI_TEST_BAR_UNFIT naming its field, nothing written", async () => {
  const w = world({ bars: [] });
  await w.group("ann"); w.bundle(INQ);
  assert.equal(w.runs.partAdmitted("check", ENTRIES.a).admitted, false, "no record: not admitted");
  const good = w.gate("check", ENTRIES.a);
  for (const [bad, field] of [[{ verdict: "great" }, "verdict"], [{ entry_id: "" }, "entry_id"],
                              [{ verdict: "passes_with_limits", limits: [] }, "limits"], [{ suiteVersions: { bank: 1 } }, "suiteVersions"]]) {
    const r = w.runs.gateVerdictRecord({ ...good, ...bad });
    assert.deepEqual([r.ok, r.code, r.field], [false, "AI_TEST_BAR_UNFIT", field], JSON.stringify(bad));
  }
  assert.equal(w.runs.gateVerdictRecord(null).code, "AI_TEST_BAR_UNFIT");
  assert.equal(w.count("ai_gate_records"), 0, "nothing written on a refusal");
  /* the builder's answer `{ok: true, record}` is taken as the bare record is */
  const wrote = w.runs.gateVerdictRecord({ ok: true, record: good });
  assert.deepEqual(wrote, { ok: true, entry_id: ENTRIES.a, part: good.part, verdict: "passes", at: T0 });
  assert.deepEqual(w.runs.gateVerdictRecords({ entry_id: ENTRIES.a }), [good], "kept as given");
  assert.deepEqual([w.runs.partAdmitted("check", ENTRIES.a).admitted, w.runs.partAdmitted("check", ENTRIES.b).admitted], [true, false],
    "admitted on the entry the record names, and no other");
  /* a later verdict for that (entry, part) is the one that counts: not_suitable closes it */
  assert.equal(w.runs.gateVerdictRecord({ ...good, verdict: "not_suitable", at: T1 }).ok, true);
  assert.equal(w.runs.partAdmitted("check", ENTRIES.a).admitted, false);
  assert.equal(w.runs.gateVerdictRecords({ entry_id: ENTRIES.a }).length, 2, "append-only");
});

test("R75 control: a team's own test set shows its results per entry and opens or closes no gate", async () => {
  const w = world({ bars: [] });
  await w.group("ann"); w.bundle(INQ);
  assert.equal(w.runs.gateVerdictRecord(w.gate("check", ENTRIES.a)).ok, true);
  const before = [w.runs.partAdmitted("check", ENTRIES.a).admitted, w.runs.partAdmitted("check", ENTRIES.b).admitted];
  assert.equal(w.runs.groupTestSet({ part: "check", matter: "fee rise", answers: "a", by: "member:ann" }).ok, true);
  for (const [entry_id, passed] of [[ENTRIES.a, false], [ENTRIES.b, true]])
    assert.equal(w.runs.testBarRecord({ part: "check", set: "group", set_version: 1, false_alarm_rate: 0.2, passed,
                                        graded_by: "harness", at: T0, entry_id }).ok, true);
  const shown = w.runs.groupTestResults({ part: "check", viewer: "member:ann" });
  assert.deepEqual(shown.results.map((r) => [r.entry_id, r.part, r.false_alarm_rate, r.passed]),
    [[ENTRIES.a, "check", 0.2, false], [ENTRIES.b, "check", 0.2, true]], "per (entry, part), with the false-alarm rate");
  assert.deepEqual([w.runs.partAdmitted("check", ENTRIES.a).admitted, w.runs.partAdmitted("check", ENTRIES.b).admitted], before,
    "a team's set leaves partAdmitted unchanged");
});

/* F3: this module's own ops of op-grades R57, each with R57's grade: the member's choices over her held run are reversible
   and refused to a machine; "How this run went" and the AI path's readiness are reads; `airunopen` is reversible (R57 grades
   `airunstart` as `airunopen` is). Each is served by this module's ops map. */
const REVERSIBLE = ["aicontinue", "aistop", "aisendrefuse", "aiwait", "aiwithout", "aiswitchaccount", "aiwaitswitch"];
const READS = ["airunparts", "aipathready"];

test("F3 (op-grades R57): the ops of R57 ai-runs serves are declared with R57's grades, member-only, each served by its ops map", () => {
  const served = Object.keys(aiRunsOps({}, new URL("http://x/"), null));
  for (const op of REVERSIBLE) {
    const r = DECLARED_OPS[op];
    assert.ok(r, `${op} declared`);
    assert.deepEqual([r.weight, r.mutating, r.machineClasses], ["reversible", true, []], op);
  }
  for (const op of READS) {
    const r = DECLARED_OPS[op];
    assert.ok(r, `${op} declared`);
    assert.deepEqual([r.weight, r.mutating, r.machineClasses], ["read", false, []], op);
  }
  assert.equal(DECLARED_OPS.airunopen.weight, "reversible");
  for (const op of [...REVERSIBLE, ...READS, "airunopen"]) assert.ok(served.includes(op), `${op} served`);
});
