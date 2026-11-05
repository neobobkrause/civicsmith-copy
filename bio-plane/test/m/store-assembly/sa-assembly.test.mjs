/* store-assembly R1, R4, R5, R7, R8, R96, R97, R98, R99: the assembled store at its interface. `assembleStore` over a real
   node:sqlite storage (the fixture's), every module real. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { storage, store, assembleStore, namespaceOf } from "./fixture.mjs";
import * as entry from "../../../src/store-assembly/index.mjs";
import { traceStamped } from "../../../src/store-assembly/index.mjs";
import { recordOf } from "../../../src/record-core/index.mjs";
import { list as profiles } from "../../../../jurisdictions/index.mjs";

const ROOT = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const SRC = join(ROOT, "bio-plane", "src", "store-assembly");
const env0 = () => ({ STORE: { idFromName: (n) => n } });
const settle = async (blocked, from = 0) => { const out = []; for (const p of blocked.slice(from)) out.push(await p); return out; };
/* the object's background work too (extraction's repairs, handed to waitUntil), so a snapshot is not taken mid-run */
const settled = async (st) => { const out = await settle(st.blocked); for (let i = 0; i < st.waited.length; i++) await st.waited[i]; return out; };
const snapshot = (db) => {
  const t = db.prepare("SELECT name, sql FROM sqlite_master ORDER BY name").all();
  return { schema: t.map((r) => `${r.name}:${r.sql}`).join("\n"),
           counts: Object.fromEntries(t.filter((r) => r.sql && /^CREATE TABLE/i.test(r.sql))
             .map((r) => [r.name, db.prepare(`SELECT count(*) c FROM "${r.name}"`).get().c])) };
};

/* ---- R1 ---- */

test("R1: assembleStore answers the assembled store {routes, dispatch, namespace, nowMs, read}, its migration and starts handed to blockConcurrencyWhile, the last answering instance-setup's start", async () => {
  const st = storage();
  const a = assembleStore(st.ctx, env0());
  assert.deepEqual(Object.keys(a).sort(), ["dispatch", "namespace", "nowMs", "read", "routes"]);
  for (const k of Object.keys(a)) assert.equal(typeof a[k], "function", k);
  assert.ok(Object.isFrozen(a));
  const answers = await settle(st.blocked);
  assert.equal(answers.length, 4, "the migration, the scheduler's start, ai-catalogue's start (F1), instance-setup's start");
  assert.equal(answers[3].ok, true);
  assert.equal(answers[3].started, true);
  /* the migrated store holds the ledger's tables and the owners' */
  const tables = new Set(st.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name));
  for (const t of ["keeps_pending", "keeps_last", "acquire_stages", "job_unit_attempts", "job_batches", "bundles", "members"]) assert.ok(tables.has(t), t);
});

test("R1: two calls over one storage start instance-setup once and migrate idempotently; a second object over the same database adds no row and no table", async () => {
  const db = new DatabaseSync(":memory:");
  const st = storage(db), env = env0();   /* the runtime hands one object its one env */
  assembleStore(st.ctx, env);
  await settled(st);
  const first = snapshot(db);
  const n = st.blocked.length;
  assembleStore(st.ctx, env);
  const again = await settle(st.blocked, n);
  assert.equal(again[again.length - 1].started, false, "instance-setup's start is not run twice on one storage");
  const second = snapshot(db);
  assert.equal(second.schema, first.schema, "no second migration changes the schema");
  assert.deepEqual(second.counts, first.counts, "and writes no row");
  /* control: a fresh object (a restart) over the same database starts, and its migration and start add nothing */
  const st2 = storage(db);
  assembleStore(st2.ctx, env0());
  const restarted = await settled(st2);
  assert.equal(restarted[restarted.length - 1].started, true);
  const third = snapshot(db);
  assert.equal(third.schema, first.schema);
  assert.deepEqual(third.counts, first.counts);
});

