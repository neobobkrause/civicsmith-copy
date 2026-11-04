/* R16, R17 (DEC-188 (6), (7); DEC-189 (2), (5)–(7); N856; K2704; T44: DEC-191 (2), (3), DEC-192 (3), (5); N869, N876; T49 R23, N1133, K3366): every sentence and fill this module says is read by key
   through setup-words (`word`, `hasWord`); no copy of a sentence is held here, and tests assert keys, never a sentence's text. A key the word list lacks fails, never a
   fallback sentence. The keys DEC-189's owed line names for this module are each held, and the retired `act.owed_exploreapprove.label.queue` is not. Each with its
   negative control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { WORDS } from "../ai-use/fixture.mjs";
import * as wordsModule from "../../../src/notice-producers/words.mjs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";
import { wordsOf, hasWords, monthName, dayInSentence, untilWords } from "../../../src/notice-producers/words.mjs";
import { EXPLORE_APPROVE } from "../../../src/notice-producers/index.mjs";

const KINDS = ["question-find", "step-later-found", "step-date-due", "step-reminder", "step-cost-shared", "step-cost-message",
  "milestone-overdue", "milestone-reminder", "project-quiet", "review-comment-left-out"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
/* DEC-189's owed line, (5)–(7), for notice-producers (draft-T43-words §N856 (c)); the nine uses and `ai.use.suggestions` (DEC-191
   (2)); DEC-191 (3)'s and DEC-192 (3), (5)'s keys (T44): the date formats and `{when}` after "until" */
const OWED = ["ai.queue.limitreached", "ai.queue.limitreached.overall", "ai.queue.limitreached.member", "ai.queue.exploreask",
  ...["group", "project", "own"].flatMap((k) => [`ai.account.${k}`, `ai.account.${k}.inline`]),
  ...["ask", "draft", "run", "standing", "transcribe", "explore", "enquire", "read", "account", "suggestions"].map((u) => `ai.use.${u}.inline`),
  "ai.scope.group", "ai.scope.own", "ai.period.day", "ai.period.month", "ai.until.day", "ai.until.month", "date.daymonth", "date.daymonthyear",
  ...MONTHS.map((m) => `date.month.${m}`), "ai.label.explored", "ai.label.explored.member",
  ...KINDS.flatMap((k) => [`queue.${k}.summary`, `queue.${k}.detail`])];

test("R16 R17 R23 every key this module reads is held by setup-words and in words.json; no sentence table is kept here; a key the list lacks fails", () => {
  for (const key of OWED) {
    assert.equal(typeof WORDS[key], "string", `${key} is in words.json`);
    assert.equal(hasWord(key), true, `${key} is held by setup-words`);
  }
  assert.equal(KINDS.length, 10, "R17's ten kinds");
  /* R23: the hand-copied table is retired; nothing this module exports carries a sentence */
  assert.equal("NOTICE_WORDS" in wordsModule, false, "no copied sentence table");
  /* negative control: a key the list lacks is no word here, and asking for it fails rather than answering a sentence */
  assert.equal(hasWord("ai.queue.nosuchword"), false);
  assert.equal(hasWords("ai.queue.nosuchword"), false);
  assert.throws(() => wordsOf("ai.queue.nosuchword", {}), /no words for ai\.queue\.nosuchword/);
  assert.equal(wordsOf("ai.queue.exploreask", { scope: "S", what: "Q?", account: "A" }), word("ai.queue.exploreask", { scope: "S", what: "Q?", account: "A" }));
});

test("R16 the Ask's act reads act.exploreapprove.label.queue; the retired act.owed_exploreapprove.label.queue and the pre-DEC-189 fills ({for_use}, {Uses}) are gone", () => {
  assert.equal(EXPLORE_APPROVE.label, word("act.exploreapprove.label.queue"));
  assert.equal(WORDS["act.owed_exploreapprove.label.queue"], undefined, "retired in words.json");
  assert.equal(hasWord("act.owed_exploreapprove.label.queue"), false, "and not held");
  for (const key of OWED) assert.doesNotMatch(WORDS[key] ?? "", /\{(for_use|Uses)\}/, key);
});

