/* T41 (T41-5; N820, N796, DEC-188 (1), (7), (8); K2418, K2425, K2435), ported from credentials' t41 (T48-10; split map
   §6): `USE_KINDS` gains `enquire`, `read`, `transcribe` and `account`, each switched per account (on by default) and
   bound by material limits (R14, was credentials R55; R22, was R57); `accountUsesSet` the one act that sets an account's
   switches, R4's and R9's acts retired into it (R4, R9, R14; were R25, R37, R55); the refusals and the project key's
   notice read their words by key from `words.json` (R10, R11, R12, R22; were R54, R56, R58, R57); an account's panel
   reads, its uses and keep-aways (R15, was R60) and its change history (R16, was R61). credentials' R32 arm (a sign-in's
   standing switch asked by `aiGrantMintStanding`) stays in credentials. Every id is tested with a negative control
   (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { world, realWorld } from "./fixture.mjs";
import { localize } from "../../../src/setup-words/index.mjs";
import { AI_ACCOUNT_CHECKS, AI_WORDS, USE_KINDS, USE_SWITCHES, AI_ACCOUNTS_HISTORY_TABLE }
  from "../../../src/ai-accounts/index.mjs";
import { notAnAdmin, noSuchProject, notTheOwner } from "../../../src/membership/index.mjs";

const shape = (r) => ({ ok: r.ok, reason: r.reason, code: r.code, check: r.check, translation: r.translation });
const refusal = (code) => ({ ok: false, reason: code, code, check: AI_ACCOUNT_CHECKS[code].check, translation: AI_ACCOUNT_CHECKS[code].translation });
const NEW = ["enquire", "read", "transcribe", "account"];
const DEFAULTS = { ask: true, draft: true, run: true, standing: false, explore: "no", enquire: true, read: true, transcribe: true,
                   account: true, suggestions: false };
const KEY = "sk-ant-api03-T41-SENTINEL-77c0";
const act = (kind, member, project) => ({ kind, member, ...(project !== undefined ? { project } : {}) });
const WORDS = Object.fromEntries(JSON.parse(readFileSync(new URL("../../../../docs/development/ux-substrate/screens/words.json",
  import.meta.url), "utf8")).words.map((w) => [w.key, w.en]));

/* ann owns P (hidden) with bob joined; cy owns S alone, connected through her subscription; dee owns D (discoverable)
   alone; eve is in nothing; second an administrator; the founder claimed. */
async function projectWorld(opts) {
  const w = await world(opts).group("ann", "bob", "cy", "dee", "eve");
  w.project("P", "ann");
  assert.equal(w.join("P", "ann", "bob").ok, true);
  w.project("S", "cy");
  w.project("D", "dee", "discoverable");
  await w.signin("cy");
  return w;
}

/* ===== R14 (was R55): the four new kinds ===== */

test("R14 (was credentials R55): USE_KINDS gains enquire, read, transcribe and account, in that order after explore, frozen; each is a switch of every account, on by default as ask, draft and run, while standing, suggestions and explore stay off", async () => {
  assert.deepEqual([...USE_KINDS], ["ask", "draft", "run", "standing", "explore", ...NEW]);
  assert.ok(Object.isFrozen(USE_KINDS));
  assert.deepEqual([...USE_SWITCHES], [...USE_KINDS, "suggestions"]);
  const w = await projectWorld();
  await w.c.accountReferenceSet({ member: "ann", kind: "apikey", secret: "sk-ann", by: "ann" });
  await w.c.projectKeySet({ project: "P", key: KEY, by: "ann" });
  await w.c.groupKeySet({ key: "sk-group", by: "admin" });
  for (const [label, uses] of [["reference", w.c.accountReferenceState({ member: "ann", viewer: "ann" }).uses],
                               ["sign-in", w.c.accountReferenceState({ member: "cy", viewer: "cy" }).subscription.uses],
                               ["project", w.c.projectAccountState({ project: "P", viewer: "ann" }).uses],
                               ["group", w.c.groupKeyState({ viewer: "admin" }).uses]])
    assert.deepEqual(uses, DEFAULTS, label);
  /* negative control: the kinds off by default stay off */
  assert.deepEqual([DEFAULTS.standing, DEFAULTS.suggestions, DEFAULTS.explore], [false, false, "no"]);
});

