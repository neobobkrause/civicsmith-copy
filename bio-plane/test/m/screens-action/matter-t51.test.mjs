/* screens-action T51 fix round, the matter's entries R36, R45, R50, R51 (DEC-374, DEC-376): what is available by tier drawn row by row;
   the matter redrawn by what the record answers (no determination yet; recording and revising a determination); consequences recorded and
   revised, addressed, a success; the escalation's attach, hold, pause, resume and response. Every act sends the fields its owner declares
   (the harness checks each request against `DECLARED_OPS`), every sentence is a key read through W/PAGE. */
import test from "node:test";
import assert from "node:assert/strict";
import { matterWorld, determine, consequences, escalate, inWorld, FINDING_TITLE } from "./world-A.mjs";
import { openIn } from "./world.mjs";
import { writingHelpDraftHeld, writingHelpUnreachable } from "../wizard-scripts/fixtures.mjs";
import { open, main, text, ops, press, last, ok, refused, button, beside, choose, W, PAGE, DATA_PLANE, DET, ESC, ESCALATION, STATUS_NONE, PROJECT, ACTION_ID, READER, DETERMINATION, ACTIONS } from "./page.mjs";

const AT = `/app/matter/${DET}~${ESC}`;
const BARE = `/app/matter/${DET}`;
const REACH = { assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }) };
const STANDARDS = ok({ ok: true, items: [{ id: "STD-1", cite: "Lease §7.2" }, { id: "STD-9", cite: "Lease §9.1" }], truncated: false });
const PUBLISHED = { publishedlist: ok({ bundles: [], cases: [] }) };
const QUESTIONS = ok({ ok: true, project: PROJECT, items: [{ inquiry: "INQ-1", title: "Did the adjustments cause the higher rent?" }], cursor: null });
/** What the act sent less the reason the shell asks of a reasoned act (it is no field of the screen). */
const sent = (p, op) => { const { reason, ...rest } = last(p, op).body; return rest; };
const STAGE = (n, o = {}) => ({ ...DATA_PLANE, escalation: ok({ ...ESCALATION, stage: n, ...o }) });

// R36
test("R36: what is available by tier draws one row per kind of the answer {kinds, determinations, says}, never one blank row", async () => {
  const kinds = [{ kind: "complaint", label: "Complaint to the auditor", tier: 1, words: "tier one words" }, { kind: "grand_jury", label: null, tier: 3, words: "tier three words" }];
  const p = await open(AT, STAGE(5, { available: { ok: true, determination: DET, kinds, determinations: [], says: "the kinds the profile lists" } }));
  const t = text(p);
  assert.ok(t.includes(W("screen.matter.available")));
  const rows = main(p).querySelectorAll(".cs-row").map((r) => text(p, r));
  assert.ok(rows.some((r) => r.includes("Complaint to the auditor") && r.includes("tier one words")), "the labelled kind");
  assert.ok(rows.some((r) => r.includes("grand_jury") && r.includes("tier three words")), "the kind with no label is named by its kind");
  const blank = main(p).querySelectorAll(".cs-row").filter((r) => text(p, r) === "");
  assert.equal(blank.length, 0, "no blank row");
  // control: no `available` at all: no such section
  const q = await open(AT, STAGE(5));
  assert.ok(!text(q).includes(W("screen.matter.available")));
  // control: the answer that lists no kind says so in its own words and draws no row for it
  const r = await open(AT, STAGE(5, { available: { state: "undetermined", says: "the profile names none" } }));
  assert.ok(text(r).includes("the profile names none") && !text(r).includes(W("screen.matter.available")));
});

// R45
/** What the member would choose among, read back from the world: the project's held documents in the order `heldcaptures` lists them, each with its passage's content id. */
async function heldOf(w) {
  const held = (await w.me.read("heldcaptures", { query: { project: w.project, limit: "200", state: "held_and_vouched" } })).held;
  return Promise.all(held.map(async (h) => ({ bundle: h.bundle_id, sha: h.capture.sha256,
    content: (await w.me.act("contentmint", { body: { bundleId: h.bundle_id, extent: { kind: "document" } } })).content_id })));
}

test("R45 (b): a matter with no determination yet draws each act that needs one as unavailable, saying why, and offers to record a determination", async () => {
  const w = await matterWorld();
  const p = await openIn(w.world, w.me, `/app/matter/${w.project}`);
  assert.equal(p.byOp("determinations")[0].query.project, w.project);
  const t = text(p);
  for (const k of ["screen.matter.your_team_has_not_yet_said_whether", "screen.matter.what_a_breach_did_and_every_stage", "screen.matter.needs_a_recorded_determination_that_the_act",
    "screen.matter.saying_what_the_breach_did", "screen.matter.needs_the_same_determination", "screen.matter.attaching_an_action_holding_at_a_stage",
    "screen.matter.needs_an_escalation_which_needs_the_same", "act.escalationopen.label.matter"]) assert.ok(t.includes(W(k)), k);
  assert.deepEqual(ops(p).filter((o) => o !== "writinghelp"), ["determine"], "the escalation's acts are not drawn, only the way to a determination");
  // control: with a determination held there is no such list
  const det = await determine(w);
  const q = await openIn(w.world, w.me, `/app/matter/${w.project}`);
  assert.ok(!text(q).includes(W("screen.matter.needs_the_same_determination")));
  assert.ok(main(q).querySelector(`a[href="/app/matter/${encodeURIComponent(det)}"]`));
});

