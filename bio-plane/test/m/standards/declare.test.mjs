/* standards: declaring a standard (R1–R4, R6). */
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, world, V, MACHINE, BYLAW, UNKNOWN_CITE, TEST_PROFILE, REASON, profile, src } from "./fixture.mjs";
import { STANDARDS_CHECKS, STANDARD_KINDS } from "../../../src/standards/index.mjs";

const codeOf = (r) => (r && r.ok === false ? r.reason : "ok");

test("R1 refusals in order, each with a negative control: MACHINE_CANNOT_DECLARE_STANDARD (R1's MACHINE_CANNOT_DECLARE), STANDARD_NO_CITE, STANDARD_KIND_UNKNOWN, STANDARD_NO_ISSUER, STANDARD_NO_REASON, STANDARD_NO_TEXT, STANDARD_TEXT_UNRESOLVED, STANDARD_PERIOD_INVALID, STANDARD_SUPERSEDES_UNKNOWN; each carries its row, and nothing is written", () => {
  const w = seeded();
  const p = w.passage().contentId;
  const good = { cite: BYLAW, kind: "ordinance", issuer: "Port Ellery Selectboard", reason: REASON, text: [p],
                 period: { from: "2020-01-01", to: null }, author: V("bob"), viewer: V("bob") };
  /* every condition broken at once: the first in R1's order answers, then each fixed in turn reveals the next */
  const bad = { cite: "", kind: "opinion", issuer: " ", reason: "  ", text: [], period: { from: "2020-13-01" }, supersedes: "STD-1999-0001-x",
                author: MACHINE, viewer: V("bob") };
  const order = [["author", "MACHINE_CANNOT_DECLARE_STANDARD"], ["cite", "STANDARD_NO_CITE"], ["kind", "STANDARD_KIND_UNKNOWN"],
                 ["issuer", "STANDARD_NO_ISSUER"], ["reason", "STANDARD_NO_REASON"], ["text", "STANDARD_NO_TEXT"], ["text2", "STANDARD_TEXT_UNRESOLVED"],
                 ["period", "STANDARD_PERIOD_INVALID"], ["supersedes", "STANDARD_SUPERSEDES_UNKNOWN"]];
  const before = w.snapshot();
  const call = { ...bad };
  for (const [field, code] of order) {
    const r = w.s.standardDeclare(call);
    assert.equal(codeOf(r), code, `${field}: expected ${code}`);
    assert.equal(r.check, STANDARDS_CHECKS[code].check);
    assert.equal(r.translation, STANDARDS_CHECKS[code].translation);
    assert.ok(r.detail);
    if (field === "text") { call.text = ["f".repeat(64)]; continue; }
    if (field === "text2") { call.text = good.text; continue; }
    call[field] = good[field];
  }
  assert.deepEqual(w.snapshot(), before, "a refused declaration writes nothing");
  delete call.supersedes;
  assert.equal(w.s.standardDeclare(call).ok, true, "the negative control: every field good, it is recorded");
  /* each condition's edges */
  assert.equal(codeOf(w.s.standardDeclare({ ...good, author: "" })), "MACHINE_CANNOT_DECLARE_STANDARD", "an empty author");
  assert.equal(codeOf(w.s.standardDeclare({ ...good, author: "class:daemon" })), "MACHINE_CANNOT_DECLARE_STANDARD");
  assert.equal(codeOf(w.s.standardDeclare({ ...good, cite: "x".repeat(201) })), "STANDARD_NO_CITE", "over 200 characters");
  assert.equal(w.s.standardDeclare({ ...good, cite: "x".repeat(200) }).ok, true, "200 characters is admitted");
  for (const kind of STANDARD_KINDS) assert.equal(w.s.standardDeclare({ ...good, kind }).ok, true, kind);
  assert.equal(codeOf(w.s.standardDeclare({ ...good, text: "not-held" })), "STANDARD_TEXT_UNRESOLVED");
  assert.equal(w.s.standardDeclare({ ...good, text: "not-held" }).content_id, "not-held", "names the id");
  for (const period of [{ from: "2020-02-30" }, { from: "2021-01-01", to: "2020-12-31" }, { to: "2020/01/01" }, "2020", { since: "2020-01-01" }])
    assert.equal(codeOf(w.s.standardDeclare({ ...good, period })), "STANDARD_PERIOD_INVALID", JSON.stringify(period));
  for (const period of [undefined, null, {}, { from: null, to: null }, { from: "2020-01-01", to: "2020-01-01" }])
    assert.equal(w.s.standardDeclare({ ...good, period }).ok, true, JSON.stringify(period));
});

