/* case-import: the reads (R4), the importer's own lens (R23), with the invariants they keep: no composed strength or trust score (R10), and the
   source's bar never this group's, nor an acceptance a grade (R11). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { rowOk, seeded, imp, caseFile, V, SOURCE, CASE, LENS, SLUG, F1, F2, F3 } from "./fixture.mjs";
import { SOURCE_BAR, NO_OWN_BAR, NO_MOVE_SEEN, GROUP_FIELDS_NONE, againstBar, SOURCE_LENS, OWN_LENS, LENS_UNDETERMINED, LENS_NOT_REWEIGHED }
  from "../../../src/case-import/index.mjs";
import { importedFindingRef } from "../../../src/inquiry-grammar/index.mjs";
import { standingOf, biasApplicationsOf } from "../../../src/case-grammar/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/frontmatter.mjs";

const g = (grade) => ({ state: "graded", grade });
async function scripted(w) {
  w.script.set(F1, { role: "load_bearing", result: "recreated", pair: { capture: g("B"), connection: g("C") } });
  w.script.set(F2, { role: "supporting", result: "recreated_in_part", missing: [{ sha: "d4".repeat(32), words: "the letter" }],
                     pair: { capture: g("D"), connection: g("D") } });
  w.script.set(F3, { role: "load_bearing", result: "did_not_recreate", differs: [{ axis: "connection" }],
                     pair: { capture: g("A"), connection: { state: "undetermined" } } });
}

test("R4 importedCases lists every import with its source group, case, lens, editions and when each was imported", async () => {
  const w = seeded();
  w.clock.now = Date.parse("2026-10-03T09:00:00Z");
  const a = (await imp(w, caseFile({ edition: 1 })));
  w.clock.now = Date.parse("2026-10-04T09:00:00Z");
  (await imp(w, caseFile({ edition: 2 }), "bob"));
  const b = (await imp(w, caseFile({ group: "other-group", case: "CASE-2026-0777", lens: null })));
  const r = w.ci.importedCases({ viewer: V("bob") });
  assert.equal(r.ok, true);
  assert.equal(r.count, 2);
  const byId = Object.fromEntries(r.imports.map((i) => [i.import, i]));
  /* R19: with no watch, no move has been seen, and the answer says only that */
  const unseen = { group_fields: null, group_fields_note: GROUP_FIELDS_NONE, publisher: null, publisher_note: NO_MOVE_SEEN, last_read: null };
  /* R26: each edition also names its importer and counts its findings by the latest recreation */
  /* R35 (T53): an earlier-format document states no ungraded passages, so the count is null, never zero */
  const counted = { findings: 3, recreated: 3, recreated_in_part: 0, did_not_recreate: 0, ungraded_count: null };
  assert.deepEqual(byId[a.import], { import: a.import, group: SOURCE, case: CASE, scope: null, lens: LENS, latest_edition: 2, editions: [
    { edition: 1, imported_at: "2026-10-03T09:00:00Z", imported_by: "alice", importer: { member: "alice", handle: "h_alice" }, ...counted, ...unseen },
    { edition: 2, imported_at: "2026-10-04T09:00:00Z", imported_by: "bob", importer: { member: "bob", handle: "h_bob" }, ...counted, ...unseen }],
    watch: null, docket_entries: [] });
  assert.equal(byId[b.import].lens, null);
  assert.equal(r.wrote, false);
});

test("R4 importedCase answers the latest edition by default, each finding with its role, result, what is missing or differs, and its recomputed pair", async () => {
  const w = seeded();
  (await scripted(w));
  const a = (await imp(w, caseFile({ edition: 1 })));
  (await imp(w, caseFile({ edition: 2 })));
  const latest = w.ci.importedCase({ import: a.import, viewer: V("bob") });
  assert.equal(latest.ok, true);
  assert.equal(latest.edition.edition, 2);
  assert.deepEqual(latest.editions.map((e) => e.edition), [1, 2]);
  const first = w.ci.importedCase({ import: a.import, edition: 1, viewer: V("bob") });
  assert.equal(first.edition.edition, 1);
  const byId = Object.fromEntries(first.edition.findings.map((f) => [f.finding, f]));
  assert.deepEqual([byId[F1].role, byId[F1].result, byId[F1].missing, byId[F1].differs, byId[F1].pair],
                   ["load_bearing", "recreated", [], [], { capture: g("B"), connection: g("C") }]);
  assert.deepEqual([byId[F2].role, byId[F2].result, byId[F2].missing], ["supporting", "recreated_in_part", [{ sha: "d4".repeat(32), words: "the letter" }]]);
  assert.deepEqual([byId[F3].result, byId[F3].differs], ["did_not_recreate", [{ axis: "connection" }]]);
  assert.equal(byId[F1].ref, importedFindingRef(a.import, F1));
  assert.equal(first.wrote, false);
});

