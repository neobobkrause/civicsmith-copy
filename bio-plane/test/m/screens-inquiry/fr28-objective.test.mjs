/* screens-inquiry R106 (FR-28 entry 23; C46; DEC-374; `intent` R2–R18): the `objective` screen, on interface-shell's served page over a
 * scripted plane. Each state of the drawing is drawn from its reads; each act sends exactly the fields `intent` declares (the harness's
 * guard checks every request against the owner's declaration, so a mismatch fails the test that pressed the act); each refusal has its
 * control. Words by key (R44): a test asserts a key (`hasWord`) or compares the page with `word(key, vars)`, never copies a sentence. A
 * design word the table does not yet hold is in `PENDING_WORDS` (reported to BOB as a GAP) and is compared as the key it is drawn as. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";
import { SCREENS } from "../../../src/screens-inquiry/index.mjs";
import { PENDING_WORDS } from "../../../src/screens-inquiry/objective.mjs";
import { boot, ok, refusedIn } from "../interface-shell/harness.mjs";
import { rawKeys, fill, storeWorld } from "./fixtures.mjs";
import { writingHelpDraftHeld, writingHelpUnreachable } from "../wizard-scripts/fixtures.mjs";

const REGISTRY = JSON.parse(readFileSync(new URL("../../../../docs/development/ux-substrate/screens/registry.json", import.meta.url), "utf8"));
/* the world (store-assembly's store with the real door, K5054): `dev` owns the project "Pothole repairs" she started and `mai` is joined to it; the team holds two flows
   (progressions) and three parties (entities), one aspiration of the team and one of the project (a departure from the team's, a dead end on the project's) and
   every one is made by the real act that makes it. `bare` is the same project and members with no flow, party or aspiration held. */
async function team({ held = true } = {}) {
  const world = await storeWorld();
  const dev = await world.signIn("dev", { capabilities: ["contribute", "create_projects"] });
  const project = await world.recipes.project(dev, "Pothole repairs");
  const mai = await world.signIn("mai", { capabilities: ["contribute"] });
  await dev.act("projectinvite", { query: { projectId: project, handle: "mai" } });
  await mai.act("projectjoin", { query: { projectId: project } });
  const out = { world, dev, mai, project };
  if (!held) return out;
  const stage = (key, label) => ({ key, label, cardinality: "1", required: "always" });
  await dev.act("progressiondefine", { body: { progressionKey: "PRG-rent", label: "Lease rent flow", basis: "the team's reading of the lease", stages: [stage("invoiced", "Invoiced"), stage("authorized", "Council signed off")] } });
  await dev.act("progressiondefine", { body: { progressionKey: "PRG-permits", label: "Permit flow", basis: "the team's reading of the permit office", stages: [stage("filed", "Filed")] } });
  const party = async (kind, label) => (await dev.act("entitycreate", { body: { kind, label, note: `${label}, held for the objective's measure.` } })).entity_id;
  out.city = await party("institution", "Springfield Parks Dept");
  out.auth = await party("institution", "The Transit Authority");
  out.person = await party("person", "Mai Chen");
  const admin = await world.signIn("admin");
  out.team = (await admin.act("aspirationdeclare", { body: { scope: "group", statement: "Ask for every record in writing." } })).aspiration;
  out.ours = (await dev.act("aspirationdeclare", { body: { scope: "project", owner: project, statement: "Check every amount against a second document." } })).aspiration;
  out.stays = (await admin.act("aspirationdeclare", { body: { scope: "group", statement: "Keep every answer in the record." } })).aspiration;   /* one the project has not departed from: the departed one is no longer listed to depart from */
  await dev.act("aspirationdepart", { body: { project, aspiration: out.team, reason: "The city only answers phone requests here." } });
  await dev.act("aspirationdeadend", { body: { aspiration: out.ours, note: "We asked the Authority for the 2019 vote record." } });
  return out;
}
const T = await team();
const P = T.project;
const AT = "/app/objective/" + P;
const KEY = (s) => "screen.objective." + s;
/* a word held, else (a pending design word) the key the screen draws it as */
const W = (key, vars) => (hasWord(key) ? word(key, vars || {}) : key);
const SCREEN = SCREENS.find((s) => s.id === "objective");

