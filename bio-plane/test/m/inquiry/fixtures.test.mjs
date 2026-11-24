/* inquiry's published fixtures (fixtures.mjs): each is called here and its real answer checked (K4990). */
import test from "node:test";
import assert from "node:assert/strict";
import { basisForUnread, basisRefusals, datedWaitOf, disposeAct, divideAnswers, groundAnswers, migratedSurfacing,
         questionWaitsNone, questionWaitsSetAside, readRefusals } from "./fixtures.mjs";
import { INQUIRY_GRAMMAR_CHECKS } from "../../../src/inquiry-grammar/index.mjs";
import { selectionResolve } from "../retrieval/fixtures.mjs";
import { word } from "../../../src/setup-words/index.mjs";

test("R16: basisForUnread answers the real basis read for no question (NO_ID) and for one the record does not hold (resting on nothing)", () => {
  const f = basisForUnread();
  assert.deepEqual([f.noId.ok, f.noId.reason], [false, "NO_ID"]);
  assert.deepEqual([f.unheld.ok, f.unheld.legs], [true, []]);
  assert.equal(f.unheld.bundleId, f.unheldId);
  assert.deepEqual(f.inquiry.basisFor(""), f.noId, "the fixture's inquiry is the real one: it answers again as it did");
});

test("R11 R62: basisRefusals answers each refusal of a real promote of a bad basis, with its check, and nothing written", () => {
  const f = basisRefusals();
  assert.deepEqual([f.basisRefused.ok, f.basisRefused.reason], [false, "BASIS_REFUSED"]);
  assert.ok(f.basisRefused.findings.length >= 1 && f.basisRefused.findings.every((x) => x.check && x.detail));
  assert.deepEqual([f.selfBasis.reason, f.selfBasis.check, f.selfBasis.path], ["SELF_BASIS", "C-33.22", [f.question, f.question]]);
  assert.ok(f.selfBasis.translation);
  assert.deepEqual([f.basisCycle.reason, f.basisCycle.check], ["BASIS_CYCLE", "C-33.23"]);
  assert.equal(f.basisCycle.path[0], f.cycleQuestion);
  assert.equal(f.basisCycle.path.at(-1), f.cycleQuestion, "the path closes on the question being written");
  assert.ok(f.basisCycle.path.length >= 3);
  assert.deepEqual([f.machinePassageUnchecked.ok, f.machinePassageUnchecked.reason, f.machinePassageUnchecked.code, f.machinePassageUnchecked.check],
    [false, "MACHINE_PASSAGE_UNCHECKED", "MACHINE_PASSAGE_UNCHECKED", "C-2.20"]);
  assert.ok(f.machinePassageUnchecked.translation && f.machinePassageUnchecked.detail);
  assert.equal(f.world.record.head(f.question), null, "the refused writes left nothing");
  assert.equal(f.machineWorld.record.head(f.question), null);
});

test("R20 R21 R22: disposeAct answers the real dispose over a real selection: done, an unknown selection, another owner's", async () => {
  const f = disposeAct();
  assert.deepEqual([f.done.ok, f.done.to, f.done.reason, f.done.handle, f.done.disposed], [true, "deferred", "later", "pair", f.ids]);
  assert.deepEqual(f.unknownSelection.reason, "NO_SUCH_SELECTION");
  /* retrieval publishes the refusal another owner's selection gets (R99): its real answer to a viewer other than the owner */
  const retrieval = selectionResolve();
  const handle = await retrieval.selection(["INFO-001"], "o");
  assert.equal(f.notYours.reason, retrieval.resolve({ handle, owner: "someone-else" }).reason);
  for (const id of f.ids) assert.equal(f.world.fm(id).current_state, "deferred", `${id} moved through the promotion`);
  /* control: the act asked again over the set it moved is the real refusal, the set having moved */
  assert.equal(f.dispose().ok, false);
  const dismissed = disposeAct({ to: "dismissed", reason: "out of scope" });
  assert.deepEqual([dismissed.done.ok, dismissed.done.to], [true, "dismissed"]);
});

