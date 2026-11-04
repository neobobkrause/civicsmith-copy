/* screens-inquiry R105 (FR-28 entry 22; C48; DEC-374; `contradiction` R30-R36, R50-R54; entry 25's `writinghelp`): the screen
 * `contradiction`, "Two documents in tension", on the shell's served page. Each state of the drawing (a conflict the record holds,
 * a lead, one taken up, a conflict with a record the member cannot see, that conflict once the projects are named, nothing
 * proposed) and each act sends exactly the fields `contradiction` declares (interface-shell's guard, R104, checks every request).
 * R44: no test holds a sentence's English; each expectation is a word read through `word(key, vars)`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hasWord } from "../../../src/setup-words/index.mjs";
import { OPS, registerDeclaredOps as registerOps } from "../../../src/op-declarations/index.mjs";
import { boot, ok, refusedIn } from "../interface-shell/harness.mjs";
import { CONTRADICTION_SCREEN, GAP_WORDS } from "../../../src/screens-inquiry/contradiction.mjs";
import { SCREENS } from "../../../src/screens-inquiry/index.mjs";
import { plane, main, press, fill, says, word, day, P, SHA, DOCUMENT_MD, storeWorld, WORLD_FOUNDER_HANDLE } from "./fixtures.mjs";

/* K4245 (test-support R17): every owner's declarations registered once, before the first read, by the one registrar */
const REGISTRY = JSON.parse(readFileSync(new URL("../../../../docs/development/ux-substrate/screens/registry.json", import.meta.url), "utf8"));
const S = "screen.contradiction.";
const CAND = "c0".repeat(32), INQ = "INQ-2026-0020-which-date", OTHER = "PROJ-2026-0042";
const A_DOC = "INFO-2026-0011", B_DOC = "INFO-2026-0012";
const docMd = (id, title) => DOCUMENT_MD.replace("INFO-2026-0004", id).replace(/title: ".*"/, `title: "${title}"`);
const SIDE_A = { kind: "extent", content_id: "CNT-A", capture_sha: SHA, ref: "pdf-page:2", extent_kind: "pdf-page", text: "The rent adjustment takes effect on November 1, 2026.",
  source: { bundle: A_DOC, ref: "pdf-page:2" }, date: "2024-03-04", doctype: "amendment" };
const SIDE_B = { ...SIDE_A, content_id: "CNT-B", text: "The adjusted rent is due beginning December 1, 2026.", source: { bundle: B_DOC, ref: "pdf-page:0" }, date: "2026-09-12", doctype: "notice" };
const cand = (o = {}) => ({ candidate: CAND, key: "K4", why: "Two documents about one lease give different dates.", a: SIDE_A, b: SIDE_B,
  machine: { label: "world", reason: "A lease amendment and a later notice date the same adjustment differently.", run: "RUN-1", proposed_by: "member:x", at: "2026-10-10T09:00:00Z", origin: "machine", machine_work: true },
  weight: "duty", state: "open", resolution: null, inquiry: null, recommendations: [], reach: { projects: [P], truncated: false },
  default_question: "Which date does the rent adjustment take effect?", ...o });
const FACTS = { ok: true, candidate: CAND, key: "K4", facts: [
  { coordinate: "time_or_occasion", fact: "stated_date", a: "2024-03-04", b: "2026-09-12", source: "record", machine_work: false },
  { coordinate: "observer_or_method", fact: "doctype", a: "amendment", b: "notice", source: "record", machine_work: false },
  { coordinate: "subject", fact: "resolved_entities", a: null, b: null, source: "record", machine_work: false, undetermined: true, why: "none" }] };
const answer = (c) => ok({ ok: true, wrote: false, on: { candidate: CAND }, candidates: c ? [c] : [], empty: c ? null : { level: "none_judged" } });
const NOTICE = (o = {}) => ({ candidate: CAND, project: P, weight: "duty", state: "open", side: SIDE_A, named: [], says: "x", opted_in: null,
  asked_by_another: false, revealed: false, responses: [], responses_truncated: false, ...o });
const notices = (n) => ok({ ok: true, wrote: false, project: P, notices: n ? [n] : [], truncated: false });
const IMAGES = { [A_DOC]: { "bundle.md": docMd(A_DOC, "Lease amendment, March 2024") }, [B_DOC]: { "bundle.md": docMd(B_DOC, "Rent notice, September 2026") },
  [INQ]: { "bundle.md": ["---", `id: ${INQ}`, "object_type: inquiry", "title: \"Which date does the rent adjustment take effect?\"", `project: ${P}`, "---", ""].join("\n") } };
const view = (c, o = {}) => ({ images: IMAGES, plane: { contradictioncandidates: answer(c), contradictionfacts: ok(FACTS), contradictionnotices: notices(null), ...(o.plane || {}) } });
/* the other screens are served beside it, so a reference to a document or a question is a link (the kit draws a link only to a registered screen) */
const SERVED = [...SCREENS.filter((s) => s.id !== "contradiction"), CONTRADICTION_SCREEN];
export const open = async (path, o = {}) => { const p = await boot({ screens: SERVED, path, plane: plane(o), ...(o.boot || {}) }); await p.settle(); return p; };
const acts = (el) => [...new Set(el.querySelectorAll("button[data-act]").map((b) => b.getAttribute("data-act")))].sort();
const stateOf = (p) => main(p).querySelector("[data-cd]").getAttribute("data-cd");
const act = (p, op, choice) => main(p).querySelector(`button[data-act="${op}"]${choice ? `[data-choice="${choice}"]` : ""}`);
const tick = (p, id, i = 0) => { p.doc.getElementById(`${id}-${i}`).checked = true; };

