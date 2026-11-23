/* store-assembly's copy of plane's test. record-core R91 through plane's real ledger (moved from record-core's tests, K4933; fix round 9, job 61; K4912): R91 amended, the job table's two stamp tables are bookkeeping too. PLANE's job table
   (`job_unit_attempts`, `job_batches`) is written by every ledger tick; a tick that changed no record must leave `writeCount()` as it
   was. These go through the plane's real ledger on this module's own storage, and read the plane's tables from the DDL it exports,
   never from a hand list of another module's tables (K3268). Counted, never timed (R-CLOCK). */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as core from "../../../src/record-core/index.mjs";
import * as plane from "../../../src/store-assembly/pending.mjs";
import { storage } from "../record-core/storage.mjs";

const SHA = "a".repeat(64);
const tables = (s) => [...s.sql.exec(`SELECT name FROM sqlite_master WHERE type='table'`)].map((r) => r.name);
const ledger = () => {
  const s = storage();
  const ctx = { storage: s };
  const rc = core.recordOf(ctx); rc.migrate();
  const p = plane.pendingOf(ctx, { now: () => 1_000_000 }); p.migrate();
  rc.writeCount();   /* the first reading watches the listed tables */
  return { s, rc, p };
};

test("R91: every table the plane's ledger creates, other than the record's own, is on the bookkeeping list (read from the plane's exported DDL)", () => {
  const ddl = Object.entries(plane).filter(([k, v]) => /_DDL$/.test(k) && typeof v === "string");
  assert.ok(ddl.length >= 4, "the plane exports the DDL of its tables");
  const s = storage();
  for (const [, text] of ddl) s.sql.exec(text);
  const own = new Set(tables(storage()));   /* the record's own schema */
  const made = tables(s).filter((t) => !own.has(t));
  assert.ok(made.length >= 4, "the ledger made its tables");
  for (const t of made) assert.ok(core.BOOKKEEPING_TABLES.includes(t), `${t} is bookkeeping`);
});

test("R91: landing a batch (a row in job_batches alone) leaves writeCount() as it was", () => {
  const { s, rc, p } = ledger();
  const n0 = rc.writeCount();
  assert.equal(p.landBatch({ sha: SHA, kind: "reading", batch: 1 }), true);
  assert.equal([...s.sql.exec(`SELECT 1 FROM job_batches`)].length, 1, "the row was written");
  assert.equal(rc.writeCount(), n0);
});

test("R91: a ledger tick that stamps a unit (a row in job_unit_attempts) and changes no record leaves writeCount() as it was", async () => {
  const { s, rc, p } = ledger();
  assert.deepEqual(await p.owe({ kind: "reading", sha: SHA }), { ok: true });
  const n0 = rc.writeCount();
  await p.consumer().tick(1_000_000);
  assert.ok([...s.sql.exec(`SELECT 1 FROM job_unit_attempts`)].length >= 1, "the tick stamped a unit");
  assert.equal(rc.writeCount(), n0);
});

/* store-services R74 (control-plane R135): `owedwork` lists the rows `op=reading` answers, a finished one among them, each with the
   `cursor`, `last_progress_at` and `verdict` the job row holds, read as `jobrow` reads them. Through the real ledger and its real
   `owedwork` arm; the owner of the reading is a worker handed at composition. Counted, never timed. */
const SHA2 = "b".repeat(64);
const VERDICT = { ok: true, size: 10, limit: 20, bound_key: "pdf.request_bytes" };
const owedwork = (p, query) => plane.pendingOps(p, new URL(`http://do/owedwork${query}`)).owedwork();
const ledgerWith = (workers) => {
  const s = storage();
  const ctx = { storage: s };
  core.recordOf(ctx).migrate();
  const p = plane.pendingOf(ctx, { now: () => 1_000_000, workers });
  p.migrate();
  return p;
};
/* a reading read in two steps: the first moves the cursor, the second ends it */
const twoSteps = () => {
  let n = 0;
  return { reading: async () => (++n === 1 ? { ok: true, more: true, detail: { cursor: { at: 4 } }, counters: { written: 4 } }
                                           : { ok: true, read: true, counters: { written: 9, skipped: 1 } }) };
};

