/* plane R95 (fix round 7, G83; K4746, K4747, K4752; runtime-limits R27, R28; review2 D4, G1): THE TEAM'S ROOM, OBTAINED ONLY THROUGH THE ONE HELPER, AND A RETIRED ROOM INERT.
   Every `get()` the plane's paths make carries the allowed `STORE_LOCATION` as `{locationHint}` and names the room `bio~g<n>` / `scratch~g<n>` under `STORE_GENERATION` n >= 2
   (the plane's own sites: the watchdog, `ask`, the draft door, `gatedOp`; the Worker as a whole on workerd, through a recording proxy over the real binding, which also
   covers the sites the other owners re-point: admission's window, control-plane's forwards, instance-setup's `selftest` and `livefire`). With neither binding every call is today's, one argument.
   `#ownNamespace` answers the logical name inside a generation-2 room, so every `store=`, evidence prefix and published prefix is unchanged. A room of another generation is inert.
   The sites outside this module's paths are other jobs' and stay RED BY NAME in the Worker-wide cases until they merge. */
import "../../../src/store-assembly/register.mjs";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Miniflare, kCurrentWorker } from "miniflare";
import { store } from "./fixture.mjs";
import { multipartBucket } from "../record-core/storage.mjs";
import { recordOf } from "../../../src/record-core/index.mjs";
import { watchdog } from "../../../src/plane/watchdog.mjs";
import { askOp, actionDraftOp } from "../../../src/store-assembly/ask.mjs";
import { gatedOp } from "../../../src/plane/door.mjs";

/* ---- the plane's own sites, over a recording namespace ---- */
const recorder = (extra = {}) => {
  const calls = [];
  const stub = { watchdog: async () => ({ ok: true }), ask: async () => new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } }),
                 draft: async () => new Response(JSON.stringify({ ok: false, reason: "X" }), { status: 400, headers: { "content-type": "application/json" } }),
                 fetch: async () => new Response(JSON.stringify({ ok: true, result: {} }), { headers: { "content-type": "application/json" } }) };
  const STORE = { idFromName: (name) => ({ name }), get: (id, ...rest) => { calls.push({ name: id.name, argc: 1 + rest.length, options: rest[0] }); return stub; } };
  return { env: { STORE, ...extra }, calls };
};
const SETTINGS = [
  ["no binding: today's calls, one argument, the plain names", {}, (n) => n, undefined],
  ["a hint: the option on every get", { STORE_LOCATION: "wnam" }, (n) => n, { locationHint: "wnam" }],
  ["a generation: the suffix on the room's name only", { STORE_GENERATION: "2" }, (n) => `${n}~g2`, undefined],
  ["both", { STORE_LOCATION: "apac-ne", STORE_GENERATION: "12" }, (n) => `${n}~g12`, { locationHint: "apac-ne" }],
  ["bad values are no hint and generation 1", { STORE_LOCATION: "bogus", STORE_GENERATION: "02" }, (n) => n, undefined],
  ["a differently cased or padded hint is none", { STORE_LOCATION: "WNAM", STORE_GENERATION: "1" }, (n) => n, undefined],
];
const shaped = (calls, naming, options) => calls.map((c) => [c.name, c.argc, c.options]).every(([n, argc, o]) =>
  typeof n === "string" && argc === (options ? 2 : 1) && (options ? o && o.locationHint === options.locationHint && Object.keys(o).length === 1 : o === undefined));

for (const [label, extra, naming, options] of SETTINGS) {
  test(`R95 (G83) T2, the plane's own sites: ${label}`, async () => {
    const { env, calls } = recorder(extra);
    await watchdog({ scheduledTime: 1 }, env);
    assert.deepEqual(calls.map((c) => c.name).sort(), [naming("bio"), naming("scratch")], "the watchdog asks both rooms");
    const asked = recorder(extra);
    const member = { req: new Request("http://x/api/?op=ask", { method: "POST", body: JSON.stringify({ question: "q" }) }), url: new URL("http://x/api/?op=ask"), env: asked.env,
                     viaSession: true, sessMember: "ann", sessViewer: "member:ann", grantMember: null };   /* store-services' askOp: no grant presented */
    await askOp(member);
    await actionDraftOp({ ...member, op: "infractiondraft", req: new Request("http://x/api/?op=infractiondraft", { method: "POST", body: JSON.stringify({ matter: "m", audience: "a" }) }) });
    assert.deepEqual(asked.calls.map((c) => c.name), [naming("bio"), naming("bio")], "the ask and the draft door ask the bio room");
    const gated = recorder(extra);
    try { await gatedOp({ req: new Request("http://x/api/?op=affordances"), url: new URL("http://x/api/?op=affordances"), env: gated.env, op: "affordances", cls: "admin", viaSession: false, storeName: "scratch" }); } catch { /* the arm's own */ }
    assert.ok(gated.calls.length >= 1 && gated.calls.every((c) => c.name === naming("scratch")), "the gated door asks the room it is told (the logical name stays scratch)");
    for (const c of [calls, asked.calls, gated.calls]) assert.ok(shaped(c, naming, options), JSON.stringify(c));
  });
}

