/* ai-use over a real SQLite database (node:sqlite), with the real record-core, membership, ai-catalogue and ai-accounts
   beside it (the services ai-use reads: declareTable, transact, bundleInfo; isAdministrator, isProjectOwner, notAnAdmin,
   notTheOwner; ai-accounts' accountActBar, accountsOf, accountUsesOf, aiKeptAway, projectsKeptAway, USE_KINDS; the
   catalogue's plansOf and entryOf), a `connections` stub answering `citesInto` from a table of cites the test writes, and
   the group's zone handed in. The catalogue is ai-accounts' published one (`../ai-accounts/catalogue.mjs`, itself
   ai-catalogue's published fixture, K4990, K4993): its base payload, signed and seeded, with this module's fake plans and
   entries added as payload data (`fake-*` ids, R26): a plan of each `money` (`priced`, `reported`, `none`, OPEN) and an
   entry priced and one unpriced. It never builds credentials (T48; N996 §5): the founder's claim (membership R94) is a test
   fact registered here, and enrolment's password setter (membership R95) a test setter that stores nothing, as
   ai-accounts' own fixture does. Members, projects and accounts are made through those modules' own acts
   (`accountSet`, `accountUsesSet`), so each test drives ai-use at its interface. */
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { aiAccountsOf } from "../../../src/ai-accounts/index.mjs";
import { aiUseOf } from "../../../src/ai-use/index.mjs";
import { catalogueFor, baseDoc, PLANS as ACCOUNT_PLANS } from "../ai-accounts/catalogue.mjs";
import { plan, entry, claim, OPEN, guidance, gateOf, PARTS } from "../ai-catalogue/fixture.mjs";

const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);
export function sqlOver(db) {
  return {
    exec(q, ...args) {
      const st = db.prepare(q);
      return st.columns().length ? st.all(...args.map(bind)).map((r) => ({ ...r })) : (st.run(...args.map(bind)), []);
    },
  };
}

export const SEAL = "test-seal-secret-0123456789";
export const WORDS = Object.fromEntries(JSON.parse(readFileSync(new URL(
  "../../../../docs/development/ux-substrate/screens/words.json", import.meta.url), "utf8")).words.map((w) => [w.key, w.en]));

/* The provider every fake plan is under (the catalogue fixture's), and this module's fake plans and entries. */
export const PROVIDER = ACCOUNT_PLANS.provider;
export const PLANS = Object.freeze({ team: "fake-team-api", member: "fake-member-api", none: "fake-flat", reported: "fake-reported",
  open: "fake-unknown-money" });
export const ENTRIES = Object.freeze({ priced: "fake-priced", unpriced: "fake-unpriced", other: "fake-other", measured: "fake-measured" });
/* R10: the measured entry's all-in cost of a standard task per part (`ai-catalogue`'s `standard_task_costs`), in usd. */
export const TASK_COSTS = Object.freeze({ run: Object.freeze({ low: 0.02, high: 0.05 }) });
export const PRICES = Object.freeze({ input: 3, output: 15, cache_read: 0.3, cache_write: 3.75 });

/* The catalogue payload: the base of ai-accounts' fixture with these plans and entries added. */
export function useDoc() {
  const doc = baseDoc();
  const apiPlan = (id, scope, money) => plan(id, { provider: PROVIDER, scope, means_allowed: claim(["sealed", "reference"]), money });
  const plans = [apiPlan(PLANS.team, claim("team"), claim("priced")), apiPlan(PLANS.member, claim("member"), claim("priced")),
    apiPlan(PLANS.none, OPEN, claim("none")), apiPlan(PLANS.reported, OPEN, claim("reported")), apiPlan(PLANS.open, OPEN, OPEN)];
  doc.plans.push(...plans);
  doc.guidance.push(...plans.map((p) => guidance(p.plan_id)));
  const ids = plans.map((p) => p.plan_id);
  const mk = (id, prices, extra = {}) => entry(id, { provider: PROVIDER, host: PROVIDER, plan_ids: ids, profile: { id: `p-${PROVIDER}`, min_version: 1 },
    served_ids: [`model-${id}`], model: `model-${id}`, gate: Object.fromEntries(PARTS.map((p) => [p, gateOf()])),
    prices: prices === OPEN ? OPEN : { unit: "usd_per_million_tokens", ...prices, date: "2026-10-01", ev: { grade: "STATED", source: "fixture source", date: "2026-10-01" } }, ...extra });
  doc.entries.push(mk(ENTRIES.priced, PRICES), mk(ENTRIES.unpriced, OPEN), mk(ENTRIES.other, { input: 1, output: 2, cache_read: 0.1, cache_write: null }),
    mk(ENTRIES.measured, PRICES, { standard_task_costs: { unit: "usd", price_date: "2026-10-01",
      by_part: structuredClone(TASK_COSTS), ev: { grade: "STATED", source: "fixture source", date: "2026-10-01" } } }));
  return doc;
}

