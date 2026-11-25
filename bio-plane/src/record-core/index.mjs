/* record-core — the record's storage (layer 2): id allocation, leases, the append-only history and
   manifest of every promotion, the instance's settings, the evidence store, and purge. It holds no
   member, capability or fence (membership's) and decides nothing about what may be committed
   (promotion's). Requirements: build/requirements/record-core.md (R1–R91).

   REACHED THROUGH `recordOf(ctx)`: one instance per Durable Object storage, so every module in the
   object shares one transaction depth, one purge declaration list and one evidence binding. The
   instance reads and writes only this module's own tables and the clock (R31); `purge` also clears
   the tables other modules declared to it (R21), and `seedMintLedger` reads the live rows its
   caller and the registered seeds name (R40, R70). Extracted from `legacy-store` (store.mjs, schema.mjs) in T3; the
   reasoning the legacy comments carried is kept beside the code it explains. T19: the audit's seams (R68, R69), the
   mint seeds (R70), the schema run first (R71) and the ops map (R72, R73). T20: this module's own figures exported for
   `plane` to register (R74). T24: a chosen opaque id recorded in the ledger (R75). T33 (T33-19; S0-2, S0-3, B0.12,
   K1493): ids minted from record-grammar's `ID_TABLE`, the counter with no ceiling and the opaque allocator (R1, R40,
   R76); `declareTable` with its classes, `declarePurge` its default form (R21, R46); the derived-cache convention (R77);
   the store gate (R78); expunge with a tombstone (R79). T34 (T34-9; N554, N593, K1728): `CALC` minted opaque (R62, R76);
   a derived-rebuildable table's `from` (R77); the declaration's two older refusals answered with their rows (R80). T35
   (T35-13; N655, N664, DEC-49, DEC-149): the lease's and the settings' refusals answered with their rows (R81); every
   member-facing sentence says "your group's Civicsmith" (R82). T41 (T41-2a; K2431, K2435): `STP` and `GUD`, opaque in
   `ID_TABLE` since record-grammar's T41 job, each named by its own sentence in `mintExhausted` (R62, R76). T42 (T42-2a;
   K2616, K2617): `ACD`, a case account draft, opaque in `ID_TABLE` with `legacy: "sequential"` since record-grammar's
   T42 job (its R55), minted opaque by its form alone and named by its own sentence (R62, R76). T46 (T46-3; N904): the
   strict `getSetting` tells an unreadable setting (`SETTING_UNREADABLE`) from an unset one (R83). T47 (T47-6; N939):
   `setSetting` refuses a value that does not round-trip through JSON, `SETTING_NOT_JSON` under its own row (R84). T48
   (T48-8; N1018, K3112): `WCD` and `OUTC`, `case-inputs`' opaque prefixes, each named by its own sentence (R62). Fix round 7
   (G80; K4736): the record's write counter (R89, R90). Fix round 8 (G115; K4811): bookkeeping tables left out of it (R91). */
import { checkBundle, createSha256, EXTENSION_ARMS, LEGACY_TYPE_ALIASES, ID_TABLE } from "../record-grammar/index.mjs";
import { RECORD_SCHEMA } from "./schema.mjs";
import { RECORD_CORE_CHECKS, PER_ITEM_CHECKS } from "./checks.mjs";
import { word, localize } from "../setup-words/index.mjs";

export { RECORD_SCHEMA };
export { RECORD_CORE_CHECKS, PER_ITEM_CHECKS } from "./checks.mjs";

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const C_ID = /^C-\d+(\.\d+)?$/;             /* a catalogue check id, as `checkBundle`'s grammars name them */

/* A refusal under one of this module's own rows (DEC-49): its code, its row's check and translation, and the detail;
   `more` adds the refusal's own fields and never replaces these. */
function rowRefusal(code, detail, more) {
  const row = RECORD_CORE_CHECKS[code];
  return { ...more, ok: false, reason: code, code, check: row.check, translation: row.translation, detail };
}
const REFUSED = Symbol("record-core-refusal");
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const te = new TextEncoder();

/* ---- the instant (R47, R48): module-level functions ---- */

/* D-543 — THE STAMPING HELPER, AND IT NAMES ITS PRECISION AT EVERY CALL. The record spells an instant
   two ways: `…:00Z` (whole seconds — the convention `ISO_TS_RE` holds a document's own bytes to, about
   twenty gate checks) and `…:00.123Z` (milliseconds, `toISOString()`'s own spelling, which a row
   stamped for ordering keeps). Neither is wrong; what was wrong is that the precision was carried by a
   regex or a `split` at each site, in two spellings nobody named, so a site's precision could be learned
   only by reading it. `stampInstant("second" | "millisecond", when)` says it; any other word throws.
   `observation_log.at` stays whole-second by BOB #33's ruling (D-516), and it is a "second" call here
   like any other, not an exception to the helper.
   AND TWO SPELLINGS MUST NEVER BE COMPARED AS STRINGS: `Z` sorts above `.`, so `…:00Z` ranks AFTER
   `…:00.123Z` though it names the earlier instant (read as `.000`). `instantOrder` compares INSTANTS —
   negative, zero or positive like a comparator, and NaN when either side is not an instant, so a
   `> 0` / `< 0` test is false for an unreadable stamp rather than ranking it as zero. Where a
   comparison crosses act kinds, it goes through this. */
export function stampInstant(precision, when = Date.now()) {
  if (precision !== "millisecond" && precision !== "second")
    throw new Error(`stampInstant: precision is "second" or "millisecond", never ${JSON.stringify(precision)}`);
  const iso = new Date(when).toISOString();
  return precision === "millisecond" ? iso : iso.replace(/\.\d+Z$/, "Z");
}
export function instantOrder(a, b) {
  const x = typeof a === "string" && a ? Date.parse(a) : NaN, y = typeof b === "string" && b ? Date.parse(b) : NaN;
  return x - y;
}

/* ---- a file's digest and size (R58): module-level functions ---- */

/** R57's creation marker: the SHA-256 of the empty string, the base a creation's manifest entry records, as the
 *  check catalogue recognises it. */
export const EMPTY_STRING_SHA = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

/* REC-175: THE ONE COMPUTATION of what a promoted file's digest IS, read by `promotion` before any write and by
   `digestCensus` over what is already held, so the check at the door and the census of the past cannot disagree
   about what a disagreement is. An inline file is hashed over `new TextEncoder().encode(text)` — the UTF-8 bytes
   of the string the `files.content` column stores, never a normalised copy (no trimming, no line-ending fold).
   A blob-backed file's digest is its content address, `blobSha`, lower-cased. Null for neither. */
export function fileDigestOf(f) {
  if (f && typeof f.text === "string") return createSha256().update(te.encode(f.text)).hex();
  if (f && typeof f.blobSha === "string" && f.blobSha) return f.blobSha.toLowerCase();
  return null;
}
/* REC-178: THE ONE MEASURE of an inline file's size — the byte length of the UTF-8 encoding of the string the
   `files.content` column stores — read by `promotion` (the stored figure and its inline bound) and by `digestCensus`
   (the held figure), so the door and the census cannot disagree about what a size is. Null for a blob-backed file. */
export function inlineBytesOf(f) {
  return f && typeof f.text === "string" ? te.encode(f.text).length : null;
}

/* R56, R57: a census's listing bound — an integer 0..500, 50 when absent, empty or not an integer. */
function censusCap(limit) {
  const asked = limit === undefined || limit === null || limit === "" ? NaN : Number(limit);
  return Math.max(0, Math.min(Number.isInteger(asked) ? asked : 50, 500));
}
/* REC-176: THE FILE LIST A MANIFEST ROW RECORDS. An unparsable or non-array value is an EMPTY list. */
function manifestFiles(filesJson) {
  let arr;
  try { arr = filesJson == null ? null : JSON.parse(filesJson); } catch { arr = null; }
  return Array.isArray(arr) ? arr.filter((f) => f && typeof f === "object") : [];
}

/* ---- no free opaque id (R62, C-59.6): module-level ---- */

/* What each opaque-minted prefix's id is called in R62's detail: R3's set (`RecordCore.GATED_ID_PREFIXES`), `SRC`, a
   source, which `sources` mints opaque through `mintOpaqueId` and never through the counter (N376, K540), and `case-inputs`'
   two prefixes, minted the same way (T48). */
const MINTED_OBJECT = Object.freeze({ PROJ: "project", CASE: "case", DRAFT: "draft", RVG: "grant", TASK: "task", SRC: "source",
  /* T33 (R76): the opaque prefixes of `ID_TABLE`, which `allocId` draws a 16-character tail for; `CALC` since T34 (K1728),
     `STP` and `GUD` since T41 (record-grammar R51, R53; K2431), `ACD` since T42 (record-grammar R55; K2616, K2617) */
  EVT: "event", LIN: "line", MNY: "money fact", PFA: "person fact", IDC: "identity claim", CALC: "calculation",
  STP: "step", GUD: "reading guide", ACD: "case account draft",
  /* T48 (R62; N1018, K3112): `case-inputs`' two opaque prefixes (its R6, R9; record-grammar R46) */
  OUTC: "carried outcome" });
/* A prefix whose id reads better named after the word "id" than before it: `WCD`, whose object is a phrase (T48, R62). */
const MINTED_ID_FOR = Object.freeze({ WCD: localize("record-core.index.a_draft_of_a_new", "a draft of a new edition's statement of what changed") });

/* R76 (S0-2): the prefixes `ID_TABLE` gives the opaque form, read from record-grammar's one table, never restated. Minting
   follows `form` alone: a row that also carries `legacy: "sequential"` (`CALC`, K1728; `ACD`, K2616) is minted opaque, its counter never
   read or stepped, and the sequential ids minted before stay held. */
const OPAQUE_PREFIXES = new Set(ID_TABLE.filter((e) => e.form === "opaque").map((e) => e.prefix));
const TAIL_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const TAIL_LENGTH = 16;      /* measures-T33/assistant-substrate.md §5: under 1e-9 over a 10-year store at 10^7 a year */

/** R62 (N322, N250, K275, K392): THE ONE ANSWER TO ONE CONDITION, no free opaque id could be drawn (`mintOpaqueId`
 *  answered null, R9). Every act of any module that meets it answers through here, so `MINT_EXHAUSTED` is minted at
 *  one site under one row (C-59.6). `detail` is one fixed sentence per prefix, naming the id that could not be drawn
 *  and saying nothing was written, the same for every caller; a prefix neither in R3's set, `SRC`, R76's opaque set nor
 *  `case-inputs`' `WCD` and `OUTC` (T48) is named by no object. `extra`
 *  adds the caller's own fields and never replaces these. It writes nothing and never throws. */
export function mintExhausted(prefix, extra) {
  const asked = typeof prefix === "string" ? prefix : "";        /* only a string names a prefix */
  const what = Object.hasOwn(MINTED_ID_FOR, asked) ? `id for ${MINTED_ID_FOR[asked]}`
    : Object.hasOwn(MINTED_OBJECT, asked) ? `${MINTED_OBJECT[asked]} id` : "id";
  let own = {};
  try { if (extra && typeof extra === "object" && !Array.isArray(extra)) own = { ...extra }; } catch { own = {}; }
  const row = RECORD_CORE_CHECKS.MINT_EXHAUSTED;
  /* DEC-49 REGION is-mint-exhausted */
  return { ...own, ok: false, reason: "MINT_EXHAUSTED", code: "MINT_EXHAUSTED", check: row.check,
           translation: row.translation, prefix: asked,
           detail: localize("record-core.index.your_teams_civicsmith_could_not", "your team's Civicsmith could not find a free {what}: every one it drew was already taken. Nothing was written.", { what: String(what) }) };
  /* END DEC-49 REGION is-mint-exhausted */
}

/* ---- the set form of an act (R49–R52, R55, C-75): module-level ---- */

/** R49: the most items one set may carry. */
export const PER_ITEM_MAX = 100;

/* D-126 — THE PER-ITEM WEIGHT — "each item independently succeeds or is RETAINED WITH A REASON"
 * (NOTIFICATIONS.md §Applying a handler to a selection; Bob: *"If that action didn't work for one or
 * more, they'd stay in the list so that the user can take a different action."*).
 *
 * ONE HELPER FOR EVERY SET ACT. An act that takes a SET when its body carries `items` hands each item to
 * the SAME function its single form calls (`one`), so an item is accepted and refused by exactly the
 * rules one key would be, and its reason is that act's own refusal, verbatim. This helper words only
 * what belongs to the SET (C-75).
 *
 * WHAT IT REFUSES TO BE, and each is how a liar would pass the row:
 *   - ALL-OR-NOTHING RELABELLED. A refusal on item k does not stop item k+1; nothing here breaks out of
 *     the loop.
 *   - SILENT SKIPPING. Every item the caller sent has exactly one outcome in `items[]`, at its own
 *     `index`, `applied` or `retained`, and `applied + retained === count` by construction.
 *   - `ok: true` OVER A MIXED SET. `ok` is true only when EVERY item applied; otherwise the answer is
 *     C-75.5's summary refusal WITH `items[]` beside it.
 *
 * THE SERVER'S STAMPS WIN OVER EVERY ITEM. `stamped` (the actor, the decider) is spread LAST, so an item
 * that names its own actor is overwritten exactly as a single-key body is. The rest of the body is SHARED
 * — a common `reason`, `to` or disposition — and an item may override it for itself.
 *
 * REC-205 — A SHARED IDENTITY OF ONE SHAPE MUST NOT REACH AN ITEM OF ANOTHER (R51). An act with several
 * identity shapes decides WHICH ACT IT IS by what the caller sent, and in a set that is the shared body
 * plus the item: a project named once for a selection made every OTHER item project-scoped too
 * (measured at 1a7f0bcc0). So an item that NAMES a key of one or more of `itemKeys`' groups keeps the
 * shared values of THOSE groups' keys and of `sharedKeys`, and the other groups' identity keys are dropped
 * for that item alone; an item naming no identity is unchanged. The groups are the act's published ones
 * (`affordances`' `PER_ITEM_ACTS`), passed by its caller: this module knows no act.
 *
 * ITEMS ARE NOT IN ONE TRANSACTION, deliberately: independence is the weight. */
export function perItem(act, body, stamped, one, { itemKeys = null, sharedKeys = null } = {}) {
  const refusal = (code, detail, extra) => {
    const row = PER_ITEM_CHECKS[code];
    return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail, ...(extra || {}) };
  };
  const { items, ...shared } = body && typeof body === "object" ? body : {};
  const count = Array.isArray(items) ? items.length : 0;
  /* DEC-49 REGION is-per-item-set-shape */
  if (!Array.isArray(items) || items.length === 0)
    return refusal("SET_NO_ITEMS",
      localize("record-core.index.op_act_was_sent_as", "op={act} was sent as a set and the set holds no items. Send `items` as a non-empty array, or send one item's fields without `items` for the single act. Nothing was done.", { act: String(act) }),
      { op: act, weight: "per-item", count: 0 });
  if (items.length > PER_ITEM_MAX)
    return refusal("SET_TOO_LARGE",
      localize("record-core.index.op_act_acts_on_at", "op={act} acts on at most {PER_ITEM_MAX} items at once and this set holds {length}. Refused WHOLE, before any item was tried, so no item moved.", { act: String(act), PER_ITEM_MAX: String(PER_ITEM_MAX), length: String(items.length) }),
      { op: act, weight: "per-item", count: items.length, max: PER_ITEM_MAX });
  /* END DEC-49 REGION is-per-item-set-shape */
  const echo = (it) => {
    const o = {};
    for (const [k, v] of Object.entries(it)) {
      if (typeof v === "string") o[k] = v.slice(0, 400);
      else if (typeof v === "number" || typeof v === "boolean" || v === null) o[k] = v;
    }
    return o;
  };
  /* An identity key is one some group names and `sharedKeys` does not, so a key an act declares shareable is
     never taken from an item that relies on it. NAMED is read as the acts read an identity: a trimmed,
     non-empty string, so `project: ""` names nothing. */
  const groups = Array.isArray(itemKeys) ? itemKeys.filter(Array.isArray) : [];
  const shareable = new Set(Array.isArray(sharedKeys) ? sharedKeys : []);
  const identity = new Set(groups.flat().filter((k) => !shareable.has(k)));
  const namesIt = (o, k) => typeof o[k] === "string" && o[k].trim() !== "";
  const sharedFor = (it) => {
    const named = [...identity].filter((k) => namesIt(it, k));
    if (named.length === 0) return shared;
    const reach = new Set();
    for (const g of groups) if (g.some((k) => named.includes(k))) for (const k of g) reach.add(k);
    const narrowed = { ...shared };
    for (const k of identity) if (!reach.has(k)) delete narrowed[k];
    return narrowed;
  };
  const outcomes = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    /* DEC-49 REGION is-per-item-malformed */
    if (!it || typeof it !== "object" || Array.isArray(it)) {
      outcomes.push({ ...refusal("SET_ITEM_MALFORMED", localize("record-core.index.item_i_is_not_an", "item {i} is not an object naming one {act} subject; it was left as it was and the other items were still tried.", { i: String(i), act: String(act) })), index: i, outcome: "retained", asked: null });
      continue;
    }
    /* END DEC-49 REGION is-per-item-malformed */
    let r;
    try {
      const b = { ...sharedFor(it), ...it, ...stamped };
      delete b.items;               /* an item cannot smuggle a nested set back into the act */
      r = one(b);
    } catch (e) {
      /* DEC-49 REGION is-per-item-failed */
      r = refusal("SET_ITEM_FAILED", localize("record-core.index.op_act_threw_on_item", "op={act} threw on item {i} rather than refusing it: {String}. Nothing about the item is claimed.", { act: String(act), i: String(i), String: String(String((e && e.message) || e).slice(0, 200)) }));
      /* END DEC-49 REGION is-per-item-failed */
    }
    const res = r && typeof r === "object" ? r : { ok: false };
    outcomes.push({ ...res, index: i, outcome: res.ok === true ? "applied" : "retained", asked: echo(it) });
  }
  const applied = outcomes.filter((o) => o.outcome === "applied").length;
  const retained = outcomes.length - applied;
  const head = { op: act, weight: "per-item", count, applied, retained, items: outcomes };
  if (retained === 0)
    return { ok: true, ...head, detail: localize("record-core.index.every_one_of_the_count", "every one of the {count} item(s) was applied, each by op={act}'s own rules.", { count: String(count), act: String(act) }) };
  /* DEC-49 REGION is-per-item-retained */
  return { ok: false, reason: "SET_ITEMS_RETAINED", code: "SET_ITEMS_RETAINED",
           check: PER_ITEM_CHECKS.SET_ITEMS_RETAINED.check,
           translation: PER_ITEM_CHECKS.SET_ITEMS_RETAINED.translation,
           detail: localize("record-core.index.applied_of_count_item_s", "{applied} of {count} item(s) applied and {retained} RETAINED; each retained item in items[] carries its own act's reason. The applied items stand — this is not a rollback.", { applied: String(applied), count: String(count), retained: String(retained) }),
           ...head };
  /* END DEC-49 REGION is-per-item-retained */
}

