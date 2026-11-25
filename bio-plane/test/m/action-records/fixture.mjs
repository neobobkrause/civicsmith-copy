/* action-records alone, over the modules it uses, each the real one where it writes or reads the record (record-core,
   membership), on a real SQLite database (node:sqlite) standing in for a Durable Object's storage, answering as workerd's
   does (a cursor, and its LIKE/GLOB cap; K313, K316). Nothing here builds `actions`, a later module (the split map
   `build/extraction/actions-split.md` §7 risk 1): an action is a bundle written directly through the record's commit, and
   a capture the register holds is a row of provenance's `register` table (its R48 read contract, its own DDL), written
   here as a stand-in for a promotion that registers it. `progressions` and `standards` are stand-ins in their R5 shapes
   that the test controls. Every test drives `action-records` at its interface. */
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { PROVENANCE_SCHEMA } from "../../../src/provenance/index.mjs";
import { actionRecordsOf } from "../../../src/action-records/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { definitionRead } from "../progressions/fixtures.mjs";
import { standardReadWorld } from "../standards/fixtures.mjs";

const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);
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
/** A Durable Object's storage over an in-memory SQLite database. */
export function storage() {
  const db = new DatabaseSync(":memory:");
  let n = 0;
  const sql = {
    exec(q, ...args) {
      const literal = [...q.matchAll(/\b(?:GLOB|LIKE)\s+'((?:[^']|'')*)'/gi)].map((m) => m[1].replace(/''/g, "'"));
      const bound = /\b(?:GLOB|LIKE)\s+\?|\b(?:glob|like)\s*\(/i.test(q) ? args.filter((a) => typeof a === "string") : [];
      if ([...literal, ...bound].some((p) => Buffer.byteLength(p) > WORKERD_PATTERN_CAP))
        throw new Error("LIKE or GLOB pattern too complex");
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

export const sha = (s) => createHash("sha256").update(typeof s === "string" ? Buffer.from(s, "utf8") : s).digest("hex");
export const V = (id) => `member:${id}`;
export const M = V("alice");
export const MACHINE = "class:daemon";
export const NOW_MS = Date.parse("2026-09-28T12:00:00Z");
export const A = "ACTN-2026-0001-a";
export const B = "ACTN-2026-0002-b";
export const HIDDEN = "ACTN-2026-0003-hidden";
export const INFO = "INFO-2026-0001-d";
export const PROJECT = "PROJ-2026-0001-p";

/** An action's bundle.md; `lines` are joined into its front matter. */
export function actionMd(id, lines = []) {
  return ["---", `id: ${id}`, "object_type: action", `title: ${id}`, "current_state: planned",
          'created: "2026-09-01T00:00:00Z"', 'last_updated: "2026-09-01T00:00:00Z"', ...lines, "---", "", "An action.", ""]
    .join("\n");
}
export const CP = ["counterparty:", "  state: named", "  role: Town Clerk", "  body: Town of Port Ellery"];
/** A correspondence ledger in the action's bytes, one `{direction, at, account}` entry per item. */
export const ledger = (...dirs) => ["correspondence:", ...dirs.flatMap((d, i) =>
  [`  - direction: ${d}`, `    at: "2026-09-0${i + 2}"`, `    account: "entry ${i}"`, "    author: alice"])];

/* `deps`, when given, are further dependencies handed to `actionRecordsOf` (a stand-in a test controls).
   `profiles` names the active jurisdiction profiles: the test profile by default (layers.md, rule 3). */
export function world({ deps = {}, profiles = ["test-port-ellery"], create = true } = {}) {
  const st = storage();
  const host = { storage: st };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  const pbare = PROVENANCE_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of pbare.split(";")) if (t.trim()) st.db.exec(t);
  const clock = { ms: NOW_MS };
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  record.migrate();
  if (profiles) record.setSetting("jurisdiction_profiles", profiles, V("admin"));
  const membership = membershipOf(host, { record });
  membership.migrate();
  let n = 0;
  const w = {
    st, host, record, membership, clock,
    r: null,
    /** action-records over this host (created once; `extra` deps beside the fixture's). */
    make(extra = {}) {
      return actionRecordsOf(host, { record, membership, now: () => clock.ms, ...deps, ...extra });
    },
    rows: (q, ...x) => st.sql.exec(q, ...x).toArray(),
    row: (q, ...x) => st.sql.exec(q, ...x).toArray()[0] ?? null,
    text: (id) => record.readFile(id, "bundle.md")?.text ?? null,
    fm: (id) => { const t = w.text(id); return t ? parseFrontmatter(t).data : null; },
    /** A bundle written directly through the record (record-core R33), `type` its object type. */
    commit(id, text, { type = "action", project = null } = {}) {
      const head = record.head(id);
      return record.commit({ bundleId: id, type, title: id, project, snapKey: `k${++n}`, base: head ? head.bundleSha : null,
        author: M, files: [{ path: "bundle.md", text, sha256: sha(text) }], state: type === "action" ? "planned" : "collected",
        at: new Date(clock.ms).toISOString() });
    },
    /** An action of kind records_request with a named counterparty and `lines`. */
    action(id, lines = [], opts = {}) { return w.commit(id, actionMd(id, [...CP, "action_kind: records_request", ...lines]), opts); },
    /** An information bundle, and one capture the register names as its own; answers the capture's sha. */
    doc(id = INFO, words = `the text of ${id}`) {
      const text = ["---", `id: ${id}`, "object_type: information", `title: ${id}`, "current_state: collected",
                    'created: "2026-09-01T00:00:00Z"', 'last_updated: "2026-09-01T00:00:00Z"', "---", "", "A document.", ""].join("\n");
      w.commit(id, text, { type: "information" });
      const s = sha(words);
      st.sql.exec(`INSERT INTO register (capture_sha, bundle_id, path, encoding, bytes, registered) VALUES (?,?,?,?,?,?)`,
        s, id, `snapshots/${id}.txt`, "utf8", Buffer.byteLength(words), "2026-09-01T00:00:00Z");
      return s;
    },
    /** The real promotion on this host (the one write path R19 opens a question through). */
    get promotion() {
      const p = promotionOf(host, { record, membership, now: () => new Date(clock.ms).toISOString() });
      if (!w.factRegistered) { p.registerFact("producingGroup", "instance-setup", () => "test-group"); w.factRegistered = true; }
      return p;
    },
    /** An enrolled member (`id` bare, as membership holds it). */
    member(id, { role = "member", handle = `h_${id}` } = {}) {
      st.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                   VALUES (?, ?, ?, ?, 'active', '["contribute"]', 't', 't')`, id, `Cover ${id}`, handle, role);
    },
    /** A project promoted for real, owned by `owner`; answers its id. */
    project(title, owner) {
      const md = ["---", "object_type: project", "schema: project@1", `title: "${title}"`, "current_state: forming",
        "prior_state: null", 'created: "2026-09-27T00:00:00Z"', 'last_updated: "2026-09-27T00:00:00Z"', "references: []",
        "state_history: []", "---", "", "## Objective", "", "Find out.", ""].join("\n");
      const res = w.promotion.promote({ base: null, snapKey: `k${++n}`, author: V(owner), ownerMemberId: owner,
        files: [{ path: "bundle.md", text: md }], meta: { object_type: "project" } });
      if (!res.ok) throw new Error(`fixture project refused: ${JSON.stringify(res).slice(0, 300)}`);
      return res.bundleId;
    },
    /** `member` invited by `owner` into `project` and joined. */
    join(project, owner, member) {
      const inv = membership.projectInvite({ projectId: project, handle: `h_${member}`, by: owner, viewer: V(owner) });
      if (inv && inv.ok === false) throw new Error(`fixture invite refused: ${JSON.stringify(inv)}`);
      const j = membership.projectJoin({ projectId: project, by: member, viewer: V(member) });
      if (j && j.ok === false) throw new Error(`fixture join refused: ${JSON.stringify(j)}`);
    },
    /** A project no fixture member participates in, and an action belonging to it: hidden from `member:alice` and
     *  seen by a machine credential (membership R43). */
    hidden(id = HIDDEN, lines = []) {
      w.commit(PROJECT, ["---", `id: ${PROJECT}`, "object_type: project", `title: ${PROJECT}`, "current_state: forming",
        'created: "2026-09-01T00:00:00Z"', 'last_updated: "2026-09-01T00:00:00Z"', "---", "", "p", ""].join("\n"),
        { type: "project", project: PROJECT });
      return w.action(id, lines, { project: PROJECT });
    },
  };
  if (create) w.r = w.make();
  return w;
}

/* progressions R5's `readProgression`, a stand-in in its shape: `meeting` declares notice, minutes; `budget` adopted.
   Each key read is kept in `asked`; `broken` makes every read throw; `refusing` answers `ok: false`. */
export function progressionsStandIn() {
  const defs = { meeting: ["notice", "minutes"], budget: ["adopted"] };
  const p = { asked: [], broken: false, refusing: false,
    readProgression({ progressionKey }) {
      p.asked.push(progressionKey);
      if (p.broken) throw new Error("progressions unavailable");
      if (p.refusing) return definitionRead({});
      return defs[progressionKey]
        ? { ok: true, progression_key: progressionKey, found: true,
            stages: defs[progressionKey].map((k, i) => ({ stage_key: k, stage_no: i + 1 })) }
        : { ok: true, progression_key: progressionKey, found: false, stages: [] };
    } };
  return p;
}

/* standards R5's `standardRead`, a stand-in in its shape: `STD-2026-0001-held` is read by every member viewer;
   `STD-2026-0002-hidden` by `member:bob` alone; `broken` makes every read throw. Each call kept in `asked`. */
export const STD = "STD-2026-0001-held", STD_HIDDEN = "STD-2026-0002-hidden";
export function standardsStandIn() {
  const refusal = standardReadWorld(); /* the real standards' answer for an id its viewer does not see */
  const s = { asked: [], broken: false,
    standardRead({ id, viewer }) {
      s.asked.push({ id, viewer });
      if (s.broken) throw new Error("standards unavailable");
      if (id === STD) return { ok: true, id };
      if (id === STD_HIDDEN && viewer === V("bob")) return { ok: true, id };
      return refusal.standardRead({ id, viewer: refusal.stranger });
    } };
  return s;
}
