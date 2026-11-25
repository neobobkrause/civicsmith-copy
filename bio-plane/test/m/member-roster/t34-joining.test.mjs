/* T34 (T34-10; DEC-133, DEC-134, Bob's; K1745): invitations that expire and are withdrawn (R33, R34), the group's two
   doors, the website key and the join link (R35–R41), R10's invitation with its expiry and door, R28's new callers,
   and R46's exemption and hashing. (The ids in the comments below are `membership`'s earlier ones.) At the interface only: the services, the ops map, and the store read as tables. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { word, localize } from "../../../src/setup-words/index.mjs";
import { world, snapshot, actOf } from "./fixture.mjs";
import { Members, notAnAdmin, MEMBER_EXEMPT_TABLES, MEMBER_DECLARED_TABLES } from "../../../src/member-roster/index.mjs";
import { MEMBER_ROSTER_ROWS } from "../../../src/member-roster/checks.mjs";
const { CUSTODIAL_CHECKS, MEMBERSHIP_CHECKS } = MEMBER_ROSTER_ROWS;
import { MACHINE_CLASS_PREFIX } from "../../../src/record-grammar/index.mjs";

const DAY = 86_400_000;
const WARNING = word("membership.door_warning");   /* R151: the words are the key's, never held here */
const rowOf = (r, code) => {
  const row = MEMBERSHIP_CHECKS[code];
  assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation], [false, code, code, row.check, row.translation], code);
  assert.match(r.detail, /\S/);
};
const roster = (w, id) => w.m.memberList({ administer: true }).members.find((m) => m.member_id === id);
const BAD_DAYS = [0, 31, -1, 1.5, "7", "", NaN, Infinity, true, [7], {}];

/* ---- R97, R13: expiry ---- */

test("R33 R10 an invitation expires 7 whole days after it is made when not chosen, else the 1-30 days chosen; anything else BAD_EXPIRY (C-96.23)", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-06T12:00:00.000Z") });
  const w = await world().group();
  const a = await w.m.memberAdd({ memberId: "ann", cover: "c", by: "admin" });
  assert.equal(a.expires, "2026-10-13T12:00:00.000Z");
  for (const days of [1, 30, 12]) {
    const r = await w.m.memberAdd({ memberId: `d${days}`, cover: "c", expiresInDays: days, by: "admin" });
    assert.equal(r.expires, new Date(Date.parse("2026-10-06T12:00:00.000Z") + days * DAY).toISOString(), String(days));
  }
  for (const v of BAD_DAYS) {
    const before = snapshot(w);
    const r = await w.m.memberAdd({ memberId: "bad", cover: "c", expiresInDays: v, by: "admin" });
    rowOf(r, "BAD_EXPIRY");
    assert.equal(snapshot(w), before, `${JSON.stringify(v)}: nothing written`);
  }
  assert.equal(MEMBERSHIP_CHECKS.BAD_EXPIRY.check, "C-96.23");
  /* the same rule at the doors (R99, R102) and their changes (R100, R103) */
  for (const v of BAD_DAYS) {
    rowOf(w.m.websiteKeyCreate({ dailyCap: 5, expiresInDays: v, by: "admin" }), "BAD_EXPIRY");
    rowOf(w.m.joinLinkEnable({ dailyCap: 5, expiresInDays: v, by: "admin" }), "BAD_EXPIRY");
  }
});

test("R33 R12 R13 an expired invitation answers byte for byte as a spent one, is never revived, and leaves the member invited", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-06T12:00:00.000Z") });
  const w = await world().group("taken");
  const a = await w.m.memberAdd({ memberId: "ann", cover: "c", expiresInDays: 2, by: "admin" });
  const b = await w.m.memberAdd({ memberId: "bob", cover: "c", by: "admin" });
  await w.m.enroll({ invite: b.invite, handle: "bob", password: "bob-passphrase-x" });
  const spentLook = await w.m.inviteLook({ invite: b.invite });
  const spentEnrol = await w.m.enroll({ invite: b.invite, handle: "bob2", password: "x".repeat(12) });
  t.mock.timers.tick(2 * DAY - 1);
  assert.equal((await w.m.inviteLook({ invite: a.invite })).ok, true, "live until its moment");
  t.mock.timers.tick(1);
  assert.deepEqual(await w.m.inviteLook({ invite: a.invite }), spentLook);
  assert.deepEqual(await w.m.enroll({ invite: a.invite, handle: "ann", password: "x".repeat(12) }), spentEnrol);
  assert.equal(spentLook.reason, "NO_SUCH_INVITATION");
  t.mock.timers.tick(100 * DAY);
  assert.deepEqual(await w.m.inviteLook({ invite: a.invite }), spentLook, "never revived");
  assert.equal(w.m.memberFacts("ann").status, "invited", "the member stays invited");
  assert.equal(roster(w, "ann").invitation, "expired");
  /* an invitation made before invitations expired (no expiry held) still works as it was made */
  w.sql.exec(`UPDATE members SET invite_expires=NULL WHERE member_id='ann'`);
  assert.equal((await w.m.inviteLook({ invite: a.invite })).ok, true);
});

