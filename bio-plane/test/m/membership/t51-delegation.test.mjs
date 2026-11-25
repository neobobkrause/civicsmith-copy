/* T51 (CR-4; K624, K3946; split map §4): R154, each name whose requirement moved to `member-roster` answers what
   `member-roster` answers. At the interface, over one store: the delegate and the module behind it, the re-exports, the
   unioned row tables, the ops map. Each with its controls. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V } from "./fixture.mjs";
import * as membership from "../../../src/membership/index.mjs";
import { Membership, membershipOps, MEMBERSHIP_CHECKS, MEMBER_ID_CHECKS, CUSTODIAL_CHECKS } from "../../../src/membership/index.mjs";
import * as roster from "../../../src/member-roster/index.mjs";
import { MEMBER_ROSTER_ROWS } from "../../../src/member-roster/checks.mjs";

/* The moved instance names: every public method of `Members` bar the migration, the finding membership registers, and
   `expertiseHolders`, which `checkAddressees` (R106) asks and which no user called before. */
const MOVED = Object.getOwnPropertyNames(roster.Members.prototype)
  .filter((n) => n !== "constructor" && n !== "migrate" && n !== "reservedIdFinding" && n !== "expertiseHolders");

test("R154 every public name of member-roster's Members is a delegate of the same name on Membership (none is left out), and Membership keeps only its own beside them", () => {
  assert.ok(MOVED.length >= 45, String(MOVED.length));
  for (const name of MOVED) assert.equal(typeof Membership.prototype[name], "function", name);
  /* control: the delegates are Membership's own functions, not the module's, and a name that was never moved is not one */
  assert.notEqual(Membership.prototype.isAdministrator, roster.Members.prototype.isAdministrator);
  /* the three names member-roster R77–R79 added at T51 (K4169, K4204) are delegates too, not borrowed */
  for (const name of ["endorsementsOwed", "expertiseAwaitingConfirmation", "expertiseWithdraw"]) {
    assert.ok(MOVED.includes(name), `${name} is a public name of Members`);
    assert.notEqual(Membership.prototype[name], roster.Members.prototype[name], name);
  }
  assert.equal(MOVED.includes("viewerGate"), false);
  assert.equal(typeof Membership.prototype.viewerGate, "function");
});

