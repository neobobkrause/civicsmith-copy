/* agent-model R35 — the path's health, read from the circuit (R53) and the entry's lifecycle, at the module's interface.
 *
 * The entry is `ai-catalogue`'s own fixture entry (its made-up provider `fakeco`), built by that module's test builder
 * when the test runs; the circuit handle is a plain map the caller supplies, as R53 says. The clock is pinned. */
import { test } from "node:test";
import assert from "node:assert/strict";

import { entry } from "../../bio-plane/test/m/ai-catalogue/fixture.mjs";
import { health, pathSource, circuitRecord, circuitAdmit, circuitReset, BREAKER_FAILURES, BREAKER_COOLDOWN_MS, HEALTH_STATES }
  from "../src/health.mjs";

const T0 = Date.parse("2026-11-05T10:00:00Z");
const handle = () => { const m = new Map(); return { m, get: (k) => m.get(k), put: (k, v) => { m.set(k, v); } }; };
const world = () => {
  const fake = entry("fake-one");
  const entries = new Map([[fake.entry_id, fake]]);
  return { fake, circuit: handle(), entryOf: (id) => entries.get(id) || null, account: { account_id: "acct-1", level: "member" } };
};

test("R35 after BREAKER_FAILURES counted failures on a fake entry, health reads open with a reset_at, and the path source says so; a never-called pair reads unknown beside the catalogue's uptime evidence; control: a success after the cooldown reads ok", async () => {
  const w = world();
  const opts = (t) => ({ circuit: w.circuit, entryOf: w.entryOf, now: t });

  const never = await health(w.account, w.fake.entry_id, opts(T0));
  assert.equal(never.state, "unknown");
  assert.equal(never.since, null);
  assert.deepEqual(never.uptime_evidence, w.fake.characterization.CH9);

  for (let i = 0; i < BREAKER_FAILURES - 1; i++) await circuitRecord(w.circuit, w.account, w.fake.entry_id, "overload", { now: T0 + i });
  assert.notEqual((await health(w.account, w.fake.entry_id, opts(T0 + 10))).state, "open", "one fewer than the bound leaves it closed");
  await circuitRecord(w.circuit, w.account, w.fake.entry_id, "timeout", { now: T0 + 10 });

  const open = await health(w.account, w.fake.entry_id, opts(T0 + 20));
  assert.equal(open.state, "open");
  assert.equal(open.reset_at, new Date(T0 + 10 + BREAKER_COOLDOWN_MS).toISOString());
  assert.equal(open.last_error_class, "timeout");
  assert.deepEqual(await pathSource(opts(T0 + 20))({ account_id: "acct-1", entry_id: w.fake.entry_id }),
    { state: "open", reset_at: open.reset_at });
  assert.equal((await circuitAdmit(w.circuit, w.account, w.fake.entry_id, { now: T0 + 20 })).class, "circuit_open");

  /* control: after the cooldown the pair reads half_open, one probe is admitted, and its success reads ok */
  const after = T0 + 10 + BREAKER_COOLDOWN_MS;
  assert.equal((await health(w.account, w.fake.entry_id, opts(after))).state, "half_open");
  assert.deepEqual(await circuitAdmit(w.circuit, w.account, w.fake.entry_id, { now: after }), { admit: true, probe: true });
  await circuitRecord(w.circuit, w.account, w.fake.entry_id, null, { now: after + 1 });
  const ok = await health(w.account, w.fake.entry_id, opts(after + 2));
  assert.equal(ok.state, "ok");
  assert.deepEqual(await pathSource(opts(after + 2))({ account_id: "acct-1", entry_id: w.fake.entry_id }), { state: "ok" });
});

test("R35 the entry's lifecycle and the circuit's marks read as their states, every answer is one of the closed set, and health never throws, makes no call and carries no secret", async () => {
  const w = world();
  const secret = "sk-sentinel-SECRET-1234567890";
  const opts = { circuit: w.circuit, entryOf: w.entryOf, now: T0 };
  const fetchWas = globalThis.fetch;
  let fetched = 0;
  globalThis.fetch = async () => { fetched += 1; throw new Error("no call"); };
  try {
    const acct = { account_id: "acct-2", level: "member", key: secret };
    await circuitRecord(w.circuit, acct, w.fake.entry_id, "auth", { now: T0 });
    const auth = await health(acct, w.fake.entry_id, opts);
    assert.equal(auth.state, "auth_failed");
    assert.equal((await circuitAdmit(w.circuit, acct, w.fake.entry_id, { now: T0 })).admit, false);
    assert.ok(!JSON.stringify(auth).includes(secret) && ![...w.circuit.m.values()].some((v) => JSON.stringify(v).includes(secret)));

    await circuitRecord(w.circuit, "acct-3", w.fake.entry_id, "model_gone", { now: T0 });
    assert.equal((await health("acct-3", w.fake.entry_id, opts)).state, "retired");
    await circuitRecord(w.circuit, "acct-4", w.fake.entry_id, "payer_unverified", { now: T0 });
    assert.equal((await health("acct-4", w.fake.entry_id, opts)).state, "payer_unverified");
    await circuitReset(w.circuit, "acct-4", w.fake.entry_id);
    assert.equal((await health("acct-4", w.fake.entry_id, opts)).state, "unknown", "a cleared mark reads unknown again");

    /* a provider's limit and a rejected request leave the circuit as it is (R52, R50) */
    for (let i = 0; i < BREAKER_FAILURES + 1; i++) await circuitRecord(w.circuit, "acct-5", w.fake.entry_id, "provider_limit", { now: T0 });
    assert.equal((await health("acct-5", w.fake.entry_id, opts)).state, "unknown");

    const gone = entry("fake-gone", { lifecycle: "retired" });
    assert.equal((await health("acct-1", gone.entry_id, { ...opts, entryOf: () => gone })).state, "retired");

    assert.equal((await health("acct-1", w.fake.entry_id, {})).state, "unknown", "no handle: unknown");
    const throwing = { get() { throw new Error("boom"); }, put() { throw new Error("boom"); } };
    assert.equal((await health("acct-1", w.fake.entry_id, { circuit: throwing, entryOf: () => { throw new Error("x"); } })).state, "unknown");
    assert.equal((await health(undefined, undefined)).state, "unknown");
    assert.equal((await circuitAdmit(undefined, "a", "b")).admit, true, "no handle: no circuit opens");
    for (const s of [auth.state, "retired", "payer_unverified", "unknown"]) assert.ok(HEALTH_STATES.includes(s));
    assert.equal(fetched, 0);
  } finally { globalThis.fetch = fetchWas; }
});
