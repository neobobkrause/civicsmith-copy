/* T52 (W4, A-K8 (b) (c)): R157, `projectInvite` says why it does not invite. Driven at the module's interface; the
   refusals' sentences are read from the answer's `detail`, never copied (build/situations/job.md). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V } from "./fixture.mjs";

/* ann and bob own P (bob joined by ann's invitation, then added as owner is not needed: bob stays a participant);
   cal invited; dee outside; the founder holds the handle `steward`. */
async function group() {
  const w = await world().group("ann", "bob", "cal", "dee");
  w.project("PROJ-P", "The P project");
  assert.equal(w.m.projectClaimOwner({ projectId: "PROJ-P", memberId: "ann" }).ok, true);
  assert.equal(w.m.founderHandleSet({ handle: "steward", by: "admin" }).ok, true);
  return w;
}
const inv = (w, handle, by = "ann") => w.m.projectInvite({ projectId: "PROJ-P", handle, by, viewer: V(by) });
const sentence = (r) => assert.equal(typeof r.detail === "string" && r.detail.length > 0, true, "a sentence a member can read");

test("R157 an owner inviting their own handle is refused THAT_IS_YOU, nothing written", async () => {
  const w = await group();
  const before = JSON.stringify(w.rows(`SELECT * FROM project_participants`));
  const r = inv(w, "ann");
  assert.deepEqual([r.ok, r.reason], [false, "THAT_IS_YOU"]);
  sentence(r);
  assert.equal(JSON.stringify(w.rows(`SELECT * FROM project_participants`)), before);
});

test("R157 the founder inviting her own held handle is refused THAT_IS_YOU, not NO_SUCH_HANDLE", async () => {
  const w = await group();
  w.project("PROJ-F");
  assert.equal(w.m.projectClaimOwner({ projectId: "PROJ-F", memberId: "admin" }).ok, true);
  const r = w.m.projectInvite({ projectId: "PROJ-F", handle: "steward", by: "admin", viewer: V("admin") });
  assert.deepEqual([r.ok, r.reason], [false, "THAT_IS_YOU"]);
  sentence(r);
});

test("R157 a member invited twice is refused ALREADY_INVITED the second time", async () => {
  const w = await group();
  assert.equal(inv(w, "cal").ok, true);
  const r = inv(w, "cal");
  assert.deepEqual([r.ok, r.reason], [false, "ALREADY_INVITED"]);
  sentence(r);
});

test("R157 a joined member, and one who asked to leave, are ALREADY_A_PARTICIPANT", async () => {
  const w = await group();
  assert.equal(inv(w, "bob").ok, true);
  assert.equal(w.m.projectJoin({ projectId: "PROJ-P", by: "bob", viewer: V("bob") }).ok, true);
  const joined = inv(w, "bob");
  assert.deepEqual([joined.ok, joined.reason], [false, "ALREADY_A_PARTICIPANT"]);
  sentence(joined);
  assert.equal(w.m.projectLeave({ projectId: "PROJ-P", by: "bob", viewer: V("bob") }).state, "leaving");
  assert.equal(inv(w, "bob").reason, "ALREADY_A_PARTICIPANT");
});

test("R157 another owner inviting the founder's handle records her invited", async () => {
  const w = await group();
  const r = inv(w, "steward");
  assert.deepEqual([r.ok, r.state], [true, "invited"]);
  assert.equal(w.m.participation("PROJ-P", "admin").state, "invited");
  assert.equal(inv(w, "steward").reason, "ALREADY_INVITED");
});

test("R157 control: a new member is invited as R32 states; order NO_SUCH_HANDLE, THAT_IS_YOU, NOT_ACTIVE kept", async () => {
  const w = await group();
  assert.equal(inv(w, "zed").reason, "NO_SUCH_HANDLE");
  w.m.memberSet({ memberId: "dee", status: "revoked", by: "admin" });
  assert.equal(inv(w, "dee").reason, "NOT_ACTIVE");
  assert.equal(inv(w, "bob").ok, true);
  assert.equal(w.row(`SELECT state, invited_by FROM project_participants WHERE member_id='bob'`).state, "invited");
});
