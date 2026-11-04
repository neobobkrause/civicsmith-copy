/* Standing questions (R15–R21), at the interface, over the real retrieval (its saved-query runner, R70), duties and
   credentials. The scheduler's tick is driven with the test's clock; the paying account's limits (`ai-use.useCheck`,
   which the composition root hands in as `useCheck`, R30) and the standing answerer are the test's providers (J1 (5)). The copy
   is in the test profile's zone, so "today" is a local day. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { answersWorld, answer, V, PLANS } from "./fixture.mjs";
import { ANSWERS_CHECKS, STANDING_LABEL, STANDING_TICK_MAX, nextDueDay } from "../../../src/answers/index.mjs";
import { KEPT_AWAY_UNREADABLE } from "../../../src/ai-accounts/index.mjs";
import { accountsServing, keptAwayGroup, noAccount, switchedOff, keptAwayUnreadable } from "../ai-accounts/fixtures.mjs";

const BOB = V("bob"), CAROL = V("carol"), ALICE = V("alice");
const set = (w, over = {}) => w.a.standingQuestionSet({ author: BOB, question: "Anything new on the budget?", query: "title:budget",
                                                       cadence: "daily", ends: "2026-12-31", ...over });
const code = (r) => r.code ?? r.reason;
const day = (w, d) => w.at(`${d}T15:00:00.000Z`);

test("R15 a member's standing question by their own act: the question, the saved query, a cadence and an end date; each refusal writes nothing", () => {
  const w = answersWorld();
  const before = w.snapshot();
  assert.equal(code(set(w, { author: "class:ai" })), "MACHINE_CANNOT_AUTHOR");
  assert.equal(code(set(w, { author: null })), "MACHINE_CANNOT_AUTHOR");
  assert.equal(code(set(w, { query: "" })), "SAVED_QUERY_EMPTY");
  assert.equal(code(set(w, { query: "nosuchfield:x budget" })), "SAVED_QUERY_DROPS");
  assert.equal(code(set(w, { query: { q: "budget", ids: ["INFO-2026-0001-x"] } })), "SAVED_QUERY_SELECTION");
  assert.equal(code(set(w, { cadence: "hourly" })), "BAD_CADENCE");
  for (const ends of [undefined, "next year", "2026-02-31", "2026-10-05", "2026-01-01"])
    assert.equal(code(set(w, { ends })), "STANDING_NEEDS_END", String(ends));   /* today is 2026-10-05, local */
  assert.equal(set(w, { ends: "2026-10-05" }).translation, ANSWERS_CHECKS.STANDING_NEEDS_END.translation);
  assert.deepEqual(w.snapshot(), before, "a refusal writes nothing");
  const r = set(w, { ends: "2026-10-06" });
  assert.equal(r.ok, true);
  assert.match(r.id, /^STQ-2026-\d{4}$/);
  assert.deepEqual(r.query, { v: 1, q: "title:budget", implicitOp: "and", sort: null, dir: null });
  assert.equal(r.question, "Anything new on the budget?");
});

test("R16 a standing question, its runs and finds are its author's alone; any other viewer, an administrator included, is answered as for none; the author ends it; past its end it ends itself and runs no more", async () => {
  const w = answersWorld();
  const q = set(w);
  const absent = w.a.standingQuestionRead({ id: "STQ-2026-0999", viewer: CAROL });
  for (const viewer of [CAROL, ALICE, "admin", "class:ai", null]) {
    assert.deepEqual(w.a.standingQuestionRead({ id: q.id, viewer }), { ...absent, id: q.id }, String(viewer));
    assert.deepEqual(w.a.standingQuestionsOf({ viewer }).questions, []);
    assert.equal(code(w.a.standingQuestionEnd({ id: q.id, author: viewer })), "NO_SUCH_STANDING_QUESTION");
  }
  assert.equal(w.a.standingQuestionRead({ id: q.id, viewer: BOB }).question.id, q.id);
  assert.equal(w.a.standingQuestionsOf({ viewer: BOB }).questions.length, 1);
  const e = w.a.standingQuestionEnd({ id: q.id, author: BOB });
  assert.equal(e.ok, true);
  assert.equal(w.a.standingQuestionEnd({ id: q.id, author: BOB }).already, true);
  assert.equal(w.a.standingDue(w.clock.now), 0);
  assert.deepEqual((await w.a.standingTick(w.clock.now)).ran, [], "an ended question runs no more");
  /* past its end date it ends itself */
  const short = set(w, { ends: "2026-10-07" });
  day(w, "2026-10-09");
  assert.equal(w.a.standingQuestionRead({ id: short.id, viewer: BOB }).question.ended.by, "ends");
  assert.deepEqual((await w.a.standingTick(w.clock.now)).ran, []);
});

