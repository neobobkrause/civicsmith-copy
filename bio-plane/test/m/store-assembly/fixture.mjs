/* store-assembly's own test fixture: the assembled store (`assembleStore`, R1) built for real over a Durable Object storage at
   the platform's shape (node:sqlite behind `sql.exec` answering a cursor, as workerd's does), every module it builds real;
   nothing is stubbed. It answers the surface `plane`'s fixture answered for the tests copied from plane (K624: by copy), so a
   copied test reads the same: `store({db, env, before})` builds one assembled store over `db` (a fresh database by default),
   so two constructions can share one storage; `s.ask` and `s.draft` are the Store's RPC bodies (`askOnObject`,
   `draftOnObject` handed the assembled `read`, R8), and `fetch` is the store's dispatch with `acquire`'s trace stamped as
   the class stamps it (`traceStamped`, R99), without the class's headers. Other modules' tests take `storeWorld()`
   (`world.mjs`, R90), not this. */
import { DatabaseSync } from "node:sqlite";
import { assembleStore, askOnObject, draftOnObject, traceStamped } from "../../../src/store-assembly/index.mjs";
import { aiAccountsOf } from "../../../src/ai-accounts/index.mjs";
import { recordOf } from "../../../src/record-core/index.mjs";
import { catalogueFor, ENTRIES } from "../ai-accounts/catalogue.mjs";
import { gatePartOf } from "../../../src/run-rules/test-bar.mjs";

export { assembleStore, STEP_ORDER, stepOrderFrom, FIRST_LAYER_11, namespaceOf } from "../../../src/store-assembly/index.mjs";

const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);
function cursor(rows) {
  let i = 0;
  const c = {
    next() { return i < rows.length ? { done: false, value: rows[i++] } : { done: true, value: undefined }; },
    [Symbol.iterator]() { return c; },
    toArray() { const out = rows.slice(i); i = rows.length; return out; },
    one() { const rest = c.toArray(); if (rest.length !== 1) throw new Error(`expected one row, got ${rest.length}`); return rest[0]; },
  };
  return c;
}

/** A storage over `db`: `sql.exec`, a synchronous transaction, the alarm calls, and the blocked work recorded. */
export function storage(db = new DatabaseSync(":memory:")) {
  const sql = {
    exec(q, ...args) {
      const st = db.prepare(q);
      return cursor(st.columns().length ? st.all(...args.map(bind)).map((r) => ({ ...r })) : (st.run(...args.map(bind)), []));
    },
    get databaseSize() { return 0; },
  };
  let alarm = null, n = 0;
  const blocked = [], waited = [];
  const ctx = {
    storage: { sql, transactionSync: (fn) => {   /* as workerd's: a savepoint, rolled back and rethrown when the callback throws; nests */
      const sp = `sp${n++}`;
      db.exec(`SAVEPOINT ${sp}`);
      try { const r = fn(); db.exec(`RELEASE ${sp}`); return r; }
      catch (e) { db.exec(`ROLLBACK TO ${sp}`); db.exec(`RELEASE ${sp}`); throw e; }
    }, getAlarm: async () => alarm, setAlarm: async (t) => { alarm = t; },
               deleteAlarm: async () => { alarm = null; } },
    id: { equals: () => false, toString: () => "do" },
    blockConcurrencyWhile(fn) { const p = fn(); blocked.push(p); return p; },
    waitUntil(p) { waited.push(p); },   /* the background work a module hands the runtime, kept so a test may settle it */
  };
  return { db, ctx, blocked, waited };
}

/** R50 (K2853): the doors' deploy flags all on and a one-matter test set, for a module test (`assistantGateOf`); the
 *  bar is then held by `deployed(ctx)`, which records a passed R75 record for every part on that set. */
export const GATE_SET = Object.freeze({ id: "plane-t45-set", version: 1, matters: Object.freeze([{ id: "m1" }]) });
export const GATE_FLAGS = Object.freeze({ ask: true, draft: true, action_drafts: true });
export const GATE_PARTS = Object.freeze(["ask", "draft:own_words", "draft:translation", "draft:textcheck", "draft:infractiondraft",
                                         "draft:bearingdraft", "draft:statusreport", "draft:reading"]);
/* ai-runs R78 (T53): the gate admits a part on an entry's Gate 1 verdict. THROWAWAY GATE 1 RECORDS in `ai-gate` R37's shape,
   registered through ai-runs' one seam (`registerGateVerdicts`) as ai-runs' own world does (test/m/ai-runs/world.mjs):
   `ai-gate` has no code yet, so no fixture of its own can make them. Each part passes on both of the catalogue fixture's
   Anthropic entries, the entries a member's and the team's accounts serve on. */
const GATES = new WeakMap();
// fixtures-own: harness - throwaway Gate 1 records standing in for ai-gate, which has no code yet (BOB's ruling on Gate 1)
const gateRecord = (part, entry_id) => ({ part: gatePartOf(part) ?? part, entry_id,
  suiteVersions: { bank: 1, scorer: 1, thresholds: 1, image: 1 }, verdict: "passes", limits: [], grade: "throwaway",
  at: "2026-10-01T00:00:00Z" });
