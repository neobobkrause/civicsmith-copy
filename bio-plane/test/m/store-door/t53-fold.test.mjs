/* R20, R21 (T53; N1264, K4599 (a); PL14, PL15; admission R34, R35): the room's RPC `admitted(op, request)` and the cut of a
   combined read's slow read. Over a real record (`record.mjs`), composed with credentials' and instance-setup's own maps
   as `plane` composes them (R1), a signed-in member by credentials' real `login`; the op's spec is op-declarations' `OPS`
   (its `SCREENREAD` for `screenread`), the stamper `store-request`'s `innerRequest`, the screen's reads op-declarations'
   `declareScreenReads` and the answer its `screenReadOf`, each the provider's real code. "The room" is a test double that
   counts the door's calls into it and delegates to `admitted`; the Worker's own route to the store (`env.STORE`) counts
   every fetch that would cross from the Worker to the room. */
import { test } from "node:test";
import assert from "node:assert/strict";
const { record } = await import("./record.mjs");
const { admitted, runWaves, serverTimingOf, SCREENREAD_OP } = await import("../../../src/store-door/fold.mjs");
const { credentialsOf, credentialsOps } = await import("../../../src/credentials/index.mjs");
const { membershipOf } = await import("../../../src/membership/index.mjs");
const { instanceSetupOf, instanceSetupOps } = await import("../../../src/setup.mjs");
const { queueOf } = await import("../../../src/queue/index.mjs");
const { OPS } = await import("../../../src/op-declarations/index.mjs");
const { SCREENREAD, declareScreenReads, screenReadOf, opBudgets } = await import("../../../src/op-declarations/compose.mjs");
const { innerRequest } = await import("../../../src/store-request/index.mjs");
const A = await import("../../../src/admission/index.mjs");
const { doAnswer } = await import("../../../src/answer-envelope/index.mjs");
const { dispatch } = await import("../../../src/store-door/dispatch.mjs");

const specOf = (op) => (op === SCREENREAD_OP ? SCREENREAD : OPS[op]);
const boundOf = (op) => opBudgets()[op].ceiling_ms;

/* the room: the record's store with credentials' and instance-setup's maps; the session reads counted; `slow` names routes
   that never answer (R21) */
