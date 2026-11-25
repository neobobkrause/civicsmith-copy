/* extraction R111 (fix round 10, cause 24 (b), G5; walks A N2, N8, B NEW-2, D8a; K5057): landing a reading's units does not hold the object. A tick that lands
   units gives the turn back between its batches, so a request to the object while a large text is read waits for one batch, not for the tick. Driven through
   the module's real entry (`readHeld` as the plane's ledger calls it, tick after tick) with the real reader over a 7.9 MB text; the waiting request is a
   macrotask pump on the same thread, its gaps timed by the test's clock (the figure the platform measure takes with `whoami`: R111's 95th percentile under
   100 ms and longest under 250 ms). The plane's L harness (`r10-land-yields.test.mjs`, plane's job) is the workerd form of this case; the units landed and
   the reading are the same as without the yields. Each test names the requirement ids it checks. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { LAND_BATCH_UNITS } from "../../../src/extraction/index.mjs";
import { fresh, bundle, bucket, doc, sha, homesOver } from "./fixture.mjs";

const register = (rows) => homesOver(rows);
async function home(bytes) {
  const rows = new Map(), evidence = bucket();
  const w = fresh({ evidence, provenance: register(rows) });
  bundle(w.s, "INFO-1");
  const d = sha(bytes);
  rows.set(d, { bundleId: "INFO-1", path: "f", encoding: "binary", bytes: bytes.length, registered: "t", authored: false });
  await evidence.put(`bio/captures/${d}`, bytes);
  const document = doc({ digest: d, bytes: bytes.length, ct: "text/plain", format: "undetermined", fromText: true });
  w.core.readFile = (b, p) => (b === "INFO-1" && p === "data/provenance.json" ? { text: JSON.stringify({ documents: [document] }) } : null);
  return { w, d };
}
const lines = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const textOf = (n) => lines(n, (i) => `line ${String(i).padStart(6, "0")} ${"council-minutes ".repeat(5)}`.padEnd(99, ".")).concat(["ENDMARKER"]).join("\n");

const fts = (w, term) => w.rows(`SELECT rowid FROM capture_text_fts WHERE capture_text_fts MATCH ?`, `"${term}"`).length;

test("R111 R22 R99 (fix round 10, cause 24 (b)): a 7.9 MB text read tick by tick leaves the thread to a waiting request between batches (95th percentile of the waits under 100 ms, longest under 250 ms), and lands every unit once, its last line found", { timeout: 300_000 }, async () => {
  const bytes = new TextEncoder().encode(textOf(79_000));
  assert.ok(bytes.length > 7.8e6 && bytes.length < 8e6);
  const { w, d } = await home(bytes);
  const gaps = [];
  let last = performance.now(), stop = false, rowAt = 0, widest = 0;
  /* the pump is the waiting request: at each of its turns it reads how far the index has grown since its last turn (the rows landed in one stretch) */
  const pump = () => {
    if (stop) return;
    const t = performance.now(); gaps.push(t - last); last = t;
    const now = (w.one(`SELECT max(rowid) AS m FROM capture_text`) || {}).m || 0;
    widest = Math.max(widest, now - rowAt); rowAt = now;
    setImmediate(pump);
  };
  setImmediate(pump);
  let a, n = 0;
  do { a = await w.x.readHeld({ sha: d, kind: "reading", storeName: "bio", env: {} }); } while (a.more && ++n < 60);
  stop = true;
  assert.equal(a.read, true, JSON.stringify(a));
  gaps.sort((x, y) => x - y);
  const p95 = gaps[Math.floor(gaps.length * 0.95)], longest = gaps[gaps.length - 1];
  assert.ok(widest <= LAND_BATCH_UNITS, `${widest} rows landed between two turns of a waiting request (one batch is ${LAND_BATCH_UNITS})`);
  assert.ok(p95 < 100, `95th percentile wait ${Math.round(p95)} ms (longest ${Math.round(longest)} ms; the platform bound is 250)`);
  assert.equal(fts(w, "ENDMARKER"), 1, "the last line is in the index");
  const c = w.one(`SELECT count(*) n, count(DISTINCT seq) s FROM capture_text WHERE capture_sha=?`, d);
  assert.equal(c.n, c.s, "each unit once");
  assert.equal(w.x.unitsOf(d).state, "whole");
});

test("R111 R99 (control): a reading under one batch lands in one batch, and a landing outside a tick (`indexUnits`) lands the same units as the yielding one", async () => {
  const { w, d } = await home(new TextEncoder().encode(textOf(50)));
  const a = await w.x.readHeld({ sha: d, kind: "reading", storeName: "bio", env: {} });
  assert.equal(a.read, true);
  assert.equal(w.one(`SELECT count(*) n FROM job_batches WHERE sha=? AND kind='reading'`, d).n, 1);
  const units = Array.from({ length: 700 }, (_, i) => ({ extent: { kind: "pdf-page", page: i, rect: null }, text: `unit ${i} words`, seq: i }));
  const sync = w.x.indexUnits("INFO-1", "a".repeat(64), units, null);
  const yielding = await w.x.indexUnitsYielding("INFO-1", "b".repeat(64), units, null);
  assert.deepEqual([sync.written, sync.batches.landed], [700, 3]);
  assert.deepEqual([yielding.written, yielding.batches.landed], [sync.written, sync.batches.landed]);
});
