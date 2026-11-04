/* F1 (coordinator, 4 Nov): ai-accounts' compatibility seam. T53 removed names its users still call (ai-runs, ai-use,
   question-explorer, answers and their test worlds); each comes back here, deprecated, over the T53 model, and each test
   asserts what its old callers expect of it, read from those callers' own code and worlds (cited per test). Every name runs
   over ai-accounts' real world (real membership, record-core and ai-catalogue's published fixture). Each test has a negative
   control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, SECRET } from "./fixture.mjs";
import { PLANS as P, HOSTS, emptyCatalogue } from "./catalogue.mjs";
import { shape, refusal, ask, act, projectWorld, leaks } from "./helpers.mjs";
import { AiAccounts } from "../../../src/ai-accounts/index.mjs";
import { notAnAdmin } from "../../../src/membership/index.mjs";

const seen = (w, ...members) => { for (const m of members) w.a.recipientNoticeSeen({ member: m, provider: P.provider, host: HOSTS.main, by: m }); };
const TOKEN = (who) => `sk-ant-oat01-legacy-${who}-0123456789`;
/* R7's answer as T53 states it: the fields `accountFor` answers, in order, when a sealed account serves */
const R7_FIELDS = ["ok", "account_id", "level", "owner", "provider", "plan", "means", "entry_id", "entries", "member", "suggestions",
  "personal", "disclosed", "secret"];

test("F1 accountReferenceSet (deprecated; was R1): a member's own API key, by her own act, set and served at once as ai-runs' world and answers' and ai-use's fixtures expect ({ok}, then accountFor serves it at level member with `key` her key); a replacement keeps the one account; control: another member, a machine and a kind other than apikey are refused, nothing written", async () => {
  const w = await projectWorld();
  /* ai-runs test/m/ai-runs/world.mjs:173 and answers test/m/answers/fixtures.mjs:12: `member:<id>` and `by` its own */
  const set = await w.a.accountReferenceSet({ member: "member:bob", kind: "apikey", secret: SECRET("bob"), by: "member:bob" });
  assert.equal(set.ok, true, JSON.stringify(set));
  assert.deepEqual([set.kind, typeof set.set_at, typeof set.account_id], ["apikey", "string", "string"]);
  assert.equal(JSON.stringify(set).includes(SECRET("bob")), false, "never the secret");
  /* ai-runs src/ai-runs/index.mjs:3324: `a.ok`, a string `a.key`, `a.level` member, `a.kind` */
  const r = await w.a.accountFor({ member: "member:bob", act: ask("member:bob") });
  assert.deepEqual([r.ok, r.level, r.kind, r.key, r.owner, r.means, r.plan], [true, "member", "apikey", SECRET("bob"), "member:bob", "sealed", P.teamApi]);
  /* ai-use test/m/ai-use/fixture.mjs:115: the bare id */
  const again = await w.a.accountReferenceSet({ member: "bob", kind: "apikey", secret: SECRET("bob2"), by: "bob" });
  assert.equal(again.account_id, set.account_id, "replaced, not a second account");
  assert.equal((await w.a.accountFor({ member: "bob", act: ask("bob") })).key, SECRET("bob2"));
  assert.equal(w.a.accountsOf({ owner: "member:bob", viewer: "member:bob" }).accounts.length, 1);
  const before = w.snapshot();
  assert.deepEqual(shape(await w.a.accountReferenceSet({ member: "bob", kind: "apikey", secret: "sk-x", by: "ann" })), refusal("NOT_YOUR_ACCOUNT"));
  assert.deepEqual(shape(await w.a.accountReferenceSet({ member: "bob", kind: "apikey", secret: "sk-x", by: "class:ai" })), refusal("MACHINE_CANNOT_HOLD_ACCOUNT"));
  assert.deepEqual(shape(await w.a.accountReferenceSet({ member: "bob", kind: "subscription", secret: "sk-x", by: "bob" })), refusal("MEANS_NOT_ALLOWED"));
  assert.deepEqual(shape(await w.a.accountReferenceSet({ member: "bob", kind: "apikey", secret: "", by: "bob" })), refusal("NO_SECRET"));
  assert.equal(w.snapshot(), before, "no refusal writes");
});