/* ---- the registry, the module's registration and its words ---- */

test("R105 the screen is registered with exactly the acts the registry lists, each an op OPS holds, and index.mjs serves it", () => {
  const reg = REGISTRY.screens.find((s) => s.id === "contradiction");
  assert.deepEqual(CONTRADICTION_SCREEN.acts.map((a) => a.op).sort(), reg.acts.map((a) => a.op).sort());
  for (const a of CONTRADICTION_SCREEN.acts) assert.ok(Object.hasOwn(OPS, a.op), a.op);
  assert.ok(SCREENS.some((s) => s === CONTRADICTION_SCREEN), "registered in SCREENS");
});

test("R105 R44 every key the screen names beyond its own family is a words.json word (hasWord); a design word still missing would be listed in GAP_WORDS (none now) and the screen would draw the gap's key until the design stream writes it", () => {
  for (const k of CONTRADICTION_SCREEN.words) assert.ok(hasWord(k), k);
  /* the 31 gap keys are all held since DEC-391 minted them, so the list is empty; any that is listed again must be this screen's and unheld */
  assert.ok(GAP_WORDS.every((k) => k.startsWith(S) && !hasWord(k)));
  /* control: a gap key is not named in `words` (the page serves the screen's own family by prefix once the row exists) */
  for (const k of GAP_WORDS) assert.ok(!CONTRADICTION_SCREEN.words.includes(k), k);
  for (const k of ["name", "say.how.they.differ", "why.they.are.side.by.side", "this.is.a.conflict.the.record", "this.is.a.lead.the.assistant",
    "member.took.this.up.as.a", "something.your.project.rests.on.is", "a.conflict.between.two.projects", "nothing.has.been.proposed.to.you",
    "mark.it.wrong.with.a.reason", "dismiss.this.lead.with.a.reason", "ask.to.resolve.it", "the.assistant.s.judgement.not.a"]) assert.ok(hasWord(S + k), S + k);
});

/* ---- the states of the drawing ---- */

test("R105 state a, a conflict the record holds: both passages side by side, each a reference opening its document, the quoted words and what the record states of them; how strongly it binds; clarify, mark wrong and take up; no dismiss, no conclude (controls)", async () => {
  const p = await open("/app/contradiction/" + CAND, view(cand()));
  const m = main(p);
  assert.equal(stateOf(p), "a");
  const a = m.querySelector('[data-side="a"]'), b = m.querySelector('[data-side="b"]');
  assert.ok(a && b);
  assert.equal(a.querySelector("a.cs-ref").getAttribute("href"), "/app/document/" + A_DOC);
  assert.ok(a.textContent.includes("Lease amendment, March 2024") && a.textContent.includes(SIDE_A.text), "the title as the record has it, the words verbatim");
  assert.equal(b.querySelector("a.cs-ref").getAttribute("href"), "/app/document/" + B_DOC);
  assert.ok(b.textContent.includes(SIDE_B.text));
  assert.ok(!/INFO-2026/.test(a.textContent.replace(A_DOC, "")) || !a.textContent.includes(A_DOC + ")"), "no id as a title");
  const dates = m.querySelector('[data-fact="stated_date"]');
  assert.ok(dates && dates.textContent.includes(day("2024-03-04")) && dates.textContent.includes(day("2026-09-12")), "the stated dates, by cs.date");
  /* T51 fix round 13 (B92, C-M13): a doctype is drawn by its held label only; the design holds none for this id, so no row, never the id */
  assert.equal(m.querySelector('[data-fact="doctype"]'), null, "no held label for the doctype: no row");
  assert.equal(m.querySelector('[data-fact="resolved_entities"]'), null, "control: a fact the record cannot state is not drawn");
  assert.ok(m.querySelector('[data-origin="machine"]'), "the assistant's judgment is marked machine work");
  assert.ok(says(m, S + "the.assistant.s.judgement.not.a") && m.textContent.includes(cand().machine.reason));
  assert.ok(says(m, S + "this.is.a.conflict.the.record") && says(m, S + "it.stays.open.until.someone.resolves"));
  assert.ok(!says(m, S + "this.is.a.lead.the.assistant"));
  assert.deepEqual(acts(m), ["contradictionclarify", "contradictiontakeup"]);
  assert.ok(act(p, "contradictionclarify", "differs") && act(p, "contradictionclarify", "one_wrong"));
  assert.equal(act(p, "contradictiondismiss"), null, "control: a conflict the record holds is never dismissed");
  assert.equal(act(p, "contradictionresolve"), null, "control: nothing to conclude before it is taken up");
});

test("R105 state b, a lead: the assistant's guess asks nothing; dismiss with a reason and take up are drawn; clarify is not (a lead is dismissed or taken up, R32)", async () => {
  const p = await open("/app/contradiction/" + CAND, view(cand({ weight: "lead" })));
  assert.equal(stateOf(p), "b");
  assert.ok(says(main(p), S + "this.is.a.lead.the.assistant") && says(main(p), S + "it.asks.nothing.of.anyone.until"));
  assert.deepEqual(acts(main(p)), ["contradictiondismiss", "contradictiontakeup"]);
  assert.equal(act(p, "contradictionclarify", "differs"), null);
  assert.ok(!says(main(p), S + "this.is.a.conflict.the.record"));
});

