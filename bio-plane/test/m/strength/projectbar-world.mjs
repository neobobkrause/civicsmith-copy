/* The world projectbar's tests and strength's published fixtures share: a project with its owner and a joined member, over
   the real record-core, membership and promotion on a real SQLite database (node:sqlite); `inquiry` is a stand-in in the
   shape of its Provides (a bar act reads no basis). `promote` is the real one unless a test makes it refuse. */
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { storage } from "./fixture.mjs";
import { strengthOf } from "../../../src/strength/index.mjs";

export const NOW = "2026-10-13T12:00:00.000Z";
export const EMPTY = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
export const V = (m) => `member:${m}`;
export const WHY = "Our readers are the council's own auditors, so every document must be a capture we made ourselves.";

export const projMd = (title, extra = []) => ["---", "object_type: project", "schema: project@1", `title: "${title}"`,
  "current_state: forming", "prior_state: null", `created: "2026-09-27T00:00:00Z"`, `last_updated: "2026-09-27T00:00:00Z"`,
  `objective: "Find out what happened."`, ...extra, "references: []", "state_history: []", "---", "",
  "## Objective", "", "Find out.", ""].join("\n");

/** One world: alice (owner of P) and bob joined in P; carol invited to P, not joined; dave a member outside it; an
 *  administrator ann outside it; Q a second project of dave's; I an inquiry outside every project. */
export function world() {
  const st = storage();
  const host = { storage: st };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  const clock = { now: NOW };
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  const real = promotionOf(host, { record, membership, now: () => clock.now });
  real.registerFact("producingGroup", "instance-setup", () => "grp-one");
  const mode = { refuse: null, packages: [] };
  const promotion = {
    registerStep: (...a) => real.registerStep(...a),
    fact: (...a) => real.fact(...a),
    promote: (pkg) => { mode.packages.push(pkg); return mode.refuse ?? real.promote(pkg); },
  };
  const inquiry = { onGrounded: () => ({ ok: true }), restingOn: () => ({ ok: true, dependents: [] }),
                    basisFor: (id) => ({ ok: true, bundleId: id, legs: [] }), earned: () => ({ earned: {} }),
                    legCapped: () => null, subjectEntityOf: () => null };
  const s = strengthOf(host, { record, membership, promotion, inquiry, now: () => clock.now });
  let n = 0;
  const w = {
    st, record, membership, s, clock, mode,
    member(id, role = "member") {
      st.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                   VALUES (?, ?, ?, ?, 'active', '["contribute"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`, role);
    },
    project(title, owner, extra = []) {
      const r = real.promote({ base: null, snapKey: `k${++n}`, author: V(owner), ownerMemberId: owner,
        files: [{ path: "bundle.md", text: projMd(title, extra) }, { path: "notes/plan.md", text: "Kept as it is.\n" }],
        meta: { object_type: "project" } });
      if (!r.ok) throw new Error(`fixture project refused: ${JSON.stringify(r).slice(0, 400)}`);
      return r.bundleId;
    },
    join(project, member, state = "joined") {
      st.sql.exec(`INSERT OR REPLACE INTO project_participants (project_id, member_id, state, owner, created, updated)
                   VALUES (?, ?, ?, 0, 't', 't')`, project, member, state);
    },
    inquiry(id) {
      const text = ["---", `id: ${id}`, "object_type: inquiry", `title: "${id}"`, "current_state: open", "---", "",
                    "## Question", "", "Why?", ""].join("\n");
      const sha = createHash("sha256").update(text, "utf8").digest("hex");
      record.transact(() => record.commit({ bundleId: id, type: "inquiry", title: id, project: null, snapKey: `b${++n}`,
        kind: "promotion", base: EMPTY, author: V("alice"), writer: null, operation: null,
        files: [{ path: "bundle.md", text, sha256: sha, bytes: Buffer.byteLength(text) }], state: "open", priorState: null,
        group: "grp-one", created: clock.now, lastUpdated: clock.now, criticality: null, at: clock.now }));
      return id;
    },
    doc: (id) => record.readFile(id, "bundle.md").text,
    /** What a refused act must leave as it was: the document, the head, the manifest and the group's default. */
    snapshot: (id) => JSON.stringify([record.readFile(id, "bundle.md").text, record.head(id).bundleSha,
      st.sql.exec(`SELECT COUNT(*) AS n FROM manifest`)[0].n, st.sql.exec(`SELECT * FROM group_strength_bar`)]),
  };
  for (const m of ["alice", "bob", "carol", "dave"]) w.member(m);
  w.member("ann", "admin");
  w.P = w.project("Budget watch", "alice");
  w.join(w.P, "bob");
  w.join(w.P, "carol", "invited");
  w.Q = w.project("Parks watch", "dave");
  w.I = w.inquiry("INQ-2026-0001-q");
  return w;
}

/** An act by bob on P, with the control plane's stamps for bob's session. */
export const byBob = (w, extra = {}) => ({ project: w.P, capture: "B", connection: "C", reason: WHY, author: "bob",
                                    viewer: V("bob"), identity: V("bob"), ...extra });

