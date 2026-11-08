/* The instance's reports (R17–R19) and the wire reads of the group (R3, R10, R11), through the Worker functions the
   control plane calls. R19 runs the canary against the real plane's scratch store (Miniflare), then against the same
   store with one behaviour broken per arm, so each assertion is seen to fail when its behaviour is gone. */
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";
import { boot, stubOver, envOver, io, read, doAnswer } from "./fixture.mjs";
import { bootstrapReport, selftest, publicInstanceGroup, instanceGroupOp, groupIdentityOp, PUBLIC_GROUP_PROJECTIONS,
         NO_GROUP_RECORDED } from "../../../src/setup.mjs";
import { livefire } from "../../../src/livefire.mjs";
import { PUBLISHED_TOKEN_HASHES, sha256hex } from "../../../src/tokens.mjs";

const published = async (v, fn) => {
  const h = await sha256hex(v);
  PUBLISHED_TOKEN_HASHES.add(h);
  try { return await fn(); } finally { PUBLISHED_TOKEN_HASHES.delete(h); }
};
const LIVE = "a-live-admin-token-0123456789";
const bootstrapStub = (state = { claimed: false, rearmed: false, consumedAt: null, storeVersion: "store-7" }) => ({
  seen: [],
  async fetch(input) {
    const req = input instanceof Request ? input : new Request(input);
    this.seen.push(req.url);
    return Response.json({ ok: true, result: state });
  },
});
const member = (name, version, status = 200) => ({ fetch: async () => new Response(JSON.stringify({ name, version }), { status }) });

test("R17 op=bootstrap: service, this isolate's version (0.0.0 unset), bootstrapConfigured a live ADMIN_TOKEN, membership's bootstrapState and the store's own storeVersion; members=1 adds each member's own /version", async () => {
  const stub = bootstrapStub();
  const r = await read(await bootstrapReport({ VERSION: "plane-3", ADMIN_TOKEN: LIVE, STORE_VERSION: "never-read" }, "fp9",
                                             { stub, ...io }));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true, service: "bio-plane", version: "plane-3", bootstrapConfigured: true,
                             claimed: false, rearmed: false, consumedAt: null, storeVersion: "store-7",
                             /* R80's test_instance and R82's three flat parts, always answered (none bound here) */
                             test_instance: false, part_signin: false, part_scanner: false, part_safe_view: false });
  assert.equal(stub.seen[0], "http://do/bootstrap?fp=fp9");
  assert.equal((await read(await bootstrapReport({}, "x", { stub, ...io }))).body.version, "0.0.0");
  for (const tok of [undefined, ""]) assert.equal((await read(await bootstrapReport({ ADMIN_TOKEN: tok }, "x", { stub, ...io }))).body.bootstrapConfigured, false);
  await published(LIVE, async () =>
    assert.equal((await read(await bootstrapReport({ ADMIN_TOKEN: LIVE }, "x", { stub, ...io }))).body.bootstrapConfigured, false));
  /* storeVersion is the store's own, never filled from this isolate */
  const own = await read(await bootstrapReport({ VERSION: "plane-3" }, "x", { stub: bootstrapStub({ claimed: true }), ...io }));
  assert.equal("storeVersion" in own.body, false);
  const env = { VERSION: "plane-3", AGENT_WORKER: member("agent-worker", "a-1"), PDF_WORKER: member("ocr-worker", "o-1"),
                SHEET_WORKER: member("sheet-worker", "s-1"), FILE_SCANNER: member("file-scanner", "f-1") };
  const withMembers = await read(await bootstrapReport(env, "x", { members: true, stub, ...io }));
  assert.deepEqual(withMembers.body.memberVersions, {
    "agent-worker": { binding: "AGENT_WORKER", state: "SERVING", version: "a-1" },
    "pdf-worker": { binding: "PDF_WORKER", state: "MISNAMED", name: "ocr-worker", version: "o-1" },
    "ocr-worker": { binding: "OCR_WORKER", state: "UNBOUND" },
    "sheet-worker": { binding: "SHEET_WORKER", state: "SERVING", version: "s-1" },
    /* T46 (R17), F2: read through agent-worker's /version, which no longer says runner (agent-worker R30, T53): its part */
    "agent-runner": { binding: "AGENT_WORKER", via: "agent-worker", state: "SERVING", version: "a-1" },
    "file-scanner": { binding: "FILE_SCANNER", state: "SERVING", version: "f-1" } });
  assert.equal("memberVersions" in (await read(await bootstrapReport(env, "x", { stub, ...io }))).body, false);
  const silent = await read(await bootstrapReport(env, "x", { stub: { fetch: async () => new Response("x", { status: 500 }) }, ...io }));
  assert.deepEqual([silent.status, silent.body.reason], [502, "STORE_DID_NOT_ANSWER"]);
});