test("R1: a module that fails to build answers no store; a migration that throws leaves the object's blocked work refused", async () => {
  const broken = storage();
  const exec = broken.ctx.storage.sql.exec;
  broken.ctx.storage.sql.exec = () => { throw new Error("storage refused"); };
  assert.throws(() => assembleStore(broken.ctx, env0()), /storage refused/);
  broken.ctx.storage.sql.exec = exec;
  /* a migration statement that throws: the ledger's own table */
  const st = storage();
  const real = st.ctx.storage.sql.exec.bind(st.ctx.storage.sql);
  st.ctx.storage.sql.exec = (q, ...a) => { if (/CREATE TABLE IF NOT EXISTS job_batches/.test(q)) throw new Error("migration refused"); return real(q, ...a); };
  let a = null;
  try { a = assembleStore(st.ctx, env0()); } catch (e) { assert.match(String(e.message), /migration refused/); }
  if (a !== null) await assert.rejects(Promise.all(st.blocked), /migration refused/);
});


/* ---- R4 ---- */

test("R4: namespaceOf answers bio, scratch, bio for bio~g2 (the generation on the room's name only), null for a private instance; namespace() answers bio for null", () => {
  const ctxNamed = (name) => ({ id: { equals: (other) => other === name } });
  assert.equal(namespaceOf(ctxNamed("bio"), env0()), "bio");
  assert.equal(namespaceOf(ctxNamed("scratch"), env0()), "scratch");
  assert.equal(namespaceOf(ctxNamed("bio~g2"), { ...env0(), STORE_GENERATION: "2" }), "bio");
  assert.equal(namespaceOf(ctxNamed("scratch~g2"), { ...env0(), STORE_GENERATION: "2" }), "scratch");
  /* a room of another generation is no current room: null, as any other object */
  assert.equal(namespaceOf(ctxNamed("bio"), { ...env0(), STORE_GENERATION: "2" }), null);
  assert.equal(namespaceOf(ctxNamed("private"), env0()), null);
  /* never a guess: no STORE binding, no id, no equals */
  assert.equal(namespaceOf(ctxNamed("bio"), {}), null);
  assert.equal(namespaceOf({}, env0()), null);
});

test("R4: the assembled store's namespace() is bio for an object whose name is unknown, and its own name otherwise", async () => {
  const priv = storage();
  assert.equal(assembleStore(priv.ctx, env0()).namespace(), "bio");
  await settle(priv.blocked);
  const scratch = storage();
  scratch.ctx.id = { equals: (o) => o === "scratch", toString: () => "scratch" };
  const a = assembleStore(scratch.ctx, env0());
  await settle(scratch.blocked);
  assert.equal(a.namespace(), "scratch");
});

/* ---- R5 ---- */

test("R5: nowMs is an explicit instant, else env.BIO_NOW_MS, else the wall clock; null and the empty string fall through, never to 0", async () => {
  const st = storage();
  const pinned = assembleStore(st.ctx, { ...env0(), BIO_NOW_MS: 1_700_000_000_000 });
  await settle(st.blocked);
  assert.equal(pinned.nowMs(1234), 1234);
  assert.equal(pinned.nowMs("1234"), 1234);
  assert.equal(pinned.nowMs(null), 1_700_000_000_000);
  assert.equal(pinned.nowMs(""), 1_700_000_000_000);
  assert.equal(pinned.nowMs(undefined), 1_700_000_000_000);
  assert.equal(pinned.nowMs(-5), 1_700_000_000_000, "a negative instant is no instant");
  assert.equal(pinned.nowMs("not a time"), 1_700_000_000_000);
  const st2 = storage();
  const wall = assembleStore(st2.ctx, env0());
  await settle(st2.blocked);
  const before = Date.now(), t = wall.nowMs(null), after = Date.now();
  assert.ok(t >= before && t <= after, "the wall clock");
  assert.notEqual(wall.nowMs(""), 0);
});

/* ---- R7 ---- */

test("R7: dispatch answers a store request through store-door's frame: a route's answer in its envelope, an unknown op refused, and no header of the class's", async () => {
  const { s, routes } = await store();
  const res = await s.dispatch(new Request("http://do/coarchivestate"));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("server-timing"), null, "the assembled store adds no header; the class stamps object;dur");
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.deepEqual(body.result, JSON.parse(JSON.stringify(routes("/coarchivestate").coarchivestate())));
  const unknown = await s.dispatch(new Request("http://do/nosuchop"));
  assert.equal(unknown.status, 400);
  assert.equal((await unknown.json()).ok, false);
});

/* ---- R8 ---- */

