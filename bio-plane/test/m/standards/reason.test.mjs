/* standards: the declarer's reason (R1, R10; DEC-88, K1025). A standard is recorded with the declaring member's own words
   on why the group holds its government to it; an adoption takes the adopting member's own, never the proposer's `why`. */
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, world, V, MACHINE, BYLAW, REASON } from "./fixture.mjs";
import { STANDARDS_CHECKS, REASON_MAX, standardsOps } from "../../../src/standards/index.mjs";
import { STANDARDS_SCHEMA } from "../../../src/standards/schema.mjs";

const codeOf = (r) => (r && r.ok === false ? r.reason : "ok");
const ROW = STANDARDS_CHECKS.STANDARD_NO_REASON;
/* A reason R1 refuses, each a negative control of the next test's admitted ones. */
const REFUSED = [["absent", undefined], ["null", null], ["a number", 7], ["a list", ["words"]], ["an object", { why: "x" }],
                 ["true", true], ["empty", ""], ["blank", "   "], ["only white space", " \n\t "],
                 ["2,001 characters", "r".repeat(REASON_MAX + 1)]];

test("R1 STANDARD_NO_REASON (C-112.20): a reason absent, not a string, blank or only white space, or over 2,000 characters is refused through its row, in R1's place (after STANDARD_NO_ISSUER, before STANDARD_NO_TEXT), with nothing written: the standard count and the next STD- id unchanged", () => {
  const w = seeded();
  const p = w.passage().contentId;
  const good = { cite: BYLAW, kind: "ordinance", issuer: "Port Ellery Selectboard", reason: REASON, text: [p],
                 author: V("bob"), viewer: V("bob") };
  const before = w.snapshot();
  for (const [what, reason] of REFUSED) {
    const call = { ...good, reason };
    if (reason === undefined) delete call.reason;
    const r = w.s.standardDeclare(call);
    assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation], [false, "STANDARD_NO_REASON", "STANDARD_NO_REASON",
                     "C-112.20", ROW.translation], what);
    assert.equal(typeof r.detail, "string", what);
    assert.equal(r.max_chars, REASON_MAX, what);
  }
  assert.deepEqual(w.snapshot(), before, "a refused declaration writes nothing, no id spent");
  assert.equal(w.count("standards"), 0);
  /* R1's order: the issuer, and every refusal before it, is asked first; the reason before the text and what follows */
  const noReason = { ...good, reason: " " };
  assert.equal(codeOf(w.s.standardDeclare({ ...noReason, issuer: "" })), "STANDARD_NO_ISSUER", "an issuer missing is still refused first");
  assert.equal(codeOf(w.s.standardDeclare({ ...noReason, kind: "opinion" })), "STANDARD_KIND_UNKNOWN");
  assert.equal(codeOf(w.s.standardDeclare({ ...noReason, cite: "" })), "STANDARD_NO_CITE");
  assert.equal(codeOf(w.s.standardDeclare({ ...noReason, author: MACHINE })), "MACHINE_CANNOT_DECLARE_STANDARD");
  assert.equal(codeOf(w.s.standardDeclare({ ...noReason, text: [] })), "STANDARD_NO_REASON", "asked before the text");
  assert.equal(codeOf(w.s.standardDeclare({ ...noReason, text: "not-held" })), "STANDARD_NO_REASON");
  assert.equal(codeOf(w.s.standardDeclare({ ...noReason, period: { from: "2020-13-01" } })), "STANDARD_NO_REASON");
  assert.equal(codeOf(w.s.standardDeclare({ ...noReason, supersedes: "STD-1999-0001-x" })), "STANDARD_NO_REASON");
  assert.equal(codeOf(w.s.standardDeclare({ ...good, text: [] })), "STANDARD_NO_TEXT", "with a reason, the text is asked next");
  assert.deepEqual(w.snapshot(), before);
  /* the negative control: the first standard recorded takes the first STD- number, so none was spent by a refusal */
  const r = w.s.standardDeclare(good);
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.match(r.id, /^STD-2026-0001-ordinance$/, "the next STD- id was unchanged by every refusal");
  assert.equal(w.count("standards"), 1);
});

