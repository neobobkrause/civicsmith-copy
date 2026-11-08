/* hypotheses over the modules it uses, each the real one (record-core, membership, promotion, connection-grammar, and
   explore where a test asks), on a real SQLite database (node:sqlite) standing in for a Durable Object's storage, at the
   plane's shape (`sql.exec` answers a cursor). Every test drives `hypotheses` at its interface: its acts and reads, its
   hunch hops through a connection registry, its leg check through an inquiry's promotion, and its ops. */
import { DatabaseSync } from "node:sqlite";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { createRegistry } from "../../../src/connection-grammar/index.mjs";
import { hypothesesOf, HYPOTHESES_TABLES, NOTES_TABLES, NOTE_NUMBERS_TABLE, PROPOSALS_TABLE, SHARES_TABLE, RIVALS_TABLES } from "../../../src/hypotheses/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);

function cursor(rows) {
  let i = 0;
  const c = {
    next() { return i < rows.length ? { done: false, value: rows[i++] } : { done: true, value: undefined }; },
    [Symbol.iterator]() { return c; },
    toArray() { const out = rows.slice(i); i = rows.length; return out; },
  };
  return c;
}

function storage() {
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

export const ANN = "member:ann";
export const OUTSIDER = "member:outsider";
export const BOSS = "member:boss";
export const NOW = "2026-10-06T01:00:00.000Z";
export const INQ = "INQ-2026-0001-q";
export const E1 = "ENT-2026-0001", E2 = "ENT-2026-0002", E3 = "ENT-2026-0003";

/** The world: a host with record-core, membership and promotion, and `hypotheses` made over them with its own
 *  connection registry. `deps` are passed to `hypothesesOf` (an `explore`, a `calculations`). Members: Ann and the
 *  outsider, ordinary, and the boss, an administrator. */
export function world(deps = {}) {
  const st = storage();
  const host = { storage: st };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  const promotion = promotionOf(host, { record, membership, now: () => NOW });
  promotion.registerFact("producingGroup", "instance-setup", () => "test-group");
  promotion.registerFact("citedBy", "connections", () => []);
  promotion.registerFact("caseMember", "publication", () => false);
  const registry = deps.registry ?? createRegistry();
  let tick = 0;
  const clock = () => new Date(Date.parse(NOW) + 1000 * tick++).toISOString();
  /* R19: inquiry's record read for its person test (`personFacts`); a world here holds no entities, so it names none
     unless a test gives its own (the real inquiry needs the modules beneath it, which this world does not build). */
  const inquiry = deps.inquiry ?? { personFacts: () => [] };
  const h = hypothesesOf(host, { record, membership, promotion, registry, now: clock, ...deps, inquiry });
  for (const [m, role] of [["ann", "member"], ["outsider", "member"], ["boss", "admin"]])
    st.sql.exec(`INSERT INTO members (member_id, cover, role, status, created, updated) VALUES (?, 'c', ?, 'active', '2026-01-01', '2026-01-01')`, m, role);
  let n = 0;
  const w = {
    st, host, record, membership, promotion, registry, h,
    rows: (q, ...a) => [...st.sql.exec(q, ...a)],
    bundle(id, { type = "inquiry", project = "" } = {}) {
      st.sql.exec(`INSERT OR IGNORE INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated, bundle_sha, row_version, project)
                   VALUES (?, ?, 'g', 't', 'open', '2026-01-01', '2026-01-01', 'x', 1, ?)`, id, type, project ?? "");
      return id;
    },
    /** A project with one participant, and an inquiry inside it. */
    fenced(inquiry, project = "PROJ-2026-0001", participant = "ann") {
      w.bundle(project, { type: "project" });
      st.sql.exec(`INSERT OR IGNORE INTO project_participants (project_id, member_id, state, owner, created, updated)
                   VALUES (?, ?, 'joined', 1, '2026-01-01', '2026-01-01')`, project, participant);
      return w.bundle(inquiry, { project });
    },
    /** One hypothesis held by Ann, its id. */
    hold(args = {}) {
      const r = h.hold({ inquiry: INQ, kind: "relation", statement: "They act together.", about: { from: E1, to: E2 }, by: ANN, ...args });
      if (!r.ok) throw new Error(`fixture hold refused: ${JSON.stringify(r)}`);
      return r.hypothesis_id;
    },
    /** A promotion of an inquiry document with these legs, over its head (or a creation). */
    promote(id, legs, extra = {}) {
      const head = record.head(id);
      return promotion.promote({ bundleId: id, base: head ? head.bundleSha : null, snapKey: `k${++n}`, author: extra.author ?? ANN,
        files: [{ path: "bundle.md", text: inquiryMd(id, legs) }], meta: { object_type: "inquiry" } });
    },
    /** Every table's rows but this module's, for R8's comparison. */
    others() {
      const names = w.rows(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).map((r) => r.name)
        .filter((t) => !HYPOTHESES_TABLES.includes(t) && !NOTES_TABLES.includes(t) && t !== NOTE_NUMBERS_TABLE && t !== "seq"
                       && t !== PROPOSALS_TABLE && t !== SHARES_TABLE && !RIVALS_TABLES.includes(t));
      return Object.fromEntries(names.map((t) => [t, JSON.stringify(w.rows(`SELECT * FROM ${t}`))]));
    },
  };
  return w;
}

/** An inquiry document whose basis is `legs` (each a flat map of scalars, as the frontmatter grammar holds them). */
export function inquiryMd(id, legs = []) {
  const scalar = (v) => (typeof v === "string" ? JSON.stringify(v) : String(v));
  return ["---", `id: ${id}`, "object_type: inquiry", "schema: inquiry@1", `title: "Is ${id} answered?"`,
    "current_state: open", "prior_state: null", `created: "2026-10-03T00:00:00Z"`,
    `last_updated: "2026-10-03T00:00:00Z"`, "group: test-group", "references: []", "state_history: []",
    "surfaced_by: human", 'disposition_reason: ""',
    ...(legs.length ? ["basis:", ...legs.flatMap((l) => {
      const { target, ...rest } = l;
      return [`  - target: ${target}`, ...Object.entries({ role: "supports", ...rest }).map(([k, v]) => `    ${k}: ${scalar(v)}`)];
    })] : []),
    "---", "", "## Question", "", `Is ${id} answered?`, "", word("conformance.rests"), "", "## Conclusion", "",
    word("conformance.falsify"), "", "## Session Log", "", "## Review Notes", ""].join("\n");
}
