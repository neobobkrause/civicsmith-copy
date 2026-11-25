/* calibration: the store half (R4–R17), requirement-named tests at the module's interface
   (build/requirements/calibration.md). Each test names the requirement ids it checks in its title. The module runs
   over `storage.mjs`, a Durable Object storage stand-in on node:sqlite, with record-core's real instance on it and
   the module's clock injected; a fresh storage per test. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { recordOf } from "../../../src/record-core/index.mjs";
import { listenerRefusal, MODULE_ORDER } from "../../../src/membership/index.mjs";
import { calibrationOf, calibrationOps, checkCalibration, CALIBRATION_CHECKS, CALIBRATION_CADENCE_MS,
         CALIBRATION_LIMIT_DEFAULT, CALIBRATION_LIMIT_MAX, DRIFT } from "../../../src/calibration/index.mjs";
import { storage, dump } from "./storage.mjs";

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.UTC(2026, 8, 1);
const CAL_TABLES = ["calibrations", "calibration_subjects", "calibration_signals"];
const OTHERS = ["bundles", "files", "history", "leases", "manifest", "minted_ids", "readings", "seq", "settings"];

function fresh(deps = {}) {
  const s = storage();
  const clock = { t: T0 };
  const c = calibrationOf({ storage: s }, { now: () => clock.t, ...deps });
  return { s, c, clock, rows: (q, ...a) => s.db.prepare(q).all(...a) };
}
const probe = (over = {}) => ({ engine: "pdfjs", version: "4.0", at: "2026-09-01T00:00:00Z", cap: "B",
  probe_id: "P-1", probe_inputs: { corpus: "c1" }, scores: { cer: 0.02 }, ...over });
const WHO = { principal: "member:m1" };
const rec = (c, over, who = WHO) => c.calibrationRecord(probe(over), who);

function refused(r, code) {
  assert.ok(r && r.ok === false, `refused ${code}: ${JSON.stringify(r)}`);
  assert.equal(r.reason, code);
  assert.equal(r.code, code);
  assert.equal(r.check, CALIBRATION_CHECKS[code].check);
  assert.equal(r.translation, CALIBRATION_CHECKS[code].translation);
}

/* ------------------------------------------------------------------ R4, R5 */

test("R4: calibrationRecord mints CAL-<n>, supersedes the live one with R2's verdict, and answers the record", () => {
  const { c, rows, clock } = fresh();
  const a = rec(c, { cap: "B" });
  assert.equal(a.ok, true);
  assert.equal(a.calibration_id, "CAL-1");
  assert.equal(a.supersedes, null);
  assert.equal(a.drift.verdict, DRIFT.SAME);
  assert.equal(a.regraded, 0);
  assert.equal(a.engine, "pdfjs"); assert.equal(a.version, "4.0"); assert.equal(a.cap, "B");
  clock.t = T0 + DAY;
  const b = rec(c, { cap: "C", at: "2026-09-02T00:00:00Z" });
  assert.equal(b.calibration_id, "CAL-2");
  assert.equal(b.supersedes, "CAL-1");
  assert.equal(b.drift.verdict, DRIFT.WORSE);
  assert.equal(b.drift.regrades, false);
  assert.equal(b.regraded, 0);
  const old = rows(`SELECT replaced_by, drift FROM calibrations WHERE calibration_id='CAL-1'`)[0];
  assert.deepEqual({ ...old }, { replaced_by: "CAL-2", drift: "worse" });
  const d = rec(c, { cap: "A", at: "2026-09-03T00:00:00Z" });
  assert.equal(d.supersedes, "CAL-2"); assert.equal(d.drift.verdict, DRIFT.BETTER);
  assert.equal(rows(`SELECT drift FROM calibrations WHERE calibration_id='CAL-2'`)[0].drift, "better");
  assert.equal(rows(`SELECT COUNT(*) AS n FROM calibrations WHERE engine='pdfjs' AND replaced_by IS NULL`)[0].n, 1);
  const other = rec(c, { engine: "tesseract", cap: "D" });
  assert.equal(other.supersedes, null, "another engine supersedes nothing");
  assert.equal(other.calibration_id, "CAL-4");
});

test("R4 R1: a body carrying fields the construct does not know is recorded, not refused", () => {
  const { c } = fresh();
  const r = rec(c, { dpi: 300, operator_note: "ran twice", calibration_id: "CAL-77", replaced_by: "CAL-9" });
  assert.equal(r.ok, true);
  assert.equal(r.calibration_id, "CAL-1", "the id is minted, never the body's");
  assert.equal(c.calibrations().calibrations[0].superseded_by, null, "nor is supersession the body's");
});