/** One conversation's neutral usage record (`agent-model` R5): `cost` the catalogue's estimate in usd (null: none),
 *  `reported` the provider's stated cost in usd (null: none). A null token figure is named in `unstated`. */
export const usage = (input = 0, output = 0, cost = null, extra = {}) => {
  const u = { input_tokens: input, output_tokens: output, cache_read_input_tokens: 0, cache_creation_input_tokens: 0,
    reasoning_tokens: 0, cost_reported: null, cost_estimated: cost === null ? null : { amount: cost, unit: "usd", price_date: "2026-10-01" },
    unstated: [], ...extra };
  if (typeof extra.reported === "number") { u.cost_reported = { amount: extra.reported, unit: "usd", source: "provider" }; delete u.reported; }
  u.unstated = [...new Set([...(extra.unstated ?? []), ...["input_tokens", "output_tokens", "cache_read_input_tokens",
    "cache_creation_input_tokens", "reasoning_tokens"].filter((f) => u[f] === null)])];
  return u;
};
/** A conversation's label (`agent-model` R26), its effort given; the served model version a fake one. */
export const label = (effort = null, entry_id = ENTRIES.priced) => ({ provider: PROVIDER, host: PROVIDER, model_version: `fake-version-of-${entry_id}`,
  effort, account_level: "member", owner: null });

