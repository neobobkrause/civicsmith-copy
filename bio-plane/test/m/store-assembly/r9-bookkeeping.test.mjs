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
