/* The producers' test world: record-core, membership and credentials real, over node:sqlite behind a `sql` that answers as workerd's
   does (a CURSOR, iterable once, with `toArray()` and `one()`; K316); every other provider a fake in the shape its
   requirements publish, which a test fills. The tables other modules own and this module reads by their read contracts
   (record-core R37, provenance R48, inquiry R40, connections R58, progressions R34, publication R40, R56) are their owners' own schemas
   where this module uses the owner (record-core, provenance, membership, credentials), else created here with exactly the
   contracted columns.

   `homesOf` and `optionsOf` are queue's (its R7, R12), passed in by R8; here they are the caller's side of that
   interface: a walk up basis legs and `cites` edges through the viewer's gate, in queue R7's shape, and options that
   record the subjects they were asked about. */
import { DatabaseSync } from "node:sqlite";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { PROVENANCE_SCHEMA } from "../../../src/provenance/schema.mjs";
import { membershipOf, viewerPredicate } from "../../../src/membership/index.mjs";
import { credentialsOf } from "../../../src/credentials/index.mjs";
import { projectRosterOf } from "../../../src/project-roster/index.mjs";
import { queueProducersOf } from "../../../src/queue-producers/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { tidy } from "../../../src/queue-producers/words.mjs";
import { caseDocumentFacts } from "../publication/fixtures.mjs";
import { monitoringReads } from "../monitoring/fixtures.mjs";
import { coreDue } from "../docket/fixtures.mjs";
import { homeOfEmpty, homeOfHomed, sha } from "../provenance/fixtures.mjs";

export { sha };

/* monitoring's reads over an empty world and over real monitors, and docket's `coreDue` (their published fixtures), made once at load */
export const MONITORING = await monitoringReads();
export const DOCKET = coreDue();
/* provenance over an empty store (its published fixture), made once on first use: no capture has a home */
let noHomes = null;
/** provenance answering `homeOf` for each capture digest of `map` (`{sha: bundleId}`) with the bundle the real register acts homed it in (its published fixture). */
export const homed = (map = {}) => { const real = homeOfHomed(map); return { homeOf: (s) => real.homeOf(s) }; };

/* publication's own answer for an edition with no document (its published fixture), made once, on first use */
let absent = null;
const absentFacts = () => (absent ??= caseDocumentFacts().absent);

export const NOW = Date.parse("2026-09-01T00:00:00Z");
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
/** A day `YYYY-MM-DD` as a sentence names it (R43): `date.daymonth`, or `date.daymonthyear` when `year` says the year is named. */
export const dayWord = (ymd, year = false) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return word(year ? "date.daymonthyear" : "date.daymonth", { month: word(`date.month.${MONTHS[m - 1]}`), day: String(d), year: String(y) });
};
/** A 24-hour clock as `time.clock` writes it (DEC-335). */
export const clockWord = (hour, minute) => word("time.clock", { hour: String(hour % 12 === 0 ? 12 : hour % 12), minute: String(minute).padStart(2, "0"), ampm: word(hour < 12 ? "time.am" : "time.pm") });
/** `time.at`: a day and a clock. */
export const atWord = (ymd, hour, minute, year = false) => word("time.at", { date: dayWord(ymd, year), time: clockWord(hour, minute) });
/** What `summary` or `detail` should equal: the key's word with the fills, a blank fill closed up as the module closes it. */
export const said = (key, vars = {}) => tidy(word(key, vars));
export const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);

function cursor(rows) {
  let used = false;
  const it = {
    [Symbol.iterator]() { if (used) throw new Error("a cursor is iterable once"); used = true; return rows[Symbol.iterator](); },
    toArray() { return [...it]; },
    one() { const a = [...it]; if (a.length !== 1) throw new Error("one(): not exactly one row"); return a[0]; },
  };
  return it;
}

