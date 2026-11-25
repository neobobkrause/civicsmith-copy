/* T50 (T50-2; N1116; K3366, K3368; DEC-257, DEC-258; `setup-words` R11–R13): R151, words by key. The module holds no
   member-facing English: every sentence it answers is `setup-words`' `word(key, vars)`, and no test here holds a sentence's
   English. Each key it reads is asserted with `hasWord`; over fixtures, what it answers for a sample of its keys equals
   `word(key, vars)`; the keys are the `reads` list for it in `words-reads.json`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { world, V } from "./fixture.mjs";
import * as membership from "../../../src/membership/index.mjs";
import { Membership, WORD_KEYS, MEMBERSHIP_CHECKS, CUSTODIAL_CHECKS, MEMBER_ID_CHECKS, PROJECT_AUTHORITY_CHECKS,
         PROJECT_VISIBILITY_CHECKS, CASE_AUTHORITY_CHECKS, notAnAdmin, notTheOwner, noSuchMember, listenerRefusal }
  from "../../../src/membership/index.mjs";
import { word, hasWord, WORD_ROWS } from "../../../src/setup-words/index.mjs";
import { SENTENCE_KEYS } from "../../../src/membership/words.mjs";
import { WORD_KEYS as MEMBER_WORD_KEYS } from "../../../src/member-roster/index.mjs";
import { rowKey, rowWord, keyed } from "../../../src/member-roster/words.mjs";

/* the keys held across the two modules: membership reads its own, member-roster its (DEC-345) */
const HELD = [...WORD_KEYS, ...MEMBER_WORD_KEYS];
const TABLES = Object.fromEntries(Object.entries(membership).filter(([name]) => /_CHECKS$/.test(name)));
/* a key's words as the list gives them, placeholders in place */
const raw = (key) => WORD_ROWS.find((r) => r[0] === key)[1];
const reads = async () => JSON.parse(await readFile(
  new URL("../../../../docs/development/ux-substrate/screens/words-reads.json", import.meta.url), "utf8")).modules.membership;

test("R151 every key the module reads is held by setup-words (hasWord), each once; none is empty", () => {
  assert.ok(Object.isFrozen(WORD_KEYS));
  assert.equal(new Set(WORD_KEYS).size, WORD_KEYS.length, "no key twice");
  assert.ok(new Set(HELD).size >= 60, String(new Set(HELD).size));
  for (const key of WORD_KEYS) {
    assert.equal(hasWord(key), true, key);
    assert.match(word(key, Object.fromEntries((raw(key).match(/\{(\w+)\}/g) ?? []).map((p) => [p.slice(1, -1), "x"]))), /\S/, key);
  }
  /* control: a key the list lacks is not held, and word() refuses it */
  assert.equal(hasWord("refusal.NO_SUCH_CODE_AT_ALL"), false);
  assert.throws(() => word("refusal.NO_SUCH_CODE_AT_ALL"), /UNKNOWN_WORD/);
});

test("R151 the keys it reads are the `reads` list for it in words-reads.json (DEC-258), less the three the screens read, handle.changeable, handle.formerly and handle.fixed, which no answer here carries", async () => {
  const { reads: list, note } = await reads();
  const screens = ["handle.changeable", "handle.fixed", "handle.formerly"];
  assert.deepEqual([...WORD_KEYS].sort(), list.filter((k) => !screens.includes(k)).sort());
  for (const key of screens) assert.equal(WORD_KEYS.includes(key), false, `${key} is the screens' own`);
  /* every key the list names is held by setup-words */
  for (const key of list) assert.equal(hasWord(key), true, key);
  /* the three whose existing words govern (the list's note) are read as the key gives them */
  for (const code of ["CONSENSUS_REQUIRED", "NO_COVER", "PROJECT_VISIBILITY_NOT_THE_OWNER"]) {
    assert.match(note, new RegExp(`refusal\\.${code}`), code);
    const row = Object.values(TABLES).map((t) => t[code]).find(Boolean);
    assert.equal(row.translation, raw(`refusal.${code}`), `${code}: the key's words govern`);
  }
});

