/* action-plans T46 (T46-39): the pause as the document's own state (R46 (a); N914; record-grammar R58), the look-again
   day read on the place's local day (R46 (b); N928; K1444 (iii)), and the words read by key from words.json (R47;
   DEC-194, N913). Each has its control. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { seeded, opened, V, by, ms } from "./fixture.mjs";
import { ACTION_PLAN_CHECKS, PLAN_WORDS } from "../../../src/action-plans/index.mjs";

const code = (r) => r.code ?? r.reason;
const WORDS = Object.fromEntries(
  JSON.parse(await readFile(new URL("../../../../docs/development/ux-substrate/screens/words.json", import.meta.url), "utf8")).words
    .filter((w) => w && typeof w.key === "string").map((w) => [w.key, w.en]));
const pause = (w, extra = {}) => w.ap.planPause({ id: w.PL, reason: "Waiting on the audit", look_again: "2026-11-01", ...by("bob"), ...extra });
const resume = (w, extra = {}) => w.ap.planResume({ id: w.PL, reason: "The audit is out", ...by("bob"), ...extra });
const states = (w) => (w.fm(w.PL).state_history || []).map((h) => [h.from_state, h.to_state]);
const row = (w) => w.rows(`SELECT state FROM plans WHERE plan_id=?`, w.PL)[0].state;

test("R46 (a): planPause writes paused as the document's current_state and planResume open, each along record-grammar's edge in the act that logs it; a close from paused writes closed; the document, the log and every read agree", () => {
  const w = seeded();
  opened(w);
  const agree = (state) => {
    assert.equal(w.record.head(w.PL).currentState, state, "the record's head");
    assert.equal(w.fm(w.PL).current_state, state, "the document");
    assert.equal(row(w), state, "the projection");
    assert.equal(w.ap.planRead({ id: w.PL, viewer: V("bob") }).state, state, "the read");
  };
  agree("open");
  const logs = () => w.rows(`SELECT kind FROM plan_history WHERE plan_id=? ORDER BY seq`, w.PL).map((r) => r.kind);
  const p = pause(w);
  assert.equal(p.ok, true, JSON.stringify(p));
  agree("paused");
  assert.equal(w.fm(w.PL).prior_state, "open");
  assert.deepEqual(states(w), [["open", "paused"]], "the move is in the document's state_history");
  assert.equal(logs().at(-1), "pause", "in the same act as its Plan Log entry");
  const r = resume(w);
  assert.equal(r.ok, true, JSON.stringify(r));
  agree("open");
  assert.equal(w.fm(w.PL).prior_state, "paused");
  assert.deepEqual(states(w), [["open", "paused"], ["paused", "open"]]);
  assert.equal(pause(w).ok, true);
  const c = w.ap.planClose({ id: w.PL, reason: "Done", ...by("bob") });
  assert.equal(c.ok, true, JSON.stringify(c));
  agree("closed");
  assert.deepEqual(states(w), [["open", "paused"], ["paused", "open"], ["open", "paused"], ["paused", "closed"]]);
  /* control: a refused pause or resume moves nothing, in the document or the log */
  const w2 = seeded();
  opened(w2);
  const before = w2.text(w2.PL);
  assert.equal(code(resume(w2)), "PLAN_NOT_PAUSED");
  assert.equal(code(pause(w2, { reason: "" })), "PLAN_NO_REASON");
  assert.equal(w2.text(w2.PL), before);
  assert.equal(w2.record.head(w2.PL).currentState, "open");
  /* control: an act that is no pause or resume leaves the state where it stands */
  assert.equal(pause(w2).ok, true);
  assert.equal(w2.ap.optionAdd({ plan: w2.PL, summary: "While paused", category: "other", subjects: [w2.S1], ...by("bob") }).ok, true);
  assert.equal(w2.record.head(w2.PL).currentState, "paused");
  assert.deepEqual(states(w2), [["open", "paused"]]);
});

