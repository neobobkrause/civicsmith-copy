/* ai-runs over the real modules it uses — record-core, membership, credentials, ai-accounts, promotion, connections, bias, observation-log,
   retrieval and contradiction — over node:sqlite (the engine a Durable Object runs), at the Durable Object's shape:
   `sql.exec` answers a cursor, never an array, and refuses a LIKE or GLOB pattern over 50 bytes (K313, K316). Each world is its own storage, so
   `aiRunsOf` answers a fresh instance. Tests drive the module at its interface; the helpers below set the record up
   through the used modules' own acts (a member enrolled, a project owned and joined, a bias set promoted and adopted). */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { credentialsOf } from "../../../src/credentials/index.mjs";
import { aiAccountsOf } from "../../../src/ai-accounts/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { biasOf, BIAS_SCHEMA } from "../../../src/bias/index.mjs";
import { observationLogOf } from "../../../src/observation-log/index.mjs";
import { connectionsOf } from "../../../src/connections/index.mjs";
import { retrievalOf } from "../../../src/retrieval/index.mjs";
import { aiRunsOf, aiRunsOps } from "../../../src/ai-runs/index.mjs";
import { catalogueFor, baseDoc, PLANS, ENTRIES, HOSTS } from "../ai-accounts/catalogue.mjs";
import { gatePartOf } from "../../../src/run-rules/index.mjs";
export { PLANS, ENTRIES, HOSTS };

export const sha = (s) => createHash("sha256").update(Buffer.from(String(s), "utf8")).digest("hex");
const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);
const run = (sql, text) => {
  const bare = text.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const st of bare.split(";")) if (st.trim()) sql.exec(st);
};
export const T0 = "2026-07-01T00:00:00Z";
export const INQ = "INQ-2026-0001";
export const PROJ = "PROJ-2026-0001";
/** The principals the control plane stamps: a member's session, and an organisation `ai` credential. */
export const ANN = "member:ann", BOB = "member:bob", ORG = "class:ai/tok-org";
export const TABLES = ["ai_runs", "ai_run_bounds", "inquiry_run_surfacings"];

/** A bias statement and set, in the catalogue's grammar (bias's own test world's shape). */
const S = (id) => ({ id, kind: "scrutiny", subject: "ENT-2026-0007",
  text: `Statement ${id}: claims from this office need a second, independent record before they bear load.`,
  justification: `Why ${id} is held: the office is a party to matters this group examines.`, citations: [], locked: false });
const scalar = (v) => v === null ? "null" : typeof v === "string" ? JSON.stringify(v)
  : typeof v === "boolean" || typeof v === "number" ? String(v) : JSON.stringify(v);
function yaml(fm) {
  const lines = ["---"];
  for (const [k, v] of Object.entries(fm)) {
    if (Array.isArray(v) && v.length && v[0] && typeof v[0] === "object") {
      lines.push(`${k}:`);
      for (const row of v) {
        const keys = Object.entries(row);
        lines.push(`  - ${keys[0][0]}: ${scalar(keys[0][1])}`);
        for (const [rk, rv] of keys.slice(1)) lines.push(`    ${rk}: ${Array.isArray(rv) ? JSON.stringify(rv) : scalar(rv)}`);
      }
    } else lines.push(`${k}: ${scalar(v)}`);
  }
  lines.push("---");
  return lines.join("\n");
}
const biasMd = (fm) => [yaml(fm), "", "## Statements", "", "The lens.", "", "## Adoption", "", "Adopted.", "",
  "## What This Does Not Enforce", "", "It does NOT check whether a second source was independent.", "",
  "## Session Log", "", "## Review Notes", ""].join("\n");
/** An inquiry's bundle.md, as an assistant would create one. */
export const inquiryMd = (id) => `---\nid: ${id}\nobject_type: inquiry\ntitle: Q\ncurrent_state: open\nsurfaced_by: agent\n`
  + `created: ${T0}\nlast_updated: ${T0}\ngroup: test-group\n---\n\n## Question\n\nWhy did the fee rise?\n`;

