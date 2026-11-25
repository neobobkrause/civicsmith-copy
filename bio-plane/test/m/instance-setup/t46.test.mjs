/* T46 (T46-50): a member's explanation level (R79), op=bootstrap's test_instance (R80) and parts (R81), agent-runner read
   through agent-worker's /version (R17) and the disclosure before a sign-in (R54), at the module's interface. */
import test from "node:test";
import assert from "node:assert/strict";
import { boot, frame, io, read } from "./fixture.mjs";
import { INSTANCE_SETUP_CHECKS, INSTANCE_SETUP_TABLES, INSTANCE_SETUP_TABLE_DECLARATIONS, INFO_LEVELS, INFO_LEVEL_DEFAULT,
         ASSISTANT_DISCLOSURE, bootstrapReport, memberVersions, FLEET_BINDINGS } from "../../../src/setup.mjs";

const call = async (m, path, body) => (await frame(m, new Request(`http://do/${path}`,
  body === undefined ? undefined : { method: "POST", body: JSON.stringify(body) }))).json();
const levelRows = (w) => w.st.db.prepare(`SELECT * FROM member_info_levels`).all();
const at = (s) => () => Date.parse(s);

/* ---- R79: a member's explanation level ---- */

test("R79 infoLevelSet records the member's own level, prompt or pause, appended with when; infoLevel answers the viewer's own {level, set_at, asked_at} and nobody else's; a new member starts at prompt with set_at and asked_at null", async () => {
  let now = "2026-10-12T09:00:00Z";
  const w = await boot({ now: () => Date.parse(now) });
  assert.deepEqual(INFO_LEVELS, ["prompt", "pause"]);
  assert.equal(INFO_LEVEL_DEFAULT, "prompt");
  assert.deepEqual(w.m.infoLevel({ viewer: "ruth" }), { ok: true, level: "prompt", set_at: null, asked_at: null });
  const r = w.m.infoLevelSet({ level: "pause", by: "ruth" });
  assert.deepEqual([r.ok, r.member, r.level, r.set_at, r.asked_at], [true, "ruth", "pause", "2026-10-12T09:00:00.000Z", null]);
  assert.deepEqual(w.m.infoLevel({ viewer: "ruth" }), { ok: true, level: "pause", set_at: "2026-10-12T09:00:00.000Z", asked_at: null });
  /* nobody else's: another member still reads the default */
  assert.deepEqual(w.m.infoLevel({ viewer: "ada" }), { ok: true, level: "prompt", set_at: null, asked_at: null });
  assert.deepEqual(w.m.infoLevel({ viewer: null }).level, "prompt");
  now = "2026-10-12T10:00:00Z";
  w.m.infoLevelSet({ level: "prompt", by: "ruth" });
  assert.deepEqual(w.m.infoLevel({ viewer: "ruth" }), { ok: true, level: "prompt", set_at: "2026-10-12T10:00:00.000Z", asked_at: null });
  /* appended: every set kept */
  assert.deepEqual(levelRows(w).map((x) => [x.member, x.level, x.set_at]),
    [["ruth", "pause", "2026-10-12T09:00:00.000Z"], ["ruth", "prompt", "2026-10-12T10:00:00.000Z"]]);
});

test("R79 asked: true records asked_at in the same act, and a later set without asked (or with asked: false, or asked: true again) keeps the first answer's instant", async () => {
  let now = "2026-11-12T09:00:00Z";
  const w = await boot({ now: () => Date.parse(now) });
  w.m.infoLevelSet({ level: "pause", by: "ruth" });
  assert.equal(w.m.infoLevel({ viewer: "ruth" }).asked_at, null, "control: a set without asked records none");
  now = "2026-11-13T09:00:00Z";
  const r = w.m.infoLevelSet({ level: "prompt", asked: true, by: "ruth" });
  assert.equal(r.asked_at, "2026-11-13T09:00:00.000Z");
  for (const [t, args] of [["2026-11-14T09:00:00Z", { level: "pause" }], ["2026-11-15T09:00:00Z", { level: "prompt", asked: false }],
                           ["2026-11-16T09:00:00Z", { level: "pause", asked: true }]]) {
    now = t;
    w.m.infoLevelSet({ ...args, by: "ruth" });
    assert.deepEqual(w.m.infoLevel({ viewer: "ruth" }), { ok: true, level: args.level, set_at: new Date(t).toISOString(),
                                                          asked_at: "2026-11-13T09:00:00.000Z" }, JSON.stringify(args));
  }
  /* one member's answer is not another's */
  w.m.infoLevelSet({ level: "pause", by: "ada" });
  assert.equal(w.m.infoLevel({ viewer: "ada" }).asked_at, null);
});