async function world({ slow = [] } = {}) {
  const r = await record();
  const C = credentialsOf(r.ctx);
  queueOf(r.ctx).migrate();   /* queue's own tables, as the composition root migrates it (the shared fixture does not route it) */
  await C.claim({ password: "founder-passphrase-1", tokenFp: "fp-1" });
  const m = await membershipOf(r.ctx).memberAdd({ memberId: "bea", cover: "cover of bea", role: "member", capabilities: null, by: "admin" });
  await membershipOf(r.ctx).enroll({ invite: m.invite, handle: "bea", password: "bea-passphrase-x" });
  const signed = await C.login({ handle: "bea", password: "bea-passphrase-x" });
  assert.equal(signed.ok, true, JSON.stringify(signed));
  const sessionReads = [];
  const session = C.session.bind(C);
  C.session = (t, o) => { sessionReads.push(t); return session(t, o); };
  const store = { routes: (url, body, grant) => {
                    const map = { ...credentialsOps(C, url, body, r.env), ...instanceSetupOps(instanceSetupOf(r.ctx), url, body),
                                  ...r.store.routes(url, body, grant) };
                    for (const op of slow) map[op] = () => new Promise(() => {});
                    return map; },
                  membership: r.store.membership };
  /* the Worker's own route to the room: every fetch that would cross is counted, and answered by the room */
  const crossings = [];
  const env = { ...r.env, STORE: { idFromName: (x) => x,
                                   get: () => ({ fetch: (req) => { crossings.push(new URL(req.url).pathname); return dispatch(req, store); } }) } };
  const calls = [];
  const opts = { store, env, specOf, stamp: innerRequest, boundOf, answerOf: screenReadOf,
                 screens: (s) => (screensOf[s] ? declareScreenReads(s, screensOf[s]) : null) };
  const room = { admitted: (op, req, o = {}) => { calls.push(op); return admitted(op, req, { ...opts, ...o }); } };
  const screensOf = {};
  return { r, C, token: signed.token, store, env, room, calls, crossings, sessionReads, screensOf };
}
const asked = (op, token, { method = "GET", body, query = "" } = {}) =>
  new Request(`http://plane.test/api?op=${op}${query}`, { method, headers: token ? { authorization: `Bearer ${token}` } : {},
                                                          ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

test("R20 (T53; N1264, K4599 (a); admission R34): one call to the room resolves the session, judges admission with the row the room holds, stamps and runs the op — `whoami`, `groupidentity`, `bootstrap` and `queue` each make exactly one call to the room and no fetch from the Worker to the room beyond it; the session row is read once, in the room; the answer carries `in_ms`, reported as `do-`/`in-` Server-Timing (control: the same `queue` judged at the door, unfolded, crosses to the room for the session and again for the op)", async () => {
  const w = await world();
  for (const op of ["whoami", "groupidentity", "bootstrap", "queue"]) {
    w.calls.length = 0; w.crossings.length = 0; w.sessionReads.length = 0;
    const out = await w.room.admitted(op, asked(op, w.token, op === "bootstrap" ? { query: "&fp=fp-1" } : {}), op === "whoami" ? { run: false } : {});
    assert.deepEqual(w.calls, [op], `${op}: one call to the room`);
    assert.deepEqual(w.crossings, [], `${op}: nothing else crosses from the Worker to the room`);
    assert.ok(Number.isInteger(out.in_ms) && out.in_ms >= 0, `${op}: in_ms`);
    assert.equal(out.refusal, undefined, `${op}: ${JSON.stringify(out.refusal)}`);
    if (OPS[op].classes === null) {
      assert.deepEqual(w.sessionReads, [], `${op}: a public op reads no session`);
    } else {
      assert.deepEqual(w.sessionReads, [w.token], `${op}: the session read once, in the room`);
      assert.deepEqual([out.caller.cls, out.caller.viaSession, out.caller.member, out.caller.viewer], ["member", true, "bea", "member:bea"]);
    }
    if (op === "whoami") assert.equal(out.answer, undefined, "whoami: the door answers from the caller; no store route runs");
    else {
      const got = await out.answer.json();
      assert.equal(got.ok, true, `${op}: ${JSON.stringify(got).slice(0, 300)}`);
    }
  }
  /* queue's answer is the one the unfolded path gives: the store's own answer to the stamped request */
  const folded = await (await (await w.room.admitted("queue", asked("queue", w.token))).answer).json();
  w.crossings.length = 0; w.sessionReads.length = 0;
  const url = new URL("http://plane.test/api?op=queue");
  const credential = A.presentedCredential({ req: asked("queue", w.token), url });
  const door = await A.admit({ url, env: w.env, op: "queue", spec: OPS.queue, method: "GET", presented: { cred: null }, doAnswer, credential });
  const inner = innerRequest({ op: "queue", url, method: "GET", caller: { ...door.caller, token: w.token } });
  const unfolded = await (await w.env.STORE.get().fetch(new Request(String(inner.url), { headers: inner.headers }))).json();
  assert.deepEqual(w.crossings, ["/session", "/queue"], "control: unfolded, the session and the op each cross");
  assert.deepEqual(folded, unfolded, "the folded answer is the unfolded one");
  assert.equal(serverTimingOf("queue", { do_ms: 12.4, in_ms: 7 }), "do-queue;dur=12, in-queue;dur=7");
  assert.equal(serverTimingOf("screenread", { do_ms: 5, in_ms: 3, times: { q: 2, "bad name": 1, nan: NaN } }),
               "do-screenread;dur=5, in-screenread;dur=3, in-screenread-q;dur=2, in-screenread-bad_name;dur=1");
});

test("R20 (admission R34, R35): refusals through the room equal the door's, code for code — a member asking the root of trust's `export`, and an unknown token; a bearer (no credential) is judged at the door: the room answers `{atDoor: true}` and reads nothing", async () => {
  const w = await world();
  const judgeAtDoor = async (op, token) => {
    const url = new URL(`http://plane.test/api?op=${op}`);
    const credential = A.presentedCredential({ req: asked(op, token), url });
    return A.admit({ url, env: w.env, op, spec: OPS[op], method: "GET", presented: { cred: null }, doAnswer, credential });
  };
  const unknown = "e".repeat(64);
  for (const [op, token] of [["export", w.token], ["queue", unknown]]) {
    const folded = await w.room.admitted(op, asked(op, token));
    const door = await judgeAtDoor(op, token);
    assert.ok(door.refusal, `${op}: the door refuses`);
    assert.deepEqual(folded.refusal, door.refusal, `${op}: the same refusal both ways`);
    assert.equal(folded.answer, undefined, `${op}: nothing runs`);
  }
  w.sessionReads.length = 0;
  const bearer = await w.room.admitted("queue", asked("queue", null));
  assert.deepEqual(bearer, { atDoor: true });
  assert.deepEqual(w.sessionReads, [], "a bearer: no session read in the room");
});

test("R20, R21 (T53; PL14, PL15): `screenread` runs its waves inside the one call — each read judged with the held row (a read the member may not make answers its refusal, the others answer whole), a later wave taking an earlier read's answer — and a read past its declared bound is cut, answered `slow` with the bound, without holding the others", async () => {
  const w = await world({ slow: ["tasks"] });
  /* a read op a member's session is refused, found from the declarations */
  const refusedRead = Object.keys(OPS).find((op) => OPS[op].mutating === false && Array.isArray(OPS[op].classes)
    && !OPS[op].classes.includes("member") && OPS[op].classes.includes("admin"));
  assert.ok(refusedRead, "an administrator's read exists");
  w.screensOf.probe = [
    { name: "q", op: "queue", args: { limit: "5" }, wave: 1 },
    { name: "t", op: "tasks", wave: 1 },
    { name: "x", op: refusedRead, wave: 1 },
    { name: "q2", op: "queue", args: { limit: { from: "q" } }, wave: 2 },
  ];
  w.sessionReads.length = 0;
  const t0 = Date.now();
  const out = await w.room.admitted(SCREENREAD_OP, asked(SCREENREAD_OP, w.token, { query: "&screen=probe" }));
  const took = Date.now() - t0;
  assert.deepEqual(w.calls, [SCREENREAD_OP], "one call to the room");
  assert.deepEqual(w.crossings, [], "no read crosses from the Worker");
  assert.deepEqual(w.sessionReads, [w.token], "the session read once for every read of the screen");
  const got = (await out.answer.json()).result;
  assert.equal(got.reads.q.ok, true, JSON.stringify(got.reads.q));
  assert.equal(got.reads.q2.ok, true, JSON.stringify(got.reads.q2));
  assert.deepEqual(got.reads.t, { ok: false, status: "slow", bound_ms: boundOf("tasks") }, "the slow read is cut with its bound");
  assert.equal(got.reads.x.ok, false);
  assert.equal(got.reads.x.refusal.ok, false, JSON.stringify(got.reads.x));
  assert.deepEqual(Object.keys(out.times).sort(), ["q", "q2", "x"], "each answered read's own time; the cut one has none");
  assert.ok(took < boundOf("tasks") + 1500, `the others were not held past the bound (${took} ms)`);
  assert.deepEqual(got.stamps, { viewer: "member:bea" });
  /* a screen declaring no reads is refused by name, nothing read */
  const none = await w.room.admitted(SCREENREAD_OP, asked(SCREENREAD_OP, w.token, { query: "&screen=nosuchscreen" }));
  assert.equal(none.refusal.body.reason, "UNKNOWN_SCREEN");
});

test("R21 (PL15): `runWaves` cuts a read at its own bound and holds no other read for it — the fast read answers whole, the slow one `slow` with the bound, a later wave's `{from}` argument gets `null` for a cut read (control: a read within its bound answers whole)", async () => {
  const reads = declareScreenReads("cut-probe", [
    { name: "fast", op: "queue", wave: 1 }, { name: "never", op: "tasks", wave: 1 },
    { name: "after", op: "queue", args: { of: { from: "never" }, also: { from: "fast" } }, wave: 2 },
  ]);
  const seen = [];
  const runRead = (r, args) => { seen.push([r.name, args]);
    return r.name === "never" ? new Promise(() => {}) : Promise.resolve({ ok: true, status: 200, body: { from: r.name } }); };
  const t0 = Date.now();
  const { answer, times } = await runWaves(reads, { runRead, boundOf, answerOf: screenReadOf });
  const took = Date.now() - t0;
  assert.ok(took >= boundOf("tasks") - 5 && took < boundOf("tasks") + 500, `nothing waited past the slow read's own bound (${took} ms)`);
  assert.deepEqual(answer.reads.never, { ok: false, status: "slow", bound_ms: boundOf("tasks") });
  assert.deepEqual(answer.reads.fast, { ok: true, status: 200, body: { from: "fast" } });
  assert.deepEqual(answer.reads.after, { ok: true, status: 200, body: { from: "after" } });
  assert.deepEqual(seen.find(([n]) => n === "after")[1], { of: null, also: { from: "fast" } });
  assert.deepEqual(Object.keys(times).sort(), ["after", "fast"]);
});