test("R14 R11 (was credentials R55, R56): each new kind is set by accountUsesSet as the others are (owner's refusals, boolean values, SWITCH_VALUE_INVALID otherwise) and, switched off on the account the cascade chooses, refuses that act AI_USE_SWITCHED_OFF without moving on; on, it serves", async () => {
  const w = await projectWorld();
  await w.c.accountReferenceSet({ member: "bob", kind: "apikey", secret: "sk-bob", by: "bob" });
  await w.c.groupKeySet({ key: "sk-group", by: "admin" });
  w.c.groupKeySwitch({ on: true, by: "admin" });
  w.c.groupKeyNoticeSeen({ member: "ann", by: "ann" });
  for (const kind of NEW) {
    assert.equal(w.c.accountUsesSet({ owner: "member:bob", switch: kind, on: "no", by: "bob" }).reason, "SWITCH_VALUE_INVALID", kind);
    assert.equal(w.c.accountUsesSet({ owner: "member:bob", switch: kind, on: false, by: "ann" }).reason, "NOT_YOUR_ACCOUNT", kind);
    assert.deepEqual(w.c.accountUsesSet({ owner: "group", switch: kind, on: false, by: "bob" }),
      notAnAdmin("bob", localize("ai-accounts.index.switching_the_team_keys", "switching the team key's assistant settings")), kind);
    /* the member's own, on: it serves; off: refused, the group key never reached */
    assert.equal((await w.c.accountFor({ member: "bob", act: act(kind, "bob") })).level, "member", kind);
    assert.deepEqual(w.c.accountUsesSet({ owner: "member:bob", switch: kind, on: false, by: "bob" }),
      { ok: true, owner: "member:bob", switch: kind, on: false });
    const off = await w.c.accountFor({ member: "bob", act: act(kind, "bob") });
    assert.deepEqual([shape(off), off.whose, off.use], [refusal("AI_USE_SWITCHED_OFF"), "own", kind], kind);
    /* the group's */
    assert.equal((await w.c.accountFor({ member: "ann", act: act(kind, "ann") })).level, "group", kind);
    w.c.accountUsesSet({ owner: "group", switch: kind, on: false, by: "admin" });
    assert.equal((await w.c.accountFor({ member: "ann", act: act(kind, "ann") })).whose, "group", kind);
  }
  /* negative control: the kinds not switched off still serve */
  assert.equal((await w.c.accountFor({ member: "bob", act: act("ask", "bob") })).level, "member");
  assert.equal((await w.c.accountFor({ member: "ann", act: act("draft", "ann") })).level, "group");
});

test("R14 R22 (was credentials R55, R57): a material limit may name the new kinds and binds them as the others: the group's AI_KEPT_AWAY and a project's PROJECT_AI_KEPT_AWAY for the kinds it names; a limit with no uses covers them too", async () => {
  const w = await projectWorld();
  await w.c.accountReferenceSet({ member: "bob", kind: "apikey", secret: "sk-bob", by: "bob" });
  assert.equal(w.c.aiKeepAwaySet({ on: true, uses: ["transcribe", "read"], reason: "no OCR", by: "admin" }).uses.join(), "read,transcribe");
  assert.equal((await w.c.accountFor({ member: "bob", act: act("transcribe", "bob") })).reason, "AI_KEPT_AWAY");
  assert.equal((await w.c.accountFor({ member: "bob", act: act("read", "bob") })).reason, "AI_KEPT_AWAY");
  assert.equal((await w.c.accountFor({ member: "bob", act: act("enquire", "bob") })).level, "member", "negative control: not named");
  w.c.aiKeepAwaySet({ on: false, by: "admin" });
  w.c.projectAiKeepAwaySet({ project: "P", on: true, uses: ["account"], reason: "the case is sealed", by: "ann" });
  assert.equal((await w.c.accountFor({ member: "bob", act: act("account", "bob", "P") })).reason, "PROJECT_AI_KEPT_AWAY");
  assert.equal((await w.c.accountFor({ member: "bob", act: act("enquire", "bob", "P") })).level, "member");
  w.c.aiKeepAwaySet({ on: true, reason: "everything", by: "admin" });
  assert.deepEqual(w.c.aiKeepAwayState().uses, [...USE_KINDS], "no uses: every kind, the new ones included");
  for (const kind of NEW) assert.equal(w.c.aiKeptAway({ use: kind })?.reason, "AI_KEPT_AWAY", kind);
});

