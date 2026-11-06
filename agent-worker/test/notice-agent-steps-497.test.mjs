/* agent-worker over agent-steps PR 497 (its source only, no requirement text): `driveHarness` no longer publishes a
 * table state that `agent-harness`' `publishableState` refuses `STATE_HOLDS_PROVIDER_STATE` (its R23); that tick
 * publishes no state and the refusal is named in `drive.refusals`, `{at: "airuntick.state", code, key, detail}`. This
 * member answers R28's `refusals` as `drive.refusals` and R91's `segment_end.refusals` as their codes, so no source
 * change is owed (BOB, 6 Nov 04:42): this test pins the pass-through.
 *
 * The refusal is the provider's own: in a child, `agent-harness`' module is its real exports with `publishableState`
 * wrapped so the state it is handed also holds a provider's `session_id` (the case the real table never builds); the
 * real `publishableState` refuses it and the real `driveHarness` names it. Driven at the member's interface,
 * `POST /run` (notice-497-world.mjs: this suite's own fake plane and model). The caller receives that refusal
 * unchanged, as the real function words it, and the plane's `segment_end` names its code; no tick publishes a state.
 * With R28's `refusals` or `refusalCodes` broken it fails. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const HARNESS = join(HERE, "../../agent-harness/src/harness.mjs");

function drive() {
  const script = `
    import { mock } from "node:test";
    const real = { ...(await import(${JSON.stringify("file://" + HARNESS + "?real")})) };
    const handed = [];
    mock.module(${JSON.stringify("file://" + HARNESS)}, { namedExports: { ...real,
      publishableState: (state, ...rest) => { const s = { ...state, session_id: "sess-PROVIDER-HELD" }; const p = real.publishableState(s, ...rest);
                                              handed.push(p); return p; } } });
    const { segment } = await import(${JSON.stringify("file://" + join(HERE, "notice-497-world.mjs"))});
    for (const k of ["log", "info", "warn", "error", "debug"]) console[k] = () => {};
    const r = await segment();
    const ticks = r.rec.calls.filter((c) => c.op === "airuntick" && c.body);
    process.stdout.write("OUT " + JSON.stringify({ status: r.status, out: r.out, handed,
      states: ticks.filter((c) => c.body.state != null).length, end: ticks.find((c) => c.body.segment_end)?.body.segment_end ?? null }) + "\\n");`;
  const out = execFileSync(process.execPath, ["--experimental-test-module-mocks", "--no-warnings", "--input-type=module",
    "-e", script], { encoding: "utf8", cwd: join(HERE, "..") });
  const m = /^OUT (.*)$/m.exec(out);
  assert.ok(m, `the child answered: ${out}`);
  return JSON.parse(m[1]);
}

test("notice agent-steps:497 (R28, R91): a state refused STATE_HOLDS_PROVIDER_STATE reaches the caller's refusals unchanged and segment_end names its code", () => {
  const r = drive();
  assert.equal(r.status, 200, JSON.stringify(r.out).slice(0, 400));
  assert.equal(r.out.ok, true);
  const refused = r.handed.filter((p) => p.ok === false);
  assert.ok(refused.length > 0, "the real publishableState refused a state");
  const want = refused.map((p) => ({ at: "airuntick.state", code: p.code, key: p.key, detail: p.detail }));
  const got = (r.out.refusals || []).filter((x) => x?.at === "airuntick.state");
  assert.deepEqual(got.slice(0, want.length), want.slice(0, got.length), "each refusal as the provider worded it");
  assert.ok(got.length > 0 && got.every((x) => x.code === "STATE_HOLDS_PROVIDER_STATE" && x.key === "session_id"));
  assert.equal(r.states, 0, "no tick published a state");
  assert.ok(r.end && r.end.refusals.includes("STATE_HOLDS_PROVIDER_STATE"), "R91: segment_end names the code");
});
