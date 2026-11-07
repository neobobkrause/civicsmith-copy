/* ai-use R6 (the exploring gate) and R9 (the daily ask), and R10, R11 (cost before and after), at the interface, each
   with a negative control (K874). The explorer itself is not built here (B9; N815): the gate and the ask are tested
   without it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { standard, WORDS, ENTRIES, label, usage, PLANS, TASK_COSTS } from "./fixture.mjs";
import { ESTIMATE_SAMPLE, aiUseOps } from "../../../src/ai-use/index.mjs";

const AT = "2026-10-09T12:00:00Z";
/* (T53) an owner's account in the standard world, by the owner's spelling; exploring is read from the account named */
const acctOf = (w, owner) => (owner === "group" ? w.acct.group : owner === "project:P" ? w.acct.P : owner === "member:ann" ? w.acct.ann : null);
const explore = (w, owner, on, by) => w.explore(acctOf(w, owner), on, by);
/* exploreAllowed, exploreAsk and useCheck on the owner's account */
const allowed = (w, owner, more = {}) => w.u.exploreAllowed({ owner, account_id: acctOf(w, owner), ...more });
const ask = (w, owner, more = {}) => w.u.exploreAsk({ owner, account_id: acctOf(w, owner), ...more });

/* A world with a question INQ-1 drawn on by P, INQ-2 drawn on by no project, and a document that is no question. */
async function exploring() {
  const w = await standard();
  w.bundle("INQ-1", "inquiry");
  w.bundle("INQ-2", "inquiry");
  w.bundle("INFO-1", "information");
  w.cite("P", "INQ-1");
  return w;
}

/* ===== R6 ===== */

test("R6 exploreAllowed refuses EXPLORE_NOT_ENABLED when the owner's explore is no (the default), on every kind of account; at yes it passes with the machine's label naming the owner", async () => {
  const w = await exploring();
  for (const owner of ["group", "project:P", "member:ann"]) {
    const r = allowed(w, owner, { question: "INQ-1", at: AT });
    assert.deepEqual([r.code, r.check], ["EXPLORE_NOT_ENABLED", "C-143.4"], owner);
  }
  explore(w, "group", "yes", "admin");
  explore(w, "project:P", "yes", "ann");
  assert.deepEqual(allowed(w, "group", { question: "INQ-1", at: AT }),
    { ok: true, ask: false, owner: "group", account_id: w.acct.group, label: { kind: "machine", enabled_by: "group" } });
  assert.deepEqual(allowed(w, "project:P", { question: "INQ-1", at: AT }).label, { kind: "machine", enabled_by: "project:P" });
});

test("R6 at ask, it answers {ask: true} until the owner approves that local day (R9), then passes; another day asks again", async () => {
  const w = await exploring();
  explore(w, "group", "ask", "admin");
  assert.deepEqual(allowed(w, "group", { question: "INQ-1", at: AT }), { ok: true, ask: true, owner: "group", account_id: w.acct.group });
  assert.equal(w.u.exploreApprove({ owner: "group", day: "2026-10-09", by: "second", at: AT }).ok, true);
  assert.equal(allowed(w, "group", { question: "INQ-1", at: AT }).ask, false);
  assert.equal(allowed(w, "group", { question: "INQ-1", at: "2026-10-10T12:00:00Z" }).ask, true);
});

test("R6 R3's AI_LIMIT_REACHED, by its overall limit and by its explore limit; under them it passes (control)", async () => {
  const w = await exploring();
  explore(w, "group", "yes", "admin");
  w.u.aiLimitSet({ owner: "group", scope: "explore", unit: "calls", period: "day", amount: 1, by: "admin" });
  assert.equal(allowed(w, "group", { question: "INQ-1", at: AT }).ask, false);
  w.count("group", "ann", "explore", { mode: "explore" });
  assert.equal(allowed(w, "group", { question: "INQ-1", at: AT }).scope, "explore");
  w.u.aiLimitSet({ owner: "group", scope: "explore", unit: "calls", period: "day", amount: null, by: "admin" });
  w.u.aiLimitSet({ owner: "group", scope: "overall", unit: "calls", period: "day", amount: 1, by: "admin" });
  assert.equal(allowed(w, "group", { question: "INQ-1", at: AT }).scope, "overall");
});

