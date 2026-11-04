/* plan-work R10: each recorded response sets off a re-examination of the plans of its project and of the projects linked
   to it by arose_from both ways: marks written through action-plans' planMark only, and one re-examination run. The
   responses are recorded through the real `actions` (T45-27, K2859), whose R95 listener calls plan-work's. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, by, V, OFFICE, option, choose } from "./fixture.mjs";
import { REEXAM_SKILL } from "../../../src/plan-work/index.mjs";

/* The tables action-plans holds a plan's decisions in: dispositions, scenarios, judgements and starts. */
const decisions = (w) => Object.fromEntries(["plans", "plan_options", "plan_scenarios", "plan_checkpoints", "plan_history", "plan_subjects"]
  .map((t) => [t, JSON.stringify(w.rows(`SELECT * FROM ${t} ORDER BY 1, 2`))]));

/* A second plan in dave's project Q, with an action started from it. */
function planInQ(w) {
  const inq = w.inquiry([w.Q]);
  const r = w.ap.planOpen({ project: w.Q, subjects: [{ kind: "inquiry", inquiry: inq }], title: "Harbour plan", ...by("dave") });
  assert.equal(r.ok, true, JSON.stringify(r));
  const o = w.ap.optionAdd({ plan: r.id, summary: "Ask the harbour", category: "awareness", subjects: [{ kind: "inquiry", inquiry: inq }],
                             addressee: OFFICE, ...by("dave") }).option;
  w.ap.optionDispose({ plan: r.id, options: [o], disposition: "chosen", ...by("dave") });
  const a = w.ap.optionStart({ plan: r.id, option: o, kind: "other", ...by("dave") });
  assert.equal(a.ok, true, JSON.stringify(a));
  return { plan: r.id, option: o, action: a.action };
}
const receive = async (w, action, at = "2026-10-03", extra = {}) => { const ord = w.correspond(action, "received", at, extra); await w.settle(); return ord; };

test("R10: at start the module registers with actions' response listener; a recorded response marks the plan through planMark only", async () => {
  const w = world();
  assert.deepEqual(w.pw.registered.response_listener, { ok: true, module: "plan-work" });
  /* actions' one registration per module: a second is refused */
  assert.equal(w.actions.registerResponseListener("plan-work", () => {}).code, "LISTENER_DECLARED");
  const s = w.started({ subjects: [w.S1] });
  const other = option(w, { summary: "Ask the auditor", subjects: [w.S3] });
  choose(w, [other]);
  w.ap.scenarioSet({ plan: w.PL, scenario: 1, name: "Main", phases: [{ id: "ask", name: "Ask", options: [s.option], starts: "plan_start" }], ...by("bob") });
  w.correspond(s.action, "sent", "2026-10-01");
  await w.settle();
  assert.deepEqual(w.reexamined(s.action, 0), [], "a sent entry sets off nothing");
  const before = decisions(w);
  const ord = await receive(w, s.action);
  const mine = w.reexamined(s.action, ord).find((x) => x.plan === w.PL);
  assert.deepEqual(mine.marks.map((m) => [m.kind, m.option ?? m.phase]), [["option_changed", s.option], ["phase_start_holds", "ask"]]);
  assert.ok(mine.marks.every((m) => typeof m.why === "string" && m.why.length >= 1 && m.why.length <= 500));
  /* written through planMark in action-plans R43's shape, with the response as cause */
  const held = w.marksOf(w.PL);
  assert.equal(held.length, 2);
  assert.deepEqual(held[0].cause, { action: s.action, ord });
  assert.deepEqual(w.pw.reexaminations({ plan: w.PL, viewer: V("bob") }).items[0].marks, mine.marks);
  /* control: dispositions, scenarios, judgements and starts are byte-identical before and after */
  assert.deepEqual(decisions(w), before);
  /* once per plan and response: the listener called again for the same response writes nothing more */
  const again = await w.respond(s.action, ord);
  assert.deepEqual(again.reexamined, []);
  assert.equal(w.marksOf(w.PL).length, 2);
  /* a mark the plan already holds is not written again after a later response */
  const ord2 = await receive(w, s.action, "2026-10-04");
  assert.deepEqual(w.reexamined(s.action, ord2)[0].marks, []);
});

