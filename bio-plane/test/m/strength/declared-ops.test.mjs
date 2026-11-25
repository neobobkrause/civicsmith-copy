/* strength R41 (T51; K4168): each op this module declares in DECLARED_OPS is held true against the op as the door runs it
   (test-support R15): only its requires raise no refusal naming a declared field, a call without each required one is refused
   naming it, and a field outside accepts is dropped or refused naming it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { declaredOpHolds } from "../../declared-ops.mjs";
import { DECLARED_OPS, strengthOps } from "../../../src/strength/index.mjs";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { strengthOf } from "../../../src/strength/index.mjs";
import { storage } from "./fixture.mjs";
const sameCode = (x, y) => x && y && x.ok === y.ok && (x.code ?? x.reason) === (y.code ?? y.reason);
/* the project-bar test's world: alice owns P with bob joined; ann an administrator outside it */
const NOW = "2026-10-13T12:00:00.000Z";
const EMPTY = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const V = (m) => `member:${m}`;
const WHY = "Our readers are the council's own auditors, so every document must be a capture we made ourselves.";

const projMd = (title, extra = []) => ["---", "object_type: project", "schema: project@1", `title: "${title}"`,
  "current_state: forming", "prior_state: null", `created: "2026-09-27T00:00:00Z"`, `last_updated: "2026-09-27T00:00:00Z"`,
  `objective: "Find out what happened."`, ...extra, "references: []", "state_history: []", "---", "",
  "## Objective", "", "Find out.", ""].join("\n");

/** One world: alice (owner of P) and bob joined in P; carol invited to P, not joined; dave a member outside it; an
 *  administrator ann outside it; Q a second project of dave's; I an inquiry outside every project. */
function world() {
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



/* a refusal names a field by its code (the table; an entry {code, end} also needs the answer to carry that end, and {code, whyHas} its why to hold those words; a refusal may be answered as refused) or, as the default does, by the field as a whole word of its code or detail */
const words = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));
const named = (codes, strict = false) => (answer, field) => {
  if (!answer || typeof answer !== "object") return false;
  const hit = (c) => (typeof c === "string" ? answer.code === c || answer.reason === c || answer.error === c || answer.refused === c
    : (answer.code === c.code || answer.reason === c.code || answer.refused === c.code)
      && Object.entries(c).every(([k, v]) => k === "code" || (k === "whyHas" ? [answer.why, answer.detail, answer.findings && JSON.stringify(answer.findings)].filter(Boolean).join(" ").includes(v) : answer[k] === v)));
  if ((codes[field] || []).some(hit)) return true;
  return !strict && new RegExp(`(^|[^\\w])${field}($|[^\\w])`).test([answer.code, answer.detail].map(words).join(" "));
};
/* the call as the door runs it: the stamps and every field in the address, the fields as the body, the arm asked of a fresh owner */
const mk = (op, stamps = {}, setup = null, invoke = null, adapt = null) => async (given) => {
  const env = setup ? await setup() : await (world());
  const fields = adapt ? adapt(given, env) : given;
  const q = new URLSearchParams({ op, ...stamps, ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])) });
  const url = new URL("http://x/?" + q);
  return invoke ? await invoke(url, fields, env, op) : await (strengthOps(env.s, url, fields)[{ strengthbarset: "strengthbar" }[op] ?? op]());
};

test("R41 strength declares strengthbarset: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "strengthbarset", declaration: DECLARED_OPS["strengthbarset"], call: mk("strengthbarset", {"author":"ann","viewer":"member:ann"}),
    refusedNaming: named({"capture":["NO_BAR"],"connection":["NO_BAR"],"reason":["BAR_NO_REASON"]}, true), values: {"reason":"Our readers are the council's own auditors, so every document must be a capture we made ourselves.","capture":"B"}, same: sameCode });
});

test("R41 strength declares projectbarset: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "projectbarset", declaration: DECLARED_OPS["projectbarset"], call: mk("projectbarset", {"author":"alice","viewer":"member:alice"}, null, null, (fields, env) => (({ ...fields, ...("project" in fields ? { project: env.P } : {}) }))),
    refusedNaming: named({"project":["NO_SUCH_PROJECT"],"reason":["PROJECT_BAR_NO_REASON"]}, true), values: { reason: WHY }, same: sameCode });
});

test("R41, R44 strength declares inquirystrength: its requires (an id or a list of ids) alone raise no refusal naming a field, a call without either is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "inquirystrength", declaration: DECLARED_OPS["inquirystrength"], call: mk("inquirystrength", {"viewer":"member:ann"}),
    refusedNaming: named({"id":["NO_ID"],"ids":["NO_ID"]}, true), values: {}, same: sameCode });
});
