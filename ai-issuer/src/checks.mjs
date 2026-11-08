/* ai-issuer's refusal rows (R23; K3810, K5418, K3971). Every code this service mints has a row naming its check, its
 * site and the WORD KEY a reader shows for it (`ai.refused.<code, lower case, no underscores>`), never the words: a
 * team reads the container's words for the key. The codes ai-catalogue owns (NOT_NEWER, DIGEST_MISMATCH,
 * ADVISORY_BAD_MOVE, ADVISORY_REASON_UNKNOWN, CATALOGUE_PAYLOAD_INVALID) answer with ai-catalogue's own rows (C-156),
 * read from there. This family is C-158, the next free one (answer-envelope R19: "The next new family is C-158"). The
 * signature reasons (`BAD_SIGNATURE`, `UNKNOWN_KEY`, `MALFORMED`) are signatures' and pass through as it answers them. */
import { CATALOGUE_CHECKS } from "../../bio-plane/src/ai-catalogue/checks.mjs";

const key = (code) => `ai.refused.${code.toLowerCase().replace(/_/g, "")}`;
const row = (n, where, code) => Object.freeze({ check: `C-158.${n}`, where: `ai-issuer/src/${where}`, word: key(code) });

export const ISSUER_CHECKS = Object.freeze({
  ENTRY_NOT_DECIDED: row(1, "store.mjs decisionFor", "ENTRY_NOT_DECIDED"),
  DECISION_NO_RULING: row(2, "store.mjs decide", "DECISION_NO_RULING"),
  ISSUER_DIGEST_UNKNOWN: row(3, "store.mjs challenge", "ISSUER_DIGEST_UNKNOWN"),
  ISSUER_RATE_LIMITED: row(4, "store.mjs challenge, health", "ISSUER_RATE_LIMITED"),
  ISSUER_BAD_REQUEST: row(5, "index.mjs, store.mjs", "ISSUER_BAD_REQUEST"),
  ISSUER_NOT_AUTHORISED: row(6, "index.mjs operator", "ISSUER_NOT_AUTHORISED"),
  ISSUER_UNAVAILABLE: row(7, "index.mjs dynamic", "ISSUER_UNAVAILABLE"),
  NONCE_UNKNOWN: row(8, "store.mjs receiveBundle", "NONCE_UNKNOWN"),
  NONCE_EXPIRED: row(9, "store.mjs receiveBundle", "NONCE_EXPIRED"),
  NONCE_REUSED: row(10, "store.mjs receiveBundle", "NONCE_REUSED"),
  IMAGE_DIGEST_MISMATCH: row(11, "store.mjs receiveBundle", "IMAGE_DIGEST_MISMATCH"),
  BUNDLE_TOO_LARGE: row(12, "index.mjs bundle", "BUNDLE_TOO_LARGE"),
  BUNDLE_UNREADABLE: row(13, "store.mjs receiveBundle", "BUNDLE_UNREADABLE"),
  RESULT_REFUSED: row(14, "store.mjs recordResult", "RESULT_REFUSED"),
});

/** The codes this service answers with ai-catalogue's rows. */
export const BORROWED = Object.freeze(["NOT_NEWER", "DIGEST_MISMATCH", "ADVISORY_BAD_MOVE", "ADVISORY_REASON_UNKNOWN",
  "CATALOGUE_PAYLOAD_INVALID"]);
/** The signature reasons signatures answers, passed through without a row of ours. */
export const PASSED = Object.freeze(["BAD_SIGNATURE", "UNKNOWN_KEY", "MALFORMED", "NAMESPACE", "CRYPTO_UNAVAILABLE"]);

/** The row of a code: ours, or ai-catalogue's for the borrowed ones; null for a passed-through signature reason. */
export function rowOf(code) {
  if (Object.hasOwn(ISSUER_CHECKS, code)) return ISSUER_CHECKS[code];
  if (BORROWED.includes(code)) return CATALOGUE_CHECKS[code];
  if (PASSED.includes(code)) return null;
  throw new Error(`ai-issuer: no row for ${code}`);
}

/** The one refusal shape: `{ok: false, code, check, word, ...fields}`. A code with no row throws (R23's control). */
export function refusal(code, fields = {}) {
  const r = rowOf(code);
  return Object.freeze({ ...fields, ok: false, code, ...(r ? { check: r.check, word: r.word } : {}) });
}

/** The HTTP status each code answers with at the door. */
export const STATUS = Object.freeze({
  ISSUER_NOT_AUTHORISED: 401, ISSUER_RATE_LIMITED: 429, ISSUER_UNAVAILABLE: 503, BUNDLE_TOO_LARGE: 413,
  ISSUER_BAD_REQUEST: 400, ISSUER_DIGEST_UNKNOWN: 403,
});
export const statusOf = (code) => STATUS[code] ?? 409;
