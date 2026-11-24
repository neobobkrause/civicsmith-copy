/* contradiction R5–R12, R18, R23: the pairing read (`pairs`, op=contradictionpairs), driven at its interface over a
   record laid down in the fixture. */
import test from "node:test";
import assert from "node:assert/strict";
import { word } from "../../../src/setup-words/index.mjs";
import { world, k4World, MACHINE, MEMBER, OUTSIDER } from "./fixture.mjs";
import { CONTRADICTION_KEYS, CONTRADICTION_ABSENCE, CONTRADICTION_PAIRS_MAX, CONTRADICTION_LABELS,
         CONTRADICTION_PAIR_CHECKS, CONTRADICTION_CANDIDATE_CHECKS } from "../../../src/contradiction/index.mjs";

const byKey = (r, k) => r.keys.find((x) => x.key === k);

/* K1 material: inquiry INQ-1 with a supports and a cuts_against leg, each on a passage. */
function k1World(opts) {
  const w = world(opts);
  w.inquiry("INQ-2026-0001");
  w.content("c1", "cap1", "INFO-2026-0001");
  w.content("c2", "cap2", "INFO-2026-0002", { stale: 1 });
  w.leg("INQ-2026-0001", 0, "supports", { content: "c1", note: "n0" });
  w.leg("INQ-2026-0001", 1, "cuts_against", { content: "c2", target: "INFO-2026-0002" });
  return w;
}

test("R5: key is trimmed and upper-cased; absent or blank runs all six keys (K6 since T33); any other key is C-60.1 naming the keys held", () => {
  const w = k1World();
  for (const key of [" k1 ", "K1", "k1"]) {
    const r = w.c.pairs({ key, viewer: MACHINE });
    assert.equal(r.ok, true);
    assert.deepEqual(r.keys.filter((k) => k.ran).map((k) => k.key), ["K1"]);
  }
  for (const key of [null, undefined, "", "   "]) {
    const r = w.c.pairs({ key, viewer: MACHINE });
    assert.deepEqual(r.keys.filter((k) => k.ran).map((k) => k.key), ["K1", "K2", "K3", "K4", "K5", "K6"]);
  }
  assert.deepEqual(w.c.pairs({ key: " k5 ", viewer: MACHINE }).keys.filter((k) => k.ran).map((k) => k.key), ["K5"]);
  assert.deepEqual(w.c.pairs({ key: "k6", viewer: MACHINE }).keys.filter((k) => k.ran).map((k) => k.key), ["K6"]);
  for (const key of ["K7", "K0", "k 1", "all", 1]) {
    const r = w.c.pairs({ key, viewer: MACHINE });
    const row = CONTRADICTION_PAIR_CHECKS.CONTRADICTION_KEY_UNKNOWN;
    assert.equal(r.ok, false);
    assert.equal(r.reason, "CONTRADICTION_KEY_UNKNOWN");
    assert.equal(r.code, "CONTRADICTION_KEY_UNKNOWN");
    assert.equal(r.check, "C-60.1");
    assert.equal(r.check, row.check);
    assert.equal(r.translation, row.translation);
    assert.deepEqual(r.keys, ["K1", "K2", "K3", "K4", "K5", "K6"]);
    assert.match(r.detail, /K1, K2, K3, K4, K5, K6/);
  }
});

test("R6: limit is clamped to [1, 50], a non-number or less than 1 is 50, never refused; the answer states limit, bound and bounded", () => {
  const w = k1World();
  const cases = [[null, 50], [undefined, 50], ["", 50], ["abc", 50], ["0", 50], ["-3", 50], [0.5, 50],
                 ["1", 1], [1, 1], ["7.9", 7], ["50", 50], ["51", 50], [9999, 50], [Infinity, 50]];
  for (const [limit, want] of cases) {
    const r = w.c.pairs({ limit, viewer: MACHINE });
    assert.equal(r.ok, true, `limit ${limit}`);
    assert.equal(r.limit, want, `limit ${limit}`);
    assert.equal(r.bound, 50);
    assert.equal(r.bounded, true);
    assert.ok(r.keys.every((k) => k.limit === want));
  }
  assert.equal(CONTRADICTION_PAIRS_MAX, 50);
});

