/* Ask (R6) on the real served page (interface-shell's harness): "Ask" through `op=ask` while the assistant is reachable
   (interface-shell R20), its answer drawn as labelled machine work with each holding a reference to its passage and the
   looks as where it looked, the test-instance label when the answer carries it; "Find and count" while it is not; keeping
   and stopping the question in both; the assistant's refusals by their words. The plane's ask answers a stream (agent-worker
   R54); the harness answers its last event as one JSON body, the form the shell's op client reads today (SCREENS-DAILY #1's
   REPORT). Every sentence is asserted as `word(key, vars)` (R34): no test here holds a sentence's English. */
import "../../sandbox.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { storeWorld } from "../store-request/fixtures.mjs";
import { open, open as openRaw, ok, refused, text, ops, acts, button, press, beside, last, main, screen, word, hasWord, dmy, inOrder } from "./page.mjs";

/* The team of the tests that read the store: its founder (an administrator) over the REAL store (`storeWorld()`, op-tables §5.3), the rule services switched on
   by her real act (`ruleservicesswitch`) when asked, and the page booted as her. What the AI would answer (`ask`, a stream) and whether the assistant is
   reachable stay the plane's, as they are no answer of the store. */
async function team({ rules = false } = {}) {
  const w = await storeWorld();
  const rosa = await w.signIn("admin");
  if (rules) await rosa.act("ruleservicesswitch", { body: { on: true } });
  return { w, rosa };
}
const openIn = ({ w, rosa }, path, plane = {}) => open(path, plane, w.boot(rosa));

const REACH = { assistantstate: ok({ on: true }), accountreference: ok({ held: true }) };
const EVENT = {
  event: "answer", ok: true,
  answer: {
    question_as_read: "How many pothole reports were closed within seven days?",
    summary: { text: "812 of 903 were closed within 7 days.", rests_on: ["s1"] },
    sentences: [{ text: "The work orders record 812 closed within 7 days.", kind: "figure", support: ["h1"] },
      { text: "No inspection records were found.", kind: "absence", support: ["l1"] }],
    holdings: [{ address: "INF-1#p3", quote: "903 rows" }],
    looks: [{ level: "document", state: "LOOKED_FOUND" }, { level: "internet", state: "NOT_LOOKED" }, { level: "meaning", state: "ODD" }],
    label: "machine work",
  },
  withheld: [{ code: "ANSWER_CITES_UNREAD" }],
};
const answered = (ev) => ({ status: 200, json: ev });
const R = "looking";

test("R6: while the assistant is reachable, \"Ask\" sends the question through op=ask, and \"Search instead\" opens Find", async () => {
  const p = await open("/app/answers", { ...REACH, ask: answered(EVENT) });
  assert.deepEqual(ops(p), ["ask", "search", "standingquestionset"]);
  assert.ok(button(p, "ask").textContent.startsWith(word("act.ask.label.answers")), "the registry's \"Ask\", its own act");
  const none = await press(p, "ask", { values: { "answers-q": "" } });
  assert.equal(beside(p, none), word("screen.answers.questionfirst"));
  await press(p, "ask", { values: { "answers-q": " How many? " } });
  assert.deepEqual(last(p, "ask").body, { question: "How many?" });
  assert.equal(last(p, "ask").method, "POST");
  await press(p, "search", { values: { "answers-q": "How many?" }, reason: R });
  assert.equal(p.location.pathname, "/app/finder/How%20many%3F", "it opens Find with the question's words");
  assert.deepEqual(p.byOp("search").map((r) => r.query.q), ["How many?"], "one search: Find's own read of the words, none from here");
});