test("R4: the id is minted from the highest suffix ever used, never a count", () => {
  const { c, s } = fresh();
  s.db.prepare(`INSERT INTO calibrations (calibration_id,engine,version,at,at_ms,cap,probe_id,probe_inputs,scores,measured_by)
                VALUES ('CAL-41','old','1','2026-01-01',1,'B','P','{}','{}','x')`).run();
  s.db.prepare(`INSERT INTO calibrations (calibration_id,engine,version,at,at_ms,cap,probe_id,probe_inputs,scores,measured_by)
                VALUES ('CAL-9','old2','1','2026-01-01',1,'B','P','{}','{}','x')`).run();
  assert.equal(rec(c).calibration_id, "CAL-42", "CAL-41 is higher than CAL-9 though it sorts lower as text");
});

test("R4: the engine's subject is registered or updated with this probe as its last, and its pending signals consumed", async () => {
  const { c, rows, clock } = fresh();
  await c.calibrationSignalRecord({ engine: "pdfjs", source: "notes", probe_by_ms: T0 + 3 * DAY });
  await c.calibrationSignalRecord({ engine: "tesseract", source: "notes" });
  clock.t = T0 + 5 * DAY;
  rec(c, { probe_id: "P-7" });
  const subj = rows(`SELECT * FROM calibration_subjects WHERE engine='pdfjs'`)[0];
  assert.equal(subj.last_probe_ms, T0 + 5 * DAY);
  assert.equal(subj.probe_id, "P-7"); assert.equal(subj.version, "4.0"); assert.equal(subj.enabled, 1);
  assert.deepEqual(rows(`SELECT engine, consumed_at FROM calibration_signals ORDER BY engine`).map((r) => ({ ...r })),
    [{ engine: "pdfjs", consumed_at: "2026-09-01T00:00:00Z" }, { engine: "tesseract", consumed_at: null }]);
  await c.calibrationSubjectRegister({ engine: "ocr", probe_id: "P-2", enabled: false });
  clock.t = T0 + 6 * DAY;
  rec(c, { engine: "ocr", version: "5", probe_id: "P-3" });
  const o = rows(`SELECT * FROM calibration_subjects WHERE engine='ocr'`)[0];
  assert.equal(o.last_probe_ms, T0 + 6 * DAY); assert.equal(o.probe_id, "P-3"); assert.equal(o.version, "5");
});

test("R4 R13 R14: a request to re-grade is refused CAL_CANNOT_REGRADE (C-42.7), and so is every R1 refusal, writing nothing", () => {
  const { s, c } = fresh();
  rec(c);
  const before = dump(s);
  for (const over of [{ regrade: true }, { regrade: false }, { apply_to_transcriptions: ["x"] }, { regrade: null }])
    refused(rec(c, over), "CAL_CANNOT_REGRADE");
  refused(rec(c, { engine: "" }), "CAL_UNNAMED");
  refused(rec(c, { version: undefined }), "CAL_UNNAMED");
  refused(rec(c, { cap: "Z" }), "CAL_SHAPE");
  for (const f of ["probe_id", "probe_inputs", "scores"]) refused(rec(c, { [f]: undefined }), "CAL_NO_PROBE");
  refused(c.calibrationRecord(null, WHO), "CAL_UNNAMED");
  assert.deepEqual(dump(s), before);
});

test("R4 R13: recording writes only the three calibration tables, never a reading, chain or grade", () => {
  const { s, c, clock } = fresh();
  const before = dump(s, OTHERS);
  rec(c, { cap: "A" });
  clock.t += DAY;
  const r = rec(c, { cap: null, at: "2026-09-02" });
  assert.equal(r.drift.verdict, DRIFT.WORSE);
  assert.equal(r.regraded, 0);
  assert.deepEqual(dump(s, OTHERS), before);
});

test("R5 R14: measured_by is the control plane's stamp, never the body's; none is refused CAL_UNATTRIBUTED (C-42.8)", () => {
  const { s, c, rows } = fresh();
  const r = c.calibrationRecord({ ...probe(), at: undefined, measured_by: "someone else" }, { principal: " member:m9 " });
  assert.equal(r.at, new Date(T0).toISOString(), "no stated date is the recording instant");
  assert.equal(r.ok, true);
  assert.equal(r.measured_by, "member:m9");
  assert.equal(rows(`SELECT measured_by FROM calibrations`)[0].measured_by, "member:m9");
  const before = dump(s);
  for (const who of [undefined, {}, { principal: null }, { principal: "" }, { principal: "  " }, { principal: 7 }])
    refused(c.calibrationRecord({ ...probe(), measured_by: "member:m1" }, who), "CAL_UNATTRIBUTED");
  assert.deepEqual(dump(s), before);
});

test("R5: op=calibrate reads the principal from the control plane's identity stamp, never from the body", () => {
  const { c, rows } = fresh();
  const body = { ...probe(), measured_by: "the body" };
  const ops = (q) => calibrationOps(c, new URL(`http://x/calibrate${q}`), body);
  refused(ops("").calibrate(), "CAL_UNATTRIBUTED");
  refused(ops("?measured_by=member:m1").calibrate(), "CAL_UNATTRIBUTED");
  const r = ops("?identity=class:probe").calibrate();
  assert.equal(r.ok, true);
  assert.equal(rows(`SELECT measured_by FROM calibrations`)[0].measured_by, "class:probe");
});