export function gatesOf(ctx, runs) {
  const k = ctx && ctx.storage ? ctx.storage : ctx;
  let g = GATES.get(k);
  if (!g) {
    g = [];
    GATES.set(k, g);
    runs.registerGateVerdicts("ai-gate", ({ entry_id }) => g.filter((r) => r.entry_id === entry_id));
  }
  return g;
}
/** ai-runs R78: `part` admitted on both catalogue fixture entries by a passing Gate 1 verdict (the throwaway records above);
 *  the R78 equivalent of a passed bar on a test's set. Answers `{ok: true}`. */
export async function admitPart(ctx, part) {
  const { aiRunsOf } = await import("../../../src/ai-runs/index.mjs");
  const gates = gatesOf(ctx, aiRunsOf(ctx));
  for (const e of [ENTRIES.a, ENTRIES.b]) gates.push(gateRecord(part, e));
  return { ok: true };
}
export async function deployed(ctx, parts = GATE_PARTS) {
  const { aiRunsOf } = await import("../../../src/ai-runs/index.mjs");
  const runs = aiRunsOf(ctx);
  const gates = gatesOf(ctx, runs);
  for (const part of parts) {
    const r = runs.testBarRecord({ part, set: GATE_SET.id, set_version: GATE_SET.version, false_alarm_rate: 0,
                                   passed: true, graded_by: "harness", at: "2026-10-01T00:00:00Z" });
    if (!r || r.ok !== true) throw new Error(`the bar for ${part} was not recorded: ${JSON.stringify(r)}`);
    for (const e of [ENTRIES.a, ENTRIES.b]) gates.push(gateRecord(part, e));
  }
}

/** One assembled store, built and settled (its migration and starts run). `routes(path, body)` answers its route map;
 *  `call(path, body)` the route the path names, awaited, as the frame does; `fetch(path, init)` the store's own door. */
export async function store({ db, env: extra, before = null, deliver = null } = {}) {
  const st = storage(db);
  const env = { STORE: { idFromName: (n) => n }, ...(extra || {}) };
  /* a test's own deps for a factory read on its first call only (K61), handed before construction */
  if (typeof before === "function") before(st.ctx, env);
  const a = assembleStore(st.ctx, env, { deliver });
  for (const p of st.blocked) await p;
  await withCatalogue(st.ctx);
  const s = {
    ...a,
    routes: (url, body = null, grant = null) => a.routes(url, body, grant),
    ask: (args) => askOnObject(st.ctx, env, args || {}),
    draft: (args) => draftOnObject(st.ctx, env, args || {}, { read: (op, params) => a.read(op, params) }),
    fetch: async (req) => a.dispatch(await traceStamped(req)),
  };
  const routes = (path, body = null) => s.routes(new URL("http://do" + path), body);
  const call = async (path, body = null) => {
    const op = new URL("http://do" + path).pathname.slice(1), map = routes(path, body);
    if (!Object.hasOwn(map, op)) throw new Error(`no route ${op}`);
    return JSON.parse(JSON.stringify(await map[op]() ?? null));
  };
  const fetch = async (path, init) => s.fetch(new Request("http://do" + path, init));
  return { s, ctx: st.ctx, db: st.db, env, routes, call, fetch };
}

/** The coordinator's CATALOGUE ruling (ai-accounts R40, R63): ai-accounts reads ai-catalogue's published fixture, seeded as
 *  ai-accounts' own `catalogueFor` seeds it. The assembly hands ai-accounts the object's own catalogue (R1), which holds the
 *  product's keys unless the store is a test instance handed `catalogueKeys` (`catalogue.test.mjs` drives that seam). These
 *  module worlds are not test instances (the ai-runs gate would then admit every part untested), so the fixture's catalogue is
 *  a second ai-catalogue instance over the same database, under the fixture's key, handed to ai-accounts in its place.
 *  Idempotent. */
export async function withCatalogue(ctx) {
  const acc = aiAccountsOf(ctx);
  if (!acc.catalogue || acc.catalogue.doc === undefined) {
    const shadow = { storage: { sql: ctx.storage.sql, transactionSync: ctx.storage.transactionSync } };
    acc.catalogue = catalogueFor(shadow, { record: recordOf(ctx) });
  }
  await acc.catalogue.seeded;
  return acc.catalogue;
}

/** R35 (credentials R64): the assistant's disclosure recorded as shown to `member`, by that member, as the assembled store
 *  asks before it sets her API-key reference (`accountreferenceset` is refused DISCLOSURE_DUE until then). */
export async function disclosed(ctx, member = "member:ann") {
  const { instanceSetupOf, ASSISTANT_DISCLOSURE } = await import("../../../src/setup.mjs");
  const r = instanceSetupOf(ctx).disclosureShown({ member, version: ASSISTANT_DISCLOSURE.version, by: member });
  if (!r || r.ok !== true) throw new Error(`the disclosure was not recorded: ${JSON.stringify(r)}`);
  return r;
}
