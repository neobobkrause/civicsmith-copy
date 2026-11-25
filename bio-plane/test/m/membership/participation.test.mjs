import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V } from "./fixture.mjs";

/* ann owns P; bob joined; cal invited; dee outside */
async function projectWorld() {
  const w = await world().group("ann", "bob", "cal", "dee");
  w.project("PROJ-P", "The P project");
  assert.equal(w.m.projectClaimOwner({ projectId: "PROJ-P", memberId: "ann" }).ok, true);
  w.m.projectInvite({ projectId: "PROJ-P", handle: "bob", by: "ann", viewer: V("ann") });
  w.m.projectJoin({ projectId: "PROJ-P", by: "bob", viewer: V("bob") });
  w.m.projectInvite({ projectId: "PROJ-P", handle: "cal", by: "ann", viewer: V("ann") });
  return w;
}

test("R31 projectClaimOwner: NO_SUCH_PROJECT, NOT_A_PROJECT, OWNED; the sole initial owner, joined", async () => {
  const w = await world().group("ann", "bob");
  w.bundle("INFO-1");
  w.project("PROJ-1");
  assert.equal(w.m.projectClaimOwner({ projectId: "NOPE", memberId: "ann" }).reason, "NO_SUCH_PROJECT");
  assert.equal(w.m.projectClaimOwner({ projectId: "INFO-1", memberId: "ann" }).reason, "NOT_A_PROJECT");
  assert.deepEqual(w.m.projectClaimOwner({ projectId: "PROJ-1", memberId: "ann" }), { ok: true, projectId: "PROJ-1", owner: "ann" });
  assert.equal(w.m.projectClaimOwner({ projectId: "PROJ-1", memberId: "bob" }).reason, "OWNED");
  assert.deepEqual(w.rows(`SELECT member_id, state, owner FROM project_participants`), [{ member_id: "ann", state: "joined", owner: 1 }]);
});

test("R32 projectInvite: NOT_THE_OWNER, NO_SUCH_HANDLE, NOT_ACTIVE, ALREADY_A_PARTICIPANT; records invited_by", async () => {
  const w = await projectWorld();
  await w.enrol("eve");
  w.m.memberSet({ memberId: "eve", status: "revoked", by: "admin" });
  assert.equal(w.m.projectInvite({ projectId: "PROJ-P", handle: "dee", by: "bob", viewer: V("bob") }).reason, "NOT_THE_OWNER");
  /* D54 (T41-3): an administrator neither invited nor joined is at hidden PROJ-P's EXISTENCE, so its act is refused
     there, with the owners; at a discoverable project it sees whole, inviting is still an owner's act (R60). */
  const ex = w.m.projectInvite({ projectId: "PROJ-P", handle: "dee", by: "second", viewer: V("second") });
  assert.deepEqual([ex.reason, ex.owners], ["PROJECT_SEEN_NOT_A_PARTICIPANT", ["ann"]]);
  w.m.projectVisibilitySet({ projectId: "PROJ-P", setting: "discoverable", by: "ann", viewer: V("ann") });
  assert.equal(w.m.projectInvite({ projectId: "PROJ-P", handle: "dee", by: "second", viewer: V("second") }).reason, "NOT_THE_OWNER");
  assert.equal(w.m.projectInvite({ projectId: "PROJ-P", handle: "zed", by: "ann", viewer: V("ann") }).reason, "NO_SUCH_HANDLE");
  assert.equal(w.m.projectInvite({ projectId: "PROJ-P", handle: "eve", by: "ann", viewer: V("ann") }).reason, "NOT_ACTIVE");
  assert.equal(w.m.projectInvite({ projectId: "PROJ-P", handle: "cal", by: "ann", viewer: V("ann") }).reason, "ALREADY_INVITED");   /* R157 */
  assert.equal(w.m.projectInvite({ projectId: "PROJ-P", handle: "bob", by: "ann", viewer: V("ann") }).reason, "ALREADY_A_PARTICIPANT");
  const ok = w.m.projectInvite({ projectId: "PROJ-P", handle: "dee", by: "ann", viewer: V("ann") });
  assert.deepEqual([ok.ok, ok.state], [true, "invited"]);
  assert.deepEqual(w.row(`SELECT state, owner, invited_by FROM project_participants WHERE member_id='dee'`),
    { state: "invited", owner: 0, invited_by: "ann" });
});