const COND = { progression: "PRG-rent", entity: T.city, relation: null, filter: null, required: { grade: "B", stages: ["authorized"] }, satisfied: { share: 90 } };
const short = (id, label, why) => ({ entity_id: id, entity_label: label, grade: "C", grade_determined: true, why });
const PROGRESS = { ok: true, project: P, objective: "Whether the city kept the terms of its lease.", condition: COND, set_by: "dev", set_at: "2026-10-08T09:00:00Z",
  computable: true, matched: 12, meeting: 9, satisfied: false, computed_at: "2026-10-20T09:00:00Z", limit: 1000, truncated: false,
  short: [short("ENT-p1", "Invoice 14200 for March", { stages_missing: ["authorized"] }),
    short("ENT-p2", "Invoice 9800 for April", { grade_reached: "C", grade_required: "B", weakest_link: null }),
    short("ENT-p3", "Invoice 11500 for May", { stages_missing: ["invoiced", "authorized"] })],
  undetermined: [{ entity_id: "ENT-p4", entity_label: "Payment 4", why: "x" }] };
const NOCOND = { ok: true, project: P, objective: "Whether the city kept the terms of its lease.", condition: null, computable: false, why: "x",
  matched: null, meeting: null, short: null, undetermined: null, satisfied: null, computed_at: "2026-10-20T09:00:00Z" };
const GAPS = { ok: true, project: P, condition: COND, gaps: PROGRESS.short.map((s) => ({ key: "intent::" + P + "::PRG-rent::" + s.entity_id, source: "intent", kind: "objective-gap",
  grade: s.grade, basis: s.why.stages_missing ? { stages_missing: s.why.stages_missing, says: "x" } : { grade_reached: s.why.grade_reached, grade_required: s.why.grade_required, says: "x" },
  instances: [{ entity_id: s.entity_id, entity_label: s.entity_label, documents: [] }], surfaced_by: "machine" })) };
const PROPOSALS = { ok: true, project: P, proposals: [GAPS.gaps[0],
  { key: "PRG-rent::authorized", source: "progressions", kind: "missing_predecessor", progression_key: "PRG-rent", progression_label: "Lease rent flow",
    stage_key: "authorized", stage_label: "Council signed off", instances: [{ entity_id: T.city, entity_label: "Springfield Parks Dept", grade: "C", grade_determined: true }], n: 1 }],
  count: 2, set_aside: [] };
const ASP_TEAM = { id: T.team, statement: "Ask for every record in writing." };
const ASP_OURS = { id: T.ours, statement: "Check every amount against a second document." };
const GOAL = { id: "GOAL-2026-0001", statement: "Close the unvoted collections loophole.", bounds: "only leases the council has the right to amend",
  aspiration: null, objectives: [{ project: P, by: "dev", at: "2026-10-09T09:00:00Z" }], state: "open", closed_reason: null, author: "rosa", at: "2026-10-01T09:00:00Z" };

/* the acts the page sends stay answered by a bare `ok` here (what each sends is asserted, not what the owner does with it); every read not named is the world's */
const ACTS = Object.fromEntries(SCREEN.acts.filter((a) => a.op !== "writinghelp").map((a) => [a.op, ok(null)]));
function plane(o = {}) {
  return {
    ...ACTS,
    /* the measure and its count, the proposals and the goals are scripted: no act of the world sets a measure over payments it counts, or proposes or declares them with these shapes */
    objectiveprogress: ok(PROGRESS), objectivegaps: ok(GAPS), intentproposals: ok(PROPOSALS),
    list: ok({ bundles: [{ bundle_id: GOAL.id, title: "Close the unvoted collections loophole" }] }),
    goal: ok({ ok: true, goal: GOAL }),
    assistantstate: ok({ on: true }), accountreference: ok({ held: true }),
    ...o,
  };
}
/** The page as `mai` reads it over the world's door (`world`, else the shared team): `plane` overrides only the ops it names; a key set to undefined is the world's own answer. */
const open = async (o = {}, boots = {}) => {
  const { world: w = T, ...rest } = boots;
  const { door, session } = w.world.boot(w.mai);
  const p = await boot({ screens: SCREENS, door, session, plane: plane(o), path: "/app/objective/" + w.project, ...rest });
  await p.settle();
  return p;
};
const main = (p) => p.doc.getElementById("cs-main");
const text = (p) => main(p).textContent;
const says = (p, key, vars) => text(p).includes(W(key, vars));
const button = (p, op, n = 0) => main(p).querySelectorAll(`button[data-act="${op}"]`)[n];
const heads = (p) => main(p).querySelectorAll("section h2").map((h) => h.textContent);
const tick = (p, id, on = true) => { const el = p.doc.getElementById(id); assert.ok(el, id); el.checked = on; };
const ops = (p, op) => p.byOp(op);

