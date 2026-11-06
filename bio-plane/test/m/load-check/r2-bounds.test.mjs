/* load-check R2: the caps clip what the caller asks, a copy this module did not seed is never loaded, and the
 * credential given in the test environment appears in no output, log or report. */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runProfile, seedCopy, report, MEMBER_CAP, RATE_CAP } from "../../../src/load-check/index.mjs";
import { fixtureCopy, profile, fast, CREDENTIAL } from "./fixture-copy.mjs";

const seeded = (copy) => Object.assign(copy, { seed: { by: "load-check", team: "p3dev-load-team", documents: [] } });

test("R2 a request beyond the caps is clipped to them", async () => {
  const copy = seeded(fixtureCopy());
  const paces = [];
  const r = await runProfile(copy, profile({ rate: 10 * RATE_CAP, rounds: 1 }), [5, 10 * MEMBER_CAP],
    { now: () => 0, sleep: async (ms, why) => { if (why === "pace") paces.push(ms); } });
  assert.deepEqual(r.steps.map((s) => s.members), [5, MEMBER_CAP]);
  assert.ok(!copy.state.requests.some((q) => q.members > MEMBER_CAP));
  assert.deepEqual(r.clipped.members, { asked: 10 * MEMBER_CAP, cap: MEMBER_CAP });
  assert.deepEqual(r.clipped.rate, { asked: 10 * RATE_CAP, cap: RATE_CAP });
  assert.equal(r.rate, RATE_CAP);
  /* the last of n request starts in a step waits (n-1) intervals: never more than RATE_CAP a second */
  const big = r.steps[1].requests;
  assert.ok(Math.max(...paces) >= ((big - 1) * 1000) / RATE_CAP - 1e-6);
});

test("R2 a copy carrying another team's seed is refused, and one with no seed of this module's", async () => {
  const other = Object.assign(fixtureCopy({ team: "Riverside Tenants" }), { seed: { by: "load-check", team: "p3dev-load-team", documents: [] } });
  await assert.rejects(runProfile(other, profile(), [5], fast), (e) => e.code === "ANOTHER_TEAMS_SEED");
  assert.equal(other.state.requests.length, 0);
  const none = fixtureCopy();
  await assert.rejects(runProfile(none, profile(), [5], fast), (e) => e.code === "NOT_SEEDED_HERE");
  const foreign = Object.assign(fixtureCopy(), { seed: { by: "someone-else", team: "p3dev-load-team" } });
  await assert.rejects(runProfile(foreign, profile(), [5], fast), (e) => e.code === "NOT_SEEDED_HERE");
  assert.equal(none.state.requests.length + foreign.state.requests.length, 0);
});

test("R2 the credential given in the test environment appears in no output, log or report", async () => {
  assert.ok(process.env.LOAD_CHECK_TEST_CREDENTIAL === CREDENTIAL && CREDENTIAL.length > 8);
  const printed = [];
  const keep = { log: console.log, error: console.error, warn: console.warn, info: console.info, out: process.stdout.write, err: process.stderr.write };
  for (const k of ["log", "error", "warn", "info"]) console[k] = (...a) => printed.push(a.join(" "));
  process.stdout.write = (c, ...rest) => { printed.push(String(c)); return true; };
  process.stderr.write = (c, ...rest) => { printed.push(String(c)); return true; };
  const logs = [];
  let result, rep, file;
  try {
    let n = 0;
    const copy = fixtureCopy({ team: `p3dev-${CREDENTIAL}`, fail: (op) => (op === "queue" && ++n % 3 === 0 ? "DENIED" : null),
      onCall: (op) => { if (op === "proposals") throw Object.assign(new Error(`bad token ${CREDENTIAL}`), { code: CREDENTIAL }); } });
    copy.name = `p3dev-load-${CREDENTIAL}`;
    await seedCopy(copy, { database_bytes: 20000, r2_bytes: 40000, mix: "text" }, { seed_id: "p3dev-load-r2" });
    result = await runProfile(copy, profile(), [5, 10], { ...fast, log: (l) => logs.push(l) });
    file = join(mkdtempSync(join(tmpdir(), "load-check-")), "rows.md");
    rep = report([result], { commit: "abc", date: "2026-11-05", pm: { 1: "P-M9" }, path: file });
  } finally {
    Object.assign(console, { log: keep.log, error: keep.error, warn: keep.warn, info: keep.info });
    process.stdout.write = keep.out;
    process.stderr.write = keep.err;
  }
  assert.ok(logs.length > 0 && rep.rows.length === 1);
  for (const [where, text] of [["printed", printed.join("\n")], ["log", logs.join("\n")], ["result", JSON.stringify(result)],
    ["report", rep.text + JSON.stringify(rep.rows)], ["file", readFileSync(file, "utf8")]]) {
    assert.ok(!text.includes(CREDENTIAL), `the credential is in the ${where}`);
  }
  assert.ok(logs.join("\n").includes("[credential]"), "the copy's name carrying it was scrubbed, not dropped");
});