test("R4 R11 the source's bar is stated as the case states it, labeled as the source's and never as this group's", async () => {
  const w = seeded();
  const a = (await imp(w, caseFile({ bar: { capture: "A", connection: "B" } })));
  const e = w.ci.importedCase({ import: a.import, viewer: V("alice") }).edition;
  assert.equal(e.source_bar.whose, "source");
  assert.equal(e.source_bar.label, SOURCE_BAR);
  assert.equal(e.source_bar.group, SOURCE);
  assert.deepEqual(e.source_bar.bar, { capture: "A", connection: "B" });
  /* never this group's: this group's own bar is the group default, here none, whatever the source declared */
  assert.equal(e.own_bar.whose, "this_group");
  assert.equal(e.own_bar.set, false);
  assert.equal(e.own_bar.bar, null);
  for (const f of e.findings) assert.notDeepEqual(f.against_own_bar.bar, { capture: "A", connection: "B" });
});

test("R4 each finding is shown against this group's own bar, as case-checker R6 reads it: none set says so; set, each declared axis reached or not; not_asked for a supporting finding", async () => {
  const w = seeded();
  (await scripted(w));
  const a = (await imp(w));
  let e = w.ci.importedCase({ import: a.import, viewer: V("bob") }).edition;
  assert.deepEqual(e.own_bar, { whose: "this_group", group: SLUG, bar: null, set: false, stated: NO_OWN_BAR });
  const by = (ed) => Object.fromEntries(ed.findings.map((f) => [f.finding, f.against_own_bar]));
  const none = { capture: null, connection: null };
  assert.deepEqual(by(e)[F1], { meets: "no_bar", bar: none, short: [] });
  assert.deepEqual(by(e)[F2], { meets: "no_bar", bar: none, short: [] }, "with no bar, no bar is set, whatever the role");
  /* this group's default: capture C, connection C */
  w.bar({ capture: "C", connection: "C" });
  e = w.ci.importedCase({ import: a.import, viewer: V("bob") }).edition;
  assert.deepEqual(e.own_bar, { whose: "this_group", group: SLUG, bar: { capture: "C", connection: "C" }, set: true });
  assert.deepEqual(by(e)[F1], { meets: true, bar: { capture: "C", connection: "C" }, short: [] });
  assert.equal(by(e)[F2].meets, "not_asked");
  assert.deepEqual(by(e)[F3], { meets: false, bar: { capture: "C", connection: "C" }, short: ["connection"] });
  /* one axis declared */
  w.bar({ capture: "A" });
  e = w.ci.importedCase({ import: a.import, viewer: V("bob") }).edition;
  assert.deepEqual(by(e)[F1], { meets: false, bar: { capture: "A", connection: null }, short: ["capture"] });
  assert.deepEqual(by(e)[F3], { meets: true, bar: { capture: "A", connection: null }, short: [] });
  /* the reading at its interface: the same as case-grammar's standingOf, the one spelling */
  for (const [role, pair, bar] of [["load_bearing", { capture: "B", connection: "B" }, { capture: "B", connection: null }],
                                    ["load_bearing", { capture: "C" }, { capture: "B" }], ["supporting", { capture: "D" }, { capture: "A" }],
                                    ["load_bearing", { capture: "A" }, null], ["load_bearing", { capture: "A" }, { capture: null }]]) {
    const s = standingOf({ role, pair, bar });
    assert.deepEqual(againstBar(role, pair, bar), { meets: s.meets, bar: s.bar, short: s.short });
  }
});