test("R106 the screen is registered by this module with exactly the registry's ten acts; its subject read is marked; every key it lists is held (R44)", () => {
  assert.ok(SCREEN, "`objective` is a screen of the module");
  const reg = REGISTRY.screens.find((s) => s.id === "objective");
  assert.deepEqual(SCREEN.acts.map((a) => a.op).sort(), reg.acts.map((a) => a.op).sort());
  for (const a of SCREEN.acts) { assert.equal(a.label, `act.${a.op}.label.objective`); assert.ok(hasWord(a.label), a.label); assert.ok(SCREEN.words.includes(a.label)); }
  assert.ok(SCREEN.reads({ subject: P, me: { member: "mai" } }).progress.subject === true, "R21: the subject read is marked");
  for (const k of SCREEN.words) assert.ok(hasWord(k), k);
  /* the design words the table lacks are reported, not listed as read; each is a key of this screen */
  for (const k of PENDING_WORDS) { assert.match(k, /^screen\.objective\./); assert.ok(!SCREEN.words.includes(k), k); }
});

test("R106 state a: success means (the sentence from the condition), how it is going, what is still short, each only when its read answers", async () => {
  const p = await open();
  assert.equal(main(p).querySelector("h1").textContent, word("screen.objective.name"));
  assert.ok(text(p).includes(PROGRESS.objective), "the objective's text");
  assert.ok(says(p, KEY("success-is-reached-when-at-least-of-the-made-for"), { share: "90%", flow: "Lease rent flow", party: "Springfield Parks Dept",
    stage: "Council signed off", grade: "B" }));
  assert.ok(!says(p, KEY("this-objective-has-no-measure-of-success-yet-so")));
  assert.ok(heads(p).includes(word(KEY("how-it-is-going"))));
  assert.ok(says(p, KEY("rent-payments-meet-the-measure-are-short"), { met: "9", short: "3" }));
  assert.ok(says(p, KEY("success-needs-so-it-is-not-yet-reached"), { share: "90%" }));
  assert.ok(says(p, KEY("not-yet-decidable-of-the-short-payments-may-stil"), { count: "1" }));
  assert.ok(says(p, KEY("this-is-counted-again-each-time-you-open-the-scr")));
  assert.ok(heads(p).includes(word(KEY("what-is-still-short"))));
  const sec = main(p).querySelectorAll("section").find((s) => s.querySelector("h2").textContent === word(KEY("what-is-still-short")));
  assert.equal(sec.querySelectorAll(".cs-row").length, 3);
  assert.ok(sec.textContent.includes("Invoice 14200 for March"));
  assert.ok(sec.textContent.includes(word("queue.objective-gap.detail.stages", { stages: "Council signed off" })));
  assert.ok(sec.textContent.includes(word("queue.objective-gap.detail.grade", { reached: "C", required: "B" })));
  assert.ok(sec.querySelector(".cs-grade"), "a shortfall's grade is one mark");
  assert.ok(says(p, KEY("each-shortfall-is-also-offered-to-you-as-a-propo")));
  assert.equal(ops(p, "objectiveprogress")[0].query.project, P);
  /* R39: no heading is a record id */
  assert.ok(!heads(p).some((h) => /PROJ-|INQ-|INFO-/.test(h)));
  /* only the design's pending words may be drawn as keys */
  assert.deepEqual(rawKeys(p.root()).filter((k) => !PENDING_WORDS.includes(k)), []);
});

test("R106 state b: no measure yet says so, counts nothing, draws no shortfalls, and still offers to set one; control: a measure draws neither sentence", async () => {
  /* the world sets no measure for this project: its own count and gaps are the no-measure answers */
  const p = await open({ objectiveprogress: undefined, objectivegaps: undefined });
  assert.ok(says(p, KEY("this-objective-has-no-measure-of-success-yet-so")));
  assert.ok(says(p, KEY("choose-what-counts-and-the-screen-works-it-out-f")));
  assert.ok(says(p, KEY("not-counted-yet-no-measure-of-success-is-set")));
  assert.ok(!heads(p).includes(word(KEY("what-is-still-short"))), "R20: nothing short is drawn");
  assert.ok(!says(p, KEY("rent-payments-meet-the-measure-are-short"), { met: "0", short: "0" }));
  assert.ok(says(p, KEY("set-how-success-is-measured")));
  assert.ok(button(p, "objectivecondition"), "the act is offered");
  const a = await open();
  assert.ok(!says(a, KEY("not-counted-yet-no-measure-of-success-is-set")));
});