test("R105 state c, taken up: the question it became is a reference, the conclusion form is drawn for the question; the others are not (controls)", async () => {
  const p = await open("/app/contradiction/" + CAND, view(cand({ state: "taken_up", inquiry: INQ })));
  const m = main(p);
  assert.equal(stateOf(p), "c");
  assert.equal(m.querySelector(`a.cs-ref[href="/app/question/${INQ}"]`).textContent, "Which date does the rent adjustment take effect?");
  assert.ok(says(m, S + "it.stays.open.here.until.the"));
  assert.deepEqual(acts(m), ["contradictionresolve"]);
  for (const f of ["cd-kind", "cd-concl", "cd-fals"]) assert.ok(p.doc.getElementById(f), f);
  assert.ok(m.querySelector('[data-side="a"]') && m.querySelector('[data-side="b"]'), "both passages stay drawn");
});

test("R105 a closed candidate (dismissed or resolved) draws both passages and no act; the plane's closed words say so (control: its acts are refused CANDIDATE_CLOSED)", async () => {
  for (const state of ["dismissed", "resolved"]) {
    const p = await open("/app/contradiction/" + CAND, view(cand({ state })));
    assert.equal(stateOf(p), "closed", state);
    assert.deepEqual(acts(main(p)), [], state);
    assert.ok(says(main(p), S + "someone.already.closed.this.and.it"), state);
    assert.ok(main(p).querySelector('[data-side="b"]'));
  }
});

test("R105 state d, a conflict with a record the member cannot see: only the passage she can see, neither the other record nor who holds it; ask to resolve; nothing of the other side is read or drawn", async () => {
  const p = await open(`/app/contradiction/${CAND}/${P}`, view(null, { plane: { contradictionnotices: notices(NOTICE({ asked_by_another: true })) } }));
  const m = main(p);
  assert.equal(stateOf(p), "d");
  assert.ok(says(m, S + "something.your.project.rests.on.is") && says(m, S + "it.conflicts.with.a.record.you") && says(m, S + "neither.that.record.nor.who.holds"));
  assert.ok(says(m, S + "the.passage.you.can.see") && m.querySelector('[data-side="a"]').textContent.includes(SIDE_A.text));
  assert.equal(m.querySelector('[data-side="b"]'), null, "the other side is not drawn");
  assert.ok(says(m, S + "another.project.has.already.asked"));
  assert.deepEqual(acts(m), ["contradictionoptin"]);
  assert.equal(p.byOp("contradictionfacts").length, 0, "the facts of a pair she cannot see whole are not read");
  assert.ok(!says(m, S + "why.they.are.side.by.side"), "control: no pairing sentence, no machine reason");
  const q = await open(`/app/contradiction/${CAND}/${P}`, view(null, { plane: { contradictionnotices: notices(NOTICE()) } }));
  assert.ok(!says(main(q), S + "another.project.has.already.asked"), "control: nobody else has asked");
  const r = await open(`/app/contradiction/${CAND}/${P}`, view(null, { plane: { contradictionnotices: notices(NOTICE({ opted_in: { member: "dev", at: "2026-10-15T09:00:00Z", words: null } })) } }));
  assert.equal(act(r, "contradictionoptin"), null, "control: her project has asked, and it is never withdrawn or asked twice");
});

test("R105 state e, the projects named to each other: their names, the responses relayed and her own, and the response form with what she may share; no ask is offered again", async () => {
  const responses = ok({ ok: true, candidate: CAND, project: P, revealed: true, responses: [
    { response: "R1", own: true, author: "member:dev", text: "Our notice came from the landlord's letter.", cover: null, email: null, project: P, at: "2026-10-17T09:00:00Z" },
    { response: "R2", own: false, text: "We hold only the amendment.", cover: "Fern", project: { id: OTHER, name: "Elsewhere" }, at: "2026-10-17T10:00:00Z" }] });
  const n = NOTICE({ revealed: true, asked_by_another: true, opted_in: { member: "dev", at: "2026-10-15T09:00:00Z", words: null },
    parties: [{ id: OTHER, name: "Elsewhere" }], responses: [{ response: "R2", text: "We hold only the amendment.", cover: "Fern", project: { id: OTHER, name: "Elsewhere" }, at: "2026-10-17T10:00:00Z" }] });
  const p = await open(`/app/contradiction/${CAND}/${P}`, view(null, { plane: { contradictionnotices: notices(n), contradictionresponses: responses } }));
  const m = main(p);
  assert.equal(stateOf(p), "e");
  assert.ok(says(m, S + "a.conflict.between.two.projects") && says(m, S + "every.project.that.holds.a.side"));
  assert.ok(m.textContent.includes("Elsewhere") && m.textContent.includes("Pothole repairs"), "both projects by name");
  assert.ok(m.textContent.includes("Our notice came from the landlord's letter.") && m.textContent.includes("We hold only the amendment.") && m.textContent.includes("Fern"));
  assert.deepEqual(acts(m), ["contradictionrespond"]);
  for (const f of ["cd-resp", "cd-share", "cd-email"]) assert.ok(p.doc.getElementById(f), f);
  assert.equal(m.querySelector('[data-side="b"]'), null, "control: still only the side she may see");
});

test("R105 state f, nothing proposed (the assistant is held): the screen says so, and that a pair proposed before stays; no act; the words follow whether the assistant is reachable", async () => {
  const p = await open("/app/contradiction", view(null));
  const m = main(p);
  assert.equal(stateOf(p), "f");
  assert.ok(says(m, S + "pairs.of.passages.your.team.s") && says(m, S + "nothing.has.been.proposed.to.you"));
  assert.ok(says(m, S + "until.it.is.available.no.document") && says(m, S + "a.pair.that.was.proposed.before"));
  assert.deepEqual(acts(m), []);
  assert.equal(p.requests.filter((r) => /^contradiction/.test(r.op)).length, 0, "nothing is read or sent");
  assert.ok(says(m, S + "finding.passages.that.may.conflict.is.2") && !says(m, S + "finding.passages.that.may.conflict.is"), "the assistant is off for her");
  const q = await open("/app/contradiction", { ...view(null), plane: { ...view(null).plane, assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }) } });
  assert.ok(says(main(q), S + "finding.passages.that.may.conflict.is") && !says(main(q), S + "finding.passages.that.may.conflict.is.2"), "reachable: it is not available yet");
});