test("F1 accountReferenceState (deprecated; was R2): to the member alone, whether her own key is held and whether her sign-in is connected, as ai-runs' #accountServing reads them (`held`, `subscription.connected`); never a secret; control: another member is NOT_YOUR_ACCOUNT, and before any set nothing is held", async () => {
  const w = await projectWorld();
  const as = "member:bob";
  const none = w.a.accountReferenceState({ member: as, viewer: as });
  assert.deepEqual([none.ok, none.held, none.subscription.connected], [true, false, false]);
  await w.a.accountReferenceSet({ member: as, kind: "apikey", secret: SECRET("bob"), by: as });
  const s = w.a.accountReferenceState({ member: as, viewer: as });
  assert.deepEqual([s.ok, s.held, s.kind, s.subscription.connected], [true, true, "apikey", false]);
  assert.deepEqual(s.uses, w.a.accountUses({ account_id: s.account_id, viewer: as }).uses);
  assert.equal((await w.a.subscriptionTokenHold({ member: "cy", token: TOKEN("cy") })).ok, true);
  const c = w.a.accountReferenceState({ member: "member:cy", viewer: "member:cy" });
  assert.deepEqual([c.held, c.subscription.connected, c.subscription.held], [false, true, true]);
  assert.equal(JSON.stringify([s, c]).includes(SECRET("bob")) || JSON.stringify(c).includes(TOKEN("cy")), false);
  assert.deepEqual(shape(w.a.accountReferenceState({ member: as, viewer: "member:ann" })), refusal("NOT_YOUR_ACCOUNT"));
  assert.deepEqual(shape(w.a.accountReferenceState({ member: as, viewer: "class:ai" })), refusal("NOT_YOUR_ACCOUNT"));
});

test("F1 groupKeySet, groupKeyState, groupKeySwitches (deprecated; were R5, R6, R9): an administrator sets the team's key, off when first set (ai-runs test/m/ai-runs/t48.test.mjs:28 {ok}); groupKeyState answers the administrator its facts and an active member `{on}` (ai-runs #accountServing); groupKeySwitches answers its switches (ai-runs' dispatch reads `suggestions`); accountFor serves it at level group with `key`; control: a plain member and a machine are NOT_AN_ADMIN, nothing written", async () => {
  const w = await projectWorld();
  assert.deepEqual(w.a.groupKeySwitches(), { on: false, suggestions: false, standing: false }, "none held: every switch off");
  const before = w.snapshot();
  for (const by of ["bob", "class:ai"])
    assert.deepEqual(shape(await w.a.groupKeySet({ key: "sk-team", by })), shape(notAnAdmin(by, "x")), by);
  assert.equal(w.snapshot(), before);
  const set = await w.a.groupKeySet({ key: SECRET("team"), by: "admin" });
  assert.equal(set.ok, true, JSON.stringify(set));
  assert.equal(JSON.stringify(set).includes(SECRET("team")), false);
  const g0 = w.a.groupKeyState({ viewer: "admin" });
  assert.deepEqual([g0.ok, g0.held, g0.on, g0.account_id], [true, true, false, set.account_id], "off when first set");
  assert.deepEqual(w.a.groupKeyState({ viewer: "member:bob" }), { ok: true, on: false });
  assert.equal(w.a.accountSwitch({ account_id: set.account_id, on: true, by: "admin" }).ok, true);
  assert.equal(w.a.accountUsesSet({ account_id: set.account_id, switch: "suggestions", on: true, by: "admin" }).ok, true);
  const g = w.a.groupKeyState({ viewer: "admin" });
  assert.deepEqual([g.held, g.on, g.by, g.suggestions, g.standing, g.uses.suggestions], [true, true, "admin", true, false, true]);
  assert.deepEqual(w.a.groupKeyState({ viewer: "member:bob" }), { ok: true, on: true });
  assert.deepEqual(w.a.groupKeySwitches(), { on: true, suggestions: true, standing: false });
  assert.deepEqual(shape(w.a.groupKeyState({ viewer: "class:ai" })), shape(notAnAdmin("class:ai", "x")));
  /* a replacement keeps the one account and its switch (was R5) */
  const again = await w.a.groupKeySet({ key: SECRET("team2"), by: "second" });
  assert.deepEqual([again.account_id, w.a.groupKeyState({ viewer: "admin" }).on], [set.account_id, true]);
  seen(w, "eve");
  const r = await w.a.accountFor({ member: "eve", act: ask("eve") });
  assert.deepEqual([r.level, r.kind, r.key], ["group", "apikey", SECRET("team2")]);
  assert.equal(JSON.stringify([g, w.a.groupKeySwitches()]).includes(SECRET("team")), false);
});

