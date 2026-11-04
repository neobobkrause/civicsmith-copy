/* Provider notices answered at this module's interface (attempt 1, replacement session, 4 Nov 2026), each over the
   provider's real code on tranche, in its own published test world. jurisdictions:40 is in seeds.test.mjs, beside R50. */
import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "./fixture.mjs";
import { world } from "../credentials/fixture.mjs";
import { aiAccountsOf } from "../../../src/ai-accounts/index.mjs";

async function over(w) {
  const s = await boot({ more: { membership: w.m, credentials: w.c, aiAccounts: aiAccountsOf(w.ctx) } });
  return s.m;
}

/* credentials:74 (R27, R63, R73 tested and struck there; no code changed): this module mints no ai grant and no run
   credential and clears no account; it reads only recoveryCodesState (R66) and lastActivity (R95), which PR 74 left as
   they were. Confirmed: the step answers over the real credentials as R66 states, and reading it writes nothing. */
test("notice credentials:74 (credentials R27, R63, R73) confirmed: R66's step over the real credentials answers each administrator's own codes, and reading it writes nothing in credentials' store", async () => {
  const w = world();
  await w.claim();
  await w.enrol("second", "admin");
  w.c.recoveryCodesIssue({ by: "admin" });
  const m = await over(w);
  const before = w.snapshot();
  assert.deepEqual(m.adminRecoveryStep({ viewer: "admin" }), { ok: true, administrators: 2, codes_held: true, remaining: 10, met: true });
  assert.deepEqual(m.adminRecoveryStep({ viewer: "second" }), { ok: true, administrators: 2, codes_held: false, remaining: 0, met: false });
  assert.equal(w.snapshot(), before, "the read writes nothing");
});

/* membership:77 (R154: adminProposalCancel and adminRemovals delegated to member-roster; tests and mark only): this module
   asks membership isAdministrator, activeAdmins, memberFacts, memberList and hostingAccess, none of them moved by PR 77.
   Confirmed: an administrator enrolled through the real membership is one to this module's acts, a member is not. */
test("notice membership:77 (membership R154) confirmed: over the real membership and its member-roster delegates, an enrolled administrator passes this module's administrator gate and is counted by activeAdmins, and a member is refused NOT_AN_ADMIN", async () => {
  const w = world();
  await w.group("ann");
  const m = await over(w);
  assert.deepEqual(w.m.activeAdmins(), ["admin", "second"]);
  assert.equal(m.adminRecoveryStep({ viewer: "second" }).administrators, 2);
  const r = m.adminRecoveryStep({ viewer: "ann" });
  assert.deepEqual([r.ok, r.code], [false, "NOT_AN_ADMIN"]);
  assert.equal(m.placeWantedSet({ name: "Port Ellery", by: "second" }).ok, true);
  assert.deepEqual([m.placeWantedSet({ name: "Port Ellery", by: "ann" }).code], ["NOT_AN_ADMIN"]);
});
