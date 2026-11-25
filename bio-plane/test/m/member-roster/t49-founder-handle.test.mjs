/* T49-1 (N1072, K3265; DEC-230): R59, the founder's own handle, and R57 as re-worded (`admin` is an id only, the handle of
   no one, the founder included). Each id is tested here explicitly, with a negative control per refusal (K874). Every
   test drives the module at its interface. R60's `MODULE_ORDER` is `module-order.test.mjs`'s. (A hidden project's
   existence naming the founder's handle is `membership`'s R77.) */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, snapshot } from "./fixture.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { Members, MEMBER_EXEMPT_TABLES, MEMBER_DECLARED_TABLES, viewerMember } from "../../../src/member-roster/index.mjs";
import { MEMBER_ROSTER_ROWS } from "../../../src/member-roster/checks.mjs";
const { MEMBERSHIP_CHECKS } = MEMBER_ROSTER_ROWS;

const PASSWORD = "cal-passphrase-x";
const founderRows = (w) => JSON.stringify(w.rows(`SELECT id, handle FROM founder_handle`));

/* The founder, `second` (an administrator), ann and bob active, cal invited. */
async function group() {
  const w = await world().group("ann", "bob");
  w.inv = (await w.m.memberAdd({ memberId: "cal", cover: "cover of cal", by: "admin" })).invite;
  return w;
}

test("R59 founderHandleSet by the founder holds the handle: founderHandle() answers it, sessionRights(admin).handle names it, handleCheck answers it taken; control: none is held before", async () => {
  const w = await group();
  assert.equal(w.m.founderHandle(), null, "none held at first");
  assert.equal(w.m.sessionRights("admin").handle, null, "and sessionRights names none");
  assert.deepEqual(await w.m.handleCheck({ invite: w.inv, handle: "steward" }), {
    ok: true, handle: "steward", state: "free", problems: [], suggestion: null, words: { key: "handle.free", en: word("handle.free", { handle: "{handle}", group: "{group}" }) } });
  const set = w.m.founderHandleSet({ handle: "steward", by: "admin" });
  assert.deepEqual(set, { ok: true, handle: "steward" });
  assert.equal(w.m.founderHandle(), "steward");
  assert.equal(founderRows(w), JSON.stringify([{ id: 1, handle: "steward" }]));
  const rights = w.m.sessionRights("admin");
  assert.deepEqual([rights.handle, rights.member, rights.administer, rights.rootOfTrust], ["steward", "admin", true, true]);
  assert.deepEqual(rights.capabilities, ["contribute", "publish", "create_projects"], "R92's other fields are unchanged");
  /* R123: taken, by invitation and by an active member, with a suggestion that is itself free */
  const byInvite = await w.m.handleCheck({ invite: w.inv, handle: "steward" });
  assert.deepEqual([byInvite.ok, byInvite.state, byInvite.suggestion, byInvite.words.key], [true, "taken", "steward-2", "handle.taken"]);
  const byMember = await w.m.handleCheck({ viewer: V("ann"), handle: "steward" });
  assert.deepEqual([byMember.state, byMember.suggestion], ["taken", "steward-2"]);
  assert.equal((await w.m.handleCheck({ invite: w.inv, handle: "steward-2" })).state, "free", "the suggestion is free");
  /* control: a handle that only starts with hers, and a member's own, behave as before */
  assert.equal((await w.m.handleCheck({ invite: w.inv, handle: "stewards" })).state, "free");
  assert.equal((await w.m.handleCheck({ invite: w.inv, handle: "ann" })).state, "taken");
  /* the suggestion never lands on her handle: with steward-2 held by a member, the next is steward-3 */
  await w.enrol("steward-2");
  assert.equal((await w.m.handleCheck({ invite: w.inv, handle: "steward" })).suggestion, "steward-3");
  /* the ordinary members' rights are untouched */
  assert.equal(w.m.sessionRights(V("ann")).handle, "ann");
  assert.equal(w.m.sessionRights("class:admin").handle, null);
});

