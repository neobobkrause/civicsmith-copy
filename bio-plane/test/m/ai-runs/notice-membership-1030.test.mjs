/* ai-runs, provider notice membership:1030 (PR 1030): membership's `isAdministrator` now also takes a viewer string
   `member:<id>` (not carried into a project) and reads it as the bare id. ai-runs calls it at one site, R91/R103's
   parts reader, with the bare id it already derived (`memberIdOf`), so its answer is unchanged: confirmed, no code
   change. This test holds that answer over the real membership: an administrator who is not the run's member reads the
   parts of a run the team's account paid for, by either spelling of the provider's argument; a member who is neither
   the run's member nor an administrator does not. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, OPEN, PROJ, T0, ENTRY, ENTRIES } from "./world.mjs";

const ACCEPT = { status: 202, body: { accepted: true, run_id: "R1" } };
const ANN = { principalPlane: "member:ann", principalAi: "member:ann", actor: "member:ann", viewer: "member:ann" };
const TICK = { caller: "member:ann", viewer: "member:ann", actor: "member:ann" };
const at = (m) => new Date(Date.parse(T0) + m * 60000).toISOString().replace(/\.\d+Z$/, "Z");

test("membership:1030 (R91, R103): the team's administrator reads the parts of a team-paid run through isAdministrator, which answers the same for `second` and `member:second`; control: bob, a joined member of the project but no administrator and not the run's member, reads found: false", async () => {
  const { agentWorker } = await import("./world.mjs");
  const aw = agentWorker(ACCEPT);
  const w = world({ env: { AGENT_WORKER: aw, STORE: { idFromName: (n) => `id:${n}` }, AI_RUN_DISPATCH_WAIT_MS: "50" } });
  await w.group("ann", "bob", { noAccount: ["ann"] });
  await w.account("ann", "apikey", "secret-0-of-ann-0123456789", { entries: [ENTRIES.a] });
  await w.team({ members: ["ann"] });
  w.ctx.id = { equals: (x) => x === "id:bio" };
  w.project(PROJ, "ann", { joined: ["second", "bob"] });
  assert.equal((await w.runs.open(OPEN({ contextType: "project", contextId: PROJ, at: T0, ...ANN }))).started, true);
  assert.equal((await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann", at: T0 })).dispatched, true);
  w.runs.tick({ run: "R1", ...TICK, at: at(0), usage: [ENTRY()] });
  w.aiAccounts.hopFor = () => ({ ok: true, account_id: w.accountsOf("group")[0], entry_id: ENTRIES.a, level: "group", owner: "group",
                                 means: "sealed", payer_change: { from_owner: "member:ann", to_owner: "group" } });
  await w.runs.tickAndContinue({ run: "R1", ...TICK, at: at(1),
    segment_end: { by: "ai", done: false, refusals: [], ai_stop: { reason: "limit", class: "rate_limit" } } });
  assert.equal((await w.op("aicontinue", { actor: "member:ann", viewer: "member:ann" }, { run: "R1" })).dispatched, true);
  const owners = w.rows(`SELECT payer_owner FROM ai_run_segments WHERE run = 'R1' ORDER BY n`).map((r) => r.payer_owner);
  assert.ok(owners.includes("group"), JSON.stringify(owners));

  const m = w.membership;
  assert.equal(m.isAdministrator("second"), true);
  assert.equal(m.isAdministrator("member:second"), true, "the provider's new spelling answers the same");
  assert.equal(m.isAdministrator("bob"), false);

  const admin = w.runs.runParts({ run: "R1", viewer: "member:second" });
  assert.equal(admin.found, true, JSON.stringify(admin).slice(0, 300));
  assert.equal(admin.parts.length, 2);
  assert.deepEqual(w.runs.runParts({ run: "R1", viewer: "member:bob" }), { found: false, parts: [] });
});