test("R17 due at its cadence from its last run (local day); the tick re-runs each due question's saved query under its author's sight now, no model call, at most 50, oldest due first, and records the result's ids", async () => {
  const w = answersWorld();
  w.document("budget minutes", { title: "Budget minutes" });
  const proj = w.project("Carol's budget work", "carol");
  w.document("carol's budget", { title: "Budget draft", project: proj });
  const q = set(w);
  assert.equal(w.a.standingDue(w.clock.now), 1, "a new question is due at once");
  assert.equal(w.a.standingWake(w.clock.now), w.clock.now);
  const t = await w.a.standingTick(w.clock.now);
  assert.deepEqual(t.ran.map((x) => x.id), [q.id]);
  const row = w.rows(`SELECT * FROM standing_questions WHERE stq_id=?`, q.id)[0];
  assert.equal(JSON.parse(row.last_ids_json).length, 1, "under bob's sight: carol's project document is not his");
  assert.equal(row.next_due, "2026-10-06");
  assert.equal(w.a.standingDue(w.clock.now), 0);
  /* the wake is the first instant of the next local day in the profile's zone */
  assert.equal(w.a.standingWake(w.clock.now), "2026-10-06T03:00:00Z");
  assert.equal(nextDueDay("2026-10-05", "weekly"), "2026-10-12");
  assert.equal(nextDueDay("2026-01-31", "monthly"), "2026-02-28");
  assert.equal(nextDueDay("2026-12-15", "monthly"), "2027-01-15");
  /* at most 50 a tick, oldest due first */
  for (let i = 0; i < STANDING_TICK_MAX + 2; i++) set(w, { question: `q${i}` });
  day(w, "2026-10-08");
  const big = await w.a.standingTick(w.clock.now);
  assert.equal(big.ran.length, STANDING_TICK_MAX); assert.equal(big.remaining, 3);
  assert.equal(big.ran[0].id, q.id, "the question due since 10-06 runs before those due since 10-08");
  assert.equal(w.limit.asked.length, 0, "no model call: nothing was found new, no limit asked");
});

test("R18 a run finds something new when its result holds an id the previous run's did not, or an occurrence it reads changed state; a first run finds nothing; a run with nothing new records only that it ran", async () => {
  const w = answersWorld();
  w.document("budget one", { title: "Budget one" });
  const q = set(w);
  const first = await w.a.standingTick(w.clock.now);
  assert.equal(first.ran[0].new_found, false, "a first run finds nothing new");
  day(w, "2026-10-06");
  assert.equal((await w.a.standingTick(w.clock.now)).ran[0].new_found, false);
  const runs = w.rows(`SELECT * FROM standing_runs WHERE stq_id=? ORDER BY seq`, q.id);
  assert.equal(runs.length, 2);
  for (const r of runs) assert.deepEqual([r.new_found, r.finds_json, r.answer_json, r.held_back_json], [0, null, null, null], "only that it ran");
  const two = w.document("budget two", { title: "Budget two" });
  day(w, "2026-10-07");
  const third = await w.a.standingTick(w.clock.now);
  assert.equal(third.ran[0].new_found, true);
  const found = w.rows(`SELECT * FROM standing_runs WHERE stq_id=? AND new_found=1`, q.id);
  assert.deepEqual(JSON.parse(found[0].finds_json), { ids: [two.bundleId], occurrences: [] });
  /* an occurrence the run reads (a duty its result names) changing state is a new find */
  const u = answersWorld();
  const office = u.entity("The Clerk", "office");
  const duty = u.duty({ obligor: office });   /* triggered 2026-01-05, due 2026-01-10 */
  day(u, "2026-01-06");
  u.a.deps.retrieval = { runSaved: (a) => { const r = u.retrieval.runSaved(a); return r.ok ? { ...r, ids: [...r.ids, duty.dutyId] } : r; } };
  const v = u.a.standingQuestionSet({ author: V("alice"), question: "Is the clerk late?", query: "title:minutes", cadence: "daily", ends: "2026-12-31" });
  u.a.resolved.delete("retrieval");
  assert.equal((await u.a.standingTick(u.clock.now)).ran[0].new_found, false);
  day(u, "2026-01-07");
  assert.equal((await u.a.standingTick(u.clock.now)).ran[0].new_found, false, "still pending");
  day(u, "2026-01-12");
  const late = await u.a.standingTick(u.clock.now);
  assert.equal(late.ran[0].new_found, true);
  const f = JSON.parse(u.rows(`SELECT finds_json FROM standing_runs WHERE stq_id=? AND new_found=1`, v.id)[0].finds_json);
  assert.deepEqual(f.occurrences, [{ occurrence: `${duty.dutyId}/${duty.key}`, from: "pending", to: "overdue" }]);
});