test("R45 (c): recording a determination sends exactly what `determine` declares: the act, the findings it rests on, the rule, what it requires and what was done, the outcome, the question when unclear, the cause", async () => {
  const w = await matterWorld();
  const docs = await heldOf(w);
  // R56 (walk E C2a (2)): the body is chosen among the offices the team holds and sent as the entity id
  const office = (await w.me.act("entitycreate", { body: { kind: "office", label: "City of Oakland", note: "The office." } })).entity_id;
  const p = await openIn(w.world, w.me, `/app/matter/${w.project}`);
  assert.ok(!main(p).querySelector("#mt-d-why"), "a first determination replaces nothing");
  assert.deepEqual(optText(p, "mt-d-body"), ["", "City of Oakland"], "the team's offices, by label");
  // the rules come from `standards`, the findings from the project's concluded questions and the published cases' own findings
  assert.equal(p.byOp("standards").length, 1);
  assert.deepEqual(p.byOp("publishedcase").map((r) => [r.query.id, r.query.edition]), [["CASE-2026-0101", "1"]], "each case's latest edition, once, by the case's id");
  assert.ok((await w.me.read("publishedcase", { query: { id: "CASE-2026-0101", edition: "1" } })).findings.some((f) => f.bundle_id === w.finding), "the store answers that read with the case's finding");
  assert.ok(main(p).querySelector(`#mt-d-std option[value='${w.std.b}']`));
  assert.ok(text(p).includes(FINDING_TITLE));
  await press(p, "determine", { reason: "recorded", values: { "mt-d-event": w.events.dated, "mt-d-role": "City Administrator", "mt-d-body": office, "mt-d-evidence-0": true,
    "mt-d-findings-0": true, "mt-d-std": w.std.a, "mt-d-req": "a council vote", "mt-d-did": "no vote was held", "mt-d-rd": "diverges", "mt-d-out-2": true, "mt-d-q": "Was there a vote?", "mt-d-cause": "a rushed signing" } });
  const b = last(p, "determine").body;
  assert.deepEqual(b.act, { event: w.events.dated, actor: { role: "City Administrator", body: office }, evidence: [docs[0].content] });
  assert.deepEqual(b.findings, [{ finding: w.finding }]);
  assert.deepEqual(b.standards, [{ standard: w.std.a, outcome: "unclear" }]);
  assert.deepEqual(b.rows, [{ standard: w.std.a, requires: "a council vote", did: "no vote was held", reading: "diverges" }]);
  assert.deepEqual(b.questions, [{ question: "Was there a vote?" }]);
  assert.deepEqual(b.cause, { statement: "a rushed signing", evidence: [docs[0].content] });
  assert.equal(b.project, w.project);
  assert.ok(!("supersedes" in b), "control: nothing superseded");
  assert.equal((await w.me.read("determinations", { query: { project: w.project, live: "true", limit: "200" } })).items.length, 1, "the store holds the determination the page recorded");
});

test("R45 (C6): the event, the passage and the finding are chosen among what the project holds, and a determination missing one is refused in the words that name it", async () => {
  const w = await matterWorld();
  const docs = await heldOf(w);
  /* the project's document naming the events it follows is the plane's (a project's followed events are an owner's act no door arm here makes): it names the
     world's own events and an entity, one reference severed */
  const entity = (await w.me.act("entitycreate", { body: { kind: "office", label: "City Administrator", note: "The office." } })).entity_id;
  const image = (refs) => ok({ "bundle.md": `---\nid: ${w.project}\ntitle: Stormwater\n${refs}---\nbody\n` });
  const refs = `references:\n  - target: ${w.events.dated}\n    rel: cites\n  - target: ${entity}\n    rel: cites\n  - target: ${w.events.undated}\n    rel: cites\n    status: severed\n`;
  const plane = { image: image(refs) };
  const path = `/app/matter/${w.project}`;
  const p = await openIn(w.world, w.me, path, plane);
  // the event: the events the project's document follows, severed references and entities left to the timeline's own set
  assert.equal(p.byOp("timeline")[0].query.set, `${w.events.dated},${entity}`);
  assert.equal(p.byOp("timeline")[0].query.captures, docs.map((d) => d.sha).join(","), "and the project's captures");
  // with no reference in the project's document the captures alone are asked
  const bare = await openIn(w.world, w.me, path, { image: ok({ "bundle.md": "---\nid: x\n---\n" }) });
  assert.equal(bare.byOp("timeline")[0].query.set, undefined);
  assert.ok(bare.byOp("timeline")[0].query.captures);
  assert.deepEqual(p.doc.getElementById("mt-d-event").querySelectorAll("option").map((o) => o.getAttribute("value")), ["", w.events.dated, w.events.undated]);
  // the passage: the project's documents, each by its title; the findings: its concluded questions only
  assert.equal(p.byOp("heldcaptures")[0].query.project, w.project);
  assert.ok(text(p).includes("Council minutes") && text(p).includes("The lease"));
  assert.ok(text(p).includes("Did the adjustments cause the higher rent?") && !text(p).includes("Who signed the memo?"));
  assert.ok(!main(p).querySelector("textarea#mt-d-evidence") && !main(p).querySelector("input#mt-d-findings") && !main(p).querySelector("input#mt-d-event"), "no box asks for an id");
  const all = { "mt-d-role": "City Administrator", "mt-d-body": "City of Oakland", "mt-d-std": w.std.a, "mt-d-req": "x", "mt-d-did": "y", "mt-d-out-0": true };
  const refusedWith = async (values, key) => {
    const q = await openIn(w.world, w.me, path, plane);
    const b = await press(q, "determine", { reason: "r", values: { ...all, ...values } });
    assert.ok(text(q, q.root().querySelector(`[data-slot="${b.getAttribute("data-ai")}"]`)).includes(W(key)), key);
    assert.equal(q.byOp("determine").length, 0, "nothing was sent");
    assert.equal(q.byOp("contentmint").length, 0, "nothing was marked citable");
  };
  await refusedWith({ "mt-d-evidence-0": true, "mt-d-findings-0": true }, "refusal.NO_SUCH_EVENT");
  await refusedWith({ "mt-d-event": w.events.dated, "mt-d-findings-0": true }, "refusal.ACT_INCOMPLETE");
  await refusedWith({ "mt-d-event": w.events.dated, "mt-d-evidence-0": true }, "refusal.NO_FINDINGS");
  // control: all three chosen sends, with the content id the store minted for the chosen document
  await press(p, "determine", { reason: "r", values: { ...all, "mt-d-event": w.events.undated, "mt-d-evidence-1": true, "mt-d-findings-0": true } });
  assert.deepEqual(p.byOp("contentmint").map((r) => r.body), [{ bundleId: docs[1].bundle, extent: { kind: "document" } }]);
  const b = last(p, "determine").body;
  assert.equal(b.act.event, w.events.undated);
  assert.deepEqual(b.act.evidence, [docs[1].content]);
  assert.deepEqual(b.findings, [{ finding: w.finding }]);
});

