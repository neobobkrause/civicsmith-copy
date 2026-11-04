/* action-clocks — the deadlines on the group's actions, read across actions, and the reminders members ask for on them
 * (requirements: `build/requirements/action-clocks.md`; State Rules v1.5 §4.4; `BIO_Action_v0_1.md` §4 rule 5).
 *
 * Split from `actions` (K617, K624 (1); T18 layer 9) by copy: `pendingClocks` and its bounds (R1, was `actions` R31),
 * `clockPropose` with `computeDeadline` and the clock subject of the proposal label (R2, was R32), the
 * `action_clock_proposals` table and `PENDING_CLOCKS_BAD_BEFORE`'s row, with their comments; `actions`' own job deleted
 * its copy. New here: `overdueClocks` (R3, the Action fold's `actions` R50) and the member's reminders (R4–R6, R8;
 * DEC-94, K613–K615, K624 (3)). T33-74: the count delegates to `civil-time` (`count.mjs`; C-1, C-2, C-4), every day is
 * the local day of the action's jurisdiction (K1444 (iii)), every deadline names its basis kind (R7, K1431), a computed
 * deadline is adopted in one member act (R13, K1440), a member downloads their deadlines as one calendar file (R14,
 * K1451; `ics.mjs`), and the group's own lateness is counted, never a finding about government (R15, D234). T34-50:
 * R3 and R5 items carry the zone they were judged in (N609); a named closure list's entry is read at its own local fact
 * (R12, N562; `count.mjs`). T35-62: R11 also lists those entries a live deadline reads (N689). T45 (N882; Actions D15;
 * `BIO_Action_v0_2.md` rule 6): R2 counts from a recorded receipt or service and reads `local-facts.governingView`; every
 * entry says who owes it (`owed_by`, R18) and may be a date the other side stated (`stated`, R7); this module writes an
 * entry by a member's adoption (R13) or statement (`clockState`, R18); R3 answers `owed_by`, `due_at`, the steps standing
 * for the entry (R16) and a duty's Noticed item (R17); `ourDeadlines` lists the group's own (R18); and lateness counts
 * only the group's own (R15). At start it registers as `steps`' due holder (R16). T46: R1's items carry an entry's
 * time of day and zone (R19, N918), and the standing proposals are read before one is adopted (R20, N925). T47: every
 * day is read in `actions.actionZone` (R21, N960); `dueAtOf` is exported (R22, N965); R3's items name the clock's venue
 * (R23, N968). T51 (N1088, K3189): `clocksRunning` counts the pending entries for Home (R24). An
 * action's clock is written in its own document (`actions`); this module reads it, proposes entries apart, holds the
 * members' reminders in its own table, and writes the document only through R13's adoption, a member's revision.
 *
 * REACHED as `actionClocksOf(host, deps)` (K61): one instance per host, created on the first call. At creation it
 * creates its tables and declares them, with their classes, to record-core (R9).
 * `deps` (each reached through its factory on the same host unless given; a test passes its own):
 *   record, membership   layer 2: `readFile`, `readImage`, `textAtSha`, `head`, `livePaths`, `transact`, `getSetting`,
 *                        `acquireLease`, `releaseLease`, `declareTable`; `viewerPredicate`.
 *   promotion            `promote`: R13's revision of the action, which `actions`' check judges (its R1–R3, R7).
 *   actions              `actionRead` (its R29) and `noSuchAction` (its R43).
 *   conformance          `determinationRead` (its R9): the project of the determination an action rests on (R3, R5;
 *                        K702). A host on which it cannot be created answers every project null.
 *   localFacts           `factStatus` (local-facts R2): each holiday year a business count reads, its status and the
 *                        value that governs here (R10), read through `factReader` (R12). A host on which it cannot be
 *                        created, or whose local-facts has no `factStatus`, reads none, and a business count states
 *                        its calendar `not_read`.
 *   standards            `standardRead` and `inForceAt` (R7, K1446): a deadline whose basis names a held standard. A
 *                        host on which it cannot be created answers such a standard undetermined.
 *   steps                (T45) `registerDueHolder`, `productsOf`, `stepsOf`, `stepsWaitingOn`, `step` (R16). A host on
 *                        which it cannot be created holds no step's date and answers no step.
 *   duties               (T45) `dutiesOf`, `occurrencesOf` (R17). A host on which it cannot be created answers no
 *                        Noticed item.
 *   combine              `jurisdictions.combine` over the active profiles' ids (record-core's `jurisdiction_profiles`);
 *                        a test passes its own, as local-facts takes one.
 *   now                  the instance clock, milliseconds (default: `env.BIO_NOW_MS`, else the wall clock).
 *   env                  the instance bindings.
 *
 * READ CONTRACTS it joins in its own SQL: record-core's `bundles` (`bundle_id`, `object_type`, `current_state`), its
 * R37; retrieval's projection (`action_clock_next`, its R61), which R1's page seeks. */

import { recordOf, stampInstant } from "../record-core/index.mjs";
import { membershipOf, viewerPredicate } from "../membership/index.mjs";
import { promotionOf } from "../promotion/index.mjs";
import { PROJECTION_TABLE } from "../retrieval/index.mjs";
import { conformanceOf } from "../conformance/index.mjs";
import { actionsOf, noSuchAction, actionZone } from "../actions/index.mjs";
import { standardsOf, noSuchStandard } from "../standards/index.mjs";
import { combine, nameResolve } from "../../../jurisdictions/index.mjs";
import { parseFrontmatter } from "../record-grammar/frontmatter.mjs";
import { normalizeType } from "../record-grammar/types.mjs";
import { isMachineIdentity } from "../record-grammar/actors.mjs";
import { createSha256 } from "../record-grammar/index.mjs";
import { lawProposalLabel } from "../action-grammar/index.mjs";
import * as actionGrammar from "../action-grammar/index.mjs";
import { localFactsOf, factPath } from "../local-facts/index.mjs";
import { stepsOf } from "../steps/index.mjs";
import { dutiesOf } from "../duties/index.mjs";
import { isCalendarDate, span } from "../civil-time/index.mjs";
import { evaluate as calcEvaluate } from "../calc-grammar/index.mjs";
import { ACTION_CLOCK_CHECKS } from "./checks.mjs";
import { ACTION_CLOCKS_TABLES, ACTION_CLOCKS_TABLE_CLASSES, migrateActionClocks } from "./schema.mjs";
import { actionOffices, localDayOf, yearEntries, holidayFact, officeHours, readsOfficeCalendar, closureListsRead,
         factReader, computeDeadline, traceLine } from "./count.mjs";
import { icsCalendar } from "./ics.mjs";
import { word, localize } from "../setup-words/index.mjs";

export { ACTION_CLOCK_CHECKS } from "./checks.mjs";
export { ACTION_CLOCKS_SCHEMA, ACTION_CLOCKS_TABLES, ACTION_CLOCKS_TABLE_CLASSES } from "./schema.mjs";
export { actionOffices, yearEntries, closureListsRead, factReader, computeDeadline } from "./count.mjs";
export { icsCalendar } from "./ics.mjs";

/** R1: the most pending clock entries one page answers, and the most actions one page reads. */
export const PENDING_CLOCKS_MAX = 500;
export const PENDING_CLOCKS_ACTIONS_MAX = 500;
/** R3: the same two bounds for the overdue entries. */
export const OVERDUE_CLOCKS_MAX = 500;
export const OVERDUE_CLOCKS_ACTIONS_MAX = 500;
/** R5: the most due reminders one page answers. */
export const REMINDERS_DUE_MAX = 500;
/** R4: the most standing reminders one action holds; and the most reminders `remindersFor` answers. */
export const REMINDERS_PER_ACTION_MAX = 50;
export const REMINDERS_READ_MAX = 500;
/** R20: the most standing proposals `clockProposalsFor` answers. */
export const CLOCK_PROPOSALS_MAX = 500;
/** R11: the most actions `calendarFactsRead` reads. */
export const CALENDAR_FACTS_ACTIONS_MAX = 500;
/** R14: the most actions one calendar file holds. R15: the most actions one lateness index reads, and the most versions
 *  of one action it reads for the day an entry was met. */
export const CLOCKS_ICS_ACTIONS_MAX = 200;
export const LATENESS_ACTIONS_MAX = 500;
export const LATENESS_VERSIONS_MAX = 200;
/** R13: the lease on the action while its revision is written (as `actions`' acts take theirs, its R16). */
export const ADOPT_LEASE_MS = 30000;

/** R7 (K1431; T45, v0.2 rule 6): the basis kinds of a deadline: a law or order, the body's own commitment, the event it
 *  must precede, the group's own window, and a date the other side has stated (never a legal deadline). */
export const BASIS_KINDS = Object.freeze(["rule", "commitment", "dependency", "window", "stated"]);
/** R18 (T45): who owes an entry: the group, the body, or undetermined where the entry does not say (`action-grammar`'s
 *  `CLOCK_OWED_BY`, its R2, R7, read from there once it holds it). Absent reads `undetermined`, never defaulted. */
export const CLOCK_OWED_BY = Object.freeze(Array.isArray(actionGrammar.CLOCK_OWED_BY) && actionGrammar.CLOCK_OWED_BY.length
  ? [...actionGrammar.CLOCK_OWED_BY] : ["group", "body", "undetermined"]);
/** R15 (D234; T45): the basis kinds that are the group's own whoever the entry says owes it; every other entry is the
 *  group's own only when it says `owed_by: group`. */
export const GROUP_OWN_KINDS = Object.freeze(["dependency", "window"]);
/** R18: `ourDeadlines`' two bounds, as R1's. */
export const OUR_DEADLINES_MAX = 500;
export const OUR_DEADLINES_ACTIONS_MAX = 500;
/** R24: the most actions `clocksRunning` reads. */
export const CLOCKS_RUNNING_ACTIONS_MAX = 500;
/** R18, R7: the longest words a stated entry carries in one field. */
export const CLOCK_TEXT_MAX = 500;
/** R16: the viewer this module reads a step with in process (steps' own registration hands it no viewer). */
const IN_PROCESS = "class:daemon";

/** R18: who an entry says owes it, `undetermined` when it says nothing this module reads. */
export const owedOf = (e) => (e && typeof e === "object" && CLOCK_OWED_BY.includes(e.owed_by) ? e.owed_by : "undetermined");
/** R15: whether an entry is one of the group's own deadlines. */
export const isGroupOwn = (e) => owedOf(e) === "group" || (!!e && GROUP_OWN_KINDS.includes(e.basis_kind));
/* R22: a local date-time, `YYYY-MM-DDTHH:MM` with optional seconds, its hour 00–23 and its minute and second 00–59; its
   day a real calendar day (`civil-time.isCalendarDate`). */
const DUE_AT_RE = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
const isLocalDateTime = (v) => { const m = typeof v === "string" ? DUE_AT_RE.exec(v) : null; return !!m && isCalendarDate(m[1]); };
/** R22 (T47; N965; `actions` R98; `monitoring` R34): the one reading of a timed clock entry. For an entry whose `due_at`
 *  is a local date-time (`YYYY-MM-DDTHH:MM`, seconds optional), `{due_at, due_zone}`: `due_at` as stated, and `due_zone`
 *  the entry's own where it states a non-empty one, else `zone` (the action's zone, R21; a function given as `zone` is
 *  asked only then, and a zone that is not a non-empty string, or a function that throws, answers null); for any other
 *  entry, `{due_at: null, due_zone: null}`. The entry's instant is `due_at` read in `due_zone` (`civil-time`). R3's and
 *  R19's items carry its answer (T45, T46). Pure; never throws. */
export function dueAtOf(entry, zone) {
  const none = { due_at: null, due_zone: null };
  try {
    if (!entry || typeof entry !== "object") return none;
    const at = entry.due_at;
    if (!isLocalDateTime(at)) return none;
    const own = entry.due_zone;
    if (typeof own === "string" && own.trim()) return { due_at: at, due_zone: own };
    let z = zone;
    if (typeof z === "function") { try { z = z(); } catch { z = null; } }
    return { due_at: at, due_zone: typeof z === "string" && z ? z : null };
  } catch { return none; }
}
/** R23 (T47; N968; `action-producers` R1): the office or venue an action's clock entries are owed at, read as R21 reads
 *  the zone (the office or venue `actionOffices` names): `{venue: {kind: "office", role, body}}` for an action addressed
 *  to an office (`actions` R9), else `{venue: {kind: "venue", action_kind, name}}` for an action whose kind the view gives
 *  a venue (`jurisdictions` R25, R87; `name` as the view states it), else `{venue: null, venue_why}`. Answered as the
 *  record states it, never composed into a sentence. Pure; never throws. */
export function venueOf(fm, view) {
  const none = (why) => ({ venue: null, venue_why: why });
  try {
    const o = actionOffices(fm, view)[0];
    if (o && typeof o.role === "string") return { venue: { kind: "office", role: o.role, body: o.body ?? null } };
    if (o && typeof o.venue === "string") {
      const k = (view && Array.isArray(view.action_kinds) ? view.action_kinds : []).find((x) => x && x.kind === o.venue);
      const name = k && k.venue && typeof k.venue.name === "string" ? k.venue.name : null;
      return { venue: { kind: "venue", action_kind: o.venue, name } };
    }
    return none(word("action-clocks.action_addressed_office"));
  } catch { return none(word("action-clocks.action_office_venue")); }
}
/** The level (`jurisdictions` R31: `federal`, `state`, `county`, `city`) of the office an action is addressed to: the level its addressee
 *  states, else the level of the office the view lists for that role and body (`counterparties`, R24); null when neither says. */
export function officeLevel(fm, view) {
  try {
    const cp = fm && typeof fm === "object" && fm.counterparty && typeof fm.counterparty === "object" ? fm.counterparty : null;
    if (!cp || cp.state !== "named" || !(cp.kind === undefined || cp.kind === null || cp.kind === "office")) return null;
    if (typeof cp.level === "string" && cp.level) return cp.level;
    const role = typeof cp.role === "string" ? cp.role.trim() : "", body = typeof cp.body === "string" ? cp.body.trim() : null;
    const c = (view && Array.isArray(view.counterparties) ? view.counterparties : []).find((x) => x && x.role === role && (body === null || x.body === body));
    return c && typeof c.level === "string" && c.level ? c.level : null;
  } catch { return null; }
}
/* The level a deadline is of: the one it states, else that of the records law (`records_laws`, with its level) whose citation its own
   citation begins with ("5 U.S.C. § 552" for "5 U.S.C. § 552(a)(6)(A)(i)"); null when the profile ties it to none. */
const deadlineLevel = (d, view) => {
  if (typeof d.level === "string" && d.level) return d.level;
  const cite = typeof d.citation === "string" ? d.citation.trim() : "";
  const law = (view && Array.isArray(view.records_laws) ? view.records_laws : []).find((l) => l && typeof l.level === "string" && typeof l.citation === "string"
    && cite !== "" && cite.startsWith(l.citation.replace(/\s+et seq\.?$/, "").trim()));
  return law ? law.level : null;
};
/** R28, R29 (T53; jurisdictions R99, R121): the layer an entry of the view is of: the one it names, else its profile when
 *  that is a layer of the view; null in a view of no layers. Pure; never throws. */
export function layerOf(e, view) {
  try {
    if (!e || typeof e !== "object") return null;
    if (typeof e.layer === "string" && e.layer) return e.layer;
    const ids = view && Array.isArray(view.layers) ? view.layers.map((l) => l && l.id) : [];
    return typeof e.profile === "string" && ids.includes(e.profile) ? e.profile : null;
  } catch { return null; }
}
/* R28: the view's layers as `jurisdictions.nameResolve` (its R121) takes them, each holding the view's deadlines it gives that
   `keep` keeps and its closure-list entries; [] for a view of no layers. The order of resolution is nameResolve's alone. */