test("R7: each key answers ran, formed, limit, truncated observed past the bound, levels, notes, absence; K3 its two arms; an unnamed key is not_run", () => {
  const w = world();
  w.inquiry("INQ-2026-0001");
  for (let i = 0; i < 3; i++) {
    w.content(`s${i}`, `caps${i}`, "INFO-2026-0001");
    w.leg("INQ-2026-0001", i, "supports", { content: `s${i}` });
  }
  w.content("x", "capx", "INFO-2026-0002");
  w.leg("INQ-2026-0001", 9, "cuts_against", { content: "x" });
  /* three pairs formed: at limit 3 nothing is cut, at 2 the read saw a third and says so. */
  const at3 = w.c.pairs({ key: "K1", limit: 3, viewer: MACHINE });
  const k3 = byKey(at3, "K1");
  assert.deepEqual([k3.ran, k3.formed, k3.limit, k3.truncated, k3.absence], [true, 3, 3, false, null]);
  assert.ok(Array.isArray(k3.levels) && Array.isArray(k3.notes));
  const at2 = byKey(w.c.pairs({ key: "K1", limit: 2, viewer: MACHINE }), "K1");
  assert.deepEqual([at2.formed, at2.truncated], [2, true]);
  assert.equal(w.c.pairs({ key: "K1", limit: 2, viewer: MACHINE }).pairs.length, 2);
  /* the unnamed keys */
  for (const k of ["K2", "K3", "K4", "K5", "K6"]) {
    const e = byKey(at3, k);
    assert.equal(e.ran, false);
    assert.equal(e.formed, 0);
    assert.equal(e.levels, null);
    assert.equal(e.absence.level, "not_run");
    assert.match(e.absence.says, /not run/);
  }
  /* every key's catalogue entry travels with it */
  for (const k of at3.keys) for (const f of ["key", "name", "feeds", "join", "why"]) assert.equal(k[f], CONTRADICTION_KEYS[k.key][f]);
  /* K3's arms, each with its own formed and truncated */
  const w3 = world();
  for (const id of ["INQ-2026-0001", "INQ-2026-0002", "INQ-2026-0003"]) { w3.inquiry(id); w3.version(id, "v1"); }
  w3.content("p", "capp", "INFO-2026-0001");
  w3.versionLeg("INQ-2026-0001", "v1", 0, { content: "p" });
  w3.versionLeg("INQ-2026-0002", "v1", 0, { content: "p" });
  w3.versionLeg("INQ-2026-0001", "v1", 1, { target: "INFO-2026-0009" });
  w3.versionLeg("INQ-2026-0002", "v1", 1, { target: "INFO-2026-0009" });
  w3.versionLeg("INQ-2026-0003", "v1", 1, { target: "INFO-2026-0009" });
  const r3 = byKey(w3.c.pairs({ key: "K3", limit: 2, viewer: MACHINE }), "K3");
  assert.deepEqual(r3.arms, { passage: { formed: 1, truncated: false }, document: { formed: 2, truncated: true } });
  assert.equal(r3.formed, 3);
  assert.equal(r3.truncated, true);
});

test("R8: K1 pairs a supports and a cuts_against leg of one inquiry, each on a passage, sides resolving the content row (null when not held)", () => {
  const w = k1World();
  w.inquiry("INQ-2026-0002");
  w.leg("INQ-2026-0002", 0, "supports", { content: "c1" });        /* no cuts_against leg in the same inquiry */
  w.leg("INQ-2026-0002", 1, "cuts_against", { content: null });     /* no passage */
  w.inquiry("INQ-2026-0003");
  w.leg("INQ-2026-0003", 0, "supports", { content: "gone" });       /* a content row not held */
  w.leg("INQ-2026-0003", 1, "cuts_against", { content: "c1" });
  const r = w.c.pairs({ key: "K1", viewer: MACHINE });
  assert.equal(r.pairs.length, 2);
  const [p, q] = r.pairs;
  assert.deepEqual(p, {
    key: "K1", inquiry: "INQ-2026-0001",
    a: { kind: "leg", inquiry: "INQ-2026-0001", ord: 0, role: "supports", target: "INFO-2026-0001", content_id: "c1",
         note: "n0", capture_sha: "cap1", ref: "ref of c1", extent_kind: "pdf-page", stale: false },
    b: { kind: "leg", inquiry: "INQ-2026-0001", ord: 1, role: "cuts_against", target: "INFO-2026-0002", content_id: "c2",
         note: null, capture_sha: "cap2", ref: "ref of c2", extent_kind: "pdf-page", stale: true },
    why: p.why });
  assert.equal(q.inquiry, "INQ-2026-0003");
  assert.deepEqual([q.a.capture_sha, q.a.ref, q.a.extent_kind, q.a.stale], [null, null, null, null]);
  assert.equal(q.b.capture_sha, "cap1");
});

