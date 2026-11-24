/* publication — T37 (T37-18): each criteria row's `captures`, only the captures holding its passages that the edition
   carries (R72; N763, K2140), and the commit's refusal of a photo marked since the case was prepared (R57's
   `PHOTO_MARKS_CHANGED_SINCE`, R33's C-122.6; N757, DEC-180 (4), K2206). `standards` and `entities` are stand-ins as in
   `t35.test.mjs`; a passage's capture is a row of `content`'s read contract (its R45), written as content mints it.
   `case-carriage.marksLapsed` (its R13) is driven by a stand-in on the host's one case-carriage, answering exactly its
   shape (`[{ref, sha, why}]`), so each lapse is exact; case-carriage's own tests judge when a photo's marks lapse.
   Driven at the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planeWorld as world, infoMd, V, NOW, absentStandard } from "./fixture.mjs";
import { rowOf, CASE_SOURCES_CHECKS } from "../../../src/publication/checks.mjs";
import { caseCarriageOf } from "../../../src/case-carriage/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";

const CASE = "CASE-2026-0001";
const A = "STD-2026-0001-policy", B = "STD-2026-0002-standard", GONE = "STD-2026-0003-ordinance";
const CLERK = "ENT-2026-0001";
const c = (n) => String(n).repeat(32);
const C1 = c("a1"), C2 = c("b2"), C3 = c("c3"), C4 = c("d4"), C5 = c("e5");
const CAP1 = c("11"), CAP2 = c("22"), CAP4 = c("44"), CAP5 = c("55");

/* A, a free policy whose text holds C1–C3; B, a paywalled standard whose text holds C4 and C5, its `requires` C4. */
function standardsOf() {
  const table = {
    [A]: { access: "free", texts: [C1, C2, C3], requires: [C1] },
    [B]: { access: "paywalled", texts: [C4, C5], requires: [C4] },
  };
  return {
    table,
    standardRead({ id }) {
      const s = table[id];
      if (!s) return absentStandard(id);
      return { ok: true, id, cite: id, kind: "policy", issuer: "X", designation: id, edition: "1", access: s.access,
               owner: { issuer: "X", label: "X" }, requires: s.requires,
               texts: s.texts.map((t) => ({ content_id: t, standing: null, newer: null })),
               requires_quoted: s.requires.map((t) => ({ content_id: t, text: null })), says: {} };
    },
    bindsAt: ({ standard, body, date }) => ({ ok: true, standard, body, date, state: "benchmark", why: "", rests_on: [] }),
  };
}
const entitiesOf = () => ({ readEntity: ({ entityId }) => ({ ok: true, found: true, entity: { entity_id: entityId, label: "City Clerk" } }) });

function member(w, id, { subject = null, legs = [] } = {}) {
  const lines = [...(subject ? [`subject_entity: ${subject}`] : []), "basis:",
    ...legs.flatMap((l) => [`  - target: ${l.target}`, "    role: supports", ...(l.content ? [`    content_id: ${l.content}`] : [])])];
  const r = w.promote(id, infoMd(id).replace("references: []", [...lines, "references: []"].join("\n")), "information");
  assert.equal(r.ok, true, JSON.stringify(r));
  return { target: id, version_sha: r.bundleSha };
}
/* A passage's content row, as content mints it (its R45's columns). */
const mint = (w, contentId, captureSha) => w.st.sql.exec(
  `INSERT INTO content (content_id,capture_sha,bundle_id,extent_kind,extent,ref,minted_by,at) VALUES (?,?,?,?,?,?,?,?)`,
  contentId, captureSha, "INFO-2026-0001-minutes", "document", "{}", "whole", "olive", NOW);
/* A `materials:` row (case-grammar R12) for a capture, carried whole or by its fingerprint only. */
const material = (sha, included) => ({ ref: `INFO-2026-0001-minutes`, kind: "document", sha, text_sha: null, origin: null,
                                       archived_copy: null, included, rests_under: "load_bearing" });