test("R45 (d): revising a determination names the one it replaces, opens with its values, and says why in the reason; the earlier is not edited", async () => {
  const w = await matterWorld();
  const det = await determine(w);
  const p = await openIn(w.world, w.me, `/app/matter/${det}`);
  assert.ok(!ops(p).includes("determine"), "the form is opened by the member's choice");
  await choose(p, "mt-mode", "determine");
  assert.ok(text(p).includes(W("screen.matter.the_earlier_determination_stays_readable_with_a")));
  assert.equal(main(p).querySelector("#mt-d-event").value, w.events.dated, "the event the act was part of is chosen by its id, drawn by its name");
  assert.equal(main(p).querySelector("#mt-d-role").value, "City Administrator");
  assert.equal(main(p).querySelector("#mt-d-req").value, "a council vote");
  assert.ok(button(p, "determine").textContent.includes(W("screen.matter.record_the_revised_determination")));
  await press(p, "determine", { reason: "the first rule did not bind the office", values: { "mt-d-out-1": false, "mt-d-out-0": true } });
  const b = last(p, "determine").body;
  assert.equal(b.supersedes, det);
  assert.equal(b.reason, "the first rule did not bind the office");
  assert.deepEqual(b.standards, [{ standard: w.std.a, outcome: "compliant" }]);
  assert.equal(b.act.event, w.events.dated);
  assert.deepEqual(b.act.evidence, [w.docs[0].content], "the passages it rested on are kept when none is chosen anew");
  assert.deepEqual(b.findings, [{ finding: w.finding }], "the findings it rested on are opened chosen");
  // control: a first determination is plain
  const other = await w.world.recipes.project(w.me, "Another matter");
  const q = await openIn(w.world, w.me, `/app/matter/${other}`);
  assert.ok(button(q, "determine").textContent.includes(W("screen.matter.record.this")), "a first determination reads `screen.matter.record.this`, a revision `screen.matter.record_the_revised_determination`");
});

test("R45: the determination's refusals are drawn by their words (refusal.<CODE>); control: a recorded one draws none", async () => {
  const w = await matterWorld();
  const det = await determine(w);
  const path = `/app/matter/${det}`;
  // everything chosen, so the owner's own refusal is what the member reads
  const chosen = { "mt-d-event": w.events.dated, "mt-d-evidence-0": true, "mt-d-findings-0": true };
  for (const code of ["NO_FINDINGS", "FINDING_NOT_PUBLISHED"]) {
    const p = await openIn(w.world, w.me, path, { determine: refused(code, "the owner's own sentence") });
    await choose(p, "mt-mode", "determine");
    const b = await press(p, "determine", { reason: "x", values: chosen });
    const beside = text(p, p.root().querySelector(`[data-slot="${b.getAttribute("data-ai")}"]`));
    assert.ok(beside.includes(W(`refusal.${code}`)), code);
    assert.ok(!beside.includes("the owner's own sentence"), code);
  }
  const p = await openIn(w.world, w.me, path);
  await choose(p, "mt-mode", "determine");
  const b = await press(p, "determine", { reason: "x", values: chosen });
  assert.ok(!text(p, p.root().querySelector(`[data-slot="${b.getAttribute("data-ai")}"]`)).includes(W("refusal.NO_FINDINGS")));
  assert.equal(p.byOp("determine").length, 1, "the store took the act");
});

test("R45: a member who may not act reads the read-only sentence and is offered no form and no act", async () => {
  const w = await matterWorld();
  const det = await determine(w);
  const empty = await w.world.recipes.project(w.me, "Another matter");
  /* a member of both projects whose capabilities are none: she sees them and may do nothing */
  const reader = await w.world.signIn("reader", { admin: false, capabilities: [] });
  for (const project of [w.project, empty]) {
    await w.me.act("projectinvite", { query: { projectId: project, handle: "reader" } });
    await reader.act("projectjoin", { query: { projectId: project } });
  }
  for (const path of [`/app/matter/${det}`, `/app/matter/${empty}`]) {
    const p = await openIn(w.world, reader, path);
    assert.deepEqual(ops(p), []);
    assert.ok(!main(p).querySelector("#mt-mode") && !main(p).querySelector("#mt-d-req"));
    assert.ok(text(p).includes(W("shell.readonly", { noun: W("shell.readonly.noun.matter"), members: W("shell.readonly.members") })));
  }
});

test("R45: a determination already replaced is read and offers no form to record, revise or add to", async () => {
  const p = await open(BARE, { ...DATA_PLANE, determination: ok({ ...DETERMINATION, live: false }) });
  assert.ok(!main(p).querySelector("#mt-mode"), "nothing to choose: every form works on the live determination");
  assert.ok(text(p).includes(W("screen.matter.notlive")));
  // control: the live one offers its forms
  const q = await open(BARE, DATA_PLANE);
  assert.ok(main(q).querySelector("#mt-mode option[value='determine']"));
});

// R50
test("R50: what the breach did is recorded with the rule it breached, who was affected, what it is measured in, the period and how it is known; each act sends its declared fields", async () => {
  const w = await matterWorld();
  const det = await determine(w);
  const p = await openIn(w.world, w.me, `/app/matter/${det}`);
  await choose(p, "mt-mode", "consequencerecord");
  assert.deepEqual(main(p).querySelectorAll("#mt-c-std option").map((o) => o.value), [w.std.a], "only a rule found noncompliant");
  assert.ok(main(p).querySelector(`#mt-c-cause option[value='${w.finding}']`), "the question showing the harm follows is picked from the project's questions");
  assert.equal(p.byOp("projectquestions")[0].query.project, w.project);
  await press(p, "consequencerecord", { reason: "recorded", values: { "mt-c-kind": "class", "mt-c-desc": "Households that paid the higher rent", "mt-c-unit": "money", "mt-c-amt": "$38,000",
    "mt-c-from": "2024-01-01", "mt-c-to": "2026-09-30", "mt-c-basis-0": false, "mt-c-basis-1": true, "mt-c-rat": "from the rent roll", "mt-c-cause": w.finding } });
  assert.deepEqual(sent(p, "consequencerecord"), { determination: det, standard: w.std.a, affected: { kind: "class", description: "Households that paid the higher rent" },
    period: { from: "2024-01-01", to: "2026-09-30" }, measure: { unit: "money", value: "38000" }, basis: { rationale: "from the rent roll", rests_on: [] }, causation: w.finding });
  // a range, and a part not yet known
  await press(p, "consequencerecord", { reason: "recorded", values: { "mt-c-amt": "100 to 200", "mt-c-basis-0": false, "mt-c-basis-1": false, "mt-c-basis-2": true, "mt-c-cause": "" } });
  const b = sent(p, "consequencerecord");
  assert.deepEqual(b.measure, { unit: "money", range: { low: "100", high: "200" } });
  assert.deepEqual(b.basis, { why: "not_assessed" });
  assert.ok(!("causation" in b), "control: no question, no causation");
  assert.equal((await w.me.read("consequencesof", { query: { determination: det } })).parts.length >= 1, true, "the store holds what the page recorded");
  // control: a determination with no noncompliant rule offers no such form
  const q = await open(AT, { ...DATA_PLANE, determination: ok({ ...DETERMINATION, standards: [{ ...DETERMINATION.standards[1] }] }) });
  assert.ok(!main(q).querySelector("#mt-mode option[value='consequencerecord']"));
});

