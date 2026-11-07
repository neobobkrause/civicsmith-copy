/* investigation R26-R32 (T53; N1272; K4636, K5445, K5453, K5495, K5496): marking, proposing and accepting parts to
   interpret, through the module's interface over the real extraction, reading-pipeline `partsOf` and retrieval search
   (`parts-fixture.mjs`). Each test names the requirement id it checks; no test copies a sentence people read. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { world, sha } from "./parts-fixture.mjs";
import { ANN, BOB, CAT, DAN, AI, P1, P2, PH } from "./fixture.mjs";
import { MARK_PARTS_MAX, PROPOSALS_MAX, PROPOSALS_MEASURED, PLANE_VIEWER } from "../../../src/investigation/index.mjs";
import { ASSISTANT_SCREEN } from "../../../src/screens-inquiry/assistant.mjs";
import { AI_RUN_ACTIONS } from "../../../src/op-declarations/index.mjs";
import { DECLARED_OPS } from "../../../src/investigation/ops.mjs";

const pages = (from, to) => ({ kind: "pdf-page", from, to });
const rows = (sheet, from_row, to_row) => ({ kind: "sheet-range", sheet, from_row, to_row });
/* What a caller sees of every document the test held: `extraction.interpretationOf` (its R116), as the plane's own viewer, each live
   row's project, how, basis, proposal, began_from and part, in document order. */
const interpretations = (w) => w.held.flatMap((capture) => {
  const r = w.extraction.interpretationOf({ capture, viewer: PLANE_VIEWER });
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.parts.map((x) => ({ project: x.project, how: x.how, basis: x.basis, proposal: x.proposal ?? null, began_from: x.began_from ?? null, part: x.part }));
});
const SEWER = "Was the sewer fund of $4.2 million spent?";

/* A 30-page budget PDF in P1: "sewer fund" on pages 3 and 17, "$4.2 million" on page 25 (parts are runs of ten pages). */
function budget(opts) {
  const w = world(opts);
  w.ask(SEWER);
  w.budget = w.pdf(P1, "budget.pdf", 30, (i) => (i === 3 || i === 17 ? `page ${i} the sewer fund holds` : i === 25 ? `page ${i} a grant of $4.2 million` : `page ${i} roads`));
  return w;
}

/* ------------------------------------------------------------------------------------------------------------------- R26 */

test("R26: marking pages 3 to 9 of a PDF and rows 1 to 5,000 of sheet Sewer records two rows for the project, how marked", async () => {
  const w = budget();
  const sheet = w.sheet(P1, "ledger.xlsx", "Sewer", 5000, 4, (r) => `row ${r}`);
  const a = await w.inv.markForInterpretation({ project: P1, capture: w.budget.sha, parts: [pages(3, 9)], by: ANN });
  const b = await w.inv.markForInterpretation({ project: P1, capture: sheet.sha, parts: [rows("Sewer", 1, 5000)], by: BOB });
  assert.deepEqual([a.ok, b.ok], [true, true], JSON.stringify([a, b]));
  assert.deepEqual(interpretations(w).map((r) => [r.project, r.how, r.basis, r.part]),
    [[P1, "marked", "unaided", pages(3, 9)], [P1, "marked", "unaided", rows("Sewer", 1, 5000)]]);
  assert.deepEqual(a.marked.map((m) => [m.ok, m.blocks.length, m.blocks[0].next]), [[true, 1, null]]);
});

test("R26: a sheet part larger than the cell bound is taken in blocks, each recorded and listed with next", async () => {
  const w = budget();
  const sheet = w.sheet(P1, "big.xlsx", "Sewer", 12000, 4, (r) => `row ${r}`);
  const a = await w.inv.markForInterpretation({ project: P1, capture: sheet.sha, parts: [rows("Sewer", 1, 12000)], by: ANN });
  assert.equal(a.ok, true, JSON.stringify(a));
  assert.deepEqual(a.marked[0].blocks.map((b) => [b.part.from_row, b.part.to_row, b.next && b.next.from_row]),
    [[1, 5000, 5001], [5001, 10000, 10001], [10001, 12000, null]]);
  assert.equal(interpretations(w).length, 3);
});