test("R79 refusals, each writing nothing: a missing or machine by MACHINE_CANNOT_SET_INFO_LEVEL (C-64.28); a level other than prompt or pause, or an asked other than absent, true or false, INFO_LEVEL_UNKNOWN (C-64.29); control: a member's well-formed set records", async () => {
  const w = await boot();
  assert.equal(INSTANCE_SETUP_CHECKS.MACHINE_CANNOT_SET_INFO_LEVEL.check, "C-64.28");
  assert.equal(INSTANCE_SETUP_CHECKS.INFO_LEVEL_UNKNOWN.check, "C-64.29");
  for (const [args, code] of [
    [{ level: "pause" }, "MACHINE_CANNOT_SET_INFO_LEVEL"], [{ level: "pause", by: " " }, "MACHINE_CANNOT_SET_INFO_LEVEL"],
    [{ level: "pause", by: "class:ai" }, "MACHINE_CANNOT_SET_INFO_LEVEL"], [{ level: "pause", by: "class:probe" }, "MACHINE_CANNOT_SET_INFO_LEVEL"],
    [{ by: "ruth" }, "INFO_LEVEL_UNKNOWN"], [{ level: "", by: "ruth" }, "INFO_LEVEL_UNKNOWN"],
    [{ level: "hidden", by: "ruth" }, "INFO_LEVEL_UNKNOWN"], [{ level: "Prompt", by: "ruth" }, "INFO_LEVEL_UNKNOWN"],
    [{ level: 1, by: "ruth" }, "INFO_LEVEL_UNKNOWN"], [{ level: "pause", asked: "yes", by: "ruth" }, "INFO_LEVEL_UNKNOWN"],
    [{ level: "pause", asked: 1, by: "ruth" }, "INFO_LEVEL_UNKNOWN"]]) {
    const r = w.m.infoLevelSet(args);
    const row = INSTANCE_SETUP_CHECKS[code];
    assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation], [false, code, code, row.check, row.translation], JSON.stringify(args));
    assert.equal(typeof r.detail, "string");
  }
  assert.equal(levelRows(w).length, 0, "nothing written on a refusal");
  for (const code of ["MACHINE_CANNOT_SET_INFO_LEVEL", "INFO_LEVEL_UNKNOWN"]) {
    const row = INSTANCE_SETUP_CHECKS[code];
    assert.match(row.where, /^src\/setup\.mjs infoLevelSet > is-info-level$/);
    assert.match(row.translation, /Nothing was changed\.$/);
    assert.doesNotMatch(row.translation, /\b(copy|instance|plane|server)\b/i);
  }
  /* control */
  assert.equal(w.m.infoLevelSet({ level: "pause", asked: false, by: "ruth" }).ok, true);
  assert.equal(levelRows(w).length, 1);
});

test("R79 through the routes: infolevelset's by and infolevel's viewer are the control plane's stamps from the query, so a body naming another member sets nothing for her and a read answers only the viewer's own", async () => {
  const w = await boot();
  const set = await call(w.m, "infolevelset?by=ruth", { level: "pause", asked: true, by: "ada" });
  assert.deepEqual([set.result.ok, set.result.member, set.result.level], [true, "ruth", "pause"]);
  assert.equal((await call(w.m, "infolevel?viewer=ruth")).result.level, "pause");
  assert.equal((await call(w.m, "infolevel?viewer=ada")).result.level, "prompt");
  const noBy = await call(w.m, "infolevelset", { level: "pause", by: "ada" });
  assert.equal(noBy.result.reason, "MACHINE_CANNOT_SET_INFO_LEVEL");
  assert.equal(levelRows(w).length, 1);
});

test("R79 R28 member_info_levels is this module's own table, declared to record-core exempt from purge in R64's class", () => {
  assert.equal(INSTANCE_SETUP_TABLES.includes("member_info_levels"), true);
  const d = INSTANCE_SETUP_TABLE_DECLARATIONS.find((t) => t.name === "member_info_levels");
  const lang = INSTANCE_SETUP_TABLE_DECLARATIONS.find((t) => t.name === "member_languages");
  assert.deepEqual({ ...d, name: null }, { ...lang, name: null });
  assert.equal(d.purge, "exempt");
});