test("R50: a recorded part is revised with the reason, only what was changed sent; control: the reason is the member's own", async () => {
  const w = await matterWorld();
  const det = await determine(w);
  const [c1, c2] = await consequences(w, det);
  const p = await openIn(w.world, w.me, `/app/matter/${det}`);
  await choose(p, "mt-mode", "consequencerevise");
  assert.deepEqual(main(p).querySelectorAll("#mt-r-part option").map((o) => o.value), [c1, c2]);
  await press(p, "consequencerevise", { values: { "mt-r-part": c1, "mt-r-amt": "41000", "mt-r-why": "the schedules were corrected" } });
  assert.deepEqual(last(p, "consequencerevise").body, { id: c1, reason: "the schedules were corrected", measure: { unit: "money", value: "41000" } });
  await press(p, "consequencerevise", { values: { "mt-r-part": c2, "mt-r-amt": "", "mt-r-desc": "Households on the rent roll", "mt-r-why": "named them" } });
  assert.deepEqual(last(p, "consequencerevise").body, { id: c2, reason: "named them", affected: { kind: "program", description: "Households on the rent roll" } });
  // control: no reason, nothing sent
  const n = p.byOp("consequencerevise").length;
  await press(p, "consequencerevise", { values: { "mt-r-why": "" } });
  assert.equal(p.byOp("consequencerevise").length, n);
  for (const code of ["ALREADY_SUPERSEDED", "CONSEQUENCE_NOT_NONCOMPLIANT", "MEASURE_INVALID", "PERIOD_INVALID"]) {
    const q = await open(AT, { ...DATA_PLANE, consequencerevise: refused(code, "the owner's own sentence") });
    await choose(q, "mt-mode", "consequencerevise");
    const b = await press(q, "consequencerevise", { values: { "mt-r-why": "x" } });
    const beside = text(q, q.root().querySelector(`[data-slot="${b.getAttribute("data-ai")}"]`));
    assert.ok(beside.includes(W(`refusal.${code}`)), code);
  }
});

test("R50: whether a part was addressed is recorded with its evidence, its reason and, for an addressed one, in what way; control: a part not addressed names no way", async () => {
  const w = await matterWorld();
  const det = await determine(w);
  const [c1] = await consequences(w, det);
  const [d1, d2] = w.docs.map((d) => d.content);   // the evidence a part is addressed by is content the record holds (a passage minted citable)
  const p = await openIn(w.world, w.me, `/app/matter/${det}`);
  await choose(p, "mt-mode", "addressedrecord");
  await press(p, "addressedrecord", { values: { "mt-a-part": c1, "mt-a-state-0": true, "mt-a-words-1": true, "mt-a-ev": `${d1} ${d2}`, "mt-a-why": "the city refunded it" } });
  assert.deepEqual(last(p, "addressedrecord").body, { id: c1, state: "addressed", evidence: [d1, d2], reason: "the city refunded it", words: ["mitigated"] });
  assert.equal((await w.me.read("consequencesof", { query: { determination: det } })).parts.find((x) => x.id === c1).addressed.state, "addressed", "the store holds the part as addressed");
  await press(p, "addressedrecord", { values: { "mt-a-state-0": false, "mt-a-state-1": true, "mt-a-why": "nothing was refunded" } });
  const b = last(p, "addressedrecord").body;
  assert.equal(b.state, "not_addressed");
  assert.ok(!("words" in b));
  for (const code of ["ADDRESSED_NO_EVIDENCE", "ADDRESSED_NO_REASON", "ADDRESSED_WORD_REFUSED", "ADDRESSED_NO_PERCENTAGE"]) {
    const q = await open(AT, { ...DATA_PLANE, addressedrecord: refused(code, "the owner's own sentence") });
    await choose(q, "mt-mode", "addressedrecord");
    const r = await press(q, "addressedrecord", { values: { "mt-a-why": "x" } });
    assert.ok(text(q, q.root().querySelector(`[data-slot="${r.getAttribute("data-ai")}"]`)).includes(W(`refusal.${code}`)), code);
  }
});

test("R50: a success is recognised with what changed, when, the evidence, the order of events and, if said, the cause; control: the optional ones left out are not sent", async () => {
  const w = await matterWorld();
  const det = await determine(w);
  const doc = w.docs[0].content;   // the evidence of a success is content the record holds
  const p = await openIn(w.world, w.me, `/app/matter/${det}`);
  await choose(p, "mt-mode", "successrecord");
  await press(p, "successrecord", { reason: "recorded", values: { "mt-s-st": "The city refunded the rent.", "mt-s-on": "2026-10-01", "mt-s-ev": doc, "mt-s-seq": "We wrote on September 3.", "mt-s-cause": "our letter and the audit" } });
  assert.deepEqual(sent(p, "successrecord"), { project: w.project, statement: "The city refunded the rent.", changed_on: "2026-10-01", evidence: [doc],
    sequence: "We wrote on September 3.", cause: { statement: "our letter and the audit", evidence: [doc] } });
  await press(p, "successrecord", { reason: "recorded", values: { "mt-s-seq": "", "mt-s-cause": "" } });
  const b = sent(p, "successrecord");
  assert.ok(!("sequence" in b) && !("cause" in b));
  for (const code of ["SUCCESS_NO_EVIDENCE", "SUCCESS_BAD_DATE", "SUCCESS_CAUSE_OWN_ACT_ONLY", "SUCCESS_NO_STATEMENT"]) {
    const q = await open(AT, { ...DATA_PLANE, successrecord: refused(code, "the owner's own sentence") });
    await choose(q, "mt-mode", "successrecord");
    const r = await press(q, "successrecord", { reason: "x" });
    assert.ok(text(q, q.root().querySelector(`[data-slot="${r.getAttribute("data-ai")}"]`)).includes(W(`refusal.${code}`)), code);
  }
});

test("R50: ending an escalation is refused in words while compliance is not restored or the consequences are undetermined or not addressed; control: an ended one draws no refusal", async () => {
  for (const code of ["COMPLIANCE_NOT_RESTORED", "CONSEQUENCES_UNDETERMINED", "CONSEQUENCES_NOT_ADDRESSED"]) {
    const p = await open(AT, { ...DATA_PLANE, escalationend: refused(code, "the owner's own sentence") });
    const b = await press(p, "escalationend", { confirm: true });
    const beside = text(p, p.root().querySelector(`[data-slot="${b.getAttribute("data-ai")}"]`));
    assert.ok(beside.includes(W(`refusal.${code}`)), code);
    assert.ok(!beside.includes("the owner's own sentence"), code);
  }
  const p = await open(AT, { ...DATA_PLANE, escalationend: ok({}) });
  const b = await press(p, "escalationend", { confirm: true });
  const beside = text(p, p.root().querySelector(`[data-slot="${b.getAttribute("data-ai")}"]`));
  for (const code of ["COMPLIANCE_NOT_RESTORED", "CONSEQUENCES_UNDETERMINED", "CONSEQUENCES_NOT_ADDRESSED"]) assert.ok(!beside.includes(W(`refusal.${code}`)), code);
});

