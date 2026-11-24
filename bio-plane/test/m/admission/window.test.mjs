/* admission: R21's window, its store side (`window.mjs`: `admissionOf`, `admissionOps`' `doorwindow`, K2038) and its
   Worker side (`sourceOf`, `doorWindowGate`), driven at the module's interface over a real SQLite database
   (node:sqlite) and the doorbell's own fingerprint (its R12). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { A, O, doAnswer, refused, storeWorld, bridged } from "./harness.mjs";

const W = await import("../../../src/admission/window.mjs");
const { OPS } = O;
const PUBLIC = Object.keys(OPS).filter((k) => OPS[k].classes === null);
const GATED = Object.keys(OPS).filter((k) => OPS[k].classes !== null);
const T0 = Date.UTC(2026, 9, 7, 12, 0, 0);   /* a bucket's start: 10-minute buckets divide the hour */

const reqFrom = (address, extra = {}) => new Request("https://plane.example/api", {
  method: "POST", headers: address === undefined ? {} : { "cf-connecting-ip": address }, ...extra });

test("R21 (store side): one window per source over the requests to public ops — at most 300 in any 10 minutes by the two-bucket estimate, refused at ≥ 300 counting nothing, with stated and retryAfter; the fingerprint is doorbell R12's under the same key; rows hold the fingerprint, the bucket and the count only, and are dropped once both buckets have passed; a request with no address is one shared source; the table is admission's own, declared with its classes; doorwindow is a store-internal route with no spec", async () => {
  for (const env of [{ KNOCK_FINGERPRINT_KEY: "bound-key-0123" }, {}]) {
    const w = storeWorld({ env });
    /* declared once, admission's, with record-core R21's classes; the same instance per storage */
    assert.deepEqual(w.declared, [{ module: "admission", entries: [W.DOOR_WINDOW_TABLE, W.SESSION_WINDOW_TABLE].map((name) => ({
      name, purge: "exempt", expunge: "none", export: "never", sight: "group", derive: "stored", version_chain: false })) }]);
    assert.equal(W.admissionOf(w.ctx, { record: w.record }), w.a);
    assert.equal(w.declared.length, 1);
    /* the map serves exactly the one store-internal route, which no spec declares (op-declarations R6) */
    assert.deepEqual(Object.keys(w.ops({})), ["doorwindow"]);
    assert.equal(Object.hasOwn(OPS, "doorwindow"), false);
    const addr = "203.0.113.9", other = "198.51.100.4";
    const fp = await w.doorbell.sourceFingerprint(addr);
    /* 300 admitted in one bucket, the 301st refused, and refused again without being counted */
    for (let i = 0; i < 300; i++) {
      const r = await w.ops({ address: addr, now: T0 + i }).doorwindow();
      assert.deepEqual(r, { source: fp, refused: false }, `request ${i + 1}`);
    }
    for (let k = 0; k < 3; k++) {
      const r = await w.ops({ address: addr, now: T0 + 1000 }).doorwindow();
      assert.equal(r.refused, true);
      assert.deepEqual([r.source, r.stated], [fp, A.DOOR_WINDOW_STATED]);
      assert.ok(Number.isInteger(r.retryAfter) && r.retryAfter >= 599 && r.retryAfter <= 602, String(r.retryAfter));
    }
    assert.deepEqual(w.rows(), [{ source: fp, bucket: Math.floor(T0 / 600000), count: 300 }], "a refused request is not counted");
    /* another source is its own window */
    assert.equal((await w.ops({ address: other, now: T0 + 1000 }).doorwindow()).refused, false);
    /* sliding: halfway into the next bucket the estimate is 150, admitted; at its start, 300, refused */
    assert.equal((await w.ops({ address: addr, now: T0 + 600000 }).doorwindow()).refused, true);
    assert.equal((await w.ops({ address: addr, now: T0 + 900000 }).doorwindow()).refused, false);
    /* both buckets passed: every older row is gone, and the source starts afresh */
    const later = await w.ops({ address: other, now: T0 + 3 * 600000 }).doorwindow();
    assert.equal(later.refused, false);
    const held = w.rows();
    assert.ok(held.every((r) => r.bucket >= Math.floor(T0 / 600000) + 2), JSON.stringify(held));
    /* what a row holds: the fingerprint, the bucket, the count; never the address */
    for (const r of held) assert.deepEqual(Object.keys(r).sort(), ["bucket", "count", "source"]);
    const all = JSON.stringify(w.sql.exec(`SELECT * FROM ${W.DOOR_WINDOW_TABLE}`));
    assert.equal(all.includes(addr) || all.includes(other), false);
    /* no address stated: one shared source of its own, never a digest */
    for (const address of [undefined, null, "", "  ", 7]) {
      const r = await w.ops(address === undefined ? {} : { address, now: T0 + 3 * 600000 }).doorwindow();
      assert.equal(r.source, W.UNSTATED_SOURCE);
    }
    assert.equal(A.UNSTATED_SOURCE, W.UNSTATED_SOURCE);
    assert.doesNotMatch(W.UNSTATED_SOURCE, /^[0-9a-f]{32}$/);
  }
});

