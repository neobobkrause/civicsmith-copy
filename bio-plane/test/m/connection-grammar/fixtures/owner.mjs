/* A sample owner of connections, written the way an owner's job would write one, with switches that break one rule
   of the neighbours contract each, so the battery (R9) and the registry's read (R6–R8) can be shown to catch it. */
import { validAt } from "../../../../src/civil-time/index.mjs";
import { derivedId, DECLARED_LABEL, HUNCH_LABEL } from "../../../../src/connection-grammar/index.mjs";
import { isList } from "../../../../src/connection-grammar/raw.mjs";
/** @import { Grade, Derivation, KindSpec } from "../../../../src/connection-grammar/shape.mjs" */

/**
 * A validity as the sample owner states it: its two ends, a precision and a zone.
 * @typedef {Object} SampleValidity
 * @property {string | null | {event: string, edge: string}} from
 * @property {string | null | {event: string, edge: string}} to
 * @property {string} precision
 * @property {string} zone
 */
/**
 * One connection the sample owner holds, in R1's shape, with who may see it where it is fenced.
 * @typedef {Object} SampleConnection
 * @property {string} id
 * @property {string} from
 * @property {string} to
 * @property {string} kind
 * @property {string} owner
 * @property {SampleValidity} valid
 * @property {{source: string}[]} evidence
 * @property {Grade | null} grade
 * @property {Derivation | null} derived
 * @property {string | undefined} [label]
 * @property {string} [scope]
 * @property {string[]} [seen_by]
 * @property {{why: unknown}} [undetermined]
 */
/**
 * The battery's fixture for the sample owner (R9).
 * @typedef {Object} SampleFixture
 * @property {string} node
 * @property {{value: string, precision: string, zone: string}} at
 * @property {string} [in]
 * @property {string} [out]
 * @property {string} [undetermined]
 * @property {{sees: string, blind: string}} viewers
 * @property {string} [fenced]
 * @property {string[]} expected
 * @property {string} scope
 * @property {string} hunch
 * @property {{node: string, at: {value: string, precision: string, zone: string}}} hub
 */
/**
 * What the registry and the battery hand an owner's read: the node, the kinds asked, the date, the page, the member
 * reading and the working inquiry, each as the caller gave it.
 * @typedef {Object} ReadArgs
 * @property {unknown} [node]
 * @property {unknown} [kinds]
 * @property {unknown} [at]
 * @property {unknown} [page]
 * @property {unknown} [viewer]
 * @property {unknown} [scope]
 */

export const NODE = "ENT-2026-0001";
export const HUB = "ENT-2026-9999";
export const INQUIRY = "INQ-2026-0001-a-question";
export const AT = { value: "2026-03-01", precision: "day", zone: "America/Los_Angeles" };
/** @type {KindSpec[]} */
export const KINDS = [
  { kind: "sample_tie", word: "tied to", class: "evidentiary" },
  { kind: "sample_mention", word: "mentioned together", class: "derived" },
  { kind: "sample_said", word: "said to be linked", class: "declared" },
  { kind: "sample_guess", word: "a hunch about", class: "hunch" },
];
const ZONE = "America/Los_Angeles";
/**
 * A day-precision validity in the sample's zone.
 * @param {string | null | {event: string, edge: string}} from
 * @param {string | null | {event: string, edge: string}} to
 * @returns {SampleValidity}
 */
export const valid = (from, to) => ({ from, to, precision: "day", zone: ZONE });
const IN = valid("2025-01-01", "2027-01-01");

/**
 * An evidentiary connection of the sample owner.
 * @param {string} id
 * @param {string} from
 * @param {string} to
 * @param {SampleValidity} [v]
 * @param {{seen_by?: string[], kind?: string, grade?: Grade}} [extra]
 * @returns {SampleConnection}
 */
export function tie(id, from, to, v = IN, extra = {}) {
  return { id, from, to, kind: "sample_tie", owner: "sample", valid: v, evidence: [{ source: "INFO-2026-0001-a-source" }],
    grade: { assertion: "B", ends: ["A", "B"] }, derived: null, ...extra };
}
/**
 * A derived connection of the sample owner, its id `derivedId` of its five fields.
 * @param {string} from
 * @param {string} to
 * @param {SampleValidity} [v]
 * @returns {SampleConnection}
 */
export function mention(from, to, v = IN) {
  const d = { method: "co-mention", inputs: ["INFO-2026-0001-a-source"], as_of: "2026-02-01" };
  return { id: derivedId({ kind: "sample_mention", from, to, as_of: d.as_of, method: d.method }), from, to, kind: "sample_mention",
    owner: "sample", valid: v, evidence: [], grade: { assertion: "C", ends: ["B", "C"] }, derived: d };
}
/**
 * A declared connection of the sample owner.
 * @param {string} id
 * @param {string} from
 * @param {string} to
 * @param {SampleValidity} [v]
 * @returns {SampleConnection}
 */
export function said(id, from, to, v = IN) {
  return { id, from, to, kind: "sample_said", owner: "sample", valid: v, evidence: [], grade: { assertion: "D", ends: ["B", "B"] },
    derived: null, label: DECLARED_LABEL };
}
/**
 * A hunch of the sample owner, held by a working inquiry.
 * @param {string} id
 * @param {string} from
 * @param {string} to
 * @param {string} [scope]
 * @param {SampleValidity} [v]
 * @returns {SampleConnection}
 */
export function guess(id, from, to, scope = INQUIRY, v = IN) {
  return { id, from, to, kind: "sample_guess", owner: "sample", valid: v, evidence: [], grade: null, derived: null, label: HUNCH_LABEL, scope };
}

