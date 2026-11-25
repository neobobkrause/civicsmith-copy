/* extraction R102, R105 (fix round 9, G126a, G126b, G126j; K4835 (2), K4811 (2); plan 2c item 1; BOB's K4898): owed reading work is registered through
   the registrar. A reading that leaves OCR pages registers `{kind: "ocr", sha, cursor, pages_left}` before it answers, once, only while pages remain;
   a refusal is reported, never swallowed; the start-up repair re-registers the old shapes. The registrar is test-support's `jobRegistrarStub` (plan 2c
   item 1), reached both ways K4898 rules: handed in the ledger's call (`readHeld({registerJob, armJobs})`) and through the `registerOwe` hook. Through
   the module's real entries (`read`, `readHeld`, `migrateRepairs`). Each test names the requirement ids it checks. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fresh, bundle, bucket, hold, member, withEntry, i2, noText, ocrAnswer, doc, homesOver } from "./fixture.mjs";
// fixtures-contract: store-assembly job-registrar
import { jobRegistrarStub } from "../../job-registrar-stub.mjs";

const pdf = (text) => ({ format: "pdf", structure: async () => ({ ok: true, text: structuredClone(text), pages: (text.pages || []).length, notes: [] }) });
const register = (rows) => homesOver(rows);
const SCAN = (n) => i2(Array.from({ length: n }, (_, p) => ({ page: p, text: "", undetermined: [noText(p)] })));
const TEXTPDF = (n) => i2(Array.from({ length: n }, (_, p) => ({ page: p, text: `words of page ${p}` })));
const perPage = (log) => member((b) => { log.push(b.pages.length); const [first, ...rest] = b.pages; return { ...ocrAnswer([first]), deferred: rest }; });

/* a store whose register names INFO-1 the home of a PDF held whole, with no reading yet */
async function held({ env = {} } = {}) {
  const rows = new Map(), evidence = bucket();
  const w = fresh({ evidence, env, provenance: register(rows) });
  bundle(w.s, "INFO-1");
  const bytes = new TextEncoder().encode("%PDF-1.7 a scan " + Math.random());
  const d = await hold(evidence, bytes);
  rows.set(d, { bundleId: "INFO-1", path: "a.pdf", encoding: "binary", bytes: bytes.length, registered: "t", authored: false });
  const document = doc({ digest: d, bytes: bytes.length, ct: "application/pdf", format: "pdf" });
  w.core.readFile = (b, p) => (b === "INFO-1" && p === "data/provenance.json" ? { text: JSON.stringify({ documents: [document] }) } : null);
  return { w, d, document };
}
/* the hook way: every call recorded */
const hooked = (stub) => { const calls = []; return { calls, fn: (e) => { calls.push(structuredClone(e)); return stub.registerJob(e); } }; };

test("R102 R103 (G126a, G126b): `read` of a 30-page scan for a member's request makes no OCR call and registers one `ocr` job, `{kind, sha, cursor, pages_left}`, before it answers (the hook way)", async () => {
  const log = [];
  const { w, d, document } = await held({ env: { OCR_WORKER: perPage(log) } });
  const stub = jobRegistrarStub(), h = hooked(stub);
  w.x.registerOwe(h.fn);
  const out = await withEntry(pdf(SCAN(30)), () => w.x.read(document, { env: w.env }));
  assert.equal(log.length, 0, "no OCR call inside the request");
  assert.deepEqual(h.calls, [{ kind: "ocr", sha: d, cursor: 0, pages_left: 30 }], "owed once, with the pages left");
  assert.deepEqual(stub.rows().map((r) => [r.kind, r.sha, r.state]), [["ocr", d, "queued"]], "one job row");
  assert.deepEqual(out.owed, { kind: "ocr", pages_left: 30, registered: true, existed: false });
});

test("R102 (G126a): the ledger's `readHeld` hands `registerJob` in its call: the row is written with the reading and armed after; a second tick that leaves pages re-registers the one row (the call way)", async () => {
  const log = [];
  const { w, d } = await held({ env: { OCR_WORKER: perPage(log) } });
  const stub = jobRegistrarStub();
  const first = await withEntry(pdf(SCAN(30)), () => w.x.readHeld({ sha: d, env: w.env, registerJob: stub.registerJob, armJobs: stub.armJobs }));
  assert.deepEqual([first.read, first.owed], [true, true], JSON.stringify(first));
  assert.equal(log.length, 24, "a ledger tick may call the OCR member, one page a call, within its budget");
  assert.deepEqual(stub.rows().map((r) => [r.kind, r.sha, r.cursor]), [["ocr", d, 24]], "the pages past the call budget are owed from the first of them");
  assert.equal(stub.armed(), true, "armed after the commit");
  assert.deepEqual(first.registration, { kind: "ocr", pages_left: 6, registered: true, existed: false });
});

test("R102 (control): a read that leaves nothing owed registers nothing: a PDF with a text layer on every page, both ways", async () => {
  const { w, d, document } = await held({ env: { OCR_WORKER: perPage([]) } });
  const stub = jobRegistrarStub(), h = hooked(stub);
  w.x.registerOwe(h.fn);
  const out = await withEntry(pdf(TEXTPDF(5)), () => w.x.read(document, { env: w.env }));
  assert.equal(out.owed, undefined);
  const r = await withEntry(pdf(TEXTPDF(5)), () => w.x.readHeld({ sha: d, env: w.env, registerJob: stub.registerJob, armJobs: stub.armJobs }));
  assert.deepEqual([r.read, r.owed, r.registration], [true, undefined, undefined]);
  assert.deepEqual([h.calls.length, stub.rows().length, stub.armed()], [0, 0, false]);
});

