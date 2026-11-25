/* case-account over the modules it uses, each the real one (record-core, membership, inquiry with the promotion it
   joins, content's and extraction's tables, publication's tables, case-disclosures), on a real SQLite database
   (node:sqlite) standing in for a Durable Object's storage. Copied from case-authoring's fixture without
   `caseAuthoringOf` (`build/extraction/case-account-split.md` §6): a case is published or prepared by writing
   publication's `cases` and `case_documents` rows directly (its R40 read contract), since publication's act is later
   than nothing here and `case-authoring`, which drives it, is later than this module. What a later module fills is a
   stand-in the test controls: the runs ai-runs answers (`runs`), bias's printed statements case-disclosures R30 asks
   (`printed`), and, when a test sets `w.judgeAccount`, case-disclosures R30's answer itself (`w.judged` records each
   hand-over). Every test drives `case-account` at its interface. */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { inquiryOf, legCapped } from "../../../src/inquiry/index.mjs";
import { migrateContent } from "../../../src/content/schema.mjs";
import { EXTRACTION_SCHEMA } from "../../../src/extraction/schema.mjs";
import { migratePublication } from "../../../src/publication/schema.mjs";
import { caseDisclosuresOf } from "../../../src/case-disclosures/index.mjs";
import { projectRosterOf } from "../../../src/project-roster/index.mjs";
import { basisVersionsOf } from "../../../src/basis-versions/index.mjs";
import { caseAccountOf } from "../../../src/case-account/index.mjs";
/* retrieval's published fixture (fix round 10): the real retrieval over an empty store, whose `selectionResolve` answers
   NO_SUCH_SELECTION for any handle; `retrieval.selectionResolve` is what this world's inquiry reads. */
import { noSelection } from "../retrieval/fixtures.mjs";

export const sha = (s) => createHash("sha256").update(typeof s === "string" ? Buffer.from(s, "utf8") : s).digest("hex");
const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);