test("R8: K2 pairs two inquiries on one subject, each with an accepted, unhidden, claimed version, once and not from each side", () => {
  const w = world();
  w.inquiry("INQ-2026-0001", { subject: "E1" }); w.version("INQ-2026-0001", "v1", { claim: "up" });
  w.inquiry("INQ-2026-0002", { subject: "E1" }); w.version("INQ-2026-0002", "v1", { claim: "down" });
  w.version("INQ-2026-0002", "v2", { state: "suggested", claim: "x" });
  w.version("INQ-2026-0002", "v3", { hidden: 1, claim: "x" });
  w.version("INQ-2026-0002", "v4", { claim: "" });
  w.version("INQ-2026-0002", "v5", { claim: null });
  w.inquiry("INQ-2026-0003", { subject: "E2" }); w.version("INQ-2026-0003", "v1");
  w.inquiry("INQ-2026-0004", { subject: "" }); w.version("INQ-2026-0004", "v1");
  w.inquiry("INQ-2026-0005", { subject: "" }); w.version("INQ-2026-0005", "v1");
  const r = w.c.pairs({ key: "K2", viewer: MACHINE });
  assert.equal(r.pairs.length, 1);
  const p = r.pairs[0];
  assert.equal(p.key, "K2");
  assert.equal(p.subject_entity, "E1");
  assert.deepEqual(p.a, { kind: "claim", inquiry: "INQ-2026-0001", title: "title of INQ-2026-0001", version: "v1", claim: "up" });
  assert.deepEqual(p.b, { kind: "claim", inquiry: "INQ-2026-0002", title: "title of INQ-2026-0002", version: "v1", claim: "down" });
});

test("R8: K3 pairs claimed versions of two different inquiries resting on one passage, or where neither names one on one information target", () => {
  const w = world();
  for (const id of ["INQ-2026-0001", "INQ-2026-0002"]) { w.inquiry(id); w.version(id, "v1", { claim: `claim ${id}` }); }
  w.version("INQ-2026-0001", "v2", { claim: "second" });
  w.content("p", "capp", "INFO-2026-0001");
  w.versionLeg("INQ-2026-0001", "v1", 0, { content: "p" });
  w.versionLeg("INQ-2026-0001", "v2", 0, { content: "p" });      /* same inquiry: never paired with its own v1 */
  w.versionLeg("INQ-2026-0002", "v1", 0, { content: "p" });
  w.versionLeg("INQ-2026-0001", "v1", 1, { target: "INFO-2026-0007" });
  w.versionLeg("INQ-2026-0002", "v1", 1, { target: "INFO-2026-0007" });
  w.versionLeg("INQ-2026-0001", "v1", 2, { target: "INQ-2026-0009", type: "inquiry" });   /* a sub-question is no document */
  w.versionLeg("INQ-2026-0002", "v1", 2, { target: "INQ-2026-0009", type: "inquiry" });
  w.versionLeg("INQ-2026-0001", "v1", 3, { target: "INFO-2026-0008", content: "q" });    /* a passage on one side only */
  w.versionLeg("INQ-2026-0002", "v1", 3, { target: "INFO-2026-0008" });
  const r = w.c.pairs({ key: "K3", viewer: MACHINE });
  const passage = r.pairs.filter((p) => p.referent_grain === "passage");
  const doc = r.pairs.filter((p) => p.referent_grain === "document");
  assert.equal(passage.length, 2);   /* v1 and v2 of INQ-1, each against INQ-2's v1 */
  assert.ok(passage.every((p) => p.content_id === "p" && p.a.inquiry === "INQ-2026-0001" && p.b.inquiry === "INQ-2026-0002"));
  assert.deepEqual(passage.map((p) => p.a.version).sort(), ["v1", "v2"]);
  assert.equal(doc.length, 1);
  assert.deepEqual([doc[0].content_id, doc[0].document], [null, "INFO-2026-0007"]);
  assert.deepEqual(doc[0].a, { kind: "claim", inquiry: "INQ-2026-0001", version: "v1", claim: "claim INQ-2026-0001", ord: 1 });
});

test("R8: K4 pairs two cited passages whose captures resolve, established, to one entity, once however often a document names it", () => {
  const w = k4World({ contentType: "rule" }, { contentType: "act" });
  w.resolution("capA", "INFO-2026-0001", "E1", { ref: "ref:2" });    /* a second mention: still one pair */
  w.content("cc", "capC", "INFO-2026-0003");                          /* not cited */
  w.resolution("capC", "INFO-2026-0003", "E1");
  w.reading("capC", "INFO-2026-0003", { contentType: "memo" });
  w.content("cd", "capD", "INFO-2026-0004");                          /* cited, resolution not established */
  w.leg("INQ-2026-0001", 5, "supports", { content: "cd" });
  w.resolution("capD", "INFO-2026-0004", "E1", { established: 0 });
  w.reading("capD", "INFO-2026-0004", { contentType: "memo" });
  const r = w.c.pairs({ key: "K4", viewer: MACHINE });
  assert.equal(r.pairs.length, 1);
  const p = r.pairs[0];
  assert.deepEqual([p.key, p.entity_id, p.discriminator], ["K4", "E1", "doctype"]);
  assert.deepEqual(p.a, { kind: "extent", content_id: "ca", capture_sha: "capA", ref: "ref of ca", extent_kind: "pdf-page",
                          doctype: "rule", date: null, read: true });
  assert.equal(p.b.content_id, "cb");
  /* a version leg cites as a leg does */
  const v = world();
  v.inquiry("INQ-2026-0001"); v.version("INQ-2026-0001", "v1");
  v.content("ca", "capA", "INFO-2026-0001"); v.content("cb", "capB", "INFO-2026-0002");
  v.versionLeg("INQ-2026-0001", "v1", 0, { content: "ca" }); v.versionLeg("INQ-2026-0001", "v1", 1, { content: "cb" });
  v.resolution("capA", "INFO-2026-0001", "E1"); v.resolution("capB", "INFO-2026-0002", "E1");
  v.reading("capA", "INFO-2026-0001", { contentType: "rule" }); v.reading("capB", "INFO-2026-0002", { contentType: "act" });
  assert.equal(v.c.pairs({ key: "K4", viewer: MACHINE }).pairs.length, 1);
});

