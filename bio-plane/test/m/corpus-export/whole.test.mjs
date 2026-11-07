/* corpus-export R17-R20 (T53; K5441, K5443; PLATFORM PL50-PL53): the whole-record manifest, read by parts and resumable,
   naming what it does not carry, and a read. Over registers' world (an evidence bucket, real modules) and people's (member
   ties). At the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { registersWorld, V } from "./registers-world.mjs";
import { rich } from "./rich.mjs";
import { inquiryMd } from "./fixture.mjs";
import * as CE from "../../../src/corpus-export/index.mjs";
/* read off the module whole, so a module without them fails each test by its assertions, never at load */
const wholeExportOps = (...a) => CE.wholeExportOps(...a);
const verifyWholePart = (...a) => CE.verifyWholePart(...a);

const bytesOf = (n, seed = 7) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed) & 0xff);
const BOUND = 64;

test("R17: a seeded copy's whole-record manifest lists every held file, inline or in the bucket, with R1's content, its placement and counts; the log row's scope is whole-record", async () => {
  const w = registersWorld({ env: { STORE_JURISDICTION: "eu", STORE_GENERATION: "2" } });
  const sha = await w.storedFile("INQ-2026-0101", bytesOf(300));
  const x = await w.ce.exportWhole({ note: "moving to eu" });
  assert.equal(x.ok, true);
  assert.equal(x.scope, "whole-record");
  /* every file the store holds, live or kept in history, is an entry */
  const held = [...w.sql(`SELECT bundle_id, path, sha256 FROM files`), ...w.sql(`SELECT bundle_id, path, sha256 FROM history`)];
  assert.ok(held.length >= 3, "control: the copy holds files");
  for (const f of held) assert.ok(x.files.some((e) => e.bundle === f.bundle_id && e.path === f.path && e.sha256 === f.sha256), `${f.bundle_id}/${f.path} listed`);
  for (const e of x.files) {
    for (const k of ["path", "sha256", "bytes", "kind", "held"]) assert.ok(k in e, `an entry states ${k}`);
    assert.ok(["inline", "r2"].includes(e.held));
  }
  const blob = x.files.find((e) => e.sha256 === sha);
  assert.deepEqual([blob.held, blob.kind, blob.bytes], ["r2", "capture", 300], "a file held in the bucket is listed with its kind");
  assert.equal(x.files.find((e) => e.bundle === "INQ-2026-0101" && e.path === "bundle.md").held, "inline");
  /* R1's content */
  for (const k of ["bundles", "tables", "register", "not_carried"]) assert.ok(k in x, `R1's ${k}`);
  assert.ok(x.bundles.some((b) => b.bundle_id === "INQ-2026-0101"));
  assert.deepEqual(x.placement, { region: null, jurisdiction: "eu", generation: 2, stated: true });
  assert.equal(x.counts.stored_files, x.files.length);
  assert.equal(x.counts.parts, x.parts.length);
  const log = w.sql(`SELECT scope, note, files FROM export_log ORDER BY seq DESC LIMIT 1`)[0];
  assert.deepEqual([log.scope, log.note, log.files], ["whole-record", "moving to eu", x.files.length]);
  /* control: a copy given no placement says so */
  const bare = registersWorld();
  assert.deepEqual((await bare.ce.exportWhole({})).placement, { region: null, jurisdiction: null, generation: null, stated: false });
});

test("R17: the exportwhole arm answers the whole-record manifest with q(\"note\") passed through", async () => {
  const w = registersWorld();
  const x = await wholeExportOps(w.ce, (k) => (k === "note" ? "via the door" : null)).exportwhole();
  assert.equal(x.scope, "whole-record");
  assert.equal(w.sql(`SELECT note FROM export_log ORDER BY seq DESC LIMIT 1`)[0].note, "via the door");
});