test("R33 R116 an invitation tells the one registered listener inside the act, after its writes; request granted only on a count", async () => {
  const w = await projectWorld();
  const heard = [];
  /* The listener stands in for project-roster's (its R15): it sees the invitation already written, and answers a count. */
  let answer = 1;
  assert.deepEqual(w.m.onProjectInvited("project-roster", (n) => {
    heard.push({ ...n, written: w.m.participation(n.projectId, n.memberId) });
    if (answer === "throw") throw new Error("listener fails");
    return answer;
  }), { ok: true, module: "project-roster" });
  const inv = w.m.projectInvite({ projectId: "PROJ-P", handle: "dee", by: "ann", viewer: V("ann") });
  assert.deepEqual([inv.ok, inv.state, inv.request], [true, "invited", "granted"]);
  assert.equal(heard.length, 1);
  assert.deepEqual([heard[0].projectId, heard[0].memberId, heard[0].by, heard[0].written],
    ["PROJ-P", "dee", "ann", { state: "invited", owner: false }]);
  assert.match(heard[0].at, /^\d{4}-\d\d-\d\dT/);
  assert.equal(w.row(`SELECT created FROM project_participants WHERE member_id='dee'`).created, heard[0].at, "the act's time");
  /* Anything but a whole number of at least 1, or a throw: the invitation stands, the key absent. */
  await w.enrol("eve"); await w.enrol("fay"); await w.enrol("gus"); await w.enrol("hal");
  for (const [who, a] of [["eve", 0], ["fay", "throw"], ["gus", 1.5], ["hal", "2"]]) {
    answer = a;
    const r = w.m.projectInvite({ projectId: "PROJ-P", handle: who, by: "ann", viewer: V("ann") });
    assert.deepEqual([r.ok, "request" in r], [true, false], `${who}: ${a}`);
    assert.equal(w.m.participation("PROJ-P", who).state, "invited");
  }
  /* A refused invitation tells nobody. */
  const before = heard.length;
  w.m.projectInvite({ projectId: "PROJ-P", handle: "dee", by: "ann", viewer: V("ann") });
  w.m.projectInvite({ projectId: "PROJ-P", handle: "eve", by: "bob", viewer: V("bob") });
  assert.equal(heard.length, before);
  /* One registration, whoever makes it; malformed refused (R81). */
  const again = w.m.onProjectInvited("someone-else", () => 1);
  assert.deepEqual([again.reason, again.module], ["LISTENER_DECLARED", "project-roster"]);
  assert.equal(w.m.onProjectInvited("", () => 1).reason, "LISTENER_MALFORMED");
});

test("R33 R116 with no listener registered the invitation stands and its answer has no request key", async () => {
  const w = await projectWorld();
  const inv = w.m.projectInvite({ projectId: "PROJ-P", handle: "dee", by: "ann", viewer: V("ann") });
  assert.deepEqual(inv, { ok: true, projectId: "PROJ-P", handle: "dee", state: "invited" });
  assert.equal(w.m.onProjectInvited("project-roster", "not a function").reason, "LISTENER_MALFORMED");
});

test("R34 projectJoin: NOT_INVITED for a non-participant; joined, idempotent, withdraws a request to leave", async () => {
  const w = await projectWorld();
  assert.equal(w.m.projectJoin({ projectId: "PROJ-P", by: "dee", viewer: V("dee") }).reason, "NOT_INVITED");
  assert.equal(w.m.projectJoin({ projectId: "PROJ-P", by: "cal", viewer: V("cal") }).state, "joined");
  assert.equal(w.m.projectJoin({ projectId: "PROJ-P", by: "cal", viewer: V("cal") }).state, "joined");
  w.m.projectLeave({ projectId: "PROJ-P", by: "bob", comment: "busy", viewer: V("bob") });
  w.m.projectJoin({ projectId: "PROJ-P", by: "bob", viewer: V("bob") });
  assert.deepEqual(w.row(`SELECT state, comment FROM project_participants WHERE member_id='bob'`), { state: "joined", comment: null });
});

