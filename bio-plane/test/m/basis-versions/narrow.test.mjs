/* basis-versions: narrowing (R24–R27), appendVersion (R28) and the extract candidates' registration (R40). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, block, version, merge, V, MACHINE } from "./fixture.mjs";
import { NARROW_CANDIDATES_MAX } from "../../../src/basis-versions/index.mjs";
import { canonicalExtent } from "../../../src/content/index.mjs";
import { listenerRefusal } from "../../../src/membership/index.mjs";

const DOC = "INFO-2026-0001-a", DOC2 = "INFO-2026-0002-b", Q = "INQ-2026-0001-q", Q2 = "INQ-2026-0002-r";
const T = "2026-09-27T00:00:00Z", ALICE = "member:alice";

function setup() {
  const w = world();
  const cap = w.doc(DOC); w.doc(DOC2);
  assert.equal(w.inquiry(Q2, block({})).ok, true);
  const r = w.inquiry(Q, block(merge(version("first", [DOC, Q2], { claim: "the claim" }),
    { grounds: [], legs: [] })));
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const legRow = w.row(`SELECT content_id FROM inquiry_basis_version_legs WHERE bundle_id=? AND name='first' AND ord=0`, Q);
  return { w, cap, cid: legRow.content_id };
}
const narrowArgs = (o) => ({ target: Q, version: "first", ord: 0, author: ALICE, viewer: V("alice"), name: "first narrowed",
                             description: "points at page three, where the vote is recorded", extent: { extent_kind: "pdf-page", extent_page: "2" }, ...o });

test("R24: both locate the citation — no inquiry (absent or invisible), no such version, no such leg, no part", () => {
  const { w } = setup();
  for (const f of ["narrow", "narrowCandidates"]) {
    const c = (o) => { const r = w.bv[f](narrowArgs(o)); return [r.reason, r.check]; };
    assert.deepEqual(c({ target: "" }), ["NARROW_NO_INQUIRY", "C-50.1"]);
    assert.deepEqual(c({ target: DOC }), ["NARROW_NO_INQUIRY", "C-50.1"]);
    assert.deepEqual(c({ viewer: "nobody" }), ["NARROW_NO_INQUIRY", "C-50.1"]);
    assert.deepEqual(c({ version: "ghost" }), ["NARROW_NO_SUCH_VERSION", "C-50.2"]);
    assert.deepEqual(c({ ord: 5 }), ["NARROW_NO_SUCH_LEG", "C-50.3"]);
    assert.deepEqual(c({ ord: "x" }), ["NARROW_NO_SUCH_LEG", "C-50.3"]);
    assert.deepEqual(c({ ord: 1 }), ["NARROW_NO_PART", "C-50.4"], "a leg on an inquiry has no part");
  }
});

test("R25: narrowCandidates writes nothing and lists, per source and at most 50 each, parts strictly narrower than the leg's, labelled machine work and proposals; the absence is stated by level", () => {
  const { w, cap } = setup();
  const empty = w.bv.narrowCandidates(narrowArgs());
  assert.deepEqual([empty.ok, empty.candidates, empty.absence.level, empty.proposal_only, empty.limit], [true, [], "document", true, 50]);
  /* read, and nothing found inside: the absence is stated at the content level */
  w.st.sql.exec(`INSERT INTO readings (capture_sha, bundle_id, content_type, reader_version, found, entity_count, reading, at)
                 VALUES (?, ?, 'doc', '1', 0, 0, '{}', ?)`, cap, DOC, T);
  const readEmpty = w.bv.narrowCandidates(narrowArgs());
  assert.deepEqual([readEmpty.candidates, readEmpty.absence.level], [[], "content"]);
  assert.match(readEmpty.absence.says, /was read/);
  w.readRef(cap, DOC, "entity:council", 2);
  w.readRef(cap, DOC, "entity:mayor", 4);
  w.st.sql.exec(`INSERT INTO entities (entity_id, kind, label, at) VALUES ('ENT-2026-0001', 'body', 'council', ?)`, T);
  w.st.sql.exec(`INSERT INTO resolutions (capture_sha, bundle_id, ref, entity_id, grade, method, established, at)
                 VALUES (?, ?, 'entity:council', 'ENT-2026-0001', 'A', 't', 1, ?)`, cap, DOC, T);
  w.content.mint({ bundleId: DOC, captureSha: cap, extent: { kind: "pdf-page", page: 7 }, mintedBy: "class:ai", at: T });
  const before = w.count("content");
  const r = w.bv.narrowCandidates(narrowArgs());
  assert.equal(w.count("content"), before, "writes nothing");
  assert.deepEqual(r.candidates.map((c) => [c.source, c.extent.kind, c.extent.page, c.machine_work]),
    [["reading", "pdf-page", 2, true], ["reading", "pdf-page", 4, true], ["marked", "pdf-page", 7, true]]);
  assert.deepEqual(r.counts, { reading: 2, extract: 0, marked: 1 });
  assert.equal(r.candidates.find((c) => c.source === "reading").mentions_subject, null, "the question names no subject");
  assert.ok(r.candidates.every((c) => typeof c.says === "string" && c.mint && c.fields));
  assert.equal(r.absence, null);
  assert.equal(r.truncated, false);
  /* the bound per source */
  for (let p = 10; p < 10 + NARROW_CANDIDATES_MAX + 5; p++) w.readRef(cap, DOC, `entity:e${p}`, p);
  const cut = w.bv.narrowCandidates(narrowArgs());
  assert.deepEqual([cut.counts.reading, cut.truncated], [50, true]);
});