test("R26: a call naming more than 50 parts is refused by number, nothing interpreted; 50 is taken", async () => {
  const w = budget();
  const many = Array.from({ length: MARK_PARTS_MAX + 1 }, (_, i) => pages(0, i % 30));
  const r = await w.inv.markForInterpretation({ project: P1, capture: w.budget.sha, parts: many, by: ANN });
  assert.deepEqual([r.ok, r.code, r.count, r.bound], [false, "TOO_MANY_PARTS", 51, 50]);
  assert.equal(interpretations(w).length, 0);
  assert.deepEqual(w.calls, []);
  const fifty = await w.inv.markForInterpretation({ project: P1, capture: w.budget.sha, parts: many.slice(0, MARK_PARTS_MAX), by: ANN });
  assert.equal(fifty.ok, true);
});

test("R26: refused for a machine, for a member not in the project and for a document the project does not hold; nothing is written", async () => {
  const w = budget();
  const other = w.pdf(P2, "other.pdf", 3, () => "x");
  const call = (o) => w.inv.markForInterpretation({ project: P1, capture: w.budget.sha, parts: [pages(0, 2)], by: ANN, ...o });
  assert.equal((await call({ by: AI })).code, "INVESTIGATION_MEMBER_ONLY");
  const dan = await call({ by: DAN });
  assert.equal(dan.ok, false);
  assert.equal((await call({ capture: other.sha })).code, "NO_SUCH_DOCUMENT");
  assert.equal((await call({ capture: sha("nothing held") })).code, "NO_SUCH_DOCUMENT");
  assert.equal(interpretations(w).length, 0);
});

test("R26: the whole document may be named as the parts, the member's act: every part of it is marked", async () => {
  const w = budget();
  const r = await w.inv.markForInterpretation({ project: P1, capture: w.budget.sha, parts: "whole", by: ANN });
  assert.deepEqual([r.ok, r.whole], [true, true]);
  assert.deepEqual(interpretations(w).map((x) => x.part), [pages(0, 9), pages(10, 19), pages(20, 29)]);
});

test("R26 (control): no op interprets a capture without naming parts; reading and proposing interpret nothing", async () => {
  const w = budget();
  for (const parts of [null, [], undefined])
    assert.equal((await w.inv.markForInterpretation({ project: P1, capture: w.budget.sha, parts, by: ANN })).code, "NO_PARTS_NAMED");
  w.inv.proposeParts({ project: P1, viewer: ANN });
  w.inv.interpretedFor({ project: P1, viewer: ANN });
  assert.equal(interpretations(w).length, 0);
  assert.deepEqual(w.calls, []);
});

/* ------------------------------------------------------------------------------------------------------------------- R27 */

test("R27: a project asking about the sewer fund and $4.2 million gets the parts of the budget PDF where either appears, in page order, each with its matched term", () => {
  const w = budget();
  const r = w.inv.proposeParts({ project: P1, viewer: ANN });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.proposals.map((p) => [p.capture, p.part, p.why.map((x) => [x.term, x.kind, x.unit.page])]), [
    [w.budget.sha, pages(0, 9), [["sewer fund", "word", 3]]],
    [w.budget.sha, pages(10, 19), [["sewer fund", "word", 17]]],
    [w.budget.sha, pages(20, 29), [["$4.2 million", "amount", 25]]],
  ]);
  assert.deepEqual([r.shown, r.total, r.truncated], [3, 3, undefined]);
  for (const p of r.proposals) {
    assert.deepEqual(Object.keys(p).sort(), ["capture", "id", "kind", "labelled", "machine_work", "part", "position", "why"]);
    assert.deepEqual([p.labelled, p.machine_work], ["proposal", true]);
    for (const y of p.why) assert.deepEqual(Object.keys(y).sort(), ["kind", "term", "unit"]);
    assert.match(p.id, /^PP-[0-9a-f]{16}$/);
  }
  assert.equal(interpretations(w).length, 0, "nothing is written");
});

