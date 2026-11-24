/* control-plane R123 (fix round 4b, F1, F2, F6; K4487; D3; plane R77, extraction R80, store-door R18): A READING FOLLOWS EVERY ENTRY INTO THE RECORD.
   After `op=promote`, `op=captureupload` and `op=inboxpull` the door reads a document the record stores with no reading: inline when it fits the
   bound (the store-internal `readheldfor`, extraction's `readHeld`), else it writes the digest down as owed work (the store-internal `pendingadd`,
   kind `reading`), and the answer's `result` carries `reading_pending: true`. Driven through `makeFetch(hooks)` against a recording store; the
   whole path with the real plane is `t51-reading-follows.test.mjs`. Controls throughout (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { M, world, call, defaultHooks, opCalls, sha } from "./harness.mjs";

const MB = 1024 * 1024;
const SHA = "d".repeat(64), SHA2 = "e".repeat(64);
const ok = (result) => new Response(JSON.stringify({ ok: true, result }), { status: 200, headers: { "content-type": "application/json" } });
const asked = (env, route) => opCalls(env).filter((c) => c.route === route);
const now = "2026-10-22T00:00:00Z";

const bundleMd = (id) => ["---", `id: ${id}`, "object_type: information", "schema: information@2", 'title: "t"', "current_state: collected", "prior_state: null",
  `created: ${now}`, `last_updated: ${now}`, "produced_by:", "  mode: assisted", "  capability_tier: session", "references: []", "state_history: []",
  "annotations_open: 0", "reeval_pending:", "  flag: false", "  since: null", "  source: null", "visuals: []", "criticality: supporting",
  "source_status: unchanged", "---", "", "## Summary", "", "t", ""].join("\n");
const provDoc = (o = {}) => ({ file: "snapshots/x", locator: o.locator ?? "https://example.org/x", profile: o.pdf ? { format: { format: "pdf" } } : {},
  capture: { sha256: o.sha ?? SHA, bytes: o.bytes ?? 10, ...(o.type ? { content_type: o.type } : {}) },
  ...(o.parts ? { parts: o.parts } : {}), ...(o.reading ? { reading: { found: true }, text_units: [] } : {}) });
const promoteBody = (docs, extra = {}) => {
  const text = bundleMd("INFO-2026-0001-x"), prov = JSON.stringify({ documents: docs });
  return { bundleId: "INFO-2026-0001-x", base: null, snapKey: "k1",
    meta: { object_type: "information", title: "t", current_state: "collected", created: now, last_updated: now },
    files: [{ path: "bundle.md", text, bytes: Buffer.byteLength(text), sha256: sha(text) },
            { path: "data/provenance.json", text: prov, bytes: Buffer.byteLength(prov), sha256: sha(prov) }],
    register: [], ...extra };
};
const promote = (w, body) => call(w.env, { op: "promote", token: w.S.ann, method: "POST", body });
const answering = (held) => (c) => (c.route === "promote" ? ok({ ok: true, bundleId: "INFO-2026-0001-x" })
  : c.route === "readheldfor" ? (typeof held === "function" ? held(c) : held) : c.route === "pendingadd" ? ok({ ok: true }) : null);

/* ---- promote (F1) ---- */

