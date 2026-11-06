// Copied from control-plane's suite (test/m/control-plane/r72-parted.test.mjs) when control-plane-door-reading took R72 by copy (5 Nov 2026); it proves the requirement at this module's interface.
/* control-plane R72 (capture R86, R111, R113; K4891, K4899): THE UPLOAD'S ARMS. `captureupload` hands capture the request's declared length
   (`declared`, from the address the door sets from Content-Length) and a byte ledger; the four parted-upload arms (`captureuploadbegin`,
   `captureuploadpart`, `captureuploadcomplete`, `captureuploadabort`) call capture's methods by name, `by` the door's, the part's raw
   body as `bytes`. Driven at the door's map over capture's real instance (the fixtures capture's own suite uses), and the member-session
   fence through the whole door. Negative controls throughout (K874). */
import "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, bucket, sha } from "../capture/fixture.mjs";
import { store } from "../store-assembly/fixture.mjs";
import { pendingOf } from "../../../src/store-assembly/pending.mjs";
import { ownerOps as controlPlaneOwnerOps } from "../../../src/store-assembly/owner-ops.mjs";
import { PARTED_PART_BYTES } from "../../../src/capture/index.mjs";
import { world, call, opCalls, aik, cred, FORGED } from "../control-plane/harness.mjs";

const MiB = 1024 * 1024;
const OVER = 104857601;
const MEMBER = "member:ann";
const STATEMENT = "a file the clerk handed me";
const varied = (n, seed = 1) => { const b = new Uint8Array(n); for (let i = 0; i < n; i++) b[i] = (seed + (i % 251) + Math.floor(i / 997)) & 255; return b; };
const url = (op, query) => {
  const u = new URL(`http://do/${op}`);
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null) u.searchParams.set(k, v);
  return u;
};

/* R2's multipart upload, as much of it as the arms reach */
function r2() {
  const b = bucket(), ups = new Map(); let seq = 0;
  b.mp = { created: [], completed: [], aborted: [] };
  const handle = (id) => { const u = ups.get(id);
    return { key: u.key, uploadId: id,
      async uploadPart(n, v) { u.parts.set(n, new Uint8Array(v)); return { partNumber: n, etag: `e-${id}-${n}` }; },
      async complete(list) { b.held.set(u.key, new Uint8Array(Buffer.concat(list.map((p) => u.parts.get(p.partNumber))))); u.state = "done"; b.mp.completed.push(id); },
      async abort() { u.state = "aborted"; b.mp.aborted.push(id); } }; };
  b.createMultipartUpload = async (key) => { const id = `u${++seq}`; ups.set(id, { key, parts: new Map(), state: "open" }); b.mp.created.push(id); return handle(id); };
  b.resumeMultipartUpload = (key, id) => handle(id);
  return b;
}
/* the job registrar is store-assembly's: the assembled store's real one (`pendingOf(ctx).registerJob`), on the store's own storage */
const setup = async () => {
  const b = r2();
  const w = fresh({ evidence: b, env: { INSTANCE_NAME: "inst", VERSION: "9.9.9" } });
  w.c.evidenceKey = (d) => `bio/captures/${d}`;
  const x = await store({});
  const j = pendingOf(x.ctx);
  w.c.registerJob = (e) => j.registerJob(e); w.c.armJobs = () => j.armJobs();
  const real = w.core.transact.bind(w.core);
  w.core.transact = (fn) => {
    try { return real(() => x.ctx.storage.transactionSync(() => { const out = fn(); if (out && typeof out === "object" && out.ok === false) throw Object.assign(new Error("refused"), { refused: out }); return out; })); }
    catch (e) { if (e && e.refused) return e.refused; throw e; }
  };
  return { ...w, b, j, of: { capture: () => w.c } };
};
const arm = (w, op, query, body) => controlPlaneOwnerOps(w.of, url(op, query), body)[op]();
const captures = (w) => w.c.provenance.receipts.length;