/* ------------------------------------------------------------------ R6 */

test("R6 R15: calibrations lists newest first with superseded_by and drift, bounded by limit with truncated measured", () => {
  const { c, clock } = fresh();
  for (let i = 0; i < 5; i++) { clock.t = T0 + i * DAY; rec(c, { cap: ["A", "B", "C", "B", "B"][i], at: `2026-09-0${i + 1}` }); }
  const all = c.calibrations();
  assert.equal(all.ok, true);
  assert.deepEqual(all.calibrations.map((x) => x.calibration_id), ["CAL-5", "CAL-4", "CAL-3", "CAL-2", "CAL-1"]);
  assert.deepEqual(all.calibrations.map((x) => [x.superseded_by, x.drift]),
    [[null, null], ["CAL-5", "same"], ["CAL-4", "better"], ["CAL-3", "worse"], ["CAL-2", "worse"]]);
  assert.deepEqual(all.calibrations[0].probe_inputs, { corpus: "c1" });
  assert.equal(all.calibrations[0].measured_by, "member:m1");
  assert.equal(all.count, 5); assert.equal(all.limit, CALIBRATION_LIMIT_DEFAULT); assert.equal(all.truncated, false);
  const two = c.calibrations({ limit: 2 });
  assert.deepEqual(two.calibrations.map((x) => x.calibration_id), ["CAL-5", "CAL-4"]);
  assert.equal(two.truncated, true); assert.equal(two.limit, 2);
  assert.equal(c.calibrations({ limit: 5 }).truncated, false, "exactly the limit is not truncated");
  assert.equal(c.calibrations({ limit: "3" }).count, 3);
  assert.equal(c.calibrations({ limit: 999999 }).limit, CALIBRATION_LIMIT_MAX);
  assert.equal(CALIBRATION_LIMIT_MAX, 5000);
  for (const l of [0, -4, "x", null]) assert.equal(c.calibrations({ limit: l }).limit, CALIBRATION_LIMIT_DEFAULT);
  clock.t += DAY; rec(c, { engine: "tesseract" });
  const t = c.calibrations({ engine: "tesseract" });
  assert.equal(t.engine, "tesseract");
  assert.deepEqual(t.calibrations.map((x) => x.engine), ["tesseract"]);
});

test("R6: each calibration's probe inputs and scores are read back as recorded, JSON or text", () => {
  const { c, clock } = fresh();
  const inputs = { corpus: "synthetic", pages: 4, ground_truth_sha: "0".repeat(64) };
  const scores = { char_error_rate: 0.02, minted_digits: 0, pages_scored: 4 };
  rec(c, { probe_inputs: inputs, scores });
  clock.t += DAY;
  rec(c, { engine: "t", probe_inputs: "corpus c9", scores: "cer 0.31" });
  const byEngine = Object.fromEntries(c.calibrations().calibrations.map((x) => [x.engine, x]));
  assert.deepEqual(byEngine.pdfjs.probe_inputs, inputs);
  assert.deepEqual(byEngine.pdfjs.scores, scores);
  assert.equal(byEngine.pdfjs.probe_id, "P-1");
  assert.equal(byEngine.t.probe_inputs, "corpus c9");
  assert.equal(byEngine.t.scores, "cer 0.31");
});

test("R6 R9: an instance that registered nothing has no subject, no calibration and no alarm, and says so with the cadence", () => {
  const { c } = fresh();
  const r = c.calibrations();
  assert.equal(r.ok, true);
  assert.deepEqual([r.subjects.length, r.count, r.calibrations.length, r.truncated], [0, 0, 0, false]);
  assert.equal(r.cadence_ms, CALIBRATION_CADENCE_MS);
  assert.match(r.why, /holds no alarm at all/);
  assert.equal(c.calibrationWake(T0, 250), null);
});

test("R6: op=calibrations reads the engine and the limit from the request", () => {
  const { c, clock } = fresh();
  for (const e of ["a", "b", "b", "b"]) { clock.t += DAY; rec(c, { engine: e, at: new Date(clock.t).toISOString() }); }
  const op = (q) => calibrationOps(c, new URL(`http://x/calibrations${q}`), null).calibrations();
  assert.equal(op("").count, 4);
  const b = op("?engine=b&limit=2");
  assert.equal(b.engine, "b");
  assert.deepEqual(b.calibrations.map((x) => x.calibration_id), ["CAL-4", "CAL-3"]);
  assert.equal(b.truncated, true); assert.equal(b.limit, 2);
  assert.deepEqual(b.subjects.map((x) => x.engine), ["b"]);
});

test("R6 R15: the default limit is 200, cut by reading one more", () => {
  const { c, s } = fresh();
  const ins = s.db.prepare(`INSERT INTO calibrations (calibration_id,engine,version,at,at_ms,cap,probe_id,probe_inputs,scores,measured_by)
                            VALUES (?,?,?,?,?,?,?,?,?,?)`);
  for (let i = 1; i <= 201; i++) ins.run(`CAL-${i}`, `e${i}`, "1", "2026-09-01", i, "B", "P", "{}", "{}", "m");
  const r = c.calibrations();
  assert.equal(r.count, 200); assert.equal(r.truncated, true);
  assert.equal(r.calibrations[0].calibration_id, "CAL-201");
});

