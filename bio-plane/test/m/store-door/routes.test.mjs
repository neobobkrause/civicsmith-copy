/* store-door: the routes this module adds to plane's one map (`controlPlaneRoutes`), each passing R1's frame — sources'
   own map and credentials' two own-key acts (R1), the unattributed refusal tally (R8), the three drafts with the assistant
   resolved per act before their handlers (R10) — and R12, no place named. Driven at the record store's door over a real
   record (`record.mjs`). Moved from control-plane's `doorbell.test.mjs`, `r50-routes.test.mjs` and `t34-routes.test.mjs`
   at the split (K1974); the Worker's admission and stamps for these ops stay control-plane's. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { D, go, quietly } from "./harness.mjs";
const { record } = await import("./record.mjs");
const { credentialsOf, ACCOUNT_CHECKS } = await import("../../../src/credentials/index.mjs");
const { aiAccountsOf } = await import("../../../src/ai-accounts/index.mjs");
const { membershipOf } = await import("../../../src/membership/index.mjs");
const { instanceSetupOf } = await import("../../../src/setup.mjs");
const { translationsOf } = await import("../../../src/translations/index.mjs");
const { aiUseOf } = await import("../../../src/ai-use/index.mjs");
const { answersOf } = await import("../../../src/answers/index.mjs");
const { wizardScriptsOf } = await import("../../../src/wizard-scripts/index.mjs");
const { queueOps } = await import("../../../src/queue/index.mjs");
const { tasksOps } = await import("../../../src/tasks/index.mjs");
const { affordancesOps } = await import("../../../src/affordances.mjs");
const { sourcesOps } = await import("../../../src/sources/index.mjs");
const P = await import("../../../src/store-door/pull.mjs");

const USE = { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, total_cost_usd: null };
const URL0 = new URL("http://do/");

test("R1 (N13, N364, N379; K566, K723, K757, K784, K1674): the map this module adds holds queue's, tasks', affordances' and sources' own maps whole, made lazily (no instance built until a route runs), the two own-key acts, the tally, the ask's four store-internal routes, R10's two (`aikeptaway`, `subscriptionconnected`), R15's `reauthdue`, the three drafts and the pull, and nothing else", () => {
  const mine = D.controlPlaneRoutes(null, URL0, null);
  const own = (ops) => Object.keys(ops(null, URL0, null));
  const want = new Set([...own(queueOps), ...own(tasksOps), ...own(affordancesOps), ...Object.keys(sourcesOps(null, URL0, null)),
    "signerregister", "signerrevoke", "wizardrefusaltally", "aigrantadmit", "aikeptaway", "subscriptionconnected", "reauthdue", "askceiling", "askusage", "askcheck",
    "groupdescriptiondraft", "writinghelp", "translationdraft", "inboxpullfile"]);
  assert.deepEqual(new Set(Object.keys(mine)), want);
  for (const [op, f] of Object.entries(mine)) assert.equal(typeof f, "function", op);
  assert.ok(own(tasksOps).includes("checkrequest") && own(queueOps).length > 0 && own(affordancesOps).length > 0);
});

test("R1 (N379, K566): the record store's door dispatches sources' own map — each of its routes, the no-account knockerconsent included, answers sources' own words through R1's envelope, never `unknown op`; the stamps it reads are the query's", async () => {
  const r = await record();
  const { sourcesOps } = await import("../../../src/sources/index.mjs");
  const routes = Object.keys(sourcesOps({}, new URL("http://do/"), null));
  /* the no-account route is among sources' own routes, whatever else sources declares (T33, sources R16, K1550) */
  assert.ok(routes.includes("knockerconsent"), "knockerconsent is sources' route");
  for (const op of routes) {
    const a = await r.go(`${op}?by=ann&viewer=member:ann&source=203.0.113.9&now=${Date.now()}`, "POST", { captureSha: "a".repeat(64) });
    assert.equal(a.status, 200, `${op}: ${JSON.stringify(a.json).slice(0, 200)}`);
    assert.equal(a.json.ok, true, op);
    assert.notEqual(a.json.error, `unknown op: ${op}`, op);
  }
  /* the knocker's consent by a secret no knock carries is sources' own refusal */
  const kc = await r.go(`knockerconsent?source=203.0.113.9&now=${Date.now()}`, "POST", { knockerSecret: "s".repeat(24), entry: "E-1", audience: "public" });
  assert.deepEqual([kc.json.ok, kc.json.result.ok, kc.json.result.reason], [true, false, "SECRET_NOT_RECOGNISED"]);
  /* negative control: a name no module serves is still R1's refusal */
  const u = await r.go("sourcenothing", "POST", {});
  assert.deepEqual([u.status, u.json.error], [400, "unknown op: sourcenothing"]);
});

