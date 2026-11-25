/* T35 (T35-14; DEC-149, Bob's "S4: B"; K1779, K1785, K1934) and T50 (R151; N1116, DEC-257, DEC-258): the words members read
   (R112) and R108's statement, now read by key through `setup-words`: the sweep's rows are each named by their key and
   reached at the interface, with no sentence's English held here (R151); then every row this module holds, and every
   refusal a battery of its acts answers, is held to the vocabulary rule: never "copy", "instance", "plane" or "server" for
   the team's Civicsmith. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world } from "./fixture.mjs";
import { Members, listenerRefusal, notAnAdmin, noSuchMember } from "../../../src/member-roster/index.mjs";
import { MEMBER_ROSTER_ROWS } from "../../../src/member-roster/checks.mjs";
const { MEMBERSHIP_CHECKS, MEMBER_ID_CHECKS, CUSTODIAL_CHECKS } = MEMBER_ROSTER_ROWS;
import { word, localize, WORD_ROWS } from "../../../src/setup-words/index.mjs";

/* A key's words as a row carries them: the list's English, placeholders left in place for the screen. */
const raw = (key) => WORD_ROWS.find((r) => r[0] === key)[1];

const FORBIDDEN = /\b(cop(y|ies)|instances?|planes?|servers?)\b/i;
/* T47-82 (P8): every `*_CHECKS` table the module holds, found from its checks file (R68's census), so a later
   table is held too. */
const TABLES = Object.fromEntries(Object.entries(MEMBER_ROSTER_ROWS));

/* The member-facing strings of one answer (R112's list): its row's translation, its detail, message and remedy, and
   R108's statement. Codes, field names and ids are not member-facing. */
const facing = (r) => ["translation", "detail", "message", "remedy", "courtStatement", "alsoDo", "warning"]
  .filter((k) => r && typeof r[k] === "string").map((k) => [k, r[k]]);
const clean = (r, label) => {
  for (const [k, s] of facing(r)) assert.doesNotMatch(s, FORBIDDEN, `${label}: ${k} names the group's Civicsmith otherwise`);
};

test("R65 R70 the sweep's rows C-102.11 and C-102.12 read refusal.LISTENER_MALFORMED and refusal.LISTENER_DECLARED by key", () => {
  const malformed = listenerRefusal([], "", null);
  assert.equal(malformed.check, "C-102.11");
  assert.equal(malformed.translation, word("refusal.LISTENER_MALFORMED"));
  const declared = listenerRefusal([{ module: "credentials" }], "credentials", () => {});
  assert.equal(declared.check, "C-102.12");
  assert.equal(declared.translation, word("refusal.LISTENER_DECLARED"));
  /* the same rows answer this module's own registrations (R79, R94, R95) */
  const w = world();
  assert.equal(w.m.registerClaimed("other", () => true).translation, declared.translation);
  assert.equal(w.m.onRevoked("x", null).translation, malformed.translation);
});