test("R27: no field of a proposal is a score, rank or percentage; a person's name yields proposals whose why quotes the unit and nothing else", () => {
  const w = world();
  w.ask("Did Alma Ruiz approve the transfer?");
  const d = w.pdf(P1, "minutes.pdf", 10, (i) => (i === 4 ? "Alma Ruiz moved the item" : `page ${i}`));
  const r = w.inv.proposeParts({ project: P1, viewer: ANN });
  const named = r.proposals.filter((p) => p.why.some((y) => y.kind === "name"));
  assert.deepEqual(named.map((p) => [p.capture, p.part]), [[d.sha, pages(0, 9)]]);
  assert.deepEqual(named[0].why, [{ term: "Alma Ruiz", kind: "name", unit: { kind: "pdf-page", page: 4, rect: null } }]);
  const text = JSON.stringify(r.proposals);
  for (const k of ["score", "rank", "weight", "percent", "relevance", "important", "suspect", "significan", "confidence"])
    assert.ok(!text.toLowerCase().includes(k), k);
});

test("R27 (control): the same input twice answers the same; a project with no questions returns an empty list, not every part", () => {
  const w = budget();
  assert.deepEqual(w.inv.proposeParts({ project: P1, viewer: ANN }), w.inv.proposeParts({ project: P1, viewer: ANN }));
  w.drawn.set(P1, []);
  const none = w.inv.proposeParts({ project: P1, viewer: ANN });
  assert.deepEqual([none.ok, none.proposals, none.total], [true, [], 0]);
});

test("R27: at most 200 a call, truncated with shown and total; the member narrows by document; a part already live is omitted and counted", async () => {
  const w = world();
  w.ask("Where is the sewer fund?");
  const big = w.pdf(P1, "big.pdf", 2010, (i) => (i % 10 === 0 ? `page ${i} sewer fund` : `page ${i}`));
  const small = w.pdf(P1, "small.pdf", 10, (i) => (i === 2 ? "sewer fund" : "x"));
  const r = w.inv.proposeParts({ project: P1, viewer: ANN });
  assert.deepEqual([r.shown, r.total, r.truncated, r.proposals.length], [PROPOSALS_MAX, 202, true, PROPOSALS_MAX]);
  const narrow = w.inv.proposeParts({ project: P1, viewer: ANN, captures: [small.sha] });
  assert.deepEqual([narrow.total, narrow.proposals.map((p) => p.capture)], [1, [small.sha]]);
  await w.inv.markForInterpretation({ project: P1, capture: small.sha, parts: [pages(0, 9)], by: ANN });
  const after = w.inv.proposeParts({ project: P1, viewer: ANN, captures: [small.sha] });
  assert.deepEqual([after.total, after.omitted.already_interpreted], [0, 1]);
  void big;
});

test("R27: a project the viewer may not see answers as absent; only documents the viewer may see are proposed", () => {
  const w = budget();
  assert.equal(w.inv.proposeParts({ project: PH, viewer: ANN }).ok, false);
  assert.equal(w.inv.proposeParts({ project: P1, viewer: DAN }).proposals?.length ?? 0, 0);
});

/* ------------------------------------------------------------------------------------------------------------------- R28 */

/* Five proposals: a 50-page PDF, "sewer fund" on pages 3, 13, 23, 33 and 43. */
function five() {
  const w = world();
  w.ask("Where is the sewer fund?");
  w.d = w.pdf(P1, "five.pdf", 50, (i) => (i % 10 === 3 ? `page ${i} sewer fund` : `page ${i}`));
  w.five = w.inv.proposeParts({ project: P1, viewer: ANN }).proposals;
  assert.equal(w.five.length, 5);
  return w;
}

test("R28: accepting 2 of 5, one changed from pages 0 to 9 into 3 to 4, records the unchanged one accepted and pages 3 to 4 unaided with began_from", async () => {
  const w = five();
  const [p0, p1] = w.five;
  const r = await w.inv.acceptProposals({ project: P1, proposals: [{ id: p0.id, part: pages(3, 4) }, p1.id], by: ANN });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(interpretations(w).map((x) => [x.how, x.basis, x.proposal, x.began_from, x.part]), [
    ["marked", "unaided", null, p0.id, pages(3, 4)],
    ["accepted_proposal", "accepted", p1.id, null, pages(10, 19)],
  ]);
  assert.equal(w.calls.length, 2);
});