const bucket = (broken = false) => {
  const held = new Map();
  return {
    held,
    async put(k, v) { held.set(k, typeof v === "string" ? v : new TextDecoder().decode(v)); },
    async get(k) { return held.has(k) ? { text: async () => (broken ? "garbled" : held.get(k)) } : null; },
    async delete(k) { held.delete(k); },
  };
};

test("R18 op=selftest: bindings (STORE; CAPTURES and PUBLISHED true or not configured; token bindings live or not; DAEMON_TOKEN not configured when unset), r2Configured, the store's stats and an R2 round trip under scratch; ok false on half a fence, a silent store or a failed round trip", async () => {
  const stats = { bundles: 3 };
  const seen = [];
  const store = { async fetch(u) { seen.push(String(u)); return Response.json({ ok: true, result: stats }); } };
  const tokens = { ADMIN_TOKEN: LIVE, PROBE_TOKEN: LIVE + "p" };
  const caps = bucket();
  const env = envOver(store, { ...tokens, CAPTURES: caps, PUBLISHED: bucket(), VERSION: "v9" });
  const r = await read(await selftest(env, "scratch", { cls: "admin", viewer: "class:admin" }, io));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.bindings, { STORE: true, CAPTURES: true, PUBLISHED: true, ADMIN_TOKEN: true,
                                      PROBE_TOKEN: true, DAEMON_TOKEN: "not configured" });
  assert.deepEqual([r.body.ok, r.body.r2Configured, r.body.store, r.body.captures, r.body.version, r.body.tokenClass],
                   [true, true, stats, "read-write ok", "v9", "admin"]);
  assert.equal(seen[0], "http://x/stats?capacity=1&viewer=class%3Aadmin");
  assert.equal(caps.held.size, 0, "the round trip deletes what it wrote");
  assert.equal(JSON.stringify(r.body).includes(LIVE), false, "never returns a secret");
  /* R2 not configured is healthy; DAEMON_TOKEN reported live or not when set */
  const bare = await read(await selftest(envOver(store, { ...tokens, DAEMON_TOKEN: "short" }), "bio", { cls: "member", viewer: "v" }, io));
  assert.deepEqual([bare.body.ok, bare.body.r2Configured, bare.body.captures, bare.body.bindings.CAPTURES, bare.body.bindings.DAEMON_TOKEN],
                   [true, false, "not configured", "not configured", true]);
  assert.match(seen.at(-1), /capacity=0/);
  await published("short", async () => {
    const d = await read(await selftest(envOver(store, { ...tokens, DAEMON_TOKEN: "short" }), "bio", {}, io));
    assert.deepEqual([d.body.bindings.DAEMON_TOKEN, d.body.ok], [false, true]);
  });
  /* the three ways ok goes false, and a required token not live */
  const half = await read(await selftest(envOver(store, { ...tokens, CAPTURES: bucket() }), "bio", {}, io));
  assert.deepEqual([half.status, half.body.ok], [500, false]); assert.match(half.body.r2, /MISCONFIGURED/);
  const silent = await read(await selftest(envOver({ fetch: async () => new Response("", { status: 500 }) }, tokens), "bio", {}, io));
  assert.deepEqual([silent.body.ok, silent.body.store], [false, "ERR the store did not answer /stats"]);
  const trip = await read(await selftest(envOver(store, { ...tokens, CAPTURES: bucket(true), PUBLISHED: bucket() }), "bio", {}, io));
  assert.deepEqual([trip.body.ok, trip.body.captures], [false, "MISMATCH"]);
  const noProbe = await read(await selftest(envOver(store, { ADMIN_TOKEN: LIVE }), "bio", {}, io));
  assert.deepEqual([noProbe.body.ok, noProbe.body.bindingsAllPresent], [false, false]);
  const noAdmin = await read(await selftest(envOver(store, { PROBE_TOKEN: LIVE }), "bio", {}, io));
  assert.deepEqual([noAdmin.body.ok, noAdmin.body.bindingsAllPresent], [false, false]);
});