test("R1 (N364, K784; credentials R9, R10): the record store's door routes signerregister and signerrevoke to credentials' own-key acts, `by` read from the query over the body's", async () => {
  const r = await record();
  /* a machine stamp in the query is refused by credentials, whatever the body names */
  for (const op of ["signerregister", "signerrevoke"]) {
    const a = await r.go(`${op}?by=class:admin`, "POST", { keyB64: "AAAA", by: "ann" });
    assert.equal(a.status, 200, op);
    assert.equal(a.json.ok, true);
    assert.equal(a.json.result.ok, false, op);
    assert.ok(["MACHINE_CANNOT_REGISTER_KEY", "NO_SUCH_KEY"].includes(a.json.result.reason), `${op}: ${a.json.result.reason}`);
  }
  /* negative control: the query's `by` reaches credentials — a member id that is no member is answered as such */
  const n = await r.go("signerregister?by=nobody", "POST", { keyB64: "AAAA", by: "class:admin" });
  assert.notEqual(n.json.result.reason, "MACHINE_CANNOT_REGISTER_KEY");
});

test("R8 (was control-plane R50's store half; wizard-scripts R16): the store-internal route `wizardrefusaltally` hands wizard-scripts' tallyRefusal the op and the code alone — one row per call, carrying nothing but (op, code, day), whatever else the body names (negative control: an op or code that is no token is not counted)", async () => {
  assert.equal(typeof D.controlPlaneRoutes({}, new URL("http://do/"), null).wizardrefusaltally, "function");
  const r = await record();
  for (let i = 0; i < 2; i++) {
    const a = await r.go("wizardrefusaltally", "POST", { op: "index", code: "NO_SUCH_BUNDLE", viewer: "member:ann", member: "ann",
                                                         project: "PROJ-1", at: "2026-10-03T20:00:00Z" });
    assert.deepEqual([a.status, a.json], [200, { ok: true, result: { ok: true } }]);
  }
  const cols = r.db.prepare("PRAGMA table_info(wiz_refusal_tallies)").all().map((c) => c.name);
  const rows = r.db.prepare("SELECT * FROM wiz_refusal_tallies").all().map((x) => ({ ...x }));
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.deepEqual([row.op, row.code], ["index", "NO_SUCH_BUNDLE"]);
    assert.match(String(row.day), /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(JSON.stringify(row).includes("ann") || JSON.stringify(row).includes("PROJ-1"), false, JSON.stringify(row));
  }
  assert.deepEqual(cols.filter((c) => !["op", "code", "day", "tid"].includes(c)), [], cols.join());
  const bad = await r.go("wizardrefusaltally", "POST", { op: "index; drop", code: "x y" });
  assert.deepEqual(bad.json.result, { ok: false });
  assert.equal(r.db.prepare("SELECT COUNT(*) AS n FROM wiz_refusal_tallies").get().n, 2);
});

/* A record with a claimed founder, the members `ann` (an administrator) and `bea` and `cal` (members), and the three drafts'
   first two handlers replaced by recorders, so what the door hands each is seen whatever its owner answers; `translationdraft`'s
   own (instance-setup's `translationDraftRefusal` and `translationDraft`) recorded as asked and answering as they do; and
   every account read, every `answers.askAccount` asked and every ai-use limit judged counted, so a gate that read none is
   seen. */