test("R106 a subject the member cannot read draws only the shell's nothing-here (R21); a failed secondary read is drawn failed, never as none (R20)", async () => {
  const gone = await open({ objectiveprogress: refusedIn("NO_SUCH_PROJECT") });
  assert.ok(says(gone, "shell.unavailable.nothing.title"));
  assert.equal(button(gone, "objectivecondition"), undefined);
  const bad = await open({ intentproposals: refusedIn("SOME_REFUSAL", "The plane refused this read.") });
  assert.ok(main(bad).querySelector('[data-state="failed"]'), "the proposals read, failed");
  assert.ok(button(bad, "objectivecondition"), "the rest stays");
});

test("R106 objectivecondition: Save sends project, the condition the fields give and her reason; Stop sends a null condition and her reason", async () => {
  const p = await open();
  fill(p, { "ob-share": "80", "ob-why": "The lease says the council votes first." });
  tick(p, "ob-stages-0", true); tick(p, "ob-stages-1", true);
  p.doc.getElementById("ob-grade").value = "A";
  await p.click(button(p, "objectivecondition", 0));
  const sent = ops(p, "objectivecondition");
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].body, { project: P, reason: "The lease says the council votes first.",
    condition: { progression: "PRG-rent", entity: T.city, required: { grade: "A", stages: ["invoiced", "authorized"] }, satisfied: { share: 80 } } });
  await p.click(button(p, "objectivecondition", 1));
  assert.deepEqual(ops(p, "objectivecondition")[1].body, { project: P, condition: null, reason: "The lease says the council votes first." });
});

test("R106 objectivecondition: no reason sends nothing and draws the shell's needed word; a share outside 1 to 100 or not a number sends nothing; control: the plane's refusal is drawn by its key", async () => {
  const p = await open();
  fill(p, { "ob-share": "90", "ob-why": "" });
  await p.click(button(p, "objectivecondition", 0));
  assert.equal(ops(p, "objectivecondition").length, 0);
  assert.ok(says(p, "shell.reason.needed"));
  await p.click(button(p, "objectivecondition", 1));
  assert.equal(ops(p, "objectivecondition").length, 0, "also to remove it");
  fill(p, { "ob-why": "Because.", "ob-share": "abc" });
  await p.click(button(p, "objectivecondition", 0));
  assert.equal(ops(p, "objectivecondition").length, 0);
  assert.ok(says(p, KEY("the-measure-names-a-flow-a-party-or-a-stage-the")));
  const q = await open({ objectivecondition: refusedIn("INTENT_NO_REASON") });
  fill(q, { "ob-why": "Because.", "ob-share": "90" });
  await q.click(button(q, "objectivecondition", 0));
  assert.ok(says(q, "refusal.INTENT_NO_REASON"));
});

test("R106 the measure's refusals are the design's own fold, drawn before the act", async () => {
  const p = await open();
  for (const k of ["when-the-measure-is-not-accepted", "only-a-named-member-can-set-it-and-only-a-member", "a-reason-is-required-also-to-remove-the-measure"]) assert.ok(says(p, KEY(k)), k);
});

test("R106 proposals: Decide sends the proposal's key, the act chosen, the project and her reason; defer and dismiss and open-a-question likewise; none chosen sends nothing", async () => {
  const p = await open();
  assert.ok(heads(p).includes(W(KEY("proposals-to-decide"))));
  assert.ok(says(p, KEY("things-the-record-suggests-this-objective-should")));
  assert.ok(says(p, KEY("nothing-happens-until-a-member-decides")));
  assert.ok(says(p, KEY("a-missing-step-in"), { flow: "Lease rent flow" }));
  await p.click(button(p, "triage"));
  assert.equal(ops(p, "triage").length, 0, "no choice, nothing sent");
  tick(p, "ob-tr-do-0");
  await p.click(button(p, "triage"));
  /* triage is a Reasoned act: the shell asks her reason before it runs */
  const slot = p.root().querySelector(`[data-slot="${button(p, "triage").getAttribute("data-ai")}"]`);
  slot.querySelector('textarea[id^="cs-reason-"]').value = "It belongs in the objective.";
  await p.click(slot.querySelector('[data-shell="reason-send"]'));
  assert.deepEqual(ops(p, "triage")[0].body, { proposal: GAPS.gaps[0].key, act: "adopt", project: P, reason: "It belongs in the objective." });
  for (const [n, act] of [[1, "question"], [2, "defer"], [3, "dismiss"]]) {
    for (let m = 0; m < 4; m++) tick(p, "ob-tr-do-" + m, m === n);
    await p.click(button(p, "triage"));
    const s2 = p.root().querySelector(`[data-slot="${button(p, "triage").getAttribute("data-ai")}"]`);
    s2.querySelector('textarea[id^="cs-reason-"]').value = "Because " + act;
    await p.click(s2.querySelector('[data-shell="reason-send"]'));
    assert.equal(ops(p, "triage").at(-1).body.act, act);
    assert.equal(ops(p, "triage").at(-1).body.reason, "Because " + act);
  }
  assert.ok(says(p, KEY("when-a-proposal-is-not-accepted")));
});

