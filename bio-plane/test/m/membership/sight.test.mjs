import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V } from "./fixture.mjs";
import { Membership, viewerPredicate, GATE_MARK } from "../../../src/membership/index.mjs";
import { MACHINE_CLASS_PREFIX } from "../../../src/record-grammar/index.mjs";
import { PROJECT_VISIBILITY_CHECKS } from "../../../src/membership/checks.mjs";

/* H hidden, D discoverable, both owned by ann; bob invited to H; info I */
async function sightWorld() {
  const w = await world().group("ann", "bob", "cal");
  w.bundle("INFO-I");
  w.project("PROJ-H", "Hidden H");
  w.project("PROJ-D", "Discoverable D");
  w.m.projectClaimOwner({ projectId: "PROJ-H", memberId: "ann" });
  w.m.projectClaimOwner({ projectId: "PROJ-D", memberId: "ann" });
  w.m.projectInvite({ projectId: "PROJ-H", handle: "bob", by: "ann", viewer: V("ann") });
  w.m.projectVisibilitySet({ projectId: "PROJ-D", setting: "discoverable", by: "ann", viewer: V("ann") });
  return w;
}
const sees = (w, viewer) => {
  const g = viewerPredicate(viewer);
  return w.rows(`SELECT b.bundle_id FROM bundles b WHERE ${g.sql} ORDER BY b.bundle_id`, ...g.args).map((r) => r.bundle_id);
};

test("R43 viewerPredicate is the one rule of sight, and returns the viewer's member id", async () => {
  const w = await sightWorld();
  const all = ["INFO-I", "PROJ-D", "PROJ-H"];
  for (const cls of ["admin", "member", "probe", "daemon", "ai"]) {
    assert.deepEqual(sees(w, `${MACHINE_CLASS_PREFIX}${cls}`), all, cls);
    assert.equal(viewerPredicate(`${MACHINE_CLASS_PREFIX}${cls}`).member, null);
  }
  /* D54 (T41-3): the founder's viewer sees the discoverable project and not the hidden one it is not in. */
  assert.deepEqual(sees(w, "admin"), ["INFO-I", "PROJ-D"], "the founder's viewer");
  /* N357: the founder's viewer spelled `member:admin` sees what the bare spelling sees, and names the member `admin`;
     the founder has no roster row, and neither spelling asks one, claimed or not. */
  assert.deepEqual(sees(w, V("admin")), ["INFO-I", "PROJ-D"], "the founder's viewer, as member:admin");
  assert.equal(viewerPredicate(V("admin")).member, "admin");
  const unclaimed = world();
  unclaimed.project("PROJ-U");
  for (const v of ["admin", V("admin")]) assert.deepEqual(sees(unclaimed, v), [], `${v}: the same rule before the claim`);
  assert.deepEqual(sees(w, V("ann")), all, "owner");
  assert.deepEqual(sees(w, V("bob")), ["INFO-I", "PROJ-H"], "an invited participant sees the project");
  assert.deepEqual(sees(w, V("cal")), ["INFO-I"], "a non-participant sees every non-project bundle");
  assert.deepEqual(sees(w, V("second")), ["INFO-I", "PROJ-D"], "an active administrator: the discoverable project (D54)");
  w.m.memberSet({ memberId: "bob", status: "revoked", by: "admin" });
  w.sql.exec(`UPDATE members SET status='revoked' WHERE member_id='second'`);
  assert.deepEqual(sees(w, V("second")), ["INFO-I"], "an inactive administrator is no administrator");
  for (const v of [null, undefined, "", "anna", `${MACHINE_CLASS_PREFIX}robot`, "member:", "member:a b", 42])
    assert.deepEqual(sees(w, v), [], `fails closed for ${JSON.stringify(v)}`);
  assert.equal(viewerPredicate(V("cal")).member, "cal");
  assert.equal(viewerPredicate("admin").member, null);
  for (const v of ["admin", V("x"), "junk"]) assert.ok(viewerPredicate(v).sql.includes(GATE_MARK));
});