test("R59 R13 enroll with the founder's handle is refused HANDLE_TAKEN and writes nothing; control: a free handle enrols on the same invitation", async () => {
  const w = await group();
  assert.equal(w.m.founderHandleSet({ handle: "steward", by: "admin" }).ok, true);
  const before = snapshot(w);
  assert.deepEqual(await w.m.enroll({ invite: w.inv, handle: "steward", password: PASSWORD }),
    { ok: false, reason: "HANDLE_TAKEN", handle: "steward" });
  assert.deepEqual(await w.m.enroll({ invite: w.inv, handle: "  steward ", password: PASSWORD }),
    { ok: false, reason: "HANDLE_TAKEN", handle: "steward" }, "trimmed, then taken");
  assert.equal(snapshot(w), before, "nothing written");
  assert.equal(w.m.memberFacts("cal").status, "invited");
  assert.deepEqual(await w.m.enroll({ invite: w.inv, handle: "stewards", password: PASSWORD }),
    { ok: true, memberId: "cal", handle: "stewards" });
});

test("R59 a by that is not the founder is refused FOUNDER_HANDLE_NOT_FOUNDER (C-96.54), first, writing nothing; both spellings of the founder are accepted", async () => {
  const w = await group();
  const row = MEMBERSHIP_CHECKS.FOUNDER_HANDLE_NOT_FOUNDER;
  assert.deepEqual([row.check, Object.isFrozen(row)], ["C-96.54", true]);
  assert.match(row.where, /founderHandleSet > is-founder-handle-founder$/);
  const before = snapshot(w);
  for (const by of ["ann", "second", V("ann"), "class:admin", "class:member", "", null, undefined, "Admin", "admin ", "member:ann", 7, {}]) {
    const r = w.m.founderHandleSet({ handle: "steward", by });
    assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation], [false, "FOUNDER_HANDLE_NOT_FOUNDER", "FOUNDER_HANDLE_NOT_FOUNDER", "C-96.54", row.translation],
      JSON.stringify(by));
  }
  assert.equal(snapshot(w), before, "nothing written");
  assert.equal(w.m.founderHandle(), null);
  /* the caller is judged before the handle: a bad handle under a member's by is still the caller's refusal */
  assert.equal(w.m.founderHandleSet({ handle: "Bad Handle!", by: "ann" }).reason, "FOUNDER_HANDLE_NOT_FOUNDER");
  assert.equal(w.m.founderHandleSet({ by: "ann" }).reason, "FOUNDER_HANDLE_NOT_FOUNDER");
  /* control: the founder, as `admin` or `member:admin`, is accepted */
  assert.equal(w.m.founderHandleSet({ handle: "steward", by: "member:admin" }).ok, true);
  const w2 = await group();
  assert.equal(w2.m.founderHandleSet({ handle: "steward", by: "admin" }).ok, true);
  /* no call throws, whatever it is handed */
  for (const arg of [undefined, null, 5, "x", []]) assert.doesNotThrow(() => w2.m.founderHandleSet(arg));
});

test("R59 R53 a second set is refused HANDLE_FIXED, the first handle kept, whatever the second names; control: the first set was accepted", async () => {
  const w = await group();
  assert.equal(w.m.founderHandleSet({ handle: "steward", by: "admin" }).ok, true);
  const before = snapshot(w);
  const fixed = MEMBERSHIP_CHECKS.HANDLE_FIXED;
  for (const handle of ["steward", "other", "admin", "ADMIN", "Bad Handle!", "", null, undefined, "ann"]) {
    const r = w.m.founderHandleSet({ handle, by: "admin" });
    assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation], [false, "HANDLE_FIXED", "HANDLE_FIXED", "C-96.52", fixed.translation],
      String(handle));
    assert.match(r.detail, /never changed[\s\S]*Nothing was written\.$/);
  }
  assert.equal(snapshot(w), before, "nothing written");
  assert.equal(w.m.founderHandle(), "steward", "the first handle kept");
  /* the not-the-founder refusal is still asked first */
  assert.equal(w.m.founderHandleSet({ handle: "other", by: "ann" }).reason, "FOUNDER_HANDLE_NOT_FOUNDER");
});