/** R83 (T46; N904): what the strict `getSetting` answers for a setting whose value last set cannot be read, told from
 *  `null` (never set). One frozen object, compared by identity; no stored value parses to it. */
export const SETTING_UNREADABLE = Object.freeze({ unreadable: true });

/* R84 (T47; N939): whether `value` reads back through JSON as it was set: at every depth `null`, a boolean, a string, a
   finite number, an array of such values or a plain object (its prototype `Object.prototype`) whose values are all such.
   JSON would silently change anything else, so it is not: a function, a symbol, a BigInt, `undefined`, `NaN` and the
   infinities (written as `null`), a `Date` or other non-plain object (a null-prototype one among them), a cycle, and the
   parts of an array or object JSON drops or flattens: a hole, a named property on an array, a symbol key, a property
   that is not enumerable or is a getter. A value whose inspection throws (a hostile Proxy), or nests too deep to walk,
   is not either. `-0` is a finite number and is taken (JSON writes it `0`). Never throws. */
function roundTripsJson(value) {
  const open = new Set();                 /* the objects on the path being walked: one met again is a cycle */
  const ok = (v) => {
    if (v === null || typeof v === "string" || typeof v === "boolean") return true;
    if (typeof v === "number") return Number.isFinite(v);
    if (typeof v !== "object" || open.has(v)) return false;
    const list = Array.isArray(v);
    if (Object.getPrototypeOf(v) !== (list ? Array.prototype : Object.prototype)) return false;
    const keys = Reflect.ownKeys(v);
    if (list && keys.length !== v.length + 1) return false;       /* its indices and `length`, nothing more or less */
    open.add(v);
    for (const k of keys) {
      if (typeof k !== "string") return false;
      if (list && k === "length") continue;
      if (list && !(String(Number(k)) === k && Number.isInteger(Number(k)) && Number(k) >= 0 && Number(k) < v.length)) return false;
      const d = Reflect.getOwnPropertyDescriptor(v, k);
      if (!d || !d.enumerable || !("value" in d) || !ok(d.value)) return false;
    }
    open.delete(v);
    return true;
  };
  try { return ok(value) === true; } catch { return false; }
}
/* The JSON text of a value `roundTripsJson` took, or null when writing it fails after all (a Proxy that answers one way
   and then another). Never throws. */
function jsonText(value) {
  try { const t = JSON.stringify(value); return typeof t === "string" ? t : null; } catch { return null; }
}

/** R91 (fix round 8, G115; K4811 (1)): THE BOOKKEEPING LIST, the tables a request writes whatever it asks, none of them part of
 *  the record: the sessions (`last_active`), the door window (the source and session windows), the owed-work ledger (its pending
 *  and last-run tables) the job table's per-unit attempt stamps and batch landings (K4912), and the doorbell's and the acquisition's tallies and stage timings. A row changed in one does not move
 *  `writeCount()`. The list is this module's; a module whose table belongs here is added by a requirement change. */
export const BOOKKEEPING_TABLES = Object.freeze(["sessions", "admission_door_window", "admission_session_window", "keeps_pending",
  "keeps_last", "knock_rate", "doorbell_tally", "doorbell_limit_last", "acquire_stages", "job_unit_attempts", "job_batches"]);
/* R91: the tally of the connection's start, per storage connection (a second instance over the same storage shares it): the
   bookkeeping rows tallied before this object began are not this object's to subtract. */
const BASELINES = new WeakMap();

const instances = new WeakMap();
/* The storage's SQL of an instance, for this module's own route arms (R73's sight gate) and nothing outside it. */
let sqlOf;

/** R39: the one RecordCore for this object's storage. `ctx` is the Durable Object state (anything with
 *  `storage.sql` and `storage.transactionSync`), or that storage itself. `opts` is read on the first call
 *  only: `evidence` — the instance's evidence bucket (R2) or null; `evidencePrefix` — what every evidence
 *  key begins with (`<store>/captures/`), or a function answering it when it is asked. */
export function recordOf(ctx, opts = {}) {
  const storage = ctx && ctx.storage ? ctx.storage : ctx;
  let rc = instances.get(storage);
  if (!rc) { rc = new RecordCore(storage, opts); instances.set(storage, rc); }
  return rc;
}

export class RecordCore {
  /** R3/R27, C-59.5 (Membership v2 §7, "A MINTED ID CARRIES NO COUNT"): THE PREFIXES WHOSE OBJECTS A READ
   *  WITHHOLDS FROM SOME CALLER. Their ids are minted opaque by the act that creates them and never from
   *  `allocId`'s counter, because a counted suffix tells its reader how many were minted before, hidden
   *  ones included: PROJ (a project out of sight), CASE (an unratified case), DRAFT (a draft), RVG (a
   *  review grant), TASK (a task naming a bundle the viewer cannot see). */
  static GATED_ID_PREFIXES = Object.freeze(["PROJ", "CASE", "DRAFT", "RVG", "TASK"]);

  /** D-432: the gated prefixes whose mint passes NO tail, so an id the counter issued for them before
   *  REC-151 (`seq`'s `<P>-<year>` scope, 0001 up to next-1) is exactly an id the opaque minter can draw;
   *  `seedMintLedger` records that range. PROJ and TASK carry a slug the counter never recorded. */
  static UNTAILED_GATED_PREFIXES = Object.freeze(["CASE", "DRAFT", "RVG"]);

  /** This module's own tables, declared to purge by it (R21), and those purge never clears (R23). */
  static OWN_TABLES = Object.freeze(["files", "history", "manifest", "leases", "bundles"]);
  static EXEMPT_TABLES = Object.freeze(["seq", "minted_ids", "settings", "tombstones", "derived_stale", "bookkeeping_tally"]);