test("R105 a candidate that answers nothing and no notice is Nothing is here (the shell's R61), never a form", async () => {
  const p = await open("/app/contradiction/" + "0".repeat(64), view(null));
  assert.equal(p.root().querySelector("[data-cd]"), null);
  assert.deepEqual(acts(p.root()).filter((o) => /^contradiction/.test(o)), []);
  const q = await open(`/app/contradiction/${"0".repeat(64)}/${P}`, view(null));
  assert.equal(q.root().querySelector("[data-cd]"), null, "with a project, a notice of no candidate draws nothing either");
});

test("R105 the crumb names the project the pair rests on, by its title, never its id", async () => {
  const p = await open("/app/contradiction/" + CAND, view(cand()));
  const crumbs = p.root().querySelector(".cs-crumbs");
  assert.ok(crumbs.textContent.includes("Pothole repairs") && !crumbs.textContent.includes(P));
});

/* ---- the acts: each sends the fields `contradiction` declares (the harness's guard checks every request against them) ---- */

test("R105 R32 clarify, they differ: the ways ticked, her words, the qualifiers and what shows it are sent as coordinates, explanation, qualifiers and evidence; her words are her reason", async () => {
  const p = await open("/app/contradiction/" + CAND, view(cand()));
  tick(p, "cd-coords", 0); tick(p, "cd-coords", 2);
  fill(p, { "cd-expl": "The notice is the later document.", "cd-qa": "the 2024 date", "cd-qb": "the date in the notice" });
  tick(p, "cd-evid", 0);
  await p.click(act(p, "contradictionclarify", "differs"));
  const r = p.byOp("contradictionclarify");
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].body, { candidate: CAND, choice: "differs", coordinates: ["time_or_occasion", "meaning"], explanation: "The notice is the later document.",
    qualifiers: { a: "the 2024 date", b: "the date in the notice" }, evidence: [{ fact: "time_or_occasion" }], reason: "The notice is the later document." });
});

test("R105 R32 clarify, they differ, with no words of her own: nothing is sent and the design's words are drawn in place; with no way ticked the plane refuses it (control)", async () => {
  const p = await open("/app/contradiction/" + CAND, view(cand()));
  tick(p, "cd-coords", 1); fill(p, { "cd-expl": "" });
  await p.click(act(p, "contradictionclarify", "differs"));
  assert.equal(p.byOp("contradictionclarify").length, 0, "no words of her own");
  assert.ok(says(main(p), S + "you.named.a.respect.but.gave"));
  const q = await open("/app/contradiction/" + CAND, view(cand(), { plane: { contradictionclarify: refusedIn("CLARIFY_COORDINATE_UNKNOWN", "Name a respect.") } }));
  fill(q, { "cd-expl": "Words of my own." });
  await q.click(act(q, "contradictionclarify", "differs"));
  assert.equal(q.byOp("contradictionclarify")[0].body.coordinates.length, 0, "the plane, not the page, refuses an empty list");
  assert.ok(says(main(q), "refusal.CLARIFY_COORDINATE_UNKNOWN"));
  /* control: the evidence the page offers is only a fact the record states (the stated dates), never the undetermined one */
  assert.equal(p.doc.getElementById("cd-evid").querySelectorAll("input").length, 1);
});

test("R105 R33 clarify, one is wrong: the passage chosen and her reason are sent; without a reason nothing is sent", async () => {
  const p = await open("/app/contradiction/" + CAND, view(cand()));
  fill(p, { "cd-wrong": "b", "cd-why": "The notice misquotes the amendment." });
  await p.click(act(p, "contradictionclarify", "one_wrong"));
  assert.deepEqual(p.byOp("contradictionclarify")[0].body, { candidate: CAND, choice: "one_wrong", wrongSide: "b", reason: "The notice misquotes the amendment." });
  const q = await open("/app/contradiction/" + CAND, view(cand()));
  fill(q, { "cd-why": " " });
  await q.click(act(q, "contradictionclarify", "one_wrong"));
  assert.equal(q.byOp("contradictionclarify").length, 0);
  assert.ok(says(main(q), S + "you.did.not.say.which.passage"));
  assert.equal(main(q).querySelector("#cd-why").closest(".cs-field").querySelector("button[data-act]"), null);
});

test("R105 R35 take up: the question (the plane's default offered, hers to change) and the side it is asked around are sent; an empty question sends nothing", async () => {
  const p = await open("/app/contradiction/" + CAND, view(cand()));
  assert.equal(p.doc.getElementById("cd-q").value, cand().default_question, "the default is shown, never sent for her");
  fill(p, { "cd-q": "Which date binds?", "cd-frame": "b" });
  await p.click(act(p, "contradictiontakeup"));
  assert.deepEqual(p.byOp("contradictiontakeup")[0].body, { candidate: CAND, question: "Which date binds?", frame: "b" });
  const q = await open("/app/contradiction/" + CAND, view(cand()));
  fill(q, { "cd-q": "  " });
  await q.click(act(q, "contradictiontakeup"));
  assert.equal(q.byOp("contradictiontakeup").length, 0);
  assert.ok(says(main(q), S + "the.question.is.empty.or.the"));
});

