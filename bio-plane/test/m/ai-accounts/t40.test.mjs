/* Ported from credentials' t40.test.mjs (T48-10): ai-accounts R14 (was credentials R55), R4 (R25), R9 (R37), R2 (R23),
   R6 (R34), R10 (R54), R12 (R58), R13 (R59), R11 (R56, amending R7, was R35), R3 (R24), R20 (R51), R21 (R52), R22 (R57),
   R28 (R30's project tables). T40 (T40-3; N812, D34, D37, D38, K2352, K2353, K2373, K2394, K2404), at the interface:
   every account's switch for each kind of use (R14, with R4's and R9's two among them, R2 and R6 answering them); a
   project's own AI account, an API key or its only member's sign-in (R10), its key's notice (R12) and its suspended
   sign-in accounts (R13); the cascade that chooses the one account used (R11, amending R7; R3's act); material limits by
   use, the group's and each project's (R22, amending R20, R21 and R7's `aiKeptAway`); and the project tables'
   declaration (R28). Every id is tested with a negative control (K874). credentials R27's `aiGrantMint` with `project`
   stays in credentials: its arm is not ported (the cascade's refusals it relied on are R11's arms here). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, realWorld, SIGNIN_TOKEN } from "./fixture.mjs";
import { localize } from "../../../src/setup-words/index.mjs";
import { AI_ACCOUNT_CHECKS, USE_KINDS, USE_SWITCHES, EXPLORE_VALUES, AI_ACCOUNTS_PROJECT_TABLES, AiAccounts }
  from "../../../src/ai-accounts/index.mjs";
import { notAnAdmin, noSuchProject, notTheOwner } from "../../../src/membership/index.mjs";

const shape = (r) => ({ ok: r.ok, reason: r.reason, code: r.code, check: r.check, translation: r.translation });
const refusal = (code) => ({ ok: false, reason: code, code, check: AI_ACCOUNT_CHECKS[code].check, translation: AI_ACCOUNT_CHECKS[code].translation });
const KEY = "sk-ant-api03-PROJECT-SENTINEL-40a1";
const DEFAULTS = { ask: true, draft: true, run: true, standing: false, explore: "no", enquire: true, read: true, transcribe: true, account: true, suggestions: false };
const OFF = { ask: false, draft: false, run: false, standing: false, explore: "no", enquire: false, read: false, transcribe: false, account: false, suggestions: false };
const act = (kind, member, project) => ({ kind, member, ...(project !== undefined ? { project } : {}) });

/* ann owns P (hidden) with bob joined; cy owns S alone (hidden), connected through her subscription; dee owns D
   (discoverable) alone; eve is an active member in nothing; second an administrator; the founder claimed. */
async function projectWorld(opts) {
  const w = await world(opts).group("ann", "bob", "cy", "dee", "eve");
  w.project("P", "ann");
  assert.equal(w.join("P", "ann", "bob").ok, true);
  w.project("S", "cy");
  w.project("D", "dee", "discoverable");
  await w.signin("cy");
  return w;
}

/* ===== R14 (was R55): USE_KINDS and every account's switches ===== */

test("R14 (was credentials R55): USE_KINDS is exported and frozen, ask, draft, run, standing, explore (T41: and enquire, read, transcribe, account); every account holds a switch for each kind but explore (no, ask or yes) and suggestions; the defaults: ask, draft and run on, standing and suggestions off, explore no", async () => {
  assert.deepEqual([...USE_KINDS], ["ask", "draft", "run", "standing", "explore", "enquire", "read", "transcribe", "account"]);
  assert.ok(Object.isFrozen(USE_KINDS) && Object.isFrozen(USE_SWITCHES) && Object.isFrozen(EXPLORE_VALUES));
  assert.deepEqual([...USE_SWITCHES], [...USE_KINDS, "suggestions"]);
  assert.deepEqual([...EXPLORE_VALUES], ["no", "ask", "yes"]);
  const w = await projectWorld();
  await w.c.accountReferenceSet({ member: "ann", kind: "apikey", secret: "sk-ann", by: "ann" });
  await w.c.projectKeySet({ project: "P", key: KEY, by: "ann" });
  await w.c.groupKeySet({ key: "sk-group", by: "admin" });
  /* the defaults, on each of the four kinds of account */
  assert.deepEqual(w.c.accountReferenceState({ member: "ann", viewer: "ann" }).uses, DEFAULTS, "a member's own reference");
  assert.deepEqual(w.c.accountReferenceState({ member: "cy", viewer: "cy" }).subscription.uses, DEFAULTS, "a member's sign-in (K2275's gap closed)");
  assert.deepEqual(w.c.projectAccountState({ project: "P", viewer: "ann" }).uses, DEFAULTS, "a project's key");
  assert.deepEqual(w.c.groupKeyState({ viewer: "admin" }).uses, DEFAULTS, "the team key");
  /* negative control: an account not held answers no switches */
  assert.equal(w.c.accountReferenceState({ member: "bob", viewer: "bob" }).uses, null);
  assert.equal(w.c.accountReferenceState({ member: "bob", viewer: "bob" }).subscription.uses, null);
  assert.equal(w.c.projectAccountState({ project: "S", viewer: "cy" }).uses, null);
});