test("R6 ai-accounts.aiKeptAway({use: explore}) refuses: the group's keep-away on explore, and a project's own on explore for the project's account; one not covering explore does not (control)", async () => {
  const w = await exploring();
  explore(w, "group", "yes", "admin");
  explore(w, "project:P", "yes", "ann");
  assert.equal(w.a.aiKeepAwaySet({ on: true, uses: ["ask"], reason: "not ask", by: "admin" }).ok, true);
  assert.equal(allowed(w, "group", { question: "INQ-1", at: AT }).ok, true, "a keep-away on ask alone");
  w.a.aiKeepAwaySet({ on: true, uses: ["explore"], reason: "no exploring", by: "admin" });
  assert.equal(allowed(w, "group", { question: "INQ-1", at: AT }).code, "AI_KEPT_AWAY");
  w.a.aiKeepAwaySet({ on: false, by: "admin" });
  w.a.projectAiKeepAwaySet({ project: "P", on: true, uses: ["explore"], reason: "ours", by: "ann" });
  assert.equal(allowed(w, "project:P", { question: "INQ-1", at: AT }).code, "PROJECT_AI_KEPT_AWAY");
});

test("R6 the question outside the owner's scope is refused EXPLORE_OUT_OF_SCOPE: the group's is every question the record holds, a project's those it draws on (citesInto), a member's none (D36)", async () => {
  const w = await exploring();
  explore(w, "group", "yes", "admin");
  explore(w, "project:P", "yes", "ann");
  explore(w, "member:ann", "yes", "ann");
  const out = (owner, q) => allowed(w, owner, { question: q, at: AT });
  assert.equal(out("group", "INQ-2").ok, true);
  for (const q of ["INFO-1", "NOPE-1", null]) assert.deepEqual([out("group", q).code, out("group", q).check], ["EXPLORE_OUT_OF_SCOPE", "C-143.5"], String(q));
  assert.equal(out("project:P", "INQ-1").ok, true);
  assert.equal(out("project:P", "INQ-2").code, "EXPLORE_OUT_OF_SCOPE", "P does not draw on INQ-2");
  assert.equal(out("member:ann", "INQ-1").code, "EXPLORE_OUT_OF_SCOPE");
});

test("R6 for the group, a question every project it is drawn on keeps from explore (projectsKeptAway) is refused; drawn on by one that does not, it passes (control)", async () => {
  const w = await exploring();
  explore(w, "group", "yes", "admin");
  w.a.projectAiKeepAwaySet({ project: "P", on: true, uses: ["explore"], reason: "ours", by: "ann" });
  assert.equal(allowed(w, "group", { question: "INQ-1", at: AT }).code, "PROJECT_AI_KEPT_AWAY");
  w.project("Q", "bob");
  w.cite("Q", "INQ-1");
  assert.equal(allowed(w, "group", { question: "INQ-1", at: AT }).ok, true);
});

test("F1 (K5821 REC-11) R6 reads the paying account, never the accountable member's own: a project's exploring turned on by ann is judged on the project's account, its explore value and its limits, while ann's own account is switched off and over its own limit; ann's own account named for the project is refused (control: a member's own account still explores no question)", async () => {
  const w = await exploring();
  explore(w, "project:P", "yes", "ann");
  /* ann's own account: explore yes and its own overall limit reached; neither bears on the project's exploring */
  assert.equal(explore(w, "member:ann", "yes", "ann").ok, true);
  w.u.aiLimitSet({ owner: "member:ann", scope: "overall", unit: "calls", period: "day", amount: 1, by: "ann" });
  w.count("member:ann", "ann", "ask");
  const r = allowed(w, "project:P", { question: "INQ-1", at: AT });
  assert.deepEqual([r.ok, r.ask, r.owner, r.account_id], [true, false, "project:P", w.acct.P], "read on the project's account");
  assert.notEqual(r.account_id, w.acct.ann);
  /* the enabling member's own account, named as the project's payer, is refused: it is not the project's */
  const own = w.u.exploreAllowed({ owner: "project:P", account_id: w.acct.ann, question: "INQ-1", at: AT });
  assert.equal(own.code, "EXPLORE_NOT_ENABLED", "a member's own account never pays a project's exploring");
  assert.equal(w.u.exploreAllowed({ owner: "group", account_id: w.acct.ann, question: "INQ-1", at: AT }).code, "EXPLORE_NOT_ENABLED");
  /* the project's explore off: refused though ann's own account says yes */
  explore(w, "project:P", "no", "ann");
  assert.equal(allowed(w, "project:P", { question: "INQ-1", at: AT }).code, "EXPLORE_NOT_ENABLED");
  /* control: a member's own account, explore yes, explores no question */
  assert.equal(allowed(w, "member:ann", { question: "INQ-1", at: AT }).code, "EXPLORE_OUT_OF_SCOPE");
});

