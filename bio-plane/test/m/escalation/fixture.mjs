/* escalation over the modules it uses: the real ones built before layer 9 (record-core, membership, promotion,
   jurisdictions' `combine` over its test profile), on a real SQLite database (node:sqlite) standing in for a Durable
   Object's storage; and stand-ins, in the shape of their Provides, for the four layer-9 modules built beside it,
   which the test controls and records: conformance (`determinationRead` R9, `determinationsFor` R11), consequences
   (`addressed` R9, `consequencesOf` R7), actions (`actionRead` with its ledger, `actionsFor` R30, `actionFacts` R12's
   clock rule) and filings (`filingsFor` R13, `availableActions` R21). An action is a real `ACTN-` bundle whose document carries `breach`, `action_basis`,
   `counterparty` and, when asked, `premise_override` (actions' Terms and R8), committed through record-core; its
   ledger is the stand-in's. Every test drives `escalation` at its interface. */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { escalationOf } from "../../../src/escalation/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/frontmatter.mjs";
import { entitiesOf } from "../../../src/entities/index.mjs";
import { eventsOf } from "../../../src/events/index.mjs";
import { linesOf } from "../../../src/lines/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { actionRead as publishedActionRead } from "../actions/fixtures.mjs";

/* actions R43, R106: the one refusal for an action that is unknown, unseen or no action, as actions' published `actionRead`
   answers it, naming the id asked. */
let noSuchActionShape = null;
export const noSuchAction = (id) => ({ ...(noSuchActionShape ??= publishedActionRead().unknownAnswer), action: id });

const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);

/* A cursor as workerd's `sql.exec` answers one: an iterator over the rows, read once, with `toArray()` and `one()`;
   never an array, so `[0]` or `.length` on it is undefined, as in a Durable Object (LEGACY-TESTS #6 J2). */
function cursor(rows) {
  let i = 0;
  const c = {
    columnNames: rows.length ? Object.keys(rows[0]) : [],
    rowsRead: rows.length,
    rowsWritten: 0,
    next() { return i < rows.length ? { done: false, value: rows[i++] } : { done: true, value: undefined }; },
    [Symbol.iterator]() { return c; },
    toArray() { const out = rows.slice(i); i = rows.length; return out; },
    one() {
      const rest = c.toArray();
      if (rest.length !== 1) throw new Error(`Expected exactly one result from SQL query, but got ${rest.length}`);
      return rest[0];
    },
    raw() { return c.toArray().map((r) => Object.values(r))[Symbol.iterator](); },
  };
  return c;
}

export function storage() {
  const db = new DatabaseSync(":memory:");
  let n = 0;
  const sql = {
    exec(q, ...args) {
      const st = db.prepare(q);
      return cursor(st.columns().length ? st.all(...args.map(bind)).map((r) => ({ ...r })) : (st.run(...args.map(bind)), []));
    },
  };
  return {
    db, sql,
    transactionSync(fn) {
      const sp = `sp${n++}`;
      db.exec(`SAVEPOINT ${sp}`);
      try { const r = fn(); db.exec(`RELEASE ${sp}`); return r; }
      catch (e) { db.exec(`ROLLBACK TO ${sp}`); db.exec(`RELEASE ${sp}`); throw e; }
    },
  };
}

export const V = (id) => `member:${id}`;
export const MACHINE = "class:ai";
export const NOW = "2026-09-28T01:00:00Z";
export const DAY = 86400000;
export const ms = (iso) => Date.parse(iso);

/** The test profile's offices (jurisdictions' `test-port-ellery`): elected, not elected, oversight, not oversight. */
export const OFFICE = {
  clerk: { role: "Town Clerk", body: "City of Port Ellery" },                   // elected: false, oversight unstated
  board: { role: "Selectboard", body: "Port Ellery Selectboard" },              // elected: true, oversight unstated
  harbour: { role: "Harbour District Board", body: "Port Ellery Harbour District" }, // elected, oversight: false
  examiner: { role: "Examiner of Accounts", body: "Marlow County Audit Office" },     // not elected, oversight: true
  unlisted: { role: "Water Board", body: "Nowhere Water District" },
};

