/* ai-runs R77 (T45; Actions D21; v0.2 rule 16) and R46's one exception: the re-examination run, a planning run started
   within the member's act that records a response, `origin: "reexamination"` with the `response` it re-examines the plan
   after. Its refusals in order after R46's, nothing written on any, each with a control; the response stored verbatim
   and answered by `read` and `runFor`; R47's check receiving the origin and the response. `plan` deploys apart (run-rules
   R14), so the world's deployed modes are handed in-process (`deployedModes`), as plan.test.mjs does. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, OPEN, INQ, PROJ } from "./world.mjs";
import { AI_RUNS_CHECKS } from "../../../src/run-rules/index.mjs";

const PLN = "PLN-2026-0001";
const RSP = "COR-2026-0007";
const BOB = { contextType: "project", contextId: PROJ, actor: "bob", viewer: "member:bob", principalPlane: "member:bob" };
const PROPOSALS = [{ bound: "proposals", allowed: 5 }];

async function planWorld(heard = []) {
  const w = world({ deployedModes: ["check", "plan"] });
  await w.group("ann", "bob");
  w.bundle(INQ);
  w.project(PROJ, "ann", { joined: ["bob"] });
  w.runs.registerOpenCheck("action-plans", "plan", (a) => { heard.push(a); return null; });
  return w;
}
function refused(r, code) {
  const row = AI_RUNS_CHECKS[code];
  assert.ok(row, `${code} has a row in run-rules' table`);
  assert.deepEqual([r.started, r.code, r.check, r.translation], [false, code, row.check, row.translation],
    JSON.stringify(r).slice(0, 200));
}
const reexam = (w, o = {}) => w.runs.open(OPEN({ mode: "plan", plan: PLN, ...BOB, bounds: PROPOSALS,
                                                 origin: "reexamination", response: RSP, ...o }));

test("R77: a planning run's origin other than reexamination (or none) AI_RUN_ORIGIN_UNKNOWN; reexamination without a response AI_RUN_REEXAM_NEEDS_RESPONSE; a running re-examination for the same plan and response AI_RUN_REEXAM_OPEN; in that order, after R46's, nothing written on any; each with its control", async () => {
  const w = await planWorld();
  const before = w.dump();
  /* after R46's: a re-examination failing R46 and every R77 condition is R46's refusal */
  refused(await reexam(w, { plan: null, origin: "explore", response: null }), "AI_RUN_PLAN_REQUIRED");
  refused(await reexam(w, { actor: null, origin: "explore", response: null }), "AI_RUN_PLAN_NEEDS_MEMBER");
  refused(await reexam(w, { bounds: [{ bound: "fetches", allowed: 1 }], origin: "explore" }), "AI_RUN_PLAN_NO_SEARCH");
  /* the origin, before the response */
  for (const origin of ["explore", "schedule", "", "  ", "Reexamination", 7])
    refused(await reexam(w, { origin, response: null }), "AI_RUN_ORIGIN_UNKNOWN");
  /* reexamination without a response */
  for (const response of [null, undefined, "", "   ", 42, { id: RSP }])
    refused(await reexam(w, { response }), "AI_RUN_REEXAM_NEEDS_RESPONSE");
  assert.equal(w.dump(), before, "nothing written on any");
  /* controls: a planning run with no origin, or origin member, lands; a re-examination with its response lands */
  assert.equal((await reexam(w, { run: "M1", origin: null, response: null })).started, true);
  assert.equal((await reexam(w, { run: "M2", origin: "member", response: null })).started, true);
  const r = await reexam(w, { run: "X1" });
  assert.equal(r.started, true, JSON.stringify(r));
  assert.deepEqual([r.origin, r.response], ["reexamination", RSP]);
  /* one re-examination per plan and response runs at a time */
  const held = w.dump();
  const again = await reexam(w, { run: "X2" });
  refused(again, "AI_RUN_REEXAM_OPEN");
  assert.deepEqual([again.plan, again.response], [PLN, RSP]);
  /* asked whatever the caller's sight: another member of the project, the same plan and response */
  assert.equal(w.dump(), held, "nothing written");
  /* controls: another response, or another plan, opens; and once the first has ended, the same pair opens again */
  assert.equal((await reexam(w, { run: "X3", response: "COR-2026-0008" })).started, true);
  assert.equal((await reexam(w, { run: "X4", plan: "PLN-2026-0002" })).started, true);
  const closed = await w.runs.close({ run: "X1", bound: "completed", actor: "bob", viewer: "member:bob", caller: "member:bob" });
  assert.equal(closed.terminated, true, JSON.stringify(closed));
  assert.equal((await reexam(w, { run: "X5" })).started, true);
});

test("R77: outside mode plan, origin reexamination is AI_RUN_ORIGIN_UNKNOWN (run-rules' originAllowed), nothing written; control: the same open with no origin lands", async () => {
  const w = await planWorld();
  const before = w.dump();
  refused(await w.runs.open(OPEN({ origin: "reexamination", response: RSP })), "AI_RUN_ORIGIN_UNKNOWN");
  assert.equal(w.dump(), before);
  const r = await w.runs.open(OPEN({ response: RSP }));
  assert.equal(r.started, true);
  /* a response is a re-examination's alone: no other run stores or answers one */
  assert.equal("response" in r, false);
  assert.equal(w.row(`SELECT response FROM ai_runs WHERE run = ?`, r.run).response, null);
  assert.equal("response" in (await w.runs.read({ run: r.run, viewer: "admin" })).session, false);
});