test("R14 (was credentials R55): an account held before T41 reads the four new kinds at their defaults: the migration adds their columns on and keeps every stored switch", async () => {
  const w = await projectWorld();
  await w.c.accountReferenceSet({ member: "ann", kind: "apikey", secret: "sk-ann", by: "ann" });
  w.c.accountUsesSet({ owner: "member:ann", switch: "standing", on: true, by: "ann" });
  w.c.accountUsesSet({ owner: "member:ann", switch: "draft", on: false, by: "ann" });
  /* a store from before T41: no column for the new kinds */
  for (const t of ["account_references", "group_key", "subscription_connections", "project_accounts"])
    for (const k of NEW) w.sql.exec(`ALTER TABLE ${t} DROP COLUMN use_${k}`);
  assert.equal(w.rows(`PRAGMA table_info(account_references)`).some((c) => c.name === "use_read"), false);
  w.c.migrate();
  assert.deepEqual(w.c.accountReferenceState({ member: "ann", viewer: "ann" }).uses, { ...DEFAULTS, standing: true, draft: false });
  assert.deepEqual(w.c.accountReferenceState({ member: "cy", viewer: "cy" }).subscription.uses, DEFAULTS);
  /* negative control: a second boot changes nothing */
  const before = w.snapshot();
  w.c.migrate();
  assert.equal(w.snapshot(), before);
});

/* ===== R4, R9, R14 (were R25, R37, R55): the one act ===== */

test("R4 R9 R14 (was credentials R25, R37, R55): accountUsesSet is the one act that sets an account's switches: accountSwitchSet and groupSwitchSet are retired, method and route; the two switches they set stand, set through accountUsesSet, and groupKeySwitches reads them unchanged", async () => {
  const w = await projectWorld();
  assert.equal(typeof w.c.accountSwitchSet, "undefined");
  assert.equal(typeof w.c.groupSwitchSet, "undefined");
  const ops = w.ops();
  assert.ok(!("accountswitchset" in ops) && !("groupswitchset" in ops));
  assert.ok("accountusesset" in ops, "negative control: the one act is routed");
  await w.c.accountReferenceSet({ member: "ann", kind: "apikey", secret: "sk-ann", by: "ann" });
  assert.equal(w.ops("by=ann", { owner: "member:ann", switch: "suggestions", on: true }).accountusesset().ok, true);
  assert.deepEqual([w.c.accountReferenceState({ member: "ann", viewer: "ann" }).suggestions], [true]);
  assert.equal(w.ops("by=admin", { owner: "group", switch: "standing", on: true }).accountusesset().ok, true);
  assert.deepEqual(w.c.groupKeySwitches(), { on: false, suggestions: false, standing: true });
});

/* ===== R10, R11, R12, R22 (were R54, R56, R58, R57): words read by key ===== */