test("R19 R30 the AI half answers new finds only when the copy's switch, keep-away, an account serving the author's standing act (their own or the group's key, its standing use on) and that account's limits (ai-use.useCheck, kind standing, no project) all allow; then read-only under the grant credentials mints for the standing question, its answer passing R4; otherwise no model call and what held it back is named", async () => {
  const w = answersWorld();
  const calls = [];
  const q = set(w);
  await w.a.standingTick(w.clock.now);
  let n = 0;
  const step = async (who = BOB) => {
    w.document(`budget ${++n}`, { title: `Budget ${n}` });
    w.at(new Date(Date.parse("2026-10-07T15:00:00.000Z") + (n - 1) * 86400000).toISOString());
    const t = await w.a.standingTick(w.clock.now);
    const mine = t.ran.find((x) => x.id === (who === BOB ? q.id : w.carolQ));
    assert.equal(mine.new_found, true);
    return mine.held_back;
  };
  const grants = () => w.rows(`SELECT * FROM ai_grants`).length;
  assert.deepEqual(await step(), { condition: "switch_off", switch: "copy" }, "off until the 150-question bar is met");
  assert.equal(w.a.standingAiSwitch({ on: true, by: BOB }).reason, "NOT_AN_ADMIN");
  assert.equal(w.a.standingAiSwitch({ on: true, by: ALICE }).ok, true);
  assert.deepEqual(await step(), { condition: "not_deployed" });
  /* the answerer: it reads under the run's own grant, read-only, and its answer passes R4 */
  assert.equal(w.a.registerStandingAnswerer("agent-worker", async (x) => {
    calls.push({ ...x, held: await w.credentials.aiGrantHeld({ token: x.grant }) });
    const read = w.a.logRead({ grant: x.grant, viewer: x.author, op: "search", args: { q: "budget" },
                               answer: { ok: true, hits: x.finds.ids.map((id) => ({ bundle_id: id, title: "Budget" })) } });
    return answer({ holdings: [{ address: read.hits[0].bundle_id, quote: "Budget" }, { address: "INFO-2026-0999-x", quote: "made up" }],
                    sentences: [{ text: "A new budget document is held.", kind: "quote", support: ["h1"] },
                                { text: "It was adopted.", kind: "quote", support: ["h2"] }] });
  }).ok, true);
  assert.equal(w.a.registerStandingAnswerer("other", async () => ({})).reason, "LISTENER_DECLARED");
  assert.deepEqual(await step(), { condition: "no_account" }, "no reference of bob's own and no group key");
  const own = await w.ownAccount("bob", { secret: "sk-test" });
  /* his account's standing use is off (ai-accounts R14's default): the account chosen is the one used (its R11) */
  assert.deepEqual(await step(), { condition: "switch_off", switch: "member" });
  assert.equal(w.uses(own, "standing", true, BOB).ok, true);
  /* R30: the paying account's limits, ai-use.useCheck, in place of the ceiling */
  const reached = w.reach("member:bob", "standing");
  assert.deepEqual(await step(), { condition: "limit", code: "AI_LIMIT_REACHED", translation: reached.translation });
  const asked = w.limit.asked.at(-1);
  assert.deepEqual([asked.owner, asked.member, asked.use, asked.at], ["member:bob", "bob", "standing", w.clock.now]);
  /* a limit that cannot be judged holds it back (fail closed): the negative control of the check itself */
  w.unreach("member:bob", "standing");
  w.a.deps.useCheck = () => { throw new Error("the counter is down"); };
  assert.deepEqual(await step(), { condition: "limit", code: null, translation: null });
  w.a.deps.useCheck = (a) => w.useCheck(a);
  assert.equal(calls.length, 0, "no model call while any condition holds it back");
  assert.equal(grants(), 0, "no grant is minted while any condition holds it back");
  assert.equal(await step(), null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].author, BOB); assert.equal(calls[0].mode, "ask"); assert.equal(calls[0].id, q.id);
  /* the grant is credentials' standing grant (its R32), minted for the author: live, its viewer the author */
  assert.equal(calls[0].held.ok, true, JSON.stringify(calls[0].held));
  assert.equal(calls[0].held.member, "bob");
  assert.equal(grants(), 1);
  const last = w.a.standingAnswersFor({ member: BOB }).entries.at(-1);
  assert.equal(last.answer.sentences[0].text, "A new budget document is held.");
  assert.equal(last.answer.sentences[1], null);
  assert.deepEqual(last.withheld.filter((x) => x.sentence).map((x) => x.code), ["ANSWER_CITES_UNREAD"]);
  assert.ok(w.rows(`SELECT * FROM answers_tallies WHERE mode='standing'`).length > 0, "counted within the tallies (R13)");
  /* the team's account serves a member with no account of their own, while it is held and on (K1755; ai-accounts R5,
     R11 (T53)) */
  w.carolQ = set(w, { author: CAROL }).id;
  await w.a.standingTick(w.clock.now);
  const team = await w.accounts.accountSet({ owner: "group", provider: PLANS.provider, plan: PLANS.teamApi, means: "sealed",
                                             secret: "sk-group", by: ALICE });
  assert.equal(team.ok, true, JSON.stringify(team));
  assert.deepEqual(await step(CAROL), { condition: "no_account" }, "held but off: no usable account");
  assert.equal(w.accounts.accountSwitch({ account_id: team.account_id, on: true, by: ALICE }).ok, true);
  assert.deepEqual(await step(CAROL), { condition: "switch_off", switch: "group" }, "the team account's own standing use");
  assert.equal(w.uses(team.account_id, "standing", true, ALICE).ok, true);
  /* (T53) the notice owed before an account pays is per provider and host (ai-accounts R51), in place of the group key's */
  const due = await step(CAROL);
  assert.equal(due.condition, "no_account"); assert.equal(due.code, "RECIPIENT_NOTICE_DUE"); assert.ok(due.translation);
  w.seen("carol");
  assert.equal(await step(CAROL), null);
  assert.equal(calls.at(-1).author, CAROL); assert.equal(calls.at(-1).held.member, "carol");
  assert.deepEqual([w.limit.asked.at(-1).owner, w.limit.asked.at(-1).member], ["group", "carol"], "the group's limits judge the group key");
});

