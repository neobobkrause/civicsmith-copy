/* The shares of eight old suites this module proves at its own interface (T19's convert entry; K619, their rows in
   `build/jobs/T17/legacy-tests.md`): `statusby`, `adminvote`, `founder-sight`, `members`, `project-authority`,
   `project-discoverable`, `ratify-authority` and `project-sight`. Each test names the requirements it proves and the
   suite it converts. What those suites assert of other modules (sign-in's sentence and the key cascade, which are
   `credentials`'; the control plane's tables; citation's, queue's, publication's acts) is not proved here. The ops are
   driven through `membershipOps`, whose stamps (`by`, `viewer`, `administer`) come from the query, as the control plane
   sends them, and never from the body. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V } from "./fixture.mjs";
import { MACHINE_CLASS_PREFIX } from "../../../src/record-grammar/index.mjs";
import { CUSTODIAL_CHECKS, PROJECT_AUTHORITY_CHECKS, PROJECT_VISIBILITY_CHECKS,
         CASE_AUTHORITY_CHECKS } from "../../../src/membership/checks.mjs";

const BEARER = `${MACHINE_CLASS_PREFIX}admin`;
const q = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null)).toString();
const op = (w, name, query = {}, body = null) => w.ops(q(query), body)[name]();
const sb = (w, id) => { const r = w.m.memberList({ administer: true }).members.find((m) => m.member_id === id);
  return r ? [r.status, r.status_by] : null; };

/* ruth and gus, the two administrators, each invited by the operator's bearer and enrolled; no founder claim (the old
   suites' `scratch` store), so the administrators are exactly ruth and gus. */
async function twoAdmins() {
  const w = world();
  for (const id of ["ruth", "gus"]) {
    const a = await op(w, "memberadd", { by: BEARER }, { memberId: id, cover: `cover for ${id}`, role: "admin" });
    assert.equal(a.ok, true, id);
    assert.equal((await op(w, "enroll", {}, { invite: a.invite, handle: id, password: `${id}-passphrase-x` })).ok, true);
  }
  return w;
}

/* ---- statusby ---- */

test("R58 R13 R16 (statusby) each status names the actor whose act caused it: the inviter, the member, never the body's `by`", async () => {
  const w = await twoAdmins();
  assert.deepEqual([sb(w, "ruth"), sb(w, "gus")], [["active", "ruth"], ["active", "gus"]], "each one's own enrolment");
  const ana = await op(w, "memberadd", { by: BEARER }, { memberId: "ana", cover: "the bearer's invitee", role: "member" });
  assert.equal(ana.ok, true);
  assert.deepEqual(sb(w, "ana"), ["invited", BEARER], "the bearer is recorded as the credential, never a person");
  const bea = await op(w, "memberadd", { by: "ruth" }, { memberId: "bea", cover: "ruth's invitee", role: "member", by: "gus" });
  assert.deepEqual(sb(w, "bea"), ["invited", "ruth"], "ruth's stamp, not the gus her body named");
  assert.equal((await op(w, "enroll", {}, { invite: bea.invite, handle: "bea", password: "bea-passphrase-x" })).ok, true);
  assert.deepEqual(sb(w, "bea"), ["active", "bea"], "enrolment is the member's own act");
});

test("R58 R14 R6 R8 (statusby) a proposal names the proposer, the completing endorsement its endorser, a carried removal its last voter", async () => {
  const w = await twoAdmins();
  const prop = await op(w, "memberadd", { by: "ruth" }, { memberId: "dan", cover: "the third", role: "admin" });
  assert.equal(prop.reason, "CONSENSUS_REQUIRED");
  assert.deepEqual(prop.awaiting, ["gus"]);
  assert.deepEqual(sb(w, "dan"), ["proposed", "ruth"]);
  const end = await op(w, "adminendorse", { by: "gus" }, { memberId: "dan" });
  assert.equal(end.ok, true);
  assert.deepEqual(sb(w, "dan"), ["invited", "gus"], "the vote that completed it, not the proposer");
  assert.equal((await op(w, "enroll", {}, { invite: end.invite, handle: "dan", password: "dan-passphrase-x" })).ok, true);
  assert.deepEqual(sb(w, "dan"), ["active", "dan"]);
  const v1 = op(w, "adminremove", { by: "ruth" }, { memberId: "dan", reason: "fixture" });
  assert.equal(v1.reason, "VOTES_SHORT");
  assert.deepEqual(sb(w, "dan"), ["active", "dan"], "a vote that does not carry changes nothing");
  const v2 = op(w, "adminremove", { by: "gus" }, { memberId: "dan", reason: "fixture" });
  assert.equal(v2.ok, true);
  assert.deepEqual(sb(w, "dan"), ["revoked", "gus"], "the vote that carried it");
});