test("R105 R31 dismiss a lead: one of the three reasons and her words are sent; each of the three is offered, none preselected beyond the first the design shows", async () => {
  const p = await open("/app/contradiction/" + CAND, view(cand({ weight: "lead" })));
  const sel = p.doc.getElementById("cd-dis");
  assert.deepEqual(sel.querySelectorAll("option").map((o) => o.getAttribute("value")), ["same_fact_different_precision", "not_same_matter", "real_conflict_not_pursued"]);
  fill(p, { "cd-dis": "not_same_matter", "cd-diswords": "They are about two leases." });
  await p.click(act(p, "contradictiondismiss"));
  assert.deepEqual(p.byOp("contradictiondismiss")[0].body, { candidate: CAND, reason: "not_same_matter", words: "They are about two leases." });
  const q = await open("/app/contradiction/" + CAND, view(cand({ weight: "lead" })));
  await q.click(act(q, "contradictiondismiss"));
  assert.equal(q.byOp("contradictiondismiss")[0].body.reason, "same_fact_different_precision");
  assert.ok(!("words" in q.byOp("contradictiondismiss")[0].body), "control: no words, none sent");
});

const TAKEN = () => view(cand({ state: "taken_up", inquiry: INQ }));

test("R105 R36 conclude, they do not really conflict: the kind, the respects they differ in, the qualifiers, her conclusion and what would change it; each of the nine kinds is offered", async () => {
  const p = await open("/app/contradiction/" + CAND, TAKEN());
  assert.deepEqual(p.doc.getElementById("cd-kind").querySelectorAll("option").map((o) => o.getAttribute("value")),
    ["dissolved", "misquote", "transcription_or_reading_error", "superseded_version", "corrected", "double_speak_or_reversal", "obligation_against_act", "conflict_of_norms", "irreconcilable"]);
  tick(p, "cd-rcoords", 0); tick(p, "cd-rcoords", 5);
  fill(p, { "cd-rqa": "the 2024 date", "cd-concl": "They differ in time.", "cd-fals": "A letter dated after both." });
  await p.click(act(p, "contradictionresolve"));
  assert.deepEqual(p.byOp("contradictionresolve")[0].body, { inquiry: INQ, resolution: { kind: "dissolved", coordinates: ["time_or_occasion", "precision"], qualifiers: { a: "the 2024 date" } },
    conclusion: "They differ in time.", version: "main", falsifier: "A letter dated after both." });
});

test("R105 R36 conclude, one is wrong, two rules conflict, and nothing could change it: the wrong side and reason, the canon, and noFalsifier travel as the plane reads them", async () => {
  const p = await open("/app/contradiction/" + CAND, TAKEN());
  fill(p, { "cd-kind": "misquote", "cd-rwrong": "b", "cd-rwhy": "It misquotes.", "cd-concl": "The notice is wrong." });
  tick(p, "cd-nofals");
  await p.click(act(p, "contradictionresolve"));
  assert.deepEqual(p.byOp("contradictionresolve")[0].body, { inquiry: INQ, resolution: { kind: "misquote", wrong_side: "b", reason: "It misquotes." },
    conclusion: "The notice is wrong.", version: "main", noFalsifier: true });
  const q = await open("/app/contradiction/" + CAND, TAKEN());
  fill(q, { "cd-kind": "conflict_of_norms", "cd-canon": "later_over_earlier", "cd-concl": "The later rule governs.", "cd-fals": "A repeal." });
  await q.click(act(q, "contradictionresolve"));
  assert.deepEqual(q.byOp("contradictionresolve")[0].body, { inquiry: INQ, resolution: { kind: "conflict_of_norms", canon: "later_over_earlier" },
    conclusion: "The later rule governs.", version: "main", falsifier: "A repeal." });
  /* control: a question with no accepted reading offers none and sends no version (the plane's NO_CLAIM is then its answer) */
  /* the store holds no reading of this question: its `basisversions` is the store's own answer, over the world's door */
  const world = await storeWorld();
  const ann = await world.signIn("ann", { capabilities: ["contribute"] });
  assert.deepEqual((await ann.read("basisversions", { query: { id: INQ } })).versions, [], "the store holds no accepted reading of it");
  const { door, session } = world.boot(ann);
  const r = await open("/app/contradiction/" + CAND, { ...TAKEN(), plane: { ...TAKEN().plane, basisversions: undefined }, boot: { door, session } });
  fill(r, { "cd-concl": "C.", "cd-fals": "F." });
  assert.equal(r.doc.getElementById("cd-version"), null);
  await r.click(act(r, "contradictionresolve"));
  assert.ok(!("version" in r.byOp("contradictionresolve")[0].body));
});

test("R105 R36 conclude with her conclusion missing: nothing is sent and the design's words are drawn; with what would change it missing the plane refuses it (controls)", async () => {
  const p = await open("/app/contradiction/" + CAND, TAKEN());
  fill(p, { "cd-fals": "x" });
  await p.click(act(p, "contradictionresolve"));
  assert.equal(p.byOp("contradictionresolve").length, 0, "no conclusion");
  assert.ok(says(main(p), S + "the.question.could.not.be.concluded"));
  fill(p, { "cd-concl": "Done.", "cd-fals": "" });
  await p.click(act(p, "contradictionresolve"));
  assert.equal(p.byOp("contradictionresolve").length, 1, "the plane's NO_FALSIFIER is the answer to no falsifier and the box not ticked");
  assert.ok(!("falsifier" in p.byOp("contradictionresolve")[0].body) && !("noFalsifier" in p.byOp("contradictionresolve")[0].body));
});

