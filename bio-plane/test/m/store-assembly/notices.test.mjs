/* store-assembly's copy of plane's test of this name (K624: by copy). store-assembly R2, R3, R6 over the modules T23 composes: `network-notices` built at its place (after project-stage),
   migrated in R3's pass, its start registrations held (public-read R18, scheduler R5) and its ops map spread into the
   route map; and `corpus-export`'s ops map (its R6; N483, K1122) spread, so `op=export` and `op=exportlog` reach it
   through control-plane's door. Each driven on the Durable Object class itself. The sweep's composition (K1163, N506)
   is `sweep.test.mjs`'. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { store, storage, assembleStore } from "./fixture.mjs";
import { recordOf } from "../../../src/record-core/index.mjs";
import { publicReadOf } from "../../../src/public-read/index.mjs";
import { schedulerOf } from "../../../src/scheduler/index.mjs";
import { networkNoticesOf, networkNoticesOps, NETWORK_NOTICES_TABLES } from "../../../src/network-notices/index.mjs";
import { corpusExportOf, corpusExportOps, wholeExportOps } from "../../../src/corpus-export/index.mjs";

const tableNames = (x) => [...x.ctx.storage.sql.exec(`SELECT name FROM sqlite_master WHERE type='table'`)].map((r) => r.name);
const json = async (res) => ({ status: res.status, body: await res.json() });
/* Instants differ between two objects; everything else must not. */
const mask = (text) => text.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z/g, "<instant>").replace(/"(ms|feeds_ms)":[\d.]+/g, '"$1":"<n>"');

/* Every module that declared a table to purge, in declaration order (record-core R21), each named once. */
function declarers(x) {
  const rc = recordOf(x.ctx), out = [];
  for (const t of Object.keys(rc.purge().removed)) {
    const m = rc.declarePurge("zz-probe", [t]).declaredBy;
    if (!out.includes(m)) out.push(m);
  }
  return out;
}

test("R2: construction builds network-notices before the first request: its tables made and declared to purge under its name, no mint seed registered under its name (its notice ids are recorded through record-core R75, N503), its three public reads registered with public-read, and the scheduler holding its two consumers", async () => {
  const x = await store();
  const names = tableNames(x);
  for (const t of NETWORK_NOTICES_TABLES) assert.ok(names.includes(t), `table ${t}`);
  const rc = recordOf(x.ctx);
  for (const t of NETWORK_NOTICES_TABLES) assert.equal(rc.declarePurge("zz-probe", [t]).declaredBy, "network-notices", t);
  /* negative control: the probe tells a held seed from a free name, since ratification's seed (record-core R70) is held */
  assert.equal(rc.registerMintSeed("ratification", []).reason, "MINT_SEED_DECLARED", "a module that holds a seed is refused");
  const probe = rc.registerMintSeed("network-notices", []);
  assert.equal(probe.ok, true, "no seed is registered under network-notices' name (N503, record-core R75)");
  /* The instance the plane built is the one every later caller reaches, and its registration was accepted. */
  const n = networkNoticesOf(x.ctx);
  assert.deepEqual(n.publicReadsRegistration, { ok: true, module: "network-notices",
                                               names: ["activitymethod", "noticespublic", "groupkeyspublic"] });
  const reads = publicReadOf(x.ctx).publicReads().filter((r) => r.module === "network-notices").map((r) => r.name);
  assert.deepEqual(reads, ["activitymethod", "groupkeyspublic", "noticespublic"]);
  /* The scheduler reaches it for its two consumers, in R6's order (scheduler R5). */
  const consumers = schedulerOf(x.ctx).consumers();
  for (const c of ["working-on-seal", "working-on-attest"]) assert.ok(consumers.includes(c), `scheduler holds ${c}`);
  /* A public read answers through the store's door, served by network-notices' own method (R10). */
  const method = await json(await x.fetch("/publicread?name=activitymethod"));
  assert.equal(method.status, 200);
  assert.equal(method.body.result.module, "network-notices");
  assert.deepEqual(method.body.result.result, JSON.parse(JSON.stringify(n.activityMethod())));
});

test("R2 negative control: on a host where another module took network-notices' public-read names first, the plane's construction leaves that holder standing and network-notices' registration refused, so the reads are not its", async () => {
  const st = storage();
  const env = { STORE: { idFromName: (n) => n } };
  const squat = publicReadOf(st.ctx).registerPublicReads("zz-squatter", { noticespublic: () => ({ ok: true, squat: true }) });
  assert.equal(squat.ok, true);
  assembleStore(st.ctx, env);
  for (const p of st.blocked) await p;
  const n = networkNoticesOf(st.ctx);
  assert.equal(n.publicReadsRegistration.ok, false);
  assert.equal(n.publicReadsRegistration.reason, "PROVIDER_DECLARED");
  /* the squatter's read stands, and none of network-notices' is registered; case-checker's two (R17) and case-inputs' one
     (R15, K4221) are their own names */
  assert.deepEqual(publicReadOf(st.ctx).publicReads().map((r) => [r.name, r.module]),
    [["casechecker", "case-checker"], ["casedetailspublic", "case-inputs"], ["casefilespec", "case-checker"], ["noticespublic", "zz-squatter"]]);
});

test("R2: network-notices is built at its place in the modules' order: its purge declaration follows publication's and precedes every layer-9 and layer-10 module's", async () => {
  const order = declarers(await store());
  const at = (m) => { const i = order.indexOf(m); assert.notEqual(i, -1, `${m} declared: ${order.join()}`); return i; };
  assert.ok(at("publication") < at("network-notices"), "after publication");
  for (const m of ["conformance", "filing-templates", "monitoring"])
    assert.ok(at("network-notices") < at(m), `before ${m}`);
});

