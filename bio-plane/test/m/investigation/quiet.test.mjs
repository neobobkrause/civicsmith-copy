/* investigation R17–R19: when the work goes quiet, the prompt once per quiet spell and the members' doors, and the
   project page's standing read. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, projectMd, ANN, BOB, DAN, OUT, AI, P1, P2, PH, Q1, Q2 } from "./fixture.mjs";
import { word } from "../../../src/setup-words/index.mjs";

test("R17: quietState is quiet when every step of the project and its questions is ended or set aside and nothing is awaited; a display, never a stage", () => {
  const w = world();
  const q = () => w.inv.quietState({ project: P1, viewer: ANN });
  assert.deepEqual([q().quiet, q().why], [false, word("investigation.why.step_taken")]);
  const a = w.step();                                                    /* on Q1 */
  const b = w.step({ place: { project: P1 }, work: "Project work" });
  const c = w.step({ place: { questions: [Q2] }, work: "On Q2", by: BOB });
  assert.equal(q().quiet, false);
  w.end(a); w.end(b, "set_aside");
  assert.deepEqual([q().quiet, q().why], [false, word("investigation.why.step_open")]);
  w.end(c, "ended", BOB);
  assert.deepEqual([q().quiet, q().display, q().stage], [true, "quiet", null]);
  /* a dated wait on a question awaited: not quiet; ended: quiet */
  w.dated.set(Q1, [{ index: 0, text: "the reply", date: "2026-11-01", state: "waiting" }]);
  assert.deepEqual([q().quiet, q().why], [false, word("investigation.why.dated_wait_awaited")]);
  w.dated.set(Q1, [{ index: 0, text: "the reply", date: "2026-11-01", state: "ended" }]);
  assert.equal(q().quiet, true);
  /* an open capture request: not quiet */
  w.requests.set(`${Q2}|requested`, [{ request: "r1" }]);
  assert.deepEqual([q().quiet, q().why], [false, word("investigation.why.capture_request_open")]);
  w.requests.clear();
  /* a step another project placed on a question this project draws on counts too, whoever can see it */
  const d = w.step({ place: { questions: [Q2] }, work: "Another project's step", project: P2, by: BOB });
  assert.equal(q().quiet, false);
  w.end(d, "ended", BOB);
  assert.equal(q().quiet, true);
  /* a step reopened (planned again): not quiet */
  w.steps.stepStart({ step: a, by: ANN });
  assert.equal(q().quiet, false);
  /* sight */
  assert.equal(w.inv.quietState({ project: P1, viewer: DAN }).code, "PROJECT_SEEN_NOT_A_PARTICIPANT");
  assert.equal(w.inv.quietState({ project: PH, viewer: ANN }).code, "NO_SUCH_PROJECT");
});

/* a world whose P1 has gone quiet */
function quietWorld() {
  const w = world();
  w.end(w.step());
  w.gapsOf.set(P1, [{ key: "intent::g1", basis: { says: "the vote record is to be requested" } }]);
  w.progress.set(P1, { ok: true, project: P1, objective: "Know whether the award was proper", computable: true,
                       condition: { progression: "PRG-1", required: { grade: "B" }, satisfied: { share: 100 } }, satisfied: false,
                       matched: 2, meeting: 1, short: [], undetermined: [] });
  return w;
}