test("R123 (promote, F1): a document promoted with no reading is read at once when it fits the bound: `readHeld` is asked for its digest, once, and the answer is the promotion's as it was (no `reading_pending`, nothing written down)", async () => {
  const w = world({ answer: answering(ok({ ok: true, read: true, bundle_id: "INFO-2026-0001-x", found: true })) });
  const r = await promote(w, promoteBody([provDoc({ bytes: 3 * MB, type: "text/plain" })]));   /* fix round 6, G5: text follows by the ledger above 3 MiB (was 20 MiB) */
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.result.ok, true);
  assert.equal(r.json.result.reading_pending, undefined);
  assert.deepEqual(asked(w.env, "readheldfor").map((c) => [c.params.sha, c.params.store]), [[SHA, "bio"]]);
  assert.equal(asked(w.env, "pendingadd").length, 1, "R130: the row is registered before the read, and held until it is made");
  /* controls: a reading already held ends it; a document that carries its reading is not asked about */
  const held = world({ answer: answering(ok({ ok: true, read: false, why: "READING_HELD" })) });
  const h = await promote(held, promoteBody([provDoc()]));
  assert.equal(h.json.result.reading_pending, undefined);
  assert.equal(asked(held.env, "pendingadd").length, 1, "R130: the row is registered before the read, and held until it is made");
  const read = world({ answer: answering(ok({ ok: true, read: true })) });
  await promote(read, promoteBody([provDoc({ reading: true })]));
  assert.equal(asked(read.env, "readheldfor").length, 0, "a document that carries its reading is left");
});

test("R123 (promote, F1): a 3 MB PDF deferred at its acquire and promoted ten minutes later is written down again at the promotion, once, and the answer says `reading_pending` — not asked inline (a PDF over 2 MB follows by the alarm)", async () => {
  const w = world({ answer: answering(ok({ ok: true, read: false, why: "NO_HOME" })) });
  /* the acquire: deferred, registered once (R120) */
  const acquired = { ok: true, existed: false, document: provDoc({ pdf: true, bytes: 3 * MB, type: "application/pdf" }), reading_pending: true };
  const hooks = { ...defaultHooks(), async gatedOp(ctx) { return ctx.op === "acquire" ? M.json(acquired) : undefined; } };
  const a = await call(w.env, { op: "acquire", token: w.S.ann, method: "POST", hooks, body: { locator: "https://example.org/x.pdf" } });
  assert.equal(a.json.reading_pending, true);
  assert.equal(asked(w.env, "pendingadd").length, 1, "registered at the acquire");
  /* ten minutes on, the member files it */
  const real = Date.now;
  Date.now = () => real() + 10 * 60_000;
  let r;
  try { r = await promote(w, promoteBody([provDoc({ pdf: true, bytes: 3 * MB, type: "application/pdf" })])); } finally { Date.now = real; }
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.result.reading_pending, true, "the screen is told the reading is on its way");
  const adds = asked(w.env, "pendingadd");
  assert.equal(adds.length, 2, "written down again at the promotion, which is what re-arms an entry the alarm had given up on (plane R77)");
  assert.deepEqual([adds[1].params.kind, adds[1].params.sha, adds[1].method], ["reading", SHA, "POST"]);
  assert.equal(asked(w.env, "readheldfor").length, 0, "not read inline: a PDF over 2 MB follows by the alarm");
  /* control: a PDF of exactly 2 MB is read inline */
  const c = world({ answer: answering(ok({ ok: true, read: true })) });
  const small = await promote(c, promoteBody([provDoc({ pdf: true, bytes: 2 * MB })]));
  assert.equal(small.json.result.reading_pending, undefined);
  assert.equal(asked(c.env, "readheldfor").length, 1);
  assert.equal(asked(c.env, "pendingadd").length, 1, "R130: the row is registered before the read, and held until it is made");
});

test("R123 (promote): a reading the store could not make now (no whole object yet, no home, a refusal or a silence of the route) is written down and the answer says `reading_pending`; the promotion stands whatever the route says", async () => {
  // fixtures-generic: UNKNOWN_ROUTE (any refusal of the readHeld route: the promotion stands whatever the route says)
  for (const [label, held] of [["no whole object", ok({ ok: true, read: false, why: "NO_WHOLE_OBJECT" })], ["no home", ok({ ok: true, read: false, why: "NO_HOME" })],
                               ["refused", new Response(JSON.stringify({ ok: false, reason: "UNKNOWN_ROUTE" }), { status: 404 })], ["silent", new Response("x", { status: 500 })]]) {
    const w = world({ answer: answering(() => held.clone()) });
    const r = await promote(w, promoteBody([provDoc({ bytes: 5 })]));
    assert.equal(r.status, 200, `${label}: ${r.text}`);
    assert.equal(r.json.result.ok, true, label);
    assert.equal(r.json.result.bundleId, "INFO-2026-0001-x", `${label}: the promotion's answer is kept`);
    assert.equal(r.json.result.reading_pending, true, label);
    assert.deepEqual(asked(w.env, "pendingadd").map((c) => c.params.sha), [SHA], label);
  }
});

