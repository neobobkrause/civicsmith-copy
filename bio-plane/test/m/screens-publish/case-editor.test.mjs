/* screens-publish R1 (the case editor) on interface-shell's served page: the project's drafts and the chosen draft's
 * ladder, scope, what it leaves out with each acknowledgement, the people it names with their reasons, what changed;
 * each act sent with what its owner takes. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { open, main, text, drew, word, ops, press, fill, last, ok, refusedIn, P, DR, C, plane, COPY, provided, refusalWords } from "./fixtures.mjs";

const PATH = `/app/case-editor/${P}`;

test("R1 the editor reads the project's drafts, the draft's document, its check and its \"what changed\" drafts", async () => {
  const p = await open(PATH);
  assert.equal(last(p, "casedrafts").query.project, P);
  assert.equal(last(p, "casedocument").query.case, C);
  assert.equal(last(p, "casedocument").query.edition, "2");
  assert.equal(last(p, "casecheck").query.case, C);
  assert.equal(last(p, "whatchangeddrafts").query.case, C);
  assert.equal(last(p, "reviewcopy").query.draft, DR);
});

test("R1 the readiness ladder: Draft, Internally checked, Externally compliant, Distributed, each not yet evaluated until checked", async () => {
  let p = await open(PATH);
  const rung = (q, k) => main(q).querySelector(`[data-rung="${k}"]`);
  assert.deepEqual(main(p).querySelectorAll("[data-rung]").map((r) => r.getAttribute("data-rung")), ["draft", "internal", "external", "distributed"]);
  assert.equal(rung(p, "internal").className, "on", "casecheck held: internally checked");
  assert.equal(rung(p, "external").className, "on", "the copy's gates passed");
  assert.ok(rung(p, "distributed").textContent.includes(word("case.ladder.notyet")));
  p = await open(PATH, { plane: { casecheck: ok({ state: "none" }), reviewcopy: ok({ ...(plane().reviewcopy.json.result), gates: "undetermined" }) } });
  for (const k of ["internal", "external", "distributed"]) assert.ok(rung(p, k).textContent.includes(word("case.ladder.notyet")), k);
});

test("R1 the scope, what it leaves out with each acknowledgement and its reason, the people named with their reason or that it is missing, what changed", async () => {
  const p = await open(PATH);
  const t = text(p);
  const scope = p.doc.getElementById("ce-scope");
  assert.equal(scope.value || scope.textContent, "Rent adjustments under the Coliseum lease, 2024 to 2026.");
  assert.match(t, /Whether the rents are fair/);
  assert.ok(drew(p, "screen.case-editor.ack.by", { who: "mai" }) && t.includes("The fairness question is another project's."));
  assert.ok(t.includes(`OBS-2026-0001 · ${word("screen.case-editor.level.name")} · signed the March 2024 adjustment`));
  assert.ok(t.includes(`OBS-2026-0002`) && drew(p, "screen.case-editor.people.noreason"));
  assert.match(t, /Adds the 2025 rent schedules/);
  assert.ok(main(p).querySelector('[data-origin="machine"]'), "a machine draft of what changed is labelled machine work");
});

test("R1 \"Prepare the draft\" sends casedraft with the member's scope and the draft; a scope left empty sends nothing (control)", async () => {
  const p = await open(PATH);
  fill(p, { "ce-scope": "" });
  await press(p, "casedraft", { reason: "edit" });
  assert.equal(p.byOp("casedraft").length, 0);
  fill(p, { "ce-scope": "Rents, 2024 to 2026." });
  await press(p, "casedraft", { reason: "edit" });
  assert.equal(last(p, "casedraft").body.draft, DR);
  assert.equal(last(p, "casedraft").body.scope, "Rents, 2024 to 2026.");
});

test("R1 \"Acknowledge what it leaves out\" carries the acknowledger's own reason; STATEMENT_ACK_NO_REASON is drawn by its words", async () => {
  const p = await open(PATH);
  fill(p, { "ce-ackreason": "It belongs to the fairness project." });
  await press(p, "statementack");
  assert.equal(last(p, "statementack").query.draft, DR);
  assert.equal(last(p, "statementack").body.reason, "It belongs to the fairness project.");
  const q = await open(PATH, { plane: { statementack: refusedIn("STATEMENT_ACK_NO_REASON") } });
  fill(q, { "ce-ackreason": "x" });
  const { slot } = await press(q, "statementack");
  assert.ok(slot().textContent.includes(word("screen.case-editor.ack.reason.needed")));
});

test("R1 \"Name with the reason\" sends attribute with the case, the observation, the level and the reason", async () => {
  const p = await open(PATH);
  fill(p, { "ce-level-1": "cover", "ce-why-1": "They signed the adjustment as the council's agent." });
  await press(p, "attribute", { nth: 1 });
  assert.deepEqual({ ...last(p, "attribute").body }, { caseId: C, edition: 2, observation: "OBS-2026-0002", level: "cover", reason: "They signed the adjustment as the council's agent." });
});

test("R1 \"Draft what changed\" only while the assistant is reachable, its answer labelled, untested drawn; writing help under scope and what changed only", async () => {
  let p = await open(PATH);
  assert.ok(!ops(p).includes("whatchangedpropose"), "not reachable: absent");
  const reach = { assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }) };
  p = await open(PATH, { plane: { ...reach, whatchangedpropose: ok({ draft: { id: "WCD-2", text: "x", label: { machine: true } }, untested: true }) } });
  assert.ok(ops(p).includes("whatchangedpropose"));
  fill(p, { "ce-wc": "Adds the 2025 schedules." });
  await press(p, "whatchangedpropose", { reason: "draft" });
  assert.equal(last(p, "whatchangedpropose").query.case, C);
  assert.equal(last(p, "whatchangedpropose").body.text, "Adds the 2025 schedules.");
  const helps = main(p).querySelectorAll('button[data-act="writinghelp"]').map((b) => b.getAttribute("data-field"));
  assert.deepEqual(helps, ["scope", "whatchanged"], "writing help under the scope and what changed fields only, never under a reason");
  /* wizard-scripts' real `writinghelp` never returns a draft (K5212): past its refusals it answers ASSISTANT_DRAFT_UNAVAILABLE, so what the
     screen draws is each refusal in its own words, under the field, and no draft */
  for (const which of ["held", "unreachable"]) {
    const answer = await provided.writinghelp(which);
    p = await open(PATH, { plane: { writinghelp: answer } });
    await press(p, "writinghelp", { values: { "ce-scope": "rents 2024 2026" } });
    assert.equal(last(p, "writinghelp").body.field, "scope");
    assert.ok(text(p).includes(refusalWords(answer)), `${which}: the refusal in its words`);
    assert.ok(!drew(p, "screen.case-editor.help.draft") && !drew(p, "ai.label.untested.writinghelp"), `${which}: no draft`);
  }
});