test("R10 an ordinary member with one administrator, or an administrator below two, is invited: door administrator, the invitation with its expires once", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-06T12:00:00.000Z") });
  const w = world();
  await w.claim();
  const a = await w.m.memberAdd({ memberId: "ann", cover: "c", capabilities: ["publish", "fly"], expiresInDays: 3, by: "admin" });
  assert.deepEqual([a.ok, a.role, a.capabilities, a.invited_by, a.expires], [true, "member", ["publish"], "admin",
    "2026-10-09T12:00:00.000Z"]);
  assert.match(a.invite, /^[0-9a-f]{32}$/);
  assert.deepEqual(Object.keys(a).sort(), ["capabilities", "expires", "invite", "invited_by", "memberId", "ok", "role"]);
  const s = await w.m.memberAdd({ memberId: "second", cover: "c", role: "admin", by: "admin" });
  assert.deepEqual([s.ok, s.role], [true, "admin"], "an administrator while fewer than two exist");
  const d = await w.m.memberAdd({ memberId: "dee", cover: "c", by: "admin" });
  assert.deepEqual(d.capabilities, ["contribute"], "the default set");
  for (const id of ["ann", "second", "dee"]) {
    const r = roster(w, id);
    assert.deepEqual([r.status, r.invited_by, r.status_by, r.door, r.approvedBy, r.invitation], ["invited", "admin", "admin",
      "administrator", null, "live"], id);
  }
  assert.equal(roster(w, "ann").expires, a.expires);
  assert.doesNotMatch(JSON.stringify(w.rows(`SELECT * FROM members`)), new RegExp(a.invite), "only the hash is kept");
  assert.doesNotMatch(JSON.stringify(w.m.memberList({ administer: true })), new RegExp(a.invite), "never again");
});

test("R3 R33 the endorsement's invitation expires after the days chosen at memberAdd, or 7", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-06T12:00:00.000Z") });
  const w = await world().group();
  rowOf(await w.m.memberAdd({ memberId: "third", cover: "c", role: "admin", expiresInDays: 99, by: "admin" }), "BAD_EXPIRY");
  assert.equal((await w.m.memberAdd({ memberId: "third", cover: "c", role: "admin", expiresInDays: 4, by: "admin" })).reason,
    "CONSENSUS_REQUIRED");
  assert.equal((await w.m.memberAdd({ memberId: "fourth", cover: "c", role: "admin", by: "admin" })).reason, "CONSENSUS_REQUIRED");
  const r = roster(w, "third");
  assert.deepEqual([r.status, r.invitation, r.expires], ["proposed", null, null], "a proposal holds no invitation yet");
  t.mock.timers.tick(DAY);
  const e = await w.m.adminEndorse({ memberId: "third", by: "second" });
  assert.equal(e.expires, "2026-10-11T12:00:00.000Z", "4 days from the endorsement that made it");
  const f = await w.m.adminEndorse({ memberId: "fourth", by: "second" });
  assert.equal(f.expires, "2026-10-14T12:00:00.000Z", "7 by default");
  assert.equal(roster(w, "third").invitation, "live");
});

test("R9 R10 R11 DEC-134: with one administrator, ordinary members are invited from the start, and a second administrator is still added alone", async () => {
  const w = world();
  await w.claim();
  assert.deepEqual(w.m.activeAdmins(), ["admin"]);
  for (const id of ["ann", "bob"]) assert.equal((await w.enrol(id)).ok, true, id);
  assert.equal((await w.enrol("second", "admin")).ok, true, "the sole administrator adds a second alone");
  const p = await w.m.memberAdd({ memberId: "third", cover: "c", role: "admin", by: "admin" });
  assert.deepEqual([p.reason, p.awaiting], ["CONSENSUS_REQUIRED", ["second"]], "beyond two, consensus as before (DEC-134 (5))");
  const ops = await w.ops("by=admin", { memberId: "cal", cover: "c" }).memberadd();
  assert.equal(ops.ok, true);
});