test("R123 (promote): every document of the promotion with no reading is followed, at most as many as a bundle holds; a promotion the store refuses and one with no documents ask nothing", async () => {
  const w = world({ answer: answering(ok({ ok: true, read: true })) });
  await promote(w, promoteBody([provDoc({ sha: SHA }), provDoc({ sha: SHA2, reading: true }), provDoc({ sha: "f".repeat(64) })]));
  assert.deepEqual(asked(w.env, "readheldfor").map((c) => c.params.sha), [SHA, "f".repeat(64)], "the one that carries its reading is left");
  // fixtures-generic: FILE_DIGEST_MISMATCH (any refusal of the promotion asks nothing; the test does not depend on which)
  const refused = world({ answer: (c) => (c.route === "promote" ? ok({ ok: false, reason: "FILE_DIGEST_MISMATCH", status: 400 }) : c.route === "readheldfor" ? ok({ ok: true, read: true }) : null) });
  const f = await promote(refused, promoteBody([provDoc()]));
  assert.equal(asked(refused.env, "readheldfor").length, 0);
  assert.equal(f.json.result.reading_pending, undefined);
  const none = world({ answer: answering(ok({ ok: true, read: true })) });
  const text = bundleMd("INFO-2026-0001-x");
  await promote(none, { ...promoteBody([]), files: [{ path: "bundle.md", text, bytes: Buffer.byteLength(text), sha256: sha(text) }] });
  assert.equal(asked(none.env, "readheldfor").length, 0, "no provenance document, nothing to follow");
  const many = world({ answer: answering(ok({ ok: true, read: true })) });
  await promote(many, promoteBody(Array.from({ length: 40 }, (_, i) => provDoc({ sha: i.toString(16).padStart(64, "0") }))));
  assert.equal(asked(many.env, "readheldfor").length, 16, "bounded by the door");
});

/* ---- captureupload (F2) ---- */

const upload = (w, query = "statement=s&name=n&type=application%2Fpdf") => call(w.env, { op: "captureupload", token: w.S.ann, method: "POST", body: "bytes", params: Object.fromEntries(new URLSearchParams(query)) });
const landed = (document, existed = false) => ({ ok: true, existed, capture: { sha256: SHA, bytes: document.capture.bytes }, receipt: { address: `upload:${SHA}` }, document });
const partsOf = (n) => Array.from({ length: n }, (_, i) => ({ sha256: i.toString(16).padStart(64, "1"), bytes: 8 * MB }));
const uploading = (answer, extra = {}) => (c) => (c.route === "captureupload" ? ok(answer) : c.route === "pendingadd" ? ok({ ok: true })
  : c.route === "readheldfor" ? ok(extra.held ?? { ok: true, read: false, why: "NO_HOME" }) : c.route === "extractread" ? ok({ reading: { found: true }, text_units: [{ text: "x" }] }) : null);