test("R10 R14 R11 R22 R12 (was credentials R54, R55, R56, R57, R58): the six refusals read their translation by key from words.json, verbatim, never a copy: PROJECT_NOT_SOLE_MEMBER ai.refused.notsole, SIGNIN_NOT_CONNECTED .signinnotconnected, SWITCH_VALUE_INVALID .switchvalue, AI_USE_SWITCHED_OFF .off, PROJECT_AI_KEPT_AWAY .projectkeptaway, PROJECT_KEY_NOTICE_DUE .noticedue", async () => {
  const pairs = { PROJECT_NOT_SOLE_MEMBER: "ai.refused.notsole", SIGNIN_NOT_CONNECTED: "ai.refused.signinnotconnected",
                  SWITCH_VALUE_INVALID: "ai.refused.switchvalue", AI_USE_SWITCHED_OFF: "ai.refused.off",
                  PROJECT_AI_KEPT_AWAY: "ai.refused.projectkeptaway", PROJECT_KEY_NOTICE_DUE: "ai.refused.noticedue" };
  for (const [code, key] of Object.entries(pairs)) {
    assert.equal(typeof WORDS[key], "string", key);
    assert.equal(AI_WORDS[key], WORDS[key], `${key} verbatim`);
    assert.equal(AI_ACCOUNT_CHECKS[code].translation, WORDS[key], code);
  }
  assert.equal(AI_WORDS["ai.disclosure.projectkey"], WORDS["ai.disclosure.projectkey"]);
  assert.ok(Object.isFrozen(AI_WORDS));
  /* control (T50: every row now reads a key): a row not among the six reads its own key, refusal.<CODE>, not one of the six */
  assert.equal(AI_ACCOUNT_CHECKS.GROUP_KEY_NOTICE_DUE.translation, WORDS["refusal.GROUP_KEY_NOTICE_DUE"]);
  assert.ok(!pairs.GROUP_KEY_NOTICE_DUE);
  /* each refusal, as answered */
  const w = await projectWorld();
  await w.signin("ann");
  assert.deepEqual(shape(w.c.projectSigninSet({ project: "P", by: "ann" })), refusal("PROJECT_NOT_SOLE_MEMBER"));
  assert.equal(w.c.projectSigninSet({ project: "D", by: "dee" }).translation, WORDS["ai.refused.signinnotconnected"]);
  assert.equal(w.c.accountUsesSet({ owner: "member:cy", switch: "ask", on: 1, by: "cy" }).translation, WORDS["ai.refused.switchvalue"]);
  w.c.accountUsesSet({ owner: "member:cy", switch: "ask", on: false, by: "cy" });
  assert.equal((await w.c.accountFor({ member: "cy", act: act("ask", "cy") })).translation, WORDS["ai.refused.off"]);
  w.c.projectAiKeepAwaySet({ project: "S", on: true, reason: "r", by: "cy" });
  assert.equal(w.c.aiKeptAway({ project: "S", use: "ask" })?.translation, WORDS["ai.refused.projectkeptaway"]);
});

test("R12 (was credentials R58): the project key's notice is words.json's ai.disclosure.projectkey, {project} the project's name (its bundle's title, else its id); PROJECT_KEY_NOTICE_DUE (ai.refused.noticedue) carries the disclosure with it; once read, neither", async () => {
  const w = await projectWorld();
  await w.c.projectKeySet({ project: "P", key: KEY, by: "ann" });
  w.c.projectAccountSwitch({ project: "P", on: true, by: "ann" });
  const text = WORDS["ai.disclosure.projectkey"].replace("{project}", "Project P");
  assert.deepEqual(w.c.projectKeyNotice({ member: "bob", project: "P" }), { ok: true, due: true, text });
  const due = await w.c.accountFor({ member: "bob", act: act("ask", "bob", "P") });
  assert.deepEqual(shape(due), refusal("PROJECT_KEY_NOTICE_DUE"));
  assert.deepEqual([due.project, due.project_name, due.disclosure], ["P", "Project P", { key: "ai.disclosure.projectkey", text }]);
  /* no title held: the id stands for the name */
  w.sql.exec(`UPDATE bundles SET title=NULL WHERE bundle_id='P'`);
  assert.equal(w.c.projectKeyNotice({ member: "bob", project: "P" }).text, WORDS["ai.disclosure.projectkey"].replace("{project}", "P"));
  /* negative control: read, it is not due and the act is served */
  w.c.projectKeyNoticeSeen({ member: "bob", project: "P", by: "bob" });
  assert.equal(w.c.projectKeyNotice({ member: "bob", project: "P" }).due, false);
  assert.equal((await w.c.accountFor({ member: "bob", act: act("ask", "bob", "P") })).level, "project");
});

/* ===== R15 (was R60): an account's uses and keep-aways ===== */

