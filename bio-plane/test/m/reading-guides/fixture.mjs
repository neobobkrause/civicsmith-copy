/* reading-guides over the modules it uses, each the real one (record-core, membership), on a real SQLite database
   (node:sqlite) standing in for a Durable Object's storage, at the plane's shape (K313, K316): `sql.exec` answers a
   cursor, as workerd's does, never an array. Every test drives `reading-guides` at its interface. */
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { readingGuidesOf, READING_GUIDES_CHECKS } from "../../../src/reading-guides/index.mjs";

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

export const ANN = "member:ann", BOB = "member:bob", CY = "member:cy", REV = "member:rev", BOSS = "member:boss";
export const MACHINE = "class:ai";
export const NOW = "2026-10-09T12:00:00.000Z";

/** A whole item and a guide's items. */
export const item = (label = "Fiscal impact", look_for = "Look for the fiscal impact and who pays it", where) =>
  (where === undefined ? { label, look_for } : { label, look_for, where });
export const ITEMS = [item(), item("Votes", "Note whether the vote was unanimous", "the minutes' record of the vote")];

/** `slug`: the group's slug (null: none recorded); `civicsmith`: a library of the test's own; `profiles`: the active
 *  jurisdiction profiles, record-core's `jurisdiction_profiles` setting (R13; null: none set). */
export const MEMBERS = Object.freeze([["ann", "member", "active"], ["bob", "member", "active"], ["cy", "member", "active"],
                                       ["rev", "member", "revoked"], ["boss", "admin", "active"]]);

/** `members`: the roster's rows, `[id, role, status]` (default `MEMBERS`; R20's team of one passes one row);
 *  `profileList`: the active profiles and layers handed to the module as its `profileList` dep (R17; profile objects
 *  `jurisdictions.validate` passes), in place of the setting. */
export function world({ slug = "test-group", civicsmith, profiles = ["test-port-ellery"], members = MEMBERS, profileList } = {}) {
  const st = storage();
  const host = { storage: st };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  if (profiles) assert.equal(record.setSetting("jurisdiction_profiles", profiles, "admin").ok, true);
  for (const [m, role, status] of members)
    st.sql.exec(`INSERT INTO members (member_id, cover, role, status, created, updated) VALUES (?, 'c', ?, ?, '2026-01-01', '2026-01-01')`,
      m, role, status);
  let tick = 0;
  const now = () => new Date(Date.parse(NOW) + 1000 * tick++).toISOString();
  const g = readingGuidesOf(host, { record, membership, now, groupSlug: () => slug, ...(civicsmith ? { civicsmith } : {}),
                                    ...(profileList ? { profileList: () => profileList } : {}) });
  const w = {
    st, host, record, membership, g,
    rows: (q, ...a) => [...st.sql.exec(q, ...a)],
    count: (t) => w.rows(`SELECT COUNT(*) AS n FROM ${t}`)[0].n,
    /** Ann's draft of a staff report guide, its id. */
    draft(args = {}) {
      const r = g.guideDraft({ kind: "staff_report", items: ITEMS, by: ANN, ...args });
      assert.equal(r.ok, true, JSON.stringify(r));
      return r.guide;
    },
    /** Ann's draft, approved by Bob: the group's. */
    groupGuide(args = {}) {
      const id = w.draft(args);
      const r = g.guideReview({ guide: id, verdict: "approve", by: BOB });
      assert.equal(r.ok, true, JSON.stringify(r));
      return id;
    },
  };
  return w;
}

/** A refusal with its row (R11). */
export function row(r, code) {
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, code, JSON.stringify(r));
  assert.equal(r.code, code);
  assert.equal(r.check, READING_GUIDES_CHECKS[code].check);
  assert.equal(r.translation, READING_GUIDES_CHECKS[code].translation);
  assert.equal(typeof r.detail, "string");
}
