/* sources' refusal rows (requirements: `build/requirements/sources.md`, R14). DEC-49: every refusal this module answers
 * carries its code, its row and the member's translation, so a surface shows the same sentence wherever the act is
 * reached. A new module with nothing moved (K509 (1), N364): the rows are its own new family, C-121, "a source's
 * disclosures", held here and nowhere else (K174). Each code is minted at one site, the DEC-49 region its `where`
 * names. No translation names a place (R14, `layers.md` rule 1), and none carries a value (R13). */

import { word, localize } from "../setup-words/index.mjs";

const at = (fn, region) => `src/sources/checks.mjs ${fn} > ${region}`;

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

export function noSuchSource(source, extra) {
  /* DEC-49 REGION is-source-held */
  return { ...(extra || {}), ok: false, reason: "NO_SUCH_SOURCE", code: "NO_SUCH_SOURCE",
           check: ROW.NO_SUCH_SOURCE.check, translation: ROW.NO_SUCH_SOURCE.translation,
           detail: "no source this caller may see answers to that id, so nothing was written",
           source: typeof source === "string" ? source.slice(0, 64) : null };
  /* END DEC-49 REGION is-source-held */
}

export function badDisclosure(field, detail, extra) {
  /* DEC-49 REGION is-disclosure-well-formed */
  return { ...(extra || {}), ok: false, reason: "BAD_DISCLOSURE", code: "BAD_DISCLOSURE",
           check: ROW.BAD_DISCLOSURE.check, translation: ROW.BAD_DISCLOSURE.translation,
           detail, field };
  /* END DEC-49 REGION is-disclosure-well-formed */
}

export function noEvidence(extra) {
  /* DEC-49 REGION is-evidence-named */
  return { ...(extra || {}), ok: false, reason: "NO_EVIDENCE", code: "NO_EVIDENCE",
           check: ROW.NO_EVIDENCE.check, translation: ROW.NO_EVIDENCE.translation,
           detail: "evidence is a non-empty statement, or a citation {cite}, and none was named, so nothing was written" };
  /* END DEC-49 REGION is-evidence-named */
}

export function noSightList(detail, extra) {
  /* DEC-49 REGION is-sight-listed */
  return { ...(extra || {}), ok: false, reason: "NO_SIGHT_LIST", code: "NO_SIGHT_LIST",
           check: ROW.NO_SIGHT_LIST.check, translation: ROW.NO_SIGHT_LIST.translation,
           detail };
  /* END DEC-49 REGION is-sight-listed */
}

export function consentNotStanding(detail, extra) {
  /* DEC-49 REGION is-consent-standing */
  return { ...(extra || {}), ok: false, reason: "CONSENT_NOT_STANDING", code: "CONSENT_NOT_STANDING",
           check: ROW.CONSENT_NOT_STANDING.check, translation: ROW.CONSENT_NOT_STANDING.translation,
           detail };
  /* END DEC-49 REGION is-consent-standing */
}

/* R11: one answer, byte for byte, for every failure of a consent by secret, built once and frozen, so no failure can
   be told from another by its fields or their order. */
export function secretNotRecognised() {
  /* DEC-49 REGION is-secret-recognised */
  return Object.freeze({ ok: false, reason: "SECRET_NOT_RECOGNISED", code: "SECRET_NOT_RECOGNISED",
                         check: ROW.SECRET_NOT_RECOGNISED.check, translation: ROW.SECRET_NOT_RECOGNISED.translation,
                         detail: "the secret was not recognised, so nothing was recorded" });
  /* END DEC-49 REGION is-secret-recognised */
}
export const SECRET_NOT_RECOGNISED_ANSWER = secretNotRecognised();

/* R16: the refusals of a mark. None carries the terms, the service or anything else the member sent (R18). */
export function machineCannotMark() {
  /* DEC-49 REGION is-member-marking */
  return { ok: false, reason: "MACHINE_CANNOT_MARK", code: "MACHINE_CANNOT_MARK",
           check: ROW.MACHINE_CANNOT_MARK.check, translation: ROW.MACHINE_CANNOT_MARK.translation,
           detail: "the mark is made only by an active member's own act; this stamp names none, so nothing was written" };
  /* END DEC-49 REGION is-member-marking */
}

export function notYourCapture(captureSha) {
  /* DEC-49 REGION is-own-capture */
  return { ok: false, reason: "NOT_YOUR_CAPTURE", code: "NOT_YOUR_CAPTURE",
           check: ROW.NOT_YOUR_CAPTURE.check, translation: ROW.NOT_YOUR_CAPTURE.translation,
           detail: "the capture's actor is not the member marking it, so nothing was written", captureSha };
  /* END DEC-49 REGION is-own-capture */
}

export function noSuchCapture(captureSha) {
  /* DEC-49 REGION is-capture-held */
  return { ok: false, reason: "NO_SUCH_CAPTURE", code: "NO_SUCH_CAPTURE",
           check: ROW.NO_SUCH_CAPTURE.check, translation: ROW.NO_SUCH_CAPTURE.translation,
           detail: "no capture held in the record answers to that digest (one capture, named by its 64-hex digest, per act), "
             + "so nothing was written", captureSha };
  /* END DEC-49 REGION is-capture-held */
}

export function noService(field, detail) {
  /* DEC-49 REGION is-service-named */
  return { ok: false, reason: "NO_SERVICE", code: "NO_SERVICE",
           check: ROW.NO_SERVICE.check, translation: ROW.NO_SERVICE.translation,
           detail, field };
  /* END DEC-49 REGION is-service-named */
}
