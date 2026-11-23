/* Bytes and bodies: the hashes and comparisons, the random values, and the multipart upload form the other files share
 * (R12, R13, R14). Pure; nothing here reaches the network. */

/**
 * The bytes as lower-case hexadecimal, two digits each.
 * @param {ArrayBuffer|Uint8Array} buf
 * @returns {string}
 */
const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
/**
 * Compares two dotted versions by their first three numbers: negative when `a` is older, 0 when equal, positive when newer.
 * @param {any} a
 * @param {any} b
 * @returns {number}
 */
const vcmp = (a, b) => {
  const A = String(a).split(".").map(Number), B = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) { const d = (A[i] || 0) - (B[i] || 0); if (d) return d; }
  return 0;
};

/** The headers a release is fetched with. @type {Record<string, string>} */
const relHeaders = { "user-agent": "bio-installer" };

/**
 * The bytes as unpadded base64url.
 * @param {ArrayBuffer|Uint8Array} buf
 * @returns {string}
 */
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
/**
 * `n` random bytes as unpadded base64url.
 * @param {number} n the number of bytes
 * @returns {string}
 */
const rand = (n) => b64url(crypto.getRandomValues(new Uint8Array(n)));

/** A line end, and the blank line that ends a part's headers, as bytes. @type {number[]} */
const CRLF = [13, 10], HEADER_END = [13, 10, 13, 10];
/**
 * The string's characters as bytes (each one's code, cut to a byte).
 * @param {string} s
 * @returns {Uint8Array}
 */
const ascii = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0));
/**
 * The first offset at or after `from` where `pat` (bytes) occurs in `hay`, or -1; the native scan finds each candidate.
 * @param {Uint8Array} hay
 * @param {ArrayLike<number>} pat
 * @param {number} [from]
 * @returns {number}
 */
function find(hay, pat, from = 0) {
  for (let i = hay.indexOf(pat[0], from); i !== -1 && i + pat.length <= hay.length; i = hay.indexOf(pat[0], i + 1)) {
    let k = 1;
    while (k < pat.length && hay[i + k] === pat[k]) k++;
    if (k === pat.length) return i;
  }
  return -1;
}
/* SHA-256 taken incrementally (R38): WebCrypto's digest wants the whole input at once, which holds a second copy of a 29 MB
   module; this takes the bytes as they arrive and holds only a 64-byte block. */
const K256 = Uint32Array.from({ length: 64 }, (_, i) => {
  let n = 2; for (let c = 0; c <= i; n++) { let p = true; for (let d = 2; d * d <= n; d++) if (n % d === 0) { p = false; break; } if (p) c++; }
  return Math.floor((Math.cbrt(n - 1) % 1) * 2 ** 32);
});
/** An incremental SHA-256: `update` with each chunk, then `hex` once for the digest. */
class Sha256 {
  constructor() {
    this.h = Uint32Array.from([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    this.block = new Uint8Array(64); this.fill = 0; this.length = 0; this.w = new Uint32Array(64);
  }
  /**
   * @param {Uint8Array} bytes
   * @returns {this}
   */
  update(bytes) {
    this.length += bytes.length;
    let i = 0;
    if (this.fill) {
      const take = Math.min(64 - this.fill, bytes.length);
      this.block.set(bytes.subarray(0, take), this.fill); this.fill += take; i = take;
      if (this.fill < 64) return this;
      this.#compress(this.block, 0); this.fill = 0;
    }
    for (; i + 64 <= bytes.length; i += 64) this.#compress(bytes, i);
    if (i < bytes.length) { this.block.set(bytes.subarray(i)); this.fill = bytes.length - i; }
    return this;
  }
  /**
   * @param {Uint8Array} b
   * @param {number} o
   * @returns {void}
   */
  #compress(b, o) {
    const w = this.w, h = this.h, rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let i = 0; i < 16; i++) w[i] = (b[o + 4 * i] << 24) | (b[o + 4 * i + 1] << 16) | (b[o + 4 * i + 2] << 8) | b[o + 4 * i + 3];
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15], c = w[i - 2];
      w[i] = (w[i - 16] + (rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3)) + w[i - 7] + (rotr(c, 17) ^ rotr(c, 19) ^ (c >>> 10))) | 0;
    }
    let [a, bb, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + w[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
    }
    h[0] += a; h[1] += bb; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  /**
   * Ends the hash: pads the input and answers the digest, as 64 lower-case hexadecimal digits.
   * @returns {string}
   */
  hex() {
    const bits = this.length * 8, padLen = 1 + ((119 - (this.length % 64)) % 64 + 64) % 64 + 8, pad = new Uint8Array(padLen);
    pad[0] = 0x80;
    const view = new DataView(pad.buffer);
    view.setUint32(padLen - 8, Math.floor(bits / 2 ** 32)); view.setUint32(padLen - 4, bits >>> 0);
    this.update(pad);
    return [...this.h].map((x) => x.toString(16).padStart(8, "0")).join("");
  }
}
/**
 * The hash of a byte stream, taken as the chunks arrive; the whole is never held.
 * @param {any} stream a readable stream of byte chunks
 * @returns {Promise<string>} the SHA-256 as hexadecimal
 */
