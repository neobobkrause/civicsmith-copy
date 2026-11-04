/* ai-use R15 (T50; N1168; T53): each conversation's effort is recorded beside its entry and served identity, in the act's
   measure only, never the counter; at the interface, each with a negative control (K874). Fake entries only (R26). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { standard, usage, label, ENTRIES } from "./fixture.mjs";
import { EFFORT_WORD_MAX } from "../../../src/ai-use/index.mjs";

const AT = "2026-10-09T12:00:00Z";
const conv = (w, more = {}) => w.u.countUsage({ owner: "member:ann", member: "ann", use: "run", mode: "run", act: "RUN-1",
  entry_id: ENTRIES.priced, label: label("lo"), usage: usage(1), calls: 1, at: AT, ...more });

test("R15 (T53) countUsage and countAskUsage take the conversation's label, whose effort is a lowercase word of at most EFFORT_WORD_MAX letters or null; any other value is AI_RUN_CONSUME_INVALID, counting nothing (control: the longest word and null are kept)", async () => {
  const w = await standard();
  const before = w.snapshot();
  for (const effort of ["Low!", "LOW", "a".repeat(EFFORT_WORD_MAX + 1), 3, "", "lo w"]) {
    assert.equal(conv(w, { label: { ...label(), effort } }).code, "AI_RUN_CONSUME_INVALID", String(effort));
    assert.equal(w.u.countAskUsage({ member: "ann", mode: "ask", owner: "member:ann", entry_id: ENTRIES.priced, label: { ...label(), effort },
      usage: usage(1), calls: 1, at: AT }).code, "AI_RUN_CONSUME_INVALID", `ask ${String(effort)}`);
  }
  assert.equal(w.snapshot(), before, "nothing was counted");
  assert.equal(conv(w, { label: label("a".repeat(EFFORT_WORD_MAX)) }).ok, true);
  assert.equal(conv(w, { label: label(null) }).ok, true);
  assert.equal(w.u.countAskUsage({ member: "ann", mode: "ask", owner: "member:ann", act: "ASK-1", entry_id: ENTRIES.priced, label: label("hi"),
    usage: usage(1), calls: 1, at: AT }).ok, true);
  assert.deepEqual(w.u.actualOf({ act: "ASK-1", viewer: "ann" }).by_entry.map((e) => e.label.effort), ["hi"]);
});

test("R15 (T53) with an act, its measure keeps each conversation's {entry_id, label, calls}; the counter keeps no entry or effort key (control: the same counts without an act measure no conversation)", async () => {
  const w = await standard();
  conv(w);
  conv(w, { entry_id: ENTRIES.other, label: label("hi", ENTRIES.other) });
  conv(w);
  const rows = w.rows(`SELECT entry_id, effort, calls FROM ai_use_act_entries ORDER BY seq`);
  assert.deepEqual(rows, [{ entry_id: ENTRIES.priced, effort: "lo", calls: 2 }, { entry_id: ENTRIES.other, effort: "hi", calls: 1 }]);
  assert.equal(JSON.stringify(w.rows(`SELECT * FROM ai_usage`)).includes(ENTRIES.other), false);
  conv(w, { act: null });
  assert.equal(w.rows(`SELECT * FROM ai_use_act_entries`).length, 2, "no act, no conversation measured");
});