test("R151 every refusal row's translation is the words of its key (refusal.<CODE>, or the key words.mjs names), placeholders left for the screen; every code has a key", () => {
  let n = 0;
  for (const [table, rows] of Object.entries(TABLES))
    for (const [code, row] of Object.entries(rows)) {
      n++;
      const key = rowKey(code);
      assert.equal(hasWord(key), true, `${table}.${code}: ${key}`);
      assert.equal(row.translation, raw(key), `${table}.${code}`);
      assert.equal(row.translation, rowWord(code));
      assert.ok(HELD.includes(key), key);
    }
  assert.equal(n, 47, "every row read");
  assert.deepEqual([rowKey("HANDLE_CHECK_PAUSED"), rowKey("NOT_AN_ADMIN")], ["handle.refused.paused", "refusal.NOT_AN_ADMIN"]);
  /* a placeholder is left in place when the answer carries the value for the screen to fill */
  assert.match(MEMBERSHIP_CHECKS.HANDLE_CHECK_PAUSED.translation, /\{minutes\}/);
  assert.match(CUSTODIAL_CHECKS.CONSENSUS_REQUIRED.translation, /\{awaiting\}/);
  /* control: keyed() fills exactly the names asked, and word() refuses a placeholder without its value */
  assert.equal(keyed("handle.refused.paused", ["minutes"]), raw("handle.refused.paused"));
  assert.throws(() => word("handle.refused.paused"), /WORD_VAR_MISSING/);
  assert.equal(word("handle.refused.paused", { minutes: 4 }), raw("handle.refused.paused").replace("{minutes}", "4"));
});

test("R151 over fixtures, what the module answers equals word(key, vars): the refusals at their sites, the notices, the remedies, the owner arithmetic and the handle check's words", async () => {
  const w = await world().group("ann");
  /* a refusal at its site carries its row's words */
  const refused = [
    [notAnAdmin("ann", "x"), "NOT_AN_ADMIN"], [noSuchMember("nobody"), "NO_SUCH_MEMBER"],
    [notTheOwner("ann", "P"), "PROJECT_ACT_NOT_THE_OWNER"], [listenerRefusal([], "", null), "LISTENER_MALFORMED"],
    [w.m.hostingAccessSet({ holders: " ", by: "admin" }), "NO_HOLDERS"],
    [await w.m.memberAdd({ memberId: "A", cover: "c", by: "admin" }), "BAD_MEMBER_ID"],
    [await w.m.memberAdd({ memberId: "zed", by: "admin" }), "NO_COVER"],
    [w.m.websiteKeySet({ dailyCap: 1, by: "admin" }), "NO_WEBSITE_KEY"],
    [w.m.groupDescriptionSet({ kinds: ["club"], by: "admin" }), "GROUP_KIND_UNKNOWN"],
    [(() => {   /* the only administrator R86 lists: an unclaimed group with one active administrator */
      const solo = world();
      solo.sql.exec(`INSERT INTO members (member_id, cover, role, status, created, updated) VALUES ('solo','c','admin','active','t','t')`);
      return solo.m.adminResign({ by: "solo" });
    })(), "LAST_ADMIN"],
  ];
  for (const [r, code] of refused) {
    assert.equal(r.code ?? r.reason, code);
    assert.equal(r.translation, word(`refusal.${code}`, Object.fromEntries((raw(`refusal.${code}`).match(/\{(\w+)\}/g) ?? [])
      .map((p) => [p.slice(1, -1), p]))), code);
  }
  /* a remedy is a key's words, and the message is the row's words, a space, then the remedy */
  const remedy = word("membership.remedy.active_administrator_group");
  w.project("PROJ-1");
  w.m.projectClaimOwner({ projectId: "PROJ-1", memberId: "ann" });
  const rescue = w.m.rescueRefusal("PROJ-1", "ann");
  assert.equal(rescue.remedy, remedy);
  assert.equal(rescue.message, `${word("refusal.NOT_AN_ADMIN")} ${remedy}`);
  const confirm = w.m.expertiseConfirm({ memberId: "ann", label: "CPA", by: "ann" });
  assert.equal(confirm.remedy, word("membership.remedy.active_administrator_group_confirm"));
  /* the court statement and the door warning */
  assert.equal(Membership.COURT_STATEMENT, word("court.statement"));
  assert.equal(Membership.DOOR_WARNING, word("membership.door_warning"));
  assert.equal(w.m.websiteKeyCreate({ dailyCap: 2, by: "admin" }).warning, word("membership.door_warning"));
  assert.equal(w.m.joinLinkEnable({ dailyCap: 2, by: "admin" }).warning, word("membership.door_warning"));
  w.m.courtNoticeSet({ choice: "tell", by: "admin" });
  const a = await w.m.memberAdd({ memberId: "dee", cover: "c", by: "admin" });
  assert.equal((await w.m.enroll({ invite: a.invite, handle: "dee", password: "dee-passphrase-x" })).courtStatement, word("court.statement"));
  /* the owner arithmetic's reasons */
  assert.equal(Membership.ownerMath(1).why, word("membership.why.owner_floor_last"));
  assert.equal(Membership.ownerMath(2).why, word("membership.why.both_owners_agree"));
  for (const n of [3, 4, 9]) assert.equal(Membership.ownerMath(n).why, word("membership.why.majority_all_owners"), String(n));
  /* the handle check's window, stated */
  assert.equal(Membership.HANDLE_CHECK_STATED, word("membership.handle_check_stated", { per_key: 60, minutes: 10 }));
  /* the handle check's words, placeholders left for the screen (R123) */
  const inv = (await w.m.memberAdd({ memberId: "cal", cover: "c", by: "admin" })).invite;
  const free = await w.m.handleCheck({ invite: inv, handle: "cal-k" });
  assert.deepEqual(free.words, { key: "handle.free", en: word("handle.free", { handle: "{handle}", group: "{group}" }) });
  const taken = await w.m.handleCheck({ invite: inv, handle: "ann" });
  assert.deepEqual(taken.words, { key: "handle.taken",
    en: word("handle.taken", { handle: "{handle}", group: "{group}", suggestion: "{suggestion}" }) });
  const bad = await w.m.handleCheck({ invite: inv, handle: "Bad!" });
  assert.deepEqual(bad.words, { key: "handle.characters", en: word("handle.characters") });
});