test("R26: narrow refuses a machine, a bad extent, no extent, another capture, the leg grammar, a part not narrower, a bad name, and no description", () => {
  const { w, cap } = setup();
  const c = (o) => { const r = w.bv.narrow(narrowArgs(o)); return [r.reason, r.check]; };
  assert.deepEqual(c({ author: MACHINE }), ["NARROW_NOT_A_MEMBER", "C-50.5"]);
  assert.deepEqual(c({ author: "" }), ["NARROW_NOT_A_MEMBER", "C-50.5"]);
  assert.deepEqual(c({ extent: { page: "2" } }), ["NARROW_BAD_EXTENT", "C-50.7"], "an unknown field");
  assert.deepEqual(c({ extent: { extent_kind: 'pdf"page' } }), ["NARROW_BAD_EXTENT", "C-50.7"], "an unwritable value");
  const other = w.content.mint({ bundleId: DOC2, captureSha: w.row(`SELECT capture_sha FROM register WHERE bundle_id=?`, DOC2).capture_sha,
                                 extent: { kind: "pdf-page", page: 1 }, mintedBy: ALICE, at: T }).content_id;
  assert.deepEqual(c({ extent: { content_id: other, extent_kind: "pdf-page" } }), ["NARROW_BAD_EXTENT", "C-50.7"], "an id and a part together");
  assert.deepEqual(c({ extent: { content_id: "0".repeat(64) } }), ["NARROW_BAD_EXTENT", "C-50.7"], "an unknown content id");
  assert.deepEqual(c({ extent: {} }), ["NARROW_NO_EXTENT", "C-50.6"]);
  assert.deepEqual(c({ extent: { content_id: other } }), ["NARROW_OTHER_CAPTURE", "C-50.8"]);
  assert.equal(w.bv.narrow(narrowArgs({ extent: { extent_kind: "dom" } })).reason, "BASIS_REFUSED");
  assert.deepEqual(c({ extent: { extent_kind: "document" } }), ["NARROW_NOT_NARROWER", "C-50.9"]);
  assert.deepEqual(c({ name: "" }), ["NARROW_NAME", "C-50.10"]);
  assert.deepEqual(c({ name: "first" }), ["NARROW_NAME", "C-50.10"], "taken");
  assert.deepEqual(c({ name: "bad/name" }), ["NARROW_NAME", "C-50.10"]);
  assert.deepEqual(c({ description: "" }), ["NARROW_NO_DESCRIPTION", "C-50.11"]);
  for (const d of ["TBD", "  n/a. ", "<description>", "...", "Lorem ipsum"])
    assert.deepEqual(c({ description: d }), ["NARROW_NO_DESCRIPTION", "C-50.11"], `boilerplate: ${d}`);
  assert.equal(w.count("inquiry_basis_versions"), 1, "nothing written");
  void cap;
});

/* A content row as content's writer holds it, for an extent its mint would take from a document of another format. */
function heldRow(w, cap, extent, n) {
  const id = String(n).repeat(64).slice(0, 64);
  w.st.sql.exec(`INSERT INTO content (content_id, capture_sha, bundle_id, extent_kind, extent, ref, minted_by, at, cited_as)
                 VALUES (?, ?, ?, ?, ?, ?, 'member:alice', ?, ?)`, id, cap, DOC, extent.kind, canonicalExtent(extent),
                `a part ${n}`, T, extent.kind === "envelope" ? "envelope" : "text");
  return id;
}

