/* ai-accounts' own seams and invariants, new at the split (T48-10; split map §1, §6): the seal as a service (R24), the
   reads credentials asks (R25), the account-cleared notice (R26), its own revocation listener (R27), its tables'
   declarations (R28, R29), its words (R30), its factory and route map (R32), its rows (R33) and T48's fail-closed
   keep-away answer (R34). Every arm drives the module at its interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { world, SEAL, SIGNIN_TOKEN } from "./fixture.mjs";
import { tableDeclarationRefusals } from "../record-core/fixtures.mjs";
import { aiAccountsOf, aiAccountsOps, AI_ACCOUNT_CHECKS, AI_WORDS, KEPT_AWAY_UNREADABLE, AI_ACCOUNTS_TABLES,
         AI_ACCOUNTS_PROJECT_TABLES, AI_ACCOUNTS_HISTORY_TABLE } from "../../../src/ai-accounts/index.mjs";
import { word, localize } from "../../../src/setup-words/index.mjs";

const SECRET = "sk-ant-api03-SENTINEL-reference-9f8e7d6c5b4a";
const ask = (member, extra = {}) => ({ kind: "ask", member: `member:${member}`, ...extra });

/* The seal as credentials held it before T48, computed here independently of the module: HKDF-SHA-256 from the seal
   secret, the owner as salt, `bio-credentials-seal/1` as info; AES-256-GCM with `owner|kind` as AAD. */
async function openIndependently(secret, owner, kind, sealed, iv) {
  const enc = new TextEncoder();
  const base = await webcrypto.subtle.importKey("raw", enc.encode(secret), "HKDF", false, ["deriveKey"]);
  const key = await webcrypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: enc.encode(owner),
    info: enc.encode("bio-credentials-seal/1") }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const pt = await webcrypto.subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(iv, "base64"),
    additionalData: enc.encode(`${owner}|${kind}`) }, key, Buffer.from(sealed, "base64"));
  return new TextDecoder().decode(pt);
}
async function sealIndependently(secret, owner, kind, text) {
  const enc = new TextEncoder();
  const base = await webcrypto.subtle.importKey("raw", enc.encode(secret), "HKDF", false, ["deriveKey"]);
  const key = await webcrypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: enc.encode(owner),
    info: enc.encode("bio-credentials-seal/1") }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ct = await webcrypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(`${owner}|${kind}`) }, key,
    enc.encode(text));
  return { sealed: Buffer.from(new Uint8Array(ct)).toString("base64"), iv: Buffer.from(iv).toString("base64") };
}

/* ===== R24: the seal ===== */

test("R24: sealText seals a sentinel that unsealText opens for the same owner and kind; the sealed text holds no trace of it", async () => {
  const w = world();
  const s = await w.a.sealText({ owner: "group:courtlistener", kind: "key", text: SECRET });
  assert.equal(s.ok, true);
  assert.equal(typeof s.sealed, "string");
  assert.equal(typeof s.iv, "string");
  assert.ok(!JSON.stringify(s).includes(SECRET));
  assert.ok(!JSON.stringify(s).includes(Buffer.from(SECRET).toString("base64")));
  assert.deepEqual(await w.a.unsealText({ owner: "group:courtlistener", kind: "key", sealed: s.sealed, iv: s.iv }),
    { ok: true, text: SECRET });
});

test("R24: the seal is byte-identical to credentials' before T48: an independent HKDF/AES-GCM under `bio-credentials-seal/1` opens what the module seals, and the module opens what it seals", async () => {
  const w = world();
  const s = await w.a.sealText({ owner: "group:courtlistener", kind: "fields", text: SECRET });
  assert.equal(await openIndependently(SEAL, "group:courtlistener", "fields", s.sealed, s.iv), SECRET);
  const theirs = await sealIndependently(SEAL, "group:courtlistener", "key", SECRET);
  assert.deepEqual(await w.a.unsealText({ owner: "group:courtlistener", kind: "key", ...theirs }), { ok: true, text: SECRET });
  /* a member's reference, sealed by R1's act, opens under the same rule (owner `member:<id>`, its kind) */
  await w.group("ann");
  assert.equal((await w.a.accountReferenceSet({ member: "ann", kind: "apikey", secret: SECRET, by: "member:ann" })).ok, true);
  const r = w.row(`SELECT sealed, iv FROM account_references WHERE member_id='ann'`);
  assert.equal(await openIndependently(SEAL, "member:ann", "apikey", r.sealed, r.iv), SECRET);
});

test("R24: the wrong owner, the wrong kind or a changed seal secret does not open it: ACCOUNT_SEAL_UNAVAILABLE with its row (control: the right owner opens)", async () => {
  const w = world();
  const s = await w.a.sealText({ owner: "group:courtlistener", kind: "key", text: SECRET });
  const row = AI_ACCOUNT_CHECKS.ACCOUNT_SEAL_UNAVAILABLE;
  for (const [owner, kind] of [["group:other", "key"], ["group:courtlistener", "fields"], ["member:ann", "key"]]) {
    const u = await w.a.unsealText({ owner, kind, sealed: s.sealed, iv: s.iv });
    assert.equal(u.ok, false);
    assert.equal(u.code, "ACCOUNT_SEAL_UNAVAILABLE");
    assert.equal(u.check, row.check);
    assert.equal(u.translation, row.translation);
    assert.ok(!JSON.stringify(u).includes(SECRET));
  }
  const other = world({ sealSecret: "another-seal-secret-000000" });
  assert.equal((await other.a.unsealText({ owner: "group:courtlistener", kind: "key", sealed: s.sealed, iv: s.iv })).code,
    "ACCOUNT_SEAL_UNAVAILABLE");
  const bad = await w.a.unsealText({ owner: "group:courtlistener", kind: "key", sealed: null, iv: null });
  assert.equal(bad.code, "ACCOUNT_SEAL_UNAVAILABLE");
  assert.equal((await w.a.unsealText({ owner: "group:courtlistener", kind: "key", sealed: s.sealed, iv: s.iv })).text, SECRET);
});

