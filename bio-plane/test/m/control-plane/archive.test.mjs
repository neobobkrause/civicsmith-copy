/* control-plane R58 (T35; N688, K1940 (1), K1943, K2042; acquisition R38–R41): the door promotes what an unpack files —
   after an `op=acquire` whose answer carries `unpack`, the archive's own document first, then each file the unpack filed,
   in order, one promotion act each, through the store's own routes, the caller its author, in the request's project; a
   refused promotion named in `not_promoted` and undoing nothing else. Driven through `makeFetch(hooks)` over the harness's
   store (the acquire answered by a hook, as plane's capture arm answers it), and once over a record so each package is
   shown to promote. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { M, world, call, FORGED } from "./harness.mjs";
import { archiveDocuments, promoteArchive } from "../../../src/control-plane/archive.mjs";
const { record } = await import("./record.mjs");
const { recordOf } = await import("../../../src/record-core/index.mjs");

const reply = (o, status = 200) => new Response(JSON.stringify(o), { status });
const S = (c) => c.repeat(64);
const doc = (sha, extra = {}) => ({ file: `snapshots/f-${sha.slice(0, 6)}`, locator: `https://example.org/a.zip#zip:${sha[0]}`, retrieved: "2026-10-07T00:00:00Z",
                                    capture: { sha256: sha, bytes: 3, method: "unpacked" }, ...extra });
const archive = doc(S("a"), { file: "snapshots/archive", locator: "https://example.org/a.zip" });
const files = [doc(S("b"), { container: { archive_sha256: S("a"), index: 0, path: "one.pdf" } }),
               doc(S("c"), { container: { archive_sha256: S("a"), index: 1, path: "two.pdf" } })];
const acquired = (unpack) => ({ ok: true, existed: false, document: archive, ...(unpack === undefined ? {} : { unpack }) });

/* A world whose store draws ids and promotes (refusing `refuse`'s digests), and a hook answering `acquire`. */
function archiveWorld(answer, refuse = []) {
  let n = 0;
  const w = world({ answer: (c) => {
    if (c.route === "allocid") return reply({ ok: true, result: { id: `INFO-2026-${String(++n).padStart(4, "0")}` } });
    if (c.route === "promote") {
      const sha = c.body.register[0].sha256;
      return reply({ ok: true, result: refuse.includes(sha) ? { ok: false, reason: "FILE_DIGEST_MISMATCH" } : { ok: true, bundleId: c.body.bundleId } });
    }
    return null;
  } });
  const hooks = { publicOp: async () => M.json({ ok: true }), publicInstanceGroup: async () => ({ answered: true, result: {} }),
                  gatedOp: async (ctx) => (ctx.op === "acquire" ? M.json(answer, 200) : undefined) };
  return { ...w, hooks };
}

test("R58 (K2042 (2)): after an acquire whose answer carries `unpack`, the archive's own document is promoted first, then each file in the order answered, each an Information document at collected in the request's project, the caller its author with op=promote's stamps, one act each; the answer names each as `promoted` (negative control: an acquire with no `unpack` promotes nothing)", async () => {
  const w = archiveWorld(acquired({ ok: true, archive: { sha256: S("a") }, documents: files }));
  const r = await call(w.env, { op: "acquire", token: w.S.ann, method: "POST", hooks: w.hooks,
                                body: { address: "https://example.org/a.zip", project: "PROJ-2026-0001", author: FORGED } });
  assert.equal(r.status, 200, r.text.slice(0, 300));
  const promotes = w.env.calls.filter((c) => c.route === "promote");
  assert.deepEqual(promotes.map((c) => c.body.register[0].sha256), [S("a"), S("b"), S("c")]);
  for (const p of promotes) {
    assert.deepEqual([p.body.author, p.body.actorMemberId, p.body.actorIdentity, p.body.actorViewer, p.body.base],
                     ["ann", "ann", "member:ann", "member:ann", null]);
    assert.equal(p.body.meta.object_type, "information");
    const md = p.body.files.find((f) => f.path === "bundle.md").text;
    assert.match(md, /^current_state: collected$/m);
    assert.match(md, /^project: "PROJ-2026-0001"$/m);
    assert.ok(p.body.files.some((f) => f.blobSha === p.body.register[0].sha256), "the bytes are a blob reference, never carried");
  }
  assert.deepEqual(r.json.promoted.map((x) => x.sha256), [S("a"), S("b"), S("c")]);
  assert.deepEqual(r.json.not_promoted, []);
  /* negative control: no unpack, nothing promoted, the answer as the hook gave it */
  const plain = archiveWorld(acquired());
  const p = await call(plain.env, { op: "acquire", token: plain.S.ann, method: "POST", hooks: plain.hooks, body: {} });
  assert.deepEqual([plain.env.calls.filter((c) => c.route === "promote").length, "promoted" in p.json], [0, false]);
});

