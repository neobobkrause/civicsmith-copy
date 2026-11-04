/* ai-use T44 (T44-7): R8's C-143.5 and C-143.6 rows, R13's exploring refusals read by key and every fill over all nine
   uses (N859, N869, N876; DEC-191 (1), (2), DEC-192 (4)), and N871's deletion of the fills notice-producers no longer
   imports, at the interface, each with a negative control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { standard, WORDS } from "./fixture.mjs";
import * as aiUse from "../../../src/ai-use/index.mjs";
import * as aiUseChecks from "../../../src/ai-use/checks.mjs";
import { USE_KINDS } from "../../../src/ai-accounts/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const { AI_USE_CHECKS, AI_USE_WORDS, AI_USE_NEW_WORDS, fillWords } = aiUse;
const AT = "2026-10-09T12:00:00Z";
const PLACEHOLDER = /\{[A-Za-z_]+\}/;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november",
  "december"];
const differences = (held, file) => Object.entries(held).filter(([k, en]) => typeof file[k] !== "string" || file[k] !== en)
  .map(([k]) => k);
/* (T53) exploring is read from the owner's account by its id */
const acctOf = (w, owner) => (owner === "group" ? w.acct.group : owner === "project:P" ? w.acct.P : w.acct.ann);
const explore = (w, owner, on, by) => w.explore(acctOf(w, owner), on, by);

/* ===== R13: AI_USE_WORDS equals words.json, the T44 keys included ===== */

test("R13 (T44) AI_USE_WORDS equals words.json for every key it reads: the exploring refusals, all nine uses' .name and .inline, ai.when.month as \"on {month} 1\"; a changed or missing key fails (negative control)", () => {
  assert.deepEqual(differences(AI_USE_WORDS, WORDS), []);
  const t44 = ["ai.refused.exploreoutofscope", "ai.refused.exploreaskinvalid", "ai.when.month",
    ...USE_KINDS.flatMap((u) => [`ai.use.${u}.name`, `ai.use.${u}.inline`])];
  assert.equal(USE_KINDS.length, 9);
  for (const k of t44) {
    assert.equal(typeof WORDS[k], "string", `${k} in words.json`);
    assert.equal(AI_USE_WORDS[k], WORDS[k], `${k} held verbatim`);
  }
  assert.equal(AI_USE_WORDS["ai.when.month"], WORDS["ai.when.month"]);
  assert.equal(AI_USE_WORDS["ai.refused.exploreoutofscope"], WORDS["ai.refused.exploreoutofscope"]);
  assert.equal(AI_USE_WORDS["ai.use.account.name"], word("ai.use.account.name"));
  /* ai.use.suggestions names a switch, not a use: not read here */
  assert.equal(Object.keys(AI_USE_WORDS).some((k) => k.startsWith("ai.use.suggestions")), false);
  /* negative controls: one character changed on either side, or a key the file lacks, is found */
  for (const k of t44) {
    const en = AI_USE_WORDS[k];
    const changed = en + ".";
    assert.deepEqual(differences({ ...AI_USE_WORDS, [k]: changed }, WORDS), [k], k);
    assert.deepEqual(differences(AI_USE_WORDS, { ...WORDS, [k]: changed }), [k], k);
    const { [k]: _gone, ...lacking } = WORDS;
    assert.deepEqual(differences(AI_USE_WORDS, lacking), [k], `${k}: a key the file lacks fails`);
  }
  assert.deepEqual(differences({ ...AI_USE_WORDS, "ai.when.month": "on 1 {month}" }, WORDS), ["ai.when.month"], "the old order fails");
});

/* ===== R8: C-143.5 and C-143.6 ===== */

test("R8 (T44) EXPLORE_OUT_OF_SCOPE (C-143.5) and EXPLORE_ASK_INVALID (C-143.6) have their rows, each where naming its site and its translation read by key, neither keeping a sentence of its own; the other rows unchanged (control)", () => {
  const oos = AI_USE_CHECKS.EXPLORE_OUT_OF_SCOPE;
  const ask = AI_USE_CHECKS.EXPLORE_ASK_INVALID;
  assert.deepEqual([oos.check, ask.check], ["C-143.5", "C-143.6"]);
  assert.equal(oos.where, "src/ai-use/index.mjs #outOfScope > is-explore-out-of-scope");
  assert.equal(ask.where, "src/ai-use/index.mjs #askFault > is-explore-ask-invalid");
  assert.equal(oos.translation, WORDS["ai.refused.exploreoutofscope"]);
  assert.equal(ask.translation, WORDS["ai.refused.exploreaskinvalid"]);
  /* negative control: the sentence C-143.5 held before T44 is not words.json's, and is gone */
  assert.notEqual(oos.translation, "The assistant can't explore this question on this account: it lies outside what the "
    + "account's owners explore.");
  assert.deepEqual(Object.values(AI_USE_CHECKS).map((r) => r.check), ["C-143.1", "C-143.2", "C-143.3", "C-143.4", "C-143.5", "C-143.6", "C-143.7", "C-143.8"]);
  /* (T53) the two rows T53 adds read the sentences written at their use (AI_USE_NEW_WORDS, K3943) until the words file holds them */
  for (const r of Object.values(AI_USE_CHECKS))
    assert.ok([...Object.values(AI_USE_WORDS), ...Object.values(AI_USE_NEW_WORDS)].includes(r.translation), `${r.check}: a word-table sentence`);
});

