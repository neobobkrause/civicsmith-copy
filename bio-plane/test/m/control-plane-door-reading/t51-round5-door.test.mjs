// Copied from control-plane's suite (test/m/control-plane/t51-round5-door.test.mjs) when control-plane-door-reading took R117, R123 and R125 by copy (5 Nov 2026); its alpha figures (a 24 MiB PDF ceiling, 40 MB over the text ceiling) read READ_BOUNDS now (R132; N1267's 100 MiB).
/* control-plane R123, R125 (fix round 5, E2, E3, E6, E10 (i); K4530): THE DOOR'S PART OF THE ROUND, driven through `makeFetch(hooks)` against a recording
   store. The whole paths with the real plane and the merged providers are `t51-reading-follows.test.mjs` and `t51-round5-seam.test.mjs`.
     E3  a capture over the whole-read ceiling (24 MiB) is read as the statement it is, never deferred; 20 MiB to 24 MiB follows by the alarm;
     E2  a held document (an `existed` acquire, an `existed` upload) whose reading will not fit is owed, not read inside the request; "Read it" on a
         whole that will not fit is asked of the owner with `defer=1` and the entry written down on its `READING_PENDING`;
     E6  pages a scan left unread are owed to the OCR pass (a promotion reading it inline, a promotion carrying a reading that left pages); the OCR
         press hands the pages to the ledger and answers at once;
     E10 (i) the object's own time is told beside the door's. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { M, world, call, defaultHooks, opCalls, sha } from "../control-plane/harness.mjs";
import { boundOf } from "../../../src/read-bounds.mjs";

const MB = 1024 * 1024;
const PDF_CEIL = boundOf("pdf", "bytes"), TEXT_CEIL = boundOf("text", "bytes");
/* parts of at most 8 MiB summing to `size` */
const partsTo = (size) => { const n = Math.ceil(size / (8 * MB)); return Array.from({ length: n }, (_, i) => ({ sha256: i.toString(16).padStart(64, "1"), bytes: i < n - 1 ? 8 * MB : size - 8 * MB * (n - 1) })); };
const SHA = "d".repeat(64);
const ok = (result) => new Response(JSON.stringify({ ok: true, result }), { status: 200, headers: { "content-type": "application/json" } });
const asked = (env, route) => opCalls(env).filter((c) => c.route === route);
const now = "2026-10-22T00:00:00Z";
const docOf = (o = {}) => ({ file: "snapshots/x", locator: o.locator ?? "https://example.org/x", profile: o.pdf ? { format: { format: "pdf" } } : {},
  capture: { sha256: o.sha ?? SHA, bytes: o.bytes ?? 10, ...(o.type ? { content_type: o.type } : {}) }, ...(o.parts ? { parts: o.parts } : {}),
  ...(o.reading ? { reading: o.reading, text_units: [] } : {}) });
const partsOf = (n, each = 8 * MB) => Array.from({ length: n }, (_, i) => ({ sha256: i.toString(16).padStart(64, "1"), bytes: each }));

const hooksFor = (acquired) => ({ ...defaultHooks(), async gatedOp(ctx) {
  if (ctx.op !== "acquire") return undefined;
  return M.json(typeof acquired === "function" ? acquired(ctx) : acquired);
} });
const acquire = (w, acquired) => call(w.env, { op: "acquire", token: w.S.ann, method: "POST", hooks: hooksFor(acquired), body: { locator: "https://example.org/x.pdf" } });
const answering = (extra = {}) => (c) => (c.route === "pendingadd" ? ok({ ok: true }) : c.route === "readheldfor" ? ok(extra.held ?? { ok: true, read: true }) : null);

test("R123 E3: a capture over the whole-read ceiling is never deferred (its reading is a statement of its size); below it a large one follows by the alarm; the ceiling itself is a reading", async () => {
  const seen = [];
  const hooks = { ...defaultHooks(), async gatedOp(ctx) {
    if (ctx.op !== "acquire") return undefined;
    const rows = [["a PDF over its ceiling, in parts", docOf({ pdf: true, bytes: PDF_CEIL + MB, type: "application/pdf", parts: partsTo(PDF_CEIL + MB) })],
                  ["a text over its ceiling, in parts", docOf({ bytes: TEXT_CEIL + MB, parts: partsTo(TEXT_CEIL + MB) })],
                  ["22 MiB PDF", docOf({ pdf: true, bytes: 22 * MB, type: "application/pdf" })],
                  ["the PDF ceiling exactly", docOf({ pdf: true, bytes: PDF_CEIL, type: "application/pdf" })],
                  ["the PDF ceiling + 1", docOf({ pdf: true, bytes: PDF_CEIL + 1, type: "application/pdf" })],
                  ["22 MiB text", docOf({ bytes: 22 * MB })]];
    for (const [label, d] of rows) seen.push([label, await ctx.deferReading(d)]);
    return M.json({ ok: true, document: docOf() });
  } };
  const w = world();
  await call(w.env, { op: "acquire", token: w.S.ann, method: "POST", hooks, body: { locator: "https://example.org/x" } });
  assert.deepEqual(seen, [["a PDF over its ceiling, in parts", false], ["a text over its ceiling, in parts", false], ["22 MiB PDF", true], ["the PDF ceiling exactly", true],
                          ["the PDF ceiling + 1", false], ["22 MiB text", true]]);
});