test("store-services R74: owedwork on a digest lists its finished reading row with the cursor, last_progress_at and verdict jobrow answers", async () => {
  const p = ledgerWith(twoSteps());
  assert.equal(p.registerJob({ kind: "reading", sha: SHA2, cursor: { at: 0 }, verdict: VERDICT }).ok, true);
  await p.consumer().tick(1_000_000);
  await p.consumer().tick(1_000_001);
  const row = p.jobRow({ sha: SHA2, kind: "reading" });
  assert.equal(row.state, "finished");
  const a = await owedwork(p, `?sha=${SHA2}`);
  assert.equal(a.ok, true);
  assert.equal(a.owed.length, 1, "the finished row is listed");
  const e = a.owed[0];
  assert.equal(e.job_state, "finished");
  assert.deepEqual(e.cursor, row.cursor);
  assert.deepEqual(e.cursor, { at: 4 });
  assert.equal(e.last_progress_at, row.last_progress_at);
  assert.equal(typeof e.last_progress_at, "number");
  assert.deepEqual(e.verdict, row.verdict);
  assert.deepEqual(e.verdict, VERDICT);
  assert.equal(e.next_try, null, "a finished row has no next try");
  assert.equal(e.written, row.written);
});

test("store-services R74: a row still being read is listed with its cursor and verdict as they stand", async () => {
  const p = ledgerWith(twoSteps());
  p.registerJob({ kind: "reading", sha: SHA2, cursor: { at: 0 }, verdict: VERDICT });
  await p.consumer().tick(1_000_000);
  const [e] = (await owedwork(p, `?sha=${SHA2}`)).owed;
  assert.equal(e.job_state, "partial");
  assert.equal(e.state, "owed");
  assert.deepEqual(e.cursor, { at: 4 });
  assert.deepEqual(e.verdict, VERDICT);
  assert.equal(typeof e.next_try, "number");
});

test("store-services R74: a refused row is listed with the verdict that refused it", async () => {
  const p = ledgerWith({});
  const refused = { ok: false, size: 30, limit: 20, bound_key: "pdf.request_bytes" };
  assert.equal(p.registerJob({ kind: "ocr", sha: SHA2, verdict: refused }).state, "refused");
  const [e] = (await owedwork(p, `?sha=${SHA2}`)).owed;
  assert.equal(e.job_state, "refused");
  assert.deepEqual(e.verdict, refused);
  assert.deepEqual(e.verdict, p.jobRow({ sha: SHA2, kind: "ocr" })?.verdict);
});

test("store-services R74: a row with no cursor, verdict or progress lists each as null (bound: never absent, never invented)", async () => {
  const p = ledgerWith({});
  assert.equal(p.registerJob({ kind: "reading", sha: SHA2 }).ok, true);
  const [e] = (await owedwork(p, `?sha=${SHA2}`)).owed;
  assert.equal(e.cursor, null);
  assert.equal(e.verdict, null);
  assert.equal(e.last_progress_at, null);
});

test("store-services R64 (control): the counts with no digest, and list() as its other callers call it, still leave a finished row out", async () => {
  const p = ledgerWith(twoSteps());
  p.registerJob({ kind: "reading", sha: SHA2, cursor: { at: 0 } });
  await p.consumer().tick(1_000_000);
  await p.consumer().tick(1_000_001);
  assert.deepEqual(p.list({ sha: SHA2 }), [], "list() alone lists no finished row");
  assert.equal(p.list({ sha: SHA2, finished: true }).length, 1);
  assert.equal(p.list().length, 0);
  assert.equal(p.list({ finished: true }).length, 1);
  assert.deepEqual((await owedwork(p, "")).owed, {}, "the counts count nothing finished");
});

test("store-services R64: owedwork refuses a key that is neither a digest nor a session a row holds, and finds a finished fetch row by its session", async () => {
  const p = ledgerWith({ fetch: async () => ({ ok: true, done: true }) });
  assert.deepEqual(await owedwork(p, "?sha=not-a-digest"), { ok: false, reason: "BAD_SHA" });
  assert.equal(p.registerJob({ kind: "fetch", session: "session-1" }).ok, true);
  await p.consumer().tick(1_000_000);
  assert.equal(p.jobRow({ sha: "session-1", kind: "fetch" })?.state, "finished");
  const a = await owedwork(p, "?sha=session-1");
  assert.equal(a.ok, true);
  assert.equal(a.owed.length, 1);
  assert.equal(a.owed[0].kind, "fetch");
  assert.equal(a.owed[0].job_state, "finished");
});