/* workerd's cursor: rows are read by iterating it (or its `toArray()`/`one()`); `[0]` and `.length` of it are undefined. */
export const WORKERD_PATTERN_CAP = 50;
function cursor(rows) {
  let i = 0;
  const c = {
    next() { return i < rows.length ? { done: false, value: rows[i++] } : { done: true, value: undefined }; },
    [Symbol.iterator]() { return c; },
    toArray() { const out = rows.slice(i); i = rows.length; return out; },
    one() {
      const rest = c.toArray();
      if (rest.length !== 1) throw new Error(`Expected exactly one result from SQL query, but got ${rest.length}`);
      return rest[0];
    },
  };
  return c;
}

export const SEAL = "test-seal-secret-for-ai-runs";
/** A sentinel sign-in token held for a member (ai-accounts R19: 20 to 2,000 characters). */
export const SIGNIN_TOKEN = (id) => `sk-ant-oat01-sentinel-signin-token-of-${id}`;

/** A test set standing in for Civicsmith's (run-rules R19's `CIVICSMITH_TEST_SET`, v1 empty until N829), with one
 *  matter, so a part's bar can be held here (ai-runs' `deps.testSet`, a module test's alone). */
export const TEST_SET = Object.freeze({ id: "world-set", version: 1, matters: Object.freeze([{ id: "m1" }]) });
/** The parts a world holds a passing bar for unless told otherwise (`bars`). */
export const BAR_PARTS = Object.freeze(["check", "investigate", "extract", "plan", "explore"]);

/* `steps` and `aiUse`: a stand-in at the module's interface where a test passes one; else the real module through its
   factory on this world's storage. `testSet` and `bars`: the test set the deploy gate reads and the parts holding a
   passing record on it (B6: run-rules R19's test bar); `bars: []` holds none. */