  /** R21 (T33-19): the classes of this module's own tables, declared by it explicitly (R79's tombstones and R77's stale
   *  marks are exempt from purge: an expunge's record outlives every purge, and a mark that outlives its row still
   *  answers stale). */
  static #OWN_DECLARATIONS = (() => {
    const own = (name, cls) => Object.freeze({ name, purge: "clear", expunge: "none", derive: "stored", version_chain: false, ...cls });
    const kept = { purge: "exempt", sight: "group" };
    return Object.freeze([
      own("files", { export: "yes", sight: "bundle" }),
      own("history", { export: "yes", sight: "bundle", version_chain: true }),
      own("manifest", { export: "yes", sight: "bundle", version_chain: true }),
      own("leases", { export: "never", sight: "bundle" }),
      own("bundles", { export: "yes", sight: "bundle" }),
      own("seq", { ...kept, export: "admin-only" }),
      own("minted_ids", { ...kept, export: "never" }),               /* read by no route, never counted or listed */
      own("settings", { ...kept, export: "admin-only", version_chain: true }),
      own("tombstones", { ...kept, export: "yes", version_chain: true }),   /* R79: a removal reaches future exports */
      own("derived_stale", { ...kept, export: "never" }),
      own("bookkeeping_tally", { ...kept, export: "never" }),        /* R91: the bookkeeping rows' tally, read by no route */
    ]);
  })();

  static { sqlOf = (rc) => rc.#sql; }

  #watched = new Set();   // R91: the bookkeeping tables already given their triggers
  #base = 0;              // R91: the tally when this connection began
  #storage; #sql; #declared = new Map(); #order = []; #evidence; #evidencePrefix; #firstBoot;
  #gates = new Map();     // R78: table → {module, checks}, one registration per table
  #held = [];             // R66: one list per open `transact`, outermost first, of what `afterCommit` held
  #auditChecks = [];      // R59: {module, check}, in registration order
  #grammars = [];         // R67: {module, ids, arm}, in registration order
  #countsBy = [];         // R63: {module, keys, counts}, in registration order
  #statsSource = null;    // R65: {module, figures}, the one source of the instance's figures
  #auditFindings = [];    // R68: {module, key, finding}, in registration order
  #auditContexts = [];    // R69: {module, context}, in registration order
  #mintSeeds = [];        // R70: {module, sources}, in registration order

  constructor(storage, { evidence = null, evidencePrefix = "bio/captures/" } = {}) {
    this.#storage = storage;
    this.#sql = storage.sql;
    /* R91: the tally when this connection began, one for every instance over the same `sql`; a storage stand-in that holds no
       object for `sql` has its own. */
    const shared = this.#sql !== null && (typeof this.#sql === "object" || typeof this.#sql === "function");
    if (shared && BASELINES.has(this.#sql)) this.#base = BASELINES.get(this.#sql);
    else {
      try { this.#base = this.#tally(); } catch { this.#base = 0; }     /* no tally table yet: this store has never counted one */
      if (shared) BASELINES.set(this.#sql, this.#base);
    }
    /* R54, D-436: THE STORE'S FIRST BOOT, witnessed here, when the instance is made — before the store's schema
       pass or `migrate` creates or alters a table — since storage that has never held the record's schema has no
       `bundles` table. Asked through `PRAGMA table_info`, the form every boot already runs, never a catalogue read
       that could throw inside blockConcurrencyWhile (which bricks the Durable Object). */
    try { this.#firstBoot = [...this.#sql.exec(`PRAGMA table_info(bundles)`)].length === 0; }
    catch { this.#firstBoot = false; }
    this.#evidence = evidence && typeof evidence.get === "function" ? evidence : null;
    this.#evidencePrefix = evidencePrefix;
    this.#declare("record-core", RecordCore.#OWN_DECLARATIONS, false);
  }

  #rows(q, ...a) { return [...this.#sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }

  /** R54: true throughout the boot at which the store had never held the record's schema, decided once, when
   *  this instance was made; false at every later boot. `instance-setup` reads it. */
  isFirstBoot() { return this.#firstBoot === true; }

  /* The additive columns this module's tables gained after a store was first written: nullable, so an older row simply
     has none (a hand-authored promotion names no writer, a bundle committed before R34's column names no project). */
  static #ADDITIVE_COLUMNS = Object.freeze([
    ["manifest", "writer", "TEXT"], ["manifest", "operation", "TEXT"], ["bundles", "project", "TEXT"],
  ]);

  /** R71: this module's schema (`RECORD_SCHEMA`) and its own migrations, run by the composition root BEFORE any other
   *  module's `migrate`, so `bundles` exists before any module reads it. Every step is guarded on what the storage
   *  already holds, so a second run changes nothing.
   *  REC-143 — THE ADDITIVE COLUMNS ARE ADDED BEFORE THE SCHEMA RUNS, AND AGAIN AFTER IT. The schema text carries
   *  indexes, and an index over a column only this list adds would hit an OLD table that lacks it and throw inside
   *  blockConcurrencyWhile (every release 0.59.0–0.63.0 bricked an existing store so). So the whole list runs first for
   *  every table that exists, and again after the schema, for a table the schema created on this boot (a guarded
   *  `ALTER` on a table created whole adds nothing).
   *  `classification` was REMOVED from the Information catalogue on 2026-07-27 (Bob's decision, state doc v30): dropped
   *  rather than orphaned, so a store migrated forward and a fresh install present the same table; guarded, because
   *  `DROP COLUMN` on a column already gone is an error. History keeps any frontmatter that carried it, which is correct.
   *  The type renames (problem → focus 2026-07-27, focus → inquiry REC-10) are normalised in `bundles.object_type`, the
   *  DERIVED layer, from record-grammar's own `LEGACY_TYPE_ALIASES` rather than restated, so a further name is one entry
   *  there and no edit here; append-only history keeps whatever spelling it was written with. */
  migrate() {
    const addColumns = () => {
      for (const [table, column, decl] of RecordCore.#ADDITIVE_COLUMNS) {
        const have = this.#rows(`PRAGMA table_info(${table})`).map((r) => r.name);
        /* An absent table reads as no columns: it is skipped here and the schema creates it. */
        if (have.length && !have.includes(column)) this.#sql.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
      }
    };
    addColumns();
    const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    for (const statement of bare.split(";")) { const t = statement.trim(); if (t) this.#sql.exec(t); }
    addColumns();
    this.#sql.exec(`CREATE INDEX IF NOT EXISTS bundles_project ON bundles(project, bundle_id)`);
    if (this.#rows(`PRAGMA table_info(bundles)`).some((r) => r.name === "classification"))
      this.#sql.exec(`ALTER TABLE bundles DROP COLUMN classification`);
    for (const [legacy, canonical] of Object.entries(LEGACY_TYPE_ALIASES))
      this.#sql.exec(`UPDATE bundles SET object_type=? WHERE object_type=?`, canonical, legacy);
  }

  /* ---- the write counter (R89, R90) ---- */

  /** R89, R90, R91 (fix rounds 7 and 8, G80, G115; K4736, K4807, K4811): THE RECORD'S WRITE COUNTER, a whole number that rises
   *  by at least one for every row any statement on this object's storage inserts, updates or deletes in a table that is not
   *  bookkeeping, and by nothing else. It is SQLite's own `total_changes()` for the connection the object holds, so it sees
   *  every writer by every path: this module's services, and the plain SQL of the modules that own the tables `queue` derives
   *  its feed from (its mutes, a question, a deadline, a notice), declared or not, and no I/O beyond the storage.
   *  R91 BOOKKEEPING IS LEFT OUT, BY A MECHANISM THIS MODULE OWNS ALONE: every foreground request writes a session's
   *  `last_active`, the door window and, with a tick, the ledger, and a counter that counted them would move on every request
   *  and be no key for a cache. This module cannot see another module's statements (`credentials`, `admission` and the ledger
   *  hold the storage's `sql` themselves, and are not changed), so it asks SQLite to tally them: on each table of
   *  `BOOKKEEPING_TABLES` that exists it keeps three triggers (insert, update, delete), each stepping the one row of
   *  `bookkeeping_tally`. A bookkeeping row then costs `total_changes()` exactly two (its own row and the tally's) and the
   *  tally one, so the counter is `total_changes() - 2 * (tally - the tally when this connection began)`. (A TEMP tally would
   *  need no baseline, and workerd refuses TEMP schema: `SQLITE_AUTH`, measured.) The tables are looked for at each reading
   *  until every one on the list has been found (a module makes its table after this one migrates), and a table made after
   *  the first reading is watched from the next. A bookkeeping row written before its table was first watched is counted as a
   *  record row, once; one whose transaction rolls back is counted twice (the tally rolls back with it, the changes are still
   *  counted), which R89 allows: a change that rolls back may still be counted, and the counter never falls. If the platform
   *  refuses the triggers the counter falls back to `total_changes()` whole: the cache it keys then recomputes more often and
   *  is never wrong. A read changes nothing, so two answers with no write between are equal; the first reading may make the
   *  triggers, which move no row. It counts from the object's start and is 0 for a record nothing has written since. DDL moves
   *  no row and is not counted. */
  writeCount() {
    this.#watchBookkeeping();
    const total = Number(this.#one(`SELECT total_changes() AS n`).n);
    try { return Math.max(0, total - 2 * Math.max(0, this.#tally() - this.#base)); }
    catch { return total; }
  }

  /* R91: the bookkeeping tally now. */
  #tally() { return Number(this.#one(`SELECT COALESCE(SUM(n), 0) AS n FROM bookkeeping_tally`).n); }

  /* R91: a trigger set on each bookkeeping table now present and not yet watched. Never throws: a platform that refuses leaves
     the counter whole. A table seen inside a transaction is not marked watched, since the transaction may roll its triggers
     back. `CREATE TRIGGER IF NOT EXISTS` changes nothing when the trigger is already there (a restarted object). */
  #watchBookkeeping() {
    const missing = BOOKKEEPING_TABLES.filter((t) => !this.#watched.has(t));
    if (!missing.length) return;
    try {
      const here = new Set(this.#rows(`SELECT name FROM sqlite_master WHERE type='table' AND name IN (${missing.map(() => "?").join(",")})`, ...missing)
        .map((r) => r.name));
      for (const t of missing) {
        if (!here.has(t)) continue;
        for (const ev of ["INSERT", "UPDATE", "DELETE"])
          this.#sql.exec(`CREATE TRIGGER IF NOT EXISTS bookkeeping_${t}_${ev.toLowerCase()} AFTER ${ev} ON ${t} BEGIN UPDATE bookkeeping_tally SET n = n + 1; END`);
        if (!this.#held.length) this.#watched.add(t);
      }
    } catch { /* the counter then counts every table, as R89 states */ }
  }

  /* ---- transactions (R32, R66) ---- */

  /** Runs `fn` as one transaction over the whole store. A throw, or a returned refusal (`ok:false`),
   *  rolls back every row written inside it, in any module's tables; a refusal is then returned, a
   *  throw rethrown. A call made inside another joins it as a savepoint (a Durable Object's
   *  `transactionSync` nests so, measured in Miniflare): a nested call that throws or refuses rolls back
   *  its own writes and ids and nothing else, and the outer call decides the rest (R32, K133). */
  transact(fn) {
    let result, out, committed = false;
    const held = [];                  /* R66: what `afterCommit` held inside this call */
    this.#held.push(held);
    try {
      out = this.#storage.transactionSync(() => {
        result = fn();
        if (result && typeof result === "object" && result.ok === false) throw REFUSED;
        return result;
      });
      committed = true;
    } catch (e) {
      if (e !== REFUSED) throw e;     /* a throw drops what this call held, with its rows */
      out = result;                   /* so does a refusal */
    } finally {
      this.#held.pop();
    }
    /* R66: a savepoint that committed hands what it held to the transaction around it, which may still roll it
       back; the outermost commit runs it, now, before this call returns. */
    if (committed) {
      if (this.#held.length) this.#held[this.#held.length - 1].push(...held);
      else RecordCore.#runHeld(held);
    }
    return out;
  }

  /** R66 (N406, K598): `fn` runs after the record has committed what it was asked in: at once outside any `transact`;
   *  inside one, synchronously just after the outermost `transact` commits and before that call returns, in the order
   *  the calls were made; never when the transaction, or the savepoint holding it, rolls back (a throw or an `ok:false`
   *  answer). A held `fn` that throws does not undo the commit, stop the others or change what `transact` answers: a
   *  caller that must know (reevaluation's `listeners_failed`) catches its own. A non-function is a caller's defect. */
  afterCommit(fn) {
    if (typeof fn !== "function") throw new TypeError("afterCommit: fn is not a function");
    if (this.#held.length) this.#held[this.#held.length - 1].push(fn);
    else RecordCore.#runHeld([fn]);
  }

  static #runHeld(fns) {
    for (const fn of fns) { try { fn(); } catch { /* R66: the commit stands, and so do the others */ } }
  }

  /* ---- ids (R1–R9) ---- */

  /** R1, R2, R76 (T33-19; S0-2, B0.12): an id of `prefix` in its `ID_TABLE` form (record-grammar's R46). A sequential
   *  prefix, or one the table does not hold, is `<prefix>-<year>-N`, the scope's next number, zero-padded to four digits
   *  and never cut: there is no ceiling, so the 10,000th is `…-10000`. An opaque prefix is R76's id. The same step
   *  inside a caller's transaction as on its own, because it joins the caller's. */
  allocId(prefix, year) {
    return this.transact(() => (OPAQUE_PREFIXES.has(prefix) ? this.#opaqueId(prefix, year) : this.#nextSeq(prefix, year)));
  }

  /** R76: `<prefix>-<year>-<tail>`, the tail 16 characters of `[a-z0-9]`, each drawn uniformly from the CSPRNG by
   *  rejection sampling (a byte of 252 or more is drawn again, 252 being the largest multiple of 36 under 256). Asked of
   *  the opaque-id ledger and recorded there before it is returned, in the transaction `allocId` joins, so a rolled-back
   *  act takes its id back (R7) and no purge forgets it (R8): a hit draws again, so a collision is a retry and never a
   *  duplicate. After 64 hits in a row, R62's one answer for the prefix. The counter is not read or stepped. */
  #opaqueId(prefix, year) {
    const byte = new Uint8Array(1);
    const char = () => { for (;;) { crypto.getRandomValues(byte); if (byte[0] < 252) return TAIL_ALPHABET[byte[0] % 36]; } };
    for (let i = 0; i < 64; i++) {
      let tail = "";
      while (tail.length < TAIL_LENGTH) tail += char();
      const id = `${prefix}-${year}-${tail}`;
      if (this.#one(`SELECT 1 AS x FROM minted_ids WHERE id=?`, id)) continue;
      this.#sql.exec(`INSERT INTO minted_ids (id,recorded_at,source) VALUES (?,?,'opaque')`, id, new Date().toISOString());
      return { id };
    }
    return mintExhausted(prefix);
  }

  #nextSeq(prefix, year) {
    const scope = `${prefix}-${year}`;
    const cur = this.#one(`SELECT next FROM seq WHERE scope=?`, scope);
    const n = cur ? cur.next : 1;
    this.#sql.exec(`INSERT INTO seq (scope,next) VALUES (?,?) ON CONFLICT(scope) DO UPDATE SET next=?`, scope, n + 1, n + 1);
    return { id: `${prefix}-${year}-${String(n).padStart(4, "0")}` };
  }

  /** R3–R5, REC-151 / C-59.5: the door a CALLER allocates through. Gating is decided on the counter's
   *  SCOPE (`<prefix>-<year>`), so moving the dash into the prefix cannot reach a gated counter, and a
   *  prefix that merely begins with a gated one's letters (`PROJECTX`) keys a different scope. The
   *  refusal echoes only what the caller sent. */
  allocIdOp(prefix, year) {
    /* R86 (T51; B2, K4259): an id is for a named prefix and year; a call that names neither allocates nothing. Absent
       is no value at all (a query parameter not sent), so an empty or numeric value still reaches the gate (R4). */
    /* DEC-49 REGION is-allocid-input-present */
    if (prefix === undefined || prefix === null) {
      const row = RECORD_CORE_CHECKS.ALLOCID_PREFIX_REQUIRED;
      return { ok: false, reason: "ALLOCID_PREFIX_REQUIRED", code: "ALLOCID_PREFIX_REQUIRED", check: row.check,
               translation: row.translation,
               detail: localize("record-core.index.allocid_needs_a_prefix", "op=allocid needs a prefix, the kind of object the id is for. Nothing was allocated.") };
    }
    if (year === undefined || year === null) {
      const row = RECORD_CORE_CHECKS.ALLOCID_YEAR_REQUIRED;
      return { ok: false, reason: "ALLOCID_YEAR_REQUIRED", code: "ALLOCID_YEAR_REQUIRED", check: row.check,
               translation: row.translation,
               detail: localize("record-core.index.allocid_needs_a_year", "op=allocid needs a year, the year the id is for. Nothing was allocated.") };
    }
    /* END DEC-49 REGION is-allocid-input-present */
    const scope = `${prefix}-${year}`;
    const gated = RecordCore.GATED_ID_PREFIXES.find((g) => scope.startsWith(`${g}-`));
    /* DEC-49 REGION is-allocid-prefix-gated */
    if (gated) {
      const row = RECORD_CORE_CHECKS.ALLOCID_PREFIX_GATED;
      return { ok: false, reason: "ALLOCID_PREFIX_GATED", code: "ALLOCID_PREFIX_GATED", check: row.check,
               translation: row.translation,
               detail: localize("record-core.index.gated_ids_are_minted_by", "{gated}- ids are minted by the plane, opaque, by the act that creates the object; op=allocid allocates only a prefix whose objects every caller may see. Nothing was allocated.", { gated: String(gated) }) };
    }
    /* END DEC-49 REGION is-allocid-prefix-gated */
    return this.allocId(prefix, year);
  }

  /** R6–R9, REC-151 / D-432: THE ONE OPAQUE MINTER. `<prefix>-<year>-<rand><tail>`, `<rand>` four digits
   *  from the CSPRNG, rejection-sampled so 0000–9999 are equally likely; the counter is not read or
   *  stepped. Each draw is asked of the caller's `taken(id)` and of the minter's own ledger
   *  (`minted_ids`), so an id that has existed is never drawn again, purge or not. The id is recorded
   *  BEFORE it is returned, in whatever transaction the caller holds and never one of its own, so an act
   *  that rolls back takes its id back with it. The INSERT is plain, into the ledger's primary key: were
   *  the read above it ever lost, the act fails loudly rather than handing a spent id out. Null only
   *  when 64 draws in a row collide. The ledger is read by no route and never counted or listed. */
  mintOpaqueId(prefix, year, tail = "", taken = () => false) {
    const draw = () => {
      const u = new Uint16Array(1);
      for (;;) { crypto.getRandomValues(u); if (u[0] < 60000) return String(u[0] % 10000).padStart(4, "0"); }
    };
    const spent = (id) => !!this.#one(`SELECT 1 AS x FROM minted_ids WHERE id=?`, id) || !!taken(id);
    for (let i = 0; i < 64; i++) {
      const id = `${prefix}-${year}-${draw()}${tail ?? ""}`;
      if (spent(id)) continue;
      this.#sql.exec(`INSERT INTO minted_ids (id,recorded_at,source) VALUES (?,?,'mint')`, id, new Date().toISOString());
      return id;
    }
    return null;
  }

  /** R75 (N503, K1151): A CHOSEN OPAQUE ID, RECORDED AS A DRAWN ONE IS. A caller whose id is not drawn here (a notice id
   *  another instance chose, network-notices R4) records it in the same ledger, in the caller's own transaction and
   *  never one of its own, so the act that rolls back takes the id back with it (R7's rule) and, once it commits,
   *  `mintOpaqueId` never draws it and no purge forgets it (R6, R8). Refused, recording nothing: an id that is not a
   *  non-empty string (`OPAQUE_ID_MALFORMED`); one the ledger already holds, drawn, recorded or seeded (`OPAQUE_ID_SPENT`,
   *  naming it); a call outside any `transact` (`OPAQUE_ID_NO_TRANSACTION`), where nothing could take the record back.
   *  FAIL CLOSED: an INSERT the ledger refuses, by its primary key or because it cannot be written, is answered as spent,
   *  so a caller never uses an id the ledger has not taken. Never throws. */
  recordOpaqueId(id) {
    /* DEC-49 REGION is-opaque-id-refused */
    if (typeof id !== "string" || id === "")
      return rowRefusal("OPAQUE_ID_MALFORMED", localize("record-core.index.an_opaque_id_to_record", "an opaque id to record is a non-empty string; nothing was recorded."));
    if (!this.#held.length)
      return rowRefusal("OPAQUE_ID_NO_TRANSACTION", localize("record-core.index.id_was_not_recorded_an", "{id} was not recorded: an opaque id is recorded inside the transaction of the act that uses it, so a rollback takes it back, and no transaction is open. Nothing was recorded.", { id: String(id) }), { id });
    const spent = () => rowRefusal("OPAQUE_ID_SPENT", localize("record-core.index.id_is_already_in_the", "{id} is already in the opaque-id ledger, or the ledger could not confirm it free; an id is recorded once and never handed out again. Nothing was recorded.", { id: String(id) }), { id });
    /* One plain INSERT into the ledger's primary key decides it: a spent id is refused by the key itself, so no read
       can be lost between asking and recording. */
    try { this.#sql.exec(`INSERT INTO minted_ids (id,recorded_at,source) VALUES (?,?,'chosen')`, id, new Date().toISOString()); }
    catch { return spent(); }
    /* END DEC-49 REGION is-opaque-id-refused */
    return { ok: true, id };
  }

  /** D-432: WHERE THE LEDGER LEARNS THE IDS NO MINT RECORDED, at every boot, idempotently.
   *  LIVE: every live row of a gated kind, from the `[prefix, table, column]` sources the caller names
   *  (the tables each mint site's `taken` reads; their owners declare them). COUNTER: for a prefix
   *  whose mint passes no tail, every id `seq` says the counter issued before REC-151, used or not,
   *  of any counter width (T33, R40: no ceiling). Live ids are learned whole, so an id of either `ID_TABLE` form,
   *  a counter of any width or an opaque 16-character tail, is learned as it is held. Rows already recorded are left as they are. One statement per source and one
   *  for the counter, each doing its work inside SQLite. A live id is matched by its literal `<prefix>-`
   *  head, never a GLOB built from the prefix: workerd refuses a pattern over 50 bytes (K313), and a
   *  prefix is the caller's, of any length and any characters. */
  seedMintLedger(sources = []) {
    const at = new Date().toISOString();
    /* R40, R70: the caller's sources, then every registered module's, each named by its table's owner. */
    for (const [prefix, table, column] of [...sources, ...this.#mintSeeds.flatMap((r) => r.sources)]) {
      if (!IDENT.test(String(table)) || !IDENT.test(String(column))) continue;
      const head = `${prefix}-`;
      this.#sql.exec(`INSERT OR IGNORE INTO minted_ids (id,recorded_at,source)
                      SELECT DISTINCT ${column}, ?, 'live' FROM ${table}
                       WHERE typeof(${column}) = 'text' AND substr(${column}, 1, length(?)) = ?`, at, head, head);
    }
    const scopes = RecordCore.UNTAILED_GATED_PREFIXES.map((p) => `${p}-[0-9][0-9][0-9][0-9]`);
    const inScope = (col) => scopes.map(() => `${col} GLOB ?`).join(" OR ");
    this.#sql.exec(`INSERT OR IGNORE INTO minted_ids (id,recorded_at,source)
                    WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n
                      WHERE i < (SELECT COALESCE(MAX(next), 1) - 1 FROM seq WHERE ${inScope("scope")}))
                    SELECT s.scope || '-' || printf('%04d', n.i), ?, 'counter'
                      FROM seq s JOIN n ON n.i < s.next WHERE ${inScope("s.scope")}`,
                   ...scopes, at, ...scopes);
  }

  /** R70 (`build/extraction/legacy-store.md` §4.2 (3)): a later module whose table holds opaque ids registers once, at
   *  start, its seed sources, `[[prefix, table, column], …]` over its own tables only, and `seedMintLedger` (R40) learns
   *  their live ids as it learns its caller's, so the ledger knows every id an opaque mint site's `taken` reads without
   *  this module naming a later module's table. A second registration by the same module is `MINT_SEED_DECLARED`; no
   *  module name, or a source that is not three non-empty strings, `MINT_SEED_MALFORMED`. A refused registration
   *  registers nothing; an accepted one writes nothing until the next seed. */
  registerMintSeed(module, sources) {
    const named = typeof module === "string" && module.trim() !== "";
    const wellFormed = (x) => Array.isArray(x) && x.length === 3 && x.every((v) => typeof v === "string" && v.trim() !== "");
    /* DEC-49 REGION is-mint-seed-registration */
    if (!named || !Array.isArray(sources) || !sources.every(wellFormed))
      return rowRefusal("MINT_SEED_MALFORMED", localize("record-core.index.a_mint_seed_names_its", "a mint seed names its module and a list of [prefix, table, column] sources, each three non-empty strings; nothing was registered."), { module: named ? module : null });
    if (this.#mintSeeds.some((r) => r.module === module))
      return rowRefusal("MINT_SEED_DECLARED", localize("record-core.index.module_has_already_registered_its", "{module} has already registered its mint seed; the first still stands.", { module: String(module) }),
                        { module, heldBy: module });
    /* END DEC-49 REGION is-mint-seed-registration */
    const held = Object.freeze(sources.map((x) => Object.freeze([...x])));
    this.#mintSeeds.push({ module, sources: held });
    return { ok: true, module, sources: held.map((x) => [...x]) };
  }

  /* ---- leases (R10–R12, R61) ---- */

  /** R10, R30, R61, R81: the one refusal of an unnamed actor, for taking a lease and for ending one, under its row
   *  (C-102.28, DEC-49); its detail is the sentence it has always carried. */
  static #anonymousLease(actor) {
    if (typeof actor === "string" && actor.trim()) return null;
    /* DEC-49 REGION is-anonymous-lease */
    return rowRefusal("ANONYMOUS_LEASE", localize("record-core.index.a_lease_is_taken_under", "a lease is taken under a named actor — a member (from a session) or a machine identity (token:<class>). An unnamed writer cannot hold the courtesy lock."));
    /* END DEC-49 REGION is-anonymous-lease */
  }

  /** D-61: a lease is NEVER anonymous. It is a courtesy lock; promotion's CAS on `base` is the
   *  integrity mechanism, so the lease hands back the bundle's CURRENT digest as the edit base. */
  acquireLease(bundleId, actor, ttlMs) {
    const anonymous = RecordCore.#anonymousLease(actor);
    if (anonymous) return anonymous;
    return this.transact(() => {
      const now = Date.now();
      const cur = this.#one(`SELECT actor, expires FROM leases WHERE bundle_id=?`, bundleId);
      if (cur && cur.actor !== actor && Date.parse(cur.expires) > now)
        return { ok: false, heldBy: cur.actor, until: cur.expires };
      const b = this.#one(`SELECT bundle_sha FROM bundles WHERE bundle_id=?`, bundleId);
      const ttl = Number(ttlMs) || 0;
      const expires = new Date(now + ttl).toISOString();
      this.#sql.exec(
        `INSERT INTO leases (bundle_id,actor,acquired,expires,base_sha) VALUES (?,?,?,?,?)
         ON CONFLICT(bundle_id) DO UPDATE SET actor=excluded.actor, acquired=excluded.acquired, expires=excluded.expires, base_sha=excluded.base_sha`,
        bundleId, actor, new Date(now).toISOString(), expires, b ? b.bundle_sha : "");
      return { ok: true, actor, expires, base: b ? b.bundle_sha : null };
    });
  }

  /** R61 (N219): ends `actor`'s own lease on the bundle, live or expired, so no one is refused it (R11) until a
   *  lease is taken again. A lease another actor holds, or none, is left as it is: releasing is never a way to
   *  take a lock from its holder. Never throws; a read or write that fails released nothing (its transaction
   *  rolled back) and says so. */
  releaseLease(bundleId, actor) {
    const anonymous = RecordCore.#anonymousLease(actor);
    if (anonymous) return anonymous;
    try {
      return this.transact(() => {
        const cur = this.#one(`SELECT actor FROM leases WHERE bundle_id=?`, bundleId);
        if (!cur || cur.actor !== actor) return { ok: true, released: false };
        this.#sql.exec(`DELETE FROM leases WHERE bundle_id=? AND actor=?`, bundleId, actor);
        return { ok: true, released: true };
      });
    } catch {
      return { ok: true, released: false };
    }
  }

  /* ---- reads (R13–R17, R34–R36) ---- */

  /** R13, R14: a live file, inline text or its blob reference (never the bytes). */
  readFile(bundleId, path) {
    const r = this.#one(`SELECT content, blob_sha, bytes, sha256 FROM files WHERE bundle_id=? AND path=?`, bundleId, path);
    if (!r) return null;
    return r.content !== null ? { text: r.content, sha256: r.sha256 } : { blobSha: r.blob_sha, bytes: r.bytes, sha256: r.sha256 };
  }

  /** R60, D-442: THE PINNED BYTES OF A BUNDLE'S `bundle.md` — the text whose SHA-256 is `sha`, from the live file or
   *  any historical snapshot of it, read from this module's own tables alone. A row is a candidate by its stored
   *  digest (compared lower-cased) and is answered only when its text hashes to `sha` by R58's one digest, so a row
   *  whose stored digest disagrees with its content (R56) never passes its text off as the pinned bytes. A blob-backed
   *  row holds no text and is passed over, never ending the search. Null when either argument is absent, nothing
   *  matches, or the read fails; never throws. `publication` R2 and `ratification` R3 read it. */
  textAtSha(bundleId, sha) {
    if (typeof bundleId !== "string" || !bundleId || typeof sha !== "string" || !sha) return null;
    const want = sha.toLowerCase();
    try {
      for (const table of ["files", "history"])
        for (const r of this.#sql.exec(`SELECT content FROM ${table} WHERE bundle_id=? AND path='bundle.md'
                                          AND content IS NOT NULL AND lower(sha256)=?`, bundleId, want))
          if (typeof r.content === "string" && fileDigestOf({ text: r.content }) === want) return r.content;
    } catch { /* R60 never throws */ }
    return null;
  }

  /** R15's fixed derivation: the key goes in the FILENAME, not a directory — `bundle.md` archived under
   *  K is `_history/bundle_K.md`, `data/changes.json` is `_history/data/changes_K.json` — because the
   *  check catalogue parses exactly this shape (C-12.2). */
  static snapPath(path, snapKey) {
    const cut = path.lastIndexOf("/");
    const dir = cut === -1 ? "" : path.slice(0, cut + 1);
    const name = cut === -1 ? path : path.slice(cut + 1);
    const dot = name.lastIndexOf(".");
    return dot === -1
      ? `_history/${dir}${name}_${snapKey}`
      : `_history/${dir}${name.slice(0, dot)}_${snapKey}${name.slice(dot)}`;
  }

  /** R15–R17: the byte-complete image the gate consumes, from this module's tables alone: every live
   *  file (a blob as its reference, carrying its size, so a partial writer can hand it back unchanged);
   *  every snapshot at its canonical path; a verbatim promotion record per manifest entry (C-20.1 reads
   *  the writer and operation from it, classifyDivergence rebuilds the hash chain from its per-file
   *  digests); and the manifest itself. R16 (D-674, D-700, State Rules I-20): "prior" is WRITE order,
   *  never the caller-chosen snap key, whose lexical order is not a clock, so every entry carries `seq`,
   *  its rank in the order this module recorded it, read from the table's own row order. The document
   *  keeps its entries sorted by key, the form the catalogue checks (C-12.1); a reader walks `seq`. */
  readImage(bundleId) {
    const img = {};
    for (const r of this.#sql.exec(`SELECT path, content, blob_sha, sha256, bytes FROM files WHERE bundle_id=?`, bundleId))
      img[r.path] = r.content !== null ? r.content
        : { blobSha: r.blob_sha, sha256: r.sha256, bytes: r.bytes };
    const snapFiles = new Map();
    for (const r of this.#sql.exec(`SELECT snap_key, path, content, blob_sha, sha256 FROM history WHERE bundle_id=?`, bundleId)) {
      img[RecordCore.snapPath(r.path, r.snap_key)] =
        r.content !== null ? r.content : { blobSha: r.blob_sha, sha256: r.sha256 };
      if (!snapFiles.has(r.snap_key)) snapFiles.set(r.snap_key, []);
      snapFiles.get(r.snap_key).push({ name: r.path, sha256: r.sha256 });
    }
    const entries = [];
    let seq = 0;
    for (const r of this.#sql.exec(
      `SELECT snap_key, kind, base, author, created, files_json, writer, operation FROM manifest
        WHERE bundle_id=? ORDER BY rowid`, bundleId)) {
      let written;
      try { written = JSON.parse(r.files_json); } catch { written = []; }
      if (!Array.isArray(written)) written = [];
      const writtenPairs = written.map((f) => typeof f === "string" ? { name: f, sha256: null } : f);
      const files = writtenPairs.map((f) => f.name);
      const snapshotted = (snapFiles.get(r.snap_key) || []).map((f) => f.name);
      entries.push({ key: r.snap_key, seq: ++seq, kind: r.kind, base: r.base, author: r.author,
                     created: r.created, files, snapshotted,
                     ...(r.writer ? { writer: r.writer, operation: r.operation } : {}) });
      img[`_history/promotion_${r.snap_key}.json`] = JSON.stringify({
        target: bundleId, base: r.base, files: writtenPairs,
        created: r.created, author: r.author, skill_version: "bio-plane",
        ...(r.writer ? { writer: r.writer, operation: r.operation } : {}),
      }, null, 2);
    }
    if (entries.length) {
      entries.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
      img["_history/manifest.json"] = JSON.stringify({ entries }, null, 2);
    }
    return Object.keys(img).length ? img : null;
  }

  /** R34 */
  bundleInfo(bundleId) {
    const r = this.#one(`SELECT bundle_id, object_type, title, project FROM bundles WHERE bundle_id=?`, bundleId);
    return r ? { id: r.bundle_id, type: r.object_type, title: r.title ?? null, project: r.project ?? null } : null;
  }

  /** R41 */
  head(bundleId) {
    const r = this.#one(`SELECT bundle_sha, row_version, object_type, title, current_state, prior_state, group_id
                           FROM bundles WHERE bundle_id=?`, bundleId);
    return r ? { bundleSha: r.bundle_sha, rowVersion: r.row_version, type: r.object_type, title: r.title ?? null,
                 currentState: r.current_state, priorState: r.prior_state ?? null, groupId: r.group_id } : null;
  }

  /** R42; `seq` is the entry's write-order rank, as in `readImage` (R16). */
  manifestEntry(bundleId, snapKey) {
    const r = this.#one(`SELECT kind, base, author, created, files_json, writer, operation,
                                (SELECT COUNT(*) FROM manifest x WHERE x.bundle_id = m.bundle_id AND x.rowid <= m.rowid) AS seq
                           FROM manifest m WHERE bundle_id=? AND snap_key=?`, bundleId, snapKey);
    if (!r) return null;
    let files;
    try { files = JSON.parse(r.files_json); } catch { files = []; }
    return { kind: r.kind, base: r.base ?? null, author: r.author ?? null, created: r.created,
             files: Array.isArray(files) ? files : [], writer: r.writer ?? null, operation: r.operation ?? null,
             seq: Number(r.seq) };
  }

  /** R43 */
  livePaths(bundleId) {
    if (!this.#one(`SELECT 1 AS x FROM bundles WHERE bundle_id=?`, bundleId)) return null;
    return this.#rows(`SELECT path FROM files WHERE bundle_id=? ORDER BY path`, bundleId).map((r) => r.path);
  }

  static #bound(limit) { return Math.max(1, Math.min(1000, Math.trunc(Number(limit)) || 200)); }

  /** R35 */
  listBundles({ project = null, after = "", limit = 200 } = {}) {
    const cap = RecordCore.#bound(limit);
    const ids = (project == null
      ? this.#rows(`SELECT bundle_id FROM bundles WHERE bundle_id > ? ORDER BY bundle_id LIMIT ?`, String(after ?? ""), cap)
      : this.#rows(`SELECT bundle_id FROM bundles WHERE project = ? AND bundle_id > ? ORDER BY bundle_id LIMIT ?`,
                   String(project), String(after ?? ""), cap)).map((r) => r.bundle_id);
    return { ids, cursor: ids.length ? ids[ids.length - 1] : null };
  }

  /** R36 */
  listByType({ type, after = "", limit = 200 } = {}) {
    const cap = RecordCore.#bound(limit);
    const ids = this.#rows(`SELECT bundle_id FROM bundles WHERE object_type = ? AND bundle_id > ? ORDER BY bundle_id LIMIT ?`,
                           String(type ?? ""), String(after ?? ""), cap).map((r) => r.bundle_id);
    return { ids, cursor: ids.length ? ids[ids.length - 1] : null };
  }

  /** R53: each held bundle, in id order after `after`, with at least one manifest entry whose author begins with
   *  `authorPrefix`, as `{bundleId, latest, firstOther}`. Entries are ordered by `created` and then by write order
   *  (rowid): `created` is the caller's stated time, and two entries stamped alike are ordered by the record, never
   *  by the snap key's lexical order, which is not a clock. `firstOther` is the earliest entry whose author is
   *  non-empty and does not begin with the prefix. What a viewer may see of the list is its caller's to decide. */
  manifestByAuthor({ authorPrefix = "", after = "", limit = 200 } = {}) {
    try {
      const cap = RecordCore.#bound(limit);
      const pre = String(authorPrefix ?? "");
      const begins = `(author IS NOT NULL AND substr(author, 1, length(?)) = ?)`;
      const ids = this.#rows(
        `SELECT b.bundle_id FROM bundles b
          WHERE b.bundle_id > ? AND EXISTS (SELECT 1 FROM manifest m WHERE m.bundle_id = b.bundle_id AND ${begins.replaceAll("author", "m.author")})
          ORDER BY b.bundle_id LIMIT ?`, String(after ?? ""), pre, pre, cap).map((r) => r.bundle_id);
      const entry = (r) => r ? { snapKey: r.snap_key, kind: r.kind, base: r.base ?? null, author: r.author ?? null,
                                 created: r.created, writer: r.writer ?? null, operation: r.operation ?? null } : null;
      const cols = `snap_key, kind, base, author, created, writer, operation`;
      const bundles = ids.map((id) => ({
        bundleId: id,
        latest: entry(this.#one(`SELECT ${cols} FROM manifest WHERE bundle_id=? ORDER BY created DESC, rowid DESC LIMIT 1`, id)),
        firstOther: entry(this.#one(`SELECT ${cols} FROM manifest WHERE bundle_id=? AND author IS NOT NULL AND author <> ''
                                       AND NOT ${begins} ORDER BY created, rowid LIMIT 1`, id, pre, pre)),
      }));
      return { bundles, cursor: ids.length ? ids[ids.length - 1] : null };
    } catch {
      return { bundles: [], cursor: null };
    }
  }

  /* ---- the censuses (R56, R57): read-only audits of this module's own tables ---- */

  /** R56, REC-175: THE CENSUS OF THE PAST — every row already HELD whose stored digest disagrees with its own
   *  stored content, over the live image (`files`) and the append-only snapshots (`history`). READ-ONLY, and that
   *  is the point: a disagreeing row is REPORTED, never rewritten — the record's history is not corrected by a read,
   *  and which of the two (bytes or digest) is wrong is not decidable from here. A row is recomputed by the one
   *  `fileDigestOf` (R58); `bytes` is judged beside it for live inline rows only, by the one `inlineBytesOf`, as a
   *  SEPARATE figure (history holds no size). Bounded by `limit` rows listed per table; the counts are always whole. */
  digestCensus({ limit } = {}) {
    const cap = censusCap(limit);
    const walk = (table) => {
      const out = { rows: 0, inline: 0, blob: 0, digest_disagrees: 0, bytes_disagree: 0, listed: [] };
      try {
        for (const r of this.#sql.exec(table === "files"
            ? `SELECT bundle_id, NULL AS snap_key, path, content, blob_sha, bytes, sha256 FROM files`
            : `SELECT bundle_id, snap_key, path, content, blob_sha, NULL AS bytes, sha256 FROM history`)) {
          out.rows++;
          const inline = r.content !== null && r.content !== undefined;
          if (inline) out.inline++; else out.blob++;
          const computed = fileDigestOf(inline ? { text: r.content } : { blobSha: r.blob_sha });
          const dBad = computed !== null && String(r.sha256 ?? "").toLowerCase() !== computed;
          const bBad = inline && table === "files" && Number(r.bytes) !== inlineBytesOf({ text: r.content });
          if (dBad) out.digest_disagrees++;
          if (bBad) out.bytes_disagree++;
          if ((dBad || bBad) && out.listed.length < cap)
            out.listed.push({ bundle_id: r.bundle_id, ...(table === "history" ? { snap_key: r.snap_key } : {}), path: r.path,
                              stored: r.sha256, computed, ...(bBad ? { bytes_stored: r.bytes } : {}),
                              digest: dBad ? "disagrees" : "agrees" });
        }
      } catch { /* R56 never throws: a table it cannot read is counted as far as it was read */ }
      return out;
    };
    return { ok: true, files: walk("files"), history: walk("history"), rewritten: 0,
             note: word("record-core.note.read_disagreeing_row") };
  }

  /** R57, REC-176: THE CENSUS OF OVERWRITTEN MANIFEST ENTRIES — read-only; a bundle short of entries is REPORTED,
   *  never repaired: an entry an overwrite destroyed is not recoverable, and inventing it back would be the record
   *  claiming more than it holds. WHAT MAKES IT MEASURABLE: `commit` (R33) is the one writer of `manifest`, one entry
   *  per promotion, and steps `row_version` by one and nothing else does, so `row_version - COUNT(manifest)` is the
   *  number of promotions whose entry is gone. WHAT IT CANNOT DECIDE, stated per bundle rather than rounded: a bundle
   *  with NO creation entry (base = EMPTY_STRING_SHA) may have lost it to an overwrite OR predate the creation entry
   *  being written at all, so one promotion of such a bundle's deficit is `undetermined`, the rest `overwritten`.
   *  Which KEY collided is recorded nowhere and is not guessed; an entry whose base is none of the bundle's own
   *  entries' `bundle.md` digest (`unanchored`) is listed as the trace an overwrite leaves in the chain. Entries of
   *  a bundle id not held are counted apart. Bounded by `limit` bundles listed; the counts are always whole. */
  snapKeyCensus({ limit } = {}) {
    const cap = censusCap(limit);
    const out = { ok: true, bundles: 0, manifest_rows: 0, promotions: 0, overwritten: 0, undetermined: 0,
                  bundles_with_deficit: 0, excess: 0, orphan_manifest_bundles: 0, listed: [], rewritten: 0 };
    try {
      const rowsBy = new Map();
      for (const r of this.#sql.exec(`SELECT bundle_id, snap_key, base, files_json FROM manifest`)) {
        if (!rowsBy.has(r.bundle_id)) rowsBy.set(r.bundle_id, []);
        rowsBy.get(r.bundle_id).push(r);
      }
      const seen = new Set();
      for (const b of this.#sql.exec(`SELECT bundle_id, row_version FROM bundles`)) {
        out.bundles++;
        seen.add(b.bundle_id);
        const rows = rowsBy.get(b.bundle_id) || [];
        const promotions = Number(b.row_version) || 0;
        out.manifest_rows += rows.length;
        out.promotions += promotions;
        const deficit = promotions - rows.length;
        if (deficit < 0) out.excess += -deficit;
        const hasCreation = rows.some((r) => r.base === EMPTY_STRING_SHA);
        const outputs = new Set(rows.map((r) => {
          const md = manifestFiles(r.files_json).find((f) => f.name === "bundle.md");
          return md && typeof md.sha256 === "string" ? md.sha256.toLowerCase() : null;
        }).filter(Boolean));
        const unanchored = rows.filter((r) => r.base !== EMPTY_STRING_SHA
          && !outputs.has(String(r.base ?? "").toLowerCase())).map((r) => r.snap_key);
        if (deficit <= 0 && !unanchored.length) continue;
        const undetermined = deficit > 0 && !hasCreation ? 1 : 0;
        const overwritten = deficit > 0 ? deficit - undetermined : 0;
        out.overwritten += overwritten;
        out.undetermined += undetermined;
        if (deficit > 0) out.bundles_with_deficit++;
        if (out.listed.length < cap)
          out.listed.push({ bundle_id: b.bundle_id, promotions, manifest_rows: rows.length, overwritten, undetermined,
                            creation_row: hasCreation, unanchored });
      }
      for (const [id, rows] of rowsBy) if (!seen.has(id)) { out.orphan_manifest_bundles++; out.manifest_rows += rows.length; }
    } catch { /* R57 never throws */ }
    out.note = localize("record-core.index.read_only_a_record_whose", "read-only: a record whose manifest holds fewer rows than it has promotions lost a row to a repeated snap key before REC-176; nothing is rewritten. 'undetermined' is one promotion of a record with no creation row, which an overwrite and a store predating the creation row both produce. Which key collided is not recorded and is not guessed.");
    return out;
  }

  /* ---- the write path (R33) ---- */

  /** R33: the one write into this module's tables, called inside `transact` by `promotion`, which alone
   *  decides what may be committed. Every live file the commit replaces is copied into `history` under
   *  `snapKey`; the new live files are written; the bundle's row is set; exactly one `manifest` entry is
   *  appended, `created` being this module's own clock (D-674). Nothing already in `history` or
   *  `manifest` is modified or removed (R29): a snap key already used for the bundle fails the
   *  append loudly (their primary keys) rather than rewriting it. R44: the row records the state, prior
   *  state, group, times and criticality as the caller gives them, and the entry's time is `at`, the
   *  caller's stated time (this module's clock when it states none). R37 (N287): `group_id` is the producing
   *  group as the committer gave it, KEPT when a later commit gives none (absent or null: the column holds no
   *  null), the empty string for a bundle created naming none; `prior_state` is `priorState` as last given. */
  commit({ bundleId, type, title = null, project = null, snapKey, kind = "promotion", base = null, author = null,
           writer = null, operation = null, files = [], state, priorState, group, created, lastUpdated, criticality,
           at }) {
    return this.transact(() => {
      const now = at ?? new Date().toISOString();
      const cur = this.#one(`SELECT row_version FROM bundles WHERE bundle_id=?`, bundleId);
      if (cur)
        for (const r of this.#rows(`SELECT path, content, blob_sha, sha256 FROM files WHERE bundle_id=?`, bundleId))
          this.#sql.exec(
            `INSERT INTO history (bundle_id,snap_key,path,content,blob_sha,sha256,created) VALUES (?,?,?,?,?,?,?)`,
            bundleId, snapKey, r.path, r.content, r.blob_sha, r.sha256, now);
      this.#sql.exec(
        `INSERT INTO manifest (bundle_id,snap_key,kind,base,author,created,files_json,writer,operation) VALUES (?,?,?,?,?,?,?,?,?)`,
        bundleId, snapKey, kind, base, author, now,
        JSON.stringify(files.map((f) => ({ name: f.path, sha256: f.sha256 }))), writer, operation);
      this.#sql.exec(`DELETE FROM files WHERE bundle_id=?`, bundleId);
      for (const f of files)
        this.#sql.exec(
          `INSERT INTO files (bundle_id,path,content,blob_sha,bytes,sha256) VALUES (?,?,?,?,?,?)`,
          bundleId, f.path, f.text ?? null, f.blobSha ?? null,
          f.bytes ?? (typeof f.text === "string" ? te.encode(f.text).length : 0), f.sha256);
      const bundleSha = (files.find((f) => f.path === "bundle.md") || files[0] || {}).sha256 ?? "";
      const given = [["current_state", state], ["prior_state", priorState], ["group_id", group], ["created", created],
                     ["last_updated", lastUpdated], ["criticality", criticality]]
        .filter(([k, v]) => v !== undefined && !(k === "group_id" && v === null));
      if (cur)
        this.#sql.exec(
          `UPDATE bundles SET object_type=?, title=?, project=?, bundle_sha=?, row_version=row_version+1
            ${given.map(([k]) => `, ${k}=?`).join("")} WHERE bundle_id=?`,
          type, title, project, bundleSha, ...given.map(([, v]) => v ?? null), bundleId);
      else
        this.#sql.exec(
          `INSERT INTO bundles (bundle_id,object_type,group_id,title,current_state,prior_state,created,last_updated,
                                criticality,bundle_sha,row_version,project) VALUES (?,?,?,?,?,?,?,?,?,?,1,?)`,
          bundleId, type, group ?? "", title, state ?? "", priorState ?? null, created ?? now, lastUpdated ?? now,
          criticality ?? null, bundleSha, project);
      const after = this.#one(`SELECT bundle_sha, row_version FROM bundles WHERE bundle_id=?`, bundleId);
      return { bundleSha: after.bundle_sha, rowVersion: after.row_version };
    });
  }

  /* ---- the store's counts (R63) ---- */

  /** R63 (N342, K435; the R59 pattern, with its keys named up front as `declarePurge` names its tables): a module that
   *  owns tables registers once, at start, the figures it reports and `counts(hid)`, a synchronous function answering
   *  them, so `op=stats` and purge's proof read every module's figures without calling a later module. Two modules
   *  never report one key: a key already held, or named twice in one list, is `COUNTS_DECLARED` naming its holder, and
   *  so is a module's second registration; no module name, no non-empty list of names, or no function is
   *  `COUNTS_MALFORMED`. A refused registration registers nothing. It writes nothing. */
  registerCounts(module, keys, counts) {
    const refuse = (code, detail, more) => {
      const row = RECORD_CORE_CHECKS[code];
      return { ...more, ok: false, reason: code, code, check: row.check, translation: row.translation, detail };
    };
    /* DEC-49 REGION is-counts-registration */
    if (typeof module !== "string" || !module.trim() || !Array.isArray(keys) || keys.length === 0
        || !keys.every((k) => typeof k === "string" && k.trim() !== "") || typeof counts !== "function")
      return refuse("COUNTS_MALFORMED", localize("record-core.index.a_counts_registration_names_its", "a counts registration names its module, a non-empty list of figure names and a function answering them; nothing was registered."), { module: typeof module === "string" ? module : null });
    /* The one conflict, found before anything is registered: the module's own earlier registration, else the first
       key already held (by another module, or earlier in this same list). */
    let clash = this.#countsBy.some((r) => r.module === module) ? { heldBy: module } : null;
    for (let i = 0; !clash && i < keys.length; i++) {
      const held = keys.indexOf(keys[i]) < i ? module : this.#countsBy.find((r) => r.keys.includes(keys[i]))?.module;
      if (held) clash = { key: keys[i], heldBy: held };
    }
    if (clash)
      return refuse("COUNTS_DECLARED", clash.key === undefined
        ? localize("record-core.index.module_has_already_registered_its_2", "{module} has already registered its figures; nothing more was registered.", { module: String(module) })
        : localize("record-core.index.the_figure_key_is_already", "the figure {key} is already reported by {heldBy}; nothing was registered.", { key: String(clash.key), heldBy: String(clash.heldBy) }), { module, ...clash });
    /* END DEC-49 REGION is-counts-registration */
    this.#countsBy.push({ module, keys: [...keys], counts });
    return { ok: true, module, keys: [...keys] };
  }

  /** R63: every registered figure, in registration order, each the number its module's function gave for it, or null
   *  when that function threw or gave no finite number for it: a figure that could not be read is never zero. `hid`
   *  (`{sql, args}`, the bundles the caller may not see, or null) is passed to each function as it was given, never
   *  read here. Each function is asked once per answer. Writes nothing; never throws. */
  counts(hid = null) {
    const out = [];
    for (const { keys, counts } of this.#countsBy) {
      let got = null;
      try { got = counts(hid); } catch { got = null; }
      /* A promise is no figure: it is answered null, and its rejection, if any, is handled here, never left unhandled. */
      try { if (got !== null && typeof got === "object" && typeof got.then === "function") { got.then(null, () => {}); got = null; } }
      catch { got = null; }
      for (const key of keys) {
        let v = null;
        try { v = got !== null && typeof got === "object" ? got[key] : null; } catch { v = null; }
        out.push([key, typeof v === "number" && Number.isFinite(v) ? v : null]);
      }
    }
    return Object.fromEntries(out);
  }

  /** R74 (K861, plane R10): this module's share of the instance's figures, exported for `plane`, which registers it
   *  under this module's name through R63 (`registerCounts("record-core", RecordCore.COUNT_KEYS, (hid) => rc.ownCounts(hid))`);
   *  the module registers nothing itself. Each figure is the table's rows less those naming a bundle in `hid` by its
   *  `bundle_id`. `refs` is `connections`' table and not this module's figure (R31; K877). */
  static COUNT_KEYS = Object.freeze(["bundles", "files", "history"]);
  static #COUNTED = Object.freeze({ bundles: "bundles", files: "files", history: "history" });

  /** R74, D-464 (A COUNT IS TAKEN THROUGH THE CALLER'S OWN SIGHT): R63's `counts(hid)` for this module's share, moved
   *  here from the plane in T20 (K861) with its reading kept. `hid` is membership's `hiddenBundles` (`{sql, args}`), or null for
   *  a viewer that sees every bundle and for the direct internal call, which count whole. `COALESCE(k, '')`: a NULL key
   *  names no bundle, and `NULL NOT IN (…)` is NULL, which would drop the row. A figure whose table cannot be read is
   *  left out, and R63 answers it null. Synchronous; writes nothing; never throws. */
  ownCounts(hid = null) {
    const out = {};
    for (const key of RecordCore.COUNT_KEYS) {
      const table = RecordCore.#COUNTED[key];
      try {
        out[key] = hid ? this.#one(`SELECT count(*) AS c FROM ${table} WHERE COALESCE(bundle_id, '') NOT IN ${hid.sql}`, ...hid.args).c
                       : this.#one(`SELECT count(*) AS c FROM ${table}`).c;
      } catch { /* unread: R63 answers it null, never zero */ }
    }
    return out;
  }

  /* ---- the instance's figures and what each caller is told of them (R64, R65; K621) ---- */

  /* REC-131 / IC-148 (BOB #15's corrected ruling, `MEMBER-KNOWLEDGE-DESIGN.md` §5, *A COUNT IS A DISCLOSURE OF
     EXISTENCE*): a count over rows a caller could not all read goes only to a caller who could read them all, and for
     members' leads THAT CALLER DOES NOT EXIST, so `leads` is on the wire for no class. ONE KEY NEVER CARRIES TWO
     MEANINGS: the wire's log count excludes lead looks and is published as `observationsNonLead`, a name that states
     its predicate; purge's `observations` keeps the whole log, and the wire carries no `observations` key, so no reader
     compares the two under one name. The themes and their placements (D-162) are purge's proof only: a count of
     members' lenses is not an operator fact. */
  static #PROOF_ONLY = Object.freeze(["leads", "observations", "themes", "themePlacements"]);
  static #WIRE_ONLY = Object.freeze(["observationsNonLead"]);

  /** R65 (K621): the one source of the instance's figures, registered once at start, `figures({viewer, proof})`
   *  answering them through the caller's sight (`viewer` exactly as the caller sent it, `undefined` when never sent,
   *  a direct internal call that counts whole). The sight and the counting are the source's, over the tables it
   *  reads; which figures each caller is told is this module's (R64). A second source is `STATS_SOURCE_DECLARED`,
   *  naming the holder; one without a module name or a function `STATS_SOURCE_MALFORMED`. */
  registerStatsSource(module, figures) {
    /* DEC-49 REGION is-stats-source-registration */
    if (typeof module !== "string" || !module.trim() || typeof figures !== "function")
      return rowRefusal("STATS_SOURCE_MALFORMED", localize("record-core.index.a_statistics_source_names_its", "a statistics source names its module and is a function; nothing was registered."),
                       { module: typeof module === "string" ? module : null });
    if (this.#statsSource)
      return rowRefusal("STATS_SOURCE_DECLARED", localize("record-core.index.the_instances_figures_are_already", "the instance's figures are already supplied by {module}; nothing was registered.", { module: String(this.#statsSource.module) }), { module, heldBy: this.#statsSource.module });
    /* END DEC-49 REGION is-stats-source-registration */
    this.#statsSource = { module, figures };
    return { ok: true, module };
  }

  /* The source's figures, as a plain object of its own enumerable fields; none (`{}`) when no source is registered or
     it threw or answered no object. A field that cannot be read is left out. */
  #figures(viewer, proof) {
    const out = {};
    if (!this.#statsSource) return out;
    let got;
    try { got = this.#statsSource.figures({ viewer, proof }); } catch { return out; }
    if (!got || typeof got !== "object" || typeof got.then === "function") return out;
    let keys = [];
    try { keys = Object.keys(got); } catch { return out; }
    for (const k of keys) { try { Object.defineProperty(out, k, { value: got[k], enumerable: true, writable: true, configurable: true }); } catch { /* unread */ } }
    return out;
  }

  /* The database's size, a figure of this object's storage and no table's; null when the storage states none. */
  #dbBytes() {
    try { const n = this.#sql.databaseSize; return typeof n === "number" && Number.isFinite(n) ? n : null; } catch { return null; }
  }

  /** R64 (N408, K621): `op=stats`. The instance's figures through the caller's sight (R65's source), with the same
   *  keys for every class of caller: never `leads` nor `observations` (nor the themes, purge's only), whatever the
   *  source answers; the observation log as `observationsNonLead`. `capacity` IS THE ONE CLASS DISTINCTION, AND IT
   *  GOVERNS `dbBytes` AND NOTHING ELSE (BOB #15, resuming REC-131): the database's size moves in whole pages on every
   *  write, a lead's included, so a member diffing it across a colleague's authoring could detect a large lead;
   *  capacity is an operator need. It is the control plane's word, set from the authenticated class after the
   *  caller's parameters are copied, so only `true` itself grants it: an absent or any other value is false, and a
   *  door that forgets to stamp loses `dbBytes` rather than leaking it. THE RESIDUE, STATED RATHER THAN HIDDEN: the
   *  admin class still receives a figure that moves on every write, so an operator can tell that something large was
   *  written, never that it was a lead, and no lead is readable to it. Writes nothing; never throws. */
  stats({ capacity = false, viewer } = {}) {
    const f = this.#figures(viewer, false);
    for (const k of [...RecordCore.#PROOF_ONLY, "dbBytes"]) delete f[k];
    if (capacity === true) f.dbBytes = this.#dbBytes();
    return f;
  }

  /** R64: purge's proof of what it removed, the private form of the same figures, WHOLE (§5: *the purge proof's own
   *  count stays whole*): the whole log as `observations`, with `leads`, the themes and `dbBytes`, and no
   *  `observationsNonLead`. No route answers it: purge reads it before and after it clears. Writes nothing; never
   *  throws. */
  proofCounts() {
    const f = this.#figures(undefined, true);
    for (const k of [...RecordCore.#WIRE_ONLY, "dbBytes"]) delete f[k];
    f.dbBytes = this.#dbBytes();
    return f;
  }

  /* ---- the audit sweep (R18–R20, R45, R59, R67–R69) ---- */

  /* The three audit seams' registrations are one shape (R59, R68, R69): a module registers once per seam, by name, with a
     function; R68's carries the key its finding answers under. They share one door, `registerAuditCheck`, so each of
     C-102.1 and C-102.2 is refused at one site whichever seam is asked (DEC-49); the seam is chosen by these private
     tokens, which no caller outside this module holds. */
  static #CHECK_SEAM = Symbol("audit check");
  static #FINDING_SEAM = Symbol("audit finding");
  static #CONTEXT_SEAM = Symbol("audit context");
  /* R68: the answer's own fields, which no finding's key may take. */
  static #AUDIT_FIELDS = Object.freeze(["ok", "checked", "clean", "withErrors", "tally", "tallyDetail", "offenders", "limit",
                                        "cursor", "page", "total"]);

  /** R59 (N51, K130, the K31 pattern): a later module registers, once at start, an audit check that `auditPass`
   *  runs over every bundle of a page beside the catalogue, called `check(image, context)`: `image` is what
   *  `checkBundle` gets (`bundleId`/`folderName`, `files`, `elidedPaths`, `sha256`, `sha512`, R19's `resolveTarget`)
   *  and `raw`, the bundle's `readImage`; `context` is R45's for the bundle (`{}` when there is none), so a check that
   *  left the catalogue for its module is not lost to the audit, and the bundle is judged once, whole. */
  registerAuditCheck(module, check, seam = RecordCore.#CHECK_SEAM, key = undefined) {
    const finding = seam === RecordCore.#FINDING_SEAM, context = seam === RecordCore.#CONTEXT_SEAM;
    const list = finding ? this.#auditFindings : context ? this.#auditContexts : this.#auditChecks;
    const what = finding ? "audit finding" : context ? "audit context" : "audit check";
    const keyHeldBy = !finding ? null : RecordCore.#AUDIT_FIELDS.includes(key) ? "auditPass"
      : (this.#auditFindings.find((r) => r.key === key) || {}).module ?? null;
    /* DEC-49 REGION is-audit-check-registration */
    if (typeof module !== "string" || !module || typeof check !== "function" || (finding && (typeof key !== "string" || !key)))
      return rowRefusal("AUDIT_CHECK_MALFORMED", localize("record-core.index.an_what_names_its_module", "an {what} names its module{v1} and is a function; nothing was registered.", { what: String(what), v1: String(finding ? ", a non-empty key" : "") }));
    if (list.some((c) => c.module === module) || keyHeldBy)
      return rowRefusal("AUDIT_CHECK_DECLARED", keyHeldBy
        ? localize("record-core.index.the_audits_answer_key_key", "the audit's answer key {key} is already held by {keyHeldBy}; nothing was registered.", { key: String(key), keyHeldBy: String(keyHeldBy) })
        : localize("record-core.index.module_has_already_registered_its_3", "{module} has already registered its {what}; the first still runs.", { module: String(module), what: String(what) }),
        { module, ...(keyHeldBy ? { key, heldBy: keyHeldBy } : {}) });
    /* END DEC-49 REGION is-audit-check-registration */
    if (finding) list.push({ module, key, finding: check });
    else if (context) list.push({ module, context: check });
    else list.push({ module, check });
    return { ok: true, module, ...(finding ? { key } : {}) };
  }

  /** R68 (`build/extraction/legacy-store.md` §4.2 (1)): a later module registers once, at start, a page finding
   *  `finding(page)` under its answer key `key` (provenance's route-marker tally as `route`, membership's reserved-id
   *  finding as `membership`). `auditPass` calls each once per page, in registration order, and answers its result under
   *  its key, beside the page's own figures, which a finding never moves: a stated finding, not a conformance error. The
   *  refusals are R59's rows. */
  registerAuditFinding(module, key, finding) {
    return this.registerAuditCheck(module, finding, RecordCore.#FINDING_SEAM, key);
  }

  /** R69: a later module registers once, at start, `context(bundleId)`, answering options for that bundle's checks
   *  (inquiry's earned registry, publication's published registry); R45 merges every registration's answer, in
   *  registration order, before the caller's own. The refusals are R59's rows. */
  registerAuditContext(module, context) {
    return this.registerAuditCheck(module, context, RecordCore.#CONTEXT_SEAM);
  }

  /** R67 (§1b, K585 (2), K766): a type grammar leaves the check catalogue by registering here, once, at its module's
   *  start: `ids` are the check ids its `arm(ctx, findings)` raises. Ids covering one or more of record-grammar's
   *  `EXTENSION_ARMS` slots (its R28) claim each slot whole, and the grammar runs in each claimed slot's place; a slot
   *  may be claimed by several registrations, whose arms run there in registration order (`grammars()`). Refused,
   *  before anything is registered: a malformed entry, or ids claiming part of a slot (`GRAMMAR_MALFORMED`); a module's
   *  second registration, or an id another registration holds, unless it is an id of a slot both claim
   *  (`GRAMMAR_DECLARED`, naming the holder). An accepted registration answers `{ok: true, module, ids}`. */
  registerGrammar(module, { ids, arm } = {}) {
    const named = typeof module === "string" && module.trim() !== "";
    const listed = Array.isArray(ids) && ids.length > 0 && ids.every((id) => typeof id === "string" && C_ID.test(id));
    const partial = listed ? EXTENSION_ARMS.find((a) => a.ids.some((id) => ids.includes(id)) && !a.ids.every((id) => ids.includes(id))) : null;
    const slotIds = new Set(listed ? EXTENSION_ARMS.filter((a) => a.ids.every((id) => ids.includes(id))).flatMap((a) => a.ids) : []);
    let clash = null;
    if (named && listed) {
      if (this.#grammars.some((g) => g.module === module)) clash = { heldBy: module };
      for (let i = 0; !clash && i < ids.length; i++) {
        if (ids.indexOf(ids[i]) < i) { clash = { id: ids[i], heldBy: module }; break; }
        const g = this.#grammars.find((x) => x.ids.includes(ids[i]));
        if (g && !slotIds.has(ids[i])) clash = { id: ids[i], heldBy: g.module };
      }
    }
    /* DEC-49 REGION is-grammar-registration */
    if (!named || !listed || typeof arm !== "function" || partial)
      return rowRefusal("GRAMMAR_MALFORMED", partial
        ? localize("record-core.index.the_grammar_claims_part_of", "the grammar claims part of {name}, whose ids are {ids}; a slot is claimed whole. Nothing was registered.", { name: String(partial.name), ids: String(partial.ids.join(", ")) })
        : localize("record-core.index.a_grammar_names_its_module", "a grammar names its module, a non-empty list of the check ids it raises and a function to run; nothing was registered."),
        { module: named ? module : null });
    if (clash)
      return rowRefusal("GRAMMAR_DECLARED", clash.id === undefined
        ? localize("record-core.index.module_has_already_registered_its_4", "{module} has already registered its grammar; the first still stands.", { module: String(module) })
        : localize("record-core.index.the_check_id_is_already", "the check {id} is already claimed by {heldBy}; nothing was registered.", { id: String(clash.id), heldBy: String(clash.heldBy) }), { module, ...clash });
    /* END DEC-49 REGION is-grammar-registration */
    const slots = EXTENSION_ARMS.filter((a) => a.ids.every((id) => ids.includes(id))).map((a) => a.name);
    this.#grammars.push(Object.freeze({ module, ids: Object.freeze([...ids]), arm, slots: Object.freeze(slots) }));
    return { ok: true, module, ids: [...ids] };
  }

  /** R67 (K766): the registered grammars as record-grammar's `checkBundle` takes them (`opts.grammars`, its R39): what
   *  the audit (R18) and promotion's gate pass, so a bundle is judged by one grammar list at both. A registration that is
   *  the one claimant of the one slot it claims, or claims none, is answered as it was registered, `{module, ids, arm}`,
   *  in registration order. A slot several registrations claim, or a registration claiming several slots, is answered
   *  as one entry per slot, at its first claimant's place: `{module: <first claimant>, ids: <the slot's ids>, arm}`,
   *  whose arm runs every claimant's arm in registration order, each as `arm(ctx, findings, {slot, rest})`: `slot` is
   *  the slot's `EXTENSION_ARMS` name, and `rest()` runs the slot's later claimants at that point, once (a claimant's
   *  sub-slot); those not run when an arm returns run after it. A fresh list each call; the entries are frozen. */
  grammars() { return this.#bundleGrammars(null); }

  /* `grammars()`' list. With `wrap`, each claimant's arm is called through `wrap(registration, run)`: the audit wraps each
     claimant on its own (one that throws is one error of its own, R67); `null` calls each as it is. */
  #bundleGrammars(wrap) {
    const out = [], composed = new Map(), call = wrap || ((g, run) => run());
    const passThrough = (g) => g.slots.length === 0
      || (g.slots.length === 1 && !this.#grammars.some((x) => x !== g && x.slots.includes(g.slots[0])));
    for (const g of this.#grammars) {
      if (passThrough(g)) {
        out.push(wrap === null ? g : Object.freeze({ module: g.module, ids: g.ids,
          arm: (ctx, findings, ...more) => wrap(g, () => g.arm(ctx, findings, ...more)) }));
        continue;
      }
      for (const slot of g.slots) {
        if (composed.has(slot)) { composed.get(slot).push(g); continue; }
        const claimants = [g];
        composed.set(slot, claimants);
        const ids = EXTENSION_ARMS.find((a) => a.name === slot).ids;
        out.push(Object.freeze({ module: g.module, ids, arm: async (ctx, findings) => {
          let next = 0;
          const rest = async () => {
            while (next < claimants.length) {
              const c = claimants[next++];
              await call(c, () => c.arm(ctx, findings, { slot, rest }));
            }
          };
          await rest();
        } }));
      }
    }
    return out;
  }

  /** R18–R20, R45, R59, R67–R69: the check catalogue (record-grammar's `checkBundle`, with `grammars()`) over a bounded
   *  page of bundles in id order after `after`, run WHERE THE DATA IS (one network round trip per image was ~97% of an
   *  outside pass's cost). What a reference resolves against is the WHOLE corpus, asked of `bundles` by its key one
   *  reference at a time, and never leaves this method: filtering it would manufacture dangling-reference findings out
   *  of a viewer's position (REC-30). What is gated is what leaves: the page holds only bundles `visible(id)` admits.
   *  N117: every read here carries an SQL `LIMIT` — the cursor read takes the ids after `after` a page's worth at a time
   *  and stops once the page is full, and no read loads the corpus's ids whole. R45: a bundle's context is every R69
   *  registration's answer, merged in registration order, then the caller's own `context(id)`. Blob-backed files are
   *  declared elided: existence assertions see them, byte checks skip them. R68: every registered finding's answer is
   *  carried under its key, beside the page's figures, which it never moves. */
  async auditPass({ after = "", limit = 200, visible = null, context = null } = {}) {
    const cap = RecordCore.#bound(limit);
    const page = [];
    let scan = String(after ?? "");
    for (;;) {
      const batch = this.#rows(`SELECT bundle_id FROM bundles WHERE bundle_id > ? ORDER BY bundle_id LIMIT ?`, scan, cap);
      for (const r of batch) {
        if (typeof visible === "function" && !visible(r.bundle_id)) continue;
        page.push(r.bundle_id);
        if (page.length >= cap) break;
      }
      if (page.length >= cap || batch.length < cap) break;
      scan = batch[batch.length - 1].bundle_id;
    }
    /* R59, R67, R69, C-102.3: a registered check, grammar, context or finding that threw is one error of its own on the
       bundle, under its module's name, never a clean bundle and never a throw out of the pass. */
    /* DEC-49 REGION is-audit-check-failed */
    const failOn = (into, module, id, e) => {
      into.push({ check: module, code: "AUDIT_CHECK_FAILED", severity: "error",
                  message: `${module}'s audit check threw on ${id}: ${String((e && e.message) || e).slice(0, 200)}`,
                  translation: RECORD_CORE_CHECKS.AUDIT_CHECK_FAILED.translation });
    };
    /* END DEC-49 REGION is-audit-check-failed */
    const sha256 = async (v) => hex(await crypto.subtle.digest("SHA-256", typeof v === "string" ? te.encode(v) : v));
    const sha512 = async (b) => new Uint8Array(await crypto.subtle.digest("SHA-512", b));
    const resolveTarget = (t) => typeof t === "string" && !!this.#one(`SELECT 1 AS x FROM bundles WHERE bundle_id=? LIMIT 1`, t);
    /* REC-56 / D-206: `tally` is keyed by check id and `tallyDetail` by `<check>/<code>`, because one
       check can report different facts; `tallyDetail` is absent when nothing on the page carried a code. */
    const tally = {}; const tallyDetail = {}; const offenders = [];
    let clean = 0, withErrors = 0;
    for (const id of page) {
      const img = this.readImage(id) || {};
      const files = new Map(), elided = new Set();
      for (const [path, v] of Object.entries(img)) {
        if (typeof v === "string") files.set(path, v); else elided.add(path);
      }
      const failed = [];
      const extra = {};
      for (const { module, context: of } of this.#auditContexts) {
        let got;
        try { got = of(id); } catch (e) { failOn(failed, module, id, e); continue; }
        if (got && typeof got === "object") Object.assign(extra, got);
      }
      if (typeof context === "function") Object.assign(extra, context(id) || {});
      const grammars = this.#bundleGrammars(async (g, run) => { try { await run(); } catch (e) { failOn(failed, g.module, id, e); } });
      const { findings } = await checkBundle({
        folderName: id, files, elidedPaths: elided, sha256, sha512, resolveTarget, ...extra,
      }, { grammars });
      findings.push(...failed);
      /* R59: every registered check over the same image, in registration order. */
      for (const { module, check } of this.#auditChecks) {
        let more;
        try { more = await check({ bundleId: id, folderName: id, raw: img, files, elidedPaths: elided, sha256, sha512,
                                   resolveTarget }, extra); }
        catch (e) { more = []; failOn(findings, module, id, e); }
        if (Array.isArray(more)) findings.push(...more.filter((f) => f && typeof f === "object"));
      }
      const errs = findings.filter((f) => f.severity === "error");
      if (!errs.length) { clean++; continue; }
      withErrors++;
      for (const e of errs) {
        tally[e.check] = (tally[e.check] || 0) + 1;
        if (e.code) { const k = `${e.check}/${e.code}`; tallyDetail[k] = (tallyDetail[k] || 0) + 1; }
      }
      /* Bounded: the tally says how much, these say what it looks like. */
      if (offenders.length < 20)
        offenders.push({ bundleId: id, errors: errs.slice(0, 5).map((e) => ({ check: e.check, detail: e.message })) });
    }
    const last = page.length ? page[page.length - 1] : after;
    /* R68: each registered finding over the page, `{bundles: [{bundleId, type, state}], after, last}`. */
    const stated = {};
    if (this.#auditFindings.length) {
      const bundles = [];
      for (const id of page)
        bundles.push({ ...(this.#one(`SELECT bundle_id AS bundleId, object_type AS type, current_state AS state
                                         FROM bundles WHERE bundle_id=?`, id) || { bundleId: id, type: null, state: null }) });
      for (const { module, key, finding } of this.#auditFindings) {
        try { stated[key] = await finding({ bundles, after: String(after ?? ""), last }); }
        catch (e) {
          const lost = [];
          failOn(lost, module, "this page", e);
          stated[key] = { ok: false, reason: lost[0].code, code: lost[0].code, check: RECORD_CORE_CHECKS[lost[0].code].check,
                          translation: lost[0].translation, detail: lost[0].message };
        }
      }
    }
    return { ...stated, ok: true, checked: page.length, clean, withErrors, tally,
             ...(Object.keys(tallyDetail).length ? { tallyDetail } : {}),
             offenders, limit: cap, cursor: page.length === cap ? last : null, page };
  }

  /* ---- purge (R21–R24) ---- */

  /* R21 (S0-3): the classes every declared table names, each with the values it may take. */
  static #CLASSES = Object.freeze({
    purge: Object.freeze(["clear", "exempt"]), expunge: Object.freeze(["tombstone", "none"]),
    export: Object.freeze(["yes", "admin-only", "never"]), sight: Object.freeze(["group", "bundle", "source", "owner"]),
    derive: Object.freeze(["stored", "derived-rebuildable"]), version_chain: Object.freeze([true, false]),
  });

  /** R21, R46 (T33-19; S0-3, K1470, K1489): a module declares the tables it owns, once, at start, one entry per table,
   *  each naming its classes (`purge`, `expunge`, `export`, `sight`, `derive`, `version_chain`) beside R46's keying
   *  (`keys`, `whole`, `clears`). A `derived-rebuildable` table also names `rebuild(scope)` and `key`, the columns that
   *  name one of its rows (R77). An entry missing a class, or with a value outside it, is refused, naming the table and
   *  the class; so is a name that is not a plain identifier, and a table declared twice or by two modules (R80, each with
   *  its row). A refused declaration declares nothing. `purge` clears every declared table whose `purge` is `clear`.
   *  R77 (N593): a derived-rebuildable table may also name `from`, the stored tables its rows are rebuilt from, kept as
   *  given and answered by `declaredTables()`. */
  declareTable(module, entries = []) {
    return this.#declare(module, Array.isArray(entries) ? entries : [entries], false);
  }

  /** R21, R46: `declareTable`'s default form, kept for the modules with no T33 job (plan T33, Rules (6)): each table
   *  `purge: "exempt"` when listed in `exempt`, else `clear`; `expunge: "none"`, `export: "admin-only"`, `derive:
   *  "stored"`, `version_chain: false`; `sight` is `bundle` when the table is keyed to a bundle, else `group`, decided
   *  when the declarations are read, as purge decides keying (the table may not exist yet at declaration). An entry is a
   *  table name or `{name, keys, whole, clears}`: keyed to a bundle by the named columns (any of them matching; none, and
   *  only the whole-store form clears it), cleared by the whole-store form only where `whole` holds, and, for `clears`
   *  (K775), a pointer column a bundle's purge sets to NULL where it names the bundle, on rows that stay. */
  declarePurge(module, tables = [], { exempt = [] } = {}) {
    const defaults = { expunge: "none", export: "admin-only", sight: "bundle", derive: "stored", version_chain: false };
    return this.#declare(module, [...tables.map((t) => ({ ...(typeof t === "string" ? { name: t } : t), ...defaults, purge: "clear" })),
                                  ...exempt.map((name) => ({ name, ...defaults, purge: "exempt" }))], true);
  }

  /* The one declaration door (R21). `keyedSight`: the entries' `sight` is decided by their keying when read. */
  #declare(module, entries, keyedSight) {
    const plain = (k) => typeof k === "string" && IDENT.test(k);
    const columns = (list) => list == null || (Array.isArray(list) && list.every(plain));
    /* R77: `from` is not stated (absent or null), or a non-empty list of plain table names */
    const sources = (list) => list == null || (Array.isArray(list) && list.length > 0 && list.every(plain));
    const names = new Set(), held = [];
    for (const raw of entries) {
      const e = raw && typeof raw === "object" ? raw : { name: raw };
      const table = String(e.name);
      /* DEC-49 REGION is-table-declaration */
      if (!plain(e.name) || !columns(e.keys) || !columns(e.clears) || !columns(e.key) || !sources(e.from))
        return rowRefusal("TABLE_NAME_INVALID", localize("record-core.index.table_was_not_declared_a", "{table} was not declared: a table's name, and every column or table its declaration names, is a plain identifier; nothing was declared.", { table: String(table) }), { table, module });
      for (const [cls, allowed] of Object.entries(RecordCore.#CLASSES)) {
        if (e[cls] === undefined)
          return rowRefusal("TABLE_CLASS_MISSING", localize("record-core.index.table_names_no_cls_class", "{table} names no {cls} class; nothing was declared.", { table: String(table), cls: String(cls) }), { table, module, class: cls });
        if (!allowed.includes(e[cls]))
          return rowRefusal("TABLE_CLASS_UNKNOWN", localize("record-core.index.table_s_cls_class_is", "{table}'s {cls} class is one of {allowed}; nothing was declared.", { table: String(table), cls: String(cls), allowed: String(allowed.join(", ")) }),
                            { table, module, class: cls });
      }
      if (e.derive === "derived-rebuildable" && typeof e.rebuild !== "function")
        return rowRefusal("TABLE_CLASS_MISSING", localize("record-core.index.table_is_derived_rebuildable_and", "{table} is derived-rebuildable and names no rebuild; nothing was declared.", { table: String(table) }),
                          { table, module, class: "rebuild" });
      if (e.derive === "derived-rebuildable" && !(Array.isArray(e.key) && e.key.length))
        return rowRefusal("TABLE_CLASS_MISSING", localize("record-core.index.table_is_derived_rebuildable_and_2", "{table} is derived-rebuildable and names no key columns; nothing was declared.", { table: String(table) }),
                          { table, module, class: "key" });
      if (this.#declared.has(table) || names.has(table)) {
        const declaredBy = this.#declared.has(table) ? this.#declared.get(table).module : module;
        return rowRefusal("TABLE_DECLARED", localize("record-core.index.table_is_already_declared_by", "{table} is already declared by {declaredBy}, and a table is declared once; nothing was declared.", { table: String(table), declaredBy: String(declaredBy) }), { table, module, declaredBy });
      }
      /* END DEC-49 REGION is-table-declaration */
      names.add(table);
      held.push({ e, table });
    }
    for (const { e, table } of held) {
      const classes = Object.freeze(Object.fromEntries(Object.keys(RecordCore.#CLASSES).map((c) => [c, e[c]])));
      const d = Object.freeze({ module, name: table, exempt: classes.purge === "exempt", classes, keyedSight,
                                keys: e.keys == null ? null : Object.freeze([...e.keys]), whole: e.whole || null,
                                clears: Object.freeze(e.clears == null ? [] : [...e.clears]),
                                rebuild: classes.derive === "derived-rebuildable" ? e.rebuild : null,
                                key: classes.derive === "derived-rebuildable" ? Object.freeze([...e.key]) : null,
                                from: classes.derive === "derived-rebuildable" && e.from != null ? Object.freeze([...e.from]) : null });
      this.#declared.set(table, d);
      this.#order.push(d);
    }
    return { ok: true };
  }

  /* A declaration's keying (R46): its `keys` when it names them, else the table's `bundle_id` column. */
  #bundleKeys(d) {
    if (d.keys) return d.keys;
    try { return this.#rows(`PRAGMA table_info(${d.name})`).some((c) => c.name === "bundle_id") ? ["bundle_id"] : []; }
    catch { return []; }
  }

  /** R21: every declaration with its classes, in declaration order (`corpus-export` reads it), a fresh list each call. A
   *  default-form entry's `sight` is `bundle` when the table is keyed to a bundle now, else `group`. R77: a
   *  derived-rebuildable entry answers `from`, the stored tables it is rebuilt from, or null when its declaration named
   *  none (not stated, never an empty list); a stored entry answers no `from`. */
  declaredTables() {
    return this.#order.map((d) => ({
      module: d.module, name: d.name, ...(d.keys ? { keys: [...d.keys] } : {}), ...(d.whole ? { whole: d.whole } : {}),
      ...(d.clears.length ? { clears: [...d.clears] } : {}), ...d.classes,
      ...(d.keyedSight ? { sight: this.#bundleKeys(d).length ? "bundle" : "group" } : {}),
      ...(d.key ? { key: [...d.key], from: d.from ? [...d.from] : null } : {}),
    }));
  }

  /** R22–R24, R46: whole-store (no `bundleId`) or one bundle's rows, from every declared non-exempt table,
   *  in declaration order and this module's `bundles` last, in one transaction; a bundle's purge also sets each
   *  declared `clears` column to NULL where it names the bundle (K775), in the same transaction. `seq`, `minted_ids` and
   *  `settings` are exempt in both forms, on the counter's reasoning: an id once allocated or minted is
   *  never reissued, and a purge that reset them would make identifiers ambiguous across it. An
   *  undeclared table is never touched. Evidence objects are untouched (content-addressed, immutable). */
  purge({ bundleId = null } = {}) {
    const one = bundleId != null && bundleId !== "";
    const isRow = (d) => d.module === "record-core" && d.name === "bundles";
    const plan = [...this.#order.filter((d) => !d.exempt && !isRow(d)), ...this.#order.filter((d) => !d.exempt && isRow(d))];
    const removed = {};
    this.transact(() => {
      for (const d of plan) {
        removed[d.name] = 0;
        let where, args = [];
        if (one) {
          for (const c of d.clears) this.#sql.exec(`UPDATE ${d.name} SET ${c}=NULL WHERE ${c}=?`, bundleId);
          const keys = this.#bundleKeys(d);
          if (!keys.length) continue;
          where = keys.map((k) => `${k}=?`).join(" OR "); args = keys.map(() => bundleId);
        } else where = d.whole || "1=1";
        const n = this.#one(`SELECT COUNT(*) AS n FROM ${d.name} WHERE ${where}`, ...args);
        removed[d.name] = n ? Number(n.n) : 0;
        if (removed[d.name]) this.#sql.exec(`DELETE FROM ${d.name} WHERE ${where}`, ...args);
      }
    });
    return { ok: true, scope: one ? bundleId : "ALL", removed };
  }

  /* ---- the derived-cache convention (R77; S0-3) ---- */

  /* A row key as it is held and compared: the column→value pairs in column order, as JSON. */
  static #keyJson(map) { return JSON.stringify(Object.keys(map).sort().map((k) => [k, map[k]])); }
  static #scalar(v) { return typeof v === "string" || (typeof v === "number" && Number.isFinite(v)); }
  static #plain(o) { return !!o && typeof o === "object" && !Array.isArray(o) && Object.getPrototypeOf(o) === Object.prototype; }

  /* The declaration of a table `module` declared derived-rebuildable; a caller naming any other is a defect in how the
     instance was built, answered as a TypeError. */
  #derived(module, table) {
    const d = this.#declared.get(String(table));
    if (!d || d.module !== module || d.rebuild === null)
      throw new TypeError(`${String(table)} is not a table ${String(module)} declared derived-rebuildable (R77)`);
    return d;
  }
  /* A row's key, `{column: value}` over exactly the declared key columns, or a bare value for a one-column key; null
     for anything else. */
  #keyMap(d, key) {
    if (RecordCore.#plain(key)) {
      const cols = Object.keys(key);
      return cols.length === d.key.length && d.key.every((c) => Object.hasOwn(key, c) && RecordCore.#scalar(key[c]))
        ? Object.fromEntries(d.key.map((c) => [c, key[c]])) : null;
    }
    return d.key.length === 1 && RecordCore.#scalar(key) ? { [d.key[0]]: key } : null;
  }
  /* A rebuild's scope: null (the whole table) or `{column: value}`, every column matching. */
  static #scope(scope) {
    if (scope === null || scope === undefined) return null;
    if (!RecordCore.#plain(scope) || !Object.entries(scope).every(([c, v]) => IDENT.test(c) && RecordCore.#scalar(v)))
      throw new TypeError("a rebuild's scope is null or an object of column names to values (R77)");
    return Object.keys(scope).length ? { ...scope } : null;
  }
  static #where(map) {
    const cols = map ? Object.keys(map) : [];
    return { sql: cols.length ? cols.map((c) => `${c}=?`).join(" AND ") : "1=1", args: cols.map((c) => map[c]) };
  }
  /* `rebuild(scope)`'s rows, each a plain object of column names to values; anything else is the rebuild's defect. */
  static #rebuilt(d, scope) {
    const rows = d.rebuild(scope);
    if (!Array.isArray(rows) || !rows.every((r) => RecordCore.#plain(r) && Object.keys(r).every((c) => IDENT.test(c))))
      throw new TypeError(`${d.name}'s rebuild answered something other than a list of rows (R77)`);
    return rows;
  }
  #insertRows(table, rows) {
    for (const r of rows) {
      const cols = Object.keys(r);
      this.#sql.exec(`INSERT INTO ${table} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`, ...cols.map((c) => r[c]));
    }
  }

  /** R77: marks a held row of a derived-rebuildable table stale, in whatever transaction the caller holds, so
   *  `readDerived` answers it stale until a rebuild clears it. `key` names the row (R77's key columns). A table the
   *  module did not declare derived-rebuildable, or a key that names no row's key, is the caller's defect: a TypeError. */
  markStale(module, table, key) {
    const d = this.#derived(module, table);
    const map = this.#keyMap(d, key);
    if (!map) throw new TypeError(`markStale: ${d.name}'s key is ${d.key.join(", ")} (R77)`);
    this.#sql.exec(`INSERT OR IGNORE INTO derived_stale (module,table_name,key_json,marked_at) VALUES (?,?,?,?)`,
                   module, d.name, RecordCore.#keyJson(map), new Date().toISOString());
    return { ok: true };
  }

  /** R77: FAIL CLOSED. A held row that is marked stale, missing, or cannot be read is `{stale: true}`, never its held
   *  value; a fresh one is `{stale: false, row}`. Only a table the module did not declare derived-rebuildable throws. */
  readDerived(module, table, key) {
    const d = this.#derived(module, table);
    try {
      const map = this.#keyMap(d, key);
      if (!map) return { stale: true };
      if (this.#one(`SELECT 1 AS x FROM derived_stale WHERE module=? AND table_name=? AND key_json=?`, module, d.name,
                    RecordCore.#keyJson(map))) return { stale: true };
      const w = RecordCore.#where(map);
      const row = this.#one(`SELECT * FROM ${d.name} WHERE ${w.sql} LIMIT 1`, ...w.args);
      return row ? { stale: false, row: { ...row } } : { stale: true };
    } catch {
      return { stale: true };
    }
  }

  /** R77: THE REBUILD THAT CLEARS A MARK. In one transaction, the held rows in `scope` (null: the whole table) are
   *  replaced by `rebuild(scope)`'s, and the marks of every row it removed or wrote are cleared (with no scope, every
   *  mark of the table). It writes only the declared table and this module's marks. */
  rebuildDerived(module, table, scope = null) {
    const d = this.#derived(module, table);
    const sc = RecordCore.#scope(scope);
    return this.transact(() => {
      const rows = RecordCore.#rebuilt(d, sc);
      const w = RecordCore.#where(sc);
      const pick = (r) => Object.fromEntries(d.key.map((c) => [c, r[c]]));
      const touched = new Set(this.#rows(`SELECT ${d.key.join(",")} FROM ${d.name} WHERE ${w.sql}`, ...w.args)
                                .map((r) => RecordCore.#keyJson(pick(r))));
      this.#sql.exec(`DELETE FROM ${d.name} WHERE ${w.sql}`, ...w.args);
      this.#insertRows(d.name, rows);
      for (const r of rows) touched.add(RecordCore.#keyJson(pick(r)));
      if (!sc) this.#sql.exec(`DELETE FROM derived_stale WHERE module=? AND table_name=?`, module, d.name);
      else for (const k of touched)
        this.#sql.exec(`DELETE FROM derived_stale WHERE module=? AND table_name=? AND key_json=?`, module, d.name, k);
      return { ok: true, rows: rows.length };
    });
  }

  /** R77: THE ONE TEST HELPER. Rebuilds the rows of `scope` into a scratch copy of the table and compares them byte for
   *  byte with the held rows of `scope`, both read back through SQLite (so its own typing is what is compared), walked
   *  in key order: `{same: true}`, or `{same: false, first: {key, held, rebuilt}}` at the first key whose rows differ
   *  (`held` null for a row only the rebuild holds, `rebuilt` null for one only the table holds). The scratch copy lives in a savepoint that is
   *  always rolled back: nothing is written to the held table, or anywhere. */
  rebuildAndCompare(module, table, scope = null) {
    const d = this.#derived(module, table);
    const sc = RecordCore.#scope(scope);
    const cols = this.#rows(`PRAGMA table_info(${d.name})`).map((c) => c.name);
    /* Both sides in one order: the key columns first, then every other column, so rows of one key meet. */
    const order = [...d.key, ...cols.filter((c) => !d.key.includes(c))].join(",");
    const scratch = `rebuild_scratch_${d.name}`;
    const tag = (v) => (v instanceof Uint8Array ? ["blob", hex(v)] : typeof v === "bigint" ? ["bigint", String(v)] : [typeof v, v]);
    const bytes = (r) => JSON.stringify(cols.map((c) => tag(r[c])));
    /* SQLite's order of two values (null, then numbers, then text, then blobs; text and blobs by their bytes). */
    const rank = (v) => (v === null || v === undefined ? 0 : typeof v === "number" || typeof v === "bigint" ? 1 : typeof v === "string" ? 2 : 3);
    const cmp = (x, y) => {
      if (rank(x) !== rank(y)) return rank(x) - rank(y);
      if (rank(x) === 1) return x < y ? -1 : x > y ? 1 : 0;
      if (rank(x) === 0) return 0;
      return Buffer.compare(Buffer.from(rank(x) === 2 ? te.encode(x) : x), Buffer.from(rank(y) === 2 ? te.encode(y) : y));
    };
    const keyCmp = (h, r) => { for (const c of d.key) { const k = cmp(h[c], r[c]); if (k) return k; } return 0; };
    const keyOf = (r) => Object.fromEntries(d.key.map((c) => [c, r[c]]));
    const DONE = Symbol("compared");
    let out;
    try {
      this.#storage.transactionSync(() => {
        this.#sql.exec(`CREATE TABLE ${scratch} AS SELECT * FROM ${d.name} WHERE 0`);
        this.#insertRows(scratch, RecordCore.#rebuilt(d, sc));
        const w = RecordCore.#where(sc);
        const held = this.#rows(`SELECT * FROM ${d.name} WHERE ${w.sql} ORDER BY ${order}`, ...w.args);
        const rebuilt = this.#rows(`SELECT * FROM ${scratch} ORDER BY ${order}`);
        out = { same: true };
        let i = 0, j = 0;
        while (i < held.length || j < rebuilt.length) {
          const h = held[i] ?? null, r = rebuilt[j] ?? null;
          const k = h && r ? keyCmp(h, r) : h ? -1 : 1;
          if (k === 0 && bytes(h) === bytes(r)) { i++; j++; continue; }
          out = { same: false, first: k === 0 ? { key: keyOf(h), held: { ...h }, rebuilt: { ...r } }
                    : k < 0 ? { key: keyOf(h), held: { ...h }, rebuilt: null } : { key: keyOf(r), held: null, rebuilt: { ...r } } };
          break;
        }
        throw DONE;
      });
    } catch (e) {
      if (e !== DONE) throw e;
    }
    return out;
  }

  /* ---- the store gate (R78; S0-3, the one-home checks) ---- */

  /** R78: a table's owner registers, once per table at start, `check(row, {op})` (or a list of them, run in order), the
   *  table's one-home and shape checks. Refused, registering nothing: a table that already has its checks
   *  (`STORE_GATE_DECLARED`, naming the holder); no module, a table this module did not declare, or no function
   *  (`STORE_GATE_MALFORMED`). */
  registerStoreGate(module, table, check) {
    const named = typeof module === "string" && module.trim() !== "";
    const d = typeof table === "string" ? this.#declared.get(table) : undefined;
    const checks = typeof check === "function" ? [check]
      : Array.isArray(check) && check.length && check.every((c) => typeof c === "function") ? [...check] : null;
    /* DEC-49 REGION is-store-gate-registration */
    if (!named || !d || d.module !== module || !checks)
      return rowRefusal("STORE_GATE_MALFORMED", d && named && d.module !== module
        ? localize("record-core.index.a_store_gate_names_its_2", "a store gate names its module, a table that module declared and a check to run; nothing was registered ({table} is {owner}'s).", { table: String(d.name), owner: String(d.module) })
        : localize("record-core.index.a_store_gate_names_its", "a store gate names its module, a table that module declared and a check to run; nothing was registered."),
        { module: named ? module : null, table: typeof table === "string" ? table : null, ...(d ? { declaredBy: d.module } : {}) });
    if (this.#gates.has(table))
      return rowRefusal("STORE_GATE_DECLARED", localize("record-core.index.table_s_checks_are_already", "{table}'s checks are already registered by {module}; the first still runs.", { table: String(table), module: String(this.#gates.get(table).module) }), { module, table, heldBy: this.#gates.get(table).module });
    /* END DEC-49 REGION is-store-gate-registration */
    this.#gates.set(table, Object.freeze({ module, checks: Object.freeze(checks) }));
    return { ok: true, module, table };
  }

  /** R78: what every write to a gated table asks, inside its transaction, before it writes: the table's checks in order,
   *  answering the first refusal (a check's answer carrying a non-empty `code`, given back with `ok: false` and that
   *  code as `reason`), or null when every check passed (or the table has none). FAIL CLOSED: a check that throws,
   *  answers a promise, or answers anything but null, undefined or a refusal is `STORE_GATE_FAILED`, never a pass; a
   *  writer that is not the table's declarer is `STORE_GATE_MALFORMED`. A writer that gets a refusal writes nothing and
   *  answers it. Writes nothing; never throws. */
  storeGate(module, table, row, op) {
    const d = typeof table === "string" ? this.#declared.get(table) : undefined;
    /* DEC-49 REGION is-store-gate-registration */
    if (d && d.module !== module)
      return rowRefusal("STORE_GATE_MALFORMED", localize("record-core.index.table_is_module_s_table", "{table} is {module}'s table; {String} does not write it. Nothing was written.", { table: String(table), module: String(d.module), String: String(String(module)) }), { module: typeof module === "string" ? module : null, table, declaredBy: d.module });
    /* END DEC-49 REGION is-store-gate-registration */
    const gate = typeof table === "string" ? this.#gates.get(table) : undefined;
    if (!gate) return null;
    for (const check of gate.checks) {
      let got, failed = null;
      try {
        got = check(row, { op });
        if (got !== null && typeof got === "object" && typeof got.then === "function") {
          try { got.then(null, () => {}); } catch { /* a thenable that cannot be followed is still no answer */ }
          failed = word("record-core.failed");
        }
      } catch (e) { failed = String((e && e.message) || e).slice(0, 200); }
      if (failed === null && (got === null || got === undefined)) continue;
      let code = null;
      try { code = failed === null && got && typeof got === "object" && typeof got.code === "string" && got.code ? got.code : null; }
      catch { code = null; }
      if (code !== null) {
        let own = {};
        try { own = { ...got }; } catch { own = {}; }
        return { ...own, ok: false, reason: code, code };
      }
      /* DEC-49 REGION is-store-gate-failed */
      return rowRefusal("STORE_GATE_FAILED", localize("record-core.index.module_s_check_on_table", "{module}'s check on {table} did not answer a pass or a refusal{v1}. Nothing was written.", { module: String(gate.module), table: String(table), v1: String(failed === null ? "" : `: ${failed}`) }), { module: gate.module, table });
      /* END DEC-49 REGION is-store-gate-failed */
    }
    return null;
  }

  /* ---- expunge with a tombstone (R79; K1493, State Rules I-19) ---- */

  static #GROUNDS = Object.freeze(["unlawful", "confidential", "court_order", "lawful_demand"]);

  /** R79: THE SANCTIONED EXCEPTION TO APPEND-ONLY. Removes, in one transaction, the rows of a table its module declared
   *  `expunge: "tombstone"` whose columns match every column of `key`, and records one tombstone `{table, key, ground,
   *  order?, demandKind?, by, at}` holding none of the removed content. Refused, removing nothing, in this order: a
   *  ground outside the four (or `court_order` naming no order, `lawful_demand` no demand kind),
   *  `EXPUNGE_GROUND_UNKNOWN`; a table `module` did not declare `tombstone` (`history` and `manifest` are declared
   *  `none`, R29), `EXPUNGE_NOT_DECLARED`; a machine (`token:`) or absent `by`, `EXPUNGE_NOT_A_MEMBER`; a key that is
   *  empty, names a column the table lacks, or matches no row, `EXPUNGE_NOTHING`. Who may expunge, and the ground's
   *  evidence, are the caller's. */
  expunge({ module, table, key, ground, order, demandKind, by } = {}) {
    const said = (v) => typeof v === "string" && v.trim() !== "";
    const d = typeof table === "string" ? this.#declared.get(table) : undefined;
    const named = typeof table === "string" ? table : null;
    let cols = [];
    if (d && d.classes.expunge === "tombstone") cols = this.#rows(`PRAGMA table_info(${d.name})`).map((c) => c.name);
    const keyed = RecordCore.#plain(key) && Object.keys(key).length > 0
      && Object.entries(key).every(([c, v]) => IDENT.test(c) && cols.includes(c) && RecordCore.#scalar(v));
    const w = keyed ? RecordCore.#where(key) : null;
    /* DEC-49 REGION is-expunge-refused */
    if (!RecordCore.#GROUNDS.includes(ground) || (ground === "court_order" && !said(order))
        || (ground === "lawful_demand" && !said(demandKind)))
      return rowRefusal("EXPUNGE_GROUND_UNKNOWN", localize("record-core.index.an_expunge_names_one_of", "an expunge names one of the grounds unlawful, confidential, court_order (with the recorded order) or lawful_demand (with the profile's demand kind); nothing was removed."), { table: named });
    if (!d || d.module !== module || d.classes.expunge !== "tombstone")
      return rowRefusal("EXPUNGE_NOT_DECLARED", localize("record-core.index.string_is_not_a_table", "{String} is not a table {String_2} declared expunge: tombstone; nothing was removed.", { String: String(String(table)), String_2: String(String(module)) }), { table: named });
    if (!said(by) || by.trim().startsWith("token:"))
      return rowRefusal("EXPUNGE_NOT_A_MEMBER", localize("record-core.index.an_expunge_is_a_members", "an expunge is a member's act, named by that member; a machine or absent actor removes nothing."), { table: named });
    const n = keyed ? Number(this.#one(`SELECT COUNT(*) AS n FROM ${d.name} WHERE ${w.sql}`, ...w.args).n) : 0;
    if (!n)
      return rowRefusal("EXPUNGE_NOTHING", localize("record-core.index.no_row_of_name_matches", "no row of {name} matches the key; nothing was removed.", { name: String(d.name) }), { table: named });
    /* END DEC-49 REGION is-expunge-refused */
    const at = new Date().toISOString();
    const keep = { ...key };
    return this.transact(() => {
      this.#sql.exec(`DELETE FROM ${d.name} WHERE ${w.sql}`, ...w.args);
      this.#sql.exec(`INSERT INTO tombstones (module,table_name,key_json,ground,court_order,demand_kind,by_actor,at)
                      VALUES (?,?,?,?,?,?,?,?)`, module, d.name, RecordCore.#keyJson(keep), ground,
                     ground === "court_order" ? order : null, ground === "lawful_demand" ? demandKind : null, by, at);
      return { ok: true, table: d.name, removed: n,
               tombstone: { table: d.name, key: keep, ground, ...(ground === "court_order" ? { order } : {}),
                            ...(ground === "lawful_demand" ? { demandKind } : {}), by, at } };
    });
  }

  /** R79: the tombstones in the order recorded, after the cursor `after` (a tombstone's `seq`), at most `limit`, of one
   *  table when `table` is given. `cursor` is the last `seq` listed. Writes nothing; never throws. */
  tombstones({ table = null, after = 0, limit = 200 } = {}) {
    try {
      const cap = RecordCore.#bound(limit);
      const from = Number.isSafeInteger(Number(after)) ? Number(after) : 0;
      const list = (typeof table === "string"
        ? this.#rows(`SELECT * FROM tombstones WHERE seq > ? AND table_name = ? ORDER BY seq LIMIT ?`, from, table, cap)
        : this.#rows(`SELECT * FROM tombstones WHERE seq > ? ORDER BY seq LIMIT ?`, from, cap)).map((r) => {
          let key;
          try { key = Object.fromEntries(JSON.parse(r.key_json)); } catch { key = null; }
          return { seq: r.seq, table: r.table_name, key, ground: r.ground, ...(r.court_order != null ? { order: r.court_order } : {}),
                   ...(r.demand_kind != null ? { demandKind: r.demand_kind } : {}), by: r.by_actor, at: r.at };
        });
      return { tombstones: list, cursor: list.length ? list[list.length - 1].seq : null };
    } catch {
      return { tombstones: [], cursor: null };
    }
  }

  /* ---- settings (R25, R26) ---- */

  /** R25: the value last set under `name`, or null. R83 (T46; N904): asked `{strict: true}` (exactly `true`), it tells a
   *  value that cannot be read from one never set: `null` only when no value was ever set under `name`,
   *  `SETTING_UNREADABLE` when the value last set is not valid JSON (or not held as text), the value otherwise (one set
   *  as null reads null). FAIL CLOSED: a read that fails, a name that cannot be spelled or options that cannot be read
   *  never answer "unset" in the strict form; it answers `SETTING_UNREADABLE` and never throws. Without the option it
   *  answers as R25 always has, an unreadable value reading null, so no caller that does not ask changes. */
  getSetting(name, options) {
    let strict = false;
    try { strict = options !== null && typeof options === "object" && options.strict === true; } catch { strict = false; }
    if (!strict) {
      const r = this.#one(`SELECT value FROM settings WHERE name=? ORDER BY rowid DESC LIMIT 1`, String(name ?? ""));
      if (!r) return null;
      try { return JSON.parse(r.value); } catch { return null; }
    }
    try {
      const r = this.#one(`SELECT value FROM settings WHERE name=? ORDER BY rowid DESC LIMIT 1`, String(name ?? ""));
      if (!r) return null;
      if (typeof r.value !== "string") return SETTING_UNREADABLE;
      return JSON.parse(r.value);
    } catch {
      return SETTING_UNREADABLE;
    }
  }

  /** R25, R26, R81, R84: records `value` under `name`, with who set it and when. `jurisdiction_profiles` is an
   *  ordered list of profile ids (non-empty strings, no repeats); anything else is refused and nothing
   *  is recorded. The five refusals, in this order, each answer with its row (C-102.29–.33, DEC-49) and one fixed
   *  sentence; `SETTING_NOT_JSON` and `SETTING_INVALID` keep `name`. R84 (T47; N939): a value is stored as JSON, so one
   *  that would not read back as it was set is refused `SETTING_NOT_JSON` (`roundTripsJson`), and JSON never silently
   *  changes a setting. */
  setSetting(name, value, by) {
    const n = String(name ?? "");
    /* DEC-49 REGION is-setting-refused */
    if (!n) return rowRefusal("SETTING_NAME_REQUIRED", localize("record-core.index.a_setting_is_recorded_under", "a setting is recorded under a name, and none was given; nothing was recorded."));
    if (typeof by !== "string" || !by.trim())
      return rowRefusal("SETTING_BY_REQUIRED", localize("record-core.index.a_setting_is_recorded_with", "a setting is recorded with who set it, and no one was named; nothing was recorded."));
    if (value === undefined)
      return rowRefusal("SETTING_VALUE_REQUIRED", localize("record-core.index.a_setting_is_recorded_with_2", "a setting is recorded with a value, and none was given; nothing was recorded."));
    const text = roundTripsJson(value) ? jsonText(value) : null;
    if (text === null)
      return rowRefusal("SETTING_NOT_JSON", localize("record-core.index.a_settings_value_is_stored", "a setting's value is stored as JSON, and this value cannot be stored as written; nothing was recorded."), { name: n });
    if (n === "jurisdiction_profiles"
        && !(Array.isArray(value) && value.every((v) => typeof v === "string" && v.trim() !== "")
             && new Set(value).size === value.length))
      return rowRefusal("SETTING_INVALID", localize("record-core.index.jurisdiction_profiles_is_an_ordered", "jurisdiction_profiles is an ordered list of distinct profile ids; nothing was recorded."),
                        { name: n });
    /* END DEC-49 REGION is-setting-refused */
    this.#sql.exec(`INSERT INTO settings (name,value,set_by,set_at) VALUES (?,?,?,?)`,
                   n, text, by, new Date().toISOString());
    return { ok: true };
  }

  /* ---- the evidence store (R38) ---- */

  /** R38: the instance's evidence bucket, addressed by digest; the object key of a digest is fixed
   *  here (the prefix R39's `evidencePrefix` gives, then the digest). `put` hands the bucket the digest, so it verifies the bytes.
   *  R88 (fix round 4, P10 (c); K4447): `get(digest, {range: {offset, length}})` asks the bucket for those bytes alone (R2's
   *  `range` option), so a look at the head of a large object transfers the head and not the object; with no range the bucket
   *  is asked as before and answers the whole. Null when no bucket is bound. */
  evidenceStore() {
    const bucket = this.#evidence;
    if (!bucket) return null;
    const prefix = typeof this.#evidencePrefix === "function" ? this.#evidencePrefix() : this.#evidencePrefix;
    const key = (digest) => `${prefix ?? ""}${String(digest)}`;
    const store = {
      head: (digest) => bucket.head(key(digest)),
      get: (digest, options) => {
        const range = rangeOf(options);
        return range ? bucket.get(key(digest), { range }) : bucket.get(key(digest));
      },
      put: (digest, bytes) => bucket.put(key(digest), bytes, { sha256: String(digest) }),
    };
    /* R87: offered only by a bucket that has R2's multipart upload, so a caller feature-detects it */
    if (typeof bucket.createMultipartUpload === "function")
      store.putFromParts = (digest, partDigests) => putFromParts(bucket, key, digest, partDigests);
    return store;
  }
}

/* ---- the evidence store's whole object from parts (R87) ---- */

const DIGEST = /^[0-9a-f]{64}$/;

/** R88: the range a `get` asks of the bucket, `{offset, length}` copied as whole numbers (offset from 0, length at least 1),
 *  or null when the options name none (the whole object is read, as R38 states). A range that is named but is not such a pair
 *  would otherwise read the whole object, which R88 never does, so it is the caller's defect: a TypeError, the bucket unasked. */
function rangeOf(options) {
  if (options === undefined || options === null || options.range === undefined) return null;
  const r = options.range;
  if (!r || typeof r !== "object" || !Number.isSafeInteger(r.offset) || r.offset < 0 || !Number.isSafeInteger(r.length) || r.length < 1)
    throw new TypeError("get: a range is {offset, length}, whole numbers, the offset from 0 and the length at least 1 (R88)");
  return { offset: r.offset, length: r.length };
}

/** R87 (fix round 3, C5; K4363): the object under `digest`, made by the bucket's own multipart upload from the parts it holds
 *  under `partDigests`, each read in order and handed on as one upload part, so one part is in memory at a time. The upload
 *  completes only when every part was read and the bytes' SHA-256 is `digest`; otherwise it is aborted and nothing is
 *  written. A digest already held answers `{ok: true, already: true}`. Never throws. */
async function putFromParts(bucket, key, digest, partDigests) {
  /* DEC-49 REGION is-evidence-parts-refused */
  if (typeof digest !== "string" || !DIGEST.test(digest) || !Array.isArray(partDigests) || partDigests.length === 0
      || !partDigests.every((d) => typeof d === "string" && DIGEST.test(d)))
    return rowRefusal("EVIDENCE_PARTS_MALFORMED", localize("record-core.index.a_whole_document_is_named", "A whole document is named by its fingerprint and the fingerprints of its parts, in order, and at least one part. Nothing was kept."));
  try { if (await bucket.head(key(digest))) return { ok: true, already: true }; } catch { /* a head that fails is told below, by the upload */ }
  let upload = null;
  const stop = async () => { try { if (upload) await upload.abort(); } catch { /* an upload that cannot be aborted holds no object */ } };
  try {
    upload = await bucket.createMultipartUpload(key(digest));
    const sha = createSha256(), done = []; let size = 0;
    for (let i = 0; i < partDigests.length; i++) {
      const o = await bucket.get(key(partDigests[i]));
      if (!o) {
        await stop();
        return rowRefusal("EVIDENCE_PART_MISSING", localize("record-core.index.a_part_of_the_document", "Part {n} of {parts} of the document was not held. Nothing was kept.", { n: String(i + 1), parts: String(partDigests.length) }), { part: i + 1 });
      }
      let bytes = new Uint8Array(await o.arrayBuffer());
      sha.update(bytes); size += bytes.length;
      done.push(await upload.uploadPart(i + 1, bytes));
      bytes = null;
    }
    if (sha.hex() !== digest) {
      await stop();
      return rowRefusal("EVIDENCE_DIGEST_MISMATCH", localize("record-core.index.the_parts_do_not_hash", "The parts, read in order, do not hash to the document's fingerprint. Nothing was kept."));
    }
    await upload.complete(done);
    return { ok: true, size };
  } catch (e) {
    await stop();
    return rowRefusal("EVIDENCE_STORE_REFUSED", localize("record-core.index.the_store_would_not_take", "The store would not take the document whole ({why}). Nothing was kept.", { why: String(e && e.message || e).slice(0, 160) }));
  }
  /* END DEC-49 REGION is-evidence-parts-refused */
}

/* ---- the routes (R72, R73) ---- */

/* The keys of purge's proof whose difference `op=purge` answers as `removed` (R72), in today's order. */
const PURGE_REMOVED = Object.freeze(["bundles", "files", "history", "refs", "register", "tasks", "taskQueue",
  "sourceReachability", "entities", "entityAliases", "entityRelations", "resolutions", "connections", "progressionDefs",
  "connectionPairChoices", "progressionStages", "progressionDefVersions", "progressionStageVersions",
  "progressionInstances", "progressionExceptions", "connectionDirty", "proposalDispositions", "queueState",
  "projectParticipants", "projectOwnerVotes", "aiRuns", "aiRunBounds", "aiRunLog", "leads", "themes", "themePlacements",
  "suggestRefusals", "captureRequests"]);

/** R72 (`build/extraction/legacy-store.md` §4.2 (6), §4.4 (2); K757; the `membershipOps` pattern): this module's route
 *  arms, keyed by op name, each a function of no arguments answering what its service answers, its parameters read from
 *  `url`'s query, where the control plane stamps `viewer` and `capacity` (never from the body). Which credential reaches
 *  each op is `op-declarations`' and `control-plane`'s, never this map's. `sight` is membership's `viewerPredicate`
 *  (its R43), handed in by the composition root, since this module uses no membership (R19, R73). */
export function recordCoreOps(record, url, body, { sight = null } = {}) {
  const q = (k) => url.searchParams.get(k);
  return {
    allocid: () => record.allocIdOp(q("prefix"), q("year")),
    /* a courtesy lock of five minutes (R10–R12) */
    lease: () => record.acquireLease(q("id"), q("actor"), 300000),
    /* REC-176, REC-175: the two read-only censuses */
    snapkeycensus: () => record.snapKeyCensus({ limit: q("limit") }),
    digestcensus: () => record.digestCensus({ limit: q("limit") }),
    /* R64: `capacity` is the control plane's stamp from the authenticated class, true exactly when it is `1`; a viewer
       never stamped is a direct internal call, counted whole */
    stats: () => record.stats({ capacity: q("capacity") === "1", viewer: url.searchParams.has("viewer") ? q("viewer") : undefined }),
    audit: () => audit(record, { after: q("after") || "", limit: q("limit"), viewer: q("viewer"), sight }),
    /* R22–R24, D-113: one transaction, the private proof read just before and just after */
    purge: () => {
      const bundleId = q("bundleId") || null;
      const before = record.proofCounts();
      const { scope } = record.transact(() => record.purge({ bundleId }));
      const after = record.proofCounts();
      const removed = Object.fromEntries(PURGE_REMOVED.map((k) => [k, before[k] - after[k]]));
      return { ok: true, scope, before, after, removed };
    },
  };
}

/* R85 (T51; B2, K4259; op-declarations R80, op-grades R49): the op this module serves that the screens send, declared by
   its owner beside the ops map: its class, weight and description are the op's existing rows', its fields what the arm
   reads (R86: both are required, and a call without one is refused naming it). */
export const DECLARED_OPS = Object.freeze({
  allocid: { classes: ["admin", "member", "probe"], mutating: true, weight: "substrate", needs: "contribute",
    description: localize("record-core.declared.allocid", "substrate: id allocation"),
    fields: { accepts: ["prefix", "year"], requires: ["prefix", "year"] } },
});

/* R73: today's sweep, gated by the caller's sight. `visible(id)` asks, once per id the page names, whether the bundle
   passes `sight(viewer)`; references still resolve against the whole corpus (R19). An absent or unknown viewer, a sight
   not handed in, or one that cannot be read, sees nothing: an empty page and `total` 0 (fail closed, membership R43's
   "any other viewer"). The page's ids themselves are not answered. */
async function audit(record, { after, limit, viewer, sight }) {
  let gate = null;
  try { gate = typeof sight === "function" ? sight(viewer) : null; } catch { gate = null; }
  if (!gate || typeof gate.sql !== "string") gate = { sql: "0=1", args: [] };
  const args = Array.isArray(gate.args) ? gate.args : [];
  const one = (sql, ...a) => { for (const r of sqlOf(record).exec(sql, ...a)) return r; return null; };
  const sighted = new Map();
  const visible = (id) => {
    if (!sighted.has(id)) sighted.set(id, !!one(`SELECT 1 AS x FROM bundles b WHERE b.bundle_id=? AND (${gate.sql})`, id, ...args));
    return sighted.get(id);
  };
  const { page, ...answer } = await record.auditPass({ after, limit, visible });
  void page;
  const total = one(`SELECT COUNT(*) AS n FROM bundles b WHERE (${gate.sql})`, ...args);
  return { ...answer, total: total ? Number(total.n) : 0 };
}