test("R1 a reason is admitted up to 2,000 characters, counted as characters (not UTF-16 units), kept as the declarer wrote it, and read back with the declaration: the answer, standardRead, standardsIn and the standard's document", () => {
  const w = seeded();
  for (const reason of ["r".repeat(REASON_MAX), "é".repeat(REASON_MAX), "\u{1F3DB}".repeat(REASON_MAX), "x"])
    assert.equal(w.declare({ reason }).ok, true, `${[...reason].length} characters, ${reason.length} units`);
  assert.equal(codeOf(w.declare({ reason: "\u{1F3DB}".repeat(REASON_MAX + 1) })), "STANDARD_NO_REASON");
  const words = "  The council adopted it in 2019,\nand the permits since cite it.\n## Not a heading\n";
  const r = w.declare({ reason: words });
  assert.equal(r.ok, true);
  assert.equal(r.reason, words, "the answer carries the reason as given");
  const read = w.s.standardRead({ id: r.id, viewer: V("carol") });
  assert.equal(read.reason, words, "standardRead reads it back");
  assert.deepEqual([read.declared_by, read.declared_at], [V("bob"), r.declared_at], "with the declarer and time (R4)");
  const listed = w.s.standardsIn({ viewer: V("carol"), limit: 200 }).items.find((x) => x.id === r.id);
  assert.equal(listed.reason, words, "standardsIn carries it");
  const doc = w.record.readFile(r.id, "bundle.md").text;
  assert.match(doc, /\n## Reason\n\nThe council adopted it in 2019,\nand the permits since cite it\.\n ## Not a heading\n/,
               "the document holds it whole in its own section, a heading-like line set in");
  /* the reason is the declarer's, and each standard keeps its own */
  const other = w.declare({ reason: "A second reason.", author: V("carol"), viewer: V("carol") });
  assert.deepEqual([other.reason, w.s.standardRead({ id: r.id, viewer: V("bob") }).reason], ["A second reason.", words]);
});

test("R1 the reason reaches the act through the ops map whole, and a standard recorded before reasons were asked for answers reason null after its table is migrated forward", () => {
  const w = seeded();
  const p = w.passage().contentId;
  const url = new URL(`https://plane.test/?viewer=${encodeURIComponent(V("bob"))}`);
  const body = { cite: BYLAW, kind: "ordinance", issuer: "S", text: [p], author: V("bob") };
  assert.equal(codeOf(standardsOps(w.s, url, body).standarddeclare()), "STANDARD_NO_REASON");
  const ok = standardsOps(w.s, url, { ...body, reason: REASON }).standarddeclare();
  assert.deepEqual([ok.ok, ok.reason], [true, REASON]);
  /* a table created before the column: construction adds it and leaves earlier rows without a reason */
  const old = world({ construct: false });
  old.member("bob");
  old.member("carol");
  const before = STANDARDS_SCHEMA.replace(/,\s*reason\s+TEXT\s*\n\);/, "\n);");
  assert.notEqual(before, STANDARDS_SCHEMA, "the schema before the reason, for the migration");
  for (const t of before.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").split(";"))
    if (t.trim()) old.st.db.exec(t);
  const cols = () => old.rows(`PRAGMA table_info(standards)`).map((c) => c.name);
  assert.ok(!cols().includes("reason"));
  const s = old.build();
  assert.ok(cols().includes("reason"), "construction migrates the table forward (R16)");
  const r = s.standardDeclare({ cite: BYLAW, kind: "ordinance", issuer: "S", reason: REASON, text: old.passage().contentId,
                                author: V("bob"), viewer: V("bob") });
  assert.equal(r.reason, REASON);
  old.st.sql.exec(`UPDATE standards SET reason=NULL WHERE standard_id=?`, r.id);
  assert.equal(s.standardRead({ id: r.id, viewer: V("carol") }).reason, null, "none recorded reads null, never invented");
  s.migrate();
  assert.equal(cols().filter((c) => c === "reason").length, 1, "migrating again changes nothing");
});

