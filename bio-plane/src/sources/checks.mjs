/* sources' refusal rows (requirements: `build/requirements/sources.md`, R14). DEC-49: every refusal this module answers
 * carries its code, its row and the member's translation, so a surface shows the same sentence wherever the act is
 * reached. A new module with nothing moved (K509 (1), N364): the rows are its own new family, C-121, "a source's
 * disclosures", held here and nowhere else (K174). Each code is minted at one site, the DEC-49 region its `where`
 * names. No translation names a place (R14, `layers.md` rule 1), and none carries a value (R13). */

import { word, localize } from "../setup-words/index.mjs";

const at = (fn, region) => `src/sources/checks.mjs ${fn} > ${region}`;

/** One refusal this module answers (DEC-49, R14): `ok: false`, its `reason` and `code` (the same word), its row's
 *  `check` (C-121.n) and the member's `translation`, a plain `detail`, and, where the refusal names one, the `field`
 *  at fault, or the `source` or `captureSha` asked about. A caller's `extra` fields sit beside these. No field carries
 *  a stored value (R13).
 * @typedef {{ok: false, reason: string, code: string, check: string, translation: string, detail: string,
 *            [field: string]: any}} Refusal */

/** One row of the family: its check number, the one site that mints its refusal (`where`) and its translation.
 * @typedef {{check: string, where: string, translation: string}} SourcesCheckRow */

/** R14: the family C-121, "a source's disclosures", one row for each code this module refuses with, frozen. */
export const SOURCES_CHECKS = Object.freeze({
  NO_SUCH_SOURCE: Object.freeze({
    check: 'C-121.1', where: at("noSuchSource", "is-source-held"),
    translation: word('refusal.NO_SUCH_SOURCE'),
  }),
  BAD_DISCLOSURE: Object.freeze({
    check: 'C-121.2', where: at("badDisclosure", "is-disclosure-well-formed"),
    translation: localize('sources.checks.a_disclosure_names_what_was_revealed', 'A disclosure names what was revealed (a pseudonym link, an attribute or a name), how it became known, and to whom it is known, each from the listed choices. The field that is not one of them is named. Nothing was written.'),
  }),
  NO_EVIDENCE: Object.freeze({
    check: 'C-121.3', where: at("noEvidence", "is-evidence-named"),
    translation: word('refusal.NO_EVIDENCE'),
  }),
  NO_SIGHT_LIST: Object.freeze({
    check: 'C-121.4', where: at("noSightList", "is-sight-listed"),
    translation: word("refusal.NO_SIGHT_LIST"),
  }),
  CONSENT_NOT_STANDING: Object.freeze({
    check: 'C-121.5', where: at("consentNotStanding", "is-consent-standing"),
    translation: word("refusal.CONSENT_NOT_STANDING"),
  }),
  SECRET_NOT_RECOGNISED: Object.freeze({
    check: 'C-121.6', where: at("secretNotRecognised", "is-secret-recognised"),
    translation: localize('sources.checks.that_secret_was_not_recognised', 'That secret was not recognised, so nothing was recorded. Check it and try again.'),
  }),
  /* R16 (T33-22; K1492 (3), K1449): marking a member-keyed result. */
  MACHINE_CANNOT_MARK: Object.freeze({
    check: 'C-121.7', where: at("machineCannotMark", "is-member-marking"),
    translation: localize("sources.checks.only_a_member_acting_for", "Only a member, acting for themselves, can mark a result from a paid or account-gated service; no machine, scheduled task or unattended process can. Nothing was written."),
  }),
  NOT_YOUR_CAPTURE: Object.freeze({
    check: 'C-121.8', where: at("notYourCapture", "is-own-capture"),
    translation: word("refusal.NOT_YOUR_CAPTURE"),
  }),
  NO_SUCH_CAPTURE: Object.freeze({
    check: 'C-121.9', where: at("noSuchCapture", "is-capture-held"),
    translation: word('refusal.NO_SUCH_CAPTURE'),
  }),
  NO_SERVICE: Object.freeze({
    check: 'C-121.10', where: at("noService", "is-service-named"),
    translation: localize('sources.checks.a_result_names_the_service', 'A result from a paid or account-gated service names the service it came from. Name it. Nothing was written.'),
  }),
});

/* Each code's one site. The refusal is written whole inside its region, its code a string literal, so the DEC-49
   guard can compare it with the row; `extra` adds a caller's own fields and never replaces the refusal's own. */
const ROW = SOURCES_CHECKS;

/** C-121.1: no source this caller may see answers to the id (or the capture).
 * @param {any} source the id asked about; kept, cut to 64 characters, when it is text, else null
 * @param {Object<string, any>} [extra] the caller's own fields, set beside the refusal's
 * @returns {Refusal} */
export function noSuchSource(source, extra) {
  /* DEC-49 REGION is-source-held */
  return { ...(extra || {}), ok: false, reason: "NO_SUCH_SOURCE", code: "NO_SUCH_SOURCE",
           check: ROW.NO_SUCH_SOURCE.check, translation: ROW.NO_SUCH_SOURCE.translation,
           detail: "no source this caller may see answers to that id, so nothing was written",
           source: typeof source === "string" ? source.slice(0, 64) : null };
  /* END DEC-49 REGION is-source-held */
}

/** C-121.2: a field of the call is not one of its listed choices, or is malformed; the refusal names it.
 * @param {string} field the field at fault, as the call names it (`revealed.kind`, `how`, `audience`, ...)
 * @param {string} detail what the field must be
 * @param {Object<string, any>} [extra] the caller's own fields
 * @returns {Refusal} */