test("R105 R51 ask to resolve: the candidate, her project and her words are sent (the shell asks its reason first, a shell mark); the project chosen is the one the notice came to", async () => {
  const p = await open(`/app/contradiction/${CAND}/${P}`, view(null, { plane: { contradictionnotices: notices(NOTICE()) } }));
  assert.equal(p.doc.getElementById("cd-proj").querySelectorAll("option").length, 1);
  fill(p, { "cd-optwords": "We need the letter." });
  await press(p, "contradictionoptin", { reason: "The team agreed." });
  const r = p.byOp("contradictionoptin");
  assert.equal(r.length, 1);
  assert.deepEqual({ ...r[0].body, reason: undefined }, { candidate: CAND, project: P, words: "We need the letter.", reason: undefined });
  const q = await open(`/app/contradiction/${CAND}/${P}`, view(null, { plane: { contradictionnotices: notices(NOTICE()) } }));
  await press(q, "contradictionoptin", { reason: "Agreed." });
  assert.ok(!("words" in q.byOp("contradictionoptin")[0].body), "control: no words, none sent");
});

/* the real world (store-assembly's store with the real door; the state is made by real acts, K5054): a page as `as` reads it over the world's door, `plane` scripting only the ops it names */
async function pageOn(world, as, path, o = {}) {
  const { door, session } = world.boot(as);
  const p = await boot({ screens: SERVED, door, session, path, ...o });
  await p.settle();
  return p;
}
/** State e by real acts: a conflict between two projects (`recipes.conflict`, the team's Claude account set up by its administrator), each of the two members' projects having asked to resolve it, so the projects
 *  are named to each other. Answers the conflict and `page(plane)`: the page of the first project's member, `plane` scripting only the ops it names. */
const revealed = async () => {
  const world = await storeWorld({ ai: true });
  const admin = await world.signIn(WORLD_FOUNDER_HANDLE);
  const c = await world.recipes.conflict(admin, { through: "revealed" });
  const path = `/app/contradiction/${c.candidate}/${c.projects[0]}`;
  return { world, c, path, page: (plane = {}) => pageOn(world, c.members[0], path, { plane }) };
};

test("R105 R53 respond: her words and only what she ticks to share (her cover, her email as typed) are sent; nothing ticked sends no disclosure", async () => {
  const w = await revealed();
  const body = (extra) => ({ candidate: w.c.candidate, project: w.c.projects[0], ...extra });
  const p = await w.page();
  fill(p, { "cd-resp": "Our notice came from the letter of September 12.", "cd-email": "dev@example.org" });
  tick(p, "cd-share", 0); tick(p, "cd-share", 1);
  await p.click(act(p, "contradictionrespond"));
  assert.deepEqual(p.byOp("contradictionrespond")[0].body, body({ text: "Our notice came from the letter of September 12.", disclose: { cover: true, email: "dev@example.org" } }));
  const q = await w.page();
  fill(q, { "cd-resp": "Only words.", "cd-email": "typed@example.org" });
  await q.click(act(q, "contradictionrespond"));
  assert.deepEqual(q.byOp("contradictionrespond")[0].body, body({ text: "Only words." }), "an address typed but not ticked is not shared");
  const r = await w.page();
  fill(r, { "cd-resp": "  " });
  await r.click(act(r, "contradictionrespond"));
  assert.equal(r.byOp("contradictionrespond").length, 0, "control: an empty response sends nothing");
  assert.ok(says(main(r), S + "the.response.is.empty"));
});

/* ---- a refusal of each act is drawn by the design's words, and the same act without that refusal is not (controls) ---- */

