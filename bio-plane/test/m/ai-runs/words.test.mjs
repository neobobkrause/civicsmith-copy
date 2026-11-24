/* ai-runs T50 (T50-13; N1116, N1171; DEC-258, DEC-259, DEC-260; plan rule 6): the module holds no member-facing English for the
   sentences words.json keeps. Each sentence it answers there is read by key through setup-words' `word`, and the keys it reads are
   held (setup-words R12, R13). Every arm drives the module at its interface. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { world, OPEN, INQ, PROJ, ORG, agentWorker } from "./world.mjs";
import { stepsWorld } from "../steps/fixtures.mjs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";

const READS = JSON.parse(readFileSync(new URL("../../../../docs/development/ux-substrate/screens/words-reads.json", import.meta.url), "utf8"))
  .modules["ai-runs"].reads;
const GONE = word("ai-runs.note.run_either_existed");

test("R54 (words): every key the module reads is held by setup-words and says team, never group", () => {
  assert.ok(READS.length >= 37);
  for (const key of READS) assert.equal(hasWord(key), true, key);
  /* the fences and the stated absences: no group where words.json says the team */
  for (const key of READS) assert.doesNotMatch(word(key, { mode: "m", deployed: "d", are: "are", token_id: "t", why: "w", withheld: "x" }), /\bgroup\b/i, key);
});

async function runWorld(opts = {}) {
  const w = world(opts);
  await w.group("ann"); w.bundle(INQ);
  return w;
}
const mine = { actor: "member:ann", viewer: "member:ann", principalClaude: "member:ann", principalPlane: "member:ann" };

test("R9, R13, R14 (words): the open's, tick's and close's notes are words.json's sentences by key — the refusals the open mints (no context, kind, already open, re-run self, unknown, other context), the tick's (not its principal, ended, figures, state, usage) and the close's (not its principal, already ended)", async () => {
  const w = await runWorld();
  w.bundle("INQ-2026-0002"); w.project(PROJ, "ann");
  const note = (r) => r.note;
  assert.equal(note(await w.runs.open({})), word("ai-runs.note.run_needs_id"));
  assert.equal(note(await w.runs.open(OPEN({ contextType: "inquiry", contextId: PROJ, viewer: "member:ann" }))), word("ai-runs.note.run_context_kind"));
  assert.equal((await w.runs.open(OPEN({ bounds: [{ bound: "fetches", allowed: 5 }] }))).started, true);
  assert.equal(note(await w.runs.open(OPEN())), word("ai-runs.note.run_id_already"));
  assert.equal(note(await w.runs.open(OPEN({ run: "R2", rerunOf: "R2" }))), word("ai-runs.note.run_re_run"));
  assert.equal(note(await w.runs.open(OPEN({ run: "R2", rerunOf: "NOPE" }))), word("ai-runs.note.run_either_existed_purged"));
  assert.equal(note(await w.runs.open(OPEN({ run: "R2", rerunOf: "R1", contextId: "INQ-2026-0002" }))), word("ai-runs.note.re_run_runs"));
  assert.equal(note(await w.runs.open(OPEN({ run: "R2", mode: "plan" }))), word("consequences.nothing"), "a refusal before anything is written");
  /* the tick */
  const tick = (o) => w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: "2026-07-01T00:01:00Z", ...o });
  assert.equal(note(await tick({ caller: "class:ai/other" })), word("ai-runs.note.run_driven_principal"));
  assert.equal(note(await tick({ consume: { fetches: -1 } })), word("ai-runs.note.run_budget_moves"));
  assert.equal(note(await tick({ state: { x: "y".repeat(300000) } })), word("ai-runs.note.run_state_resumable"));
  assert.equal(note(await tick({ usage: {} })), word("ai-runs.note.appended_budget_spent"));
  assert.equal(note(await tick({ usage: [{ mode: "check" }] })), word("ai-runs.note.conversation_figures_calls"));
  assert.equal(note(await w.runs.tick({ run: "NOPE", viewer: "admin", caller: ORG })), word("ai-runs.note.run_either_existed"));
  /* the close */
  assert.equal(note(await w.runs.close({ run: "R1", bound: "completed", viewer: "admin", caller: "class:ai/other" })), word("ai-runs.note.run_ended_principal"));
  assert.equal(note(await w.runs.close({ run: "NOPE", viewer: "admin", caller: ORG })), word("ai-runs.note.run_either_existed"));
  assert.equal((await w.runs.close({ run: "R1", bound: "completed", viewer: "admin", caller: ORG })).terminated, true);
  const again = await w.runs.close({ run: "R1", bound: "completed", viewer: "admin", caller: ORG });
  assert.equal(note(again), word("ai-runs.note.run_already_ended"));
  assert.equal(note(await tick({})), word("ai-runs.note.run_ended_log"));
  /* controls: a successful answer carries none of these notes */
  assert.equal("note" in (await w.runs.read({ run: "R1", viewer: "admin" })), false);
  assert.equal(GONE, word("ai-runs.note.run_either_existed"), "the sentence the key holds is the one tests used to quote");
});

test("R73 (words): a system step the steps module refuses is answered with the key's note, the run not opened", async () => {
  const f = stepsWorld();
  const w = await runWorld({ steps: f.steps });
  const r = await w.runs.open(OPEN({ place: f.place, work: "  " }));
  assert.equal(r.started, false);
  assert.equal(r.note, word("ai-runs.note.run_step_refused"));
  assert.equal(w.count("ai_runs"), 0);
});

