/* screens-find R6, "Find and count": while the assistant is not reachable, "Show how this was counted" (`ruleanswer`) is on the
   screen whenever answers' rule services read on (`ruleservicesstate`), with or without a search before it, and is not drawn while
   they are off or unread. The screen is booted alone through interface-shell's harness, with every word the word list holds, and a
   scripted plane. Every sentence is asserted as `word(key, vars)`: no test here holds English. */
import "../../sandbox.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { boot, ok, refused, settle } from "../interface-shell/harness.mjs";
import { WORD_ROWS, word } from "../../../src/setup-words/index.mjs";
import { answers } from "../../../src/screens-daily/answers.mjs";

const SCREEN = Object.freeze({ ...answers, words: Object.freeze(WORD_ROWS.map((r) => r[0])) });
const open = (plane) => boot({ screens: [SCREEN], plane, path: "/app/answers" });
const main = (p) => p.doc.getElementById("cs-main");
const text = (p) => main(p).textContent.replace(/\s+/g, " ").trim();
const ops = (p) => main(p).querySelectorAll("button[data-act]").map((b) => b.getAttribute("data-act"));
const press = async (p, op, values = {}) => {
  for (const [id, v] of Object.entries(values)) p.doc.getElementById(id).value = v;
  const b = main(p).querySelector(`button[data-act="${op}"]`);
  assert.ok(b, `a ${op} button is drawn`);
  await p.click(b);
  const ai = b.getAttribute("data-ai");
  const ta = p.doc.getElementById("cs-reason-" + ai.replace(":", "-"));
  if (ta) { ta.value = "looking"; await p.click(p.root().querySelector(`[data-shell="reason-send"][data-for="${ai}"]`)); }
  await settle();
};

const RULES_ON = { ruleservicesstate: ok({ ok: true, on: true }) };
const COUNTED = { ruleanswer: ok({ ok: true, service: "occurrences", value: 812, basis: "903 rows", label: "computed_fact" }) };

test("R6: with the rule services on, \"Show how this was counted\" is on \"Find and count\" before any search", async () => {
  const p = await open({ ...RULES_ON, ...COUNTED });
  assert.equal(main(p).querySelector("h1").textContent, word("screen.answers.offtitle"));
  assert.deepEqual(ops(p), ["search", "ruleanswer", "standingquestionset"]);
  assert.ok(text(p).includes(word("act.ruleanswer.label.answers")));
  assert.equal(p.byOp("search").length, 0, "nothing was searched");
});

test("R6: pressed before a search, it counts the words in the field, and draws the count, its label and its basis", async () => {
  const p = await open({ ...RULES_ON, ...COUNTED });
  await press(p, "ruleanswer", { "answers-q": "  work orders " });
  assert.equal(p.byOp("ruleanswer").length, 1);
  assert.deepEqual(p.byOp("ruleanswer").at(-1).body.service, "occurrences");
  assert.deepEqual(p.byOp("ruleanswer").at(-1).body.args, { q: "work orders" });
  assert.ok(text(p).includes(word("screen.answers.rule.value", { label: word("screen.answers.label.computed_fact"), value: "812" })));
  assert.ok(text(p).includes(word("screen.answers.rule.basis", { basis: "903 rows" })));
});

test("R6: after a search it counts the words searched; control: a rule the record does not hold draws its reason", async () => {
  const p = await open({ ...RULES_ON, ruleanswer: ok({ ok: true, service: "occurrences", not_held: { reason: "no such rule" } }) });
  await press(p, "search", { "answers-q": "potholes" });
  assert.ok(ops(p).includes("ruleanswer"), "still drawn after the search");
  await press(p, "ruleanswer");
  assert.deepEqual(p.byOp("ruleanswer").at(-1).body.args, { q: "potholes" });
  assert.ok(text(p).includes(word("screen.answers.rule.notheld", { reason: "no such rule" })));
});

test("R6 (error): pressed with no words, it says words come first and sends nothing", async () => {
  const p = await open({ ...RULES_ON, ...COUNTED });
  await press(p, "ruleanswer", { "answers-q": "   " });
  assert.equal(p.byOp("ruleanswer").length, 0);
  assert.ok(p.root().textContent.includes(word("screen.finder.wordsfirst")));
});

test("R6 (bounds): not drawn while the rule services are off, unread or failed, before or after a search", async () => {
  for (const [why, state] of [["off", ok({ ok: true, on: false })], ["refused", refused("FORBIDDEN")], ["no answer", ok(null)], ["not on exactly", ok({ ok: true, on: "yes" })]]) {
    const p = await open({ ruleservicesstate: state });
    assert.deepEqual(ops(p), ["search", "standingquestionset"], why);
    await press(p, "search", { "answers-q": "potholes" });
    assert.ok(!ops(p).includes("ruleanswer"), why + ", after a search");
    assert.ok(!text(p).includes(word("act.ruleanswer.label.answers")), why);
  }
});

test("R6 (control): while the assistant is reachable the screen is Ask, with no count", async () => {
  const p = await open({ ...RULES_ON, assistantstate: ok({ on: true }), accountreference: ok({ held: true }) });
  assert.ok(ops(p).includes("ask"));
  assert.ok(!ops(p).includes("ruleanswer"));
});