function base() {
  const w = world({ standards: standardsOf(), entities: entitiesOf() });
  w.member("olive");
  const proj = w.project("Parks", "olive");
  w.doc("INFO-2026-0001-minutes");
  for (const [cid, cap] of [[C1, CAP1], [C2, CAP2], [C3, CAP1], [C4, CAP4], [C5, CAP5]]) mint(w, cid, cap);
  const roles = [
    member(w, "INFO-2026-0101-first", { subject: CLERK, legs: [
      { target: A, content: C1 }, { target: A, content: C2 }, { target: A, content: C3 },   /* C1 and C3: one capture, once */
      { target: B }] }),                                                                   /* B's requires: C4 */
    member(w, "INFO-2026-0102-second", { legs: [{ target: GONE }] }),                      /* not held */
  ];
  return { w, proj, roles };
}
const sign = (w, proj, roles, caseId, materials, edition = 1) => {
  w.prepare(caseId, edition, { project: proj, roles, materials });
  return w.signCase(caseId, edition, { project: proj, roster: roles.map((r) => ({ bundle_id: r.target, version_sha: r.version_sha })) });
};
const capturesOf = (w, caseId, edition = 1) => w.p.caseEditionState(caseId, edition).criteria.map((r) => [r.standard, r.captures]);

/* ---------------------------------------------------------------- R72's captures */

