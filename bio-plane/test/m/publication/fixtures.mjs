/* publication's published fixtures (fix round 10, Wave A batch 2; K4990, K4993, K4995, K5044): what a user module's test
   takes in place of publication's answers or publication itself. Each is made by this module's real code, over the real
   modules it uses, each time a test calls one, and is never stored. A user's test names no id of its own: the ids the real
   code minted come back with the answers.

   Not here: `assembleCaseContainer` and the case file's build refusals (`CASE_FILE_NOT_ASSEMBLED`, `MATERIAL_MISSING`,
   `BUCKET_FAILED`) are `public-read`'s (`modules.json` gives `publication/worker.mjs` and `public-read/casefile.mjs` to it),
   so `public-read` publishes them; `caseFileLedger` below is the ledger half, this module's own. */
import assert from "node:assert/strict";
import { planeWorld, NOW, V, sha, SIG } from "./fixture.mjs";

const iso = (ms) => new Date(ms).toISOString();
const must = (r, what) => {
  if (!r || r.ok !== true) throw new Error(`fixture ${what} refused: ${JSON.stringify(r).slice(0, 300)}`);
  return r;
};
const roster = (roles) => roles.map((r) => ({ bundle_id: r.target, version_sha: r.version_sha, role: "load_bearing" }));

/* A world with one member, one project, and `n` cases, each over its own finding resting on its own document; none
   prepared yet. */
function houses(n) {
  const w = planeWorld();
  w.member("olive");
  const project = w.project("Parks", "olive");
  const cases = [];
  for (let i = 1; i <= n; i++) {
    const doc = `INFO-2026-000${i}-minutes`, finding = `INQ-2026-000${i}`;
    w.doc(doc);
    w.inquiry(finding, { legs: [{ target: doc }] });
    cases.push({ case: `CASE-2026-000${i}`, edition: 1, finding, doc, roles: [{ target: finding, version_sha: w.head(finding) }] });
  }
  return { w, project, cases };
}

/* A case edition prepared (R21), committed (R22) and its finding published: the edition is complete. */
function complete(w, project, c, { at = NOW } = {}) {
  must(w.prepare(c.case, c.edition, { project, roles: c.roles }), "prepare");
  must(w.signCase(c.case, c.edition, { project, roster: roster(c.roles), at }), "signCase");
  must(w.signFinding(c.finding, { at }), "signFinding");
  assert.equal(w.p.caseEditionState(c.case, c.edition).complete, true);
}

/** R1, R2 (REC-130): `caseDocumentFacts` as the module answers it for an edition with no document (`NO_CASE_DOCUMENT`), for an
 *  unsigned document read by a viewer with standing in its project and by one without (a stranger gets the absent answer,
 *  the same object), and for the document once signed. */
export function caseDocumentFacts() {
  const { w, project, cases } = houses(1);
  const [c] = cases;
  const owner = V("olive"), stranger = V("nobody");
  const absentCase = "CASE-2026-0404";
  const absent = w.p.caseDocumentFacts(absentCase, 1, owner);
  must(w.prepare(c.case, c.edition, { project, roles: c.roles }), "prepare");
  const unsigned = w.p.caseDocumentFacts(c.case, c.edition, owner);
  const unseen = w.p.caseDocumentFacts(c.case, c.edition, stranger);
  must(w.signCase(c.case, c.edition, { project, roster: roster(c.roles) }), "signCase");
  const signed = w.p.caseDocumentFacts(c.case, c.edition, stranger);
  return { world: w, project, case: c.case, edition: c.edition, absentCase, owner, stranger,
           absent, unsigned, unseen, signed,
           facts: (caseId, edition, viewer) => w.p.caseDocumentFacts(caseId, edition, viewer) };
}

/** R15 (G54): the real ledger of the case file over `editions` complete case editions (the real commit), `record` the
 *  Worker's store-internal hop `recordcasefile`, `owed({now, limit})` and `nextAt()` the one owed rule, `manifest(case, edition, {built})` the
 *  real `recordCaseManifest` (`built: true` records the file built in the same call, K5084). `refusals` are the ledger's own refusals, made by the real writer: a state it does not know
 *  (`MALFORMED`), an edition it does not hold (`NO_SUCH_CASE_EDITION`), and `built` before any manifest is recorded
 *  (`NO_MANIFEST`). The build's own refusals (`MATERIAL_MISSING`, `BUCKET_FAILED`) are `public-read`'s. */
export function caseFileLedger({ editions = 1, at = NOW } = {}) {
  const { w, project, cases } = houses(editions);
  for (const c of cases) complete(w, project, c, { at });
  const record = (a) => w.op("recordcasefile", {}, a);
  const [first] = cases;
  const refusals = {
    malformed: record({ caseId: first.case, edition: 1, state: "bogus", at }),
    noEdition: record({ caseId: "CASE-2026-0404", edition: 1, state: "building", at }),
    noManifest: record({ caseId: first.case, edition: 1, state: "built", at }),
  };
  return {
    world: w, project, cases, record, refusals,
    owed: ({ now, limit } = {}) => w.p.caseFilesOwed({ now: typeof now === "number" ? iso(now) : now, limit }),
    nextAt: () => w.p.caseFileNextAt(),
    manifest: (caseId, edition = 1, { built } = {}) => w.p.recordCaseManifest({ caseId, edition, manifest: { files: [] },
      manifestSha: sha(`manifest ${caseId} ${edition}`), bytes: 5, ...(built === undefined ? {} : { built }) }),
    state: (caseId, edition = 1) => w.row(`SELECT casefile_state AS state, casefile_attempts AS attempts,
      casefile_attempted_at AS at, casefile_why AS why FROM published_cases WHERE case_id=? AND edition=?`, caseId, edition),
  };
}

