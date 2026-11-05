/* Provider notices ai-runs:323 (PR 323: `AiRuns.pathReadyRead`, the `aipathready` read, and the path read failing closed
   when no source is registered) and ai-runs:391 (PR 391: R75, `gateVerdictRecord` writing the Gate 1 records ai-gate
   builds into the new `ai_gate_records` table, `gateVerdictRecords` reading them, R78's gate reading them first). This
   module's use of ai-runs is the Store's RPC `dispatchMemberRun` (R114, R46, R55; notice-ai-runs-96) and the class's
   construction, which migrates ai-runs' tables through `store-assembly`. Confirmed with no code change: the read reaches
   ai-runs' own answer through the object's door, unchanged by the class; and a Gate 1 record written in the object is held
   in the storage the class migrates, so a restart over that storage reads it back. Which module registers the path's
   source in a deployed plane is not this module's (no requirement here decides it). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { store, Store, storage } from "./fixture.mjs";   /* answers `cloudflare:workers` */
import { aiRunsOf } from "../../../src/ai-runs/index.mjs";

test("notice ai-runs:323 (R1): aipathready through the Store's own fetch answers ai-runs' pathReadyRead, failing closed (no viewer, no pair, an account the viewer cannot see); control: the class adds nothing to it", async () => {
  const x = await store();
  const runs = aiRunsOf(x.ctx);
  for (const [q, args, reason] of [
    ["", {}, "no_viewer"],
    ["?viewer=member:ann", { viewer: "member:ann" }, "no_pair"],
    ["?viewer=member:ann&account_id=acct-323&entry_id=entry-323", { viewer: "member:ann", account_id: "acct-323", entry_id: "entry-323" }, null]]) {
    const res = await x.fetch(`/aipathready${q}`);
    assert.equal(res.status, 200, q);
    const body = await res.json();
    const own = await runs.pathReadyRead(args);
    assert.deepEqual(body.result, own, `${q}: ai-runs' own answer`);
    assert.equal(body.result.ready, false, `${q}: not ready`);
    assert.equal(body.result.reason, reason, q);
  }
});

// fixtures-own: harness - a throwaway Gate 1 record standing in for ai-gate, which has no code yet (as fixture.mjs' gateRecord)
const record = (at) => ({ part: "ask", entry_id: "entry-391", suiteVersions: { bank: 1, scorer: 1, thresholds: 1, image: 1 },
  verdict: "passes", limits: [], grade: "throwaway", at });

test("notice ai-runs:391 (R1): a Gate 1 record written in the Store's object is held in the storage the class migrates and read back after a restart; control: an unfit record is refused and nothing written", async () => {
  const db = new DatabaseSync(":memory:");
  const construct = async () => {
    const st = storage(db);
    new Store(st.ctx, { STORE: { idFromName: (n) => n } });
    for (const p of st.blocked) await p;
    return st.ctx;
  };
  const ctx1 = await construct();
  const w = aiRunsOf(ctx1).gateVerdictRecord(record("2026-11-05T00:00:00Z"));
  assert.equal(w.ok, true, JSON.stringify(w));
  const bad = aiRunsOf(ctx1).gateVerdictRecord({ ...record("2026-11-05T00:00:01Z"), verdict: undefined });
  assert.equal(bad.ok, false);
  const ctx2 = await construct();
  const back = aiRunsOf(ctx2).gateVerdictRecords({ entry_id: "entry-391" });
  assert.deepEqual(back, [record("2026-11-05T00:00:00Z")], "the one fit record, as written");
});