test("R123 E3 (promote): a five-part document over the text ceiling promoted with no reading is asked of `readHeld` at once, not written down first", async () => {
  const w = world({ answer: (c) => (c.route === "promote" ? ok({ ok: true, bundleId: "INFO-2026-0001-x" }) : answering()(c)) });
  const text = ["---", "id: INFO-2026-0001-x", "object_type: information", "---", ""].join("\n");
  const prov = JSON.stringify({ documents: [docOf({ bytes: TEXT_CEIL + 1, parts: partsTo(TEXT_CEIL + 1) })] });
  const r = await call(w.env, { op: "promote", token: w.S.ann, method: "POST", body: { bundleId: "INFO-2026-0001-x", base: null, snapKey: "k", meta: { object_type: "information" },
    files: [{ path: "bundle.md", text, bytes: Buffer.byteLength(text), sha256: sha(text) }, { path: "data/provenance.json", text: prov, bytes: Buffer.byteLength(prov), sha256: sha(prov) }], register: [] } });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(asked(w.env, "readheldfor").map((c) => c.params.sha), [SHA]);
  assert.equal(r.json.result.reading_pending, undefined);
  assert.equal(asked(w.env, "pendingadd").length, 0);
});

test("R123 E3 (captureupload): a five-part upload over the text ceiling is read as its statement at the door (no whole to read from is needed); a 22 MiB PDF upload is owed", async () => {
  const landed = (document) => ({ ok: true, existed: false, capture: { sha256: SHA, bytes: document.capture.bytes }, receipt: { address: `upload:${SHA}` }, document });
  const run = (document) => {
    const w = world({ answer: (c) => (c.route === "captureupload" ? ok(landed(document)) : c.route === "pendingadd" ? ok({ ok: true })
      : c.route === "extractread" ? ok({ reading: { found: false, failure: "final" }, text_units: [] }) : null) });
    return call(w.env, { op: "captureupload", token: w.S.ann, method: "POST", body: "bytes", params: { statement: "s", name: "n", type: "text/plain" } }).then((r) => ({ r, w }));
  };
  const big = await run(docOf({ bytes: TEXT_CEIL + 1, parts: partsTo(TEXT_CEIL + 1) }));
  assert.equal(asked(big.w.env, "extractread").length, 1, "read as its statement");
  assert.equal(big.r.json.result.reading_pending, undefined);
  assert.equal(big.r.json.result.document.reading.failure, "final");
  assert.equal(asked(big.w.env, "pendingadd").length, 0);
  const mid = await run(docOf({ pdf: true, bytes: 22 * MB, type: "application/pdf" }));
  assert.equal(mid.r.json.result.reading_pending, true);
  assert.equal(asked(mid.w.env, "extractread").length, 0);
});

test("R117 E2 (acquire, existed): a second capture of a 16 MB PDF held in parts is not read inside the request: no `readheldfor`, the entry is written down, the answer says `reading_pending`; a 1 MB PDF captured twice is still read inline", async () => {
  const big = world({ answer: answering() });
  const a = await acquire(big, { ok: true, existed: null, document: docOf({ pdf: true, bytes: 16 * MB, type: "application/pdf", parts: partsOf(2) }) });
  assert.equal(a.status, 200, a.text);
  assert.equal(a.json.reading_pending, true);
  assert.equal(asked(big.env, "readheldfor").length, 0);
  assert.deepEqual(asked(big.env, "pendingadd").map((c) => [c.params.kind, c.params.sha]), [["reading", SHA]]);
  assert.match(a.headers.get("server-timing"), /^acquire;dur=\d+/);
  assert.equal(/do-readheldfor/.test(a.headers.get("server-timing")), false, "no readheldfor in Server-Timing");
  const small = world({ answer: answering() });
  const s = await acquire(small, { ok: true, existed: true, document: docOf({ pdf: true, bytes: 1 * MB, type: "application/pdf", reading: { found: true } }) });
  assert.equal(s.json.reading_pending, undefined);
  assert.equal(asked(small.env, "readheldfor").length, 1);
  assert.equal(asked(small.env, "pendingadd").length, 0);
});

