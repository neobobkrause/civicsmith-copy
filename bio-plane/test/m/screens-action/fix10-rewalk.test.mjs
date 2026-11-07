/* screens-action T51 re-walk 10 (K5290; walk E N3, N5, N7, N8 and the plan's hostile-response check): each at the walker's exact case. Real worlds where the
   owner's answer is what the screen draws (`conformance`, `entities`, `actions`); a scripted plane for a read whose shape a test feeds in. Every sentence
   is asserted by its key (R19). */
import test from "node:test";
import assert from "node:assert/strict";
import { matterWorld, determine } from "./world-A.mjs";
import { actionWorld, openIn, entityOf, answerOf, question as askedIn } from "./world-C.mjs";
import { open, main, text, ops, press, last, ok, W, DATA_PLANE, PLAN, PLAN_ID, ROUTES, beside } from "./page.mjs";

const slotOf = (p, b) => p.root().querySelector(`[data-slot="${b.getAttribute("data-ai")}"]`);
const optionTexts = (p, id) => p.doc.getElementById(id).querySelectorAll("option").map((o) => o.textContent.trim());
const until = async (p, f, what) => { for (let i = 0; i < 40; i++) { const v = f(); if (v) return v; await p.settle(); } throw new Error("waited for " + what); };

/* ---------- Matter ---------- */

test("R6, R45 (re-walk 10 N8): a determination whose outcomes are all compliant offers neither 'Open an escalation' nor 'Decline to escalate' and says what they need; control: a noncompliant one offers both", async () => {
  const w = await matterWorld();
  const det = await determine(w, { outcomes: { a: "compliant", b: "compliant" } });
  const p = await openIn(w.world, w.me, `/app/matter/${det}`);
  await p.settle();
  assert.ok(!ops(p).includes("escalationopen") && !ops(p).includes("declinetoescalate"), "neither act is drawn");
  assert.ok(text(p).includes(W("screen.matter.needs_a_recorded_determination_that_the_act")), "the row that says what an escalation needs");
  // control: the same page for a determination that found an act noncompliant
  const v = await matterWorld();
  const bad = await determine(v);
  const q = await openIn(v.world, v.me, `/app/matter/${bad}`);
  await q.settle();
  assert.ok(ops(q).includes("escalationopen") && ops(q).includes("declinetoescalate"), "both are drawn");
  assert.ok(!text(q).includes(W("screen.matter.needs_a_recorded_determination_that_the_act")), "and no row says they are unavailable");
});

test("R56 (re-walk 10 N5): the body of an act is chosen among every kind conformance accepts as an actor: an institution, a movement, an office and a body; a person is not one", async () => {
  const w = await matterWorld();
  const issuer = await entityOf(w.me, "institution", "City of Walkton");
  const movement = await entityOf(w.me, "movement", "Tenants Together");
  const office = await entityOf(w.me, "office", "Clerk's records desk");
  const body = await entityOf(w.me, "body", "Walkton Records Board");
  const person = await entityOf(w.me, "person", "Pat Quill");
  const p = await openIn(w.world, w.me, `/app/matter/${w.project}`);
  await p.settle();
  const shown = optionTexts(p, "mt-d-body");
  for (const label of ["City of Walkton", "Tenants Together", "Clerk's records desk", "Walkton Records Board"]) assert.ok(shown.includes(label), `${label} is offered`);
  assert.ok(!shown.includes("Pat Quill"), "a person is no body of an act");
  assert.ok(issuer && movement && office && body && person);
  // chosen, the entity id is what the plane is sent
  const find = (label) => p.doc.getElementById("mt-d-body").querySelectorAll("option").find((o) => o.textContent.trim() === label).getAttribute("value");
  assert.equal(find("City of Walkton"), issuer);
});

/* ---------- Request ---------- */