test("R6 it writes nothing and never throws", async () => {
  const w = await exploring();
  explore(w, "group", "ask", "admin");
  const before = w.snapshot();
  for (const a of [{}, { owner: "group" }, { owner: "x", question: "INQ-1" }, { owner: "group", question: "INQ-1", at: AT }])
    assert.doesNotThrow(() => w.u.exploreAllowed(a));
  assert.equal(w.snapshot(), before);
});

/* ===== R9 ===== */

test("R9 exploreAsk records at most one pending ask an owner and local day, for an owner whose explore is ask; a second ask that day answers the first's key and mints nothing; at no or yes it is refused EXPLORE_NOT_ENABLED", async () => {
  const w = await exploring();
  assert.equal(ask(w, "group", { at: AT, what: "INQ-1" }).code, "EXPLORE_NOT_ENABLED");
  explore(w, "group", "yes", "admin");
  assert.equal(ask(w, "group", { at: AT, what: "INQ-1" }).code, "EXPLORE_NOT_ENABLED", "yes needs no ask");
  explore(w, "group", "ask", "admin");
  const a = ask(w, "group", { at: AT, what: ["What did the council vote?", "Who signed?"] });
  assert.deepEqual(a, { ok: true, key: "explore-ask:group:2026-10-09", owner: "group", day: "2026-10-09", minted: true });
  const before = w.snapshot();
  assert.deepEqual(ask(w, "group", { at: "2026-10-09T18:00:00Z", what: "something else" }),
    { ...a, minted: false });
  assert.equal(w.snapshot(), before, "mints nothing");
  assert.equal(ask(w, "group", { at: "2026-10-10T09:00:00Z", what: "next day" }).minted, true);
  for (const what of [null, "", [], ["ok", 3], "x".repeat(2001)])
    assert.equal(ask(w, "group", { at: AT, what }).code, "EXPLORE_ASK_INVALID", JSON.stringify(what)?.slice(0, 20));
});

test("R9 exploreAsksPending answers today's unapproved asks to the account's owners only, each stating the questions and R10's rough cost, its words ai.queue.exploreask; it writes nothing and never throws; approved, an ask is no longer pending", async () => {
  const w = await exploring();
  explore(w, "project:P", "ask", "ann");
  ask(w, "project:P", { at: AT, what: ["What did the council vote?"] });
  const before = w.snapshot();
  const [item] = w.u.exploreAsksPending({ viewer: "ann", at: AT }).asks;
  assert.deepEqual([item.key, item.owner, item.what, item.word, item.estimate],
    ["explore-ask:project:P:2026-10-09", "project:P", ["What did the council vote?"], "ai.queue.exploreask",
     { low: null, high: null, unit: null, basis: "not_known" }]);
  assert.equal(item.text, WORDS["ai.queue.exploreask"].replace("{what}", "What did the council vote?"));
  assert.deepEqual(w.u.exploreAsksPending({ viewer: "bob", at: AT }).asks, []);
  assert.deepEqual(w.u.exploreAsksPending({ viewer: "admin", at: AT }).asks, []);
  assert.equal(w.snapshot(), before);
  assert.doesNotThrow(() => w.u.exploreAsksPending({}));
  /* with measured exploring runs, the rough cost is a range */
  for (let i = 0; i < ESTIMATE_SAMPLE.min; i++) w.count("project:P", "ann", "explore", { mode: "explore", act: `RUN-${i}`, cost: 0.1 * (i + 1) });
  assert.deepEqual(w.u.exploreAsksPending({ viewer: "ann", at: AT }).asks[0].estimate.unit, "usd");
  w.u.exploreApprove({ owner: "project:P", day: "2026-10-09", by: "ann", at: AT });
  assert.deepEqual(w.u.exploreAsksPending({ viewer: "ann", at: AT }).asks, []);
});