test("R6: the answer is drawn as machine work: summary, sentences each with its holding as a reference to its passage, and where it looked", async () => {
  const p = await open("/app/answers", { ...REACH, ask: answered(EVENT) });
  await press(p, "ask", { values: { "answers-q": "How many?" } });
  const mw = main(p).querySelector(".cs-machinework");
  assert.ok(mw);
  assert.ok(text(p, mw).includes(word("screen.answers.asread", { question: "How many pothole reports were closed within seven days?" }) + "812 of 903 were closed within 7 days."));
  assert.ok(text(p, mw).includes("The work orders record 812 closed within 7 days. 903 rows"));
  assert.ok(mw.querySelectorAll(".cs-card, a.cs-ref").some((e) => e.textContent === "903 rows"));
  assert.ok(inOrder(text(p, mw), [word("screen.answers.holdings"), "903 rows", word("screen.answers.looks"), word("screen.answers.level.document"), word("screen.answers.state.LOOKED_FOUND"),
    word("screen.answers.level.internet"), word("screen.answers.state.NOT_LOOKED"), word("screen.answers.level.meaning"), "ODD"]));
  assert.ok(text(p, mw).includes(word("screen.answers.withheld.one")), "R25: one sentence, the singular key");
  assert.ok(text(p, mw).endsWith(word("screen.answers.machine")));
  assert.ok(!text(p, mw).includes(word("ai.label.untested")), "control: no label without untested");
});

test("R6 (K2816 (2); screens-inquiry R7): an answer the plane marks untested carries the test-instance label", async () => {
  const p = await open("/app/answers", { ...REACH, ask: answered({ ...EVENT, untested: { kind: "untested", part: "ask", words: "ai.label.untested" } }) });
  await press(p, "ask", { values: { "answers-q": "How many?" } });
  assert.ok(text(p).includes(word("ai.label.untested")));
});

test("R6: the assistant's refusals are drawn by their words (ai.refused.*), in the screen's words for ASSISTANT_OFF and AI_PART_NOT_DEPLOYED", async () => {
  // A refusal that names no fields leaves a word's placeholders as they are; the expected words keep them too.
  const same = (key, names) => word(key, Object.fromEntries(names.map((n) => [n, `{${n}}`])));
  const cases = [
    ["AI_KEPT_AWAY", word("ai.refused.projectkeptaway", { for_uses: "{for_uses}", member: "{member}", date: "{date}", reason: "AI_KEPT_AWAY" })], // the shell fills {reason} with the refusal's code
    ["AI_LIMIT_UNJUDGED", same("ai.refused.limit.unjudged", ["whose"])],
    ["NO_ACCOUNT", word("ai.refused.signinnotconnected")],
    ["ASSISTANT_OFF", word("screen.answers.refused.off")],
    ["AI_PART_NOT_DEPLOYED", word("screen.answers.refused.notdeployed")],
  ];
  for (const [code, words] of cases) {
    const p = await open("/app/answers", { ...REACH, ask: refused(code, null, 409) });
    const b = await press(p, "ask", { values: { "answers-q": "How many?" } });
    assert.equal(beside(p, b).replace(/\s+/g, " "), words, code);
    assert.equal(p.doc.getElementById("answers-q").value, "How many?", "the form keeps the question (interface-shell R13)");
  }
  const ask = screen("answers").acts.find((a) => a.op === "ask");
  assert.equal(ask.refusals.AI_LIMIT_REACHED, "ai.refused.limit");
  assert.equal(ask.refusals.AI_USE_SWITCHED_OFF, "ai.refused.off");
  // A refused stream's last event (`event: refused`) is a refusal beside the act, and no answer is drawn.
  const s = await open("/app/answers", { ...REACH, ask: answered({ event: "refused", ok: false, code: "AI_KEPT_AWAY" }) });
  const b = await press(s, "ask", { values: { "answers-q": "q" } });
  assert.ok(beside(s, b).startsWith(word("ai.refused.projectkeptaway", { for_uses: "", member: "", date: "", reason: "" }).slice(0, 20)));
  assert.equal(main(s).querySelector(".cs-machinework"), null);
});

test("R27 (D17; agent-worker R89): an ANSWER_MALFORMED refusal of ask is drawn by its words, never \"This could not be read\", and nothing of the answer is shown", async () => {
  const unread = word("shell.unread");
  for (const plane of [{ ...REACH, ask: refused("ANSWER_MALFORMED", null, 502, { field: "summary" }) },
    { ...REACH, ask: answered({ event: "refused", ok: false, code: "ANSWER_MALFORMED", field: "summary" }) }]) {
    const p = await open("/app/answers", plane);
    const b = await press(p, "ask", { values: { "answers-q": "How many?" } });
    assert.equal(beside(p, b).replace(/\s+/g, " "), word("refusal.ANSWER_MALFORMED", { field: "summary" }));
    assert.ok(!text(p).includes(unread));
    assert.equal(main(p).querySelector(".cs-machinework"), null);
  }
  assert.equal(screen("answers").acts.find((a) => a.op === "ask").refusals.ANSWER_MALFORMED, "refusal.ANSWER_MALFORMED");
});

