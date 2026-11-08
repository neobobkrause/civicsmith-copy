/* CR2-28 (completion round 2; K5563; Membership v2 §4.7, §6): ONE ANSWER TO WHETHER A JUST-JOINED ADMINISTRATOR
   ADMINISTERS. The canon: an administrator is a member with role `admin` and status `active` (the Terms), enrolment is
   the moment a person takes up a membership (§6, D-158), "what decides these acts is the ROSTER, and the store asks it",
   and every enrolled administrator's session holds `member:<id>` (§4.7, D-136). So from her enrolment every reader
   answers her the same: `isAdministrator` asked with her member id or with the viewer her session is stamped
   (`member:<id>`, admission's `resolveSession`), `activeAdmins`, `sessionRights` (what `whoami` serves and
   screens-settings' `me.administer` reads), the credentials session, `instance-setup`'s `adminRecoveryStep` (asked with
   the viewer stamp) and `adminRemove`, where her vote is drawn and counted. Before CR2-28 `adminRecoveryStep` answered
   her NOT_AN_ADMIN: `isAdministrator("member:<id>")` read the spelling as a member id that no row holds. Every module
   here is the real one; the session is a real login. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, PASSWORD } from "../credentials/fixture.mjs";
import { boot } from "../instance-setup/fixture.mjs";
import { resolveSession } from "../../../src/admission/index.mjs";
import { aiAccountsOf } from "../../../src/ai-accounts/index.mjs";

/* The founder, a second administrator and an ordinary member; then `bea`, proposed by the founder as an administrator
   and so issued at once (K5563), enrolls and signs in. Answers the world and each session's stamps. */
async function justJoined() {
  const w = world();
  await w.group("ann");
  const add = await w.m.memberAdd({ memberId: "bea", cover: "cover of bea", role: "admin", by: "admin" });
  assert.equal(add.ok, true, JSON.stringify(add));
  assert.equal(typeof add.invite, "string", "the founder's proposal is issued at once (K5563)");
  const e = await w.m.enroll({ invite: add.invite, handle: "bea", password: PASSWORD("bea") });
  assert.equal(e.ok, true, JSON.stringify(e));
  await w.c.setPassword({ role: "member:bea", password: PASSWORD("bea") });
  const setup = (await boot({ more: { membership: w.m, credentials: w.c, aiAccounts: aiAccountsOf(w.ctx) } })).m;
  const session = async (handle) => {
    const l = await w.c.login({ handle, password: PASSWORD(handle) });
    assert.equal(l.ok, true, JSON.stringify(l));
    const s = w.c.session(l.token);
    return { s, ...resolveSession(s) };
  };
  return { w, setup, bea: await session("bea"), ann: await session("ann") };
}

/* Every reader's answer to "does this session administer?", each a boolean. */
function answers({ w, setup }, who) {
  const recovery = setup.adminRecoveryStep({ viewer: who.viewer });
  return {
    byId: w.m.isAdministrator(who.member),
    byViewer: w.m.isAdministrator(who.viewer),
    byIdentity: w.m.isAdministrator(who.identity),
    activeAdmins: w.m.activeAdmins().includes(who.member),
    sessionRights: w.m.sessionRights(who.s.role).administer === true,
    session: who.s.administer === true,
    recoveryStep: recovery.ok === true,
  };
}
const all = (v) => Object.fromEntries(Object.keys(answers.keys).map((k) => [k, v]));
answers.keys = { byId: 1, byViewer: 1, byIdentity: 1, activeAdmins: 1, sessionRights: 1, session: 1, recoveryStep: 1 };

test("CR2-28 a just-joined administrator (issued at once by the founder, K5563) is answered an administrator by every reader, her session's viewer stamp included", async () => {
  const t = await justJoined();
  assert.equal(t.bea.viewer, "member:bea", "the door stamps an enrolled administrator's viewer member:<id> (§4.7)");
  assert.deepEqual(answers(t, t.bea), all(true));
  const step = t.setup.adminRecoveryStep({ viewer: t.bea.viewer });
  assert.deepEqual(step, { ok: true, administrators: 3, codes_held: false, remaining: 0, met: false });
});

test("CR2-28 the same session draws adminremove and her vote is counted: the roster that admits her there is the one every reader asks", async () => {
  const t = await justJoined();
  const v = t.w.m.adminRemove({ memberId: "second", by: t.bea.member, reason: "test of the count" });
  assert.equal(v.reason, "VOTES_SHORT", JSON.stringify(v));
  assert.deepEqual([v.have, v.deciders], [1, ["bea"]], "her vote is drawn and counted");
  assert.equal(t.w.m.isAdministrator(t.bea.viewer), true, "and the roster read answers her the same");
  assert.equal(t.setup.adminRecoveryStep({ viewer: t.bea.viewer }).ok, true);
});

test("CR2-28 control: an ordinary member is answered no by every reader, by id and by viewer; a viewer carrying a project, a machine credential and a spelling of no one are no administrator", async () => {
  const t = await justJoined();
  assert.deepEqual(answers(t, t.ann), all(false));
  assert.equal(t.setup.adminRecoveryStep({ viewer: t.ann.viewer }).reason, "NOT_AN_ADMIN");
  assert.equal(t.w.m.adminRemove({ memberId: "second", by: t.ann.member, reason: "x" }).reason, "NOT_AN_ADMIN");
  for (const x of ["member:bea@P-1", "admin@P-1", "class:admin", "class:member", "member:", "member:nobody", "member:Bea",
                   " member:bea", "bea ", null, undefined, "", 7, {}])
    assert.equal(t.w.m.isAdministrator(x), false, String(x));
  /* the founder is answered alike by her two spellings (R43: bare `admin` and `member:admin`) */
  assert.deepEqual([t.w.m.isAdministrator("admin"), t.w.m.isAdministrator("member:admin")], [true, true]);
  /* an administrator removed is none, by either spelling */
  t.w.m.adminRemove({ memberId: "bea", by: "admin", reason: "gone" });
  assert.deepEqual([t.w.m.isAdministrator("bea"), t.w.m.isAdministrator("member:bea")], [false, false]);
});
