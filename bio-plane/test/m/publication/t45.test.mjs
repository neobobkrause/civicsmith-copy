/* publication — T45 (T45-17; N892, N893; Actions D4, D23, D24; v0.2 rule 15): nothing of a counsel matter is published
   (R78, C-122.8 `COUNSEL_MATTER_NOT_PUBLISHED`), and `case-check` reads R40's tables. A project's scope is
   `project-roster`'s R23 read, a stand-in in the fixture answering `w.scopes` (each ask in `w.scopeAsks`), and the real
   module in one test; `case-carriage`'s refusal reads are driven by stand-ins on the host's one case-carriage, so the
   refusal order is exact. Driven at the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planeWorld as world, infoMd, V, SIG } from "./fixture.mjs";
import { rowOf, CASE_SOURCES_CHECKS } from "../../../src/publication/checks.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import * as publication from "../../../src/publication/index.mjs";
import { caseCarriageOf } from "../../../src/case-carriage/index.mjs";
import { projectRosterOf } from "../../../src/project-roster/index.mjs";

const CASE = "CASE-2026-0001";
const ROW = { code: "COUNSEL_MATTER_NOT_PUBLISHED", check: "C-122.8",
              translation: word("refusal.COUNSEL_MATTER_NOT_PUBLISHED") };

/* A case of `proj` over two member documents, the first committed with `memberProject` (its front matter's `project:`)
   when given; prepared, unsigned. */
function base({ memberProject = null, opts = {} } = {}) {
  const w = world(opts);
  w.member("olive");
  const proj = w.project("Parks", "olive");
  const other = w.project("Counsel", "olive");
  const withProject = (id, pid) => infoMd(id).replace("references: []", `project: ${pid}\nreferences: []`);
  const a = w.promote("INFO-2026-0101-first", memberProject === "other" ? withProject("INFO-2026-0101-first", other)
                                            : infoMd("INFO-2026-0101-first"), "information");
  const b = w.promote("INFO-2026-0102-second", infoMd("INFO-2026-0102-second"), "information");
  assert.equal(a.ok && b.ok, true, JSON.stringify([a, b]));
  const roles = [{ target: "INFO-2026-0101-first", version_sha: a.bundleSha },
                 { target: "INFO-2026-0102-second", version_sha: b.bundleSha }];
  const roster = roles.map((r) => ({ bundle_id: r.target, version_sha: r.version_sha }));
  w.prepare(CASE, 1, { project: proj, roles });
  return { w, proj, other, roles, roster, sign: (o = {}) => w.signCase(CASE, 1, { project: proj, roster, ...o }) };
}

function refused(w, r, { project = null, findings = [] } = {}) {
  assert.deepEqual({ ok: r.ok, reason: r.reason, code: r.code, check: r.check, translation: r.translation, caseId: r.caseId,
                     edition: r.edition, project: r.project, findings: r.findings },
                   { ok: false, reason: ROW.code, ...ROW, caseId: CASE, edition: 1, project, findings });
  assert.match(r.detail, /counsel matter is never published, so nothing was committed/);
}

test("R78 R33 COUNSEL_MATTER_NOT_PUBLISHED is C-122.8, one row in this module's C-122 family raised at the commit, its translation BOB's draft; case-authoring and docket read that same row through this module's export", () => {
  assert.deepEqual(rowOf("COUNSEL_MATTER_NOT_PUBLISHED"), ROW);
  assert.equal(CASE_SOURCES_CHECKS.COUNSEL_MATTER_NOT_PUBLISHED.where,
               "src/publication/index.mjs commitCaseEdition > is-counsel-matter-published");
  assert.equal(Object.values(CASE_SOURCES_CHECKS).filter((x) => x.check === "C-122.8").length, 1, "held once");
  assert.equal(Object.values(CASE_SOURCES_CHECKS).filter((x) => x.check === "C-122.5").length, 0, "C-122.5 stays publish-schedule's");
  /* the export the two other raisers read, holding no copy */
  assert.equal(publication.CASE_SOURCES_CHECKS, CASE_SOURCES_CHECKS);
  assert.deepEqual(publication.publicationRowOf("COUNSEL_MATTER_NOT_PUBLISHED"), ROW);
  /* negative control: a code with no row is no row */
  assert.throws(() => publication.publicationRowOf("COUNSEL_MATTER_NOT_EVIDENCE"), /has no row/);
});