test("R18 (T36; N711) MEMBER_TOKEN is no binding: op=selftest neither reads, reports nor requires it; ok and bindingsAllPresent rest on STORE, ADMIN_TOKEN and PROBE_TOKEN, whether a member token is absent, live, short or a published value", async () => {
  const store = { async fetch() { return Response.json({ ok: true, result: { bundles: 0 } }); } };
  const base = { ADMIN_TOKEN: LIVE, PROBE_TOKEN: LIVE + "p" };
  await published("a-published-member-value", async () => {
    for (const member of [undefined, LIVE + "m", "short", "a-published-member-value"]) {
      let reads = 0;
      const env = envOver(store, base);
      Object.defineProperty(env, "MEMBER_TOKEN", { enumerable: true, get() { reads += 1; return member; } });
      const r = await read(await selftest(env, "bio", {}, io));
      assert.deepEqual([r.status, r.body.ok, r.body.bindingsAllPresent], [200, true, true], String(member));
      assert.equal("MEMBER_TOKEN" in r.body.bindings, false, "not reported");
      assert.deepEqual(Object.keys(r.body.bindings), ["STORE", "CAPTURES", "PUBLISHED", "ADMIN_TOKEN", "PROBE_TOKEN", "DAEMON_TOKEN"]);
      assert.equal(reads, 0, "not read");
      assert.equal(JSON.stringify(r.body).includes("MEMBER_TOKEN"), false);
    }
  });
});

test("R3 R10 R11 over the wire: a credentialed reader gets the row or the identity, anybody else the public projection, a silence answers the store-silence refusal; only the two public projections may be named", async () => {
  const w = await boot({ env: { INSTANCE_NAME: "river-town" } });
  w.prov.admins = new Set(["admin"]);
  w.m.groupNameSet({ name: "River Town Watch", by: "admin" });
  const env = envOver(stubOver(w.m));
  const cred = await read(await instanceGroupOp(env, "bio", { viewer: "admin", cls: "member" }, io));
  assert.deepEqual([cred.body.result.source, cred.body.tokenClass, cred.body.store], ["bootstrap", "member", "bio"]);
  const pub = await read(await instanceGroupOp(env, "bio", { viewer: "" }, io));
  assert.deepEqual(pub.body, { ok: true, result: { ok: true, group: "river-town" }, store: "bio" });
  const idc = await read(await groupIdentityOp(env, "bio", { viewer: "admin", cls: "member" }, io));
  assert.equal(idc.body.result.display_name_recorded, "River Town Watch");
  const idp = await read(await groupIdentityOp(env, "bio", {}, io));
  assert.deepEqual(Object.keys(idp.body.result).sort(), ["display_name", "domain", "domain_verified_at", "group", "logo", "ok"] /* R84: logo, whether one is set */);
  assert.equal("tokenClass" in idp.body, false);
  const dead = envOver({ fetch: async () => new Response("", { status: 500 }) });
  for (const r of [await instanceGroupOp(dead, "bio", {}, io), await instanceGroupOp(dead, "bio", { viewer: "admin" }, io),
                   await groupIdentityOp(dead, "bio", {}, io)]) {
    const b = await read(r);
    assert.deepEqual([b.status, b.body.reason], [502, "STORE_DID_NOT_ANSWER"]);
    assert.equal(JSON.stringify(b.body).includes(NO_GROUP_RECORDED), false, "a silence is never 'none recorded'");
  }
  assert.deepEqual([...PUBLIC_GROUP_PROJECTIONS], ["instancegrouppublic", "groupidentitypublic"]);
  assert.deepEqual(await publicInstanceGroup(env, "bio", "instancegroup", doAnswer), { answered: false, result: undefined });
  assert.deepEqual(await publicInstanceGroup({}, "bio", "instancegrouppublic", doAnswer), { answered: false, result: undefined });
  assert.deepEqual((await publicInstanceGroup(env, "bio", "groupidentitypublic", doAnswer)).result.display_name, "River Town Watch");
});