test("R15 (was credentials R60): accountUses answers one account's uses and keep-aways to its owners alone ({owner, held, uses, keptAway}); anyone else refused as R14 refuses them, writing nothing; never a key", async () => {
  const w = await projectWorld();
  await w.c.accountReferenceSet({ member: "ann", kind: "apikey", secret: "sk-ann-panel", by: "ann" });
  await w.c.projectKeySet({ project: "P", key: KEY, by: "ann" });
  await w.c.groupKeySet({ key: "sk-group-panel", by: "admin" });
  w.c.accountUsesSet({ owner: "project:P", switch: "explore", on: "ask", by: "ann" });
  w.c.aiKeepAwaySet({ on: true, uses: ["explore"], reason: "not yet", by: "admin" });
  w.c.projectAiKeepAwaySet({ project: "P", on: true, uses: ["read"], reason: "sealed papers", by: "ann" });
  const before = w.snapshot();
  /* refusals: R5's, R10's and R1's (were R33's, R54's and R22's) */
  for (const v of ["ann", "class:admin", null])
    assert.deepEqual(w.c.accountUses({ owner: "group", viewer: v }), notAnAdmin(v, localize("ai-accounts.index.reading_the_team_keys_assistant", "reading the team key's assistant settings")), String(v));
  assert.deepEqual(w.c.accountUses({ owner: "project:P", viewer: "bob" }), notTheOwner("bob", "P"));
  assert.deepEqual(w.c.accountUses({ owner: "project:P", viewer: "eve" }), noSuchProject("P"));
  for (const [v, code] of [["bob", "NOT_YOUR_ACCOUNT"], ["admin", "NOT_YOUR_ACCOUNT"], ["class:ai", "MACHINE_CANNOT_HOLD_ACCOUNT"]])
    assert.deepEqual(shape(w.c.accountUses({ owner: "member:ann", viewer: v })), refusal(code), v);
  for (const owner of [null, "", "organisation", "project"])
    assert.equal(w.c.accountUses({ owner, viewer: "ann" }).reason, "NOT_YOUR_ACCOUNT", String(owner));
  /* the owners */
  const group = w.c.accountUses({ owner: "group", viewer: "second" });
  assert.deepEqual([group.ok, group.owner, group.held, group.uses], [true, "group", true, DEFAULTS]);
  assert.deepEqual(group.keptAway.map((k) => [k.scope, k.on, k.uses, k.reason, k.set_by]), [["group", true, ["explore"], "not yet", "admin"]]);
  const proj = w.c.accountUses({ owner: "project:P", viewer: "member:ann" });
  assert.deepEqual([proj.held, proj.kind, proj.uses], [true, "apikey", { ...DEFAULTS, explore: "ask" }]);
  assert.deepEqual(proj.keptAway.map((k) => [k.scope, k.on, k.uses, k.reason]),
    [["group", true, ["explore"], "not yet"], ["project", true, ["read"], "sealed papers"]]);
  const mine = w.c.accountUses({ owner: "member:ann", viewer: "ann" });
  assert.deepEqual([mine.held, mine.uses, mine.accounts], [true, DEFAULTS,
    { reference: { held: true, uses: DEFAULTS }, signin: { held: false, uses: null } }]);
  assert.deepEqual(mine.keptAway.map((k) => k.scope), ["group"]);
  const cy = w.c.accountUses({ owner: "member:cy", viewer: "cy" });
  assert.deepEqual([cy.held, cy.uses, cy.accounts.signin.held], [true, DEFAULTS, true], "a sign-in alone");
  const eve = w.c.accountUses({ owner: "member:eve", viewer: "eve" });
  assert.deepEqual([eve.held, eve.uses], [false, null], "no account held");
  assert.deepEqual(w.c.accountUses({ owner: "project:S", viewer: "cy" }).uses, null);
  assert.equal(w.snapshot(), before, "it writes nothing");
  const said = JSON.stringify([group, proj, mine, w.ops("owner=group&viewer=admin").accountuses()]);
  for (const k of [KEY, "sk-ann-panel", "sk-group-panel"]) assert.ok(!said.includes(k), k);
  /* the route: the viewer stamp, never the body's */
  assert.equal(w.ops("owner=member:ann&viewer=bob", { viewer: "ann" }).accountuses().reason, "NOT_YOUR_ACCOUNT");
  assert.equal(w.ops("owner=member:ann&viewer=ann").accountuses().ok, true);
  /* never throws */
  w.sql.exec(`DROP TABLE project_accounts`);
  assert.equal(w.c.accountUses({ owner: "project:P", viewer: "ann" }).unreadable, true);
});