test("R35 projectLeave: records leaving with a comment, removes nobody; the last committed owner is refused", async () => {
  const w = await projectWorld();
  assert.equal(w.m.projectLeave({ projectId: "PROJ-P", by: "dee", viewer: V("dee") }).reason, "NOT_A_PARTICIPANT");
  assert.equal(w.m.projectLeave({ projectId: "PROJ-P", by: "cal", viewer: V("cal") }).reason, "NOT_JOINED");
  const l = w.m.projectLeave({ projectId: "PROJ-P", by: "bob", comment: "x".repeat(400), viewer: V("bob") });
  assert.deepEqual([l.ok, l.state, l.comment.length], [true, "leaving", 280]);
  assert.equal(w.rows(`SELECT * FROM project_participants WHERE project_id='PROJ-P'`).length, 3);
  const sole = w.m.projectLeave({ projectId: "PROJ-P", by: "ann", viewer: V("ann") });
  assert.equal(sole.reason, "LAST_COMMITTED_OWNER");
  // two owners: one may ask to leave; then the other, the last committed one, may not
  w.m.projectJoin({ projectId: "PROJ-P", by: "bob", viewer: V("bob") });
  assert.equal(w.m.participationWrite("ownerOn", { projectId: "PROJ-P", memberId: "bob" }), true);   // project-roster R3's write
  assert.equal(w.m.projectLeave({ projectId: "PROJ-P", by: "bob", viewer: V("bob") }).ok, true);
  const last = w.m.projectLeave({ projectId: "PROJ-P", by: "ann", viewer: V("ann") });
  assert.deepEqual([last.reason, last.owners], ["LAST_COMMITTED_OWNER", ["ann", "bob"]]);
  assert.equal(w.row(`SELECT state FROM project_participants WHERE member_id='ann'`).state, "joined");
});

test("R36 projectRemove: refusals; removes whether or not they asked; every removal kept", async () => {
  const w = await projectWorld();
  w.m.projectInvite({ projectId: "PROJ-P", handle: "dee", by: "ann", viewer: V("ann") });   // a participant who stays
  w.m.projectJoin({ projectId: "PROJ-P", by: "dee", viewer: V("dee") });
  await w.enrol("eve");                                                                     // outside the project
  /* D54: hidden PROJ-P is at its EXISTENCE for an administrator not in it; discoverable, removal is an owner's act */
  assert.equal(w.m.projectRemove({ projectId: "PROJ-P", handle: "bob", by: "second", viewer: V("second") }).reason,
    "PROJECT_SEEN_NOT_A_PARTICIPANT");
  w.m.projectVisibilitySet({ projectId: "PROJ-P", setting: "discoverable", by: "ann", viewer: V("ann") });
  assert.equal(w.m.projectRemove({ projectId: "PROJ-P", handle: "bob", by: "second", viewer: V("second") }).reason, "NOT_THE_OWNER");
  assert.equal(w.m.projectRemove({ projectId: "PROJ-P", handle: "bob", by: "cal", viewer: V("cal") }).reason, "NOT_THE_OWNER");
  assert.equal(w.m.projectRemove({ projectId: "PROJ-P", handle: "zed", by: "ann", viewer: V("ann") }).reason, "NO_SUCH_HANDLE");
  assert.equal(w.m.projectRemove({ projectId: "PROJ-P", handle: "eve", by: "ann", viewer: V("ann") }).reason, "TARGET_NOT_A_PARTICIPANT");
  assert.equal(w.m.projectRemove({ projectId: "PROJ-P", handle: "ann", by: "ann", viewer: V("ann") }).reason, "OWNER");
  const r = w.m.projectRemove({ projectId: "PROJ-P", handle: "bob", by: "ann", comment: "did not show up", viewer: V("ann") });
  assert.deepEqual([r.ok, r.removed, r.comment], [true, true, "did not show up"]);
  assert.equal(w.m.projectRemove({ projectId: "PROJ-P", handle: "cal", by: "ann", viewer: V("ann") }).ok, true, "an invited one too");
  assert.equal(w.m.participation("PROJ-P", "bob"), null);
  /* Every removal is kept, with who removed whom, when and the owner's reason (R120's project_removals; project-roster
     R2 reads it to every participant). */
  const rm = w.rows(`SELECT project_id, member_id, removed_by, comment, at FROM project_removals ORDER BY seq`);
  assert.deepEqual(rm.map((x) => [x.project_id, x.member_id, x.removed_by, x.comment]),
    [["PROJ-P", "bob", "ann", "did not show up"], ["PROJ-P", "cal", "ann", null]]);
  for (const x of rm) assert.match(x.at, /^\d{4}-/);
});

test("R74 participation answers one member's state in one project and whether an owner, or null", async () => {
  const w = await projectWorld();
  w.m.projectLeave({ projectId: "PROJ-P", by: "bob", viewer: V("bob") });
  assert.deepEqual(w.m.participation("PROJ-P", "ann"), { state: "joined", owner: true });
  assert.deepEqual(w.m.participation("PROJ-P", "bob"), { state: "leaving", owner: false });
  assert.deepEqual(w.m.participation("PROJ-P", "cal"), { state: "invited", owner: false });
  assert.equal(w.m.participation("PROJ-P", "dee"), null);
  assert.equal(w.m.participation("PROJ-NEVER", "ann"), null);
  assert.equal(w.m.participation(null, undefined), null, "never throws");
});