test("R46 (b): plansToLookAgain answers a look_again day on the local day of nowMs in the place's zone, never the UTC day: begun locally but not in UTC, and begun in UTC but not locally; with no zone held no plan is answered due", () => {
  /* the test profile's zone, America/Halifax: on 1 November 2026, local midnight is 03:00 UTC */
  const w = seeded();
  opened(w);
  assert.equal(pause(w).ok, true);
  const look = (iso) => w.ap.plansToLookAgain({ nowMs: ms(iso) });
  const early = look("2026-11-01T02:30:00Z");
  assert.deepEqual(early.items, [], "begun in UTC, not yet in the plan's zone");
  assert.equal(early.day, "2026-10-31");
  const due = look("2026-11-01T03:00:00Z");
  assert.equal(due.day, "2026-11-01");
  assert.deepEqual(due.items.map((i) => [i.plan, i.look_again]), [[w.PL, "2026-11-01"]], "control: the local day has begun");
  /* the reverse: a zone ahead of UTC (the place's view as actions R68 answers it) */
  w.record.setSetting("team_time_zone", "Asia/Tokyo", "test");   /* the team's stated zone governs (K5292) */
  const ahead = look("2026-10-31T15:00:00Z");
  assert.equal(ahead.day, "2026-11-01");
  assert.deepEqual(ahead.items.map((i) => i.plan), [w.PL], "begun in the plan's zone, not yet in UTC");
  assert.deepEqual(look("2026-10-31T14:59:59Z").items, [], "control: a second before local midnight");
  /* no zone held: the day is undetermined and nothing is answered due, however late */
  w.record.setSetting("team_time_zone", "", "test"); w.record.setSetting("jurisdiction_profiles", [], "test"); w.actions.place = () => null;
  const none = look("2027-06-01T12:00:00Z");
  assert.deepEqual(none.items, []);
  assert.equal(none.day.state, "undetermined");
  const w2 = seeded({ profiles: null });
  opened(w2);
  assert.equal(pause(w2).ok, true);
  assert.deepEqual(w2.ap.plansToLookAgain({ nowMs: ms("2027-06-01T12:00:00Z") }).items, [], "no profile, no zone");
});