test("R27: an answer's not_established is drawn beneath its heading as the sentences it holds; control: a full answer is drawn as before, with no such heading", async () => {
  const sure = { ...EVENT, answer: { ...EVENT.answer, not_established: ["The cause is not established by the record.", { text: "No inspection dates were found." }, { withheld: 2, codes: [] }] } };
  const p = await open("/app/answers", { ...REACH, ask: answered(sure) });
  await press(p, "ask", { values: { "answers-q": "Why?" } });
  const mw = main(p).querySelector(".cs-machinework");
  assert.ok(inOrder(text(p, mw), [word("screen.answers.notestablished"), "The cause is not established by the record.", "No inspection dates were found.", word("screen.answers.withheld", { n: "2" })]));
  const full = await open("/app/answers", { ...REACH, ask: answered({ ...EVENT, answer: { ...EVENT.answer, not_established: [] } }) });
  await press(full, "ask", { values: { "answers-q": "How many?" } });
  assert.ok(!text(full).includes(word("screen.answers.notestablished")), "an empty list draws no heading");
  assert.ok(text(full).includes("812 of 903 were closed within 7 days."));
});

test("R6: while not reachable the screen is \"Find and count\": search here, and ruleanswer \"Show how this was counted\"", async () => {
  const t = await team({ rules: true });
  await t.w.recipes.hold(t.rosa, "Work orders", "903 rows", "");
  const p = await openIn(t, "/app/answers", {
    ruleanswer: ok({ ok: true, service: "occurrences", value: 812, basis: "903 rows", label: "computed_fact" }),
  });
  assert.equal(main(p).querySelector("h1").textContent, word("screen.answers.offtitle"));
  assert.deepEqual(ops(p), ["search", "standingquestionset"]);
  assert.ok(!ops(p).includes("ask"), "no assistant control drawn (interface-shell R20)");
  await press(p, "search", { values: { "answers-q": "work orders" }, reason: R });
  assert.ok(p.byOp("search").some((r) => r.query.q === "work orders"), "R6: the plain words go to the fields route alone, never joined to a passage: term by OR");
  assert.ok(p.byOp("search").every((r) => !/\bOR\b/.test(r.query.q)), "R6: no search the screen sends joins routes by OR");
  assert.ok(p.byOp("search").some((r) => r.query.q === "passage:work passage:orders"), "R35: the passages holding the words are asked in a read of their own");
  assert.ok(main(p).querySelector('.cs-origin[data-origin="search"]'));
  assert.deepEqual(ops(p), ["search", "ruleanswer", "standingquestionset"]);
  assert.ok(button(p, "ruleanswer").textContent.startsWith(word("act.ruleanswer.label.answers")));
  await press(p, "ruleanswer", { reason: R });
  assert.deepEqual({ ...last(p, "ruleanswer").body, reason: undefined }, { service: "occurrences", args: { q: "work orders" }, reason: undefined });
  assert.ok(text(p).includes(word("screen.answers.rule.value", { label: word("screen.answers.label.computed_fact"), value: "812" }) + word("screen.answers.rule.basis", { basis: "903 rows" })));
  const nh = await openIn(t, "/app/answers");
  await press(nh, "search", { values: { "answers-q": "zz" }, reason: R });
  assert.ok(text(nh).includes(word("screen.finder.none")));
  await press(nh, "ruleanswer", { reason: R });
  const held = await t.rosa.act("ruleanswer", { body: { service: "occurrences", args: { q: "zz" } } });
  assert.ok(held.not_held && held.not_held.reason, "the real store holds no such rule: " + JSON.stringify(held));
  assert.ok(text(nh).includes(word("screen.answers.rule.notheld", { reason: held.not_held.reason })), "the real store's own reason is drawn");
});

