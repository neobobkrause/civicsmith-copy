/* connections: the connections share of three old suites, converted to module tests at this module's interface.
   - content-reads.test.mjs: a `document` row is reached by every connection of its capture (R7, R10), and the portion
     axis of a row whose document is an end of no connection (R10, R11, R13, R52: NO_CONNECTION, empty_level, why,
     never none, the document's own resolution never borrowed).
   - d280-strengthbar.test.mjs: R22's predicate over real severed references in several citing documents, ordered, and
     R23's `citedBy` (the routing past a withdrawn first citer is tasks R1's; here, the citer list it reads).
   - d216-sharing.probe.mjs: the refs projection (R19, R58) — the edges a promotion writes, the +2 delta of two
     citers of one target, and a severance that keeps the row. Its source-text arms are dropped. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, projMd, V, MACHINE } from "./fixture.mjs";
import { localize, word } from "../../../src/setup-words/index.mjs";

const A = "INFO-2026-0001-a", B = "INFO-2026-0002-b", C = "INFO-2026-0003-c", D = "INFO-2026-0004-d";
const E1 = "ENT-2026-0001", E2 = "ENT-2026-0002";

/* A project's bundle.md carrying `refs` as written: `status` undefined writes no `status:` key at all; any other value
   is written verbatim after `status: ` (so a quoted value keeps its quotes). */
function refLines(refs) {
  if (!refs.length) return "references: []";
  return ["references:", ...refs.flatMap((r) => [`  - rel: ${r.rel || "cites"}`, `    target: ${r.target}`,
    ...(r.status === undefined ? [] : [`    status: ${r.status}`])])].join("\n");
}
/* A project minted citing nothing, and a revision of it carrying `refs` through the real promotion. */
function citer(w, title) { return w.project(title, "alice"); }
let snap = 0;
function reviseProject(w, id, title, refs) {
  const head = w.record.head(id);
  const r = w.promotion.promote({ bundleId: id, base: head.bundleSha, snapKey: `cv${++snap}`, author: "member:alice",
    files: [{ path: "bundle.md", text: projMd(title).replace("references: []", refLines(refs)) }],
    meta: { object_type: "project" } });
  assert.equal(r.ok, true, `revise ${title}: ${JSON.stringify(r).slice(0, 300)}`);
}

/* ============================================================== content-reads: the document row, the portion axis */