test("R59 R13 R57 the handle is judged as enrolment judges it: NO_HANDLE, BAD_HANDLE (ADMIN, Bad Handle!), HANDLE_TAKEN (admin, a member's current or earlier handle), each writing nothing; control: a free handle is accepted", async () => {
  const w = await group();
  /* a change made before T46 left ann's earlier handle in the history */
  w.sql.exec(`UPDATE members SET handle='ann-new' WHERE member_id='ann'`);
  w.sql.exec(`INSERT INTO handle_history (member_id, from_handle, to_handle, at) VALUES ('ann','ann','ann-new','2026-10-01T00:00:00.000Z')`);
  const before = snapshot(w);
  const cases = [["", "NO_HANDLE"], ["   ", "NO_HANDLE"], [null, "NO_HANDLE"], [undefined, "NO_HANDLE"],
                 ["ADMIN", "BAD_HANDLE"], ["Admin", "BAD_HANDLE"], ["Bad Handle!", "BAD_HANDLE"], ["a", "BAD_HANDLE"],
                 ["-ab", "BAD_HANDLE"], ["a".repeat(42), "BAD_HANDLE"],
                 ["admin", "HANDLE_TAKEN"], ["  admin ", "HANDLE_TAKEN"], ["bob", "HANDLE_TAKEN"], ["ann-new", "HANDLE_TAKEN"],
                 ["ann", "HANDLE_TAKEN"], ["second", "HANDLE_TAKEN"]];
  for (const [handle, reason] of cases) {
    const r = w.m.founderHandleSet({ handle, by: "admin" });
    assert.deepEqual([r.ok, r.reason], [false, reason], JSON.stringify(handle));
  }
  assert.equal(snapshot(w), before, "nothing written");
  assert.equal(w.m.founderHandle(), null);
  /* a revoked member's handle is taken too (R16: whatever the member's status) */
  w.m.memberSet({ memberId: "bob", status: "revoked", by: "admin" });
  assert.equal(w.m.founderHandleSet({ handle: "bob", by: "admin" }).reason, "HANDLE_TAKEN");
  /* control: the same call with a free handle is accepted, and the answer is R144's */
  assert.deepEqual(w.m.founderHandleSet({ handle: "  steward  ", by: "admin" }), { ok: true, handle: "steward" });
  assert.equal(w.m.founderHandle(), "steward", "trimmed");
});

test("R59 R57 admin is an id only, the handle of no one, the founder included: enroll, handleCheck and founderHandleSet refuse it as taken, before and after her handle is held; ROOT_ADMIN is the id", async () => {
  const w = await group();
  assert.equal(Members.ROOT_ADMIN, "admin", "N1067: ROOT_ADMIN names the founder's id");
  for (const phase of ["before", "after"]) {
    if (phase === "after") assert.equal(w.m.founderHandleSet({ handle: "steward", by: "admin" }).ok, true);
    assert.deepEqual(await w.m.enroll({ invite: w.inv, handle: "admin", password: PASSWORD }), { ok: false, reason: "HANDLE_TAKEN", handle: "admin" }, phase);
    assert.equal((await w.m.handleCheck({ invite: w.inv, handle: "admin" })).state, "taken", phase);
    assert.equal((await w.m.handleCheck({ viewer: V("ann"), handle: "admin" })).state, "taken", phase);
    assert.equal(w.m.memberByHandle("admin"), null, `${phase}: no member holds admin`);
    assert.equal(w.m.sessionRights("admin").handle === "admin", false, `${phase}: the founder's handle is never her id`);
  }
  assert.equal(w.m.founderHandleSet({ handle: "admin", by: "admin" }).reason, "HANDLE_FIXED", "held: the second set");
  assert.equal(world().m.founderHandleSet({ handle: "admin", by: "admin" }).reason, "HANDLE_TAKEN", "none held: taken");
  /* control: another handle enrols */
  assert.equal((await w.m.enroll({ invite: w.inv, handle: "administrator", password: PASSWORD })).ok, true);
});