test("R24: with no seal secret bound, sealText and unsealText each answer ACCOUNT_SEAL_UNAVAILABLE and never throw", async () => {
  const w = world({ sealSecret: null });
  const s = await w.a.sealText({ owner: "group:courtlistener", kind: "key", text: SECRET });
  assert.equal(s.code, "ACCOUNT_SEAL_UNAVAILABLE");
  assert.equal(s.check, "C-29.22");
  const u = await w.a.unsealText({ owner: "group:courtlistener", kind: "key", sealed: "AAAA", iv: "AAAA" });
  assert.equal(u.code, "ACCOUNT_SEAL_UNAVAILABLE");
  assert.equal(u.translation, AI_ACCOUNT_CHECKS.ACCOUNT_SEAL_UNAVAILABLE.translation);
});

/* ===== R25: the reads credentials asks ===== */

test("R25: accountActBar answers R1's refusals in R1's order, and null for the member's own act (control)", async () => {
  const w = await world().group("ann", "bob");
  assert.equal(w.a.accountActBar({ member: "ann", by: "member:ann" }), null);
  assert.equal(w.a.accountActBar({ member: "ann", by: null })?.code, "MACHINE_CANNOT_HOLD_ACCOUNT");
  assert.equal(w.a.accountActBar({ member: "ann", by: "token:abc" })?.code, "MACHINE_CANNOT_HOLD_ACCOUNT");
  assert.equal(w.a.accountActBar({ member: "ann", by: "member:bob" })?.code, "NOT_YOUR_ACCOUNT");
  assert.equal(w.a.accountActBar({ member: "ann", by: "admin" })?.code, "NOT_YOUR_ACCOUNT");
  await w.m.memberSet({ memberId: "bob", status: "revoked", by: "admin" });
  assert.equal(w.a.accountActBar({ member: "bob", by: "member:bob" })?.code, "ACCOUNT_MEMBER_NOT_ACTIVE");
  for (const [member, by] of [["ann", null], ["ann", "member:bob"], ["bob", "member:bob"]])
    assert.deepEqual(w.a.accountActBar({ member, by }), w.a.accountReferenceRemove({ member, by }));
});

test("R25: accountServing answers R11's choice as accountFor does, without a key, at every level and for every refusal", async () => {
  const w = await world().group("ann", "bob", "cat", "dan");
  /* ann: her own reference; bob: her sign-in; cat: the group key; dan: none (the group key off at first) */
  await w.a.accountReferenceSet({ member: "ann", kind: "apikey", secret: SECRET, by: "member:ann" });
  await w.signin("bob");
  const none = w.a.accountServing({ member: "dan", use: "ask", project: null });
  assert.deepEqual(none, { refusal: await w.a.accountFor({ member: "dan", act: ask("dan") }) });
  assert.equal(none.refusal.code, "NO_ACCOUNT");
  await w.a.groupKeySet({ key: "sk-group-key-000000000000", by: "admin" });
  await w.a.groupKeySwitch({ on: true, by: "admin" });
  /* the group key's notice is due before cat has read it: the same refusal */
  const due = w.a.accountServing({ member: "cat", use: "ask" });
  assert.equal(due.refusal.code, "GROUP_KEY_NOTICE_DUE");
  assert.deepEqual(due.refusal, await w.a.accountFor({ member: "cat", act: ask("cat") }));
  w.a.groupKeyNoticeSeen({ member: "cat", by: "member:cat" });
  const cases = [["ann", { level: "member", kind: "apikey" }], ["bob", { level: "member", kind: "signin", member: "bob" }],
                 ["cat", { level: "group", kind: "apikey" }]];
  for (const [id, want] of cases) {
    const s = w.a.accountServing({ member: `member:${id}`, use: "ask", project: null });
    assert.deepEqual(s, want);
    assert.ok(!JSON.stringify(s).includes(SECRET) && !("key" in s) && !("row" in s));
    const f = await w.a.accountFor({ member: id, act: ask(id) });
    assert.equal(f.level, want.level);
    assert.equal(f.kind, want.kind);
  }
  /* the account chosen is the one used: its switch off is the refusal, as accountFor's */
  await w.a.accountUsesSet({ owner: "member:ann", switch: "ask", on: false, by: "member:ann" });
  const off = w.a.accountServing({ member: "ann", use: "ask" });
  assert.equal(off.refusal.code, "AI_USE_SWITCHED_OFF");
  assert.deepEqual(off.refusal, await w.a.accountFor({ member: "ann", act: ask("ann") }));
  /* a project's account is chosen first for a joined participant, with its project */
  w.project("PROJ-2026-0001-p", "dan");
  await w.a.projectKeySet({ project: "PROJ-2026-0001-p", key: "sk-project-key-0000000000", by: "member:dan" });
  w.a.projectAccountSwitch({ project: "PROJ-2026-0001-p", on: true, by: "member:dan" });
  w.a.projectKeyNoticeSeen({ member: "dan", project: "PROJ-2026-0001-p", by: "member:dan" });
  assert.deepEqual(w.a.accountServing({ member: "dan", use: "ask", project: "PROJ-2026-0001-p" }),
    { level: "project", kind: "apikey", project: "PROJ-2026-0001-p" });
  const f = await w.a.accountFor({ member: "dan", act: ask("dan", { project: "PROJ-2026-0001-p" }) });
  assert.equal(f.level, "project");
  /* a project the member cannot see answers as absent, the same refusal both ways */
  const absent = w.a.accountServing({ member: "cat", use: "ask", project: "PROJ-2026-0001-p" });
  assert.deepEqual(absent.refusal, await w.a.accountFor({ member: "cat", act: ask("cat", { project: "PROJ-2026-0001-p" }) }));
});