test("R49: migratedSurfacing answers the surfacing a migration replay recorded, and null for a question made on this plane", () => {
  const f = migratedSurfacing();
  assert.equal(f.plainAnswer, null);
  assert.deepEqual({ ...f.migratedAnswer, migrated: { ...f.migratedAnswer.migrated, at: typeof f.migratedAnswer.migrated.at } },
    { recorded: false, stated: word("inquiry.stated.recorded_migrated_drive"), run: null, lens: null,
      migrated: { capture: "c".repeat(64), promotion: "P-1", at: "string" } });
});

test("R33 R65: readRefusals answers NOT_AN_INQUIRY for a bundle that is no question, and one NO_SUCH_BUNDLE for an absent id and for a question the viewer may not see", () => {
  const f = readRefusals();
  assert.deepEqual(f.notAnInquiry, { ok: false, reason: "NOT_AN_INQUIRY", target: f.document });
  assert.deepEqual(f.absent, { ok: false, reason: "NO_SUCH_BUNDLE", target: f.absentId });
  assert.deepEqual(f.hiddenFromViewer, { ok: false, reason: "NO_SUCH_BUNDLE", target: f.question }, "answered as an absent one is");
  assert.equal(f.visible.ok, true, "control: a question the viewer may see is read");
});

test("R55: datedWaitOf answers the setter's dated wait due from its local day in the zone, waiting a second before it, and none to admin; parameterised by viewer and date", () => {
  const f = datedWaitOf();
  assert.deepEqual([f.answer.ok, f.answer.zone], [true, "America/Los_Angeles"]);
  assert.deepEqual(f.answer.waits.map((x) => [x.inquiry, x.index, x.text, x.description, x.date, x.state, x.set_by]),
    [[f.question, 0, "the auditor's reply", "from the City", "2026-10-10", "due", f.viewer]]);
  assert.equal(typeof f.answer.waits[0].set_at, "string", "stamped when the wait was set");
  assert.deepEqual(f.before.waits.map((x) => x.state), ["waiting"], "control: one second before the local day, not yet due");
  assert.deepEqual(f.none.waits, [], "admin reads no member's waits");
  const g = datedWaitOf({ viewer: "member:bob", date: "2026-10-20" });
  assert.deepEqual(g.answer.waits.map((x) => [x.date, x.state, x.set_by]), [["2026-10-20", "due", "member:bob"]]);
  assert.deepEqual(g.before.waits.map((x) => x.state), ["waiting"]);
});

test("R55 R58: questionWaitsSetAside answers the asker the set-aside wait with by and reason, the restore ending it with both in the history, and nothing to a viewer who may not see the document", () => {
  const f = questionWaitsSetAside();
  assert.equal(f.answer.ok, true);
  assert.deepEqual(f.answer.waits, [], "no dated wait");
  assert.deepEqual(f.answer.document_waits.map((x) => [x.document, x.by, x.reason]), [[f.document, f.setter, f.reason]]);
  assert.equal(typeof f.answer.document_waits[0].at, "string");
  assert.deepEqual(f.answer.history.map((h) => [h.document, h.act, h.by, h.reason]), [[f.document, "set_aside", f.setter, f.reason]]);
  assert.deepEqual(f.restored.document_waits, [], "a restore ends the wait");
  assert.deepEqual(f.restored.history.map((h) => [h.act, h.by, h.reason]),
    [["set_aside", f.setter, f.reason], ["restore", f.asker, f.restoreReason]]);
  assert.deepEqual([f.hiddenFrom.document_waits, f.hiddenFrom.history], [[], []], "a document the viewer may not see is neither announced nor counted");
  assert.deepEqual(f.restored.history, f.inquiry.documentWaits({ questions: [f.question], viewer: f.asker }).questions[0].history,
    "the history is documentWaits'");
  const g = questionWaitsSetAside({ asker: "member:carol", setter: "member:dave", reason: "Duplicate." });
  assert.deepEqual(g.answer.document_waits.map((x) => [x.by, x.reason]), [["member:dave", "Duplicate."]]);
});

