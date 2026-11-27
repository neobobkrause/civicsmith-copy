/* doctypes — the content types, split from docprofile by copy (T33-13; K617); eight since
 * T35-12 added `policy`.
 *
 * What kind of document a capture is, what is in it, and whether a change between two
 * readings of it is meaningful. Each type recognises a document by the vocabulary the
 * active jurisdiction profiles supply (`ctx.view`), through docprofile's shared helpers,
 * and holds no place's vocabulary itself (R3, R20).
 *
 * THE ORDER IS LOAD-BEARING (R1). docprofile's `doctypeFor` takes the first type that
 * matches at CERTAIN, so registration order decides a certain/certain tie. Minutes come
 * before the agenda (an agenda packet can be both; the rarer reading is offered first),
 * the substance types before the directory (a report carrying a contact block is a
 * report first), `policy` after `regulation` (an ordinance or code section is read as law and
 * a staff report citing a policy as a report, before either is read as a policy), and
 * `generic`, the one fallback, last. The reasons are recorded at each
 * type's own header and at docprofile's registry, where this order was first measured.
 *
 * This module does not register itself anywhere: `registerDoctypes(register)` is how a
 * composition root (the plane) wires the types into docprofile's registry (R2). */
import meetingCalendar from "./meeting-calendar.mjs";
import meetingMinutes from "./meeting-minutes.mjs";
import meetingAgenda from "./meeting-agenda.mjs";
import staffReport from "./staff-report.mjs";
import regulation from "./regulation.mjs";
import policy from "./policy.mjs";
import staffDirectory from "./staff-directory.mjs";
import generic from "./generic.mjs";

/** @import { ContentType } from "../docprofile/doctypes/index.mjs" */

/**
 * A registry's `register` function: handed one type at a time.
 * @typedef {(type: ContentType) => unknown} RegisterType
 */
/**
 * A registry handed whole (`makeRegistry()`'s): its `register` method and, where it has one, `all`, the members it holds.
 * @typedef {Object} DoctypeRegistry
 * @property {RegisterType} register
 * @property {(() => ReadonlyArray<HeldType | null | undefined>) | undefined} [all]
 */
/**
 * A member a registry already holds, as `registerDoctypes` reads it: by its key.
 * @typedef {{ readonly key?: unknown }} HeldType
 */
/**
 * What `registerDoctypes` answers: how many types it added, and why none, when none.
 * @typedef {Object} Registered
 * @property {number} registered
 * @property {string | null} why
 */

/** The eight types in their registration order (R1), each as docprofile's `ContentType`. @type {ContentType[]} */
const ORDER = [meetingCalendar, meetingMinutes, meetingAgenda, staffReport, regulation, policy, staffDirectory, generic];
/** The eight types in their registration order (R1). Frozen: the order is a fact other
 *  modules rest on, not a list a caller may edit.
 *  @type {ReadonlyArray<ContentType>} */
export const DOCTYPES = Object.freeze(ORDER);

/* Which registrations have already received the types. A `register` function is
   remembered by identity; a registry object (`makeRegistry()`'s, passed whole) also by
   the members it already holds, so a second call, through either, adds nothing. */
/** @type {WeakSet<object>} */
const REGISTERED = new WeakSet();
/** No member held. @type {ReadonlyArray<unknown>} */
const NONE_HELD = Object.freeze([]);

/** Register every type, once each, in R1's order (R2). `register` is a registry's
 *  `register` function, or the registry itself (anything with a `register` method).
 *  Called again on the same registry it registers nothing, and says how many it added.
 *  @param {RegisterType | DoctypeRegistry | null | undefined} register
 *  @returns {Registered}
 *  @throws {TypeError} when `register` is neither a function nor an object with a `register` method */
export function registerDoctypes(register) {
  const target = register && typeof register === "object" && typeof register.register === "function" ? register : null;
  const fn = target ? (/** @type {ContentType} */ m) => target.register(m) : register;
  if (typeof fn !== "function")
    throw new TypeError("registerDoctypes needs a registry's register function, or the registry itself");
  /* With no registry, `fn` is `register` itself. */
  const key = target || fn;
  if (REGISTERED.has(key)) return { registered: 0, why: "the types are already registered here" };
  const all = target ? target.all : undefined;
  /** @type {Set<unknown>} */
  const held = target && typeof all === "function" ? new Set(all.call(target).map((m) => m && m.key)) : new Set(NONE_HELD);
  let n = 0;
  for (const t of DOCTYPES) {
    if (held.has(t.key)) continue;
    fn(t);
    n++;
  }
  REGISTERED.add(key);
  if (target && typeof target.register === "function") REGISTERED.add(target.register);
  return { registered: n, why: n ? null : "every type was already held by this registry" };
}

export { meetingCalendar, meetingMinutes, meetingAgenda, staffReport, regulation, policy, staffDirectory, generic };