test("R72 (the upload's declared length): an upload declaring 104,857,601 bytes in the address is refused 413 with {size, bound} before a byte is read, and nothing is written (controls: a declared length equal to the real size lands, none declared lands as before, a garbled one is not a declaration)", async () => {
  const w = await setup();
  let pulled = 0;
  const tiny = new ReadableStream({ pull(c) { pulled++; c.enqueue(new TextEncoder().encode("tiny")); c.close(); } }, { highWaterMark: 0 });
  const r = await arm(w, "captureupload", { by: MEMBER, statement: STATEMENT, name: "big.bin", declared: String(OVER) }, tiny);
  assert.deepEqual([r.ok, r.reason, r.status, r.size, r.bound], [false, "TOO_LARGE", 413, OVER, 104857600]);
  assert.equal(pulled, 0, "no byte was read");
  assert.deepEqual([captures(w), w.b.held.size, w.j.list().length], [0, 0, 0], "nothing written");
  const bytes = new TextEncoder().encode("a page of notes " + Date.now());
  const sized = await arm(w, "captureupload", { by: MEMBER, statement: STATEMENT, declared: String(bytes.length) }, bytes);
  assert.equal(sized.ok, true, JSON.stringify(sized).slice(0, 200));
  const none = await arm(w, "captureupload", { by: MEMBER, statement: STATEMENT }, new TextEncoder().encode("another page " + Date.now()));
  assert.equal(none.ok, true);
  for (const bad of ["12x", "-5", "1e9", "", "0x10"]) {
    const g = await arm(w, "captureupload", { by: MEMBER, statement: STATEMENT, declared: bad }, new TextEncoder().encode("garbled " + bad + Date.now()));
    assert.equal(g.ok, true, `declared=${bad} is no declaration`);
  }
});

test("R72 (the upload's ledger): `uploadCapture` is handed a byte ledger per request, and the declared length arrives as a number only when it is a whole number", () => {
  const calls = [];
  const of = { capture: () => ({ uploadCapture: (a) => { calls.push(a); return { ok: true }; } }) };
  const run = (query) => controlPlaneOwnerOps(of, url("captureupload", query), new ReadableStream()).captureupload();
  run({ by: MEMBER, statement: "s", declared: "104857601" });
  run({ by: MEMBER, statement: "s" });
  run({ by: MEMBER, statement: "s", declared: "abc" });
  assert.equal(calls[0].declared, 104857601);
  assert.equal(typeof calls[0].ledger?.hold, "function");
  assert.equal(typeof calls[0].ledger?.release, "function");
  assert.equal("declared" in calls[1], false);
  assert.equal("declared" in calls[2], false);
  assert.notEqual(calls[0].ledger, calls[1].ledger, "one ledger for each request");
});

test("R72 (parted upload): begin, part, part, complete lands ONE capture under the whole digest with ONE job row; the ledger is back to nothing held", async () => {
  const w = await setup();
  const file = varied(PARTED_PART_BYTES + 1000, 5), whole = sha(file);
  const q = { by: MEMBER };
  const b = await arm(w, "captureuploadbegin", q, { sha256: whole, bytes: file.length, statement: STATEMENT, name: "big.bin", by: FORGED });
  assert.deepEqual([b.ok, b.parts, b.part_bytes, b.next, b.held], [true, 2, PARTED_PART_BYTES, 0, false], JSON.stringify(b).slice(0, 300));
  const ps = [file.subarray(0, PARTED_PART_BYTES), file.subarray(PARTED_PART_BYTES)];
  const seen = [];
  for (let i = 0; i < 2; i++) {
    const r = await arm(w, "captureuploadpart", { ...q, upload: b.upload, index: String(i), sha256: sha(ps[i]), declared: String(ps[i].length) }, ps[i]);
    seen.push([r.ok, r.existed, r.next]);
  }
  assert.deepEqual(seen, [[true, false, 1], [true, false, 2]]);
  const done = await arm(w, "captureuploadcomplete", q, { upload: b.upload, parts: ps.map(sha), by: FORGED });
  assert.equal(done.ok, true, JSON.stringify(done).slice(0, 300));
  assert.equal(done.capture.sha256, whole);
  assert.deepEqual(w.c.provenance.receipts.map((r) => r.captureSha), [whole], "one capture");
  assert.deepEqual(w.j.list().map((r) => [r.kind, r.sha]), [["reading", whole]], "one job row");
  assert.deepEqual(w.c.captureAccountsOf(whole).actors.map((a) => a.actor), ["member:ann"], "by the door's stamp, never the body's");
});

