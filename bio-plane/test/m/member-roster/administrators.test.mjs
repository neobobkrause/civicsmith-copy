import { test } from "node:test";
import assert from "node:assert/strict";
import { world } from "./fixture.mjs";
import { Members } from "../../../src/member-roster/index.mjs";
import { MEMBER_ROSTER_ROWS } from "../../../src/member-roster/checks.mjs";
const { CUSTODIAL_CHECKS, MEMBERSHIP_CHECKS } = MEMBER_ROSTER_ROWS;

/* founder + second + third (a proposed third needs both to endorse) */
async function threeAdmins() {
  const w = await world().group();
  const p = await w.m.memberAdd({ memberId: "third", cover: "c3", role: "admin", by: "admin" });
  assert.equal(p.reason, "CONSENSUS_REQUIRED");
  const e = await w.m.adminEndorse({ memberId: "third", by: "second" });
  await w.m.enroll({ invite: e.invite, handle: "third", password: "third-passphrase-x" });
  return w;
}

test("R3 adminEndorse: refusals in order; consensus; the last endorsement invites once", async () => {
  const w = await world().group("ann");
  /* R6 (T38, K2276): NOT_AN_ADMIN first: a caller who may not act learns nothing of the target. */
  for (const by of ["ann", null, "nobody"])
    for (const target of ["nobody", "ann", "third"])
      assert.equal((await w.m.adminEndorse({ memberId: target, by })).reason, "NOT_AN_ADMIN", `${by} → ${target}`);
  assert.equal((await w.m.adminEndorse({ memberId: "nobody", by: "admin" })).reason, "NO_SUCH_MEMBER");
  assert.equal((await w.m.adminEndorse({ memberId: "ann", by: "admin" })).reason, "NOT_PROPOSED");
  const p = await w.m.memberAdd({ memberId: "third", cover: "c3", role: "admin", by: "admin" });
  assert.deepEqual([p.reason, p.have, p.awaiting], ["CONSENSUS_REQUIRED", ["admin"], ["second"]]);
  assert.equal((await w.m.adminEndorse({ memberId: "third", by: "ann" })).reason, "NOT_AN_ADMIN");
  assert.equal((await w.m.adminEndorse({ memberId: "third", by: null })).reason, "NOT_AN_ADMIN");
  const e = await w.m.adminEndorse({ memberId: "third", by: "second" });
  assert.equal(e.ok, true);
  assert.match(e.invite, /^[0-9a-f]{32}$/);
  assert.deepEqual(e.endorsedBy, ["admin", "second"]);
  const row = w.row(`SELECT status, status_by FROM members WHERE member_id='third'`);
  assert.deepEqual(row, { status: "invited", status_by: "second" });
  assert.equal((await w.m.adminEndorse({ memberId: "third", by: "admin" })).reason, "NOT_PROPOSED", "returned once");
  // the refusal while awaiting
  const q = await w.m.memberAdd({ memberId: "fourth", cover: "c4", role: "admin", by: "second" });
  const r = await w.m.adminEndorse({ memberId: "fourth", by: "second" });
  assert.deepEqual([q.have, r.reason, r.have, r.awaiting], [["second"], "CONSENSUS_REQUIRED", ["second"], ["admin"]]);
});

test("R4 adminRemove: every refusal, in order, and VOTES_SHORT until a majority of all", async () => {
  const w0 = await world().group("ann");
  const root = w0.m.adminRemove({ memberId: "admin", by: "second", reason: "r" });
  assert.equal(root.reason, "ROOT_OF_TRUST");
  assert.match(root.detail, /hosting account/);
  assert.equal(w0.m.adminRemove({ memberId: "nobody", by: "second", reason: "r" }).reason, "NO_SUCH_MEMBER");
  assert.equal(w0.m.adminRemove({ memberId: "ann", by: "second", reason: "r" }).reason, "TARGET_NOT_AN_ADMIN");
  assert.equal(w0.m.adminRemove({ memberId: "second", by: "second", reason: "r" }).reason, "TARGET_CANNOT_VOTE");
  assert.equal(w0.m.adminRemove({ memberId: "second", by: "ann", reason: "r" }).reason, "NOT_AN_ADMIN");
  /* R7 (T38, K2276): NOT_AN_ADMIN first: a caller who may not act learns nothing of the target, whoever it names. */
  for (const by of ["ann", null, "nobody"])
    for (const target of ["admin", "nobody", "ann", "second", by])
      assert.equal(w0.m.adminRemove({ memberId: target, by, reason: "r" }).reason, "NOT_AN_ADMIN", `${by} → ${target}`);
  assert.equal(w0.m.adminRemove({ memberId: "second", by: "admin", reason: " " }).reason, "NO_REASON");
  const two = w0.m.adminRemove({ memberId: "second", by: "admin", reason: "r" });
  assert.equal(two.reason, "IMPOSSIBLE_AT_TWO");
  assert.equal(two.possible, false);
  const w = await threeAdmins();
  const v1 = w.m.adminRemove({ memberId: "third", by: "admin", reason: "one" });
  assert.deepEqual([v1.reason, v1.have, v1.need, v1.deciders], ["VOTES_SHORT", 1, 2, ["admin"]]);
  assert.equal(w.m.adminRemove({ memberId: "third", by: "admin", reason: "again" }).reason, "ALREADY_VOTED");
  const v2 = w.m.adminRemove({ memberId: "third", by: "second", reason: "two" });
  assert.equal(v2.ok, true);
  assert.deepEqual(v2.deciders, ["admin", "second"]);
});