test("R9: K4 tells sources apart only by the doctype their readers state and the own dates events holds, compared by civil-time; unstated or unsettled is undetermined, counted and split; agreeing is indistinct", () => {
  const D = { never_read: 0, no_doctype: 0, no_date: 0, order_undetermined: 0 };
  const cases = [
    [{ contentType: "rule", date: "2026-01-01" }, { contentType: "act", date: "2026-01-01" }, { formed: 1, disc: "doctype" }],
    [{ contentType: "rule", date: "2026-03-01" }, { contentType: "rule", date: "2026-10-01" }, { formed: 1, disc: "date", order: "a_first" }],
    [{ contentType: "rule", date: "2026-10-01" }, { contentType: "rule", date: "2026-03-01" }, { formed: 1, disc: "date", order: "b_first" }],
    [{ contentType: "rule", date: "2026-03-01" }, { contentType: "rule", date: "2026-03-01" }, { indistinct: 1 }],
    [{ contentType: "rule" }, null, { undetermined: 1, detail: { ...D, never_read: 1 } }],
    [{ contentType: null, date: "2026-03-01" }, { contentType: "rule", date: "2026-03-01" }, { undetermined: 1, detail: { ...D, no_doctype: 1 } }],
    [{ contentType: "rule", date: "2026-03-01" }, { contentType: "rule" }, { undetermined: 1, detail: { ...D, no_date: 1 } }],
    [{ contentType: "  ", date: " " }, { contentType: "rule", date: "2026-03-01" }, { undetermined: 1, detail: { ...D, no_doctype: 1 } }],
    /* a reading's own top-level date that events does not hold is no date (never read from the reading alone) */
    [{ contentType: "rule", date: "2026-03-01", dated: false }, { contentType: "rule", date: "2026-10-01" }, { undetermined: 1, detail: { ...D, no_date: 1 } }],
    /* never as raw strings: a coarser precision that does not settle the order, or a band, is undetermined */
    [{ contentType: "rule", date: "2026", precision: "edtf" }, { contentType: "rule", date: "2026-03-01" }, { undetermined: 1, detail: { ...D, order_undetermined: 1 } }],
    [{ contentType: "rule", date: "2026-03", precision: "edtf" }, { contentType: "rule", date: "2026-03", precision: "edtf" }, { indistinct: 1 }],
    [{ contentType: "rule", date: "2025", precision: "edtf" }, { contentType: "rule", date: "2026-03-01" }, { formed: 1, disc: "date", order: "a_first" }],
    /* zones count: the same day in two zones overlaps, never settled by the strings */
    [{ contentType: "rule", date: "2026-03-01", zone: "America/Halifax" }, { contentType: "rule", date: "2026-03-01" }, { undetermined: 1, detail: { ...D, order_undetermined: 1 } }],
    /* a string-order that is the wrong order: minute precision across zones */
    [{ contentType: "rule", date: "2026-03-01T09:00", precision: "minute", zone: "Asia/Tokyo" }, { contentType: "rule", date: "2026-03-01T08:00", precision: "minute" },
     { formed: 1, disc: "date", order: "a_first" }],
  ];
  for (const [a, b, want] of cases) {
    const w = k4World(a, b);
    const r = w.c.pairs({ key: "K4", viewer: MACHINE });
    const k = byKey(r, "K4");
    const what = JSON.stringify([a, b]);
    assert.equal(k.formed, want.formed || 0, what);
    if (want.disc) assert.equal(r.pairs[0].discriminator, want.disc, what);
    if (want.order) assert.equal(r.pairs[0].order, want.order, what);
    assert.equal(k.indistinct, want.indistinct || 0, what);
    assert.equal(k.undetermined, want.undetermined || 0, what);
    assert.deepEqual(k.undetermined_detail, want.detail || D, what);
    if (want.undetermined) {
      assert.equal(k.notes.length, 1);
      assert.match(k.notes[0], /NOT formed/);
      assert.match(r.says, /NOT formed because a value the record does not hold, or an order it does not settle/);
    } else assert.deepEqual(k.notes, []);
  }
  /* the side carries the date as stated and its precision and zone */
  const d = k4World({ contentType: "rule", date: "2026-03", precision: "edtf" }, { contentType: "rule", date: "2026-10-01", zone: "America/Halifax" });
  const p = d.c.pairs({ key: "K4", viewer: MACHINE }).pairs[0];
  assert.deepEqual([p.a.date, p.a.date_precision, p.a.date_zone], ["2026-03", "edtf", "UTC"]);
  assert.deepEqual([p.b.date, p.b.date_precision, p.b.date_zone], ["2026-10-01", "day", "America/Halifax"]);
  /* several own dates: they agree, or the reading's stated one settles it; otherwise no date */
  const several = (extra, readingDate) => {
    const w = k4World({ contentType: "rule", date: readingDate, dated: false }, { contentType: "rule", date: "2026-12-01" });
    for (const v of extra) w.dated("capA", "INFO-2026-0001", v, { kind: v.endsWith("01") ? "adopted" : "effective" });
    return byKey(w.c.pairs({ key: "K4", viewer: MACHINE }), "K4");
  };
  assert.equal(several(["2026-02-01", "2026-02-01"], "2026-02-01").formed, 1);
  assert.equal(several(["2026-02-01", "2026-02-15"], "2026-02-15").formed, 1);
  assert.deepEqual([several(["2026-02-01", "2026-02-15"], "2026-02-20").undetermined_detail.no_date,
                    several(["2026-02-01", "2026-02-15"], null).undetermined_detail.no_date], [1, 1]);
  /* an "on or before" bound is a bound, not the document's date */
  const ub = k4World({ contentType: "rule" }, { contentType: "rule", date: "2026-12-01" });
  ub.dated("capA", "INFO-2026-0001", "2026-01-01", { kind: "published", upperBound: true });
  assert.equal(byKey(ub.c.pairs({ key: "K4", viewer: MACHINE }), "K4").undetermined_detail.no_date, 1);
  /* never from the content row's or the capture's own time: those instants differ and no own date is held */
  const w = k4World({ contentType: "rule" }, { contentType: "rule" });
  w.st.sql.exec(`UPDATE content SET at='2020-01-01' WHERE content_id='ca'`);
  const k = byKey(w.c.pairs({ key: "K4", viewer: MACHINE }), "K4");
  assert.deepEqual([k.formed, k.undetermined, k.undetermined_detail.no_date], [0, 1, 1]);
  /* an own date held in a bundle the viewer may not see is not a date for that viewer */
  const h = k4World({ contentType: "rule", date: "2026-01-01", dated: false }, { contentType: "rule", date: "2026-10-01" });
  h.inquiry("PROJ-2026-0009", { project: true });
  h.dated("capA", "PROJ-2026-0009", "2026-01-01");
  assert.deepEqual([byKey(h.c.pairs({ key: "K4", viewer: MEMBER }), "K4").formed,
                    byKey(h.c.pairs({ key: "K4", viewer: OUTSIDER }), "K4").undetermined_detail.no_date], [1, 1]);
});