test("R28: the refused three are not in the next proposeParts for that project; asking for refused ones shows them", async () => {
  const w = five();
  const [a, b, ...rest] = w.five;
  const r = await w.inv.acceptProposals({ project: P1, proposals: [a.id, b.id, ...rest.map((p) => ({ id: p.id, refused: true }))], by: ANN });
  assert.equal(r.ok, true);
  assert.equal(interpretations(w).length, 2, "a refusal interprets nothing");
  const next = w.inv.proposeParts({ project: P1, viewer: ANN });
  assert.deepEqual([next.proposals, next.omitted.refused, next.omitted.already_interpreted], [[], 3, 2]);
  const asked = w.inv.proposeParts({ project: P1, viewer: ANN, refused: true });
  assert.deepEqual(asked.proposals.map((p) => [p.id, p.refused]), rest.map((p) => [p.id, true]));
  const kept = w.rows(`SELECT proposal_id, by_actor, at FROM inv_part_refusals ORDER BY seq`);
  assert.deepEqual(kept.map((k) => [k.proposal_id, k.by_actor]), rest.map((p) => [p.id, ANN]));
  assert.ok(kept.every((k) => /^\d{4}-\d\d-\d\dT/.test(k.at)));
});

test("R28: a proposal that no longer stands is refused PROPOSAL_NOT_STANDING and nothing is written", async () => {
  const w = five();
  const before = w.snapshot();
  const gone = await w.inv.acceptProposals({ project: P1, proposals: [w.five[0].id, "PP-0000000000000000"], by: ANN });
  assert.deepEqual([gone.ok, gone.code], [false, "PROPOSAL_NOT_STANDING"]);
  w.ask("Where is the water fund?");
  const changed = await w.inv.acceptProposals({ project: P1, proposals: [w.five[0].id], by: ANN });
  assert.deepEqual([changed.ok, changed.code], [false, "PROPOSAL_NOT_STANDING"], "the words changed, so the proposal no longer stands");
  assert.equal(interpretations(w).length, 0);
  assert.equal(w.snapshot(), before);
});

test("R28: accepting is a member's act: refused to a machine and to a member not in the project; naming none is refused", async () => {
  const w = five();
  assert.equal((await w.inv.acceptProposals({ project: P1, proposals: [w.five[0].id], by: AI })).code, "INVESTIGATION_MEMBER_ONLY");
  assert.equal((await w.inv.acceptProposals({ project: P1, proposals: [w.five[0].id], by: DAN })).ok, false);
  assert.equal((await w.inv.acceptProposals({ project: P1, proposals: [], by: ANN })).code, "NO_PARTS_NAMED");
  assert.equal(interpretations(w).length, 0);
});

test("R28 (control): nothing is interpreted by proposeParts or by leaving the list unanswered", () => {
  const w = five();
  const before = w.snapshot();
  w.inv.proposeParts({ project: P1, viewer: ANN });
  w.inv.proposeParts({ project: P1, viewer: BOB, refused: true });
  assert.equal(w.snapshot(), before);
  assert.deepEqual([interpretations(w).length, w.calls.length], [0, 0]);
});

/* ------------------------------------------------------------------------------------------------------------------- R29 */

test("R29: with the measure table empty every kind answers unavailable not_measured; the recorded table is empty", () => {
  assert.deepEqual(PROPOSALS_MEASURED, {});
  const w = budget({ measured: null });
  w.sheet(P1, "ledger.xlsx", "Sewer", 20, 3, (r) => (r === 5 ? "sewer fund" : `row ${r}`));
  const r = w.inv.proposeParts({ project: P1, viewer: ANN });
  assert.deepEqual([r.ok, r.proposals], [true, []]);
  assert.deepEqual(r.unavailable.map((u) => [u.kind, u.why]).sort(), [["pdf", "not_measured"], ["sheet", "not_measured"]]);
});

test("R29: with an entry met for sheet only, a sheet answers proposals and a PDF answers unavailable; one below the bar says so", () => {
  const met = { measured_at: "2026-11-01T00:00:00Z", corpus_digest: "c", bar_digest: "b", met: true };
  const w = budget({ measured: { sheet: met, pdf: { ...met, met: false } } });
  const s = w.sheet(P1, "ledger.xlsx", "Sewer", 20, 3, (r) => (r === 5 ? "sewer fund" : `row ${r}`));
  const r = w.inv.proposeParts({ project: P1, viewer: ANN });
  assert.deepEqual(r.proposals.map((p) => [p.capture, p.kind, p.part]), [[s.sha, "sheet", rows("Sewer", 1, 20)]]);
  assert.deepEqual(r.unavailable, [{ kind: "pdf", why: "below_bar", captures: [w.budget.sha] }]);
});

