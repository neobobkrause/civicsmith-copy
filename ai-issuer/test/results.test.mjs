/* ai-issuer — results, the library rows, destruction and a team's own result (R16–R18, R25). */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as F from "./fixture.mjs";

const { AC } = F;
const MONTH = 31 * F.DAY;

async function scoredWorld() {
  const env = F.makeEnv();
  await F.register(env);
  return env;
}

test("R16 a scored bundle stores REPORTED, a canary run REPRODUCED, a re-score supersedes; unverified, REPRODUCED-for-a-receipt and a repeat are refused", async () => {
  const env = await scoredWorld();
  const b = await F.sentBundle(env);
  const list = (await F.op(env, "bundlesToScore", {})).json.bundles;
  assert.equal(list.length, 1);
  assert.equal(list[0].receipt_id, b.receipt_id);
  assert.ok(list[0].sealed.length > 0);
  assert.equal(Date.parse(list[0].due_by) - Date.parse(list[0].received_at), F.P.PARAMS.SCORE_WITHIN_MS);
  let r = await F.op(env, "recordResult", { receipt_id: b.receipt_id, ...F.resultArgs() });
  assert.equal(r.json.grade, "REPORTED", JSON.stringify(r.json));
  r = await F.op(env, "recordResult", { own_run: true, run_ref: "canary-1", ...F.resultArgs() });
  assert.equal(r.json.grade, "REPRODUCED");
  r = await F.op(env, "recordResult", { receipt_id: b.receipt_id, ...F.resultArgs({ scorer_version: "scorer-2",
    parts: { ask: { verdict: "not_suitable", limits: [] } } }) });
  assert.equal(r.status, 200);
  const rows = (await F.op(env, "libraryRowsFor", { subject_id: "fake-one" })).json.rows;
  assert.deepEqual(rows.map((x) => [x.grade, x.parts.ask.verdict]).sort(), [["REPORTED", "not_suitable"], ["REPRODUCED", "passes"]]);
  /* controls */
  r = await F.op(env, "recordResult", { receipt_id: b.receipt_id, ...F.resultArgs({ scorer_version: "scorer-2" }) });
  assert.equal(r.json.code, "RESULT_REFUSED", "the same result twice");
  r = await F.op(env, "recordResult", { receipt_id: b.receipt_id, grade: "REPRODUCED", ...F.resultArgs({ scorer_version: "s9" }) });
  assert.equal(r.json.code, "RESULT_REFUSED");
  r = await F.op(env, "recordResult", { receipt_id: b.receipt_id, own_run: true, run_ref: "x", ...F.resultArgs({ scorer_version: "s9" }) });
  assert.equal(r.json.code, "RESULT_REFUSED");
  const run = await F.runKey();
  const ch = (await F.challenge(env, run)).json;
  const unverified = (await F.send(env, await F.bundle(ch, run, { signer: await F.runKey() }))).json;
  assert.equal(unverified.status, "unverified");
  r = await F.op(env, "recordResult", { receipt_id: unverified.receipt_id, ...F.resultArgs() });
  assert.equal(r.json.code, "RESULT_REFUSED");
  assert.equal(r.json.check, "C-158.14");
  assert.equal((await F.op(env, "bundlesToScore", {})).json.bundles.length, 1, "an unverified bundle is never scored");
});

test("R17 an unnamed bundle's row says only team; a named one carries its name; after withdrawName the next call omits it", async () => {
  const env = await scoredWorld();
  const plain = await F.sentBundle(env, { extra: { declared_team: "Hidden Team" } });
  const named = await F.sentBundle(env, { extra: { declared_team: "Open Team", agree_named: true } });
  await F.op(env, "recordResult", { receipt_id: plain.receipt_id, ...F.resultArgs() });
  await F.op(env, "recordResult", { receipt_id: named.receipt_id, ...F.resultArgs() });
  await F.op(env, "recordResult", { own_run: true, run_ref: "canary-1", ...F.resultArgs({ tested_at: "2026-11-01T11:00:00Z" }) });
  /* an inactive one: tested seven months ago */
  const old = await F.sentBundle(env);
  await F.op(env, "recordResult", { receipt_id: old.receipt_id, ...F.resultArgs({ tested_at: F.iso(F.T0 - 7 * MONTH) }) });
  let rows = (await F.op(env, "libraryRowsFor", { subject_id: "fake-one" })).json.rows;
  assert.equal(rows.length, 3, "the result tested seven months ago is not active");
  const team = rows.filter((x) => x.tested_by === "team");
  assert.equal(team.length, 2);
  const unnamed = team.find((x) => x.team_name === undefined);
  assert.ok(unnamed && unnamed.consent_ref === undefined);
  assert.ok(!JSON.stringify(rows).includes("Hidden Team"));
  assert.ok(team.every((x) => x.repeated_by_civicsmith === true), "a Civicsmith run under the same versions repeats them");
  /* the rows are ai-catalogue's library rows: a payload carrying them validates */
  const { validatePayload } = await import("../../bio-plane/src/ai-catalogue/validate.mjs");
  const combined = (await F.op(env, "combinedFor", { subject_id: "fake-one", suiteVersions: F.resultArgs().suiteVersions,
    thresholds: { kind: "thresholds", version: "thresholds-0", floors: {} } })).json;
  assert.equal(combined.ok, true, JSON.stringify(combined));
  assert.equal(combined.records.length, 1);
  assert.deepEqual(combined.records[0].results, { total: 3, reproduced: 1, reported: 2 });
  const v = validatePayload(AC.payload({ library: rows, combined: combined.records.map((c) => ({ ...c, as_of: c.as_of.slice(0, 10),
    window: { from: c.window.from.slice(0, 10), to: c.window.to.slice(0, 10) } })) }));
  assert.equal(v.ok, true, JSON.stringify(v));
  /* control */
  const withName = team.find((x) => x.team_name !== undefined);
  assert.equal(withName.team_name, "Open Team");
  assert.equal(withName.consent_ref, named.receipt_id);
  assert.equal((await F.op(env, "withdrawName", { receipt_id: named.receipt_id })).status, 200);
  rows = (await F.op(env, "libraryRowsFor", { subject_id: "fake-one" })).json.rows;
  assert.ok(rows.every((x) => x.team_name === undefined));
  assert.ok(!JSON.stringify(F.dump(env)).includes("Open Team"));
});

