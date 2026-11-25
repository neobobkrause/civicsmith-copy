import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V } from "./fixture.mjs";
import { Membership, notAParticipant } from "../../../src/membership/index.mjs";

/* P owned by ann; bob, cal, dee joined; eve invited */
async function owned() {
  const w = await world().group("ann", "bob", "cal", "dee", "eve");
  w.project("PROJ-P");
  w.m.projectClaimOwner({ projectId: "PROJ-P", memberId: "ann" });
  for (const h of ["bob", "cal", "dee", "eve"]) w.m.projectInvite({ projectId: "PROJ-P", handle: h, by: "ann", viewer: V("ann") });
  for (const h of ["bob", "cal", "dee"]) w.m.projectJoin({ projectId: "PROJ-P", by: h, viewer: V(h) });
  return w;
}
/* T38 (N783): an owner is added through R118, the write `project-roster`'s votes make (its R3); the votes are its own. */
const add = (w, handle) => w.m.participationWrite("ownerOn", { projectId: "PROJ-P", memberId: handle });

test("R38 ownerMath and projectOwnerArithmetic, the live row absent to a viewer who cannot see", async () => {
  assert.deepEqual([0, 1].map((n) => Membership.ownerMath(n).possible), [false, false]);
  assert.deepEqual(Membership.ownerMath(1).votesNeeded, 0);
  const two = Membership.ownerMath(2);
  assert.deepEqual([two.votesNeeded, two.eligibleVoters, two.targetMayVote, two.possible], [2, 2, true, true]);
  for (let n = 3; n <= 12; n++) {
    const o = Membership.ownerMath(n), a = Membership.adminMath(n);
    assert.deepEqual([o.owners, o.votesNeeded, o.eligibleVoters, o.possible, o.targetMayVote],
      [n, a.votesNeeded, a.eligibleVoters, a.possible, false]);
  }
  const w = await owned();
  add(w, "bob");
  const seen = w.m.projectOwnerArithmetic({ projectId: "PROJ-P", viewer: V("cal") });
  assert.deepEqual(seen.table, [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => Membership.ownerMath(n)));
  assert.deepEqual(seen.live, Membership.ownerMath(2));
  assert.deepEqual(w.m.projectOwnerArithmetic({ projectId: "PROJ-P", viewer: V("zed") }).live, Membership.ownerMath(0));
});

test("R65 projectOwners lists owners in the order they became owners; [] for none", async () => {
  const w = await owned();
  add(w, "dee");
  add(w, "bob");
  assert.deepEqual(w.m.projectOwners("PROJ-P"), ["ann", "dee", "bob"]);
  assert.deepEqual(w.m.projectOwners("NOPE"), []);
  w.project("PROJ-M");
  assert.deepEqual(w.m.projectOwners("PROJ-M"), []);
});

test("R67 ownsAnyProject is true exactly when the member owns at least one project", async () => {
  const w = await owned();
  assert.equal(w.m.ownsAnyProject("ann"), true);
  assert.equal(w.m.ownsAnyProject("bob"), false, "a participant is not an owner");
  assert.equal(w.m.ownsAnyProject("zed"), false);
  add(w, "bob");
  assert.equal(w.m.ownsAnyProject("bob"), true);
});