test("R105 every refusal the plane makes of the six acts is drawn beside the act by the design's words; an answer with no refusal draws none", async () => {
  const cases = [
    ["contradictionclarify", "CANDIDATE_CLOSED", [S + "someone.already.closed.this.and.it", S + "open.it.from.the.list.to"]],
    ["contradictionclarify", "CLARIFY_NO_EXPLANATION", [S + "you.named.a.respect.but.gave", S + "say.how.they.differ.or.accept"]],
    ["contradictionclarify", "EVIDENCE_NOT_SEEN", [S + "one.of.the.things.you.named", S + "choose.something.else.or.remove.it"]],
    ["contradictionclarify", "WRONG_SIDE_UNNAMED", [S + "you.did.not.say.which.passage", S + "choose.one.and.say.why.then"]],
    ["contradictionclarify", "WRONG_SIDE_NO_REASON", [S + "you.did.not.say.which.passage", S + "choose.one.and.say.why.then"]],
    ["contradictionclarify", "NO_SUCH_CANDIDATE", [S + "you.cannot.see.both.passages.so", S + "a.member.who.can.see.both"]],
    ["contradictiontakeup", "CANDIDATE_CLOSED", [S + "someone.already.closed.this.and.it", S + "if.it.was.already.taken.up"]],
    ["contradictiontakeup", "TAKE_UP_NO_QUESTION", [S + "the.question.is.empty.or.the", S + "word.the.question.and.choose.a"]],
    ["contradictiontakeup", "TAKE_UP_NO_FRAME", [S + "the.question.is.empty.or.the", S + "word.the.question.and.choose.a"]],
    ["contradictiondismiss", "RECORD_CANNOT_BE_DISMISSED", [S + "this.is.a.conflict.the.record.2", S + "say.how.the.two.differ.or"]],
    ["contradictiondismiss", "CANDIDATE_TAKEN_UP", [S + "someone.already.dismissed.or.resolved.it", S + "it.stays.as.they.left.it"]],
    ["contradictionresolve", "NOT_A_CONTRADICTION_INQUIRY", [S + "this.is.not.a.question.taken", S + "open.it.from.the.contradiction.itself"]],
    ["contradictionresolve", "RESOLUTION_INCOMPLETE", [S + "part.of.your.answer.is.missing", S + "fill.in.that.part.and.try"]],
    ["contradictionresolve", "NO_FALSIFIER", [S + "the.question.could.not.be.concluded", S + "add.what.is.missing.then.try"]],
    ["contradictionresolve", "NO_CONCLUSION", [S + "the.question.could.not.be.concluded", S + "add.what.is.missing.then.try"]],
    ["contradictionoptin", "NOT_A_PARTY", [S + "that.project.does.not.rest.on", S + "choose.a.project.that.does"]],
    ["contradictionoptin", "NOT_A_PROJECT_CONFLICT", [S + "this.is.a.lead.not.a"]],
    ["contradictionoptin", "CANDIDATE_CLOSED", [S + "someone.already.closed.it.and.it"]],
    ["contradictionrespond", "RESPONSE_BEFORE_OPT_IN", [S + "your.project.has.not.asked.to"]],
    ["contradictionrespond", "RESPONSE_NO_TEXT", [S + "the.response.is.empty", S + "say.something.in.your.own.words"]],
    ["contradictionrespond", "DISCLOSURE_NOT_YOURS", [S + "you.can.share.only.your.own", S + "untick.what.is.not.yours"]],
    ["contradictionrespond", "DISCLOSURE_MALFORMED", [S + "you.can.share.only.your.own", S + "untick.what.is.not.yours"]],
  ];
  const rev = await revealed();
  const setup = {
    contradictionclarify: async (o) => { const p = await open("/app/contradiction/" + CAND, { ...view(cand()), plane: { ...view(cand()).plane, ...o } }); tick(p, "cd-coords", 0); fill(p, { "cd-expl": "Words.", "cd-why": "Why." }); return [p, act(p, "contradictionclarify", "differs")]; },
    contradictiontakeup: async (o) => { const p = await open("/app/contradiction/" + CAND, { ...view(cand()), plane: { ...view(cand()).plane, ...o } }); return [p, act(p, "contradictiontakeup")]; },
    contradictiondismiss: async (o) => { const p = await open("/app/contradiction/" + CAND, { ...view(cand({ weight: "lead" })), plane: { ...view(cand({ weight: "lead" })).plane, ...o } }); return [p, act(p, "contradictiondismiss")]; },
    contradictionresolve: async (o) => { const p = await open("/app/contradiction/" + CAND, { ...TAKEN(), plane: { ...TAKEN().plane, ...o } }); fill(p, { "cd-concl": "C.", "cd-fals": "F." }); return [p, act(p, "contradictionresolve")]; },
    contradictionoptin: async (o) => { const p = await open(`/app/contradiction/${CAND}/${P}`, view(null, { plane: { contradictionnotices: notices(NOTICE()), ...o } })); return [p, act(p, "contradictionoptin")]; },
    contradictionrespond: async (o) => { const p = await rev.page(o); fill(p, { "cd-resp": "R." }); return [p, act(p, "contradictionrespond")]; },
  };
  const seen = new Set();
  for (const [op, code, keys] of cases) {
    const [p, b] = await setup[op]({ [op]: refusedIn(code, "The plane's own translation.") });
    if (op === "contradictionoptin") { await press(p, op, { reason: "r" }); } else await p.click(b);
    const slot = p.root().querySelector(`[data-slot="${b.getAttribute("data-ai")}"]`);
    for (const k of keys) assert.ok(says(slot, k), `${op} ${code}: ${k}`);
    assert.ok(!slot.textContent.includes("The plane's own translation."), `${op} ${code}: the design's words, not the plane's`);
    seen.add(op + code);
    /* control: the same act answered without a refusal draws no refusal in its place */
    const [q, c] = await setup[op]({ [op]: ok({ ok: true }) });
    if (op === "contradictionoptin") await press(q, op, { reason: "r" }); else await q.click(c);
    assert.equal(q.root().querySelector('[data-slot="' + c.getAttribute("data-ai") + '"] [data-gap="refused"]'), null, `${op}: no refusal on success`);
  }
  assert.equal(seen.size, cases.length);
  /* a code the design gives no words for falls to the plane's own translation, never a bare code (the shell's R83) */
  const [p, b] = await setup.contradictiontakeup({ contradictiontakeup: refusedIn("WORDS_MALFORMED", "The plane's own translation.") });
  await p.click(b);
  assert.ok(says(p.root().querySelector(`[data-slot="${b.getAttribute("data-ai")}"]`), "refusal.WORDS_MALFORMED") || p.root().textContent.includes("The plane's own translation."));
});

/* ---- writing help (entry 25): beside the fields she words herself, never beside a reason ---- */

test("R105 writinghelp: offered beside her own-words fields while the assistant is reachable, told only what she typed; none beside a reason field (control); none while the assistant is not reachable (control)", async () => {
  /* writinghelp never returns a draft (K5212: past its refusals it answers ASSISTANT_DRAFT_UNAVAILABLE), so no drafted text is scripted here */
  const reach = { assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }) };
  const p = await open("/app/contradiction/" + CAND, { ...view(cand()), plane: { ...view(cand()).plane, ...reach } });
  const helps = main(p).querySelectorAll('button[data-act="writinghelp"]');
  assert.deepEqual(helps.map((b) => b.getAttribute("data-field")).sort(), ["explanation", "question"]);
  for (const id of ["cd-why", "cd-wrong"]) assert.ok(!helps.some((b) => b.getAttribute("data-for") === id), "no help beside a reason");
  fill(p, { "cd-expl": "The notice is later." });
  await p.click(helps.find((b) => b.getAttribute("data-field") === "explanation"));
  assert.deepEqual(p.byOp("writinghelp")[0].body, { op: "contradictionclarify", field: "explanation", told: "The notice is later." });
  /* control: nothing told, nothing sent */
  fill(p, { "cd-q": "" });
  await p.click(main(p).querySelector('button[data-act="writinghelp"][data-field="question"]'));
  assert.equal(p.byOp("writinghelp").length, 1);
  assert.ok(main(p).querySelector('button[data-act="writinghelp"][data-field="question"]').closest(".mk-actwrap").querySelector('[data-gap="refused"]'), "told nothing: it says so beside the help");
  const q = await open("/app/contradiction/" + CAND, view(cand()));
  assert.equal(main(q).querySelector('button[data-act="writinghelp"]'), null, "not reachable: no help");
});