async function drafts() {
  const r = await record({ sealSecret: "store-door-test-seal-secret-00002" });
  const C = credentialsOf(r.ctx), mb = membershipOf(r.ctx);
  await C.claim({ password: "founder-passphrase-1", tokenFp: "fp-1" });
  for (const [id, role] of [["ann", "admin"], ["bea", "member"], ["cal", "member"]]) {
    const a = await mb.memberAdd({ memberId: id, cover: `cover of ${id}`, role, capabilities: null, by: "admin" });
    assert.equal(a.ok, true, JSON.stringify(a));
    await mb.enroll({ invite: a.invite, handle: id, password: `${id}-passphrase-x` });
  }
  const seen = [];
  instanceSetupOf(r.ctx).groupDescriptionDraft = (args) => { seen.push(["groupdescriptiondraft", args]); return { ok: false, reason: "ASSISTANT_DRAFT_UNAVAILABLE" }; };
  /* writinghelp's handler is wizard-scripts' own, wrapped (K2574): the door hands it the account's or limit's refusal as
     `assistant.refusal`, which it orders among its own (its R27); `handed` records what it was handed, `seen` only an
     admitted call (one with no refusal handed) */
  const W = wizardScriptsOf(r.ctx), realHelp = W.writingHelp.bind(W), handed = [];
  W.writingHelp = (args) => { handed.push(args); if (!args.assistant?.refusal) seen.push(["writinghelp", args]); return realHelp(args); };
  /* translationdraft's handler is translations' own (T51-143: the door calls it directly): wrapped, never replaced, so what
     it is handed is seen and what it answers is its own */
  const setup = instanceSetupOf(r.ctx), firstAsked = [], tr = translationsOf(r.ctx);
  const realFirst = tr.translationDraftRefusal.bind(tr), realDraft = tr.translationDraft.bind(tr);
  tr.translationDraftRefusal = (args) => { firstAsked.push(args); return realFirst(args); };
  tr.translationDraft = (args) => { seen.push(["translationdraft", args]); return realDraft(args); };
  const reads = { account: 0, use: 0 }, asked = [];
  const accountFor = C.accountFor.bind(C), U = aiUseOf(r.ctx), useCheck = U.useCheck.bind(U);
  const A = answersOf(r.ctx), askAccount = A.askAccount.bind(A);
  C.accountFor = (a) => { reads.account++; return accountFor(a); };
  U.useCheck = (a) => { reads.use++; return useCheck(a); };
  A.askAccount = (a) => { asked.push(a); return askAccount(a); };
  const code = (a) => a.json.result.code ?? a.json.result.reason;
  /* a draft's use, counted to the account that paid through the door's own `askusage` (R11) */
  const spend = (member, calls) => r.go(`askusage?viewer=member:${member}`, "POST", { mode: "draft", usage: USE, calls });
  return { r, C, U, seen, handed, code, firstAsked, reads, asked, spend, tr };
}

/* The group's keep-away, credentials' (its R51, R57; DEC-172), which R10 reads through
   `credentials.aiKeptAway({use: "draft"})` (its R35) and from which instance-setup derives `assistantState()` (its R53;
   K2162): keep-away off is the assistant on. `uses`, the kinds it covers (all when absent). */
function assistant(r, on, uses = null) {
  const k = credentialsOf(r.ctx).aiKeepAwaySet(on ? { on: false, by: "ann" }
    : { on: true, reason: "kept away for this test", by: "ann", ...(uses ? { uses } : {}) });
  assert.equal(k.ok, true, JSON.stringify(k));
  if (!uses) assert.equal(instanceSetupOf(r.ctx).assistantState().on, on);
}
const DAY_CALLS = (owner, amount, by) => ({ owner, scope: "overall", unit: "calls", period: "day", amount, by });

