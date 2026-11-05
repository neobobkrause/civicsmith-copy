/* Notice ai-runs:391 (PR 391): ai-runs restated its R75 (ai-gate builds the Gate 1 record, ai-runs writes it) and added the
   exports `AiRuns.gateVerdictRecord` and `AiRuns.gateVerdictRecords`. Confirmed with no code change here: this module's
   Uses name of ai-runs only `runFor` (its R28; R2), and that is the one service it calls; neither Gate 1 export nor R75 is
   named by any requirement of this module. Nothing to revert: the receipt takes --exempt-revert. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AiRuns } from "../../../src/ai-runs/index.mjs";

const SRC = readFileSync(new URL("../../../src/queue-producers/index.mjs", import.meta.url), "utf8");

test("notice ai-runs:391: of ai-runs this module calls runFor alone, never the Gate 1 record reads or writes; control: runFor is still offered and the added exports are ai-runs'", () => {
  assert.deepEqual([...new Set([...SRC.matchAll(/#aiRuns\.(\w+)/g)].map((m) => m[1]))], ["runFor"]);
  assert.ok(!/gateVerdictRecord/.test(SRC));
  assert.equal(typeof AiRuns.prototype.runFor, "function", "runFor is offered as before");
  assert.equal(typeof AiRuns.prototype.gateVerdictRecord, "function");
  assert.equal(typeof AiRuns.prototype.gateVerdictRecords, "function");
});
