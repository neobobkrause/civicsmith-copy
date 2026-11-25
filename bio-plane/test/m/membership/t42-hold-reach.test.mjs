/* T42 (T42-3; N833, D54, K2484; canon Membership §7.3): R60's hold acts. `actions` R52 `actionHold`, R56
   `actionHoldRelease` and R57 `holdReleasePreview` reach a hidden project at EXISTENCE for an administrator neither
   invited nor joined, naming its id and hold state only. This module's share is what those acts read of it (their
   Uses: `sight`, `visibilityOf`, `existenceAct`, `noSuchProject`; R44, R77, R78, R85): "may name" is FULL, or
   EXISTENCE of a HIDDEN project (actions R52), so this suite holds, at this module's interface, that the reads answer
   exactly that set, and that nothing else of the project's is opened by it. A test of this module imports no later
   module (P4), so `actions`' own suite (its t41) drives the acts themselves. Each id with a negative control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V } from "./fixture.mjs";
import { Membership, noSuchProject, viewerPredicate, hiddenBundles } from "../../../src/membership/index.mjs";

const { SIGHT_FULL: FULL, SIGHT_EXISTENCE: EXISTENCE, SIGHT_NONE: NONE } = Membership;

/* actions R52's "may name", composed only of what this module answers (actions' `#mayName` asks the same two reads). */
const mayName = (m, project, viewer) => {
  const s = m.sight(project, viewer);
  return s === FULL || (s === EXISTENCE && m.visibilityOf(project) === "hidden");
};

/* H hidden: owner ann, cal invited. D discoverable: owner ann. NOTE-H inside H. second an active administrator outside
   both, dee an ordinary member outside both; the founder claimed. */
async function holdWorld() {
  const w = await world().group("ann", "cal", "dee");
  w.project("PROJ-H", "Hidden H");
  w.project("PROJ-D", "Discoverable D");
  w.m.projectClaimOwner({ projectId: "PROJ-H", memberId: "ann" });
  w.m.projectClaimOwner({ projectId: "PROJ-D", memberId: "ann" });
  w.m.projectInvite({ projectId: "PROJ-H", handle: "cal", by: "ann", viewer: V("ann") });
  w.m.projectVisibilitySet({ projectId: "PROJ-D", setting: "discoverable", by: "ann", viewer: V("ann") });
  w.bundle("NOTE-H", "information", "a note in H", "PROJ-H");
  return w;
}
const ADMINS = [V("second"), "admin", V("admin")];

test("R60 T42 an administrator neither invited nor joined may name a hidden project for a hold: sight EXISTENCE and setting hidden, the reads actions R52, R56 and R57 ask", async () => {
  const w = await holdWorld();
  for (const v of ADMINS) {
    assert.equal(w.m.sight("PROJ-H", v), EXISTENCE, v);
    assert.equal(w.m.visibilityOf("PROJ-H"), "hidden");
    assert.equal(mayName(w.m, "PROJ-H", v), true, `${v} may name H in a hold`);
    assert.equal(mayName(w.m, "PROJ-D", v), true, `${v} sees D whole`);
  }
  /* the participants name it as before; an invited administrator is FULL and needs no EXISTENCE */
  assert.equal(mayName(w.m, "PROJ-H", V("ann")), true);
  assert.equal(mayName(w.m, "PROJ-H", V("cal")), true);
  w.m.projectInvite({ projectId: "PROJ-H", handle: "second", by: "ann", viewer: V("ann") });
  assert.equal(w.m.sight("PROJ-H", V("second")), FULL);
  /* negative control: an ordinary member outside H, a revoked administrator, a viewer naming nobody and an absent id
     may not; nor a member at a DISCOVERABLE project's EXISTENCE (that form names nothing for a hold) */
  assert.equal(mayName(w.m, "PROJ-H", V("dee")), false);
  assert.equal(mayName(w.m, "PROJ-H", "junk"), false);
  assert.equal(mayName(w.m, "PROJ-NEVER", V("second")), false);
  assert.equal(w.m.sight("PROJ-D", V("dee")), EXISTENCE);
  assert.equal(mayName(w.m, "PROJ-D", V("dee")), false, "discoverable EXISTENCE is not a hold's naming");
  w.sql.exec(`UPDATE members SET status='revoked' WHERE member_id='second'`);
  w.m.projectRemove({ projectId: "PROJ-H", handle: "second", by: "ann", viewer: V("ann") });
  assert.equal(mayName(w.m, "PROJ-H", V("second")), false, "an inactive administrator is no administrator");
});

