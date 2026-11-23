/* R10, R21: the limits the signed release states for the plane and for each member, read from the verified bytes. */
import { word } from "../../../bio-plane/src/setup-words/index.mjs";
import { ascii, find } from "./bytes.mjs";

/**
 * @typedef {Object} StatedLimits what a release's limits statement says
 * @property {boolean} ok
 * @property {Readonly<Record<string, number>>|null} [limits] the stated limits (when ok; a member that states none: null)
 * @property {string} [why] when not ok: `none` or `unreadable` (a member's: the sentence)
 * @property {string} [detail] what was unreadable
 */
/**
 * @typedef {Object} StatedCrons what a release's schedule statement says
 * @property {boolean} ok
 * @property {ReadonlyArray<string>} [crons] the one schedule (when ok)
 * @property {string} [why] when not ok: `none` or `unreadable`
 * @property {string} [detail] what was unreadable
 */

/* R20 (DIST-15, N336) — THE PLANE'S LIMITS, AS THE SIGNED RELEASE STATES THEM.
 *
 * DIST-7 sent a constant pinned to the plane's config, so an installer installing a later release with another ceiling
 * still sent its own. Now the plane's code states its limits (control-plane's statement, equal to `bio-plane/wrangler.jsonc`'s
 * `limits`), so the bundle a release signs carries them, and this reads them from the bytes R8 chose and verified: the
 * installer holds no value of its own. The statement is a string literal, `bio-plane-limits/1 key=n …`, because a bundler
 * rewrites numbers, renames constants and changes quotes, and a string's text survives all three; the bundle cannot be
 * executed here (a Worker imports no string), so it is read as text. Nothing is added to the fleet statement: the
 * limits ride inside the plane bytes the release signature and the fleet statement's plane hash already cover, so an
 * older installer still verifies the fleet signature of a release that carries them.
 *
 * `{ok: true, limits}`; or `{ok: false, why: "none"}` (no statement); or `{ok: false, why: "unreadable", detail}` (two
 * different statements, or one not of the form). */
/* One reader for both statements: the plane's (`bio-plane-limits/1`, R20) and a fleet member's (`bio-member-limits/1`,
   R39). The tag is matched as a whole quoted string, so neither statement is ever read as the other. */
/* `source` is the module as text, or as bytes (a release's verified download, which is never decoded to text: R33); the
   statements are found the same way in both. */
const QUOTES = new Set([34, 39, 96]);                      /* " ' ` */
const STATEMENT_STOP = new Set([34, 39, 96, 92, 10]);      /* a quote, a backslash, a newline end a statement's text */
function statementsInBytes(bytes, tag) {
  const pat = ascii(tag), bodies = new Set();
  for (let i = find(bytes, pat); i !== -1; i = find(bytes, pat, i + 1)) {
    const q = i > 0 ? bytes[i - 1] : -1, from = i + pat.length;
    if (!QUOTES.has(q) || bytes[from] !== 32) continue;
    let k = from;
    while (k < bytes.length && !STATEMENT_STOP.has(bytes[k])) k++;
    if (bytes[k] === q) bodies.add(new TextDecoder().decode(bytes.subarray(from, k)));
  }
  return bodies;
}
function statementBodies(source, tag) {
  const isBytes = source instanceof Uint8Array;
  if (typeof source !== "string" && !isBytes) return new Set();
  if (isBytes) return statementsInBytes(source, tag);
  const bodies = new Set();
  const re = new RegExp("([\"'`])" + tag.replace("/", "\\/") + "( [^\"'`\\\\\\n]*)\\1", "g");
  for (const m of source.matchAll(re)) bodies.add(m[2]);
  return bodies;
}
/**
 * @param {any} source the module as text or bytes; anything else states nothing
 * @param {string} tag the statement's tag (`bio-plane-limits/1` or `bio-member-limits/1`)
 * @returns {StatedLimits}
 * @bound exactly one distinct statement; each key `[a-z][a-z0-9_]*`, keys in ascending order, each value a whole number from 1 to 999999999
 */
function statedLimits(source, tag) {
  const bodies = statementBodies(source, tag);
  if (bodies.size === 0) return { ok: false, why: "none" };
  if (bodies.size > 1) return { ok: false, why: "unreadable", detail: `statements=${bodies.size}` };
  const [body] = bodies;
  const limits = {};
  let last = "";
  for (const part of body.slice(1).split(" ")) {
    const kv = /^([a-z][a-z0-9_]*)=([1-9][0-9]{0,8})$/.exec(part);
    if (!kv || kv[1] <= last) return { ok: false, why: "unreadable",
      detail: `form="${tag}${body}"` };
    limits[(last = kv[1])] = Number(kv[2]);
  }
  return { ok: true, limits: Object.freeze(limits) };
}
/**
 * @param {any} source the plane's module as text or bytes
 * @returns {StatedLimits}
 */
