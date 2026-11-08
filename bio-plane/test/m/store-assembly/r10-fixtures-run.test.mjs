/* store-assembly R64, R75 (was plane's `r10-fixtures-run.test.mjs`, moved with the ledger it runs: K5200 item 99 (1); PLANE #62 J64 B6; fix round 10, FIX-L: K4990, K4993, K4995, K5044; `build/plan/fixtures-T51/part-1.md`): THIS MODULE IS THE PROVIDER of four contracts whose users are earlier in the order and cannot import it. Each is stated here
   as DATA (a table of cases) and run through the REAL assembled store of `fixture.mjs`, on the `captureOf(ctx)` surface the composition wires (`registerJob`, `armJobs`, `keepLater`, `owedLater`), reading the row back through the store's
   own `jobrow` route. A user module's hand-built value (`test-support`'s `jobRegistrarStub`, a scripted `keepLater`, `async () => ({ ok: true })` as `owedLater`, a scripted ledger) must equal the real answer; where the real answer
   differs, the real one wins and the user changes (listed in the job record). The cases the real registrar cannot give from any source are not run: `JOB_TABLE_FULL` and `NO_ROOM` (no source gives them; `JOB_NOT_KEPT` is the
   registrar's refusal when it could not keep the row, run below by a table that cannot be written).
   `fixtures-run` lines: one for each user module of a contract; each shows `orphan-run` in the check's list until that user's marker is merged. */
import "../../../src/store-assembly/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { store } from "./fixture.mjs";
import { bucketStandIn } from "../case-carriage/fixture.mjs";
import { captureOf } from "../../../src/capture/index.mjs";
// fixtures-own: harness the shared stub IS the contract this provider test runs (FIX-L): its cases are run against the real registrar and the two are compared
import { jobRegistrarStub } from "../../job-registrar-stub.mjs";

// fixtures-run: test-support job-registrar
// fixtures-run: acquisition job-registrar
// fixtures-run: capture job-registrar
// fixtures-run: doorbell job-registrar
// fixtures-run: file-safety job-registrar
// fixtures-run: extraction job-registrar
// fixtures-run: control-plane job-registrar
// fixtures-run: monitoring job-registrar
// fixtures-run: acquisition keep-later
// fixtures-run: capture keep-later
// fixtures-run: screens-intake owed-later
// fixtures-run: acquisition owed-ledger
// fixtures-run: control-plane owed-ledger

const sha = (b) => createHash("sha256").update(b).digest("hex");
const world = async () => { const x = await store({ env: { CAPTURES: bucketStandIn() } }); x.cap = captureOf(x.ctx); return x; };
const rowOf = async (x, key, kind) => (await x.call(`/jobrow?sha=${encodeURIComponent(key)}&kind=${kind}`)).row;
const D = sha("a capture"), E = sha("another capture"), P1 = sha("part 1"), P2 = sha("part 2");

/* ---- job-registrar: the cases of `jobRegistrarStub` (test-support R27), one row each ---- */
const REFUSALS = [
  ["no entry", null, "JOB_ENTRY_INVALID"],
  ["a string for an entry", "reading", "JOB_ENTRY_INVALID"],
  ["an unknown kind", { kind: "nope", sha: D }, "JOB_KIND_UNKNOWN"],
  ["no kind", { sha: D }, "JOB_KIND_UNKNOWN"],
  ["a session-keyed kind with no session (fetch)", { kind: "fetch" }, "JOB_SESSION_MISSING"],
  ["a session-keyed kind with an empty session (subresources)", { kind: "subresources", session: "" }, "JOB_SESSION_MISSING"],
  ["a digest-keyed kind with no sha", { kind: "reading" }, "JOB_SHA_INVALID"],
  ["a sha that is not a digest", { kind: "reading", sha: "xyz" }, "JOB_SHA_INVALID"],
  ["a digest in capitals", { kind: "scan", sha: D.toUpperCase() }, "JOB_SHA_INVALID"],
];
test("R75 job-registrar: every refusal of the stub is the real registrar's, with its reason, and writes no row", async () => {
  const x = await world();
  for (const [what, entry, reason] of REFUSALS) assert.deepEqual(x.cap.registerJob(entry), { ok: false, reason }, what);
  assert.deepEqual([...x.ctx.storage.sql.exec(`SELECT sha, kind FROM keeps_pending`)], [], "no refusal wrote a row");
});

