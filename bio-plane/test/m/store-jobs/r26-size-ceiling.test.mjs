/* store-jobs R26 (T53; K5715; capture R119): THE JOB TABLE'S SIZE-CEILING TEST USES AN INPUT OF A KIND THAT ALLOWS THE SIZE. Over the assembled store on
   the suite's storage (store-assembly's `alarmed-store.mjs`), every module real: a 200 MiB archive (`.zip`) begins its parted upload through capture's
   own bound and its jobs register in the table through the composition's one registrar (R16): the archive's `unpack` row by its digest and, its members
   being owed work (R24), a `member` row by the member's session. The same bytes named as a document (`.pdf`) are refused TOO_LARGE by capture R119 before
   any job is registered: that refusal is the right answer, not a failure of the ledger. */
import "../../../src/store-assembly/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { store } from "../store-assembly/alarmed-store.mjs";
import { bucketStandIn } from "../case-carriage/fixture.mjs";
import { captureOf } from "../../../src/capture/index.mjs";

const sha = (b) => createHash("sha256").update(b).digest("hex");
const BIG = 200 * 1048576;
const world = async () => {
  const opened = [];
  const bucket = bucketStandIn();
  bucket.createMultipartUpload = async (key) => { opened.push(key); return { uploadId: "u-1", key }; };
  bucket.resumeMultipartUpload = (key, id) => ({ key, uploadId: id, uploadPart: async () => ({}), complete: async () => ({}), abort: async () => {} });
  const x = await store({ env: { CAPTURES: bucket } });
  x.opened = opened;
  return x;
};
const rowsOf = (x, key) => [...x.ctx.storage.sql.exec(`SELECT kind, state FROM keeps_pending WHERE sha = ? ORDER BY kind`, key)].map((r) => [r.kind, r.state]);

test("R26: a 200 MiB `.zip` begins its parted upload through capture's bound and registers its jobs (`unpack` by digest, `member` by the member's session) in the job table", async () => {
  const x = await world();
  const d = sha("a 200 MiB archive");
  const r = await x.call("/captureuploadbegin?by=member:ann", { sha256: d, bytes: BIG, statement: "handed to me", name: "big.zip", type: "application/zip" });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.ok(r.parts >= 2, `in parts: ${r.parts}`);
  assert.deepEqual(x.opened, [`bio/captures/${d}`]);
  const reg = captureOf(x.ctx).registerJob;
  const session = `${d}!0`;
  assert.deepEqual(reg({ kind: "unpack", sha: d }), { ok: true, existed: false, state: "queued" }, "the archive's unpack");
  assert.deepEqual(reg({ kind: "member", session, detail: { container: d, container_kind: "archive", index: 0, project: null, within: 0 } }),
                   { ok: true, existed: false, state: "queued" }, "its first member");
  assert.deepEqual(rowsOf(x, d), [["unpack", "queued"]]);
  assert.deepEqual(rowsOf(x, session), [["member", "queued"]]);
});

test("R26 control: the same 200 MiB named `.pdf` is refused TOO_LARGE by capture R119, opens no upload and registers no job", async () => {
  const x = await world();
  const d = sha("a 200 MiB archive");
  const p = await x.call("/captureuploadbegin?by=member:ann", { sha256: d, bytes: BIG, statement: "handed to me", name: "big.pdf", type: "application/pdf" });
  assert.equal(p.ok, false);
  assert.equal(p.reason, "TOO_LARGE", JSON.stringify(p).slice(0, 300));
  assert.deepEqual(x.opened, [], "no upload opened");
  assert.deepEqual([...x.ctx.storage.sql.exec(`SELECT kind FROM keeps_pending`)], [], "no job registered");
});