test("R7, R10, R13, R52 (converts content-reads): a document-extent row is reached by EVERY connection of its capture, whatever each pair's position, and grades the strongest", () => {
  const w = world();
  w.entity(E1); w.entity(E2);
  const [a] = w.doc(A, ["alpha"]);
  const [b] = w.doc(B, ["beta"]);
  const [c] = w.doc(C, ["gamma"]);
  const [d] = w.doc(D, ["delta"]);
  /* A's E1 mention read on page 3 (placed); its E2 mention never read (unplaced). */
  w.resolve(a, A, "Ord. 1", E1, "B"); w.read(a, A, "Ord. 1", [2]);
  w.resolve(a, A, "Res. 9", E2, "A");
  w.resolve(b, B, "Ord. 1", E1, "A"); w.read(b, B, "Ord. 1", [null]);
  w.resolve(c, C, "Ord. 1", E1, "C"); w.read(c, C, "Ord. 1", [0]);
  w.resolve(d, D, "Res. 9", E2, "D");
  w.k.derive({ entityId: E1 }); w.k.derive({ entityId: E2 });
  /* The capture is an end of three connections (a–b B, a–c C, a–d D); b–c is not A's. One loses its pair (derived
     before pairs were kept): a whole-document citation is reached by it all the same. */
  w.st.sql.exec(`UPDATE connections SET a_ref=NULL, b_ref=NULL WHERE entity_id=?`, E2);
  const doc = w.mint(A, a, { kind: "document" });
  const g = w.k.portionGrade({ contentId: doc, viewer: MACHINE });
  assert.equal(g.ok, true); assert.equal(g.extent_kind, "document");
  assert.equal(g.reaching.length, 3);
  assert.deepEqual(g.undetermined, []); assert.deepEqual(g.outside, []);
  assert.deepEqual(g.counts, { connections: 3, reaching: 3, undetermined: 0, outside: 0 });
  assert.deepEqual(g.reaching.map((r) => [r.entity_id, r.grade, r.other_capture_sha]).sort(),
    [[E1, "B", b], [E1, "C", c], [E2, "D", d]].sort());
  assert.deepEqual(g.reaching.map((r) => r.other_bundle_id).sort(), [B, C, D]);
  for (const r of g.reaching) {
    assert.equal(r.why, word("connections.why.citation_whole_document"));
    assert.equal("code" in r, false, "a whole-document reach carries no C-49 verdict");
  }
  assert.equal(g.connection_grade, "B", "the strongest reaching grade");
  assert.equal(g.established, true); assert.equal(g.needs_confirmation, false);
  assert.equal(g.why, localize("connections.index.connection_established_reference", "{reaching} connection(s) were established by a reference read inside {ref}; the grade is the strongest of them ({grade}), which states how that connection was established and nothing about how credible either document is", { reaching: "3", ref: g.why.match(/read inside (.+?); the grade/)[1], grade: "B" }));
  assert.equal(g.truncated, false);
  /* Bounded like every read: the first `limit` by grade, truncated measured by one more. */
  const two = w.k.portionGrade({ contentId: doc, limit: 2, viewer: MACHINE });
  assert.deepEqual(two.reaching.map((r) => r.grade), ["B", "C"]); assert.equal(two.truncated, true);
  /* The contrast that makes "every" mean something: a page of the same capture is not reached by them all. */
  const p7 = w.k.portionGrade({ contentId: w.mint(A, a, { kind: "pdf-page", page: 7 }), viewer: MACHINE });
  assert.equal(p7.connection_grade, null); assert.equal(p7.reaching.length, 0);
  /* R13, R52: the set read and the registry's axis answer the same for the document row, narrowed per subject. */
  assert.equal(w.k.portionGrades([doc], V("x"))[doc].grade, "B");
  assert.deepEqual(w.k.portionAxes([doc])[doc],
    { determined: true, grain: "portion", mode: "value", grade: "B", established: true, why: g.why });
  const e2 = w.k.portionAxes([doc], { entityId: E2 })[doc];
  assert.deepEqual({ ...e2, why: 0 }, { determined: true, grain: "portion", mode: "value", grade: "D", established: false, why: 0 });
  assert.equal(w.k.portionGrades([doc], V("x"), { entityId: E2 })[doc].counts.connections, 1);
});