test("R8: read(op, params) answers a synchronous read as its route does, with params on the in-process address; an op the map lacks answers null", async () => {
  const { s, routes } = await store();
  assert.deepEqual(s.read("coarchivestate", {}), routes("/coarchivestate").coarchivestate());
  const sha = "a".repeat(64);
  assert.deepEqual(s.read("jobrow", { sha, kind: "reading" }), routes(`/jobrow?sha=${sha}&kind=reading`).jobrow());
  assert.deepEqual(s.read("jobrow", { sha, kind: "reading" }), { ok: true, row: null });
  assert.deepEqual(s.read("jobrow", { sha: "nope", kind: "reading", viewer: null }), { ok: false, reason: "BAD_SHA" }, "a null param is not set");
  assert.equal(s.read("nosuchop", { viewer: "admin" }), null);
});

/* ---- R96 ---- */

const MODULES = JSON.parse(readFileSync(join(ROOT, "build", "modules.json"), "utf8")).modules;
const ORDER = MODULES.map((m) => m.id);
/* the module whose `paths` hold `file` (repository-relative), the longest match */
function ownerOfFile(file) {
  let best = null, len = -1;
  for (const m of MODULES) for (const p of m.paths || []) {
    const hit = p.endsWith("/") ? file.startsWith(p) : file === p;
    if (hit && p.length > len) { best = m.id; len = p.length; }
  }
  return best;
}
const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*["']([^"']+)["']|(?:^|\n)\s*import\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
/* every import of the module's own source, judged against the order: `{file, spec, owner, problem}` for each that is not
   an earlier module's (or this module's own), and each platform import */
export function importCensus(files) {
  const me = ORDER.indexOf("store-assembly");
  const out = [];
  for (const { file, text } of files) {
    for (const m of text.matchAll(IMPORT)) {
      const spec = m[1] || m[2] || m[3];
      if (spec.startsWith("node:")) continue;
      if (!spec.startsWith(".")) { out.push({ file, spec, owner: null, problem: "platform" }); continue; }
      const target = relative(ROOT, resolve(dirname(join(ROOT, file)), spec)).split("\\").join("/");
      const owner = ownerOfFile(target);
      const at = ORDER.indexOf(owner);
      if (owner === null || at === -1) out.push({ file, spec, owner, problem: "unowned" });
      else if (at > me) out.push({ file, spec, owner, problem: "later" });
    }
  }
  return out;
}
const sources = () => readdirSync(SRC).filter((f) => f.endsWith(".mjs"))
  .map((f) => ({ file: `bio-plane/src/store-assembly/${f}`, text: readFileSync(join(SRC, f), "utf8") }));

test("R96: every import of the module's source is a module earlier in build/modules.json (or its own), and none is the platform's", () => {
  assert.deepEqual(importCensus(sources()), []);
  for (const { file, text } of sources()) assert.doesNotMatch(text, /cloudflare:/, file);
});

test("R96 control: an import of control-plane, interface-shell or plane, or of cloudflare:workers, fails the census by name", () => {
  const fake = [{ file: "bio-plane/src/store-assembly/x.mjs", text: [
    `import { deliverOwedRender } from "../control-plane/index.mjs";`,
    `import { ADMIN_ACTS } from "../interface-shell/index.mjs";`,
    `import { Store } from "../plane/store.mjs";`,
    `import { DurableObject } from "cloudflare:workers";`].join("\n") }];
  const found = importCensus(fake);
  assert.deepEqual(found.map((f) => [f.owner, f.problem]),
    [["control-plane", "later"], ["interface-shell", "later"], ["plane", "later"], [null, "platform"]]);
});

/* ---- R97 ---- */

test("R97: the module's own tables are the owed-work ledger's five, declared to record-core's purge as a whole-store clear under store-assembly", async () => {
  const created = new Set();
  for (const { text } of sources()) for (const m of text.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(/g)) created.add(m[1]);
  assert.deepEqual([...created].sort(), ["acquire_stages", "job_batches", "job_unit_attempts", "keeps_last", "keeps_pending"]);
  /* every row the module writes itself is in one of them */
  for (const { file, text } of sources())
    for (const m of text.matchAll(/(?:INSERT INTO|(?<!DO )UPDATE|DELETE FROM)\s+(\w+)/g))
      assert.ok(created.has(m[1]) || m[1] === "keeps_pending_old", `${file} writes ${m[1]}`);
  const { ctx } = await store();
  for (const t of created) {
    const again = recordOf(ctx).declarePurge("someone-else", [t]);
    assert.equal(again.ok, false, t);
    assert.equal(again.reason ?? again.code, "TABLE_DECLARED");
    assert.equal(again.declaredBy, "store-assembly", `${t} is held by this module`);
  }
});

