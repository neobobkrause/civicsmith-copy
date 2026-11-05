/* machinery-producers — the feed's conditions about our own machinery (requirements:
 * `build/requirements/machinery-producers.md`, R1–R15). Split from `queue-producers` by copy (K617, K624 (1), K1850; seam read
 * `build/extraction/queue-producers-split.md`), with no change of meaning: its R3, R22, R26 and R27 are this module's R2–R5.
 * Each producer derives, on read and writing nothing, the CONDITIONs one provider's facts earn for a viewer, naming each
 * item's subjects and home subjects for `queue-producers` to answer in `feedItems` (its R8) and for `queue` to home,
 * offer, mint and publish.
 *
 *   conditionItems   queue-producers' one read of this module (R1): every item R2–R5 derive for a member and viewer,
 *                    each homed through queue's walk and carrying queue's options (both passed in by queue-producers R8).
 *                    No item carries `disposition` or `catalogue_id`.
 *
 * REACHED as `machineryProducersOf(ctx, deps)`: one instance per Durable Object storage. It registers nothing, holds no
 * table and no check row, and refuses nothing.
 * `deps` (each defaults to its module's instance on the same `ctx`, reached lazily when first asked):
 *   record, membership, governor, provenance, capture, captureRequests, monitoring, linkSweep, actions, networkNotices
 *   the providers (Uses).
 * `deps.updateNotice` (R12) is handed in by the plane's composition, never reached by default: `instance-setup`'s
 * `updateNoticeState()` (its R89), called at each read.
 *
 * `homesOf(subjectIds)` and `optionsOf(subjectIds)` (queue R7, R12) are held for the length of one synchronous
 * `conditionItems` read. `#conditionHomes` (`subject_bound`) and `#homesAt` (a case at depth 0) are built over `homesOf`.
 */

import { normalizeType } from "../record-grammar/types.mjs";
import { STATES, vocabFor } from "../record-grammar/document.mjs";
import { MACHINE_AUTHOR_PREFIX } from "../record-grammar/actors.mjs";
import { recordOf, stampInstant } from "../record-core/index.mjs";
import { membershipOf, viewerPredicate, GATE_MARK, Membership } from "../membership/index.mjs";
import { governorOf } from "../host-governor/index.mjs";
import { provenanceOf } from "../provenance/index.mjs";
import { captureOf, ACQUIRE_GRADE_NOTE } from "../capture/index.mjs";
import { captureRequestsOf, renderHoldReason } from "../capture-requests/index.mjs";
import { monitoringOf } from "../monitoring/index.mjs";
import { linkSweepOf, SWEEP_CONDITION_KINDS } from "../link-sweep/index.mjs";
import { actionsOf, zoneOf } from "../actions/index.mjs";
import { governingZone } from "../../../jurisdictions/index.mjs";
import { localDay, dayRange, span, isCalendarDate } from "../civil-time/index.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { runPrincipalOf } from "../run-rules/index.mjs";
import { networkNoticesOf } from "../network-notices/index.mjs";

/* The walk queue passes in answers this shape; with none passed, an item is ungrouped rather than given a home. */
const UNGROUPED = Object.freeze({ state: "determined", ungrouped: true, reasons: [], depth_bound: null, ancestors: [] });