test("R18 the sweep destroys a bundle of an unlisted AI tested seven months ago and keeps one of an AI lapsed eleven months ago; a listed AI tested two years ago is kept", async () => {
  const env = F.makeEnv();
  await F.register(env);
  /* entries listed long ago; `lapsed-one` lapsed eleven months ago, `listed-one` still listed */
  const doc = F.payloadOf(1, [AC.entry("lapsed-one"), AC.entry("listed-one")], { issued_at: F.iso(F.T0 - 30 * MONTH) });
  assert.equal((await F.publishPayload(env, doc)).status, 200);
  assert.equal((await F.publishAdvisory(env, AC.adv(2, { entry_id: "lapsed-one" }, "lapse",
    { reason: "deprecation", effective_at: F.iso(F.T0 - 11 * MONTH), issued_at: F.iso(F.T0 - 11 * MONTH) }))).status, 200);
  const unlisted = await F.sentBundle(env);
  const lapsed = await F.sentBundle(env);
  const listed = await F.sentBundle(env);
  const fresh = await F.sentBundle(env);
  await F.op(env, "recordResult", { receipt_id: unlisted.receipt_id, ...F.resultArgs({ subject_id: "tested-unlisted", tested_at: F.iso(F.T0 - 7 * MONTH) }) });
  await F.op(env, "recordResult", { receipt_id: lapsed.receipt_id, ...F.resultArgs({ subject_id: "lapsed-one", tested_at: F.iso(F.T0 - 24 * MONTH) }) });
  await F.op(env, "recordResult", { receipt_id: listed.receipt_id, ...F.resultArgs({ subject_id: "listed-one", tested_at: F.iso(F.T0 - 24 * MONTH) }) });
  await F.op(env, "recordResult", { receipt_id: fresh.receipt_id, ...F.resultArgs({ subject_id: "tested-unlisted", tested_at: F.iso(F.T0 - 1 * MONTH) }) });
  await F.worker.scheduled({}, env);
  const rows = Object.fromEntries(F.dump(env).bundles.map((b) => [b.receipt_id, b]));
  const u = rows[unlisted.receipt_id];
  assert.equal(u.manifest, null);
  assert.equal(u.blob, null);
  assert.equal(u.destroy_reason, "retention");
  assert.ok(!env.BLOBS.m.has(`bundles/${unlisted.receipt_id}`));
  assert.deepEqual((await F.call(env, "GET", `/ai/result/${unlisted.result_token}`)).json, { status: "destroyed", reason: "retention" });
  assert.equal(F.dump(env).results.filter((r) => r.receipt_id === unlisted.receipt_id).length, 0, "its unpublished result is removed");
  /* controls */
  for (const k of [lapsed, listed, fresh]) {
    assert.equal(rows[k.receipt_id].destroyed_at, null, k.receipt_id);
    assert.ok(env.BLOBS.m.has(`bundles/${k.receipt_id}`));
  }
  assert.equal(F.dump(env).results.length, 3);
  /* by the operator, with a reason */
  const d = await F.op(env, "destroyBundle", { receipt_id: fresh.receipt_id, reason: "secret_found" });
  assert.equal(d.status, 200);
  assert.deepEqual((await F.call(env, "GET", `/ai/result/${fresh.result_token}`)).json, { status: "destroyed", reason: "secret_found" });
  assert.equal(F.dump(env).results.length, 2);
});

test("R25 a token answers pending, then its scored result; another bundle's token never answers it and the request writes no row", async () => {
  const env = await scoredWorld();
  const mine = await F.sentBundle(env);
  const other = await F.sentBundle(env);
  let r = await F.call(env, "GET", `/ai/result/${mine.result_token}`);
  assert.deepEqual(r.json, { status: "pending" });
  await F.op(env, "recordResult", { receipt_id: mine.receipt_id, ...F.resultArgs() });
  r = await F.call(env, "GET", `/ai/result/${mine.result_token}`);
  assert.equal(r.json.status, "scored");
  assert.equal(r.json.grade, "REPORTED");
  assert.equal(r.json.repeated_by_civicsmith, false);
  assert.deepEqual(Object.keys(r.json).sort(), ["figures", "grade", "parts", "repeated_by_civicsmith", "speed", "status",
    "subject_id", "suiteVersions", "task_cost", "tested_at"]);
  /* controls */
  const rows = F.rowCount(env);
  assert.deepEqual((await F.call(env, "GET", `/ai/result/${other.result_token}`)).json, { status: "pending" });
  const a = await F.call(env, "GET", "/ai/result/AAAAAAAAAAAAAAAAAAAAAA", { headers: { "user-agent": "one" } });
  const b = await F.call(env, "GET", "/ai/result/BBBBBBBBBBBBBBBBBBBBBB", { headers: { "user-agent": "two" } });
  assert.equal(a.status, 404);
  assert.deepEqual(a.bytes, b.bytes);
  assert.equal((await F.call(env, "GET", `/ai/result/${mine.receipt_id}`)).status, 404, "the receipt id is not the token");
  assert.equal(F.rowCount(env), rows);
});
