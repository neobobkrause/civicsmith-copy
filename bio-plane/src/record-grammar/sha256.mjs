// @ts-check
/* record-grammar: the digests (R20–R23, R25, R64). Moved from the check catalogue at T18 with their comments. The
   catalogue carried TWO SHA-256 implementations, the stream (`createSha256`) and a synchronous string digest
   (`sha256HexSync`, with its own round-constant table `SHA256_K`); they are consolidated here on one compression
   function and one table (R25), `sha256HexSync` now the stream over the string's UTF-8 bytes. */

/** Portable base64 decode (no Buffer, no atob): verifies legacy .b64 files
 *  in Node, the browser, and the Apps Script embed alike. */
/** @param {unknown} s @returns {Uint8Array} */
export function b64ToBytes(s) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = String(s).replace(/[\s=]+/g, '');
  const out = new Uint8Array(Math.floor(clean.length * 3 / 4));
  let o = 0, buf = 0, bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const v = A.indexOf(clean.charAt(i));
    if (v === -1) throw new Error('invalid base64 at position ' + i);
    buf = (buf << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out[o++] = (buf >> bits) & 0xff; }
  }
  return out.subarray(0, o);
}

/* The one round-constant table (FIPS 180-4 §4.2.2). */
const K = new Int32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

/* A byte array-like: an object whose `length` is a non-negative safe integer, and never a string, boxed or not. */
/** @param {Uint8Array | ArrayLike<number>} c @returns {boolean} */
const isByteArrayLike = (c) => c !== null && typeof c === 'object' && !(c instanceof String)
  && Number.isSafeInteger(c.length) && c.length >= 0;

/* The one compression function and padding (R25): a core over eight words, a 64-byte buffer and a length, which both
   streams below wrap. `init` is a state `snapshot` wrote, already validated, or absent for a new digest. */
/** The running state a snapshot writes down: the eight words, the length, and the bytes held back (hex).
 * @typedef {{h: number[], t: number, b: string}} Snapshot */
/** @param {Snapshot | null} [init] */
function core(init) {
  const h = new Int32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const buf = new Uint8Array(64);
  const w = new Int32Array(64);
  let bufLen = 0;
  let total = 0;       // message length in bytes (< 2^53, ample for the store)

  if (init) {
    init.h.forEach((v, i) => { h[i] = v | 0; });
    bufLen = init.b.length / 2;
    for (let i = 0; i < bufLen; i++) buf[i] = parseInt(init.b.slice(2 * i, 2 * i + 2), 16);
    total = init.t;
  }

  /** @param {Uint8Array} bytes @param {number} off */
  function compress(bytes, off) {
    for (let i = 0; i < 16; i++) {
      w[i] = ((bytes[off] ?? 0) << 24) | ((bytes[off + 1] ?? 0) << 16) | ((bytes[off + 2] ?? 0) << 8) | (bytes[off + 3] ?? 0);
      off += 4;
    }
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15] ?? 0, y = w[i - 2] ?? 0;
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      w[i] = ((w[i - 16] ?? 0) + s0 + (w[i - 7] ?? 0) + s1) | 0;
    }
    let a = h[0] ?? 0, b = h[1] ?? 0, c = h[2] ?? 0, d = h[3] ?? 0, e = h[4] ?? 0, f2 = h[5] ?? 0, g = h[6] ?? 0, hh = h[7] ?? 0;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f2) ^ (~e & g);
      const t1 = (hh + S1 + ch + (K[i] ?? 0) + (w[i] ?? 0)) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      hh = g; g = f2; f2 = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] = ((h[0] ?? 0) + a) | 0; h[1] = ((h[1] ?? 0) + b) | 0; h[2] = ((h[2] ?? 0) + c) | 0; h[3] = ((h[3] ?? 0) + d) | 0;
    h[4] = ((h[4] ?? 0) + e) | 0; h[5] = ((h[5] ?? 0) + f2) | 0; h[6] = ((h[6] ?? 0) + g) | 0; h[7] = ((h[7] ?? 0) + hh) | 0;
  }

  return {
    /** Feed a Uint8Array. @param {Uint8Array} c */
    feed(c) {
      let i = 0;
      const n = c.length;
      total += n;
      if (bufLen > 0) {                                          // top up a partial block
        while (bufLen < 64 && i < n) buf[bufLen++] = c[i++] ?? 0;
        if (bufLen === 64) { compress(buf, 0); bufLen = 0; }
      }
      while (n - i >= 64) { compress(c, i); i += 64; }           // full blocks, no copy
      while (i < n) buf[bufLen++] = c[i++] ?? 0;                      // tail into the buffer
    },
    /** The state so far: the eight words, the length, and the bytes held back for the next block (hex). */
    /** @returns {Snapshot} */
    state() {
      let b = '';
      for (let i = 0; i < bufLen; i++) { const v = buf[i] ?? 0; b += (v < 16 ? '0' : '') + v.toString(16); }
      return { h: Array.from(h, (v) => v >>> 0), t: total, b };
    },
    get length() { return total; },
    /** Pad, compress the last block(s) and return the lowercase hex digest. */
    finish() {
      const bitHi = Math.floor(total / 0x20000000);              // total*8 >>> 32
      const bitLo = (total % 0x20000000) * 8;                    // low 32 bits of total*8
      buf[bufLen++] = 0x80;
      if (bufLen > 56) { while (bufLen < 64) buf[bufLen++] = 0; compress(buf, 0); bufLen = 0; }
      while (bufLen < 56) buf[bufLen++] = 0;
      buf[56] = (bitHi >>> 24) & 0xff; buf[57] = (bitHi >>> 16) & 0xff;
      buf[58] = (bitHi >>> 8) & 0xff; buf[59] = bitHi & 0xff;
      buf[60] = (bitLo >>> 24) & 0xff; buf[61] = (bitLo >>> 16) & 0xff;
      buf[62] = (bitLo >>> 8) & 0xff; buf[63] = bitLo & 0xff;
      compress(buf, 0);
      let out = '';
      for (let i = 0; i < 8; i++) out += ('00000000' + ((h[i] ?? 0) >>> 0).toString(16)).slice(-8);
      return out;
    }
  };
}

