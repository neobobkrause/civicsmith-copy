/* The three regions a document is separated into (index.mjs' header gives the model).
   A leaf of its own so the handlers can name a region without importing index.mjs,
   which imports and registers them: the module registers its own handlers with no
   import cycle. */
/**
 * @typedef {"evidentiary" | "presentational" | "mechanical"} Region the region a rule or a boundary reports under (R8)
 */

/**
 * The three region labels, and the only three (R8).
 * @type {{ EVIDENTIARY: Region, PRESENTATIONAL: Region, MECHANICAL: Region }}
 * @bound the three labels are exactly "evidentiary", "presentational" and "mechanical"; no other label is reported
 */
export const REGION = { EVIDENTIARY: "evidentiary", PRESENTATIONAL: "presentational", MECHANICAL: "mechanical" };