test("R16 R17 (T44) {date}: date.daymonth in the current year, date.daymonthyear in any other, the day with no leading zero and the month from date.month.*; {when} after \"until\" from ai.until.*, never the refusals' ai.when.*; nothing for no day", () => {
  const october = word("date.month.october");
  assert.equal(dayInSentence("2026-10-09", "2026-10-11"), word("date.daymonth", { day: "9", month: october }));
  assert.equal(dayInSentence("2026-01-31", "2026-12-31"), word("date.daymonth", { day: "31", month: word("date.month.january") }), "the same year, however far");
  assert.equal(dayInSentence("2025-12-31", "2026-01-01"), word("date.daymonthyear", { day: "31", month: word("date.month.december"), year: "2025" }));
  assert.equal(dayInSentence("2027-03-03", "2026-10-11"), word("date.daymonthyear", { day: "3", month: word("date.month.march"), year: "2027" }), "a day in a later year names it too");
  assert.equal(dayInSentence("2026-03-03", null), word("date.daymonthyear", { day: "3", month: word("date.month.march"), year: "2026" }), "with no current day read, the year is named");
  for (let m = 1; m <= 12; m++) assert.equal(monthName(m), word(`date.month.${MONTHS[m - 1]}`));
  for (const bad of [null, "", "2026-13-01", "9 October", "2026-10-09T12:00:00Z"]) assert.equal(dayInSentence(bad, "2026-10-11"), null, String(bad));
  assert.equal(monthName(0), null);
  assert.equal(untilWords("day"), word("ai.until.day"));
  assert.equal(untilWords("month", 11), word("ai.until.month", { month: word("date.month.november") }));
  for (const [p, m] of [["week", 11], ["month", 0], ["month", 13], [null, 1]]) assert.equal(untilWords(p, m), null, `${p} ${m}`);
  /* negative control: the refusals' words are ai-use's; this module holds neither, so no sentence here can say them */
  for (const k of ["ai.when.day", "ai.when.month"]) assert.equal(typeof WORDS[k], "string", `${k} is in words.json`);
  assert.notEqual(untilWords("month", 11), word("ai.when.month", { month: word("date.month.november") }), "not the refusals' words");
});

/* R20 (T47; N889; DEC-198 (3)): R5's, R6's, R13's, R14's and R15's sentences, each by key */
const R20_KEYS = [...["overdue", "undetermined"].flatMap((st) => [`queue.temporal-expectation-due.${st}.summary`, `queue.temporal-expectation-due.${st}.detail`]),
  ...["inquiry-recheck-due", "policy-changed-noticed", "scan-found", "security-tool-off"].flatMap((k) => [`queue.${k}.summary`, `queue.${k}.detail`])];

test("R20 every key R20 names is in words.json and held by setup-words, with the placeholders R20 fills; R12's item has no key (its plain sentence); a key the list lacks fails", () => {
  assert.equal(R20_KEYS.length, 12);
  for (const key of R20_KEYS) {
    assert.equal(typeof WORDS[key], "string", `${key} is in words.json`);
    assert.equal(hasWord(key), true, `${key} is held`);
  }
  const holes = (key) => [...WORDS[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  assert.deepEqual(holes("queue.temporal-expectation-due.overdue.detail"), ["basis", "date", "office", "what"]);
  assert.deepEqual(holes("queue.temporal-expectation-due.undetermined.detail"), ["basis", "from", "office", "reason", "to", "what"]);
  assert.deepEqual(holes("queue.inquiry-recheck-due.detail"), ["date", "question", "what", "who"]);
  assert.deepEqual(holes("queue.policy-changed-noticed.detail"), ["date"]);
  assert.deepEqual(holes("queue.scan-found.detail"), ["date", "engine", "meanings", "names"]);
  assert.deepEqual(holes("queue.security-tool-off.detail"), ["tool"]);
  /* negative control: R12 has no key in the file, and none is held here */
  for (const k of Object.keys(WORDS)) assert.doesNotMatch(k, /^queue\.security-level-high\./, k);
  assert.equal(hasWord("queue.security-level-high.summary"), false);
  assert.throws(() => wordsOf("queue.temporal-expectation-due.pending.summary", {}), /no words for/);
});