/* ---------------------------------------------------------------------------------------------- R19 on the real plane */

const SRC = fileURLToPath(new URL("../../../src/plane/index.mjs", import.meta.url));
let mf = null;
const plane = async () => {
  if (mf) return mf;
  mf = new Miniflare({
    modules: true, modulesRoot: "/", scriptPath: SRC, script: readFileSync(SRC, "utf8"),
    compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
    durableObjects: { STORE: { className: "Store", useSQLite: true } },
    r2Buckets: ["CAPTURES", "PUBLISHED"],
    bindings: { ADMIN_TOKEN: "adm-livefire-0123456789",
                PROBE_TOKEN: "prb-livefire-0123456789", VERSION: "test", INSTANCE_NAME: "canary-town" },
  });
  await mf.ready;
  return mf;
};
after(async () => { if (mf) await mf.dispose(); });

/* The real scratch store behind a wrapper that can rewrite one answer, so one behaviour is broken per arm. */
const envWith = async (edit = null, more = {}) => {
  const m = await plane();
  const ns = await m.getDurableObjectNamespace("STORE");
  const real = ns.get(ns.idFromName("scratch"));
  const stub = { async fetch(req) {
    /* node's Request handed across to Miniflare's own, by its URL, method and body */
    const r = await real.fetch(req.url, { method: req.method, ...(req.method === "POST" ? { body: await req.clone().text() } : {}) });
    if (!edit) return r;
    const path = new URL(req.url).pathname.slice(1);
    const body = await r.json();
    const edited = await edit(path, body, req);
    return new Response(JSON.stringify(edited ?? body), { status: r.status, headers: { "content-type": "application/json" } });
  } };
  return { STORE: { idFromName: (n) => n, get: () => stub }, CAPTURES: await m.getR2Bucket("CAPTURES"),
           PUBLISHED: await m.getR2Bucket("PUBLISHED"), ADMIN_TOKEN: "adm-livefire-0123456789",
           PROBE_TOKEN: "prb-livefire-0123456789", ...more };
};

test("R19 livefire against the scratch store: every assertion by name, verdict pass exactly when all passed, ok true whenever it answers", { timeout: 300000 }, async () => {
  const env = await envWith();
  const out = await livefire(env, "scratch", { capacity: false, viewer: "class:probe" });
  assert.equal(out.ok, true);
  assert.equal(out.verdict, "pass", JSON.stringify(out.failing));
  assert.deepEqual(out.failing, []);
  const names = out.assertions.map((a) => a.name);
  for (const want of ["creation with base null succeeds", "second creation refused", "update with correct base succeeds",
    "row_version advanced", "STALE base refused", "garbage base refused", "live state is the winning revision",
    "history holds the superseded revision", "the verbatim promotion record is projected", "manifest projected",
    "oversize inline refused at the write", "canary nonce survived the round trip", "allocid increments without gaps",
    "lease returns live sha as edit base", "second actor denied while lease holds",
    "no configured token is a published repository value", "no configured token is shorter than 16 characters",
    "R2 capture round trip through binding", "R2 range read"]) assert.ok(names.includes(want), want);
  assert.equal(out.r2.configured, true);
  assert.equal(out.store, "scratch");
  assert.ok(out.r2.sizes.every((s) => typeof s.putMs === "number" && typeof s.getMBps === "number"));
});