test("R72 (parted upload, abort): abort removes the session and the R2 upload, answered {ok, aborted}; a second abort is idempotent; nothing is held", async () => {
  const w = await setup();
  const file = varied(PARTED_PART_BYTES + 10, 7);
  const b = await arm(w, "captureuploadbegin", { by: MEMBER }, { sha256: sha(file), bytes: file.length, statement: STATEMENT });
  const first = file.subarray(0, PARTED_PART_BYTES);
  await arm(w, "captureuploadpart", { by: MEMBER, upload: b.upload, index: "0", sha256: sha(first) }, first);
  const a = await arm(w, "captureuploadabort", { by: MEMBER }, { upload: b.upload });
  assert.deepEqual([a.ok, a.aborted], [true, true]);
  assert.deepEqual([w.b.mp.aborted.length, w.b.held.size, captures(w)], [1, 0, 0]);
  const again = await arm(w, "captureuploadabort", { by: MEMBER }, { upload: b.upload });
  assert.equal(again.ok, true, "idempotent");
  const late = await arm(w, "captureuploadpart", { by: MEMBER, upload: b.upload, index: "1", sha256: sha(first) }, first);
  assert.equal(late.ok, false, "a part for an aborted upload is refused");
});

test("R72 (parted upload, who): a caller's `by` in the body names nobody; another member cannot use a member's upload; a machine stamp and an ai stamp are refused by capture's member-session fence (controls: the owner's own stamp is served)", async () => {
  const w = await setup();
  const file = varied(PARTED_PART_BYTES + 10, 9);
  const begin = { sha256: sha(file), bytes: file.length, statement: STATEMENT };
  for (const by of ["class:ai", "class:probe", undefined]) {
    const r = await arm(w, "captureuploadbegin", { by }, { ...begin, by: MEMBER });
    assert.deepEqual([r.ok, r.reason, r.status], [false, "MEMBER_SESSION_REQUIRED", 403], String(by));
  }
  const b = await arm(w, "captureuploadbegin", { by: MEMBER }, { ...begin, by: "member:bea" });
  assert.equal(b.ok, true);
  const first = file.subarray(0, PARTED_PART_BYTES);
  const other = await arm(w, "captureuploadpart", { by: "member:bea", upload: b.upload, index: "0", sha256: sha(first) }, first);
  assert.deepEqual([other.ok, other.reason, other.status], [false, "UPLOAD_UNKNOWN", 404]);
  const abortOther = await arm(w, "captureuploadabort", { by: "member:bea" }, { upload: b.upload });
  assert.equal(w.b.mp.aborted.length, 0, "bea's abort left ann's upload standing");
  const mine = await arm(w, "captureuploadpart", { by: MEMBER, upload: b.upload, index: "0", sha256: sha(first) }, first);
  assert.equal(mine.ok, true);
  assert.ok(abortOther);
});

test("R72 (parted upload, part bound): a part whose declared length is over the part size is refused as capture refuses, {size, bound} relayed, nothing stored, its body read and discarded so the client reads the answer (capture R113, G176) (control: a part of exactly the part size is accepted)", async () => {
  const w = await setup();
  const file = varied(PARTED_PART_BYTES + 10, 11);
  const b = await arm(w, "captureuploadbegin", { by: MEMBER }, { sha256: sha(file), bytes: file.length, statement: STATEMENT });
  let pulled = 0;
  const body = new ReadableStream({ pull(c) { pulled++; c.enqueue(new Uint8Array(4)); c.close(); } }, { highWaterMark: 0 });
  const r = await arm(w, "captureuploadpart", { by: MEMBER, upload: b.upload, index: "0", sha256: "a".repeat(64), declared: String(PARTED_PART_BYTES + 1) }, body);
  assert.deepEqual([r.ok, r.reason], [false, "PART_SIZE"]);
  assert.ok([400, 413].includes(r.status));
  assert.equal(r.size, PARTED_PART_BYTES + 1);
  assert.equal(r.bound, PARTED_PART_BYTES);
  assert.equal(pulled, 1);   /* capture R113 (G176): the body is drained, never left unread */
  const first = file.subarray(0, PARTED_PART_BYTES);
  const ok = await arm(w, "captureuploadpart", { by: MEMBER, upload: b.upload, index: "0", sha256: sha(first), declared: String(first.length) }, first);
  assert.equal(ok.ok, true);
});