test("R58: a refused promotion is named in `not_promoted` with its code and undoes neither the archive's promotion nor another file's; a machine caller promotes under its own name; no project leaves the bundle in none", async () => {
  const w = archiveWorld(acquired({ ok: true, documents: files }), [S("b")]);
  /* the machine caller is the daemon binding (admission R5, K2166: the shared member binding is retired) */
  const r = await call(w.env, { op: "acquire", token: w.env.DAEMON_TOKEN, method: "POST", hooks: w.hooks, body: {} });
  assert.deepEqual(r.json.promoted.map((x) => x.sha256), [S("a"), S("c")]);
  assert.deepEqual(r.json.not_promoted, [{ sha256: S("b"), code: "FILE_DIGEST_MISMATCH" }]);
  const p = w.env.calls.filter((c) => c.route === "promote");
  assert.deepEqual([p[0].body.author, "actorMemberId" in p[0].body, p[0].body.assistantPrincipal], ["token:daemon", false, "class:daemon"]);
  assert.equal(/^project:/m.test(p[0].body.files[0].text), false);
  /* `archiveDocuments` reads only an answer that is ok, with an unpack that is ok, and documents with a digest */
  // fixtures-own: input archiveDocuments is this module's own function: the acquire answer is its argument, an unpack that failed is the case read
  assert.deepEqual(archiveDocuments("acquire", { ok: true, document: archive, unpack: { ok: false } }), []);
  assert.deepEqual(archiveDocuments("unpack", { ok: true, documents: [files[0], { capture: {} }] }), [files[0]]);
});

test("R58 (K1940 (1)): the packages the door builds are ones the record's promotion accepts, in the door's order — the archive first, which makes the file's archive one the record holds, then the file; the file alone, before its archive is held, is refused by the record's own register check and named in `not_promoted`", async () => {
  const { createHash } = await import("node:crypto");
  const r = await record();
  const rec = recordOf(r.ctx);
  const held = (text) => { const b = new TextEncoder().encode(text); const h = createHash("sha256").update(b).digest("hex"); r.objects.set(`bio/captures/${h}`, b); return h; };
  const aSha = held("PK\u0005\u0006 the archive"), fSha = held("abc");
  const stub = { async fetch(req) {
    const u = new URL(req.url);
    if (u.pathname === "/allocid") return reply({ ok: true, result: rec.allocIdOp(u.searchParams.get("prefix"), u.searchParams.get("year")) });
    if (u.pathname === "/promote") { const x = r.promotion.promote(await req.json()); return reply({ ok: true, result: x }); }
    return reply({ ok: false, error: "unknown" }, 400);
  } };
  const base = (sha, extra) => ({ file: `snapshots/f-${sha.slice(0, 8)}`, locator: "https://example.org/a.zip", retrieved: "2026-10-07T00:00:00Z",
    authority_state: "undetermined", authority_basis: "captured by the door's test",
    provenance_chain: [{ who: "test", asserts: "these bytes", evidence: "their digest", bound: false, via: "unpacked" }],
    capture: { method: "unpacked", actor_class: "daemon", actor: null, sha256: sha, encoding: "binary", bytes: 3 },
    origin: { kind: "named_request" }, attestation_attempts: [], ...extra });
  const archiveDoc = base(aSha, { capture: { method: "fetch", grade: "B", actor_class: "daemon", actor: null, sha256: aSha, encoding: "binary", bytes: 16 },
                                  provenance_chain: [{ who: "test", asserts: "these bytes", evidence: "their digest", bound: false, via: "fetch" }] });
  /* the file's grade is its archive's (provenance R42; here the archive's route is unrecorded, so its basis is that) */
  const fileDoc = base(fSha, { locator: "https://example.org/a.zip#zip:0",
    capture: { method: "unpacked", grade_basis: "CAPTURE_ROUTE_UNRECORDED", actor_class: "daemon", actor: null, sha256: fSha, encoding: "binary", bytes: 3 },
    container: { archive_sha256: aSha, index: 0, path: "one.txt", name_raw: "6f6e652e747874", method: 0, crc32: 891568578,
                 compressed: 3, uncompressed: 3, local_offset: 0, member_sha256: fSha, dos_time_stated: null, name_shared: 1, path_unsafe: false } });
  const who = { author: "token:daemon", actorIdentity: "class:daemon", actorViewer: "class:daemon", assistantPrincipal: "class:daemon" };
  const alone = await promoteArchive({ stub, doAnswer: M.doAnswer, docs: [fileDoc], archiveSha: aSha, who });
  assert.deepEqual([alone.promoted, alone.not_promoted.map((x) => x.code)], [[], ["PROVENANCE_REGISTER_REFUSED"]]);
  const done = await promoteArchive({ stub, doAnswer: M.doAnswer, docs: [archiveDoc, fileDoc], archiveSha: aSha, who });
  assert.deepEqual(done.not_promoted, [], JSON.stringify(done));
  assert.deepEqual(done.promoted.map((x) => x.sha256), [aSha, fSha]);
  for (const { bundleId } of done.promoted) {
    assert.match(bundleId, /^INFO-\d{4}-\d{4}-archive-file$/);
    assert.ok(rec.bundleInfo(bundleId), bundleId);
  }
});

