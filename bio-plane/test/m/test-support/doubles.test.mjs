/* test-support R26, R27 (fix round 9, G123c; plan section 2c.1, 2c.6): the platform-shaped alarm double and the job
 * registrar's stub, tested at their interface. Each test names the requirement it checks in its title. */
import "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { alarmDouble } from "../../alarm-double.mjs";
import { jobRegistrarStub, JOB_KINDS } from "../../job-registrar-stub.mjs";
/** @import { JobAnswer } from '../../job-registrar-stub.mjs' */

const SHA = "a".repeat(64), SHA2 = "b".repeat(64);

test("R26 getAlarm() answers null while a run is in flight, and the alarm's time before and after it", async () => {
  const d = alarmDouble();
  await d.setAlarm(1000);
  assert.equal(await d.getAlarm(), 1000);
  /** @type {number | null | undefined} */
  let during;
  await d.run(async () => { during = await d.getAlarm(); });
  assert.equal(during, null);
  assert.equal(await d.storage.getAlarm(), 1000, "the storage's own getAlarm is the same alarm");
});

test("R26 a spent alarm stays set until deleteAlarm(); one set during the run is what getAlarm answers after it", async () => {
  const d = alarmDouble();
  await d.setAlarm(5);
  await d.run(() => {});
  assert.equal(await d.getAlarm(), 5, "spent, still set");
  await d.deleteAlarm();
  assert.equal(await d.getAlarm(), null);
  await d.setAlarm(7);
  /** @type {number | null | undefined} */
  let seen;
  await d.run(async () => { await d.setAlarm(9); seen = await d.getAlarm(); });
  assert.equal(seen, 9, "set inside the run: the new time");
  assert.equal(await d.getAlarm(), 9);
});

test("R26 a failing run is run again up to 6 retries, retries counts them, and a run that keeps failing ends failed", async () => {
  const d = alarmDouble();
  let calls = 0;
  const r1 = await d.run(() => { calls++; if (calls < 3) throw new Error("tick-2 store failure"); });
  assert.deepEqual([calls, r1.ok, r1.retries, d.retries], [3, true, 2, 2]);
  /** @type {number[]} */
  const counts = [];
  const r2 = await d.run((info) => { counts.push(info.retryCount); throw new Error("always"); });
  assert.deepEqual(counts, [0, 1, 2, 3, 4, 5, 6], "the first run and 6 retries, each told its retry count");
  assert.equal(r2.ok, false);
  assert.equal(r2.retries, 6);
  const err = r2.error;
  assert.equal(err instanceof Error ? err.message : undefined, "always");
  assert.equal(d.retries, 8, "retries counts over every run");
});

test("R26 opts: maxRetries bounds the retries, and rerunAfterSuccess re-runs a completed handler once with retryCount 1 (PLATFORM_FIGURES)", async () => {
  const d = alarmDouble({ maxRetries: 2 });
  let n = 0;
  const r = await d.run(() => { n++; throw new Error("x"); });
  assert.deepEqual([n, r.retries], [3, 2]);
  const e = alarmDouble({ rerunAfterSuccess: true });
  /** @type {number[]} */
  const seen = [];
  await e.run((info) => { seen.push(info.retryCount); });
  assert.deepEqual(seen, [0, 1]);
});

test("R26 the storage double keeps values by key as structured clones and logs each call", async () => {
  const d = alarmDouble();
  const v = { a: [1, 2] };
  await d.storage.put("k", v);
  v.a.push(3);
  assert.deepEqual(await d.storage.get("k"), { a: [1, 2] });
  assert.equal(await d.storage.get("none"), undefined);
  assert.equal(await d.storage.delete("k"), true);
  assert.deepEqual(d.storage.log.map((l) => l[0]), ["put", "get", "get", "delete"]);
});