test("R18: quietPrompts answers once per quiet spell to the joined participants: the objective, its condition, progress and gaps, and the doors; nothing more is asked in that spell", () => {
  const w = quietWorld();
  const at = "2026-10-10T00:00:00Z";
  const ann = w.inv.quietPrompts({ viewer: ANN, at }).prompts;
  assert.equal(ann.length, 1);
  assert.deepEqual([ann[0].project, ann[0].objective, ann[0].condition.required.grade, ann[0].gaps[0].key], [P1, "Know whether the award was proper", "B", "intent::g1"]);
  assert.deepEqual(ann[0].doors, ["watch", "close_with_gaps", "revise_objective"]);
  assert.equal(ann[0].progress.satisfied, false);
  const bob = w.inv.quietPrompts({ viewer: BOB, at }).prompts;
  assert.equal(bob[0].key, ann[0].key, "one spell, one key");
  assert.deepEqual(w.inv.quietPrompts({ viewer: OUT, at }).prompts, [], "an invited participant is not prompted");
  assert.deepEqual(w.inv.quietPrompts({ viewer: DAN, at }).prompts, []);
  assert.deepEqual(w.inv.quietPrompts({ viewer: AI, at }).prompts, []);
  /* satisfied: the door is writing up and acting; no member act declares it met */
  w.progress.set(P1, { ...w.progress.get(P1), satisfied: true });
  assert.deepEqual(w.inv.quietPrompts({ viewer: ANN, at }).prompts[0].doors, ["write_up_and_act"]);
  w.progress.set(P1, { ...w.progress.get(P1), satisfied: false });
  assert.equal(Object.getOwnPropertyNames(Object.getPrototypeOf(w.inv)).some((n) => /declare|markMet|objectiveMet/i.test(n)), false);
  /* a door taken: nothing more in that spell */
  assert.equal(w.inv.projectWatch({ project: P1, by: AI }).code, "INVESTIGATION_MEMBER_ONLY");
  assert.equal(w.inv.projectWatch({ project: P1, by: OUT }).code, "PROJECT_ACT_NOT_A_PARTICIPANT");
  assert.equal(w.inv.projectWatch({ project: P1, by: BOB }).ok, true);
  assert.deepEqual(w.inv.quietPrompts({ viewer: ANN, at }).prompts, []);
  const watched = w.inv.watchedProjects().projects;
  assert.deepEqual(watched.map((p) => [p.project, p.watch.entities[0]]), [[P1, `ENT-for-${P1}`]], "monitoring reads what intent R7 names");
  /* the work resumes, then goes quiet again: a new spell, a new prompt */
  const s = w.step({ work: "Something arrived" });
  assert.deepEqual(w.inv.quietPrompts({ viewer: ANN, at }).prompts, []);
  w.end(s);
  const again = w.inv.quietPrompts({ viewer: ANN, at }).prompts;
  assert.equal(again.length, 1);
  assert.notEqual(again[0].key, ann[0].key);
  /* a door on a project that is not quiet is refused */
  w.step({ work: "Open again" });
  assert.equal(w.inv.projectWatch({ project: P1, by: ANN }).code, "QUIET_NOT_QUIET");
});

test("R18: projectCloseWithGaps closes the project with its closed_reason (intent R29), the gaps read at the act kept beside it", () => {
  const w = quietWorld();
  /* P1 as a document the record holds, so its close is a revision through promotion */
  const made = w.promotion.promote({ base: null, snapKey: "k-p", author: ANN, meta: { object_type: "project" },
                                     files: [{ path: "bundle.md", text: projectMd(null, "The Closing Project").split("\n").filter((l) => !l.startsWith("id:")).join("\n") }] });
  assert.equal(made.ok, true, JSON.stringify(made));
  const P = made.bundleId;
  w.st.sql.exec(`INSERT OR REPLACE INTO project_sight (project_id, setting) VALUES (?, 'discoverable')`, P);
  w.participant(P, "ann", { owner: true }); w.participant(P, "bob");
  w.drawn.set(P, [{ inquiry: Q1 }]);
  w.gapsOf.set(P, [{ key: "intent::g9", basis: { says: "the vote record is to be requested" } }]);
  const before = w.snapshot();
  assert.equal(w.inv.projectCloseWithGaps({ project: P, reason: "done", by: ANN }).code, "CLOSE_BAD_REASON");
  assert.equal(w.inv.projectCloseWithGaps({ project: P, reason: "abandoned", by: AI }).code, "INVESTIGATION_MEMBER_ONLY");
  assert.equal(w.inv.projectCloseWithGaps({ project: P, reason: "abandoned", by: DAN }).code, "PROJECT_SEEN_NOT_A_PARTICIPANT");
  w.step({ work: "still open", place: { project: P } });
  assert.equal(w.inv.projectCloseWithGaps({ project: P, reason: "abandoned", by: ANN }).code, "QUIET_NOT_QUIET");
  assert.equal(w.snapshot(), before);
  for (const s of w.steps.stepsIn({ project: P, viewer: ANN }).steps) w.end(s.step);
  /* promotion's own rule stands: closing as abandoned is an owner's act; nothing is written when it refuses */
  const mid = w.snapshot();
  assert.equal(w.inv.projectCloseWithGaps({ project: P, reason: "abandoned", by: BOB }).reason, "NOT_THE_OWNER");
  assert.equal(w.snapshot(), mid);
  assert.equal(w.record.head(P).currentState, "forming");
  const r = w.inv.projectCloseWithGaps({ project: P, reason: "abandoned", note: "Nothing is left to try.", by: ANN });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.gaps.map((g) => g.key), ["intent::g9"]);
  const head = w.record.head(P);
  assert.deepEqual([head.currentState, head.priorState], ["closed", "forming"]);
  const text = w.record.readFile(P, "bundle.md").text;
  assert.match(text, /closed_reason: abandoned/);
  assert.match(text, /to_state: closed/);
  const act = w.rows(`SELECT * FROM inv_quiet_acts WHERE project_id = ? AND act = 'close'`, P)[0];
  assert.deepEqual(JSON.parse(act.gaps_json).gaps.map((g) => g.key), ["intent::g9"], "kept beside the close as what remains unknown");
  assert.equal(act.closed_reason, "abandoned");
});