test("R6 R3 R15: calibrations names the enabled subjects with each one's next probe over its unconsumed signals, and the cadence", async () => {
  const { c, clock } = fresh();
  await c.calibrationSubjectRegister({ engine: "never", probe_id: "P-0" });
  await c.calibrationSubjectRegister({ engine: "off", probe_id: "P-0", enabled: false });
  rec(c, { engine: "pdfjs" });
  clock.t = T0 + DAY;
  await c.calibrationSignalRecord({ engine: "pdfjs", source: "notes", probe_by_ms: T0 + 4 * DAY });
  const r = c.calibrations();
  assert.equal(r.cadence_ms, CALIBRATION_CADENCE_MS);
  assert.match(r.cadence, /30 day/);
  assert.deepEqual(r.subjects.map((x) => x.engine), ["never", "pdfjs"], "enabled only");
  const [never, pdfjs] = r.subjects;
  assert.equal(never.next_probe.at, 0); assert.equal(never.next_probe.overdue, true);
  assert.equal(pdfjs.next_probe.at, T0 + 4 * DAY); assert.equal(pdfjs.next_probe.from, "signal");
  assert.equal(pdfjs.next_probe.overdue, false);
  assert.equal(r.subjects_truncated, false);
  assert.deepEqual(c.calibrations({ engine: "never" }).subjects.map((x) => x.engine), ["never"]);
  assert.deepEqual(c.calibrations({ limit: 1 }).subjects.map((x) => x.engine), ["never"]);
  assert.equal(c.calibrations({ limit: 1 }).subjects_truncated, true);
  clock.t = T0 + 2 * DAY;
  rec(c, { engine: "pdfjs", at: "2026-09-03" });
  assert.equal(c.calibrations({ engine: "pdfjs" }).subjects[0].next_probe.at, T0 + 2 * DAY + CALIBRATION_CADENCE_MS,
               "a consumed signal accelerates nothing");
});

/* ------------------------------------------------------------------ R7 */

test("R7 R13: calibrationSignalRecord records an accepted signal and answers the subject's next probe, changing no grade", async () => {
  const { s, c, clock, rows } = fresh();
  const none = await c.calibrationSignalRecord({ engine: "pdfjs", source: "vendor blog" });
  assert.equal(none.ok, true);
  assert.equal(none.next_probe, null, "no subject registered for the engine");
  assert.equal(none.changed_grades, 0); assert.equal(none.stood_in_for_probe, false);
  rec(c);
  const cals = dump(s, ["calibrations"]);
  clock.t = T0 + DAY;
  const r = await c.calibrationSignalRecord({ engine: "pdfjs", source: "changelog", probe_by_ms: T0 + 3 * DAY, detail: "v4.1" });
  assert.equal(r.ok, true);
  assert.equal(r.next_probe.at, T0 + 3 * DAY);
  assert.equal(r.changed_grades, 0); assert.equal(r.stood_in_for_probe, false);
  const later = await c.calibrationSignalRecord({ engine: "pdfjs", source: "changelog", probe_by_ms: T0 + 99 * DAY });
  assert.equal(later.next_probe.at, T0 + 3 * DAY, "a later signal pushes nothing out");
  const now = await c.calibrationSignalRecord({ engine: "pdfjs", source: "changelog" });
  assert.equal(now.probe_by_ms, T0 + DAY, "no instant asks for now");
  assert.equal(now.next_probe.at, T0 + DAY);
  assert.equal(rows(`SELECT COUNT(*) AS n FROM calibration_signals`)[0].n, 4, "same-millisecond signals are each kept");
  assert.deepEqual(dump(s, ["calibrations"]), cals, "a signal changes no calibration");
});

test("R7 R3 R14: a signal R3 refuses is refused with its row and writes nothing", async () => {
  const { s, c } = fresh();
  const before = dump(s);
  refused(await c.calibrationSignalRecord({ engine: "pdfjs" }), "CAL_SIGNAL_SHAPE");
  refused(await c.calibrationSignalRecord(null), "CAL_SIGNAL_SHAPE");
  refused(await c.calibrationSignalRecord({ engine: "pdfjs", source: "x", cap: "A" }), "CAL_SIGNAL_CLAIMS_MEASUREMENT");
  refused(await c.calibrationSignalRecord({ engine: "pdfjs", source: "x", scores: { cer: 0 } }), "CAL_SIGNAL_CLAIMS_MEASUREMENT");
  assert.deepEqual(dump(s), before);
});

/* ------------------------------------------------------------------ R8 */