test("R72 (parted upload, the arms' hand to capture): each arm passes its fields by name, `by` from the address alone, `bytes` the part's raw body unread, `declared` only when the length is a whole number, and a ledger on the part", () => {
  const log = [];
  const rec = (m) => (a) => { log.push([m, a]); return { ok: true }; };
  const of = { capture: () => ({ beginPartedUpload: rec("begin"), putUploadPart: rec("part"), completePartedUpload: rec("complete"), abortPartedUpload: rec("abort") }) };
  const stream = new ReadableStream();
  const run = (op, query, body) => controlPlaneOwnerOps(of, url(op, query), body)[op]();
  run("captureuploadbegin", { by: MEMBER }, { sha256: "a".repeat(64), bytes: 5, statement: "s", name: "n", type: "text/plain", by: FORGED });
  run("captureuploadpart", { by: MEMBER, upload: "U1", index: "3", sha256: "b".repeat(64), declared: "77" }, stream);
  run("captureuploadpart", { by: MEMBER, upload: "U1", index: "3", sha256: "b".repeat(64), declared: "x7" }, stream);
  run("captureuploadcomplete", { by: MEMBER }, { upload: "U1", parts: ["p"], by: FORGED });
  run("captureuploadabort", { by: MEMBER }, { upload: "U1", by: FORGED });
  const [begin, part, bad, complete, abort] = log.map((l) => l[1]);
  assert.deepEqual([begin.by, begin.sha256, begin.bytes, begin.statement, begin.name, begin.type], [MEMBER, "a".repeat(64), 5, "s", "n", "text/plain"]);
  assert.deepEqual([part.by, part.upload, part.index, part.sha256, part.declared, part.bytes === stream], [MEMBER, "U1", 3, "b".repeat(64), 77, true]);
  assert.equal(typeof part.ledger?.hold, "function");
  assert.equal("declared" in bad, false);
  assert.deepEqual([complete.by, complete.upload, complete.parts], [MEMBER, "U1", ["p"]]);
  assert.deepEqual([abort.by, abort.upload], [MEMBER, "U1"]);
  assert.equal(begin.by === FORGED || complete.by === FORGED, false);
});

test("R72 (parted upload, the door): an `ai` credential's call reaches the store stamped as the machine it is (`class:ai/...`), never as a member and never as the `by` it forged, and capture's member-session fence refuses that stamp (control: a member's session reaches the store stamped as the member)", async () => {
  const agent = aik();
  const ops = ["captureuploadbegin", "captureuploadpart", "captureuploadcomplete", "captureuploadabort"];
  const w = world({ creds: { [agent]: cred({ tokenId: "agent-ann", principal: MEMBER, writes: ops }) },
                    answer: (c) => (ops.includes(c.route) ? new Response(JSON.stringify({ ok: true, result: { ok: true } })) : null) });
  const cap = await setup();
  for (const op of ["captureuploadbegin", "captureuploadcomplete", "captureuploadabort"]) {
    const r = await call(w.env, { op, token: agent, method: "POST", params: { by: FORGED }, body: { upload: "U1", by: FORGED } });
    const [reached] = opCalls(w.env).filter((c) => c.route === op).slice(-1);
    if (r.status !== 200) continue;   /* refused at the door: stronger than the store's fence */
    assert.match(reached.params.by, /^class:ai/, op);
    assert.equal(JSON.stringify(reached).includes("forged-by-caller"), false, `${op}: the forged by never reaches the store`);
    const fenced = await arm(cap, op, { by: reached.params.by }, { sha256: "a".repeat(64), bytes: 5, statement: "s", upload: "U1", parts: [] });
    assert.deepEqual([fenced.ok, fenced.reason], [false, "MEMBER_SESSION_REQUIRED"], op);
  }
  const m = await call(w.env, { op: "captureuploadbegin", token: w.S.ann, method: "POST", params: { by: FORGED }, body: { by: FORGED } });
  assert.equal(m.status, 200);
  assert.equal(opCalls(w.env).filter((c) => c.route === "captureuploadbegin").slice(-1)[0].params.by, MEMBER);
});