// R51
test("R51: an action is attached to the stage with the member's reason, picked from the determination's actions; at the political accountability stage with its purpose and the rules it seeks enforced", async () => {
  const w = await matterWorld();
  const det = await determine(w);
  const e = await escalate(w, det, { stage: 2, attach: false });
  const p = await openIn(w.world, w.me, `/app/matter/${det}~${e.esc}`);
  await choose(p, "mt-mode", "escalationattach");
  assert.equal(p.byOp("actions")[0].query.determination, det);
  assert.ok(main(p).querySelector(`#mt-t-act option[value='${e.spare}']`));
  assert.ok(!main(p).querySelector("#mt-t-purpose"), "no purpose before the political accountability stage");
  await press(p, "escalationattach", { values: { "mt-t-act": e.spare, "mt-t-why": "it states the breach" } });
  assert.deepEqual(last(p, "escalationattach").body, { id: e.esc, action: e.spare, reason: "it states the breach" });
  assert.deepEqual((await w.me.read("escalation", { query: { id: e.esc } })).actions.map((a) => a.action), [e.spare], "the store holds the action attached");
  // at the political accountability stage: a second matter, advanced there by its acts
  const w7 = await matterWorld();
  const det7 = await determine(w7);
  const e7 = await escalate(w7, det7, { stage: 7 });
  const q = await openIn(w7.world, w7.me, `/app/matter/${det7}~${e7.esc}`);
  await choose(q, "mt-mode", "escalationattach");
  assert.deepEqual(main(q).querySelectorAll("#mt-t-purpose option").map((o) => o.value), ["official_request", "oversight_request", "audit_request", "testimony", "enforcing_legislation"]);
  await press(q, "escalationattach", { values: { "mt-t-act": e7.spare, "mt-t-why": "asks the council to act", "mt-t-purpose": "oversight_request" } });
  assert.deepEqual(last(q, "escalationattach").body, { id: e7.esc, action: e7.spare, reason: "asks the council to act", purpose: "oversight_request", standards: [w7.std.a] });
  for (const code of ["ALREADY_ATTACHED"]) {
    const r = await open(AT, { ...DATA_PLANE, actions: ok(ACTIONS), escalationattach: refused(code, "the owner's own sentence") });
    await choose(r, "mt-mode", "escalationattach");
    const b = await press(r, "escalationattach", { values: { "mt-t-why": "x" } });
    assert.ok(text(r, r.root().querySelector(`[data-slot="${b.getAttribute("data-ai")}"]`)).includes(W(`refusal.${code}`)), code);
  }
});

test("R51: 'Hold at this stage, with a reason' and 'Decline to escalate' are two acts: holding names the stage proposed and keeps the escalation open; declining names the determination", async () => {
  const w = await matterWorld();
  const det = await determine(w);
  const e = await escalate(w, det, { stage: 2 });
  const p = await openIn(w.world, w.me, `/app/matter/${det}~${e.esc}`);
  assert.equal(W("act.escalationdecline.label.matter") === W("act.declinetoescalate.label.matter"), false, "two words");
  await choose(p, "mt-mode", "escalationdecline");
  assert.ok(button(p, "escalationdecline").textContent.includes(W("act.escalationdecline.label.matter")));
  assert.ok(!ops(p).includes("declinetoescalate"), "an open escalation is not declined");
  await press(p, "escalationdecline", { values: { "mt-h-why": "we wait for the reply" } });
  assert.deepEqual(last(p, "escalationdecline").body, { id: e.esc, to: 3, reason: "we wait for the reply" });
  assert.equal((await w.me.read("escalation", { query: { id: e.esc } })).state, "open", "the store keeps the escalation open");
  // control: with nothing proposed there is nothing to hold at
  const q = await open(AT, { ...DATA_PLANE, escalation: ok({ ...ESCALATION, proposed: [] }) });
  assert.ok(!main(q).querySelector("#mt-mode option[value='escalationdecline']"));
  // and with no escalation the matter offers declining, never holding
  const r = await open(BARE, { ...DATA_PLANE, escalationstatus: ok(STATUS_NONE), declinetoescalate: ok({}) });
  assert.ok(ops(r).includes("declinetoescalate") && !ops(r).includes("escalationdecline"));
  for (const code of ["EDGE_NOT_PROPOSED", "NOT_OPEN", "ESCALATION_NO_REASON"]) {
    const s = await open(AT, { ...DATA_PLANE, escalationdecline: refused(code, "the owner's own sentence") });
    await choose(s, "mt-mode", "escalationdecline");
    const b = await press(s, "escalationdecline", { values: { "mt-h-why": "x" } });
    assert.ok(text(s, s.root().querySelector(`[data-slot="${b.getAttribute("data-ai")}"]`)).includes(W(`refusal.${code}`)), code);
  }
});

test("R51: pausing sends the reason; a paused escalation proposes nothing and is resumed, the reason optional; each only in its own state", async () => {
  const p = await open(AT, { ...DATA_PLANE, escalationsuspend: ok({}) });
  await choose(p, "mt-mode", "escalationsuspend");
  await press(p, "escalationsuspend", { values: { "mt-p-why": "the office asked for a month" } });
  assert.deepEqual(last(p, "escalationsuspend").body, { id: ESC, reason: "the office asked for a month" });
  assert.ok(!main(p).querySelector("#mt-mode option[value='escalationresume']"), "control: an open escalation is not resumed");
  const q = await open(AT, { ...DATA_PLANE, escalation: ok({ ...ESCALATION, state: "suspended", proposed: [] }), escalationresume: ok({}) });
  assert.ok(text(q).includes(W("screen.matter.escstate.suspended")));
  assert.ok(!main(q).querySelector("#mt-mode option[value='escalationsuspend']"), "control: a paused one is not paused again");
  await choose(q, "mt-mode", "escalationresume");
  await press(q, "escalationresume", { values: { "mt-u-why": "" } });
  assert.deepEqual(last(q, "escalationresume").body, { id: ESC }, "no reason: none sent");
  await press(q, "escalationresume", { values: { "mt-u-why": "the month is over" } });
  assert.deepEqual(last(q, "escalationresume").body, { id: ESC, reason: "the month is over" });
  for (const [op, code, state] of [["escalationsuspend", "ALREADY_SUSPENDED", "open"], ["escalationresume", "NOT_SUSPENDED", "suspended"]]) {
    const r = await open(AT, { ...DATA_PLANE, escalation: ok({ ...ESCALATION, state }), [op]: refused(code, "the owner's own sentence") });
    await choose(r, "mt-mode", op);
    const b = await press(r, op, { values: op === "escalationsuspend" ? { "mt-p-why": "x" } : {} });
    assert.ok(text(r, r.root().querySelector(`[data-slot="${b.getAttribute("data-ai")}"]`)).includes(W(`refusal.${code}`)), code);
  }
});

