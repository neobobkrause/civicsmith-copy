/* screens-question R4 (the Screens page's assistant C4, C7, A1): the dock's "Ask about this screen" and "Ask", on
 * interface-shell's served page beside this module's own `question` screen, opened from the masthead while the assistant
 * is reachable (interface-shell R20). The scripted plane answers the dock's reads and plays `ask`'s stream (agent-worker
 * R54: `read`, `composing`, `checking`, then `answer` or `refused`); interface-shell's guard holds every request to the
 * fields its owner declares (store-assembly's `ask`). Every expectation is a word read by key (R44). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { word } from "../../../src/setup-words/index.mjs";
/* the world registers every owner's op declarations once, as the plane does at start-up (store-assembly R83) */
import "../store-request/fixtures.mjs";
import { boot, ok, refusedIn, ndjson } from "../interface-shell/harness.mjs";
import { COMMON } from "../../../src/screens-inquiry/common.mjs";
import { ASSISTANT_SCREEN } from "../../../src/screens-inquiry/assistant.mjs";
import { questionScreen } from "../../../src/screens-inquiry/question.mjs";
import { documentScreen } from "../../../src/screens-inquiry/document.mjs";

const Q = "INQ-2026-0001-seven-days";
const P = "PROJ-2026-0001-potholes";
const D = "INFO-2026-0004";
const questionMd = (project) => ["---", `id: ${Q}`, "object_type: inquiry", "title: \"Seven days\"", ...(project ? [`project: ${project}`] : []), "created: 2026-10-03T10:00:00Z", "---", "", "## Question", "", "Is the city repairing reported potholes within seven days?", ""].join("\n");
const DOCUMENT_MD = ["---", `id: ${D}`, "object_type: information", "title: \"Pothole repair policy\"", "---", "", "## Summary", ""].join("\n");
const ANSWER = { summary: { text: "Repairs are due within seven days." }, sentences: [{ text: "The policy sets seven days.", support: ["h1"] }],
  holdings: [{ address: D + "#p2", quote: "within seven (7) days" }] };

/* the plane behind the page: the dock's reads (R4: whose account serves her, the pack) and `ask`, recorded */
function plane(ask, project = P) {
  const sent = [];
  const ops = {
    assistantstate: ok({ on: true }),
    accountreference: ok({ held: true }),
    groupkeystate: ok({ held: true, on: true }),
    aiusage: ok({ ok: true, today: { used: 0, limit: 10 } }),
    agentpack: ok({ ok: true, pack: { version: "civicsmith@3+ab12cd" } }),
    aikeepawaystate: ok({ on: false }),
    airuns: ok({ ok: true, runs: [], count: 0 }),
    image: (r) => ok(r.query.id === Q ? { "bundle.md": questionMd(project) } : r.query.id === D ? { "bundle.md": DOCUMENT_MD } : null),
    ask: (r) => { sent.push(r.body); return typeof ask === "function" ? ask(r) : ask; },
  };
  return { ops, sent };
}
async function dock(ask, project) {
  const pl = plane(ask, project);
  /** @type {*} the screens the page is served with: this module's question and dock, and the document their references open */
  const screens = [questionScreen(COMMON), documentScreen(COMMON), ASSISTANT_SCREEN];
  const p = await boot({ screens, plane: pl.ops, path: `/app/question/${Q}` });
  await p.settle();
  await p.click(p.root().querySelector('.cs-mast [data-shell="dock"]'));
  await p.settle();
  return { p, sent: pl.sent };
}
const panel = (p) => p.root().querySelector(".cs-dock");
const says = (el, key, vars) => String((el && el.textContent) || "").includes(word(key, vars || {}));
const askButton = (p) => panel(p).querySelector('button[data-act="ask"]');
async function ask(p, words) {
  p.doc.getElementById("assistant-ask").value = words;
  await p.click(askButton(p));
  await p.settle();
}

test("R4 (C7, A1) the dock draws the field \"Ask about this screen\" and the act \"Ask\" beside its other acts", async () => {
  const { p } = await dock(ndjson([{ event: "answer", answer: ANSWER }]));
  assert.ok(p.doc.getElementById("assistant-ask"), "the field");
  assert.ok(says(panel(p), "screen.assistant.ask.label"));
  assert.ok(askButton(p), "the act");
  assert.ok(says(askButton(p), "act.ask.label.assistant"));
  assert.ok(panel(p).querySelector('button[data-act="airunopen"]'), "Work on this stays");
});

test("R4 (A1) Ask sends her words and the screen's project through `ask`, and draws the checked answer as machine work, never evidence", async () => {
  const { p, sent } = await dock(ndjson([{ event: "read", record: D }, { event: "composing" }, { event: "checking" }, { event: "answer", answer: ANSWER }]));
  await ask(p, "  When are potholes repaired?  ");
  assert.deepEqual(sent, [{ question: "When are potholes repaired?", project: P }]);
  const a = panel(p).querySelector('[data-ask="answer"]');
  assert.ok(a, "the answer is drawn");
  assert.equal(a.getAttribute("data-origin"), "machine");
  assert.ok(a.textContent.includes("Repairs are due within seven days.") && a.textContent.includes("The policy sets seven days."));
  assert.ok(a.querySelector(`a[href*="${D}"]`), "the passage it rests on links to its document");
  for (const k of ["screen.assistant.notevidence", "ai.progress.checked.all", "screen.answers.legal"]) assert.ok(says(a, k), k);
  assert.equal(panel(p).querySelector('[data-ask="working"]'), null, "no progress once answered");
});

test("R4, R7 an answer the plane marks untested carries `ai.label.untested`; one without it carries none", async () => {
  const marked = await dock(ndjson([{ event: "answer", answer: ANSWER, untested: true }]));
  await ask(marked.p, "Why?");
  assert.ok(says(panel(marked.p).querySelector('[data-ask="answer"]'), "ai.label.untested"));
  const plain = await dock(ndjson([{ event: "answer", answer: ANSWER }]));
  await ask(plain.p, "Why?");
  assert.equal(panel(plain.p).querySelector('[data-label="untested"]'), null);
});

test("R4 (C4) a stream whose check failed draws the failed check's sentence and no answer", async () => {
  const { p } = await dock(ndjson([{ event: "read", record: D }, { event: "refused", ok: false, code: "ASK_CHECK_FAILED" }]));
  await ask(p, "When are potholes repaired?");
  assert.ok(says(panel(p), "ai.progress.check.failed"));
  assert.equal(panel(p).querySelector('[data-ask="answer"]'), null);
});

test("R4 a refused ask is drawn by its words, and the reasons the assistant can't work here are offered", async () => {
  const { p } = await dock(refusedIn("AI_LIMIT_REACHED"));
  await ask(p, "When are potholes repaired?");
  const said = panel(p).querySelector('[data-refusal="ask"]');
  assert.ok(said && said.textContent.trim(), "never blank");
  assert.equal(panel(p).querySelector('[data-ask="answer"]'), null);
  assert.ok(says(panel(p), "question.ai.other"));
});

test("R4 control: an empty field sends nothing and says to write the question first", async () => {
  const { p, sent } = await dock(ndjson([{ event: "answer", answer: ANSWER }]));
  await ask(p, "   ");
  assert.deepEqual(sent, []);
  assert.ok(says(panel(p), "screen.answers.questionfirst"));
});

test("R4 control: a question that states no project sends the question alone, no project", async () => {
  const { p, sent } = await dock(ndjson([{ event: "answer", answer: ANSWER }]), null);
  await ask(p, "When are potholes repaired?");
  assert.deepEqual(sent, [{ question: "When are potholes repaired?" }]);
});