test("R3: a store written before network-notices opens with its tables: the migration pass creates them, and a second construction changes no table", async () => {
  const db = new DatabaseSync(":memory:");
  await store({ db });
  for (const t of NETWORK_NOTICES_TABLES) db.exec(`DROP TABLE IF EXISTS ${t}`);
  const old = await store({ db });
  for (const t of NETWORK_NOTICES_TABLES) assert.ok(tableNames(old).includes(t), `table ${t}`);
  const shape = (x) => [...x.ctx.storage.sql.exec(`SELECT type, name, sql FROM sqlite_master ORDER BY type, name`)].map((r) => ({ ...r }));
  const was = shape(old);
  const again = await store({ db });
  assert.deepEqual(shape(again), was, "the second migration changes no table");
  const stats = await json(await again.fetch("/stats"));
  assert.equal(stats.body.ok, true, "it answers");
});

test("R6: network-notices' four ops are in the route map at its place (after project-stage's, before promotion's) and each answers through control-plane's door what its own map answers called directly", async () => {
  const u = new URL("http://do/");
  const ops = Object.keys(networkNoticesOps(null, u, null));
  assert.deepEqual(ops, ["noticeprepare", "noticepost", "notices", "directorysubmission"]);
  const x = await store(), twin = await store();
  const map = Object.keys(x.s.routes(u, null));
  for (const op of ops) assert.ok(map.includes(op), `the route map lacks ${op}`);
  const i = (op) => map.indexOf(op);
  assert.ok(i("projectstage") === -1 || i("projectstage") < i("noticeprepare"));
  assert.equal(i("notices") + 1, i("directorysubmission"));
  for (const op of ops) {
    const path = `${op}?viewer=member:nobody&by=member:nobody&project=PROJ-2026-none&case=CASE-2026-0001-none&edition=1`;
    const res = await x.fetch(`/${path}`, { method: "POST", body: JSON.stringify({ project: "PROJ-2026-none", digest: "0".repeat(64) }) });
    const url = new URL(`http://do/${path}`);
    const direct = await networkNoticesOps(networkNoticesOf(twin.ctx), url, { project: "PROJ-2026-none", digest: "0".repeat(64) })[op]();
    assert.equal(res.status, 200, op);
    const body = JSON.parse(mask(await res.text()));
    assert.deepEqual(body, JSON.parse(mask(JSON.stringify({ ok: true, result: direct }))), op);
    assert.equal(body.result.ok, false, `${op}: an unseen project is network-notices' own refusal`);
  }
  /* negative control: a name network-notices does not serve is the door's refusal */
  assert.deepEqual(await json(await x.fetch("/noticewithdraw")), { status: 400, body: { ok: false, error: "unknown op: noticewithdraw" } });
});

test("R6 (N483, K1122, K1640): `op=export`, `op=exportlog`, `op=exportpage` and `op=exportrender` reach corpus-export through control-plane's door: an export answered, logged with its note, and read back from the log; the map's arms are corpus-export's own", async () => {
  const u = new URL("http://do/");
  const arms = ["export", "exportlog", "exportpage", "exportrender"];
  assert.deepEqual(Object.keys(corpusExportOps(null, () => null)), arms);
  /* F4 (corpus-export R17, R18): the whole-record arms, spread beside them from `wholeExportOps`, are pinned too */
  const whole = ["exportwhole", "exportwholepart"];
  assert.deepEqual(Object.keys(wholeExportOps(null, () => null)), whole);
  const x = await store();
  const map = x.s.routes(u, null);
  for (const op of [...arms, ...whole]) assert.ok(Object.hasOwn(map, op), `the route map holds ${op}`);
  /* each arm in the map is the one corpus-export's own map answers on the plane's instance */
  const own = corpusExportOps(corpusExportOf(x.ctx), (k) => u.searchParams.get(k));
  for (const op of ["exportpage", "exportrender"])
    assert.deepEqual(JSON.parse(JSON.stringify(await map[op]())), JSON.parse(JSON.stringify(await own[op]())), op);
  /* negative control: before any export, the log is empty */
  const empty = await json(await x.fetch("/exportlog"));
  assert.deepEqual([empty.status, empty.body.ok, empty.body.result.exports], [200, true, []]);
  const exp = await json(await x.fetch("/export?note=" + encodeURIComponent("quarterly copy")));
  assert.equal(exp.status, 200);
  assert.equal(exp.body.ok, true);
  const direct = JSON.parse(JSON.stringify(corpusExportOf(x.ctx).exportLog({ limit: 10 })));
  assert.equal(direct.exports.length, 1, "the export appended one row (corpus-export R1)");
  assert.equal(direct.exports[0].note, "quarterly copy");
  assert.equal(direct.exports[0].scope, "working-corpus");
  assert.ok(Array.isArray(exp.body.result.bundles), "the manifest answered (corpus-export R1)");
  const log = await json(await x.fetch("/exportlog?limit=5"));
  assert.deepEqual(log.body.result, { ...direct, limit: 5 }, "op=exportlog answers corpus-export's R2");
  /* the arm reads `limit`: one row asked, one delivered */
  await x.fetch("/export");
  const one = await json(await x.fetch("/exportlog?limit=1"));
  assert.deepEqual([one.body.result.exports.length, one.body.result.truncated], [1, true]);
});