test("R65 R70 the sweep's rows C-55.1 and index.mjs:2323: the reserved id `admin` reads refusal.MEMBER_ID_RESERVED by key", async () => {
  const w = await world().group();
  const r = await w.m.memberAdd({ memberId: "admin", cover: "c", by: "admin" });
  assert.deepEqual([r.reason, r.check], ["MEMBER_ID_RESERVED", "C-55.1"]);
  assert.equal(r.translation, word("refusal.MEMBER_ID_RESERVED"));
  assert.match(r.detail, /^'admin' names the founding administrator of your team's Civicsmith/);
});

test("R65 R70 the sweep's row C-96.11: no holders reads refusal.NO_HOLDERS by key", async () => {
  const w = await world().group();
  const r = w.m.hostingAccessSet({ holders: "  ", by: "admin" });
  assert.deepEqual([r.reason, r.check], ["NO_HOLDERS", "C-96.11"]);
  assert.equal(r.translation, word("refusal.NO_HOLDERS"));
});

test("R65 the sweep's row index.mjs:139: the detail of NOT_AN_ADMIN names the act and says who is asking is read from the signed-in session, at every act that refuses it", async () => {
  const sentence = (act) => localize("membership.index.what_is_an_administrators_act", "{what} is an administrator's act (Membership Architecture v2 §4.9), and your team's Civicsmith takes who is asking from the signed-in session rather than from the caller. This caller is not one of the active administrators. Nothing was changed.", { what: act });
  assert.equal(notAnAdmin("ann", "doing the thing").detail, sentence("doing the thing"));
  const w = await world().group("ann");
  assert.equal(w.m.hostingAccessSet({ holders: "x", by: "ann" }).detail,
    sentence(localize("member-roster.index.recording_who_holds_hosting_access", "recording who holds hosting access (4.8)")));
  const caps = w.m.memberCaps({ memberId: "ann", capabilities: [], by: "ann" });
  assert.equal(caps.detail, sentence(localize("membership.index.setting_a_members_capabilities", "setting a member's capabilities")));
});

test("R65 the sweep's row index.mjs:2246: the founder is not removed, because your team's Civicsmith runs in somebody's hosting account", async () => {
  const w = await world().group();
  const r = w.m.adminRemove({ memberId: "admin", by: "second", reason: "r" });
  assert.equal(r.reason, "ROOT_OF_TRUST");
  assert.match(r.detail, /because your team's Civicsmith runs in somebody's hosting account\./);
});

test("R65 R43 R70 the court statement is `court.statement`, read by key", async () => {
  const COURT = word("court.statement");
  assert.equal(Members.COURT_STATEMENT, COURT);
  const w = await world().group();
  w.m.courtNoticeSet({ choice: "tell", by: "admin" });
  const a = await w.m.memberAdd({ memberId: "ann", cover: "c", by: "admin" });
  const e = await w.m.enroll({ invite: a.invite, handle: "ann", password: "ann-passphrase-x" });
  assert.equal(e.courtStatement, COURT);
  assert.doesNotMatch(e.courtStatement, /\bcopy\b/i);
});

test("R65 every row this module holds translates without calling the group's Civicsmith a copy, an instance, a plane or a server", () => {
  let n = 0;
  for (const [table, rows] of Object.entries(TABLES))
    for (const [code, row] of Object.entries(rows)) {
      n++;
      assert.equal(typeof row.translation, "string", `${table}.${code}`);
      assert.doesNotMatch(row.translation, FORBIDDEN, `${table}.${code} (${row.check})`);
    }
  /* T47-82 (P8): exactly the rows held: the member rows of `membership`'s 47 (T51-145 split the project rows off: 27 +
     1 + 8 here); a row added or dropped is a change this test is re-pinned for, never passed by a lower bound. */
  assert.deepEqual(Object.keys(TABLES).sort(), ["CUSTODIAL_CHECKS", "MEMBERSHIP_CHECKS", "MEMBER_ID_CHECKS"]);
  assert.equal(n, 36, `every row read (${n})`);
  /* the rows the sweep moved read their keys (R151) */
  for (const [code, row] of [["LISTENER_MALFORMED", MEMBERSHIP_CHECKS.LISTENER_MALFORMED],
                             ["LISTENER_DECLARED", MEMBERSHIP_CHECKS.LISTENER_DECLARED],
                             ["MEMBER_ID_RESERVED", MEMBER_ID_CHECKS.MEMBER_ID_RESERVED],
                             ["NO_HOLDERS", CUSTODIAL_CHECKS.NO_HOLDERS]])
    assert.equal(row.translation, raw(`refusal.${code}`), row.check);
});

test("R65 every refusal and answer a battery of this module's acts gives (detail, message, remedy, translation, the statement) is held to the rule", async () => {
  const w = await world().group("ann", "bob", "cal");
  w.m.courtNoticeSet({ choice: "tell", by: "admin" });
  const answers = [
    ["listenerRefusal malformed", listenerRefusal(null, "", 1)],
    ["listenerRefusal declared", listenerRefusal({ module: "a" }, "b", () => {})],
    ["listenerRefusal unreadable", listenerRefusal(new Proxy([], { get() { throw new Error("unreadable"); } }), "m",
                                                   () => {})],
    ["notAnAdmin remedy", notAnAdmin("ann", "x", { remedy: "Ask an administrator." })],
    ["adminResign founder", w.m.adminResign({ by: "admin" })],
    ["adminResign member", w.m.adminResign({ by: "ann" })],
    ["adminRemove founder", w.m.adminRemove({ memberId: "admin", by: "second", reason: "r" })],
    ["adminRemove target", w.m.adminRemove({ memberId: "ann", by: "second", reason: "r" })],
    ["adminRemove self", w.m.adminRemove({ memberId: "second", by: "second", reason: "r" })],
    ["adminRemove at two", w.m.adminRemove({ memberId: "second", by: "admin", reason: "r" })],
    ["adminRemove no reason", w.m.adminRemove({ memberId: "second", by: "admin", reason: "" })],
    ["memberAdd bad id", await w.m.memberAdd({ memberId: "A", cover: "c", by: "admin" })],
    ["memberAdd reserved", await w.m.memberAdd({ memberId: "admin", cover: "c", by: "admin" })],
    ["memberAdd no cover", await w.m.memberAdd({ memberId: "zed", by: "admin" })],
    ["memberAdd exists", await w.m.memberAdd({ memberId: "ann", cover: "c", by: "admin" })],
    ["memberAdd expertise", await w.m.memberAdd({ memberId: "zed", cover: "c", expertise: ["CPA"], by: "admin" })],
    ["memberAdd expiry", await w.m.memberAdd({ memberId: "zed", cover: "c", expiresInDays: 99, by: "admin" })],
    ["memberAdd not admin", await w.m.memberAdd({ memberId: "zed", cover: "c", by: "ann" })],
    ["memberAdd consensus", await w.m.memberAdd({ memberId: "adm3", cover: "c", role: "admin", by: "admin" })],
    ["memberSet vote", w.m.memberSet({ memberId: "second", status: "revoked", by: "admin" })],
    ["memberCaps grant", w.m.memberCaps({ memberId: "second", capabilities: ["publish"], by: "admin" })],
    ["adminEndorse not proposed", await w.m.adminEndorse({ memberId: "ann", by: "admin" })],
    ["hostingAccessSet empty", w.m.hostingAccessSet({ holders: "", by: "admin" })],
    ["memberPairingSet", w.m.memberPairingSet({ memberId: "ann", published: true, by: "bob" })],
    ["enroll miss", await w.m.enroll({ invite: "0".repeat(32), handle: "h", password: "p".repeat(12) })],
    ["inviteLook miss", await w.m.inviteLook({ invite: "nope" })],
    ["expertiseDeclare no label", w.m.expertiseDeclare({ memberId: "ann", label: " " })],
    ["expertiseConfirm not declared", w.m.expertiseConfirm({ memberId: "ann", label: "CPA", by: "admin" })],
    ["expertiseConfirm not admin", w.m.expertiseConfirm({ memberId: "ann", label: "CPA", by: "bob" })],
    ["expertiseHolders no label", w.m.expertiseHolders(" ")],
    ["inviteWithdraw unused", w.m.inviteWithdraw({ memberId: "ann", by: "admin" })],
    ["websiteKeyCreate cap", w.m.websiteKeyCreate({ by: "admin" })],
    ["websiteKeySet none", w.m.websiteKeySet({ dailyCap: 3, by: "admin" })],
    ["websiteKeyCreate ok", w.m.websiteKeyCreate({ dailyCap: 1, by: "admin" })],
    ["websiteKeyCreate exists", w.m.websiteKeyCreate({ dailyCap: 1, by: "admin" })],
    ["websiteInvite unknown", await w.m.websiteInvite({ key: "k", cover: "c" })],
    ["joinLinkSet off", w.m.joinLinkSet({ dailyCap: 1, by: "admin" })],
    ["joinLinkEnable bad caps", w.m.joinLinkEnable({ capabilities: ["administer"], dailyCap: 1, by: "admin" })],
    ["joinLinkInvite unknown", await w.m.joinLinkInvite({ link: "l", cover: "c" })],
    ["courtNoticeSet unknown", w.m.courtNoticeSet({ choice: "maybe", by: "admin" })],
    ["groupDescriptionSet kind", w.m.groupDescriptionSet({ kinds: ["club"], by: "admin" })],
    ["groupDescriptionSet other", w.m.groupDescriptionSet({ kinds: ["other"], by: "admin" })],
    ["groupDescriptionSet long", w.m.groupDescriptionSet({ kinds: [], focus: "x".repeat(1001), by: "admin" })],
    ["groupDescriptionSet visibility", w.m.groupDescriptionSet({ kinds: [], visibility: "all", by: "admin" })],
    /* T47-82 (P8): the refusals the battery had left out */
    ["handleChange fixed", w.m.handleChange({ handle: "ann-2", by: "ann" })],
    ["noSuchMember", noSuchMember("nobody")],
    ["joinDoors not admin", w.m.joinDoors({ by: "bob" })],
  ];
  /* the doors' daily caps; the website key's warning is on "websiteKeyCreate ok" above */
  const key = w.m.websiteKeyCreate({ dailyCap: 1, by: "admin" });
  answers.push(["websiteKeyCreate again", key]);
  const link = w.m.joinLinkEnable({ dailyCap: 1, by: "admin" });
  answers.push(["joinLinkEnable", link], ["joinLinkEnable on", w.m.joinLinkEnable({ dailyCap: 1, by: "admin" })]);
  answers.push(["joinLinkInvite", await w.m.joinLinkInvite({ link: link.link, cover: "c" })],
               ["joinLinkInvite cap", await w.m.joinLinkInvite({ link: link.link, cover: "c" })]);
  const invited = await w.m.memberAdd({ memberId: "dee", cover: "c", by: "admin" });
  answers.push(["enroll told", await w.m.enroll({ invite: invited.invite, handle: "dee", password: "dee-passphrase-x" })]);
  /* the enrolment whose password is not recorded (C-96.18) */
  const bare = world({ omit: ["setter"] });
  await bare.claim();
  const lone = await bare.m.memberAdd({ memberId: "eve", cover: "c", by: "admin" });
  answers.push(["enroll not recorded", await bare.m.enroll({ invite: lone.invite, handle: "eve",
                                                             password: "eve-passphrase-x" })]);
  let refusals = 0, texts = 0;
  for (const [label, r] of answers) {
    assert.ok(r && typeof r === "object", label);
    if (r.ok === false) refusals++;
    texts += facing(r).length;
    clean(r, label);
  }
  /* T38 (N783): the moved acts' refusals are project-roster's battery now. T47-82 (P8): exact, not lower bounds. */
  assert.deepEqual([answers.length, refusals, texts], [54, 50, 95],
    `the battery reached ${answers.length} answers, ${refusals} refusals and ${texts} texts`);
});