test("R30 a standing question's AI half asks accountFor with kind standing and no project, and keep-away for the standing use", async () => {
  const w = answersWorld();
  const seen = [];
  const real = w.accounts;
  w.a.deps.accounts = new Proxy(real, { get: (t, k) => { const v = t[k]; return typeof v === "function"
    ? (...a) => { seen.push([String(k), a[0]]); return v.apply(t, a); } : v; } });
  w.a.resolved.delete("accounts");
  assert.equal(w.a.standingAiSwitch({ on: true, by: ALICE }).ok, true);
  w.a.registerStandingAnswerer("agent-worker", async () => answer());
  const q = set(w);
  await w.a.standingTick(w.clock.now);
  w.document("budget one", { title: "Budget one" });
  day(w, "2026-10-06");
  await w.a.standingTick(w.clock.now);
  const acct = seen.filter(([k]) => k === "accountFor").map(([, a]) => a);
  assert.equal(acct.length, 1);
  assert.deepEqual(acct[0], { member: BOB, act: { kind: "standing", member: BOB } }, "kind standing, no project (K2348)");
  assert.deepEqual(seen.filter(([k]) => k === "aiKeptAway").map(([, a]) => a), [{ use: "standing" }]);
  /* keep-away for asks only does not hold a standing question back; for standing it does */
  assert.equal((await real.aiKeepAwaySet({ on: true, uses: ["ask"], reason: "Asks are paused.", by: ALICE })).ok, true);
  w.document("budget two", { title: "Budget two" });
  day(w, "2026-10-07");
  assert.deepEqual((await w.a.standingTick(w.clock.now)).ran.find((x) => x.id === q.id).held_back, { condition: "no_account" });
  assert.equal((await real.aiKeepAwaySet({ on: true, uses: ["standing"], reason: "Standing paused.", by: ALICE })).ok, true);
  w.document("budget three", { title: "Budget three" });
  day(w, "2026-10-08");
  assert.equal((await w.a.standingTick(w.clock.now)).ran.find((x) => x.id === q.id).held_back.condition, "kept_away");
});

test("R19 keep-away (ai-accounts R7's aiKeptAway, never credentials', read after the copy's switch and before any account): kept_away with the refusal's code and translation only; no account read, no grant minted, no limit asked, no model called; the finds still told once; an unreadable setting the same; keep-away off answers as before", async () => {
  const w = answersWorld();
  const calls = [], touched = [];
  const real = w.credentials, accts = w.accounts;
  /* (T48-36) keep-away and the account are read from ai-accounts, the standing grant from credentials: each read named
     by the dep it went to */
  const watchDeps = () => { for (const n of ["accounts", "credentials"]) {
    w.a.deps[n] = new Proxy(w[n], { get: (t, k) => { const v = t[k]; return typeof v === "function" ? (...a) => { touched.push(`${n}.${String(k)}`); return v.apply(t, a); } : v; } });
    w.a.resolved.delete(n);
  } };
  watchDeps();
  const q = set(w);
  await w.a.standingTick(w.clock.now);
  let n = 0;
  const step = async () => {
    w.document(`budget ${++n}`, { title: `Budget ${n}` });
    w.at(new Date(Date.parse("2026-10-07T15:00:00.000Z") + (n - 1) * 86400000).toISOString());
    touched.length = 0;
    const mine = (await w.a.standingTick(w.clock.now)).ran.find((x) => x.id === q.id);
    assert.equal(mine.new_found, true);
    return mine.held_back;
  };
  const grants = () => w.rows(`SELECT * FROM ai_grants`).length;
  /* every other condition would let it run: the copy's switch, the answerer, bob's own reference and its standing use */
  assert.equal(w.a.standingAiSwitch({ on: true, by: ALICE }).ok, true);
  w.a.registerStandingAnswerer("agent-worker", async (x) => { calls.push(x); return answer(); });
  const own = await w.ownAccount("bob", { secret: "sk-test" });
  assert.equal(w.uses(own, "standing", true, BOB).ok, true);
  /* the copy's switch is read first: off, keep-away is not read at all */
  assert.equal((await accts.aiKeepAwaySet({ on: true, reason: "We are reviewing what the assistant may read.", by: ALICE })).ok, true);
  w.record.setSetting("answers_standing_ai", false, "admin");
  assert.deepEqual(await step(), { condition: "switch_off", switch: "copy" });
  assert.deepEqual(touched, [], "nothing of ai-accounts or credentials is read while the copy's switch is off");
  w.record.setSetting("answers_standing_ai", true, "admin");
  const refusal = accts.aiKeptAway();
  assert.equal(refusal.code, "AI_KEPT_AWAY");
  const kept = { condition: "kept_away", code: "AI_KEPT_AWAY", translation: refusal.translation };
  const held = await step();
  assert.deepEqual(held, kept, "the refusal's code and translation only: not its reason, who or when");
  assert.deepEqual(touched, ["accounts.aiKeptAway"], "no account is read and no grant asked for");
  assert.equal(grants(), 0); assert.equal(calls.length, 0); assert.equal(w.limit.asked.length, 0);
  /* the run's new finds reach the author once, as R26's do: answer null */
  const entries = w.a.standingAnswersFor({ member: BOB }).entries;
  const e = entries.at(-1);
  assert.equal(e.answer, null); assert.deepEqual(e.held_back, kept); assert.equal(e.finds.ids.length, 1);
  assert.equal(e.label, STANDING_LABEL);
  assert.deepEqual(w.a.standingAnswersFor({ member: BOB, after: e.run }).entries, [], "told once");
  /* keep-away off: the run is answered as before */
  assert.equal((await accts.aiKeepAwaySet({ on: false, by: ALICE })).ok, true);
  assert.equal(await step(), null);
  assert.equal(calls.length, 1); assert.equal(grants(), 1);
  assert.deepEqual(touched.slice(0, 3), ["accounts.aiKeptAway", "accounts.accountFor", "credentials.aiGrantMintStanding"],
                   "keep-away read before any account, both from ai-accounts; the grant credentials'");
  /* a setting that cannot be read is credentials' refusal itself (fail closed, K2093): the same condition */
  w.host.storage.sql.exec(`ALTER TABLE ai_keep_away RENAME TO ai_keep_away_gone`);
  const unread = accts.aiKeptAway();
  assert.equal(unread.code, "AI_KEPT_AWAY");
  assert.deepEqual(await step(), { condition: "kept_away", code: "AI_KEPT_AWAY", translation: unread.translation });
  assert.deepEqual(touched, ["accounts.aiKeptAway"]);
  assert.equal(calls.length, 1, "no model called"); assert.equal(grants(), 1, "no grant minted");
  w.host.storage.sql.exec(`ALTER TABLE ai_keep_away_gone RENAME TO ai_keep_away`);
  assert.equal(await step(), null);
});