test("R9 exploreApprove is one of the account's owners' act, refused as R2's for anyone else, writing nothing; a malformed day is refused; silence means no", async () => {
  const w = await exploring();
  explore(w, "project:P", "ask", "ann");
  const before = w.snapshot();
  for (const by of ["bob", "admin", null]) assert.equal(w.u.exploreApprove({ owner: "project:P", day: "2026-10-09", by }).ok, false, String(by));
  assert.equal(w.u.exploreApprove({ owner: "group", day: "2026-10-09", by: "ann" }).code, "NOT_AN_ADMIN");
  assert.equal(w.u.exploreApprove({ owner: "member:ann", day: "2026-10-09", by: "bob" }).code, "NOT_YOUR_CEILING");
  assert.equal(w.u.exploreApprove({ owner: "project:P", day: "9 Oct", by: "ann" }).code, "EXPLORE_ASK_INVALID");
  assert.equal(w.snapshot(), before);
  assert.equal(allowed(w, "project:P", { question: "INQ-1", at: AT }).ask, true, "silence: no");
  const ok = aiUseOps(w.u, new URL("http://x/?by=ann"), { owner: "project:P", day: "2026-10-09", by: "bob" }).exploreapprove();
  assert.deepEqual([ok.ok, ok.approved_by], [true, "member:ann"]);
});

/* ===== The found work (T53): exploring is read from the account by its id ===== */

test("R3 R6 R9 (T53) a member's explore use is read by account_id: her account's explore yes passes useCheck for explore and ask lets her ask; with no account named, another member's account named, or her account at no, it is EXPLORE_NOT_ENABLED (control)", async () => {
  const w = await standard();
  const bobs = await w.account("member:bob", "bob");
  w.explore(bobs, "yes", "bob");
  const check = (account_id) => w.u.useCheck({ owner: "member:ann", member: "ann", use: "explore", at: AT, account_id });
  assert.equal(check(w.acct.ann).code, "EXPLORE_NOT_ENABLED", "her account's explore is no by default");
  assert.equal(w.explore(w.acct.ann, "yes", "ann").ok, true);
  assert.equal(check(w.acct.ann), null, "read by her account's id, at yes it passes");
  for (const other of [null, undefined, bobs, "acct-none"])
    assert.equal(check(other)?.code, "EXPLORE_NOT_ENABLED", `account ${String(other)}`);
  w.explore(w.acct.ann, "ask", "ann");
  assert.equal(w.u.exploreAsk({ owner: "member:ann", account_id: w.acct.ann, at: AT, what: "worth a look" }).ok, true);
  assert.equal(w.u.exploreAsk({ owner: "member:ann", account_id: bobs, at: AT, what: "worth a look" }).code, "EXPLORE_NOT_ENABLED");
  /* a project's and the team's accounts read the same way, each by its own id */
  w.explore(w.acct.P, "yes", "ann");
  assert.equal(w.u.useCheck({ owner: "project:P", member: "bob", use: "explore", at: AT, account_id: w.acct.P }), null);
  assert.equal(w.u.useCheck({ owner: "group", member: "bob", use: "explore", at: AT, account_id: w.acct.P }).code, "EXPLORE_NOT_ENABLED",
    "the project's account is not the team's");
});

/* ===== R10, R11, R15 ===== */

test("R10 useEstimate answers basis not_known until ESTIMATE_MIN_ACTS acts of that use and mode are measured, then the least and greatest per-act figure over the latest ESTIMATE_SAMPLE, times count, basis account_measured: usd when every act carried a cost", async () => {
  const w = await standard();
  const est = (extra = {}) => w.u.useEstimate({ owner: "project:P", use: "run", mode: "investigate", viewer: "ann", ...extra });
  for (let i = 1; i < ESTIMATE_SAMPLE.min; i++) w.count("project:P", "bob", "run", { mode: "investigate", act: `R${i}`, cost: i / 10, at: `2026-10-0${i}T12:00:00Z` });
  assert.equal(est().estimate.basis, "not_known");
  w.count("project:P", "bob", "run", { mode: "investigate", act: "R5", cost: 0.5, at: "2026-10-05T12:00:00Z" });
  assert.deepEqual(est().estimate, { low: 0.1, high: 0.5, unit: "usd", basis: "account_measured", measured: 5 });
  assert.deepEqual(est({ count: 3 }).estimate, { low: 0.3, high: 1.5, unit: "usd", basis: "account_measured", measured: 5 });
  for (let i = 0; i < 20; i++) w.count("project:P", "bob", "run", { mode: "investigate", act: `L${i}`, cost: 1, at: `2026-10-08T${String(i).padStart(2, "0")}:00:00Z` });
  assert.deepEqual(est().estimate, { low: 1, high: 1, unit: "usd", basis: "account_measured", measured: 20 });
  /* negative control: another mode, or another account, has its own sample */
  assert.equal(est({ mode: "other" }).estimate.basis, "not_known");
  assert.equal(w.u.useEstimate({ owner: "member:ann", use: "run", mode: "investigate", viewer: "ann" }).estimate.basis, "not_known");
});