test("R8 R14: calibrationSubjectRegister needs an engine (CAL_SUBJECT_UNNAMED, C-42.9) and a probe (CAL_SUBJECT_NO_PROBE, C-42.10)", async () => {
  const { s, c } = fresh();
  const before = dump(s);
  for (const e of [undefined, "", "  ", 5]) refused(await c.calibrationSubjectRegister({ engine: e, probe_id: "P" }), "CAL_SUBJECT_UNNAMED");
  for (const p of [undefined, "", " ", {}]) refused(await c.calibrationSubjectRegister({ engine: "pdfjs", probe_id: p }), "CAL_SUBJECT_NO_PROBE");
  refused(await c.calibrationSubjectRegister(), "CAL_SUBJECT_UNNAMED");
  assert.deepEqual(dump(s), before);
});

test("R8 R13: registering claims no fidelity, and a never-probed subject is due at once", async () => {
  const { s, c, rows } = fresh();
  const r = await c.calibrationSubjectRegister({ engine: " pdfjs ", probe_id: " P-1 ", version: "4.0" });
  assert.equal(r.ok, true);
  assert.equal(r.engine, "pdfjs"); assert.equal(r.probe_id, "P-1");
  assert.equal(r.measured, false);
  assert.equal(r.enabled, true);
  assert.equal(r.next_probe.at, 0); assert.equal(r.next_probe.from, "never-probed"); assert.equal(r.next_probe.overdue, true);
  assert.equal(r.cadence_ms, CALIBRATION_CADENCE_MS);
  assert.deepEqual(dump(s, ["calibrations", "calibration_signals", ...OTHERS]),
                   dump(storage(), ["calibrations", "calibration_signals", ...OTHERS]), "no measurement written");
  assert.equal(rows(`SELECT last_probe_ms FROM calibration_subjects`)[0].last_probe_ms, null);
  assert.equal((await c.calibrationSubjectRegister({ engine: "pdfjs", probe_id: "P-1", enabled: false })).enabled, false);
});

/* ------------------------------------------------------------------ R9 */

test("R9: calibrationDue counts the subjects due, calibrationWake is null with none enabled, else the earliest", async () => {
  const { c, clock } = fresh();
  assert.equal(c.calibrationDue(T0), 0);
  assert.equal(c.calibrationWake(T0, 250), null);
  await c.calibrationSubjectRegister({ engine: "off", probe_id: "P", enabled: false });
  assert.equal(c.calibrationWake(T0, 250), null, "a disabled subject holds no alarm");
  assert.equal(c.calibrationDue(T0), 0);
  rec(c, { engine: "a" });
  clock.t = T0 + 2 * DAY; rec(c, { engine: "b" });
  const now = T0 + 3 * DAY;
  assert.equal(c.calibrationDue(now), 0);
  assert.equal(c.calibrationWake(now, 250), T0 + CALIBRATION_CADENCE_MS, "the earliest next probe");
  await c.calibrationSignalRecord({ engine: "b", source: "notes", probe_by_ms: T0 + 10 * DAY });
  assert.equal(c.calibrationWake(now, 250), T0 + 10 * DAY);
  await c.calibrationSubjectRegister({ engine: "never", probe_id: "P" });
  assert.equal(c.calibrationDue(now), 1);
  assert.equal(c.calibrationWake(now, 250), now + 250, "a past probe moves to now plus the caller's grace");
  assert.equal(c.calibrationWake(now), now, "no grace given is none");
  assert.equal(c.calibrationDue(T0 + 9 * DAY), 1, "only the never-probed one");
  assert.equal(c.calibrationDue(T0 + 10 * DAY), 2, "b's signal is due");
  assert.equal(c.calibrationDue(T0 + 30 * DAY), 3, "a's cadence is due");
});

test("R9 R13: calibrationTick lists the due subjects and runs no probe and writes no calibration", async () => {
  const { s, c, clock } = fresh();
  rec(c, { engine: "a" });
  await c.calibrationSubjectRegister({ engine: "never", probe_id: "P-9" });
  const before = dump(s);
  const quiet = c.calibrationTick(T0 + DAY);
  assert.deepEqual(quiet.subjects.map((x) => x.engine), ["never"]);
  const t = c.calibrationTick(T0 + 40 * DAY);
  assert.equal(t.due, 2);
  assert.deepEqual(t.subjects.map((x) => [x.engine, x.probe_id, x.from]),
                   [["a", "P-1", "cadence"], ["never", "P-9", "never-probed"]]);
  assert.equal(t.probes_run, 0); assert.equal(t.calibrations_written, 0);
  assert.equal(t.truncated, false);
  assert.deepEqual(dump(s), before);
  clock.t = T0 + 40 * DAY;
  assert.equal(c.calibrationTick(T0 + DAY).due, 1, "the tick reads the instant it is given");
});

/* ------------------------------------------------------------------ R10 */

