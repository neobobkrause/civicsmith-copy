/* Accounts and limits (R30; D38, B3; N812, K2373), at the interface, over the real ai-accounts (T48-36): an ask's account,
   asked of `accountFor` with kind `ask` and its project, judged by the paying account's limits (`ai-use.useCheck`, its
   R3, the test's provider, handed in as the composition root hands it); and R2 widened: every read under a grant drops
   the rows of the projects `ai-accounts.projectsKeptAway` names for the grant's use. Each arm with its negative
   control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { answersWorld, answer, V } from "./fixture.mjs";
import { GRANT_USES, ASK_ACCOUNT_KINDS, RULE_USES, ownerOf, answersOps } from "../../../src/answers/index.mjs";
import { AI_ACCOUNT_CHECKS } from "../../../src/ai-accounts/index.mjs";

const BOB = V("bob"), CAROL = V("carol"), ALICE = V("alice");

test("R30 an ask calls accountFor with kind ask and its project, and is judged by useCheck for the account chosen in place of the ceiling: {ok, account, owner}, or the refusal unchanged; writes nothing", async () => {
  const w = answersWorld();
  const seen = [];
  const real = w.accounts;
  w.a.deps.accounts = new Proxy(real, { get: (t, k) => { const v = t[k]; return typeof v === "function"
    ? (...a) => { if (k === "accountFor") seen.push(a[0]); return v.apply(t, a); } : v; } });
  w.a.resolved.delete("accounts");
  /* no account serves bob yet: NO_ACCOUNT, no limit asked */
  assert.equal((await w.a.askAccount({ member: BOB })).code, "NO_ACCOUNT");
  assert.equal(w.limit.asked.length, 0, "no limit asked for an ask no account serves");
  const own = await w.ownAccount("bob", { secret: "sk-bob" });
  const before = w.snapshot();
  const r = await w.a.askAccount({ member: BOB, at: "2026-10-05T16:00:00Z" });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.owner, "member:bob"); assert.equal(r.account.level, "member");
  assert.deepEqual(seen.at(-1), { member: BOB, act: { kind: "ask", member: BOB } }, "kind ask, no project named");
  assert.deepEqual(w.limit.asked.at(-1), { owner: "member:bob", member: "bob", use: "ask", at: "2026-10-05T16:00:00Z",
                                            account_id: own, entry_id: r.account.entry_id });
  assert.deepEqual(w.snapshot(), before, "writes nothing");
  /* the limit reached: ai-use's refusal, unchanged */
  const reached = w.reach("member:bob", "ask");
  assert.deepEqual(await w.a.askAccount({ member: BOB }), reached);
  w.unreach("member:bob", "ask");
  assert.equal((await w.a.askAccount({ member: BOB })).ok, true, "under its limit again");
  /* the account chosen is the one used: its ask use off is ai-accounts R11's refusal, never the next account */
  assert.equal(w.uses(own, "ask", false, BOB).ok, true);
  assert.equal((await w.a.askAccount({ member: BOB })).code, "AI_USE_SWITCHED_OFF");
  assert.equal(w.uses(own, "ask", true, BOB).ok, true);
  /* fail closed: no useCheck to judge it, or one that throws, refuses (the negative control of the judgement) */
  for (const useCheck of [null, () => { throw new Error("down"); }]) {
    w.a.deps.useCheck = useCheck;
    const x = await w.a.askAccount({ member: BOB });
    assert.equal(x.ok, false); assert.equal(x.reason, "LIMITS_UNREADABLE");
  }
  w.a.deps.useCheck = (a) => w.useCheck(a);
  /* a project the member has joined: its account pays, judged by the project's limits */
  const P = w.project("Carol's work", "carol");
  await w.projectAccount(P, "carol", { secret: "sk-p" });
  const p = await w.a.askAccount({ member: CAROL, project: P });
  assert.equal(p.ok, true, JSON.stringify(p));
  assert.equal(p.owner, `project:${P}`); assert.equal(p.account.level, "project");
  assert.deepEqual(seen.at(-1), { member: CAROL, act: { kind: "ask", member: CAROL, project: P } });
  assert.equal(w.limit.asked.at(-1).owner, `project:${P}`);
  /* a project the member has not joined, or cannot see, is ai-accounts' refusal (its R11): no limit asked */
  const n = w.limit.asked.length;
  const out = await w.a.askAccount({ member: BOB, project: P });
  assert.equal(out.ok, false); assert.match(out.code ?? out.reason, /^(NO_SUCH_PROJECT|PROJECT_ACT_NOT_A_PARTICIPANT)$/);
  assert.equal(w.limit.asked.length, n);
  /* a project keeping its material away from asks refuses the ask in it */
  assert.equal((await real.projectAiKeepAwaySet({ project: P, on: true, uses: ["ask"], reason: "Private for now.", by: CAROL })).ok, true);
  assert.equal((await w.a.askAccount({ member: CAROL, project: P })).code, "PROJECT_AI_KEPT_AWAY");
  /* ownerOf spells each owner as ai-use R1 does */
  assert.equal(ownerOf({ level: "group" }, BOB), "group");
  assert.equal(ownerOf({ level: "member", kind: "signin", member: "bob" }, BOB), "member:bob");
});