test("R78 a case whose owning project is a counsel matter is refused at the commit, naming the project and no finding, and nothing is committed; the control at scope none commits", () => {
  const { w, proj, sign } = base();
  w.scopes.set(proj, "counsel_matter");
  const before = w.snapshot();
  refused(w, sign(), { project: proj });
  assert.ok(w.scopeAsks.includes(proj), "the scope is project-roster R23's, read at the commit");
  assert.deepEqual(w.snapshot(), before, "nothing is committed");
  /* control: the same commit with the owning project and every member's project at scope none */
  w.scopes.set(proj, "none");
  const r = sign();
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(w.count("published_cases"), 1);
});

test("R78 a member finding committed with another project of scope counsel_matter is refused, naming that finding and never its project; the owning project's scope none does not save it; each project asked once", () => {
  const { w, proj, other, sign } = base({ memberProject: "other" });
  w.scopes.set(other, "counsel_matter");
  const before = w.snapshot();
  const r = sign();
  refused(w, r, { findings: ["INFO-2026-0101-first"] });
  assert.doesNotMatch(JSON.stringify(r), new RegExp(other), "another project is never named");
  assert.deepEqual(w.snapshot(), before, "nothing is committed");
  assert.deepEqual([...new Set(w.scopeAsks)].sort(), [other, proj].sort());
  assert.equal(w.scopeAsks.filter((x) => x === other).length, 1, "asked once per project");
  /* both: the owning project named, and the finding */
  w.scopes.set(proj, "counsel_matter");
  refused(w, sign(), { project: proj, findings: ["INFO-2026-0101-first"] });
  /* an own project, or any scope but counsel_matter, is not refused here */
  w.scopes.set(proj, "none"); w.scopes.set(other, "own");
  assert.equal(sign().ok, true, "control: no counsel matter, committed");
});

test("R78 the counsel matter is refused before every other refusal of the commit's own (R58, R51, R57, R59) and writes nothing; without it, those answer as before", () => {
  const { w, proj, sign } = base();
  const cc = caseCarriageOf(w.host);
  const asked = [];
  cc.sourcesLapsed = () => { asked.push("R51"); return [{ capture: "ab".repeat(32) }]; };
  cc.marksLapsed = () => { asked.push("R57"); return [{ ref: "x", sha: "cd".repeat(32), kind: "document", why: "w" }]; };
  cc.acceptedWorkLapsed = () => { asked.push("R59"); return { withdrawn: [{ ref: "y" }], undisclosed: [] }; };
  w.scopes.set(proj, "counsel_matter");
  const before = w.snapshot();
  refused(w, sign(), { project: proj });
  assert.deepEqual(asked, [], "no later refusal is asked");
  assert.deepEqual(w.snapshot(), before);
  /* control: at scope none the next refusal answers */
  w.scopes.set(proj, "none");
  assert.equal(sign().reason, "SOURCE_CONSENT_WITHDRAWN");
  /* R58: a preparation in a superseded format is refused C-122.2 unless a counsel matter is refused first */
  const old = world();
  old.member("olive");
  const p2 = old.project("Parks", "olive");
  old.prepare(CASE, 1, { project: p2, format: "bio-case-document/5" });
  old.scopes.set(p2, "counsel_matter");
  assert.equal(old.signCase(CASE, 1, { project: p2 }).reason, "COUNSEL_MATTER_NOT_PUBLISHED");
  old.scopes.set(p2, "none");
  assert.equal(old.signCase(CASE, 1, { project: p2 }).reason, "CASE_FORMAT_SUPERSEDED");
});