test("R10 (N765, N812; K2373, K2500; credentials R35, R56, R57; answers R30; ai-use R3; membership R84): before either draft's handler the door answers, in order, `groupdescriptiondraft`'s NOT_AN_ADMIN; AI_KEPT_AWAY as `credentials.aiKeptAway({use: \"draft\"})` answers it (its row and reason; no account read, no limit judged); then `answers.askAccount({member, kind: \"draft\"})`'s refusal as given — NO_ACCOUNT (credentials' own row), AI_USE_SWITCHED_OFF (before the limit, and with no limit judged), AI_LIMIT_REACHED, its fail-closed LIMITS_UNREADABLE, and credentials' own (the group key's notice unread) — each before any handler is asked, and for `writinghelp` handed to its handler as `assistant.refusal` with no account (K2574; wizard-scripts R27), keep-away answered first at the door (negative controls: a keep-away covering only asks keeps no draft away; once every refusal is cleared the handlers are reached)", async () => {
  const { r, C, U, seen, handed, code, reads, asked, spend } = await drafts();
  /* (K2574; wizard-scripts R27) what writinghelp's handler was last handed: the door's account or limit refusal in
     `assistant.refusal`, with no account */
  const handedRefusal = () => { const h = handed.at(-1).assistant; return [h.on, h.account, h.refusal.code ?? h.refusal.reason]; };
  const gdd = (by) => r.go(`groupdescriptiondraft?by=${by}&viewer=${by}`, "POST", { answers: [{ question: "q", text: "t" }] });
  const help = (by) => r.go(`writinghelp?by=${by}&viewer=${by}`, "POST", { op: "notewrite", field: "text", told: "what I saw" });
  /* NOT_AN_ADMIN first, whatever else holds, keep-away included */
  assistant(r, false);
  for (const by of ["member:bea", "class:admin", ""]) assert.equal(code(await gdd(by)), "NOT_AN_ADMIN", by);
  /* kept away: credentials' one refusal for a draft as given, and nothing read past it */
  const away = C.aiKeptAway({ use: "draft" });
  assert.deepEqual([away.reason, away.keep_away.reason], ["AI_KEPT_AWAY", "kept away for this test"]);
  assert.deepEqual((await gdd("member:ann")).json.result, away);
  assert.deepEqual((await help("member:bea")).json.result, away);
  assert.deepEqual([reads, asked, handed], [{ account: 0, use: 0 }, [], []], "under keep-away no account is read, and the door answers first");
  /* the use is the draft's: kept away from drafts alone refuses; kept away from asks alone does not (negative control) */
  assistant(r, false, ["draft"]);
  assert.equal(C.aiKeptAway({ use: "ask" }), null);
  assert.deepEqual((await help("member:bea")).json.result, C.aiKeptAway({ use: "draft" }));
  assert.deepEqual(reads, { account: 0, use: 0 });
  assistant(r, false, ["ask"]);
  assert.equal(C.aiKeptAway({ use: "ask" }).reason, "AI_KEPT_AWAY");
  /* the door's own gate (groupdescriptiondraft's handler adds no keep-away of its own; writinghelp's handler asks its own,
     wizard-scripts R24, reported to BOB) */
  assert.equal(code(await gdd("member:ann")), "NO_ACCOUNT", "an ask's keep-away keeps no draft away");
  assistant(r, true);
  /* no account serves: askAccount's refusal, asked for the stamped member with kind draft, and no limit judged */
  asked.length = 0; reads.use = 0;
  const noAccount = (await gdd("member:ann")).json.result;
  assert.deepEqual([noAccount.code, noAccount.check, noAccount.translation], ["NO_ACCOUNT", ACCOUNT_CHECKS.NO_ACCOUNT.check,
                   ACCOUNT_CHECKS.NO_ACCOUNT.translation], "credentials' own row, as given");
  assert.equal(code(await help("member:bea")), "NO_ACCOUNT");
  assert.deepEqual(handedRefusal(), [true, null, "NO_ACCOUNT"]);
  assert.deepEqual(asked, [{ member: "member:ann", kind: "draft" }, { member: "member:bea", kind: "draft" }]);
  assert.equal(reads.use, 0);
  /* the member's own account: its draft switch off refuses before its limit, which is not judged */
  assert.equal((await aiAccountsOf(r.ctx).accountReferenceSet({ member: "member:bea", kind: "apikey", secret: "sk-bea-own", by: "member:bea" })).ok, true);
  assert.equal((await spend("bea", 2)).json.result.ok, true);
  assert.equal(U.aiLimitSet(DAY_CALLS("member:bea", 2, "member:bea")).ok, true);
  assert.equal(C.accountUsesSet({ owner: "member:bea", switch: "draft", on: false, by: "member:bea" }).ok, true);
  reads.use = 0;
  const off = (await help("member:bea")).json.result;
  assert.deepEqual([off.code, off.whose, off.use, reads.use], ["AI_USE_SWITCHED_OFF", "own", "draft", 0]);
  assert.deepEqual(handedRefusal(), [true, null, "AI_USE_SWITCHED_OFF"]);
  assert.equal(C.accountUsesSet({ owner: "member:bea", switch: "draft", on: true, by: "member:bea" }).ok, true);
  /* then ai-use's limit of the account that pays, AI_LIMIT_REACHED with its scope, naming no cost */
  const lim = (await help("member:bea")).json.result;
  assert.deepEqual([lim.code, lim.scope, lim.unit, lim.period], ["AI_LIMIT_REACHED", "overall", "calls", "day"], JSON.stringify(lim));
  assert.equal(reads.use, 1);
  assert.deepEqual(handedRefusal(), [true, null, "AI_LIMIT_REACHED"]);
  assert.equal(U.aiLimitSet(DAY_CALLS("member:bea", null, "member:bea")).ok, true);
  /* a limit that cannot be judged refuses, fail closed */
  U.useCheck = () => { throw new Error("counter unreadable"); };
  assert.equal(code(await help("member:bea")), "LIMITS_UNREADABLE");
  delete U.useCheck;
  /* the group's key held and on, its notice unread by ann: credentials' own refusal, relayed with its row */
  assert.equal((await aiAccountsOf(r.ctx).groupKeySet({ key: "sk-group-key", by: "admin" })).ok, true);
  assert.equal(aiAccountsOf(r.ctx).groupKeySwitch({ on: true, by: "admin" }).ok, true);
  const due = await gdd("member:ann");
  /* (T53; ai-accounts R51) the notice is now per recipient: ai-accounts' own refusal for the team key's host */
  assert.equal(code(due), "RECIPIENT_NOTICE_DUE");
  assert.equal(typeof due.json.result.translation, "string");
  assert.deepEqual(seen, [], "no handler was asked");
  /* every refusal cleared: the handlers are reached */
  assert.equal(aiAccountsOf(r.ctx).groupKeyNoticeSeen({ member: "member:ann", by: "member:ann" }).ok, true);
  assert.equal(code(await gdd("member:ann")), "ASSISTANT_DRAFT_UNAVAILABLE");
  assert.equal(code(await help("member:bea")), "ASSISTANT_DRAFT_UNAVAILABLE");
  assert.deepEqual(seen.map(([op]) => op), ["groupdescriptiondraft", "writinghelp"]);
});

