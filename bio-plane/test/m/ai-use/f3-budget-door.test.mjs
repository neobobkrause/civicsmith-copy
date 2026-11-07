/* ai-use F3 (coordinator 17:24, screens-ai ruling; screens-ai R2, R7): `aibudgetset` (the team's or a member's own limits
   and alert thresholds) and `aiprojectbudget` (a project's) are this module's ops: declared in DECLARED_OPS, they reach
   op-declarations' OPS with ai-use as their owner (R80, through store-assembly's owner map) and are answered by
   aiUseOps' arms through the assembled door (store-request's published `storeWorld()`). An administrator sets the team's
   limit and a threshold on it, a project's owner sets the project's limit, and `ailimits` reads each back from the store.
   Control: a member who neither administers nor owns the project is refused and nothing is set; an op no owner
   declares is UNKNOWN_OP. */
import "../../sandbox.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { storeWorld } from "../store-request/fixtures.mjs";
import { DECLARED_OPS } from "../../../src/ai-use/index.mjs";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { OWNERS } from "../../../src/store-assembly/declarations.mjs";

const caps = { capabilities: ["contribute", "create_projects"] };

test("F3 aibudgetset and aiprojectbudget are in OPS with ai-use as their owner, reversible and refused to a machine", async () => {
  await storeWorld();
  for (const op of ["aibudgetset", "aiprojectbudget"]) {
    assert.ok(Object.hasOwn(OPS, op), `${op} is in OPS`);
    assert.ok(Object.hasOwn(DECLARED_OPS, op), `${op} is declared here`);
    const owners = Object.entries(OWNERS).filter(([, ops]) => Object.hasOwn(ops, op)).map(([id]) => id);
    assert.deepEqual(owners, ["ai-use"], `${op}'s owner`);
    assert.equal(DECLARED_OPS[op].weight, "reversible");
    assert.deepEqual(DECLARED_OPS[op].machineClasses, []);
  }
});

test("F3 aibudgetset and aiprojectbudget answer through the store: an administrator's team limit and threshold, a project owner's project limit, each read back by ailimits; control: a member who owns neither is refused and nothing is set, and an undeclared op is UNKNOWN_OP", async () => {
  const w = await storeWorld();
  const rosa = await w.signIn("rosa", { admin: true });
  const ann = await w.signIn("ann", caps);
  const cal = await w.signIn("cal", caps);
  const project = await w.recipes.project(ann, "Stormwater");

  const team = await rosa.act("aibudgetset", { body: { scope: "overall", unit: "calls", period: "month", amount: 40 } });
  assert.equal(team.ok, true, JSON.stringify(team).slice(0, 300));
  assert.deepEqual([team.owner, team.amount, team.change], ["group", 40, "set"]);
  const alert = await rosa.act("aibudgetset", { body: { scope: "overall", unit: "calls", period: "month", kind: "percent", level: 80 } });
  assert.equal(alert.ok, true, JSON.stringify(alert).slice(0, 300));
  const teamLimits = await rosa.read("ailimits", { query: { owner: "group" } });
  assert.equal(teamLimits.ok, true, JSON.stringify(teamLimits).slice(0, 300));
  assert.ok(teamLimits.limits.some((l) => l.scope === "overall" && l.unit === "calls" && l.amount === 40), JSON.stringify(teamLimits).slice(0, 400));

  const owner = `project:${project}`;
  const proj = await ann.act("aiprojectbudget", { body: { project, scope: "ask", unit: "tokens", period: "day", amount: 5000 } });
  assert.equal(proj.ok, true, JSON.stringify(proj).slice(0, 300));
  assert.deepEqual([proj.owner, proj.amount], [owner, 5000]);
  const projLimits = await ann.read("ailimits", { query: { owner } });
  assert.ok(projLimits.limits.some((l) => l.scope === "ask" && l.unit === "tokens" && l.amount === 5000), JSON.stringify(projLimits).slice(0, 400));

  /* control: cal neither administers the team nor owns the project */
  const refusedFor = async (op, body) => {
    const err = await cal.act(op, { body }).then(() => null, (e) => e);
    assert.ok(err && err.answer, `${op} by cal is refused`);
    return err.answer.json.result;
  };
  const notAdmin = await refusedFor("aibudgetset", { scope: "overall", unit: "calls", period: "month", amount: 1 });
  assert.equal(notAdmin.code, "NOT_AN_ADMIN", JSON.stringify(notAdmin).slice(0, 300));
  const notOwner = await refusedFor("aiprojectbudget", { project, scope: "ask", unit: "tokens", period: "day", amount: 1 });
  assert.equal(notOwner.ok, false, JSON.stringify(notOwner).slice(0, 300));
  const teamAfter = await rosa.read("ailimits", { query: { owner: "group" } });
  assert.ok(!teamAfter.limits.some((l) => l.amount === 1), "nothing was set on the team's account by cal");
  const after = await ann.read("ailimits", { query: { owner } });
  assert.ok(!after.limits.some((l) => l.amount === 1), "nothing was set by cal");
  const unknown = await w.door({ url: `/api/?${new URLSearchParams({ op: "aibudgetsetx" })}`, method: "POST", body: "{}" }, ann);
  assert.equal(unknown.json && unknown.json.reason, "UNKNOWN_OP", JSON.stringify(unknown.json).slice(0, 300));
});