test("R10, R11, R13, R52 (converts content-reads): a document that is an end of no connection — its own A resolution is never borrowed; every row's axis is NO_CONNECTION with its empty level and a why naming the row, never none", () => {
  const w = world();
  w.entity(E1, "Sewer Fund Transfer Ordinance");
  const [a] = w.doc(A, ["the paged document"]);
  /* One document, one subject, resolved at A and read on page 2: a resolution, not a connection. */
  w.resolve(a, A, "ordinance:24680", E1, "A"); w.read(a, A, "ordinance:24680", [1]);
  assert.equal(w.k.derive({ entityId: E1 }).count, 0);
  const rows = { doc: w.mint(A, a, { kind: "document" }), p2: w.mint(A, a, { kind: "pdf-page", page: 1 }),
                 p1: w.mint(A, a, { kind: "pdf-page", page: 0 }) };
  const ids = Object.values(rows);
  const axes = w.k.portionAxes(ids, { entityId: E1 });
  const plain = w.k.portionAxes(ids);
  const sets = w.k.portionGrades(ids, V("x"), { entityId: E1 });
  assert.deepEqual(Object.keys(axes).sort(), [...ids].sort());
  for (const id of ids) {
    const one = w.k.portionGrade({ contentId: id, viewer: V("x") });
    const why = word("connections.document_end_connection", { ref: String(one.ref) });
    /* The whole axis, key for key: no grade, no document grade, the level that is empty named. */
    assert.deepEqual(axes[id], { determined: false, grain: "portion", grade: null, undetermined_because: "NO_CONNECTION",
      empty_level: localize("connections.index.empty_level_no_connection", "connection — this document is an end of no connection through this subject"), why });
    assert.deepEqual(plain[id], axes[id], "narrowing to the subject changes nothing here");
    assert.equal(one.connection_grade, null, "R11: the resolution's A is not a connection grade");
    assert.equal(one.established, false); assert.equal(one.needs_confirmation, false);
    assert.equal(one.why, why);
    assert.deepEqual(one.counts, { connections: 0, reaching: 0, undetermined: 0, outside: 0 });
    assert.deepEqual(sets[id], { grade: null, established: false, needs_confirmation: false, counts: one.counts, why });
  }
  /* Structural: no row anywhere in the answer carries a grade or reads as determined, and none is "none". */
  assert.equal(Object.values(axes).filter((x) => x.grade !== null || x.determined !== false).length, 0);
  assert.equal(JSON.stringify(axes).includes("document_grade"), false);
  assert.equal(JSON.stringify(axes).includes(A), false, "the registry's axis names no bundle id");
  /* A second document about the subject makes the capture an end of one connection: the page where the mention is
     read now earns it; the other page is outside and the empty level says so; an unplaced end is undetermined. */
  const [b] = w.doc(B, ["the other"]);
  w.resolve(b, B, "Ord. 24680", E1, "A"); w.read(b, B, "Ord. 24680", [null]);
  w.k.derive({ entityId: E1 });
  const bRow = w.mint(B, b, { kind: "pdf-page", page: 0 });
  const after = w.k.portionAxes([...ids, bRow], { entityId: E1 });
  assert.deepEqual({ ...after[rows.p2], why: 0 },
    { determined: true, grain: "portion", mode: "value", grade: "A", established: true, why: 0 });
  assert.equal(after[rows.doc].grade, "A");
  assert.equal(after[rows.p1].undetermined_because, "CONNECTION_OUTSIDE_PORTION");
  assert.equal(after[rows.p1].empty_level, localize("connections.index.empty_level_outside", "connection — every connection of this document was established outside this portion"));
  assert.equal(after[bRow].undetermined_because, "CONNECTION_PORTION_UNDETERMINED");
  assert.equal(after[bRow].empty_level, localize("connections.index.empty_level_where_read", "where in the document the determining reference was read, or which mention is on point"));
  for (const id of [rows.p1, bRow]) {
    assert.equal(after[id].grade, null); assert.equal(after[id].determined, false);
    assert.equal(after[id].why, w.k.portionGrade({ contentId: id, viewer: V("x") }).why);
  }
});

/* ============================================================== d280-strengthbar: R22 and R23 over real severances */

