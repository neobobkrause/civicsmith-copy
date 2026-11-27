/* R37's reference: what each type answers on the module's fixtures, as digests, so a test can say the answers of the
 * bounded types are the answers they gave before (`fixtures/r37-answers.json`, written by `make-r37-answers.mjs` from
 * the types as they stood on the tranche tip before R37). Nothing here is the module under test. */
import { createHash } from "node:crypto";
import { DOCTYPES } from "../index.mjs";
import { flattenText } from "../../docprofile/readtext.mjs";
import { CASES } from "./golden-cases.mjs";
import { HELD } from "./fixtures.mjs";
import { POLICIES, FRESH } from "./policies.mjs";
import { servedDocuments, textOf } from "./codifier.mjs";
import { registryOf, readWith } from "./read.mjs";
/** @import { ContentType, DoctypeContext, SuppliedText } from "../../docprofile/doctypes/index.mjs" */
/** @import { ReadTextAnswer } from "../../docprofile/readtext.mjs" */

/**
 * One fixture reading: its name, the text supplied, and the context it is read in.
 * @typedef {Object} Reading
 * @property {string} id
 * @property {SuppliedText | string} supplied
 * @property {DoctypeContext} ctx
 */
/**
 * The answers on one reading (`answerOf`): each type's detect as a digest, by key, and the registry's verdict with the
 * winner's parse.
 * @typedef {Object} ReadingAnswer
 * @property {{ [key: string]: string }} detects
 * @property {string} type
 * @property {string | undefined} confidence
 * @property {string[]} also
 * @property {string} signals
 * @property {string} parsed
 */
/**
 * What `docprofile.readText` answered on a PDF's reading (`textAnswerOf`), the type's parts absent when it refused.
 * @typedef {Object} TextAnswer
 * @property {boolean} determined
 * @property {number} chars
 * @property {string | undefined} type
 * @property {string | undefined} confidence
 * @property {string[]} also
 * @property {string} signals
 * @property {string} parsed
 * @property {string | null} parse_error
 */

/** The SHA-256 of a value's JSON (undefined read as null), in hex.
 *  @param {unknown} v @returns {string} */
export const sha = (v) => createHash("sha256").update(JSON.stringify(v === undefined ? null : v)).digest("hex");

/** What a thrown value says, as `String(e && e.message)` read it: a falsy value itself, else its `message`.
 *  @param {unknown} e @returns {string} */
export function thrownText(e) {
  if (!e) return String(e);
  return String((typeof e === "object" || typeof e === "function") && "message" in e ? e.message : undefined);
}

/** `t.parse(ctx)`, with the `TypeError` calling a missing type or a missing `parse` raised.
 *  @param {ContentType | undefined} t @param {DoctypeContext} ctx @returns {object | null | undefined}
 *  @throws {TypeError} when there is no type, or it has no `parse` */
export function parseWith(t, ctx) {
  if (t === undefined) throw new TypeError("Cannot read properties of undefined (reading 'parse')");
  if (typeof t.parse !== "function") throw new TypeError("t.parse is not a function");
  return t.parse(ctx);
}

/** Every fixture reading: `{id, supplied, ctx}`.
 *  @returns {Reading[]} */
export function fixtureReadings() {
  /** @type {Reading[]} */
  const out = CASES.map((c) => ({ id: c.id, supplied: c.supplied, ctx: c.ctx }));
  for (const d of POLICIES.documents) out.push({ id: `policy:${d.id}`, supplied: d.text, ctx: { view: HELD } });
  for (const d of FRESH.documents) out.push({ id: `policy-fresh:${d.id}`, supplied: d.text, ctx: { view: HELD } });
  servedDocuments().forEach((s, i) => out.push({ id: `codifier:${i}`, supplied: textOf(s.doc), ctx: { view: HELD } }));
  return out;
}

const REG = registryOf(DOCTYPES);

/** The answers on one reading: each type's own `detect`, and the registry's verdict with the parse of the winner.
 *  @param {Reading} reading @returns {ReadingAnswer} */
export function answerOf(reading) {
  const text = flattenText(reading.supplied).text;
  /** @type {{ [key: string]: string }} */
  const detects = {};
  for (const t of DOCTYPES) {
    /** @type {object | null | undefined} */
    let r;
    try { r = t.detect({ ...reading.ctx, text }); } catch (e) { r = { threw: thrownText(e) }; }
    detects[t.key] = sha(r);
  }
  const r = readWith(REG, reading.supplied, reading.ctx);
  const found = r.doctype.type;
  if (!found) throw new TypeError("Cannot read properties of undefined (reading 'key')");
  return { detects, type: found.key, confidence: r.doctype.confidence, also: r.doctype.also.map((x) => x.key),
           signals: sha(r.doctype.signals), parsed: sha(r.parsed) };
}

/** The answer `docprofile.readText` gave on a PDF's reading (a determined or an undetermined one); a refusal carries no
 *  type's answer, read as absent.
 *  @param {ReadTextAnswer} r @returns {TextAnswer} */
export function textAnswerOf(r) {
  const doctype = "doctype" in r ? r.doctype : undefined;
  return { determined: r.determined, chars: r.chars, type: doctype && doctype.type.key,
           confidence: doctype && doctype.confidence, also: ((doctype && doctype.also) || []).map((x) => x.key),
           signals: sha(doctype && doctype.signals), parsed: sha("parsed" in r ? r.parsed : undefined),
           parse_error: ("parse_error" in r ? r.parse_error : undefined) || null };
}
