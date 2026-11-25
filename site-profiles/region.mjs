/* The three regions a document is separated into (index.mjs' header gives the model).
   A leaf of its own so the handlers can name a region without importing index.mjs,
   which imports and registers them: the module registers its own handlers with no
   import cycle. */
export const REGION = { EVIDENTIARY: "evidentiary", PRESENTATIONAL: "presentational", MECHANICAL: "mechanical" };
