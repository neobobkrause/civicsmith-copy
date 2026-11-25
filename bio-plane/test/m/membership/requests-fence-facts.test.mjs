import { test } from "node:test";
import assert from "node:assert/strict";
import { world, realWorld, V } from "./fixture.mjs";
import { Membership } from "../../../src/membership/index.mjs";
import { MACHINE_CLASS_PREFIX } from "../../../src/record-grammar/index.mjs";
import { MEMBERSHIP_EXEMPT_TABLES, MEMBERSHIP_PROJECT_TABLES } from "../../../src/membership/index.mjs";

/* D discoverable (owner ann, participant bob), H hidden (owner ann); cal, dee outside */
async function reqWorld() {
  const w = await world().group("ann", "bob", "cal", "dee");
  w.project("PROJ-D", "Discoverable D");
  w.project("PROJ-H", "Hidden H");
  for (const p of ["PROJ-D", "PROJ-H"]) w.m.projectClaimOwner({ projectId: p, memberId: "ann" });
  w.m.projectInvite({ projectId: "PROJ-D", handle: "bob", by: "ann", viewer: V("ann") });
  w.m.projectVisibilitySet({ projectId: "PROJ-D", setting: "discoverable", by: "ann", viewer: V("ann") });
  return w;
}

test("R54 isProjectOwner and isJoinedParticipant", async () => {
  const w = await reqWorld();
  w.m.projectInvite({ projectId: "PROJ-D", handle: "cal", by: "ann", viewer: V("ann") });
  w.m.projectJoin({ projectId: "PROJ-D", by: "bob", viewer: V("bob") });
  w.m.projectLeave({ projectId: "PROJ-D", by: "bob", viewer: V("bob") });
  const t = (id) => [w.m.isProjectOwner("PROJ-D", id), w.m.isJoinedParticipant("PROJ-D", id)];
  assert.deepEqual(t("ann"), [true, true]);
  assert.deepEqual(t("bob"), [false, true], "leaving is still joined-or-leaving");
  assert.deepEqual(t("cal"), [false, false], "invited");
  assert.deepEqual(t("dee"), [false, false]);
  assert.deepEqual(t("second"), [false, false], "an administrator holds no position");
});

test("R55 projectAuthority: owner and joined fences; sight and administrator status confer neither; no member not asked", async () => {
  const w = await reqWorld();
  w.m.projectJoin({ projectId: "PROJ-D", by: "bob", viewer: V("bob") });
  const pa = (who, need) => w.m.projectAuthority("PROJ-D", who, need, "revising the document");
  assert.equal(pa(V("ann"), "owner"), null);
  assert.equal(pa(V("bob"), "joined"), null);
  const r = pa(V("bob"), "owner");
  assert.deepEqual([r.ok, r.code, r.project, r.needs, r.act], [false, "PROJECT_ACT_NOT_THE_OWNER", "PROJ-D", "owner", "revising the document"]);
  assert.equal(pa(V("cal"), "joined").code, "PROJECT_ACT_NOT_A_PARTICIPANT");
  assert.equal(pa(V("second"), "joined").code, "PROJECT_ACT_NOT_A_PARTICIPANT");
  assert.equal(pa(V("admin"), "owner").code, "PROJECT_ACT_NOT_THE_OWNER");
  w.m.projectLeave({ projectId: "PROJ-D", by: "bob", viewer: V("bob") });
  assert.equal(pa(V("bob"), "joined"), null, "leaving still acts");
  assert.equal(pa(null, "owner"), null);
  assert.equal(pa(`${MACHINE_CLASS_PREFIX}member`, "owner"), null);
});

test("R56 caseAuthority: delivery needs joined (the founder excepted); the signer must own the project", async () => {
  const w = await reqWorld();
  w.m.projectJoin({ projectId: "PROJ-D", by: "bob", viewer: V("bob") });
  const ca = (o) => w.m.caseAuthority({ act: "publish", subject: "CASE-1", ...o });
  assert.equal(ca({ project: "PROJ-D", deliveredBy: V("bob"), signer: "ann" }), null);
  assert.equal(ca({ project: "PROJ-D", deliveredBy: "founder", signer: "ann" }), null);
  assert.equal(ca({ project: "PROJ-D", deliveredBy: V("cal"), signer: "ann" }).code, "PROJECT_ACT_NOT_A_PARTICIPANT");
  const s = ca({ project: "PROJ-D", deliveredBy: V("bob"), signer: "bob" });
  assert.deepEqual([s.code, s.signer, s.project], ["CASE_SIGNER_NOT_AN_OWNER", "bob", "PROJ-D"]);
  assert.equal(ca({ project: null, deliveredBy: V("bob"), signer: "ann" }).code, "CASE_SIGNER_NOT_AN_OWNER");
  assert.equal(ca({ project: "PROJ-D", deliveredBy: "founder", signer: null }).code, "CASE_SIGNER_NOT_AN_OWNER");
});