test("R106 proposals: a refusal is drawn by its words; control: a missing reason box is refused by the shell and nothing is sent", async () => {
  const p = await open({ triage: refusedIn("NO_SUCH_PROPOSAL") });
  tick(p, "ob-tr-do-0");
  await p.click(button(p, "triage"));
  const slot = p.root().querySelector(`[data-slot="${button(p, "triage").getAttribute("data-ai")}"]`);
  await p.click(slot.querySelector('[data-shell="reason-send"]'));
  assert.equal(ops(p, "triage").length, 0, "an empty reason sends nothing");
  slot.querySelector('textarea[id^="cs-reason-"]').value = "x";
  await p.click(slot.querySelector('[data-shell="reason-send"]'));
  assert.ok(says(p, "refusal.NO_SUCH_PROPOSAL"));
});

test("R106 no proposal: the section is not drawn (R20)", async () => {
  const p = await open({ intentproposals: ok({ ok: true, project: P, proposals: [], count: 0, set_aside: [] }) });
  assert.ok(!heads(p).includes(W(KEY("proposals-to-decide"))));
  assert.equal(button(p, "triage"), undefined);
});

test("R106 aspirations: the team's and the project's are listed with who holds them; the departure is drawn with its date and reason; dead ends so far", async () => {
  const p = await open();
  assert.ok(heads(p).includes(W(KEY("aspirations"))));
  assert.ok(says(p, KEY("what-a-team-a-project-or-a-member-holds-itself-t")));
  assert.ok(says(p, KEY("an-aspiration-is-not-a-measure-it-is-the-standar")));
  assert.ok(text(p).includes(ASP_TEAM.statement) && text(p).includes(ASP_OURS.statement));
  assert.ok(says(p, KEY("held-by-the-whole-team")));
  assert.ok(text(p).includes("The city only answers phone requests here."));
  assert.ok(text(p).includes("We asked the Authority for the 2019 vote record."));
  assert.equal(ops(p, "aspirations")[0].query.project, P);
});

test("R106 aspirationdeclare: a project's aspiration sends scope, owner (the project) and statement; the team's sends no owner; a member's names her; an empty statement sends nothing", async () => {
  const p = await open();
  /* entry 4 (B22): the statement she writes is the act's own reason field, so the shell asks no second one and the request holds no `reason` */
  const press = async () => { await p.click(button(p, "aspirationdeclare")); };
  await press();
  assert.equal(ops(p, "aspirationdeclare").length, 0, "an empty statement sends nothing");
  fill(p, { "ob-asp-st": "Name a second source for every claim." });
  p.doc.getElementById("ob-asp-scope").value = "project";
  await press();
  assert.deepEqual(ops(p, "aspirationdeclare")[0].body, { scope: "project", owner: P, statement: "Name a second source for every claim." });
  assert.equal(p.root().querySelectorAll('textarea[id^="cs-reason-"]').length, 0, "no second reason box is asked");
  p.doc.getElementById("ob-asp-scope").value = "group";
  await press();
  assert.deepEqual(ops(p, "aspirationdeclare")[1].body, { scope: "group", statement: "Name a second source for every claim." });
  p.doc.getElementById("ob-asp-scope").value = "member";
  fill(p, { "ob-asp-ent": T.city, "ob-asp-prog": "PRG-rent" });
  await press();
  assert.deepEqual(ops(p, "aspirationdeclare")[2].body, { scope: "member", owner: "mai", statement: "Name a second source for every claim.", entities: [T.city], progressions: ["PRG-rent"] });
});

test("R106 aspirationdeclare: control: the plane's NOT_AN_ADMIN is drawn by its key", async () => {
  const p = await open({ aspirationdeclare: refusedIn("NOT_AN_ADMIN") });
  fill(p, { "ob-asp-st": "Anything." });
  p.doc.getElementById("ob-asp-scope").value = "group";
  await p.click(button(p, "aspirationdeclare"));
  assert.ok(says(p, "refusal.NOT_AN_ADMIN"));
});