/* ---------- fix round 10 (K5148): R44's What-changed words, the document read for a prepared edition only, the people of a prepared new-case draft ---------- */

const drafted = (case_, editions) => ok({ kind: "review-drafts", project: P, drafts: [{ draft_id: DR, case: case_, ...(editions ? { editions } : {}), created_by: "dev", updated_by: "dev" }] });

test("R44 (10A R90 (i)) \"Prepare the draft\" sends the member's What-changed words as whatChanged {text} when changed; an unchanged or empty field sends none (control)", async () => {
  const p = await open(PATH);
  fill(p, { "ce-wc": "Adds the 2025 schedules." });
  await press(p, "casedraft", { reason: "edit" });
  assert.deepEqual(last(p, "casedraft").body.whatChanged, { text: "Adds the 2025 schedules." });
  const q = await open(PATH);
  await press(q, "casedraft", { reason: "edit" });
  assert.ok(!("whatChanged" in (last(q, "casedraft").body || {})), "a field she did not touch sends nothing");
  const held = await open(PATH, { plane: { reviewcopy: ok(COPY({ authored: { ...COPY().authored, whatChanged: { text: "Held words." } } })) } });
  assert.equal(held.doc.getElementById("ce-wc").value || held.doc.getElementById("ce-wc").textContent, "Held words.", "the words the draft holds are drawn in the field");
  await press(held, "casedraft", { reason: "edit" });
  assert.ok(!("whatChanged" in (last(held, "casedraft").body || {})), "words the draft already holds are not sent again");
  fill(held, { "ce-wc": "Held words, then more." });
  await press(held, "casedraft", { reason: "edit" });
  assert.deepEqual(last(held, "casedraft").body.whatChanged, { text: "Held words, then more." });
});

test("R44 (10B C10) the editor reads the document of an edition that is prepared or published only; a begun edition sends no casedocument", async () => {
  const begun = { case_id: C, edition: 3, identity: "The Coliseum lease" };
  const none = await open(PATH, { plane: { casedrafts: drafted(begun, { prepared: null, published: null }) } });
  assert.equal(none.byOp("casedocument").length, 0, "edition 3 is begun and has no document yet");
  const prepared = await open(PATH, { plane: { casedrafts: drafted(begun, { prepared: 3, published: null }) } });
  assert.equal(last(prepared, "casedocument").query.edition, "3");
  const published = await open(PATH, { plane: { casedrafts: drafted(begun, { prepared: null, published: { edition: 3, address: "x" } }) } });
  assert.equal(published.byOp("casedocument").length, 1, "a published edition is read");
});

test("R16 (follow-up 54, review R16) a new-case draft that is prepared sends attribute with the prepared case and edition; unprepared it refuses in place (control)", async () => {
  const fresh = { case_id: null, edition: null, identity: "A case this draft will start" };
  const prep = await open(PATH, { plane: { casedrafts: drafted(fresh, { prepared: 1, published: null, case: C }),
    reviewcopy: ok(COPY({ case: { case_id: C, edition: 1, identity: "The Coliseum lease", newCase: true } })) } });
  fill(prep, { "ce-level-1": "cover", "ce-why-1": "They signed the adjustment as the council's agent." });
  await press(prep, "attribute", { nth: 1 });
  assert.deepEqual({ ...last(prep, "attribute").body }, { caseId: C, edition: 1, observation: "OBS-2026-0002", level: "cover", reason: "They signed the adjustment as the council's agent." });
  const un = await open(PATH, { plane: { casedrafts: drafted(fresh, { prepared: null, published: null, case: null }),
    reviewcopy: ok(COPY({ case: { case_id: null, edition: null, identity: "A case this draft will start", newCase: true } })) } });
  fill(un, { "ce-level-1": "cover", "ce-why-1": "A reason." });
  await press(un, "attribute", { nth: 1 });
  assert.equal(un.byOp("attribute").length, 0, "nothing is prepared: nothing is sent");
  assert.ok(drew(un, "screen.case-editor.people.nocase"));
});
