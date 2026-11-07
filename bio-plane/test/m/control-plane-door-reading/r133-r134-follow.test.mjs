// Copied from control-plane's suite (test/m/control-plane/r133-r134-follow.test.mjs) when control-plane-door-reading took this requirement by copy (5 Nov 2026); it proves the requirement at this module's interface.
/* control-plane R133, R134 (fix round 9, G128f, G129e; X15, X20; K4831 (4); amends R123, R58; `acquisition` unpack, `plane` R97): EVERY DOCUMENT A PROMOTION STORES IS FOLLOWED, AND A TRANSIENT STORE
   ERROR NEVER FILES AN ARCHIVE'S MEMBER AWAY FOR GOOD.
   R133: the 17th and the 30th member of an archive promoted together are each followed: their job row is registered (R130) BEFORE any inline read, and only the first
   `READING_FOLLOWED_MAX` (16) are read inline in the request; the rest are owed as rows, none dropped, the answer says `reading_pending`. A promotion of 3 documents follows 3.
   R134: `promoteArchive` (and the door's `op=unpack` over it) names a member whose put or promotion did not answer or threw as `not_promoted` with `transient: true` (it stays owed: the archive's
   `unpack` job is registered and the answer says `unpack_pending`), a member the store answered `ok: false` for without `transient` (it is its own file's refusal and is not retried), and the
   members of a nested archive or a continuation are promoted into the archive's project as the first are.
   Driven through `makeFetch(hooks)` over the harness's recording store (the pattern of `r123-reading.test.mjs` and `archive.test.mjs`); the whole path with the real plane is the seam's §6.

   Red against the tree before round 9's change: R133's rows (the old door registered only the documents it did not read, and read at most 16 and registered none of the 17th on: `pendingadd` was
   called 0 times for a read-inline document and the 17th was only written down when its inline read failed), R134's `transient` flag and `unpack_pending` (the old `not_promoted` carried a
   code alone and a transient failure was `not_filed` for good). The controls (3 documents, a refusal of the file's own bytes) are green before and after. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { M, world, call, opCalls, sha, FORGED, defaultHooks } from "../control-plane/harness.mjs";
import { promoteArchive } from "../../../src/control-plane/archive.mjs";
import { archiveAnswer } from "../acquisition/fixtures.mjs";

const MB = 1024 * 1024;
const ok = (result) => new Response(JSON.stringify({ ok: true, result }), { status: 200, headers: { "content-type": "application/json" } });
const asked = (env, route) => opCalls(env).filter((c) => c.route === route);
const now = "2026-10-22T00:00:00Z";
const shaOf = (i) => i.toString(16).padStart(64, "0");

const bundleMd = (id) => ["---", `id: ${id}`, "object_type: information", "schema: information@2", 'title: "t"', "current_state: collected", "prior_state: null",
  `created: ${now}`, `last_updated: ${now}`, "produced_by:", "  mode: assisted", "  capability_tier: session", "references: []", "state_history: []",
  "annotations_open: 0", "reeval_pending:", "  flag: false", "  since: null", "  source: null", "visuals: []", "criticality: supporting",
  "source_status: unchanged", "---", "", "## Summary", "", "t", ""].join("\n");
const provDoc = (o = {}) => ({ file: "snapshots/x", locator: o.locator ?? "https://example.org/x", profile: o.pdf ? { format: { format: "pdf" } } : {},
  capture: { sha256: o.sha, bytes: o.bytes ?? 10, ...(o.type ? { content_type: o.type } : {}) }, ...(o.reading ? { reading: { found: true }, text_units: [] } : {}) });
const promoteBody = (docs) => {
  const text = bundleMd("INFO-2026-0001-x"), prov = JSON.stringify({ documents: docs });
  return { bundleId: "INFO-2026-0001-x", base: null, snapKey: "k1",
    meta: { object_type: "information", title: "t", current_state: "collected", created: now, last_updated: now },
    files: [{ path: "bundle.md", text, bytes: Buffer.byteLength(text), sha256: sha(text) }, { path: "data/provenance.json", text: prov, bytes: Buffer.byteLength(prov), sha256: sha(prov) }], register: [] };
};
const promote = (w, docs) => call(w.env, { op: "promote", token: w.S.ann, method: "POST", body: promoteBody(docs) });
const many = (n, o = {}) => Array.from({ length: n }, (_, i) => provDoc({ sha: shaOf(i + 1), ...o }));

/* a store that promotes, reads (`readheldfor` answering `held`), and writes rows (`pendingadd`, refusing the digests in `refuseRows`) */
const storeFor = ({ held = { ok: true, read: true }, refuseRows = [] } = {}) => (c) => {
  if (c.route === "promote") return ok({ ok: true, bundleId: "INFO-2026-0001-x" });
  if (c.route === "readheldfor") return ok(typeof held === "function" ? held(c) : held);
  if (c.route === "pendingadd") return ok(refuseRows.includes(c.params.sha) ? { ok: false, reason: "PENDING_NOT_KEPT" } : { ok: true });
  return null;
};