/* ---- R80, R81, R17: op=bootstrap ---- */

const stub = { async fetch() { return Response.json({ ok: true, result: { claimed: false, rearmed: false, consumedAt: null, storeVersion: "s" } }); } };
const bootBody = async (env, opts = {}) => (await read(await bootstrapReport(env, "fp", { stub, ...io, ...opts }))).body;
/* A member answering its own /version, counting the calls it is asked. */
const member = (body, status = 200) => {
  const b = { calls: 0, async fetch(url) { b.calls += 1; b.url = String(url); return new Response(JSON.stringify(body), { status }); } };
  return b;
};
const never = () => ({ calls: 0, fetch() { this.calls += 1; return new Promise(() => {}); } });
const worker = (runner, more = {}) => member({ ok: true, name: "agent-worker", version: "aw-9", ...(runner === undefined ? {} : { runner }), ...more });
const scanner = () => member({ name: "file-scanner", version: "fs-2" });

test("R80 op=bootstrap answers test_instance true exactly when ai-runs.testInstance() does (CIVICSMITH_TEST_INSTANCE equal to INSTANCE_NAME, both non-empty); control: unequal, empty or absent answers false, and nothing the store answers sets it", async () => {
  assert.equal((await bootBody({ INSTANCE_NAME: "biosmoke7", CIVICSMITH_TEST_INSTANCE: "biosmoke7" })).test_instance, true);
  for (const env of [{ INSTANCE_NAME: "biosmoke7", CIVICSMITH_TEST_INSTANCE: "biosmoke8" },
                     { INSTANCE_NAME: "biosmoke7", CIVICSMITH_TEST_INSTANCE: "" }, { INSTANCE_NAME: "", CIVICSMITH_TEST_INSTANCE: "" },
                     { INSTANCE_NAME: "biosmoke7" }, { CIVICSMITH_TEST_INSTANCE: "biosmoke7" }, {},
                     { INSTANCE_NAME: "biosmoke7", CIVICSMITH_TEST_INSTANCE: "yes" },
                     { INSTANCE_NAME: 7, CIVICSMITH_TEST_INSTANCE: 7 }])
    assert.equal((await bootBody(env)).test_instance, false, JSON.stringify(env));
  /* a store answer carrying the key does not set it: the fact is the deployment's alone */
  const lying = { async fetch() { return Response.json({ ok: true, result: { test_instance: true, parts: "x", part_signin: true } }); } };
  const b = (await read(await bootstrapReport({ INSTANCE_NAME: "biosmoke7" }, "fp", { stub: lying, ...io }))).body;
  assert.equal(b.test_instance, false);
  /* R82: nor do the parts: the retired nested key is never relayed, and the flat keys are the deployment's */
  assert.deepEqual(["parts" in b, b.part_signin], [false, false]);
  /* it names no value of the variable */
  const t = JSON.stringify(await bootBody({ INSTANCE_NAME: "biosmoke7", CIVICSMITH_TEST_INSTANCE: "biosmoke7" }));
  assert.equal(t.includes("CIVICSMITH_TEST_INSTANCE"), false);
});

const PART_KEYS = ["part_signin", "part_scanner", "part_safe_view"];
const partsOf = async (env, opts) => {
  const b = await bootBody(env, opts);
  assert.equal("parts" in b, false, "R82: no nested parts key");
  return Object.fromEntries(PART_KEYS.map((k) => [k, b[k]]));
};
const P = (signin, scan) => ({ part_signin: signin, part_scanner: scan, part_safe_view: scan });