export function world({ env = {}, inquiry = undefined, deployedModes = undefined, zone = null, steps = undefined,
                        aiUse = undefined, testSet = TEST_SET, bars = BAR_PARTS, pathReady = "ok" } = {}) {
  const db = new DatabaseSync(":memory:");
  const sql = { exec(q, ...args) {
    const literal = [...q.matchAll(/\b(?:GLOB|LIKE)\s+'((?:[^']|'')*)'/gi)].map((m) => m[1].replace(/''/g, "'"));
    const bound = /\b(?:GLOB|LIKE)\s+\?|\b(?:glob|like)\s*\(/i.test(q) ? args.filter((a) => typeof a === "string") : [];
    if ([...literal, ...bound].some((p) => Buffer.byteLength(p) > WORKERD_PATTERN_CAP)) throw new Error("LIKE or GLOB pattern too complex");
    const st = db.prepare(q);
    return cursor(st.columns().length ? st.all(...args.map(bind)).map((r) => ({ ...r })) : (st.run(...args.map(bind)), []));
  } };
  let n = 0;
  const storage = { sql, transactionSync(fn) {
    const sp = `sp${n++}`;
    db.exec(`SAVEPOINT ${sp}`);
    try { const r = fn(); db.exec(`RELEASE ${sp}`); return r; }
    catch (e) { db.exec(`ROLLBACK TO ${sp}`); db.exec(`RELEASE ${sp}`); throw e; }
  } };
  run(sql, RECORD_SCHEMA);
  run(sql, BIAS_SCHEMA);
  const ctx = { storage };
  const record = recordOf(ctx); record.migrate();
  const membership = membershipOf(ctx, { record }); membership.migrate();
  /* credentials (K789): the founder's claim, members' passwords and the AI credentials R18 reads are its (its R1–R15). */
  /* (T53) ai-catalogue as ITS published fixture gives it (K4990): every account `ai-accounts` holds is of one of the
     catalogue's plans, and the entry an act is served on is one of its entries. */
  const catalogue = catalogueFor(ctx, { record });
  const credentials = credentialsOf(ctx, { record, membership, sealSecret: SEAL, catalogue }); credentials.migrate();
  /* ai-accounts (T48; N996 §5): the accounts an act is served by, their switches and keep-away, which ai-runs reads (its
     R18, R52, R79); made by credentials' factory with the seal secret (ai-accounts R32), the one instance on this storage.
     The world sets accounts up through its own acts, never credentials' transitional delegates (credentials R72). */
  const aiAccounts = aiAccountsOf(ctx);
  const promotion = promotionOf(ctx, { record, membership });
  /* each fact by the module that registers it in the plane, answering as an empty record does */
  for (const [f, m, v] of [["producingGroup", "instance-setup", "test-group"], ["citedBy", "connections", []], ["caseMember", "publication", false]])
    promotion.registerFact(f, m, () => v);
  /* provenance's `register` (its read contract), which a promotion's steps read: empty here, as a record with no
     registered capture holds it. provenance is not among this module's uses, so the table stands alone. */
  sql.exec(`CREATE TABLE IF NOT EXISTS register (bundle_id TEXT, capture_sha TEXT, registered TEXT, authored INTEGER NOT NULL DEFAULT 0)`);
  /* leg-earning's `inquiry_basis` and content's `content`, which R85 reads for a run's subjects: neither is among this module's
     uses, so the tables stand alone with the columns read (as `register` above). */
  sql.exec(`CREATE TABLE IF NOT EXISTS inquiry_basis (bundle_id TEXT NOT NULL, ord INTEGER NOT NULL, target_id TEXT NOT NULL, content_id TEXT, PRIMARY KEY (bundle_id, ord))`);
  sql.exec(`CREATE TABLE IF NOT EXISTS content (content_id TEXT PRIMARY KEY, extent_kind TEXT NOT NULL, ref TEXT NOT NULL)`);
  observationLogOf(ctx, { extraction: null, provenance: null }).migrate();
  connectionsOf(ctx, { env }).migrate();
  const bias = biasOf(ctx, { env });
  /* `zone`: the group's governing time zone as retrieval answers it (its R69), from an active profile's `time_zone`. */
  if (zone) record.setSetting("jurisdiction_profiles", ["zone-profile"], "admin");
  retrievalOf(ctx, zone ? { combine: () => ({ ok: true, view: { time_zone: { value: zone } } }), localFacts: null } : undefined).migrate();
  const runs = aiRunsOf(ctx, env, { inquiry, ...(deployedModes ? { deployedModes } : {}), ...(steps ? { steps } : {}),
                                    ...(aiUse ? { aiUse } : {}), testSet });
  runs.migrate();
  /* R78 (T53; BOB's ruling on Gate 1): THROWAWAY GATE 1 RECORDS, in `ai-gate` R37's shape, read through this module's one
     seam (`registerGateVerdicts`) as `ai-gate` will register its own. `ai-gate`'s code does not exist yet, so no fixture of
     its own can make them; these stand in for it here alone, and a test that changes them changes `w.gates`. Each part of
     `bars` passes on both of the catalogue's Anthropic entries. */
  const gates = [];
  // fixtures-own: harness - throwaway Gate 1 records standing in for ai-gate, which has no code yet (BOB's ruling on Gate 1)
  const gate = (part, entry_id, verdict = "passes", more = {}) => ({ part: gatePartOf(part) ?? part, entry_id,
    suiteVersions: { bank: 1, scorer: 1, thresholds: 1, image: 1 }, verdict,
    limits: verdict === "passes_with_limits" ? ["throwaway limit"] : [], grade: "throwaway", at: T0, ...more });
  for (const part of bars) for (const e of [ENTRIES.a, ENTRIES.b]) gates.push(gate(part, e));
  runs.registerGateVerdicts("ai-gate", ({ entry_id }) => gates.filter((g) => g.entry_id === entry_id));
  /* R97, F1: the path source, which no module registers yet (R97/R98's server side, a known gap). With none the path reads
     not ready (F1, fail closed), so a world stands one in answering `pathReady` (`ok`); `pathReady: null` registers none.
     The stand-in is replaceable: a test's own first `runs.registerPathReady(module, fn)` takes its place (answered as a
     first registration is), and a later one is refused as the module refuses a second; `w.setPath(fn)` swaps it too. */
  let pathFn = () => ({ state: pathReady });
  const setPath = (fn) => { pathFn = fn; };
  if (pathReady !== null) {
    // fixtures-own: harness - the plane's path source, which no module registers yet (R97/R98's server side)
    runs.registerPathReady("plane", (a) => pathFn(a));
    const real = runs.registerPathReady.bind(runs);
    let standIn = true;
    runs.registerPathReady = (module, fn) => {
      if (!standIn || typeof module !== "string" || !module || typeof fn !== "function") return real(module, fn);
      standIn = false; setPath(fn);
      return { ok: true, module };
    };
  }
  let k = 0;
  /* the accounts this world's acts set, by owner, as `accountSet` answered their ids */
  const held = new Map();
  const hold = (owner, id) => held.set(owner, [...(held.get(owner) || []), id]);
  const w = {
    db, sql, ctx, record, membership, credentials, aiAccounts, promotion, bias, runs, catalogue, gates, gate, setPath,
    row: (q, ...a) => [...sql.exec(q, ...a)][0] ?? null, rows: (q, ...a) => [...sql.exec(q, ...a)],
    count: (t) => [...sql.exec(`SELECT count(*) AS n FROM ${t}`)][0].n,
    /** Every row of this module's tables and of the observation log, for "nothing was written". */
    dump: () => [...TABLES, "observation_log"].map((t) => JSON.stringify([...sql.exec(`SELECT * FROM ${t} ORDER BY rowid`)])).join("\n"),
    /** A bundle of a type, committed through record-core (a context for a run). */
    bundle(id, type = "inquiry", text = null, project = null) {
      const t = text ?? `---\nid: ${id}\n---\n`;
      record.transact(() => record.commit({ bundleId: id, type, title: id, project, snapKey: `c${k++}`, kind: "promotion",
        base: sha(""), author: "x", writer: null, operation: null, files: [{ path: "bundle.md", text: t, sha256: sha(t), bytes: t.length }],
        state: type === "project" ? "forming" : "open", priorState: null, group: "test-group", created: T0, lastUpdated: T0,
        criticality: null, at: T0 }));
      if (type === "project") membership.reindexProjectSight(id);
      return id;
    },
    /* Members: the founder claims (viewer `admin`), a second administrator, then members enrolled to active, each
       connecting their own account by their own act (ai-accounts R1), unless listed in `noAccount`. */
    async group(...members) {
      const opts = members.length && typeof members[members.length - 1] === "object" ? members.pop() : {};
      await catalogue.seeded;
      await credentials.claim({ password: "founder-passphrase-1", tokenFp: "fp-1" });
      for (const [id, role] of [["second", "admin"], ...members.map((m) => [m, "member"])]) {
        const a = await membership.memberAdd({ memberId: id, cover: `cover of ${id}`, role, capabilities: null, by: "admin" });
        if (!a.ok) throw new Error(`memberAdd ${id}: ${JSON.stringify(a)}`);
        await membership.enroll({ invite: a.invite, handle: id, password: `${id}-passphrase-x` });
        if (!(opts.noAccount || []).includes(id)) await w.account(id);
      }
      return w;
    },
    /** A member connects their own account (ai-accounts R1, T53): an account of the catalogue's API plan for members, its
     *  key sealed, switched on, and its recipient's notice read, all by her own acts. `kind` `apikey` is that account;
     *  any other kind is the same account with its key named so (the kinds of the old reference are gone, T53). */
    async account(id, kind = "apikey", secret = `secret-of-${id}-0123456789`, { entries = undefined } = {}) {
      const r = await aiAccounts.accountSet({ owner: `member:${id}`, provider: PLANS.provider, plan: PLANS.memberApi,
        means: "sealed", secret: String(secret).padEnd(20, "x"), entries, by: id });
      if (!r.ok) throw new Error(`account ${id}: ${JSON.stringify(r)}`);
      hold(`member:${id}`, r.account_id);
      const on = aiAccounts.accountSwitch({ account_id: r.account_id, on: true, by: id });
      if (!on.ok) throw new Error(`account ${id} on: ${JSON.stringify(on)}`);
      aiAccounts.recipientNoticeSeen({ member: id, provider: PLANS.provider, host: HOSTS.main, by: id });
      return r;
    },
    /** (ai-accounts R48, T53) A member's personal subscription (the plan `subscription`, means `issued`), its token held,
     *  switched on, its recipient's notice read: hers alone. */
    async signin(id, token = SIGNIN_TOKEN(id)) {
      const r = await aiAccounts.accountSet({ owner: `member:${id}`, provider: PLANS.provider, plan: PLANS.subscription,
        means: "issued", secret: token, by: id });
      if (!r.ok) throw new Error(`signin ${id}: ${JSON.stringify(r)}`);
      hold(`member:${id}`, r.account_id);
      const on = aiAccounts.accountSwitch({ account_id: r.account_id, on: true, by: id });
      if (!on.ok) throw new Error(`signin ${id} on: ${JSON.stringify(on)}`);
      aiAccounts.recipientNoticeSeen({ member: id, provider: PLANS.provider, host: HOSTS.main, by: id });
      return token;
    },
    /** (ai-accounts R7, T53) The team's account of the catalogue's team API plan, its key sealed, switched on by an
     *  administrator; each member named has read its recipient's notice. Answers its `account_id`. */
    async team({ on = true, members = [], entries = undefined } = {}) {
      const r = await aiAccounts.accountSet({ owner: "group", provider: PLANS.provider, plan: PLANS.teamApi, means: "sealed",
        secret: "team-key-secret-0123456789", entries, by: "admin" });
      if (!r.ok) throw new Error(`team: ${JSON.stringify(r)}`);
      hold("group", r.account_id);
      if (on && !aiAccounts.accountSwitch({ account_id: r.account_id, on: true, by: "admin" }).ok) throw new Error("team on");
      for (const m of members) aiAccounts.recipientNoticeSeen({ member: m, provider: PLANS.provider, host: HOSTS.main, by: m });
      return r.account_id;
    },
    /** (ai-accounts R10, R41, T53) A project's own account of the team API plan, its key sealed, switched on by `owner`
     *  (one of the project's owners); each member named has read its recipient's notice. Answers its `account_id`. */
    async projectAccount(project, owner, { members = [] } = {}) {
      const r = await aiAccounts.accountSet({ owner: `project:${project}`, provider: PLANS.provider, plan: PLANS.teamApi,
        means: "sealed", secret: `project-key-secret-of-${project}`, by: owner });
      if (!r.ok) throw new Error(`projectAccount ${project}: ${JSON.stringify(r)}`);
      hold(`project:${project}`, r.account_id);
      if (!aiAccounts.accountSwitch({ account_id: r.account_id, on: true, by: owner }).ok) throw new Error("project account on");
      for (const m of members) aiAccounts.recipientNoticeSeen({ member: m, provider: PLANS.provider, host: HOSTS.main, by: m });
      return r.account_id;
    },
    /** (ai-accounts R7, T53) What `accountFor` really answers for `member`'s act of `kind` (in `project`), as a dispatch
     *  carries it: every secret part (`secret`, `reference`, `gateway_id`) and `ok` left out, `member` spelled `member:<id>`.
     *  The provider's own answer, never one built here. */
    async served(member, { kind = "run", project = null } = {}) {
      const a = await aiAccounts.accountFor({ member: `member:${member}`, act: { kind, member: `member:${member}`, ...(project ? { project } : {}) } });
      if (!a || a.ok !== true) throw new Error(`served ${member}: ${JSON.stringify(a)}`);
      const { ok: _ok, secret: _s, reference: _r, gateway_id: _g, ...rest } = a;
      return { ...rest, member: `member:${member}` };
    },
    /** The account ids `owner` holds, in list order (ai-accounts' own read). */
    accountsOf(owner) { return [...(held.get(owner) || [])]; },
    /** One switch of every account `owner` holds, by `by` (ai-accounts R14's act). */
    uses(owner, name, on, by) {
      for (const account_id of w.accountsOf(owner)) {
        const r = aiAccounts.accountUsesSet({ account_id, switch: name, on, by });
        if (!r.ok) throw new Error(`uses ${owner}: ${JSON.stringify(r)}`);
      }
    },
    /** Every account `owner` holds switched on or off, by `by`. */
    switchAll(owner, on, by) {
      for (const account_id of w.accountsOf(owner)) {
        const r = aiAccounts.accountSwitch({ account_id, on, by });
        if (!r.ok) throw new Error(`switch ${owner}: ${JSON.stringify(r)}`);
      }
    },
    /** Every account `owner` holds removed, by `by`. */
    async removeAll(owner, by) {
      for (const account_id of w.accountsOf(owner)) {
        const r = await aiAccounts.accountRemove({ account_id, by });
        if (!r.ok) throw new Error(`remove ${owner}: ${JSON.stringify(r)}`);
      }
      held.delete(owner);
    },
    /** A project owned by `owner`, with `joined` members joined and `invited` ones only invited. */
    project(id, owner, { joined = [], invited = [], discoverable = false } = {}) {
      w.bundle(id, "project");
      membership.projectClaimOwner({ projectId: id, memberId: owner });
      for (const m of [...joined, ...invited]) membership.projectInvite({ projectId: id, handle: m, by: owner });
      for (const m of joined) membership.projectJoin({ projectId: id, by: m });
      if (discoverable) membership.projectVisibilitySet({ projectId: id, setting: "discoverable", by: owner, reason: "open" });
      membership.reindexProjectSight(id);
      return id;
    },
    /** A `cites` edge from `from` to `to` (connections' projection of `references[]`). */
    cites(from, to) { sql.exec(`INSERT OR REPLACE INTO refs (bundle_id, target_id, kind) VALUES (?, ?, 'cites')`, from, to); },
    /** A bias set promoted to `adopted` and adopted for `scope` by the founder, putting a lens in force. */
    lens(id, { scope = "instance", scopeId = "", statement = "s1" } = {}) {
      let prior = null, r;
      for (const st of ["draft", "proposed", "adopted"]) {
        const head = record.head(id);
        const fm = { id, object_type: "bias", title: `Lens ${id}`, current_state: st, prior_state: prior, created: T0,
                     last_updated: T0, group: "test-group", statements: [S(statement)] };
        r = promotion.promote({ bundleId: id, base: head ? head.bundleSha : null, snapKey: `b${k++}`, author: "member:ann",
                                files: [{ path: "bundle.md", text: biasMd(fm) }], meta: {} });
        if (!r.ok) throw new Error(`bias ${id} ${st}: ${JSON.stringify(r)}`);
        prior = st;
      }
      /* bias R11 (DEC-88): the adopter's words on why this lens is adopted. */
      const a = bias.biasAdopt({ bundleId: id, scope, scopeId, author: "admin", identity: "member:admin", viewer: "admin",
                                 reason: `The group reads evidence on ENT-2026-0007 through ${id}, adopted for the ${scope} scope.` });
      if (!a.ok) throw new Error(`adopt ${id}: ${JSON.stringify(a)}`);
      return a;
    },
    /** record-core's purge over this world. Modules this one reaches (contradiction, and through it content, extraction
     *  and provenance) declare tables this world never creates; each is stood in as an empty table on first mention, so
     *  the purge runs over every declaration as it would in the store. */
    purge(args = {}) {
      for (let i = 0; i < 200; i++) {
        try { return record.purge(args); } catch (e) {
          const t = /no such table: (\w+)/.exec(String(e && e.message));
          const c = /no such column: (\w+)/.exec(String(e && e.message));
          if (t) sql.exec(`CREATE TABLE ${t[1]} (bundle_id TEXT)`);
          else if (c) { const holder = /FROM (\w+)/.exec(String(e.message)); throw new Error(`purge: ${e.message} ${holder || ""}`); }
          else throw e;
        }
      }
      throw new Error("purge: too many absent tables");
    },
    /** A creation of an inquiry by an assistant, through promotion (R25–R26 are asked there). */
    surface(id, { run: r = "R1", caller = ORG, viewer = "admin" } = {}) {
      return promotion.promote({ bundleId: id, base: null, files: [{ path: "bundle.md", text: inquiryMd(id) }], meta: {},
        snapKey: `s${k++}`, author: caller, assistantPrincipal: caller, run: r, actorViewer: viewer });
    },
    /** The control plane's dispatch of one op, with its stamps in the query. */
    op(name, query = {}, body = null) {
      const url = new URL(`http://do/${name}?${new URLSearchParams(query)}`);
      return aiRunsOps(runs, url, body)[name]();
    },
  };
  return w;
}

