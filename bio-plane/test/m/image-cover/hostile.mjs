/* image-cover tests: small hostile images built byte by byte (R10). Every file is made here from its declaration,
 * never from this module's own output. */
import { crc32 } from "node:zlib";

const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** @param {number} v */
const be32 = (v) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];

/**
 * One PNG chunk: length, type, body, CRC.
 * @param {string} type
 * @param {number[]} [body]
 * @returns {number[]}
 */
export function pngChunk(type, body = []) {
  const t = [...type].map((c) => c.charCodeAt(0)), b = Uint8Array.from([...t, ...body]);
  return [...be32(body.length), ...b, ...be32(crc32(b))];
}
/** An IHDR chunk declaring `w` x `h` of colour type `ct` and bit depth `depth`. @param {number} w @param {number} h @param {number} [ct] @param {number} [depth] */
export const ihdr = (w, h, ct = 6, depth = 8) => pngChunk("IHDR", [...be32(w), ...be32(h), depth, ct, 0, 0, 0]);

/**
 * A PNG that declares `w` x `h` of colour type `ct` and holds one tiny IDAT: 70 bytes or so.
 * @param {number} w @param {number} h @param {number} [ct] @param {number} [depth]
 * @returns {Uint8Array}
 */
export const pngDeclaring = (w, h, ct = 6, depth = 8) =>
  Uint8Array.from([...SIG, ...ihdr(w, h, ct, depth), ...pngChunk("IDAT", [0x78, 0x9c, 3, 0, 0, 0, 0, 1]), ...pngChunk("IEND")]);

/**
 * A 1 x 1 grey PNG of `n` chunks in all: IHDR, `n - 2` empty IDATs, IEND.
 * @param {number} n
 * @returns {Uint8Array}
 */
export function pngOfChunks(n) {
  const idat = pngChunk("IDAT"), out = new Uint8Array(8 + 25 + 12 + (n - 2) * 12);
  let o = 0;
  /** @param {ArrayLike<number>} a */
  const put = (a) => { out.set(a, o); o += a.length; };
  put(SIG); put(ihdr(1, 1, 0));
  for (let i = 0; i < n - 2; i++) put(idat);
  put(pngChunk("IEND"));
  return out;
}

/**
 * A JPEG of SOI, `n` two-byte markers (TEM), EOI.
 * @param {number} n
 * @returns {Uint8Array}
 */
export function jpegOfMarkers(n) {
  const out = new Uint8Array(4 + 2 * n).fill(0xff);
  out[1] = 0xd8;
  for (let i = 0; i < n; i++) out[2 + 2 * i + 1] = 0x01;
  out[out.length - 1] = 0xd9;
  return out;
}

/**
 * A JP2 file of its signature, an ftyp and `n` empty `free` boxes.
 * @param {number} n
 * @returns {Uint8Array}
 */
export function jp2OfBoxes(n) {
  const head = [0, 0, 0, 12, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a, ...be32(20), 0x66, 0x74, 0x79, 0x70, 0x6a, 0x70, 0x32, 0x20, 0, 0, 0, 0, 0x6a, 0x70, 0x32, 0x20];
  const out = new Uint8Array(head.length + 8 * n);
  out.set(head);
  for (let i = 0; i < n; i++) out.set([0, 0, 0, 8, 0x66, 0x72, 0x65, 0x65], head.length + 8 * i);
  return out;
}

/**
 * A J2K codestream of SOC, SIZ and `n` bare COM markers.
 * @param {number} n
 * @returns {Uint8Array}
 */
export function j2kOfMarkers(n) {
  const head = [0xff, 0x4f, 0xff, 0x51, 0, 2];
  const out = new Uint8Array(head.length + 4 * n);
  out.set(head);
  for (let i = 0; i < n; i++) out.set([0xff, 0x64, 0, 2], head.length + 4 * i);
  return out;
}