test("R123 (captureupload, F2; fix round 5, E3): a 22 MiB upload kept in three parts is not read inline (the whole is read by the alarm): its digest is written down, the answer says `reading_pending`, and the document is answered unread, ready to be filed; a 40 MB upload, over the whole-read ceiling, is read inline as the statement it is", async () => {
  const doc = provDoc({ bytes: 22 * MB, parts: partsOf(3) });
  const w = world({ answer: uploading(landed(doc)) });
  const r = await upload(w, "statement=s&name=n&type=text%2Fplain");
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.result.reading_pending, true);
  assert.equal(r.json.result.document.reading, undefined, "unread");
  assert.equal(r.json.result.document.capture.sha256, SHA, "the document is answered as it was");
  assert.equal(asked(w.env, "extractread").length, 0, "no inline read of what cannot be read inline");
  assert.deepEqual(asked(w.env, "pendingadd").map((c) => [c.params.kind, c.params.sha]), [["reading", SHA]]);
  const stated = world({ answer: uploading(landed(provDoc({ bytes: 40 * MB, parts: partsOf(5) }))) });
  const st = await upload(stated, "statement=s&name=n&type=text%2Fplain");
  assert.equal(st.json.result.reading_pending, undefined, "a statement is made at once");
  assert.equal(asked(stated.env, "extractread").length, 1);
  /* a 3 MB PDF upload follows by the alarm as a 3 MB PDF acquire does */
  const pdf = world({ answer: uploading(landed(provDoc({ pdf: true, bytes: 3 * MB }))) });
  const p = await upload(pdf);
  assert.equal(p.json.result.reading_pending, true);
  assert.equal(asked(pdf.env, "extractread").length, 0);
  /* controls (R100): a small upload is read at once and is not pending; a refusal asks nothing */
  const small = world({ answer: uploading(landed(provDoc({ bytes: 9 }))) });
  const s = await upload(small, "statement=s&name=n&type=text%2Fplain");
  assert.equal(s.json.result.reading_pending, undefined);
  assert.deepEqual(s.json.result.document.reading, { found: true });
  assert.equal(asked(small.env, "pendingadd").length, 0);
  // fixtures-generic: EMPTY (any refusal of the upload asks nothing; the test does not depend on which)
  const no = world({ answer: (c) => (c.route === "captureupload" ? ok({ ok: false, reason: "EMPTY", status: 400 }) : null) });
  assert.deepEqual((await upload(no)).json.result, { ok: false, reason: "EMPTY", status: 400 });
  assert.equal(asked(no.env, "pendingadd").length, 0);
});

test("R123 (captureupload): bytes the record already holds (`existed: true`) whose whole is not held yet are written down, and the answer says `reading_pending`; with no home yet a document too large to read inline is written down unread; a held reading and a reading just made ask nothing more", async () => {
  const bare = { ok: true, existed: true, capture: { sha256: SHA, bytes: 9 }, receipt: { address: `upload:${SHA}` } };
  const w = world({ answer: uploading(bare, { held: { ok: true, read: false, why: "NO_WHOLE_OBJECT" } }) });
  const r = await upload(w);
  assert.equal(r.json.result.reading_pending, true);
  assert.equal(asked(w.env, "pendingadd").length, 1);
  const big = world({ answer: uploading(landed(provDoc({ bytes: 22 * MB, parts: partsOf(3) }), true), { held: { ok: true, read: false, why: "NO_HOME" } }) });
  const b = await upload(big, "statement=s&name=n&type=text%2Fplain");
  assert.equal(b.json.result.reading_pending, true);
  assert.equal(b.json.result.document.reading, undefined);
  assert.equal(asked(big.env, "extractread").length, 0);
  assert.equal(asked(big.env, "pendingadd").length, 1);
  for (const held of [{ ok: true, read: false, why: "READING_HELD" }, { ok: true, read: true, bundle_id: "INFO-1" }]) {
    const c = world({ answer: uploading(bare, { held }) });
    const k = await upload(c);
    assert.equal(k.json.result.reading_pending, undefined, JSON.stringify(held));
    assert.equal(asked(c.env, "pendingadd").length, 1, "R130: the row is registered before the read, and held until it is made");
  }
});

/* ---- inboxpull (F6) ---- */

