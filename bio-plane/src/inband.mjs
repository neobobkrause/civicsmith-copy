/* REC-148 / DEC-31's BOUND RULE — THE IN-BAND QUARTET, COMPUTED ONCE.
 *
 * `BIO_Publication_v0_1.md` §6A.3 point 1: any rendering that leaves the instance addressed to someone
 * carries its HASH, its DATE, its AUTHOR and BOTH THRESHOLD FLOORS in-band (H4's rule, extended by DEC-31
 * on 2026-08-03). The published case container has carried them since REC-44; the review copy did not
 * (measured by BOB #16, 2026-09-19), so no surface may yet offer to export one.
 *
 * ONE FUNCTION, AND THAT IS THE WHOLE POINT OF THIS FILE. The rule's words are "proved to be the same
 * quantity the published container renders". Two hashers — one over the manifest, one over the review
 * copy — can agree on every fixture and drift the day one of them canonicalises differently (a changed
 * indent, a sorted key), and the record would then carry two "hashes" that mean different things under
 * one name. So the container assembly (`assembleCaseContainer`) and the review copy (`op=reviewcopy`)
 * both call `inbandQuartet` (public-read R7); `worker.test.mjs`' R6 arm holds the container manifest's hash
 * to the quartet's, and the review copy's call is its own module's to prove.
 *
 * THE CANONICAL FORM IS THE WIRE FORM: `JSON.stringify(value, null, 1)`, UTF-8 — the bytes the container
 * manifest has always been hashed over, and the bytes `control-plane`'s `json()` serves an answer as. So a
 * reader holding the answer can re-hash it: parse it, remove `inband`, serialise it the same way.
 */

import { localize } from "./setup-words/index.mjs";

/**
 * The quartet's format word (R7).
 * @type {string}
 * @bound "bio-inband/1"
 */
export const INBAND_FORMAT = "bio-inband/1";

/* THE CANONICAL BYTES of a JSON value. */
/**
 * The canonical bytes of a JSON value, the bytes the quartet's hash covers (R7).
 * @param {any} value
 * @returns {Uint8Array}
 * @bound JSON.stringify(value, null, 1) as UTF-8
 */
export function canonicalBytes(value) {
  return new TextEncoder().encode(JSON.stringify(value, null, 1));
}

async function sha256HexOf(bytes) {
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/* THE TWO FLOORS, read off a bar in the shape `#projectBar` returns and the case document freezes
   (`required_strength`: declared, capture, connection). Undetermined is first-class: an absent bar is
   NOT a bar of zero, so an axis nobody declared reads null and `declared` says false in words. */
/**
 * The two threshold floors of a case (R7).
 * @typedef {Object} InbandFloors
 * @property {string|null} capture the declared grade, or null when none is
 * @property {string|null} connection the declared grade, or null when none is
 * @property {boolean} declared true only when the bar says declared and names at least one grade
 * @property {string} detail in words: the floors, or that no floor is declared
 */
/**
 * The two floors read off a bar (R7).
 * @param {any} bar `{declared, capture, connection}`; anything else, or an axis written `null`, is no floor
 * @returns {InbandFloors}
 */
export function floorsOf(bar) {
  /* A frozen case document writes an unset axis as the YAML word `null`; it is an absent floor either way. */
  const grade = (g) => (typeof g === "string" && g.trim() && g.trim() !== "null" ? g.trim() : null);
  const capture = bar && typeof bar === "object" ? grade(bar.capture) : null;
  const connection = bar && typeof bar === "object" ? grade(bar.connection) : null;
  const declared = !!(bar && typeof bar === "object" && (bar.declared === true || bar.declared === "true")
                      && (capture || connection));
  return {
    capture, connection, declared,
    detail: declared
      ? localize("public-read.inband.the_floors_on_the_two", "the floors on the two strength axes this case is held to: its publishing project's required strength (DEC-72). They are independent, and neither is a default for the other.")
      : localize("public-read.inband.no_floor_is_declared_and", "NO FLOOR IS DECLARED, and that is not a floor of zero: the publishing project states no required strength, so nothing here claims to have cleared a standard."),
  };
}

/* THE QUARTET. `subject` is the JSON value whose canonical bytes are hashed; `over` names it in words, so
   a reader knows what to re-hash. Returns the bytes too, for the caller that must store or serve them.
   public-read R34 (T45; v0.2 rules 14, 21): `group` is the group's per-group fields (`groupFields()`) as the caller
   read them, answered unchanged as `group` (null with none given). They sit BESIDE `hash` and never inside what it
   covers, which is the subject's bytes only: two groups stamping the same bytes carry the same `hash.sha256`, so a
   joint text's body fingerprint is computed without them. The format stays `bio-inband/1`: the field is additive. */
/**
 * What `inbandQuartet` is handed (R7, R34).
 * @typedef {Object} InbandArgs
 * @property {any} subject the JSON value whose canonical bytes are hashed
 * @property {string} over in words, what was hashed, so a reader knows what to re-hash
 * @property {any} [date] answered unchanged; absent is null
 * @property {any} [author] answered unchanged; absent is null
 * @property {any} [bar] the floors' bar (`floorsOf`); absent is null
 * @property {any} [group] the group's per-group fields (R34); absent is null
 */
/**
 * The in-band quartet (R7): hash, date, author and both floors, with the group's fields beside them (R34).
 * @typedef {Object} InbandQuartet
 * @property {string} format
 * @property {{algorithm: string, sha256: string, over: string, bytes: number, canonical: string}} hash
 * @property {any} date
 * @property {any} author
 * @property {InbandFloors} floors
 * @property {any} group never inside what `hash` covers
 * @bound format: "bio-inband/1"
 * @bound hash: sha256 over JSON.stringify(subject, null, 1) as UTF-8, lowercase hexadecimal; `bytes` is that byte count
 */
/**
 * The one hasher of the container manifest and the review copy (R7, R34).
 * @param {InbandArgs} args
 * @returns {Promise<{bytes: Uint8Array, quartet: InbandQuartet}>} `bytes` the canonical bytes hashed
 * @bound format "bio-inband/1", hash over JSON.stringify(subject, null, 1) as UTF-8
 */
export async function inbandQuartet({ subject, over, date = null, author = null, bar = null, group = null }) {
  const bytes = canonicalBytes(subject);
  const sha256 = await sha256HexOf(bytes);
  return {
    bytes,
    quartet: {
      format: INBAND_FORMAT,
      hash: { algorithm: "sha256", sha256, over, bytes: bytes.length,
              canonical: "JSON.stringify(value, null, 1), UTF-8" },
      date: date ?? null,
      author: author ?? null,
      floors: floorsOf(bar),
      group: group ?? null,
    },
  };
}