test("R102 (G126c's rule for this module): a registrar answering `{ok: false}` is reported in the answer with its reason, and with none handed in the answer says so; the reading stands either way", async () => {
  const { w, d, document } = await held({ env: { OCR_WORKER: perPage([]) } });
  const none = await withEntry(pdf(SCAN(3)), () => w.x.read(document, { env: w.env }));
  assert.deepEqual(none.owed, { kind: "ocr", pages_left: 3, registered: false, reason: "NO_REGISTRAR" });
  // fixtures-contract: store-assembly job-registrar
  const refuses = { registerJob: () => ({ ok: false, reason: "JOB_NOT_KEPT" }), armJobs: async () => {} };
  const r = await withEntry(pdf(SCAN(30)), () => w.x.readHeld({ sha: d, ...refuses }));
  assert.deepEqual([r.read, r.owed], [true, true]);
  assert.deepEqual(r.registration, { kind: "ocr", pages_left: 6, registered: false, reason: "JOB_NOT_KEPT" });
  assert.equal(w.x.readingFor(d, "class:admin").found, true);
  const throws = await held({ env: { OCR_WORKER: perPage([]) } });
  const t = await withEntry(pdf(SCAN(30)), () => throws.w.x.readHeld({ sha: throws.d, registerJob: () => { throw new Error("stub broken"); } }));
  assert.deepEqual([t.registration.registered, t.registration.reason], [false, "stub broken"]);
});

test("R102 (G126j): `owe` has no production-unreachable path: neither this module nor reading-pipeline writes an `owe` option (the hook only tests called is retired)", () => {
  const src = new URL("../../../src/", import.meta.url).pathname;
  const scanned = ["extraction", "reading-pipeline"];
  const hits = [];
  const walk = (dir) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (n === "node_modules") continue;
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.m?js$/.test(n) && /(^|[^\w.#])owe\s*:/.test(readFileSync(p, "utf8"))) hits.push(p.slice(src.length));
    }
  };
  for (const m of scanned) walk(join(src, m));
  assert.deepEqual(hits, [], "no `owe:` option written in product code");
});

test("R105 (a), (c) (G126a, G133a): the start-up repair registers each stored reading that holds `ocr_left` or `tier3_candidate` as an `ocr` job and each ODS stated too large as a `reading` job, counted; a second run changes nothing; a refusing registrar stops it where it was", async () => {
  const { w, d } = await held();
  const scan = "a".repeat(64), candidate = "b".repeat(64), ods = "c".repeat(64), plain = "e".repeat(64);
  const write = (sha, reading, profileFormat = null) => w.x.writeReading({ bundleId: "INFO-1", captureSha: sha, reading, profileFormat, composed: true });
  write(scan, { found: true, entities: [], text_source: null, page_count: 30, tier3_candidate: true, ocr_left: { cursor: 24, pages: 6 } });
  write(candidate, { found: false, entities: [], text_source: null, page_count: 4, tier3_candidate: true },);
  write(ods, { found: false, entities: [], failure: "final", text_container: "ods", too_large: { bytes: 2e6, key: "cells", key_bytes: 1.9e6, limit: 1048576 } }, "ods");
  write(plain, { found: true, entities: [], text_source: null });
  let down = true;
  const stub = jobRegistrarStub(), calls = [];
  w.x.registerOwe((e) => { calls.push(e); return down && e.sha === candidate ? { ok: false, reason: "PENDING_NOT_KEPT" } : stub.registerJob(e); });
  const stopped = await w.x.migrateRepairs();
  assert.equal(stopped.done, false, "a refusal stops it");
  assert.equal(stopped.r105.refused, "PENDING_NOT_KEPT");
  down = false;
  const made = await w.x.migrateRepairs();
  assert.equal(made.done, true, JSON.stringify(made));
  const rows = stub.rows().map((r) => [r.kind, r.sha, r.cursor]).sort((x, y) => (x[1] < y[1] ? -1 : 1));
  assert.deepEqual(rows, [["ocr", scan, 24], ["ocr", candidate, 0], ["reading", ods, null]]);
  assert.deepEqual(calls.filter((c) => c.sha === candidate).at(-1), { kind: "ocr", sha: candidate, cursor: 0, pages_left: 4 }, "a candidate with no `ocr_left` owes the pages its units leave unread");
  assert.equal(calls.some((c) => c.sha === plain || c.sha === d), false, "a reading that owes nothing is left");
  const n = calls.length;
  const again = await w.x.migrateRepairs();
  assert.deepEqual([again.done, again.examined, calls.length], [true, 0, n], "a second run changes nothing");
});

test("R105 (c) (G133a): `readHeld` reads a stored ODS reading stated too large again, once; a second call changes nothing", async () => {
  const { w, d } = await held();
  w.x.writeReading({ bundleId: "INFO-1", captureSha: d, profileFormat: "ods", composed: true,
    reading: { found: false, entities: [], failure: "final", text_container: "ods", too_large: { bytes: 2e6, key: "cells", key_bytes: 1.9e6, limit: 1048576 } } });
  const r = await withEntry(pdf(i2([{ page: 0, text: "the workbook's words" }])), () => w.x.readHeld({ sha: d, kind: "reading" }));
  assert.deepEqual([r.ok, r.read], [true, true], JSON.stringify(r));
  assert.equal(w.x.readingFor(d, "class:admin").reading.too_large, undefined, "the statement is replaced by the new reading");
  const again = await withEntry(pdf(i2([{ page: 0, text: "the workbook's words" }])), () => w.x.readHeld({ sha: d, kind: "reading" }));
  assert.deepEqual([again.read, again.why], [false, "READING_HELD"]);
});