/** R42: a real publication whose published findings rest on the documents a test names. `rest({finding, docs, project})`
 *  makes the finding's documents, the finding, a case of `project` pinning it, and publishes it with a serve edge to each
 *  document (the real acts of `fixture.mjs`); `captureOf(doc)` is the sha of a document's capture. `publication` is the
 *  real instance on the world's host, so `restingCapturesOf` is its own. */
export function publicationWorld() {
  const w = planeWorld();
  w.member("olive");
  const projects = new Map(), cases = new Map();
  let n = 0;
  const projectOf = (title) => {
    if (!projects.has(title)) projects.set(title, w.project(title, "olive"));
    return projects.get(title);
  };
  const world = {
    world: w, publication: w.p, projects,
    captureOf: (doc) => sha(`the text of ${doc}`),
    rest({ finding, docs = [], project = "Parks" } = {}) {
      const proj = projectOf(project);
      for (const d of docs) if (!w.row(`SELECT 1 AS h FROM register WHERE bundle_id=?`, d)) w.doc(d);
      if (!w.head(finding)) w.inquiry(finding, { legs: docs.map((target) => ({ target })) });
      const roles = [{ target: finding, version_sha: w.head(finding) }];
      const caseId = `CASE-2026-${String(++n).padStart(4, "0")}`;
      must(w.prepare(caseId, 1, { project: proj, roles }), "prepare");
      must(w.signCase(caseId, 1, { project: proj, roster: roster(roles) }), "signCase");
      must(w.signFinding(finding, { sig: SIG(n + 10), edges: docs.map((to) => ({ to, kind: "cites", disclosure: "serve" })) }),
           "signFinding");
      cases.set(caseId, finding);
      return { case: caseId, finding, project: proj, captures: docs.map((d) => world.captureOf(d)) };
    },
  };
  return world;
}

/** R42 (K5094; follow-up 27): what the user holds, made real. `held` is `[{finding, projects, digests}]`: each `finding` a
 *  published finding (the real acts of `fixture.mjs`: its inquiry, a case of each of its `projects` pinning it, its
 *  signature) resting on exactly the captures `digests` names, each a document of the register holding that sha, served
 *  by a `serve` edge of the finding. A digest two findings name is one capture. `restingCapturesOf` answers as the real
 *  module does (pages, cursor, `findings_truncated`), over the project ids named; `publication` is the real instance, so
 *  a user takes `restingOf(held).publication` where it takes publication. */
export function restingOf(held = []) {
  const w = planeWorld();
  w.member("olive");
  const docs = new Map(), seen = new Set();
  let n = 0, c = 0;
  const docOf = (digest) => {
    if (!docs.has(digest)) { const id = `INFO-2026-${String(++n).padStart(4, "0")}-resting`; w.doc(id, { digest }); docs.set(digest, id); }
    return docs.get(digest);
  };
  for (const { finding, projects, digests } of held) {
    if (seen.has(finding)) throw new Error(`fixture restingOf: finding ${finding} named twice`);
    seen.add(finding);
    if (!Array.isArray(projects) || !projects.length) throw new Error(`fixture restingOf: ${finding} names no project`);
    const ids = digests.map(docOf);
    w.inquiry(finding, { legs: ids.map((target) => ({ target })) });
    const roles = [{ target: finding, version_sha: w.head(finding) }];
    for (const project of projects) {
      const caseId = `CASE-2026-${String(++c).padStart(4, "0")}`;
      must(w.prepare(caseId, 1, { project, roles }), "prepare");
      must(w.signCase(caseId, 1, { project, roster: roster(roles) }), "signCase");
    }
    must(w.signFinding(finding, { sig: SIG(c + 10), edges: ids.map((to) => ({ to, kind: "cites", disclosure: "serve" })) }),
         "signFinding");
  }
  return { world: w, publication: w.p, restingCapturesOf: (q) => w.p.restingCapturesOf(q) };
}

/** R62 (docket's `stampEdition`): the module's two refusals of a stamp, made by the real writer: `NO_SUCH_CASE_EDITION` for a
 *  case holding no ratified edition, and `STAMP_NO_ORDER` for a ratified edition when no court-order source confirms the
 *  entry. `stamp` is the call, as docket makes it. */
export function stampEditionRefusal() {
  const { w, project, cases } = houses(1);
  const [c] = cases;
  complete(w, project, c);
  const stamp = (a) => w.p.stampEdition(a);
  return {
    world: w, case: c.case, edition: c.edition, stamp,
    noEdition: stamp({ case: "CASE-2026-0404", editions: [1], entry: 4, effect: "seal" }),
    noOrder: stamp({ case: c.case, editions: [c.edition], entry: 4, effect: "seal" }),
  };
}

/** R21: the real refusal of `storeCaseDocument` for a document that names no case, no edition or no text (`MALFORMED`). */
export function storeCaseDocumentRefusal() {
  const w = planeWorld();
  return {
    world: w,
    refused: w.p.storeCaseDocument({ case: "CASE-2026-0001", edition: 1, text: "", author: V("olive"), at: NOW }),
    store: (a) => w.p.storeCaseDocument(a),
  };
}