test("R10 (N669, N765, N812; K2200, K2201, K2238, K2500; instance-setup R67; answers R30): `translationdraft`, in both directions, answers instance-setup's own first refusal (`translationDraftRefusal`, asked with the body's `language`, `direction`, `keys`, `key` and the stamped `by`) before anything of the door's — TRANSLATION_DIRECTION_UNKNOWN, TRANSLATION_NOT_GRANTED, and NOT_AN_ADMIN for `to_english` — kept away or not; then AI_KEPT_AWAY as `credentials.aiKeptAway({use: \"draft\"})` answers it, no account read and no draft routed; then `answers.askAccount`'s refusals for kind draft, NO_ACCOUNT and AI_LIMIT_REACHED; admitted, instance-setup's `translationDraft` receives those arguments and `assistant: {on, account: {kind, level}}`, a caller's `assistant` never read and no key handed, and answers its words (negative control: a granted speaker clears the first refusal)", async () => {
  const { r, C, U, seen, code, firstAsked, reads, asked, spend, tr } = await drafts();
  /* `by` as control-plane stamps it, the folded member id; `viewer` the member */
  const draft = (by, body) => r.go(`translationdraft?by=${by}&viewer=member:${by}`, "POST", body);
  const word = (await import("../../../src/setup-words/index.mjs")).WORD_ROWS
    .map(([key, en, , , prot]) => ({ key, en, protected: prot })).find((w) => w.protected && !/[{}]/.test(w.en));
  const TO_LANG = { language: "es", direction: "to_language", keys: [word.key] };
  const TO_EN = { language: "es", direction: "to_english", key: word.key };
  const want = (body, by) => ({ language: body.language, direction: body.direction, keys: body.keys, key: body.key, by });
  /* the handler's own first refusal wins, kept away or not */
  assistant(r, false);
  for (const [body, by, reason] of [[TO_LANG, "bea", "TRANSLATION_NOT_GRANTED"], [TO_EN, "bea", "NOT_AN_ADMIN"],
                                    [{ language: "es", direction: "sideways" }, "ann", "TRANSLATION_DIRECTION_UNKNOWN"]]) {
    firstAsked.length = 0;
    assert.equal(code(await draft(by, body)), reason, JSON.stringify(body));
    assert.deepEqual(firstAsked, [want(body, by)]);
  }
  assert.deepEqual([reads, asked, seen], [{ account: 0, use: 0 }, [], []]);
  /* negative control: a granted speaker clears it, and meets keep-away; an awaiting kept word clears to_english's */
  const g = tr.translationGrant({ member: "bea", language: "es", by: "ann" });
  assert.equal(g.ok, true, JSON.stringify(g));
  const kept = tr.translationAdopt({ language: "es", key: word.key, text: "palabra de prueba", by: "bea" });
  assert.deepEqual([kept.ok, kept.state], [true, "awaiting"], JSON.stringify(kept));
  const TO_LANG2 = { language: "es", direction: "to_language" };
  for (const [body, by] of [[TO_LANG2, "bea"], [TO_EN, "ann"]])
    assert.deepEqual((await draft(by, body)).json.result, C.aiKeptAway({ use: "draft" }), body.direction);
  assert.deepEqual([reads, asked, seen], [{ account: 0, use: 0 }, [], []], "under keep-away no account is read and no draft routed");
  assistant(r, true);
  /* then the account and its limit, as answers judges them for a draft */
  assert.equal(code(await draft("ann", TO_EN)), "NO_ACCOUNT");
  assert.deepEqual(asked, [{ member: "ann", kind: "draft" }]);
  for (const m of ["ann", "bea"])
    assert.equal((await aiAccountsOf(r.ctx).accountReferenceSet({ member: `member:${m}`, kind: "apikey", secret: `sk-${m}-own-secret`, by: `member:${m}` })).ok, true);
  assert.equal((await spend("bea", 2)).json.result.ok, true);
  assert.equal(U.aiLimitSet(DAY_CALLS("member:bea", 2, "member:bea")).ok, true);
  assert.equal(code(await draft("bea", TO_LANG2)), "AI_LIMIT_REACHED");
  assert.equal(U.aiLimitSet(DAY_CALLS("member:bea", null, "member:bea")).ok, true);
  assert.deepEqual(seen, [], "no draft routed before every refusal is cleared");
  /* admitted, both directions: instance-setup's own answer, the words the door sends to the assistant */
  const forged = { on: true, account: { kind: "apikey", level: "member", key: "sk-forged" } };
  const A = { on: true, account: { kind: "apikey", level: "member" } };
  const l = (await draft("bea", { ...TO_LANG2, assistant: forged })).json.result;
  assert.deepEqual([l.reason, l.direction, l.language], ["ASSISTANT_DRAFT_UNAVAILABLE", "to_language", "es"], JSON.stringify(l).slice(0, 300));
  assert.ok(Array.isArray(l.words) && l.words.length > 0 && !l.words.some((w) => w.key === word.key));
  const e = (await draft("ann", { ...TO_EN, assistant: forged })).json.result;
  assert.deepEqual([e.reason, e.direction, e.key, e.words], ["ASSISTANT_DRAFT_UNAVAILABLE", "to_english", word.key,
                   [{ key: word.key, en: word.en, text: "palabra de prueba", protected: true }]]);
  assert.deepEqual(seen, [["translationdraft", { ...want(TO_LANG2, "bea"), assistant: A }],
                          ["translationdraft", { ...want(TO_EN, "ann"), assistant: A }]]);
  for (const s of ["sk-ann-own-secret", "sk-bea-own-secret", "sk-forged"]) assert.equal(JSON.stringify([seen, l, e]).includes(s), false, s);
});