test("R22, R23 (converts d280-strengthbar): citesInto over real severed references in several citing documents — only the exact recorded `severed` withdraws, sorted; citedBy is the confirmed list, a withdrawn first citer skipped", () => {
  const w = world();
  w.doc(A, ["the subject"]);
  /* Seven citers, minted citing nothing and ordered by their minted ids, then revised to carry their references. */
  const ids = ["one", "two", "three", "four", "five", "six", "seven"].map((n) => ({ n, id: citer(w, `Citer ${n}`) }))
    .sort((x, y) => (x.id < y.id ? -1 : 1));
  const [gone, live, noStatus, capital, padded, otherRel, relOnly] = ids;
  reviseProject(w, gone.id, `Citer ${gone.n}`, [{ target: A, status: "severed" }]);
  reviseProject(w, live.id, `Citer ${live.n}`, [{ target: A, status: "confirmed" }]);
  reviseProject(w, noStatus.id, `Citer ${noStatus.n}`, [{ target: A }]);
  reviseProject(w, capital.id, `Citer ${capital.n}`, [{ target: A, status: "Severed" }]);
  reviseProject(w, padded.id, `Citer ${padded.n}`, [{ target: A, status: '"severed "' }]);
  reviseProject(w, otherRel.id, `Citer ${otherRel.n}`,
    [{ target: A, rel: "relates_to", status: "severed" }, { target: A, rel: "cites", status: "confirmed" }]);
  reviseProject(w, relOnly.id, `Citer ${relOnly.n}`, [{ target: A, rel: "relates_to", status: "severed" }]);
  /* An information document citing too: the partition is over every citing bundle, whatever its type. */
  w.doc(B, ["b"], { references: [{ rel: "cites", target: A }] });
  assert.ok(gone.id < live.id, "fixture guard: the withdrawn citer sorts first");
  /* The withdrawal is really in the citing document, and the edge is still an edge (R19). */
  assert.match(w.record.readFile(gone.id, "bundle.md").text, /target: INFO-2026-0001-a\n    status: severed/);
  assert.equal(w.row(`SELECT COUNT(*) AS n FROM refs WHERE target_id=? AND kind='cites'`, A).n, 7);
  const liveCiters = [B, live.id, noStatus.id, capital.id, padded.id, otherRel.id].sort();
  assert.deepEqual(w.k.citesInto(A), { confirmed: liveCiters, severed: [gone.id] });
  /* R22 per citer: true only on the exact recorded word; no key, another spelling or padding is live. */
  assert.equal(w.k.edgeSevered(gone.id, A, "cites"), true);
  for (const x of [live, noStatus, capital, padded, otherRel]) assert.equal(w.k.edgeSevered(x.id, A, "cites"), false, x.n);
  assert.equal(w.k.edgeSevered(otherRel.id, A, "relates_to"), true, "a severed relates_to is not a severed citation");
  assert.equal(w.k.edgeSevered(relOnly.id, A, "cites"), false, "no cites entry: live");
  assert.equal(w.k.edgeSevered(relOnly.id, A, "relates_to"), true);
  assert.equal(w.k.citesInto(A).confirmed.includes(relOnly.id) || w.k.citesInto(A).severed.includes(relOnly.id), false,
    "a relates_to edge is no cites edge");
  /* R23: the fact promotion reads is the confirmed list, in order; the first live citer is past the withdrawn one. */
  assert.deepEqual(w.k.citedBy(A), liveCiters);
  assert.deepEqual(w.promotion.fact("citedBy", A), { ok: true, fact: "citedBy", value: liveCiters });
  const firstProject = w.k.citedBy(A).find((id) => id.startsWith("PROJ-"));
  assert.equal(firstProject, live.id); assert.notEqual(firstProject, gone.id);
});

test("R22, R23 (converts d280-strengthbar): a severance is a revision of the citing document — it moves the citer between the lists and back, the edge kept throughout", () => {
  const w = world();
  w.doc(A, ["the subject"]);
  /* Each project keeps its own title (a revision under another project's name is NAME_TAKEN); lo and hi are by id. */
  const titled = [[citer(w, "Router a"), "Router a"], [citer(w, "Router b"), "Router b"]].sort((x, y) => (x[0] < y[0] ? -1 : 1));
  const [[lo, tLo], [hi, tHi]] = titled;
  reviseProject(w, lo, tLo, [{ target: A, status: "severed" }]);
  reviseProject(w, hi, tHi, [{ target: A, status: "confirmed" }]);
  assert.deepEqual(w.k.citesInto(A), { confirmed: [hi], severed: [lo] });
  assert.deepEqual(w.promotion.fact("citedBy", A).value, [hi]);
  /* The live citer withdraws too: nobody is confirmed, both edges stay. */
  reviseProject(w, hi, tHi, [{ target: A, status: "severed" }]);
  assert.deepEqual(w.k.citesInto(A), { confirmed: [], severed: [lo, hi] });
  assert.deepEqual(w.k.citedBy(A), []);
  assert.deepEqual(w.promotion.fact("citedBy", A), { ok: true, fact: "citedBy", value: [] });
  assert.deepEqual(w.rows(`SELECT bundle_id FROM refs WHERE target_id=? AND kind='cites' ORDER BY bundle_id`, A).map((r) => r.bundle_id),
    [lo, hi]);
  /* The first withdrawer reinstates: it is confirmed again, first by id. */
  reviseProject(w, lo, tLo, [{ target: A, status: "confirmed" }]);
  assert.deepEqual(w.k.citesInto(A), { confirmed: [lo], severed: [hi] });
  assert.deepEqual(w.k.citedBy(A), [lo]);
  /* Dropping the reference drops the edge from both lists (R19 replaces the bundle's edges). */
  reviseProject(w, hi, tHi, []);
  assert.deepEqual(w.k.citesInto(A), { confirmed: [lo], severed: [] });
});