test("R8 R13 (T44) EXPLORE_OUT_OF_SCOPE carries whose (group, project or own), its sentence ai.refused.exploreoutofscope with {whose} filled from ai.whose.*; an in-scope question passes (negative control)", async () => {
  const w = await standard();
  w.bundle("INQ-1", "inquiry");
  w.bundle("INQ-2", "inquiry");
  w.bundle("INFO-1", "information");
  w.cite("P", "INQ-1");
  explore(w, "group", "yes", "admin");
  explore(w, "project:P", "yes", "ann");
  explore(w, "member:ann", "yes", "ann");
  const cases = [["group", "INFO-1", "group", "INQ-2"], ["project:P", "INQ-2", "project", "INQ-1"], ["member:ann", "INQ-1", "own", null]];
  for (const [owner, outside, whose, inside] of cases) {
    const r = w.u.exploreAllowed({ owner, account_id: acctOf(w, owner), question: outside, at: AT });
    assert.deepEqual([r.ok, r.code, r.check, r.whose, r.owner, r.word], [false, "EXPLORE_OUT_OF_SCOPE", "C-143.5", whose, owner,
      "ai.refused.exploreoutofscope"], owner);
    assert.equal(r.translation, WORDS["ai.refused.exploreoutofscope"].replace("{whose}", WORDS[`ai.whose.${whose}`]), owner);
    assert.doesNotMatch(r.translation, PLACEHOLDER);
    /* negative control: a question in the owner's scope passes (a member's scope holds none yet, D36) */
    if (inside) assert.equal(w.u.exploreAllowed({ owner, account_id: acctOf(w, owner), question: inside, at: AT }).ok, true, `${owner} ${inside}`);
  }
  assert.equal(new Set(cases.map(([owner, q]) => w.u.exploreAllowed({ owner, account_id: acctOf(w, owner), question: q, at: AT }).translation)).size, 3,
    "each account's own words");
});

test("R8 R13 (T44) EXPLORE_ASK_INVALID answers ai.refused.exploreaskinvalid verbatim, for an ask naming nothing worth exploring and an approval naming no day; a well-formed ask and approval pass (negative control)", async () => {
  const w = await standard();
  explore(w, "group", "ask", "admin");
  const refusals = [w.u.exploreAsk({ owner: "group", account_id: w.acct.group, at: AT, what: "" }), w.u.exploreApprove({ owner: "group", day: "9 Oct", by: "admin" })];
  for (const r of refusals) {
    assert.deepEqual([r.code, r.check, r.word, r.translation], ["EXPLORE_ASK_INVALID", "C-143.6", "ai.refused.exploreaskinvalid",
      WORDS["ai.refused.exploreaskinvalid"]]);
  }
  assert.deepEqual(refusals.map((r) => r.field), ["what", "day"]);
  assert.equal(w.u.exploreAsk({ owner: "group", account_id: w.acct.group, at: AT, what: "INQ-1" }).ok, true);
  assert.equal(w.u.exploreApprove({ owner: "group", day: "2026-10-09", by: "admin", at: AT }).ok, true);
});

/* ===== R13: all nine uses ===== */

test("R13 (T44) {use} reads ai.use.<use>.inline for all nine uses (enquire, read and account among them): a limit on any use reads ai.refused.limit with its own words; overall and per_member keep their own keys (negative control)", async () => {
  const w = await standard();
  for (const use of USE_KINDS) {
    if (use === "explore") explore(w, "member:ann", "yes", "ann");
    w.u.aiLimitSet({ owner: "member:ann", scope: use, unit: "calls", period: "day", amount: 1, by: "ann" });
    w.count("member:ann", "ann", use);
    const r = w.u.useCheck({ owner: "member:ann", member: "ann", use, at: AT, account_id: w.acct.ann });
    assert.deepEqual([r.code, r.scope, r.word], ["AI_LIMIT_REACHED", use, "ai.refused.limit"], use);
    assert.equal(r.translation, WORDS["ai.refused.limit"].replace("{whose}", WORDS["ai.whose.own"])
      .replace("{period}", WORDS["ai.period.day"]).replace("{use}", WORDS[`ai.use.${use}.inline`])
      .replace("{when}", WORDS["ai.when.day"]), use);
    w.u.aiLimitSet({ owner: "member:ann", scope: use, unit: "calls", period: "day", amount: null, by: "ann" });
  }
  /* negative control: the overall and per-member limits read their own sentences, naming no use */
  w.u.aiLimitSet({ owner: "member:ann", scope: "overall", unit: "calls", period: "day", amount: 1, by: "ann" });
  assert.equal(w.u.useCheck({ owner: "member:ann", member: "ann", use: "account", at: AT }).word, "ai.refused.limit.overall");
  w.u.aiLimitSet({ owner: "group", scope: "per_member", unit: "calls", period: "day", amount: 1, by: "admin" });
  w.count("group", "bob", "read");
  assert.equal(w.u.useCheck({ owner: "group", member: "bob", use: "read", at: AT }).word, "ai.refused.limit.member");
});