test("R10 (K1755; control-plane R29, R30): a draft's handler receives `assistant` as the door resolved it — `{on: true, account: {kind, level}}`, the member's own account or the group's key, never the key — its own arguments from the body and `by` and `viewer` as stamped; a caller's `assistant` is never read (negative control: no secret appears in anything handed over or answered)", async () => {
  const { r, C, seen } = await drafts();
  assistant(r, true);
  assert.equal((await aiAccountsOf(r.ctx).accountReferenceSet({ member: "member:bea", kind: "apikey", secret: "sk-bea-own-secret", by: "member:bea" })).ok, true);
  assert.equal((await aiAccountsOf(r.ctx).groupKeySet({ key: "sk-group-key-secret", by: "admin" })).ok, true);
  assert.equal(aiAccountsOf(r.ctx).groupKeySwitch({ on: true, by: "admin" }).ok, true);
  assert.equal(aiAccountsOf(r.ctx).groupKeyNoticeSeen({ member: "member:ann", by: "member:ann" }).ok, true);
  const forged = { on: true, account: { kind: "apikey", level: "member", key: "sk-forged" } };
  const a = await r.go("groupdescriptiondraft?by=member:ann&viewer=member:ann", "POST",
                       { answers: [{ question: "Who are you?", text: "Tenants" }], assistant: forged });
  const b = await r.go("writinghelp?by=member:bea&viewer=member:bea", "POST",
                       { op: "notewrite", field: "text", told: "the lift was out", draftHeld: false, assistant: forged });
  assert.deepEqual(seen, [
    ["groupdescriptiondraft", { answers: [{ question: "Who are you?", text: "Tenants" }],
                                assistant: { on: true, account: { kind: "apikey", level: "group" } }, viewer: "member:ann", by: "member:ann" }],
    ["writinghelp", { op: "notewrite", field: "text", told: "the lift was out", draftHeld: false,
                      assistant: { on: true, account: { kind: "apikey", level: "member" } }, by: "member:bea", viewer: "member:bea" }],
  ]);
  const all = JSON.stringify([seen, a.json, b.json]);
  for (const s of ["sk-bea-own-secret", "sk-group-key-secret", "sk-forged"]) assert.equal(all.includes(s), false, s);
});