test("R4 the origin mark facts: another group's (with the edition and whether its signature verified), the acceptance in force or none, the open flags", async () => {
  const w = seeded();
  (await scripted(w));
  const a = (await imp(w));
  let f1 = () => w.ci.importedCase({ import: a.import, viewer: V("bob") }).edition.findings.find((f) => f.finding === F1);
  assert.deepEqual(f1().origin, { another_groups: { group: SOURCE, case: CASE, edition: 1, signature_verified: true },
                                  acceptance: null, flags: [] });
  w.clock.now = Date.parse("2026-10-05T10:00:00Z");
  const acc = w.ci.acceptImported({ import: a.import, edition: 1, findings: [F1], checked: "every passage", reason: "it holds up",
                                    by: V("alice"), viewer: V("alice") });
  const ef = w.ci.flagImported({ import: a.import, edition: 1, issue: "the edition's date", by: V("bob"), viewer: V("bob") });
  const ff = w.ci.flagImported({ import: a.import, edition: 1, finding: F1, issue: "a figure", by: V("bob"), viewer: V("bob") });
  w.ci.flagImported({ import: a.import, edition: 1, finding: F2, issue: "another finding's", by: V("bob"), viewer: V("bob") });
  assert.deepEqual(f1().origin.acceptance, { acceptance: acc.acceptance, by: "alice", at: "2026-10-05T10:00:00Z", reason: "it holds up",
                                             checked: "every passage", gaps: [] });
  assert.deepEqual(f1().origin.flags.map((x) => x.flag), [ef.flag, ff.flag], "the edition's own and the finding's, not another finding's");
  assert.deepEqual(f1().origin.flags[1], { flag: ff.flag, finding: F1, issue: "a figure", by: "bob", at: "2026-10-05T10:00:00Z" });
  /* the signature, as the checker answered it */
  w.checker.signature = false;
  const b = (await imp(w, caseFile({ edition: 2 })));
  const e2 = w.ci.importedCase({ import: b.import, edition: 2, viewer: V("bob") }).edition;
  assert.equal(e2.findings[0].origin.another_groups.signature_verified, false);
  assert.equal(e2.findings[0].origin.another_groups.edition, 2);
  assert.equal(e2.findings.find((f) => f.finding === F1).origin.acceptance, null, "a later edition reads as another group's until accepted");
});

test("R4 the statement that recreating shows the case intact and consistent, not true, is the checker's", async () => {
  const w = seeded();
  w.checker.statement = "The checker's own sentence.";
  const a = (await imp(w));
  assert.equal(w.ci.importedCase({ import: a.import, viewer: V("alice") }).edition.statement, "The checker's own sentence.");
});

test("R4 a viewer who is not an active member is answered as if no import exists, with the same bytes; it writes nothing", async () => {
  const w = seeded();
  const a = (await imp(w));
  const before = w.snapshot();
  const none = w.ci.importedCases({ viewer: V("nobody") });
  for (const v of [V("carol"), V("dave"), "class:ai", "token:operator", null, ""])
    assert.equal(JSON.stringify(w.ci.importedCases({ viewer: v })), JSON.stringify(none), String(v));
  const empty = seeded();
  assert.equal(JSON.stringify(empty.ci.importedCases({ viewer: V("alice") })), JSON.stringify(none), "the same bytes as no import");
  const absent = w.ci.importedCase({ import: "f".repeat(64), viewer: V("alice") });
  (await rowOk(absent, "IMPORT_NO_SUCH_EDITION"));
  for (const v of [V("carol"), V("dave"), "class:ai", null])
    assert.equal(JSON.stringify(w.ci.importedCase({ import: "f".repeat(64), viewer: v })), JSON.stringify(absent));
  /* the held import, asked by a non-member, answers exactly as an import never held with the same arguments */
  const unseen = w.ci.importedCase({ import: a.import, edition: 1, viewer: V("carol") });
  assert.equal(JSON.stringify(unseen), JSON.stringify(empty.ci.importedCase({ import: a.import, edition: 1, viewer: V("alice") })));
  (await rowOk(w.ci.importedCase({ import: a.import, edition: 7, viewer: V("alice") }), "IMPORT_NO_SUCH_EDITION"));
  assert.deepEqual(w.snapshot(), before, "reads write nothing");
  /* the control: a member sees it */
  assert.equal(w.ci.importedCase({ import: a.import, viewer: V("alice") }).ok, true);
});

