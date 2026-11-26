/* RFC 3161 trusted timestamps: the primary co-attestation.
 *
 * Why this is primary and the public archive is not. A timestamp authority
 * receives a HASH and nothing else. It learns no locator, so it cannot tell what
 * the group is reading, which under Design Requirement 13 is the difference
 * between an attestation and a disclosure. It needs no account, so there is no
 * credential to rotate or leak. And the token it returns verifies offline
 * against the authority's own certificate for as long as that chain is
 * checkable, by anyone, with `openssl ts -verify` and no BIO code.
 *
 * What it proves and what it does not. A self-recorded hash proves integrity
 * since capture: it is the group's own claim about what the source served. A
 * timestamp proves the capture EXISTED at the claimed instant, which is the part
 * the group cannot fabricate for itself. Intake Doctrine Section 3: an attacker
 * holding a write token "can fabricate plausible provenance fields, but cannot
 * backdate a third-party archive snapshot or forge a timestamp token against its
 * issuing authority".
 *
 * The endpoints are a COMPILED CONSTANT, never member input. This module makes
 * the plane send an outbound request, and a list a caller could supply would
 * turn every instance into a probe of whatever an attacker named. The evidence
 * locator fence exists for member-supplied addresses; this one is not
 * member-supplied at all, which is a stronger guarantee than validating it
 * would be. Note that these are http rather than https on purpose: the TSA
 * protocol carries its own signatures and transport encryption adds nothing to
 * a signed token, which is why the RFC's own examples are http.
 *
 * Verification is deliberately NOT done here. Checking a token means parsing
 * CMS, validating a certificate chain, and deciding which roots to trust, and a
 * Worker that got any of that subtly wrong would be worse than one that does not
 * claim to have done it. The doctrine already places this at review: "Co-
 * attestation earns its weight only if someone checks it." What this module does
 * guarantee is BINDING: the returned token contains the digest we asked about,
 * so a TSA cannot hand back a token for something else and have it recorded as
 * ours.
 */

/* ---- DER, the little of it this needs ---- */

/** @param {...Uint8Array} parts @returns {Uint8Array} */
const cat = (...parts) => {
  let n = 0; for (const p of parts) n += p.length;
  const out = new Uint8Array(n); let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
};

/** DER length: short form under 128, else long form with a byte count prefix.
 *  @param {number} n @returns {Uint8Array} */
function derLen(n) {
  if (n < 0x80) return new Uint8Array([n]);
  /** @type {number[]} */
  const bytes = [];
  for (let v = n; v > 0; v = Math.floor(v / 256)) bytes.unshift(v % 256);
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}
/** @param {number} tag @param {Uint8Array} body @returns {Uint8Array} */
const tlv = (tag, body) => cat(new Uint8Array([tag]), derLen(body.length), body);

/** @param {...Uint8Array} items @returns {Uint8Array} */
const derSequence = (...items) => tlv(0x30, cat(...items));
/** @param {Uint8Array} bytes @returns {Uint8Array} */
const derOctetString = (bytes) => tlv(0x04, bytes);
/** @returns {Uint8Array} */
const derNull = () => new Uint8Array([0x05, 0x00]);
/** @param {boolean} v @returns {Uint8Array} */
const derBoolean = (v) => new Uint8Array([0x01, 0x01, v ? 0xff : 0x00]);

/** DER INTEGER: two's complement, minimal, with a leading zero where the high
 *  bit would otherwise make a positive value look negative.
 *  @param {Uint8Array} bytes @returns {Uint8Array} */
function derInteger(bytes) {
  let i = 0;
  while (i < bytes.length - 1 && bytes[i] === 0 && ((bytes[i + 1] ?? 0) & 0x80) === 0) i++;
  const trimmed = bytes.slice(i);
  return tlv(0x02, ((trimmed[0] ?? 0) & 0x80) ? cat(new Uint8Array([0]), trimmed) : trimmed);
}
/** @param {number} n @returns {Uint8Array} */
const derIntegerSmall = (n) => derInteger(new Uint8Array([n]));

/* id-sha256, 2.16.840.1.101.3.4.2.1, encoded once rather than derived. */
const OID_SHA256 = new Uint8Array([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01]);

/** @param {string} hex @returns {Uint8Array} */
const hexToBytes = (hex) => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
};

