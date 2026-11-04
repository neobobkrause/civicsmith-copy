/* Notice membership:77 (membership R154, PR 77): membership's delegates answer what `member-roster` answers. ai-accounts reads
   five of them through membership: `memberFacts` (an owner's standing, R1, R31), `isAdministrator` (the team's authority, R5,
   R6), `notAnAdmin` (its refusal, R5, R20), `listenerRefusal` (R23, R26's registrations) and `onRevoked` (R27). PR 77 added
   tests and struck R154's mark; it changed no code ai-accounts calls. Confirmed here: what ai-accounts decides from each
   matches what member-roster answers over the same store, so nothing in ai-accounts needs to change. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, SECRET } from "./fixture.mjs";
import { PLANS as P } from "./catalogue.mjs";
import { listenerRefusal as rosterRefusal, notAnAdmin as rosterNotAnAdmin } from "../../../src/member-roster/index.mjs";
import { listenerRefusal as membershipRefusal, notAnAdmin as membershipNotAnAdmin } from "../../../src/membership/index.mjs";

const row = (r) => [r.ok, r.reason ?? r.code, r.check, r.translation];

test("notice membership:77 ai-accounts' team authority follows membership's isAdministrator and notAnAdmin delegates, which answer as member-roster does", async () => {
  const w = await world().group("ann");
  const roster = w.m.members;
  for (const id of ["admin", "second", "ann", "nobody"]) assert.equal(w.m.isAdministrator(id), roster.isAdministrator(id), id);
  assert.equal(membershipNotAnAdmin, rosterNotAnAdmin, "membership re-exports member-roster's own notAnAdmin (R154)");
  const team = (by) => w.a.accountSet({ owner: "group", provider: P.provider, plan: P.teamApi, means: "sealed", secret: SECRET("team"), by });
  assert.deepEqual(row(await team("ann")), row(rosterNotAnAdmin("ann", "x")), "a plain member is refused with member-roster's row");
  assert.equal((await team("second")).ok, true, "an administrator member-roster counts sets it");
});

test("notice membership:77 ai-accounts' standing checks follow membership's memberFacts delegate, and its registrations are refused by member-roster's own listenerRefusal", async () => {
  const w = await world().group("ann", "bob");
  const roster = w.m.members;
  for (const id of ["ann", "bob", "nobody"]) assert.deepEqual(w.m.memberFacts(id), roster.memberFacts(id), id);
  w.m.memberSet({ memberId: "bob", status: "revoked", by: "admin" });
  assert.equal(roster.memberFacts("bob").status, "revoked");
  const own = (m) => w.a.accountSet({ owner: `member:${m}`, provider: P.provider, plan: P.memberApi, means: "sealed", secret: SECRET(m), by: m });
  assert.equal((await own("ann")).ok, true);
  assert.equal((await own("bob")).reason, "ACCOUNT_MEMBER_NOT_ACTIVE", "revoked as member-roster says");
  assert.equal(membershipRefusal, rosterRefusal, "membership re-exports member-roster's own listenerRefusal (R154)");
  assert.equal(w.a.onAccountCleared("credentials", () => {}).ok, true);
  const second = w.a.onAccountCleared("credentials", () => {});
  assert.deepEqual(row(second), row(rosterRefusal(new Map([["credentials", () => {}]]), "credentials", () => {})));
  const malformed = w.a.onAccountCleared("other", "not a function");
  assert.deepEqual(row(malformed), row(rosterRefusal(new Map(), "other", "not a function")));
});