test("R58 R20 (statusby, adminvote) memberset names its setter; an unstamped call reads `not recorded`, never the body's `by`", async () => {
  const w = await twoAdmins();
  const bea = await op(w, "memberadd", { by: "ruth" }, { memberId: "bea", cover: "c", role: "member" });
  await op(w, "enroll", {}, { invite: bea.invite, handle: "bea", password: "bea-passphrase-x" });
  op(w, "memberset", { by: "ruth" }, { memberId: "bea", status: "revoked" });
  assert.deepEqual(sb(w, "bea"), ["revoked", "ruth"]);
  op(w, "memberset", { by: "gus" }, { memberId: "bea", status: "active" });
  assert.deepEqual(sb(w, "bea"), ["active", "gus"]);
  op(w, "memberset", { by: BEARER }, { memberId: "bea", status: "revoked" });
  assert.deepEqual(sb(w, "bea"), ["revoked", BEARER], "an administrator bearer's set records the credential");
  await op(w, "memberadd", {}, { memberId: "nos", cover: "no plane in front", role: "member", by: "ruth" });
  assert.deepEqual(sb(w, "nos"), ["invited", "not recorded"], "a store-direct call with no stamp attributes nothing");
});

test("R6 R58 (adminvote) the endorsement relay ignores a body's `by`: with no stamp it is NOT_AN_ADMIN and records no vote", async () => {
  const w = await twoAdmins();
  await op(w, "memberadd", { by: "ruth" }, { memberId: "dan", cover: "the third", role: "admin" });
  const r = await op(w, "adminendorse", {}, { memberId: "dan", by: "gus" });
  assert.equal(r.reason, "NOT_AN_ADMIN");
  assert.equal(r.by, null);
  assert.deepEqual(w.rows(`SELECT voter FROM admin_votes WHERE kind='add' AND target='dan' ORDER BY voter`), [{ voter: "ruth" }]);
  assert.deepEqual(sb(w, "dan"), ["proposed", "ruth"]);
});

/* ---- founder-sight ---- */

test("R12 (founder-sight) the reservation is the id `admin` exactly: `administrator`, `admins` and `admin-2` are ordinary ids", async () => {
  const w = await world().group();
  for (const id of ["administrator", "admins", "admin-2"]) {
    const r = await w.m.memberAdd({ memberId: id, cover: "a real person", role: "member", by: "admin" });
    assert.equal(r.ok, true, id);
  }
  for (const by of ["admin", "second", BEARER]) {
    const r = await w.m.memberAdd({ memberId: "admin", cover: "an impostor", role: "admin", by });
    assert.equal(r.reason, "MEMBER_ID_RESERVED", by);
  }
});

/* ---- members ---- */

test("R12 (members) a member added with no cover is NO_COVER with its row, C-96.3, and nothing written", async () => {
  const w = await world().group();
  const before = w.rows(`SELECT member_id FROM members`).length;
  for (const cover of [undefined, "", "   ", 42]) {
    const r = await w.m.memberAdd({ memberId: "nobody", cover, by: "admin" });
    assert.equal(r.reason, "NO_COVER");
    assert.equal(r.check, CUSTODIAL_CHECKS.NO_COVER.check);
    assert.equal(r.translation, CUSTODIAL_CHECKS.NO_COVER.translation);
    assert.match(r.detail, /cover/);
  }
  /* `name` is no longer an alias of the cover (K57) */
  assert.equal((await w.m.memberAdd({ memberId: "nobody", name: "a name", by: "admin" })).reason, "NO_COVER");
  assert.equal(w.rows(`SELECT member_id FROM members`).length, before);
});

test("R20 R92 (members) a revoked ordinary member, reinstated, is active again and holds their capabilities", async () => {
  const w = await world().group("meilan");
  assert.equal(w.m.memberSet({ memberId: "meilan", status: "revoked", by: "admin" }).ok, true);
  assert.deepEqual(w.m.sessionRights("member:meilan").capabilities, []);
  const r = w.m.memberSet({ memberId: "meilan", status: "active", by: "second" });
  assert.equal(r.ok, true);
  assert.equal(r.demoted, undefined, "an ordinary member is not demoted");
  assert.equal(w.m.memberFacts("meilan").status, "active");
  assert.deepEqual(w.m.sessionRights("member:meilan").capabilities, ["contribute"]);
});