test("R5 a carried removal revokes, tells R25's listeners in the act (credentials ends sessions and keys), and keeps votes and reasons", async () => {
  const w = await threeAdmins();
  w.m.adminRemove({ memberId: "third", by: "admin", reason: "one" });
  assert.deepEqual(w.creds.revoked, [], "a vote that does not carry tells nobody");
  /* the listener reads the member's status inside the act: it is already revoked when it is told */
  let seen = null;
  w.m.onRevoked("capture-sources", ({ memberId }) => { seen = w.m.memberFacts(memberId).status; });
  const r = w.m.adminRemove({ memberId: "third", by: "second", reason: "two" });
  assert.deepEqual([r.ok, r.removed, r.reasons], [true, true, ["one", "two"]]);
  /* R8 (T47-82, P8): both halves named, rotating the root of trust and reviewing hosting access */
  assert.match(r.alsoDo, /rotating ADMIN_TOKEN/);
  assert.match(r.alsoDo, /reviewing hosting-account membership/);
  assert.deepEqual(w.row(`SELECT status, status_by FROM members WHERE member_id='third'`),
    { status: "revoked", status_by: "second" });
  assert.deepEqual(w.creds.revoked.map(({ memberId, by }) => [memberId, by]), [["third", "second"]],
    "credentials' listener is told once, naming the completing voter");
  assert.match(w.creds.revoked[0].at, /^\d{4}-\d\d-\d\dT/);
  assert.equal(seen, "revoked", "told after the act's writes");
  assert.equal(w.rows(`SELECT * FROM admin_votes WHERE kind='remove' AND target='third'`).length, 2);
});

test("R6 memberCaps: refusals in order and exact replacement", async () => {
  const w = await world().group("ann");
  assert.equal(w.m.memberCaps({ memberId: "nobody", capabilities: [], by: "ann" }).reason, "NOT_AN_ADMIN");
  assert.equal(w.m.memberCaps({ memberId: "nobody", capabilities: [], by: "admin" }).reason, "NO_SUCH_MEMBER");
  assert.equal(w.m.memberCaps({ memberId: "ann", capabilities: "publish", by: "admin" }).reason, "BAD_CAPABILITY");
  const bad = w.m.memberCaps({ memberId: "ann", capabilities: ["publish", "fly"], by: "admin" });
  assert.deepEqual([bad.reason, bad.got, bad.known], ["BAD_CAPABILITY", ["fly"], Members.CAPABILITIES]);
  assert.equal(w.m.memberCaps({ memberId: "ann", capabilities: ["administer"], by: "admin" }).reason, "NOT_A_CAPABILITY_GRANT");
  assert.equal(w.m.memberCaps({ memberId: "second", capabilities: ["publish"], by: "admin" }).reason, "NOT_A_CAPABILITY_GRANT");
  const ok = w.m.memberCaps({ memberId: "ann", capabilities: ["publish"], by: "second" });
  assert.deepEqual([ok.ok, ok.capabilities, ok.by], [true, ["publish"], "second"]);
  assert.deepEqual(w.m.memberList({}).members.find((x) => x.member_id === "ann").capabilities, ["publish"]);
});