test("R25: servingAccountOf answers which account serves a member and its two switches, or null (control: none held)", async () => {
  const w = await world().group("ann", "bob", "cat");
  assert.equal(w.a.servingAccountOf({ member: "ann" }), null);
  assert.equal(w.a.servingAccountOf({ member: null }), null);
  await w.a.accountReferenceSet({ member: "ann", kind: "apikey", secret: SECRET, by: "member:ann" });
  await w.a.accountUsesSet({ owner: "member:ann", switch: "standing", on: true, by: "member:ann" });
  assert.deepEqual(w.a.servingAccountOf({ member: "ann" }), { level: "member", suggestions: false, standing: true });
  assert.deepEqual(w.a.servingAccountOf({ member: "member:ann" }), { level: "member", suggestions: false, standing: true });
  await w.signin("bob");
  assert.deepEqual(w.a.servingAccountOf({ member: "bob" }), { level: "member", signin: true, suggestions: false, standing: false });
  await w.a.groupKeySet({ key: "sk-group-key-000000000000", by: "admin" });
  assert.equal(w.a.servingAccountOf({ member: "cat" }), null);   /* held but off */
  await w.a.groupKeySwitch({ on: true, by: "admin" });
  await w.a.accountUsesSet({ owner: "group", switch: "suggestions", on: true, by: "admin" });
  assert.deepEqual(w.a.servingAccountOf({ member: "cat" }), { level: "group", suggestions: true, standing: false });
});

test("R25: notYourAccount, noAccount and accountMemberNotActive each answer their own row, C-29.14, C-29.20 and C-29.15, with the caller's detail", () => {
  const w = world();
  const grant = localize("credentials.index.an_asks_grant_is", "an ask's grant is minted only under the member's own live session. Nothing was minted.");
  const a = w.a.notYourAccount(grant);
  assert.deepEqual(a, { ok: false, reason: "NOT_YOUR_ACCOUNT", code: "NOT_YOUR_ACCOUNT", check: "C-29.14",
    translation: AI_ACCOUNT_CHECKS.NOT_YOUR_ACCOUNT.translation,
    detail: grant });
  const n = w.a.noAccount("ann");
  assert.equal(n.code, "NO_ACCOUNT");
  assert.equal(n.check, "C-29.20");
  assert.equal(n.member, "ann");
  assert.match(n.detail, /no Claude account serves this member/);
  assert.match(w.a.noAccount("ann", "own").detail, /no Claude account reference of their own/);
  const standing = localize("credentials.index.a_standing_question_runs", "a standing question runs only for an active member. Nothing was minted.");
  const x = w.a.accountMemberNotActive(standing, { member: "ann" });
  assert.deepEqual(x, { ok: false, reason: "ACCOUNT_MEMBER_NOT_ACTIVE", code: "ACCOUNT_MEMBER_NOT_ACTIVE", check: "C-29.15",
    translation: AI_ACCOUNT_CHECKS.ACCOUNT_MEMBER_NOT_ACTIVE.translation,
    detail: standing, member: "ann" });
});

/* ===== R26: onAccountCleared ===== */

test("R26: a listener is told once, inside the act, when a reference is removed and when a sign-in is disconnected or revoked", async () => {
  const w = await world().group("ann", "bob", "cat");
  const heard = [];
  assert.deepEqual(w.a.onAccountCleared("credentials", (n) => heard.push({ ...n, inside: w.row(
    `SELECT COUNT(*) AS n FROM subscription_connections WHERE member_id=?`, n.member).n })), { ok: true, module: "credentials" });
  await w.a.accountReferenceSet({ member: "ann", kind: "apikey", secret: SECRET, by: "member:ann" });
  w.a.accountReferenceRemove({ member: "ann", by: "member:ann" });
  assert.deepEqual(heard, [{ member: "ann", account: "reference", by: "member:ann", why: "removed", reference_held: false, inside: 0 }]);
  /* a sign-in disconnected, with and without a reference still serving her */
  await w.signin("bob");
  await w.a.accountReferenceSet({ member: "bob", kind: "apikey", secret: SECRET, by: "member:bob" });
  w.a.subscriptionDisconnect({ member: "bob", by: "member:bob" });
  assert.deepEqual(heard[1], { member: "bob", account: "signin", by: "member:bob", why: "disconnected", reference_held: true, inside: 0 });
  await w.signin("cat");
  await w.m.memberSet({ memberId: "cat", status: "revoked", by: "admin" });
  assert.deepEqual(heard[2], { member: "cat", account: "signin", by: "admin", why: "revoked", reference_held: false, inside: 0 });
  assert.equal(heard.length, 3);
  /* control: a disconnection with no sign-in held, and a refused act, tell no one */
  w.a.subscriptionDisconnect({ member: "ann", by: "member:ann" });
  w.a.accountReferenceRemove({ member: "ann", by: "member:bob" });
  assert.equal(heard.length, 3);
});