/* update()'s input (R20): a Uint8Array as it is, or a byte array-like copied (signed bytes coerce mod 256). */
/* What a stream's `update` takes (R20): bytes, or a byte array-like whose values are taken mod 256. */
/** @param {Uint8Array | ArrayLike<number>} chunk @returns {Uint8Array} */
function toBytes(chunk) {
  if (chunk instanceof Uint8Array) return chunk;
  if (!isByteArrayLike(chunk)) throw new TypeError('sha256 update takes a Uint8Array or a byte array-like, not ' + (chunk === null ? 'null' : typeof chunk));
  return Uint8Array.from(chunk);
}

/** Incremental SHA-256 (FIPS 180-4), pure JS, Uint8Array-native, zero
 *  dependencies: one byte per element end to end, no platform digest, no
 *  signed-byte conversion. Exists so oversize multi-part captures stream
 *  through the hash one part at a time (KICKOFF-P2M6 4a: the whole-file
 *  reassembly plus Apps Script's number-array digest input materialized
 *  ~8 bytes per content byte and OOMed the promotion of the 39.6MB budget
 *  book). update() accepts Uint8Array or any byte array-like (values are
 *  coerced mod 256, so Apps Script signed bytes agree); hex() finalizes.
 *  A string, or anything else that is not bytes, is a TypeError (R20): it
 *  used to be hashed as ZERO bytes, which is a digest of nothing that reads
 *  like a digest of the input. The module's tests (digests.test.mjs, R20–R22)
 *  cross-validate it against WebCrypto over many sizes and chunk boundary
 *  offsets: a wrong hash here would silently corrupt every gate verdict, so
 *  those tests are load-bearing, not decorative.
 * @returns {Sha256} */
export function createSha256() {
  const c = core();
  let finalized = false;
  return {
    /** Feed a chunk of bytes. Chainable. @param {Uint8Array | ArrayLike<number>} chunk @returns {Sha256} */
    update(chunk) {
      if (finalized) throw new Error('sha256 stream already finalized');
      c.feed(toBytes(chunk));
      return this;
    },
    /** Finalize and return the lowercase hex digest. */
    hex() {
      if (finalized) throw new Error('sha256 stream already finalized');
      finalized = true;
      return c.finish();
    }
  };
}

/** A SHA-256 stream (R20). @typedef {{update: (chunk: Uint8Array | ArrayLike<number>) => Sha256, hex: () => string}} Sha256 */
/** A stream that can be written down and taken up again (R64).
 * @typedef {{update: (chunk: Uint8Array | ArrayLike<number>) => ResumableSha256, snapshot: () => string, readonly length: number, hex: () => string}} ResumableSha256 */
