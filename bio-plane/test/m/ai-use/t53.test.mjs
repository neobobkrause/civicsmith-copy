/* ai-use T53 (BR18–BR24, AIR26, AD38; K5457, K5459, K5480, K5481, K5487): provider limits (R18, R19), the ordered-list
   exception (R20), the switch estimate (R22), thresholds (R23, R24), reconciliation (R25), no model ids (R26), use by member
   (R27), re-testing (R28–R30) and health counts (R31–R33), with R13's new words; at the interface, each with a negative
   control (K874). Fake entries and plans only (R26). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { standard, usage, label, ENTRIES, PLANS, PRICES } from "./fixture.mjs";
import { PROVIDER_REPROBE_MS, RECONCILE_TOLERANCE, HEALTH_MIN_CALLS, HEALTH_DAYS_MAX, HEALTH_KEEP_DAYS, RETEST_MODE, AI_USE_NEW_WORDS,
  aiUseOps } from "../../../src/ai-use/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const AT = "2026-10-09T12:00:00Z";
const plus = (iso, ms) => new Date(Date.parse(iso) + ms).toISOString().replace(/\.000Z$/, "Z");

/* ===== R18, R19: provider limits ===== */

test("R18 a spent-cap limit recorded with a reset time makes useCheck refuse (source provider) until that time and not after; recorded twice it stores one row; a null reset time allows a probe after PROVIDER_REPROBE_MS (control: a plain rate-limit error is not a limit and is refused, recording nothing)", async () => {
  const w = await standard();
  const rec = (more = {}) => w.u.recordProviderLimit({ owner: "group", account_id: w.acct.group, entry_id: null, kind: "spend", scope: "account",
    resets_at: "2026-10-10T00:00:00Z", at: AT, ...more });
  const judge = (at) => w.u.useCheck({ owner: "group", member: "bob", use: "ask", at, account_id: w.acct.group, entry_id: ENTRIES.priced });
  assert.equal(rec().ok, true);
  assert.equal(rec().recorded, false, "the same limit recorded again");
  assert.equal(w.rows(`SELECT * FROM ai_provider_limits`).length, 1);
  assert.equal(judge("2026-10-09T23:59:59Z").source, "provider");
  assert.equal(judge("2026-10-10T00:00:00Z"), null);
  /* no reset time: it stands for the re-probe interval, then one call may probe it; a repeat limit re-records it */
  rec({ kind: "quota", scope: "entry", entry_id: ENTRIES.priced, resets_at: null });
  const t = "2026-10-11T00:00:00Z";
  w.u.recordProviderLimit({ owner: "group", account_id: w.acct.group, entry_id: ENTRIES.priced, kind: "quota", scope: "entry", resets_at: null, at: t });
  assert.deepEqual([judge(plus(t, PROVIDER_REPROBE_MS - 1000)).resets_at, judge(plus(t, PROVIDER_REPROBE_MS - 1000)).word], [null, "ai.refused.limit.provider.unknown"]);
  assert.equal(judge(plus(t, PROVIDER_REPROBE_MS)), null, "the probe is let through");
  w.u.recordProviderLimit({ owner: "group", account_id: w.acct.group, entry_id: ENTRIES.priced, kind: "quota", scope: "entry", resets_at: null, at: plus(t, PROVIDER_REPROBE_MS) });
  assert.equal(judge(plus(t, PROVIDER_REPROBE_MS + 1000)).source, "provider", "a repeat limit stands again");
  assert.equal(w.u.useCheck({ owner: "group", member: "bob", use: "ask", at: plus(t, 1000), account_id: w.acct.group, entry_id: ENTRIES.other }), null,
    "an entry-scoped limit binds that entry alone");
  const before = w.snapshot();
  for (const bad of [{ kind: "rate_limit" }, { kind: "error" }, { scope: "team" }, { account_id: null }, { owner: "x" }, { resets_at: "soon" }, { scope: "entry", entry_id: null }])
    assert.equal(rec(bad).code, "AI_RUN_CONSUME_INVALID", JSON.stringify(bad));
  assert.equal(w.snapshot(), before);
});