test("R81 R82 op=bootstrap answers the parts as three flat scalar keys part_signin, part_scanner, part_safe_view, without members=1: a fleet with no agent-runner and no FILE_SCANNER answers all three false; part_signin follows R17's agent-runner answer, part_scanner and part_safe_view FILE_SCANNER's, always alike", async () => {
  assert.deepEqual(await partsOf({}), P(false, false));
  assert.deepEqual(await partsOf({ AGENT_WORKER: worker(false) }), P(false, false), "agent-worker without its runner: no sign-in");
  assert.deepEqual(await partsOf({ AGENT_WORKER: worker(true), FILE_SCANNER: scanner() }), P(true, true));
  assert.deepEqual(await partsOf({ AGENT_WORKER: worker(true) }), P(true, false));
  assert.deepEqual(await partsOf({ FILE_SCANNER: scanner() }), P(false, true));
  /* an AGENT_RUNNER binding on the plane decides nothing: the runner is agent-worker's */
  assert.deepEqual(await partsOf({ AGENT_RUNNER: member({ name: "agent-runner", version: "r" }), AGENT_WORKER: worker(false) }), P(false, false));
  /* could not be read: null, never false */
  assert.deepEqual(await partsOf({ AGENT_WORKER: member({ error: "x" }, 500), FILE_SCANNER: member({ name: "pdf-worker", version: "p" }) }), P(null, null));
  assert.deepEqual(await partsOf({ AGENT_WORKER: worker(undefined) }), P(null, false), "an agent-worker that says nothing of its runner");
  assert.deepEqual(await partsOf({ AGENT_WORKER: worker("yes") }), P(null, false));
  /* each part names no reason beyond the part: a scalar, never a nested value */
  for (const v of Object.values(await partsOf({ AGENT_WORKER: worker(true) }))) assert.ok([true, false, null].includes(v));
  /* asked once each, also with members=1 (the members' own answers are read for both) */
  const aw = worker(true), fs = scanner();
  assert.deepEqual(await partsOf({ AGENT_WORKER: aw, FILE_SCANNER: fs }, { members: true }), P(true, true));
  assert.deepEqual([aw.calls, fs.calls], [1, 1]);
});

test("R81 R82 a FILE_SCANNER that does not answer in time answers part_scanner: null and part_safe_view: null (control: one that answers is true)", { timeout: 20000 }, async () => {
  const t0 = Date.now();
  assert.deepEqual(await partsOf({ AGENT_WORKER: worker(true), FILE_SCANNER: never() }), P(true, null));
  assert.ok(Date.now() - t0 < 10000, "bounded by R17's wait");
  assert.deepEqual(await partsOf({ AGENT_WORKER: worker(true), FILE_SCANNER: scanner() }), P(true, true));
});

test("R17 (T46) memberVersions reads agent-runner from agent-worker's /version runner: SERVING with agent-worker's version on runner: true, UNBOUND on runner: false, and agent-worker's own state (UNBOUND, SILENT, MISNAMED) otherwise, never UNBOUND merely because the plane holds no AGENT_RUNNER binding", async () => {
  assert.deepEqual(FLEET_BINDINGS.find(([m]) => m === "agent-runner"), ["agent-runner", "AGENT_RUNNER"]);
  const run = async (env) => (await memberVersions(env))["agent-runner"];
  assert.deepEqual(await run({ AGENT_WORKER: worker(true) }), { binding: "AGENT_WORKER", via: "agent-worker", state: "SERVING", version: "aw-9" });
  assert.deepEqual(await run({ AGENT_WORKER: worker(false) }), { binding: "AGENT_WORKER", via: "agent-worker", state: "UNBOUND" });
  /* control: the plane's own AGENT_RUNNER binding (or its absence) is not what is read */
  const own = member({ name: "agent-runner", version: "r-1" });
  assert.deepEqual(await run({ AGENT_RUNNER: own, AGENT_WORKER: worker(false) }), { binding: "AGENT_WORKER", via: "agent-worker", state: "UNBOUND" });
  assert.equal(own.calls, 0);
  assert.equal((await run({ AGENT_WORKER: worker(true) })).state, "SERVING", "SERVING with no AGENT_RUNNER binding on the plane");
  /* agent-worker's own state otherwise */
  assert.deepEqual(await run({}), { binding: "AGENT_WORKER", via: "agent-worker", state: "UNBOUND" });
  const silent = await run({ AGENT_WORKER: member({}, 503) });
  assert.deepEqual([silent.state, silent.binding, silent.via, typeof silent.why], ["SILENT", "AGENT_WORKER", "agent-worker", "string"]);
  assert.deepEqual(await run({ AGENT_WORKER: member({ name: "pdf-worker", version: "p-1", runner: true }) }),
    { binding: "AGENT_WORKER", via: "agent-worker", state: "MISNAMED", name: "pdf-worker", version: "p-1" });
  const unsaid = await run({ AGENT_WORKER: worker(undefined) });
  assert.deepEqual([unsaid.state, typeof unsaid.why], ["SILENT", "string"], "served without runner: unread, never SERVING");
  /* agent-worker asked once, its own entry unchanged */
  const aw = worker(true);
  const all = await memberVersions({ AGENT_WORKER: aw });
  assert.deepEqual(all["agent-worker"], { binding: "AGENT_WORKER", state: "SERVING", version: "aw-9" });
  assert.equal(aw.calls, 1);
  assert.equal(aw.url, "https://agent-worker/version");
});

