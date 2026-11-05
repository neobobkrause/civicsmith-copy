/* agent-worker — attempt 7's provider notices, answered at this member's interface.
 *
 * agent-harness:353 (R20–R24; exports added: CAPABILITY_NAMES, COSTS, PARTS, ROLE_NEEDS, disclosureGate, …): confirmed,
 *   no code change. This member's source imports nothing from agent-harness; its control flow reaches it only through
 *   agent-steps. The added names serve this module's T53 marks (R120 `ROLE_NEEDS`, R121 parts, R123 `disclosureGate`),
 *   still unmet and not built here.
 * agent-model:355 (R35, the circuit): adapted in an earlier attempt (F3, `circuit.mjs`); confirmed: the circuit's names
 *   this member imports exist and `GET /health` answers over them.
 * agent-drafts:358 (R1, R4, R7; `machineLabel`): adapted in an earlier attempt (F4); confirmed: the label a draft path
 *   answers is `{kind: "machine"}` plus the served `ai` where one was served.
 * agent-steps:361 (R2, R48) and agent-steps:392 (`modelHalf` changed; `providerFor`, `RUN_RUNTIME`, … added): confirmed,
 *   no code change. Every name this member imports from agent-steps is still exported; this member hands `modelHalf` no
 *   `provider`, so a run takes the legacy route, carrying the account's reference and the member's own runner (F2) as
 *   `legacy`, and the T53 provider route (R120–R127, unmet) is not taken.
 * agent-model:395 (R2–R55 requirement text): confirmed, no code change: every name this member imports from agent-model
 *   is still exported with the kind it uses.
 * agent-drafts:408 (its source, no requirement text): confirmed: the draft paths still answer through this member's
 *   fetch (the agent-drafts suites and F4 drive them). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import * as steps from "../../agent-steps/src/index.mjs";
import { remoteOf } from "../src/remote.mjs";
import { machineLabel } from "../src/untested.mjs";

const SRC = new URL("../src/", import.meta.url);
const sources = readdirSync(SRC).filter((f) => f.endsWith(".mjs")).map((f) => [f, readFileSync(new URL(f, SRC), "utf8")]);

/** Every `import { a, b as c } from "<spec>"` in the member's source naming `provider`'s files: [file, spec, names]. */
function importsFrom(provider) {
  const out = [];
  const re = /import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
  for (const [f, src] of sources) {
    for (const m of src.matchAll(re)) {
      if (!m[2].includes(`/${provider}/`)) continue;
      const names = m[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
      out.push([f, m[2], names]);
    }
  }
  return out;
}
async function everyImportResolves(provider) {
  const found = importsFrom(provider);
  for (const [f, spec, names] of found) {
    const mod = await import(new URL(spec, SRC).href);
    for (const n of names) assert.notEqual(mod[n], undefined, `${f} imports ${n} from ${spec}, which no longer exports it`);
  }
  return found;
}

test("notice agent-harness:353: this member's source imports nothing from agent-harness", () => {
  assert.deepEqual(importsFrom("agent-harness"), []);
});

test("notice agent-model:355, agent-model:395: every name this member imports from agent-model is still exported", async () => {
  const found = await everyImportResolves("agent-model");
  const names = found.flatMap(([, , n]) => n);
  for (const n of ["converse", "segmentMeter", "circuitAdmit", "circuitRecord", "pathSource"]) assert.ok(names.includes(n), n);
});

test("notice agent-steps:361, agent-steps:392: every name this member imports from agent-steps is still exported", async () => {
  const found = await everyImportResolves("agent-steps");
  assert.ok(found.flatMap(([, , n]) => n).includes("modelHalf"));
});

test("notice agent-steps:392: the half this member builds takes the legacy route, carrying the reference and the bound runner", () => {
  const RUNNER = { idFromName: (n) => n, get: () => ({}) };
  const reference = { kind: "apikey", secret: "sk-notice-392" };
  const half = steps.modelHalf({ reference, runner: remoteOf({ RUNNER }), meter: null, suggestions: false });
  assert.equal(half.provider, null);
  assert.equal(half.legacy.reference, reference);
  assert.equal(half.legacy.runner, RUNNER);
  assert.ok(!JSON.stringify(half).includes("sk-notice-392"), "the reference is held, never enumerable");
});

test("notice agent-steps:392 (control): unbound, the half carries no runner", () => {
  const half = steps.modelHalf({ reference: null, runner: remoteOf({}), meter: null });
  assert.equal(half.legacy.runner, null);
});

test("notice agent-drafts:358, agent-drafts:408: a draft's label is {kind: machine} with the served ai, and nothing else", () => {
  const ai = { provider: "p", model_version: "m" };
  assert.deepEqual(machineLabel({ label: ai }), { kind: "machine", ai });
  const bare = machineLabel({});
  assert.equal(bare.kind, "machine");
  assert.ok(Object.keys(bare).every((k) => k === "kind" || k === "ai"));
});