test("R60 an administrator's sight is never a position: every project act of this module refuses an administrator (the rescue is project-roster's R5)", async () => {
  const w = await owned();
  w.m.projectVisibilitySet({ projectId: "PROJ-P", setting: "discoverable", by: "ann", viewer: V("ann") });
  for (const admin of ["admin", "second"]) {
    const v = admin === "admin" ? "admin" : V(admin);
    assert.equal(w.m.inSight("PROJ-P", v), true, "sees the project");
    /* T47-82 (P8): each act's own refusal, by code, not merely `ok: false`; and nothing written by any of them. */
    const before = JSON.stringify([w.m.projectOwners("PROJ-P"), w.m.visibilityOf("PROJ-P"),
      ["ann", "bob", "fay", admin].map((id) => w.m.participation("PROJ-P", id))]);
    const acts = [
      ["invite", w.m.projectInvite({ projectId: "PROJ-P", handle: "fay", by: admin, viewer: v }), "NOT_THE_OWNER"],
      ["remove", w.m.projectRemove({ projectId: "PROJ-P", handle: "bob", by: admin, viewer: v }), "NOT_THE_OWNER"],
      ["visibility", w.m.projectVisibilitySet({ projectId: "PROJ-P", setting: "hidden", by: admin, viewer: v }),
       "PROJECT_VISIBILITY_NOT_THE_OWNER"],
      ["join", w.m.projectJoin({ projectId: "PROJ-P", by: admin, viewer: v }), "NOT_INVITED"],
      ["leave", w.m.projectLeave({ projectId: "PROJ-P", by: admin, viewer: v }), "NOT_A_PARTICIPANT"],
    ];
    for (const [act, a, code] of acts) {
      assert.equal(a.ok, false, `${admin} ${act}`);
      assert.equal(a.reason, code, `${admin} ${act}: ${JSON.stringify(a).slice(0, 120)}`);
    }
    assert.deepEqual(acts[4][1], notAParticipant("PROJ-P", admin), "leave answers R87's one refusal");
    assert.equal(JSON.stringify([w.m.projectOwners("PROJ-P"), w.m.visibilityOf("PROJ-P"),
      ["ann", "bob", "fay", admin].map((id) => w.m.participation("PROJ-P", id))]), before, `${admin}: nothing written`);
    assert.equal(w.m.projectAuthority("PROJ-P", V(admin), "owner", "an act")?.code, "PROJECT_ACT_NOT_THE_OWNER");
    assert.equal(w.m.projectAuthority("PROJ-P", V(admin), "joined", "an act")?.code, "PROJECT_ACT_NOT_A_PARTICIPANT");
  }
  assert.equal(w.m.participation("PROJ-P", "second"), null);
});

/* Every table's rows, to show a read wrote nothing. */
const snapshot = (w) => JSON.stringify(w.rows(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
  .map(({ name }) => [name, w.rows(`SELECT * FROM "${name}"`)]));

test("R75 rescueRefusal answers project-roster R5's caller-and-project refusals in order; writes nothing, never throws", async () => {
  const w = await owned();
  w.project("PROJ-M");                                            // no owner: a machine-created project
  add(w, "bob");                                                  // PROJ-P owned by ann and bob
  /* The act it answers for is project-roster's (its R5), whose own test holds the act byte for byte to this. */
  const both = (projectId, by) => {
    const before = snapshot(w);
    const r = w.m.rescueRefusal(projectId, by);
    assert.equal(snapshot(w), before, "rescueRefusal writes nothing");
    return r;
  };
  // NOT_AN_ADMIN (R84) first, whatever the project: an ordinary member, an owner, a revoked administrator, nobody
  for (const by of ["cal", "ann", null, undefined, "", "class:admin"])
    assert.equal(both("PROJ-P", by)?.reason, "NOT_AN_ADMIN", JSON.stringify(by));
  assert.equal(w.m.rescueRefusal("PROJ-M", "cal").reason, "NOT_AN_ADMIN", "asked before NO_OWNERS");
  // NO_OWNERS, for the founder and an administrator
  for (const by of ["admin", "second"]) assert.equal(both("PROJ-M", by).reason, "NO_OWNERS");
  assert.equal(w.m.rescueRefusal("PROJ-NEVER", "admin").reason, "NO_OWNERS", "no such project has no owner");
  // OWNERS_ARE_ACTIVE naming the active owners, while any is active
  assert.deepEqual(both("PROJ-P", "second").active, ["ann", "bob"]);
  w.m.memberSet({ memberId: "ann", status: "revoked", by: "admin" });
  const one = both("PROJ-P", "admin");
  assert.deepEqual([one.reason, one.active], ["OWNERS_ARE_ACTIVE", ["bob"]]);
  // every owner inactive: null, and the act proceeds
  w.m.memberSet({ memberId: "bob", status: "revoked", by: "admin" });
  assert.equal(both("PROJ-P", "second"), null);
  assert.equal(both("PROJ-P", "admin"), null);
  // a revoked administrator is no administrator
  w.sql.exec(`UPDATE members SET status='revoked' WHERE member_id='second'`);
  assert.equal(w.m.rescueRefusal("PROJ-M", "second").reason, "NOT_AN_ADMIN");
  for (const [p, by] of [[null, null], [undefined, "admin"], [{}, []], [42, 7], ["PROJ-P", {}]])
    assert.doesNotThrow(() => w.m.rescueRefusal(p, by), JSON.stringify([p, by]));
});