test("R10 acts with no cost, or a plan whose money is none, answer tokens and calls with not_measurable; it is answered only to the account's owners", async () => {
  const w = await standard();
  for (let i = 1; i <= 5; i++) w.count("member:ann", "ann", "ask", { act: `A${i}`, input: i * 100, calls: i, cost: null });
  const r = w.u.useEstimate({ owner: "member:ann", use: "ask", viewer: "ann" });
  assert.deepEqual(r.estimate, { low: 100, high: 500, unit: "tokens", calls: { low: 1, high: 5, unit: "calls" }, basis: "account_measured", not_measurable: true, measured: 5 });
  const flat = await w.account("member:cy", "cy", PLANS.none);
  assert.ok(flat);
  for (let i = 1; i <= 5; i++) w.count("member:cy", "cy", "ask", { act: `C${i}`, input: 100, cost: 0.2 });
  assert.equal(w.u.useEstimate({ owner: "member:cy", use: "ask", viewer: "cy" }).estimate.not_measurable, true, "a none plan's estimate is never shown as spend");
  assert.equal(w.u.useEstimate({ owner: "member:ann", use: "ask", viewer: "bob" }).code, "NOT_YOUR_CEILING");
  assert.equal(w.u.useEstimate({ owner: "group", use: "ask", viewer: "ann" }).code, "NOT_AN_ADMIN");
  assert.equal(w.u.useEstimate({ owner: "member:ann", use: "nope", viewer: "ann" }).code, "AI_LIMIT_INVALID");
  assert.equal(w.u.useEstimate({ owner: "member:ann", use: "ask", viewer: "ann", count: 0 }).code, "AI_LIMIT_INVALID");
});

test("R10 (T53) with fewer than ESTIMATE_MIN_ACTS measured acts and an entry_id, useEstimate answers agent-model.estimate's range for the use's part times count, its basis measured; a priced entry with no measurement answers price_only; a none plan answers not_measurable; with neither entry nor acts, not_known (control: ESTIMATE_MIN_ACTS acts answer the account's own range; a non-owner is refused as R12 refuses)", async () => {
  const w = await standard();
  const est = (extra = {}) => w.u.useEstimate({ owner: "project:P", use: "run", mode: "investigate", viewer: "ann", ...extra });
  const one = ESTIMATE_SAMPLE.min - 1;
  for (let i = 1; i <= one; i++) w.count("project:P", "bob", "run", { mode: "investigate", act: `R${i}`, cost: i / 10, at: `2026-10-0${i}T12:00:00Z` });
  /* one fewer act than the minimum and a measured entry: the entry's range for the part of `run`, times count */
  const got = await est({ entry_id: ENTRIES.measured, count: 2 });
  assert.equal(got.ok, true);
  assert.deepEqual(got.estimate, { low: TASK_COSTS.run.low * 2, high: TASK_COSTS.run.high * 2, unit: "usd", basis: "measured" });
  /* explore's part is run's (PART_OF_KIND), so the same entry answers an exploring run */
  assert.equal((await w.u.useEstimate({ owner: "project:P", use: "explore", viewer: "ann", entry_id: ENTRIES.measured })).estimate.basis, "measured");
  /* a priced entry with no measurement: price_only, no figure, never zero */
  assert.deepEqual((await est({ entry_id: ENTRIES.priced })).estimate, { low: null, high: null, unit: "usd_per_million_tokens", basis: "price_only" });
  /* neither: not_known, never zero; and a part the entry has not measured (ask) falls to its prices */
  assert.equal((await est({ entry_id: ENTRIES.unpriced })).estimate.basis, "not_known");
  assert.equal((await est({ entry_id: "fake-not-in-catalogue" })).estimate.basis, "not_known");
  assert.equal(est().estimate.basis, "not_known", "no entry named: not_known, answered at once");
  /* a none plan: the entry's money is withheld, not_measurable */
  const flat = await w.account("member:cy", "cy", PLANS.none);
  assert.ok(flat);
  assert.deepEqual((await w.u.useEstimate({ owner: "member:cy", use: "run", viewer: "cy", entry_id: ENTRIES.measured })).estimate,
    { low: null, high: null, unit: null, basis: "measured", not_measurable: true });
  /* control: the minimum reached, the account's own range wins over the entry's */
  w.count("project:P", "bob", "run", { mode: "investigate", act: "R5", cost: 0.5, at: "2026-10-05T12:00:00Z" });
  assert.deepEqual((await est({ entry_id: ENTRIES.measured })).estimate, { low: 0.1, high: 0.5, unit: "usd", basis: "account_measured", measured: 5 });
  /* control: a non-owner is refused as R12 refuses, the entry named or not; a malformed entry_id is refused naming it */
  assert.equal((await w.u.useEstimate({ owner: "project:P", use: "run", viewer: "cy", entry_id: ENTRIES.measured })).code,
    w.u.useEstimate({ owner: "project:P", use: "run", viewer: "cy" }).code);
  assert.notEqual(w.u.useEstimate({ owner: "project:P", use: "run", viewer: "cy" }).ok, true);
  const bad = await est({ entry_id: "no spaces allowed" });
  assert.equal([bad.code, bad.field].join(" "), "AI_LIMIT_INVALID entry_id");
});