test("R10: every side's bundle is one the viewer may see; an absent or unrecognised viewer compares nothing and says it is an outage", () => {
  /* the same material, one side filed in a project the outsider does not take part in */
  const w = k1World();
  w.inquiry("PROJ-2026-0001", { project: true });
  w.content("h1", "caph1", "INFO-2026-0003"); w.content("h2", "caph2", "INFO-2026-0004");
  w.leg("PROJ-2026-0001", 0, "supports", { content: "h1" });
  w.leg("PROJ-2026-0001", 1, "cuts_against", { content: "h2" });
  assert.equal(w.c.pairs({ key: "K1", viewer: MACHINE }).pairs.length, 2);
  assert.equal(w.c.pairs({ key: "K1", viewer: MEMBER }).pairs.length, 2);     /* a participant */
  const out = w.c.pairs({ key: "K1", viewer: OUTSIDER });
  assert.deepEqual(out.pairs.map((p) => p.inquiry), ["INQ-2026-0001"]);
  assert.equal(out.viewer_scope, "participant");
  /* K4: a passage filed in a hidden bundle is not a side */
  const k = k4World({ contentType: "rule" }, { contentType: "act" });
  k.inquiry("PROJ-2026-0002", { project: true });
  k.st.sql.exec(`UPDATE content SET bundle_id='PROJ-2026-0002' WHERE content_id='cb'`);
  assert.equal(k.c.pairs({ key: "K4", viewer: MEMBER }).pairs.length, 1);
  assert.equal(k.c.pairs({ key: "K4", viewer: OUTSIDER }).pairs.length, 0);
  /* K2, K3: a claim of a hidden inquiry is not a side */
  const c = world();
  c.inquiry("INQ-2026-0001", { subject: "E1" }); c.version("INQ-2026-0001", "v1");
  c.inquiry("PROJ-2026-0003", { subject: "E1", project: true }); c.version("PROJ-2026-0003", "v1");
  c.content("p", "capp", "INFO-2026-0001");
  c.versionLeg("INQ-2026-0001", "v1", 0, { content: "p" }); c.versionLeg("PROJ-2026-0003", "v1", 0, { content: "p" });
  assert.deepEqual([c.c.pairs({ key: "K2", viewer: MEMBER }).pairs_formed, c.c.pairs({ key: "K3", viewer: MEMBER }).pairs_formed], [1, 1]);
  assert.deepEqual([c.c.pairs({ key: "K2", viewer: OUTSIDER }).pairs_formed, c.c.pairs({ key: "K3", viewer: OUTSIDER }).pairs_formed], [0, 0]);
  /* no viewer, or one the record does not recognise: nothing compared, every run key's level `viewer` */
  for (const viewer of [null, undefined, "", "somebody", "member:", "class:root"]) {
    const r = w.c.pairs({ viewer });
    assert.equal(r.ok, true);
    assert.equal(r.viewer_scope, "DENY");
    assert.equal(r.pairs_formed, 0);
    assert.deepEqual(r.pairs, []);
    for (const key of r.keys) {
      assert.equal(key.absence.level, "viewer");
      assert.equal(key.absence.says, CONTRADICTION_ABSENCE.viewer);
      assert.deepEqual(key.levels, [{ level: "viewer", present: false }]);
    }
    assert.match(r.says, /outage and not a statement about the record/);
    const one = w.c.pairs({ key: "K2", viewer });
    assert.equal(byKey(one, "K2").absence.level, "viewer");
    assert.equal(byKey(one, "K1").absence.level, "not_run");
  }
});

