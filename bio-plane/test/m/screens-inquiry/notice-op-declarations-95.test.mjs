/* Provider notice op-declarations:95 (PR 95; ai-accounts R35: the old door retired with no aliases, op-declarations R20, R24,
 * R30, R41 restated). The dock read who serves the member from `accountreference`, `groupkeystate` and (on a project)
 * `projectaccountstate`, which no table declares now; it reads T53's `accountsof` (ai-accounts R2) for her own, the team's and
 * the project's lists, an owner serving when an account on its list is switched on (R4, R42's "whose account serves"). The
 * answers are ai-accounts' real service's (fixtures.mjs' `aiAccounts`). The shell's reachability reads (interface-shell
 * R20: `assistantstate` and `aipathready`) are answered ready only so the dock can open. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ok } from "../interface-shell/harness.mjs";
import { keepAwayState } from "../ai-accounts/fixtures.mjs";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { open, plane, says, aiAccounts, SCREENS, P, Q } from "./fixtures.mjs";

const { ACCOUNTS, accountsOf } = await aiAccounts();
const RETIRED = ["accountreference", "groupkeystate", "projectaccountstate"];
/* ai-accounts' real keep-away answer, off, where the dock reads `aikeepawaystate` */
const { off: OFF } = await keepAwayState({ reason: "court order" });
const FRAME = { assistantstate: ok({ on: true }), aikeepawaystate: ok(OFF), aipathready: ok({ state: "ready" }),
  aiusage: ok({ ok: true }), agentpack: ok({ ok: true, pack: { version: "civicsmith@3+ab12cd" } }),
  airuns: (r) => ok({ ok: true, context: { type: r.query.contextType, id: r.query.contextId }, runs: [], count: 0 }) };
async function dock(path, accountsof) {
  const p = await open(path, { boot: { plane: { ...plane(), ...FRAME, accountsof } } });
  await p.click(p.root().querySelector('.cs-mast [data-shell="dock"]'));
  await p.settle();
  return p;
}
const panel = (p) => p.root().querySelector(".cs-dock");

test("notice op-declarations:95: the dock reads accountsof, an op the tables declare, and none of the retired door's reads", async () => {
  assert.ok(Object.hasOwn(OPS, "accountsof"));
  for (const op of RETIRED) assert.ok(!Object.hasOwn(OPS, op), `${op} is retired`);
  const dockReads = Object.values(SCREENS.find((s) => s.id === "assistant").reads({ subject: Q })).map((r) => r.op);
  for (const op of RETIRED) assert.ok(!dockReads.includes(op), `the dock does not read ${op}`);
  const p = await dock("/app/question/" + Q, accountsOf());
  assert.deepEqual(p.byOp("accountsof").map((r) => r.query.owner).sort(), ["group", "member:mai"]);
  const onProject = await dock("/app/project/" + P, accountsOf());
  assert.deepEqual(onProject.byOp("accountsof").map((r) => r.query.owner).sort(), ["group", "member:mai", "project:" + P]);
  assert.equal(onProject.byOp("projectaccountstate").length, 0, "the project's account is read by accountsof alone");
});

test("notice op-declarations:95: whose account serves her follows accountsof's lists (her own, else the team's), not the retired reads", async () => {
  /* the retired reads still answer "held" for the shell's frame: what the dock says comes from accountsof alone */
  const team = await dock("/app/question/" + Q, accountsOf({ own: ACCOUNTS.none }));
  assert.ok(says(panel(team), "ai.account.group.inline") && !says(panel(team), "ai.account.own.inline"), "her list empty: the team's key serves");
  const own = await dock("/app/question/" + Q, accountsOf());
  assert.ok(says(panel(own), "ai.account.own.inline"), "her own key on");
  const project = await dock("/app/project/" + P, accountsOf({ project: ACCOUNTS.project }));
  assert.ok(says(panel(project), "ai.account.project.inline"), "the project's own key on, in its project");
  /* control: no list holds an account switched on: nobody is said to serve her */
  const none = await dock("/app/question/" + Q, accountsOf({ own: ACCOUNTS.none, group: ACCOUNTS.none }));
  assert.ok(says(panel(none), "screen.assistant.serves.unknown"));
});
