/* load-check R4: report writes one P-M row a level from a completed run, every field present; an interrupted run
 * records none. */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runProfile, seedCopy, report } from "../../../src/load-check/index.mjs";
import { fixtureCopy, profile, fast } from "./fixture-copy.mjs";

const FIELDS = ["pm", "level", "level_name", "members_at_once", "record_bytes", "upload_bytes", "cost", "first_broken", "copy", "commit", "date",
  "walkers", "samples", "range", "measured"];

test("R4 a completed run records one row with every field", async () => {
  const copy = fixtureCopy({ latency: (op, members) => (op === "cite" ? 20 : 100 * members) });
  await seedCopy(copy, { database_bytes: 20000, r2_bytes: 40000, mix: "text" }, { seed_id: "p3dev-load-r4" });
  const r = await runProfile(copy, profile(), [5, 10, 15, 25], fast);
  const file = join(mkdtempSync(join(tmpdir(), "load-check-")), "rows.md");
  const { rows, text } = report([r], { commit: "0123abcd", date: "2026-11-05", pm: { 1: "P-M9" }, path: file });
  assert.equal(rows.length, 1);
  const row = rows[0];
  for (const k of FIELDS) assert.ok(row[k] !== null && row[k] !== undefined, `field ${k}`);
  assert.equal(row.level, 1);
  assert.equal(row.members_at_once, 15);
  assert.deepEqual(row.record_bytes, { database: copy.seed.database_bytes, r2: copy.seed.r2_bytes });
  assert.ok(row.first_broken.includes("home"));
  assert.equal(row.walkers, "none");
  assert.equal(row.samples, r.samples);
  assert.deepEqual(row.range.members, [5, 25]);
  assert.equal(readFileSync(file, "utf8").trim(), text);
  assert.ok(text.startsWith("| P-M9 |"));
});

test("R4 an interrupted run records no row", async () => {
  const stop = new AbortController();
  const copy = fixtureCopy({ onCall: (op, input, ctx) => { if (ctx.members === 10) stop.abort(); } });
  await seedCopy(copy, { database_bytes: 20000, r2_bytes: 40000, mix: "text" }, { seed_id: "p3dev-load-r4i" });
  const r = await runProfile(copy, profile(), [5, 10, 15], { ...fast, signal: stop.signal });
  assert.equal(r.completed, false);
  assert.equal(r.interrupted, true);
  assert.equal(r.rated, null);
  const file = join(mkdtempSync(join(tmpdir(), "load-check-")), "rows.md");
  const { rows, text } = report([r], { commit: "0123abcd", date: "2026-11-05", path: file });
  assert.deepEqual(rows, []);
  assert.equal(text, "");
  assert.equal(existsSync(file), false);
});