test("R25, R26 (N99): narrower is content's extentRelation — an envelope item lies inside the whole document the leg cites, so narrowing to it lands and a machine's mark on it is a candidate", () => {
  const { w, cap } = setup();
  const env = heldRow(w, cap, { kind: "envelope", item: "core-property", part: "docProps/core.xml", name: "creator" }, 1);
  const r = w.bv.narrow(narrowArgs({ name: "creator", description: "points at who the file says made it",
                                     extent: { content_id: env } }));
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.equal(r.narrowed.to.content_id, env);
  const back = w.bv.narrow(narrowArgs({ version: "creator", name: "creator again", extent: { content_id: env } }));
  assert.deepEqual([back.reason, back.relation], ["NARROW_NOT_NARROWER", "same"], "the item itself is not narrower than itself");
  /* the machine's marks go through the same relation */
  w.st.sql.exec(`UPDATE content SET minted_by='class:ai' WHERE content_id=?`, env);
  const c = w.bv.narrowCandidates(narrowArgs());
  assert.deepEqual(c.candidates.filter((x) => x.source === "marked").map((x) => x.content_id), [env]);
});

test("R27: narrow writes a new version, suggested, derived_from the old, identical but for the one leg, which names the part pinned to the old capture and carries no grade; the old version is untouched; the answer says whether it was a machine proposal", () => {
  const { w, cap, cid } = setup();
  const oldComp = w.row(`SELECT composition FROM inquiry_basis_versions WHERE name='first'`).composition;
  w.readRef(cap, DOC, "entity:council", 2);
  const r = w.bv.narrow(narrowArgs());
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
  assert.deepEqual([r.version, r.derived_from, r.state, r.ord, r.chosen_from.source, r.narrowed.from.unchanged, r.narrowed.from.content_id],
                   ["first narrowed", "first", "suggested", 0, "reading", true, cid]);
  assert.equal(r.narrowed.to.capture_sha, cap);
  assert.equal(r.grade_not_carried, null, "the old leg carried no grade");
  const v = w.bv.basisVersions({ id: Q, viewer: V("alice") }).versions;
  assert.deepEqual(v.map((x) => [x.name, x.state, x.derived_from, x.claim]), [["first", "suggested", null, "the claim"], ["first narrowed", "suggested", "first", "the claim"]]);
  assert.equal(w.row(`SELECT composition FROM inquiry_basis_versions WHERE name='first'`).composition, oldComp, "the old version is untouched");
  const legs = v[1].legs;
  assert.deepEqual(legs.map((l) => l.target_id), [DOC, Q2], "identical but for the one leg");
  assert.equal(legs[0].content_id, r.narrowed.to.content_id);
  assert.match(v[1].composition, new RegExp(`leg_capture\\t0\\t${cap}`), "pinned to the old leg's capture");
  assert.match(w.text(Q), /\| Narrowed a citation \| member:alice\n[\s\S]*Chosen from a machine proposal \(reading\)\./);
  /* a graded leg: the grade is not carried */
  const w2 = world(); w2.doc(DOC);
  w2.inquiry(Q, block({ versions: [{ name: "g", description: "a graded reading here", relationship: "and", state: "suggested", hidden: false }],
    grounds: [{ version: "g", ground: "main", asserted_by: ALICE, at: T }],
    legs: [{ version: "g", target: DOC, role: "supports", ground: "main", grade: "B", grade_axis: "capture", grade_source: "capture" }] }));
  const g = w2.bv.narrow(narrowArgs({ version: "g" }));
  assert.deepEqual([g.ok, g.grade_not_carried.was, g.chosen_from], [true, { grade: "B", grade_axis: "capture", grade_source: "capture" }, null]);
  assert.equal(w2.row(`SELECT grade FROM inquiry_basis_version_legs WHERE name='first narrowed'`).grade, null);
});