export function storage() {
  const db = new DatabaseSync(":memory:");
  let n = 0;
  const sql = {
    exec(q, ...args) {
      const st = db.prepare(q);
      return st.columns().length ? st.all(...args.map(bind)).map((r) => ({ ...r })) : (st.run(...args.map(bind)), []);
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
export const NOW = "2026-09-28T01:00:00Z";
export const T0 = "2026-09-27T00:00:00Z";
const execAll = (st, schema) => {
  for (const s of schema.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").split(";"))
    if (s.trim()) st.db.exec(s);
};

/** A world: the real modules case-account reads, and `w.cacc`, its one instance on the host. `deps` replaces any of
 *  case-account's own deps (`record`, `inquiry`, `runs`, `disclosures`, `now`); `create: false` leaves it uncreated, so a
 *  test creates it itself. */
export function world({ group = "test-group", deps = {}, create = true } = {}) {
  const st = storage();
  const host = { storage: st };
  execAll(st, RECORD_SCHEMA);
  /* The columns inquiry writes on record-core's `bundles` (its R40), which the store's additive list creates today. */
  for (const c of ["inquiry_basis_count INTEGER", "inquiry_subject_entity TEXT", "inquiry_superseded_by TEXT"])
    st.db.exec(`ALTER TABLE bundles ADD COLUMN ${c}`);
  const clock = { now: NOW, ms: "2026-09-28T01:00:00.000Z" };
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  /* the read contracts this module joins: content's `content` (its R45), extraction's `capture_text` (its R58),
     publication's `cases` and `case_documents` (its R40), each created by its owner's own schema */
  migrateContent(st.sql);
  execAll(st, EXTRACTION_SCHEMA);
  migratePublication(st.sql);
  const retrieval = noSelection();
  const inquiry = inquiryOf(host, { record, membership, retrieval, now: () => clock.now });
  inquiry.migrate();
  const promotion = inquiry.promotion;
  promotion.registerFact("producingGroup", "instance-setup", () => group);
  /* case-disclosures (its R30), the real one on this host; `printed` is what bias's `statementInForce` answers in force */
  const printed = new Set();
  const bias = { statementInForce: ({ statement }) => ({ ok: true, in_force: printed.has(statement) }) };
  const disclosures = caseDisclosuresOf(host, { storage: st, record, membership, inquiry, bias });
  /* provenance's register, which every promotion writes (its R1), migrated on the one instance content created on this
     host, reached through case-disclosures (no import of a module this one does not use) */
  disclosures.provenance.migrate();
  /* connections' and entities' tables, which promoting a cited bundle projects into (their R1s), each the one instance
     on this host, reached through inquiry */
  inquiry.connections.migrate();
  inquiry.entities.migrate();
  /* project-roster (its R23's scope, R21's act that sets it) and basis-versions (its R23: a finding's own conclusion),
     the real ones on this host, as T45's R13 and R14 read them */
  const roster = projectRosterOf(host, { record, membership });
  roster.migrate();
  const versions = basisVersionsOf(host, { record, membership, promotion,
    inquiry: { earned: (s, t) => inquiry.earned(s, t), legCapped, cyclePath: (id, t) => inquiry.cyclePath(id, t) },
    now: () => clock.now });
  versions.migrate();
  /* ai-runs' `runFor` over the test's own runs: a run is seen by every viewer but "nobody" */
  const runs = new Map();
  const aiRuns = { runFor: (id, viewer) => (runs.has(String(id)) && viewer !== "nobody"
    ? { run: String(id), status: runs.get(String(id)).status, mode: "draft" } : null) };
  const w = {
    st, host, record, membership, inquiry, promotion, disclosures, runs, printed, clock, roster, versions,
    row: (q, ...a) => st.sql.exec(q, ...a)[0] ?? null,
    rows: (q, ...a) => st.sql.exec(q, ...a),
    count: (t) => st.sql.exec(`SELECT COUNT(*) AS n FROM ${t}`)[0].n,
    snapshot() {
      const out = {};
      for (const { name } of st.sql.exec(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`))
        out[name] = JSON.stringify(st.sql.exec(`SELECT * FROM "${name}"`));
      return out;
    },
  };
  w.judged = [];
  const judgedDisclosures = new Proxy(disclosures, { get: (t, p) => (p === "accountJudged"
    ? (a) => { w.judged.push(a); return w.judgeAccount ? w.judgeAccount(a) : t.accountJudged(a); }
    : typeof t[p] === "function" ? t[p].bind(t) : t[p]) });
  w.deps = { record, membership, inquiry, runs: aiRuns, disclosures: judgedDisclosures, roster, versions,
             now: (p) => (p === "millisecond" ? clock.ms : clock.now), ...deps };
  if (create) w.cacc = caseAccountOf(host, w.deps);
  let n = 0;
  Object.assign(w, {
    text: (id) => record.readFile(id, "bundle.md")?.text ?? null,
    member(id, { role = "member" } = {}) {
      st.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                   VALUES (?, ?, ?, ?, 'active', '["contribute","publish"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`, role);
    },
    /** extraction's indexed text of `captureSha` (its R58 read contract), one unit per entry of `units`. */
    indexText(captureSha, bundleId, units = [`the text of ${bundleId}`]) {
      units.forEach((u, i) => st.sql.exec(`INSERT OR REPLACE INTO capture_text (capture_sha, bundle_id, extent_kind, extent,
                   ref, seq, text, truncated, chain_kind) VALUES (?,?,'doc-para',?,?,?,?,0,'text')`,
                  captureSha, bundleId, JSON.stringify({ kind: "doc-para", para: i + 1 }), `paragraph ${i + 1}`, i, u));
    },
    /** A passage (content R45's unit) of `captureSha` in `bundleId`, at the extent of its indexed paragraph `para`. */
    passage(contentId, captureSha, bundleId, para = 1) {
      st.sql.exec(`INSERT INTO content (content_id, capture_sha, bundle_id, extent_kind, extent, ref, minted_by, at)
                   VALUES (?,?,?,'doc-para',?,?,'plane',?)`, contentId, captureSha, bundleId,
                  JSON.stringify({ kind: "doc-para", para }), `paragraph ${para}`, T0);
    },
    /** An information bundle registering one capture, its text indexed; answers the capture's sha. */
    doc(id, text = `bytes of ${id}`, { units } = {}) {
      const c = { path: "snapshots/c0.txt", text, sha: sha(text) };
      const r = promotion.promote({ bundleId: id, base: null, snapKey: `k${++n}`, author: V("alice"),
        files: [{ path: "bundle.md", text: infoMd(id) }, { path: c.path, text: c.text },
                { path: "data/provenance.json", text: JSON.stringify({ documents: [provDoc(c)] }) }],
        meta: { object_type: "information" },
        register: [{ sha256: c.sha, path: c.path, encoding: "utf8", bytes: Buffer.byteLength(c.text) }] });
      if (!r.ok) throw new Error(`fixture doc refused: ${JSON.stringify(r).slice(0, 400)}`);
      w.indexText(c.sha, id, units);
      return c.sha;
    },
    /** An inquiry whose basis is `legs` (each `{target, …leg fields}`), concluded in its own bytes; `claim` adopts a
     *  reading stating it (basis-versions R23: the claim `adopted`), `state` its state (`concluded` by default). */
    finding(id, legs, { claim = null, state = "concluded" } = {}) {
      const head = record.head(id);
      const r = promotion.promote({ bundleId: id, base: head ? head.bundleSha : null, snapKey: `k${++n}`,
        author: V("alice"), files: [{ path: "bundle.md", text: inqMd(id, legs, { claim, state }) }], meta: { object_type: "inquiry" } });
      if (!r.ok) throw new Error(`fixture finding refused: ${JSON.stringify(r).slice(0, 600)}`);
      return r;
    },
    /** A project owned (and so joined) by `owner`, citing `cites`. */
    project(title, owner, cites = []) {
      const r = promotion.promote({ base: null, snapKey: `k${++n}`, author: V(owner), ownerMemberId: owner,
        files: [{ path: "bundle.md", text: projMd(title, cites) }], meta: { object_type: "project" } });
      if (!r.ok) throw new Error(`fixture project refused: ${JSON.stringify(r).slice(0, 400)}`);
      return r.bundleId;
    },
    /** Sets `project`'s scope (project-roster R21) by its owner `by`: `own`, `counsel_matter` or `none`. */
    scope(project, scope, by = "alice") {
      const r = roster.projectScopeSet({ projectId: project, scope, reason: "for the test", by, viewer: V(by) });
      if (!r.ok) throw new Error(`fixture scope refused: ${JSON.stringify(r).slice(0, 400)}`);
      return r;
    },
    join(project, member, state = "joined", owner = 0) {
      st.sql.exec(`INSERT OR REPLACE INTO project_participants (project_id, member_id, state, owner, invited_by, created, updated)
                   VALUES (?, ?, ?, ?, 'alice', 't', 't')`, project, member, state, owner);
    },
    /** A published case of `project` (publication R40's `cases`), as its commit writes the identity. */
    published(caseId, project) {
      st.sql.exec(`INSERT INTO cases (case_id, project_id, opened) VALUES (?,?,?)`, caseId, project, T0);
    },
    /** An unsigned preparation of `caseId`'s `edition` naming `project` (publication R40's `case_documents`), or a
     *  signed one with `signed`. */
    prepared(caseId, project, { edition = 1, signed = false } = {}) {
      const text = ["---", `case_id: ${caseId}`, `case_edition: ${edition}`, `case_project: ${project}`, "---", "",
                    "## Statement", "", "Prepared.", ""].join("\n");
      st.sql.exec(`INSERT INTO case_documents (case_id, edition, doc_sha, text, authored_at, authored_by, sig_armored)
                   VALUES (?,?,?,?,?,?,?)`, caseId, edition, sha(text), text, T0, "alice", signed ? "sig" : null);
    },
  });
  return w;
}

export function infoMd(id) {
  return ["---", `id: ${id}`, "object_type: information", "schema: information@1", `title: "Document ${id}"`,
          "current_state: collected", "prior_state: null", `created: "${T0}"`,
          `last_updated: "${T0}"`, "references: []", "state_history: []", "criticality: supporting",
          "---", "", "## Summary", "", "A document.", ""].join("\n");
}

/** An inquiry document: `legs` its basis (each cited by a confirmed `cites` reference); concluded in its own bytes, its
 *  reading `first` stating `claim` and adopted by the conclusion when `claim` is given (basis-versions R1–R5, R23). */
export function inqMd(id, legs = [], { claim = null, state = "concluded" } = {}) {
  const val = (v) => (typeof v === "number" ? String(v) : `${v}`);
  const refs = [...new Set(legs.map((l) => l.target))];
  return ["---", `id: ${id}`, "object_type: inquiry", "schema: inquiry@1", `title: "Question ${id}"`,
    `current_state: ${state}`, "prior_state: open", `created: "${T0}"`, `last_updated: "${T0}"`, "surfaced_by: human",
    ...(refs.length ? ["references:", ...refs.flatMap((t) => ["  - rel: cites", `    target: ${t}`, "    status: confirmed",
                                                              '    note: ""'])] : ["references: []"]),
    "state_history: []",
    ...(legs.length ? ["basis:", ...legs.flatMap((l) => Object.entries({ role: "supports", ...l })
      .sort(([a], [b]) => (a === "target" ? -1 : b === "target" ? 1 : 0))
      .map(([k, v], i) => `${i ? "    " : "  - "}${k}: ${val(v)}`))] : []),
    `conclusion: "the award followed the minutes"`, `falsifier: "a later amendment"`,
    ...(claim ? [`conclusion_version: "first"`, `conclusion_claim: "${claim}"`, "basis_versions:", `  - name: "first"`,
                 `    description: "the reading called first"`, `    relationship: "and"`, `    state: "accepted"`, "    hidden: false",
                 "    derived_from: null", `    author: "member:alice"`, `    at: "${T0}"`, `    claim: "${claim}"`,
                 `    state_by: "member:alice"`, `    state_at: "${T0}"`, `    state_reason: ""`,
                 "basis_version_grounds:", `  - version: "first"`, `    ground: "main"`, `    asserted_by: "member:alice"`, `    at: "${T0}"`,
                 "basis_version_legs:", ...[...new Set(legs.map((l) => l.target))].flatMap((t) => [`  - version: "first"`,
                   `    target: ${t}`, `    role: "supports"`, `    ground: "main"`])] : []),
    "---", "", "## Question", "", `Was ${id} answered?`, "", "## Session Log", ""].join("\n");
}

export function projMd(title, cites = []) {
  return ["---", "object_type: project", "schema: project@1", `title: "${title}"`, "current_state: forming",
          "prior_state: null", `created: "${T0}"`, `last_updated: "${T0}"`,
          ...(cites.length ? ["references:", ...cites.flatMap((t) => ["  - rel: cites", `    target: ${t}`,
                                                                      "    status: confirmed", '    note: ""'])]
            : ["references: []"]),
          "state_history: []", "---", "", "## Objective", "", "Find out.", "", "## Session Log", ""].join("\n");
}

export function provDoc(c) {
  return {
    file: c.path, locator: `https://example.org/${c.path}`, retrieved: T0,
    authority: "the publisher", authority_state: "determined", authority_basis: "named on the document",
    capture: { method: "acquire", grade: "B", actor_class: "session", sha256: c.sha, encoding: "utf8",
               bytes: Buffer.byteLength(c.text) },
    origin: { kind: "named_request" },
  };
}