test("R23 R25: divideAnswers answers the real division (divided, its children and apportionment) and each refusal a screen builds by hand, as inquiry gives it", () => {
  const f = divideAnswers();
  assert.deepEqual([f.divided.ok, f.divided.to, f.divided.into], [true, "divided", [f.children[0], f.children[1]]]);
  assert.deepEqual(f.divided.apportionment.map((a) => [a.ord, a.to]), [[0, [f.children[0]]], [1, [f.children[1]]]]);
  assert.deepEqual([f.childExists.reason, f.childExists.child], ["CHILD_EXISTS", f.existing]);
  assert.deepEqual([f.noHome.reason, f.noHome.orphans.map((o) => o.ord)], ["NO_APPORTIONMENT", [1]], "two passages have no home");
  assert.equal(f.noReason.reason, "NO_REASON", "a division with no reason says why it is refused, and nothing else");
  assert.deepEqual([f.notAnInquiry.reason, f.notAnInquiry.target], ["NOT_AN_INQUIRY", f.document]);
  assert.deepEqual([f.absent.reason, f.absent.target], ["NO_SUCH_BUNDLE", "INQ-2026-9099-x"]);
  assert.deepEqual([f.machine.reason, f.machine.check], ["MACHINE_CANNOT_DIVIDE", "C-32.7"]);
  assert.ok(f.machine.translation && f.machine.detail);
  assert.notEqual(f.world.record.head(f.children[0]), null, "the division that landed wrote its children; the refusals before it wrote none");
});

test("R23 R25 (catalogue): each divide refusal that carries a row carries the row inquiry-grammar holds for its code", () => {
  const f = divideAnswers();
  const row = INQUIRY_GRAMMAR_CHECKS.MACHINE_CANNOT_DIVIDE;
  assert.deepEqual([f.machine.check, f.machine.translation], [row.check, row.translation]);
});

test("R27 R85: groundAnswers answers the real partition (authored, restructured) and each refusal a screen builds by hand, and writes nothing on a refusal", () => {
  const f = groundAnswers();
  assert.deepEqual([f.authored.ok, f.authored.act, f.authored.target, f.authored.grouped], [true, "authored", f.question, true]);
  assert.deepEqual(f.authored.grounds.map((g) => g.ground), ["g1"]);
  assert.deepEqual([f.restructured.ok, f.restructured.act, f.restructured.reason], [true, "restructured", "no grouping after all"]);
  assert.deepEqual([f.noPartition.reason, f.noPartition.target], ["NO_PARTITION", f.question]);
  assert.deepEqual([f.notAnInquiry.reason, f.notAnInquiry.target], ["NOT_AN_INQUIRY", f.document]);
  assert.deepEqual([f.absent.reason, f.absent.target], ["NO_SUCH_BUNDLE", "INQ-2026-9099-x"]);
  assert.deepEqual([f.cutsAgainst.reason, f.cutsAgainst.ord, f.cutsAgainst.findings[0].check], ["BASIS_REFUSED", 1, "C-2.8"]);
  assert.equal(f.noReason.reason, "NO_REASON", "a restructure without its reason");
  assert.equal(f.noReason.restructure, true);
  assert.equal(f.heldAfterRefusals, f.heldAfterAuthored, "the refusals wrote nothing: the bytes the authored act left are the bytes still held");
});

test("R55 R58: questionWaitsNone answers a visible question with no wait as the real read gives it, nothing to add", () => {
  const f = questionWaitsNone();
  assert.deepEqual([f.answer.ok, f.answer.question, f.answer.waits], [true, f.question, []]);
  assert.deepEqual(f.answer.document_waits, []);
  assert.deepEqual(f.answer.history, []);
});

test("fixtures.mjs (new fixtures): two calls give two answers, each over a world of its own, never a stored one", () => {
  const d1 = divideAnswers(), d2 = divideAnswers();
  assert.notEqual(d1.world, d2.world);
  assert.equal(d1.divided.into.length, 2);
  assert.deepEqual(d2.divided.into, d1.divided.into, "the same question divided again names the same children, in its own world");
  const g1 = groundAnswers(), g2 = groundAnswers();
  assert.notEqual(g1.world, g2.world);
  assert.deepEqual([g1.authored.ok, g2.authored.ok], [true, true]);
  assert.equal(g2.noReason.reason, "NO_REASON", "the second call's own answer, not the first's");
  const q1 = questionWaitsNone(), q2 = questionWaitsNone();
  assert.notEqual(q1.inquiry, q2.inquiry);
  assert.notEqual(q1.answer, q2.answer, "two reads are two answers");
  assert.deepEqual(q1.answer, q2.answer, "the same empty question, read in a world of its own, answers alike");
});