test("R72 (parted upload, the founder; capture R113 as amended, fix round 10): the founder's session is admitted to all four parted ops, reaches the store stamped `by` = her session's own (`admin`), never the `by` she forged, and the stamp it reaches capture with begins, puts two parts, completes and aborts as a member's does; the receipt names her (control: an `ai` credential and a binding class still reach the fence as the machines they are)", async () => {
  const ops = ["captureuploadbegin", "captureuploadpart", "captureuploadcomplete", "captureuploadabort"];
  const w = world({ answer: (c) => (ops.includes(c.route) ? new Response(JSON.stringify({ ok: true, result: { ok: true } })) : null) });
  const stamped = {};
  for (const op of ops) {
    const r = await call(w.env, { op, token: w.S.founder, method: "POST", params: { by: FORGED, upload: "U1", index: "0", sha256: "a".repeat(64) }, body: { upload: "U1", by: FORGED } });
    assert.equal(r.status, 200, `${op} admits the founder's session`);
    const [reached] = opCalls(w.env).filter((c) => c.route === op).slice(-1);
    assert.notEqual(reached.params.by, FORGED, `${op}: the forged by never reaches the store`);
    /* a part's body is its raw bytes, read by no one at the door; the other three carry a JSON body, whose `by` is deleted */
    if (op !== "captureuploadpart") assert.equal(JSON.stringify(reached).includes("forged-by-caller"), false, op);
    stamped[op] = reached.params.by;
  }
  assert.deepEqual([...new Set(Object.values(stamped))].length, 1, "one stamp for the four ops");
  const by = stamped.captureuploadbegin;
  assert.equal(by, "admin", "the founder's session names her as the session does");
  const cap = await setup();
  const file = varied(PARTED_PART_BYTES + 1000, 13), whole = sha(file);
  const b = await arm(cap, "captureuploadbegin", { by }, { sha256: whole, bytes: file.length, statement: STATEMENT, name: "big.bin" });
  assert.equal(b.ok, true, JSON.stringify(b).slice(0, 300));
  const ps = [file.subarray(0, PARTED_PART_BYTES), file.subarray(PARTED_PART_BYTES)];
  for (let i = 0; i < 2; i++) {
    const r = await arm(cap, "captureuploadpart", { by, upload: b.upload, index: String(i), sha256: sha(ps[i]), declared: String(ps[i].length) }, ps[i]);
    assert.equal(r.ok, true, `part ${i}: ${JSON.stringify(r).slice(0, 200)}`);
  }
  const done = await arm(cap, "captureuploadcomplete", { by }, { upload: b.upload, parts: ps.map(sha) });
  assert.equal(done.ok, true, JSON.stringify(done).slice(0, 300));
  assert.deepEqual(cap.c.captureAccountsOf(whole).actors.map((a) => a.actor), ["admin"], "the receipt names the founder");
  const second = await arm(cap, "captureuploadbegin", { by }, { sha256: sha(varied(PARTED_PART_BYTES + 5, 14)), bytes: PARTED_PART_BYTES + 5, statement: STATEMENT });
  const gone = await arm(cap, "captureuploadabort", { by }, { upload: second.upload });
  assert.deepEqual([gone.ok, gone.aborted], [true, true], "the founder's own upload aborts");
  for (const machine of ["class:probe", "class:ai/agent-ann"]) {
    const r = await arm(cap, "captureuploadbegin", { by: machine }, { sha256: whole, bytes: file.length, statement: STATEMENT });
    assert.deepEqual([r.ok, r.reason], [false, "MEMBER_SESSION_REQUIRED"], machine);
  }
});
