/* events' rows for the two conditions it answers for every module (K1568, K1569; entities' `noSuchEntity` pattern,
   K275): one code minted at one site each, so a later module (progressions, duties) answers through these and holds no
   copy. Their catalogue numbers are promotion's to stamp (plan T33, Choices: promotion's stamp of T33's new rows is
   T34's), so `check` is null until then. The sentences name no act, so they read true wherever they are answered. */
import { word } from "../setup-words/index.mjs";

/** @type {Readonly<Record<string, Readonly<{check: null, where: string, translation: string}>>>} this module's two refusal rows by code (K1568, K1569): each its catalogue row (null until promotion stamps it), where it is minted and its sentence */
export const EVENT_CHECKS = Object.freeze({
  NO_SUCH_EVENT: Object.freeze({
    check: null,
    where: "src/events/index.mjs noSuchEvent > is-event-held",
    translation: word("refusal.NO_SUCH_EVENT"),
  }),
  NO_SUCH_DATED_FACT: Object.freeze({
    check: null,
    where: "src/events/index.mjs noSuchDatedFact > is-dated-fact-held",
    translation: word("refusal.NO_SUCH_DATED_FACT"),
  }),
});
