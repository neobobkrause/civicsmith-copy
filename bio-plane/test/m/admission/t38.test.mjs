/* admission: T38-24 (N792; K2247, K2300, K2318) — with no `KNOCK_FINGERPRINT_KEY` binding, `sourceOf` answers the
   fingerprint the store makes under the doorbell's instance key (its R12; capture R56 until T43, K2708), asked through
   `doorwindow` with `count: false`, so `setpassword`'s source (sourceOf's, control-plane R68) equals `login`'s (the
   window's, doorWindowGate) with or without the binding. Driven at the module's interface over the store side's real
   SQLite table. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { A, O, W, doAnswer, makeEnv, storeWorld, bridged } from "./harness.mjs";

const { OPS } = O;
const T0 = Date.UTC(2026, 9, 8, 12, 0, 0);
const reqFrom = (address) => new Request("https://plane.example/api", {
  method: "POST", headers: address === undefined ? {} : { "cf-connecting-ip": address } });
const quiet = async (fn) => {
  const warned = [];
  const real = console.warn;
  console.warn = (...a) => warned.push(a.join(" "));
  try { return { out: await fn(), warned }; } finally { console.warn = real; }
};

test("R21 (T38, both arms): for one address sourceOf equals the window's source — login's (doorWindowGate) and setpassword's (sourceOf) are one source — with the key bound (made in the Worker, no store asked) and unbound (the store's fingerprint under the instance key, asked by one POST to bio's doorwindow with count: false, the address in its body only), and the count is unchanged", async () => {
  const addrs = ["203.0.113.9", "2001:db8::1", "198.51.100.4"];
  for (const key of [null, "bound-key-0123"]) {
    /* the store's env and the Worker's hold the same binding, or neither does (the installer sets both or none) */
    const w = storeWorld({ env: key ? { KNOCK_FINGERPRINT_KEY: key } : {} });
    const env = bridged(w, { env: key ? { KNOCK_FINGERPRINT_KEY: key } : {} });
    for (const addr of addrs) {
      const fp = await w.doorbell.sourceFingerprint(addr);
      /* login: the window's source, counted once */
      const login = await A.doorWindowGate({ req: reqFrom(addr), env, spec: OPS.login, doAnswer, now: T0 });
      assert.equal(login.source, fp, `${key ? "bound" : "unbound"}: the window's source is the doorbell's fingerprint`);
      const before = JSON.stringify(w.rows());
      /* setpassword: sourceOf's, the same source, nothing counted */
      env.calls.length = 0;
      const set = await A.sourceOf(reqFrom(addr), env);
      assert.equal(set, login.source, `${key ? "bound" : "unbound"}/${addr}: setpassword's source is login's`);
      assert.match(set, /^[0-9a-f]{32}$/);
      assert.equal(set.includes(addr), false);
      assert.equal(JSON.stringify(w.rows()), before, "the count is unchanged");
      if (key) assert.equal(env.calls.length, 0, "bound: made in the Worker, no store asked");
      else {
        assert.deepEqual(env.calls.map((c) => [c.ns, c.route, c.method, c.href, c.body]),
                         [["bio", "doorwindow", "POST", "http://do/doorwindow", { address: addr, count: false }]]);
        assert.equal(env.calls[0].href.includes(addr), false, "the address is in the body, never the store request's address");
      }
    }
    /* negative control: two addresses are two sources */
    assert.notEqual(await A.sourceOf(reqFrom(addrs[0]), env), await A.sourceOf(reqFrom(addrs[2]), env));
    /* no address stated: the one shared source of its own, the store not asked */
    env.calls.length = 0;
    for (const r of [reqFrom(undefined), reqFrom(""), null, {}])
      assert.equal(await A.sourceOf(r, env), A.UNSTATED_SOURCE);
    assert.equal(env.calls.length, 0);
  }
  /* a full window: login is refused, and sourceOf still answers the source without counting or refusing */
  const w = storeWorld();
  const env = bridged(w);
  const addr = "203.0.113.50";
  for (let i = 0; i < 300; i++) await A.doorWindowGate({ req: reqFrom(addr), env, spec: OPS.login, doAnswer, now: T0 + i });
  assert.equal((await A.doorWindowGate({ req: reqFrom(addr), env, spec: OPS.login, doAnswer, now: T0 + 400 })).refusal.status, 429);
  const full = JSON.stringify(w.rows());
  assert.equal(await A.sourceOf(reqFrom(addr), env), await w.doorbell.sourceFingerprint(addr));
  assert.equal(JSON.stringify(w.rows()), full);
});

