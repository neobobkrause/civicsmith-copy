/* control-plane: its shares of four old suites (T18 converts; `build/jobs/T17/legacy-tests.md`). Each arm proves a behaviour
   no module test proved, at the door's interface, over the harness's store:
     - `rec173-migration-replay`: R16's over-strictness (the matching record second of several, a truncated history,
       `bundle.md` among several files) admitted; a caller's digest equal to the listed one over altered text, and a
       capture registered at another path, refused; the rule-2 exemption (a verified inquiry replay carries no
       `assistantPrincipal`, an unverified one does).
     - `d543-instant-precision`: `op=reviewcopy`'s in-band date is the copy's `last_change.at`, to the millisecond.
     - `reviewcopy`: `op=casedocument` with a grant secret over the wire — only the secret's digest reaches the store,
       and a secret the store does not honour reads exactly as a stranger.
     - `textchain`: `op=image`'s forwarded answer carries the text chain whole, stamped with the caller's viewer.
   The old suites are not deleted (K619). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { M, world, call, opCalls, sha, hex64 } from "./harness.mjs";
import { publicationDoorOp } from "../../../src/publication/door.mjs";
import { NS_RATIFY, caseRatifyStatement } from "../../../src/sshsig.mjs";

const reply = (o, status = 200) => new Response(JSON.stringify(o), { status });

/* ---------------------------------------------------------------- rec173 */
const md = (id) => `---\nid: ${id}\nobject_type: inquiry\nsurfaced_by: human\n---\n\n## Question\n\nDid ${id} happen?\n`;
function replayCase(id, { records, register = M.DRIVE_PROVENANCE_PATH, text = md(id), sentSha = null, hold = true } = {}) {
  const prov = JSON.stringify({ promotions: (records ?? [{ target: id, files: [{ name: "bundle.md", sha256: sha(text) }] }])
    .map((record, i) => ({ key: `p${i}`, record })) });
  const bytes = new TextEncoder().encode(prov);
  const cap = sha(prov);
  const w = world();
  w.env.CAPTURES = { async get(k) {
    return hold && k === `bio/captures/${cap}` ? { arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) } : null;
  } };
  const body = { bundleId: id, base: null, replay: true, provenanceCapture: cap, meta: { object_type: "inquiry" },
                 register: [{ sha256: cap, path: register }],
                 files: [{ path: "bundle.md", text, sha256: sentSha ?? sha(text) }] };
  return { w, body, cap };
}
const promote = async ({ w, body }, token = w.env.ADMIN_TOKEN) => {
  w.env.calls.length = 0;
  const r = await call(w.env, { op: "promote", token, method: "POST", body });
  return { r, sent: opCalls(w.env).find((c) => c.route === "promote")?.body ?? null };
};

test("R16 (rec173 convert): a replay whose matching Drive record is the second of several, of a truncated history, listing bundle.md among several files, is admitted — the rule is no stricter than it reads", async () => {
  const id = "PROB-2026-9173-truncated";
  const text = md(id);
  const c = replayCase(id, { records: [
    { target: id, base: "9".repeat(64), files: [{ name: "bundle.md", sha256: "8".repeat(64) }] },
    { target: id, base: "8".repeat(64), files: [{ name: "data/gathering.json", sha256: "7".repeat(64) },
                                               { name: "bundle.md", sha256: sha(text) },
                                               { name: "snapshots/doc.pdf", sha256: "6".repeat(64) }] }] });
  const { r, sent } = await promote(c);
  assert.equal(r.status, 200, r.text.slice(0, 200));
  assert.deepEqual([sent.replay, sent.migrationReplay?.capture, sent.migrationReplay?.promotion], [true, c.cap, "p1"]);
  /* negative control: the same history with no record naming this revision's digest is refused */
  const none = replayCase(id, { records: [{ target: id, files: [{ name: "bundle.md", sha256: "8".repeat(64) }] }] });
  const n = await promote(none);
  assert.deepEqual([n.r.status, n.r.json.reason, n.sent], [403, "REPLAY_UNVERIFIED", null]);
});

test("R16 (rec173 convert, N3b, N5b): a caller's digest equal to the listed one over ALTERED text, and a held capture registered at another path than the drive provenance's, are each refused REPLAY_UNVERIFIED before the store is called", async () => {
  const id = "PROB-2026-9173-stale";
  const listed = md(id);
  const altered = listed.replace("happen?", "happen twice?");
  /* N3b: the records list the original; the caller sends altered text carrying the listed figure */
  const stale = replayCase(id, { records: [{ target: id, files: [{ name: "bundle.md", sha256: sha(listed) }] }], text: altered,
                                 sentSha: sha(listed) });
  const a = await promote(stale);
  assert.deepEqual([a.r.status, a.r.json.reason, a.r.json.check, a.sent], [403, "REPLAY_UNVERIFIED", "C-66.6", null]);
  /* N5b: right capture, held, but registered as something else */
  const wrongPath = replayCase(id, { register: "data/provenance.json" });
  const b = await promote(wrongPath);
  assert.deepEqual([b.r.status, b.r.json.reason, b.sent], [403, "REPLAY_UNVERIFIED", null]);
  /* negative control: the same capture registered at the drive provenance's path verifies */
  const ok = await promote(replayCase(id));
  assert.deepEqual([ok.r.status, ok.sent.replay], [200, true]);
});