test("R44 sight is FULL, EXISTENCE (discoverable, a member asking) or NONE; EXISTENCE refuses by id and name only", async () => {
  const w = await sightWorld();
  const { SIGHT_FULL: F, SIGHT_EXISTENCE: E, SIGHT_NONE: N } = Membership;
  assert.equal(w.m.sight("PROJ-D", V("ann")), F);
  assert.equal(w.m.sight("PROJ-D", V("cal")), E);
  assert.equal(w.m.sight("PROJ-D", `${MACHINE_CLASS_PREFIX}member`), F);
  assert.equal(w.m.sight("PROJ-H", V("cal")), N);
  assert.equal(w.m.sight("PROJ-D", "junk"), N, "EXISTENCE only for a viewer naming a member");
  assert.equal(w.m.sight("NOPE", V("cal")), N);
  const ex = w.m.existenceAct("PROJ-D", V("cal"));
  assert.deepEqual([ex.ok, ex.reason, ex.project, ex.name], [false, "PROJECT_SEEN_NOT_A_PARTICIPANT", "PROJ-D", "Discoverable D"]);
  assert.deepEqual(Object.keys(ex).sort(), ["check", "code", "detail", "name", "ok", "project", "reason", "translation"]);
  assert.equal(w.m.existenceAct("PROJ-D", null), null, "an internal caller is not asked");
  assert.equal(w.m.existenceAct("PROJ-H", V("cal")), null);
  // every project-naming service answers EXISTENCE with it, before any other check
  const calls = [
    () => w.m.projectJoin({ projectId: "PROJ-D", by: "cal", viewer: V("cal") }),
    () => w.m.projectLeave({ projectId: "PROJ-D", by: "cal", viewer: V("cal") }),
    () => w.m.projectInvite({ projectId: "PROJ-D", handle: "bob", by: "cal", viewer: V("cal") }),
    () => w.m.projectRemove({ projectId: "PROJ-D", handle: "bob", by: "cal", viewer: V("cal") }),
    () => w.m.projectVisibilitySet({ projectId: "PROJ-D", setting: "hidden", by: "cal", viewer: V("cal") }),
  ];
  for (const c of calls) assert.deepEqual(c(), ex);
  // a read INSIDE the project is never widened by EXISTENCE (project-roster's reads hold it too, its R19)
  assert.equal(w.m.projectOwnerArithmetic({ projectId: "PROJ-D", viewer: V("cal") }).live.owners, 0);
  assert.equal(w.m.inSight("PROJ-D", V("cal")), false);
});

test("R61 every act naming a project the caller cannot see answers byte for byte as an id that names nothing", async () => {
  const w = await sightWorld();
  const as = (projectId) => [
    w.m.projectInvite({ projectId, handle: "bob", by: "cal", viewer: V("cal") }),
    w.m.projectVisibilitySet({ projectId, setting: "hidden", by: "cal", viewer: V("cal") }),
    w.m.projectOwnerArithmetic({ projectId, viewer: V("cal") }).live,
  ].map((x) => JSON.stringify(x).replaceAll(projectId, "<id>"));
  assert.deepEqual(as("PROJ-H"), as("PROJ-NEVER"));
  // sight before position: an outsider never learns ownership (NOT_THE_OWNER) of a hidden project
  for (const a of as("PROJ-H")) assert.doesNotMatch(a, /NOT_THE_OWNER|NOT_AN_ADMIN|ADMIN_ONLY/);
});