test("R28: appendVersion appends one version, its grounds and legs, in suggested state, and promotes it so R6 judges it; it never sets another state", () => {
  const { w } = setup();
  const r = w.bv.appendVersion({ target: Q, author: "class:ai", run: "RUN-1", kind: "basis-version", at: T,
    version: { name: "machine", kind: undefined, description: "a machine's proposal", claim: null, relationship: "and",
               derived_from: null, state: "accepted", hidden: true },
    grounds: [{ ground: "main", asserted_by: "none:independent-sufficiency", at: T }],
    legs: [{ target: DOC2, role: "supports", ground: "main", grade: null, extent_kind: "document" }],
    log: `### Session ${T} | Suggestion | class:ai\nTrigger: op=suggest on ${Q}\n` });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
  const row = w.row(`SELECT state, hidden, kind, run, claim, derived_from FROM inquiry_basis_versions WHERE name='machine'`);
  assert.deepEqual(row, { state: "suggested", hidden: 0, kind: "basis-version", run: "RUN-1", claim: null, derived_from: null });
  assert.ok(r.version_content.some((x) => x.version === "machine"));
  assert.match(w.text(Q), /  - name: "machine"\n    kind: "basis-version"\n    description: "a machine's proposal"\n    claim: null\n    relationship: "and"\n    state: "suggested"\n    hidden: false\n    derived_from: null\n    run: "RUN-1"\n/);
  assert.match(w.text(Q), /\| Suggestion \| class:ai\nTrigger: op=suggest/);
  const judged = w.bv.appendVersion({ target: Q, author: ALICE, version: { name: "bad", description: "no relationship", relationship: "xor" },
    grounds: [], legs: [] });
  assert.equal(judged.reason, "BASIS_VERSION_REFUSED", "R6 judges it");
  assert.deepEqual([w.bv.appendVersion({ target: "INQ-2026-0404-z", version: {} }).reason,
                    w.bv.appendVersion({ target: DOC, version: {} }).reason], ["NO_SUCH_BUNDLE", "NOT_AN_INQUIRY"]);
});

test("R40: onCandidates registers one extract source; a malformed or second registration is refused through membership's listenerRefusal (LISTENER_MALFORMED; LISTENER_DECLARED naming the holder); with none the extract arm lists nothing", () => {
  const { w, cap } = setup();
  assert.equal(w.bv.narrowCandidates(narrowArgs()).counts.extract, 0);
  const noop = () => ({ rows: [], truncated: false });
  for (const [m, f] of [["", noop], [null, noop], ["run-productions", "not a function"]]) {
    const bad = w.bv.onCandidates(m, f);
    assert.deepEqual(bad, listenerRefusal(null, m, f), "membership's one refusal, unchanged");
    assert.equal(bad.reason, "LISTENER_MALFORMED");
  }
  assert.equal(w.bv.narrowCandidates(narrowArgs()).counts.extract, 0, "a refused registration holds no slot");
  const calls = [];
  const src = (a) => { calls.push(a); return { rows: [{ run: "RUN-9", ref: "entity:x", label: "x", pos_kind: "pdf-page",
    pos: JSON.stringify({ kind: "pdf-page", page: 3, ref: "page 4" }), pos_ref: "page 4", content_id: null, proposed_by: "class:ai" }], truncated: false }; };
  assert.deepEqual(w.bv.onCandidates("run-productions", src), { ok: true, module: "run-productions" });
  const second = w.bv.onCandidates("other", src);
  assert.deepEqual(second, listenerRefusal({ module: "run-productions" }, "other", src));
  assert.deepEqual([second.reason, second.module], ["LISTENER_DECLARED", "run-productions"], "by any module, naming the holder");
  assert.equal(w.bv.onCandidates("run-productions", src).reason, "LISTENER_DECLARED", "the holder too");
  const r = w.bv.narrowCandidates(narrowArgs());
  assert.deepEqual(calls, [{ captureSha: cap, max: 50 }]);
  assert.deepEqual(r.candidates.map((c) => [c.source, c.run, c.extent.page]), [["extract", "RUN-9", 3]]);
  assert.equal(r.counts.extract, 1);
  /* a source may hand the position already parsed, as run-productions' candidates do */
  const w2 = setup().w;
  w2.bv.onCandidates("run-productions", () => ({ rows: [{ run: "RUN-8", ref: "entity:y", label: null,
    position: { kind: "pdf-page", page: 5, ref: "page 6" }, content_id: null, proposed_by: "class:ai" }], truncated: true }));
  const r2 = w2.bv.narrowCandidates(narrowArgs());
  assert.deepEqual([r2.candidates.map((c) => [c.source, c.extent.page]), r2.truncated], [[["extract", 5]], true]);
});