test("F1 projectKeySet (deprecated; was R10): a project's owner sets its key, off when first set, and once on it serves a joined member's act in the project at level project with `key` (ai-runs test/m/ai-runs/reexam.test.mjs:143, answers test/m/answers/accounts.test.mjs:50); control: a joined participant who is not an owner is PROJECT_ACT_NOT_THE_OWNER, nothing written", async () => {
  const w = await projectWorld();
  const before = w.snapshot();
  assert.equal((await w.a.projectKeySet({ project: "P", key: "sk-p", by: "bob" })).reason, "PROJECT_ACT_NOT_THE_OWNER");
  assert.equal(w.snapshot(), before);
  const set = await w.a.projectKeySet({ project: "P", key: SECRET("P"), by: "member:ann" });
  assert.deepEqual([set.ok, set.project, set.kind], [true, "P", "apikey"], JSON.stringify(set));
  assert.equal(w.a.accountState({ account_id: set.account_id, viewer: "ann" }).on, false, "off when first set");
  assert.equal(w.a.accountSwitch({ account_id: set.account_id, on: true, by: "ann" }).ok, true);
  seen(w, "bob");
  const r = await w.a.accountFor({ member: "bob", act: ask("bob", "P") });
  assert.deepEqual([r.level, r.project, r.kind, r.key], ["project", "P", "apikey", SECRET("P")]);
  assert.equal((await w.a.projectKeySet({ project: "P", key: SECRET("P2"), by: "ann" })).account_id, set.account_id, "replaced");
});

test("F1 subscriptionTokenHold (deprecated; was R19): an active member's sign-in token held sealed, in-plane, by no `by` (ai-runs world.mjs:181, answers standing.test.mjs:362): the member's issued account of the catalogue's subscription plan, served to her own act as `kind` signin with `key` the token; a second hold replaces the token on the same account; control: a member not active, and a token outside the plan's bounds, refuse and write nothing", async () => {
  const w = await projectWorld();
  const before = w.snapshot();
  assert.deepEqual(shape(await w.a.subscriptionTokenHold({ member: "nobody", token: TOKEN("x") })), refusal("ACCOUNT_MEMBER_NOT_ACTIVE"));
  assert.deepEqual(shape(await w.a.subscriptionTokenHold({ member: "cy", token: "short" })), refusal("ISSUED_TOKEN_MALFORMED"));
  assert.equal(w.snapshot(), before);
  const h = await w.a.subscriptionTokenHold({ member: "member:cy", token: TOKEN("cy"), validFor: "1 year" });
  assert.equal(h.ok, true, JSON.stringify(h));
  assert.equal(typeof h.since, "string");
  assert.equal(JSON.stringify(h).includes(TOKEN("cy")), false);
  const st = w.a.accountState({ account_id: h.account_id, viewer: "cy" });
  assert.deepEqual([st.plan, st.means, st.held, st.on, st.personal], [P.subscription, "issued", true, true, true]);
  const r = await w.a.accountFor({ member: "cy", act: act("run", "cy") });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual([r.level, r.kind, r.key], ["member", "signin", TOKEN("cy")]);
  const again = await w.a.subscriptionTokenHold({ member: "cy", token: TOKEN("cy2") });
  assert.equal(again.account_id, h.account_id);
  assert.equal((await w.a.accountFor({ member: "cy", act: ask("cy") })).key, TOKEN("cy2"));
});

test("F1 accountUsesOf({owner}) (deprecated old form, beside R17's {account_id}): the owner's head account's uses, as ai-use's #exploreOf (src/ai-use/index.mjs:540) and question-explorer's #switchedOff (src/question-explorer/index.mjs:361) read it: `held`, `uses.explore`; the team with none its defaults, `held: false`; a revoked member `held: false, uses: null`; control: the new form is unchanged, and an unreadable store answers `unreadable`, never defaults", async () => {
  const w = await projectWorld();
  assert.deepEqual(w.a.accountUsesOf({ owner: "member:bob" }), { ok: true, owner: "member:bob", account_id: null, held: false, uses: null,
    accounts: { reference: { held: false, uses: null }, signin: { held: false, uses: null } } });
  const g = w.a.accountUsesOf({ owner: "group" });
  assert.deepEqual([g.held, g.uses.explore], [false, "no"], "the team's defaults with held false (ai-use reads held)");
  const set = await w.a.accountReferenceSet({ member: "bob", kind: "apikey", secret: SECRET("bob"), by: "bob" });
  assert.equal(w.a.accountUsesSet({ account_id: set.account_id, switch: "explore", on: "yes", by: "bob" }).ok, true);
  const u = w.a.accountUsesOf({ owner: "member:bob" });
  assert.deepEqual([u.ok, u.held, u.account_id, u.uses.explore, u.accounts.reference.held, u.accounts.signin.held], [true, true, set.account_id, "yes", true, false]);
  assert.deepEqual(w.a.accountUsesOf({ account_id: set.account_id }), { ok: true, account_id: set.account_id, owner: "member:bob", held: true,
    uses: u.uses }, "the T53 form unchanged");
  assert.deepEqual(w.a.accountUsesOf({ owner: "nonsense" }), { ok: true, owner: "nonsense", held: false, uses: null });
  w.m.memberSet({ memberId: "eve", status: "revoked", by: "admin" });
  const ev = w.a.accountUsesOf({ owner: "member:eve" });
  assert.deepEqual([ev.held, ev.uses], [false, null]);
  const broken = new AiAccounts({ sql: { exec() { throw new Error("down"); } }, membership: w.m });
  assert.deepEqual(broken.accountUsesOf({ owner: "member:bob" }), { ok: true, owner: "member:bob", held: null, uses: null, unreadable: true });
});