test("R45 projectVisibilitySet: NOT_A_PROJECT, owners only, two settings; appended with by and reason; hidden tells R117", async () => {
  const w = await sightWorld();
  w.bundle("INFO-J");
  assert.equal(w.m.projectVisibilitySet({ projectId: "INFO-J", setting: "hidden", by: "ann", viewer: V("ann") }).reason, "NOT_A_PROJECT");
  const viewerOf = (by) => (by === "admin" ? "admin" : V(by));
  assert.equal(w.m.projectVisibilitySet({ projectId: "PROJ-H", setting: "discoverable", by: "bob", viewer: V("bob") }).reason,
    "PROJECT_VISIBILITY_NOT_THE_OWNER", "bob");
  /* D54: an administrator neither invited nor joined is at the hidden project's EXISTENCE, so the act is refused there
     (C-70.1); at the discoverable project it sees whole, the setting is still the owners' alone. */
  for (const by of ["second", "admin"]) {
    assert.equal(w.m.projectVisibilitySet({ projectId: "PROJ-H", setting: "discoverable", by, viewer: viewerOf(by) }).reason,
      "PROJECT_SEEN_NOT_A_PARTICIPANT", by);
    assert.equal(w.m.projectVisibilitySet({ projectId: "PROJ-D", setting: "hidden", by, viewer: viewerOf(by) }).reason,
      "PROJECT_VISIBILITY_NOT_THE_OWNER", by);
  }
  assert.equal(w.m.projectVisibilitySet({ projectId: "PROJ-H", setting: "public", by: "ann", viewer: V("ann") }).reason,
    "PROJECT_VISIBILITY_UNKNOWN_SETTING");
  const h = w.m.projectVisibilitySet({ projectId: "PROJ-D", setting: "hidden", reason: "closing up", by: "ann", viewer: V("ann") });
  assert.deepEqual([h.ok, h.setting, h.set_by, h.reason, h.requests_lapsed], [true, "hidden", "ann", "closing up", 0],
    "hiding lapses requests through R117's listener; with none registered, 0");
  assert.equal(w.m.visibilityOf("PROJ-D"), "hidden");
  assert.equal(w.m.sight("PROJ-D", V("cal")), Membership.SIGHT_NONE);
  assert.equal(w.m.visibilityOf("PROJ-H"), "hidden", "a project with no record is hidden");
  assert.equal(w.rows(`SELECT * FROM project_visibility WHERE project_id='PROJ-D'`).length, 2, "appended, never overwritten");
});

test("R45 R117 hiding tells the one registered listener after the record and the reindex; requests_lapsed its count; discoverable tells nobody", async () => {
  const w = await sightWorld();
  const heard = [];
  let answer = 2;
  assert.deepEqual(w.m.onProjectHidden("project-roster", (n) => {
    heard.push({ ...n, setting: w.m.visibilityOf(n.projectId),
                 recorded: w.row(`SELECT at FROM project_visibility WHERE project_id=? ORDER BY seq DESC LIMIT 1`, n.projectId).at });
    if (answer === "throw") throw new Error("listener fails");
    return answer;
  }), { ok: true, module: "project-roster" });
  const h = w.m.projectVisibilitySet({ projectId: "PROJ-D", setting: "hidden", by: "ann", viewer: V("ann") });
  assert.deepEqual([h.ok, h.setting, h.requests_lapsed], [true, "hidden", 2]);
  assert.equal(heard.length, 1);
  assert.deepEqual([heard[0].projectId, heard[0].by, heard[0].setting, heard[0].at], ["PROJ-D", "ann", "hidden", h.at]);
  assert.equal(heard[0].recorded, h.at, "told after the record, with the record's date");
  const d = w.m.projectVisibilitySet({ projectId: "PROJ-D", setting: "discoverable", by: "ann", viewer: V("ann") });
  assert.deepEqual([d.ok, "requests_lapsed" in d, heard.length], [true, false, 1], "discoverable tells nobody");
  for (const a of [0, "throw", -1, 1.5, "3", null]) {
    answer = a;
    const r = w.m.projectVisibilitySet({ projectId: "PROJ-D", setting: "hidden", by: "ann", viewer: V("ann") });
    assert.deepEqual([r.ok, r.requests_lapsed, w.m.visibilityOf("PROJ-D")], [true, 0, "hidden"], String(a));
    w.m.projectVisibilitySet({ projectId: "PROJ-D", setting: "discoverable", by: "ann", viewer: V("ann") });
  }
  /* A refused setting tells nobody. */
  const before = heard.length;
  w.m.projectVisibilitySet({ projectId: "PROJ-D", setting: "hidden", by: "bob", viewer: V("bob") });
  assert.equal(heard.length, before);
  const again = w.m.onProjectHidden("other", () => 1);
  assert.deepEqual([again.reason, again.module], ["LISTENER_DECLARED", "project-roster"]);
  assert.equal(w.m.onProjectHidden("x", 1).reason, "LISTENER_MALFORMED");
});

