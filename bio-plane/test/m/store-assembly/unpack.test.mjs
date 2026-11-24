/* store-assembly's copy of plane's test of this name (K624: by copy). plane (K1951, K2042, K2046, K2051): the daemon's drain of capture's `archive-unpack` events, driven on the Durable
   Object class: once through the scheduler's whole alarm (`onAlarm(now)`, scheduler R4), where `tasks`' drain leaves
   the kind alone (its T35-77 filter), and in detail as the scheduler asks the consumer (taken from its registry, R8,
   and asked `due`, `wake` and `tick` as `onAlarm` asks them). The object's loopback `SELF` is a stand-in for the
   Worker that records each request and answers as scripted. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { store } from "./fixture.mjs";
import { archiveNotHeld } from "../acquisition/fixtures.mjs";            /* acquisition's published refusal of an archive it does not hold, made by its real `unpack` */
import { storeSilentParsed } from "../answer-envelope/fixtures.mjs";    /* answer-envelope's published 502 STORE_DID_NOT_ANSWER, made by its real helper */
import { captureOf } from "../../../src/capture/index.mjs";
import { schedulerOf } from "../../../src/scheduler/index.mjs";
import { ARCHIVE_UNPACK, UNPACK_BACKSTOP_MS, UNPACK_RETRY_LIMIT, unpackDueAt, unpackOutcome } from "../../../src/store-assembly/unpack.mjs";

const A = "a".repeat(64), B = "b".repeat(64), C = "c".repeat(64);
const T0 = Date.parse("2026-10-07T12:00:00Z");
const silent = async () => { const r = await storeSilentParsed("unpack"); return [r.status, r.body]; };

/* A plane whose SELF answers each archive as `answers[sha]` says: [status, body], or "throw". */
async function world({ answers = {}, self = true, daemon = "dmn-unpack" } = {}) {
  const seen = [];
  const env = { ...(daemon ? { DAEMON_TOKEN: daemon } : {}) };
  if (self) env.SELF = { fetch: async (req) => {
    const body = await req.json();
    seen.push({ url: req.url, method: req.method, auth: req.headers.get("authorization"), body });
    const a = answers[body.archiveSha] ?? [200, { ok: true, result: { unpacked: 1 } }];
    if (a === "throw") throw new Error("unreachable");
    return new Response(JSON.stringify(a[1]), { status: a[0], headers: { "content-type": "application/json" } });
  } };
  const x = await store({ env });
  const cap = captureOf(x.ctx);
  for (const sha of [A, B, C]) assert.equal((await cap.taskEnqueue({ kind: ARCHIVE_UNPACK, captureSha: sha, at: "2026-10-07T11:00:00Z" })).ok, true);
  const left = () => cap.taskEvents({ kind: ARCHIVE_UNPACK }).map((e) => [e.captureSha, e.attempts]);
  /* the consumer as the scheduler holds it, asked as `onAlarm` asks it: `due` first, and `tick` only when it is due */
  const c = schedulerOf(x.ctx, x.env).registry(null).find((r) => r.name === ARCHIVE_UNPACK);
  assert.ok(c, "the composition root registered the consumer");
  /* scheduler R27: a registered consumer's due, wake and tick may answer a promise, each awaited */
  const alarm = async (now) => ((await c.due(now)) === null ? {} : await c.tick(now));
  return { ...x, seen, left, consumer: c, alarm };
}