test("R75 job-registrar: a first registration answers {ok: true, existed: false, state: 'queued'} for each kind, a second {existed: true, state: 'queued'}; idempotent on (sha or session, kind); armJobs resolves", async () => {
  const x = await world();
  const KINDS = ["keep", "reading", "ocr", "subresources", "unpack", "fetch", "scan", "safe_view", "grade", "ingest", "member"], SESSION = ["fetch", "subresources", "member"];
  for (const kind of KINDS) {
    const entry = SESSION.includes(kind) ? { kind, session: `s-${kind}` } : { kind, sha: D, ...(kind === "keep" ? { parts: [P1, P2] } : {}) };
    assert.deepEqual(x.cap.registerJob(entry), { ok: true, existed: false, state: "queued" }, `${kind}: the first registration`);
    assert.deepEqual(x.cap.registerJob(entry), { ok: true, existed: true, state: "queued" }, `${kind}: the second`);
  }
  const n = [...x.ctx.storage.sql.exec(`SELECT COUNT(*) AS n FROM keeps_pending`)][0].n;
  assert.equal(n, KINDS.length, "one row for each (sha or session, kind)");
  await x.ctx.storage.deleteAlarm();
  assert.equal(await x.cap.armJobs(), undefined, "armJobs resolves");
  assert.equal(typeof (await x.ctx.storage.getAlarm()), "number", "and the alarm is armed");
});

test("R75 job-registrar: a second registration updates cursor, owed, detail and parts only when given, never the counters; 'raised' is never lowered; the row reads back whole", async () => {
  const x = await world();
  assert.equal(x.cap.registerJob({ kind: "reading", sha: D, cursor: { next_page: 3 }, owed: 7, detail: { project: "PROJ-1" }, parts: [P1], priority: "raised" }).ok, true);
  x.ctx.storage.sql.exec(`UPDATE keeps_pending SET written=5, skipped=2 WHERE sha=? AND kind='reading'`, D);   /* a reader's progress write, as the stub's `bump` */
  assert.equal(x.cap.registerJob({ kind: "reading", sha: D }).existed, true);
  let r = await rowOf(x, D, "reading");
  assert.deepEqual([r.cursor, r.owed, r.detail, r.parts, r.priority, r.written, r.skipped, r.state], [{ next_page: 3 }, 7, { project: "PROJ-1" }, [P1], "raised", 5, 2, "queued"], "nothing given, nothing changed; the counters kept");
  assert.equal(x.cap.registerJob({ kind: "reading", sha: D, cursor: { next_page: 9 }, owed: 1, detail: { project: "PROJ-2" }, parts: [P2] }).existed, true);
  r = await rowOf(x, D, "reading");
  assert.deepEqual([r.cursor, r.owed, r.detail, r.parts, r.priority, r.written], [{ next_page: 9 }, 1, { project: "PROJ-2" }, [P2], "raised", 5], "what is given is updated; the priority is not lowered; the counters kept");
});

test("R75 job-registrar: a row written inside a transaction that throws is as it was before it (transact); a table that cannot be written answers JOB_NOT_KEPT", async () => {
  const x = await world();
  assert.throws(() => x.ctx.storage.transactionSync(() => { assert.equal(x.cap.registerJob({ kind: "reading", sha: D }).ok, true); throw new Error("the filing died"); }), /the filing died/);
  assert.equal(await rowOf(x, D, "reading"), null, "rolled back with the caller's transaction");
  x.ctx.storage.sql.exec(`DROP TABLE keeps_pending`);
  assert.equal(x.cap.registerJob({ kind: "reading", sha: E }).reason, "JOB_NOT_KEPT", "the refusal when the row could not be kept");
});

/* ---- keep-later ---- */
test("R64 keep-later: keepLater({sha, parts}) answers {ok: true} and holds a `keep` job row with the parts, queued", async () => {
  const x = await world();
  assert.deepEqual(await x.cap.keepLater({ sha: D, parts: [P1, P2] }), { ok: true });
  const r = await rowOf(x, D, "keep");
  assert.deepEqual([r.kind, r.state, r.parts], ["keep", "queued", [P1, P2]]);
  assert.equal(typeof (await x.ctx.storage.getAlarm()), "number", "the alarm is armed");
  assert.deepEqual(await x.cap.keepLater({ sha: D, parts: [P1, P2] }), { ok: true }, "again: the same row");
  assert.equal([...x.ctx.storage.sql.exec(`SELECT COUNT(*) AS n FROM keeps_pending WHERE kind='keep'`)][0].n, 1);
});