/* ---- project-authority, ratify-authority ---- */

async function projectWorld() {
  const w = await world().group("iris", "jo", "kit");
  w.project("P");
  w.m.projectClaimOwner({ projectId: "P", memberId: "iris" });
  w.m.projectInvite({ projectId: "P", handle: "jo", by: "iris", viewer: V("iris") });
  w.m.projectInvite({ projectId: "P", handle: "kit", by: "iris", viewer: V("iris") });
  w.m.projectJoin({ projectId: "P", by: "kit", viewer: V("kit") });
  return w;
}

test("R55 (project-authority) each refusal carries its row's check and translation, the act and the position needed", async () => {
  const w = await projectWorld();
  const joined = w.m.projectAuthority("P", V("jo"), "joined", "citing into the project");
  assert.deepEqual([joined.code, joined.reason, joined.check, joined.translation, joined.act, joined.needs, joined.project],
    ["PROJECT_ACT_NOT_A_PARTICIPANT", "PROJECT_ACT_NOT_A_PARTICIPANT", "C-56.1",
     PROJECT_AUTHORITY_CHECKS.PROJECT_ACT_NOT_A_PARTICIPANT.translation, "citing into the project", "joined", "P"]);
  const owner = w.m.projectAuthority("P", V("kit"), "owner", "adopting a bias set");
  assert.deepEqual([owner.code, owner.check, owner.translation, owner.act, owner.needs],
    ["PROJECT_ACT_NOT_THE_OWNER", "C-56.2", PROJECT_AUTHORITY_CHECKS.PROJECT_ACT_NOT_THE_OWNER.translation,
     "adopting a bias set", "owner"]);
  assert.equal(w.m.projectAuthority("P", V("kit"), "joined", "x"), null, "a joined participant works");
  assert.equal(w.m.projectAuthority("P", V("iris"), "owner", "x"), null, "the owner directs");
  /* D54 (T41-3): an administrator holds no position in P, whether it sees P at EXISTENCE (hidden) or whole */
  for (const who of [V("second"), V("admin")])
    assert.equal(w.m.projectAuthority("P", who, "joined", "x").check, "C-56.1", `${who}: no position, hidden`);
  w.m.projectVisibilitySet({ projectId: "P", setting: "discoverable", by: "iris", viewer: V("iris") });
  for (const who of [V("second"), V("admin")]) {
    assert.equal(w.m.inSight("P", who), true, `${who} sees discoverable P`);
    assert.equal(w.m.projectAuthority("P", who, "joined", "x").check, "C-56.1", `${who}: sight confers nothing`);
  }
  for (const who of [null, undefined, BEARER]) assert.equal(w.m.projectAuthority("P", who, "owner", "x"), null, String(who));
});

test("R56 R54 (ratify-authority) delivery needs a joined position, the signature an owner's; each refusal carries its row", async () => {
  const w = await projectWorld();
  const base = { project: "P", act: "ratifying a finding", subject: "the finding F-1" };
  const jo = w.m.caseAuthority({ ...base, deliveredBy: V("jo"), signer: "iris" });
  assert.deepEqual([jo.code, jo.check, jo.translation, jo.act],
    ["PROJECT_ACT_NOT_A_PARTICIPANT", "C-56.1", PROJECT_AUTHORITY_CHECKS.PROJECT_ACT_NOT_A_PARTICIPANT.translation,
     "ratifying a finding"], "an invited, not joined, deliverer is refused");
  const outsideAdmin = w.m.caseAuthority({ ...base, deliveredBy: V("second"), signer: "iris" });
  assert.equal(outsideAdmin.check, "C-56.1", "an administrator with no role in the project may not carry it in");
  const nonOwner = w.m.caseAuthority({ ...base, deliveredBy: V("kit"), signer: "kit", extra: { finding: "F-1" } });
  assert.deepEqual([nonOwner.code, nonOwner.check, nonOwner.translation, nonOwner.signer, nonOwner.finding],
    ["CASE_SIGNER_NOT_AN_OWNER", "C-57.1", CASE_AUTHORITY_CHECKS.CASE_SIGNER_NOT_AN_OWNER.translation, "kit", "F-1"]);
  assert.equal(w.m.caseAuthority({ ...base, deliveredBy: V("kit"), signer: "iris" }), null, "joined deliverer, owner signer");
  assert.equal(w.m.caseAuthority({ ...base, deliveredBy: "founder", signer: "iris" }), null, "the founder delivers");
  assert.equal(w.m.caseAuthority({ ...base, project: null, deliveredBy: "founder", signer: "iris" }).check, "C-57.1",
    "a production naming no project has no owner to sign it");
});