test("R19: projectStanding answers the objective and condition, progress (or that it cannot be computed), each question's legs grouped for and against with this project's conclusion beside the bar, and the gaps; no score, no member's share", () => {
  const w = quietWorld();
  w.leg(Q1, 0, Q2, "supports", "B");
  w.leg(Q1, 1, "INQ-2026-0003-c", "cuts_against", "C");
  w.bundle("INFO-2026-0005-x", { type: "information", project: PH });
  w.leg(Q1, 2, "INFO-2026-0005-x", "supports", "A");                    /* one Ann may not see */
  w.conclusions.set(`${P1}|${Q1}`, [{ act: "concluded", state: "concluded", claim: "It was proper.", at: "2026-10-09T17:00:00Z" }]);
  const r = w.inv.projectStanding({ project: P1, viewer: ANN });
  assert.equal(r.ok, true);
  assert.deepEqual([r.objective, r.condition.required.grade, r.progress.satisfied], ["Know whether the award was proper", "B", false]);
  const q1 = r.questions.find((q) => q.question === Q1);
  assert.deepEqual(q1.legs.supporting.map((l) => l.target), [Q2]);
  assert.deepEqual(q1.legs.cutting_against.map((l) => l.target), ["INQ-2026-0003-c"]);
  assert.deepEqual([q1.conclusion.state, q1.conclusion.claim, q1.bar], ["concluded", "It was proper.", "B"]);
  assert.equal(r.questions.find((q) => q.question === Q2).conclusion, null);
  assert.deepEqual(r.gaps.map((g) => g.key), ["intent::g1"]);
  const words = JSON.stringify(r);
  assert.equal(/"(score|rating|percent|share_of|per_member|by_member|contribution)"/.test(words), false);
  assert.equal(/ann-h|bob-h/.test(words), false, "no member is named");
  /* no condition: progress cannot be computed, never zero */
  w.progress.delete(P1);
  const n = w.inv.projectStanding({ project: P1, viewer: ANN });
  assert.equal(n.progress.computable, false);
  assert.match(n.progress.why, /cannot be computed/);
  assert.equal(n.questions[0].bar, null);
  assert.equal(w.inv.projectStanding({ project: P1, viewer: DAN }).code, "PROJECT_SEEN_NOT_A_PARTICIPANT");
  assert.equal(w.inv.projectStanding({ project: PH, viewer: ANN }).code, "NO_SUCH_PROJECT");
});