test("R26: a listener that throws changes nothing of the act or of another listener's notice; registrations are refused through membership's R81", async () => {
  const w = await world().group("ann");
  const heard = [];
  w.a.onAccountCleared("first", () => { throw new Error("listener fault"); });
  w.a.onAccountCleared("second", (n) => heard.push(n.account));
  await w.signin("ann");
  const d = w.a.subscriptionDisconnect({ member: "ann", by: "member:ann" });
  assert.deepEqual(d, { ok: true, disconnected: true });
  assert.equal(w.row(`SELECT COUNT(*) AS n FROM subscription_connections WHERE member_id='ann'`).n, 0);
  assert.deepEqual(heard, ["signin"]);
  const again = w.a.onAccountCleared("second", () => {});
  assert.equal(again.code, "LISTENER_DECLARED");
  assert.equal(w.a.onAccountCleared("", () => {}).code, "LISTENER_MALFORMED");
  assert.equal(w.a.onAccountCleared("third", "not a function").code, "LISTENER_MALFORMED");
  assert.deepEqual(w.a.onAccountCleared("third", () => {}), { ok: true, module: "third" });
});

test("R26 (T50; N1060, K3218, K3224): a refused held sign-in tells its listeners once, inside the act, with why \"refused\" and no actor, and whether a reference still serves her; a refusal for a member with none held tells no one", async () => {
  const w = await world().group("ann", "bob", "cat");
  const heard = [];
  w.a.onAccountCleared("credentials", (n) => heard.push({ ...n, inside: w.row(
    `SELECT COUNT(*) AS n FROM subscription_connections WHERE member_id=? AND sealed IS NOT NULL`, n.member).n }));
  /* her sign-in alone, then with a reference beside it */
  await w.signin("ann");
  assert.deepEqual(w.a.subscriptionTokenRefused({ member: "ann" }), { ok: true, dropped: true });
  assert.deepEqual(heard, [{ member: "ann", account: "signin", by: null, why: "refused", reference_held: false, inside: 0 }]);
  await w.signin("bob");
  await w.a.accountReferenceSet({ member: "bob", kind: "apikey", secret: SECRET, by: "member:bob" });
  w.a.subscriptionTokenRefused({ member: "bob" });
  assert.deepEqual(heard[1], { member: "bob", account: "signin", by: null, why: "refused", reference_held: true, inside: 0 });
  assert.equal(heard.length, 2);
  /* control: nothing held, a sign-in already refused, an unknown member and a member with only a reference tell no one,
     and record nothing */
  const before = w.snapshot();
  for (const member of ["cat", "ann", "bob", "nobody", null]) assert.deepEqual(w.a.subscriptionTokenRefused({ member }), { ok: true, dropped: false }, String(member));
  assert.equal(w.snapshot(), before);
  assert.equal(heard.length, 2);
  /* her projects' sign-in accounts are cleared in the same act, and one told once */
  w.project("PROJ-2026-0001-a", "cat");
  await w.signin("cat");
  assert.equal(w.a.projectSigninSet({ project: "PROJ-2026-0001-a", by: "member:cat" }).ok, true);
  w.a.subscriptionTokenRefused({ member: "cat" });
  assert.equal(heard.filter((n) => n.member === "cat").length, 1);
  assert.equal(w.row(`SELECT COUNT(*) AS n FROM project_accounts WHERE project_id='PROJ-2026-0001-a'`).n, 0);
});

test("R26 (T50): a listener that throws on a refusal changes nothing of the act or of another listener's notice", async () => {
  const w = await world().group("ann");
  const heard = [];
  w.a.onAccountCleared("first", () => { throw new Error("listener fault"); });
  w.a.onAccountCleared("second", (n) => heard.push(n.why));
  await w.signin("ann");
  assert.deepEqual(w.a.subscriptionTokenRefused({ member: "ann" }), { ok: true, dropped: true });
  assert.deepEqual(heard, ["refused"]);
  assert.equal(w.row(`SELECT refused_at IS NOT NULL AS r, sealed FROM subscription_connections WHERE member_id='ann'`).sealed, null);
});

/* ===== R27: its own revocation listener ===== */

test("R27: a revoked member's sign-in, its token and her projects' sign-in accounts are cleared in the revoking act, each a change (control: another member's stand)", async () => {
  const w = await world().group("ann", "bob");
  await w.signin("ann");
  await w.signin("bob");
  w.project("PROJ-2026-0001-a", "ann");
  assert.equal(w.a.projectSigninSet({ project: "PROJ-2026-0001-a", by: "member:ann" }).ok, true);
  await w.a.accountReferenceSet({ member: "ann", kind: "apikey", secret: SECRET, by: "member:ann" });
  await w.m.memberSet({ memberId: "ann", status: "revoked", by: "admin" });
  assert.equal(w.row(`SELECT COUNT(*) AS n FROM subscription_connections WHERE member_id='ann'`).n, 0);
  assert.equal(w.row(`SELECT COUNT(*) AS n FROM project_accounts WHERE project_id='PROJ-2026-0001-a'`).n, 0);
  assert.ok(!w.snapshot().includes(SIGNIN_TOKEN("ann")));
  const changes = w.rows(`SELECT owner, by, change, detail FROM account_changes WHERE change='removed' ORDER BY seq`);
  assert.deepEqual(changes.map((c) => [c.owner, c.by, c.change, JSON.parse(c.detail)]), [
    ["member:ann", "admin", "removed", { account: "signin", why: "revoked" }],
    ["project:PROJ-2026-0001-a", "admin", "removed", { kind: "signin", member: "ann", why: "signin_cleared" }],
  ]);
  /* bob's sign-in stands */
  assert.equal(w.row(`SELECT COUNT(*) AS n FROM subscription_connections WHERE member_id='bob' AND sealed IS NOT NULL`).n, 1);
});