test("R47 visibilitySettingRefusal answers the unknown-setting refusal for anything but the two settings", () => {
  const m = new Membership({ sql: null });
  for (const ok of ["discoverable", "hidden"]) assert.equal(m.visibilitySettingRefusal(ok, null), null);
  for (const bad of ["", "Hidden", "public", null, undefined, 1, "discoverable "]) {
    const r = m.visibilitySettingRefusal(bad, null);
    assert.equal(r.reason, "PROJECT_VISIBILITY_UNKNOWN_SETTING", JSON.stringify(bad));
  }
});

test("R77 existenceAct: C-70.1 (id and name only) at EXISTENCE; null at FULL, at NONE and with no viewer; never throws", async () => {
  const w = await sightWorld();
  w.bundle("INFO-K");
  const row = PROJECT_VISIBILITY_CHECKS.PROJECT_SEEN_NOT_A_PARTICIPANT;
  assert.equal(row.check, "C-70.1");
  // EXISTENCE: a discoverable project, a member outside it (an ordinary member, and one invited elsewhere)
  for (const who of ["cal", "bob"]) {
    const ex = w.m.existenceAct("PROJ-D", V(who));
    assert.deepEqual(ex, { ok: false, reason: "PROJECT_SEEN_NOT_A_PARTICIPANT", code: "PROJECT_SEEN_NOT_A_PARTICIPANT",
      check: "C-70.1", translation: row.translation, detail: ex.detail, project: "PROJ-D", name: "Discoverable D" }, who);
    assert.equal(typeof ex.detail, "string");
    for (const secret of ["ann", "owner", "joined", "invited"]) assert.ok(!ex.detail.includes(secret), secret);
  }
  // FULL: the owner, an invited participant, an administrator, the founder, every machine credential
  assert.equal(w.m.existenceAct("PROJ-D", V("ann")), null);
  w.m.projectInvite({ projectId: "PROJ-D", handle: "bob", by: "ann", viewer: V("ann") });
  assert.equal(w.m.existenceAct("PROJ-D", V("bob")), null, "invited is FULL");
  assert.equal(w.m.existenceAct("PROJ-D", V("second")), null, "an administrator is FULL");
  assert.equal(w.m.existenceAct("PROJ-D", "admin"), null, "the founder is FULL");
  for (const cls of ["admin", "member", "probe", "daemon", "ai"])
    assert.equal(w.m.existenceAct("PROJ-D", `${MACHINE_CLASS_PREFIX}${cls}`), null, cls);
  // NONE: hidden, absent, not a project, a viewer naming nobody
  for (const [id, v] of [["PROJ-H", V("cal")], ["PROJ-NEVER", V("cal")], ["INFO-K", V("cal")], ["PROJ-D", "junk"],
                         ["PROJ-D", ""], ["PROJ-D", "member:"], ["PROJ-D", 7]])
    assert.equal(w.m.existenceAct(id, v), null, `${id} ${JSON.stringify(v)}`);
  // no viewer given: an internal caller, not asked
  assert.equal(w.m.existenceAct("PROJ-D", null), null);
  assert.equal(w.m.existenceAct("PROJ-D", undefined), null);
  assert.equal(w.m.existenceAct("PROJ-D"), null);
  // going hidden takes EXISTENCE away; going discoverable gives it
  w.m.projectVisibilitySet({ projectId: "PROJ-D", setting: "hidden", by: "ann", viewer: V("ann") });
  assert.equal(w.m.existenceAct("PROJ-D", V("cal")), null);
  w.m.projectVisibilitySet({ projectId: "PROJ-H", setting: "discoverable", by: "ann", viewer: V("ann") });
  assert.equal(w.m.existenceAct("PROJ-H", V("cal")).project, "PROJ-H");
  // never throws, whatever it is handed
  for (const id of [null, undefined, "", 0, {}, [], "x'; DROP TABLE members; --"])
    for (const v of [V("cal"), "admin", {}, [], 0, true])
      assert.doesNotThrow(() => w.m.existenceAct(id, v), `${JSON.stringify(id)} ${JSON.stringify(v)}`);
  // it is the one mint of C-70.1: every project-naming act at EXISTENCE answers it byte for byte (R44's list)
  const ex = w.m.existenceAct("PROJ-H", V("cal"));
  assert.deepEqual(w.m.projectJoin({ projectId: "PROJ-H", by: "cal", viewer: V("cal") }), ex);
  assert.deepEqual(w.m.projectVisibilitySet({ projectId: "PROJ-H", setting: "hidden", by: "cal", viewer: V("cal") }), ex);
});