test("R11 (T53) actualOf answers a run's actual cost after, cost_reported and cost_estimated apart, only to the paying account's owners; an unpriced act answers not_measurable, never 0; to anyone else, and for an act not measured, found false", async () => {
  const w = await standard();
  w.count("project:P", "bob", "run", { act: "RUN-9", input: 40, cost: 0.2, reported: 0.25, calls: 2 });
  w.count("project:P", "bob", "run", { act: "RUN-9", input: 60, cost: 0.3, calls: 1 });
  w.count("member:ann", "ann", "ask", { act: "ASK-1", input: 10, cost: null, entry_id: ENTRIES.unpriced });
  const r = w.u.actualOf({ run: "RUN-9", viewer: "ann" });
  assert.deepEqual([r.found, r.owner, r.tokens, r.calls, r.cost_reported, r.cost_estimated, r.not_measurable],
    [true, "project:P", 100, 3, { amount: 0.25, unit: "usd" }, { amount: 0.5, unit: "usd" }, undefined]);
  assert.deepEqual(w.u.actualOf({ run: "RUN-9", viewer: "bob" }), { ok: true, found: false }, "bob's act, but not his account");
  const a = w.u.actualOf({ act: "ASK-1", viewer: "ann" });
  assert.deepEqual([a.not_measurable, a.cost_reported, a.cost_estimated, a.unpriced_calls], [true, null, null, 1]);
  assert.deepEqual(w.u.actualOf({ act: "NONE", viewer: "ann" }), { ok: true, found: false });
  assert.deepEqual(w.u.actualOf({ act: "ASK-1", viewer: null }), { ok: true, found: false });
});

test("R11 R15 (T53) two conversations on one entry (effort lo, twice) and one on another (hi) under one act answer two by_entry rows with 2 and 1 calls, first seen first, each with its served label; calls sum to the act's (control: effort Low! is refused; a conversation stating neither entry nor label is kept as nulls)", async () => {
  const w = await standard();
  const conv = (entry_id, effort, more = {}) => w.u.countUsage({ owner: "member:ann", member: "ann", use: "run", mode: "run", act: "RUN-E",
    entry_id, label: label(effort, entry_id), usage: usage(10, 1, 0.01), calls: 1, at: AT, ...more });
  conv(ENTRIES.priced, "lo");
  conv(ENTRIES.other, "hi");
  conv(ENTRIES.priced, "lo");
  const r = w.u.actualOf({ act: "RUN-E", viewer: "ann" });
  assert.deepEqual(r.by_entry.map((e) => [e.entry_id, e.label.effort, e.label.model_version, e.calls]),
    [[ENTRIES.priced, "lo", `fake-version-of-${ENTRIES.priced}`, 2], [ENTRIES.other, "hi", `fake-version-of-${ENTRIES.other}`, 1]]);
  assert.equal(r.by_entry.reduce((s, e) => s + e.calls, 0), r.calls);
  assert.equal(r.by_model, undefined, "by_model is replaced");
  const before = w.snapshot();
  assert.equal(conv(ENTRIES.priced, "Low!").code, "AI_RUN_CONSUME_INVALID");
  assert.equal(w.snapshot(), before);
  w.u.countUsage({ owner: "member:ann", member: "ann", use: "run", mode: "run", act: "RUN-N", usage: usage(1), calls: 1, at: AT });
  const [n] = w.u.actualOf({ act: "RUN-N", viewer: "ann" }).by_entry;
  assert.deepEqual(n, { entry_id: null, label: { provider: null, host: null, model_version: null, effort: null, account_level: null, owner: null }, calls: 1 });
});
