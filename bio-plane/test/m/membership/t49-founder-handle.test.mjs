/* T49-1 (N1072, K3265; DEC-230): R144, the founder's own handle, and R141 as re-worded (`admin` is an id only, the handle of
   no one, the founder included). Each id is tested here explicitly, with a negative control per refusal (K874). Every
   test drives the module at its interface. R145's `MODULE_ORDER` is `module-order.test.mjs`'s. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V } from "./fixture.mjs";
import { Membership, MEMBERSHIP_CHECKS, MEMBERSHIP_EXEMPT_TABLES, viewerPredicate }
  from "../../../src/membership/index.mjs";

const PASSWORD = "cal-passphrase-x";
const founderRows = (w) => JSON.stringify(w.rows(`SELECT id, handle FROM founder_handle`));
const snapshot = (w) => JSON.stringify(w.rows(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
  .map(({ name }) => [name, w.rows(`SELECT * FROM "${name}"`)]));

/* The founder, `second` (an administrator), ann and bob active, cal invited. */
async function group() {
  const w = await world().group("ann", "bob");
  w.inv = (await w.m.memberAdd({ memberId: "cal", cover: "cover of cal", by: "admin" })).invite;
  return w;
}

test("R144 the founder's member id stays admin everywhere: R43, R44, R64, R86 and R94 are unchanged, and the handle is no member row or viewer", async () => {
  const w = await group();
  const sightBefore = [viewerPredicate("admin"), viewerPredicate("member:admin")];
  const adminsBefore = w.m.activeAdmins();
  assert.equal(w.m.founderHandleSet({ handle: "steward", by: "admin" }).ok, true);
  assert.deepEqual([viewerPredicate("admin"), viewerPredicate("member:admin")], sightBefore, "R43 unchanged");
  assert.deepEqual(w.m.activeAdmins(), adminsBefore, "R86 unchanged: the founder first, as `admin`");
  assert.equal(w.m.activeAdmins()[0], "admin");
  assert.equal(w.m.isAdministrator("admin"), true, "R64");
  assert.equal(w.m.positionalMember("admin"), null, "R76: the bare founder viewer names no member");
  assert.equal(w.m.positionalMember("member:admin"), "admin", "and the second spelling names `admin`, not her handle");
  assert.deepEqual(w.m.memberFacts("admin"), { cover: null, handle: "steward", role: "admin", status: "active" },
    "`member-roster` R76: claimed, the founder answers her facts, her held handle as `handle`, though she is no members row");
  assert.equal(w.m.memberByHandle("steward"), null, "R119: a handle in `members` only");
  /* R147: the roster lists the founder, first, as `admin` in member_id only; her handle is the one she holds */
  const listed = w.m.memberList({ administer: true }).members;
  assert.deepEqual([listed[0].member_id, listed[0].handle, listed[0].founder], ["admin", "steward", true]);
  assert.equal(listed.slice(1).some((r) => r.member_id === "admin" || r.handle === "steward" || r.founder === true), false,
    "R17: no member row is hers");
  assert.equal(listed.some((r) => r.handle === "admin"), false, "`admin` is no one's handle");
  /* a project she owns: participation rows keep the id `admin` */
  w.project("PROJ-F");
  assert.equal(w.m.projectClaimOwner({ projectId: "PROJ-F", memberId: "admin" }).ok, true);
  assert.deepEqual(w.m.projectOwners("PROJ-F"), ["admin"], "R65");
  assert.deepEqual(w.m.participation("PROJ-F", "admin"), { state: "joined", owner: true });
  assert.equal(w.m.sight("PROJ-F", "admin"), Membership.SIGHT_FULL, "R44");
  /* control: her handle names no participant */
  assert.equal(w.m.participation("PROJ-F", "steward"), null);
});

test("R144 `member-roster` R76 memberFacts(admin) answers null for the unclaimed founder and her facts once claimed, with or without a held handle", async () => {
  const w = world();
  assert.equal(w.m.memberFacts("admin"), null, "unclaimed: the founder is no member yet");
  await w.claim();
  assert.deepEqual(w.m.memberFacts("admin"), { cover: null, handle: null, role: "admin", status: "active" }, "claimed, no handle held");
  assert.equal(w.m.founderHandleSet({ handle: "steward", by: "admin" }).ok, true);
  assert.equal(w.m.memberFacts("admin").handle, "steward", "claimed, handle held");
  /* control: R76 widens no other id, and a member's row is read as before */
  assert.equal(w.m.memberFacts("nobody"), null);
  assert.equal(w.m.memberFacts("steward"), null, "her handle is no member id");
});

test("R144 R77 a hidden project's existence shows its owners' handles: the founder's is her own handle once she holds one, and never admin; control: null while she holds none", async () => {
  const w = await group();
  w.project("PROJ-H");
  assert.equal(w.m.projectClaimOwner({ projectId: "PROJ-H", memberId: "admin" }).ok, true);
  w.m.participationWrite("invite", { projectId: "PROJ-H", memberId: "ann", by: "admin" });
  w.m.participationWrite("ownerOn", { projectId: "PROJ-H", memberId: "ann", by: "admin" });
  /* `bob` is an ordinary member outside it: he sees a hidden project as nothing; `second`, an administrator neither invited
     nor joined, sees its existence and its owners (D54). */
  const seen = () => w.m.existenceAct("PROJ-H", V("second"));
  assert.deepEqual(seen().owners, [null, "ann"], "while she holds none, the founder's entry is null");
  assert.equal(w.m.founderHandleSet({ handle: "steward", by: "admin" }).ok, true);
  assert.deepEqual(seen().owners, ["steward", "ann"], "her handle, in R65's order");
  assert.equal(JSON.stringify(seen()).includes('"admin"'), false, "the id admin reaches no reader of the answer");
  assert.equal(w.m.existenceAct("PROJ-H", V("bob")), null, "control: an ordinary member at a hidden project is told nothing");
});

test("R144 R115 the founder's handle is exempt from purge as the members are, and the table is declared once", async () => {
  const w = world();
  assert.ok(MEMBERSHIP_EXEMPT_TABLES.includes("founder_handle"));
  assert.ok(w.declared[0].opts.exempt.includes("founder_handle"), "declared exempt to record-core's purge");
  assert.ok(!w.declared[0].tables.some((t) => t.name === "founder_handle"), "and keyed to no project");
  w.m.migrate();
  assert.equal(w.declared.length, 1, "declared once");
  /* the handle survives a second boot (migrate is idempotent) */
  assert.equal(w.m.founderHandleSet({ handle: "steward", by: "admin" }).ok, true);
  w.m.migrate();
  assert.equal(w.m.founderHandle(), "steward");
  /* control: a plain table of the module's is named in the exempt list too, and the founder's is not a project's */
  assert.ok(MEMBERSHIP_EXEMPT_TABLES.includes("members"));
});