test("R154 over one store a delegate answers what member-roster answers: reads equal, and a write through the delegate is read back by the module", async () => {
  const w = await world().group("ann", "bob");
  const m = w.m, r = w.m.members;
  assert.ok(r instanceof roster.Members);
  const reads = [
    ["isAdministrator", ["admin"]], ["isAdministrator", ["ann"]], ["isAdministrator", [null]], ["activeAdmins", []],
    ["memberFacts", ["ann"]], ["memberFacts", ["nobody"]], ["memberStatusSince", ["ann"]], ["memberByHandle", ["bob"]],
    ["sessionRights", ["admin"]], ["sessionRights", ["member:ann"]], ["sessionRights", ["member:nobody"]],
    ["adminArithmetic", []], ["adminRemovalsOpen", [{ by: "admin" }]], ["adminRemovalsOpen", [{ by: "ann" }]],
    ["hostingAccess", [{}]], ["memberPairings", [{ viewer: V("ann") }]], ["expertiseList", [{ memberId: "ann" }]],
    ["courtNotice", []], ["founderHandle", []], ["lookedAt", [{ by: "ann" }]], ["groupDescription", [{ viewer: V("ann") }]],
    ["joinDoors", [{ by: "admin" }]], ["joinDoors", [{ by: "ann" }]], ["handleChange", [{ handle: "x" }]],
    ["endorsementsOwed", [{ by: "admin" }]], ["endorsementsOwed", [{ by: "ann" }]],
    ["expertiseAwaitingConfirmation", [{ by: "admin" }]], ["expertiseAwaitingConfirmation", [{ by: "ann" }]],
  ];
  for (const [name, args] of reads) assert.deepEqual(m[name](...args), r[name](...args), `${name} ${JSON.stringify(args)}`);
  /* writes through the delegate land in the module's tables */
  assert.equal(m.hostingAccessSet({ holders: "ann", by: "admin" }).ok, true);
  assert.equal(r.hostingAccess({}).current.holders, "ann");
  assert.equal((await m.expertiseDeclare({ memberId: "ann", label: "CPA" })).ok, true);
  assert.equal(r.expertiseList({ memberId: "ann" }).expertise[0].state, "declared");
  assert.deepEqual(m.expertiseAwaitingConfirmation({ by: "admin" }).map((x) => [x.memberId, x.label]), [["ann", "CPA"]]);
  /* R79: withdrawing a confirmed label through the delegate lands in the module's tables, and its refusal is the module's */
  assert.equal(m.expertiseWithdraw({ memberId: "ann", label: "CPA", reason: "x", by: "admin" }).reason, "NOT_CONFIRMED");
  assert.equal((await m.expertiseConfirm({ memberId: "ann", label: "CPA", by: "admin" })).ok, true);
  assert.equal(m.expertiseWithdraw({ memberId: "ann", label: "CPA", reason: "lapsed", by: "admin" }).state, "withdrawn");
  assert.equal(r.expertiseList({ memberId: "ann" }).expertise[0].state, "withdrawn");
  assert.deepEqual(m.expertiseAwaitingConfirmation({ by: "admin" }), []);
  assert.deepEqual(await m.handleCheck({ viewer: V("ann"), handle: "bob" }), await r.handleCheck({ viewer: V("ann"), handle: "bob" }));
  /* registrations are the module's: a second claim source is refused by the module's own slot */
  assert.equal(m.registerClaimed("x", () => true).code, "LISTENER_DECLARED");
  assert.equal(m.onRevoked("credentials", () => {}).code, "LISTENER_DECLARED");
  /* control: a refusal is the module's byte for byte */
  assert.deepEqual(m.memberCaps({ memberId: "ann", capabilities: [], by: "bob" }), r.memberCaps({ memberId: "ann", capabilities: [], by: "bob" }));
  assert.equal(m.memberCaps({ memberId: "ann", capabilities: [], by: "bob" }).code, "NOT_AN_ADMIN");
});

test("R154 the roster passes membership's own projects (R18): an administrator's rows carry them, a member's roster none, and the module alone gives []", async () => {
  const w = await world().group("ann");
  w.project("PROJ-F");
  w.m.projectClaimOwner({ projectId: "PROJ-F", memberId: "ann" });
  w.m.projectVisibilitySet({ projectId: "PROJ-F", setting: "discoverable", by: "ann", viewer: V("ann") });
  const ann = (list) => list.members.find((x) => x.member_id === "ann");
  assert.deepEqual(ann(w.m.memberList({ administer: true, viewer: "admin" })).projects, [{ project: "PROJ-F", state: "joined", owner: true }]);
  assert.equal("projects" in ann(w.m.memberList({ administer: false, viewer: "admin" })), false);
  assert.deepEqual(ann(w.m.members.memberList({ administer: true, viewer: "admin" })).projects, []);
});

test("R154 the moved module-level names and statics are the module's own, and a user's import still resolves", () => {
  for (const name of ["listenerRefusal", "notAnAdmin", "noSuchMember", "MODULE_ORDER", "moduleOrderFrom"])
    assert.strictEqual(membership[name], roster[name], name);
  assert.strictEqual(Membership.ROOT_ADMIN, roster.ROOT_ADMIN);
  assert.strictEqual(Membership.CAPABILITIES, roster.CAPABILITIES);
  assert.deepEqual(Membership.adminMath(5), roster.adminMath(5));
  for (const name of ["HANDLE_CHECK_STATED", "DOOR_WARNING", "COURT_STATEMENT", "HANDLE_PATTERN", "GROUP_KINDS", "JOIN_DOORS_LIMIT"])
    assert.strictEqual(Membership[name], roster.Members[name], name);
  /* control: what stays here is not borrowed */
  assert.equal("viewerPredicate" in roster, false);
  assert.equal(typeof membership.viewerPredicate, "function");
});