test("R117 E2 (captureupload, existed): bytes held that are a 16 MB PDF are owed without a `readheldfor`; a 9-byte upload held is asked", async () => {
  const held = (bytes, pdf) => ({ ok: true, existed: true, capture: { sha256: SHA, bytes }, receipt: { address: `upload:${SHA}` },
    ...(pdf ? { document: docOf({ pdf: true, bytes, type: "application/pdf" }) } : {}) });
  const run = (answer) => { const w = world({ answer: (c) => (c.route === "captureupload" ? ok(answer) : answering()(c)) });
    return call(w.env, { op: "captureupload", token: w.S.ann, method: "POST", body: "b", params: { statement: "s", name: "n" } }).then((r) => ({ r, w })); };
  const big = await run(held(16 * MB, true));
  assert.equal(big.r.json.result.reading_pending, true);
  assert.equal(asked(big.w.env, "readheldfor").length, 0);
  assert.equal(asked(big.w.env, "pendingadd").length, 1);
  const small = await run(held(9, false));
  assert.equal(asked(small.w.env, "readheldfor").length, 1);
  assert.equal(small.r.json.result.reading_pending, undefined);
});

/* ---- E6 ---- */

const promoteWith = (w, docs) => {
  const text = ["---", "id: INFO-2026-0001-x", "object_type: information", "---", ""].join("\n");
  const prov = JSON.stringify({ documents: docs });
  return call(w.env, { op: "promote", token: w.S.ann, method: "POST", body: { bundleId: "INFO-2026-0001-x", base: null, snapKey: "k", meta: { object_type: "information" },
    files: [{ path: "bundle.md", text, bytes: Buffer.byteLength(text), sha256: sha(text) }, { path: "data/provenance.json", text: prov, bytes: Buffer.byteLength(prov), sha256: sha(prov) }], register: [] } });
};
const promoted = (held) => (c) => (c.route === "promote" ? ok({ ok: true, bundleId: "INFO-2026-0001-x" }) : answering({ held })(c));

test("R123 E6: a scan read at `promote` with pages left (`owed`) has its `ocr` entry written down, and the answer says `reading_pending`; with none left, nothing", async () => {
  const w = world({ answer: promoted({ ok: true, read: true, owed: true }) });
  const r = await promoteWith(w, [docOf({ bytes: 1 * MB, pdf: true })]);
  assert.equal(r.json.result.reading_pending, true);
  assert.deepEqual(asked(w.env, "pendingadd").map((c) => [c.params.kind, c.params.sha]), [["reading", SHA], ["ocr", SHA]], "R130: the reading row first, then the pages owed");
  const done = world({ answer: promoted({ ok: true, read: true }) });
  const d = await promoteWith(done, [docOf({ bytes: 1 * MB, pdf: true })]);
  assert.equal(d.json.result.reading_pending, undefined);
  assert.equal(asked(done.env, "pendingadd").length, 1);
});

test("R123 E6: a document promoted with a reading that left pages of a scan unread owes the OCR pass when an OCR member is bound, and only then", async () => {
  const leftover = { found: true, tier3_candidate: true };
  const w = world({ answer: promoted({ ok: true, read: true }) });
  w.env.OCR_WORKER = { fetch: async () => new Response("{}") };
  const r = await promoteWith(w, [docOf({ bytes: 1 * MB, pdf: true, reading: leftover })]);
  assert.equal(r.json.result.reading_pending, true);
  assert.deepEqual(asked(w.env, "pendingadd").map((c) => [c.params.kind, c.params.sha]), [["ocr", SHA]]);
  assert.equal(asked(w.env, "readheldfor").length, 0, "its reading is held; only the pages are owed");
  const unbound = world({ answer: promoted({ ok: true, read: true }) });
  assert.equal((await promoteWith(unbound, [docOf({ bytes: 1 * MB, pdf: true, reading: leftover })])).json.result.reading_pending, undefined);
  const whole = world({ answer: promoted({ ok: true, read: true }) });
  whole.env.OCR_WORKER = { fetch: async () => new Response("{}") };
  await promoteWith(whole, [docOf({ bytes: 1 * MB, pdf: true, reading: { found: true } })]);
  assert.equal(asked(whole.env, "pendingadd").length, 0, "a reading with every page read owes nothing");
});

const press = (w, sha256 = SHA) => call(w.env, { op: "pdfstructure", token: w.S.ann, params: { sha256, ocr: "1" } });
const readingAnswer = (o) => (c) => (c.route === "reading" ? ok(o) : c.route === "pendingadd" ? ok({ ok: true }) : null);