/** An object read member by member. @typedef {{readonly [key: string]: unknown}} Members */
/** @param {unknown} v @returns {v is Members} */
const isMembers = (v) => v !== null && typeof v === 'object';
/** A list read item by item. @typedef {readonly unknown[]} List */
/** @param {unknown} v @returns {v is List} */
const isList = (v) => Array.isArray(v);

const HEX = /^[0-9a-f]*$/;

/* A snapshot's content, or null when `state` is not one `snapshot()` wrote. */
/** @param {string} state @returns {Snapshot | null} */
function parseSnapshot(state) {
  /** @type {unknown} */
  let parsed;
  try { parsed = JSON.parse(state); } catch { return null; }
  const s = parsed;
  if (!isMembers(s)) return null;
  const h = s.h, t = s.t, b = s.b;
  if (!isList(h) || h.length !== 8) return null;
  /** @type {number[]} */
  const words = [];
  for (const v of h) {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 0xffffffff) return null;
    words.push(v);
  }
  const ok = typeof t === 'number' && Number.isSafeInteger(t) && t >= 0 && typeof b === 'string' && HEX.test(b)
    && b.length % 2 === 0 && b.length / 2 === t % 64;
  return ok ? { h: words, t, b } : null;
}

/** R64: a stream as `createSha256`'s whose running state can be written down (`snapshot()`, a short string) and
 *  taken up again (`createResumableSha256(snapshot)`), so a file hashed in parts across objects that leave memory
 *  between them gives the digest of the whole. A state that is not a string `snapshot()` wrote is a TypeError.
 * @param {string | null} [state]
 * @returns {ResumableSha256} */
export function createResumableSha256(state) {
  /** @type {Snapshot | null} */
  let init = null;
  if (state !== undefined && state !== null) {
    init = typeof state === 'string' ? parseSnapshot(state) : null;
    if (init === null) throw new TypeError('sha256 snapshot is not one snapshot() made');
  }
  const c = core(init);
  let finalized = false;
  return {
    /** @param {Uint8Array | ArrayLike<number>} chunk @returns {ResumableSha256} */
    update(chunk) {
      if (finalized) throw new Error('sha256 stream already finalized');
      c.feed(toBytes(chunk));
      return this;
    },
    /** The running state as a string; the stream stays usable. */
    snapshot() {
      if (finalized) throw new Error('sha256 stream already finalized');
      return JSON.stringify(c.state());
    },
    /** The bytes taken so far, a resumed stream's earlier ones included. */
    get length() { return c.length; },
    hex() {
      if (finalized) throw new Error('sha256 stream already finalized');
      finalized = true;
      return c.finish();
    }
  };
}

/* --------------------------------------------------------------------------
 * The SYNCHRONOUS string digest.
 * --------------------------------------------------------------------------
 *
 * `promote` is SYNCHRONOUS — the whole write happens inside
 * `ctx.storage.transactionSync` — and `crypto.subtle.digest` is not. So the
 * content address needs a SYNCHRONOUS SHA-256, and this is it.
 *
 * WHY NOT A CHEAP NON-CRYPTOGRAPHIC MIX. `content_id` is a PRIMARY KEY whose
 * whole purpose is that two citers of one passage collide and two citers of
 * different passages do not. A 32- or 64-bit mix would make the SECOND half of
 * that a probability rather than a property, and a collision there merges two
 * different passages into one row — an address silently pointing at the wrong
 * part of a document, which is this record's worst failure class.
 *
 * WHY NOT MAKE `promote` ASYNC. It is the plane's one write path and its
 * transaction is what makes a promotion atomic; turning it async to hash a
 * string would be a structural change to the store's core in service of a
 * digest. The suite DRIVES this implementation against `crypto.subtle` over the
 * real inputs rather than trusting it — an agreement that costs nothing to
 * produce is not evidence, and a hand-rolled digest is exactly the shape that
 * agrees with itself.
 *
 * ONE IMPLEMENTATION (R25, map §4.4, K6). This was a second, block-at-once
 * SHA-256 with its own constant table, and it once shipped a padding error
 * (a spurious empty block whenever len ≡ 55 mod 64) that agreed with itself
 * perfectly until a length sweep against `crypto.subtle` caught it. Two
 * implementations are two places for that class of error; it is now the
 * stream above over the string's UTF-8 bytes, and the module's tests still pin
 * lengths 55/56/63/64/65 by name.
 */

const utf8 = new TextEncoder();

/** Synchronous SHA-256 over a UTF-8 string, lowercase hex.
 * @param {unknown} str @returns {string} */
export function sha256HexSync(str) {
  return createSha256().update(utf8.encode(String(str))).hex();
}
