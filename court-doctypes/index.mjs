/* court-doctypes: three content types that read a proceeding's register, and the register row diff
 * (`build/requirements/court-doctypes.md`; plan T33-16; K1443, K1480, K1492, K1506).
 *
 * Each type is docprofile's content-type shape, `{key, label, version, contract, detect, parse, assess}`,
 * registered through docprofile's registry seam by `registerCourtTypes(register)`, which `plane` calls at
 * composition after `roster-reader`'s types and before `generic`. A reading gives the proceeding's number,
 * caption and status as written and the register's rows, keyed the way each register allows; `assess`
 * compares two readings row by row. It registers no proceeding and writes no event (R14): those are
 * `entities`' and `events`' acts. */
import courtlistenerDocket from "./courtlistener.mjs";
import cpucProceeding from "./cpuc.mjs";
import ecourtRoa from "./ecourt.mjs";

export { courtlistenerDocket, cpucProceeding, ecourtRoa };
export { sealingOf } from "./common.mjs";

/** The three types, in the order they are registered. */
export const COURT_TYPES = Object.freeze([courtlistenerDocket, cpucProceeding, ecourtRoa]);
export const KEYS = Object.freeze(COURT_TYPES.map((t) => t.key));

/** Register the three types through docprofile's seam (`register(type)`), in order. Returns what each
 *  call returned, so the caller can see a refusal; never throws on a seam that refuses. */
export function registerCourtTypes(register) {
  if (typeof register !== "function") return COURT_TYPES.map((t) => ({ key: t.key, registered: false, why: "no register function was given" }));
  return COURT_TYPES.map((t) => {
    try { return { key: t.key, registered: true, result: register(t) }; }
    catch (e) { return { key: t.key, registered: false, why: String((e && e.message) || e) }; }
  });
}