test("R2 a standard's text is one or more content ids of captured passages, kept in order; none is refused and no standard is held without a capture of its text", () => {
  const w = seeded();
  const a = w.passage().contentId, b = w.passage().contentId;
  const one = w.declare({ text: a });
  assert.deepEqual(one.text, [a], "a single content id");
  const two = w.declare({ text: [b, a, b] });
  assert.deepEqual(two.text, [b, a], "several, in order, a repeat kept once");
  for (const text of [undefined, null, [], "", [" "], [1]])
    assert.equal(codeOf(w.declare({ text })), "STANDARD_NO_TEXT", JSON.stringify(text));
  /* a passage of a document the viewer may not see is not held for that viewer (one answer) */
  const P = w.project("Private work", "alice");
  const hidden = w.passage();
  w.st.sql.exec(`UPDATE content SET bundle_id=? WHERE content_id=?`, P, hidden.contentId);
  assert.equal(codeOf(w.declare({ text: hidden.contentId, viewer: V("bob") })), "STANDARD_TEXT_UNRESOLVED");
  assert.equal(w.declare({ text: hidden.contentId, viewer: V("alice"), author: V("alice") }).ok, true, "its participant may");
  assert.equal(w.count("standards"), 3);
});

test("R3 the citation is matched against the active profiles' standard_sources: the first match gives source, kind, issuer, level, profile and basis; no match, no active profile or profiles that disagree give undetermined with why, and the standard is still held; a declared kind or issuer that differs is kept and the difference stated", () => {
  {
    const w = seeded();
    const r = w.declare();
    assert.deepEqual(r.source, { state: "matched", source: "Port Ellery Bylaws", kind: "ordinance",
                                 issuer: "Port Ellery Selectboard", level: "city", profile: TEST_PROFILE, basis: "TEST" });
    const c = w.declare({ cite: "MCBC 2024-7", kind: "commitment", issuer: "Marlow County Commission" });
    assert.equal(c.source.source, "Marlow County Budget Commitments");
    assert.equal(c.source.level, "county");
    const u = w.declare({ cite: UNKNOWN_CITE });
    assert.equal(u.ok, true, "an unmatched citation is still held");
    assert.equal(u.source.state, "undetermined");
    assert.match(u.source.why, /matches the citation form of no source/);
    /* declared kind and issuer differ from the match: kept as declared, the difference beside it */
    const d = w.declare({ kind: "statute", issuer: "Someone Else" });
    assert.deepEqual([d.kind, d.issuer], ["statute", "Someone Else"]);
    assert.deepEqual([d.source.kind, d.source.issuer], ["ordinance", "Port Ellery Selectboard"]);
    assert.deepEqual(d.source.differs.map((x) => [x.field, x.declared, x.source]),
                     [["kind", "statute", "ordinance"], ["issuer", "Someone Else", "Port Ellery Selectboard"]]);
    assert.equal(w.declare().source.differs, undefined, "no difference, none stated");
  }
  {
    const w = seeded({ profiles: null });
    const r = w.declare();
    assert.equal(r.ok, true);
    assert.equal(r.source.state, "undetermined");
    assert.match(r.source.why, /no active jurisdiction profile/);
  }
  {
    const w = seeded({ profiles: ["no-such-profile"] });
    const r = w.declare();
    assert.equal(r.source.state, "undetermined", "profiles that cannot be combined supply nothing");
    assert.match(r.source.why, /UNKNOWN_PROFILE/);
  }
  {
    /* two profiles whose sources both match the citation and disagree: none is chosen */
    const a = profile("pa", [src("Act A", "\\bSEC\\s+\\d+")]), b = profile("pb", [src("Act B", "\\bSEC\\s+\\d+", { level: "county" })]);
    const w = seeded({ profiles: ["pa", "pb"], written: [a, b] });
    const r = w.declare({ cite: "SEC 4" });
    assert.equal(r.ok, true);
    assert.equal(r.source.state, "undetermined");
    assert.match(r.source.why, /disagree/);
    assert.deepEqual(r.source.disagreeing.map((e) => [e.profile, e.source, e.level]), [["pa", "Act A", "state"], ["pb", "Act B", "county"]]);
    /* two profiles that agree: the entry is one, and matched */
    const c = profile("pc", [src("Act A", "\\bSEC\\s+\\d+")]);
    const w2 = seeded({ profiles: ["pa", "pc"], written: [a, c] });
    const m = w2.declare({ cite: "SEC 4" });
    assert.deepEqual([m.source.state, m.source.source, m.source.profile], ["matched", "Act A", "pa"]);
    /* two matches in one profile: its own order, the first */
    const d = profile("pd", [src("Act D1", "\\bSEC\\b"), src("Act D2", "\\bSEC\\s+\\d+")]);
    const w3 = seeded({ profiles: ["pd"], written: [d] });
    assert.equal(w3.declare({ cite: "SEC 4" }).source.source, "Act D1");
  }
  {
    /* a matched entry that states no level (a profile jurisdictions validates always states one, so the provider here
       answers the view directly): level undetermined beside the match (K108 (5), K171), never a default */
    const noLevel = { ...src("Act N", "\\bNSEC\\s+\\d+"), profile: "pn" };
    delete noLevel.level;
    const w = seeded({ profiles: ["pn"], combine: () => ({ ok: true, view: { standard_sources: [noLevel] } }) });
    const r = w.declare({ cite: "NSEC 4" });
    assert.deepEqual([r.source.state, r.source.source, r.source.level, r.source.profile, typeof r.source.level_why],
                     ["matched", "Act N", "undetermined", "pn", "string"], JSON.stringify(r.source));
  }
  {
    /* a profile listing no source */
    const w = seeded({ profiles: ["pe"], written: [profile("pe", [])] });
    assert.match(w.declare().source.why, /list no source/);
  }
});