/* ---- R133 ---- */

test("R133 (DOCS A12, G128f): 17 documents promoted together are ALL followed: each has its job row registered before any inline read, the first 16 are read inline and the 17th is owed as a row, none dropped, and the answer says `reading_pending`", async () => {
  const docs = many(17);
  const w = world({ answer: storeFor() });
  const r = await promote(w, docs);
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.result.ok, true, "the promotion's own answer stands");
  const rows = asked(w.env, "pendingadd").map((c) => c.params.sha);
  const read = asked(w.env, "readheldfor").map((c) => c.params.sha);
  const all = docs.map((d) => d.capture.sha256);
  assert.deepEqual(read, all.slice(0, 16), "only the first 16 are read inline, in the order stated");
  assert.deepEqual([...new Set([...rows, ...read])].sort(), [...all].sort(), "every one of the 17 reached a registration or an inline read: none dropped");
  assert.ok(rows.includes(all[16]), "the 17th is registered as a job row");
  assert.deepEqual(rows.slice().sort(), [...all].sort(), "and each is registered once: the row first, whether or not the read follows");
  assert.deepEqual(asked(w.env, "pendingadd").map((c) => c.params.kind), Array(17).fill("reading"));
  const order = opCalls(w.env).map((c) => c.route).filter((x) => x === "pendingadd" || x === "readheldfor");
  assert.equal(order[0], "pendingadd", "R130: the first row is written before the first inline read starts");
  assert.equal(r.json.result.reading_pending, true, "a reading is owed (the 17th), and the row holds it");
});

test("R133 (DOCS A12, G128f): 30 documents promoted together are all followed: 16 read inline, 30 rows, none dropped; each document is asked of the store once for its row and the 14 beyond the inline reads are owed", async () => {
  const docs = many(30);
  const w = world({ answer: storeFor() });
  const r = await promote(w, docs);
  assert.equal(r.status, 200, r.text);
  const all = docs.map((d) => d.capture.sha256);
  const rows = asked(w.env, "pendingadd").map((c) => c.params.sha);
  const read = asked(w.env, "readheldfor").map((c) => c.params.sha);
  assert.deepEqual(read, all.slice(0, 16), "only the first 16 are read inline");
  assert.deepEqual(rows.slice().sort(), [...all].sort(), "30 rows, one for each digest");
  assert.deepEqual(all.filter((s) => !rows.includes(s) && !read.includes(s)), [], "no document of the 30 is dropped");
  assert.equal(r.json.result.reading_pending, true);
  assert.equal(r.json.result.reading_refused, undefined, "and every row was written");
});