test("R19 keep-away is never reported as no_account, nor an account's refusal as kept_away: keep-away turned on between the read and accountFor or R32 is kept_away; accountFor's own refusals stay no_account; a use switched off is switch_off naming the account; an ai-accounts that cannot answer keep-away is kept away, fail closed, with KEPT_AWAY_UNREADABLE's row (ai-accounts R34)", async () => {
  const w = answersWorld();
  const q = set(w);
  await w.a.standingTick(w.clock.now);
  assert.equal(w.a.standingAiSwitch({ on: true, by: ALICE }).ok, true);
  const calls = [];
  w.a.registerStandingAnswerer("agent-worker", async (x) => { calls.push(x); return answer(); });
  /* ai-accounts' published fixtures: its real refusals and its real serving answer */
  const keptRow = async () => (await keptAwayGroup()).accountFor;
  const ROW = await keptRow();
  const served = async () => (await accountsServing()).accountFor({ member: "ann", act: { kind: "ask", member: "ann" } });
  const none = async () => noAccount();
  const switchedOffRow = (whose) => async () => switchedOff({ whose, use: "standing" });
  let n = 0;
  /* (T48-36) `accts` stands for ai-accounts (keep-away, the account), `creds` for credentials (the standing grant) */
  const step = async (accts, creds = w.credentials) => {
    w.a.deps.accounts = accts; w.a.resolved.delete("accounts");
    w.a.deps.credentials = creds; w.a.resolved.delete("credentials");
    w.document(`budget ${++n}`, { title: `Budget ${n}` });
    w.at(new Date(Date.parse("2026-10-07T15:00:00.000Z") + (n - 1) * 86400000).toISOString());
    return (await w.a.standingTick(w.clock.now)).ran.find((x) => x.id === q.id).held_back;
  };
  const kept = { condition: "kept_away", code: "AI_KEPT_AWAY", translation: ROW.translation };
  assert.deepEqual(await step({ aiKeptAway: () => null, accountFor: keptRow }), kept, "accountFor's AI_KEPT_AWAY");
  assert.deepEqual(await step({ aiKeptAway: () => null, accountFor: served },
                              { aiGrantMintStanding: async () => ROW }), kept, "R32's AI_KEPT_AWAY");
  assert.deepEqual(await step({ aiKeptAway: () => null, accountFor: none }),
                   { condition: "no_account" }, "keep-away off: no account is no_account");
  for (const [whose, sw] of [["own", "member"], ["group", "group"]]) {
    assert.deepEqual(await step({ aiKeptAway: () => null, accountFor: switchedOffRow(whose) }),
                     { condition: "switch_off", switch: sw }, `ai-accounts R11 for the ${whose} account`);
  }
  /* (ai-accounts R34) unreachable, throwing, or answering neither null nor a refusal with its code: kept away, carrying
     KEPT_AWAY_UNREADABLE's row as given, never a code minted here nor a blank one */
  const unread = { condition: "kept_away", code: KEPT_AWAY_UNREADABLE.code, translation: KEPT_AWAY_UNREADABLE.translation };
  assert.equal(unread.code, "AI_KEPT_AWAY"); assert.equal(typeof unread.translation, "string");
  const UNREAD = (await keptAwayUnreadable()).aiKeptAway;
  for (const accts of [null, { aiKeptAway: () => UNREAD }, { accountFor: served }, { aiKeptAway: () => { throw new Error("down"); } },
                       { aiKeptAway: () => undefined }, { aiKeptAway: () => ({ ok: false }) }, { aiKeptAway: () => "no" }])
    assert.deepEqual(await step(accts), unread, "fail closed, with the unreadable refusal's row");
  /* (T48-36) keep-away and the account are never read from credentials: a credentials holding both, its keep-away on,
     with ai-accounts saying neither, is not read for them */
  assert.deepEqual(await step({ aiKeptAway: () => null, accountFor: none },
                              { aiKeptAway: () => ROW, accountFor: keptRow }), { condition: "no_account" });
  assert.equal(calls.length, 0);
});