test("R64 isAdministrator: the founder once claimed, and active members with role admin", async () => {
  const w = world();
  assert.equal(w.m.isAdministrator("admin"), false, "not before the claim");
  await w.claim();
  assert.equal(w.m.isAdministrator("admin"), true);
  await w.enrol("second", "admin");
  await w.enrol("ann");
  assert.deepEqual(["second", "ann", "nobody", null, "", "class:admin"].map((x) => w.m.isAdministrator(x)),
    [true, false, false, false, false, false]);
  w.sql.exec(`UPDATE members SET status='revoked' WHERE member_id='second'`);
  assert.equal(w.m.isAdministrator("second"), false);
});

test("R66 isProjectEditor: an owner or a joined participant, never one leaving or invited", async () => {
  const w = await reqWorld();
  w.m.projectInvite({ projectId: "PROJ-D", handle: "cal", by: "ann", viewer: V("ann") });
  w.m.projectInvite({ projectId: "PROJ-D", handle: "dee", by: "ann", viewer: V("ann") });
  w.m.projectJoin({ projectId: "PROJ-D", by: "bob", viewer: V("bob") });
  w.m.projectJoin({ projectId: "PROJ-D", by: "dee", viewer: V("dee") });
  w.m.projectLeave({ projectId: "PROJ-D", by: "dee", viewer: V("dee") });
  assert.deepEqual(["ann", "bob", "cal", "dee", "second"].map((m) => w.m.isProjectEditor("PROJ-D", m)),
    [true, true, false, false, false]);
});

test("R68 memberFacts gives cover, handle, role and status or null, never a credential, key or expertise", async () => {
  const w = await world().group("ann");
  w.m.expertiseDeclare({ memberId: "ann", label: "CPA" });
  assert.deepEqual(w.m.memberFacts("ann"), { cover: "cover of ann", handle: "ann", role: "member", status: "active" });
  assert.equal(w.m.memberFacts("nobody"), null);
});

test("R69 activeParticipants: joined (not leaving, not invited) members who are active", async () => {
  const w = await reqWorld();
  w.m.projectJoin({ projectId: "PROJ-D", by: "bob", viewer: V("bob") });
  for (const h of ["cal", "dee"]) w.m.projectInvite({ projectId: "PROJ-D", handle: h, by: "ann", viewer: V("ann") });
  w.m.projectJoin({ projectId: "PROJ-D", by: "dee", viewer: V("dee") });
  assert.deepEqual(w.m.activeParticipants("PROJ-D"), ["ann", "bob", "dee"]);
  w.m.projectLeave({ projectId: "PROJ-D", by: "bob", viewer: V("bob") });
  w.m.memberSet({ memberId: "dee", status: "revoked", by: "admin" });
  assert.deepEqual(w.m.activeParticipants("PROJ-D"), ["ann"]);
  assert.deepEqual(w.m.activeParticipants("NOPE"), []);
});

test("R71 projectCreated: the sole initial owner, the creation visibility recorded, sight reindexed", async () => {
  const w = await world().group("ann", "cal");
  w.bundle("PROJ-N", "project", "New");
  const r = w.m.projectCreated({ projectId: "PROJ-N", ownerId: "ann", visibility: "discoverable", by: "ann" });
  assert.deepEqual([r.ok, r.owner, r.setting], [true, "ann", "discoverable"]);
  assert.deepEqual(w.m.projectOwners("PROJ-N"), ["ann"]);
  assert.equal(w.m.participation("PROJ-N", "ann").state, "joined");
  assert.deepEqual(w.rows(`SELECT setting, set_by, reason FROM project_visibility WHERE project_id='PROJ-N'`).map((h) => [h.setting, h.set_by, h.reason]),
    [["discoverable", "ann", "chosen at creation"]]);
  assert.equal(w.m.sight("PROJ-N", V("cal")), Membership.SIGHT_EXISTENCE, "reindexed");
  w.bundle("PROJ-M", "project", "Machine-made");
  const m = w.m.projectCreated({ projectId: "PROJ-M", ownerId: null, visibility: null, by: "class:admin" });
  assert.deepEqual([m.ok, m.owner, m.setting, w.m.projectOwners("PROJ-M")], [true, null, "hidden", []]);
  assert.equal(w.m.projectCreated({ projectId: "PROJ-N", ownerId: "cal" }).reason, "OWNED");
  w.bundle("PROJ-B", "project");
  assert.equal(w.m.projectCreated({ projectId: "PROJ-B", ownerId: "ann", visibility: "public" }).reason,
    "PROJECT_VISIBILITY_UNKNOWN_SETTING");
  assert.equal(w.m.participation("PROJ-B", "ann"), null, "nothing written on a refusal");
});