test("R19 each broken behaviour fails its own assertion by name: verdict fail, failing never empty, ok still true", { timeout: 600000 }, async () => {
  const arms = [
    ["STALE base refused", (p, b, req) => (p === "promote" && b.result && b.result.reason === "CAS_STALE"
      ? { ok: true, result: { ok: true, bundleSha: "x" } } : null)],
    ["second creation refused", (p, b) => (p === "promote" && b.result && b.result.reason === "EXISTS" ? { ok: true, result: { ok: true } } : null)],
    ["oversize inline refused at the write", (p, b) => (p === "promote" && b.result && b.result.reason === "OVERSIZE_INLINE" ? { ok: true, result: { ok: true } } : null)],
    ["canary nonce survived the round trip", (p, b) => (p === "image" && b.result ? { ok: true, result: { ...b.result, "bundle.md": String(b.result["bundle.md"]).replace(/nonce: .*/, "nonce: x").replace(/rev 3/, "rev 3") } } : null)],
    ["allocid increments without gaps", (() => { let n = 0; return (p, b) => (p === "allocid" && b.result && ++n === 2 ? { ok: true, result: { ...b.result, id: b.result.id.replace(/\d+$/, (d) => String(Number(d) + 1).padStart(d.length, "0")) } } : null); })()],
    ["second actor denied while lease holds", (p, b, req) => (p === "lease" && /probe-b/.test(req.url) ? { ok: true, result: { ok: true, base: "x" } } : null)],
    ["history holds the superseded revision", (p, b) => (p === "image" && b.result ? { ok: true, result: Object.fromEntries(Object.entries(b.result).filter(([k]) => !/^_history\/bundle_/.test(k))) } : null)],
  ];
  for (const [name, edit] of arms) {
    const out = await livefire(await envWith(edit), "scratch", { viewer: "class:probe" });
    assert.equal(out.ok, true, name);
    assert.equal(out.verdict, "fail", name);
    assert.ok(out.failing.includes(name), `${name}: failing ${JSON.stringify(out.failing)}`);
  }
  /* a configured token that is a published value, or shorter than 16 characters */
  const pub = await published("prb-livefire-0123456789", async () => livefire(await envWith(), "scratch", { viewer: "class:probe" }));
  assert.ok(pub.failing.includes("no configured token is a published repository value"));
  const short = await livefire(await envWith(null, { DAEMON_TOKEN: "short" }), "scratch", { viewer: "class:probe" });
  assert.ok(short.failing.includes("no configured token is shorter than 16 characters"));
  /* (T36; N711) the token assertions run over ADMIN_TOKEN, PROBE_TOKEN and DAEMON_TOKEN: each of the three is named
     when short or published, and a shared member bearer left bound is never read, so it fails nothing */
  for (const name of ["ADMIN_TOKEN", "PROBE_TOKEN", "DAEMON_TOKEN"]) {
    const s = await livefire(await envWith(null, { [name]: "short" }), "scratch", { viewer: "class:probe" });
    assert.deepEqual(s.assertions.find((a) => a.name === "no configured token is shorter than 16 characters").got, [name], name);
  }
  const member = await published("mem-livefire-published-value", async () =>
    livefire(await envWith(null, { MEMBER_TOKEN: "mem-livefire-published-value" }), "scratch", { viewer: "class:probe" }));
  assert.deepEqual([member.verdict, member.failing], ["pass", []]);
  const memberShort = await livefire(await envWith(null, { MEMBER_TOKEN: "short" }), "scratch", { viewer: "class:probe" });
  assert.deepEqual([memberShort.verdict, memberShort.failing], ["pass", []]);
  /* R2: one bucket without the other; neither is declared, and passes */
  const half = await livefire(await envWith(null, { PUBLISHED: undefined }), "scratch", { viewer: "class:probe" });
  assert.deepEqual([half.verdict, half.failing.includes("R2 absence is symmetric: both buckets or neither")], ["fail", true]);
  const neither = await livefire(await envWith(null, { PUBLISHED: undefined, CAPTURES: undefined }), "scratch", { viewer: "class:probe" });
  assert.deepEqual([neither.verdict, neither.r2.configured], ["pass", false]);
  /* it writes only a nonce-named canary and R2 keys under scratch/ */
  const env = await envWith();
  const listed = await env.CAPTURES.list();
  assert.ok(listed.objects.every((o) => o.key.startsWith("scratch/")), JSON.stringify(listed.objects.map((o) => o.key)));
});