/* ---- R98 ---- */

test("R34 inviteWithdraw: NOT_AN_ADMIN (R28), NO_SUCH_MEMBER, NO_UNUSED_INVITATION (C-96.24); a live or expired invitation dies at once, the member revoked, R25 told", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-06T12:00:00.000Z") });
  const w = await world().group("ann");
  const live = await w.m.memberAdd({ memberId: "liv", cover: "c", by: "admin" });
  const old = await w.m.memberAdd({ memberId: "old", cover: "c", expiresInDays: 1, by: "admin" });
  await w.m.memberAdd({ memberId: "prop", cover: "c", role: "admin", by: "admin" });
  t.mock.timers.tick(2 * DAY);
  for (const by of ["ann", null, "ghost", `${MACHINE_CLASS_PREFIX}admin`]) {
    const before = snapshot(w);
    assert.deepEqual(w.m.inviteWithdraw({ memberId: "liv", by }), notAnAdmin(by, localize("member-roster.index.withdrawing_an_invitation", "withdrawing an invitation")), String(by));
    assert.equal(snapshot(w), before);
  }
  assert.equal(w.m.inviteWithdraw({ memberId: "nobody", by: "admin" }).reason, "NO_SUCH_MEMBER");
  for (const id of ["ann", "prop"]) {
    const before = snapshot(w);
    rowOf(w.m.inviteWithdraw({ memberId: id, by: "second" }), "NO_UNUSED_INVITATION");
    assert.equal(snapshot(w), before, `${id}: nothing written`);
  }
  for (const [id, inv] of [["liv", live.invite], ["old", old.invite]]) {
    const r = w.m.inviteWithdraw({ memberId: id, by: "second" });
    assert.deepEqual([r.ok, r.status, r.invitation, r.by], [true, "revoked", "withdrawn", "second"], id);
    assert.equal((await w.m.inviteLook({ invite: inv })).reason, "NO_SUCH_INVITATION");
    assert.deepEqual(w.row(`SELECT status, status_by FROM members WHERE member_id=?`, id), { status: "revoked", status_by: "second" });
    assert.equal(roster(w, id).invitation, "withdrawn");
    rowOf(w.m.inviteWithdraw({ memberId: id, by: "admin" }), "NO_UNUSED_INVITATION");
  }
  assert.deepEqual(w.creds.revoked.map((n) => [n.memberId, n.by]), [["liv", "second"], ["old", "second"]]);
  t.mock.timers.setTime(Date.parse("2026-10-06T12:00:00.000Z"));
  assert.equal((await w.m.inviteLook({ invite: live.invite })).reason, "NO_SUCH_INVITATION", "dead, not merely expired");
  /* whatever door made it (R105) */
  const k = w.m.websiteKeyCreate({ dailyCap: 3, by: "admin" });
  const wi = await w.m.websiteInvite({ key: k.key, cover: "web" });
  const id = w.m.memberList({ administer: true }).members.find((m) => m.door === "website").member_id;
  assert.equal(w.ops("by=admin", { memberId: id }).invitewithdraw().ok, true);
  assert.equal((await w.m.inviteLook({ invite: wi.invite })).ok, false);
});

/* ---- R99, R100: the website key ---- */