test("R18 R31 a provider limit is a limit reached, never a failure for health: recording one counts nothing in ai_health; a limit outcome counted for health adds to calls only", async () => {
  const w = await standard();
  w.u.recordProviderLimit({ owner: "group", account_id: w.acct.group, entry_id: null, kind: "spend", scope: "account", resets_at: null, at: AT });
  assert.equal(w.rows(`SELECT * FROM ai_health`).length, 0);
  w.u.countHealth({ entry_id: ENTRIES.priced, personal: false, outcome: "limit", at: AT });
  assert.deepEqual(w.rows(`SELECT calls, refused, silent, errors FROM ai_health`), [{ calls: 1, refused: 0, silent: 0, errors: "{}" }]);
});

test("R19 aiProviderLimits answers an owner the standing limit and its reset time, a past one in the history only, naming no member; a non-owner is refused as R12 refuses (control: an account with none answers empty lists)", async () => {
  const w = await standard();
  assert.deepEqual(w.u.aiProviderLimits({ owner: "project:P", viewer: "ann", at: AT }), { ok: true, owner: "project:P", standing: [], history: [] });
  w.u.recordProviderLimit({ owner: "project:P", account_id: w.acct.P, entry_id: null, kind: "spend", scope: "account", resets_at: "2026-10-09T13:00:00Z", at: AT });
  w.u.recordProviderLimit({ owner: "project:P", account_id: w.acct.P, entry_id: ENTRIES.priced, kind: "rate_window", scope: "entry", resets_at: "2026-10-09T11:00:00Z", at: "2026-10-09T10:00:00Z" });
  const r = w.u.aiProviderLimits({ owner: "project:P", viewer: "ann", at: AT });
  assert.deepEqual(r.standing.map((x) => [x.kind, x.resets_at]), [["spend", "2026-10-09T13:00:00Z"]]);
  assert.deepEqual(r.history.map((x) => [x.kind, x.entry_id]), [["rate_window", ENTRIES.priced]]);
  assert.doesNotMatch(JSON.stringify(r), /"(ann|bob)"/);
  for (const viewer of ["bob", "cy", null]) assert.deepEqual(w.u.aiProviderLimits({ owner: "project:P", viewer, at: AT }).code,
    w.u.aiLimits({ owner: "project:P", viewer }).code, String(viewer));
});

/* ===== R20: the ordered-list exception ===== */

/* A walk helper over fake accounts, as ai-accounts' hop rules call ai-use: the first account in the list whose own useCheck
   passes, moving on only from a walkable refusal. */
function walk(w, list, { use = "ask", member = "ann", at = AT } = {}) {
  let last = null;
  for (const { owner, account_id } of list) {
    const r = w.u.useCheck({ owner, member, use, at, account_id });
    if (r === null) return { served: account_id, last };
    last = r;
    if (r.walkable !== true) return { refused: r };
  }
  return { refused: last };
}

test("R20 a walk moves from an account at its own limit to the next account, judged on that account's own limits, never the first's; it does not move from a switched-off use (control: with no list, the act is refused as before)", async () => {
  const w = await standard();
  const list = [{ owner: "member:ann", account_id: w.acct.ann }, { owner: "group", account_id: w.acct.group }];
  w.u.aiLimitSet({ owner: "member:ann", scope: "overall", unit: "calls", period: "day", amount: 1, by: "ann" });
  w.count("member:ann", "ann", "ask");
  assert.deepEqual(walk(w, list).served, w.acct.group, "on to the team's account");
  assert.equal(walk(w, list).last.source, "own");
  /* the team's own limit judges the team's account: ann's use on her own account does not count there */
  w.u.aiLimitSet({ owner: "group", scope: "overall", unit: "calls", period: "day", amount: 1, by: "admin" });
  assert.equal(walk(w, list).served, w.acct.group);
  w.count("group", "ann", "ask");
  assert.equal(walk(w, list).refused.whose, "group", "now the team's own limit refuses");
  /* a provider limit is walkable too */
  w.u.aiLimitSet({ owner: "group", scope: "overall", unit: "calls", period: "day", amount: null, by: "admin" });
  w.u.recordProviderLimit({ owner: "member:ann", account_id: w.acct.ann, entry_id: null, kind: "spend", scope: "account", resets_at: "2026-10-10T00:00:00Z", at: AT });
  w.u.aiLimitSet({ owner: "member:ann", scope: "overall", unit: "calls", period: "day", amount: null, by: "ann" });
  assert.equal(walk(w, list).served, w.acct.group);
  /* never from a switched-off use (explore no) */
  w.explore(w.acct.group, "yes", "admin");
  const ex = walk(w, list, { use: "explore" });
  assert.deepEqual([ex.refused?.code, ex.refused?.walkable], ["EXPLORE_NOT_ENABLED", false]);
  /* control: no list declared, the first account alone */
  assert.equal(walk(w, list.slice(0, 1)).refused.source, "provider");
});