/** A world. `zone` the group's; `before` runs on the bare database before ai-use is first made (a pre-T40 store). */
export async function world({ zone = "UTC", before = null, now = null } = {}) {
  const db = new DatabaseSync(":memory:");
  const sql = sqlOver(db);
  const storage = { sql, transactionSync(fn) {
    db.exec("SAVEPOINT t");
    try { const r = fn(); db.exec("RELEASE t"); return r; } catch (e) { db.exec("ROLLBACK TO t"); db.exec("RELEASE t"); throw e; }
  } };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const st of bare.split(";")) { const t = st.trim(); if (t) db.exec(t); }
  const ctx = { storage };
  const rc = recordOf(ctx);
  if (typeof rc.migrate === "function") rc.migrate();
  const m = membershipOf(ctx);
  m.migrate();
  const fact = { claimed: false };
  m.registerClaimed("test-claim", () => fact.claimed === true);
  m.registerPasswordSetter(() => ({ ok: true }), "test-password");
  const catalogue = catalogueFor(ctx, { record: rc, doc: useDoc() });
  await catalogue.seeded;
  const a = aiAccountsOf(ctx, { record: rc, membership: m, sealSecret: SEAL, catalogue });
  a.migrate();
  db.exec(`CREATE TABLE test_cites (citer TEXT NOT NULL, target TEXT NOT NULL)`);
  const connections = { citesInto: (id) => ({ confirmed: sql.exec(`SELECT citer FROM test_cites WHERE target=? ORDER BY citer`, id)
    .map((r) => r.citer), severed: [] }) };
  if (before) before(db, sql);
  let z = zone;
  const u = aiUseOf(ctx, { record: rc, membership: m, accounts: a, connections, zone: () => z, ...(now ? { now } : {}) });
  /* `c` is `a` under the name notice-producers' tests, which build on this world, read the accounts by (T48: what
     they read of credentials is ai-accounts' since the split; N996 §5). */
  const w = {
    db, sql, ctx, rc, m, a, c: a, u, fact, catalogue, acct: {},
    setZone(next) { z = next; },
    row(q, ...a) { return sql.exec(q, ...a)[0] ?? null; },
    rows(q, ...a) { return sql.exec(q, ...a); },
    async enrol(id, role = "member", by = "admin") {
      const a = await m.memberAdd({ memberId: id, cover: `cover of ${id}`, role, by });
      if (!a.ok) return a;
      return m.enroll({ invite: a.invite, handle: id, password: `${id}-passphrase-x` });
    },
    /* The founder claims the instance (the test's fact, membership R94); a second administrator; then each member,
       enrolled. */
    async group(...members) {
      fact.claimed = true;
      await w.enrol("second", "admin");
      for (const id of members) await w.enrol(id);
      return w;
    },
    bundle(id, type, title = id) {
      db.prepare(`INSERT INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated, bundle_sha)
                  VALUES (?, ?, 'g', ?, 'open', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 'sha')`).run(id, type, title);
      return id;
    },
    project(id, owner, visibility = "hidden") {
      w.bundle(id, "project", `Project ${id}`);
      m.projectCreated({ projectId: id, ownerId: owner, visibility, by: owner });
      return id;
    },
    join(id, owner, member) {
      const i = m.projectInvite({ projectId: id, handle: member, by: owner, viewer: `member:${owner}` });
      if (!i.ok) return i;
      return m.projectJoin({ projectId: id, by: member, viewer: `member:${member}` });
    },
    cite(citer, target) { db.prepare(`INSERT INTO test_cites (citer, target) VALUES (?, ?)`).run(citer, target); },
    /* An account of `owner` on `plan` (ai-accounts R40), its key sealed, by `by`, switched on; its id. */
    async account(owner, by, plan = owner === "group" || owner.startsWith("project:") ? PLANS.team : PLANS.member) {
      const set = await a.accountSet({ owner, provider: PROVIDER, plan, means: "sealed", secret: `fake-key-${owner}-${plan}-0123456789`, by });
      if (!set.ok) throw new Error(`account(${owner}, ${plan}): ${set.reason} ${set.detail ?? ""}`);
      a.accountSwitch({ account_id: set.account_id, on: true, by });
      return set.account_id;
    },
    /* The account's `explore` switch (ai-accounts R14), set by `by`. */
    explore(account_id, on, by) { return a.accountUsesSet({ account_id, switch: "explore", on, by }); },
    /* Every table's rows, to show an act wrote nothing. */
    snapshot() {
      return JSON.stringify(w.rows(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
        .map(({ name }) => [name, w.rows(`SELECT * FROM "${name}"`)]));
    },
    /* Count one conversation's worth for `owner` and `member` under `use`. */
    count(owner, member, use, { input = 100, output = 0, cost = null, reported = null, calls = 1, at = "2026-10-09T12:00:00Z", mode = use, act = null,
                                entry_id = ENTRIES.priced, effort = null, usage: given = null } = {}) {
      return u.countUsage({ owner, member, use, mode, entry_id, label: label(effort, entry_id),
        usage: given ?? usage(input, output, cost, reported === null ? {} : { reported }), calls, at, act });
    },
  };
  return w;
}

/** The standard world: ann, bob and cy members, P owned by ann with bob joined; second an administrator. ann holds her own
 *  account (the member API plan, priced), the team one (the team API plan, priced) and P one (the team API plan);
 *  `w.acct` names their ids. */
export async function standard(opts) {
  const w = await (await world(opts)).group("ann", "bob", "cy");
  w.project("P", "ann");
  w.join("P", "ann", "bob");
  w.acct.ann = await w.account("member:ann", "ann");
  w.acct.group = await w.account("group", "admin");
  w.acct.P = await w.account("project:P", "ann");
  return w;
}