test("R133 (control): a promotion of 3 documents follows 3: each is read inline and registered first, and nothing is owed when every read is made; a document that carries its reading is not followed; a refused promotion follows none", async () => {
  const w = world({ answer: storeFor() });
  const r = await promote(w, many(3));
  assert.deepEqual(asked(w.env, "readheldfor").map((c) => c.params.sha), many(3).map((d) => d.capture.sha256), "3 followed");
  assert.equal(asked(w.env, "pendingadd").length, 3, "each registered first");
  assert.equal(r.json.result.reading_pending, undefined, "every read made: nothing owed");
  const carried = world({ answer: storeFor() });
  await promote(carried, [provDoc({ sha: shaOf(1), reading: true }), provDoc({ sha: shaOf(2) })]);
  assert.deepEqual(asked(carried.env, "readheldfor").map((c) => c.params.sha), [shaOf(2)], "the one that carries its reading is left");
  const refused = world({ answer: (c) => (c.route === "promote" ? ok({ ok: false, reason: "FILE_DIGEST_MISMATCH", status: 400 }) : storeFor()(c)) });
  const f = await promote(refused, many(20));
  assert.deepEqual([asked(refused.env, "readheldfor").length, asked(refused.env, "pendingadd").length, f.json.result.reading_pending], [0, 0, undefined]);
});

test("R133 (R131): documents over the inline gate are all owed as rows with no inline read at all: 20 PDFs of 3 MB are 20 rows and 0 reads, and the answer says `reading_pending`", async () => {
  const docs = many(20, { pdf: true, bytes: 3 * MB, type: "application/pdf" });
  const w = world({ answer: storeFor() });
  const r = await promote(w, docs);
  assert.equal(asked(w.env, "readheldfor").length, 0, "none read in the request");
  assert.deepEqual(asked(w.env, "pendingadd").map((c) => c.params.sha).sort(), docs.map((d) => d.capture.sha256).sort());
  assert.equal(r.json.result.reading_pending, true);
});

test("R133 (R130): a document whose read the store could not make is owed on the row it already has, not registered a second time; and one whose row the store would not keep is STATED (`reading_refused` with its count), never dropped silently", async () => {
  const docs = many(20);
  const w = world({ answer: storeFor({ held: { ok: true, read: false, why: "NO_HOME" } }) });
  const r = await promote(w, docs);
  assert.equal(asked(w.env, "pendingadd").length, 20, "one registration each, whether the inline read worked or not");
  assert.equal(asked(w.env, "readheldfor").length, 16);
  assert.equal(r.json.result.reading_pending, true);
  const refused = shaOf(18);
  const bad = world({ answer: storeFor({ refuseRows: [refused] }) });
  const b = await promote(bad, docs);
  assert.equal(b.json.result.ok, true, "the promotion stands");
  assert.equal(b.json.result.reading_pending, true, "the other documents' beyond the 16 are held");
  assert.equal(b.json.result.reading_refused.count, 1, "the one no row holds is told");
  assert.equal(b.json.result.reading_refused.reason, "READING_NOT_REGISTERED");
  assert.equal(asked(bad.env, "pendingadd").filter((c) => c.params.sha === refused).length, 2, "tried again once through a fresh stub");
});

/* ---- R134 ---- */

const fakeStub = (promotes) => ({ async fetch(input, init) {
  const req = input instanceof Request ? input : new Request(String(input), init);
  const u = new URL(req.url);
  if (u.pathname === "/allocid") return promotes.alloc(req);
  const body = JSON.parse(await req.text());
  return promotes.promote(body.register[0].sha256, body);
} });
const archiveDoc = (sha, extra = {}) => ({ file: `snapshots/f-${sha.slice(0, 6)}`, locator: "https://example.org/a.zip", retrieved: "2026-10-07T00:00:00Z",
  capture: { sha256: sha, bytes: 3, method: "unpacked" }, ...extra });
const idAlloc = () => { let n = 0; return async () => ok({ id: `INFO-2026-${String(++n).padStart(4, "0")}` }); };
const WHO = { author: "token:daemon", actorIdentity: "class:daemon", actorViewer: "class:daemon", assistantPrincipal: "class:daemon" };
const run = (docs, behaviours, alloc = idAlloc()) => promoteArchive({ stub: fakeStub({ alloc, promote: (sha, body) => behaviours[sha](body) }), doAnswer: M.doAnswer, docs, archiveSha: shaOf(99), who: WHO });