/* ============================================================== d216-sharing: the refs projection */

test("R19, R58 (converts d216-sharing): two citers of one target add exactly two `refs` rows, a third one more; other bundles' edges untouched; a severance keeps its row", () => {
  const w = world();
  w.doc(A, ["ledger"]); w.doc(B, ["minutes"]);
  /* The shared target cites two documents of its own: edges a promotion of another bundle must not touch. */
  w.doc(C, ["the question"], { references: [{ rel: "cites", target: A }, { rel: "cites", target: B }] });
  const pa = citer(w, "Oversight"), pb = citer(w, "Budget"), pc = citer(w, "Unrelated");
  const others = () => w.rows(`SELECT bundle_id, target_id, kind FROM refs WHERE bundle_id NOT IN (?, ?, ?)
                               ORDER BY bundle_id, target_id, kind`, pa, pb, pc);
  const theirs = others();
  assert.deepEqual(theirs, [{ bundle_id: C, target_id: A, kind: "cites" }, { bundle_id: C, target_id: B, kind: "cites" }]);
  const refs0 = w.count("refs");
  assert.equal(refs0, 2, "minting three projects with references: [] wrote no edge");
  reviseProject(w, pa, "Oversight", [{ target: C, status: "confirmed" }]);
  reviseProject(w, pb, "Budget", [{ target: C, status: "confirmed" }]);
  assert.equal(w.count("refs") - refs0, 2, "the projection grew by exactly two");
  assert.deepEqual(w.rows(`SELECT bundle_id, kind FROM refs WHERE target_id=? ORDER BY bundle_id`, C),
    [pa, pb].sort().map((id) => ({ bundle_id: id, kind: "cites" })));
  assert.deepEqual(others(), theirs, "a promotion replaces only its own bundle's edges");
  /* The edge read back through a different door than the one that wrote it. */
  const bl = w.k.backlinks({ target: C, viewer: MACHINE }).backlinks;
  assert.deepEqual(bl.map((x) => [x.from, x.rel, x.status, x.from_type]),
    [pa, pb].sort().map((id) => [id, "cites", "confirmed", "project"]));
  /* A revision carrying the same reference writes no second row. */
  reviseProject(w, pa, "Oversight", [{ target: C, status: "confirmed" }]);
  assert.equal(w.count("refs") - refs0, 2);
  /* Many-to-one: a third citer adds exactly one. */
  reviseProject(w, pc, "Unrelated", [{ target: C, status: "confirmed" }]);
  assert.equal(w.count("refs") - refs0, 3);
  assert.equal(w.k.backlinks({ target: C, viewer: MACHINE }).backlinks.length, 3);
  /* Severed by authoring the citing document: the row stays, the status is the document's, and citesInto moves it. */
  reviseProject(w, pb, "Budget", [{ target: C, status: "severed" }]);
  assert.equal(w.count("refs") - refs0, 3, "a severed edge is never deleted");
  assert.ok(w.row(`SELECT 1 AS y FROM refs WHERE bundle_id=? AND target_id=? AND kind='cites'`, pb, C));
  assert.equal(w.k.backlinks({ target: C, viewer: MACHINE }).backlinks.find((x) => x.from === pb).status, "severed");
  assert.deepEqual(w.k.citesInto(C), { confirmed: [pa, pc].sort(), severed: [pb] });
  assert.deepEqual(others(), theirs);
});