test("R6: in both, standingquestionset keeps asking and standingquestionend stops, with \"New matches will arrive in your queue as a list\"", async () => {
  for (const reach of [REACH, {}]) {
    const t = await team();
    const p = await openIn(t, "/app/answers", reach);
    assert.ok(text(p).includes(word("screen.answers.keeping")));
    const none = await press(p, "standingquestionset", { values: { "answers-q": "" } });
    assert.equal(beside(p, none), word("screen.answers.questionfirst"));
    await press(p, "standingquestionset", { values: { "answers-q": "pothole closures" } });
    const b = last(p, "standingquestionset").body;
    assert.deepEqual([b.question, b.query, b.cadence], ["pothole closures", "pothole closures", "weekly"]);
    // the real store kept it: the question is hers, ends a year on (the page asks for the day), and its id is the one the end button carries
    const id = button(p, "standingquestionend").dataset.id;
    assert.match(id, /^STQ-/, "the real store's id");
    const ends = last(p, "standingquestionset").body.ends;
    assert.ok(text(p).includes(word("screen.answers.kept", { cadence: word("screen.answers.cadence.weekly"), date: dmy(ends) })));
    await press(p, "standingquestionend");
    assert.deepEqual(last(p, "standingquestionend").body, { id });
    assert.ok(!ops(p).includes("standingquestionend"));
    assert.equal((await t.rosa.act("standingquestionend", { body: { id } })).already, true, "the real store has ended it: ending it again finds it already ended");
  }
  assert.ok(acts);
});

test("R34: every key Ask reads is a word of the list", () => {
  for (const k of screen("answers").words) assert.ok(hasWord(k), k);
  for (const k of Object.values(screen("answers").acts.find((a) => a.op === "ask").refusals).filter((k) => typeof k === "string")) assert.ok(hasWord(k), k);
});

/* R6, R35 with the real search (the store's own, over documents held and read by the real acts): the words are found in a title and in a passage, and no search the screen sends is refused. */
test("R6: Ask-as-search, while not reachable, is answered by the real retrieval: words in a title and words only in a passage are found, nothing is refused ROUTES_CROSSED", async () => {
  const t = await team();
  await t.w.recipes.page(t.rosa, "Sewer fund audit", { paragraphs: ["the sewer fund was approved by the council"] });
  await t.w.recipes.hold(t.rosa, "Parks budget", "The parks budget for the year.", "");
  const refusals = [];
  const booted = t.w.boot(t.rosa);
  const door = async (req) => {
    const a = await booted.door(req);
    if (new URL(req.url, "https://x.example").searchParams.get("op") === "search" && !(a.status < 400 && a.json && a.json.ok !== false && !(a.json.result && a.json.result.ok === false)))
      refusals.push(JSON.stringify(a.json || a.status).slice(0, 200));
    return a;
  };
  const p = await open("/app/answers", {}, { ...booted, door });
  for (const [words, title] of [["sewer", "Sewer fund audit"], ["approved council", "Sewer fund audit"], ["parks", "Parks budget"]]) {
    await press(p, "search", { values: { "answers-q": words }, reason: R });
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(text(p).includes(title), `${words}: the document "${title}" is found`);
  }
  await press(p, "search", { values: { "answers-q": "zzzzqq" }, reason: R });
  assert.ok(text(p).includes(word("screen.finder.none")), "control: words nothing holds draw none");
  assert.deepEqual(refusals, [], "no search the screen sent was refused");
});

test("R6 (K5131): \"Show how this was counted\" is drawn only while answers' ruleservicesstate reads on; control: on draws it", async () => {
  const t = await team();
  await t.w.recipes.hold(t.rosa, "Work orders", "903 rows", "");
  for (const on of [false, true]) {
    if (on) await t.rosa.act("ruleservicesswitch", { body: { on: true } });
    const p = await openIn(t, "/app/answers");
    await press(p, "search", { values: { "answers-q": "work orders" }, reason: R });
    assert.equal(ops(p).includes("ruleanswer"), on, `rule services ${on ? "on" : "off"}`);
    assert.equal(text(p).includes(word("act.ruleanswer.label.answers")), on);
    assert.ok(ops(p).includes("search") && ops(p).includes("standingquestionset"), "the rest of the screen is drawn either way");
  }
});