test("R21 (T38, the store side): doorwindow with count exactly false answers { source } alone — doorbell R12's fingerprint, or the shared source with no address — and reads, counts, refuses and writes nothing (no row added, no passed bucket dropped); any other count is counted as before", async () => {
  for (const env of [{}, { KNOCK_FINGERPRINT_KEY: "k-1" }]) {
    const w = storeWorld({ env });
    const addr = "203.0.113.9";
    const fp = await w.doorbell.sourceFingerprint(addr);
    /* a passed bucket of another source, which a counting request would drop */
    w.sql.exec(`INSERT INTO ${W.DOOR_WINDOW_TABLE} (source, bucket, count) VALUES (?, ?, ?)`, "old", 1, 5);
    const before = JSON.stringify(w.rows());
    for (let i = 0; i < 400; i++)
      assert.deepEqual(await w.ops({ address: addr, now: T0 + i, count: false }).doorwindow(), { source: fp });
    assert.deepEqual(await w.ops({ count: false }).doorwindow(), { source: W.UNSTATED_SOURCE });
    assert.deepEqual(await w.ops({ address: " ", count: false }).doorwindow(), { source: W.UNSTATED_SOURCE });
    assert.equal(JSON.stringify(w.rows()), before, "nothing written or dropped");
    /* negative control: any other `count` (absent, true, a string, 0, null) is a counted request */
    for (const count of [undefined, true, "false", 0, null]) {
      const r = await w.ops({ address: addr, now: T0, ...(count === undefined ? {} : { count }) }).doorwindow();
      assert.deepEqual(r, { source: fp, refused: false }, String(count));
    }
    const rows = w.rows();
    assert.deepEqual(rows, [{ source: fp, bucket: Math.floor(T0 / 600000), count: 5 }], "counted five times; the passed bucket dropped");
  }
});

test("R21 (T38, no answer): when the store cannot be asked or does not answer, sourceOf answers null, never throws, and names the failure in the log by correlation id only", async () => {
  const addr = "203.0.113.77";
  const corr = "0123abcd-0123-4567-89ab-0123456789ab";
  const answering = (body, status = 200) => makeEnv({ answer: (c) => (c.route === "doorwindow" ? new Response(body, { status }) : null) });
  const envs = [
    {}, null, undefined,                                                                         /* no store */
    { STORE: { idFromName: (n) => n, get: () => ({ fetch: () => { throw new Error("down"); } }) } },
    { STORE: { idFromName: (n) => n, get: () => ({ fetch: async () => { throw new Error("down"); } }) } },
    answering("<html>"),
    answering(JSON.stringify({ ok: false, reason: "STORE_INTERNAL_ERROR", correlation: corr }), 500),
    answering(JSON.stringify({ ok: false, reason: "unknown op: doorwindow" }), 404),
    answering(JSON.stringify({ ok: true, result: {} })),
    answering(JSON.stringify({ ok: true, result: { source: "" } })),
    answering(JSON.stringify({ ok: "true", result: { source: "abc" } })),
    answering(JSON.stringify({ ok: false, correlation: `${addr} leaked` }), 500),
  ];
  const { out, warned } = await quiet(async () => {
    const got = [];
    for (const env of envs) got.push(await A.sourceOf(reqFrom(addr), env));
    return got;
  });
  assert.deepEqual(out, envs.map(() => null));
  assert.equal(warned.length, envs.length);
  assert.ok(warned[6].includes(corr), "the store's correlation id is named");
  for (const line of warned) {
    assert.equal(line.includes(addr), false, "the log names no address");
    assert.match(line, /correlation (none|[0-9a-f-]{36})\)$/);
  }
  /* negative control: an answering store's source is answered, and nothing is logged */
  const ok = await quiet(() => A.sourceOf(reqFrom(addr), answering(JSON.stringify({ ok: true, result: { source: "f".repeat(32) } }))));
  assert.deepEqual([ok.out, ok.warned], ["f".repeat(32), []]);
});