test("R7 an administrator (not the founder) resigns unless they are the last one R29 lists; LAST_ADMIN (C-96.22) for the last; RESIGN_AT_TWO retired", async () => {
  const w = await threeAdmins();
  await w.enrol("ann");
  assert.equal(w.m.adminResign({ by: "admin" }).reason, "ROOT_OF_TRUST");
  assert.match(w.m.adminResign({ by: "admin" }).detail, /hosting account/);
  assert.equal(w.m.adminResign({ by: "ann" }).reason, "NOT_AN_ADMIN");
  const r = w.m.adminResign({ by: "third" });
  assert.deepEqual([r.ok, r.role, r.administrators], [true, "member", 2]);
  assert.deepEqual(w.row(`SELECT role, status, status_by, capabilities FROM members WHERE member_id='third'`),
    { role: "member", status: "active", status_by: "third", capabilities: JSON.stringify(["contribute"]) },
    "an ordinary member, keeping the capabilities last set");
  assert.equal(w.m.isAdministrator("third"), false);
  /* DEC-134 (4): at two (the founder and second) the second may step down: the founder is counted once claimed. */
  const two = w.m.adminResign({ by: "second" });
  assert.deepEqual([two.ok, two.administrators], [true, 1]);
  assert.equal(w.m.isAdministrator("second"), false);
  /* An unclaimed group with one administrator: the last one is refused, its row C-96.22. */
  const v = world({ omit: ["claimed"] });
  await v.enrol("solo", "admin", "class:admin");
  await v.enrol("bob", "member", "solo");
  const before = v.rows(`SELECT * FROM members ORDER BY member_id`);
  const last = v.m.adminResign({ by: "solo" });
  assert.deepEqual([last.ok, last.reason, last.code, last.check, last.translation, last.administrators],
    [false, "LAST_ADMIN", "LAST_ADMIN", "C-96.22", MEMBERSHIP_CHECKS.LAST_ADMIN.translation, 1]);
  assert.deepEqual(v.rows(`SELECT * FROM members ORDER BY member_id`), before, "nothing written");
  assert.equal(v.ops("by=solo").adminresign().reason, "LAST_ADMIN");
  /* retired, never reused */
  assert.equal("RESIGN_AT_TWO" in CUSTODIAL_CHECKS, false);
  assert.equal(Object.values({ ...CUSTODIAL_CHECKS, ...MEMBERSHIP_CHECKS }).some((x) => x.check === "C-96.10"), false);
  assert.equal(MEMBERSHIP_CHECKS.LAST_ADMIN.where, "src/member-roster/index.mjs adminResign > is-admin-resign-last");
});

test("R8 the hosting-access record is asked at setup, never on adding an administrator; the record keeps the answer", async () => {
  const w = world();
  await w.claim();
  const second = await w.m.memberAdd({ memberId: "second", cover: "c2", role: "admin", by: "admin" });
  assert.equal(second.ok, true);
  assert.equal("hostingAccess" in second, false, "no hosting-access question on adding the second administrator");
  await w.m.enroll({ invite: second.invite, handle: "second", password: "second-passphrase-x" });
  const ann = await w.m.memberAdd({ memberId: "ann", cover: "ca", by: "admin" });
  assert.equal("hostingAccess" in ann, false);
  for (const by of ["ann", null, "class:admin"])
    assert.equal(w.m.hostingAccessSet({ holders: "x", by }).reason, "NOT_AN_ADMIN", String(by));
  const none = w.m.hostingAccessSet({ holders: " ", by: "admin" });
  assert.deepEqual([none.ok, none.reason, none.code, none.check, none.translation],
    [false, "NO_HOLDERS", "NO_HOLDERS", "C-96.11", CUSTODIAL_CHECKS.NO_HOLDERS.translation]);
  assert.equal(w.m.hostingAccess().recorded, false, "nothing written");
  assert.deepEqual(w.m.hostingAccess().current, null);
  const s = w.m.hostingAccessSet({ holders: "admin and second", note: "both have the login", by: "second" });
  assert.deepEqual([s.ok, s.holders, s.note, s.recorded_by], [true, "admin and second", "both have the login", "second"]);
  assert.match(s.at, /^\d{4}-/);
  w.ops("by=admin", { holders: "admin only" }).hostingaccessset();
  const h = w.ops().hostingaccess();
  assert.deepEqual(Object.keys(h).sort(), ["current", "history", "limit", "ok", "recorded", "truncated"]);
  assert.equal(h.recorded, true);
  assert.equal(h.current.holders, "admin only");
  assert.deepEqual(h.history.map((x) => [x.holders, x.recorded_by]), [["admin and second", "second"], ["admin only", "admin"]]);
});

