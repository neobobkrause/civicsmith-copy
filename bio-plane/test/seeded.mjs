/* The seeded primitives every corpus generator shares (requirements/test-support.md R19; fix round 9, G123d): the
 * draw, the vocabulary a unit's word comes from, and the canonical key of a recipe. A file of its own so the
 * generators and corpus.mjs (which imports them) share it without an import cycle. Not product code; importing it
 * has no side effect. */
import { createHash } from "node:crypto";

/* ---- the seeded draw ---- */

/**
 * A 32-bit hash of any number of parts (strings or numbers): FNV-1a over their text, then a final mix.
 * @param {...(string | number)} parts
 * @returns {number} a whole number from 0 to 2^32 - 1
 */
export function hash32(...parts) {
  let h = 0x811c9dc5;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    h ^= 0x1f; h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
  return h >>> 0;
}

/**
 * A seeded draw: each call answers the next number in [0, 1); `int(n)` the next whole number from 0 to n - 1;
 * `pick(list)` the next entry of the list.
 * @typedef {(() => number) & {int: (n: number) => number, pick: <T>(list: readonly T[]) => T | undefined}} Rng
 */
/**
 * A seeded generator of numbers in [0, 1) (mulberry32 over the seed's hash): no clock, no unseeded randomness.
 * @param {...(string | number)} seed
 * @returns {Rng}
 */
export function rng(...seed) {
  let a = hash32(...seed);
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (/** @type {number} */ n) => Math.floor(next() * n);
  /**
   * @template T
   * @param {readonly T[]} list
   * @returns {T | undefined}
   */
  next.pick = (list) => list[Math.floor(next() * list.length)];
  return next;
}

/**
 * A position-addressed draw: the same (seed, ...at) gives the same number in [0, 1), with no sequence to replay.
 * @param {string | number} seed
 * @param {...(string | number)} at
 * @returns {number}
 */
export const drawAt = (seed, ...at) => hash32(seed, ...at) / 4294967296;

/* ---- the vocabulary (the units' words) ----
   Every unit carries a marker and one word, so it is checkable alone. The full list has accents, ligatures,
   CJK, RTL and a combining mark (C7, C8); a kind that cannot carry every script draws from its own subset. */
export const VOCAB = Object.freeze(["café", "naïve", "straße", "œuvre", "ﬁnance", "ﬂoor", "señor", "Ærø", "Zürich", "garçon",
  "市議会", "予算", "مدينة", "עירייה", "e\u0301tude", "budget", "council", "motion", "ordinance", "ledger"]);
/** Words every Latin-1 and Windows-1252 text can carry. */
export const LATIN_VOCAB = Object.freeze(["café", "naïve", "straße", "señor", "Ærø", "Zürich", "garçon", "budget", "council", "motion", "ordinance", "ledger"]);
/** Words of plain ASCII letters, for the bitmap font of pictures and scans. */
export const ASCII_VOCAB = Object.freeze(["budget", "council", "motion", "ordinance", "ledger", "agenda", "minutes", "permit", "zoning", "audit", "parcel", "levy"]);

/**
 * Whether a part of a recipe is an object (not null) whose members are read by name.
 * @param {unknown} v
 * @returns {v is {[key: string]: unknown}}
 */
const isRecord = (v) => !!v && typeof v === "object";

/**
 * The canonical text of a recipe: keys sorted at every depth, so equal recipes have one key.
 * @param {unknown} v a recipe: plain data, as JSON carries it; a member that is undefined is left out
 * @returns {string} what JSON.stringify answers for a value it has text for
 */
export function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (isRecord(v)) return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}
/**
 * The key of a recipe: the first 24 hex digits of the SHA-256 of its canonical text.
 * @param {unknown} recipe
 * @returns {string}
 */
export const recipeKey = (recipe) => createHash("sha256").update(canonical(recipe)).digest("hex").slice(0, 24);