test("R27: the listener is registered once at start, as `ai-accounts`, so a second start is refused by membership's R81", () => {
  const w = world();
  const again = w.a.start();
  assert.equal(again.revoked.code, "LISTENER_DECLARED");
  assert.equal(again.revoked.module, "ai-accounts");
});

/* ===== R28, R29: the eleven tables ===== */

test("R28, R29: the eleven tables are declared by `ai-accounts` through record-core's declareTable, each never exported (the two limits admin-only), the group's and members' exempt, the project's cleared by project", () => {
  const w = world();
  const mine = [...w.core.declared].filter(([, v]) => v.module === "ai-accounts");
  assert.deepEqual(mine.map(([n]) => n).sort(), ["account_changes", "account_references", "ai_keep_away", "group_key",
    "group_key_acts", "group_key_notices", "project_account_acts", "project_accounts", "project_keep_away",
    "project_key_notices", "subscription_connections"]);
  const cls = Object.fromEntries(mine.map(([n, v]) => [n, v.classes]));
  for (const [n, c] of Object.entries(cls)) {
    assert.equal(c.export, n === "ai_keep_away" || n === "project_keep_away" ? "admin-only" : "never", n);
    assert.equal(c.expunge, "none", n);
    assert.equal(c.derive, "stored", n);
    assert.equal(c.version_chain, false, n);
  }
  for (const n of ["account_references", "group_key", "group_key_acts", "group_key_notices", "subscription_connections", "ai_keep_away"])
    assert.equal(cls[n].purge, "exempt", n);   /* R29 */
  for (const n of ["project_accounts", "project_account_acts", "project_key_notices", "project_keep_away"]) {
    assert.equal(cls[n].purge, "clear", n);
    assert.deepEqual(cls[n].keys, ["project_id"], n);
  }
  assert.deepEqual([cls.account_changes.purge, cls.account_changes.whole, cls.account_changes.keys],
    ["clear", "project_id IS NOT NULL", ["project_id"]]);
  assert.deepEqual(Object.fromEntries(["account_references", "group_key_notices", "subscription_connections"].map((n) => [n, cls[n].sight])),
    { account_references: "owner", group_key_notices: "owner", subscription_connections: "owner" });
  /* the exported lists are the declarations */
  assert.equal(AI_ACCOUNTS_TABLES.length + AI_ACCOUNTS_PROJECT_TABLES.length + 1, 11);
  assert.equal(AI_ACCOUNTS_HISTORY_TABLE.name, "account_changes");
  /* a second declaration is a no-op; a refusal is thrown (control: another module holding a table) */
  assert.equal(w.a.declareTables(), false);
});

test("R28: a store whose tables another module declared first refuses ai-accounts' declaration, and migrate throws rather than run undeclared", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const { AiAccounts } = await import("../../../src/ai-accounts/index.mjs");
  const w = world();
  const db = new DatabaseSync(":memory:");
  const sql = { exec(q, ...args) { const st = db.prepare(q); return st.columns().length ? st.all(...args) : (st.run(...args), []); } };
  const refused = tableDeclarationRefusals("account_references", { by: "credentials" });
  const core = { declareTable: () => refused.declaredAgainByTable };
  const a = new AiAccounts({ sql, core, membership: w.m, sealSecret: SEAL });
  assert.throws(() => a.migrate(), /ai-accounts: record-core refused its table declaration: TABLE_DECLARED/);
});

test("R28: migrate keeps a running store's rows: the tables, names and columns unchanged, a pre-T40 store gains its additive columns, and a second boot changes nothing", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const { AiAccounts } = await import("../../../src/ai-accounts/index.mjs");
  const w = world();
  const db = new DatabaseSync(":memory:");
  const sql = { exec(q, ...args) { const st = db.prepare(q); return st.columns().length ? st.all(...args).map((r) => ({ ...r })) : (st.run(...args), []); } };
  db.exec(`CREATE TABLE account_references (member_id TEXT PRIMARY KEY, kind TEXT NOT NULL, sealed TEXT NOT NULL,
           iv TEXT NOT NULL, set_at TEXT NOT NULL, suggestions INTEGER NOT NULL DEFAULT 0, standing INTEGER NOT NULL DEFAULT 0)`);
  db.prepare(`INSERT INTO account_references VALUES ('ann','apikey','s','i','2026-01-01T00:00:00Z',1,0)`).run();
  db.prepare(`INSERT INTO account_references VALUES ('old','subscription','s','i','2026-01-01T00:00:00Z',0,0)`).run();
  const declared = [];
  const core = { declareTable: (module, entries) => { declared.push(module); return { ok: true }; } };
  const a = new AiAccounts({ sql, core, membership: w.m, sealSecret: SEAL });
  a.migrate();
  const cols = sql.exec(`PRAGMA table_info(account_references)`).map((r) => r.name);
  for (const c of ["use_ask", "use_draft", "use_run", "explore", "use_enquire", "use_read", "use_transcribe", "use_account"])
    assert.ok(cols.includes(c), c);
  /* the row stands with its switches; the retired kind is removed (R1, R7) */
  assert.deepEqual(sql.exec(`SELECT member_id, suggestions, use_ask, explore FROM account_references`),
    [{ member_id: "ann", suggestions: 1, use_ask: 1, explore: "no" }]);
  const before = JSON.stringify(sql.exec(`SELECT name, sql FROM sqlite_master ORDER BY name`));
  a.migrate();
  assert.equal(JSON.stringify(sql.exec(`SELECT name, sql FROM sqlite_master ORDER BY name`)), before);
  assert.deepEqual(declared, ["ai-accounts"]);
});

