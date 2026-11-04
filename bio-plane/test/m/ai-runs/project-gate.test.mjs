/* ai-runs R81 (T49; D5; amends R9, R11 and R13's relay of run-rules R6): the project gate reads the actor as participation
   is keyed. `membership.participation` is keyed by the bare member id; the actor arrives as `member:<id>` (what action-plans'
   `planAsk` passes), `member:<id>/<tokenId>` or `<id>`, and all three are asked as `<id>`. An actor naming no member is judged
   as before, never read as an absent one. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, OPEN, PROJ, ORG } from "./world.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const PLN = "PLN-2026-0001";
/** The sight of an organisation `ai` credential's run (`class:ai`): a machine viewer sees every project, so the gate alone judges the actor. */
const MACHINE = "class:ai";
const FORMS = (id) => [`member:${id}`, id, `member:${id}/tok-${id}`];
/** A project owned by `owner`, `joiner` joined, `invited` invited only, `outsider` a member who was never invited. */
async function gateWorld() {
  const w = world({ deployedModes: ["check", "plan"] });
  await w.group("owner", "joiner", "invited", "outsider");
  w.project(PROJ, "owner", { joined: ["joiner"], invited: ["invited"] });
  /* action-plans fills R47 for mode `plan` (its R30); a check that passes, as for a joined participant */
  assert.equal(w.runs.registerOpenCheck("action-plans", "plan", () => null).ok, true);
  return w;
}
let n = 0;
/** What `planAsk` hands `open`: the stamped author as principal, Claude principal, actor and viewer alike. */
const ask = (w, actor, over = {}) => {
  const m = actor.replace(/^member:/, "").split("/")[0];
  return w.runs.open(OPEN({ run: `RP${n++}`, contextType: "project", contextId: PROJ, mode: "plan", plan: PLN,
    label: word("action-plans.label.asking_assistant_options"), principalPlane: `member:${m}`, principalAi: `member:${m}`,
    bounds: [{ bound: "proposals", allowed: 5 }], actor, viewer: `member:${m}`, ...over }));
};
const refusedNotMember = (r, what) => {
  assert.equal(r.started, false, what);
  assert.equal(r.code, "AI_RUN_NOT_PROJECT_MEMBER", `${what}: ${JSON.stringify(r).slice(0, 160)}`);
};

test("R81: a project's owner and a joined member each open a plan run through planAsk's call with the actor member:<id>, and as <id> and member:<id>/<tokenId> too; the answer states the participant ground", async () => {
  const w = await gateWorld();
  for (const id of ["owner", "joiner"])
    for (const form of FORMS(id)) {
      const r = await ask(w, form);
      assert.equal(r.started, true, `${form}: ${JSON.stringify(r).slice(0, 160)}`);
      assert.deepEqual([r.projectGate.applied, r.projectGate.ground], [true, "PARTICIPANT"], form);
    }
});

test("R81 (control): a member who has not joined — invited only, or never invited — is refused AI_RUN_NOT_PROJECT_MEMBER in every form of the actor, with nothing written", async () => {
  const w = await gateWorld();
  const before = w.dump();
  for (const form of FORMS("invited")) refusedNotMember(await ask(w, form), `${form} at the open`);
  /* never invited: a member's own sight cannot reach the project (it answers as absent, R9), so the gate is asked through a run
     of the organisation's credential, whose machine sight sees it and leaves the actor alone to be judged */
  for (const form of FORMS("outsider"))
    refusedNotMember(await ask(w, form, { principalPlane: ORG, viewer: MACHINE }), `${form} at the open`);
  assert.equal(w.dump(), before, "no run, bound or log entry on any refusal");
});

test("R81 (control): an actor that names no member over a project is judged as before — a machine class or token stamp is refused AI_RUN_NOT_PROJECT_MEMBER, never passed unapplied as NO_MEMBER_BEHIND_CALLER; an empty actor still passes unapplied", async () => {
  const w = await gateWorld();
  const before = w.dump();
  for (const actor of ["class:ai/tok-org", "class:ai", "token:abc", "member:", "member:/tok"])
    refusedNotMember(await w.runs.open(OPEN({ run: "RM", contextType: "project", contextId: PROJ, mode: "check", principalAi: "member:owner",
      actor, viewer: MACHINE })), `actor ${actor}`);
  assert.equal(w.dump(), before);
  for (const actor of [null, "", "   "]) {
    const r = await w.runs.open(OPEN({ run: `RE${n++}`, contextType: "project", contextId: PROJ, mode: "check",
      principalAi: "member:owner", actor, viewer: MACHINE }));
    assert.deepEqual([r.started, r.projectGate.applied, r.projectGate.ground], [true, false, "NO_MEMBER_BEHIND_CALLER"], String(actor));
  }
});

test("R81: a tick and a close with the actor member:<id> (and member:<id>/<tokenId>, and <id>) pass the gate for a joined participant, and are refused AI_RUN_NOT_PROJECT_MEMBER, the run untouched, once she has left", async () => {
  const w = await gateWorld();
  const opened = await ask(w, "member:joiner", { run: "RT" });
  assert.equal(opened.started, true);
  const tick = (actor, caller = "member:joiner") => w.runs.tick({ run: "RT", actor, viewer: "member:joiner", caller, at: "2026-07-01T00:05:00Z" });
  for (const form of FORMS("joiner")) {
    const t = await tick(form);
    assert.deepEqual([t.ticked, t.projectGate.applied, t.projectGate.ground], [true, true, "PARTICIPANT"], form);
  }
  /* she leaves: every form is refused at the tick and at the close, and the run is still running */
  w.membership.projectLeave({ projectId: PROJ, by: "joiner", comment: "done" });
  for (const form of FORMS("joiner")) {
    const t = await tick(form);
    assert.deepEqual([t.ticked, t.code], [false, "AI_RUN_NOT_PROJECT_MEMBER"], `tick ${form}`);
    const c = await w.runs.close({ run: "RT", bound: "cancelled", actor: form, viewer: "member:joiner", caller: "member:joiner" });
    assert.deepEqual([c.terminated, c.code], [false, "AI_RUN_NOT_PROJECT_MEMBER"], `close ${form}`);
  }
  assert.equal(w.row(`SELECT status FROM ai_runs WHERE run='RT'`).status, "running");
  /* a machine class stamp ticking over the project is refused as today, not passed unapplied (its caller is the run's principal) */
  const m = await w.runs.open(OPEN({ run: "RC", contextType: "project", contextId: PROJ, mode: "check", principalAi: "member:owner",
    actor: "owner", viewer: MACHINE }));
  assert.equal(m.started, true);
  const machine = await w.runs.tick({ run: "RC", actor: "class:ai/tok-org", viewer: MACHINE, caller: ORG });
  assert.deepEqual([machine.ticked, machine.code], [false, "AI_RUN_NOT_PROJECT_MEMBER"]);
  /* and the owner closes it as member:<id> */
  assert.equal((await w.runs.close({ run: "RC", bound: "cancelled", actor: "member:owner", viewer: MACHINE, caller: ORG })).terminated, true);
});