test("R10: liveCalibration answers the live calibration of an engine at that version, else null", () => {
  const { c, clock } = fresh();
  assert.equal(c.liveCalibration({ engine: "pdfjs", version: "4.0" }), null, "no calibration");
  rec(c, { cap: "B" });
  assert.deepEqual(c.liveCalibration({ engine: "pdfjs", version: "4.0" }),
    { calibration_id: "CAL-1", engine: "pdfjs", version: "4.0", at: "2026-09-01T00:00:00Z", cap: "B",
      measured_by: "member:m1" });
  assert.equal(c.liveCalibration({ engine: "pdfjs", version: "4.1" }), null, "another version");
  clock.t += DAY;
  rec(c, { version: "4.1", cap: null, at: "2026-09-02" });
  assert.equal(c.liveCalibration({ engine: "pdfjs", version: "4.0" }), null, "4.0 is superseded: never the nearest");
  assert.deepEqual(c.liveCalibration({ engine: "pdfjs", version: "4.1" }).calibration_id, "CAL-2");
  assert.equal(c.liveCalibration({ engine: "pdfjs", version: "4.1" }).cap, null);
  assert.equal(c.liveCalibration({ engine: "tesseract", version: "4.1" }), null);
});

test("R10: liveCalibration never throws — a malformed argument or an unreadable store answers null", () => {
  const { s, c } = fresh();
  rec(c);
  assert.equal(c.worseSupersessions(null).limit, CALIBRATION_LIMIT_DEFAULT);
  assert.equal(c.calibrations(null).ok, true);
  for (const a of [undefined, null, {}, { engine: "pdfjs" }, { version: "4.0" }, { engine: "", version: "4.0" },
                   { engine: 1, version: "4.0" }, { engine: "pdfjs", version: 4 }])
    assert.equal(c.liveCalibration(a), null, JSON.stringify(a));
  s.broken = true;
  assert.equal(c.liveCalibration({ engine: "pdfjs", version: "4.0" }), null);
});

/* ------------------------------------------------------------------ R11 */

test("R11: worseSupersessions pairs each calibration superseded as worse with the one that superseded it, in R1's shape", () => {
  const { c, clock } = fresh();
  const caps = ["A", "C", "B", null, "D"];   // CAL-1..5: 1->2 worse, 2->3 better, 3->4 worse, 4->5 better
  for (let i = 0; i < caps.length; i++) { clock.t = T0 + i * DAY; rec(c, { cap: caps[i], at: `2026-09-0${i + 1}` }); }
  clock.t += DAY; rec(c, { engine: "tesseract", cap: "B" }); clock.t += DAY; rec(c, { engine: "tesseract", cap: "B" });
  const r = c.worseSupersessions();
  assert.equal(r.limit, CALIBRATION_LIMIT_DEFAULT); assert.equal(r.truncated, false);
  assert.deepEqual(r.supersessions.map((x) => [x.superseded.calibration_id, x.verdict, x.current.calibration_id]),
                   [["CAL-1", "worse", "CAL-2"], ["CAL-3", "worse", "CAL-4"]]);
  for (const x of r.supersessions) {
    assert.deepEqual(Object.keys(x).sort(), ["current", "superseded", "verdict"], "it names no transcription");
    assert.equal(checkCalibration(x.superseded), null); assert.equal(checkCalibration(x.current), null);
    assert.deepEqual(x.superseded.probe_inputs, { corpus: "c1" });
  }
  assert.equal(r.supersessions[1].current.cap, null);
  const one = c.worseSupersessions({ supersededId: "CAL-3" });
  assert.deepEqual(one.supersessions.map((x) => x.superseded.calibration_id), ["CAL-3"]);
  assert.deepEqual(c.worseSupersessions({ supersededId: "CAL-2" }).supersessions, [], "CAL-2 was superseded as better");
  assert.deepEqual(c.worseSupersessions({ supersededId: "CAL-5" }).supersessions, [], "CAL-5 is live");
  const cut = c.worseSupersessions({ limit: 1 });
  assert.equal(cut.supersessions.length, 1); assert.equal(cut.truncated, true); assert.equal(cut.limit, 1);
  assert.equal(c.worseSupersessions({ limit: 99999 }).limit, CALIBRATION_LIMIT_MAX);
});

test("R11: a supersession whose successor cannot be read is left out", () => {
  const { s, c, clock } = fresh();
  rec(c, { cap: "A" }); clock.t += DAY; rec(c, { cap: "D", at: "2026-09-02" });
  clock.t += DAY; rec(c, { engine: "x", cap: "A" }); clock.t += DAY; rec(c, { engine: "x", cap: "B", at: "2026-09-04" });
  s.db.prepare(`DELETE FROM calibrations WHERE calibration_id='CAL-2'`).run();
  assert.deepEqual(c.worseSupersessions().supersessions.map((x) => x.superseded.calibration_id), ["CAL-3"]);
  assert.equal(c.worseSupersessions({ limit: 1 }).truncated, false, "the bound counts only readable pairs");
});

/* ------------------------------------------------------------------ R12 */

test("R12: with no listener registered, obligations, obligations_raised and obligations_truncated are null and why says so", () => {
  const { c, clock } = fresh();
  rec(c, { cap: "A" }); clock.t += DAY;
  const r = rec(c, { cap: "D", at: "2026-09-02" });
  assert.equal(r.obligations, null); assert.equal(r.obligations_raised, null);
  assert.equal(r.obligations_truncated, null);
  assert.match(r.why, /No module derives obligations/);
});