/* A wait as a member reads it (T51 A-04): whole seconds, rounded up, in minutes and seconds; never milliseconds. */
function waitInWords(ms) {
  const secs = Math.ceil(ms / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  const seconds = `${s} second${s === 1 ? "" : "s"}`;
  if (m === 0) return seconds;
  const minutes = `${m} minute${m === 1 ? "" : "s"}`;
  return s === 0 ? minutes : `${minutes} and ${seconds}`;
}

export class MachineryProducers {
  #host; #deps;
  /* The read's two functions (R1), held for one synchronous `conditionItems` call and cleared after it. */
  #homesFn = null; #optionsFn = null;
  /* R10: the instance's zone, read once per `conditionItems` call (undefined until asked) and cleared after it. */
  #zone = undefined;
  constructor({ host, storage, deps = {} } = {}) {
    this.#host = host;
    this.sql = storage.sql;
    this.#deps = deps || {};
  }

  /* ------------------------------------------------------------------ the providers (Uses), reached lazily */
  #dep(name, make) {
    if (!(name in this.#deps) || this.#deps[name] === undefined) this.#deps[name] = make();
    return this.#deps[name];
  }
  get #record() { return this.#dep("record", () => recordOf(this.#host)); }
  get #membership() { return this.#dep("membership", () => membershipOf(this.#host)); }
  get #governor() { return this.#dep("governor", () => governorOf(this.#host)); }
  get #provenance() { return this.#dep("provenance", () => provenanceOf(this.#host)); }
  get #capture() { return this.#dep("capture", () => captureOf(this.#host)); }
  get #captureRequests() { return this.#dep("captureRequests", () => captureRequestsOf(this.#host)); }
  get #monitoring() { return this.#dep("monitoring", () => monitoringOf(this.#host)); }
  get #actions() { return this.#dep("actions", () => actionsOf(this.#host)); }
  get #networkNotices() { return this.#dep("networkNotices", () => networkNoticesOf(this.#host)); }
  /* N506: a sweep's statuses are link-sweep's (its R11), split from monitoring. */
  get #linkSweep() { return this.#dep("linkSweep", () => linkSweepOf(this.#host)); }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }

  /* ------------------------------------------------------------------ the viewer gate (membership R43, R80)
     membership offers the ONE predicate (`viewerPredicate`) and the one-id answer (`inSight`), so this module compiles
     its own gate from the predicate, as queue did. A machine credential (`scope: member`) is not filtered; an absent or
     unrecognised viewer compiles to DENY. */
  #bundleGate(col, viewer) {
    if (typeof col !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/.test(col))
      throw new Error(`REFUSED: the D-15 bundle gate needs a QUALIFIED column (got ${col}). `
        + "An unqualified name binds to `bundles` inside the gate's own subquery and passes everything.");
    const gate = viewerPredicate(viewer);
    if (gate.scope === "member") return { sql: `${GATE_MARK} 1=1`, args: [] };
    if (gate.scope === "DENY") return { sql: gate.sql, args: [] };
    return {
      sql: `${GATE_MARK} (${col} IS NULL OR EXISTS (SELECT 1 FROM bundles b
              WHERE b.bundle_id = ${col} AND (${gate.sql})))`,
      args: gate.args,
    };
  }

  /** The same question of ONE id, memoised per read: the id when the viewer sees it (membership R80), else null. */
  #bundleRedactor(viewer) {
    const gate = viewerPredicate(viewer);
    if (gate.scope === "member") return (id) => id ?? null;
    if (gate.scope === "DENY") return (id) => (id ? null : id ?? null);
    const memo = new Map();
    return (id) => {
      if (!id) return id ?? null;
      if (!memo.has(id)) memo.set(id, this.#membership.inSight(id, viewer));
      return memo.get(id) ? id : null;
    };
  }

  /* queue's R7 walk and R12 options, as this read was handed them (R1). */
  #homesOf(subjectIds) { return this.#homesFn ? this.#homesFn(subjectIds || []) : { ...UNGROUPED }; }
  #optionsOf(subjectIds) { return this.#optionsFn ? this.#optionsFn(subjectIds || []) || [] : []; }

  /* ------------------------------------------------------------------ R10: the local day, through civil-time
     Every day this module derives or compares is a local day in the instance's zone (`civil-time` R1, R7, R24), never
     the UTC day; with no zone held, the day and the age are undetermined, stated, never counted on UTC (K1444 (iii)). */

  /** The zone `actions` R12 reads (`zoneOf` over `actions.place()`: the active profiles' combined view's `time_zone`),
   *  held for the length of one read; null when none is held, or when the runtime does not know it. R5's windows. */
  #instanceZone() {
    if (this.#zone === undefined) {
      let z = null;
      try {
        const a = this.#actions, r = this.#record;
        /* K5292 (jurisdictions R98): the team's governing zone first, then the place's */
        z = governingZone(r.getSetting("jurisdiction_profiles"), r.getSetting("team_time_zone"))
          || zoneOf(a && typeof a.place === "function" ? a.place() : null);
      } catch { z = null; }
      this.#zone = MachineryProducers.#knownZone(z);
    }
    return this.#zone;
  }

  static #knownZone(z) {
    if (typeof z !== "string" || !z.trim()) return null;
    try { return typeof localDay("2000-01-01T00:00:00Z", z.trim()) === "string" ? z.trim() : null; } catch { return null; }
  }

  /** The local day of a day or an instant in `zone`: a `YYYY-MM-DD` is already a local day and is answered as it is;
   *  an instant is read in the zone (civil-time R1). Null when neither, or when the instant needs a zone none holds. */
  static #localDayOf(v, zone) {
    const raw = typeof v === "string" ? v.trim() : "";
    if (isCalendarDate(raw)) return raw;
    if (!raw || !zone) return null;
    try { const d = localDay(raw, zone); return typeof d === "string" ? d : null; } catch { return null; }
  }

  /** The first instant of a local day (`edge` "start") or the first instant after it ("end") in `zone` (civil-time R7). */
  static #dayEdge(day, zone, edge) {
    if (!zone || !isCalendarDate(day)) return null;
    try { const r = dayRange(day, day, zone); return r && typeof r[edge] === "string" ? r[edge] : null; } catch { return null; }
  }

  /** The local day of the read's instant in `zone`. */
  static #today(now, zone) {
    if (!zone) return null;
    try { const d = localDay(stampInstant("second", now), zone); return typeof d === "string" ? d : null; } catch { return null; }
  }

  /** R10: the whole local days from `from` to `to` (civil-time R24's `span`), never fewer than none; null when unknown. */
  static #daysBetween(from, to, zone) {
    if (!zone || !isCalendarDate(from) || !isCalendarDate(to)) return null;
    if (to < from) return 0;
    try {
      const s = span({ value: from, precision: "day", zone }, { value: to, precision: "day", zone }, { unit: "days" });
      return s && Number.isFinite(s.min) ? Math.max(0, s.min) : null;
    } catch { return null; }
  }

  static ZONE_UNDETERMINED = word("machinery-producers.zone_undetermined");

  /** R10: an item's `age` from a day or an instant, counted on local days in `zone`: a day ages from its first local
   *  instant, an instant from itself; `days` the whole local days since. With no zone held it is undetermined
   *  (`zone_undetermined`); with nothing readable, undetermined for `reason`. */
  static #localAge(v, zone, now, reason, detail) {
    const raw = typeof v === "string" ? v.trim() : "";
    const day = isCalendarDate(raw);
    const readable = day || (raw !== "" && Number.isFinite(Date.parse(raw)));
    if (!readable) return { state: "undetermined", reason, detail };
    if (!zone) return { state: "undetermined", reason: "zone_undetermined", detail: MachineryProducers.ZONE_UNDETERMINED };
    const since = day ? MachineryProducers.#dayEdge(raw, zone, "start") : raw;
    const from = MachineryProducers.#localDayOf(raw, zone);
    const sinceMs = since ? Date.parse(since) : NaN;
    if (!Number.isFinite(sinceMs) || !from) return { state: "undetermined", reason, detail };
    return { state: "determined", since, ms: Math.max(0, now - sinceMs),
             days: MachineryProducers.#daysBetween(from, MachineryProducers.#today(now, zone), zone) };
  }

  /* ------------------------------------------------------------------ the bounds */
  /** Which object types can BE a case (queue's R7 vocabulary, through normalizeType): an inquiry or a project. */
  static QUEUE_CASE_TYPES = ["inquiry", "project"];
  /** How many subject bundles one item names (queue-producers R2: at most 8), the bound queue's options read under too. */
  static QUEUE_OPTION_SUBJECTS_MAX = 8;
  /** R2: how many SUBJECT documents one CONDITION may gather before the gathering is reported `subject_bound`.
   *  Sixteen: twice the option bound, because a home set is cheaper than an affordances derivation. */
  static QUEUE_CONDITION_SUBJECTS_MAX = 16;
  /** The prefix the control plane stamps on a MACHINE credential's `author`, `token:<class>`, imported from
   *  record-grammar so the stamp and the read are the same string (REC-46); what `capture-completed-unattended` reads. */
  static QUEUE_MACHINE_AUTHOR_PREFIX = MACHINE_AUTHOR_PREFIX;
  /** N95: the page `manifestByAuthor` is read in (record-core R53's bound). */
  static QUEUE_UNATTENDED_PAGE = 200;
  /** The page `#ownedProjects` reads projects in (queue-producers' bound of the same name). */
  static QUEUE_OBJECTIVE_GAP_PAGE = 200;
  static DAY_MS = 86400000;

  /* ================================================================== R1 · conditionItems
   * queue-producers' ONE read of this module (its R8, where `#queueConditions` stood). Every producer here is a pure
   * read; the items are R2's in catalogue order, then R4's and R5's. queue sorts before it cuts (its R6, R49), so the
   * published order is unchanged. */
  conditionItems({ member = null, viewer = null, now = null, homesOf = null, optionsOf = null } = {}) {
    const me = typeof member === "string" && member.trim() ? member.trim() : null;
    const at = Number.isFinite(Number(now)) && now !== null && now !== "" ? Number(now) : Date.now();
    this.#homesFn = typeof homesOf === "function" ? homesOf : null;
    this.#optionsFn = typeof optionsOf === "function" ? optionsOf : null;
    this.#zone = undefined;
    try {
      const items = [
        /* R2, R3: the machinery's own conditions. */
        ...this.#queueConditions(viewer, at),
        /* R4, R5 (K1036 (8); DEC-111): a sweep that needs a member's look; a working-on notice that needs its owners'. */
        ...this.#conditionsSweep(me, viewer, at),
        ...this.#conditionsNotice(me, viewer, at),
      ];
      /* R11, R12 (T48): the administrators' to-do for a release ready to install; a read that fails is named, never guessed. */
      const update = this.#updateTodo(me, at);
      items.push(...update.items);
      return update.failed ? { items, facts: { failed: ["update-ready"] } } : { items };
    } finally {
      this.#homesFn = null;
      this.#optionsFn = null;
      this.#zone = undefined;
    }
  }

  /* ================== REC-32 · the CONDITION half of the feed =======   *
   * WHAT A CONDITION IS, and it is the reason this class exists separately: a
   * fact about OUR OWN MACHINERY rather than about the world (NOTIFICATIONS.md,
   * "The classes"). An overdue set of minutes is evidence about a public body;
   * a governor holding a host is a limitation of our own run. Merging them
   * would let our plumbing dilute the record's findings, which is the one thing
   * the three-class split exists to prevent.
   *
   * DERIVED ON READ, NO TABLE, NO STORED STATE — the REC-20 precedent, and here
   * it is not a shortcut but the only correct shape. Every one of these facts is
   * ALREADY state on the producing subsystem's own row: the governor's
   * `cooloff_until`, the capture session's existence and expiry, the manifest's
   * author. A stored copy would be a second record of one fact and would go
   * stale the instant the fact resolved — which is exactly the failure this
   * item's negative control produces on purpose.
   *
   * SO RESOLUTION NEEDS NO MECHANISM. A condition clears when its underlying
   * fact stops being true, for EVERY member at once, because there is nothing
   * per-member to clear: the hold expires, the session is dropped, a member
   * authors the document again. That is DEC-16's one-state-N-homes rule
   * inherited rather than re-implemented, and it is why muting (personal) and
   * resolving (shared) can sit on the same item without colliding.
   *
   * EACH KIND IS ONE WHOSE DATA IS ALREADY HERE (R2's six, R4's five, R5's three).
   * Each is built because its producing subsystem already writes the fact
   * down, and nothing here invents one. NOTHING IS COUPLED TO A MONITOR TICK:
   * a later producer adds kinds, it does not change these.
   *
   * THE VIEWER POSTURE IS REC-30'S, arm for arm:
   *   - a condition ABOUT A BUNDLE the viewer may not see is WITHHELD WHOLE and
   *     with no count, the posture an OBLIGATION about an invisible subject
   *     takes — a count here would say a project exists;
   *   - a condition about something that is NOT a bundle (a host, an
   *     unregistered capture) stands for every member, because it names no
   *     bundle to withhold; what is gated is which DOCUMENTS sit behind it;
   *   - the homes come from `homesOf` (queue R7), so an ancestor the viewer may not
   *     see is `undetermined`/`out_of_view` and never silently dropped.
   * ======================================================================== */

  /** The home set for a condition, with the ONE extra way a condition's walk can
   *  come back incomplete that an obligation's cannot.
   *
   *  An obligation and a finding both start from a bounded, known set of
   *  subjects. A condition about a HOST does not: the documents it concerns are
   *  every document captured from that host. So the subject gathering carries
   *  R2's discipline too — a bound, and an EXHAUSTED bound reported as
   *  `subject_bound` rather than as a quietly shorter home set. Same rule as
   *  `depth_bound`, same reason, and deliberately a DIFFERENT word, because
   *  "we stopped walking up" and "we stopped gathering subjects" are different
   *  facts and a surface should be able to say which happened. */
  #conditionHomes(subjectIds, viewer, bounded = false) {
    const homes = this.#homesOf(subjectIds);
    if (!bounded) return homes;
    return { ...homes, state: "undetermined", ungrouped: false,
             reasons: [...new Set([...homes.reasons, "subject_bound"])].sort() };
  }

  /** Which documents in this record came from a HOST, viewer-gated and bounded.
   *
   *  `captured_locators` is the store's own index of "what we retrieved from
   *  what address", written unconditionally for every capture, and `register`
   *  is the trust root that says which bundle those bytes were registered
   *  under. The join is the honest path from a host to the documents a member
   *  is actually working on; site_assets would answer a narrower question (what
   *  a host SERVED as furniture) and reuse_verdicts a narrower one still.
   *
   *  AN ADDRESS BELONGS TO THE HOST WHEN IT BEGINS WITH ONE OF FOUR PREFIXES, since normalizeAddress keeps the
   *  scheme and a non-default port: `https://<host>/`, `http://<host>/`, `https://<host>:`, `http://<host>:`. Each
   *  prefix is asked as a RANGE over the text, `prefix <= address_norm < upper`, where `upper` is the prefix with
   *  its last character (`/` or `:`) raised by one: under SQLite's binary collation that is exactly "begins with",
   *  and it is a seek on the `address_norm` key. No LIKE or GLOB pattern is built (N270): a pattern grows with the
   *  host, and workerd refuses one over 50 bytes (K313), so a long hostname failed the whole read on the plane. */
  #conditionBundlesForHost(host, viewer) {
    const cap = MachineryProducers.QUEUE_CONDITION_SUBJECTS_MAX;
    if (typeof host !== "string" || !host) return { ids: [], bounded: false };
    const seen = this.#bundleGate("r.bundle_id", viewer);
    const prefixes = [`https://${host}/`, `http://${host}/`, `https://${host}:`, `http://${host}:`];
    const ranges = prefixes.flatMap((p) => [p, p.slice(0, -1) + String.fromCharCode(p.charCodeAt(p.length - 1) + 1)]);
    const rows = this.#rows(
      `SELECT DISTINCT r.bundle_id FROM captured_locators cl
         JOIN register r ON r.capture_sha = cl.capture_sha
        WHERE (${prefixes.map(() => "(cl.address_norm >= ? AND cl.address_norm < ?)").join(" OR ")})
          AND (${seen.sql})
        ORDER BY r.bundle_id LIMIT ?`,
      ...ranges, ...seen.args, cap + 1);
    const ids = rows.map((r) => r.bundle_id);
    return { ids: ids.slice(0, cap), bounded: ids.length > cap };
  }

  /** `governor-holding-host` (D-103, and D-95 which built the governor).
   *
   *  THE FACT IS THE GOVERNOR'S OWN, read at the same predicate the governor
   *  itself admits on: `cooloff_until > now` is the exact test `governorAdmit`
   *  applies before refusing with `cooling_off`, and the one the capture path
   *  applies before stopping a page's remaining subresources. This derivation does not
   *  restate the rule, it asks it.
   *
   *  WHY IT EARNS AN ITEM AT ALL (NOTIFICATIONS.md rule 4 — a CONDITION is
   *  status until a member can change it): because the member's conclusion
   *  changes. "The source is down" and "we are pacing ourselves" are different
   *  facts about the world and about us, and D-104 is explicit that they must be
   *  distinguishable. A member who cannot tell them apart will either wait for
   *  a source that is fine or chase a publisher who did nothing.
   *
   *  IT RESOLVES BY THE HOLD ENDING, and for everyone at once. There is no act
   *  to take and none is offered: `options[]` are the acts available on the
   *  DOCUMENTS behind it, derived exactly as every other item's are. */
  #conditionsGovernorHolding(viewer, now) {
    const out = [];
    for (const r of this.#governor.governorHolding({ now })) {
      const subj = this.#conditionBundlesForHost(r.host, viewer);
      const refusedAt = Number(r.last_refusal_at);
      out.push({
        id: `CONDITION::governor-holding-host::${r.host}`,
        class: "CONDITION",
        kind: "governor-holding-host",
        case: this.#conditionHomes(subj.ids, viewer, subj.bounded),
        subject: { kind: "host", id: null, host: r.host,
                   bundles: subj.ids.slice(0, MachineryProducers.QUEUE_OPTION_SUBJECTS_MAX) },
        summary: word("observation-log.vocabulary.condition_governor_holding_host"),
        detail: localize("machinery-producers.index.pacing_wait_in_words", "Civicsmith will try {host} again in {wait}. It has been turned away {refusals} time{v1} in a row, so it is waiting before it sends more. This says nothing about whether the site is working.", { host: String(r.host), wait: waitInWords(Math.max(0, r.cooloff_until - now)), refusals: String(r.refusals), v1: String(r.refusals === 1 ? "" : "s") }),
        basis: { source: "host_governor", host: r.host,
                 cooloff_until: r.cooloff_until, retry_in_ms: Math.max(0, r.cooloff_until - now),
                 refusals: r.refusals, last_refusal_status: r.last_refusal_status ?? null,
                 last_refusal_at: Number.isFinite(refusedAt) ? refusedAt : null,
                 appetite_per_min: r.appetite_per_min ?? null,
                 granted: r.granted, refused_total: r.refused_total,
                 detail: localize("machinery-producers.index.a_status_is_a_fact", "a status is a fact about OUR OWN machinery (D-103/D-95): this instance's governor is holding the host, which is distinguishable from the source being unreachable and must not be read as evidence about the publisher. It clears for every member when the hold expires; there is no act that ends it.") },
        age: Number.isFinite(refusedAt) && refusedAt > 0
          ? { state: "determined", since: new Date(refusedAt).toISOString(),
              ms: Math.max(0, now - refusedAt) }
          : { state: "undetermined", reason: "no_refusal_instant",
              detail: localize("machinery-producers.index.cooloff_no_refusal_instant", "the governor row is in cool-off but carries no instant for the refusal that started it, so how long this has been true is not derivable") },
        assignee: null,
        assignee_role: null,
        options: this.#optionsOf(subj.ids),
      });
    }
    return out;
  }

  /** `partial-capture-outstanding` (CAPTURE-SCALING; the subresource ceiling).
   *
   *  THE FACT IS THE LEDGER'S OWN. `capture_sessions` is a work list with an
   *  expiry: a row exists exactly when a capture ran out of subrequest budget
   *  with support material still outstanding, and the capture path DROPS it the
   *  moment nothing is left. So "a capture did not finish" is the existence of
   *  an unexpired row and nothing else.
   *
   *  THIS READ DOES NOT PRUNE. `saveCaptureSession` and `loadCaptureSession`
   *  delete expired rows on the way past, which is right for a write path and
   *  wrong for this one: op=queue REPORTS and never mutates. An expired session
   *  is filtered by the same instant comparison instead, in the same stamp
   *  format those two methods write.
   *
   *  WHAT IT IS ABOUT. The primary capture is COMPLETE from the first tick and
   *  its bytes are in the store; what is outstanding is support material. If
   *  those bytes were registered under a bundle, that bundle is the subject and
   *  the ordinary viewer posture applies — invisible subject, withheld whole. If
   *  they were not, the session names no bundle at all (the intake doctrine's
   *  own words), so there is nothing to withhold and the item stands ungrouped
   *  about a capture rather than about a document. */
  #conditionsPartialCapture(viewer, now) {
    const out = [];
    const nowIso = stampInstant("second", now);
    const redact = this.#bundleRedactor(viewer);
    /* capture R46 (the live sessions, each `{session, locator, primarySha, …, state}` with its state parsed) and
       provenance R4 (the capture's home, null when none or gone). */
    for (const s of this.#capture.liveCaptureSessions(nowIso)) {
      /* R2 (G25; K4577): a large fetch acquisition parked as owed work (`state.fetch_pending`, a zero digest for its primary) has
         captured nothing and reached no ceiling; it is the Capture screen's "being fetched", not a partial capture. */
      if (s.state && typeof s.state === "object" && s.state.fetch_pending) continue;
      const r = { ...s, primary_sha: s.primarySha };
      const home = this.#provenance.homeOf(r.primary_sha);
      const bundleId = home ? home.bundleId : null;
      /* REC-30: a condition about a bundle this viewer may not see is withheld
         WHOLE and with no count. The count is the leak. */
      if (bundleId && redact(bundleId) === null) continue;
      let outstanding = null, discovered = null, spent = null, parsed = true;
      const st = r.state;
      if (st && typeof st === "object") {
        outstanding = Array.isArray(st.queue) ? st.queue.length : null;
        discovered = Number.isFinite(st.discovered) ? st.discovered : null;
        spent = Number.isFinite(st.spent) ? st.spent : null;
      } else parsed = false;
      const createdMs = Date.parse(r.created);
      out.push({
        id: `CONDITION::partial-capture-outstanding::${r.session}`,
        class: "CONDITION",
        kind: "partial-capture-outstanding",
        case: this.#conditionHomes(bundleId ? [bundleId] : [], viewer),
        subject: bundleId
          ? { kind: "bundle", id: bundleId, capture_sha: r.primary_sha, locator: r.locator }
          : { kind: "capture", id: null, capture_sha: r.primary_sha, locator: r.locator },
        summary: word("machinery-producers.summary.capture_did_finish", { locator: r.locator }),
        detail: localize("machinery-producers.index.the_primary_document_is_captured", "the primary document is captured and its bytes are in the store; the platform's subrequest ceiling was reached before its support material was fetched, and the remainder is parked for another tick (tick {ticks}, expires {expires}).", { ticks: String(r.ticks), expires: String(r.expires) }),
        basis: { source: "capture_sessions", session: r.session, locator: r.locator,
                 primary_sha: r.primary_sha, bundle_id: bundleId, ticks: r.ticks,
                 created: r.created, updated: r.updated, expires: r.expires,
                 outstanding: parsed ? outstanding : null,
                 discovered: parsed ? discovered : null, spent: parsed ? spent : null,
                 state_readable: parsed,
                 detail: localize("machinery-producers.index.the_ledger_is_scratch_and", "the ledger is SCRATCH and not record: it names a work list with an expiry, the primary capture is complete from the first tick, and the row is dropped by the capture path itself when nothing is left. It therefore clears for every member when the capture finishes or the session expires.") },
        age: Number.isFinite(createdMs)
          ? { state: "determined", since: r.created, ms: Math.max(0, now - createdMs) }
          : { state: "undetermined", reason: "unparseable_created",
              detail: localize("machinery-producers.index.session_created_unreadable", "the session row carries a created stamp this producer cannot read as an instant") },
        assignee: null,
        assignee_role: null,
        options: bundleId ? this.#optionsOf([bundleId]) : [],
      });
    }
    return out;
  }

  /** R3 (DEC-95 (1); K1105): the grade note of each capture an unattended item names, the words `op=acquire`'s answer
   *  carries (`ACQUIRE_GRADE_NOTE`, capture's export, as its R76 answers them), read synchronously. A capture is named,
   *  and held, by its `register` row (provenance R48): those under the item's bundle, at most the option bound (queue-producers R2), or a
   *  request's own digest. A capture the viewer may not see (its register row's bundle out of sight) carries none. R16 (K4509):
   *  a capture held in parts is one capture, its whole's: `registeredFor` answers wholes only (provenance R73, R74). */
  #gradeNotes({ bundle = null, sha = null }, visible) {
    const rows = bundle
      ? this.#provenance.registeredFor(bundle)
          .slice(0, MachineryProducers.QUEUE_OPTION_SUBJECTS_MAX).map((r) => ({ capture_sha: r.capture_sha, bundle_id: bundle }))
      : typeof sha === "string" && sha
        ? this.#rows(`SELECT r.capture_sha, r.bundle_id FROM register r WHERE r.capture_sha=?`, sha.toLowerCase())
        : [];
    return rows.filter((r) => visible(r.bundle_id) !== null).map((r) => ({ capture_sha: r.capture_sha, note: ACQUIRE_GRADE_NOTE }));
  }

  /** R3, R15: the detail's sentence carrying the notes, read by key (`queue.capture-completed-unattended.gradenote`) once
   *  for each distinct note, each led by a space; the captures a note is of are on the basis's `grade_notes`. */
  static #gradeNoteSentence(notes) {
    return [...new Set(notes.map((n) => n.note))]
      .map((note) => ` ${word("queue.capture-completed-unattended.gradenote", { note })}`).join("");
  }

  /** R13 (T49; DEC-272): what `{member}` says of the person who started a capture: the handle the founder or a member holds,
   *  or, with none held (a credential that is no member, or a member with no handle), the word for an unnamed starter. The
   *  id is never said: a member's id is their record's key, not their name. */
  #starterOf(author) {
    return this.#handleOf(author) || word("queue.capture-completed-unattended.who");
  }

  /** The handle a member or the founder holds, else null (a member with none, or an id that is no member): never the id. */
  #handleOf(memberId) {
    if (typeof memberId !== "string" || !memberId) return null;
    const handle = memberId === Membership.ROOT_ADMIN ? this.#membership.founderHandle() : this.#membership.memberFacts(memberId)?.handle;
    return typeof handle === "string" && handle.trim() ? handle : null;
  }

  /** R15: the member a completed capture request was made for, by handle, else null. A member's own request names her in
   *  `at_the_request_of.member` (capture-requests R56); a run's names the member in the attribution's `principals.plane`,
   *  read through `runPrincipalOf` (a credential that member minted is the member's; any other principal is nobody). */
  #requesterOf(attribution) {
    const at = attribution && attribution.at_the_request_of;
    if (!at || typeof at !== "object") return null;
    if (typeof at.member === "string" && at.member) return this.#handleOf(at.member);
    if (at.run === undefined || at.run === null) return null;
    const plane = runPrincipalOf(attribution.principals && attribution.principals.plane);
    return plane.startsWith("member:") ? this.#handleOf(plane.slice("member:".length)) : null;
  }

  /** `capture-completed-unattended` (D-61, closed by REC-2).
   *
   *  THE FACT IS THE MANIFEST'S OWN, and REC-2 is what made it exist. Before
   *  REC-2 an unattended writer could not take a lease at all, so a daemon
   *  could not finish a capture a member walked away from; REC-2's answer was a
   *  NAMED machine actor, `token:<class>`, stamped by the control plane with the
   *  caller's own value deleted first. That stamp lands on `manifest.author`,
   *  and it is the only durable trace of an unattended write anywhere in this
   *  store.
   *
   *  THE CONDITION IS THE SEQUENCE, NOT THE STAMP. A document written only ever
   *  by a machine was never walked away from by anybody — the whole intake path
   *  runs on a machine credential. What D-61 describes is a PERSON's document
   *  finished by a daemon, so the test is: the LATEST snapshot was machine
   *  written, and an EARLIER one was authored by a person. Both halves are
   *  required and the basis names both.
   *
   *  IT RESOLVES WHEN THE MEMBER COMES BACK — that is, when a person authors the
   *  document again and the latest snapshot is theirs. Shared, like every other
   *  condition here, because it is a property of the manifest and not of a
   *  reader.
   *
   *  ORDERING. `created` is the DOCUMENT's own time (promote records
   *  meta.last_updated, never the wall clock — C-12.1 depends on that). The
   *  tiebreak is `rowid DESC`, the store's own write order, because `snap_key`
   *  is an opaque caller-chosen string and its lexical order is not a clock: two
   *  snapshots stamped at the same instant would otherwise be ordered by a hash.
   *  #revisionKind reads the latest manifest entry by this SAME order since
   *  D-171 (it tiebroke on `snap_key DESC` until then, and named the wrong
   *  writer on a tie); the two sites agree on purpose. */
  #conditionsCaptureUnattended(viewer, now) {
    const out = [];
    /* N95: record-core's `manifestByAuthor` (its R53) answers, per held bundle with a machine-written entry, its
       latest entry and its earliest entry by anybody else, in the order described above; which of them this viewer
       sees is membership's to answer (R43, R80). Paged by its cursor to the end, as the walk was whole before. */
    const visible = this.#bundleRedactor(viewer);
    const page = MachineryProducers.QUEUE_UNATTENDED_PAGE;
    const found = [];
    for (let after = ""; ;) {
      const r = this.#record.manifestByAuthor({ authorPrefix: MachineryProducers.QUEUE_MACHINE_AUTHOR_PREFIX, after, limit: page });
      for (const b of r.bundles) if (visible(b.bundleId) !== null) found.push(b);
      if (!r.cursor || r.bundles.length < page) break;
      after = r.cursor;
    }
    for (const m of found) {
      const b = { bundle_id: m.bundleId };
      const latest = m.latest ? { ...m.latest, snap_key: m.latest.snapKey } : null;
      if (!latest || !String(latest.author || "").startsWith(MachineryProducers.QUEUE_MACHINE_AUTHOR_PREFIX))
        continue;                       // a person wrote last: the member came back
      const started = m.firstOther ? { ...m.firstOther, snap_key: m.firstOther.snapKey } : null;
      if (!started) continue;           // never a person's document: nobody walked away
      /* R14 (R085-19; K3501 (b)): only a bundle holding a capture (its register row, provenance R48) is a document a daemon
         finished. A machine's entry on a record holding none, an AI run's proposal on a question, walks away from nothing. */
      if (!this.#one(`SELECT capture_sha FROM register WHERE bundle_id=? LIMIT 1`, b.bundle_id)) continue;
      const createdMs = Date.parse(latest.created);
      const title = this.#record.bundleInfo(b.bundle_id);
      const notes = this.#gradeNotes({ bundle: b.bundle_id }, visible);
      /* R13 (T49; N1138; DEC-272): the words are read by key, the starter by handle and the title by its own, never an id. */
      const fills = { member: this.#starterOf(started.author),
                      title: title && title.title ? title.title : word("screen.held.untitled") };
      out.push({
        id: `CONDITION::capture-completed-unattended::${b.bundle_id}`,
        class: "CONDITION",
        kind: "capture-completed-unattended",
        case: this.#conditionHomes([b.bundle_id], viewer),
        subject: { kind: "bundle", id: b.bundle_id },
        summary: word("queue.capture-completed-unattended.summary", fills),
        detail: word("queue.capture-completed-unattended.detail", fills)
              + MachineryProducers.#gradeNoteSentence(notes),
        basis: { source: "manifest", bundle_id: b.bundle_id,
                 completed_by: latest.author, completed_snap_key: latest.snap_key,
                 completed_created: latest.created, completed_kind: latest.kind,
                 writer: latest.writer ?? null, operation: latest.operation ?? null,
                 started_by: started.author, started_snap_key: started.snap_key,
                 started_created: started.created, grade_notes: notes,
                 detail: localize("machinery-producers.index.machine_writer_is_named", "the machine writer is NAMED, never anonymous: the control plane deletes any caller-supplied author and stamps token:<class> for a machine credential (REC-2, closing D-61), so this is the record's own trace of an unattended write and not an inference. It clears for every member when a person authors the document again.") },
        age: Number.isFinite(createdMs)
          ? { state: "determined", since: latest.created, ms: Math.max(0, now - createdMs) }
          : { state: "undetermined", reason: "unparseable_created",
              detail: localize("machinery-producers.index.manifest_created_unreadable", "the manifest entry carries a created stamp this producer cannot read as an instant") },
        assignee: null,
        assignee_role: null,
        options: this.#optionsOf([b.bundle_id]),
      });
    }
    return out;
  }

  /** `capture-completed-unattended` (D-61) — ITS SECOND PRODUCER, and PL-4's
   *  completion notification.
   *
   *  THE DESIGN SAYS *"extend the subscriber, do not invent a channel"* (§4, on
   *  the pursue session waiting on a capture), and this is that: the SAME
   *  catalogued kind, the same class, a different subject and a different basis.
   *  A second producer for one kind is not novel — `C-27.13` has two, and PL-3's
   *  own control arm 6 turns on the distinction.
   *
   *  WHY THE FIRST PRODUCER CANNOT COVER THIS CASE, stated rather than left to
   *  be discovered. `#conditionsCaptureUnattended` requires an EARLIER manifest
   *  entry authored by a PERSON — its whole condition is "a person's document
   *  finished by a daemon". A requested capture was never a person's document:
   *  the run asked for a URL nobody had captured. So the walk finds no `started`
   *  row and correctly emits nothing, and the member waiting on this capture
   *  would be told nothing at all.
   *
   *  WHAT IT NAMES: BOTH PRINCIPALS, through the one composer the drain used. A
   *  row whose attribution cannot be composed emits NO ITEM — a notification
   *  that could not say whose act it was would be the defect DEC-27(b) names,
   *  surfaced to a member.
   *
   *  RECORDED FOR THE NEXT READER: the plan row and INVESTIGATIVE-SESSION.md §4
   *  both call this "the existing FINDING-class slug". IT IS NOT ONE.
   *  `queuestate.mjs` has classed `capture-completed-unattended` as a CONDITION
   *  since REC-32 and has a live producer for it. It is built here as the
   *  CONDITION it actually is rather than reclassified to match the prose: a
   *  kind's class decides whether leaving the list is a personal mute or an
   *  authored record act (D-125, DEC-16), and moving one to match a sentence in
   *  a plan would be changing doctrine to fix a citation. The discrepancy is
   *  reported rather than silently absorbed. */
  #conditionsCaptureRequested(viewer, now) {
    const out = [];
    const visible = this.#bundleRedactor(viewer);
    for (const r of this.#captureRequests.completed({ viewer }).requests) {
      const attribution = r.attribution;
      /* DEFENCE IN DEPTH, AND STATED AS SUCH RATHER THAN CLAIMED AS A CONTROL.
         The drain refuses to capture a row it cannot attribute, so no `captured`
         row reaching this walk can fail the composer today and this `continue`
         is UNDRIVABLE. It stays because this is a READ over stored rows, which
         outlive the rules that wrote them, and a member-facing item that could
         not say whose act it announces is DEC-27(b)'s defect surfaced to a
         person. It mints no DEC-49 code, which is why it is kept where the two
         undrivable CODES this item found were removed: an unreachable branch
         costs a reader a moment, an unreachable code costs the whole family its
         floor. */
      if (!attribution.ok) continue;
      const capturedMs = Date.parse(r.captured_at);
      const notes = this.#gradeNotes({ sha: r.capture_sha }, visible);
      /* R15 (T50; N1143; DEC-274): told by key, composing no English. {member} the requester's handle, {title} the title of
         the document the capture is registered under, or the untitled word when none is held or the viewer may not see it. */
      const requester = this.#requesterOf(attribution);
      const home = typeof r.capture_sha === "string" && r.capture_sha
        ? this.#one(`SELECT bundle_id FROM register WHERE capture_sha=?`, r.capture_sha.toLowerCase()) : null;
      const info = home && visible(home.bundle_id) !== null ? this.#record.bundleInfo(home.bundle_id) : null;
      const title = info && typeof info.title === "string" && info.title.trim() ? info.title : word("screen.held.untitled");
      const fills = requester ? { member: requester, title } : { title };
      const k = "queue.capture-completed-unattended.request";
      const byRun = attribution.at_the_request_of && attribution.at_the_request_of.run !== undefined
        && attribution.at_the_request_of.run !== null;
      out.push({
        id: `CONDITION::capture-completed-unattended::${r.request}`,
        class: "CONDITION",
        kind: "capture-completed-unattended",
        case: this.#conditionHomes([r.target], viewer),
        subject: { kind: "capture_request", id: r.request },
        summary: word(requester ? `${k}.summary` : `${k}.summary.unnamed`, fills),
        detail: word(!requester ? `${k}.detail.unnamed` : byRun ? `${k}.detail.assistant` : `${k}.detail`, fills)
              + MachineryProducers.#gradeNoteSentence(notes),
        basis: { source: "capture_requests", request: r.request, run: r.run, inquiry: r.target,
                 address: r.address, host: r.host, purpose: r.purpose, ua_mode: r.ua_mode,
                 capture_sha: r.capture_sha, captured_at: r.captured_at, grade_notes: notes,
                 attribution,
                 detail: localize("machinery-producers.index.both_principals_are_named_dec", "BOTH PRINCIPALS ARE NAMED (DEC-27(b), DEC-55.4): the act is the daemon's, performed at the session's request, under the plane credential the run holds and paid for by the level of the Claude-account cascade the run named. Never a token value, and never a person's name on the act itself.") },
        age: Number.isFinite(capturedMs)
          ? { state: "determined", since: r.captured_at, ms: Math.max(0, now - capturedMs) }
          : { state: "undetermined", reason: "unparseable_captured_at",
              detail: localize("machinery-producers.index.request_completion_unreadable", "the request row carries a completion stamp this producer cannot read as an instant") },
        assignee: null,
        assignee_role: null,
        options: this.#optionsOf([r.target]),
      });
    }
    return out;
  }


  /** A home set made of the named cases themselves (each at depth 0, when this viewer sees it and it is a case) and
   *  every ancestor above them (queue R7): for an item that is ABOUT a case rather than about a document under one.
   *  `walkFrom` (R4) names the subjects the walk starts from when they are not the cases themselves: a sweep's
   *  item is homed under its project at depth 0 and under whatever its bundle's own walk reaches. */
  #homesAt(caseIds, viewer, walkFrom = caseIds) {
    const up = this.#homesOf(walkFrom);
    const gate = viewerPredicate(viewer);
    const own = [];
    for (const id of [...new Set((caseIds || []).filter((x) => typeof x === "string" && x))]) {
      const row = this.#one(
        `SELECT b.bundle_id, b.object_type, b.current_state, b.title FROM bundles b
          WHERE b.bundle_id=? AND (${gate.sql})`, id, ...gate.args);
      if (!row) continue;
      const ty = normalizeType(row.object_type);
      if (!MachineryProducers.QUEUE_CASE_TYPES.includes(ty)) continue;
      const spec = vocabFor(STATES, row.object_type);
      const edges = spec && spec.edges ? spec.edges : null;
      const terminal = edges && Object.prototype.hasOwnProperty.call(edges, row.current_state)
        ? edges[row.current_state].length === 0 : null;
      own.push({ id: row.bundle_id, type: ty, title: row.title ?? null, state: row.current_state ?? null, terminal, depth: 0 });
    }
    const ancestors = [...own, ...up.ancestors.filter((a) => !own.some((o) => o.id === a.id))]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return { ...up, ancestors, ungrouped: up.state === "determined" && ancestors.length === 0 };
  }

  /** The documents captured at one address (provenance R48's read contract), viewer-gated and bounded as
   *  `#conditionBundlesForHost` is. */
  #conditionBundlesForAddress(addressNorm, viewer) {
    const cap = MachineryProducers.QUEUE_CONDITION_SUBJECTS_MAX;
    const seen = this.#bundleGate("r.bundle_id", viewer);
    const ids = this.#rows(
      `SELECT DISTINCT r.bundle_id FROM captured_locators cl JOIN register r ON r.capture_sha = cl.capture_sha
        WHERE cl.address_norm = ? AND (${seen.sql}) ORDER BY r.bundle_id LIMIT ?`,
      addressNorm, ...seen.args, cap + 1).map((r) => r.bundle_id);
    return { ids: ids.slice(0, cap), bounded: ids.length > cap };
  }

  /** `archive-fallback-eligible` (N229, N330; monitoring R47; capture R8): one CONDITION per address
   *  `monitoring.archiveEligible` answers, what the next archive tick would find eligible (K406 Q2), asked as the tick
   *  asks and writing nothing. Its bound, whether it cut, and the daemon's pause are published on each item: a pause
   *  never empties the list, since eligibility is capture's fact about our attempts. */
  #conditionsArchiveEligible(viewer, now) {
    const page = this.#monitoring.archiveEligible(now) || {};
    const list = page.ok !== false && Array.isArray(page.eligible) ? page.eligible : [];
    const out = [];
    for (const r of list) {
      const address = r && typeof r.address === "string" && r.address ? r.address : null;
      if (!address) continue;
      const subj = this.#conditionBundlesForAddress(address, viewer);
      const sinceMs = Date.parse(r.first_failure_since ?? "");
      out.push({
        id: `CONDITION::archive-fallback-eligible::${address}`,
        class: "CONDITION",
        kind: "archive-fallback-eligible",
        case: this.#conditionHomes(subj.ids, viewer, subj.bounded),
        subject: { kind: "address", id: null, address,
                   bundles: subj.ids.slice(0, MachineryProducers.QUEUE_OPTION_SUBJECTS_MAX) },
        summary: word("machinery-producers.summary.stopped_answering_often", { address }),
        detail: localize("machinery-producers.index.our_own_attempts_at", "our own attempts at this address have failed enough times, for long enough, that the archive fallback may fetch a replay in its place. This is a fact about our attempts, not a finding about the publisher."),
        basis: { source: "monitoring.archiveEligible", address, reachability: r.reachability ?? null,
                 bound: { limit: page.limit ?? null, truncated: page.truncated === true },
                 paused: page.paused ?? null,
                 detail: localize("machinery-producers.index.eligibility_is_captures_rule", "eligibility is capture's rule (its R8), read as the next archive tick would read it (monitoring R47); the tick itself fires the fallback, and this item clears when the address answers again.") },
        age: Number.isFinite(sinceMs)
          ? { state: "determined", since: r.first_failure_since, ms: Math.max(0, now - sinceMs) }
          : { state: "undetermined", reason: "no_first_failure",
              detail: localize("machinery-producers.index.failing_run_no_first_failure", "the failing run carries no first-failure instant this producer can read") },
        assignee: null,
        assignee_role: null,
        options: this.#optionsOf(subj.ids),
      });
    }
    return out;
  }

  /** `monitoring-recheck-due` (N229; monitoring R16, R31, R32): one CONDITION per monitored address monitoring's plan
   *  shows this viewer as overdue by more than its own interval, or unscheduled (no interval can be derived), so a
   *  document that is not being checked is visible. A document never checked is due now and is not yet overdue. */
  #conditionsRecheckDue(viewer, now) {
    const plan = this.#monitoring.monitoring({ viewer, now });
    const out = [];
    for (const r of (plan && Array.isArray(plan.items) ? plan.items : [])) {
      const dueMs = r.due_at ? Date.parse(r.due_at) : NaN;
      const overdue = r.state === "due" && Number.isFinite(dueMs) && Number.isFinite(r.interval_ms)
        && now - dueMs > r.interval_ms;
      if (!(overdue || r.state === "unscheduled")) continue;
      const key = r.address || r.bundle;
      out.push({
        id: `CONDITION::monitoring-recheck-due::${key}`,
        class: "CONDITION",
        kind: "monitoring-recheck-due",
        case: this.#conditionHomes([r.bundle], viewer),
        subject: { kind: "address", id: r.bundle, address: r.address ?? null },
        summary: word(overdue ? "machinery-producers.summary.overdue_check_interval" : "machinery-producers.summary.monitored_check_scheduled",
          { bundle: r.address || r.bundle }),
        detail: overdue
          ? localize("machinery-producers.index.it_was_due_at_due", "it was due at {due_at} and is checked every {round} hours; the check has not run since. Nothing about the source is claimed here.", { due_at: String(r.due_at), round: String(Math.round(r.interval_ms / 3600000)) })
          : localize("machinery-producers.index.no_interval_can_be_derived", "no interval can be derived for it ({v1}), so no check is scheduled.", { v1: String(r.reason || "no reason recorded") }),
        basis: { source: "monitoring", state: r.state, bundle: r.bundle, address: r.address ?? null,
                 frequency: r.frequency ?? null, due_at: r.due_at ?? null, interval_ms: r.interval_ms ?? null,
                 reason: r.reason ?? null, truncated: plan.truncated === true,
                 detail: localize("machinery-producers.index.the_plan_is_monitorings_its", "the plan is monitoring's (its R16, R32); this item is our own machinery falling behind or unable to schedule, and it clears when the check runs or a cadence is set.") },
        age: overdue
          ? { state: "determined", since: r.due_at, ms: Math.max(0, now - dueMs) }
          : { state: "undetermined", reason: "unscheduled",
              detail: localize("machinery-producers.index.unscheduled_no_instant", "an unscheduled address has no instant it fell due") },
        assignee: null,
        assignee_role: null,
        options: this.#optionsOf([r.bundle]),
      });
    }
    return out;
  }

  /** R2's generators, in catalogue order. Every one of them is a pure read. */
  #queueConditions(viewer, now) {
    return [
      ...this.#conditionsGovernorHolding(viewer, now),
      ...this.#conditionsPartialCapture(viewer, now),
      ...this.#conditionsCaptureUnattended(viewer, now),
      ...this.#conditionsCaptureRequested(viewer, now),
      ...this.#conditionsRenderDeferred(viewer, now),
      ...this.#conditionsArchiveEligible(viewer, now),
      ...this.#conditionsRecheckDue(viewer, now),
    ];
  }

  /** `render-deferred` (D-523; BOB #33 RULED 2026-09-24 19:54Z, CLIENT-RENDERED.md "RULED 2026-09-24 by BOB #33").
   *
   *  THE FACT IS THE REQUEST ROW'S OWN: a request that asked for the page as a visitor saw it (`render = 1`) and
   *  carries a C-83 code. While it is `requested` the drain is HOLDING it under that code (D-491) and asks again on
   *  every tick until its `expires`; once `expired` the drain has RELEASED it and the render never happened.
   *
   *  (capture-requests R61, PR 359) ONE HOLD IS NOT ASKED AGAIN: a fetch the site answered with a challenge
   *  (`SITE_ASKS_FOR_PERSON`, acquisition R140) leaves the row `requested` with `needs_person`, and the drain no
   *  longer selects it; it waits for a member's own file (`fillAskedRequest`) until it expires. That code is
   *  acquisition's, catalogued in none of the families `renderHoldReason` reads, so this producer says what the site
   *  asked and that the request waits for a person, never that it is asked again on every tick. The item still
   *  stands while it waits, so the render does not vanish from the feed while nothing has been filed. Both
   *  are shown, under one kind, because they are one fact at two moments and a member who saw the first must be
   *  able to see how it ended — an item that simply vanished at expiry would be the silent drop the ruling forbids.
   *
   *  THE REASON IS C-83's OWN, in DEC-49 words: the code, its C-number and the canned translation are read off the
   *  family that minted them and never re-typed here, so the sentence a member reads is the one the plane refuses
   *  with. C-83.3 and C-83.4 say different things — one that this instance cannot render at all, the other that
   *  today's allowance is committed — and collapsing them into "deferred" would tell a member to wait for a
   *  renderer that is not coming.
   *
   *  A CONDITION: our renderer, our allowance and our pacing hold it, so it is a fact about our machinery and never
   *  about the page, and a member may mute it for themselves (D-125's item form). It offers no act of its own; the
   *  options are the acts on the question the request was asked under, derived as every other item's are.
   *
   *  GATED AT THE TARGET through `#bundleGate`, exactly as the completion notification one producer up is: a
   *  request under a question the viewer cannot see is absent from their feed as it is from op=capturerequests. */
  #conditionsRenderDeferred(viewer, now) {
    const out = [];
    for (const r of this.#captureRequests.rendersHeld({ viewer }).requests) {
      /* EVERY RENDER THE DRAIN HAS HELD, UNDER WHATEVER CODE IT LAST CARRIED, and every one that EXPIRED. A render
         held under C-83 on one tick is held by the drain's own RATE rule on the next when a plain request for the
         same host wins the slot, and that overwrites the row's code (measured, capturerequests.test.mjs 7d) — so
         showing C-83 codes alone would make the item VANISH for a tick while the render still waits, which is the
         silence the ruling forbids. A row never yet attempted (no code) is simply queued and is not shown. The
         reason is the code's own family's sentence; a code no family catalogues says so. */
      const row = renderHoldReason(r.code);
      const released = r.state === "expired";
      /* R61: a row the site answered with a challenge waits for a person; the drain does not ask again. */
      const forPerson = r.needs_person === true;
      const words = forPerson
        ? (released
          ? localize("machinery-producers.index.site_asked_for_person_expired", "The site asked for proof that a person is asking, so nothing was saved, and no member added the file before the request expired.")
          : localize("machinery-producers.index.site_asks_for_person", "The site asked for proof that a person is asking, so nothing was saved. Open the page yourself and add the file you get, with the address it came from."))
        : row.translation
          || word("machinery-producers.text.last_thing_recorded", { code: r.code || "no code" });
      const sinceMs = Date.parse(r.requested_at);
      out.push({
        id: `CONDITION::render-deferred::${r.request}`,
        class: "CONDITION",
        kind: "render-deferred",
        case: this.#conditionHomes([r.target], viewer),
        subject: { kind: "capture_request", id: r.request },
        summary: released
          ? word("machinery-producers.summary.render_performed_held", { address: r.address })
          : word("machinery-producers.summary.render_waiting", { address: r.address, words }),
        detail: released
          ? localize("machinery-producers.index.words_the_request_expired_at", "{words} The request expired at {expires} and was released; nothing was filed in the render's place, and no conclusion about the page can rest on it.", { words: String(words), expires: String(r.expires) })
          : forPerson
            ? localize("machinery-producers.index.words_the_request_waits_for_person", "{words} The request is not asked again: it waits for a member's file until {expires}; if none is added by then it is recorded UNDETERMINED and released.", { words: String(words), expires: String(r.expires) })
            : localize("machinery-producers.index.words_the_request_is_held", "{words} The request is held and asked again on every tick until {expires}; if it cannot be rendered by then it is recorded UNDETERMINED and released.", { words: String(words), expires: String(r.expires) }),
        basis: { source: "capture_requests", request: r.request, run: r.run, inquiry: r.target,
                 address: r.address, host: r.host,
                 render: released ? { state: "expired", content: "undetermined" }
                                  : { state: forPerson ? "waiting_for_person" : "deferred", content: "undetermined" },
                 needs_person: forPerson, asked_at: r.asked_at ?? null,
                 code: r.code, check: row.check, translation: row.translation,
                 attempts: r.attempts, expires: r.expires, updated: r.updated,
                 plane_detail: r.detail ?? null,
                 detail: localize("machinery-producers.index.a_status_is_a_fact_2", "a status is a fact about OUR OWN machinery (D-491, BOB #32 item 3): this instance's renderer, render allowance or host pacing is what holds the render, which says nothing about the page. The served frame is never filed as the content, so while it waits and after it expires there is NO capture of what a visitor saw.") },
        age: Number.isFinite(sinceMs)
          ? { state: "determined", since: r.requested_at, ms: Math.max(0, now - sinceMs) }
          : { state: "undetermined", reason: "unparseable_requested_at",
              detail: localize("machinery-producers.index.request_stamp_unreadable", "the request row carries a request stamp this producer cannot read as an instant") },
        assignee: null,
        assignee_role: null,
        options: this.#optionsOf([r.target]),
      });
    }
    return out;
  }

  /** The projects this viewer sees that the member OWNS (membership R65), in id order, at most `cap`. */
  #ownedProjects(me, viewer, cap) {
    const gate = viewerPredicate(viewer);
    const out = [];
    let after = "", truncated = false;
    for (;;) {
      const rows = this.#rows(
        `SELECT b.bundle_id FROM bundles b WHERE b.object_type='project' AND b.bundle_id > ? AND (${gate.sql})
          ORDER BY b.bundle_id LIMIT ?`, after, ...gate.args, MachineryProducers.QUEUE_OBJECTIVE_GAP_PAGE);
      for (const r of rows) {
        const owners = this.#membership.projectOwners(r.bundle_id) || [];
        if (!owners.includes(me)) continue;
        if (out.length === cap) { truncated = true; break; }
        out.push(r.bundle_id);
      }
      if (truncated || rows.length < MachineryProducers.QUEUE_OBJECTIVE_GAP_PAGE) break;
      after = rows[rows.length - 1].bundle_id;
    }
    return { projects: out, bound: cap, truncated };
  }

  /* ======================================================================
   * K1036 (8) · R4 — A SWEEP THAT NEEDS A MEMBER'S LOOK (link-sweep R8, R11; monitoring R60, R63 before N506).
   * DEC-111, K1031 · R5 — A WORKING-ON NOTICE THAT NEEDS ITS OWNERS' (network-notices R12, R13, R22).
   * Each reads the one fact its owning module offers, derived on read and writing nothing, so an item leaves on the
   * first read after the fact stops holding. The items' words are the UX design stream's to set (NOTIFICATIONS.md, the
   * item contract; `ux-experience.json` UC-035): the sentences here say the fact plainly and claim nothing beyond it.
   * ====================================================================== */

  /** R4: the five kinds `link-sweep.sweepConditions` answers (its R11), as link-sweep exports them. */
  static SWEEP_CONDITION_KINDS = SWEEP_CONDITION_KINDS;
  /** R5: how many owned projects one read asks `network-notices` about; the window `notice-lapse-near` opens in before
   *  a lapse, and how long `notice-project-closed` stands after the closing. */
  static QUEUE_NOTICE_PROJECTS = 50;
  static NOTICE_LAPSE_NEAR_DAYS = 7;
  static NOTICE_CLOSED_DAYS = 30;
  /** R5: the act that answers a notice (network-notices R6, R11): a new revision, or a stop with an optional handoff. */
  static NOTICE_REVISE = Object.freeze({ id: "noticeprepare", label: word("machinery-producers.label.revise_notice_stop"), weight: "single" });
  static NOTICE_STOP = Object.freeze({ id: "noticeprepare", label: word("machinery-producers.label.stop_notice_handoff"), weight: "single" });

  /** R4's sentences, one per kind, each saying what the condition's `detail` gives and nothing more. */
  static #sweepWords(kind, d, title) {
    const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : word("machinery-producers.text.undetermined_number"));
    const list = (xs, f) => (Array.isArray(xs) && xs.length ? xs.map(f).join("; ") : "none named");
    switch (kind) {
      case "sweep-held-backlog":
        return { summary: word("machinery-producers.summary.sweep_held_captures", { title }),
                 detail: localize("machinery-producers.index.n_of_its_captures_are", "{n} of its captures are still awaiting review, at or over its backlog limit of {n_2}. It runs again when members review or set aside enough of them.", { n: String(n(d.backlog)), n_2: String(n(d.limit)) }) };
      case "sweep-yield-anomaly":
        return { summary: word("machinery-producers.summary.sweep_filed_unusual", { title }),
                 detail: localize("machinery-producers.index.its_last_run_filed_n", "its last run filed {n} against a median of {n_2} over its recent runs. Nothing else changed: the run's note says only that the number was unusual.", { n: String(n(d.filed)), n_2: String(n(d.median)) }) };
      case "sweep-seed-unreachable":
        return { summary: word("machinery-producers.summary.listing_page_sweep", { title }),
                 detail: localize("machinery-producers.index.on_its_last_run_these", "on its last run these could not be fetched: {list}. The sweep's other pages were read; each one's reachability is on the basis.", { list: String(list(d.seeds, (x) => String(x && x.seed))) }) };
      case "sweep-redirect-out-of-scope":
        return { summary: word("machinery-producers.summary.sweep_met_redirect", { title }),
                 detail: `on its last run these addresses redirected outside the sweep's sources, and nothing at the target `
                       + `was fetched: ${list(d.redirects, (x) => (x && typeof x === "object"
                         ? `${x.address ?? "an address"} to ${x.target ?? "an undetermined target"}` : String(x)))}.` };
      default:
        return { summary: word("machinery-producers.summary.sweep_filed_last", { title, runs: n(d.runs) }),
                 detail: localize("machinery-producers.index.its_last_n_runs_each", "its last {n} runs each filed nothing, and it is not held. Its seeds or its match may no longer find what it was set up to find.", { n: String(n(d.runs)) }) };
    }
  }

  /** `sweep-*` (R4; link-sweep R11, K1036 (8), N506): one CONDITION per condition `link-sweep.sweepConditions` answers the
   *  viewer, keyed `CONDITION::<kind>::<bundle>#<id>`, to the members of the sweep's project (joined or leaving,
   *  membership R74) who may see its bundle and to nobody else: a caller with no member is none of them, and a sweep in
   *  no project has no members. Its subject the sweep's bundle, homed under the project at depth 0 and the bundle's own
   *  walk; its `age` from the condition's `since`; its `detail` the condition's, carried whole on the basis and said in
   *  the sentence. It leaves when the condition leaves (the read no longer answers it). */
  #conditionsSweep(me, viewer, now) {
    if (!me) return [];
    const r = this.#linkSweep.sweepConditions({ viewer, now });
    const list = r && r.ok !== false && Array.isArray(r.conditions) ? r.conditions : [];
    const visible = this.#bundleRedactor(viewer);
    const joined = new Map();
    const out = [];
    for (const c of list) {
      if (!c || typeof c.sweep !== "string" || !MachineryProducers.SWEEP_CONDITION_KINDS.includes(c.kind)) continue;
      const hash = c.sweep.indexOf("#");
      if (hash <= 0 || hash === c.sweep.length - 1) continue;
      const bundle = c.sweep.slice(0, hash), sweepId = c.sweep.slice(hash + 1);
      if (visible(bundle) === null) continue;                    // R6: a bundle the viewer may not see is no item
      const info = this.#record.bundleInfo(bundle);
      const project = info ? (info.type === "project" ? info.id : info.project) : null;
      if (!project) continue;
      if (!joined.has(project)) {
        const p = this.#membership.participation(project, me);
        joined.set(project, !!(p && (p.state === "joined" || p.state === "leaving")));
      }
      if (!joined.get(project)) continue;
      const d = c.detail && typeof c.detail === "object" ? c.detail : {};
      const title = info && info.title ? `"${info.title}" (${sweepId})` : c.sweep;
      const words = MachineryProducers.#sweepWords(c.kind, d, title);
      const sinceMs = Date.parse(c.since ?? "");
      out.push({
        id: `CONDITION::${c.kind}::${c.sweep}`,
        class: "CONDITION",
        kind: c.kind,
        case: this.#homesAt([project], viewer, [bundle]),
        subject: { kind: "bundle", id: bundle, sweep: c.sweep, sweep_id: sweepId, project },
        summary: words.summary,
        detail: words.detail,
        basis: { source: "link-sweep.sweepConditions", sweep: c.sweep, bundle, sweep_id: sweepId, project, kind: c.kind,
                 since: c.since ?? null, condition: d, recipients_rule: "project_members_who_see_the_bundle",
                 detail: localize("machinery-producers.index.a_sweeps_status_is_link", "a sweep's status is link-sweep's (its R8, R11): derived on read from the sweep's own runs and backlog, read here and never restated. It goes to the members of the sweep's project who may see its record, and it leaves on the first read after it stops holding.") },
        age: Number.isFinite(sinceMs)
          ? { state: "determined", since: c.since, ms: Math.max(0, now - sinceMs) }
          : { state: "undetermined", reason: "no_condition_instant",
              detail: localize("machinery-producers.index.sweep_status_no_instant", "the sweep's status carries no instant this producer can read") },
        assignee: null,
        assignee_role: null,
        options: this.#optionsOf([bundle]),
      });
    }
    return out;
  }

  /** `notice-attestation-missed`, `notice-lapse-near` and `notice-project-closed` (R5; network-notices R12, R13, R22;
   *  DEC-111, K1031, K1100): for each project the member owns (membership R65), at most 50 in id order, the project's
   *  notices as `network-notices.noticesOf` answers the viewer, and per notice:
   *  - an open notice whose latest `monthly` missed for want of an instance key has had no `monthly` issued since;
   *  - an open notice whose lapse date (a lapse running) is at most 7 days away;
   *  - a notice whose project closed while it was open (status `closed`; an owner's stop makes it `stopped`), for 30
   *    days from the closing.
   *  Each keyed `CONDITION::<kind>::<notice>`, to the project's owners and to nobody else: a caller with no member, or
   *  a member who owns none, is told nothing. Each leaves on the first read after its fact stops holding. */
  #conditionsNotice(me, viewer, now) {
    if (!me) return [];
    const scope = this.#ownedProjects(me, viewer, MachineryProducers.QUEUE_NOTICE_PROJECTS);
    const DAY = MachineryProducers.DAY_MS;
    /* R10: the windows are counted on local days of the instance's zone (civil-time); with none held, the lapse window
       is read at the latest local day any zone has reached (UTC+14), so no item is withheld for want of a zone, and
       its age is undetermined. */
    const zone = this.#instanceZone();
    const today = MachineryProducers.#today(now, zone);
    const out = [];
    for (const project of scope.projects) {
      const r = this.#networkNotices.noticesOf({ project, viewer });
      if (!r || r.ok !== true || !Array.isArray(r.notices)) continue;
      const owners = this.#membership.projectOwners(project) || [];
      const title = (this.#record.bundleInfo(project) || {}).title || project;
      const item = (kind, n, { since, summary, detail, facts, options }) => {
        out.push({
          id: `CONDITION::${kind}::${n.notice}`,
          class: "CONDITION",
          kind,
          case: this.#homesAt([project], viewer),
          subject: { kind: "notice", id: n.notice, project, status: n.status },
          summary,
          detail,
          basis: { source: "network-notices.noticesOf", notice: n.notice, project, status: n.status, ...facts,
                   recipients_rule: "project_owners", zone,
                   bound: { projects_bound: scope.bound, projects_truncated: scope.truncated === true },
                   detail: localize("machinery-producers.index.a_working_on_notices_state", "a working-on notice's state is network-notices' (its R12, R13, R22), read here and never restated. It is told to the project's owners and to nobody else, and it leaves on the first read after it stops holding.") },
          age: MachineryProducers.#localAge(since, zone, now, "no_notice_instant", word("machinery-producers.age.notice_carries_instant")),
          assignee: null,
          assignee_role: null,
          recipients: [...owners],
          options,
        });
      };
      for (const n of r.notices) {
        if (!n || typeof n.notice !== "string" || !n.notice) continue;
        const atts = Array.isArray(n.attestations) ? n.attestations : [];
        /* an attestation's instant: its publication, else the first local instant of its `as_of` day */
        const instant = (a) => Date.parse((a && (a.published_at || MachineryProducers.#dayEdge(a.as_of, zone, "start"))) || "");
        if (n.status === "open") {
          const misses = Array.isArray(n.missed_monthlies) ? n.missed_monthlies.filter((m) => m && m.month) : [];
          const miss = misses.at(-1);
          if (miss) {
            const missMs = Date.parse(miss.at ?? "");
            const since = atts.some((a) => a.kind === "monthly" && (Number.isFinite(missMs) && Number.isFinite(instant(a))
              ? instant(a) > missMs : String(a.as_of || "").slice(0, 7) > miss.month));
            if (!since)
              item("notice-attestation-missed", n, { since: miss.at ?? null,
                summary: word("machinery-producers.summary.monthly_attestation_working", { title, month: miss.month }),
                detail: localize("machinery-producers.index.no_instance_key_was_bound", "no instance key was bound when it fell due, so your team's Civicsmith could not sign the notice's activity level. The notice shows its last attested level with that level's date until an attestation is issued; an administrator binds the key."),
                facts: { month: miss.month, missed_at: miss.at ?? null, missed: misses.length },
                options: this.#optionsOf([project]) });
          }
          const lapse = typeof n.lapse_date === "string" && isCalendarDate(n.lapse_date.slice(0, 10)) ? n.lapse_date.slice(0, 10) : null;
          const opens = lapse ? MachineryProducers.#addDays(lapse, -MachineryProducers.NOTICE_LAPSE_NEAR_DAYS) : null;
          const reached = today || MachineryProducers.#today(now, "Etc/GMT-14");
          if (opens && reached && opens <= reached) {
            item("notice-lapse-near", n, { since: opens,
              summary: word("machinery-producers.summary.working_notice_will", { title, lapse_date: n.lapse_date.slice(0, 10) }),
              detail: localize("machinery-producers.index.the_notice_has_been_dormant", "the notice has been Dormant at its last monthly attestation, and a second Dormant month with no revision lapses it. A revision or a stop answers this; so does the lapse itself."),
              facts: { lapse_date: n.lapse_date.slice(0, 10), window_days: MachineryProducers.NOTICE_LAPSE_NEAR_DAYS,
                       level: n.level ?? null },
              options: [MachineryProducers.NOTICE_REVISE] });
          }
        } else if (n.status === "closed") {
          const closed = atts.find((a) => a && a.kind === "closed");
          const since = closed ? closed.published_at || (isCalendarDate(closed.as_of) ? closed.as_of : null) : null;
          const closedDay = MachineryProducers.#localDayOf(since, zone);
          /* 30 local days from the closing; with no zone held, 30 days elapsed from a published instant, else it stands */
          const closedMs = Date.parse(closed && closed.published_at || "");
          const stands = closedDay && today ? MachineryProducers.#daysBetween(closedDay, today, zone) < MachineryProducers.NOTICE_CLOSED_DAYS
            : !Number.isFinite(closedMs) || now - closedMs < MachineryProducers.NOTICE_CLOSED_DAYS * DAY;
          if (stands) {
            item("notice-project-closed", n, { since,
              summary: word("machinery-producers.summary.closed_while_working", { title }),
              detail: localize("machinery-producers.index.your_teams_civicsmith_signed_the", "your team's Civicsmith signed the closing into the notice's public record. An owner may still stop the notice with a handoff naming another team or an open lead. This stands for 30 days from the closing, or until an owner stops the notice."),
              facts: { closed_at: since, window_days: MachineryProducers.NOTICE_CLOSED_DAYS },
              options: [MachineryProducers.NOTICE_STOP] });
          }
        }
      }
    }
    return out;
  }

  /* ======================================================================
   * T48 · R11, R12 — THE ADMINISTRATORS' TO-DO FOR A RELEASE READY TO INSTALL (N1047; DEC-226 (1); K3158, K3189).
   * Derived on read from `deps.updateNotice()`, the plane's handing of `instance-setup`'s `updateNoticeState()`
   * (its R89): never imported, since `instance-setup` is later in the order. Nothing is stored; the item leaves on the
   * first read after the notice read answers a decision or a running version that settles it.
   * ====================================================================== */

  /** A dotted release number as its numbers, else null. */
  static #versionParts(v) {
    return typeof v === "string" && /^\d+(\.\d+)*$/.test(v.trim()) ? v.trim().split(".").map(Number) : null;
  }

  /** -1, 0 or 1 comparing two parsed release numbers, a missing part being 0. */
  static #compareVersions(a, b) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const d = (a[i] ?? 0) - (b[i] ?? 0);
      if (d) return d < 0 ? -1 : 1;
    }
    return 0;
  }

  /** The latest decision on `version` among those the read answers (the ready release's own `decision`, R89, and the
   *  `decisions` list), by `at`, a later entry winning a tie; null when none; `undefined` when one is malformed. */
  static #latestDecision(version, state) {
    const all = [state.ready.decision, ...(Array.isArray(state.decisions) ? state.decisions : [])]
      .filter((d) => d !== null && d !== undefined);
    let best = null;
    for (const d of all) {
      if (typeof d !== "object" || typeof d.kind !== "string" || !["start", "later", "skip"].includes(d.kind)) return undefined;
      if (d.version !== undefined && d.version !== version) continue;
      if (best === null || String(d.at ?? "") >= String(best.at ?? "")) best = d;
    }
    return best;
  }

  /** R11, R12: `{items, failed}`. Only an active administrator is asked at all. */
  #updateTodo(me, now) {
    const none = { items: [], failed: false };
    if (!me) return none;
    let admins;
    try { admins = this.#membership.activeAdmins(); } catch { return none; }
    if (!Array.isArray(admins) || !admins.includes(me)) return none;
    const failed = { items: [], failed: true };
    const read = this.#deps.updateNotice;
    if (typeof read !== "function") return failed;
    let st;
    try { st = read(); } catch { return failed; }
    if (!st || typeof st !== "object") return failed;
    const running = MachineryProducers.#versionParts(st.running && st.running.version);
    if (!running) return failed;
    if (st.ready === null || st.ready === undefined) return none;
    const r = st.ready;
    const ver = MachineryProducers.#versionParts(r && r.version);
    if (!ver || typeof r.date !== "string" || !r.date || typeof r.found_at !== "string" || !Number.isFinite(Date.parse(r.found_at)))
      return failed;
    const version = r.version.trim();
    /* the running version is that release or newer: nothing to install */
    if (MachineryProducers.#compareVersions(ver, running) <= 0) return none;
    const decision = MachineryProducers.#latestDecision(version, st);
    if (decision === undefined) return failed;
    if (decision) {
      if (decision.kind !== "later") return none;                               // started or skipped, by any administrator
      const until = typeof decision.until === "string" ? decision.until.trim() : "";
      if (isCalendarDate(until)) {
        /* R10: a day is read on the local day; with no zone held, at the latest local day any zone has reached */
        const today = MachineryProducers.#today(now, this.#instanceZone() || "Etc/GMT-14");
        if (!today) return failed;
        if (today < until) return none;
      } else {
        const untilMs = Date.parse(until);
        if (!Number.isFinite(untilMs)) return failed;
        if (untilMs > now) return none;
      }
    }
    const security = r.security === true;
    return { failed: false, items: [{
      id: `OBLIGATION::update-ready::${version}`,
      class: "OBLIGATION",
      kind: "update-ready",
      case: { ...UNGROUPED },
      subject: { kind: "release", id: null, version },
      summary: word(security ? "machinery-producers.summary.new_release_group" : "machinery-producers.summary.new_release_group_civicsmith", { version }),
      detail: { version, date: r.date, security },
      basis: { source: "instance-setup.updateNoticeState", version, date: r.date, security, found_at: r.found_at,
               running: st.running.version,
               detail: localize("machinery-producers.index.the_to_do_is_derived", "the to-do is derived on read from the signed notice your team's Civicsmith already holds. It goes to every administrator and leaves every administrator's queue when one of them updates, puts it aside until a later day or skips it, or when your team is running that release or a newer one.") },
      age: MachineryProducers.#localAge(r.found_at, this.#instanceZone(), now, "no_release_instant",
        word("machinery-producers.age.notice_carries_instant_producer")),
      assignee: null,
      assignee_role: "admin",
      recipients: [...admins],
      options: this.#optionsOf([]),
    }] };
  }

  /** A calendar day `n` days from `day` in the proleptic Gregorian calendar: arithmetic on the date's own numbers, no
   *  instant and no zone (civil-time R6's calendar). */
  static #addDays(day, n) {
    if (!isCalendarDate(day)) return null;
    const [y, m, d] = day.split("-").map(Number);
    const t = new Date(0);
    t.setUTCFullYear(y, m - 1, d + n);
    const yy = t.getUTCFullYear();
    return `${yy < 0 ? "-" : ""}${String(Math.abs(yy)).padStart(4, "0")}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
  }
}

const OF = new WeakMap();

/** The one machinery-producers instance for this Durable Object's storage (`ctx`, or the storage itself). It registers
 *  nothing. */
export function machineryProducersOf(ctx, deps = {}) {
  const storage = ctx && ctx.storage ? ctx.storage : ctx;
  let p = OF.get(storage);
  if (!p) {
    p = new MachineryProducers({ host: ctx, storage, deps: { ...(deps || {}) } });
    OF.set(storage, p);
  }
  return p;
}