test("R73 (words): a run's step end that steps cannot be told of reads steps is not reachable, and one it did not answer reads steps did not answer", async () => {
  for (const [stepEnd, key] of [[undefined, "ai-runs.reason.steps_reachable"], [() => { throw new Error("x"); }, "ai-runs.reason.steps_did_answer"]]) {
    const f = stepsWorld();
    const steps = { ...f.steps, stepEnd };
    const w = await runWorld({ steps });
    assert.equal((await w.runs.open(OPEN({ place: f.place, work: "find the fee schedule" }))).started, true);
    const c = await w.runs.close({ run: "R1", bound: "completed", viewer: "admin", caller: ORG });
    assert.deepEqual([c.terminated, c.step_end.told, c.step_end.reason], [true, false, word(key)]);
  }
});

test("R18 (words): the member dispatch's notes — not its principal, an ended run, a mode not admitted, a keep-away — are words.json's sentences, and the act it names is words.json's", async () => {
  const aw = agentWorker();
  const w = world({ env: { AGENT_WORKER: aw, STORE: { idFromName: (n) => `id:${n}` }, AI_RUN_DISPATCH_WAIT_MS: "50" } });
  await w.group("ann", "bob", { noAccount: ["ann"] });
  await w.signin("ann");
  w.ctx.id = { equals: (x) => x === "id:bio" };
  w.bundle(INQ);
  assert.equal((await w.runs.open(OPEN({ ...mine }))).started, true);
  const other = await w.runs.dispatchMemberRun({ run: "R1", by: "member:bob" });
  assert.equal(other.note, word("ai-runs.note.run_continued_principal"));
  assert.ok(other.detail.includes(word("ai-runs.act.continuing_run")), other.detail);
  const sent = await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann" });
  assert.equal(sent.dispatched, true);
  assert.equal((await w.runs.close({ run: "R1", bound: "completed", viewer: "member:ann", caller: "member:ann", actor: "member:ann" })).terminated, true);
  const ended = await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann" });
  assert.equal(ended.note, word("ai-runs.note.run_ended_later"));
  /* a mint refused: nothing was sent, said by key */
  assert.equal((await w.runs.open(OPEN({ run: "R2", ...mine }))).started, true);
  w.credentials.aiRunCredentialMint = () => ({ ok: false, code: "AI_KEPT_AWAY", check: "C", translation: "t", detail: "d", reason: "AI_KEPT_AWAY" });
  const refused = await w.runs.dispatchMemberRun({ run: "R2", by: "member:ann" });
  assert.equal(refused.note, word("ai-runs.note.sent"));
  /* a dispatch whose call did not complete reads by key */
  const x = world({ env: { AGENT_WORKER: agentWorker("throw"), STORE: { idFromName: (n) => `id:${n}` }, AI_RUN_DISPATCH_WAIT_MS: "50" } });
  await x.group("ann", { noAccount: ["ann"] });
  await x.signin("ann");
  x.ctx.id = { equals: (v) => v === "id:bio" };
  x.bundle(INQ);
  await x.runs.open(OPEN({ ...mine }));
  const d = await x.runs.dispatchMemberRun({ run: "R1", by: "member:ann" });
  assert.deepEqual([d.dispatched, d.dispatch.reason], [false, word("ai-runs.reason.call_did_complete")]);
});

test("R20, R23, R27 (words): the lens block's stated absences, the two halves' fences and a surfacing the reader cannot read are words.json's sentences", async () => {
  const w = await runWorld();
  await w.runs.open(OPEN({ biasManifest: "not json at all", bounds: [{ bound: "surfaces", allowed: 1 }] }));
  assert.equal((await w.runs.read({ run: "R1", viewer: "admin" })).session.bias.stated, word("ai-runs.stated.manifest_recorded_run"));
  w.sql.exec(`UPDATE ai_runs SET lens_at_open = 'not json' WHERE run = 'R1'`);
  assert.equal((await w.runs.read({ run: "R1", viewer: "admin" })).session.bias.at_open.stated, word("ai-runs.stated.lens_force_run"));
  assert.equal((await w.runs.spawnPayload({ run: "R1", half: "search", viewer: "admin" })).fence, word("ai-runs.fence.search_half_receives"));
  assert.equal((await w.runs.spawnPayload({ run: "R1", half: "compose", viewer: "admin" })).fence, word("ai-runs.fence.composing_half_carries"));
  /* a question surfaced under a run the reader cannot read */
  const s = w.surface("INQ-2026-0050");
  assert.equal(s.ok, true, JSON.stringify(s));
  const hidden = await w.runs.surfacedIn("INQ-2026-0050", "who-knows");
  assert.equal(hidden.stated, word("ai-runs.stated.question_opened_inside"));
});

test("R25 (words): an assistant's creation under a run it does not hold is refused with the key's note and the act it names", async () => {
  const w = await runWorld();
  assert.equal((await w.runs.open(OPEN({ bounds: [{ bound: "surfaces", allowed: 2 }] }))).started, true);
  const r = w.surface("INQ-2026-0051", { caller: "class:ai/other" });
  assert.equal(r.ok, false);
  assert.equal(r.note, word("ai-runs.note.assistant_opens_question"));
  assert.ok(r.detail.includes(word("ai-runs.act.opening_question_under")), r.detail);
});