/* ---- words by key (R44; K874): every key the source names is held or listed as a gap ---- */

test("R105 R44 every screen.contradiction key the source reads is a held word (hasWord) or listed in GAP_WORDS, and no gap key is held already; control: the keys read from another screen's row are held", () => {
  const src = readFileSync(new URL("../../../src/screens-inquiry/contradiction.mjs", import.meta.url), "utf8");
  const used = new Set([...src.matchAll(/\bS \+ "([a-z0-9.]+)"/g)].map((m) => S + m[1]));
  assert.ok(used.size > 100, "the keys read: " + used.size);
  for (const k of used) assert.ok(hasWord(k) || GAP_WORDS.includes(k), `${k} is neither a held word nor a listed gap`);
  for (const k of GAP_WORDS) { assert.ok(used.has(k), `${k} is listed but not read`); assert.ok(!hasWord(k), `${k} is held now: drop it from GAP_WORDS`); }
  for (const k of ["screen.case-editor.scope.label", "project.start.title", "screen.calculation.question", "screen.security.cando.heading", "question.conclude.falsifier",
    "question.conclude.nofalsifier", "question.conclude.reading", "screen.settings.yours", "draft.machine.label", "ai.label.untested.writinghelp"]) assert.ok(hasWord(k), k);
});

test("R105 what the record cannot state is not drawn or offered: a stated date the record gives as undetermined draws no dates row and no evidence to name (control)", async () => {
  const facts = { ...FACTS, facts: FACTS.facts.map((f) => (f.fact === "stated_date" ? { ...f, undetermined: true, a: null, why: "x" } : f)) };
  const p = await open("/app/contradiction/" + CAND, view(cand(), { plane: { contradictionfacts: ok(facts) } }));
  assert.equal(main(p).querySelector('[data-fact="stated_date"]'), null);
  assert.equal(p.doc.getElementById("cd-evid"), null);
  assert.equal(main(p).querySelector('[data-fact="doctype"]'), null, "no held label for the doctype: no row (B92)");
  assert.ok(main(p).querySelector('[data-side="a"]'), "control: the passages stay drawn");
});

test("R105 writinghelp: beside her conclusion on a taken-up question and beside her response once the projects are named, never beside what would change it", async () => {
  /* no drafted text is scripted (K5212) */
  const reach = { assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }) };
  const c = await open("/app/contradiction/" + CAND, { ...TAKEN(), plane: { ...TAKEN().plane, ...reach } });
  assert.deepEqual(main(c).querySelectorAll('button[data-act="writinghelp"]').map((b) => b.getAttribute("data-field")), ["conclusion"]);
  fill(c, { "cd-concl": "They differ in time." });
  await c.click(main(c).querySelector('button[data-act="writinghelp"]'));
  assert.deepEqual(c.byOp("writinghelp")[0].body, { op: "contradictionresolve", field: "conclusion", told: "They differ in time." });
  const w = await revealed();
  const e = await w.page(reach);
  assert.deepEqual(main(e).querySelectorAll('button[data-act="writinghelp"]').map((b) => b.getAttribute("data-field")), ["response"]);
  fill(e, { "cd-resp": "Our notice came from the letter." });
  await e.click(main(e).querySelector('button[data-act="writinghelp"]'));
  assert.deepEqual(e.byOp("writinghelp")[0].body, { op: "contradictionrespond", field: "response", told: "Our notice came from the letter." });
});

/* ---- B22 entry 3: the candidate's `taken_up` ---- */
test("R105 entry 3 (B22): a candidate that carries `taken_up` (who, when) is drawn as taken up, with that line beside the question it became, and is not offered to take up again; control: without it (open) the take-up form is offered", async () => {
  const when = "2026-10-14T09:00:00Z";
  const p = await open("/app/contradiction/" + CAND, view(cand({ state: "taken_up", inquiry: INQ, taken_up: { member: "dev", at: when, words: "Which date applies?" } })));
  assert.equal(stateOf(p), "c");
  const line = main(p).querySelector("[data-taken-up]");
  assert.ok(line, "who took it up and when is drawn");
  assert.ok(line.textContent.includes("dev") && line.textContent.includes(day(when)), "the member and the date");
  assert.ok(line.querySelector("a.cs-ref"), "beside the question it became, as a reference");
  assert.equal(act(p, "contradictiontakeup"), null, "a contradiction taken up is not offered again");
  /* the record's `taken_up` is enough on its own: an open view that carries it is not offered the form either */
  const q = await open("/app/contradiction/" + CAND, view(cand({ state: "open", inquiry: INQ, taken_up: { member: "dev", at: when, words: null } })));
  assert.equal(stateOf(q), "c");
  assert.equal(act(q, "contradictiontakeup"), null);
  const open1 = await open("/app/contradiction/" + CAND, view(cand()));
  assert.ok(act(open1, "contradictiontakeup"), "control: an open one with no `taken_up` offers it");
  assert.equal(main(open1).querySelector("[data-taken-up]"), null);
});
