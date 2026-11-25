/* T47 (K3076; credentials R67): R141, the handle `admin` is reserved for the founder. Enrolment and every handle check
   refuse it as taken (R16's HANDLE_TAKEN; R123's `taken`), so no member can hold it; any other spelling of it is refused
   too (R12's pattern admits lower case only). Controls: a handle that merely starts with it, and its suggestion, are
   free and enrol. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V } from "./fixture.mjs";

async function group() {
  const w = await world().group("ann");
  w.inv = (await w.m.memberAdd({ memberId: "cal", cover: "cover of cal", by: "admin" })).invite;
  return w;
}
const PASSWORD = "cal-passphrase-x";
const tables = (w) => JSON.stringify(w.rows(`SELECT member_id, handle, status, invite_hash FROM members ORDER BY member_id`));

test("R57 enrolling as admin, in any case or with spaces, is refused and writes nothing; the invitation stays live", async () => {
  const w = await group();
  const before = tables(w);
  assert.deepEqual(await w.m.enroll({ invite: w.inv, handle: "admin", password: PASSWORD }),
    { ok: false, reason: "HANDLE_TAKEN", handle: "admin" });
  assert.deepEqual(await w.m.enroll({ invite: w.inv, handle: "  admin ", password: PASSWORD }),
    { ok: false, reason: "HANDLE_TAKEN", handle: "admin" }, "trimmed, then taken");
  for (const h of ["Admin", "ADMIN", "aDmIn"]) {
    const r = await w.m.enroll({ invite: w.inv, handle: h, password: PASSWORD });
    assert.equal(r.ok, false, h);
    assert.equal(r.reason, "BAD_HANDLE", `${h}: R12's pattern is lower case only`);
  }
  /* through the op, as the control plane routes it */
  assert.equal((await w.ops("", { invite: w.inv, handle: "admin", password: PASSWORD }).enroll()).reason, "HANDLE_TAKEN");
  assert.equal(tables(w), before, "nothing written");
  assert.equal(w.m.memberFacts("cal").status, "invited");
  assert.equal(w.m.memberByHandle("admin"), null, "no member holds the handle admin");
  /* control: another handle is accepted on the same invitation */
  assert.deepEqual(await w.m.enroll({ invite: w.inv, handle: "administrator", password: PASSWORD }),
    { ok: true, memberId: "cal", handle: "administrator" });
});

test("R57 every handle check answers admin taken, by invitation and by an active member, with R50's suggestion; other spellings not allowed", async () => {
  const w = await group();
  const byInvite = await w.m.handleCheck({ invite: w.inv, handle: "admin" });
  assert.deepEqual([byInvite.ok, byInvite.state, byInvite.suggestion, byInvite.words.key],
    [true, "taken", "admin-2", "handle.taken"]);
  const byMember = await w.m.handleCheck({ viewer: V("ann"), handle: "admin" });
  assert.deepEqual([byMember.state, byMember.suggestion], ["taken", "admin-2"]);
  const viaOp = await w.ops(`viewer=${encodeURIComponent(V("ann"))}`, { handle: "admin" }).handlecheck();
  assert.equal(viaOp.state, "taken");
  for (const h of ["Admin", "ADMIN"]) assert.equal((await w.m.handleCheck({ invite: w.inv, handle: h })).state, "not_allowed", h);
  /* control: a handle that starts with it, and the suggestion, are free */
  for (const h of ["admin-2", "administrator", "admins"])
    assert.equal((await w.m.handleCheck({ invite: w.inv, handle: h })).state, "free", h);
});
