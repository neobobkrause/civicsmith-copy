/* calibration — the store half of the calibration construct (requirements: `build/requirements/calibration.md`).
 * CPDF-13 (D-183, D-253). The RULES are `../calibration.mjs`'s (R1–R3) and none of them is restated here; what lives
 * in this file is the storage, the surfaces, the services `extraction` reaches measurements through (R10–R12), and
 * the two post-write notices `scheduler` arms through (R18, R19).
 *
 * THE ONE THING TO UNDERSTAND BEFORE READING ANY OF IT: recording a calibration WRITES NOTHING ABOUT A TRANSCRIPTION
 * (R13). `calibrationRecord` writes a calibration row and stamps `replaced_by`/`drift` on the one it replaces — facts
 * about MEASUREMENTS — and stops. It does not touch a reading, a chain or a grade, and it does not write an
 * obligation. Which transcriptions rest on a measurement that moved is derived on read by the module that holds
 * transcriptions (`extraction`), which joins every record through `onCalibration` (R12): REC-17's shape, because a
 * stored verdict about a transcription goes stale in both directions, and a member decides rather than the plane.
 *
 * REACHED as `calibrationOf(ctx, deps)` (K61): one instance per Durable Object storage, created on the first call
 * with `deps` and returned to every later caller. `deps`:
 *   record  record-core, `recordOf(ctx)` unless a test passes its own; its `transact` and `declarePurge` are used.
 *   order   the modules' total order (ids), which every listener (R12, R18, R19) runs in: membership's `MODULE_ORDER` (its
 *           R83), the one list every module orders its listeners by, unless a test passes its own. Unknown modules
 *           run last, in the order they registered.
 *   now     the module's clock, milliseconds since the epoch (default: the wall clock). A caller's body never sets it.
 * The ops (`calibrations`, `calibrate`, `calibrationsubject`, `calibrationsignal`) are `calibrationOps`' entries,
 * which the plane's route map (`plane/store.mjs`) spreads in. The host calls `migrate()` (R20) at boot, after
 * record-core's, and before any service here is asked.
 */

import { checkCalibration, checkSignal, compare, drifted, nextProbeDue, cadenceSentence,
         CALIBRATION_CADENCE_MS } from "../calibration.mjs";
import { recordOf } from "../record-core/index.mjs";
import { listenerRefusal, MODULE_ORDER } from "../membership/index.mjs";
import { CALIBRATION_CHECKS } from "./checks.mjs";
import { CALIBRATION_SCHEMA, CALIBRATION_TABLES } from "./schema.mjs";
import { word, localize } from "../setup-words/index.mjs";

export { checkCalibration, checkSignal, compare, drifted, nextProbeDue, cadenceSentence, DRIFT, PROBE_REQUIRED,
         CALIBRATION_CADENCE_MS } from "../calibration.mjs";
export { CALIBRATION_CHECKS } from "./checks.mjs";
export { CALIBRATION_SCHEMA, CALIBRATION_TABLES } from "./schema.mjs";

/** R6, R11, R15: every list read is bounded — 200 unless the caller asks, never more than 5,000 — and asked for as
 *  `limit + 1`, so `truncated` is measured rather than inferred from a full page. */
export const CALIBRATION_LIMIT_DEFAULT = 200;
export const CALIBRATION_LIMIT_MAX = 5000;

const safeJson = (s) => { try { return JSON.parse(s); } catch { return null; } };
const nonEmpty = (v) => typeof v === "string" && v.trim().length > 0;

/** R8: the state of a subject's probe that its `why` names: never probed, or probed at its own cadence. */
export const subjectProbeState = (lastProbeMs) => lastProbeMs == null
  ? localize("calibration.index.nothing_has_ever_probed", "Nothing has ever probed it, so a probe is due immediately")
  : localize("calibration.index.next_probe_at_cadence", "The next probe is due at its own cadence");