test("R51: the government's response is read at the response evaluation stage, from the replies received on the attached actions, with a reading and a reason", async () => {
  const action = ok({ ...DATA_PLANE.action.json.result, correspondence: [{ ord: 1, direction: "sent", at: "2026-10-02", party: "Office of the City Clerk" }, { ord: 2, direction: "received", at: "2026-10-15", party: "Office of the City Clerk" }] });
  const four = { ...STAGE(4), action };
  const w = await matterWorld();
  const det = await determine(w);
  const e = await escalate(w, det, { stage: 4 });
  const p = await openIn(w.world, w.me, `/app/matter/${det}~${e.esc}`);
  assert.equal(p.byOp("action").length, 0, "nothing is read before the form is opened");
  await choose(p, "mt-mode", "escalationevaluate");
  assert.equal(p.byOp("action")[0].query.id, e.action, "the attached action's replies");
  assert.deepEqual(main(p).querySelectorAll("#mt-e-resp option").map((o) => o.value), ["none", `${e.reply.action}|${e.reply.ord}`]);
  await press(p, "escalationevaluate", { values: { "mt-e-resp": `${e.reply.action}|${e.reply.ord}`, "mt-e-read": "partial", "mt-e-why": "it answers one of three requests" } });
  assert.deepEqual(last(p, "escalationevaluate").body, { id: e.esc, reading: "partial", reason: "it answers one of three requests", response: { action: e.reply.action, ord: e.reply.ord } });
  await press(p, "escalationevaluate", { values: { "mt-e-resp": "none", "mt-e-read": "none", "mt-e-why": "nothing by the deadline" } });
  assert.deepEqual(last(p, "escalationevaluate").body, { id: e.esc, reading: "none", reason: "nothing by the deadline" });
  // control: not at the stage, no such form
  const q = await open(AT, DATA_PLANE);
  assert.ok(!main(q).querySelector("#mt-mode option[value='escalationevaluate']"));
  for (const code of ["NOT_IN_EVALUATION", "NO_SUCH_RESPONSE", "ESCALATION_NO_REASON"]) {
    const r = await open(AT, { ...four, escalationevaluate: refused(code, "the owner's own sentence") });
    await choose(r, "mt-mode", "escalationevaluate");
    const b = await press(r, "escalationevaluate", { values: { "mt-e-why": "x" } });
    assert.ok(text(r, r.root().querySelector(`[data-slot="${b.getAttribute("data-ai")}"]`)).includes(W(`refusal.${code}`)), code);
  }
});

test("R51: stages are named in words, never shown by number: the ladder and the forms of each stage draw the stage's own word", async () => {
  for (const n of [1, 2, 3, 4, 5, 6, 7]) {
    const p = await open(AT, { ...STAGE(n), action: ok({ ...DATA_PLANE.action.json.result }), actions: ok(ACTIONS) });
    assert.equal(main(p).querySelector('[aria-current="step"]').textContent, W(`screen.matter.stage.${n}`));
    for (const mode of main(p).querySelectorAll("#mt-mode option").map((o) => o.value).filter((v) => v.startsWith("escalation"))) {
      await choose(p, "mt-mode", mode);
      const t = text(p);
      const form = t.slice(t.lastIndexOf(W("screen.matter.where_this_matter_stands")));
      assert.doesNotMatch(form, /[Ss]tage \d/, `${mode} at stage ${n}`);
    }
  }
});

test("R45, R50, R51: the matter's acts are the registry's; each form's act is drawn only for a member who may do it", async () => {
  const p = await open(AT, { ...DATA_PLANE, standards: STANDARDS, projectquestions: QUESTIONS, actions: ok(ACTIONS) });
  const offered = main(p).querySelectorAll("#mt-mode option").map((o) => o.value).filter(Boolean);
  assert.deepEqual(offered, ["determine", "consequencerecord", "consequencerevise", "addressedrecord", "successrecord", "escalationattach", "escalationdecline", "escalationsuspend"]);
  const r = await open(AT, { ...DATA_PLANE, whoami: ok(READER) });
  assert.equal(main(r).querySelectorAll("#mt-mode option").length, 0);
});

test("R45, R50, R51 (writinghelp): the helper is drawn beside each field the design marks for it only while the assistant is reachable, and sends the words typed", async () => {
  const plane = { ...DATA_PLANE, writinghelp: ok(writingHelpDraftHeld()) };
  const off = await open(AT, plane);
  for (const mode of ["determine", "consequencerecord", "consequencerevise", "addressedrecord", "successrecord", "escalationattach", "escalationdecline", "escalationsuspend"]) {
    await choose(off, "mt-mode", mode);
    assert.ok(!ops(off).includes("writinghelp"), `${mode}: not while the assistant is unreachable`);
  }
  const on = await open(AT, { ...plane, ...REACH });
  const want = { determine: 4, consequencerecord: 2, consequencerevise: 1, addressedrecord: 1, successrecord: 3, escalationattach: 1, escalationdecline: 1, escalationsuspend: 1 };
  for (const [mode, n] of Object.entries(want)) {
    await choose(on, "mt-mode", mode);
    assert.equal(ops(on).filter((o) => o === "writinghelp").length, n, mode);
  }
  await choose(on, "mt-mode", "escalationdecline");
  const help = await press(on, "writinghelp", { values: { "mt-h-why": "we wait" } });
  assert.equal(last(on, "writinghelp").body.told, "we wait");
  assert.equal(last(on, "writinghelp").body.field, "reason");
  assert.equal(last(on, "writinghelp").body.op, "escalationdecline", "the help request carries the act the words are for (wizard-scripts R46)");
  /* wizard-scripts' published answers (the real op never returns a draft: the door makes it, K5212): a refused help draws its words and leaves what she typed */
  assert.equal(main(on).querySelector("#mt-h-why").value, "we wait", "a refusal replaces nothing she typed");
  assert.ok(beside(on, help).includes(W("refusal.WRITING_HELP_DRAFT_HELD")), "the refusal is drawn by its key");
  const unbound = await open(AT, { ...DATA_PLANE, ...REACH, writinghelp: ok(writingHelpUnreachable()) });
  await choose(unbound, "mt-mode", "escalationdecline");
  const gone = await press(unbound, "writinghelp", { values: { "mt-h-why": "we wait" } });
  assert.equal(main(unbound).querySelector("#mt-h-why").value, "we wait");
  assert.ok(beside(unbound, gone).includes(W("refusal.AGENT_WORKER_UNBOUND")), "the door's refusal with the assistant unbound is drawn by its key");
});