/**
 * A TimeStampReq over a SHA-256 digest.
 *
 * TimeStampReq ::= SEQUENCE {
 *   version        INTEGER { v1(1) },
 *   messageImprint MessageImprint,
 *   reqPolicy      TSAPolicyId OPTIONAL,
 *   nonce          INTEGER OPTIONAL,
 *   certReq        BOOLEAN DEFAULT FALSE,
 *   extensions [0] IMPLICIT Extensions OPTIONAL }
 *
 * The nonce is random and checked against the response, so a replayed or
 * substituted answer is detectable. certReq asks the authority to include its
 * certificate in the token, without which nobody can verify the token later
 * without separately obtaining the right certificate.
 *
 * @typedef {Object} TimestampRequest
 * @property {Uint8Array} der the DER TimeStampReq
 * @property {Uint8Array} nonce
 */
/**
 * @param {string} sha256Hex
 * @param {Uint8Array} [nonceBytes] absent is 8 fresh random bytes
 * @returns {TimestampRequest}
 * @bound sha256Hex: 64 hex characters
 */
export function timestampRequest(sha256Hex, nonceBytes) {
  const nonce = nonceBytes || crypto.getRandomValues(new Uint8Array(8));
  return {
    der: derSequence(
      derIntegerSmall(1),
      derSequence(derSequence(OID_SHA256, derNull()), derOctetString(hexToBytes(sha256Hex))),
      derInteger(nonce),
      derBoolean(true)),
    nonce,
  };
}

/* ---- reading the response ---- */

/**
 * @typedef {Object} Tlv
 * @property {number} tag
 * @property {Uint8Array} value
 * @property {number} end
 * @property {number} headerEnd
 */
/** Minimal TLV reader. Returns {tag, header, length, value, end}.
 *  @param {Uint8Array} bytes @param {number} at @returns {Tlv | null} */
function readTlv(bytes, at) {
  if (at + 2 > bytes.length) return null;
  const tag = bytes[at] ?? 0;
  let i = at + 1, length = bytes[i++] ?? 0;
  if (length & 0x80) {
    const count = length & 0x7f;
    if (count === 0 || i + count > bytes.length) return null;
    length = 0;
    for (let k = 0; k < count; k++) length = length * 256 + (bytes[i++] ?? 0);
  }
  if (i + length > bytes.length) return null;
  return { tag, value: bytes.subarray(i, i + length), end: i + length, headerEnd: i };
}

/**
 * TimeStampResp ::= SEQUENCE { status PKIStatusInfo, timeStampToken TimeStampToken OPTIONAL }
 * PKIStatusInfo ::= SEQUENCE { status INTEGER, statusString OPTIONAL, failInfo OPTIONAL }
 *
 * Status 0 is granted and 1 is granted with modifications; both carry a token.
 * Anything else is a refusal and carries none, and a refusal is recorded rather
 * than retried silently, because "a failed attempt is recorded with its reason,
 * never omitted".
 */
/**
 * @typedef {{ ok: true, status: number, token: Uint8Array }
 *   | { ok: false, reason: "MALFORMED" }
 *   | { ok: false, reason: "REJECTED", status: number }
 *   | { ok: false, reason: "NO_TOKEN", status: number }
 *   | { ok: false, reason: "NOT_BOUND", status: number }} TimestampAnswer
 */
/**
 * @param {unknown} bytes
 * @param {unknown} expectDigestHex
 * @returns {TimestampAnswer}
 */
export function parseTimestampResponse(bytes, expectDigestHex) {
  try { return parseResponse(bytes, expectDigestHex); }
  catch { return { ok: false, reason: "MALFORMED" }; }
}

/** Whether `needle`'s bytes appear, in order and together, anywhere in `hay`.
 *  @param {Uint8Array} hay @param {Uint8Array} needle @returns {boolean} */
function holds(hay, needle) {
  for (let i = 0; i + needle.length <= hay.length; i++) {
    let k = 0;
    while (k < needle.length && hay[i + k] === needle[k]) k++;
    if (k === needle.length) return true;
  }
  return false;
}