test("R151 the carried removal's alsoDo and the audit's finding read their keys, with the values the finding names", async () => {
  const w = await world().group();
  /* three administrators: the founder, second and third; a majority of two removes the third */
  const added = await w.m.memberAdd({ memberId: "third", cover: "c", role: "admin", by: "admin" });
  assert.equal(added.reason, "CONSENSUS_REQUIRED");
  const endorsed = await w.m.adminEndorse({ memberId: "third", by: "second" });
  assert.equal(endorsed.ok, true);
  assert.equal((await w.m.enroll({ invite: endorsed.invite, handle: "third", password: "third-passphrase-x" })).ok, true);
  assert.equal(w.m.adminRemove({ memberId: "third", by: "admin", reason: "r" }).reason, "VOTES_SHORT");
  const carried = w.m.adminRemove({ memberId: "third", by: "second", reason: "r" });
  assert.equal(carried.removed, true);
  assert.equal(carried.alsoDo, word("membership.also_do"));
  /* the audit finding for a member enrolled under the reserved id, and for none */
  let finding = null;
  w.core.registerAuditFinding = (module, key, fn) => { finding = fn; };
  w.m.migrate();
  assert.equal(typeof finding, "function", "registered once the host offers the seam");
  assert.equal(finding().says, word("membership.says.member_holds_reserved", { id: "admin" }));
  w.sql.exec(`INSERT INTO members (member_id, cover, role, status, created, updated) VALUES ('admin','c','member','invited','t','t')`);
  assert.equal(finding().says, word("membership.says.member_enrolled_under", { id: "admin", role: "member", status: "invited" }));
  assert.equal(finding().check, MEMBER_ID_CHECKS.MEMBER_ID_RESERVED.check);
});

test("R151 the module's source modules hold no sentence of their own: every key in SENTENCE_KEYS is held, and a key it names but the list lacks would be refused at start", () => {
  for (const key of SENTENCE_KEYS) assert.equal(hasWord(key), true, key);
  assert.ok(SENTENCE_KEYS.every((k) => WORD_KEYS.includes(k)));
  assert.ok(Object.isFrozen(SENTENCE_KEYS));
  /* control: the rows of the other tables are read too */
  for (const table of [MEMBER_ID_CHECKS, PROJECT_AUTHORITY_CHECKS, PROJECT_VISIBILITY_CHECKS, CASE_AUTHORITY_CHECKS])
    for (const code of Object.keys(table)) assert.ok(HELD.includes(rowKey(code)), code);
});