test("F1 accountFor's old {key} form (deprecated): a served account handing a secret answers `key` and `kind` beside R7's answer, non-enumerable, so R7's own fields are exactly T53's (compared, spread and serialised); control: a refusal, and an account whose means hands no secret, carry neither", async () => {
  const w = await projectWorld();
  seen(w, "bob");
  const own = await w.own("bob");
  w.a.accountSwitch({ account_id: own.account_id, on: true, by: "bob" });
  const r = await w.a.accountFor({ member: "bob", act: ask("bob") });
  assert.deepEqual(Object.keys(r), R7_FIELDS, "R7's fields, unchanged");
  assert.deepEqual([r.key, r.kind], [SECRET("bob"), "apikey"]);
  assert.equal("key" in { ...r }, false, "a spread copy carries no old field");
  assert.equal(JSON.parse(JSON.stringify(r)).key, undefined);
  const none = await w.a.accountFor({ member: "eve", act: ask("eve") });
  assert.deepEqual([shape(none), none.key, none.kind], [refusal("NO_ACCOUNT"), undefined, undefined]);
  const ref = await w.own("ann", { means: "reference", secret: null, reference: { store: "vault", locator: "ann/key" }, plan: P.memberApi });
  assert.equal(ref.ok, true, JSON.stringify(ref));
  w.a.accountSwitch({ account_id: ref.account_id, on: true, by: "ann" });
  seen(w, "ann");
  const rr = await w.a.accountFor({ member: "ann", act: ask("ann") });
  assert.deepEqual([rr.ok, rr.means, rr.key, rr.kind], [true, "reference", undefined, undefined]);
});

test("F1 fail closed (R63): with the catalogue unreadable, every old act that sets an account refuses CATALOGUE_UNAVAILABLE after the owner's authority, writing nothing; control: the authority's refusal still comes first", async () => {
  const w = await world({ catalogue: await emptyCatalogue() }).group("ann", "bob");
  w.project("P", "ann");
  const before = w.snapshot();
  const code = (r) => r.code ?? r.reason;
  assert.equal(code(await w.a.groupKeySet({ key: "sk-team", by: "admin" })), "CATALOGUE_UNAVAILABLE");
  assert.equal(code(await w.a.projectKeySet({ project: "P", key: "sk-p", by: "ann" })), "CATALOGUE_UNAVAILABLE");
  assert.equal(code(await w.a.accountReferenceSet({ member: "bob", kind: "apikey", secret: "sk-b", by: "bob" })), "CATALOGUE_UNAVAILABLE");
  assert.equal(code(await w.a.subscriptionTokenHold({ member: "bob", token: TOKEN("bob") })), "CATALOGUE_UNAVAILABLE");
  assert.equal(code(await w.a.groupKeySet({ key: "sk-team", by: "bob" })), "NOT_AN_ADMIN");
  assert.equal(w.snapshot(), before);
});

/* ===== the names BOB's ruling of 05:02 (4 Nov) added to F1 ===== */