test("R134 (DOCS A11, X20): a member whose put or promotion did not answer, or threw, is `not_promoted` with `transient: true`; one the store answered `ok: false` for, or refused, is named WITHOUT `transient` (the file's own refusal, not retried); the others are promoted, and nothing undoes another", async () => {
  const docs = [1, 2, 3, 4, 5, 6].map((i) => archiveDoc(shaOf(i)));
  const done = await run(docs, {
    [shaOf(1)]: async (b) => ok({ ok: true, bundleId: b.bundleId }),
    [shaOf(2)]: async () => new Response("an error page", { status: 500 }),                                   /* the store did not answer */
    [shaOf(3)]: async () => { throw new Error("the stub's connection was reset"); },                           /* a throw */
    [shaOf(4)]: async () => ok({ ok: false, reason: "FILE_DIGEST_MISMATCH" }),                                 /* the store answered, `ok: false` */
    [shaOf(5)]: async () => new Response(JSON.stringify({ ok: false, reason: "PROVENANCE_REGISTER_REFUSED" }), { status: 409 }),   /* the store refused */
    [shaOf(6)]: async (b) => ok({ ok: true, bundleId: b.bundleId }),
  });
  assert.deepEqual(done.promoted.map((p) => p.sha256), [shaOf(1), shaOf(6)], "the others are filed in their order");
  const byte = Object.fromEntries(done.not_promoted.map((n) => [n.sha256, n]));
  assert.deepEqual(byte[shaOf(2)], { sha256: shaOf(2), code: "STORE_DID_NOT_ANSWER", transient: true });
  assert.deepEqual(byte[shaOf(3)], { sha256: shaOf(3), code: "STORE_DID_NOT_ANSWER", transient: true }, "a stub that rejects is a store that did not answer");
  assert.deepEqual(byte[shaOf(4)], { sha256: shaOf(4), code: "FILE_DIGEST_MISMATCH" }, "named, and no `transient`: it is not retried");
  assert.deepEqual(byte[shaOf(5)], { sha256: shaOf(5), code: "PROVENANCE_REGISTER_REFUSED" }, "a refusal of the store is the file's own too");
  assert.equal(done.not_promoted.length, 4);
  /* a stub whose call throws as it is made (a stub a reset has broken) is transient too, with the code of the failed exchange */
  const broken = await promoteArchive({ stub: { fetch() { throw new Error("the stub is closed"); } }, doAnswer: M.doAnswer, docs: [archiveDoc(shaOf(7))], archiveSha: shaOf(99), who: WHO });
  assert.deepEqual(broken, { promoted: [], not_promoted: [{ sha256: shaOf(7), code: "PROMOTE_FAILED", transient: true }] });
});

test("R134: the draw of the member's id is a store exchange too: an `allocid` that did not answer or threw is transient, one the store refused is named without `transient`", async () => {
  const docs = [1, 2, 3].map((i) => archiveDoc(shaOf(i)));
  let n = 0;
  const alloc = async () => {
    n += 1;
    if (n === 1) return new Response("down", { status: 503 });
    if (n === 2) throw new Error("reset");
    return new Response(JSON.stringify({ ok: false, reason: "ID_SPACE_EXHAUSTED" }), { status: 409 });
  };
  const done = await run(docs, { [shaOf(1)]: async () => ok({ ok: true }), [shaOf(2)]: async () => ok({ ok: true }), [shaOf(3)]: async () => ok({ ok: true }) }, alloc);
  assert.deepEqual(done.promoted, []);
  assert.deepEqual(done.not_promoted, [{ sha256: shaOf(1), code: "STORE_DID_NOT_ANSWER", transient: true }, { sha256: shaOf(2), code: "STORE_DID_NOT_ANSWER", transient: true },
                                       { sha256: shaOf(3), code: "ID_SPACE_EXHAUSTED" }]);
});

/* the door: `op=unpack` filing members, the store answering the unpack with `members` and promoting per digest */
function unpackWorld(members, { behave, refuseRows = [] }) {
  let n = 0;
  return world({ answer: (c) => {
    if (c.route === "unpack") return ok({ ok: true, archive: { sha256: shaOf(99) }, documents: members, complete: true });
    if (c.route === "allocid") return ok({ id: `INFO-2026-${String(++n).padStart(4, "0")}` });
    if (c.route === "promote") return behave(c.body.register[0].sha256, c);
    if (c.route === "pendingadd") return ok(refuseRows.includes(c.params.sha) ? { ok: false, reason: "PENDING_NOT_KEPT" } : { ok: true });
    return null;
  } });
}
const unpackRows = (env) => asked(env, "pendingadd").filter((c) => c.params.kind === "unpack");
const unpackOp = (w, body = {}) => call(w.env, { op: "unpack", token: w.S.ann, method: "POST", body: { archiveSha: shaOf(99), ...body } });