test("R16, R17 (rec173 convert, REC-173 (a)): a verified inquiry replay is exempt from rule 2 — it carries no assistantPrincipal — while the same creation unverified carries the admin class's, and a caller's own is never what reaches the store", async () => {
  const id = "PROB-2026-9173-rule2";
  for (const hold of [true, false]) {
    const c = replayCase(id, { hold });
    c.body.assistantPrincipal = "member:forged";
    delete c.body.replay;   /* an inquiry creation asserting nothing is asked all the same (REC-173) */
    const { r, sent } = await promote(c);
    assert.equal(r.status, 200, r.text.slice(0, 200));
    if (hold) assert.deepEqual(["assistantPrincipal" in sent, sent.replay, !!sent.migrationReplay], [false, true, true]);
    else assert.deepEqual([sent.assistantPrincipal, "replay" in sent, "migrationReplay" in sent], ["class:admin", false, false]);
  }
});

/* ---------------------------------------------------------------- d543 */
test("R20 (d543-instant-precision convert): op=reviewcopy's in-band date is the copy's last_change.at, exactly as the store states it, to the millisecond — on the recipient's door and the member's", async () => {
  for (const at of ["2026-08-01T12:00:00.123Z", "2026-08-01T12:00:01Z", null]) {
    const copy = { ok: true, draft: "D1", updated_by: "iris", required_strength: "B",
                   last_change: at ? { kind: "comment", at, by: "ann" } : null, comments: [] };
    const w = world({ answer: (c) => (c.route === "reviewcopy" ? reply({ ok: true, result: copy }) : null) });
    for (const req of [{ params: { secret: "s3cret" } }, { token: w.S.ann, params: { draft: "D1" } }]) {
      const r = await call(w.env, { op: "reviewcopy", ...req });
      assert.equal(r.status, 200, r.text.slice(0, 200));
      assert.equal(r.json.inband.date, at, JSON.stringify(req));
      assert.equal(r.json.last_change?.at ?? null, at);
      /* the author is the draft's, not the last change's */
      assert.equal(r.json.inband.author, "iris");
    }
  }
});

/* ---------------------------------------------------------------- reviewcopy */
test("R30, R2, R59 (reviewcopy convert; publication R73, K2146): op=casedocument with a grant secret over the wire, in the POST body — the module's handler is handed the door's reader, only sha256(secret) reaches the store (in its request's body, never its address), never the secret, and a secret the store does not honour (revoked, another edition, another case) reads byte for byte as a stranger; the address form is refused CREDENTIAL_IN_ADDRESS with no store request", async () => {
  const LIVE = "rv1_live-holder", REVOKED = "rv1_revoked";
  const doc = { ok: true, case_id: "CASE-2026-0001", edition: 2, ratified: false, text: "the document", doc_sha: "d".repeat(64) };
  // fixtures-generic: NO_CASE_DOCUMENT (the test compares the door's answers to each other: whatever refusal the store gives a stranger must read the same)
  const stranger = { ok: false, reason: "NO_CASE_DOCUMENT" };
  const w = world({ answer: (c) => c.route === "casedocument"
    ? reply({ ok: true, result: c.body?.secretSha === sha(LIVE) && c.params.case === doc.case_id && c.params.edition === "2" ? doc : stranger })
    : null });
  const hooks = {
    publicOp: async (ctx) => publicationDoorOp(ctx.op, ctx.url, ctx.stub, { json: M.json, storeSilent: M.storeSilent,
      storeRefusal: M.storeRefusal, doAnswer: M.doAnswer, sha256Hex: M.sha256Hex, NS_RATIFY, caseRatifyStatement,
      readerOf: () => M.caseReader(ctx.url, ctx.env, "bio", ctx.presentedAi.cred),
      body: () => ctx.req.clone().json() }) ?? M.json({ ok: false }, 500),
    gatedOp: async () => undefined, publicInstanceGroup: async () => ({ answered: true, result: {} }),
  };
  /* R59 (publication R73, K2011): the secret travels in the POST body, never the address */
  const read = async ({ secret, ...params }) => {
    w.env.calls.length = 0;
    const r = await call(w.env, { op: "casedocument", params, hooks,
                                  ...(secret === undefined ? {} : { method: "POST", body: { secret } }) });
    return { r, inner: opCalls(w.env).filter((c) => c.route === "casedocument") };
  };
  const live = await read({ case: doc.case_id, edition: "2", secret: LIVE });
  assert.deepEqual([live.r.status, live.r.json.text], [200, "the document"], live.r.text.slice(0, 300));
  assert.deepEqual([live.inner[0].body.secretSha, live.inner[0].params.secretSha], [sha(LIVE), undefined]);
  assert.equal(JSON.stringify(live.inner[0]).includes(LIVE) || live.r.text.includes(LIVE), false, "the secret never travels");
  const anon = await read({ case: doc.case_id, edition: "2" });
  assert.equal("secretSha" in anon.inner[0].params || "secretSha" in (anon.inner[0].body ?? {}), false);
  for (const params of [{ case: doc.case_id, edition: "2", secret: REVOKED }, { case: doc.case_id, edition: "3", secret: LIVE },
                        { case: "CASE-2026-0002", edition: "2", secret: LIVE }]) {
    const x = await read(params);
    const a = params.case === doc.case_id && params.edition === "2" ? anon : await read({ case: params.case, edition: params.edition });
    assert.deepEqual([x.r.status, x.r.text], [a.r.status, a.r.text], JSON.stringify(params));
    assert.equal(x.r.text.includes(params.secret), false);
  }
  /* (T36; K2111) the address form is refused by admission's gate (C-38.10), before the store is asked; no answer carries
     `deprecated` */
  w.env.calls.length = 0;
  const q = await call(w.env, { op: "casedocument", params: { case: doc.case_id, edition: "2", secret: LIVE }, hooks, secretIn: "query" });
  assert.deepEqual([q.status, q.json.reason, q.json.check], [400, "CREDENTIAL_IN_ADDRESS", "C-38.10"]);
  assert.deepEqual(w.env.calls, []);
  assert.equal(q.text.includes(LIVE), false);
  assert.equal("deprecated" in live.r.json, false);
});