test("R77, R19, R28: a re-examination run stores its response verbatim beside its origin and plan, answered by read and runFor; a member's planning run carries no response key", async () => {
  const w = await planWorld();
  assert.equal((await reexam(w, { run: "X1", response: `  ${RSP}  ` })).started, true);
  assert.deepEqual({ ...w.row(`SELECT mode, plan, origin, response FROM ai_runs WHERE run = 'X1'`) },
                   { mode: "plan", plan: PLN, origin: "reexamination", response: RSP });
  const s = (await w.runs.read({ run: "X1", viewer: "member:bob" })).session;
  assert.deepEqual([s.mode, s.plan, s.origin, s.response], ["plan", PLN, "reexamination", RSP]);
  const f = w.runs.runFor("X1", "member:bob");
  assert.deepEqual([f.mode, f.plan, f.response], ["plan", PLN, RSP]);
  /* sight: an invisible run answers as an absent one, response and all */
  assert.equal(w.runs.runFor("X1", "member:nobody"), null);
  assert.equal((await w.runs.read({ run: "X1", viewer: "member:nobody" })).found, false);
  /* control: a member's planning run has no response key in either answer */
  assert.equal((await reexam(w, { run: "M1", origin: null, response: null })).started, true);
  assert.equal("response" in (await w.runs.read({ run: "M1", viewer: "member:bob" })).session, false);
  assert.equal("response" in w.runs.runFor("M1", "member:bob"), false);
});

test("R77, R47: the registered check receives origin and response (null for a member's planning run) and judges last; its refusal is passed on unchanged and nothing is written", async () => {
  const heard = [];
  const w = await planWorld(heard);
  assert.equal((await reexam(w, { run: "X1" })).started, true);
  assert.equal((await reexam(w, { run: "M1", origin: null, response: null })).started, true);
  assert.deepEqual(heard, [
    { contextType: "project", contextId: PROJ, plan: PLN, actor: "bob", viewer: "member:bob", origin: "reexamination", response: RSP },
    { contextType: "project", contextId: PROJ, plan: PLN, actor: "bob", viewer: "member:bob", origin: "member", response: null }]);
  /* a check that refuses: passed on unchanged, nothing written */
  const v = world({ deployedModes: ["check", "plan"] });
  await v.group("ann", "bob");
  v.project(PROJ, "ann", { joined: ["bob"] });
  const no = { ok: false, code: "PLAN_NOT_OPEN", check: "C-124.61", translation: "t" };
  v.runs.registerOpenCheck("action-plans", "plan", (a) => (a.origin === "reexamination" ? no : null));
  const before = v.dump();
  const r = await reexam(v, { run: "X1" });
  assert.deepEqual(r, { run: "X1", started: false, ...no });
  assert.equal(v.dump(), before);
  /* the R77 refusals come before the check: a missing response is never handed to it */
  refused(await reexam(v, { run: "X2", response: null }), "AI_RUN_REEXAM_NEEDS_RESPONSE");
});

test("R46 (T45 exception), R77: a re-examination run is started only at a member's act — no member behind the caller, a machine identity among them, is AI_RUN_PLAN_NEEDS_MEMBER, nothing written; its actor is the recording member, recorded as the run's act; control: the member's act lands", async () => {
  const w = await planWorld();
  const before = w.dump();
  for (const actor of [null, ""])
    refused(await reexam(w, { actor }), "AI_RUN_PLAN_NEEDS_MEMBER");
  /* a machine's stamp is refused earlier still, at the project gate (R9: DEC-63's participation), never opening one */
  for (const actor of ["class:ai", "class:daemon/run-7"])
    assert.equal((await reexam(w, { actor })).started, false);
  assert.equal(w.dump(), before);
  const r = await reexam(w, { run: "X1" });
  assert.equal(r.started, true);
  assert.equal(w.row(`SELECT principal_ai_ref FROM ai_runs WHERE run = 'X1'`).principal_ai_ref, "member:bob");
});

test("R77, R52: a re-examination run is paid as the recording member's act with the run's project — the project's own account where it holds one and it is on, else the member's; within the paying account's limits (ai-use) and the keep-away settings (ai-accounts), each refusal relayed as it came with nothing written", async () => {
  const w = await planWorld();
  const C = w.aiAccounts;
  /* control: no project account, the recording member's own pays, and the act is that member's */
  assert.equal((await reexam(w, { run: "X0", response: "COR-0" })).started, true);
  assert.deepEqual({ ...w.row(`SELECT principal_ai, principal_ai_ref FROM ai_runs WHERE run = 'X0'`) },
                   { principal_ai: "member:bob", principal_ai_ref: "member:bob" });
  /* the project's own account, held and on, pays (its key notice read first) */
  await w.projectAccount(PROJ, "ann", { members: ["bob"] });
  assert.equal((await reexam(w, { run: "X1", response: "COR-1" })).started, true);
  assert.deepEqual({ ...w.row(`SELECT principal_ai, principal_ai_ref FROM ai_runs WHERE run = 'X1'`) },
                   { principal_ai: `project:${PROJ}`, principal_ai_ref: "member:bob" });
  /* the project keeps its material away from the assistant: refused as ai-accounts answers it, nothing written */
  assert.equal(C.projectAiKeepAwaySet({ project: PROJ, on: true, reason: "a source's papers", by: "member:ann" }).ok, true);
  const before = w.dump();
  const kept = await reexam(w, { run: "X2", response: "COR-2" });
  assert.deepEqual([kept.started, kept.code], [false, "PROJECT_AI_KEPT_AWAY"], JSON.stringify(kept).slice(0, 200));
  assert.equal(w.dump(), before, "nothing written");
  /* control: lifted, the same act opens */
  assert.equal(C.projectAiKeepAwaySet({ project: PROJ, on: false, reason: "returned", by: "member:ann" }).ok, true);
  assert.equal((await reexam(w, { run: "X2", response: "COR-2" })).started, true);
});