test("R10 (K2238; control-plane R65; credentials R35, R43): the store-internal routes `aikeptaway` and `subscriptionconnected` answer credentials' own words — `aiKeptAway()` as given while the group keeps its material away and `{ok: true}` while it does not; `subscriptionConnected` for the member the stamped `by`, whatever the body names (negative control: a member not active is credentials' own refusal, recording nothing)", async () => {
  const { r, C } = await drafts();
  assistant(r, false);
  const kept = await r.go("aikeptaway", "POST", {});
  assert.deepEqual([kept.status, kept.json.result], [200, C.aiKeptAway()]);
  assert.equal(kept.json.result.reason, "AI_KEPT_AWAY");
  assistant(r, true);
  assert.deepEqual((await r.go("aikeptaway", "POST", {})).json.result, { ok: true });
  const asked = [];
  const AA = aiAccountsOf(r.ctx), orig = AA.subscriptionConnected.bind(AA);
  AA.subscriptionConnected = (a) => { asked.push(a); return orig(a); };
  const ok = await r.go("subscriptionconnected?by=member:bea", "POST", { member: "member:ann", login: "code-x" });
  assert.equal(ok.json.result.ok, true, JSON.stringify(ok.json));
  const no = await r.go("subscriptionconnected?by=member:nobody", "POST", {});
  assert.equal(no.json.result.reason, "ACCOUNT_MEMBER_NOT_ACTIVE");
  assert.deepEqual(asked, [{ member: "member:bea" }, { member: "member:nobody" }]);
  /* (T53; ai-accounts R59) the old form records nothing now: the door's answer is ai-accounts' own, asked again here */
  assert.deepEqual(ok.json.result, orig({ member: "member:bea" }));
  assert.equal(ok.json.result.held, false);
});

test("R16 (T48; N996; K3101; amends R10, R11): the door reads `aiKeptAway`, `accountFor` and `subscriptionConnected` from `ai-accounts`, never through `credentials`' delegates — with those three delegates made to throw, `aikeptaway` and `subscriptionconnected` answer as before, a draft under keep-away is refused AI_KEPT_AWAY with its row, and `askusage` counts to the paying account (the door's `accountFor` read is ai-accounts'); `credentials` is kept for `aigrantadmit`, `signerregister` and `signerrevoke` (negative control: the same routes with ai-accounts' reads made to throw do not answer as before)", async () => {
  const { r, C } = await drafts();
  const AA = aiAccountsOf(r.ctx);
  assert.equal((await aiAccountsOf(r.ctx).accountReferenceSet({ member: "member:ann", kind: "apikey", secret: "sk-ann-own", by: "member:ann" })).ok, true);
  assistant(r, false);
  const keptBefore = (await r.go("aikeptaway", "POST", {})).json.result;
  const draftBefore = (await r.go("groupdescriptiondraft?by=member:ann&viewer=member:ann", "POST", { text: "x" })).json.result;
  assistant(r, true);
  const subBefore = (await r.go("subscriptionconnected?by=member:bea", "POST", {})).json.result;
  const boom = () => { throw new Error("credentials' delegate was called"); };
  const saved = { a: C.aiKeptAway, b: C.accountFor, c: C.subscriptionConnected };
  C.aiKeptAway = boom; C.accountFor = boom; C.subscriptionConnected = boom;
  try {
    assistant(r, false);
    assert.deepEqual((await r.go("aikeptaway", "POST", {})).json.result, keptBefore);
    assert.equal(keptBefore.reason, "AI_KEPT_AWAY");
    assert.deepEqual((await r.go("groupdescriptiondraft?by=member:ann&viewer=member:ann", "POST", { text: "x" })).json.result, draftBefore);
    assistant(r, true);
    assert.deepEqual((await r.go("aikeptaway", "POST", {})).json.result, { ok: true });
    assert.deepEqual((await r.go("subscriptionconnected?by=member:bea", "POST", {})).json.result, subBefore);
    const u = await r.go("askusage?viewer=member:ann", "POST", { usage: USE });
    assert.equal(u.json.result.owner, "member:ann", JSON.stringify(u.json).slice(0, 300));
  } finally { C.aiKeptAway = saved.a; C.accountFor = saved.b; C.subscriptionConnected = saved.c; }
  /* negative control: ai-accounts' own reads are the ones the door asks */
  const savedAA = { a: AA.aiKeptAway, c: AA.subscriptionConnected };
  AA.aiKeptAway = boom; AA.subscriptionConnected = boom;
  try {
    const k = await r.go("aikeptaway", "POST", {});
    const s2 = await r.go("subscriptionconnected?by=member:bea", "POST", {});
    assert.equal(k.json.ok === true && JSON.stringify(k.json.result) === JSON.stringify({ ok: true }), false);
    assert.equal(s2.json.ok === true && JSON.stringify(s2.json.result) === JSON.stringify(subBefore), false);
  } finally { AA.aiKeptAway = savedAA.a; AA.subscriptionConnected = savedAA.c; }
});