test("R57, R20, R59 (re-walk 10 N3; DEC-439 N3): the fold that names an office says so when the team holds no body to tie it to, and where one is added; once a body is held it is offered and the sentence is gone", async () => {
  const { world, me, project } = await actionWorld();
  const org = await entityOf(me, "institution", "Oak Roofing LLC");
  const p = await openIn(world, me, `/app/request/${project}`);
  await until(p, () => p.doc.getElementById("req-subject"), "the names to be offered");
  await press(p, "addresseesuggest", { values: { "req-subject": org } });
  const none = await answerOf(world, me, "addresseesuggest", { query: { subject: org } });
  assert.equal(none.result.offices.length, 0, "the owner knows no office for the name");
  // R73 (T53): with no body to choose, the body is named in words, never offered as an empty choice
  const fold = await until(p, () => p.doc.getElementById("req-noff-bodyname"), "the fold");
  assert.equal(p.doc.getElementById("req-noff-body"), null, "no empty choice of body");
  assert.ok(main(p).querySelector("[data-nobody]"), "the screen says none is held");
  assert.equal(text(p, main(p).querySelector("[data-nobody]")), W("screen.request.office.nobody"), "in the design's words for a team with no body");
  assert.ok(main(p).querySelector('a[href="/app/places"]'), "with the door where one is added (this member administers the team)");
  assert.ok(fold);
  // control: a team that holds a body offers it and does not say there is none
  const held = await entityOf(me, "body", "Walkton Records Board");
  const q = await openIn(world, me, `/app/request/${project}`);
  await until(q, () => q.doc.getElementById("req-subject"), "the names to be offered");
  await press(q, "addresseesuggest", { values: { "req-subject": org } });
  await until(q, () => q.doc.getElementById("req-noff-body"), "the fold");
  assert.deepEqual(optionTexts(q, "req-noff-body").filter(Boolean), ["Walkton Records Board"]);
  assert.equal(q.doc.getElementById("req-noff-body").querySelectorAll("option").find((o) => o.textContent.trim() === "Walkton Records Board").getAttribute("value"), held);
  assert.equal(q.doc.querySelector("[data-nobody]"), null, "and does not say there is none");
});

/* ---------- Plan ---------- */

test("R56, R53 (re-walk 10): a phase that addresses someone outside with no branch for a hostile response is drawn in the design's own sentence, with the phase by name, never the plane's", async () => {
  const checks = [{ check: "no_hostile_branch", scenario: 1, phase: "p1", says: "phase p1 addresses someone outside the team and has no branch for a hostile response: give it a checkpoint whose not_met judgement leads somewhere" }];
  const p = await open(`/app/plan/${PLAN_ID}`, { ...DATA_PLANE, plan: ok({ ...PLAN, checks }) });
  const strip = text(p, main(p).querySelector(".mk-checks2"));
  assert.ok(strip.includes(W("action-plans.says.phase_addresses_someone", { id: "Phase 1" })), "the design's sentence");
  assert.ok(!strip.includes(W("action-plans.index.phase_id_addresses_someone_outside", { id: "Phase 1" })), "not the plane's");
  assert.ok(!strip.includes("not_met") && !strip.includes("p1"), "no code or id is drawn");
  assert.ok(ROUTES.plan);
});

/* ---------- Start an action ---------- */

test("R56 (re-walk 10 N7): a refusal of what an action rests on or advances, with the owner's reasons, draws those reasons whole and not the code's sentence that tells her to leave it out", async () => {
  const { world, me, project } = await actionWorld();
  const q = await askedIn(world, me, project);
  const p = await openIn(world, me, `/app/actionnew/${project}`);
  p.doc.getElementById("an-kind").value = "request_for_comment";
  p.fire(p.doc.getElementById("an-kind"), "change");
  await p.settle();
  const b = await press(p, "actioncreate", { values: { "an-who": "The auditor", "an-ask": "Comment on the standard" }, reason: "x" });
  const real = await answerOf(world, me, "actioncreate", { body: { document: last(p, "actioncreate").body.document } });
  assert.equal(real.result.reason, "ACTION_BASIS_REFUSED");
  const slot = text(p, slotOf(p, b));
  assert.ok(!slot.includes(W("refusal.ACTION_BASIS_REFUSED")), "never the sentence that ends 'leave it out'");
  for (const d of real.result.findings.map((f) => f.detail).filter(Boolean)) assert.ok(slot.includes(d.replace(/\s+/g, " ").trim()), "each reason, whole");
  assert.ok(q);
});

test("R56 (re-walk 10 N7): the same when starting an option's action is refused; control: a refusal with no reasons draws the code's sentence alone", async () => {
  const refusedWith = (extra = {}) => ({ status: 200, json: { ok: true, result: { ok: false, reason: "ACTION_BASIS_REFUSED", code: "ACTION_BASIS_REFUSED", ...extra } } });
  const at = `/app/start-send/${PLAN_ID}~opt-1`;
  const p = await open(at, { ...DATA_PLANE, optionstart: refusedWith({ findings: [{ detail: "the question is not this project's" }] }) });
  const b = await press(p, "optionstart", { reason: "go" });
  assert.equal(beside(p, b), "the question is not this project's", "the owner's reason, alone");
  assert.ok(!beside(p, b).includes(W("refusal.ACTION_BASIS_REFUSED")));
  const c = await open(at, { ...DATA_PLANE, optionstart: refusedWith() });
  const d = await press(c, "optionstart", { reason: "go" });
  assert.equal(beside(c, d), W("refusal.ACTION_BASIS_REFUSED"));
});
