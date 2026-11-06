/* R115 and F1 (T53; DEC-466 U3; AIR5; coordinator ruling 5 Nov 17:24 for screens-ai): Setup's ready state,
   `assistantReadiness({viewer})` and its op `assistantreadiness`, over the REAL ai-accounts and membership of ai-accounts'
   own test world (its R74 `accountsOnSummary`), the projects' names read from that world's record-core. */
import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "./fixture.mjs";
import { world as aiAccountsWorld } from "../ai-accounts/fixture.mjs";
import { DECLARED_OPS, instanceSetupOps } from "../../../src/setup.mjs";

/* the team: ann owns project P and bob joins it; cy owns S; eve is in neither */
async function over() {
  const c = await aiAccountsWorld().group("ann", "bob", "cy", "dee", "eve");
  c.project("P", "ann");
  assert.equal(c.join("P", "ann", "bob").ok, true);
  c.project("S", "cy");
  /* one database: this module's record-core is the real one over the world's tables, where the projects' bundles are */
  const w = await boot({ st: { db: c.db }, more: { membership: c.m, aiAccounts: c.a } });
  return { ...w, c };
}
/* an account set by its owner's act, then switched on by that owner */
async function on(c, set, by) {
  const r = await set;
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(c.a.accountSwitch({ account_id: r.account_id, on: true, by }).ok, true);
  return r;
}
const route = (m, viewer) => instanceSetupOps(m, new URL("http://do/?" + new URLSearchParams({ op: "assistantreadiness", viewer })), null).assistantreadiness();

test("R115 assistantReadiness: none on answers not_ready/no_account_on; one team account on answers ready with accounts_on 1, two with 2", async () => {
  const w = await over();
  assert.deepEqual(w.m.assistantReadiness({ viewer: "ann" }), { ok: true, state: "not_ready", reason: "no_account_on" });
  await on(w.c, w.c.team(), "admin");
  assert.deepEqual(w.m.assistantReadiness({ viewer: "ann" }), { ok: true, state: "ready", accounts_on: 1 });
  await on(w.c, w.c.team({ secret: "sk-ant-api03-second-team-key-0123456789" }), "admin");
  assert.deepEqual(w.m.assistantReadiness({ viewer: "eve" }), { ok: true, state: "ready", accounts_on: 2 });
});

test("R115 assistantReadiness: no team account and a joined project with one answers project_only naming that project, and a project the viewer cannot see is absent", async () => {
  const w = await over();
  await on(w.c, w.c.projectAccount("P", "ann"), "ann");
  const name = w.c.core.bundleInfo("P").title;
  assert.ok(typeof name === "string" && name, "the project has its name");
  assert.deepEqual(w.m.assistantReadiness({ viewer: "bob" }), { ok: true, state: "project_only", projects: [{ id: "P", name }] });
  assert.deepEqual(w.m.assistantReadiness({ viewer: "eve" }), { ok: true, state: "not_ready", reason: "no_account_on" }, "P is hidden from eve");
  await on(w.c, w.c.projectAccount("S", "cy"), "cy");
  assert.deepEqual(w.m.assistantReadiness({ viewer: "bob" }).projects.map((p) => p.id), ["P"], "S is not bob's to see");
});

test("R115 control: a member's own account is never counted, keep-away leaves the answer to the accounts while assistantState answers on: false, and an unreadable summary answers not_ready/unreadable, never ready", async () => {
  const w = await over();
  await on(w.c, w.c.own("cy"), "cy");
  assert.deepEqual(w.m.assistantReadiness({ viewer: "cy" }), { ok: true, state: "not_ready", reason: "no_account_on" });
  await on(w.c, w.c.team(), "admin");
  assert.equal(w.c.c.aiKeepAwaySet({ on: true, reason: "Our tenants' letters stay here.", by: "admin" }).ok, true);
  assert.equal(w.m.assistantState().on, false);
  assert.deepEqual(w.m.assistantReadiness({ viewer: "cy" }), { ok: true, state: "ready", accounts_on: 1 });
  const before = w.c.snapshot();
  w.m.assistantReadiness({ viewer: "cy" });
  assert.equal(w.c.snapshot(), before, "it writes nothing");
  w.c.sql.exec(`ALTER TABLE ai_accounts RENAME TO ai_accounts_gone`);
  assert.deepEqual(w.m.assistantReadiness({ viewer: "cy" }), { ok: true, state: "not_ready", reason: "unreadable" });
});

test("F1 assistantreadiness is declared (a read for admin and member, no machine class, no field) and routed with the stamped viewer to R115's answer", async () => {
  assert.deepEqual({ ...DECLARED_OPS.assistantreadiness, description: undefined },
    { classes: ["admin", "member"], machineClasses: [], mutating: false, weight: "read", description: undefined, fields: { accepts: [], requires: [] } });
  const w = await over();
  await on(w.c, w.c.projectAccount("P", "ann"), "ann");
  assert.deepEqual((await route(w.m, "member:bob")).projects.map((p) => p.id), ["P"], "the stamp is the viewer");
  assert.equal((await route(w.m, "member:eve")).state, "not_ready");
});