test("R21 (Worker side): sourceOf answers doorbell R12's fingerprint of CF-Connecting-IP when the key is bound (unbound, the store's: t38.test.mjs), one shared source when no address is stated, never the address; countryOf is Cloudflare's label", async () => {
  const key = "bound-key-0123";
  const w = storeWorld({ env: { KNOCK_FINGERPRINT_KEY: key } });
  for (const addr of ["203.0.113.9", "2001:db8::1"]) {
    const fp = await A.sourceOf(reqFrom(addr), { KNOCK_FINGERPRINT_KEY: key });
    assert.equal(fp, await w.doorbell.sourceFingerprint(addr), "the same digest as the doorbell's");
    assert.match(fp, /^[0-9a-f]{32}$/);
    assert.equal(fp.includes(addr), false);
    assert.equal(await A.sourceOf(reqFrom(addr), {}), null, "unbound, and no store to ask (t38.test.mjs asks one)");
    assert.equal(await A.sourceOf(reqFrom(addr), { KNOCK_FINGERPRINT_KEY: "" }), null);
  }
  assert.notEqual(await A.sourceOf(reqFrom("203.0.113.9"), { KNOCK_FINGERPRINT_KEY: key }),
                  await A.sourceOf(reqFrom("203.0.113.10"), { KNOCK_FINGERPRINT_KEY: key }));
  for (const r of [reqFrom(undefined), reqFrom(""), null, {}, { headers: { get() { throw new Error("x"); } } }])
    assert.equal(await A.sourceOf(r, { KNOCK_FINGERPRINT_KEY: key }), A.UNSTATED_SOURCE);
});

test("R21 (the gate): every request to a public op, whoever calls and whatever it presents, is asked of its source's window as the first gate, the address in the body and never the address of the store's request; at ≥ 300 it is refused 429 DOOR_RATE_LIMITED (C-38.9) with stated and retryAfter before the op runs; a request to an op that is not public is never counted or refused; a window that cannot be read admits the request, named in the log by correlation id only", async () => {
  const w = storeWorld({ env: { KNOCK_FINGERPRINT_KEY: "k" } });
  const env = bridged(w);
  const addr = "203.0.113.77";
  /* every public op is counted once per request, through one store-internal route */
  for (const op of PUBLIC) {
    env.calls.length = 0;
    const r = await A.doorWindowGate({ req: reqFrom(addr), env, op, spec: OPS[op], doAnswer, now: T0 });
    assert.equal(r.refusal, undefined, op);
    assert.equal(r.source, await w.doorbell.sourceFingerprint(addr), op);
    assert.equal(env.calls.length, 1, op);
    const [c] = env.calls;
    assert.deepEqual([c.ns, c.route, c.method, c.href, c.body.address], ["bio", "doorwindow", "POST", "http://do/doorwindow", addr], op);
  }
  /* a gated op is never counted or refused, whatever is presented */
  env.calls.length = 0;
  for (const op of GATED) assert.deepEqual(await A.doorWindowGate({ req: reqFrom(addr), env, op, spec: OPS[op], doAnswer, now: T0 }), { source: null });
  assert.deepEqual(await A.doorWindowGate({ req: reqFrom(addr), env, op: "nosuch", spec: undefined, doAnswer }), { source: null });
  assert.equal(env.calls.length, 0);
  /* fill the window: the request that meets 300 is refused, as the gate's own refusal */
  const fill = storeWorld({ env: { KNOCK_FINGERPRINT_KEY: "k" } });
  const env2 = bridged(fill);
  for (let i = 0; i < 300; i++)
    assert.equal((await A.doorWindowGate({ req: reqFrom(addr), env: env2, spec: OPS.login, doAnswer, now: T0 + i })).refusal, undefined);
  const r = await A.doorWindowGate({ req: reqFrom(addr), env: env2, spec: OPS.invitelook, doAnswer, now: T0 + 400 });
  const body = refused(r, 429, "DOOR_RATE_LIMITED", "C-38.9", [addr]);
  assert.equal(body.stated, "at most 300 requests from one source in any 10 minutes");
  assert.ok(Number.isInteger(body.retryAfter) && body.retryAfter > 500, String(body.retryAfter));
  /* negative control: another source is admitted at the same moment */
  assert.equal((await A.doorWindowGate({ req: reqFrom("198.51.100.1"), env: env2, spec: OPS.login, doAnswer, now: T0 + 400 })).refusal, undefined);
  /* fail open: an unreadable answer, the store's catch with its correlation id, a throwing store, no env */
  const corr = "0123abcd-0123-4567-89ab-0123456789ab";
  const warned = [];
  const realWarn = console.warn;
  console.warn = (...a) => warned.push(a.join(" "));
  try {
    const silent = [bridged(fill, { answer: () => new Response("<html>") }),
                    bridged(fill, { answer: () => new Response(JSON.stringify({ ok: false, correlation: corr }), { status: 500 }) }),
                    { STORE: { idFromName: (n) => n, get: () => ({ fetch: () => { throw new Error("down"); } }) } }, null];
    for (const e of silent)
      assert.deepEqual(await A.doorWindowGate({ req: reqFrom(addr), env: e, spec: OPS.login, doAnswer, now: T0 + 400 }), { source: null });
  } finally { console.warn = realWarn; }
  assert.equal(warned.length, 4);
  assert.ok(warned[1].includes(corr));
  for (const line of warned) assert.equal(line.includes(addr), false, "the log names no address");
});
