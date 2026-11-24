/* The answer contract and its checks (R3–R6, R22), at the interface: an answer is checked against the read log of the
   grant it was asked under (filled through `logRead` and `ruleAnswer`, as the plane fills it), and each sentence that
   fails a check is withheld by name. The fixtures follow the 150-question set's support kinds (assistant-substrate §7):
   a quote, a list, a figure, an absence, a rule and an explanation, each with its fabricated twin. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { answersWorld, answer, V } from "./fixture.mjs";
import { checkAnswer, ANSWER_FIELDS, ANSWERS_CHECKS, ReadLog, figuresIn } from "../../../src/answers/index.mjs";

const BOB = V("bob");
const CALC = "CALC-2026-0007";
const MNY = "MNY-2026-a1b2c3d4e5f6g7h8";

/* A read log holding a search hit, a calculation's results and a money fact, read under bob's grant. */
function logged() {
  const w = answersWorld();
  const g = "grant-bob-1";
  w.a.logRead({ grant: g, viewer: BOB, op: "search", args: { q: "budget" },
                answer: { ok: true, total: 1, hits: [{ bundle_id: "INFO-2026-0001-minutes", title: "Council minutes",
                                                      snippet: "The council approved the budget on a vote of 5 to 2." }] } });
  w.a.logRead({ grant: g, viewer: BOB, op: "calculation", args: { id: CALC },
                answer: { ok: true, calc_id: CALC, results: { share: { numerator: "41", denominator: "58", value: "0.7069" } } } });
  w.a.logRead({ grant: g, viewer: BOB, op: "money", args: { id: MNY },
                answer: { ok: true, fact_id: MNY, amount: "2097431", currency: "USD", kind: "payment" } });
  return { w, g, log: w.a.readLog(g) };
}

const codes = (r) => r.withheld.filter((x) => x.sentence).map((x) => [x.sentence, x.code]);

test("R3 an answer of any other shape is refused ANSWER_MALFORMED naming the field, and nothing is shown", () => {
  const { log } = logged();
  const ok = checkAnswer(answer(), { readLog: log, viewer: BOB });
  assert.equal(ok.ok, true);
  for (const f of ANSWER_FIELDS) {
    const a = answer(); delete a[f];
    const r = checkAnswer(a, { readLog: log, viewer: BOB });
    assert.equal(r.ok, false, f); assert.equal(r.code, "ANSWER_MALFORMED"); assert.equal(r.field, f);
    assert.equal(r.check, ANSWERS_CHECKS.ANSWER_MALFORMED.check); assert.equal(r.answer, undefined);
  }
  const cases = [
    [answer({ verdict: "guilty" }), "verdict"],
    [answer({ question_as_read: "" }), "question_as_read"],
    [answer({ clarifying: "Which year? Which body?" }), "clarifying"],
    [answer({ clarifying: "Which year?", sentences: [{ text: "x", kind: "explain", support: [] }] }), "clarifying"],
    [answer({ summary: "it was approved" }), "summary"],
    [answer({ summary: { text: "a\nb", rests_on: ["s1"] }, sentences: [{ text: "x", kind: "explain", support: [] }] }), "summary.text"],
    [answer({ summary: { text: "one line", rests_on: ["s2"] }, sentences: [{ text: "x", kind: "explain", support: [] }] }), "summary.rests_on"],
    [answer({ sentences: [{ text: "x", kind: "opinion", support: [] }] }), "sentences[0].kind"],
    [answer({ sentences: [{ text: "x", kind: "quote", support: ["h1"] }] }), "sentences[0].support"],
    [answer({ sentences: [{ text: "x", kind: "quote", support: [], grade: "A" }] }), "sentences[0].grade"],
    [answer({ holdings: [{ address: "INFO-2026-0001-minutes" }] }), "holdings[0].quote"],
    [answer({ looks: [{ level: "document", state: "LOOKED_ABSENT", score: 1 }] }), "looks[0].score"],
    [answer({ truncated: "no" }), "truncated"],
    [answer({ next_acts: [""] }), "next_acts"],
    [answer({ label: "answer" }), "label"],
    ["not an answer", "answer"],
  ];
  for (const [a, field] of cases) {
    const r = checkAnswer(a, { readLog: log, viewer: BOB });
    assert.equal(r.ok, false, field); assert.equal(r.reason, "ANSWER_MALFORMED", field); assert.equal(r.field, field);
  }
  /* an answer with a clarifying question carries no summary and no sentences, and is well formed */
  assert.equal(checkAnswer(answer({ clarifying: "Which year do you mean?" }), { readLog: log, viewer: BOB }).ok, true);
});