test("R10: a response whose action names no project re-examines the plans of its plan's project", async () => {
  const w = world();
  const s = w.started({ subjects: [w.S1] });
  const ord = await receive(w, s.action);
  assert.deepEqual(w.reexamined(s.action, ord).map((x) => x.plan), [w.PL]);
  /* actions answers the action's own project; where it names none, the plan's project is the response's */
  const r = await w.pw.onResponse({ action: s.action, ord: 99, project: null, recorder: V("bob"), at: w.clock.now });
  assert.deepEqual(r.reexamined.map((x) => x.plan), [w.PL]);
});

test("R10: the guide's next routes for the action's kind after the response's outcome are one next_routes mark; the chance to fix is never a mark", async () => {
  const w = world();
  const s = w.started({ subjects: [w.S1] });
  w.guides.set("other", [{ guide: null, origin: "profile", items: [
    { route: "Ask for reconsideration", citation: "Rule 4", after: ["denied"] },
    { route: "Thank them", citation: "Rule 5", after: ["complied"] },
    { route: "Wait", citation: "Rule 6" }] },
    { guide: "GUD-2026-0001-g", origin: "group", items: [{ route: "Appeal to the board", citation: "Rule 9", after: ["denied", "partial"] }] }]);
  w.correspond(s.action, "sent", "2026-10-01");
  const ord = await receive(w, s.action, "2026-10-03", { account: "letter", outcome: "denied" });
  const marks = w.reexamined(s.action, ord)[0].marks;
  assert.deepEqual(marks.filter((m) => m.kind === "next_routes").map((m) => m.routes), [["Ask for reconsideration", "Appeal to the board"]],
    "the routes after denied only, in the guides' order; one with no `after` is not a next route");
  assert.equal(marks.some((m) => !["option_changed", "phase_start_holds", "next_routes"].includes(m.kind)), false,
    "no chance-to-fix mark: action-plans R41 derives it on read");
  /* control: a response stating no outcome offers no route */
  const w2 = world();
  w2.guides.set("other", [{ guide: null, origin: "profile", items: [{ route: "Ask for reconsideration", citation: "Rule 4", after: ["denied"] }] }]);
  const t = w2.started({ subjects: [w2.S1] });
  const o2 = await receive(w2, t.action);
  assert.equal(w2.reexamined(t.action, o2)[0].marks.some((m) => m.kind === "next_routes"), false);
  /* at most 20 routes */
  const w3 = world();
  w3.guides.set("other", [{ guide: null, origin: "profile", items: Array.from({ length: 25 }, (_, i) => ({ route: `Route ${i}`, citation: "R", after: ["denied"] })) }]);
  const u = w3.started({ subjects: [w3.S1] });
  const o3 = await receive(w3, u.action, "2026-10-03", { account: "letter", outcome: "denied" });
  assert.equal(w3.reexamined(u.action, o3)[0].marks.find((m) => m.kind === "next_routes").routes.length, 20);
});