test("R26 the double's file imports nothing from the plane, so a module that does not use plane can take it", () => {
  const text = readFileSync(new URL("../../alarm-double.mjs", import.meta.url), "utf8");
  const specs = [...text.matchAll(/\bfrom\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']/g)].map((m) => m[1] ?? m[2]);
  assert.deepEqual(specs.filter((s) => s !== undefined && s.startsWith(".")), [], "no relative import at all");
});

test("R27 registerJob writes one row per (sha, kind), answers {ok, existed, state}, and is synchronous", () => {
  const s = jobRegistrarStub();
  const r = s.registerJob({ kind: "reading", sha: SHA, cursor: { page: 1 }, owed: 4, carrier: "r2/key", parts: 2, detail: { a: 1 }, verdict: { ok: true, size: 1, limit: 2, bound_key: "b" } });
  assert.ok(!(r instanceof Promise));
  assert.deepEqual(r, { ok: true, existed: false, state: "queued" });
  const [row] = s.rows();
  assert.ok(row);
  assert.equal(row.kind, "reading");
  assert.equal(row.sha, SHA);
  assert.deepEqual([row.cursor, row.owed, row.carrier, row.parts, row.detail], [{ page: 1 }, 4, "r2/key", 2, { a: 1 }]);
  assert.deepEqual([row.written, row.skipped, row.failed], [0, 0, 0]);
  assert.deepEqual(s.registerJob({ kind: "ocr", sha: SHA }), { ok: true, existed: false, state: "queued" });
  assert.equal(s.rows().length, 2, "another kind is another row");
});

test("R27 a second registration re-arms, updates cursor, owed, detail and parts only when given, never resets counters, and priority raised is Read it", () => {
  const s = jobRegistrarStub();
  s.registerJob({ kind: "reading", sha: SHA, cursor: 1, owed: 5, detail: "d", parts: 3 });
  s.bump(SHA, "reading", { written: 4, skipped: 1, failed: 2, state: "partial" });
  const r = s.registerJob({ kind: "reading", sha: SHA, owed: 9, priority: "raised" });
  assert.deepEqual(r, { ok: true, existed: true, state: "queued" });
  const [row] = s.rows();
  assert.ok(row);
  assert.deepEqual([row.cursor, row.owed, row.detail, row.parts], [1, 9, "d", 3]);
  assert.deepEqual([row.written, row.skipped, row.failed], [4, 1, 2]);
  assert.equal(row.priority, "raised");
  s.registerJob({ kind: "reading", sha: SHA });
  assert.equal(s.rows()[0]?.priority, "raised", "a later registration without priority does not lower it");
});

test("R27 every kind of the contract registers; fetch and subresources are keyed by capture session; anything else answers ok:false and never throws", () => {
  assert.deepEqual([...JOB_KINDS].sort(), ["fetch", "grade", "ingest", "keep", "ocr", "reading", "safe_view", "scan", "subresources", "unpack"]);
  const s = jobRegistrarStub();
  for (const kind of JOB_KINDS) {
    const e = kind === "fetch" || kind === "subresources" ? { kind, session: "cap-1" } : { kind, sha: SHA2 };
    assert.equal(s.registerJob(e).ok, true, kind);
  }
  assert.equal(s.rows().length, 10);
  for (const bad of [null, undefined, 7, {}, { kind: "nope", sha: SHA }, { kind: "reading" }, { kind: "reading", sha: "ABC" }, { kind: "reading", sha: SHA.toUpperCase() }, { kind: "fetch" }, { kind: "fetch", sha: SHA }]) {
    /** @type {JobAnswer | undefined} */
    let r;
    assert.doesNotThrow(() => { r = s.registerJob(bad); });
    const answer = r;
    assert.equal(answer?.ok, false, JSON.stringify(bad));
    assert.equal(typeof (answer !== undefined && "reason" in answer ? answer.reason : undefined), "string");
  }
  assert.equal(s.rows().length, 10, "a refused registration writes nothing");
});

test("R27 a row written inside a transaction that rolled back is not listed; one that committed is", () => {
  const s = jobRegistrarStub();
  assert.throws(() => s.transact(() => { s.registerJob({ kind: "keep", sha: SHA }); throw new Error("filing failed"); }), /filing failed/);
  assert.deepEqual(s.rows(), []);
  s.registerJob({ kind: "keep", sha: SHA2, owed: 1 });
  assert.throws(() => s.transact(() => { s.registerJob({ kind: "keep", sha: SHA2, owed: 2 }); throw new Error("x"); }));
  assert.equal(s.rows()[0]?.owed, 1, "an update rolled back too");
  s.transact(() => s.registerJob({ kind: "keep", sha: SHA }));
  assert.equal(s.rows().length, 2);
});

test("R27 armed() says whether armJobs() has been called since the last row changed", async () => {
  const s = jobRegistrarStub();
  assert.equal(s.armed(), false);
  s.registerJob({ kind: "scan", sha: SHA });
  assert.equal(s.armed(), false);
  await s.armJobs();
  assert.equal(s.armed(), true);
  s.registerJob({ kind: "scan", sha: SHA, owed: 1 });
  assert.equal(s.armed(), false, "re-arming the row asks for the alarm again");
  await s.armJobs();
  assert.equal(s.armed(), true);
});