/* R72 (fix round 9, DOCS A1): an uploaded archive is opened by the plane's `unpack` job, which names no project. A world whose store answers
   `heldat` for the archive's digest as `held` says, and a hook answering `unpack` with the files it filed. */
function unpackWorld(held) {
  let n = 0;
  const w = world({ answer: (c) => {
    if (c.route === "heldat") return reply({ ok: true, result: held });
    if (c.route === "allocid") return reply({ ok: true, result: { id: `INFO-2026-${String(++n).padStart(4, "0")}` } });
    if (c.route === "promote") return reply({ ok: true, result: { ok: true, bundleId: c.body.bundleId } });
    if (c.route === "unpack") { unpacked.push(c.route); return reply({ ok: true, result: { ok: true, archive: { sha256: S("a") }, documents: files } }); }
    return null;
  } });
  const unpacked = [];
  const hooks = { publicOp: async () => M.json({ ok: true }), publicInstanceGroup: async () => ({ answered: true, result: {} }), gatedOp: async () => undefined };
  return { ...w, hooks, unpacked };
}

test("R72 (fix round 9, DOCS A1): the plane's `unpack` job for an uploaded archive no document holds yet is answered ARCHIVE_NOT_FILED, complete: false, nothing unpacked; once a document holds it, its members are filed under that document's project (control: a member's own unpack naming its project is not asked where the archive is held)", async () => {
  const waiting = unpackWorld({ ok: true, held: false });
  const r = await call(waiting.env, { op: "unpack", token: waiting.env.DAEMON_TOKEN, method: "POST", hooks: waiting.hooks, body: { archiveSha: S("a") } });
  assert.equal(r.status, 200, r.text.slice(0, 300));
  assert.deepEqual(r.json.result, { ok: true, complete: false, waiting_on: { code: "ARCHIVE_NOT_FILED" } });
  assert.deepEqual(waiting.unpacked, [], "nothing is unpacked");
  assert.equal(waiting.env.calls.filter((c) => c.route === "promote").length, 0);
  const heldAsked = waiting.env.calls.find((c) => c.route === "heldat");
  assert.equal(heldAsked.params.sha256, S("a"), "the record is asked by the archive's digest");

  const filed = unpackWorld({ ok: true, held: true, copy: { project: "PROJ-2026-0042", document: "INFO-2026-0009" } });
  const f = await call(filed.env, { op: "unpack", token: filed.env.DAEMON_TOKEN, method: "POST", hooks: filed.hooks, body: { archiveSha: S("a") } });
  assert.equal(f.status, 200, f.text.slice(0, 300));
  assert.deepEqual(filed.unpacked, ["unpack"]);
  const promotes = filed.env.calls.filter((c) => c.route === "promote");
  assert.ok(promotes.length >= files.length, "the members are promoted");
  for (const p of promotes) assert.match(p.body.files.find((x) => x.path === "bundle.md").text, /^project: "PROJ-2026-0042"$/m);

  /* control: a unpack naming its project files there and asks nothing of where the archive is held */
  const named = unpackWorld({ ok: true, held: false });
  await call(named.env, { op: "unpack", token: named.S.ann, method: "POST", hooks: named.hooks, body: { archiveSha: S("a"), project: "PROJ-2026-0001" } });
  assert.equal(named.env.calls.some((c) => c.route === "heldat"), false);
  for (const p of named.env.calls.filter((c) => c.route === "promote")) assert.match(p.body.files.find((x) => x.path === "bundle.md").text, /^project: "PROJ-2026-0001"$/m);
});