test("R30 R2 widened: every read under a grant also drops the rows of projects kept away from AI for the grant's use (ai-accounts.projectsKeptAway), before the read log records them, and a count counts none; another use's limit drops nothing; unreadable limits, or ai-accounts unreachable, drop every project's rows", async () => {
  const w = answersWorld();
  const P = w.project("Carol's work", "carol");
  const inP = w.document("carol's budget", { title: "Budget draft", project: P });
  const open = w.document("budget minutes", { title: "Budget minutes" });
  const read = (grant, use) => w.a.logRead({ grant, viewer: CAROL, op: "search", args: { q: "budget" }, use,
    answer: { ok: true, count: 3, hits: [{ bundle_id: open.bundleId }, { bundle_id: inP.bundleId }, { bundle_id: P }] } });
  /* no limit: carol, a participant, sees her project's rows (the negative control) */
  assert.deepEqual(read("g0").hits.map((h) => h.bundle_id), [open.bundleId, inP.bundleId, P]);
  assert.equal((await w.accounts.projectAiKeepAwaySet({ project: P, on: true, uses: ["ask"], reason: "Private for now.", by: CAROL })).ok, true);
  const asked = read("g1");
  assert.deepEqual(asked.hits, [{ bundle_id: open.bundleId }], "the project and its rows dropped for an ask");
  assert.equal(asked.count, 1, "a count counts none of them");
  assert.equal(w.a.readLog("g1").answered(inP.bundleId), false); assert.equal(w.a.readLog("g1").answered(P), false);
  assert.equal(w.a.readLog("g1").use, "ask");
  /* a draft's grant reads under `draft`, a standing run's under `standing`: an ask-only limit drops nothing there */
  assert.equal(read("g2", "draft").hits.length, 3);
  assert.equal(read("g3", "standing").hits.length, 3);
  assert.deepEqual(GRANT_USES, ["ask", "draft", "standing"]);
  /* a rule answer under the grant is dropped the same way */
  w.a.registerRuleService("projectfacts", () => ({ value: { items: [{ id: P, note: "kept away" }, { id: open.bundleId }], count: 2 },
                                                    basis: "test", grade: null, status: "held", label: "computed_fact" }));
  const rule = await w.a.ruleAnswer({ service: "projectfacts", viewer: CAROL, grant: "g1" });
  assert.deepEqual(rule.value, { items: [{ id: open.bundleId }], count: 1 });
  assert.deepEqual((await w.a.ruleAnswer({ service: "projectfacts", viewer: CAROL, grant: "g2" })).value.count, 2, "a draft's grant keeps it");
  /* limits that cannot be read: every project's rows dropped, fail closed */
  const real = w.accounts;
  w.a.deps.accounts = { projectsKeptAway: () => null };
  w.a.resolved.delete("accounts");
  assert.deepEqual(read("g4", "standing").hits, [{ bundle_id: open.bundleId }]);
  w.a.deps.accounts = { projectsKeptAway: () => { throw new Error("down"); } };
  w.a.resolved.delete("accounts");
  assert.deepEqual(read("g5", "draft").hits, [{ bundle_id: open.bundleId }]);
  /* (T48-36) ai-accounts that cannot be reached is not a reading of "none kept away": fail closed too */
  for (const [i, gone] of [() => null, () => { throw new Error("down"); }, {}].entries()) {
    w.a.deps.accounts = gone; w.a.resolved.delete("accounts");
    assert.deepEqual(read(`g5-${i}`, "draft").hits, [{ bundle_id: open.bundleId }]);
  }
  /* (T48-36) the limits are ai-accounts', never credentials': credentials gone, the real limits still read */
  w.a.deps.accounts = real; w.a.resolved.delete("accounts");
  w.a.deps.credentials = null; w.a.resolved.delete("credentials");
  assert.equal(read("g5c", "draft").hits.length, 3, "an ask-only limit; credentials unreachable changes nothing");
  assert.deepEqual(read("g5d").hits, [{ bundle_id: open.bundleId }]);
  w.a.deps.credentials = w.credentials; w.a.resolved.delete("credentials");
  /* R14 still: the reads write nothing */
  const before = w.snapshot();
  read("g6");
  assert.deepEqual(w.snapshot(), before);
});

