/* The provider notices of attempt 4 (7 Nov 2026), each confirmed at this module's interface over the provider's real code:
   scheduler PR 748 changed `Scheduler.listenTo`, which this module never calls (it registers its consumers through
   `register` and arms through `arm`); public-read PR 642 changed its source, and the group-identity registration and the
   stake setting this module hands it (R77, R78) still read through. No code of this module changed for either. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boot, providers } from "./fixture.mjs";
import { PublicRead, DECLARED_STAKE_SETTING } from "../../../src/public-read/index.mjs";
import { DECLARED_STAKE_SETTING as MINE } from "../../../src/setup.mjs";

test("scheduler:748 this module's start registers its consumers with the real Scheduler through register and calls no listenTo (control: a scheduler whose listenTo throws starts it the same)", async () => {
  const src = ["setup.mjs", "setup-fleet.mjs", "livefire.mjs"].map((f) => readFileSync(new URL(`../../../src/${f}`, import.meta.url), "utf8")).join("\n");
  assert.equal(/\blistenTo\s*\(/.test(src), false, "no call of listenTo");
  const { Scheduler } = await import("../../../src/scheduler/index.mjs");
  const kv = new Map(); let alarm = null;
  const store = { async getAlarm() { return alarm; }, async setAlarm(t) { alarm = t; }, async deleteAlarm() { alarm = null; },
                  async get(k) { return kv.get(k); }, async put(k, v) { kv.set(k, v); } };
  const idle = new Proxy({}, { get: () => new Proxy({}, { get: () => () => null }) });
  const scheduler = new Scheduler({ storage: store, env: {}, owners: idle });
  const calls = [];
  const watched = new Proxy(scheduler, { get: (t, k) => (typeof t[k] === "function" ? (...a) => { calls.push(k); return t[k](...a); } : t[k]) });
  const b = await boot({ env: { INSTANCE_NAME: "river-town" }, prov: { ...providers(), scheduler: watched } });
  assert.equal(b.started.consumer.ok, true, JSON.stringify(b.started.consumer));
  assert.ok(calls.includes("register"));
  assert.equal(calls.includes("listenTo"), false);
  const throwing = new Proxy(scheduler, { get: (t, k) => (k === "listenTo" ? () => { throw new Error("listenTo changed"); } : typeof t[k] === "function" ? t[k].bind(t) : t[k]) });
  const c = await boot({ env: { INSTANCE_NAME: "river-town" }, prov: { ...providers(), scheduler: throwing } });
  assert.equal(c.started.ok, true);
});

test("public-read:642 through the real public-read, after its change: groupFields answers this module's identity and the stake declaredStakeSet records, under the one setting name both modules hold", async () => {
  assert.equal(MINE, DECLARED_STAKE_SETTING);
  const prov = providers();
  const first = await boot({ env: { INSTANCE_NAME: "river-town" }, prov, more: { publicRead: null } });
  const pr = new PublicRead({ storage: first.st, publication: {}, docket: {}, record: () => first.record });
  const w = await boot({ st: first.st, prov, more: { publicRead: pr } });
  assert.deepEqual(w.started.identity, { ok: true });
  w.m.groupNameSet({ name: "River Town Tenants", by: "admin" });
  assert.equal(w.m.declaredStakeSet({ stake: "We rent in the buildings we report on.", by: "admin" }).ok, true);
  const f = pr.groupFields();
  assert.deepEqual([f.group, f.name, f.stake], ["river-town", "River Town Tenants", "We rent in the buildings we report on."]);
  /* control: cleared, the stake reads not declared */
  w.m.declaredStakeSet({ stake: null, by: "admin" });
  assert.equal(pr.groupFields().stake, null);
});
