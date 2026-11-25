/* money (layer 5): money as stated amounts (`build/requirements/money.md`). Each money fact `MNY-` is one source's
   reading of one amount with its kind, phase or stage, basis, period, parties and funds and two grades, written at one
   append site (R1–R6), withdrawn and read (R7–R9); the summation rule (R10), reconciliation by the dimension that
   differs (R11), money sets (R12–R13) with a trail set's rows (R25), committed against paid (R14) and the chain of
   authority (R15) are reads that compute and store no total. The module presents each fact as one edge from payer to
   payee (R16), tells later modules of every change (R23), publishes its closed lists (R17) and its ops (R18), states
   the facts table as a read contract (R19) and answers who recorded a fact from a passage (R24). One home per fact is
   checked at the store's gate (R20); a fact follows its source's sight (R21). No field marks a fact as the group's own
   (R6, K1463).

   Reached through `moneyOf(ctx, opts)` (K61). `events` and `lines` are their modules' instances for `ctx` unless given
   (`eventsOf`, `linesOf`); `calculations`, which comes after money in the order, is the injected port
   `opts.calculations` (its `bindingOf`, K1563 (6)): absent, money fails closed where it needs it. */
import { recordOf } from "../record-core/index.mjs";
import { membershipOf, viewerPredicate, GATE_MARK, listenerRefusal, MODULE_ORDER } from "../membership/index.mjs";
import { provenanceOf } from "../provenance/index.mjs";
import { entitiesOf, noEntity, noSuchEntity, gradeRank } from "../entities/index.mjs";
import { checkContentExtent, canonicalExtent, describeExtent, extentRelation, CONTENT_EXTENT_KINDS } from "../content/index.mjs";
import { eventsOf, noSuchEvent } from "../events/index.mjs";
import { linesOf } from "../lines/index.mjs";
import { combine, governingZone } from "../../../jurisdictions/index.mjs";
import { isHypothesisId, canonicalJson, sha256HexSync, SHARED_ACT_CHECKS } from "../record-grammar/index.mjs";
import { bounds, compare, fiscalPeriod, validAt, reasonText } from "../civil-time/index.mjs";
import { parseFigure, add, subtract, relate, SUM_RULE } from "../calc-grammar/index.mjs";
import { BOUNDS, LOWEST_GRADE, exhausted, defaultRegistry } from "../connection-grammar/index.mjs";
import { MONEY_SCHEMA, MONEY_TABLES, MONEY_ADDED_COLUMNS } from "./schema.mjs";
import { MONEY_KINDS, PHASES, STAGES, BASES, PRECISIONS, STAGE_FAMILIES, FUND_TYPES, BALANCE_FAMILIES, METHODS,
  MACHINE_METHODS, SET_PURPOSES, CONCERNS_KINDS, CHANGES, CONNECTION_KIND, CONNECTION_WORD } from "./vocab.mjs";
import { word, localize } from "../setup-words/index.mjs";

export { MONEY_SCHEMA, MONEY_TABLES, MONEY_KINDS, PHASES, STAGES, BASES, PRECISIONS, STAGE_FAMILIES, FUND_TYPES,
  BALANCE_FAMILIES, METHODS, SET_PURPOSES, CHANGES, CONNECTION_KIND, CONNECTION_WORD };

/* R9: the bound of a list read. */
export const LIST_LIMIT_DEFAULT = 100;
export const LIST_LIMIT_MAX = 500;
/* R7, R12: a stated reason, at most. */
export const REASON_MAX = 2000;
/* A label or a party's words as written, at most. */
const TEXT_MAX = 2000;
/* R25: a party the fact's source does not state, in the members' words; the event kinds that single out when money
   moved among several a fact concerns. */
const NOT_STATED = word("screen.money.notstated");
const MOVING_EVENTS = Object.freeze(["payment", "transfer"]);
/* How deep a chain of facts citing facts is followed to its capture. */
const SOURCE_DEPTH_MAX = 32;
/* R31: an ingest key, at most. */
const INGEST_KEY_MAX = 200;
/* R7: the roles `checkConstant` reads. */
const CONSTANT_ROLES = Object.freeze(["period", "kind", "phase", "stage", "basis", "currency"]);

/* R1, R6: the fields a write may carry, and a party's. Every other field is refused (R6: no field marks a fact as
   the group's own). `fact_id`, `grade` and `at` are the module's to assign, never a caller's. */
const FIELDS = new Set(["amount", "as_read", "currency", "sign", "precision", "kind", "phase", "stage", "adjusts",
  "basis", "period", "from", "to", "codes", "balance_class", "buys", "concerns", "source", "method", "question", "by"]);
const PARTY_FIELDS = new Set(["entity", "fund", "account", "as_written", "identifier"]);
const PERIOD_FIELDS = new Set(["from", "to", "precision", "zone", "fiscal", "body"]);
const SOURCE_FIELDS = new Set(["capture_sha", "extent", "content_id", "fact", "table", "row", "binding", "ingest"]);
/* R2 (T35; K1941): retrieval R73's match, the found extent's one shape; only its capture and extent are taken. */
const FOUND = "search";
const BUYS_FIELDS = new Set(["quantity", "unit", "what"]);