test("R11: a key that formed nothing names the first empty rung of its ladder, each rung under the viewer gate, else its own last level", () => {
  const level = (w, key, viewer = MACHINE) => byKey(w.c.pairs({ key, viewer }), key).absence?.level ?? null;
  const ladder = (w, key) => byKey(w.c.pairs({ key, viewer: MACHINE }), key).levels.map((l) => l.level);
  const w0 = world();
  assert.deepEqual(ladder(w0, "K1"), ["viewer", "inquiry", "leg", "role", "referent"]);
  assert.deepEqual(ladder(w0, "K2"), ["viewer", "inquiry", "subject", "reading", "claim"]);
  assert.deepEqual(ladder(w0, "K3"), ["viewer", "inquiry", "reading", "claim", "referent"]);
  assert.deepEqual(ladder(w0, "K4"), ["viewer", "content", "cited", "resolution", "shared_entity"]);
  assert.deepEqual(ladder(w0, "K5"), ["viewer", "inquiry", "drawing_projects", "concluded_stances", "differing_claim"]);
  assert.deepEqual(ladder(w0, "K6"), ["viewer", "money_fact", "same_parties", "same_stage_period", "differing_amount"]);
  for (const k of ["K1", "K2", "K3", "K5"]) assert.equal(level(w0, k), "inquiry");
  assert.equal(level(w0, "K4"), "content");
  assert.equal(level(w0, "K6"), "money_fact");

  /* K1 */
  const a = world(); a.inquiry("INQ-2026-0001");
  assert.equal(level(a, "K1"), "leg");
  a.leg("INQ-2026-0001", 0, "supports", { content: null });
  assert.equal(level(a, "K1"), "role");
  a.leg("INQ-2026-0001", 1, "cuts_against", { content: null });
  assert.equal(level(a, "K1"), "referent");
  const a2 = world(); a2.inquiry("INQ-2026-0001"); a2.inquiry("INQ-2026-0002");
  a2.leg("INQ-2026-0001", 0, "supports", { content: "x" }); a2.leg("INQ-2026-0001", 1, "cuts_against", { content: null });
  a2.leg("INQ-2026-0002", 0, "supports", { content: null }); a2.leg("INQ-2026-0002", 1, "cuts_against", { content: "y" });
  assert.equal(level(a2, "K1"), "referent");
  const a3 = world(); a3.inquiry("INQ-2026-0001"); a3.inquiry("INQ-2026-0002");
  a3.leg("INQ-2026-0001", 0, "supports", { content: "x" }); a3.leg("INQ-2026-0002", 0, "cuts_against", { content: "y" });
  assert.equal(level(a3, "K1"), "role");

  /* K2 */
  const b = world(); b.inquiry("INQ-2026-0001");
  assert.equal(level(b, "K2"), "subject");
  b.inquiry("INQ-2026-0002", { subject: "E1" });
  assert.equal(level(b, "K2"), "reading");
  b.version("INQ-2026-0002", "v1", { state: "suggested" }); b.version("INQ-2026-0002", "v2", { hidden: 1 });
  assert.equal(level(b, "K2"), "reading");
  b.version("INQ-2026-0002", "v3", { claim: "" });
  assert.equal(level(b, "K2"), "claim");
  b.version("INQ-2026-0002", "v4", { claim: "held" });
  assert.equal(level(b, "K2"), "shared_subject");

  /* K3 */
  const c = world(); c.inquiry("INQ-2026-0001");
  assert.equal(level(c, "K3"), "reading");
  c.version("INQ-2026-0001", "v1", { claim: null });
  assert.equal(level(c, "K3"), "claim");
  c.version("INQ-2026-0001", "v2", { claim: "held" });
  c.versionLeg("INQ-2026-0001", "v2", 0, { target: "INQ-2026-0009", type: "inquiry" });
  assert.equal(level(c, "K3"), "referent");
  c.versionLeg("INQ-2026-0001", "v2", 1, { content: "p" });
  assert.equal(level(c, "K3"), "shared_referent");

  /* K4 */
  const d = world();
  d.content("ca", "capA", "INFO-2026-0001");
  assert.equal(level(d, "K4"), "cited");
  d.inquiry("INQ-2026-0001"); d.leg("INQ-2026-0001", 0, "supports", { content: "ca" });
  assert.equal(level(d, "K4"), "resolution");
  d.resolution("capA", "INFO-2026-0001", "E1", { established: 0 });
  assert.equal(level(d, "K4"), "resolution");
  d.resolution("capA", "INFO-2026-0001", "E2");
  assert.equal(level(d, "K4"), "shared_entity");
  d.content("cb", "capB", "INFO-2026-0002"); d.resolution("capB", "INFO-2026-0002", "E3");
  assert.equal(level(d, "K4"), "shared_entity");
  const e = k4World({ contentType: "rule", date: "2026-01-01" }, { contentType: "rule", date: "2026-01-01" });
  assert.equal(level(e, "K4"), "discriminator");

  /* K5 */
  const f = world(); f.inquiry("INQ-2026-0001");
  assert.equal(level(f, "K5"), "drawing_projects");
  f.project("PROJ-2026-0001", ["m1"]); f.project("PROJ-2026-0002", ["m1"]);
  f.draws("INQ-2026-0001", "PROJ-2026-0001", "PROJ-2026-0002");
  assert.equal(level(f, "K5"), "concluded_stances");
  f.stance("PROJ-2026-0001", "INQ-2026-0001", "the fee rose");
  assert.equal(level(f, "K5"), "differing_claim");
  f.stance("PROJ-2026-0002", "INQ-2026-0001", "the fee rose");     /* the same words: agreement, not a pair */
  assert.equal(level(f, "K5"), "differing_claim");
  f.inquiry("INQ-2026-0002"); f.stance("PROJ-2026-0001", "INQ-2026-0002", "the fee fell");
  assert.equal(level(f, "K5"), "shared_question");                  /* differing answers, never on one question */
  f.stance("PROJ-2026-0002", "INQ-2026-0002", "the fee held");
  assert.equal(level(f, "K5"), null);
  /* the K5 rungs are under the gate: a project the outsider does not take part in is not a drawing project for them */
  assert.equal(level(f, "K5", OUTSIDER), "drawing_projects");

  /* each rung under the gate: material the outsider may not see is absent at its level for the outsider */
  const g = world();
  g.inquiry("INQ-2026-0001");
  g.inquiry("PROJ-2026-0001", { project: true });
  g.leg("PROJ-2026-0001", 0, "supports", { content: null });
  g.content("ca", "capA", "PROJ-2026-0001");
  assert.equal(level(g, "K1", MEMBER), "role");
  assert.equal(level(g, "K1", OUTSIDER), "leg");
  assert.equal(level(g, "K4", MEMBER), "cited");
  assert.equal(level(g, "K4", OUTSIDER), "content");
  /* a passage cited only by a question the viewer cannot see is not cited as that viewer sees it */
  const h = world();
  h.content("ca", "capA", "INFO-2026-0001");
  h.inquiry("PROJ-2026-0001", { project: true });
  h.leg("PROJ-2026-0001", 0, "supports", { content: "ca" });
  assert.equal(level(h, "K4", MEMBER), "resolution");
  assert.equal(level(h, "K4", OUTSIDER), "cited");
  /* the shared entity is asked of documents whose passages the viewer may see */
  const s = k4World({ contentType: "rule" }, { contentType: "act" });
  s.inquiry("PROJ-2026-0002", { project: true });
  s.st.sql.exec(`UPDATE content SET bundle_id='PROJ-2026-0002' WHERE content_id='cb'`);
  s.leg("PROJ-2026-0002", 0, "supports", { content: "cb" });
  assert.equal(level(s, "K4", MEMBER), null);
  assert.equal(level(s, "K4", OUTSIDER), "shared_entity");

  /* every sentence from the one table, and no ran key answers a bare zero */
  for (const w of [w0, a, a3, b, c, d, e, f, g]) for (const viewer of [MACHINE, OUTSIDER, null]) {
    for (const k of w.c.pairs({ viewer }).keys) {
      if (k.formed === 0) {
        assert.ok(k.absence && typeof k.absence.level === "string", `${k.key} bare zero`);
        assert.equal(k.absence.says, CONTRADICTION_ABSENCE[k.absence.level]);
      } else assert.equal(k.absence, null);
    }
  }
});