function layersOf(view, keep = () => true) {
  const ls = view && Array.isArray(view.layers) ? view.layers.filter((l) => l && typeof l.id === "string") : [];
  return ls.map((l) => ({ id: l.id,
    layer: { ...(l.level ? { level: l.level, place: l.place } : {}), ...(l.within ? { within: l.within } : {}), origin: l.origin },
    deadlines: (Array.isArray(view.deadlines) ? view.deadlines : []).filter((d) => d && layerOf(d, view) === l.id && keep(d)),
    holidays: (Array.isArray(view.holidays) ? view.holidays : []).filter((h) => h && typeof h.list === "string" && layerOf(h, view) === l.id) }));
}
/** R28 (T53; N1257; K5458): the deadline `rule` names for an action of `kind`, resolved with `jurisdictions.nameResolve`
 *  (its R121) over the view's layers: `{d, layer}` (`layer` null in a view of no layers), `{ambiguous: [{layer, level,
 *  place}]}` when two layers give the name and none is named, or `{d: null}`. `rule` may be written `<layer id>:<rule>`.
 *  A view of no layers reads the first deadline of that rule for the kind, as before. Pure; never throws. */
export function ruleFor(view, kind, rule, layer = null) {
  const none = { d: null, layer: null };
  try {
    if (typeof rule !== "string" || !rule) return none;
    const all = (view && Array.isArray(view.deadlines) ? view.deadlines : []).filter((x) => x && x.applies_to === kind && typeof x.rule === "string");
    const named = typeof layer === "string" && layer ? layer : null;
    const ls = layersOf(view, (x) => x.applies_to === kind);
    if (!ls.length) { const d = named ? null : all.find((x) => x.rule === rule); return d ? { d, layer: null } : none; }
    const r = nameResolve({ section: "deadlines", name: rule, ...(named ? { layer: named } : {}), layers: ls });
    if (r && r.ok) { const d = all.find((x) => x.rule === r.entry.rule && layerOf(x, view) === r.layer); return d ? { d, layer: r.layer } : none; }
    if (r && r.reason === "NAME_AMBIGUOUS") return { d: null, layer: null, ambiguous: r.layers };
    /* an entry of no layer in a layered view (a profile combined with the layers) is read as before */
    const d = named ? null : all.find((x) => x.rule === rule && layerOf(x, view) === null);
    return d ? { d, layer: null } : none;
  } catch { return none; }
}
/* R28, R29: each closure list a rule counts or rolls on, resolved from the rule's own layer (`jurisdictions` R104, R121):
   `{name, layer}` (`layer` null where the view does not resolve it to one). */
function listsOfRule(d, view, layer) {
  const ls = layersOf(view);
  return closureListsRead(d).map((name) => {
    const r = ls.length ? nameResolve({ section: "closures", name, ...(layer ? { asking: layer } : {}), layers: ls }) : null;
    return { name, layer: r && r.ok ? r.layer : null };
  });
}
/** R2 (K4227, T51 C68; screens-investigate R59): the deadlines the view states for an action of `kind`, each `{rule, label?, citation?}`
 *  as the profile gives it: what `clockPropose` accepts as `rule`, in the view's order; `[]` when none applies or no view is held. A
 *  `label` or `citation` the profile does not state is left out. With the action's document `fm`, those of the level of the office it
 *  is addressed to come first, those the profile ties to another level last, the rest between, each group in the view's order: a
 *  request to a federal office offers the federal law's deadline first, a state office's the state's. Pure; never throws. */
export function deadlinesFor(view, kind, fm = null) {
  try {
    const level = officeLevel(fm, view);
    const out = [];
    for (const x of view && Array.isArray(view.deadlines) ? view.deadlines : []) {
      if (!x || typeof x.rule !== "string" || !x.rule || x.applies_to !== kind) continue;
      const of = level ? deadlineLevel(x, view) : null;
      const ly = layerOf(x, view);
      out.push({ at: out.length, rank: !of ? 1 : of === level ? 0 : 2,
        d: { rule: x.rule, ...(typeof x.label === "string" && x.label ? { label: x.label } : {}), ...(typeof x.citation === "string" && x.citation ? { citation: x.citation } : {}),
             ...(ly ? { layer: ly } : {}) } });
    }
    return out.sort((a, b) => a.rank - b.rank || a.at - b.at).map((x) => x.d);
  } catch { return []; }
}
/** R3 (T45; v0.2 rule 6): an overdue item is a question about a date, never a finding. */
export const OVERDUE_SAYS = word("action-clocks.date_action_clock");

/** R3, R5: the lifecycle states in which an action's deadlines no longer call for anything. */
export const CLOSED_ACTION_STATES = Object.freeze(["resolved", "abandoned"]);

/* The catalogue-backed refusals: each carries its code, check and translation (the Provides' "Terms"). */
export function withRow(r) {
  if (!r || typeof r !== "object" || r.ok !== false || typeof r.reason !== "string") return r;
  const row = ACTION_CLOCK_CHECKS[r.reason];
  if (!row) return r;
  return { ...r, code: r.code ?? r.reason, check: r.check ?? row.check, translation: r.translation ?? row.translation };
}
const refuse = (code, detail, extra) => withRow({ ok: false, reason: code, detail, ...(extra || {}) });
/* R13, R18: the refusal of an entry's own shape, its `arm` naming the field. */
function clockEntryRefused(arm, detail, extra) {
  /* DEC-49 REGION is-clock-entry-refused */
  return withRow({ ok: false, reason: "CLOCK_ENTRY_REFUSED", detail, ...(extra || {}), arm });
  /* END DEC-49 REGION is-clock-entry-refused */
}

/** A `YYYY-MM-DD` that names a real calendar day (`civil-time.isCalendarDate`, its R6). */
const isDay = (v) => typeof v === "string" && isCalendarDate(v);
const clampLimit = (v, dflt, max) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(n, max) : dflt; };

/* R4 (N427, K711): the one site minting `REMINDER_REFUSED`, the refusal of a reminder request's own shape, its detail
   naming the arm (`entry`, `on`, `from`, `held`, `bound`). Exported as `actions`' `noSuchAction` is, so a later module
   judging a request's shape before the action exists (`action-plans` R29) answers through it. `extra` adds a caller's
   own fields beside these and never replaces one of them. Writes nothing and never throws. */
const REMINDER_REFUSED_FIXED = new Set(["ok", "reason", "code", "check", "translation", "detail", "arm"]);
const textOf = (v) => { try { return v === undefined || v === null ? null : String(v); } catch { return null; } };
export function reminderRefused(arm, detail, extra = null) {
  let own = [];
  try {
    if (extra && typeof extra === "object" && !Array.isArray(extra))
      own = Object.entries(extra).filter(([k]) => !REMINDER_REFUSED_FIXED.has(k));
  } catch { own = []; }
  /* DEC-49 REGION is-reminder-refused */
  const row = ACTION_CLOCK_CHECKS.REMINDER_REFUSED;
  return { ok: false, reason: "REMINDER_REFUSED", code: "REMINDER_REFUSED", check: row.check, translation: row.translation,
           ...Object.fromEntries(own), detail: textOf(detail), arm: textOf(arm) };
  /* END DEC-49 REGION is-reminder-refused */
}

export class ActionClocks {
  #deps;