test("R18: a record larger than the part bound lists more than one part, each with index, bytes and digest; a part fetched alone verifies; a lost part is refetched, the others untouched; no more than one part is held", async () => {
  const w = registersWorld({ partBytes: BOUND });
  const big = bytesOf(300);
  const sha = await w.storedFile("INQ-2026-0102", big);
  const x = await w.ce.exportWhole({});
  assert.equal(x.part_bound, BOUND);
  assert.ok(CE.WHOLE_PART_BYTES <= CE.WHOLE_PART_CEILING, "the stated bound is under the plane's per-call memory");
  assert.ok(x.parts.length > 1, "more than one part");
  x.parts.forEach((p, i) => {
    assert.equal(p.index, i);
    assert.ok(p.bytes <= BOUND, "no part above the bound");
    assert.match(p.sha256, /^[0-9a-f]{64}$/);
  });
  const mine = x.parts.filter((p) => p.file === sha);
  assert.equal(mine.length, 5, "300 bytes in parts of 64");
  /* every part fetched alone verifies, and together they are the file */
  const got = new Map();
  for (const p of x.parts) {
    const g = await w.ce.exportWholePart({ file: p.file, offset: p.offset, bytes: p.bytes });
    assert.equal(g.ok, true, JSON.stringify(g).slice(0, 200));
    assert.deepEqual(verifyWholePart({ part: p, bytes: g.bytes }), { ok: true, index: p.index });
    got.set(p.index, g.bytes);
  }
  assert.deepEqual(Buffer.concat(mine.map((p) => got.get(p.index))), Buffer.from(big));
  /* a lost part: its bytes refused, refetched alone; the others are not asked again */
  const lost = mine[2];
  const broken = Uint8Array.from(got.get(lost.index)); broken[0] ^= 1;
  assert.equal(verifyWholePart({ part: lost, bytes: broken }).reason, "PART_HASH_MISMATCH");
  assert.equal(verifyWholePart({ part: lost, bytes: null }).reason, "BYTES_MISSING");
  const calls = w.b.calls.length;
  const again = await w.ce.exportWholePart({ file: lost.file, offset: lost.offset, bytes: lost.bytes });
  assert.equal(verifyWholePart({ part: lost, bytes: again.bytes }).ok, true);
  assert.deepEqual(w.b.calls.slice(calls).map((c) => [c[0], c[2]?.range?.offset]), [["get", lost.offset]], "one ranged read, of that part alone");
  /* memory: at most one part held at any time (the byte ledger) */
  assert.ok(w.ledger.peak() > 0 && w.ledger.peak() <= BOUND, `peak ${w.ledger.peak()}`);
  assert.equal(w.ledger.held(), 0);
  /* refusals */
  assert.equal((await w.ce.exportWholePart({ file: "nope" })).reason, "EXPORT_PART_MALFORMED");
  assert.equal((await w.ce.exportWholePart({ file: sha, offset: "-1" })).reason, "EXPORT_PART_MALFORMED");
  assert.equal((await w.ce.exportWholePart({ file: "0".repeat(64) })).reason, "EXPORT_PART_UNKNOWN");
  /* control: a record within one part each lists one part per file */
  const small = registersWorld();
  const y = await small.ce.exportWhole({});
  assert.equal(y.parts.length, y.files.length);
});

test("R19: the manifest of a copy with member ties names them not_carried, with each withheld class's owner and reason, and says sign-in material is not carried", async () => {
  const w = rich();
  const m = w.ce.exportManifest({});
  const nc = m.not_carried;
  assert.ok(nc.some((t) => t.owner === "people" && t.table === "member_ties" && t.reason === "never"), "member ties named not_carried");
  for (const t of m.tables.filter((e) => e.carried === "named")) assert.ok(nc.some((x) => x.table === t.table && x.reason === "never"), t.table);
  for (const t of m.tables.filter((e) => e.carried === "rule")) assert.ok(nc.some((x) => x.table === t.table && x.reason === "derived"), t.table);
  assert.ok(!nc.some((x) => m.tables.find((t) => t.table === x.table && t.carried === "rows") && x.reason !== "expunged"), "control: no carried table is named withheld");
  assert.equal(typeof m.sign_in, "string");
  assert.ok(m.sign_in.length > 0);
  /* expunged rows are named with their table */
  const r = registersWorld();
  await r.importOnce();
  await r.removeRow(3);
  assert.ok((await r.ce.exportWhole({})).not_carried.some((x) => x.owner === "registers" && x.table === "register_import_rows" && x.reason === "expunged" && x.rows === 1));
});

test("R20: the export is a read: a write while its parts are read does not change the manifest's counts, the instant is stated, and the record is unchanged by it", async () => {
  const w = registersWorld({ partBytes: BOUND });
  await w.storedFile("INQ-2026-0103", bytesOf(300));
  const record = () => JSON.stringify([w.sql(`SELECT * FROM files ORDER BY bundle_id, path`), w.sql(`SELECT * FROM bundles ORDER BY bundle_id`),
                                       w.sql(`SELECT * FROM history ORDER BY bundle_id, snap_key, path`), w.sql(`SELECT * FROM leases`)]);
  const before = record();
  const quiet = await w.ce.exportWhole({});
  assert.equal(record(), before, "the export changes no record and holds no lease");
  const running = w.ce.exportWhole({});
  /* a write while the cut parts are being read */
  const r = w.promotion.promote({ bundleId: "INQ-2026-0104", base: null, snapKey: "late", author: V("bob"),
    files: [{ path: "bundle.md", text: inquiryMd("INQ-2026-0104", "Written during the export?") }], meta: { object_type: "inquiry" } });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const x = await running;
  /* export_log is itself a carried table: each export's own row is the one difference between two exports */
  const bare = (e) => ({ ...e.counts, rows: e.counts.rows - e.tables.find((t) => t.table === "export_log").rows });
  assert.deepEqual(bare(x), bare(quiet), "the counts are the export's instant's");
  assert.ok(!x.bundles.some((b) => b.bundle_id === "INQ-2026-0104"));
  assert.equal(typeof x.taken_at, "string");
  assert.equal(x.taken_at, x.at);
  /* control: the next export sees the write */
  assert.equal((await w.ce.exportWhole({})).counts.bundles, quiet.counts.bundles + 1);
});