test("R43 R44 R80 R76 N357: the founder's member:admin sees as the bare admin does (FULL of a discoverable project, EXISTENCE of a hidden one it is not in), and names the member admin", async () => {
  const w = await world().group("ann", "cal");
  w.project("PROJ-H", "Hidden H");
  w.project("PROJ-D", "Discoverable D");
  w.project("PROJ-M", "Machine M");
  for (const p of ["PROJ-H", "PROJ-D"]) w.m.projectClaimOwner({ projectId: p, memberId: "ann" });
  w.m.projectVisibilitySet({ projectId: "PROJ-D", setting: "discoverable", by: "ann", viewer: V("ann") });
  for (const v of ["admin", V("admin")]) {
    assert.equal(w.m.sight("PROJ-D", v), Membership.SIGHT_FULL, `${v} PROJ-D`);
    assert.equal(w.m.inSight("PROJ-D", v), true, `${v} PROJ-D`);
    assert.equal(w.m.existenceAct("PROJ-D", v), null, `${v} PROJ-D`);
    /* D54: a hidden project, owned or machine-made, the founder neither invited nor joined */
    for (const p of ["PROJ-H", "PROJ-M"]) {
      assert.equal(w.m.sight(p, v), Membership.SIGHT_EXISTENCE, `${v} ${p}`);
      assert.equal(w.m.inSight(p, v), false, `${v} ${p}`);
      assert.equal(w.m.existenceAct(p, v).code, "PROJECT_SEEN_NOT_A_PARTICIPANT", `${v} ${p}`);
    }
  }
  /* the founder as a participant sees the hidden project whole, in both spellings */
  w.m.projectInvite({ projectId: "PROJ-H", handle: "cal", by: "ann", viewer: V("ann") });
  w.m.participationWrite("invite", { projectId: "PROJ-H", memberId: "admin", by: "ann" });
  for (const v of ["admin", V("admin")]) assert.equal(w.m.sight("PROJ-H", v), Membership.SIGHT_FULL, v);
  assert.deepEqual([viewerPredicate("admin").member, viewerPredicate(V("admin")).member], [null, "admin"]);
  assert.deepEqual([viewerPredicate("admin").scope, viewerPredicate(V("admin")).scope], ["participant", "participant"]);
  assert.equal(w.m.positionalMember(V("admin")), "admin");
  assert.equal(w.m.positionalMember("admin"), null);
  /* sight is not authority: the founder's spellings hold no position in a project (R55, R60) */
  assert.equal(w.m.projectAuthority("PROJ-D", V("admin"), "joined", "an act").code, "PROJECT_ACT_NOT_A_PARTICIPANT");
  /* no other member id is widened: a member named like no roster row still sees no project */
  assert.equal(w.m.inSight("PROJ-D", V("admin2")), false);
  assert.equal(w.m.inSight("PROJ-D", V("Admin")), false);
});