test("R10 no answer composes a case-level strength or a trust score; origin marks are never composed with grades", async () => {
  const w = seeded();
  (await scripted(w));
  w.bar({ capture: "C", connection: "C" });
  const a = (await imp(w));
  w.ci.acceptImported({ import: a.import, edition: 1, findings: [F1], checked: "c", reason: "r", by: V("alice"), viewer: V("alice") });
  w.ci.flagImported({ import: a.import, edition: 1, issue: "i", by: V("alice"), viewer: V("alice") });
  const banned = new Set(["strength", "score", "trust", "trust_score", "overall", "composed", "rating", "case_strength", "verdict"]);
  const walk = (v, path) => {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}[${i}]`));
    if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { assert.ok(!banned.has(k), `${path}.${k}`); walk(x, `${path}.${k}`); }
  };
  const answers = [a, w.ci.importedCases({ viewer: V("alice") }), w.ci.importedCase({ import: a.import, viewer: V("alice") }),
                   w.ci.acceptanceOf({ import: a.import, edition: 1, finding: F1 }), w.ci.openFlagsOn({ import: a.import, edition: 1 }),
                   w.ci.findingFacts({ ref: importedFindingRef(a.import, F1), edition: 1 })];
  answers.forEach((x, i) => walk(x, `answer${i}`));
  /* the pair stays per axis; the origin facts sit beside it, not inside it */
  const f = answers[2].edition.findings.find((x) => x.finding === F1);
  assert.deepEqual(Object.keys(f.pair).sort(), ["capture", "connection"]);
  for (const k of ["another_groups", "acceptance", "flags"]) assert.ok(!(k in f.pair));
});

test("R11 an acceptance changes no grade: the recorded results and pairs, and the published pair, read the same before and after", async () => {
  const w = seeded();
  (await scripted(w));
  const a = (await imp(w));
  const ref = importedFindingRef(a.import, F1);
  const grades = () => {
    const e = w.ci.importedCase({ import: a.import, viewer: V("alice") }).edition;
    return { e: e.findings.map(({ finding, result, pair, missing, differs }) => ({ finding, result, pair, missing, differs })),
             p: w.ci.findingFacts({ ref, edition: 1 }).pair };
  };
  const before = grades();
  const acc = w.ci.acceptImported({ import: a.import, edition: 1, findings: [F1], checked: "c", reason: "r", by: V("alice"), viewer: V("alice") });
  assert.match(acc.grades, /unchanged/);
  assert.deepEqual(grades(), before);
  w.ci.withdrawAcceptance({ import: a.import, edition: 1, reason: "r", by: V("alice"), viewer: V("alice") });
  assert.deepEqual(grades(), before);
});

/* ================================================================ R23 (D59, D62; K2471): the importer's own lens */

const S1 = "scrutiny-official-statements", S2 = "inference-shell-companies", S3 = "pattern-late-filings";
/* The case document's `bias_applications:` block (`case-grammar` R24), each row as its reader answers it: F1 rests on two
   lowered grades at its legs (S1, S2), F2 on an inference refused at its conclusion (S3). The re-weighing stand-in
   restores a reversed `grade_lowered`'s capture to `from` (fixture.mjs). */
const APPS = [
  { finding: F1, ord: 0, target: "leg", statement: S1, effect: "grade_lowered", from: "B", to: "C" },
  { finding: F1, ord: 1, target: "leg", statement: S2, effect: "grade_lowered", from: "A", to: "B" },
  { finding: F2, ord: null, target: "conclusion", statement: S3, effect: "inference_refused", from: null, to: null },
];
const withApps = (x = {}) => caseFile({ apps: APPS, ...x });

test("R23 each finding is answered under this group's own lens: its statements in force (bias.statementInForce, scope instance, the reading member as viewer), the carried applications of them applied, the rest read as removed; beside the source's lens and this group's bar", async () => {
  const w = seeded();
  (await scripted(w));
  w.lens.inForce.set(S1, true).set(S2, false).set(S3, null);
  w.bar({ capture: "B", connection: "B" });
  const a = (await imp(w, withApps()));
  const e = w.ci.importedCase({ import: a.import, viewer: V("bob") }).edition;
  /* each statement the edition applies asked once, at scope instance, with the reading member as viewer */
  assert.deepEqual(w.lens.asked, [S2, S3, S1].sort().map((statement) => ({ statement, scope: "instance", viewer: V("bob") })));
  /* the reader lens names the statements in force (so their carried applications stand), and no application twice */
  assert.deepEqual(w.lens.reweighed.at(-1).lens, { statements: [S1], applications: [] });
  assert.deepEqual(w.lens.reweighed.at(-1).parts, 1, "re-weighed over the edition's parts");
  const by = Object.fromEntries(e.findings.map((f) => [f.finding, f]));
  /* F1: S1 applied, S2 not in force so its lowering reads as removed: capture restored to A */
  assert.deepEqual(by[F1].own_lens, { whose: "this_group", applications: { in_force: [APPS[0]], removed: [APPS[1]], undetermined: [] },
    determined: true, pair: { capture: g("A"), connection: g("C") }, bar_met: "not_asked",
    against_own_bar: { meets: false, bar: { capture: "B", connection: "B" }, short: ["connection"] }, changed_by: [S2],
    lens_changes: [{ ...APPS[1], how: "reversed" }] });
  /* beside it, unchanged: the source's lens (the recorded pair) and this group's bar over it */
  assert.deepEqual(by[F1].pair, { capture: g("B"), connection: g("C") });
  assert.deepEqual(by[F1].against_own_bar, { meets: false, bar: { capture: "B", connection: "B" }, short: ["connection"] });
  /* F2: S3 undetermined, stated and never read as false: no pair and no bar_met under this lens */
  assert.deepEqual(by[F2].own_lens, { whose: "this_group", applications: { in_force: [], removed: [], undetermined: [APPS[2]] },
    determined: false, stated: LENS_UNDETERMINED, pair: null, bar_met: null, against_own_bar: null, changed_by: [], lens_changes: [] });
  assert.notEqual(by[F2].own_lens.bar_met, false);
  /* F3: no application, re-weighed to its recorded pair */
  assert.deepEqual([by[F3].own_lens.determined, by[F3].own_lens.pair, by[F3].own_lens.changed_by], [true, by[F3].pair, []]);
  /* the edition: the two lenses side by side, labeled, with the limit the checker states */
  assert.deepEqual(e.source_lens, { whose: "source", label: SOURCE_LENS, group: SOURCE, statements_sha: LENS });
  assert.equal(e.own_lens.label, OWN_LENS);
  assert.equal(e.own_lens.scope, "instance");
  assert.equal(e.own_lens.statements_sha, w.lens.sha);
  assert.equal(e.own_lens.limit, "The checker's limit.");
  assert.equal(e.own_lens.determined, false, "one statement undetermined");
  assert.equal(e.own_lens.stated, LENS_UNDETERMINED);
  assert.deepEqual(e.own_lens.statements.map((x) => [x.statement, x.in_force]), [[S2, false], [S3, null], [S1, true]], "in statement order");
  /* the negative control: with S2 in force too, nothing reads as removed and F1 stands as published */
  w.lens.inForce.set(S2, true).set(S3, true);
  const again = w.ci.importedCase({ import: a.import, viewer: V("bob") }).edition;
  const f1 = again.findings.find((f) => f.finding === F1).own_lens;
  assert.deepEqual([f1.applications.removed, f1.pair, f1.changed_by], [[], { capture: g("B"), connection: g("C") }, []]);
  assert.equal(again.own_lens.determined, true);
  assert.equal(again.findings.find((f) => f.finding === F2).own_lens.determined, true);
  /* and with none in force, every carried application reads as removed */
  w.lens.inForce.clear();
  const removed = w.ci.importedCase({ import: a.import, viewer: V("bob") }).edition.findings.find((f) => f.finding === F1).own_lens;
  assert.deepEqual([removed.applications.removed, removed.changed_by], [[APPS[0], APPS[1]], [S1, S2]]);
  assert.deepEqual(w.lens.reweighed.at(-1).lens, { statements: [], applications: [] });
});

test("R23 the lens is the reading member's, read afresh each time; the assessment changes nothing: the acceptance, the published pair and the recorded results stand, and the read writes nothing", async () => {
  const w = seeded();
  (await scripted(w));
  const a = (await imp(w, withApps()));
  const ref = importedFindingRef(a.import, F1);
  w.ci.acceptImported({ import: a.import, edition: 1, findings: [F1], checked: "c", reason: "r", by: V("alice"), viewer: V("alice") });
  const facts = w.ci.findingFacts({ ref, edition: 1 });
  const before = w.snapshot();
  w.ci.importedCase({ import: a.import, viewer: V("alice") });
  assert.ok(w.lens.asked.every((x) => x.viewer === V("alice")), "the reading member is the viewer");
  /* an adoption after the import: the next read is under the lens now in force */
  w.lens.inForce.set(S2, true);
  const e = w.ci.importedCase({ import: a.import, viewer: V("bob") }).edition;
  assert.deepEqual(e.findings.find((f) => f.finding === F1).own_lens.applications.in_force, [APPS[1]]);
  assert.deepEqual(w.snapshot(), before, "the reads write nothing");
  /* never stronger than its edition: the accepted finding's facts read as before, its acceptance unchanged */
  assert.deepEqual(w.ci.findingFacts({ ref, edition: 1 }), facts);
  const f1 = e.findings.find((f) => f.finding === F1);
  assert.deepEqual(f1.pair, { capture: g("B"), connection: g("C") });
  assert.equal(f1.origin.another_groups.group, SOURCE, "still marked as another team's");
  assert.equal(f1.origin.acceptance.reason, "r");
});

test("R23 a re-weighing that cannot be made is stated, never read as false", async () => {
  const w = seeded();
  (await scripted(w));
  w.lens.inForce.set(S1, true);
  const a = (await imp(w, withApps()));
  w.lens.throws = true;
  const e = w.ci.importedCase({ import: a.import, viewer: V("bob") }).edition;
  for (const f of e.findings.filter((x) => x.finding !== F2)) {
    assert.equal(f.own_lens.determined, false);
    assert.ok(f.own_lens.stated.startsWith(LENS_NOT_REWEIGHED), f.own_lens.stated);
    assert.equal(f.own_lens.bar_met, null);
  }
  assert.equal(e.own_lens.determined, false);
  /* the control: the same read, re-weighed */
  w.lens.throws = false;
  assert.equal(w.ci.importedCase({ import: a.import, viewer: V("bob") }).edition.own_lens.statements_sha, w.lens.sha);
  /* an answer that is a promise is no synchronous re-weighing: stated, as a throw is */
  w.lens.async = true;
  const p = w.ci.importedCase({ import: a.import, viewer: V("bob") }).edition;
  assert.equal(p.own_lens.stated, LENS_NOT_REWEIGHED);
  assert.equal(p.findings.find((f) => f.finding === F1).own_lens.bar_met, null);
});

test("R23 the applications are case-grammar's reading of the case document (its R24): every row the block carries, in its order; an edition without the block applies nothing, and no statement is asked", async () => {
  const w = seeded();
  (await scripted(w));
  w.lens.inForce.set(S1, true).set(S2, true).set(S3, true);
  const a = (await imp(w, withApps()));
  const doc = w.ci.fileOf({ import: a.import, edition: 1, path: caseFile().files.find((f) => f.kind === "case_document").path });
  const carried = biasApplicationsOf(parseFrontmatter(new TextDecoder().decode(doc.bytes)).data);
  assert.deepEqual(carried, APPS, "the block as written, read back by case-grammar");
  const e = w.ci.importedCase({ import: a.import, viewer: V("bob") }).edition;
  assert.deepEqual(e.findings.flatMap((f) => f.own_lens.applications.in_force), carried, "every carried row, each under its finding");
  assert.deepEqual(w.lens.reweighed.at(-1).lens, { statements: [S1, S2, S3].sort(), applications: [] });
  /* the negative control: edition 2 carries no block; nothing applied, nothing asked of bias, every finding re-weighed as recorded */
  (await imp(w, caseFile({ edition: 2 })));
  const asked = w.lens.asked.length;
  const e2 = w.ci.importedCase({ import: a.import, edition: 2, viewer: V("bob") }).edition;
  assert.equal(w.lens.asked.length, asked);
  assert.deepEqual(w.lens.reweighed.at(-1).lens, { statements: [], applications: [] });
  for (const f of e2.findings) {
    assert.deepEqual(f.own_lens.applications, { in_force: [], removed: [], undetermined: [] });
    assert.equal(f.own_lens.determined, true);
    assert.deepEqual(f.own_lens.pair, f.pair);
  }
  assert.deepEqual(e2.own_lens.statements, []);
});