test("R12: the answer states wrote false, pairs_formed, the flat pairs, judgement HELD_APART read through candidatesFor, and says; it publishes no label vocabulary", () => {
  const w = k4World({ contentType: "rule" }, { contentType: "act" });
  w.inquiry("INQ-2026-0002"); w.leg("INQ-2026-0002", 0, "supports", { content: "ca" }); w.leg("INQ-2026-0002", 1, "cuts_against", { content: "cb" });
  const r = w.c.pairs({ viewer: MACHINE });
  assert.equal(r.ok, true);
  assert.equal(r.wrote, false);
  assert.equal(r.pairs_formed, 2);
  assert.equal(r.pairs.length, 2);
  assert.deepEqual(r.pairs.map((p) => p.key).sort(), ["K1", "K4"]);
  assert.equal(r.pairs_formed, r.keys.reduce((n, k) => n + k.formed, 0));
  assert.equal(r.judgement.state, "HELD_APART");
  assert.equal(r.judgement.read, "candidatesFor");
  for (const f of ["by", "why"]) assert.equal(typeof r.judgement[f], "string");
  assert.equal(r.says, word("contradiction.says.candidate_pair_over", { formed: 2, keys: "K1, K2, K3, K4, K5, K6", undetermined_clause: "" }));
  /* no label vocabulary: no list of labels and no field naming one, anywhere in the answer */
  const walk = (v, path = []) => {
    if (Array.isArray(v)) {
      assert.ok(!v.some((x) => CONTRADICTION_LABELS.includes(x)), `a label in a list at ${path.join(".")}`);
      v.forEach((x, i) => walk(x, [...path, i]));
    } else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) {
      assert.ok(!/label/i.test(k), `a label field at ${[...path, k].join(".")}`);
      walk(x, [...path, k]);
    }
  };
  walk(r);
  /* it writes nothing */
  const before = JSON.stringify(w.rows(`SELECT * FROM contradiction_candidates`));
  w.c.pairs({ viewer: MACHINE });
  assert.equal(JSON.stringify(w.rows(`SELECT * FROM contradiction_candidates`)), before);
});