test("R10: the projects linked by arose_from both ways are re-examined; a response in an unlinked project marks nothing", async () => {
  const w = world();
  const s = w.started({ subjects: [w.S1] });
  const q = planInQ(w);
  /* control: unlinked, P's response re-examines P's plan only, and Q's response Q's only */
  const ordP = await receive(w, s.action);
  assert.deepEqual(w.reexamined(s.action, ordP).map((x) => x.plan), [w.PL]);
  const ordQ = w.actions.actionCorrespond({ target: q.action, direction: "received", at: "2026-10-04", account: "a call", ...by("dave") }).ord;
  await w.settle();
  assert.deepEqual(w.reexamined(q.action, ordQ).map((x) => x.plan), [q.plan]);
  assert.equal(w.marksOf(w.PL).length, 1, "P's plan gained nothing from Q's response");
  /* forward: bob, who has joined both projects, records that Q arose from P's response (action-replies R2), so a later
     response in P re-examines Q too */
  w.join(w.Q, "bob");
  const link = w.replies.aroseFromLink({ target: s.action, ord: ordP, arising: { project: w.Q }, ...by("bob") });
  assert.equal(link.ok, true, JSON.stringify(link));
  const ordP2 = await receive(w, s.action, "2026-10-05");
  assert.deepEqual(w.reexamined(s.action, ordP2).map((x) => x.plan).sort(), [w.PL, q.plan].sort());
  /* backward: P arose from a response on Q's action, so a response in P re-examines Q's plan */
  const w2 = world();
  const s2 = w2.started({ subjects: [w2.S1] });
  const q2 = planInQ(w2);
  const oq = w2.actions.actionCorrespond({ target: q2.action, direction: "received", at: "2026-10-02", account: "a call", ...by("dave") }).ord;
  await w2.settle();
  w2.join(w2.Q, "bob");
  const back = w2.replies.aroseFromLink({ target: q2.action, ord: oq, arising: { project: w2.P }, ...by("bob") });
  assert.equal(back.ok, true, JSON.stringify(back));
  const ord = await receive(w2, s2.action);
  assert.deepEqual(w2.reexamined(s2.action, ord).map((x) => x.plan).sort(), [w2.PL, q2.plan].sort());
  /* a closed plan is not re-examined */
  w2.ap.planClose({ id: q2.plan, reason: "done", ...by("dave") });
  const ord3 = await receive(w2, s2.action, "2026-10-06");
  assert.deepEqual(w2.reexamined(s2.action, ord3).map((x) => x.plan), [w2.PL]);
});

test("R10: one re-examination run per plan, mode plan, origin reexamination, the response as <action id>#<ord>, on the recording member's act; a refusal is kept and undoes nothing", async () => {
  const w = world();
  const s = w.started({ subjects: [w.S1] });
  const ord = await receive(w, s.action);
  assert.equal(w.runs.length, 1);
  const a = w.runs[0];
  assert.deepEqual([a.mode, a.origin, a.response, a.plan, a.contextType, a.contextId, a.actor, a.principalAi, a.principalAiRef, a.skillVersion],
    ["plan", "reexamination", `${s.action}#${ord}`, w.PL, "project", w.P, V("bob"), V("bob"), V("bob"), REEXAM_SKILL],
    "the recording member's act: ai-runs R52 picks the project's own account where it holds one, else hers");
  assert.equal(a.bounds.some((b) => (b.bound === "fetches" || b.bound === "subsessions") && b.allowed > 0), false, "no search");
  assert.equal(w.reexamined(s.action, ord)[0].run.opened, true);
  assert.deepEqual(w.pw.reexaminations({ plan: w.PL, viewer: V("bob") }).items.map((x) => [x.response, x.run.opened]),
    [[`${s.action}#${ord}`, true]]);
  /* refused (AI not enabled): kept, and the marks still stand */
  const w2 = world();
  w2.aiOpen = (x) => ({ run: x.run, started: false, code: "AI_RUN_MODE_NOT_DEPLOYED", note: "not deployed" });
  const t = w2.started({ subjects: [w2.S1] });
  const o2 = await receive(w2, t.action);
  assert.equal(w2.reexamined(t.action, o2)[0].run.refused.code, "AI_RUN_MODE_NOT_DEPLOYED");
  assert.equal(w2.marksOf(w2.PL).length, 1);
  /* called for a response no member recorded (actions never does so): no run */
  const w3 = world();
  const u = w3.started({ subjects: [w3.S1] });
  const r3 = await w3.respond(u.action, 0, w3.P, "class:ai");
  assert.equal(w3.runs.length, 0);
  assert.equal(r3.reexamined[0].run.opened, false);
});

test("R10: the listener never throws: a failing run leaves the response standing", async () => {
  const w = world();
  const s = w.started({ subjects: [w.S1] });
  w.aiOpen = () => { throw new Error("assistant down"); };
  const ord = await receive(w, s.action);
  assert.equal(w.actions.actionRead({ id: s.action, viewer: V("bob") }).correspondence[ord].direction, "received", "the entry stands");
  const run = w.reexamined(s.action, ord)[0].run;
  assert.equal(run.opened, false); assert.match(run.why, /assistant down/);
  const bad = await w.pw.onResponse({ action: "nothing", ord: "x", project: null, recorder: null });
  assert.equal(bad.ok, true);
});