test("R14 (was credentials R55): accountUsesSet sets one switch of one account by its owner: the group's by an active administrator (R5's refusals), a project's by an owner (R10's), a member's own by that member (R1's), on their reference else their sign-in; UNKNOWN_SWITCH; SWITCH_VALUE_INVALID naming the values; NO_ACCOUNT; each refusal writing nothing", async () => {
  const w = await projectWorld();
  await w.c.accountReferenceSet({ member: "ann", kind: "apikey", secret: "sk-ann", by: "ann" });
  await w.c.projectKeySet({ project: "P", key: KEY, by: "ann" });
  const before = w.snapshot();
  /* the group: administrators only */
  for (const by of ["ann", "class:admin", null])
    assert.deepEqual(w.c.accountUsesSet({ owner: "group", switch: "ask", on: false, by }),
      notAnAdmin(by, localize("ai-accounts.index.switching_the_team_keys", "switching the team key's assistant settings")), String(by));
  /* a project: its owners only, after sight */
  assert.deepEqual(w.c.accountUsesSet({ owner: "project:P", switch: "ask", on: false, by: "bob" }), notTheOwner("bob", "P"));
  assert.deepEqual(w.c.accountUsesSet({ owner: "project:P", switch: "ask", on: false, by: "class:admin" }), notTheOwner("class:admin", "P"));
  assert.deepEqual(w.c.accountUsesSet({ owner: "project:P", switch: "ask", on: false, by: "eve" }), noSuchProject("P"), "unseen: absent");
  /* a member's own: that member only */
  for (const [by, code] of [[null, "MACHINE_CANNOT_HOLD_ACCOUNT"], ["class:ai", "MACHINE_CANNOT_HOLD_ACCOUNT"], ["bob", "NOT_YOUR_ACCOUNT"],
                            ["second", "NOT_YOUR_ACCOUNT"]])
    assert.deepEqual(shape(w.c.accountUsesSet({ owner: "member:ann", switch: "ask", on: false, by })), refusal(code), String(by));
  for (const owner of ["ann", "organisation", "", null, "project", "member:"])
    assert.deepEqual(shape(w.c.accountUsesSet({ owner, switch: "ask", on: false, by: "ann" })), refusal("NOT_YOUR_ACCOUNT"), String(owner));
  /* the switch's name, then its value */
  for (const name of [null, "", "Ask", "budget", "ask; DROP TABLE x"])
    assert.deepEqual(shape(w.c.accountUsesSet({ owner: "member:ann", switch: name, on: true, by: "ann" })), refusal("UNKNOWN_SWITCH"), String(name));
  for (const [name, on] of [["ask", "yes"], ["ask", 1], ["ask", null], ["ask", undefined], ["suggestions", "no"], ["explore", true],
                            ["explore", "maybe"], ["explore", "Yes"], ["explore", undefined]]) {
    const r = w.c.accountUsesSet({ owner: "member:ann", switch: name, on, by: "ann" });
    assert.deepEqual(shape(r), refusal("SWITCH_VALUE_INVALID"), `${name} ${String(on)}`);
    assert.deepEqual(r.values, name === "explore" ? ["no", "ask", "yes"] : [true, false], name);
  }
  /* an owner holding no account */
  assert.deepEqual(shape(w.c.accountUsesSet({ owner: "member:bob", switch: "ask", on: false, by: "bob" })), refusal("NO_ACCOUNT"));
  assert.deepEqual(shape(w.c.accountUsesSet({ owner: "project:D", switch: "ask", on: false, by: "dee" })), refusal("NO_ACCOUNT"));
  assert.equal(w.snapshot(), before, "no refusal writes");
  /* the owners' own acts, each on its own account only */
  assert.deepEqual(w.c.accountUsesSet({ owner: "member:ann", switch: "draft", on: false, by: "member:ann" }),
    { ok: true, owner: "member:ann", switch: "draft", on: false });
  assert.deepEqual(w.c.accountUsesSet({ owner: "member:ann", switch: "explore", on: "ask", by: "ann" }).on, "ask");
  assert.deepEqual(w.c.accountReferenceState({ member: "ann", viewer: "ann" }).uses, { ...DEFAULTS, draft: false, explore: "ask" });
  assert.equal(w.c.accountUsesSet({ owner: "member:cy", switch: "standing", on: true, by: "cy" }).ok, true, "on her sign-in");
  assert.deepEqual(w.c.accountReferenceState({ member: "cy", viewer: "cy" }).subscription.uses, { ...DEFAULTS, standing: true });
  assert.equal(w.c.accountUsesSet({ owner: "project:P", switch: "run", on: false, by: "ann" }).ok, true);
  assert.equal(w.c.accountUsesSet({ owner: "project:P", switch: "explore", on: "yes", by: "ann" }).ok, true);
  assert.deepEqual(w.c.projectAccountState({ project: "P", viewer: "ann" }).uses, { ...DEFAULTS, run: false, explore: "yes" });
  assert.equal(w.c.accountUsesSet({ owner: "group", switch: "suggestions", on: true, by: "second" }).ok, true, "before a key is held, as R9's");
  assert.deepEqual(w.c.groupKeyState({ viewer: "admin" }).uses, { ...DEFAULTS, suggestions: true });
  assert.deepEqual(w.rows(`SELECT act, detail, actor FROM group_key_acts`), [{ act: "switch:suggestions", detail: "on", actor: "second" }]);
  assert.deepEqual(w.rows(`SELECT act, detail, actor FROM project_account_acts WHERE act LIKE 'uses:%' ORDER BY seq`),
    [{ act: "uses:run", detail: "off", actor: "ann" }, { act: "uses:explore", detail: "yes", actor: "ann" }]);
  /* nobody else's changed */
  assert.deepEqual(w.c.accountReferenceState({ member: "cy", viewer: "cy" }).uses, null);
});

test("R4 R9 R14 (was credentials R25 R37 R55): the reference's and the group key's two switches are two of R14's, their stored values kept; (T41) set only through accountUsesSet, accountSwitchSet and groupSwitchSet retired (no method, no route); removing the reference or the group key turns off every R14 switch of it", async () => {
  const w = await projectWorld();
  await w.c.accountReferenceSet({ member: "ann", kind: "apikey", secret: "sk-ann", by: "ann" });
  w.c.accountUsesSet({ owner: "member:ann", switch: "standing", on: true, by: "ann" });
  assert.equal(w.c.accountReferenceState({ member: "ann", viewer: "ann" }).uses.standing, true, "one switch, two doors");
  w.c.accountUsesSet({ owner: "member:ann", switch: "suggestions", on: true, by: "ann" });
  assert.equal(w.c.accountReferenceState({ member: "ann", viewer: "ann" }).suggestions, true);
  /* (T41; DEC-188 (8)) the two retired acts are gone, method and route */
  assert.equal(typeof w.c.accountSwitchSet, "undefined");
  assert.equal(typeof w.c.groupSwitchSet, "undefined");
  assert.ok(!("accountswitchset" in w.ops()) && !("groupswitchset" in w.ops()));
  assert.equal(w.c.accountUsesSet({ owner: "member:ann", switch: "standing", on: "on", by: "ann" }).reason, "SWITCH_VALUE_INVALID");
  assert.equal(w.c.accountUsesSet({ owner: "group", switch: "standing", on: 1, by: "admin" }).reason, "SWITCH_VALUE_INVALID");
  /* removal: the reference's row goes (a new reference starts at the defaults); the group key's are turned off */
  w.c.accountUsesSet({ owner: "member:ann", switch: "explore", on: "yes", by: "ann" });
  w.c.accountReferenceRemove({ member: "ann", by: "ann" });
  assert.equal(w.c.accountReferenceState({ member: "ann", viewer: "ann" }).uses, null);
  await w.c.accountReferenceSet({ member: "ann", kind: "apikey", secret: "sk-ann", by: "ann" });
  assert.deepEqual(w.c.accountReferenceState({ member: "ann", viewer: "ann" }).uses, DEFAULTS);
  await w.c.groupKeySet({ key: "sk-group", by: "admin" });
  w.c.accountUsesSet({ owner: "group", switch: "explore", on: "ask", by: "admin" });
  w.c.accountUsesSet({ owner: "group", switch: "standing", on: true, by: "admin" });
  assert.deepEqual(w.c.groupKeyState({ viewer: "admin" }).uses, { ...DEFAULTS, standing: true, explore: "ask" }, "negative control: held");
  w.c.groupKeyRemove({ by: "admin" });
  assert.deepEqual(w.c.groupKeyState({ viewer: "admin" }).uses, OFF);
  assert.deepEqual(w.c.groupKeySwitches(), { on: false, suggestions: false, standing: false }, "R9's in-plane read, unchanged in shape");
});