export function world(fakes = {}) {
  const db = new DatabaseSync(":memory:");
  const statements = [];
  let sp = 0;
  const sql = { exec(q, ...a) {
    statements.push(q);
    for (const m of q.matchAll(/(?:LIKE|GLOB)\s+'([^']*)'/gi)) if (m[1].length > 50) throw new Error("LIKE/GLOB over 50 bytes (K313)");
    const st = db.prepare(q);
    if (st.columns().length) return cursor(st.all(...a.map(bind)).map((r) => ({ ...r })));
    st.run(...a.map(bind)); return cursor([]);
  } };
  const storage = { sql, transactionSync(fn) { const n = `sp${sp++}`; db.exec(`SAVEPOINT ${n}`);
    try { const r = fn(); db.exec(`RELEASE ${n}`); return r; } catch (e) { db.exec(`ROLLBACK TO ${n}`); db.exec(`RELEASE ${n}`); throw e; } } };
  const host = { storage };
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  const membership = membershipOf(host, { record });
  /* credentials registers its seam with membership at its start (credentials R16, R17) and holds the signer keys (its R8). */
  const credentials = credentialsOf(host, { record, membership });
  /* project-roster (R41, R42): real, over the same storage, so an invitation and a request are the module's own rows. */
  const roster = projectRosterOf(host, { record, membership });
  for (const t of `${RECORD_SCHEMA};${PROVENANCE_SCHEMA}`.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").split(";")) if (t.trim()) db.exec(t);
  db.exec(`CREATE TABLE IF NOT EXISTS inquiry_basis (bundle_id TEXT, ord INTEGER, role TEXT, target_id TEXT, content_id TEXT, note TEXT);
           CREATE TABLE IF NOT EXISTS refs (bundle_id TEXT, target_id TEXT, kind TEXT);
           CREATE TABLE IF NOT EXISTS inquiry_basis_version_legs (bundle_id TEXT, name TEXT, ord INTEGER, target_id TEXT, target_type TEXT,
             role TEXT, grade TEXT, grade_axis TEXT, grade_source TEXT, ground TEXT, content_id TEXT);
           CREATE TABLE IF NOT EXISTS progression_instances (progression_key TEXT, entity_id TEXT, stage_key TEXT, capture_sha TEXT, bundle_id TEXT);
           CREATE TABLE IF NOT EXISTS case_documents (case_id TEXT NOT NULL, edition INTEGER NOT NULL, authored_at TEXT NOT NULL, sig_armored TEXT);
           CREATE TABLE IF NOT EXISTS cases (case_id TEXT PRIMARY KEY, project_id TEXT);
           CREATE TABLE IF NOT EXISTS published_cases (case_id TEXT NOT NULL, edition INTEGER NOT NULL, scope TEXT, PRIMARY KEY (case_id, edition))`);
  record.migrate();
  membership.migrate();
  credentials.migrate();
  roster.migrate();
  const F = defaultFakes();
  for (const [k, v] of Object.entries(fakes)) F[k] = { ...F[k], ...v };
  const p = queueProducersOf(host, { record, membership, credentials, projectRoster: roster, ...F });

  /* The caller's R7 walk: every inquiry and project upward by basis legs and cites, through the viewer's gate. */
  const homesOf = (viewer) => (subjects) => {
    const gate = viewerPredicate(viewer);
    const seen = new Set(subjects), found = [];
    let frontier = [...subjects], depth = 0;
    while (frontier.length && depth < 6) {
      depth += 1;
      const next = [];
      for (const n of frontier)
        for (const r of db.prepare(`SELECT bundle_id FROM inquiry_basis WHERE target_id=? UNION SELECT bundle_id FROM refs WHERE target_id=? AND kind='cites'`).all(n, n)) {
          if (seen.has(r.bundle_id)) continue;
          seen.add(r.bundle_id); next.push(r.bundle_id);
          const b = db.prepare(`SELECT b.bundle_id, b.object_type FROM bundles b WHERE b.bundle_id=? AND (${gate.sql})`).get(r.bundle_id, ...gate.args.map(bind));
          if (b && ["inquiry", "project"].includes(b.object_type)) found.push({ id: b.bundle_id, type: b.object_type, depth });
        }
      frontier = next;
    }
    found.sort((a, b) => (a.id < b.id ? -1 : 1));
    return { state: "determined", ungrouped: found.length === 0, reasons: [], depth_bound: 6, ancestors: found, of: [...subjects] };
  };
  const asked = { homes: [], options: [] };
  const w = {
    db, sql, host, record, membership, credentials, roster, p, fakes: F, statements, now: NOW, asked,
    run: (s, ...a) => db.prepare(s).run(...a.map(bind)),
    bundle(id, type = "information", { title = id, state = null } = {}) {
      const st = state || ({ inquiry: "open", project: "active", information: "collected" }[type] || "collected");
      db.prepare(`INSERT INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated, bundle_sha)
                  VALUES (?,?,?,?,?,?,?,?)`).run(id, type, "g", title, st, iso(NOW), iso(NOW), "sha");
      return id;
    },
    member(id, { role = "member", status = "active", handle = null } = {}) {
      db.prepare(`INSERT INTO members (member_id, cover, handle, role, status, created, updated, pairing_published) VALUES (?,?,?,?,?,?,?,0)`)
        .run(id, id, handle, role, status, iso(NOW), iso(NOW));
      return id;
    },
    join(project, member, { owner = false, state = "joined" } = {}) {
      db.prepare(`INSERT INTO project_participants (project_id, member_id, state, owner, created, updated) VALUES (?,?,?,?,?,?)`)
        .run(project, member, state, owner ? 1 : 0, iso(NOW), iso(NOW));
    },
    signer(key, member, { origin = "self", status = "active", comment = null, added = iso(NOW) } = {}) {
      db.prepare(`INSERT INTO signers (key_b64, member_id, comment, status, added, origin, registered_by) VALUES (?,?,?,?,?,?,?)`)
        .run(key, member, comment, status, added, origin, origin === "self" ? member : null);
    },
    /** A project its owners set discoverable (membership R45's record, re-derived into R85's index), so an administrator
     *  outside it still sees it whole (membership R43; K2409). A project with no such act is hidden (D54). */
    discoverable(project) {
      db.prepare(`INSERT INTO project_visibility (project_id, setting, set_by, reason, at) VALUES (?,?,?,?,?)`)
        .run(project, "discoverable", "owner", null, iso(NOW));
      membership.reindexProjectSight(project);
    },
    cite(from, to, kind = "cites") { db.prepare(`INSERT INTO refs (bundle_id, target_id, kind) VALUES (?,?,?)`).run(from, to, kind); },
    leg(inquiry, target, ord = 0) { db.prepare(`INSERT INTO inquiry_basis (bundle_id, ord, role, target_id) VALUES (?,?,?,?)`).run(inquiry, ord, "supports", target); },
    /** R8's read, as queue makes it: homesOf and optionsOf closed over the viewer and identity. */
    read(member = null, viewer = member ? `member:${member}` : "class:admin", { now = NOW, homes = true, options = true } = {}) {
      const walk = homesOf(viewer);
      return p.feedItems({ member, viewer, now, identity: member ? `member:${member}` : null,
        homesOf: homes ? (s) => { asked.homes.push([...s]); return walk(s); } : undefined,
        optionsOf: options ? (s) => { asked.options.push([...s]); return s.length ? [{ id: "opt", on: [...s] }] : []; } : undefined });
    },
  };
  return w;
}

/** Every provider the producers reach, answering nothing until a test says otherwise. */
export function defaultFakes() {
  return {
    governor: { governorHolding: () => [] },
    provenance: { homeOf: (s) => (noHomes ??= homeOfEmpty()).homeOf(s) },
    capture: { liveCaptureSessions: () => [] },
    captureRequests: { completed: () => ({ requests: [] }), leads: () => ({ requests: [] }), rendersHeld: () => ({ requests: [] }) },
    basisVersions: { projectsDrawingOn: () => Object.assign([], { bound: 32, truncated: false }), conclusionOf: () => null,
                     conclusionRecordOf: () => ({ stance: null }), basisVersions: () => ({ ok: true, versions: [], truncated: false }) },
    progressions: { proposalsFeed: () => ({ instances: [], proposals: [], dispositions: [] }) },
    aiRuns: { runFor: () => null },
    bias: { uncleared: () => ({ debts: [], limit: 200, truncated: false }) },
    /* publication keeps R23's read; the scheduled editions are publish-schedule's (its R4, was publication R69; N823) */
    publication: { caseDocumentFacts: (c, e) => ({ ...absentFacts(), caseId: c, edition: e }) },
    publishSchedule: { scheduledEditions: () => ({ ok: true, editions: [], limit: 500, cursor: null }) },
    /* N612: a published case's tensions are case-tensions' (its R4, was publication R50) */
    caseTensions: { caseTensions: () => ({ ok: true, cases: [], limit: 200, cursor: null }) },
    corpusExport: { exportLog: () => ({ ok: true, exports: [], limit: 200, truncated: false }) },
    reevaluation: { notices: () => ({ ok: true, notices: [], limit: 1000, truncated: false }),
                    correctedDependents: () => ({ ok: true, entries: [], limit: 200, truncated: false, cursor: null }),
                    docketDependents: () => ({ ok: true, entries: [], count: 0, limit: 200, truncated: false, cursor: null }),
                    citedCaseDependents: () => ({ ok: true, entries: [], count: 0, limit: 200, truncated: false, cursor: null, wrote: false }) },
    caseImport: { watchItems: () => ({ entries: [], refused: [], unreadable: [] }) },
    wizardScripts: { brokenScripts: () => ({ ok: true, entries: [], cursor: null, truncated: false }),
                     submittedFor: () => ({ ok: true, entries: [], cursor: null, truncated: false }),
                     baseUpdates: () => ({ ok: true, entries: [], cursor: null, truncated: false }) },
    intent: { gaps: () => ({ ok: true, gaps: [] }) },
    monitoring: { monitoring: () => MONITORING.empty.monitoring,
                  flagged: () => MONITORING.empty.flagged,
                  archiveEligible: () => MONITORING.empty.archiveEligible },
    linkSweep: { sweepConditions: () => ({ ok: true, conditions: [] }) },
    contradiction: { candidatesFor: () => ({ ok: true, candidates: [], truncated: false, cursor: null }),
                     conflictNotices: () => ({ ok: true, notices: [], truncated: false, cursor: null }) },
    /* actions R12's place: the active profiles' combined view, whose `time_zone` machinery-producers reads (its R10) */
    actions: { place: () => ({ time_zone: { value: "UTC", status: "ruled", basis: "TEST" } }) },
    /* T45 (K2781 (1)): the Action layer's to-dos, action-producers' (its R13), answered through R8; a test fills it */
    actionProducers: { actionItems: () => ({ items: [], facts: {} }) },
    docket: { coreDue: () => DOCKET.unread },
    /* T53 (R60, R61): a stopped AI account (ai-accounts R75) and re-testing turned off (ai-use R29); a test hands the real module's read */
    aiAccounts: { creditsStopsOpen: () => [] },
    aiUse: { retestingOff: () => ({ ok: true, off: [] }) },
    networkNotices: { noticesOf: ({ project }) => ({ ok: true, project, notices: [], sealed_weeks: [], methodVersion: 1 }) },
  };
}

/** The items of a read by id. */
export const byId = (r) => Object.fromEntries((r.items || []).map((i) => [i.id, i]));