/* ===== R22: the switch estimate ===== */

test("R22 estimateSwitch: a run with stated input tokens on a priced target answers the cold-cache range (input price low, cache-write price high, per million); an unpriced target answers not_known, never zero; a same-owner hop says payer_change null (control: a non-owner, non-member is refused as R12 refuses)", async () => {
  const w = await standard();
  w.count("project:P", "bob", "run", { act: "RUN-S", input: 1000 });
  w.count("project:P", "bob", "run", { act: "RUN-S", input: 200000 });
  const sw = (more) => w.u.estimateSwitch({ run: "RUN-S", from_account: w.acct.P, to_entry: ENTRIES.priced, viewer: "bob", at: AT, ...more });
  const r = sw();
  assert.deepEqual([r.estimate.low, r.estimate.high, r.estimate.unit, r.payer_change], [200000 * PRICES.input / 1e6, 200000 * PRICES.cache_write / 1e6, "usd", null],
    "the run's latest stated input tokens");
  assert.deepEqual([sw({ to_entry: ENTRIES.unpriced }).estimate, sw({ to_entry: ENTRIES.unpriced }).not_known], [null, true]);
  assert.equal(sw({ to_entry: ENTRIES.other }).not_known, true, "no cache-write price");
  assert.deepEqual(sw({ to_account: w.acct.group }).payer_change, { from_owner: "project:P", to_owner: "group" });
  assert.equal(sw({ to_account: w.acct.P }).payer_change, null);
  assert.equal(sw({ viewer: "ann" }).ok, true, "a paying account's owner");
  assert.equal(sw({ viewer: "cy" }).ok, false);
  assert.equal(sw({ viewer: "cy" }).code, w.u.aiLimits({ owner: "project:P", viewer: "cy" }).code);
  w.count("project:P", "bob", "run", { act: "RUN-U", usage: usage(null, 5, null) });
  assert.equal(w.u.estimateSwitch({ run: "RUN-U", from_account: w.acct.P, to_entry: ENTRIES.priced, viewer: "ann" }).not_known, true, "no stated input tokens");
});

/* ===== R23, R24: thresholds ===== */

test("R23 a percent threshold on a set day limit is stored, several per scope; with no limit it is AI_THRESHOLD_INVALID naming the field; a member who is not the owner is refused as R2 refuses; usd only where the plan's money allows (control: an amount threshold needs no limit)", async () => {
  const w = await standard();
  const t = (more) => w.u.aiThresholdSet({ owner: "member:ann", scope: "overall", unit: "calls", period: "day", kind: "percent", level: 50, by: "ann", at: AT, ...more });
  const none = t();
  assert.deepEqual([none.code, none.check, none.field, none.word], ["AI_THRESHOLD_INVALID", "C-143.7", "kind", "ai.refused.thresholdinvalid"]);
  w.u.aiLimitSet({ owner: "member:ann", scope: "overall", unit: "calls", period: "day", amount: 10, by: "ann" });
  assert.equal(t().change, "set");
  assert.equal(t({ level: 80 }).change, "set", "several per scope");
  assert.equal(t({ level: 0 }).field, "level");
  assert.equal(t({ level: 100 }).field, "level");
  assert.equal(t({ by: "bob" }).code, "NOT_YOUR_CEILING");
  assert.equal(w.u.aiThresholdSet({ owner: "project:P", scope: "overall", unit: "calls", period: "day", kind: "amount", level: 3, by: "bob" }).code, "PROJECT_ACT_NOT_THE_OWNER");
  assert.equal(t({ kind: "amount", level: 3, scope: "ask" }).ok, true, "an amount threshold needs no limit");
  await w.account("member:cy", "cy", PLANS.none);
  assert.equal(w.u.aiThresholdSet({ owner: "member:cy", scope: "overall", unit: "usd", period: "month", kind: "amount", level: 5, by: "cy" }).code, "LIMIT_UNIT_UNAVAILABLE");
  assert.deepEqual(w.rows(`SELECT change, level, by FROM ai_threshold_history ORDER BY seq`).map((h) => [h.change, h.level, h.by]),
    [["set", 50, "member:ann"], ["set", 80, "member:ann"], ["set", 3, "member:ann"]]);
  assert.equal(t({ level: null, was: 80 }).removed, 1);
  assert.equal(w.rows(`SELECT * FROM ai_thresholds WHERE kind='percent'`).length, 1);
});