test("R4 the answer and every later read carry who declared it and when, by this module's clock, and the declaration is never edited: a correction is a new standard that supersedes it", () => {
  const w = seeded();
  w.clock.now = "2026-10-02T09:30:15.250Z";
  const r = w.declare();
  assert.deepEqual([r.declared_by, r.declared_at], [V("bob"), "2026-10-02T09:30:15Z"]);
  w.clock.now = "2026-10-05T00:00:00.000Z";
  const read = w.s.standardRead({ id: r.id, viewer: V("carol") });
  assert.deepEqual([read.declared_by, read.declared_at], [V("bob"), "2026-10-02T09:30:15Z"]);
  const listed = w.s.standardsIn({ viewer: V("carol") }).items[0];
  assert.deepEqual([listed.declared_by, listed.declared_at], [V("bob"), "2026-10-02T09:30:15Z"]);
  /* a correction is a new standard; the first is unchanged */
  const before = w.s.standardRead({ id: r.id, viewer: V("carol") });
  const fix = w.declare({ cite: "PEBL § 12(a)", supersedes: r.id, author: V("carol"), viewer: V("carol") });
  assert.equal(fix.ok, true);
  assert.notEqual(fix.id, r.id);
  const after = w.s.standardRead({ id: r.id, viewer: V("carol") });
  assert.deepEqual({ ...after, superseded_by: null, texts: null }, { ...before, superseded_by: null, texts: null });
  /* no service edits a standard (R11 refuses the raw revision) */
  const head = w.record.head(r.id);
  const text = w.record.readFile(r.id, "bundle.md").text.replace("PEBL § 12", "PEBL § 13");
  assert.equal(w.promotion.promote({ bundleId: r.id, base: head.bundleSha, snapKey: "edit", author: V("bob"),
                                     files: [{ path: "bundle.md", text }], meta: {} }).reason, "STANDARD_WRITTEN_ELSEWHERE");
});

test("R6 supersedes names an earlier standard: the earlier stays readable and both reads name the link; a standard is superseded by at most one, a second refused STANDARD_ALREADY_SUPERSEDED naming the first", () => {
  const w = seeded();
  const old = w.declare();
  const next = w.declare({ supersedes: old.id });
  assert.equal(next.supersedes, old.id);
  const oldRead = w.s.standardRead({ id: old.id, viewer: V("carol") });
  assert.equal(oldRead.ok, true, "the earlier stays readable");
  assert.deepEqual([oldRead.supersedes, oldRead.superseded_by], [null, next.id]);
  const nextRead = w.s.standardRead({ id: next.id, viewer: V("carol") });
  assert.deepEqual([nextRead.supersedes, nextRead.superseded_by], [old.id, null]);
  const text = w.passage().contentId;
  const before = w.snapshot();
  const again = w.declare({ supersedes: old.id, text });
  assert.equal(again.reason, "STANDARD_ALREADY_SUPERSEDED");
  assert.equal(again.superseded_by, next.id, "names the first");
  assert.equal(again.check, STANDARDS_CHECKS.STANDARD_ALREADY_SUPERSEDED.check);
  assert.deepEqual(w.snapshot(), before);
  /* the later one may be superseded in turn */
  const third = w.declare({ supersedes: next.id });
  assert.equal(third.ok, true);
  assert.equal(w.s.standardRead({ id: next.id, viewer: V("carol") }).superseded_by, third.id);
  assert.equal(w.declare({ supersedes: "" }).supersedes, null, "an empty supersedes names none");
});

test("R1 R12 the refusals hold in a world with no active profile too (the kinds are jurisdictions' own seven, STANDARD_SOURCE_KINDS, standard included)", () => {
  const w = world({ profiles: null });
  w.member("bob");
  assert.deepEqual(STANDARD_KINDS, ["statute", "regulation", "ordinance", "court", "policy", "commitment", "standard"]);
  assert.equal(codeOf(w.declare({ kind: "guideline" })), "STANDARD_KIND_UNKNOWN");
  assert.equal(w.declare().ok, true);
});