/* ---- project-discoverable ---- */

test("R45 (project-discoverable) the machine credentials and an administrator are refused the setting", async () => {
  const w = await projectWorld();
  const refusedAsNotOwner = (by) => {
    const r = w.m.projectVisibilitySet({ projectId: "P", setting: "hidden", by, viewer: by.startsWith("class:") ? by : V(by) });
    assert.deepEqual([r.code, r.check, r.translation],
      ["PROJECT_VISIBILITY_NOT_THE_OWNER", "C-70.2", PROJECT_VISIBILITY_CHECKS.PROJECT_VISIBILITY_NOT_THE_OWNER.translation], by);
  };
  /* hidden P: the machine credentials see it whole and are refused as not its owner; an administrator not in it is at
     its EXISTENCE (D54, T41-3) and is refused there, C-70.1 */
  for (const by of [BEARER, `${MACHINE_CLASS_PREFIX}member`]) refusedAsNotOwner(by);
  for (const by of ["second", "admin"])
    assert.equal(w.m.projectVisibilitySet({ projectId: "P", setting: "discoverable", by, viewer: V(by) }).code,
      "PROJECT_SEEN_NOT_A_PARTICIPANT", by);
  assert.equal(w.m.projectVisibilitySet({ projectId: "P", setting: "discoverable", by: "iris", viewer: V("iris") }).ok, true);
  /* discoverable P: every one of them sees it whole, and the setting is still the owners' alone */
  for (const by of [BEARER, `${MACHINE_CLASS_PREFIX}member`, "second", "admin"]) refusedAsNotOwner(by);
});

/* ---- project-sight ---- */

/* Every membership op that names a project, asked by an outsider (cal) about a HIDDEN project, answers byte for byte
   what it answers about an id never minted: §7.9, "not its existence". */
/* T38 (N783): the owner votes, the setting's read, the roster read and the requests are project-roster's ops, held to
   the same rule by its own test (its R19). */
const PROJECT_OPS = [
  ["projectinvite", { handle: "cal" }], ["projectjoin", {}], ["projectleave", { comment: "x" }],
  ["projectremove", { handle: "iris" }], ["projectownerarith", {}], ["projectvisibilityset", { setting: "discoverable" }],
];
async function sightPair(minted) {
  const w = await world().group("iris", "cal");
  if (minted) {
    w.project("PROJ-X", "Secret X");
    w.m.projectClaimOwner({ projectId: "PROJ-X", memberId: "iris" });
  }
  return w;
}

test("R61 R78 R43 (project-sight) every project op answers a hidden project byte for byte as one never minted", async () => {
  const hidden = await sightPair(true);
  const absent = await sightPair(false);
  for (const [name, extra] of PROJECT_OPS) {
    const query = { projectId: "PROJ-X", by: "cal", viewer: V("cal"), ...extra };
    const a = JSON.stringify(await op(hidden, name, query));
    const b = JSON.stringify(await op(absent, name, query));
    assert.equal(a, b, name);
  }
  /* and nothing the hidden project holds was changed by them */
  assert.deepEqual(hidden.rows(`SELECT member_id, state, owner FROM project_participants`),
    [{ member_id: "iris", state: "joined", owner: 1 }]);
});

test("R43 R44 N426 (project-sight) a bundle in a hidden project reads as one never minted, to a sight read", async () => {
  const hidden = await sightPair(true);
  const absent = await sightPair(false);
  hidden.bundle("ESC-1", "escalation", "an escalation", "PROJ-X");
  for (const id of ["PROJ-X", "ESC-1"]) {
    assert.equal(hidden.m.sight(id, V("cal")), absent.m.sight(id, V("cal")), id);
    assert.equal(hidden.m.inSight(id, V("cal")), false, id);
    assert.equal(hidden.m.existenceAct(id, V("cal")), absent.m.existenceAct(id, V("cal")), id);
  }
  assert.equal(hidden.m.inSight("ESC-1", V("iris")), true, "its owner sees it");
});