export function world({ now = NOW, profiles = ["test-port-ellery"], omit = [], structure = false } = {}) {
  const st = storage();
  const host = { storage: st };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  const clock = { now };
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  const promotion = promotionOf(host, { record, membership, now: () => clock.now });
  promotion.registerFact("producingGroup", "instance-setup", () => "test-group");
  record.setSetting("jurisdiction_profiles", profiles, "test");

  const calls = { determinationRead: [], determinationsFor: [], addressed: [], consequencesOf: [], actionRead: [],
                  actionsFor: [], actionFacts: [], filingsFor: [], availableActions: [] };
  /* conformance's stand-in: determinations as its R9 answers them, sight by the determination's project. */
  const determinations = new Map();
  const sees = (project, viewer) => viewer === null || viewer === undefined || membership.inSight(project, viewer);
  const conformance = {
    determinationRead({ id, viewer }) {
      calls.determinationRead.push({ id, viewer });
      const d = determinations.get(id);
      if (!d || !sees(d.project, viewer)) return { ok: false, reason: "NO_SUCH_DETERMINATION" };
      return { ok: true, ...structuredClone(d), live: !d.superseded_by };
    },
    determinationsFor({ act, standard, outcome, live, after, limit = 200, viewer }) {
      calls.determinationsFor.push({ act, standard, outcome, live, after, viewer });
      const all = [...determinations.values()].filter((d) => sees(d.project, viewer))
        .filter((d) => !act || d.act.id === act)
        .filter((d) => !live || !d.superseded_by)
        .filter((d) => !standard || d.outcomes.some((o) => o.standard === standard && (!outcome || o.outcome === outcome)))
        .filter((d) => standard || !outcome || d.outcomes.some((o) => o.outcome === outcome))
        .sort((a, b) => (a.id < b.id ? -1 : 1)).filter((d) => !after || d.id > after);
      const cap = Math.min(limit, conformance.pageSize ?? 200);
      const items = all.slice(0, cap).map((d) => ({ ...structuredClone(d), live: !d.superseded_by }));
      return { ok: true, items, cursor: items.at(-1)?.id ?? null, truncated: all.length > cap };
    },
  };
  /* conformance R37 (T45; K2850): the cure links, `curesOf` answering `{standards: [{standard, link, ended}]}`, the
     standing link or null (a test may set
     `conformance.curesOf` to another shape, or delete it, to drive escalation R14's defensive read). */
  const cureLinks = [];
  conformance.curesOf = ({ determination, standard, viewer }) => {
    const d = determinations.get(determination);
    if (!d || !sees(d.project, viewer)) return { ok: false, reason: "NO_SUCH_DETERMINATION" };
    const mine = cureLinks.filter((l) => l.determination === determination && (!standard || l.standard === standard))
      .filter((l) => { const c = determinations.get(l.cure); return c && sees(c.project, viewer); });
    const stds = [...new Set(d.outcomes.map((o) => o.standard))].filter((x) => !standard || x === standard);
    return { ok: true, determination, standards: stds.map((x) => {
      const l = mine.filter((y) => y.standard === x && !y.ended).at(-1);
      return { standard: x, link: l ? { link: l.link, cure: l.cure, standard: x, by: V("alice"), at: l.at,
                                         cure_standing: !determinations.get(l.cure).superseded_by } : null,
               ended: mine.filter((y) => y.standard === x && y.ended) };
    }) };
  };
  /* consequences' stand-in: `addressed` per determination, `undetermined` "no consequence recorded" by default (K172). */
  const addressedBy = new Map();
  /* and `consequencesOf` (R7): the live parts recorded per determination, in R7's part shape; NO_SUCH_DETERMINATION for
     one absent or unseen, as conformance answers it. */
  const parts = new Map();
  const consequences = {
    addressed({ determination, viewer }) {
      calls.addressed.push({ determination, viewer });
      return addressedBy.get(determination) || { state: "undetermined", parts: [], says: word("escalation.consequence_recorded") };
    },
    consequencesOf({ determination, viewer }) {
      calls.consequencesOf.push({ determination, viewer });
      const d = determinations.get(determination);
      if (!d || !sees(d.project, viewer)) return { ok: false, reason: "NO_SUCH_DETERMINATION" };
      const ps = structuredClone(parts.get(determination) || []);
      return { ok: true, determination, standard: null, parts: ps, totals: [],
               undetermined: ps.filter((p) => p.state === "undetermined").map((p) => p.id),
               unproven: ps.filter((p) => p.causation.state === "unproven").map((p) => p.id),
               says: ps.length ? "each part is what it is" : word("escalation.consequence_recorded") };
    },
  };
  /* actions' stand-in: the ledger of each action, and R12's clock rule over the document's clock. */
  const ledgers = new Map();
  const actions = {
    actionRead({ id, viewer, now }) {
      calls.actionRead.push({ id, viewer, ...(now !== undefined ? { now } : {}) });
      const h = typeof id === "string" ? record.head(id) : null;
      if (!h || (viewer !== null && viewer !== undefined && !membership.inSight(id, viewer))) return noSuchAction(id);
      if (h.type !== "action") return noSuchAction(id);
      const hidden = actionHidden.has(id) && viewer !== null && viewer !== undefined && viewer !== V("alice");
      if (hidden) return noSuchAction(id);
      const fm = parseFrontmatter(record.readFile(id, "bundle.md").text).data || {};
      const legs = (Array.isArray(fm.action_basis) ? fm.action_basis : []).map((l) => ({ target: l.target, kind: l.kind }));
      return { ok: true, id, current_state: fm.current_state ?? null, kind: fm.action_kind ?? null,
               resolution: fm.resolution ?? null, ...(confidential.has(id) ? { confidential: true } : {}),
               /* actions R82, as its read answers it: `{owed, ...}`, absent reading owed */
               ...(!replyFromDocOnly ? { reply_owed: { owed: fm.reply_owed !== false } } : {}),
               correspondence: structuredClone(ledgers.get(id) || []), legs,
               premise_override: fm.premise_override ?? null,
               breach: fm.breach === true, counterparty: fm.counterparty ?? null, clock: Array.isArray(fm.clock) ? fm.clock : [] };
    },
    /* R30: the visible actions with a rests_on leg naming `determination`, in id order, a page at a time. */
    actionsFor({ determination, after = null, limit = 200, viewer }) {
      calls.actionsFor.push({ determination, after, viewer });
      const all = [...ledgers.keys()].sort().filter((id) => !after || id > after).filter((id) => {
        const r = actions.actionRead({ id, viewer });
        calls.actionRead.pop();
        return r.ok && (!determination || r.legs.some((l) => l.kind === "rests_on" && l.target === determination));
      });
      const cap = Math.min(limit, actions.pageSize ?? 200);
      const items = all.slice(0, cap).map((id) => {
        const fm = parseFrontmatter(record.readFile(id, "bundle.md").text).data || {};
        return { id, state: fm.current_state ?? null, kind: fm.action_kind ?? null,
                 counterparty: fm.counterparty?.role ?? null, counterparty_state: fm.counterparty?.state ?? null };
      });
      return { ok: true, items, limit: cap, truncated: all.length > cap, cursor: items.at(-1)?.id ?? null };
    },
    actionFacts(text, nowMs) {
      calls.actionFacts.push({ nowMs });
      const fm = typeof text === "string" ? parseFrontmatter(text).data : null;
      if (!fm || fm.object_type !== "action") return { kind: null, clock_next: null, clock_overdue: null };
      const pend = (Array.isArray(fm.clock) ? fm.clock : []).filter((c) => c && c.status === "pending" && /^\d{4}-\d{2}-\d{2}$/.test(c.date))
        .map((c) => c.date).sort();
      const next = pend[0] ?? null;
      const today = new Date(nowMs).toISOString().slice(0, 10);
      return { kind: fm.action_kind ?? null, clock_next: next, clock_overdue: next === null ? null : next < today };
    },
  };
  const actionHidden = new Set();
  /* actions R87 (T45): the actions whose latest scope statement is confidential, as the read answers them */
  const confidential = new Set();
  /* R6: when set, the read carries no reply_owed, so escalation reads the document (actions not yet merged) */
  let replyFromDocOnly = false;
  /* filings' stand-in. */
  const filings = {
    filingsFor({ action, viewer }) { calls.filingsFor.push({ action, viewer }); return { ok: true, drafts: [{ id: `FD-${action}`, tier: 1 }], packets: [] }; },
    availableActions({ determination, viewer }) {
      calls.availableActions.push({ determination, viewer });
      return { ok: true, kinds: [{ kind: "complaint", tier: 1, words: "Tier 1" }, { kind: "lawsuit", tier: 3, words: "Tier 3",
        counsel: "such an action requires competent counsel" }] };
    },
  };
  const given = Object.fromEntries(Object.entries({ conformance, consequences, actions, filings }).filter(([k]) => !omit.includes(k)));
  /* R4, R12, R30 (T33-76): with `structure`, the real entities, events and lines on this storage, each through its own
     factory (which reaches the modules it uses itself), escalation reaching them as its deps; otherwise none is given, and an events stand-in takes
     the registration. Either way the registered source is kept, so a test can call it with a viewer (events R30 calls
     it without one). */
  const source = { module: null, fn: null, registrations: 0 };
  let ents = null, ev = null, lines = null;
  if (structure) {
    /* No capture is cited here (every line is a member's testimony, every entity declared), so the capture-side
       modules the three read through (provenance, content, extraction) are given as empty stand-ins, never reached. */
    const unread = { provenance: {}, content: {}, extraction: {} };
    ents = entitiesOf(host, { record, membership, provenance: unread.provenance });
    ents.migrate();
    ev = eventsOf(host, { record, membership, entities: ents, ...unread, now: () => clock.now });
    ev.migrate();
    lines = linesOf(host, { record, entities: ents, events: ev, provenance: unread.provenance, content: unread.content,
                            now: () => clock.now });
    lines.migrate();
  }
  const events = {
    registerEventSource(module, fn) {
      source.registrations++;
      Object.assign(source, { module, fn });
      return ev ? ev.registerEventSource(module, fn) : { ok: true };
    },
  };
  /* no explicit migrate: the factory migrates its tables at construction (K267) */
  const esc = escalationOf(host, { record, membership, promotion, ...given, events,
                                   ...(structure ? { entities: ents, lines } : {}), now: () => clock.now });

  let n = 0, nd = 0, na = 0;
  const w = {
    st, host, record, membership, promotion, esc, clock, calls, determinations, addressedBy, ledgers, actionHidden,
    source, ents, ev, lines,
    stand: { conformance, consequences, actions, filings },
    parts,
    rows: (q, ...a) => [...st.sql.exec(q, ...a)],
    cureLinks, confidential, replyFromDoc(v) { replyFromDocOnly = v; },
    /** conformance R36's link, as the stand-in holds it: `cure` named the cure of `determination` for `standard`. */
    linkCure(determination, standard, cure, at = clock.now) {
      const link = `CURE-${cureLinks.length + 1}`;
      cureLinks.push({ link, determination, standard, cure, at });
      return link;
    },
    /** A member's revision of an action's document: its legs replaced (actions R8 (d)), everything else kept. */
    revise(id, { restsOn = [], replyOwed } = {}) {
      const h = record.head(id);
      let text = record.readFile(id, "bundle.md").text;
      const legs = restsOn.length ? ["action_basis:", ...restsOn.flatMap((t) => [`  - target: ${t}`, "    kind: rests_on"])].join("\n") : "action_basis: []";
      text = text.replace(/action_basis:(?: \[\])?(?:\n  - target: .*\n    kind: rests_on)*/, legs);
      if (replyOwed !== undefined) text = text.replace(/\n---\n\n## Action/, `\nreply_owed: ${replyOwed}\n---\n\n## Action`);
      const sha = createHash("sha256").update(text, "utf8").digest("hex");
      record.transact(() => record.commit({ bundleId: id, type: "action", title: id, project: null, snapKey: `r${++na}`,
        kind: "promotion", base: h.bundleSha, author: V("alice"), writer: null, operation: null,
        files: [{ path: "bundle.md", text, sha256: sha, bytes: Buffer.byteLength(text) }], state: "active", priorState: "active",
        group: "test-group", created: clock.now, lastUpdated: clock.now, criticality: null, at: clock.now }));
    },
    count: (t) => st.sql.exec(`SELECT COUNT(*) AS n FROM ${t}`).one().n,
    text: (id) => record.readFile(id, "bundle.md")?.text ?? null,
    fm: (id) => { const t = record.readFile(id, "bundle.md")?.text; return t ? parseFrontmatter(t).data : null; },
    snapshot() {
      const out = {};
      for (const { name } of st.sql.exec(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`))
        out[name] = JSON.stringify([...st.sql.exec(`SELECT * FROM ${name}`)]);
      return out;
    },
    member(id, { role = "member", status = "active" } = {}) {
      st.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                   VALUES (?, ?, ?, ?, ?, '["contribute"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`, role, status);
    },
    project(title, owner) {
      const r = promotion.promote({ base: null, snapKey: `k${++n}`, author: V(owner), ownerMemberId: owner,
        files: [{ path: "bundle.md", text: projMd(title) }], meta: { object_type: "project" } });
      if (!r.ok) throw new Error(`fixture project refused: ${JSON.stringify(r).slice(0, 400)}`);
      return r.bundleId;
    },
    join(projectId, memberId, state = "joined") {
      st.sql.exec(`INSERT OR REPLACE INTO project_participants (project_id, member_id, state, owner, created, updated)
                   VALUES (?, ?, ?, 0, 't', 't')`, projectId, memberId, state);
    },
    /** A determination as conformance records it: per-standard outcomes, an act with an actor office. */
    determine({ project, outcomes, actor = OFFICE.clerk, act = null, event = null, at = clock.now, supersededBy = null, findings = [] } = {}) {
      const id = `CONF-2026-${String(++nd).padStart(4, "0")}-determination`;
      /* R9's `standards`: each outcome with its in-force answer, rows and disagreement, as an outcome states them, else
         one diverging row over content `c1` */
      const standards = outcomes.map((o) => ({ standard: o.standard, outcome: o.outcome, in_force: o.in_force ?? "in_force",
        in_force_why: o.in_force_why ?? null, disagreement: o.disagreement ?? null,
        rows: o.rows ?? [{ requires: `what ${o.standard} requires`, did: "what the act did", reading: "diverges", content: ["c1"] }] }));
      determinations.set(id, { id, project, act: { id: act ?? `ACT-2026-${String(nd).padStart(4, "0")}`, ...(event ? { event } : {}),
        description: "the act", actor, at: "2026-09-01", evidence: ["c1"] }, outcomes: outcomes.map((o) => ({ standard: o.standard, outcome: o.outcome })),
        standards, at, author: V("alice"), superseded_by: supersededBy,
        findings: findings.map((f) => ({ finding: f, case: "CASE-1", edition: 1, version_sha: "0".repeat(8), role: "basis" })) });
      return id;
    },
    supersede(id, by = "CONF-2026-9999-determination") { determinations.get(id).superseded_by = by; },
    /** A real action bundle whose document states the breach, its legs and counterparty; its ledger the stand-in's. */
    action({ project, breach = true, restsOn = [], counterparty = { state: "named", ...OFFICE.clerk }, clock: clk = [],
             override = null, replyOwed, kind = "request_for_comment", resolution } = {}) {
      const id = `ACTN-2026-${String(++na).padStart(4, "0")}-act`;
      const text = actionMd({ id, project, breach, restsOn, counterparty, clock: clk, override, at: clock.now, replyOwed, kind, resolution });
      const sha = createHash("sha256").update(text, "utf8").digest("hex");
      record.transact(() => record.commit({ bundleId: id, type: "action", title: id, project: null, snapKey: `a${na}`,
        kind: "promotion", base: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", author: V("alice"),
        writer: null, operation: null, files: [{ path: "bundle.md", text, sha256: sha, bytes: Buffer.byteLength(text) }],
        state: "active", priorState: null, group: "test-group", created: clock.now, lastUpdated: clock.now,
        criticality: null, at: clock.now }));
      ledgers.set(id, []);
      return id;
    },
    /** A registered entity (entities' own act); `structure` worlds only. */
    ent(kind, label) {
      const r = ents.createEntity({ kind, label, note: `${label}, registered by the test`, declaredBy: V("alice") });
      if (!r.ok) throw new Error(`fixture entity refused: ${r.reason} ${r.detail}`);
      return r.entity_id;
    },
    /** A member's testimony line (lines' shortest valid act); `structure` worlds only. */
    say(kind, from, to, valid = { from: "2020-01-01", to: "2030-12-31" }) {
      const r = lines.recordLine({ kind, from, to, valid, basis: { statement: "the charter says so" }, by: V("alice") });
      if (!r.ok) throw new Error(`fixture line refused: ${r.reason} ${r.detail}`);
      return r.line_id;
    },
    /** One ledger entry, as actions' `actionCorrespond` appends it (R16): its position, direction, date and recording time. */
    correspond(action, direction, at, recordedAt = clock.now) {
      const l = ledgers.get(action);
      l.push({ ord: l.length, direction, at, recorded_at: recordedAt, author: V("alice") });
      return l.length - 1;
    },
  };
  return w;
}

export function projMd(title) {
  return ["---", "object_type: project", "schema: project@1", `title: "${title}"`, "current_state: forming",
          "prior_state: null", `created: "2026-09-27T00:00:00Z"`, `last_updated: "2026-09-27T00:00:00Z"`,
          `objective: "Find out what happened."`, "references: []", "state_history: []", "---", "",
          "## Objective", "", "Find out.", ""].join("\n");
}

function actionMd({ id, project, breach, restsOn, counterparty, clock, override, at, replyOwed, kind = "request_for_comment", resolution }) {
  const legs = restsOn.length ? ["action_basis:", ...restsOn.flatMap((t) => [`  - target: ${t}`, "    kind: rests_on"])] : ["action_basis: []"];
  const cp = ["counterparty:", ...Object.entries(counterparty).map(([k, v]) => `  ${k}: "${v}"`)];
  const clk = clock.length ? ["clock:", ...clock.flatMap((c) => [`  - text: "${c.text ?? "reply due"}"`, `    date: "${c.date}"`,
    `    basis: "${c.basis ?? "the rule"}"`, `    status: ${c.status ?? "pending"}`])] : ["clock: []"];
  return ["---", `id: ${id}`, "object_type: action", `title: "${id}"`, `action_kind: ${kind}`, "current_state: active",
    `project: ${project}`, `created: "${at}"`, `last_updated: "${at}"`, `breach: ${breach ? "true" : "false"}`,
    /* actions R8: a member's override of an unestablished premise, stamped with who and when */
    ...(override ? ["premise_override:", `  reason: "${override}"`, `  by: ${V("alice")}`, `  at: "${at}"`] : []), ...legs, ...cp,
    ...clk, "correspondence: []", ...(replyOwed !== undefined ? [`reply_owed: ${replyOwed}`] : []),
    ...(resolution ? [`resolution: ${resolution}`] : []), "---", "", "## Action", "", "An action.", ""].join("\n");
}

/** The common world: alice and bob joined in P, carol a member outside it; a determination noncompliant on two
 *  standards (and compliant on a third) of an act by the clerk's office. */
export function seeded(opts = {}) {
  const w = world(opts);
  for (const m of ["alice", "bob", "carol"]) w.member(m);
  w.P = w.project("Budget watch", "alice");
  w.join(w.P, "bob");
  w.D = w.determine({ project: w.P, outcomes: [{ standard: "STD-2026-0001-a", outcome: "noncompliant" },
    { standard: "STD-2026-0002-b", outcome: "noncompliant" }, { standard: "STD-2026-0003-c", outcome: "compliant" }] });
  return w;
}

/** Open an escalation of `w.D` by bob; throws on refusal. */
export function opened(w) {
  const r = w.esc.escalationOpen({ reason: "Worth pursuing.", determination: w.D, author: V("bob"), viewer: V("bob") });
  if (!r.ok) throw new Error(`fixture open refused: ${JSON.stringify(r).slice(0, 400)}`);
  w.E = r.id;
  return r;
}

/** Drive an open escalation of `w.D` to `stage` along 1→2→3→4 (and 4→5 or 4→7), the record meeting each trigger.
 *  Returns the notification action. */
export function toStage(w, stage) {
  opened(w);
  const go = (to) => { const r = w.esc.escalationAdvance({ id: w.E, to, reason: `to ${to}`, author: V("bob"), viewer: V("bob") });
                       if (!r.ok) throw new Error(`fixture advance to ${to} refused: ${JSON.stringify(r).slice(0, 600)}`); };
  if (stage === 1) return null;
  go(2);
  const n = w.action({ project: w.P, restsOn: [w.D] });
  w.N = n;
  const at = w.esc.escalationAttach({ reason: "This act serves the stage.", id: w.E, action: n, author: V("bob"), viewer: V("bob") });
  if (!at.ok) throw new Error(`fixture attach refused: ${JSON.stringify(at)}`);
  if (stage === 2) return n;
  w.correspond(n, "sent", "2026-09-02");
  go(3);
  if (stage === 3) return n;
  w.R = w.correspond(n, "received", "2026-09-10");
  go(4);
  if (stage === 4) return n;
  const ev = w.esc.escalationEvaluate({ id: w.E, response: { action: n, ord: w.R }, reading: "denied", reason: "Refused outright.",
                                        author: V("bob"), viewer: V("bob") });
  if (!ev.ok) throw new Error(`fixture evaluate refused: ${JSON.stringify(ev)}`);
  if (stage === 5 || stage === 7) { go(stage); return n; }
  if (stage === 6) {
    go(5);
    const a5 = w.action({ project: w.P, restsOn: [w.D] });
    w.A5 = a5;
    const r = w.esc.escalationAttach({ reason: "This act serves the stage.", id: w.E, action: a5, author: V("bob"), viewer: V("bob") });
    if (!r.ok) throw new Error(`fixture attach 5 refused: ${JSON.stringify(r)}`);
    w.correspond(a5, "sent", "2026-09-15");
    go(6);
    return n;
  }
  throw new Error(`no fixture path to stage ${stage}`);
}