test("R45 (writinghelp control): a help button that names no act sends no help request", async () => {
  const on = await open(AT, { ...DATA_PLANE, ...REACH, writinghelp: ok(writingHelpDraftHeld()) });
  await choose(on, "mt-mode", "escalationdecline");
  const b = button(on, "writinghelp");
  b.removeAttribute("data-forop");
  const before = on.byOp("writinghelp").length;
  await press(on, b, { values: { "mt-h-why": "we wait" } });
  assert.equal(on.byOp("writinghelp").length, before);
});

// R19 through R45, R50, R51: every sentence a form draws is a key of the word table, read through W
const FORM_KEYS = {
  determine: ["screen.matter.the_earlier_determination_stays_readable_with_a", "screen.matter.it_is_not_edited", "screen.matter.whether_the_act_met_the_rule_with", "screen.matter.the_event_it_was_part_of",
    "screen.matter.f.body", "screen.matter.f.role", "screen.matter.revise", "screen.matter.replaces", "screen.matter.act", "screen.matter.a_new_determination_that_replaces_the_earlier",
    "screen.matter.f.did", "screen.matter.f.rule", "screen.matter.f.determination", "screen.matter.f.cause", "screen.matter.if_you_choose_unclear", "screen.matter.f.findings",
    "screen.matter.the_evidence_that_the_act_happened", "screen.actionnew.rests", "screen.matter.a_determination_rests_on_findings_your_team",
    "screen.matter.the_rule_it_is_measured_against", "screen.matter.what_the_rule_requires", "screen.matter.how_the_two_compare", "screen.matter.against_this_rule_the_act_is",
    "screen.matter.f.outcome.compliant", "screen.matter.f.outcome.noncompliant", "screen.matter.f.outcome.unclear", "screen.matter.each_rule_gets_its_own_outcome", "screen.matter.they_are_never_combined_into_one_verdict",
    "screen.matter.the_question_that_would_settle_it", "screen.matter.the_question_is_opened_in_this_project", "screen.matter.why_it_happened_optional", "screen.matter.say_a_cause_only_if_evidence_you",
    "screen.matter.otherwise_leave_it_empty_and_the_determination", "screen.matter.this_cannot_be_edited_afterward", "screen.matter.a_mistake_is_put_right_by_recording", "screen.matter.record_the_revised_determination"],
  consequencerecord: ["screen.matter.each_part_says_what_was_done_and", "screen.matter.the_rule_it_breached", "screen.matter.who_or_what_was_affected", "screen.matter.f.describe", "screen.matter.kind.class", "screen.matter.kind.office", "screen.matter.unit.money", "screen.matter.unknown", "shell.reason",
    "screen.matter.what_it_is_measured_in", "screen.matter.amount_or_the_lowest_and_highest_it", "screen.matter.worked_out_from_figures_in_the_record", "screen.matter.my_own_assessment_with_my_reason",
    "screen.matter.if_you_assess_it_yourself", "screen.matter.name_what_the_assessment_rests_on", "screen.matter.a_part_you_assess_is_shown_as", "screen.matter.the_question_showing_the_harm_follows_from",
    "screen.matter.without_a_concluded_question_the_part_is", "screen.matter.zero_is_recorded_as_no_harm_claimed"],
  consequencerevise: ["screen.matter.change_what_is_wrong_say_why_then", "screen.matter.consequences", "screen.matter.why_you_are_revising_it"],
  addressedrecord: ["screen.matter.one_part_at_a_time_with_evidence", "screen.matter.in_what_way_addressed_only", "label.harmaddressed.remedied", "label.harmaddressed.mitigated", "label.harmaddressed.compensated",
    "label.harmaddressed.acknowledged", "screen.matter.way.cannot", "screen.matter.f.part", "screen.matter.f.partwas", "screen.matter.f.addressed", "screen.matter.f.notaddressed", "screen.matter.there_is_no_percentage_of_redress", "screen.matter.part_of_a_remedy_does_not_end"],
  successrecord: ["screen.matter.a_change_the_matter_brought_about_in", "screen.matter.the_order_of_events_optional", "screen.matter.the_order_of_events_is_shown_as", "screen.matter.if_you_say_why_it_happened", "screen.matter.f.when", "screen.matter.f.cause",
    "screen.matter.your_team_s_own_act_cannot_be"],
  escalationattach: ["screen.matter.your_reason_for_attaching_it", "screen.matter.only_a_breach_action_that_rests_on"],
  escalationdecline: ["screen.matter.you_can_move_to_it_or_hold", "screen.matter.why_you_are_holding_at_this_stage", "screen.matter.holding_keeps_the_proposal_in_view_with", "screen.matter.the_escalation_stays_open"],
  escalationsuspend: ["screen.matter.why_you_are_suspending_it", "screen.matter.a_suspended_escalation_proposes_no_stage", "screen.matter.it_is_not_ended_and_any_deadline"],
  escalationevaluate: ["screen.matter.the_response_you_are_reading", "screen.matter.no_response_by_the_deadline", "screen.matter.a_reading_of_complied_does_not_end", "screen.matter.it_ends_only_when_compliance_is_restored"],
};
test("R45, R50, R51 (R19): each form draws its sentences by their keys, and every act of the screen is explained by its own word", async () => {
  const p = await open(AT, { ...STAGE(4), standards: STANDARDS, projectquestions: QUESTIONS, actions: ok(ACTIONS) });
  for (const [mode, keys] of Object.entries(FORM_KEYS)) {
    await choose(p, "mt-mode", mode);
    const t = text(p);
    for (const k of keys) assert.ok(t.includes(PAGE(k)), `${mode}: ${k}`);
    assert.ok(button(p, mode).textContent.includes(PAGE(mode === "determine" ? "screen.matter.record_the_revised_determination" : `act.${mode}.label.matter`)), mode);
  }
  const r = await open(AT, { ...DATA_PLANE, escalation: ok({ ...ESCALATION, state: "suspended", proposed: [] }) });
  await choose(r, "mt-mode", "escalationresume");
  for (const k of ["screen.matter.no_stage_is_proposed_while_it_is", "screen.matter.nothing_already_recorded_is_lost", "screen.matter.why_you_are_resuming_it_optional"]) assert.ok(text(r).includes(PAGE(k)), k);
  assert.ok(button(r, "escalationresume").textContent.includes(PAGE("act.escalationresume.label.matter")));
});