/** @param {unknown} bytes @param {unknown} expectDigestHex @returns {TimestampAnswer} */
function parseResponse(bytes, expectDigestHex) {
  if (!(bytes instanceof Uint8Array)) return { ok: false, reason: "MALFORMED" };
  const outer = readTlv(bytes, 0);
  if (!outer || outer.tag !== 0x30) return { ok: false, reason: "MALFORMED" };
  const info = readTlv(outer.value, 0);
  if (!info || info.tag !== 0x30) return { ok: false, reason: "MALFORMED" };
  const statusTlv = readTlv(info.value, 0);
  if (!statusTlv || statusTlv.tag !== 0x02) return { ok: false, reason: "MALFORMED" };
  let status = 0;
  for (const b of statusTlv.value) status = status * 256 + b;
  if (status !== 0 && status !== 1) return { ok: false, reason: "REJECTED", status };

  const token = readTlv(outer.value, info.end);
  if (!token || token.tag !== 0x30) return { ok: false, reason: "NO_TOKEN", status };
  /* Indices from readTlv are relative to the buffer it was given, so the token
     is sliced out of outer.value and not out of the whole response: using the
     outer buffer here shifted every token by the length of the outer header. */
  const tokenBytes = outer.value.subarray(info.end, token.end);

  /* Binding. The token's TSTInfo carries the messageImprint the authority
     signed, so our digest must appear in it. This is not signature
     verification and is not described as such anywhere; it is the cheap check
     that stops a token for some other document being filed as ours. A digest
     that is missing or not hex binds nothing, so it is never "found". */
  if (typeof expectDigestHex !== "string" || !/^(?:[0-9a-fA-F]{2})+$/.test(expectDigestHex))
    return { ok: false, reason: "NOT_BOUND", status };
  if (!holds(tokenBytes, hexToBytes(expectDigestHex))) return { ok: false, reason: "NOT_BOUND", status };
  return { ok: true, status, token: tokenBytes };
}

/* The authorities this plane will ask, in order. A compiled constant: see the
   header. Several, because a single authority is a single point of failure for
   a property the record depends on, and because the doctrine wants the attempt
   recorded either way. */
/** @type {readonly string[]} */
export const TSA_ENDPOINTS = Object.freeze([
  "http://timestamp.digicert.com",
  "http://timestamp.sectigo.com",
  "http://rfc3161.ai.moda",
]);

export const TSA_CONTENT_TYPE = "application/timestamp-query";
export const TSA_ACCEPT = "application/timestamp-reply";

/* ---- the public archive, the opt-in second path ----
 *
 * A co-archive is evidence of a different kind from a timestamp. A timestamp
 * proves a hash existed at an instant; an independent archive proves what the
 * page SAID, held by somebody the group does not control. The doctrine wants
 * both where the source permits.
 *
 * It is opt-in per capture and off by default, and the reason is not politeness.
 * Asking a public archive to fetch a URL publishes the fact of interest: anyone
 * watching that archive can see the group looked. Under Design Requirement 13
 * that is a tell, and a group deciding whether to leave one is making a
 * tactical judgement no default should make for them.
 *
 * Anonymous mode, so there is no credential to hold, rotate, or leak, and
 * nothing ties the request to an account. The host is a compiled constant and
 * the only variable part is a locator that has already passed
 * isPublicHttpsLocator, so this cannot be pointed anywhere else.
 */
/**
 * An archive's answer as a caller hands it in: a fetched Response, or anything else.
 * @typedef {{ readonly headers?: unknown, readonly url?: unknown }} ArchiveAnswer
 */
/**
 * What `headers` must offer to be read.
 * @typedef {{ get(name: string): unknown }} HeaderReader
 */
/** @param {unknown} v @returns {v is ArchiveAnswer} */
const isAnswer = (v) => (typeof v === "object" || typeof v === "function") && v !== null;
/** @param {unknown} v @returns {v is HeaderReader} */
const isHeaderReader = (v) => (typeof v === "object" || typeof v === "function") && v !== null
  && "get" in v && typeof v.get === "function";
/** Reading headers that offer no `get` fails, as calling a missing method does. @returns {never} */
const missingReader = () => { throw new TypeError("the answer's headers cannot be read"); };

export const ARCHIVE_SAVE_BASE = "https://web.archive.org/save/";
export const ARCHIVE_SERVICE = "web.archive.org/save (anonymous)";

/** Pull an archived locator out of whatever the archive answered with: the
 *  content-location header, then the location header, then the response's own
 *  url, the first that names one. Never throws: an unreadable answer names none.
 *  @param {unknown} res the archive's answer, as fetched
 *  @param {unknown} [requested]
 *  @returns {string | null} */
export function archiveLocatorFrom(res, requested) {
  /** @param {string} name @returns {unknown} */
  const header = (name) => {
    try {
      const headers = isAnswer(res) ? res.headers : undefined;
      return (isHeaderReader(headers) ? headers.get(name) : missingReader()) || "";
    } catch { return ""; }
  };
  let url = "";
  try {
    const u = isAnswer(res) ? res.url : undefined;
    url = typeof u === "string" ? u : "";
  } catch {}
  for (const loc of [header("content-location"), header("location"), url]) {
    if (typeof loc !== "string") continue;
    if (/^\/web\/\d+/.test(loc)) return "https://web.archive.org" + loc;
    if (/^https?:\/\/web\.archive\.org\/web\/\d+/.test(loc)) return loc;
  }
  return null;
}