test("R35 websiteKeyCreate: refusals in order; one live key; the key once, hashed; capabilities, cap and days; the warning exactly", async () => {
  const w = await world().group("ann");
  for (const by of ["ann", null, `${MACHINE_CLASS_PREFIX}admin`])
    assert.deepEqual(w.m.websiteKeyCreate({ dailyCap: 5, by }), notAnAdmin(by, localize("member-roster.index.creating_the_teams_website_key", "creating the team's website key")));
  const caps = (c) => w.m.websiteKeyCreate({ capabilities: c, dailyCap: 5, by: "admin" });
  assert.deepEqual([caps("publish").reason, caps("publish").detail], ["BAD_CAPABILITY", localize("member-roster.index.capabilities_is_an_array", "capabilities is an array")]);
  const fly = caps(["publish", "fly", "administer"]);
  assert.deepEqual([fly.reason, fly.got, fly.known], ["BAD_CAPABILITY", ["fly", "administer"], Members.CAPABILITIES]);
  for (const cap of [undefined, null, 0, -1, 1.5, "5", true])
    rowOf(w.m.websiteKeyCreate({ dailyCap: cap, by: "admin" }), "BAD_DAILY_CAP");
  assert.equal(w.rows(`SELECT * FROM join_doors`).length, 0, "nothing written by a refusal");
  const k = w.m.websiteKeyCreate({ dailyCap: 5, by: "second" });
  assert.deepEqual(Object.keys(k).sort(), ["capabilities", "dailyCap", "expiresInDays", "key", "keyId", "ok", "warning"]);
  assert.deepEqual([k.ok, k.capabilities, k.dailyCap, k.expiresInDays, k.warning], [true, ["contribute"], 5, 7, WARNING]);
  assert.match(k.key, /^[0-9a-f]{64}$/);
  rowOf(w.m.websiteKeyCreate({ dailyCap: 5, by: "admin" }), "WEBSITE_KEY_EXISTS");
  rowOf(w.m.websiteKeyCreate({ capabilities: "x", dailyCap: 0, by: "admin" }), "WEBSITE_KEY_EXISTS");
  const log = w.rows(`SELECT door, event, set_by, at FROM join_doors`);
  assert.deepEqual(log.map((r) => [r.door, r.event, r.set_by]), [["website", "create", "second"]]);
  assert.match(log[0].at, /^\d{4}-/);
  assert.doesNotMatch(snapshot(w), new RegExp(k.key), "only its hash is held");
  w.m.websiteKeyRevoke({ by: "admin" });
  const k2 = w.ops("by=admin", { capabilities: ["publish", "contribute", "publish"], dailyCap: 2, expiresInDays: 30 }).websitekeycreate();
  assert.deepEqual([k2.ok, k2.capabilities, k2.dailyCap, k2.expiresInDays], [true, ["publish", "contribute"], 2, 30]);
  assert.notEqual(k2.key, k.key);
  assert.notEqual(k2.keyId, k.keyId);
});

test("R36 websiteKeySet and websiteKeyRevoke: refusals; each setting judged as R35, kept when not given; revocation kills the key at once and keeps its invitations; every act appended", async () => {
  const w = await world().group("ann");
  for (const [fn, act] of [["websiteKeySet", localize("member-roster.index.changing_the_teams_website_key", "changing the team's website key")], ["websiteKeyRevoke", localize("member-roster.index.switching_off_the_teams_website_key", "switching off the team's website key")]]) {
    assert.deepEqual(w.m[fn]({ dailyCap: 2, by: "ann" }), notAnAdmin("ann", act));
    rowOf(w.m[fn]({ dailyCap: 2, by: "admin" }), "NO_WEBSITE_KEY");
  }
  const k = w.m.websiteKeyCreate({ capabilities: ["publish"], dailyCap: 5, expiresInDays: 3, by: "admin" });
  assert.equal(w.m.websiteKeySet({ capabilities: ["fly"], by: "admin" }).reason, "BAD_CAPABILITY");
  rowOf(w.m.websiteKeySet({ dailyCap: 0, by: "admin" }), "BAD_DAILY_CAP");
  rowOf(w.m.websiteKeySet({ expiresInDays: 31, by: "admin" }), "BAD_EXPIRY");
  const unchanged = w.m.websiteKeySet({ by: "admin" });
  assert.deepEqual([unchanged.capabilities, unchanged.dailyCap, unchanged.expiresInDays, unchanged.keyId], [["publish"], 5, 3, k.keyId]);
  assert.equal("key" in unchanged, false, "the key is never answered again");
  const s = w.m.websiteKeySet({ dailyCap: 9, by: "second" });
  assert.deepEqual([s.capabilities, s.dailyCap, s.expiresInDays], [["publish"], 9, 3]);
  const s2 = w.ops("by=admin", { capabilities: ["contribute"], expiresInDays: 10 }).websitekeyset();
  assert.deepEqual([s2.capabilities, s2.dailyCap, s2.expiresInDays], [["contribute"], 9, 10]);
  const made = await w.m.websiteInvite({ key: k.key, cover: "before" });
  assert.equal(made.ok, true, "the key still opens after its changes");
  const r = w.m.websiteKeyRevoke({ by: "second" });
  assert.deepEqual([r.ok, r.revoked, r.keyId], [true, true, k.keyId]);
  rowOf(await w.m.websiteInvite({ key: k.key, cover: "after" }), "WEBSITE_KEY_UNKNOWN");
  rowOf(w.m.websiteKeyRevoke({ by: "admin" }), "NO_WEBSITE_KEY");
  assert.equal((await w.m.inviteLook({ invite: made.invite })).ok, true, "its invitations stay as they are");
  assert.deepEqual(w.rows(`SELECT event, set_by, daily_cap FROM join_doors ORDER BY seq`).map((x) => [x.event, x.set_by, x.daily_cap]),
    [["create", "admin", 5], ["set", "admin", 5], ["set", "second", 9], ["set", "admin", 9], ["revoke", "second", 9]],
    "every act appended, none overwritten (refusals write nothing)");
});