test("F1 accountUsesSet({owner}) (deprecated old form, beside R14's {account_id}): sets the switch on the owner's head account, as its callers set it: ai-use t42.test.mjs:60-62, t44.test.mjs:19, explore.test.mjs:11, reads.test.mjs:181, limits.test.mjs:205,210, t43.test.mjs:81 (explore on group, project:P and member); answers accounts.test.mjs:38,126,173, standing.test.mjs:157,189,254,394; ai-runs t48.test.mjs:31,33, scheduler.test.mjs:185,197,203; question-explorer fixture.mjs:378, choosing.test.mjs:129; reading-pipeline transcribe.test.mjs:170,293; store-door dispatch.test.mjs:624, routes.test.mjs:185; notice-producers accounts.test.mjs:150; store-assembly's through credentials ({ok}); control: R14's refusals unchanged, an owner holding none NO_ACCOUNT after its authority, nothing written", async () => {
  const w = await projectWorld();
  const own = await w.a.accountReferenceSet({ member: "bob", kind: "apikey", secret: SECRET("bob"), by: "bob" });
  const team = await w.a.groupKeySet({ key: SECRET("team"), by: "admin" });
  const proj = await w.a.projectKeySet({ project: "P", key: SECRET("P"), by: "ann" });
  for (const [owner, sw, on, by, id] of [["member:bob", "ask", false, "member:bob", own.account_id], ["group", "explore", "yes", "admin", team.account_id],
                                         ["project:P", "explore", "ask", "ann", proj.account_id], ["group", "standing", true, "admin", team.account_id],
                                         ["member:bob", "suggestions", true, "bob", own.account_id]]) {
    const r = w.a.accountUsesSet({ owner, switch: sw, on, by });
    assert.deepEqual([r.ok, r.account_id, r.switch, r.on], [true, id, sw, on], `${owner} ${sw}`);
    assert.equal(w.a.accountUsesOf({ account_id: id }).uses[sw], on, "read back through R17's T53 form");
  }
  const before = w.snapshot();
  assert.deepEqual(shape(w.a.accountUsesSet({ owner: "member:bob", switch: "ask", on: true, by: "ann" })), refusal("NOT_YOUR_ACCOUNT"));
  assert.equal(w.a.accountUsesSet({ owner: "project:P", switch: "ask", on: true, by: "bob" }).reason, "PROJECT_ACT_NOT_THE_OWNER");
  assert.deepEqual(shape(w.a.accountUsesSet({ owner: "group", switch: "ask", on: true, by: "bob" })), shape(notAnAdmin("bob", "x")));
  assert.deepEqual(shape(w.a.accountUsesSet({ owner: "group", switch: "nope", on: true, by: "admin" })), refusal("UNKNOWN_SWITCH"));
  assert.deepEqual(shape(w.a.accountUsesSet({ owner: "group", switch: "explore", on: "maybe", by: "admin" })), refusal("SWITCH_VALUE_INVALID"));
  assert.deepEqual(shape(w.a.accountUsesSet({ owner: "member:cy", switch: "ask", on: false, by: "cy" })), refusal("NO_ACCOUNT"), "she holds none");
  assert.deepEqual(shape(w.a.accountUsesSet({ owner: "member:cy", switch: "ask", on: false, by: "ann" })), refusal("NOT_YOUR_ACCOUNT"), "authority first");
  assert.equal(w.snapshot(), before, "no refusal writes");
  assert.deepEqual(shape(w.a.accountUsesSet({ switch: "ask", on: true, by: "admin" })), refusal("NOT_YOUR_ACCOUNT"), "R37's form, unchanged");
});

