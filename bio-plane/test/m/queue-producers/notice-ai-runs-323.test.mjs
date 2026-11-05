/* Notice ai-runs:323 (PR 323): ai-runs added the export `AiRuns.pathReadyRead` and changed its source, with no requirement
   text. Confirmed with no code change here: this module's Uses name of ai-runs only `runFor` (its R28; R2), and that is the
   one service it calls; `pathReadyRead` is an op's read (`aipathready`) no requirement of this module names. Nothing to
   revert: the receipt takes --exempt-revert. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AiRuns } from "../../../src/ai-runs/index.mjs";

const SRC = readFileSync(new URL("../../../src/queue-producers/index.mjs", import.meta.url), "utf8");

test("notice ai-runs:323: of ai-runs this module calls runFor alone, never pathReadyRead; control: runFor is still a function ai-runs offers", () => {
  assert.deepEqual([...new Set([...SRC.matchAll(/#aiRuns\.(\w+)/g)].map((m) => m[1]))], ["runFor"]);
  assert.ok(!/pathReadyRead/.test(SRC));
  assert.equal(typeof AiRuns.prototype.runFor, "function", "runFor is offered as before");
  assert.equal(typeof AiRuns.prototype.pathReadyRead, "function", "the added export exists, and is not this module's");
});
