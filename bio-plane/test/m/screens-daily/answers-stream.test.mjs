/* The ask's progress as it is written, its answer only after the check (R52), and Ask's four states (R53), on the real served
   page (interface-shell's harness): a streamed body whose lines arrive two seconds apart on the page's clock (interface-shell
   R78). Every sentence is asserted as `word(key, vars)` (R34). */
import test from "node:test";
import assert from "node:assert/strict";
import { SCREENS, open, ok, refused, text, press, beside, last, main, screen, word, button } from "./page.mjs";
import { ndjson } from "../interface-shell/harness.mjs";

const REACH = { assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }) };   // T53: the shell reads reachability from `aipathready` (interface-shell R20); `accountreference` is retired (op-declarations R20)
const ANSWER = { event: "answer", ok: true, answer: { question_as_read: "How many?", summary: { text: "812 of 903 were closed." }, sentences: [{ text: "The work orders record 812.", support: ["h1"] }],
  holdings: [{ address: "INF-1#p3", quote: "903 rows" }], looks: [], label: "machine work" }, withheld: [] };
const STREAM = [{ event: "step", step: "interpreting" }, { event: "read", op: "retrieve", record: "INF-1" }, { event: "composing", found: true, count: 2 },
  { event: "checking", count: 1 }, { event: "checked", passage: "h1", found: true }, ANSWER];

// A streamed body whose lines arrive two seconds apart on the page's clock (interface-shell R78's own stand-in).
const streamed = (p, lines) => async () => {
  const enc = new TextEncoder();
  let i = 0;
  return { status: 200, ok: true, headers: { get: (k) => (k.toLowerCase() === "content-type" ? "application/x-ndjson" : null) },
    body: { getReader: () => ({ read: async () => { if (i >= lines.length) return { done: true }; const line = lines[i++]; await new Promise((r) => p.clock.setTimeout(r, 2000)); return { done: false, value: enc.encode(JSON.stringify(line) + "\n") }; } }) },
    text: async () => lines.map((l) => JSON.stringify(l)).join("\n") };
};

test("R52: each stream event is drawn as it arrives, in a polite live region: the reads, that the answer is being written and that it is being checked; no word of the answer before the answer event, which carries the check beneath it", async () => {
  const p = await open("/app/answers", { ...REACH, image: ok({ "bundle.md": '---\ntitle: "Work orders FY2025"\n---\n' }) });
  const real = p.win.fetch;
  p.win.fetch = (url, init) => (new URL(url, "https://x").searchParams.get("op") === "ask" ? streamed(p, STREAM)() : real(url, init));
  p.doc.getElementById("answers-q").value = "How many?";
  await p.click(button(p, "ask"));
  const live = () => main(p).querySelector('[data-ask="working"]');
  await p.clock.tick(2000);
  assert.ok(live() && live().getAttribute("aria-live") === "polite", "the first event: working, in a polite live region");
  assert.ok(text(p, live()).includes(word("ai.progress.hold.answer")));
  await p.clock.tick(2000); await p.settle();
  assert.ok(text(p, live()).includes(word("ai.progress.reading.ask", { document: "Work orders FY2025" })), "the read by the title of its record");
  await p.clock.tick(2000);
  assert.ok(text(p, live()).includes(word("ai.progress.composing.answer")) && !text(p, live()).includes(word("ai.progress.checking")));
  await p.clock.tick(2000);
  assert.ok(text(p, live()).includes(word("ai.progress.checking")));
  assert.ok(!main(p).querySelector(".cs-machinework") && !text(p).includes("812 of 903"), "no word of the answer before its event");
  await p.clock.tick(2000); await p.clock.tick(2000); await p.settle();
  assert.ok(!live(), "the progress gives way to the answer");
  assert.ok(text(p).includes("812 of 903 were closed."));
  assert.ok(text(p).includes(word("ai.progress.checked.all")));
  // Control: a read that names no record draws no row.
  const q = await open("/app/answers", REACH);
  const realQ = q.win.fetch;
  q.win.fetch = (url, init) => (new URL(url, "https://x").searchParams.get("op") === "ask" ? streamed(q, [{ event: "read", op: "retrieve", record: null }, { event: "composing", found: false, count: 0 }, ANSWER])() : realQ(url, init));
  q.doc.getElementById("answers-q").value = "How many?";
  await q.click(button(q, "ask"));
  await q.clock.tick(2000); await q.clock.tick(2000); await q.settle();
  assert.ok(!text(q, q.root().querySelector('[data-ask="working"]') || q.doc.body).includes(word("ai.progress.reading.ask", { document: "" })));
});