test("R12: every listener runs after each record, in the modules' total order, and obligations are their concatenation", () => {
  const { c, clock } = fresh({ order: ["calibration", "extraction", "content", "scheduler"] });
  const seen = [];
  assert.deepEqual(c.onCalibration("scheduler", (e) => { seen.push(["scheduler", e]); return [{ from: "scheduler" }]; }),
                   { ok: true, module: "scheduler" });
  c.onCalibration("unlisted", (e) => { seen.push(["unlisted", e]); return null; });
  c.onCalibration("extraction", (e) => { seen.push(["extraction", e]); return e.drift.raises_obligation ? [{ id: 1 }, { id: 2 }] : []; });
  const a = rec(c, { cap: "A" });
  assert.deepEqual(seen.map((x) => x[0]), ["extraction", "scheduler", "unlisted"]);
  assert.deepEqual(seen[0][1], { calibration_id: "CAL-1", engine: "pdfjs", version: "4.0", supersedes: null, drift: a.drift });
  assert.deepEqual(a.obligations, [{ from: "scheduler" }]); assert.equal(a.obligations_raised, 1);
  assert.equal(a.obligations_truncated, false);
  seen.length = 0; clock.t += DAY;
  const b = rec(c, { cap: "C", at: "2026-09-02" });
  assert.equal(seen[0][1].supersedes, "CAL-1"); assert.equal(seen[0][1].drift.verdict, "worse");
  assert.deepEqual(b.obligations, [{ id: 1 }, { id: 2 }, { from: "scheduler" }]);
  assert.equal(b.obligations_raised, 3);
  assert.equal(b.obligations_truncated, false);
});

test("R12: a listener that cut its list short answers {obligations, truncated}, and obligations_truncated says so", () => {
  const { c, clock } = fresh({ order: ["extraction", "content", "scheduler"] });
  const answers = { extraction: null, content: null, scheduler: null };
  for (const m of Object.keys(answers)) c.onCalibration(m, () => answers[m]);
  const run = (a) => { Object.assign(answers, a); clock.t += DAY; return rec(c, { at: new Date(clock.t).toISOString() }); };
  let r = run({ extraction: { obligations: [{ id: 1 }, { id: 2 }], truncated: true }, content: [{ id: 3 }],
                scheduler: { obligations: [{ id: 4 }], truncated: false } });
  assert.deepEqual(r.obligations, [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }], "concatenated in the modules' order");
  assert.equal(r.obligations_raised, 4); assert.equal(r.obligations_truncated, true);
  r = run({ extraction: { obligations: [] }, content: [], scheduler: { obligations: [{ id: 9 }], truncated: true } });
  assert.deepEqual(r.obligations, [{ id: 9 }]); assert.equal(r.obligations_truncated, true, "any listener's cut is carried");
  r = run({ extraction: { obligations: [{ id: 1 }], truncated: false }, content: null, scheduler: [] });
  assert.equal(r.obligations_truncated, false, "no listener cut its list");
  assert.equal(r.obligations_raised, 1);
});

test("R12: a module registers once (LISTENER_DECLARED); a malformed registration is refused, both through membership's listenerRefusal", () => {
  const { c } = fresh();
  assert.equal(c.onCalibration("extraction", () => []).ok, true);
  const again = c.onCalibration("extraction", () => []);
  assert.equal(again.ok, false); assert.equal(again.reason, "LISTENER_DECLARED"); assert.equal(again.module, "extraction");
  assert.deepEqual(again, listenerRefusal([{ module: "extraction" }], "extraction", () => []),
                   "the refusal is membership R81's own, minted at its one site");
  for (const [m, f] of [["", () => []], [null, () => []], [7, () => []], ["x", null], ["x", "fn"], [undefined, undefined]]) {
    const r = c.onCalibration(m, f);
    assert.equal(r.ok, false); assert.equal(r.reason, "LISTENER_MALFORMED");
    assert.deepEqual(r, listenerRefusal([], m, f));
  }
  assert.equal(rec(c).obligations_raised, 0, "the refused registrations run nothing");
});

test("R12: with no order given, listeners run in membership's MODULE_ORDER, unknown modules last in registration order", () => {
  const { c } = fresh();
  const seen = [];
  const late = MODULE_ORDER.filter((m) => MODULE_ORDER.indexOf(m) > MODULE_ORDER.indexOf("calibration")).reverse();
  for (const m of ["unlisted-b", ...late, "unlisted-a"]) c.onCalibration(m, () => { seen.push(m); return []; });
  rec(c);
  assert.deepEqual(seen, [...late.slice().reverse(), "unlisted-b", "unlisted-a"]);
});

