/* ai-accounts R1, R2, R3, R5, R6, R10, R31, R38, R40, R43 at the interface: an account is an owner's plan at a provider,
   reached by one of five means, held by the owner's own authority, sealed at rest, and read back to its owners alone. Every
   id is tested with a negative control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, SECRET, SEAL } from "./fixture.mjs";
import { PLANS, ENTRIES, HOSTS } from "./catalogue.mjs";
import { shape, refusal, ask, act, projectWorld, on, leaks, DEFAULTS } from "./helpers.mjs";
import { AI_ACCOUNT_CHECKS, REFERENCE_MAX_CHARS, aiAccountsOf } from "../../../src/ai-accounts/index.mjs";
import { notAnAdmin, notTheOwner, noSuchProject } from "../../../src/membership/index.mjs";

const P = PLANS;
const setOf = (w, owner, by, more = {}) => w.a.accountSet({ owner, provider: P.provider, plan: P.memberApi, means: "sealed", secret: SECRET(by), by, ...more });

test("R40 R1 R5 R10: a member, a project and the team each set an account: `{ok, account_id, owner, provider, plan, means, entries, on: false, held, set_at}`, never a secret; it is appended to its owner's list and recorded; an omitted means is `gateway` for a team or project account of an API plan that allows it, `sealed` for a member's; the entries omitted are the plan's, in catalogue order", async () => {
  const w = await projectWorld();
  w.a.registerGatewayStore("test-root", { create: async () => "gw-1", put: async () => ({ ok: true }), exists: async () => true });
  const m = await w.a.accountSet({ owner: "member:ann", provider: P.provider, plan: P.memberApi, secret: SECRET("ann"), by: "ann" });
  assert.deepEqual({ ...m, set_at: null }, { ok: true, account_id: m.account_id, owner: "member:ann", provider: P.provider, plan: P.memberApi,
    means: "sealed", entries: [ENTRIES.a, ENTRIES.b], on: false, held: true, set_at: null });
  assert.match(m.set_at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  const t = await w.a.accountSet({ owner: "group", provider: P.provider, plan: P.teamApi, by: "admin" });
  assert.deepEqual([t.ok, t.means, t.held, t.on], [true, "gateway", false, false], "the team's default means is the gateway, no key held yet");
  const p = await w.a.accountSet({ owner: "project:P", provider: P.provider, plan: P.teamApi, means: "sealed", secret: SECRET("P"), by: "ann" });
  assert.deepEqual([p.ok, p.owner, p.means, p.held], [true, "project:P", "sealed", true]);
  assert.deepEqual(w.a.accountsOf({ owner: "member:ann", viewer: "ann" }).accounts.map((x) => [x.account_id, x.position]), [[m.account_id, 1]]);
  const second = await setOf(w, "member:ann", "ann", { plan: P.memberApi, entries: [ENTRIES.b] });
  assert.deepEqual(w.a.accountsOf({ owner: "member:ann", viewer: "ann" }).accounts.map((x) => [x.account_id, x.position]), [[m.account_id, 1], [second.account_id, 2]]);
  const hist = w.a.accountHistory({ owner: "member:ann", viewer: "ann" }).changes.filter((c) => c.change === "account_set");
  assert.equal(hist.length, 2);
  assert.deepEqual([hist[0].by, hist[0].level, hist[0].account_id, hist[0].means], ["ann", "member", m.account_id, "sealed"]);
  const before = w.snapshot();
  assert.equal((await w.a.accountSet({ owner: "member:ann", provider: P.provider, plan: "no-such-plan", secret: "s", by: "ann" })).reason, "UNKNOWN_PLAN");
  assert.equal((await w.a.accountSet({ owner: "member:ann", provider: "nobody", plan: P.memberApi, secret: "s", by: "ann" })).reason, "UNKNOWN_PLAN");
  assert.equal(w.snapshot(), before, "no refusal leaves a row");
});

test("R1 R40: the owner's authority is asked first: a machine credential or operator token MACHINE_CANNOT_HOLD_ACCOUNT; any other member, an administrator or the founder included, NOT_YOUR_ACCOUNT; a member not active ACCOUNT_MEMBER_NOT_ACTIVE; an empty secret NO_SECRET; then DISCLOSURE_DUE while the disclosure is not recorded; each refusal writing nothing; the answer never a secret", async () => {
  const w = await projectWorld();
  w.m.memberSet({ memberId: "eve", status: "revoked", by: "admin" });
  const before = w.snapshot();
  for (const by of [null, "", "class:ai", "token:ai", "class:admin"])
    assert.deepEqual(shape(await setOf(w, "member:ann", by)), refusal("MACHINE_CANNOT_HOLD_ACCOUNT"), String(by));
  for (const by of ["bob", "second", "admin", "ann-not"])
    assert.deepEqual(shape(await setOf(w, "member:ann", by)), refusal("NOT_YOUR_ACCOUNT"), by);
  assert.equal((await setOf(w, "member:eve", "eve")).reason, "ACCOUNT_MEMBER_NOT_ACTIVE");
  for (const secret of [undefined, null, "", "   "]) assert.deepEqual(shape(await setOf(w, "member:ann", "ann", { secret })), refusal("NO_SECRET"), String(secret));
  assert.equal(w.snapshot(), before, "each refusal writes nothing");
  w.a.registerDisclosureRead("instance-setup", ({ member }) => ({ shown: member === "bob" }));
  assert.equal((await setOf(w, "member:ann", "ann")).reason, "DISCLOSURE_DUE");
  assert.equal((await setOf(w, "member:ann", "ann", { secret: "" })).reason, "NO_SECRET", "after the refusals above");
  assert.equal((await setOf(w, "member:ann", "bob")).reason, "NOT_YOUR_ACCOUNT");
  assert.equal(w.snapshot(), before);
  const ok = await setOf(w, "member:bob", "bob");
  assert.equal(ok.ok, true, "shown to bob");
  assert.ok(!JSON.stringify(ok).includes(SECRET("bob")));
  assert.equal((await w.team()).ok, true, "the team's is asked no disclosure");
});

test("R1 R31: accountRemove: the same refusals, never DISCLOSURE_DUE, removes one account and takes it out of every list; a removed sealed account leaves no secret anywhere; removing one of a member's two accounts leaves the other serving; the claimed founder sets and removes as a member does", async () => {
  const w = await projectWorld();
  const a1 = await on(w, w.own("ann"));
  const a2 = await on(w, setOf(w, "member:ann", "ann", { entries: [ENTRIES.b] }));
  w.a.recipientNoticeSeen({ member: "ann", provider: "anthropic", host: HOSTS.main, by: "ann" });
  const before = w.snapshot();
  for (const by of [null, "class:ai"]) assert.deepEqual(shape(w.a.accountRemove({ account_id: a1.account_id, by })), refusal("MACHINE_CANNOT_HOLD_ACCOUNT"));
  for (const by of ["bob", "second", "admin"]) assert.deepEqual(shape(w.a.accountRemove({ account_id: a1.account_id, by })), refusal("NOT_YOUR_ACCOUNT"));
  assert.equal(w.a.accountRemove({ account_id: "acct-none", by: "ann" }).reason, "NOT_YOUR_ACCOUNT");
  assert.equal(w.snapshot(), before);
  w.a.registerDisclosureRead("instance-setup", () => ({ shown: false }));
  assert.deepEqual(w.a.accountRemove({ account_id: a1.account_id, by: "ann" }), { ok: true, account_id: a1.account_id, removed: true }, "never DISCLOSURE_DUE");
  assert.deepEqual(leaks(w, SECRET("ann"), { allow: ["ai_accounts.sealed"] }).filter((x) => x !== "ai_accounts.sealed"), []);
  assert.equal(w.row(`SELECT COUNT(*) AS n FROM ai_accounts WHERE account_id=?`, a1.account_id).n, 0);
  assert.equal(w.row(`SELECT COUNT(*) AS n FROM ai_account_lists WHERE account_id=?`, a1.account_id).n, 0);
  assert.equal((await w.a.accountFor({ member: "ann", act: ask("ann") })).account_id, a2.account_id, "the other still serves (R31)");
  const w3 = await world().group();
  const f = await w3.a.accountSet({ owner: "member:admin", provider: P.provider, plan: P.memberApi, secret: SECRET("admin"), by: "admin" });
  assert.equal(f.ok, true, JSON.stringify(f));
  assert.equal(w3.a.accountRemove({ account_id: f.account_id, by: "admin" }).ok, true);
  const w2 = world();
  assert.equal((await w2.a.accountSet({ owner: "member:admin", provider: P.provider, plan: P.memberApi, secret: "s", by: "admin" })).reason, "ACCOUNT_MEMBER_NOT_ACTIVE", "control: unclaimed");
});

test("R2 R64: a secret an account holds is stored only encrypted (AES-256-GCM under its owner), and is in no answer, list, log, history row, error or export, nor a digest or base64 of it; a `reference` account stores its pointer only, a `gateway` account no secret, a `none` account nothing; accountState and accountsOf answer the owners the account and any other viewer is refused", async () => {
  const w = await projectWorld();
  w.a.registerGatewayStore("root", { create: async () => "gw-9", put: async () => true, exists: async () => true });
  const seen = [];
  const sealed = await w.own("ann"); seen.push(sealed);
  const ref = await w.a.accountSet({ owner: "member:ann", provider: P.provider, plan: P.memberApi, means: "reference", reference: { store: "vault", locator: "kv/ann" }, entries: [ENTRIES.a], by: "ann" });
  const gw = await w.a.accountSet({ owner: "group", provider: P.provider, plan: P.teamApi, means: "gateway", by: "admin" });
  const none = await w.a.accountSet({ owner: "group", provider: P.builtinProvider, plan: P.builtin, means: "none", by: "admin" });
  assert.deepEqual([sealed.ok, ref.ok, gw.ok, none.ok], [true, true, true, true], JSON.stringify([ref, gw, none]));
  seen.push(ref, gw, none, w.a.accountState({ account_id: sealed.account_id, viewer: "ann" }), w.a.accountsOf({ owner: "member:ann", viewer: "ann" }),
    w.a.accountHistory({ owner: "member:ann", viewer: "ann" }), w.a.accountUses({ account_id: sealed.account_id, viewer: "ann" }));
  assert.deepEqual(leaks(w, SECRET("ann"), { answers: seen }), [], "the sealed secret is only in the sealed column");
  const r = w.row(`SELECT sealed, iv, reference, gateway_id FROM ai_accounts WHERE account_id=?`, sealed.account_id);
  assert.ok(r.sealed && r.iv && r.sealed !== SECRET("ann"));
  const rr = w.row(`SELECT sealed, iv, reference FROM ai_accounts WHERE account_id=?`, ref.account_id);
  assert.deepEqual([rr.sealed, rr.iv, JSON.parse(rr.reference)], [null, null, { store: "vault", locator: "kv/ann" }], "a reference stores its pointer only");
  const g = w.row(`SELECT sealed, iv, reference, gateway_id FROM ai_accounts WHERE account_id=?`, gw.account_id);
  assert.deepEqual([g.sealed, g.iv, g.reference, g.gateway_id], [null, null, null, "gw-9"], "a gateway account stores no secret");
  const n = w.row(`SELECT sealed, iv, reference, gateway_id FROM ai_accounts WHERE account_id=?`, none.account_id);
  assert.deepEqual([n.sealed, n.iv, n.reference, n.gateway_id], [null, null, null, null], "a none account stores nothing");
  const st = w.a.accountState({ account_id: sealed.account_id, viewer: "ann" });
  assert.deepEqual(Object.keys(st).sort(), ["account_id", "entries", "flagged", "flagged_at", "health", "held", "ok", "on", "opt_in", "owner", "personal", "plan", "provider", "means", "set_at", "switches"].sort());
  assert.deepEqual([st.opt_in, st.switches], [{ flag: "share_with_projects", on: false }, DEFAULTS]);
  for (const viewer of ["bob", "second", "admin", "class:ai", null]) assert.deepEqual(shape(w.a.accountState({ account_id: sealed.account_id, viewer })), refusal("NOT_YOUR_ACCOUNT"), String(viewer));
  assert.equal(w.a.accountsOf({ owner: "member:ann", viewer: "bob" }).reason, "NOT_YOUR_ACCOUNT");
  assert.equal(w.core.declared.get("ai_accounts").classes.export, "never");
  assert.equal(w.core.declared.get("account_changes").classes.export, "never");
});

test("R2 R24: with no seal secret bound a sealed or issued account is neither stored nor read (ACCOUNT_SEAL_UNAVAILABLE), writing nothing; an account sealed under one secret does not open under another", async () => {
  const w = await projectWorld();
  const x = await w.own("ann");
  const other = aiAccountsOf({ storage: { sql: w.sql } }, { record: w.core, membership: w.m, sealSecret: "another-secret", catalogue: w.catalogue });
  w.a.accountSwitch({ account_id: x.account_id, on: true, by: "ann" });
  w.a.recipientNoticeSeen({ member: "ann", provider: P.provider, host: HOSTS.main, by: "ann" });
  const gone = await other.accountFor({ member: "ann", act: ask("ann") });
  assert.deepEqual(shape(gone), refusal("ACCOUNT_SEAL_UNAVAILABLE"));
  const w2 = await projectWorld({ sealSecret: null });
  const before = w2.snapshot();
  assert.deepEqual(shape(await w2.own("ann")), refusal("ACCOUNT_SEAL_UNAVAILABLE"));
  assert.equal(w2.snapshot(), before);
});

test("R3: accountSecretFor unseals a member-owned account's credential only for an act that member runs, `act.member` the owner; any other act NOT_YOUR_ACCOUNT; none held NO_ACCOUNT; a reference answers its pointer and a gateway account its gateway id, neither a secret", async () => {
  const w = await projectWorld();
  const x = await w.own("ann");
  const secret = await w.a.accountSecretFor({ account_id: x.account_id, act: ask("ann") });
  assert.deepEqual({ ...secret }, { ok: true, account_id: x.account_id, means: "sealed", secret: SECRET("ann") });
  assert.equal((await w.a.accountSecretFor({ account_id: x.account_id, act: act("draft", "ann", "P") })).secret, SECRET("ann"), "in a project, still the owner's act");
  for (const [member, a] of [["bob", ask("bob")], ["ann", ask("bob")], ["class:ai", ask("class:ai")], [null, null]])
    assert.deepEqual(shape(await w.a.accountSecretFor({ account_id: x.account_id, act: a })), refusal("NOT_YOUR_ACCOUNT"), String(member));
  const t = await w.team();
  assert.deepEqual(shape(await w.a.accountSecretFor({ account_id: t.account_id, act: ask("ann") })), refusal("NOT_YOUR_ACCOUNT"), "a team account's secret only through accountFor");
  assert.equal((await w.a.accountSecretFor({ account_id: "acct-none", act: ask("ann") })).reason, "NOT_YOUR_ACCOUNT");
  const ref = await w.a.accountSet({ owner: "member:bob", provider: P.provider, plan: P.memberApi, means: "reference", reference: { store: "vault", locator: "kv/bob" }, by: "bob" });
  assert.deepEqual(await w.a.accountSecretFor({ account_id: ref.account_id, act: ask("bob") }), { ok: true, account_id: ref.account_id, means: "reference", reference: { store: "vault", locator: "kv/bob" } });
  w.a.registerGatewayStore("root", { create: async () => "gw-3", put: async () => true, exists: async () => true });
  const gw = await w.a.accountSet({ owner: "member:cy", provider: P.provider, plan: P.teamApi, means: "gateway", by: "cy" });
  assert.equal(gw.ok, true, JSON.stringify(gw));
  assert.equal((await w.a.accountSecretFor({ account_id: gw.account_id, act: ask("cy") })).reason, "NO_ACCOUNT", "no key held: nothing to serve");
  assert.equal((await w.a.gatewayKeyAttest({ account_id: gw.account_id, by: "cy" })).ok, true);
  assert.deepEqual(await w.a.accountSecretFor({ account_id: gw.account_id, act: ask("cy") }), { ok: true, account_id: gw.account_id, means: "gateway", gateway_id: "gw-3" });
});

test("R5 R6: the team holds accounts, set, switched and removed by an active administrator only (NOT_AN_ADMIN, a machine credential refused the same); a plain member and a machine are refused; the account is off when first set; an administrator reads the full state, any other active member `{account_id, provider, plan, entries, on}`, never a secret", async () => {
  const w = await projectWorld();
  const t = await w.team();
  assert.equal(t.on, false);
  const before = w.snapshot();
  for (const by of ["ann", "class:ai", null, "token:ai"]) {
    const sw = w.a.accountSwitch({ account_id: t.account_id, on: true, by });
    assert.deepEqual([sw.ok, sw.code, sw.check], [false, "NOT_AN_ADMIN", notAnAdmin(by ?? null, "x").check], String(by));
    assert.equal((await w.team({ by })).reason, "NOT_AN_ADMIN", String(by));
    assert.equal(w.a.accountRemove({ account_id: t.account_id, by }).reason, "NOT_AN_ADMIN", String(by));
  }
  assert.equal(w.snapshot(), before);
  assert.equal(w.a.accountSwitch({ account_id: t.account_id, on: true, by: "second" }).on, true);
  const adminView = w.a.accountState({ account_id: t.account_id, viewer: "second" });
  assert.deepEqual([adminView.ok, adminView.on, adminView.held, adminView.means], [true, true, true, "sealed"]);
  const memberView = w.a.accountState({ account_id: t.account_id, viewer: "ann" });
  assert.deepEqual(memberView, { ok: true, account_id: t.account_id, provider: P.provider, plan: P.teamApi, entries: [ENTRIES.a, ENTRIES.b], on: true });
  assert.ok(!JSON.stringify([adminView, memberView]).includes(SECRET("team")));
  assert.equal(w.a.accountState({ account_id: t.account_id, viewer: "class:ai" }).reason, "NOT_YOUR_ACCOUNT");
  const hist = w.a.accountHistory({ owner: "group", viewer: "admin" }).changes.map((c) => [c.change, c.by]);
  assert.deepEqual(hist, [["account_set", "admin"], ["switched", "second"]]);
  assert.equal(w.a.accountHistory({ owner: "group", viewer: "ann" }).reason, "NOT_AN_ADMIN");
  assert.equal(w.a.accountRemove({ account_id: t.account_id, by: "admin" }).removed, true);
});

test("R10: a project holds accounts, set by any one of its owners: an owner sets, lists, switches and removes; a non-owner participant is PROJECT_ACT_NOT_THE_OWNER, a stranger sees absence, a machine is refused as a non-owner; an empty secret NO_SECRET; off when first set; a personal subscription is refused; accountsOf answers a project's owners the full state and its joined participants `{account_id, provider, plan, on}`", async () => {
  const w = await projectWorld();
  const x = await w.projectAccount("P", "ann");
  assert.deepEqual([x.ok, x.owner, x.on], [true, "project:P", false]);
  assert.deepEqual(w.a.accountSwitch({ account_id: x.account_id, on: true, by: "bob" }), notTheOwner("bob", "P"));
  assert.deepEqual(w.a.accountSwitch({ account_id: x.account_id, on: true, by: "eve" }), noSuchProject("P"));
  for (const by of ["class:ai", null]) assert.equal(w.a.accountSwitch({ account_id: x.account_id, on: true, by }).reason, "PROJECT_ACT_NOT_THE_OWNER", String(by));
  assert.equal((await w.projectAccount("P", "ann", { secret: "" })).reason, "NO_SECRET");
  assert.equal((await w.a.accountSet({ owner: "project:P", provider: P.provider, plan: P.subscription, means: "issued", secret: "sk-ant-oat01-sentinel-ann-0123456789", by: "ann" })).reason, "PERSONAL_SUBSCRIPTION_LEVEL");
  assert.equal(w.a.accountSwitch({ account_id: x.account_id, on: true, by: "ann" }).on, true);
  const owners = w.a.accountsOf({ owner: "project:P", viewer: "ann" });
  assert.deepEqual(owners.accounts.map((a) => [a.account_id, a.on, a.means]), [[x.account_id, true, "sealed"]]);
  assert.deepEqual(w.a.accountsOf({ owner: "project:P", viewer: "bob" }).accounts, [{ account_id: x.account_id, provider: P.provider, plan: P.teamApi, on: true, position: 1 }]);
  assert.deepEqual(w.a.accountsOf({ owner: "project:P", viewer: "eve" }), noSuchProject("P"));
  assert.deepEqual(w.a.accountState({ account_id: x.account_id, viewer: "bob" }), { ok: true, account_id: x.account_id, provider: P.provider, plan: P.teamApi, on: true });
  assert.equal(w.a.accountRemove({ account_id: x.account_id, by: "ann" }).ok, true);
  assert.equal(w.row(`SELECT COUNT(*) AS n FROM ai_accounts WHERE owner='project:P'`).n, 0);
  assert.equal(w.core.declared.get("ai_accounts").classes.purge, "clear", "cleared with its project (R28)");
});

test("R43: each means stores as stated: sealed the secret sealed, reference only the pointer `{store, locator}` (non-empty strings of at most REFERENCE_MAX_CHARS, else REFERENCE_MALFORMED; never resolved here), none nothing, gateway no key and a gateway of its own, two gateway accounts distinct ids; a plan that does not allow the means is MEANS_NOT_ALLOWED naming plan and means; a pointer is stored with no secret beside it", async () => {
  const w = await projectWorld();
  let n = 0;
  w.a.registerGatewayStore("root", { create: async () => `gw-${++n}`, put: async () => true, exists: async () => true });
  const g1 = await w.a.accountSet({ owner: "group", provider: P.provider, plan: P.teamApi, means: "gateway", by: "admin" });
  const g2 = await w.a.accountSet({ owner: "project:P", provider: P.provider, plan: P.teamApi, means: "gateway", by: "ann" });
  const ids = [g1, g2].map((x) => w.row(`SELECT gateway_id FROM ai_accounts WHERE account_id=?`, x.account_id).gateway_id);
  assert.deepEqual(ids, ["gw-1", "gw-2"], "never shared between accounts");
  for (const reference of [null, {}, { store: "", locator: "x" }, { store: "s" }, { store: "s", locator: 7 }, { store: "s", locator: "x".repeat(REFERENCE_MAX_CHARS + 1) }, "s:x", ["s", "x"]])
    assert.deepEqual(shape(await w.a.accountSet({ owner: "member:ann", provider: P.provider, plan: P.memberApi, means: "reference", reference, by: "ann" })), refusal("REFERENCE_MALFORMED"), JSON.stringify(reference));
  const ok = await w.a.accountSet({ owner: "member:ann", provider: P.provider, plan: P.memberApi, means: "reference", reference: { store: "s", locator: "x".repeat(REFERENCE_MAX_CHARS) }, secret: "never-stored", by: "ann" });
  assert.equal(ok.ok, true);
  const row = w.row(`SELECT sealed, iv, reference FROM ai_accounts WHERE account_id=?`, ok.account_id);
  assert.deepEqual([row.sealed, row.iv], [null, null], "a pointer is stored with no secret beside it");
  assert.equal(leaks(w, "never-stored").length, 0);
  const bad = await w.a.accountSet({ owner: "member:ann", provider: P.provider, plan: P.subscription, means: "reference", reference: { store: "s", locator: "x" }, by: "ann" });
  assert.deepEqual([bad.reason, bad.plan, bad.means], ["MEANS_NOT_ALLOWED", P.subscription, "reference"]);
  assert.match(bad.detail, new RegExp(P.subscription));
  assert.equal((await w.a.accountSet({ owner: "member:ann", provider: P.provider, plan: P.memberApi, means: "bogus", secret: "s", by: "ann" })).reason, "MEANS_NOT_ALLOWED");
  assert.equal((await w.a.accountSet({ owner: "member:ann", provider: P.provider, plan: P.memberApi, means: "gateway", by: "ann" })).reason, "MEANS_NOT_ALLOWED", "the member plan allows no gateway");
});

test("R38: `op=aiownadd` and `op=aiaccountremove` for a member's own account take the member from the door's stamped `by`, never the body: a member sets, reads and removes an own account with a body naming no member; a body naming another member acts on the caller's own only; a machine credential is MACHINE_CANNOT_HOLD_ACCOUNT", async () => {
  const w = await projectWorld();
  const set = await w.ops("by=ann", { provider: P.provider, plan: P.memberApi, means: "sealed", secret: SECRET("ann") }).aiownadd();
  assert.deepEqual([set.ok, set.owner], [true, "member:ann"]);
  const read = w.ops(`viewer=ann&account_id=${set.account_id}`).accountstate();
  assert.equal(read.owner, "member:ann");
  const sneaky = await w.ops("by=bob", { owner: "member:ann", member: "ann", provider: P.provider, plan: P.memberApi, secret: SECRET("bob") }).aiownadd();
  assert.equal(sneaky.owner, "member:bob", "the stamp, never the body");
  assert.equal(w.rows(`SELECT account_id FROM ai_accounts WHERE owner='member:ann'`).length, 1);
  assert.equal(w.ops("by=bob", { account_id: set.account_id }).aiaccountremove().reason, "NOT_YOUR_ACCOUNT");
  assert.equal(w.ops("by=ann", { account_id: set.account_id, member: "bob" }).aiaccountremove().removed, true);
  for (const by of ["class:ai", "token:ai"]) assert.equal((await w.ops(`by=${by}`, { provider: P.provider, plan: P.memberApi, secret: "s" }).aiownadd()).reason, "MACHINE_CANNOT_HOLD_ACCOUNT", by);
  assert.equal(w.rows(`SELECT account_id FROM ai_accounts WHERE owner='member:bob'`).length, 1);
});