test("R19 the sign-in arm (N796, Bob K2425; credentials R32; ai-accounts R7, R14, R19): an author served by their own held Claude sign-in with its standing use off is held back {switch_off, member}, never no_account or kept_away, no grant, no model; with it on, the grant is minted for the sign-in and the AI half runs as for the author's reference, its limits read as for any account", async () => {
  const w = answersWorld();
  const calls = [], touched = [];
  const real = w.credentials, accts = w.accounts;
  /* (T48-36) keep-away and the account are read from ai-accounts, the standing grant from credentials: each read named
     by the dep it went to */
  const watchDeps = () => { for (const n of ["accounts", "credentials"]) {
    w.a.deps[n] = new Proxy(w[n], { get: (t, k) => { const v = t[k]; return typeof v === "function" ? (...a) => { touched.push(`${n}.${String(k)}`); return v.apply(t, a); } : v; } });
    w.a.resolved.delete(n);
  } };
  watchDeps();
  assert.equal(w.a.standingAiSwitch({ on: true, by: ALICE }).ok, true);
  w.a.registerStandingAnswerer("agent-worker", async (x) => {
    calls.push({ ...x, held: await real.aiGrantHeld({ token: x.grant }) });
    w.a.logRead({ grant: x.grant, viewer: x.author, op: "search", args: {}, answer: { ok: true, hits: [{ bundle_id: x.finds.ids[0], title: "Budget" }] } });
    return answer({ holdings: [{ address: x.finds.ids[0], quote: "Budget" }],
                    sentences: [{ text: "A new budget document is held.", kind: "quote", support: ["h1"] }] });
  });
  /* carol holds no API account of her own and the team none: her sign-in is what serves her, since T53 an account of her
     own of the personal subscription plan, means `issued` (ai-accounts R19, R40, R42, R48), and only while its token is
     held: an issued account with no token held serves nothing */
  await w.ready;
  const TOKEN = "sk-ant-oat01-sentinel-carol-0123456789";
  const sub = await accts.accountSet({ owner: "member:carol", provider: PLANS.provider, plan: PLANS.subscription, means: "issued",
                                       secret: TOKEN, by: CAROL });
  assert.equal(sub.ok, true, JSON.stringify(sub));
  assert.equal(accts.accountSwitch({ account_id: sub.account_id, on: true, by: CAROL }).ok, true);
  w.seen("carol");
  assert.equal(accts.issuedTokenRefused({ account_id: sub.account_id }).ok, true);
  const none = await accts.accountFor({ member: "carol", act: { kind: "standing", member: CAROL } });
  assert.equal(none.code, "NO_ACCOUNT", "a sign-in with no token held serves nothing");
  assert.equal((await accts.issuedTokenHold({ account_id: sub.account_id, token: TOKEN })).ok, true);
  const q = set(w, { author: CAROL });
  await w.a.standingTick(w.clock.now);
  let n = 0;
  const step = async () => {
    w.document(`budget ${++n}`, { title: `Budget ${n}` });
    w.at(new Date(Date.parse("2026-10-07T15:00:00.000Z") + (n - 1) * 86400000).toISOString());
    touched.length = 0;
    const mine = (await w.a.standingTick(w.clock.now)).ran.find((x) => x.id === q.id);
    assert.equal(mine.new_found, true);
    return mine.held_back;
  };
  const grants = () => w.rows(`SELECT * FROM ai_grants`).length;
  const held = { condition: "switch_off", switch: "member" };
  /* off, its default: held back, the account chosen being the one used (credentials R56) */
  assert.deepEqual(await step(), held);
  assert.deepEqual(touched, ["accounts.aiKeptAway", "accounts.accountFor"], "keep-away, then the account; no grant asked for");
  assert.equal(w.limit.asked.length, 0); assert.equal(calls.length, 0, "no model called"); assert.equal(grants(), 0, "no grant minted");
  /* and where the account serves (ai-accounts' published serving answer) but R32 refuses its standing switch: the same hold */
  const served = async () => (await accountsServing()).accountFor({ member: "ann", act: { kind: "ask", member: "ann" } });
  w.a.deps.accounts = { aiKeptAway: () => null, accountFor: served,
                        projectsKeptAway: () => [] };
  w.a.deps.credentials = { aiGrantMintStanding: async () => ({ ok: false, code: "STANDING_SWITCH_OFF", translation: "Off." }) };
  w.a.resolved.delete("accounts"); w.a.resolved.delete("credentials");
  assert.deepEqual(await step(), held, "R32's STANDING_SWITCH_OFF");
  assert.equal(calls.length, 0);
  watchDeps();
  const entries = w.a.standingAnswersFor({ member: CAROL }).entries;
  assert.equal(entries.length, 2);
  for (const e of entries) { assert.equal(e.answer, null); assert.equal(e.finds.ids.length, 1); assert.deepEqual(e.held_back, held); }
  assert.doesNotMatch(JSON.stringify(w.rows(`SELECT * FROM standing_runs`)), /signin|no_account|kept_away/);
  /* on, by her own act: the grant is minted for her sign-in and the model stub is called once */
  assert.equal(w.uses(sub.account_id, "standing", true, CAROL).ok, true);
  const reached = w.reach("member:carol", "standing");
  assert.deepEqual(await step(), { condition: "limit", code: "AI_LIMIT_REACHED", translation: reached.translation }, "its limits read as for any account");
  assert.equal(w.limit.asked.at(-1).owner, "member:carol");
  w.unreach("member:carol", "standing");
  assert.equal(await step(), null);
  assert.deepEqual(touched, ["accounts.aiKeptAway", "accounts.accountFor", "credentials.aiGrantMintStanding",
                             "accounts.projectsKeptAway"], "the grant alone from credentials; the answerer's read scrubbed through ai-accounts");
  assert.equal(calls.length, 1); assert.equal(grants(), 1);
  assert.equal(calls[0].held.ok, true); assert.equal(calls[0].held.member, "carol");
  const last = w.a.standingAnswersFor({ member: CAROL }).entries.at(-1);
  assert.equal(last.held_back, null); assert.equal(last.answer.sentences[0].text, "A new budget document is held.");
  /* the held token is used by no caller here: it reaches no answerer, run row, entry or tally */
  const seen = JSON.stringify([calls, w.rows(`SELECT * FROM standing_runs`), w.rows(`SELECT * FROM standing_questions`),
                               w.rows(`SELECT * FROM answers_tallies`), w.a.standingAnswersFor({ member: CAROL })]);
  assert.ok(!seen.includes(TOKEN) && !seen.includes("sentinel"), "the sign-in's token appears nowhere this module answers or keeps");
});