/* ------------------------------------------------------------- the report ops' dispatch (legacy-index map §4.4) */

test("R17 R18 R37 R38 the report ops' dispatch, moved out of src/index.mjs: INSTANCE_SETUP_OPS is exactly selftest, livefire, runtime and cpuprobe; instanceSetupOp answers each from the store the door resolved, handing selftest the door's class and viewer and cpuprobe its two bounds, and answers null for any other op; bootstrapOp reads members=1", async () => {
  const { INSTANCE_SETUP_OPS, instanceSetupOp, bootstrapOp } = await import("../../../src/setup.mjs");
  assert.deepEqual([...INSTANCE_SETUP_OPS], ["selftest", "livefire", "runtime", "cpuprobe"]);
  assert.ok(Object.isFrozen(INSTANCE_SETUP_OPS));
  const w = await boot();
  const seen = [];
  const inner = stubOver(w.m, { stats: async () => ({ bundles: 0 }), capturelimit: async () => ({ ceiling: 50 }) });
  const store = { fetch: async (input, init) => { seen.push(String(input instanceof Request ? input.url : input)); return inner.fetch(input, init); } };
  const asked = [];
  const env = { STORE: { idFromName: (n) => { asked.push(n); return n; }, get: () => store }, ADMIN_TOKEN: LIVE, PROBE_TOKEN: LIVE + "p" };
  const url = (q = "") => new URL(`http://x/api/?${q}`);
  const st = await read(await instanceSetupOp("selftest", url(), env, "scratch", { cls: "probe", viewer: "class:probe", ...io }));
  assert.deepEqual([st.status, st.body.tokenClass, st.body.ok], [200, "probe", true]);
  assert.equal(seen.at(-1), "http://x/stats?capacity=0&viewer=class%3Aprobe");
  assert.equal(asked.at(-1), "scratch");
  const rt = await read(await instanceSetupOp("runtime", url(), env, "bio", io));
  assert.deepEqual([rt.status, rt.body.ok, asked.at(-1)], [200, true, "bio"]);
  const cp = await read(await instanceSetupOp("cpuprobe", url("iterations=100000&budget_ms=50"), env, "scratch", io));
  assert.deepEqual([cp.status, cp.body.ok, cp.body.state.runs[0].iterations, cp.body.state.runs[0].budget_ms], [200, true, 100000, 50]);
  for (const other of ["purge", "bootstrap", "stats", "instancegroup", ""])
    assert.equal(await instanceSetupOp(other, url(), env, "bio", io), null, other);
  const stub = bootstrapStub();
  const env2 = { VERSION: "v", AGENT_WORKER: member("agent-worker", "a-1") };
  assert.equal("memberVersions" in (await read(await bootstrapOp(url(), env2, "fp", { stub, ...io }))).body, false);
  const withM = await read(await bootstrapOp(url("members=1"), env2, "fp", { stub, ...io }));
  assert.equal(withM.body.memberVersions["agent-worker"].state, "SERVING");
  assert.equal(stub.seen.at(-1), "http://do/bootstrap?fp=fp");
});
