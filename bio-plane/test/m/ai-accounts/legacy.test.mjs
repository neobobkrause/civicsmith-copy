/* F1 (coordinator, 4 Nov): ai-accounts' compatibility seam. T53 removed names its users still call (ai-runs, ai-use,
   question-explorer, answers and their test worlds); each comes back here, deprecated, over the T53 model, and each test
   asserts what its old callers expect of it, read from those callers' own code and worlds (cited per test). Every name runs
   over ai-accounts' real world (real membership, record-core and ai-catalogue's published fixture). Each test has a negative
   control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, SECRET } from "./fixture.mjs";
import { PLANS as P, HOSTS, emptyCatalogue } from "./catalogue.mjs";
import { shape, refusal, ask, act, projectWorld } from "./helpers.mjs";
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