test("R59 the founder's member id stays admin everywhere: R23, R29 and R31 are unchanged, and the handle is no member row or viewer", async () => {
  const w = await group();
  const spelling = [viewerMember("admin"), viewerMember("member:admin"), viewerMember("admin@PROJ-F"), viewerMember("member:admin@PROJ-F")];
  const adminsBefore = w.m.activeAdmins();
  assert.equal(w.m.founderHandleSet({ handle: "steward", by: "admin" }).ok, true);
  assert.deepEqual([viewerMember("admin"), viewerMember("member:admin"), viewerMember("admin@PROJ-F"), viewerMember("member:admin@PROJ-F")],
    spelling, "R73: the viewer's spelling is unchanged");
  assert.deepEqual(spelling, [null, "admin", null, "admin"], "the bare founder viewer names no member; member:admin names `admin`, not her handle");
  assert.equal(viewerMember("member:steward"), "steward", "control: a handle spelled as a member is just a member id");
  assert.deepEqual(w.m.activeAdmins(), adminsBefore, "R29 unchanged: the founder first, as `admin`");
  assert.equal(w.m.activeAdmins()[0], "admin");
  assert.equal(w.m.isAdministrator("admin"), true, "R23");
  assert.deepEqual(w.m.memberFacts("admin"), { cover: null, handle: "steward", role: "admin", status: "active" },
    "R24, R76: she is no members row, and memberFacts answers her as the member her roster row says she is");
  assert.equal(w.m.memberByHandle("steward"), null, "R48: a handle in `members` only");
  /* R62: the roster lists the founder, first, as `admin` in member_id only; her handle is the one she holds */
  const listed = w.m.memberList({ administer: true }).members;
  assert.deepEqual([listed[0].member_id, listed[0].handle, listed[0].founder], ["admin", "steward", true]);
  assert.equal(listed.slice(1).some((r) => r.member_id === "admin" || r.handle === "steward" || r.founder === true), false,
    "R14: no member row is hers");
  assert.equal(listed.some((r) => r.handle === "admin"), false, "`admin` is no one's handle");
});

test("R59 R66 the founder's handle is exempt from purge as the members are, and the table is created once", async () => {
  const w = world();
  assert.ok(MEMBER_EXEMPT_TABLES.includes("founder_handle"));
  assert.ok(!MEMBER_DECLARED_TABLES.some((t) => t.name === "founder_handle"), "and declared in the default form");
  w.m.migrate();
  assert.equal(w.rows(`SELECT name FROM sqlite_master WHERE name='founder_handle'`).length, 1, "created once");
  /* the handle survives a second boot (migrate is idempotent) */
  assert.equal(w.m.founderHandleSet({ handle: "steward", by: "admin" }).ok, true);
  w.m.migrate();
  assert.equal(w.m.founderHandle(), "steward");
  /* control: a plain table of the module's is named in the exempt list too */
  assert.ok(MEMBER_EXEMPT_TABLES.includes("members"));
});

test("R59 op=founderhandleset sets the handle for the stamped founder only: by is the control plane's stamp from the query, never the body's; control: the founder's stamp sets it", async () => {
  const w = await group();
  /* a body naming the founder under a member's stamp is the member's call */
  const forged = w.ops("by=ann", { handle: "steward", by: "admin" }).founderhandleset();
  assert.equal(forged.reason, "FOUNDER_HANDLE_NOT_FOUNDER");
  assert.equal(w.m.founderHandle(), null);
  const unstamped = w.ops("", { handle: "steward", by: "admin" }).founderhandleset();
  assert.equal(unstamped.reason, "FOUNDER_HANDLE_NOT_FOUNDER", "no stamp is no founder");
  const machine = w.ops("by=class%3Aadmin", { handle: "steward" }).founderhandleset();
  assert.equal(machine.reason, "FOUNDER_HANDLE_NOT_FOUNDER", "a machine credential is refused");
  assert.deepEqual(w.ops("by=admin", { handle: "steward" }).founderhandleset(), { ok: true, handle: "steward" });
  assert.deepEqual(w.ops("by=admin", { handle: "steward" }).founderhandleset().reason, "HANDLE_FIXED");
  assert.equal(w.m.founderHandle(), "steward");
  assert.equal(typeof w.ops("by=admin", null).founderhandleset, "function");
  /* no body at all */
  assert.equal(w.ops("by=admin", null).founderhandleset().reason, "HANDLE_FIXED");
  const fresh = await group();
  assert.equal(fresh.ops("by=admin", null).founderhandleset().reason, "NO_HANDLE");
});

test("R59 R13 enroll and founderHandleSet share one judgment: the same handles are refused with the same answers", async () => {
  const w = await group();
  const f = await group();
  for (const handle of ["", "ADMIN", "admin", "ann", "Bad Handle!", "a"]) {
    const viaEnroll = await w.m.enroll({ invite: w.inv, handle, password: PASSWORD });
    const viaFounder = f.m.founderHandleSet({ handle, by: "admin" });
    assert.deepEqual(viaFounder, viaEnroll, JSON.stringify(handle));
  }
});