test("R24 crossing a percent threshold produces one entry whose key is the same on every read that period; a new period produces a new key; a usd threshold says its basis (control: under the level, none)", async () => {
  const w = await standard();
  w.u.aiLimitSet({ owner: "member:ann", scope: "overall", unit: "calls", period: "day", amount: 4, by: "ann" });
  w.u.aiThresholdSet({ owner: "member:ann", scope: "overall", unit: "calls", period: "day", kind: "percent", level: 50, by: "ann" });
  w.count("member:ann", "ann", "ask");
  assert.deepEqual(w.u.thresholdsReached({ viewer: "ann", at: AT }).crossed, []);
  w.count("member:ann", "ann", "ask");
  const [one, ...more] = w.u.thresholdsReached({ viewer: "ann", at: AT }).crossed;
  assert.deepEqual(more, []);
  assert.deepEqual([one.key, one.level, one.kind, one.word], ["ai-threshold:member:ann:overall:calls:day:percent:50:2026-10-09", 50, "percent", "ai.alert.threshold"]);
  w.count("member:ann", "ann", "ask");
  assert.deepEqual(w.u.thresholdsReached({ viewer: "ann", at: AT }).crossed.map((x) => x.key), [one.key], "the same key, no second alert");
  assert.deepEqual(w.u.thresholdsReached({ viewer: "bob", at: AT }).crossed, []);
  const next = "2026-10-10T12:00:00Z";
  w.count("member:ann", "ann", "ask", { at: next, calls: 2 });
  assert.equal(w.u.thresholdsReached({ viewer: "ann", at: next }).crossed[0].key, "ai-threshold:member:ann:overall:calls:day:percent:50:2026-10-10");
  w.u.aiThresholdSet({ owner: "project:P", scope: "overall", unit: "usd", period: "month", kind: "amount", level: 0.5, by: "ann" });
  w.count("project:P", "bob", "ask", { at: next, cost: 0.4, reported: 0.6 });
  const usd = w.u.thresholdsReached({ viewer: "ann", at: next }).crossed.find((x) => x.unit === "usd");
  assert.deepEqual([usd.owner, usd.level, usd.basis], ["project:P", 0.5, "reported"], "every call stated a reported cost: judged on it");
  w.u.aiThresholdSet({ owner: "member:ann", scope: "overall", unit: "usd", period: "month", kind: "amount", level: 0.3, by: "ann" });
  w.count("member:ann", "ann", "ask", { at: next, cost: 0.4, reported: 0.6 });
  const est = w.u.thresholdsReached({ viewer: "ann", at: next }).crossed.find((x) => x.unit === "usd" && x.owner === "member:ann");
  assert.equal(est.basis, "estimated", "some calls stated no reported cost: the estimate");
});

/* ===== R25: reconciliation ===== */

test("R25 reconcile: matching figures answer within_tolerance true; a gap above RECONCILE_TOLERANCE is flagged and recorded with who and when; a null theirs is not compared (control: a non-owner is refused as R12 refuses, recording nothing)", async () => {
  const w = await standard();
  w.count("group", "bob", "ask", { input: 1000, reported: 2 });
  const rc = (figs, viewer = "admin") => w.u.reconcile({ owner: "group", period: "2026-10", provider_figures: { source: "gateway_log", ...figs }, viewer, at: AT });
  const ok = rc({ tokens: 1000, cost: 2 * (1 + RECONCILE_TOLERANCE / 2), unit: "usd" });
  assert.deepEqual([ok.tokens.within_tolerance, ok.cost.within_tolerance, ok.cost.basis, ok.change], [true, true, "reported", null]);
  assert.equal(w.rows(`SELECT * FROM ai_reconcile_gaps`).length, 0);
  const gap = rc({ tokens: 1500, cost: null });
  assert.deepEqual([gap.tokens.within_tolerance, gap.tokens.difference, gap.cost.within_tolerance, gap.cost.theirs, gap.change],
    [false, 500, null, null, "reconcile_gap"]);
  assert.deepEqual(w.rows(`SELECT figure, ours, theirs, by, at FROM ai_reconcile_gaps`), [{ figure: "tokens", ours: 1000, theirs: 1500, by: "admin", at: AT }]);
  const before = w.snapshot();
  assert.equal(rc({ tokens: 1 }, "bob").code, "NOT_AN_ADMIN");
  assert.equal(w.snapshot(), before);
});