test("R134 (DOCS A11): `op=unpack` filing members of which one failed transiently registers the archive's `unpack` job and says `unpack_pending`: the member is owed, never `not_filed` for good; a member refused for its own bytes is named with its code and not retried", async () => {
  const members = [1, 2, 3].map((i) => archiveDoc(shaOf(i), { container: { archive_sha256: shaOf(99), index: i, path: `m${i}.txt` } }));
  const w = unpackWorld(members, { behave: (sha, c) => (sha === shaOf(2) ? new Response("down", { status: 500 }) : sha === shaOf(3) ? ok({ ok: false, reason: "FILE_DIGEST_MISMATCH" }) : ok({ ok: true, bundleId: c.body.bundleId })) });
  const r = await unpackOp(w);
  assert.equal(r.status, 200, r.text);
  const res = r.json.result;
  assert.deepEqual(res.promoted.map((p) => p.sha256), [shaOf(1)]);
  assert.deepEqual(res.not_promoted, [{ sha256: shaOf(2), code: "STORE_DID_NOT_ANSWER", transient: true }, { sha256: shaOf(3), code: "FILE_DIGEST_MISMATCH" }]);
  assert.equal(res.unpack_pending, true, "the plane's unpack job offers the stranded member again");
  assert.deepEqual(unpackRows(w.env).map((c) => [c.params.kind, c.params.sha]), [["unpack", shaOf(99)]], "one `unpack` row, keyed by the archive's whole digest");
  assert.equal(res.unpack_refused, undefined);
});

test("R134 (control): members refused only for their own bytes leave no `unpack` row and no `unpack_pending`; every member promoted leaves none either; and a row the store will not keep is STATED as `unpack_refused`, never as pending", async () => {
  const members = [1, 2].map((i) => archiveDoc(shaOf(i)));
  const own = unpackWorld(members, { behave: (sha, c) => (sha === shaOf(2) ? ok({ ok: false, reason: "FILE_DIGEST_MISMATCH" }) : ok({ ok: true, bundleId: c.body.bundleId })) });
  const a = await unpackOp(own);
  assert.deepEqual([a.json.result.unpack_pending, a.json.result.unpack_refused, unpackRows(own.env).length], [undefined, undefined, 0]);
  assert.deepEqual(a.json.result.not_promoted, [{ sha256: shaOf(2), code: "FILE_DIGEST_MISMATCH" }]);
  const clean = unpackWorld(members, { behave: (sha, c) => ok({ ok: true, bundleId: c.body.bundleId }) });
  const c = await unpackOp(clean);
  assert.deepEqual([c.json.result.promoted.length, c.json.result.not_promoted, c.json.result.unpack_pending, unpackRows(clean.env).length], [2, [], undefined, 0]);
  const noRow = unpackWorld(members, { behave: () => new Response("down", { status: 500 }), refuseRows: [shaOf(99)] });
  const n = await unpackOp(noRow);
  assert.equal(n.json.result.unpack_pending, undefined, "no row, no promise");
  assert.equal(n.json.result.unpack_refused.reason, "READING_NOT_REGISTERED");
  assert.equal(asked(noRow.env, "pendingadd").length, 2, "tried again once through a fresh stub");
});