/* ---- R101 ---- */

test("R37 websiteInvite: WEBSITE_KEY_UNKNOWN alike for never made, revoked and malformed; NO_COVER; the daily cap over the last 24 hours; an ordinary member, never the member id", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-06T12:00:00.000Z") });
  const w = await world().group();
  const k = w.m.websiteKeyCreate({ capabilities: ["publish"], dailyCap: 2, expiresInDays: 5, by: "admin" });
  const unknown = [];
  for (const key of ["0".repeat(64), "f".repeat(64), undefined, null, "", "short", k.key.toUpperCase(), 42, {}, `${k.key}0`])
    unknown.push(JSON.stringify(await w.m.websiteInvite({ key, cover: "x" })));
  w.m.websiteKeyRevoke({ by: "admin" });
  unknown.push(JSON.stringify(await w.m.websiteInvite({ key: k.key, cover: "x" })));
  assert.equal(new Set(unknown).size, 1, "one answer for each");
  rowOf(JSON.parse(unknown[0]), "WEBSITE_KEY_UNKNOWN");
  const key = w.m.websiteKeyCreate({ capabilities: ["publish"], dailyCap: 2, expiresInDays: 5, by: "admin" });
  for (const cover of [undefined, "", "   ", 7]) {
    const r = await w.m.websiteInvite({ key: key.key, cover });
    assert.deepEqual([r.reason, r.check, r.translation], ["NO_COVER", "C-96.3", CUSTODIAL_CHECKS.NO_COVER.translation]);
  }
  const a = await w.m.websiteInvite({ key: key.key, cover: "Rosa from the form", approvedBy: `  ${"q".repeat(200)}  ` });
  assert.deepEqual(Object.keys(a).sort(), ["expires", "invite", "ok"], "never the member id");
  assert.equal(a.expires, "2026-10-11T12:00:00.000Z");
  const b = await w.ops("", { key: key.key, cover: "Sam" }).websiteinvite();
  assert.equal(b.ok, true);
  const before = snapshot(w);
  const cap = await w.m.websiteInvite({ key: key.key, cover: "third" });
  rowOf(cap, "WEBSITE_DAILY_CAP");
  assert.equal(cap.dailyCap, 2);
  assert.equal(snapshot(w), before);
  t.mock.timers.tick(DAY);
  assert.equal((await w.m.websiteInvite({ key: key.key, cover: "next day" })).ok, true, "24 hours on, the cap has room");
  const rows = w.m.memberList({ administer: true }).members.filter((m) => m.door === "website");
  assert.equal(rows.length, 3);
  for (const r of rows) {
    assert.match(r.member_id, /^[a-z0-9][a-z0-9-]{1,40}$/);
    assert.notEqual(r.member_id, "admin");
    assert.deepEqual([r.role, r.status, r.invited_by, r.status_by, r.capabilities],
      ["member", "invited", `website:${key.keyId}`, `website:${key.keyId}`, ["publish"]]);
  }
  assert.deepEqual(rows.map((r) => String(r.approvedBy)).sort(), ["null", "null", "q".repeat(120)]);
  assert.ok(!rows.some((r) => r.member_id.includes("rosa") || r.member_id.includes("sam")), "not derived from the request");
  const look = await w.m.inviteLook({ invite: a.invite });
  assert.deepEqual([look.cover, look.role, look.capabilities], ["Rosa from the form", "member", ["publish"]]);
  assert.equal((await w.m.enroll({ invite: a.invite, handle: "rosa", password: "rosa-passphrase-x" })).ok, true, "enrolment is R16's");
});

/* ---- R102, R103, R104: the join link ---- */