test("R18: the pairing is deterministic — the same record and viewer give the same answer — and the keys are a fixed catalogue", () => {
  const w = k4World({ contentType: "rule", date: "2026-01-01" }, { contentType: "rule", date: "2026-02-01" });
  w.inquiry("INQ-2026-0002", { subject: "E1" }); w.version("INQ-2026-0002", "v1");
  w.inquiry("INQ-2026-0003", { subject: "E1" }); w.version("INQ-2026-0003", "v1");
  w.leg("INQ-2026-0002", 0, "supports", { content: "ca" }); w.leg("INQ-2026-0002", 1, "cuts_against", { content: "cb" });
  for (const viewer of [MACHINE, MEMBER, OUTSIDER, null])
    assert.deepEqual(w.c.pairs({ viewer }), w.c.pairs({ viewer }));
  assert.deepEqual(Object.keys(CONTRADICTION_KEYS), ["K1", "K2", "K3", "K4", "K5", "K6"]);
  assert.ok(Object.isFrozen(CONTRADICTION_KEYS) && Object.values(CONTRADICTION_KEYS).every(Object.isFrozen));
});

test("R23: no place is named in the module's behaviour or outward text", () => {
  const w = k4World({ contentType: "rule" }, null);
  const texts = [JSON.stringify(w.c.pairs({ viewer: MACHINE })), JSON.stringify(w.c.pairs({ viewer: null })),
                 JSON.stringify(w.c.pairs({ key: "K9", viewer: MACHINE })), JSON.stringify(CONTRADICTION_KEYS),
                 JSON.stringify(CONTRADICTION_ABSENCE), JSON.stringify(CONTRADICTION_PAIR_CHECKS),
                 JSON.stringify(CONTRADICTION_CANDIDATE_CHECKS)];
  for (const t of texts) assert.doesNotMatch(t, /oakland|alameda|california|berkeley|san francisco|\bcounty of\b|\bcity of\b/i);
});