test("R2 R6 (was credentials R23 R34): accountReferenceState answers every R14 switch of the reference and of the member's sign-in, explore's value among them, beside suggestions, to the member alone; groupKeyState's administrator answer carries every switch of the group key, and another member's carries none", async () => {
  const w = await projectWorld();
  await w.c.accountReferenceSet({ member: "cy", kind: "apikey", secret: "sk-cy", by: "cy" });
  w.c.accountUsesSet({ owner: "member:cy", switch: "explore", on: "yes", by: "cy" });
  const st = w.c.accountReferenceState({ member: "cy", viewer: "cy" });
  assert.deepEqual([st.suggestions, st.standing, st.uses, st.subscription.connected, st.subscription.uses],
    [false, false, { ...DEFAULTS, explore: "yes" }, true, DEFAULTS]);
  assert.equal(w.c.accountReferenceState({ member: "cy", viewer: "ann" }).reason, "NOT_YOUR_ACCOUNT", "negative control: another viewer");
  await w.c.groupKeySet({ key: "sk-group", by: "admin" });
  assert.deepEqual(w.c.groupKeyState({ viewer: "second" }).uses, DEFAULTS);
  assert.deepEqual(w.c.groupKeyState({ viewer: "ann" }), { ok: true, on: false }, "a member who is not an administrator reads {on} only");
});

/* ===== R10 (was R54): a project's AI account ===== */

test("R10 (was credentials R54): the acts on a project's account are an owner's: a project the caller cannot see answers as absent (NONE) or C-70.1 (EXISTENCE), then anyone not an owner, an administrator, the founder and a machine credential included, PROJECT_ACT_NOT_THE_OWNER through membership's notTheOwner; each refusal writing nothing", async () => {
  const w = await projectWorld();
  const acts = [
    (by, project) => w.c.projectKeySet({ project, key: KEY, by }),
    (by, project) => w.c.projectSigninSet({ project, by }),
    (by, project) => w.c.projectAccountRemove({ project, by }),
    (by, project) => w.c.projectAccountSwitch({ project, on: true, by }),
    (by, project) => w.c.projectAiKeepAwaySet({ project, on: true, reason: "r", by }),
  ];
  const before = w.snapshot();
  for (const [i, a] of acts.entries()) {
    for (const by of ["bob", "class:admin", "class:ai", null, ""])
      assert.deepEqual(await a(by, "P"), notTheOwner(by, "P"), `${i} ${String(by)}`);
    /* (T41; D54, K2442) an administrator neither invited nor joined sees a hidden project at existence: C-70.1 */
    for (const by of ["second", "admin"]) {
      const seen = await a(by, "P");
      assert.deepEqual([seen.reason, seen.check, seen.project], ["PROJECT_SEEN_NOT_A_PARTICIPANT", "C-70.1", "P"], `${i} ${by}`);
    }
    assert.deepEqual(await a("eve", "P"), noSuchProject("P"), `${i}: a hidden project eve cannot see`);
    assert.deepEqual(await a("ann", "NOPE"), noSuchProject("NOPE"), `${i}: no such project`);
    const ex = await a("ann", "D");
    assert.deepEqual([ex.reason, ex.check, ex.project], ["PROJECT_SEEN_NOT_A_PARTICIPANT", "C-70.1", "D"], `${i}: a discoverable project ann does not participate in`);
  }
  assert.equal(w.snapshot(), before, "no refusal writes");
  /* negative control: its owner acts */
  assert.equal((await w.c.projectKeySet({ project: "P", key: KEY, by: "member:ann" })).ok, true);
});