test("R106 aspirationdepart, aspirationdeadend, aspirationretire send exactly their declared fields; each needs its own words (nothing sent without them)", async () => {
  const p = await open();
  await p.click(button(p, "aspirationdepart"));
  await p.click(button(p, "aspirationdeadend"));
  await p.click(button(p, "aspirationretire"));
  for (const op of ["aspirationdepart", "aspirationdeadend", "aspirationretire"]) assert.equal(ops(p, op).length, 0, op);
  assert.ok(says(p, "shell.reason.needed"));
  p.doc.getElementById("ob-dep-asp").value = T.stays;
  fill(p, { "ob-dep-why": "The city only answers phone requests here.", "ob-dea-note": "Asked; none exists.", "ob-ret-taught": "A second document was never there." });
  p.doc.getElementById("ob-dea-asp").value = ASP_OURS.id;
  p.doc.getElementById("ob-ret-asp").value = ASP_OURS.id;
  await p.click(button(p, "aspirationdepart"));
  await p.click(button(p, "aspirationdeadend"));
  await p.click(button(p, "aspirationretire"));
  assert.deepEqual(ops(p, "aspirationdepart")[0].body, { project: P, aspiration: T.stays, reason: "The city only answers phone requests here." });
  assert.deepEqual(ops(p, "aspirationdeadend")[0].body, { aspiration: ASP_OURS.id, note: "Asked; none exists." });
  assert.deepEqual(ops(p, "aspirationretire")[0].body, { aspiration: ASP_OURS.id, taught: "A second document was never there." });
  for (const k of ["when-a-departure-is-not-accepted", "when-a-dead-end-is-not-accepted", "when-retiring-is-refused", "this-aspiration-is-retired-so-nothing-holds-to-i"]) assert.ok(says(p, KEY(k)), k);
});

test("R106 aspirationdepart: control: a retired aspiration's refusal is drawn by the plane's key", async () => {
  const p = await open({ aspirationretire: refusedIn("NO_LESSON") });
  p.doc.getElementById("ob-ret-asp").value = ASP_OURS.id;
  fill(p, { "ob-ret-taught": "x" });
  await p.click(button(p, "aspirationretire"));
  assert.ok(says(p, "refusal.NO_LESSON"));
});

test("R106 goals: the goal is listed with its limit and that this objective serves it; Open sends statement and bounds (and the aspiration chosen); Link sends goal and project; Close sends goal and reason", async () => {
  const p = await open();
  assert.ok(heads(p).includes(word(KEY("goals-this-objective-serves"))));
  assert.ok(says(p, KEY("a-goal-is-a-larger-aim-with-limits-that-several")));
  assert.ok(text(p).includes(GOAL.statement) && text(p).includes(GOAL.bounds));
  await p.click(button(p, "goaldeclare"));
  assert.equal(ops(p, "goaldeclare").length, 0, "nothing without what it pursues and what limits it");
  fill(p, { "ob-goal-st": "End unvoted collections.", "ob-goal-bd": "Only council-amendable leases." });
  p.doc.getElementById("ob-goal-asp").value = ASP_TEAM.id;
  await p.click(button(p, "goaldeclare"));
  assert.deepEqual(ops(p, "goaldeclare")[0].body, { statement: "End unvoted collections.", bounds: "Only council-amendable leases.", aspiration: ASP_TEAM.id }, "the statement is the reason it sends; no second box is asked");
  p.doc.getElementById("ob-goal-link").value = GOAL.id;
  await p.click(button(p, "goallink"));
  assert.deepEqual(ops(p, "goallink")[0].body, { goal: GOAL.id, project: P });
  p.doc.getElementById("ob-goal-cl").value = GOAL.id;
  await p.click(button(p, "goalclose"));
  assert.equal(ops(p, "goalclose").length, 0, "a goal closes with its reason");
  fill(p, { "ob-goal-why": "It was met." });
  await p.click(button(p, "goalclose"));
  assert.deepEqual(ops(p, "goalclose")[0].body, { goal: GOAL.id, reason: "It was met." });
  for (const k of ["when-a-goal-is-not-accepted", "when-linking-is-refused", "when-closing-is-refused"]) assert.ok(says(p, KEY(k)), k);
});