/* ---------------------------------------------------------------- textchain */
test("R21, R17 (textchain convert): op=image's forwarded answer carries the text chain whole — every step, its engine and the text source as an object — with the caller's viewer stamped and a caller's own never reaching the store", async () => {
  const reading = { text_source: { chain: [{ step: "pixels" }, { step: "ocr", engine: "tesseract" }] },
                    chain: [{ step: "pixels" }, { step: "ocr", engine: "tesseract", version: "5" }] };
  const image = { "bundle.md": "---\n---\n", "data/provenance.json": JSON.stringify({ documents: [{ reading }] }) };
  const w = world({ answer: (c) => (c.route === "image" ? reply({ ok: true, result: image }) : null) });
  for (const [token, viewer] of [[w.env.ADMIN_TOKEN, "class:admin"], [w.S.ann, "member:ann"], [w.A.ann, "member:ann"]]) {
    w.env.calls.length = 0;
    const r = await call(w.env, { op: "image", token, params: { id: "INFO-2026-0001", viewer: "member:forged" } });
    assert.equal(r.status, 200);
    const exported = JSON.parse(r.json.result["data/provenance.json"]).documents[0].reading;
    assert.deepEqual(exported, reading);
    assert.equal(typeof exported.text_source, "object");
    assert.equal(opCalls(w.env)[0].params.viewer, viewer);
  }
});

test("R20 (K982; public-read R7): op=reviewcopy's in-band hash is inbandQuartet's over the same bytes — the answer as served without its `inband` key — on the recipient's door and the member's, with the floors from the store's required_strength (negative control: a byte changed in the answer changes the hash)", async () => {
  const { inbandQuartet } = await import("../../../src/inband.mjs");
  const copy = { ok: true, draft: "D1", updated_by: "iris", required_strength: "B", text: "the draft's words",
                 last_change: { kind: "comment", at: "2026-08-01T12:00:00.123Z", by: "ann" }, comments: [{ by: "ann", text: "ok" }] };
  const w = world({ answer: (c) => (c.route === "reviewcopy" ? reply({ ok: true, result: copy }) : null) });
  for (const req of [{ params: { secret: "s3cret" } }, { token: w.S.ann, params: { draft: "D1" } }]) {
    const r = await call(w.env, { op: "reviewcopy", ...req });
    assert.equal(r.status, 200, r.text.slice(0, 200));
    const { inband, ...rest } = r.json;
    const { quartet } = await inbandQuartet({ subject: rest, over: inband.hash.over, date: copy.last_change.at,
                                              author: copy.updated_by, bar: copy.required_strength });
    assert.deepEqual(inband, quartet, JSON.stringify(req));
    assert.equal(Object.hasOwn(rest, "required_strength"), false, "the store's bar is read into the floors, not served twice");
    const { quartet: other } = await inbandQuartet({ subject: { ...rest, text: rest.text + "." }, over: inband.hash.over });
    assert.notEqual(other.hash.sha256, inband.hash.sha256);
  }
});