test("R134 (DOCS A10, A11, X20): the members of a continuation and of a nested archive are promoted into the archive's project as the first members are, each its own act under the door's stamps, and a member over the part size is filed whole under its own digest", async () => {
  const members = [
    archiveDoc(shaOf(1), { container: { archive_sha256: shaOf(99), index: 0, path: "one.docx" } }),
    archiveDoc(shaOf(2), { container: { archive_sha256: shaOf(77), index: 0, path: "inner/two.docx" } }),   /* a nested archive's member */
    archiveDoc(shaOf(3), { capture: { sha256: shaOf(3), bytes: 50 * MB, method: "unpacked" }, container: { archive_sha256: shaOf(99), index: 150, path: "big.docx" } }),   /* a continuation's, over the part size */
  ];
  const w = unpackWorld(members, { behave: (sha, c) => ok({ ok: true, bundleId: c.body.bundleId }) });
  const r = await unpackOp(w, { project: "PROJ-2026-0007", author: FORGED });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(r.json.result.promoted.map((p) => p.sha256), [shaOf(1), shaOf(2), shaOf(3)], "every member is promoted");
  const promotes = asked(w.env, "promote");
  assert.equal(promotes.length, 3, "each its own act");
  for (const p of promotes) {
    assert.match(p.body.files.find((f) => f.path === "bundle.md").text, /^project: "PROJ-2026-0007"$/m, "in the archive's project");
    assert.deepEqual([p.body.author, p.body.actorMemberId, p.body.actorIdentity], ["ann", "ann", "member:ann"], "the door's stamps; a forged author is not the author");
  }
  const big = promotes[2].body;
  assert.deepEqual(big.register.map((x) => [x.sha256, x.bytes]), [[shaOf(3), 50 * MB]], "the whole is registered under its own digest");
  assert.ok(big.files.some((f) => f.blobSha === shaOf(3) && f.bytes === 50 * MB), "and referenced as one blob, not cut into parts here");
});

test("R134 (fix round 9, G162; K4980): `op=unpack` follows EVERY member it filed, not only those whose reading was dropped: a member that carries no reading has its `reading` row registered once, before any read, in the order filed; a member refused for its own bytes is not followed; the archive's own digest is no member", async () => {
  const members = [1, 2, 3].map((i) => archiveDoc(shaOf(i), { container: { archive_sha256: shaOf(99), index: i, path: `m${i}.txt` } }));
  const w = unpackWorld(members, { behave: (sha, c) => (sha === shaOf(3) ? ok({ ok: false, reason: "FILE_DIGEST_MISMATCH" }) : ok({ ok: true, bundleId: c.body.bundleId })) });
  const r = await unpackOp(w);
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(r.json.result.promoted.map((p) => p.sha256), [shaOf(1), shaOf(2)]);
  const rows = asked(w.env, "pendingadd").filter((c) => c.params.kind === "reading").map((c) => c.params.sha);
  assert.deepEqual(rows, [shaOf(1), shaOf(2)], "a reading row for each member filed, in the order filed, once, and none for the refused member or the archive");
  const order = opCalls(w.env).map((c) => c.route).filter((x) => x === "pendingadd" || x === "readheldfor");
  assert.equal(order[0], "pendingadd", "R130: the row is written before the first inline read");
});

test("R134 (fix round 9, G162; K4980): an acquire's archive is followed alike: the members its unpack filed are each followed; the archive document itself, whose reading was not dropped, is not", async () => {
  /* acquisition's real answer to an archive locator (its published fixture): the archive's document and the members its unpack filed */
  const { body: fetched } = await archiveAnswer({ memberBytes: [64, 64] });
  const members = fetched.unpack.documents;
  let n = 0;
  const w = world({ answer: (c) => {
    if (c.route === "allocid") return ok({ id: `INFO-2026-${String(++n).padStart(4, "0")}` });
    if (c.route === "promote") return ok({ ok: true, bundleId: c.body.bundleId });
    if (c.route === "pendingadd") return ok({ ok: true });
    return null;
  } });
  const hooks = { ...defaultHooks(), async gatedOp(ctx) {
    if (ctx.op !== "acquire") return undefined;
    return M.json({ ...fetched, document: { ...fetched.document, reading: { found: true }, text_units: [] } });
  } };
  const r = await call(w.env, { op: "acquire", token: w.S.ann, method: "POST", hooks, body: { locator: "https://example.org/a.zip", unpack: true } });
  assert.equal(r.status, 200, r.text);
  const rows = asked(w.env, "pendingadd").filter((c) => c.params.kind === "reading").map((c) => c.params.sha);
  assert.deepEqual(rows, members.map((m) => m.capture.sha256), "each member of the fetched archive is followed; the archive's own document is not");
});