test("R78 the scope is read at the commit, never earlier, and changes nothing already committed: an edition ratified before its project became a counsel matter stays published and answers forever, its retry answers existed, and a later edition is refused", () => {
  const { w, proj, roles, roster, sign } = base();
  /* prepared while none, made a counsel matter before signing: refused */
  w.scopes.set(proj, "counsel_matter");
  assert.equal(sign().reason, "COUNSEL_MATTER_NOT_PUBLISHED");
  w.scopes.set(proj, "none");
  const first = sign();
  assert.equal(first.ok, true, JSON.stringify(first));
  w.signFinding("INFO-2026-0101-first", { sig: SIG(11) });
  w.signFinding("INFO-2026-0102-second", { sig: SIG(12) });
  const state = w.p.caseEditionState(CASE, 1);
  assert.equal(state.complete, true);
  /* it becomes a counsel matter after: the published edition is untouched */
  w.scopes.set(proj, "counsel_matter");
  const rows = w.snapshot(["cases", "published_cases", "published_case_members", "case_documents", "published_shas"]);
  const retry = sign();
  assert.deepEqual([retry.ok, retry.existed], [true, true], "the same signature answers existed");
  assert.deepEqual(w.snapshot(["cases", "published_cases", "published_case_members", "case_documents", "published_shas"]), rows);
  assert.deepEqual(w.p.caseEditionState(CASE, 1), state, "it answers forever");
  assert.equal(w.p.caseDocument(CASE, 1, null).ok, true, "its signed document answers anybody");
  /* a new edition of it is refused */
  w.prepare(CASE, 2, { project: proj, roles });
  const second = w.signCase(CASE, 2, { project: proj, roster });
  assert.deepEqual([second.reason, second.edition], ["COUNSEL_MATTER_NOT_PUBLISHED", 2]);
  assert.equal(w.row(`SELECT COUNT(*) AS n FROM published_cases WHERE edition=2`).n, 0);
});

test("R78 by default the scope is the real project-roster's on this host: a counsel matter set through its R21 refuses the commit, and removing it lets the commit through", () => {
  const { w, proj, sign } = base({ opts: { realRoster: true } });
  assert.equal(w.p.roster, projectRosterOf(w.host), "the host's one project-roster");
  w.p.roster.migrate();   /* its tables, as the host's boot makes them */
  const set = (scope) => w.p.roster.projectScopeSet({ projectId: proj, scope, reason: "a dispute with counsel", by: "olive",
                                                       viewer: V("olive") });
  const r = set("counsel_matter");
  assert.equal(r.ok, true, JSON.stringify(r));
  refused(w, sign(), { project: proj });
  assert.equal(w.count("published_cases"), 0);
  assert.equal(set("none").ok, true);
  assert.equal(sign().ok, true, "control: scope none commits");
});

test("R40 (T45) case-check reads cases, published_cases, published_case_members and case_documents in its own SQL: a replaced preparation moves case_documents.doc_sha, and an edition reads published in published_cases once ratified", () => {
  const { w, proj, roles, roster, sign } = base();
  const doc = () => w.row(`SELECT doc_sha, sig_armored FROM case_documents WHERE case_id=? AND edition=1`, CASE);
  const held = doc().doc_sha;
  /* the preparation replaced (R21) voids a check pinned to its doc_sha */
  w.prepare(CASE, 1, { project: proj, roles, excludes: "Something else." });
  assert.notEqual(doc().doc_sha, held, "document_replaced reads a moved doc_sha");
  assert.equal(doc().sig_armored, null);
  /* committed and every member published: published_cases' ratified_at is set, with the owning project and the pins */
  assert.equal(sign().ok, true);
  const ratified = () => w.row(`SELECT c.ratified_at, k.project_id FROM published_cases c JOIN cases k ON k.case_id=c.case_id
                                 WHERE c.case_id=? AND c.edition=1`, CASE);
  assert.equal(ratified().ratified_at, null, "not ratified until every member is published");
  w.signFinding("INFO-2026-0101-first", { sig: SIG(11) });
  w.signFinding("INFO-2026-0102-second", { sig: SIG(12) });
  assert.deepEqual(ratified(), { ratified_at: w.p.caseEditionState(CASE, 1).ratified_at, project_id: proj });
  assert.ok(ratified().ratified_at);
  assert.deepEqual(w.rows(`SELECT bundle_id, version_sha, role FROM published_case_members WHERE case_id=? AND edition=1
                           ORDER BY ord`, CASE),
                   roster.map((m) => ({ bundle_id: m.bundle_id, version_sha: m.version_sha, role: null })));
});