/* ===== R26: no provider model ids ===== */

const HERE = dirname(fileURLToPath(import.meta.url));
/* the four prefixes, built so this file names none of them itself */
const MODEL_ID = new RegExp(["claude", "opus", "sonnet", "gpt"].map((x) => `${x}-`).join("|"), "i");
const scan = (dirs) => dirs.flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".mjs")).map((f) => join(d, f)))
  .filter((f) => MODEL_ID.test(readFileSync(f, "utf8")));

test("R26 a scan of the module's source and test files finds none of the four model-id prefixes R26 names, and its requirement text no model id (control: the scan catches a planted file containing one)", () => {
  assert.deepEqual(scan([join(HERE, "../../../src/ai-use"), HERE]), []);
  const req = readFileSync(join(HERE, "../../../../build/requirements/ai-use.md"), "utf8");
  /* a model id is a prefix followed by its name; R26's own list of the bare prefixes names none */
  const FULL_ID = new RegExp(["claude", "opus", "sonnet", "gpt"].map((x) => `${x}-[a-z0-9]`).join("|"), "i");
  assert.equal(FULL_ID.test(req), false, "no requirement text of this module carries a model id");
  const planted = mkdtempSync(join(tmpdir(), "ai-use-r26-"));
  try {
    writeFileSync(join(planted, "planted.mjs"), `export const model = "${["claude", "sonnet", "9"].join("-")}";`);
    assert.equal(scan([planted]).length, 1);
  } finally { rmSync(planted, { recursive: true, force: true }); }
});

/* ===== R27: use by member ===== */

test("R27 two members' uses on a team account are answered by name to an administrator, a project account's to its owner, sorted by cost then tokens (control: a non-owner is refused as R12 refuses; asked for member:<id> it is NOT_A_PAYING_ACCOUNT even for an administrator)", async () => {
  const w = await standard();
  w.count("group", "bob", "ask", { input: 50, cost: 0.1 });
  w.count("group", "ann", "ask", { input: 10, cost: 0.9 });
  w.count("group", "cy", "ask", { input: 99, cost: null, entry_id: ENTRIES.unpriced });
  w.count("project:P", "bob", "run", { input: 7, cost: 0.2 });
  w.count("member:ann", "ann", "ask", { input: 1000, cost: 5 });
  const team = w.u.accountUseByMember({ owner: "group", viewer: "admin", at: AT });
  assert.deepEqual(team.members.map((m) => [m.member, m.tokens]), [["ann", 10], ["bob", 50], ["cy", 99]]);
  assert.deepEqual([team.members[2].cost, team.members[2].not_measurable], [null, true], "never zero");
  assert.deepEqual(w.u.accountUseByMember({ owner: "project:P", viewer: "ann", at: AT }).members.map((m) => [m.member, m.tokens]), [["bob", 7]],
    "only this account's use");
  for (const [owner, viewer] of [["group", "ann"], ["project:P", "bob"], ["project:P", "cy"]])
    assert.equal(w.u.accountUseByMember({ owner, viewer, at: AT }).code, w.u.aiLimits({ owner, viewer }).code, `${owner} ${viewer}`);
  for (const viewer of ["admin", "ann"]) {
    const r = w.u.accountUseByMember({ owner: "member:ann", viewer, at: AT });
    assert.deepEqual([r.code, r.check, r.translation], ["NOT_A_PAYING_ACCOUNT", "C-143.8", AI_USE_NEW_WORDS["ai.refused.notapayingaccount"]], viewer);
  }
  assert.equal(aiUseOps(w.u, new URL("http://x/?owner=group&viewer=second"), null).aiusebymember().members.length, 3);
});

/* ===== R28, R29, R30: re-testing ===== */