test("R30 R19 a standing run's grant reads under its own use: a project kept away from standing questions is dropped from what the AI half reads", async () => {
  const w = answersWorld();
  const P = w.project("Carol's work", "carol");
  assert.equal(w.a.standingAiSwitch({ on: true, by: ALICE }).ok, true);
  const own = await w.ownAccount("carol", { secret: "sk-c" });
  assert.equal(w.uses(own, "standing", true, CAROL).ok, true);
  assert.equal((await w.accounts.projectAiKeepAwaySet({ project: P, on: true, uses: ["standing"], reason: "Private.", by: CAROL })).ok, true);
  const got = [];
  w.a.registerStandingAnswerer("agent-worker", async (x) => {
    got.push(w.a.logRead({ grant: x.grant, viewer: x.author, op: "search", args: {},
                           answer: { ok: true, total: 2, hits: [{ bundle_id: x.finds.ids[0] }, { bundle_id: P }] } }));
    return answer();
  });
  const q = w.a.standingQuestionSet({ author: CAROL, question: "Anything new?", query: "title:budget", cadence: "daily", ends: "2026-12-31" });
  await w.a.standingTick(w.clock.now);
  const doc = w.document("budget one", { title: "Budget one" });
  w.at("2026-10-06T15:00:00.000Z");
  const run = (await w.a.standingTick(w.clock.now)).ran.find((x) => x.id === q.id);
  assert.equal(run.held_back, null, JSON.stringify(run));
  assert.deepEqual(got[0].hits, [{ bundle_id: doc.bundleId }]); assert.equal(got[0].total, 1);
  /* the same read under an ask grant keeps the project: the limit covers standing questions only */
  const ask = w.a.logRead({ grant: "g-ask", viewer: CAROL, op: "search", args: {}, answer: { ok: true, hits: [{ bundle_id: P }] } });
  assert.deepEqual(ask.hits, [{ bundle_id: P }]);
});

test("R30 with no useCheck handed in, answers judges by ai-use's useCheck on its own host (the negative control: an account under its limits is served)", async () => {
  const w = answersWorld({ deps: { useCheck: undefined } });
  await w.ownAccount("bob", { secret: "sk-bob" });
  assert.equal((await w.a.askAccount({ member: BOB })).ok, true);
  const reached = w.reach("member:bob", "ask");
  const r = await w.a.askAccount({ member: BOB });
  assert.deepEqual(r, reached);
  assert.equal(r.code, "AI_LIMIT_REACHED");
  assert.equal(w.limit.asked.length, 0, "the fixture's watched provider was not the one asked");
});

