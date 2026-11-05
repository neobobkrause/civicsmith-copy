/* store-assembly: the provider notices ai-runs:391, inquiry-grammar:423, registers:426 and local-facts:429. Confirmed, no
   code change. ai-runs R75 (PR 391) adds `gateVerdictRecord` and `gateVerdictRecords` on ai-runs' own instance; the assembly
   builds and migrates that one instance (R3, R29), so on an assembled store the reader answers and an unfit record is
   refused writing nothing. inquiry-grammar (PR 423) adds pure file_says leg helpers; the assembly reaches it only through
   `registerInquiryGrammar` (R2), unchanged. registers (PR 426) and local-facts (PR 429) changed their source only; the
   assembly spreads each one's own ops map (R6, R101, R34), so every op of each export reaches its owner once through the
   door, never UNKNOWN_OP. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { store } from "./fixture.mjs";
import { aiRunsOf } from "../../../src/ai-runs/index.mjs";
import { registersOps } from "../../../src/registers/index.mjs";
import { localFactsOps } from "../../../src/local-facts/index.mjs";

test("notice ai-runs:391 (ai-runs R75): the assembled store's one ai-runs instance holds the Gate 1 records' reader and writer over its migrated table", async () => {
  const x = await store();
  const runs = aiRunsOf(x.ctx);
  assert.deepEqual(runs.gateVerdictRecords({}), [], "a fresh store holds no Gate 1 record, and the read answers");
  const bad = runs.gateVerdictRecord({});
  assert.equal(bad.ok, false, JSON.stringify(bad));
  assert.deepEqual(runs.gateVerdictRecords({}), [], "an unfit record writes nothing");
});

test("notices registers:426, local-facts:429 (R6, R101, R34): every op of each owner's own map is in the route map once and reaches its owner through the door", async () => {
  const x = await store();
  const u = new URL("http://do/x");
  const keys = Object.keys(x.s.routes(u, null));
  for (const [name, ops] of [["registers", Object.keys(registersOps({}, u, null))], ["local-facts", Object.keys(localFactsOps({}, u, null))]]) {
    assert.ok(ops.length > 0, name);
    for (const op of ops) {
      assert.equal(keys.filter((k) => k === op).length, 1, `${name}: ${op} once`);
      const r = await x.s.dispatch(new Request(`http://do/${op}?viewer=member:ada&by=ada`, { method: "POST", body: "{}" }));
      const b = await r.json().catch(() => ({}));
      assert.notEqual((b.result ?? b).reason ?? b.error, "UNKNOWN_OP", `${name}: ${op}`);
    }
  }
});