async function hashStream(stream) {
  const sha = new Sha256(), reader = stream.getReader();
  for (let r = await reader.read(); !r.done; r = await reader.read()) sha.update(r.value);
  return sha.hex();
}
/* The hash of the `index.mjs` part of a multipart body arriving as a stream, or null when there is none: the delimiters are
   found in a window of the last few bytes, and the part's bytes go to the hash as they come (R38). A part the body ends
   inside is hashed as far as it goes. */
/**
 * @param {any} stream a readable stream of byte chunks
 * @param {string} boundary the multipart boundary
 * @returns {Promise<string|null>} the SHA-256 as hexadecimal, or null
 */
async function hashPart(stream, boundary) {
  const delim = ascii("--" + boundary), next = new Uint8Array([...CRLF, ...delim]), reader = stream.getReader();
  let buf = new Uint8Array(0), state = "preamble", sha = null, done = false;
  const feed = (n) => { if (sha) sha.update(buf.subarray(0, n)); };
  while (!done) {
    const r = await reader.read();
    if (r.done) break;
    const joined = new Uint8Array(buf.length + r.value.length);
    joined.set(buf); joined.set(r.value, buf.length); buf = joined;
    for (let again = true; again; ) {
      again = false;
      if (state === "preamble") {
        const at = find(buf, delim);
        if (at === -1) { buf = buf.subarray(Math.max(0, buf.length - delim.length + 1)); }
        else { buf = buf.subarray(at + delim.length); state = "head"; again = true; }
      } else if (state === "head") {
        if (buf.length >= 2 && buf[0] === 45 && buf[1] === 45) return null;
        const head = find(buf, HEADER_END);
        if (head === -1) { if (buf.length > 65536) return null; }
        else {
          const index = /name="index\.mjs"/.test(new TextDecoder().decode(buf.subarray(0, head)));
          buf = buf.subarray(head + HEADER_END.length); state = "body"; sha = index ? new Sha256() : null; again = true;
        }
      } else {
        const end = find(buf, next);
        if (end === -1) { const keep = next.length - 1; if (buf.length > keep) { feed(buf.length - keep); buf = buf.subarray(buf.length - keep); } }
        else if (sha) { feed(end); done = true; }
        else { buf = buf.subarray(end + CRLF.length); state = "preamble"; again = true; }
      }
    }
  }
  if (!done) { if (state !== "body") return null; feed(buf.length); }
  reader.cancel().catch(() => {});             /* not awaited: a cancel on a teed stream settles only when its twin is cancelled too */
  return sha ? sha.hex() : null;
}

/**
 * The multipart upload form: a `metadata` part (the JSON of `meta`) and the module as `index.mjs`.
 * `source` is the module as text, or already a Blob (a repository release, R33: made once, shared by every upload).
 * @param {Object} meta
 * @param {string|Blob} source
 * @returns {FormData}
 */
function uploadForm(meta, source) {
  const fd = new FormData();
  fd.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  fd.append("index.mjs", source instanceof Blob ? source : new Blob([source], { type: "application/javascript+module" }), "index.mjs");
  return fd;
}
export { hex, vcmp, relHeaders, b64url, rand, CRLF, HEADER_END, ascii, find, Sha256, hashStream, hashPart, uploadForm };