test("R28 with re-testing on and under the cap a re-test is allowed; at the cap it answers cap_reached; each cap is an R2 limit (retest:<entry>, usd, month) recorded who and when (control: on false answers off for every entry; a non-owner of the paying account is refused as R12 refuses)", async () => {
  const w = await standard();
  assert.equal(w.u.retestAllowed({ owner: "group", entry_id: ENTRIES.priced, at: AT }), true, "on by default, no cap");
  assert.equal(w.u.retestSet({ owner: "group", caps: { [ENTRIES.priced]: 1 }, by: "admin", at: AT }).ok, true);
  assert.deepEqual(w.row(`SELECT scope, unit, period, amount, set_by FROM ai_limits WHERE scope LIKE 'retest:%'`),
    { scope: `retest:${ENTRIES.priced}`, unit: "usd", period: "month", amount: 100, set_by: "admin" });
  w.count("group", "admin", "run", { mode: RETEST_MODE, cost: 0.6 });
  assert.equal(w.u.retestAllowed({ owner: "group", entry_id: ENTRIES.priced, at: AT }), true);
  w.count("group", "admin", "run", { mode: "run", cost: 5 });
  assert.equal(w.u.retestAllowed({ owner: "group", entry_id: ENTRIES.priced, at: AT }), true, "only re-tests count toward the cap");
  w.count("group", "admin", "run", { mode: RETEST_MODE, cost: 0.4 });
  const cap = w.u.retestAllowed({ owner: "group", entry_id: ENTRIES.priced, at: AT });
  assert.deepEqual([cap.cap_reached, cap.code, cap.check, cap.scope, cap.unit, cap.period], [true, "AI_LIMIT_REACHED", "C-143.1", `retest:${ENTRIES.priced}`, "usd", "month"]);
  assert.doesNotMatch(cap.translation, /\{[a-z]+\}/);
  assert.equal(w.u.retestAllowed({ owner: "group", entry_id: ENTRIES.priced, at: "2026-11-02T12:00:00Z" }), true, "a new month");
  assert.equal(w.u.retestSet({ owner: "group", on: false, by: "second", at: AT }).retest.on, false);
  for (const e of Object.values(ENTRIES)) assert.deepEqual(w.u.retestAllowed({ owner: "group", entry_id: e, at: AT }), { off: true });
  const before = w.snapshot();
  assert.equal(w.u.retestSet({ owner: "group", on: true, by: "ann" }).code, "NOT_AN_ADMIN");
  assert.equal(w.snapshot(), before);
  assert.equal(aiUseOps(w.u, new URL("http://x/?by=admin"), { owner: "group", on: true, by: "ann" }).airetestset().retest.on, true);
});

test("R29 switching re-testing off makes retestingOff answer one entry for the account's administrators with who and when; off again adds none and keeps the key; on ends it (control: a non-administrator is answered none)", async () => {
  const w = await standard();
  assert.deepEqual(w.u.retestingOff({ viewer: "admin" }).off, []);
  w.u.retestSet({ owner: "group", on: false, by: "second", at: AT });
  const [e, ...more] = w.u.retestingOff({ viewer: "admin" }).off;
  assert.deepEqual(more, []);
  assert.deepEqual([e.owner, e.turned_off_by, e.turned_off_at, e.key, e.word], ["group", "member:second", AT, `retesting-off:group:${AT}`, "queue.retesting-off.summary"]);
  w.u.retestSet({ owner: "group", on: false, by: "admin", at: "2026-10-09T13:00:00Z" });
  assert.deepEqual(w.u.retestingOff({ viewer: "second" }).off.map((x) => x.key), [e.key], "the same key");
  assert.deepEqual(w.u.retestingOff({ viewer: "ann" }).off, []);
  w.u.retestSet({ owner: "group", on: true, by: "admin", at: "2026-10-09T14:00:00Z" });
  assert.deepEqual(w.u.retestingOff({ viewer: "admin" }).off, []);
});