test("R16 memberSet: refusals in order; revocation tells R25's listeners (credentials ends sessions and keys); reactivating an admin demotes", async () => {
  const w = await threeAdmins();
  await w.enrol("ann");
  assert.equal(w.m.memberSet({ memberId: "ann", status: "revoked", by: "ann" }).reason, "NOT_AN_ADMIN");
  assert.equal(w.m.memberSet({ memberId: "ann", status: "gone", by: "admin" }).reason, "BAD_STATUS");
  assert.equal(w.m.memberSet({ memberId: "nobody", status: "revoked", by: "admin" }).reason, "NO_SUCH_MEMBER");
  assert.equal(w.m.memberSet({ memberId: "third", status: "revoked", by: "admin" }).reason, "ADMIN_REQUIRES_VOTE");
  assert.deepEqual(w.creds.revoked, [], "a refused act tells nobody");
  const r = w.m.memberSet({ memberId: "ann", status: "revoked", by: "second" });
  assert.deepEqual([r.ok, r.by], [true, "second"]);
  assert.deepEqual(w.creds.revoked.map(({ memberId, by }) => [memberId, by]), [["ann", "second"]],
    "credentials' listener is told once, naming the act's actor");
  assert.equal(w.m.sessionRights("member:ann").capabilities.length, 0, "and the member holds no rights at once (R92)");
  assert.equal(w.row(`SELECT status_by FROM members WHERE member_id='ann'`).status_by, "second");
  // a revoked administrator (by vote) reactivated returns as an ordinary member
  w.m.adminRemove({ memberId: "third", by: "admin", reason: "a" });
  w.m.adminRemove({ memberId: "third", by: "second", reason: "b" });
  const back = w.m.memberSet({ memberId: "third", status: "active", by: "admin" });
  assert.deepEqual([back.ok, back.demoted], [true, true]);
  assert.deepEqual(w.row(`SELECT role, status FROM members WHERE member_id='third'`), { role: "member", status: "active" });
});

test("R21 a member row is never deleted: revocation keeps the handle and history", async () => {
  const w = await world().group("ann");
  w.m.expertiseDeclare({ memberId: "ann", label: "CPA" });
  w.m.memberSet({ memberId: "ann", status: "revoked", by: "admin" });
  const row = w.row(`SELECT * FROM members WHERE member_id='ann'`);
  assert.deepEqual([row.status, row.handle, row.cover], ["revoked", "ann", "cover of ann"]);
  assert.equal(w.m.expertiseList({ memberId: "ann" }).expertise.length, 1);
  /* Every act that ends or changes a member's standing keeps every row: a carried removal by vote, a reactivation,
     a revocation, a resignation. (A removal from a project is `membership`'s act and its test.) */
  const v = await threeAdmins();
  await v.enrol("bob");
  await v.enrol("cal");
  const ids = () => v.rows(`SELECT member_id, handle FROM members ORDER BY member_id`);
  const before = ids();
  assert.equal(v.m.adminRemove({ memberId: "third", by: "admin", reason: "a" }).reason, "VOTES_SHORT");
  assert.equal(v.m.adminRemove({ memberId: "third", by: "second", reason: "b" }).ok, true);
  assert.equal(v.m.memberSet({ memberId: "third", status: "active", by: "admin" }).ok, true);
  assert.equal(v.m.memberSet({ memberId: "bob", status: "revoked", by: "admin" }).ok, true);
  assert.equal((await v.m.adminEndorse({ memberId: "cal", by: "admin" })).reason, "NOT_PROPOSED");
  assert.deepEqual(ids(), before, "no act removed a member row or its handle");
});

test("R22 every status write records the actor whose act caused it; an unstamped row reads not recorded", async () => {
  const w = world();
  await w.claim();
  const s = await w.m.memberAdd({ memberId: "second", cover: "c", role: "admin", by: "admin" });
  assert.equal(w.row(`SELECT status_by FROM members WHERE member_id='second'`).status_by, "admin");      // R13
  await w.m.enroll({ invite: s.invite, handle: "second", password: "second-passphrase-x" });
  assert.equal(w.row(`SELECT status_by FROM members WHERE member_id='second'`).status_by, "second");     // R16
  await w.m.memberAdd({ memberId: "ann", cover: "c", by: "second" });
  assert.equal(w.row(`SELECT status_by FROM members WHERE member_id='ann'`).status_by, "second");
  w.m.memberSet({ memberId: "ann", status: "revoked", by: "admin" });
  assert.equal(w.row(`SELECT status_by FROM members WHERE member_id='ann'`).status_by, "admin");         // R20
  w.sql.exec(`INSERT INTO members (member_id, cover, role, status, created, updated) VALUES ('old','c','member','active','t','t')`);
  const old = w.m.memberList({}).members.find((x) => x.member_id === "old");
  assert.deepEqual([old.status_by, old.invited_by], ["not recorded", "not recorded"]);
  assert.equal(w.row(`SELECT status_by FROM members WHERE member_id='old'`).status_by, null, "never back-filled");
});