test("R97: no place is named in the module's behaviour or outward text", () => {
  const names = profiles().filter((p) => !p.test).flatMap((p) => [p.name, ...(p.covers || [])]).filter((n) => typeof n === "string" && n.length > 3);
  assert.ok(names.length > 0, "the held profiles name places");
  for (const { file, text } of sources()) for (const n of names) assert.ok(!text.includes(n), `${file} names ${n}`);
});

/* ---- R98 ---- */

test.todo("R98: when the split closes, plane holds the Store class, index.mjs, door.mjs, watchdog.mjs and the config and none of the copied files, control-plane holds no owner-ops.mjs, and no file imports a deleted path (Wave B, plane's and control-plane's jobs; K5125)");

/* ---- R99 ---- */

const R99_EXPORTS = ["ACTION_DRAFT_OPS", "FIRST_LAYER_11", "STEP_ORDER", "actionDraftOp", "askOnObject", "askOp", "assembleStore",
                     "draftOnObject", "namespaceOf", "stepOrderFrom", "traceStamped"];

test("R99: the module's entry exports exactly R99's names (storeWorld from the tests), ACTION_DRAFT_OPS is the two action drafts", () => {
  assert.deepEqual(Object.keys(entry).sort(), R99_EXPORTS);
  assert.deepEqual([...entry.ACTION_DRAFT_OPS], ["infractiondraft", "bearingdraft"]);
  assert.ok(Object.isFrozen(entry.ACTION_DRAFT_OPS));
  assert.equal(entry.FIRST_LAYER_11, "wizard-scripts");
});

test("R99: plane imports from this module only R99's names, and no file of it by path but its entry", () => {
  const planeSrc = join(ROOT, "bio-plane", "src", "plane");
  for (const f of readdirSync(planeSrc).filter((x) => x.endsWith(".mjs"))) {
    const text = readFileSync(join(planeSrc, f), "utf8");
    for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']([^"']*store-assembly[^"']*)["']/g)) {
      assert.match(m[2], /store-assembly\/index\.mjs$/, `${f} imports ${m[2]} by path`);
      for (const name of m[1].split(",").map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean))
        assert.ok(R99_EXPORTS.includes(name), `${f} imports ${name}`);
    }
    assert.doesNotMatch(text.replace(/store-assembly\/index\.mjs/g, ""), /store-assembly\//, `${f} names a file of store-assembly by path`);
  }
});

test("R99: traceStamped sets an acquire's trace from x-civicsmith-trace and removes the caller's own; any other request passes as it came", async () => {
  const stamped = await traceStamped(new Request("http://do/acquire?trace=forged&url=x", { method: "POST",
    headers: { "x-civicsmith-trace": "door-trace-1" }, body: JSON.stringify({ a: 1 }) }));
  const u = new URL(stamped.url);
  assert.deepEqual(u.searchParams.getAll("trace"), ["door-trace-1"]);
  assert.equal(u.searchParams.get("url"), "x");
  assert.deepEqual(await stamped.json(), { a: 1 });
  /* a header that is no trace (a space, too long): none set, the caller's still removed */
  for (const h of ["has space", "x".repeat(201)]) {
    const r = await traceStamped(new Request("http://do/acquire?trace=forged", { method: "POST", headers: { "x-civicsmith-trace": h }, body: "{}" }));
    assert.equal(new URL(r.url).searchParams.get("trace"), null, h.slice(0, 12));
  }
  /* controls: another op, and acquire by GET, pass as they came */
  const other = new Request("http://do/capture?trace=t", { method: "POST", headers: { "x-civicsmith-trace": "door" }, body: "{}" });
  assert.equal(await traceStamped(other), other);
  const get = new Request("http://do/acquire?trace=t", { headers: { "x-civicsmith-trace": "door" } });
  assert.equal(await traceStamped(get), get);
});