const SHA_RE = /^[0-9a-f]{64}$/;
const DECIMAL_RE = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/;
const deepFreeze = (o) => { if (o && typeof o === "object") { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; };
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const filled = (v) => typeof v === "string" && v.trim() !== "";
const clip = (s, n = TEXT_MAX) => String(s).trim().replace(/\s+/g, " ").slice(0, n);
const isMachine = (by) => typeof by === "string" && by.startsWith("class:");
const isMember = (by) => filled(by) && !isMachine(by);

/** Every refusal: `{ok: false, reason, code, detail}`, a caller's own fields beside them. R26 (T42; K2610): a code that
 *  is one of record-grammar's shared act rows (`SHARED_ACT_CHECKS`, its R29), `NO_BASIS` (C-33.40) among them, answers
 *  with that row's check and translation, never a bare code, so a member reads the one sentence every module gives for
 *  it; `detail` keeps this site's particular. A caller's fields never replace them. */
export function refusal(code, detail, extra = {}) {
  const row = Object.prototype.hasOwnProperty.call(SHARED_ACT_CHECKS, code) ? SHARED_ACT_CHECKS[code] : null;
  return { ...extra, ok: false, reason: code, code, ...(row ? { check: row.check, translation: row.translation } : {}), detail };
}
/* R29 (K4438): every period refusal of money answers MONEY_BAD_PERIOD, its own code; `detail` is the real reason. The one
   sentence a member reads for it is keyed here, a stand-in until the design writes `refusal.MONEY_BAD_PERIOD`. */
const badPeriod = (detail, extra = {}) =>
  refusal("MONEY_BAD_PERIOD", detail, { ...extra, translation: localize("refusal.MONEY_BAD_PERIOD", "That period is not one this team's money records can read.") });
const list = (xs) => xs.join(", ");

/* K1569: THE ONE ANSWER TO ONE CONDITION, no money fact with the id `factId` is held (or the asker may not see it,
   answered alike, R21). Every act of any module that answers that condition answers through here (this module's R7,
   R10, R11, R12, R13; duties), so `NO_SUCH_FACT` is minted at one site (entities' `noSuchEntity` pattern). The detail is
   one fixed sentence, the same for every caller; `extra` adds a caller's own fields and never replaces these. Writes
   nothing and never throws. */
const NO_SUCH_FACT_DETAIL = localize("money.index.no_money_fact_with_that", "no money fact with that id is held here, or it is not visible to the asker; a money fact is recorded with op=moneyrecord before anything can name it");
const NO_SUCH_FACT_FIXED = new Set(["ok", "reason", "code", "fact_id", "detail"]);
export function noSuchFact(factId, extra = null) {
  let own = [];
  try {
    if (extra && typeof extra === "object" && !Array.isArray(extra))
      own = Object.entries(extra).filter(([k]) => !NO_SUCH_FACT_FIXED.has(k));
  } catch { own = []; }
  return { ok: false, reason: "NO_SUCH_FACT", code: "NO_SUCH_FACT", fact_id: typeof factId === "string" ? factId : null,
           ...Object.fromEntries(own), detail: NO_SUCH_FACT_DETAIL };
}

/* An exact decimal by calc-grammar's figure parser (R1's BAD_AMOUNT): digits, thousands separators and one point,
   unsigned, unscaled, with no currency sign. Answers its normal value, or null. Never a JavaScript number. */
function exactDecimal(s) {
  if (typeof s !== "string" || !DECIMAL_RE.test(s.trim())) return null;
  const f = parseFigure(s.trim());
  if (!f || f.refused || f.precision !== "exact" || f.sign !== "+" || f.unit !== undefined || f.currency !== undefined)
    return null;
  return f.value;
}
const negate = (v) => (/^0(?:\.0+)?$/.test(v) ? v : `-${v}`);

const instances = new WeakMap();
/* The storages this isolate made a Money for, so the owner's read registered at load can find the one instance when
   the registry passes no host (K1563 (1)). */
const live = new Set();

/** K61: the one Money for this object's storage. `opts` is read on the first call only: `record`, `membership`,
 *  `entities`, `provenance`, `events`, `lines` and `calculations` (ports; absent, money fails closed where it needs
 *  them), `now`. */
export function moneyOf(ctx, opts = {}) {
  const storage = ctx && ctx.storage ? ctx.storage : ctx;
  let m = instances.get(storage);
  if (!m) {
    live.add(storage);
    const record = opts.record ?? recordOf(ctx);
    const membership = opts.membership ?? membershipOf(ctx, { record });
    m = new Money(storage, { ...opts, record, membership,
      entities: opts.entities ?? (() => entitiesOf(ctx, { record, membership })),
      provenance: opts.provenance ?? (() => provenanceOf(ctx)),
      events: opts.events ?? (() => eventsOf(ctx, { record, membership })),
      lines: opts.lines ?? (() => linesOf(ctx, { record })) });
    instances.set(storage, m);
  }
  return m;
}

export class Money {
  #sql; #record; #membership; #entities; #provenance; #events; #lines; #calculations; #now;
  #listeners = []; #declared = false; #registered = false; #stepped = false;
  #held = null; #heldKey = null; #builds = 0;

  constructor(storage, { record, membership = null, entities = null, provenance = null, events = null, lines = null,
                         calculations = null, now = null } = {}) {
    this.#sql = storage.sql;
    this.#record = record;
    this.#membership = membership;
    this.#entities = entities;
    this.#provenance = provenance;
    this.#events = events;
    this.#lines = lines;
    this.#calculations = calculations;
    this.#now = typeof now === "function" ? now : () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  }

  #rows(q, ...a) { return [...this.#sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }
  #ent() { return typeof this.#entities === "function" ? (this.#entities = this.#entities()) : this.#entities; }
  #prov() { return typeof this.#provenance === "function" ? (this.#provenance = this.#provenance()) : this.#provenance; }
  #ev() { return typeof this.#events === "function" ? (this.#events = this.#events()) : this.#events; }
  #ln() { return typeof this.#lines === "function" ? (this.#lines = this.#lines()) : this.#lines; }

  /* ---- boot ---- */

  /** The schema, the table declarations (R21) and the store gates (R20), idempotent. */
  migrate() {
    const bare = MONEY_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    for (const st of bare.split(";")) { const t = st.trim(); if (t) this.#sql.exec(t); }
    /* A store made before T35 gains R2's question column. */
    for (const [col, type] of MONEY_ADDED_COLUMNS)
      if (!this.#rows(`PRAGMA table_info(money_facts)`).some((c) => c.name === col))
        this.#sql.exec(`ALTER TABLE money_facts ADD COLUMN ${col} ${type}`);
    this.declareTables();
  }

  /** R21 (plan T33, Rules (6)): each table declared explicitly. The facts and their child rows follow their source's
   *  sight and are keyed to its bundle by `sight_bundle`, so a bundle's purge clears them; sets and fund types are
   *  group-wide and cleared by the whole-store purge only. R20: the facts' and concerns' one-home checks. */
  declareTables() {
    if (this.#declared) return { ok: true, already: true };
    const cls = { expunge: "none", export: "yes", derive: "stored", version_chain: false, purge: "clear" };
    const bySource = ["money_facts", "money_codes", "money_concerns", "money_withdrawals"]
      .map((name) => ({ name, keys: ["sight_bundle"], sight: "source", ...cls }));
    const group = ["money_sets", "money_set_acts", "money_set_proposals", "money_ingests", "money_fund_types"]
      .map((name) => ({ name, keys: [], sight: "group", ...cls }));
    const r = this.#record.declareTable("money", [...bySource, ...group]);
    if (r && r.ok === false) throw new Error(`money: record-core refused its tables: ${r.reason} (${r.table})`);
    for (const [table, check] of [["money_facts", factGate], ["money_concerns", concernsGate]]) {
      const g = this.#record.registerStoreGate("money", table, check);
      if (g && g.ok === false) throw new Error(`money: record-core refused its store gate: ${g.reason}`);
    }
    this.#declared = true;
    return { ok: true };
  }

  /* ---- sight (R21) ---- */

  #gate(col, viewer) {
    const g = viewerPredicate(viewer);
    if (g.scope === "member") return { sql: `${GATE_MARK} 1=1`, args: [] };
    if (g.scope === "DENY") return { sql: g.sql, args: [] };
    return { sql: `${GATE_MARK} (${col} IS NULL OR EXISTS (SELECT 1 FROM bundles b WHERE b.bundle_id = ${col} AND (${g.sql})))`,
             args: g.args };
  }
  #visibleBundle(bundleId, viewer) {
    const g = viewerPredicate(viewer);
    if (g.scope === "member") return true;
    if (g.scope === "DENY") return false;
    if (bundleId === null || bundleId === undefined) return true;
    return !!this.#one(`SELECT 1 AS x FROM bundles b WHERE b.bundle_id = ? AND (${g.sql})`, bundleId, ...g.args);
  }
  #factRow(factId, viewer = null) {
    if (!filled(factId)) return null;
    const row = this.#one(`SELECT * FROM money_facts WHERE fact_id=?`, factId);
    if (!row) return null;
    if (viewer !== null && !this.#visibleBundle(row.sight_bundle, viewer)) return null;
    return row;
  }

  /* ---- the jurisdiction view (fiscal years, classification schemes, time zone) ----
     R30 (G55): the last view is held with the key it was built from (the active profiles' list, as the setting is read
     on every call, so a change is seen at once) and shared by every reader, so it is deep-frozen. One entry, about
     145 KB, replaced when the key changes; dropped with the instance. */

  #view() {
    const ids = typeof this.#record.getSetting === "function" ? this.#record.getSetting("jurisdiction_profiles") : null;
    const list = Array.isArray(ids) ? ids : [];
    const key = JSON.stringify(list);
    if (this.#held !== null && this.#heldKey === key) return this.#held;
    const c = combine(list);
    this.#builds += 1;
    this.#heldKey = key;
    return (this.#held = deepFreeze(c && c.ok ? c.view : {}));
  }

  /** R30 (G55): how many times this instance has built the jurisdiction view. */
  viewBuilds() { return this.#builds; }

  /* ---- R31 (G55): the partial marker ---- */

  /** R31: `calculations` opens an ingest (`open` true) in the transaction that starts it and closes it (`open` false) in
   *  the last slice's, with the last facts. A key not opened stays unmarked; one never closed (a stopped ingest) keeps
   *  its facts marked. Idempotent; joins the caller's transaction. */
  markIngest(key, open) {
    if (!filled(key) || key.length > INGEST_KEY_MAX)
      return refusal("NO_INGEST", localize("money.index.an_ingest_is_marked_by", "an ingest is marked by its key, a non-empty string of at most {max} characters", { max: String(INGEST_KEY_MAX) }));
    if (typeof open !== "boolean")
      return refusal("NO_INGEST", localize("money.index.an_ingest_is_marked_open", "an ingest is marked open (true) or closed (false)"));
    const at = this.#now();
    if (open) this.#sql.exec(`INSERT INTO money_ingests (ingest_key, open, opened_at) VALUES (?,1,?) ON CONFLICT(ingest_key) DO UPDATE SET open=1, closed_at=NULL`, key, at);
    else this.#sql.exec(`UPDATE money_ingests SET open=0, closed_at=? WHERE ingest_key=?`, at, key);
    return { ok: true, ingest: key, open };
  }
  /* A fact of an open or stopped ingest is answered partial, with the key and the sentence; any other, unchanged. */
  #partial(row) {
    if (!row.source_ingest) return null;
    const m = this.#one(`SELECT open FROM money_ingests WHERE ingest_key=?`, row.source_ingest);
    if (!m || !m.open) return null;
    return { partial: true, ingest: row.source_ingest,
             partial_says: localize("money.ingest.partial", "This fact was written by an ingest of a table that has not finished, or was stopped. Do not read what is held so far as the whole table. Ingest: {ingest}", { ingest: String(row.source_ingest) }) };
  }
  /* The open ingests among facts' rows, for a read that answers ids and not facts (summable, reconcile). */
  #partialKeys(rows) { return [...new Set(rows.map((r) => this.#partial(r)).filter(Boolean).map((p) => p.ingest))]; }

  /* ---- the period (Terms; R1) ---- */

  /* A period: `{from, to?, precision?, zone?}` (a date-time range, `to` null when no end is stated) or `{fiscal, body?}`
     (a fiscal key `civil-time` maps from the profile's `fiscal_year` for the body). Answers the period with its start
     and end instants, or a refusal. */
  #period(p, view) {
    if (p === undefined || p === null) return refusal("NO_PERIOD", localize("money.index.a_money_fact_states_the", "a money fact states the accounting period it covers"));
    if (!isObj(p)) return badPeriod(localize("money.index.a_period_is_from_to", "a period is {from, to, precision, zone} or {fiscal, body}"));
    const extra = Object.keys(p).find((k) => !PERIOD_FIELDS.has(k));
    if (extra) return badPeriod(localize("money.index.a_period_has_no_field", "a period has no field {extra}", { extra: String(extra.slice(0, 40)) }));
    /* K5292 (jurisdictions R98): the team's governing zone (its stated `team_time_zone`, else the profiles'), else the view's */
    let tz = null;
    try { tz = governingZone(this.#record.getSetting("jurisdiction_profiles"), this.#record.getSetting("team_time_zone")); } catch { tz = null; }
    if (!tz) tz = view && view.time_zone && typeof view.time_zone.value === "string" ? view.time_zone.value : null;
    const zone = filled(p.zone) ? p.zone : tz;
    if (!zone) return badPeriod(localize("money.index.the_period_states_no_zone", "the period states no zone and the active profiles give no time zone"));
    if (p.fiscal !== undefined) {
      if (!filled(p.fiscal)) return badPeriod(localize("money.index.a_fiscal_key_is_a", "a fiscal key is a non-empty string, such as the profile's label for a fiscal year"));
      const named = filled(p.body);
      const body = named ? p.body : "*";
      const fy = Array.isArray(view.fiscal_year) ? view.fiscal_year : [];
      const entry = fy.find((f) => f && f.body === body) || fy.find((f) => f && f.body === "*");
      /* R34 (T52): the stand-in `*` is a lookup key, never printed; a fiscal year sent with no body says no body was named. */
      if (!named && (!entry || typeof entry.start !== "string"))
        return badPeriod(localize("money.index.no_body_named_for_fiscal", "no body was named for the fiscal year {fiscal}, and the active profiles hold no fiscal year that applies to every body, so it cannot be mapped", { fiscal: String(p.fiscal) }));
      if (!entry || typeof entry.start !== "string")
        return badPeriod(localize("money.index.the_active_profiles_hold_no", "the active profiles hold no fiscal year for {body}, so {fiscal} cannot be mapped", { body: String(body), fiscal: String(p.fiscal) }));
      const years = [...p.fiscal.matchAll(/\d{4}/g)].map((m) => Number(m[0]));
      for (const y of years.flatMap((y) => [y - 1, y])) {
        let fp;
        try { fp = fiscalPeriod({ date: `${y}-${entry.start}`, body, view }); } catch { fp = null; }
        if (fp && !fp.undetermined && fp.label === p.fiscal) {
          const r = this.#range({ from: fp.start, to: fp.end, precision: "day", zone });
          return r.ok === false ? r : { ...r, key: p.fiscal, body };
        }
      }
      return named
        ? badPeriod(localize("money.index.the_profiles_fiscal_year_for", "the profile's fiscal year for {body} names no period {fiscal}", { body: String(body), fiscal: String(p.fiscal) }))
        : badPeriod(localize("money.index.no_body_named_no_period", "no body was named, and the profiles' fiscal year names no period {fiscal}", { fiscal: String(p.fiscal) }));
    }
    return this.#range({ from: p.from, to: p.to ?? null, precision: p.precision || "day", zone });
  }
  #range({ from, to, precision, zone }) {
    if (!filled(from)) return badPeriod(localize("money.index.a_period_states_its_start", "a period states its start (from)"));
    if (!["day", "minute", "second"].includes(precision))
      return badPeriod(localize("money.index.a_periods_precision_is_day", "a period's precision is day, minute or second"));
    let a, b = null;
    try { a = bounds({ value: from, precision, zone }); } catch { a = { refused: "DATE_INVALID", why: "unreadable" }; }
    if (a.refused || a.undetermined) return badPeriod(localize("money.index.the_periods_start_why", "the period's start: {why}", { why: reasonText(a.why) }), { why: a.why });
    if (to !== null) {
      if (typeof to !== "string") return badPeriod(localize("money.index.a_periods_end_is_a", "a period's end is a value of its precision, or null when unstated"));
      try { b = bounds({ value: to, precision, zone }); } catch { b = { refused: "DATE_INVALID", why: "unreadable" }; }
      if (b.refused || b.undetermined) return badPeriod(localize("money.index.the_periods_end_why", "the period's end: {why}", { why: reasonText(b.why) }), { why: b.why });
      if (b.latest <= a.earliest) return badPeriod(localize("money.index.the_period_ends_before_it", "the period ends before it starts"));
    }
    return { from, to, precision, zone, start: a.earliest, end: b ? b.latest : null };
  }
  /* Overlap of a fact's period with an asked one: true, false, or undetermined (an unstated end). */
  static #overlap(f, q) {
    if (f.end !== null && f.end <= q.start) return false;
    if (q.end !== null && q.end <= f.start) return false;
    if (f.end === null || q.end === null) return "undetermined";
    return true;
  }

  /* ---- R1–R6: the one append site ---- */

  /** R1–R6: `recordFact({...fields, by})`. Every write of a money fact passes here. */
  recordFact(input = {}) {
    const v = this.#validate(input);
    if (v.ok === false) return v;
    return this.#record.transact(() => this.#write(v));
  }

  #validate(input, { viewer } = {}) {
    if (!isObj(input)) return refusal("NO_AMOUNT", localize("money.index.a_money_fact_is_an", "a money fact is an object of its fields"));
    /* R6: every field outside the row's shape, a mark of the group's own among them. */
    const unknown = (keys, allowed, where) => {
      const k = keys.find((x) => !allowed.has(x));
      return k === undefined ? null : refusal("UNKNOWN_FIELD", localize("money.index.where_has_no_field_string", "{where} has no field {String}; a money fact holds only {list}. Nothing was written.", { where: String(where), String: String(String(k).slice(0, 60)), list: String(list([...allowed])) }), { field: k });
    };
    const u = unknown(Object.keys(input), FIELDS, "a money fact");
    if (u) return u;
    for (const end of ["from", "to"]) if (isObj(input[end])) {
      const up = unknown(Object.keys(input[end]), PARTY_FIELDS, `the party ${end}`);
      if (up) return up;
    }
    const by = typeof input.by === "string" && input.by ? input.by : null;
    const who = viewer ?? by;
    const view = this.#view();

    /* R1, in order. */
    const { amount } = input;
    if (amount === undefined || amount === null || amount === "") return refusal("NO_AMOUNT", localize("money.index.a_money_fact_states_its", "a money fact states its amount"));
    let value = null, low = null, high = null;
    if (isObj(amount)) {
      low = exactDecimal(amount.low); high = exactDecimal(amount.high);
      if (low === null || high === null || Object.keys(amount).some((k) => k !== "low" && k !== "high"))
        return refusal("BAD_AMOUNT", localize("money.index.a_ranges_amount_is_low", "a range's amount is {low, high}, each an exact decimal written as a string"));
    } else {
      value = exactDecimal(amount);
      if (value === null)
        return refusal("BAD_AMOUNT", localize("money.index.an_amount_is_an_exact", "an amount is an exact decimal written as a string of digits (thousands separators and one point allowed), unsigned and unscaled; never a number with a binary fraction. The sign is its own field"));
    }
    if (!filled(input.as_read)) return refusal("NO_AS_READ", localize("money.index.a_money_fact_keeps_the", "a money fact keeps the figure exactly as its source printed it (as_read)"));
    if (!filled(input.currency)) return refusal("NO_CURRENCY", localize("money.index.a_money_fact_names_its", "a money fact names its currency"));
    if (input.sign !== "+" && input.sign !== "-") return refusal("NO_SIGN", localize("money.index.a_money_facts_sign_is", "a money fact's sign is explicit: + or -"));
    if (!PRECISIONS.includes(input.precision))
      return refusal("UNKNOWN_PRECISION", localize("money.index.precision_is_one_of_list", "precision is one of {list}", { list: String(list(PRECISIONS)) }), { list: PRECISIONS });
    if ((input.precision === "range") !== (value === null))
      return refusal("BAD_RANGE", input.precision === "range" ? localize("money.index.a_range_carries_its_low", "a range carries its low and high as {low, high}")
        : localize("money.index.only_a_fact_of_precision", "only a fact of precision range carries {low, high}"));
    if (low !== null && relate(exactFigure(low), exactFigure(high)) === "higher") return refusal("BAD_RANGE", localize("money.index.a_ranges_low_is_above", "a range's low is above its high"));
    if (!MONEY_KINDS.includes(input.kind))
      return refusal("UNKNOWN_MONEY_KIND", localize("money.index.kind_is_one_of_list", "kind is one of {list}", { list: String(list(MONEY_KINDS)) }), { list: MONEY_KINDS });
    if (!PHASES.includes(input.phase)) return refusal("UNKNOWN_PHASE", localize("money.index.phase_is_one_of_list", "phase is one of {list}", { list: String(list(PHASES)) }), { list: PHASES });
    if (!BASES.includes(input.basis)) return refusal("UNKNOWN_BASIS", localize("money.index.basis_is_one_of_list", "basis is one of {list}", { list: String(list(BASES)) }), { list: BASES });
    const stage = input.stage === undefined || input.stage === null || input.stage === "" ? null : input.stage;
    if (input.phase === "actual" && stage === null)
      return refusal("NO_STAGE", localize("money.index.an_actual_amount_names_its", "an actual amount names its stage: one of {list} for {kind}", { list: String(list(STAGE_FAMILIES[input.kind])), kind: String(input.kind) }));
    if (input.phase !== "actual" && stage !== null)
      return refusal("STAGE_NOT_ACTUAL", localize("money.index.only_an_actual_amount_has", "only an actual amount has a stage; this one is {phase}", { phase: String(input.phase) }));
    if (stage !== null && !STAGE_FAMILIES[input.kind].includes(stage))
      return refusal("UNKNOWN_STAGE", localize("money.index.a_kind_takes_a_stage", "a {kind} takes a stage of {list}", { kind: String(input.kind), list: String(list(STAGE_FAMILIES[input.kind])) }),
        { list: STAGE_FAMILIES[input.kind] });
    const period = this.#period(input.period, view);
    if (period.ok === false) return period;
    const codes = input.codes === undefined || input.codes === null ? [] : input.codes;
    const schemes = new Set((Array.isArray(view.classification_schemes) ? view.classification_schemes : []).map((s) => s && s.scheme));
    if (!Array.isArray(codes)) return refusal("UNKNOWN_CODE_SCHEME", localize("money.index.codes_are_a_list_of", "codes are a list of {scheme, code}"));
    for (const c of codes) {
      if (!isObj(c) || !filled(c.code) || !schemes.has(c.scheme))
        return refusal("UNKNOWN_CODE_SCHEME", localize("money.index.a_code_names_one_of", "a code names one of the active profiles' classification schemes{v1} and its code", { v1: String(schemes.size ? ` (${list([...schemes])})` : " (they hold none)") }),
          { scheme: isObj(c) ? c.scheme ?? null : null });
    }
    const parties = {};
    for (const end of ["from", "to"]) {
      const p = input[end];
      if (p === undefined || p === null) { parties[end] = null; continue; }
      if (!isObj(p)) return refusal("UNKNOWN_FIELD", localize("money.index.the_party_end_is_entity", "the party {end} is {entity?, fund?, account?, as_written}", { end }), { field: end });
      parties[end] = p;
    }
    const balanceClass = input.balance_class === undefined || input.balance_class === null ? null : input.balance_class;
    if (balanceClass !== null) {
      const fund = [parties.to, parties.from].map((p) => p && p.fund).find(filled) || null;
      const type = fund ? this.fundTypeOf(fund) : null;
      const family = type ? BALANCE_FAMILIES[type] : null;
      if (input.kind !== "balance" || !family || !family.includes(balanceClass))
        return refusal("BALANCE_CLASS_NOT_IN_FAMILY", input.kind !== "balance" ? localize("money.index.only_a_balance_carries_a", "only a balance carries a balance class")
          : !fund ? localize("money.index.a_balance_class_is_read", "a balance class is read against a fund a party names, and none is named")
          : !type ? localize("money.index.no_type_is_held_for", "no type is held for the fund {fund}, so its balance-class family is not known (setFundType)", { fund: String(fund) })
          : localize("money.index.a_type_funds_classes_are", "a {type} fund's classes are {list}", { type: String(type), list: String(list(family)) }), { fund, fund_type: type });
    }
    const ent = this.#ent();
    for (const end of ["from", "to"]) {
      const p = parties[end];
      if (!p) continue;
      for (const k of ["entity", "fund"]) if (p[k] !== undefined && p[k] !== null) {
        if (!filled(p[k]) || !ent.has(p[k])) return noSuchEntityAt(ent, p[k], `${end}.${k}`);
        if (k === "fund" && kindOf(ent, p[k]) !== "fund")
          return refusal("NOT_A_FUND", localize("money.index.end_fund_names_v1_which", "{end}.fund names {v1}, which is not registered as a fund", { end: String(end), v1: String(p[k]) }), { end });
      }
      if (p.as_written !== undefined && p.as_written !== null && typeof p.as_written !== "string")
        return refusal("UNKNOWN_FIELD", localize("money.index.end_as_written_is_the", "{end}.as_written is the party's name as the source writes it", { end: String(end) }), { field: "as_written" });
    }
    const concerns = input.concerns === undefined || input.concerns === null ? [] : input.concerns;
    if (!Array.isArray(concerns)) return refusal("CONCERNS_UNKNOWN", localize("money.index.concerns_is_a_list_of", "concerns is a list of ids"));
    const refs = [];
    for (const id of concerns) {
      if (typeof id !== "string") return refusal("CONCERNS_UNKNOWN", localize("money.index.each_id_concerned_is_a", "each id concerned is a string"));
      if (id.startsWith("DUT-")) { refs.push({ id, kind: "duty" }); continue; }
      if (isHypothesisId(id)) { refs.push({ id, kind: "hypothesis" }); continue; }
      if (id.startsWith("EVT-")) {
        const ev = this.#ev();
        if (!ev || typeof ev.has !== "function" || !ev.has(id)) return noSuchEvent(id, { end: "concerns" });
        refs.push({ id, kind: "event" });
      } else if (id.startsWith("ENT-")) {
        if (!ent.has(id)) return noSuchEntityAt(ent, id, "concerns");
        const k = kindOf(ent, id);
        if (!CONCERNS_KINDS.includes(k))
          return refusal("CONCERNS_KIND", localize("money.index.a_money_fact_concerns_an", "a money fact concerns an entity of kind {list}; {id} is a {k}", { list: String(list(CONCERNS_KINDS)), id: String(id), k: String(k) }), { entity_id: id });
        refs.push({ id, kind: "entity" });
      } else if (id.startsWith("LIN-")) {
        const ln = this.#ln();
        let held = false;
        try { held = !!ln && typeof ln.readLine === "function" && ln.readLine({ lineId: id, viewer: who ?? "" }).found === true; }
        catch { held = false; }
        if (!held) return refusal("NO_SUCH_LINE", localize("money.index.id_is_not_a_line", "{id} is not a line the record holds that the writer can see", { id: String(id) }), { line_id: id });
        refs.push({ id, kind: "line" });
      } else {
        return refusal("CONCERNS_UNKNOWN", localize("money.index.a_money_fact_concerns_events", "a money fact concerns events, entities of kind contract, fund, program or proceeding, or lines; {id} is none of them", { id: String(id.slice(0, 60)) }), { id });
      }
    }
    if (refs.some((r) => r.kind === "duty"))
      return refusal("CONCERNS_DUTY", localize("money.index.a_money_fact_never_names", "a money fact never names a duty; the duty names the fact it cites"), { id: refs.find((r) => r.kind === "duty").id });

    /* R2: the one source. */
    const src = this.#source(input.source, who);
    if (src.ok === false) return src;
    let adjusts = null;
    if (input.adjusts !== undefined && input.adjusts !== null) {
      if (!this.#factRow(input.adjusts, who))
        return refusal("ADJUSTS_NOT_HELD", localize("money.index.the_fact_an_adjustment_names", "the fact an adjustment names ({String}) is not held", { String: String(String(input.adjusts).slice(0, 60)) }));
      adjusts = input.adjusts;
    }
    /* R2 (T35): the optional question, an inquiry bundle the record holds and the writer may see; kept beside the fact. */
    let question = null;
    if (input.question !== undefined && input.question !== null) {
      const q = filled(input.question) ? this.#one(`SELECT object_type FROM bundles WHERE bundle_id=?`, input.question) : null;
      if (!q || q.object_type !== "inquiry" || !this.#visibleBundle(input.question, who))
        return refusal("QUESTION_NOT_HELD", localize("money.index.the_question_string_is_not", "the question {String} is not an inquiry held here, or not visible to the writer", { String: String(String(input.question).slice(0, 60)) }));
      question = input.question;
    }

    /* R3: how the figure was read. */
    const method = input.method === undefined || input.method === null ? (isMachine(by) ? null : "typed") : input.method;
    if (!METHODS.includes(method))
      return refusal("NO_METHOD", localize("money.index.a_figure_states_how_it", "a figure states how it was read: {list}{v1}", { list: String(list(METHODS)), v1: String(isMachine(by) ? "; a machine's write names its reading" : "") }), { list: METHODS });
    if (method === "typed" && !isMember(by))
      return refusal("TYPED_NOT_MEMBER", localize("money.index.a_typed_transcription_is_a", "a typed transcription is a member's act; a machine's reading names its method"));
    if (isMember(by) === false && !MACHINE_METHODS.includes(method) && by !== null)
      return refusal("NO_METHOD", localize("money.index.a_machines_reading_is_one", "a machine's reading is one of {list}", { list: String(list(MACHINE_METHODS)) }));

    /* R4: the machine writes only from a canonical table row read through a binding a member adopted, each party a
       registered entity resolved by its identifier (K1443 as BOB extended it; K1563 (6)); an identifier it states must
       be one that entity holds. */
    if (isMachine(by)) {
      const lacks = [];
      if (!src.table) lacks.push(localize("money.index.a_canonical_table_row_read", "a canonical table row read through a binding a member adopted (source {table, row, binding})"));
      for (const end of ["from", "to"]) {
        const p = parties[end];
        if (!p || !filled(p.entity)) { lacks.push(word("money.push.party_named_registered", { end: String(end) })); continue; }
        if (p.identifier === undefined) continue;
        const idf = p.identifier;
        let held = null;
        try { held = isObj(idf) && typeof ent.entityByIdentifier === "function" ? ent.entityByIdentifier({ scheme: idf.scheme, id: idf.id }) : null; }
        catch { held = null; }
        const heldId = held && typeof held === "object" ? held.entity_id ?? held.entityId ?? null : held;
        if (heldId !== p.entity) lacks.push(word("money.push.party_identifier_held", { end: String(end) }));
      }
      if (lacks.length)
        return refusal("MACHINE_NEEDS_IDENTIFIERS", localize("money.index.a_machine_records_a_money", "a machine records a money fact only with {list}; anything else is proposed to a member, never written", { list: String(list(lacks)) }), { lacks });
    }
    let buys = null;
    if (input.buys !== undefined && input.buys !== null) {
      if (!isObj(input.buys) || Object.keys(input.buys).some((k) => !BUYS_FIELDS.has(k))
          || (input.buys.quantity !== undefined && exactDecimal(input.buys.quantity) === null))
        return refusal("UNKNOWN_FIELD", localize("money.index.buys_is_quantity_unit_what", "buys is {quantity, unit, what}, the quantity an exact decimal"), { field: "buys" });
      buys = { ...input.buys };
    }
    return { ok: true, by, value, low, high, input, stage, period, codes, parties, balanceClass, refs, src, adjusts,
             method, buys, question };
  }

  /* R2: exactly one source, never a calculation; held and visible to the writer. Answers the source with its grade
     (R3: the source's own, never raised) and the bundle whose sight the fact follows (R21). */
  #source(s, who) {
    const items = Array.isArray(s) ? s : s === undefined || s === null ? [] : [s];
    if (!items.length) return refusal("NO_SOURCE", localize("money.index.a_money_fact_rests_on", "a money fact rests on exactly one source: a content extent or another money fact"));
    if (items.length > 1) return refusal("TWO_SOURCES", localize("money.index.a_money_fact_rests_on_2", "a money fact rests on exactly one source"));
    const x = items[0];
    if (typeof x === "string" && x.startsWith("CALC-") || isObj(x) && Object.values(x).some((v) => typeof v === "string" && v.startsWith("CALC-"))
        || isObj(x) && x.calculation !== undefined)
      return refusal("SOURCE_IS_CALCULATION", localize("money.index.a_calculation_is_never_a", "a calculation is never a money fact's source: its result is a calculation, and the facts it read are the sources (K1468)"));
    if (!isObj(x)) return refusal("NO_SOURCE", localize("money.index.a_source_is_capture_sha_extent", "a source is {capture_sha, extent}, {content_id} or {fact}", { content_id: "{content_id}", fact: "{fact}" }));
    if (x.origin === FOUND) {
      /* A find's match is the citation of a passage, never itself a fact: its capture and extent are the source, as
         any other extent of a held capture, and nothing else of it is kept (R2, R3). A table it names is counted
         through a calculation, never read in here row by row (K1468). */
      if (x.table !== undefined)
        return refusal("NO_SOURCE", localize("money.index.a_found_tables_amount_column", "a found table's amount column is declared and counted through calculations, never read into money facts row by row; record a figure from one passage of the table instead"));
      return this.#source({ capture_sha: x.capture_sha, extent: x.extent }, who);
    }
    const k = Object.keys(x).find((f) => !SOURCE_FIELDS.has(f));
    if (k) return refusal("UNKNOWN_FIELD", localize("money.index.a_source_has_no_field", "a source has no field {k}", { k: String(k.slice(0, 40)) }), { field: k });
    const tableForm = x.table !== undefined || x.row !== undefined || x.binding !== undefined;
    /* R31 (G55): the key of the background ingest that reads this row, a table row's alone. */
    if (x.ingest !== undefined && (!tableForm || !filled(x.ingest) || x.ingest.length > INGEST_KEY_MAX))
      return refusal("UNKNOWN_FIELD", localize("money.index.a_source_ingest_is_the_key", "a source's ingest is the key of the ingest that read a table row, a non-empty string of at most {max} characters, and only a table row source has one", { max: String(INGEST_KEY_MAX) }), { field: "ingest" });
    const forms = [x.capture_sha !== undefined || x.extent !== undefined, x.content_id !== undefined, x.fact !== undefined, tableForm]
      .filter(Boolean).length;
    if (forms === 0) return refusal("NO_SOURCE", localize("money.index.a_source_is_capture_sha_extent_2", "a source is {capture_sha, extent}, {content_id}, {table, row, binding} or {fact}", { content_id: "{content_id}", fact: "{fact}" }));
    if (forms > 1) return refusal("TWO_SOURCES", localize("money.index.a_source_is_one_of", "a source is one of a content extent or a money fact, never both"));
    const notHeld = (what) => refusal("SOURCE_NOT_HELD", localize("money.index.what_is_not_held_here", "{what} is not held here, or not visible to the writer", { what: String(what) }));
    if (x.fact !== undefined) {
      const row = this.#factRow(x.fact, who);
      if (!row) return notHeld(`the money fact ${String(x.fact).slice(0, 60)}`);
      return { ok: true, fact: row.fact_id, grade: row.grade_reading, grade_basis: word("money.grade_basis", { fact_id: String(row.fact_id) }),
               sight: row.sight_bundle };
    }
    let capture = x.capture_sha, extent = x.extent ?? { kind: "document" }, contentId = null, table = null;
    if (tableForm) {
      /* A canonical table's row, a derived view of captured bytes, read through `calculations`' binding (K1563 (6)). */
      if (!filled(x.table) || x.row === undefined || x.row === null || !filled(x.binding))
        return refusal("NO_SOURCE", localize("money.index.a_table_row_source_names", "a table row source names its table, its row and the binding it was read through"));
      let b = null;
      try { b = this.#calculations && typeof this.#calculations.bindingOf === "function" ? this.#calculations.bindingOf(x.binding) : null; }
      catch { b = null; }
      if (!b || !b.adopted || b.table !== x.table || !filled(b.capture_sha))
        return notHeld(`a binding ${x.binding.slice(0, 60)} a member adopted for the table ${x.table.slice(0, 60)}`
          + `${this.#calculations ? "" : " (calculations is not wired here)"}`);
      capture = b.capture_sha; extent = null;
      table = { table: x.table, row: typeof x.row === "string" ? x.row : JSON.stringify(x.row), binding: x.binding,
                ingest: x.ingest === undefined ? null : x.ingest };
    } else if (x.content_id !== undefined) {
      const c = typeof x.content_id === "string" ? this.#one(`SELECT capture_sha, extent FROM content WHERE content_id=?`, x.content_id) : null;
      if (!c) return notHeld(`the content ${String(x.content_id).slice(0, 64)}`);
      capture = c.capture_sha; contentId = x.content_id;
      try { extent = JSON.parse(c.extent); } catch { extent = { kind: "document" }; }
    }
    if (typeof capture !== "string" || !SHA_RE.test(capture)) return notHeld(localize("money.index.the_capture_named", "the capture named"));
    const bad = extent === null ? null : checkContentExtent(extent, {});
    /* Only the grammar is asked here: a bound the capture's reading does not hold is not a refusal (content R8). */
    if (bad && bad.ok === false && ["CONTENT_EXTENT_UNREADABLE", "CONTENT_EXTENT_NO_PRODUCER"].includes(bad.code)) return refusal("SOURCE_EXTENT_UNREADABLE", localize("money.index.the_sources_extent_detail", "the source's extent: {detail}", { detail: String(bad.detail) }), { extent_code: bad.code });
    const reg = this.#one(`SELECT bundle_id FROM register WHERE capture_sha=?`, capture);
    if (!reg || !this.#visibleBundle(reg.bundle_id, who)) return notHeld(`the capture ${capture}`);
    let g = null;
    try { g = this.#prov() && typeof this.#prov().captureGrade === "function" ? this.#prov().captureGrade(capture) : null; } catch { g = null; }
    return { ok: true, capture, extent: extent === null ? null : JSON.parse(canonicalExtent(extent)), contentId, table, sight: reg.bundle_id,
             grade: g && typeof g.grade === "string" ? g.grade : null,
             grade_basis: g ? `${g.route ?? "unrecorded"} capture${g.determined === false ? ", not measured" : ""}` : "undetermined" };
  }

  #write(v, { projectedKey = null } = {}) {
    const at = this.#now();
    const { input, by, src, parties } = v;
    const minted = this.#record.allocId("MNY", at.slice(0, 4));
    if (!minted || minted.ok === false || !minted.id) return minted && minted.ok === false ? minted : refusal("MINT_EXHAUSTED", localize("money.index.no_money_fact_id_could", "no money fact id could be drawn"));
    const id = minted.id;
    const signed = (d) => (input.sign === "-" ? negate(d) : d);
    const party = (p, k) => (p && p[k] !== undefined && p[k] !== null ? (k === "as_written" ? clip(p[k]) : k === "identifier" ? JSON.stringify(p[k]) : String(p[k])) : null);
    const row = {
      fact_id: id, amount: v.value === null ? null : signed(v.value),
      amount_low: v.low === null ? null : (input.sign === "-" ? negate(v.high) : v.low),
      amount_high: v.high === null ? null : (input.sign === "-" ? negate(v.low) : v.high),
      sign: input.sign, precision: input.precision, as_read: input.as_read, currency: input.currency.trim().toUpperCase(),
      kind: input.kind, phase: input.phase, stage: v.stage, adjusts: v.adjusts, basis: input.basis,
      period_from: v.period.from, period_to: v.period.to, period_precision: v.period.precision, period_zone: v.period.zone,
      period_start: v.period.start, period_end: v.period.end, period_key: v.period.key ?? null, period_body: v.period.body ?? null,
      from_entity: party(parties.from, "entity"), from_fund: party(parties.from, "fund"), from_account: party(parties.from, "account"),
      from_as_written: party(parties.from, "as_written"), from_identifier: party(parties.from, "identifier"),
      to_entity: party(parties.to, "entity"), to_fund: party(parties.to, "fund"), to_account: party(parties.to, "account"),
      to_as_written: party(parties.to, "as_written"), to_identifier: party(parties.to, "identifier"),
      balance_class: v.balanceClass, buys: v.buys ? JSON.stringify(v.buys) : null,
      source_capture_sha: src.capture ?? null, source_extent: src.extent ? JSON.stringify(src.extent) : null,
      source_content_id: src.contentId ?? null, source_table: src.table ? src.table.table : null,
      source_row: src.table ? src.table.row : null, source_binding: src.table ? src.table.binding : null,
      source_ingest: src.table ? src.table.ingest : null,
      source_fact: src.fact ?? null, method: v.method, question: v.question,
      grade_reading: src.grade ?? null, grade_basis: src.grade_basis ?? null,
      by, at, sight_bundle: src.sight ?? null, withdrawn_at: null, projected_key: projectedKey,
    };
    const gated = this.#record.storeGate("money", "money_facts", row, "insert");
    if (gated) return gated;
    const cols = Object.keys(row);
    this.#sql.exec(`INSERT INTO money_facts (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`, ...cols.map((c) => row[c]));
    for (const c of v.codes)
      this.#sql.exec(`INSERT OR IGNORE INTO money_codes (fact_id, scheme, code, sight_bundle) VALUES (?,?,?,?)`, id, c.scheme, String(c.code), row.sight_bundle);
    for (const r of v.refs) {
      const crow = { fact_id: id, concerns: r.id, ref_kind: r.kind, sight_bundle: row.sight_bundle };
      const g = this.#record.storeGate("money", "money_concerns", crow, "insert");
      if (g) return g;
      this.#sql.exec(`INSERT OR IGNORE INTO money_concerns (fact_id, concerns, ref_kind, sight_bundle) VALUES (?,?,?,?)`, id, r.id, r.kind, row.sight_bundle);
    }
    const told = this.#tell([{ factId: id, change: "added" }, ...(v.adjusts ? [{ factId: v.adjusts, change: "adjusted" }] : [])]);
    if (told) return told;
    return { ok: true, fact_id: id, at, grade: { reading: row.grade_reading } };
  }

  /* ---- R23: the change notice ---- */

  /** R23: a later module registers once; listeners run in the modules' total order inside the writing transaction. */
  onFactChanged(module, fn) {
    const refused = listenerRefusal(this.#listeners, module, fn);
    if (refused) return refused;
    this.#listeners.push({ module, fn, seq: this.#listeners.length });
    const rank = (m) => { const i = MODULE_ORDER.indexOf(m); return i === -1 ? Infinity : i; };
    this.#listeners.sort((a, b) => (rank(a.module) - rank(b.module)) || (a.seq - b.seq));
    return { ok: true, module };
  }
  #tell(notices) {
    for (const n of notices) for (const l of this.#listeners) {
      try { l.fn({ ...n }); } catch (e) {
        return refusal("LISTENER_FAILED", localize("money.index.module_s_listener_failed_on", "{module}'s listener failed on {change} of {factId}: {String}. Nothing was written.", { module: String(l.module), change: String(n.change), factId: String(n.factId), String: String(String(e && e.message ? e.message : e).slice(0, 200)) }), { module: l.module });
      }
    }
    return null;
  }

  /* ---- R5: facts projected from a capture's reading ride the promotion ---- */

  /** R5: joins promotion's step (its R39). A promoted bundle's `data/money.json`, `{facts: [...]}`, is checked by R1–R4
   *  before the write (a refusal refuses the promotion, naming the fact) and written after it, each fact once. */
  joinPromotion(promotion) {
    if (this.#stepped || !promotion || typeof promotion.registerStep !== "function") return false;
    const r = promotion.registerStep("money", {
      check: (c) => { for (const [i, f] of factsOf(c).entries()) { const v = this.#validate({ ...f, by: c.author ?? null }); if (v.ok === false) return { ...v, fact_index: i }; } return null; },
      project: (c) => {
        const written = [];
        for (const f of factsOf(c)) {
          const key = sha256HexSync(canonicalJson({ bundle: c.bundleId ?? null, fact: f }));
          if (this.#one(`SELECT 1 AS x FROM money_facts WHERE projected_key=?`, key)) continue;
          const v = this.#validate({ ...f, by: c.author ?? null });
          if (v.ok === false) return v;
          const w = this.#write(v, { projectedKey: key });
          if (w.ok === false) return w;
          written.push(w.fact_id);
        }
        return written.length ? { money_facts: written } : null;
      } });
    this.#stepped = !(r && r.ok === false);
    return this.#stepped;
  }

  /* ---- R7: withdrawal ---- */

  withdrawFact({ factId, reason, by } = {}) {
    if (!filled(reason)) return refusal("NO_REASON", localize("money.index.a_withdrawal_states_why", "a withdrawal states why"));
    const row = this.#factRow(factId);
    if (!row) return noSuchFact(factId);
    if (row.withdrawn_at) return { ok: true, already: true, fact_id: row.fact_id };
    const at = this.#now();
    return this.#record.transact(() => {
      this.#sql.exec(`INSERT INTO money_withdrawals (fact_id, reason, by, at, sight_bundle) VALUES (?,?,?,?,?)`,
        row.fact_id, clip(reason, REASON_MAX), by ?? null, at, row.sight_bundle);
      this.#sql.exec(`UPDATE money_facts SET withdrawn_at=? WHERE fact_id=?`, at, row.fact_id);
      const told = this.#tell([{ factId: row.fact_id, change: "withdrawn" }]);
      if (told) return told;
      return { ok: true, fact_id: row.fact_id, withdrawn: { by: by ?? null, at, reason: clip(reason, REASON_MAX) } };
    });
  }

  /* ---- R8: one fact ---- */

  readFact({ factId, viewer } = {}) {
    if (!filled(factId)) return refusal("NO_FACT", localize("money.index.a_money_fact_is_read", "a money fact is read by its id (MNY-...)"));
    const row = this.#factRow(factId, viewer ?? "");
    if (!row) return { ok: true, found: false, fact_id: factId, fact: null };
    const g = this.#gate("f.sight_bundle", viewer ?? "");
    const adjustments = this.#rows(`SELECT f.fact_id FROM money_facts f WHERE f.adjusts=? AND (${g.sql}) ORDER BY f.at, f.fact_id`, row.fact_id, ...g.args).map((r) => r.fact_id);
    const citing = this.#rows(`SELECT f.fact_id FROM money_facts f WHERE f.source_fact=? AND (${g.sql}) ORDER BY f.at, f.fact_id`, row.fact_id, ...g.args).map((r) => r.fact_id);
    return { ok: true, found: true, fact: { ...this.#view_(row, viewer ?? ""), adjustments, cited_by: citing } };
  }

  /* ---- R7 (T51; K5148): the checks money publishes for its callers ---- */

  /** `checkConstant({role, value})`: whether money can read `value` as its `role` (`period`, `kind`, `phase`, `stage`,
   *  `basis` or `currency`), before any fact is written. Answers `{ok: true, role}` or money's own refusal for that value
   *  (`MONEY_BAD_PERIOD`, `UNKNOWN_MONEY_KIND`, `UNKNOWN_PHASE`, `UNKNOWN_STAGE`, `UNKNOWN_BASIS`, `NO_CURRENCY`), the
   *  role beside it; an unknown role is `UNKNOWN_ROLE`. A period is a money period object, or a string read as
   *  calculations reads a binding's period (`YYYY-MM-DD/YYYY-MM-DD?`, else a fiscal key). Writes nothing. */
  checkConstant({ role, value } = {}) {
    if (!CONSTANT_ROLES.includes(role))
      return refusal("UNKNOWN_ROLE", localize("money.index.a_constant_role_is_one", "a constant's role is one of {list}", { list: String(list(CONSTANT_ROLES)) }), { list: CONSTANT_ROLES });
    const r = (() => {
      if (role === "period") {
        let p = value;
        if (typeof value === "string") {
          const t = value.trim();
          const m = /^(\d{4}-\d{2}-\d{2})\s*\/\s*(\d{4}-\d{2}-\d{2})?$/.exec(t);
          p = m ? { from: m[1], to: m[2] ?? null, precision: "day" } : t ? { fiscal: t } : null;
        }
        const q = this.#period(p, this.#view());
        return q.ok === false ? (q.code === "NO_PERIOD" ? badPeriod(q.detail) : q) : null;
      }
      if (role === "currency") return filled(value) ? null : refusal("NO_CURRENCY", localize("money.index.a_money_fact_names_its", "a money fact names its currency"));
      const lists = { kind: MONEY_KINDS, phase: PHASES, stage: STAGES, basis: BASES };
      if (lists[role].includes(value)) return null;
      const code = { kind: "UNKNOWN_MONEY_KIND", phase: "UNKNOWN_PHASE", stage: "UNKNOWN_STAGE", basis: "UNKNOWN_BASIS" }[role];
      return refusal(code, localize("money.index.role_is_one_of_list", "{role} is one of {list}", { role: String(role), list: String(list(lists[role])) }), { list: lists[role] });
    })();
    return r ? { ...r, role } : { ok: true, role };
  }

  /** `factBySource({table, row, binding, viewer?})`: the live (not withdrawn) fact written from that source row through
   *  that binding, `{ok: true, found: true, fact_id}`, or `{ok: true, found: false}`: one indexed read. A withdrawn fact
   *  is none. With a `viewer`, a fact the viewer may not see is none, as `readFact` answers. Writes nothing. */
  factBySource({ table, row, binding, viewer } = {}) {
    if (!filled(table) || row === undefined || row === null || !filled(binding))
      return refusal("NO_SOURCE", localize("money.index.a_table_row_source_names", "a table row source names its table, its row and the binding it was read through"));
    const key = typeof row === "string" ? row : JSON.stringify(row);
    const f = this.#one(`SELECT fact_id, sight_bundle FROM money_facts WHERE source_binding=? AND source_table=? AND source_row=? AND withdrawn_at IS NULL ORDER BY at, fact_id LIMIT 1`, binding, table, key);
    if (!f || (viewer !== undefined && viewer !== null && !this.#visibleBundle(f.sight_bundle, viewer))) return { ok: true, found: false };
    return { ok: true, found: true, fact_id: f.fact_id };
  }

  #view_(row, viewer) {
    const codes = this.#rows(`SELECT scheme, code FROM money_codes WHERE fact_id=? ORDER BY scheme, code`, row.fact_id);
    const concerns = this.#rows(`SELECT concerns FROM money_concerns WHERE fact_id=? ORDER BY concerns`, row.fact_id).map((r) => r.concerns);
    const w = row.withdrawn_at ? this.#one(`SELECT reason, by, at FROM money_withdrawals WHERE fact_id=?`, row.fact_id) : null;
    const party = (p) => {
      const out = {};
      for (const k of ["entity", "fund", "account", "as_written"]) if (row[`${p}_${k}`] !== null) out[k] = row[`${p}_${k}`];
      if (row[`${p}_identifier`]) out.identifier = JSON.parse(row[`${p}_identifier`]);
      return Object.keys(out).length ? out : null;
    };
    const unsigned = (d) => (d && d.startsWith("-") ? d.slice(1) : d);
    const capture = this.#rootCapture(row);
    const source = sourceOf(row);
    return {
      ...this.#partial(row),
      fact_id: row.fact_id,
      amount: row.precision === "range" ? { low: unsigned(row.sign === "-" ? row.amount_high : row.amount_low), high: unsigned(row.sign === "-" ? row.amount_low : row.amount_high) } : unsigned(row.amount),
      as_read: row.as_read, currency: row.currency, sign: row.sign, precision: row.precision, kind: row.kind, phase: row.phase,
      ...(row.stage ? { stage: row.stage } : {}), ...(row.adjusts ? { adjusts: row.adjusts } : {}), basis: row.basis,
      period: { from: row.period_from, to: row.period_to, precision: row.period_precision, zone: row.period_zone,
                ...(row.period_key ? { fiscal: row.period_key, body: row.period_body } : {}) },
      from: party("from"), to: party("to"), codes, ...(row.balance_class ? { balance_class: row.balance_class } : {}),
      ...(row.buys ? { buys: JSON.parse(row.buys) } : {}), concerns, source,
      citation: row.source_fact ? `money fact ${row.source_fact}`
        : row.source_table ? word("money.citation", { source_row: String(row.source_row), source_table: String(row.source_table), source_capture_sha: String(row.source_capture_sha), source_binding: String(row.source_binding) })
        : `${describeExtent(JSON.parse(row.source_extent))} of capture ${row.source_capture_sha}`,
      method: row.method,
      grade: { reading: row.grade_reading, reading_basis: row.grade_basis,
               parties: { from: this.#partyGrade(capture, row.from_entity ?? row.from_fund),
                          to: this.#partyGrade(capture, row.to_entity ?? row.to_fund) } },
      by: row.by, at: row.at, withdrawn: w ? { by: w.by, at: w.at, reason: w.reason } : null,
      /* R2 (T35): the question, to a viewer who may see its bundle; withheld as absent from any other. */
      question: row.question && this.#visibleBundle(row.question, viewer) ? row.question : null,
    };
  }
  /* The capture a fact finally rests on, through the facts it cites. */
  #rootCapture(row) {
    let r = row;
    for (let i = 0; r && i < SOURCE_DEPTH_MAX; i++) {
      if (r.source_capture_sha) return r.source_capture_sha;
      r = this.#one(`SELECT source_capture_sha, source_fact FROM money_facts WHERE fact_id=?`, r.source_fact);
    }
    return null;
  }
  /* A party's entity resolution grade (Terms, `grade.parties`): the strongest resolution of that entity in the
     capture the fact rests on, read from entities' `resolutions` (its R35 read contract); null when none is held. */
  #partyGrade(capture, entityId) {
    if (!capture || !entityId) return null;
    let best = null;
    for (const r of this.#rows(`SELECT grade FROM resolutions WHERE capture_sha=? AND entity_id=?`, capture, entityId))
      if (best === null || (gradeRank[r.grade] ?? 0) > (gradeRank[best] ?? 0)) best = r.grade;
    return best;
  }

  /* ---- R24: who recorded a fact from a passage (events R49's shape) ---- */

  /** R24: the money facts whose source is an extent of the capture, each naming who recorded it. A fact on a fact cites
   *  no extent and is no item; a table row's fact cites the capture and no part of it, so its extent is read as
   *  `document` (content R5). Sight is R21's: a hidden fact is neither answered nor counted, and a viewer membership
   *  refuses sees nothing. Items are ordered by the canonical extent's string in code-unit order, then the fact's id
   *  (K2114). Writes nothing, never throws. */
  recordedBy({ captureSha, extent, limit, viewer } = {}) {
    try {
      if (viewer === undefined || viewer === null || viewer === "")
        return shapeRefusal("VIEWER_MISSING", localize("money.index.a_read_names_the_member", "a read names the member reading; an absent viewer is neither an administrator nor the public"));
      if (!filled(captureSha)) return refusal("NO_SHA", localize("money.index.who_recorded_from_a_passage", "who recorded from a passage is read for one capture, by its sha256"));
      const asked = extent === undefined || extent === null ? null : extent;
      if (asked !== null && !(isObj(asked) && Object.prototype.hasOwnProperty.call(CONTENT_EXTENT_KINDS, asked.kind)))
        return shapeRefusal("EXTENT_MALFORMED", localize("money.index.an_extent_is_one_of", "an extent is one of content's kinds ({list})", { list: String(list(Object.keys(CONTENT_EXTENT_KINDS))) }));
      const n = Number.parseInt(limit ?? LIST_LIMIT_DEFAULT, 10);
      const lim = Number.isFinite(n) ? Math.min(Math.max(n, 1), LIST_LIMIT_MAX) : LIST_LIMIT_DEFAULT;
      const capture = captureSha.trim();
      const g = this.#gate("f.sight_bundle", viewer);
      const items = [];
      for (const r of this.#rows(`SELECT f.fact_id, f.source_extent, f.source_ingest, f.by, f.at, f.withdrawn_at FROM money_facts f
           WHERE f.source_capture_sha=? AND f.source_fact IS NULL AND (${g.sql})`, capture, ...g.args)) {
        const own = r.source_extent ? JSON.parse(r.source_extent) : { kind: "document" };
        const relation = asked === null ? null : extentRelation(asked, own);
        if (asked !== null && !["same", "narrower", "wider"].includes(relation)) continue;
        items.push({ module: "money", record: r.fact_id, kind: "money_fact", field: "source", extent: JSON.parse(canonicalExtent(own)),
                     relation, by: r.by, at: r.at, withdrawn: !!r.withdrawn_at, ...this.#partial(r), order: canonicalExtent(own) });
      }
      items.sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : a.record < b.record ? -1 : a.record > b.record ? 1 : 0));
      return { ok: true, module: "money", capture_sha: capture, items: items.slice(0, lim).map(({ order: _o, ...i }) => i),
               truncated: items.length > lim };
    } catch (e) {
      return refusal("READ_FAILED", localize("money.index.who_recorded_from_this_capture", "who recorded from this capture could not be read: {String}", { String: String(String(e && e.message ? e.message : e).slice(0, 200)) }));
    }
  }

  /* ---- R9: an entity's money ---- */

  moneyOf({ entity, period, kinds, phases, limit, viewer } = {}) {
    if (!filled(entity)) return noEntity(localize("money.index.an_entitys_money_is_read", "an entity's money is read by the entity's id (moneyof&entity=ENT-...)"));
    const n = Number.parseInt(limit ?? LIST_LIMIT_DEFAULT, 10);
    const lim = Number.isFinite(n) ? Math.min(Math.max(n, 1), LIST_LIMIT_MAX) : LIST_LIMIT_DEFAULT;
    const ks = toList(kinds), ps = toList(phases);
    for (const k of ks) if (!MONEY_KINDS.includes(k)) return refusal("UNKNOWN_MONEY_KIND", localize("money.index.kind_is_one_of_list_2", "kind is one of {list}", { list: String(list(MONEY_KINDS)) }));
    for (const p of ps) if (!PHASES.includes(p)) return refusal("UNKNOWN_PHASE", localize("money.index.phase_is_one_of_list_2", "phase is one of {list}", { list: String(list(PHASES)) }));
    let q = null;
    if (period !== undefined && period !== null && period !== "") {
      q = this.#period(typeof period === "string" ? safeJson(period) : period, this.#view());
      if (q.ok === false) return q;
    }
    const g = this.#gate("f.sight_bundle", viewer ?? "");
    const rows = this.#rows(`SELECT f.* FROM money_facts f
       WHERE f.withdrawn_at IS NULL AND (f.from_entity=? OR f.from_fund=? OR f.to_entity=? OR f.to_fund=?
             OR f.fact_id IN (SELECT fact_id FROM money_concerns WHERE concerns=?))
         ${ks.length ? `AND f.kind IN (${ks.map(() => "?").join(",")})` : ""}
         ${ps.length ? `AND f.phase IN (${ps.map(() => "?").join(",")})` : ""}
         AND (${g.sql})
       ORDER BY f.period_start, f.fact_id`, entity, entity, entity, entity, entity, ...ks, ...ps, ...g.args);
    const facts = [], undetermined = [];
    let truncated = false;
    for (const r of rows) {
      const o = q ? Money.#overlap({ start: r.period_start, end: r.period_end }, q) : true;
      if (o === false) continue;
      const into = o === true ? facts : undetermined;
      if (into.length >= lim) { truncated = true; continue; }
      into.push(this.#view_(r, viewer ?? ""));
    }
    return { ok: true, entity, count: facts.length, facts, undetermined,
             ...(undetermined.length ? { undetermined_why: word("money.undetermined_why") } : {}),
             limit: lim, truncated, says: word("money.says.facts_total") };
  }

  /* ---- R10: the summation rule ---- */

  summable({ factIds, viewer } = {}) {
    const got = this.#facts(factIds, viewer);
    if (got.ok === false) return got;
    const rows = got.rows;
    const value = (r, dim) => (dim === "period" ? `${r.period_start}/${r.period_end ?? ""}` : r[dim] ?? null);
    for (const [dim, code] of SUM_RULE) {
      const a = rows[0];
      const b = rows.find((r) => value(r, dim) !== value(a, dim));
      if (b) {
        const show = (r) => (dim === "period" ? { from: r.period_from, to: r.period_to, precision: r.period_precision, zone: r.period_zone } : r[dim] ?? null);
        return refusal(code, localize("money.index.these_facts_differ_in_v1", "these facts differ in {v1}: {fact_id} and {fact_id_2}; a sum is taken only over one kind, phase and stage, basis, currency and period", { v1: String(dim === "phase" || dim === "stage" ? word("money.push.phase_stage") : dim), fact_id: String(a.fact_id), fact_id_2: String(b.fact_id) }),
          { dimension: dim, facts: [a.fact_id, b.fact_id], values: [show(a), show(b)] });
      }
    }
    const interfund = rows.filter((r) => r.kind === "transfer" && r.from_fund && r.to_fund)
      .map((r) => ({ fact_id: r.fact_id, from_fund: r.from_fund, to_fund: r.to_fund, interfund: true,
                     says: word("money.says.transfer_between_two") }));
    const open = this.#partialKeys(rows);
    return { ok: true, interfund, says: word("money.says.facts_summed_sum"), ...(open.length ? { partial: true, ingests: open } : {}) };
  }
  #facts(ids, viewer) {
    if (!Array.isArray(ids) || !ids.length) return refusal("NO_FACTS", localize("money.index.name_the_money_facts_by", "name the money facts by their ids"));
    const rows = [];
    for (const id of ids) {
      const r = this.#factRow(id, viewer === undefined ? null : viewer);
      if (!r) return noSuchFact(id);
      if (r.withdrawn_at) return refusal("FACT_WITHDRAWN", localize("money.index.fact_id_is_withdrawn_and", "{fact_id} is withdrawn and is never counted", { fact_id: String(r.fact_id) }), { fact_id: r.fact_id });
      rows.push(r);
    }
    return { ok: true, rows };
  }

  /* ---- R11: reconciliation ---- */

  reconcile({ a, b, viewer } = {}) {
    const got = this.#facts([a, b], viewer);
    if (got.ok === false) return got;
    const [x, y] = got.rows;
    const differs = [];
    const push = (dimension, va, vb) => differs.push({ dimension, a: va, b: vb });
    if (x.basis !== y.basis) push("basis", x.basis, y.basis);
    if (x.period_start !== y.period_start || x.period_end !== y.period_end)
      push("period", { from: x.period_from, to: x.period_to }, { from: y.period_from, to: y.period_to });
    if (x.kind !== y.kind) push("kind", x.kind, y.kind);
    if (x.phase !== y.phase || x.stage !== y.stage) push(word("money.push.phase_stage"), { phase: x.phase, stage: x.stage }, { phase: y.phase, stage: y.stage });
    if (x.currency !== y.currency) push("currency", x.currency, y.currency);
    const ends = (r) => ({ from: r.from_entity ?? r.from_fund ?? null, to: r.to_entity ?? r.to_fund ?? null });
    if (canonicalJson(ends(x)) !== canonicalJson(ends(y))) push("parties", ends(x), ends(y));
    const overlap = overlaps(x, y);
    const equal = x.precision !== "range" && y.precision !== "range" && x.amount === y.amount;
    const amounts = equal ? "equal" : overlap ? word("money.text.within_coarser_fact") : "differ";
    if (!overlap) {
      if (x.precision !== y.precision) push("rounding", x.precision, y.precision);
      else push("amount", x.amount ?? { low: x.amount_low, high: x.amount_high }, y.amount ?? { low: y.amount_low, high: y.amount_high });
    }
    const open = this.#partialKeys([x, y]);
    return { ok: true, a: x.fact_id, b: y.fact_id, consistent: differs.length === 0, amounts, differs,
             says: differs.length ? word("money.says.two_readings_differ") : word("money.says.two_readings_consistent"),
             ...(open.length ? { partial: true, ingests: open } : {}) };
  }

  /* ---- R12, R13: money sets ---- */

  createSet({ purpose, label, concerns, by } = {}) {
    if (!SET_PURPOSES.includes(purpose)) return refusal("UNKNOWN_PURPOSE", localize("money.index.a_money_sets_purpose_is", "a money set's purpose is {list}", { list: String(list(SET_PURPOSES)) }));
    if (!filled(label)) return refusal("NO_LABEL", localize("money.index.a_money_set_has_a", "a money set has a label a person can read"));
    let c = null;
    if (purpose === "attribution") {
      const ent = this.#ent();
      if (!filled(concerns) || !ent.has(concerns) || kindOf(ent, concerns) !== "contract")
        return refusal("NO_CONTRACT", localize("money.index.an_attribution_set_concerns_one", "an attribution set concerns one registered entity of kind contract"));
      c = concerns;
    } else if (concerns !== undefined && concerns !== null && concerns !== "") {
      if (typeof concerns !== "string") return refusal("NO_LABEL", localize("money.index.a_trail_concerns_one_id", "a trail concerns one id, or none"));
      c = concerns;
    }
    const at = this.#now();
    return this.#record.transact(() => {
      const { id } = this.#record.allocId("MSR", at.slice(0, 4));
      this.#sql.exec(`INSERT INTO money_sets (set_id, purpose, label, concerns, by, at) VALUES (?,?,?,?,?,?)`, id, purpose, clip(label), c, by ?? null, at);
      return { ok: true, set_id: id, purpose, label: clip(label), concerns: c, at };
    });
  }
  include(args = {}) { return this.#setAct("include", args); }
  exclude(args = {}) { return this.#setAct("exclude", args); }
  #setAct(act, { setId, factId, reason, by } = {}) {
    if (!isMember(by)) return refusal("MEMBER_ACT_ONLY", localize("money.index.to_act_a_fact_is", "to {act} a fact is a member's act; a machine proposes (proposeInclusion)", { act: String(act) }));
    if (!filled(reason)) return refusal("NO_REASON", localize("money.index.to_act_a_fact_states", "to {act} a fact states why", { act: String(act) }));
    const set = filled(setId) ? this.#one(`SELECT * FROM money_sets WHERE set_id=?`, setId) : null;
    if (!set) return refusal("NO_SUCH_SET", localize("money.index.no_money_set_string_is", "no money set {String} is held", { String: String(String(setId ?? "").slice(0, 60)) }));
    const fact = this.#factRow(factId, by);
    if (!fact) return noSuchFact(factId);
    const at = this.#now();
    return this.#record.transact(() => {
      /* R12, R13 (T51; K5198): either act on a fact closes its open proposal, so a proposal then excluded is not left open. */
      const open = this.#one(`SELECT proposal_id FROM money_set_proposals WHERE set_id=? AND fact_id=? AND adopted_act IS NULL ORDER BY proposal_id LIMIT 1`, setId, fact.fact_id);
      this.#sql.exec(`INSERT INTO money_set_acts (set_id, fact_id, act, reason, by, at, proposal_id) VALUES (?,?,?,?,?,?,?)`,
        setId, fact.fact_id, act, clip(reason, REASON_MAX), by, at, open ? open.proposal_id : null);
      const actId = this.#one(`SELECT max(act_id) AS id FROM money_set_acts`).id;
      if (open) this.#sql.exec(`UPDATE money_set_proposals SET adopted_act=? WHERE proposal_id=?`, actId, open.proposal_id);
      const told = this.#tell([{ factId: fact.fact_id, change: "set_changed", setId }]);
      if (told) return told;
      return { ok: true, set_id: setId, fact_id: fact.fact_id, act, by, at, ...(open ? { adopted_proposal: open.proposal_id } : {}) };
    });
  }
  proposeInclusion({ setId, factId, method, by } = {}) {
    if (!filled(method)) return refusal("NO_METHOD", localize("money.index.a_proposal_names_the_method", "a proposal names the method that proposed it"));
    const set = filled(setId) ? this.#one(`SELECT 1 AS x FROM money_sets WHERE set_id=?`, setId) : null;
    if (!set) return refusal("NO_SUCH_SET", localize("money.index.no_money_set_string_is_2", "no money set {String} is held", { String: String(String(setId ?? "").slice(0, 60)) }));
    const fact = this.#factRow(factId, by ?? "");
    if (!fact) return noSuchFact(factId);
    /* R33 (T51; K5300): the latest member act on the figure stands; a proposal of a figure already included or excluded is not held. */
    const latest = this.#one(`SELECT act FROM money_set_acts WHERE set_id=? AND fact_id=? ORDER BY act_id DESC LIMIT 1`, setId, fact.fact_id);
    if (latest) return { ok: true, set_id: setId, fact_id: fact.fact_id, already: latest.act === "include" ? "included" : "excluded" };
    const at = this.#now();
    this.#sql.exec(`INSERT INTO money_set_proposals (set_id, fact_id, method, by, at) VALUES (?,?,?,?,?)`, setId, fact.fact_id, clip(method), by ?? null, at);
    return { ok: true, set_id: setId, fact_id: fact.fact_id, proposal_id: this.#one(`SELECT max(proposal_id) AS id FROM money_set_proposals`).id,
             says: word("money.says.held_apart_proposal") };
  }
  readSet({ setId, viewer, at } = {}) {
    if (!filled(setId)) return refusal("NO_SET", localize("money.index.a_money_set_is_read", "a money set is read by its id (MSR-...)"));
    const set = this.#one(`SELECT * FROM money_sets WHERE set_id=?`, setId);
    if (!set) return { ok: true, found: false, set_id: setId };
    /* R12 (T51; K5148): a set concerning a bundle the viewer may not see is answered exactly as an absent set, as R28
       fences `moneySets`; nothing of the set (its label, its project, who, when) is told. */
    if (filled(set.concerns) && this.#one(`SELECT 1 AS x FROM bundles WHERE bundle_id=?`, set.concerns)
        && !this.#visibleBundle(set.concerns, viewer ?? "")) return { ok: true, found: false, set_id: setId };
    const st = this.#setState(setId, viewer ?? "", at);
    const props = this.#rows(`SELECT * FROM money_set_proposals WHERE set_id=? AND adopted_act IS NULL ORDER BY proposal_id`, setId)
      .filter((p) => this.#factRow(p.fact_id, viewer ?? ""))
      .map((p) => ({ proposal_id: p.proposal_id, fact_id: p.fact_id, method: p.method, by: p.by, at: p.at, label: word("screen.money.proposed") }));
    if (set.purpose === "trail") {
      /* R25: each included fact's, and each open proposal's fact's, trail row. */
      const v = viewer ?? "";
      const included = st.inclusions.map((i) => this.#factRow(i.fact_id, v)).filter(Boolean);
      for (const e of [...st.inclusions, ...props]) e.trail = this.#trailRow(this.#factRow(e.fact_id, v), included, v);
    }
    return { ok: true, found: true, set: { set_id: set.set_id, purpose: set.purpose, label: set.label, concerns: set.concerns, by: set.by, at: set.at },
             inclusions: st.inclusions, exclusions: st.exclusions, proposals: props };
  }

  /* R28 (T51; fix round 3, C8): the money sets whose `concerns` carry the id asked for (a project's among them), newest
     first by creation, each in the set's shape, bounded and saying when it was cut. A set holds one id, so a trail
     started in a project is listed under that project; a set with no `concerns` is listed under no id. An id that names
     a bundle the viewer may not see (a project of R43's fence) is answered exactly as an id that names nothing. Writes
     nothing. */
  moneySets({ concerns, purpose, limit, after, viewer } = {}) {
    if (!filled(concerns)) return refusal("NO_CONCERNS", localize("money.index.money_sets_are_listed_by", "money sets are listed by what they concern: name the id (moneysets&concerns=...)"));
    if (purpose !== undefined && purpose !== null && purpose !== "" && !SET_PURPOSES.includes(purpose))
      return refusal("UNKNOWN_PURPOSE", localize("money.index.a_money_sets_purpose_is_2", "a money set's purpose is {list}", { list: String(list(SET_PURPOSES)) }));
    const n = Number.parseInt(limit ?? LIST_LIMIT_DEFAULT, 10);
    const lim = Number.isFinite(n) ? Math.min(Math.max(n, 1), LIST_LIMIT_MAX) : LIST_LIMIT_DEFAULT;
    const v = viewer ?? "";
    const id = concerns.trim();
    const held = !!this.#one(`SELECT 1 AS x FROM bundles WHERE bundle_id=?`, id);
    const rows = held && !this.#visibleBundle(id, v) ? []
      : this.#rows(`SELECT * FROM money_sets WHERE concerns=? ${filled(purpose) ? "AND purpose=?" : ""} ORDER BY at DESC, rowid DESC`,
          id, ...(filled(purpose) ? [purpose] : []));
    let from = 0;
    if (filled(after)) {
      const i = rows.findIndex((r) => r.set_id === after);
      if (i === -1) return refusal("BAD_AFTER", localize("money.index.after_names_no_set_in", "after names no set in this list; start again without it"));
      from = i + 1;
    }
    const page = rows.slice(from, from + lim);
    const truncated = from + lim < rows.length;
    const sets = page.map((r) => {
      const st = this.#setState(r.set_id, v);
      return { set_id: r.set_id, purpose: r.purpose, label: r.label, concerns: r.concerns, inclusions: st.inclusions, exclusions: st.exclusions };
    });
    return { ok: true, sets, limit: lim, truncated, next: truncated ? page[page.length - 1].set_id : null };
  }

  /* R25: one fact's trail row, read from the fact, the events it concerns and the set's other inclusions; writes
     nothing. Each part is what the source states, never filled from another fact, an event's participants or an
     entity's role, and never placed by the fact's period. */
  #trailRow(row, included, viewer) {
    const capture = this.#rootCapture(row);
    const end = (p) => {
      const out = {};
      for (const k of ["entity", "fund", "account", "as_written"]) if (row[`${p}_${k}`] !== null) out[k] = row[`${p}_${k}`];
      if (!Object.keys(out).length) return { stated: false, says: NOT_STATED };
      return { stated: true, party: out, grade: this.#partyGrade(capture, row[`${p}_entity`] ?? row[`${p}_fund`]) };
    };
    const moved = this.#moved(row, viewer);
    const concerns = new Set(this.#rows(`SELECT concerns FROM money_concerns WHERE fact_id=?`, row.fact_id).map((r) => r.concerns));
    let compared = null;
    if (row.phase !== "actual" && !row.withdrawn_at) {
      const actuals = included.filter((r) => r.fact_id !== row.fact_id && r.phase === "actual" && !r.withdrawn_at
        && this.#rows(`SELECT concerns FROM money_concerns WHERE fact_id=?`, r.fact_id).some((c) => concerns.has(c.concerns)));
      compared = actuals.map((r) => ({ fact_id: r.fact_id, reconcile: this.reconcile({ a: row.fact_id, b: r.fact_id, viewer }) }));
    }
    const g = this.#gate("f.sight_bundle", viewer);
    const adjustments = this.#rows(`SELECT f.fact_id, f.sign, f.amount, f.amount_low, f.amount_high, f.as_read, f.phase, f.withdrawn_at
        FROM money_facts f WHERE f.adjusts=? AND (${g.sql}) ORDER BY f.at, f.fact_id`, row.fact_id, ...g.args)
      .map((a) => ({ fact_id: a.fact_id, sign: a.sign, amount: a.amount ?? { low: a.amount_low, high: a.amount_high }, as_read: a.as_read,
                     phase: a.phase, withdrawn: !!a.withdrawn_at, ...this.#partial(this.#factRow(a.fact_id)) }));
    const from = end("from"), to = end("to");
    const gaps = [...(from.stated ? [] : ["from"]), ...(to.stated ? [] : ["to"]), ...(moved.state === "undetermined" ? ["moved"] : []),
                  ...(row.basis === "undetermined" ? ["basis"] : [])];
    return { ...this.#partial(row), from, to, moved, ...(compared === null ? {} : { compared, budget_only: compared.length === 0 }),
             adjustments, ...(adjustments.length ? { adjustments_says: word("money.adjustments_says") } : {}),
             ...(row.withdrawn_at ? { withdrawn: true } : {}), gaps };
  }
  /* R25's `moved`: from the events the fact concerns (events R26), never from its period. */
  #moved(row, viewer) {
    const ids = this.#rows(`SELECT concerns FROM money_concerns WHERE fact_id=? AND ref_kind='event' ORDER BY concerns`, row.fact_id).map((r) => r.concerns);
    const ev = this.#ev();
    const events = [];
    if (ev && typeof ev.readEvent === "function")
      for (const id of ids) {
        let r = null;
        try { r = ev.readEvent({ eventId: id, viewer }); } catch { r = null; }
        if (r && r.found && r.event) events.push(r.event);
      }
    const dated = (e) => e.when !== null && e.when !== undefined && e.when !== "undetermined";
    const dating = (e) => ({ when: e.when, event: e.event_id,
      attestation: (e.attestations || []).find((a) => a.attestation_id === e.governing) ?? null });
    if (row.phase !== "actual") {
      const d = events.filter(dated);
      return { state: "did_not_move", phase: row.phase, when: d.length === 1 ? d[0].when : null, ...(d.length === 1 ? { event: d[0].event_id } : {}) };
    }
    const undetermined = (why, extra = {}) => ({ state: "undetermined", why, ...extra });
    if (!ev) return undetermined("events is not wired here, so no event the fact concerns is read");
    if (!events.length) return undetermined(word("money.undetermined.fact_concerns_event"));
    let one = events.length === 1 ? events[0] : null;
    if (!one) {
      const flows = events.filter((e) => MOVING_EVENTS.includes(e.kind));
      if (flows.length !== 1)
        return undetermined(word("money.undetermined.fact_concerns_events", { events: String(events.length), none: String(flows.length ? localize("money.index.more_than_one", "more than one") : "none") }),
          { events: events.map((e) => e.event_id) });
      one = flows[0];
    }
    if (!dated(one))
      return undetermined(one.when === "undetermined" ? word("money.undetermined.event_date_undetermined", { event_id: String(one.event_id), settled: String(one.why ?? "not settled") })
        : word("money.undetermined.event_placed_nowhere", { event_id: String(one.event_id) }), { event: one.event_id });
    return { state: "dated", ...dating(one) };
  }
  /* The latest act on each fact governs; every earlier one is kept (R12). */
  #setState(setId, viewer, at = null) {
    const acts = this.#rows(`SELECT * FROM money_set_acts WHERE set_id=? ${at ? "AND at <= ?" : ""} ORDER BY act_id`, setId, ...(at ? [at] : []));
    const latest = new Map(), history = new Map();
    for (const a of acts) {
      latest.set(a.fact_id, a);
      history.set(a.fact_id, [...(history.get(a.fact_id) || []), { act: a.act, reason: a.reason, by: a.by, at: a.at }]);
    }
    const inclusions = [], exclusions = [];
    for (const [fid, a] of latest) {
      if (!this.#factRow(fid, viewer)) continue;
      const e = { fact_id: fid, reason: a.reason, by: a.by, at: a.at, history: history.get(fid) };
      (a.act === "include" ? inclusions : exclusions).push(e);
    }
    return { inclusions, exclusions };
  }

  /* ---- R14: committed against paid ---- */

  committedAgainstPaid({ contract, at, viewer } = {}) {
    if (!filled(contract)) return noEntity("committed against paid is read for one contract (committedagainstpaid&contract=ENT-...)");
    const ent = this.#ent();
    if (!ent.has(contract) || kindOf(ent, contract) !== "contract")
      return refusal("NOT_A_CONTRACT", localize("money.index.contract_is_not_a_registered", "{contract} is not a registered contract", { contract: String(contract.slice(0, 60)) }));
    const v = viewer ?? "";
    const asOf = filled(at) ? at : null;
    /* As of `at`: a fact recorded by then and not withdrawn by then. */
    const live = (r) => !!r && (!asOf || r.at <= asOf) && (!r.withdrawn_at || (!!asOf && r.withdrawn_at > asOf));
    const concerning = (refId, stage) => this.#rows(`SELECT f.* FROM money_facts f JOIN money_concerns c ON c.fact_id=f.fact_id
        WHERE c.concerns=? AND f.phase='actual' AND f.stage=? ORDER BY f.period_start, f.fact_id`, refId, stage)
      .filter((r) => live(r) && this.#visibleBundle(r.sight_bundle, v));
    let committed;
    const ev = this.#ev();
    if (!ev) committed = { undetermined: true, why: localize("money.index.events_is_not_wired_here", "events is not wired here, so the award and its change orders are not read") };
    else {
      const got = ev.eventsFor({ entity: contract, kinds: ["award"], limit: LIST_LIMIT_MAX, viewer: v }) || {};
      const awards = [...(got.events || []), ...(got.placed_nowhere || [])].map((e) => e.event_id);
      const rows = [], seen = new Set();
      const take = (r, label) => { if (!seen.has(r.fact_id)) { seen.add(r.fact_id); rows.push({ r, label }); } };
      for (const award of awards) {
        for (const r of concerning(award, "encumbered")) take(r, word("money.take.committed_award", { award: String(award) }));
        for (const rel of this.#relations(award, "amends", "in", v))
          for (const r of concerning(rel.from, "encumbered")) take(r, word("money.take.change_order_amends", { from: String(rel.from), award: String(award) }));
      }
      committed = this.#side(rows, v);
      committed.awards = awards;
    }
    const paidRows = [], seenPaid = new Set();
    for (const r of concerning(contract, "paid")) { seenPaid.add(r.fact_id); paidRows.push({ r, label: word("money.label.paid_concerning_contract") }); }
    for (const s of this.#rows(`SELECT set_id FROM money_sets WHERE purpose='attribution' AND concerns=? ORDER BY set_id`, contract))
      for (const inc of this.#setState(s.set_id, v, asOf).inclusions) {
        const r = this.#factRow(inc.fact_id, v);
        if (!r || seenPaid.has(r.fact_id) || !live(r)) continue;
        if (!(r.phase === "actual" && r.stage === "paid")) continue;
        seenPaid.add(r.fact_id);
        paidRows.push({ r, label: word("money.label.attributed_member_reason", { inc: String(inc.reason) }), set_id: s.set_id });
      }
    const paid = this.#side(paidRows, v);
    let difference;
    if (committed.undetermined || paid.refused || committed.refused || !committed.sum || !paid.sum)
      difference = { undetermined: true, why: committed.undetermined ? committed.why : committed.refused || paid.refused ? word("money.why.side_sum_refused") : word("money.why.side_holds_fact") };
    else {
      const d = subtract(committed.sum, paid.sum);
      difference = d.refused ? { ...d } : { figure: d, says: word("money.says.committed_paid_figure") };
    }
    return { ok: true, contract, at: asOf, committed, paid, difference };
  }
  /* One side: its facts and their sum through calc-grammar, under R10's rule (a refused sum is answered as such). */
  #side(entries, viewer) {
    const facts = entries.map(({ r, label, set_id }) => ({ ...this.#view_(r, viewer), label, ...(set_id ? { set_id } : {}) }));
    if (!entries.length) return { facts, sum: null, says: word("money.says.fact_held_side") };
    const ok = this.summable({ factIds: entries.map((e) => e.r.fact_id), viewer });
    if (ok.ok === false) return { facts, sum: null, refused: ok };
    let sum = null;
    for (const { r } of entries) {
      const f = figureOf(r);
      sum = sum === null ? f : add(sum, f);
      if (sum.refused) return { facts, sum: null, refused: sum };
    }
    return { facts, sum, says: word("money.says.summed_through_calc") };
  }
  /* Events' relations of one kind at an event, from its read (events R26): in or out. */
  #relations(eventId, kind, direction, viewer) {
    const ev = this.#ev();
    if (!ev || typeof ev.readEvent !== "function") return [];
    let r;
    try { r = ev.readEvent({ eventId, viewer }); } catch { return []; }
    const rels = r && r.found && r.event && Array.isArray(r.event.relations) ? r.event.relations : [];
    return rels.filter((x) => x && x.kind === kind && x.direction === direction && !x.withdrawn);
  }

  /* ---- R15: the chain of authority ---- */

  authorityChain({ factId, viewer } = {}) {
    if (!filled(factId)) return refusal("NO_FACT", localize("money.index.a_chain_of_authority_is", "a chain of authority is read for one money fact (MNY-...)"));
    const row = this.#factRow(factId, viewer ?? "");
    if (!row) return { ok: true, found: false, fact_id: factId };
    const events = this.#rows(`SELECT concerns FROM money_concerns WHERE fact_id=? AND ref_kind='event' ORDER BY concerns`, row.fact_id).map((r) => r.concerns);
    if (!events.length) return { ok: true, found: true, fact_id: row.fact_id, chains: [], says: word("money.says.fact_concerns_event") };
    if (!this.#ev()) return { ok: true, found: true, fact_id: row.fact_id, chains: [], undetermined: true, why: localize("money.index.events_is_not_wired_here_2", "events is not wired here") };
    const chains = events.map((e) => this.#walk(e, viewer ?? ""));
    return { ok: true, found: true, fact_id: row.fact_id, chains };
  }
  #walk(start, viewer) {
    const hops = [], seen = new Set([start]);
    let frontier = [start], depth = 0, stop = null;
    while (frontier.length && !stop) {
      if (depth >= BOUNDS.depth_default) { stop = "depth"; break; }
      const next = [];
      for (const node of frontier) {
        const rels = this.#relations(node, "authorises", "in", viewer);
        if (rels.length > BOUNDS.fanout) { stop = "fanout"; break; }
        for (const rel of rels) {
          hops.push({ from: rel.from, to: node, relation_id: rel.relation_id ?? null, kind: "authorises",
                      citation: rel.attestation ?? null, grade: rel.grade ?? null });
          if (!seen.has(rel.from)) {
            seen.add(rel.from); next.push(rel.from);
            if (seen.size > BOUNDS.nodes) { stop = "nodes"; break; }
          }
        }
        if (stop) break;
      }
      frontier = next; depth += 1;
    }
    const out = { event_id: start, hops, authorising_held: hops.length > 0,
                  says: hops.length ? localize("money.index.the_authorising_events_held_toward", "the authorising events held toward this event") : localize("money.index.no_authorising_event_is_held", "no authorising event is held for this event") };
    return stop ? { ...out, ...exhausted({ visited: seen.size, reason: stop }) } : out;
  }

  /* ---- R16: the connection owner ---- */

  /** R16: registers once with a registry (the plane's default when none is given), owner `money`. */
  registerConnections(registry = defaultRegistry) {
    if (this.#registered) return { ok: true, already: true };
    const r = registry.registerOwner({ owner: "money", kinds: Money.CONNECTION_KINDS, neighbours: (a) => this.neighbours(a) });
    if (r && r.ok) this.#registered = true;
    return r;
  }
  static CONNECTION_KINDS = Object.freeze([Object.freeze({ kind: CONNECTION_KIND, word: CONNECTION_WORD, class: "evidentiary" })]);

  /* One fact as its R16 edge, or null when it is out of the date asked. */
  #edge(r, at) {
    const valid = { from: r.period_from, to: r.period_to, precision: r.period_precision, zone: r.period_zone };
    let v;
    try { v = validAt({ valid }, at); } catch (e) { v = { undetermined: true, why: String(e && e.message ? e.message : e) }; }
    if (v === "out" || (v && v.refused)) return null;
    const capture = this.#rootCapture(r);
    const ends = [this.#partyGrade(capture, r.from_entity ?? r.from_fund), this.#partyGrade(capture, r.to_entity ?? r.to_fund)];
    return {
      id: r.fact_id, from: r.from_entity ?? r.from_fund, to: r.to_entity ?? r.to_fund, kind: CONNECTION_KIND, owner: "money",
      valid, evidence: [r.source_fact ? { source: r.source_fact } : { source: r.source_capture_sha, ...(r.source_table ? { table: r.source_table, row: r.source_row } : { extent: JSON.parse(r.source_extent) }) }],
      grade: { assertion: r.grade_reading ?? LOWEST_GRADE, ends: ends.map((x) => x ?? LOWEST_GRADE) },
      derived: null,
      money: { kind: r.kind, phase: r.phase, ...(r.stage ? { stage: r.stage } : {}), fund: r.from_fund ?? r.to_fund ?? null,
               period: valid, grades_stated: { reading: r.grade_reading, ends } },
      ...(v === "in" ? {} : { undetermined: { why: v.why } }),
      ...this.#partial(r),
    };
  }

  /* R35 (T52): a money set's neighbours. For each fact the set includes whose payer and payee are both entities or funds:
     the fact's edge (R16), the payer and the payee as nodes, and the source document as a node named by its title with
     one edge from the set to it. A fact whose parties are names as written adds no node; a set of such facts, an absent
     set or one the viewer may not see answers no items and no refusal. */
  #setNeighbours({ node, kinds, at, page, viewer }) {
    const none = { items: [], nodes: [] };
    const set = this.#one(`SELECT * FROM money_sets WHERE set_id=?`, node);
    if (!set) return none;
    if (filled(set.concerns) && this.#one(`SELECT 1 AS x FROM bundles WHERE bundle_id=?`, set.concerns)
        && !this.#visibleBundle(set.concerns, viewer)) return none;
    const items = [], nodes = new Map(), docs = new Map();
    for (const inc of this.#setState(node, viewer).inclusions) {
      const r = this.#factRow(inc.fact_id, viewer);
      if (!r || r.withdrawn_at) continue;
      const from = r.from_entity ?? r.from_fund, to = r.to_entity ?? r.to_fund;
      if (!from || !to) continue;
      const edge = this.#edge(r, at);
      if (!edge) continue;
      items.push(edge);
      for (const id of [from, to]) if (!nodes.has(id)) nodes.set(id, { id, role: "party" });
      const capture = this.#rootCapture(r);
      const doc = capture ? this.#one(`SELECT b.bundle_id, b.title FROM register g JOIN bundles b ON b.bundle_id = g.bundle_id WHERE g.capture_sha=?`, capture) : null;
      if (doc && this.#visibleBundle(doc.bundle_id, viewer) && !docs.has(doc.bundle_id))
        docs.set(doc.bundle_id, { id: doc.bundle_id, role: "source_document", title: doc.title, capture_sha: capture });
    }
    if (!items.length) return none;
    for (const d of docs.values()) {
      nodes.set(d.id, d);
      items.push({ id: `${node}>${d.id}`, from: node, to: d.id, kind: CONNECTION_KIND, owner: "money", valid: { from: null, to: null, precision: "day", zone: items[0].valid.zone },
        evidence: [{ source: d.capture_sha }], grade: { assertion: LOWEST_GRADE, ends: [LOWEST_GRADE, LOWEST_GRADE] }, derived: null });
    }
    const asked = Array.isArray(kinds) && !kinds.includes(CONNECTION_KIND) ? [] : items;
    const after = isObj(page) && typeof page.after === "string" ? page.after : null;
    const start = after ? asked.findIndex((i) => i.id > after) : 0;
    const from = start === -1 ? asked.length : start;
    const slice = asked.slice(from, from + BOUNDS.fanout);
    const more = from + BOUNDS.fanout < asked.length;
    return { items: slice, nodes: [...nodes.values()], ...(more ? { next: { after: slice[slice.length - 1].id } } : {}) };
  }

  /** R16: each fact as one edge from payer to payee (entity, else fund), valid over its period, as of `at`. */
  neighbours({ node, kinds, at, page, viewer } = {}) {
    if (viewer === undefined || viewer === null || viewer === "")
      return { refused: "VIEWER_MISSING", why: localize("money.index.a_read_names_the_member", "a read names the member reading; an absent viewer is neither an administrator nor the public") };
    if (filled(node) && node.startsWith("MSR-")) return this.#setNeighbours({ node, kinds, at, page, viewer });
    if (Array.isArray(kinds) && !kinds.includes(CONNECTION_KIND)) return { items: [] };
    if (!filled(node)) return { items: [] };
    const g = this.#gate("f.sight_bundle", viewer);
    const rows = this.#rows(`SELECT f.* FROM money_facts f WHERE f.withdrawn_at IS NULL
        AND COALESCE(f.from_entity, f.from_fund) IS NOT NULL AND COALESCE(f.to_entity, f.to_fund) IS NOT NULL
        AND (f.fact_id IN (SELECT fact_id FROM money_facts WHERE from_entity=? OR (from_entity IS NULL AND from_fund=?)
                           UNION SELECT fact_id FROM money_facts WHERE to_entity=? OR (to_entity IS NULL AND to_fund=?)))
        AND (${g.sql}) ORDER BY f.fact_id`, node, node, node, node, ...g.args);
    if (rows.length > BOUNDS.hub) return { items: [], hub: { set_size: rows.length, why: word("money.why.money_facts_name", { hub: String(BOUNDS.hub) }) } };
    const items = [];
    for (const r of rows) { const i = this.#edge(r, at); if (i) items.push(i); }
    const after = isObj(page) && typeof page.after === "string" ? page.after : null;
    const start = after ? items.findIndex((i) => i.id > after) : 0;
    const from = start === -1 ? items.length : start;
    const slice = items.slice(from, from + BOUNDS.fanout);
    const more = from + BOUNDS.fanout < items.length;
    return { items: slice, ...(more ? { next: { after: slice[slice.length - 1].id } } : {}) };
  }

  /* ---- fund types (Terms, `balance_class`; K1505 (10)) ---- */

  /** A fund's type, held here with its history; the latest governs. */
  setFundType({ fund, type, basis, by } = {}) {
    if (!FUND_TYPES.includes(type)) return refusal("UNKNOWN_FUND_TYPE", localize("money.index.a_funds_type_is_list", "a fund's type is {list}", { list: String(list(FUND_TYPES)) }), { list: FUND_TYPES });
    if (!filled(basis)) return refusal("NO_BASIS", localize("money.index.a_funds_type_names_its", "a fund's type names its basis: the source that states it"));
    const ent = this.#ent();
    if (!filled(fund) || !ent.has(fund)) return noSuchEntityAt(ent, fund, "fund");
    if (kindOf(ent, fund) !== "fund") return refusal("NOT_A_FUND", localize("money.index.fund_is_not_registered_as", "{fund} is not registered as a fund", { fund: String(fund) }));
    const at = this.#now();
    this.#sql.exec(`INSERT INTO money_fund_types (fund, fund_type, basis, by, at) VALUES (?,?,?,?,?)`, fund, type, clip(basis), by ?? null, at);
    return { ok: true, fund, type, at, family: BALANCE_FAMILIES[type] };
  }
  fundTypeOf(fund) {
    const r = filled(fund) ? this.#one(`SELECT fund_type FROM money_fund_types WHERE fund=? ORDER BY seq DESC LIMIT 1`, fund) : null;
    return r ? r.fund_type : null;
  }

  /* ---- R17: the closed lists ---- */

  kinds() { return MONEY_KINDS; }
  phases() { return PHASES; }
  stages() { return STAGES; }
  bases() { return BASES; }
  precisions() { return PRECISIONS; }
}

/* ---- helpers ---- */

/* events R49's refusal shape for VIEWER_MISSING and EXTENT_MALFORMED (K2114, K2116): no catalogue row (K231). */
const shapeRefusal = (code, why) => ({ ok: false, refused: code, code, reason: code, why });

/* An unsigned exact decimal as calc-grammar's figure (R1's range check). */
const exactFigure = (value) => ({ value: value.replace(/,/g, ""), sign: "+", precision: "exact" });
function toList(v) {
  if (v === undefined || v === null || v === "") return [];
  return (Array.isArray(v) ? v : String(v).split(",")).map((x) => String(x).trim()).filter(Boolean);
}
function safeJson(s) { try { return JSON.parse(s); } catch { return s; } }
function kindOf(ent, id) {
  try { const r = ent.readEntity({ entityId: id }); return r && r.found && r.entity ? r.entity.kind : null; } catch { return null; }
}
/* entities' one answer to an unregistered id (its R36), naming where it was named. */
function noSuchEntityAt(_ent, id, end) {
  return noSuchEntity(typeof id === "string" ? id : null, { end });
}

/* A fact's source as read back (R8): an extent of a capture, a table row read through a binding, or a fact. */
function sourceOf(row) {
  if (row.source_fact) return { fact: row.source_fact };
  if (row.source_table) return { table: row.source_table, row: row.source_row, binding: row.source_binding, capture_sha: row.source_capture_sha };
  return { capture_sha: row.source_capture_sha, extent: JSON.parse(row.source_extent), ...(row.source_content_id ? { content_id: row.source_content_id } : {}) };
}

/* A fact's figure for calc-grammar (R14): signed, with its precision and currency. */
function figureOf(r) {
  if (r.precision === "range")
    return { low: r.amount_low, high: r.amount_high, sign: r.amount_low.startsWith("-") ? "-" : "+", precision: "range", currency: r.currency };
  const neg = r.amount.startsWith("-");
  return { value: neg ? r.amount.slice(1) : r.amount, sign: neg ? "-" : "+", precision: r.precision, currency: r.currency };
}
/* Whether two facts' amounts may stand for one figure (R11), through calc-grammar's `relate`: a rounded or approximate
   figure stands for half its printed unit either side, a range for its bounds, an exact figure for itself. Currency is
   R11's own dimension, so the amounts are related apart from it. */
function overlaps(x, y) {
  const loose = (r) => {
    const { currency: _c, ...f } = figureOf(r);
    return f.precision === "approximate" ? { ...f, precision: "rounded" } : f;
  };
  const rel = relate(loose(x), loose(y));
  return rel !== "lower" && rel !== "higher";
}
/* R5: the facts a promoted bundle carries in `data/money.json`. */
function factsOf(c) {
  const files = c && Array.isArray(c.files) ? c.files : [];
  const f = files.find((x) => x && x.path === "data/money.json");
  if (!f || typeof f.text !== "string") return [];
  try { const j = JSON.parse(f.text); return Array.isArray(j.facts) ? j.facts.filter(isObj) : []; } catch { return []; }
}

/* ---- R20: the one-home checks at the store's gate ---- */

const HAS_ID_FIELDS = ["adjusts", "from_entity", "from_fund", "to_entity", "to_fund", "source_fact", "by"];
function factGate(row) {
  const has = (x) => x !== null && x !== undefined;
  const sources = [has(row.source_extent), has(row.source_table), has(row.source_fact)].filter(Boolean).length;
  const capture = has(row.source_capture_sha);
  if (sources !== 1 || capture === has(row.source_fact)) return { code: "ONE_SOURCE", detail: localize("money.index.a_money_fact_rests_on_2", "a money fact rests on exactly one source") };
  if ([row.source_capture_sha, row.source_fact, row.source_content_id].some((x) => typeof x === "string" && x.startsWith("CALC-")))
    return { code: "SOURCE_IS_CALCULATION", detail: localize("money.index.a_calculation_is_never_a_2", "a calculation is never a money fact's source") };
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === "string" && isHypothesisId(v)) return { code: "HYPOTHESIS_ID", detail: localize("money.index.a_hypothesis_is_never_named", "a hypothesis is never named in a money fact ({k})", { k: String(k) }) };
    if (/total|sum/i.test(k)) return { code: "TOTAL_NOT_STORED", detail: localize("money.index.a_total_is_a_calculation", "a total is a calculation, never stored as a money fact") };
  }
  for (const k of HAS_ID_FIELDS) if (typeof row[k] === "string" && row[k].startsWith("DUT-"))
    return { code: "CONCERNS_DUTY", detail: localize("money.index.a_duty_is_never_named", "a duty is never named in a money fact") };
  return null;
}
function concernsGate(row) {
  if (typeof row.concerns === "string" && row.concerns.startsWith("DUT-")) return { code: "CONCERNS_DUTY", detail: localize("money.index.a_money_fact_never_concerns", "a money fact never concerns a duty") };
  if (typeof row.concerns === "string" && isHypothesisId(row.concerns)) return { code: "HYPOTHESIS_ID", detail: localize("money.index.a_hypothesis_is_never_named_2", "a hypothesis is never named in a money fact") };
  return null;
}

/* ---- R18: the ops map ---- */

/** R18: one route arm per act and read, on entities R40's pattern: parameters from `url`'s query (the control plane's
 *  stamps among them), acts' arguments from the body. Every write goes through R1's one append site. */
export function moneyOps(money, url, body) {
  const q = (k) => url.searchParams.get(k);
  const b = body && typeof body === "object" ? body : {};
  const ids = (k) => (q(k) || "").split(",").map((s) => s.trim()).filter(Boolean);
  return {
    moneyrecord: () => money.recordFact(b),
    moneywithdraw: () => money.withdrawFact(b),
    money: () => money.readFact({ factId: q("id"), viewer: q("viewer") }),
    moneyof: () => money.moneyOf({ entity: q("entity"), period: q("period"), kinds: q("kinds"), phases: q("phases"),
                                   limit: q("limit"), viewer: q("viewer") }),
    moneysummable: () => money.summable({ factIds: ids("ids"), viewer: q("viewer") }),
    moneyreconcile: () => money.reconcile({ a: q("a"), b: q("b"), viewer: q("viewer") }),
    moneysetcreate: () => money.createSet(b),
    moneyset: () => money.readSet({ setId: q("id"), viewer: q("viewer") }),
    moneysets: () => money.moneySets({ concerns: q("concerns"), purpose: q("purpose"), limit: q("limit"), after: q("after"), viewer: q("viewer") }),
    moneysetinclude: () => money.include(b),
    moneysetexclude: () => money.exclude(b),
    moneysetpropose: () => money.proposeInclusion(b),
    moneyfundtype: () => money.setFundType(b),
    committedagainstpaid: () => money.committedAgainstPaid({ contract: q("contract"), at: q("at"), viewer: q("viewer") }),
    authoritychain: () => money.authorityChain({ factId: q("id"), viewer: q("viewer") }),
  };
}

/* R27 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  recordfact: { classes: ["admin","member","probe"], mutating: true, weight: "reversible", description: localize("money.declared.recordfact", "money-directed: keyed by a new MNY- id; holds one source's reading of one amount and moves no bundle"),
    fields: { accepts: ["amount","as_read","currency","sign","precision","kind","phase","stage","adjusts","basis","period","from","to","codes","balance_class","buys","concerns","source","method","question"], requires: ["amount","as_read","currency","sign","precision","kind","phase","basis","period","source"] } },
  createset: { classes: ["admin","member","probe"], mutating: true, weight: "undetermined", description: localize("money.declared.createset", "money-set-directed: keyed by a new MSR- id; writes money's rows and moves no bundle"),
    fields: { accepts: ["purpose","label","concerns"], requires: ["purpose","label"] } },
  include: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "reasoned", description: localize("money.declared.include", "money-set-directed: keyed by (set, fact); writes money's rows and moves no bundle"),
    fields: { accepts: ["setId","factId","reason"], requires: ["setId","factId","reason"] } },
  exclude: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "reasoned", description: localize("money.declared.exclude", "money-set-directed: keyed by (set, fact); writes money's rows and moves no bundle"),
    fields: { accepts: ["setId","factId","reason"], requires: ["setId","factId","reason"] } },
  reconcile: { classes: ["admin","member","probe"], mutating: false, weight: "read", description: localize("money.declared.reconcile", "read: whether two money facts are consistent, or each dimension that differs; writes nothing"),
    fields: { accepts: ["a","b"], requires: ["a","b"] } },
  moneysets: { classes: ["admin","member","probe"], mutating: false, weight: "read", description: localize("money.declared.moneysets", "read: the money sets that concern an id, such as a project's trails, newest first, bounded; writes nothing"),
    fields: { accepts: ["concerns","purpose","limit","after"], requires: ["concerns"] } },
  committedagainstpaid: { classes: ["admin","member","probe"], mutating: false, weight: "read", description: localize("money.declared.committedagainstpaid", "read: a contract's committed and paid facts with their sums and the difference, never a verdict; writes nothing"),
    fields: { accepts: ["contract","at"], requires: ["contract"] } },
  authoritychain: { classes: ["admin","member","probe"], mutating: false, weight: "read", description: localize("money.declared.authoritychain", "read: the chain of authorising events toward the event a fact concerns, bounded; writes nothing"),
    fields: { accepts: ["id"], requires: ["id"] } },
});

/* ---- R17: the closed lists, module-level (query-language and affordances import them; K1563) ---- */

export const kinds = () => MONEY_KINDS;
export const phases = () => PHASES;
export const stages = () => STAGES;
export const bases = () => BASES;
export const precisions = () => PRECISIONS;

/* ---- R16: the owner, registered once at load with the plane's registry (K1563 (1)) ---- */

/** The owner's read: the instance of `host` when the registry passes one, else the isolate's one instance, else
 *  refused `OWNER_HOST_AMBIGUOUS`. */
export function ownerNeighbours(args = {}) {
  const { host, ...rest } = args && typeof args === "object" ? args : {};
  if (host) return moneyOf(host).neighbours(rest);
  if (live.size !== 1)
    return { refused: "OWNER_HOST_AMBIGUOUS", why: `money's read names no host and this isolate holds ${live.size} money stores` };
  const [storage] = live;
  return instances.get(storage).neighbours(rest);
}
try { defaultRegistry.registerOwner({ owner: "money", kinds: Money.CONNECTION_KINDS, neighbours: ownerNeighbours }); }
catch { /* the registry is the plane's; a refusal here leaves the owner unregistered, never the module unloaded */ }