test("R6 a rule item names its label; a legal_information item carries its quote; one without either is ANSWER_MALFORMED", async () => {
  const { w, g } = logged();
  const id = w.standard({ from: "2020-01-01", to: null });
  const held = await w.a.ruleAnswer({ service: "standard", args: { id }, viewer: BOB, grant: g });
  assert.equal(held.label, "legal_information");
  const item = { rule_id: held.rule_id, service: "standard", value: held.value, label: "legal_information", quote: held.value.texts[0].text };
  const log = w.a.readLog(g);
  const bad = (over) => checkAnswer(answer({ rules: [{ ...item, ...over }] }), { readLog: log, viewer: BOB });
  const noLabel = { ...item }; delete noLabel.label;
  assert.deepEqual([checkAnswer(answer({ rules: [noLabel] }), { readLog: log, viewer: BOB }).field], ["rules[0].label"]);
  assert.equal(bad({ label: "legal_advice" }).field, "rules[0].label");
  const noQuote = { ...item }; delete noQuote.quote;
  assert.equal(checkAnswer(answer({ rules: [noQuote] }), { readLog: log, viewer: BOB }).field, "rules[0].quote");
  /* the well-formed item, its quote the held text, rests a rule sentence */
  const r = checkAnswer(answer({ rules: [item], sentences: [{ text: "The bylaw reads as quoted.", kind: "rule", support: ["r1"] }] }),
                        { readLog: log, viewer: BOB });
  assert.equal(r.ok, true); assert.deepEqual(r.withheld, []);
});

test("R4 ANSWER_CITES_UNREAD: a holding the log did not answer, or a quote not byte-exact in what it answered, is withheld; the others stand", () => {
  const { log } = logged();
  const a = answer({
    holdings: [
      { address: "INFO-2026-0001-minutes", quote: "approved the budget on a vote of 5 to 2" },
      { address: "INFO-2026-0002-never-read", quote: "approved" },
      { address: "INFO-2026-0001-minutes", quote: "approved the budget unanimously" },
      { address: "INFO-2026-0001-minutes", quote: "Council minutes\u0000The council" },
    ],
    sentences: [
      { text: "The minutes say it was \"approved the budget on a vote of 5 to 2\".", kind: "quote", support: ["h1"] },
      { text: "Another document says so too.", kind: "quote", support: ["h2"] },
      { text: "It was unanimous.", kind: "quote", support: ["h3"] },
      { text: "The title and the snippet run together.", kind: "quote", support: ["h4"] },
      { text: "This quote rests on nothing.", kind: "quote", support: [] },
    ],
  });
  const r = checkAnswer(a, { readLog: log, viewer: BOB });
  assert.equal(r.ok, true);
  assert.deepEqual(codes(r), [["s2", "ANSWER_CITES_UNREAD"], ["s3", "ANSWER_CITES_UNREAD"], ["s4", "ANSWER_CITES_UNREAD"], ["s5", "ANSWER_CITES_UNREAD"]]);
  assert.equal(r.answer.sentences[0].text, a.sentences[0].text);
  assert.deepEqual(r.answer.sentences.slice(1), [null, null, null, null]);   /* withheld, never rewritten */
  assert.deepEqual(r.answer.holdings.map((h) => h !== null), [true, false, false, false]);
  for (const x of r.withheld) assert.equal(x.translation, ANSWERS_CHECKS[x.code].translation);
});

test("R4 ANSWER_FIGURE_UNSOURCED: a figure outside a quote must equal a figure of a CALC- result or money fact the log answered and the sentence cites", () => {
  const { log } = logged();
  const a = answer({
    holdings: [{ address: CALC, quote: "41" }, { address: MNY, quote: "2097431" }, { address: "INFO-2026-0001-minutes", quote: "a vote of 5 to 2" }],
    sentences: [
      { text: "41 of 58 contracts were at grade B, 70.69% of them.", kind: "figure", support: ["h1"] },
      { text: "42 of 58 contracts were at grade B.", kind: "figure", support: ["h1"] },
      { text: "The payment was $2,097,431.", kind: "figure", support: ["h2"] },
      { text: "The payment was about $2.1 million.", kind: "figure", support: ["h2"] },
      { text: "The minutes record \"a vote of 5 to 2\" on 2026-03-05 (INFO-2026-0001-minutes).", kind: "quote", support: ["h3"] },
      { text: "The vote was 5 to 2.", kind: "quote", support: ["h3"] },
      { text: "41 contracts, it says, but this sentence cites no calculation.", kind: "explain", support: ["h3"] },
    ],
  });
  const r = checkAnswer(a, { readLog: log, viewer: BOB });
  assert.deepEqual(codes(r), [["s2", "ANSWER_FIGURE_UNSOURCED"], ["s4", "ANSWER_FIGURE_UNSOURCED"], ["s6", "ANSWER_FIGURE_UNSOURCED"],
                              ["s7", "ANSWER_FIGURE_UNSOURCED"]]);
  /* a date, a record address and a bare year are not figures */
  assert.deepEqual(figuresIn("Adopted 2026-03-05 as INFO-2026-0001-minutes in 2025, § 12.4"), []);
  assert.deepEqual(figuresIn("$4.2 million and 41%").map((f) => [f.value, f.unit ?? null]), [["4200000", null], ["41", "percent"]]);
});