/* ---- owed-later and owed-ledger ---- */
test("R64 owed-later: owedLater(entry) answers {ok: true} for an unpack and writes its row (screens-intake's `async () => ({ ok: true })` is this answer)", async () => {
  const x = await world();
  assert.deepEqual(await x.cap.owedLater({ kind: "unpack", sha: D }), { ok: true });
  assert.equal((await rowOf(x, D, "unpack")).state, "queued", "the row is written, not only answered");
});

test("R64 owed-ledger: entries keyed by session (subresources, fetch) or by sha (unpack) answer {ok: true}; a re-registration re-arms the row; a kind or key it does not take answers PENDING_MALFORMED", async () => {
  const x = await world();
  const entries = [{ kind: "subresources", sha: D, session: "s-1" }, { kind: "fetch", session: "s-2" }, { kind: "unpack", sha: E }];
  for (const e of entries) assert.deepEqual(await x.cap.owedLater(e), { ok: true }, JSON.stringify(e));
  assert.equal((await rowOf(x, "s-1", "subresources")).state, "queued");
  assert.equal((await rowOf(x, "s-2", "fetch")).state, "queued");
  assert.equal((await rowOf(x, E, "unpack")).state, "queued");
  /* re-registration re-arms: a row that was backed off is due again, its attempts cleared */
  x.ctx.storage.sql.exec(`UPDATE keeps_pending SET attempts=4, due_at=9999999999999 WHERE sha='s-2' AND kind='fetch'`);
  assert.deepEqual(await x.cap.owedLater({ kind: "fetch", session: "s-2" }), { ok: true });
  const [again] = [...x.ctx.storage.sql.exec(`SELECT attempts, due_at FROM keeps_pending WHERE sha='s-2' AND kind='fetch'`)];
  assert.equal(again.attempts, 0, "attempts cleared");
  assert.ok(again.due_at < 9999999999999, "due again");
  for (const bad of [{ kind: "nope", sha: D }, { kind: "unpack" }, { kind: "fetch" }, { kind: "unpack", sha: "xyz" }, undefined])
    assert.deepEqual(await x.cap.owedLater(bad), { ok: false, reason: "PENDING_MALFORMED" }, JSON.stringify(bad));
});

/* ---- the users' value equals the real answer: the shared stub, case by case ---- */
/* the real registrar's answers for two cases the stub gives differently (the real one wins; test-support's stub changes, reported to BOB in the job record): an entry that is an array is no entry; a `keep` names its parts */
test("R75 job-registrar: a keep with no parts and an entry that is an array are refused JOB_ENTRY_INVALID, writing no row", async () => {
  const x = await world();
  assert.deepEqual(x.cap.registerJob({ kind: "keep", sha: D }), { ok: false, reason: "JOB_ENTRY_INVALID" });
  assert.deepEqual(x.cap.registerJob({ kind: "keep", sha: D, parts: [] }), { ok: false, reason: "JOB_ENTRY_INVALID" });
  assert.deepEqual(x.cap.registerJob(["reading"]), { ok: false, reason: "JOB_ENTRY_INVALID" });
  assert.deepEqual(x.cap.registerJob({ kind: "keep", sha: D, parts: [P1] }), { ok: true, existed: false, state: "queued" });
  assert.deepEqual([...x.ctx.storage.sql.exec(`SELECT COUNT(*) AS n FROM keeps_pending`)][0].n, 1);
});

test("R75 job-registrar: test-support's stub answers what the real registrar answers for each other case of the table (the shared stub is the contract; where they differ the real one wins)", async () => {
  const x = await world(), stub = jobRegistrarStub();
  const cases = [...REFUSALS, ["a keep with parts", { kind: "keep", sha: D, parts: [P1] }], ["a digest-keyed kind given only a session", { kind: "reading", session: "s-1" }],
                 ["a session-keyed first registration", { kind: "fetch", session: "s-9" }], ["a digest-keyed first registration", { kind: "scan", sha: E }],
                 ["a session-keyed second registration", { kind: "fetch", session: "s-9" }]];
  const differ = [];
  for (const [what, entry] of cases) {
    const real = x.cap.registerJob(structuredClone(entry)), fake = stub.registerJob(structuredClone(entry));
    if (JSON.stringify({ ...real, detail: undefined }) !== JSON.stringify({ ...fake, detail: undefined })) differ.push({ what, real, stub: fake });
  }
  assert.deepEqual(differ, [], "the stub's answers are the real ones");
});