test("R29 (control): opening, citing and marking work for every kind whatever the table says", async () => {
  const w = budget({ measured: null });
  const r = await w.inv.markForInterpretation({ project: P1, capture: w.budget.sha, parts: [pages(1, 2)], by: ANN });
  assert.equal(r.ok, true);
  assert.equal(interpretations(w).length, 1);
});

/* `n` proposals answered: `accepted` accepted as offered, the rest refused. */
async function answered(n, accepted) {
  const w = world();
  w.ask("Where is the sewer fund?");
  w.pdf(P1, "long.pdf", n * 10, (i) => (i % 10 === 0 ? `page ${i} sewer fund` : `page ${i}`));
  const ps = w.inv.proposeParts({ project: P1, viewer: ANN }).proposals;
  assert.equal(ps.length, n);
  const r = await w.inv.acceptProposals({ project: P1, by: ANN,
    proposals: ps.map((p, i) => (i < accepted ? p.id : { id: p.id, refused: true })) });
  assert.equal(r.ok, true);
  return w.inv.proposalRates({});
}

test("R29: proposalRates counts offered, accepted, chosen_unaided and chose_otherwise per kind; with 30 offered and 29 accepted review_due is true, with 29 offered it is false", async () => {
  const thirty = await answered(30, 29);
  assert.deepEqual(thirty.kinds, [{ kind: "pdf", offered: 30, accepted: 29, chosen_unaided: 0, chose_otherwise: 1, review_due: true }]);
  const twentyNine = await answered(29, 28);
  assert.deepEqual(twentyNine.kinds.map((k) => [k.offered, k.review_due]), [[29, false]]);
});

test("R29 (control): proposalRates states counts only, carries no id, and a changed part counts as chosen unaided", async () => {
  const w = five();
  await w.inv.acceptProposals({ project: P1, proposals: [{ id: w.five[0].id, part: pages(3, 4) }], by: ANN });
  const r = w.inv.proposalRates({ kind: "pdf" });
  assert.deepEqual(r.kinds, [{ kind: "pdf", offered: 1, accepted: 0, chosen_unaided: 1, chose_otherwise: 0, review_due: false }]);
  assert.ok(!/PP-|INT-|PROJ-/.test(JSON.stringify(r)));
  assert.deepEqual(w.inv.proposalRates({ kind: "sheet" }).kinds, []);
  /* a proposal refused twice is counted once */
  for (let i = 0; i < 2; i++) await w.inv.acceptProposals({ project: P1, proposals: [{ id: w.five[1].id, refused: true }], by: ANN });
  assert.deepEqual(w.inv.proposalRates({ kind: "pdf" }).kinds.map((k) => [k.offered, k.chose_otherwise]), [[2, 1]]);
});

/* ------------------------------------------------------------------------------------------------------------------- R30 */

test("R30: a project with two documents, one interpreted in part, lists both, the second as none interpreted", async () => {
  const w = budget();
  const other = w.pdf(P1, "letter.pdf", 4, () => "dear council");
  await w.inv.markForInterpretation({ project: P1, capture: w.budget.sha, parts: [pages(3, 9)], by: BOB });
  const r = w.inv.interpretedFor({ project: P1, viewer: ANN });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.documents.map((d) => [d.capture, d.none_interpreted, d.interpreted.map((x) => [x.part, x.by, x.how])]), [
    [w.budget.sha, false, [[pages(3, 9), "bob-h", "marked"]]],
    [other.sha, true, []],
  ]);
  assert.ok(r.documents[0].interpreted.every((x) => /^\d{4}-\d\d-\d\dT/.test(x.at)));
  assert.deepEqual(r.documents[0].not_interpreted, [pages(0, 2), pages(10, 29)]);
});

test("R30 (control): a hidden project's list is never answered to a non-member", async () => {
  const w = budget();
  w.pdf(PH, "hidden.pdf", 3, () => "x");
  const r = w.inv.interpretedFor({ project: PH, viewer: ANN });
  assert.equal(r.ok, false);
  assert.equal(r.code ?? r.reason, "NO_SUCH_PROJECT");
  assert.equal(w.inv.interpretedFor({ project: PH, viewer: CAT }).ok, true);
});