/* ---- the object's own name, and a retired room ---- */
const idOf = (name, env) => ({ name, equals: (other) => other && other.name === (env.STORE_GENERATION && /^[1-9][0-9]*$/.test(env.STORE_GENERATION) && Number(env.STORE_GENERATION) >= 2 ? `${name.split("~")[0]}~g${env.STORE_GENERATION}` : name.split("~")[0]) });
function roomWorld(name, generation, retired = false) {
  return store({ retired, env: { CAPTURES: multipartBucket(), ...(generation ? { STORE_GENERATION: generation } : {}) },
                 before: (ctx, env) => { env.STORE = { idFromName: (n) => ({ name: n }) }; ctx.id = { name, equals: (o) => o && o.name === name }; } });
}
test("R95 (G83) G1: inside the room `scratch~g2` the object's own namespace is the logical `scratch`: its evidence prefix is `scratch/captures/`, not the room's name; and a generation-2 room named `bio~g2` is `bio`", async () => {
  const x = await roomWorld("scratch~g2", "2");
  const d = "a".repeat(64);
  x.env.CAPTURES.held.set(`scratch/captures/${d}`, new Uint8Array([1, 2, 3]));
  assert.ok(await recordOf(x.ctx).evidenceStore().head(d), "the evidence under the logical prefix is this object's");
  x.env.CAPTURES.held.clear();
  x.env.CAPTURES.held.set(`scratch~g2/captures/${d}`, new Uint8Array([1, 2, 3]));
  assert.equal(await recordOf(x.ctx).evidenceStore().head(d), null, "the prefix never follows the room's generation");
});

test("R95, R111, R114 (G83) T-retired: a room of another generation (`bio`, generation 1, after the deploy sets generation 2) is inert: it builds no module, writes no table, deletes its alarm when it fires, refuses every request and RPC, and leaves its data", async () => {
  const x = await roomWorld("bio", "2", true);
  const tables = [...x.ctx.storage.sql.exec(`SELECT name FROM sqlite_master WHERE type='table'`)];
  assert.deepEqual(tables, [], "nothing was migrated: no table, no row written");
  await x.ctx.storage.setAlarm(Date.now() + 1000);
  const res = await x.fetch("/whoami?viewer=class:admin");
  assert.equal(res.status, 410);
  assert.deepEqual(await res.json(), { ok: false, reason: "ROOM_RETIRED", code: "ROOM_RETIRED", retired: true });
  assert.equal((await x.s.ask({ member: "member:ann" })).status, 410);
  assert.equal((await x.s.draft({})).status, 410);
  assert.equal((await x.s.dispatchMemberRun({})).reason, "ROOM_RETIRED");
  assert.equal((await x.s.groupFields({})).reason, "ROOM_RETIRED");
  assert.notEqual(await x.ctx.storage.getAlarm(), null);
  await x.s.alarm();
  assert.equal(await x.ctx.storage.getAlarm(), null, "its alarm is deleted when it fires");
  await x.ctx.storage.setAlarm(Date.now() + 1000);
  assert.equal((await x.s.onAlarm(Date.now())).reason, "ROOM_RETIRED");
  assert.equal(await x.ctx.storage.getAlarm(), null);
  await x.ctx.storage.setAlarm(Date.now() + 1000);
  await x.s.watchdog(Date.now());
  assert.equal(await x.ctx.storage.getAlarm(), null, "the cron's call does not wake it either");
  assert.deepEqual([...x.ctx.storage.sql.exec(`SELECT name FROM sqlite_master WHERE type='table'`)], [], "still nothing written");
});
test("R95 (G83) T-retired controls: the current room is not inert (generation 2 named `bio~g2`; generation 1 named `bio`; a suite's private instance, whose id has no room name); removing the generation makes the old room current again", async () => {
  for (const [name, gen] of [["bio~g2", "2"], ["scratch~g2", "2"], ["bio", undefined], ["scratch", "1"]]) {
    const x = await roomWorld(name, gen);
    const res = await x.fetch("/whoami?viewer=class:admin");
    assert.notEqual(res.status, 410, `${name} @ ${gen ?? "none"}`);
  }
  const suite = await store({});
  assert.notEqual((await suite.fetch("/whoami?viewer=class:admin")).status, 410, "a private instance is no room");
});

