/* The instance's reports and its limits through the real Worker (Miniflare over `src/plane/index.mjs`, plane R6's
   entry), where the door hands the report ops to this module (`INSTANCE_SETUP_OPS`, the legacy-index map's §4.4 move):
   op=bootstrap (R17), op=selftest (R18), op=livefire (R19), op=runtime (R37) and op=cpuprobe (R38, R40), and capture's
   compute listener recording into the instance's own measurements (R42, R33, R34). Converts instance-setup's shares of
   `bio-plane/test/livefire.test.mjs` (the probe token's pass through the Worker), `installer.test.mjs` (no R2 declared;
   a published ADMIN_TOKEN named by its binding), `d334-monitor-credential.test.mjs` (arm B: a dead DAEMON_TOKEN still
   named) and `subresources.test.mjs` (the compute measurement, the probe's runs, op=runtime). The published values are
   read from the file that put them on the denylist, never typed here. Who may call each op is admission's. */
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";
import { liveToken } from "../../../src/tokens.mjs";
import { RUNTIME_ASYMMETRY, FLEET_BINDINGS } from "../../../src/setup.mjs";

const SRC = fileURLToPath(new URL("../../../src/plane/index.mjs", import.meta.url));
const SECRETS = fileURLToPath(new URL("../../../SECRETS.txt", import.meta.url));
const published = (name) => {
  const l = readFileSync(SECRETS, "utf8").split("\n").find((x) => x.startsWith(name + "="));
  if (!l) throw new Error(`SECRETS.txt has no ${name} line`);
  return l.slice(name.length + 1).trim();
};
const DEAD_A = published("ADMIN_TOKEN"), DEAD_B = published("MEMBER_TOKEN");
const ADM = "adm-instance-setup-reports", PRB = "prb-instance-setup-reports";
const DMN = "dmn-instance-setup-reports";
const HYGIENE = "no configured token is a published repository value";

/* A page with a stylesheet, so an acquire with subresources does real hashing and parsing work. */
const PAGE = `<!doctype html><html><head><title>Transfers</title><link rel="stylesheet" href="/css/main.css"></head>
<body><h1>Transfers</h1><p>${"A paragraph of the record. ".repeat(40)}</p><img src="/img/chart.png"></body></html>`;
const BODIES = new Map([["/page.html", [PAGE, "text/html; charset=utf-8"]],
  ["/css/main.css", ["body { background: url(/img/bg.png); }", "text/css"]],
  ["/img/chart.png", [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 1, 2, 3]), "image/png"]],
  ["/img/bg.png", [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 4, 5, 6]), "image/png"]]]);

const live = [];
after(async () => { for (const mf of live) await mf.dispose(); });
const planeWith = async (bindings, { r2 = true } = {}) => {
  const mf = new Miniflare({
    modules: true, modulesRoot: "/", scriptPath: SRC, script: readFileSync(SRC, "utf8"),
    compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
    durableObjects: { STORE: { className: "Store", useSQLite: true } },
    ...(r2 ? { r2Buckets: ["CAPTURES", "PUBLISHED"] } : {}),
    bindings: { VERSION: "test", INSTANCE_NAME: "report-town", GOVERNOR_APPETITE_PER_MIN: "600000",
                GOVERNOR_SUBRESOURCE_STAGGER_MS: "0", ...bindings },
    outboundService(request) {
      const u = new URL(request.url);
      const b = u.hostname === "records.example.org" ? BODIES.get(u.pathname) : null;
      return b ? new Response(b[0], { headers: { "content-type": b[1] } }) : new Response("nope", { status: 404 });
    },
  });
  live.push(mf);
  await mf.ready;
  return mf;
};
/* A call through the Worker. A `token=` in `q` is sent as an `Authorization: Bearer` header (admission R20), never in the
   address, so no answer carries control-plane R59's `deprecated: "CREDENTIAL_IN_ADDRESS"`. */
