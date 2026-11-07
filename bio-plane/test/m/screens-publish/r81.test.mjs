/* screens-publish R81 (T51 fix round 10; DEC-439, DEC-440, DEC-441; K5303): the alpha walk's remaining rows, each drawn by its key at the walker's
 * case through the page's real acts and reads: the case editor's Save and its unsaved line (D-M2), the acknowledgement when nothing is left out
 * (D-M5), the review copy's file-ready line (D-M4), and the public case page's unrated and undetermined axes, signature check and declared bar
 * (D-M6). Each sentence is asserted by its key (R24). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { open, main, text, drew, drewIn, word, press, fill, last, ok, COPY, FINDING, CASE_WITH, F1, F2, P, DR, C, SHA } from "./fixtures.mjs";

const EDITOR = `/app/case-editor/${P}/${DR}`;
const PUBLIC = { session: null };
const HASH = "9".repeat(63) + "a";
const STAMP = { format: "bio-inband/1", hash: { sha256: HASH, bytes: 4096, over: "this answer exactly as served" }, date: "2026-10-07T09:00:00Z", author: "dev", floors: { capture: "B", connection: "C" } };
const casedraftButtons = (p) => main(p).querySelectorAll('button[data-act="casedraft"]');
const unsaved = (p) => main(p).querySelectorAll("[data-unsaved]");

test("R81 D-M2 the drafted case editor's save is 'Save these details', and the first case's button keeps 'Prepare the draft' (control)", async () => {
  const p = await open(EDITOR);
  const save = casedraftButtons(p)[0];
  assert.ok(save, "the editor offers casedraft on the drafted state");
  assert.ok(drewIn(save, "screen.case-editor.save"), "labelled by the key");
  const first = await open(`/app/case-editor/${P}`, { plane: { casedrafts: ok({ drafts: [], concluded: [{ inquiry: "INQ-1", title: "A question", concluded_at: "2026-10-01T10:00:00Z", findings: 1 }] }) } });
  assert.ok(drewIn(casedraftButtons(first)[0], "act.casedraft.label.case-editor"), "control: a first case still prepares the draft");
  assert.ok(!drew(first, "screen.case-editor.save"), "control: no save before there is a draft");
});

test("R81 D-M2 the unsaved line is drawn once a field of the drafted state is edited, and gone once it is saved; an untouched editor draws none (control)", async () => {
  const p = await open(EDITOR);
  assert.equal(unsaved(p).length, 0, "control: nothing edited, nothing unsaved");
  assert.ok(!drew(p, "screen.case-editor.unsaved"));
  for (const id of ["ce-scope", "ce-statement"]) {
    const q = await open(EDITOR);
    const el = q.doc.getElementById(id);
    el.value = "A changed word.";
    q.fire(el, "input");
    await q.clock.tick(600);
    await q.settle();
    assert.equal(unsaved(q).length, 1, `editing ${id} draws the line`);
    assert.ok(drewIn(unsaved(q)[0], "screen.case-editor.unsaved"));
    assert.equal(q.doc.getElementById(id).value, "A changed word.", "what was typed stays");
  }
  const q = await open(EDITOR);
  const el = q.doc.getElementById("ce-scope");
  el.value = "Rents, 2024 to 2026, changed.";
  q.fire(el, "input");
  await q.clock.tick(600);
  await q.settle();
  assert.equal(unsaved(q).length, 1);
  await press(q, "casedraft", { reason: "edit" });
  assert.equal(last(q, "casedraft").body.scope, "Rents, 2024 to 2026, changed.", "saved");
  assert.equal(unsaved(q).length, 0, "saved: the line is gone");
});

test("R81 D-M5 a case that states it leaves nothing out draws the acknowledgement's sentence and its reason's help; a case that lists what it leaves out draws the ordinary help (control)", async () => {
  const none = await open(EDITOR, { plane: { reviewcopy: ok(COPY({ authored: { scope: "S", statement: "The case leaves nothing material out.", excluded: [] }, statement_acknowledgements: null })) } });
  assert.ok(drew(none, "screen.case-editor.ack.none"), "the sentence");
  assert.ok(drew(none, "screen.case-editor.ack.none.help"), "the reason's help");
  assert.ok(!drew(none, "screen.case-editor.ack.reason.help"), "not the help for a list");
  const listed = await open(EDITOR);
  assert.ok(!drew(listed, "screen.case-editor.ack.none"), "control: something left out, no 'nothing left out' sentence");
  assert.ok(drew(listed, "screen.case-editor.ack.reason.help"), "control: its own help");
});

test("R81 D-M4 once the saved file is made, the page says so beside its button: 'The file is ready. Save it to your device.'; before it, nothing is said (control)", async () => {
  const p = await open(`/app/review-copy/${P}`, { plane: { reviewcopy: ok({ ...COPY(), inband: STAMP }) } });
  await press(p, "reviewexport");
  const sel = p.doc.getElementById("rc-export-ack");
  sel.value = "yes";
  p.fire(sel, "change");
  await p.settle();
  assert.ok(!drew(p, "screen.review_copy.save.ready"), "control: nothing is ready yet");
  await press(p, "reviewexport");
  const ready = main(p).querySelector("[data-export-ready]");
  assert.ok(ready && ready.querySelector("button"), "the file's button");
  assert.ok(drew(p, "screen.review_copy.save.ready"), "the file-ready line");
});

const publish = (findings, o = {}) => open(`/app/published/${C}`, { boot: PUBLIC, plane: { publishedcase: ok(CASE_WITH(findings, o)) } });
const axisLines = (p) => main(p).querySelectorAll("[data-ungraded]");

test("R81 D-M6 (b) an axis graded neither A to D draws 'Not graded yet' (unrated) or 'Undetermined', by key, with or without a sentence served, and never nothing; a lettered axis draws its letter and no such line (control)", async () => {
  const SERVED = "UNRATED on capture: no leg on this axis carries an established grade. Not load-bearing: INFO-2026-0001-a.";
  const f = FINDING(F1, { strength: [{ axis: "capture", state: "unrated", grade: null, detail: SERVED }, { axis: "connection", state: "undetermined", grade: null }] });
  const p = await publish([f]);
  const lines = axisLines(p);
  assert.equal(lines.length, 2, "one line for each ungraded axis");
  assert.ok(drewIn(main(p).querySelector('[data-ungraded="capture"]'), "screen.published.strength.unrated"), "unrated by its key");
  assert.ok(drewIn(main(p).querySelector('[data-ungraded="connection"]'), "screen.published.strength.undetermined"), "undetermined by its key, with no sentence served");
  assert.ok(!text(p).includes("UNRATED on capture") && !text(p).includes("INFO-2026-0001-a"), "the served sentence is not drawn");
  const graded = await publish([FINDING(F2)]);
  assert.equal(axisLines(graded).length, 0, "control: two letters, no ungraded line");
  assert.ok(!drew(graded, "screen.published.strength.unrated") && !drew(graded, "screen.published.strength.undetermined"));
});

test("R81 D-M6 (a) the signature check's explanation is the key's words in place of the served sentence; an answer stating no verification draws none (control)", async () => {
  const SERVED = "tamper-EVIDENT, not tamper-proof; the sha256 in the manifest covers findings[].";
  /* R100: the explanation says the signature and key are shown here, so it is drawn with the case document's signature and key */
  const p = await publish([FINDING(F1)], { verification: { container: "x", manifest: SHA, case_file: null, findings: [], detail: SERVED },
    document: { sig_armored: "-----BEGIN SSH SIGNATURE-----\nU1NIU0lH\n-----END SSH SIGNATURE-----", attestor: { member: "rosa", key_b64: "AAAAC3NzaC1lZDI1NTE5AAAAIKEY" } } });
  const line = main(p).querySelector("[data-verification]");
  assert.ok(line && drewIn(line, "screen.published.verify.detail"), "by its key");
  assert.ok(!text(p).includes("tamper-EVIDENT"), "the served sentence is not drawn");
  const none = await publish([FINDING(F1)]);
  assert.equal(main(none).querySelectorAll("[data-verification]").length, 0, "control: nothing stated, nothing drawn");
});

test("R81 D-M6 (c) a case that declared a bar draws 'The standard of evidence this case was held to' by its key in place of the served sentence; one that declared none draws no such line (control)", async () => {
  const SERVED = "the standard of evidence this case was held to, read from its publishing project and frozen here (DEC-72)";
  const p = await publish([FINDING(F1)], { bar: { declared: true, source: "project", capture: "B", connection: "B", detail: "x" }, bar_detail: SERVED });
  const line = main(p).querySelector("[data-bar-declared]");
  assert.ok(line && drewIn(line, "screen.published.bar.declared"), "by its key");
  assert.ok(!text(p).includes("DEC-72"), "the served sentence is not drawn");
  const none = await publish([FINDING(F1)], { bar: { declared: false, source: "none", capture: null, connection: null, detail: "x" }, bar_detail: word("public-read.bar_recorded_case") });
  assert.equal(main(none).querySelectorAll("[data-bar-declared]").length, 0, "control: no bar declared, no 'held to' line");
  assert.ok(!drew(none, "screen.published.bar.declared"));
});