test("R38 joinLinkEnable: refusals in order; off until enabled, one live link; the link once, hashed; the warning", async () => {
  const w = await world().group("ann");
  assert.deepEqual(w.m.joinLinkEnable({ dailyCap: 5, by: "ann" }), notAnAdmin("ann", localize("member-roster.index.switching_on_the_teams_join_link", "switching on the team's join link")));
  rowOf(await w.m.joinLinkInvite({ link: "a".repeat(64), cover: "x" }), "NO_SUCH_JOIN_LINK");
  assert.equal(w.m.joinLinkEnable({ capabilities: ["administer"], dailyCap: 5, by: "admin" }).reason, "BAD_CAPABILITY");
  rowOf(w.m.joinLinkEnable({ by: "admin" }), "BAD_DAILY_CAP");
  rowOf(w.m.joinLinkEnable({ dailyCap: 5, expiresInDays: 0, by: "admin" }), "BAD_EXPIRY");
  assert.equal(w.rows(`SELECT * FROM join_doors`).length, 0);
  const l = w.m.joinLinkEnable({ dailyCap: 5, by: "admin" });
  assert.deepEqual([l.ok, l.capabilities, l.dailyCap, l.expiresInDays, l.warning], [true, ["contribute"], 5, 7, WARNING]);
  assert.match(l.link, /^[0-9a-f]{64}$/);
  rowOf(w.m.joinLinkEnable({ dailyCap: 5, by: "admin" }), "JOIN_LINK_ON");
  assert.doesNotMatch(snapshot(w), new RegExp(l.link));
  /* the two doors are apart: a link is no website key, nor the other way */
  rowOf(await w.m.websiteInvite({ key: l.link, cover: "x" }), "WEBSITE_KEY_UNKNOWN");
  const k = w.m.websiteKeyCreate({ dailyCap: 5, by: "admin" });
  rowOf(await w.m.joinLinkInvite({ link: k.key, cover: "x" }), "NO_SUCH_JOIN_LINK");
});

test("R39 joinLinkSet, joinLinkReplace, joinLinkOff: refusals; settings kept on replacement; the old link dead at once; every act appended", async () => {
  const w = await world().group("ann");
  for (const [fn, act] of [["joinLinkSet", localize("member-roster.index.changing_the_teams_join_link", "changing the team's join link")], ["joinLinkReplace", localize("member-roster.index.replacing_the_teams_join_link", "replacing the team's join link")],
                           ["joinLinkOff", localize("member-roster.index.switching_off_the_teams_join_link", "switching off the team's join link")]]) {
    assert.deepEqual(w.m[fn]({ by: "ann" }), notAnAdmin("ann", act));
    rowOf(w.m[fn]({ dailyCap: 3, by: "admin" }), "JOIN_LINK_OFF");
  }
  const l = w.m.joinLinkEnable({ capabilities: ["publish"], dailyCap: 5, by: "admin" });
  rowOf(w.m.joinLinkSet({ dailyCap: -2, by: "admin" }), "BAD_DAILY_CAP");
  const s = w.m.joinLinkSet({ expiresInDays: 14, by: "second" });
  assert.deepEqual([s.capabilities, s.dailyCap, s.expiresInDays, s.linkId], [["publish"], 5, 14, l.linkId]);
  const r = w.ops("by=admin").joinlinkreplace();
  assert.deepEqual([r.ok, r.replaced, r.capabilities, r.dailyCap, r.expiresInDays], [true, l.linkId, ["publish"], 5, 14]);
  assert.match(r.link, /^[0-9a-f]{64}$/);
  assert.notEqual(r.link, l.link);
  rowOf(await w.m.joinLinkInvite({ link: l.link, cover: "x" }), "NO_SUCH_JOIN_LINK");
  assert.equal((await w.m.joinLinkInvite({ link: r.link, cover: "x" })).ok, true);
  const off = w.m.joinLinkOff({ by: "second" });
  assert.deepEqual([off.ok, off.off, off.linkId], [true, true, r.linkId]);
  rowOf(await w.m.joinLinkInvite({ link: r.link, cover: "y" }), "NO_SUCH_JOIN_LINK");
  rowOf(w.m.joinLinkOff({ by: "admin" }), "JOIN_LINK_OFF");
  assert.deepEqual(w.rows(`SELECT door, event, set_by FROM join_doors ORDER BY seq`).map((x) => [x.door, x.event, x.set_by]),
    [["join link", "enable", "admin"], ["join link", "set", "second"], ["join link", "replace", "admin"], ["join link", "off", "second"]]);
  const again = w.m.joinLinkEnable({ dailyCap: 1, by: "admin" });
  assert.equal(again.ok, true, "switched on again, a new link");
  rowOf(await w.m.joinLinkInvite({ link: r.link, cover: "y" }), "NO_SUCH_JOIN_LINK");
});