test("R18: watchArrival (K2524), for monitoring: something new from a watched project's source reopens its work, so a later quiet spell prompts again; answered with the project's reads; a project not watched is refused, writing nothing", () => {
  const w = quietWorld();
  const at = "2026-10-10T00:00:00Z";
  const first = w.inv.quietPrompts({ viewer: ANN, at }).prompts[0];
  /* the negative control: not watched, refused, nothing written */
  const before = w.snapshot();
  assert.equal(w.inv.watchArrival({ project: P1, source: "https://example.org/agenda", at }).code, "PROJECT_NOT_WATCHED");
  assert.equal(w.inv.watchArrival({ project: "PROJ-2026-0099", source: "s", at }).code, "PROJECT_NOT_WATCHED");
  assert.equal(w.snapshot(), before);
  w.inv.projectWatch({ project: P1, by: ANN });
  assert.equal(w.inv.watchArrival({ project: P1, source: "", at }).code, "ARRIVAL_BAD");
  assert.equal(w.inv.watchArrival({ project: P1, source: "s", at: "today" }).code, "ARRIVAL_BAD");
  assert.equal(w.inv.watchArrival({ project: P2, source: "s", at }).code, "PROJECT_NOT_WATCHED", "another project, not watched");
  assert.equal(w.inv.quietState({ project: P1, viewer: ANN }).quiet, true);
  const r = w.inv.watchArrival({ project: P1, source: "https://example.org/agenda", at });
  assert.deepEqual([r.ok, r.reopened, r.arrival.source], [true, true, "https://example.org/agenda"]);
  assert.deepEqual([r.reads.quiet.quiet, r.reads.quiet.why], [false, word("investigation.why.something_arrived_watched")], "the work reads reopened");
  assert.equal(r.reads.standing.ok, true);
  assert.equal(r.reads.milestones.ok, true);
  assert.equal(w.inv.quietState({ project: P1, viewer: ANN }).quiet, false);
  assert.deepEqual(w.inv.quietPrompts({ viewer: ANN, at }).prompts, []);
  /* the members take it up, and the work goes quiet again: a new spell prompts again */
  const s = w.step({ work: "Read the new agenda" });
  w.end(s);
  const again = w.inv.quietPrompts({ viewer: ANN, at }).prompts;
  assert.equal(again.length, 1);
  assert.notEqual(again[0].key, first.key);
  /* a second member choosing to watch keeps it one watched project */
  w.inv.projectWatch({ project: P1, by: BOB });
  assert.equal(w.inv.watchedProjects().projects.length, 1);
});

test("R18 (T42, N846): watchArrival never throws once the arrival is written: each read is taken after the write and one that fails answers {unread}; a refusal or a failure before the write records nothing", () => {
  const w = quietWorld();
  const at = "2026-10-10T00:00:00Z";
  w.inv.projectWatch({ project: P1, by: ANN });
  const arrivals = () => w.rows(`SELECT COUNT(*) AS n FROM inv_watch_arrivals`)[0].n;
  /* a read that fails: intent's progress throws, so projectStanding throws */
  const progress = w.intent.progress;
  w.intent.progress = () => { throw new Error("intent is down"); };
  let r;
  assert.doesNotThrow(() => { r = w.inv.watchArrival({ project: P1, source: "https://example.org/agenda", at }); });
  assert.deepEqual([r.ok, r.reopened, arrivals()], [true, true, 1], "the arrival is recorded and answered ok");
  assert.deepEqual(r.reads.standing, { unread: "intent is down" }, "the failed read is marked unread in its place");
  assert.deepEqual([r.reads.quiet.ok, r.reads.quiet.quiet, r.reads.quiet.why], [true, false, word("investigation.why.something_arrived_watched")], "read after the write");
  assert.equal(r.reads.milestones.ok, true);
  assert.equal(r.reads.quiet.unread, undefined, "the negative control: a read that did not fail is never marked unread");
  w.intent.progress = progress;
  /* every read failing still answers ok, the arrival kept */
  /* storage failing for the reads only, armed once the arrival's insert has run */
  const exec = w.st.sql.exec;
  let armed = false;
  const before2 = arrivals();
  w.st.sql.exec = (q, ...a) => { if (/INSERT INTO inv_watch_arrivals/.test(q)) { const out = exec.call(w.st.sql, q, ...a); armed = true; return out; }
                                 if (armed && /FROM inv_milestones|FROM inv_watch_arrivals WHERE project_id/.test(q)) throw new Error("storage hiccup");
                                 return exec.call(w.st.sql, q, ...a); };
  let r2;
  assert.doesNotThrow(() => { r2 = w.inv.watchArrival({ project: P1, source: "https://example.org/minutes", at }); });
  w.st.sql.exec = exec;
  assert.equal(r2.ok, true);
  assert.equal(arrivals(), before2 + 1, "recorded");
  assert.deepEqual(r2.reads.quiet, { unread: "storage hiccup" });
  assert.deepEqual(Object.keys(r2.reads.milestones), ["unread"], "milestonesOf's failed read, never answered as the project's absence");
  /* a failure before the write records nothing: the insert itself fails, and the answer is not ok */
  const mid = w.snapshot();
  w.st.sql.exec = (q, ...a) => { if (/INSERT INTO inv_watch_arrivals/.test(q)) throw new Error("disk full"); return exec.call(w.st.sql, q, ...a); };
  let r3 = null;
  try { r3 = w.inv.watchArrival({ project: P1, source: "https://example.org/late", at }); } catch { r3 = null; }
  w.st.sql.exec = exec;
  assert.notEqual(r3 && r3.ok, true);
  assert.equal(w.snapshot(), mid, "nothing recorded");
  /* a refusal records nothing (the negative control: an unwatched project) */
  assert.equal(w.inv.watchArrival({ project: P2, source: "s", at }).code, "PROJECT_NOT_WATCHED");
  assert.equal(w.inv.watchArrival({ project: P1, source: "", at }).code, "ARRIVAL_BAD");
  assert.equal(w.snapshot(), mid);
});