test("F1 accountUses({owner}) (deprecated old form, beside R15's {account_id}): the owner's head account as R15 answers it, with `kind` and a member's `accounts: {reference, signin}`, as ai-use's #accountsBar and #isSignin (src/ai-use/index.mjs:514,571) and ai-runs' dispatch (src/ai-runs/index.mjs:2215) read it, and ai-use reads.test.mjs:133, t48.test.mjs:123, limits.test.mjs:73 and question-explorer choosing.test.mjs:153 compare refusals with it; control: its refusals are R15's owners' refusals, the team with none answers its owners its defaults, and an unreadable store answers `unreadable`", async () => {
  const w = await projectWorld();
  const g0 = w.a.accountUses({ owner: "group", viewer: "admin" });
  assert.deepEqual([g0.ok, g0.held, g0.uses.ask, g0.kind, Array.isArray(g0.keptAway)], [true, false, true, null, true]);
  const own = await w.a.accountReferenceSet({ member: "bob", kind: "apikey", secret: SECRET("bob"), by: "bob" });
  w.a.accountUsesSet({ owner: "member:bob", switch: "suggestions", on: true, by: "bob" });
  const b = w.a.accountUses({ owner: "member:bob", viewer: "member:bob" });
  const t53 = w.a.accountUses({ account_id: own.account_id, viewer: "bob" });
  assert.deepEqual([b.ok, b.account_id, b.held, b.kind, b.uses, b.keptAway], [true, own.account_id, true, "apikey", t53.uses, t53.keptAway]);
  assert.deepEqual([b.accounts.reference.held, b.accounts.reference.uses.suggestions, b.accounts.signin.held], [true, true, false],
    "ai-runs reads accounts.reference.uses.suggestions");
  assert.equal("kind" in t53 || "accounts" in t53, false, "the T53 form is unchanged");
  assert.equal((await w.a.subscriptionTokenHold({ member: "cy", token: TOKEN("cy") })).ok, true);
  const c = w.a.accountUses({ owner: "member:cy", viewer: "cy" });
  assert.deepEqual([c.kind, c.accounts.signin.held, c.accounts.reference.held], ["signin", true, false], "ai-use's #isSignin");
  for (const [owner, viewer, code] of [["member:ann", "bob", "NOT_YOUR_ACCOUNT"], ["member:ann", "admin", "NOT_YOUR_ACCOUNT"],
                                       ["project:P", "bob", "PROJECT_ACT_NOT_THE_OWNER"], ["group", "ann", "NOT_AN_ADMIN"],
                                       ["group", null, null], ["group", "machine:agent", null]]) {
    const r = w.a.accountUses({ owner, viewer });
    assert.equal(r.ok, false, `${owner} ${viewer}`);
    if (code) assert.equal(r.code, code, `${owner} ${viewer}`);
  }
  for (const [owner, viewer] of [["member:ann", "ann"], ["project:P", "ann"], ["group", "admin"]])
    assert.equal(w.a.accountUses({ owner, viewer }).ok, true, `${owner} ${viewer}: an owner reads`);
  const broken = new AiAccounts({ sql: { exec() { throw new Error("down"); } }, membership: w.m });
  const u = broken.accountUses({ owner: "group", viewer: "admin" });
  assert.equal(u.ok === false || u.unreadable === true, true, "never defaults from a store that cannot be read");
});

test("F1 groupKeySwitch and projectAccountSwitch (deprecated; were R5's and R10's switches): the master switch of the team's key account and of a project's head account, by `accountSwitch`, as ai-runs t48.test.mjs:29,57, t46.test.mjs:144, usage.test.mjs:320,350,367, scheduler.test.mjs:139,213, reexam.test.mjs:144, answers standing.test.mjs:187, accounts.test.mjs:51, reading-pipeline transcribe.test.mjs:70,296, store-assembly ask.test.mjs:194,296, store-door routes.test.mjs:203,272, declared-ops.test.mjs:28 and control-plane t34-routes.test.mjs:251,268 switch them ({ok}, sync or awaited), after which the account serves; control: a non-administrator and a non-owner are refused, an owner holding none NO_ACCOUNT, nothing written", async () => {
  const w = await projectWorld();
  const before = w.snapshot();
  assert.deepEqual(shape(w.a.groupKeySwitch({ on: true, by: "admin" })), refusal("NO_ACCOUNT"));
  assert.deepEqual(shape(w.a.groupKeySwitch({ on: true, by: "bob" })), shape(notAnAdmin("bob", "x")));
  assert.deepEqual(shape(w.a.projectAccountSwitch({ project: "P", on: true, by: "ann" })), refusal("NO_ACCOUNT"));
  assert.equal(w.a.projectAccountSwitch({ project: "P", on: true, by: "bob" }).reason, "PROJECT_ACT_NOT_THE_OWNER");
  assert.equal(w.snapshot(), before);
  const team = await w.a.groupKeySet({ key: SECRET("team"), by: "admin" });
  seen(w, "eve", "bob");
  assert.deepEqual(shape(await w.a.accountFor({ member: "eve", act: ask("eve") })), refusal("NO_ACCOUNT"), "held but off");
  const s = w.a.groupKeySwitch({ on: true, by: "admin" });
  assert.deepEqual([s.ok, s.account_id, s.on], [true, team.account_id, true]);
  assert.equal((await w.a.accountFor({ member: "eve", act: ask("eve") })).key, SECRET("team"));
  assert.deepEqual(shape(w.a.groupKeySwitch({ on: true, by: "bob" })), shape(notAnAdmin("bob", "x")));
  assert.equal(w.a.groupKeySwitch({ on: false, by: "admin" }).on, false);
  assert.deepEqual(shape(await w.a.accountFor({ member: "eve", act: ask("eve") })), refusal("NO_ACCOUNT"), "off again: scheduler.test.mjs:213");
  const proj = await w.a.projectKeySet({ project: "P", key: SECRET("P"), by: "ann" });
  assert.equal(w.a.projectAccountSwitch({ project: "P", on: true, by: "bob" }).reason, "PROJECT_ACT_NOT_THE_OWNER");
  const p = w.a.projectAccountSwitch({ project: "P", on: true, by: "member:ann" });
  assert.deepEqual([p.ok, p.account_id, p.on], [true, proj.account_id, true]);
  const r = await w.a.accountFor({ member: "bob", act: ask("bob", "P") });
  assert.deepEqual([r.level, r.key], ["project", SECRET("P")]);
});