/* ------------------------------------------------------------------------------------------------------------------- R31 */

test("R31: a viewer in Q and in P sees P's marked pages 3 to 9 with member and date; a viewer in Q only sees none of a project hidden from them", async () => {
  const w = world();
  const d = w.pdf(null, "public-budget.pdf", 12, (i) => `page ${i}`);
  assert.equal((await w.inv.markForInterpretation({ project: P1, capture: d.sha, parts: [pages(3, 9)], by: ANN })).ok, false,
    "a document the project does not hold is not marked through it");
  const viaExtraction = await w.extraction.interpretPart({ capture: d.sha, part: pages(3, 9), project: PH, how: "opened", by: CAT });
  assert.equal(viaExtraction.ok, true, JSON.stringify(viaExtraction));
  const p1 = await w.extraction.interpretPart({ capture: d.sha, part: pages(3, 9), project: P1, how: "marked", by: ANN });
  assert.equal(p1.ok, true);
  /* Bob is in P1 and P2: from P2 he is told P1's pages, Ann's handle and the date; the hidden project is not named */
  const bob = w.inv.interpretedElsewhere({ capture: d.sha, project: P2, viewer: BOB });
  assert.equal(bob.ok, true, JSON.stringify(bob));
  assert.deepEqual(bob.for_others.map((x) => [x.project, x.part, x.by]), [[P1, pages(3, 9), "ann-h"]]);
  assert.match(bob.for_others[0].at, /^\d{4}-\d\d-\d\dT/);
  assert.ok(!JSON.stringify(bob).includes(PH));
});

test("R31 (control): no row of a project the viewer may not see appears in any answer", async () => {
  const w = world();
  const d = w.pdf(null, "public.pdf", 5, () => "x");
  await w.extraction.interpretPart({ capture: d.sha, part: pages(0, 1), project: PH, how: "opened", by: CAT });
  w.participant(P2, "dan");
  const dan = w.inv.interpretedElsewhere({ capture: d.sha, project: P2, viewer: DAN });
  assert.deepEqual([dan.ok, dan.for_others], [true, []]);
  assert.ok(!JSON.stringify(dan).includes(PH));
  assert.equal(w.inv.interpretedElsewhere({ capture: d.sha, project: PH, viewer: DAN }).ok, false);
});

/* ------------------------------------------------------------------------------------------------------------------- R32 */

test("R32: the assistant screen and airunopen have no op naming interpretPart: its acts and the run's acts are none of this lane's, and a machine is refused every act that interprets", async () => {
  const lane = /interpret|acceptproposals|markfor/i;
  const screenOps = ASSISTANT_SCREEN.acts.map((a) => a.op);
  assert.ok(screenOps.includes("airunopen"), "the assistant screen opens a run");
  assert.deepEqual(screenOps.filter((op) => lane.test(op)), [], "the assistant screen offers no interpret act");
  assert.deepEqual([...AI_RUN_ACTIONS].filter((op) => lane.test(op)), [], "no act of a run, airunopen's among them, interprets");
  assert.deepEqual(Object.keys(DECLARED_OPS).filter((op) => lane.test(op)), [], "this module declares no interpret op in this release");
  const w = five();
  assert.equal((await w.inv.acceptProposals({ project: P1, proposals: [w.five[0].id], by: AI })).code, "INVESTIGATION_MEMBER_ONLY");
  assert.equal((await w.inv.markForInterpretation({ project: P1, capture: w.d.sha, parts: [pages(0, 1)], by: AI })).code, "INVESTIGATION_MEMBER_ONLY");
  /* the proposals are made by code alone: the parts lane imports no ai-*, agent-* or skills module */
  const src = readFileSync(new URL("../../../src/investigation/parts.mjs", import.meta.url), "utf8");
  assert.deepEqual([...src.matchAll(/^import .* from "([^"]+)";/gm)].map((m) => m[1]), ["../record-grammar/index.mjs"]);
  const index = readFileSync(new URL("../../../src/investigation/index.mjs", import.meta.url), "utf8");
  const imported = [...index.matchAll(/^import [\s\S]*? from "([^"]+)";/gm)].map((m) => m[1]);
  assert.deepEqual(imported.filter((f) => /\/(ai-|agent-)/.test(f)), []);
  assert.equal(interpretations(w).length, 0);
});