test("R40 joinLinkInvite: NO_SUCH_JOIN_LINK alike for never made, replaced, off and malformed; NO_COVER; the daily cap; door join link, no approver, {invite, expires} once", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-06T12:00:00.000Z") });
  const w = await world().group();
  const l = w.m.joinLinkEnable({ dailyCap: 1, expiresInDays: 2, by: "admin" });
  const replaced = w.m.joinLinkReplace({ by: "admin" });
  const answers = [];
  for (const link of ["0".repeat(64), l.link, "nope", null, undefined, 3]) answers.push(JSON.stringify(await w.m.joinLinkInvite({ link, cover: "x" })));
  const second = w.m.joinLinkEnable({ dailyCap: 1, by: "admin" });   // refused: one is live
  assert.equal(second.reason, "JOIN_LINK_ON");
  /* T47-82 (P8): a link switched off answers alike too (the title's "off"), on a group of its own, so the live link
     below stays live. */
  const w2 = await world().group();
  const switched = w2.m.joinLinkEnable({ dailyCap: 1, by: "admin" });
  assert.equal(w2.m.joinLinkOff({ by: "admin" }).ok, true);
  answers.push(JSON.stringify(await w2.m.joinLinkInvite({ link: switched.link, cover: "x" })));
  assert.equal(answers.length, 7);
  assert.equal(new Set(answers).size, 1);
  rowOf(JSON.parse(answers[0]), "NO_SUCH_JOIN_LINK");
  assert.equal((await w.m.joinLinkInvite({ link: replaced.link, cover: " " })).reason, "NO_COVER");
  const a = await w.ops("", { link: replaced.link, cover: "Night owl", approvedBy: "ignored" }).joinlinkinvite();
  assert.deepEqual(Object.keys(a).sort(), ["expires", "invite", "ok"]);
  assert.equal(a.expires, "2026-10-08T12:00:00.000Z");
  const cap = await w.m.joinLinkInvite({ link: replaced.link, cover: "second today" });
  rowOf(cap, "JOIN_LINK_DAILY_CAP");
  assert.equal(cap.dailyCap, 1);
  const r = w.m.memberList({ administer: true }).members.find((m) => m.door === "join link");
  assert.deepEqual([r.role, r.status, r.invited_by, r.status_by, r.approvedBy, r.invitation, r.expires],
    ["member", "invited", `join-link:${replaced.linkId}`, `join-link:${replaced.linkId}`, null, "live", a.expires]);
  t.mock.timers.tick(DAY);
  assert.equal((await w.m.joinLinkInvite({ link: replaced.link, cover: "tomorrow" })).ok, true);
  const e = await w.m.enroll({ invite: a.invite, handle: "owl", password: "owl-passphrase-xx" });
  assert.equal(e.ok, true, "enrolment is R16's");
  assert.equal(roster(w, r.member_id).invitation, "spent");
});

/* ---- R105 ---- */

test("R41 a door's member is always an ordinary member, never proposed, its actors the door's; the roster's door, approver, expires and state are an administrator's only", async () => {
  const w = await world().group("ann");
  const k = w.m.websiteKeyCreate({ capabilities: ["publish", "create_projects"], dailyCap: 9, by: "admin" });
  const l = w.m.joinLinkEnable({ dailyCap: 9, by: "admin" });
  const viaKey = await w.m.websiteInvite({ key: k.key, cover: "k1", approvedBy: "Pat" });
  await w.m.joinLinkInvite({ link: l.link, cover: "l1", role: "admin" });
  const rows = w.m.memberList({ administer: true }).members;
  const doorRows = rows.filter((m) => m.founder !== true && m.door !== "administrator");   /* R147: the founder's row has no door */
  assert.equal(doorRows.length, 2);
  for (const r of doorRows) {
    assert.deepEqual([r.role, r.status], ["member", "invited"]);
    assert.ok(/^(website|join-link):[0-9a-f]+$/.test(r.invited_by) && r.status_by === r.invited_by, r.invited_by);
    assert.equal(w.m.isAdministrator(r.member_id), false);
    assert.equal(w.m.memberFacts(r.member_id).role, "member");
  }
  assert.deepEqual(doorRows.map((r) => [r.door, r.approvedBy]).sort(), [["join link", null], ["website", "Pat"]]);
  /* an administrator's roster: every row carries the four; the founder's enrolled members are 'administrator', spent */
  for (const r of rows.filter((m) => m.founder !== true))
    for (const f of ["door", "approvedBy", "expires", "invitation"]) assert.ok(f in r, `${r.member_id} ${f}`);
  /* R147: the founder's row holds no door and no invitation (she holds none) */
  for (const f of ["door", "approvedBy", "expires", "invitation"]) assert.equal(f in rows.find((m) => m.founder === true), false, f);
  assert.deepEqual([roster(w, "ann").door, roster(w, "ann").invitation], ["administrator", "spent"]);
  /* a member's roster carries none of them */
  for (const administer of [undefined, false, "0"])
    for (const r of w.m.memberList({ administer }).members)
      for (const f of ["door", "approvedBy", "expires", "invitation"]) assert.equal(f in r, false, `${f} for administer=${administer}`);
  /* an invitation reaches the person only through the answer to its caller: nothing is stored to be sent */
  assert.doesNotMatch(snapshot(w), new RegExp(viaKey.invite));
  assert.equal(w.rows(`SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '%mail%' OR name LIKE '%outbox%' OR name LIKE '%message%')`).length, 0);
  /* a revoked-before-enrolment member reads withdrawn */
  w.m.memberSet({ memberId: doorRows[0].member_id, status: "revoked", by: "admin" });
  assert.equal(roster(w, doorRows[0].member_id).invitation, "withdrawn");
});