/* ===== R16 (was R61): an account's changes ===== */

test("R16 (was credentials R61): every change to an account's settings is recorded with who made it and when, never the key, and accountHistory answers them to the account's owners in the order made; a refusal records nothing", async () => {
  const w = await projectWorld();
  await w.c.groupKeySet({ key: "sk-hist-group", by: "admin" });
  w.c.groupKeySwitch({ on: true, by: "second" });
  w.c.accountUsesSet({ owner: "group", switch: "standing", on: true, by: "admin" });
  w.c.aiKeepAwaySet({ on: true, uses: ["explore"], reason: "not yet", by: "second" });
  w.c.groupKeyRemove({ by: "admin" });
  await w.c.accountReferenceSet({ member: "ann", kind: "apikey", secret: "sk-hist-ann", by: "ann" });
  w.c.accountUsesSet({ owner: "member:ann", switch: "explore", on: "yes", by: "ann" });
  w.c.accountReferenceRemove({ member: "ann", by: "ann" });
  await w.signin("ann");
  w.c.subscriptionDisconnect({ member: "ann", by: "ann" });
  await w.c.projectKeySet({ project: "P", key: KEY, by: "ann" });
  w.c.projectAccountSwitch({ project: "P", on: true, by: "ann" });
  w.c.accountUsesSet({ owner: "project:P", switch: "read", on: false, by: "ann" });
  w.c.projectAiKeepAwaySet({ project: "P", on: true, uses: ["read"], reason: "sealed", by: "ann" });
  w.c.projectAccountRemove({ project: "P", by: "ann" });
  /* refusals record nothing */
  const before = w.snapshot();
  await w.c.groupKeySet({ key: "x", by: "ann" });
  w.c.accountUsesSet({ owner: "member:ann", switch: "ask", on: false, by: "bob" });
  w.c.projectAccountSwitch({ project: "P", on: true, by: "bob" });
  w.c.aiKeepAwaySet({ on: true, by: "admin" });
  assert.equal(w.snapshot(), before);
  const strip = (h) => h.changes.map(({ at, ...c }) => { assert.match(at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/); return c; });
  assert.deepEqual(strip(w.c.accountHistory({ owner: "group", viewer: "second" })), [
    { by: "admin", change: "key_set", kind: "apikey" },
    { by: "second", change: "switched", on: true },
    { by: "admin", change: "use_set", switch: "standing", value: true },
    { by: "second", change: "limit_set", on: true, uses: ["explore"], reason: "not yet" },
    { by: "admin", change: "removed" },
  ]);
  assert.deepEqual(strip(w.c.accountHistory({ owner: "member:ann", viewer: "ann" })), [
    { by: "ann", change: "key_set", account: "reference", kind: "apikey" },
    { by: "ann", change: "use_set", account: "reference", switch: "explore", value: "yes" },
    { by: "ann", change: "removed", account: "reference" },
    { by: "ann", change: "signin_set", account: "signin" },
    { by: "ann", change: "removed", account: "signin", why: "disconnected" },
  ]);
  assert.deepEqual(strip(w.c.accountHistory({ owner: "project:P", viewer: "ann" })), [
    { by: "ann", change: "key_set", kind: "apikey" },
    { by: "ann", change: "switched", on: true },
    { by: "ann", change: "use_set", switch: "read", value: false },
    { by: "ann", change: "limit_set", on: true, uses: ["read"], reason: "sealed" },
    { by: "ann", change: "removed" },
  ]);
  /* never the key, nor its digest */
  const { createHash } = await import("node:crypto");
  const dump = JSON.stringify(w.rows(`SELECT * FROM account_changes`));
  for (const k of ["sk-hist-group", "sk-hist-ann", KEY]) {
    assert.ok(!dump.includes(k) && !dump.includes(createHash("sha256").update(k).digest("hex")), k);
  }
  /* to the owners only: R15's refusals, writing nothing */
  const read = w.snapshot();
  assert.equal(w.c.accountHistory({ owner: "group", viewer: "ann" }).reason, "NOT_AN_ADMIN");
  assert.deepEqual(w.c.accountHistory({ owner: "project:P", viewer: "bob" }), notTheOwner("bob", "P"));
  assert.equal(w.c.accountHistory({ owner: "member:ann", viewer: "admin" }).reason, "NOT_YOUR_ACCOUNT");
  assert.equal(w.c.accountHistory({ owner: "member:ann", viewer: "bob" }).reason, "NOT_YOUR_ACCOUNT");
  assert.equal(w.snapshot(), read, "it writes nothing");
  /* negative control: another account's history holds none of these */
  assert.deepEqual(w.c.accountHistory({ owner: "member:bob", viewer: "bob" }).changes, []);
  /* the route */
  assert.equal(w.ops("owner=project:P&viewer=ann").accounthistory().changes.length, 5);
  assert.equal(w.ops("owner=project:P&viewer=bob", { viewer: "ann" }).accounthistory().reason, "PROJECT_ACT_NOT_THE_OWNER");
});