/** An undated validity: the owner states no dates (R9's `undated` declaration). */
/** @type {SampleValidity} */
export const UNDATED = { from: null, to: null, precision: "day", zone: ZONE };
Object.freeze(UNDATED);

/**
 * The owner's held connections, each with who may see it (`seen_by`, absent for everyone). `undated`: every validity
 * states no dates; `groupWide`: nothing is fenced (R9's declarations).
 * @param {{undated?: boolean, groupWide?: boolean}} [mode]
 * @returns {SampleConnection[]}
 */
export function held(mode = {}) {
  /** @type {SampleConnection[]} */
  const rows = [
    tie("c-in", NODE, "ENT-2026-0002"),
    tie("c-out", NODE, "ENT-2026-0003", valid("2020-01-01", "2021-01-01")),
    tie("c-undetermined", "ENT-2026-0004", NODE, valid("2025-01-01", null)),
    { ...tie("c-fenced", NODE, "ENT-2026-0005"), seen_by: ["alice"] },
    mention(NODE, "ENT-2026-0006"),
    said("c-said", NODE, "ENT-2026-0007"),
    guess("c-guess", NODE, "ENT-2026-0008"),
  ];
  for (let i = 0; i < 250; i++) rows.push(tie(`c-bulk-${String(i).padStart(4, "0")}`, NODE, `ENT-2026-${String(1000 + i)}`));
  for (let i = 0; i < 1001; i++) rows.push(tie(`h-${String(i).padStart(4, "0")}`, HUB, `ENT-2026-${String(3000 + i)}`));
  return rows.map(({ seen_by, ...c }) => ({ ...c, ...(mode.undated ? { valid: { ...UNDATED } } : {}),
    ...(seen_by && !mode.groupWide ? { seen_by } : {}) }));
}

/**
 * The fixture that goes with `held(mode)`. An undated owner names no connection in, out or undetermined at the date;
 * a group-wide owner names no fenced item.
 * @param {{undated?: boolean, groupWide?: boolean}} [mode]
 * @returns {SampleFixture}
 */
export function fixture(mode = {}) {
  const visible = held(mode).filter((c) => (c.from === NODE || c.to === NODE) && (mode.undated || c.id !== "c-out"));
  /** @type {SampleFixture} */
  const fx = { node: NODE, at: AT, in: "c-in", out: "c-out", undetermined: "c-undetermined", viewers: { sees: "alice", blind: "bob" },
    fenced: "c-fenced", expected: visible.map((c) => c.id), scope: INQUIRY, hunch: "c-guess", hub: { node: HUB, at: AT } };
  if (mode.undated) { delete fx.in; delete fx.out; delete fx.undetermined; }
  if (mode.groupWide) delete fx.fenced;
  return fx;
}

/**
 * An owner's `neighbours`; `broken` names the one rule it breaks; `mode` as `held`, and `unread`, a list it adds to
 * every answer at the fixture's node (R20).
 * @param {string} [broken]
 * @param {{undated?: boolean, groupWide?: boolean, unread?: unknown}} [mode]
 * @returns {(args: ReadArgs) => unknown}
 */
export function makeNeighbours(broken, mode = {}) {
  const rows = held(mode);
  let calls = 0;
  /**
   * A held connection as the owner answers it, without who may see it.
   * @param {SampleConnection} held
   * @returns {SampleConnection}
   */
  const strip = ({ seen_by, ...c }) => c;
  return function neighbours({ node, kinds, at, page, viewer, scope }) {
    calls++;
    if (broken === "async") return Promise.resolve({ items: [] });
    if (broken === "throws") throw new Error("the store is closed");
    if ((viewer === undefined || viewer === null) && broken !== "viewer") return { refused: "VIEWER_MISSING", why: "no viewer" };
    /** @type {SampleConnection[]} */
    let set = [];
    for (const c of rows) {
      if (c.from !== node && c.to !== node) continue;
      if (isList(kinds) && !kinds.includes(c.kind) && broken !== "kinds") continue;
      const seenBy = c.seen_by;
      if (seenBy && !(typeof viewer === "string" && seenBy.includes(viewer)) && broken !== "sight") continue;
      if (c.kind === "sample_guess" && c.scope !== scope && broken !== "scope") continue;
      const v = validAt({ valid: c.valid }, at);
      if (v === "out" && broken !== "out") continue;
      const item = strip(c);
      set.push(v === "in" || broken === "unmarked" ? item : { ...item, undetermined: { why: v.why } });
    }
    if (broken === "label") set = set.map((c) => (c.kind === "sample_said" ? { ...c, label: undefined } : c));
    if (broken === "derived") set = set.map((c) => (c.kind === "sample_mention" ? { ...c, id: "not-the-derived-id" } : c));
    if (broken === "foreign") set.push({ ...tie("c-foreign", String(node), "ENT-2026-0099"), kind: "another_kind" });
    if (broken === "nodeless") set.push(tie("c-nodeless", "ENT-2026-0098", "ENT-2026-0099"));
    set.sort((a, b) => (a.id < b.id ? -1 : 1));
    if (broken === "nondeterministic" && calls % 2) set.reverse();
    if (set.length > 1000 && broken !== "hub" && broken !== "fanout") {
      if (broken === "partialhub") return { items: set.slice(0, 10), hub: { set_size: set.length, why: "a hub" } };
      return { items: [], hub: { set_size: set.length, why: "more than 1000 connections" } };
    }
    const size = broken === "fanout" ? 1500 : 100;
    const start = typeof page === "number" ? page : 0;
    const items = set.slice(start, start + size);
    const end = start + size;
    if (broken === "paging" && start > 0) return { items: items.slice(1) };
    const listed = mode.unread;
    const unread = listed !== undefined && node === NODE ? { unread: listed } : {};
    return end < set.length ? { items, next: end, ...unread } : { items, ...unread };
  };
}