test("R13 (T44) {Use} at a sentence's start reads ai.use.<use>.name and {use} inside it .inline, for all nine uses; a placeholder not given is left for the screen (negative control)", () => {
  for (const use of USE_KINDS) {
    const filled = fillWords("{Use}: {use}.", { Use: AI_USE_WORDS[aiUse.useNameWord(use)], use: AI_USE_WORDS[aiUse.useInlineWord(use)] });
    assert.equal(filled, `${WORDS[`ai.use.${use}.name`]}: ${WORDS[`ai.use.${use}.inline`]}.`, use);
  }
  assert.equal(fillWords("{whose} {Use}", { whose: "x" }), "x {Use}");
});

test("R13 (T44) a month's {when} is ai.when.month (\"on {month} 1\") with the next month from date.month.*, for every month; a day's limit reads ai.when.day (negative control)", async () => {
  const w = await standard();
  w.u.aiLimitSet({ owner: "member:ann", scope: "enquire", unit: "calls", period: "month", amount: 1, by: "ann" });
  for (let m = 1; m <= 12; m++) {
    const at = `2027-${String(m).padStart(2, "0")}-15T12:00:00Z`;
    w.count("member:ann", "ann", "enquire", { at });
    const r = w.u.useCheck({ owner: "member:ann", member: "ann", use: "enquire", at });
    const when = WORDS["ai.when.month"].replace("{month}", WORDS[`date.month.${MONTHS[m % 12]}`]);
    assert.ok(r.translation.includes(` It works again ${when}. `), `${at}: ${r.translation}`);
    assert.ok(when.endsWith(" 1"), when);
  }
  w.u.aiLimitSet({ owner: "member:ann", scope: "enquire", unit: "calls", period: "month", amount: null, by: "ann" });
  w.u.aiLimitSet({ owner: "member:ann", scope: "enquire", unit: "calls", period: "day", amount: 1, by: "ann" });
  assert.ok(w.u.useCheck({ owner: "member:ann", member: "ann", use: "enquire", at: "2027-12-15T13:00:00Z" }).translation
    .includes(` It works again ${WORDS["ai.when.day"]}. `));
});

/* ===== R9, R13: a member's own words fill as written ===== */

test("R9 R13 (T44) the Ask item's {what} is the owner's words exactly as written, a $ in them never read as a replacement pattern; plain words fill the same (negative control)", async () => {
  const w = await standard();
  explore(w, "group", "ask", "admin");
  const what = "Who paid $& and $' and $1 to the $$ council?";
  w.u.exploreAsk({ owner: "group", account_id: w.acct.group, at: AT, what });
  const [item] = w.u.exploreAsksPending({ viewer: "admin", at: AT }).asks;
  assert.equal(item.text, WORDS["ai.queue.exploreask"].split("{what}").join(what));
  assert.ok(item.text.includes(what));
  explore(w, "project:P", "ask", "ann");
  w.u.exploreAsk({ owner: "project:P", account_id: w.acct.P, at: AT, what: "Who signed?" });
  assert.ok(w.u.exploreAsksPending({ viewer: "ann", at: AT }).asks[0].text.includes(": Who signed?. "));
});

/* ===== N871: the fills notice-producers no longer imports ===== */

test("R13 (T44; N871) LIMIT_PERIOD_FILL, LIMIT_WHEN_FILL and MONTH_NAMES are gone from checks.mjs and index.mjs; the keys they copied are still provided (negative control)", () => {
  for (const name of ["LIMIT_PERIOD_FILL", "LIMIT_WHEN_FILL", "MONTH_NAMES"]) {
    assert.equal(name in aiUseChecks, false, `checks.mjs ${name}`);
    assert.equal(name in aiUse, false, `index.mjs ${name}`);
  }
  for (const name of ["PERIOD_WORD", "WHEN_WORD", "MONTH_WORD"]) assert.ok(name in aiUse, name);
});