test("R15 (T47; K3143; admission R25, credentials R71 (2)): the store-internal route `reauthdue` answers `{due}` from `credentials.reauthDue({token})`, the token the `x-bio-session` header the door hands on as `session` — `due` credentials' own REAUTH_DUE refusal, as given, for a live session outside its re-ask window (a fresh sign-in, a window lapsed) and null inside it, as `reauthDue` answers (admission R25 reads null as open); a token naming no session (absent, unknown, signed out) answers `{due: false}`; asking reads the session as no activity and writes nothing (controls: the same session after `reauth` answers null; the header's token is read over one in the query)", async () => {
  const { SESSION_HEADER } = D;
  const r = await record({ sealSecret: "store-door-test-seal-secret-00006" });
  const C = credentialsOf(r.ctx);
  assert.equal((await C.claim({ password: "founder-passphrase-1", handle: "founder", tokenFp: "fp-1" })).ok, true);
  const signed = await C.login({ handle: "founder", password: "founder-passphrase-1" });
  assert.equal(signed.ok, true, JSON.stringify(signed));
  const T = signed.token;
  const ask = async (token, path = "reauthdue") => {
    const a = await r.go(path, "POST", {}, token === null ? {} : { [SESSION_HEADER]: token });
    assert.deepEqual([a.status, a.json.ok], [200, true], JSON.stringify(a.json).slice(0, 300));
    return a.json.result;
  };
  const sessions = () => r.db.prepare("SELECT token_sha, last_active, reauth_until FROM sessions ORDER BY token_sha").all().map((x) => ({ ...x }));
  /* a fresh sign-in: outside the window, credentials' own refusal as given */
  const before = sessions();
  const due = await ask(T);
  assert.deepEqual(Object.keys(due), ["due"]);
  assert.deepEqual(due.due, C.reauthDue({ token: T }));
  assert.deepEqual([due.due.reason, due.due.code, due.due.check, due.due.translation],
                   ["REAUTH_DUE", "REAUTH_DUE", ACCOUNT_CHECKS.REAUTH_DUE.check, ACCOUNT_CHECKS.REAUTH_DUE.translation]);
  assert.deepEqual(sessions(), before, "asking writes nothing, not even the session's activity");
  /* control: the password given again opens the window, and the same session answers false */
  assert.equal((await C.reauth({ token: T, password: "founder-passphrase-1" })).ok, true);
  assert.deepEqual(await ask(T), { due: null });
  assert.equal(C.reauthDue({ token: T }), null);
  /* the window lapsed: due again */
  r.db.prepare("UPDATE sessions SET reauth_until = ?").run(Date.now() - 1);
  assert.equal((await ask(T)).due.reason, "REAUTH_DUE");
  /* a token naming no session: {due: false}, so the gate's own session read refuses it */
  for (const t of [null, "", "no-such-token-" + "x".repeat(20)]) assert.deepEqual(await ask(t), { due: false }, String(t));
  /* the token is the header's, handed over any in the query (R9) */
  assert.equal((await ask("no-such-token-y", `reauthdue?session=${T}`)).due, false, "the header's token is read over the query's");
  /* signed out: no session, {due: false} */
  r.db.prepare("DELETE FROM sessions").run();
  assert.deepEqual(await ask(T), { due: false });
});

test("R12: no place is named in this module's behaviour or outward text — every answer the door itself builds (BAD_JSON, unknown op, the internal error, both hold refusals), every reason it lists for a read naming no project, and the filed record and the sentences of the pull (negative control: the pattern finds a place)", async () => {
  const PLACES = /\b(oakland|alameda|berkeley|california|san francisco|bay area|emeryville|contra costa)\b/i;
  assert.match("Oakland", PLACES);
  const texts = [];
// fixtures-own: input a route map handed to the door under test; its routes throw or answer as the test states
  const s = { routes: () => ({ boom: () => { throw new Error("x"); }, purge: () => ({ ok: true }) }), membership: () => null,
              namespace: () => "bio", purgeHeld: () => true };
  texts.push((await go(s, "x", { method: "POST", body: "{" })).json, (await go(s, "nosuch")).json,
             (await quietly(() => go(s, "boom"))).value.json, (await go(s, "purge")).json, (await go(s, "purge?bundleId=B-1")).json);
  texts.push(D.PROJECT_NAMING_READS_NOT, D.PROJECT_NAMING_READS, P.PULL_BUNDLE_SLUG);
  for (const t of texts) assert.doesNotMatch(JSON.stringify(t), PLACES);
  /* the pull's filed bundle and its answers */
  const r = await record();
  const k = (await r.go("knock?source=203.0.113.9", "POST", { content: "material", note: "n", now: Date.now() })).json.result;
  const p = await r.go("inboxpullfile?by=ann&identity=member:ann&viewer=member:ann", "POST", { knockId: k.knockId });
  assert.equal(p.json.result.ok, true);
  const { recordOf } = await import("../../../src/record-core/index.mjs");
  assert.doesNotMatch(recordOf(r.ctx).readFile(p.json.result.bundle.bundleId, "bundle.md").text, PLACES);
  assert.doesNotMatch(JSON.stringify(p.json), PLACES);
});