test("R60 R44 T42 the hold's reach opens nothing inside the project: no bundle of it, no position, and a project it may not name answers as absent", async () => {
  const w = await holdWorld();
  for (const v of ADMINS) {
    /* the id and the setting are all the hold reads; everything inside stays withheld */
    assert.equal(w.m.sight("NOTE-H", v), NONE, v);
    assert.equal(w.m.inSight("NOTE-H", v), false, v);
    const g = viewerPredicate(v);
    assert.deepEqual(w.rows(`SELECT b.bundle_id FROM bundles b WHERE ${g.sql} AND b.bundle_id IN ('PROJ-H','NOTE-H')`,
      ...g.args), [], `${v}: the record read is not widened`);
    const hid = hiddenBundles(v);
    assert.deepEqual(w.rows(`SELECT bundle_id FROM bundles WHERE bundle_id IN ${hid.sql} ORDER BY bundle_id`, ...hid.args)
      .map((r) => r.bundle_id), ["NOTE-H", "PROJ-H"], `${v}: still subtracted from every count`);
  }
  /* EXISTENCE is never a position (R60's first sentence) */
  assert.equal(w.m.projectAuthority("PROJ-H", V("second"), "joined", "placing a hold").code, "PROJECT_ACT_NOT_A_PARTICIPANT");
  assert.equal(w.m.isProjectEditor("PROJ-H", "second"), false);
  /* negative control: what a hold act answers for a project its author may NOT name is this module's, in R52's order:
     `existenceAct` first (null for an ordinary member at a hidden project: NONE), then `noSuchProject`, byte for byte
     the answer for an id naming nothing */
  assert.equal(w.m.existenceAct("PROJ-H", V("dee")), null);
  /* T47-82 (P8): an act's own answer, not noSuchProject compared with itself */
  const named = w.m.projectInvite({ projectId: "PROJ-H", handle: "dee", by: "dee", viewer: V("dee") });
  const never = w.m.projectInvite({ projectId: "PROJ-NEVER", handle: "dee", by: "dee", viewer: V("dee") });
  assert.deepEqual(named, noSuchProject("PROJ-H"));
  assert.deepEqual(named, { ...never, project: "PROJ-H" });
  /* and a member at a discoverable project's EXISTENCE is answered C-70.1 with its id and name only, no owners */
  const ex = w.m.existenceAct("PROJ-D", V("dee"));
  assert.deepEqual([ex.code, ex.project, ex.name, "owners" in ex], ["PROJECT_SEEN_NOT_A_PARTICIPANT", "PROJ-D",
    "Discoverable D", false]);
});

test("R60 R85 T42 the hold state is named whatever the setting's history: a project made hidden is nameable at EXISTENCE at once, one made discoverable is FULL to administrators", async () => {
  const w = await holdWorld();
  /* D goes hidden: an administrator outside it falls from FULL to EXISTENCE, and may still name it for a hold */
  w.m.projectVisibilitySet({ projectId: "PROJ-D", setting: "hidden", by: "ann", viewer: V("ann") });
  for (const v of ADMINS) {
    assert.equal(w.m.sight("PROJ-D", v), EXISTENCE, v);
    assert.equal(mayName(w.m, "PROJ-D", v), true, v);
  }
  /* H goes discoverable: FULL to administrators, so naming it needs no EXISTENCE */
  w.m.projectVisibilitySet({ projectId: "PROJ-H", setting: "discoverable", by: "ann", viewer: V("ann") });
  for (const v of ADMINS) assert.equal(w.m.sight("PROJ-H", v), FULL, v);
  /* negative control: the ordinary member outside both may name neither, whichever way the settings went */
  for (const p of ["PROJ-D", "PROJ-H"]) assert.equal(mayName(w.m, p, V("dee")), false, p);
});