test("R30 (K2508) askAccount takes kind: ask when absent, or draft, the account and its limit judged for that kind; any other kind refused NOT_YOUR_ACCOUNT as ai-accounts R3 refuses it, with ai-accounts' row (T48-36), before any account is read", async () => {
  const w = answersWorld();
  const seen = [];
  const real = w.accounts;
  w.a.deps.accounts = new Proxy(real, { get: (t, k) => { const v = t[k]; return typeof v === "function"
    ? (...a) => { if (k === "accountFor") seen.push(a[0]); return v.apply(t, a); } : v; } });
  w.a.resolved.delete("accounts");
  const own = await w.ownAccount("bob", { secret: "sk-bob" });
  const d = await w.a.askAccount({ member: BOB, kind: "draft" });
  assert.equal(d.ok, true, JSON.stringify(d)); assert.equal(d.owner, "member:bob");
  assert.deepEqual(seen.at(-1).act, { kind: "draft", member: BOB });
  assert.equal(w.limit.asked.at(-1).use, "draft");
  assert.equal((await w.a.askAccount({ member: BOB })).ok, true);
  assert.deepEqual(seen.at(-1).act, { kind: "ask", member: BOB }, "ask when absent");
  assert.equal(w.limit.asked.at(-1).use, "ask");
  /* judged for that kind: the draft use off, or its limit reached, refuses a draft and leaves an ask served */
  assert.equal(w.uses(own, "draft", false, BOB).ok, true);
  assert.equal((await w.a.askAccount({ member: BOB, kind: "draft" })).code, "AI_USE_SWITCHED_OFF");
  assert.equal((await w.a.askAccount({ member: BOB, kind: "ask" })).ok, true);
  assert.equal(w.uses(own, "draft", true, BOB).ok, true);
  const reached = w.reach("member:bob", "draft");
  assert.deepEqual(await w.a.askAccount({ member: BOB, kind: "draft" }), reached);
  assert.equal((await w.a.askAccount({ member: BOB, kind: "ask" })).ok, true, "the ask's own limit is not the draft's");
  w.unreach("member:bob", "draft");
  /* any other kind: refused as ai-accounts R3 refuses it, with its row, no account read and no limit asked */
  const n = seen.length, m = w.limit.asked.length;
  for (const kind of ["run", "standing", "explore", "transcribe", "", "ASK", 7]) {
    const r = await w.a.askAccount({ member: BOB, kind });
    assert.equal(r.code, "NOT_YOUR_ACCOUNT", String(kind));
    assert.equal(r.check, AI_ACCOUNT_CHECKS.NOT_YOUR_ACCOUNT.check); assert.equal(r.translation, AI_ACCOUNT_CHECKS.NOT_YOUR_ACCOUNT.translation);
  }
  assert.equal(seen.length, n); assert.equal(w.limit.asked.length, m);
  assert.deepEqual(ASK_ACCOUNT_KINDS, ["ask", "draft"]);
});

test("R35 ruleAnswer and op=rule take use (ask or draft, ask when absent) and open the grant's read log with it: a draft grant first read by op=rule scrubs its later reads as a draft (R30); an ask grant unchanged; the use is the control plane's stamp, never the body's", async () => {
  const w = answersWorld();
  const P = w.project("Carol's work", "carol");
  const open = w.document("budget minutes", { title: "Budget minutes" });
  assert.equal((await w.accounts.projectAiKeepAwaySet({ project: P, on: true, uses: ["draft"], reason: "No drafts.", by: CAROL })).ok, true);
  assert.deepEqual(RULE_USES, ["ask", "draft"]);
  const url = (q) => new URL(`https://plane.test/?${new URLSearchParams({ viewer: CAROL, service: "profiles", ...q })}`);
  const rule = (q, body = {}) => answersOps(w.a, url(q), { args: { section: "time_zone" }, ...body }).rule();
  const read = (grant, use) => w.a.logRead({ grant, viewer: CAROL, op: "search", args: {}, use,
    answer: { ok: true, count: 2, hits: [{ bundle_id: open.bundleId }, { bundle_id: P }] } });
  /* a draft's grant, first read by op=rule with the plane's draft use: opened as a draft, its later reads drop P */
  assert.equal((await rule({ grant: "g-draft", use: "draft" })).ok, true);
  assert.equal(w.a.readLog("g-draft").use, "draft");
  const d = read("g-draft", "draft");
  assert.deepEqual(d.hits, [{ bundle_id: open.bundleId }], "scrubbed as a draft"); assert.equal(d.count, 1);
  /* through ruleAnswer itself, the same */
  assert.equal((await w.a.ruleAnswer({ service: "profiles", args: { section: "time_zone" }, viewer: CAROL, grant: "g-draft2", use: "draft" })).ok, true);
  assert.equal(w.a.readLog("g-draft2").use, "draft");
  assert.deepEqual(read("g-draft2", "draft").hits, [{ bundle_id: open.bundleId }]);
  /* control: an ask's grant, first read by op=rule with no use, opens as an ask and keeps P (kept away from drafts only) */
  assert.equal((await rule({ grant: "g-ask" })).ok, true);
  assert.equal(w.a.readLog("g-ask").use, "ask");
  assert.equal(read("g-ask").hits.length, 2, "an ask grant unchanged");
  /* the use is the control plane's stamp from the query: a body's use, or any other value, opens an ask */
  await rule({ grant: "g-body" }, { use: "draft" });
  assert.equal(w.a.readLog("g-body").use, "ask");
  await rule({ grant: "g-odd", use: "standing" });
  assert.equal(w.a.readLog("g-odd").use, "ask");
  /* a log already open keeps the use it opened with */
  read("g-first", "draft");
  await rule({ grant: "g-first" });
  assert.equal(w.a.readLog("g-first").use, "draft");
});