test("F1 groupKeyNoticeSeen and projectKeyNoticeSeen (deprecated; were R8's and R12's): the member's own act recording seen the recipients of the catalogue's Anthropic API plan (R51), as `migrate` carries a seen key notice (R59), so the team's or a project's key then serves her act, as ai-runs t48.test.mjs:30,58, t46.test.mjs:145, usage.test.mjs:327,373, scheduler.test.mjs:140, reexam.test.mjs:145, answers standing.test.mjs:192, accounts.test.mjs:52, reading-pipeline transcribe.test.mjs:149,453, store-assembly ask.test.mjs:199,297, store-door routes.test.mjs:209,273, declared-ops.test.mjs:29 and control-plane t34-routes.test.mjs:257,269 expect ({ok}); control: before it the head is refused RECIPIENT_NOTICE_DUE; another member's act, a machine, and an unreadable catalogue are refused, nothing written", async () => {
  const w = await projectWorld();
  const team = await w.a.groupKeySet({ key: SECRET("team"), by: "admin" });
  w.a.accountSwitch({ account_id: team.account_id, on: true, by: "admin" });
  assert.equal((await w.a.accountFor({ member: "eve", act: ask("eve") })).code, "RECIPIENT_NOTICE_DUE");
  const before = w.snapshot();
  assert.deepEqual(shape(w.a.groupKeyNoticeSeen({ member: "member:eve", by: "member:ann" })), refusal("NOT_YOUR_ACCOUNT"));
  assert.deepEqual(shape(w.a.groupKeyNoticeSeen({ member: "eve", by: "class:ai" })), refusal("MACHINE_CANNOT_HOLD_ACCOUNT"));
  assert.equal(w.snapshot(), before);
  const s = w.a.groupKeyNoticeSeen({ member: "member:eve", by: "member:eve" });
  assert.equal(s.ok, true, JSON.stringify(s));
  assert.ok(s.recipients.some((r) => r.provider === P.provider && r.host === HOSTS.main));
  assert.equal(w.a.recipientNoticeDue({ member: "eve", entry_id: (await w.a.accountFor({ member: "eve", act: ask("eve") })).entry_id }), null);
  assert.equal((await w.a.accountFor({ member: "eve", act: ask("eve") })).key, SECRET("team"));
  const proj = await w.a.projectKeySet({ project: "P", key: SECRET("P"), by: "ann" });
  w.a.accountSwitch({ account_id: proj.account_id, on: true, by: "ann" });
  assert.equal((await w.a.accountFor({ member: "bob", act: ask("bob", "P") })).code, "RECIPIENT_NOTICE_DUE");
  assert.equal(w.a.projectKeyNoticeSeen({ member: "bob", project: "P", by: "bob" }).ok, true, "sync, as transcribe.test.mjs:149 calls it");
  assert.equal((await w.a.accountFor({ member: "bob", act: ask("bob", "P") })).key, SECRET("P"));
  const x = await world({ catalogue: await emptyCatalogue() }).group("ann");
  assert.equal(x.a.groupKeyNoticeSeen({ member: "ann", by: "ann" }).code, "CATALOGUE_UNAVAILABLE", "fail closed (R63)");
});