test("R4 R22 ANSWER_RULE_NOT_PLANE: a rule item or rule sentence not among the rule services' answers in the log is withheld; no rule reaches a member but through R7", async () => {
  const { w, g } = logged();
  const id = w.standard({ from: "2020-01-01", to: null });
  const held = await w.a.ruleAnswer({ service: "standard", args: { id }, viewer: BOB, grant: g });
  const inForce = await w.a.ruleAnswer({ service: "standardinforce", args: { standard: id, date: "2026-01-01" }, viewer: BOB, grant: g });
  const quote = held.value.texts[0].text;
  const plane = { rule_id: held.rule_id, service: "standard", value: held.value, label: "legal_information", quote };
  const a = answer({
    rules: [
      plane,
      { ...plane, rule_id: "rule:99" },                                          /* the model's own rule */
      { ...plane, value: { ...held.value, cite: "Test Bylaw § 999" } },          /* the plane's answer, altered */
      { ...plane, quote: "the town may not do this" },                          /* a quote the answer did not hold */
      { rule_id: inForce.rule_id, service: "standardinforce", value: inForce.value, label: "computed_fact" },
      { rule_id: inForce.rule_id, service: "standardinforce", value: inForce.value, label: "legal_information", quote: "in force" },
    ],
    sentences: [
      { text: "The bylaw reads as quoted.", kind: "rule", support: ["r1"] },
      { text: "The law requires a hearing.", kind: "rule", support: ["r2"] },
      { text: "The bylaw is numbered 999.", kind: "rule", support: ["r3"] },
      { text: "The bylaw forbids it.", kind: "rule", support: ["r4"] },
      { text: "It was in force on that day.", kind: "rule", support: ["r5"] },
      { text: "It was in force, as legal information.", kind: "rule", support: ["r6"] },
      { text: "The law requires a hearing within ten days.", kind: "rule", support: ["h1"] },
    ],
    holdings: [{ address: "INFO-2026-0001-minutes", quote: "approved the budget" }],
  });
  const r = checkAnswer(a, { readLog: w.a.readLog(g), viewer: BOB });
  assert.deepEqual(codes(r), [["s2", "ANSWER_RULE_NOT_PLANE"], ["s3", "ANSWER_RULE_NOT_PLANE"], ["s4", "ANSWER_RULE_NOT_PLANE"],
                              ["s6", "ANSWER_RULE_NOT_PLANE"], ["s7", "ANSWER_RULE_NOT_PLANE"]]);
  assert.deepEqual(r.answer.rules.map((x) => x !== null), [true, false, false, false, true, false]);
  /* a court ruling is quote-only (D40): a reading beside its quote is not the plane's */
  const court = w.standards.standardDeclare({ cite: "Marlow Ct. Dec. 4", kind: "court", issuer: "The Marlow Court",
    text: [w.passage("the order of the court")], period: { from: "2020-01-01", to: null }, reason: "a ruling the group cites",
    author: BOB, viewer: BOB });
  const c = await w.a.ruleAnswer({ service: "standard", args: { id: court.id }, viewer: BOB, grant: g });
  assert.equal(c.quote_only, true);
  const citem = { rule_id: c.rule_id, service: "standard", value: c.value, label: "legal_information", quote: c.value.texts[0].text };
  const cr = checkAnswer(answer({ rules: [citem, { ...citem, reading: "the court held the town liable" }],
    sentences: [{ text: "The court's words.", kind: "rule", support: ["r1"] }, { text: "What the court meant.", kind: "rule", support: ["r2"] }] }),
    { readLog: w.a.readLog(g), viewer: BOB });
  assert.deepEqual(codes(cr), [["s2", "ANSWER_RULE_NOT_PLANE"]]);
});