test("R10 (was credentials R54): projectKeySet holds an Anthropic API key, replacing any earlier account; off when first set; NO_SECRET for an empty key; sealed, never shown, exported or logged; each act recorded with its owner and instant, never the key; the account serves through R11 once on", async () => {
  const w = await projectWorld();
  const before = w.snapshot();
  for (const key of [null, undefined, "", "   ", 7]) assert.deepEqual(shape(await w.c.projectKeySet({ project: "P", key, by: "ann" })), refusal("NO_SECRET"), String(key));
  assert.equal(w.snapshot(), before);
  const s = await w.c.projectKeySet({ project: "P", key: KEY, by: "ann" });
  assert.deepEqual(Object.keys(s).sort(), ["kind", "ok", "project", "set_at"]);
  assert.deepEqual([s.ok, s.kind, s.project], [true, "apikey", "P"]);
  const st = w.c.projectAccountState({ project: "P", viewer: "ann" });
  assert.deepEqual({ ...st, set_at: null }, { ok: true, held: true, kind: "apikey", on: false, set_at: null, by: "ann", uses: DEFAULTS, serving: true },
    "off when first set");
  /* off: the cascade goes on (bob holds nothing, so NO_ACCOUNT) */
  assert.equal((await w.c.accountFor({ member: "bob", act: act("ask", "bob", "P") })).reason, "NO_ACCOUNT");
  assert.deepEqual(w.c.projectAccountSwitch({ project: "P", on: true, by: "ann" }), { ok: true, on: true });
  w.c.projectKeyNoticeSeen({ member: "bob", project: "P", by: "bob" });
  assert.deepEqual(await w.c.accountFor({ member: "bob", act: act("ask", "bob", "P") }),
    { ok: true, kind: "apikey", level: "project", project: "P", key: KEY });
  /* replacing a key keeps it on; only `true` is on */
  await w.c.projectKeySet({ project: "P", key: "sk-second", by: "ann" });
  assert.equal(w.c.projectAccountState({ project: "P", viewer: "ann" }).on, true);
  assert.deepEqual(w.c.projectAccountSwitch({ project: "P", on: "yes", by: "ann" }), { ok: true, on: false });
  /* sealed: in no table, act, answer or export, nor its digest; declared never exported */
  const { createHash } = await import("node:crypto");
  const dump = w.snapshot();
  const said = JSON.stringify([s, st, w.ops("project=P&viewer=ann").projectaccountstate()]);
  for (const k of [KEY, "sk-second"]) {
    assert.ok(!dump.includes(k) && !dump.includes(createHash("sha256").update(k).digest("hex")), k);
    assert.ok(!said.includes(k));
  }
  assert.equal(w.core.declared.get("project_accounts").classes.export, "never");
  /* sealed under its project: moved under another project it does not open */
  await w.c.projectKeySet({ project: "S", key: "sk-s", by: "cy" });
  w.c.projectAccountSwitch({ project: "S", on: true, by: "cy" });
  w.sql.exec(`UPDATE project_accounts SET sealed=(SELECT sealed FROM project_accounts WHERE project_id='P'),
              iv=(SELECT iv FROM project_accounts WHERE project_id='P') WHERE project_id='S'`);
  w.c.projectKeyNoticeSeen({ member: "cy", project: "S", by: "cy" });
  assert.deepEqual(shape(await w.c.accountFor({ member: "cy", act: act("ask", "cy", "S") })), refusal("ACCOUNT_SEAL_UNAVAILABLE"));
  /* with no seal secret bound, nothing is stored */
  const bare = await projectWorld({ sealSecret: null });
  const b0 = bare.snapshot();
  assert.deepEqual(shape(await bare.c.projectKeySet({ project: "P", key: KEY, by: "ann" })), refusal("ACCOUNT_SEAL_UNAVAILABLE"));
  assert.equal(bare.snapshot(), b0);
  /* every act, its owner and instant, never the key */
  const acts = w.rows(`SELECT act, detail, actor FROM project_account_acts WHERE project_id='P' ORDER BY seq`);
  assert.deepEqual(acts, [{ act: "setkey", detail: null, actor: "ann" }, { act: "switch", detail: "on", actor: "ann" },
    { act: "setkey", detail: null, actor: "ann" }, { act: "switch", detail: "off", actor: "ann" }]);
  for (const r of w.rows(`SELECT at FROM project_account_acts`)) assert.match(r.at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
});

test("R10 (was credentials R54): projectSigninSet makes the acting owner's own sign-in the project's account, holding no secret: PROJECT_NOT_SOLE_MEMBER (C-29.34) while the project has any other participant, owners included; SIGNIN_NOT_CONNECTED (C-29.35) when the owner is not connected; each writing nothing", async () => {
  const w = await projectWorld();
  await w.signin("ann");
  const before = w.snapshot();
  /* P has bob joined: refused, whether ann is connected or not */
  const r = w.c.projectSigninSet({ project: "P", by: "ann" });
  assert.deepEqual([shape(r), r.project], [refusal("PROJECT_NOT_SOLE_MEMBER"), "P"]);
  /* D: dee alone, but not connected */
  const n = w.c.projectSigninSet({ project: "D", by: "dee" });
  assert.deepEqual(shape(n), refusal("SIGNIN_NOT_CONNECTED"));
  assert.notEqual(n.reason, "NO_ACCOUNT", "never NO_ACCOUNT, a different condition");
  assert.equal(w.snapshot(), before, "no refusal writes");
  /* an invited member is not yet a participant: S with eve invited still has cy alone */
  assert.equal(w.m.projectInvite({ projectId: "S", handle: "eve", by: "cy", viewer: "member:cy" }).ok, true);
  const ok = w.c.projectSigninSet({ project: "S", by: "cy" });
  assert.deepEqual([ok.ok, ok.kind, ok.project], [true, "signin", "S"]);
  assert.deepEqual(w.rows(`SELECT kind, sealed, iv, member_id, is_on FROM project_accounts WHERE project_id='S'`),
    [{ kind: "signin", sealed: null, iv: null, member_id: "cy", is_on: 0 }], "no secret, only the member it is; off when first set");
  /* a second owner joined: refused (owners included) */
  assert.equal(w.join("D", "dee", "eve").ok, true);
  await w.signin("dee");
  assert.equal(w.c.projectSigninSet({ project: "D", by: "dee" }).reason, "PROJECT_NOT_SOLE_MEMBER");
  /* replacing: a key replaces the sign-in, and a sign-in a key */
  await w.c.projectKeySet({ project: "S", key: KEY, by: "cy" });
  assert.equal(w.c.projectAccountState({ project: "S", viewer: "cy" }).kind, "apikey");
  w.c.projectSigninSet({ project: "S", by: "cy" });
  assert.deepEqual(w.rows(`SELECT kind, sealed FROM project_accounts WHERE project_id='S'`), [{ kind: "signin", sealed: null }]);
});

test("R10 R27 (was credentials R54 R16): a sign-in account serves only while its member is the project's only participant: another's join is not refused, it stops serving at once (R11 goes on to the member's own, then the group's) and serves again when the project returns to that one member; it is cleared when the member's sign-in is", async () => {
  const w = await projectWorld();
  w.c.projectSigninSet({ project: "S", by: "cy" });
  w.c.projectAccountSwitch({ project: "S", on: true, by: "cy" });
  const signin = { ok: true, kind: "signin", level: "project", project: "S", member: "cy", key: SIGNIN_TOKEN("cy") };   /* (T47) R19 (was R70) */
  assert.deepEqual(await w.c.accountFor({ member: "cy", act: act("ask", "cy", "S") }), signin);
  assert.deepEqual(w.c.projectAccountState({ project: "S", viewer: "cy" }).serving, true);
  /* eve joins: not refused; the account stops serving at once */
  assert.equal(w.join("S", "cy", "eve").ok, true);
  const st = w.c.projectAccountState({ project: "S", viewer: "cy" });
  assert.deepEqual([st.held, st.on, st.serving], [true, true, false]);
  assert.deepEqual(w.c.projectAccountState({ project: "S", viewer: "eve" }), { ok: true, on: true, serving: false }, "a joined participant");
  /* the cascade goes on: cy's own sign-in serves her, eve has nothing; then the group's */
  assert.deepEqual(await w.c.accountFor({ member: "cy", act: act("ask", "cy", "S") }), { ok: true, kind: "signin", level: "member", member: "cy",
    key: SIGNIN_TOKEN("cy") });
  assert.equal((await w.c.accountFor({ member: "eve", act: act("ask", "eve", "S") })).reason, "NO_ACCOUNT");
  await w.c.groupKeySet({ key: "sk-group", by: "admin" });
  w.c.groupKeySwitch({ on: true, by: "admin" });
  w.c.groupKeyNoticeSeen({ member: "eve", by: "eve" });
  assert.equal((await w.c.accountFor({ member: "eve", act: act("ask", "eve", "S") })).level, "group");
  /* the project returns to cy alone: it serves again */
  assert.equal(w.m.projectRemove({ projectId: "S", handle: "eve", by: "cy", viewer: "member:cy" }).ok, true);
  assert.deepEqual(await w.c.accountFor({ member: "cy", act: act("ask", "cy", "S") }), signin);
  /* cleared when her sign-in is */
  w.c.subscriptionDisconnect({ member: "cy", by: "cy" });
  assert.equal(w.c.projectAccountState({ project: "S", viewer: "cy" }).held, false);
  await w.signin("cy");
  w.c.projectSigninSet({ project: "S", by: "cy" });
  w.m.memberSet({ memberId: "cy", status: "revoked", by: "admin" });
  assert.equal(w.row(`SELECT COUNT(*) AS n FROM project_accounts WHERE project_id='S'`).n, 0, "and by her revocation (R27, was credentials R16)");
});

test("R10 (was credentials R54): projectAccountRemove and projectAccountSwitch act on whichever account is held; projectAccountState answers owners {held, kind, on, set_at, by, uses, serving}, joined participants {on, serving}, anyone else as absent; it writes nothing", async () => {
  const w = await projectWorld();
  await w.c.projectKeySet({ project: "P", key: KEY, by: "ann" });
  w.c.projectAccountSwitch({ project: "P", on: true, by: "ann" });
  assert.equal(w.m.projectInvite({ projectId: "P", handle: "eve", by: "ann", viewer: "member:ann" }).ok, true);   /* eve invited, not joined */
  const before = w.snapshot();
  const owner = w.c.projectAccountState({ project: "P", viewer: "member:ann" });
  assert.deepEqual(Object.keys(owner).sort(), ["by", "held", "kind", "ok", "on", "serving", "set_at", "uses"]);
  assert.deepEqual(w.c.projectAccountState({ project: "P", viewer: "bob" }), { ok: true, on: true, serving: true });
  for (const viewer of ["eve", "class:admin", null])
    assert.deepEqual(w.c.projectAccountState({ project: "P", viewer }), noSuchProject("P"), String(viewer));
  for (const viewer of ["second", "admin"])   /* (T41; D54) an administrator: at existence */
    assert.equal(w.c.projectAccountState({ project: "P", viewer }).reason, "PROJECT_SEEN_NOT_A_PARTICIPANT", viewer);
  assert.equal(w.c.projectAccountState({ project: "D", viewer: "ann" }).reason, "PROJECT_SEEN_NOT_A_PARTICIPANT");
  assert.equal(w.snapshot(), before, "it writes nothing");
  assert.deepEqual(w.c.projectAccountRemove({ project: "P", by: "ann" }), { ok: true, removed: true });
  assert.deepEqual(w.c.projectAccountState({ project: "P", viewer: "ann" }),
    { ok: true, held: false, kind: null, on: false, set_at: null, by: null, uses: null, serving: false });
  assert.deepEqual(w.c.projectAccountRemove({ project: "P", by: "ann" }), { ok: true, removed: false });
  assert.deepEqual(w.c.projectAccountSwitch({ project: "P", on: true, by: "ann" }), { ok: true, on: false }, "on only while held");
});

/* ===== R11 (was R56): the cascade, and the account used ===== */

test("R11 (was credentials R56): accountFor's cascade answers the first account held and on: the project's (with `project`), the member's own, the group key; `project` only for a joined participant (unseen absent, C-70.1 at existence, PROJECT_ACT_NOT_A_PARTICIPANT for sight without joining); `level` project is carried with `project`", async () => {
  const w = await projectWorld();
  await w.c.accountReferenceSet({ member: "bob", kind: "apikey", secret: "sk-bob", by: "bob" });
  await w.c.groupKeySet({ key: "sk-group", by: "admin" });
  w.c.groupKeySwitch({ on: true, by: "admin" });
  w.c.groupKeyNoticeSeen({ member: "ann", by: "ann" });
  /* no project account: the member's own, else the group's */
  assert.deepEqual(await w.c.accountFor({ member: "bob", act: act("ask", "bob", "P") }), { ok: true, kind: "apikey", level: "member", key: "sk-bob" });
  assert.deepEqual(await w.c.accountFor({ member: "ann", act: act("ask", "ann", "P") }), { ok: true, kind: "apikey", level: "group", key: "sk-group" });
  /* the project's key, on: first, for each kind of act */
  await w.c.projectKeySet({ project: "P", key: KEY, by: "ann" });
  w.c.projectAccountSwitch({ project: "P", on: true, by: "ann" });
  for (const id of ["ann", "bob"]) w.c.projectKeyNoticeSeen({ member: id, project: "P", by: id });
  w.c.accountUsesSet({ owner: "project:P", switch: "standing", on: true, by: "ann" });
  for (const kind of ["ask", "draft", "run", "standing"])
    for (const id of ["ann", "bob"])
      assert.deepEqual(await w.c.accountFor({ member: id, act: act(kind, id, "P") }),
        { ok: true, kind: "apikey", level: "project", project: "P", key: KEY }, `${kind} ${id}`);
  /* without `project`, the project's account is not asked */
  assert.equal((await w.c.accountFor({ member: "bob", act: act("ask", "bob") })).level, "member");
  assert.equal((await w.c.accountFor({ member: "bob", act: act("ask", "bob", null) })).level, "member");
  /* explore is no act an account serves */
  assert.equal((await w.c.accountFor({ member: "bob", act: act("explore", "bob", "P") })).reason, "NOT_YOUR_ACCOUNT");
  /* a project the member has not joined */
  assert.equal(w.m.projectInvite({ projectId: "P", handle: "eve", by: "ann", viewer: "member:ann" }).ok, true);
  const before = w.snapshot();
  assert.deepEqual(await w.c.accountFor({ member: "dee", act: act("ask", "dee", "P") }), noSuchProject("P"), "unseen");
  assert.deepEqual(await w.c.accountFor({ member: "eve", act: act("ask", "eve", "NOPE") }), noSuchProject("NOPE"));
  assert.equal((await w.c.accountFor({ member: "eve", act: act("ask", "eve", "D") })).reason, "PROJECT_SEEN_NOT_A_PARTICIPANT");
  const notJoined = await w.c.accountFor({ member: "second", act: act("ask", "second", "P") });
  assert.deepEqual([notJoined.reason, notJoined.project], ["PROJECT_SEEN_NOT_A_PARTICIPANT", "P"],
    "(T41; D54) an administrator neither invited nor joined sees a hidden project at existence");
  assert.equal((await w.c.accountFor({ member: "eve", act: act("ask", "eve", "P") })).reason, "PROJECT_ACT_NOT_A_PARTICIPANT", "invited, not joined");
  for (const project of [7, {}, ""]) assert.equal((await w.c.accountFor({ member: "bob", act: act("ask", "bob", project) })).reason, "NO_SUCH_PROJECT");
  assert.equal(w.snapshot(), before, "it writes nothing");
  /* off: the cascade goes on */
  w.c.projectAccountSwitch({ project: "P", on: false, by: "ann" });
  assert.equal((await w.c.accountFor({ member: "bob", act: act("ask", "bob", "P") })).level, "member");
});

test("R11 (was credentials R56): the account answered is the one used: its switch for the act's kind off answers AI_USE_SWITCHED_OFF (C-29.37) naming whose, and never moves to the next account; switched on, it serves", async () => {
  const w = await projectWorld();
  await w.c.accountReferenceSet({ member: "bob", kind: "apikey", secret: "sk-bob", by: "bob" });
  await w.c.groupKeySet({ key: "sk-group", by: "admin" });
  w.c.groupKeySwitch({ on: true, by: "admin" });
  w.c.groupKeyNoticeSeen({ member: "ann", by: "ann" });
  await w.c.projectKeySet({ project: "P", key: KEY, by: "ann" });
  w.c.projectAccountSwitch({ project: "P", on: true, by: "ann" });
  w.c.projectKeyNoticeSeen({ member: "bob", project: "P", by: "bob" });
  const off = async (member, a, whose, label) => {
    const r = await w.c.accountFor({ member, act: a });
    assert.deepEqual(shape(r), refusal("AI_USE_SWITCHED_OFF"), label);
    assert.deepEqual([r.whose, r.use], [whose, a.kind], label);
    return r;
  };
  /* the project's: its run switch off; bob's own key is never reached */
  w.c.accountUsesSet({ owner: "project:P", switch: "run", on: false, by: "ann" });
  assert.equal((await off("bob", act("run", "bob", "P"), "project", "project")).project, "P");
  assert.equal((await w.c.accountFor({ member: "bob", act: act("ask", "bob", "P") })).level, "project", "negative control: ask on");
  /* the standing switch is off by default on every account */
  await off("bob", act("standing", "bob", "P"), "project", "project standing");
  await off("bob", act("standing", "bob"), "own", "own standing");
  await off("ann", act("standing", "ann"), "group", "group standing");
  /* a member's own: draft off; the group key is never reached */
  w.c.accountUsesSet({ owner: "member:bob", switch: "draft", on: false, by: "bob" });
  await off("bob", act("draft", "bob"), "own", "own");
  /* a sign-in's own switches */
  w.c.accountUsesSet({ owner: "member:cy", switch: "ask", on: false, by: "cy" });
  await off("cy", act("ask", "cy"), "own", "sign-in");
  /* the group's */
  w.c.accountUsesSet({ owner: "group", switch: "ask", on: false, by: "admin" });
  await off("ann", act("ask", "ann"), "group", "group");
  /* switched on again, each serves */
  w.c.accountUsesSet({ owner: "group", switch: "ask", on: true, by: "admin" });
  w.c.accountUsesSet({ owner: "member:cy", switch: "ask", on: true, by: "cy" });
  w.c.accountUsesSet({ owner: "project:P", switch: "run", on: true, by: "ann" });
  assert.equal((await w.c.accountFor({ member: "ann", act: act("ask", "ann") })).level, "group");
  assert.equal((await w.c.accountFor({ member: "cy", act: act("ask", "cy") })).kind, "signin");
  assert.equal((await w.c.accountFor({ member: "bob", act: act("run", "bob", "P") })).level, "project");
});

test("R11 R12 (was credentials R56 R58): a project's key is due its notice as the group key's is: PROJECT_KEY_NOTICE_DUE (C-29.39) for a member who has not read projectKeyNotice's words; projectKeyNoticeSeen is the member's own act (R1's refusals), for a project they have joined, once; a project's sign-in needs none", async () => {
  const w = await projectWorld();
  await w.c.projectKeySet({ project: "P", key: KEY, by: "ann" });
  w.c.projectAccountSwitch({ project: "P", on: true, by: "ann" });
  const n = w.c.projectKeyNotice({ member: "bob", project: "P" });
  /* (T41; DEC-188 (7)) words.json's `ai.disclosure.projectkey`, `{project}` the project's name */
  assert.deepEqual(n, { ok: true, due: true, text: AiAccounts.PROJECT_KEY_NOTICE_TEXT.replace("{project}", "Project P") });
  assert.match(n.text, /questions in Project P, and the material read to answer them, go to Anthropic under the project's API account/);
  const due = await w.c.accountFor({ member: "bob", act: act("ask", "bob", "P") });
  assert.deepEqual([shape(due), due.member, due.project], [refusal("PROJECT_KEY_NOTICE_DUE"), "bob", "P"]);
  const before = w.snapshot();
  for (const [by, code] of [[null, "MACHINE_CANNOT_HOLD_ACCOUNT"], ["class:ai", "MACHINE_CANNOT_HOLD_ACCOUNT"], ["ann", "NOT_YOUR_ACCOUNT"], ["second", "NOT_YOUR_ACCOUNT"]])
    assert.deepEqual(shape(w.c.projectKeyNoticeSeen({ member: "bob", project: "P", by })), refusal(code), String(by));
  assert.deepEqual(w.c.projectKeyNoticeSeen({ member: "eve", project: "P", by: "eve" }), noSuchProject("P"));
  assert.equal(w.snapshot(), before, "no refusal writes");
  assert.deepEqual(w.c.projectKeyNoticeSeen({ member: "bob", project: "P", by: "member:bob" }), { ok: true, seen: true, already: false });
  assert.deepEqual(w.c.projectKeyNoticeSeen({ member: "bob", project: "P", by: "bob" }), { ok: true, seen: true, already: true });
  assert.equal(w.c.projectKeyNotice({ member: "bob", project: "P" }).due, false);
  assert.equal(w.c.projectKeyNotice({ member: "bob", project: "S" }).due, true, "per project");
  assert.equal(w.c.projectKeyNotice({ member: "ann", project: "P" }).due, true, "per member");
  assert.equal((await w.c.accountFor({ member: "bob", act: act("ask", "bob", "P") })).level, "project", "negative control: read");
  /* the group key's notice is not the project key's */
  assert.equal(w.c.groupKeyNotice({ member: "bob" }).due, true);
  /* a project's sign-in asks none */
  w.c.projectSigninSet({ project: "S", by: "cy" });
  w.c.projectAccountSwitch({ project: "S", on: true, by: "cy" });
  assert.equal((await w.c.accountFor({ member: "cy", act: act("ask", "cy", "S") })).kind, "signin");
  /* a revoked member is not served by a project's key */
  w.m.memberSet({ memberId: "bob", status: "revoked", by: "admin" });
  assert.equal((await w.c.accountFor({ member: "bob", act: act("ask", "bob", "P") })).reason, "ACCOUNT_MEMBER_NOT_ACTIVE",
    "a revoked member is not served by a project's key");
});

test("R3 R22 (was credentials R24 R57): accountReferenceFor admits a draft as the other kinds (USE_KINDS but explore); explore and any other kind NOT_YOUR_ACCOUNT", async () => {
  const w = await projectWorld();
  await w.c.accountReferenceSet({ member: "ann", kind: "apikey", secret: "sk-ann", by: "ann" });
  for (const kind of ["ask", "draft", "run", "standing"])
    assert.deepEqual(await w.c.accountReferenceFor({ member: "ann", act: act(kind, "ann") }), { ok: true, kind: "apikey", secret: "sk-ann" }, kind);
  for (const kind of ["explore", "suggestions", "export"])
    assert.equal((await w.c.accountReferenceFor({ member: "ann", act: act(kind, "ann") })).reason, "NOT_YOUR_ACCOUNT", kind);
  /* the group's material limit is asked for the act's own use (R22) */
  w.c.aiKeepAwaySet({ on: true, uses: ["draft"], reason: "no drafting", by: "admin" });
  assert.equal((await w.c.accountReferenceFor({ member: "ann", act: act("draft", "ann") })).reason, "AI_KEPT_AWAY");
  assert.equal((await w.c.accountReferenceFor({ member: "ann", act: act("ask", "ann") })).ok, true, "negative control: another use");
});

/* ===== R22 (was R57): material limits ===== */

test("R20 R21 R22 (was credentials R51 R52 R57): aiKeepAwaySet takes `uses` (every kind when absent); a `uses` that is not a non-empty list of USE_KINDS entries, each once, SWITCH_VALUE_INVALID (C-29.36) naming the values, writing nothing; aiKeepAwayState answers `uses`", async () => {
  const w = await projectWorld();
  const before = w.snapshot();
  for (const uses of [[], ["ask", "ask"], ["Ask"], ["suggestions"], "ask", 7, {}, [null]]) {
    const r = w.c.aiKeepAwaySet({ on: true, uses, reason: "r", by: "admin" });
    assert.deepEqual(shape(r), refusal("SWITCH_VALUE_INVALID"), JSON.stringify(uses));
    assert.deepEqual(r.values, [...USE_KINDS]);
  }
  assert.equal(w.snapshot(), before);
  assert.equal(w.c.aiKeepAwaySet({ on: true, uses: ["explore", "ask"], reason: "r", by: "admin" }).uses.join(), "ask,explore", "in USE_KINDS' order");
  assert.deepEqual(w.c.aiKeepAwayState().uses, ["ask", "explore"]);
  w.c.aiKeepAwaySet({ on: true, reason: "all", by: "admin" });
  assert.deepEqual(w.c.aiKeepAwayState().uses, [...USE_KINDS], "absent: every use");
  /* a limit set before T40 (no uses recorded) covers every use */
  w.sql.exec(`INSERT INTO ai_keep_away (is_on, reason, set_by, set_at) VALUES (1, 'old', 'admin', '2026-01-01T00:00:00Z')`);
  assert.deepEqual(w.c.aiKeepAwayState().uses, [...USE_KINDS]);
  assert.equal(w.row(`SELECT uses FROM ai_keep_away ORDER BY seq DESC LIMIT 1`).uses, null);
});

test("R7 R22 (was credentials R35 R57): aiKeptAway({project, use}) answers the group's AI_KEPT_AWAY when the group's limit covers `use`, else PROJECT_AI_KEPT_AWAY (C-29.38) with its reason, who and when when the project's covers it, else null; with neither argument as before; a setting it cannot read fails closed; it writes nothing", async () => {
  const w = await projectWorld();
  assert.equal(w.c.aiKeptAway({ project: "P", use: "ask" }), null);
  w.c.aiKeepAwaySet({ on: true, uses: ["explore"], reason: "no exploring", by: "admin" });
  assert.equal(w.c.aiKeptAway({ use: "explore" })?.reason, "AI_KEPT_AWAY");
  assert.equal(w.c.aiKeptAway({ use: "ask" }), null, "negative control: another use");
  assert.equal(w.c.aiKeptAway()?.reason, "AI_KEPT_AWAY", "with neither argument: as now, whenever it is on");
  const set = w.c.projectAiKeepAwaySet({ project: "P", on: true, uses: ["ask", "draft"], reason: "Under seal until March.", by: "ann" });
  assert.deepEqual({ ...set, set_at: null }, { ok: true, project: "P", on: true, uses: ["ask", "draft"], reason: "Under seal until March.",
    set_by: "ann", set_at: null });
  const before = w.snapshot();
  const k = w.c.aiKeptAway({ project: "P", use: "ask" });
  assert.deepEqual(shape(k), refusal("PROJECT_AI_KEPT_AWAY"));
  assert.deepEqual([k?.project, k?.use, k?.keep_away], ["P", "ask", { reason: "Under seal until March.", set_by: "ann", set_at: set.set_at }]);
  assert.equal(w.c.aiKeptAway({ project: "P", use: "run" }), null, "a use it does not name");
  assert.equal(w.c.aiKeptAway({ project: "S", use: "ask" }), null, "another project");
  assert.equal(w.c.aiKeptAway({ project: "P", use: "explore" })?.reason, "AI_KEPT_AWAY", "the team's first");
  assert.equal(w.c.aiKeptAway({ project: "P" })?.reason, "AI_KEPT_AWAY");
  w.c.aiKeepAwaySet({ on: false, by: "admin" });
  assert.equal(w.c.aiKeptAway({ project: "P" })?.reason, "PROJECT_AI_KEPT_AWAY", "no use asked: covered while on");
  assert.equal(w.c.aiKeptAway(), null);
  /* binds every account: the member's own too, through R11 */
  await w.c.accountReferenceSet({ member: "bob", kind: "apikey", secret: "sk-bob", by: "bob" });
  assert.equal((await w.c.accountFor({ member: "bob", act: act("ask", "bob", "P") })).reason, "PROJECT_AI_KEPT_AWAY");
  assert.equal((await w.c.accountFor({ member: "bob", act: act("run", "bob", "P") })).level, "member");
  assert.equal((await w.c.accountFor({ member: "bob", act: act("ask", "bob") })).level, "member", "outside the project's context");
  assert.equal(w.c.projectsKeptAway({ use: "ask" })?.join(), "P");
  assert.notEqual(before, null);
  /* fails closed */
  w.sql.exec(`DROP TABLE project_keep_away`);
  const unread = w.c.aiKeptAway({ project: "P", use: "run" });
  assert.deepEqual([shape(unread), unread.keep_away], [refusal("PROJECT_AI_KEPT_AWAY"), { reason: null, set_by: null, set_at: null }]);
  assert.match(unread.detail, /could not be read/);
  assert.equal(w.c.aiKeptAway({ use: "run" }), null, "the team's own read is unaffected");
  assert.equal(w.c.projectsKeptAway({ use: "ask" }), null, "unknown, never an empty list");
});

test("R22 (was credentials R57): projectAiKeepAwaySet is an owner's act (R10's refusals) under R20's reason rule (AI_KEEP_AWAY_NO_REASON) and `uses` rule, appended; projectAiKeepAwayState answers the project's participants, anyone else as absent; projectsKeptAway answers the projects whose latest limit covers `use`", async () => {
  const w = await projectWorld();
  const before = w.snapshot();
  assert.deepEqual(w.c.projectAiKeepAwaySet({ project: "P", on: true, reason: "r", by: "bob" }), notTheOwner("bob", "P"));
  assert.deepEqual(w.c.projectAiKeepAwaySet({ project: "P", on: true, reason: "r", by: "eve" }), noSuchProject("P"));
  for (const reason of [null, "", "  ", "x".repeat(2001), 7])
    assert.equal(w.c.projectAiKeepAwaySet({ project: "P", on: true, reason, by: "ann" }).reason, "AI_KEEP_AWAY_NO_REASON", String(reason));
  assert.equal(w.c.projectAiKeepAwaySet({ project: "P", on: true, uses: [], reason: "r", by: "ann" }).reason, "SWITCH_VALUE_INVALID");
  assert.equal(w.snapshot(), before);
  w.c.projectAiKeepAwaySet({ project: "P", on: true, uses: ["explore"], reason: "no exploring here", by: "ann" });
  w.c.projectAiKeepAwaySet({ project: "S", on: true, reason: "nothing", by: "cy" });
  w.c.projectAiKeepAwaySet({ project: "D", on: true, uses: ["explore"], reason: "x", by: "dee" });
  w.c.projectAiKeepAwaySet({ project: "D", on: false, by: "dee" });
  assert.deepEqual(w.rows(`SELECT project_id, is_on FROM project_keep_away ORDER BY seq`).length, 4, "appended");
  assert.deepEqual(w.c.projectsKeptAway({ use: "explore" }), ["P", "S"]);
  assert.deepEqual(w.c.projectsKeptAway({ use: "ask" }), ["S"]);
  for (const viewer of ["ann", "bob"]) {
    const st = w.c.projectAiKeepAwayState({ project: "P", viewer });
    assert.deepEqual([st.ok, st.on, st.uses, st.reason, st.set_by], [true, true, ["explore"], "no exploring here", "ann"], viewer);
  }
  for (const viewer of ["eve", "class:admin", null]) assert.deepEqual(w.c.projectAiKeepAwayState({ project: "P", viewer }), noSuchProject("P"));
  assert.equal(w.c.projectAiKeepAwayState({ project: "P", viewer: "second" }).reason, "PROJECT_SEEN_NOT_A_PARTICIPANT", "(T41; D54)");
  assert.equal(w.core.declared.get("project_keep_away").classes.export, "admin-only", "declared as R20's");
});

/* ===== R13 (was R59): suspended sign-in accounts ===== */

test("R13 (was credentials R59): projectAccountsSuspended answers, for each project the viewer owns whose sign-in account stopped serving because a second member joined, {project, member, since, key}: since the earliest join among the others, the key stable per project and suspension; nothing for anyone else; it writes nothing and never throws", async () => {
  const w = await projectWorld();
  w.c.projectSigninSet({ project: "S", by: "cy" });
  assert.deepEqual(w.c.projectAccountsSuspended({ viewer: "cy", at: Date.now() }), [], "serving: none");
  assert.equal(w.join("S", "cy", "eve").ok, true);
  const before = w.snapshot();
  const [s] = w.c.projectAccountsSuspended({ viewer: "member:cy" });
  assert.deepEqual(Object.keys(s).sort(), ["key", "member", "project", "since"]);
  assert.deepEqual([s.project, s.member], ["S", "cy"]);
  const joined = w.m.joinedParticipants("S").find((x) => x.member === "eve").since;
  assert.equal(s.since, joined, "the instant eve joined");
  assert.deepEqual(w.c.projectAccountsSuspended({ viewer: "cy" }), [s], "stable");
  for (const viewer of ["eve", "ann", "second", "admin", "class:admin", null]) assert.deepEqual(w.c.projectAccountsSuspended({ viewer }), [], String(viewer));
  assert.equal(w.snapshot(), before, "it writes nothing");
  /* the project returns to cy alone: none; a new suspension, a new key */
  w.m.projectRemove({ projectId: "S", handle: "eve", by: "cy", viewer: "member:cy" });
  assert.deepEqual(w.c.projectAccountsSuspended({ viewer: "cy" }), []);
  /* a key account is never suspended */
  await w.c.projectKeySet({ project: "P", key: KEY, by: "ann" });
  assert.deepEqual(w.c.projectAccountsSuspended({ viewer: "ann" }), []);
  /* never throws */
  const broken = Object.create(Object.getPrototypeOf(w.c));
  assert.deepEqual(w.c.projectAccountsSuspended.call(broken, { viewer: "cy" }), []);
  assert.ok(!Object.keys(w.ops()).some((op) => /suspended|keptaway|projectskept/i.test(op)), "in-plane, reached by no route");
});

/* ===== R28 (was R30): the project tables ===== */

test("R28 R29 (was credentials R30 R18): the project tables are declared through declareTable, never exported (the material limits administrators only, as R20's), keyed by project_id and cleared with their project: a purge of the project deletes its rows, and no other; the rest of the module's tables stay exempt", async () => {
  const w = world();
  for (const t of AI_ACCOUNTS_PROJECT_TABLES) {
    const d = w.core.declared.get(t.name);
    assert.equal(d.module, "ai-accounts", t.name);
    assert.deepEqual([d.classes.purge, d.classes.sight, d.classes.expunge, d.classes.keys],
      ["clear", "group", "none", ["project_id"]], t.name);
    assert.equal(d.classes.export, t.name === "project_keep_away" ? "admin-only" : "never", t.name);
  }
  assert.equal(w.core.declared.get("account_references").classes.purge, "exempt", "negative control");
  /* through the real record-core: a purge of P removes P's rows and nobody else's */
  const r = realWorld();
  r.fact.claimed = true;   /* the founder's claim, a test fact (no credentials here) */
  for (const [id, role] of [["second", "admin"], ["ann", "member"], ["cy", "member"]]) {
    const a = await r.m.memberAdd({ memberId: id, cover: "c", role, by: "admin" });
    await r.m.enroll({ invite: a.invite, handle: id, password: `${id}-passphrase-x` });
  }
  for (const [p, owner] of [["PROJ-P", "ann"], ["PROJ-S", "cy"]]) {
    r.db.prepare(`INSERT INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated, bundle_sha)
                  VALUES (?, 'project', 'g', ?, 'draft', 't', 't', 'x')`).run(p, p);
    r.m.projectCreated({ projectId: p, ownerId: owner, by: owner });
    assert.equal((await r.a.projectKeySet({ project: p, key: "sk-" + p, by: owner })).ok, true, p);
    r.a.projectKeyNoticeSeen({ member: owner, project: p, by: owner });
    r.a.projectAiKeepAwaySet({ project: p, on: true, reason: "r", by: owner });
  }
  const count = (p) => ["project_accounts", "project_account_acts", "project_key_notices", "project_keep_away"]
    .map((t) => r.row(`SELECT COUNT(*) AS n FROM ${t} WHERE project_id=?`, p).n);
  assert.deepEqual([count("PROJ-P"), count("PROJ-S")], [[1, 1, 1, 1], [1, 1, 1, 1]]);
  assert.equal(r.rc.purge({ bundleId: "PROJ-P" }).ok, true);
  assert.deepEqual([count("PROJ-P"), count("PROJ-S")], [[0, 0, 0, 0], [1, 1, 1, 1]]);
});

/* ===== the routes ===== */

test("R10 R14 R22 R12 (was credentials R54 R55 R57 R58): the T40 routes: `by` and `viewer` the stamps over the body; a key from the body only, never answered", async () => {
  const w = await projectWorld();
  assert.deepEqual(await w.ops("by=bob", { project: "P", key: KEY, by: "ann" }).projectkeyset(), notTheOwner("bob", "P"), "the stamp wins");
  const set = await w.ops("by=ann", { project: "P", key: KEY }).projectkeyset();
  assert.equal(set.ok, true);
  assert.deepEqual(w.ops("by=ann", { project: "P", on: true }).projectaccountswitch(), { ok: true, on: true });
  assert.equal(w.ops("by=ann", { owner: "project:P", switch: "draft", on: false, by: "bob" }).accountusesset().ok, true);
  assert.equal(w.ops("project=P&viewer=ann").projectaccountstate().uses.draft, false);
  assert.deepEqual(w.ops("project=P&viewer=bob").projectaccountstate(), { ok: true, on: true, serving: true });
  assert.equal(w.ops("project=P&viewer=bob").projectkeynotice().due, true);
  assert.equal(w.ops("by=bob", { project: "P", member: "ann" }).projectkeynoticeseen().ok, true, "the stamped member's, never the body's");
  assert.deepEqual([w.ops("project=P&viewer=bob").projectkeynotice().due, w.ops("project=P&viewer=ann").projectkeynotice().due], [false, true]);
  assert.equal(w.ops("by=cy", { project: "S" }).projectsigninset().ok, true);
  assert.equal(w.ops("by=ann", { project: "P", on: true, uses: ["run"], reason: "r" }).projectaikeepaway().ok, true);
  assert.deepEqual(w.ops("project=P&viewer=bob").projectaikeepawaystate().uses, ["run"]);
  assert.deepEqual(w.ops("by=ann", { project: "P" }).projectaccountremove(), { ok: true, removed: true });
  assert.ok(!JSON.stringify(set).includes(KEY));
});