test("R154 the row tables are the union of membership's rows and member-roster's, every code one row, none minted at two sites (K231)", () => {
  for (const [name, table] of [["MEMBERSHIP_CHECKS", MEMBERSHIP_CHECKS], ["MEMBER_ID_CHECKS", MEMBER_ID_CHECKS], ["CUSTODIAL_CHECKS", CUSTODIAL_CHECKS]])
    for (const [code, row] of Object.entries(MEMBER_ROSTER_ROWS[name])) assert.deepEqual(table[code], row, `${name}.${code}`);
  assert.ok(Object.isFrozen(MEMBERSHIP_CHECKS));
  for (const code of ["NO_SUCH_PROJECT", "NOT_A_PARTICIPANT", "TARGET_NOT_A_PARTICIPANT", "LAST_COMMITTED_OWNER", "PROJECT_GUARD_UNCHECKED"])
    assert.ok(code in MEMBERSHIP_CHECKS, code);
  /* no code in two of the exported tables */
  const seen = new Map();
  for (const [name, table] of Object.entries(membership).filter(([n]) => /_CHECKS$/.test(n)))
    for (const code of Object.keys(table)) { assert.equal(seen.has(code), false, `${code} in ${name} and ${seen.get(code)}`); seen.set(code, name); }
  /* every code the module-level refusals mint answers with the one row */
  for (const r of [membership.notAnAdmin("x", "an act"), membership.noSuchMember("x"), membership.listenerRefusal([], "", () => {})])
    assert.deepEqual([r.check, r.translation], [MEMBERSHIP_CHECKS[r.code].check, MEMBERSHIP_CHECKS[r.code].translation]);
  /* control: member-roster exports no *_CHECKS table of its own (its rows reach the census only through here) */
  assert.deepEqual(Object.keys(roster).filter((n) => /_CHECKS$/.test(n)), []);
});

test("R154 membershipOps answers member-roster's ops beside its own, adminremovalsopen included, memberlist with the projects", async () => {
  const w = await world().group("ann");
  const ops = w.ops("by=admin&administer=1&viewer=admin");
  const rosterOps = roster.membersOps(w.m, new URL("http://x/?by=admin"), null, {});
  for (const name of Object.keys(rosterOps)) assert.equal(typeof ops[name], "function", name);
  for (const name of ["projectinvite", "projectjoin", "projectleave", "projectremove", "projectvisibilityset",
                      "projectclaimowner", "projectownerarith", "checkaddressees"])
    assert.equal(typeof ops[name], "function", name);
  assert.deepEqual(await ops.adminremovalsopen(), { ok: true, removals: [] });
  assert.equal((await w.ops("by=ann").adminremovalsopen()).code, "NOT_AN_ADMIN");
  assert.ok(Array.isArray((await ops.memberlist()).members[1].projects));
  /* control: no op is answered by two maps with different functions */
  assert.deepEqual(Object.keys(ops).filter((k) => !(k in rosterOps) && /^(member|admin|join|website|court|group|hosting|expertise|enroll|invite|looked|founder|handle)/.test(k)), []);
});

test("R154 R106 R76 checkAddressees asks member-roster's expertiseHolders and applies sight; positionalMember reads member-roster's spelling", async () => {
  const w = await world().group("ann", "bob");
  await w.m.expertiseDeclare({ memberId: "ann", label: "CPA" });
  await w.m.expertiseDeclare({ memberId: "bob", label: "CPA" });
  w.bundle("INFO-1");
  assert.deepEqual(w.m.checkAddressees({ target: "INFO-1", label: "CPA" }).map((x) => x.memberId), ["ann", "bob"]);
  assert.deepEqual(w.m.checkAddressees({ target: "INFO-1", label: "CPA" }), w.m.members.expertiseHolders("CPA"));
  assert.equal(w.m.checkAddressees({ target: "INFO-1", label: " " }).code, "EXPERTISE_NO_LABEL");
  assert.deepEqual(w.m.checkAddressees({ target: "NOBODY", label: "CPA" }), []);
  for (const [viewer, identity] of [["member:ann", null], ["member:admin", null], ["admin", null], ["junk", "member:bob"], ["member:ann@p1", null], ["class:probe", null]])
    assert.equal(w.m.positionalMember(viewer, identity), roster.viewerMember(viewer, identity), `${viewer} ${identity}`);
});