test("R82 the pre-auth answer holds no nested object or array, and its key set is exactly membership R132's (control: with members=1 the credentialed memberVersions is the one nested addition)", async () => {
  const R132_KEYS = ["bootstrapConfigured", "claimed", "consumedAt", "ok", "rearmed", "service", "storeVersion", "version",
    "test_instance", "part_signin", "part_scanner", "part_safe_view"];
  for (const env of [{}, { AGENT_WORKER: worker(true), FILE_SCANNER: scanner() }, { AGENT_WORKER: member({}, 503) }]) {
    const b = await bootBody(env);
    assert.deepEqual(Object.keys(b).sort(), [...R132_KEYS].sort(), JSON.stringify(Object.keys(env)));
    for (const [k, v] of Object.entries(b)) assert.ok(v === null || typeof v !== "object", `${k} is not nested`);
  }
  const withMembers = await bootBody({}, { members: true });
  assert.deepEqual(Object.keys(withMembers).filter((k) => !R132_KEYS.includes(k)), ["memberVersions"]);
});

/* ---- R54: the disclosure before a sign-in ---- */

test("R54 (T46) disclosureOf answers shown: false for a member with no disclosure recorded at the current version before a sign-in, whatever her account (none set, a sign-in connected), and shown: true once disclosureShown records it", async () => {
  const w = await boot({ now: at("2026-10-12T09:00:00Z") });
  const v = ASSISTANT_DISCLOSURE.version;
  /* a sign-in about to start: no reference, nothing recorded */
  assert.deepEqual([w.m.disclosureOf({ member: "ruth" }).shown, w.m.disclosureOf({ member: "ruth" }).shown_at], [false, null]);
  /* her account's state is not what is read: a credentials provider claiming her subscription connected changes nothing */
  w.prov.credentials.accountReferenceState = () => ({ ok: true, subscription: { connected: true, since: "2026-10-01T00:00:00Z" } });
  assert.equal(w.m.disclosureOf({ member: "ruth" }).shown, false);
  assert.equal(w.m.disclosureShown({ member: "ruth", version: v, by: "ruth" }).ok, true);
  assert.deepEqual(w.m.disclosureOf({ member: "ruth" }), { ok: true, member: "ruth", version: v, shown: true, shown_at: "2026-10-12T09:00:00.000Z" });
  /* through the route control-plane R65 reads before a sign-in's start */
  assert.equal((await call(w.m, "disclosureof?member=ruth")).result.shown, true);
  assert.equal((await call(w.m, "disclosureof?member=ada")).result.shown, false);
});

/* C92, C93 (fix round 2): the assistant's runner is read from agent-worker's `runner`, which agent-worker states as whether
   the remote class answered its version. A not-ready runner that answers it is a present part (part_signin true, the member
   SERVING through its binding); one that answers it 503 (the old stub) read false and UNBOUND although agent-worker served. */
test("R17 R81 R82 C92 C93 a runner that answers its version while not ready reads part_signin true and agent-runner SERVING through agent-worker's binding alone; the runner refusing its version reads false and UNBOUND (control: no agent-worker binding is UNBOUND)", async () => {
  /* agent-worker's /version states `runner` from the remote class's answer to its version request (agent-worker R110) */
  const asking = (remoteStatus) => ({
    async fetch() {
      return Response.json({ ok: true, name: "agent-worker", version: "aw-9", runner: remoteStatus === 200 });
    },
  });
  const notReady = asking(200), refused = asking(503);
  assert.deepEqual(await partsOf({ AGENT_WORKER: notReady }), P(true, false), "present and not ready: the part is there");
  assert.deepEqual((await memberVersions({ AGENT_WORKER: notReady }))["agent-runner"],
    { binding: "AGENT_WORKER", via: "agent-worker", state: "SERVING", version: "aw-9" }, "bound by its binding, not UNBOUND");
  assert.deepEqual(await partsOf({ AGENT_WORKER: refused }), P(false, false));
  assert.equal((await memberVersions({ AGENT_WORKER: refused }))["agent-runner"].state, "UNBOUND");
  assert.deepEqual(await partsOf({}), P(false, false), "a missing runner reads false");
  assert.equal((await memberVersions({}))["agent-runner"].state, "UNBOUND");
});