const call = async (mf, q, init = {}) => {
  const params = new URLSearchParams(q);
  const token = params.get("token");
  params.delete("token");
  const headers = new Headers(init.headers || {});
  if (token) headers.set("authorization", `Bearer ${token}`);
  const r = await mf.dispatchFetch(`https://copy.example/api/?${params}`, { ...init, headers });
  const text = await r.text();
  const j = JSON.parse(text);
  assert.notEqual(j && j.deprecated, "CREDENTIAL_IN_ADDRESS", `${q.split("&")[0]}: the credential is in the header, not the address`);
  return { status: r.status, text, j };
};
const doRoute = async (mf, store, path, body) => {
  const ns = await mf.getDurableObjectNamespace("STORE");
  const r = await ns.get(ns.idFromName(store)).fetch(`http://x/${path}`, body === undefined ? undefined
    : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return (await r.json()).result;
};

let healthy = null;
const plane = async () => (healthy ??= planeWith({ ADMIN_TOKEN: ADM, PROBE_TOKEN: PRB }));

test("the fixtures are not vacuous: the published values are genuinely denylisted and distinct, the live ones live", async () => {
  assert.deepEqual([await liveToken(DEAD_A), await liveToken(DEAD_B), DEAD_A === DEAD_B], [false, false, false]);
  assert.deepEqual(await Promise.all([ADM, PRB, DMN].map(liveToken)), [true, true, true]);
});

test("R19 op=livefire through the Worker for the probe token: confined to scratch, it answers 200, ok true and verdict pass, failing nothing, every assertion by name passing", { timeout: 300000 }, async () => {
  const mf = await plane();
  const r = await call(mf, `op=livefire&token=${PRB}`);
  assert.equal(r.status, 200, JSON.stringify(r.j.failing));
  assert.deepEqual([r.j.ok, r.j.verdict, r.j.failing, r.j.store], [true, "pass", [], "scratch"]);
  assert.ok(r.j.assertions.length >= 19 && r.j.assertions.every((a) => a.ok), r.j.summary);
  assert.equal(r.j.r2.configured, true);
});

test("R18 op=selftest through the Worker: every binding reported, the store's stats and the R2 round trip under scratch, healthy; R17 op=bootstrap: this isolate's version, a live bootstrap credential, and with members=1 each member's state through its binding", { timeout: 120000 }, async () => {
  const mf = await plane();
  const s = await call(mf, `op=selftest&token=${PRB}`);
  assert.equal(s.status, 200);
  assert.deepEqual(s.j.bindings, { STORE: true, CAPTURES: true, PUBLISHED: true, ADMIN_TOKEN: true,
                                   PROBE_TOKEN: true, DAEMON_TOKEN: "not configured" });
  assert.deepEqual([s.j.ok, s.j.r2Configured, s.j.captures, s.j.bindingsAllPresent, s.j.tokenClass], [true, true, "read-write ok", true, "probe"]);
  assert.equal(typeof s.j.store, "object");
  for (const v of [ADM, PRB]) assert.equal(s.text.includes(v), false, "never returns a secret");
  const b = await call(mf, "op=bootstrap");
  assert.deepEqual([b.status, b.j.ok, b.j.service, b.j.version, b.j.bootstrapConfigured, "memberVersions" in b.j],
                   [200, true, "bio-plane", "test", true, false]);
  const m = await call(mf, "op=bootstrap&members=1");
  /* T46 (R17): agent-runner is read through agent-worker's binding, unbound here too */
  assert.deepEqual(m.j.memberVersions, Object.fromEntries(FLEET_BINDINGS.map(([n, binding]) => [n, n === "agent-runner"
    ? { binding: "AGENT_WORKER", via: "agent-worker", state: "UNBOUND" } : { binding, state: "UNBOUND" }])));
  /* R80, R82: a plane with no test-instance pair and no parts bound, the parts as three flat keys and no `parts` */
  assert.deepEqual([b.j.test_instance, b.j.part_signin, b.j.part_scanner, b.j.part_safe_view, "parts" in b.j],
                   [false, false, false, false, false]);
});

test("R19 R18 R17 an instance with no R2 is healthy and declared: selftest ok with both buckets not configured, and livefire's verdict pass with the named 'declared, not silent' assertion, failing nothing", { timeout: 300000 }, async () => {
  const mf = await planeWith({ ADMIN_TOKEN: ADM, PROBE_TOKEN: PRB }, { r2: false });
  const s = await call(mf, `op=selftest&token=${PRB}`);
  assert.deepEqual([s.j.ok, s.j.r2Configured, s.j.captures, s.j.bindings.CAPTURES, s.j.bindings.PUBLISHED, s.j.bindingsAllPresent],
                   [true, false, "not configured", "not configured", "not configured", true]);
  const lf = await call(mf, `op=livefire&token=${PRB}`);
  assert.deepEqual([lf.status, lf.j.ok, lf.j.verdict, lf.j.failing, lf.j.r2.configured], [200, true, "pass", [], false]);
  assert.ok(lf.j.assertions.some((a) => a.name === "R2 not configured is declared, not silent" && a.ok));
  assert.ok(lf.j.assertions.filter((a) => a.name.startsWith("no configured token")).every((a) => a.ok));
});

test("R19 R18 R17 an ADMIN_TOKEN bound to a published value: livefire answers 500 with ok true, verdict fail and failing exactly the token-hygiene assertion, which names the binding and never the value; selftest reports the binding not live; bootstrap reports no usable credential", { timeout: 300000 }, async () => {
  const mf = await planeWith({ ADMIN_TOKEN: DEAD_A, PROBE_TOKEN: PRB });
  const lf = await call(mf, `op=livefire&token=${PRB}`);
  assert.deepEqual([lf.status, lf.j.ok, lf.j.verdict, lf.j.failing], [500, true, "fail", [HYGIENE]]);
  const a = lf.j.assertions.find((x) => x.name === HYGIENE);
  assert.deepEqual([a.ok, a.got], [false, ["ADMIN_TOKEN"]]);
  assert.equal(lf.text.includes(DEAD_A), false);
  const s = await call(mf, `op=selftest&token=${PRB}`);
  assert.deepEqual([s.j.bindings.ADMIN_TOKEN, s.j.bindingsAllPresent, s.j.ok], [false, false, false]);
  assert.equal(s.text.includes(DEAD_A), false);
  assert.equal((await call(mf, "op=bootstrap")).j.bootstrapConfigured, false);
});

test("R18 R19 a DAEMON_TOKEN bound to a published value beside a live ADMIN_TOKEN: selftest reports it false, bound and dead and not absent, while the instance is otherwise healthy; livefire fails naming that binding alone; neither answer carries the value; a live one reads true", { timeout: 300000 }, async () => {
  const mf = await planeWith({ ADMIN_TOKEN: ADM, PROBE_TOKEN: PRB, DAEMON_TOKEN: DEAD_A });
  const s = await call(mf, `op=selftest&token=${PRB}`);
  assert.deepEqual([s.j.bindings.DAEMON_TOKEN, s.j.ok, s.j.bindingsAllPresent], [false, true, true]);
  assert.equal(s.text.includes(DEAD_A), false);
  const lf = await call(mf, `op=livefire&token=${PRB}`);
  assert.deepEqual([lf.j.ok, lf.j.verdict, lf.j.failing], [true, "fail", [HYGIENE]]);
  assert.deepEqual(lf.j.assertions.find((x) => x.name === HYGIENE).got, ["DAEMON_TOKEN"]);
  assert.equal(lf.text.includes(DEAD_A), false);
  const ok = await planeWith({ ADMIN_TOKEN: ADM, PROBE_TOKEN: PRB, DAEMON_TOKEN: DMN });
  assert.equal((await call(ok, `op=selftest&token=${PRB}`)).j.bindings.DAEMON_TOKEN, true);
});

/* (T36; N711) the acquire is the administrator's binding credential's, never a shared member bearer: R42 measures
   the walk, whoever asked for it. */
test("R42 R34 R33 on the real plane: an acquire's compute measurement reaches this module's observations through capture's listener, as capture_work_bytes in bytes with no key naming it a time, its peak at least that capture's work and the mean beside it the total over the samples", { timeout: 120000 }, async () => {
  const mf = await plane();
  const acq = await call(mf, `op=acquire&token=${ADM}`, { method: "POST",
    body: JSON.stringify({ locator: "https://records.example.org/page.html", authority: "A records office", subresources: true }) });
  assert.equal(acq.j.ok, true, acq.text.slice(0, 400));
  const work = acq.j.snapshot.compute.work_bytes;
  assert.ok(work > 0);
  const obs = await doRoute(mf, "bio", "runtimeobservations");
  const cw = obs.metrics.find((x) => x.metric === "capture_work_bytes");
  assert.ok(cw, JSON.stringify(obs));
  assert.deepEqual([cw.unit, cw.peak >= work, Object.keys(cw).filter((k) => /_ms$/.test(k))], ["bytes", true, []]);
  assert.ok(cw.samples > 0 && Math.abs(cw.mean - cw.total / cw.samples) < 1e-9);
  /* op=runtime serves the same measurements, the probe state and the subrequest ceiling through one surface */
  const rt = await call(mf, `op=runtime&token=${ADM}`);
  assert.deepEqual([rt.status, rt.j.ok, Object.keys(rt.j).sort()], [200, true, ["asymmetry", "cpu_probe", "measured", "ok", "subrequests"]]);
  assert.deepEqual(rt.j.measured.metrics.find((x) => x.metric === "capture_work_bytes"), cw);
  assert.equal(rt.j.asymmetry, RUNTIME_ASYMMETRY);
});

test("R38 R40 R37 op=cpuprobe through the Worker for the probe token runs under its own run in its namespace from step 0, records each step and its end, and op=runtime then reads that run apart from a run recorded before it", { timeout: 300000 }, async () => {
  const mf = await plane();
  /* an earlier run in the same namespace, recorded through the module's routes as the op records one */
  await doRoute(mf, "scratch", "cpuprobestart", { run: "earlier-run", iterations: 100000, budgetMs: 50 });
  for (const [step, ms] of [[1, 3], [2, 7]]) await doRoute(mf, "scratch", "recordcpuprobestep", { run: "earlier-run", step, elapsedMs: ms, iterations: 100000 });
  await doRoute(mf, "scratch", "cpuprobeend", { run: "earlier-run", completed: 2, elapsedMs: 7, reason: "BUDGET_REACHED" });
  const r = await call(mf, `op=cpuprobe&token=${PRB}&iterations=100000&budget_ms=50`);
  assert.deepEqual([r.status, r.j.ok, r.j.trail_complete], [200, true, true], r.text.slice(0, 300));
  assert.match(r.j.note, /RETURNED, so the ceiling is above/);
  const runs = r.j.state.runs;
  const mine = runs.find((x) => x.run === r.j.run.id);
  assert.ok(mine && mine.returned === true && mine.steps.length === r.j.run.completed, JSON.stringify(mine));
  assert.deepEqual(mine.steps.map((s) => s.step), Array.from({ length: mine.steps.length }, (_, i) => i + 1));
  assert.deepEqual(runs.find((x) => x.run === "earlier-run").steps.map((s) => [s.step, s.elapsed_ms]), [[1, 3], [2, 7]]);
  /* the probe ran in the probe's namespace, and the runtime read of that namespace carries it */
  const rt = await call(mf, `op=runtime&token=${PRB}`);
  assert.ok(rt.j.cpu_probe.runs.some((x) => x.run === r.j.run.id));
  assert.equal((await doRoute(mf, "bio", "cpuprobestate")).runs.some((x) => x.run === r.j.run.id), false);
});

test("R18 R19 (T36; N711) a shared member key left bound, even a published value, is no binding: selftest neither reports nor requires it and stays healthy, and livefire's token assertions pass over the three configured tokens", { timeout: 300000 }, async () => {
  const mf = await planeWith({ ADMIN_TOKEN: ADM, PROBE_TOKEN: PRB, MEMBER_TOKEN: DEAD_B });
  const s = await call(mf, `op=selftest&token=${PRB}`);
  assert.deepEqual([s.status, s.j.ok, s.j.bindingsAllPresent, "MEMBER_TOKEN" in s.j.bindings], [200, true, true, false]);
  assert.equal(s.text.includes(DEAD_B), false);
  const lf = await call(mf, `op=livefire&token=${PRB}`);
  assert.deepEqual([lf.status, lf.j.verdict, lf.j.failing], [200, "pass", []]);
  assert.equal(lf.text.includes("MEMBER_TOKEN"), false);
});

/* R102 (fix round 7 G83; L): on the real binding under workerd, a hint is configured and op=selftest answers it as configuration;
   the room is created through the helper and the instance is healthy. Workerd places nothing, so only the configuration and the
   health are claimed here; where the room runs is the platform's, read by BOB after the redeploy. */
test("R102 op=selftest on the real binding with STORE_LOCATION set answers store_location and store_generation as configured, healthy and with no secret; with none set, null and 1", { timeout: 120000 }, async () => {
  const mf = await planeWith({ ADMIN_TOKEN: ADM, PROBE_TOKEN: PRB, STORE_LOCATION: "wnam" });
  const s = await call(mf, `op=selftest&token=${PRB}`);
  assert.deepEqual([s.status, s.j.ok, s.j.store_location, s.j.store_generation], [200, true, "wnam", 1]);
  for (const v of [ADM, PRB]) assert.equal(s.text.includes(v), false, "never returns a secret");
  const bare = await call(await plane(), `op=selftest&token=${PRB}`);
  assert.deepEqual([bare.status, bare.j.store_location, bare.j.store_generation], [200, null, 1]);
});