test("R18 (T42, N846): watchedProjects carries every source intent R7 names for a watched project, following its cursor to the end; a project whose sources cannot be read whole answers watch: null with watch_unread, never a partial set", () => {
  const w = quietWorld();
  w.inv.projectWatch({ project: P1, by: ANN });
  const pages = { "": { captures: ["c1", "c2"], cursor: "c2" }, c2: { captures: ["c3", "c4"], cursor: "c4" }, c4: { captures: ["c5"], cursor: null } };
  const asked = [];
  w.intent.watchSet = ({ project, after }) => {
    asked.push(after);
    const p = pages[after ?? ""];
    if (!p) throw new Error(`no page after ${after}`);
    return { entities: [`ENT-for-${project}`], progressions: ["PRG-1"], captures: p.captures, limit: 2, truncated: p.cursor !== null, cursor: p.cursor };
  };
  const one = w.inv.watchedProjects().projects;
  assert.equal(one.length, 1);
  assert.deepEqual(one[0].watch, { entities: [`ENT-for-${P1}`], progressions: ["PRG-1"], captures: ["c1", "c2", "c3", "c4", "c5"], truncated: false, cursor: null },
    "every page, never the first alone");
  assert.deepEqual(asked, [null, "c2", "c4"]);
  assert.equal(one[0].watch_unread, undefined);
  /* the negative control: a page 2 that fails is not answered as a whole set of page 1 */
  pages.c2 = null;
  const two = w.inv.watchedProjects().projects;
  assert.deepEqual([two[0].project, two[0].watch], [P1, null]);
  assert.match(two[0].watch_unread, /could not be read/);
  /* a page that is not R7's shape, a cursor that does not move, and a measure intent cut are each unread too */
  pages.c2 = { captures: ["c3"], cursor: "c2" };
  assert.equal(w.inv.watchedProjects().projects[0].watch, null, "a cursor that repeats");
  w.intent.watchSet = () => ({ entities: [], progressions: [], captures: "c1" });
  assert.equal(w.inv.watchedProjects().projects[0].watch, null, "not R7's shape");
  w.intent.watchSet = () => ({ entities: ["E"], progressions: ["P"], captures: [], truncated: false, cursor: null, measure_truncated: true });
  assert.match(w.inv.watchedProjects().projects[0].watch_unread, /measure/);
  /* one page and no condition: whole */
  w.intent.watchSet = () => ({ entities: [], progressions: [], captures: [], limit: 1000, truncated: false, cursor: null });
  assert.deepEqual(w.inv.watchedProjects().projects[0].watch, { entities: [], progressions: [], captures: [], truncated: false, cursor: null });
});