/* ---------- R45, R50, R51 (DEC-387, B424): the matter's own rows ---------- */

const optText = (p, id) => p.doc.getElementById(id).querySelectorAll("option").map((o) => o.textContent.trim());
const labelOf = (p, id) => p.doc.getElementById(id).parentNode.querySelector("label, legend").textContent.trim();

test("R45 (DEC-387): the matter with no determination yet says so and draws the escalation's acts as 'Not available yet'; recording reads 'Record this determination' and the form's own labels", async () => {
  const { world, me } = await inWorld({ handle: "olive" });
  const p = await openIn(world, me, `/app/matter/${await world.recipes.project(me, "Stormwater")}`);
  for (const k of ["screen.matter.nodet", "screen.matter.unavailable"]) assert.ok(text(p).includes(W(k)), k);
  // a project's matter with nothing recorded opens the one form there is
  assert.ok(button(p, "determine").textContent.includes(W("screen.matter.record.this")));
  for (const k of ["screen.matter.act", "screen.matter.f.determination"]) assert.ok(text(p).includes(W(k)), k);
  assert.equal(labelOf(p, "mt-d-role"), W("screen.matter.f.role"));
  assert.equal(labelOf(p, "mt-d-body"), W("screen.matter.f.body"));
  assert.equal(labelOf(p, "mt-d-did"), W("screen.matter.f.did"));
  assert.equal(labelOf(p, "mt-d-cause"), W("screen.matter.f.cause"));
  assert.deepEqual(optText(p, "mt-d-rd"), [W("screen.matter.f.compare.matches"), W("screen.matter.f.compare.differs"), W("screen.matter.f.compare.open")]);
  // control: the first determination names nothing it replaces
  assert.ok(!text(p).includes(W("screen.matter.replaces")));
});

test("R45 (DEC-387): revising reads 'Revise the determination' and 'What it replaces'; the rule's choice is 'Rule'", async () => {
  const p = await open(AT, { ...DATA_PLANE, standards: STANDARDS, ...PUBLISHED });
  await choose(p, "mt-mode", "determine");
  for (const k of ["screen.matter.revise", "screen.matter.replaces", "screen.matter.a_new_determination_that_replaces_the_earlier"]) assert.ok(text(p).includes(W(k)), k);
  assert.equal(labelOf(p, "mt-d-std"), W("screen.matter.f.rule"));
});

test("R50 (DEC-387): consequences read the matter's kinds and units, 'Describe them', 'Not known yet' and the reason behind a fold 'If you assess it yourself'; addressing reads 'The part', 'This part was' and 'Can't be undone'; a success reads 'When it changed'", async () => {
  const p = await open(AT, { ...STAGE(4), standards: STANDARDS, projectquestions: QUESTIONS });
  await choose(p, "mt-mode", "consequencerecord");
  assert.deepEqual(optText(p, "mt-c-kind"), ["class", "fund", "program", "service", "office", "other"].map((k) => W("screen.matter.kind." + k)));
  assert.deepEqual(optText(p, "mt-c-unit"), ["money", "benefits", "services", "time", "count"].map((k) => W("screen.matter.unit." + k)));
  assert.equal(labelOf(p, "mt-c-desc"), W("screen.matter.f.describe"));
  assert.ok(text(p).includes(W("screen.matter.unknown")));
  const fold = p.doc.getElementById("mt-c-rat").closest("details");
  assert.ok(fold && fold.querySelector("summary").textContent.trim() === W("screen.matter.if_you_assess_it_yourself"), "the reason sits behind the fold");
  assert.equal(labelOf(p, "mt-c-rat"), W("shell.reason"));
  await choose(p, "mt-mode", "addressedrecord");
  for (const k of ["screen.matter.f.part", "screen.matter.f.partwas", "screen.matter.f.addressed", "screen.matter.f.notaddressed", "screen.matter.way.cannot"]) assert.ok(text(p).includes(W(k)), k);
  await choose(p, "mt-mode", "successrecord");
  assert.equal(labelOf(p, "mt-s-on"), W("screen.matter.f.when"));
  assert.equal(p.doc.getElementById("mt-s-cause").closest("details").querySelector("summary").textContent.trim(), W("screen.matter.if_you_say_why_it_happened"));
  assert.equal(labelOf(p, "mt-s-cause"), W("screen.matter.f.cause"));
});

test("R51 (DEC-387): attaching at the political accountability stage reads 'Its purpose' and its five options by key; the response reads the three readings by key and 'No response' for the reply; pausing reads 'Pause it'", async () => {
  const q = await open(AT, { ...STAGE(7), actions: ok(ACTIONS) });
  await choose(q, "mt-mode", "escalationattach");
  assert.equal(labelOf(q, "mt-t-purpose"), W("screen.matter.f.purpose"));
  assert.deepEqual(optText(q, "mt-t-purpose"), ["official", "oversight", "audit", "testimony", "legislation"].map((k) => W("screen.matter.f.purpose." + k)));
  const r = await open(AT, { ...STAGE(4, { actions: [{ action: ACTION_ID, stage: 2 }] }) });
  await choose(r, "mt-mode", "escalationevaluate");
  assert.deepEqual(optText(r, "mt-e-read"), [W("screen.matter.reading.complied"), W("screen.matter.reading.partial"), W("screen.matter.reading.denied"), W("screen.matter.no_response_by_the_deadline")]);
  assert.equal(optText(r, "mt-e-resp")[0], W("screen.matter.reading.none"));
  await choose(r, "mt-mode", "escalationsuspend");
  assert.ok(text(r).includes(W("screen.matter.pause")));
});

test("R6 (DEC-387): the stages are named without a number: 'Move on to the next stage' carries the stage's name, and a stage listed on an action is 'at' its name", async () => {
  const p = await open(AT, STAGE(2));
  const advance = button(p, "escalationadvance");
  assert.ok(advance.textContent.includes(W("screen.matter.advance", { stage: W("screen.matter.stage.3") })));
  assert.ok(!/\d/.test(W("screen.matter.stage.3")), "the stage's name holds no digit");
  for (let n = 1; n <= 7; n++) assert.ok(!/\d/.test(W("screen.matter.stage." + n)), `stage ${n}`);
});