/** An open's arguments, well formed unless overridden: an organisation credential's run over `INQ`, started by ann's
 *  act and carried by her account (R52). */
export const OPEN = (over = {}) => ({ run: "R1", contextType: "inquiry", contextId: INQ, principalPlane: ORG,
  principalAi: ANN, skillVersion: "bio@1", viewer: "admin", at: T0, ...over });

/** One model call's figures, as `agent-model` R5 states them. */
export const USAGE = (over = {}) => ({ input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0, total_cost_usd: 0.012, ...over });

/** (T53; R72, R104) A conversation's label as `agent-model` composes it (its R26: the served identity, the effort, the
 *  account's level and owner) with the AI's display name, each identity field read from the catalogue fixture's own
 *  payload for `entry_id` (ai-catalogue's published data); `agent-model` has no published fixture of a label yet.
 *  // fixtures-own: harness - agent-model's label has no published fixture until its T53 job lands */
const CATALOGUED = new Map(baseDoc().entries.map((e) => [e.entry_id, e]));
export const LABEL = (entry_id = ENTRIES.a, over = {}) => {
  const e = CATALOGUED.get(entry_id) || {};
  return { display_name: e.display_name ?? null, provider: e.provider ?? null, host: e.host ?? null,
           model_version: e.model ?? null, effort: null, account_level: "member", owner: "member:ann", ...over };
};
/** (T53; R72) One `usage` entry of a tick as `agent-worker` passes it (its R112): `{mode, entry_id, label, usage, calls}`. */
export const ENTRY = (mode = "check", over = {}, calls = 1, { entry_id = ENTRIES.a, label = {} } = {}) =>
  ({ mode, entry_id, label: LABEL(entry_id, label), usage: USAGE(over), calls });

/** An `agent-worker` binding that counts its calls and answers as told. */
export function agentWorker(answer = { status: 200, body: { ok: true } }) {
  const calls = [];
  return { calls, fetch: async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), headers: { ...(init.headers || {}) } });
    if (answer === "hang") return new Promise(() => {});
    if (answer === "throw") throw new Error("network down");
    return new Response(JSON.stringify(answer.body), { status: answer.status });
  } };
}