const pull = (w) => call(w.env, { op: "inboxpull", token: w.S.ann, method: "POST", body: { knockId: "KNOCK-1" } });
const pulledAnswer = (o = {}) => ({ ok: true, existed: false, knockId: "KNOCK-1", capture: { sha256: SHA, bytes: o.bytes ?? 9 },
  document: provDoc({ bytes: o.bytes ?? 9, pdf: o.pdf }), bundle: { bundleId: "INFO-2026-0002-doorbell-knock", bundleSha: "b" } });
const pulling = (answer, held) => (c) => (c.route === "inboxpullfile" ? ok(answer) : c.route === "readheldfor" ? ok(held) : c.route === "pendingadd" ? ok({ ok: true }) : null);

test("R123 (inboxpull, F6): a knock brought into the record has its reading made without a press: `readHeld` is asked for the pulled capture, once, and the answer is the pull's as it was; a 3 MB PDF knock is written down for the alarm and the answer says `reading_pending`", async () => {
  const w = world({ answer: pulling(pulledAnswer(), { ok: true, read: true, found: true }) });
  const r = await pull(w);
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(asked(w.env, "readheldfor").map((c) => c.params.sha), [SHA]);
  assert.equal(r.json.result.reading_pending, undefined);
  assert.equal(r.json.result.bundle.bundleId, "INFO-2026-0002-doorbell-knock", "the pull's answer is kept");
  const big = world({ answer: pulling(pulledAnswer({ bytes: 3 * MB, pdf: true }), { ok: true, read: false, why: "NO_HOME" }) });
  const b = await pull(big);
  assert.equal(b.json.result.reading_pending, true);
  assert.equal(asked(big.env, "readheldfor").length, 0);
  assert.deepEqual(asked(big.env, "pendingadd").map((c) => [c.params.kind, c.params.sha]), [["reading", SHA]]);
  /* controls: a reading already held asks nothing more; a refused pull asks none; an answer naming no capture asks none */
  const held = world({ answer: pulling(pulledAnswer(), { ok: true, read: false, why: "READING_HELD" }) });
  assert.equal((await pull(held)).json.result.reading_pending, undefined);
  assert.equal(asked(held.env, "pendingadd").length, 1, "R130: the row is registered before the read, and held until it is made");
  const refused = world({ answer: (c) => (c.route === "inboxpullfile" ? ok({ ok: false, reason: "NO_SUCH_KNOCK", status: 404 }) : c.route === "readheldfor" ? ok({ ok: true, read: true }) : null) });
  await pull(refused);
  assert.equal(asked(refused.env, "readheldfor").length, 0);
  const bare = world({ answer: pulling({ ok: true, knockId: "KNOCK-1" }, { ok: true, read: true }) });
  await pull(bare);
  assert.equal(asked(bare.env, "readheldfor").length, 0);
});

test("R123 (inboxpull): a knock pulled through `op=inboxresolve` at `pulled` is followed as the pull is; the other statuses are not", async () => {
  const w = world({ answer: (c) => (c.route === "inboxpullfile" ? ok(pulledAnswer()) : c.route === "readheldfor" ? ok({ ok: true, read: true }) : c.route === "inboxresolve" ? ok({ ok: true }) : null) });
  await call(w.env, { op: "inboxresolve", token: w.S.ann, method: "POST", body: { knockId: "KNOCK-1", status: "pulled", reason: "worth keeping" } });
  assert.equal(asked(w.env, "readheldfor").length, 1);
  const d = world({ answer: (c) => (c.route === "inboxresolve" ? ok({ ok: true, capture: { sha256: SHA, bytes: 9 } }) : c.route === "readheldfor" ? ok({ ok: true, read: true }) : null) });
  await call(d.env, { op: "inboxresolve", token: d.S.ann, method: "POST", body: { knockId: "KNOCK-1", status: "discarded", reason: "spam" } });
  assert.equal(asked(d.env, "readheldfor").length, 0);
});