class Calibration {
  #sql; #record; #order; #now;
  #listeners = [];        // R12: {module, fn, seq}, kept in the modules' order
  #subjectListeners = []; // R18: the same shape
  #signalListeners = [];  // R19: the same shape

  constructor({ sql, record, order, now } = {}) {
    this.#sql = sql;
    this.#record = record;
    this.#order = Array.isArray(order) ? order : MODULE_ORDER;
    this.#now = typeof now === "function" ? now : () => Date.now();
  }

  #rows(q, ...a) { return [...this.#sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }

  /* R14: a refusal from this file carries the same `check`/`translation` pair the construct's own refusals do,
     read from the family's rows — DEC-49's rule that a code has one home. */
  #refuse(code, detail) {
    const row = CALIBRATION_CHECKS[code];
    return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail };
  }

  #cap(limit) {
    const n = Math.floor(Number(limit));
    return Math.max(1, Math.min(Number.isFinite(n) && n > 0 ? n : CALIBRATION_LIMIT_DEFAULT, CALIBRATION_LIMIT_MAX));
  }

  /* A module's place in the total order; unknown modules run last, in the order they registered. */
  #rank(m) { const i = this.#order.indexOf(m); return i === -1 ? Infinity : i; }

  /* The instance's own calibratable engines, enabled ones only, bounded (R15). An instance with no row here holds no
     alarm for the scheduler's consumer at all — so this read is also the honest answer to "what does this feature
     cost me", which is nothing until a group registers something. */
  #subjects(cap = CALIBRATION_LIMIT_MAX, engine = null) {
    const page = this.#rows(
      `SELECT engine, version, probe_id, registered_at, last_probe_ms, enabled
         FROM calibration_subjects WHERE enabled=1${engine ? ` AND engine=?` : ""} ORDER BY engine LIMIT ?`,
      ...(engine ? [engine] : []), cap + 1);
    return { rows: page.slice(0, cap), truncated: page.length > cap };
  }

  /* The live (not-yet-superseded) calibration of an engine, or null. ONE row by construction: `calibrationRecord`
     supersedes the previous one in the same transaction as it inserts the new. */
  #live(engine) {
    return this.#one(
      `SELECT * FROM calibrations WHERE engine=? AND replaced_by IS NULL
        ORDER BY at_ms DESC LIMIT 1`, engine) || null;
  }

  /* CAL-<n>, minted from the highest suffix this store has ever used rather than from a count — a count re-issues
     an id after any row is removed, and an id that has meant two things is worse than a gap. The max is taken in
     SQL (one row, however many calibrations the store holds), CAST on the suffix because `CAL-10` sorts before
     `CAL-9` as text. The tables are exempt from purge (R16), so the highest held is the highest ever used. */
  #mintId() {
    const row = this.#one(
      `SELECT MAX(CAST(substr(calibration_id, 5) AS INTEGER)) AS n FROM calibrations
        WHERE calibration_id LIKE 'CAL-%'`);
    const max = row && Number.isFinite(Number(row.n)) ? Number(row.n) : 0;
    return `CAL-${max + 1}`;
  }

  /* A stored row, back into R1's shape (the shape `compare` reads), its probe inputs and scores parsed. */
  #toCal(r, p = "") {
    const inputs = r[`${p}probe_inputs`], scores = r[`${p}scores`];
    return { calibration_id: r[`${p}calibration_id`], engine: r[`${p}engine`], version: r[`${p}version`],
             at: r[`${p}at`], cap: r[`${p}cap`] ?? null, probe_id: r[`${p}probe_id`],
             probe_inputs: safeJson(inputs) ?? inputs, scores: safeJson(scores) ?? scores,
             measured_by: r[`${p}measured_by`] };
  }

  /* One subject's next-probe instant, and the ONLY place the signals reach the cadence (R3). `nextProbeDue` can
     return an instant at or before the cadence's own and has no arithmetic that could return a later one, so it
     needs only the earliest unconsumed signal: one row, however many announcements an engine has drawn (R15). */
  #nextProbe(subject, now) {
    const s = this.#one(
      `SELECT MIN(probe_by_ms) AS by FROM calibration_signals
        WHERE engine=? AND consumed_at IS NULL`, subject.engine);
    const signals = s && Number.isFinite(s.by) ? [{ probe_by: s.by }] : [];
    const due = nextProbeDue({ lastAt: subject.last_probe_ms ?? null, signals });
    return { ...due, overdue: due.at <= now };
  }

  /* ---------------------------------------------------------------- R20: the tables */

  /** R20: creates this module's three tables and their indexes where they are absent, from its own schema text
   *  (`CALIBRATION_SCHEMA`), whose every statement is `IF NOT EXISTS`: a table or index already held is left as it
   *  is, nothing else is added or changed, and a second call changes nothing. Answers the tables it created. */
  migrate() {
    const absent = CALIBRATION_TABLES.filter((t) => !this.#rows(`PRAGMA table_info(${t})`).length);
    const bare = CALIBRATION_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    for (const st of bare.split(";")) { const t = st.trim(); if (t) this.#sql.exec(t); }
    return { ok: true, created: absent };
  }

  /* ---------------------------------------------------------------- R12: the listeners */

  /** R12: a later module registers once; after each calibration `calibrationRecord` records, every listener runs in
   *  the same transaction, in the modules' order, and returns a list of obligations, or `{obligations, truncated}`.
   *  A malformed or repeated registration is refused through membership's `listenerRefusal` (its R81; N202), the one
   *  site of `LISTENER_MALFORMED` and `LISTENER_DECLARED`. */
  onCalibration(module, fn) { return this.#register(this.#listeners, module, fn); }

  /** R18 (N223): a later module's listener, called once after each successful `calibrationSubjectRegister` with
   *  `{engine, probe_id, next_probe}`, in the modules' order (`scheduler` registers its `arm`). Refused as R12. */
  onSubjectRegistered(module, fn) { return this.#register(this.#subjectListeners, module, fn); }

  /** R19 (N223): a later module's listener, called once after each signal `calibrationSignalRecord` records with
   *  `{engine, next_probe}`, in the modules' order (`scheduler` registers its `arm`). Refused as R12. */
  onSignalRecorded(module, fn) { return this.#register(this.#signalListeners, module, fn); }

  /* One registration into one slot: membership's `listenerRefusal` first (its R81, the one site of its two codes),
     then kept in the modules' total order, a module outside it after every one in it, in registration order. */
  #register(held, module, fn) {
    const refused = listenerRefusal(held, module, fn);
    if (refused) return refused;
    held.push({ module, fn, seq: held.length });
    held.sort((a, b) => (this.#rank(a.module) - this.#rank(b.module)) || (a.seq - b.seq));
    return { ok: true, module };
  }

  /* R18, R19: the post-write notices. Told after the write has stood, each listener once, in the modules' order, and
     each with its own copy of the notice, so nothing it does reaches the write, its answer or another listener: one
     that throws or rejects is isolated here (retrieval R52's pattern). A listener's answer is not read. */
  async #notify(held, notice) {
    for (const l of held) {
      const copy = JSON.parse(JSON.stringify(notice));
      try { await l.fn(copy); } catch { /* isolated */ }
    }
  }

  /* ---------------------------------------------------------------- R4, R5: recording a measurement */

  /** RECORD A CALIBRATION — a probe ran, and this is what it measured (`op=calibrate`).
   *
   *  `principal` is the control plane's stamp of the caller (R5): WHO ran the probe is never a name the body
   *  wrote, so `pkg.measured_by` is not read at all, and a calibration with no stamp is refused `CAL_UNATTRIBUTED`.
   *
   *  WHAT HAPPENS TO THE PREVIOUS CALIBRATION, and it is the whole asymmetry: it is stamped `replaced_by` and with
   *  the DRIFT VERDICT, in the same transaction. That verdict is a fact about two MEASUREMENTS, fixed the moment
   *  both exist and unable to go stale; what is never stored is any verdict about a TRANSCRIPTION.
   *
   *  AND THE SIGNALS ARE CONSUMED. A probe that has run answers every announcement that was asking for one, so a
   *  spent signal stops accelerating anything — otherwise one changelog entry would pull every future probe
   *  forward for ever. */
  calibrationRecord(pkg = {}, { principal = null } = {}) {
    const p = pkg && typeof pkg === "object" && !Array.isArray(pkg) ? pkg : {};
    const now = this.#now();
    const at = nonEmpty(p.at) ? p.at : new Date(now).toISOString();
    const cal = {
      engine: p.engine, version: p.version, at,
      cap: p.cap === undefined ? null : p.cap,
      probe_id: p.probe_id, probe_inputs: p.probe_inputs, scores: p.scores,
      measured_by: nonEmpty(principal) ? principal.trim() : "",
    };
    /* DEC-49 REGION is-calibration-regrade
       DEC-4 AT THE DOOR (R4, R13). A caller asking this act to move grades is refused by NAME rather than having
       the field quietly dropped, because the member who asks is usually reasoning correctly — the engine really
       did get worse and those documents really are overclaiming — and a silent no-op would leave them believing
       it happened. The other direction is refused by the same row on purpose: an automatic DOWNGRADE is a
       machine minting a grade just as much as an upgrade is. */
    if (p.regrade !== undefined || p.apply_to_transcriptions !== undefined)
      return this.#refuse("CAL_CANNOT_REGRADE",
        localize("calibration.index.this_call_asks_the_new", "this call asks the new measurement to re-grade the transcriptions already made by {String}. A calibration records what an engine scores; it never moves a grade, in EITHER direction — a grade rises or falls only by an authored act (DEC-4, no machine mints a grade). Record the measurement, then read op=calibrationdrift for exactly which transcriptions a member should look at", { String: String(String(p.engine)) }));
    /* END DEC-49 REGION is-calibration-regrade */
    const bad = checkCalibration(cal);
    if (bad) return { ok: false, reason: bad.code, ...bad };

    return this.#record.transact(() => {
      const prev = this.#live(cal.engine);
      const id = this.#mintId();
      const verdict = compare({ ...cal, calibration_id: id }, prev ? this.#toCal(prev) : null);
      this.#sql.exec(
        `INSERT INTO calibrations
           (calibration_id,engine,version,at,at_ms,cap,probe_id,probe_inputs,scores,measured_by,note)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        id, cal.engine, cal.version, cal.at, now, cal.cap, String(cal.probe_id),
        typeof cal.probe_inputs === "string" ? cal.probe_inputs : JSON.stringify(cal.probe_inputs),
        typeof cal.scores === "string" ? cal.scores : JSON.stringify(cal.scores),
        cal.measured_by, typeof p.note === "string" ? p.note : null);
      if (prev)
        this.#sql.exec(`UPDATE calibrations SET replaced_by=?, drift=? WHERE calibration_id=?`,
                       id, verdict, prev.calibration_id);
      this.#sql.exec(
        `INSERT INTO calibration_subjects (engine,version,probe_id,registered_at,last_probe_ms,enabled)
         VALUES (?,?,?,?,?,1)
         ON CONFLICT(engine) DO UPDATE SET version=excluded.version, probe_id=excluded.probe_id,
                                           last_probe_ms=excluded.last_probe_ms`,
        cal.engine, cal.version, String(cal.probe_id), cal.at, now);
      this.#sql.exec(`UPDATE calibration_signals SET consumed_at=? WHERE engine=? AND consumed_at IS NULL`,
                     cal.at, cal.engine);
      const d = drifted(verdict);
      const supersedes = prev ? prev.calibration_id : null;
      /* R12: THE OBLIGATIONS ARE THE LISTENERS', computed for the answer and written nowhere here. With no
         listener, null and not zero: an absent derivation is not a derivation that found none. A listener answers a
         list, or `{obligations, truncated}` when it cut its list short (K137), so a short list is never read as the
         whole blast radius. One that throws, or answers anything else, fails the whole record — this transaction
         rolls back. */
      let obligations = null, truncated = null;
      if (this.#listeners.length) {
        obligations = []; truncated = false;
        for (const l of this.#listeners) {
          const r = l.fn({ calibration_id: id, engine: cal.engine, version: cal.version, supersedes, drift: d });
          if (r == null) continue;
          const cut = r && typeof r === "object" && !Array.isArray(r) && Array.isArray(r.obligations)
                   && (r.truncated === undefined || typeof r.truncated === "boolean");
          if (!Array.isArray(r) && !cut)
            throw new TypeError(`calibration listener ${l.module} answered something other than a list of obligations`);
          obligations.push(...(cut ? r.obligations : r));
          if (cut && r.truncated === true) truncated = true;
        }
      }
      return { ok: true, calibration_id: id, engine: cal.engine, version: cal.version,
               at: cal.at, cap: cal.cap, measured_by: cal.measured_by,
               supersedes, drift: d,
               obligations_raised: obligations ? obligations.length : null,
               obligations,
               obligations_truncated: truncated,
               regraded: 0,
               why: word("calibration.why.records_probe_measured", { id: String(id), probe_id: String(cal.probe_id), engine: String(cal.engine), version: String(cal.version), at: String(cal.at), cap: String(cal.cap ?? "undetermined"), why: String(d.why), value: obligations ? "" : word("calibration.why.module_derives_obligations") }) };
    });
  }

  /* ---------------------------------------------------------------- R6: reading measurements */

  /** `op=calibrations`. What this instance has measured, newest first, and when the next probe is due for each
   *  subject. The due instant comes from `nextProbeDue`, which is also what the scheduler's consumer reads — one
   *  answer, so the surface cannot tell a member something different from what the alarm will do. */
  calibrations(args) {
    const { engine = null, limit = null } = args || {};
    const now = this.#now();
    const cap = this.#cap(limit);
    const eng = nonEmpty(engine) ? engine : null;
    const page = this.#rows(
      `SELECT * FROM calibrations${eng ? ` WHERE engine=?` : ""}
        ORDER BY at_ms DESC, CAST(substr(calibration_id, 5) AS INTEGER) DESC LIMIT ?`,
      ...(eng ? [eng] : []), cap + 1);
    const rows = page.slice(0, cap);
    const subj = this.#subjects(cap, eng);
    const subjects = subj.rows.map((s) => ({ ...s, next_probe: this.#nextProbe(s, now) }));
    return { ok: true, ...(eng ? { engine: eng } : {}),
             cadence_ms: CALIBRATION_CADENCE_MS,
             cadence: cadenceSentence(),
             count: rows.length, limit: cap, truncated: page.length > cap,
             calibrations: rows.map((r) => ({
               ...this.#toCal(r),
               superseded_by: r.replaced_by ?? null, drift: r.drift ?? null,
               note: r.note ?? null })),
             subjects, subjects_truncated: subj.truncated,
             why: subjects.length
               ? word("calibration.why.group_civicsmith_probes", { subjects: String(subjects.length), value: String(cadenceSentence()) })
               : word("calibration.why.engine_registered_calibration") };
  }

  /* ---------------------------------------------------------------- R7: the announcement watch */

  /** `op=calibrationsignal` — the OPTIONAL announcement watch. IT MAY ONLY SHORTEN THE INTERVAL TO THE NEXT PROBE,
   *  enforced three ways: `checkSignal` refuses a signal shaped like a measurement; `nextProbeDue` takes the minimum
   *  against the cadence's own instant; and nothing anywhere reads a signal when computing a cap, a grade or a
   *  drift verdict. ABSENCE OF AN ANNOUNCEMENT IS NOT EVIDENCE OF NO CHANGE. */
  async calibrationSignalRecord(pkg = {}) {
    const p = pkg && typeof pkg === "object" && !Array.isArray(pkg) ? pkg : {};
    const now = this.#now();
    const sig = { engine: p.engine, source: p.source,
                  ...(p.cap !== undefined ? { cap: p.cap } : {}),
                  ...(p.scores !== undefined ? { scores: p.scores } : {}) };
    const bad = checkSignal(sig);
    if (bad) return { ok: false, reason: bad.code, ...bad };
    const observed = nonEmpty(p.observed_at) ? p.observed_at : new Date(now).toISOString();
    /* A signal with no explicit instant asks for a probe NOW — the strongest thing a watch may ask for, and still
       only an acceleration. */
    const by = Number.isFinite(p.probe_by_ms) ? p.probe_by_ms : now;
    /* Never INSERT OR REPLACE: two announcements for one engine in one millisecond are two rows, or the second
       would silently replace the first and could push its earlier `probe_by` out. */
    const base = `CALSIG-${now}-${String(p.engine).replace(/[^A-Za-z0-9_.-]/g, "")}`;
    let id = base;
    for (let n = 2; this.#one(`SELECT 1 AS x FROM calibration_signals WHERE signal_id=?`, id); n++) id = `${base}-${n}`;
    this.#sql.exec(
      `INSERT INTO calibration_signals
         (signal_id,engine,source,observed_at,probe_by_ms,detail,consumed_at)
       VALUES (?,?,?,?,?,?,NULL)`,
      id, sig.engine, sig.source, observed, by, typeof p.detail === "string" ? p.detail : null);
    const subject = this.#one(
      `SELECT engine, version, probe_id, registered_at, last_probe_ms, enabled
         FROM calibration_subjects WHERE engine=?`, sig.engine);
    const next = subject ? this.#nextProbe(subject, now) : null;
    /* R19: the signal is recorded; now its listeners (the scheduler's `arm`) are told. */
    await this.#notify(this.#signalListeners, { engine: sig.engine, next_probe: next });
    return { ok: true, signal_id: id, engine: sig.engine, source: sig.source,
             observed_at: observed, probe_by_ms: by,
             next_probe: next,
             armed: !!subject,
             changed_grades: 0, stood_in_for_probe: false,
             why: word("calibration.why.recorded_announced_something", { source: String(sig.source), engine: String(sig.engine), value: subject ? "" : word("calibration.why.calibration_subject_registered") }) };
  }

  /* ---------------------------------------------------------------- R8: registering an engine */

  /** `op=calibrationsubject` — REGISTER AN ENGINE THIS INSTANCE CAN PROBE. A separate act from recording a
   *  calibration, because the engine that most needs calibrating is one nothing has ever measured, and that state
   *  must be registrable and visible. A never-probed subject is due immediately (`nextProbeDue`'s `never-probed`
   *  branch). REGISTERING IS NOT MEASURING: this writes no cap, no score, nothing a grade could rest on. */
  async calibrationSubjectRegister(pkg = {}) {
    const p = pkg && typeof pkg === "object" && !Array.isArray(pkg) ? pkg : {};
    const now = this.#now();
    const engine = typeof p.engine === "string" ? p.engine.trim() : "";
    const probeId = typeof p.probe_id === "string" ? p.probe_id.trim() : "";
    /* DEC-49 REGION is-calibration-subject
       D-668: registering has its own codes. It answered CAL_UNNAMED and CAL_NO_PROBE, whose translations were
       written for a MEASUREMENT: untrue of an act that measures nothing and asks no version (one code, one
       condition, D-484). */
    if (!engine)
      return this.#refuse("CAL_SUBJECT_UNNAMED", localize("calibration.index.registering_names_the_engine", "registering a calibration subject names the engine to be probed"));
    if (!probeId)
      return this.#refuse("CAL_SUBJECT_NO_PROBE",
        localize("calibration.index.registering_names_the_probe", "registering a calibration subject names the PROBE that will measure it. A subject with no probe is a promise to measure something by some means nobody stated"));
    /* END DEC-49 REGION is-calibration-subject */
    const enabled = p.enabled === false ? 0 : 1;
    this.#sql.exec(
      `INSERT INTO calibration_subjects (engine,version,probe_id,registered_at,last_probe_ms,enabled)
       VALUES (?,?,?,?,NULL,?)
       ON CONFLICT(engine) DO UPDATE SET probe_id=excluded.probe_id, version=excluded.version,
                                         enabled=excluded.enabled`,
      engine, typeof p.version === "string" ? p.version : null, probeId, new Date(now).toISOString(), enabled);
    const s = this.#one(
      `SELECT engine, version, probe_id, registered_at, last_probe_ms, enabled
         FROM calibration_subjects WHERE engine=?`, engine);
    const next = this.#nextProbe(s, now);
    /* R18: the subject is registered; now its listeners (the scheduler's `arm`) are told. */
    await this.#notify(this.#subjectListeners, { engine, probe_id: probeId, next_probe: next });
    return { ok: true, engine, probe_id: probeId, enabled: !!enabled,
             cadence_ms: CALIBRATION_CADENCE_MS, cadence: cadenceSentence(),
             next_probe: next,
             measured: false,
             why: word("calibration.why.registered_calibration_group", { engine: String(engine), last_probe_ms: subjectProbeState(s.last_probe_ms), cadence_sentence: String(cadenceSentence()) }) };
  }

  /* ---------------------------------------------------------------- R9: for the scheduler */

  /** R9: how many enabled subjects are past their own next-probe instant at `now`. */
  calibrationDue(now) {
    let n = 0;
    for (const s of this.#subjects().rows) if (this.#nextProbe(s, now).at <= now) n++;
    return n;
  }

  /** R9: the EARLIEST instant any subject wants a probe, or null when no subject is enabled — which is what makes
   *  the consumer self-terminating. A subject already overdue asks for `now` plus the caller's grace rather than an
   *  instant in the past, which the runtime would fire immediately and forever. The grace is the scheduler's (K74:
   *  this module reads nothing of a later one). */
  calibrationWake(now, graceMs = 0) {
    const subjects = this.#subjects().rows;
    if (!subjects.length) return null;
    const grace = Number.isFinite(graceMs) && graceMs > 0 ? graceMs : 0;
    let earliest = null;
    for (const s of subjects) {
      const at = this.#nextProbe(s, now).at;
      const want = at <= now ? now + grace : at;
      if (earliest == null || want < earliest) earliest = want;
    }
    return earliest;
  }

  /** R9: THE TICK. It lists the subjects due and runs no probe: this plane holds no derivation engine, so a probe
   *  is OWED and not RUN, and the record says owed rather than treating the last measurement as current. It never
   *  records a calibration — that would be rule 1's claim-versus-measurement failure committed by the scheduler. */
  calibrationTick(now) {
    const { rows, truncated } = this.#subjects();
    const due = [];
    for (const s of rows) {
      const n = this.#nextProbe(s, now);
      if (n.at <= now) due.push({ engine: s.engine, probe_id: s.probe_id,
                                  last_probe_ms: s.last_probe_ms ?? null, from: n.from });
    }
    return { due: due.length, subjects: due, truncated, probes_run: 0, calibrations_written: 0,
             why: due.length
               ? word("calibration.why.engine_due_calibration", { due: String(due.length) })
               : word("calibration.why.engine_due_probe") };
  }

  /* ---------------------------------------------------------------- R10, R11: for extraction */

  /** R10: the engine's live calibration when its version is `version`, else null. FAILS OPEN TO NULL, NEVER TO A
   *  GUESS: no calibration, another version live, a malformed argument or a store that cannot be read all answer
   *  null — never the nearest measurement, which would be the record claiming a join it does not have. */
  liveCalibration(args) {
    try {
      const { engine, version } = args || {};
      if (!nonEmpty(engine) || !nonEmpty(version)) return null;
      const r = this.#live(engine);
      if (!r || r.version !== version) return null;
      return { calibration_id: r.calibration_id, engine: r.engine, version: r.version, at: r.at,
               cap: r.cap ?? null, measured_by: r.measured_by };
    } catch {
      return null;
    }
  }

  /** R11: each calibration superseded with verdict `worse` (only `supersededId` when given), with the calibration
   *  that superseded it, both in R1's shape; a row whose successor cannot be read is left out (the join drops it).
   *  Bounded as R6, oldest first. It names no transcription: which ones rest on these is `extraction`'s question. */
  worseSupersessions(args) {
    const { supersededId = null, limit = null } = args || {};
    const cap = this.#cap(limit);
    const one = nonEmpty(supersededId);
    const cols = (t) => ["calibration_id", "engine", "version", "at", "cap", "probe_id", "probe_inputs", "scores",
                         "measured_by"].map((c) => `${t}.${c} AS ${t}_${c}`).join(", ");
    const page = one
      ? this.#rows(
          `SELECT ${cols("s")}, s.drift AS verdict, ${cols("c")}
             FROM calibrations s JOIN calibrations c ON c.calibration_id = s.replaced_by
            WHERE s.drift = ? AND s.calibration_id = ?
            ORDER BY s.at_ms, CAST(substr(s.calibration_id, 5) AS INTEGER) LIMIT ?`, "worse", supersededId, cap + 1)
      : this.#rows(
          `SELECT ${cols("s")}, s.drift AS verdict, ${cols("c")}
             FROM calibrations s JOIN calibrations c ON c.calibration_id = s.replaced_by
            WHERE s.drift = ?
            ORDER BY s.at_ms, CAST(substr(s.calibration_id, 5) AS INTEGER) LIMIT ?`, "worse", cap + 1);
    return { supersessions: page.slice(0, cap).map((r) => ({
               superseded: this.#toCal(r, "s_"), verdict: r.verdict, current: this.#toCal(r, "c_") })),
             limit: cap, truncated: page.length > cap };
  }
}

const OF = new WeakMap();

/** K61: the one calibration instance for this Durable Object's storage (`ctx`, or the storage itself). On first
 *  reaching it, its three tables are declared to record-core's purge as exempt (R16): they are measurements of
 *  engines, not of the record, and an id once minted from them must never be reissued. */
export function calibrationOf(ctx, deps = {}) {
  const storage = ctx && ctx.storage ? ctx.storage : ctx;
  let c = OF.get(storage);
  if (!c) {
    const record = (deps && deps.record) || recordOf(ctx);
    c = new Calibration({ sql: storage.sql, record, order: deps && deps.order, now: deps && deps.now });
    OF.set(storage, c);
    record.declarePurge("calibration", [], { exempt: CALIBRATION_TABLES });
  }
  return c;
}

/* The ops this module answers, as entries of the plane's route map (`plane/store.mjs` spreads them in). `url` is
   the request URL, whose query carries the control plane's stamps; `body` the parsed body. `identity` is the control
   plane's stamp of who is asking, deleted from every request before anything is stamped, so a caller can never name
   it (R5). `op=calibrationdrift` is `extraction`'s. */
export function calibrationOps(c, url, body) {
  return {
    calibrations: () => c.calibrations({ engine: url.searchParams.get("engine"),
                                         limit: url.searchParams.get("limit") }),
    calibrate: () => c.calibrationRecord(body || {}, { principal: url.searchParams.get("identity") }),
    calibrationsubject: () => c.calibrationSubjectRegister(body || {}),
    calibrationsignal: () => c.calibrationSignalRecord(body || {}),
  };
}