export function badDisclosure(field, detail, extra) {
  /* DEC-49 REGION is-disclosure-well-formed */
  return { ...(extra || {}), ok: false, reason: "BAD_DISCLOSURE", code: "BAD_DISCLOSURE",
           check: ROW.BAD_DISCLOSURE.check, translation: ROW.BAD_DISCLOSURE.translation,
           detail, field };
  /* END DEC-49 REGION is-disclosure-well-formed */
}

/** C-121.3: no evidence was named (R2).
 * @param {Object<string, any>} [extra] the caller's own fields
 * @returns {Refusal} */
export function noEvidence(extra) {
  /* DEC-49 REGION is-evidence-named */
  return { ...(extra || {}), ok: false, reason: "NO_EVIDENCE", code: "NO_EVIDENCE",
           check: ROW.NO_EVIDENCE.check, translation: ROW.NO_EVIDENCE.translation,
           detail: "evidence is a non-empty statement, or a citation {cite}, and none was named, so nothing was written" };
  /* END DEC-49 REGION is-evidence-named */
}

/** C-121.4: a stored value with no list, or a list naming no active member, of who may read it (R5).
 * @param {string} detail what is missing from the list
 * @param {Object<string, any>} [extra] the caller's own fields, the count of ids naming no one among them
 * @returns {Refusal} */
export function noSightList(detail, extra) {
  /* DEC-49 REGION is-sight-listed */
  return { ...(extra || {}), ok: false, reason: "NO_SIGHT_LIST", code: "NO_SIGHT_LIST",
           check: ROW.NO_SIGHT_LIST.check, translation: ROW.NO_SIGHT_LIST.translation,
           detail };
  /* END DEC-49 REGION is-sight-listed */
}

/** C-121.5: the entry is not in the source's history, or consent to a wider audience already stands (R7).
 * @param {string} detail which of the two
 * @param {Object<string, any>} [extra] the caller's own fields (the entry named, or the audience standing)
 * @returns {Refusal} */
export function consentNotStanding(detail, extra) {
  /* DEC-49 REGION is-consent-standing */
  return { ...(extra || {}), ok: false, reason: "CONSENT_NOT_STANDING", code: "CONSENT_NOT_STANDING",
           check: ROW.CONSENT_NOT_STANDING.check, translation: ROW.CONSENT_NOT_STANDING.translation,
           detail };
  /* END DEC-49 REGION is-consent-standing */
}

/* R11: one answer, byte for byte, for every failure of a consent by secret, built once and frozen, so no failure can
   be told from another by its fields or their order. */
/** C-121.6: R11's one answer for every failure of a consent by secret, frozen.
 * @returns {Readonly<Refusal>} */
export function secretNotRecognised() {
  /* DEC-49 REGION is-secret-recognised */
  return Object.freeze({ ok: false, reason: "SECRET_NOT_RECOGNISED", code: "SECRET_NOT_RECOGNISED",
                         check: ROW.SECRET_NOT_RECOGNISED.check, translation: ROW.SECRET_NOT_RECOGNISED.translation,
                         detail: "the secret was not recognised, so nothing was recorded" });
  /* END DEC-49 REGION is-secret-recognised */
}
/** R11: the one frozen answer `consentBySecret` gives for every failure, built once.
 * @type {Readonly<Refusal>} */
export const SECRET_NOT_RECOGNISED_ANSWER = secretNotRecognised();

/* R16: the refusals of a mark. None carries the terms, the service or anything else the member sent (R18). */
/** C-121.7: the stamp names no active member acting for themselves (R16, R18).
 * @returns {Refusal} */
export function machineCannotMark() {
  /* DEC-49 REGION is-member-marking */
  return { ok: false, reason: "MACHINE_CANNOT_MARK", code: "MACHINE_CANNOT_MARK",
           check: ROW.MACHINE_CANNOT_MARK.check, translation: ROW.MACHINE_CANNOT_MARK.translation,
           detail: "the mark is made only by an active member's own act; this stamp names none, so nothing was written" };
  /* END DEC-49 REGION is-member-marking */
}

/** C-121.8: the capture's actor is not the member marking it (R16).
 * @param {string} captureSha the capture's digest
 * @returns {Refusal} */
export function notYourCapture(captureSha) {
  /* DEC-49 REGION is-own-capture */
  return { ok: false, reason: "NOT_YOUR_CAPTURE", code: "NOT_YOUR_CAPTURE",
           check: ROW.NOT_YOUR_CAPTURE.check, translation: ROW.NOT_YOUR_CAPTURE.translation,
           detail: "the capture's actor is not the member marking it, so nothing was written", captureSha };
  /* END DEC-49 REGION is-own-capture */
}

/** C-121.9: no capture the record holds answers to the digest, or no digest was named (R16).
 * @param {string | null} captureSha the digest asked about, or null when none was well formed
 * @returns {Refusal} */
export function noSuchCapture(captureSha) {
  /* DEC-49 REGION is-capture-held */
  return { ok: false, reason: "NO_SUCH_CAPTURE", code: "NO_SUCH_CAPTURE",
           check: ROW.NO_SUCH_CAPTURE.check, translation: ROW.NO_SUCH_CAPTURE.translation,
           detail: "no capture held in the record answers to that digest (one capture, named by its 64-hex digest, per act), "
             + "so nothing was written", captureSha };
  /* END DEC-49 REGION is-capture-held */
}

/** C-121.10: the mark names no service, or its terms are not text within their bound (R16).
 * @param {string} field `service` or `terms`
 * @param {string} detail what the field must be
 * @returns {Refusal} */
export function noService(field, detail) {
  /* DEC-49 REGION is-service-named */
  return { ok: false, reason: "NO_SERVICE", code: "NO_SERVICE",
           check: ROW.NO_SERVICE.check, translation: ROW.NO_SERVICE.translation,
           detail, field };
  /* END DEC-49 REGION is-service-named */
}