test("R106 goals: controls: a closed goal's link refusal and a missing statement are drawn by the plane's keys; with no goal the section keeps its acts to open one", async () => {
  const p = await open({ goallink: refusedIn("PURSUIT_ENDED"), goaldeclare: refusedIn("PURSUIT_UNSTATED") });
  p.doc.getElementById("ob-goal-link").value = GOAL.id;
  await p.click(button(p, "goallink"));
  assert.ok(main(p).querySelector('[data-gap="refused"][role="alert"]'), "the link's refusal is drawn beside the act");
  const none = await open({ list: ok({ bundles: [] }) });
  assert.ok(button(none, "goaldeclare"), "a goal can still be opened");
  assert.equal(button(none, "goallink"), undefined, "nothing to link");
  assert.equal(button(none, "goalclose"), undefined, "nothing to close");
});

test("R106 writinghelp: drawn beside the member's own-words fields only while the assistant is reachable; it sends the field and what she has typed, and leaves her words in the field", async () => {
  const p = await open();
  const helps = main(p).querySelectorAll('button[data-act="writinghelp"]');
  assert.ok(helps.length >= 3, "beside the reason, the statement and the goal's words");
  fill(p, { "ob-why": "My words." });
  const mine = helps.find((b) => b.getAttribute("data-id") === "ob-why");
  assert.ok(mine, "the measure's reason");
  await p.click(mine);
  assert.deepEqual(ops(p, "writinghelp")[0].body, { field: mine.getAttribute("data-field"), told: "My words." });
  assert.equal(p.doc.getElementById("ob-why").value, "My words.", "her own words stay in the field");
  const off = await open({ assistantstate: ok({ on: false }) });
  assert.equal(main(off).querySelectorAll('button[data-act="writinghelp"]').length, 0, "control: not reachable, not drawn");
});

test("R106 writinghelp: wizard-scripts' real answers are drawn by their words beside the help, her words kept: a draft already held, the assistant unreachable", async () => {
  for (const [answer, held] of [[writingHelpDraftHeld(), "WRITING_HELP_DRAFT_HELD"], [writingHelpUnreachable(), "AGENT_WORKER_UNBOUND"]]) {
    const code = answer.reason || answer.code;
    assert.equal(code, held, "the real answer names " + held);
    const p = await open({ writinghelp: ok(answer) });
    fill(p, { "ob-why": "My words." });
    await p.click(main(p).querySelectorAll('button[data-act="writinghelp"]').find((b) => b.getAttribute("data-id") === "ob-why"));
    await p.settle();
    assert.ok(main(p).textContent.includes(word("refusal." + held)), held + " is drawn by its words");
    assert.equal(p.doc.getElementById("ob-why").value, "My words.", "her own words stay in the field");
  }
});

test("R106 the member's own reads: aspirations are read for her (project and member), proposals and gaps for the project; nothing is written on load", async () => {
  const p = await open();
  assert.equal(ops(p, "aspirations")[0].query.member, "mai");
  for (const op of ["objectivegaps", "intentproposals"]) assert.equal(ops(p, op)[0].query.project, P);
  assert.equal(p.requests.filter((r) => r.method !== "GET" && !["writinghelp"].includes(r.op) && r.op !== "whoami" && r.body !== undefined && /^(objectivecondition|triage|aspiration|goal)/.test(r.op)).length, 0);
});