test("R4 ANSWER_ABSENCE_WITHOUT_LEVEL: an absence names its level, and states it only in the five absence terms", () => {
  const { log } = logged();
  const a = answer({
    looks: [{ level: "document", state: "LOOKED_ABSENT" }, { state: "LOOKED_ABSENT" }, { level: "document", state: "missing" },
            { level: "the web", state: "NEVER_LOOKED" }],
    sentences: [
      { text: "No contract with that vendor is held among the documents.", kind: "absence", support: ["l1"] },
      { text: "There is no contract.", kind: "absence", support: [] },
      { text: "Nothing was found.", kind: "absence", support: ["l2"] },
      { text: "The contract is missing.", kind: "absence", support: ["l3"] },
      { text: "Nobody looked online.", kind: "absence", support: ["l4"] },
    ],
  });
  const r = checkAnswer(a, { readLog: log, viewer: BOB });
  assert.deepEqual(codes(r), [["s2", "ANSWER_ABSENCE_WITHOUT_LEVEL"], ["s3", "ANSWER_ABSENCE_WITHOUT_LEVEL"],
                              ["s4", "ANSWER_ABSENCE_WITHOUT_LEVEL"], ["s5", "ANSWER_ABSENCE_WITHOUT_LEVEL"]]);
  assert.deepEqual(r.answer.looks.map((x) => x !== null), [true, false, false, false]);
});

test("R4 a summary resting on a withheld sentence is withheld; when nothing remains the answer states what could not be established; it never throws", () => {
  const { log } = logged();
  const a = answer({
    summary: { text: "It was approved, unanimously.", rests_on: ["s1", "s2"] },
    holdings: [{ address: "INFO-2026-0001-minutes", quote: "approved the budget" }, { address: "INFO-2026-0001-minutes", quote: "unanimously" }],
    sentences: [{ text: "It was approved.", kind: "quote", support: ["h1"] }, { text: "Unanimously.", kind: "quote", support: ["h2"] }],
  });
  const r = checkAnswer(a, { readLog: log, viewer: BOB });
  assert.equal(r.answer.summary, null);
  assert.ok(r.withheld.some((x) => x.summary && x.code === "ANSWER_CITES_UNREAD"));
  assert.deepEqual(r.answer.not_established, []);
  const none = checkAnswer(answer({ ...a, sentences: [{ ...a.sentences[1], support: ["h1"] }], summary: { text: "Unanimous.", rests_on: ["s1"] }, holdings: [a.holdings[1]] }),
                           { readLog: log, viewer: BOB });
  assert.deepEqual(none.answer.sentences, [null]);
  assert.deepEqual(none.answer.not_established, [{ withheld: 1, codes: ["ANSWER_CITES_UNREAD"] }]);
  const loop = answer(); loop.lens = {}; loop.lens.self = loop.lens;
  assert.doesNotThrow(() => checkAnswer(loop, { readLog: log, viewer: BOB }));
  assert.doesNotThrow(() => checkAnswer(undefined));
});

test("R5 closed book: where the read log holds nothing, every sentence but an absence at its level is withheld, and the absence stands with its next act", () => {
  const w = answersWorld();
  const empty = w.a.readLog("grant-nothing-read");
  assert.equal(empty.empty, true);
  const a = answer({
    looks: [{ level: "document", state: "LOOKED_ABSENT" }],
    sentences: [
      { text: "The council adopted the budget in June.", kind: "explain", support: [] },
      { text: "No budget adoption is held among the documents searched.", kind: "absence", support: ["l1"] },
    ],
    next_acts: ["capturerequest"],
  });
  const r = checkAnswer(a, { readLog: empty, viewer: V("bob") });
  assert.deepEqual(codes(r), [["s1", "ANSWER_CITES_UNREAD"]]);
  assert.equal(r.answer.sentences[1].kind, "absence");
  assert.deepEqual(r.answer.next_acts, ["capturerequest"]);
  /* a log read under another member's grant is read as nothing (fail closed) */
  const { log } = logged();
  const q = answer({ holdings: [{ address: "INFO-2026-0001-minutes", quote: "approved the budget" }],
                     sentences: [{ text: "It was approved.", kind: "quote", support: ["h1"] }] });
  assert.deepEqual(codes(checkAnswer(q, { readLog: log, viewer: V("carol") })), [["s1", "ANSWER_CITES_UNREAD"]]);
  assert.deepEqual(codes(checkAnswer(q, { readLog: new ReadLog(), viewer: V("bob") })), [["s1", "ANSWER_CITES_UNREAD"]]);
});