/* ---- the Worker as a whole, on workerd, through a recording proxy over the real binding ---- */
const ENTRY = fileURLToPath(new URL("./g83-entry.mjs", import.meta.url));
const TOKENS = { ADMIN_TOKEN: "adm-g83-0123456789abcdef", DAEMON_TOKEN: "dmn-g83-0123456789abcdef", PROBE_TOKEN: "prb-g83-0123456789abcdef" };
const booted = [];
const boot = (extra, persist = mkdtempSync(join(tmpdir(), "plane-g83-"))) => {
  const mf = new Miniflare({
    modules: true, modulesRoot: "/", scriptPath: ENTRY, script: readFileSync(ENTRY, "utf8"),
    modulesRules: [{ type: "ESModule", include: ["**/*.mjs"] }],
    compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
    durableObjects: { STORE: { className: "Store", useSQLite: true } },
    r2Buckets: ["CAPTURES", "PUBLISHED"],
    bindings: { INSTANCE_NAME: "town", VERSION: "test", ...TOKENS, ...extra },
    serviceBindings: { SELF: kCurrentWorker },   /* `livefire` calls the Worker itself */
    durableObjectsPersist: persist,
  });
  booted.push(mf);
  return { mf, persist };
};
after(async () => { for (const mf of booted) await mf.dispose().catch(() => {}); });
const ADM = { headers: { authorization: `Bearer ${TOKENS.ADMIN_TOKEN}` } };
async function walk(mf) {
  const hit = (path, init) => mf.dispatchFetch("http://x" + path, init).then((r) => r.text());
  await mf.dispatchFetch("http://x/__g83/reset");
  const seen = {};
  const mark = async (label, fn) => { const before = (await (await mf.dispatchFetch("http://x/__g83/calls")).json()).length; await fn(); seen[label] = (await (await mf.dispatchFetch("http://x/__g83/calls")).json()).slice(before); };
  await mark("public read", () => hit("/api/?op=instancegroup"));
  await mark("gated op (the plane's door)", () => hit("/api/?op=registeraudit", ADM));
  await mark("generic forward (control-plane)", () => hit("/api/?op=stats", ADM));
  await mark("selftest", () => hit("/api/?op=selftest", ADM));
  await mark("livefire", () => hit("/api/?op=livefire", ADM));
  await mark("scheduled watchdog", async () => { const w = await mf.getWorker(); await w.scheduled({ cron: "*/5 * * * *", scheduledTime: new Date() }); });
  return seen;
}
const WORKER_CASES = [
  ["STORE_LOCATION=wnam: every get carries the hint", { STORE_LOCATION: "wnam" }, (n) => n, { locationHint: "wnam" }],
  ["STORE_GENERATION=2: every room is `bio~g2` or `scratch~g2`", { STORE_GENERATION: "2" }, (n) => `${n}~g2`, undefined],
  ["neither: exactly today's calls", {}, (n) => n, undefined],
  ["bad values (`bogus`, `02`): no hint, generation 1", { STORE_LOCATION: "bogus", STORE_GENERATION: "02" }, (n) => n, undefined],
  ["`WNAM`: no hint", { STORE_LOCATION: "WNAM" }, (n) => n, undefined],
];
for (const [label, extra, naming, options] of WORKER_CASES) {
  test(`R95 (G83) T2 on workerd, the whole Worker: ${label}`, { timeout: 180_000 }, async () => {
    const { mf } = boot(extra);
    const seen = await walk(mf);
    for (const [path, calls] of Object.entries(seen)) {
      assert.ok(calls.length >= 1, `${path} obtained a room`);
      for (const c of calls) {
        assert.ok(c.name === naming("bio") || c.name === naming("scratch"), `${path}: room ${c.name}`);
        assert.equal(c.argc, options ? 2 : 1, `${path}: ${JSON.stringify(c)}`);
        if (options) assert.deepEqual(c.options, options, path);
      }
    }
  });
}

test("R95 (G83) T-retired on workerd: the room `bio` of generation 1, after the deploy sets generation 2, refuses a request; removing the generation makes it current again", { timeout: 180_000 }, async () => {
  const first = boot({});
  assert.equal((await first.mf.dispatchFetch("http://x/api/?op=whoami", ADM)).status, 200);
  const ns1 = await first.mf.getDurableObjectNamespace("STORE");
  assert.equal((await ns1.get(ns1.idFromName("bio")).fetch("http://do/instancegroup")).status, 200, "the room serves while it is current");
  await first.mf.dispose();
  const second = boot({ STORE_GENERATION: "2" }, first.persist);
  const ns2 = await second.mf.getDurableObjectNamespace("STORE");
  const old = await ns2.get(ns2.idFromName("bio")).fetch("http://do/instancegroup");
  assert.equal(old.status, 410, "generation 1's room is retired");
  assert.equal((await old.json()).reason, "ROOM_RETIRED");
  assert.equal((await second.mf.dispatchFetch("http://x/api/?op=whoami", ADM)).status, 200, "the new room serves");
  await second.mf.dispose();
  const third = boot({}, first.persist);
  const ns3 = await third.mf.getDurableObjectNamespace("STORE");
  assert.equal((await ns3.get(ns3.idFromName("bio")).fetch("http://do/instancegroup")).status, 200, "removing the generation makes it current again, its data as it was");
});