export const planeLimits = (source) => statedLimits(source, "bio-plane-limits/1");
/* R39 (K4566; fix round 6, G1) — THE PLANE'S SCHEDULE, AS THE SIGNED RELEASE STATES IT. control-plane signs the plane's one
 * cron beside its limits, as one quoted string `bio-plane-crons/1 <five fields>`; this reads it from the same verified bytes, as
 * R20 reads the limits, so the installer holds no schedule of its own. Exactly one distinct statement, of one schedule:
 * `{ok: true, crons}` (frozen, the one schedule); `{ok: false, why: "none"}`; or `{ok: false, why: "unreadable", detail}`. */
const CRONS_TAG = "bio-plane-crons/1";
const CRON = /^(?:[0-9*,/?LW#A-Za-z-]+ ){4}[0-9*,/?LW#A-Za-z-]+$/;
function statedCrons(bodies) {
  if (bodies.size === 0) return { ok: false, why: "none" };
  if (bodies.size > 1) return { ok: false, why: "unreadable", detail: `statements=${bodies.size}` };
  const [body] = bodies, cron = body.slice(1);
  if (!CRON.test(cron)) return { ok: false, why: "unreadable", detail: `form="${CRONS_TAG}${body}"` };
  return { ok: true, crons: Object.freeze([cron]) };
}
/**
 * @param {any} source the plane's module as text or bytes
 * @returns {StatedCrons}
 * @bound exactly one distinct statement of one schedule of five fields
 */
export const planeCrons = (source) => statedCrons(statementBodies(source, CRONS_TAG));
/* The same, read from a stream as it arrives (R38: the plane's 29 MB module is never held whole). A statement is found in the
   window of the last chunk and the tail kept from the one before, long enough for the tag, its quotes and a schedule, so a
   chunk boundary falls anywhere in it without changing the answer. */
const CARRY_BYTES = 256;
/**
 * @param {any} stream the plane's module as it downloads, a stream of byte chunks
 * @returns {Promise<StatedCrons>}
 * @bound exactly one distinct statement of one schedule of five fields
 */
export async function planeCronsOfStream(stream) {
  const bodies = new Set(), reader = stream.getReader();
  let carry = new Uint8Array(0);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const window = new Uint8Array(carry.length + value.length);
      window.set(carry); window.set(value, carry.length);
      for (const b of statementsInBytes(window, CRONS_TAG)) bodies.add(b);
      carry = window.slice(Math.max(0, window.length - CARRY_BYTES));
    }
  } finally { reader.releaseLock(); }
  return statedCrons(bodies);
}
/* The key each `why` of a refused release is said by (the installer, which knows the version, draws the sentence). */
/** @type {Readonly<{none: string, unreadable: string}>} */
const LIMITS_NOT_STATED = Object.freeze({ none: "installer.release.nolimits", unreadable: "installer.release.badlimits" });

/* R39 (N621; K1686, K1731; `sheet-worker` R17) — A FLEET MEMBER'S LIMITS, AS ITS SIGNED BUNDLE STATES THEM. A member's
   bundle, fetched and hashed against the fleet statement (R11), may state its own limits as one string
   `bio-member-limits/1 key=n …`, read exactly as R20 reads the plane's. `{ok: true, limits}` (null when it states none:
   uploaded with none, as before), or `{ok: false, why}` in words (the member is left out, named). Nothing is added to the
   fleet statement: the limits ride inside the member bytes the statement's hash already covers. */
/**
 * @param {string|Uint8Array} bytes the member's module as text or bytes
 * @returns {StatedLimits} `{ok: true, limits}` (null when it states none) or `{ok: false, why}` in words
 */
export function memberLimits(bytes) {
  const source = typeof bytes === "string" ? bytes : new TextDecoder().decode(bytes);
  const lim = statedLimits(source, "bio-member-limits/1");
  if (lim.ok) return lim;
  if (lim.why === "none") return { ok: true, limits: null };
  return { ok: false, why: word("installer.fleet.why.limits") };
}
export { LIMITS_NOT_STATED, statedLimits };