test("K2046: on the alarm each archive-unpack event is asked of the Worker as op=unpack through SELF, the daemon's credential in the Authorization header and the archive in the body; done and refused-for-good events leave capture's queue, a failure is an attempt", async () => {
  const x = await world({ answers: { [B]: [409, await archiveNotHeld()], [C]: await silent() } });
  assert.ok(schedulerOf(x.ctx).consumers().includes(ARCHIVE_UNPACK), "registered with the scheduler");
  assert.deepEqual([x.consumer.key, x.consumer.module], ["archiveunpack", "plane"]);
  assert.equal(await x.consumer.wake(T0), T0, "an event waiting and never tried wants a wake now");
  const r = await x.alarm(T0);
  assert.deepEqual(x.seen.map((s) => [s.url, s.method, s.auth, s.body.archiveSha]),
    [A, B, C].map((sha) => ["https://self/api/?op=unpack", "POST", "Bearer dmn-unpack", sha]));
  for (const s of x.seen) {
    assert.ok(!s.url.includes("dmn-unpack"), "never the credential in the address (admission R20)");
    assert.deepEqual(Object.keys(s.body), ["archiveSha"], "no project: the door promotes into none");
  }
  assert.deepEqual([r.archiveunpack.asked, r.archiveunpack.removed, r.archiveunpack.retried], [3, 2, 1]);
  assert.deepEqual(x.left(), [[C, 1]], "the 5xx stays, tried once; the done and the 4xx-refused are gone");
  /* the next try waits the back-off: not due before T0 + BACKSTOP, due then */
  const before = await x.alarm(T0 + UNPACK_BACKSTOP_MS - 2000);
  assert.equal(before.archiveunpack, undefined, "nothing due yet");
  assert.equal(x.seen.length, 3);
});

test("K2046 (tasks R18's back-off): an event that keeps failing is retried at last try + BACKSTOP × 2^(a−1), and at the retry limit wants no wake; an unreachable Worker and a 429 are attempts", () => {
  const now = T0;
  assert.equal(unpackDueAt({ attempts: 0 }, now), now);
  assert.equal(unpackDueAt({ attempts: 1, lastTry: "2026-10-07T12:00:00Z" }, now), T0 + UNPACK_BACKSTOP_MS);
  assert.equal(unpackDueAt({ attempts: 3, lastTry: "2026-10-07T12:00:00Z" }, now), T0 + UNPACK_BACKSTOP_MS * 4);
  assert.equal(unpackDueAt({ attempts: UNPACK_RETRY_LIMIT, lastTry: "2026-10-07T12:00:00Z" }, now), null);
  assert.deepEqual([[200, { ok: true }], [200, { ok: false }], [400, {}], [404, {}], [408, {}], [429, {}], [500, {}], [0, null]]
    .map(([s, b]) => unpackOutcome(s, b)), ["remove", "attempt", "remove", "remove", "attempt", "attempt", "attempt", "attempt"]);
});

test("K2046 negative controls: without SELF or without DAEMON_TOKEN the drain calls nothing and wants no wake; an unreachable Worker leaves the event, tried", async () => {
  for (const opts of [{ self: false }, { daemon: null }]) {
    const x = await world(opts);
    const r = await x.alarm(T0);
    assert.equal(r.archiveunpack, undefined, "not due: not configured");
    assert.equal(x.seen.length, 0);
    assert.deepEqual(x.left().map(([s]) => s), [A, B, C]);
  }
  const y = await world({ answers: { [A]: "throw", [B]: "throw", [C]: "throw" } });
  const r = await y.alarm(T0);
  assert.equal(r.archiveunpack.retried, 3);
  assert.deepEqual(y.left(), [[A, 1], [B, 1], [C, 1]]);
});

test("K2051: through the scheduler's whole alarm, tasks' drain leaves archive-unpack events to this drain, which asks each of the Worker once and empties the queue of the done", async () => {
  const x = await world({ answers: { [C]: await silent() } });
  const r = await schedulerOf(x.ctx, x.env).onAlarm(T0);
  assert.deepEqual(x.seen.map((s) => s.body.archiveSha), [A, B, C], "each event reached the Worker: none was taken by task-drain");
  assert.deepEqual([r.archiveunpack.asked, r.archiveunpack.removed, r.archiveunpack.retried], [3, 2, 1]);
  assert.deepEqual(x.left(), [[C, 1]]);
  assert.ok(r.nextAt !== null && r.nextAt >= T0 + UNPACK_BACKSTOP_MS, "the alarm is re-armed for the retry's back-off, not sooner");
});