test("R20 standingAnswersFor answers a member's own new-find runs, once each, in run order after `after`, at most 200, with a cursor, labelled machine work from the standing question; nothing of another member's", async () => {
  const w = answersWorld();
  const q = set(w);
  await w.a.standingTick(w.clock.now);
  for (let i = 1; i <= 3; i++) {
    w.document(`budget ${i}`, { title: `Budget ${i}` });
    day(w, `2026-10-${String(6 + i).padStart(2, "0")}`);
    await w.a.standingTick(w.clock.now);
  }
  const all = w.a.standingAnswersFor({ member: BOB });
  assert.equal(all.entries.length, 3); assert.equal(all.cursor, null);
  for (const e of all.entries) {
    assert.deepEqual(Object.keys(e).sort(), ["answer", "at", "finds", "held_back", "label", "question", "run", "withheld"]);
    assert.equal(e.label, STANDING_LABEL); assert.equal(e.question.id, q.id); assert.equal(e.finds.ids.length, 1);
  }
  assert.deepEqual(all.entries.map((e) => e.run), [...all.entries.map((e) => e.run)].sort((a, b) => a - b));
  const page = w.a.standingAnswersFor({ member: BOB, limit: 2 });
  assert.equal(page.entries.length, 2); assert.equal(page.cursor, page.entries[1].run);
  const rest = w.a.standingAnswersFor({ member: BOB, after: page.cursor });
  assert.deepEqual(rest.entries.map((e) => e.run), [all.entries[2].run], "each new find told once");
  assert.equal(w.a.standingAnswersFor({ member: BOB, limit: 5000 }).entries.length, 3);
  for (const m of [CAROL, ALICE, "class:ai", null]) assert.deepEqual(w.a.standingAnswersFor({ member: m }).entries, [], String(m));
});

test("R21 a standing question reads only the asking scope's reads: no capture request, no fetch, no outside read, and no AI run but R19's", async () => {
  const w = answersWorld();
  const touched = [];
  const watch = (name, o) => new Proxy(o, { get: (t, k) => { const v = t[k]; if (typeof v === "function") return (...a) => { touched.push(`${name}.${String(k)}`); return v.apply(t, a); }; return v; } });
  for (const n of ["standards", "content", "events", "entities", "lines", "people", "duties", "calculations", "retrieval", "credentials", "accounts"])
    w.a.deps[n] = watch(n, w.a.deps[n]);
  w.a.resolved.clear();
  w.document("budget one", { title: "Budget one" });
  set(w);
  await w.a.standingTick(w.clock.now);
  w.document("budget two", { title: "Budget two" });
  day(w, "2026-10-06");
  await w.a.standingTick(w.clock.now);
  /* the saved search (ASK_SCOPE's `search`), the relations and zone it is checked and run with (retrieval R69, R72),
     which read no record; with the copy's switch off, nothing else */
  assert.deepEqual([...new Set(touched)].sort(), ["retrieval.relations", "retrieval.runSaved", "retrieval.zone"]);
  assert.equal(w.limit.asked.length, 0);
});

test("R26 a standing question runs for a member no account serves as for any member: set, run, seen and ended with no account; new finds reach them once as a list, answer null, no model called", async () => {
  const w = answersWorld();
  const calls = [];
  assert.equal(w.a.standingAiSwitch({ on: true, by: ALICE }).ok, true);
  w.a.registerStandingAnswerer("agent-worker", async (x) => { calls.push(x); return answer(); });
  const acct = await w.accounts.accountFor({ member: "carol", act: { kind: "standing", member: CAROL } });
  assert.equal(acct.code, "NO_ACCOUNT", "carol has no reference and the group holds no key");
  w.document("budget one", { title: "Budget one" });
  const q = set(w, { author: CAROL });
  const b = set(w);   /* bob's beside it, to show carol's is run as any member's */
  assert.equal(q.ok, true);
  assert.equal(w.a.standingQuestionRead({ id: q.id, viewer: CAROL }).question.id, q.id);
  assert.equal(code(w.a.standingQuestionRead({ id: q.id, viewer: BOB })), "NO_SUCH_STANDING_QUESTION");
  const first = await w.a.standingTick(w.clock.now);
  assert.deepEqual(first.ran.map((x) => x.id).sort(), [q.id, b.id].sort(), "never refused, delayed or dropped for want of an account");
  const two = w.document("budget two", { title: "Budget two" });
  day(w, "2026-10-06");
  const t = await w.a.standingTick(w.clock.now);
  const mine = t.ran.find((x) => x.id === q.id);
  assert.equal(mine.new_found, true);
  assert.deepEqual(mine.held_back, { condition: "no_account" });
  assert.equal(calls.length, 0, "read by no model");
  assert.equal(w.limit.asked.filter((x) => x.member === "carol").length, 0);
  const got = w.a.standingAnswersFor({ member: CAROL });
  assert.equal(got.entries.length, 1, "one entry for the run");
  assert.deepEqual(got.entries[0].finds, { ids: [two.bundleId], occurrences: [] });
  assert.equal(got.entries[0].answer, null);
  assert.deepEqual(got.entries[0].held_back, { condition: "no_account" });
  assert.equal(got.entries[0].label, STANDING_LABEL);
  assert.deepEqual(w.a.standingAnswersFor({ member: CAROL, after: got.entries[0].run }).entries, [], "told once");
  day(w, "2026-10-07");
  assert.equal((await w.a.standingTick(w.clock.now)).ran.find((x) => x.id === q.id).new_found, false);
  assert.equal(w.a.standingAnswersFor({ member: CAROL }).entries.length, 1);
  assert.equal(w.a.standingQuestionEnd({ id: q.id, author: CAROL }).ok, true, "ended with no account");
  assert.equal(w.rows(`SELECT * FROM ai_grants`).length, 0, "no grant minted for her");
});

