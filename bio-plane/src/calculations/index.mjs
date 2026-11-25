/* calculations — numbers a finding can rest on (requirements: `build/requirements/calculations.md`; T33-41; K1447,
 * K1448, K1468, K1471, K1491). A calculation (`CALC-`) is computed only by `calc-grammar`'s closed recipe grammar
 * (`bio-calc/1`) over declared canonical tables, money facts, cited figures and counts over the record, with its
 * denominators, grade facts and method, stored under its result key and recomputed at acceptance, at publication and
 * in the checker, never on a read (R8). It holds the tables (R1–R3), the money ingest writer (R14), the recorded draw
 * (R18) with the spot-check visits to its items and the estimate over them (R38–R40), fact-based rankings (R17), the patterns of application a member measures (R32–R37, `./application.mjs`:
 * never the machine's, never "Noticed") and the machine's patterns (R22, R23, `./patterns.mjs`), held in the hypothesis
 * layer and shown only after a measured false-alarm rate. A total is a `CALC-` and is never re-entered as a money fact
 * (R13); `compare` yields a labelled computed fact, never a verdict (R5, R27).
 *
 * REACHED as `calculationsOf(host, deps)`: one instance per host, created on the first call with `deps`. At creation
 * it creates its tables, declares them (R29) and registers with the upstream modules `deps` names (R11, R19, R20).
 * `deps`:
 *   record, membership, content, provenance   the modules it uses directly, through their factories on the same host
 *                unless a test passes its own.
 *   money, duties, people, events, progressions, standards, entities, retrieval   the layer-5 modules it reads and
 *                registers with, each an object or a function answering one (reached lazily; absent ones answer
 *                undetermined where a read needs them). They are reached through `deps`, never imported, so this
 *                module reads them only through their public services.
 *                Since T35: `events.usesOf` and `readEvent` (R32's frozen uses and their sight), `standards`' `standardRead`,
 *                `inForceAt`, `isMeasure(id, viewer)`, `bindsAt` and `forcesOf` (R34–R36), and `entities.readEntity` (R32's kinds).
 *   registry     `connection-grammar`'s registry (default: the one the plane wires): the owners' `neighbours`, one hop,
 *                for R32's relationships, passed this module's host.
 *   combine      `jurisdictions.combine` (default): the active profiles' view, for fiscal periods, business days and
 *                id spaces.
 *   now          the module's clock, an ISO instant (default: the wall clock).
 *
 * No place is named here (R28): fiscal years, zones, closures and id spaces are profile data. No refusal here has a
 * catalogue row yet (T34 stamps T33's new rows): each answers `{ok: false, reason, detail}`. */

import { canonicalJson, sha256HexSync, isHypothesisId, isMachineIdentity, idPattern } from "../record-grammar/index.mjs";
import { checkRecipe, evaluate as evaluateRecipe, resultKey, METHOD, parseFigure, draw as drawFrame, interval, divide,
  multiply, RATIO_DEFAULT } from "../calc-grammar/index.mjs";
import { validAt, fiscalPeriod, isCalendarDate, localDay, reasonText } from "../civil-time/index.mjs";
import { recognise } from "../idspaces.mjs";
import { recordOf } from "../record-core/index.mjs";
import { membershipOf, listenerRefusal, notAnAdmin, MODULE_ORDER, viewerPredicate, Membership } from "../membership/index.mjs";
import { contentOf, canonicalExtent, checkContentExtent } from "../content/index.mjs";
import { provenanceOf } from "../provenance/index.mjs";
import { combine as combineProfiles, SPACES } from "../../../jurisdictions/index.mjs";
import { CALCULATIONS_TABLES, migrateCalculations } from "./schema.mjs";
import { TABLE_MAX_BYTES, TABLE_MAX_CELLS, MONEY_ROLES, scanCsv, shaOf, schemaFault, readHeader, rolesFault,
  vintageFault, tableBuilder, textTable } from "./tables.mjs";
import { PATTERNS, GATE_MAX_RATE, runPattern } from "./patterns.mjs";
import { defaultRegistry } from "../connection-grammar/index.mjs";
import { delimiterSignature, encodingSignature } from "../csv-reader/index.mjs";
import { statement } from "../read-bounds.mjs";
import { USES_FIELDS, USES_HEADER, NONE_HELD, tieOf, foldReason, APPLICATION_RECIPES, APPLICATION_KINDS, composeApplication,
  answerApplication } from "./application.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { readAmount, fiscalKeyOf } from "./money-cells.mjs";

export { CALCULATIONS_SCHEMA, CALCULATIONS_TABLES } from "./schema.mjs";
export { ROLES, MONEY_ROLES, KEY_ROLES, ROSTER_ROLES, CROSSWALK_ROLES, TABLE_MAX_BYTES, TABLE_MAX_CELLS, parseCsv,
  canonicalCsv } from "./tables.mjs";
export { PATTERNS, GATE_MAX_RATE } from "./patterns.mjs";
export { USES_FIELDS, USES_HEADER, TIES, NONE_HELD, APPLICATION_RECIPES, APPLICATION_KINDS, foldReason } from "./application.mjs";

/** R4: the kinds of calculation. */
export const CALCULATION_KINDS = Object.freeze(["count", "total", "share", "ratio", "difference", "comparison", "span",
  "unit_cost", "budget_against_actuals", "ranking", "estimate", ...APPLICATION_KINDS]);
/** R8: a calculation's recompute status. */
export const RECOMPUTE_STATES = Object.freeze(["unchecked", "agrees", "differs", "stale"]);
/** R14: the machine's stamp on the money facts the ingest writer records at a member's request (DEC-52). */
export const INGEST_STAMP = "class:daemon";
/** R14 (K1573): the method a machine-written money fact names, money R3's "a figure read by a machine carries that method". */
export const INGEST_METHOD = "table_binding";
/** R9 (N676, K1799): the engine named for a value a spreadsheet file computed, when the file records none (office-readers
 *  reads no application), and the engines whose agreement is recorded as measured: none yet. */
export const FILE_ENGINE = word("calculations.file_spreadsheet_program");
export const MEASURED_ENGINES = Object.freeze([]);
/** R9: the mark of an input whose cells could not be read to say whether an engine computed them (a failed or truncated
 *  `content.cellsAt`): an explicit undetermined engine, never null. */
const UNDETERMINED_ENGINE = Object.freeze({ name: "undetermined", version: null });
/** R9: the derivation step a third-party engine's value takes (K1447 (ii); strength R36). */
export const ENGINE_STEP = "third-party engine";
/** R32: the most uses one frozen table holds (R1's cell bound over its sixteen columns). */
export const USES_MAX = Math.floor(TABLE_MAX_CELLS / USES_FIELDS.length);
/** R11: the cause each listener is told. */
export const INPUT_CHANGED = "calculation_input_changed";
/** R18 (T36): the most characters a draw's question holds. */
export const QUESTION_MAX = 2000;
/** R38: a visit's finding against its draw's question. */
export const VISIT_FINDINGS = Object.freeze(["yes", "no", "could_not_tell"]);
/** R39: a drawn item's standing over its visits. */
export const STANDINGS = Object.freeze(["yes", "no", "disagree", "could_not_tell", "not_visited"]);
/** R40: what the interval over visits assumes, stated with every estimate over a draw that carries a question. */
export const VISIT_ASSUMPTION = word("calculations.interval_treats_judged");
/** R40: the canonical table an estimate over visits is computed over, one row per drawn item (R9: its bytes). */
const STANDING_FIELDS = Object.freeze([{ name: "item", type: "string" }, { name: "standing", type: "string" }, { name: "visits", type: "number" }]);

/** R17 (K1471, K1473): words naming a judgment, never a measured quantity a ranking may order by. */
const JUDGMENT_WORDS = /\b(score|importance|important|suspicion|suspicious|significance|significant|severity|severe|risk|centrality|central|most connected|influence|influential|ranking score)\b/i;
/** R17: fields naming a kind of link: a measure over rows of more than one is a measure across mixed kinds. */
const LINK_KIND_FIELDS = Object.freeze(["kind", "link_kind", "relation", "relation_kind"]);
const GRADES = Object.freeze(["A", "B", "C", "D"]);
const TESTIMONY = "D";
const SHA = /^[0-9a-f]{64}$/;
const BARE_HANDLE = /^[A-Za-z0-9._-]{1,128}$/;   /* a member id spelled bare, as `testify` stamps an author (K5131) */
const CALC_RE = idPattern("CALC");
const MONEY_RE = idPattern("MNY");
const READ_LIMIT_MAX = 1000;
const BUILT_IN_KINDS = Object.freeze(["count", "total", "share", "ratio", "difference"]);   /* R4 (K5131): kinds that compose a default recipe */
const TABLE_CACHE_CHARS = 24 * 1024 * 1024;   /* the held tables' text kept at hand, at most (R1: one 20 MiB table fits) */
/** R14 (G45): a value of an ingest's record (`rows`, `written`, `not_written`) stays in `calc_ingests` while its UTF-8 length is at most
 *  this; above it the column holds the marker `{parts, bytes, count}` and the text is in `calc_ingest_parts`, in chunks of at most
 *  `INGEST_CHUNK` characters (768 KiB of UTF-8), so no bound value passes the platform's single-value limit. */
export const INGEST_INLINE_MAX = 524288;
export const INGEST_CHUNK = 256 * 1024;
/** R14: the most characters of an ingest's stated reason (a protective bound; the statement's sum stays under the platform's). */
export const INGEST_REASON_MAX = 2000;
/** R14 (G45): the most rows one act reads, set by measure (the largest count whose act survives the object's memory at the real shape:
 *  100,000 rows survive, 150,000 do not; a protective bound, K1881). Above it the act is refused INGEST_TOO_LARGE before any fact is written. */
export const INGEST_ROWS_MAX = 100000;
/** R14 (G55): the most party resolutions one ingest act keeps (the cache dies with the act; a protective bound on its memory, the act's
 *  heap being the platform's: a payer past it is looked up each time, as before). */
export const INGEST_CACHE_MAX = 10000;
/** R14 (G55, K4562): an act over this many rows is ingested in the background, in slices; at or under it the act runs whole and answers whole. */
export const INGEST_INLINE_ROWS = 10000;
/** R14 (G55): one slice judges at most this many rows, or writes at most INGEST_SLICE_FACTS facts, whichever comes first (counts, never time:
 *  the object's clock is frozen). A slice is one transaction. */
export const INGEST_SLICE_ROWS = 20000;
export const INGEST_SLICE_FACTS = 2000;
/** R14 (G55): consecutive failed slices after which the ingest is stopped. */
export const INGEST_MAX_ATTEMPTS = 3;
const INGEST_PART_ITEMS = 1000;   /* items in one stored piece of a background ingest's lists */
const DELIMITER_WINDOW_CHARS = 1 << 20;   /* G64: the head of a CSV source its delimiter is judged from, as the document's own reader judges (csv-reader's window) */
const READ_ON_MAX = 10000;   /* R1 (G123f): the most windows one range is read in (every one advances `next_row`, so a range ends long before it) */
const TEXT_CHUNK = 512 * 1024;   /* characters per row of calc_table_bytes, under a Durable Object row's 2 MB */

const str = (v) => (typeof v === "string" ? v.trim() : "");
const plain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const json = (v) => (v === undefined ? null : JSON.stringify(v));
const parse = (s) => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };
const sha = (v) => sha256HexSync(canonicalJson(v));
/* G45: chunks of at most `size` characters that never split a surrogate pair (a lone surrogate bound as text is stored as U+FFFD) */
function chunksOf(text, size = INGEST_CHUNK) {
  const out = [];
  for (let i = 0; i < text.length;) {
    let end = Math.min(i + size, text.length);
    if (end < text.length) { const c = text.charCodeAt(end); if (c >= 0xdc00 && c <= 0xdfff) end--; }
    out.push(text.slice(i, end));
    i = end;
  }
  return out;
}
/* G45: what one value of an ingest's record binds: its JSON in the column while at most INGEST_INLINE_MAX bytes (as before), else a marker and chunks */
function ingestStored(kind, value) {
  const text = JSON.stringify(value);
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes <= INGEST_INLINE_MAX) return { kind, column: text, chunks: [] };
  const chunks = chunksOf(text);
  return { kind, column: JSON.stringify({ parts: chunks.length, bytes, count: Array.isArray(value) ? value.length : 1 }), chunks };
}
const no = (reason, detail, extra = {}) => ({ ok: false, reason, detail, ...extra });
const weaker = (a, b) => (GRADES.indexOf(a) >= GRADES.indexOf(b) ? a : b);
const isGrade = (g) => GRADES.includes(g);
const randomSeed = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");

/** The member a stamp names, under membership's one spelling of a viewer (its R43; R41): `member:<id>` names `<id>`,
 *  and the founder's viewer, spelled bare `admin` or `member:admin`, names the founder whichever spelling it carries
 *  (`viewerPredicate` answers member null for the bare spelling, so the founder's arm is read here too); a machine
 *  identity, or a stamp R43 refuses, names no member: null. */
export function memberOf(stamp) {
  const p = viewerPredicate(stamp);
  if (p.member) return p.member;
  return stamp === Membership.ROOT_ADMIN ? Membership.ROOT_ADMIN : null;
}
/* K5131: the member a stamp names in a comparison of authors: `testify` stamps a testimony's author as the bare handle (`bob`), which names member
   `bob` as `member:bob` does; a machine identity (it carries a colon) is no handle. Sight (`memberOf`) stays closed to a bare handle. */
const stampMember = (stamp) => memberOf(stamp) ?? (typeof stamp === "string" && BARE_HANDLE.test(stamp) && !isMachineIdentity(stamp) ? stamp : null);
/** R41: whether two stamps name the one same member (a machine, or no member, matches nothing). */
const sameMember = (a, b) => { const m = stampMember(a); return m !== null && m === stampMember(b); };
const isMachine = (by) => typeof by === "string" && isMachineIdentity(by);
const stamped = (by) => typeof by === "string" && by.trim() !== "";

/* R4: a period is `{from, to}`, each a date or null, not both null; or a stated period key (such as a fiscal year). */
function periodOf(p) {
  if (typeof p === "string" && p.trim() && p.length <= 100) return { key: p.trim() };
  if (!plain(p)) return null;
  const from = p.from ?? null, to = p.to ?? null;
  if (from === null && to === null) return null;
  for (const d of [from, to]) if (d !== null && !(typeof d === "string" && isCalendarDate(d))) return null;
  if (from && to && to < from) return null;
  return { from, to };
}

/* Every string inside a value, for the hypothesis test (K1467): an input or threshold naming a hypothesis anywhere. */
function stringsIn(v, out = []) {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => stringsIn(x, out));
  else if (plain(v)) Object.values(v).forEach((x) => stringsIn(x, out));
  return out;
}

/* The figure a money fact states, as calc-grammar holds one. */
function figureOfFact(f) {
  if (plain(f.amount) && typeof f.amount.value === "string") {
    const g = { ...f.amount };
    delete g.as_read;
    if (!g.currency && f.currency) g.currency = f.currency;
    return g;
  }
  if (plain(f.amount) && typeof f.amount.low === "string" && typeof f.amount.high === "string") {
    /* money holds a range unsigned with its sign apart (money Terms); calc-grammar's range bounds are signed */
    const neg = f.sign === "-";
    const s = (d) => (neg && !/^0+(\.0+)?$/.test(d) ? `-${d}` : d);
    return { low: neg ? s(f.amount.high) : f.amount.low, high: neg ? s(f.amount.low) : f.amount.high, sign: neg ? "-" : "+", precision: "range",
      ...(f.currency && { currency: f.currency }) };
  }
  const raw = typeof f.amount === "string" ? f.amount.trim() : typeof f.amount === "number" && Number.isSafeInteger(f.amount) ? String(f.amount) : null;
  if (raw === null) return null;
  if (f.precision === "range" && plain(f.range)) return { low: String(f.range.low), high: String(f.range.high), sign: f.sign || "+", precision: "range", ...(f.currency && { currency: f.currency }) };
  const neg = raw.startsWith("-");
  const value = neg ? raw.slice(1) : raw;
  if (!/^\d+(?:\.\d+)?$/.test(value)) return null;
  return { value, sign: f.sign === "-" || neg ? "-" : "+", precision: f.precision || "exact", ...(f.currency && { currency: f.currency }) };
}

/* R14: a period as money takes one (its Terms): `from/to` dates as a day-precision range, else a fiscal key the
   profile maps (money R1's BAD_PERIOD when it cannot). */
function moneyPeriod(v) {
  const t = typeof v === "string" ? v.trim() : "";
  const m = /^(\d{4}-\d{2}-\d{2})\s*\/\s*(\d{4}-\d{2}-\d{2})?$/.exec(t);
  if (m) return { from: m[1], to: m[2] ?? null, precision: "day" };
  const fy = fiscalKeyOf(t);   /* R49: a fiscal-year label names its year */
  return fy ? { fiscal: fy.key } : t ? { fiscal: t } : null;
}

const partyEntity = (p) => (plain(p) ? (p.entity ?? null) : null);
const partyFund = (p) => (plain(p) ? (p.fund ?? null) : null);

/* The step names that sum their source, and the table each sums. */
function summedTables(recipe) {
  const out = [];
  for (const st of recipe.steps || []) {
    if (!plain(st)) continue;
    if (st.op === "sum") out.push({ step: st.as, from: st.from });
    if (st.op === "share" && st.field !== undefined) out.push({ step: st.as, from: st.whole });
    if (st.op === "group" && plain(st.measure) && st.measure.op === "sum") out.push({ step: st.as, from: st.from });
  }
  return out;
}

/* The inputs each name in a recipe rests on, through its steps. */
function lineage(recipe) {
  const roots = new Map();
  for (const inp of recipe.inputs || []) if (plain(inp)) roots.set(inp.name, new Set([inp.name]));
  const of = (n) => roots.get(n) || new Set();
  for (const st of recipe.steps || []) {
    if (!plain(st) || typeof st.as !== "string") continue;
    const refs = ["from", "a", "b", "numerator", "denominator", "part", "whole", "of", "left", "right"]
      .map((k) => st[k]).filter((x) => typeof x === "string");
    if (plain(st.crosswalk) && typeof st.crosswalk.input === "string") refs.push(st.crosswalk.input);
    roots.set(st.as, new Set(refs.flatMap((r) => [...of(r)])));
  }
  return of;
}

/* R4 (K1734): a table calc-grammar answers streamed (`{fields, rows}`, `rows` a function answering arrays of cells in
   `fields` order, its R22) as the same table of row objects; any other value as it is. */
function rowObjects(v) {
  if (!plain(v) || !Array.isArray(v.fields) || typeof v.rows !== "function") return v;
  const names = v.fields.map((f) => f.name);
  const rows = [];
  for (const row of v.rows()) {
    const o = {};
    for (let k = 0; k < names.length; k++) o[names[k]] = row[k];
    rows.push(o);
  }
  return { fields: v.fields, rows };
}

/* The first path at which two results differ, for CALC_RECOMPUTE_DIFFERS (R8). */
function firstDifference(a, b, path = "results") {
  if (canonicalJson(a ?? null) === canonicalJson(b ?? null)) return null;
  if (plain(a) && plain(b)) {
    for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      const d = firstDifference(a[k], b[k], `${path}.${k}`);
      if (d) return d;
    }
  }
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
    for (let i = 0; i < a.length; i++) { const d = firstDifference(a[i], b[i], `${path}[${i}]`); if (d) return d; }
  }
  return { path, stored: a ?? null, recomputed: b ?? null };
}

/* R39: a drawn item's standing over its visits' findings: `yes` or `no` when those finding yes or no all agree (a
   could_not_tell beside them not counting against them), `disagree` when they find both (both kept, never picked,
   U115), `could_not_tell` when every visit finds that, `not_visited` when there is none. */
function standingOf(findings) {
  const yes = findings.includes("yes"), nay = findings.includes("no");
  if (yes && nay) return "disagree";
  if (yes) return "yes";
  if (nay) return "no";
  return findings.length ? "could_not_tell" : "not_visited";
}

/* R38, R39: a visit as it is answered: its visitor, the testimony's observed_at, the instant it was recorded, its grade
   the testimony's (D), never stronger. */
const visitAnswer = (v) => ({ visit: v.seq, item: v.item, finding: v.finding, testimony: v.testimony, exhibits: parse(v.exhibits_json) || [],
  visitor: v.visitor, observed_at: v.observed_at ?? null, recorded_at: v.recorded_at, grade: TESTIMONY });

/* R40: the recipe of an estimate over visits, over the draw input `name` (one row per drawn item with its standing):
   the share of judged items found yes, with its denominator, and the items that could not be judged, each counted by
   its reason. Only calc-grammar computes (R25). */
function visitRecipe(name) {
  const apart = ["could_not_tell", "disagree", "not_visited"].flatMap((s) => [
    { op: "select", from: name, where: [{ field: "standing", test: "eq", value: s }], as: `${s}_items` },
    { op: "count", from: `${s}_items`, as: s }]);
  return { method: METHOD, inputs: [{ name, kind: "table" }], steps: [
    { op: "select", from: name, where: [{ field: "standing", test: "in", value: ["yes", "no"] }], as: "judged_items" },
    { op: "select", from: "judged_items", where: [{ field: "standing", test: "eq", value: "yes" }], as: "yes_items" },
    { op: "share", part: "yes_items", whole: "judged_items", as: "share_judged" }, ...apart], output: "share_judged" };
}