test("R72 (T37) each criteria row freezes `captures`: the captures holding its passages that the edition's materials: block lists included: true, each once in the order first met; a non-free standard's capture the edition does not carry is never stated, nor any withheld capture's digest; a row stated not held carries captures null", () => {
  const { w, proj, roles } = base();
  /* CAP1 carried whole; CAP2 and B's capture CAP4 listed by fingerprint only (included: false); CAP5 relied on by no row */
  const r = sign(w, proj, roles, CASE, [material(CAP1, true), material(CAP2, false), material(CAP4, false), material(CAP5, true)]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(capturesOf(w, CASE), [[A, [CAP1]], [B, []], [GONE, null]]);
  const stored = w.row(`SELECT criteria FROM published_cases WHERE case_id=? AND edition=1`, CASE).criteria;
  for (const withheld of [CAP2, CAP4]) assert.ok(!stored.includes(withheld), `${withheld} is never stated`);
  assert.ok(!stored.includes(CAP5), "a carried capture no row's passage rests on is no row's");
  /* every capture carried: in the order the passages first meet them, CAP1 once though C1 and C3 both rest on it */
  const r2 = sign(w, proj, roles, "CASE-2026-0002", [material(CAP4, true), material(CAP2, true), material(CAP1, true)]);
  assert.equal(r2.ok, true, JSON.stringify(r2));
  assert.deepEqual(capturesOf(w, "CASE-2026-0002"), [[A, [CAP1, CAP2]], [B, [CAP4]], [GONE, null]]);
  /* frozen with the edition: a later content row or standard reaches it only through a later edition */
  mint(w, c("f6"), c("66"));
  w.p.migrate();
  assert.deepEqual(capturesOf(w, CASE), [[A, [CAP1]], [B, []], [GONE, null]]);
  /* an edition carrying nothing states no capture at all */
  const r3 = sign(w, proj, roles, "CASE-2026-0003", []);
  assert.equal(r3.ok, true);
  assert.deepEqual(capturesOf(w, "CASE-2026-0003"), [[A, []], [B, []], [GONE, null]]);
});

test("R72 (T37) the commit's rows are R75's rows for the same members with `captures` beside them; criteriaFor itself states no captures; an edition frozen before T37 answers its rows as frozen, without captures, never filled", () => {
  const { w, proj, roles } = base();
  const pre = w.p.criteriaFor({ members: roles.map((r) => ({ bundle_id: r.target, version_sha: r.version_sha })), signer: "olive", at: NOW });
  assert.ok(pre.rows.every((r) => !("captures" in r)));
  assert.equal(sign(w, proj, roles, CASE, [material(CAP1, true)]).ok, true);
  const rows = w.p.caseEditionState(CASE, 1).criteria;
  assert.deepEqual(rows.map(({ captures, ...rest }) => rest), pre.rows);
  /* a row frozen before T37 (as T35's commit wrote it) is answered exactly as frozen */
  w.prepare(CASE, 2, { project: proj, roles });
  w.signLegacy(CASE, 2, { project: proj, roster: roles.map((r) => ({ bundle_id: r.target, version_sha: r.version_sha })) });
  const frozen = pre.rows;
  w.st.sql.exec(`UPDATE published_cases SET criteria=? WHERE case_id=? AND edition=2`, JSON.stringify(frozen), CASE);
  assert.deepEqual(w.p.caseEditionState(CASE, 2).criteria, frozen);
  w.p.migrate();
  assert.ok(w.p.caseEditionState(CASE, 2).criteria.every((r) => !("captures" in r)), "never filled");
});

test("R72 (T37) an unreadable content table states no capture and never refuses the commit", () => {
  const { w, proj, roles } = base();
  w.st.db.exec(`ALTER TABLE content RENAME TO content_gone`);
  const r = sign(w, proj, roles, CASE, [material(CAP1, true)]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(capturesOf(w, CASE), [[A, []], [B, []], [GONE, null]]);
});

/* ---------------------------------------------------------------- R57's refusal, R33's C-122.6 */

const LAPSED = [{ ref: "INFO-2026-0001-minutes", sha: CAP1, why: "marked since the case was prepared" }];

/* Its translation is `words.json`'s `photo.refused.changed.signed` since T41 (DEC-187 (4); was `photo.refused.changed`, T38): `t38.test.mjs` checks it. */
test("R33 C-122.6 PHOTO_MARKS_CHANGED_SINCE is held in this module's C-122 family", () => {
  const row = rowOf("PHOTO_MARKS_CHANGED_SINCE");
  assert.deepEqual({ code: row.code, check: row.check }, { code: "PHOTO_MARKS_CHANGED_SINCE", check: "C-122.6" });
  assert.equal(CASE_SOURCES_CHECKS.PHOTO_MARKS_CHANGED_SINCE.where,
               "src/publication/index.mjs commitCaseEdition > is-photo-marks-current");
  assert.equal(Object.values(CASE_SOURCES_CHECKS).filter((x) => x.check === "C-122.6").length, 1, "held once");
});

test("R57 (T37) R33 a photo marked after preparation refuses the commit PHOTO_MARKS_CHANGED_SINCE (C-122.6), naming each row case-carriage's marksLapsed answers (at most 200), and nothing is committed; asked of the document's front matter; none lapsed commits", () => {
  const { w, proj, roles } = base();
  const asked = [];
  const cc = caseCarriageOf(w.host);
  cc.marksLapsed = (fm) => { asked.push(fm); return LAPSED; };
  w.prepare(CASE, 1, { project: proj, roles, materials: [material(CAP1, true)] });
  const before = w.snapshot();
  const roster = roles.map((r) => ({ bundle_id: r.target, version_sha: r.version_sha }));
  const r = w.signCase(CASE, 1, { project: proj, roster });
  assert.deepEqual({ ok: r.ok, reason: r.reason, code: r.code, check: r.check, translation: r.translation, caseId: r.caseId,
                     edition: r.edition, photos: r.photos },
                   { ok: false, reason: "PHOTO_MARKS_CHANGED_SINCE", ...rowOf("PHOTO_MARKS_CHANGED_SINCE"), caseId: CASE,
                     edition: 1, photos: LAPSED });
  assert.match(r.detail, /Prepare the case again/);
  assert.deepEqual(w.snapshot(), before, "nothing is committed");
  assert.equal(asked.length, 1);
  assert.deepEqual(asked[0], parseFrontmatter(w.row(`SELECT text FROM case_documents WHERE case_id=?`, CASE).text).data,
                   "the document's front matter");
  /* at most 200 named */
  cc.marksLapsed = () => Array.from({ length: 250 }, (_, i) => ({ ref: `R${i}`, sha: CAP1, why: "x" }));
  const many = w.signCase(CASE, 1, { project: proj, roster });
  assert.equal(many.photos.length, 200);
  assert.deepEqual(w.snapshot(), before);
  /* none lapsed: the commit proceeds */
  cc.marksLapsed = () => [];
  assert.equal(w.signCase(CASE, 1, { project: proj, roster }).ok, true);
});

test("R57 (T37) the marks are read after R51 and before R59: a withdrawn consent is refused first, and a lapsed mark before another group's withdrawn acceptance", () => {
  const { w, proj, roles } = base();
  const cc = caseCarriageOf(w.host);
  const order = [];
  cc.sourcesLapsed = () => { order.push("R51"); return [{ capture: CAP1 }]; };
  cc.marksLapsed = () => { order.push("R57"); return LAPSED; };
  cc.acceptedWorkLapsed = () => { order.push("R59"); return { withdrawn: [{ ref: "x" }], undisclosed: [] }; };
  w.prepare(CASE, 1, { project: proj, roles });
  const roster = roles.map((r) => ({ bundle_id: r.target, version_sha: r.version_sha }));
  assert.equal(w.signCase(CASE, 1, { project: proj, roster }).reason, "SOURCE_CONSENT_WITHDRAWN");
  assert.deepEqual(order, ["R51"]);
  cc.sourcesLapsed = () => { order.push("R51"); return []; };
  order.length = 0;
  assert.equal(w.signCase(CASE, 1, { project: proj, roster }).reason, "PHOTO_MARKS_CHANGED_SINCE");
  assert.deepEqual(order, ["R51", "R57"]);
  cc.marksLapsed = () => { order.push("R57"); return []; };
  order.length = 0;
  assert.equal(w.signCase(CASE, 1, { project: proj, roster }).reason, "ACCEPTANCE_WITHDRAWN_SINCE");
  assert.deepEqual(order, ["R51", "R57", "R59"]);
  assert.equal(w.count("published_cases"), 0);
});

test("R72 (T37) a row of many passages states every carried capture in one read, over storage shaped as workerd's (which refuses a statement binding about 100 variables)", () => {
  const { w, proj } = base();
  const many = Array.from({ length: 150 }, (_, i) => "7" + (i + 1).toString(16).padStart(63, "0"));
  const caps = many.map((x) => x.replace(/^7/, "8"));
  many.forEach((cid, i) => mint(w, cid, caps[i]));
  w.p.standards.table[A].texts = [...w.p.standards.table[A].texts, ...many];
  w.p.standards.table[A].requires = many;
  const roles = [member(w, "INFO-2026-0105-many", { subject: CLERK, legs: [{ target: A }] })];
  w.prepare(CASE, 1, { project: proj, roles, materials: caps.map((x) => material(x, true)) });
  /* workerd's limit, which this fixture's storage does not hold: a statement binding over 100 variables is refused */
  const exec = w.st.sql.exec;
  w.st.sql.exec = (q, ...a) => { if (a.length > 100) throw new Error("too many SQL variables"); return exec(q, ...a); };
  const r = w.signCase(CASE, 1, { project: proj, roster: roles.map((x) => ({ bundle_id: x.target, version_sha: x.version_sha })) });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(capturesOf(w, CASE), [[A, caps]]);
});

test("R57 (T37) a marks answer that is not a list is read as marks that cannot be read: the commit is refused, nothing committed (fail closed)", () => {
  const { w, proj, roles } = base();
  caseCarriageOf(w.host).marksLapsed = () => null;
  w.prepare(CASE, 1, { project: proj, roles });
  const before = w.snapshot();
  const r = w.signCase(CASE, 1, { project: proj, roster: roles.map((x) => ({ bundle_id: x.target, version_sha: x.version_sha })) });
  assert.equal(r.reason, "PHOTO_MARKS_CHANGED_SINCE");
  assert.equal(r.photos.length, 1);
  assert.deepEqual(w.snapshot(), before);
});

test("R57 (T37; K2226) a publication built with the evidence bucket and the store's namespace hands both to the case-carriage it creates, so case-carriage can hold an obscured copy (its R11); built without them, none is handed", () => {
  const bucket = { put: async () => ({}), get: async () => null, head: async () => null };
  const w = world({ carriage: { bucket, store: "bio-test" } });
  const cc = caseCarriageOf(w.host);
  assert.equal(cc.bucket, bucket);
  assert.equal(cc.store, "bio-test");
  assert.equal(w.p.caseCarriage, cc, "the one case-carriage of the host");
  const bare = world();
  assert.equal(caseCarriageOf(bare.host).bucket, null);
});