test("R16 R27 (was credentials R61, R16): a sign-in's clearing by revocation, and a project's sign-in account cleared with its member's sign-in, are recorded; the list is capped as credentials R15's (default 200, at most 500) with a measured truncated", async () => {
  const w = await projectWorld();
  w.c.projectSigninSet({ project: "S", by: "cy" });
  w.m.memberSet({ memberId: "cy", status: "revoked", by: "admin" });
  const s = w.rows(`SELECT owner, by, change, detail FROM account_changes WHERE change='removed' ORDER BY seq`);
  assert.deepEqual(s.map((r) => [r.owner, r.by, JSON.parse(r.detail).why]), [["member:cy", "admin", "revoked"],
    ["project:S", "admin", "signin_cleared"]]);
  /* the cap */
  await w.c.accountReferenceSet({ member: "ann", kind: "apikey", secret: "sk", by: "ann" });
  for (let i = 0; i < 205; i++) w.c.accountUsesSet({ owner: "member:ann", switch: "ask", on: i % 2 === 0, by: "ann" });
  const d = w.c.accountHistory({ owner: "member:ann", viewer: "ann" });
  assert.deepEqual([d.count, d.limit, d.truncated, d.changes[0].change], [200, 200, true, "key_set"]);
  const all = w.c.accountHistory({ owner: "member:ann", viewer: "ann", limit: 9999 });
  assert.deepEqual([all.count, all.limit, all.truncated], [206, 500, false]);
  assert.deepEqual([w.c.accountHistory({ owner: "member:ann", viewer: "ann", limit: 3 }).count], [3]);
});