/* ---- R84 ---- */

test("R28 T34: each new administrator's act refuses a non-administrator through notAnAdmin, byte for byte, its own fixed act, writing nothing", async () => {
  const w = await world().group("ann");
  await w.m.memberAdd({ memberId: "inv", cover: "c", by: "admin" });
  const acts = {
    R34: (by) => w.m.inviteWithdraw({ memberId: "inv", by }),
    R35: (by) => w.m.websiteKeyCreate({ dailyCap: 1, by }),
    R36: (by) => w.m.websiteKeySet({ dailyCap: 1, by }),
    R36b: (by) => w.m.websiteKeyRevoke({ by }),
    R38: (by) => w.m.joinLinkEnable({ dailyCap: 1, by }),
    R39: (by) => w.m.joinLinkSet({ dailyCap: 1, by }),
    R39b: (by) => w.m.joinLinkReplace({ by }),
    R39c: (by) => w.m.joinLinkOff({ by }),
    R42: (by) => w.m.courtNoticeSet({ choice: "tell", by }),
    R44: (by) => w.m.groupDescriptionSet({ kinds: [], by }),
  };
  const phrases = new Set();
  for (const [id, run] of Object.entries(acts)) {
    const seen = new Set();
    for (const by of ["ann", "ghost", null, `${MACHINE_CLASS_PREFIX}admin`]) {
      const before = snapshot(w);
      const r = run(by);
      assert.deepEqual([r.ok, r.reason, r.code, r.check, r.by], [false, "NOT_AN_ADMIN", "NOT_AN_ADMIN", "C-96.1", by ?? null], `${id} ${by}`);
      const act = actOf(r.detail);
      assert.deepEqual(r, notAnAdmin(by, act), `${id} ${by}: notAnAdmin's answer`);
      assert.equal(snapshot(w), before, `${id} ${by}: nothing written`);
      seen.add(act);
    }
    assert.equal(seen.size, 1, id);
    phrases.add([...seen][0]);
  }
  assert.equal(phrases.size, Object.keys(acts).length, "each act names itself");
});

/* ---- R111 ---- */

test("R46 the doors, the description and the court-notice setting are exempt from purge, the doors' hashes never exported; a copy of the store holds no usable key, link or invitation", async () => {
  /* R46, R55, R66: the tables this module declares to record-core's purge and export are its own exports (the
     composition declares them): exempt from purge, and `join_doors` (the hashes) never exported. */
  for (const t of ["join_doors", "group_description", "court_notice"]) assert.ok(MEMBER_EXEMPT_TABLES.includes(t), t);
  const doors = MEMBER_DECLARED_TABLES.find((d) => d.name === "join_doors");
  assert.deepEqual([doors.purge, doors.export, doors.sight], ["exempt", "never", "group"]);
  const w = await world().group();
  const k = w.m.websiteKeyCreate({ dailyCap: 3, by: "admin" });
  const l = w.m.joinLinkEnable({ dailyCap: 3, by: "admin" });
  const inv = await w.m.websiteInvite({ key: k.key, cover: "c" });
  const add = await w.m.memberAdd({ memberId: "ann", cover: "c", by: "admin" });
  w.m.courtNoticeSet({ choice: "tell", by: "admin" });
  w.m.groupDescriptionSet({ kinds: ["issue"], focus: "the 72 bus", by: "admin" });
  assert.equal(w.m.courtNotice().choice, "tell");
  const dump = JSON.stringify(w.db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all()
    .map(({ name }) => w.db.prepare(`SELECT * FROM "${name}"`).all()));
  for (const secret of [k.key, l.link, inv.invite, add.invite]) assert.equal(dump.includes(secret), false, "no secret in the copy");
});
