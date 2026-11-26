/* Large-file fixtures for the csv-reader suite (fix round 4b, F7; R9): a real body of many MiB, built
 * from a seeded generator so a run draws nothing from a clock or the system's randomness, and returned with the
 * document text its reader must give back, computed here by a route that shares no code with the reader. */
import { enc } from "./fixtures.mjs";
/** @import { TypedCell } from "../../../src/csv-reader/index.mjs" */

const ALNUM = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** @typedef {() => number} Rand a seeded source of unsigned 32-bit numbers */
/**
 * @typedef {Object} BigCsv
 * @property {Uint8Array} bytes the body
 * @property {string} expected the document text the reader must give back
 * @property {number} declared the body's bytes
 * @property {number} rows the records written
 */
/**
 * @typedef {Object} BigCsvArgs
 * @property {number} rows
 * @property {number} [strLen] absent is 400
 * @property {number} [seed] absent is 17
 */
/**
 * What the worker of large-text.test.mjs is sent: the body to read.
 * @typedef {Object} WorkerAsk
 * @property {Uint8Array} bytes
 */
/**
 * What the worker of large-text.test.mjs answers: sizes only.
 * @typedef {Object} WorkerAnswer
 * @property {boolean} ok
 * @property {number | null} documentLength
 * @property {TypedCell[] | null} sheetCells the first sheet's cells, or null when it lists none
 * @property {number} undetermined
 */

/**
 * xorshift32: the same sequence for the same seed.
 * @param {number} seed
 * @returns {Rand}
 */
export function prng(seed) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x;
  };
}

/**
 * `n` characters of letters and digits: close to incompressible.
 * @param {Rand} rand
 * @param {number} n
 * @returns {string}
 */
export function randomText(rand, n) {
  let s = "";
  for (let i = 0; i < n; i++) s += ALNUM.charAt(rand() % 62);
  return s;
}

export const MIB = 1024 * 1024;

/**
 * One RFC 4180 field, quoted when it holds a delimiter, a quote or a line break.
 * @param {string} v
 * @returns {string}
 */
export function csvField(v) {
  return /[",\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
}

/**
 * A comma-separated body of `rows` records of six fields; every 7th record
 * after the 60th (the delimiter signature reads the first 50 lines) holds a quoted field with a comma, a doubled quote and a bare line break,
 * and every 11th an empty field.
 * @param {BigCsvArgs} args
 * @returns {BigCsv}
 */
export function bigCsv({ rows, strLen = 400, seed = 17 }) {
  const rand = prng(seed);
  /** @type {string[]} */
  const out = [];
  /** @type {string[]} */
  const lines = [];
  for (let r = 1; r <= rows; r++) {
    const fields = [String(r)];
    for (let c = 0; c < 5; c++) fields.push(randomText(rand, strLen));
    if (r > 60 && r % 7 === 0) fields[2] = `a,b "quoted"\nsecond line ${(fields[2] ?? "").slice(0, 20)}`;
    if (r % 11 === 0) fields[3] = "";
    out.push(fields.map(csvField).join(","));
    lines.push(fields.join("\t"));   // an empty field keeps its column (G131d); the last field is never empty
  }
  /** @type {Uint8Array} */
  const bytes = enc(out.join("\r\n") + "\r\n");
  return { bytes, expected: lines.join("\n"), declared: bytes.length, rows };
}