  constructor({ storage, record, membership, promotion = null, actions = null, conformance = null, localFacts = null,
                standards = null, steps = null, duties = null, combine: combineProfiles = combine, host = null, now = null,
                env = null } = {}) {
    this.sql = storage.sql;
    this.combine = typeof combineProfiles === "function" ? combineProfiles : combine;
    this.record = record;
    this.membership = membership;
    this.#deps = { host, promotion, actions, conformance: conformance ?? undefined, localFacts: localFacts ?? undefined,
                   standards: standards ?? undefined, steps: steps ?? undefined, duties: duties ?? undefined };
    this.env = env && typeof env === "object" ? env : {};
    this.now = typeof now === "function" ? now : null;
  }

  get actions() { return this.#deps.actions ||= actionsOf(this.#deps.host); }
  /* R13: the revision is a promotion, judged by `actions`' check (its R1–R3, R7) like any other. */
  get promotion() { return this.#deps.promotion ||= promotionOf(this.#deps.host, { record: this.record, membership: this.membership }); }
  /* R3, R5 (K702): conformance's `determinationRead`, reached on the same host unless a test passes its own; null where
     it cannot be created, and every project then reads null. */
  get conformance() {
    if (this.#deps.conformance === undefined || this.#deps.conformance === null) {
      try { this.#deps.conformance = conformanceOf(this.#deps.host); } catch { this.#deps.conformance = false; }
    }
    return this.#deps.conformance || null;
  }

  /* R10: local-facts' `factStatus`, reached on the same host unless a test passes its own; null where it cannot be
     created, and a business count then states its calendar `not_read` (R12). */
  get localFacts() {
    if (this.#deps.localFacts === undefined || this.#deps.localFacts === null) {
      try { this.#deps.localFacts = localFactsOf(this.#deps.host); } catch { this.#deps.localFacts = false; }
    }
    return this.#deps.localFacts || null;
  }

  /* R7 (K1446): standards' `standardRead` and `inForceAt`, reached on the same host unless a test passes its own; null
     where it cannot be created, and a standard a deadline names then reads undetermined. */
  get standards() {
    if (this.#deps.standards === undefined || this.#deps.standards === null) {
      try { this.#deps.standards = standardsOf(this.#deps.host); } catch { this.#deps.standards = false; }
    }
    return this.#deps.standards || null;
  }

  /* R16 (T45): steps, reached on the same host unless a test passes its own; null where it cannot be created. */
  get steps() {
    if (this.#deps.steps === undefined || this.#deps.steps === null) {
      try { this.#deps.steps = stepsOf(this.#deps.host, { record: this.record, membership: this.membership }); } catch { this.#deps.steps = false; }
    }
    return this.#deps.steps || null;
  }
  /* R17 (T45): duties, reached on the same host unless a test passes its own; null where it cannot be created. */
  get duties() {
    if (this.#deps.duties === undefined || this.#deps.duties === null) {
      try { this.#deps.duties = dutiesOf(this.#deps.host, { record: this.record, membership: this.membership }); } catch { this.#deps.duties = false; }
    }
    return this.#deps.duties || null;
  }

  migrate() { migrateActionClocks(this.sql); }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { for (const r of this.sql.exec(q, ...a)) return r; return null; }

  /* The instance clock: an explicit `now` (the caller's as-of), then the injected clock, then `env.BIO_NOW_MS`, then
     the wall. An ABSENT param is null or "" and falls through, never read as the epoch. */
  #nowMs(explicit) {
    if (explicit !== undefined && explicit !== null && explicit !== "") {
      const e = Number(explicit);
      if (Number.isFinite(e) && e >= 0) return e;
    }
    if (this.now) { const n = Number(this.now()); if (Number.isFinite(n) && n >= 0) return n; }
    const v = Number(this.env && this.env.BIO_NOW_MS);
    if (Number.isFinite(v) && v >= 0) return v;
    return Date.now();
  }
  /* The UTC day of the instance clock: only R11's horizon of years reads it (its "UTC year"); every day a deadline or a
     reminder is judged on is the action's local day (`#localToday`). */
  #today(explicit = null) { return new Date(this.#nowMs(explicit)).toISOString().slice(0, 10); }
  /* R3, R5, R6 (K1444 (iii); actions R12): the local day of the instance clock in the action's zone (R21: `actions.actionZone`, its R100), or
     null when no zone is held: undetermined, never the UTC day. */
  #localToday(fm, view, explicit = null) { return this.#judged(fm, view, explicit).day; }
  /* R3, R5 (N609, K1675): the zone an action's day is judged in at this call and that local day, which each item
     carries so its reader dates and ages it in the zone this module counted in; both null when no zone is held. */
  #judged(fm, view, explicit = null) {
    const zone = actionZone(fm, view);
    return { zone, day: localDayOf(this.#nowMs(explicit), zone) };
  }

  /* R7 (K1431, K1446): what an entry names as its basis: its kind (null when it states none, as every entry written
     before T33-74), its citation, and the kind's own fields; a `rule` naming a held standard answers that standard's
     in-force state on the entry's date (`standards.inForceAt`), the member's citation staying their statement. */
  #basisOf(e, viewer) {
    const kind = e && BASIS_KINDS.includes(e.basis_kind) ? e.basis_kind : null;
    const out = { kind, citation: e && typeof e.basis === "string" ? e.basis : null };
    if (kind === "commitment" && e.committed_by) out.committed_by = String(e.committed_by);
    /* T45 (v0.2 rule 6): the other side's stated date, with who stated it and where it is held; its words name no law. */
    if (kind === "stated") Object.assign(out, { stated_by: e.stated_by ?? null, held_in: e.held_in ?? null,
      says: word("action-clocks.says.date_side_stated") });
    if (kind === "dependency") Object.assign(out, { precedes: e.precedes ?? null, lead: e.lead ?? null, why: e.why ?? null,
      says: word("action-clocks.says.date_derived_event") });
    if (kind === "rule" && typeof e.standard === "string" && e.standard) {
      const st = this.standards;
      let f = null;
      try { f = st && typeof st.inForceAt === "function" ? st.inForceAt({ standard: e.standard, date: e.date, viewer }) : null; }
      catch { f = null; }
      out.standard = { id: e.standard, state: f && typeof f.state === "string" ? f.state : "undetermined",
                       why: f && f.why ? String(f.why) : f ? null : word("action-clocks.why.standards_module_cannot") };
    }
    return out;
  }

  /* R2 (T45): the view a deadline is read from: `local-facts.governingView` (its R12), the active profiles' combined view
     with the group's confirmed rules added, which equals `combine`'s with none; where local-facts cannot answer, the
     active profiles' combined view (record-core R26); null with none active or none combinable. */
  #view() {
    const lf = this.localFacts;
    let g = null;
    try { g = lf && typeof lf.governingView === "function" ? lf.governingView() : null; } catch { g = null; }
    if (g && g.ok && g.view && typeof g.view === "object") return g.view;
    let ids = null;
    try { ids = this.record.getSetting("jurisdiction_profiles"); } catch { ids = null; }
    if (typeof ids === "string") { try { ids = JSON.parse(ids); } catch { ids = null; } }
    if (!Array.isArray(ids) || !ids.length) return null;
    let c = null;
    try { c = this.combine(ids); } catch { c = null; }
    return c && c.ok ? c.view : null;
  }

  /* The action's document, the authority for its clock. */
  #heldFm(id) {
    const f = this.record.readFile(id, "bundle.md");
    if (!f || typeof f.text !== "string") return null;
    let fm = null;
    try { fm = parseFrontmatter(f.text).data; } catch { fm = null; }
    return fm && typeof fm === "object" ? fm : null;
  }
  #visibleAction(id, viewer) {
    const gate = viewerPredicate(viewer);
    return this.#one(`SELECT b.bundle_id, b.object_type, b.current_state FROM bundles b WHERE b.bundle_id=? AND (${gate.sql})`,
                     id, ...gate.args);
  }
  /* R3: the member whose write created the action, from its first manifest entry in write order (record-core R16). */
  #createdBy(id) {
    let entries = [];
    try {
      const im = this.record.readImage(id);
      const m = im ? im["_history/manifest.json"] : null;
      entries = (JSON.parse(typeof m === "string" ? m : "{}").entries) || [];
    } catch { entries = []; }
    const first = [...entries].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))[0];
    return first && typeof first.author === "string" ? first.author : null;
  }
  /* R3, R5 (K702): the action's project is the project of the first determination among its `rests_on` legs, in the
     document's order, read through `conformance.determinationRead` as the read's viewer sees it (a leg naming no
     determination, or one the viewer may not see, is passed over); null when it rests on none. */
  #projectOf(fm, viewer) {
    const conf = this.conformance;
    if (!conf || typeof conf.determinationRead !== "function") return null;
    for (const l of (Array.isArray(fm && fm.action_basis) ? fm.action_basis : [])) {
      if (!l || typeof l !== "object" || l.kind !== "rests_on" || typeof l.target !== "string") continue;
      let d = null;
      try { d = conf.determinationRead({ id: l.target, viewer }); } catch { d = null; }
      if (d && d.ok !== false && typeof d.project === "string" && d.project) return d.project;
    }
    return null;
  }

  /* R1, R3: ONE PAGING RULE over the clock entries of the actions `candidates` reads, in (action id, entry position)
     order after `after`: a previous page's `cursor` (`<action>#<position>`), or an action id, read as after all that
     action's entries. A page reads at most `actionsMax` actions and may end inside one; `cursor` is the last entry
     answered when `truncated`, else null, and when the action bound ends a page past an action with no qualifying
     entry, that action's last position instead, so a page always moves on and paging from the start through each
     `cursor` to null reaches every entry. `candidates(seekId, n)` answers up to `n` rows `{bundle_id}` at or after
     `seekId` in id order; `item(r, i, e, fm)` answers the entry's item (`fm` the action's document, read once a page),
     or null when it does not qualify. */
  #entryPage({ after, max, actionsMax, candidates, item }) {
    const from = after === null || after === undefined || after === "" ? null : String(after);
    const at = from ? /^(.+)#(\d+)$/.exec(from) : null;
    const seek = at ? { id: at[1], pos: Number(at[2]) } : from ? { id: from, pos: Infinity } : null;
    const rows = candidates(seek ? seek.id : null, actionsMax + 1);
    const items = [];
    let truncated = rows.length > actionsMax;
    let full = false, lastRead = null;
    read: for (const r of rows.slice(0, actionsMax)) {
      const fm = this.#heldFm(r.bundle_id) || {};
      const clock = Array.isArray(fm.clock) ? fm.clock : [];
      const skip = seek && r.bundle_id === seek.id ? seek.pos : -1;
      for (let i = skip + 1; i < clock.length; i++) {
        const it = item(r, i, clock[i], fm);
        if (!it) continue;
        /* The page is full and an entry remains: the next page resumes after the last one answered. */
        if (items.length === max) { full = truncated = true; break read; }
        items.push(it);
      }
      lastRead = { id: r.bundle_id, end: Math.max(clock.length - 1, Number.isFinite(skip) ? skip : 0, 0) };
    }
    /* The last entry answered; when the page ends on the action bound past an action whose document holds none (its
       projection behind it), the end of that action instead, so the next page still moves on. */
    const tail = items[items.length - 1];
    const cursor = !truncated ? null
      : tail && (full || !lastRead || tail.action === lastRead.id) ? `${tail.action}#${tail.ord}`
        : lastRead ? `${lastRead.id}#${lastRead.end}` : null;
    return { items, truncated, cursor };
  }

  /* ================================================================ the reads across actions (R1, R3, R7) */

  /** R1 (N237, N311): every `pending` clock entry dated before `before` across visible actions, at most 500 per page,
   *  in (action id, entry position) order after `after` (`#entryPage`). The seek is retrieval's projection
   *  (`bundle_projection`, its R61), joined on `bundle_id`; the entries are read from the document, the authority.
   *  R19 (T46; N918; for `monitoring` R34, R50): each item carries `due_at` and `due_zone` as R3's do, so `monitoring`
   *  reads a timed entry's instant here; the action's zone is read only for a timed entry that states none. */
  pendingClocks({ before, limit = null, after = null, viewer = null } = {}) {
    const day = String(before ?? "").slice(0, 10);
    /* DEC-49 REGION is-pending-before */
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
      return refuse("PENDING_CLOCKS_BAD_BEFORE", localize("action-clocks.index.before_is_a_date", "before= is a date, YYYY-MM-DD"), { before: before ?? null });
    /* END DEC-49 REGION is-pending-before */
    const max = clampLimit(limit, PENDING_CLOCKS_MAX, PENDING_CLOCKS_MAX);
    const gate = viewerPredicate(viewer);
    /* R19: the view and each action's zone, read once a call and only when a timed entry needs them. */
    let view;
    const zones = new Map();
    const zoneOf = (id, fm) => {
      if (view === undefined) view = this.#view();
      if (!zones.has(id)) zones.set(id, actionZone(fm, view));
      return zones.get(id);
    };
    const page = this.#entryPage({
      after, max, actionsMax: PENDING_CLOCKS_ACTIONS_MAX,
      candidates: (seekId, n) => this.#rows(`SELECT b.bundle_id FROM bundles b JOIN ${PROJECTION_TABLE} bp ON bp.bundle_id = b.bundle_id
        WHERE b.object_type='action' AND (${gate.sql}) ${seekId !== null ? "AND b.bundle_id>=?" : ""}
          AND bp.action_clock_next IS NOT NULL AND bp.action_clock_next < ? ORDER BY b.bundle_id LIMIT ?`,
        ...gate.args, ...(seekId !== null ? [seekId] : []), day, n),
      item: (r, i, e, fm) => (!e || e.status !== "pending" || typeof e.date !== "string" || !(e.date < day)) ? null
        : { action: r.bundle_id, ord: i, date: e.date, basis: e.basis ?? null, text: e.text ?? null, past: e.date < day,
            ...dueAtOf(e, () => zoneOf(r.bundle_id, fm)) },
    });
    return { ok: true, before: day, items: page.items, limit: max, actions_limit: PENDING_CLOCKS_ACTIONS_MAX,
             truncated: page.truncated, cursor: page.cursor };
  }

  /** R3 (monitoring R34; for `queue-producers` R15): every clock entry of a visible action that is not `resolved` or
   *  `abandoned` whose stored status is `overdue`, or `pending` with a date before the local day of the instance clock
   *  in the action's zone (K1444 (iii); `actions` R12); each with the action's project, the member who created it and
   *  the entry's basis (R7). Paged as R1 (`#entryPage`), over every open action in id order: an `overdue` entry is not
   *  in the projection's clock, so no seek narrows it. R7: overdue is derived at the read (`past`), and the stored
   *  status is reported beside it, never in place of it. An action whose zone is not held has its pending entries'
   *  lateness undetermined: they are left out and counted in `zone_undetermined`. Each item carries `zone`, the zone
   *  whose local day (`local_day`) it was judged on (N609; null for a stored `overdue` of an action with none held), so
   *  `queue-producers` R15 dates and ages it in the same zone. (T45) Each item also carries `owed_by` (R18), `due_at`
   *  and `due_zone` where the entry states a time of day (else null), `steps` standing for the entry (R16) and, where
   *  an adopted duty's occurrence stands for it, `noticed_by` (R17). It is a question about a date, never a finding:
   *  `says` names no failure. While the action states `reply_owed: false` (`actions` R82), no entry `owed_by: body` is
   *  listed. (T47; N968) Each item also carries `venue`, the office or venue the entry is owed at (R23, `venueOf`), with
   *  `venue_why` when none is held. Writes nothing. */
  overdueClocks({ after = null, limit = null, viewer = null, now = null } = {}) {
    const asOf = this.#today(now);
    const view = this.#view();
    const max = clampLimit(limit, OVERDUE_CLOCKS_MAX, OVERDUE_CLOCKS_MAX);
    const gate = viewerPredicate(viewer);
    const closed = CLOSED_ACTION_STATES.map(() => "?").join(",");
    const who = new Map(), judged = new Map();
    const instant = stampInstant("second", this.#nowMs(now));
    let undetermined = 0;
    const page = this.#entryPage({
      after, max, actionsMax: OVERDUE_CLOCKS_ACTIONS_MAX,
      candidates: (seekId, n) => this.#rows(`SELECT b.bundle_id FROM bundles b
        WHERE b.object_type='action' AND b.current_state NOT IN (${closed}) AND (${gate.sql})
          ${seekId !== null ? "AND b.bundle_id>=?" : ""} ORDER BY b.bundle_id LIMIT ?`,
        ...CLOSED_ACTION_STATES, ...gate.args, ...(seekId !== null ? [seekId] : []), n),
      item: (r, i, e, fm) => {
        if (!e || typeof e !== "object") return null;
        if (!judged.has(r.bundle_id)) judged.set(r.bundle_id, this.#judged(fm, view, now));
        const { zone, day: today } = judged.get(r.bundle_id);
        const dated = typeof e.date === "string" && isDay(e.date);
        if (e.status === "pending" && dated && today === null) { undetermined++; return null; }
        const past = dated && today !== null ? e.date < today : today === null ? null : false;
        if (!(e.status === "overdue" || (e.status === "pending" && past === true))) return null;
        /* T45 (actions R82): no reply is owed, so the body owes no date on this action. */
        if (fm.reply_owed === false && owedOf(e) === "body") return null;
        if (!who.has(r.bundle_id)) who.set(r.bundle_id, { project: this.#projectOf(fm, viewer), created_by: this.#createdBy(r.bundle_id),
                                                          ...venueOf(fm, view) });
        const noticed = this.#noticedBy(r.bundle_id, fm, e, viewer, instant);
        return { action: r.bundle_id, ord: i, date: typeof e.date === "string" ? e.date : null, basis: e.basis ?? null,
                 text: e.text ?? null, status: e.status, past, ...who.get(r.bundle_id), basis_of: this.#basisOf(e, viewer),
                 local_day: today, zone, owed_by: owedOf(e), ...dueAtOf(e, zone),
                 steps: this.#stepsStanding(r.bundle_id, fm, e, viewer), ...(noticed ? { noticed_by: noticed } : {}),
                 says: OVERDUE_SAYS };
      },
    });
    return { ok: true, as_of: asOf, items: page.items, limit: max, actions_limit: OVERDUE_CLOCKS_ACTIONS_MAX,
             truncated: page.truncated, cursor: page.cursor, zone_undetermined: undetermined };
  }

  /** R18 (T45; N882; v0.2 rule 6): the pending entries `owed_by: group` of the visible actions not `resolved` or
   *  `abandoned`, dated in `from`–`to` when given, with basis, date, zone, project and creator as R3's, at most 500 per
   *  page with `cursor` and `truncated` as R1's (`#entryPage`). An entry `owed_by: body` or `undetermined` is never
   *  listed. A reminder on one is only as a member asks (R4, R8); nothing here mints one. Writes nothing. */
  ourDeadlines({ from = null, to = null, after = null, limit = null, viewer = null, now = null } = {}) {
    const f0 = from === null || from === undefined || from === "" ? null : String(from);
    const t0 = to === null || to === undefined || to === "" ? null : String(to);
    if ((f0 !== null && !isDay(f0)) || (t0 !== null && !isDay(t0)) || (f0 !== null && t0 !== null && f0 > t0))
      return { ok: false, reason: "OUR_DEADLINES_REFUSED", code: "OUR_DEADLINES_REFUSED",
               detail: localize("action-clocks.index.from_and_to_are_calendar_days", "from= and to= are calendar days written YYYY-MM-DD, from not after to. Nothing was read.") };
    const view = this.#view();
    const max = clampLimit(limit, OUR_DEADLINES_MAX, OUR_DEADLINES_MAX);
    const gate = viewerPredicate(viewer);
    const closed = CLOSED_ACTION_STATES.map(() => "?").join(",");
    const who = new Map(), judged = new Map();
    const page = this.#entryPage({
      after, max, actionsMax: OUR_DEADLINES_ACTIONS_MAX,
      candidates: (seekId, n) => this.#rows(`SELECT b.bundle_id FROM bundles b
        WHERE b.object_type='action' AND b.current_state NOT IN (${closed}) AND (${gate.sql})
          ${seekId !== null ? "AND b.bundle_id>=?" : ""} ORDER BY b.bundle_id LIMIT ?`,
        ...CLOSED_ACTION_STATES, ...gate.args, ...(seekId !== null ? [seekId] : []), n),
      item: (r, i, e, fm) => {
        if (!e || typeof e !== "object" || e.status !== "pending" || owedOf(e) !== "group" || !isDay(e.date)) return null;
        if ((f0 !== null && e.date < f0) || (t0 !== null && e.date > t0)) return null;
        if (!judged.has(r.bundle_id)) {
          judged.set(r.bundle_id, this.#judged(fm, view, now));
          who.set(r.bundle_id, { project: this.#projectOf(fm, viewer), created_by: this.#createdBy(r.bundle_id) });
        }
        const { zone, day } = judged.get(r.bundle_id);
        return { action: r.bundle_id, ord: i, date: e.date, basis: e.basis ?? null, text: e.text ?? null,
                 basis_of: this.#basisOf(e, viewer), owed_by: "group", zone, local_day: day,
                 past: day === null ? null : e.date < day, ...dueAtOf(e, zone), ...who.get(r.bundle_id) };
      },
    });
    return { ok: true, from: f0, to: t0, items: page.items, limit: max, actions_limit: OUR_DEADLINES_ACTIONS_MAX,
             truncated: page.truncated, cursor: page.cursor };
  }

  /** R24 (T51; N1088, K3189, K4059; DEC-218, DEC-219; for `screens-daily` R64): the `pending` clock entries of the visible
   *  actions not `resolved` or `abandoned`, counted in all and by each entry's `owed_by` (R18), each count with `next`, the
   *  earliest such entry's date (null when none). Reads at most 500 actions (`truncated` stated). Writes nothing. */
  clocksRunning({ viewer = null } = {}) {
    const gate = viewerPredicate(viewer);
    const closed = CLOSED_ACTION_STATES.map(() => "?").join(",");
    const rows = this.#rows(`SELECT b.bundle_id FROM bundles b
      WHERE b.object_type='action' AND b.current_state NOT IN (${closed}) AND (${gate.sql})
      ORDER BY b.bundle_id LIMIT ?`, ...CLOSED_ACTION_STATES, ...gate.args, CLOCKS_RUNNING_ACTIONS_MAX + 1);
    const by_owed = Object.fromEntries(CLOCK_OWED_BY.map((k) => [k, { count: 0, next: null }]));
    let total = 0;
    for (const r of rows.slice(0, CLOCKS_RUNNING_ACTIONS_MAX)) {
      const fm = this.#heldFm(r.bundle_id) || {};
      for (const e of Array.isArray(fm.clock) ? fm.clock : []) {
        if (!e || typeof e !== "object" || e.status !== "pending") continue;
        const b = by_owed[owedOf(e)];
        total++;
        b.count++;
        if (isDay(e.date) && (b.next === null || e.date < b.next)) b.next = e.date;
      }
    }
    return { ok: true, total, by_owed, actions_limit: CLOCKS_RUNNING_ACTIONS_MAX, truncated: rows.length > CLOCKS_RUNNING_ACTIONS_MAX };
  }

  /* ================================================================ one date, one reminder (R16, R17) */

  /* R16: the actions a step is tied to: those it produced (`steps.productsOf`, its R9) and those it waits on the
     arrival of (`waits`, its R11 as R29 hands them), each `{id, by}` once. Read in process; never throws. */
  #tiesOf(step, waits, viewer) {
    const st = this.steps;
    const out = new Map();
    if (st && typeof st.productsOf === "function") {
      let p = null;
      try { p = st.productsOf({ step, viewer }); } catch { p = null; }
      for (const x of p && Array.isArray(p.products) ? p.products : [])
        if (x && x.kind === "record" && typeof x.id === "string") out.set(x.id, "product");
    }
    for (const w of Array.isArray(waits) ? waits : []) {
      const a = w && w.on && w.on.arrival;
      if (a && typeof a.id === "string" && !out.has(a.id)) out.set(a.id, `wait:${a.kind}`);
    }
    return out;
  }
  /* R16: the pending entries standing for a step dated `day`: of each action it is tied to that `viewer` may see (an
     arrival wait ties it only when its kind is the action's own kind), every pending entry dated that local day. */
  #entriesFor(step, day, waits, viewer) {
    if (!isDay(day)) return [];
    const out = [];
    for (const [id, by] of this.#tiesOf(step, waits, viewer)) {
      const b = this.#visibleAction(id, viewer);
      if (!b || normalizeType(b.object_type) !== "action") continue;
      const fm = this.#heldFm(id) || {};
      if (by !== "product" && by !== `wait:${fm.action_kind}`) continue;
      (Array.isArray(fm.clock) ? fm.clock : []).forEach((e, i) => {
        if (e && typeof e === "object" && e.status === "pending" && e.date === day) out.push({ action: id, entry: i, e, by });
      });
    }
    return out;
  }
  /** R16 (K2823): steps' due holder (its R29), registered at start. `{entry: {action, position}}` for the one pending
   *  entry standing for the step, where every viewer of the step's place sees the action: an action in no project
   *  (every member sees it), or a step placed in the action's own project; else `{entry: "clock"}`, held and unnamed.
   *  Null for none or several. Never throws. */
  stepDueHolder(asked) {
    try {
      const { step, byWhen, waits } = asked && typeof asked === "object" ? asked : {};
      const day = byWhen && typeof byWhen === "object" ? byWhen.date : null;
      const found = this.#entriesFor(step, day, waits, IN_PROCESS);
      if (found.length !== 1) return null;
      const { action, entry, by } = found[0];
      const project = (this.#one(`SELECT project FROM bundles WHERE bundle_id=?`, action) || {}).project || "";
      if (!project) return { entry: { action, position: entry } };
      let placed = null;
      if (by === "product") {
        try {
          const r = this.steps.stepsOf({ record: action, viewer: IN_PROCESS });
          placed = ((r && r.steps) || []).find((x) => x && x.step === step) || null;
        } catch { placed = null; }
      }
      return placed && placed.project === project ? { entry: { action, position: entry } } : { entry: "clock" };
    } catch { return null; }
  }

  /** R16 (T45; DESIGN §11): the one pending clock entry standing for `step` that `viewer` may see, `{action, entry, date,
   *  basis}`, or null (none, more than one, a step `viewer` may not see, or no steps here). Writes nothing; never throws. */
  clockForStep({ step = null, viewer = null } = {}) {
    try {
      const st = this.steps;
      if (!st || typeof st.step !== "function") return null;
      const s = st.step({ step, viewer });
      if (!s || s.ok === false) return null;
      const found = this.#entriesFor(s.step, s.byWhen && s.byWhen.date, s.waits, viewer);
      if (found.length !== 1) return null;
      const { action, entry, e } = found[0];
      return { action, entry, date: e.date, basis: e.basis ?? null };
    } catch { return null; }
  }

  /* R16: the ids of the steps `viewer` may see standing for entry `e` of the action: tied to it (its products, and its
     arrival waits of the action's kind) and dated its local day. In id order; [] with no steps here. */
  #stepsStanding(id, fm, e, viewer) {
    const st = this.steps;
    if (!st || !e || !isDay(e.date)) return [];
    const ids = new Set();
    try { for (const x of (st.stepsOf({ record: id, viewer }) || {}).steps || []) if (x && x.step) ids.add(x.step); } catch { /* none */ }
    try {
      for (const x of (st.stepsWaitingOn({ kind: fm.action_kind, id }) || {}).steps || []) if (x && x.step) ids.add(x.step);
    } catch { /* none */ }
    const out = [];
    for (const sid of ids) {
      let s = null;
      try { s = st.step({ step: sid, viewer }); } catch { s = null; }
      if (s && s.ok !== false && s.byWhen && s.byWhen.date === e.date) out.push(sid);
    }
    return out.sort();
  }

  /* R17 (T45; DESIGN §2.6): the adopted duty occurrence that stands for entry `e`: a duty of the addressee office (the
     counterparty's `entity_id`), not withdrawn, with an occurrence triggered by one of this action's own `sent` entries
     (`actions` R67's source, `<action>#correspondence/<n>`) whose due date, or a candidate of it, is the entry's date.
     `{duty, occurrence}`, or null. Never throws. */
  #noticedBy(id, fm, e, viewer, asOf) {
    try {
      const du = this.duties;
      const cp = fm && fm.counterparty;
      const office = cp && typeof cp === "object" && typeof cp.entity_id === "string" ? cp.entity_id : null;
      if (!du || !office || !e || !isDay(e.date)) return null;
      const sent = (Array.isArray(fm.correspondence) ? fm.correspondence : [])
        .map((x, ord) => ({ x, ord })).filter(({ x }) => x && x.direction === "sent" && typeof x.at === "string" && isDay(x.at.slice(0, 10)));
      if (!sent.length) return null;
      const refs = new Set(sent.map(({ ord }) => `${id}#correspondence/${ord}`));
      const first = sent.map(({ x }) => x.at.slice(0, 10)).sort()[0];
      const list = du.dutiesOf({ entity: office, as: "obligor", viewer, limit: 500 });
      for (const d of list && Array.isArray(list.duties) ? list.duties : []) {
        if (!d || d.withdrawn) continue;
        const o = du.occurrencesOf({ dutyId: d.duty_id, from: first, to: e.date, asOf, viewer });
        for (const occ of o && Array.isArray(o.occurrences) ? o.occurrences : []) {
          if (!occ || !occ.trigger || !refs.has(occ.trigger.ref)) continue;
          const due = occ.due && occ.due.date;
          const days = due && Array.isArray(due.candidates) ? due.candidates.map((c) => String(c && c.value || "").slice(0, 10))
            : [String(due && due.value || due || "").slice(0, 10)];
          if (days.includes(e.date)) return { duty: d.duty_id, occurrence: occ.key };
        }
      }
      return null;
    } catch { return null; }
  }

  /* ================================================================ the proposal (R2) */

  /** R2 (was `actions` R32; C-1, C-2, C-4, K1444, K1445): a clock entry computed from a profile deadline that applies
   *  to the action's kind, by `civil-time` (`computeDeadline`), stored apart with its trace and labelled; never written
   *  into `clock[]` (R13's adoption, a member's act, is the one way it reaches the document). Its basis kind is `rule`
   *  (R7). A rule whose basis is absent or `UNMEASURED` is no basis: its date is undetermined (K1445). (T45) The
   *  deadlines read are `local-facts.governingView`'s (`#view`); a `received` rule counts from the receipt `actions`
   *  records and a `served` rule from the recorded service (`#receiptsOf`; `count.mjs` `startOf`), the answer saying
   *  which; the entry carries `owed_by` from the deadline's (R18), `undetermined` where the profile does not say. */
  clockPropose({ target, rule, layer = null, proposer = null, viewer = null } = {}) {
    const who = String(proposer ?? "").trim();
    if (!who) return { ok: false, reason: "NO_AUTHOR", detail: localize("action-clocks.index.this_call_carries_nobody", "this call carries nobody: the proposer is stamped from the credential that asked.") };
    if (!target) return { ok: false, reason: "NO_TARGET", detail: localize("action-clocks.index.one_action_at_a_time", "one action at a time: pass target=<action id>") };
    /* R2 (N246): an absent `rule` has no code of its own; it is answered `NO_SUCH_RULE` at that code's place. */
    const b = this.#visibleAction(target, viewer);
    if (!b) return { ok: false, reason: "NO_SUCH_BUNDLE", target };
    if (normalizeType(b.object_type) !== "action")
      return { ok: false, reason: "NOT_AN_ACTION", target, object_type: b.object_type };
    const fm = this.#heldFm(target) || {};
    const view = this.#view();
    /* R28 (T53; jurisdictions R121): the rule resolved for the action's kind over the view's layers, `layer` naming one. */
    const res = rule ? ruleFor(view, fm.action_kind, String(rule), layer) : { d: null, layer: null };
    if (res.ambiguous)
      return { ok: false, reason: "NAME_AMBIGUOUS", target, rule: String(rule).slice(0, 200), layers: res.ambiguous,
               deadlines: deadlinesFor(view, fm.action_kind, fm),
               detail: localize("action-clocks.index.rule_given_by_two_layers", "more than one active layer gives a deadline '{rule}' for an action of kind '{kind}': name the layer (layer=<layer id>, or rule=<layer id>:<rule>). Nothing was written.", { rule: String(rule).slice(0, 60), kind: String(fm.action_kind) }) };
    const d = res.d;
    if (!d) return { ok: false, reason: "NO_SUCH_RULE", target, rule: rule || null, deadlines: deadlinesFor(view, fm.action_kind, fm),
      detail: rule ? localize("action-clocks.index.no_active_profile_states", "no active profile states a deadline '{rule}' for an action of kind '{kind}'", { rule: String(rule).slice(0, 60), kind: String(fm.action_kind) })
                   : localize("action-clocks.index.no_rule_was_named", "no rule was named: name the profile deadline's rule (rule=<rule>) for an action of kind '{kind}'", { kind: String(fm.action_kind) }) };
    const sourced = typeof d.basis === "string" && d.basis.trim() && d.basis !== "UNMEASURED";
    /* R28, R29 (jurisdictions R104): each closure list the rule reads is the one its own layer resolves; another layer's
       list of the same name is not counted on. */
    const lists = listsOfRule(d, view, res.layer);
    const cview = lists.some((l) => l.layer) && view ? { ...view, holidays: (Array.isArray(view.holidays) ? view.holidays : []).filter((h) => {
      const l = h && lists.find((x) => x.layer && x.name === h.list);
      return !l || layerOf(h, view) === l.layer;
    }) } : view;
    const computed = sourced ? computeDeadline(d, fm, cview, { factOf: this.#factOf(viewer), receipts: this.#receiptsOf(target, viewer) })
      : { date: null, why: localize("action-clocks.index.the_rule_is_not_held", "the rule is not held with a primary source: UNMEASURED is not a basis") };
    const basis = `${d.citation}${d.basis ? ` (profile basis: ${d.basis}${d.profile ? `, ${d.profile}` : ""})` : ""}`;
    const amount = d.amount ?? d.days;
    const unit = (d.units ?? "days") === "days" ? `${d.count ?? ""} day${amount === 1 ? "" : "s"}`.trim() : String(d.units).replace(/_/g, " ");
    /* R18 (T45; jurisdictions R75): whose deadline it is, from the profile's; undetermined where it does not say. */
    const owed = d.owed_by === "group" || d.owed_by === "body" ? d.owed_by : "undetermined";
    const entry = { text: d.rule, description: `${amount} ${unit} ${d.direction === "backward" ? "before" : "from"} ${d.starts}`,
                    date: computed.date, basis, status: "pending", basis_kind: "rule", owed_by: owed, ...(res.layer ? { layer: res.layer } : {}) };
    /* R28: a new proposal of a layer's rule is stored as `<layer id>:<rule>`, so two layers' rules stand apart under the
       table's key; a view of no layers stores the rule as before. */
    const stored = res.layer ? `${res.layer}:${d.rule}` : d.rule;
    const qualified = (n) => { const l = lists.find((x) => x.name === n); return l && l.layer ? `${l.layer}:${n}` : n; };
    const at = stampInstant("second", this.#nowMs(null));
    const kept = { trace: computed.trace ?? null, due: computed.due ?? null, candidates: computed.candidates ?? null,
                   extension: computed.extension ?? null, observed: computed.observed ?? null, calendar: computed.calendar ?? null,
                   start: computed.start ?? null, start_from: computed.start_from ?? null, start_note: computed.start_note ?? null,
                   trace_line: computed.date ? traceLine(computed) : null };
    /* R28: the trace kept names each closure list it counted on as `<layer id>:<name>`. */
    if (kept.trace && typeof kept.trace === "object" && typeof kept.trace.closures === "string")
      kept.trace = { ...kept.trace, closures: qualified(kept.trace.closures) };
    if (lists.length) kept.closures = lists.map((l) => qualified(l.name));
    this.sql.exec(`INSERT INTO action_clock_proposals (bundle_id, proposed_by, rule, date, basis, entry_json, why, proposed_at,
        trace_json, adopted_by, adopted_at, adopted_ord, layer)
      VALUES (?,?,?,?,?,?,?,?,?,NULL,NULL,NULL,?) ON CONFLICT(bundle_id, proposed_by, rule) DO UPDATE SET date=excluded.date,
      basis=excluded.basis, entry_json=excluded.entry_json, why=excluded.why, proposed_at=excluded.proposed_at,
      trace_json=excluded.trace_json, adopted_by=NULL, adopted_at=NULL, adopted_ord=NULL, layer=excluded.layer`,
      target, who, stored, computed.date, basis, JSON.stringify(entry), computed.why ?? null, at, JSON.stringify(kept), res.layer);
    return { ok: true, target, weight: "single", evidence: false,
             proposal: { ...proposalLabelFor(who), key: `${stored}@${who}`, rule: d.rule, ...(res.layer ? { layer: res.layer } : {}), entry, at,
                         ...(computed.start ? { start: computed.start, counted_from: word("action-clocks.day", { start: String(computed.start) }) } : {}),
                         ...(computed.start_from ? { start_from: computed.start_from } : {}),
                         ...(computed.start_note ? { start_note: computed.start_note } : {}),
                         ...(computed.candidates ? { candidates: computed.candidates } : {}),
                         ...(computed.due ? { due: computed.due } : {}),
                         ...(computed.extension ? { extension: computed.extension } : {}),
                         ...(computed.observed ? { observed: computed.observed } : {}),
                         ...(computed.trace ? { trace: computed.trace } : {}),
                         ...(computed.calendar ? { calendar: computed.calendar } : {}),
                         ...(computed.date ? {} : { undetermined: computed.why }) },
             says: localize("action-clocks.index.this_clock_entry_is_proposed", "this clock entry is proposed and is not on the action's clock: a member adopts it (op=clockadopt) or states a clock entry by a revision of the action.") };
  }

  /** R20 (T46; N925; for `affordances` R51; `op=clockproposals`, a read): the standing proposals of R2 on an action the
   *  viewer may see, those not yet adopted (R13), in (rule, proposer) order: each with the key R13 adopts it by
   *  (`<rule>@<proposer>`), the rule, its date or `undetermined` with why, its basis, the entry R2 proposed, the trace
   *  R2 answered (with its one-line account, and the candidates and due instant where it has them), its label (machine
   *  work, a member's, or unstated) and when it was proposed; `[]` when none stands, at most 500 with `truncated`. An
   *  absent or invisible action answers `actions.noSuchAction` (its R43). Writes nothing. */
  clockProposalsFor({ action = null, viewer = null } = {}) {
    const a = this.#actionFor(action, viewer);
    if (!a) return noSuchAction(action ?? null);
    const rows = this.#rows(`SELECT proposed_by, rule, layer, date, basis, entry_json, why, proposed_at, trace_json
      FROM action_clock_proposals WHERE bundle_id=? AND adopted_at IS NULL ORDER BY rule, proposed_by LIMIT ?`,
      a.id, CLOCK_PROPOSALS_MAX + 1);
    const parse = (t) => { try { const v = JSON.parse(t || "null"); return v && typeof v === "object" ? v : null; } catch { return null; } };
    const proposals = rows.slice(0, CLOCK_PROPOSALS_MAX).map((r) => {
      const kept = parse(r.trace_json) || {};
      const dated = typeof r.date === "string" && r.date !== "";
      /* R28: a layer's proposal is keyed `<layer id>:<rule>@<proposer>` and answers its rule and layer apart. */
      const ly = typeof r.layer === "string" && r.layer && r.rule.startsWith(`${r.layer}:`) ? r.layer : null;
      return { key: `${r.rule}@${r.proposed_by}`, rule: ly ? r.rule.slice(ly.length + 1) : r.rule, ...(ly ? { layer: ly } : {}), date: dated ? r.date : null,
               undetermined: dated ? null : (r.why || word("action-clocks.count_undetermined")), basis: r.basis, entry: parse(r.entry_json),
               trace: kept.trace ?? null, trace_line: kept.trace_line ?? null,
               ...(Array.isArray(kept.candidates) ? { candidates: kept.candidates } : {}), ...(kept.due ? { due: kept.due } : {}),
               label: proposalLabelFor(r.proposed_by), proposed_by: r.proposed_by, proposed_at: r.proposed_at };
    });
    return { ok: true, action: a.id, proposals, limit: CLOCK_PROPOSALS_MAX, truncated: rows.length > CLOCK_PROPOSALS_MAX };
  }

  /* R10, R12: the count's reader of the holiday entries' confirmations is `factReader` over this host's local-facts, the
     one reader (R12): null where local-facts cannot be created or has no `factStatus`, and the count then states its
     calendar `not_read`. */
  #factOf(viewer) { return factReader(this.localFacts, viewer); }

  /* R2 (T45; actions R80): the receipt and service records `actions` holds for the action, as its read answers them
     (`receipts`, oldest first), or null when none can be read. */
  #receiptsOf(target, viewer) {
    let r = null;
    try { r = this.actions.actionRead({ id: String(target), viewer }); } catch { r = null; }
    return r && r.ok !== false && Array.isArray(r.receipts) ? r.receipts : null;
  }

  /** R11 (for `queue-producers` R21, through `local-facts` R4): the `local-facts` paths a live deadline reads, once each,
   *  with the actions that read them. For every visible action not `resolved` or `abandoned` whose kind has a profile
   *  deadline counted in business days: its offices' `hours`; when one of its kind's deadlines reads the office
   *  calendar (`readsOfficeCalendar`: a count that skips or rolls past closed days and names no closure list), the
   *  office-calendar entries that apply to its offices (R10); and (N689, K1847) for each named closure list one of its
   *  kind's deadlines counts or rolls on, as its `closures` or its `observed.closures` (`closureListsRead`), that list's
   *  entries for the same offices, each at its own path (`list=<name>`, local-facts R6), the path R12 reads it at;
   *  each for every year from the UTC year of the instance clock to the year of its latest pending clock entry, and at
   *  least the next year. A path a rule and an `observed` both name is listed once. Only facts the active profiles hold
   *  are paths (a year they do not list has no fact to confirm, and a count reaching it is undetermined, jurisdictions
   *  R33). Each path's actions are `{action, project, created_by}`, the project and creator as R3 computes them
   *  (K1000). At most 500 actions read, `truncated` stated. */
  calendarFactsRead({ viewer = null, now = null } = {}) {
    const today = this.#today(now);
    const view = this.#view();
    const deadlines = (view && Array.isArray(view.deadlines) ? view.deadlines : []).filter((d) => d && typeof d.applies_to === "string");
    const business = new Set(deadlines.filter((d) => d.count === "business").map((d) => d.applies_to));
    const calendarKinds = new Set(deadlines.filter(readsOfficeCalendar).map((d) => d.applies_to));
    /* N689: each kind's named closure lists, read by a rule's count or roll or by its observed practice; (R27, T53) each
       resolved from its rule's own layer (jurisdictions R104, R121), `{name, layer}`, `layer` null in a view of no layers. */
    const listsOf = new Map();
    for (const d of deadlines)
      for (const l of listsOfRule(d, view, layerOf(d, view))) {
        if (!listsOf.has(d.applies_to)) listsOf.set(d.applies_to, new Map());
        listsOf.get(d.applies_to).set(`${l.layer ?? ""}|${l.name}`, l);
      }
    /* R27 (jurisdictions R108): the last year each layer's closure lists hold, as the view states it. */
    const through = new Map((view && Array.isArray(view.layers) ? view.layers : [])
      .filter((l) => l && Number.isInteger(l.holidays_through)).map((l) => [l.id, l.holidays_through]));
    const gate = viewerPredicate(viewer);
    const closed = CLOSED_ACTION_STATES.map(() => "?").join(",");
    const rows = business.size ? this.#rows(`SELECT b.bundle_id FROM bundles b
      WHERE b.object_type='action' AND b.current_state NOT IN (${closed}) AND (${gate.sql}) ORDER BY b.bundle_id LIMIT ?`,
      ...CLOSED_ACTION_STATES, ...gate.args, CALENDAR_FACTS_ACTIONS_MAX + 1) : [];
    const read = new Map(), pathLayer = new Map(), ending = new Map();
    const add = (path, a, layer = null) => {
      if (typeof path !== "string" || !path) return;
      if (!read.has(path)) read.set(path, []);
      if (!read.get(path).includes(a)) read.get(path).push(a);
      if (layer && !pathLayer.has(path)) pathLayer.set(path, layer);
    };
    const y0 = Number(today.slice(0, 4));
    for (const r of rows.slice(0, CALENDAR_FACTS_ACTIONS_MAX)) {
      const fm = this.#heldFm(r.bundle_id) || {};
      if (!business.has(fm.action_kind)) continue;
      /* K1000: the action as its paths answer it, one object shared by every path it reads. */
      const a = { action: r.bundle_id, project: this.#projectOf(fm, viewer), created_by: this.#createdBy(r.bundle_id) };
      const offices = actionOffices(fm, view);
      const lists = [...(listsOf.get(fm.action_kind) || new Map()).values()]
        .sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : String(x.layer ?? "") < String(y.layer ?? "") ? -1 : 1));
      if (calendarKinds.has(fm.action_kind) || lists.length) {
        let y1 = y0 + 1;
        for (const e of Array.isArray(fm.clock) ? fm.clock : [])
          if (e && e.status === "pending" && isDay(e.date)) y1 = Math.max(y1, Number(e.date.slice(0, 4)));
        /* null: the office calendar; a name: that closure list's entries, at their own paths, those of its own layer. */
        const reads = [...(calendarKinds.has(fm.action_kind) ? [null] : []), ...lists];
        for (let y = y0; y <= y1; y++)
          for (const l of reads)
            for (const h of yearEntries(view, offices, y, l ? l.name : null).entries) {
              if (l && l.layer && layerOf(h, view) !== l.layer) continue;
              try { add(factPath(holidayFact(h)), a, layerOf(h, view)); } catch { /* no path */ }
            }
        /* R27 (T53; jurisdictions R108): a list whose layer's holidays end before the count's last year is due to be
           confirmed or extended, naming the layer and the years it lacks. */
        for (const l of lists) {
          const t = l.layer ? through.get(l.layer) : undefined;
          if (t === undefined || y1 <= t) continue;
          const k = `${l.layer}|${l.name}`;
          if (!ending.has(k)) ending.set(k, { list: l.name, layer: l.layer, holidays_through: t, years: new Set(), actions: [] });
          const x = ending.get(k);
          for (let y = Math.max(t + 1, y0); y <= y1; y++) x.years.add(y);
          if (!x.actions.includes(a)) x.actions.push(a);
        }
      }
      for (const f of officeHours(view, offices)) { try { add(factPath(f), a); } catch { /* no path */ } }
    }
    const paths = [...read.keys()].sort().map((path) => ({ path, ...(pathLayer.has(path) ? { layer: pathLayer.get(path) } : {}),
                                                         actions: read.get(path).map((a) => ({ ...a })) }));
    const lists_ending = [...ending.keys()].sort().map((k) => { const x = ending.get(k);
      return { list: x.list, layer: x.layer, holidays_through: x.holidays_through, years: [...x.years].sort((p, q) => p - q),
               actions: x.actions.map((a) => ({ ...a })) }; });
    return { ok: true, as_of: today, paths, lists_ending, actions_limit: CALENDAR_FACTS_ACTIONS_MAX,
             truncated: rows.length > CALENDAR_FACTS_ACTIONS_MAX };
  }

  /* ================================================================ the reminders (R4–R6, R8) */

  /* R4, R6, R8: a reminder is a member's own request. A machine credential, or a call stamped with nobody, is refused
     by shape (REC-46's one predicate) before anything else is asked. */
  #machineReminder(author) {
    const who = String(author ?? "").trim();
    /* DEC-49 REGION is-machine-reminder */
    if (!who || isMachineIdentity(who))
      return refuse("MACHINE_CANNOT_SET_REMINDER", localize("action-clocks.index.a_reminder_is_a_member", "a reminder is a member's own request to be reminded, set, changed and answered by that member alone. A machine credential never sets one, and a call that carries nobody is not a member. Nothing was changed."));
    /* END DEC-49 REGION is-machine-reminder */
    return null;
  }
  /* R4, R6: the action as the viewer may see it, through `actions`' read (its R29); absent, invisible and not an action
     are answered alike, through `actions`' one answer (its R43). */
  #actionFor(target, viewer) {
    const r = target ? this.actions.actionRead({ id: String(target), viewer }) : null;
    return r && r.ok ? r : null;
  }
  #standing(target) {
    return this.#one(`SELECT COUNT(*) AS n FROM action_reminders WHERE bundle_id=? AND answered_at IS NULL
                       AND removed_at IS NULL`, target).n;
  }
  #held(target, entry, day, who) {
    return this.#one(`SELECT rid, day FROM action_reminders WHERE bundle_id=? AND entry=? AND day=? AND set_by=?
                       AND answered_at IS NULL AND removed_at IS NULL ORDER BY rid LIMIT 1`, target, entry, day, who);
  }

  /** R4 (`op=reminderset`; DEC-94, K624 (3)): a member asks to be reminded of the dated clock entry at position `entry`
   *  of the action `target` on the day `on`; with `from`, changes their own reminder on that entry from `from` to `on`,
   *  or with `on: null` removes it. A row of this module's own table, never a field or a revision of the action's
   *  document, which this act leaves unchanged. */
  reminderSet({ target, entry, on = null, from = null, author = null, viewer = null } = {}) {
    const machine = this.#machineReminder(author);
    if (machine) return { ...machine, target: target ?? null };
    const who = String(author).trim();
    const a = this.#actionFor(target, viewer);
    if (!a) return noSuchAction(target ?? null);
    const pos = typeof entry === "number" ? entry : /^\d+$/.test(String(entry ?? "").trim()) ? Number(String(entry).trim()) : NaN;
    const e = Number.isInteger(pos) && pos >= 0 ? a.clock[pos] : undefined;
    if (!e || typeof e !== "object" || !isDay(e.date))
      return reminderRefused("entry", localize("action-clocks.index.entry_names_no_clock_entry", "entry {entry} names no clock entry of this action with a YYYY-MM-DD date: a reminder is set on a dated deadline. Nothing was changed.", { entry: String(String(entry ?? "").slice(0, 20) || localize("action-clocks.index.none", "(none)")) }),
        { target: a.id, entry: entry ?? null });
    const day = on === null || on === undefined || on === "" ? null : String(on).trim();
    const was = from === null || from === undefined || from === "" ? null : String(from).trim();
    if (day === null && was === null)
      return reminderRefused("on", localize("action-clocks.index.on_is_the_day_to", "on= is the day to be reminded, YYYY-MM-DD; with no day, name the reminder to remove as from=. Nothing was changed."), { target: a.id, entry: pos });
    if (day !== null && !isDay(day))
      return reminderRefused("on", localize("action-clocks.index.on_day_is_not_a_date", "on '{day}' is not a date written YYYY-MM-DD. Nothing was changed.", { day: String(day.slice(0, 20)) }),
        { target: a.id, entry: pos, on: day.slice(0, 20) });
    const at = stampInstant("second", this.#nowMs(null));
    return this.record.transact(() => {
      const old = was === null ? null : this.#held(a.id, pos, was, who);
      if (was !== null && !old)
        return reminderRefused("from", localize("action-clocks.index.from_names_no_reminder_of_yours", "from {from} names no reminder of yours on this entry: you change or remove only a reminder you set. Nothing was changed.", { from: String(was.slice(0, 20)) }), { target: a.id, entry: pos, from: was.slice(0, 20) });
      if (day !== null && this.#held(a.id, pos, day, who))
        return reminderRefused("held", localize("action-clocks.index.you_already_hold_a_reminder", "you already hold a reminder on this entry for {day}. Nothing was changed.", { day: String(day) }),
          { target: a.id, entry: pos, on: day });
      if (day !== null && !old && this.#standing(a.id) >= REMINDERS_PER_ACTION_MAX)
        return reminderRefused("bound", localize("action-clocks.index.this_action_holds_max_reminders_changed", "this action holds {max} reminders, the most it holds. Nothing was changed.", { max: String(REMINDERS_PER_ACTION_MAX) }), { target: a.id, entry: pos, max: REMINDERS_PER_ACTION_MAX });
      if (old) this.sql.exec(`UPDATE action_reminders SET removed_at=? WHERE rid=?`, at, old.rid);
      if (day !== null)
        this.sql.exec(`INSERT INTO action_reminders (bundle_id, entry, day, set_by, set_at) VALUES (?,?,?,?,?)`,
          a.id, pos, day, who, at);
      return { ok: true, target: a.id, entry: pos, on: day, from: was };
    });
  }

  /** R4: an action's reminders, each with its entry, its day, who set it, when, and its state (`waiting`, `due` or
   *  `answered`; `undetermined` while the action's zone is not held), in (entry, day, member) order, at most 500 with
   *  `truncated`; `as_of` is the action's local day. A reminder changed or removed is gone. */
  remindersFor({ action, viewer = null, now = null } = {}) {
    const a = this.#actionFor(action, viewer);
    if (!a) return noSuchAction(action ?? null);
    /* R5 (K1444 (iii)): due on the action's local day; with no zone held, a standing reminder's state is undetermined. */
    const today = this.#localToday(this.#heldFm(a.id) || {}, this.#view(), now);
    const rows = this.#rows(`SELECT entry, day, set_by, set_at, answered_at FROM action_reminders
      WHERE bundle_id=? AND removed_at IS NULL ORDER BY entry, day, set_by, rid LIMIT ?`, a.id, REMINDERS_READ_MAX + 1);
    const reminders = rows.slice(0, REMINDERS_READ_MAX).map((r) => ({
      entry: r.entry, on: r.day, set_by: r.set_by, set_at: r.set_at, answered_at: r.answered_at ?? null,
      state: r.answered_at ? "answered" : today === null ? "undetermined" : r.day <= today ? "due" : "waiting" }));
    return { ok: true, action: a.id, as_of: today, reminders, limit: REMINDERS_READ_MAX,
             truncated: rows.length > REMINDERS_READ_MAX, standing_max: REMINDERS_PER_ACTION_MAX };
  }

  /** R5 (for `queue-producers` R18): every reminder whose day has come at `nowMs` and that is not answered, on an entry
   *  still `pending` of a visible action not `resolved` or `abandoned`, at most 500 per page in (action id, entry
   *  position, day) order (then the member, so the order is total). `cursor` is the last reminder answered,
   *  `<action>#<position>#<day>#<member>`, when `truncated`, else null; `after` is a previous page's cursor or an action
   *  id, read as after all that action's reminders. The entry is read as it stands (an entry a later revision removed
   *  or re-dated is answered only while the entry at that position is pending). A day "has come" on the local day of
   *  `nowMs` in the action's zone (Terms; K1444 (iii)): never the UTC day, and not at all while no zone is held. Each
   *  item carries `zone`, the zone whose local day its reminder was judged due on (N609), for `queue-producers` R18.
   *  (T45) Each item also carries `steps`, the steps standing for its entry (R16). Writes nothing. */
  remindersDue({ nowMs = null, after = null, limit = null, viewer = null } = {}) {
    const today = this.#today(nowMs);
    const view = this.#view();
    /* K1444 (iii): a reminder's day has come on the action's local day. The SQL bound is the latest local day any zone
       has reached (UTC+14), each row then judged on its own action's day; an action with no zone held is not due. */
    const bound = new Date(this.#nowMs(nowMs) + 14 * 3600000).toISOString().slice(0, 10);
    const judged = new Map();
    const judgedOf = (id) => { if (!judged.has(id)) judged.set(id, this.#judged(fmOf(id), view, nowMs)); return judged.get(id); };
    const max = clampLimit(limit, REMINDERS_DUE_MAX, REMINDERS_DUE_MAX);
    const gate = viewerPredicate(viewer);
    const closed = CLOSED_ACTION_STATES.map(() => "?").join(",");
    const from = after === null || after === undefined || after === "" ? null : String(after);
    const at = from ? /^(.+)#(\d+)#(\d{4}-\d{2}-\d{2})#(.*)$/.exec(from) : null;
    /* The seek: strictly after the named reminder, or after every reminder of the named action. */
    const seek = at ? { sql: `AND (r.bundle_id > ? OR (r.bundle_id = ? AND (r.entry > ? OR (r.entry = ? AND (r.day > ?
                               OR (r.day = ? AND r.set_by > ?))))))`,
                        args: [at[1], at[1], Number(at[2]), Number(at[2]), at[3], at[3], at[4]] }
      : from ? { sql: "AND r.bundle_id > ?", args: [from] } : { sql: "", args: [] };
    const docs = new Map();
    const fmOf = (id) => { if (!docs.has(id)) docs.set(id, this.#heldFm(id) || {}); return docs.get(id); };
    const items = [];
    let truncated = false;
    let cur = { sql: seek.sql, args: seek.args };
    /* Read on in order until the page is full or the reminders run out; a due reminder whose entry is no longer
       pending is passed over. Each batch reads one more than the page can still take. */
    for (;;) {
      const rows = this.#rows(`SELECT r.bundle_id, r.entry, r.day, r.set_by FROM action_reminders r
        JOIN bundles b ON b.bundle_id = r.bundle_id
        WHERE r.answered_at IS NULL AND r.removed_at IS NULL AND r.day <= ? AND b.object_type='action'
          AND b.current_state NOT IN (${closed}) AND (${gate.sql}) ${cur.sql}
        ORDER BY r.bundle_id, r.entry, r.day, r.set_by LIMIT ?`,
        bound, ...CLOSED_ACTION_STATES, ...gate.args, ...cur.args, max + 1);
      let last = null;
      for (const r of rows) {
        last = r;
        const clock = Array.isArray(fmOf(r.bundle_id).clock) ? fmOf(r.bundle_id).clock : [];
        const e = clock[r.entry];
        if (!e || typeof e !== "object" || e.status !== "pending") continue;
        const { zone, day: local } = judgedOf(r.bundle_id);
        if (local === null || r.day > local) continue;
        if (items.length === max) { truncated = true; break; }
        items.push({ action: r.bundle_id, ord: r.entry, date: e.date ?? null, basis: e.basis ?? null, text: e.text ?? null,
                     on: r.day, set_by: r.set_by, project: this.#projectOf(fmOf(r.bundle_id), viewer), zone,
                     steps: this.#stepsStanding(r.bundle_id, fmOf(r.bundle_id), e, viewer) });
      }
      if (truncated || rows.length <= max || !last) break;
      cur = { sql: `AND (r.bundle_id > ? OR (r.bundle_id = ? AND (r.entry > ? OR (r.entry = ? AND (r.day > ?
                     OR (r.day = ? AND r.set_by > ?))))))`,
              args: [last.bundle_id, last.bundle_id, last.entry, last.entry, last.day, last.day, last.set_by] };
    }
    const tail = items[items.length - 1];
    const cursor = truncated && tail ? `${tail.action}#${tail.ord}#${tail.on}#${tail.set_by}` : null;
    return { ok: true, as_of: today, items, limit: max, truncated, cursor };
  }

  /** R6 (`op=reminderanswer`; DEC-10, DEC-94 (1)): the member who set a due reminder answers it, with `on` another
   *  reminder on that later day, or without it no further reminder. Every due, unanswered reminder of the author's on
   *  that entry is recorded answered; the action's document is unchanged. */
  reminderAnswer({ target, entry, on = null, author = null, viewer = null } = {}) {
    const machine = this.#machineReminder(author);
    if (machine) return { ...machine, target: target ?? null };
    const who = String(author).trim();
    const a = this.#actionFor(target, viewer);
    if (!a) return noSuchAction(target ?? null);
    /* K1444 (iii): due, and later, on the action's local day; with no zone held nothing is due. */
    const today = this.#localToday(this.#heldFm(a.id) || {}, this.#view(), null);
    const pos = typeof entry === "number" ? entry : /^\d+$/.test(String(entry ?? "").trim()) ? Number(String(entry).trim()) : NaN;
    const due = Number.isInteger(pos) && pos >= 0 && today !== null
      ? this.#rows(`SELECT rid, day FROM action_reminders WHERE bundle_id=? AND entry=? AND set_by=? AND day <= ?
                      AND answered_at IS NULL AND removed_at IS NULL ORDER BY day, rid`, a.id, pos, who, today) : [];
    /* DEC-49 REGION is-no-such-reminder */
    if (!due.length)
      return refuse("NO_SUCH_REMINDER", localize("action-clocks.index.no_reminder_of_yours_on", "no reminder of yours on this entry has come due and is waiting for an answer. Nothing was answered."), { target: a.id, entry: Number.isInteger(pos) ? pos : (entry ?? null) });
    /* END DEC-49 REGION is-no-such-reminder */
    const day = on === null || on === undefined || on === "" ? null : String(on).trim();
    if (day !== null && (!isDay(day) || !(day > today)))
      return reminderRefused("on", localize("action-clocks.index.on_day_is_not_a_date_after_today", "on '{day}' is not a date written YYYY-MM-DD after today ({today}): a further reminder is for a later day. Nothing was answered.", { day: String(day.slice(0, 20)), today: String(today) }), { target: a.id, entry: pos, today });
    const at = stampInstant("second", this.#nowMs(null));
    return this.record.transact(() => {
      for (const r of due) this.sql.exec(`UPDATE action_reminders SET answered_at=? WHERE rid=?`, at, r.rid);
      /* R4's add, under its own rules: a day already held is held once; the answered ones freed their places. */
      if (day !== null && !this.#held(a.id, pos, day, who)) {
        if (this.#standing(a.id) >= REMINDERS_PER_ACTION_MAX)
          return reminderRefused("bound", localize("action-clocks.index.this_action_holds_max_reminders_answered", "this action holds {max} reminders, the most it holds. Nothing was answered.", { max: String(REMINDERS_PER_ACTION_MAX) }), { target: a.id, entry: pos, max: REMINDERS_PER_ACTION_MAX });
        this.sql.exec(`INSERT INTO action_reminders (bundle_id, entry, day, set_by, set_at) VALUES (?,?,?,?,?)`,
          a.id, pos, day, who, at);
      }
      return { ok: true, target: a.id, entry: pos, answered: due.map((r) => r.day), next: day };
    });
  }

  /* ================================================================ adopting a computed deadline (R13, R7, R8) */

  /** R13 (K1440; `op=clockadopt`): a member adopts a standing proposal of R2 as a clock entry of the action, in one act:
   *  the entry, with its basis (R7: kind `rule`, the rule's citation, a held standard the member names) and the trace
   *  R2 answered, is appended to the document's `clock[]` by a revision of the action (`promotion`, judged by `actions`'
   *  check, its R1–R3, R7), and the proposal is recorded adopted with who, when and the entry's position. `proposal` is
   *  the key R2 answered (`<rule>@<proposer>`); `date`, `text` and `description` amend the entry before it is adopted
   *  (`amended` then marks it). Refusals in order: `MACHINE_CANNOT_ADOPT_CLOCK`; `NO_SUCH_ACTION`;
   *  `NO_SUCH_CLOCK_PROPOSAL` (none standing on this action by that key: never proposed, or already adopted);
   *  `CLOCK_PROPOSAL_UNDETERMINED`; then `NO_SUCH_STANDARD` for a `standard` the author may not see; then the
   *  revision's own refusals (the lease's, and the promotion's, `actions`' among them). (T45; R18) The entry says who
   *  owes it: the proposal's `owed_by`, or the one the member states (`CLOCK_ENTRY_REFUSED`, arm `owed_by`, for a value
   *  outside `CLOCK_OWED_BY`); and (R3) a count due at a time of day writes `due_at` and `due_zone`. */
  clockAdopt({ target, proposal, why = null, date = null, text = null, description = null, standard = null,
               owed_by: owedBy = null, author = null, viewer = null } = {}) {
    const who = String(author ?? "").trim();
    /* DEC-49 REGION is-machine-adopt */
    if (!who || isMachineIdentity(who))
      return refuse("MACHINE_CANNOT_ADOPT_CLOCK", localize("action-clocks.index.a_deadline_is_put_on", "a deadline is put on an action's clock by a member, in their own act; a machine credential proposes one and never adopts it, and a call that carries nobody is not a member. Nothing was written."), { target: target ?? null });
    /* END DEC-49 REGION is-machine-adopt */
    const a = this.#actionFor(target, viewer);
    if (!a) return noSuchAction(target ?? null);
    const key = String(proposal ?? "");
    const at = key.indexOf("@");
    const p = at > 0 ? this.#one(`SELECT * FROM action_clock_proposals WHERE bundle_id=? AND rule=? AND proposed_by=?
                                    AND adopted_at IS NULL`, a.id, key.slice(0, at), key.slice(at + 1)) : null;
    /* DEC-49 REGION is-no-such-clock-proposal */
    if (!p)
      return refuse("NO_SUCH_CLOCK_PROPOSAL", localize("action-clocks.index.no_standing_proposal_key", "no standing proposal '{key}' on this action: name the key op=clockpropose answered (<rule>@<proposer>), for a proposal not yet adopted. Nothing was written.", { key: String(key.slice(0, 120)) }),
        { target: a.id, proposal: key.slice(0, 200) || null });
    /* END DEC-49 REGION is-no-such-clock-proposal */
    /* DEC-49 REGION is-clock-proposal-undetermined */
    if (p.date === null || p.date === undefined)
      return refuse("CLOCK_PROPOSAL_UNDETERMINED", localize("action-clocks.index.the_proposed_deadline_has_no_date", "the proposed deadline has no date: {why}. A member states such an entry by their own revision of the action, with its basis. Nothing was written.", { why: String(p.why || localize("action-clocks.index.it_is_undetermined", "it is undetermined")) }),
        { target: a.id, proposal: key, why: p.why ?? null });
    /* END DEC-49 REGION is-clock-proposal-undetermined */
    let entry = {};
    try { entry = JSON.parse(p.entry_json) || {}; } catch { entry = {}; }
    let kept = {};
    try { kept = JSON.parse(p.trace_json || "{}") || {}; } catch { kept = {}; }
    const amend = {};
    if (date !== null && date !== undefined && date !== "") {
      if (!isDay(String(date))) return clockEntryRefused("date", localize("action-clocks.index.date_is_not_a_calendar_day", "date '{date}' is not a calendar day written YYYY-MM-DD. Nothing was written.", { date: String(String(date).slice(0, 20)) }), { target: a.id, proposal: key });
      amend.date = String(date);
    }
    for (const [k, v] of [["text", text], ["description", description]])
      if (v !== null && v !== undefined && String(v).trim()) amend[k] = String(v);
    if (owedBy !== null && owedBy !== undefined && owedBy !== "") {
      if (!CLOCK_OWED_BY.includes(String(owedBy))) return clockEntryRefused("owed_by", localize("action-clocks.index.owed_by_value_is_one_of", "owed_by '{value}' is one of {CLOCK_OWED_BY}. Nothing was written.", { value: String(String(owedBy).slice(0, 20)), CLOCK_OWED_BY: String(CLOCK_OWED_BY.join(", ")) }), { target: a.id, proposal: key });
      amend.owed_by = String(owedBy);
    }
    const std = standard === null || standard === undefined || standard === "" ? null : String(standard).trim();
    if (std) {
      const st = this.standards;
      let r = null;
      try { r = st ? st.standardRead({ id: std, viewer: who }) : null; } catch { r = null; }
      if (!r || r.ok === false) return noSuchStandard(std, { target: a.id });
    }
    const when = stampInstant("second", this.#nowMs(null));
    /* R3 (T45): a count due at a time of day (civil-time R11, R14) keeps its time and zone, unless the date is amended. */
    const due = kept.due && typeof kept.due === "object" ? kept.due : null;
    const timed = !amend.date && due && isLocalDateTime(due.value) && due.value.slice(0, 10) === entry.date
      ? { due_at: due.value, ...(typeof due.zone === "string" && due.zone ? { due_zone: due.zone } : {}) } : {};
    const written = { text: amend.text ?? entry.text, description: amend.description ?? entry.description,
      date: amend.date ?? entry.date, basis: entry.basis, status: "pending", basis_kind: "rule",
      /* R29 (T53): an entry adopted from a layer's rule records that layer beside its text, basis and kind. */
      ...(typeof p.layer === "string" && p.layer ? { layer: p.layer } : {}),
      owed_by: amend.owed_by ?? (CLOCK_OWED_BY.includes(entry.owed_by) ? entry.owed_by : "undetermined"), ...timed,
      ...(std ? { standard: std } : {}), trace: kept.trace_line || traceLine({ trace: kept.trace, start: kept.start }),
      proposal: key, proposed_by: p.proposed_by, adopted_by: who, adopted_at: when,
      ...(Object.keys(amend).filter((k) => k !== "owed_by").length
        ? { amended: Object.keys(amend).filter((k) => k !== "owed_by").sort().join(",") } : {}),
      ...(why !== null && why !== undefined && String(why).trim() ? { adopted_why: String(why) } : {}) };
    return this.#reviseClock(a.id, written, who, viewer, when, (ord) => {
      this.sql.exec(`UPDATE action_clock_proposals SET adopted_by=?, adopted_at=?, adopted_ord=? WHERE bundle_id=? AND
                      proposed_by=? AND rule=?`, who, when, ord, a.id, p.proposed_by, p.rule);
      return { ok: true, target: a.id, proposal: key, ord, entry: written, adopted_by: who, adopted_at: when,
               says: word("action-clocks.says.deadline_action_clock") };
    });
  }

  /** R18 (T45; N882; Actions D15; reconciliation R7; `op=clockstate`): a member states a clock entry of the action in
   *  their own act, this module being the entry's writer: `{text, description, date, basis, basis_kind}` with the kind's
   *  own fields (R7: a `rule` may name a held `standard`; a `commitment` its `committed_by`; a `dependency` its
   *  `precedes`, `lead` and `why`; a `stated` date its `stated_by` and `held_in`, the capture or correspondence entry it
   *  is held in), `owed_by` (`CLOCK_OWED_BY`; unstated, `undetermined` is written, never defaulted to a side), and
   *  `due_at` (`YYYY-MM-DDTHH:MM` on the entry's date) with `due_zone`. It is appended to `clock[]` by a revision of the
   *  action, as R13's adoption is, at status `pending`. Refusals in order: `MACHINE_CANNOT_STATE_CLOCK`;
   *  `NO_SUCH_ACTION` (`actions.noSuchAction`); `CLOCK_ENTRY_REFUSED`, its `arm` naming the field; `NO_SUCH_STANDARD`;
   *  then the revision's own. A `stated` entry's words are the member's and the other side's: this act adds none
   *  calling it a law. */
  clockState({ target, text = null, description = null, date = null, basis = null, basis_kind: kind = null,
               owed_by: owedBy = null, standard = null, committed_by: committedBy = null, precedes = null, lead = null,
               why = null, stated_by: statedBy = null, held_in: heldIn = null, due_at: dueAt = null, due_zone: dueZone = null,
               layer = null, author = null, viewer = null } = {}) {
    const who = String(author ?? "").trim();
    /* DEC-49 REGION is-machine-state-clock */
    if (!who || isMachineIdentity(who))
      return refuse("MACHINE_CANNOT_STATE_CLOCK", localize("action-clocks.index.a_deadline_is_put_on_2", "a deadline is put on an action's clock by a member, in their own act; a machine credential may propose one and never states it, and a call that carries nobody is not a member. Nothing was written."), { target: target ?? null });
    /* END DEC-49 REGION is-machine-state-clock */
    const a = this.#actionFor(target, viewer);
    if (!a) return noSuchAction(target ?? null);
    const ext = { target: a.id };
    const words = (k, v, need) => {
      const t = v === null || v === undefined ? "" : String(v).trim();
      if (!t) return need ? clockEntryRefused(k, localize("action-clocks.index.field_is_required", "{field} is required: 1 to {max} characters. Nothing was written.", { field: String(k), max: String(CLOCK_TEXT_MAX) }), ext) : null;
      if (t.length > CLOCK_TEXT_MAX) return clockEntryRefused(k, localize("action-clocks.index.field_is_at_most", "{field} is at most {max} characters. Nothing was written.", { field: String(k), max: String(CLOCK_TEXT_MAX) }), ext);
      return null;
    };
    for (const [k, v] of [["text", text], ["description", description], ["basis", basis]]) { const r = words(k, v, true); if (r) return r; }
    if (!isDay(String(date ?? ""))) return clockEntryRefused("date", localize("action-clocks.index.date_is_not_a_calendar_day", "date '{date}' is not a calendar day written YYYY-MM-DD. Nothing was written.", { date: String(String(date ?? "").slice(0, 20)) }), ext);
    const k = String(kind ?? "");
    if (!BASIS_KINDS.includes(k)) return clockEntryRefused("basis_kind", localize("action-clocks.index.basis_kind_is_one_of", "basis_kind is one of {BASIS_KINDS}: every deadline names its basis. Nothing was written.", { BASIS_KINDS: String(BASIS_KINDS.join(", ")) }), ext);
    const owed = owedBy === null || owedBy === undefined || owedBy === "" ? "undetermined" : String(owedBy);
    if (!CLOCK_OWED_BY.includes(owed)) return clockEntryRefused("owed_by", localize("action-clocks.index.owed_by_is_one_of", "owed_by is one of {CLOCK_OWED_BY}. Nothing was written.", { CLOCK_OWED_BY: String(CLOCK_OWED_BY.join(", ")) }), ext);
    const own = {};
    const field = (name, v, need) => {
      const r = words(name, v, need);
      if (r) return r;
      if (v !== null && v !== undefined && String(v).trim()) own[name] = String(v).trim();
      return null;
    };
    const kindFields = { commitment: [["committed_by", committedBy, false]], dependency: [["precedes", precedes, true], ["lead", lead, false], ["why", why, false]],
                         stated: [["stated_by", statedBy, true], ["held_in", heldIn, true]] }[k] || [];
    for (const [name, v, need] of kindFields) { const r = field(name, v, need); if (r) return r; }
    /* R29 (T53): a `rule` entry may name the layer of its rule; another kind naming one is refused, naming the field. */
    if (k === "rule") { const r = field("layer", layer, false); if (r) return r; }
    for (const [name, v] of [["committed_by", committedBy], ["precedes", precedes], ["lead", lead], ["why", why], ["stated_by", statedBy], ["held_in", heldIn], ["standard", standard], ["layer", layer]])
      if (v !== null && v !== undefined && String(v).trim() && !(name in own) && !(name === "standard" && k === "rule"))
        return clockEntryRefused(name, localize("action-clocks.index.field_belongs_to_another_basis_kind", "{field} belongs to another basis kind than '{kind}'. Nothing was written.", { field: String(name), kind: String(k) }), ext);
    if (dueAt !== null && dueAt !== undefined && dueAt !== "") {
      const t = String(dueAt);
      if (!isLocalDateTime(t) || t.slice(0, 10) !== String(date))
        return clockEntryRefused("due_at", localize("action-clocks.index.due_at_is_a_time_on", "due_at is a time on the entry's own date, written YYYY-MM-DDTHH:MM. Nothing was written."), ext);
      own.due_at = t;
      if (dueZone !== null && dueZone !== undefined && dueZone !== "") {
        if (localDayOf(this.#nowMs(null), String(dueZone)) === null)
          return clockEntryRefused("due_zone", localize("action-clocks.index.due_zone_is_a_time_zone", "due_zone is a time zone's name (Area/Location). Nothing was written."), ext);
        own.due_zone = String(dueZone);
      }
    } else if (dueZone !== null && dueZone !== undefined && dueZone !== "")
      return clockEntryRefused("due_zone", localize("action-clocks.index.due_zone_is_stated_with_a_due_at", "due_zone is stated with a due_at. Nothing was written."), ext);
    const std = k === "rule" && standard !== null && standard !== undefined && standard !== "" ? String(standard).trim() : null;
    if (std) {
      const st = this.standards;
      let r = null;
      try { r = st ? st.standardRead({ id: std, viewer: who }) : null; } catch { r = null; }
      if (!r || r.ok === false) return noSuchStandard(std, { target: a.id });
    }
    const when = stampInstant("second", this.#nowMs(null));
    const written = { text: String(text).trim(), description: String(description).trim(), date: String(date), basis: String(basis).trim(),
      status: "pending", basis_kind: k, ...(own.layer ? { layer: own.layer } : {}), owed_by: owed, ...(own.due_at ? { due_at: own.due_at } : {}),
      ...(own.due_zone ? { due_zone: own.due_zone } : {}), ...(std ? { standard: std } : {}),
      ...Object.fromEntries(Object.entries(own).filter(([n]) => !["due_at", "due_zone", "layer"].includes(n))),
      entered_by: who, entered_at: when };
    return this.#reviseClock(a.id, written, who, viewer, when, (ord) =>
      ({ ok: true, target: a.id, ord, entry: written, says: word("action-clocks.says.deadline_action_clock_stated") }));
  }

  /* R13: one revision of the action appending `e` to `clock[]`, under a 30-second lease the member holds (released on
     every path), on the held version, carrying every other live file. `done(ord)` answers once the promotion lands. */
  #reviseClock(id, e, who, viewer, when, done) {
    const lease = this.record.acquireLease(id, who, ADOPT_LEASE_MS);
    if (!lease || !lease.ok)
      return { ok: false, reason: "LEASE_HELD", target: id, heldBy: lease && lease.heldBy, until: lease && lease.until,
               detail: localize("action-clocks.index.another_member_is_writing", "another member is writing to this action right now. Nothing was written; try again shortly.") };
    try {
      const f = this.record.readFile(id, "bundle.md");
      if (!f || typeof f.text !== "string")
        return { ok: false, reason: "NO_DOCUMENT", target: id, detail: localize("action-clocks.index.this_action_has_no_readable_document", "this action has no readable bundle.md. Nothing was written.") };
      let fm = {};
      try { fm = parseFrontmatter(f.text).data || {}; } catch { fm = {}; }
      const ord = Array.isArray(fm.clock) ? fm.clock.length : 0;
      let text = spliceClock(f.text, e);
      let check = null;
      try { check = text ? parseFrontmatter(text).data : null; } catch { check = null; }
      if (!text || !check || !Array.isArray(check.clock) || check.clock.length !== ord + 1 || check.clock[ord].date !== e.date)
        return { ok: false, reason: "UNSPLICEABLE_CLOCK", target: id,
                 detail: localize("action-clocks.index.this_actions_clock_block_is_not", "this action's clock block is not in a shape this grammar can extend in place; appending never rewrites the rest of the document, so nothing was written.") };
      text = setScalar(text, "last_updated", `"${when}"`);
      const bytes = new TextEncoder().encode(text);
      const carried = [];
      for (const path of this.record.livePaths(id) || []) {
        if (path === "bundle.md") continue;
        const c = this.record.readFile(id, path);
        if (!c) continue;
        carried.push(typeof c.text === "string" ? { path, text: c.text, bytes: new TextEncoder().encode(c.text).length, sha256: c.sha256 }
                                                : { path, blobSha: c.blobSha, sha256: c.sha256, bytes: c.bytes });
      }
      const head = this.record.head(id);
      const b = this.#one(`SELECT current_state FROM bundles WHERE bundle_id=?`, id) || {};
      const promoted = this.promotion.promote({
        bundleId: id, base: head ? head.bundleSha : null, snapKey: `${when.replace(/[-:]/g, "")}_clock${ord}`,
        author: who, viewer: viewer ?? who,
        files: [{ path: "bundle.md", text, bytes: bytes.length, sha256: createSha256().update(bytes).hex() }, ...carried],
        meta: { object_type: fm.object_type ?? "action", title: fm.title, current_state: b.current_state ?? fm.current_state,
                prior_state: fm.prior_state ?? null, created: fm.created, last_updated: when, criticality: fm.criticality ?? null },
      });
      if (!promoted || !promoted.ok) return { ...(promoted || { ok: false, reason: "PROMOTION_FAILED" }), target: id };
      return done(ord);
    } finally {
      try { this.record.releaseLease(id, who); } catch { /* record-core R61 never throws */ }
    }
  }

  /* ================================================================ the calendar file (R14) */

  /** R14 (K1451; `op=clocksics`, a read): one iCalendar file of the pending dated clock entries of each named action the
   *  viewer may see: an all-day event on the entry's day in the action's zone, its summary the entry's text, its
   *  description the basis (R7) and the action's id, a stable `UID` per (action, entry position). A one-off file for
   *  the member to save: no address is published, nothing is pushed, no outside channel is used (DEC-94 (3)). An
   *  action absent or invisible answers `actions.noSuchAction`; an entry with no date is left out and counted. At most
   *  200 actions. Writes nothing. */
  clocksIcs({ actions = null, viewer = null } = {}) {
    const ids = (Array.isArray(actions) ? actions : String(actions ?? "").split(","))
      .map((x) => String(x ?? "").trim()).filter(Boolean);
    const unique = [...new Set(ids)];
    if (!unique.length || unique.length > CLOCKS_ICS_ACTIONS_MAX)
      return { ok: false, reason: "CLOCKS_ICS_REFUSED", code: "CLOCKS_ICS_REFUSED", max: CLOCKS_ICS_ACTIONS_MAX,
               detail: localize("action-clocks.index.name_one_to_max_actions", "name one to {max} actions (actions=<id>,<id>). Nothing was read.", { max: String(CLOCKS_ICS_ACTIONS_MAX) }) };
    const view = this.#view();
    const events = [];
    let undated = 0;
    for (const id of unique) {
      const a = this.#actionFor(id, viewer);
      if (!a) return noSuchAction(id);
      const fm = this.#heldFm(a.id) || {};
      const zone = actionZone(fm, view);
      (Array.isArray(fm.clock) ? fm.clock : []).forEach((e, i) => {
        if (!e || typeof e !== "object" || e.status !== "pending") return;
        if (!isDay(e.date)) { undated++; return; }
        events.push({ uid: `${a.id}.${i}@civicos`, day: e.date, zone,
                      summary: String(e.text ?? localize("action-clocks.index.deadline", "Deadline")), description: `${basisWords(this.#basisOf(e, viewer))}\n${localize("action-clocks.index.action_id", "Action: {id}", { id: String(a.id) })}` });
      });
    }
    const ics = icsCalendar({ events, stampMs: this.#nowMs(null) });
    return { ok: true, filename: "deadlines.ics", content_type: "text/calendar; charset=utf-8", ics, events: events.length,
             left_out: { undated }, says: word("action-clocks.says.file_save_nothing") };
  }

  /* ================================================================ the group's own lateness (R15) */

  /* R15: the local day an entry at `ord` was met: its `met_on` when stated, else the action's `last_updated` in the first
     version of its document that shows the entry `met` (the record's history, read in write order), as a local day in
     the action's zone; null when neither is held. */
  #metDay(id, ord, e, zone) {
    if (e && isDay(e.met_on)) return { day: e.met_on, from: "met_on" };
    let im = null;
    try { im = this.record.readImage(id); } catch { im = null; }
    let entries = [];
    try { entries = (JSON.parse(im && typeof im["_history/manifest.json"] === "string" ? im["_history/manifest.json"] : "{}").entries) || []; }
    catch { entries = []; }
    for (const m of [...entries].sort((x, y) => (x.seq ?? 0) - (y.seq ?? 0)).slice(0, LATENESS_VERSIONS_MAX)) {
      let files = [];
      try { files = JSON.parse(im[`_history/promotion_${m.key}.json`] || "{}").files || []; } catch { files = []; }
      const md = files.find((f) => f && f.name === "bundle.md");
      const t = md ? this.record.textAtSha(id, md.sha256) : null;
      if (typeof t !== "string") continue;
      let fm = null;
      try { fm = parseFrontmatter(t).data; } catch { fm = null; }
      const x = fm && Array.isArray(fm.clock) ? fm.clock[ord] : null;
      if (x && x.status === "met") {
        const lu = typeof fm.last_updated === "string" ? fm.last_updated : null;
        const ms = lu ? Date.parse(lu) : NaN;
        const day = Number.isFinite(ms) && /T/.test(lu) ? localDayOf(ms, zone) : lu && isDay(lu.slice(0, 10)) ? lu.slice(0, 10) : null;
        return day ? { day, from: word("action-clocks.version_first_shows") } : null;
      }
    }
    return null;
  }

  /** R15 (D234, K1471; `op=clocklateness`, a read): an index over the group's own clocks only. For the clock entries of
   *  the actions the viewer may see (in `project` when named) that are the group's own deadlines and whose date falls
   *  in `from`–`to`: the count met on time, the count met late with the days late each (`civil-time.span`), the count
   *  still pending past their date, and the denominator, each a computed fact (`calc-grammar`'s `evaluate`, its recipe
   *  and trace answered), with what it could not count named. (T45; N882; v0.2 rule 6) The group's own are the entries
   *  `owed_by: group`, whatever their basis kind, with `dependency` and `window` entries as before (`isGroupOwn`); a
   *  body's `commitment`, a `stated` entry not marked `owed_by: group`, and a `rule` owed by a body or undetermined are
   *  never counted. Never a finding about government: no counterparty is named, and nothing is written or raised. */
  lateness({ from = null, to = null, project = null, viewer = null, now = null } = {}) {
    const f0 = String(from ?? ""), t0 = String(to ?? "");
    if (!isDay(f0) || !isDay(t0) || f0 > t0)
      return { ok: false, reason: "LATENESS_REFUSED", code: "LATENESS_REFUSED",
               detail: localize("action-clocks.index.from_and_to_are_calendar_days", "from= and to= are calendar days written YYYY-MM-DD, from not after to. Nothing was read.") };
    const view = this.#view();
    const gate = viewerPredicate(viewer);
    const rows = this.#rows(`SELECT b.bundle_id FROM bundles b WHERE b.object_type='action' AND (${gate.sql})
      ORDER BY b.bundle_id LIMIT ?`, ...gate.args, LATENESS_ACTIONS_MAX + 1);
    const table = [], notCounted = [];
    for (const r of rows.slice(0, LATENESS_ACTIONS_MAX)) {
      const fm = this.#heldFm(r.bundle_id) || {};
      if (project !== null && project !== undefined && project !== "" && this.#projectOf(fm, viewer) !== String(project)) continue;
      const zone = actionZone(fm, view);
      const today = localDayOf(this.#nowMs(now), zone);
      (Array.isArray(fm.clock) ? fm.clock : []).forEach((e, i) => {
        if (!e || typeof e !== "object" || !isDay(e.date) || e.date < f0 || e.date > t0) return;
        const kind = BASIS_KINDS.includes(e.basis_kind) ? e.basis_kind : null;
        const ref = { action: r.bundle_id, ord: i, date: e.date };
        if (!isGroupOwn(e)) {
          if (!kind && owedOf(e) === "undetermined")
            notCounted.push({ ...ref, why: word("action-clocks.why.entry_names_basis") });
          return;
        }
        if (e.status === "met") {
          const m = this.#metDay(r.bundle_id, i, e, zone);
          if (!m) { notCounted.push({ ...ref, kind, why: word("action-clocks.why.met_day_met") }); return; }
          const sp = span({ value: e.date, precision: "day", zone: zone || "UTC" }, { value: m.day, precision: "day", zone: zone || "UTC" }, { unit: "days" });
          const late = sp && Number.isInteger(sp.min) && sp.min === sp.max ? sp.min : null;
          if (late === null) { notCounted.push({ ...ref, kind, why: word("action-clocks.why.span_date_day") }); return; }
          table.push({ action: r.bundle_id, ord: i, date: e.date, kind, state: late > 0 ? "late" : "on_time", days_late: late > 0 ? late : 0, met_on: m.day, met_from: m.from });
          return;
        }
        if (e.status === "pending" || e.status === "overdue") {
          if (today === null) { notCounted.push({ ...ref, kind, why: word("action-clocks.why.action_zone_held") }); return; }
          table.push({ action: r.bundle_id, ord: i, kind, state: e.date < today ? "pending_past" : "not_yet_due", days_late: null });
          return;
        }
        table.push({ action: r.bundle_id, ord: i, kind, state: e.status === "waived" ? "waived" : "other", days_late: null });
      });
    }
    const input = { fields: [{ name: "state", type: "string" }, { name: "days_late", type: "integer" }],
                    rows: table.map((x) => ({ state: x.state, days_late: x.days_late })) };
    const sel = (as, state) => ({ op: "select", as, from: "entries", where: [{ field: "state", test: "eq", value: state }] });
    const recipe = { method: "bio-calc/1", inputs: [{ name: "entries", kind: "table" }], steps: [
      sel("on_time_rows", "on_time"), { op: "count", as: "on_time", from: "on_time_rows" },
      sel("late_rows", "late"), { op: "count", as: "late", from: "late_rows" },
      { op: "sum", as: "days_late", from: "late_rows", field: "days_late" },
      sel("pending_rows", "pending_past"), { op: "count", as: "pending_past", from: "pending_rows" },
      { op: "count", as: "denominator", from: "entries" }], output: "denominator" };
    const ev = table.length ? calcEvaluate(recipe, { entries: input }) : null;
    const zero = { value: "0", sign: "+", precision: "exact" };
    const out = (name) => {
      if (!ev || !Array.isArray(ev.trace)) return zero;
      const st = ev.trace.find((x) => x.step === name);
      return st && st.output ? st.output : zero;
    };
    const fact = (name) => ({ ...out(name), label: localize("action-clocks.index.computed_fact", "computed fact") });
    return { ok: true, from: f0, to: t0, project: project || null, counts: { owed_by: "group", kinds: [...GROUP_OWN_KINDS] },
             on_time: fact("on_time"), late: { ...fact("late"), days_late_total: fact("days_late"),
               each: table.filter((x) => x.state === "late").map((x) => ({ action: x.action, ord: x.ord, date: x.date, days_late: x.days_late, met_on: x.met_on })) },
             pending_past: fact("pending_past"), denominator: fact("denominator"),
             entries: table.map((x) => ({ action: x.action, ord: x.ord, kind: x.kind, state: x.state, ...(x.days_late ? { days_late: x.days_late } : {}) })),
             not_counted: notCounted, actions_limit: LATENESS_ACTIONS_MAX, truncated: rows.length > LATENESS_ACTIONS_MAX,
             method: ev ? { recipe, trace: ev.trace } : { recipe, trace: [] },
             says: word("action-clocks.says.index_group_deadlines") };
  }
}

/* R2: the label of a clock entry proposed apart; it says, in each state, what the proposal is not. The governing-laws
   label's states are action-grammar's (REC-195, its R2). */
const PROPOSAL_SAYS = {
  machine_proposed: word("action-clocks.machine_credential_computed"),
  member_proposed: word("action-clocks.member_asked_clock"),
  unstated: word("action-clocks.record_say_asked"),
};
function proposalLabelFor(who) {
  const base = lawProposalLabel(who);
  return { by: base.by, state: base.state, machine_work: base.machine_work, says: PROPOSAL_SAYS[base.state] };
}

/* R13: a scalar of the restricted front-matter grammar, which has no escapes: a line break becomes a space, and a
   value holding a double quote is written in single quotes, or with its double quotes made single when it holds both. */
function fmScalar(v) {
  const t = String(v ?? "").replace(/[\r\n]+/g, " ").trim();
  if (!t.includes('"')) return `"${t}"`;
  if (!t.includes("'")) return `'${t}'`;
  return `"${t.replace(/"/g, "'")}"`;
}
const TOKEN_KEYS = new Set(["date", "status", "basis_kind", "owed_by", "standard", "adopted_at", "entered_at", "met_on", "due_at"]);
const QUOTED_TOKENS = new Set(["adopted_at", "entered_at", "due_at"]);
/* R13: `clock[]` with `e` appended after the block's last line, or the block opened before the closing fence when
   absent (as `actions` splices its ledger): the rest of the document is never rewritten. Null for a block this grammar
   cannot extend in place (an inline value other than `[]`). Keys in a fixed order, each only when carried. */
function spliceClock(text, e) {
  const lines = String(text).split("\n");
  if (lines[0] !== "---") return null;
  const end = lines.indexOf("---", 1);
  if (end === -1) return null;
  const order = ["text", "description", "date", "basis", "status", "basis_kind", "layer", "owed_by", "due_at", "due_zone", "standard",
                 "committed_by", "precedes", "lead", "why", "stated_by", "held_in", "trace", "proposal", "proposed_by",
                 "adopted_by", "adopted_at", "amended", "adopted_why", "entered_by", "entered_at"];
  const kv = order.filter((k) => e[k] !== undefined && e[k] !== null && e[k] !== "")
    .map((k) => `${k}: ${TOKEN_KEYS.has(k) && /^[A-Za-z0-9:._-]+$/.test(String(e[k])) ? (QUOTED_TOKENS.has(k) ? `"${e[k]}"` : e[k]) : fmScalar(e[k])}`);
  const block = kv.map((l, i) => (i === 0 ? `  - ${l}` : `    ${l}`));
  let ci = -1;
  for (let i = 1; i < end; i++) if (/^clock:/.test(lines[i])) { ci = i; break; }
  if (ci === -1) return [...lines.slice(0, end), "clock:", ...block, ...lines.slice(end)].join("\n");
  const rest = lines[ci].slice("clock:".length).trim();
  if (rest === "[]") return [...lines.slice(0, ci), "clock:", ...block, ...lines.slice(ci + 1)].join("\n");
  if (rest !== "") return null;
  let last = ci;
  for (let i = ci + 1; i < end; i++) {
    if (lines[i].trim() === "") continue;
    if (/^\s/.test(lines[i])) { last = i; continue; }
    break;
  }
  return [...lines.slice(0, last + 1), ...block, ...lines.slice(last + 1)].join("\n");
}
/* A top-level scalar of the front matter replaced in place (left as it is when the key is absent). */
function setScalar(text, key, value) {
  const lines = String(text).split("\n");
  const end = lines.indexOf("---", 1);
  for (let i = 1; i < (end === -1 ? lines.length : end); i++)
    if (lines[i].startsWith(`${key}:`)) { lines[i] = `${key}: ${value}`; return lines.join("\n"); }
  return text;
}
/* R7, R14: the basis of an entry in words, for the calendar file. */
function basisWords(b) {
  const cite = b.citation ? `: ${b.citation}` : "";
  if (b.kind === "rule") return word("action-clocks.basis_law_order", { cite: String(cite), standard: String(b.standard ? localize("action-clocks.index.standard_id_state", " (standard {id}, {state})", { id: String(b.standard.id), state: String(b.standard.state.replace(/_/g, " ")) }) : "") });
  if (b.kind === "commitment") return word("action-clocks.basis_commitment", { committed_by: String(b.committed_by ? localize("action-clocks.index.by_who", " by {who}", { who: String(b.committed_by) }) : ""), cite: String(cite) });
  if (b.kind === "dependency") return word("action-clocks.basis_precede", { precedes: String(b.precedes ?? word("action-clocks.later_event")), lead: String(b.lead ? localize("action-clocks.index.lead_lead", " (lead {lead})", { lead: String(b.lead) }) : ""), why: String(b.why ? localize("action-clocks.index.because_why", ", because {why}", { why: String(b.why) }) : ""), cite: String(cite) });
  if (b.kind === "window") return word("action-clocks.basis_group_window", { cite: String(cite) });
  if (b.kind === "stated") return word("action-clocks.basis_date_stated", { stated_by: String(b.stated_by ?? localize("action-clocks.index.the_other_side", "the other side")), held_in: String(b.held_in ? localize("action-clocks.index.held_in_place", ", held in {place}", { place: String(b.held_in) }) : ""), cite: String(cite) });
  return word("action-clocks.basis", { cite: String(cite || localize("action-clocks.index.not_stated", ": not stated")) });
}

/* The reads and acts answer their catalogue-backed refusals with code, check and translation. */
for (const m of ["pendingClocks", "clockPropose", "reminderSet", "reminderAnswer", "clockAdopt", "clockState"]) {
  const fn = ActionClocks.prototype[m];
  ActionClocks.prototype[m] = function (...a) { return withRow(fn.apply(this, a)); };
}

const instances = new WeakMap();

/** K61: the one instance per host; at creation it creates and declares its tables with their classes (R9), each on
 *  its own declaration. `actions`' copy of `action_clock_proposals` is gone (K914), so this module alone declares it. */
export function actionClocksOf(host, deps) {
  let a = instances.get(host);
  if (!a) {
    const d = deps || {};
    const storage = d.storage || host.storage;
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    a = new ActionClocks({ ...d, host, storage, record, membership });
    instances.set(host, a);
    a.migrate();
    void a.actions;   /* `actions` joins the host first, so its declarations and steps stand before this module's */
    /* R9 (plan T33 Rules (6)): each table declared with its classes (record-core R21), in the order they were before. */
    for (const t of ["action_reminders", "action_clock_proposals"])
      record.declareTable("action-clocks", [{ ...ACTION_CLOCKS_TABLE_CLASSES.find((x) => x.name === t) }]);
    /* R16 (T45; steps R29): once, as steps' due holder, so a step whose date an action's clock entry holds is told once,
       as the entry. A host on which steps cannot be created holds none. */
    const st = a.steps;
    if (st && typeof st.registerDueHolder === "function") st.registerDueHolder("action-clocks", (x) => a.stepDueHolder(x));
  }
  return a;
}

/** Which purge declaration names one of this module's tables (record-core R21). */
export function actionClocksOwns(t) {
  const name = typeof t === "string" ? t : t && t.name;
  return ACTION_CLOCKS_TABLES.includes(name);
}

/** The module's ops (K3, K671), entries of the route map `plane` composes (its R5) and control-plane's `dispatch` looks
 *  up: `op=reminderset` (R4), `op=reminderanswer` (R6), `op=clockadopt` (R13), `op=clockstate` (R18, T45), and the
 *  reads `op=clocksics` (R14), `op=clocklateness` (R15), `op=clockproposals` (R20, T46), `op=clocksrunning` (R24, T51) and `op=remindersfor` (R26, T51). `viewer` and `author` are
 *  the control plane's stamps, read from the query, so a caller's own copy never wins. */
export function actionClocksOps(m, url, body) {
  const q = (k) => url.searchParams.get(k);
  const has = (k) => url.searchParams.has(k);
  const b = body && typeof body === "object" ? body : {};
  const pick = (k) => (has(k) ? q(k) : b[k] ?? null);
  return {
    reminderset: () => m.reminderSet({ target: pick("target"), entry: pick("entry"), on: pick("on"), from: pick("from"),
                                       author: q("author"), viewer: q("viewer") }),
    reminderanswer: () => m.reminderAnswer({ target: pick("target"), entry: pick("entry"), on: pick("on"),
                                             author: q("author"), viewer: q("viewer") }),
    clockadopt: () => m.clockAdopt({ target: pick("target"), proposal: pick("proposal"), why: pick("why"), date: pick("date"),
                                     text: pick("text"), description: pick("description"), standard: pick("standard"),
                                     owed_by: pick("owed_by"), author: q("author"), viewer: q("viewer") }),
    clockstate: () => m.clockState({ target: pick("target"), text: pick("text"), description: pick("description"),
                                     date: pick("date"), basis: pick("basis"), basis_kind: pick("basis_kind"),
                                     owed_by: pick("owed_by"), standard: pick("standard"), committed_by: pick("committed_by"),
                                     precedes: pick("precedes"), lead: pick("lead"), why: pick("why"),
                                     stated_by: pick("stated_by"), held_in: pick("held_in"), due_at: pick("due_at"),
                                     due_zone: pick("due_zone"), layer: pick("layer"), author: q("author"), viewer: q("viewer") }),
    clocksics: () => m.clocksIcs({ actions: has("actions") ? url.searchParams.getAll("actions").join(",") : b.actions ?? null,
                                   viewer: q("viewer") }),
    clocklateness: () => m.lateness({ from: pick("from"), to: pick("to"), project: pick("project"), viewer: q("viewer") }),
    clockproposals: () => m.clockProposalsFor({ action: pick("action"), viewer: q("viewer") }),
    clocksrunning: () => m.clocksRunning({ viewer: q("viewer") }),
    remindersfor: () => m.remindersFor({ action: pick("action"), viewer: q("viewer") }),
  };
}

/* R25 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  reminderset: { classes: ["admin","member","probe"], mutating: true, weight: "caller-owned", description: localize("action-clocks.declared.reminderset", "a member asks to be reminded of a dated clock entry on a day, or changes or removes their own reminder (action-clocks R4)"),
    fields: { accepts: ["target","entry","on","from"], requires: ["target","entry",["on","from"]] } },
  reminderanswer: { classes: ["admin","member","probe"], mutating: true, weight: "caller-owned", description: localize("action-clocks.declared.reminderanswer", "personal state, keyed (member, action, clock entry): a member answers their own due reminder, with a further one or none"),
    fields: { accepts: ["target","entry","on"], requires: ["target","entry"] } },
  clockadopt: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "undetermined", description: localize("action-clocks.declared.clockadopt", "a member adopts a standing clock proposal, as proposed or amended, as a clock entry with its basis and trace (action-clocks R13)"),
    fields: { accepts: ["target","proposal","why","date","text","description","standard","owed_by"], requires: ["target","proposal"] } },
  /* R26 (fix round 3, C53): an action's reminders, read after a reload. */
  remindersfor: { classes: ["admin","member"], mutating: false, weight: "read", description: localize("action-clocks.declared.remindersfor", "read: an action's reminders, each with its entry, its day, who set it and its state; writes nothing (action-clocks R26)"),
    fields: { accepts: ["action"], requires: ["action"] } },
});