test("R47: C-124.30 and C-124.58–.62 take their translations from words.json's refusal.<CODE>, read by key, answered so at the interface; codes, numbers and wheres unmoved; a row words.json does not hold keeps its own (control); C-124.63's words are R49's (T47) and tested there", () => {
  const rows = { SCENARIO_OUT_OF_RANGE: "C-124.30", NO_SUCH_SCENARIO: "C-124.58", SCENARIO_ALREADY_SET_ASIDE: "C-124.59",
                 SCENARIO_NOT_SET_ASIDE: "C-124.60", PLAN_NOT_OPEN: "C-124.61", PLAN_NOT_PAUSED: "C-124.62",
                 PLAN_NO_TITLE: "C-124.2" };
  for (const [c, check] of Object.entries(rows)) {
    assert.equal(typeof WORDS[`refusal.${c}`], "string", `words.json holds refusal.${c}`);
    assert.equal(PLAN_WORDS[`refusal.${c}`], WORDS[`refusal.${c}`], `${c}: held by key, verbatim`);
    assert.equal(ACTION_PLAN_CHECKS[c].translation, WORDS[`refusal.${c}`], c);
    assert.equal(ACTION_PLAN_CHECKS[c].check, check, c);
  }
  /* every key held is words.json's, verbatim */
  for (const [k, en] of Object.entries(PLAN_WORDS)) assert.equal(en, WORDS[k], k);
  /* answered so at the interface */
  const w = seeded();
  opened(w);
  const phases = [{ id: "p", name: "P", options: [], starts: "plan_start" }];
  assert.equal(w.ap.scenarioSet({ plan: w.PL, scenario: 1, name: "S", phases, ...by("bob") }).ok, true);
  const said = {
    PLAN_NO_TITLE: w.ap.planOpen({ project: w.P, subjects: [w.S1], title: "", ...by("bob") }),
    SCENARIO_OUT_OF_RANGE: w.ap.scenarioSet({ plan: w.PL, scenario: 0, name: "S", phases, ...by("bob") }),
    NO_SUCH_SCENARIO: w.ap.scenarioSetAside({ plan: w.PL, scenario: 9, reason: "r", ...by("bob") }),
    SCENARIO_NOT_SET_ASIDE: w.ap.scenarioRestore({ plan: w.PL, scenario: 1, reason: "r", ...by("bob") }),
    PLAN_NOT_PAUSED: resume(w),
  };
  assert.equal(w.ap.scenarioSetAside({ plan: w.PL, scenario: 1, reason: "r", ...by("bob") }).ok, true);
  said.SCENARIO_ALREADY_SET_ASIDE = w.ap.scenarioSetAside({ plan: w.PL, scenario: 1, reason: "r", ...by("bob") });
  assert.equal(pause(w).ok, true);
  said.PLAN_NOT_OPEN = pause(w);
  for (const [c, r] of Object.entries(said)) {
    assert.equal(code(r), c);
    assert.deepEqual([r.check, r.translation], [rows[c], WORDS[`refusal.${c}`]], c);
    assert.match(r.where ?? ACTION_PLAN_CHECKS[c].where, /^src\/action-plans\/index\.mjs /);
  }
  /* T50-47 (K3736): C-124.2 PLAN_NO_TITLE reads refusal.PLAN_NO_TITLE by key too (DEC-260), answered above. */
  assert.equal(PLAN_WORDS["refusal.PLAN_NO_TITLE"], WORDS["refusal.PLAN_NO_TITLE"], "PLAN_NO_TITLE held by key, verbatim");
  assert.equal(ACTION_PLAN_CHECKS.PLAN_NO_TITLE.translation, WORDS["refusal.PLAN_NO_TITLE"]);
  /* control (R47): every code this module mints has a words.json row, so none keeps its own text, but ADDRESSEE_INCOMPLETE
     (R54, T51): a code the design has no row for yet, which keeps its own `localize`d sentence and is reported to BOB;
     SUBJECT_MALFORMED reads its row by key (T51, action-plans words check, K3949) and PLAN_WORDS, which holds only R47's
     rows, does not carry it */
  const NO_ROW_YET = ["ADDRESSEE_INCOMPLETE", "PLAN_PRODUCED_BY_MALFORMED"];
  for (const c of Object.keys(ACTION_PLAN_CHECKS)) assert.ok(`refusal.${c}` in WORDS || NO_ROW_YET.includes(c), c);
  assert.equal(ACTION_PLAN_CHECKS.SUBJECT_MALFORMED.translation, WORDS["refusal.SUBJECT_MALFORMED"]);
  assert.equal("refusal.SUBJECT_MALFORMED" in PLAN_WORDS, false);
});

test("R47 R20: the closing note is prompted with the key plan.close.lessons and words.json's words for it, read by key; a closed plan asks for none (control)", () => {
  const w = seeded();
  opened(w);
  assert.equal(typeof WORDS["plan.close.lessons"], "string");
  assert.deepEqual(w.ap.planRead({ id: w.PL, viewer: V("bob") }).close_note_prompt, { key: "plan.close.lessons", en: WORDS["plan.close.lessons"] });
  assert.equal(pause(w).ok, true);
  assert.equal(w.ap.planRead({ id: w.PL, viewer: V("bob") }).close_note_prompt.key, "plan.close.lessons", "a paused plan may be closed");
  assert.equal(w.ap.planClose({ id: w.PL, reason: "Done", note: "Ask sooner", ...by("bob") }).ok, true);
  assert.equal("close_note_prompt" in w.ap.planRead({ id: w.PL, viewer: V("bob") }), false);
});