test("R10 standardAdopt takes the adopting member's own reason as R1's: an adoption with the proposal's why and no reason of its own is refused STANDARD_NO_REASON and the proposal stays unadopted; a reasoned adoption lands with both the adopter's reason and the proposal's why readable", () => {
  const w = seeded();
  const text = w.passage().contentId;
  const WHY = "It governs the permits named in the act.";
  for (const proposer of [MACHINE, V("carol")]) {
    const p = w.s.standardPropose({ cite: BYLAW, kind: "ordinance", issuer: "Port Ellery Selectboard", text: [text], why: WHY,
                                    proposer }).proposal;
    assert.equal(p.why, WHY);
    const snap = w.snapshot();
    for (const [what, reason] of REFUSED) {
      const call = { proposal: p.id, author: V("bob"), viewer: V("bob"), reason };
      if (reason === undefined) delete call.reason;
      const r = w.s.standardAdopt(call);
      assert.deepEqual([r.reason, r.check, r.translation], ["STANDARD_NO_REASON", "C-112.20", ROW.translation], `${proposer}: ${what}`);
    }
    assert.deepEqual(w.snapshot(), snap, "nothing written: no standard, no adoption");
    assert.equal(w.rows(`SELECT COUNT(*) AS n FROM standard_adoptions WHERE proposal_id=?`, p.id)[0].n, 0, "the proposal still unadopted");
    /* the reasoned adoption: the adopter's reason recorded, the proposer's why answered beside it as theirs */
    const mine = `I hold the selectboard to it (${proposer}).`;
    const a = w.s.standardAdopt({ proposal: p.id, author: V("bob"), viewer: V("bob"), reason: mine });
    assert.equal(a.ok, true, JSON.stringify(a).slice(0, 300));
    assert.equal(a.reason, mine, "the adopting member's reason");
    assert.notEqual(a.reason, WHY);
    assert.deepEqual([a.proposal, a.adopted.proposal, a.adopted.why, a.adopted.why_by], [p.id, p.id, WHY, proposer],
                     "the proposal's why, the proposer's, readable beside it");
    assert.ok(!a.adopted.from_proposal.includes("reason"), "the reason is never taken from the proposal");
    const read = w.s.standardRead({ id: a.id, viewer: V("carol") });
    assert.deepEqual([read.reason, read.proposal, read.declared_by], [mine, p.id, V("bob")]);
    /* a second adoption is still refused as adopted, the proposal's state asked before the reason */
    assert.equal(w.s.standardAdopt({ proposal: p.id, author: V("carol") }).reason, "STANDARD_PROPOSAL_ADOPTED");
  }
});

test("R1 C-112.20's row: STANDARD_NO_REASON in standards' own family after C-112.19, its where naming the refusal's region in #declareRefusal, its translation in R1's terms (the member's own words, why the group holds its government to it, at most 2,000 characters); C-112.17's translation names the reason the record now holds", () => {
  assert.equal(ROW.check, "C-112.20");
  assert.equal(STANDARDS_CHECKS.STANDARD_ACT_INVALID.check, "C-112.19");
  assert.equal(ROW.where, "src/standards/index.mjs #declareRefusal > is-standard-reason");
  assert.match(ROW.translation, /your own words/);
  assert.match(ROW.translation, /why the team holds its government to it/);
  assert.match(ROW.translation, /at most 2,000 characters/);
  assert.match(ROW.translation, /Nothing was written\.$/);
  const checks = Object.values(STANDARDS_CHECKS).map((c) => c.check);
  assert.equal(new Set(checks).size, checks.length, "no check id twice");
  assert.match(STANDARDS_CHECKS.STANDARD_FIELD_UNKNOWN.translation, /citation, kind, issuer, text, period and reason, and never a view of its merit/);
  /* before the reason joined the act's fields, a caller sending it was refused as an unknown field; now it is taken */
  const w = seeded();
  const r = w.declare();
  assert.equal(r.ok, true);
  assert.equal(r.reason, REASON);
});
