/* store-assembly R21 (attempt 16, CR2-30; hypotheses F1 and CR2-19, IV-H2; steps R31): the assembly hands `hypotheses`
   its one `steps` instance, so hypotheses registers its rival source with the real steps and reads a rival's legs
   from them. Driven over the assembled store, every module the real one. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { store } from "./fixture.mjs";
import { hypothesesOf } from "../../../src/hypotheses/index.mjs";
import { stepsOf } from "../../../src/steps/index.mjs";

const ASSEMBLE = fileURLToPath(new URL("../../../src/store-assembly/assemble.mjs", import.meta.url));

test("R21 (CR2-30): the composition root builds hypotheses with steps, the steps instance it built before it", () => {
  const src = readFileSync(ASSEMBLE, "utf8");
  const calls = [...src.matchAll(/hypothesesOf\(ctx, \{([^}]*)\}\)/g)].map((m) => m[1]);
  assert.equal(calls.length, 1, "hypotheses is built with deps once, at its place (R21)");
  assert.match(calls[0], /\bsteps: stepsOf\(ctx\)/, "hypotheses is handed the assembly's steps");
  assert.ok(src.indexOf("stepsOf(ctx, {") < src.indexOf("hypothesesOf(ctx, {"), "steps is built before hypotheses (R27)");
});

/* Behaviour at hypotheses' interface (`bindSteps`, its CR2-19; steps R31): the instance the assembly built is already
   bound to the assembly's steps, so binding that same instance again answers `already`. */
test("R21 (CR2-30): the assembled hypotheses is bound to the assembly's own steps", async () => {
  const x = await store();
  const r = hypothesesOf(x.ctx).bindSteps(stepsOf(x.ctx));
  assert.deepEqual({ ok: r.ok, already: r.already }, { ok: true, already: true });
});
