/* roster-reader: rosters, organisation charts and staff-directory names, read as the documents state
 * them (T33-15; K1452, K1484 row 12, K1505 (6), (17)).
 *
 * Two content types for `docprofile`'s registry, registered through `registerRosterTypes(register)`, which
 * `plane` wires after `doctypes`' types and before `generic`; `rosterColumns`, the roles of a captured
 * roster table's columns, which `people.staffingAt` reads through its roster source; and
 * `directoryPersonRefs`, a staff directory's contact entries as person references graded C; and `rosterSource`
 * (R12), the roster source `plane` registers into `people`, reading the held rosters the store's read hands it.
 *
 * EVERYTHING HERE IS A READING (R10). No post, holder, reporting line or identity is written: lines and
 * identity claims are proposed elsewhere and adopted by a member (K1443, K1452). This module holds no store
 * (R12's `reads` is handed in by the composition root) and reads no network, and takes every local word from the view it is given (R8). */
import orgChart from "./org-chart.mjs";
import staffRoster from "./staff-roster.mjs";

export { rosterColumns, ROLES } from "./columns.mjs";
export { directoryPersonRefs, NAME_GRADE } from "./directory-refs.mjs";
export { rosterSource, LEVEL_READ, LEVEL_NOT_READ } from "./source.mjs";
export { ROSTER_FLOOR, ROSTER_SHARE, DIRECTORY_FLOOR } from "./staff-roster.mjs";
export { CHART_FLOOR, CHART_MIN_LABELS, CHART_SHARE, CHART_SHORT } from "./org-chart.mjs";
export { staffRoster, orgChart };

/* The order is load-bearing (`docprofile` R4: the first CERTAIN match wins): the roster first, because a
   roster's rows are its own evidence, while a chart's boxes are also printed in a roster's post lines. */
export const ROSTER_TYPES = Object.freeze([staffRoster, orgChart]);

const DONE = new WeakMap();
/** Calls `register` once per type, in ROSTER_TYPES' order. Called twice with the same `register`, it
 *  registers nothing the second time. */
export function registerRosterTypes(register) {
  if (typeof register !== "function") throw new TypeError("registerRosterTypes: register must be a function");
  const done = DONE.get(register) || new Set();
  for (const t of ROSTER_TYPES) {
    if (done.has(t.key)) continue;
    register(t);
    done.add(t.key);
  }
  DONE.set(register, done);
  return ROSTER_TYPES.map((t) => t.key);
}