test("R44 every `screen.objective.*` key the screen's source draws is held (listed in its words) or one of the design words reported pending; none is both", () => {
  const src = String(SCREEN.render) + SCREEN.acts.map((a) => String(a.send || "")).join("");
  const stems = new Set([...src.matchAll(/(?:K\("|"screen\.objective\.)([a-z0-9-]+)"/g)].map((m) => m[1]));
  assert.ok(stems.size > 60);
  for (const stem of stems) {
    const key = KEY(stem);
    if (!PENDING_WORDS.includes(key)) { assert.ok(hasWord(key), `${key} is held`); assert.ok(SCREEN.words.includes(key), `${key} is listed`); }
  }
  for (const k of PENDING_WORDS) assert.ok(stems.has(k.slice("screen.objective.".length)), `${k} is drawn`);
});

test("R106 the measure: Stop is offered only where a measure is set; a typed minimum with $ sends USD, one without a currency is sent as typed for the plane to refuse in words", async () => {
  const none = await open({ objectiveprogress: ok(NOCOND) });
  assert.equal(main(none).querySelectorAll('button[data-act="objectivecondition"]').length, 1, "only Save");
  const p = await open();
  fill(p, { "ob-why": "Because.", "ob-share": "90", "ob-min": "$1,000" });
  await p.click(button(p, "objectivecondition", 0));
  assert.deepEqual(ops(p, "objectivecondition")[0].body.condition.filter, { amount: { min: "1000", currency: "USD" } });
  fill(p, { "ob-min": "1000" });
  await p.click(button(p, "objectivecondition", 0));
  assert.deepEqual(ops(p, "objectivecondition")[1].body.condition.filter, { amount: { min: "1000" } });
});

test("R106 with no flow or party to name (no measure, no proposal, and none held by the group: `progressions` and `entitieskind` answer none) the measure takes them as typed keys; Save sends them", async () => {
  const bare = await team({ held: false });   /* the group holds no flow and no party: the world's own answers are none */
  const p = await open({ objectiveprogress: ok(NOCOND), intentproposals: ok({ ok: true, project: bare.project, proposals: [], count: 0, set_aside: [] }) }, { world: bare });
assert.equal(p.doc.getElementById("ob-flow").localName, "input");
  fill(p, { "ob-flow": "PRG-rent", "ob-ent": "ENT-city", "ob-share": "50", "ob-why": "Because." });
  await p.click(button(p, "objectivecondition", 0));
  assert.deepEqual(ops(p, "objectivecondition")[0].body, { project: bare.project, reason: "Because.", condition: { progression: "PRG-rent", entity: "ENT-city", required: { stages: [] }, satisfied: { share: 50 } } });
});

test("R106 R20 no aspiration: nothing to depart from, record a dead end on or retire is offered, and declaring one still is; no goal link or close without an open goal", async () => {
  const p = await open({ aspirations: ok({ ok: true, project: P, aspirations: [], departures: [] }), list: ok({ bundles: [] }) });
  for (const op of ["aspirationdepart", "aspirationdeadend", "aspirationretire", "goallink", "goalclose"]) assert.equal(button(p, op), undefined, op);
  for (const op of ["aspirationdeclare", "goaldeclare"]) assert.ok(button(p, op), op);
});

test("R106 each read in its own state: pending is loading, refused and unanswered are failed, and no key is drawn bare beyond the design's pending words", async () => {
  for (const op of ["objectivegaps", "aspirations", "list"]) for (const [name, answer] of [["refused", refusedIn("SOME_REFUSAL", "The plane refused this read.")], ["silent", { silent: true }], ["pending", { pending: true }]]) {
    const p = await open({ [op]: answer });
    assert.ok(main(p).querySelector("h1"), `${op} ${name}: the screen stays`);
    if (op !== "objectivegaps") assert.ok(main(p).querySelector(`[data-state="${name === "pending" ? "loading" : "failed"}"]`), `${op} ${name}`);
    assert.deepEqual(rawKeys(p.root()).filter((k) => !PENDING_WORDS.includes(k)), [], `${op} ${name}`);
  }
});

test("R106 a goal closed with its reason is listed with that reason and is offered neither to link nor to close (control: an open goal is)", async () => {
  const closed = { ...GOAL, id: "GOAL-2026-0002", statement: "Old aim.", state: "closed", closed_reason: "It was met." };
  const p = await open({ list: ok({ bundles: [{ bundle_id: GOAL.id, title: "t" }, { bundle_id: closed.id, title: "u" }] }), goal: (r) => ok({ ok: true, goal: r.query.id === closed.id ? closed : GOAL }) });
  assert.ok(text(p).includes("It was met.") && text(p).includes("Old aim."));
  const options = (id) => p.doc.getElementById(id).querySelectorAll("option").map((o) => o.getAttribute("value"));
  assert.deepEqual(options("ob-goal-link"), [GOAL.id]);
  assert.deepEqual(options("ob-goal-cl"), [GOAL.id]);
});

test("R106 entry 3 (B22): the measure's flow and party pickers offer the flows the group holds (`progressions`) and the parties it holds (`entitieskind`), and a read that fails is drawn failed", async () => {
  const p = await open({ objectiveprogress: ok(NOCOND) });
  const flows = p.doc.getElementById("ob-flow").querySelectorAll("option").map((o) => o.getAttribute("value"));
  assert.ok(flows.includes("PRG-rent") && flows.includes("PRG-permits"), "both flows are offered, not typed");
  const parties = p.doc.getElementById("ob-ent").querySelectorAll("option").map((o) => o.getAttribute("value"));
  for (const id of [T.city, T.auth, T.person]) assert.ok(parties.includes(id), id);
  assert.equal(ops(p, "progressions")[0].query.limit, "200");
  assert.deepEqual(ops(p, "entitieskind").map((r) => r.query.kind).sort(), ["body", "institution", "office", "person"]);
  const bad = await open({ objectiveprogress: ok(NOCOND), progressions: refusedIn("PROGRESSIONS_UNREADABLE") });
  assert.ok(main(bad).querySelector('[data-state="failed"]'), "a failed list is drawn failed, never as none");
});
