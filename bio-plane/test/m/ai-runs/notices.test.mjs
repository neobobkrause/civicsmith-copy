/* ai-runs' answers to its providers' notices (T53): run-rules:72 (R19, R29, R30, R36, R37), credentials:74 (R27, R63,
   R73) and membership:77 (R154), each tested at this module's interface over the real modules (./world.mjs). */
import test from "node:test";
import assert from "node:assert/strict";
import { world, OPEN, INQ, PROJ, T0, TEST_SET, ENTRIES, agentWorker } from "./world.mjs";
import { untestedLabel } from "../../../src/run-rules/index.mjs";
import { MEMBERSHIP_CHECKS } from "../../../src/membership/index.mjs";

const PAIR = { CIVICSMITH_TEST_INSTANCE: "biosmoke7", INSTANCE_NAME: "biosmoke7" };
const STORE = { idFromName: (n) => `id:${n}` };

test("notice run-rules:72 (run-rules R19, R29, R36, R37): partAdmitted(part, entry) asks partAdmittedOn per entry over the Gate 1 verdicts read through this module's one seam — none held on a real instance admits nothing and the open is refused C-109.1; a passes or passes_with_limits verdict for the entry admits unlabelled, not_suitable and not_yet_rated admit nothing; check and plan share the gate part run; no entry admits nothing outside a test instance and, on one, admits labelled; a failed standing-measure record for the entry withdraws it for that entry alone; a second verdict source is refused", async () => {
  const w = world({ bars: [] });
  await w.group("ann");
  w.bundle(INQ);
  assert.deepEqual(w.runs.partAdmitted("check", ENTRIES.a), { admitted: false, untested: null });
  const r = await w.runs.open(OPEN());
  assert.deepEqual([r.started, r.code, r.check], [false, "AI_RUN_MODE_NOT_DEPLOYED", "C-109.1"]);
  for (const [verdict, admits] of [["not_suitable", false], ["not_yet_rated", false], ["passes_with_limits", true], ["passes", true]]) {
    w.gates.length = 0;
    w.gates.push(w.gate("check", ENTRIES.a, verdict));
    assert.deepEqual(w.runs.partAdmitted("check", ENTRIES.a), { admitted: admits, untested: null }, verdict);
    assert.equal(w.runs.partAdmitted("plan", ENTRIES.a).admitted, admits, `plan shares run's verdict (${verdict})`);
    assert.equal(w.runs.partAdmitted("check", ENTRIES.b).admitted, false, "another entry holds none");
  }
  assert.equal((await w.runs.open(OPEN())).started, true, "the passing verdict on ann's head entry opens check");
  assert.deepEqual(w.runs.partAdmitted("check"), { admitted: false, untested: null }, "no entry: nothing outside a test instance");
  const t = world({ env: PAIR, bars: [] });
  assert.deepEqual(t.runs.partAdmitted("check"), { admitted: true, untested: untestedLabel("check") });
  /* R37: the standing measure withdraws the part for that entry alone */
  w.gates.push(w.gate("check", ENTRIES.b));
  w.runs.testBarRecord({ part: "check", set: TEST_SET.id, set_version: TEST_SET.version, false_alarm_rate: 0.5, passed: false,
                         graded_by: "harness", at: "2026-07-02T00:00:00Z", entry_id: ENTRIES.a });
  assert.deepEqual([w.runs.partAdmitted("check", ENTRIES.a).admitted, w.runs.partAdmitted("check", ENTRIES.b).admitted], [false, true]);
  const again = w.runs.registerGateVerdicts("ai-gate-2", () => []);
  assert.deepEqual([again.ok, again.code], [false, "LISTENER_DECLARED"]);
});

test("notice credentials:74 (credentials R63, R73): a member's segment credential carries the account it is served on, so the team's account removed revokes the run's credential in the clearing act; control: another account's removal leaves it live", async () => {
  const aw = agentWorker({ status: 202, body: { accepted: true, run_id: "R1" } });
  const w = world({ env: { AGENT_WORKER: aw, STORE, AI_RUN_DISPATCH_WAIT_MS: "50" } });
  await w.group("ann", "bob", { noAccount: ["ann"] });
  await w.team({ members: ["ann"] });
  w.ctx.id = { equals: (x) => x === "id:bio" };
  w.bundle(INQ);
  assert.equal((await w.runs.open(OPEN({ principalPlane: "member:ann", principalAi: "member:ann", actor: "member:ann", viewer: "member:ann" }))).started, true);
  const d = await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann", at: T0 });
  assert.equal(d.dispatched, true, JSON.stringify(d).slice(0, 300));
  const cred = () => w.row(`SELECT account_id, revoked_at FROM ai_credentials WHERE run = 'R1'`);
  assert.deepEqual({ ...cred() }, { account_id: w.accountsOf("group")[0], revoked_at: null });
  await w.removeAll("member:bob", "bob");
  assert.equal(cred().revoked_at, null, "another account's removal leaves it live");
  await w.removeAll("group", "admin");
  assert.notEqual(cred().revoked_at, null, "the serving account's removal revokes it");
});

test("notice membership:77 (membership R154): the names ai-runs reads from membership answer what member-roster answers — its registrations refused through listenerRefusal with membership's rows, a project run opened by a joined participant and refused to one only invited, and a run over a hidden project answered as absent to a member outside it", async () => {
  const w = world();
  await w.group("ann", "bob", "cat");
  w.project(PROJ, "ann", { joined: ["bob"], invited: ["cat"] });
  const malformed = w.runs.onRunOpened("scheduler", null);
  assert.deepEqual([malformed.code, malformed.check], ["LISTENER_MALFORMED", MEMBERSHIP_CHECKS.LISTENER_MALFORMED.check]);
  assert.equal(w.runs.onRunOpened("scheduler", () => null).ok, true);
  assert.deepEqual([w.runs.onRunOpened("scheduler", () => null).code], ["LISTENER_DECLARED"]);
  const as = (m) => ({ principalPlane: `member:${m}`, principalAi: `member:${m}`, actor: `member:${m}`, viewer: `member:${m}` });
  await w.account("bob");
  await w.account("cat");
  assert.equal((await w.runs.open(OPEN({ run: "B1", contextType: "project", contextId: PROJ, ...as("bob") }))).started, true);
  assert.equal((await w.runs.open(OPEN({ run: "C1", contextType: "project", contextId: PROJ, ...as("cat") }))).code, "AI_RUN_NOT_PROJECT_MEMBER");
  const outside = world();
  await outside.group("ann", "dan");
  outside.project(PROJ, "ann");
  assert.equal((await outside.runs.open(OPEN({ contextType: "project", contextId: PROJ, ...as("ann") }))).started, true);
  assert.deepEqual(await outside.runs.read({ run: "R1", viewer: "member:dan" }), { run: "R1", found: false, session: null });
});