test("R125 E6: the OCR press on a scan with pages left answers at once with the `ocr` entry written down and reads nothing; every other press is the owner's", async () => {
  const w = world({ answer: readingAnswer({ ok: true, found: true, bundle_id: "INFO-2026-0001-x", reading: { found: true, tier3_candidate: true } }) });
  w.env.OCR_WORKER = { fetch: async () => new Response("{}") };
  const r = await press(w);
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.result.ocr_pending, true);
  assert.deepEqual(asked(w.env, "pendingadd").map((c) => [c.params.kind, c.params.sha]), [["ocr", SHA]]);
  assert.equal(asked(w.env, "pdfstructure").length, 0, "no pass inside the request");
  assert.equal(asked(w.env, "reading")[0].params.viewer, "member:ann", "asked as the member");
  for (const [label, answer, bind] of [["no OCR member bound", { ok: true, found: true, bundle_id: "B", reading: { tier3_candidate: true } }, false],
                                       ["a home she may not see", { ok: true, found: true, bundle_id: null, reading: { tier3_candidate: true } }, true],
                                       ["a reading with every page", { ok: true, found: true, bundle_id: "B", reading: { found: true } }, true],
                                       ["no reading", { ok: true, found: false }, true]]) {
    const c = world({ answer: readingAnswer(answer) });
    if (bind) c.env.OCR_WORKER = { fetch: async () => new Response("{}") };
    await press(c);
    assert.equal(asked(c.env, "pendingadd").length, 0, label);
    assert.equal(asked(c.env, "pdfstructure").length, 1, `${label}: the owner's`);
  }
});

/* ---- E2: "Read it" ---- */

const withBucket = (w, size, head5 = "%PDF-") => {
  w.env.CAPTURES = { head: async () => ({ size }), get: async () => ({ arrayBuffer: async () => new TextEncoder().encode(head5).buffer }) };
};
const readIt = (w, extra = {}) => call(w.env, { op: "readheld", token: w.S.ann, method: "POST", body: { sha: SHA }, ...extra });

test("R125 E2: \"Read it\" on a 16 MB PDF whole is asked of the owner with `defer=1`; its `READING_PENDING` writes the entry down and the answer is at once; a small whole, a text whole under 20 MiB and no whole are asked without it", async () => {
  const w = world({ answer: (c) => (c.route === "readheld" ? ok({ ok: true, read: false, why: "READING_PENDING" }) : c.route === "pendingadd" ? ok({ ok: true }) : null) });
  withBucket(w, 16 * MB);
  const r = await readIt(w, { params: { defer: "0" } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.result.reading_pending, true);
  assert.deepEqual(asked(w.env, "readheld").map((c) => c.params.defer), ["1"]);
  assert.deepEqual(asked(w.env, "pendingadd").map((c) => [c.params.kind, c.params.sha]), [["reading", SHA]]);
  for (const [label, setup] of [["a 1 MB PDF", (x) => withBucket(x, 1 * MB)], ["a 3 MiB text", (x) => withBucket(x, 3 * MB, "hello")], ["no whole", (x) => { x.env.CAPTURES = { head: async () => null }; }],
                                ["a whole over the PDF ceiling (a statement)", (x) => withBucket(x, PDF_CEIL + MB)]]) {
    const c = world({ answer: (q) => (q.route === "readheld" ? ok({ ok: true, read: true }) : null) });
    setup(c);
    await readIt(c, { params: { defer: "1" } });
    assert.deepEqual(asked(c.env, "readheld").map((q) => q.params.defer), [undefined], `${label}: a caller's defer is deleted and none is set`);
    assert.equal(asked(c.env, "pendingadd").length, 0, label);
  }
  /* an owner that reads inline (ignores defer) is relayed as it always was */
  const old = world({ answer: (c) => (c.route === "readheld" ? ok({ ok: true, read: true, found: true }) : null) });
  withBucket(old, 16 * MB);
  assert.equal((await readIt(old)).json.result.read, true);
  assert.equal(asked(old.env, "pendingadd").length, 0);
});

/* ---- E10 (i) ---- */

test("R121 E10 (i): the object's own time, stated in its answer's `server-timing: object;dur=`, is told as `in-<route>` beside `do-<route>`; an object that states none adds nothing", async () => {
  const w = world({ answer: (c) => (c.route === "projectlist" ? new Response(JSON.stringify({ ok: true, result: { ok: true } }), { status: 200, headers: { "server-timing": "object;dur=7" } }) : null) });
  const r = await call(w.env, { op: "projectlist", token: w.S.ann });
  const t = r.headers.get("server-timing");
  assert.match(t, /do-projectlist;dur=\d+/);
  assert.match(t, /in-projectlist;dur=7/);
  assert.equal(/in-session/.test(t), false, "the session read stated none");
});