test("R16 R28 (was credentials R61, R30): the records kept before T41 (R5's, R20's, R10's, R22's; were R33's, R51's, R54's, R57's) are answered as far as they were recorded, carried once in the order made and never back-filled; the history table is declared never exported, a project's rows cleared with it and no other's", async () => {
  const w = await projectWorld();
  /* a store from before T41: its earlier records, and no history */
  w.sql.exec(`DELETE FROM account_changes`);
  w.sql.exec(`INSERT INTO group_key_acts (act, detail, actor, at) VALUES ('set', NULL, 'admin', '2026-01-01T00:00:00Z'),
              ('switch:standing', 'on', 'second', '2026-01-03T00:00:00Z')`);
  w.sql.exec(`INSERT INTO ai_keep_away (is_on, reason, set_by, set_at, uses) VALUES (1, 'old', 'admin', '2026-01-02T00:00:00Z', NULL)`);
  w.sql.exec(`INSERT INTO project_account_acts (project_id, act, detail, actor, at) VALUES ('P', 'setkey', NULL, 'ann', '2026-01-01T00:00:00Z')`);
  w.sql.exec(`INSERT INTO project_keep_away (project_id, is_on, uses, reason, set_by, set_at) VALUES ('P', 1, '["ask"]', 'x', 'ann', '2026-01-05T00:00:00Z')`);
  assert.equal(w.row(`SELECT COUNT(*) AS n FROM account_changes`).n, 0);
  w.c.migrate();
  assert.deepEqual(w.c.accountHistory({ owner: "group", viewer: "admin" }).changes, [
    { kind: "apikey", at: "2026-01-01T00:00:00Z", by: "admin", change: "key_set" },
    { on: true, uses: [...USE_KINDS], reason: "old", at: "2026-01-02T00:00:00Z", by: "admin", change: "limit_set" },
    { switch: "standing", value: true, at: "2026-01-03T00:00:00Z", by: "second", change: "use_set" },
  ], "in the order made");
  assert.deepEqual(w.c.accountHistory({ owner: "project:P", viewer: "ann" }).changes.map((c) => c.change), ["key_set", "limit_set"]);
  /* negative control: a later boot carries nothing twice, and a member's account has no earlier record to answer */
  const n = w.row(`SELECT COUNT(*) AS n FROM account_changes`).n;
  w.c.migrate();
  assert.equal(w.row(`SELECT COUNT(*) AS n FROM account_changes`).n, n);
  assert.deepEqual(w.c.accountHistory({ owner: "member:ann", viewer: "ann" }).changes, []);
  /* declared */
  const d = w.core.declared.get(AI_ACCOUNTS_HISTORY_TABLE.name);
  assert.deepEqual([d.module, d.classes.export, d.classes.purge], ["ai-accounts", "never", "clear"]);
  assert.deepEqual([...AI_ACCOUNTS_HISTORY_TABLE.keys], ["project_id"]);
  assert.equal(AI_ACCOUNTS_HISTORY_TABLE.whole, "project_id IS NOT NULL", "the whole-store purge clears only a project's rows");
});

test("R16 R28 (was credentials R61, R30): through the real record-core: a purge of a project deletes that project's history rows and no other's; the whole-store purge deletes every project's and keeps the group's and members'", async () => {
  const r = realWorld();
  r.c = r.a;
  r.fact.claimed = true;   /* the founder's claim: the test's fact (membership R94) */
  for (const [id, role] of [["second", "admin"], ["ann", "member"], ["cy", "member"]]) {
    const a = await r.m.memberAdd({ memberId: id, cover: "c", role, by: "admin" });
    await r.m.enroll({ invite: a.invite, handle: id, password: `${id}-passphrase-x` });
  }
  for (const [p, owner] of [["PROJ-P", "ann"], ["PROJ-S", "cy"]]) {
    r.db.prepare(`INSERT INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated, bundle_sha)
                  VALUES (?, 'project', 'g', ?, 'draft', 't', 't', 'x')`).run(p, p);
    r.m.projectCreated({ projectId: p, ownerId: owner, by: owner });
    assert.equal((await r.c.projectKeySet({ project: p, key: "sk-" + p, by: owner })).ok, true, p);
  }
  r.c.aiKeepAwaySet({ on: true, reason: "r", by: "admin" });
  assert.equal((await r.c.accountReferenceSet({ member: "ann", kind: "apikey", secret: "sk-a", by: "ann" })).ok, true);
  const count = (owner) => r.row(`SELECT COUNT(*) AS n FROM account_changes WHERE owner=?`, owner).n;
  assert.deepEqual(["project:PROJ-P", "project:PROJ-S", "group", "member:ann"].map(count), [1, 1, 1, 1]);
  assert.equal(r.rc.purge({ bundleId: "PROJ-P" }).ok, true);
  assert.deepEqual(["project:PROJ-P", "project:PROJ-S", "group", "member:ann"].map(count), [0, 1, 1, 1]);
  assert.equal(r.rc.purge({}).ok, true);
  assert.deepEqual(["project:PROJ-P", "project:PROJ-S", "group", "member:ann"].map(count), [0, 0, 1, 1]);
});