test("R12 R4: a listener that throws, or answers anything but a list, fails the whole record", async () => {
  for (const bad of [() => { throw new Error("boom"); }, () => ({ not: "a list" }), () => Promise.resolve([]),
                     () => ({ obligations: "x", truncated: true }), () => ({ obligations: [], truncated: "yes" }), () => 7]) {
    const { s, c, clock } = fresh();
    await c.calibrationSignalRecord({ engine: "pdfjs", source: "notes" });
    rec(c, { cap: "A" });
    let calls = 0;
    c.onCalibration("extraction", (...a) => { calls++; return bad(...a); });
    clock.t += DAY;
    const before = dump(s);
    assert.throws(() => rec(c, { cap: "D", at: "2026-09-02" }));
    assert.equal(calls, 1);
    assert.deepEqual(dump(s), before, "nothing recorded: no row, no supersession, no subject or signal change");
  }
});

/* ------------------------------------------------------------------ R13, R15, R16, R17 */

test("R13: no service here writes a reading, a chain or a grade, and a signal stands in for no probe", async () => {
  const { s, c, clock } = fresh({ order: [] });
  c.onCalibration("extraction", () => []);
  const before = dump(s, OTHERS);
  await c.calibrationSubjectRegister({ engine: "pdfjs", probe_id: "P-1" });
  const sig = await c.calibrationSignalRecord({ engine: "pdfjs", source: "notes" });
  assert.equal(sig.stood_in_for_probe, false);
  assert.equal(c.calibrations().calibrations.length, 0, "a signal is not a calibration");
  assert.equal(c.liveCalibration({ engine: "pdfjs", version: "4.0" }), null);
  rec(c, { cap: "A" }); clock.t += DAY; rec(c, { cap: null, at: "2026-09-02" }); clock.t += DAY; rec(c, { cap: "A", at: "2026-09-03" });
  c.calibrationTick(T0 + 99 * DAY); c.calibrations(); c.worseSupersessions();
  assert.deepEqual(dump(s, OTHERS), before);
});

test("R15: every list read answers its limit and whether it was cut", () => {
  const { c } = fresh();
  rec(c);
  for (const [name, r] of [["calibrations", c.calibrations()], ["worseSupersessions", c.worseSupersessions()]]) {
    assert.equal(typeof r.limit, "number", name); assert.equal(typeof r.truncated, "boolean", name);
  }
  assert.equal(typeof c.calibrations().subjects_truncated, "boolean");
  assert.equal(typeof c.calibrationTick(T0).truncated, "boolean");
});

test("R16: the three tables are declared to purge as exempt, and purge in either form leaves them whole", async () => {
  const { s, c, clock } = fresh();
  rec(c); clock.t += DAY; rec(c, { cap: "D", at: "2026-09-02" });
  await c.calibrationSubjectRegister({ engine: "x", probe_id: "P" });
  await c.calibrationSignalRecord({ engine: "pdfjs", source: "notes" });
  const before = dump(s, CAL_TABLES);
  const rc = recordOf({ storage: s });
  const all = rc.purge();
  for (const t of CAL_TABLES) assert.ok(!(t in (all.removed || {})), `${t} is not purged`);
  rc.purge({ bundleId: "CAL-1" });
  rc.purge({ bundleId: "INFO-2026-0001" });
  assert.deepEqual(dump(s, CAL_TABLES), before);
  for (const t of CAL_TABLES) {
    const again = rc.declarePurge("someone-else", [t]);
    assert.equal(again.reason, "TABLE_DECLARED"); assert.equal(again.declaredBy, "calibration");
  }
  assert.equal(rec(c, { at: "2026-09-03" }).calibration_id, "CAL-3", "no id is reissued across a purge");
});

test("R17: no place is named in this module's outward text", async () => {
  const PLACES = /oakland|alameda|california|berkeley|legistar|granicus|san francisco|county|city council/i;
  const { c, clock } = fresh();
  c.onCalibration("extraction", () => []);
  const texts = [];
  const walk = (v) => { if (typeof v === "string") texts.push(v); else if (v && typeof v === "object") Object.values(v).forEach(walk); };
  walk(CALIBRATION_CHECKS);
  walk(await c.calibrationSubjectRegister({ engine: "pdfjs", probe_id: "P" }));
  walk(await c.calibrationSubjectRegister({}));
  walk(await c.calibrationSignalRecord({ engine: "pdfjs", source: "notes" }));
  walk(await c.calibrationSignalRecord({ engine: "nobody", source: "notes" }));
  walk(await c.calibrationSignalRecord({ engine: "pdfjs", source: "n", cap: "A" }));
  walk(rec(c, { cap: "A" })); clock.t += DAY; walk(rec(c, { cap: "C", at: "2026-09-02" }));
  clock.t += DAY; walk(rec(c, { cap: "A", at: "2026-09-03" })); walk(rec(c, { engine: "t", cap: null }));
  walk(rec(c, { regrade: true })); walk(rec(c, {}, {}));
  walk(c.calibrations()); walk(c.calibrationTick(T0 + 99 * DAY)); walk(c.calibrationTick(T0));
  walk(c.worseSupersessions());
  walk(fresh().c.calibrations());
  assert.ok(texts.length > 30);
  for (const t of texts) assert.doesNotMatch(t, PLACES);
});