test("F1 accountReferenceRemove (deprecated; was R1's remove): the member's own key account removed by `accountRemove`, by her own act, after which nothing serves her (ai-runs scheduler.test.mjs:219 then expects NO_ACCOUNT); control: another member and a machine are refused, a member holding none NO_ACCOUNT, nothing written, and her other account stands (R31)", async () => {
  const w = await projectWorld();
  const own = await w.a.accountReferenceSet({ member: "member:ann", kind: "apikey", secret: SECRET("ann"), by: "member:ann" });
  seen(w, "ann");
  assert.equal((await w.a.accountFor({ member: "ann", act: ask("ann") })).key, SECRET("ann"));
  const before = w.snapshot();
  assert.deepEqual(shape(w.a.accountReferenceRemove({ member: "member:ann", by: "member:bob" })), refusal("NOT_YOUR_ACCOUNT"));
  assert.deepEqual(shape(w.a.accountReferenceRemove({ member: "member:ann", by: "class:ai" })), refusal("MACHINE_CANNOT_HOLD_ACCOUNT"));
  assert.deepEqual(shape(w.a.accountReferenceRemove({ member: "member:bob", by: "member:bob" })), refusal("NO_ACCOUNT"));
  assert.equal(w.snapshot(), before);
  const r = await w.a.accountReferenceRemove({ member: "member:ann", by: "member:ann" });
  assert.deepEqual([r.ok, r.account_id, r.removed], [true, own.account_id, true]);
  assert.deepEqual(shape(await w.a.accountFor({ member: "ann", act: ask("ann") })), refusal("NO_ACCOUNT"));
  assert.deepEqual(leaks(w, SECRET("ann")), [], "no secret left anywhere");
  assert.equal((await w.a.subscriptionTokenHold({ member: "cy", token: TOKEN("cy") })).ok, true);
  assert.deepEqual(shape(w.a.accountReferenceRemove({ member: "cy", by: "cy" })), refusal("NO_ACCOUNT"), "a sign-in is no key");
  assert.equal(w.a.accountReferenceState({ member: "cy", viewer: "cy" }).subscription.held, true, "her sign-in stands");
});

test("F1 projectAccountState (deprecated; was R10's state): a project's owners read whether its account is held, as question-explorer's fixture.mjs:373 reads `.held` before setting one; its joined participants `{on}`; control: a stranger is refused as `accountsOf` refuses, and the answer carries no secret", async () => {
  const w = await projectWorld();
  const none = w.a.projectAccountState({ project: "P", viewer: "member:ann" });
  assert.deepEqual([none.ok, none.held, none.on, none.account_id], [true, false, false, null]);
  const set = await w.a.projectKeySet({ project: "P", key: SECRET("P"), by: "member:ann" });
  const s = w.a.projectAccountState({ project: "P", viewer: "member:ann" });
  assert.deepEqual([s.ok, s.held, s.on, s.kind, s.account_id, s.set_at], [true, true, false, "apikey", set.account_id, set.set_at]);
  w.a.accountSwitch({ account_id: set.account_id, on: true, by: "ann" });
  assert.deepEqual(w.a.projectAccountState({ project: "P", viewer: "bob" }), { ok: true, project: "P", account_id: set.account_id, on: true });
  const stranger = w.a.projectAccountState({ project: "P", viewer: "eve" });
  assert.deepEqual([stranger.ok, stranger.code], [false, w.a.accountsOf({ owner: "project:P", viewer: "eve" }).code]);
  assert.equal(JSON.stringify(s).includes(SECRET("P")), false);
});

test("F1 subscriptionConnected (deprecated; was R18's connected fact): an active member's sign-in reported connected, which with no token serves nothing (R59: a connected fact with no held token is held false), as answers standing.test.mjs:358 expects (ok, then accountFor NO_ACCOUNT, then subscriptionTokenHold serves her) and ai-runs world.mjs:179 and notice-producers accounts.test.mjs:27 call it before the hold; control: it writes nothing, and a member not active, or a machine, is refused ACCOUNT_MEMBER_NOT_ACTIVE", async () => {
  const w = await projectWorld();
  const before = w.snapshot();
  const c = w.a.subscriptionConnected({ member: "member:cy" });
  assert.deepEqual([c.ok, c.connected, c.held, c.account_id], [true, true, false, null]);
  assert.equal(w.snapshot(), before, "nothing written");
  assert.deepEqual(shape(await w.a.accountFor({ member: "cy", act: act("standing", "cy") })), refusal("NO_ACCOUNT"), "the connected fact alone serves no one");
  assert.deepEqual(shape(w.a.subscriptionConnected({ member: "nobody" })), refusal("ACCOUNT_MEMBER_NOT_ACTIVE"));
  assert.deepEqual(shape(w.a.subscriptionConnected({ member: "class:ai" })), refusal("ACCOUNT_MEMBER_NOT_ACTIVE"));
  const h = await w.a.subscriptionTokenHold({ member: "cy", token: TOKEN("cy") });
  assert.equal(h.ok, true);
  const again = w.a.subscriptionConnected({ member: "cy" });
  assert.deepEqual([again.held, again.account_id], [true, h.account_id]);
  const r = await w.a.accountFor({ member: "cy", act: act("run", "cy") });
  assert.deepEqual([r.ok, r.kind, r.key], [true, "signin", TOKEN("cy")]);
});