test("R30 no function here writes a lifecycle state: a scan of the module's source finds no write to the catalogue and no lifecycle op (control: the scan catches a planted write)", () => {
  const src = readdirSync(join(HERE, "../../../src/ai-use")).map((f) => readFileSync(join(HERE, "../../../src/ai-use", f), "utf8")).join("\n");
  const writes = /lifecycleSet|setLifecycle|loadSeed|\.pull\(|INSERT INTO ai_catalogue|UPDATE ai_catalogue|lifecycle\s*=/;
  assert.equal(writes.test(src), false);
  assert.equal(writes.test(`${src}\ncat.setLifecycle("x", "lapsed");`), true);
});

/* ===== R31, R32, R33: health counts ===== */

test("R31 three turns on one fake entry, one refused and one timeout, give that day calls 3, refused 1, errors.timeout 1; it keeps no owner, account, member or content (control: a limit outcome adds to calls only; an outcome or class outside agent-model's lists is refused, counting nothing)", async () => {
  const w = await standard();
  const h = (outcome, error_class = null, more = {}) => w.u.countHealth({ entry_id: ENTRIES.priced, personal: false, outcome, error_class, at: AT, ...more });
  h("result"); h("refused"); h("error", "timeout");
  const r = w.row(`SELECT * FROM ai_health`);
  assert.deepEqual([r.day, r.calls, r.refused, r.silent, JSON.parse(r.errors)], ["2026-10-09", 3, 1, 0, { timeout: 1 }]);
  assert.deepEqual(Object.keys(r).sort(), ["calls", "day", "entry_id", "errors", "personal", "refused", "silent"]);
  h("limit");
  assert.deepEqual([w.row(`SELECT calls FROM ai_health`).calls, JSON.parse(w.row(`SELECT errors FROM ai_health`).errors)], [4, { timeout: 1 }]);
  /* R7: days older than HEALTH_KEEP_DAYS are dropped */
  h("result", null, { entry_id: ENTRIES.other, at: plus(AT, (HEALTH_KEEP_DAYS + 1) * 864e5) });
  assert.deepEqual(w.rows(`SELECT entry_id FROM ai_health`).map((r) => r.entry_id), [ENTRIES.other]);
  const before = w.snapshot();
  for (const bad of [["finished"], ["error", "kaboom"], ["error", null], ["result", null, { entry_id: null }]])
    assert.equal(h(...bad).code, "AI_RUN_CONSUME_INVALID", JSON.stringify(bad));
  assert.equal(w.snapshot(), before);
});

test("R32 a new team's switch is off; an administrator turns it on, appended with who and when (control: a member who is not an administrator is refused and the switch is unchanged)", async () => {
  const w = await standard();
  assert.deepEqual(w.u.healthShareState(), { on: false, since: null, by: null });
  assert.equal(w.u.healthShareSet({ on: true, by: "ann", at: AT }).code, "NOT_AN_ADMIN");
  assert.equal(w.u.healthShareSet({ on: true, by: "machine:agent", at: AT }).code, "NOT_AN_ADMIN");
  assert.equal(w.u.healthShareState().on, false);
  assert.deepEqual(w.u.healthShareSet({ on: true, by: "second", at: AT }), { ok: true, on: true, since: AT, by: "member:second" });
  w.u.healthShareSet({ on: false, by: "admin", at: "2026-10-10T00:00:00Z" });
  assert.equal(w.rows(`SELECT * FROM ai_health_switch`).length, 2, "each set appended");
  assert.equal(aiUseOps(w.u, new URL("http://x/?by=admin"), { on: true }).aihealthset().on, true);
});

test("R33 with the switch on, two counted days yield two reports with exactly those keys, entries under HEALTH_MIN_CALLS left out; after healthSent a day is not answered again; personal calls appear in no report or preview (control: off it answers null, and the preview still answers the report it would send)", async () => {
  const w = await standard();
  const many = (day, entry_id, n, personal = false) => { for (let i = 0; i < n; i++) w.u.countHealth({ entry_id, personal, outcome: i ? "result" : "silent", at: `${day}T10:00:00Z` }); };
  many("2026-10-07", ENTRIES.priced, HEALTH_MIN_CALLS);
  many("2026-10-08", ENTRIES.priced, HEALTH_MIN_CALLS + 2);
  many("2026-10-08", ENTRIES.other, HEALTH_MIN_CALLS - 1);
  many("2026-10-08", ENTRIES.unpriced, HEALTH_MIN_CALLS + 5, true);
  many("2026-10-09", ENTRIES.priced, HEALTH_MIN_CALLS);
  assert.equal(w.u.healthReport({ at: AT }), null, "switched off");
  const preview = w.u.healthPreview({ viewer: "admin", at: AT });
  assert.deepEqual(preview.reports.map((r) => r.day), ["2026-10-07", "2026-10-08"], "the preview answers what would leave, complete days only");
  assert.equal(w.u.healthPreview({ viewer: "ann", at: AT }).code, "NOT_AN_ADMIN");
  w.u.healthShareSet({ on: true, by: "admin", at: "2026-10-07T00:00:00Z" });
  const reps = w.u.healthReport({ at: AT });
  assert.deepEqual(reps.map((r) => r.day), ["2026-10-07", "2026-10-08"]);
  for (const r of reps) assert.deepEqual(Object.keys(r).sort(), ["day", "entries", "report_version"]);
  assert.deepEqual(reps[1].entries, [{ entry_id: ENTRIES.priced, calls: HEALTH_MIN_CALLS + 2, refused: 0, silent: 1, errors: {} }]);
  assert.equal(JSON.stringify([reps, preview]).includes(ENTRIES.unpriced), false, "a personal subscription's calls never leave");
  assert.deepEqual(w.u.healthPreview({ viewer: "admin", at: AT }).reports, reps, "the preview is exactly what is sent");
  w.u.healthSent({ day: "2026-10-07", at: AT });
  assert.deepEqual(w.u.healthReport({ at: AT }).map((r) => r.day), ["2026-10-08"]);
  assert.deepEqual(w.u.healthReport({ at: plus(AT, (HEALTH_DAYS_MAX + 3) * 864e5) }), [], `at most ${HEALTH_DAYS_MAX} days back`);
});

/* ===== R13 (T53): the words T53 adds ===== */

test("R13 (T53) every new key reads its word: ai.refused.limit.provider (filled with {when}) and .unknown, ai.refused.thresholdinvalid, ai.alert.threshold, ai.use.notmeasurable; a missing key fails, never a fallback sentence (control: source own reads the old key); no sentence names a provider", async () => {
  for (const key of ["ai.refused.limit.provider", "ai.refused.limit.provider.unknown", "ai.refused.thresholdinvalid", "ai.alert.threshold", "ai.use.notmeasurable"])
    assert.equal(typeof word(key, { whose: "x", when: "y", field: "z", level: "1", period: "p", use: "u" }), "string", key);
  assert.throws(() => word("ai.refused.limit.nonesuch"), "a key the word table lacks fails");
  for (const [k, en] of Object.entries(AI_USE_NEW_WORDS)) assert.equal(en, word(k, Object.fromEntries((en.match(/\{[a-z]+\}/g) ?? []).map((p) => [p.slice(1, -1), p]))), k);
  const w = await standard();
  w.u.recordProviderLimit({ owner: "member:ann", account_id: w.acct.ann, entry_id: null, kind: "spend", scope: "account", resets_at: "2026-10-10T08:00:00Z", at: AT });
  const r = w.u.useCheck({ owner: "member:ann", member: "ann", use: "ask", at: AT, account_id: w.acct.ann });
  assert.equal(r.translation, word("ai.refused.limit.provider", { whose: word("ai.whose.own"), when: word("ai.when.day") }));
  assert.doesNotMatch(r.translation, /\{[a-z]+\}/);
  w.u.aiLimitSet({ owner: "group", scope: "ask", unit: "calls", period: "day", amount: 1, by: "admin" });
  w.count("group", "bob", "ask");
  assert.equal(w.u.useCheck({ owner: "group", member: "bob", use: "ask", at: AT }).word, "ai.refused.limit");
  for (const en of Object.values(AI_USE_NEW_WORDS)) assert.doesNotMatch(en, /anthropic|claude/i);
});

/* ===== the provider notice membership:77 (R154) ===== */

test("notice membership:77 (membership R154: the moved names are delegates of member-roster's) ai-use's owner checks read membership's isAdministrator, isProjectOwner and notAnAdmin as member-roster answers them: a group refusal is byte for byte notAnAdmin's (control: an administrator and a project owner act)", async () => {
  const w = await standard();
  const { membersOf } = await import("../../../src/member-roster/index.mjs");
  const roster = membersOf(w.ctx);
  /* the enrolled members (the founder's claim is the world's own seam, registered on membership) */
  for (const id of ["second", "ann", "bob"]) assert.equal(w.m.isAdministrator(id), roster.isAdministrator(id), id);
  const refused = w.u.aiLimitSet({ owner: "group", scope: "ask", unit: "calls", period: "day", amount: 1, by: "ann", at: AT });
  const { notAnAdmin } = await import("../../../src/membership/index.mjs");
  const direct = notAnAdmin("ann", "set the team account's limits and use");
  assert.deepEqual([refused.code, refused.check, refused.translation], [direct.code, direct.check, direct.translation]);
  assert.equal(w.u.aiLimitSet({ owner: "group", scope: "ask", unit: "calls", period: "day", amount: 1, by: "second", at: AT }).ok, true);
  assert.equal(w.m.isProjectOwner("P", "ann"), true);
  assert.equal(w.u.aiLimitSet({ owner: "project:P", scope: "ask", unit: "calls", period: "day", amount: 1, by: "ann", at: AT }).ok, true);
});