test("R52, R53: a stream that ends refused (ASK_CHECK_FAILED) draws the failed-check sentence and no answer; a full stream draws the answer with the check beneath it; a non-streamed refusal is drawn as before", async () => {
  const refusedStream = [STREAM[0], STREAM[1], STREAM[2], STREAM[3], { event: "refused", code: "ASK_CHECK_FAILED", cited: 2, found: 0 }];
  const failed = await open("/app/answers", { ...REACH, ask: { status: 200, ndjson: refusedStream } });
  await press(failed, "ask", { values: { "answers-q": "How many?" } });
  assert.ok(text(failed).includes(word("ai.progress.check.failed")));
  assert.ok(text(failed).includes(word("screen.answers.failed.next")));
  assert.ok(!main(failed).querySelector(".cs-machinework"), "nothing of the answer is drawn");
  const full = await open("/app/answers", { ...REACH, ask: { status: 200, ndjson: STREAM } });
  await press(full, "ask", { values: { "answers-q": "How many?" } });
  assert.ok(main(full).querySelector(".cs-machinework"));
  assert.ok(text(full).includes(word("ai.progress.checked.all")));
  assert.ok(!text(full).includes(word("ai.progress.check.failed")));
  // Control: a refusal before any model call is plain JSON, drawn beside the act as R6 says.
  const plain = await open("/app/answers", { ...REACH, ask: refused("AI_PART_NOT_DEPLOYED", null, 403) });
  const b = await press(plain, "ask", { values: { "answers-q": "How many?" } });
  assert.equal(beside(plain, b), word("screen.answers.refused.notdeployed"));
  assert.ok(!main(plain).querySelector(".cs-machinework"));
});

test("R53: not ready: the refusal in its words with a door to connect; with the assistant not reachable none of these states is drawn", async () => {
  const p = await open("/app/answers", { ...REACH, ask: refused("ASSISTANT_REMOTE_NOT_READY", null, 503) });
  const b = await press(p, "ask", { values: { "answers-q": "How many?" } });
  assert.ok(beside(p, b).includes(word("refusal.ASSISTANT_REMOTE_NOT_READY")));
  const door = p.root().querySelector(`[data-slot="${b.getAttribute("data-ai")}"] a[href="/app/connect"]`);
  assert.ok(door, "a door to connect");
  // Control: without the assistant the screen stays Find and count and draws none of the progress.
  const off = await open("/app/answers", { assistantstate: ok({ on: false }) });
  assert.ok(!text(off).includes(word("ai.progress.hold.answer")) && !text(off).includes(word("ai.progress.check.failed")));
  assert.ok(off.doc.getElementById("answers-q"), "Find and count");
  assert.ok(!main(off).querySelector('button[data-act="ask"]'));
});

test("R53: at work the progress is the stream's rows with no Stop; every state's keys are listed words of the screen", () => {
  const words = new Set(screen("answers").words);
  for (const k of ["ai.progress.reading.ask", "ai.progress.composing.answer", "ai.progress.checking", "ai.progress.hold.answer", "ai.progress.means", "ai.progress.checked.all",
    "ai.progress.checked.all.means", "ai.progress.check.failed", "screen.answers.failed.next", "refusal.ASSISTANT_REMOTE_NOT_READY"]) assert.ok(words.has(k), k);
  assert.ok(!screen("answers").acts.some((a) => /stop/i.test(a.op)), "no Stop");
});
// measure: gate-chromium (not to merge)