/* R1, R45: where a typed cell sits: its row and column (1-based), from its address (`source.cell`, or `source`), else its own `row` and `col`. */
function cellPosition(c) {
  const m = /^([A-Z]+)(\d+)$/.exec(String((plain(c) ? (plain(c.source) ? c.source.cell : c.source) : null) ?? "").replace(/\$/g, "").toUpperCase());
  return { r: m ? Number(m[2]) : (plain(c) ? c.row ?? 0 : 0), col: m ? [...m[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) : (plain(c) ? c.col ?? 0 : 0) };
}

/* R45: the box a range or cell extent names, `{r0, r1, c0, c1}` (1-based, inclusive, corners in either order), or null when it names none. */
function extentBox(row) {
  let e = row && row.extent;
  if (typeof e === "string") { try { e = JSON.parse(e); } catch { e = null; } }
  const ref = plain(e) ? (typeof e.range === "string" ? e.range : typeof e.cell === "string" ? e.cell : null) : null;
  const m = ref && /^\$?([A-Za-z]{1,3})\$?(\d+)(?::\$?([A-Za-z]{1,3})\$?(\d+))?$/.exec(ref.trim());
  if (!m) return null;
  const col = (l) => [...l.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  const [ca, ra, cb, rb] = [col(m[1]), Number(m[2]), m[3] ? col(m[3]) : col(m[1]), m[4] ? Number(m[4]) : Number(m[2])];
  return { r0: Math.min(ra, rb), r1: Math.max(ra, rb), c0: Math.min(ca, cb), c1: Math.max(ca, cb) };
}

/* G64: the head of a CSV source's text the delimiter is judged from: the BOM dropped, a source that ends without a line end given one (the
   signature counts complete lines only), a longer one cut at the window. */
function delimiterWindow(text) {
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  return s.length > DELIMITER_WINDOW_CHARS ? s.slice(0, DELIMITER_WINDOW_CHARS) : s.endsWith("\n") ? s : `${s}\n`;
}

/* R45 (fix round 10, cause 19): a reading's own text of a spreadsheet or an ODS is its cells joined by a tab (`odf.mjs`, `formats-xlsx.mjs`), so
   the tab is its delimiter whatever commas its cells hold ($69,268.31): a tab on the majority of the window's lines. */
function tabJoined(window) {
  let lines = 0, tabbed = 0;
  for (const l of window.split("\n")) { if (l.trim() === "") continue; lines++; if (l.includes("\t")) tabbed++; }
  return tabbed > 0 && tabbed * 2 > lines;
}

export class Calculations {
  #inputListeners = [];     // R11: {module, fn}
  #patternListeners = [];   // R23: {module, fn}
  #tableCache = new Map();  // sha → held table (`textTable`), the last few read, within TABLE_CACHE_CHARS
  #ingestListeners = [];    // R14 (G55): {module, fn}, told when an ingest starts
  #engines = new Map();     // content id → the engine mark `#engineFor` last made (R9); the synchronous reads (R19, R30) read it

  constructor({ storage, record, membership, content, provenance, combine = combineProfiles, now = null,
                clock = null, host = null, registry = defaultRegistry, ...upstream } = {}) {
    this.storage = storage;
    this.host = host;
    this.registry = registry;
    this.sql = storage.sql;
    this.record = record;
    this.membership = membership;
    this.content = content;
    this.provenance = provenance;
    this.combine = combine;
    this.upstream = upstream;
    this.now = typeof now === "function" ? now : () => new Date().toISOString();
    this.clock = typeof clock === "function" ? clock : () => Date.now();
    migrateCalculations(this.sql);
  }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }
  /** An upstream module named in `deps`: the object, or what its function answers; null when absent. */
  dep(name) {
    const d = this.upstream[name];
    try { return typeof d === "function" ? d() || null : d || null; } catch { return null; }
  }

  /* The active profiles' combined view, or null (R28: every local fact is profile data). */
  #view() {
    try {
      const ids = this.record.getSetting("jurisdiction_profiles");
      if (!Array.isArray(ids) || !ids.length) return null;
      const c = this.combine(ids);
      return c && c.ok ? c.view : null;
    } catch { return null; }
  }

  /* May `viewer` see the bundle? A machine stamp sees every held bundle (membership R43); a null bundle is group-wide. */
  #sees(bundleId, viewer) {
    if (bundleId === null || bundleId === undefined || bundleId === "") return stamped(viewer) && (isMachine(viewer) || memberOf(viewer) !== null);
    try { return this.content.sees(bundleId, viewer); } catch { return false; }
  }

  /* R10, R32: may `viewer` see a held table (a row of calc_tables): its source's bundle, and for a frozen uses table
     every event it holds, as `events` answers them (a machine stamp sees every held one). Synchronous. */
  #seesTable(r, viewer) {
    if (!r || !this.#sees(r.bundle_id, viewer)) return false;
    const u = this.#one(`SELECT ids_json FROM calc_uses WHERE sha=?`, r.sha);
    if (!u || isMachine(viewer)) return true;
    const events = this.dep("events");
    if (!events || typeof events.readEvent !== "function") return false;
    for (const id of parse(u.ids_json) || []) {
      let e = null;
      try { e = events.readEvent({ eventId: id, viewer }); } catch { e = null; }
      if (!e || typeof e.then === "function" || e.ok === false || e.found === false) return false;
    }
    return true;
  }

  /* R9 (N676, K1799): the third-party engine that computed a content row's value: a sheet range or cell any of whose
     cells is a formula, its value the file's cached result (content R52). `{name, version}` or null. */
  async #engineFor(row) {
    if (!row || (row.extent_kind !== "sheet-range" && row.extent_kind !== "sheet-cell")) return null;
    let formula = false;
    const read = await this.#readCells(row.content_id, (cells) => {
      if (!formula && cells.some((c) => plain(c) && typeof c.formula === "string" && c.formula !== "")) formula = true;
    });
    /* R9: a read that failed, or stopped at `cells_truncated` that it could not follow to the range's end by `next_row` (R1), is undetermined;
       an answer that holds no cells states no engine */
    const engine = !read.ok && read.kind !== "answer" ? UNDETERMINED_ENGINE : !read.ok || !formula ? null : { name: FILE_ENGINE, version: null };
    this.#engines.set(row.content_id, engine);
    return engine;
  }

  /* R1 (G123f): the cells of a held sheet's range as `content.cellsAt` answers them, window after window: each window's cells are handed to
     `onCells`; an answer `cells_truncated` with a `next_row` is followed by asking again from that row (`cellsAt(id, {fromRow})`), until the
     provider answers the range whole. `{ok: true}`, or `{ok: false, kind, got}`: `kind` "answer" for a first answer that holds no cells (`got` its
     reason), "thrown" for a call that failed, "truncated" for a range the provider could not finish (no `next_row`, a `next_row` that does
     not advance, a window that starts before it, a later window that holds no answer). Never loops: every continuation advances `next_row`. */
  async #readCells(contentId, onCells) {
    let from = null, last = null;
    for (let calls = 0; calls < READ_ON_MAX; calls++) {
      let got = null;
      try { got = from === null ? await this.content.cellsAt(contentId) : await this.content.cellsAt(contentId, { fromRow: from }); }
      catch { return { ok: false, kind: "thrown", got: "unread" }; }
      const truncated = !!got && (got.cells_truncated === true || got.reason === "cells_truncated");
      const next = got && Number.isInteger(got.next_row) ? got.next_row : null;
      const cells = got && Array.isArray(got.cells) ? got.cells : null;
      if (!truncated && !cells) return { ok: false, kind: from === null ? "answer" : "truncated", got: got && typeof got.reason === "string" ? got.reason : "unread" };
      if (truncated && (!cells || next === null || (last !== null && next <= last) || (from !== null && next <= from))) return { ok: false, kind: "truncated", got: "cells_truncated" };
      if (cells) {
        /* a window that starts before the row it was asked from is the provider ignoring the argument, not a continuation */
        if (from !== null && cells.some((c) => cellPosition(c).r < from)) return { ok: false, kind: "truncated", got: "cells_truncated" };
        onCells(cells);
      }
      if (!truncated) return { ok: true };
      last = next; from = next;
    }
    return { ok: false, kind: "truncated", got: "cells_truncated" };
  }

  /* The same mark for the synchronous reads (R19, R30), which cannot wait on `content.cellsAt`: what the last
     asynchronous entry that graded this row made; a sheet row not yet made is undetermined, never null. */
  #engineOf(row) {
    if (!row || (row.extent_kind !== "sheet-range" && row.extent_kind !== "sheet-cell")) return null;
    return this.#engines.has(row.content_id) ? this.#engines.get(row.content_id) : UNDETERMINED_ENGINE;
  }

  /* R9: a figure input's mark as the create stored it (the synchronous reads, R19 and R30, read it; an object restart
     loses nothing): the explicit undetermined engine for a row stored before, until a read makes it. */
  #figureEngine(calcId, inp) {
    const r = this.#one(`SELECT engine_json FROM calc_inputs WHERE calc_id=? AND input_name=? AND ref=?`, calcId, inp.name, inp.figure);
    if (!r || r.engine_json == null) return UNDETERMINED_ENGINE;
    const m = parse(r.engine_json);
    return m && m.name === UNDETERMINED_ENGINE.name ? UNDETERMINED_ENGINE : m && typeof m.name === "string" ? { name: m.name, version: m.version ?? null } : null;
  }

  /* Make the marks of a calculation's inputs (a figure's row; a table whose source records none) before a grade is read. */
  async #warmEngines(c) {
    for (const inp of parse(c.inputs_json) || []) {
      if (!plain(inp)) continue;
      if (inp.figure !== undefined) {
        const row = this.content.contentRow(inp.figure);
        const mark = await this.#engineFor(row);
        /* R-OLD: a row stored before holds no mark, or an undetermined one a failed cellsAt made: written now */
        const have = this.#one(`SELECT engine_json FROM calc_inputs WHERE calc_id=? AND input_name=? AND ref=?`, c.calc_id, inp.name, inp.figure);
        const stored = have && have.engine_json != null ? parse(have.engine_json) : undefined;
        const mine = row ? json(mark ?? null) : null;
        if (have && mine !== null && (stored === undefined || (stored && stored.name === UNDETERMINED_ENGINE.name && mark !== UNDETERMINED_ENGINE)))
          this.sql.exec(`UPDATE calc_inputs SET engine_json=? WHERE calc_id=? AND input_name=? AND ref=?`, mine, c.calc_id, inp.name, inp.figure);
      }
      else if (inp.table !== undefined) await this.#warmTable(this.#one(`SELECT sha, source_json FROM calc_tables WHERE sha=?`, inp.table));
      else if (inp.calculation !== undefined) {
        const o = this.#one(`SELECT * FROM calculations WHERE calc_id=?`, inp.calculation);
        if (o) await this.#warmEngines(o);
      }
    }
  }

  async #warmTable(r) {
    const src = r ? parse(r.source_json) || {} : {};
    if (src.kind !== "uses" && src.engine === undefined && src.content_id) await this.#engineFor(this.content.contentRow(src.content_id));
  }

  /* R9: a grade with its engine marks: a value a third-party engine computed is undetermined until that engine's
     agreement is recorded as measured, the derivation step "third-party engine"; every other input `engine: null`. */
  #withEngine(g, engine) {
    if (!engine) return { ...g, engine: null, engine_measured: null };
    if (engine === UNDETERMINED_ENGINE)
      return { grade: null, why: localize("calculations.index.its_cells_could_not_be", "its cells could not be read to say whether a third-party engine computed them, so its grade is undetermined"),
        engine: UNDETERMINED_ENGINE.name, engine_measured: false, derivation_step: ENGINE_STEP };
    const name = engine.version ? `${engine.name} ${engine.version}` : engine.name;
    const measured = MEASURED_ENGINES.includes(name);
    if (measured) return { ...g, engine: name, engine_measured: true, derivation_step: ENGINE_STEP };
    return { grade: null, why: localize("calculations.index.its_values_were_computed_by", "its values were computed by a third-party engine ({name}) whose agreement is not recorded as measured, so its grade is undetermined (K1447 (ii)){v1}", { name: String(name), v1: g.grade ? word("calculations.why.capture_alone_reads", { grade: String(g.grade) }) : "" }),
      engine: name, engine_measured: false, derivation_step: ENGINE_STEP };
  }

  /* R9, R32: a frozen uses table's grade: each row's its event's governing attestation's, the table's the weakest. */
  #usesGrade(tableSha) {
    const u = this.#one(`SELECT ids_json FROM calc_uses WHERE sha=?`, tableSha);
    const events = this.dep("events");
    if (!u || !events) return { grade: null, why: word("calculations.why.frozen_uses_readable") };
    let weakest = null;
    for (const id of parse(u.ids_json) || []) {
      let e = null;
      try { e = events.readEvent({ eventId: id, viewer: INGEST_STAMP }); } catch { e = null; }
      const ev = e && e.found !== false && e.ok !== false && typeof e.then !== "function" ? e.event || e : null;
      const gov = ev && ev.governing != null ? (ev.attestations || []).find((a) => Number(a.attestation_id) === Number(ev.governing)) : null;
      if (!gov || !isGrade(gov.grade)) return { grade: null, why: word("calculations.why.undetermined_event_governing", { id: String(id), ev: String(ev ? "" : " readable here") }) };
      weakest = weakest ? weaker(weakest, gov.grade) : gov.grade;
    }
    return weakest ? { grade: weakest, why: word("calculations.why.weakest_events_governing", { weakest: String(weakest) }) } : { grade: null, why: word("calculations.why.holds_event") };
  }

  /* R9: a held table's grade facts: its source extent's capture grade capped by its derivation, with its engine marks;
     a frozen uses table's from its events (R32). */
  #tableGrade(r) {
    const src = parse(r && r.source_json) || {};
    if (src.kind === "uses") return this.#withEngine(this.#usesGrade(r.sha), null);
    const crow = src.content_id ? this.content.contentRow(src.content_id) : null;
    const g = crow ? this.#contentGrade(crow) : { grade: null, why: word("calculations.why.table_source_held") };
    return this.#withEngine(g, src.engine !== undefined ? src.engine : this.#engineOf(crow));
  }

  /* ===================================================================== *
   * TABLES (R1–R3)
   * ===================================================================== */

  /* R44: whether a capture is a CSV file, as its provenance profile or its reading records (content's container format). */
  #isCsv(captureSha) {
    try {
      const c = this.content.contentContextFor(captureSha);
      return !!c && !!c.container && c.container.format === "csv";
    } catch { return false; }
  }

  /* R1: the source's rows: a sheet range's typed cells, a passage's text read as CSV, or a whole document's bytes. */
  async #sourceRows(row, names = null) {
    if (row.extent_kind === "sheet-range" || row.extent_kind === "sheet-cell") {
      /* R1 (G123f): the range is read window after window to its end (`#readCells`); a range that cannot be finished is refused, never a short table.
         R45 (G131d): the cells are folded as they arrive into rows by their address, then the rows are made over the whole box the range names
         (its first row and column to the last cell held), so a column or a row that holds no cell keeps its place and nothing closes up. */
      const byRow = new Map();
      let formula = false, held = 0, minRow = Infinity, maxRow = 0, minCol = Infinity, maxCol = 0, tooMany = false;
      const read = await this.#readCells(row.content_id, (cells) => {
        for (const c of cells) {
          const { r, col } = cellPosition(c);
          if (!byRow.has(r)) byRow.set(r, new Map());
          byRow.get(r).set(col, c.value === null || c.value === undefined ? "" : String(c.value));
          if (r < minRow) minRow = r;
          if (r > maxRow) maxRow = r;
          if (col < minCol) minCol = col;
          if (col > maxCol) maxCol = col;
          if (plain(c) && typeof c.formula === "string" && c.formula !== "") formula = true;
        }
        held += cells.length;
        if (held > TABLE_MAX_CELLS) tooMany = true;
      });
      if (tooMany) return { tooLarge: { bound: "cells", max: TABLE_MAX_CELLS, got: held } };
      if (!read.ok) return { fault: read.kind === "truncated" && held > 0
        ? localize("calculations.index.the_range_could_not_be_read_whole", "the range's cells were read to row {row} and the rest could not be read, and a table is never made from part of a range", { row: String(maxRow) })
        : word("calculations.range_cells_held", { got: String(read.got) }) };
      const box = extentBox(row);
      const r0 = Math.min(box ? box.r0 : Infinity, minRow), c0 = Math.min(box ? box.c0 : Infinity, minCol);
      const cellAt = (r, c) => { const m = byRow.get(r); return m ? m.get(c) ?? "" : ""; };
      /* R47 (G182): the header row is found by the declared names: the first row of the range that holds some cell and holds every declared name
         once; the columns are then the named ones, so an empty leading column or an unnamed one shifts nothing, and a value in an unnamed
         column is handed on past the header's width (the builder refuses it). With no such row the range is read over its whole box, as R45. */
      let top = null, cols = null;
      const hit = (r, name) => { const h = []; for (let c = c0; c <= maxCol; c++) if (cellAt(r, c).trim() === name) h.push(c); return h; };
      for (let r = r0; r <= maxRow && cols === null; r++) {
        if (!byRow.has(r)) continue;
        if (top === null && [...byRow.get(r).values()].some((v) => v.trim() !== "")) top = r;
        if (!names) continue;
        const found = names.map((n) => hit(r, n));
        if (found.every((h) => h.length === 1) && new Set(found.flat()).size === names.length) { cols = found.map((h) => h[0]); top = r; }
      }
      const named = cols ? new Set(cols) : null;
      let dataFrom = r0, headerRow = null;
      if (cols) { dataFrom = top + 1; headerRow = top; }
      else if (top !== null && names && names.length === maxCol - c0 + 1 && names.every((h, k) => cellAt(top, c0 + k).trim() === h)) { dataFrom = top + 1; headerRow = top; }
      function* rows() {
        for (let r = dataFrom; r <= maxRow; r++) {
          const out = cols ? cols.map((c) => cellAt(r, c)) : new Array(maxCol - c0 + 1);
          if (!cols) for (let k = 0; k < out.length; k++) out[k] = cellAt(r, c0 + k);
          else for (let c = c0; c <= maxCol; c++) if (!named.has(c) && cellAt(r, c).trim() !== "") out.push(cellAt(r, c));
          yield out;
        }
      }
      /* R9: a range any of whose cells is a formula holds values a third-party engine computed */
      return { rows: held ? rows() : [], bytes: null, engine: formula ? { name: FILE_ENGINE, version: null } : null, sheet: { header_row: headerRow, first_row: dataFrom }, headerSeen: headerRow !== null };
    }
    /* G101 (R44): a CSV document is the file's own stored bytes, never the reading's index (blocks that repeat the header, caps), so the
       table's sha is the file's: a CSV whose bytes are not held is refused, stated, never made from the index. */
    const csv = row.extent_kind === "document" && this.#isCsv(row.capture_sha);
    let text = null;
    if (!csv) { try { text = this.content.passageText(row.content_id); } catch { text = null; } }
    const own = typeof text === "string";   /* the reading's own text, not the file's bytes (R45, cause 19) */
    if (typeof text !== "string" && row.extent_kind === "document") {
      const stored = await this.#storedText(row.capture_sha);
      if (stored.tooLarge) return { tooLarge: stored.tooLarge };
      if (stored.transient)
        return { transient: true, fault: localize("calculations.index.the_files_own_bytes_could", "the file's own bytes could not be read just now, and the file is held; ask again in a moment") };
      text = stored.text;
    }
    if (typeof text !== "string")
      return { fault: csv ? localize("calculations.index.the_csv_files_own_bytes", "the CSV file's own bytes are not held, and a table is made from the file, never from the index of its reading") : word("calculations.source_text_held") };
    if (text.length > TABLE_MAX_BYTES * 2) return { tooLarge: { bound: "bytes", max: TABLE_MAX_BYTES, got: text.length } };
    return { text, own };
  }

  /* R1 (R44; fix round 9, G131d follow-up, K4850): a document's stored bytes as text. `{text}`; `{text: null}` for a file that is not held (the store
     answers none and its head names none); `{transient: true}` for a read that threw, or answered none for a file whose head says it is held: a
     transient failure is never stated as absence. R-LOG: a line before the read and one after, carrying the sha, which of the two it was
     and the error's name, never the bytes. */
  async #storedText(captureSha) {
    const ev = this.record.evidenceStore();
    if (!ev) return { text: null };
    const log = (line) => { try { console.log(JSON.stringify({ event: "table_source_read", module: "calculations", sha: captureSha, ...line })); } catch { /* a log changes nothing */ } };
    log({ phase: "start" });
    /* R48 (G182; S-29): the size is judged before the bytes are loaded: the store's head (R2's, with its size), then the object's own size; a file
       over twice the table's bytes bound is refused with its size and the bound, its body never read */
    const over = (size) => (Number.isFinite(size) && size > TABLE_MAX_BYTES * 2 ? { text: null, tooLarge: { bound: "bytes", max: TABLE_MAX_BYTES, got: size } } : null);
    try { const h = typeof ev.head === "function" ? await ev.head(captureSha) : null; const o = over(h && h.size); if (o) { log({ phase: "end", outcome: "too_large", bytes: h.size }); return o; } } catch { /* the head is asked again below when the read finds nothing */ }
    let obj = null;
    try { obj = await ev.get(captureSha); }
    catch (e) { log({ phase: "end", outcome: "thrown", error: String((e && e.name) || "Error").slice(0, 80) }); return { text: null, transient: true }; }
    if (!obj) {
      let head = null, headFailed = false;
      try { head = typeof ev.head === "function" ? await ev.head(captureSha) : null; } catch { headFailed = true; }
      const held = !!head || headFailed;
      log({ phase: "end", outcome: held ? "null_but_held" : "null_not_held" });
      return held ? { text: null, transient: true } : { text: null };
    }
    const big = over(obj.size);
    if (big) { log({ phase: "end", outcome: "too_large", bytes: obj.size }); return big; }
    try {
      /* R48: decoded by the document's own encoding: the charset its stored type states, else the one its bytes show (csv-reader's signature),
         never UTF-8 alone */
      let text;
      if (typeof obj.arrayBuffer === "function") {
        const bytes = new Uint8Array(await obj.arrayBuffer());
        const stated = /charset\s*=\s*"?([A-Za-z0-9._:-]+)/i.exec(String((obj.httpMetadata && obj.httpMetadata.contentType) || ""));
        const label = stated ? stated[1] : (encodingSignature(bytes).encoding || "utf-8");
        let dec;
        try { dec = new TextDecoder(/^us-ascii$/i.test(label) ? "utf-8" : label); } catch { dec = new TextDecoder("utf-8"); }
        text = dec.decode(bytes);
      } else text = await obj.text();
      log({ phase: "end", outcome: "read", chars: text.length });
      return { text };
    } catch (e) { log({ phase: "end", outcome: "thrown", error: String((e && e.name) || "Error").slice(0, 80) }); return { text: null, transient: true }; }
  }

  /** R1–R3, R51: `declareTable({source, schema, header, roles?, vintage?, by})`. `source` is a content id (a CSV
   *  capture's document, a passage, a workbook range or a portal export), or a found passage `{capture_sha, extent}`
   *  nobody has cited yet, whose content row is minted as money's source is. Async: the bytes go to the evidence store. */
  async declareTable({ source = null, schema = null, header = null, roles = null, vintage = null, by = null } = {}) {
    if (!stamped(by) || isMachine(by))
      return no("MEMBER_ACT_ONLY", localize("calculations.index.a_table_is_declared_by", "a table is declared by a member; a machine may not declare one (K1468). Nothing was written."));
    let contentId = typeof source === "string" ? source.trim() : plain(source) ? str(source.content) : "";
    /* R51: a found passage, the shape every other recording act takes (money R2). Its content row is minted once the rest of the act is
       judged (below), so an act refused before the bytes are read mints nothing; here only its capture and extent are checked. */
    let found = null;
    if (!contentId && plain(source) && source.capture_sha !== undefined) {
      const sha = str(source.capture_sha).toLowerCase();
      const home = /^[0-9a-f]{64}$/.test(sha) && this.provenance ? this.provenance.homeOf(sha) : null;
      if (!home || !this.#sees(home.bundleId, by))
        return no("NO_SUCH_CONTENT", localize("calculations.declare.no_capture_is_held_here", "no capture is addressed by this sha in this record, or it is not one you may see. Nothing was written."), { capture_sha: sha });
      const extent = source.extent === undefined || source.extent === null ? { kind: "document" } : source.extent;
      const bad = plain(extent) ? checkContentExtent(extent, this.content.contentContextFor(sha, { searched: false })) : { code: "CONTENT_EXTENT_UNREADABLE" };
      if (bad) return no("NO_SUCH_CONTENT", localize("calculations.declare.the_found_passage_names_no", "the found passage names no part of that capture. Nothing was written."), { capture_sha: sha, extent_code: bad.code ?? null });
      found = { bundleId: home.bundleId, captureSha: sha, extent };
    } else if (!contentId) return no("NO_SOURCE", "a table names its captured source: the content id of a CSV, a workbook range or a portal export. Nothing was written.");
    const row0 = found ? null : this.content.contentRow(contentId);
    if (!found && (!row0 || !this.#sees(row0.bundle_id, by)))
      return no("NO_SUCH_CONTENT", "no content row is addressed by this id in this record, or it is not one you may see. Nothing was written.", { content_id: contentId });
    if (row0 && row0.stale) return no("CONTENT_STALE", "the passage was cited under an earlier reading of its document; cite it again under the current one. Nothing was written.", { content_id: contentId });
    const names = readHeader(header);
    if (!names) return no("NO_HEADER", "a table declares its header: a list of distinct, non-empty column names. Nothing was written.");
    const sf = schemaFault(schema, names);
    if (sf) return no("BAD_SCHEMA", `the schema does not describe the table${sf.field ? ` (field "${sf.field}")` : ""}: ${sf.why}. Nothing was written.`, { field: sf.field });
    const rf = rolesFault(roles, names);
    if (rf) return no("BAD_SCHEMA", `the roles do not fit the table (${rf.field}): ${rf.why}. Nothing was written.`, { field: rf.field });
    const vf = vintageFault(vintage);
    if (vf) return no("BAD_SCHEMA", `the vintage is not one this module holds: ${vf}. Nothing was written.`, { field: "vintage" });
    if (vintage && vintage.supersedes && !this.#one(`SELECT 1 AS x FROM calc_tables WHERE sha=?`, vintage.supersedes))
      return no("BAD_SCHEMA", "the table this vintage supersedes is not held. Nothing was written.", { field: "vintage.supersedes" });
    for (const [col, r] of Object.entries(roles || {})) {
      if (!r.crosswalk) continue;
      const cw = this.#one(`SELECT roles_json FROM calc_tables WHERE sha=?`, r.crosswalk.table);
      const cr = cw ? Object.entries(parse(cw.roles_json) || {}) : [];
      const has = (role, c) => cr.some(([k, v]) => k === c && v.role === role);
      if (!has("crosswalk_from", r.crosswalk.from) || !has("crosswalk_to", r.crosswalk.to))
        return no("BAD_SCHEMA", `the crosswalk "${col}" names is not a declared crosswalk with those two ends. Nothing was written.`, { field: col });
    }
    let row = row0;
    if (found) {
      const m = this.record.transact(() => this.content.mint({ ...found, mintedBy: by }));
      if (!m || m.ok === false || !m.content_id) return no("NO_SUCH_CONTENT", localize("calculations.declare.the_found_passage_names_no", "the found passage names no part of that capture. Nothing was written."), { capture_sha: found.captureSha });
      contentId = m.content_id;
      row = this.content.contentRow(contentId);
    }
    const src = await this.#sourceRows(row, names);
    if (src.tooLarge) return this.#tooLarge(src.tooLarge);
    if (src.fault) return no("SOURCE_NOT_READ", `${src.fault}. Nothing was written.`, { content_id: contentId, ...(src.transient ? { transient: true } : {}) });
    const tb = tableBuilder(names, schema.fields, { headerSeen: !!src.headerSeen });
    if (src.rows) for (const r of src.rows) tb.push(r);
    else {
      /* G64 (R1): the delimiter is the document's own reader's (csv-reader's signature over the head of the text): a comma, semicolon, tab
         or pipe; none found reads as a comma, as before. The canonical bytes stay comma RFC 4180, so one table has one sha. */
      const win = delimiterWindow(src.text);
      const sig = delimiterSignature(win);
      /* R45 (cause 19): a reading's own tab-joined text is cut at tabs; any other text whose delimiter is tied is refused, never read as a comma */
      const tab = src.own && tabJoined(win);
      if (!tab && !sig.delimiter && sig.undetermined === "delimiter_undetermined_tied" && names.length > 1)
        return no("SOURCE_NOT_READ", localize("calculations.index.the_delimiter_is_tied", "the source's delimiter could not be told ({tied} fit its lines equally), so it is not read as a table. Nothing was written.", { tied: sig.tied.join(", ") }),
          { content_id: contentId, delimiter: null, tied: sig.tied, columns_expected: names.length });
      const delimiter = tab ? "\t" : sig.delimiter || ",";
      let widest = 0;
      const sc = scanCsv(src.text, (r) => { if (r.length > widest) widest = r.length; tb.push(r); }, delimiter);
      src.text = null;
      if (sc.error) return no("SOURCE_NOT_READ", `the source does not read as CSV: ${sc.error}. Nothing was written.`, { content_id: contentId });
      /* a source no line of which splits into the declared columns under any delimiter found (one cell per line, or every line short) would be
         held as a table of undetermined cells, accepted silently; it is refused instead. A short row among full ones is R45's, padded. */
      const delimiterName = tab ? "tab" : sig.name ?? null;
      if (names.length > 1 && widest === 1)
        return no("SOURCE_NOT_READ", localize("calculations.index.the_source_reads_as_one", "the source reads as one cell per line (delimiter found: {delimiter}), and the declared header has {columns} columns; check the file's separator or the header you declared. Nothing was written.", { delimiter: String(delimiterName || "none"), columns: String(names.length) }),
          { content_id: contentId, delimiter: delimiterName, columns_expected: names.length });
      if (names.length > 1 && widest < names.length)
        return no("SOURCE_NOT_READ", localize("calculations.index.no_line_splits_into", "no line of the source splits into the {columns} declared columns (delimiter found: {delimiter}; the widest line has {widest}); check the file's separator or the header you declared. Nothing was written.", { delimiter: String(delimiterName || "none"), columns: String(names.length), widest: String(widest) }),
          { content_id: contentId, delimiter: delimiterName, columns_expected: names.length });
    }
    const built = tb.finish();
    if (built.fault) return no("BAD_SCHEMA", `the source does not fit the declared header: ${built.fault.why}. Nothing was written.`, { field: built.fault.field });
    if (built.tooLarge) return this.#tooLarge(built.tooLarge);
    const bytes = built.bytes;
    const tableSha = built.sha;
    const held = this.#one(`SELECT sha, roles_json, schema_json FROM calc_tables WHERE sha=?`, tableSha);
    if (held) {
      /* R1 (K5148): the key is the bytes; a declaration of held bytes with other roles or schema replaces the held ones and says so, facts
         already written staying. Roles left out ask for no change. */
      const replaced = [];
      if (roles && canonicalJson(parse(held.roles_json)) !== canonicalJson(roles)) replaced.push("roles");
      if (canonicalJson(parse(held.schema_json)) !== canonicalJson(schema)) replaced.push("schema");
      if (!replaced.length) return { ok: true, already: true, ...this.#tableAnswer(this.#one(`SELECT * FROM calc_tables WHERE sha=?`, tableSha)) };
      const out = this.record.transact(() => {
        this.sql.exec(`UPDATE calc_tables SET roles_json=?, schema_json=?, undetermined_json=?, undetermined_count=? WHERE sha=?`,
          roles ? json(roles) : held.roles_json, json(schema), json(built.undetermined), built.count, tableSha);
        if (replaced.includes("schema")) this.#stale(tableSha, "table_replaced");
        return { ok: true };
      });
      if (!out.ok) return out;
      this.#tableCache.delete(tableSha);   /* its typed rows were read under the schema just replaced */
      return { ok: true, replaced, ...this.#tableAnswer(this.#one(`SELECT * FROM calc_tables WHERE sha=?`, tableSha)) };
    }
    const ev = this.record.evidenceStore();
    if (!ev) return no("NO_EVIDENCE_STORE", localize("calculations.index.your_teams_civicsmith_has_no", "your team's Civicsmith has no evidence store set up, so a table's bytes cannot be held. Nothing was written."));
    try { await ev.put(tableSha, bytes); } catch (e) { return no("EVIDENCE_WRITE_FAILED", `the table's bytes could not be stored: ${String(e && e.message || e).slice(0, 200)}. Nothing was written.`); }
    const at = this.now();
    const superseded = vintage && vintage.supersedes ? vintage.supersedes : null;
    const out = this.record.transact(() => {
      this.sql.exec(`INSERT INTO calc_tables (sha, bundle_id, source_json, schema_json, header_json, roles_json, vintage_key,
                       vintage_json, superseded_by, rows, bytes, undetermined_json, undetermined_count, declared_by, declared_at)
                     VALUES (?,?,?,?,?,?,?,?,NULL,?,?,?,?,?,?)`,
        tableSha, row.bundle_id ?? null, json({ content_id: contentId, capture_sha: row.capture_sha, extent_kind: row.extent_kind, engine: src.engine ?? null, ...(src.sheet ? src.sheet : {}) }),
        json(schema), json(names), roles ? json(roles) : null, vintage ? vintage.key.trim() : null, vintage ? json(vintage) : null,
        built.rows, bytes.byteLength, json(built.undetermined), built.count, by, at);
      this.#putChunks(tableSha, row.bundle_id ?? null, bytes);
      if (superseded) {
        this.sql.exec(`UPDATE calc_tables SET superseded_by=? WHERE sha=? AND superseded_by IS NULL`, tableSha, superseded);
        this.#stale(superseded, "table_superseded");
      }
      return { ok: true };
    });
    if (!out.ok) return out;
    return { ok: true, ...this.#tableAnswer(this.#one(`SELECT * FROM calc_tables WHERE sha=?`, tableSha)) };
  }

  /* R1, R46: `TABLE_TOO_LARGE` stating the size and the bound as `READ_BOUNDS` quotes them (`statement`): the cells bound names the cells, the bytes
     bound the bytes. `{bound, max, got}`: which bound the table broke, its figure and the size measured. */
  #tooLarge({ bound, got }) {
    const st = statement("table", bound === "cells" ? "cells" : "bytes", got);
    const text = bound === "cells"
      ? localize("calculations.index.table_over_cells_bound", "the table holds {size} cells, over the bound of {bound} cells. Nothing was written.", { size: String(st.size), bound: String(st.bound) })
      : localize("calculations.index.table_over_bytes_bound", "the table is {size} bytes, over the bound of {bound} bytes. Nothing was written.", { size: String(st.size), bound: String(st.bound) });
    return no("TABLE_TOO_LARGE", text, { bound: bound === "cells" ? "cells" : "bytes", max: st.bound, size: st.size, bound_key: st.key });
  }

  /* R48: the record's chunked copy of a table's canonical bytes, decoded a piece at a time (a piece at most TEXT_CHUNK bytes, so at most that many
     characters), never the whole text at once; `#heldTableSync` joins the pieces in order. */
  #putChunks(tableSha, bundleId, bytes) {
    const dec = new TextDecoder();
    for (let i = 0, k = 0; i < bytes.byteLength; i += TEXT_CHUNK) {
      const end = Math.min(bytes.byteLength, i + TEXT_CHUNK);
      const piece = dec.decode(bytes.subarray(i, end), { stream: end < bytes.byteLength });
      if (piece === "") continue;
      this.sql.exec(`INSERT INTO calc_table_bytes (sha, seq, bundle_id, chunk) VALUES (?,?,?,?)`, tableSha, k++, bundleId, piece);
    }
  }

  #tableAnswer(r) {
    return { sha: r.sha, source: parse(r.source_json), schema: parse(r.schema_json), header: parse(r.header_json),
      roles: parse(r.roles_json), vintage: parse(r.vintage_json), superseded_by: r.superseded_by ?? null, rows: r.rows,
      bytes: r.bytes, undetermined: { count: r.undetermined_count, cells: parse(r.undetermined_json) || [],
        why: word("calculations.why.cell_read_column") },
      declared_by: r.declared_by, declared_at: r.declared_at };
  }

  /* A held table from its canonical text (`textTable`: read row by row, never held as row objects), or null. */
  #fromText(tableSha, text) {
    const r = this.#one(`SELECT schema_json, rows FROM calc_tables WHERE sha=?`, tableSha);
    if (!r || typeof text !== "string" || shaOf(text) !== tableSha) return null;
    const t = textTable(parse(r.schema_json).fields, text, r.rows);
    this.#tableCache.set(tableSha, t);
    let chars = 0;
    for (const k of [...this.#tableCache.keys()].reverse()) {
      chars += this.#tableCache.get(k).text.length;
      if (chars > TABLE_CACHE_CHARS && k !== tableSha) this.#tableCache.delete(k);
    }
    return t;
  }

  /* A held table, synchronously: the cache, else the record's chunked copy of its canonical bytes. */
  #heldTableSync(tableSha) {
    if (this.#tableCache.has(tableSha)) {
      const t = this.#tableCache.get(tableSha);
      this.#tableCache.delete(tableSha); this.#tableCache.set(tableSha, t);
      return t;
    }
    const chunks = this.#rows(`SELECT chunk FROM calc_table_bytes WHERE sha=? ORDER BY seq`, tableSha);
    return chunks.length ? this.#fromText(tableSha, chunks.map((c) => c.chunk).join("")) : null;
  }

  /* A held table: synchronously when held so, else from the evidence store (its bytes, checked by their sha). */
  async #heldTable(tableSha) {
    const t = this.#heldTableSync(tableSha);
    if (t) return t;
    const ev = this.record.evidenceStore();
    let text = null;
    try {
      const obj = ev ? await ev.get(tableSha) : null;
      if (obj) text = typeof obj.text === "function" ? await obj.text() : new TextDecoder().decode(await obj.arrayBuffer());
    } catch { text = null; }
    return this.#fromText(tableSha, text);
  }

  /** R1, R48: `readTable({sha, viewer, limit?, after?, rows?})`: the table's declaration and a page of its rows, only that page read (the rest of its
   *  text is scanned past, never built into rows). `table.rows` holds the page's rows as objects; `rows: "all"` asks for every row there, as a caller
   *  that binds the whole table (`workbooks`) does. A table whose source the viewer may not see answers as an absent one. */
  async readTable({ sha: tableSha = null, viewer = null, limit = 100, after = 0, rows: want = null } = {}) {
    if (!str(tableSha)) return no("NO_TABLE", "a table is read by its sha256.");
    const r = this.#one(`SELECT * FROM calc_tables WHERE sha=?`, str(tableSha));
    if (!r || !this.#seesTable(r, viewer)) return { ok: true, found: false, sha: str(tableSha) };
    const lim = Math.max(1, Math.min(READ_LIMIT_MAX, Number.isInteger(Number(limit)) ? Number(limit) : 100));
    const from = Math.max(0, Number.isInteger(Number(after)) ? Number(after) : 0);
    const t = await this.#heldTable(r.sha);
    const header = parse(r.header_json);
    const all = want === "all";
    const asked = t ? (all ? t.page(0, Number.MAX_SAFE_INTEGER) : t.page(from, lim)) : null;
    const rows = asked ? (all ? asked : asked).map((row) => Object.fromEntries(header.map((h, k) => [h, row[k]]))) : null;
    const src = parse(r.source_json);
    const crow = src ? this.content.contentRow(src.content_id) : null;
    let cg = null;
    try { cg = crow ? this.provenance.captureGrade(crow.capture_sha) : null; } catch { cg = null; }
    await this.#warmTable(r);
    const g = this.#tableGrade(r);
    return { ok: true, found: true, ...this.#tableAnswer(r),
      table: { sha: r.sha, fields: parse(r.schema_json).fields, rows,
        grade_facts: { capture_grade: cg && isGrade(cg.grade) ? cg.grade : null, derivation: crow && isGrade(crow.derivation_cap) ? crow.derivation_cap : null,
          grade: g.grade, why: g.why, engine: g.engine, engine_measured: g.engine_measured, ...(g.derivation_step ? { derivation_step: g.derivation_step } : {}) } },
      page: t ? { after: from, limit: lim, rows: all ? asked.slice(from, from + lim) : asked, truncated: from + lim < r.rows } : { rows: null, why: word("calculations.why.table_bytes_held") } };
  }

  /** R3: `tablesAt({key, at, viewer})`: the vintage under `key` valid at `at` (`civil-time.validAt`), or undetermined
   *  with the reason; never the latest by default. */
  tablesAt({ key = null, at = null, viewer = null } = {}) {
    if (!str(key)) return no("NO_KEY", "name the vintage key the tables were declared under.");
    if (!(typeof at === "string" && isCalendarDate(at))) return no("NO_DATE", "name the date, YYYY-MM-DD.");
    const view = this.#view();
    const rows = this.#rows(`SELECT * FROM calc_tables WHERE vintage_key=? ORDER BY sha`, str(key)).filter((r) => this.#seesTable(r, viewer));
    if (!rows.length) return { ok: true, key: str(key), at, state: "undetermined", table: null, why: word("calculations.why.table_held_key", { key: String(str(key)) }) };
    const judged = rows.map((r) => {
      const v = parse(r.vintage_json);
      let a;
      try { a = validAt({ valid: { from: v.valid.from ?? null, to: v.valid.to ?? null, precision: "day", zone: "UTC" }, basis: v.basis ?? null }, { value: at, precision: "day", zone: "UTC" }, { view }); }
      catch (e) { a = { undetermined: true, why: String(e && e.message || e) }; }
      return { sha: r.sha, valid: v.valid, superseded_by: r.superseded_by ?? null, answer: a };
    });
    const inside = judged.filter((j) => j.answer === "in");
    const open = judged.filter((j) => j.answer !== "in" && j.answer !== "out");
    const listed = judged.map((j) => ({ sha: j.sha, valid: j.valid, superseded_by: j.superseded_by, at: typeof j.answer === "string" ? j.answer : "undetermined", ...(typeof j.answer === "string" ? {} : { why: j.answer.why }) }));
    if (inside.length === 1 && !open.length) return { ok: true, key: str(key), at, state: "determined", table: inside[0].sha, vintages: listed };
    const why = inside.length > 1 ? word("calculations.vintages_valid_none", { inside: String(inside.length), at: String(at) })
      : open.length ? word("calculations.whether_valid_undetermined", { open: String(open.map((j) => j.sha.slice(0, 12)).join(", ")), open_2: String(open.length > 1 ? "were" : "was"), at: String(at), open_3: String(open.map((j) => reasonText(j.answer.why ?? "")).join("; ")) })
      : word("calculations.vintage_valid", { key: String(str(key)), at: String(at) });
    return { ok: true, key: str(key), at, state: "undetermined", table: null, why, vintages: listed };
  }

  /* ===================================================================== *
   * BINDING INPUTS (R4, R5, R9, R10, R12)
   * ===================================================================== */

  /* The money facts named, read for `viewer`, as a calc-grammar table: one row per fact not withdrawn. */
  async #moneyInput(ids, viewer, missing) {
    const money = this.dep("money");
    const view = this.#view();
    const facts = [], withdrawn = [];
    for (const id of ids) {
      let f = null;
      try { f = money ? await money.readFact({ factId: id, viewer }) : null; } catch { f = null; }
      const fact = f && f.ok !== false && f.found !== false ? (f.fact || f) : null;
      if (!fact || !fact.fact_id && !fact.factId) { missing(id); continue; }
      if (fact.withdrawn) { withdrawn.push({ fact_id: id, why: "withdrawn, so never counted (money R7)" }); continue; }
      facts.push({ ...fact, fact_id: fact.fact_id ?? fact.factId });
    }
    const currencies = [...new Set(facts.map((f) => f.currency).filter(Boolean))];
    const fiscal = (f) => {
      const p = f.period;
      const from = plain(p) ? (typeof p.from === "string" ? p.from.slice(0, 10) : plain(p.from) ? String(p.from.value).slice(0, 10) : null) : null;
      if (!view || !from || !isCalendarDate(from)) return "";
      const body = partyEntity(f.from) || "*";
      try { const r = fiscalPeriod({ date: from, body, view }); return r && r.label ? r.label : ""; } catch { return ""; }
    };
    const periodText = (p) => (plain(p) ? `${plain(p.from) ? p.from.value : p.from ?? ""}/${plain(p.to) ? p.to.value : p.to ?? ""}` : String(p ?? ""));
    const buys = (f) => (plain(f.buys) ? f.buys : null);
    const table = {
      fields: [{ name: "fact_id", type: "string" },
        { name: "amount", type: "number", ...(currencies.length === 1 && { currency: currencies[0] }) },
        { name: "currency", type: "string" }, { name: "kind", type: "string" }, { name: "phase", type: "string" },
        { name: "stage", type: "string" }, { name: "basis", type: "string" }, { name: "period", type: "string" },
        { name: "fund", type: "string" }, { name: "payer", type: "string" }, { name: "payee", type: "string" },
        { name: "buys_quantity", type: "number" }, { name: "buys_unit", type: "string" },
        { name: "fiscal_period", type: "string" }],
      rows: facts.map((f) => ({
        fact_id: f.fact_id, amount: figureOfFact(f) ?? "", currency: f.currency ?? "", kind: f.kind ?? "",
        phase: f.phase ?? "", stage: f.stage ? `${f.phase}/${f.stage}` : (f.phase ?? ""), basis: f.basis ?? "",
        period: periodText(f.period), fund: partyFund(f.from) ?? partyFund(f.to) ?? "", payer: partyEntity(f.from) ?? "",
        payee: partyEntity(f.to) ?? "", buys_quantity: buys(f) && buys(f).quantity != null ? String(buys(f).quantity) : "",
        buys_unit: buys(f) && buys(f).unit ? String(buys(f).unit) : "", fiscal_period: fiscal(f) })),
    };
    const grade = facts.reduce((g, f) => {
      const r = plain(f.grade) ? f.grade.reading : f.grade;
      return isGrade(r) ? (g === null ? r : weaker(g, r)) : g === null ? undefined : g;
    }, null);
    /* R9: the money input's canonical bytes are the canonical JSON of this, as the calculation is computed over it */
    const held = { facts: facts.map((f) => ({ id: f.fact_id, amount: figureOfFact(f), currency: f.currency ?? null,
      kind: f.kind ?? null, phase: f.phase ?? null, stage: f.stage ?? null, basis: f.basis ?? null, period: f.period ?? null,
      buys: buys(f) })), withdrawn: withdrawn.map((w) => w.fact_id) };
    return { table, facts, withdrawn, held, grade: grade === undefined ? null : grade, currencies };
  }

  /* A content row's capture grade, capped by its derivation (K1447 (ii)). */
  #contentGrade(row) {
    let g = null, why = "";
    try { g = this.provenance.captureGrade(row.capture_sha); } catch { g = null; }
    const capture = g && isGrade(g.grade) ? g.grade : null;
    const cap = isGrade(row.derivation_cap) ? row.derivation_cap : null;
    if (!capture) return { grade: null, why: word("calculations.why.capture_grade_undetermined", { grade: String(g && g.why ? `: ${g.why}` : "") }) };
    const grade = cap ? weaker(capture, cap) : capture;
    why = cap && grade !== capture ? word("calculations.capture_capped_derivation", { capture: String(capture), cap: String(cap) }) : `capture ${capture}${cap ? `, its derivation capped at ${cap}` : ""}`;
    return { grade, why };
  }

  /* R4, R9: each input bound for `viewer`. `{ok: false}` with NO_SUCH_INPUT or HYPOTHESIS_NOT_A_FACT, or
     `{bound, hashes, canon, refs, inputs, apart}`: `hashes` each input's SHA-256 of its canonical bytes as it was
     computed over (a table's canonical CSV; else the canonical JSON `canon` holds, null where it cannot be rebuilt). */
  async #bind(inputs, viewer, { threshold = null, pending = null } = {}) {
    const KINDS = ["table", "money", "figure", "value", "calculation", "set", "draw"];
    const hyps = [];
    for (const inp of inputs) for (const s of stringsIn(inp)) if (isHypothesisId(s)) hyps.push(s);
    if (threshold) for (const s of stringsIn(threshold)) if (isHypothesisId(s)) hyps.push(s);
    const bound = {}, hashes = {}, canon = {}, refs = [], described = [], apart = { withdrawn: [], out_of_view: [] };
    const held = (name, v) => { canon[name] = canonicalJson(v); hashes[name] = sha256HexSync(canon[name]); };
    const names = new Set();
    let refused = null;
    const missing = (name, ref) => { if (!refused) refused = no("NO_SUCH_INPUT", `the input "${name}"${ref ? ` names ${ref}, which` : ""} is not held, or is not one you may see. Nothing was written.`, { input: name, ...(ref ? { ref } : {}) }); };
    for (const inp of inputs) {
      if (refused) break;
      if (!plain(inp) || typeof inp.name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(inp.name)) { missing(plain(inp) && typeof inp.name === "string" ? inp.name : "(unnamed)"); break; }
      const kinds = KINDS.filter((k) => inp[k] !== undefined);
      if (kinds.length !== 1 || names.has(inp.name)) { missing(inp.name); break; }
      names.add(inp.name);
      const kind = kinds[0], ref = inp[kind];
      if (stringsIn(ref).some(isHypothesisId)) { described.push({ name: inp.name, kind, ref, hypothesis: true }); continue; }
      if (kind === "table") {
        const r = typeof ref === "string" ? this.#one(`SELECT sha, bundle_id, source_json, roles_json FROM calc_tables WHERE sha=?`, ref) : null;
        if (!r || !this.#seesTable(r, viewer)) { missing(inp.name, String(ref)); break; }
        const t = await this.#heldTable(r.sha);
        if (!t) { missing(inp.name, r.sha); break; }
        await this.#warmTable(r);
        const g = this.#tableGrade(r);
        /* R1, R4: bound as calc-grammar's streamed table (its R22), its bytes the table's own canonical CSV */
        bound[inp.name] = t.streamed(); hashes[inp.name] = r.sha; refs.push({ name: inp.name, kind, ref: r.sha });
        described.push({ name: inp.name, kind, ref: r.sha, grade: g.grade, why: g.why, roles: parse(r.roles_json), source: parse(r.source_json) });
      } else if (kind === "money") {
        const ids = Array.isArray(ref) ? ref : [ref];
        if (!ids.length || !ids.every((x) => typeof x === "string" && MONEY_RE.test(x))) { missing(inp.name, ids.join(", ")); break; }
        let first = null;
        const m = await this.#moneyInput(ids, viewer, (id) => { first = first || id; });
        if (first) { missing(inp.name, first); break; }
        bound[inp.name] = m.table; held(inp.name, m.held);
        for (const id of ids) refs.push({ name: inp.name, kind, ref: id });
        apart.withdrawn.push(...m.withdrawn.map((w) => ({ input: inp.name, ...w })));
        described.push({ name: inp.name, kind, ref: ids, facts: m.facts.map((f) => f.fact_id), grade: m.grade,
          why: m.grade ? word("calculations.why.weakest_reading_grade", { grade: String(m.grade) }) : word("calculations.why.money_fact_states") });
      } else if (kind === "figure") {
        const row = typeof ref === "string" ? this.content.contentRow(ref) : null;
        if (!row || !this.#sees(row.bundle_id, viewer)) { missing(inp.name, String(ref)); break; }
        let text = null;
        if (row.extent_kind === "sheet-cell") { let c = null; try { c = await this.content.cellsAt(ref); } catch { c = null; } text = c && !c.cells_truncated && Array.isArray(c.cells) && c.cells.length === 1 ? String(c.cells[0].value ?? "") : null; }
        else { try { text = this.content.passageText(ref); } catch { text = null; } }
        const mark = await this.#engineFor(row);
        const f = typeof text === "string" ? parseFigure(text) : { refused: "FIGURE_INVALID", why: word("calculations.why.passage_text_held") };
        if (f.refused) { refused = no("FIGURE_NOT_READ", `the input "${inp.name}" cites a passage that does not read as one figure: ${f.why}. Nothing was written.`, { input: inp.name, ref }); break; }
        const fig = { ...f }; delete fig.as_read;
        const g = this.#contentGrade(row);
        bound[inp.name] = fig; held(inp.name, { content: ref, figure: fig }); refs.push({ name: inp.name, kind, ref, engine: mark });
        described.push({ name: inp.name, kind, ref, as_read: f.as_read, grade: g.grade, why: g.why });
      } else if (kind === "value") {
        const f = typeof ref === "string" ? parseFigure(ref) : { refused: "FIGURE_INVALID", why: word("calculations.why.typed_figure_text") };
        if (f.refused) { refused = no("FIGURE_NOT_READ", `the input "${inp.name}" is not a figure: ${f.why}. Nothing was written.`, { input: inp.name }); break; }
        const fig = { ...f }; delete fig.as_read;
        bound[inp.name] = fig; held(inp.name, { value: fig });
        described.push({ name: inp.name, kind, ref, as_read: f.as_read, grade: TESTIMONY, unbound: true,
          why: word("calculations.why.figure_typed_cited") });
      } else if (kind === "calculation") {
        const c = typeof ref === "string" && CALC_RE.test(ref) ? this.#one(`SELECT * FROM calculations WHERE calc_id=?`, ref) : null;
        if (!c || !this.#visible(c, viewer)) { missing(inp.name, String(ref)); break; }
        const out = parse(c.results_json);
        const v = out ? out.output : null;
        let b = null;
        if (plain(v) && Array.isArray(v.fields) && Array.isArray(v.rows)) b = v;
        else if (plain(v) && plain(v.value) && v.numerator !== undefined) b = v.value;
        else if (plain(v) && (typeof v.value === "string" || typeof v.low === "string" || v.undetermined)) b = v;
        if (!b) { refused = no("FIGURE_NOT_READ", `the calculation "${ref}" answers no figure or table an input can take. Nothing was written.`, { input: inp.name, ref }); break; }
        await this.#warmEngines(c);
        const axis = this.#gradeFacts(c);
        /* its bytes: the canonical JSON its result key is the SHA-256 of (calc-grammar R15), from its own inputs' hashes */
        const pre = parse(c.input_shas_json);
        const text = pre ? canonicalJson({ recipe: parse(c.recipe_json), inputs: pre, method_version: c.method_version }) : null;
        bound[inp.name] = b; hashes[inp.name] = c.result_key; canon[inp.name] = text && sha256HexSync(text) === c.result_key ? text : null;
        refs.push({ name: inp.name, kind, ref });
        described.push({ name: inp.name, kind, ref, grade: axis.capture.grade, why: word("calculations.why.capture_axis", { why: String(axis.capture.why) }) });
      } else if (kind === "set") {
        const s = typeof ref === "string" ? this.#one(`SELECT * FROM calc_sets WHERE set_sha=?`, ref) || (pending && pending.get(ref)) || null : null;
        if (!s || !this.#sees(s.project, viewer)) { missing(inp.name, String(ref)); break; }
        const ids = parse(s.ids_json) || [];
        const seen = ids.filter((id) => this.#sees(id, viewer));
        if (seen.length !== ids.length) apart.out_of_view.push({ input: inp.name, count: ids.length - seen.length, why: word("calculations.why.members_frozen_set") });
        bound[inp.name] = { fields: [{ name: "id", type: "string" }], rows: seen.map((id) => ({ id })) };
        held(inp.name, ids);
        if (hashes[inp.name] !== s.set_sha) { hashes[inp.name] = s.set_sha; canon[inp.name] = null; }
        refs.push({ name: inp.name, kind, ref: s.set_sha });
        described.push({ name: inp.name, kind, ref: s.set_sha, n: ids.length, grade: null, not_graded: true,
          why: word("calculations.why.frozen_set_record") });
      } else {
        const d = typeof ref === "string" ? this.#one(`SELECT * FROM calc_draws WHERE draw_key=?`, ref) : null;
        if (!d || !this.#sees(d.project, viewer)) { missing(inp.name, String(ref)); break; }
        if (d.question !== null && d.question !== undefined) {
          /* R40: a draw that carries a question is bound as its visits stand, one row per drawn item with its standing,
             its bytes that table's canonical CSV; a visit the viewer may not see withholds it whole (R10, R39) */
          if (!this.#seesDraw(d, viewer)) { missing(inp.name, String(ref)); break; }
          const st = this.#standingTable(d);
          bound[inp.name] = st.table; hashes[inp.name] = st.sha; canon[inp.name] = st.text;
          refs.push({ name: inp.name, kind, ref: d.draw_key });
          described.push({ name: inp.name, kind, ref: d.draw_key, draw: { frame_size: d.frame_size, n: d.n, seed: d.seed, method: d.method, set: d.set_sha, question: d.question },
            grade: TESTIMONY, why: "its items are judged by members' visits, each testimony (D), and nothing raises it (R40)" });
          continue;
        }
        const sample = parse(d.sample_json) || [];
        let table;
        if (d.set_kind === "table") {
          const r = this.#one(`SELECT sha, bundle_id FROM calc_tables WHERE sha=?`, d.set_sha);
          const t = r && this.#seesTable(r, viewer) ? await this.#heldTable(d.set_sha) : null;
          if (!t) { missing(inp.name, d.set_sha); break; }
          const at = new Map(sample.map((k) => [Number(k), null]));
          let i = 0;
          for (const o of t.objects()) { if (at.has(i)) at.set(i, o); i++; }
          table = { fields: t.fields, rows: sample.map((k) => at.get(Number(k))).filter(Boolean) };
        } else {
          const seen = sample.filter((id) => this.#sees(id, viewer));
          if (seen.length !== sample.length) apart.out_of_view.push({ input: inp.name, count: sample.length - seen.length, why: word("calculations.why.drawn_members_view") });
          table = { fields: [{ name: "id", type: "string" }], rows: seen.map((id) => ({ id })) };
        }
        bound[inp.name] = table; held(inp.name, { set: d.set_sha, kind: d.set_kind, seed: d.seed, n: d.n, method: d.method });
        if (hashes[inp.name] !== d.draw_key) { hashes[inp.name] = d.draw_key; canon[inp.name] = null; }
        refs.push({ name: inp.name, kind, ref: d.draw_key });
        described.push({ name: inp.name, kind, ref: d.draw_key, draw: { frame_size: d.frame_size, n: d.n, seed: d.seed, method: d.method, set: d.set_sha, question: null },
          grade: null, not_graded: true, why: word("calculations.why.recorded_draw_graded") });
      }
    }
    if (refused) return refused;
    if (hyps.length) return no("HYPOTHESIS_NOT_A_FACT", localize("calculations.index.v1_is_a_hypothesis_hunches", "\"{v1}\" is a hypothesis: hunches and hypotheses are held in the working inquiry and are never a calculation's input or threshold (K1467). Nothing was written.", { v1: String(hyps[0]) }), { hypothesis: hyps[0] });
    return { ok: true, bound, hashes, canon, refs, inputs: described, apart };
  }

  /* R6: the threshold, as a figure bound under the name `threshold`, with its standing. */
  #threshold(threshold, period, viewer) {
    if (threshold === null || threshold === undefined) return { ok: true, figure: null };
    if (!plain(threshold)) return no("BAD_THRESHOLD", "a threshold is {value} or {standard, figure?, portion?}. Nothing was written.");
    let fig = null, as_read = null, grade = null, contentRef = null;
    if (typeof threshold.value === "string") {
      const f = parseFigure(threshold.value);
      if (f.refused) return no("BAD_THRESHOLD", `the threshold is not a figure: ${f.why}. Nothing was written.`);
      fig = { ...f }; delete fig.as_read; as_read = f.as_read; grade = TESTIMONY;
    }
    if (typeof threshold.figure === "string") {
      const row = this.content.contentRow(threshold.figure);
      if (!row || !this.#sees(row.bundle_id, viewer)) return no("BAD_THRESHOLD", "the threshold's cited figure is not held, or is not one you may see. Nothing was written.");
      let text = null;
      try { text = this.content.passageText(threshold.figure); } catch { text = null; }
      const f = typeof text === "string" ? parseFigure(text) : { refused: "FIGURE_INVALID", why: word("calculations.why.text_held") };
      if (f.refused) return no("BAD_THRESHOLD", `the threshold's cited passage is not one figure: ${f.why}. Nothing was written.`);
      fig = { ...f }; delete fig.as_read; as_read = f.as_read; contentRef = threshold.figure; grade = this.#contentGrade(row).grade;
    }
    let standing = null;
    if (threshold.standard !== undefined) {
      const standards = this.dep("standards");
      const dates = period.key ? [] : [period.from, period.to].filter(Boolean);
      if (!standards || typeof standards.inForceAt !== "function" || !dates.length)
        standing = { state: "undetermined", why: !dates.length ? word("calculations.why.calculation_period_key") : word("calculations.why.standards_module_reachable_whether") };
      else {
        const answers = dates.map((date) => { try { return standards.inForceAt({ standard: threshold.standard, ...(threshold.portion ? { portion: threshold.portion } : {}), date, viewer }); } catch (e) { return { state: "undetermined", why: String(e && e.message || e) }; } });
        const refused = answers.find((a) => a && a.ok === false);
        if (refused) return no(refused.reason || "NO_SUCH_STANDARD", `the standard cited as the threshold is not one held that you may see: ${refused.detail || refused.why || "standards refused it"}. Nothing was written.`, { standard: threshold.standard });
        const notIn = answers.find((a) => a && a.state === "not_in_force");
        if (notIn) return no("THRESHOLD_NOT_IN_FORCE", `the standard cited as the threshold was not in force for the calculation's period: ${notIn.why}. Nothing was written.`, { standard: threshold.standard });
        const open = answers.find((a) => !a || a.state !== "in_force");
        standing = open ? { state: "undetermined", why: open && open.why ? open.why : word("calculations.why.standards_module_gave") }
          : { state: "in_force", why: answers.map((a) => a.why).filter(Boolean).join("; ") };
      }
    }
    if (!fig) return no("BAD_THRESHOLD", "a threshold states its figure: a value, or a cited figure of the standard. Nothing was written.");
    return { ok: true, figure: fig, held: { ...threshold, as_read, grade, content: contentRef, standing } };
  }

  /* R15: every join runs through an id space or a declared crosswalk. */
  #joinFault(recipe, described) {
    const tableInputs = new Map(described.filter((d) => d.kind === "table").map((d) => [d.name, d]));
    for (const st of Array.isArray(recipe.steps) ? recipe.steps : []) {
      if (!plain(st) || st.op !== "join") continue;
      if (typeof st.space === "string" && SPACES.includes(st.space) && st.crosswalk === undefined) continue;
      if (st.space === undefined && plain(st.crosswalk)) {
        const d = tableInputs.get(st.crosswalk.input);
        const roles = d && d.roles ? Object.entries(d.roles) : [];
        const end = (role, col) => roles.some(([c, r]) => c === col && r.role === role);
        if (d && end("crosswalk_from", st.crosswalk.left) && end("crosswalk_to", st.crosswalk.right)) continue;
      }
      return no("JOIN_NOT_BY_IDENTIFIER", localize("calculations.index.the_join_as_is_not", "the join \"{as}\" is not keyed through an id space ({SPACES}) or a captured crosswalk declared as one (its crosswalk_from and crosswalk_to columns); a join on a name alone is refused (K1452). Nothing was written.", { as: String(st.as), SPACES: String(SPACES.join(", ")) }), { step: st.as ?? null });
    }
    return null;
  }

  /* R16–R18: a kind's own conditions over the recipe and its inputs, and the recipe it composes when none is given. */
  #kindPlan(kind, recipe, terms, described, bound, { column = null, part = null } = {}) {
    if (!CALCULATION_KINDS.includes(kind)) return no("UNKNOWN_KIND", `a calculation's kind is one of ${CALCULATION_KINDS.join(", ")}. Nothing was written.`);
    const money = described.filter((d) => d.kind === "money");
    if (kind === "estimate") {
      const draws = described.filter((d) => d.kind === "draw");
      if (!draws.length)
        return no("ESTIMATE_WITHOUT_DRAW", localize("calculations.index.a_population_estimate_is_answered", "a population estimate is answered only over a recorded draw (a seeded draw over a frozen set), with its exact interval (K1448). Nothing was written."));
      const asked = draws.find((d) => d.draw.question !== null);
      if (asked) {
        /* R40: an estimate over visits runs its own recipe over the one draw whose items members visited */
        if (described.length !== 1)
          return no("ESTIMATE_INPUTS", "an estimate over visits takes one input: the draw, carrying its question, whose items members visited. Nothing was written.");
        const composed = visitRecipe(asked.name);
        if (recipe !== null && recipe !== undefined && canonicalJson(recipe) !== canonicalJson(composed))
          return no("RECIPE_NOT_TEMPLATE", "an estimate over visits runs the recipe composed over its draw's standings (the share of judged items found yes, and those not judged counted by their reason); the recipe given is not it. Nothing was written.");
        return { ok: true, recipe: composed, visits: { input: asked.name, draw: asked.draw } };
      }
    }
    if (kind === "unit_cost") {
      if (money.length !== 1) return no("NO_BUYS", "a unit cost is one money input's amount over what it buys. Nothing was written.");
      const t = bound[money[0].name];
      const units = [...new Set(t.rows.map((r) => r.buys_unit).filter(Boolean))];
      if (!t.rows.length || t.rows.some((r) => !r.buys_quantity || !r.buys_unit) || units.length !== 1)
        return no("NO_BUYS", "a unit cost needs every money fact to state what it buys, a quantity in one stated unit (money's `buys`). Nothing was written.");
      if (!recipe) recipe = { method: METHOD, inputs: [{ name: money[0].name, kind: "table" }],
        steps: [{ op: "sum", from: money[0].name, field: "amount", as: "cost" },
          { op: "sum", from: money[0].name, field: "buys_quantity", as: "quantity" },
          { op: "ratio", numerator: "cost", denominator: "quantity", as: "unit_cost" }], output: "unit_cost" };
      return { ok: true, recipe, unit: `${t.rows[0].currency || "amount"} per ${units[0]}` };
    }
    if (kind === "budget_against_actuals") {
      const a = money.find((d) => d.name === "adopted"), b = money.find((d) => d.name === "actual");
      if (!a || !b) return no("BUDGET_INPUTS", "budget against actuals takes two money inputs, named adopted and actual. Nothing was written.");
      for (const [d, phase] of [[a, "adopted"], [b, "actual"]]) {
        const phases = [...new Set(bound[d.name].rows.map((r) => r.phase))];
        if (phases.length !== 1 || phases[0] !== phase)
          return no("BUDGET_INPUTS", localize("calculations.index.the_input_name_holds_facts", "the input \"{name}\" holds facts of phase {v1}; it holds only {phase} facts (each total within one phase, R12). Nothing was written.", { name: String(d.name), v1: String(phases.join(", ") || "none"), phase: String(phase) }));
      }
      const periods = [...new Set([...bound.adopted.rows, ...bound.actual.rows].map((r) => r.fiscal_period).filter(Boolean))].sort();
      if (!periods.length) return no("BUDGET_INPUTS", "no fiscal period could be read for these facts from the profile's fiscal year. Nothing was written.");
      const bases = { adopted: [...new Set(bound.adopted.rows.map((r) => r.basis))], actual: [...new Set(bound.actual.rows.map((r) => r.basis))] };
      if (!recipe) {
        const steps = [];
        periods.forEach((p, i) => {
          steps.push({ op: "select", from: "adopted", where: [{ field: "fiscal_period", test: "eq", value: p }], as: `adopted_${i}` },
            { op: "sum", from: `adopted_${i}`, field: "amount", as: `adopted_total_${i}` },
            { op: "select", from: "actual", where: [{ field: "fiscal_period", test: "eq", value: p }], as: `actual_${i}` },
            { op: "sum", from: `actual_${i}`, field: "amount", as: `actual_total_${i}` },
            { op: "difference", a: `actual_total_${i}`, b: `adopted_total_${i}`, as: `difference_${i}` },
            { op: "compare", a: `actual_total_${i}`, b: `adopted_total_${i}`, as: `comparison_${i}` });
        });
        recipe = { method: METHOD, inputs: [{ name: "adopted", kind: "table" }, { name: "actual", kind: "table" }], steps,
          output: `comparison_${periods.length - 1}` };
      }
      return { ok: true, recipe, periods, bases };
    }
    if (kind === "ranking") {
      const q = terms ? terms.quantity : undefined;
      if (Array.isArray(q) && q.length > 1)
        return no("SCORE_NOT_A_FACT", localize("calculations.index.a_ranking_orders_by_one", "a ranking orders by one stated, measured quantity; several measures composed into one figure are refused (K1471, K1473). Nothing was written."));
      const quantity = Array.isArray(q) ? q[0] : q;
      if (!str(quantity) || !str(terms.scope) || !terms.period)
        return no("RANKING_TERMS", "a ranking names its quantity, its scope and its period in its terms. Nothing was written.");
      if (JUDGMENT_WORDS.test(String(quantity)))
        return no("SCORE_NOT_A_FACT", localize("calculations.index.the_quantity_named_stands_for", "the quantity named stands for a judgment, not a measured quantity; a figure standing for importance, suspicion, significance or severity never orders a ranking (K1471, K1473). Nothing was written."));
      if (!recipe || !Array.isArray(recipe.steps)) return null;
      const last = recipe.steps.find((s) => plain(s) && s.as === recipe.output);
      if (!last || last.op !== "sort") return no("NOT_A_RANKING", "a ranking's answer is a sort by its one stated quantity. Nothing was written.");
      return { ok: true, recipe, ranking: { quantity: str(quantity), scope: str(terms.scope), period: terms.period } };
    }
    if (BUILT_IN_KINDS.includes(kind) && (recipe === null || recipe === undefined)) return this.#defaultRecipe(kind, described, bound, column, part);
    return recipe ? { ok: true, recipe } : null;
  }

  /* R4 (K5131): the recipe a built-in kind composes when none is given, in the closed grammar, over its one input table: `count` over its rows;
     `total` the sum of the stated `column`; `share`, `ratio` and `difference` over the rows whose `column` equals the stated `part` and the rows that
     do not (a share of the rows, a ratio of the first to the second, their difference). A column (or a part) not stated is refused naming it. */
  #defaultRecipe(kind, described, bound, column, part) {
    const t = described.length === 1 ? bound[described[0].name] : null;
    if (!plain(t) || !Array.isArray(t.fields))
      return no("KIND_INPUTS", localize("calculations.index.a_kind_without_a_recipe", "a {kind} calculation without a recipe is worked out over one table; the input given is not one. Nothing was written.", { kind: String(kind) }));
    const name = described[0].name;
    const input = { name, kind: "table" };
    if (kind === "count") return { ok: true, recipe: { method: METHOD, inputs: [input], steps: [{ op: "count", from: name, as: "count" }], output: "count" } };
    const col = str(column);
    if (!col) return no("NO_COLUMN", localize("calculations.index.the_column_is_not_stated", "a {kind} is worked out over a column of the table, and none is stated; name the column. Nothing was written.", { kind: String(kind) }), { field: "column" });
    if (!t.fields.some((f) => f.name === col))
      return no("NO_SUCH_COLUMN", localize("calculations.index.the_table_has_no_such_column", "the table has no column \"{column}\". Nothing was written.", { column: col }), { field: "column" });
    if (kind === "total") return { ok: true, recipe: { method: METHOD, inputs: [input], steps: [{ op: "sum", from: name, field: col, as: "total" }], output: "total" } };
    const value = typeof part === "string" ? part.trim() : Number.isSafeInteger(part) ? part : "";
    if (value === "") return no("NO_PART", localize("calculations.index.the_part_is_not_stated", "a {kind} is of the rows whose {column} is one value, and none is stated; name the part. Nothing was written.", { kind: String(kind), column: col }), { field: "part" });
    const rows = (test, as) => ({ op: "select", from: name, where: [{ field: col, test, value }], as });
    if (kind === "share") return { ok: true, recipe: { method: METHOD, inputs: [input], steps: [rows("eq", "part_rows"), { op: "share", part: "part_rows", whole: name, as: "share" }], output: "share" } };
    return { ok: true, recipe: { method: METHOD, inputs: [input], steps: [rows("eq", "part_rows"), rows("ne", "other_rows"),
      { op: "count", from: "part_rows", as: "part_count" }, { op: "count", from: "other_rows", as: "other_count" },
      kind === "ratio" ? { op: "ratio", numerator: "part_count", denominator: "other_count", as: "ratio" }
        : { op: "difference", a: "part_count", b: "other_count", as: "difference" }], output: kind } };
  }

  /* R33–R36: what a recipe of application reads beside its inputs (a change's date, a target, a provision), then its
     recipe composed from the template (`./application.mjs`); a recipe given that is not the composed one is refused. */
  #applicationPlan(kind, recipe, terms, b, viewer, period) {
    const t = plain(terms) ? terms : {};
    const standards = this.dep("standards");
    const ctx = { period };
    const read = (id) => {
      if (!str(id)) return null;
      try { const r = standards && typeof standards.standardRead === "function" ? standards.standardRead({ id: str(id), viewer }) : null; return r && r.ok !== false ? r : null; } catch { return null; }
    };
    const noStandard = (id, what) => no("NO_SUCH_STANDARD", `the standard named as ${what} is not one held that you may see. Nothing was written.`, { standard: id ?? null });
    if (kind === "before_after") {
      const ch = plain(t.change) ? t.change : null;
      if (!ch) return no("NO_CHANGE", "before_after names its change: {standard}, a held standard's version, or {date}. Nothing was written.");
      if (ch.standard !== undefined) {
        const r = read(ch.standard);
        if (!r) return noStandard(ch.standard, "the change");
        const from = plain(r.period) ? r.period.from : null;
        const day = typeof from === "string" ? from.slice(0, 10) : null;
        if (!isCalendarDate(day ?? "")) return no("CHANGE_DATE_UNDETERMINED", "the standard's version states no date its period starts from, so before and after cannot be told apart. Nothing was written.", { standard: ch.standard });
        ctx.change = { date: day, rests_on: { standard: str(ch.standard), period: r.period, says: word("calculations.says.version_period_starts", { day: String(day) }) } };
      } else if (isCalendarDate(ch.date ?? "")) ctx.change = { date: ch.date, rests_on: { says: word("calculations.says.date_member_named", { date: String(ch.date) }) } };
      else return no("NO_CHANGE", localize("calculations.index.the_change_is_a_held", "the change is a held standard's version or a date (YYYY-MM-DD). Nothing was written."));
    }
    if (kind === "target_met") {
      const r = read(t.target);
      if (!r) return noStandard(t.target, "the target");
      const tg = plain(r.target) ? r.target : null;
      if (!tg || !plain(tg.threshold)) return no("NO_TARGET", localize("calculations.index.the_standard_holds_no_target", "the standard holds no target (standards R42): a metric, a threshold, a period and a definition. Nothing was written."), { standard: t.target });
      const f = parseFigure(String(tg.threshold.value ?? ""));
      if (f.refused) return no("NO_TARGET", `the target's threshold is not a figure: ${f.why}. Nothing was written.`, { standard: t.target });
      if (!str(t.body)) return no("BAD_TERMS", "target_met names the body measured. Nothing was written.", { field: "body" });
      const fig = { ...f }; delete fig.as_read;
      ctx.target = { standard: str(t.target), metric: tg.metric ?? null, threshold: tg.threshold, period: tg.period ?? null, definition: tg.definition ?? null, figure: fig };
    }
    if (kind === "policy_against_practice") {
      const pv = plain(t.provision) ? t.provision : null;
      if (!pv || !str(pv.standard)) return no("NO_PROVISION", "policy_against_practice names its provision, {standard, portion?}. Nothing was written.");
      const r = read(pv.standard);
      if (!r) return noStandard(pv.standard, "the provision");
      let measure = false;
      try { measure = standards && typeof standards.isMeasure === "function" ? standards.isMeasure(str(pv.standard), viewer) === true : false; } catch { measure = false; }
      if (!measure) return no("PROVISION_NOT_A_MEASURE", localize("calculations.index.the_provisions_standard_is_held", "the provision's standard is held {v1}, not as its own words, so it is not a measure an act is held against (standards R34). Nothing was written.", { v1: String(r.held ?? "without its text") }), { standard: str(pv.standard), held: r.held ?? null });
      const date = period && !period.key ? period.to || period.from : null;
      let standing = { state: "undetermined", why: word("calculations.why.calculation_period_states") };
      if (date) {
        try { standing = standards.inForceAt({ standard: str(pv.standard), ...(pv.portion ? { portion: pv.portion } : {}), date, viewer }) || standing; } catch (e) { standing = { state: "undetermined", why: String(e && e.message || e) }; }
        if (standing.state === "not_in_force") return no("THRESHOLD_NOT_IN_FORCE", `the provision was not in force for the calculation's period: ${standing.why}. Nothing was written.`, { standard: str(pv.standard) });
      }
      let force = null;
      try { const fs = typeof standards.forcesOf === "function" ? standards.forcesOf({ standard: str(pv.standard), viewer }) : null; force = fs && Array.isArray(fs.forces) ? fs.forces.find((x) => plain(x) && x.portion === (pv.portion ?? null)) || null : null; } catch { force = null; }
      ctx.provision = { standard: str(pv.standard), portion: pv.portion ?? null, version: standing.version ?? str(pv.standard),
        standing: { state: standing.state, why: standing.why ?? null }, force, held: r.held ?? "text",
        says: word("calculations.says.provision_version_force") };
    }
    const c = composeApplication(kind, t, b.bound, ctx);
    if (!c.ok) return c;
    if (recipe !== null && recipe !== undefined && canonicalJson(recipe) !== canonicalJson(c.recipe))
      return no("RECIPE_NOT_TEMPLATE", `a ${kind} calculation runs the recipe its template composes over its inputs; the recipe given is not it. Nothing was written.`);
    if (kind === "target_met") {
      for (const p of c.plan.periods) {
        if (!isCalendarDate(p.to ?? "")) continue;
        let st = null;
        try { st = standards.inForceAt({ standard: ctx.target.standard, date: p.to, viewer }); } catch { st = null; }
        if (st && st.state === "not_in_force") return no("THRESHOLD_NOT_IN_FORCE", `the target was not in force for the period ending ${p.to}: ${st.why}. Nothing was written.`, { standard: ctx.target.standard });
        p.standing = st ? { state: st.state, why: st.why ?? null } : { state: "undetermined", why: word("calculations.why.standards_module_gave") };
      }
    }
    return { ok: true, recipe: c.recipe, application: { plan: c.plan, ctx, terms: t }, extra: c.extra || null };
  }

  /* R35: `standards.bindsAt` for the body measured on a day, as `{state, why, body}`: binds, benchmark or undetermined. */
  #bindsAt(standard, body, date, viewer) {
    if (!isCalendarDate(date ?? "")) return { state: "undetermined", why: word("calculations.why.period_states_last"), body };
    const standards = this.dep("standards");
    let r = null;
    try { r = standards && typeof standards.bindsAt === "function" ? standards.bindsAt({ standard, body, date, viewer }) : null; } catch (e) { r = { state: "undetermined", why: String(e && e.message || e) }; }
    const state = r ? (r.state ?? r.answer ?? r.bindingness) : null;
    if (state === "binds" || state === "benchmark") return { state, why: r.why ?? null, rests_on: r.rests_on ?? null, body };
    return { state: "undetermined", why: (r && r.why) || word("calculations.why.standards_module_gave_answer"), body };
  }

  /* R17: a measure across mixed kinds of link: the table a ranking's grouped measure counts holds rows of more than
     one kind. */
  #mixedKinds(recipe, bound, opts) {
    const sort = recipe.steps.find((s) => plain(s) && s.as === recipe.output);
    const group = recipe.steps.find((s) => plain(s) && s.as === sort.from && s.op === "group");
    if (!group) return null;
    const prefix = { ...recipe, steps: recipe.steps.slice(0, recipe.steps.indexOf(group)), output: group.from };
    let t = bound[group.from];
    if (!t && prefix.steps.length) { const r = evaluateRecipe(prefix, bound, opts); t = r && r.result; }
    if (!t || !Array.isArray(t.fields) || !(Array.isArray(t.rows) || typeof t.rows === "function")) return null;
    for (const f of LINK_KIND_FIELDS) {
      const k = t.fields.findIndex((x) => x.name === f);
      if (k < 0 || group.by.includes(f)) continue;
      const seen = new Set();
      for (const r of Array.isArray(t.rows) ? t.rows : t.rows()) {
        const v = Array.isArray(t.rows) ? r[f] : r[k];
        if (v !== "" && v != null) seen.add(String(v));
      }
      const kinds = [...seen];
      if (kinds.length > 1)
        return no("SCORE_NOT_A_FACT", localize("calculations.index.the_ranking_counts_rows_of", "the ranking counts rows of {length} kinds ({kinds}) as one measure; a measure across mixed kinds of link is refused, a count of one kind is a fact (K1471). Nothing was written.", { length: String(kinds.length), kinds: String(kinds.slice(0, 5).join(", ")) }), { field: f });
    }
    return null;
  }

  /* The whole computation of R4–R7, R12, R15–R18, for `create` and `evaluate`: refusals in R4's order, else what
     `create` stores. */
  async #compute({ kind = null, recipe = null, inputs = null, threshold = null, period = null, terms = null, column = null, part = null, viewer, requireKind = true, pending = null }) {
    if (!Array.isArray(inputs) || !inputs.length) return no("NO_INPUTS", "a calculation names its inputs: declared tables, money facts, cited figures, other calculations or frozen sets. Nothing was written.");
    const b = await this.#bind(inputs, viewer, { threshold, pending });
    if (!b.ok) return b;
    const th = this.#threshold(threshold, period || {}, viewer);
    if (!th.ok) return th;
    const plan = kind === null && !requireKind ? null : APPLICATION_KINDS.includes(kind)
      ? this.#applicationPlan(kind, recipe, terms, b, viewer, period || {}) : this.#kindPlan(kind, recipe, terms, b.inputs, b.bound, { column, part });
    if (plan && !plan.ok) return plan;
    const r = plan && plan.recipe ? plan.recipe : recipe;
    if (plain(r)) {
      const jf = this.#joinFault(r, b.inputs);
      if (jf) return jf;
    }
    const checked = checkRecipe(r);
    if (!checked.ok) {
      const e = checked.errors[0];
      return no(e.code, `the recipe is not in calc-grammar's closed grammar (${METHOD}): ${e.why}${e.step !== null ? ` (step ${e.step}${e.field ? `, ${e.field}` : ""})` : ""}. Nothing was written.`, { errors: checked.errors });
    }
    const bound = { ...b.bound };
    const hashes = { ...b.hashes };
    const canon = { ...b.canon };
    if (th.figure) { bound.threshold = th.figure; canon.threshold = canonicalJson({ threshold: th.held }); hashes.threshold = sha256HexSync(canon.threshold); }
    /* R35: the target's threshold, bound as its own input with its bytes (R9) */
    if (plan && plan.extra) for (const [name, fig] of Object.entries(plan.extra)) {
      bound[name] = fig;
      canon[name] = canonicalJson({ target: { standard: plan.application.ctx.target.standard, threshold: plan.application.ctx.target.threshold }, figure: fig });
      hashes[name] = sha256HexSync(canon[name]);
    }
    const view = this.#view();
    const opts = { resolveId: (space, v) => { const rec = recognise(view, space, String(v)); return rec ? rec.normal : null; }, ...(view && { view }) };
    if (kind === "ranking") { const mk = this.#mixedKinds(r, bound, opts); if (mk) return mk; }
    /* R12: a money input summed whole is summable as money states it, or refused by its name. */
    const money = this.dep("money");
    const interfund = [];
    const roots = lineage(r);
    for (const d of b.inputs.filter((x) => x.kind === "money")) {
      const sums = summedTables(r).filter((s) => roots(s.from).has(d.name));
      if (!sums.length) continue;
      let s = null;
      try { s = money && typeof money.summable === "function" ? await money.summable({ factIds: d.facts, viewer }) : null; } catch { s = null; }
      if (s && s.ok === false && sums.some((x) => x.from === d.name))
        return no(s.reason || s.refused || s.code, `${s.detail || s.why || "the money facts cannot be summed"} (money's summation rule). Nothing was written.`, { input: d.name, ...(s.facts ? { facts: s.facts } : {}) });
      if (s && s.ok && Array.isArray(s.interfund) && s.interfund.length) interfund.push({ input: d.name, transfers: s.interfund,
        says: word("calculations.says.total_includes_transfers") });
    }
    const e = evaluateRecipe(r, bound, opts);
    /* R4 (K1734): a table result answered streamed is stored and answered as the same table of row objects */
    if (!e.refused) e.result = rowObjects(e.result);
    if (e.refused) return no(e.refused, `calc-grammar refused the recipe: ${e.why}${e.step ? ` (step ${e.step})` : ""}. Nothing was written.`, { step: e.step ?? null, ...(e.errors ? { errors: e.errors } : {}) });
    const counted = e.trace.filter((t) => t.undetermined.length).map((t) => ({ step: t.step, op: t.op, rows: t.undetermined.length, set_aside: t.undetermined.slice(0, 50) }));
    const steps = Object.fromEntries(e.trace.map((t) => [t.step, t.step === r.output ? e.result : t.output]));
    const results = { output: e.result, steps, undetermined_rows: e.undetermined_rows, counted_apart: counted,
      ...(b.apart.withdrawn.length && { withdrawn_apart: b.apart.withdrawn }),
      ...(b.apart.out_of_view.length && { out_of_view: b.apart.out_of_view }),
      ...(interfund.length && { interfund }),
      says: e.undetermined_rows || b.apart.out_of_view.length || b.apart.withdrawn.length
        ? word("calculations.says.values_counted_counted")
        : word("calculations.says.value_counted") };
    if (plain(e.result) && e.result.relation !== undefined) results.label = "computed fact";
    if (plan && plan.unit) results.unit = plan.unit;
    if (plan && plan.ranking) results.ranking = { ...plan.ranking, could_not_count: e.undetermined_rows };
    if (plan && plan.periods) {
      results.periods = plan.periods.map((p, i) => {
        const at = (n) => (e.trace.find((t) => t.step === n) || {}).output ?? null;
        return { fiscal_period: p, adopted: at(`adopted_total_${i}`), actual: at(`actual_total_${i}`), difference: at(`difference_${i}`), comparison: at(`comparison_${i}`) };
      });
      results.bases = plan.bases;
      results.bases_says = word("calculations.adopted_basis_actual", { adopted: String(plan.bases.adopted.join(", ")), actual: String(plan.bases.actual.join(", ")) });
    }
    if (kind === "estimate" && plan && plan.visits) {
      /* R40: share_judged, the interval over the judged items, estimate_count, what was counted apart, the assumption */
      const at = (n) => (e.trace.find((t) => t.step === n) || {}).output ?? null;
      const whole = (f) => (plain(f) && f.precision === "exact" && f.sign === "+" && /^\d+$/.test(f.value || "") ? Number(f.value) : null);
      const share = e.result;
      const judged = plain(share) ? whole(share.denominator) : null, yes = plain(share) ? whole(share.numerator) : null;
      if (!judged || yes === null)
        return no("NOTHING_JUDGED", "no drawn item is judged yet: no item's visits find yes or no, so there is nothing to estimate from. Nothing was written.", { counted_apart: { could_not_tell: at("could_not_tell"), disagree: at("disagree"), not_visited: at("not_visited") } });
      const N = plan.visits.draw.frame_size;
      const confidence = terms && terms.confidence !== undefined ? String(terms.confidence) : "0.95";
      const iv = interval({ frame_size: N, sample_size: judged, successes: yes, confidence });
      if (iv.refused) return no(iv.refused, `the estimate's interval cannot be computed: ${iv.why}. Nothing was written.`);
      const fig = (k) => ({ value: String(k), sign: "+", precision: "exact" });
      results.share_judged = share;
      results.interval = { low: iv.low, high: iv.high, low_share: divide(fig(iv.low), fig(N), RATIO_DEFAULT), high_share: divide(fig(iv.high), fig(N), RATIO_DEFAULT),
        confidence, frame_size: N, sample_size: judged, successes: yes, method: iv.method, seed: plan.visits.draw.seed,
        says: word("calculations.says.low_high_counts", { n: String(N), judged: String(judged) }) };
      results.estimate_count = multiply(share.value, fig(N));
      results.counted_apart = { could_not_tell: at("could_not_tell"), disagree: at("disagree"), not_visited: at("not_visited"), steps: counted,
        says: word("calculations.says.drawn_items_judged") };
      results.assumption = VISIT_ASSUMPTION;
    } else if (kind === "estimate") {
      const dr = b.inputs.find((d) => d.kind === "draw").draw;
      const succ = e.result;
      const x = plain(succ) && succ.precision === "exact" && succ.sign === "+" && /^\d+$/.test(succ.value || "") ? Number(succ.value) : null;
      const confidence = terms && terms.confidence !== undefined ? String(terms.confidence) : "0.95";
      const iv = x === null ? { refused: "INTERVAL_INVALID", why: word("calculations.why.recipe_answer_whole") }
        : interval({ frame_size: dr.frame_size, sample_size: dr.n, successes: x, confidence });
      if (iv.refused) return no(iv.refused, `the estimate's interval cannot be computed: ${iv.why}. Nothing was written.`);
      results.interval = { ...iv, confidence, frame_size: dr.frame_size, sample_size: dr.n, successes: x, seed: dr.seed,
        says: word("calculations.says.estimate_recorded_random") };
    }
    if (plan && plan.application) {
      const a = plan.application;
      const at = (n) => rowObjects(n === r.output ? e.result : (e.trace.find((x) => x.step === n) || {}).output ?? null);
      const population = b.inputs.filter((d) => d.kind === "table" || d.kind === "calculation").map((d) => (plain(d.source) && d.source.kind === "uses"
        ? { input: d.name, table: d.ref, filter: d.source.filter, frozen_by: d.source.frozen_by, frozen_at: d.source.frozen_at, says: word("calculations.says.held_uses_member") }
        : { input: d.name, [d.kind]: d.ref }));
      const body = str(a.terms.body);
      let bodyLabel = null;
      if (body) { try { const en = this.dep("entities"); const x = en ? en.readEntity({ entityId: body, viewer }) : null; bodyLabel = x && x.found ? x.entity.label : null; } catch { bodyLabel = null; } }
      results.application = answerApplication(kind, a.plan, at, { population, bodyLabel,
        binds: (to) => this.#bindsAt(a.ctx.target.standard, body, to, viewer),
        definitionDiffers: str(a.terms.definition_differs) || null });
    }
    const figures = Object.fromEntries(b.inputs.filter((d) => d.kind === "figure" || d.kind === "value").map((d) => [d.name, bound[d.name]]));
    if (Object.keys(figures).length) results.inputs_bound = figures;
    const key = resultKey(r, hashes);
    return { ok: true, recipe: r, results, result_key: key, hashes, canon, inputs: b.inputs, refs: b.refs, threshold: th.held ?? null };
  }

  /* ===================================================================== *
   * CALCULATIONS (R4–R11)
   * ===================================================================== */

  /** R4: `create({question, terms, period, inputs, recipe, kind, threshold?, methodNote?, evidences?, project, by})`.
   *  Async (inputs may be read from the evidence store). */
  async create({ question = null, terms = null, period = null, inputs = null, recipe = null, kind = null, threshold = null,
                 methodNote = null, evidences = null, project = null, column = null, part = null, by = null } = {}) {
    if (!stamped(by)) return no("NO_AUTHOR", "a calculation is recorded under the control plane's stamp. Nothing was written.");
    if (!str(question)) return no("NO_QUESTION", "a calculation states the question it answers. Nothing was written.");
    const p = periodOf(period);
    if (!p) return no("NO_PERIOD", "a calculation states its period: {from, to}, each a date YYYY-MM-DD or null (not both), or a period key. Nothing was written.");
    const sel = this.#freezeSelections(inputs, by);
    if (!sel.ok) return sel;
    inputs = sel.inputs;
    const c = await this.#compute({ kind, recipe, inputs, threshold, period: p, terms, column, part, viewer: by, pending: sel.pending });
    if (!c.ok) return c;
    /* after R4's ordered refusals, the fields it adds: */
    if (project !== null && project !== undefined && (!str(project) || !this.#sees(project, by)))
      return no("NO_SUCH_PROJECT", "no project answers to that id here, or it is not one you may see. Nothing was written.", { project });
    if (evidences !== null && evidences !== undefined && !(Array.isArray(evidences) && evidences.every((x) => plain(x) && str(x.duty) && str(x.occurrence))))
      return no("BAD_EVIDENCES", "evidences name the duty occurrences a calculation measures, each {duty, occurrence}. Nothing was written.");
    /* R9: each input's canonical bytes in the evidence store under their SHA-256, beside a table's, so a case file can
       name them and publication commit them (its R22). Content-addressed: a byte string put again is the same object. */
    const ev = this.record.evidenceStore();
    if (ev) {
      for (const [name, text] of Object.entries(c.canon)) {
        if (typeof text !== "string") continue;
        try { await ev.put(c.hashes[name], new TextEncoder().encode(text)); }
        catch (e) { return no("EVIDENCE_WRITE_FAILED", `the input "${name}"'s bytes could not be stored: ${String(e && e.message || e).slice(0, 200)}. Nothing was written.`, { input: name }); }
      }
    }
    const at = this.now();
    const year = at.slice(0, 4);
    let calcId = null;
    const out = this.record.transact(() => {
      const id = this.record.allocId("CALC", year);
      if (!id || !id.id) return id && id.ok === false ? id : no("MINT_FAILED", "no calculation id could be drawn. Nothing was written.");
      calcId = id.id;
      /* R52: a held selection's ids, frozen with the calculation that counts them */
      for (const f of sel.pending.values())
        this.sql.exec(`INSERT OR IGNORE INTO calc_sets (set_sha, project, query_json, ids_json, n, frozen_by, frozen_at) VALUES (?,?,?,?,?,?,?)`,
          f.set_sha, null, f.query_json, f.ids_json, f.n, by, at);
      this.sql.exec(`INSERT INTO calculations (calc_id, project, question, terms_json, period_json, kind, recipe_json, inputs_json,
                       threshold_json, method_version, method_note, evidences_json, result_key, results_json, computed_at,
                       recompute_status, recompute_json, accepted_by, accepted_at, created_by, created_at, input_shas_json)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'unchecked',NULL,NULL,NULL,?,?,?)`,
        calcId, project ? str(project) : null, str(question), json(terms), json(p), kind, json(c.recipe), json(inputs),
        c.threshold ? json(c.threshold) : null, METHOD, str(methodNote) || null, evidences ? json(evidences) : null,
        c.result_key, json(c.results), at, by, at, json(c.hashes));
      for (const ref of c.refs)
        this.sql.exec(`INSERT OR IGNORE INTO calc_inputs (calc_id, project, input_name, input_kind, ref, engine_json) VALUES (?,?,?,?,?,?)`,
          calcId, project ? str(project) : null, ref.name, ref.kind, ref.ref, ref.kind === "figure" ? json(ref.engine ?? null) : null);
      if (c.threshold && c.threshold.content)
        this.sql.exec(`INSERT OR IGNORE INTO calc_inputs (calc_id, project, input_name, input_kind, ref) VALUES (?,?,?,?,?)`,
          calcId, project ? str(project) : null, "threshold", "figure", c.threshold.content);
      this.#appendRecompute(calcId, project ? str(project) : null, "created", c.result_key, null, at);
      return { ok: true };
    });
    if (!out.ok) return out;
    return { ok: true, calc_id: calcId, kind, result_key: c.result_key, results: c.results, method_version: METHOD,
      computed_at: at, recompute_status: "unchecked" };
  }

  /** R7: `evaluate({recipe, inputs, viewer, kind?, threshold?, period?, terms?})`: what `create` would store, writing
   *  nothing. */
  async evaluate({ recipe = null, inputs = null, viewer = null, kind = null, threshold = null, period = null, terms = null, column = null, part = null } = {}) {
    if (!stamped(viewer)) return no("NO_VIEWER", "an evaluation is asked under the control plane's stamp.");
    const p = period === null || period === undefined ? {} : periodOf(period) || {};
    const sel = this.#freezeSelections(inputs, viewer);
    if (!sel.ok) return { ...sel, detail: String(sel.detail || "").replace(/ Nothing was written\.$/, "") };
    const c = await this.#compute({ kind, recipe, inputs: sel.inputs, threshold, period: p, terms, column, part, viewer, requireKind: false, pending: sel.pending });
    if (!c.ok) return { ...c, detail: String(c.detail || "").replace(/ Nothing was written\.$/, "") };
    return { ok: true, writes: "nothing", result_key: c.result_key, results: c.results, method_version: METHOD, recipe: c.recipe };
  }

  #appendRecompute(calcId, project, status, key, detail, at) {
    const n = this.#one(`SELECT COALESCE(MAX(seq), 0) AS n FROM calc_recomputes WHERE calc_id=?`, calcId).n;
    this.sql.exec(`INSERT INTO calc_recomputes (calc_id, project, seq, status, result_key, detail_json, at) VALUES (?,?,?,?,?,?,?)`,
      calcId, project, n + 1, status, key, detail ? json(detail) : null, at);
  }

  /* R8: recompute under the machine's view (every input as held now), compared with what is stored. */
  async #recomputeRow(c) {
    const r = await this.#compute({ kind: c.kind, recipe: parse(c.recipe_json), inputs: parse(c.inputs_json),
      threshold: (() => { const t = parse(c.threshold_json); if (!t) return null; const { as_read, grade, content, standing, ...rest } = t; return rest; })(),
      period: parse(c.period_json), terms: parse(c.terms_json), viewer: INGEST_STAMP });
    if (!r.ok) return { agrees: false, results: null, refused: { reason: r.reason, detail: r.detail }, differing: { path: "inputs", why: r.detail } };
    const stored = parse(c.results_json);
    const diff = r.result_key === c.result_key ? firstDifference(stored, r.results) : firstDifference({ result_key: c.result_key, ...stored }, { result_key: r.result_key, ...r.results });
    return { agrees: !diff, results: r.results, result_key: r.result_key, differing: diff };
  }

  /** R8: `recompute({calcId})` → `{agrees, results}`; writes only the recompute status. */
  async recompute({ calcId = null } = {}) {
    const c = str(calcId) ? this.#one(`SELECT * FROM calculations WHERE calc_id=?`, str(calcId)) : null;
    if (!c) return no("NO_SUCH_CALCULATION", "no calculation answers to that id here.");
    const r = await this.#recomputeRow(c);
    const at = this.now();
    const status = r.agrees ? "agrees" : "differs";
    this.record.transact(() => {
      this.sql.exec(`UPDATE calculations SET recompute_status=?, recompute_json=? WHERE calc_id=?`, status,
        json({ at, result_key: r.result_key ?? null, differing: r.differing ?? null }), c.calc_id);
      this.#appendRecompute(c.calc_id, c.project, status, r.result_key ?? null, r.differing ?? null, at);
      return { ok: true };
    });
    return { ok: true, calc_id: c.calc_id, agrees: r.agrees, results: r.results, ...(r.differing ? { differing: r.differing } : {}),
      ...(r.refused ? { refused: r.refused } : {}), recomputed_at: at };
  }

  /** R8: `accept({calcId, by})`: a member's act; recomputes first and is refused CALC_RECOMPUTE_DIFFERS, naming the
   *  differing result, when the recompute differs from what is stored. A refused accept writes nothing, its recompute
   *  status and recompute record included (N619); an agreeing one writes the recompute and the acceptance at once. */
  async accept({ calcId = null, by = null } = {}) {
    if (!stamped(by) || isMachine(by)) return no("MEMBER_ACT_ONLY", "accepting a calculation is a member's act. Nothing was written.");
    const c = str(calcId) ? this.#one(`SELECT * FROM calculations WHERE calc_id=?`, str(calcId)) : null;
    if (!c || !this.#visible(c, by)) return no("NO_SUCH_CALCULATION", "no calculation answers to that id here, or it is not one you may see. Nothing was written.");
    if (c.accepted_by) return { ok: true, already: true, calc_id: c.calc_id, accepted_by: c.accepted_by, accepted_at: c.accepted_at };
    const r = await this.#recomputeRow(c);
    if (!r.agrees) return no("CALC_RECOMPUTE_DIFFERS", `the recompute differs from what is stored at ${r.differing ? r.differing.path : "its results"}, so the calculation is not accepted. Nothing was written.`, { calc_id: c.calc_id, differing: r.differing ?? null });
    const at = this.now();
    const out = this.record.transact(() => {
      const now = this.#one(`SELECT accepted_by, accepted_at FROM calculations WHERE calc_id=?`, c.calc_id);
      if (now && now.accepted_by) return { ok: true, already: now };
      this.sql.exec(`UPDATE calculations SET recompute_status='agrees', recompute_json=?, accepted_by=?, accepted_at=? WHERE calc_id=?`,
        json({ at, result_key: r.result_key ?? null, differing: null }), by, at, c.calc_id);
      this.#appendRecompute(c.calc_id, c.project, "agrees", r.result_key ?? null, null, at);
      this.#appendRecompute(c.calc_id, c.project, "accepted", c.result_key, { by }, at);
      return { ok: true };
    });
    if (out.already) return { ok: true, already: true, calc_id: c.calc_id, accepted_by: out.already.accepted_by, accepted_at: out.already.accepted_at };
    return { ok: true, calc_id: c.calc_id, accepted_by: by, accepted_at: at, recompute_status: "agrees" };
  }

  /* R10, R39: may `viewer` see a recorded draw's project and the set it was drawn from (a table's sight, or every drawn
     member of a record set)? Synchronous. */
  #seesDrawn(d, viewer) {
    if (!d || !this.#sees(d.project, viewer)) return false;
    if (d.set_kind === "table") { const t = this.#one(`SELECT sha, bundle_id FROM calc_tables WHERE sha=?`, d.set_sha); return !!t && this.#seesTable(t, viewer); }
    return (parse(d.sample_json) || []).every((id) => this.#sees(id, viewer));
  }

  /* R38, R39: may `viewer` see a capture the register holds (provenance R48: its bundle's sight)? */
  #seesCapture(captureSha, viewer) {
    const r = typeof captureSha === "string" && captureSha ? this.#one(`SELECT bundle_id FROM register WHERE capture_sha=?`, captureSha) : null;
    return !!r && this.#sees(r.bundle_id, viewer);
  }

  /* R10, R39: a draw `viewer` may see: its set, and every visit's testimony and exhibits. */
  #seesDraw(d, viewer) {
    if (!this.#seesDrawn(d, viewer)) return false;
    for (const v of this.#rows(`SELECT testimony, exhibits_json FROM calc_visits WHERE draw_key=?`, d.draw_key))
      if (!this.#seesCapture(v.testimony, viewer) || !(parse(v.exhibits_json) || []).every((x) => this.#seesCapture(x, viewer))) return false;
    return true;
  }

  /* R39: each drawn item, in drawn order, with its visits in recorded order and its standing. */
  #standings(d) {
    const sample = (parse(d.sample_json) || []).map(String);
    const of = new Map(sample.map((k) => [k, []]));
    for (const v of this.#rows(`SELECT * FROM calc_visits WHERE draw_key=? ORDER BY seq`, d.draw_key)) if (of.has(v.item)) of.get(v.item).push(visitAnswer(v));
    return sample.map((item) => ({ item, standing: standingOf(of.get(item).map((v) => v.finding)), visits: of.get(item) }));
  }

  /* R40: the draw's visits as they stand, held as a canonical table, one row per drawn item (`item`, `standing`,
     `visits`): its rows, its canonical CSV and that CSV's SHA-256 (R9). */
  #standingTable(d) {
    const items = this.#standings(d);
    const tb = tableBuilder(STANDING_FIELDS.map((f) => f.name), STANDING_FIELDS);
    for (const it of items) tb.push([it.item, it.standing, String(it.visits.length)]);
    const built = tb.finish();
    return { table: { fields: STANDING_FIELDS.map((f) => ({ ...f })), rows: items.map((it) => ({ item: it.item, standing: it.standing, visits: String(it.visits.length) })) },
      sha: built.sha, text: new TextDecoder().decode(built.bytes) };
  }

  /* R10: may `viewer` see every input (and the project) of this calculation? */
  /* Synchronous, so a registration asked synchronously (duties R12) can use it; a port answering a promise is read as
     not seen (fail closed). */
  #visible(c, viewer, memo = new Map()) {
    if (memo.has(c.calc_id)) return memo.get(c.calc_id);
    memo.set(c.calc_id, false);
    if (!stamped(viewer)) return false;
    if (c.project && !this.#sees(c.project, viewer)) return false;
    const money = this.dep("money");
    for (const i of this.#rows(`SELECT input_kind, ref FROM calc_inputs WHERE calc_id=?`, c.calc_id)) {
      let ok = false;
      if (i.input_kind === "table") { const t = this.#one(`SELECT sha, bundle_id FROM calc_tables WHERE sha=?`, i.ref); ok = !!t && this.#seesTable(t, viewer); }
      else if (i.input_kind === "money") {
        try { const f = money ? money.readFact({ factId: i.ref, viewer }) : null; ok = !!f && typeof f.then !== "function" && f.ok !== false && f.found !== false; } catch { ok = false; }
      } else if (i.input_kind === "figure") { const r = this.content.contentRow(i.ref); ok = !!r && this.#sees(r.bundle_id, viewer); }
      else if (i.input_kind === "calculation") { const o = this.#one(`SELECT * FROM calculations WHERE calc_id=?`, i.ref); ok = !!o && this.#visible(o, viewer, memo); }
      else if (i.input_kind === "set") { const s = this.#one(`SELECT project, ids_json FROM calc_sets WHERE set_sha=?`, i.ref); ok = !!s && this.#sees(s.project, viewer) && (parse(s.ids_json) || []).every((id) => this.#sees(id, viewer)); }
      else if (i.input_kind === "draw") { const d = this.#one(`SELECT * FROM calc_draws WHERE draw_key=?`, i.ref); ok = !!d && this.#seesDraw(d, viewer); }
      if (!ok) return false;
    }
    memo.set(c.calc_id, true);
    return true;
  }

  /* R9 (K1447 (ii)): the grade facts, from the inputs as held. */
  #gradeFacts(c) {
    const inputs = parse(c.inputs_json) || [];
    const per = [];
    const money = this.dep("money");
    for (const inp of inputs) {
      if (!plain(inp)) continue;
      if (inp.value !== undefined) { per.push({ name: inp.name, kind: "value", ref: inp.value, grade: TESTIMONY, unbound: true, why: word("calculations.why.unbound_input_testimony"), engine: null, engine_measured: null }); continue; }
      if (inp.table !== undefined) {
        const t = this.#one(`SELECT sha, source_json FROM calc_tables WHERE sha=?`, inp.table);
        const g = t ? this.#tableGrade(t) : { grade: null, why: word("calculations.why.table_source_held"), engine: null, engine_measured: null };
        per.push({ name: inp.name, kind: "table", ref: inp.table, ...g }); continue;
      }
      if (inp.figure !== undefined) {
        const row = this.content.contentRow(inp.figure);
        const g = row ? this.#withEngine(this.#contentGrade(row), this.#figureEngine(c.calc_id, inp)) : { grade: null, why: word("calculations.why.cited_passage_held"), engine: null, engine_measured: null };
        per.push({ name: inp.name, kind: "figure", ref: inp.figure, ...g }); continue;
      }
      if (inp.money !== undefined) {
        let grade = null;
        for (const id of Array.isArray(inp.money) ? inp.money : [inp.money]) {
          let f = null;
          try { f = money ? money.readFact({ factId: id, viewer: INGEST_STAMP }) : null; } catch { f = null; }
          if (f && typeof f.then === "function") f = null;
          const fact = f && f.ok !== false && f.found !== false ? (f.fact || f) : null;
          const r = fact && plain(fact.grade) ? fact.grade.reading : fact ? fact.grade : null;
          grade = isGrade(r) ? (grade ? weaker(grade, r) : r) : grade;
        }
        per.push({ name: inp.name, kind: "money", ref: inp.money, grade, why: grade ? word("calculations.why.weakest_reading_grade", { grade: String(grade) }) : word("calculations.why.reading_grade_stated"), engine: null, engine_measured: null }); continue;
      }
      if (inp.calculation !== undefined) {
        const o = this.#one(`SELECT * FROM calculations WHERE calc_id=?`, inp.calculation);
        const g = o ? this.#gradeFacts(o).capture : { grade: null, why: "not held" };
        per.push({ name: inp.name, kind: "calculation", ref: inp.calculation, grade: g.grade, why: word("calculations.why.capture_axis", { why: String(g.why) }), engine: null, engine_measured: null }); continue;
      }
      if (inp.draw !== undefined) {
        const d = this.#one(`SELECT question FROM calc_draws WHERE draw_key=?`, inp.draw);
        if (d && d.question !== null && d.question !== undefined) {
          per.push({ name: inp.name, kind: "draw", ref: inp.draw, grade: TESTIMONY, why: "its items are judged by members' visits, each testimony (D), and nothing raises it (R40)", engine: null, engine_measured: null });
          continue;
        }
      }
      per.push({ name: inp.name, kind: inp.set !== undefined ? "set" : "draw", ref: inp.set ?? inp.draw, grade: null, not_graded: true,
        why: word("calculations.why.record_ids_carry"), engine: null, engine_measured: null });
    }
    const t = parse(c.threshold_json);
    if (t) per.push({ name: "threshold", kind: "threshold", grade: t.grade ?? (t.content ? null : TESTIMONY), ...(t.content ? {} : { unbound: true }),
      why: t.content ? word("calculations.why.threshold_cited_figure") : word("calculations.why.threshold_typed_cited"), engine: null, engine_measured: null });
    const graded = per.filter((p) => !p.not_graded);
    const open = graded.filter((p) => !isGrade(p.grade));
    const weakest = graded.filter((p) => isGrade(p.grade)).reduce((g, p) => (g ? weaker(g, p.grade) : p.grade), null);
    const capture = open.length ? { grade: null, why: `undetermined: ${open.map((p) => `${p.name}, ${p.why}`).join("; ")}` }
      : weakest ? { grade: weakest, why: word("calculations.why.weakest_input_capture", { weakest: String(weakest) }) }
      : { grade: null, why: word("strength.stopped.input_carries_capture") };
    return { inputs: per, capture, method: { version: c.method_version, note: c.method_note ?? null, recipe: parse(c.recipe_json),
      disclosed: true, graded: false, says: word("calculations.says.method_disclosed_graded") } };
  }

  /** R8–R10: `read({calcId, viewer})`: the stored results, with `computed_at` and the method version, never a
   *  recompute; its grade facts; a calculation with an input the viewer may not see answers exactly as an absent one. */
  async read({ calcId = null, viewer = null } = {}) {
    if (!str(calcId)) return no("NO_CALC", "a calculation is read by its id.");
    const c = this.#one(`SELECT * FROM calculations WHERE calc_id=?`, str(calcId));
    if (!c || !this.#visible(c, viewer)) return { ok: true, found: false, calc_id: str(calcId) };
    await this.#warmEngines(c);
    const results = parse(c.results_json);
    /* R9: each input's SHA-256 of its canonical bytes as the calculation was computed over them (a table's is its sha;
       a calculation created before T34 recorded no other, so it answers null) */
    const shas = parse(c.input_shas_json) || {};
    const shaOfInput = (name, fallback = null) => (typeof shas[name] === "string" ? shas[name] : fallback);
    const inputs = (parse(c.inputs_json) || []).map((i) => {
      if (i.table !== undefined) return { name: i.name, kind: "table", sha: shaOfInput(i.name, i.table) };
      if (i.figure !== undefined || i.value !== undefined) {
        const step = (results && results.inputs_bound && results.inputs_bound[i.name]) || null;
        return { name: i.name, kind: "figure", figure: step, ...(i.figure !== undefined ? { content_id: i.figure } : { as_read: i.value }), sha: shaOfInput(i.name) };
      }
      const kind = ["money", "calculation", "set", "draw"].find((k) => i[k] !== undefined);
      return { name: i.name, kind, [kind]: i[kind], sha: shaOfInput(i.name) };
    });
    if (typeof shas.threshold === "string") inputs.push({ name: "threshold", kind: "threshold", sha: shas.threshold });
    const calculation = { calc_id: c.calc_id, question: c.question, period: parse(c.period_json), recipe: parse(c.recipe_json),
      method_version: c.method_version, result_key: c.result_key, inputs, results: results ? results.steps || {} : {} };
    return { ok: true, found: true, calculation, calc_id: c.calc_id, project: c.project, question: c.question, terms: parse(c.terms_json),
      period: parse(c.period_json), kind: c.kind, inputs: parse(c.inputs_json), threshold: parse(c.threshold_json),
      evidences: parse(c.evidences_json), result_key: c.result_key, results: parse(c.results_json), computed_at: c.computed_at,
      method_version: c.method_version, method_note: c.method_note ?? null, recompute_status: c.recompute_status,
      recompute: parse(c.recompute_json), accepted_by: c.accepted_by ?? null, accepted_at: c.accepted_at ?? null,
      created_by: c.created_by, created_at: c.created_at, grade: this.#gradeFacts(c),
      says: word("calculations.says.results_recomputed_acceptance") };
  }

  /** R30 (N576): `gradeFactsOf({calcId, viewer})`, synchronously: R9's grade facts as `read` answers them, with whether
   *  the acceptance is recorded: `{found: true, accepted, capture, inputs, method}`. A calculation not held, one R10
   *  withholds from the viewer, and a call without a viewer each answer `{found: false}`, identically. Recomputes
   *  nothing, writes nothing, never throws. */
  gradeFactsOf(args = {}) {
    try {
      const { calcId = null, viewer = null } = plain(args) ? args : {};
      const c = str(calcId) && stamped(viewer) ? this.#one(`SELECT * FROM calculations WHERE calc_id=?`, str(calcId)) : null;
      if (!c || !this.#visible(c, viewer)) return { found: false };
      const g = this.#gradeFacts(c);
      return { found: true, accepted: !!c.accepted_by, capture: g.capture, inputs: g.inputs, method: g.method };
    } catch { return { found: false }; }
  }

  /** R31 (N576): `calcStatusOf({calcId, viewer})`, synchronously: `{held, visible, accepted}`, for other modules'
   *  synchronous checks. `visible` is R10's admission of the viewer (false without one); `accepted` is false when not
   *  visible. A caller answers a viewer a calculation not `visible` exactly as one not `held`. Writes nothing; never
   *  throws. */
  calcStatusOf(args = {}) {
    try {
      const { calcId = null, viewer = null } = plain(args) ? args : {};
      const c = str(calcId) ? this.#one(`SELECT * FROM calculations WHERE calc_id=?`, str(calcId)) : null;
      if (!c) return { held: false, visible: false, accepted: false };
      const visible = stamped(viewer) && this.#visible(c, viewer) === true;
      return { held: true, visible, accepted: visible && !!c.accepted_by };
    } catch { return { held: false, visible: false, accepted: false }; }
  }

  /* ===================================================================== *
   * CHANGE NOTICES (R11)
   * ===================================================================== */

  /** R11: `onInputChanged(module, fn)`, one registration per module (membership's `listenerRefusal`). */
  onInputChanged(module, fn) {
    const r = listenerRefusal(this.#inputListeners, module, fn);
    if (r) return r;
    this.#inputListeners.push({ module, fn });
    return { ok: true, module };
  }

  #ordered(list) {
    const rank = (m) => { const i = MODULE_ORDER.indexOf(m); return i < 0 ? MODULE_ORDER.length : i; };
    return [...list].sort((a, b) => rank(a.module) - rank(b.module));
  }

  /* R11: every held calculation naming `ref` becomes stale, inside the caller's transaction; each listener is told once
     per calculation after commit. Nothing is recomputed. Never throws. */
  #stale(ref, cause) {
    try {
      const at = this.now();
      /* in the order they were created: a CALC- id is opaque (R4), so it orders nothing */
      const calcs = this.#rows(`SELECT c.calc_id, c.project, c.recompute_status FROM calculations c
                                 WHERE c.calc_id IN (SELECT calc_id FROM calc_inputs WHERE ref=?) ORDER BY c.created_at, c.rowid`, ref);
      for (const c of calcs) {
        this.sql.exec(`UPDATE calculations SET recompute_status='stale' WHERE calc_id=?`, c.calc_id);
        this.#appendRecompute(c.calc_id, c.project, "stale", null, { input: ref, cause }, at);
      }
      if (!calcs.length) return 0;
      const listeners = this.#ordered(this.#inputListeners);
      this.record.afterCommit(() => {
        for (const c of calcs) for (const l of listeners) {
          try { l.fn({ calcId: c.calc_id, input: ref, cause: INPUT_CHANGED }); } catch { /* one listener's failure stops no other */ }
        }
      });
      return calcs.length;
    } catch { return 0; }
  }

  /** R11: money's change notice (`money.onFactChanged`), registered at start. */
  moneyChanged({ factId = null, change = null } = {}) {
    if (typeof factId === "string" && factId) this.#stale(factId, change ? `money_${change}` : "money_changed");
  }

  /* ===================================================================== *
   * THE MONEY INGEST WRITER (R13, R14)
   * ===================================================================== */

  /** R14: `adoptBinding({table, roles, by})`: a member adopts a table's money roles. `roles` maps each money role to a
   *  column of the table carrying that role, or to `{value}`, one value for every row (kind, phase, stage, basis,
   *  currency, period). The payer and payee are columns declared with a way to resolve (an entity scheme or crosswalk). */
  adoptBinding({ table = null, roles = null, by = null } = {}) {
    if (!stamped(by) || isMachine(by)) return no("MEMBER_ACT_ONLY", localize("calculations.index.a_binding_is_adopted_by", "a binding is adopted by a member (K1468). Nothing was written."));
    const t = typeof table === "string" ? this.#one(`SELECT * FROM calc_tables WHERE sha=?`, table) : null;
    if (!t || !this.#sees(t.bundle_id, by)) return no("NO_SUCH_TABLE", "no table answers to that sha here, or it is not one you may see. Nothing was written.");
    if (!plain(roles)) return no("BINDING_ROLES", "a binding maps each money role to a column or to one value. Nothing was written.");
    const declared = parse(t.roles_json) || {};
    const header = parse(t.header_json);
    for (const [role, v] of Object.entries(roles)) {
      if (!MONEY_ROLES.includes(role)) return no("BINDING_ROLES", `"${role}" is not a money role (${MONEY_ROLES.join(", ")}). Nothing was written.`, { role });
      if (typeof v === "string") {
        if (!header.includes(v)) return no("BINDING_ROLES", `the role ${role} names "${v}", not a column of the table. Nothing was written.`, { role });
        if (!declared[v] || declared[v].role !== role) return no("BINDING_ROLES", localize("calculations.index.the_column_v_is_not", "the column \"{v}\" is not declared with the role {role}; the table's declaration is the member's (R2). Nothing was written.", { v: String(v), role: String(role) }), { role });
      } else if (!(plain(v) && typeof v.value === "string" && v.value.trim() && ["kind", "phase", "stage", "basis", "currency", "period"].includes(role)))
        return no("BINDING_ROLES", `the role ${role} maps to a column, or (for kind, phase, stage, basis, currency, period) to one value. Nothing was written.`, { role });
    }
    for (const role of ["amount", "payer", "payee", "kind", "phase", "basis", "currency", "period"])
      if (roles[role] === undefined) return no("BINDING_ROLES", `a binding names the role ${role}. Nothing was written.`, { role });
    for (const role of ["amount", "payer", "payee"])
      if (typeof roles[role] !== "string") return no("BINDING_ROLES", `the role ${role} maps to a column. Nothing was written.`, { role });
    /* R14 (K5148): each constant is asked of money, which reads it when a fact is recorded, so an unreadable one is stated here and not once per row.
       `money_code` is money's own code for it (`reason` is this refusal's). */
    const money = this.dep("money");
    if (money && typeof money.checkConstant === "function")
      for (const [role, v] of Object.entries(roles)) {
        if (typeof v === "string") continue;
        let c = null;
        try { c = money.checkConstant({ role, value: role === "period" ? moneyPeriod(v.value) : v.value.trim() }); } catch { c = null; }
        if (c && c.ok === false)
          return no("BINDING_UNREADABLE", localize("calculations.index.money_cannot_read_the_value", "money cannot read the value given for the role {role} ({why}). Nothing was written.", { role: String(role), why: String(c.detail || c.reason) }),
            { role, money_code: c.reason ?? c.code ?? null });
      }
    const key = sha({ table: t.sha, roles });
    if (this.#one(`SELECT 1 AS x FROM calc_bindings WHERE binding_key=?`, key)) return { ok: true, already: true, binding: key, table: t.sha, roles };
    const at = this.now();
    this.record.transact(() => {
      this.sql.exec(`INSERT INTO calc_bindings (binding_key, table_sha, bundle_id, roles_json, adopted_by, adopted_at) VALUES (?,?,?,?,?,?)`,
        key, t.sha, t.bundle_id ?? null, json(roles), by, at);
      return { ok: true };
    });
    return { ok: true, binding: key, table: t.sha, roles, adopted_by: by, adopted_at: at };
  }

  /** R14: the binding money reads to check a machine-written fact's source (money R4). */
  bindingOf(key) {
    const b = typeof key === "string" ? this.#one(`SELECT * FROM calc_bindings WHERE binding_key=?`, key) : null;
    if (!b) return null;
    const t = this.#one(`SELECT source_json FROM calc_tables WHERE sha=?`, b.table_sha);
    const src = t ? parse(t.source_json) : null;
    return { adopted: true, binding: b.binding_key, table: b.table_sha, roles: parse(b.roles_json), capture_sha: src ? src.capture_sha ?? null : null,
      adopted_by: b.adopted_by, adopted_at: b.adopted_at };
  }

  /* A party value resolved to an entity through its column's identifier: an entity scheme or a captured crosswalk.
     G55: `cache` is the one act's (a Map `ingestMoney` makes at its start and drops at its end): an answer is kept under its column's
     way to resolve and the trimmed value, so a payer repeated down a table is looked up once. A lookup that threw, or answered a
     promise, is not an answer and is never kept (a kept null would read as "not registered" for every later row of that payer).
     At most INGEST_CACHE_MAX answers are kept; a value past it is looked up each time, as before. */
  #resolveParty(spec, value, cache = null) {
    if (!value || !String(value).trim()) return { why: word("calculations.why.cell_empty") };
    const entities = this.dep("entities");
    const at = String(value).trim();
    if (spec.scheme) {
      const key = cache ? `s\u0000${spec.scheme}\u0000${at}` : null;
      if (key !== null && cache.has(key)) return cache.get(key);
      let e = null, answered = true;
      try { e = entities ? entities.entityByIdentifier({ scheme: spec.scheme, id: at }) : null; } catch { e = null; answered = false; }
      if (e && typeof e.then === "function") { e = null; answered = false; }
      let out;
      if (plain(e) && e.undetermined) out = { why: word("calculations.why.through_scheme_undetermined", { value: String(String(value).slice(0, 64)), scheme: String(spec.scheme), why: String(e.why || word("calculations.why.entity")) }) };
      else {
        const id = typeof e === "string" ? e : plain(e) ? (e.entity_id ?? e.entityId ?? null) : null;
        out = id ? { entity: id } : { why: word("calculations.why.resolves_registered_entity", { value: String(String(value).slice(0, 64)), scheme: String(spec.scheme) }) };
      }
      if (key !== null && answered && cache.size < INGEST_CACHE_MAX) cache.set(key, out);
      return out;
    }
    if (spec.crosswalk) {
      const key = cache ? `c\u0000${spec.crosswalk.table}\u0000${spec.crosswalk.from}\u0000${spec.crosswalk.to}\u0000${at}` : null;
      if (key !== null && cache.has(key)) return cache.get(key);
      const t = this.#heldTableSync(spec.crosswalk.table);
      const hit = [];
      if (t) for (const r of t.objects()) if (String(r[spec.crosswalk.from]).trim() === at) hit.push(String(r[spec.crosswalk.to]).trim());
      const ids = [...new Set(hit)];
      const out = ids.length === 1 && idPattern("ENT").test(ids[0]) ? { entity: ids[0] }
        : { why: ids.length > 1 ? word("calculations.why.maps_entities_crosswalk", { value: String(String(value).slice(0, 64)), ids: String(ids.length) }) : word("calculations.why.crosswalk_maps_entity", { value: String(String(value).slice(0, 64)) }) };
      /* a crosswalk table not held is not an answer about the value */
      if (key !== null && t && cache.size < INGEST_CACHE_MAX) cache.set(key, out);
      return out;
    }
    return { why: localize("calculations.index.an_id_space_normalises", "an id space normalises a value but names no entity; declare the column's entity scheme or a captured crosswalk") };
  }

  /* R14 (K5148): a row whose live fact money already holds (`factBySource`, an indexed read) is not written again: `{notWritten}` naming the held
     fact, or null. A withdrawn fact is none, so it never blocks its row. */
  #alreadyWritten(money, ctx, i) {
    if (typeof money.factBySource !== "function") return null;
    const held = money.factBySource({ table: ctx.b.table_sha, row: ctx.firstRow === null ? i : ctx.firstRow + i, binding: ctx.b.binding_key });
    if (!held || held.found !== true || !held.fact_id) return null;
    return { notWritten: { row: i, reason: "ROW_ALREADY_WRITTEN", fact_id: held.fact_id,
      detail: localize("calculations.ingest.row_already_written", "this row's money fact {fact} is already held, so a repeat does not write it again", { fact: String(held.fact_id) }) } };
  }

  /* R14: what one row asks of money, or why it is not written: `{notWritten}` or `{fact}` (a fact money has not yet recorded). */
  #judgeRow(ctx, i, row, ingest = null) {
    const { b, roles, declared, resolved } = ctx;   /* ctx.firstRow: R47 */
    const val = (r, role) => (typeof roles[role] === "string" ? String(r[roles[role]] ?? "").trim() : roles[role] ? roles[role].value : null);
    const payer = this.#resolveParty(declared[roles.payer] || {}, row[roles.payer], resolved);
    if (!payer.entity) return { notWritten: { row: i, reason: "PAYER_NOT_IDENTIFIED", detail: payer.why } };
    const payee = this.#resolveParty(declared[roles.payee] || {}, row[roles.payee], resolved);
    if (!payee.entity) return { notWritten: { row: i, reason: "PAYEE_NOT_IDENTIFIED", detail: payee.why } };
    let fund = null;
    if (typeof roles.fund === "string" && String(row[roles.fund] ?? "").trim()) {
      const spec = declared[roles.fund] || {};
      const raw = String(row[roles.fund]).trim();
      const r = spec.scheme || spec.crosswalk ? this.#resolveParty(spec, raw, resolved)
        : idPattern("ENT").test(raw) ? { entity: raw } : { why: word("calculations.why.names_registered_fund", { raw: String(raw.slice(0, 64)) }) };
      if (!r.entity) return { notWritten: { row: i, reason: "FUND_NOT_IDENTIFIED", detail: r.why } };
      fund = r.entity;
    }
    const asRead = String(row[roles.amount] ?? "");
    const read = readAmount(asRead, { locale: ctx.locale });
    if (read.refused) return { notWritten: { row: i, reason: read.refused, detail: read.detail } };
    const f = read.figure;
    const currency = f.currency || val(row, "currency") || null;   /* R49: a currency mark in the cell wins over its column's */
    const unsigned = (d) => String(d).replace(/^-/, "");
    const range = f.precision === "range" ? (f.sign === "-" ? { low: unsigned(f.high), high: unsigned(f.low) } : { low: f.low, high: f.high }) : null;
    return { fact: { amount: range || f.value, as_read: asRead, currency, sign: f.sign, precision: f.precision,
      kind: val(row, "kind"), phase: val(row, "phase"), ...(val(row, "stage") ? { stage: val(row, "stage") } : {}),
      basis: val(row, "basis"), period: moneyPeriod(val(row, "period")),
      from: { entity: payer.entity, as_written: String(row[roles.payer]), ...(fund ? { fund } : {}),
        ...(roles.account ? { account: val(row, "account") } : {}) },
      to: { entity: payee.entity, as_written: String(row[roles.payee]) },
      source: { table: b.table_sha, row: ctx.firstRow === null ? i : ctx.firstRow + i, binding: b.binding_key, ...(ingest ? { ingest } : {}) }, method: INGEST_METHOD, by: INGEST_STAMP } };
  }

  #ingestCtx(b) {
    const t = this.#one(`SELECT roles_json, source_json, schema_json FROM calc_tables WHERE sha=?`, b.table_sha);
    /* R47: a table made from a sheet range cites the sheet's own row: the row its first data row stood in, plus the table row */
    const src = parse(t && t.source_json) || {};
    const firstRow = (src.extent_kind === "sheet-range" || src.extent_kind === "sheet-cell") && Number.isInteger(src.first_row) ? src.first_row : null;
    /* R49: the amount column's stated locale (the member's, on its Table Schema field), else the team's (the active profile's) */
    const field = (parse(t && t.schema_json) || { fields: [] }).fields.find((f) => f.name === parse(b.roles_json).amount);
    const view = this.#view();
    const locale = field && typeof field.locale === "string" ? field.locale : view && view.locale && typeof view.locale.value === "string" ? view.locale.value : null;
    return { b, roles: parse(b.roles_json), declared: parse(t && t.roles_json) || {}, resolved: new Map(), firstRow, locale };   /* resolved: this act's (or slice's) cache */
  }

  /** R14: `ingestMoney({binding, rows, reason?, by})`: money facts written through `money.recordFact`, machine-attributed,
   *  only at a member's request, only from an adopted binding, and only for rows whose payer and payee each resolve
   *  through an identifier. `rows` lists row numbers (0-based); every row only with `rows: "all"` and a reason.
   *  (G55) Over INGEST_INLINE_ROWS rows the act stores its record, answers started, and `ingestTick` writes the facts in slices. */
  async ingestMoney({ binding = null, rows = null, reason = null, by = null } = {}) {
    if (!stamped(by) || isMachine(by)) return no("MEMBER_ACT_ONLY", localize("calculations.index.money_facts_are_read_from", "money facts are read from a table only at a member's request (K1468). Nothing was written."));
    if (typeof reason === "string" && [...reason].length > INGEST_REASON_MAX)
      return no("BAD_REASON", localize("calculations.index.a_reason_is_at_most", "a reason is at most {max} characters; shorten it. Nothing was written.", { max: String(INGEST_REASON_MAX) }), { max: INGEST_REASON_MAX });
    const b = typeof binding === "string" ? this.#one(`SELECT * FROM calc_bindings WHERE binding_key=?`, binding) : null;
    if (!b || !this.#sees(b.bundle_id, by)) return no("NO_SUCH_BINDING", "no adopted binding answers to that key here, or it is not one you may see. Nothing was written.");
    /* money is not idempotent by source: one running ingest to a binding */
    const running = this.#one(`SELECT ingest_key FROM calc_ingests WHERE binding_key=? AND state='ingesting'`, b.binding_key);
    if (running)
      return no("ALREADY_INGESTING", localize("calculations.ingest.already", "this table is already being ingested in the background; wait for it to finish (you will be told), then ask again. Nothing was written."), { ingest: running.ingest_key });
    /* G63: the act that only starts a background ingest reads and hashes none of the table's bytes: the count of "all" is the table's record's
       (`calc_tables.rows`, what `textTable` calls its size), and the slices on the alarm leg read the table. Bytes at hand: in the cache or in
       the record's chunked copy; any other table is fetched from the evidence store here, as before. */
    const tableRow = this.#one(`SELECT rows FROM calc_tables WHERE sha=?`, b.table_sha);
    const atHand = !!tableRow && (this.#tableCache.has(b.table_sha) || !!this.#one(`SELECT 1 AS x FROM calc_table_bytes WHERE sha=? LIMIT 1`, b.table_sha));
    let t = null;
    if (!atHand) {
      t = await this.#heldTable(b.table_sha);
      if (!t) return no("NO_SUCH_TABLE", "the binding's table bytes are not held. Nothing was written.");
    }
    let picked = null, total;
    if (rows === "all") {
      if (!str(reason)) return no("NO_REASON", localize("calculations.index.taking_every_row_of_a", "taking every row of a table is the rare case; state the reason (K1468). Nothing was written."));
      total = t ? t.size : tableRow.rows;
    } else if (Array.isArray(rows) && rows.length && rows.every((n) => Number.isSafeInteger(n) && n >= 0)) { picked = [...new Set(rows)].sort((x, y) => x - y); total = picked.length; }
    else return no("NO_ROWS", "name the rows to read into money facts, by number, or every row with rows: \"all\" and a reason. Nothing was written.");
    if (total > INGEST_ROWS_MAX)
      return no("INGEST_TOO_LARGE", localize("calculations.index.one_act_reads_at_most", "one act reads at most {bound_rows} rows and this asks for {rows}; list the rows in windows of at most {bound_rows} (rows: [..]). Nothing was written.", { rows: String(total), bound_rows: String(INGEST_ROWS_MAX) }), { rows: total, bound_rows: INGEST_ROWS_MAX });
    const money = this.dep("money");
    if (!money || typeof money.recordFact !== "function") return no("MONEY_NOT_REACHABLE", "the money module is not reachable here. Nothing was written.");
    if (total > INGEST_INLINE_ROWS) return this.#startIngest({ b, picked, total, rows, reason, by, money });
    if (!t) {
      t = await this.#heldTable(b.table_sha);
      if (!t) return no("NO_SUCH_TABLE", "the binding's table bytes are not held. Nothing was written.");
    }
    if (!picked) picked = Array.from({ length: total }, (_, i) => i);
    const ctx = this.#ingestCtx(b);
    const written = [], notWritten = [];
    /* the picked rows, read in one pass over the held table (ascending, as picked is) */
    const want = new Set(picked);
    const rowAt = new Map();
    let n = 0;
    for (const o of t.objects()) { if (want.has(n)) rowAt.set(n, o); n++; }
    for (const i of picked) {
      const row = rowAt.get(i);
      if (!row) { notWritten.push({ row: i, reason: "NO_SUCH_ROW", detail: "the table holds no such row" }); continue; }
      const j = this.#alreadyWritten(money, ctx, i) || this.#judgeRow(ctx, i, row);
      if (j.notWritten) { notWritten.push(j.notWritten); continue; }
      let r;
      try { r = await money.recordFact(j.fact); } catch (e) { r = { ok: false, reason: "MONEY_THREW", detail: String(e && e.message || e).slice(0, 200) }; }
      if (r && r.ok !== false && (r.fact_id || r.factId)) written.push({ row: i, fact_id: r.fact_id ?? r.factId });
      else notWritten.push({ row: i, reason: r && r.reason ? r.reason : "NOT_RECORDED", detail: r && r.detail ? r.detail : "money did not record the fact" });
    }
    const at = this.now();
    const key = sha({ binding: b.binding_key, rows: picked, by, at });
    /* G45: each of the three values is stored whole in the row while it is at most INGEST_INLINE_MAX bytes, else in pieces,
       the row and its pieces in the one transaction */
    const values = [["rows", rows === "all" ? "all" : picked], ["written", written], ["not_written", notWritten]]
      .map(([kind, v]) => ingestStored(kind, v));
    this.record.transact(() => {
      this.sql.exec(`INSERT OR IGNORE INTO calc_ingests (ingest_key, binding_key, bundle_id, rows_json, reason, written_json, not_written_json, asked_by, at)
                     VALUES (?,?,?,?,?,?,?,?,?)`, key, b.binding_key, b.bundle_id ?? null, values[0].column,
        str(reason) || null, values[1].column, values[2].column, by, at);
      for (const v of values)
        v.chunks.forEach((chunk, seq) => this.sql.exec(`INSERT OR IGNORE INTO calc_ingest_parts (ingest_key, kind, seq, bundle_id, chunk) VALUES (?,?,?,?,?)`,
          key, v.kind, seq, b.bundle_id ?? null, chunk));
      return { ok: true };
    });
    return { ok: true, ingest: key, binding: b.binding_key, written, not_written: notWritten, by: INGEST_STAMP, asked_by: by };
  }

  /* R14 (G55): store the record of an ingest over INGEST_INLINE_ROWS rows, open money's marker for it, and answer started; no fact is written here. */
  #startIngest({ b, picked, total, rows, reason, by, money }) {
    const at = this.now();
    const key = sha({ binding: b.binding_key, rows: picked ?? "all", by, at });
    const stored = ingestStored("rows", picked ?? "all");
    const out = this.record.transact(() => {
      this.sql.exec(`INSERT OR IGNORE INTO calc_ingests (ingest_key, binding_key, bundle_id, rows_json, reason, written_json, not_written_json, asked_by, at,
                       state, next_row, attempts, rows_total, written_count, not_written_count, table_sha)
                     VALUES (?,?,?,?,?,'[]','[]',?,?,'ingesting',0,0,?,0,0,?)`, key, b.binding_key, b.bundle_id ?? null, stored.column,
        str(reason) || null, by, at, total, b.table_sha);
      stored.chunks.forEach((chunk, seq) => this.sql.exec(`INSERT OR IGNORE INTO calc_ingest_parts (ingest_key, kind, seq, bundle_id, chunk) VALUES (?,?,?,?,?)`,
        key, "rows", seq, b.bundle_id ?? null, chunk));
      if (typeof money.markIngest === "function") money.markIngest(key, true);
      this.record.afterCommit(() => {
        for (const l of this.#ingestListeners) { try { const r = l.fn({ at: this.now() }); if (r && typeof r.catch === "function") r.catch(() => {}); } catch { /* the act's, not the listener's */ } }
      });
      return { ok: true };
    });
    if (!out.ok) return out;
    return { ok: true, ingest: key, binding: b.binding_key, state: "ingesting", complete: false, rows_total: total, rows_done: 0,
      written_count: 0, not_written_count: 0, by: INGEST_STAMP, asked_by: by,
      says: localize("calculations.ingest.started", "{rows} rows are being ingested in the background; you will be told when it is done, and the facts it writes are marked as not yet complete until then.", { rows: String(total) }) };
  }

  /** R14 (G55): `onIngestWork(module, fn)`, one registration per module (membership's `listenerRefusal`): told `{at}` after the commit of an act that
   *  starts a background ingest, as `file-safety` tells its consumers (`onFileWork`). */
  onIngestWork(module, fn) {
    const r = listenerRefusal(this.#ingestListeners, module, fn);
    if (r) return r;
    this.#ingestListeners.push({ module, fn });
    return { ok: true, module };
  }

  /* the oldest ingest with a slice to run */
  #nextIngest() {
    return this.#one(`SELECT * FROM calc_ingests WHERE state='ingesting' AND COALESCE(attempts,0) < ? ORDER BY at, rowid LIMIT 1`, INGEST_MAX_ATTEMPTS);
  }
  /** R14 (G55): whether an ingest has a slice to run. Synchronous; never throws. */
  ingestDue() { try { return !!this.#nextIngest(); } catch { return false; } }
  /** R14 (G55): the instant (ms) the next slice is due: `now` while one is, else null. Never throws. */
  ingestWake(now) {
    try {
      const n = typeof now === "number" ? now : Date.parse(now);
      return Number.isFinite(n) && this.#nextIngest() ? n : null;
    } catch { return null; }
  }

  /* stop an ingest for good: its facts stay marked partial in money (the marker is not closed) */
  #stopIngest(key, why) {
    this.record.transact(() => {
      this.sql.exec(`UPDATE calc_ingests SET state='stopped', stop_reason=?, finished_at=? WHERE ingest_key=? AND state='ingesting'`, why, this.now(), key);
      return { ok: true };
    });
  }

  /* the rows an ingest asked for, as it recorded them: "all" or the sorted list */
  #ingestRows(r) {
    const v = parse(r.rows_json);
    if (!plain(v) || typeof v.parts !== "number") return v;
    return parse(this.#rows(`SELECT chunk FROM calc_ingest_parts WHERE ingest_key=? AND kind='rows' ORDER BY seq`, r.ingest_key).map((c) => c.chunk).join(""));
  }

  /** R14 (G55): `ingestTick(now)`: one slice of the oldest running ingest: it judges at most INGEST_SLICE_ROWS rows and writes at most
   *  INGEST_SLICE_FACTS facts, all in one transaction with the pieces of its lists and the advanced cursor, so a throw writes none of it and a
   *  re-run from the stored cursor writes no fact twice. A slice that throws counts one failed attempt (its own transaction); after
   *  INGEST_MAX_ATTEMPTS in a row the ingest is stopped. Answers `{ok, ran, ingest?, state?, judged?, written?, failed?}`; never throws. */
  async ingestTick() {
    let r = null;
    try {
      r = this.#nextIngest();
      if (!r) return { ok: true, ran: false };
      const b = this.#one(`SELECT * FROM calc_bindings WHERE binding_key=?`, r.binding_key);
      const t = b && b.table_sha === r.table_sha ? await this.#heldTable(r.table_sha) : null;
      if (!t) { this.#stopIngest(r.ingest_key, "TABLE_CHANGED"); return { ok: true, ran: true, ingest: r.ingest_key, state: "stopped" }; }
      const money = this.dep("money");
      if (!money || typeof money.recordFact !== "function") throw new Error("the money module is not reachable");
      const spec = this.#ingestRows(r);
      const total = r.rows_total, start = r.next_row ?? 0, end = Math.min(start + INGEST_SLICE_ROWS, total);
      const at = (p) => (spec === "all" ? p : spec[p]);
      const need = new Set();
      for (let p = start; p < end; p++) need.add(at(p));
      const last = need.size ? Math.max(...need) : -1;
      const rowAt = new Map();
      let n = 0;
      for (const o of t.objects()) { if (n > last) break; if (need.has(n)) rowAt.set(n, o); n++; }
      const tagged = typeof money.markIngest === "function" ? r.ingest_key : null;
      const out = this.record.transact(() => {
        const ctx = this.#ingestCtx(b);
        const written = [], notWritten = [];
        let p = start;
        for (; p < end; p++) {
          if (written.length >= INGEST_SLICE_FACTS) break;
          const i = at(p), row = rowAt.get(i);
          if (!row) { notWritten.push({ row: i, reason: "NO_SUCH_ROW", detail: "the table holds no such row" }); continue; }
          const j = this.#alreadyWritten(money, ctx, i) || this.#judgeRow(ctx, i, row, tagged);
          if (j.notWritten) { notWritten.push(j.notWritten); continue; }
          const m = money.recordFact(j.fact);   /* a throw leaves the slice: it is not a property of the row */
          if (m && typeof m.then === "function") throw new Error("money answered a fact asynchronously");
          if (m && m.ok !== false && (m.fact_id || m.factId)) written.push({ row: i, fact_id: m.fact_id ?? m.factId });
          else notWritten.push({ row: i, reason: m && m.reason ? m.reason : "NOT_RECORDED", detail: m && m.detail ? m.detail : "money did not record the fact" });
        }
        for (const [kind, list] of [["written", written], ["not_written", notWritten]]) {
          let seq = this.#one(`SELECT COALESCE(MAX(seq), -1) + 1 AS n FROM calc_ingest_parts WHERE ingest_key=? AND kind=?`, r.ingest_key, kind).n;
          for (let k = 0; k < list.length; k += INGEST_PART_ITEMS)
            this.sql.exec(`INSERT INTO calc_ingest_parts (ingest_key, kind, seq, bundle_id, chunk) VALUES (?,?,?,?,?)`,
              r.ingest_key, kind, seq++, r.bundle_id ?? null, JSON.stringify(list.slice(k, k + INGEST_PART_ITEMS)));
        }
        const done = p >= total;
        this.sql.exec(`UPDATE calc_ingests SET next_row=?, attempts=0, written_count=COALESCE(written_count,0)+?, not_written_count=COALESCE(not_written_count,0)+?,
                         state=?, finished_at=? WHERE ingest_key=?`, p, written.length, notWritten.length, done ? "done" : "ingesting", done ? this.now() : null, r.ingest_key);
        if (done && typeof money.markIngest === "function") money.markIngest(r.ingest_key, false);
        return { ok: true, judged: p - start, written: written.length, state: done ? "done" : "ingesting" };
      });
      if (!out.ok) throw new Error(String(out.detail || out.reason || "the slice was refused"));
      return { ok: true, ran: true, ingest: r.ingest_key, ...out };
    } catch (e) {
      if (!r) return { ok: false, ran: false };
      /* the slice rolled back whole: one failed attempt, counted on its own */
      try {
        this.record.transact(() => {
          const attempts = (this.#one(`SELECT COALESCE(attempts, 0) AS a FROM calc_ingests WHERE ingest_key=?`, r.ingest_key).a) + 1;
          if (attempts >= INGEST_MAX_ATTEMPTS)
            this.sql.exec(`UPDATE calc_ingests SET attempts=?, state='stopped', stop_reason='ATTEMPTS', finished_at=? WHERE ingest_key=?`, attempts, this.now(), r.ingest_key);
          else this.sql.exec(`UPDATE calc_ingests SET attempts=? WHERE ingest_key=?`, attempts, r.ingest_key);
          return { ok: true };
        });
      } catch { /* the attempt could not be counted: the next tick tries again */ }
      return { ok: false, ran: true, ingest: r.ingest_key, failed: String(e && e.message || e).slice(0, 200) };
    }
  }

  /** R14 (G55, G45): `ingestOf(key)`, synchronously: an ingest as it was recorded, `{ingest, binding, bundle_id, rows, reason, written,
   *  not_written, asked_by, at, state}`, each value joined from its pieces exactly as `json` made it (a background ingest's lists from its
   *  pieces, in row order); null when none is held. Cut nowhere. A row stored before reads as `done`. */
  ingestOf(key) {
    const r = typeof key === "string" ? this.#one(`SELECT * FROM calc_ingests WHERE ingest_key=?`, key) : null;
    if (!r) return null;
    const value = (kind, column) => {
      if (r.state != null && kind !== "rows") return this.#ingestItems(r, kind, 0, Infinity);
      const v = parse(column);
      if (!plain(v) || typeof v.parts !== "number") return v;
      const text = this.#rows(`SELECT chunk FROM calc_ingest_parts WHERE ingest_key=? AND kind=? ORDER BY seq`, key, kind).map((c) => c.chunk).join("");
      return parse(text);
    };
    return { ingest: r.ingest_key, binding: r.binding_key, bundle_id: r.bundle_id ?? null, rows: value("rows", r.rows_json), reason: r.reason ?? null,
      written: value("written", r.written_json), not_written: value("not_written", r.not_written_json), asked_by: r.asked_by, at: r.at,
      state: r.state ?? "done" };
  }

  /* a background ingest's list items from `from`, at most `count`, joined from its pieces in order */
  #ingestItems(r, kind, from, count) {
    const out = [];
    let seen = 0;
    for (const c of this.#rows(`SELECT chunk FROM calc_ingest_parts WHERE ingest_key=? AND kind=? ORDER BY seq`, r.ingest_key, kind)) {
      const items = parse(c.chunk) || [];
      if (seen + items.length > from) out.push(...items.slice(Math.max(0, from - seen), Math.max(0, from - seen) + (count - out.length)));
      seen += items.length;
      if (out.length >= count) break;
    }
    return out;
  }

  /** R14 (G55): `ingestRead({ingest, kind, after, limit, viewer})` (`op=moneyingestread`): the state of an ingest (`kind: "state"`), or a page of its
   *  `written` or `not_written` rows in row order from `after` (an item count), at most 1,000 an answer, with the true counts and an explicit
   *  `complete` (false while running or stopped). An ingest the viewer may not see, as the act's `#sees`, answers as an absent one. */
  ingestRead({ ingest = null, kind = "state", after = 0, limit = 100, viewer = null } = {}) {
    const absent = { ok: true, found: false };
    if (!str(ingest)) return no("NO_INGEST", localize("calculations.ingest.no_ingest", "an ingest is read by its key."));
    try {
      const r = typeof ingest === "string" && stamped(viewer) ? this.#one(`SELECT * FROM calc_ingests WHERE ingest_key=?`, ingest) : null;
      if (!r || !this.#sees(r.bundle_id, viewer)) return absent;
      if (!["state", "written", "not_written"].includes(kind)) return no("BAD_KIND", localize("calculations.ingest.bad_kind", "read an ingest's state, its written rows or its not-written rows."));
      const state = r.state ?? "done";
      const old = r.state == null ? this.ingestOf(ingest) : null;
      const written = old ? old.written.length : r.written_count ?? 0, notWritten = old ? old.not_written.length : r.not_written_count ?? 0;
      const head = { ok: true, found: true, ingest, binding: r.binding_key, state, complete: state === "done", rows_total: r.rows_total ?? written + notWritten,
        rows_done: state === "done" ? (r.rows_total ?? written + notWritten) : r.next_row ?? 0, written_count: written, not_written_count: notWritten,
        asked_by: r.asked_by, at: r.at, finished_at: r.finished_at ?? null, ...(state === "stopped" ? { stopped: this.#stopSays(r.stop_reason) } : {}) };
      if (kind === "state") return head;
      const lim = Math.max(1, Math.min(READ_LIMIT_MAX, Number.isInteger(Number(limit)) ? Number(limit) : 100));
      const from = Math.max(0, Number.isInteger(Number(after)) ? Number(after) : 0);
      const total = kind === "written" ? written : notWritten;
      const items = old ? old[kind].slice(from, from + lim) : this.#ingestItems(r, kind, from, lim);
      return { ...head, kind, after: from, limit: lim, items, next: from + items.length < total ? from + items.length : null };
    } catch { return absent; }
  }

  #stopSays(code) {
    return code === "TABLE_CHANGED"
      ? { reason: "TABLE_CHANGED", says: localize("calculations.ingest.stopped_table", "the table this ingest reads is no longer the one it was asked for, so it was stopped; the facts already written stay, marked as not complete.") }
      : { reason: "ATTEMPTS", says: localize("calculations.ingest.stopped_attempts", "this ingest failed three times in a row and was stopped; the facts already written stay, marked as not complete.") };
  }

  /** R14 (G55): `ingestNotices({after, limit, viewer})`: the ingests the viewer asked for that are `done` or `stopped`, in the order they were started
   *  (by row, not by when they finished), for the notice path to tell once each by key (`notice-producers` reads from the start each cycle). `next` is
   *  null on the last page, else the cursor to pass as `after`. Never throws. */
  ingestNotices({ after = 0, limit = 100, viewer = null } = {}) {
    try {
      if (!stamped(viewer)) return { ok: true, items: [], next: null };
      const lim = Math.max(1, Math.min(READ_LIMIT_MAX, Number.isInteger(Number(limit)) ? Number(limit) : 100));
      const from = Number.isInteger(Number(after)) ? Number(after) : 0;
      const items = [];
      let next = null, more = false;
      for (const r of this.#rows(`SELECT rowid AS rid, * FROM calc_ingests WHERE state IN ('done','stopped') AND rowid > ? ORDER BY rowid`, from)) {
        if (!this.#sees(r.bundle_id, viewer) || !sameMember(r.asked_by, viewer)) continue;
        if (items.length >= lim) { more = true; break; }
        items.push({ ingest: r.ingest_key, binding: r.binding_key, state: r.state, rows_total: r.rows_total, written_count: r.written_count ?? 0,
          not_written_count: r.not_written_count ?? 0, finished_at: r.finished_at ?? null, ...(r.state === "stopped" ? { stopped: this.#stopSays(r.stop_reason) } : {}) });
        next = r.rid;
      }
      return { ok: true, items, next: more ? next : null };
    } catch { return { ok: true, items: [], next: null }; }
  }

  /* ===================================================================== *
   * DRAWS AND FROZEN SETS (R18, R21)
   * ===================================================================== */

  /** R18: `draw({set, n, seed?, question?, by, project?})` over a frozen set: a table's sha or a frozen record set's sha.
   *  A question (1 to 2,000 characters) is the words each drawn item is judged by when members visit it (R38); a draw
   *  differing from another only in its question is its own draw and reproduces the same sample. */
  draw({ set = null, n = null, seed = null, question = null, by = null, project = null } = {}) {
    if (!stamped(by)) return no("NO_AUTHOR", "a draw is recorded under the control plane's stamp. Nothing was written.");
    const ref = typeof set === "string" ? set : plain(set) ? (set.table ?? set.set ?? null) : null;
    if (!SHA.test(ref ?? "")) return no("NO_SET", "a draw is over a frozen set: a table's sha256 or a frozen record set's sha256. Nothing was written.");
    if (project !== null && project !== undefined && (!str(project) || !this.#sees(project, by))) return no("NO_SUCH_PROJECT", "no project answers to that id here, or it is not one you may see. Nothing was written.");
    let kind, frame;
    const t = this.#one(`SELECT sha, bundle_id, rows FROM calc_tables WHERE sha=?`, ref);
    const s = t ? null : this.#one(`SELECT set_sha, project, ids_json FROM calc_sets WHERE set_sha=?`, ref);
    if (t && this.#seesTable(t, by)) { kind = "table"; frame = Array.from({ length: t.rows }, (_, i) => String(i)); }
    else if (s && this.#sees(s.project, by)) { kind = "set"; frame = parse(s.ids_json) || []; }
    else return no("NO_SUCH_SET", "no frozen set answers to that sha here, or it is not one you may see. Nothing was written.");
    if (!Number.isSafeInteger(n)) return no("BAD_N", "a draw names how many to draw, a whole number. Nothing was written.");
    const usedSeed = seed === null || seed === undefined ? randomSeed() : seed;
    if (typeof usedSeed !== "string") return no("BAD_SEED", "a seed is text. Nothing was written.");
    const asked = question === null || question === undefined ? null : typeof question === "string" ? question.trim() : "";
    if (asked !== null && !(asked.length && [...asked].length <= QUESTION_MAX))
      return no("BAD_QUESTION", `a draw's question is the words each drawn item is judged by: text of 1 to ${QUESTION_MAX} characters. Nothing was written.`);
    const d = drawFrame({ frame, n, seed: usedSeed });
    if (d.refused) return no(d.refused, `${d.why}. Nothing was written.`);
    /* a draw without a question keeps the key it had before questions (T36) */
    const key = sha({ set: ref, kind, seed: usedSeed, n, method: d.method, ...(asked !== null ? { question: asked } : {}) });
    const held = this.#one(`SELECT * FROM calc_draws WHERE draw_key=?`, key);
    const answer = (r) => ({ ok: true, draw: r.draw_key, set: r.set_sha, set_kind: r.set_kind, seed: r.seed, n: r.n, frame_size: r.frame_size,
      frame_hash: r.frame_hash, method: r.method, sample: parse(r.sample_json), question: r.question ?? null, drawn_by: r.drawn_by, drawn_at: r.drawn_at,
      says: word("calculations.says.seeded_recorded_random") });
    if (held) return { ...answer(held), already: true };
    const at = this.now();
    this.record.transact(() => {
      this.sql.exec(`INSERT INTO calc_draws (draw_key, project, set_kind, set_sha, frame_hash, frame_size, n, seed, method, sample_json, drawn_by, drawn_at, question)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, key, project ? str(project) : null, kind, ref, d.frame_hash, frame.length, n, usedSeed,
        d.method, json(d.sample), by, at, asked);
      return { ok: true };
    });
    return answer(this.#one(`SELECT * FROM calc_draws WHERE draw_key=?`, key));
  }

  /* R18: a recorded draw drawn again from its set, seed and method: `{reproduced, sample}`. */
  #reproduce(d) {
    const frame = d.set_kind === "table" ? Array.from({ length: d.frame_size }, (_, i) => String(i))
      : parse((this.#one(`SELECT ids_json FROM calc_sets WHERE set_sha=?`, d.set_sha) || {}).ids_json) || [];
    const again = drawFrame({ frame, n: d.n, seed: d.seed });
    return { reproduced: !again.refused && canonicalJson(again.sample) === d.sample_json.replace(/\s/g, "") && again.frame_hash === d.frame_hash,
      sample: again.sample ?? null };
  }

  /** R18: a recorded draw, reproduced from its set, seed and method: `{reproduced, sample}`. */
  reproduceDraw({ draw: key = null, viewer = null } = {}) {
    const d = typeof key === "string" ? this.#one(`SELECT * FROM calc_draws WHERE draw_key=?`, key) : null;
    if (!d || !stamped(viewer) || !this.#seesDrawn(d, viewer)) return { ok: true, found: false };
    return { ok: true, found: true, draw: d.draw_key, ...this.#reproduce(d) };
  }

  /* ===================================================================== *
   * SPOT-CHECKS: VISITS TO DRAWN ITEMS (R38–R40)
   * ===================================================================== */

  /** R38: `recordVisit({draw, item, testimony, finding, exhibits?, by})` (`op=spotcheckvisit`): a member's visit to one
   *  drawn item, held as testimony tied to that item: `testimony` the capture of the visitor's own firsthand
   *  observation (provenance's `testify`, an authored register entry whose author is the visitor), `finding` yes, no or
   *  could_not_tell against the draw's question, `exhibits` further held captures the visitor may see (a photo, never
   *  required). Append-only: a member who visits again records a new visit. Calculations over the draw become stale
   *  (R11, R40). */
  recordVisit({ draw: key = null, item = null, testimony = null, finding = null, exhibits = null, by = null } = {}) {
    if (!stamped(by) || isMachine(by)) return no("MEMBER_ACT_ONLY", "a visit is a member's own firsthand act; the machine never records one. Nothing was written.");
    const d = typeof key === "string" ? this.#one(`SELECT * FROM calc_draws WHERE draw_key=?`, key) : null;
    if (!d || !this.#seesDraw(d, by)) return no("NO_SUCH_DRAW", "no recorded draw answers to that key here, or it is not one you may see. Nothing was written.");
    if (d.question === null || d.question === undefined)
      return no("NO_QUESTION", "this draw carries no question, so there is nothing a visit's finding answers; draw again with the question its items are judged by. Nothing was written.");
    if (!(typeof item === "string" && (parse(d.sample_json) || []).map(String).includes(item)))
      return no("NOT_DRAWN", "the item named is not one of the draw's drawn items. Nothing was written.", { item: typeof item === "string" ? item : null });
    const capture = typeof testimony === "string" ? testimony.trim() : "";
    const t = capture ? this.#one(`SELECT capture_sha, bundle_id, authored, author, observed_at FROM register WHERE capture_sha=?`, capture) : null;
    if (!t || Number(t.authored) !== 1 || !this.#sees(t.bundle_id, by))
      return no("NOT_TESTIMONY", "the testimony is the capture of a firsthand observation recorded through testify, one you may see; this is not one. Nothing was written.");
    /* R41: the testimony's author and the visitor compared as the one member each names (membership R43), so the
       founder's `member:admin` testimony is hers when `by` is bare `admin`, and the other way round */
    if (!sameMember(t.author, by)) return no("NOT_YOUR_TESTIMONY", "a visit rests on the visitor's own observation; this testimony was recorded by another member. Nothing was written.");
    if (!VISIT_FINDINGS.includes(finding))
      return no("BAD_FINDING", `a visit's finding is one of ${VISIT_FINDINGS.join(", ")}, against the draw's question. Nothing was written.`);
    const list = exhibits === null || exhibits === undefined ? [] : exhibits;
    if (!Array.isArray(list)) return no("NO_SUCH_EXHIBIT", "exhibits are a list of held captures you may see. Nothing was written.", { exhibit: null });
    const cited = [];
    for (const x of list) {
      const k = typeof x === "string" ? x.trim() : "";
      if (!k || !this.#seesCapture(k, by))
        return no("NO_SUCH_EXHIBIT", "an exhibit names a capture that is not held, or is not one you may see. Nothing was written.", { exhibit: typeof x === "string" ? x : null });
      if (!cited.includes(k)) cited.push(k);
    }
    const at = this.now();
    let seq = 0;
    this.record.transact(() => {
      seq = this.#one(`SELECT COALESCE(MAX(seq), 0) AS n FROM calc_visits WHERE draw_key=?`, d.draw_key).n + 1;
      this.sql.exec(`INSERT INTO calc_visits (draw_key, seq, project, item, testimony, finding, exhibits_json, visitor, observed_at, recorded_at)
                     VALUES (?,?,?,?,?,?,?,?,?,?)`, d.draw_key, seq, d.project ?? null, item, t.capture_sha, finding, json(cited), t.author, t.observed_at ?? null, at);
      /* R38: the visitor kept as provenance records the testimony's author (R41: the one member `by` names) */
      /* R40: an estimate over this draw computed before the visit becomes stale; its stored results never change */
      this.#stale(d.draw_key, "visit_recorded");
      return { ok: true };
    });
    const v = this.#one(`SELECT * FROM calc_visits WHERE draw_key=? AND seq=?`, d.draw_key, seq);
    const standing = standingOf(this.#rows(`SELECT finding FROM calc_visits WHERE draw_key=? AND item=?`, d.draw_key, item).map((r) => r.finding));
    return { ok: true, draw: d.draw_key, ...visitAnswer(v), standing,
      says: word("calculations.says.visit_visitor_testimony") };
  }

  /** R39: `spotCheck({draw, viewer})` (`op=spotcheck`): a spot-check's data: the draw (its set and the set's size, n,
   *  the seed and method, whether it reproduces), its question, each drawn item with its visits in recorded order and
   *  its standing, the counts (summing to n), and the estimates held over the draw with their recompute status. It
   *  computes no estimate (R8). A draw the viewer may not see, or one any of whose visits' testimony or exhibits the
   *  viewer may not see, answers `{found: false}` exactly as an absent one. Writes nothing; never throws. */
  spotCheck(args = {}) {
    const absent = { ok: true, found: false };
    try {
      const { draw: key = null, viewer = null } = plain(args) ? args : {};
      const d = typeof key === "string" && stamped(viewer) ? this.#one(`SELECT * FROM calc_draws WHERE draw_key=?`, key) : null;
      if (!d || !this.#seesDraw(d, viewer)) return absent;
      const items = this.#standings(d);
      const counts = Object.fromEntries(["yes", "no", "could_not_tell", "disagree", "not_visited"].map((s) => [s, items.filter((i) => i.standing === s).length]));
      counts.judged = counts.yes + counts.no;
      const estimates = this.#rows(`SELECT * FROM calculations WHERE kind='estimate' AND calc_id IN (SELECT calc_id FROM calc_inputs WHERE input_kind='draw' AND ref=?)
                                    ORDER BY created_at, rowid`, d.draw_key)
        .filter((c) => this.#visible(c, viewer))
        .map((c) => ({ calc_id: c.calc_id, recompute_status: c.recompute_status, computed_at: c.computed_at, accepted: !!c.accepted_by }));
      return { ok: true, found: true,
        draw: { draw: d.draw_key, set: d.set_sha, set_kind: d.set_kind, set_size: d.frame_size, n: d.n, seed: d.seed, method: d.method,
          frame_hash: d.frame_hash, reproduced: this.#reproduce(d).reproduced, drawn_by: d.drawn_by, drawn_at: d.drawn_at },
        question: d.question ?? null, items, counts, estimates,
        says: word("calculations.says.drawn_item_stands") };
    } catch { return absent; }
  }

  /* R52: each input `{name, set}` whose `set` is a selection handle (`sel-…`, `retrieval`) is resolved under the asking
     member and its ids frozen as a record set with its sha (as `freezeSet` freezes a query's), the input rewritten to
     name that set. Answers `{ok, inputs, pending}`: `pending` holds the sets not yet held, which `create` writes in its
     own transaction (`evaluate` writes none, R7). A handle retrieval refuses is refused as it answers, naming the input. */
  #freezeSelections(inputs, viewer) {
    const pending = new Map();
    if (!Array.isArray(inputs)) return { ok: true, inputs, pending };
    const out = [];
    for (const inp of inputs) {
      if (!plain(inp) || typeof inp.set !== "string" || !inp.set.startsWith("sel-")) { out.push(inp); continue; }
      const retrieval = this.dep("retrieval");
      if (!retrieval || typeof retrieval.selectionResolve !== "function")
        return no("RETRIEVAL_NOT_REACHABLE", localize("calculations.index.the_held_selection_cannot_be", "the held selection cannot be read here. Nothing was written."), { input: inp.name });
      let r;
      try { r = retrieval.selectionResolve({ handle: inp.set, viewer, owner: viewer, weight: "report" }); } catch (e) { r = { ok: false, reason: "RETRIEVAL_THREW", detail: String(e && e.message || e).slice(0, 200) }; }
      if (!r || r.ok === false) {
        const why = r && r.detail ? String(r.detail) : localize("calculations.index.the_selection_could_not_be_read", "it could not be read");
        return { ...(r || no("RETRIEVAL_FAILED", why)), input: inp.name,
          detail: localize("calculations.index.the_input_names_a_selection_refused", "the input \"{name}\" names a selection that was refused: {why}. Nothing was written.", { name: String(inp.name), why }) };
      }
      const ids = [...new Set((r.members || []).filter((x) => typeof x === "string"))].sort();
      const setSha = sha(ids);
      if (!this.#one(`SELECT set_sha FROM calc_sets WHERE set_sha=?`, setSha))
        pending.set(setSha, { set_sha: setSha, project: null, query_json: json({ selection: inp.set, kind: r.kind ?? null, q: r.q ?? null }), ids_json: json(ids), n: ids.length });
      out.push({ ...inp, set: setSha });
    }
    return { ok: true, inputs: out, pending };
  }

  /** R21: `freezeSet({query, by, project?})`: the ids a saved query answers for the asking member (`retrieval`'s
   *  `runSaved`), frozen as a record set with its sha. */
  async freezeSet({ query = null, by = null, project = null } = {}) {
    if (!stamped(by) || isMachine(by)) return no("MEMBER_ACT_ONLY", "a record set is frozen from a member's own saved query. Nothing was written.");
    if (query === null || query === undefined || (typeof query !== "string" && !plain(query))) return no("NO_QUERY", "name the saved query whose answer is frozen. Nothing was written.");
    if (project !== null && project !== undefined && (!str(project) || !this.#sees(project, by))) return no("NO_SUCH_PROJECT", "no project answers to that id here, or it is not one you may see. Nothing was written.");
    const retrieval = this.dep("retrieval");
    if (!retrieval || typeof retrieval.runSaved !== "function") return no("RETRIEVAL_NOT_REACHABLE", "the saved query cannot be run here. Nothing was written.");
    let r;
    try { r = await retrieval.runSaved({ form: query, owner: by, viewer: by, limit: 10000 }); } catch (e) { r = { ok: false, reason: "RETRIEVAL_THREW", detail: String(e && e.message || e).slice(0, 200) }; }
    if (!r || r.ok === false) return { ...(r || no("RETRIEVAL_FAILED", "the saved query answered nothing.")), detail: `${(r && r.detail) || "the saved query was refused"}. Nothing was written.` };
    if (r.truncated) return no("SET_TOO_LARGE", "the saved query answers more ids than one frozen set holds; narrow it, so the count's denominator is whole. Nothing was written.", { total: r.total ?? null });
    const ids = [...new Set((r.ids || []).filter((x) => typeof x === "string"))].sort();
    const setSha = sha(ids);
    const held = this.#one(`SELECT * FROM calc_sets WHERE set_sha=?`, setSha);
    if (held) return { ok: true, already: true, set: setSha, n: held.n, ids };
    const at = this.now();
    this.record.transact(() => {
      this.sql.exec(`INSERT INTO calc_sets (set_sha, project, query_json, ids_json, n, frozen_by, frozen_at) VALUES (?,?,?,?,?,?,?)`,
        setSha, project ? str(project) : null, json(query), json(ids), ids.length, by, at);
      return { ok: true };
    });
    return { ok: true, set: setSha, n: ids.length, ids, frozen_by: by, frozen_at: at, digest: r.digest ?? null,
      says: word("calculations.says.count_set_reproducible") };
  }

  /* ===================================================================== *
   * THE PATTERNS OF APPLICATION: THE HELD USES, FROZEN (R32)
   * ===================================================================== */

  /* R32: a civil-time value of an event's `when`, its first and last local days, or null when it has none. */
  #whenDays(when) {
    if (!plain(when) || typeof when.start !== "string" || typeof when.end !== "string" || !when.zone) return null;
    try {
      const last = new Date(Date.parse(when.end) - 1000).toISOString().replace(/\.\d+Z$/, "Z");
      const a = localDay(when.start, when.zone), b = localDay(last, when.zone);
      return typeof a === "string" && typeof b === "string" ? { start: a, end: b, precision: String(when.precision ?? "") } : null;
    } catch { return null; }
  }

  /* R32: the kinds of direct tie held between `a` and `b` (entity ids), through every registered owner's `neighbours`
     of `a` at one hop: those valid at `when` by their names; an employment ended before it as former employment, and a
     donation made before it as a donation; one whose validity at `when` cannot be decided with that said. Sorted, `;`-joined; empty when none is held. */
  #ties(a, b, when, viewer) {
    if (!str(a) || !str(b)) return "";
    const at = plain(when) && typeof when.value === "string" ? { value: when.value, precision: when.precision, zone: when.zone } : null;
    const found = new Set();
    let owners = [];
    try { owners = this.registry.owners(); } catch { owners = []; }
    for (const o of owners) {
      const kinds = o.kinds.filter((k) => k.class === "declared" || tieOf(k.kind, k.class, { money: { kind: "contribution" } })).map((k) => k.kind);
      if (!kinds.length) continue;
      const cls = new Map(o.kinds.map((k) => [k.kind, k.class]));
      let page = null;
      for (let n = 0; n < 50; n++) {
        let r = null;
        try { r = this.registry.neighbours({ owner: o.owner, node: a, kinds, at: null, page, viewer, scope: null, host: this.host }); } catch { r = null; }
        if (!r || !Array.isArray(r.items)) break;
        for (const it of r.items) {
          if (!plain(it) || (it.from !== b && it.to !== b)) continue;
          const tie = tieOf(it.kind, cls.get(it.kind), it);
          if (!tie) continue;
          let v = "undetermined";
          if (at && plain(it.valid)) { try { v = validAt({ valid: it.valid, basis: null }, at); } catch { v = "undetermined"; } }
          if (v === "in") found.add(tie);
          else if (v === "out") {
            const ended = (tie === "employment" || tie === "donation") && it.valid.to != null
              && (() => { try { return validAt({ valid: { ...it.valid, from: null }, basis: null }, at) === "out"; } catch { return false; } })();
            if (ended) found.add(tie === "employment" ? "former_employment" : "donation");
          } else found.add(word("calculations.validity_act_date", { tie: String(tie) }));
        }
        if (!r.next) break;
        page = r.next;
      }
    }
    return [...found].sort().join(";");
  }

  /* R32: one frozen row from a use as `events.usesOf` answers it (its R45 event with its participants). */
  #useRow(item, viewer) {
    const ev = plain(item) && plain(item.event) ? item.event : item;
    const live = (role) => (Array.isArray(ev.participants) ? ev.participants : [])
      .filter((p) => plain(p) && p.role === role && !p.superseded).map((p) => p.entity_id).filter(Boolean);
    const one = (role) => [...new Set(live(role))].sort().join(";");
    const decider = one("decider"), subject = one("subject");
    const entities = this.dep("entities");
    const ent = (id) => {
      if (!id || id.includes(";")) return null;
      try { const r = entities ? entities.readEntity({ entityId: id, viewer }) : null; return r && r.found ? r.entity : null; } catch { return null; }
    };
    const d = ent(decider), sj = ent(subject);
    const use = plain(ev.use) ? ev.use : ev;   /* events R45: the use's facet, under `use` on its event view */
    const prov = plain(use.provision) ? use.provision : {};
    const days = this.#whenDays(ev.when);
    let stated = 0, fold = "";
    if (plain(use.stated_reason)) {
      stated = 1;
      try {
        /* the passage's whole text, read again (a facet's `words` may be cut); a reason the member may not see folds empty */
        const sr = use.stated_reason;
        const row = sr.withheld ? null : this.#one(`SELECT content_id FROM content WHERE capture_sha=? AND extent=? AND stale=0 LIMIT 1`, sr.capture_sha, canonicalExtent(sr.extent));
        const text = row ? this.content.passageText(row.content_id) : null;
        fold = typeof text === "string" ? foldReason(text) : "";
      } catch { fold = ""; }
    }
    const outcome = plain(use.outcome) ? use.outcome.value : use.outcome;
    const ties = decider && subject && !decider.includes(";") && !subject.includes(";") ? this.#ties(decider, subject, ev.when, viewer) : "";
    return [ev.event_id, ev.kind, str(prov.standard), str(prov.portion), decider, d ? d.kind ?? "" : "", subject, sj ? sj.kind ?? "" : "",
      sj && sj.sector ? String(sj.sector) : "", days ? days.start : "", days ? days.end : "", days ? days.precision : (ev.when ? "undetermined" : ""),
      String(stated), fold, typeof outcome === "string" ? outcome : "", ties];
  }

  /** R32: `freezeUses({provision?, decider?, subject?, kinds?, from?, to?, project?, by})` (`op=usesfreeze`): the held
   *  uses of powers the member may see (`events.usesOf`), frozen as a table input, canonical CSV keyed by its sha256,
   *  one row per act, with its filter, the asking member and the instant. A member freezes, the machine never. */
  async freezeUses({ provision = null, decider = null, subject = null, kinds = null, from = null, to = null, project = null, by = null } = {}) {
    if (!stamped(by) || isMachine(by)) return no("MEMBER_ACT_ONLY", "the held uses are frozen by a member; the machine never freezes them. Nothing was written.");
    if (project !== null && project !== undefined && (!str(project) || !this.#sees(project, by))) return no("NO_SUCH_PROJECT", "no project answers to that id here, or it is not one you may see. Nothing was written.", { project });
    const events = this.dep("events");
    if (!events || typeof events.usesOf !== "function") return no("EVENTS_NOT_REACHABLE", "the held uses of powers cannot be read here. Nothing was written.");
    const filter = Object.fromEntries(Object.entries({ provision, decider, subject, kinds, from, to }).filter(([, v]) => v !== null && v !== undefined));
    const items = [];
    let after = null;
    for (;;) {
      let r;
      try { r = await events.usesOf({ ...filter, ...(after ? { after } : {}), limit: 500, viewer: by }); }
      catch (e) { r = no("EVENTS_THREW", String(e && e.message || e).slice(0, 200)); }
      if (!r || r.ok === false) return { ...(r || no("EVENTS_FAILED", "the uses were not answered")), detail: `${(r && (r.detail || r.why)) || "the uses were not answered"}. Nothing was written.` };
      /* events R46: an act placed nowhere is answered apart, never dropped: it is a row all the same */
      const page = [...(Array.isArray(r.items) ? r.items : []), ...(Array.isArray(r.placed_nowhere) ? r.placed_nowhere : [])];
      items.push(...page);
      if (items.length > USES_MAX) return no("TABLE_TOO_LARGE", `the uses this filter answers are over ${USES_MAX} acts, ${TABLE_MAX_CELLS} cells, the bound; narrow the filter. Nothing was written.`, { bound: "cells", max: TABLE_MAX_CELLS });
      if (!r.truncated || !page.length) break;
      const last = page.at(-1);
      after = typeof r.next === "string" && r.next ? r.next : (plain(last.event) ? last.event : last).event_id;
    }
    if (!items.length) return no("NO_USES", "the filter answers no held use of a power you may see. Nothing was written.", { filter });
    const tb = tableBuilder([...USES_HEADER], USES_FIELDS);
    const ids = [];
    for (const it of items) { const row = this.#useRow(it, by); ids.push(row[0]); tb.push(row); }
    const built = tb.finish();
    if (built.fault || built.tooLarge) return no("TABLE_TOO_LARGE", "the uses do not fit one table. Nothing was written.", { bound: "cells", max: TABLE_MAX_CELLS });
    const at = this.now();
    const answer = () => ({ ok: true, ...this.#tableAnswer(this.#one(`SELECT * FROM calc_tables WHERE sha=?`, built.sha)), filter,
      frozen_by: by, frozen_at: this.#one(`SELECT frozen_at FROM calc_uses WHERE sha=?`, built.sha).frozen_at, n: ids.length,
      says: word("calculations.says.held_uses_powers", { ids: String(ids.length) }) });
    if (this.#one(`SELECT 1 AS x FROM calc_uses WHERE sha=?`, built.sha)) return { ...answer(), already: true };
    const ev = this.record.evidenceStore();
    if (!ev) return no("NO_EVIDENCE_STORE", localize("calculations.index.your_teams_civicsmith_has_no_2", "your team's Civicsmith has no evidence store set up, so the table's bytes cannot be held. Nothing was written."));
    try { await ev.put(built.sha, built.bytes); } catch (e) { return no("EVIDENCE_WRITE_FAILED", `the table's bytes could not be stored: ${String(e && e.message || e).slice(0, 200)}. Nothing was written.`); }
    const bundle = project ? str(project) : null;
    this.record.transact(() => {
      this.sql.exec(`INSERT INTO calc_tables (sha, bundle_id, source_json, schema_json, header_json, roles_json, vintage_key,
                       vintage_json, superseded_by, rows, bytes, undetermined_json, undetermined_count, declared_by, declared_at)
                     VALUES (?,?,?,?,?,NULL,NULL,NULL,NULL,?,?,?,?,?,?)`,
        built.sha, bundle, json({ kind: "uses", filter, frozen_by: by, frozen_at: at }), json({ fields: USES_FIELDS }), json(USES_HEADER),
        built.rows, built.bytes.byteLength, json(built.undetermined), built.count, by, at);
      this.#putChunks(built.sha, bundle, built.bytes);
      this.sql.exec(`INSERT INTO calc_uses (sha, project, filter_json, ids_json, n, frozen_by, frozen_at) VALUES (?,?,?,?,?,?,?)`,
        built.sha, bundle, json(filter), json(ids), ids.length, by, at);
      return { ok: true };
    });
    return answer();
  }

  /** R33: `applicationRecipes()`: the recipes of application, as data, each with its inputs and parameters. */
  applicationRecipes() {
    return { ok: true, recipes: APPLICATION_RECIPES, says: word("calculations.says.instantiated_through_create") };
  }

  /* ===================================================================== *
   * REGISTRATIONS IT FILLS (R19, R20)
   * ===================================================================== */

  /** R19: `duties.registerOccurrenceEvidence`'s answer: the accepted calculations naming the occurrence in `evidences`. */
  occurrenceEvidence({ duty = null, occurrence = null, viewer = null } = {}) {
    const dutyId = plain(duty) ? (duty.duty_id ?? duty.dutyId ?? null) : duty;
    const key = plain(occurrence) ? (occurrence.key ?? occurrence.occurrence_key ?? null) : occurrence;
    if (!str(dutyId) || !str(key)) return [];
    const out = [];
    /* in the order they were created: a CALC- id is opaque (R4), so it orders nothing */
    for (const c of this.#rows(`SELECT * FROM calculations WHERE accepted_by IS NOT NULL AND evidences_json IS NOT NULL ORDER BY created_at, rowid`)) {
      const ev = parse(c.evidences_json) || [];
      if (!ev.some((e) => e.duty === dutyId && e.occurrence === key)) continue;
      if (viewer !== null && !this.#visible(c, viewer)) { out.push({ withheld: true, evidence: null, says: word("calculations.says.calculation_measuring_occurrence") }); continue; }
      const g = this.#gradeFacts(c);
      const terms = parse(c.terms_json) || {};
      const item = { calc_id: c.calc_id, kind: c.kind, results: parse(c.results_json), grade: g.capture, state: c.recompute_status === "stale" ? "stale" : "current",
        cited_as: word("calculations.measured_evidence_calculation"), accepted_by: c.accepted_by, accepted_at: c.accepted_at };
      /* duties R12 reads an item's `when` as the match's date: only a date the calculation's terms state it measures */
      const when = typeof terms.met_on === "string" && isCalendarDate(terms.met_on) ? { value: terms.met_on, precision: "day", zone: "UTC" } : null;
      out.push({ ...item, evidence: { ...item }, ...(when ? { when } : {}) });
    }
    return out;
  }

  /** R20: `people.registerRosterSource`'s answer for an organisation and a date: the rows of tables with roster roles
   *  whose vintage is valid at that date, by person key, with the table's sha. No row is read into a line. Synchronous,
   *  as people asks it (its R18). */
  rosterRows({ organisation = null, at = null, viewer = null } = {}) {
    if (!str(organisation) || !(typeof at === "string" && isCalendarDate(at.slice(0, 10)))) return { rows: [], tables: [], not_read: [], why: localize("calculations.index.an_organisation_and_a_date", "an organisation and a date are needed") };
    const day = at.slice(0, 10);
    const view = this.#view();
    const rows = [], tables = [], notRead = [];
    for (const t of this.#rows(`SELECT * FROM calc_tables WHERE roles_json IS NOT NULL ORDER BY sha`)) {
      const roles = parse(t.roles_json) || {};
      const col = (role) => (Object.entries(roles).find(([, r]) => r.role === role) || [])[0];
      const org = col("roster_organisation"), person = col("roster_person");
      if (!org || !person) continue;
      if (viewer !== null && !this.#sees(t.bundle_id, viewer)) continue;
      const v = parse(t.vintage_json);
      let a = "undetermined";
      if (v) { try { a = validAt({ valid: { from: v.valid.from ?? null, to: v.valid.to ?? null, precision: "day", zone: "UTC" }, basis: v.basis ?? null }, { value: day, precision: "day", zone: "UTC" }, { view }); } catch { a = "undetermined"; } }
      if (a === "out") continue;
      if (a !== "in") { notRead.push({ table: t.sha, why: v ? word("calculations.why.whether_vintage_valid", { day: String(day), first: String(a && a.why ? `: ${reasonText(a.why)}` : "") }) : word("calculations.why.table_states_vintage") }); continue; }
      const g = this.#heldTableSync(t.sha);
      if (!g) { notRead.push({ table: t.sha, why: word("calculations.why.the_table_s_bytes_are") }); continue; }
      tables.push(t.sha);
      const post = col("roster_post"), period = col("roster_period");
      let i = -1;
      for (const r of g.objects()) {
        i++;
        const o = this.#resolveParty(roles[org], r[org]);
        if (!o.entity) { if (String(r[org] ?? "").trim()) notRead.push({ table: t.sha, row: i, why: o.why }); continue; }
        if (o.entity !== str(organisation)) continue;
        rows.push({ person_key: String(r[person] ?? ""), ...(post ? { post: String(r[post] ?? "") } : {}), ...(period ? { period: String(r[period] ?? "") } : {}),
          table: t.sha, row: i });
      }
    }
    return { rows, tables, not_read: notRead, level: word("calculations.held_table"), says: word("calculations.says.roster_rows_answered") };
  }

  /* ===================================================================== *
   * THE MACHINE'S PATTERNS (R22, R23; ./patterns.mjs)
   * ===================================================================== */

  /** R22: `runPatterns({budgetMs})`: evaluate the shipped patterns within the budget into their own result table,
   *  never onto a person or entity row; resumes from where it stopped. Async. */
  async runPatterns({ budgetMs = 1000 } = {}) {
    const start = this.clock();
    const budget = Number.isFinite(Number(budgetMs)) && Number(budgetMs) > 0 ? Number(budgetMs) : 1000;
    const cur = this.#one(`SELECT next_index FROM calc_pattern_cursor WHERE slot='run'`);
    let i = cur ? cur.next_index : 0;
    let evaluated = 0;
    const deps = { money: this.dep("money"), duties: this.dep("duties"), events: this.dep("events"), progressions: this.dep("progressions"),
      viewer: INGEST_STAMP, now: String(this.now()).replace(/\.\d+Z$/, "Z"), view: this.#view() };   /* an instant at seconds, as duties' asOf is */
    while (i < PATTERNS.length) {
      if (evaluated > 0 && this.clock() - start >= budget) break;
      const p = PATTERNS[i];
      let out;
      try { out = await runPattern(p, deps); } catch (e) { out = { results: [], denominator: { n: null, why: word("calculations.why.pattern_evaluated", { entry: String(String(e && e.message || e).slice(0, 200)) }) }, evaluated: 0 }; }
      const at = this.now();
      this.record.transact(() => {
        const seq = this.#one(`SELECT COALESCE(MAX(seq), 0) AS n FROM calc_pattern_runs WHERE pattern=? AND version=?`, p.pattern, p.version).n + 1;
        this.sql.exec(`INSERT INTO calc_pattern_runs (pattern, version, seq, evaluated, denominator_json, at) VALUES (?,?,?,?,?,?)`,
          p.pattern, p.version, seq, out.evaluated || 0, json(out.denominator), at);
        for (const r of out.results) {
          const key = sha({ pattern: p.pattern, version: p.version, subject: r.subject ?? null, value: r.value, rests_on: r.rests_on });
          this.sql.exec(`INSERT OR IGNORE INTO calc_pattern_results (result_key, pattern, version, subject, value_json, denominator_json,
                           derivation_json, rests_on_json, told, at) VALUES (?,?,?,?,?,?,?,?,0,?)`,
            key, p.pattern, p.version, r.subject ?? null, json(r.value), json(r.denominator ?? out.denominator), json(r.derivation), json(r.rests_on || []), at);
        }
        i++;
        this.sql.exec(`INSERT INTO calc_pattern_cursor (slot, next_index) VALUES ('run', ?) ON CONFLICT(slot) DO UPDATE SET next_index=?`, i, i);
        return { ok: true };
      });
      evaluated++;
    }
    const remaining = i < PATTERNS.length;
    if (!remaining) this.record.transact(() => { this.sql.exec(`DELETE FROM calc_pattern_cursor WHERE slot='run'`); return { ok: true }; });
    await this.#tellPatternResults();
    return { ok: true, evaluated, remaining };
  }

  #gate(pattern, version) {
    const g = this.#one(`SELECT * FROM calc_pattern_gates WHERE pattern=? AND version=? ORDER BY seq DESC LIMIT 1`, pattern, version);
    if (!g) return { open: false, reason: "this pattern's false-alarm rate has not been measured on a gold set, so its results are not shown (K1504, M-C8)" };
    const rate = Number(g.false_alarm_rate);
    if (!(rate <= GATE_MAX_RATE)) return { open: false, reason: word("calculations.pattern_measured_false", { false_alarm_rate: String(g.false_alarm_rate), gate_max_rate: String(GATE_MAX_RATE) }), gate: g };
    return { open: true, gate: g };
  }

  /** R23: `recordPatternGate({pattern, goldSet, falseAlarmRate, by})`, an administrator's act. */
  async recordPatternGate({ pattern = null, goldSet = null, falseAlarmRate = null, by = null } = {}) {
    const member = memberOf(by);
    if (!member || !this.membership.isAdministrator(member)) return notAnAdmin(by, "Recording a pattern's gate");
    const p = PATTERNS.find((x) => x.pattern === pattern);
    if (!p) return no("NO_SUCH_PATTERN", `no shipped pattern is named "${String(pattern).slice(0, 64)}". Nothing was written.`);
    if (!str(goldSet)) return no("NO_GOLD_SET", "a gate names the gold set its false-alarm rate was measured on. Nothing was written.");
    const rate = typeof falseAlarmRate === "number" ? falseAlarmRate : typeof falseAlarmRate === "string" && /^\d+(\.\d+)?$/.test(falseAlarmRate) ? Number(falseAlarmRate) : NaN;
    if (!(rate >= 0 && rate <= 1)) return no("BAD_RATE", "a false-alarm rate is a number from 0 to 1. Nothing was written.");
    const at = this.now();
    this.record.transact(() => {
      const seq = this.#one(`SELECT COALESCE(MAX(seq), 0) AS n FROM calc_pattern_gates WHERE pattern=? AND version=?`, p.pattern, p.version).n + 1;
      this.sql.exec(`INSERT INTO calc_pattern_gates (pattern, version, seq, gold_set, false_alarm_rate, recorded_by, at) VALUES (?,?,?,?,?,?,?)`,
        p.pattern, p.version, seq, str(goldSet), String(falseAlarmRate), by, at);
      return { ok: true };
    });
    await this.#tellPatternResults();
    const g = this.#gate(p.pattern, p.version);
    return { ok: true, pattern: p.pattern, version: p.version, false_alarm_rate: String(falseAlarmRate), gold_set: str(goldSet), open: g.open,
      ...(g.open ? {} : { reason: g.reason }) };
  }

  /** R23: `switchPattern({pattern, project, on, by})`: a member of the project switches a pattern off (or back on) for it. */
  switchPattern({ pattern = null, project = null, on = null, by = null } = {}) {
    const member = memberOf(by);
    if (!member) return no("MEMBER_ACT_ONLY", "a pattern is switched by a member. Nothing was written.");
    if (!PATTERNS.some((x) => x.pattern === pattern)) return no("NO_SUCH_PATTERN", `no shipped pattern is named "${String(pattern).slice(0, 64)}". Nothing was written.`);
    if (!str(project) || !this.#sees(project, by)) return no("NO_SUCH_PROJECT", "no project answers to that id here, or it is not one you may see. Nothing was written.");
    if (!this.membership.isJoinedParticipant(str(project), member) && !this.membership.isAdministrator(member))
      return no("NOT_A_PARTICIPANT", "only a member of the project switches a pattern for it. Nothing was written.");
    if (typeof on !== "boolean") return no("BAD_SWITCH", "say on: true or on: false. Nothing was written.");
    const at = this.now();
    this.record.transact(() => {
      const seq = this.#one(`SELECT COALESCE(MAX(seq), 0) AS n FROM calc_pattern_switches WHERE pattern=? AND project=?`, pattern, str(project)).n + 1;
      this.sql.exec(`INSERT INTO calc_pattern_switches (pattern, project, seq, on_state, switched_by, at) VALUES (?,?,?,?,?,?)`,
        pattern, str(project), seq, on ? 1 : 0, by, at);
      return { ok: true };
    });
    return { ok: true, pattern, project: str(project), on, switched_by: by, at };
  }

  #switchedOff(pattern, project) {
    if (!project) return false;
    const s = this.#one(`SELECT on_state FROM calc_pattern_switches WHERE pattern=? AND project=? ORDER BY seq DESC LIMIT 1`, pattern, project);
    return !!s && s.on_state === 0;
  }

  /* Whether `viewer` may see every row a result rests on (K1489): a result resting on a hidden row is withheld whole. */
  async #seesRef(ref, viewer) {
    if (typeof ref !== "string" || !ref) return false;
    try {
      if (/^DUT-/.test(ref)) { const d = this.dep("duties"); const r = d ? await d.readDuty({ dutyId: ref, viewer }) : null; return !!r && r.ok !== false && r.found !== false; }
      if (/^EVT-/.test(ref)) { const e = this.dep("events"); const r = e ? await e.readEvent({ eventId: ref, viewer }) : null; return !!r && r.ok !== false && r.found !== false; }
      if (/^MNY-/.test(ref)) { const m = this.dep("money"); const r = m ? await m.readFact({ factId: ref, viewer }) : null; return !!r && r.ok !== false && r.found !== false; }
      if (/^ENT-/.test(ref)) return true;   /* an entity is not gated (K102) */
      if (/^[0-9a-f]{64}$/.test(ref)) { const r = this.content.contentRow(ref); return r ? this.#sees(r.bundle_id, viewer) : false; }
      return this.#sees(ref, viewer);
    } catch { return false; }
  }

  #resultAnswer(r) {
    return { result: r.result_key, pattern: r.pattern, version: r.version, subject: r.subject ?? null, value: parse(r.value_json),
      denominator: parse(r.denominator_json), derivation: parse(r.derivation_json), rests_on: parse(r.rests_on_json),
      layer: "hypothesis", label: "Noticed", by: "the machine", at: r.at,
      says: word("calculations.says.noticed_machine_worth") };
  }

  /** R23: `patternResults({pattern?, project?, viewer})`: a pattern's results only once its gate is recorded at a
   *  false-alarm rate of at most 20%; until then `{gated: true, reason}`. Each result is the machine's, `layer:
   *  "hypothesis"`, "Noticed"; one resting on a row the viewer may not see is withheld whole and not counted. */
  async patternResults({ pattern = null, project = null, viewer = null } = {}) {
    if (!stamped(viewer)) return no("NO_VIEWER", "pattern results are read under the control plane's stamp.");
    const list = pattern ? PATTERNS.filter((p) => p.pattern === pattern) : PATTERNS;
    if (!list.length) return no("NO_SUCH_PATTERN", `no shipped pattern is named "${String(pattern).slice(0, 64)}".`);
    const out = [];
    for (const p of list) {
      const head = { pattern: p.pattern, version: p.version, label: p.label, denominator: p.denominator, method: p.method };
      if (this.#switchedOff(p.pattern, str(project) || null)) { out.push({ ...head, switched_off: true, says: word("calculations.says.switched_off_project") }); continue; }
      const g = this.#gate(p.pattern, p.version);
      if (!g.open) { out.push({ ...head, gated: true, reason: g.reason }); continue; }
      const results = [];
      for (const r of this.#rows(`SELECT * FROM calc_pattern_results WHERE pattern=? AND version=? ORDER BY result_key`, p.pattern, p.version)) {
        const refs = parse(r.rests_on_json) || [];
        let all = true;
        for (const ref of refs) if (!(await this.#seesRef(ref, viewer))) { all = false; break; }
        if (all) results.push(this.#resultAnswer(r));
      }
      const run = this.#one(`SELECT * FROM calc_pattern_runs WHERE pattern=? AND version=? ORDER BY seq DESC LIMIT 1`, p.pattern, p.version);
      out.push({ ...head, gated: false, false_alarm_rate: g.gate.false_alarm_rate, gold_set: g.gate.gold_set, results, count: results.length,
        last_run: run ? { at: run.at, evaluated: run.evaluated, denominator: parse(run.denominator_json) } : null });
    }
    return { ok: true, patterns: out };
  }

  /** R23: `onPatternResult(module, fn)`: told once per new result whose gate is open (`notice-producers`). */
  onPatternResult(module, fn) {
    const r = listenerRefusal(this.#patternListeners, module, fn);
    if (r) return r;
    this.#patternListeners.push({ module, fn });
    return { ok: true, module };
  }

  async #tellPatternResults() {
    const listeners = this.#ordered(this.#patternListeners);
    for (const p of PATTERNS) {
      if (!this.#gate(p.pattern, p.version).open) continue;
      const fresh = this.#rows(`SELECT * FROM calc_pattern_results WHERE pattern=? AND version=? AND told=0 ORDER BY result_key`, p.pattern, p.version);
      if (!fresh.length) continue;
      this.record.transact(() => { for (const r of fresh) this.sql.exec(`UPDATE calc_pattern_results SET told=1 WHERE result_key=?`, r.result_key); return { ok: true }; });
      for (const r of fresh) for (const l of listeners) { try { await l.fn(this.#resultAnswer(r)); } catch { /* one listener's failure stops no other */ } }
    }
  }
}

/* One instance per host (R29: the tables are declared once). */
const instances = new WeakMap();

/** The module's instance for a host: created on the first call with `deps`, its tables made and declared, and its
 *  registrations made with the upstream modules `deps` names (R11, R19, R20). */
export function calculationsOf(host, deps) {
  let c = instances.get(host);
  if (!c) {
    const d = deps || {};
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    const content = d.content || contentOf(host, { record, membership });
    const provenance = d.provenance || content.provenance || provenanceOf(host, { record, membership });
    c = new Calculations({ ...d, storage: d.storage || host.storage, host, record, membership, content, provenance });
    instances.set(host, c);
    const declared = record.declareTable("calculations", CALCULATIONS_TABLES);
    if (!declared || declared.ok === false) throw new Error(`calculations' tables could not be declared: ${JSON.stringify(declared)}`);
    joinUpstream(c);
  }
  return c;
}

/** R11, R19, R20: the registrations with money, duties and people, made once each when the module is reachable. A
 *  module not yet reachable is joined by a later call (the composition root calls it after building them). */
export function joinUpstream(c) {
  const joined = c.joined || (c.joined = new Set());
  const money = c.dep("money");
  if (money && !joined.has("money") && typeof money.onFactChanged === "function") {
    const r = money.onFactChanged("calculations", (e) => c.moneyChanged(e || {}));
    if (!r || r.ok !== false) joined.add("money");
  }
  const duties = c.dep("duties");
  if (duties && !joined.has("duties") && typeof duties.registerOccurrenceEvidence === "function") {
    const r = duties.registerOccurrenceEvidence("calculations", (q) => c.occurrenceEvidence(q || {}));
    if (!r || r.ok !== false) joined.add("duties");
  }
  const people = c.dep("people");
  if (people && !joined.has("people") && typeof people.registerRosterSource === "function") {
    const r = people.registerRosterSource("calculations", (q) => c.rosterRows(q || {}));
    if (!r || r.ok !== false) joined.add("people");
  }
  return [...joined];
}

/* ===================================================================== *
 * THE OPS MAP (R24)
 * ===================================================================== */

const q = (url, k) => { const v = url && url.searchParams ? url.searchParams.get(k) : null; return v === null ? null : v; };

/** R24: `calculationsOps(calculations, url, body)`: route arms keyed by op name, each a function of no arguments
 *  answering what its service answers. The stamps (`viewer`, `by`) are the control plane's, read from `url`, never
 *  from the body; an act's arguments are read from the body. Which credential reaches each op is `op-declarations`'. */
export function calculationsOps(c, url, body) {
  const b = plain(body) ? body : {};
  const viewer = q(url, "viewer");
  const by = viewer;
  const strip = (o) => { const { by: _b, viewer: _v, author: _a, ...rest } = o; return rest; };
  return {
    tabledeclare: () => c.declareTable({ ...strip(b), by }),
    table: () => c.readTable({ sha: q(url, "sha") ?? b.sha, viewer, limit: q(url, "limit") ?? b.limit ?? 100, after: q(url, "after") ?? b.after ?? 0 }),
    tablesat: () => c.tablesAt({ key: q(url, "key") ?? b.key, at: q(url, "at") ?? b.at, viewer }),
    bindingadopt: () => c.adoptBinding({ ...strip(b), by }),
    moneyingest: () => c.ingestMoney({ ...strip(b), by }),
    moneyingestread: () => c.ingestRead({ ingest: q(url, "ingest") ?? b.ingest, kind: q(url, "kind") ?? b.kind ?? "state", after: q(url, "after") ?? b.after ?? 0, limit: q(url, "limit") ?? b.limit ?? 100, viewer }),
    calculationcreate: () => c.create({ ...strip(b), by }),
    calculationevaluate: () => c.evaluate({ ...strip(b), viewer }),
    calculationaccept: () => c.accept({ calcId: q(url, "id") ?? b.calcId, by }),
    calculation: () => c.read({ calcId: q(url, "id") ?? b.calcId, viewer }),
    calculationdraw: () => c.draw({ ...strip(b), by }),
    spotcheckvisit: () => c.recordVisit({ ...strip(b), by }),
    spotcheck: () => c.spotCheck({ draw: q(url, "draw") ?? b.draw ?? null, viewer }),
    recordset: () => c.freezeSet({ ...strip(b), by }),
    usesfreeze: () => c.freezeUses({ ...strip(b), by }),
    applicationrecipes: () => c.applicationRecipes(),
    patterns: () => c.patternResults({ pattern: q(url, "pattern") ?? b.pattern ?? null, project: q(url, "project") ?? b.project ?? null, viewer }),
    patterngate: () => c.recordPatternGate({ ...strip(b), by }),
    patternswitch: () => c.switchPattern({ ...strip(b), by }),
  };
}

/* R42 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  tabledeclare: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "undetermined", description: localize("calculations.declared.tabledeclare", "table-directed: keyed by a table's digest; writes calculations' rows and moves no bundle"),
    fields: { accepts: ["source","schema","header","roles","vintage"], requires: ["source","schema","header"] } },
  calculationcreate: { classes: ["admin","member","probe"], mutating: true, weight: "undetermined", description: localize("calculations.declared.calculationcreate", "calculation-directed: keyed by a new CALC- id; writes calculations' rows and moves no bundle"),
    fields: { accepts: ["question","terms","period","inputs","recipe","kind","threshold","methodNote","evidences","project","column","part"], requires: ["question","period","inputs","kind"] } },
  moneyingestread: { classes: ["admin","member","probe"], mutating: false, weight: "read", description: localize("calculations.declared.moneyingestread", "read: a money ingest's stored lists, a page at a time, with true counts and whether the ingest is complete (`calculations` R14); writes nothing"),
    fields: { accepts: ["ingest","kind","after","limit"], requires: ["ingest"] } },
  calculationaccept: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "undetermined", description: localize("calculations.declared.calculationaccept", "calculation-directed: keyed by calculation; a member's acceptance after an agreeing recompute"),
    fields: { accepts: ["id","calcId"], requires: [["id","calcId"]] } },
  calculationdraw: { classes: ["admin","member","probe"], mutating: true, weight: "undetermined", description: localize("calculations.declared.calculationdraw", "set-directed: keyed by (set, seed, size, method); records a reproducible draw and moves no bundle"),
    fields: { accepts: ["set","n","seed","question","project"], requires: ["set","n"] } },
  spotcheckvisit: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "reasoned", description: localize("calculations.declared.spotcheckvisit", "draw-directed: keyed by a draw and one drawn item, reached from the spot-check; ties the visitor's own testimony to the item; moves no bundle"),
    fields: { accepts: ["draw","item","testimony","finding","exhibits"], requires: ["draw","item","testimony","finding"] } },
});