/* ===== R30: the words ===== */

test("R30 (T50; K3472, DEC-259): every member-facing string of its rows calls the installation \"your team's Civicsmith\" as words.json says it, never copy, instance, plane or server, and never \"group\"", () => {
  for (const [code, r] of Object.entries(AI_ACCOUNT_CHECKS)) {
    assert.doesNotMatch(r.translation, /\b(copy|instance|plane|server|group)\b/i, code);
    if (/Civicsmith/.test(r.translation)) assert.doesNotMatch(r.translation.replaceAll(word("queue.capture-completed-unattended.who"), "")
      .replaceAll(word("queue.update.section"), ""), /Civicsmith/, code);
  }
  for (const [k, v] of Object.entries(AI_WORDS)) assert.doesNotMatch(v, /\b(copy|instance|plane|server|group)\b/i, k);
  assert.match(AI_ACCOUNT_CHECKS.ACCOUNT_SEAL_UNAVAILABLE.translation, /^Your team's Civicsmith /);
});

test("R30: the refusals that name the installation in their detail say \"your group's Civicsmith\" (the seal, the kind)", async () => {
  const w = await world({ sealSecret: null }).group("ann");
  const s = await w.a.groupKeySet({ key: "sk-group-key-000000000000", by: "admin" });
  assert.match(s.detail, /^your team's Civicsmith has no seal secret set/);
  const k = await w.a.accountReferenceSet({ member: "ann", kind: "subscription", secret: SECRET, by: "member:ann" });
  assert.match(k.detail, /^the kind your team's Civicsmith holds is apikey/);
  for (const x of [s, k]) assert.doesNotMatch(x.detail, /\b(copy|instance|plane|server)\b/i);
});

/* ===== R32: the factory and the route map ===== */

test("R32: aiAccountsOf answers one instance per storage, its tables declared at its boot, created with the seal secret it is given", async () => {
  const w = world();
  assert.equal(aiAccountsOf(w.ctx), w.a);
  assert.equal(aiAccountsOf(w.ctx.storage), w.a);
  /* the seal secret given on the first call is the one it seals under (R24) */
  const s = await w.a.sealText({ owner: "group:x", kind: "key", text: SECRET });
  assert.equal(await openIndependently(SEAL, "group:x", "key", s.sealed, s.iv), SECRET);
  /* control: a storage with no seal secret answers ACCOUNT_SEAL_UNAVAILABLE */
  assert.equal((await world({ sealSecret: null }).a.sealText({ owner: "group:x", kind: "key", text: SECRET })).code,
    "ACCOUNT_SEAL_UNAVAILABLE");
});

test("R32: aiAccountsOps holds exactly the 24 moved routes, never the retired accountswitchset and groupswitchset nor an in-plane read", () => {
  const w = world();
  const ops = w.ops();
  assert.deepEqual(Object.keys(ops).sort(), ["accounthistory", "accountreference", "accountreferenceremove",
    "accountreferenceset", "accountuses", "accountusesset", "aikeepaway", "aikeepawaystate", "groupkeynotice",
    "groupkeynoticeseen", "groupkeyremove", "groupkeyset", "groupkeystate", "groupkeyswitch", "projectaccountremove",
    "projectaccountstate", "projectaccountswitch", "projectaikeepaway", "projectaikeepawaystate", "projectkeynotice",
    "projectkeynoticeseen", "projectkeyset", "projectsigninset", "subscriptiondisconnect"]);
  for (const gone of ["accountswitchset", "groupswitchset", "accountfor", "aikeptaway", "subscriptionconnected",
                      "aigrantmint", "keyedserviceset"]) assert.ok(!(gone in ops), gone);
  for (const f of Object.values(ops)) assert.equal(typeof f, "function");
});

test("R32: each route answers its service, reading the stamps from the query after the body, so a caller's own `by` never wins", async () => {
  const w = await world().group("ann", "bob");
  const set = await w.ops("by=member:ann", { member: "ann", kind: "apikey", secret: SECRET, by: "member:bob" }).accountreferenceset();
  assert.equal(set.ok, true);
  assert.equal(w.ops("member=ann&viewer=member:ann").accountreference().held, true);
  assert.equal(w.ops("member=ann&viewer=member:bob").accountreference().code, "NOT_YOUR_ACCOUNT");
  /* a body naming the admin as `by` does not set the group key: the stamp is bob's */
  const g = await w.ops("by=member:bob", { key: "sk-group-key-000000000000", by: "admin" }).groupkeyset();
  assert.equal(g.code, "NOT_AN_ADMIN");
  assert.equal((await w.ops("by=admin", { key: "sk-group-key-000000000000" }).groupkeyset()).ok, true);
  assert.equal(w.ops("by=admin", { on: true }).groupkeyswitch().on, true);
  assert.deepEqual(w.ops("viewer=member:bob").groupkeystate(), { ok: true, on: true });
  assert.equal(w.ops("viewer=member:bob").groupkeynotice().due, true);
  assert.equal(w.ops("by=member:bob").groupkeynoticeseen().seen, true);
  assert.equal(w.ops("by=admin", { on: true, reason: "a hearing", by: "member:bob" }).aikeepaway().set_by, "admin");
  assert.equal(w.ops().aikeepawaystate().on, true);
  assert.equal(w.ops("by=member:ann", { owner: "member:ann", switch: "draft", on: false }).accountusesset().ok, true);
  assert.equal(w.ops("owner=member:ann&viewer=member:ann").accountuses().uses.draft, false);
  assert.ok(w.ops("owner=member:ann&viewer=member:ann&limit=1").accounthistory().changes.length === 1);
  assert.deepEqual(w.ops("by=member:ann", { member: "ann", by: "member:bob" }).accountreferenceremove(), { ok: true, removed: true });
  assert.deepEqual(w.ops("by=member:ann").subscriptiondisconnect(), { ok: true, disconnected: false });
  w.project("PROJ-2026-0001-q", "ann");
  const p = "PROJ-2026-0001-q";
  assert.equal((await w.ops("by=member:ann", { project: p, key: "sk-project-key-0000000000" }).projectkeyset()).ok, true);
  assert.equal(w.ops("by=member:ann", { project: p, on: true }).projectaccountswitch().on, true);
  assert.equal(w.ops(`project=${p}&viewer=member:ann`).projectaccountstate().held, true);
  assert.equal(w.ops(`project=${p}&viewer=member:ann`).projectkeynotice().due, true);
  assert.equal(w.ops("by=member:ann", { project: p }).projectkeynoticeseen().seen, true);
  assert.equal(w.ops("by=member:ann", { project: p, on: true, reason: "sealed", uses: ["ask"] }).projectaikeepaway().on, true);
  assert.deepEqual(w.ops(`project=${p}&viewer=member:ann`).projectaikeepawaystate().uses, ["ask"]);
  assert.equal(w.ops("by=member:ann", { project: p }).projectaccountremove().removed, true);
  assert.equal(w.ops("by=member:ann", { project: p }).projectsigninset().code, "SIGNIN_NOT_CONNECTED");
  assert.equal(w.ops("by=admin").groupkeyremove().removed, true);
});

/* ===== R33: the rows ===== */

test("R33: AI_ACCOUNT_CHECKS holds exactly the moved C-29 rows with their numbers and codes, each `where` naming this module, the six keyed rows reading AI_WORDS", () => {
  assert.deepEqual(Object.fromEntries(Object.entries(AI_ACCOUNT_CHECKS).map(([k, r]) => [k, r.check])), {
    MACHINE_CANNOT_HOLD_ACCOUNT: "C-29.13", NOT_YOUR_ACCOUNT: "C-29.14", ACCOUNT_MEMBER_NOT_ACTIVE: "C-29.15",
    UNKNOWN_ACCOUNT_KIND: "C-29.17", NO_SECRET: "C-29.19", NO_ACCOUNT: "C-29.20", UNKNOWN_SWITCH: "C-29.21",
    ACCOUNT_SEAL_UNAVAILABLE: "C-29.22", SUBSCRIPTION_LOGIN_REFUSED: "C-29.29", GROUP_KEY_NOTICE_DUE: "C-29.27",
    AI_KEPT_AWAY: "C-29.31", PROJECT_NOT_SOLE_MEMBER: "C-29.34", SIGNIN_NOT_CONNECTED: "C-29.35",
    SWITCH_VALUE_INVALID: "C-29.36", AI_USE_SWITCHED_OFF: "C-29.37", PROJECT_AI_KEPT_AWAY: "C-29.38",
    PROJECT_KEY_NOTICE_DUE: "C-29.39", DISCLOSURE_DUE: "C-29.40", SIGNIN_NOT_HELD: "C-29.44",
    SUBSCRIPTION_TOKEN_MALFORMED: "C-29.45", AI_KEEP_AWAY_NO_REASON: "C-29.32" });
  for (const [code, r] of Object.entries(AI_ACCOUNT_CHECKS)) {
    assert.ok(Object.isFrozen(r), code);
    assert.match(r.where, /^src\/ai-accounts\/index\.mjs \S+ > is-[a-z-]+$/, code);
    assert.equal(typeof r.translation, "string");
  }
  assert.ok(Object.isFrozen(AI_ACCOUNT_CHECKS));
  assert.deepEqual([AI_ACCOUNT_CHECKS.PROJECT_NOT_SOLE_MEMBER.translation, AI_ACCOUNT_CHECKS.SIGNIN_NOT_CONNECTED.translation,
    AI_ACCOUNT_CHECKS.SWITCH_VALUE_INVALID.translation, AI_ACCOUNT_CHECKS.AI_USE_SWITCHED_OFF.translation,
    AI_ACCOUNT_CHECKS.PROJECT_AI_KEPT_AWAY.translation, AI_ACCOUNT_CHECKS.PROJECT_KEY_NOTICE_DUE.translation,
    AI_ACCOUNT_CHECKS.DISCLOSURE_DUE.translation],
  [AI_WORDS["ai.refused.notsole"], AI_WORDS["ai.refused.signinnotconnected"], AI_WORDS["ai.refused.switchvalue"],
   AI_WORDS["ai.refused.off"], AI_WORDS["ai.refused.projectkeptaway"], AI_WORDS["ai.refused.noticedue"],
   AI_WORDS["refusal.DISCLOSURE_DUE"]]);
});

test("R33: every refusal the module answers carries its own row's check and translation (a sample of each act's refusal against AI_ACCOUNT_CHECKS)", async () => {
  const w = await world().group("ann");
  const answers = [
    await w.a.accountReferenceSet({ member: "ann", kind: "apikey", secret: SECRET, by: null }),
    await w.a.accountReferenceSet({ member: "ann", kind: "x", secret: SECRET, by: "member:ann" }),
    await w.a.accountReferenceSet({ member: "ann", kind: "apikey", secret: " ", by: "member:ann" }),
    w.a.accountUsesSet({ owner: "member:ann", switch: "nope", on: true, by: "member:ann" }),
    w.a.accountUsesSet({ owner: "member:ann", switch: "ask", on: "yes", by: "member:ann" }),
    w.a.subscriptionConnected({ member: "ann", login: "x" }),
    await w.a.subscriptionTokenHold({ member: "ann", token: "short" }),
    w.a.aiKeepAwaySet({ on: true, reason: "", by: "admin" }),
  ];
  for (const x of answers) {
    assert.equal(x.ok, false);
    const row = AI_ACCOUNT_CHECKS[x.code];
    assert.ok(row, x.code);
    assert.equal(x.check, row.check, x.code);
    assert.equal(x.translation, row.translation, x.code);
  }
});

/* ===== R34: aiKeptAway fails closed with its row ===== */

test("R34: the keep-away table made unreadable gives AI_KEPT_AWAY with its row and keep_away's three null, equal to KEPT_AWAY_UNREADABLE (control: a readable setting that is off answers null)", async () => {
  const w = await world().group("ann");
  assert.equal(w.a.aiKeptAway(), null);   /* control */
  assert.equal(w.a.aiKeptAway({ use: "ask" }), null);
  w.db.exec(`DROP TABLE ai_keep_away`);
  for (const args of [undefined, {}, { use: "ask" }, { project: "PROJ-2026-0001-x", use: "draft" }]) {
    const k = w.a.aiKeptAway(args);
    assert.deepEqual(k, KEPT_AWAY_UNREADABLE);
    assert.equal(k.code, "AI_KEPT_AWAY");
    assert.equal(k.check, AI_ACCOUNT_CHECKS.AI_KEPT_AWAY.check);
    assert.equal(k.translation, AI_ACCOUNT_CHECKS.AI_KEPT_AWAY.translation);
    assert.deepEqual(k.keep_away, { reason: null, set_by: null, set_at: null });
    assert.match(k.detail, /could not be read/);
  }
  /* the cascade refuses through it before any account is read */
  assert.deepEqual(await w.a.accountFor({ member: "ann", act: ask("ann") }), KEPT_AWAY_UNREADABLE);
});

test("R34: KEPT_AWAY_UNREADABLE is exported frozen, the refusal R7 states with its row, never a throw or a refusal without one", () => {
  assert.ok(Object.isFrozen(KEPT_AWAY_UNREADABLE));
  assert.ok(Object.isFrozen(KEPT_AWAY_UNREADABLE.keep_away));
  assert.deepEqual(KEPT_AWAY_UNREADABLE, { ok: false, reason: "AI_KEPT_AWAY", code: "AI_KEPT_AWAY", check: "C-29.31",
    translation: AI_ACCOUNT_CHECKS.AI_KEPT_AWAY.translation,
    detail: localize("ai-accounts.index.whether_the_team_keeps_its", "whether the team keeps its material away from every assistant could not be read, so no account was read or used. Nothing was sent."),
    keep_away: { reason: null, set_by: null, set_at: null } });
});

test("R34: a stored value that does not parse, a store that throws on every read, and an argument that throws inside the read each answer a refusal with its row, never a throw", async () => {
  const w = await world().group("ann");
  /* a stored `uses` that does not parse: the limit covers every use (fail closed), with its reason */
  w.db.prepare(`INSERT INTO ai_keep_away (is_on, reason, set_by, set_at, uses) VALUES (1, 'a hearing', 'admin', '2026-10-14T00:00:00Z', 'not json')`).run();
  for (const use of ["ask", "draft", "standing", null]) {
    const k = w.a.aiKeptAway({ use });
    assert.equal(k.code, "AI_KEPT_AWAY");
    assert.equal(k.check, "C-29.31");
    assert.deepEqual(k.keep_away, { reason: "a hearing", set_by: "admin", set_at: "2026-10-14T00:00:00Z" });
  }
  /* a store that throws on every read */
  const { AiAccounts } = await import("../../../src/ai-accounts/index.mjs");
  const broken = new AiAccounts({ sql: { exec() { throw new Error("disk gone"); } }, core: null, membership: w.m, sealSecret: SEAL });
  assert.deepEqual(broken.aiKeptAway({ use: "ask" }), KEPT_AWAY_UNREADABLE);
  /* an argument that throws when read inside the read: the fail-closed refusal, not a throw */
  const w2 = await world().group("bob");
  const hostile = { toString() { throw new Error("hostile"); } };
  let k;
  assert.doesNotThrow(() => { k = w2.a.aiKeptAway({ project: hostile, use: "ask" }); });
  assert.deepEqual(k, KEPT_AWAY_UNREADABLE);
  assert.ok(!Object.isFrozen(k));   /* a copy, so no caller holds the constant */
});

test("R34: a project's limit that cannot be read keeps R22's own fail-closed refusal, PROJECT_AI_KEPT_AWAY with its row (control: the group's readable limit off)", async () => {
  const w = await world().group("ann");
  w.db.exec(`DROP TABLE project_keep_away`);
  assert.equal(w.a.aiKeptAway({ use: "ask" }), null);
  const k = w.a.aiKeptAway({ project: "PROJ-2026-0001-x", use: "ask" });
  assert.equal(k.code, "PROJECT_AI_KEPT_AWAY");
  assert.equal(k.check, AI_ACCOUNT_CHECKS.PROJECT_AI_KEPT_AWAY.check);
  assert.equal(k.translation, AI_ACCOUNT_CHECKS.PROJECT_AI_KEPT_AWAY.translation);
  assert.match(k.detail, /could not be read/);
});