test("R27 onStandingSet: one listener per module, refused through membership.listenerRefusal; told {question, due} once after a question is set (its next due day) or ended by its author (null); a throwing listener never undoes the act; the notice writes nothing", async () => {
  const w = answersWorld();
  const told = [];
  assert.equal(w.a.onStandingSet("scheduler", (x) => { told.push({ ...x, seen: w.a.standingQuestionRead({ id: x.question, viewer: BOB }).ok }); }).ok, true);
  assert.equal(w.a.onStandingSet("scheduler", () => {}).reason, "LISTENER_DECLARED");
  for (const [m, fn] of [["", () => {}], [null, () => {}], ["x", null]]) assert.equal(w.a.onStandingSet(m, fn).reason, "LISTENER_MALFORMED");
  assert.equal(w.a.onStandingSet("thrower", () => { throw new Error("down"); }).ok, true);
  /* a refused set tells no one */
  set(w, { cadence: "hourly" });
  assert.deepEqual(told, []);
  const q = set(w);
  assert.equal(q.ok, true, "a throwing listener never undoes the act");
  assert.deepEqual(told, [{ question: q.id, due: "2026-10-05", seen: true }], "once, after the transaction: its next due day is today, local");
  assert.equal(w.a.standingQuestionRead({ id: q.id, viewer: BOB }).ok, true);
  /* ending tells due null, and only the author's act tells */
  w.a.standingQuestionEnd({ id: q.id, author: CAROL });
  assert.equal(told.length, 1);
  const before = w.snapshot();
  const e = w.a.standingQuestionEnd({ id: q.id, author: BOB });
  assert.equal(e.ok, true);
  assert.deepEqual(told.slice(1).map(({ question, due }) => ({ question, due })), [{ question: q.id, due: null }]);
  const after = w.snapshot();
  assert.deepEqual(Object.keys(after).filter((t) => JSON.stringify(after[t]) !== JSON.stringify(before[t])), ["standing_questions"],
                   "the end alone writes; the notice writes nothing");
  w.a.standingQuestionEnd({ id: q.id, author: BOB });
  assert.equal(told.length, 2, "an end already made tells no one again");
});

test("R15 the saved query is checked with retrieval's relations (its R72) and zone (its R69), so a question is checked and run on one boundary (N584); a member's own search form is taken as the assistant's", async () => {
  /* the composition root's own relations name the projection alone; retrieval's name the T33 fields a run reads */
  const w = answersWorld({ deps: { relations: () => ({ projection: {} }) } });
  const r = set(w, { query: "person:harbour" });
  assert.equal(r.ok, true, JSON.stringify(r));
  const d = set(w, { query: { q: "occurred:2026-01-01..2026-02-01" } });   /* the member's own form, from the search */
  assert.equal(d.ok, true, JSON.stringify(d));
  const t = await w.a.standingTick(w.clock.now);
  assert.equal(t.ran.length, 2);
  assert.equal(w.rows(`SELECT COUNT(*) AS n FROM standing_runs WHERE held_back_json IS NOT NULL`)[0].n, 0, "each ran as saved");
  /* the day boundary is retrieval's zone: a copy whose governing zone differs from the profile's runs on that one */
  const u = answersWorld();
  const real = u.retrieval;
  u.a.deps.retrieval = { runSaved: (a) => real.runSaved(a), relations: () => real.relations(), zone: () => "Asia/Tokyo" };
  u.a.resolved.delete("retrieval");
  u.at("2026-10-05T16:00:00.000Z");   /* 5 October in the profile's zone, 6 October in Tokyo */
  assert.equal(code(u.a.standingQuestionSet({ author: BOB, question: "q", query: "title:budget", cadence: "daily", ends: "2026-10-06" })),
               "STANDING_NEEDS_END", "today is Tokyo's 6 October");
  const q = u.a.standingQuestionSet({ author: BOB, question: "q", query: "title:budget", cadence: "daily", ends: "2026-10-07" });
  await u.a.standingTick(u.clock.now);
  assert.equal(u.a.standingQuestionRead({ id: q.id, viewer: BOB }).question.next_due, "2026-10-07");
  assert.equal(u.a.standingWake(u.clock.now), "2026-10-06T15:00:00Z", "the first instant of Tokyo's 7 October");
});