test("R115 R111 R57 members' tables are declared exempt from purge; participation, visibility, the sight index and removals are cleared with the project", async () => {
  const w = world();
  assert.equal(w.declared.length, 1);
  const [d] = w.declared;
  assert.equal(d.module, "membership");
  assert.deepEqual(new Set(d.opts.exempt), new Set(["members", "member_expertise", "admin_votes", "hosting_access",
    "group_description", "court_notice", "handle_history", "handle_check_window", "founder_handle"]),
    "R111's tables and the handle history (R57, R16) (with R123's check window) beside R115's, and R144's founder handle; join_doors is R131's");
  /* R131 (T46): join_doors is declared apart, with its own classes, exempt from purge as R111 states; R143 (T48):
     home_looks, the members' Home marks, likewise, exempt as the members are */
  assert.deepEqual(w.tablesDeclared.map((x) => [x.module, x.entries.map((e) => [e.name, e.purge])]),
    [["membership", [["join_doors", "exempt"], ["home_looks", "exempt"]]]]);
  assert.deepEqual(new Set(MEMBERSHIP_PROJECT_TABLES), new Set(["project_participants", "project_removals", "project_visibility",
    "project_sight"]), "R115: the owner votes, decisions and requests are project-roster's (its R18), not declared here");
  assert.deepEqual(d.tables, MEMBERSHIP_PROJECT_TABLES.map((name) => ({ name, keys: ["project_id"] })),
    "each project-keyed table once, keyed by project (record-core R46)");
  for (const t of MEMBERSHIP_PROJECT_TABLES)
    assert.ok(w.rows(`PRAGMA table_info(${t})`).some((c) => c.name === "project_id"), `${t} is keyed by project`);
  const owned = w.rows(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('bundles','sqlite_sequence')`).map((r) => r.name);
  const apart = w.tablesDeclared.flatMap((x) => x.entries.map((e) => e.name));
  assert.deepEqual(new Set(owned), new Set([...d.tables.map((t) => t.name), ...d.opts.exempt, ...apart]),
    "every table the module owns is declared");
  assert.equal(owned.length, d.tables.length + d.opts.exempt.length + apart.length, "and each once");
  w.m.migrate();
  assert.deepEqual([w.declared.length, w.tablesDeclared.length], [1, 1], "declared once");
});

test("R115 through the real record-core: a purge clears the project's rows and never a member's", async () => {
  const w = await realWorld();
  const { m, rc } = w;
  await w.claim();
  const s = await m.memberAdd({ memberId: "second", cover: "c", role: "admin", by: "admin" });
  await m.enroll({ invite: s.invite, handle: "second", password: "second-passphrase-x" });
  const a = await m.memberAdd({ memberId: "ann", cover: "c", by: "admin" });
  await m.enroll({ invite: a.invite, handle: "ann", password: "ann-passphrase-x" });
  for (const id of ["PROJ-A", "PROJ-B"]) {
    w.bundle(id);
    m.projectClaimOwner({ projectId: id, memberId: "ann" });
    m.projectVisibilitySet({ projectId: id, setting: "discoverable", by: "ann", viewer: V("ann") });
  }
  m.expertiseDeclare({ memberId: "ann", label: "CPA" });
  const count = (t, where = "1=1") => w.row(`SELECT COUNT(*) AS n FROM ${t} WHERE ${where}`).n;
  rc.purge({ bundleId: "PROJ-A" });
  assert.deepEqual(["project_participants", "project_visibility", "project_sight"].map((t) => count(t, "project_id='PROJ-A'")), [0, 0, 0]);
  assert.deepEqual(["project_participants", "project_visibility", "project_sight"].map((t) => count(t, "project_id='PROJ-B'")), [1, 1, 1]);
  rc.purge({});
  for (const t of MEMBERSHIP_PROJECT_TABLES) assert.equal(count(t), 0, t);
  assert.deepEqual(["members", "member_expertise"].map((t) => count(t)), [2, 1], "identity survives");
});

test("R76 positionalMember: who is asking, identity before viewer, R43's member id; null for a machine or an unadmitted one", async () => {
  const w = await world().group("ann");
  const pm = (v, i) => w.m.positionalMember(v, i);
  assert.equal(pm(V("ann")), "ann");
  assert.equal(pm(V("ann"), null), "ann");
  assert.equal(pm(V("ann"), ""), "ann", "an empty identity is not asked");
  assert.equal(pm("admin", "member:admin"), "admin", "the founder's session: its identity names it");
  assert.equal(pm(V("ann"), V("bob")), "bob", "identity wins over viewer");
  assert.equal(pm(V("ann"), `${MACHINE_CLASS_PREFIX}ai`), null, "a machine identity names nobody, whatever the viewer");
  assert.equal(pm("admin"), null, "the founder's bare viewer is the operator's sight, not a position");
  for (const cls of ["admin", "member", "probe", "daemon", "ai"]) assert.equal(pm(`${MACHINE_CLASS_PREFIX}${cls}`), null, cls);
  for (const v of [null, undefined, "", "junk", "member:", "member:a b", 7, {}, []]) {
    assert.equal(pm(v), null, JSON.stringify(v));
    assert.equal(pm(null, v), null, `identity ${JSON.stringify(v)}`);
  }
  assert.equal(pm(V("never-enrolled")), "never-enrolled", "R43's parse, not a roster lookup");
  const before = JSON.stringify(w.rows(`SELECT * FROM members`));
  for (const x of [V("ann"), "junk", null]) pm(x, x);
  assert.equal(JSON.stringify(w.rows(`SELECT * FROM members`)), before, "writes nothing");
});
